'use client'
import { useEffect, useState } from 'react'
import { formatDateJa } from '@/lib/utils'

const emptyForm = {
  name: '', phone: '', birth_date: '', address: '',
  emergency_contact_name: '', emergency_contact_phone: '', memo: '',
}

export default function AddressBookPage() {
  const [people, setPeople] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm })
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-admin-password': sessionStorage.getItem('admin_pw') || '',
    }
  }

  async function load(q = '') {
    setLoading(true)
    const params = q ? `?q=${encodeURIComponent(q)}` : ''
    const res = await fetch(`/api/admin/address-book${params}`, {
      headers: getAdminHeaders(),
      cache: 'no-store',
    })
    const json = await res.json()
    setPeople(json.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    await load(searchQ)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!addForm.name || !addForm.phone) { setError('氏名と電話番号は必須です。'); return }
    setSaving(true)
    const res = await fetch('/api/admin/address-book', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(addForm),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || '登録に失敗しました。'); return }
    setAddForm({ ...emptyForm })
    setShowAddForm(false)
    await load(searchQ)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    const res = await fetch('/api/admin/address-book', {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id, ...editForm }),
    })
    setSaving(false)
    if (!res.ok) { alert('更新に失敗しました。'); return }
    setEditingId(null)
    await load(searchQ)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」をアドレス帳から削除しますか？\n乗船履歴は削除されません。`)) return
    const res = await fetch('/api/admin/address-book', {
      method: 'DELETE',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id }),
    })
    if (!res.ok) { alert('削除に失敗しました。'); return }
    await load(searchQ)
  }

  function startEdit(p: any) {
    setEditingId(p.id)
    setEditForm({
      name: p.name || '',
      phone: p.phone || '',
      birth_date: p.birth_date || '',
      address: p.address || '',
      emergency_contact_name: p.emergency_contact_name || '',
      emergency_contact_phone: p.emergency_contact_phone || '',
      memo: p.memo || '',
    })
  }

  return (
    <div className="p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mt-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gold-500 rounded-full" />
          <h2 className="text-lg font-bold text-navy-700 font-serif">
            アドレス帳
            <span className="text-sm font-normal text-gray-400 ml-2">({people.length}件)</span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowAddForm(v => !v); setError('') }}
            className="text-xs bg-navy-700 text-white px-3 py-1.5 rounded-lg hover:bg-navy-800 transition-colors font-medium">
            ＋ 手動追加
          </button>
          <button onClick={() => load(searchQ)}
            className="text-xs bg-white text-navy-700 border border-navy-200 px-3 py-1.5 rounded-lg hover:bg-cream-50 transition-colors">
            🔄 更新
          </button>
        </div>
      </div>

      {/* 検索 */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          className="input-field flex-1"
          placeholder="氏名・電話番号で検索"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <button type="submit"
          className="bg-navy-700 text-white px-4 py-2 rounded-lg text-sm font-bold shrink-0 hover:bg-navy-800 transition-colors">
          検索
        </button>
        {searchQ && (
          <button type="button" onClick={() => { setSearchQ(''); load('') }}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
            クリア
          </button>
        )}
      </form>

      {/* 手動追加フォーム */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-navy-200 p-4 mb-4">
          <p className="text-sm font-bold text-navy-700 mb-3">新規登録</p>
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">氏名 <span className="text-red-500">*</span></label>
                <input className="input-field" placeholder="山田 太郎"
                  value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">電話番号 <span className="text-red-500">*</span></label>
                <input className="input-field" placeholder="090-1234-5678"
                  value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">生年月日</label>
                <input className="input-field" type="date"
                  value={addForm.birth_date} onChange={e => setAddForm({ ...addForm, birth_date: e.target.value })} />
              </div>
              <div>
                <label className="label">緊急連絡先氏名</label>
                <input className="input-field" placeholder="山田 花子（妻）"
                  value={addForm.emergency_contact_name} onChange={e => setAddForm({ ...addForm, emergency_contact_name: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">住所</label>
              <input className="input-field" placeholder="福岡県福岡市〇〇1-2-3"
                value={addForm.address} onChange={e => setAddForm({ ...addForm, address: e.target.value })} />
            </div>
            <div>
              <label className="label">緊急連絡先電話</label>
              <input className="input-field" placeholder="090-9876-5432"
                value={addForm.emergency_contact_phone} onChange={e => setAddForm({ ...addForm, emergency_contact_phone: e.target.value })} />
            </div>
            <div>
              <label className="label">メモ（管理者のみ見えます）</label>
              <input className="input-field" placeholder="例：常連さん・マダイ好き"
                value={addForm.memo} onChange={e => setAddForm({ ...addForm, memo: e.target.value })} />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowAddForm(false)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">
                キャンセル
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 text-sm bg-navy-700 text-white rounded-lg font-bold disabled:opacity-50">
                {saving ? '保存中...' : '登録する'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
      )}

      {/* 一覧 */}
      {!loading && people.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 text-center py-10 text-gray-400 text-sm">
          登録されていません
        </div>
      )}

      <div className="space-y-3">
        {people.map(p => {
          const isExpanded = expandedId === p.id
          const isEditing = editingId === p.id
          const history = p.history || []

          return (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 人物ヘッダー */}
              <div className="p-3">
                {isEditing ? (
                  /* 編集フォーム */
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-navy-700 mb-2">情報を編集</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label">氏名</label>
                        <input className="input-field" value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">電話番号</label>
                        <input className="input-field" value={editForm.phone}
                          onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label">生年月日</label>
                        <input className="input-field" type="date" value={editForm.birth_date}
                          onChange={e => setEditForm({ ...editForm, birth_date: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">緊急連絡先氏名</label>
                        <input className="input-field" value={editForm.emergency_contact_name}
                          onChange={e => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="label">住所</label>
                      <input className="input-field" value={editForm.address}
                        onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">緊急連絡先電話</label>
                      <input className="input-field" value={editForm.emergency_contact_phone}
                        onChange={e => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">メモ</label>
                      <input className="input-field" placeholder="例：常連さん・マダイ好き"
                        value={editForm.memo}
                        onChange={e => setEditForm({ ...editForm, memo: e.target.value })} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditingId(null)}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">
                        キャンセル
                      </button>
                      <button onClick={() => handleSaveEdit(p.id)} disabled={saving}
                        className="flex-1 py-2 text-sm bg-navy-700 text-white rounded-lg font-bold disabled:opacity-50">
                        {saving ? '保存中...' : '保存する'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 通常表示 */
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-navy-700 text-sm">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">📞 {p.phone}</div>
                        {p.birth_date && (
                          <div className="text-xs text-gray-500">🎂 {p.birth_date}</div>
                        )}
                        {p.address && (
                          <div className="text-xs text-gray-500">🏠 {p.address}</div>
                        )}
                        {p.emergency_contact_name && (
                          <div className="text-xs text-gray-500">
                            🆘 {p.emergency_contact_name}
                            {p.emergency_contact_phone && `（${p.emergency_contact_phone}）`}
                          </div>
                        )}
                        {p.line_user_id && (
                          <div className="text-xs text-green-600 mt-0.5">💬 LINE連携済み</div>
                        )}
                        {p.memo && (
                          <div className="text-xs text-gold-700 bg-gold-50 border border-gold-200 rounded px-2 py-0.5 mt-1 inline-block">
                            📝 {p.memo}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                        <span className="text-xs bg-navy-100 text-navy-700 px-2 py-0.5 rounded-full font-bold">
                          {history.length}回乗船
                        </span>
                        <button onClick={() => startEdit(p)}
                          className="text-xs text-navy-600 border border-navy-200 px-2 py-0.5 rounded-lg hover:bg-navy-50">
                          ✏️ 編集
                        </button>
                        <button onClick={() => handleDelete(p.id, p.name)}
                          className="text-xs text-red-500 border border-red-200 px-2 py-0.5 rounded-lg hover:bg-red-50">
                          削除
                        </button>
                      </div>
                    </div>

                    {/* 乗船履歴トグル */}
                    {history.length > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="text-xs text-navy-600 border border-navy-200 bg-navy-50 px-3 py-1.5 rounded-lg w-full hover:bg-navy-100 transition-colors">
                        {isExpanded ? '乗船履歴を閉じる ▲' : `乗船履歴を見る（${history.length}件） ▼`}
                      </button>
                    )}

                    {/* 乗船履歴 */}
                    {isExpanded && (
                      <div className="mt-2 space-y-1.5">
                        {history.map((h: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                            <div>
                              <span className="font-bold text-navy-700">
                                {h.date ? formatDateJa(h.date) : ''}
                              </span>
                              <span className="text-gray-500 ml-2">
                                {h.plan_name} {h.departure_time}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-gray-500">{h.total_members}名</span>
                              <span className={`px-1.5 py-0.5 rounded-full ${
                                h.role === '代表者'
                                  ? 'bg-navy-100 text-navy-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {h.role}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
