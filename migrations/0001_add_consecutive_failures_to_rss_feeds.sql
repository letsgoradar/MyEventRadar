ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS consecutive_failures integer DEFAULT 0;
