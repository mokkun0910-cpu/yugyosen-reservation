import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { formatDateJa, BOAT_NAME } from '@/lib/utils'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminLog'
import { sendSmsBatch } from '@/lib/sms'

/** LINE Push API に1件送信 */
async function pushLine(token: string, to: string, text: string): Promise<boolean> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  })
  return res.ok
}

export async function POST(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  try {
    const { dateId } = await req.json()
    if (!dateId) return NextResponse.json({ error: 'dateIdが必要です。' }, { status: 400 })

    const db = createServerClient()

    const { data: departureDate, error: dateError } = await db
      .from('departure_dates')
      .select('date')
      .eq('id', dateId)
      .single()

    if (dateError || !departureDate) {
      return NextResponse.json({ error: '出船日が見つかりません。' }, { status: 404 })
    }

    const dateLabel = formatDateJa(departureDate.date)

    const { data: plans, error: planError } = await db
      .from('plans')
      .select('id')
      .eq('departure_date_id', dateId)

    if (planError) {
      return NextResponse.json({ error: 'プラン取得エラー: ' + planError.message }, { status: 500 })
    }

    if (!plans || plans.length === 0) {
      await db.from('departure_dates').update({ is_open: false }).eq('id', dateId)
      return NextResponse.json({ ok: true, cancelled: 0, notified: 0, total: 0, lineUsers: 0, debug: 'プランなし' })
    }

    const planIds = (plans as any[]).map((p) => p.id)

    const { data: reservations, error: resError } = await db
      .from('reservations')
      .select('id, line_user_id, representative_name, representative_phone, reservation_number')
      .in('plan_id', planIds)
      .neq('status', 'cancelled')

    if (resError) {
      return NextResponse.json({ error: '予約取得エラー: ' + resError.message }, { status: 500 })
    }

    if (!reservations || reservations.length === 0) {
      await db.from('departure_dates').update({ is_open: false }).eq('id', dateId)
      return NextResponse.json({ ok: true, cancelled: 0, notified: 0, total: 0, lineUsers: 0, debug: '予約なし' })
    }

    const reservationIds = (reservations as any[]).map((r) => r.id)

    // ★ members 削除前に同行者のLINE IDを収集
    const { data: companionMembers } = await db
      .from('members')
      .select('line_user_id')
      .in('reservation_id', reservationIds)
      .not('line_user_id', 'is', null)

    // 通知対象LINE IDを重複なしで収集（代表者 + 同行者）
    const repLineIds = new Set(
      (reservations as any[]).map((r) => r.line_user_id).filter(Boolean)
    )
    const allLineIds = new Set<string>(repLineIds)
    for (const m of companionMembers || []) {
      if (m.line_user_id) allLineIds.add(m.line_user_id)
    }

    // 乗船者レコードを削除（アドレス帳の乗船履歴に残さないようにする）
    await db.from('members').delete().in('reservation_id', reservationIds)
    await db.from('reservations').update({ status: 'cancelled' }).in('id', reservationIds)
    // BUG修正: 天候中止対象に未処理のキャンセル申請が残っていると、ダッシュボードに
    // 「未処理キャンセル」が消えずに残るため、ここで承認済みに変更する。
    await db.from('cancellation_requests')
      .update({ status: 'approved' })
      .in('reservation_id', reservationIds)
      .eq('status', 'pending')
    await db.from('departure_dates').update({ is_open: false }).eq('id', dateId)
    // プランのロックを全解除
    await db.from('plans').update({ is_locked: false }).in('id', planIds)

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!lineToken) {
      return NextResponse.json({
        ok: true,
        cancelled: (reservations as any[]).length,
        notified: 0,
        error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定のため通知できませんでした。',
      })
    }

    const message = `⚠️ 出船中止のお知らせ

【日程】${dateLabel}
【理由】天候不良のため

誠に申し訳ございませんが、当日の出船を中止とさせていただきます。

またのご予約をお待ちしております。
🎣 ${BOAT_NAME}`

    let notified = 0
    const errors: string[] = []

    const userIdArray = Array.from(allLineIds)
    const sendResults = await Promise.allSettled(
      userIdArray.map((userId) => pushLine(lineToken, userId, message))
    )
    for (let i = 0; i < sendResults.length; i++) {
      const result = sendResults[i]
      if (result.status === 'fulfilled') {
        if (result.value) notified++
        else errors.push(`送信失敗(${userIdArray[i].slice(0, 8)}…)`)
      } else {
        errors.push(`送信例外: ${(result as PromiseRejectedResult).reason?.message}`)
      }
    }

    // 送信日時を記録
    await db.from('departure_dates').update({ weather_notified_at: new Date().toISOString() }).eq('id', dateId)
    logAdminAction(req, 'weather_cancel', `日程ID: ${dateId} (${dateLabel}) キャンセル数: ${(reservations as any[]).length} LINE通知: ${notified}`).catch(() => {})

    // ─── SMS通知: LINE未連携の代表者へ ───
    const smsBody = `【${BOAT_NAME}】天候不良のため${dateLabel}は出船中止です。\nまたのご予約をお待ちしております。\n☎0940-62-1221`
    const nonLineReservations = (reservations as any[]).filter((r) => !r.line_user_id)
    const smsTargets = nonLineReservations.filter((r) => r.representative_phone)
    const smsResult = await sendSmsBatch(
      smsTargets.map((r) => ({ to: r.representative_phone, body: smsBody }))
    )

    // ─── 通知が一切届かなかったお客様（要電話リスト） ───
    // LINE未連携で、かつSMSが成功しなかった人をすべてリストアップ
    const successPhones = new Set(
      smsResult.items.filter((it) => it.ok).map((it) => it.to)
    )
    const unnotifiedCustomers: Array<{
      reservationNumber: string
      name: string
      phone: string
    }> = nonLineReservations
      .filter((r) => !successPhones.has(r.representative_phone))
      .map((r) => ({
        reservationNumber: r.reservation_number,
        name: r.representative_name,
        phone: r.representative_phone || '(電話番号なし)',
      }))

    return NextResponse.json({
      ok: true,
      cancelled: (reservations as any[]).length,
      notified,
      lineUsers: allLineIds.size,
      smsNotified: smsResult.sent,
      smsFailed: smsResult.failed,
      smsSkipped: smsResult.skipped, // Twilio未設定時の件数
      unnotifiedCustomers, // LINE未連携かつSMSも送れなかった人（要電話）
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e: any) {
    console.error('weather-cancel unexpected error:', e)
    return NextResponse.json({ error: '予期しないエラー: ' + (e?.message || String(e)) }, { status: 500 })
  }
}
