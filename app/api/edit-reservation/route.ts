import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// BUG8修正: キャンセルAPIと同じ電話番号バリアント処理を追加
function toHalf(str: string): string {
  return str
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[－−‐―]/g, '-')
}
function toFull(str: string): string {
  return str
    .replace(/[0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0))
    .replace(/-/g, '－')
}
function phoneVariants(input: string): string[] {
  const half = toHalf(input.trim())
  const digits = half.replace(/\D/g, '')
  const variants = new Set<string>([input.trim(), half, digits, toFull(digits)])
  if (digits.length === 11) {
    const fmt = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
    variants.add(fmt)
    variants.add(toFull(fmt))
  } else if (digits.length === 10) {
    const fmt = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
    variants.add(fmt)
    variants.add(toFull(fmt))
  }
  return Array.from(variants)
}

// 電話番号で予約を検索して返す
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')

  if (!phone) {
    return NextResponse.json({ error: '電話番号が必要です。' }, { status: 400 })
  }

  const db = createServerClient()
  const phones = phoneVariants(phone)

  const { data: reservations } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_furigana, representative_phone, total_members, status, plan_id')
    .in('representative_phone', phones)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (!reservations || reservations.length === 0) {
    return NextResponse.json(
      { error: 'この電話番号の予約が見つかりません。' },
      { status: 404 }
    )
  }

  // プラン・日付情報を付加
  const enriched = await Promise.all(reservations.map(async (r) => {
    const { data: plan } = await db
      .from('plans')
      .select('id, name, departure_time, capacity, departure_dates(date)')
      .eq('id', r.plan_id)
      .single()

    // 他の予約の合計人数（自分以外）→ 増やせる最大人数を計算
    const { data: otherRes } = await db
      .from('reservations')
      .select('total_members')
      .eq('plan_id', r.plan_id)
      .neq('id', r.id)
      .neq('status', 'cancelled')
    const othersCount = (otherRes || []).reduce((s: number, x: any) => s + x.total_members, 0)
    const maxMembers = plan ? Math.max(r.total_members, plan.capacity - othersCount) : r.total_members

    return {
      ...r,
      planName: plan?.name || '',
      departureTime: plan?.departure_time?.slice(0, 5) || '',
      date: (plan?.departure_dates as any)?.date || '',
      maxMembers,
    }
  }))

  return NextResponse.json(
    { reservations: enriched },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// 予約内容を変更する
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { reservationId, phone, name, furigana, newPhone, totalMembers } = body

  if (!reservationId || !phone) {
    return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 })
  }
  if (totalMembers !== undefined && (typeof totalMembers !== 'number' || totalMembers < 1 || !Number.isInteger(totalMembers))) {
    return NextResponse.json({ error: '人数は1名以上の整数で指定してください。' }, { status: 400 })
  }

  const db = createServerClient()

  // 本人確認（電話番号バリアントで照合）
  const phones = phoneVariants(phone)
  const { data: reservationRows } = await db
    .from('reservations')
    .select('id, representative_phone, total_members, plan_id')
    .eq('id', reservationId)
    .in('representative_phone', phones)
    .neq('status', 'cancelled')
  const reservation = reservationRows && reservationRows.length > 0 ? reservationRows[0] : null

  if (!reservation) {
    return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
  }

  // 人数変更の場合は定員チェック
  if (totalMembers && totalMembers !== reservation.total_members) {
    const { data: plan } = await db.from('plans').select('capacity').eq('id', reservation.plan_id).single()
    const { data: otherRes } = await db
      .from('reservations').select('total_members')
      .eq('plan_id', reservation.plan_id).neq('id', reservationId).neq('status', 'cancelled')
    const othersCount = (otherRes || []).reduce((s: number, r: any) => s + r.total_members, 0)
    if (plan && totalMembers > plan.capacity - othersCount) {
      return NextResponse.json(
        { error: `定員オーバーです。変更可能な最大人数は ${plan.capacity - othersCount}名です。` },
        { status: 400 }
      )
    }

    // 人数増減に合わせてmembersレコードを調整
    if (totalMembers > reservation.total_members) {
      const addCount = totalMembers - reservation.total_members
      await db.from('members').insert(
        Array.from({ length: addCount }, () => ({ reservation_id: reservationId, is_completed: false }))
      )
    } else if (totalMembers < reservation.total_members) {
      // BUG9修正: 未入力→入力済みの順で削除（必要数を確保する）
      const { data: members } = await db
        .from('members').select('id, is_completed')
        .eq('reservation_id', reservationId).order('id', { ascending: false })
      const needed = reservation.total_members - totalMembers
      // まず未入力から削除、足りなければ入力済みも削除
      const incomplete = (members || []).filter((m: any) => !m.is_completed)
      const complete = (members || []).filter((m: any) => m.is_completed)
      const toDelete = [
        ...incomplete.slice(0, needed),
        ...complete.slice(0, Math.max(0, needed - incomplete.length)),
      ].map((m: any) => m.id)
      if (toDelete.length > 0) {
        await db.from('members').delete().in('id', toDelete)
      }
    }
  }

  // 予約情報を更新
  const updatePayload: any = {}
  if (name) updatePayload.representative_name = name
  if (furigana !== undefined) updatePayload.representative_furigana = furigana || null
  if (newPhone) updatePayload.representative_phone = newPhone
  if (totalMembers) updatePayload.total_members = totalMembers

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await db.from('reservations').update(updatePayload).eq('id', reservationId)
    if (error) return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
