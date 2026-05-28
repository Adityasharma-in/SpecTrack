-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new)
-- Adds user_id columns for Clerk authentication

ALTER TABLE tracked_repositories ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE repository_updates ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tracked_repositories_user_id ON tracked_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_repository_updates_user_id ON repository_updates(user_id);
