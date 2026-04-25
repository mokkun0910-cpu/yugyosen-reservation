'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateJa, formatTime, formatPrice } from '@/lib/utils'

type Plan = {
  id: string
  name: string
  target_fish: string
  departure_time: string
  price: number
  capacity: number
  is_locked: boolean
  reservedCount: number
}

function PlanSelectContent() {
  const router = useRouter()
  const { dateId } = useParams<{ dateId: string }>()
  const searchParams = useSearchParams()
  const preselectedPlanId = searchParams.get('planId')

  const [date, setDate] = useState<string>('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [members, setMembers] = useState(1)

  useEffect(() => {
    async function fetchPlans() {
      const { data: dateData } = await supabase
        .from('departure_dates')
        .select('date')
        .eq('id', dateId)
        .single()
      if (dateData) setDate(dateData.date)

      const { data: planData } = await supabase
        .from('plans')
        .select('*')
        .eq('departure_date_id', dateId)
        .order('departure_time')

      if (!planData) { setLoading(false); return }

      const enriched = await Promise.all(
        planData.map(async (p) => {
          const { data: resData } = await supabase
            .from('reservations')
            .select('total_members')
            .eq('plan_id', p.id)
            .neq('status', 'cancelled')
          const reservedCount = (resData || []).reduce(
            (sum, r) => sum + r.total_members, 0
          )
          return { ...p, reservedCount }
        })
      )
      setPlans(enriched)

      // カレンダーから来た場合はプランを自動選択
      if (preselectedPlanId) {
        const found = enriched.find(p => p.id === preselectedPlanId)
        if (found && !found.is_locked && found.reservedCount < found.capacity) {
          setSelectedPlan(found)
        }
      }

      setLoading(false)
    }
    fetchPlans()
  }, [dateId, preselectedPlanId])

  function isSelectable(plan: Plan) {
    if (plan.is_locked) return false
    if (plan.reservedCount >= plan.capacity) return false
    return true
  }

  function getAvailableSeats(plan: Plan) {
    return plan.capacity - plan.reservedCount
  }

  function handleNext() {
    if (!selectedPlan) return
    const params = new URLSearchParams({
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      members: String(members),
    })
    router.push(`/reserve/${dateId}/form?${params.toString()}`)
  }

  return (
    <div className="min-h-screen">
      <div className="page-header">
        <button onClick={() => router.push('/')} className="text-ocean-200 text-sm mb-1 block">
          ← 戻る
        </button>
        <div className="font-bold text-lg">プランを選ぶ</div>
        {date && <div className="text-ocean-100 text-sm">{formatDateJa(date)}</div>}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <>
            <h2 className="section-title">釣りのプランを選んでください</h2>
            <div className="space-y-3 mb-6">
              {plans.map((plan) => {
                const selectable = isSelectable(plan)
                const available = getAvailableSeats(plan)
                const isSelected = selectedPlan?.id === plan.id
                return (
                  <button
                    key={plan.id}
                    disabled={!selectable}
                    onClick={() => selectable && setSelectedPlan(plan)}
                    className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                      isSelected
                        ? 'border-ocean-500 bg-ocean-50'
                        : selectable
                        ? 'border-gray-200 bg-white hover:border-ocean-300'
                        : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-800">{plan.name}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          🐟 {plan.target_fish}
                        </div>
                        <div className="text-sm text-gray-600">
                          ⏰ 出船 {formatTime(plan.departure_time)}
                        </div>
                        <div className="text-ocean-700 font-bold mt-1">
                          {formatPrice(plan.price)} / 1名
                        </div>
                      </div>
                      <div className="text-right">
                        {!selectable && plan.is_locked && (
                          <span className="badge-locked">本日締切</span>
                        )}
                        {!selectable && !plan.is_locked && (
                          <span className="badge-full">満員</span>
                        )}
                        {selectable && (
                          <>
                            <span className="badge-available">受付中</span>
                            <div className="text-xs text-gray-500 mt-1">
                              残り{available}席
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-2 text-ocean-600 text-sm font-medium">
                        ✓ このプランを選択
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {selectedPlan && (
              <div className="mb-4">
                <label className="label">参加人数</label>
                <select
                  className="input-field"
                  value={members}
                  onChange={(e) => setMembers(Number(e.target.value))}
                >
                  {Array.from(
                    { length: getAvailableSeats(selectedPlan) },
                    (_, i) => i + 1
                  ).map((n) => (
                    <option key={n} value={n}>{n}名</option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn-primary"
              disabled={!selectedPlan}
              onClick={handleNext}
            >
              次へ（代表者情報の入力）
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function PlanSelectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">読み込み中...</div>}>
      <PlanSelectContent />
    </Suspense>
  )
}
