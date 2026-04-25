'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [members, setMembers] = useState<Record<string, any[]>>({})
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'pending_members'>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [debugInfo, setDebugInfo] = useState('')

  async function fetchReservations() {
    setRefreshing(true)
    setLoadError('')
    setDebugInfo('')
    try {
      // まずシンプルに全件取得（joinなし）
      const { data: allData, error: allError } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })

      if (allError) { setLoadError('取得エラー: ' + allError.message); setRefreshing(false); return }

      const all = allData || []
      const nonCancelled = all.filter((r: any) => r.status !== 'cancelled')
      setDebugInfo(`DB全件:${all.length} / キャンセル除外後:${nonCancelled.length} / ステータス: ${JSON.stringify(all.reduce((acc: any, r: any) => { acc[r.status] = (acc[r.status]||0)+1; return acc }, {}))}`)

      if (nonCancelled.length === 0) { setReservations([]); setRefreshing(false); return }

      // plan情報を取得
      const planIds = [...new Set(nonCancelled.map((r: any) => r.plan_id).filter(Boolean))] as string[]
      let plans: any[] = []
      let dates: any[] = []
      if (planIds.length > 0) {
        const { data: planData } = await supabase.from('plans').select('id, name, departure_time, departure_date_id').in('id', planIds)
        plans = planData || []
        const dateIds = [...new Set(plans.map((p: any) => p.departure_date_id).filter(Boolean))] as string[]
        if (dateIds.length > 0) {
          const { data: dateData } = await supabase.from('departure_dates').select('id, date').in('id', dateIds)
          dates = dateData || []
        }
      }

      const enriched = nonCancelled.map((r: any) => {
        const plan = plans.find((p: any) => p.id === r.plan_id) || null
        const date = plan ? dates.find((d: any) => d.id === plan.departure_date_id) || null : null
        return { ...r, plans: plan ? { ...plan, departure_dates: date } : null }
      })

      setReservations(enriched)
    } catch (e: any) {
      setLoadError('エラー: ' + (e?.message || String(e)))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchReservations() }, [])

  async function loadMembers(reservationId: string) {
    if (members[reservationId]) { setExpanded(expanded === reservationId ? null : reservationId); return }
    const { data } = await supabase.from('members').select('*').eq('reservation_id', reservationId)
    setMembers({ ...members, [reservationId]: data || [] })
    setExpanded(reservationId)
  }

  const filtered = reservations
    .filter((r) => filter === 'all' || r.status === filter)
    .filter((r) => !dateFilter || r.plans?.departure_dates?.date === dateFilter)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mt-2 mb-3">
        <h2 className="section-title">予約一覧</h2>
        <button onClick={fetchReservations} disabled={refreshing}
          className="text-xs bg-ocean-50 text-ocean-700 border border-ocean-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
          {refreshing ? '更新中…' : '🔄 更新'}
        </button>
      </div>

      {loadError && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600 mb-2">{loadError}</div>}
      {debugInfo && <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-gray-700 mb-2">{debugInfo}</div>}

      <div className="mb-3">
        <input type="date" className="input-field text-sm" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        {dateFilter && <button onClick={() => setDateFilter('')} className="ml-2 text-xs text-gray-500 underline">クリア</button>}
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'confirmed', 'pending_members'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === f ? 'bg-ocean-600 text-white border-ocean-600' : 'bg-white text-gray-600 border-gray-300'}`}>
            {f === 'all' ? 'すべて' : f === 'confirmed' ? '確定済み' : '入力待ち'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <div className="text-center text-gray-400 py-6">予約はありません</div>}
        {filtered.map((r) => (
          <div key={r.id} className="card">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-bold">{r.representative_name}</div>
                <div className="text-xs text-gray-500">{r.reservation_number}</div>
                <div className="text-xs text-gray-600 mt-1">📅 {r.plans?.departure_dates?.date ? formatDateJa(r.plans.departure_dates.date) : '日付不明'}</div>
                <div className="text-xs text-gray-600">🎣 {r.plans?.name || 'プラン不明'} ／ ⏰ {r.plans?.departure_time?.slice(0, 5) || '--'} ／ 👥 {r.total_members}名</div>
                <div className="text-xs text-gray-600">📞 {r.representative_phone}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {r.status === 'confirmed' ? '確定' : r.status}
              </span>
            </div>
            <button onClick={() => loadMembers(r.id)} className="text-xs text-ocean-600 border border-ocean-200 px-3 py-1.5 rounded-lg w-full">
              {expanded === r.id ? '乗船者を閉じる ▲' : '乗船者名簿を見る ▼'}
            </button>
            {expanded === r.id && members[r.id] && (
              <div className="mt-3 space-y-2">
                {members[r.id].map((m, i) => (
                  <div key={m.id} className={`rounded-lg p-3 text-xs ${m.is_completed ? 'bg-green-50' : 'bg-yellow-50'}`}>
                    <div className="font-bold mb-1">{m.is_completed ? '✅' : '⏳'} 乗船者{i + 1}{m.is_completed ? '' : '（未入力）'}</div>
                    {m.is_completed && (
                      <div className="space-y-0.5 text-gray-600">
                        <div>氏名：{m.name}</div>
                        <div>生年月日：{m.birth_date}</div>
                        <div>住所：{m.address}</div>
                        <div>電話：{m.phone}</div>
                        <div>緊急連絡先：{m.emergency_contact_name}（{m.emergency_contact_phone}）</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

