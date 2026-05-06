-- members テーブルに line_user_id カラムを追加（同行者のLINE連携対応）
-- Supabase の SQL Editor で実行してください

ALTER TABLE members ADD COLUMN IF NOT EXISTS line_user_id text;

-- インデックス（LINE通知送信時の検索を高速化）
CREATE INDEX IF NOT EXISTS members_line_user_id_idx ON members (line_user_id)
  WHERE line_user_id IS NOT NULL;

COMMENT ON COLUMN members.line_user_id IS '同行者のLINE User ID（LIFF経由で入力した場合に設定）';
