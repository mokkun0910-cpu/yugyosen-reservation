import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function DELETE(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'idが必要です。' }, { status: 400 })

  const db = createServerClient()

  // 関連するプラン・予約を先に削除
  const { data: plans } = await db.from('plans').select('id').eq('departure_date_id', id)
  const planIds = (plans || []).map((p: any) => p.id)

  if (planIds.length > 0) {
    const { data: reservations } = await db
      .from('reservations')
      .select('id')
      .in('plan_id', planIds)
      .neq('status', 'cancelled')
    if (reservations && reservations.length > 0) {
      return NextResponse.json(
        { error: `この出船日には予約が${reservations.length}件あるため削除できません。先にキャンセル処理を行ってください。` },
        { status: 400 }
      )
    }
    await db.from('plans').delete().eq('departure_date_id', id)
  }

  const { error } = await db.from('departure_dates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
