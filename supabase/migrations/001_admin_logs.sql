-- 管理者操作ログテーブル
-- Supabase の SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS admin_logs (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action    text NOT NULL,
  detail    text NOT NULL DEFAULT '',
  ip_address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 最新ログが先に来るようにインデックス
CREATE INDEX IF NOT EXISTS admin_logs_created_at_idx ON admin_logs (created_at DESC);

-- アクション別に検索できるようにインデックス
CREATE INDEX IF NOT EXISTS admin_logs_action_idx ON admin_logs (action);

-- Row Level Security（サービスロールキー経由のみ書き込み可）
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- 外部からの直接アクセスを全て禁止
-- （サーバーサイドの service_role キーは RLS を bypass する）
CREATE POLICY "no_public_access" ON admin_logs
  FOR ALL
  USING (false);

-- コメント
COMMENT ON TABLE admin_logs IS '管理者操作履歴（ログイン・キャンセル・出航確定など）';
COMMENT ON COLUMN admin_logs.action IS 'login / logout / weather_cancel / admin_cancel / approve_cancel / reject_cancel / departure_confirm / thank_you_send';
COMMENT ON COLUMN admin_logs.detail IS '操作の詳細（予約番号・日程IDなど）';
COMMENT ON COLUMN admin_logs.ip_address IS '操作元IPアドレス';
