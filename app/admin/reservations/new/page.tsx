'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

const emptyForm = {
  name: '', furigana: '', phone: '', birth_date: '', address: '',
  emergency_contact_name: '', emergency_contact_phone: '',
}

const emptyCompanion = {
  name: '', birth_date: '', phone: '', address: '',
  emergency_contact_name: '', emergency_contact_phone: '',
}

export default function AdminNewReservationPage() {
  const router = useRouter()

  const [dates, setDates] = useState<any[]>([])
  const [selectedDateId, setSelectedDateId] = useState('')
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [totalMembers, setTotalMembers] = useState(1)
  const [form, setForm] = useState({ ...emptyForm })
  const [companions, setCompanions] = useState<typeof emptyCompanion[]>([])
  const [openCompanions, setOpenCompanions] = useState<Set<number>>(new Set([0]))

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ reservationNumber: string; planName: string; date: string } | null>(null)

  useEffect(() => {
    async function fetchDates() {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('departure_dates')
        .select('id, date')
        .gte('date', today)
        .order('date')
      setDates(data || [])
    }
    fetchDates()
  }, [])

  // totalMembersが変わったら同行者フォームを調整
  useEffect(() => {
    const needed = Math.max(0, totalMembers - 1)
    setCompanions(prev => {
      if (prev.length < needed) {
        const added = Array.from({ length: needed - prev.length }, () => ({ ...emptyCompanion }))
        return [...prev, ...added]
      }
      return prev.slice(0, needed)
    })
  }, [totalMembers])

  async function handleSelectDate(dateId: string) {
    setSelectedDateId(dateId)
    setSelectedPlanId('')
    setPlans([])
    if (!dateId) return
    const { data } = await supabase
      .from('plans')
      .select('id, name, departure_time, price, capacity')
      .eq('departure_date_id', dateId)
      .order('departure_time')
    setPlans(data || [])
    setStep(2)
  }

  function handleSelectPlan(planId: string) {
    setSelectedPlanId(planId)
    setStep(3)
  }

  function updateCompanion(index: number, field: string, value: string) {
    setCompanions(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function toggleCompanion(index: number) {
    setOpenCompanions(prev => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.phone) {
      setError('氏名と電話番号は必須です。')
      return
    }
    setSaving(true)
    const pw = sessionStorage.getItem('admin_pw') || ''
    const res = await fetch('/api/admin/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      body: JSON.stringify({
        planId: selectedPlanId,
        representativeName: form.name,
        representativeFurigana: form.furigana || null,
        representativePhone: form.phone,
        totalMembers,
        representativeBirthDate: form.birth_date || null,
        representativeAddress: form.address || null,
        representativeEmergencyName: form.emergency_contact_name || null,
        representativeEmergencyPhone: form.emergency_contact_phone || null,
        companions: companions.map(c => ({
          name: c.name || null,
          birth_date: c.birth_date || null,
          phone: c.phone || null,
          address: c.address || null,
          emergency_contact_name: c.emergency_contact_name || null,
          emergency_contact_phone: c.emergency_contact_phone || null,
        })),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error || '予約の作成に失敗しました。')
      return
    }
    const plan = plans.find(p => p.id === selectedPlanId)
    const dateObj = dates.find(d => d.id === selectedDateId)
    setDone({
      reservationNumber: data.reservationNumber,
      planName: plan?.name || '',
      date: dateObj?.date || '',
    })
  }

  function resetAll() {
    setDone(null); setStep(1); setSelectedDateId(''); setSelectedPlanId('')
    setForm({ ...emptyForm }); setTotalMembers(1); setCompanions([])
  }

  if (done) {
    return (
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-4 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-bold text-navy-700 font-serif mb-1">予約を登録しました</h2>
          <p className="text-sm text-gray-500 mb-4">{done.date && formatDateJa(done.date)} ／ {done.planName}</p>
          <div className="bg-cream-50 border border-gold-200 rounded-xl p-4 mb-5">
            <div className="text-xs text-gray-500 mb-1">予約番号</div>
            <div className="text-2xl font-bold text-navy-700 tracking-widest">{done.reservationNumber}</div>
          </div>
          <div className="space-y-2">
            <button onClick={resetAll}
              className="w-full py-3 rounded-xl bg-navy-700 text-white font-bold text-sm">
              続けて予約を入力する
            </button>
            <button onClick={() => router.push('/admin/dates')}
              className="w-full py-3 rounded-xl border border-gray-200 text-navy-700 font-bold text-sm">
              予約管理に戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  const selectedDate = dates.find(d => d.id === selectedDateId)
  const selectedPlan = plans.find(p => p.id === selectedPlanId)

  return (
    <div className="p-4">
      <button onClick={() => router.push('/admin/dates')}
        className="text-navy-600 text-sm mb-3 block hover:text-gold-500 transition-colors">
        ← 予約管理に戻る
      </button>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-gold-500 rounded-full" />
        <h2 className="text-lg font-bold text-navy-700 font-serif">電話予約の入力</h2>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-1 mb-5">
        {['出船日', 'プラン', '乗船者情報'].map((label, i) => {
          const s = i + 1
          const active = step === s
          const isDone = step > s
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`flex items-center gap-1.5 flex-1 ${s > 1 ? 'ml-1' : ''}`}>
                {s > 1 && <div className={`flex-1 h-0.5 ${isDone ? 'bg-gold-400' : 'bg-gray-200'}`} />}
                <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0 ${
                  active ? 'bg-navy-700 text-white' : isDone ? 'bg-gold-400 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {isDone ? '✓' : s}
                </div>
                <span className={`text-xs shrink-0 ${active ? 'text-navy-700 font-bold' : isDone ? 'text-gold-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Step 1: 出船日選択 */}
      {step >= 1 && (
        <div className={`bg-white rounded-xl shadow-sm border p-4 mb-3 ${step === 1 ? 'border-navy-300' : 'border-gray-100'}`}>
          <p className="text-sm font-bold text-navy-700 mb-3">① 出船日を選択</p>
          {dates.length === 0 ? (
            <p className="text-sm text-gray-400">受付中の出船日がありません</p>
          ) : (
            <div className="space-y-2">
              {dates.map(d => (
                <button key={d.id} onClick={() => handleSelectDate(d.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    selectedDateId === d.id ? 'bg-navy-700 text-white border-navy-700' : 'bg-gray-50 text-navy-700 border-gray-200 hover:bg-navy-50'
                  }`}>
                  📅 {formatDateJa(d.date)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: プラン・人数選択 */}
      {step >= 2 && (
        <div className={`bg-white rounded-xl shadow-sm border p-4 mb-3 ${step === 2 ? 'border-navy-300' : 'border-gray-100'}`}>
          <p className="text-sm font-bold text-navy-700 mb-3">② プランと人数を選択</p>
          {plans.length === 0 ? (
            <p className="text-sm text-gray-400">この日のプランが登録されていません</p>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {plans.map(p => (
                  <button key={p.id} onClick={() => handleSelectPlan(p.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                      selectedPlanId === p.id ? 'bg-navy-700 text-white border-navy-700' : 'bg-gray-50 text-navy-700 border-gray-200 hover:bg-navy-50'
                    }`}>
                    <div className="font-bold">{p.name}</div>
                    <div className={`text-xs mt-0.5 ${selectedPlanId === p.id ? 'text-navy-200' : 'text-gray-400'}`}>
                      ⏰ {p.departure_time?.slice(0, 5)}　👥 定員{p.capacity}名　💴 {p.price?.toLocaleString()}円
                    </div>
                  </button>
                ))}
              </div>
              {selectedPlanId && (
                <div>
                  <label className="label">参加人数</label>
                  <select className="input-field" value={totalMembers}
                    onChange={e => setTotalMembers(Number(e.target.value))}>
                    {Array.from({ length: plans.find(p => p.id === selectedPlanId)?.capacity || 10 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}名</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: 乗船者情報入力 */}
      {step >= 3 && (
        <form onSubmit={handleSubmit}>
          {selectedDate && selectedPlan && (
            <div className="bg-gold-50 border border-gold-200 rounded-lg p-3 mb-3 text-xs text-gray-700">
              <div>📅 {formatDateJa(selectedDate.date)}</div>
              <div>🎣 {selectedPlan.name}　⏰ {selectedPlan.departure_time?.slice(0, 5)}　👥 {totalMembers}名</div>
            </div>
          )}

          {/* 代表者 */}
          <div className="bg-white rounded-xl shadow-sm border border-navy-300 p-4 mb-3">
            <p className="text-sm font-bold text-navy-700 mb-1">③ 代表者情報</p>
            <p className="text-xs text-gray-400 mb-3">※ 生年月日・住所・緊急連絡先は後日入力も可</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">氏名 <span className="text-red-500">*</span></label>
                  <input className="input-field" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="山田 太郎" />
                </div>
                <div>
                  <label className="label">ふりがな</label>
                  <input className="input-field" value={form.furigana}
                    onChange={e => setForm(f => ({ ...f, furigana: e.target.value }))}
                    placeholder="やまだ たろう" />
                </div>
              </div>
              <div>
                <label className="label">電話番号 <span className="text-red-500">*</span></label>
                <input className="input-field" type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="090-1234-5678" />
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500 mb-2">乗船情報（任意）</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="label">生年月日</label>
                    <input className="input-field" type="date" value={form.birth_date}
                      onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">緊急連絡先氏名</label>
                    <input className="input-field" value={form.emergency_contact_name}
                      onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                      placeholder="山田 花子（妻）" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">住所</label>
                    <input className="input-field" value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="福岡県…" />
                  </div>
                  <div>
                    <label className="label">緊急連絡先電話</label>
                    <input className="input-field" type="tel" value={form.emergency_contact_phone}
                      onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                      placeholder="090-9876-5432" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 同行者 */}
          {companions.map((c, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-3 overflow-hidden">
              <button type="button"
                onClick={() => toggleCompanion(i)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-navy-700 hover:bg-gray-50">
                <span>👤 同行者 {i + 2}  {c.name && <span className="text-gray-500 font-normal ml-1">({c.name})</span>}</span>
                <span className="text-gray-400 text-xs">{openCompanions.has(i) ? '▲ 閉じる' : '▼ 入力する'}</span>
              </button>
              {openCompanions.has(i) && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">氏名</label>
                      <input className="input-field" value={c.name}
                        onChange={e => updateCompanion(i, 'name', e.target.value)}
                        placeholder="山田 次郎" />
                    </div>
                    <div>
                      <label className="label">生年月日</label>
                      <input className="input-field" type="date" value={c.birth_date}
                        onChange={e => updateCompanion(i, 'birth_date', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">電話番号</label>
                      <input className="input-field" type="tel" value={c.phone}
                        onChange={e => updateCompanion(i, 'phone', e.target.value)}
                        placeholder="090-1234-5678" />
                    </div>
                    <div>
                      <label className="label">緊急連絡先氏名</label>
                      <input className="input-field" value={c.emergency_contact_name}
                        onChange={e => updateCompanion(i, 'emergency_contact_name', e.target.value)}
                        placeholder="山田 花子（妻）" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">住所</label>
                      <input className="input-field" value={c.address}
                        onChange={e => updateCompanion(i, 'address', e.target.value)}
                        placeholder="福岡県…" />
                    </div>
                    <div>
                      <label className="label">緊急連絡先電話</label>
                      <input className="input-field" type="tel" value={c.emergency_contact_phone}
                        onChange={e => updateCompanion(i, 'emergency_contact_phone', e.target.value)}
                        placeholder="090-9876-5432" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-3">
              ⚠️ {error}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? '登録中...' : '📞 予約を登録する'}
          </button>
        </form>
      )}
    </div>
  )
}
