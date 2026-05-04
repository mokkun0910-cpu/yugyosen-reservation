import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limiter (resets per serverless instance; guards against basic brute force)
const attempts = new Map<string, { count: number; firstAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

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
    return NextResponse.json({ ok: true })
  }

  const current = attempts.get(ip)
  if (current && now - current.firstAt < WINDOW_MS) {
    current.count++
  } else {
    attempts.set(ip, { count: 1, firstAt: now })
  }

  return NextResponse.json({ ok: false }, { status: 401 })
}
