'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * LINEブラウザ経由のアクセス時にLINE User IDを取得（任意・失敗しても続行）
 * ※ 通常ブラウザからのアクセス時は空文字を返す（ログイン強制しない）
 */
async function tryGetLineUserId(): Promise<string> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  if (!liffId) return ''
  try {
    const liffModule = await import('@line/liff')
    const liff = liffModule.default
    await liff.init({ liffId })
    if (!liff.isLoggedIn()) {
      // LINEブラウザ外からのアクセスはLINEログインを強制しない
      // → 通常のフォームとして使えるようにする
      return ''
    }
    const profile = await liff.getProfile()
    return profile.userId
  } catch {
    return ''
  }
}

export default function MemberInputPage() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lineUserId, setLineUserId] = useState('')
  const [form, setForm] = useState({
    name: '', furigana: '', birth_date: '', address: '',
    phone: '', emergency_contact_name: '', emergency_contact_phone: '',
  })

  useEffect(() => {
    async function init() {
      // トークン確認とLIFF初期化を並列実行
      const [memberResult, userId] = await Promise.all([
        supabase
          .from('members')
          .select('is_completed')
          .eq('input_token', token)
          .single(),
        tryGetLineUserId(),
      ])

      if (userId) setLineUserId(userId)

      const { data } = memberResult
      if (!data) { setStatus('error'); return }
      if (data.is_completed) { setStatus('done'); return }
      setStatus('form')
    }
    init()
  }, [token])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const required = ['name', 'furigana', 'birth_date', 'address', 'phone', 'emergency_contact_name', 'emergency_contact_phone']
    for (const key of required) {
      if (!form[key as keyof typeof form]) {
        setError('すべての項目を入力してください。')
        return
      }
    }
    setLoading(true)
    setError('')

    const res = await fetch(`/api/member/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // line_user_id が取得できていれば一緒に送信
      body: JSON.stringify({ ...form, line_user_id: lineUserId || null }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'エラーが発生しました。'); setLoading(false); return }
    setStatus('done')
  }

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">読み込み中...</div>
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center">
          <div className="text-4xl mb-3">❌</div>
          <p className="text-gray-600">このリンクは無効です。</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="font-bold text-lg text-gray-800 mb-2">入力完了しました</h2>
          <p className="text-gray-500 text-sm">ご協力ありがとうございます。</p>
          {lineUserId && (
            <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-3">
              💬 LINEと連携しました。出航情報などをLINEでお知らせします。
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="page-header">
        <div className="font-bold text-lg">乗船者情報の入力</div>
        <div className="text-ocean-100 text-sm">あなた自身の情報を入力してください</div>
      </div>

      <div className="p-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          <p>この情報は乗船名簿として使用されます。すべての項目を正確に入力してください。</p>
        </div>

        {lineUserId && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700">
            💬 LINEと連携されました。入力後、出航情報などをLINEでお知らせします。
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">氏名 <span className="text-red-500">*</span></label>
            <input className="input-field" name="name" value={form.name} onChange={handleChange} placeholder="例：山田 太郎" />
          </div>
          <div>
            <label className="label">ふりがな <span className="text-red-500">*</span></label>
            <input className="input-field" name="furigana" value={form.furigana} onChange={handleChange} placeholder="例：やまだ たろう" />
          </div>
          <div>
            <label className="label">生年月日 <span className="text-red-500">*</span></label>
            <input className="input-field" name="birth_date" type="date" value={form.birth_date} onChange={handleChange} />
          </div>
          <div>
            <label className="label">住所 <span className="text-red-500">*</span></label>
            <input className="input-field" name="address" value={form.address} onChange={handleChange} placeholder="例：福岡県福岡市中央区〇〇1-2-3" />
          </div>
          <div>
            <label className="label">電話番号 <span className="text-red-500">*</span></label>
            <input className="input-field" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="例：090-1234-5678" />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-700 mb-3">緊急連絡先</p>
            <div className="space-y-3">
              <div>
                <label className="label">緊急連絡先 氏名 <span className="text-red-500">*</span></label>
                <input className="input-field" name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} placeholder="例：山田 花子（続柄：妻）" />
              </div>
              <div>
                <label className="label">緊急連絡先 電話番号 <span className="text-red-500">*</span></label>
                <input className="input-field" name="emergency_contact_phone" type="tel" value={form.emergency_contact_phone} onChange={handleChange} placeholder="例：090-9876-5432" />
              </div>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '送信中...' : '入力内容を送信する'}
          </button>
        </form>
      </div>
    </div>
  )
}
