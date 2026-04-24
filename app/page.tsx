'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

type DepartureDate = {
  id: string
  date: string
  is_open: boolean
  plans: { id: string; is_locked: boolean; capacity: number }[]
  reservedCount: number
}

export default function HomePage() {
  const router = useRouter()
  const [dates, setDates] = useState<DepartureDate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDates() {
      const today = new Date().toISOString().slice(0, 10)
      const { data: datesData } = await supabase
        .from('departure_dates')
        .select('id, date, is_open, plans(id, is_locked, capacity)')
        .eq('is_open', true)
        .gte('date', today)
        .order('date', { ascending: true })

      if (!datesData) { setLoading(false); return }

      // 各日付の予約済み人数を取得
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

  function getDateStatus(d: DepartureDate) {
    if (!d.plans || d.plans.length === 0) return 'noPlan'
    const maxCapacity = Math.max(...d.plans.map((p: any) => p.capacity))
    if (d.reservedCount >= maxCapacity) return 'full'
    return 'available'
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
        ) : dates.length === 0 ? (
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">🚢</div>
            <p className="text-gray-600">現在、予約受付中の日程はありません。</p>
            <p className="text-gray-400 text-sm mt-2">しばらくしてからまたご確認ください。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dates.map((d) => {
              const status = getDateStatus(d)
              return (
                <button
                  key={d.id}
                  disabled={status !== 'available'}
                  onClick={() => router.push(`/reserve/${d.id}`)}
                  className={`w-full card text-left transition-all ${
                    status === 'available'
                      ? 'hover:border-ocean-400 hover:shadow-md cursor-pointer'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-800 text-base">
                        {formatDateJa(d.date)}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {d.plans.length}プラン
                      </div>
                    </div>
                    <div>
                      {status === 'available' && (
                        <span className="badge-available">予約受付中</span>
                      )}
                      {status === 'full' && (
                        <span className="badge-full">満員</span>
                      )}
                      {status === 'noPlan' && (
                        <span className="badge-locked">準備中</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-8 p-4 bg-ocean-50 rounded-lg text-sm text-gray-600">
          <p className="font-bold text-ocean-800 mb-1">📞 電話でのご予約</p>
          <p>オンライン予約が難しい場合はお電話ください。</p>
        </div>
      </div>
    </div>
  )
}
