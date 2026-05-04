import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendCancelRequestToCaptain } from '@/lib/line'
import { formatDateJa } from '@/lib/utils'

// 電話番号を正規化（数字のみ）してバリエーションを生成
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
  const variants = new Set<string>([
    input.trim(),
    half,
    digits,
    toFull(digits),
  ])
  // 11桁（例: 09012345678）→ 090-1234-5678
  if (digits.length === 11) {
    const fmt = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
    variants.add(fmt)
    variants.add(toFull(fmt))
  }
  // 10桁（例: 0312345678）→ 03-1234-5678 or 031-234-5678
  if (digits.length === 10) {
    const fmt1 = `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6)}`
    const fmt2 = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`
    variants.add(fmt1); variants.add(toFull(fmt1))
    variants.add(fmt2); variants.add(toFull(fmt2))
  }
  return Array.from(variants)
}

// 電話番号 or LINE User IDで予約を検索
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')
  const lineUserId = searchParams.get('lineUserId')

  if (!phone && !lineUserId) return NextResponse.json({ error: '電話番号を入力してください。' }, { status: 400 })

  const db = createServerClient()

  // LINE User IDで検索（LIFF経由）
  if (lineUserId) {
    const { data: lineReservations } = await db
      .from('reservations')
      .select('id, reservation_number, representative_name, representative_phone, total_members, status, plans(name, departure_time, departure_dates(date))')
      .eq('line_user_id', lineUserId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (!lineReservations || lineReservations.length === 0) {
      return NextResponse.json({ reservations: [] })
    }

    const enriched = await Promise.all(
      lineReservations.map(async (r) => {
        const { data: members } = await db
          .from('members')
          .select('id, name, phone, is_completed')
          .eq('reservation_id', r.id)
        return { ...r, members: members || [], isRepresentative: true, myMemberId: null }
      })
    )
    return NextResponse.json({ reservations: enriched })
  }

  const phones = phoneVariants(phone!)

  // 代表者の電話番号で検索
  const { data: repReservations } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_phone, total_members, status, plans(name, departure_time, departure_dates(date))')
    .in('representative_phone', phones)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  // 同行者の電話番号で検索
  const { data: memberRows } = await db
    .from('members')
    .select('id, reservation_id, name, phone, is_completed')
    .in('phone', phones)
    .eq('is_completed', true)

  // 同行者の予約IDから予約情報を取得
  let memberReservations: any[] = []
  if (memberRows && memberRows.length > 0) {
    const resIds = Array.from(new Set(memberRows.map((m) => m.reservation_id)))
    const { data: mRes } = await db
      .from('reservations')
      .select('id, reservation_number, representative_name, representative_phone, total_members, status, plans(name, departure_time, departure_dates(date))')
      .in('id', resIds)
      .neq('status', 'cancelled')
    memberReservations = mRes || []
  }

  // 重複を除いてマージ
  const allRes = [...(repReservations || [])]
  for (const r of memberReservations) {
    if (!allRes.find((x) => x.id === r.id)) allRes.push(r)
  }

  if (allRes.length === 0) {
    return NextResponse.json({ reservations: [] })
  }

  // 各予約の同行者一覧を取得
  const enriched = await Promise.all(
    allRes.map(async (r) => {
      const { data: members } = await db
        .from('members')
        .select('id, name, phone, is_completed')
        .eq('reservation_id', r.id)
      return {
        ...r,
        members: members || [],
        isRepresentative: r.representative_phone === phone,
        myMemberId: memberRows?.find((m) => m.reservation_id === r.id)?.id || null,
      }
    })
  )

  return NextResponse.json({ reservations: enriched })
}

// キャンセル申請
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, reservationNumber, reservationId, memberId } = body

  const db = createServerClient()

  // ① グループ全員キャンセル
  if (type === 'full' || !type) {
    if (!reservationNumber) return NextResponse.json({ error: '予約番号がありません。' }, { status: 400 })

    const { data: reservation } = await db
      .from('reservations')
      .select('*, plans(*, departure_dates(date))')
      .eq('reservation_number', reservationNumber)
      .single()

    if (!reservation) return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
    if (reservation.status === 'cancelled') return NextResponse.json({ error: 'すでにキャンセル済みです。' }, { status: 400 })

    const { data: existing } = await db
      .from('cancellation_requests')
      .select('id')
      .eq('reservation_id', reservation.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'すでにキャンセル申請中です。' }, { status: 400 })

    await db.from('cancellation_requests').insert({ reservation_id: reservation.id })

    const captainLineUserId = process.env.CAPTAIN_LINE_USER_ID
    if (captainLineUserId) {
      const plan = reservation.plans as any
      const date = plan?.departure_dates?.date
      await sendCancelRequestToCaptain(captainLineUserId, {
        reservationNumber,
        representativeName: reservation.representative_name,
        planName: plan?.name || '',
        date: date ? formatDateJa(date) : '',
        totalMembers: reservation.total_members,
      }).catch(console.error)
    }
    return NextResponse.json({ ok: true })
  }

  // ② 1名だけキャンセル（人数変更）
  if (type === 'member') {
    if (!reservationId || !memberId) return NextResponse.json({ error: 'パラメータが不足しています。' }, { status: 400 })

    const { data: reservation } = await db
      .from('reservations')
      .select('*, plans(*, departure_dates(date))')
      .eq('id', reservationId)
      .single()

    if (!reservation) return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })

    // memberId が当該 reservationId に属することを確認（他者の乗船者削除を防止）
    const { data: member } = await db
      .from('members')
      .select('name')
      .eq('id', memberId)
      .eq('reservation_id', reservationId)
      .single()

    if (!member) return NextResponse.json({ error: '乗船者情報が見つかりません。' }, { status: 404 })

    const newTotal = reservation.total_members - 1

    if (newTotal <= 0) {
      // 最後の1名 → 予約全体をキャンセル申請
      const { data: existing } = await db
        .from('cancellation_requests')
        .select('id')
        .eq('reservation_id', reservationId)
        .eq('status', 'pending')
        .maybeSingle()

      if (!existing) {
        await db.from('cancellation_requests').insert({ reservation_id: reservationId })
      }
    } else {
      // 人数を1減らして乗船者レコードを削除
      await db.from('reservations').update({ total_members: newTotal }).eq('id', reservationId)
      await db.from('members').delete().eq('id', memberId)
    }

    // 船長にLINE通知
    const captainLineUserId = process.env.CAPTAIN_LINE_USER_ID
    if (captainLineUserId) {
      const plan = reservation.plans as any
      const date = plan?.departure_dates?.date
      const message = newTotal <= 0
        ? `❌ キャンセル申請（全員）\n\n【予約番号】${reservation.reservation_number}\n【代表者】${reservation.representative_name}\n【釣り物】${plan?.name || ''}\n【日程】${date ? formatDateJa(date) : ''}\n\n最後の乗船者がキャンセルしたため予約全体のキャンセルをご確認ください。`
        : `👤 乗船者1名キャンセル\n\n【予約番号】${reservation.reservation_number}\n【代表者】${reservation.representative_name}\n【釣り物】${plan?.name || ''}\n【日程】${date ? formatDateJa(date) : ''}\n\n「${member.name}」がキャンセルしました。\n変更後の人数: ${newTotal}名`

      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: captainLineUserId,
          messages: [{ type: 'text', text: message }],
        }),
      }).catch(console.error)
    }

    return NextResponse.json({ ok: true, newTotal })
  }

  return NextResponse.json({ error: '無効なリクエストです。' }, { status: 400 })
}
