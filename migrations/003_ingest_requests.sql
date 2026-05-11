-- Migration 003: Sprint 1 PR#1 — ingest_requests ledger (additive, new table only)
-- Spec: /Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md §2.7
-- PR scope: §3.PR#1 — "Add ingest_requests ledger (new table). No code yet writes to it."
--
-- Safe: additive only. Creates one new table and two indexes. No existing
-- table is altered. accepted_events and rejected_events are untouched.
--
-- Out of scope for this PR (per §3.PR#1):
--   - collector write logic (§3.PR#5)
--   - accepted_events / rejected_events ALTERs (§3.PR#2 / §3.PR#3)
--   - workspace / site auth boundary (§3.PR#4)
--   - per-stage validators / canonical reason-code enum (§3.PR#5)
--   - dedup index (§3.PR#6)
--   - new endpoints (§3.PR#7)
--   - SQL verification suite (§3.PR#8)
--   - admin debug API (§3.PR#9)
--
-- This migration deliberately matches §2.7 exactly:
--   - request_id has NO database default; the collector generates the UUID.
--   - request_body_sha256 is NOT NULL; it is the only proof when the body is
--     unparseable, and is distinct from accepted_events.payload_sha256
--     (per-event) and rejected_events.raw_payload_sha256 (per-rejected-event).
--   - auth_status is NOT NULL TEXT with no DB CHECK enum; allowed values are
--     defined in §2.7 ('ok' | 'invalid_token' | 'site_disabled' |
--     'boundary_mismatch'). DB CHECK enum promotion is deferred per the §2.9
--     closing note; the §2.12 SQL verification suite (§3.PR#8) is the
--     contractual substitute in Sprint 1.
--   - The reconciliation invariant
--       accepted_count + rejected_count = expected_event_count once
--       reconciled_at IS NOT NULL
--     is NOT enforced as a table CHECK constraint. §2.7 places enforcement
--     on the §2.12 SQL suite, and §2.9 defers DB CHECK promotion. Adding a
--     CHECK here would diverge from the canonical contract.
--
-- Rollback: see end of file.

CREATE TABLE IF NOT EXISTS ingest_requests (
  request_id            UUID PRIMARY KEY,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Boundary (resolved from auth in §3.PR#4; nullable in PR#1)
  workspace_id          TEXT,
  site_id               TEXT,

  -- Wire context
  endpoint              TEXT NOT NULL,                     -- /v1/event | /v1/batch
  http_status           INT,                               -- 200, 400, 413, 401, 403, 415, 429, 500
  size_bytes            INT NOT NULL,
  user_agent            TEXT,
  ip_hash               TEXT NOT NULL,
  request_body_sha256   TEXT NOT NULL,                     -- SHA-256 of the FULL HTTP request body (raw bytes received).
                                                           -- Distinct from accepted_events.payload_sha256 (per-event) and
                                                           -- rejected_events.raw_payload_sha256 (per-rejected-event when parseable).
                                                           -- Always set, even when request was rejected before parsing —
                                                           -- this is the only proof when the body is unparseable.

  -- Reconciliation
  expected_event_count  INT NOT NULL,                      -- 1 for /v1/event when parseable; events.length for /v1/batch when parseable;
                                                           -- 0 when request was rejected BEFORE event parsing.
  accepted_count        INT NOT NULL DEFAULT 0,
  rejected_count        INT NOT NULL DEFAULT 0,
  reconciled_at         TIMESTAMPTZ,                       -- set once accepted_count + rejected_count = expected_event_count.
                                                           -- For request-level rejection, reconciled_at is set at the same
                                                           -- moment as received_at (sub-millisecond drift permitted).

  -- Auth state
  auth_status           TEXT NOT NULL,                     -- ok | invalid_token | site_disabled | boundary_mismatch
  reject_reason_code    TEXT,                              -- only when whole request rejected before per-event work
  collector_version     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ingest_requests_workspace_received
  ON ingest_requests (workspace_id, site_id, received_at);

CREATE INDEX IF NOT EXISTS ingest_requests_unreconciled
  ON ingest_requests (received_at) WHERE reconciled_at IS NULL;

-- ---------------------------------------------------------------------------
-- Rollback (additive, no data dependency — see §3.PR#1 rollback column):
--
--   DROP INDEX IF EXISTS ingest_requests_unreconciled;
--   DROP INDEX IF EXISTS ingest_requests_workspace_received;
--   DROP TABLE IF EXISTS ingest_requests;
--
-- Safe because:
--   - No existing table is altered by this migration.
--   - No application code writes to ingest_requests yet (§3.PR#5 wires it).
--   - accepted_events / rejected_events are unaffected.
-- ---------------------------------------------------------------------------
