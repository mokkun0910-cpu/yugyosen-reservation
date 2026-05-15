// SMS送信ライブラリ（Twilio）
// 必要なVercel環境変数:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
// 未設定の場合は送信をスキップし、ok:false（reason: not_configured）を返す。
// 既存のLINE通知フローを壊さないよう、呼び出し側で必ず .catch(...) する。

/** 日本の電話番号文字列をE.164形式（+819012345678）に変換。失敗時はnull */
export function toE164JP(phone: string | null | undefined): string | null {
  if (!phone) return null
  // 全角数字→半角、各種ハイフン・空白除去
  const normalized = phone
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[－−‐―\-\s]/g, '')
  const digits = normalized.replace(/\D/g, '')
  // 先頭0で10〜11桁ならJP形式 → +81に変換
  if (/^0\d{9,10}$/.test(digits)) return '+81' + digits.slice(1)
  // すでに+81始まりならそのまま
  if (/^\+81\d{9,10}$/.test(normalized)) return normalized
  return null
}

export type SmsResult = { ok: boolean; error?: string; skipped?: boolean }

/** 1件SMS送信 */
export async function sendSms(toPhone: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from) {
    return { ok: false, skipped: true, error: 'SMS未設定（環境変数なし）' }
  }
  const to = toE164JP(toPhone)
  if (!to) {
    return { ok: false, error: `電話番号形式不正: ${toPhone}` }
  }
  try {
    const params = new URLSearchParams()
    params.set('To', to)
    params.set('From', from)
    params.set('Body', body)
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    )
    if (!res.ok) {
      const err = await res.text()
      return { ok: false, error: `Twilio ${res.status}: ${err.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

export type SmsBatchItemResult = {
  to: string
  ok: boolean
  skipped: boolean
  error?: string
}

/** 一括送信（並列）。サマリーと各送信先の結果を返す */
export async function sendSmsBatch(
  items: Array<{ to: string; body: string }>
): Promise<{
  sent: number
  failed: number
  skipped: number
  errors: string[]
  items: SmsBatchItemResult[]
}> {
  const results = await Promise.allSettled(
    items.map((m) => sendSms(m.to, m.body))
  )
  let sent = 0,
    failed = 0,
    skipped = 0
  const errors: string[] = []
  const itemResults: SmsBatchItemResult[] = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const to = items[i].to
    if (r.status === 'fulfilled') {
      if (r.value.ok) {
        sent++
        itemResults.push({ to, ok: true, skipped: false })
      } else if (r.value.skipped) {
        skipped++
        itemResults.push({ to, ok: false, skipped: true, error: r.value.error })
      } else {
        failed++
        if (r.value.error) errors.push(r.value.error)
        itemResults.push({ to, ok: false, skipped: false, error: r.value.error })
      }
    } else {
      failed++
      const reason = (r as PromiseRejectedResult).reason
      const errMsg = reason?.message || String(reason)
      errors.push(errMsg)
      itemResults.push({ to, ok: false, skipped: false, error: errMsg })
    }
  }
  return { sent, failed, skipped, errors, items: itemResults }
}

/** SMSが設定済みかどうか（管理画面の表示制御用） */
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  )
}
