import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

export async function POST(req: NextRequest) {
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
      .select('id, line_user_id')
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
    await db.from('reservations').update({ status: 'cancelled' }).in('id', reservationIds)
    await db.from('departure_dates').update({ is_open: false }).eq('id', dateId)

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

もし、ご同行者様がいらっしゃいましたら、お手数ですがそちらの方へも共有いただけますと幸いです。

またのご予約をお待ちしております。
🎣 遊漁船 王丸`

    const lineUserCount = (reservations as any[]).filter((r: any) => r.line_user_id).length
    let notified = 0
    const errors: string[] = []

    for (const r of reservations as any[]) {
      if (!r.line_user_id) continue
      try {
        const res = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` },
          body: JSON.stringify({ to: r.line_user_id, messages: [{ type: 'text', text: message }] }),
        })
        if (res.ok) {
          notified++
        } else {
          const errText = await res.text()
          errors.push(`LINE APIエラー(${res.status}): ${errText}`)
        }
      } catch (e: any) {
        errors.push(`送信失敗: ${e?.message}`)
      }
    }

    return NextResponse.json({
      ok: true,
      cancelled: (reservations as any[]).length,
      notified,
      lineUsers: lineUserCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e: any) {
    console.error('weather-cancel unexpected error:', e)
    return NextResponse.json({ error: '予期しないエラー: ' + (e?.message || String(e)) }, { status: 500 })
  }
}
