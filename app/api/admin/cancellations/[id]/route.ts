import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendCancelResult } from '@/lib/line'
import { formatDateJa } from '@/lib/utils'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { id } = params
  const { action } = await req.json() // 'approve' | 'reject'
  const db = createServerClient()

  const { data: cancelReq } = await db
    .from('cancellation_requests')
    .select('*, reservations(*, plans(name, departure_dates(date)))')
    .eq('id', id)
    .single()

  if (!cancelReq) return NextResponse.json({ error: '申請が見つかりません。' }, { status: 404 })

  const approved = action === 'approve'
  const newStatus = approved ? 'approved' : 'rejected'

  await db.from('cancellation_requests').update({ status: newStatus }).eq('id', id)

  if (approved) {
    const reservation = cancelReq.reservations as any
    // 乗船者レコードを削除（アドレス帳の乗船履歴に残さないようにする）
    await db.from('members').delete().eq('reservation_id', reservation.id)
    // 予約をキャンセル状態に
    await db.from('reservations').update({ status: 'cancelled' }).eq('id', reservation.id)

    // 同プランの合計人数が0になったらプランロックを解除
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
    // LINE通知
    if (reservation.line_user_id) {
      const plan = reservation.plans as any
      const date = plan?.departure_dates?.date
      await sendCancelResult(reservation.line_user_id, true, reservation.reservation_number, plan?.name || '', date ? formatDateJa(date) : '').catch(console.error)
    }
  } else {
    const reservation = cancelReq.reservations as any
    if (reservation.line_user_id) {
      const plan = reservation.plans as any
      const date = plan?.departure_dates?.date
      await sendCancelResult(reservation.line_user_id, false, reservation.reservation_number, plan?.name || '', date ? formatDateJa(date) : '').catch(console.error)
    }
  }

  return NextResponse.json({ ok: true })
}
