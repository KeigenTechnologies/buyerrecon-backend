-- Migration 010: Sprint 2 PR#2 — refresh-loop / repeated-pageview server-side derivation
-- (additive columns on session_behavioural_features_v0_2; no new table)
--
-- Track B (BuyerRecon Evidence Foundation), Sprint 2 PR#2.
--
-- This migration extends the PR#1 behavioural feature layer
-- (session_behavioural_features_v0_2, created by migration 009) with 8
-- additive columns that hold server-side refresh-loop / repeated-pageview
-- factual derivations.
--
--   Total columns post-migration: 29 (PR#1) + 8 (PR#2) = 37.
--   8 additive columns: 7 factual/derived fields + 1 provenance field.
--
-- This is a FACTUAL BRIDGE for future scoring (Sprint 2 PR#5 Stage 0,
-- PR#6 Stage 1). It is NOT a scorer itself.
--
-- Hard non-scoring boundary (PR#2 MUST NOT introduce):
--   - risk_score / score / classification / recommended_action /
--     confidence_band / is_bot / is_agent / ai_agent / is_human /
--     buyer / intent / lead_quality / CRM / company_enrich / ip_enrich /
--     reason_code columns or values.
--   - A_* / B_* / REVIEW_* / OBS_* emitted codes.
--   - No `refresh_loop_observed` column — judgement implication.
--     Use `refresh_loop_candidate` (factual candidate flag derived under
--     fixed extraction thresholds; NOT a risk label, NOT a reason code).
--   - SDK refresh-loop hints are NEVER trusted as truth. PR#2 derives
--     server-side from accepted_events sequence. Helen-approved D-4
--     Option α: ignore SDK hint entirely.
--
-- Authority:
--   - docs/architecture/ARCHITECTURE_GATE_A0.md (§K Sprint 2 PR#2)
--   - docs/sprint2-pr2-refresh-loop-server-derivation-planning.md
--     (Helen-approved D-1 through D-7; Codex PASS)
--
-- Safe: additive only. ALTER TABLE … ADD COLUMN IF NOT EXISTS. No FK.
-- No new indexes (existing PR#1 indexes on workspace_id/site_id/session_id
-- and feature_version cover all anticipated query patterns). No DML.
-- accepted_events, rejected_events, ingest_requests, site_write_tokens,
-- session_features are NOT touched.
--
-- CHECK constraint policy (matches PR#1 §10):
--   - Non-negativity CHECK constraints on numeric count columns only.
--   - NO CHECK on `refresh_loop_source` enum values; validated by
--     invariant SQL in docs/sql/verification/09_refresh_loop_invariants.sql
--     so future versions can extend the source enum without a column
--     migration.
--
-- Rollback: see end of file. Uses DROP COLUMN IF EXISTS only; NO CASCADE.

ALTER TABLE session_behavioural_features_v0_2
  ADD COLUMN IF NOT EXISTS refresh_loop_candidate              BOOLEAN,
  ADD COLUMN IF NOT EXISTS refresh_loop_count                  INT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS same_path_repeat_count              INT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS same_path_repeat_max_span_ms        BIGINT,
  ADD COLUMN IF NOT EXISTS same_path_repeat_min_delta_ms       BIGINT,
  ADD COLUMN IF NOT EXISTS same_path_repeat_median_delta_ms    BIGINT,
  ADD COLUMN IF NOT EXISTS repeat_pageview_candidate_count     INT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refresh_loop_source                 TEXT;

-- Non-negativity CHECK constraints for numeric count columns (PR#1 pattern).
-- NOT VALID is omitted (table is small; ALTER TABLE … ADD CONSTRAINT
-- evaluates rows immediately). For existing v0.2 rows the DEFAULT 0
-- satisfies the constraint trivially.
--
-- Wrapped in DO blocks because Postgres has no native
-- `ADD CONSTRAINT IF NOT EXISTS`. The DO blocks make the migration
-- idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sbf_v0_2_refresh_loop_count_nonneg'
       AND conrelid = 'public.session_behavioural_features_v0_2'::regclass
  ) THEN
    ALTER TABLE session_behavioural_features_v0_2
      ADD CONSTRAINT sbf_v0_2_refresh_loop_count_nonneg
        CHECK (refresh_loop_count >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sbf_v0_2_same_path_repeat_count_nonneg'
       AND conrelid = 'public.session_behavioural_features_v0_2'::regclass
  ) THEN
    ALTER TABLE session_behavioural_features_v0_2
      ADD CONSTRAINT sbf_v0_2_same_path_repeat_count_nonneg
        CHECK (same_path_repeat_count >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'sbf_v0_2_repeat_pageview_candidate_count_nonneg'
       AND conrelid = 'public.session_behavioural_features_v0_2'::regclass
  ) THEN
    ALTER TABLE session_behavioural_features_v0_2
      ADD CONSTRAINT sbf_v0_2_repeat_pageview_candidate_count_nonneg
        CHECK (repeat_pageview_candidate_count >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (additive, no data dependency):
--
--   ALTER TABLE session_behavioural_features_v0_2
--     DROP COLUMN IF EXISTS refresh_loop_candidate,
--     DROP COLUMN IF EXISTS refresh_loop_count,
--     DROP COLUMN IF EXISTS same_path_repeat_count,
--     DROP COLUMN IF EXISTS same_path_repeat_max_span_ms,
--     DROP COLUMN IF EXISTS same_path_repeat_min_delta_ms,
--     DROP COLUMN IF EXISTS same_path_repeat_median_delta_ms,
--     DROP COLUMN IF EXISTS repeat_pageview_candidate_count,
--     DROP COLUMN IF EXISTS refresh_loop_source;
--
-- The 3 CHECK constraints are dropped automatically when their columns
-- are dropped.
--
-- Codex correction note (no CASCADE):
--   Do NOT use DROP COLUMN … CASCADE. v0.2/v0.3 introduce no FK
--   references on these columns; CASCADE would silently drop any future
--   FK-referencing object and is too aggressive for this rollback.
--
-- Safe because:
--   - No FK references the new columns.
--   - These are derived columns; rebuildable from accepted_events via
--     scripts/extract-behavioural-features.ts at any time.
--   - accepted_events / rejected_events / ingest_requests /
--     site_write_tokens / session_features are not touched by this
--     migration.
--   - Pre-PR#2 v0.2 rows are preserved unchanged (the additive columns
--     get NULL / 0 defaults for them).
-- ---------------------------------------------------------------------------
