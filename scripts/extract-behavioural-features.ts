#!/usr/bin/env tsx
/**
 * Sprint 2 PR#1 — behavioural_features_v0.2 extractor
 * (Track B, downstream factual layer).
 *
 * Reads `accepted_events`. Writes / upserts
 * `session_behavioural_features_v0_2`. NEVER writes to accepted_events,
 * rejected_events, ingest_requests, site_write_tokens, or session_features.
 * NEVER reads token_hash, peppers, or any auth secret.
 *
 * This extractor is a FACTUAL BRIDGE for future scoring layers (Sprint 2
 * PR#5 Stage 0, PR#6 Stage 1). It is NOT a scorer.
 *
 * Hard non-scoring boundary:
 *   - No risk_score / score / classification / recommended_action /
 *     confidence_band / is_bot / is_agent / ai_agent / is_human / buyer /
 *     intent / lead_quality / CRM / company_enrich / ip_enrich /
 *     reason_code fields, variables, or emitted strings.
 *   - No A_* / B_* / REVIEW_* / OBS_* emitted reason codes.
 *   - Refresh-loop server-side derivation is DEFERRED to Sprint 2 PR#2
 *     per A0 §K + D-3. This extractor does NOT compute or persist any
 *     refresh-loop column.
 *
 * Candidate-window vs full-session aggregation (mirrors PR#11):
 *   - The window (SINCE_HOURS, default 168) selects CANDIDATE SESSIONS —
 *     sessions with at least one accepted_event whose received_at falls
 *     in the window.
 *   - Aggregation runs over ALL accepted_events for those candidate
 *     sessions, regardless of received_at. This prevents a narrow later
 *     run from overwriting full-session facts with partial-window facts.
 *
 * Idempotent upsert:
 *   ON CONFLICT (workspace_id, site_id, session_id, feature_version)
 *   DO UPDATE — re-runs refresh the same row; behavioural_features_id is
 *   stable.
 *
 * Filters (locked):
 *   - event_contract_version = 'event-contract-v0.1'  (v1 only)
 *   - event_origin           = 'browser'              (visitor sessions only)
 *   - workspace_id IS NOT NULL AND site_id IS NOT NULL
 *   - session_id   IS NOT NULL AND session_id <> '__server__'
 *
 * Inputs (env vars):
 *   DATABASE_URL    — collector Postgres URL (REQUIRED; never printed)
 *   WORKSPACE_ID    — optional filter
 *   SITE_ID         — optional filter
 *   SINCE_HOURS     — candidate window in hours (default 168)
 *   SINCE           — optional ISO timestamp; overrides SINCE_HOURS lower bound
 *   UNTIL           — optional ISO timestamp; overrides upper bound (default NOW)
 *   FEATURE_VERSION — default 'behavioural-features-v0.2'
 *
 * Exits 0 on success, 1 on missing env or DB failure.
 *
 * Authority:
 *   docs/architecture/ARCHITECTURE_GATE_A0.md (commit a87eb05)
 *   docs/contracts/signal-truth-v0.1.md
 *   docs/sprint2-pr1-behavioural-features-v0.2-planning.md (Helen-approved)
 *
 * NOT Track A. NOT Core AMS. NO scoring. Factual aggregates only.
 */

import 'dotenv/config';
import pg from 'pg';

export const DEFAULT_FEATURE_VERSION = 'behavioural-features-v0.2';
export const DEFAULT_SINCE_HOURS = 168;

/**
 * The expected total feature count tracked in feature_presence_map +
 * feature_source_map for the v0.2 feature_version. 12 fields:
 *   1.  ms_from_consent_to_first_cta
 *   2.  dwell_ms_before_first_action
 *   3.  first_form_start_precedes_first_cta
 *   4.  form_start_count_before_first_cta
 *   5.  has_form_submit_without_prior_form_start
 *   6.  form_submit_count_before_first_form_start
 *   7.  ms_between_pageviews_p50
 *   8.  pageview_burst_count_10s
 *   9.  max_events_per_second
 *  10.  sub_200ms_transition_count
 *  11.  interaction_density_bucket
 *  12.  scroll_depth_bucket_before_first_cta
 *
 * valid_feature_count + missing_feature_count = EXPECTED_FEATURE_COUNT_V0_2
 * for every row. Verified by invariant SQL in
 * docs/sql/verification/08_behavioural_features_invariants.sql.
 */
