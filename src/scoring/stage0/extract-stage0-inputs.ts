/**
 * Sprint 2 PR#5 — extract Stage0Input rows from accepted_events +
 * ingest_requests (via request_id correlation).
 *
 * Inputs (read-only):
 *   - accepted_events  (PR#10 ledger)
 *   - ingest_requests  (PR#10; for user_agent → family normalisation)
 *
 * NOT read by PR#5 (per OD-4 + OD-12):
 *   - session_features
 *   - session_behavioural_features_v0_2
 *   - scoring_output_lane_a / lane_b
 *   - rejected_events
 *   - token_hash, ip_hash, peppers
 *
 * Privacy boundary (OD-11):
 *   - The raw `ingest_requests.user_agent` is read transiently by the
 *     extractor in worker memory only. It is normalised into a family
 *     label via a coarse, deterministic, in-memory map (no external
 *     calls). The raw UA is NEVER returned in the Stage0Input.
 *   - The PostgreSQL query also returns the raw UA string so the
 *     in-process JS can normalise it; the caller MUST discard the raw
 *     field after building the Stage0Input.
 */

import type pg from 'pg';
import type { Stage0Input } from './types.js';

/* --------------------------------------------------------------------------
 * Coarse UA → family normalisation (in-memory; no external calls).
 *
 * This is a deliberately small table. The vendored Stage 0 lib's
 * `KNOWN_BOT_UA_FAMILIES` is the *target* set of family labels; the
 * mapping below is the BuyerRecon-side approximation that maps the
 * raw HTTP `User-Agent` string into one of those labels.
 *
 * Labels NOT in `KNOWN_BOT_UA_FAMILIES`:
 *   - 'browser' — catch-all for ordinary browsers (no match).
 * Labels in `KNOWN_AI_CRAWLER_UA_FAMILIES` (adapter-side carve-out):
 *   - 'bytespider', 'gptbot', 'claudebot', 'perplexity-user',
 *     'perplexitybot', 'ccbot', 'googlebot', 'bingbot',
 *     'duckduckbot', 'petalbot'. These are accepted as families but
 *     the adapter remaps them to null before evaluation.
 *
 * The matching is case-insensitive substring with a *fixed* token
 * list. We do not attempt a comprehensive UA parser (heavy + brittle);
 * Stage 0 needs only the highest-confidence labels and the rest pass
 * through as 'browser'.
 * ------------------------------------------------------------------------ */

interface UaFamilyRule {
  family: string;
  token:  string;  // case-insensitive substring; first match wins
}

const UA_FAMILY_RULES: readonly UaFamilyRule[] = [
  // Declared AI / search crawlers (P-11 — adapter carves these out)
  { family: 'gptbot',          token: 'gptbot' },
  { family: 'claudebot',       token: 'claudebot' },
  { family: 'perplexity-user', token: 'perplexity-user' },
  { family: 'perplexitybot',   token: 'perplexitybot' },
  { family: 'ccbot',           token: 'ccbot' },
  { family: 'googlebot',       token: 'googlebot' },
  { family: 'bingbot',         token: 'bingbot' },
  { family: 'duckduckbot',     token: 'duckduckbot' },
  { family: 'petalbot',        token: 'petalbot' },
  { family: 'bytespider',      token: 'bytespider' },
  // Unattributed automation / bad-actor entries (upstream KNOWN_BOT_UA_FAMILIES)
  { family: 'headless_chrome', token: 'headlesschrome' },
  { family: 'headless_chrome', token: 'headless chrome' },
  { family: 'headless_firefox',token: 'headlessfirefox' },
  { family: 'phantomjs',       token: 'phantomjs' },
  { family: 'curl',            token: 'curl/' },
  { family: 'wget',            token: 'wget/' },
  { family: 'python_requests', token: 'python-requests' },
  { family: 'go_http_client',  token: 'go-http-client' },
  { family: 'java_http_client',token: 'java/' },
  { family: 'libwww_perl',     token: 'libwww-perl' },
  // Other known crawlers
  { family: 'semrushbot',      token: 'semrushbot' },
  { family: 'ahrefsbot',       token: 'ahrefsbot' },
  { family: 'mj12bot',         token: 'mj12bot' },
  { family: 'dotbot',          token: 'dotbot' },
];

/**
 * Normalise a raw User-Agent string into a Stage 0 family label.
 *
 * Returns `null` for browsers / unknown / empty inputs — the upstream
 * `known_bot_ua_family` rule treats `null` as "no signal" and does
 * not fire.
 *
 * IMPORTANT: the raw `ua` parameter is consumed in-memory only. The
 * caller MUST NOT log or persist the raw value.
 */
export function normaliseUserAgentFamily(ua: string | null | undefined): string | null {
  if (typeof ua !== 'string' || ua.length === 0) return null;
  const lower = ua.toLowerCase();
  for (const r of UA_FAMILY_RULES) {
    if (lower.includes(r.token)) return r.family;
  }
  return null;
}

