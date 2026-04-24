'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({ todayReservations: 0, pendingCancellations: 0, upcomingDates: 0 })
  const [recent, setRecent] = useState<any[]>([])

  useEffect(() => {
    async function fetchStats() {
      const today = new Date().toISOString().slice(0, 10)

      const { data: upcoming } = await supabase
        .from('departure_dates')
        .select('id')
        .eq('is_open', true)
        .gte('date', today)
      const { data: cancellations } = await supabase
        .from('cancellation_requests')
        .select('id')
        .eq('status', 'pending')
      const { data: recentRes } = await supabase
        .from('reservations')
        .select('*, plans(name, departure_dates(date))')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        todayReservations: 0,
        pendingCancellations: (cancellations || []).length,
        upcomingDates: (upcoming || []).length,
      })
      setRecent(recentRes || [])
    }
    fetchStats()
  }, [])

  return (
    <div>
      <div className="p-4">
        <h2 className="section-title mt-2">ダッシュボード</h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card text-center">
            <div className="text-3xl font-bold text-ocean-600">{stats.upcomingDates}</div>
            <div className="text-xs text-gray-500 mt-1">受付中の出船日</div>
          </div>
          <div className={`card text-center ${stats.pendingCancellations > 0 ? 'border-red-300' : ''}`}>
            <div className={`text-3xl font-bold ${stats.pendingCancellations > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {stats.pendingCancellations}
            </div>
            <div className="text-xs text-gray-500 mt-1">未処理キャンセル</div>
          </div>
        </div>

        {stats.pendingCancellations > 0 && (
          <button onClick={() => router.push('/admin/cancellations')}
            className="w-full bg-red-50 border border-red-300 text-red-700 rounded-lg py-3 px-4 text-sm font-bold mb-4 flex items-center justify-between">
            <span>⚠️ キャンセル申請 {stats.pendingCancellations}件を確認する</span>
            <span>→</span>
          </button>
        )}

        <h3 className="section-title">最近の予約</h3>
        {recent.length === 0 ? (
          <div className="text-center text-gray-400 py-6">予約はまだありません</div>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <div key={r.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-sm">{r.representative_name}</div>
                    <div className="text-xs text-gray-500">{r.reservation_number}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {r.plans?.departure_dates?.date && formatDateJa(r.plans.departure_dates.date)} ／ {r.plans?.name} ／ {r.total_members}名
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    r.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {r.status === 'confirmed' ? '確定' : '入力待ち'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
