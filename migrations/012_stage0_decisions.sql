-- Migration 012: Sprint 2 PR#5 — Stage 0 RECORD_ONLY downstream worker
-- (new table; no FK; additive only; no change to migrations 001..011).
--
-- Track B (BuyerRecon Evidence Foundation), Sprint 2 PR#5.
--
-- This migration creates `stage0_decisions`, the destination table for
-- Stage 0 hard-exclusion verdicts emitted by the BuyerRecon worker that
-- vendors Track A `lib/stage0-hard-exclusion.js` (per A0 §K row PR#5).
-- The vendored lib is BYTE-FOR-BYTE upstream at SHA-256
-- 7dc97bd96875df8ad0f45d819ba37fd5c8076aaae8748183540a72e43c82b303
-- (Track A commit 6ce15f20d6349ee89b8cba6412b6c74e297cad4d). BuyerRecon-
-- side adaptation (P-11 AI-crawler reclassification, rule_id mapping,
-- rule_inputs minimization) lives in src/scoring/stage0/ — not in the
-- vendor copy. See docs/vendor/track-a-stage0-pr5.md.
--
-- PR#5 ships RECORD_ONLY. No scoring. No reason-code emission. No
-- Lane A writes. No Lane B writes. No `verification_score`,
-- `evidence_band`, `action_recommendation`, or `reason_codes` columns.
--
-- Authority:
--   - docs/architecture/ARCHITECTURE_GATE_A0.md §K row PR#5 + §0.6 P-9 + P-11 + §I.5 vendor-audit checklist
--   - docs/contracts/signal-truth-v0.1.md §10 Hard Rules A / B / C / D / I
--   - docs/sprint2-pr5-stage0-record-only-worker-planning.md (Codex PASS)
--   - docs/sprint2-pr5-helen-signoff-decisions.md (Helen-signed P-9 + P-11 + OD-1..OD-12)
--   - docs/vendor/track-a-stage0-pr5.md (source proof)
--
-- Helen sign-off OD-1..OD-12 implemented here:
--   OD-1 writer mode: ships migration + worker; writes stage0_decisions.
--   OD-2 no verification_score column.
--   OD-3 rule_id enum CHECK; NO reason_codes column.
--   OD-4 reads accepted_events + ingest_requests via request_id only (worker-side; this migration creates the destination only).
--   OD-5 P-11 minimum scope; adapter-side correction (not encoded in DDL).
--   OD-6 vendored Stage 0 core only; Stage 1 stubs discarded (worker-side).
--   OD-7 full Hetzner staging DB proof required.
--   OD-8 no action_recommendation column.
--   OD-9 stage0_decisions is a NEW table; Lane A unchanged.
--   OD-10 5-column natural key including scoring_version.
--   OD-11 JSONB shape CHECKs on rule_inputs (object) + evidence_refs (array); rule_inputs minimization enforced by worker code + DB tests + verification SQL (cannot be a single CHECK constraint).
--   OD-12 session_features / session_behavioural_features_v0_2 not read (worker-side).
--
-- Safe: additive only. CREATE TABLE IF NOT EXISTS + idempotent DO
-- blocks for role-existence assertions + post-migration Hard-Rule-I
-- style privilege check.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Role-existence assertions (OD-8 / PR#3 pattern)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_migrator') THEN
    RAISE EXCEPTION 'BLOCKER: role buyerrecon_migrator not found; run docs/ops/pr3-db-role-setup-staging.md Phase 3 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_scoring_worker') THEN
    RAISE EXCEPTION 'BLOCKER: role buyerrecon_scoring_worker not found; run docs/ops/pr3-db-role-setup-staging.md Phase 3 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_customer_api') THEN
    RAISE EXCEPTION 'BLOCKER: role buyerrecon_customer_api not found; run docs/ops/pr3-db-role-setup-staging.md Phase 3 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_internal_readonly') THEN
    RAISE EXCEPTION 'BLOCKER: role buyerrecon_internal_readonly not found; run docs/ops/pr3-db-role-setup-staging.md Phase 3 first.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. stage0_decisions table
