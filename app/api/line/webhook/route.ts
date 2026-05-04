import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { BOAT_NAME } from '@/lib/utils'

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET || ''
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64')
  return hash === signature
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') || ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const events = body.events || []

  for (const event of events) {
    // followイベント：新規登録 or ブロック解除
    if (event.type === 'follow') {
      const userId = event.source?.userId
      if (!userId) continue

      // 予約履歴があればブロック解除、なければ新規登録と判定
      const db = createServerClient()
      const { data: existing } = await db
        .from('reservations')
        .select('id')
        .eq('line_user_id', userId)
        .limit(1)
        .maybeSingle()

      const isReturning = !!existing

      const text = isReturning
        ? `おかえりなさい！🎣\n\nまたのご利用をお待ちしておりました。\nご予約・キャンセルはリッチメニューからどうぞ。\n\n${BOAT_NAME}`
        : `${BOAT_NAME}へのご登録ありがとうございます！🎣\n\nオンライン予約・キャンセルのご案内はリッチメニューからどうぞ。\n\n出航情報などもLINEにてお届けします。よろしくお願いします！\n\n${BOAT_NAME}`

      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text }],
        }),
      })
    }
  }

  return NextResponse.json({ status: 'ok' })
}
