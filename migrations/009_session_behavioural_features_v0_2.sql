-- Migration 009: Sprint 2 PR#1 — session_behavioural_features_v0_2
-- (downstream factual behavioural feature layer)
--
-- Track B (BuyerRecon Evidence Foundation), Sprint 2 PR#1.
--
-- This is the FIRST downstream factual behavioural feature layer beyond
-- session_features (PR#11). It reads accepted_events and produces one row
-- per (workspace_id, site_id, session_id, feature_version) with factual
-- behavioural aggregates that future Sprint 2 PRs (PR#5 Stage 0,
-- PR#6 Stage 1) may consume as scoring inputs.
--
-- This table is a FACTUAL BRIDGE for future scoring, NOT a scorer.
--
-- Hard non-scoring boundary (PR#1 MUST NOT introduce):
--   - risk_score / score / classification / recommended_action /
--     confidence_band / is_bot / is_agent / ai_agent / is_human /
--     buyer / intent / lead_quality / CRM / company_enrich / ip_enrich /
--     reason_code columns or values.
--   - A_* / B_* / REVIEW_* / OBS_* emitted codes.
--   - Refresh-loop server-side derivation is DEFERRED to Sprint 2 PR#2
--     per Architecture Gate A0 §K + Helen-approved D-3 default. This
--     migration does NOT include a refresh_loop column. Sprint 2 PR#2
--     adds it via a follow-up additive migration.
--
-- Authority:
--   - docs/architecture/ARCHITECTURE_GATE_A0.md (commit a87eb05)
--   - docs/contracts/signal-truth-v0.1.md
--   - docs/sprint2-pr1-behavioural-features-v0.2-planning.md (Helen-approved)
--
-- Safe: additive only. CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
-- EXISTS. No FK. No constraint promotion. accepted_events,
-- rejected_events, ingest_requests, site_write_tokens, session_features
-- are NOT touched.
--
-- CHECK constraint policy (per Codex correction):
--   - Minimal CHECK constraints for numeric non-negativity only.
--   - Bucket enum values (interaction_density_bucket,
--     scroll_depth_bucket_before_first_cta) are validated by invariant
--     SQL in docs/sql/verification/08_behavioural_features_invariants.sql,
--     NOT by DB CHECK constraints. This allows v0.3+ to evolve bucket
--     boundaries without a column-level migration.
--
-- Rollback: see end of file.

CREATE TABLE IF NOT EXISTS session_behavioural_features_v0_2 (
  behavioural_features_id                     BIGSERIAL PRIMARY KEY,

  -- Boundary identifiers (mirrors session_features pattern)
  workspace_id                                TEXT        NOT NULL,
  site_id                                     TEXT        NOT NULL,
  session_id                                  TEXT        NOT NULL,

  -- Versioning + provenance
  feature_version                             TEXT        NOT NULL,
  extracted_at                                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Session endpoint metadata (re-derived from accepted_events for
  -- self-consistency; compared to session_features in invariant SQL but
  -- NOT taken from there).
  first_seen_at                               TIMESTAMPTZ,
  last_seen_at                                TIMESTAMPTZ,
  source_event_count                          INT         NOT NULL DEFAULT 0,
  source_event_id_min                         BIGINT,
  source_event_id_max                         BIGINT,
  first_event_id                              BIGINT,
  last_event_id                               BIGINT,

  -- 12 Stage-1-shaped factual fields. Future Sprint 2 PR#5 / PR#6 may
  -- consume; PR#1 does NOT score them. Every field is a count, duration
  -- in ms, boolean temporal-order observation, enum bucket, or
  -- provenance metadata. No judgement.
  --
  -- Duration fields are BIGINT (matches session_features.session_duration_ms
  -- pattern) — a session may legitimately span days when the
  -- candidate-window catches a long-quiet returning session.
  ms_from_consent_to_first_cta                BIGINT,
  dwell_ms_before_first_action                BIGINT,
  first_form_start_precedes_first_cta         BOOLEAN,
  form_start_count_before_first_cta           INT         NOT NULL DEFAULT 0,
  has_form_submit_without_prior_form_start    BOOLEAN     NOT NULL DEFAULT FALSE,
  form_submit_count_before_first_form_start   INT         NOT NULL DEFAULT 0,
  ms_between_pageviews_p50                    BIGINT,
  pageview_burst_count_10s                    INT         NOT NULL DEFAULT 0,
  max_events_per_second                       INT         NOT NULL DEFAULT 0,
  sub_200ms_transition_count                  INT         NOT NULL DEFAULT 0,
  interaction_density_bucket                  TEXT,
  scroll_depth_bucket_before_first_cta        TEXT,

  -- Provenance / sparsity metadata
  valid_feature_count                         INT         NOT NULL DEFAULT 0,
  missing_feature_count                       INT         NOT NULL DEFAULT 0,
  feature_presence_map                        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  feature_source_map                          JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Minimal non-negativity CHECK constraints (numeric counts only).
  -- NO bucket-enum CHECK constraints; bucket validity is invariant-SQL
  -- validated to allow v0.3+ bucket evolution without column migration.
  CONSTRAINT sbf_v0_2_source_event_count_nonneg
    CHECK (source_event_count >= 0),
  CONSTRAINT sbf_v0_2_form_start_before_cta_nonneg
    CHECK (form_start_count_before_first_cta >= 0),
  CONSTRAINT sbf_v0_2_form_submit_before_fs_nonneg
    CHECK (form_submit_count_before_first_form_start >= 0),
  CONSTRAINT sbf_v0_2_pageview_burst_nonneg
    CHECK (pageview_burst_count_10s >= 0),
  CONSTRAINT sbf_v0_2_max_eps_nonneg
    CHECK (max_events_per_second >= 0),
  CONSTRAINT sbf_v0_2_sub_200ms_nonneg
    CHECK (sub_200ms_transition_count >= 0),
  CONSTRAINT sbf_v0_2_valid_feature_count_nonneg
    CHECK (valid_feature_count >= 0),
  CONSTRAINT sbf_v0_2_missing_feature_count_nonneg
    CHECK (missing_feature_count >= 0),

  -- Idempotency: one row per
  -- (workspace_id, site_id, session_id, feature_version).
  CONSTRAINT session_behavioural_features_v0_2_natural_key UNIQUE
    (workspace_id, site_id, session_id, feature_version)
);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_workspace_site
  ON session_behavioural_features_v0_2 (workspace_id, site_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_session
  ON session_behavioural_features_v0_2 (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_version
  ON session_behavioural_features_v0_2 (feature_version, extracted_at DESC);

-- ---------------------------------------------------------------------------
-- Rollback (additive, no data dependency):
--
--   DROP TABLE IF EXISTS session_behavioural_features_v0_2;
--
-- Indexes are dropped automatically when the table is dropped.
--
-- Codex correction note (no CASCADE):
--   Do NOT use DROP TABLE … CASCADE. v0.2 introduces no FK references;
--   CASCADE would silently drop any future FK-referencing object and is
--   too aggressive for this rollback. Use the explicit, non-CASCADE
--   drop above.
--
-- Safe because:
--   - No FK references session_behavioural_features_v0_2.
--   - This is a derived table; rebuildable from accepted_events via
--     scripts/extract-behavioural-features.ts at any time.
--   - accepted_events / rejected_events / ingest_requests /
--     site_write_tokens / session_features are not touched by this
--     migration.
-- ---------------------------------------------------------------------------
