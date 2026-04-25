'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

function ReserveFormContent() {
  const router = useRouter()
  const { dateId } = useParams<{ dateId: string }>()
  const searchParams = useSearchParams()
  const planId = searchParams.get('planId') || ''
  const planName = searchParams.get('planName') || ''
  const members = Number(searchParams.get('members') || 1)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    lineUserId: '',
  })
  const [liffReady, setLiffReady] = useState(false)
  const [isInLiff, setIsInLiff] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) return

    import('@line/liff').then((liffModule) => {
      const liff = liffModule.default
      liff.init({ liffId }).then(() => {
        setLiffReady(true)
        if (liff.isInClient() && liff.isLoggedIn()) {
          setIsInLiff(true)
          liff.getProfile().then((profile) => {
            setForm((prev) => ({ ...prev, lineUserId: profile.userId }))
          }).catch(() => {
            // プロフィール取得失敗は無視
          })
        }
      }).catch(() => {
        setLiffReady(true)
      })
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone) {
      setError('氏名と電話番号は必須です。')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        representativeName: form.name,
        representativePhone: form.phone,
        lineUserId: form.lineUserId,
        totalMembers: members,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || '予約の送信に失敗しました。')
      setLoading(false)
      return
    }
    router.push(
      `/complete?reservationNumber=${data.reservationNumber}&planName=${encodeURIComponent(planName)}&members=${members}`
    )
  }

  return (
    <div className="min-h-screen">
      <div className="page-header">
        <button onClick={() => router.back()} className="text-ocean-200 text-sm mb-1 block">
          ← 戻る
        </button>
        <div className="font-bold text-lg">代表者情報の入力</div>
      </div>

      <div className="p-4">
        <div className="card mb-4 bg-ocean-50 border-ocean-200">
          <div className="text-sm text-gray-600">
            <span className="font-bold text-ocean-800">選択プラン：</span>{planName}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            <span className="font-bold text-ocean-800">参加人数：</span>{members}名
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">代表者氏名 <span className="text-red-500">*</span></label>
            <input
              className="input-field"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="例：山田 太郎"
              required
            />
          </div>

          <div>
            <label className="label">電話番号 <span className="text-red-500">*</span></label>
            <input
              className="input-field"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="例：090-1234-5678"
              required
            />
          </div>

          {/* LINEアプリ内なら自動取得・表示のみ。ブラウザからは手入力欄を表示 */}
          {isInLiff ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              ✅ LINEアカウントと連携済みです。出航情報などをLINEでお届けします。
            </div>
          ) : (
            <div>
              <label className="label">
                LINE ユーザーID
                <span className="text-gray-400 text-xs ml-1">（任意・通知を受け取る場合）</span>
              </label>
              <input
                className="input-field"
                name="lineUserId"
                value={form.lineUserId}
                onChange={handleChange}
                placeholder="LINEのユーザーID"
              />
              <p className="text-xs text-gray-400 mt-1">
                ※ 公式LINEから予約すると自動で連携されます
              </p>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="pt-2">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
              <p className="font-bold mb-1">⚠️ 次のステップについて</p>
              <p>予約送信後、同行者の方々それぞれに個人情報入力リンクが送られます。全員が入力すると予約が確定します。</p>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '送信中...' : '予約を送信する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ReserveFormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">読み込み中...</div>}>
      <ReserveFormContent />
    </Suspense>
  )
}
