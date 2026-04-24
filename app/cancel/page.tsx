'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelPage() {
  const router = useRouter()
  const [reservationNumber, setReservationNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reservationNumber.trim()) {
      setError('予約番号を入力してください。')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationNumber: reservationNumber.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'エラーが発生しました。'); setLoading(false); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center">
          <div className="text-5xl mb-3">📨</div>
          <h2 className="font-bold text-lg text-gray-800 mb-2">キャンセル申請を受け付けました</h2>
          <p className="text-gray-500 text-sm mb-4">船長が確認後、LINEでご連絡します。</p>
          <button className="btn-secondary" onClick={() => router.push('/')}>トップに戻る</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="page-header">
        <button onClick={() => router.back()} className="text-ocean-200 text-sm mb-1 block">← 戻る</button>
        <div className="font-bold text-lg">キャンセル申請</div>
      </div>

      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
          <p>キャンセルは船長の承認後に確定します。予約番号を入力してください。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">予約番号 <span className="text-red-500">*</span></label>
            <input
              className="input-field"
              value={reservationNumber}
              onChange={(e) => setReservationNumber(e.target.value)}
              placeholder="例：YU-20240501-A3F2"
            />
            <p className="text-xs text-gray-400 mt-1">予約完了時にLINEで届いた番号です</p>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn-danger" disabled={loading}>
            {loading ? '送信中...' : 'キャンセルを申請する'}
          </button>
        </form>
      </div>
    </div>
  )
}
