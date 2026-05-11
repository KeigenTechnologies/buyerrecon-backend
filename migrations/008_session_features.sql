-- Migration 008: Sprint 1 PR#11 — session_features (downstream derived facts)
-- Track B (BuyerRecon Evidence Foundation), NOT Track A (AMS Behaviour QA
-- scoring harness), NOT Core AMS (the future productized scoring/report home).
--
-- PR#11 creates the bridge between the raw accepted_events ledger and the
-- first downstream factual layer. It is the BRIDGE, not the brain:
--   - session_features stores factual aggregates only (counts, timestamps,
--     URLs, presence flags, JSONB count maps, evidence-quality min/max).
--   - It stores NO scoring, NO classification, NO bot/AI-agent taxonomy, NO
--     CRM routing, NO company/IP enrichment, NO dashboard wording.
--   - It is one row per (workspace_id, site_id, session_id, extraction_version).
--   - It is idempotent: re-running the extractor with the same input updates
--     the same row deterministically via ON CONFLICT.
--
-- Track A scoring fields (risk_score / classification / recommended_action /
-- bot_score / agent_score / is_bot / is_agent / ai_agent / confidence_band /
-- lead_quality) are explicitly NOT introduced on this table. Sprint 1
-- Track B forbids them. Future scoring lives on a separate productized
-- table at the Core AMS layer.
--
-- Safe: additive only. CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- accepted_events, rejected_events, ingest_requests, site_write_tokens are
-- NOT touched.
--
-- Out of scope for this PR (per Sprint 1 hard rules):
--   - any change to accepted_events / rejected_events / ingest_requests /
--     site_write_tokens
--   - any change to v1 collector route or orchestrator
--   - any change to the v1 barrel
--   - cron / scheduler wiring
--   - purge / delete cascade
--   - legacy-thin-v2.0 extraction
--   - scoring / classification / recommendation
--   - dashboard / admin API
--
-- Rollback: see end of file.

CREATE TABLE IF NOT EXISTS session_features (
  session_features_id     BIGSERIAL PRIMARY KEY,

  -- Boundary identifiers (always-set on the v1 collector path; auth-derived)
  workspace_id            TEXT        NOT NULL,
  site_id                 TEXT        NOT NULL,
  session_id              TEXT        NOT NULL,

  -- Extraction tracking
  extraction_version      TEXT        NOT NULL,
  extracted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Session timing (server clock — accepted_events.received_at, not raw occurred_at)
  first_seen_at           TIMESTAMPTZ NOT NULL,
  last_seen_at            TIMESTAMPTZ NOT NULL,
  session_duration_ms     BIGINT      NOT NULL,

  -- Event-id evidence / debug fields (BIGSERIAL from accepted_events.event_id)
  source_event_id_min     BIGINT,
  source_event_id_max     BIGINT,
  first_event_id          BIGINT,
  last_event_id           BIGINT,

  -- Count facts (factual aggregates only — no scoring)
  source_event_count      INT         NOT NULL,
  page_view_count         INT         NOT NULL DEFAULT 0,
  cta_click_count         INT         NOT NULL DEFAULT 0,
  form_start_count        INT         NOT NULL DEFAULT 0,
  form_submit_count       INT         NOT NULL DEFAULT 0,
  unique_path_count       INT         NOT NULL DEFAULT 0,

  -- URL / path facts (from raw->>'page_url' / raw->>'page_path' at the
  -- earliest / latest event by received_at, event_id tie-break)
  landing_page_url        TEXT,
  landing_page_path       TEXT,
  last_page_url           TEXT,
  last_page_path          TEXT,

  -- Boolean presence flags (derived from counts > 0)
  has_cta_click           BOOLEAN     NOT NULL DEFAULT FALSE,
  has_form_start          BOOLEAN     NOT NULL DEFAULT FALSE,
  has_form_submit         BOOLEAN     NOT NULL DEFAULT FALSE,

  -- JSONB grouped counts (sparse — only names that appear in the session)
  event_name_counts       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  schema_key_counts       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  consent_source_counts   JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Evidence-quality facts (canonical_jsonb is the 19-key projection from PR#2 +
  -- §2.5 line 168 contract; min == max == 19 for all v1 events).
  canonical_key_count_min INT,
  canonical_key_count_max INT,

  -- Idempotency: one row per session per extraction version.
  CONSTRAINT session_features_natural_key UNIQUE
    (workspace_id, site_id, session_id, extraction_version)
);

CREATE INDEX IF NOT EXISTS session_features_workspace_site
  ON session_features (workspace_id, site_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS session_features_session
  ON session_features (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS session_features_extraction
  ON session_features (extraction_version, extracted_at DESC);

-- ---------------------------------------------------------------------------
-- Rollback (additive, no data dependency):
--
--   DROP INDEX IF EXISTS session_features_extraction;
--   DROP INDEX IF EXISTS session_features_session;
--   DROP INDEX IF EXISTS session_features_workspace_site;
--   DROP TABLE IF EXISTS session_features;
--
-- Safe because:
--   - No FK references session_features.
--   - session_features is a derived table; rebuildable from accepted_events
--     via scripts/extract-session-features.ts at any time.
--   - accepted_events / rejected_events / ingest_requests / site_write_tokens
--     are not touched by this migration.
-- ---------------------------------------------------------------------------
