'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateJa } from '@/lib/utils'

function getAdminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-admin-password': sessionStorage.getItem('admin_pw') || '',
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({ pendingCancellations: 0, upcomingDates: 0 })
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [resData, cancelData] = await Promise.all([
          fetch('/api/admin/reservations', { headers: getAdminHeaders() }).then(r => r.json()),
          fetch('/api/admin/cancellations', { headers: getAdminHeaders() }).then(r => r.json()).catch(() => ({ requests: [] })),
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
