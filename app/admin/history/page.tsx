'use client'
import { useEffect, useState } from 'react'
type MonthStat = {
  year: number
  month: number
  label: string
  departureDays: number
  reservationCount: number
  totalMembers: number
  totalRevenue: number
}
type YearStat = {
  year: number
  departureDays: number
  reservationCount: number
  totalMembers: number
  totalRevenue: number
  months: MonthStat[]
}
export default function AdminHistoryPage() {
  const [years, setYears] = useState<YearStat[]>([])
  const [loading, setLoading] = useState(true)
  const [openYears, setOpenYears] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/admin/history', { headers: { 'Content-Type': 'application/json' } })
      .then(r => r.json())
      .then(d => {
        setYears(d.years || [])
        if (d.years && d.years.length > 0) {
          setOpenYears(new Set([d.years[0].year]))
        }
      })
      .finally(() => setLoading(false))
  }, [])
  function toggleYear(year: number) {
    setOpenYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
  }
  async function handleExport(year: number, month?: number) {
    const key = month ? `${year}-${month}` : `${year}`
    setDownloading(key)
    const params = new URLSearchParams({ year: String(year) })
    if (month) params.set('month', String(month))
    try {
      const res = await fetch(`/api/admin/export-monthly?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) { alert('エクスポートに失敗しました。'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      a.download = match ? decodeURIComponent(match[1]) : `乗船名簿_${key}.xlsx`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(null)
    }
  }
  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">読み込み中...</div>
  }
  if (years.length === 0) {
    return (
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">
          履歴データがありません
        </div>
      </div>
    )
  }
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-5 bg-gold-500 rounded-full" />
        <h2 className="text-lg font-bold text-navy-700 font-serif">予約履歴</h2>
      </div>
      {years.map(y => (
        <div key={y.year} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* 年ヘッダー */}
          <button className="w-full flex items-center justify-between px-4 py-4"
            onClick={() => toggleYear(y.year)}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-navy-700 font-bold text-base font-serif">{y.year}年</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                <span>🚢 {y.departureDays}日</span>
                <span>📋 {y.reservationCount}件</span>
                <span>👥 {y.totalMembers}名</span>
                {y.totalRevenue > 0 && (
                  <span className="text-green-700 font-bold">💴 {y.totalRevenue.toLocaleString()}円</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); handleExport(y.year) }}
                disabled={downloading === String(y.year)}
                className="text-xs bg-navy-700 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-navy-800 transition-colors disabled:opacity-50">
                {downloading === String(y.year) ? '...' : '📥 年間'}
              </button>
              <span className={`text-gray-400 text-sm transition-transform duration-200 ${openYears.has(y.year) ? 'rotate-180' : ''}`}>▼</span>
            </div>
          </button>
          {/* 月別一覧 */}
          {openYears.has(y.year) && (
            <div className="border-t border-gray-100">
              {y.months.map(m => (
                <div key={`${m.year}-${m.month}`}
                  className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-cream-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-navy-700 w-8">{m.month}月</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      <span>🚢 {m.departureDays}日</span>
                      <span>📋 {m.reservationCount}件</span>
                      <span>👥 {m.totalMembers}名</span>
                      {m.totalRevenue > 0 && (
                        <span className="text-green-700 font-semibold">💴 {m.totalRevenue.toLocaleString()}円</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleExport(m.year, m.month)}
                    disabled={downloading === `${m.year}-${m.month}`}
                    className="text-xs border border-navy-300 text-navy-700 px-3 py-1.5 rounded-lg font-medium hover:bg-navy-50 transition-colors disabled:opacity-50 shrink-0">
                    {downloading === `${m.year}-${m.month}` ? '...' : '📥 月別'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
