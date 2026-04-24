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

  // コピー用の状態
  const [copySource, setCopySource] = useState<any | null>(null)
  const [copyTargetDate, setCopyTargetDate] = useState('')
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyError, setCopyError] = useState('')

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

  function openCopyModal(d: any) {
    setCopySource(d)
    setCopyTargetDate('')
    setCopyError('')
  }

  function closeCopyModal() {
    setCopySource(null)
    setCopyTargetDate('')
    setCopyError('')
  }

  async function handleCopy() {
    if (!copySource || !copyTargetDate) return
    setCopyLoading(true)
    setCopyError('')

    try {
      // 同じ日付がすでに存在するか確認（配列で取得してエラーを避ける）
      const { data: existingList } = await supabase
        .from('departure_dates')
        .select('id')
        .eq('date', copyTargetDate)

      let targetDateId: string

      if (existingList && existingList.length > 0) {
        targetDateId = existingList[0].id
      } else {
        // 新しい出船日を作成
        const { data: newDateData, error: dateError } = await supabase
          .from('departure_dates')
          .insert({ date: copyTargetDate, is_open: false })
          .select()
        if (dateError || !newDateData || newDateData.length === 0) {
          setCopyError('出船日の作成に失敗しました: ' + (dateError?.message || '不明なエラー'))
          setCopyLoading(false)
          return
        }
        targetDateId = newDateData[0].id
      }

      // 元の出船日のプランを取得
      const { data: sourcePlans, error: planFetchError } = await supabase
        .from('plans')
        .select('*')
        .eq('departure_date_id', copySource.id)

      if (planFetchError) {
        setCopyError('プランの取得に失敗しました: ' + planFetchError.message)
        setCopyLoading(false)
        return
      }

      if (!sourcePlans || sourcePlans.length === 0) {
        setCopyError('コピー元にプランがありません。先にプランを設定してください。')
        setCopyLoading(false)
        return
      }

      const newPlans = sourcePlans.map((p: any) => ({
        departure_date_id: targetDateId,
        name: p.name,
        target_fish: p.target_fish,
        departure_time: p.departure_time,
        capacity: p.capacity,
        price: p.price,
        is_locked: false,
      }))

      const { error: planInsertError } = await supabase.from('plans').insert(newPlans)
      if (planInsertError) {
        setCopyError('プランのコピーに失敗しました: ' + planInsertError.message)
        setCopyLoading(false)
        return
      }

      await fetchDates()
      closeCopyModal()
    } catch (e: any) {
      setCopyError('予期しないエラー: ' + (e?.message || String(e)))
    } finally {
      setCopyLoading(false)
    }
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
              <a href={`/api/admin/export?dateId=${d.id}`} download
                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium">
                📥 乗船名簿
              </a>
              <button onClick={() => openCopyModal(d)}
                className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg font-medium">
                📋 コピー作成
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

      {/* コピーモーダル */}
      {copySource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-1">出船日をコピー</h3>
            <p className="text-xs text-gray-500 mb-4">
              「{formatDateJa(copySource.date)}」の全プラン（{copySource.plans?.length || 0}件）を別の日付にコピーします
            </p>

            <label className="label">コピー先の日付</label>
            <input
              type="date"
              className="input-field mb-4"
              value={copyTargetDate}
              onChange={(e) => setCopyTargetDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />

            {copyError && <p className="text-xs text-red-500 mb-3">{copyError}</p>}

            <div className="flex gap-2">
              <button
                onClick={closeCopyModal}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleCopy}
                disabled={copyLoading || !copyTargetDate}
                className="flex-1 py-2 rounded-lg bg-ocean-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {copyLoading ? 'コピー中...' : 'コピーする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
