import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lineUserId = searchParams.get('lineUserId')

  if (!lineUserId) {
    return NextResponse.json({ error: 'lineUserId is required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('address_book')
    .select('name, furigana, phone, birth_date, address, emergency_contact_name, emergency_contact_phone')
    .eq('line_user_id', lineUserId)
    .single()

  if (error || !data) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    name: data.name,
    furigana: data.furigana,
    phone: data.phone,
    birth_date: data.birth_date,
    address: data.address,
    emergency_contact_name: data.emergency_contact_name,
    emergency_contact_phone: data.emergency_contact_phone,
  })
}
