import { NextRequest, NextResponse } from 'next/server'
import { setAdminCookie, clearAdminCookie, checkAdminAuth } from '@/lib/adminAuth'
import { logAdminAction } from '@/lib/adminLog'

// In-memory rate limiter（インスタンス内のブルートフォース対策 + 定期クリーンアップ）
const attempts = new Map<string, { count: number; firstAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000 // 15分

// メモリリーク対策: 1時間ごとに期限切れエントリを削除
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of attempts.entries()) {
    if (now - entry.firstAt >= WINDOW_MS) {
      attempts.delete(ip)
    }
  }
}, 60 * 60 * 1000)

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/** Cookie の有効性を確認（認証済みチェック用） */
export async function GET(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true })
}

/** ログイン: パスワード検証 → httpOnly JWT Cookie を発行 */
export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const now = Date.now()

  const entry = attempts.get(ip)
  if (entry) {
    if (now - entry.firstAt < WINDOW_MS) {
      if (entry.count >= MAX_ATTEMPTS) {
        return NextResponse.json(
          { ok: false, error: 'しばらく時間を置いてから再試行してください。' },
          { status: 429 }
        )
      }
    } else {
      attempts.delete(ip)
    }
  }

  const body = await req.json()
  const { password } = body
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ ok: false, error: 'サーバー設定エラー' }, { status: 500 })
  }

  if (password === adminPassword) {
    attempts.delete(ip)
    const res = NextResponse.json({ ok: true })
    setAdminCookie(res)
    logAdminAction(req, 'login', `IP: ${ip}`).catch(() => {})
    return res
  }

  // 失敗カウント更新
  const cur = attempts.get(ip)
  if (cur && now - cur.firstAt < WINDOW_MS) {
    cur.count++
  } else {
    attempts.set(ip, { count: 1, firstAt: now })
  }

  return NextResponse.json({ ok: false }, { status: 401 })
}

/** ログアウト: Cookie を削除 */
export async function DELETE(req: NextRequest) {
  logAdminAction(req, 'logout').catch(() => {})
  const res = NextResponse.json({ ok: true })
  clearAdminCookie(res)
  return res
}
