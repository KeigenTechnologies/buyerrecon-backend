/**
 * Sprint 1 PR#12 — Session features derived-layer observation helpers
 * (Track B, BuyerRecon Evidence Foundation).
 *
 * This module is the read-only §9b extension of
 * `scripts/collector-observation-report.ts`. It does NOT introduce scoring,
 * classification, bot/AI-agent taxonomy, lead-quality, CRM routing, IP
 * enrichment, company enrichment, or any other Track-A / Core-AMS surface.
 *
 * STRICT READ-ONLY. Every SQL string in this file is `SELECT`-only. There is
 * no `INSERT` / `UPDATE` / `DELETE` / `BEGIN` / `COMMIT` / `TRUNCATE` / `DROP`
 * / `ALTER` / `CREATE`. The module never reads `token_hash`, `ip_hash`,
 * `user_agent`, raw payload bodies, peppers, or any secret material.
 *
 * Window-scoping rule (PR#12):
 *   `session_features` rows are selected by `last_seen_at` inside the
 *   observation window `[windowStart, windowEnd]`. For each selected row, the
 *   `source_event_count` mismatch check compares against the FULL-SESSION
 *   `accepted_events` count for that `(workspace_id, site_id, session_id)`
 *   tuple (no time filter on the join), because session_features stores
 *   full-session aggregates rather than window-scoped subsets.
 *
 * Imported by:
 *   - scripts/collector-observation-report.ts (wires §9b into the report)
 *   - tests/v1/observation-report-pr12.test.ts (pure tests over the helpers)
 */

import type { Client } from 'pg';

/* --------------------------------------------------------------------------
 * Config
 * ------------------------------------------------------------------------ */

export const DEFAULT_SESSION_FEATURES_VERSION = 'session-features-v0.1';
export const DEFAULT_SESSION_FEATURES_MAX_LAG_HOURS = 24;

export interface SessionFeaturesConfig {
  extractionVersion: string;
  maxLagHours: number;
  requireSessionFeatures: boolean;
}

/**
 * Parse the three PR#12 env knobs. None are required; defaults are applied
 * when env values are missing or malformed.
 *
 *   OBS_SESSION_FEATURES_VERSION       default `session-features-v0.1`
 *   OBS_SESSION_FEATURES_MAX_LAG_HOURS default 24 (positive integer)
 *   OBS_REQUIRE_SESSION_FEATURES       true only when env value === 'true'
 */
export function parseSessionFeaturesConfig(
  env: NodeJS.ProcessEnv = process.env,
): SessionFeaturesConfig {
  const versionRaw = env.OBS_SESSION_FEATURES_VERSION;
  const lagRaw = env.OBS_SESSION_FEATURES_MAX_LAG_HOURS;
  const requireRaw = env.OBS_REQUIRE_SESSION_FEATURES;

  const extractionVersion =
    typeof versionRaw === 'string' && versionRaw.length > 0
      ? versionRaw
      : DEFAULT_SESSION_FEATURES_VERSION;

  let maxLagHours = DEFAULT_SESSION_FEATURES_MAX_LAG_HOURS;
  if (typeof lagRaw === 'string' && lagRaw.length > 0) {
    const n = Number.parseInt(lagRaw, 10);
    if (Number.isFinite(n) && n > 0) maxLagHours = n;
  }

  const requireSessionFeatures = requireRaw === 'true';

  return { extractionVersion, maxLagHours, requireSessionFeatures };
}

