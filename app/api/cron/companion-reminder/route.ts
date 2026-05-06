import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendMemberInputReminder } from '@/lib/line'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = createServerClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    // JST 今日〜3日後を対象
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const today = jstNow.toISOString().slice(0, 10)
    const threeDaysLater = new Date(jstNow.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    // 対象出船日のプランIDを取得
    const { data: departureDates, error: datesError } = await supabase
      .from('departure_dates')
      .select('id')
      .gte('date', today)
      .lte('date', threeDaysLater)

    if (datesError) {
      return NextResponse.json({ error: datesError.message }, { status: 500 })
    }
    if (!departureDates || departureDates.length === 0) {
      return NextResponse.json({ ok: true, reminded: 0, message: '対象の出船日なし' })
    }

    const dateIds = departureDates.map((d: { id: string }) => d.id)

    // 対象プランIDを取得
    const { data: plans } = await supabase
      .from('plans')
      .select('id')
      .in('departure_date_id', dateIds)

    if (!plans || plans.length === 0) {
      return NextResponse.json({ ok: true, reminded: 0, message: '対象プランなし' })
    }

    const planIds = plans.map((p: { id: string }) => p.id)

    // 同行者待ち・LINE連携済み・未リマインド の予約を取得
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, reservation_number, line_user_id')
      .in('plan_id', planIds)
      .eq('status', 'pending_members')
      .not('line_user_id', 'is', null)
      .is('companion_reminded_at', null)

    if (resError) {
      return NextResponse.json({ error: resError.message }, { status: 500 })
    }
    if (!reservations || reservations.length === 0) {
      return NextResponse.json({ ok: true, reminded: 0, message: '対象予約なし' })
    }

    let reminded = 0
    const errors: string[] = []

    for (const res of reservations) {
      // 未入力の同行者を取得
      const { data: pendingMembers } = await supabase
        .from('members')
        .select('id, input_token')
        .eq('reservation_id', res.id)
        .eq('is_completed', false)

      if (!pendingMembers || pendingMembers.length === 0) continue

      // LINE リマインド送信
      try {
        await sendMemberInputReminder(res.line_user_id, {
          reservationNumber: res.reservation_number,
          pendingCount: pendingMembers.length,
          memberLinks: pendingMembers.map((m: { id: string; input_token: string }, i: number) => ({
            token: m.input_token,
            index: i,
          })),
          appUrl,
        })

        // 送信済みフラグを更新
        await supabase
          .from('reservations')
          .update({ companion_reminded_at: new Date().toISOString() })
          .eq('id', res.id)

        reminded++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`${res.reservation_number}: ${msg}`)
      }
    }

    return NextResponse.json({ ok: true, reminded, errors })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
