-- Migration 013: Sprint 2 PR#6 — behavioural-pattern evidence layer
-- (new table; no FK; additive only; no change to migrations 001..012).
--
-- Track B (BuyerRecon Evidence Foundation), Sprint 2 PR#6.
--
-- This migration creates `risk_observations_v0_1`, the BuyerRecon-side
-- evidence-layer table that carries finer behavioural-pattern signals
-- in the AMS `RiskInputs` / `CommonFeatures` input shape. It is the
-- BuyerRecon-side anti-corruption adapter destination for the AMS
-- Risk Core integration TODO recorded at
--   internal/riskcore/engine.go:14-21 (CommonFeatures.BehavioralRisk01
--   upstream adapter slot).
--
-- PR#6 ships RECORD_ONLY. The existing AMS Risk Core, POI Core,
-- Series Core, Trust Core, Policy Pass 1 / Pass 2, BuyerRecon
-- product layer, and BuyerRecon product output remain authoritative
-- and unchanged. PR#6 is **additive** at the evidence-input slot only
-- (Helen-signed D-11 "upgrade-not-restart" rule).
--
-- PR#6 emits NO `risk_index`, NO `verification_score`, NO
-- `evidence_band`, NO `action_recommendation`, NO `reason_codes`, NO
-- `reason_impacts`, NO `triggered_tags`, NO `penalty_total`. Those
-- are AMS Risk Core `RiskOutput` / Policy Pass 1 projection fields.
--
-- `behavioural_risk_01` is a normalised input feature in [0, 1] — NOT
-- a score, NOT customer-facing, NOT a verification_score, NOT a
-- RiskIndex. It is the input the AMS Risk Core consumes via its
-- upstream adapter.
--
-- Authority:
--   - docs/architecture/ARCHITECTURE_GATE_A0.md §K row PR#6 + §0.6 P-decisions
--   - docs/contracts/signal-truth-v0.1.md §10 Hard Rules A / B / C / D / F / I
--   - docs/sprint2-pr6-ams-risk-core-v0.1-buyerrecon-lane-a-planning.md
--     (Helen-signed §0 architecture correction; Codex PASS WITH NON-BLOCKING NOTES)
--   - AMS `internal/contracts/signals.go` — frozen `RiskInputs` / `CommonFeatures`
--   - AMS `internal/adapters/adapters.go` — `ToRiskInputs` anti-corruption pattern
--
-- Helen sign-off OD-1..OD-14 implemented here:
--   D-1   evidence-layer upgrade (NOT a Risk Core slice).
--   D-2   PR#6 title: behavioural-pattern evidence + AMS Risk Core input upgrade.
--   D-3   destination = risk_observations_v0_1 (NEW table). NOT scoring_output_lane_a.
--   D-4   zero reason-code emission; no reason_codes column on this table.
--   D-5   zero score emission; no risk_index / verification_score / evidence_band /
--         action_recommendation columns. behavioural_risk_01 is the only
--         continuous-valued column and is a normalised input feature, not a score.
--   D-6   Stage 0 eligibility enforced by worker (excluded=FALSE rows only).
--   D-7   worker reads stage0_decisions + session_behavioural_features_v0_2 only.
--   D-8   confidence ceiling not applicable; no evidence_band column.
--   D-9   cross-language integration deferred to a separate gate.
--   D-10  RECORD_ONLY + internal-only posture; customer_api zero direct SELECT.
--   D-11  upgrade-not-restart: this migration adds a NEW table; touches NO
--         existing migration; touches NO AMS code; touches NO existing AMS
--         contract. Existing AMS Risk / POI / Series / Trust / Policy
--         algorithms remain authoritative and unchanged.
--   D-12  normalisation config lives in TypeScript constants; not encoded in DDL.
--   D-13  initial ContextTag enum applied at the worker / verification-SQL layer;
--         not encoded as a DB CHECK (the enum is product-neutral and may grow).
--   D-14  5-column natural key: (workspace_id, site_id, session_id,
--         observation_version, scoring_version).
--
-- Safe: additive only. CREATE TABLE IF NOT EXISTS + idempotent DO
-- blocks for role-existence assertions + post-migration Hard-Rule-I
-- style privilege check.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Role-existence assertions (mirrors PR#3 / PR#5 pattern)
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
-- 2. risk_observations_v0_1 table
-- ---------------------------------------------------------------------------
-- 5-column natural key per D-14:
--   (workspace_id, site_id, session_id, observation_version, scoring_version)
-- Both versions are independent provenance axes (mirrors PR#5 OD-10).
--
-- Columns:
--   velocity              JSONB object  per-metric rates (events/sec, burst, etc.)
--   device_risk_01        NUMERIC(4,3)  [0,1] — default 0 in v1 (no SDK fingerprint)
--   network_risk_01       NUMERIC(4,3)  [0,1] — default 0 in v1
--   identity_risk_01      NUMERIC(4,3)  [0,1] — default 0 in v1
--   behavioural_risk_01   NUMERIC(4,3)  [0,1] — normalised input feature, NOT a score
--   tags                  JSONB array   ContextTags (UPPER_SNAKE_CASE labels)
--   record_only           BOOLEAN       CHECK IS TRUE
--   source_event_count    INT           CHECK >= 0
--   evidence_refs         JSONB array   replay provenance pointers (no raw payloads)

CREATE TABLE IF NOT EXISTS risk_observations_v0_1 (
  risk_observation_id    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           TEXT            NOT NULL,
  site_id                TEXT            NOT NULL,
  session_id             TEXT            NOT NULL,
  observation_version    TEXT            NOT NULL,
  scoring_version        TEXT            NOT NULL,

  velocity               JSONB           NOT NULL DEFAULT '{}'::jsonb,
  device_risk_01         NUMERIC(4,3)    NOT NULL DEFAULT 0,
  network_risk_01        NUMERIC(4,3)    NOT NULL DEFAULT 0,
  identity_risk_01       NUMERIC(4,3)    NOT NULL DEFAULT 0,
  behavioural_risk_01    NUMERIC(4,3)    NOT NULL DEFAULT 0,
  tags                   JSONB           NOT NULL DEFAULT '[]'::jsonb,

  record_only            BOOLEAN         NOT NULL DEFAULT TRUE,
  source_event_count     INT             NOT NULL DEFAULT 0,
  evidence_refs          JSONB           NOT NULL DEFAULT '[]'::jsonb,
  created_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),

  CONSTRAINT risk_obs_v0_1_velocity_is_object
    CHECK (jsonb_typeof(velocity) = 'object'),
  CONSTRAINT risk_obs_v0_1_tags_is_array
    CHECK (jsonb_typeof(tags) = 'array'),
  CONSTRAINT risk_obs_v0_1_evidence_refs_is_array
    CHECK (jsonb_typeof(evidence_refs) = 'array'),
  CONSTRAINT risk_obs_v0_1_record_only_must_be_true
    CHECK (record_only IS TRUE),
  CONSTRAINT risk_obs_v0_1_source_event_count_nonneg
    CHECK (source_event_count >= 0),
  CONSTRAINT risk_obs_v0_1_behavioural_risk_01_range
    CHECK (behavioural_risk_01 >= 0 AND behavioural_risk_01 <= 1),
  CONSTRAINT risk_obs_v0_1_device_risk_01_range
    CHECK (device_risk_01 >= 0 AND device_risk_01 <= 1),
  CONSTRAINT risk_obs_v0_1_network_risk_01_range
    CHECK (network_risk_01 >= 0 AND network_risk_01 <= 1),
  CONSTRAINT risk_obs_v0_1_identity_risk_01_range
    CHECK (identity_risk_01 >= 0 AND identity_risk_01 <= 1),

  CONSTRAINT risk_observations_v0_1_natural_key UNIQUE
    (workspace_id, site_id, session_id, observation_version, scoring_version)
);

CREATE INDEX IF NOT EXISTS risk_observations_v0_1_workspace_site
  ON risk_observations_v0_1 (workspace_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS risk_observations_v0_1_session
  ON risk_observations_v0_1 (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS risk_observations_v0_1_versions
  ON risk_observations_v0_1 (observation_version, scoring_version, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Role grants — mirror PR#3 OD-7 / PR#5 posture
-- ---------------------------------------------------------------------------

REVOKE ALL ON risk_observations_v0_1 FROM PUBLIC;

GRANT ALL ON risk_observations_v0_1                       TO buyerrecon_migrator;
GRANT SELECT, INSERT, UPDATE ON risk_observations_v0_1    TO buyerrecon_scoring_worker;
GRANT SELECT                  ON risk_observations_v0_1   TO buyerrecon_internal_readonly;

-- Customer-facing role: ZERO direct SELECT on risk_observations_v0_1
-- (mirrors PR#3 OD-7 / PR#5 — internal RECORD_ONLY evidence layer; not
-- customer-facing). PR#6 D-10.
REVOKE ALL ON risk_observations_v0_1 FROM buyerrecon_customer_api;

-- ---------------------------------------------------------------------------
-- 4. Hard Rule I parity assertion (PR#3 / PR#5 pattern)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF has_table_privilege('buyerrecon_customer_api'::name, 'risk_observations_v0_1'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api still has SELECT on risk_observations_v0_1 after REVOKE; PR#3 OD-7 / PR#6 D-10 posture violated. Investigate role memberships before re-running.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (operator-only; NOT executed by this migration):
--
--   REVOKE ALL ON risk_observations_v0_1 FROM buyerrecon_migrator;
--   REVOKE ALL ON risk_observations_v0_1 FROM buyerrecon_scoring_worker;
--   REVOKE ALL ON risk_observations_v0_1 FROM buyerrecon_internal_readonly;
--   DROP TABLE IF EXISTS risk_observations_v0_1;
--
-- No CASCADE — no FK references either way. The four canonical group
-- roles are NOT dropped (operator-owned per PR#3 OD-8).
-- ---------------------------------------------------------------------------