/* --------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface SessionFeaturesLatestRow {
  session_id: string;
  source_event_count: number;
  page_view_count: number;
  cta_click_count: number;
  form_start_count: number;
  form_submit_count: number;
  unique_path_count: number;
  landing_page_path: string | null;
  last_page_path: string | null;
  canonical_key_count_min: number | null;
  canonical_key_count_max: number | null;
  extracted_at: Date | null;
}

export interface SessionFeaturesHealth {
  tablePresent: boolean;
  extractionVersion: string;

  // Window-scoped summary
  rows: number;
  latestExtractedAt: Date | null;
  firstSeen: Date | null;
  lastSeen: Date | null;
  totalSourceEvents: number;
  totalPageViews: number;
  totalCtaClicks: number;
  totalFormStarts: number;
  totalFormSubmits: number;
  totalUniquePaths: number;
  sessionsWithCta: number;
  sessionsWithFormStart: number;
  sessionsWithFormSubmit: number;
  canonicalKeyCountMin: number | null;
  canonicalKeyCountMax: number | null;

  // Anomaly counts (all should be 0 for a healthy derived layer)
  duplicateNaturalKeyCount: number;
  sourceEventCountMismatchCount: number;
  canonicalKeyAnomalyCount: number;
  hasCtaMismatchCount: number;
  hasFormStartMismatchCount: number;
  hasFormSubmitMismatchCount: number;
  durationAnomalyCount: number;
  jsonbTypeAnomalyCount: number;

  // Freshness signals (boundary-wide, NOT window-scoped)
  latestAcceptedReceivedAt: Date | null;
  latestExtractedAtOverall: Date | null;
  extractionLagHours: number | null;

  topRows: SessionFeaturesLatestRow[];
}

/* --------------------------------------------------------------------------
 * SQL — all SELECT-only, all parameterised on (workspace_id, site_id,
 * extraction_version, window_start, window_end). Exported as constants so the
 * test suite can sweep them for forbidden tokens and DML.
 * ------------------------------------------------------------------------ */

export const SESSION_FEATURES_TABLE_PRESENCE_SQL =
  "SELECT to_regclass('public.session_features') AS regclass";

export const SESSION_FEATURES_SUMMARY_SQL = `
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
WHERE workspace_id       = $1
  AND site_id            = $2
  AND extraction_version = $3
  AND last_seen_at      >= $4::timestamptz
  AND last_seen_at      <= $5::timestamptz
`;

export const SESSION_FEATURES_DUPLICATE_NATURAL_KEY_SQL = `
SELECT COUNT(*)::int AS c FROM (
  SELECT workspace_id, site_id, session_id, extraction_version
    FROM session_features
   WHERE workspace_id       = $1
     AND site_id            = $2
     AND extraction_version = $3
     AND last_seen_at      >= $4::timestamptz
     AND last_seen_at      <= $5::timestamptz
   GROUP BY workspace_id, site_id, session_id, extraction_version
  HAVING COUNT(*) > 1
) dup
`;

export const SESSION_FEATURES_CANONICAL_ANOMALY_SQL = `
SELECT COUNT(*)::int AS c
  FROM session_features
 WHERE workspace_id       = $1
   AND site_id            = $2
   AND extraction_version = $3
   AND last_seen_at      >= $4::timestamptz
   AND last_seen_at      <= $5::timestamptz
   AND canonical_key_count_min IS NOT NULL
   AND (canonical_key_count_min <> 19 OR canonical_key_count_max <> 19)
`;

export const SESSION_FEATURES_HAS_FLAG_MISMATCH_SQL = `
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
WHERE workspace_id       = $1
  AND site_id            = $2
  AND extraction_version = $3
  AND last_seen_at      >= $4::timestamptz
  AND last_seen_at      <= $5::timestamptz
`;

export const SESSION_FEATURES_DURATION_ANOMALY_SQL = `
SELECT COUNT(*)::int AS c
  FROM session_features
 WHERE workspace_id       = $1
   AND site_id            = $2
   AND extraction_version = $3
   AND last_seen_at      >= $4::timestamptz
   AND last_seen_at      <= $5::timestamptz
   AND session_duration_ms <> (EXTRACT(EPOCH FROM (last_seen_at - first_seen_at)) * 1000)::bigint
`;

export const SESSION_FEATURES_JSONB_TYPE_ANOMALY_SQL = `
SELECT COUNT(*)::int AS c
  FROM session_features
 WHERE workspace_id       = $1
   AND site_id            = $2
   AND extraction_version = $3
   AND last_seen_at      >= $4::timestamptz
   AND last_seen_at      <= $5::timestamptz
   AND (jsonb_typeof(event_name_counts)     <> 'object'
     OR jsonb_typeof(schema_key_counts)     <> 'object'
     OR jsonb_typeof(consent_source_counts) <> 'object')
`;

/**
 * PR#12 window-scoping rule.
 *
 * Selects session_features rows by `last_seen_at` ∈ [window_start, window_end]
 * but validates `source_event_count` against the FULL-SESSION accepted_events
 * count (no time filter on the join), because session_features stores
 * full-session aggregates.
 */
