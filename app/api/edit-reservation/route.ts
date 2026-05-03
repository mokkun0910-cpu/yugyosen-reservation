import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// 予約番号+電話番号で照合して予約情報を返す
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const number = searchParams.get('number')
  const phone = searchParams.get('phone')

  if (!number || !phone) {
    return NextResponse.json({ error: '予約番号と電話番号が必要です。' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: reservation } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id')
    .eq('reservation_number', number)
    .eq('representative_phone', phone)
    .neq('status', 'cancelled')
    .single()

  if (!reservation) {
    return NextResponse.json(
      { error: '予約が見つかりません。予約番号と電話番号をご確認ください。' },
      { status: 404 }
    )
  }

  // プラン・日付情報を取得
  const { data: plan } = await db
    .from('plans')
    .select('id, name, departure_time, departure_dates(date)')
    .eq('id', reservation.plan_id)
    .single()

  return NextResponse.json({
    reservation: {
      ...reservation,
      planName: plan?.name || '',
      departureTime: plan?.departure_time?.slice(0, 5) || '',
      date: (plan?.departure_dates as any)?.date || '',
    }
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// 電話番号を変更する
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { reservationId, phone, newPhone } = body

  if (!reservationId || !phone || !newPhone) {
    return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 })
  }

  const db = createServerClient()

  // 本人確認（現在の電話番号で照合）
  const { data: reservation } = await db
    .from('reservations')
    .select('id, representative_phone')
    .eq('id', reservationId)
    .eq('representative_phone', phone)
    .neq('status', 'cancelled')
    .single()

  if (!reservation) {
    return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
  }

  // 電話番号を更新
  const { error } = await db
    .from('reservations')
    .update({ representative_phone: newPhone })
    .eq('id', reservationId)

  if (error) {
    return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
