// 遊漁船名（Vercel環境変数 BOAT_NAME で変更可能）
export const BOAT_NAME = process.env.BOAT_NAME || '高喜丸'

// 予約番号生成（例：YU-20240501-A3F2）
export function generateReservationNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `YU-${dateStr}-${rand}`
}

// 日付を日本語表示に変換（例：2024年5月1日(水)）
// BUG修正: 旧実装は Date のローカルタイムゾーン(Vercel=UTC)に依存しており、
// JST真夜中=UTC前日15時のため getDate()/getDay() が1日ずれる現象が発生していた。
// ここでは "YYYY-MM-DD" を直接パースし、曜日計算のみ Date.UTC を使うことで
// 実行環境のタイムゾーンに依存しない結果を返す。
export function formatDateJa(dateStr: string): string {
  if (!dateStr) return ''
  const [yStr, mStr, dStr] = dateStr.slice(0, 10).split('-')
  const y = Number(yStr), m = Number(mStr), d = Number(dStr)
  if (!y || !m || !d) return dateStr
  // 曜日: UTCで作成しUTC関数で読めばタイムゾーンに依存しない
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${y}年${m}月${d}日(${days[dow]})`
}

// 時刻を表示用に変換（例：05:00 → 5:00）
export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

// 料金を日本円表示に変換（例：15000 → ¥15,000）
export function formatPrice(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`
}
