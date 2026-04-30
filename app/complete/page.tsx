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
    <div className="min-h-screen bg-cream-50">
      <div className="bg-navy-700 text-white px-4 py-4 text-center">
        <div className="font-bold text-lg font-serif tracking-wide">{isSingle ? '予約完了' : '予約受付完了'}</div>
        <p className="text-navy-300 text-xs mt-0.5">遊漁船 高喜丸 ｜ 割烹旅館たかよし</p>
      </div>
      <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      <div className="p-4">
        <div className="text-center py-6">
          <div className="text-5xl mb-4">⚓</div>
          <h2 className="text-xl font-bold text-navy-700 font-serif mb-2">
            {isSingle ? 'ご予約が確定しました' : 'ご予約を受け付けました'}
          </h2>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6 text-center">
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
          <p className="text-sm text-gray-500">キャンセルは予約時に登録した電話番号で申請できます</p>
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
