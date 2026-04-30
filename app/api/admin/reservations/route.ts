import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'
import { generateReservationNumber } from '@/lib/utils'
import { sendCaptainNotification } from '@/lib/line'

export async function GET(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  try {
    const db = createServerClient()

    // Step1: ã¾ããã¹ã¦ã®äºç´ãåå¾ï¼ã¹ãã¼ã¿ã¹ã«é¢ãããä»¶æ°ç¢ºèªç¨ï¼
    const { data: allReservations, error: allError } = await db
      .from('reservations')
      .select('id, status')

    const totalInDB = allReservations?.length ?? 0
    const statusSummary = (allReservations || []).reduce((acc: any, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})

    // Step2: ã­ã£ã³ã»ã«ä»¥å¤ã®äºç´ãåå¾
    const { data: reservations, error } = await db
      .from('reservations')
      .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id, created_at')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message, totalInDB, statusSummary },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (!reservations || reservations.length === 0) {
      return NextResponse.json(
        { reservations: [], totalInDB, statusSummary },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // Step3: planæå ±ãåå¥ã«åå¾
    const planIds = Array.from(new Set(reservations.map((r: any) => r.plan_id)))
    const { data: plans } = await db
      .from('plans')
      .select('id, name, departure_time, departure_date_id')
      .in('id', planIds)

    // Step4: departure_dateæå ±ãåå¥ã«åå¾
    const dateIds = Array.from(new Set((plans || []).map((p: any) => p.departure_date_id)))
    const { data: dates } = await db
      .from('departure_dates')
      .select('id, date')
      .in('id', dateIds)

    // Step5: ãã¼ã¿ãçµå
    const enriched = reservations.map((r: any) => {
      const plan = (plans || []).find((p: any) => p.id === r.plan_id)
      const date = plan ? (dates || []).find((d: any) => d.id === plan.departure_date_id) : null
      return {
        ...r,
        plans: plan ? {
          name: plan.name,
          departure_time: plan.departure_time,
          departure_dates: date ? { date: date.date } : null,
        } : null,
      }
    })

    return NextResponse.json(
      { reservations: enriched, totalInDB, statusSummary },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const body = await req.json()
  const {
    planId, representativeName, representativePhone, totalMembers,
    representativeBirthDate, representativeAddress,
    representativeEmergencyName, representativeEmergencyPhone,
  } = body

  if (!planId || !representativeName || !representativePhone || !totalMembers) {
    return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: plan } = await db
    .from('plans')
    .select('*, departure_dates(date)')
    .eq('id', planId)
    .single()

  if (!plan) return NextResponse.json({ error: 'プランが見つかりません。' }, { status: 404 })

  const { data: existingRes } = await db
    .from('reservations')
    .select('total_members')
    .eq('plan_id', planId)
    .neq('status', 'cancelled')
  const currentCount = (existingRes || []).reduce((sum: number, r: any) => sum + r.total_members, 0)
  if (currentCount + totalMembers > plan.capacity) {
    return NextResponse.json(
      { error: `定員を超えています。現在 ${currentCount}名 / 定員 ${plan.capacity}名` },
      { status: 400 }
    )
  }

  const reservationNumber = generateReservationNumber()

  const { data: reservation, error: resError } = await db
    .from('reservations')
    .insert({
      plan_id: planId,
      reservation_number: reservationNumber,
      representative_name: representativeName,
      representative_phone: representativePhone,
      line_user_id: null,
      total_members: totalMembers,
      status: 'pending_members',
    })
    .select()
    .single()

  if (resError) return NextResponse.json({ error: '予約の作成に失敗しました。' }, { status: 500 })

  const memberRecords = Array.from({ length: totalMembers }, () => ({
    reservation_id: reservation.id,
    is_completed: false,
  }))
  const { data: members } = await db.from('members').insert(memberRecords).select()

  // 代表者の乗船情報を登録（生年月日が入力されている場合）
  if (members && members.length > 0 && representativeBirthDate) {
    await db.from('members').update({
      name: representativeName,
      birth_date: representativeBirthDate,
      address: representativeAddress || '',
      phone: representativePhone,
      emergency_contact_name: representativeEmergencyName || '',
      emergency_contact_phone: representativeEmergencyPhone || '',
      is_completed: !!(representativeAddress && representativeEmergencyName && representativeEmergencyPhone),
    }).eq('id', members[0].id)
  }

  // 1名かつ代表者情報が全て揃っていれば即確定
  const fullyCompleted =
    totalMembers === 1 &&
    representativeBirthDate &&
    representativeAddress &&
    representativeEmergencyName &&
    representativeEmergencyPhone
  if (fullyCompleted) {
    await db.from('reservations').update({ status: 'confirmed' }).eq('id', reservation.id)
  }

  // 同日の他プランをロック（この日初の予約の場合）
  if (currentCount === 0) {
    await db
      .from('plans')
      .update({ is_locked: true })
      .eq('departure_date_id', plan.departure_date_id)
      .neq('id', planId)
  }

  // 船長へLINE通知
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
