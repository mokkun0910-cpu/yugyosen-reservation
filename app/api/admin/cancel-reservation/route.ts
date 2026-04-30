import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { reservationId } = await req.json()
  if (!reservationId) return NextResponse.json({ error: 'reservationIdが必要です。' }, { status: 400 })

  const db = createServerClient()

  // 予約情報を取得
  const { data: reservation } = await db
    .from('reservations')
    .select('id, plan_id, status')
    .eq('id', reservationId)
    .single()

  if (!reservation) return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
  if (reservation.status === 'cancelled') return NextResponse.json({ error: 'すでにキャンセル済みです。' }, { status: 400 })

  // 乗船者レコードを削除
  await db.from('members').delete().eq('reservation_id', reservationId)

  // 予約をキャンセル状態に変更
  await db.from('reservations').update({ status: 'cancelled' }).eq('id', reservationId)

  // キャンセル申請があれば承認済みに変更
  await db.from('cancellation_requests').update({ status: 'approved' }).eq('reservation_id', reservationId).eq('status', 'pending')

  // 同プランの残予約が0になったらプランのロックを解除
  const { data: remaining } = await db
    .from('reservations')
    .select('total_members')
    .eq('plan_id', reservation.plan_id)
    .neq('status', 'cancelled')
  const total = (remaining || []).reduce((sum: number, r: any) => sum + r.total_members, 0)
  if (total === 0) {
    const { data: plan } = await db.from('plans').select('departure_date_id').eq('id', reservation.plan_id).single()
    if (plan) {
      await db.from('plans').update({ is_locked: false }).eq('departure_date_id', plan.departure_date_id)
    }
  }

  return NextResponse.json({ ok: true })
}
