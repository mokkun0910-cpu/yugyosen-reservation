-- 同行者リマインダー送信日時を管理するカラムを追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS companion_reminded_at TIMESTAMPTZ;
