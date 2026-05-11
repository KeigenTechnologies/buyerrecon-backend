-- Migration 006: Sprint 1 PR#4 — site_write_tokens (workspace/site auth resolution layer)
-- Track B (BuyerRecon Evidence Foundation), NOT Track A (AMS Behaviour QA scoring harness)
-- and NOT Core AMS (the future productized scoring/report home).
-- Spec: /Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md
--   - §1 Decision #4 (workspace boundary policy: auth-derived, never payload-trusted)
--   - §2.1 server-stamped fields (workspace_id / site_id stamped from auth, not payload)
--   - §2.2 Collector API surface / Auth header
--   - §2.7 ingest_requests (auth_status enum: ok | invalid_token | site_disabled | boundary_mismatch)
--   - §2.8 reason-code enum: auth_invalid, auth_site_disabled, workspace_site_mismatch
--   - §2.9 R-rules (boundary / auth)
--   - §3.PR#4 (workspace resolution layer + site_write_tokens table)
--   - §3 invariant: workspace boundary is auth-derived, never payload-trusted
--   - §4.1 acceptance line #5 (Site-A token + payload site_id='B' → workspace_site_mismatch)
--
-- Safe: additive only. CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- No data migration. No constraint promotion. No FK. No CHECK. accepted_events,
-- rejected_events, ingest_requests are NOT touched.
--
-- Token-hash strategy (see PR#4 doc for rationale):
--   token_hash = HMAC-SHA256(token, SITE_WRITE_TOKEN_PEPPER)
--   - Pepper held in env (never in DB), defends against DB-leak offline matching.
--   - Per-row salt is intentionally absent: tokens are high-entropy unique inputs,
--     so per-row salt buys nothing the pepper doesn't already provide and breaks
--     O(1) indexed lookup.
--   - Raw token is NEVER stored.
--
-- Three-part architecture rule:
--   This migration MUST NOT introduce bot-detection, AI-agent-detection, risk
--   scoring, classification, recommended-action, behavioural-quality scoring,
--   or any other Track A scoring surface. Track B records evidence; scoring
--   lives in Track A (experimental harness) and will eventually live in Core
--   AMS as a productized package, never on this table.
--
-- Out of scope for this PR (per §1 / §4.1 + three-part architecture rule):
--   - any change to accepted_events / rejected_events / ingest_requests
--   - collector wiring / per-stage validators / canonical reason-code enum (§3.PR#5)
--   - dedup unique index promotion (§3.PR#6)
--   - new endpoints (§3.PR#7)
--   - SQL verification suite scheduling (§3.PR#8)
--   - admin debug API (§3.PR#9)
--   - bot detection / AI-agent detection / risk score / classification
--   - Track A backend bridge / Core AMS scoring package
--   - report worker / live RECORD_ONLY traffic
--
-- Rollback: see end of file.

CREATE TABLE IF NOT EXISTS site_write_tokens (
  token_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      TEXT NOT NULL UNIQUE,                    -- HMAC-SHA256(raw_token, pepper); raw token NEVER stored
  workspace_id    TEXT NOT NULL,
  site_id         TEXT NOT NULL,
  label           TEXT,                                    -- admin-friendly free-form description
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at     TIMESTAMPTZ,                             -- soft-delete sentinel; NULL = active
  last_used_at    TIMESTAMPTZ                              -- touched by PR#5+ collector; PR#4 helper does NOT write
);

-- Admin: list tokens for a given workspace+site.
CREATE INDEX IF NOT EXISTS site_write_tokens_workspace_site
  ON site_write_tokens (workspace_id, site_id);

-- Hot-path: active-tokens-only filter on the unique-hash lookup.
-- The UNIQUE constraint on token_hash creates a full unique index covering all
-- rows; this partial index speeds up admin "list active" scans by skipping
-- disabled rows and is small (only active tokens).
CREATE INDEX IF NOT EXISTS site_write_tokens_active
  ON site_write_tokens (token_hash) WHERE disabled_at IS NULL;

-- ---------------------------------------------------------------------------
-- Rollback (additive, no data dependency):
--
--   DROP INDEX IF EXISTS site_write_tokens_active;
--   DROP INDEX IF EXISTS site_write_tokens_workspace_site;
--   DROP TABLE IF EXISTS site_write_tokens;
--
-- Safe because:
--   - No FK references this table.
--   - No application code yet reads or writes site_write_tokens at runtime
--     (collector wiring lands in §3.PR#5; PR#4 only ships the table + a pure
--     resolution helper that takes a "lookupByHash" callback as a parameter,
--     so the helper never opens a DB connection on its own).
--   - accepted_events / rejected_events / ingest_requests are not touched.
-- ---------------------------------------------------------------------------
