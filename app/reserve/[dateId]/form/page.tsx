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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.birth_date || !form.address || !form.emergency_contact_name || !form.emergency_contact_phone) {
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
    <div className="min-h-screen">
      <div className="page-header">
        <button onClick={() => router.back()} className="text-ocean-200 text-sm mb-1 block">
          ← 戻る
        </button>
        <div className="font-bold text-lg">予約情報の入力</div>
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

          {/* 代表者情報 */}
          <div className="border-b border-gray-100 pb-4">
            <p className="text-sm font-bold text-gray-700 mb-3">📋 代表者情報</p>
            <div className="space-y-3">
              <div>
                <label className="label">氏名 <span className="text-red-500">*</span></label>
                <input className="input-field" name="name" value={form.name} onChange={handleChange} placeholder="例：山田 太郎" required />
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