export const SESSION_FEATURES_SOURCE_EVENT_MISMATCH_SQL = `
SELECT COUNT(*)::int AS c
  FROM session_features sf
 WHERE sf.workspace_id       = $1
   AND sf.site_id            = $2
   AND sf.extraction_version = $3
   AND sf.last_seen_at      >= $4::timestamptz
   AND sf.last_seen_at      <= $5::timestamptz
   AND sf.source_event_count <> (
     SELECT COUNT(*)::int
       FROM accepted_events ae
      WHERE ae.workspace_id = sf.workspace_id
        AND ae.site_id      = sf.site_id
        AND ae.session_id   = sf.session_id
        AND ae.event_contract_version = 'event-contract-v0.1'
        AND ae.event_origin = 'browser'
        AND ae.session_id  <> '__server__'
   )
`;

/**
 * Boundary-wide freshness query (NOT window-scoped — lag tracks the gap
 * between the most recent collector event and the most recent extractor run).
 */
export const SESSION_FEATURES_FRESHNESS_SQL = `
SELECT
  (SELECT MAX(received_at) FROM accepted_events
    WHERE workspace_id = $1 AND site_id = $2)                          AS latest_accepted,
  (SELECT MAX(extracted_at) FROM session_features
    WHERE workspace_id = $1 AND site_id = $2 AND extraction_version = $3)
                                                                       AS latest_extracted_overall
`;

/**
 * Top-10 latest rows for §9b human inspection. Paths only — no URLs are
 * SELECTed. `session_id` is returned in full from the DB but truncated to
 * 8 chars + ellipsis at render time.
 */
export const SESSION_FEATURES_TOP_ROWS_SQL = `
SELECT session_id,
       source_event_count,
       page_view_count, cta_click_count, form_start_count, form_submit_count,
       unique_path_count,
       landing_page_path, last_page_path,
       canonical_key_count_min, canonical_key_count_max,
       extracted_at
  FROM session_features
 WHERE workspace_id       = $1
   AND site_id            = $2
   AND extraction_version = $3
   AND last_seen_at      >= $4::timestamptz
   AND last_seen_at      <= $5::timestamptz
 ORDER BY last_seen_at DESC, session_id ASC
 LIMIT 10
`;

/* --------------------------------------------------------------------------
 * Loader (read-only)
 * ------------------------------------------------------------------------ */

export interface LoadSessionFeaturesOpts {
  workspaceId: string;
  siteId: string;
  windowStart: Date;
  windowEnd: Date;
  config: SessionFeaturesConfig;
}

type QueryRunner = Pick<Client, 'query'>;

function asInt(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number.parseInt(v, 10);
  if (typeof v === 'bigint') return Number(v);
  return 0;
}

function asIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return asInt(v);
}

