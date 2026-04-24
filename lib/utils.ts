// 予約番号生成（例：YU-20240501-A3F2）
export function generateReservationNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `YU-${dateStr}-${rand}`
}

// 日付を日本語表示に変換（例：2024年5月1日(水)）
export function formatDateJa(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00+09:00')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日(${days[date.getDay()]})`
}

// 時刻を表示用に変換（例：05:00 → 5:00）
export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

// 料金を日本円表示に変換（例：15000 → ¥15,000）
export function formatPrice(price: number): string {
  return `¥${price.toLocaleString('ja-JP')}`
}
