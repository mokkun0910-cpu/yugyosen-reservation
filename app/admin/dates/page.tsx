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

  // ã³ãã¼ç¨ã®ç¶æ
  const [copySource, setCopySource] = useState<any | null>(null)
  const [copyTargetDate, setCopyTargetDate] = useState('')
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyError, setCopyError] = useState('')

  // å¤©åä¸è¯ã­ã£ã³ã»ã«ç¨ã®ç¶æ
  const [weatherTarget, setWeatherTarget] = useState<any | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherResult, setWeatherResult] = useState<{ cancelled: number; notified: number; lineUsers?: number; errors?: string[] } | null>(null)

  // åºèªæ±ºå®éç¥ç¨ã®ç¶æ
  const [departureTarget, setDepartureTarget] = useState<any | null>(null)
  const [departureLoading, setDepartureLoading] = useState(false)
  const [departureResult, setDepartureResult] = useState<{ notified: number; total?: number; lineUsers?: number; errors?: string[] } | null>(null)

  // ãç¤¼ã¡ãã»ã¼ã¸éä¿¡ç¨ã®ç¶æ
  const [thankTarget, setThankTarget] = useState<any | null>(null)
  const [thankLoading, setThankLoading] = useState(false)
  const [thankResult, setThankResult] = useState<{ notified: number; total?: number; lineUsers?: number; errors?: string[] } | null>(null)

  function getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-admin-password': sessionStorage.getItem('admin_pw') || '',
    }
  }

  async function fetchDates() {
    // 7æ¥åããè¡¨ç¤ºï¼ãç¤¼éä¿¡ãªã©éå»æ¥ç¨ã¸ã®æä½ã®ããï¼
    const past7 = new Date()
    past7.setDate(past7.getDate() - 7)
    const fromDate = past7.toISOString().slice(0, 10)
    const { data } = await supabase
      .from('departure_dates')
      .select('*, plans(id, name, is_locked)')
      .gte('date', fromDate)
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
    if (!confirm('ãã®åºè¹æ¥ãåé¤ãã¾ããï¼')) return
    await supabase.from('departure_dates').delete().eq('id', id)
    await fetchDates()
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
      if (data.error) { alert('ã¨ã©ã¼: ' + data.error); return }
      setThankResult({ notified: data.notified, total: data.total, lineUsers: data.lineUsers, errors: data.errors })
    } catch (e: any) {
      setThankLoading(false)
      alert('éä¿¡ã¨ã©ã¼: ' + (e?.message || String(e)))
    }
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
      if (data.error) { alert('ã¨ã©ã¼: ' + data.error); return }
      setDepartureResult({ notified: data.notified, total: data.total, lineUsers: data.lineUsers, errors: data.errors })
    } catch (e: any) {
      setDepartureLoading(false)
      alert('éä¿¡ã¨ã©ã¼: ' + (e?.message || String(e)))
    }
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
      if (data.error) { alert('ã¨ã©ã¼: ' + data.error); return }
      setWeatherResult({ cancelled: data.cancelled, notified: data.notified, lineUsers: data.lineUsers, errors: data.errors })
      await fetchDates()
    } catch (e: any) {
      setWeatherLoading(false)
      alert('éä¿¡ã¨ã©ã¼: ' + (e?.message || String(e)))
    }
  }

  async function unlockPlans(dateId: string) {
    await supabase.from('plans').update({ is_locked: false }).eq('departure_date_id', dateId)
    await fetchDates()
    alert('ãã©ã³ã®ã­ãã¯ãè§£é¤ãã¾ããã')
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
      // åãæ¥ä»ããã§ã«å­å¨ãããç¢ºèªï¼éåã§åå¾ãã¦ã¨ã©ã¼ãé¿ããï¼
      const { data: existingList } = await supabase
        .from('departure_dates')
        .select('id')
        .eq('date', copyTargetDate)

      let targetDateId: string

      if (existingList && existingList.length > 0) {
        targetDateId = existingList[0].id
      } else {
        // æ°ããåºè¹æ¥ãä½æ
        const { data: newDateData, error: dateError } = await supabase
          .from('departure_dates')
          .insert({ date: copyTargetDate, is_open: false })
          .select()
        if (dateError || !newDateData || newDateData.length === 0) {
          setCopyError('åºè¹æ¥ã®ä½æã«å¤±æãã¾ãã: ' + (dateError?.message || 'ä¸æãªã¨ã©ã¼'))
          setCopyLoading(false)
          return
        }
        targetDateId = newDateData[0].id
      }

      // åã®åºè¹æ¥ã®ãã©ã³ãåå¾
      const { data: sourcePlans, error: planFetchError } = await supabase
        .from('plans')
        .select('*')
        .eq('departure_date_id', copySource.id)

      if (planFetchError) {
        setCopyError('ãã©ã³ã®åå¾ã«å¤±æãã¾ãã: ' + planFetchError.message)
        setCopyLoading(false)
        return
      }

      if (!sourcePlans || sourcePlans.length === 0) {
        setCopyError('ã³ãã¼åã«ãã©ã³ãããã¾ãããåã«ãã©ã³ãè¨­å®ãã¦ãã ããã')
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
        setCopyError('ãã©ã³ã®ã³ãã¼ã«å¤±æãã¾ãã: ' + planInsertError.message)
        setCopyLoading(false)
        return
      }

      await fetchDates()
      closeCopyModal()
    } catch (e: any) {
      setCopyError('äºæããªãã¨ã©ã¼: ' + (e?.message || String(e)))
    } finally {
      setCopyLoading(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="section-title mt-2">åºè¹æ¥ã®ç®¡ç</h2>

      <div className="card mb-4">
        <p className="text-sm text-gray-600 mb-3">åºè¹æ¥ãè¿½å ãã</p>
        <div className="flex gap-2">
          <input type="date" className="input-field" value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)} />
          <button onClick={handleAdd} disabled={loading || !newDate}
            className="bg-ocean-600 text-white px-4 py-2 rounded-lg font-bold shrink-0 disabled:opacity-50">
            è¿½å 
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {dates.length === 0 && <div className="text-center text-gray-400 py-6">åºè¹æ¥ãããã¾ãã</div>}
        {dates.map((d) => (
          <div key={d.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-sm">{formatDateJa(d.date)}</div>
                <div className="text-xs text-gray-500">{d.plans?.length || 0}ãã©ã³è¨­å®æ¸ã¿</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  d.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {d.is_open ? 'å¬éä¸­' : 'éå¬é'}
                </span>
              </div>
            </div>
            {/* éç¥ãã¿ã³ï¼ç®ç«ã¤å¤§ããï¼ */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button onClick={() => { setDepartureTarget(d); setDepartureResult(null) }}
                className="flex flex-col items-center justify-center gap-0.5 bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl">
                <span>â</span><span>åºèªæ±ºå®</span>
              </button>
              <button onClick={() => { setWeatherTarget(d); setWeatherResult(null) }}
                className="flex flex-col items-center justify-center gap-0.5 bg-orange-500 text-white text-xs font-bold py-2.5 rounded-xl">
                <span>âï¸</span><span>å¤©åä¸è¯</span>
              </button>
              <button onClick={() => { setThankTarget(d); setThankResult(null) }}
                className="flex flex-col items-center justify-center gap-0.5 bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl">
                <span>ð</span><span>ãç¤¼éä¿¡</span>
              </button>
            </div>
            {/* ãµãæä½ãã¿ã³ */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => router.push(`/admin/plans/${d.id}`)}
                className="text-xs bg-ocean-50 text-ocean-700 border border-ocean-200 px-3 py-1.5 rounded-lg font-medium">
                ãã©ã³ãè¨­å®
              </button>
              <a href={`/api/admin/export?dateId=${d.id}`} download
                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium">
                ð¥ ä¹è¹åç°¿
              </a>
              <button onClick={() => unlockPlans(d.id)}
                className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg font-medium">
                ð ã­ãã¯è§£é¤
              </button>
              <button onClick={() => openCopyModal(d)}
                className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg font-medium">
                ð ã³ãã¼ä½æ
              </button>
              <button onClick={() => toggleOpen(d.id, d.is_open)}
                className="text-xs bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg font-medium">
                {d.is_open ? 'éå¬éã«ãã' : 'å¬éãã'}
              </button>
              <button onClick={() => handleDelete(d.id)}
                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg font-medium">
                åé¤
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* åºèªæ±ºå®af] */}
      {departureTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {departureResult ? (
              <>
                <div className="mb-4">
                  <div className="text-center text-3xl mb-2">{departureResult.notified > 0 ? 'â' : 'â ï¸'}</div>
                  <h3 className="font-bold text-base mb-3 text-center">éä¿¡å®äº</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">äºç´ä»¶æ°</span><span className="font-bold">{departureResult.total ?? '-'}ä»¶</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">LINEç»é²æ¸ã¿</span><span className="font-bold">{departureResult.lineUsers ?? '-'}å</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">éä¿¡æå</span><span className={`font-bold ${departureResult.notified > 0 ? 'text-green-600' : 'text-red-500'}`}>{departureResult.notified}å</span></div>
                  </div>
                  {departureResult.lineUsers === 0 && (
                    <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded p-2">LINEã¢ããªçµç±ã§äºç´ããã¦ããã¾ããã</p>
                  )}
                  {departureResult.errors && departureResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                      {departureResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
                <button onClick={() => setDepartureTarget(null)}
                  className="w-full py-2 rounded-lg bg-ocean-600 text-white text-sm font-bold">
                  éãã
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">â åºèªæ±ºå®éç¥</h3>
                <p className="text-sm text-gray-600 mb-4">
                  ã{formatDateJa(departureTarget.date)}ãã®äºç´èå¨å¡ã«åºèªæ±ºå®ãLINEã§éç¥ãã¾ãã
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800">
                  <p className="font-bold mb-1">éä¿¡ãããã¡ãã»ã¼ã¸ï¼</p>
                  <p>â åºèªæ±ºå®ã®ãç¥ãã</p>
                  <p>ãæ¥ç¨ã{formatDateJa(departureTarget.date)}</p>
                  <p className="mt-1">ææ¥ã®åºèªãæ±ºå®ãããã¾ããããäºç´ããã ããããã¨ããããã¾ãã</p>
                  <p className="mt-1">ããããåè¡èæ§ãããã£ãããã¾ãããããææ°ã§ãããã¡ãã®æ¹ã¸ãå±æããã ãã¾ãã¨å¹¸ãã§ãã</p>
                  <p className="mt-1">å½æ¥çæ§ã®ãä¹è¹ããå¾ã¡ãã¦ããã¾ããð£ éæ¼è¹ çä¸¸</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDepartureTarget(null)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">
                    ã­ã£ã³ã»ã«
                  </button>
                  <button onClick={handleDepartureConfirm} disabled={departureLoading}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
                    {departureLoading ? 'éä¿¡ä¸­...' : 'éä¿¡ãã'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* å¤©åä¸è¯ã­ã£ã³ã»ã«ã¢ã¼ãã« */}
      {weatherTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {weatherResult ? (
              <>
                <div className="mb-4">
                  <div className="text-center text-3xl mb-2">{weatherResult.notified > 0 ? 'â' : 'â ï¸'}</div>
                  <h3 className="font-bold text-base mb-3 text-center">å¦çå®äº</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">ã­ã£ã³ã»ã«ä»¶æ°</span><span className="font-bold">{weatherResult.cancelled}ä»¶</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">LINEç»é²æ¸ã¿</span><span className="font-bold">{weatherResult.lineUsers ?? '-'}å</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">éä¿¡æå</span><span className={`font-bold ${weatherResult.notified > 0 ? 'text-green-600' : 'text-red-500'}`}>{weatherResult.notified}å</span></div>
                  </div>
                  {weatherResult.lineUsers === 0 && (
                    <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded p-2">LINEç»é²æ¸ã§äºç´ããã¦ããªãããéä¿¡ã§ãã¾ããã</p>
                  )}
                  {weatherResult.errors && weatherResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                      {weatherResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
                <button onClick={() => setWeatherTarget(null)}
                  className="w-full py-2 rounded-lg bg-ocean-600 text-white text-sm font-bold">
                  éãã
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">âï¸ å¤©åä¸è¯ã­ã£ã³ã»ã«</h3>
                <p className="text-sm text-gray-600 mb-4">
                  ã{formatDateJa(weatherTarget.date)}ãã®å¨äºç´ãã­ã£ã³ã»ã«ããLINEç»é²æ¸ã¿ã®ãå®¢ããã«ä¸æéç¥ãã¾ãã
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-xs text-orange-800">
                  <p className="font-bold mb-1">éä¿¡ãããã¡ãã»ã¼ã¸ï¼</p>
                  <p>â ï¸ åºè¹ä¸­æ­¢ã®ãç¥ãã</p>
                  <p>ãæ¥ç¨ã{formatDateJa(weatherTarget.date)}</p>
                  <p>ãçç±ãå¤©åä¸è¯ã®ãã</p>
                  <p className="mt-1">èª ã«ç³ãè¨³ãããã¾ããããå½æ¥ã®åºè¹ãä¸­æ­¢ã¨ããã¦ããã ãã¾ãã</p>
                  <p className="mt-1">ããããåè¡èæ§ãããã£ãããã¾ãããããææ°ã§ãããã¡ãã®æ¹ã¸ãå±æããã ãã¾ãã¨å¹¸ãã§ãã</p>
                  <p className="mt-1">ã¾ãã®ãäºç´ããå¾ã¡ãã¦ããã¾ããð£ éæ¼è¹ çä¸¸</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWeatherTarget(null)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">
                    ã­ã£ã³ã»ã«
                  </button>
                  <button onClick={handleWeatherCancel} disabled={weatherLoading}
                    className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-50">
                    {weatherLoading ? 'éä¿¡ä¸­...' : 'éä¿¡ãã'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ãç¤¼ã¡ãã»ã¼ã¸ã¢ã¼ãã« */}
      {thankTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {thankResult ? (
              <>
                <div className="mb-4">
                  <div className="text-center text-3xl mb-2">{thankResult.notified > 0 ? 'â' : 'â ï¸'}</div>
                  <h3 className="font-bold text-base mb-3 text-center">éä¿¡å®äº</h3>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">äºç´ä»¶æ°</span><span className="font-bold">{thankResult.total ?? '-'}ä»¶</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">LINEç»é²æ¸ã¿</span><span className="font-bold">{thankResult.lineUsers ?? '-'}å</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">éä¿¡æå</span><span className={`font-bold ${thankResult.notified > 0 ? 'text-green-600' : 'text-red-500'}`}>{thankResult.notified}å</span></div>
                  </div>
                  {thankResult.lineUsers === 0 && (
                    <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded p-2">LINEã¢ããªçµç±ã§äºç´ããã¦ããªãããéä¿¡ã§ãã¾ããã</p>
                  )}
                  {thankResult.errors && thankResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                      {thankResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
                <button onClick={() => setThankTarget(null)}
                  className="w-full py-2 rounded-lg bg-ocean-600 text-white text-sm font-bold">
                  éãã
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">ð ãç¤¼ã¡ãã»ã¼ã¸éä¿¡</h3>
                <p className="text-sm text-gray-600 mb-4">
                  ã{formatDateJa(thankTarget.date)}ãã®ä¹è¹èå¨å¡ã«ãç¤¼ã¡ãã»ã¼ã¸ãLINEã§éä¿¡ãã¾ãã
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-800">
                  <p className="font-bold mb-1">éä¿¡ãããã¡ãã»ã¼ã¸ï¼</p>
                  <p>æ¨æ¥ã¯ãä¹è¹ããã ããããã¨ããããã¾ããï¼ð£</p>
                  <p className="mt-1">ãæ¥ç¨ã{formatDateJa(thankTarget.date)}</p>
                  <p className="mt-1">æ¥½ããã§ããã ãã¾ããã§ããããï¼ã¾ãã®ãä¹è¹ããå¾ã¡ãã¦ããã¾ãã</p>
                  <p className="mt-1">é£æã®ãåçãªã©ã¤ã³ã¹ã¿ã°ã©ã ã§ãç´¹ä»ãã¦ããã¾ãã®ã§ããããããã°ãã©ã­ã¼ãã ããð¸</p>
                  <p className="mt-1">ã¾ããä¼ãã§ããæ¥ãæ¥½ãã¿ã«ãã¦ãã¾ãï¼ð£ éæ¼è¹ çä¸¸</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setThankTarget(null)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">
                    ã­ã£ã³ã»ã«
                  </button>
                  <button onClick={handleThankYou} disabled={thankLoading}
                    className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50">
                    {thankLoading ? 'éä¿¡ä¸­...' : 'éä¿¡ãã'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ã³ãã¼ã¢ã¼ãã« */}
      {copySource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-1">åºè¹æ¥ãã³ãã¼</h3>
            <p className="text-xs text-gray-500 mb-4">
              ã{formatDateJa(copySource.date)}ãã®å¨ãã©ã³ï¼{copySource.plans?.length || 0}ä»¶ï¼ãå¥ã®æ¥ä»ã«ã³ãã¼ãã¾ã
            </p>

            <label className="label">ã³ãã¼åã®æ¥ä»</label>
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
                ã­ã£ã³ã»ã«
              </button>
              <button
                onClick={handleCopy}
                disabled={copyLoading || !copyTargetDate}
                className="flex-1 py-2 rounded-lg bg-ocean-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {copyLoading ? 'ã³ãã¼ä¸­...' : 'ã³ãã¼ãã'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
