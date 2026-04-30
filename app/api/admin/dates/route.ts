import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

// 出船日を追加
export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { date } = await req.json()
  if (!date) return NextResponse.json({ error: '日付が必要です。' }, { status: 400 })

  const db = createServerClient()
  const { data, error } = await db
    .from('departure_dates')
    .insert({ date, is_open: true })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// 公開/非公開を切り替え
export async function PATCH(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { id, is_open } = await req.json()
  if (!id || is_open === undefined) return NextResponse.json({ error: 'idとis_openが必要です。' }, { status: 400 })

  const db = createServerClient()
  const { error } = await db.from('departure_dates').update({ is_open }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 出船日を削除
export async function DELETE(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'idが必要です。' }, { status: 400 })

  const db = createServerClient()

  const { data: plans } = await db.from('plans').select('id').eq('departure_date_id', id)
  const planIds = (plans || []).map((p: any) => p.id)

  if (planIds.length > 0) {
    const { data: activeReservations } = await db
      .from('reservations')
      .select('id')
      .in('plan_id', planIds)
      .neq('status', 'cancelled')
    if (activeReservations && activeReservations.length > 0) {
      return NextResponse.json(
        { error: `この出船日には予約が${activeReservations.length}件あるため削除できません。先にキャンセル処理を行ってください。` },
        { status: 400 }
      )
    }

    // キャンセル済み予約の関連データを削除（外部キー制約対策）
    const { data: cancelledReservations } = await db
      .from('reservations')
      .select('id')
      .in('plan_id', planIds)
      .eq('status', 'cancelled')
    if (cancelledReservations && cancelledReservations.length > 0) {
      const ids = cancelledReservations.map((r: any) => r.id)
      await db.from('members').delete().in('reservation_id', ids)
      await db.from('cancellation_requests').delete().in('reservation_id', ids)
      await db.from('reservations').delete().in('id', ids)
    }

    await db.from('plans').delete().eq('departure_date_id', id)
  }

  const { error } = await db.from('departure_dates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
