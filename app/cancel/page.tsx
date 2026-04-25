'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateJa } from '@/lib/utils'

type Member = { id: string; name: string; phone: string; is_completed: boolean }

type Reservation = {
  id: string
  reservation_number: string
  representative_name: string
  representative_phone: string
  total_members: number
  status: string
  plans: { name: string; departure_time: string; departure_dates: { date: string } }
  members: Member[]
  isRepresentative: boolean
  myMemberId: string | null
}

export default function CancelPage() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'select' | 'confirm' | 'done'>('phone')

  const [phone, setPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])

  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null)
  const [cancelType, setCancelType] = useState<'full' | 'member'>('member')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { setSearchError('電話番号を入力してください。'); return }
    setSearching(true)
    setSearchError('')

    const res = await fetch(`/api/cancel?phone=${encodeURIComponent(phone.trim())}`)
    const data = await res.json()
    setSearching(false)

    if (!res.ok) { setSearchError(data.error || 'エラーが発生しました。'); return }
    if (!data.reservations || data.reservations.length === 0) {
      setSearchError('この電話番号で有効な予約が見つかりませんでした。')
      return
    }
    setReservations(data.reservations)
    setStep('select')
  }

  function handleSelectRes(r: Reservation) {
    setSelectedRes(r)
    // 自分が同行者として見つかった場合は「自分だけキャンセル」をデフォルト
    if (r.myMemberId) {
      setCancelType('member')
      setSelectedMemberId(r.myMemberId)
    } else {
      setCancelType('full')
      setSelectedMemberId('')
    }
    setStep('confirm')
  }

  async function handleSubmit() {
    if (!selectedRes) return
    setSubmitting(true)
    setSubmitError('')

    let body: any
    if (cancelType === 'full') {
      body = { type: 'full', reservationNumber: selectedRes.reservation_number }
    } else {
      body = { type: 'member', reservationId: selectedRes.id, memberId: selectedMemberId }
    }

    const res = await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) { setSubmitError(data.error || 'エラーが発生しました。'); return }
    setStep('done')
  }

  // 完了
  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center">
          <div className="text-5xl mb-3">
            {cancelType === 'member' ? '✅' : '📨'}
          </div>
          <h2 className="font-bold text-lg text-gray-800 mb-2">
            {cancelType === 'member' ? 'キャンセルが完了しました' : 'キャンセル申請を受け付けました'}
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            {cancelType === 'member'
              ? '乗船者の人数が変更されました。船長にも通知しました。'
              : '船長が確認後、LINEでご連絡します。'}
          </p>
          <button className="btn-secondary" onClick={() => {
            if (typeof window !== 'undefined' && window.opener == null && window.history.length <= 1) {
              window.close()
            } else {
              try { window.close() } catch {}
              router.push('/')
            }
          }}>LINEに戻る</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="page-header">
        <button
          onClick={() => {
            if (step === 'confirm') setStep('select')
            else if (step === 'select') setStep('phone')
            else router.back()
          }}
          className="text-ocean-200 text-sm mb-1 block">← 戻る</button>
        <div className="font-bold text-lg">キャンセル申請</div>
      </div>

      <div className="p-4">

        {/* ステップインジケーター */}
        <div className="flex items-center gap-2 mb-5">
          {['phone', 'select', 'confirm'].map((s, i) => {
            const labels = ['電話番号', '予約を選ぶ', '確認']
            const current = ['phone', 'select', 'confirm'].indexOf(step)
            const done = i < current
            const active = i === current
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <div className="h-px w-4 bg-gray-200 mr-1" />}
                <div className={`flex items-center gap-1 text-xs font-bold ${active ? 'text-ocean-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-ocean-600 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {done ? '✓' : i + 1}
                  </span>
                  {labels[i]}
                </div>
              </div>
            )
          })}
        </div>

        {/* Step 1: 電話番号入力 */}
        {step === 'phone' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
              <p>予約時に登録した<span className="font-bold">電話番号</span>を入力してください。</p>
              <p className="text-xs mt-1 text-blue-600">代表者・同行者どちらの電話番号でも検索できます。</p>
            </div>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="label">電話番号 <span className="text-red-500">*</span></label>
                <input className="input-field" type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="例：090-1234-5678" />
              </div>
              {searchError && <p className="error-text">{searchError}</p>}
              <button type="submit" className="btn-primary" disabled={searching}>
                {searching ? '検索中...' : '予約を検索する'}
              </button>
            </form>
          </>
        )}

        {/* Step 2: 予約選択 */}
        {step === 'select' && (
          <>
            <p className="text-sm text-gray-600 mb-3">該当する予約が見つかりました。キャンセルする予約を選んでください。</p>
            <div className="space-y-3">
              {reservations.map((r) => {
                const plan = r.plans as any
                const date = plan?.departure_dates?.date
                return (
                  <button key={r.id} onClick={() => handleSelectRes(r)}
                    className="w-full card text-left hover:border-ocean-400 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-sm text-gray-800">
                          {date ? formatDateJa(date) : ''}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          🎣 {plan?.name}　⏰ {plan?.departure_time?.slice(0, 5)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          👥 {r.total_members}名　代表：{r.representative_name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{r.reservation_number}</div>
                      </div>
                      <span className="text-ocean-600 text-xs font-bold mt-1">選択 →</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Step 3: キャンセル方法を選ぶ */}
        {step === 'confirm' && selectedRes && (
          <>
            {/* 予約情報 */}
            {(() => {
              const plan = selectedRes.plans as any
              const date = plan?.departure_dates?.date
              return (
                <div className="card mb-4 bg-gray-50">
                  <div className="text-xs text-gray-500 mb-1">キャンセル対象の予約</div>
                  <div className="font-bold text-sm">{date ? formatDateJa(date) : ''}</div>
                  <div className="text-xs text-gray-600">🎣 {plan?.name}　⏰ {plan?.departure_time?.slice(0, 5)}</div>
                  <div className="text-xs text-gray-500">👥 {selectedRes.total_members}名　代表：{selectedRes.representative_name}</div>
                </div>
              )
            })()}

            {/* キャンセル方法選択 */}
            <p className="text-sm font-bold text-gray-700 mb-3">キャンセルの範囲を選んでください</p>

            <div className="space-y-3 mb-4">
              {/* 自分だけキャンセル */}
              {selectedRes.members.filter(m => m.is_completed).length > 0 && (
                <div>
                  <label className={`card cursor-pointer block transition-all ${cancelType === 'member' ? 'border-ocean-400 bg-ocean-50 ring-2 ring-ocean-300' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input type="radio" name="cancelType" value="member" checked={cancelType === 'member'}
                        onChange={() => setCancelType('member')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-sm text-gray-800">👤 特定の乗船者だけキャンセル</div>
                        <div className="text-xs text-gray-500 mt-1">1名分だけキャンセルして残りの方は予約を継続します。船長の承認後に確定します。</div>

                        {cancelType === 'member' && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-bold text-gray-600">キャンセルする乗船者を選んでください：</p>
                            {selectedRes.members.filter(m => m.is_completed).map((m) => (
                              <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-all ${
                                selectedMemberId === m.id ? 'border-ocean-400 bg-ocean-50' : 'border-gray-200 bg-white'
                              }`}>
                                <input type="radio" name="memberId" value={m.id} checked={selectedMemberId === m.id}
                                  onChange={() => setSelectedMemberId(m.id)} />
                                <span className="font-medium">{m.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* グループ全員キャンセル */}
              <label className={`card cursor-pointer block transition-all ${cancelType === 'full' ? 'border-red-400 bg-red-50 ring-2 ring-red-300' : ''}`}>
                <div className="flex items-start gap-3">
                  <input type="radio" name="cancelType" value="full" checked={cancelType === 'full'}
                    onChange={() => { setCancelType('full'); setSelectedMemberId('') }} className="mt-1" />
                  <div>
                    <div className="font-bold text-sm text-gray-800">❌ グループ全員キャンセル</div>
                    <div className="text-xs text-gray-500 mt-1">予約全体をキャンセルします。船長の承認後に確定します。</div>
                  </div>
                </div>
              </label>
            </div>

            {/* 確認メッセージ */}
            {cancelType === 'member' && selectedMemberId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
                <p>「{selectedRes.members.find(m => m.id === selectedMemberId)?.name}」を乗船者から外します。</p>
                <p className="text-xs mt-1">この操作は即座に反映されます。</p>
              </div>
            )}
            {cancelType === 'full' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
                <p>グループ全員のキャンセルを申請します。船長の承認後に確定します。</p>
              </div>
            )}

            {submitError && <p className="error-text mb-3">{submitError}</p>}

            <button
              onClick={handleSubmit}
              disabled={submitting || (cancelType === 'member' && !selectedMemberId)}
              className="btn-danger"
            >
              {submitting ? '送信中...' : cancelType === 'member' ? 'この乗船者をキャンセルする' : 'キャンセルを申請する'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
