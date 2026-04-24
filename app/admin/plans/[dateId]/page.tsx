'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa, formatPrice } from '@/lib/utils'

const emptyPlan = { name: '', target_fish: '', departure_time: '', price: '', capacity: '8' }

export default function AdminPlansPage() {
  const router = useRouter()
  const { dateId } = useParams<{ dateId: string }>()
  const [date, setDate] = useState('')
  const [plans, setPlans] = useState<any[]>([])
  const [form, setForm] = useState({ ...emptyPlan })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchData() {
    const { data: d } = await supabase.from('departure_dates').select('date').eq('id', dateId).single()
    if (d) setDate(d.date)
    const { data: p } = await supabase.from('plans').select('*').eq('departure_date_id', dateId).order('departure_time')
    setPlans(p || [])
  }

  useEffect(() => { fetchData() }, [dateId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (plans.length >= 5) { setError('1日に設定できるプランは最大5つです。'); return }
    if (!form.name || !form.target_fish || !form.departure_time || !form.price) {
      setError('すべての項目を入力してください。'); return
    }
    setSaving(true)
    setError('')
    await supabase.from('plans').insert({
      departure_date_id: dateId,
      name: form.name,
      target_fish: form.target_fish,
      departure_time: form.departure_time,
      price: Number(form.price),
      capacity: Number(form.capacity),
      is_locked: false,
    })
    setForm({ ...emptyPlan })
    await fetchData()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('このプランを削除しますか？')) return
    await supabase.from('plans').delete().eq('id', id)
    await fetchData()
  }

  return (
    <div className="p-4">
      <button onClick={() => router.back()} className="text-ocean-600 text-sm mb-3 block">← 出船日一覧に戻る</button>
      <h2 className="section-title">プラン設定</h2>
      {date && <p className="text-sm text-gray-500 mb-4">{formatDateJa(date)}</p>}

      <div className="space-y-3 mb-6">
        {plans.length === 0 && <div className="text-center text-gray-400 py-4 text-sm">プランがまだありません</div>}
        {plans.map((p, i) => (
          <div key={p.id} className="card border-l-4 border-ocean-400">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">プラン{i + 1}：{p.name}</div>
                <div className="text-sm text-gray-600">🐟 {p.target_fish}</div>
                <div className="text-sm text-gray-600">⏰ {p.departure_time.slice(0, 5)} 出船</div>
                <div className="text-sm text-ocean-700 font-bold">{formatPrice(p.price)} / 1名</div>
                <div className="text-sm text-gray-500">定員 {p.capacity}名</div>
              </div>
              <button onClick={() => handleDelete(p.id)}
                className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded">
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      {plans.length < 5 && (
        <form onSubmit={handleAdd} className="card">
          <p className="font-bold text-sm mb-3">プランを追加する（残り{5 - plans.length}枠）</p>
          <div className="space-y-3">
            <div>
              <label className="label">プラン名</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：タイラバプラン" />
            </div>
            <div>
              <label className="label">ターゲット（魚種）</label>
              <input className="input-field" value={form.target_fish} onChange={(e) => setForm({ ...form, target_fish: e.target.value })} placeholder="例：真鯛" />
            </div>
            <div>
              <label className="label">出船時刻</label>
              <input className="input-field" type="time" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} />
            </div>
            <div>
              <label className="label">料金（円）</label>
              <input className="input-field" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="例：15000" />
            </div>
            <div>
              <label className="label">定員（名）</label>
              <select className="input-field" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })}>
                {[6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}名</option>)}
              </select>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '保存中...' : 'プランを追加する'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
