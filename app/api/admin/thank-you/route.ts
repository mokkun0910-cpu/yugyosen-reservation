import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const { dateId } = await req.json()
  if (!dateId) return NextResponse.json({ error: 'dateIdが必要です。' }, { status: 400 })

  const db = createServerClient()

  // 出船日情報を取得
  const { data: departureDate } = await db
    .from('departure_dates')
    .select('date')
    .eq('id', dateId)
    .single()

  if (!departureDate) return NextResponse.json({ error: '出船日が見つかりません。' }, { status: 404 })

  const dateLabel = formatDateJa(departureDate.date)

  // その日のプランIDを取得
  const { data: plans } = await db
    .from('plans')
    .select('id')
    .eq('departure_date_id', dateId)

  if (!plans || plans.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 })
  }

  const planIds = plans.map((p) => p.id)

  // その日のキャンセルされていない予約を全取得
  const { data: reservations } = await db
    .from('reservations')
    .select('id, line_user_id, representative_name')
    .in('plan_id', planIds)
    .neq('status', 'cancelled')

  if (!reservations || reservations.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 })
  }

  // LINE通知を送信（LINE IDを持つ代表者のみ）
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  let notified = 0

  if (lineToken) {
    const message = `昨日はご乗船いただきありがとうございました！🎣

【日程】${dateLabel}

楽しんでいただけましたでしょうか？
またのご乗船をお待ちしております。

釣果のお写真などインスタグラムでも紹介しておりますので、よろしければフォローください📸
https://www.instagram.com/takayoshi.ryokan/

またお会いできる日を楽しみにしています！
遊漁船 王丸`

    for (const r of reservations) {
      if (!r.line_user_id) continue
      try {
        const res = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lineToken}`,
          },
          body: JSON.stringify({
            to: r.line_user_id,
            messages: [{ type: 'text', text: message }],
          }),
        })
        if (res.ok) notified++
      } catch {
        // 通知失敗は無視して続行
      }
    }
  }

  return NextResponse.json({ ok: true, notified })
}
