import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateId = searchParams.get('dateId')
  const debug = searchParams.get('debug') === '1'

  if (!dateId) {
    return NextResponse.json({ error: 'dateIdが必要です。' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: departureDate, error: dateError } = await db
    .from('departure_dates')
    .select('date')
    .eq('id', dateId)
    .single()

  if (!departureDate) {
    return NextResponse.json({ error: '出船日が見つかりません。', detail: dateError?.message }, { status: 404 })
  }

  const { data: plans, error: plansError } = await db
    .from('plans')
    .select('id, name, departure_time')
    .eq('departure_date_id', dateId)
    .order('departure_time')

  const planIds = (plans || []).map((p: any) => p.id)

  if (debug) {
    const debugInfo: any = { dateId, departureDate, plansError: plansError?.message, plans: plans || [], planIds }
    if (planIds.length > 0) {
      const { data: reservationRows, error: resError } = await db
        .from('reservations')
        .select('id, reservation_number, representative_name, total_members, status, plan_id')
        .in('plan_id', planIds)
        .neq('status', 'cancelled')
      debugInfo.reservationsError = resError?.message
      debugInfo.reservations = reservationRows || []
      const allMembers: any[] = []
      for (const r of reservationRows || []) {
        const { data: members, error: memError } = await db
          .from('members')
          .select('id, reservation_id, name, is_completed')
          .eq('reservation_id', r.id)
        allMembers.push({ reservation_id: r.id, reservation_number: r.reservation_number, members, memError: memError?.message })
      }
      debugInfo.members = allMembers
    }
    return NextResponse.json(debugInfo, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (planIds.length === 0) {
    const rows = [{ '出船日': departureDate.date, '釣り物': '', '出船時刻': '', '予約番号': '', '代表者氏名': '', '代表者電話': '', '乗船者No': '', '乗船者氏名': '', '生年月日': '', '住所': '', '電話番号': '', '緊急連絡先氏名': '', '緊急連絡先電話': '', '入力状況': '' }]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, '乗船名簿')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `乗船名簿_${departureDate.date}.xlsx`
    return new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` } })
  }

  const { data: reservationRows } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id')
    .in('plan_id', planIds)
    .neq('status', 'cancelled')
    .order('plan_id')

  const validReservations: any[] = []
  for (const r of reservationRows || []) {
    const plan = (plans || []).find((p: any) => p.id === r.plan_id)
    const { data: members } = await db
      .from('members')
      .select('name, birth_date, address, phone, emergency_contact_name, emergency_contact_phone, is_completed')
      .eq('reservation_id', r.id)
      .order('id')
    validReservations.push({ ...r, plans: plan || null, members: members || [] })
  }

  const date = departureDate.date
  const rows: any[] = []

  for (const r of validReservations) {
    const plan = r.plans as any
    const members = (r.members as any[]) || []
    const totalMembers: number = r.total_members || members.length || 1

    if (members.length > 0) {
      for (let i = 0; i < members.length; i++) {
        const m = members[i]
        rows.push({ '出船日': date, '釣り物': plan?.name || '', '出船時刻': plan?.departure_time?.slice(0, 5) || '', '予約番号': r.reservation_number, '代表者氏名': r.representative_name, '代表者電話': r.representative_phone, '乗船者No': i + 1, '乗船者氏名': m.is_completed ? (m.name || '') : '（未入力）', '生年月日': m.is_completed ? (m.birth_date || '') : '', '住所': m.is_completed ? (m.address || '') : '', '電話番号': m.is_completed ? (m.phone || '') : '', '緊急連絡先氏名': m.is_completed ? (m.emergency_contact_name || '') : '', '緊急連絡先電話': m.is_completed ? (m.emergency_contact_phone || '') : '', '入力状況': m.is_completed ? '入力済み' : '未入力' })
      }
    } else {
      for (let i = 0; i < totalMembers; i++) {
        rows.push({ '出船日': date, '釣り物': plan?.name || '', '出船時刻': plan?.departure_time?.slice(0, 5) || '', '予約番号': r.reservation_number, '代表者氏名': r.representative_name, '代表者電話': r.representative_phone, '乗船者No': i + 1, '乗船者氏名': '（未入力）', '生年月日': '', '住所': '', '電話番号': '', '緊急連絡先氏名': '', '緊急連絡先電話': '', '入力状況': '未入力' })
      }
    }
  }

  if (rows.length === 0) {
    rows.push({ '出船日': date, '釣り物': '', '出船時刻': '', '予約番号': '', '代表者氏名': '', '代表者電話': '', '乗船者No': '', '乗船者氏名': '', '生年月日': '', '住所': '', '電話番号': '', '緊急連絡先氏名': '', '緊急連絡先電話': '', '入力状況': '' })
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, ws, '乗船名簿')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `乗船名簿_${date}.xlsx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
