'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

interface Member {
  id: string
  name: string | null
  birth_date: string | null
  address: string | null
  phone: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  is_completed: boolean
  reservation_id: string
}

interface Plan {
  id: string
  name: string
  departure_time: string
  price: number
  reservations: {
    id: string
    representative_name: string
    total_members: number
    status: string
  }[]
}

interface DepartureDate {
  id: string
  date: string
}

export default function RosterPage() {
  const { dateId } = useParams<{ dateId: string }>()
  const [dateInfo, setDateInfo] = useState<DepartureDate | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [membersByReservation, setMembersByReservation] = useState<Record<string, Member[]>>({})
  const [loading, setLoading] = useState(true)
  const [printedAt] = useState(() => {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })

  useEffect(() => {
    async function load() {
      // 出船日情報を取得
      const { data: dateData } = await supabase
        .from('departure_dates')
        .select('id, date')
        .eq('id', dateId)
        .single()

      if (!dateData) { setLoading(false); return }
      setDateInfo(dateData)

      // プラン情報を取得
      const { data: plansData } = await supabase
        .from('plans')
        .select('id, name, departure_time, price')
        .eq('departure_date_id', dateId)
        .order('departure_time')

      if (!plansData || plansData.length === 0) { setLoading(false); return }

      const planIds = plansData.map((p: { id: string }) => p.id)

      // キャンセル以外の予約を取得
      const { data: reservationsData } = await supabase
        .from('reservations')
        .select('id, representative_name, total_members, status, plan_id')
        .in('plan_id', planIds)
        .neq('status', 'cancelled')

      const reservations = reservationsData || []
      const reservationIds = reservations.map((r: { id: string }) => r.id)

      // メンバー情報を取得
      let membersData: Member[] = []
      if (reservationIds.length > 0) {
        const { data: members } = await supabase
          .from('members')
          .select('id, name, birth_date, address, phone, emergency_contact_name, emergency_contact_phone, is_completed, reservation_id')
          .in('reservation_id', reservationIds)
          .order('id')
        membersData = members || []
      }

      // メンバーを予約IDでグループ化
      const memberMap: Record<string, Member[]> = {}
      for (const m of membersData) {
        if (!memberMap[m.reservation_id]) memberMap[m.reservation_id] = []
        memberMap[m.reservation_id].push(m)
      }
      setMembersByReservation(memberMap)

      // プランに予約情報を紐付け
      const plansWithReservations: Plan[] = plansData.map((p: { id: string; name: string; departure_time: string; price: number }) => ({
        ...p,
        reservations: reservations.filter((r: { id: string; representative_name: string; total_members: number; status: string; plan_id: string }) => r.plan_id === p.id),
      }))
      setPlans(plansWithReservations)
      setLoading(false)
    }
    load()
  }, [dateId])

  // 全メンバーを平坦化して合計を計算
  const allMembers = Object.values(membersByReservation).flat()
  const totalMembers = plans.reduce((sum, p) =>
    sum + p.reservations.reduce((s, r) => s + (r.total_members || 0), 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        読み込み中...
      </div>
    )
  }

  if (!dateInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        出船日が見つかりません
      </div>
    )
  }

  return (
    <>
      <style>{`
        @page { size: A4; margin: 15mm; }
        @media print {
          .print\\:hidden { display: none !important; }
          body { font-size: 11px; }
        }
      `}</style>

      <div className="p-6 max-w-4xl mx-auto">
        {/* 印刷・戻るボタン */}
        <div className="print:hidden flex gap-3 mb-6">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            ← 戻る
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-navy-700 text-white rounded-lg text-sm font-bold hover:bg-navy-800 transition-colors">
            🖨️ 印刷する
          </button>
        </div>

        {/* ヘッダー */}
        <div className="border-b-2 border-gray-800 pb-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">乗船名簿</h1>
          <div className="flex items-center justify-between mt-1">
            <p className="text-lg text-gray-700">
              {dateInfo ? formatDateJa(dateInfo.date) : ''}
              　遊漁船 高喜丸
            </p>
            <p className="text-sm text-gray-500">印刷日時：{printedAt}</p>
          </div>
        </div>

        {/* プランごとのテーブル */}
        {plans.map((plan) => {
          // このプランの全メンバーをフラットに展開
          const planMembers: { member: Member; reservationName: string }[] = []
          plan.reservations.forEach((res) => {
            const members = membersByReservation[res.id] || []
            members.forEach((m) => {
              planMembers.push({ member: m, reservationName: res.representative_name })
            })
          })

          return (
            <div key={plan.id} className="mb-8">
              <div className="bg-gray-100 px-4 py-2 rounded-t-lg flex items-center justify-between border border-gray-300 border-b-0">
                <h2 className="font-bold text-base text-gray-800">
                  {plan.name}
                  <span className="ml-3 text-sm font-normal text-gray-600">
                    出船 {plan.departure_time.slice(0, 5)}
                  </span>
                </h2>
                <span className="text-sm text-gray-600">
                  {plan.reservations.reduce((s, r) => s + (r.total_members || 0), 0)}名
                </span>
              </div>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-2 py-2 text-center w-8">No</th>
                    <th className="border border-gray-300 px-2 py-2 text-left w-28">氏名</th>
                    <th className="border border-gray-300 px-2 py-2 text-left w-24">生年月日</th>
                    <th className="border border-gray-300 px-2 py-2 text-left">住所</th>
                    <th className="border border-gray-300 px-2 py-2 text-left w-28">電話番号</th>
                    <th className="border border-gray-300 px-2 py-2 text-left w-36">緊急連絡先</th>
                  </tr>
                </thead>
                <tbody>
                  {planMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border border-gray-300 px-3 py-4 text-center text-gray-400">
                        乗船者情報がありません
                      </td>
                    </tr>
                  ) : (
                    planMembers.map(({ member }, index) => (
                      <tr key={member.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-300 px-2 py-2 text-center text-gray-600">
                          {index + 1}
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          {member.is_completed && member.name
                            ? member.name
                            : <span className="text-gray-400 text-xs">（情報入力待ち）</span>
                          }
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-gray-700 text-xs">
                          {member.birth_date || ''}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-gray-700 text-xs">
                          {member.address || ''}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-gray-700 text-xs">
                          {member.phone || ''}
                        </td>
                        <td className="border border-gray-300 px-2 py-2 text-gray-700 text-xs">
                          {member.emergency_contact_name
                            ? `${member.emergency_contact_name}（${member.emergency_contact_phone || ''}）`
                            : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        })}

        {/* 合計 */}
        <div className="border-t-2 border-gray-800 pt-4 text-right">
          <p className="text-lg font-bold text-gray-800">
            合計乗船者数：{totalMembers}名
          </p>
          <p className="text-sm text-gray-500 mt-1">
            うち情報入力済み：{allMembers.filter(m => m.is_completed).length}名 /
            入力待ち：{allMembers.filter(m => !m.is_completed).length}名
          </p>
        </div>
      </div>
    </>
  )
}
