import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// 電話番号で予約を検索して返す
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')

  if (!phone) {
    return NextResponse.json({ error: '電話番号が必要です。' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: reservations } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id')
    .eq('representative_phone', phone)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (!reservations || reservations.length === 0) {
    return NextResponse.json(
      { error: 'この電話番号の予約が見つかりません。' },
      { status: 404 }
    )
  }

  // プラン・日付情報を付加
  const enriched = await Promise.all(reservations.map(async (r) => {
    const { data: plan } = await db
      .from('plans')
      .select('id, name, departure_time, departure_dates(date)')
      .eq('id', r.plan_id)
      .single()
    return {
      ...r,
      planName: plan?.name || '',
      departureTime: plan?.departure_time?.slice(0, 5) || '',
      date: (plan?.departure_dates as any)?.date || '',
    }
  }))

  return NextResponse.json(
    { reservations: enriched },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// 電話番号を変更する
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { phone, newPhone } = body

  if (!phone || !newPhone) {
    return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 })
  }

  const db = createServerClient()

  // 現在の電話番号に紐づく有効な予約を確認
  const { data: reservations } = await db
    .from('reservations')
    .select('id')
    .eq('representative_phone', phone)
    .neq('status', 'cancelled')

  if (!reservations || reservations.length === 0) {
    return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
  }

  // 該当する全予約の電話番号を更新
  const { error } = await db
    .from('reservations')
    .update({ representative_phone: newPhone })
    .eq('representative_phone', phone)
    .neq('status', 'cancelled')

  if (error) {
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
