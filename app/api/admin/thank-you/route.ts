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
    return NextResponse.json({ ok: true, notified: 0, debug: 'プランなし' })
  }

  const planIds = plans.map((p: any) => p.id)

  // その日のキャンセルされていない予約を全取得
  const { data: reservations, error: resError } = await db
    .from('reservations')
    .select('id, line_user_id, representative_name')
    .in('plan_id', planIds)
    .neq('status', 'cancelled')

  if (resError) {
    console.error('thank-you DB error:', resError)
    return NextResponse.json({ error: 'DB取得エラー: ' + resError.message }, { status: 500 })
  }

  if (!reservations || reservations.length === 0) {
    return NextResponse.json({ ok: true, notified: 0, debug: '予約なし' })
  }

  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!lineToken) {
    return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です。' }, { status: 500 })
  }

  const message = `昨日はご乗船いただきありがとうございました！🎣

【日程】${dateLabel}

楽しんでいただけましたでしょうか？
またのご乗船をお待ちしております。

釣果のお写真などインスタグラムでも紹介しておりますので、よろしければフォローください📸

またお会いできる日を楽しみにしています！
遊漁船 王丸`

  let notified = 0
  const errors: string[] = []

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
      if (res.ok) {
        notified++
      } else {
        const errText = await res.text()
        errors.push(`LINE API エラー (${res.status}): ${errText}`)
        console.error('LINE push error:', res.status, errText)
      }
    } catch (e: any) {
      errors.push(`送信例外: ${e?.message}`)
      console.error('LINE push exception:', e)
    }
  }

  return NextResponse.json({
    ok: true,
    notified,
    total: reservations.length,
    lineUsers: reservations.filter((r: any) => r.line_user_id).length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
