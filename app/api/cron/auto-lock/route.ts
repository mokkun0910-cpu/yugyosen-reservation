import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  // CRON_SECRETが設定されている場合のみ認証チェック
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = createServerClient()

    // JST での本日の日付を取得
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const today = jstNow.toISOString().slice(0, 10)

    // 本日の出船日を取得
    const { data: departureDates, error: datesError } = await supabase
      .from('departure_dates')
      .select('id')
      .eq('date', today)

    if (datesError) {
      return NextResponse.json({ error: datesError.message }, { status: 500 })
    }

    const dateIds = (departureDates || []).map((d: { id: string }) => d.id)

    if (dateIds.length === 0) {
      return NextResponse.json({ ok: true, lockedPlans: 0, dates: 0 })
    }

    // 対象プランを is_locked: true に更新
    const { data: updatedPlans, error: plansError } = await supabase
      .from('plans')
      .update({ is_locked: true })
      .in('departure_date_id', dateIds)
      .select('id')

    if (plansError) {
      return NextResponse.json({ error: plansError.message }, { status: 500 })
    }

    // 出船日を is_open: false に更新
    const { error: datesUpdateError } = await supabase
      .from('departure_dates')
      .update({ is_open: false })
      .in('id', dateIds)

    if (datesUpdateError) {
      return NextResponse.json({ error: datesUpdateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      lockedPlans: (updatedPlans || []).length,
      dates: dateIds.length,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
