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

  // 天候不良キャンセル用の状態
  const [weatherTarget, setWeatherTarget] = useState<any | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherResult, setWeatherResult] = useState<{ cancelled: number; notified: number; lineUsers?: number; errors?: string[] } | null>(null)

  // 出航決定通知用の状態
  const [departureTarget, setDepartureTarget] = useState<any | null>(null)
  const [departureLoading, setDepartureLoading] = useState(false)
  const [departureResult, setDepartureResult] = useState<{ notified: number; total?: number; lineUsers?: number; errors?: string[] } | null>(null)

  // お礼メッセージ送信用の状態
  const [thankTarget, setThankTarget] = useState<any | null>(null)
  const [thankLoading, setThankLoading] = useState(false)
  const [thankResult, setThankResult] = useState<{ notified: number; total?: number; lineUsers?: number; errors?: string[] } | null>(null)

  async function fetchDates() {
    // 7日前から表示（お礼送信など過去日程への操作のため）
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
    if (!confirm('この出船日を削除しますか？')) return
    await supabase.from('departure_dates').delete().eq('id', id)
    await fetchDates()
  }

  async function handleThankYou() {
    if (!thankTarget) return
    setThankLoading(true)
    const res = await fetch('/api/admin/thank-you', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateId: thankTarget.id }),
    })
    const data = await res.json()
    setThankLoading(false)
    if (data.error) {
      alert('エラー: ' + data.error)
      return
    }
    setThankResult({ notified: data.notified, total: data.total, lineUsers: data.lineUsers, errors: data.errors })
  }

  async function handleDepartureConfirm() {
    if (!departureTarget) return
    setDepartureLoading(true)
    const res = await fetch('/api/admin/departure-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateId: departureTarget.id }),
    })
    const data = await res.json()
    setDepartureLoading(false)
    if (data.error) {
      alert('エラー: ' + data.error)
      return
    }
    setDepartureResult({ notified: data.notified, total: data.total, lineUsers: data.lineUsers, errors: data.errors })
  }

  async function handleWeatherCancel() {
    if (!weatherTarget) return
    setWeatherLoading(true)
    const res = await fetch('/api/admin/weather-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateId: weatherTarget.id }),
    })
    const data = await res.json()
    setWeatherLoading(false)
    if (data.error) {
      alert('エラー: ' + data.error)
      return
    }
    setWeatherResult({ cancelled: data.cancelled, notified: data.notified, lineUsers: data.lineUsers, errors: data.errors })
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
            {/* 通知ボタン（目立つ大きめ） */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button onClick={() => { setDepartureTarget(d); setDepartureResult(null) }}
                className="flex flex-col items-center justify-center gap-0.5 bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl">
                <span>⚓</span><span>出航決定</span>
              </button>
              <button onClick={() => { setWeatherTarget(d); setWeatherResult(null) }}
                className="flex flex-col items-center justify-center gap-0.5 bg-orange-500 text-white text-xs font-bold py-2.5 rounded-xl">
                <span>⛈️</span><span>天候不良</span>
              </button>
              <button onClick={() => { setThankTarget(d); setThankResult(null) }}
                className="flex flex-col items-center justify-center gap-0.5 bg-green-600 text-white text-xs font-bold py-2.5 rounded-xl">
                <span>🙏</span><span>お礼送信</span>
              </button>
            </div>
            {/* サブ操作ボタン */}
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

      {/* 出航決定通知モーダル */}
      {departureTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            {departureResult ? (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">{departureResult.notified > 0 ? '✅' : '⚠️'}</div>
                  <h3 className="font-bold text-base mb-1">送信完了</h3>
                  <p className="text-sm text-gray-600">{departureResult.notified}名にLINEで通知しました。</p>
                  {departureResult.total !== undefined && departureResult.lineUsers !== undefined && departureResult.lineUsers < departureResult.total && (
                    <p className="text-xs text-gray-400 mt-1">（予約{departureResult.total}件中、LINE登録済み{departureResult.lineUsers}名）</p>
                  )}
                  {departureResult.errors && departureResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 text-left bg-red-50 rounded p-2">
                      {departureResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
                <button onClick={() => setDepartureTarget(null)}
                  className="w-full py-2 rounded-lg bg-ocean-600 text-white text-sm font-bold">
                  閉じる
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">⚓ 出航決定通知</h3>
                <p className="text-sm text-gray-600 mb-4">
                  「{formatDateJa(departureTarget.date)}」の予約者全員に出航決定をLINEで通知します。
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800">
                  <p className="font-bold mb-1">送信されるメッセージ：</p>
                  <p>⚓ 出航決定のお知らせ</p>
                  <p>【日程】{formatDateJa(departureTarget.date)}</p>
                  <p className="mt-1">明日の出航が決定いたしました。ご予約いただきありがとうございます。</p>
                  <p className="mt-1">もし、ご同行者様がいらっしゃいましたら、お手数ですがそちらの方へも共有いただけますと幸いです。</p>
                  <p className="mt-1">当日皆様のご乗船をお待ちしております。🎣 遊漁船 王丸</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDepartureTarget(null)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">
                    キャンセル
                  </button>
                  <button onClick={handleDepartureConfirm} disabled={departureLoading}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
                    {departureLoading ? '送信中...' : '送信する'}
                  </button>
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
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">{weatherResult.notified > 0 ? '✅' : '⚠️'}</div>
                  <h3 className="font-bold text-base mb-1">処理完了</h3>
                  <p className="text-sm text-gray-600">
                    {weatherResult.cancelled}件の予約をキャンセルし、<br />
                    {weatherResult.notified}名にLINEで通知しました。
                  </p>
                  {weatherResult.lineUsers !== undefined && weatherResult.lineUsers < weatherResult.cancelled && (
                    <p className="text-xs text-gray-400 mt-1">（LINE登録済み{weatherResult.lineUsers}名に送信）</p>
                  )}
                  {weatherResult.errors && weatherResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 text-left bg-red-50 rounded p-2">
                      {weatherResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
                <button onClick={() => setWeatherTarget(null)}
                  className="w-full py-2 rounded-lg bg-ocean-600 text-white text-sm font-bold">
                  閉じる
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">⛈️ 天候不良キャンセル</h3>
                <p className="text-sm text-gray-600 mb-4">
                  「{formatDateJa(weatherTarget.date)}」の全予約をキャンセルし、LINE登録済みのお客さんに一斉通知します。
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-xs text-orange-800">
                  <p className="font-bold mb-1">送信されるメッセージ：</p>
                  <p>⚠️ 出船中止のお知らせ</p>
                  <p>【日程】{formatDateJa(weatherTarget.date)}</p>
                  <p>【理由】天候不良のため</p>
                  <p className="mt-1">誠に申し訳ございませんが、当日の出船を中止とさせていただきます。</p>
                  <p className="mt-1">もし、ご同行者様がいらっしゃいましたら、お手数ですがそちらの方へも共有いただけますと幸いです。</p>
                  <p className="mt-1">またのご予約をお待ちしております。🎣 遊漁船 王丸</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWeatherTarget(null)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">
                    キャンセル
                  </button>
                  <button onClick={handleWeatherCancel} disabled={weatherLoading}
                    className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold disabled:opacity-50">
                    {weatherLoading ? '送信中...' : '送信する'}
                  </button>
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
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">{thankResult.notified > 0 ? '✅' : '⚠️'}</div>
                  <h3 className="font-bold text-base mb-1">送信完了</h3>
                  <p className="text-sm text-gray-600">{thankResult.notified}名にLINEでお礼メッセージを送信しました。</p>
                  {thankResult.total !== undefined && thankResult.lineUsers !== undefined && thankResult.lineUsers < thankResult.total && (
                    <p className="text-xs text-gray-400 mt-1">（予約{thankResult.total}件中、LINE登録済み{thankResult.lineUsers}名）</p>
                  )}
                  {thankResult.errors && thankResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 text-left bg-red-50 rounded p-2">
                      {thankResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
                <button onClick={() => setThankTarget(null)}
                  className="w-full py-2 rounded-lg bg-ocean-600 text-white text-sm font-bold">
                  閉じる
                </button>
              </>
            ) : (
              <>
                <h3 className="font-bold text-base mb-1">🙏 お礼メッセージ送信</h3>
                <p className="text-sm text-gray-600 mb-4">
                  「{formatDateJa(thankTarget.date)}」の乗船者全員にお礼メッセージをLINEで送信します。
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-800">
                  <p className="font-bold mb-1">送信されるメッセージ：</p>
                  <p>昨日はご乗船いただきありがとうございました！🎣</p>
                  <p className="mt-1">【日程】{formatDateJa(thankTarget.date)}</p>
                  <p className="mt-1">楽しんでいただけましたでしょうか？またのご乗船をお待ちしております。</p>
                  <p className="mt-1">釣果のお写真などインスタグラムでも紹介しておりますので、よろしければフォローください📸</p>
                  <p className="mt-1">またお会いできる日を楽しみにしています！🎣 遊漁船 王丸</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setThankTarget(null)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 font-medium">
                    キャンセル
                  </button>
                  <button onClick={handleThankYou} disabled={thankLoading}
                    className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50">
                    {thankLoading ? '送信中...' : '送信する'}
                  </button>
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
