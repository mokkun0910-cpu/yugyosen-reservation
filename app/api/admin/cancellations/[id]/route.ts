import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendCancelResult } from '@/lib/line'
import { formatDateJa } from '@/lib/utils'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminLog'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await checkAdminAuth(req)
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

    // BUG6修正: 同日の各プランを個別にチェックし、予約0のプランのみロック解除
    const { data: cancelledPlan } = await db.from('plans').select('departure_date_id').eq('id', reservation.plan_id).single()
    if (cancelledPlan) {
      const { data: allPlansOnDay } = await db.from('plans').select('id').eq('departure_date_id', cancelledPlan.departure_date_id)
      for (const p of allPlansOnDay || []) {
        const { data: planRes } = await db.from('reservations').select('id').eq('plan_id', p.id).neq('status', 'cancelled')
        if (!planRes || planRes.length === 0) {
          await db.from('plans').update({ is_locked: false }).eq('id', p.id)
        }
      }
    }
    // LINE通知
    let lineNotified = false
    let lineError = ''
    const plan = reservation.plans as any
    const date = plan?.departure_dates?.date
    if (reservation.line_user_id) {
      try {
        await sendCancelResult(reservation.line_user_id, true, reservation.reservation_number, plan?.name || '', date ? formatDateJa(date) : '')
        lineNotified = true
      } catch (e: any) {
        lineError = e?.message || 'LINE通知失敗'
        console.error('[cancel approve] LINE通知エラー:', lineError)
      }
    }

    const reservation2 = (cancelReq.reservations as any)
    const logDetail = `申請ID: ${id} 予約番号: ${reservation2?.reservation_number || ''}`
    logAdminAction(req, 'approve_cancel', logDetail).catch(() => {})

    return NextResponse.json({
      ok: true,
      lineNotified,
      // LINE IDが未設定の場合は管理者に通知
      ...(!reservation.line_user_id && { lineWarning: 'LINE IDが未設定のため通知を送信できませんでした。' }),
      ...(lineError && { lineError }),
    })
  } else {
    const reservation = cancelReq.reservations as any
    let lineNotified = false
    let lineError = ''
    if (reservation.line_user_id) {
      const plan = reservation.plans as any
      const date = plan?.departure_dates?.date
      try {
        await sendCancelResult(reservation.line_user_id, false, reservation.reservation_number, plan?.name || '', date ? formatDateJa(date) : '')
        lineNotified = true
      } catch (e: any) {
        lineError = e?.message || 'LINE通知失敗'
        console.error('[cancel reject] LINE通知エラー:', lineError)
      }
    }

    const logDetail = `申請ID: ${id} 予約番号: ${reservation?.reservation_number || ''}`
    logAdminAction(req, 'reject_cancel', logDetail).catch(() => {})

    return NextResponse.json({
      ok: true,
      lineNotified,
      ...(!reservation.line_user_id && { lineWarning: 'LINE IDが未設定のため通知を送信できませんでした。' }),
      ...(lineError && { lineError }),
    })
  }

}
