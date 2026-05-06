import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const db = createServerClient()

  const { data: dates, error } = await db
    .from('departure_dates')
    .select('id, date')
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!dates || dates.length === 0) return NextResponse.json({ years: [] })

  // プランをprice込みで取得
  const { data: plans } = await db
    .from('plans')
    .select('id, departure_date_id, price')

  const planMap: Record<string, number> = {}
  for (const p of plans || []) {
    planMap[p.id] = p.price || 0
  }

  // 予約を取得（キャンセル以外）
  const { data: reservations } = await db
    .from('reservations')
    .select('id, plan_id, total_members')
    .neq('status', 'cancelled')

  // 月ごとに集計
  const monthMap: Record<string, {
    year: number
    month: number
    label: string
    departureDays: number
    reservationCount: number
    totalMembers: number
    totalRevenue: number
    dateIds: string[]
  }> = {}

  for (const d of dates) {
    const ym = d.date.slice(0, 7)
    const [y, m] = ym.split('-').map(Number)
    if (!monthMap[ym]) {
      monthMap[ym] = {
        year: y, month: m, label: `${y}年${m}月`,
        departureDays: 0, reservationCount: 0,
        totalMembers: 0, totalRevenue: 0, dateIds: [],
      }
    }
    monthMap[ym].departureDays++
    monthMap[ym].dateIds.push(d.id)

    const planIds = (plans || []).filter(p => p.departure_date_id === d.id).map(p => p.id)
    const dayRes = (reservations || []).filter(r => planIds.includes(r.plan_id))
    monthMap[ym].reservationCount += dayRes.length
    monthMap[ym].totalMembers += dayRes.reduce((s, r) => s + (r.total_members || 0), 0)
    monthMap[ym].totalRevenue += dayRes.reduce((s, r) =>
      s + (r.total_members || 0) * (planMap[r.plan_id] || 0), 0
    )
  }

  const months = Object.values(monthMap).sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.month - a.month
  )

  const yearMap: Record<number, {
    year: number
    departureDays: number
    reservationCount: number
    totalMembers: number
    totalRevenue: number
    months: typeof months
  }> = {}

  for (const m of months) {
    if (!yearMap[m.year]) {
      yearMap[m.year] = {
        year: m.year, departureDays: 0,
        reservationCount: 0, totalMembers: 0, totalRevenue: 0, months: [],
      }
    }
    yearMap[m.year].departureDays += m.departureDays
    yearMap[m.year].reservationCount += m.reservationCount
    yearMap[m.year].totalMembers += m.totalMembers
    yearMap[m.year].totalRevenue += m.totalRevenue
    yearMap[m.year].months.push(m)
  }

  const years = Object.values(yearMap).sort((a, b) => b.year - a.year)
  return NextResponse.json({ years }, { headers: { 'Cache-Control': 'no-store' } })
}