export const EXPECTED_FEATURE_COUNT_V0_2 = 12;

/* --------------------------------------------------------------------------
 * Env + arg parsing
 * ------------------------------------------------------------------------ */

export interface ExtractorOptions {
  workspace_id: string | null;
  site_id: string | null;
  window_start: Date;
  window_end: Date;
  feature_version: string;
}

function fail(msg: string): never {
  console.error(`Sprint 2 PR#1 behavioural-features extractor — ${msg}`);
  process.exit(1);
}

export function parseOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): ExtractorOptions {
  const workspace_id =
    typeof env.WORKSPACE_ID === 'string' && env.WORKSPACE_ID.length > 0
      ? env.WORKSPACE_ID
      : null;
  const site_id =
    typeof env.SITE_ID === 'string' && env.SITE_ID.length > 0
      ? env.SITE_ID
      : null;

  let window_start: Date;
  let window_end: Date;

  if (typeof env.UNTIL === 'string' && env.UNTIL.length > 0) {
    const u = Date.parse(env.UNTIL);
    if (!Number.isFinite(u)) {
      fail(`UNTIL is not a parseable timestamp: ${JSON.stringify(env.UNTIL)}`);
    }
    window_end = new Date(u);
  } else {
    window_end = now;
  }

  if (typeof env.SINCE === 'string' && env.SINCE.length > 0) {
    const s = Date.parse(env.SINCE);
    if (!Number.isFinite(s)) {
      fail(`SINCE is not a parseable timestamp: ${JSON.stringify(env.SINCE)}`);
    }
    window_start = new Date(s);
  } else {
    const hoursRaw = env.SINCE_HOURS ?? String(DEFAULT_SINCE_HOURS);
    const hours = Number.parseInt(hoursRaw, 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      fail(`SINCE_HOURS must be a positive integer (got ${JSON.stringify(hoursRaw)})`);
    }
    window_start = new Date(window_end.getTime() - hours * 3600 * 1000);
  }

  if (window_start.getTime() >= window_end.getTime()) {
    fail('window_start must be strictly before window_end');
  }

  const feature_version =
    typeof env.FEATURE_VERSION === 'string' && env.FEATURE_VERSION.length > 0
      ? env.FEATURE_VERSION
      : DEFAULT_FEATURE_VERSION;

  return { workspace_id, site_id, window_start, window_end, feature_version };
}

/* --------------------------------------------------------------------------
 * Pure helpers
 * ------------------------------------------------------------------------ */

export type InteractionDensityBucket = '0' | '1-2' | '3-5' | '6-10' | '>10';

/**
 * Pure-function bucket mapper for interaction density. Buckets are
 * factual count ranges (not severity labels). Total = cta_click +
 * form_start + form_submit counts.
 */
export function bucketiseInteractionDensity(total: number): InteractionDensityBucket {
  if (!Number.isFinite(total) || total <= 0) return '0';
  if (total <= 2) return '1-2';
  if (total <= 5) return '3-5';
  if (total <= 10) return '6-10';
  return '>10';
}

export type ScrollDepthBucket = '0' | '1-25' | '26-50' | '51-75' | '76-100';

/**
 * Pure-function bucket mapper for scroll depth percentage. Buckets are
 * factual percentage ranges. Returns null when input is null/missing —
 * the SDK does not emit scroll events in v1, so this function exists for
 * forward compatibility and tests but currently always receives null.
 */
