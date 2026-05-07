import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/adminAuth'
import { generateReservationNumber } from '@/lib/utils'
import { sendCaptainNotification } from '@/lib/line'
import { upsertAddressBook } from '@/lib/addressBook'

export async function GET(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    // ページネーション（省略時は全件取得・後方互換）
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')
    const usePagination = !!(pageParam || limitParam)
    const page = Math.max(1, parseInt(pageParam || '1'))
    const limit = Math.min(500, Math.max(1, parseInt(limitParam || '200')))
    const offset = (page - 1) * limit

    const db = createServerClient()

    const { data: allReservations } = await db.from('reservations').select('id, status')
    const totalInDB = allReservations?.length ?? 0
    const statusSummary = (allReservations || []).reduce((acc: any, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {})

    let query = db
      .from('reservations')
      .select('id, reservation_number, representative_name, representative_phone, total_members, status, plan_id, created_at', { count: 'exact' })
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (usePagination) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data: reservations, error, count } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message, totalInDB, statusSummary },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    if (!reservations || reservations.length === 0) {
      return NextResponse.json(
        { reservations: [], totalInDB, statusSummary },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const planIds = Array.from(new Set(reservations.map((r: any) => r.plan_id)))
    const { data: plans } = await db
      .from('plans')
      .select('id, name, departure_time, departure_date_id')
      .in('id', planIds)

    const dateIds = Array.from(new Set((plans || []).map((p: any) => p.departure_date_id)))
    const { data: dates } = await db
      .from('departure_dates')
      .select('id, date, departure_notified_at, weather_notified_at, thankyou_notified_at')
      .in('id', dateIds)

    const enriched = reservations.map((r: any) => {
      const plan = (plans || []).find((p: any) => p.id === r.plan_id)
      const date = plan ? (dates || []).find((d: any) => d.id === plan.departure_date_id) : null
      return {
        ...r,
        plans: plan ? {
          name: plan.name,
          departure_time: plan.departure_time,
          departure_dates: date ? {
            date: date.date,
            departure_notified_at: date.departure_notified_at,
            weather_notified_at: date.weather_notified_at,
            thankyou_notified_at: date.thankyou_notified_at,
          } : null,
        } : null,
      }
    })

    return NextResponse.json(
      {
        reservations: enriched,
        totalInDB,
        statusSummary,
        // ページネーション情報（paginationパラメータ指定時のみ付加）
        ...(usePagination && {
          pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) }
        }),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

export async function POST(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const body = await req.json()
  const {
    planId,
    representativeName,
    representativeFurigana,   // ← 修正: 追加
    representativePhone,
    totalMembers,
    representativeBirthDate,
    representativeAddress,
    representativeEmergencyName,
    representativeEmergencyPhone,
    companions = [],           // ← 追加: 同行者情報の配列
  } = body

  if (!planId || !representativeName || !representativePhone || !totalMembers) {
    return NextResponse.json({ error: '必須項目が不足しています。' }, { status: 400 })
  }

  const db = createServerClient()

  const { data: plan } = await db
    .from('plans')
    .select('*, departure_dates(date)')
    .eq('id', planId)
    .single()

  if (!plan) return NextResponse.json({ error: 'プランが見つかりません。' }, { status: 404 })

  const { data: existingRes } = await db
    .from('reservations')
    .select('total_members')
    .eq('plan_id', planId)
    .neq('status', 'cancelled')
  const currentCount = (existingRes || []).reduce((sum: number, r: any) => sum + r.total_members, 0)
  if (currentCount + totalMembers > plan.capacity) {
    return NextResponse.json(
      { error: `定員を超えています。現在 ${currentCount}名 / 定員 ${plan.capacity}名` },
      { status: 400 }
    )
  }

  const reservationNumber = generateReservationNumber()

  const { data: reservation, error: resError } = await db
    .from('reservations')
    .insert({
      plan_id: planId,
      reservation_number: reservationNumber,
      representative_name: representativeName,
      representative_furigana: representativeFurigana || null,  // ← 修正: 保存
      representative_phone: representativePhone,
      line_user_id: null,
      total_members: totalMembers,
      status: 'pending_members',
    })
    .select()
    .single()

  if (resError) return NextResponse.json({ error: '予約の作成に失敗しました。' }, { status: 500 })

  // 乗船者レコードを作成
  const memberRecords = Array.from({ length: totalMembers }, () => ({
    reservation_id: reservation.id,
    is_completed: false,
  }))
  const { data: members } = await db.from('members').insert(memberRecords).select()

  // 代表者の乗船情報を更新
  const repCompleted = !!(
    representativeBirthDate &&
    representativeAddress &&
    representativeEmergencyName &&
    representativeEmergencyPhone
  )
  if (members && members.length > 0 && representativeBirthDate) {
    await db.from('members').update({
      name: representativeName,
      birth_date: representativeBirthDate || null,
      address: representativeAddress || null,
      phone: representativePhone,
      emergency_contact_name: representativeEmergencyName || null,
      emergency_contact_phone: representativeEmergencyPhone || null,
      is_completed: repCompleted,
    }).eq('id', members[0].id)
  }

  // 同行者の乗船情報を更新
  if (members && members.length > 1 && companions.length > 0) {
    for (let i = 0; i < companions.length; i++) {
      const c = companions[i]
      const memberIndex = i + 1
      if (memberIndex >= members.length) break
      if (!c.name) continue  // 名前がなければスキップ

      const companionCompleted = !!(c.name && c.birth_date && c.address && c.emergency_contact_name && c.emergency_contact_phone)
      await db.from('members').update({
        name: c.name,
        birth_date: c.birth_date || null,
        address: c.address || null,
        phone: c.phone || null,
        emergency_contact_name: c.emergency_contact_name || null,
        emergency_contact_phone: c.emergency_contact_phone || null,
        is_completed: companionCompleted,
      }).eq('id', members[memberIndex].id)

      // 同行者をアドレス帳に登録
      if (c.phone) {
        await upsertAddressBook(db, {
          name: c.name,
          phone: c.phone,
          birth_date: c.birth_date || undefined,
          address: c.address || undefined,
          emergency_contact_name: c.emergency_contact_name || undefined,
          emergency_contact_phone: c.emergency_contact_phone || undefined,
        }).catch(console.error)
      }
    }
  }

  // 全員の情報が揃っていれば即確定
  const companionsAllCompleted = companions.length >= totalMembers - 1 &&
    companions.every((c: any) => c.name && c.birth_date && c.address && c.emergency_contact_name && c.emergency_contact_phone)
  const allCompleted = totalMembers === 1 ? repCompleted : (repCompleted && companionsAllCompleted)
  if (allCompleted) {
    await db.from('reservations').update({ status: 'confirmed' }).eq('id', reservation.id)
  }

  // 同日の他プランをロック
  if (currentCount === 0) {
    await db
      .from('plans')
      .update({ is_locked: true })
      .eq('departure_date_id', plan.departure_date_id)
      .neq('id', planId)
  }

  // 代表者をアドレス帳に登録・更新
  await upsertAddressBook(db, {
    name: representativeName,
    furigana: representativeFurigana || undefined,
    phone: representativePhone,
    birth_date: representativeBirthDate || undefined,
    address: representativeAddress || undefined,
    emergency_contact_name: representativeEmergencyName || undefined,
    emergency_contact_phone: representativeEmergencyPhone || undefined,
  }).catch(console.error)

  // 船長へLINE通知
  const captainLineUserId = process.env.CAPTAIN_LINE_USER_ID
  if (captainLineUserId) {
    await sendCaptainNotification(captainLineUserId, {
      reservationNumber,
      representativeName,
      planName: plan.name,
      date: (plan.departure_dates as any).date,
      totalMembers,
      currentTotal: currentCount + totalMembers,
      capacity: plan.capacity,
    }).catch(console.error)
  }

  return NextResponse.json({ reservationNumber })
}

// 管理者による予約情報修正（電話番号・氏名など）
export async function PATCH(req: NextRequest) {
  const authError = await checkAdminAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { reservationId, representative_name, representative_furigana, representative_phone } = body

  if (!reservationId) {
    return NextResponse.json({ error: 'reservationIdが必要です。' }, { status: 400 })
  }

  const db = createServerClient()

  // 予約の存在確認
  const { data: reservation } = await db
    .from('reservations')
    .select('id, representative_phone, representative_name')
    .eq('id', reservationId)
    .neq('status', 'cancelled')
    .single()

  if (!reservation) {
    return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
  }

  const payload: any = {}
  if (representative_name) payload.representative_name = representative_name
  if (representative_furigana !== undefined) payload.representative_furigana = representative_furigana || null
  if (representative_phone) payload.representative_phone = representative_phone

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: '変更内容がありません。' }, { status: 400 })
  }

  const { error } = await db.from('reservations').update(payload).eq('id', reservationId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // アドレス帳も更新（電話番号が変わった場合は旧電話番号のレコードを処理）
  if (representative_phone && representative_phone !== reservation.representative_phone) {
    // 旧電話番号のアドレス帳エントリを取得
    const { data: oldEntry } = await db
      .from('address_book')
      .select('id')
      .eq('phone', reservation.representative_phone)
      .maybeSingle()

    if (oldEntry) {
      // 新しい電話番号のエントリがすでに存在するか確認
      const { data: newEntry } = await db
        .from('address_book')
        .select('id')
        .eq('phone', representative_phone)
        .neq('id', oldEntry.id)
        .maybeSingle()

      if (newEntry) {
        // 正しい番号のエントリが既にある → 間違い番号で作られた重複エントリを削除
        await db.from('address_book').delete().eq('id', oldEntry.id)
      } else {
        // 正しい番号のエントリがない → 旧エントリの番号・名前を更新
        const abPayload: any = { phone: representative_phone }
        if (representative_name) abPayload.name = representative_name
        if (representative_furigana !== undefined) abPayload.furigana = representative_furigana || null
        await db.from('address_book').update(abPayload).eq('id', oldEntry.id)
      }
    }
  } else if (!representative_phone) {
    // 電話番号変更なし・名前だけ更新
    const { data: abEntry } = await db
      .from('address_book')
      .select('id')
      .eq('phone', reservation.representative_phone)
      .maybeSingle()
    if (abEntry) {
      const abPayload: any = {}
      if (representative_name) abPayload.name = representative_name
      if (representative_furigana !== undefined) abPayload.furigana = representative_furigana || null
      await db.from('address_book').update(abPayload).eq('id', abEntry.id)
    }
  }

  const { logAdminAction } = await import('@/lib/adminLog')
  logAdminAction(req, 'edit_reservation', `予約ID: ${reservationId} 変更: ${JSON.stringify(payload)}`).catch(() => {})

  return NextResponse.json({ ok: true })
}
