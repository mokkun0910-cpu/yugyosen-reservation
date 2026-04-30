'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

let cachedLineUserId = ''
// LIFFの初期化状態: 'loading' | 'ok' | 'no_liff_id'
let liffStatus: 'loading' | 'ok' | 'no_liff_id' = 'loading'

async function initLiff(): Promise<{ userId: string; status: 'ok' | 'no_liff_id' }> {
  if (cachedLineUserId) return { userId: cachedLineUserId, status: 'ok' }
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  if (!liffId) {
    liffStatus = 'no_liff_id'
    return { userId: '', status: 'no_liff_id' }
  }
  try {
    const liffModule = await import('@line/liff')
    const liff = liffModule.default
    await liff.init({ liffId })
    if (!liff.isLoggedIn()) {
      // ブラウザからのアクセス → LINEログイン画面にリダイレクト
      liff.login()
      return { userId: '', status: 'loading' }
    }
    const profile = await liff.getProfile()
    cachedLineUserId = profile.userId
    liffStatus = 'ok'
    return { userId: cachedLineUserId, status: 'ok' }
  } catch {
    liffStatus = 'no_liff_id'
    return { userId: '', status: 'no_liff_id' }
  }
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
    <div className="bg-cream-50 border border-gold-100 rounded-xl p-4">
      <div className="font-bold text-navy-700 text-sm mb-1 font-serif">{plan.name}</div>
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
        className="btn-primary py-2.5 text-sm"
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
  const [liffReady, setLiffReady] = useState(false)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<DepartureDate | null>(null)
  const [lineUserId, setLineUserId] = useState('')

  useEffect(() => {
    initLiff().then(({ userId, status }) => {
      if (status === 'loading') return // LINEログインにリダイレクト中
      if (userId) setLineUserId(userId)
      setLiffReady(true)
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

  function getDateInfo(dateStr: string): DepartureDate | undefined {
    return dates.find(d => d.date === dateStr)
  }

  function getDayStatus(dateStr: string): DayStatus {
    const d = getDateInfo(dateStr)
    if (!d) return 'none'
    return getDateStatus(d)
  }

  function buildCalendar(year: number, month: number): (string | null)[] {
    const firstDay = new Date(year, month, 1).getDay()
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

  function handleDayClick(dateStr: string) {
    const status = getDayStatus(dateStr)
    if (dateStr < today) return
    if (status === 'available') {
      const d = getDateInfo(dateStr)!
      setSelectedDate(d)
    }
  }

  // LIFFの準備ができるまでローディング画面を表示
  if (!liffReady) {
    return (
      <div className="min-h-screen bg-navy-700 flex flex-col items-center justify-center p-6">
        <div className="text-gold-400 text-xs tracking-widest mb-2">TAKAYOSHI RYOKAN</div>
        <div className="text-white font-serif text-xl font-bold mb-6">遊漁船 高喜丸</div>
        <div className="text-navy-200 text-sm animate-pulse">LINEと連携しています...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50">

      {/* ヘッダー */}
      <div className="bg-navy-700 text-white px-4 pt-8 pb-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #c5a028 0, #c5a028 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }}
        />
        <div className="relative">
          <p className="text-gold-400 text-xs tracking-widest mb-1">TAKAYOSHI RYOKAN</p>
          <h1 className="text-2xl font-bold font-serif tracking-wider mb-0.5">遊漁船 高喜丸</h1>
          <p className="text-navy-200 text-xs tracking-wide">割烹旅館たかよし ｜ 宗像・神湊</p>
        </div>
      </div>

      {/* ゴールドライン */}
      <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />

      <div className="p-4">

        {/* 予約方法サブタイトル */}
        <div className="flex items-center gap-2 mt-4 mb-4">
          <div className="flex-1 h-px bg-navy-100" />
          <p className="text-xs text-navy-500 tracking-widest font-serif">出船日を選んでください</p>
          <div className="flex-1 h-px bg-navy-100" />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <>
            {/* カレンダー */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
              {/* 月ナビゲーション */}
              <div className="flex items-center justify-between px-4 py-3 bg-navy-700 text-white">
                <button
                  onClick={prevMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy-600 transition-colors text-lg font-bold"
                >
                  ‹
                </button>
                <div className="font-bold text-sm font-serif tracking-wider">
                  {currentYear}年 {currentMonth + 1}月
                </div>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy-600 transition-colors text-lg font-bold"
                >
                  ›
                </button>
              </div>

              <div className="p-3">
                {/* 曜日ヘッダー */}
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAYS.map((w, i) => (
                    <div
                      key={w}
                      className={`text-center text-xs font-bold py-1 ${
                        i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                      }`}
                    >
                      {w}
                    </div>
                  ))}
                </div>

                {/* 日付グリッド */}
                <div className="grid grid-cols-7 gap-y-1">
                  {cells.map((dateStr, idx) => {
                    if (!dateStr) return <div key={`empty-${idx}`} />

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
                          flex flex-col items-center py-1 rounded-lg transition-all
                          ${isClickable ? 'cursor-pointer hover:bg-cream-100' : ''}
                          ${isSelected ? 'bg-gold-50 ring-2 ring-gold-400' : ''}
                          ${isPast ? 'opacity-25' : ''}
                        `}
                      >
                        <span className={`
                          text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                          ${isToday ? 'bg-navy-700 text-white font-bold' : ''}
                          ${!isToday && dayOfWeek === 0 ? 'text-red-400' : ''}
                          ${!isToday && dayOfWeek === 6 ? 'text-blue-400' : ''}
                          ${!isToday && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-gray-800' : ''}
                        `}>
                          {dayNum}
                        </span>
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
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="text-green-600 font-bold">◎</span> 予約可
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="text-red-400 font-bold">×</span> 満員
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="text-gray-300">－</span> 準備中
                  </div>
                </div>
              </div>
            </div>

            {/* 選択した日のプラン */}
            {selectedDate && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-gold-500 rounded-full" />
                  <h3 className="text-sm font-bold text-navy-700 font-serif">
                    {selectedDate.date.replace(/-/g, '/').slice(0, 10)} のプラン
                  </h3>
                </div>
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
                      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-gold-400 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-navy-700 text-sm font-serif">この日のプランを見る</div>
                        <span className="badge-available">予約する →</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 予約日なし */}
            {dates.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 text-center py-10 px-4">
                <div className="text-4xl mb-3">⚓</div>
                <p className="text-navy-700 font-serif font-bold mb-1">現在受付中の日程はありません</p>
                <p className="text-gray-400 text-sm">しばらくしてからまたご確認ください。</p>
              </div>
            )}
          </>
        )}

        {/* 予約確認・キャンセル */}
        <div className="mt-6">
          <a
            href={lineUserId ? `/cancel?lineUserId=${encodeURIComponent(lineUserId)}` : '/cancel'}
            className="flex items-center justify-center gap-2 w-full text-center py-3 px-4 rounded-xl border border-navy-200 bg-white text-navy-700 font-bold text-sm hover:bg-cream-100 transition-colors"
          >
            <span>📋</span> 予約確認・キャンセル
          </a>
        </div>

        {/* 電話予約 */}
        <div className="mt-3 p-4 bg-navy-700 rounded-xl text-white">
          <p className="font-bold text-gold-400 text-sm font-serif mb-1">📞 お電話でのご予約</p>
          <a href="tel:0940621221" className="text-white text-lg font-bold tracking-wider">
            0940-62-1221
          </a>
          <p className="text-navy-200 text-xs mt-1">受付時間：9:00〜20:00</p>
        </div>

        {/* 旅館サイトへ */}
        <div className="mt-3 mb-6">
          <a
            href="https://takayoshi-ryokan.com"
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-1 w-full text-center py-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 text-xs hover:bg-cream-100 transition-colors"
          >
            割烹旅館たかよし 公式サイトへ →
          </a>
        </div>

      </div>
    </div>
  )
}
