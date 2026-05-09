import { SupabaseClient } from '@supabase/supabase-js'

/**
 * アドレス帳をUPSERT
 * 照合優先順位: ① LINE ID → ② 電話番号 → ③ 新規作成
 * LINE IDで照合することで、電話番号の表記揺れによる重複エントリを防止する
 */
export async function upsertAddressBook(
  db: SupabaseClient,
  entry: {
    name: string
    phone: string
    furigana?: string | null
    birth_date?: string | null
    address?: string | null
    emergency_contact_name?: string | null
    emergency_contact_phone?: string | null
    line_user_id?: string | null
  }
) {
  if (!entry.name || !entry.phone) return

  let existing: { id: string; line_user_id: string | null } | null = null

  // ① LINE IDがあればLINE IDで優先検索（最も確実な本人特定）
  if (entry.line_user_id) {
    const { data } = await db
      .from('address_book')
      .select('id, line_user_id')
      .eq('line_user_id', entry.line_user_id)
      .maybeSingle()
    existing = data ?? null
  }

  // ② LINE IDで見つからなければ電話番号で検索
  if (!existing) {
    const { data } = await db
      .from('address_book')
      .select('id, line_user_id')
      .eq('phone', entry.phone)
      .maybeSingle()
    existing = data ?? null
  }

  const payload: any = {
    name: entry.name,
    phone: entry.phone,
  }
  if (entry.furigana)                  payload.furigana = entry.furigana
  if (entry.birth_date)                payload.birth_date = entry.birth_date
  if (entry.address)                   payload.address = entry.address
  if (entry.emergency_contact_name)    payload.emergency_contact_name = entry.emergency_contact_name
  if (entry.emergency_contact_phone)   payload.emergency_contact_phone = entry.emergency_contact_phone
  if (entry.line_user_id)              payload.line_user_id = entry.line_user_id

  if (existing) {
    await db.from('address_book').update(payload).eq('id', existing.id)
  } else {
    await db.from('address_book').insert(payload)
  }
}
