#!/usr/bin/env tsx
/**
 * Sprint 2 PR#1 + PR#2 — behavioural_features_v0.3 extractor
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
 *   - PR#2 adds server-side refresh-loop / repeated-pageview FACTUAL
 *     derivation only. No `refresh_loop_observed` column — that name
 *     implies judgement. Use `refresh_loop_candidate` (factual flag
 *     under fixed extraction thresholds).
 *   - SDK refresh-loop hints are NEVER trusted as truth. PR#2 derives
 *     server-side from accepted_events sequence (Helen-approved D-4
 *     Option α: ignore SDK refresh-loop hints entirely). No
 *     `sdk_hint_present_not_trusted` field is emitted in PR#2.
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
 *   FEATURE_VERSION — default 'behavioural-features-v0.3'
 *                     ('behavioural-features-v0.2' still accepted; emits
 *                     12-key feature_presence_map / feature_source_map.)
 *
 * Exits 0 on success, 1 on missing env or DB failure.
 *
 * Authority:
 *   docs/architecture/ARCHITECTURE_GATE_A0.md (commit a87eb05)
 *   docs/contracts/signal-truth-v0.1.md
 *   docs/sprint2-pr1-behavioural-features-v0.2-planning.md (Helen-approved)
 *   docs/sprint2-pr2-refresh-loop-server-derivation-planning.md (Helen-approved D-1..D-7)
 *
 * NOT Track A. NOT Core AMS. NO scoring. Factual aggregates only.
 */

import 'dotenv/config';
import pg from 'pg';

export const DEFAULT_FEATURE_VERSION = 'behavioural-features-v0.3';
export const DEFAULT_SINCE_HOURS = 168;

/**
 * Expected total feature count tracked in feature_presence_map +
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
 * For rows with feature_version='behavioural-features-v0.2', invariant:
 *   valid_feature_count + missing_feature_count = EXPECTED_FEATURE_COUNT_V0_2
 * Verified by docs/sql/verification/08_behavioural_features_invariants.sql.
 */
export const EXPECTED_FEATURE_COUNT_V0_2 = 12;

/**
 * Expected total feature count for the v0.3 feature_version: the 12 v0.2
 * fields PLUS `refresh_loop_candidate` (boolean derived server-side per
 * PR#2 D-2). Total: 13.
 *
 * The 7 supporting refresh-loop diagnostic columns (refresh_loop_count,
 * same_path_repeat_count, same_path_repeat_max_span_ms,
 * same_path_repeat_min_delta_ms, same_path_repeat_median_delta_ms,
 * repeat_pageview_candidate_count, refresh_loop_source) are written to
 * dedicated columns but NOT counted in feature_presence_map /
 * feature_source_map — they are diagnostic byproducts, not first-class
 * features of Stage-1 shape.
 *
 * For rows with feature_version='behavioural-features-v0.3', invariant:
 *   valid_feature_count + missing_feature_count = EXPECTED_FEATURE_COUNT_V0_3
 * Verified by docs/sql/verification/09_refresh_loop_invariants.sql.
 */
export const EXPECTED_FEATURE_COUNT_V0_3 = 13;

/**
 * Server-side refresh-loop / repeated-pageview factual extraction
 * thresholds (Helen-approved D-3). These are EXTRACTION thresholds, NOT
 * scoring thresholds. They define when a same-path page_view run becomes
 * a "candidate streak" — a factual marker that downstream scoring (PR#5
 * Stage 0 / PR#6 Stage 1) may consume as one of many inputs.
 *
 * Algorithm summary (D-3, locked):
 *   - Same-path run: maximal consecutive sequence of page_view events
 *     in a session that share raw->>'page_path'. Path change starts a
 *     new run. Defined regardless of timing or interleaved actions.
 *   - Candidate streak: a same-path run that satisfies ALL three:
 *       1. run_length >= REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS (N=3)
 *       2. run_span_ms <= REFRESH_LOOP_MAX_SPAN_MS (W=10000)
 *       3. max actions between adjacent same-path page_views in the run
 *          <= REFRESH_LOOP_MAX_ACTIONS_BETWEEN (K=1)
 *     Action events: cta_click | form_start | form_submit.
 *   - refresh_loop_candidate = (refresh_loop_count > 0).
 *   - same_path_repeat_median_delta_ms: median of ALL eligible adjacent
 *     same-path page_view deltas pooled per session — NOT median of
 *     per-run medians.
 *
 * SDK hint policy (D-4 Option α): SDK refresh-loop hints are IGNORED.
 * No comparison, no trust scoring, no `sdk_hint_present_not_trusted`
 * field. PR#2 derives server-side from accepted_events only.
 */