function asDateOrNull(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function emptyHealth(extractionVersion: string, tablePresent: boolean): SessionFeaturesHealth {
  return {
    tablePresent,
    extractionVersion,
    rows: 0,
    latestExtractedAt: null,
    firstSeen: null,
    lastSeen: null,
    totalSourceEvents: 0,
    totalPageViews: 0,
    totalCtaClicks: 0,
    totalFormStarts: 0,
    totalFormSubmits: 0,
    totalUniquePaths: 0,
    sessionsWithCta: 0,
    sessionsWithFormStart: 0,
    sessionsWithFormSubmit: 0,
    canonicalKeyCountMin: null,
    canonicalKeyCountMax: null,
    duplicateNaturalKeyCount: 0,
    sourceEventCountMismatchCount: 0,
    canonicalKeyAnomalyCount: 0,
    hasCtaMismatchCount: 0,
    hasFormStartMismatchCount: 0,
    hasFormSubmitMismatchCount: 0,
    durationAnomalyCount: 0,
    jsonbTypeAnomalyCount: 0,
    latestAcceptedReceivedAt: null,
    latestExtractedAtOverall: null,
    extractionLagHours: null,
    topRows: [],
  };
}

function computeLagHours(
  latestAccepted: Date | null,
  latestExtractedOverall: Date | null,
): number | null {
  if (latestAccepted === null || latestExtractedOverall === null) return null;
  const diffMs = latestAccepted.getTime() - latestExtractedOverall.getTime();
  return diffMs / 3_600_000;
}

/**
 * Read-only loader. First checks `to_regclass('public.session_features')`;
 * if the table doesn't exist, returns `{ tablePresent: false }` without
 * raising. If the table exists, runs the §9b aggregate + anomaly queries.
 * Never writes. Never invokes the extractor.
 */
export async function loadSessionFeaturesHealth(
  client: QueryRunner,
  opts: LoadSessionFeaturesOpts,
): Promise<SessionFeaturesHealth> {
  const presence = await client.query(SESSION_FEATURES_TABLE_PRESENCE_SQL);
  const regclassRow = (presence as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  const regclass = regclassRow?.regclass ?? null;
  if (regclass === null) {
    return emptyHealth(opts.config.extractionVersion, false);
  }

  const windowStartIso = opts.windowStart.toISOString();
  const windowEndIso = opts.windowEnd.toISOString();
  const winParams = [
    opts.workspaceId,
    opts.siteId,
    opts.config.extractionVersion,
    windowStartIso,
    windowEndIso,
  ];

  const summary = await client.query(SESSION_FEATURES_SUMMARY_SQL, winParams);
  const duplicate = await client.query(SESSION_FEATURES_DUPLICATE_NATURAL_KEY_SQL, winParams);
  const canonical = await client.query(SESSION_FEATURES_CANONICAL_ANOMALY_SQL, winParams);
  const flags = await client.query(SESSION_FEATURES_HAS_FLAG_MISMATCH_SQL, winParams);
  const duration = await client.query(SESSION_FEATURES_DURATION_ANOMALY_SQL, winParams);
  const jsonb = await client.query(SESSION_FEATURES_JSONB_TYPE_ANOMALY_SQL, winParams);
  const eventMismatch = await client.query(SESSION_FEATURES_SOURCE_EVENT_MISMATCH_SQL, winParams);
  const freshness = await client.query(SESSION_FEATURES_FRESHNESS_SQL, [
    opts.workspaceId,
    opts.siteId,
    opts.config.extractionVersion,
  ]);
  const top = await client.query(SESSION_FEATURES_TOP_ROWS_SQL, winParams);

  const sumRow = (summary as { rows: Array<Record<string, unknown>> }).rows[0] ?? {};
  const dupRow = (duplicate as { rows: Array<Record<string, unknown>> }).rows[0] ?? {};
  const canRow = (canonical as { rows: Array<Record<string, unknown>> }).rows[0] ?? {};
  const flagRow = (flags as { rows: Array<Record<string, unknown>> }).rows[0] ?? {};
  const durRow = (duration as { rows: Array<Record<string, unknown>> }).rows[0] ?? {};
  const jsonbRow = (jsonb as { rows: Array<Record<string, unknown>> }).rows[0] ?? {};
  const evRow = (eventMismatch as { rows: Array<Record<string, unknown>> }).rows[0] ?? {};
  const freshRow = (freshness as { rows: Array<Record<string, unknown>> }).rows[0] ?? {};

  const latestAccepted = asDateOrNull(freshRow.latest_accepted);
  const latestExtractedOverall = asDateOrNull(freshRow.latest_extracted_overall);
  const lag = computeLagHours(latestAccepted, latestExtractedOverall);

  return {
    tablePresent: true,
    extractionVersion: opts.config.extractionVersion,
    rows: asInt(sumRow.rows),
    latestExtractedAt: asDateOrNull(sumRow.latest_extracted_at),
    firstSeen: asDateOrNull(sumRow.first_seen),
    lastSeen: asDateOrNull(sumRow.last_seen),
    totalSourceEvents: asInt(sumRow.total_source_events),
    totalPageViews: asInt(sumRow.total_page_views),
    totalCtaClicks: asInt(sumRow.total_cta_clicks),
    totalFormStarts: asInt(sumRow.total_form_starts),
    totalFormSubmits: asInt(sumRow.total_form_submits),
    totalUniquePaths: asInt(sumRow.total_unique_paths),
    sessionsWithCta: asInt(sumRow.sessions_with_cta),
    sessionsWithFormStart: asInt(sumRow.sessions_with_form_start),
    sessionsWithFormSubmit: asInt(sumRow.sessions_with_form_submit),
    canonicalKeyCountMin: asIntOrNull(sumRow.canonical_min),
    canonicalKeyCountMax: asIntOrNull(sumRow.canonical_max),
    duplicateNaturalKeyCount: asInt(dupRow.c),
    sourceEventCountMismatchCount: asInt(evRow.c),
    canonicalKeyAnomalyCount: asInt(canRow.c),
    hasCtaMismatchCount: asInt(flagRow.cta_mismatch),
    hasFormStartMismatchCount: asInt(flagRow.form_start_mismatch),
    hasFormSubmitMismatchCount: asInt(flagRow.form_submit_mismatch),
    durationAnomalyCount: asInt(durRow.c),
    jsonbTypeAnomalyCount: asInt(jsonbRow.c),
    latestAcceptedReceivedAt: latestAccepted,
    latestExtractedAtOverall: latestExtractedOverall,
    extractionLagHours: lag,
    topRows: (top as { rows: Array<Record<string, unknown>> }).rows.map((row) => ({
      session_id: typeof row.session_id === 'string' ? row.session_id : '',
      source_event_count: asInt(row.source_event_count),
      page_view_count: asInt(row.page_view_count),
      cta_click_count: asInt(row.cta_click_count),
      form_start_count: asInt(row.form_start_count),
      form_submit_count: asInt(row.form_submit_count),
      unique_path_count: asInt(row.unique_path_count),
      landing_page_path: (row.landing_page_path as string | null) ?? null,
      last_page_path: (row.last_page_path as string | null) ?? null,
      canonical_key_count_min: asIntOrNull(row.canonical_key_count_min),
      canonical_key_count_max: asIntOrNull(row.canonical_key_count_max),
      extracted_at: asDateOrNull(row.extracted_at),
    })),
  };
}

/* --------------------------------------------------------------------------
 * Decision (pure helper)
 * ------------------------------------------------------------------------ */

export interface SessionFeaturesDecisionContribution {
  blocks: string[];
  watches: string[];
}

/**
 * Compute the PR#12 contributions to the overall PASS/WATCH/BLOCK status.
 *
 * Pure function — no I/O. Inputs are `health` (from `loadSessionFeaturesHealth`
 * or null when the loader wasn't run), `config` (from `parseSessionFeaturesConfig`),
 * and `acceptedCountInWindow` (the existing report's window-scoped
 * `accepted_events` count, used to decide whether rows=0 is a WATCH).
 */
export function decideSessionFeatures(
  health: SessionFeaturesHealth | null,
  config: SessionFeaturesConfig,
  acceptedCountInWindow: number,
): SessionFeaturesDecisionContribution {
  const blocks: string[] = [];
  const watches: string[] = [];

  if (health === null || !health.tablePresent) {
    if (config.requireSessionFeatures) {
      watches.push(
        'session_features table not present in DB and OBS_REQUIRE_SESSION_FEATURES=true',
      );
    }
    return { blocks, watches };
  }

  if (health.rows === 0) {
    if (acceptedCountInWindow > 0) {
      watches.push(
        `session_features has 0 rows in window but accepted_events in window = ${acceptedCountInWindow} (rerun npm run extract:session-features)`,
      );
    }
    // accepted_events = 0 → no contribution (steady-state empty boundary).
    return { blocks, watches };
  }

  // BLOCK conditions — any non-zero anomaly count is a structural break.
  if (health.duplicateNaturalKeyCount > 0) {
    blocks.push(`session_features duplicate natural-key rows = ${health.duplicateNaturalKeyCount}`);
  }
  if (health.sourceEventCountMismatchCount > 0) {
    blocks.push(
      `session_features source_event_count mismatch (full-session check) rows = ${health.sourceEventCountMismatchCount}`,
    );
  }
  if (health.canonicalKeyAnomalyCount > 0) {
    blocks.push(
      `session_features canonical_key_count anomaly rows = ${health.canonicalKeyAnomalyCount}`,
    );
  }
  if (health.hasCtaMismatchCount > 0) {
    blocks.push(`session_features has_cta_click mismatch rows = ${health.hasCtaMismatchCount}`);
  }
  if (health.hasFormStartMismatchCount > 0) {
    blocks.push(
      `session_features has_form_start mismatch rows = ${health.hasFormStartMismatchCount}`,
    );
  }
  if (health.hasFormSubmitMismatchCount > 0) {
    blocks.push(
      `session_features has_form_submit mismatch rows = ${health.hasFormSubmitMismatchCount}`,
    );
  }
  if (health.durationAnomalyCount > 0) {
    blocks.push(
      `session_features session_duration_ms anomaly rows = ${health.durationAnomalyCount}`,
    );
  }
  if (health.jsonbTypeAnomalyCount > 0) {
    blocks.push(
      `session_features JSONB count-map type anomaly rows = ${health.jsonbTypeAnomalyCount}`,
    );
  }

  // WATCH — stale extractor.
  if (
    typeof health.extractionLagHours === 'number' &&
    health.extractionLagHours > config.maxLagHours
  ) {
    watches.push(
      `session_features extraction lag (${health.extractionLagHours.toFixed(2)}h) exceeds threshold (${config.maxLagHours}h)`,
    );
  }

  return { blocks, watches };
}

/* --------------------------------------------------------------------------
 * Render (pure helper)
 * ------------------------------------------------------------------------ */

function fmtTs(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return String(v);
}

function mdTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '_(no rows)_';
  const out: string[] = [];
  out.push(`| ${headers.join(' | ')} |`);
  out.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  return out.join('\n');
}

/**
 * Truncate a session_id to its first 8 characters plus an ellipsis. Used in
 * the §9b top-10 table so full session_id values are never rendered.
 */
export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '_(empty)_';
  return `${sessionId.slice(0, 8)}…`;
}

