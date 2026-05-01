import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'
import { upsertAddressBook } from '@/lib/addressBook'

export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const db = createServerClient()
  let added = 0
  let updated = 0
  let skipped = 0

  // ① 全予約の代表者情報を取り込む
  const { data: reservations } = await db
    .from('reservations')
    .select('representative_name, representative_phone, line_user_id')
    .neq('status', 'cancelled')

  for (const r of reservations || []) {
    if (!r.representative_name || !r.representative_phone) { skipped++; continue }

    const { data: existing } = await db
      .from('address_book')
      .select('id')
      .eq('phone', r.representative_phone)
      .single()

    await upsertAddressBook(db, {
      name: r.representative_name,
      phone: r.representative_phone,
      line_user_id: r.line_user_id || null,
    })

    existing ? updated++ : added++
  }

  // ② 全乗船者（同行者）の情報を取り込む
  const { data: members } = await db
    .from('members')
    .select('name, phone, birth_date, address, emergency_contact_name, emergency_contact_phone')
    .eq('is_completed', true)

  for (const m of members || []) {
    if (!m.name || !m.phone) { skipped++; continue }

    const { data: existing } = await db
      .from('address_book')
      .select('id')
      .eq('phone', m.phone)
      .single()

    await upsertAddressBook(db, {
      name: m.name,
      phone: m.phone,
      birth_date: m.birth_date || null,
      address: m.address || null,
      emergency_contact_name: m.emergency_contact_name || null,
      emergency_contact_phone: m.emergency_contact_phone || null,
    })

    existing ? updated++ : added++
  }

  return NextResponse.json({ ok: true, added, updated, skipped })
}
