'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

export default function AdminDatesPage() {
  const router = useRouter()
  const [dates, setDates] = useState<any[]>([])
  const [newDate, setNewDate] = useState('')
  const [loading, setLoading] = useState(false)

  async function fetchDates() {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('departure_dates')
      .select('*, plans(id, name, is_locked)')
      .gte('date', today)
      .order('date')
    setDates(data || [])
  }

  useEffect(() => { fetchDates() }, [])

  async function handleAdd() {
    if (!newDate) return
    setLoading(true)
    await supabase.from('departure_dates').insert({ date: newDate, is_open: true })
    setNewDate('')
    await fetchDates()
    setLoading(false)
  }

  async function toggleOpen(id: string, current: boolean) {
    await supabase.from('departure_dates').update({ is_open: !current }).eq('id', id)
    await fetchDates()
  }

  async function handleDelete(id: string) {
    if (!confirm('この出船日を削除しますか？')) return
    await supabase.from('departure_dates').delete().eq('id', id)
    await fetchDates()
  }

  return (
    <div className="p-4">
      <h2 className="section-title mt-2">出船日の管理</h2>

      <div className="card mb-4">
        <p className="text-sm text-gray-600 mb-3">出船日を追加する</p>
        <div className="flex gap-2">
          <input type="date" className="input-field" value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)} />
          <button onClick={handleAdd} disabled={loading || !newDate}
            className="bg-ocean-600 text-white px-4 py-2 rounded-lg font-bold shrink-0 disabled:opacity-50">
            追加
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {dates.length === 0 && <div className="text-center text-gray-400 py-6">出船日がありません</div>}
        {dates.map((d) => (
          <div key={d.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-sm">{formatDateJa(d.date)}</div>
                <div className="text-xs text-gray-500">{d.plans?.length || 0}プラン設定済み</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  d.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {d.is_open ? '公開中' : '非公開'}
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => router.push(`/admin/plans/${d.id}`)}
                className="text-xs bg-ocean-50 text-ocean-700 border border-ocean-200 px-3 py-1.5 rounded-lg font-medium">
                プランを設定
              </button>
              <button onClick={() => toggleOpen(d.id, d.is_open)}
                className="text-xs bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg font-medium">
                {d.is_open ? '非公開にする' : '公開する'}
              </button>
              <button onClick={() => handleDelete(d.id)}
                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg font-medium">
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
