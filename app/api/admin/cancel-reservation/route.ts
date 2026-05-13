import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminLog'
import { sendAdminCancelNotification } from '@/lib/line'
import { formatDateJa } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const { reservationId } = await req.json()
  if (!reservationId) return NextResponse.json({ error: 'reservationIdが必要です。' }, { status: 400 })

  const db = createServerClient()

  // 予約情報を取得（LINE通知用に詳細も取得）
  const { data: reservation } = await db
    .from('reservations')
    .select('id, plan_id, status, line_user_id, reservation_number, plans(name, departure_dates(date))')
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
  if (reservation.line_user_id) {
    try {
      const plan = reservation.plans as any
      const date = plan?.departure_dates?.date
      await sendAdminCancelNotification(
        reservation.line_user_id,
        reservation.reservation_number,
        plan?.name || '',
        date ? formatDateJa(date) : ''
      )
      lineNotified = true
    } catch (e: any) {
      lineError = e?.message || 'LINE通知失敗'
      console.error('[admin_cancel] LINE通知エラー:', lineError)
    }
  }

  logAdminAction(req, 'admin_cancel', `予約ID: ${reservationId}`).catch(() => {})
  return NextResponse.json({
    ok: true,
    lineNotified,
    ...(!reservation.line_user_id && { lineWarning: 'LINE IDが未設定のため通知を送信できませんでした。' }),
    ...(lineError && { lineError }),
  })
}
