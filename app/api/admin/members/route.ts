import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const reservationId = searchParams.get('reservationId')

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationIdが必要です。' }, { status: 400 })
    }

    const db = createServerClient()

    const { data: members, error } = await db
      .from('members')
      .select('*')
      .eq('reservation_id', reservationId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ members: members || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
