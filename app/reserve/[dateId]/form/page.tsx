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

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.birth_date || !form.address || !form.emergency_contact_name || !form.emergency_contact_phone) {
      setError('ãã¹ã¦ã®å¿é é ç®ãå¥åãã¦ãã ããã')
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
      setError(data.error || 'äºç´ã®éä¿¡ã«å¤±æãã¾ããã')
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
          â æ»ã
        </button>
        <div className="font-bold text-lg">äºç´æå ±ã®å¥å</div>
      </div>

      <div className="p-4">
        <div className="card mb-4 bg-ocean-50 border-ocean-200">
          <div className="text-sm text-gray-600">
            <span className="font-bold text-ocean-800">é¸æãã©ã³ï¼</span>{planName}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            <span className="font-bold text-ocean-800">åå äººæ°ï¼</span>{members}å
          </div>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">

          {/* ä»£è¡¨èæå ± */}
          <div className="border-b border-gray-100 pb-4">
            <p className="text-sm font-bold text-gray-700 mb-3">ð ä»£è¡¨èæå ±</p>
            <div className="space-y-3">
              <div>
                <label className="label">æ°å <span className="text-red-500">*</span></label>
                <input className="input-field" name="name" value={form.name} onChange={handleChange} placeholder="ä¾ï¼å±±ç° å¤ªé" required />
              </div>
              <div>
                <label className="label">é»è©±çªå· <span className="text-red-500">*</span></label>
                <input className="input-field" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="ä¾ï¼090-1234-5678" required />
              </div>
              {isLinked ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  â LINEã¢ã«ã¦ã³ãã¨é£æºæ¸ã¿ã§ãã
                </div>
              ) : (
                <div>
                  <label className="label">
                    LINE ã¦ã¼ã¶ã¼ID
                    <span className="text-gray-400 text-xs ml-1">ï¼ä»»æï¼</span>
                  </label>
                  <input className="input-field" name="lineUserId" value={form.lineUserId} onChange={handleChange} placeholder="LINEã®ã¦ã¼ã¶ã¼ID" />
                  <p className="text-xs text-gray-400 mt-1">â» å¬å¼LINEããäºç´ããã¨èªåã§é£æºããã¾ã</p>
                </div>
              )}
            </div>
          </div>

          {/* ä»£è¡¨èã®ä¹è¹èæå ± */}
          <div className="border-b border-gray-100 pb-4">
            <p className="text-sm font-bold text-gray-700 mb-3">ð¢ ä»£è¡¨èã®ä¹è¹æå ±</p>
            <div className="space-y-3">
              <div>
                <label className="label">çå¹´ææ¥ <span className="text-red-500">*</span></label>
                <input className="input-field" name="birth_date" type="date" value={form.birth_date} onChange={handleChange} required />
              </div>
              <div>
                <label className="label">ä½æ <span className="text-red-500">*</span></label>
                <input className="input-field" name="address" value={form.address} onChange={handleChange} placeholder="ä¾ï¼ç¦å²¡çç¦å²¡å¸ä¸­å¤®åºãã1-2-3" required />
              </div>
            </div>
          </div>

          {/* ç·æ¥é£çµ¡å */}
          <div className="pb-2">
            <p className="text-sm font-bold text-gray-700 mb-3">ð ç·æ¥é£çµ¡å</p>
            <div className="space-y-3">
              <div>
                <label className="label">æ°å <span className="text-red-500">*</span></label>
                <input className="input-field" name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} placeholder="ä¾ï¼å±±ç° è±å­ï¼ç¶æï¼å¦»ï¼" required />
              </div>
              <div>
                <label className="label">é»è©±çªå· <span className="text-red-500">*</span></label>
                <input className="input-field" name="emergency_contact_phone" type="tel" value={form.emergency_contact_phone} onChange={handleChange} placeholder="ä¾ï¼090-9876-5432" required />
              </div>
            </div>
          </div>

          {members > 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-bold mb-1">ð¥ åè¡èã«ã¤ãã¦</p>
              <p>äºç´å®äºå¾ãåè¡è{members - 1}ååã®æå ±å¥åãªã³ã¯ãè¡¨ç¤ºããã¾ããåèªã«ãªã³ã¯ããéããã ããã</p>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'éä¿¡ä¸­...' : 'äºç´ãéä¿¡ãã'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ReserveFormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">èª­ã¿è¾¼ã¿ä¸­...</div>}>
      <ReserveFormContent />
    </Suspense>
  )
}
