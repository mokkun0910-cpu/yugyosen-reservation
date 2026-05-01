'use client'
import { Suspense, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

function ReserveFormContent() {
  const router = useRouter()
  const { dateId } = useParams<{ dateId: string }>()
  const searchParams = useSearchParams()
  const planId = searchParams.get('planId') || ''
  const planName = searchParams.get('planName') || ''
  const members = Number(searchParams.get('members') || 1)
  const lineUserIdFromUrl = searchParams.get('lineUserId') || ''

  const [form, setForm] = useState({
    name: '',
    furigana: '',
    phone: '',
    lineUserId: lineUserIdFromUrl,
    birth_date: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isLinked = !!lineUserIdFromUrl

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.furigana || !form.phone || !form.birth_date || !form.address || !form.emergency_contact_name || !form.emergency_contact_phone) {
      setError('すべての必須項目を入力してください。')
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
        representativeFurigana: form.furigana,
        representativePhone: form.phone,
        lineUserId: form.lineUserId,
        totalMembers: members,
        representativeBirthDate: form.birth_date,
        representativeAddress: form.address,
        representativeEmergencyName: form.emergency_contact_name,
        representativeEmergencyPhone: form.emergency_contact_phone,
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
    <div className="min-h-screen bg-cream-50">
      <div className="bg-navy-700 text-white px-4 py-4">
        <button onClick={() => router.back()} className="text-navy-200 text-sm mb-2 block hover:text-gold-400 transition-colors">
          ← 戻る
        </button>
        <div className="font-bold text-lg font-serif tracking-wide">予約情報の入力</div>
        <p className="text-navy-300 text-xs mt-0.5">遊漁船 高喜丸 ｜ 割烹旅館たかよし</p>
      </div>
      <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />

      <div className="p-4">
        <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-700">
            <span className="font-bold text-navy-700">選択プラン：</span>{planName}
          </div>
          <div className="text-sm text-gray-700 mt-1">
            <span className="font-bold text-navy-700">参加人数：</span>{members}名
          </div>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">

          {/* 代表者情報 */}
          <div className="border-b border-gray-100 pb-4">
            <p className="text-sm font-bold text-gray-700 mb-3">📋 代表者情報</p>
            <div className="space-y-3">
              <div>
                <label className="label">氏名 <span className="text-red-500">*</span></label>
                <input className="input-field" name="name" value={form.name} onChange={handleChange} placeholder="例：山田 太郎" required />
              </div>
              <div>
                <label className="label">ふりがな <span className="text-red-500">*</span></label>
                <input className="input-field" name="furigana" value={form.furigana} onChange={handleChange} placeholder="例：やまだ たろう" required />
              </div>
              <div>
                <label className="label">電話番号 <span className="text-red-500">*</span></label>
                <input className="input-field" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="例：090-1234-5678" required />
              </div>
              {isLinked ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  ✅ LINEアカウントと連携済みです。
                </div>
              ) : (
                <div>
                  <label className="label">
                    LINE ユーザーID
                    <span className="text-gray-400 text-xs ml-1">（任意）</span>
                  </label>
                  <input className="input-field" name="lineUserId" value={form.lineUserId} onChange={handleChange} placeholder="LINEのユーザーID" />
                  <p className="text-xs text-gray-400 mt-1">※ 公式LINEから予約すると自動で連携されます</p>
                </div>
              )}
            </div>
          </div>

          {/* 代表者の乗船者情報 */}
          <div className="border-b border-gray-100 pb-4">
            <p className="text-sm font-bold text-gray-700 mb-3">🚢 代表者の乗船情報</p>
            <div className="space-y-3">
              <div>
                <label className="label">生年月日 <span className="text-red-500">*</span></label>
                <input className="input-field" name="birth_date" type="date" value={form.birth_date} onChange={handleChange} required />
              </div>
              <div>
                <label className="label">住所 <span className="text-red-500">*</span></label>
                <input className="input-field" name="address" value={form.address} onChange={handleChange} placeholder="例：福岡県福岡市中央区〇〇1-2-3" required />
              </div>
            </div>
          </div>

          {/* 緊急連絡先 */}
          <div className="pb-2">
            <p className="text-sm font-bold text-gray-700 mb-3">🆘 緊急連絡先</p>
            <div className="space-y-3">
              <div>
                <label className="label">氏名 <span className="text-red-500">*</span></label>
                <input className="input-field" name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} placeholder="例：山田 花子（続柄：妻）" required />
              </div>
              <div>
                <label className="label">電話番号 <span className="text-red-500">*</span></label>
                <input className="input-field" name="emergency_contact_phone" type="tel" value={form.emergency_contact_phone} onChange={handleChange} placeholder="例：090-9876-5432" required />
              </div>
            </div>
          </div>

          {members > 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-bold mb-1">👥 同行者について</p>
              <p>予約完了後、同行者{members - 1}名分の情報入力リンクが表示されます。各自にリンクをお送りください。</p>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="pt-2">
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
