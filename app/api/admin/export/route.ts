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

  // 出船日情報を取得（通知送信状況を含む）
  const { data: departureDate, error: dateError } = await db
    .from('departure_dates')
    .select('date, departure_notified_at, weather_notified_at, thankyou_notified_at')
    .eq('id', dateId)
    .single()

  if (!departureDate) {
    return NextResponse.json({ error: '出船日が見つかりません。', detail: dateError?.message }, { status: 404 })
  }

  // その日のプランIDを取得
  const { data: plans } = await db
    .from('plans')
    .select('id, name, departure_time')
    .eq('departure_date_id', dateId)
    .order('departure_time')

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

  // プランIDに紐づく予約を取得（キャンセル以外すべて）
  const { data: reservationRows } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id')
    .in('plan_id', planIds)
    .neq('status', 'cancelled')
    .order('plan_id')

  // 各予約の乗船者を取得
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

  // 通知送信状況ラベルを生成
  function notifyLabel(sentAt: string | null, hasLine: boolean): string {
    if (!sentAt) return '未送信'
    if (!hasLine) return 'LINE未連携'
    const d = new Date(sentAt)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `送信済 (${mm}/${dd} ${hh}:${min})`
  }

  const depNotified = (departureDate as any).departure_notified_at || null
  const weatherNotified = (departureDate as any).weather_notified_at || null
  const thankNotified = (departureDate as any).thankyou_notified_at || null

  // Excelのデータ行を構築
  const rows: any[] = []

  for (const r of validReservations) {
    const plan = r.plans as any
    const members = (r.members as any[]) || []
    const totalMembers: number = r.total_members || members.length || 1
    const hasLine = !!r.line_user_id

    const notifyCols = {
      '⚓出航決定通知': notifyLabel(depNotified, hasLine),
      '⛈天候不良通知': notifyLabel(weatherNotified, hasLine),
      '🙏お礼通知': notifyLabel(thankNotified, hasLine),
    }

    if (members.length > 0) {
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
          ...notifyCols,
        })
      }
    } else {
      for (let i = 0; i < totalMembers; i++) {
        rows.push({
          '出船日': date,
          '釣り物': plan?.name || '',
          '出船時刻': plan?.departure_time?.slice(0, 5) || '',
          '予約番号': r.reservation_number,
          '代表者氏名': r.representative_name,
          '代表者電話': r.representative_phone,
          '乗船者No': i + 1,
          '乗船者氏名': '（未入力）',
          '生年月日': '',
          '住所': '',
          '電話番号': '',
          '緊急連絡先氏名': '',
          '緊急連絡先電話': '',
          '入力状況': '未入力',
          ...notifyCols,
        })
      }
    }
  }

  if (rows.length === 0) {
    rows.push({
      '出船日': date, '釣り物': '', '出船時刻': '', '予約番号': '',
      '代表者氏名': '', '代表者電話': '', '乗船者No': '', '乗船者氏名': '',
      '生年月日': '', '住所': '', '電話番号': '', '緊急連絡先氏名': '', '緊急連絡先電話': '',
      '入力状況': '', '⚓出航決定通知': '', '⛈天候不良通知': '', '🙏お礼通知': '',
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
    { wch: 20 }, // ⚓出航決定通知
    { wch: 20 }, // ⛈天候不良通知
    { wch: 20 }, // 🙏お礼通知
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
