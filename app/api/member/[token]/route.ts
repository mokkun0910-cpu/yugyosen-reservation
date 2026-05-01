import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendReservationConfirmed } from '@/lib/line'
import { formatDateJa } from '@/lib/utils'
import { upsertAddressBook } from '@/lib/addressBook'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params
  const body = await req.json()
  const { name, furigana, birth_date, address, phone, emergency_contact_name, emergency_contact_phone } = body

  const db = createServerClient()

  // トークンから乗船者レコードを取得
  const { data: member } = await db
    .from('members')
    .select('*, reservations(*, plans(*, departure_dates(date)))')
    .eq('input_token', token)
    .single()

  if (!member) return NextResponse.json({ error: '無効なリンクです。' }, { status: 404 })
  if (member.is_completed) return NextResponse.json({ error: 'すでに入力済みです。' }, { status: 400 })

  // 乗船者情報を更新
  await db.from('members').update({
    name, furigana: furigana || null, birth_date, address, phone,
    emergency_contact_name, emergency_contact_phone,
    is_completed: true,
  }).eq('input_token', token)

  // アドレス帳に同行者情報を自動登録・更新
  if (name && phone) {
    await upsertAddressBook(db, {
      name, furigana: furigana || null, phone, birth_date, address,
      emergency_contact_name, emergency_contact_phone,
    }).catch(console.error)
  }

  // 全員の入力が完了したか確認
  const reservationId = member.reservation_id
  const { data: allMembers } = await db
    .from('members')
    .select('is_completed')
    .eq('reservation_id', reservationId)

  const allDone = (allMembers || []).every((m) => m.is_completed)

  if (allDone) {
    // 予約を確定に変更
    await db.from('reservations').update({ status: 'confirmed' }).eq('id', reservationId)

    // 代表者にLINE通知
    const res = member.reservations as any
    if (res?.line_user_id) {
      const plan = res.plans
      const date = plan?.departure_dates?.date
      await sendReservationConfirmed(res.line_user_id, {
        reservationNumber: res.reservation_number,
        planName: plan?.name || '',
        date: date ? formatDateJa(date) : '',
        departureTime: plan?.departure_time || '',
        totalMembers: res.total_members,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
      }).catch(console.error)
    }
  }

  return NextResponse.json({ ok: true, allConfirmed: allDone })
}
