-- Migration 002: Event contract v2 — canonical event types + dedup + lineage
-- Applied to: buyerrecon-backend Postgres (Render managed)
-- Safe: all ALTER ADD COLUMN with defaults, additive only

ALTER TABLE accepted_events ADD COLUMN IF NOT EXISTS client_event_id TEXT;
ALTER TABLE accepted_events ADD COLUMN IF NOT EXISTS page_view_id TEXT;
ALTER TABLE accepted_events ADD COLUMN IF NOT EXISTS previous_page_view_id TEXT;
ALTER TABLE accepted_events ADD COLUMN IF NOT EXISTS event_sequence_index INT;
ALTER TABLE accepted_events ADD COLUMN IF NOT EXISTS event_contract_version TEXT NOT NULL DEFAULT 'legacy-thin-v2.0';

CREATE UNIQUE INDEX IF NOT EXISTS idx_accepted_dedup_client_event
  ON accepted_events (site_id, session_id, client_event_id)
  WHERE client_event_id IS NOT NULL;

-- Rollback (if needed):
-- ALTER TABLE accepted_events DROP COLUMN IF EXISTS client_event_id;
-- ALTER TABLE accepted_events DROP COLUMN IF EXISTS page_view_id;
-- ALTER TABLE accepted_events DROP COLUMN IF EXISTS previous_page_view_id;
-- ALTER TABLE accepted_events DROP COLUMN IF EXISTS event_sequence_index;
-- ALTER TABLE accepted_events DROP COLUMN IF EXISTS event_contract_version;
-- DROP INDEX IF EXISTS idx_accepted_dedup_client_event;
