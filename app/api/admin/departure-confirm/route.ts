import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { formatDateJa, BOAT_NAME } from '@/lib/utils'
import { checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminLog'

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
      .select('id, departure_time')
      .eq('departure_date_id', dateId)

    if (planError) {
      return NextResponse.json({ error: 'プラン取得エラー: ' + planError.message }, { status: 500 })
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json({ ok: true, notified: 0, total: 0, lineUsers: 0, debug: 'プランなし' })
    }

    const planIds = (plans as any[]).map((p) => p.id)

    const { data: reservations, error: resError } = await db
      .from('reservations')
      .select('id, line_user_id, plan_id')
      .in('plan_id', planIds)
      .neq('status', 'cancelled')

    if (resError) {
      return NextResponse.json({ error: '予約取得エラー: ' + resError.message }, { status: 500 })
    }

    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ ok: true, notified: 0, total: 0, lineUsers: 0, debug: '予約なし' })
    }

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!lineToken) {
      return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です。Vercelの環境変数を確認してください。' }, { status: 500 })
    }

    // 同行者のLINE IDを取得
    const reservationIds = (reservations as any[]).map((r) => r.id)
    const { data: companionMembers } = await db
      .from('members')
      .select('line_user_id, reservation_id')
      .in('reservation_id', reservationIds)
      .not('line_user_id', 'is', null)

    // 代表者のLINE IDセット（重複通知防止）
    const repLineIds = new Set(
      (reservations as any[]).map((r) => r.line_user_id).filter(Boolean)
    )

    // 代表者 + 同行者の全LINE IDを重複なしで収集
    const allTargets: { userId: string; planId?: string }[] = []
    for (const r of reservations as any[]) {
      if (r.line_user_id) allTargets.push({ userId: r.line_user_id, planId: r.plan_id })
    }
    for (const m of companionMembers || []) {
      if (m.line_user_id && !repLineIds.has(m.line_user_id)) {
        const res = (reservations as any[]).find((r) => r.id === m.reservation_id)
        allTargets.push({ userId: m.line_user_id, planId: res?.plan_id })
      }
    }

    const lineUserCount = allTargets.length
    let notified = 0
    const errors: string[] = []

    for (const target of allTargets) {
      const plan = (plans as any[]).find((p) => p.id === target.planId)
      const departureTime = plan?.departure_time?.slice(0, 5) || ''

      const message = `⚓ 出航決定のお知らせ

【日程】${dateLabel}
【出船時刻】${departureTime}

明日の出航が決定いたしました。
ご予約いただきありがとうございます。

当日皆様のご乗船をお待ちしております。
🎣 ${BOAT_NAME}`

      try {
        const ok = await pushLine(lineToken, target.userId, message)
        if (ok) notified++
        else errors.push(`送信失敗(${target.userId.slice(0, 8)}…)`)
      } catch (e: any) {
        errors.push(`送信例外: ${e?.message}`)
      }
    }

    // 送信日時を記録
    await db.from('departure_dates').update({ departure_notified_at: new Date().toISOString() }).eq('id', dateId)
    logAdminAction(req, 'departure_confirm', `日程ID: ${dateId} 通知数: ${notified}(代表${repLineIds.size}+同行者${lineUserCount - repLineIds.size})`).catch(() => {})

    return NextResponse.json({
      ok: true,
      notified,
      total: (reservations as any[]).length,
      lineUsers: lineUserCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e: any) {
    console.error('departure-confirm unexpected error:', e)
    return NextResponse.json({ error: '予期しないエラー: ' + (e?.message || String(e)) }, { status: 500 })
  }
}
