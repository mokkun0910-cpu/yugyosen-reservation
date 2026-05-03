'use client'
import { useState, Suspense } from 'react'
import { formatDateJa } from '@/lib/utils'

type ReservationInfo = {
  id: string
  reservation_number: string
  representative_name: string
  representative_furigana: string | null
  representative_phone: string
  total_members: number
  planName: string
  departureTime: string
  date: string
  maxMembers: number
}

function EditReservationForm() {
  // STEP1: 電話番号検索
  const [phone, setPhone] = useState('')
  const [reservations, setReservations] = useState<ReservationInfo[]>([])
  const [finding, setFinding] = useState(false)
  const [findError, setFindError] = useState('')

  // STEP2: 変更する予約を選択
  const [selected, setSelected] = useState<ReservationInfo | null>(null)

  // STEP3: 変更内容入力
  const [editName, setEditName] = useState('')
  const [editFurigana, setEditFurigana] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editMembers, setEditMembers] = useState(1)
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
  }

  function handleSelect(r: ReservationInfo) {
    setSelected(r)
    setEditName(r.representative_name || '')
    setEditFurigana(r.representative_furigana || '')
    setEditPhone(r.representative_phone || '')
    setEditMembers(r.total_members)
    setSaveError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editName) { setSaveError('氏名を入力してください。'); return }
    if (!editPhone) { setSaveError('電話番号を入力してください。'); return }
    setSaveError('')
    setSaving(true)
    const res = await fetch('/api/edit-reservation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: selected!.id,
        phone,                                          // 本人確認用（現在の電話番号）
        name: editName,
        furigana: editFurigana,
        newPhone: editPhone !== phone ? editPhone : undefined,  // 変更あれば送信
        totalMembers: editMembers,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setSaveError(data.error || '変更に失敗しました。'); return }
    setDone(true)
  }

  // 完了画面
  if (done && selected) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-sm text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-bold text-navy-700 mb-2">変更が完了しました</h2>
          <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 mb-5 text-left text-sm">
            <div className="text-xs text-gray-500 mb-1">予約番号</div>
            <div className="font-bold text-navy-700 mb-2">{selected.reservation_number}</div>
            <div className="text-xs text-gray-700 space-y-0.5">
              <div>👤 {editName}　{editFurigana && <span className="text-gray-400">（{editFurigana}）</span>}</div>
              <div>📞 {editPhone}</div>
              <div>👥 {editMembers}名</div>
            </div>
          </div>
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

        {/* STEP1: 電話番号で検索 */}
        {reservations.length === 0 && !selected && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500 mb-4">
              予約時に登録した電話番号を入力してください。
            </p>
            <form onSubmit={handleFind} className="space-y-3">
              <div>
                <label className="label">電話番号</label>
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

        {/* STEP2: 予約を選択 */}
        {reservations.length > 0 && !selected && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 px-1">
              変更する予約を選択してください（{reservations.length}件）
            </p>
            {reservations.map(r => (
              <button key={r.id} onClick={() => handleSelect(r)}
                className="w-full text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:border-navy-300 hover:bg-cream-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">{r.reservation_number}</div>
                    <div className="font-bold text-navy-700 text-sm">{r.representative_name}</div>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <div>📅 {r.date ? formatDateJa(r.date) : ''}</div>
                      <div>🎣 {r.planName}　⏰ {r.departureTime}　👥 {r.total_members}名</div>
                    </div>
                  </div>
                  <span className="text-navy-400 text-lg mt-1">›</span>
                </div>
              </button>
            ))}
            <button onClick={() => { setReservations([]); setPhone('') }}
              className="w-full py-2 text-sm text-gray-500 text-center">
              ← 電話番号を入力し直す
            </button>
          </div>
        )}

        {/* STEP3: 変更内容入力 */}
        {selected && (
          <div className="space-y-3">
            {/* 選択中の予約情報 */}
            <div className="bg-gold-50 border border-gold-200 rounded-xl p-3 text-xs text-gray-700">
              <div className="font-bold text-navy-700 text-sm mb-1">{selected.reservation_number}</div>
              <div>📅 {selected.date ? formatDateJa(selected.date) : ''}</div>
              <div>🎣 {selected.planName}　⏰ {selected.departureTime}</div>
            </div>

            <form onSubmit={handleSave}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
              <p className="text-sm font-bold text-navy-700 mb-1">変更内容を入力</p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">氏名 <span className="text-red-500">*</span></label>
                  <input className="input-field" value={editName}
                    onChange={e => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="label">ふりがな</label>
                  <input className="input-field" value={editFurigana}
                    onChange={e => setEditFurigana(e.target.value)}
                    placeholder="やまだ たろう" />
                </div>
              </div>

              <div>
                <label className="label">電話番号 <span className="text-red-500">*</span></label>
                <input className="input-field" type="tel" value={editPhone}
                  onChange={e => setEditPhone(e.target.value)} />
              </div>

              <div>
                <label className="label">参加人数</label>
                <select className="input-field" value={editMembers}
                  onChange={e => setEditMembers(Number(e.target.value))}>
                  {Array.from({ length: selected.maxMembers }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}名</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  ※ 人数を減らす場合、未入力の乗船者情報から順に削除されます
                </p>
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {saveError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button"
                  onClick={() => { setSelected(null); setSaveError('') }}
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
    <Suspense fallback={
      <div className="min-h-screen bg-cream-50 flex items-center justify-center text-gray-400 text-sm">
        読み込み中...
      </div>
    }>
      <EditReservationForm />
    </Suspense>
  )
}