/**
 * Render the §9b markdown block. Pure: no I/O, no DB access. Inputs are the
 * loaded `health` (or null when loader was skipped) and the resolved config.
 *
 * Privacy contract:
 *   - paths only (no `_page_url` columns rendered)
 *   - `session_id` truncated to 8 chars + ellipsis
 *   - no raw JSONB payload values surfaced
 */
export function renderSessionFeaturesSection(
  health: SessionFeaturesHealth | null,
  config: SessionFeaturesConfig,
): string {
  const lines: string[] = [];
  lines.push('## 9b. Session features summary (derived layer — PR#11 output, observation only)');
  lines.push(
    '_Read-only view of the PR#11 extractor output. Selected by `last_seen_at` within the observation window. Source-event-count mismatch is validated against the FULL-SESSION `accepted_events` count for each selected session (no window filter on the join). Paths only — no URLs. `session_id` truncated to first 8 chars + ellipsis._',
  );
  lines.push('');

  if (health === null || !health.tablePresent) {
    lines.push('- table present? **no**');
    if (config.requireSessionFeatures) {
      lines.push(
        '- OBS_REQUIRE_SESSION_FEATURES=true → reported as WATCH (operator expected session_features here)',
      );
    } else {
      lines.push(
        '- OBS_REQUIRE_SESSION_FEATURES=false → no status impact (operator did not require session_features here)',
      );
    }
    lines.push('');
    return lines.join('\n');
  }

  lines.push('- table present? **yes**');
  lines.push(`- extraction_version: \`${config.extractionVersion}\``);
  lines.push(`- rows in observation window: ${health.rows}`);
  lines.push(`- latest extracted_at (window-scoped): ${fmtTs(health.latestExtractedAt)}`);
  lines.push(`- first_seen_at (min, window): ${fmtTs(health.firstSeen)}`);
  lines.push(`- last_seen_at (max, window): ${fmtTs(health.lastSeen)}`);
  lines.push(`- total source_event_count: ${health.totalSourceEvents}`);
  lines.push(`- total page_view_count:    ${health.totalPageViews}`);
  lines.push(`- total cta_click_count:    ${health.totalCtaClicks}`);
  lines.push(`- total form_start_count:   ${health.totalFormStarts}`);
  lines.push(`- total form_submit_count:  ${health.totalFormSubmits}`);
  lines.push(`- total unique_path_count:  ${health.totalUniquePaths}`);
  lines.push(
    `- canonical_key_count min/max overall: ${health.canonicalKeyCountMin === null ? 'null' : health.canonicalKeyCountMin} / ${health.canonicalKeyCountMax === null ? 'null' : health.canonicalKeyCountMax} (expect 19/19)`,
  );
  lines.push(`- sessions with has_cta_click:   ${health.sessionsWithCta}`);
  lines.push(`- sessions with has_form_start:  ${health.sessionsWithFormStart}`);
  lines.push(`- sessions with has_form_submit: ${health.sessionsWithFormSubmit}`);
  lines.push('');

  lines.push('### Anomaly counters (all should be 0)');
  lines.push(`- duplicate natural-key rows:                       ${health.duplicateNaturalKeyCount}`);
  lines.push(
    `- source_event_count mismatch (full-session check): ${health.sourceEventCountMismatchCount}`,
  );
  lines.push(`- canonical_key_count anomaly (≠ 19):                   ${health.canonicalKeyAnomalyCount}`);
  lines.push(`- has_cta_click mismatch:                           ${health.hasCtaMismatchCount}`);
  lines.push(`- has_form_start mismatch:                          ${health.hasFormStartMismatchCount}`);
  lines.push(`- has_form_submit mismatch:                         ${health.hasFormSubmitMismatchCount}`);
  lines.push(`- session_duration_ms anomaly:                      ${health.durationAnomalyCount}`);
  lines.push(`- JSONB count-map type anomaly:                     ${health.jsonbTypeAnomalyCount}`);
  lines.push('');

  lines.push('### Freshness (boundary-wide, not window-scoped)');
  lines.push(`- latest accepted_events.received_at:        ${fmtTs(health.latestAcceptedReceivedAt)}`);
  lines.push(`- latest session_features.extracted_at:      ${fmtTs(health.latestExtractedAtOverall)}`);
  if (typeof health.extractionLagHours === 'number') {
    const displayLag = Math.max(0, health.extractionLagHours);
    lines.push(
      `- extraction lag:                            ${displayLag.toFixed(2)}h (threshold ${config.maxLagHours}h)`,
    );
  } else {
    lines.push('- extraction lag:                            _(not computable — null timestamps)_');
  }
  lines.push('');

  lines.push('### Top 10 latest session_features rows (paths only)');
  if (health.topRows.length === 0) {
    lines.push('_(no rows)_');
  } else {
    lines.push(
      mdTable(
        [
          'session_id_prefix',
          'source_event_count',
          'page_view_count',
          'cta_click_count',
          'form_start_count',
          'form_submit_count',
          'unique_path_count',
          'landing_page_path',
          'last_page_path',
          'canonical_key_count_min',
          'canonical_key_count_max',
          'extracted_at',
        ],
        health.topRows.map((row) => [
          truncateSessionId(row.session_id),
          String(row.source_event_count),
          String(row.page_view_count),
          String(row.cta_click_count),
          String(row.form_start_count),
          String(row.form_submit_count),
          String(row.unique_path_count),
          row.landing_page_path ?? '_(null)_',
          row.last_page_path ?? '_(null)_',
          row.canonical_key_count_min === null ? 'null' : String(row.canonical_key_count_min),
          row.canonical_key_count_max === null ? 'null' : String(row.canonical_key_count_max),
          fmtTs(row.extracted_at),
        ]),
      ),
    );
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * All §9b SQL strings, exported for test sweeps (forbidden-token regex,
 * DML detection, etc.).
 */
export const SESSION_FEATURES_SQL_STRINGS: ReadonlyArray<{ name: string; sql: string }> = [
  { name: 'SESSION_FEATURES_TABLE_PRESENCE_SQL', sql: SESSION_FEATURES_TABLE_PRESENCE_SQL },
  { name: 'SESSION_FEATURES_SUMMARY_SQL', sql: SESSION_FEATURES_SUMMARY_SQL },
  { name: 'SESSION_FEATURES_DUPLICATE_NATURAL_KEY_SQL', sql: SESSION_FEATURES_DUPLICATE_NATURAL_KEY_SQL },
  { name: 'SESSION_FEATURES_CANONICAL_ANOMALY_SQL', sql: SESSION_FEATURES_CANONICAL_ANOMALY_SQL },
  { name: 'SESSION_FEATURES_HAS_FLAG_MISMATCH_SQL', sql: SESSION_FEATURES_HAS_FLAG_MISMATCH_SQL },
  { name: 'SESSION_FEATURES_DURATION_ANOMALY_SQL', sql: SESSION_FEATURES_DURATION_ANOMALY_SQL },
  { name: 'SESSION_FEATURES_JSONB_TYPE_ANOMALY_SQL', sql: SESSION_FEATURES_JSONB_TYPE_ANOMALY_SQL },
  {
    name: 'SESSION_FEATURES_SOURCE_EVENT_MISMATCH_SQL',
    sql: SESSION_FEATURES_SOURCE_EVENT_MISMATCH_SQL,
  },
  { name: 'SESSION_FEATURES_FRESHNESS_SQL', sql: SESSION_FEATURES_FRESHNESS_SQL },
  { name: 'SESSION_FEATURES_TOP_ROWS_SQL', sql: SESSION_FEATURES_TOP_ROWS_SQL },
];
