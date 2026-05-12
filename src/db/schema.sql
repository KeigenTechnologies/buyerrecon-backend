-- buyerrecon-backend/src/db/schema.sql
-- Truth Pipeline schema per spec v1.1

-- UUID generation: gen_random_uuid() is built-in on PostgreSQL 14+.
-- Fly.io managed PostgreSQL is 16. For portability on older versions:
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Accepted events (append-only raw truth ledger, spec §6.2; PR#2 evidence columns per handoff §2.5 + §3.PR#2)
CREATE TABLE IF NOT EXISTS accepted_events (
    event_id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    hostname TEXT NOT NULL,
    event_type TEXT NOT NULL,
    session_id TEXT NOT NULL,
    browser_id TEXT NOT NULL,
    client_timestamp_ms BIGINT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw JSONB NOT NULL,
    collector_version TEXT NOT NULL,
    client_event_id TEXT,
    page_view_id TEXT,
    previous_page_view_id TEXT,
    event_sequence_index INT,
    event_contract_version TEXT NOT NULL DEFAULT 'legacy-thin-v2.0',

    -- Sprint 1 PR#2 evidence-column augmentation (per handoff §2.5 / §3.PR#2).
    -- All nullable (or non-nullable-with-DEFAULT) in PR#2; promotion to NOT NULL
    -- is deferred until §3.PR#5+ collector cutover and verified backfill.
    -- Track A scoring fields (risk_score / classification / recommended_action)
    -- are explicitly NOT introduced — Track B Sprint 1 has no scoring surface.
    request_id           UUID,
    workspace_id         TEXT,
    validator_version    TEXT,
    schema_key           TEXT,
    schema_version       TEXT,
    event_origin         TEXT,
    id_format            TEXT,
    traffic_class        TEXT DEFAULT 'unknown',
    payload_sha256       TEXT,
    size_bytes           INT,
    ip_hash              TEXT,
    consent_state        TEXT,
    consent_source       TEXT,
    consent_updated_at   TIMESTAMPTZ,
    pre_consent_mode     BOOLEAN DEFAULT FALSE,
    tracking_mode        TEXT,
    storage_mechanism    TEXT,
    session_seq          INT,
    session_started_at   TIMESTAMPTZ,
    session_last_seen_at TIMESTAMPTZ,
    canonical_jsonb      JSONB,
    payload_purged_at    TIMESTAMPTZ,
    debug_mode           BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_accepted_site_received ON accepted_events (site_id, received_at);
CREATE INDEX IF NOT EXISTS idx_accepted_site_type ON accepted_events (site_id, event_type);
CREATE INDEX IF NOT EXISTS idx_accepted_session ON accepted_events (session_id);
CREATE INDEX IF NOT EXISTS idx_accepted_browser ON accepted_events (browser_id);
CREATE INDEX IF NOT EXISTS idx_accepted_site_ts ON accepted_events (site_id, client_timestamp_ms);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accepted_dedup_client_event ON accepted_events (site_id, session_id, client_event_id) WHERE client_event_id IS NOT NULL;

-- PR#2 index: supports per-request reconciliation joins (§2.12 cross-table checks)
-- and admin debug retrieval by request_id (§3.PR#9). Naming follows §2.5 target.
CREATE INDEX IF NOT EXISTS accepted_events_request_id ON accepted_events (request_id);

-- 2. Rejected events (spec §6.2; PR#3 evidence columns per handoff §2.6 + §3.PR#3)
CREATE TABLE IF NOT EXISTS rejected_events (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT,
    raw JSONB NOT NULL,
    reason_codes TEXT[] NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collector_version TEXT NOT NULL,

    -- Sprint 1 PR#3 evidence-column augmentation (per handoff §2.6 / §3.PR#3).
    -- All nullable (or non-nullable-with-DEFAULT) in PR#3; promotion to NOT NULL
    -- is deferred until §3.PR#5+ collector cutover and verified backfill.
    -- Track A scoring fields (risk_score / classification / recommended_action)
    -- are explicitly NOT introduced — Track B Sprint 1 has no scoring surface;
    -- scoring lives in Track A (experimental harness) and will eventually live
    -- in Core AMS as a productized package, never on this table.
    -- Legacy reason_codes TEXT[] is PRESERVED for back-compat (dual-write
    -- transition); the new singular reason_code is backfilled from
    -- reason_codes[1] by migration 005.
    request_id              UUID,
    workspace_id            TEXT,
    client_event_id         TEXT,
    id_format               TEXT,
    event_name              TEXT,
    event_type              TEXT,
    schema_key              TEXT,
    schema_version          TEXT,
    rejected_stage          TEXT,
    reason_code             TEXT,
    reason_detail           TEXT,
    schema_errors_jsonb     JSONB,
    pii_hits_jsonb          JSONB,
    raw_payload_sha256      TEXT,
    size_bytes              INT,
    debug_mode              BOOLEAN DEFAULT FALSE,
    sample_visible_to_admin BOOLEAN DEFAULT TRUE,
    rejected_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rejected_received ON rejected_events (received_at);
CREATE INDEX IF NOT EXISTS idx_rejected_site ON rejected_events (site_id);

-- PR#3 indexes: support per-request reconciliation joins (§2.12 cross-table
-- check #15), reason-code aggregation (§2.12 check #6), and workspace/site
-- timeline reads (§3.PR#9 admin debug retrieval). Naming follows §2.6 target.
CREATE INDEX IF NOT EXISTS rejected_events_request_id ON rejected_events (request_id);
CREATE INDEX IF NOT EXISTS rejected_events_reason     ON rejected_events (workspace_id, site_id, reason_code);
CREATE INDEX IF NOT EXISTS rejected_events_received   ON rejected_events (workspace_id, site_id, received_at);

-- 3. Site configuration (spec §6.2 + D1 deploy_start_date)
CREATE TABLE IF NOT EXISTS site_configs (
    site_id TEXT PRIMARY KEY,
    config_272 JSONB NOT NULL DEFAULT '{}',
    config_750 JSONB NOT NULL DEFAULT '{}',
    deploy_start_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Replay runs (spec §6.3, Go side writes, Node reads for diff)
CREATE TABLE IF NOT EXISTS replay_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    collector_versions TEXT[] NOT NULL,
    schema_version TEXT NOT NULL,
    adapter_version TEXT NOT NULL,
    mapping_spec_version TEXT NOT NULL,
    ams_config_version TEXT NOT NULL,
    report_renderer_version TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_sha256 TEXT NOT NULL,
    subjects_total INT NOT NULL,
    subjects_scoreable INT NOT NULL,
    subjects_degraded INT NOT NULL,
    subjects_unscorable INT NOT NULL,
    trq_distribution JSONB NOT NULL,
    intent_distribution JSONB NOT NULL,
    window_distribution JSONB NOT NULL,
    action_distribution JSONB NOT NULL,
    reason_code_frequencies JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Replay evidence cards (downstream artifact, spec §5.2)
CREATE TABLE IF NOT EXISTS replay_evidence_cards (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES replay_runs(run_id),
    subject_id TEXT NOT NULL,
    status TEXT NOT NULL,
    evidence_card JSONB NOT NULL,
    adapter_quality JSONB NOT NULL,
    source_event_ids BIGINT[] NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_cards_run ON replay_evidence_cards (run_id);
CREATE INDEX IF NOT EXISTS idx_replay_cards_subject ON replay_evidence_cards (subject_id);

-- 6. Truth metrics (spec §6.4)
CREATE TABLE IF NOT EXISTS truth_metrics (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    metric_date DATE NOT NULL,
    metrics_version TEXT NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    events_received INT NOT NULL,
    events_accepted INT NOT NULL,
    events_rejected INT NOT NULL,
    reject_rate REAL NOT NULL,
    distinct_sessions INT NOT NULL,
    distinct_subjects INT NOT NULL,
    event_type_counts JSONB NOT NULL,
    reject_reason_counts JSONB NOT NULL,
    summary_start_mismatch INT NOT NULL,
    unknown_bucket_count INT NOT NULL,
    UNIQUE(site_id, metric_date, metrics_version)
);

-- 7. Probe decisions (spec §9.2.5)
CREATE TABLE IF NOT EXISTS probe_decisions (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    browser_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('fire', 'hold', 'suppress', 'dismiss')),
    trigger_score REAL NOT NULL,
    trigger_confidence REAL NOT NULL,
    trigger_threshold REAL NOT NULL,
    trigger_reasons TEXT[] NOT NULL DEFAULT '{}',
    safety_result TEXT,
    safety_reason TEXT,
    page_path TEXT,
    page_group TEXT,
    config_version TEXT NOT NULL,
    probe_version TEXT NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_site_decided ON probe_decisions (site_id, decided_at);
CREATE INDEX IF NOT EXISTS idx_decisions_site_decision ON probe_decisions (site_id, decision);

-- 8. Probe captures (spec §9.2.6)
CREATE TABLE IF NOT EXISTS probe_captures (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    browser_id TEXT NOT NULL,
    email_hash TEXT NOT NULL,
    email_domain TEXT NOT NULL,
    email_class TEXT NOT NULL CHECK (email_class IN ('business', 'freemail', 'disposable', 'role', 'unknown')),
    email_encrypted TEXT NOT NULL,
    asset_key TEXT NOT NULL,
    trigger_score REAL NOT NULL,
    trigger_confidence REAL NOT NULL,
    trigger_reasons TEXT[] NOT NULL DEFAULT '{}',
    mx_verified BOOLEAN NOT NULL DEFAULT FALSE,
    config_version TEXT NOT NULL,
    probe_version TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    purge_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    UNIQUE(site_id, email_hash)
);

CREATE INDEX IF NOT EXISTS idx_captures_site ON probe_captures (site_id);
CREATE INDEX IF NOT EXISTS idx_captures_purge ON probe_captures (purge_after);

-- 9. Trust state (AMS governance persistence, Patch E)
CREATE TABLE IF NOT EXISTS trust_state (
    subject_id TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT '',
    trust_score INT NOT NULL DEFAULT 50,
    trust_band TEXT NOT NULL DEFAULT 'standard',
    probation_state TEXT NOT NULL DEFAULT 'none',
    recovery_state TEXT NOT NULL DEFAULT 'none',
    reason_codes TEXT[] NOT NULL DEFAULT '{}',
    last_decision_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (subject_id, domain)
);

-- 10. Ingest requests ledger (Sprint 1 PR#1, per handoff §2.7).
-- One row per collector HTTP request. Per-request reconciliation table —
-- every collector request lands a row before any per-event work. Without
-- this, "did we explain every event?" cannot be answered. PR#1 only creates
-- the table; no application code yet writes to it (collector wiring lands
-- in §3.PR#5).
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

  -- Reconciliation
  expected_event_count  INT NOT NULL,                      -- 1 for /v1/event; events.length for /v1/batch; 0 when rejected pre-parse.
  accepted_count        INT NOT NULL DEFAULT 0,
  rejected_count        INT NOT NULL DEFAULT 0,
  reconciled_at         TIMESTAMPTZ,                       -- set once accepted+rejected = expected; same moment as received_at on request-level reject.

  -- Auth state
  auth_status           TEXT NOT NULL,                     -- ok | invalid_token | site_disabled | boundary_mismatch
  reject_reason_code    TEXT,                              -- only when whole request rejected before per-event work
  collector_version     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ingest_requests_workspace_received
  ON ingest_requests (workspace_id, site_id, received_at);

CREATE INDEX IF NOT EXISTS ingest_requests_unreconciled
  ON ingest_requests (received_at) WHERE reconciled_at IS NULL;

-- 11. Site write tokens (Sprint 1 PR#4, per handoff §3.PR#4 + §1 Decision #4).
-- Workspace/site auth resolution boundary. The collector resolves workspace_id
-- and site_id from the token at request time and stamps them server-side on
-- every accepted_events / rejected_events / ingest_requests row. Payload-side
-- workspace_id/site_id mismatched against the resolved values is rejected with
-- workspace_site_mismatch (§2.8, §4.1 #5). PR#4 only creates the table and a
-- pure resolution helper at src/auth/workspace.ts; collector wiring lands in
-- §3.PR#5. Raw tokens are never stored — only HMAC-SHA256(token, pepper).
CREATE TABLE IF NOT EXISTS site_write_tokens (
  token_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      TEXT NOT NULL UNIQUE,
  workspace_id    TEXT NOT NULL,
  site_id         TEXT NOT NULL,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at     TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS site_write_tokens_workspace_site
  ON site_write_tokens (workspace_id, site_id);

CREATE INDEX IF NOT EXISTS site_write_tokens_active
  ON site_write_tokens (token_hash) WHERE disabled_at IS NULL;

-- 12. Session features (Sprint 1 PR#11 — first downstream derived layer).
-- One row per (workspace_id, site_id, session_id, extraction_version).
-- Factual aggregates only — counts, timestamps, URLs, presence flags,
-- JSONB count maps, evidence-quality min/max. NO scoring. NO classification.
-- NO bot/AI-agent taxonomy. accepted_events remains the raw evidence ledger;
-- this table is rebuildable at any time via scripts/extract-session-features.ts.
CREATE TABLE IF NOT EXISTS session_features (
  session_features_id     BIGSERIAL PRIMARY KEY,

  workspace_id            TEXT        NOT NULL,
  site_id                 TEXT        NOT NULL,
  session_id              TEXT        NOT NULL,

  extraction_version      TEXT        NOT NULL,
  extracted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  first_seen_at           TIMESTAMPTZ NOT NULL,
  last_seen_at            TIMESTAMPTZ NOT NULL,
  session_duration_ms     BIGINT      NOT NULL,

  source_event_id_min     BIGINT,
  source_event_id_max     BIGINT,
  first_event_id          BIGINT,
  last_event_id           BIGINT,

  source_event_count      INT         NOT NULL,
  page_view_count         INT         NOT NULL DEFAULT 0,
  cta_click_count         INT         NOT NULL DEFAULT 0,
  form_start_count        INT         NOT NULL DEFAULT 0,
  form_submit_count       INT         NOT NULL DEFAULT 0,
  unique_path_count       INT         NOT NULL DEFAULT 0,

  landing_page_url        TEXT,
  landing_page_path       TEXT,
  last_page_url           TEXT,
  last_page_path          TEXT,

  has_cta_click           BOOLEAN     NOT NULL DEFAULT FALSE,
  has_form_start          BOOLEAN     NOT NULL DEFAULT FALSE,
  has_form_submit         BOOLEAN     NOT NULL DEFAULT FALSE,

  event_name_counts       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  schema_key_counts       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  consent_source_counts   JSONB       NOT NULL DEFAULT '{}'::jsonb,

  canonical_key_count_min INT,
  canonical_key_count_max INT,

  CONSTRAINT session_features_natural_key UNIQUE
    (workspace_id, site_id, session_id, extraction_version)
);

CREATE INDEX IF NOT EXISTS session_features_workspace_site
  ON session_features (workspace_id, site_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS session_features_session
  ON session_features (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS session_features_extraction
  ON session_features (extraction_version, extracted_at DESC);

-- 13. Session behavioural features v0.2 (Sprint 2 PR#1 — second downstream
-- derived factual layer). One row per (workspace_id, site_id, session_id,
-- feature_version). Factual behavioural aggregates only — counts, durations,
-- boolean temporal-order observations, enum buckets, provenance metadata.
-- NO scoring. NO classification. NO bot/AI-agent taxonomy. Refresh-loop
-- server-side derivation is deferred to Sprint 2 PR#2 (no refresh_loop
-- column in v0.2). accepted_events remains the raw evidence ledger; this
-- table is rebuildable at any time via scripts/extract-behavioural-features.ts.
CREATE TABLE IF NOT EXISTS session_behavioural_features_v0_2 (
  behavioural_features_id                     BIGSERIAL PRIMARY KEY,

  workspace_id                                TEXT        NOT NULL,
  site_id                                     TEXT        NOT NULL,
  session_id                                  TEXT        NOT NULL,

  feature_version                             TEXT        NOT NULL,
  extracted_at                                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  first_seen_at                               TIMESTAMPTZ,
  last_seen_at                                TIMESTAMPTZ,
  source_event_count                          INT         NOT NULL DEFAULT 0,
  source_event_id_min                         BIGINT,
  source_event_id_max                         BIGINT,
  first_event_id                              BIGINT,
  last_event_id                               BIGINT,

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

  -- Sprint 2 PR#2 additive columns (migration 010): server-side
  -- refresh-loop / repeated-pageview factual derivation. Factual flags
  -- and counts only — NO scoring, NO judgement, NO reason codes, NO
  -- trust of SDK refresh-loop hints. refresh_loop_source is provenance
  -- only ('server_derived' in v0.3).
  refresh_loop_candidate                      BOOLEAN,
  refresh_loop_count                          INT         NOT NULL DEFAULT 0,
  same_path_repeat_count                      INT         NOT NULL DEFAULT 0,
  same_path_repeat_max_span_ms                BIGINT,
  same_path_repeat_min_delta_ms               BIGINT,
  same_path_repeat_median_delta_ms            BIGINT,
  repeat_pageview_candidate_count             INT         NOT NULL DEFAULT 0,
  refresh_loop_source                         TEXT,

  valid_feature_count                         INT         NOT NULL DEFAULT 0,
  missing_feature_count                       INT         NOT NULL DEFAULT 0,
  feature_presence_map                        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  feature_source_map                          JSONB       NOT NULL DEFAULT '{}'::jsonb,

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
  -- PR#2 non-negativity CHECK constraints
  CONSTRAINT sbf_v0_2_refresh_loop_count_nonneg
    CHECK (refresh_loop_count >= 0),
  CONSTRAINT sbf_v0_2_same_path_repeat_count_nonneg
    CHECK (same_path_repeat_count >= 0),
  CONSTRAINT sbf_v0_2_repeat_pageview_candidate_count_nonneg
    CHECK (repeat_pageview_candidate_count >= 0),

  CONSTRAINT session_behavioural_features_v0_2_natural_key UNIQUE
    (workspace_id, site_id, session_id, feature_version)
);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_workspace_site
  ON session_behavioural_features_v0_2 (workspace_id, site_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_session
  ON session_behavioural_features_v0_2 (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_version
  ON session_behavioural_features_v0_2 (feature_version, extracted_at DESC);

-- ============================================================================
-- Sprint 2 PR#3 — Lane A / Lane B scoring output contract tables.
-- ============================================================================
-- Mirrors migrations/011_scoring_output_lanes.sql. Append-only; older
-- sections of this file are not modified.
--
-- Role grants + Hard Rule I assertion live ONLY in migration 011; this
-- schema.sql block is for boot-time CREATE TABLE IF NOT EXISTS parity.
-- It is intentionally GRANT-free here because schema.sql may be applied
-- against environments that have not yet provisioned the canonical group
-- roles (operator runs docs/ops/pr3-db-role-setup-staging.md Phase 3
-- before migration 011 is applied).
--
-- PR#3 ships NO writer. PR#3 emits NO reason codes. The columns below
-- are *typed reservations* the future scorer (PR#5 / PR#6 / PR#3b)
-- writes to under separate sign-off.

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

-- ============================================================================
-- Sprint 2 PR#5 — Stage 0 RECORD_ONLY decisions table.
-- ============================================================================
-- Mirrors migrations/012_stage0_decisions.sql. Append-only; older
-- sections of this file are not modified.
--
-- Role grants + Hard-Rule-I assertion live ONLY in migration 012; this
-- schema.sql block is GRANT-free for boot-time CREATE TABLE IF NOT EXISTS
-- parity (matches the PR#3 pattern).
--
-- PR#5 ships RECORD_ONLY. No reason_codes, no verification_score, no
-- evidence_band, no action_recommendation. rule_id is a Stage-0-
-- specific enum text; the allowed values mirror the upstream Track A
-- RULES (commit 6ce15f20…). See docs/vendor/track-a-stage0-pr5.md.

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

-- ============================================================================
-- Sprint 2 PR#6 — behavioural-pattern evidence layer (risk_observations_v0_1).
-- ============================================================================
-- Mirrors migrations/013_risk_observations_v0_1.sql. Append-only; older
-- sections of this file are not modified.
--
-- Role grants + Hard-Rule-I assertion live ONLY in migration 013; this
-- schema.sql block is GRANT-free for boot-time CREATE TABLE IF NOT EXISTS
-- parity (matches the PR#3 / PR#5 pattern).
--
-- PR#6 ships RECORD_ONLY evidence-layer rows for the AMS Risk Core
-- adapter slot (CommonFeatures.BehavioralRisk01 upstream input).
-- behavioural_risk_01 is a normalised input feature in [0,1] — NOT a
-- score, NOT customer-facing, NOT a verification_score, NOT a RiskIndex.
-- No reason_codes column. No risk_index column. No verification_score
-- column. No evidence_band column. No action_recommendation column.

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
