import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month') // 省略時は年全体

  if (!year) return NextResponse.json({ error: 'yearが必要です。' }, { status: 400 })

  const db = createServerClient()

  // 対象期間の開始・終了を設定
  let fromDate: string
  let toDate: string
  let fileLabel: string

  if (month) {
    const m = String(month).padStart(2, '0')
    fromDate = `${year}-${m}-01`
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    toDate = `${year}-${m}-${String(lastDay).padStart(2, '0')}`
    fileLabel = `${year}年${Number(month)}月`
  } else {
    fromDate = `${year}-01-01`
    toDate = `${year}-12-31`
    fileLabel = `${year}年`
  }

  // 対象期間の出船日を取得
  const { data: dates } = await db
    .from('departure_dates')
    .select('id, date, departure_notified_at, weather_notified_at, thankyou_notified_at')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date')

  if (!dates || dates.length === 0) {
    // データなしでも空Excelを返す
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet([{
      '出船日': '', '釣り物': '', '出船時刻': '', '予約番号': '',
      '代表者氏名': '', '代表者電話': '', '乗船者No': '', '乗船者氏名': '',
      '生年月日': '', '住所': '', '電話番号': '', '緊急連絡先氏名': '', '緊急連絡先電話': '', '入力状況': '',
    }])
    XLSX.utils.book_append_sheet(wb, ws, '乗船名簿')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `乗船名簿_${fileLabel}.xlsx`
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const dateIds = dates.map(d => d.id)

  // プランを取得
  const { data: plans } = await db
    .from('plans')
    .select('id, name, departure_time, departure_date_id, price')
    .in('departure_date_id', dateIds)
    .order('departure_time')

  const planIds = (plans || []).map(p => p.id)

  // 予約を取得（キャンセル以外）
  const { data: reservations } = await db
    .from('reservations')
    .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id, line_user_id')
    .in('plan_id', planIds)
    .neq('status', 'cancelled')
    .order('plan_id')

  // 乗船者を取得
  const resIds = (reservations || []).map(r => r.id)
  const membersMap: Record<string, any[]> = {}
  if (resIds.length > 0) {
    const { data: allMembers } = await db
      .from('members')
      .select('reservation_id, name, birth_date, address, phone, emergency_contact_name, emergency_contact_phone, is_completed')
      .in('reservation_id', resIds)
      .order('id')
    for (const m of allMembers || []) {
      if (!membersMap[m.reservation_id]) membersMap[m.reservation_id] = []
      membersMap[m.reservation_id].push(m)
    }
  }

  // 通知送信ラベル
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

  // 月ごとにグルーピングして出力
  const planMap: Record<string, any> = {}
  for (const p of plans || []) planMap[p.id] = p

  // 月ごとの行グループを作成
  type MonthGroup = { label: string; rows: any[]; revenue: number }
  const monthGroups: MonthGroup[] = []
  let currentMonthKey = ''
  let currentGroup: MonthGroup | null = null

  for (const d of dates) {
    const monthKey = d.date.slice(0, 7) // "YYYY-MM"
    if (monthKey !== currentMonthKey) {
      if (currentGroup) monthGroups.push(currentGroup)
      const [y, m] = monthKey.split('-')
      currentGroup = { label: `${Number(y)}年${Number(m)}月`, rows: [], revenue: 0 }
      currentMonthKey = monthKey
    }

    const datePlans = (plans || []).filter(p => p.departure_date_id === d.id)
    if (datePlans.length === 0) continue

    for (const plan of datePlans) {
      const planRes = (reservations || []).filter(r => r.plan_id === plan.id)
      if (planRes.length === 0) continue

      for (const r of planRes) {
        const members = membersMap[r.id] || []
        const hasLine = !!r.line_user_id
        const notifyCols = {
          '⚓出航決定通知': notifyLabel(d.departure_notified_at, hasLine),
          '⛈天候不良通知': notifyLabel(d.weather_notified_at, hasLine),
          '🙏お礼通知': notifyLabel(d.thankyou_notified_at, hasLine),
        }
        const totalMembers: number = r.total_members || members.length || 1
        const unitPrice: number = plan.price || 0
        const resRevenue: number = totalMembers * unitPrice

        if (currentGroup) currentGroup.revenue += resRevenue

        const memberList = members.length > 0 ? members : Array.from({ length: totalMembers }, () => null)

        for (let i = 0; i < memberList.length; i++) {
          const m = memberList[i]
          currentGroup!.rows.push({
            '出船日': d.date,
            '釣り物': plan.name || '',
            '出船時刻': plan.departure_time?.slice(0, 5) || '',
            '予約番号': r.reservation_number,
            '代表者氏名': r.representative_name,
            '代表者電話': r.representative_phone,
            '乗船者No': i + 1,
            '乗船者氏名': m ? (m.is_completed ? (m.name || '') : '（未入力）') : '（未入力）',
            '生年月日': m?.is_completed ? (m.birth_date || '') : '',
            '住所': m?.is_completed ? (m.address || '') : '',
            '電話番号': m?.is_completed ? (m.phone || '') : '',
            '緊急連絡先氏名': m?.is_completed ? (m.emergency_contact_name || '') : '',
            '緊急連絡先電話': m?.is_completed ? (m.emergency_contact_phone || '') : '',
            '入力状況': m?.is_completed ? '入力済み' : '未入力',
            '料金': i === 0 && resRevenue > 0 ? resRevenue : '',
            ...notifyCols,
          })
        }
      }
    }
  }
  if (currentGroup) monthGroups.push(currentGroup)

  // 月合計行を挟みながらフラット化
  const rows: any[] = []
  const emptyRow = {
    '出船日': '', '釣り物': '', '出船時刻': '', '予約番号': '',
    '代表者氏名': '', '代表者電話': '', '乗船者No': '', '乗船者氏名': '',
    '生年月日': '', '住所': '', '電話番号': '', '緊急連絡先氏名': '', '緊急連絡先電話': '',
    '入力状況': '', '料金': '', '⚓出航決定通知': '', '⛈天候不良通知': '', '🙏お礼通知': '',
  }

  for (const g of monthGroups) {
    rows.push(...g.rows)
    if (g.rows.length > 0) {
      rows.push({
        ...emptyRow,
        '代表者氏名': `▶ ${g.label} 合計`,
        '料金': g.revenue > 0 ? g.revenue : '',
      })
      rows.push({ ...emptyRow })
    }
  }

  if (rows.length === 0) {
    rows.push({ ...emptyRow })
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
    { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, '乗船名簿')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `乗船名簿_${fileLabel}.xlsx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
