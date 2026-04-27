import { NextRequest, NextResponse } from 'next/server'

/**
 * 管理者API認証チェック
 * リクエストヘッダー x-admin-password が正しい場合は null を返す。
 * 認証失敗時は 401 レスポンスを返す。
 */
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const password = req.headers.get('x-admin-password')
  const adminPassword = process.env.ADMIN_PASSWORD || 'captain2024'
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 })
  }
  return null
}
