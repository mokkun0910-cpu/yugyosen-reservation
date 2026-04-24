import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const adminPassword = process.env.ADMIN_PASSWORD || 'captain2024'
  if (password === adminPassword) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}
