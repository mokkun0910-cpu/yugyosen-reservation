import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { BOAT_NAME } from '@/lib/utils'

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return false
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64')
  return hash === signature
}

export async function POST(req: NextRequest) {
  if (!process.env.LINE_CHANNEL_SECRET) {
    console.error('LINE_CHANNEL_SECRET が未設定です')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

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
        ? `おかえりなさい！⚓️\n高嘉丸の公式LINEを再度追加していただき、ありがとうございます！\nまた皆様と海に出られることを、船長一同楽しみにお待しております。\n\n「最近、何が釣れてる？」\n「今の時期の狙い目は？」\n気になる最近の釣果情報は、下のメニューの【釣果情報】からチェックしてみてくださいね！🐟\n\nご予約は【オンライン予約】からいつでも可能です📅\nお問い合わせも、このトーク画面からお気軽にどうぞ！\n\n今シーズンも熱い釣りを楽しみましょう！🎣`
        : `友だち追加ありがとうございます！⚓️\n「高嘉丸」です。\n\n玄界灘の豊かな海で、思い出に残る一匹を釣り上げるお手伝いをさせていただきます！🐟\n\n【ご利用ガイド】\n下のリッチメニューから操作できます！\n① オンライン予約\n　２４時間オンラインで予約を受け付けいています。\n　予約の変更もこちらからできます。\n②予約確認・キャンセル\n　予約の確認・キャンセルはこちらからできます。\n　電話番号からの検索になります。\n③最新の釣果\n　Instagramにつながります。\n④天気予報\n　最新の天気・風・波の情報です。\n⑤スタンプカード\n　スタンプが貯まるとお得情報GET！\n③ お問い合わせ\n　電話での問い合わせはこちらからできます。\n\n一番下のメニュー/直接チャットで、チャットでの問い合わせやリッチメニューの表示ができます。\n\n船長：王丸`

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
