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
  const [totalCount, setTotalCount] = useState<number | null>(null)

  useEffect(() => {
    async function fetchReservations() {
      try {
        const res = await fetch('/api/admin/reservations')
        const data = await res.json()
        if (data.error) { setLoadError('APIエラー: ' + data.error); return }
        setReservations(data.reservations || [])
        setTotalCount((data.reservations || []).length)
      } catch (e: any) {
        setLoadError('通信エラー: ' + (e?.message || String(e)))
      }
    }
    fetchReservations()
  }, [])

  async function loadMembers(reservationId: string) {
    if (members[reservationId]) { setExpanded(expanded === reservationId ? null : reservationId); return }
    // 乗船者もAPIから取得
    const res = await fetch(`/api/admin/members?reservationId=${reservationId}`)
    const data = await res.json()
    setMembers({ ...members, [reservationId]: data.members || [] })
    setExpanded(reservationId)
  }

  const filtered = reservations
    .filter((r) => filter === 'all' || r.status === filter)
    .filter((r) => !dateFilter || r.plans?.departure_dates?.date === dateFilter)

  return (
    <div className="p-4">
      <h2 className="section-title mt-2">予約一覧</h2>
      {loadError && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-600 mb-3">{loadError}</div>}
      {totalCount !== null && <div className="text-xs text-gray-400 mb-2">DB取得件数: {totalCount}件 / 表示中: {filtered.length}件</div>}

      <div className="mb-3">
        <input
          type="date"
          className="input-field text-sm"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        {dateFilter && (
          <button onClick={() => setDateFilter('')} className="ml-2 text-xs text-gray-500 underline">
            クリア
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'confirmed', 'pending_members'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f ? 'bg-ocean-600 text-white border-ocean-600' : 'bg-white text-gray-600 border-gray-300'
            }`}>
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
                <div className="text-xs text-gray-600 mt-1">
                  📅 {r.plans?.departure_dates?.date && formatDateJa(r.plans.departure_dates.date)}
                </div>
                <div className="text-xs text-gray-600">
                  🎣 {r.plans?.name} ／ ⏰ {r.plans?.departure_time?.slice(0, 5)} ／ 👥 {r.total_members}名
                </div>
                <div className="text-xs text-gray-600">📞 {r.representative_phone}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${
                r.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {r.status === 'confirmed' ? '確定' : '入力待ち'}
              </span>
            </div>
            <button onClick={() => loadMembers(r.id)}
              className="text-xs text-ocean-600 border border-ocean-200 px-3 py-1.5 rounded-lg w-full">
              {expanded === r.id ? '乗船者を閉じる ▲' : '乗船者名簿を見る ▼'}
            </button>
            {expanded === r.id && members[r.id] && (
              <div className="mt-3 space-y-2">
                {members[r.id].map((m, i) => (
                  <div key={m.id} className={`rounded-lg p-3 text-xs ${m.is_completed ? 'bg-green-50' : 'bg-yellow-50'}`}>
                    <div className="font-bold mb-1">
                      {m.is_completed ? '✅' : '⏳'} 乗船者{i + 1}
                      {m.is_completed ? '' : '（未入力）'}
                    </div>
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
