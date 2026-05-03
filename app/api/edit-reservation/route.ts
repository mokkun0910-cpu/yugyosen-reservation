import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// 予約番号+電話番号で照合して予約情報を返す
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const number = searchParams.get('number')
  const phone = searchParams.get('phone')

  if (!number || !phone) {
    return NextResponse.json({ error: '予約番号と電話番号が必要です。' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: reservation } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_furigana, representative_phone, total_members, status, plan_id')
    .eq('reservation_number', number)
    .eq('representative_phone', phone)
    .neq('status', 'cancelled')
    .single()

  if (!reservation) {
    return NextResponse.json({ error: '予約が見つかりません。予約番号と電話番号をご確認ください。' }, { status: 404 })
  }

  // プラン・日付情報を取得
  const { data: plan } = await db
    .from('plans')
    .select('id, name, departure_time, capacity, departure_dates(date)')
    .eq('id', reservation.plan_id)
    .single()

  // 現在のこのプランの予約人数合計（自分以外）
  const { data: otherRes } = await db
    .from('reservations')
    .select('total_members')
    .eq('plan_id', reservation.plan_id)
    .neq('id', reservation.id)
    .neq('status', 'cancelled')
  const othersCount = (otherRes || []).reduce((s: number, r: any) => s + r.total_members, 0)
  const maxMembers = plan ? plan.capacity - othersCount : reservation.total_members

  return NextResponse.json({
    reservation: {
      ...reservation,
      planName: plan?.name || '',
      departureTime: plan?.departure_time?.slice(0, 5) || '',
      date: (plan?.departure_dates as any)?.date || '',
      maxMembers,
    }
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// 代表者情報・人数を更新
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { reservationId, phone, name, furigana, totalMembers } = body

  if (!reservationId || !phone) {
    return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 })
  }

  const db = createServerClient()

  // 本人確認（電話番号で照合）
  const { data: reservation } = await db
    .from('reservations')
    .select('id, representative_phone, total_members, plan_id, status')
    .eq('id', reservationId)
    .eq('representative_phone', phone)
    .neq('status', 'cancelled')
    .single()

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
      return NextResponse.json({ error: `定員オーバーです。変更可能な最大人数は ${plan.capacity - othersCount}名です。` }, { status: 400 })
    }

    // 人数増減に合わせてmembersレコードを調整
    if (totalMembers > reservation.total_members) {
      const addCount = totalMembers - reservation.total_members
      const newMembers = Array.from({ length: addCount }, () => ({
        reservation_id: reservationId, is_completed: false,
      }))
      await db.from('members').insert(newMembers)
    } else if (totalMembers < reservation.total_members) {
      // 末尾の未入力メンバーから削除
      const { data: members } = await db
        .from('members').select('id, is_completed')
        .eq('reservation_id', reservationId).order('id', { ascending: false })
      const toDelete = (members || [])
        .filter((m: any) => !m.is_completed)
        .slice(0, reservation.total_members - totalMembers)
        .map((m: any) => m.id)
      if (toDelete.length > 0) {
        await db.from('members').delete().in('id', toDelete)
      }
    }
  }

  // 更新
  const updatePayload: any = {}
  if (name) updatePayload.representative_name = name
  if (furigana !== undefined) updatePayload.representative_furigana = furigana || null
  if (totalMembers) updatePayload.total_members = totalMembers

  await db.from('reservations').update(updatePayload).eq('id', reservationId)

  return NextResponse.json({ ok: true })
}