export function bucketiseScrollDepth(pct: number | null | undefined): ScrollDepthBucket | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  if (pct <= 0) return '0';
  if (pct <= 25) return '1-25';
  if (pct <= 50) return '26-50';
  if (pct <= 75) return '51-75';
  return '76-100';
}

/* --------------------------------------------------------------------------
 * SQL — single idempotent INSERT … ON CONFLICT DO UPDATE pipeline
 *
 * Stage A: candidate_sessions   — sessions touched in window
 * Stage B: session_events       — ALL v1 browser events for those sessions
 *                                  (full-session aggregation, NOT window-bounded)
 * Stage C: ordered_events       — ROW_NUMBER for first/last endpoint resolution
 * Stage D: endpoints            — first/last received_at + event_id + counts
 * Stage E: landmark CTEs        — consent / cta / form_start / form_submit / page_view / action
 * Stage F: order_anomalies      — form_start before cta, form_submit before form_start
 * Stage G: pageview_ordered     — ordered page_view events with LAG
 *           → pageview_deltas    — inter-pageview deltas in ms
 *           → pageview_delta_stats — p50 + sub-200ms transition count
 *           → pageview_burst    — max page_views in any 10-second window
 * Stage H: events_per_second    — per-second event count
 *           → event_rate         — max events per second
 * Stage I: INSERT … ON CONFLICT — upsert into session_behavioural_features_v0_2
 * ------------------------------------------------------------------------ */

