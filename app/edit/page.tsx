'use client'
import { useState, Suspense } from 'react'
import { formatDateJa } from '@/lib/utils'

function EditReservationForm() {
  const [phone, setPhone] = useState('')
  const [reservations, setReservations] = useState<any[]>([])
  const [finding, setFinding] = useState(false)
  const [findError, setFindError] = useState('')

  const [newPhone, setNewPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [done, setDone] = useState(false)

  async function handleFind(e: React.FormEvent) {
    e.preventDefault()
    setFindError('')
    setReservations([])
    setFinding(true)
    const res = await fetch(`/api/edit-reservation?phone=${encodeURIComponent(phone)}`)
    const data = await res.json()
    setFinding(false)
    if (!res.ok) { setFindError(data.error || '予約が見つかりませんでした。'); return }
    setReservations(data.reservations || [])
    setNewPhone(phone)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!newPhone) { setSaveError('新しい電話番号を入力してください。'); return }
    if (newPhone === phone) { setSaveError('現在と同じ電話番号です。'); return }
    setSaveError('')
    setSaving(true)
    const res = await fetch('/api/edit-reservation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, newPhone }),
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
          <p className="text-sm text-gray-500 mb-1">電話番号を更新しました。</p>
          <p className="text-base font-bold text-navy-700 mb-6">{newPhone}</p>
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
          <h1 className="text-lg font-bold text-navy-700 font-serif">電話番号の変更</h1>
        </div>

        {/* STEP 1: 電話番号で検索 */}
        {reservations.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500 mb-4">
              現在登録されている電話番号を入力してください。
            </p>
            <form onSubmit={handleFind} className="space-y-3">
              <div>
                <label className="label">現在の電話番号</label>
                <input className="input-field" type="tel" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="090-1234-5678" />
              </div>
              {findError && (
                <p className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {findError}</p>
              )}
              <button type="submit" disabled={finding || !phone}
                className="btn-primary disabled:opacity-50">
                {finding ? '検索中...' : '予約を検索する'}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: 予約確認 + 新電話番号入力 */}
        {reservations.length > 0 && (
          <div className="space-y-3">
            {/* 見つかった予約一覧 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-3">
                以下の予約が見つかりました（{reservations.length}件）
              </p>
              <div className="space-y-2">
                {reservations.map((r) => (
                  <div key={r.id}
                    className="bg-gold-50 border border-gold-200 rounded-xl p-3 text-xs">
                    <div className="font-bold text-navy-700 text-sm mb-0.5">
                      {r.reservation_number}
                    </div>
                    <div className="text-gray-600">
                      📅 {r.date ? formatDateJa(r.date) : ''}
                      🎣 {r.planName}　👥 {r.total_members}名
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 新しい電話番号入力 */}
            <form onSubmit={handleSave}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <p className="text-sm font-bold text-navy-700">新しい電話番号を入力</p>
              <div>
                <label className="label">新しい電話番号</label>
                <input className="input-field" type="tel" value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="090-9999-8888" />
              </div>
              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {saveError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button"
                  onClick={() => { setReservations([]); setPhone(''); setNewPhone('') }}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">
                  戻る
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-navy-700 text-white text-sm font-bold disabled:opacity-50">
                  {saving ? '変更中...' : '変更する'}
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
    <Suspense fallback={
      <div className="min-h-screen bg-cream-50 flex items-center justify-center text-gray-400 text-sm">
        読み込み中...
      </div>
    }>
      <EditReservationForm />
    </Suspense>
  )
}
