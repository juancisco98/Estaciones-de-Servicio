-- scan_requests: allows dashboard users to trigger a remote scan of SVAPP files
-- The edge agent polls this table every 15 seconds for pending requests.

CREATE TABLE IF NOT EXISTS scan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_by TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  files_processed INT DEFAULT 0,
  error_message TEXT
);

-- Index for the edge agent polling query (status = pending + station filter)
CREATE INDEX IF NOT EXISTS idx_scan_requests_pending
  ON scan_requests (station_id, status)
  WHERE status = 'pending';

-- RLS: same pattern as other tables
ALTER TABLE scan_requests ENABLE ROW LEVEL SECURITY;

-- Admin can see all scan requests
CREATE POLICY "admin_scan_requests" ON scan_requests
  FOR ALL
  USING ((auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails));

-- Service role (edge agent) can read/update scan requests for its station
-- (edge agent uses service_role key, which bypasses RLS)

-- Cleanup: auto-delete completed requests older than 7 days (optional, run manually or via cron)
-- DELETE FROM scan_requests WHERE status IN ('completed', 'failed') AND requested_at < now() - interval '7 days';
