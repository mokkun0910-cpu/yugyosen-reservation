import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendReservationPending, sendCaptainNotification } from '@/lib/line'
import { generateReservationNumber } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { planId, representativeName, representativePhone, lineUserId, totalMembers } = body

  if (!planId || !representativeName || !representativePhone || !totalMembers) {
    return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 })
  }

  const db = createServerClient()

  // プランと出船日の情報を取得
  const { data: plan } = await db
    .from('plans')
    .select('*, departure_dates(date)')
    .eq('id', planId)
    .single()

  if (!plan) return NextResponse.json({ error: 'プランが見つかりません。' }, { status: 404 })
  if (plan.is_locked) return NextResponse.json({ error: 'このプランは受付終了しています。' }, { status: 400 })

  // 現在の予約人数を確認
  const { data: existingRes } = await db
    .from('reservations')
    .select('total_members')
    .eq('plan_id', planId)
    .neq('status', 'cancelled')
  const currentCount = (existingRes || []).reduce((sum, r) => sum + r.total_members, 0)
  if (currentCount + totalMembers > plan.capacity) {
    return NextResponse.json({ error: '定員を超えています。' }, { status: 400 })
  }

  // 予約番号を生成
  const reservationNumber = generateReservationNumber()

  // 予約を作成
  const { data: reservation, error: resError } = await db
    .from('reservations')
    .insert({
      plan_id: planId,
      reservation_number: reservationNumber,
      representative_name: representativeName,
      representative_phone: representativePhone,
      line_user_id: lineUserId || null,
      total_members: totalMembers,
      status: 'pending_members',
    })
    .select()
    .single()

  if (resError) return NextResponse.json({ error: '予約の作成に失敗しました。' }, { status: 500 })

  // 乗船者レコードを人数分作成
  const memberRecords = Array.from({ length: totalMembers }, () => ({
    reservation_id: reservation.id,
    is_completed: false,
  }))
  const { data: members } = await db.from('members').insert(memberRecords).select()

  // 同日の他プランをロック（最初の予約の場合）
  if (currentCount === 0) {
    await db
      .from('plans')
      .update({ is_locked: true })
      .eq('departure_date_id', plan.departure_date_id)
      .neq('id', planId)
  }

  // LINE通知（代表者へ）
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  if (lineUserId && members) {
    const memberLinks = members.map((m: any) => m.input_token)
    await sendReservationPending(lineUserId, {
      reservationNumber,
      planName: plan.name,
      date: (plan.departure_dates as any).date,
      departureTime: plan.departure_time,
      totalMembers,
      memberLinks,
      appUrl,
    }).catch(console.error)
  }

  // LINE通知（船長へ）
  const captainLineUserId = process.env.CAPTAIN_LINE_USER_ID
  if (captainLineUserId) {
    await sendCaptainNotification(captainLineUserId, {
      reservationNumber,
      representativeName,
      planName: plan.name,
      date: (plan.departure_dates as any).date,
      totalMembers,
      currentTotal: currentCount + totalMembers,
      capacity: plan.capacity,
    }).catch(console.error)
  }

  return NextResponse.json({ reservationNumber })
}
