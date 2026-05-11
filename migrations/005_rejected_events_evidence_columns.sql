-- Migration 005: Sprint 1 PR#3 — rejected_events evidence-column augmentation (additive)
-- Track B (BuyerRecon Evidence Foundation), NOT Track A (AMS Behaviour QA scoring harness)
-- and NOT Core AMS (the future productized scoring/report home).
-- Spec: /Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md
--   - §2.6 (canonical rejected_events target shape)
--   - §2.6 case table (rejected_events row vs ingest_requests-only)
--   - §3.PR#3 (additive ALTERs; request_id and raw_payload_sha256 initially nullable; reason_codes[] preserved)
--   - §2.12 SQL verification suite (checks #6, #14, #15)
--   - Appendix A.2 (rejected_events delta)
--   - §1 Sprint 1 scope exclusions
--
-- Safe: additive only. ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
-- + one bounded UPDATE backfill on the new singular reason_code column from
-- the legacy reason_codes[1]. No data is lost; legacy reason_codes[] is
-- preserved verbatim. No constraint promotion. No FK. No CHECK. No NOT NULL
-- on new columns. No rename. No drop. accepted_events and ingest_requests
-- are NOT touched.
--
-- Why nullable in this PR (per §3.PR#3 migration rule):
--   The collector is not wired yet (§3.PR#5). Existing rejected_events rows
--   pre-date the ingest_requests ledger and cannot be reconstructed back to a
--   ledger row safely. Promoting request_id (or raw_payload_sha256, etc.) to
--   NOT NULL here would either require an unsafe synthetic backfill or fail
--   outright on legacy rows. The §3.PR#3 migration rule defers DB-level
--   NOT NULL enforcement until §3.PR#5+ has run a verified backfill / cutover.
--   The application write path and §2.12 verification suite (check #15,
--   JOIN-gated on request_id) enforce non-null request_id and non-null
--   raw_payload_sha256 for new v1 rows in the meantime.
--
-- Three-part architecture rule (Track B, not Track A, not Core AMS):
--   This migration MUST NOT introduce bot-detection, AI-agent-detection, risk
--   scoring, classification, recommended-action, behavioural-quality scoring,
--   or any other Track A scoring surface on rejected_events. Sprint 1 §4.1
--   "Out of scope for Task 1" forbids it. Track B records evidence; scoring
--   lives in Track A (experimental harness) and will eventually live in Core
--   AMS as a productized package. The future bridge reads Track B evidence
--   and writes scoring outputs to a SEPARATE table; it never mutates the
--   semantics of rejected_events.
--
-- Three deferrals from a literal §2.6 transcription (flagged for reviewer awareness):
--   1. raw_payload_sha256 is nullable in PR#3 (§2.6 target: NOT NULL). Legacy
--      rejected rows cannot be reconstructed; promotion to NOT NULL is
--      deferred to a post-cutover PR. The §2.12 check #15 is JOIN-gated on
--      request_id, so legacy NULL rows are naturally exempt.
--   2. The existing raw JSONB NOT NULL column is NOT renamed to
--      raw_payload_jsonb (§2.6 target name) and NOT dropped to nullable in
--      PR#3. Renames / NOT-NULL drops on the legacy column are out of PR#3
--      scope. The eventual reconciliation (raw → raw_payload_jsonb 30-day
--      retention, Decision #8) is a separate post-cutover PR.
--   3. The existing primary key id BIGSERIAL is NOT renamed to
--      rejected_event_pk (§2.6 target name). PK rename is out of PR#3 scope.
--      The reconciliation SQL uses re.id accordingly.
--
-- Out of scope for this PR (per §1 / §4.1 + three-part architecture rule):
--   - any change to accepted_events (closed in §3.PR#2)
--   - any change to ingest_requests (closed in §3.PR#1)
--   - workspace resolution layer (§3.PR#4)
--   - collector wiring / per-stage validators / canonical reason-code enum (§3.PR#5)
--   - dedup unique index promotion (§3.PR#6)
--   - new endpoints (§3.PR#7)
--   - SQL verification suite scheduling (§3.PR#8)
--   - admin debug API (§3.PR#9)
--   - bot detection / AI-agent detection / risk score / classification / recommended_action
--   - Track A backend bridge
--   - Core AMS scoring package
--   - report worker
--   - live RECORD_ONLY traffic
--
-- Rollback: see end of file.

ALTER TABLE rejected_events
  ADD COLUMN IF NOT EXISTS request_id              UUID,
  ADD COLUMN IF NOT EXISTS workspace_id            TEXT,
  ADD COLUMN IF NOT EXISTS client_event_id         TEXT,
  ADD COLUMN IF NOT EXISTS id_format               TEXT,
  ADD COLUMN IF NOT EXISTS event_name              TEXT,
  ADD COLUMN IF NOT EXISTS event_type              TEXT,
  ADD COLUMN IF NOT EXISTS schema_key              TEXT,
  ADD COLUMN IF NOT EXISTS schema_version          TEXT,
  ADD COLUMN IF NOT EXISTS rejected_stage          TEXT,
  ADD COLUMN IF NOT EXISTS reason_code             TEXT,
  ADD COLUMN IF NOT EXISTS reason_detail           TEXT,
  ADD COLUMN IF NOT EXISTS schema_errors_jsonb     JSONB,
  ADD COLUMN IF NOT EXISTS pii_hits_jsonb          JSONB,
  ADD COLUMN IF NOT EXISTS raw_payload_sha256      TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes              INT,
  ADD COLUMN IF NOT EXISTS debug_mode              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sample_visible_to_admin BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS rejected_at             TIMESTAMPTZ DEFAULT NOW();

-- Backfill the new singular reason_code from legacy reason_codes[1].
-- Bounded WHERE clause: only touches rows where reason_code is still NULL
-- AND reason_codes is non-empty. Idempotent — re-running this migration
-- finds no rows to update on the second pass. Legacy reason_codes[] is
-- preserved verbatim; this is dual-write transition prep, not a removal.
UPDATE rejected_events
SET reason_code = reason_codes[1]
WHERE reason_code IS NULL
  AND reason_codes IS NOT NULL
  AND array_length(reason_codes, 1) >= 1;

-- Indexes per §2.6 target shape (unprefixed naming aligns with the canonical
-- contract; existing legacy idx_rejected_* indexes are untouched).
CREATE INDEX IF NOT EXISTS rejected_events_request_id
  ON rejected_events (request_id);

CREATE INDEX IF NOT EXISTS rejected_events_reason
  ON rejected_events (workspace_id, site_id, reason_code);

CREATE INDEX IF NOT EXISTS rejected_events_received
  ON rejected_events (workspace_id, site_id, received_at);

-- ---------------------------------------------------------------------------
-- Rollback (additive, no data dependency):
--
--   DROP INDEX IF EXISTS rejected_events_received;
--   DROP INDEX IF EXISTS rejected_events_reason;
--   DROP INDEX IF EXISTS rejected_events_request_id;
--   ALTER TABLE rejected_events
--     DROP COLUMN IF EXISTS rejected_at,
--     DROP COLUMN IF EXISTS sample_visible_to_admin,
--     DROP COLUMN IF EXISTS debug_mode,
--     DROP COLUMN IF EXISTS size_bytes,
--     DROP COLUMN IF EXISTS raw_payload_sha256,
--     DROP COLUMN IF EXISTS pii_hits_jsonb,
--     DROP COLUMN IF EXISTS schema_errors_jsonb,
--     DROP COLUMN IF EXISTS reason_detail,
--     DROP COLUMN IF EXISTS reason_code,
--     DROP COLUMN IF EXISTS rejected_stage,
--     DROP COLUMN IF EXISTS schema_version,
--     DROP COLUMN IF EXISTS schema_key,
--     DROP COLUMN IF EXISTS event_type,
--     DROP COLUMN IF EXISTS event_name,
--     DROP COLUMN IF EXISTS id_format,
--     DROP COLUMN IF EXISTS client_event_id,
--     DROP COLUMN IF EXISTS workspace_id,
--     DROP COLUMN IF EXISTS request_id;
--
-- The reason_code backfill is NOT undone by rollback (the column itself is
-- dropped, taking its values with it). Legacy reason_codes[] is preserved
-- throughout — rollback cannot affect it. Existing rejected rows remain
-- readable through the legacy reason_codes[] read path.
--
-- Safe because:
--   - All adds were nullable (or non-nullable with a constant DEFAULT and no
--     application reads), so no row was forced to a non-null value the app
--     depends on.
--   - No FK references any of the new columns.
--   - No application code yet reads the new singular reason_code (collector
--     and metrics paths still read reason_codes[]; collector wiring lands in
--     §3.PR#5).
--   - accepted_events and ingest_requests are not touched by this migration.
--   - Legacy reason_codes[] is preserved (NOT dropped); existing collector
--     and metrics read paths continue to function unchanged because they
--     read the legacy array column, which this migration leaves untouched.
-- ---------------------------------------------------------------------------
