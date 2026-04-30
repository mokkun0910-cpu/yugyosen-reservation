import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

// プランを追加
export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { departure_date_id, name, target_fish, departure_time, price, capacity } = body
  if (!departure_date_id || !name || !target_fish || !departure_time || price === undefined || !capacity) {
    return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 })
  }

  const db = createServerClient()

  // 同日のプラン数チェック
  const { data: existing } = await db.from('plans').select('id').eq('departure_date_id', departure_date_id)
  if ((existing || []).length >= 5) {
    return NextResponse.json({ error: '1日に設定できるプランは最大5つです。' }, { status: 400 })
  }

  const { data, error } = await db.from('plans').insert({
    departure_date_id,
    name,
    target_fish,
    departure_time,
    price: Number(price),
    capacity: Number(capacity),
    is_locked: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// プランを削除
export async function DELETE(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'idが必要です。' }, { status: 400 })

  const db = createServerClient()

  // 予約があれば削除不可
  const { data: reservations } = await db
    .from('reservations')
    .select('id')
    .eq('plan_id', id)
    .neq('status', 'cancelled')
  if (reservations && reservations.length > 0) {
    return NextResponse.json(
      { error: `このプランには予約が${reservations.length}件あるため削除できません。` },
      { status: 400 }
    )
  }

  const { error } = await db.from('plans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ロック解除
export async function PATCH(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { departure_date_id } = await req.json()
  if (!departure_date_id) return NextResponse.json({ error: 'departure_date_idが必要です。' }, { status: 400 })

  const db = createServerClient()
  const { error } = await db.from('plans').update({ is_locked: false }).eq('departure_date_id', departure_date_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
