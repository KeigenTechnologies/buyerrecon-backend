-- buyerrecon-backend/src/db/schema.sql
-- Truth Pipeline schema per spec v1.1

-- UUID generation: gen_random_uuid() is built-in on PostgreSQL 14+.
-- Fly.io managed PostgreSQL is 16. For portability on older versions:
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Accepted events (append-only raw truth ledger, spec §6.2)
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
    event_contract_version TEXT NOT NULL DEFAULT 'legacy-thin-v2.0'
);

CREATE INDEX IF NOT EXISTS idx_accepted_site_received ON accepted_events (site_id, received_at);
CREATE INDEX IF NOT EXISTS idx_accepted_site_type ON accepted_events (site_id, event_type);
CREATE INDEX IF NOT EXISTS idx_accepted_session ON accepted_events (session_id);
CREATE INDEX IF NOT EXISTS idx_accepted_browser ON accepted_events (browser_id);
CREATE INDEX IF NOT EXISTS idx_accepted_site_ts ON accepted_events (site_id, client_timestamp_ms);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accepted_dedup_client_event ON accepted_events (site_id, session_id, client_event_id) WHERE client_event_id IS NOT NULL;

-- 2. Rejected events (spec §6.2)
CREATE TABLE IF NOT EXISTS rejected_events (
    id BIGSERIAL PRIMARY KEY,
    site_id TEXT,
    raw JSONB NOT NULL,
    reason_codes TEXT[] NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collector_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rejected_received ON rejected_events (received_at);
CREATE INDEX IF NOT EXISTS idx_rejected_site ON rejected_events (site_id);

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
