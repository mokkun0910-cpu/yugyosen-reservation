import { createServerClient } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export type AdminAction =
  | 'login'
  | 'logout'
  | 'weather_cancel'       // 悪天候による出船中止
  | 'admin_cancel'         // 管理者による直接キャンセル
  | 'approve_cancel'       // キャンセル申請 → 承認
  | 'reject_cancel'        // キャンセル申請 → 否認
  | 'departure_confirm'    // 出船確定通知送信
  | 'thank_you_send'       // お礼メッセージ送信

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * 管理者操作をデータベースに記録する
 * ログ失敗は本処理に影響させないためサイレントに処理
 */
export async function logAdminAction(
  req: NextRequest,
  action: AdminAction,
  detail: string = ''
): Promise<void> {
  try {
    const db = createServerClient()
    await db.from('admin_logs').insert({
      action,
      detail,
      ip_address: getClientIp(req),
    })
  } catch (e) {
    console.error('[AdminLog] 記録失敗:', e)
  }
}
