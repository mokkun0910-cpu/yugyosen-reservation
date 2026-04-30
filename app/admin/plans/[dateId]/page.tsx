'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa, formatPrice } from '@/lib/utils'

const emptyPlan = { name: '', target_fish: '', departure_time: '', price: '', capacity: '10' }

export default function AdminPlansPage() {
  const router = useRouter()
  const { dateId } = useParams<{ dateId: string }>()
  const [date, setDate] = useState('')
  const [plans, setPlans] = useState<any[]>([])
  const [form, setForm] = useState({ ...emptyPlan })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function fetchData() {
    const { data: d } = await supabase.from('departure_dates').select('date').eq('id', dateId).single()
    if (d) setDate(d.date)
    const { data: p } = await supabase.from('plans').select('*').eq('departure_date_id', dateId).order('departure_time')
    setPlans(p || [])
  }

  useEffect(() => { fetchData() }, [dateId])

  function getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-admin-password': sessionStorage.getItem('admin_pw') || '',
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (plans.length >= 5) { setError('1日に設定できるプランは最大5つです。'); return }
    if (!form.name || !form.target_fish || !form.departure_time || !form.price) {
      setError('すべての項目を入力してください。')
      return
    }

    setSaving(true)
    const res = await fetch('/api/admin/plans', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        departure_date_id: dateId,
        name: form.name,
        target_fish: form.target_fish,
        departure_time: form.departure_time,
        price: Number(form.price),
        capacity: Number(form.capacity),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError('プランの保存に失敗しました: ' + (data.error || '不明なエラー'))
      setSaving(false)
      return
    }

    setForm({ ...emptyPlan })
    setSuccess('プランを追加しました！')
    await fetchData()
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleDelete(id: string) {
    if (!confirm('このプランを削除しますか？')) return
    const res = await fetch('/api/admin/plans', {
      method: 'DELETE',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert('削除に失敗しました: ' + (data.error || '不明なエラー'))
      return
    }
    await fetchData()
  }

  return (
    <div className="p-4">
      <button onClick={() => router.back()} className="text-navy-600 text-sm mb-3 block hover:text-gold-500 transition-colors">
        ← 出船日一覧に戻る
      </button>

      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-5 bg-gold-500 rounded-full" />
        <h2 className="text-lg font-bold text-navy-700 font-serif">プラン設定</h2>
      </div>
      {date && (
        <p className="text-sm text-gray-500 mb-4 ml-3">{formatDateJa(date)}</p>
      )}

      {/* 登録済みプラン一覧 */}
      <div className="space-y-3 mb-6">
        {plans.length === 0 && (
          <div className="bg-cream-50 border border-dashed border-gray-300 rounded-xl text-center py-6 text-sm text-gray-400">
            プランがまだ登録されていません
          </div>
        )}
        {plans.map((p, i) => (
          <div key={p.id} className="bg-white rounded-xl border-l-4 border-gold-400 shadow-sm p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="font-bold text-navy-700 font-serif">プラン{i + 1}：{p.name}</div>
                <div className="text-sm text-gray-600">🐟 ターゲット：{p.target_fish}</div>
                <div className="text-sm text-gray-600">⏰ 出船時刻：{p.departure_time.slice(0, 5)}</div>
                <div className="text-sm font-bold text-gold-600">{formatPrice(p.price)} / 1名</div>
                <div className="text-sm text-gray-500">👥 定員：{p.capacity}名</div>
                {p.is_locked && (
                  <span className="inline-block text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">🔒 ロック中</span>
                )}
              </div>
              <button onClick={() => handleDelete(p.id)}
                className="text-xs text-red-500 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* プラン追加フォーム */}
      {plans.length < 5 ? (
        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-navy-700 text-white text-xs px-2 py-0.5 rounded font-bold">残り{5 - plans.length}枠</span>
            <p className="font-bold text-sm text-navy-700">新しいプランを追加</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">プラン名 <span className="text-red-500">*</span></label>
              <input className="input-field" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例：五目釣りプラン" />
            </div>
            <div>
              <label className="label">ターゲット魚種 <span className="text-red-500">*</span></label>
              <input className="input-field" value={form.target_fish}
                onChange={(e) => setForm({ ...form, target_fish: e.target.value })}
                placeholder="例：アジ・サバ・カサゴ" />
            </div>
            <div>
              <label className="label">出船時刻 <span className="text-red-500">*</span></label>
              <input className="input-field" type="time" value={form.departure_time}
                onChange={(e) => setForm({ ...form, departure_time: e.target.value })} />
            </div>
            <div>
              <label className="label">料金（円・1名あたり） <span className="text-red-500">*</span></label>
              <input className="input-field" type="number" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="例：5000" min="0" />
            </div>
            <div>
              <label className="label">定員</label>
              <select className="input-field" value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}名</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">高喜丸の最大定員は10名です</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                ⚠️ {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                ✅ {success}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '保存中...' : '＋ プランを追加する'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 text-center">
          プランは最大5つまでです。不要なプランを削除してから追加してください。
        </div>
      )}
    </div>
  )
}
