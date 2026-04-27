import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  try {
    const db = createServerClient()

    // Step1: まずすべての予約を取得（ステータスに関わらず件数確認用）
    const { data: allReservations, error: allError } = await db
      .from('reservations')
      .select('id, status')

    const totalInDB = allReservations?.length ?? 0
    const statusSummary = (allReservations || []).reduce((acc: any, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})

    // Step2: キャンセル以外の予約を取得
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

    // Step3: plan情報を個別に取得
    const planIds = [...new Set(reservations.map((r: any) => r.plan_id))]
    const { data: plans } = await db
      .from('plans')
      .select('id, name, departure_time, departure_date_id')
      .in('id', planIds)

    // Step4: departure_date情報を個別に取得
    const dateIds = [...new Set((plans || []).map((p: any) => p.departure_date_id))]
    const { data: dates } = await db
      .from('departure_dates')
      .select('id, date')
      .in('id', dateIds)

    // Step5: データを結合
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
