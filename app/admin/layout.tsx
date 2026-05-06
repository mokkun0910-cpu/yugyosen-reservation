'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  // null = 確認中, false = 未認証, true = 認証済み
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // マウント時にサーバーサイドで Cookie の有効性を確認
  useEffect(() => {
    fetch('/api/admin/auth', { method: 'GET' })
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false))
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        // Cookie は same-origin で自動送受信されるため credentials 指定不要
      })
      const d = await r.json()
      if (d.ok) {
        setPassword('')
        setAuthed(true)
      } else if (r.status === 429) {
        setError('試行回数が多すぎます。しばらく待ってから再試行してください。')
      } else {
        setError('パスワードが正しくありません。')
      }
    } catch {
      setError('通信エラーが発生しました。')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => {})
    setAuthed(false)
  }

  // 認証確認中
  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-700">
        <p className="text-white text-sm">読み込み中…</p>
      </div>
    )
  }

  // 未認証 → ログインフォーム
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-navy-700">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <div className="bg-navy-700 px-6 py-5 text-center">
            <p className="text-gold-400 text-xs tracking-widest mb-1">TAKAYOSHI RYOKAN</p>
            <h1 className="text-white font-serif text-xl font-bold tracking-wide">高喜丸 管理画面</h1>
          </div>
          <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="label">管理者パスワード</label>
              <input
                className="input-field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="error-text">⚠️ {error}</p>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'ログイン中…' : 'ログイン'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: '/admin', label: 'ホーム', icon: '🏠' },
    { href: '/admin/dates', label: '予約管理', icon: '📅' },
    { href: '/admin/cancellations', label: 'キャンセル', icon: '❌' },
    { href: '/admin/address-book', label: 'アドレス帳', icon: '📒' },
    { href: '/admin/history', label: '履歴', icon: '📊' },
  ]

  return (
    <div className="min-h-screen bg-cream-50">
      <div className="bg-navy-700 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-gold-400 text-xs tracking-widest leading-none">TAKAYOSHI RYOKAN</p>
          <span className="font-bold font-serif text-sm tracking-wide">⚓ 高喜丸 管理画面</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-navy-300 text-xs border border-navy-500 px-3 py-1 rounded-lg hover:bg-navy-600 transition-colors">
          ログアウト
        </button>
      </div>
      <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      <div className="pb-20">{children}</div>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 shadow-lg">
        <div className="flex">
          {navItems.map((item) => (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`flex-1 py-2.5 flex flex-col items-center text-xs gap-0.5 transition-colors ${
                pathname === item.href
                  ? 'text-navy-700 font-bold border-t-2 border-gold-500'
                  : 'text-gray-400 hover:text-navy-600'
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
