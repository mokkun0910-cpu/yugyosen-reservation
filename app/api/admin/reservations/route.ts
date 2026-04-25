import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
    try {
          const db = createServerClient()

      const { data: reservations, error } = await db
            .from('reservations')
            .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id, created_at')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false })

      if (error) {
              return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
      }

      const planIds = Array.from(new Set((reservations || []).map((r: any) => r.plan_id).filter(Boolean)))

      if (planIds.length === 0) {
              return NextResponse.json({ reservations: [] }, { headers: { 'Cache-Control': 'no-store' } })
      }

      const { data: plans } = await db
            .from('plans')
            .select('id, name, departure_time, departure_date_id')
            .in('id', planIds)

      const dateIds = Array.from(new Set((plans || []).map((p: any) => p.departure_date_id).filter(Boolean)))

      const { data: dates } = await db
            .from('departure_dates')
            .select('id, date')
            .in('id', dateIds)

      const enriched = (reservations || []).map((r: any) => {
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

      return NextResponse.json({ reservations: enriched }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (e: any) {
          return NextResponse.json({ error: e?.message || String(e) }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
}
