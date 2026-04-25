'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// LIFF初期化・LINE User ID取得
let cachedLineUserId = ''
async function initLiff(): Promise<string> {
  if (cachedLineUserId) return cachedLineUserId
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  if (!liffId) return ''
  try {
    const liffModule = await import('@line/liff')
    const liff = liffModule.default
    await liff.init({ liffId })
    if (liff.isInClient() && liff.isLoggedIn()) {
      const profile = await liff.getProfile()
      cachedLineUserId = profile.userId
      return cachedLineUserId
    }
  } catch {
    // 無視
  }
  return ''
}

type DepartureDate = {
  id: string
  date: string
  is_open: boolean
  plans: { id: string; is_locked: boolean; capacity: number }[]
  reservedCount: number
}

type DayStatus = 'available' | 'full' | 'noPlan' | 'none'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function PlanCard({
  plan,
  dateId,
  onBook,
}: {
  plan: any
  dateId: string
  onBook: (planId: string, planName: string, members: number) => void
}) {
  const [members, setMembers] = useState(1)
  const maxSeats = plan.capacity

  return (
    <div className="card border-ocean-200 bg-ocean-50">
      <div className="font-bold text-gray-800 text-sm mb-1">{plan.name}</div>
      <div className="text-xs text-gray-500 mb-3">
        🐟 {plan.target_fish}　⏰ {plan.departure_time?.slice(0, 5)}　定員 {plan.capacity}名
      </div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs font-bold text-gray-600 shrink-0">参加人数：</label>
        <select
          className="input-field py-1.5 text-sm"
          value={members}
          onChange={(e) => setMembers(Number(e.target.value))}
        >
          {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}名</option>
          ))}
        </select>
      </div>
      <button
        onClick={() => onBook(plan.id, plan.name, members)}
        className="btn-primary py-2 text-sm"
      >
        この内容で予約する →
      </button>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [dates, setDates] = useState<DepartureDate[]>([])
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()) // 0-indexed
  const [selectedDate, setSelectedDate] = useState<DepartureDate | null>(null)
  const [lineUserId, setLineUserId] = useState('')

  useEffect(() => {
    initLiff().then((uid) => {
      if (uid) {
        setLineUserId(uid)
        // ?action=cancel でキャンセルページへリダイレクト
        if (typeof window !== 'undefined') {
          const href = window.location.href
          if (href.includes('action=cancel') || href.includes('action%3Dcancel') || href.includes('action%3dcancel')) {
            window.location.href = `/cancel?lineUserId=${encodeURIComponent(uid)}`
          }
        }
      }
    })
  }, [])

  useEffect(() => {
    async function fetchDates() {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const { data: datesData } = await supabase
        .from('departure_dates')
        .select('id, date, is_open, plans(id, name, target_fish, departure_time, is_locked, capacity)')
        .eq('is_open', true)
        .gte('date', today)
        .order('date', { ascending: true })

      if (!datesData) { setLoading(false); return }

      const enriched = await Promise.all(
        datesData.map(async (d: any) => {
          const planIds = d.plans.map((p: any) => p.id)
          let reservedCount = 0
          if (planIds.length > 0) {
            const { data: resData } = await supabase
              .from('reservations')
              .select('total_members')
              .in('plan_id', planIds)
              .neq('status', 'cancelled')
            reservedCount = (resData || []).reduce(
              (sum: number, r: any) => sum + r.total_members, 0
            )
          }
          return { ...d, reservedCount }
        })
      )
      setDates(enriched)
      setLoading(false)
    }
    fetchDates()
  }, [])

  function getDateStatus(d: DepartureDate): DayStatus {
    if (!d.plans || d.plans.length === 0) return 'noPlan'
    const totalCapacity = d.plans.reduce((sum: number, p: any) => sum + p.capacity, 0)
    if (d.reservedCount >= totalCapacity) return 'full'
    return 'available'
  }

  // 日付文字列 "YYYY-MM-DD" → DepartureDate | undefined
  function getDateInfo(dateStr: string): DepartureDate | undefined {
    return dates.find(d => d.date === dateStr)
  }

  function getDayStatus(dateStr: string): DayStatus {
    const d = getDateInfo(dateStr)
    if (!d) return 'none'
    return getDateStatus(d)
  }

  // カレンダーの日付一覧を生成
  function buildCalendar(year: number, month: number): (string | null)[] {
    const firstDay = new Date(year, month, 1).getDay() // 0=日
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (string | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      cells.push(`${year}-${mm}-${dd}`)
    }
    return cells
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11) }
    else setCurrentMonth(m => m - 1)
    setSelectedDate(null)
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0) }
    else setCurrentMonth(m => m + 1)
    setSelectedDate(null)
  }

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const cells = buildCalendar(currentYear, currentMonth)

  // 選択した日のプラン情報
  function handleDayClick(dateStr: string) {
    const status = getDayStatus(dateStr)
    if (dateStr < today) return
    if (status === 'available') {
      const d = getDateInfo(dateStr)!
      setSelectedDate(d)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="page-header">
        <div className="text-2xl font-bold mb-1">🎣 遊漁船 王丸</div>
        <div className="text-ocean-100 text-sm">オンライン予約</div>
      </div>

      <div className="p-4">
        <h2 className="section-title mt-2">出船日を選んでください</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <>
            {/* カレンダー */}
            <div className="card mb-4 p-3">
              {/* 月ナビゲーション */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={prevMonth}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-ocean-50 text-ocean-700 font-bold text-lg hover:bg-ocean-100 transition-colors"
                >
                  ‹
                </button>
                <div className="font-bold text-base text-gray-800">
                  {currentYear}年 {currentMonth + 1}月
                </div>
                <button
                  onClick={nextMonth}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-ocean-50 text-ocean-700 font-bold text-lg hover:bg-ocean-100 transition-colors"
                >
                  ›
                </button>
              </div>

              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((w, i) => (
                  <div
                    key={w}
                    className={`text-center text-xs font-bold py-1 ${
                      i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                    }`}
                  >
                    {w}
                  </div>
                ))}
              </div>

              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((dateStr, idx) => {
                  if (!dateStr) {
                    return <div key={`empty-${idx}`} />
                  }

                  const dayNum = Number(dateStr.slice(8))
                  const dayOfWeek = new Date(dateStr).getDay()
                  const isPast = dateStr < today
                  const isToday = dateStr === today
                  const status = getDayStatus(dateStr)
                  const isSelected = selectedDate?.date === dateStr
                  const isClickable = !isPast && status === 'available'

                  return (
                    <div
                      key={dateStr}
                      onClick={() => handleDayClick(dateStr)}
                      className={`
                        flex flex-col items-center py-1 rounded-lg transition-colors
                        ${isClickable ? 'cursor-pointer hover:bg-ocean-50' : ''}
                        ${isSelected ? 'bg-ocean-100 ring-2 ring-ocean-400' : ''}
                        ${isPast ? 'opacity-30' : ''}
                      `}
                    >
                      {/* 日付番号 */}
                      <span className={`
                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-ocean-600 text-white font-bold' : ''}
                        ${!isToday && dayOfWeek === 0 ? 'text-red-500' : ''}
                        ${!isToday && dayOfWeek === 6 ? 'text-blue-500' : ''}
                        ${!isToday && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-gray-800' : ''}
                      `}>
                        {dayNum}
                      </span>

                      {/* ステータス印 */}
                      {!isPast && status === 'available' && (
                        <span className="text-xs text-green-600 font-bold leading-none mt-0.5">◎</span>
                      )}
                      {!isPast && status === 'full' && (
                        <span className="text-xs text-red-400 font-bold leading-none mt-0.5">×</span>
                      )}
                      {!isPast && status === 'noPlan' && (
                        <span className="text-xs text-gray-300 leading-none mt-0.5">－</span>
                      )}
                      {(isPast || status === 'none') && (
                        <span className="text-xs leading-none mt-0.5 opacity-0">·</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 凡例 */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 justify-center">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="text-green-600 font-bold">◎</span> 予約可能
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="text-red-400 font-bold">×</span> 満員
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="text-gray-300">－</span> 準備中
                </div>
              </div>
            </div>

            {/* 選択した日のプランリスト */}
            {selectedDate && (
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">
                  📅 {selectedDate.date.replace(/-/g, '/').slice(0, 10)} のプラン
                </h3>
                <div className="space-y-3">
                  {selectedDate.plans
                    .filter((p: any) => !p.is_locked)
                    .map((plan: any) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        dateId={selectedDate.id}
                        onBook={(planId, planName, members) => {
                          const params = new URLSearchParams({ planId, planName, members: String(members) })
                          if (lineUserId) params.set('lineUserId', lineUserId)
                          window.location.href = `/reserve/${selectedDate.id}/form?${params.toString()}`
                        }}
                      />
                    ))}
                  {selectedDate.plans.filter((p: any) => !p.is_locked).length === 0 && (
                    <button
                      onClick={() => router.push(`/reserve/${selectedDate.id}`)}
                      className="w-full card text-left hover:border-ocean-400 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-gray-800 text-sm">この日のプランを見る</div>
                        <span className="badge-available">予約する →</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 予約可能日がない場合 */}
            {dates.length === 0 && (
              <div className="card text-center py-8">
                <div className="text-4xl mb-3">🚢</div>
                <p className="text-gray-600">現在、予約受付中の日程はありません。</p>
                <p className="text-gray-400 text-sm mt-2">しばらくしてからまたご確認ください。</p>
              </div>
            )}
          </>
        )}

        <div className="mt-8 p-4 bg-ocean-50 rounded-lg text-sm text-gray-600">
          <p className="font-bold text-ocean-800 mb-1">📞 電話でのご予約</p>
          <p>オンライン予約が難しい場合はお電話ください。</p>
        </div>
      </div>
    </div>
  )
}
