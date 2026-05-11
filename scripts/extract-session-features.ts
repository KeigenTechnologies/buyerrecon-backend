#!/usr/bin/env tsx
/**
 * Sprint 1 PR#11 — session_features extractor (Track B, downstream factual layer).
 *
 * Reads accepted_events. Writes / upserts session_features. NEVER writes to
 * accepted_events, rejected_events, ingest_requests, or site_write_tokens.
 * NEVER reads token_hash, peppers, or any auth secret.
 *
 * Candidate-window vs full-session aggregation (CRITICAL):
 *   - The window (SINCE_HOURS, default 168) selects CANDIDATE SESSIONS — i.e.
 *     sessions with at least one accepted_event whose received_at falls in
 *     the window.
 *   - Then aggregation runs over ALL accepted_events for those candidate
 *     sessions, regardless of received_at. This prevents a narrow later run
 *     from overwriting full session facts with partial-window facts.
 *
 * Idempotent upsert:
 *   ON CONFLICT (workspace_id, site_id, session_id, extraction_version)
 *   DO UPDATE — re-runs refresh the same row; session_features_id is stable.
 *
 * Filters (locked PR#11 contract):
 *   - event_contract_version = 'event-contract-v0.1'  (v1 only; legacy excluded)
 *   - event_origin           = 'browser'              (visitor sessions only)
 *   - workspace_id IS NOT NULL AND site_id IS NOT NULL
 *   - session_id   IS NOT NULL AND session_id <> '__server__'
 *
 * Inputs (env vars):
 *   DATABASE_URL       — collector Postgres URL (REQUIRED; never printed)
 *   WORKSPACE_ID       — optional filter
 *   SITE_ID            — optional filter
 *   SINCE_HOURS        — candidate window in hours (default 168)
 *   SINCE              — optional ISO timestamp; overrides SINCE_HOURS lower bound
 *   UNTIL              — optional ISO timestamp; overrides upper bound (default NOW)
 *   EXTRACTION_VERSION — default 'session-features-v0.1'
 *
 * Exits 0 on success, 1 on missing env or DB failure.
 *
 * NOT Track A. NOT Core AMS. NO scoring / classification / bot / AI-agent /
 * risk / buyer / intent / human / lead-quality / CRM / company / IP enrichment
 * identifiers. NO judgement. Factual aggregates only.
 */

import 'dotenv/config';
import pg from 'pg';

const DEFAULT_EXTRACTION_VERSION = 'session-features-v0.1';
const DEFAULT_SINCE_HOURS = 168;

/* --------------------------------------------------------------------------
 * Env + arg parsing
 * ------------------------------------------------------------------------ */

export interface ExtractorOptions {
  workspace_id: string | null;
  site_id: string | null;
  window_start: Date;
  window_end: Date;
  extraction_version: string;
}

function fail(msg: string): never {
  console.error(`PR#11 session-features extractor — ${msg}`);
  process.exit(1);
}

export function parseOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): ExtractorOptions {
  const workspace_id = typeof env.WORKSPACE_ID === 'string' && env.WORKSPACE_ID.length > 0
    ? env.WORKSPACE_ID
    : null;
  const site_id = typeof env.SITE_ID === 'string' && env.SITE_ID.length > 0
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

  const extraction_version =
    typeof env.EXTRACTION_VERSION === 'string' && env.EXTRACTION_VERSION.length > 0
      ? env.EXTRACTION_VERSION
      : DEFAULT_EXTRACTION_VERSION;

  return { workspace_id, site_id, window_start, window_end, extraction_version };
}

/* --------------------------------------------------------------------------
 * SQL — single idempotent INSERT … ON CONFLICT DO UPDATE pipeline
 *
 * Stage A: candidate_sessions — sessions touched in the window
 * Stage B: session_events     — ALL v1 browser events for those sessions
 *                                (full-session aggregation, NOT window-bounded)
 * Stage C: ranked / endpoints — first/last event by received_at, tie-break event_id
 * Stage D: per-key count CTEs — event_name / schema_key / consent_source
 * Stage E: session_aggs       — counts, distinct paths, canonical_key min/max
 * Stage F: INSERT … ON CONFLICT — upsert into session_features
 * ------------------------------------------------------------------------ */

