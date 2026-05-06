import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const db = createServerClient()

  const { data, error } = await db
    .from('cancellation_requests')
    .select('*, reservations(*, plans(name, departure_dates(date)))')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    { requests: data || [] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
