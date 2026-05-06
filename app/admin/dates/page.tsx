'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa, formatPrice } from '@/lib/utils'
const emptyPlanForm = { name: '', target_fish: '', departure_time: '', price: '', capacity: '10' }
export default function AdminDatesPage() {
  const router = useRouter()
  const [dates, setDates] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [members, setMembers] = useState<Record<string, any[]>>({})
  const [openDateIds, setOpenDateIds] = useState<Set<string>>(new Set())
  const [expandedRes, setExpandedRes] = useState<string | null>(null)
  const [addingPlanForDate, setAddingPlanForDate] = useState<string | null>(null)
  const [planForms, setPlanForms] = useState<Record<string, typeof emptyPlanForm>>({})
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({})
  const [savingPlan, setSavingPlan] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const initializedRef = useRef(false)
  const [newDate, setNewDate] = useState('')
  const [addingDate, setAddingDate] = useState(false)
  const [departureTarget, setDepartureTarget] = useState<any | null>(null)
  const [departureLoading, setDepartureLoading] = useState(false)
  const [departureResult, setDepartureResult] = useState<any | null>(null)
  const [weatherTarget, setWeatherTarget] = useState<any | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherResult, setWeatherResult] = useState<any | null>(null)
  const [thankTarget, setThankTarget] = useState<any | null>(null)
  const [thankLoading, setThankLoading] = useState(false)
  const [thankResult, setThankResult] = useState<any | null>(null)
  const [weatherConfirmed, setWeatherConfirmed] = useState(false)
  const [departureResend, setDepartureResend] = useState(false)
  const [thankResend, setThankResend] = useState(false)
  const [copySource, setCopySource] = useState<any | null>(null)
  const [copyTargetDate, setCopyTargetDate] = useState('')
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyError, setCopyError] = useState('')
  function getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    }
  }
  async function loadAll() {
    const past7 = new Date()
    past7.setDate(past7.getDate() - 7)
    const fromDate = past7.toISOString().slice(0, 10)
    const { data: datesData } = await supabase
      .from('departure_dates')
      .select('*, plans(id, name, target_fish, departure_time, price, capacity, is_locked)')
      .gte('date', fromDate)
      .order('date')
    const resJson = await fetch('/api/admin/reservations', {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    }).then(r => r.json())
    const dateList = (datesData || []).map((d: any) => ({
      ...d,
      plans: (d.plans || []).sort((a: any, b: any) =>
        a.departure_time < b.departure_time ? -1 : 1
      ),
    }))
    setDates(dateList)
    setReservations(resJson.reservations || [])
    if (!initializedRef.current) {
      initializedRef.current = true
      const today = new Date().toISOString().slice(0, 10)
      const next = dateList.find((d: any) => d.date >= today)
      if (next) setOpenDateIds(new Set([next.id]))
    }
  }
  useEffect(() => { loadAll() }, [])
  function toggleDateId(id: string) {
    setOpenDateIds(prev => {
      const next = new Set(Array.from(prev))
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function getResForPlan(planId: string) {
    return reservations.filter(r => r.plan_id === planId)
  }
  function dateSummary(d: any) {
    const plans = d.plans || []
    let resCount = 0
    let memberCount = 0
    for (const p of plans) {
      const rs = getResForPlan(p.id)
      resCount += rs.length
      memberCount += rs.reduce((s: number, r: any) => s + (r.total_members || 0), 0)
    }
    return { planCount: plans.length, resCount, memberCount }
  }
  async function loadMembers(resId: string) {
    if (members[resId]) {
      setExpandedRes(expandedRes === resId ? null : resId)
      return
    }
    const { data } = await supabase.from('members').select('*').eq('reservation_id', resId).order('id')
    setMembers(prev => ({ ...prev, [resId]: data || [] }))
    setExpandedRes(resId)
  }
  async function handleCancel(r: any) {
    const label = `${r.representative_name}（${r.reservation_number}）`
    if (!confirm(`「${label}」の予約をキャンセルしますか？\n乗船名簿からも削除されます。`)) return
    setCancelling(r.id)
    const res = await fetch('/api/admin/cancel-reservation', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ reservationId: r.id }),
    })
    const data = await res.json()
    setCancelling(null)
    if (!res.ok) { alert('キャンセルに失敗しました: ' + (data.error || '不明なエラー')); return }
    await loadAll()
  }
  async function handleAddPlan(dateId: string) {
    const form = planForms[dateId] || { ...emptyPlanForm }
    if (!form.name || !form.target_fish || !form.departure_time || !form.price) {
      setPlanErrors(prev => ({ ...prev, [dateId]: 'すべての項目を入力してください。' }))
      return
    }
    setSavingPlan(dateId)
    setPlanErrors(prev => ({ ...prev, [dateId]: '' }))
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
    setSavingPlan(null)
    if (!res.ok) {
      setPlanErrors(prev => ({ ...prev, [dateId]: data.error || '不明なエラー' }))
      return
    }
    setPlanForms(prev => ({ ...prev, [dateId]: { ...emptyPlanForm } }))
    setAddingPlanForDate(null)
    await loadAll()
  }
  async function handleDeletePlan(id: string) {
    if (!confirm('このプランを削除しますか？')) return
    const res = await fetch('/api/admin/plans', {
      method: 'DELETE',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) { alert('削除に失敗しました: ' + (data.error || '不明なエラー')); return }
    await loadAll()
  }
  async function handleAddDate() {
    if (!newDate) return
    setAddingDate(true)
    const res = await fetch('/api/admin/dates', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ date: newDate }),
    })
    const data = await res.json()
    setAddingDate(false)
    if (!res.ok) { alert('追加に失敗しました: ' + (data.error || '不明なエラー')); return }
    setNewDate('')
    await loadAll()
  }
  async function handleDeleteDate(id: string) {
    if (!confirm('この出船日を削除しますか？\nプランも全て削除されます。')) return
    const res = await fetch('/api/admin/dates', {
      method: 'DELETE',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (!res.ok) { alert('削除に失敗しました: ' + (data.error || '不明なエラー')); return }
    setOpenDateIds(prev => { const s = new Set(Array.from(prev)); s.delete(id); return s })
    await loadAll()
  }
  async function toggleOpen(id: string, current: boolean) {
    const res = await fetch('/api/admin/dates', {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id, is_open: !current }),
    })
    if (!res.ok) { const data = await res.json(); alert('更新に失敗しました: ' + (data.error || '')); return }
    await loadAll()
  }
  async function unlockPlans(dateId: string) {
    const res = await fetch('/api/admin/plans', {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ departure_date_id: dateId }),
    })
    if (!res.ok) { const data = await res.json(); alert('ロック解除に失敗しました: ' + (data.error || '')); return }
    await loadAll()
  }
  async function handleDepartureConfirm() {
    if (!departureTarget) return
    setDepartureLoading(true)
    try {
      const res = await fetch('/api/admin/departure-confirm', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ dateId: departureTarget.id }),
      })
      const data = await res.json()
      setDepartureLoading(false)
      if (data.error) { alert('エラー: ' + data.error); return }
      setDepartureResult({ notified: data.notified, total: data.total, lineUsers: data.lineUsers, errors: data.errors })
    } catch (e: any) { setDepartureLoading(false); alert('通信エラー: ' + (e?.message || String(e))) }
  }
  async function handleWeatherCancel() {
    if (!weatherTarget) return
    setWeatherLoading(true)
    try {
      const res = await fetch('/api/admin/weather-cancel', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ dateId: weatherTarget.id }),
      })
      const data = await res.json()
      setWeatherLoading(false)
      if (data.error) { alert('エラー: ' + data.error); return }
      setWeatherResult({ cancelled: data.cancelled, notified: data.notified, lineUsers: data.lineUsers, errors: data.errors })
      await loadAll()
    } catch (e: any) { setWeatherLoading(false); alert('通信エラー: ' + (e?.message || String(e))) }
  }
  async function handleThankYou() {
    if (!thankTarget) return
    setThankLoading(true)
    try {
      const res = await fetch('/api/admin/thank-you', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ dateId: thankTarget.id }),
      })
      const data = await res.json()
      setThankLoading(false)
      if (data.error) { alert('エラー: ' + data.error); return }
      setThankResult({ notified: data.notified, total: data.total, lineUsers: data.lineUsers, errors: data.errors })
    } catch (e: any) { setThankLoading(false); alert('通信エラー: ' + (e?.message || String(e))) }
  }
  async function handleCopy() {
    if (!copySource || !copyTargetDate) return
    setCopyLoading(true)
    setCopyError('')
    try {
      const res = await fetch('/api/admin/dates/copy', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ sourceDateId: copySource.id, targetDate: copyTargetDate }),
      })
      const data = await res.json()
      if (!res.ok) { setCopyError(data.error || '不明なエラー'); return }
      await loadAll()
      setCopySource(null)
    } catch (e: any) { setCopyError('予期しないエラー: ' + (e?.message || String(e))) }
    finally { setCopyLoading(false) }
  }
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mt-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gold-500 rounded-full" />
          <h2 className="text-lg font-bold text-navy-700 font-serif">
            予約管理
            <span className="text-sm font-normal text-gray-400 ml-2">({dates.length}件)</span>
          </h2>
        </div>
        <button onClick={loadAll}
          className="text-xs bg-white text-navy-700 border border-navy-200 px-3 py-1.5 rounded-lg hover:bg-cream-50 transition-colors">
          🔄 更新
        </button>
      </div>
      {/* 出船日追加 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <p className="text-sm font-bold text-navy-700 mb-3">新しい出船日を追加</p>
        <div className="flex gap-2">
          <input type="date" className="input-field" value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={today} />
          <button onClick={handleAddDate} disabled={addingDate || !newDate}
            className="bg-navy-700 text-white px-4 py-2 rounded-lg font-bold shrink-0 disabled:opacity-50 hover:bg-navy-800 transition-colors">
            追加
          </button>
        </div>
      </div>
      {/* 通知未送信アラート */}
      {(() => {
        const todayJst = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10)
        const tomorrowJst = new Date(Date.now() + 9*60*60*1000 + 86400000).toISOString().slice(0,10)
        const unnotified = dates.filter(d => {
          const { resCount } = dateSummary(d)
          return (d.date === todayJst || d.date === tomorrowJst)
            && resCount > 0
            && !d.departure_notified_at
            && !d.weather_notified_at
        })
        if (unnotified.length === 0) return null
        return (
          <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-lg">🔔</span>
              <div>
                <p className="font-bold text-orange-800 text-sm">通知が未送信の日程があります</p>
                <p className="text-xs text-orange-700 mt-0.5">以下の日程に予約が入っていますが、出航通知・天候キャンセル通知がまだ送信されていません。</p>
              </div>
            </div>
            <div className="space-y-2">
              {unnotified.map(d => {
                const todayJstCheck = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10)
                const tomorrowJstCheck = new Date(Date.now() + 9*60*60*1000 + 86400000).toISOString().slice(0,10)
                const label = d.date === todayJstCheck ? '今日' : d.date === tomorrowJstCheck ? '明日' : ''
                const { resCount } = dateSummary(d)
                return (
                  <div key={d.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-orange-200">
                    <div>
                      <span className="text-xs font-bold text-orange-700 mr-2">{label}</span>
                      <span className="text-sm font-bold text-navy-700">{formatDateJa(d.date)}</span>
                      <span className="text-xs text-gray-500 ml-2">予約{resCount}件</span>
                    </div>
                    <button
                      onClick={() => { setDepartureTarget(d); setDepartureResult(null) }}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shrink-0">
                      通知を送る
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
      {dates.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 text-center py-10 text-gray-400 text-sm">
          出船日がありません
        </div>
      )}
      {/* 出船日リスト */}
      <div className="space-y-3">
        {dates.map((d) => {
          const isPast = d.date < today
          const isOpen = openDateIds.has(d.id)
          const { planCount, resCount, memberCount } = dateSummary(d)
          const plans = d.plans || []
          return (
            <div key={d.id} className="mb-2">
              {/* 日付ヘッダー */}
              <button
                onClick={() => toggleDateId(d.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1 transition-colors ${
                  isPast ? 'bg-gray-100 text-gray-500' : 'bg-navy-700 text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{isPast ? '📁' : '📅'}</span>
                  <div className="text-left">
                    <div className={`font-bold font-serif text-sm ${isPast ? 'text-gray-600' : 'text-white'}`}>
                      {formatDateJa(d.date)}
                      <span className={`ml-2 text-xs font-normal ${isPast ? 'text-gray-400' : 'text-navy-200'}`}>
                        {d.is_open ? '🟢 公開中' : '⚫ 非公開'}
                      </span>
                    </div>
                    <div className={`text-xs mt-0.5 ${isPast ? 'text-gray-400' : 'text-navy-200'}`}>
                      {planCount}プラン　／　予約{resCount}件　／　計{memberCount}名
                    </div>
                  </div>
                </div>
                <span className={`text-sm ${isPast ? 'text-gray-400' : 'text-navy-200'}`}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>
              {/* 展開パネル */}
              {isOpen && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                  {/* LINE通知ボタン */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button onClick={() => { setDepartureTarget(d); setDepartureResult(null) }}
                      className={`flex flex-col items-center justify-center gap-0.5 text-white text-xs font-bold py-2.5 rounded-xl ${d.departure_notified_at ? 'bg-blue-400' : 'bg-blue-600'}`}>
                      <span>⚓</span><span>出航決定</span>
                      {d.departure_notified_at && <span className="text-xs opacity-80">✓送信済</span>}
                    </button>
                    <button onClick={() => { setWeatherTarget(d); setWeatherResult(null) }}
                      className={`flex flex-col items-center justify-center gap-0.5 text-white text-xs font-bold py-2.5 rounded-xl ${d.weather_notified_at ? 'bg-orange-300' : 'bg-orange-500'}`}>
                      <span>⛈️</span><span>天候不良</span>
                      {d.weather_notified_at && <span className="text-xs opacity-80">✓送信済</span>}
                    </button>
                    <button onClick={() => { setThankTarget(d); setThankResult(null) }}
                      className={`flex flex-col items-center justify-center gap-0.5 text-white text-xs font-bold py-2.5 rounded-xl ${d.thankyou_notified_at ? 'bg-green-400' : 'bg-green-600'}`}>
                      <span>🙏</span><span>お礼送信</span>
                      {d.thankyou_notified_at && <span className="text-xs opacity-80">✓送信済</span>}
                    </button>
                  </div>
                  {/* サブ操作 */}
                  <div className="flex gap-2 flex-wrap mb-4">
                    <a href={`/api/admin/export?dateId=${d.id}`} download
                      className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium">
                      📥 乗船名簿
                    </a>
                    <a href={`/admin/dates/${d.id}/roster`} target="_blank"
                      className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg font-medium">
                      🖨️ 印刷用名簿
                    </a>
                    <button onClick={() => router.push('/admin/reservations/new')}
                      className="text-xs bg-navy-50 text-navy-700 border border-navy-200 px-3 py-1.5 rounded-lg font-medium">
                      📞 電話予約
                    </button>
                    <button onClick={() => toggleOpen(d.id, d.is_open)}
                      className="text-xs bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg font-medium">
                      {d.is_open ? '非公開にする' : '公開する'}
                    </button>
                    <button onClick={() => unlockPlans(d.id)}
                      className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg font-medium">
                      🔓 ロック解除
                    </button>
                    <button onClick={() => { setCopySource(d); setCopyTargetDate(''); setCopyError('') }}
                      className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg font-medium">
                      📋 コピー
                    </button>
                    <button onClick={() => handleDeleteDate(d.id)}
                      className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg font-medium">
                      削除
                    </button>
                  </div>
                  {/* プラン一覧 */}
                  {plans.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg mb-3">
                      プランがまだ登録されていません
                    </div>
                  )}
                  <div className="space-y-3 mb-3">
                    {plans.map((plan: any) => {
                      const planRes = getResForPlan(plan.id)
                      const bookedCount = planRes.reduce((s: number, r: any) => s + (r.total_members || 0), 0)
                      return (
                        <div key={plan.id} className="border border-gray-200 rounded-xl overflow-hidden">
                          {/* プランヘッダー */}
                          <div className="bg-navy-50 px-3 py-2.5 flex items-start justify-between">
                            <div className="space-y-0.5">
                              <div className="font-bold text-sm text-navy-700">
                                {plan.name}
                                {plan.is_locked && (
                                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">🔒</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                🐟 {plan.target_fish}　⏰ {plan.departure_time.slice(0, 5)}　{formatPrice(plan.price)}/名
                              </div>
                              <div className="text-xs text-gray-500">
                                👥 定員{plan.capacity}名　／　予約{bookedCount}名
                                {bookedCount >= plan.capacity && (
                                  <span className="ml-1 text-red-500 font-bold">（満員）</span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => handleDeletePlan(plan.id)}
                              className="text-xs text-red-500 border border-red-200 bg-white px-2 py-1 rounded-lg hover:bg-red-50 shrink-0">
                              削除
                            </button>
                          </div>
                          {/* このプランの予約一覧 */}
                          <div className="divide-y divide-gray-100">
                            {planRes.length === 0 && (
                              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                                予約はまだありません
                              </div>
                            )}
                            {planRes.map((r: any) => (
                              <div key={r.id} className="px-3 py-2.5">
                                <div className="flex items-start justify-between mb-1.5">
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-sm text-navy-700">{r.representative_name}</div>
                                    <div className="text-xs text-gray-400">{r.reservation_number}</div>
                                    <div className="text-xs text-gray-600">👥 {r.total_members}名　📞 {r.representative_phone}</div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                      r.status === 'confirmed'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {r.status === 'confirmed' ? '✓ 確定' : '⏳ 入力待ち'}
                                    </span>
                                    <button
                                      onClick={() => handleCancel(r)}
                                      disabled={cancelling === r.id}
                                      className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-lg hover:bg-red-100 disabled:opacity-50">
                                      {cancelling === r.id ? '処理中…' : 'キャンセル'}
                                    </button>
                                  </div>
                                </div>
                                {/* LINE通知バッジ */}
                                {(() => {
                                  const dd = r.plans?.departure_dates
                                  const hasLine = !!r.line_user_id
                                  const badges = [
                                    { label: '⚓出航決定', sent: dd?.departure_notified_at },
                                    { label: '⛈天候不良', sent: dd?.weather_notified_at },
                                    { label: '🙏お礼', sent: dd?.thankyou_notified_at },
                                  ].filter(b => b.sent)
                                  if (badges.length === 0) return null
                                  return (
                                    <div className="flex flex-wrap gap-1 mb-1.5">
                                      {badges.map(b => (
                                        <span key={b.label} className={`text-xs px-2 py-0.5 rounded-full ${
                                          hasLine
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : 'bg-gray-100 text-gray-400 border border-gray-200'
                                        }`}>
                                          {b.label} {hasLine ? '✓送信済' : '未連携'}
                                        </span>
                                      ))}
                                    </div>
                                  )
                                })()}
                                {/* 乗船者名簿 */}
                                <button
                                  onClick={() => loadMembers(r.id)}
                                  className="text-xs text-navy-600 border border-navy-200 bg-navy-50 px-3 py-1.5 rounded-lg w-full hover:bg-navy-100 transition-colors">
                                  {expandedRes === r.id ? '乗船者名簿を閉じる ▲' : '乗船者名簿を見る ▼'}
                                </button>
                                {expandedRes === r.id && members[r.id] && (
                                  <div className="mt-2 space-y-2">
                                    {members[r.id].map((m, i) => (
                                      <div key={m.id} className={`rounded-lg p-3 text-xs ${m.is_completed ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}>
                                        <div className="font-bold mb-1 text-navy-700">
                                          {m.is_completed ? '✅' : '⏳'} 乗船者 {i + 1}
                                        </div>
                                        {m.is_completed ? (
                                          <div className="space-y-0.5 text-gray-600">
                                            <div>氏名：{m.name}</div>
                                            <div>生年月日：{m.birth_date}</div>
                                            <div>住所：{m.address}</div>
                                            <div>電話：{m.phone}</div>
                                            <div>緊急連絡先：{m.emergency_contact_name}（{m.emergency_contact_phone}）</div>
                                          </div>
                                        ) : (
                                          <div className="text-yellow-700 space-y-1.5">
                                            <div>情報入力待ち</div>
                                            {m.input_token && (
                                              <button
                                                onClick={() => {
                                                  const url = `${window.location.origin}/member/${m.input_token}`
                                                  navigator.clipboard.writeText(url)
                                                  alert('入力リンクをコピーしました')
                                                }}
                                                className="text-xs bg-yellow-100 border border-yellow-300 px-2 py-1 rounded text-yellow-800 hover:bg-yellow-200"
                                              >
                                                📋 入力リンクをコピー
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* プラン追加 */}
                  {plans.length < 5 ? (
                    addingPlanForDate === d.id ? (
                      <div className="border border-navy-200 rounded-xl p-3">
                        <p className="text-sm font-bold text-navy-700 mb-3">
                          ＋ プランを追加
                          <span className="ml-2 text-xs font-normal text-gray-400">残り{5 - plans.length}枠</span>
                        </p>
                        <div className="space-y-2">
                          <div>
                            <label className="label">プラン名 <span className="text-red-500">*</span></label>
                            <input className="input-field" placeholder="例：五目釣りプラン"
                              value={(planForms[d.id] || emptyPlanForm).name}
                              onChange={e => setPlanForms(prev => ({ ...prev, [d.id]: { ...(prev[d.id] || emptyPlanForm), name: e.target.value } }))} />
                          </div>
                          <div>
                            <label className="label">ターゲット魚種 <span className="text-red-500">*</span></label>
                            <input className="input-field" placeholder="例：アジ・サバ・カサゴ"
                              value={(planForms[d.id] || emptyPlanForm).target_fish}
                              onChange={e => setPlanForms(prev => ({ ...prev, [d.id]: { ...(prev[d.id] || emptyPlanForm), target_fish: e.target.value } }))} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label">出船時刻 <span className="text-red-500">*</span></label>
                              <input className="input-field" type="time"
                                value={(planForms[d.id] || emptyPlanForm).departure_time}
                                onChange={e => setPlanForms(prev => ({ ...prev, [d.id]: { ...(prev[d.id] || emptyPlanForm), departure_time: e.target.value } }))} />
                            </div>
                            <div>
                              <label className="label">定員</label>
                              <select className="input-field"
                                value={(planForms[d.id] || emptyPlanForm).capacity}
                                onChange={e => setPlanForms(prev => ({ ...prev, [d.id]: { ...(prev[d.id] || emptyPlanForm), capacity: e.target.value } }))}>
                                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}名</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="label">料金（円・1名あたり） <span className="text-red-500">*</span></label>
                            <input className="input-field" type="number" placeholder="例：5000" min="0"
                              value={(planForms[d.id] || emptyPlanForm).price}
                              onChange={e => setPlanForms(prev => ({ ...prev, [d.id]: { ...(prev[d.id] || emptyPlanForm), price: e.target.value } }))} />
                          </div>
                          {planErrors[d.id] && (
                            <p className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {planErrors[d.id]}</p>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => setAddingPlanForDate(null)}
                              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">
                              キャンセル
                            </button>
                            <button onClick={() => handleAddPlan(d.id)} disabled={savingPlan === d.id}
                              className="flex-1 py-2 text-sm bg-navy-700 text-white rounded-lg font-bold disabled:opacity-50">
                              {savingPlan === d.id ? '保存中...' : '追加する'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingPlanForDate(d.id)}
                        className="w-full py-2.5 text-sm border-2 border-dashed border-navy-200 text-navy-600 rounded-xl hover:bg-navy-50 transition-colors font-medium">
                        ＋ プランを追加（残り{5 - plans.length}枠）
                      </button>
                    )
                  ) : (
                    <div className="text-center text-xs text-gray-400 py-2">プランは最大5つです</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* 出航決定通知モーダル */}
      {departureTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {departureResult ? (
              <>
                <div className="mb-4">
                  <div className="text-center text-3xl mb-2">{departureResult.notified > 0 ? '✅' : '⚠️'}</div>
                  <h3 className="font-bold text-base mb-3 text-center">送信完了</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">予約件数</span><span className="font-bold">{departureResult.total ?? '-'}件</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">LINE登録済み</span><span className="font-bold">{departureResult.lineUsers ?? '-'}名</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">送信成功</span><span className={`font-bold ${departureResult.notified > 0 ? 'text-green-600' : 'text-red-500'}`}>{departureResult.notified}名</span></div>
                  </div>
                  {departureResult.lineUsers === 0 && <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded p-2">LINEアプリ経由で予約されていないため送信できません。</p>}
                  {departureResult.errors?.length > 0 && <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{departureResult.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}</div>}
                </div>
                <button onClick={() => { setDepartureTarget(null); setDepartureResend(false) }} className="w-full py-2 rounded-lg bg-navy-600 text-white text-sm font-bold">閉じる</button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">⚓ 出航決定通知</h3>
                <p className="text-sm text-gray-600 mb-4">「{formatDateJa(departureTarget.date)}」の予約者全員に出航決定をLINEで通知します。</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800">
                  <p className="font-bold mb-1">送信されるメッセージ：</p>
                  <p>⚓ 出航決定のお知らせ</p>
                  <p>【日程】{formatDateJa(departureTarget.date)}</p>
                  <p className="mt-1">明日の出航が決定いたしました。ご予約いただきありがとうございます。</p>
                  <p className="mt-1">当日皆様のご乗船をお待ちしております。🎣 遊漁船 高喜丸</p>
                </div>
                {departureTarget?.departure_notified_at && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 text-xs text-yellow-800">
                    <p className="font-bold mb-2">⚠️ この日程はすでに出航決定通知が送信済みです。再送すると重複して届きます。</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={departureResend} onChange={e => setDepartureResend(e.target.checked)} className="w-4 h-4" />
                      <span>それでも再送する</span>
                    </label>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setDepartureTarget(null); setDepartureResend(false) }} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">キャンセル</button>
                  <button onClick={handleDepartureConfirm} disabled={departureLoading || (!!departureTarget?.departure_notified_at && !departureResend)} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{departureLoading ? '送信中...' : '送信する'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* 天候不良キャンセルモーダル */}
      {weatherTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {weatherResult ? (
              <>
                <div className="mb-4">
                  <div className="text-center text-3xl mb-2">{weatherResult.notified > 0 ? '✅' : '⚠️'}</div>
                  <h3 className="font-bold text-base mb-3 text-center">処理完了</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">キャンセル件数</span><span className="font-bold">{weatherResult.cancelled}件</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">LINE登録済み</span><span className="font-bold">{weatherResult.lineUsers ?? '-'}名</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">送信成功</span><span className={`font-bold ${weatherResult.notified > 0 ? 'text-green-600' : 'text-red-500'}`}>{weatherResult.notified}名</span></div>
                  </div>
                  {weatherResult.errors?.length > 0 && <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{weatherResult.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}</div>}
                </div>
                <button onClick={() => { setWeatherTarget(null); setWeatherConfirmed(false) }} className="w-full py-2 rounded-lg bg-navy-600 text-white text-sm font-bold">閉じる</button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">⛈️ 天候不良キャンセル</h3>
                <p className="text-sm text-gray-600 mb-4">「{formatDateJa(weatherTarget.date)}」の全予約をキャンセルし、LINE登録済みのお客さんに一斉通知します。</p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-xs text-orange-800">
                  <p className="font-bold mb-1">送信されるメッセージ：</p>
                  <p>⚠️ 出船中止のお知らせ</p>
                  <p>【日程】{formatDateJa(weatherTarget.date)}</p>
                  <p className="mt-1">天候不良のため当日の出船を中止とさせていただきます。</p>
                  <p className="mt-1">またのご予約をお待ちしております。🎣 遊漁船 高喜丸</p>
                </div>
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4 text-xs text-red-800">
                  <p className="font-bold mb-2">⚠️ この操作は取り消せません。全予約がキャンセルされ、乗船名簿のデータも削除されます。</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={weatherConfirmed} onChange={e => setWeatherConfirmed(e.target.checked)} className="w-4 h-4" />
                    <span>上記を理解しました</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setWeatherTarget(null); setWeatherConfirmed(false) }} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">キャンセル</button>
                  <button onClick={handleWeatherCancel} disabled={weatherLoading || !weatherConfirmed} className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-50">{weatherLoading ? '送信中...' : '送信する'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* お礼メッセージモーダル */}
      {thankTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {thankResult ? (
              <>
                <div className="mb-4">
                  <div className="text-center text-3xl mb-2">{thankResult.notified > 0 ? '✅' : '⚠️'}</div>
                  <h3 className="font-bold text-base mb-3 text-center">送信完了</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">予約件数</span><span className="font-bold">{thankResult.total ?? '-'}件</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">LINE登録済み</span><span className="font-bold">{thankResult.lineUsers ?? '-'}名</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">送信成功</span><span className={`font-bold ${thankResult.notified > 0 ? 'text-green-600' : 'text-red-500'}`}>{thankResult.notified}名</span></div>
                  </div>
                  {thankResult.errors?.length > 0 && <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{thankResult.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}</div>}
                </div>
                <button onClick={() => { setThankTarget(null); setThankResend(false) }} className="w-full py-2 rounded-lg bg-navy-600 text-white text-sm font-bold">閉じる</button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">🙏 お礼メッセージ送信</h3>
                <p className="text-sm text-gray-600 mb-4">「{formatDateJa(thankTarget.date)}」の乗船者全員にお礼メッセージをLINEで送信します。</p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-800">
                  <p className="font-bold mb-1">送信されるメッセージ：</p>
                  <p>昨日はご乗船いただきありがとうございました！🎣</p>
                  <p className="mt-1">またのご乗船をお待ちしております。遊漁船 高喜丸</p>
                </div>
                {thankTarget?.thankyou_notified_at && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 text-xs text-yellow-800">
                    <p className="font-bold mb-2">⚠️ この日程はすでにお礼メッセージが送信済みです。再送すると重複して届きます。</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={thankResend} onChange={e => setThankResend(e.target.checked)} className="w-4 h-4" />
                      <span>それでも再送する</span>
                    </label>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setThankTarget(null); setThankResend(false) }} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">キャンセル</button>
                  <button onClick={handleThankYou} disabled={thankLoading || (!!thankTarget?.thankyou_notified_at && !thankResend)} className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50">{thankLoading ? '送信中...' : '送信する'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* コピーモーダル */}
      {copySource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-1">出船日をコピー</h3>
            <p className="text-xs text-gray-500 mb-4">
              「{formatDateJa(copySource.date)}」の全プラン（{copySource.plans?.length || 0}件）を別の日付にコピーします
            </p>
            <label className="label">コピー先の日付</label>
            <input type="date" className="input-field mb-2" value={copyTargetDate}
              onChange={(e) => { setCopyTargetDate(e.target.value); setCopyError('') }} min={today} />
            {/* すでにプランがある日付を選択した場合の警告 */}
            {copyTargetDate && (() => {
              const existing = dates.find(d => d.date === copyTargetDate)
              if (existing && existing.plans && existing.plans.length > 0) {
                return (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-700">
                    ⚠️ この日付にはすでに {existing.plans.length} 件のプランが登録されています。<br />
                    別の日付を選択してください。
                  </div>
                )
              }
              if (existing) {
                return (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-xs text-yellow-700">
                    ℹ️ この日付はすでに出船日として登録されています（プランなし）。コピーするとプランが追加されます。
                  </div>
                )
              }
              return <div className="mb-3" />
            })()}
            {copyError && <p className="text-xs text-red-500 mb-3">⚠️ {copyError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setCopySource(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">キャンセル</button>
              <button
                onClick={handleCopy}
                disabled={copyLoading || !copyTargetDate || !!(copyTargetDate && dates.find(d => d.date === copyTargetDate)?.plans?.length > 0)}
                className="flex-1 py-2 rounded-lg bg-navy-600 text-white text-sm font-bold disabled:opacity-50">
                {copyLoading ? 'コピー中...' : 'コピーする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
