'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatDateJa } from '@/lib/utils'

function EditReservationForm() {
  const searchParams = useSearchParams()

  const [number, setNumber] = useState(searchParams.get('number') || '')
  const [phone, setPhone] = useState('')
  const [reservation, setReservation] = useState<any>(null)
  const [finding, setFinding] = useState(false)
  const [findError, setFindError] = useState('')

  const [editName, setEditName] = useState('')
  const [editFurigana, setEditFurigana] = useState('')
  const [editMembers, setEditMembers] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [done, setDone] = useState(false)

  async function handleFind(e: React.FormEvent) {
    e.preventDefault()
    setFindError('')
    setReservation(null)
    setFinding(true)
    const res = await fetch(`/api/edit-reservation?number=${encodeURIComponent(number)}&phone=${encodeURIComponent(phone)}`)
    const data = await res.json()
    setFinding(false)
    if (!res.ok) { setFindError(data.error || '予約が見つかりませんでした。'); return }
    setReservation(data.reservation)
    setEditName(data.reservation.representative_name || '')
    setEditFurigana(data.reservation.representative_furigana || '')
    setEditMembers(data.reservation.total_members)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError('')
    setSaving(true)
    const res = await fetch('/api/edit-reservation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: reservation.id,
        phone,
        name: editName,
        furigana: editFurigana,
        totalMembers: editMembers,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveError(data.error || '変更に失敗しました。'); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-sm text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-bold text-navy-700 mb-2">変更が完了しました</h2>
          <p className="text-sm text-gray-500 mb-6">予約内容を更新しました。</p>
          <button onClick={() => window.location.href = '/'}
            className="w-full py-3 rounded-xl bg-navy-700 text-white font-bold text-sm">
            トップページに戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-50 p-4">
      <div className="max-w-sm mx-auto pt-4">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-gold-500 rounded-full" />
          <h1 className="text-lg font-bold text-navy-700 font-serif">予約内容の変更</h1>
        </div>

        {/* 予約照会フォーム */}
        {!reservation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500 mb-4">予約番号と代表者の電話番号を入力してください。</p>
            <form onSubmit={handleFind} className="space-y-3">
              <div>
                <label className="label">予約番号</label>
                <input className="input-field" value={number}
                  onChange={e => setNumber(e.target.value)}
                  placeholder="例：TK-20260501-001" />
              </div>
              <div>
                <label className="label">代表者の電話番号</label>
                <input className="input-field" type="tel" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="090-1234-5678" />
              </div>
              {findError && <p className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {findError}</p>}
              <button type="submit" disabled={finding || !number || !phone}
                className="btn-primary disabled:opacity-50">
                {finding ? '検索中...' : '予約を検索する'}
              </button>
            </form>
          </div>
        )}

        {/* 変更フォーム */}
        {reservation && (
          <div className="space-y-3">
            {/* 現在の予約情報 */}
            <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 text-sm">
              <p className="text-xs text-gray-500 mb-1">予約番号</p>
              <p className="font-bold text-navy-700 text-base tracking-wider mb-3">{reservation.reservation_number}</p>
              <div className="text-xs text-gray-700 space-y-0.5">
                <div>📅 {reservation.date ? formatDateJa(reservation.date) : ''}</div>
                <div>🎣 {reservation.planName}　⏰ {reservation.departureTime}</div>
              </div>
            </div>

            <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <p className="text-sm font-bold text-navy-700">変更内容を入力</p>
              <div>
                <label className="label">代表者氏名</label>
                <input className="input-field" value={editName}
                  onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="label">ふりがな</label>
                <input className="input-field" value={editFurigana}
                  onChange={e => setEditFurigana(e.target.value)}
                  placeholder="やまだ たろう" />
              </div>
              <div>
                <label className="label">参加人数</label>
                <select className="input-field" value={editMembers}
                  onChange={e => setEditMembers(Number(e.target.value))}>
                  {Array.from({ length: reservation.maxMembers }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}名</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  ※ 人数を減らす場合、未入力の乗船者情報から順に削除されます
                </p>
              </div>

              {saveError && <p className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {saveError}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setReservation(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">
                  戻る
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-navy-700 text-white text-sm font-bold disabled:opacity-50">
                  {saving ? '変更中...' : '変更を保存する'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EditReservationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream-50 flex items-center justify-center text-gray-400 text-sm">読み込み中...</div>}>
      <EditReservationForm />
    </Suspense>
  )
}
