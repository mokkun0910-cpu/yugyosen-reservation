import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendCancelResult } from '@/lib/line'
import { formatDateJa, BOAT_NAME } from '@/lib/utils'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminLog'
import { sendSms } from '@/lib/sms'

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
    const dateLabel = date ? formatDateJa(date) : ''
    if (reservation.line_user_id) {
      try {
        await sendCancelResult(reservation.line_user_id, true, reservation.reservation_number, plan?.name || '', dateLabel)
        lineNotified = true
      } catch (e: any) {
        lineError = e?.message || 'LINE通知失敗'
        console.error('[cancel approve] LINE通知エラー:', lineError)
      }
    }
    // SMS通知（LINE未連携時のみ）
    let smsNotified = false
    let smsError = ''
    if (!reservation.line_user_id && reservation.representative_phone) {
      const body = `【${BOAT_NAME}】キャンセル承認しました\n№${reservation.reservation_number}\n${dateLabel}\nまたのご利用をお待ちしております`
      const r = await sendSms(reservation.representative_phone, body).catch((e) => ({ ok: false, error: e?.message || String(e) }))
      if (r.ok) smsNotified = true
      else if (!(r as any).skipped) smsError = (r as any).error || 'SMS失敗'
    }

    const reservation2 = (cancelReq.reservations as any)
    const logDetail = `申請ID: ${id} 予約番号: ${reservation2?.reservation_number || ''}`
    logAdminAction(req, 'approve_cancel', logDetail).catch(() => {})

    return NextResponse.json({
      ok: true,
      lineNotified,
      smsNotified,
      // 通知が一切届かない場合は管理者にアラート
      ...(!reservation.line_user_id && !smsNotified && {
        lineWarning: 'LINE未連携・SMS未送信。お客様にお電話でご連絡ください。',
      }),
      ...(lineError && { lineError }),
      ...(smsError && { smsError }),
    })
  } else {
    const reservation = cancelReq.reservations as any
    let lineNotified = false
    let lineError = ''
    const plan = reservation.plans as any
    const date = plan?.departure_dates?.date
    const dateLabel = date ? formatDateJa(date) : ''
    if (reservation.line_user_id) {
      try {
        await sendCancelResult(reservation.line_user_id, false, reservation.reservation_number, plan?.name || '', dateLabel)
        lineNotified = true
      } catch (e: any) {
        lineError = e?.message || 'LINE通知失敗'
        console.error('[cancel reject] LINE通知エラー:', lineError)
      }
    }
    // SMS通知（LINE未連携時のみ）
    let smsNotified = false
    let smsError = ''
    if (!reservation.line_user_id && reservation.representative_phone) {
      const body = `【${BOAT_NAME}】キャンセル申請を却下しました\n№${reservation.reservation_number}\n${dateLabel}\nお電話ください ☎0940-62-1221`
      const r = await sendSms(reservation.representative_phone, body).catch((e) => ({ ok: false, error: e?.message || String(e) }))
      if (r.ok) smsNotified = true
      else if (!(r as any).skipped) smsError = (r as any).error || 'SMS失敗'
    }

    const logDetail = `申請ID: ${id} 予約番号: ${reservation?.reservation_number || ''}`
    logAdminAction(req, 'reject_cancel', logDetail).catch(() => {})

    return NextResponse.json({
      ok: true,
      lineNotified,
      smsNotified,
      ...(!reservation.line_user_id && !smsNotified && {
        lineWarning: 'LINE未連携・SMS未送信。お客様にお電話でご連絡ください。',
      }),
      ...(lineError && { lineError }),
      ...(smsError && { smsError }),
    })
  }

}
