import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '王丸 | 遊漁船予約',
  description: '遊漁船王丸のオンライン予約システム',
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
