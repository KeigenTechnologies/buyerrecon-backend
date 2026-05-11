-- Sprint 1 PR#12 verification — session_features observation queries
-- (read-only). Mirrors the §9b queries embedded in
-- scripts/observation-session-features.ts so an operator can reproduce the
-- §9b numbers by hand against a Postgres prompt without running the script.
--
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL or staging. NEVER production unless an
-- explicit approved runbook says otherwise. Every query below is a SELECT.
--
-- NOT scoring. NOT classification. NOT bot/AI-agent detection. NOT
-- enrichment. session_features remains a derived factual aggregate layer.
--
-- Before running, replace placeholders:
--   <WORKSPACE_ID>             — boundary workspace_id
--   <SITE_ID>                  — boundary site_id
--   <EXTRACTION_VERSION>       — default 'session-features-v0.1'
--   <WINDOW_START_ISO>         — e.g. '2026-05-04T00:00:00Z'
--   <WINDOW_END_ISO>           — e.g. '2026-05-11T00:00:00Z'

-- 0. Table presence (PR#12 short-circuit).
-- Expected: 'session_features' regclass for PR#11-applied environments.
SELECT to_regclass('public.session_features') AS regclass;

-- 1. Window-scoped summary aggregates (renders §9b summary lines).
SELECT
  COUNT(*)::int                                  AS rows,
  MAX(extracted_at)                              AS latest_extracted_at,
  MIN(first_seen_at)                             AS first_seen,
  MAX(last_seen_at)                              AS last_seen,
  COALESCE(SUM(source_event_count), 0)::bigint   AS total_source_events,
  COALESCE(SUM(page_view_count),    0)::bigint   AS total_page_views,
  COALESCE(SUM(cta_click_count),    0)::bigint   AS total_cta_clicks,
  COALESCE(SUM(form_start_count),   0)::bigint   AS total_form_starts,
  COALESCE(SUM(form_submit_count),  0)::bigint   AS total_form_submits,
  COALESCE(SUM(unique_path_count),  0)::bigint   AS total_unique_paths,
  MIN(canonical_key_count_min)::int              AS canonical_min,
  MAX(canonical_key_count_max)::int              AS canonical_max,
  COUNT(*) FILTER (WHERE has_cta_click)::int     AS sessions_with_cta,
  COUNT(*) FILTER (WHERE has_form_start)::int    AS sessions_with_form_start,
  COUNT(*) FILTER (WHERE has_form_submit)::int   AS sessions_with_form_submit
FROM session_features
WHERE workspace_id       = '<WORKSPACE_ID>'
  AND site_id            = '<SITE_ID>'
  AND extraction_version = '<EXTRACTION_VERSION>'
  AND last_seen_at      >= '<WINDOW_START_ISO>'::timestamptz
  AND last_seen_at      <= '<WINDOW_END_ISO>'::timestamptz;

-- 2. Anomaly counter — duplicate natural key. Expected: 0.
SELECT COUNT(*)::int AS c FROM (
  SELECT workspace_id, site_id, session_id, extraction_version
    FROM session_features
   WHERE workspace_id       = '<WORKSPACE_ID>'
     AND site_id            = '<SITE_ID>'
     AND extraction_version = '<EXTRACTION_VERSION>'
     AND last_seen_at      >= '<WINDOW_START_ISO>'::timestamptz
     AND last_seen_at      <= '<WINDOW_END_ISO>'::timestamptz
   GROUP BY workspace_id, site_id, session_id, extraction_version
  HAVING COUNT(*) > 1
) dup;

-- 3. Anomaly counter — canonical_key_count != 19. Expected: 0.
SELECT COUNT(*)::int AS c
  FROM session_features
 WHERE workspace_id       = '<WORKSPACE_ID>'
   AND site_id            = '<SITE_ID>'
   AND extraction_version = '<EXTRACTION_VERSION>'
   AND last_seen_at      >= '<WINDOW_START_ISO>'::timestamptz
   AND last_seen_at      <= '<WINDOW_END_ISO>'::timestamptz
   AND canonical_key_count_min IS NOT NULL
   AND (canonical_key_count_min <> 19 OR canonical_key_count_max <> 19);

-- 4. Anomaly counter — has_* flag mismatch. Expected: 0 / 0 / 0.
SELECT
  COUNT(*) FILTER (
    WHERE (has_cta_click  AND cta_click_count  = 0)
       OR (NOT has_cta_click  AND cta_click_count  > 0)
  )::int AS cta_mismatch,
  COUNT(*) FILTER (
    WHERE (has_form_start  AND form_start_count  = 0)
       OR (NOT has_form_start  AND form_start_count  > 0)
  )::int AS form_start_mismatch,
  COUNT(*) FILTER (
    WHERE (has_form_submit AND form_submit_count = 0)
       OR (NOT has_form_submit AND form_submit_count > 0)
  )::int AS form_submit_mismatch
FROM session_features
WHERE workspace_id       = '<WORKSPACE_ID>'
  AND site_id            = '<SITE_ID>'
  AND extraction_version = '<EXTRACTION_VERSION>'
  AND last_seen_at      >= '<WINDOW_START_ISO>'::timestamptz
  AND last_seen_at      <= '<WINDOW_END_ISO>'::timestamptz;

-- 5. Anomaly counter — session_duration_ms math. Expected: 0.
SELECT COUNT(*)::int AS c
  FROM session_features
 WHERE workspace_id       = '<WORKSPACE_ID>'
   AND site_id            = '<SITE_ID>'
   AND extraction_version = '<EXTRACTION_VERSION>'
   AND last_seen_at      >= '<WINDOW_START_ISO>'::timestamptz
   AND last_seen_at      <= '<WINDOW_END_ISO>'::timestamptz
   AND session_duration_ms <> (EXTRACT(EPOCH FROM (last_seen_at - first_seen_at)) * 1000)::bigint;

-- 6. Anomaly counter — JSONB count-map type sanity. Expected: 0.
SELECT COUNT(*)::int AS c
  FROM session_features
 WHERE workspace_id       = '<WORKSPACE_ID>'
   AND site_id            = '<SITE_ID>'
   AND extraction_version = '<EXTRACTION_VERSION>'
   AND last_seen_at      >= '<WINDOW_START_ISO>'::timestamptz
   AND last_seen_at      <= '<WINDOW_END_ISO>'::timestamptz
   AND (jsonb_typeof(event_name_counts)     <> 'object'
     OR jsonb_typeof(schema_key_counts)     <> 'object'
     OR jsonb_typeof(consent_source_counts) <> 'object');

-- 7. Anomaly counter — source_event_count vs full-session accepted_events.
-- This is the PR#12 invariant: sessions selected by window must match the
-- FULL-SESSION accepted_events count (inner join has NO time filter on
-- accepted_events.received_at). Expected: 0.
SELECT COUNT(*)::int AS c
  FROM session_features sf
 WHERE sf.workspace_id       = '<WORKSPACE_ID>'
   AND sf.site_id            = '<SITE_ID>'
   AND sf.extraction_version = '<EXTRACTION_VERSION>'
   AND sf.last_seen_at      >= '<WINDOW_START_ISO>'::timestamptz
   AND sf.last_seen_at      <= '<WINDOW_END_ISO>'::timestamptz
   AND sf.source_event_count <> (
     SELECT COUNT(*)::int
       FROM accepted_events ae
      WHERE ae.workspace_id = sf.workspace_id
        AND ae.site_id      = sf.site_id
        AND ae.session_id   = sf.session_id
        AND ae.event_contract_version = 'event-contract-v0.1'
        AND ae.event_origin = 'browser'
        AND ae.session_id  <> '__server__'
   );

-- 8. Freshness — boundary-wide latest accepted_events.received_at vs
-- boundary-wide latest session_features.extracted_at (NOT window-scoped).
-- §9b lag = (latest_accepted - latest_extracted_overall) in hours.
SELECT
  (SELECT MAX(received_at) FROM accepted_events
    WHERE workspace_id = '<WORKSPACE_ID>' AND site_id = '<SITE_ID>')
                                                                       AS latest_accepted,
  (SELECT MAX(extracted_at) FROM session_features
    WHERE workspace_id = '<WORKSPACE_ID>' AND site_id = '<SITE_ID>'
      AND extraction_version = '<EXTRACTION_VERSION>')
                                                                       AS latest_extracted_overall;

-- 9. Top-10 latest rows for human inspection (paths only, no URLs; truncate
-- session_id at render-time in scripts, not here).
SELECT session_id,
       source_event_count,
       page_view_count, cta_click_count, form_start_count, form_submit_count,
       unique_path_count,
       landing_page_path, last_page_path,
       canonical_key_count_min, canonical_key_count_max,
       extracted_at
  FROM session_features
 WHERE workspace_id       = '<WORKSPACE_ID>'
   AND site_id            = '<SITE_ID>'
   AND extraction_version = '<EXTRACTION_VERSION>'
   AND last_seen_at      >= '<WINDOW_START_ISO>'::timestamptz
   AND last_seen_at      <= '<WINDOW_END_ISO>'::timestamptz
 ORDER BY last_seen_at DESC, session_id ASC
 LIMIT 10;