export const EXTRACTION_SQL = `
WITH candidate_sessions AS (
  SELECT DISTINCT workspace_id, site_id, session_id
    FROM accepted_events
   WHERE received_at >= $1
     AND received_at <= $2
     AND ($3::text IS NULL OR workspace_id = $3)
     AND ($4::text IS NULL OR site_id      = $4)
     AND event_contract_version = 'event-contract-v0.1'
     AND event_origin = 'browser'
     AND workspace_id IS NOT NULL
     AND site_id      IS NOT NULL
     AND session_id   IS NOT NULL
     AND session_id  <> '__server__'
),
session_events AS (
  SELECT ae.event_id,
         ae.workspace_id,
         ae.site_id,
         ae.session_id,
         ae.received_at,
         ae.raw,
         ae.consent_source,
         ae.schema_key,
         ae.canonical_jsonb,
         CASE
           WHEN ae.canonical_jsonb IS NULL THEN NULL
           ELSE (SELECT COUNT(*)::int FROM jsonb_object_keys(ae.canonical_jsonb))
         END AS canonical_key_count
    FROM accepted_events ae
    JOIN candidate_sessions cs
      ON ae.workspace_id = cs.workspace_id
     AND ae.site_id      = cs.site_id
     AND ae.session_id   = cs.session_id
   WHERE ae.event_contract_version = 'event-contract-v0.1'
     AND ae.event_origin = 'browser'
     AND ae.session_id  <> '__server__'
),
ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, site_id, session_id
           ORDER BY received_at ASC,  event_id ASC
         ) AS rn_first,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, site_id, session_id
           ORDER BY received_at DESC, event_id DESC
         ) AS rn_last
    FROM session_events
),
endpoints AS (
  SELECT workspace_id, site_id, session_id,
         MAX(CASE WHEN rn_first = 1 THEN received_at      END) AS first_seen_at,
         MAX(CASE WHEN rn_last  = 1 THEN received_at      END) AS last_seen_at,
         MAX(CASE WHEN rn_first = 1 THEN event_id         END) AS first_event_id,
         MAX(CASE WHEN rn_last  = 1 THEN event_id         END) AS last_event_id,
         MAX(CASE WHEN rn_first = 1 THEN raw->>'page_url'  END) AS landing_page_url,
         MAX(CASE WHEN rn_first = 1 THEN raw->>'page_path' END) AS landing_page_path,
         MAX(CASE WHEN rn_last  = 1 THEN raw->>'page_url'  END) AS last_page_url,
         MAX(CASE WHEN rn_last  = 1 THEN raw->>'page_path' END) AS last_page_path
    FROM ranked
   GROUP BY workspace_id, site_id, session_id
),
event_name_per AS (
  SELECT workspace_id, site_id, session_id,
         raw->>'event_name' AS event_name,
         COUNT(*)::int      AS cnt
    FROM session_events
   WHERE raw->>'event_name' IS NOT NULL
   GROUP BY workspace_id, site_id, session_id, raw->>'event_name'
),
event_name_counts AS (
  SELECT workspace_id, site_id, session_id,
         jsonb_object_agg(event_name, cnt) AS counts
    FROM event_name_per
   GROUP BY workspace_id, site_id, session_id
),
schema_key_per AS (
  SELECT workspace_id, site_id, session_id,
         schema_key,
         COUNT(*)::int AS cnt
    FROM session_events
   WHERE schema_key IS NOT NULL
   GROUP BY workspace_id, site_id, session_id, schema_key
),
schema_key_counts AS (
  SELECT workspace_id, site_id, session_id,
         jsonb_object_agg(schema_key, cnt) AS counts
    FROM schema_key_per
   GROUP BY workspace_id, site_id, session_id
),
consent_source_per AS (
  SELECT workspace_id, site_id, session_id,
         COALESCE(consent_source, raw->>'consent_source') AS cs,
         COUNT(*)::int                                    AS cnt
    FROM session_events
   WHERE COALESCE(consent_source, raw->>'consent_source') IS NOT NULL
   GROUP BY workspace_id, site_id, session_id,
            COALESCE(consent_source, raw->>'consent_source')
),
consent_source_counts AS (
  SELECT workspace_id, site_id, session_id,
         jsonb_object_agg(cs, cnt) AS counts
    FROM consent_source_per
   GROUP BY workspace_id, site_id, session_id
),
session_aggs AS (
  SELECT
    workspace_id, site_id, session_id,
    COUNT(*)::int                                                            AS source_event_count,
    (COUNT(*) FILTER (WHERE raw->>'event_name' = 'page_view'))::int          AS page_view_count,
    (COUNT(*) FILTER (WHERE raw->>'event_name' = 'cta_click'))::int          AS cta_click_count,
    (COUNT(*) FILTER (WHERE raw->>'event_name' = 'form_start'))::int         AS form_start_count,
    (COUNT(*) FILTER (WHERE raw->>'event_name' = 'form_submit'))::int        AS form_submit_count,
    (COUNT(DISTINCT raw->>'page_path')
       FILTER (WHERE raw->>'page_path' IS NOT NULL))::int                    AS unique_path_count,
    MIN(event_id)::bigint                                                    AS source_event_id_min,
    MAX(event_id)::bigint                                                    AS source_event_id_max,
    MIN(canonical_key_count)::int                                            AS canonical_key_count_min,
    MAX(canonical_key_count)::int                                            AS canonical_key_count_max
  FROM session_events
  GROUP BY workspace_id, site_id, session_id
)
INSERT INTO session_features (
  workspace_id, site_id, session_id, extraction_version, extracted_at,
  first_seen_at, last_seen_at, session_duration_ms,
  source_event_id_min, source_event_id_max, first_event_id, last_event_id,
  source_event_count,
  page_view_count, cta_click_count, form_start_count, form_submit_count,
  unique_path_count,
  landing_page_url, landing_page_path, last_page_url, last_page_path,
  has_cta_click, has_form_start, has_form_submit,
  event_name_counts, schema_key_counts, consent_source_counts,
  canonical_key_count_min, canonical_key_count_max
)
SELECT
  sa.workspace_id, sa.site_id, sa.session_id,
  $5::text                                                                   AS extraction_version,
  NOW()                                                                      AS extracted_at,
  ep.first_seen_at,
  ep.last_seen_at,
  (EXTRACT(EPOCH FROM (ep.last_seen_at - ep.first_seen_at)) * 1000)::bigint  AS session_duration_ms,
  sa.source_event_id_min, sa.source_event_id_max,
  ep.first_event_id,      ep.last_event_id,
  sa.source_event_count,
  sa.page_view_count, sa.cta_click_count, sa.form_start_count, sa.form_submit_count,
  sa.unique_path_count,
  ep.landing_page_url, ep.landing_page_path,
  ep.last_page_url,    ep.last_page_path,
  (sa.cta_click_count   > 0) AS has_cta_click,
  (sa.form_start_count  > 0) AS has_form_start,
  (sa.form_submit_count > 0) AS has_form_submit,
  COALESCE(enc.counts, '{}'::jsonb) AS event_name_counts,
  COALESCE(skc.counts, '{}'::jsonb) AS schema_key_counts,
  COALESCE(csc.counts, '{}'::jsonb) AS consent_source_counts,
  sa.canonical_key_count_min,
  sa.canonical_key_count_max
FROM session_aggs sa
JOIN endpoints ep
  ON ep.workspace_id = sa.workspace_id
 AND ep.site_id      = sa.site_id
 AND ep.session_id   = sa.session_id
LEFT JOIN event_name_counts enc
  ON enc.workspace_id = sa.workspace_id
 AND enc.site_id      = sa.site_id
 AND enc.session_id   = sa.session_id
LEFT JOIN schema_key_counts skc
  ON skc.workspace_id = sa.workspace_id
 AND skc.site_id      = sa.site_id
 AND skc.session_id   = sa.session_id
LEFT JOIN consent_source_counts csc
  ON csc.workspace_id = sa.workspace_id
 AND csc.site_id      = sa.site_id
 AND csc.session_id   = sa.session_id
ON CONFLICT (workspace_id, site_id, session_id, extraction_version)
DO UPDATE SET
  extracted_at            = EXCLUDED.extracted_at,
  first_seen_at           = EXCLUDED.first_seen_at,
  last_seen_at            = EXCLUDED.last_seen_at,
  session_duration_ms     = EXCLUDED.session_duration_ms,
  source_event_id_min     = EXCLUDED.source_event_id_min,
  source_event_id_max     = EXCLUDED.source_event_id_max,
  first_event_id          = EXCLUDED.first_event_id,
  last_event_id           = EXCLUDED.last_event_id,
  source_event_count      = EXCLUDED.source_event_count,
  page_view_count         = EXCLUDED.page_view_count,
  cta_click_count         = EXCLUDED.cta_click_count,
  form_start_count        = EXCLUDED.form_start_count,
  form_submit_count       = EXCLUDED.form_submit_count,
  unique_path_count       = EXCLUDED.unique_path_count,
  landing_page_url        = EXCLUDED.landing_page_url,
  landing_page_path       = EXCLUDED.landing_page_path,
  last_page_url           = EXCLUDED.last_page_url,
  last_page_path          = EXCLUDED.last_page_path,
  has_cta_click           = EXCLUDED.has_cta_click,
  has_form_start          = EXCLUDED.has_form_start,
  has_form_submit         = EXCLUDED.has_form_submit,
  event_name_counts       = EXCLUDED.event_name_counts,
  schema_key_counts       = EXCLUDED.schema_key_counts,
  consent_source_counts   = EXCLUDED.consent_source_counts,
  canonical_key_count_min = EXCLUDED.canonical_key_count_min,
  canonical_key_count_max = EXCLUDED.canonical_key_count_max
RETURNING session_features_id, workspace_id, site_id, session_id
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
    opts.extraction_version,
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
    console.error('PR#11 session-features extractor — DB connection failed:', (err as Error).message);
    return 1;
  }

  try {
    const result = await runExtraction(client, opts);

    const lines: string[] = [];
    lines.push('# Session-features extraction summary');
    lines.push('');
    lines.push(`- extraction_version: ${opts.extraction_version}`);
    lines.push(`- workspace_id filter: ${opts.workspace_id ?? '(none)'}`);
    lines.push(`- site_id filter:      ${opts.site_id ?? '(none)'}`);
    lines.push(`- candidate window:    ${opts.window_start.toISOString()} → ${opts.window_end.toISOString()}`);
    lines.push(`- database_url:        ${maskUrl(databaseUrl as string)}`);
    lines.push(`- rows upserted:       ${result.upserted_rows}`);
    lines.push('');
    process.stdout.write(lines.join('\n'));
    if (!lines[lines.length - 1].endsWith('\n')) process.stdout.write('\n');
    return 0;
  } catch (err) {
    console.error('PR#11 session-features extractor — extraction failed:', (err as Error).message);
    return 1;
  } finally {
    await client.end();
  }
}

// Only run main() when invoked as a script. The exports above are consumed
// by tests/v1/session-features-extraction.test.ts without triggering the
// runner.
const invokedAsScript =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;

if (invokedAsScript) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('PR#11 session-features extractor — fatal:', (err as Error).message);
      process.exit(1);
    });
}
