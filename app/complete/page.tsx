'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function CompleteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reservationNumber = searchParams.get('reservationNumber') || ''
  const planName = searchParams.get('planName') || ''
  const members = Number(searchParams.get('members') || '1')
  const isSingle = members === 1

  return (
    <div className="min-h-screen">
      <div className="page-header">
        <div className="font-bold text-lg">{isSingle ? '予約完了' : '予約受付完了'}</div>
      </div>
      <div className="p-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {isSingle ? '予約が確定しました！' : '予約を受け付けました'}
          </h2>
          <p className="text-gray-500 text-sm">予約番号をお控えください</p>
        </div>

        <div className="card mb-6 text-center">
          <div className="text-xs text-gray-500 mb-1">予約番号</div>
          <div className="text-2xl font-bold text-ocean-700 tracking-wider">
            {reservationNumber}
          </div>
          <div className="text-sm text-gray-600 mt-2">{planName}</div>
          <div className="text-sm text-gray-600">{members}名</div>
        </div>

        {isSingle ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="font-bold text-green-800 mb-1">✅ 予約確定</p>
            <p className="text-sm text-green-700">ご予約が確定しました。出航前日に出航決定のご連絡をLINEでお送りします。</p>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <p className="font-bold text-yellow-800 mb-2">⚠️ 予約確定までの手順</p>
            <ol className="space-y-2 text-sm text-yellow-800">
              <li className="flex gap-2">
                <span className="font-bold shrink-0">①</span>
                <span>LINEに同行者{members - 1}名分の情報入力リンクが届きます</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">②</span>
                <span>そのリンクをグループLINEなどで同行者に共有してください</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">③</span>
                <span>全員が入力すると予約確定のLINEが届きます</span>
              </li>
            </ol>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">キャンセルは予約番号が必要です</p>
          <p className="text-sm font-bold text-gray-700">予約番号：{reservationNumber}</p>
        </div>

        <div className="mt-6">
          <button className="btn-secondary" onClick={() => router.push('/')}>
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">読み込み中...</div>}>
      <CompleteContent />
    </Suspense>
  )
}
