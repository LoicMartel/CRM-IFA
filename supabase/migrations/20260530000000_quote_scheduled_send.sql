-- Scheduled quote send: store the date a deal's quote should be auto-generated+sent.
-- The pennylane-sync cron scans due rows (quote_scheduled_send_at <= now, no quote yet).
ALTER TABLE deals ADD COLUMN IF NOT EXISTS quote_scheduled_send_at timestamptz;

-- Partial index for the cron scan (only pending scheduled sends).
CREATE INDEX IF NOT EXISTS idx_deals_quote_scheduled_send
  ON deals (quote_scheduled_send_at)
  WHERE quote_scheduled_send_at IS NOT NULL AND pennylane_quote_id IS NULL;
