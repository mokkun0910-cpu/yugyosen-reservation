import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateId = searchParams.get('dateId')

  if (!dateId) {
    return NextResponse.json({ error: 'dateIdが必要です。' }, { status: 400 })
  }

  const db = createServerClient()

  // 出船日情報を取得
  const { data: departureDate } = await db
    .from('departure_dates')
    .select('date')
    .eq('id', dateId)
    .single()

  if (!departureDate) {
    return NextResponse.json({ error: '出船日が見つかりません。' }, { status: 404 })
  }

  // その日のプランIDを取得
  const { data: plans } = await db
    .from('plans')
    .select('id, name, departure_time')
    .eq('departure_date_id', dateId)

  const planIds = (plans || []).map((p: any) => p.id)

  if (planIds.length === 0) {
    const rows = [{
      '出船日': departureDate.date, '釣り物': '', '出船時刻': '', '予約番号': '',
      '代表者氏名': '', '代表者電話': '', '乗船者No': '', '乗船者氏名': '',
      '生年月日': '', '住所': '', '電話番号': '', '緊急連絡先氏名': '', '緊急連絡先電話': '', '入力状況': '',
    }]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, '乗船名簿')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `乗船名簿_${departureDate.date}.xlsx`
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  }

  // プランIDに紐づく予約を取得
  const { data: reservationRows } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id')
    .in('plan_id', planIds)
    .neq('status', 'cancelled')

  // 各予約の乗船者を取得
  const validReservations: any[] = []
  for (const r of reservationRows || []) {
    const plan = (plans || []).find((p: any) => p.id === r.plan_id)
    const { data: members } = await db
      .from('members')
      .select('name, birth_date, address, phone, emergency_contact_name, emergency_contact_phone, is_completed')
      .eq('reservation_id', r.id)
    validReservations.push({ ...r, plans: plan || null, members: members || [] })
  }

  const date = departureDate.date

  // Excelのデータ行を構築
  const rows: any[] = []

  for (const r of validReservations) {
    const plan = r.plans as any
    const members = (r.members as any[]) || []

    for (let i = 0; i < members.length; i++) {
      const m = members[i]
      rows.push({
        '出船日': date,
        '釣り物': plan?.name || '',
        '出船時刻': plan?.departure_time?.slice(0, 5) || '',
        '予約番号': r.reservation_number,
        '代表者氏名': r.representative_name,
        '代表者電話': r.representative_phone,
        '乗船者No': i + 1,
        '乗船者氏名': m.is_completed ? (m.name || '') : '（未入力）',
        '生年月日': m.is_completed ? (m.birth_date || '') : '',
        '住所': m.is_completed ? (m.address || '') : '',
        '電話番号': m.is_completed ? (m.phone || '') : '',
        '緊急連絡先氏名': m.is_completed ? (m.emergency_contact_name || '') : '',
        '緊急連絡先電話': m.is_completed ? (m.emergency_contact_phone || '') : '',
        '入力状況': m.is_completed ? '入力済み' : '未入力',
      })
    }
  }

  if (rows.length === 0) {
    // データがない場合もヘッダーだけのシートを返す
    rows.push({
      '出船日': date,
      '釣り物': '',
      '出船時刻': '',
      '予約番号': '',
      '代表者氏名': '',
      '代表者電話': '',
      '乗船者No': '',
      '乗船者氏名': '',
      '生年月日': '',
      '住所': '',
      '電話番号': '',
      '緊急連絡先氏名': '',
      '緊急連絡先電話': '',
      '入力状況': '',
    })
  }

  // ワークブック作成
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // 列幅を設定
  ws['!cols'] = [
    { wch: 12 }, // 出船日
    { wch: 14 }, // 釣り物
    { wch: 10 }, // 出船時刻
    { wch: 18 }, // 予約番号
    { wch: 14 }, // 代表者氏名
    { wch: 16 }, // 代表者電話
    { wch: 10 }, // 乗船者No
    { wch: 14 }, // 乗船者氏名
    { wch: 12 }, // 生年月日
    { wch: 30 }, // 住所
    { wch: 16 }, // 電話番号
    { wch: 14 }, // 緊急連絡先氏名
    { wch: 16 }, // 緊急連絡先電話
    { wch: 10 }, // 入力状況
  ]

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
