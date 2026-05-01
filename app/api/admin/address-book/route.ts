import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'

// アドレス帳一覧取得
export async function GET(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''

  const db = createServerClient()

  let query = db
    .from('address_book')
    .select('*')
    .order('updated_at', { ascending: false })

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 各人の乗船履歴を取得（電話番号で照合）
  const enriched = await Promise.all(
    (data || []).map(async (person: any) => {
      // 代表者として予約した履歴
      const { data: repRes } = await db
        .from('reservations')
        .select('id, reservation_number, total_members, created_at, plans(name, departure_time, departure_dates(date))')
        .eq('representative_phone', person.phone)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })

      // 同行者として乗船した履歴
      const { data: memberRes } = await db
        .from('members')
        .select('id, reservations(id, reservation_number, total_members, created_at, plans(name, departure_time, departure_dates(date)))')
        .eq('phone', person.phone)
        .eq('is_completed', true)

      // 代表者履歴をフォーマット
      const repHistory = (repRes || []).map((r: any) => ({
        reservation_number: r.reservation_number,
        total_members: r.total_members,
        date: r.plans?.departure_dates?.date || '',
        plan_name: r.plans?.name || '',
        departure_time: r.plans?.departure_time?.slice(0, 5) || '',
        role: '代表者',
      }))

      // 同行者履歴をフォーマット（代表者履歴と重複除去）
      const repResIds = new Set((repRes || []).map((r: any) => r.id))
      const memberHistory = (memberRes || [])
        .filter((m: any) => m.reservations && !repResIds.has(m.reservations.id))
        .map((m: any) => ({
          reservation_number: m.reservations.reservation_number,
          total_members: m.reservations.total_members,
          date: m.reservations.plans?.departure_dates?.date || '',
          plan_name: m.reservations.plans?.name || '',
          departure_time: m.reservations.plans?.departure_time?.slice(0, 5) || '',
          role: '同行者',
        }))

      // 日付順に結合
      const history = [...repHistory, ...memberHistory].sort((a, b) =>
        a.date < b.date ? 1 : -1
      )

      return { ...person, history }
    })
  )

  return NextResponse.json({ data: enriched }, { headers: { 'Cache-Control': 'no-store' } })
}

// 手動追加
export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { name, phone, birth_date, address, emergency_contact_name, emergency_contact_phone, memo } = body

  if (!name || !phone) {
    return NextResponse.json({ error: '氏名と電話番号は必須です。' }, { status: 400 })
  }

  const db = createServerClient()

  // 電話番号重複チェック
  const { data: existing } = await db.from('address_book').select('id').eq('phone', phone).single()
  if (existing) {
    return NextResponse.json({ error: 'この電話番号はすでに登録されています。' }, { status: 400 })
  }

  const { data, error } = await db.from('address_book').insert({
    name, phone,
    birth_date: birth_date || null,
    address: address || null,
    emergency_contact_name: emergency_contact_name || null,
    emergency_contact_phone: emergency_contact_phone || null,
    memo: memo || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// メモ・情報の更新
export async function PATCH(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { id, memo, name, phone, birth_date, address, emergency_contact_name, emergency_contact_phone } = body

  if (!id) return NextResponse.json({ error: 'idが必要です。' }, { status: 400 })

  const db = createServerClient()
  const payload: any = {}
  if (memo !== undefined) payload.memo = memo
  if (name) payload.name = name
  if (phone) payload.phone = phone
  if (birth_date !== undefined) payload.birth_date = birth_date || null
  if (address !== undefined) payload.address = address || null
  if (emergency_contact_name !== undefined) payload.emergency_contact_name = emergency_contact_name || null
  if (emergency_contact_phone !== undefined) payload.emergency_contact_phone = emergency_contact_phone || null

  const { error } = await db.from('address_book').update(payload).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// 削除
export async function DELETE(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'idが必要です。' }, { status: 400 })

  const db = createServerClient()
  const { error } = await db.from('address_book').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