-- ---------------------------------------------------------------------------
-- 5-column natural key per OD-10:
--   (workspace_id, site_id, session_id, stage0_version, scoring_version)
-- Both versions are independent provenance axes.
--
-- rule_id is a Stage-0-specific enum text — NOT a reason_code from
-- reason_code_dictionary.yml. The enum values are the upstream RULES
-- names (lines 76-156 of stage0-hard-exclusion.js) plus the sentinel
-- 'no_stage0_exclusion' for non-excluded sessions.

CREATE TABLE IF NOT EXISTS stage0_decisions (
  stage0_decision_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          TEXT         NOT NULL,
  site_id               TEXT         NOT NULL,
  session_id            TEXT         NOT NULL,
  stage0_version        TEXT         NOT NULL,
  scoring_version       TEXT         NOT NULL,
  excluded              BOOLEAN      NOT NULL,
  rule_id               TEXT         NOT NULL,
  rule_inputs           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  record_only           BOOLEAN      NOT NULL DEFAULT TRUE,
  source_event_count    INT          NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT stage0_decisions_rule_inputs_is_object
    CHECK (jsonb_typeof(rule_inputs) = 'object'),
  CONSTRAINT stage0_decisions_evidence_refs_is_array
    CHECK (jsonb_typeof(evidence_refs) = 'array'),
  CONSTRAINT stage0_decisions_record_only_must_be_true
    CHECK (record_only IS TRUE),
  CONSTRAINT stage0_decisions_source_event_count_nonneg
    CHECK (source_event_count >= 0),
  CONSTRAINT stage0_decisions_rule_id_enum
    CHECK (rule_id IN (
      'no_stage0_exclusion',
      'webdriver_global_present',
      'automation_globals_detected',
      'known_bot_ua_family',
      'scanner_or_probe_path',
      'impossible_request_frequency',
      'non_browser_runtime',
      'attack_like_request_pattern'
    )),
  CONSTRAINT stage0_decisions_excluded_iff_rule_id
    CHECK (
      (excluded = TRUE  AND rule_id <> 'no_stage0_exclusion')
   OR (excluded = FALSE AND rule_id = 'no_stage0_exclusion')
    ),

  CONSTRAINT stage0_decisions_natural_key UNIQUE
    (workspace_id, site_id, session_id, stage0_version, scoring_version)
);

CREATE INDEX IF NOT EXISTS stage0_decisions_workspace_site
  ON stage0_decisions (workspace_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stage0_decisions_session
  ON stage0_decisions (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS stage0_decisions_versions
  ON stage0_decisions (stage0_version, scoring_version, created_at DESC);

CREATE INDEX IF NOT EXISTS stage0_decisions_rule_id
  ON stage0_decisions (rule_id, created_at DESC)
  WHERE excluded = TRUE;

-- ---------------------------------------------------------------------------
-- 3. Role grants — mirror PR#3 OD-7 posture
-- ---------------------------------------------------------------------------

REVOKE ALL ON stage0_decisions FROM PUBLIC;

GRANT ALL ON stage0_decisions                       TO buyerrecon_migrator;
GRANT SELECT, INSERT, UPDATE ON stage0_decisions    TO buyerrecon_scoring_worker;
GRANT SELECT                  ON stage0_decisions   TO buyerrecon_internal_readonly;

-- Customer-facing role: ZERO direct SELECT on stage0_decisions
-- (mirrors PR#3 OD-7 — internal RECORD_ONLY ledger; not customer-facing).
REVOKE ALL ON stage0_decisions FROM buyerrecon_customer_api;

-- ---------------------------------------------------------------------------
-- 4. Hard Rule I parity assertion (PR#3 pattern)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF has_table_privilege('buyerrecon_customer_api'::name, 'stage0_decisions'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api still has SELECT on stage0_decisions after REVOKE; PR#3 OD-7 posture violated. Investigate role memberships before re-running.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (operator-only; NOT executed by this migration):
--
--   REVOKE ALL ON stage0_decisions FROM buyerrecon_migrator;
--   REVOKE ALL ON stage0_decisions FROM buyerrecon_scoring_worker;
--   REVOKE ALL ON stage0_decisions FROM buyerrecon_internal_readonly;
--   DROP TABLE IF EXISTS stage0_decisions;
--
-- No CASCADE — no FK references either way. The four canonical group
-- roles are NOT dropped (operator-owned per PR#3 OD-8).
-- ---------------------------------------------------------------------------
