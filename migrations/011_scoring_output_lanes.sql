-- Migration 011: Sprint 2 PR#3 — Lane A / Lane B scoring output contract layer
-- (schema-only; no writer; no scorer; no router; no observer)
--
-- Track B (BuyerRecon Evidence Foundation), Sprint 2 PR#3.
--
-- This migration creates the two scoring-output tables that future
-- Sprint 2 PR#5 (Stage 0) and PR#6 (Stage 1 Lane A scorer) plus the
-- deferred PR#3b (router + Lane B observer) will write to. PR#3 ships
-- ONLY the typed surface: tables + role grants + Hard-Rule-I assertion.
-- PR#3 writes no rows.
--
-- Hard non-scoring boundary (PR#3 MUST NOT introduce):
--   - risk_score / score / classification / recommended_action /
--     confidence_band / is_bot / is_agent / ai_agent / is_human /
--     buyer_intent / lead_quality / CRM / company_enrich / ip_enrich /
--     verified / confirmed columns or values.
--     (The single allowed score-shaped identifier in PR#3 is
--      `verification_score` on scoring_output_lane_a, named by A0 §D
--      step 7 + signal-truth-v0.1 §10 Hard Rule A.)
--   - A_* / B_* / REVIEW_* / OBS_* / UX_* emitted reason codes.
--   - INSERT statements of any kind. The `reason_codes` JSONB column is
--     a TYPED RESERVATION, never populated by this migration. The
--     downstream scorer (PR#5 / PR#6 / PR#3b) inserts rows.
--   - CREATE ROLE / ALTER ROLE … {SUPERUSER, CREATEROLE, CREATEDB,
--     BYPASSRLS, PASSWORD}. Role lifecycle is operator-only and lives
--     in docs/ops/pr3-db-role-setup-staging.md Phase 3.
--
-- Authority:
--   - docs/architecture/ARCHITECTURE_GATE_A0.md §K row PR#3 + §D 6 + 8
--   - docs/contracts/signal-truth-v0.1.md §10 Hard Rules A / B / H / I
--   - docs/sprint2-pr3-scoring-output-contracts-planning.md (Codex PASS)
--   - docs/ops/pr3-db-role-setup-staging.md (operator role pack)
--
-- Helen sign-off (OD-1..OD-8):
--   OD-1: schema-only PR#3; router + Lane B observer deferred to PR#3b.
--   OD-2: natural key = (workspace_id, site_id, session_id, scoring_version).
--   OD-3: migration name = migrations/011_scoring_output_lanes.sql.
--   OD-4: reason_codes JSONB array, default '[]'::jsonb, no element CHECK
--         (scorer startup validates against reason_code_dictionary.yml).
--   OD-5: deferred follow-on PR named PR#3b.
--   OD-6: verification_method_strength reserved as nullable TEXT;
--         v1 enforces NULL via a CHECK constraint.
--   OD-7: Lane A redacted customer-facing view deferred to a later PR;
--         in PR#3, customer-facing role has zero direct SELECT on Lane A.
--   OD-8: canonical roles confirmed pre-existing on Hetzner staging:
--           buyerrecon_migrator, buyerrecon_scoring_worker,
--           buyerrecon_customer_api, buyerrecon_internal_readonly.
--         Migration 011 asserts presence; never CREATE ROLE; PUBLIC
--         revocation is defence-in-depth only.
--
-- Safe: additive only. CREATE TABLE IF NOT EXISTS + IDempotent DO blocks
-- for CHECK constraints + role-presence assertions. No FK, no DML, no
-- modification of accepted_events / rejected_events / ingest_requests /
-- session_features / session_behavioural_features_v0_2.

-- ---------------------------------------------------------------------------
-- 0. Prerequisites
-- ---------------------------------------------------------------------------
-- pgcrypto is required for gen_random_uuid() in DEFAULT clauses.
-- schema.sql already creates it; this is belt-and-braces idempotent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Role-existence assertions (OD-8 BLOCKER guards)
-- ---------------------------------------------------------------------------
-- Migration 011 fails FAST if any of the four canonical group roles is
-- missing. Role creation is operator-only (Phase 3 of
-- docs/ops/pr3-db-role-setup-staging.md); migration 011 NEVER runs
-- CREATE ROLE.

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
-- 2. Lane A — scoring_output_lane_a (invalid-traffic / behavioural rubric)
-- ---------------------------------------------------------------------------
-- Future writer: Sprint 2 PR#6 Lane A scorer (vendored from Track A
-- lib/stage1-behaviour-score.js). PR#3 ships NO writer.
--
-- Hard Rules enforced by this table:
--   Hard Rule A: evidence_band ∈ {low, medium}; 'high' unrepresentable.
--   Hard Rule B: action_recommendation defaults to 'record_only';
--                v1 enum = {record_only, review}.
--
-- The `verification_score` column is the single carve-out to the
-- "no score-shaped identifiers" rule (A0 §D step 7 + signal-truth-v0.1
-- §10 Hard Rule A name it as the canonical contract column).

CREATE TABLE IF NOT EXISTS scoring_output_lane_a (
  scoring_output_lane_a_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id               TEXT         NOT NULL,
  site_id                    TEXT         NOT NULL,
  session_id                 TEXT         NOT NULL,
  scoring_version            TEXT         NOT NULL,
  source_feature_version     TEXT,
  verification_score         INT          NOT NULL,
  evidence_band              TEXT         NOT NULL,
  action_recommendation      TEXT         NOT NULL DEFAULT 'record_only',
  reason_codes               JSONB        NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs              JSONB        NOT NULL DEFAULT '[]'::jsonb,
  knob_version_id            TEXT,
  record_only                BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT scoring_output_lane_a_verification_score_range
    CHECK (verification_score BETWEEN 0 AND 99),
  CONSTRAINT scoring_output_lane_a_evidence_band_enum
    CHECK (evidence_band IN ('low','medium')),
  CONSTRAINT scoring_output_lane_a_action_recommendation_enum
    CHECK (action_recommendation IN ('record_only','review')),
  CONSTRAINT scoring_output_lane_a_reason_codes_is_array
    CHECK (jsonb_typeof(reason_codes) = 'array'),
  CONSTRAINT scoring_output_lane_a_evidence_refs_is_array
    CHECK (jsonb_typeof(evidence_refs) = 'array'),

  CONSTRAINT scoring_output_lane_a_natural_key UNIQUE
    (workspace_id, site_id, session_id, scoring_version)
);

CREATE INDEX IF NOT EXISTS scoring_output_lane_a_workspace_site
  ON scoring_output_lane_a (workspace_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scoring_output_lane_a_session
  ON scoring_output_lane_a (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS scoring_output_lane_a_version
  ON scoring_output_lane_a (scoring_version, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Lane B — scoring_output_lane_b (declared-agent observation)
-- ---------------------------------------------------------------------------
-- Future writer: Sprint 2 PR#3b Lane B observer (deferred per OD-1).
-- PR#3 ships NO writer.
--
-- Hard Rule I (customer-facing role has zero SELECT on this table) is
-- enforced by §4 grants below.
-- v1 invariant: verification_method_strength MUST be NULL (reserved-not-
-- emitted per signal-truth-v0.1 §11 + OD-6). Enforced by CHECK.

CREATE TABLE IF NOT EXISTS scoring_output_lane_b (
  scoring_output_lane_b_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                    TEXT         NOT NULL,
  site_id                         TEXT         NOT NULL,
  session_id                      TEXT         NOT NULL,
  scoring_version                 TEXT         NOT NULL,
  agent_family                    TEXT         NOT NULL,
  verification_method             TEXT         NOT NULL,
  verification_method_strength    TEXT,
  reason_codes                    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs                   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  record_only                     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT scoring_output_lane_b_verification_method_enum
    CHECK (verification_method IN ('reverse_dns','ip_validation','web_bot_auth','partner_allowlist','none')),
  CONSTRAINT scoring_output_lane_b_strength_null_v1
    CHECK (verification_method_strength IS NULL),
  CONSTRAINT scoring_output_lane_b_reason_codes_is_array
    CHECK (jsonb_typeof(reason_codes) = 'array'),
  CONSTRAINT scoring_output_lane_b_evidence_refs_is_array
    CHECK (jsonb_typeof(evidence_refs) = 'array'),

  CONSTRAINT scoring_output_lane_b_natural_key UNIQUE
    (workspace_id, site_id, session_id, scoring_version)
);

CREATE INDEX IF NOT EXISTS scoring_output_lane_b_workspace_site
  ON scoring_output_lane_b (workspace_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scoring_output_lane_b_session
  ON scoring_output_lane_b (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS scoring_output_lane_b_version
  ON scoring_output_lane_b (scoring_version, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Role grants (idempotent; defence-in-depth + Hard Rule I)
-- ---------------------------------------------------------------------------
-- Order: PUBLIC revocation first (defence-in-depth only, NEVER proof of
-- Hard Rule I), then explicit grants by confirmed canonical role.
--
-- buyerrecon_customer_api receives NO direct SELECT on either lane
-- table in PR#3:
--   - Lane B: Hard Rule I.
--   - Lane A: OD-7 defers the redacted customer-facing view. v1
--     customer-facing path has zero direct raw-table access on Lane A.

REVOKE ALL ON scoring_output_lane_a FROM PUBLIC;
REVOKE ALL ON scoring_output_lane_b FROM PUBLIC;

-- Migrator: schema-level operational access. The migrator role runs
-- DDL on this table set; grant matches the existing pattern (no FORCE
-- ROW LEVEL SECURITY because no RLS is defined; standard ALL).
GRANT ALL ON scoring_output_lane_a TO buyerrecon_migrator;
GRANT ALL ON scoring_output_lane_b TO buyerrecon_migrator;

-- Scoring worker: future writer for both lanes. PR#3 ships no writer.
GRANT SELECT, INSERT, UPDATE ON scoring_output_lane_a TO buyerrecon_scoring_worker;
GRANT SELECT, INSERT, UPDATE ON scoring_output_lane_b TO buyerrecon_scoring_worker;

-- Internal readonly: SELECT on both lanes for internal audit/reporting.
GRANT SELECT ON scoring_output_lane_a TO buyerrecon_internal_readonly;
GRANT SELECT ON scoring_output_lane_b TO buyerrecon_internal_readonly;

-- Customer-facing API: explicit REVOKE on both lanes (belt-and-braces;
-- no prior GRANT was issued in this migration, but a future operator
-- mistake or earlier accidental grant must be neutralised here).
REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_customer_api;
REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_customer_api;

-- ---------------------------------------------------------------------------
-- 5. Hard Rule I post-migration assertion
-- ---------------------------------------------------------------------------
-- Final guard: if buyerrecon_customer_api somehow retains SELECT on
-- scoring_output_lane_b after the REVOKEs above (e.g. inherited via
-- role membership the operator forgot to break), this migration fails
-- and rolls back the transaction.

DO $$
BEGIN
  -- has_table_privilege expects (role name, table regclass, privilege text).
  -- Without explicit casts, unannotated literals resolve as `unknown`
  -- and Postgres reports "function does not exist". The first arg is
  -- the Postgres `name` type; the table arg is `regclass`.
  IF has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_b'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api still has SELECT on scoring_output_lane_b after REVOKE; Hard Rule I violated. Investigate role memberships before re-running.';
  END IF;
  -- OD-7 baseline: Lane A also has zero direct customer-facing SELECT
  -- in PR#3 (redacted view deferred). Flag if violated.
  IF has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_a'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api has SELECT on scoring_output_lane_a; OD-7 deferred redacted view, no direct Lane A access in PR#3. Investigate role memberships.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (operator-only, NOT executed by this migration):
--
--   -- Revoke grants first (no CASCADE).
--   REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_migrator;
--   REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_scoring_worker;
--   REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_internal_readonly;
--   REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_migrator;
--   REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_scoring_worker;
--   REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_internal_readonly;
--
--   -- Drop tables (no CASCADE — neither table is referenced by any FK).
--   DROP TABLE IF EXISTS scoring_output_lane_a;
--   DROP TABLE IF EXISTS scoring_output_lane_b;
--
-- Safe because:
--   - PR#3 writes no rows. Rollback is data-loss-free.
--   - No FK references either table.
--   - The four canonical group roles are NOT dropped (they pre-exist
--     migration 011 per OD-8 and are operator-owned).
--   - accepted_events / rejected_events / ingest_requests /
--     session_features / session_behavioural_features_v0_2 are not
--     touched by this migration; they remain unchanged after rollback.
-- ---------------------------------------------------------------------------
