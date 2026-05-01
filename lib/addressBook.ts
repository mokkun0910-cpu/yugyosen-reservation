import { SupabaseClient } from '@supabase/supabase-js'

/**
 * アドレス帳をUPSERT（電話番号で照合・なければ新規作成・あれば上書き更新）
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

  // 既存レコードを電話番号で検索
  const { data: existing } = await db
    .from('address_book')
    .select('id, line_user_id')
    .eq('phone', entry.phone)
    .single()

  const payload: any = {
    name: entry.name,
    phone: entry.phone,
  }
  if (entry.furigana) payload.furigana = entry.furigana
  if (entry.birth_date) payload.birth_date = entry.birth_date
  if (entry.address) payload.address = entry.address
  if (entry.emergency_contact_name) payload.emergency_contact_name = entry.emergency_contact_name
  if (entry.emergency_contact_phone) payload.emergency_contact_phone = entry.emergency_contact_phone
  if (entry.line_user_id) payload.line_user_id = entry.line_user_id

  if (existing) {
    await db.from('address_book').update(payload).eq('id', existing.id)
  } else {
    await db.from('address_book').insert(payload)
  }
}
