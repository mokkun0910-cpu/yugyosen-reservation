'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateJa } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
function getAdminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  }
}
export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({ pendingCancellations: 0, upcomingDates: 0 })
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [upcomingSchedule, setUpcomingSchedule] = useState<any[]>([])
  useEffect(() => {
    async function fetchStats() {
      try {
        const todayJst = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10)
        const week = new Date(Date.now() + 9*60*60*1000 + 7*86400000).toISOString().slice(0,10)

        const [resData, cancelData, upcomingDatesResult] = await Promise.all([
          fetch('/api/admin/reservations', { headers: getAdminHeaders() }).then(r => r.json()),
          fetch('/api/admin/cancellations', { headers: getAdminHeaders() }).then(r => r.json()).catch(() => ({ requests: [] })),
          supabase
            .from('departure_dates')
            .select('id, date, departure_notified_at, weather_notified_at, thankyou_notified_at, plans(id)')
            .gte('date', todayJst)
            .lte('date', week)
            .order('date'),
        ])
        const reservations: any[] = resData.reservations || []
        const allCancels: any[] = cancelData.requests || []
        const today = new Date().toISOString().slice(0, 10)
        const upcomingDateSet = new Set<string>()
        reservations.forEach((r: any) => {
          const date = r.plans?.departure_dates?.date
          if (date && date >= today) upcomingDateSet.add(date)
        })
        const pendingCount = allCancels.filter((c: any) => c.status === 'pending').length
        setStats({
          pendingCancellations: pendingCount,
          upcomingDates: upcomingDateSet.size,
        })
        setRecent(reservations.slice(0, 5))

        // 7日間ウィジェット用データを構築
        const upcomingDates = upcomingDatesResult.data || []
        const schedule = upcomingDates.map((d: any) => {
          const planIds = (d.plans || []).map((p: any) => p.id)
          const dateReservations = reservations.filter((r: any) => planIds.includes(r.plan_id))
          const resCount = dateReservations.length
          const memberCount = dateReservations.reduce((s: number, r: any) => s + (r.total_members || 0), 0)
          return {
            ...d,
            resCount,
            memberCount,
          }
        })
        setUpcomingSchedule(schedule)
      } catch {
        // fetch失敗時はサイレントに処理
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mt-3 mb-4">
        <div className="w-1 h-5 bg-gold-500 rounded-full" />
        <h2 className="text-lg font-bold text-navy-700 font-serif">ダッシュボード</h2>
      </div>
      {/* 統計カード */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <div className="text-3xl font-bold text-navy-700">{loading ? '…' : stats.upcomingDates}</div>
          <div className="text-xs text-gray-500 mt-1">直近の出船日</div>
        </div>
        <div className={`bg-white rounded-xl shadow-sm border text-center p-4 ${
          stats.pendingCancellations > 0 ? 'border-red-300 bg-red-50' : 'border-gray-100'
        }`}>
          <div className={`text-3xl font-bold ${
            stats.pendingCancellations > 0 ? 'text-red-500' : 'text-gray-300'
          }`}>
            {loading ? '…' : stats.pendingCancellations}
          </div>
          <div className="text-xs text-gray-500 mt-1">未処理キャンセル</div>
        </div>
      </div>
      {/* キャンセル警告 */}
      {stats.pendingCancellations > 0 && (
        <button onClick={() => router.push('/admin/cancellations')}
          className="w-full bg-red-50 border border-red-300 text-red-700 rounded-xl py-3 px-4 text-sm font-bold mb-4 flex items-center justify-between">
          <span>⚠️ キャンセル申請 {stats.pendingCancellations}件を確認する</span>
          <span>→</span>
        </button>
      )}
      {/* クイックアクション */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => router.push('/admin/dates')}
          className="bg-navy-700 text-white rounded-xl py-3 px-4 text-sm font-bold text-left">
          <div className="text-xl mb-1">📅</div>
          <div>出船日を管理</div>
          <div className="text-navy-300 text-xs mt-0.5">日程・プラン設定</div>
        </button>
        <button onClick={() => router.push('/admin/reservations')}
          className="bg-white border border-gray-200 rounded-xl py-3 px-4 text-sm font-bold text-left text-navy-700 shadow-sm">
          <div className="text-xl mb-1">📋</div>
          <div>予約一覧</div>
          <div className="text-gray-400 text-xs mt-0.5">全予約を確認</div>
        </button>
      </div>
      {/* 今後7日間の出船予定 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 bg-gold-500 rounded-full" />
        <h3 className="font-bold text-sm text-navy-700 font-serif">今後7日間の出船予定</h3>
      </div>
      {loading ? (
        <div className="text-center text-gray-400 py-4 text-sm mb-4">読み込み中...</div>
      ) : upcomingSchedule.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 text-center py-6 text-gray-400 text-sm mb-4">
          今後7日間の出船予定はありません
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {upcomingSchedule.map((d) => {
            const todayJst = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10)
            const tomorrowJst = new Date(Date.now() + 9*60*60*1000 + 86400000).toISOString().slice(0,10)
            const dayLabel = d.date === todayJst ? '今日' : d.date === tomorrowJst ? '明日' : ''
            return (
              <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {dayLabel && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          dayLabel === '今日' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>{dayLabel}</span>
                      )}
                      <span className="font-bold text-sm text-navy-700">{formatDateJa(d.date)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      予約 {d.resCount}件 / 計 {d.memberCount}名
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        d.departure_notified_at
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}>
                        {d.departure_notified_at ? '⚓✓ 出航通知済' : '⚓ 出航通知未送信'}
                      </span>
                      {d.weather_notified_at && (
                        <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-orange-50 text-orange-700 border-orange-200">
                          ⛈✓ 天候キャンセル済
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/admin/dates')}
                    className="text-xs bg-navy-700 text-white px-3 py-1.5 rounded-lg font-bold shrink-0 hover:bg-navy-800 transition-colors">
                    管理する
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* 最近の予約 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 bg-gold-500 rounded-full" />
        <h3 className="font-bold text-sm text-navy-700 font-serif">最近の予約</h3>
      </div>
      {loading ? (
        <div className="text-center text-gray-400 py-6 text-sm">読み込み中...</div>
      ) : recent.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 text-center py-8 text-gray-400 text-sm">
          予約はまだありません
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map((r) => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-navy-700">{r.representative_name}</div>
                  <div className="text-xs text-gray-400">{r.reservation_number}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r.plans?.departure_dates?.date && formatDateJa(r.plans.departure_dates.date)}
                    　{r.plans?.name}　{r.total_members}名
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.status === 'confirmed'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {r.status === 'confirmed' ? '✓ 確定' : '⏳ 入力待ち'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
