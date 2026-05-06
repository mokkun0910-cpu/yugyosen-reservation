import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const COOKIE_NAME = 'admin_token'
const TOKEN_EXPIRES_SEC = 24 * 60 * 60 // 24時間

function getSecret(): string {
  return process.env.ADMIN_PASSWORD || 'change-me-fallback'
}

/** HS256 JWT を生成（jose 不要・Node.js crypto のみ使用） */
export function createAdminToken(): string {
  const secret = getSecret()
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRES_SEC,
  })).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

/** JWT を検証（改ざん・期限切れチェック） */
function verifyToken(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [header, body, sig] = parts
    const secret = getSecret()
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return false
    return true
  } catch {
    return false
  }
}

/** ログイン成功後にレスポンスへ httpOnly Cookie をセット */
export function setAdminCookie(res: NextResponse): void {
  const token = createAdminToken()
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRES_SEC,
    path: '/',
  })
}

/** ログアウト時に Cookie を削除 */
export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
}

/**
 * 管理者API認証チェック（非同期）
 * 優先順位: httpOnly Cookie(JWT) > x-admin-password ヘッダー（後方互換/curl用）
 * 認証OK → null / 失敗 → 401 レスポンス
 */
export async function checkAdminAuth(req: NextRequest): Promise<NextResponse | null> {
  // ① Cookie 認証（本番ブラウザ）
  const cookie = req.cookies.get(COOKIE_NAME)
  if (cookie?.value && verifyToken(cookie.value)) {
    return null
  }

  // ② ヘッダー認証（curl / テスト / 後方互換）
  const headerPw = req.headers.get('x-admin-password')
  const adminPassword = process.env.ADMIN_PASSWORD
  if (adminPassword && headerPw && headerPw === adminPassword) {
    return null
  }

  return NextResponse.json({ error: '認証が必要です。' }, { status: 401 })
}
