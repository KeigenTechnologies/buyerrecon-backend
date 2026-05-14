-- Migration 015: Sprint 2 PR#12d — POI Sequence observation evidence layer
-- (new table; no FK; additive only; no change to migrations 001..014).
--
-- Track B (BuyerRecon Evidence Foundation), Sprint 2 PR#12d.
--
-- This migration creates `poi_sequence_observations_v0_1`, the durable
-- BuyerRecon-side POI Sequence evidence layer that persists the
-- in-session POI ordering / path facts the PR#12b observer derived
-- in memory. It is the persistence backing of the PR#12b POI
-- Sequence Observer + PR#12c Helen-signed OD-1..OD-14 (commit
-- `f991e0b`).
--
-- PR#12d v0.1 ships RECORD_ONLY. The AMS Risk Core, POI Core,
-- Series Core (cross-session continuity — different layer, see
-- workflow truth file §10), Trust Core, Policy Pass 1 / Pass 2,
-- Product-Context Fit, BuyerRecon product output, and Lane A / B
-- projection remain authoritative and unchanged. PR#12d is
-- **additive** at the POI-Sequence-evidence-persistence slot only
-- (Helen-signed PR#11c D-11 / OD-12 "upgrade-not-restart" rule).
--
-- PR#12d emits NO `risk_index`, NO `verification_score`, NO
-- `evidence_band`, NO `action_recommendation`, NO `reason_codes`,
-- NO `reason_impacts`, NO `triggered_tags`, NO `penalty_total`,
-- NO `lane_a`, NO `lane_b`, NO `trust_decision`, NO
-- `policy_decision`, NO customer-facing field. Those are AMS / Policy
-- Pass / Trust / customer-renderer concerns. POI Sequence v0.1 is
-- in-session ordering evidence only.
--
-- Authority:
--   - docs/architecture/buyerrecon-workflow-locked-v0.1.md (workflow truth)
--   - docs/sprint2-pr12c-poi-sequence-observations-table-worker-planning.md
--     (Helen-signed OD-1..OD-14 at commit f991e0b)
--   - docs/sprint2-pr12b-poi-sequence-observer.md (PR#12b Hetzner PASS)
--   - migrations/014_poi_observations_v0_1.sql (precedent shape)
--
-- Helen sign-off OD-1..OD-14 implemented here:
--   OD-1   persist truthful shallow POI Sequence observations now.
--   OD-2   durable table name = `poi_sequence_observations_v0_1`.
--   OD-3   v0.1 source = `poi_observations_v0_1` only (worker concern;
--          NOT a DB CHECK because the table itself has no source FK).
--   OD-4   manual CLI worker only — no scheduler. Not encoded in DDL.
--   OD-5   natural key = (workspace_id, site_id, session_id,
--          poi_sequence_version, poi_observation_version). `poi_input_version`
--          stays in `source_versions` JSONB.
--   OD-6   `stage0_rule_id` persisted as nullable provenance-only column.
--   OD-7   first_poi_key / last_poi_key are stored (PR#10-normalised);
--          observers / customer surfaces must not sample them by default.
--   OD-8   `single_poi` rows persist as truthful shallow evidence.
--   OD-9   has_progression = (unique_poi_count >= 2) — CHECK below.
--   OD-10  no Product-Context Fit / Timing / Trust / Policy / Lane A/B /
--          score / verdict / reason codes — enforced by column allowlist
--          (negative space) + PR#12e table observer's forbidden-column
--          sweep (future).
--   OD-11  PR#12e (read-only table observer + Hetzner proof) is a
--          separate future PR. Not in PR#12d scope.
--   OD-12  implementation gated on Codex PASS + Helen sign-off (done).
--   OD-13  AMS Series Core canonical names (`SeriesOutput`, `TimeOutput`,
--          `seriescore`, `series_version`, `series_eligible`,
--          `series_observations_v0_1`, `Cadence` / `Compression` /
--          `Acceleration` / `Revisit` / `SeriesConfidence`) are reserved
--          and MUST NOT appear in PR#12d runtime source. Enforced by
--          tests/v1/poi-sequence-worker.test.ts static-source sweep.
--   OD-14  POI Sequence `evidence_refs` point ONLY to direct
--          `poi_observations_v0_1` rows. Lower-layer lineage is
--          transitive through referenced POI rows; the worker MUST NOT
--          flatten / copy / inline lower-layer refs. Enforced by the
--          worker upsert builder + verification SQL (see
--          docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql).
--
-- Safe: additive only. CREATE TABLE IF NOT EXISTS + idempotent DO
-- blocks for role-existence assertions + post-migration Hard-Rule-I
-- style privilege check.

-- ---------------------------------------------------------------------------
-- 1. Role-existence assertions (mirrors PR#3 / PR#5 / PR#6 / PR#11c pattern)
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
-- 2. poi_sequence_observations_v0_1 table
-- ---------------------------------------------------------------------------
-- 5-column natural key per OD-5:
--   (workspace_id, site_id, session_id, poi_sequence_version,
--    poi_observation_version)
--
-- v0.1 hard-codes:
--   - poi_sequence_version       = 'poi-sequence-v0.1' (CHECK)
--   - poi_sequence_pattern_class IN 6-class enum (CHECK)
--   - poi_sequence_eligible      = NOT stage0_excluded (CHECK)
--   - has_progression            = (unique_poi_count >= 2) (CHECK)
--   - progression_depth          = unique_poi_count (CHECK)
--   - repeated_poi_count         = poi_count - unique_poi_count (CHECK)
--   - has_repetition             = (repeated_poi_count > 0) (CHECK)
--   - source_poi_observation_count = poi_count (CHECK)
--   - record_only                = TRUE (CHECK)
--   - evidence_refs              non-empty JSONB array (CHECK)
--   - source_versions            JSONB object (CHECK)

CREATE TABLE IF NOT EXISTS poi_sequence_observations_v0_1 (
  poi_sequence_observation_id   BIGSERIAL    PRIMARY KEY,

  -- Identity boundary
  workspace_id                  TEXT         NOT NULL,
  site_id                       TEXT         NOT NULL,
  session_id                    TEXT         NOT NULL,

  -- Frozen versions
  poi_sequence_version          TEXT         NOT NULL DEFAULT 'poi-sequence-v0.1',
  poi_observation_version       TEXT         NOT NULL,

  -- Sequence facts (PR#12b v0.1 taxonomy)
  poi_count                     INTEGER      NOT NULL,
  unique_poi_count              INTEGER      NOT NULL,
  first_poi_type                TEXT         NOT NULL,
  first_poi_key                 TEXT         NOT NULL,
  last_poi_type                 TEXT         NOT NULL,
  last_poi_key                  TEXT         NOT NULL,
  first_seen_at                 TIMESTAMPTZ,
  last_seen_at                  TIMESTAMPTZ,
  duration_seconds              INTEGER,
  repeated_poi_count            INTEGER      NOT NULL,
  has_repetition                BOOLEAN      NOT NULL,
  has_progression               BOOLEAN      NOT NULL,
  progression_depth             INTEGER      NOT NULL,
  poi_sequence_pattern_class    TEXT         NOT NULL,

  -- Stage 0 carry-through (OD-6 / OD-9)
  stage0_excluded               BOOLEAN      NOT NULL,
  -- poi_sequence_eligible is the pure boolean inverse of stage0_excluded
  -- (enforced by CHECK below). Eligibility carry-through, not an
  -- independent judgement / score / Trust/Policy decision / customer
  -- claim / Product-Context-Fit input.
  poi_sequence_eligible         BOOLEAN      NOT NULL,
  -- stage0_rule_id is PROVENANCE-ONLY. NULL when no Stage 0 row was
  -- recorded on the underlying POI rows. Persisted only for audit
  -- lineage — it MUST NOT become a POI key, POI context, scoring
  -- reason, customer-facing reason code, Policy/Trust reason,
  -- downstream judgement, report language, or Product-Context-Fit
  -- input.
  stage0_rule_id                TEXT,

  -- Lineage (OD-14)
  -- evidence_refs entries MUST have shape:
  --   { "table": "poi_observations_v0_1", "poi_observation_id": <BIGSERIAL> }
  -- Lower-layer PR#11c POI evidence_refs (session_features /
  -- session_behavioural_features_v0_2 / stage0_decisions) MUST NOT
  -- appear as direct refs here. Lower-layer lineage is transitive
  -- through the referenced POI rows' own evidence_refs.
  -- Enforced by the worker upsert builder + verification SQL.
  evidence_refs                 JSONB        NOT NULL,

  -- Forward-compatible versions map. v0.1 writes:
  --   { "poi_observations":           "<table contract version>",
  --     "poi_input_version":          "poi-core-input-v0.1",
  --     "poi_observation_version":    "poi-observation-v0.1",
  --     "poi_sequence_version":       "poi-sequence-v0.1" }
  source_versions               JSONB        NOT NULL DEFAULT '{}'::jsonb,

  -- POI observation source range (non-PII BIGSERIAL ids)
  source_poi_observation_count  INTEGER      NOT NULL,
  source_min_poi_observation_id BIGINT,
  source_max_poi_observation_id BIGINT,

  -- Provenance
  record_only                   BOOLEAN      NOT NULL DEFAULT TRUE,
  derived_at                    TIMESTAMPTZ  NOT NULL,
  created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- v0.1 CHECK constraints. Every constraint widens at most via a
  -- future migration after explicit contract amendment with Helen
  -- sign-off.

  CONSTRAINT poi_seq_obs_v0_1_version_pin
    CHECK (poi_sequence_version = 'poi-sequence-v0.1'),

  CONSTRAINT poi_seq_obs_v0_1_pattern_class_enum
    CHECK (poi_sequence_pattern_class IN (
      'single_poi','repeated_same_poi','multi_poi_linear',
      'loop_or_backtrack','insufficient_temporal_data','unknown'
    )),

  CONSTRAINT poi_seq_obs_v0_1_eligible_is_pure_inverse_of_stage0_excluded
    CHECK (poi_sequence_eligible = (NOT stage0_excluded)),

  CONSTRAINT poi_seq_obs_v0_1_poi_count_pos
    CHECK (poi_count >= 1),

  CONSTRAINT poi_seq_obs_v0_1_unique_poi_count_pos
    CHECK (unique_poi_count >= 1 AND unique_poi_count <= poi_count),

  CONSTRAINT poi_seq_obs_v0_1_progression_depth_equals_unique
    CHECK (progression_depth = unique_poi_count),

  CONSTRAINT poi_seq_obs_v0_1_has_progression_rule
    CHECK (has_progression = (unique_poi_count >= 2)),

  CONSTRAINT poi_seq_obs_v0_1_repeated_poi_count_identity
    CHECK (repeated_poi_count = poi_count - unique_poi_count),

  CONSTRAINT poi_seq_obs_v0_1_has_repetition_rule
    CHECK (has_repetition = (repeated_poi_count > 0)),

  CONSTRAINT poi_seq_obs_v0_1_duration_nonneg
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0),

  CONSTRAINT poi_seq_obs_v0_1_timestamps_ordered
    CHECK (first_seen_at IS NULL
           OR last_seen_at IS NULL
           OR first_seen_at <= last_seen_at),

  CONSTRAINT poi_seq_obs_v0_1_source_count_matches_poi_count
    CHECK (source_poi_observation_count = poi_count),

  CONSTRAINT poi_seq_obs_v0_1_source_id_range_ordered
    CHECK (source_min_poi_observation_id IS NULL
           OR source_max_poi_observation_id IS NULL
           OR source_min_poi_observation_id <= source_max_poi_observation_id),

  CONSTRAINT poi_seq_obs_v0_1_record_only_must_be_true
    CHECK (record_only IS TRUE),

  CONSTRAINT poi_seq_obs_v0_1_evidence_refs_is_array
    CHECK (jsonb_typeof(evidence_refs) = 'array'),

  CONSTRAINT poi_seq_obs_v0_1_evidence_refs_nonempty
    CHECK (jsonb_array_length(evidence_refs) > 0),

  CONSTRAINT poi_seq_obs_v0_1_source_versions_is_object
    CHECK (jsonb_typeof(source_versions) = 'object'),

  CONSTRAINT poi_seq_obs_v0_1_natural_key UNIQUE
    (workspace_id, site_id, session_id,
     poi_sequence_version, poi_observation_version)
);

CREATE INDEX IF NOT EXISTS poi_seq_obs_v0_1_workspace_site
  ON poi_sequence_observations_v0_1 (workspace_id, site_id, derived_at DESC);

CREATE INDEX IF NOT EXISTS poi_seq_obs_v0_1_session
  ON poi_sequence_observations_v0_1 (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS poi_seq_obs_v0_1_versions
  ON poi_sequence_observations_v0_1
    (poi_sequence_version, poi_observation_version, derived_at DESC);

CREATE INDEX IF NOT EXISTS poi_seq_obs_v0_1_stage0_excluded
  ON poi_sequence_observations_v0_1 (workspace_id, site_id, stage0_excluded, derived_at DESC)
  WHERE stage0_excluded = TRUE;

-- ---------------------------------------------------------------------------
-- 3. Role grants — mirror PR#3 OD-7 / PR#5 / PR#6 / PR#11c posture
-- ---------------------------------------------------------------------------

REVOKE ALL ON poi_sequence_observations_v0_1 FROM PUBLIC;

GRANT ALL                              ON poi_sequence_observations_v0_1 TO buyerrecon_migrator;
GRANT SELECT, INSERT, UPDATE           ON poi_sequence_observations_v0_1 TO buyerrecon_scoring_worker;
GRANT SELECT                           ON poi_sequence_observations_v0_1 TO buyerrecon_internal_readonly;

-- Customer-facing role: ZERO direct SELECT on
-- poi_sequence_observations_v0_1 (mirrors PR#11c OD-7 — RECORD_ONLY
-- evidence layer; not customer-facing).
REVOKE ALL ON poi_sequence_observations_v0_1 FROM buyerrecon_customer_api;

-- BIGSERIAL primary-key sequence grants. scoring_worker needs USAGE
-- + SELECT + UPDATE so that INSERTs can draw the next auto-numbered
-- value. internal_readonly receives NO sequence privileges —
-- sequence USAGE permits nextval() which mutates the sequence and
-- breaks the strictly-read-only posture (PR#11c Codex-blocker
-- precedent; carried forward verbatim).
REVOKE ALL ON SEQUENCE poi_sequence_observations_v0_1_poi_sequence_observation_id_seq FROM PUBLIC;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE poi_sequence_observations_v0_1_poi_sequence_observation_id_seq
  TO buyerrecon_scoring_worker;
REVOKE ALL ON SEQUENCE poi_sequence_observations_v0_1_poi_sequence_observation_id_seq FROM buyerrecon_customer_api;

-- ---------------------------------------------------------------------------
-- 4. Hard Rule I parity assertion (PR#3 / PR#5 / PR#6 / PR#11c pattern)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- (a) customer_api MUST NOT have SELECT on the table.
  IF has_table_privilege('buyerrecon_customer_api'::name,
                          'poi_sequence_observations_v0_1'::regclass,
                          'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api still has SELECT on poi_sequence_observations_v0_1 after REVOKE; PR#3 OD-7 / PR#12d OD-10 posture violated. Investigate role memberships before re-running.';
  END IF;

  -- (b) internal_readonly MUST NOT have USAGE on the BIGSERIAL
  -- sequence. USAGE allows nextval(...) which mutates the sequence.
  IF has_sequence_privilege('buyerrecon_internal_readonly'::name,
                             'poi_sequence_observations_v0_1_poi_sequence_observation_id_seq'::regclass,
                             'USAGE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has USAGE on poi_sequence_observations_v0_1_poi_sequence_observation_id_seq; sequence USAGE permits nextval() which mutates the sequence and breaks the strictly-read-only posture. PR#11c Codex-blocker precedent violated. Investigate role memberships before re-running.';
  END IF;

  -- (c) internal_readonly MUST NOT have UPDATE on the sequence.
  IF has_sequence_privilege('buyerrecon_internal_readonly'::name,
                             'poi_sequence_observations_v0_1_poi_sequence_observation_id_seq'::regclass,
                             'UPDATE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has UPDATE on poi_sequence_observations_v0_1_poi_sequence_observation_id_seq; sequence UPDATE permits setval() which mutates the sequence and breaks the strictly-read-only posture. PR#11c Codex-blocker precedent violated. Investigate role memberships before re-running.';
  END IF;

  -- (d) internal_readonly MUST have SELECT on the table (positive
  -- assertion — verifies the role can still do its job after the
  -- sequence privileges were withheld).
  IF NOT has_table_privilege('buyerrecon_internal_readonly'::name,
                              'poi_sequence_observations_v0_1'::regclass,
                              'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly is missing SELECT on poi_sequence_observations_v0_1; PR#12d OD-7 posture violated. Re-check the GRANT block above.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (operator-only; NOT executed by this migration):
--
--   REVOKE ALL ON poi_sequence_observations_v0_1 FROM buyerrecon_migrator;
--   REVOKE ALL ON poi_sequence_observations_v0_1 FROM buyerrecon_scoring_worker;
--   REVOKE ALL ON poi_sequence_observations_v0_1 FROM buyerrecon_internal_readonly;
--   REVOKE ALL ON SEQUENCE poi_sequence_observations_v0_1_poi_sequence_observation_id_seq
--          FROM buyerrecon_scoring_worker;
--   DROP TABLE IF EXISTS poi_sequence_observations_v0_1;
--
-- Note: buyerrecon_internal_readonly was NEVER granted any
-- privileges on the BIGSERIAL sequence, so the rollback does not need
-- to revoke them.
--
-- No CASCADE — no FK references either way. The four canonical
-- group roles are NOT dropped (operator-owned per PR#3 OD-8).
-- ---------------------------------------------------------------------------
