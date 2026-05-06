'use client'
import { useEffect, useState } from 'react'
import { formatDateJa } from '@/lib/utils'
const emptyForm = {
  name: '', furigana: '', phone: '', birth_date: '', address: '',
  emergency_contact_name: '', emergency_contact_phone: '', memo: '',
}
type EditForm = typeof emptyForm
const KANA_GROUPS = [
  { label: 'あ行', chars: ['あ','い','う','え','お'] },
  { label: 'か行', chars: ['か','き','く','け','こ','が','ぎ','ぐ','げ','ご'] },
  { label: 'さ行', chars: ['さ','し','す','せ','そ','ざ','じ','ず','ぜ','ぞ'] },
  { label: 'た行', chars: ['た','ち','つ','て','と','だ','ぢ','づ','で','ど'] },
  { label: 'な行', chars: ['な','に','ぬ','ね','の'] },
  { label: 'は行', chars: ['は','ひ','ふ','へ','ほ','ば','び','ぶ','べ','ぼ','ぱ','ぴ','ぷ','ぺ','ぽ'] },
  { label: 'ま行', chars: ['ま','み','む','め','も'] },
  { label: 'や行', chars: ['や','ゆ','よ'] },
  { label: 'ら行', chars: ['ら','り','る','れ','ろ'] },
  { label: 'わ行', chars: ['わ','を','ん'] },
]
function getKanaGroup(furigana: string | null): string {
  if (!furigana) return 'ふりがな未登録'
  const first = furigana.trim()[0]
  for (const g of KANA_GROUPS) {
    if (g.chars.includes(first)) return g.label
  }
  return 'その他'
}
// ---- PersonCard：editForm を自身の state で管理 ----
type PersonCardProps = {
  p: any
  isExpanded: boolean
  isEditing: boolean
  saving: boolean
  onToggleExpand: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (form: EditForm) => void
  onDelete: () => void
}
function PersonCard({
  p, isExpanded, isEditing, saving,
  onToggleExpand, onStartEdit, onCancelEdit, onSaveEdit, onDelete,
}: PersonCardProps) {
  const history = p.history || []
  // 自身の state で管理 → 親の再レンダリングに影響されない
  const [form, setForm] = useState<EditForm>({ ...emptyForm })
  // 編集モードに入ったとき初期値をセット
  useEffect(() => {
    if (isEditing) {
      setForm({
        name: p.name || '',
        furigana: p.furigana || '',
        phone: p.phone || '',
        birth_date: p.birth_date || '',
        address: p.address || '',
        emergency_contact_name: p.emergency_contact_name || '',
        emergency_contact_phone: p.emergency_contact_phone || '',
        memo: p.memo || '',
      })
    }
  }, [isEditing])
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-navy-700 mb-2">情報を編集</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">氏名</label>
                <input className="input-field" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">ふりがな</label>
                <input className="input-field" value={form.furigana} placeholder="やまだ たろう"
                  onChange={e => setForm(f => ({ ...f, furigana: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">電話番号</label>
              <input className="input-field" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">生年月日</label>
                <input className="input-field" type="date" value={form.birth_date}
                  onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">緊急連絡先氏名</label>
                <input className="input-field" value={form.emergency_contact_name}
                  onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">住所</label>
              <input className="input-field" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="label">緊急連絡先電話</label>
              <input className="input-field" value={form.emergency_contact_phone}
                onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">メモ</label>
              <input className="input-field" placeholder="例：常連さん・マダイ好き" value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={onCancelEdit}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">
                キャンセル
              </button>
              <button onClick={() => onSaveEdit(form)} disabled={saving}
                className="flex-1 py-2 text-sm bg-navy-700 text-white rounded-lg font-bold disabled:opacity-50">
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-navy-700 text-sm">{p.name}</div>
                {p.furigana && <div className="text-xs text-gray-400">{p.furigana}</div>}
                <div className="text-xs text-gray-500 mt-0.5">📞 {p.phone}</div>
                {p.birth_date && <div className="text-xs text-gray-500">🎂 {p.birth_date}</div>}
                {p.address && <div className="text-xs text-gray-500 truncate">🏠 {p.address}</div>}
                {p.emergency_contact_name && (
                  <div className="text-xs text-gray-500">
                    🆘 {p.emergency_contact_name}{p.emergency_contact_phone && `（${p.emergency_contact_phone}）`}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.line_user_id && (
                    <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                      💬 LINE連携
                    </span>
                  )}
                  {p.memo && (
                    <span className="text-xs text-gold-700 bg-gold-50 border border-gold-200 px-1.5 py-0.5 rounded-full">
                      📝 {p.memo}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                <span className="text-xs bg-navy-100 text-navy-700 px-2 py-0.5 rounded-full font-bold">
                  {history.length}回
                </span>
                <button onClick={onStartEdit}
                  className="text-xs text-navy-600 border border-navy-200 px-2 py-0.5 rounded-lg hover:bg-navy-50">
                  ✏️ 編集
                </button>
                <button onClick={onDelete}
                  className="text-xs text-red-500 border border-red-200 px-2 py-0.5 rounded-lg hover:bg-red-50">
                  削除
                </button>
              </div>
            </div>
            {history.length > 0 && (
              <button onClick={onToggleExpand}
                className="text-xs text-navy-600 border border-navy-200 bg-navy-50 px-3 py-1.5 rounded-lg w-full hover:bg-navy-100 transition-colors">
                {isExpanded ? '乗船履歴を閉じる ▲' : `乗船履歴（${history.length}件） ▼`}
              </button>
            )}
            {isExpanded && (
              <div className="mt-2 space-y-1.5">
                {history.map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                    <div>
                      <span className="font-bold text-navy-700">{h.date ? formatDateJa(h.date) : ''}</span>
                      <span className="text-gray-500 ml-2">{h.plan_name} {h.departure_time}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-500">{h.total_members}名</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${h.role === '代表者' ? 'bg-navy-100 text-navy-700' : 'bg-green-100 text-green-700'}`}>
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
}
// ---- メインページ ----
export default function AddressBookPage() {
  const [people, setPeople] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<EditForm>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  function getAdminHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
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
    const data = json.data || []
    setPeople(data)
    if (!q) {
      const groups = new Set(data.map((p: any) => getKanaGroup(p.furigana)))
      setOpenGroups(groups as Set<string>)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    await load(searchQ)
    setOpenGroups(new Set(KANA_GROUPS.map(g => g.label).concat(['ふりがな未登録', 'その他'])))
  }
  function toggleGroup(label: string) {
    setOpenGroups(prev => {
      const next = new Set(Array.from(prev))
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
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
  async function handleSaveEdit(id: string, form: EditForm) {
    setSaving(true)
    const res = await fetch('/api/admin/address-book', {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id, ...form }),
    })
    setSaving(false)
    if (!res.ok) { alert('更新に失敗しました。'); return }
    setEditingId(null)
    await load(searchQ)
  }
  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」をアドレス帳から削除しますか？`)) return
    const res = await fetch('/api/admin/address-book', {
      method: 'DELETE',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id }),
    })
    if (!res.ok) { alert('削除に失敗しました。'); return }
    await load(searchQ)
  }
  const groupOrder = KANA_GROUPS.map(g => g.label).concat(['その他', 'ふりがな未登録'])
  const grouped = groupOrder.reduce((acc, label) => {
    const items = people.filter(p => getKanaGroup(p.furigana) === label)
    if (items.length > 0) acc.push({ label, items })
    return acc
  }, [] as { label: string; items: any[] }[])
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mt-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gold-500 rounded-full" />
          <h2 className="text-lg font-bold text-navy-700 font-serif">
            アドレス帳
            <span className="text-sm font-normal text-gray-400 ml-2">({people.length}名)</span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowAddForm(v => !v); setError('') }}
            className="text-xs bg-navy-700 text-white px-3 py-1.5 rounded-lg hover:bg-navy-800 transition-colors font-medium">
            ＋ 手動追加
          </button>
          <button onClick={() => load(searchQ)}
            className="text-xs bg-white text-navy-700 border border-navy-200 px-3 py-1.5 rounded-lg hover:bg-cream-50 transition-colors">
            🔄
          </button>
        </div>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input className="input-field flex-1" placeholder="氏名・ふりがな・電話番号で検索"
          value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        <button type="submit"
          className="bg-navy-700 text-white px-4 py-2 rounded-lg text-sm font-bold shrink-0 hover:bg-navy-800">
          検索
        </button>
        {searchQ && (
          <button type="button" onClick={() => { setSearchQ(''); load('') }}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
            ✕
          </button>
        )}
      </form>
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-navy-200 p-4 mb-4">
          <p className="text-sm font-bold text-navy-700 mb-3">新規登録</p>
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">氏名 <span className="text-red-500">*</span></label>
                <input className="input-field" placeholder="山田 太郎"
                  value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">ふりがな</label>
                <input className="input-field" placeholder="やまだ たろう"
                  value={addForm.furigana} onChange={e => setAddForm(f => ({ ...f, furigana: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">電話番号 <span className="text-red-500">*</span></label>
              <input className="input-field" placeholder="090-1234-5678"
                value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">生年月日</label>
                <input className="input-field" type="date"
                  value={addForm.birth_date} onChange={e => setAddForm(f => ({ ...f, birth_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">緊急連絡先氏名</label>
                <input className="input-field" placeholder="山田 花子（妻）"
                  value={addForm.emergency_contact_name} onChange={e => setAddForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">住所</label>
              <input className="input-field" placeholder="福岡県福岡市〇〇1-2-3"
                value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="label">緊急連絡先電話</label>
              <input className="input-field" placeholder="090-9876-5432"
                value={addForm.emergency_contact_phone} onChange={e => setAddForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">メモ</label>
              <input className="input-field" placeholder="例：常連さん・マダイ好き"
                value={addForm.memo} onChange={e => setAddForm(f => ({ ...f, memo: e.target.value }))} />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded p-2">⚠️ {error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowAddForm(false)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600">キャンセル</button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 text-sm bg-navy-700 text-white rounded-lg font-bold disabled:opacity-50">
                {saving ? '保存中...' : '登録する'}
              </button>
            </div>
          </form>
        </div>
      )}
      {loading && <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>}
      {!loading && people.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 text-center py-10 text-gray-400 text-sm">
          登録されていません
        </div>
      )}
      {!loading && (
        <div className="space-y-2">
          {grouped.map(({ label, items }) => (
            <div key={label}>
              <button
                onClick={() => toggleGroup(label)}
                className="w-full flex items-center justify-between px-3 py-2 bg-navy-700 text-white rounded-xl mb-1.5 transition-colors hover:bg-navy-800"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-serif">{label}</span>
                  <span className="text-xs text-navy-200 bg-navy-600 px-2 py-0.5 rounded-full">{items.length}名</span>
                </div>
                <span className="text-navy-200 text-sm">{openGroups.has(label) ? '▲' : '▼'}</span>
              </button>
              {openGroups.has(label) && (
                <div className="space-y-2 pl-1">
                  {items.map(p => (
                    <PersonCard
                      key={p.id}
                      p={p}
                      isExpanded={expandedId === p.id}
                      isEditing={editingId === p.id}
                      saving={saving}
                      onToggleExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      onStartEdit={() => setEditingId(p.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSaveEdit={(form) => handleSaveEdit(p.id, form)}
                      onDelete={() => handleDelete(p.id, p.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
