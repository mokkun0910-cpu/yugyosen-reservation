import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  try {
    const db = createServerClient()

    // Step1: ã¾ããã¹ã¦ã®äºç´ãåå¾ï¼ã¹ãã¼ã¿ã¹ã«é¢ãããä»¶æ°ç¢ºèªç¨ï¼
    const { data: allReservations, error: allError } = await db
      .from('reservations')
      .select('id, status')

    const totalInDB = allReservations?.length ?? 0
    const statusSummary = (allReservations || []).reduce((acc: any, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})

    // Step2: ã­ã£ã³ã»ã«ä»¥å¤ã®äºç´ãåå¾
    const { data: reservations, error } = await db
      .from('reservations')
      .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id, created_at')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message, totalInDB, statusSummary },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (!reservations || reservations.length === 0) {
      return NextResponse.json(
        { reservations: [], totalInDB, statusSummary },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // Step3: planæå ±ãåå¥ã«åå¾
    const planIds = Array.from(new Set(reservations.map((r: any) => r.plan_id)))
    const { data: plans } = await db
      .from('plans')
      .select('id, name, departure_time, departure_date_id')
      .in('id', planIds)

    // Step4: departure_dateæå ±ãåå¥ã«åå¾
    const dateIds = Array.from(new Set((plans || []).map((p: any) => p.departure_date_id)))
    const { data: dates } = await db
      .from('departure_dates')
      .select('id, date')
      .in('id', dateIds)

    // Step5: ãã¼ã¿ãçµå
    const enriched = reservations.map((r: any) => {
      const plan = (plans || []).find((p: any) => p.id === r.plan_id)
      const date = plan ? (dates || []).find((d: any) => d.id === plan.departure_date_id) : null
      return {
        ...r,
        plans: plan ? {
          name: plan.name,
          departure_time: plan.departure_time,
          departure_dates: date ? { date: date.date } : null,
        } : null,
      }
    })

    return NextResponse.json(
      { reservations: enriched, totalInDB, statusSummary },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
