import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendCancelResult } from '@/lib/line'
import { formatDateJa, BOAT_NAME } from '@/lib/utils'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminLog'
import { sendSms } from '@/lib/sms'

/** Supabaseのネスト結果がオブジェクトでも配列でも安全に取り出すヘルパー */
function pickOne<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null
  if (Array.isArray(rel)) return rel[0] || null
  return rel
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  try {
    const { id } = params
    const { action } = await req.json() // 'approve' | 'reject'
    const db = createServerClient()

    // ── キャンセル申請を取得 ──
    const { data: cancelReq, error: fetchErr } = await db
      .from('cancellation_requests')
      .select('*, reservations(*, plans(name, departure_dates(date)))')
      .eq('id', id)
      .single()

    if (fetchErr) {
      console.error('[cancel approve] 申請取得エラー:', fetchErr)
      return NextResponse.json(
        { error: '申請の取得に失敗しました: ' + fetchErr.message },
        { status: 500 }
      )
    }
    if (!cancelReq) {
      return NextResponse.json({ error: '申請が見つかりません。' }, { status: 404 })
    }

    // ネスト結果を防御的に取り出し（配列/オブジェクト両対応）
    const reservation = pickOne<any>(cancelReq.reservations)
    if (!reservation || !reservation.id) {
      console.error('[cancel approve] 予約データ取得失敗:', cancelReq)
      return NextResponse.json(
        { error: '予約データが取得できませんでした。' },
        { status: 500 }
      )
    }
    const plan = pickOne<any>(reservation.plans)
    const departureDate = pickOne<any>(plan?.departure_dates)
    const date = departureDate?.date
    const dateLabel = date ? formatDateJa(date) : ''

    const approved = action === 'approve'
    const newStatus = approved ? 'approved' : 'rejected'

    // ── キャンセル申請ステータスを更新 ──
    const { error: updReqErr } = await db
      .from('cancellation_requests')
      .update({ status: newStatus })
      .eq('id', id)
    if (updReqErr) {
      console.error('[cancel approve] 申請ステータス更新失敗:', updReqErr)
      return NextResponse.json(
        { error: '申請ステータス更新失敗: ' + updReqErr.message },
        { status: 500 }
      )
    }

    if (approved) {
      // ── 乗船者削除 ──
      const { error: delMemErr } = await db
        .from('members')
        .delete()
        .eq('reservation_id', reservation.id)
      if (delMemErr) {
        console.error('[cancel approve] 乗船者削除失敗:', delMemErr)
        return NextResponse.json(
          { error: '乗船者削除失敗: ' + delMemErr.message },
          { status: 500 }
        )
      }

      // ── 予約をキャンセル状態に変更 ──
      const { error: updResErr } = await db
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservation.id)
      if (updResErr) {
        console.error('[cancel approve] 予約ステータス更新失敗:', updResErr)
        return NextResponse.json(
          { error: '予約ステータス更新失敗: ' + updResErr.message },
          { status: 500 }
        )
      }

      // ── 同日の各プランを個別にチェックし、予約0のプランのみロック解除 ──
      const { data: cancelledPlan } = await db
        .from('plans')
        .select('departure_date_id')
        .eq('id', reservation.plan_id)
        .single()
      if (cancelledPlan) {
        const { data: allPlansOnDay } = await db
          .from('plans')
          .select('id')
          .eq('departure_date_id', cancelledPlan.departure_date_id)
        for (const p of allPlansOnDay || []) {
          const { data: planRes } = await db
            .from('reservations')
            .select('id')
            .eq('plan_id', p.id)
            .neq('status', 'cancelled')
          if (!planRes || planRes.length === 0) {
            const { error: unlockErr } = await db
              .from('plans')
              .update({ is_locked: false })
              .eq('id', p.id)
            if (unlockErr) {
              console.error('[cancel approve] プランロック解除失敗:', p.id, unlockErr)
            }
          }
        }
      }

      // ── LINE通知 ──
      let lineNotified = false
      let lineError = ''
      if (reservation.line_user_id) {
        try {
          await sendCancelResult(
            reservation.line_user_id,
            true,
            reservation.reservation_number,
            plan?.name || '',
            dateLabel
          )
          lineNotified = true
        } catch (e: any) {
          lineError = e?.message || 'LINE通知失敗'
          console.error('[cancel approve] LINE通知エラー:', lineError)
        }
      }

      // ── SMS通知（LINE未連携時のみ） ──
      let smsNotified = false
      let smsError = ''
      if (!reservation.line_user_id && reservation.representative_phone) {
        const body = `【${BOAT_NAME}】キャンセル承認しました\n№${reservation.reservation_number}\n${dateLabel}\nまたのご利用をお待ちしております`
        const r = await sendSms(reservation.representative_phone, body).catch(
          (e) => ({ ok: false, error: e?.message || String(e) })
        )
        if (r.ok) smsNotified = true
        else if (!(r as any).skipped) smsError = (r as any).error || 'SMS失敗'
      }

      logAdminAction(
        req,
        'approve_cancel',
        `申請ID: ${id} 予約番号: ${reservation.reservation_number || ''}`
      ).catch(() => {})

      return NextResponse.json({
        ok: true,
        lineNotified,
        smsNotified,
        ...(!reservation.line_user_id &&
          !smsNotified && {
            lineWarning:
              'LINE未連携・SMS未送信。お客様にお電話でご連絡ください。',
          }),
        ...(lineError && { lineError }),
        ...(smsError && { smsError }),
      })
    } else {
      // ── 却下 ──
      let lineNotified = false
      let lineError = ''
      if (reservation.line_user_id) {
        try {
          await sendCancelResult(
            reservation.line_user_id,
            false,
            reservation.reservation_number,
            plan?.name || '',
            dateLabel
          )
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
        const r = await sendSms(reservation.representative_phone, body).catch(
          (e) => ({ ok: false, error: e?.message || String(e) })
        )
        if (r.ok) smsNotified = true
        else if (!(r as any).skipped) smsError = (r as any).error || 'SMS失敗'
      }

      logAdminAction(
        req,
        'reject_cancel',
        `申請ID: ${id} 予約番号: ${reservation.reservation_number || ''}`
      ).catch(() => {})

      return NextResponse.json({
        ok: true,
        lineNotified,
        smsNotified,
        ...(!reservation.line_user_id &&
          !smsNotified && {
            lineWarning:
              'LINE未連携・SMS未送信。お客様にお電話でご連絡ください。',
          }),
        ...(lineError && { lineError }),
        ...(smsError && { smsError }),
      })
    }
  } catch (e: any) {
    console.error('[cancel approve] 予期しないエラー:', e)
    return NextResponse.json(
      { error: '予期しないエラー: ' + (e?.message || String(e)) },
      { status: 500 }
    )
  }
}