/* --------------------------------------------------------------------------
 * SQL: candidate sessions + per-session aggregates
 *
 * Mirrors the PR#1 / PR#2 candidate-window vs full-session pattern:
 *
 *   - candidate_sessions      sessions touched in the window
 *   - session_events          ALL accepted_events for those sessions
 *                              (full-session aggregation)
 *   - pageview_paths          page_view path list
 *   - eps_max                 max events-per-second
 *   - path_loop               max consecutive same-path page_views
 *   - engagement              cta/form action count
 *   - session_ua              one user_agent (raw) per session via
 *                              request_id correlation against ingest_requests
 *   - aggregates              one row per session
 *
 * Filters (LOCKED — same as PR#1):
 *   - event_contract_version = 'event-contract-v0.1'
 *   - event_origin           = 'browser'
 *   - workspace_id IS NOT NULL AND site_id IS NOT NULL
 *   - session_id   IS NOT NULL AND session_id <> '__server__'
 *
 * Privacy note: `ua_raw` is returned by the query for in-process
 * normalisation. The caller MUST discard it after computing the
 * family label and MUST NOT persist it.
 *
 * Parameters:
 *   $1 window_start
 *   $2 window_end
 *   $3 workspace_id filter (NULL = any)
 *   $4 site_id      filter (NULL = any)
 * ------------------------------------------------------------------------ */

export const EXTRACT_SQL = `
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
         ae.request_id,
         ae.raw->>'event_name' AS event_name,
         ae.raw->>'page_path'  AS page_path
    FROM accepted_events ae
    JOIN candidate_sessions cs USING (workspace_id, site_id, session_id)
   WHERE ae.event_contract_version = 'event-contract-v0.1'
     AND ae.event_origin = 'browser'
     AND ae.session_id  <> '__server__'
),
pageview_ordered AS (
  SELECT workspace_id, site_id, session_id, event_id, received_at, page_path,
         LAG(page_path) OVER w AS prev_pv_page_path
    FROM session_events
   WHERE event_name = 'page_view'
  WINDOW w AS (
    PARTITION BY workspace_id, site_id, session_id
    ORDER BY received_at ASC, event_id ASC
  )
),
pageview_paths AS (
  SELECT workspace_id, site_id, session_id,
         array_agg(page_path ORDER BY received_at ASC, event_id ASC) AS paths_visited
    FROM session_events
   WHERE event_name = 'page_view'
   GROUP BY workspace_id, site_id, session_id
),
events_per_second AS (
  SELECT workspace_id, site_id, session_id,
         date_trunc('second', received_at) AS sec_bucket,
         COUNT(*)::int                       AS cnt
    FROM session_events
   GROUP BY workspace_id, site_id, session_id, date_trunc('second', received_at)
),
eps_max AS (
  SELECT workspace_id, site_id, session_id,
         MAX(cnt)::int AS max_events_per_second
    FROM events_per_second
   GROUP BY workspace_id, site_id, session_id
),
-- Max consecutive same-path page_view run length. Uses the standard
-- "is_break" gap-and-island pattern (path change starts a new run).
runs AS (
  SELECT workspace_id, site_id, session_id,
         page_path,
         CASE
           WHEN prev_pv_page_path IS NULL                  THEN 1
           WHEN prev_pv_page_path IS DISTINCT FROM page_path THEN 1
           ELSE 0
         END AS is_break
    FROM pageview_ordered
),
run_ids AS (
  SELECT workspace_id, site_id, session_id, page_path,
         SUM(is_break) OVER (
           PARTITION BY workspace_id, site_id, session_id
           ORDER BY received_at ASC, event_id ASC
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS run_id
    FROM (
      SELECT workspace_id, site_id, session_id, page_path,
             received_at, event_id,
             CASE
               WHEN prev_pv_page_path IS NULL                  THEN 1
               WHEN prev_pv_page_path IS DISTINCT FROM page_path THEN 1
               ELSE 0
             END AS is_break
        FROM pageview_ordered
    ) pv
),
run_lens AS (
  SELECT workspace_id, site_id, session_id, run_id,
         COUNT(*)::int AS run_length
    FROM run_ids
   GROUP BY workspace_id, site_id, session_id, run_id
),
path_loop AS (
  SELECT workspace_id, site_id, session_id,
         COALESCE(MAX(run_length), 0)::int AS path_loop_count_10m
    FROM run_lens
   GROUP BY workspace_id, site_id, session_id
),
engagement AS (
  SELECT workspace_id, site_id, session_id,
         SUM(CASE WHEN event_name IN ('cta_click','form_start','form_submit') THEN 1 ELSE 0 END)::int
           AS action_count
    FROM session_events
   GROUP BY workspace_id, site_id, session_id
),
session_event_counts AS (
  -- request_id is UUID; aggregator MIN() is not defined on UUID, so we
  -- pick the EARLIEST request_id by event order via an ordered
  -- array_agg + index. The earliest accepted event for a session is
  -- typically the one whose ingest_requests row carries the User-Agent
  -- the SDK first sent for this session.
  SELECT workspace_id, site_id, session_id,
         COUNT(*)::int                                                            AS source_event_count,
         MIN(event_id)::bigint                                                    AS first_event_id,
         MAX(event_id)::bigint                                                    AS last_event_id,
         (ARRAY_AGG(request_id ORDER BY received_at ASC, event_id ASC))[1]        AS any_request_id
    FROM session_events
   GROUP BY workspace_id, site_id, session_id
),
-- One UA per session via request_id correlation. We pick the EARLIEST
-- request whose request_id matches any event in the session.
session_ua AS (
  SELECT sec.workspace_id, sec.site_id, sec.session_id,
         ir.user_agent AS ua_raw
    FROM session_event_counts sec
    LEFT JOIN ingest_requests ir
      ON ir.request_id = sec.any_request_id
)
SELECT
  cs.workspace_id,
  cs.site_id,
  cs.session_id,
  COALESCE(pp.paths_visited, ARRAY[]::text[])     AS paths_visited,
  COALESCE(em.max_events_per_second, 0)::int      AS max_events_per_second_same_browser,
  COALESCE(pl.path_loop_count_10m, 0)::int        AS path_loop_count_10m,
  (COALESCE(en.action_count, 0) = 0)              AS zero_engagement_across_session,
  COALESCE(sec.source_event_count, 0)::int        AS source_event_count,
  sec.first_event_id                              AS first_event_id,
  sec.last_event_id                               AS last_event_id,
  su.ua_raw                                       AS ua_raw
  FROM candidate_sessions      cs
  LEFT JOIN pageview_paths     pp  USING (workspace_id, site_id, session_id)
  LEFT JOIN eps_max            em  USING (workspace_id, site_id, session_id)
  LEFT JOIN path_loop          pl  USING (workspace_id, site_id, session_id)
  LEFT JOIN engagement         en  USING (workspace_id, site_id, session_id)
  LEFT JOIN session_event_counts sec USING (workspace_id, site_id, session_id)
  LEFT JOIN session_ua         su  USING (workspace_id, site_id, session_id)
`;

