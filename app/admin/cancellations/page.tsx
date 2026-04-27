'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDateJa } from '@/lib/utils'

export default function AdminCancellationsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [processing, setProcessing] = useState<string | null>(null)

  async function fetchRequests() {
    const { data } = await supabase
      .from('cancellation_requests')
      .select('*, reservations(*, plans(name, departure_dates(date)))')
      .order('created_at', { ascending: false })
    setRequests(data || [])
  }

  useEffect(() => { fetchRequests() }, [])

  function getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-admin-password': sessionStorage.getItem('admin_pw') || '',
    }
  }

  async function handleAction(id: string, action: 'approve' | 'reject') {
    const label = action === 'approve' ? '承認' : '却下'
    if (!confirm(`このキャンセル申請を${label}しますか？`)) return
    setProcessing(id)
    await fetch(`/api/admin/cancellations/${id}`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ action }),
    })
    await fetchRequests()
    setProcessing(null)
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const done = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="p-4">
      <h2 className="section-title mt-2">キャンセル申請</h2>

      {pending.length === 0 && (
        <div className="card text-center py-6 mb-4">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-gray-500 text-sm">未処理の申請はありません</p>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <p className="text-sm font-bold text-red-600 mb-3">⚠️ 未処理 {pending.length}件</p>
          <div className="space-y-3 mb-6">
            {pending.map((req) => {
              const res = req.reservations
              const plan = res?.plans
              return (
                <div key={req.id} className="card border-red-200">
                  <div className="mb-3">
                    <div className="font-bold">{res?.representative_name}</div>
                    <div className="text-xs text-gray-500">{res?.reservation_number}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      📅 {plan?.departure_dates?.date && formatDateJa(plan.departure_dates.date)}
                    </div>
                    <div className="text-xs text-gray-600">
                      🎣 {plan?.name} ／ 👥 {res?.total_members}名
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      申請日時：{new Date(req.created_at).toLocaleString('ja-JP')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req.id, 'approve')}
                      disabled={processing === req.id}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                      ✅ 承認する
                    </button>
                    <button
                      onClick={() => handleAction(req.id, 'reject')}
                      disabled={processing === req.id}
                      className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                      ❌ 却下する
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <p className="text-sm font-bold text-gray-500 mb-3">処理済み</p>
          <div className="space-y-2">
            {done.map((req) => {
              const res = req.reservations
              return (
                <div key={req.id} className="card opacity-70">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold">{res?.representative_name}</div>
                      <div className="text-xs text-gray-500">{res?.reservation_number}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {req.status === 'approved' ? '承認済み' : '却下済み'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
