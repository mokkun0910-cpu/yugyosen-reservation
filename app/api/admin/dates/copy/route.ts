import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { sourceDateId, targetDate } = await req.json()
  if (!sourceDateId || !targetDate) {
    return NextResponse.json({ error: 'sourceDateIdとtargetDateが必要です。' }, { status: 400 })
  }

  const db = createServerClient()

  // コピー先の日付を取得または作成
  const { data: existingList } = await db
    .from('departure_dates')
    .select('id')
    .eq('date', targetDate)

  let targetDateId: string
  if (existingList && existingList.length > 0) {
    targetDateId = existingList[0].id
  } else {
    const { data: newDateData, error: dateError } = await db
      .from('departure_dates')
      .insert({ date: targetDate, is_open: false })
      .select()
    if (dateError || !newDateData || newDateData.length === 0) {
      return NextResponse.json({ error: '出船日の作成に失敗しました: ' + (dateError?.message || '不明なエラー') }, { status: 500 })
    }
    targetDateId = newDateData[0].id
  }

  // コピー元のプランを取得
  const { data: sourcePlans, error: planFetchError } = await db
    .from('plans')
    .select('*')
    .eq('departure_date_id', sourceDateId)

  if (planFetchError) {
    return NextResponse.json({ error: 'プランの取得に失敗しました: ' + planFetchError.message }, { status: 500 })
  }
  if (!sourcePlans || sourcePlans.length === 0) {
    return NextResponse.json({ error: 'コピー元にプランがありません。先にプランを設定してください。' }, { status: 400 })
  }

  const newPlans = sourcePlans.map((p: any) => ({
    departure_date_id: targetDateId,
    name: p.name,
    target_fish: p.target_fish,
    departure_time: p.departure_time,
    capacity: p.capacity,
    price: p.price,
    is_locked: false,
  }))

  const { error: planInsertError } = await db.from('plans').insert(newPlans)
  if (planInsertError) {
    return NextResponse.json({ error: 'プランのコピーに失敗しました: ' + planInsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, targetDateId })
}
