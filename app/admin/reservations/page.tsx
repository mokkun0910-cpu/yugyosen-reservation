'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([])
  const [members, setMembers] = useState<Record<string, any[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('reservations')
      .select('*, plans(name, departure_time, departure_dates(date))')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
    setReservations(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadMembers(id: string) {
    if (members[id]) { setExpanded(expanded === id ? null : id); return }
    const { data } = await supabase.from('members').select('*').eq('reservation_id', id)
    setMembers({ ...members, [id]: data || [] })
    setExpanded(id)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mt-2 mb-4">
        <h2 className="section-title">予約一覧（{reservations.length}件）</h2>
        <button onClick={load} className="text-xs bg-ocean-50 text-ocean-700 border border-ocean-200 px-3 py-1.5 rounded-lg">🔄 更新</button>
      </div>
      {loading && <div className="text-center py-8 text-gray-400">読み込み中...</div>}
      <div className="space-y-3">
        {!loading && reservations.length === 0 && <div className="text-center text-gray-400 py-6">予約はありません</div>}
        {reservations.map((r) => (
          <div key={r.id} className="card">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-bold">{r.representative_name}</div>
                <div className="text-xs text-gray-500">{r.reservation_number}</div>
                <div className="text-xs text-gray-600 mt-1">📅 {r.plans?.departure_dates?.date ? formatDateJa(r.plans.departure_dates.date) : '―'}</div>
                <div className="text-xs text-gray-600">🎣 {r.plans?.name} ／ ⏰ {r.plans?.departure_time?.slice(0,5)} ／ 👥 {r.total_members}名</div>
                <div className="text-xs text-gray-600">📞 {r.representative_phone}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {r.status === 'confirmed' ? '確定' : '入力待ち'}
              </span>
            </div>
            <button onClick={() => loadMembers(r.id)} className="text-xs text-ocean-600 border border-ocean-200 px-3 py-1.5 rounded-lg w-full">
              {expanded === r.id ? '乗船者を閉じる ▲' : '乗船者名簿を見る ▼'}
            </button>
            {expanded === r.id && members[r.id] && (
              <div className="mt-3 space-y-2">
                {members[r.id].map((m, i) => (
                  <div key={m.id} className={`rounded-lg p-3 text-xs ${m.is_completed ? 'bg-green-50' : 'bg-yellow-50'}`}>
                    <div className="font-bold mb-1">{m.is_completed ? '✅' : '⏳'} 乗船者{i+1}</div>
                    {m.is_completed && <div className="space-y-0.5 text-gray-600">
                      <div>氏名：{m.name}</div><div>生年月日：{m.birth_date}</div>
                      <div>住所：{m.address}</div><div>電話：{m.phone}</div>
                      <div>緊急連絡先：{m.emergency_contact_name}（{m.emergency_contact_phone}）</div>
                    </div>}
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
