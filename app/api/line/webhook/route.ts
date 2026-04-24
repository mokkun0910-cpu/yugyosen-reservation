import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

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
    // followイベント：ユーザーが友だち追加したときにLINE User IDを返信
    if (event.type === 'follow') {
      const userId = event.source?.userId
      if (userId) {
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text: `友だち追加ありがとうございます！🎣\n\nあなたのLINE User IDは以下の通りです。\n\n${userId}\n\n予約フォームの「LINE ユーザーID」欄にこのIDを入力すると、予約通知がLINEで届きます。`,
              },
            ],
          }),
        })
      }
    }

    // messageイベント：ユーザーがメッセージを送ってきたときにIDを返す
    if (event.type === 'message' && event.message?.type === 'text') {
      const userId = event.source?.userId
      const text: string = event.message.text || ''

      if (text.includes('ID') || text.includes('id') || text.includes('ＩＤ')) {
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text: `あなたのLINE User IDは以下の通りです。\n\n${userId}\n\n予約フォームの「LINE ユーザーID」欄にこのIDを入力してください。`,
              },
            ],
          }),
        })
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}
