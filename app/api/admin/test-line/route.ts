import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const captainLineUserId = process.env.CAPTAIN_LINE_USER_ID
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN

  // 環境変数チェック
  if (!captainLineUserId || captainLineUserId.trim() === '') {
    return NextResponse.json({
      ok: false,
      step: 'env_check',
      error: 'CAPTAIN_LINE_USER_ID が Vercel 環境変数に設定されていません。',
      fix: 'Vercel → Settings → Environment Variables に CAPTAIN_LINE_USER_ID を追加してください。',
    })
  }

  if (!lineToken || lineToken.trim() === '') {
    return NextResponse.json({
      ok: false,
      step: 'env_check',
      error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です。',
    })
  }

  // LINE Push API で船長にテストメッセージ送信
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${lineToken}`,
    },
    body: JSON.stringify({
      to: captainLineUserId,
      messages: [{ type: 'text', text: '✅ テスト送信です。\n管理者通知が正常に届いています。' }],
    }),
  })

  const responseText = await res.text()

  if (res.ok) {
    return NextResponse.json({
      ok: true,
      message: '船長へのLINE送信に成功しました ✅',
      captainIdMasked: captainLineUserId.slice(0, 8) + '…',
    })
  }

  // エラーの場合、LINEのエラーコードで原因を特定
  let cause = '不明なエラー'
  let fix = ''
  try {
    const lineErr = JSON.parse(responseText)
    if (lineErr.message?.includes('The user has not blocked') === false && res.status === 400) {
      cause = '船長がこのLINE公式アカウントを友だち追加していません。'
      fix = '船長のスマホで @993hvuum を友だち追加してください。追加後、「ID確認」と送信してユーザーIDを取得してください。'
    } else if (res.status === 401) {
      cause = 'LINE_CHANNEL_ACCESS_TOKEN が無効または期限切れです。'
      fix = 'LINE Developers でチャンネルアクセストークンを再発行し、Vercel の環境変数を更新してください。'
    } else if (res.status === 400) {
      cause = `CAPTAIN_LINE_USER_ID の形式が正しくないか、対象のユーザーがアカウントをブロックしています。`
      fix = '船長に友だち追加を依頼し、「ID確認」と送信してもらって正しいIDを取得してください。'
    }
  } catch {
    // JSON解析失敗
  }

  return NextResponse.json({
    ok: false,
    step: 'line_push',
    httpStatus: res.status,
    lineApiResponse: responseText,
    cause,
    fix,
    captainIdMasked: captainLineUserId.slice(0, 8) + '…',
  })
}
