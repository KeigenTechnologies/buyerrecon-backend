-- Migration 004: Sprint 1 PR#2 — accepted_events evidence-column augmentation (additive)
-- Track B (BuyerRecon Evidence Foundation), NOT Track A (AMS Behaviour QA scoring harness).
-- Spec: /Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md
--   - §2.5 (canonical accepted_events target shape)
--   - §3.PR#2 (additive ALTERs, request_id initially nullable)
--   - Appendix A.1 (accepted_events delta)
--   - §1 Sprint 1 scope exclusions
--
-- Safe: additive only. ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- No data migration. No constraint promotion. No FK. No CHECK. No NOT NULL on
-- new columns. No rename. No drop. accepted_events existing rows are unaffected:
-- nullable adds default to NULL; non-nullable defaults stamp the listed default
-- on every existing row (Postgres 11+ fast-default — metadata-only).
--
-- Why nullable in this PR (per §3.PR#2 migration rule):
--   The collector is not wired yet (§3.PR#5). Existing accepted_events rows
--   pre-date the ingest_requests ledger and cannot be reconstructed back to a
--   ledger row safely. Promoting request_id (or any other column) to NOT NULL
--   here would either require an unsafe synthetic backfill or fail outright on
--   legacy rows. The §3.PR#2 migration rule defers DB-level NOT NULL enforcement
--   until §3.PR#5+ has run a verified backfill / cutover. The application write
--   path and §2.12 verification suite enforce non-null request_id (and the other
--   target NOT NULL columns) for new v1 rows in the meantime.
--
-- Track A / Track B separation (hard rule):
--   This migration MUST NOT introduce bot-detection, AI-agent-detection, risk
--   scoring, classification, recommended-action, or any other Track A scoring
--   surface. Sprint 1 §4.1 "Out of scope for Task 1" forbids it. The only
--   Track-A-adjacent placeholders that are allowed in Sprint 1 (and added
--   here) are the structural enums event_origin and traffic_class — both are
--   evidence labels, NOT scoring outputs. traffic_class defaults to 'unknown'
--   per Decision #13 and stays 'unknown' across Sprint 1.
--
-- Relationship to §2.5 (deliberate sub-set in PR#2 — full set lands across PR#3 / PR#5):
--   §2.5 lists additional columns (accepted_at, event_name, sent_at,
--   anonymous_id, user_id, company_id, user_agent, sdk_name, sdk_version,
--   occurred_at) that PR#2 does NOT add. Those land in subsequent PRs alongside
--   the related collector / session / SDK wiring. PR#2 lands the 23-column
--   evidence sub-set required as the next dependency for Track A Sprint 2
--   backend bridge (request linkage, boundary, identity, schema, traffic_class,
--   per-event hashes, consent / storage evidence, session evidence, canonical
--   projection placeholder, raw-body purge sentinel, debug_mode placeholder).
--
-- Three deferrals from a literal §2.5 transcription (flagged for reviewer awareness):
--   1. canonical_jsonb is nullable in PR#2 (§2.5 target: NOT NULL). Existing
--      legacy rows cannot be safely projected to a canonical shape in this PR;
--      promotion to NOT NULL is deferred to a post-backfill PR.
--   2. The existing raw JSONB NOT NULL column is NOT renamed to payload_jsonb
--      (§2.5 target name) and NOT dropped to nullable in PR#2. Renames /
--      NOT-NULL drops on legacy hot-table columns are explicitly out of PR#2
--      scope. The eventual reconciliation (raw → payload_jsonb purgeable) is
--      a separate, post-backfill concern.
--   3. accepted_events_workspace_site index (§2.5 target keys it on
--      occurred_at) is NOT created here because occurred_at is not yet a
--      column on accepted_events. The user's PR#2 column list does not add
--      occurred_at. The index lands when occurred_at lands.
--
-- Out of scope for this PR (Track B Sprint 1 §1 / §4.1):
--   - any change to rejected_events (§3.PR#3)
--   - workspace resolution layer (§3.PR#4)
--   - collector wiring / per-stage validators / canonical reason-code enum (§3.PR#5)
--   - dedup unique index promotion (§3.PR#6 — uses CREATE UNIQUE INDEX CONCURRENTLY)
--   - new endpoints (§3.PR#7)
--   - SQL verification suite scheduling (§3.PR#8)
--   - admin debug API (§3.PR#9)
--   - bot detection
--   - AI-agent detection
--   - risk score / classification / recommended_action
--   - report worker
--   - live RECORD_ONLY traffic
--
-- Rollback: see end of file.

ALTER TABLE accepted_events
  ADD COLUMN IF NOT EXISTS request_id           UUID,
  ADD COLUMN IF NOT EXISTS workspace_id         TEXT,
  ADD COLUMN IF NOT EXISTS validator_version    TEXT,
  ADD COLUMN IF NOT EXISTS schema_key           TEXT,
  ADD COLUMN IF NOT EXISTS schema_version       TEXT,
  ADD COLUMN IF NOT EXISTS event_origin         TEXT,
  ADD COLUMN IF NOT EXISTS id_format            TEXT,
  ADD COLUMN IF NOT EXISTS traffic_class        TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS payload_sha256       TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes           INT,
  ADD COLUMN IF NOT EXISTS ip_hash              TEXT,
  ADD COLUMN IF NOT EXISTS consent_state        TEXT,
  ADD COLUMN IF NOT EXISTS consent_source       TEXT,
  ADD COLUMN IF NOT EXISTS consent_updated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pre_consent_mode     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tracking_mode        TEXT,
  ADD COLUMN IF NOT EXISTS storage_mechanism    TEXT,
  ADD COLUMN IF NOT EXISTS session_seq          INT,
  ADD COLUMN IF NOT EXISTS session_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canonical_jsonb      JSONB,
  ADD COLUMN IF NOT EXISTS payload_purged_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS debug_mode           BOOLEAN DEFAULT FALSE;

-- Index supporting per-request reconciliation joins (§2.12 cross-table checks,
-- accepted-side variant) and admin debug retrieval by request_id (§3.PR#9).
-- Plain (non-CONCURRENTLY) index — repo convention; column is NULL on every
-- legacy row so initial index size is small.
CREATE INDEX IF NOT EXISTS accepted_events_request_id
  ON accepted_events (request_id);

-- ---------------------------------------------------------------------------
-- Rollback (additive, no data dependency):
--
--   DROP INDEX IF EXISTS accepted_events_request_id;
--   ALTER TABLE accepted_events
--     DROP COLUMN IF EXISTS debug_mode,
--     DROP COLUMN IF EXISTS payload_purged_at,
--     DROP COLUMN IF EXISTS canonical_jsonb,
--     DROP COLUMN IF EXISTS session_last_seen_at,
--     DROP COLUMN IF EXISTS session_started_at,
--     DROP COLUMN IF EXISTS session_seq,
--     DROP COLUMN IF EXISTS storage_mechanism,
--     DROP COLUMN IF EXISTS tracking_mode,
--     DROP COLUMN IF EXISTS pre_consent_mode,
--     DROP COLUMN IF EXISTS consent_updated_at,
--     DROP COLUMN IF EXISTS consent_source,
--     DROP COLUMN IF EXISTS consent_state,
--     DROP COLUMN IF EXISTS ip_hash,
--     DROP COLUMN IF EXISTS size_bytes,
--     DROP COLUMN IF EXISTS payload_sha256,
--     DROP COLUMN IF EXISTS traffic_class,
--     DROP COLUMN IF EXISTS id_format,
--     DROP COLUMN IF EXISTS event_origin,
--     DROP COLUMN IF EXISTS schema_version,
--     DROP COLUMN IF EXISTS schema_key,
--     DROP COLUMN IF EXISTS validator_version,
--     DROP COLUMN IF EXISTS workspace_id,
--     DROP COLUMN IF EXISTS request_id;
--
-- Safe because:
--   - All adds were nullable (or non-nullable with a constant DEFAULT and no
--     application reads), so no row was forced to a non-null value the app
--     depends on.
--   - No FK references any of the new columns.
--   - No application code yet reads or writes these columns (collector
--     wiring lands in §3.PR#5).
--   - rejected_events is not touched by this migration.
-- ---------------------------------------------------------------------------
