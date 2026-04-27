'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const ok = sessionStorage.getItem('admin_authed')
    if (ok === '1') setAuthed(true)
  }, [])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).then((r) => r.json()).then((d) => {
      if (d.ok) { sessionStorage.setItem('admin_authed', '1'); sessionStorage.setItem('admin_pw', password); setAuthed(true) }
      else setError('パスワードが正しくありません。')
    })
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="card w-full max-w-sm">
          <h1 className="text-lg font-bold text-center mb-4">🔐 管理画面</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <input className="input-field" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" />
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn-primary">ログイン</button>
          </form>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: '/admin', label: 'ホーム', icon: '🏠' },
    { href: '/admin/dates', label: '出船日', icon: '📅' },
    { href: '/admin/reservations', label: '予約一覧', icon: '📋' },
    { href: '/admin/cancellations', label: 'キャンセル', icon: '❌' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-ocean-800 text-white px-4 py-3 flex items-center justify-between">
        <span className="font-bold">⚓ 王丸 管理画面</span>
        <button onClick={() => { sessionStorage.removeItem('admin_authed'); sessionStorage.removeItem('admin_pw'); setAuthed(false) }}
          className="text-ocean-200 text-sm">ログアウト</button>
      </div>
      <div className="pb-16">{children}</div>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200">
        <div className="flex">
          {navItems.map((item) => (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`flex-1 py-2 flex flex-col items-center text-xs gap-0.5 transition-colors ${
                pathname === item.href ? 'text-ocean-600 font-bold' : 'text-gray-500'
              }`}>
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
