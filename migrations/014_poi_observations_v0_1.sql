-- Migration 014: Sprint 2 PR#11c — POI observation evidence layer
-- (new table; no FK; additive only; no change to migrations 001..013).
--
-- Track B (BuyerRecon Evidence Foundation), Sprint 2 PR#11c.
--
-- This migration creates `poi_observations_v0_1`, the durable
-- BuyerRecon-side POI evidence layer that persists the
-- `PoiCoreInput` envelopes PR#10 produces. It is the persistence
-- backing of the PR#10 POI Core Input contract + PR#11b read-only
-- observer (which Hetzner-proved the in-memory shape on real
-- staging data at HEAD 1a3b252).
--
-- PR#11c v0.1 ships RECORD_ONLY. The AMS Risk Core, POI Core,
-- Series Core, Trust Core, Policy Pass 1 / Pass 2, BuyerRecon
-- product layer, and BuyerRecon product output remain
-- authoritative and unchanged. PR#11c is **additive** at the
-- POI-evidence-persistence slot only (Helen-signed D-11
-- "upgrade-not-restart" rule, mirrors PR#6 D-11 precedent).
--
-- PR#11c emits NO `risk_index`, NO `verification_score`, NO
-- `evidence_band`, NO `action_recommendation`, NO `reason_codes`,
-- NO `reason_impacts`, NO `triggered_tags`, NO `penalty_total`,
-- NO `lane_a`, NO `lane_b`, NO `trust_decision`, NO
-- `policy_decision`, NO customer-facing field. Those are AMS Risk
-- Core / Policy Pass 1 / Trust / customer-renderer concerns. POI
-- v0.1 is a surface-centric evidence layer only.
--
-- Authority:
--   - docs/sprint2-pr9a-poi-core-input-planning.md (Helen-signed OD-1..OD-8)
--   - docs/sprint2-pr10-poi-core-input.md (PR#10 contract impl + Codex xhigh PASS)
--   - docs/sprint2-pr11a-poi-derived-observation-planning.md (Helen-signed OD-1..OD-10)
--   - docs/sprint2-pr11b-poi-core-input-observer.md (Hetzner-proven observer impl)
--   - docs/sprint2-pr11c-poi-observations-table-worker-planning.md (Helen-signed OD-1..OD-11)
--   - AMS `internal/contracts/signals.go` — frozen `RiskInputs` / `CommonFeatures`
--   - migrations/013_risk_observations_v0_1.sql (precedent shape for this migration)
--
-- Helen sign-off OD-1..OD-11 implemented here:
--   OD-1   migration number = 014 (next free after 013).
--   OD-2   column shape per PR#11c planning §4.1; no score/verdict/policy/
--          trust/Lane/identity/raw URL/UA/IP/token/pepper fields.
--   OD-3   natural key = (workspace_id, site_id, session_id, poi_type,
--          poi_key, poi_input_version, poi_observation_version,
--          extraction_version). `source_row_id` excluded — SF re-extracts
--          upsert cleanly. `source_table` excluded — CHECK pins it to
--          'session_features' in v0.1.
--   OD-4   worker trigger = manual CLI only (no cron / queue / post-commit).
--          Not encoded in DDL; enforced by ops.
--   OD-5   worker source reads = session_features + stage0_decisions
--          side-read only. SBF / raw-ledger / Risk / Lane forbidden.
--          Not encoded in DDL; enforced by worker SQL + tests.
--   OD-6   worker upsert = idempotent ON CONFLICT DO UPDATE; updated_at
--          set to NOW() on every conflict (OD-6.1).
--   OD-7   role grants: customer_api zero SELECT; scoring_worker S/I/U;
--          internal_readonly S only; migrator owns DDL.
--   OD-8   Stage 0 excluded rows STORED with stage0_excluded=TRUE,
--          poi_eligible=FALSE. poi_eligible is the pure boolean inverse
--          of stage0_excluded — enforced by CHECK constraint below. No
--          other rule may set poi_eligible. stage0_rule_id is
--          provenance-only (never a POI key / context / scoring reason /
--          customer reason code / downstream judgement).
--   OD-9   no first-class `behavioural_feature_version` column. Future
--          SBF persistence adds the entry to `source_versions` JSONB.
--   OD-10  verification SQL at docs/sql/verification/14_poi_observations_v0_1_invariants.sql
--          (created alongside this migration).
--   OD-11  `poi_key_source_field TEXT NOT NULL CHECK IN
--          ('landing_page_path', 'last_page_path')` — first-class
--          provenance column. Records which SF column produced
--          `poi_key`. Provenance only — never a POI key / context /
--          customer-facing label.
--
-- Safe: additive only. CREATE TABLE IF NOT EXISTS + idempotent DO
-- blocks for role-existence assertions + post-migration Hard-Rule-I
-- style privilege check.

-- ---------------------------------------------------------------------------
-- 1. Role-existence assertions (mirrors PR#3 / PR#5 / PR#6 pattern)
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
-- 2. poi_observations_v0_1 table
-- ---------------------------------------------------------------------------
-- 8-column natural key per OD-3:
--   (workspace_id, site_id, session_id, poi_type, poi_key,
--    poi_input_version, poi_observation_version, extraction_version)
--
-- v0.1 hard-codes:
--   - poi_type        = 'page_path' (CHECK)
--   - source_table    = 'session_features' (CHECK)
--   - record_only     = TRUE (CHECK)
--   - poi_eligible    = NOT stage0_excluded (CHECK)
--   - evidence_refs   non-empty JSONB array (CHECK)
--   - poi_key_source_field IN ('landing_page_path','last_page_path') (CHECK)

CREATE TABLE IF NOT EXISTS poi_observations_v0_1 (
  poi_observation_id        BIGSERIAL    PRIMARY KEY,

  -- Identity boundary
  workspace_id              TEXT         NOT NULL,
  site_id                   TEXT         NOT NULL,
  session_id                TEXT         NOT NULL,

  -- POI key (PR#10 contract)
  poi_type                  TEXT         NOT NULL,
  poi_key                   TEXT         NOT NULL,
  poi_surface_class         TEXT,        -- NULL allowed; finite enum when set

  -- Versions (PR#4 + PR#10 + PR#11c stamps)
  poi_input_version         TEXT         NOT NULL,
  poi_observation_version   TEXT         NOT NULL,
  extraction_version        TEXT         NOT NULL,

  -- Evidence lineage (PR#10 envelope verbatim, post-validation).
  -- NO DEFAULT — every persisted row MUST carry at least one
  -- evidence_ref entry (see poi_obs_v0_1_evidence_refs_nonempty
  -- below). The worker always builds evidence_refs from the
  -- successful session_features source row; optional stage0_decisions
  -- evidence_ref is appended when the Stage 0 side-read returns a
  -- row. Empty lineage is invalid.
  evidence_refs             JSONB        NOT NULL,

  -- Primary source provenance (v0.1: SF only)
  source_table              TEXT         NOT NULL,
  source_row_id             TEXT         NOT NULL,
  source_event_count        INT          NOT NULL,
  -- OD-11 provenance column: which SF column produced poi_key.
  -- Provenance only — never a POI key, POI context, scoring reason,
  -- customer-facing label, or downstream judgement signal.
  poi_key_source_field      TEXT         NOT NULL,

  -- Forward-compatible versions map (OD-9). v0.1 writes:
  --   { "session_features": "<extraction_version>",
  --     "stage0_decisions": "<stage0_version>" | omitted,
  --     "poi_input_version": "poi-core-input-v0.1" }
  -- A future SBF-persistence PR adds
  -- "session_behavioural_features_v0_2": "<feature_version>" without
  -- a schema change.
  source_versions           JSONB        NOT NULL DEFAULT '{}'::jsonb,

  -- Eligibility / provenance (Stage 0 carry-through; OD-8)
  stage0_excluded           BOOLEAN      NOT NULL DEFAULT FALSE,
  -- poi_eligible is the pure boolean inverse of stage0_excluded
  -- (enforced by CHECK below). Eligibility carry-through, not an
  -- independent judgement / score / Trust/Policy decision / customer
  -- claim / Product-Context-Fit input.
  poi_eligible              BOOLEAN      NOT NULL,
  -- stage0_rule_id is PROVENANCE-ONLY. NULL when no Stage 0 row
  -- found for the session. Persisted only for audit lineage — it
  -- MUST NOT become a POI key, POI context, scoring reason,
  -- customer-facing reason code, Policy/Trust reason, downstream
  -- judgement, report language, or Product-Context-Fit input.
  stage0_rule_id            TEXT,

  -- Timestamps
  first_seen_at             TIMESTAMPTZ,
  last_seen_at              TIMESTAMPTZ,
  derived_at                TIMESTAMPTZ  NOT NULL,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Record-only literal (mirrors PR#5 / PR#6 pattern)
  record_only               BOOLEAN      NOT NULL DEFAULT TRUE,

  -- v0.1 CHECK constraints. Every constraint widens at most via a
  -- future migration after explicit contract amendment with Helen
  -- sign-off.

  CONSTRAINT poi_obs_v0_1_poi_type_v0_1
    CHECK (poi_type = 'page_path'),

  CONSTRAINT poi_obs_v0_1_source_table_v0_1
    CHECK (source_table = 'session_features'),

  CONSTRAINT poi_obs_v0_1_poi_key_source_field_enum
    CHECK (poi_key_source_field IN ('landing_page_path', 'last_page_path')),

  CONSTRAINT poi_obs_v0_1_record_only_must_be_true
    CHECK (record_only IS TRUE),

  CONSTRAINT poi_obs_v0_1_source_event_count_nonneg
    CHECK (source_event_count >= 0),

  CONSTRAINT poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded
    CHECK (poi_eligible = (NOT stage0_excluded)),

  CONSTRAINT poi_obs_v0_1_timestamps_ordered
    CHECK (first_seen_at IS NULL
           OR last_seen_at IS NULL
           OR first_seen_at <= last_seen_at),

  CONSTRAINT poi_obs_v0_1_evidence_refs_is_array
    CHECK (jsonb_typeof(evidence_refs) = 'array'),

  CONSTRAINT poi_obs_v0_1_evidence_refs_nonempty
    CHECK (jsonb_array_length(evidence_refs) > 0),

  CONSTRAINT poi_obs_v0_1_source_versions_is_object
    CHECK (jsonb_typeof(source_versions) = 'object'),

  CONSTRAINT poi_obs_v0_1_natural_key UNIQUE
    (workspace_id, site_id, session_id, poi_type, poi_key,
     poi_input_version, poi_observation_version, extraction_version)
);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_workspace_site
  ON poi_observations_v0_1 (workspace_id, site_id, derived_at DESC);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_session
  ON poi_observations_v0_1 (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_poi_key
  ON poi_observations_v0_1 (workspace_id, site_id, poi_type, poi_key);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_versions
  ON poi_observations_v0_1 (poi_input_version, poi_observation_version, derived_at DESC);

CREATE INDEX IF NOT EXISTS poi_obs_v0_1_stage0_excluded
  ON poi_observations_v0_1 (workspace_id, site_id, stage0_excluded, derived_at DESC)
  WHERE stage0_excluded = TRUE;

-- ---------------------------------------------------------------------------
-- 3. Role grants — mirror PR#3 OD-7 / PR#5 / PR#6 posture
-- ---------------------------------------------------------------------------

REVOKE ALL ON poi_observations_v0_1 FROM PUBLIC;

GRANT ALL ON poi_observations_v0_1                       TO buyerrecon_migrator;
GRANT SELECT, INSERT, UPDATE ON poi_observations_v0_1    TO buyerrecon_scoring_worker;
GRANT SELECT                  ON poi_observations_v0_1   TO buyerrecon_internal_readonly;

-- Customer-facing role: ZERO direct SELECT on poi_observations_v0_1
-- (mirrors PR#6 D-10 — RECORD_ONLY evidence layer; not customer-
-- facing). PR#11c OD-7.
REVOKE ALL ON poi_observations_v0_1 FROM buyerrecon_customer_api;

-- The BIGSERIAL primary-key sequence needs explicit grants for
-- scoring_worker so the worker can perform INSERTs that draw the
-- next auto-numbered value from the sequence. Mirror PR#5 / PR#6
-- pattern for BIGSERIAL ownership.
--
-- IMPORTANT (Codex blocker — sequence USAGE is a write-like side
-- effect): `buyerrecon_internal_readonly` receives NO sequence
-- privileges. In PostgreSQL, sequence USAGE allows `nextval(...)`
-- which mutates the sequence — that is incompatible with a
-- strictly-read-only role. internal_readonly reads the table only;
-- it never needs to look at or advance the sequence. See the
-- Hard-Rule-I-style assertion in §4 below for enforcement.
REVOKE ALL ON SEQUENCE poi_observations_v0_1_poi_observation_id_seq FROM PUBLIC;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE poi_observations_v0_1_poi_observation_id_seq
  TO buyerrecon_scoring_worker;
REVOKE ALL ON SEQUENCE poi_observations_v0_1_poi_observation_id_seq FROM buyerrecon_customer_api;

-- ---------------------------------------------------------------------------
-- 4. Hard Rule I parity assertion (PR#3 / PR#5 / PR#6 pattern)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- (a) customer_api MUST NOT have SELECT on the table.
  IF has_table_privilege('buyerrecon_customer_api'::name,
                          'poi_observations_v0_1'::regclass,
                          'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api still has SELECT on poi_observations_v0_1 after REVOKE; PR#3 OD-7 / PR#11c OD-7 posture violated. Investigate role memberships before re-running.';
  END IF;

  -- (b) internal_readonly MUST NOT have USAGE on the BIGSERIAL
  -- sequence. USAGE allows nextval(...) which mutates/advances the
  -- sequence — that is incompatible with a strictly-read-only role.
  -- This is the Codex-blocker fix on PR#11c migration 014.
  IF has_sequence_privilege('buyerrecon_internal_readonly'::name,
                             'poi_observations_v0_1_poi_observation_id_seq'::regclass,
                             'USAGE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has USAGE on poi_observations_v0_1_poi_observation_id_seq; sequence USAGE permits nextval() which mutates the sequence and breaks the strictly-read-only posture. PR#11c Codex-blocker patch violated. Investigate role memberships before re-running.';
  END IF;

  -- (c) internal_readonly MUST NOT have UPDATE on the sequence.
  IF has_sequence_privilege('buyerrecon_internal_readonly'::name,
                             'poi_observations_v0_1_poi_observation_id_seq'::regclass,
                             'UPDATE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has UPDATE on poi_observations_v0_1_poi_observation_id_seq; sequence UPDATE permits setval() which mutates the sequence and breaks the strictly-read-only posture. PR#11c Codex-blocker patch violated. Investigate role memberships before re-running.';
  END IF;

  -- (d) internal_readonly MUST have SELECT on the table (positive
  -- assertion — verifies the role can still do its job after the
  -- sequence privileges were removed).
  IF NOT has_table_privilege('buyerrecon_internal_readonly'::name,
                              'poi_observations_v0_1'::regclass,
                              'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly is missing SELECT on poi_observations_v0_1; PR#11c OD-7 posture violated. Re-check the GRANT block above.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (operator-only; NOT executed by this migration):
--
--   REVOKE ALL ON poi_observations_v0_1 FROM buyerrecon_migrator;
--   REVOKE ALL ON poi_observations_v0_1 FROM buyerrecon_scoring_worker;
--   REVOKE ALL ON poi_observations_v0_1 FROM buyerrecon_internal_readonly;
--   REVOKE ALL ON SEQUENCE poi_observations_v0_1_poi_observation_id_seq FROM buyerrecon_scoring_worker;
--   DROP TABLE IF EXISTS poi_observations_v0_1;
--
-- Note: buyerrecon_internal_readonly was NEVER granted any
-- privileges on the BIGSERIAL sequence (Codex-blocker fix —
-- sequence USAGE / UPDATE are mutating operations incompatible
-- with a strictly-read-only role), so the rollback does not need
-- to revoke them.
--
-- No CASCADE — no FK references either way. The four canonical
-- group roles are NOT dropped (operator-owned per PR#3 OD-8).
-- ---------------------------------------------------------------------------
