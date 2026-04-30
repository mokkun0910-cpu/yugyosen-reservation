'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

export default function AdminReservationsPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<any[]>([])
  const [members, setMembers] = useState<Record<string, any[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [openDates, setOpenDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function handleCancel(r: any) {
    const label = `${r.representative_name}（${r.reservation_number}）`
    if (!confirm(`「${label}」の予約をキャンセルしますか？\n乗船名簿からも削除されます。`)) return
    setCancelling(r.id)
    const pw = sessionStorage.getItem('admin_pw') || ''
    const res = await fetch('/api/admin/cancel-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: JSON.stringify({ reservationId: r.id }),
    })
    const data = await res.json()
    setCancelling(null)
    if (!res.ok) {
      alert('キャンセルに失敗しました: ' + (data.error || '不明なエラー'))
      return
    }
    await load()
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('reservations')
      .select('*, plans(name, departure_time, departure_dates(date))')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
    const sorted = (data || []).sort((a, b) => {
      const da = a.plans?.departure_dates?.date || ''
      const db = b.plans?.departure_dates?.date || ''
      return da < db ? -1 : da > db ? 1 : 0
    })
    setReservations(sorted)
    // 直近の出船日を自動展開
    if (sorted.length > 0) {
      const firstDate = sorted[0].plans?.departure_dates?.date || ''
      if (firstDate) setOpenDates(new Set([firstDate]))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadMembers(id: string) {
    if (members[id]) {
      setExpanded(expanded === id ? null : id)
      return
    }
    const { data } = await supabase.from('members').select('*').eq('reservation_id', id)
    setMembers({ ...members, [id]: data || [] })
    setExpanded(id)
  }

  function toggleDate(date: string) {
    setOpenDates(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  // 日付ごとにグループ化
  const grouped: { date: string; items: any[] }[] = []
  for (const r of reservations) {
    const date = r.plans?.departure_dates?.date || '日程未設定'
    const group = grouped.find(g => g.date === date)
    if (group) {
      group.items.push(r)
    } else {
      grouped.push({ date, items: [r] })
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mt-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gold-500 rounded-full" />
          <h2 className="text-lg font-bold text-navy-700 font-serif">
            予約一覧
            <span className="text-sm font-normal text-gray-400 ml-2">({reservations.length}件)</span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/admin/reservations/new')}
            className="text-xs bg-navy-700 text-white px-3 py-1.5 rounded-lg hover:bg-navy-800 transition-colors font-medium">
            📞 電話予約を入力
          </button>
          <button onClick={load}
            className="text-xs bg-white text-navy-700 border border-navy-200 px-3 py-1.5 rounded-lg hover:bg-cream-50 transition-colors">
            🔄 更新
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
      )}

      {!loading && reservations.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 text-center py-10 text-gray-400 text-sm">
          予約はまだありません
        </div>
      )}

      {!loading && grouped.map(({ date, items }) => {
        const isOpen = openDates.has(date)
        const isPast = date < today
        const confirmedCount = items.filter(r => r.status === 'confirmed').length
        const totalMembers = items.reduce((sum, r) => sum + (r.total_members || 0), 0)

        return (
          <div key={date} className="mb-4">
            {/* 日付ヘッダー */}
            <button
              onClick={() => toggleDate(date)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-2 transition-colors ${
                isPast
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-navy-700 text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{isPast ? '📁' : '📅'}</span>
                <div className="text-left">
                  <div className={`font-bold font-serif text-sm ${isPast ? 'text-gray-600' : 'text-white'}`}>
                    {date === '日程未設定' ? '日程未設定' : formatDateJa(date)}
                  </div>
                  <div className={`text-xs mt-0.5 ${isPast ? 'text-gray-400' : 'text-navy-200'}`}>
                    予約 {items.length}件 ／ 計 {totalMembers}名 ／ 確定 {confirmedCount}件
                  </div>
                </div>
              </div>
              <span className={`text-sm ${isPast ? 'text-gray-400' : 'text-navy-200'}`}>
                {isOpen ? '▲' : '▼'}
              </span>
            </button>

            {/* 予約リスト */}
            {isOpen && (
              <div className="space-y-2 pl-2">
                {items.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm text-navy-700">{r.representative_name}</div>
                        <div className="text-xs text-gray-400">{r.reservation_number}</div>
                        <div className="text-xs text-gray-600">
                          🎣 {r.plans?.name}　⏰ {r.plans?.departure_time?.slice(0, 5)}　👥 {r.total_members}名
                        </div>
                        <div className="text-xs text-gray-600">📞 {r.representative_phone}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                          r.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {r.status === 'confirmed' ? '✓ 確定' : '⏳ 入力待ち'}
                        </span>
                        <button
                          onClick={() => handleCancel(r)}
                          disabled={cancelling === r.id}
                          className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                          {cancelling === r.id ? '処理中…' : '📞 キャンセル'}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => loadMembers(r.id)}
                      className="text-xs text-navy-600 border border-navy-200 bg-navy-50 px-3 py-1.5 rounded-lg w-full hover:bg-navy-100 transition-colors">
                      {expanded === r.id ? '乗船者名簿を閉じる ▲' : '乗船者名簿を見る ▼'}
                    </button>
                    {expanded === r.id && members[r.id] && (
                      <div className="mt-3 space-y-2">
                        {members[r.id].map((m, i) => (
                          <div key={m.id} className={`rounded-lg p-3 text-xs ${m.is_completed ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}>
                            <div className="font-bold mb-1 text-navy-700">
                              {m.is_completed ? '✅' : '⏳'} 乗船者 {i + 1}
                            </div>
                            {m.is_completed ? (
                              <div className="space-y-0.5 text-gray-600">
                                <div>氏名：{m.name}</div>
                                <div>生年月日：{m.birth_date}</div>
                                <div>住所：{m.address}</div>
                                <div>電話：{m.phone}</div>
                                <div>緊急連絡先：{m.emergency_contact_name}（{m.emergency_contact_phone}）</div>
                              </div>
                            ) : (
                              <div className="text-yellow-700">情報入力待ち</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