interface ExtractedRow {
  workspace_id:                       string;
  site_id:                            string;
  session_id:                         string;
  paths_visited:                      string[];
  max_events_per_second_same_browser: number;
  path_loop_count_10m:                number;
  zero_engagement_across_session:     boolean;
  source_event_count:                 number;
  first_event_id:                     string | null;
  last_event_id:                      string | null;
  /** Raw UA — consumed in-process for family normalisation only; NEVER persisted. */
  ua_raw:                             string | null;
}

export interface ExtractOptions {
  workspace_id: string | null;
  site_id:      string | null;
  window_start: Date;
  window_end:   Date;
}

/**
 * Build a Stage0Input per candidate session. Raw UA is converted to
 * a family label in-memory and then dropped.
 */
export async function extractStage0Inputs(
  pool: pg.Pool | pg.PoolClient | pg.Client,
  opts: ExtractOptions,
): Promise<Stage0Input[]> {
  const params: unknown[] = [
    opts.window_start,
    opts.window_end,
    opts.workspace_id,
    opts.site_id,
  ];
  const res = await pool.query<ExtractedRow>(EXTRACT_SQL, params);

  return res.rows.map((r): Stage0Input => {
    // Normalise the raw UA into a family label, then drop the raw.
    const family = normaliseUserAgentFamily(r.ua_raw);
    // We intentionally do NOT pass r.ua_raw further. The whole point
    // of the OD-11 minimization rule is that the raw UA dies here.

    const evidenceRefs: Array<{ table: string; [k: string]: unknown }> = [];
    if (r.first_event_id !== null && r.last_event_id !== null) {
      // Convert BIGINT-as-string (pg) to number when safe; otherwise
      // keep the string form.
      const lo = Number(r.first_event_id);
      const hi = Number(r.last_event_id);
      evidenceRefs.push({
        table:        'accepted_events',
        event_id_min: Number.isFinite(lo) ? lo : r.first_event_id,
        event_id_max: Number.isFinite(hi) ? hi : r.last_event_id,
      });
    }

    return {
      workspaceId:                   r.workspace_id,
      siteId:                        r.site_id,
      sessionId:                     r.session_id,
      userAgentFamily:               family,
      pathsVisited:                  r.paths_visited.filter((p): p is string => typeof p === 'string'),
      maxEventsPerSecondSameBrowser: r.max_events_per_second_same_browser,
      pathLoopCount10m:              r.path_loop_count_10m,
      zeroEngagementAcrossSession:   r.zero_engagement_across_session,
      sourceEventCount:              r.source_event_count,
      evidenceRefs,
    };
  });
}
