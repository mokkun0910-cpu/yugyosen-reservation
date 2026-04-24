const LINE_API = 'https://api.line.me/v2/bot/message'

async function sendMessage(to: string, messages: object[]) {
  const res = await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('LINE送信エラー:', err)
  }
}

// 予約仮確定メッセージ（代表者へ）
export async function sendReservationPending(
  lineUserId: string,
  params: {
    reservationNumber: string
    planName: string
    date: string
    departureTime: string
    totalMembers: number
    memberLinks: string[]
    appUrl: string
  }
) {
  const linkList = params.memberLinks
    .map((token, i) => `同行者${i + 1}: ${params.appUrl}/member/${token}`)
    .join('\n')

  await sendMessage(lineUserId, [
    {
      type: 'text',
      text: `🎣 ご予約ありがとうございます！\n\n【予約番号】${params.reservationNumber}\n【釣り物】${params.planName}\n【日程】${params.date}\n【出船】${params.departureTime}\n【人数】${params.totalMembers}名\n\n━━━━━━━━━━━━━\n⚠️ 予約を確定するには、乗船される全員の情報入力が必要です。\n\n以下のリンクをグループLINEなどで共有して、各自に入力していただいてください。\n\n${linkList}\n\n全員の入力が完了すると予約が確定されます。`,
    },
  ])
}

// 予約確定メッセージ（代表者へ）
export async function sendReservationConfirmed(
  lineUserId: string,
  params: {
    reservationNumber: string
    planName: string
    date: string
    departureTime: string
    totalMembers: number
    appUrl: string
  }
) {
  await sendMessage(lineUserId, [
    {
      type: 'text',
      text: `✅ 予約が確定しました！\n\n【予約番号】${params.reservationNumber}\n【釣り物】${params.planName}\n【日程】${params.date}\n【出船】${params.departureTime}\n【人数】${params.totalMembers}名\n\n━━━━━━━━━━━━━\nキャンセルの場合は以下からお申し込みください。\n${params.appUrl}/cancel`,
    },
  ])
}

// 船長への予約通知
export async function sendCaptainNotification(
  captainLineUserId: string,
  params: {
    reservationNumber: string
    representativeName: string
    planName: string
    date: string
    totalMembers: number
    currentTotal: number
    capacity: number
  }
) {
  await sendMessage(captainLineUserId, [
    {
      type: 'text',
      text: `📋 新しい予約が入りました\n\n【予約番号】${params.reservationNumber}\n【代表者】${params.representativeName}\n【釣り物】${params.planName}\n【日程】${params.date}\n【人数】${params.totalMembers}名\n\n現在の予約人数: ${params.currentTotal}/${params.capacity}名`,
    },
  ])
}

// キャンセル申請の船長通知
export async function sendCancelRequestToCaptain(
  captainLineUserId: string,
  params: {
    reservationNumber: string
    representativeName: string
    planName: string
    date: string
    totalMembers: number
  }
) {
  await sendMessage(captainLineUserId, [
    {
      type: 'text',
      text: `❌ キャンセル申請が届きました\n\n【予約番号】${params.reservationNumber}\n【代表者】${params.representativeName}\n【釣り物】${params.planName}\n【日程】${params.date}\n【人数】${params.totalMembers}名\n\n管理画面で承認または却下してください。`,
    },
  ])
}

// キャンセル結果の通知（お客さんへ）
export async function sendCancelResult(
  lineUserId: string,
  approved: boolean,
  reservationNumber: string
) {
  const text = approved
    ? `✅ キャンセルが承認されました。\n\n【予約番号】${reservationNumber}\n\nまたのご利用をお待ちしております。`
    : `❌ キャンセルは却下されました。\n\n【予約番号】${reservationNumber}\n\nご不明な点はお電話にてお問い合わせください。`

  await sendMessage(lineUserId, [{ type: 'text', text }])
}

// リマインド通知（代表者へ：同行者未入力）
export async function sendMemberInputReminder(
  lineUserId: string,
  params: {
    reservationNumber: string
    pendingCount: number
    memberLinks: { token: string; index: number }[]
    appUrl: string
  }
) {
  const linkList = params.memberLinks
    .map((m) => `同行者${m.index + 1}: ${params.appUrl}/member/${m.token}`)
    .join('\n')

  await sendMessage(lineUserId, [
    {
      type: 'text',
      text: `⚠️ リマインド\n\n【予約番号】${params.reservationNumber}\n\nまだ${params.pendingCount}名の情報が入力されていません。\n\n以下のリンクを共有して、入力をお願いしてください。\n\n${linkList}`,
    },
  ])
}