export const EXTRACTION_SQL = `
WITH candidate_sessions AS (
  SELECT DISTINCT ae.workspace_id, ae.site_id, ae.session_id
    FROM accepted_events ae
   WHERE ae.received_at >= $1
     AND ae.received_at <= $2
     AND ($3::text IS NULL OR ae.workspace_id = $3)
     AND ($4::text IS NULL OR ae.site_id      = $4)
     AND ae.event_contract_version = 'event-contract-v0.1'
     AND ae.event_origin = 'browser'
     AND ae.workspace_id IS NOT NULL
     AND ae.site_id      IS NOT NULL
     AND ae.session_id   IS NOT NULL
     AND ae.session_id  <> '__server__'
),
session_events AS (
  SELECT ae.event_id,
         ae.workspace_id,
         ae.site_id,
         ae.session_id,
         ae.received_at,
         ae.consent_state,
         ae.raw->>'event_name' AS event_name,
         ae.raw->>'page_path'  AS page_path
    FROM accepted_events ae
    JOIN candidate_sessions cs USING (workspace_id, site_id, session_id)
   WHERE ae.event_contract_version = 'event-contract-v0.1'
     AND ae.event_origin = 'browser'
     AND ae.session_id  <> '__server__'
),
ordered_events AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, site_id, session_id
           ORDER BY received_at ASC, event_id ASC
         ) AS event_rn,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, site_id, session_id
           ORDER BY received_at DESC, event_id DESC
         ) AS event_rn_desc
    FROM session_events
),
endpoints AS (
  SELECT workspace_id, site_id, session_id,
         COUNT(*)::int                                                 AS source_event_count,
         MIN(event_id)::bigint                                         AS source_event_id_min,
         MAX(event_id)::bigint                                         AS source_event_id_max,
         MAX(CASE WHEN event_rn      = 1 THEN received_at END)         AS first_seen_at,
         MAX(CASE WHEN event_rn_desc = 1 THEN received_at END)         AS last_seen_at,
         MAX(CASE WHEN event_rn      = 1 THEN event_id END)::bigint    AS first_event_id,
         MAX(CASE WHEN event_rn_desc = 1 THEN event_id END)::bigint    AS last_event_id
    FROM ordered_events
   GROUP BY workspace_id, site_id, session_id
),
consent_landmarks AS (
  SELECT workspace_id, site_id, session_id,
         MIN(received_at) AS first_consent_at
    FROM session_events
   WHERE consent_state IS NOT NULL AND consent_state <> ''
   GROUP BY workspace_id, site_id, session_id
),
cta_landmarks AS (
  SELECT workspace_id, site_id, session_id,
         MIN(received_at) AS first_cta_at,
         COUNT(*)::int    AS cta_click_count
    FROM session_events
   WHERE event_name = 'cta_click'
   GROUP BY workspace_id, site_id, session_id
),
form_start_landmarks AS (
  SELECT workspace_id, site_id, session_id,
         MIN(received_at) AS first_form_start_at,
         COUNT(*)::int    AS form_start_count
    FROM session_events
   WHERE event_name = 'form_start'
   GROUP BY workspace_id, site_id, session_id
),
form_submit_landmarks AS (
  SELECT workspace_id, site_id, session_id,
         COUNT(*)::int    AS form_submit_count
    FROM session_events
   WHERE event_name = 'form_submit'
   GROUP BY workspace_id, site_id, session_id
),
page_view_landmarks AS (
  SELECT workspace_id, site_id, session_id,
         MIN(received_at) AS first_page_view_at,
         COUNT(*)::int    AS page_view_count
    FROM session_events
   WHERE event_name = 'page_view'
   GROUP BY workspace_id, site_id, session_id
),
action_landmarks AS (
  SELECT workspace_id, site_id, session_id,
         MIN(received_at) AS first_action_at
    FROM session_events
   WHERE event_name IN ('cta_click', 'form_start', 'form_submit')
   GROUP BY workspace_id, site_id, session_id
),
order_anomalies AS (
  SELECT se.workspace_id, se.site_id, se.session_id,
         SUM(
           CASE
             WHEN se.event_name = 'form_start'
              AND (cl.first_cta_at IS NULL OR se.received_at < cl.first_cta_at)
             THEN 1 ELSE 0
           END
         )::int AS form_start_count_before_first_cta,
         SUM(
           CASE
             WHEN se.event_name = 'form_submit'
              AND (fsl.first_form_start_at IS NULL OR se.received_at < fsl.first_form_start_at)
             THEN 1 ELSE 0
           END
         )::int AS form_submit_count_before_first_form_start
    FROM session_events se
    LEFT JOIN cta_landmarks        cl  USING (workspace_id, site_id, session_id)
    LEFT JOIN form_start_landmarks fsl USING (workspace_id, site_id, session_id)
   GROUP BY se.workspace_id, se.site_id, se.session_id
),
pageview_ordered AS (
  SELECT workspace_id, site_id, session_id, event_id, received_at,
         LAG(received_at) OVER (
           PARTITION BY workspace_id, site_id, session_id
           ORDER BY received_at ASC, event_id ASC
         ) AS prev_pv_at
    FROM session_events
   WHERE event_name = 'page_view'
),
pageview_deltas AS (
  SELECT workspace_id, site_id, session_id,
         (EXTRACT(EPOCH FROM (received_at - prev_pv_at)) * 1000)::numeric AS delta_ms
    FROM pageview_ordered
   WHERE prev_pv_at IS NOT NULL
),
pageview_delta_stats AS (
  SELECT workspace_id, site_id, session_id,
         (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta_ms))::bigint  AS ms_between_pageviews_p50,
         SUM(CASE WHEN delta_ms < 200 THEN 1 ELSE 0 END)::int             AS sub_200ms_transition_count
    FROM pageview_deltas
   GROUP BY workspace_id, site_id, session_id
),
pageview_burst AS (
  SELECT workspace_id, site_id, session_id,
         MAX(burst_count)::int AS pageview_burst_count_10s
    FROM (
      SELECT workspace_id, site_id, session_id,
             COUNT(*) OVER (
               PARTITION BY workspace_id, site_id, session_id
               ORDER BY received_at
               RANGE BETWEEN CURRENT ROW AND INTERVAL '10 seconds' FOLLOWING
             ) AS burst_count
        FROM pageview_ordered
    ) sub
   GROUP BY workspace_id, site_id, session_id
),
events_per_second AS (
  SELECT workspace_id, site_id, session_id,
         date_trunc('second', received_at) AS sec_bucket,
         COUNT(*)::int AS cnt
    FROM session_events
   GROUP BY workspace_id, site_id, session_id, date_trunc('second', received_at)
),
event_rate AS (
  SELECT workspace_id, site_id, session_id,
         MAX(cnt)::int AS max_events_per_second
    FROM events_per_second
   GROUP BY workspace_id, site_id, session_id
),
feature_aggs AS (
  SELECT
    ep.workspace_id,
    ep.site_id,
    ep.session_id,
    ep.first_seen_at,
    ep.last_seen_at,
    ep.source_event_count,
    ep.source_event_id_min,
    ep.source_event_id_max,
    ep.first_event_id,
    ep.last_event_id,

    -- ms_from_consent_to_first_cta (BIGINT — multi-day sessions possible)
    CASE
      WHEN cnl.first_consent_at IS NULL OR cl.first_cta_at IS NULL          THEN NULL
      WHEN cl.first_cta_at < cnl.first_consent_at                            THEN NULL
      ELSE (EXTRACT(EPOCH FROM (cl.first_cta_at - cnl.first_consent_at)) * 1000)::bigint
    END AS ms_from_consent_to_first_cta,

    -- dwell_ms_before_first_action (BIGINT — multi-day sessions possible)
    CASE
      WHEN pvl.first_page_view_at IS NULL OR al.first_action_at IS NULL     THEN NULL
      WHEN al.first_action_at < pvl.first_page_view_at                       THEN NULL
      ELSE (EXTRACT(EPOCH FROM (al.first_action_at - pvl.first_page_view_at)) * 1000)::bigint
    END AS dwell_ms_before_first_action,

    -- first_form_start_precedes_first_cta (always boolean; never NULL)
    CASE
      WHEN fsl.first_form_start_at IS NULL THEN FALSE
      WHEN cl.first_cta_at         IS NULL THEN TRUE
      ELSE fsl.first_form_start_at < cl.first_cta_at
    END AS first_form_start_precedes_first_cta,

    COALESCE(oa.form_start_count_before_first_cta, 0)             AS form_start_count_before_first_cta,
    (COALESCE(oa.form_submit_count_before_first_form_start, 0) > 0) AS has_form_submit_without_prior_form_start,
    COALESCE(oa.form_submit_count_before_first_form_start, 0)     AS form_submit_count_before_first_form_start,

    pds.ms_between_pageviews_p50,
    COALESCE(pb.pageview_burst_count_10s, 0)                       AS pageview_burst_count_10s,
    COALESCE(er.max_events_per_second, 0)                          AS max_events_per_second,
    COALESCE(pds.sub_200ms_transition_count, 0)                    AS sub_200ms_transition_count,

    -- interaction_density_bucket (factual count ranges; not severity)
    CASE
      WHEN (COALESCE(cl.cta_click_count, 0)
          + COALESCE(fsl.form_start_count, 0)
          + COALESCE(fsm.form_submit_count, 0)) <= 0       THEN '0'
      WHEN (COALESCE(cl.cta_click_count, 0)
          + COALESCE(fsl.form_start_count, 0)
          + COALESCE(fsm.form_submit_count, 0)) <= 2       THEN '1-2'
      WHEN (COALESCE(cl.cta_click_count, 0)
          + COALESCE(fsl.form_start_count, 0)
          + COALESCE(fsm.form_submit_count, 0)) <= 5       THEN '3-5'
      WHEN (COALESCE(cl.cta_click_count, 0)
          + COALESCE(fsl.form_start_count, 0)
          + COALESCE(fsm.form_submit_count, 0)) <= 10      THEN '6-10'
      ELSE '>10'
    END AS interaction_density_bucket,

    -- scroll_depth_bucket_before_first_cta: SDK does not emit scroll
    -- events in v1; column is always NULL and provenance map records
    -- 'not_extractable'.
    NULL::text AS scroll_depth_bucket_before_first_cta

  FROM endpoints ep
  LEFT JOIN consent_landmarks     cnl USING (workspace_id, site_id, session_id)
  LEFT JOIN cta_landmarks         cl  USING (workspace_id, site_id, session_id)
  LEFT JOIN form_start_landmarks  fsl USING (workspace_id, site_id, session_id)
  LEFT JOIN form_submit_landmarks fsm USING (workspace_id, site_id, session_id)
  LEFT JOIN page_view_landmarks   pvl USING (workspace_id, site_id, session_id)
  LEFT JOIN action_landmarks      al  USING (workspace_id, site_id, session_id)
  LEFT JOIN order_anomalies       oa  USING (workspace_id, site_id, session_id)
  LEFT JOIN pageview_delta_stats  pds USING (workspace_id, site_id, session_id)
  LEFT JOIN pageview_burst        pb  USING (workspace_id, site_id, session_id)
  LEFT JOIN event_rate            er  USING (workspace_id, site_id, session_id)
),
presence_labels AS (
  SELECT
    fa.*,
    -- Per-field presence labels: 'present' | 'missing' | 'not_extractable'.
    CASE WHEN fa.ms_from_consent_to_first_cta IS NULL THEN 'missing' ELSE 'present' END
      AS p_ms_consent_cta,
    CASE WHEN fa.dwell_ms_before_first_action IS NULL THEN 'missing' ELSE 'present' END
      AS p_dwell,
    'present'::text AS p_first_form_start_precedes,
    'present'::text AS p_form_start_before_cta_count,
    'present'::text AS p_has_form_submit_no_prior_fs,
    'present'::text AS p_form_submit_before_fs_count,
    CASE WHEN fa.ms_between_pageviews_p50 IS NULL THEN 'missing' ELSE 'present' END
      AS p_pv_p50,
    'present'::text AS p_pv_burst_10s,
    'present'::text AS p_max_eps,
    'present'::text AS p_sub_200ms,
    'present'::text AS p_interaction_density,
    'not_extractable'::text AS p_scroll_depth
  FROM feature_aggs fa
)
INSERT INTO session_behavioural_features_v0_2 (
  workspace_id, site_id, session_id, feature_version, extracted_at,
  first_seen_at, last_seen_at,
  source_event_count, source_event_id_min, source_event_id_max,
  first_event_id, last_event_id,
  ms_from_consent_to_first_cta,
  dwell_ms_before_first_action,
  first_form_start_precedes_first_cta,
  form_start_count_before_first_cta,
  has_form_submit_without_prior_form_start,
  form_submit_count_before_first_form_start,
  ms_between_pageviews_p50,
  pageview_burst_count_10s,
  max_events_per_second,
  sub_200ms_transition_count,
  interaction_density_bucket,
  scroll_depth_bucket_before_first_cta,
  valid_feature_count,
  missing_feature_count,
  feature_presence_map,
  feature_source_map
)
SELECT
  pl.workspace_id, pl.site_id, pl.session_id,
  $5::text AS feature_version,
  NOW()    AS extracted_at,
  pl.first_seen_at,
  pl.last_seen_at,
  pl.source_event_count,
  pl.source_event_id_min,
  pl.source_event_id_max,
  pl.first_event_id,
  pl.last_event_id,
  pl.ms_from_consent_to_first_cta,
  pl.dwell_ms_before_first_action,
  pl.first_form_start_precedes_first_cta,
  pl.form_start_count_before_first_cta,
  pl.has_form_submit_without_prior_form_start,
  pl.form_submit_count_before_first_form_start,
  pl.ms_between_pageviews_p50,
  pl.pageview_burst_count_10s,
  pl.max_events_per_second,
  pl.sub_200ms_transition_count,
  pl.interaction_density_bucket,
  pl.scroll_depth_bucket_before_first_cta,
  -- valid_feature_count: count of 'present' labels (12 max)
  (
    (CASE WHEN pl.p_ms_consent_cta              = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_dwell                       = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_first_form_start_precedes   = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_form_start_before_cta_count = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_has_form_submit_no_prior_fs = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_form_submit_before_fs_count = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_pv_p50                      = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_pv_burst_10s                = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_max_eps                     = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_sub_200ms                   = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_interaction_density         = 'present' THEN 1 ELSE 0 END)
  + (CASE WHEN pl.p_scroll_depth                = 'present' THEN 1 ELSE 0 END)
  )::int AS valid_feature_count,
  -- missing_feature_count: 12 - valid_feature_count (count of non-'present')
  (
    12
  - (CASE WHEN pl.p_ms_consent_cta              = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_dwell                       = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_first_form_start_precedes   = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_form_start_before_cta_count = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_has_form_submit_no_prior_fs = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_form_submit_before_fs_count = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_pv_p50                      = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_pv_burst_10s                = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_max_eps                     = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_sub_200ms                   = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_interaction_density         = 'present' THEN 1 ELSE 0 END)
  - (CASE WHEN pl.p_scroll_depth                = 'present' THEN 1 ELSE 0 END)
  )::int AS missing_feature_count,
  -- feature_presence_map: JSONB object keyed by the 12 feature names
  jsonb_build_object(
    'ms_from_consent_to_first_cta',                pl.p_ms_consent_cta,
    'dwell_ms_before_first_action',                pl.p_dwell,
    'first_form_start_precedes_first_cta',         pl.p_first_form_start_precedes,
    'form_start_count_before_first_cta',           pl.p_form_start_before_cta_count,
    'has_form_submit_without_prior_form_start',    pl.p_has_form_submit_no_prior_fs,
    'form_submit_count_before_first_form_start',   pl.p_form_submit_before_fs_count,
    'ms_between_pageviews_p50',                    pl.p_pv_p50,
    'pageview_burst_count_10s',                    pl.p_pv_burst_10s,
    'max_events_per_second',                       pl.p_max_eps,
    'sub_200ms_transition_count',                  pl.p_sub_200ms,
    'interaction_density_bucket',                  pl.p_interaction_density,
    'scroll_depth_bucket_before_first_cta',        pl.p_scroll_depth
  ) AS feature_presence_map,
  -- feature_source_map: per-field derivation source label.
  -- 'server_derived' for the 11 fields derived from accepted_events.
  -- 'not_extractable' for scroll_depth (SDK does not emit scroll in v1).
  jsonb_build_object(
    'ms_from_consent_to_first_cta',                'server_derived',
    'dwell_ms_before_first_action',                'server_derived',
    'first_form_start_precedes_first_cta',         'server_derived',
    'form_start_count_before_first_cta',           'server_derived',
    'has_form_submit_without_prior_form_start',    'server_derived',
    'form_submit_count_before_first_form_start',   'server_derived',
    'ms_between_pageviews_p50',                    'server_derived',
    'pageview_burst_count_10s',                    'server_derived',
    'max_events_per_second',                       'server_derived',
    'sub_200ms_transition_count',                  'server_derived',
    'interaction_density_bucket',                  'server_derived',
    'scroll_depth_bucket_before_first_cta',        'not_extractable'
  ) AS feature_source_map
FROM presence_labels pl
ON CONFLICT (workspace_id, site_id, session_id, feature_version)
DO UPDATE SET
  extracted_at                              = EXCLUDED.extracted_at,
  first_seen_at                             = EXCLUDED.first_seen_at,
  last_seen_at                              = EXCLUDED.last_seen_at,
  source_event_count                        = EXCLUDED.source_event_count,
  source_event_id_min                       = EXCLUDED.source_event_id_min,
  source_event_id_max                       = EXCLUDED.source_event_id_max,
  first_event_id                            = EXCLUDED.first_event_id,
  last_event_id                             = EXCLUDED.last_event_id,
  ms_from_consent_to_first_cta              = EXCLUDED.ms_from_consent_to_first_cta,
  dwell_ms_before_first_action              = EXCLUDED.dwell_ms_before_first_action,
  first_form_start_precedes_first_cta       = EXCLUDED.first_form_start_precedes_first_cta,
  form_start_count_before_first_cta         = EXCLUDED.form_start_count_before_first_cta,
  has_form_submit_without_prior_form_start  = EXCLUDED.has_form_submit_without_prior_form_start,
  form_submit_count_before_first_form_start = EXCLUDED.form_submit_count_before_first_form_start,
  ms_between_pageviews_p50                  = EXCLUDED.ms_between_pageviews_p50,
  pageview_burst_count_10s                  = EXCLUDED.pageview_burst_count_10s,
  max_events_per_second                     = EXCLUDED.max_events_per_second,
  sub_200ms_transition_count                = EXCLUDED.sub_200ms_transition_count,
  interaction_density_bucket                = EXCLUDED.interaction_density_bucket,
  scroll_depth_bucket_before_first_cta      = EXCLUDED.scroll_depth_bucket_before_first_cta,
  valid_feature_count                       = EXCLUDED.valid_feature_count,
  missing_feature_count                     = EXCLUDED.missing_feature_count,
  feature_presence_map                      = EXCLUDED.feature_presence_map,
  feature_source_map                        = EXCLUDED.feature_source_map
RETURNING behavioural_features_id, workspace_id, site_id, session_id
`;