export const REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS = 3;
export const REFRESH_LOOP_MAX_SPAN_MS = 10000;
export const REFRESH_LOOP_MAX_ACTIONS_BETWEEN = 1;

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
  console.error(`Sprint 2 PR#1+PR#2 behavioural-features extractor — ${msg}`);
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
 * Stage I (PR#2 — refresh-loop server-side derivation):
 *           → page_view_seq      — ordered PVs with LAG(received_at, page_path)
 *           → pv_with_actions    — count of action events between adjacent PVs
 *           → run_assigned       — same-path run grouping (path change = new run)
 *           → run_aggs           — per-run length, span, min delta, max-actions-between
 *           → candidate_streaks  — runs satisfying N + W + K thresholds (D-3)
 *           → same_path_deltas_pooled — eligible adjacent same-path deltas pooled per session
 *           → refresh_loop_median — PERCENTILE_CONT(0.5) over the pool (NOT median of medians)
 *           → refresh_loop_aggs  — per-session refresh-loop aggregates
 * Stage J: INSERT … ON CONFLICT — upsert into session_behavioural_features_v0_2
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
-- ---------------------------------------------------------------------------
-- PR#2 refresh-loop / repeated-pageview server-side derivation (D-1..D-7).
--
-- Reads accepted_events ONLY (via session_events). SDK refresh-loop hints
-- are NEVER read, trusted, compared, or emitted (D-4 Option alpha). The
-- output is a factual marker; no scoring, no judgement, no label.
--
-- Thresholds (passed as $6/$7/$8 — sourced from
--   REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS / _MAX_SPAN_MS / _MAX_ACTIONS_BETWEEN):
--   N (min consecutive page_views per run)              = $6
--   W (max run span in ms)                              = $7
--   K (max action events between adjacent same-path PVs) = $8
-- ---------------------------------------------------------------------------
page_view_seq AS (
  SELECT
    workspace_id, site_id, session_id, event_id, received_at, page_path,
    LAG(received_at) OVER w AS prev_pv_received_at,
    LAG(page_path)   OVER w AS prev_pv_page_path,
    LAG(event_id)    OVER w AS prev_pv_event_id
  FROM session_events
  WHERE event_name = 'page_view'
  WINDOW w AS (
    PARTITION BY workspace_id, site_id, session_id
    ORDER BY received_at ASC, event_id ASC
  )
),
pv_with_actions AS (
  -- For each page_view (after the session's first PV) count the action
  -- events (cta_click | form_start | form_submit) that fall in the OPEN
  -- interval (prev_pv, current_pv) under the SAME deterministic ordering
  -- the rest of the pipeline uses: (received_at ASC, event_id ASC).
  --
  -- Codex BLOCKER fix: timestamp-only bounds mis-classify actions that
  -- share a received_at with a page_view. The full tuple boundary is:
  --   prev_pv < action: action.received_at > prev.received_at
  --                     OR (action.received_at = prev.received_at
  --                         AND action.event_id > prev.event_id)
  --   action < curr_pv: action.received_at < curr.received_at
  --                     OR (action.received_at = curr.received_at
  --                         AND action.event_id < curr.event_id)
  -- For the session's first PV (prev_pv_received_at IS NULL) both halves
  -- short-circuit to NULL → no rows match → COUNT = 0 via COALESCE.
  SELECT
    pv.workspace_id, pv.site_id, pv.session_id, pv.event_id,
    pv.received_at, pv.page_path,
    pv.prev_pv_received_at, pv.prev_pv_page_path, pv.prev_pv_event_id,
    COALESCE((
      SELECT COUNT(*)::int
        FROM session_events se
       WHERE se.workspace_id = pv.workspace_id
         AND se.site_id      = pv.site_id
         AND se.session_id   = pv.session_id
         AND se.event_name IN ('cta_click', 'form_start', 'form_submit')
         AND (
              se.received_at > pv.prev_pv_received_at
           OR (
                se.received_at = pv.prev_pv_received_at
                AND se.event_id > pv.prev_pv_event_id
              )
         )
         AND (
              se.received_at < pv.received_at
           OR (
                se.received_at = pv.received_at
                AND se.event_id < pv.event_id
              )
         )
    ), 0) AS actions_since_prev_pv
  FROM page_view_seq pv
),
run_breaks AS (
  -- A page_view starts a NEW same-path run iff it is the session's first
  -- page_view OR its page_path differs from the immediately-prior PV's
  -- path. K is NOT a run-break — it is a per-run candidate filter only.
  SELECT *,
    CASE
      WHEN prev_pv_received_at IS NULL                  THEN 1
      WHEN prev_pv_page_path IS DISTINCT FROM page_path THEN 1
      ELSE 0
    END AS is_run_break
  FROM pv_with_actions
),
run_assigned AS (
  SELECT *,
    SUM(is_run_break) OVER (
      PARTITION BY workspace_id, site_id, session_id
      ORDER BY received_at ASC, event_id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS run_id
  FROM run_breaks
),
run_aggs AS (
  -- Per-run aggregates. page_path is constant within a run.
  --   run_length              : number of PVs in the run (>=1).
  --   run_span_ms             : MAX(received_at) - MIN(received_at).
  --   run_min_delta_ms        : min adjacent same-path delta within run
  --                              (NULL for length-1 runs).
  --   run_max_actions_between : MAX(actions_since_prev_pv) across the
  --                              run's adjacent same-path PV pairs
  --                              (NULL for length-1 runs).
  SELECT workspace_id, site_id, session_id, run_id, page_path,
    COUNT(*)::int                                                              AS run_length,
    MIN(received_at)                                                           AS run_start,
    MAX(received_at)                                                           AS run_end,
    (EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at))) * 1000)::bigint  AS run_span_ms,
    MIN(
      CASE
        WHEN is_run_break = 0 AND prev_pv_received_at IS NOT NULL
          THEN (EXTRACT(EPOCH FROM (received_at - prev_pv_received_at)) * 1000)::bigint
        ELSE NULL
      END
    )                                                                          AS run_min_delta_ms,
    MAX(CASE WHEN is_run_break = 0 THEN actions_since_prev_pv ELSE NULL END)::int
                                                                               AS run_max_actions_between
  FROM run_assigned
  GROUP BY workspace_id, site_id, session_id, run_id, page_path
),
candidate_streaks AS (
  -- Candidate streak per D-3:
  --   run_length              >= N ($6)
  --   run_span_ms             <= W ($7)
  --   max actions between PVs <= K ($8)
  -- Length-1 runs cannot satisfy N>=3 so are excluded; their NULL
  -- run_max_actions_between is irrelevant.
  SELECT *
    FROM run_aggs
   WHERE run_length  >= $6::int
     AND run_span_ms <= $7::bigint
     AND COALESCE(run_max_actions_between, 0) <= $8::int
),
same_path_deltas_pooled AS (
  -- ALL eligible adjacent same-path PV deltas, pooled per session,
  -- regardless of W or K. Median is computed over THIS pool — NOT a
  -- median of per-run medians.
  SELECT workspace_id, site_id, session_id,
    (EXTRACT(EPOCH FROM (received_at - prev_pv_received_at)) * 1000)::numeric AS delta_ms
  FROM page_view_seq
  WHERE prev_pv_received_at IS NOT NULL
    AND prev_pv_page_path   = page_path
),
refresh_loop_median AS (
  SELECT workspace_id, site_id, session_id,
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta_ms))::bigint
      AS same_path_repeat_median_delta_ms
  FROM same_path_deltas_pooled
  GROUP BY workspace_id, site_id, session_id
),
refresh_loop_aggs AS (
  SELECT ra.workspace_id, ra.site_id, ra.session_id,
    (COUNT(*) FILTER (WHERE cs.run_id IS NOT NULL))::int                  AS refresh_loop_count,
    MAX(ra.run_length)::int                                               AS same_path_repeat_count,
    MAX(ra.run_span_ms)::bigint                                           AS same_path_repeat_max_span_ms,
    MIN(ra.run_min_delta_ms)::bigint                                      AS same_path_repeat_min_delta_ms,
    SUM(CASE WHEN cs.run_id IS NOT NULL THEN cs.run_length ELSE 0 END)::int
                                                                          AS repeat_pageview_candidate_count
  FROM run_aggs ra
  LEFT JOIN candidate_streaks cs USING (workspace_id, site_id, session_id, run_id)
  GROUP BY ra.workspace_id, ra.site_id, ra.session_id
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
    NULL::text AS scroll_depth_bucket_before_first_cta,

    -- PR#2 refresh-loop / repeated-pageview factual columns.
    -- COALESCE to deterministic FALSE/0 for sessions with no
    -- page_views (refresh_loop_aggs has no row for them).
    -- refresh_loop_candidate is a FACT, never a judgement.
    (COALESCE(rla.refresh_loop_count, 0) > 0)                                AS refresh_loop_candidate,
    COALESCE(rla.refresh_loop_count, 0)::int                                 AS refresh_loop_count,
    COALESCE(rla.same_path_repeat_count, 0)::int                             AS same_path_repeat_count,
    rla.same_path_repeat_max_span_ms                                         AS same_path_repeat_max_span_ms,
    rla.same_path_repeat_min_delta_ms                                        AS same_path_repeat_min_delta_ms,
    rlm.same_path_repeat_median_delta_ms                                     AS same_path_repeat_median_delta_ms,
    COALESCE(rla.repeat_pageview_candidate_count, 0)::int                    AS repeat_pageview_candidate_count,
    'server_derived'::text                                                   AS refresh_loop_source

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
  LEFT JOIN refresh_loop_aggs     rla USING (workspace_id, site_id, session_id)
  LEFT JOIN refresh_loop_median   rlm USING (workspace_id, site_id, session_id)
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
    'not_extractable'::text AS p_scroll_depth,
    -- refresh_loop_candidate is BOOLEAN and is COALESCE'd to FALSE upstream,
    -- so it is deterministically 'present' for v0.3 rows. Only emitted
    -- into feature_presence_map / feature_source_map when feature_version
    -- = 'behavioural-features-v0.3'; the v0.2 maps remain 12-key.
    'present'::text AS p_refresh_loop_candidate
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
  refresh_loop_candidate,
  refresh_loop_count,
  same_path_repeat_count,
  same_path_repeat_max_span_ms,
  same_path_repeat_min_delta_ms,
  same_path_repeat_median_delta_ms,
  repeat_pageview_candidate_count,
  refresh_loop_source,
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
  pl.refresh_loop_candidate,
  pl.refresh_loop_count,
  pl.same_path_repeat_count,
  pl.same_path_repeat_max_span_ms,
  pl.same_path_repeat_min_delta_ms,
  pl.same_path_repeat_median_delta_ms,
  pl.repeat_pageview_candidate_count,
  pl.refresh_loop_source,
  -- valid_feature_count: count of 'present' labels.
  --   v0.2 → 12 labels. v0.3 → 13 labels (adds refresh_loop_candidate).
  --   refresh_loop_candidate is boolean and never NULL, so its presence
  --   label is deterministically 'present' for v0.3 rows.
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
  + (CASE WHEN $5::text = 'behavioural-features-v0.3'
              AND pl.p_refresh_loop_candidate   = 'present' THEN 1 ELSE 0 END)
  )::int AS valid_feature_count,
  -- missing_feature_count: total expected - valid.
  --   Total expected = 13 for v0.3, 12 otherwise.
  (
    (CASE WHEN $5::text = 'behavioural-features-v0.3' THEN 13 ELSE 12 END)
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
  - (CASE WHEN $5::text = 'behavioural-features-v0.3'
              AND pl.p_refresh_loop_candidate   = 'present' THEN 1 ELSE 0 END)
  )::int AS missing_feature_count,
  -- feature_presence_map: 12-key for v0.2, 13-key for v0.3 (adds
  -- refresh_loop_candidate). Old v0.2 rows in DB remain 12-key.
  CASE
    WHEN $5::text = 'behavioural-features-v0.3' THEN
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
        'scroll_depth_bucket_before_first_cta',        pl.p_scroll_depth,
        'refresh_loop_candidate',                      pl.p_refresh_loop_candidate
      )
    ELSE
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
      )
  END AS feature_presence_map,
  -- feature_source_map: per-field derivation source label.
  -- 'server_derived' for accepted_events-derived fields.
  -- 'not_extractable' for scroll_depth (SDK does not emit scroll in v1).
  -- For v0.3, refresh_loop_candidate is 'server_derived' — derived from
  -- accepted_events only, SDK hints ignored (D-4 Option alpha).
  CASE
    WHEN $5::text = 'behavioural-features-v0.3' THEN
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
        'scroll_depth_bucket_before_first_cta',        'not_extractable',
        'refresh_loop_candidate',                      'server_derived'
      )
    ELSE
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
      )
  END AS feature_source_map
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
  refresh_loop_candidate                    = EXCLUDED.refresh_loop_candidate,
  refresh_loop_count                        = EXCLUDED.refresh_loop_count,
  same_path_repeat_count                    = EXCLUDED.same_path_repeat_count,
  same_path_repeat_max_span_ms              = EXCLUDED.same_path_repeat_max_span_ms,
  same_path_repeat_min_delta_ms             = EXCLUDED.same_path_repeat_min_delta_ms,
  same_path_repeat_median_delta_ms          = EXCLUDED.same_path_repeat_median_delta_ms,
  repeat_pageview_candidate_count           = EXCLUDED.repeat_pageview_candidate_count,
  refresh_loop_source                       = EXCLUDED.refresh_loop_source,
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
    // PR#2 refresh-loop factual extraction thresholds (D-3). Passed as
    // query params so the constants live in one place (this file) and
    // the SQL string stays static for diffing / log inspection.
    REFRESH_LOOP_MIN_CONSECUTIVE_PAGE_VIEWS,
    REFRESH_LOOP_MAX_SPAN_MS,
    REFRESH_LOOP_MAX_ACTIONS_BETWEEN,
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
      'Sprint 2 PR#1+PR#2 behavioural-features extractor —DB connection failed:',
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
      'Sprint 2 PR#1+PR#2 behavioural-features extractor —extraction failed:',
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
        'Sprint 2 PR#1+PR#2 behavioural-features extractor —fatal:',
        (err as Error).message,
      );
      process.exit(1);
    });
}
