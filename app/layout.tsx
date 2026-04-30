import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '高喜丸 | 遊漁船オンライン予約 | 割烹旅館たかよし',
  description: '割烹旅館たかよしの遊漁船「高喜丸」オンライン予約システム。カレンダーで空き確認・24時間受付。宗像市神湊。',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-sm">
          {children}
        </div>
      </body>
    </html>
  )
}