/* --------------------------------------------------------------------------
 * Runner — connects, runs the SQL, prints a small summary
 * ------------------------------------------------------------------------ */

export interface ExtractionResult {
  upserted_rows: number;
  options: ExtractorOptions;
}

export async function runExtraction(
  pool: pg.Pool | pg.PoolClient | pg.Client,
  opts: ExtractorOptions,
): Promise<ExtractionResult> {
  const params: unknown[] = [
    opts.window_start,
    opts.window_end,
    opts.workspace_id,
    opts.site_id,
    opts.feature_version,
  ];
  const res = await pool.query(EXTRACTION_SQL, params);
  return {
    upserted_rows: typeof res.rowCount === 'number' ? res.rowCount : (res.rows?.length ?? 0),
    options: opts,
  };
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//<user:****>@${u.host || '<host>'}/<db>`;
  } catch {
    return '<set, masked>';
  }
}

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    fail('DATABASE_URL is required.');
  }
  const opts = parseOptionsFromEnv();

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch (err) {
    console.error(
      'Sprint 2 PR#1 behavioural-features extractor — DB connection failed:',
      (err as Error).message,
    );
    return 1;
  }

  try {
    const result = await runExtraction(client, opts);

    const lines: string[] = [];
    lines.push('# Behavioural-features extraction summary');
    lines.push('');
    lines.push(`- feature_version:        ${opts.feature_version}`);
    lines.push(`- workspace_id filter:    ${opts.workspace_id ?? '(none)'}`);
    lines.push(`- site_id filter:         ${opts.site_id ?? '(none)'}`);
    lines.push(
      `- candidate window:       ${opts.window_start.toISOString()} → ${opts.window_end.toISOString()}`,
    );
    lines.push(`- database_url:           ${maskUrl(databaseUrl)}`);
    lines.push(`- rows upserted:          ${result.upserted_rows}`);
    lines.push('');
    process.stdout.write(lines.join('\n'));
    if (!lines[lines.length - 1].endsWith('\n')) process.stdout.write('\n');
    return 0;
  } catch (err) {
    console.error(
      'Sprint 2 PR#1 behavioural-features extractor — extraction failed:',
      (err as Error).message,
    );
    return 1;
  } finally {
    await client.end();
  }
}

// Only run main() when invoked as a CLI script. Tests import the exports
// above without triggering the runner.
const invokedAsScript =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module;

if (invokedAsScript) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(
        'Sprint 2 PR#1 behavioural-features extractor — fatal:',
        (err as Error).message,
      );
      process.exit(1);
    });
}
