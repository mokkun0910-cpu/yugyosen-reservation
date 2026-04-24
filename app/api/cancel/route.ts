import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendCancelRequestToCaptain } from '@/lib/line'
import { formatDateJa } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const { reservationNumber } = await req.json()
  if (!reservationNumber) return NextResponse.json({ error: '予約番号を入力してください。' }, { status: 400 })

  const db = createServerClient()

  const { data: reservation } = await db
    .from('reservations')
    .select('*, plans(*, departure_dates(date))')
    .eq('reservation_number', reservationNumber)
    .single()

  if (!reservation) return NextResponse.json({ error: '予約が見つかりません。予約番号を確認してください。' }, { status: 404 })
  if (reservation.status === 'cancelled') return NextResponse.json({ error: 'すでにキャンセル済みです。' }, { status: 400 })

  // キャンセル申請が既にあるか確認
  const { data: existing } = await db
    .from('cancellation_requests')
    .select('id')
    .eq('reservation_id', reservation.id)
    .eq('status', 'pending')
    .single()

  if (existing) return NextResponse.json({ error: 'すでにキャンセル申請中です。' }, { status: 400 })

  // キャンセル申請を作成
  await db.from('cancellation_requests').insert({ reservation_id: reservation.id })

  // 船長にLINE通知
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
