import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// BUG7修正: LIFFアクセストークンをLINE APIで検証し、本人のみプロフィールを取得可能にする
// （以前はlineUserIdをクエリパラメータで受け取っていたため、誰でも他人のPIIを取得できた）
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ found: false })
  }

  // LINE APIでアクセストークンを検証し、実際のuserIdを取得
  const lineRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)

  if (!lineRes || !lineRes.ok) {
    return NextResponse.json({ found: false })
  }

  const lineProfile = await lineRes.json().catch(() => null)
  const lineUserId: string | undefined = lineProfile?.userId

  if (!lineUserId) {
    return NextResponse.json({ found: false })
  }

  // 検証済みのuserIdでDBを検索
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('address_book')
    .select('name, furigana, phone, birth_date, address, emergency_contact_name, emergency_contact_phone')
    .eq('line_user_id', lineUserId)
    .single()

  if (error || !data) {
    // アドレス帳未登録（初回予約）でも LINE ID だけは返す
    return NextResponse.json({ found: false, line_user_id: lineUserId })
  }

  return NextResponse.json({
    found: true,
    line_user_id: lineUserId,   // 検証済みLINE IDをフォームに返す
    name: data.name,
    furigana: data.furigana,
    phone: data.phone,
    birth_date: data.birth_date,
    address: data.address,
    emergency_contact_name: data.emergency_contact_name,
    emergency_contact_phone: data.emergency_contact_phone,
  })
}
