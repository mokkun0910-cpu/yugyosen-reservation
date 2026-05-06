import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

// プランを追加
export async function POST(req: NextRequest) {
  const authError = await checkAdminAuth(req)
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
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'idが必要です。' }, { status: 400 })

  const db = createServerClient()

  // 有効な予約（キャンセル以外）があれば削除不可
  const { data: activeReservations } = await db
    .from('reservations')
    .select('id')
    .eq('plan_id', id)
    .neq('status', 'cancelled')
  if (activeReservations && activeReservations.length > 0) {
    return NextResponse.json(
      { error: `このプランには有効な予約が${activeReservations.length}件あるため削除できません。先にキャンセル処理を行ってください。` },
      { status: 400 }
    )
  }

  // キャンセル済み予約の関連データを先に全て削除（外部キー制約対策）
  const { data: cancelledReservations } = await db
    .from('reservations')
    .select('id')
    .eq('plan_id', id)
    .eq('status', 'cancelled')
  if (cancelledReservations && cancelledReservations.length > 0) {
    const ids = cancelledReservations.map((r: any) => r.id)
    await db.from('members').delete().in('reservation_id', ids)
    await db.from('cancellation_requests').delete().in('reservation_id', ids)
    await db.from('reservations').delete().in('id', ids)
  }

  const { error } = await db.from('plans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// プラン編集（定員・料金・名前など）
export async function PUT(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { id, capacity, price, name, target_fish } = body
  if (!id) return NextResponse.json({ error: 'idが必要です。' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (capacity !== undefined) {
    const cap = Number(capacity)
    if (!Number.isInteger(cap) || cap < 1 || cap > 100) {
      return NextResponse.json({ error: '定員は1〜100の整数で入力してください。' }, { status: 400 })
    }
    updates.capacity = cap
  }
  if (price !== undefined) {
    const p = Number(price)
    if (isNaN(p) || p < 0) {
      return NextResponse.json({ error: '料金が不正です。' }, { status: 400 })
    }
    updates.price = p
  }
  if (name !== undefined) updates.name = String(name).trim()
  if (target_fish !== undefined) updates.target_fish = String(target_fish).trim()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '更新する項目がありません。' }, { status: 400 })
  }

  const db = createServerClient()

  // 定員を下げる場合、既存予約人数を超えないかチェック
  if (updates.capacity !== undefined) {
    const { data: existingRes } = await db
      .from('reservations')
      .select('total_members')
      .eq('plan_id', id)
      .neq('status', 'cancelled')
    const currentBooked = (existingRes || []).reduce((sum: number, r: any) => sum + r.total_members, 0)
    if (updates.capacity < currentBooked) {
      return NextResponse.json(
        { error: `既に${currentBooked}名が予約済みのため、定員を${currentBooked}名未満に設定できません。` },
        { status: 400 }
      )
    }
  }

  const { error } = await db.from('plans').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ロック解除
export async function PATCH(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const { departure_date_id } = await req.json()
  if (!departure_date_id) return NextResponse.json({ error: 'departure_date_idが必要です。' }, { status: 400 })

  const db = createServerClient()
  const { error } = await db.from('plans').update({ is_locked: false }).eq('departure_date_id', departure_date_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
