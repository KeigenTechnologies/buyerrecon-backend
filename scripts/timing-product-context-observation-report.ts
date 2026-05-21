#!/usr/bin/env tsx
/**
 * Sprint 2 PR#18c — Timing / Product-Context Observer CLI.
 *
 * Read-only internal engineering diagnostic. Reads the §3 BuyerRecon
 * evidence sources (accepted_events, ingest_requests, rejected_events,
 * session_features, session_behavioural_features_v0_2, poi_observations_v0_1,
 * poi_sequence_observations_v0_1, risk_observations_v0_1, site_write_tokens.label,
 * scoring_output_lane_a/b counts) and emits a structured markdown report
 * to stdout.
 *
 * STRICTLY READ-ONLY. No INSERT / UPDATE / DELETE. No DDL. No psql.
 * No Lane A/B writer. No POI / Risk / Stage 0 mutation. No customer
 * output. No AMS Product Layer runtime. No Render production deploy.
 *
 * Env (required for live run):
 *   DATABASE_URL                          masked in output (host + db only)
 *   OBS_WORKSPACE_ID                      required
 *   OBS_SITE_ID                           required
 * Env (optional):
 *   OBS_WINDOW_HOURS                      default 720
 *   OBS_SINCE / OBS_UNTIL                 ISO-8601 overrides for window
 *   OBS_LIMIT                             default 10000 rows per source
 *   OBS_REQUIRE_TIMING_PRODUCT_CONTEXT    'true' upgrades optional-source-missing to 'warn' severity
 *
 * Exit codes:
 *   0 — report generated, final_status = PASS or PASS_WITH_WARNINGS
 *   2 — env / connection / SQL error / final_status = BLOCKED
 */

import 'dotenv/config';
import pg from 'pg';

import {
  parseDatabaseUrl,
  renderMarkdown,
  runTimingProductContextObserver,
  type ObserverRunOptions,
  type TimingProductContextObservationReport,
} from '../src/scoring/timing-product-context-observer/index.js';

const DEFAULT_WINDOW_HOURS = 720;   // 30 days
const DEFAULT_LIMIT        = 10_000;

interface ParsedEnv {
  readonly databaseUrl: string;
  readonly options:     ObserverRunOptions;
}

function fail(code: number, msg: string): never {
  process.stderr.write(`PR#18c timing-product-context observer — ${msg}\n`);
  process.exit(code);
}

function requireString(name: string, raw: string | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    fail(2, `env var ${name} required`);
  }
  return raw;
}

function parseIntOrFail(raw: string | undefined, defaultVal: number, name: string): number {
  if (typeof raw !== 'string' || raw.length === 0) return defaultVal;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    fail(2, `${name} must be a positive integer (got ${JSON.stringify(raw)})`);
  }
  return n;
}

function parseIsoOrFail(raw: string | undefined, fallback: Date, name: string): Date {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) {
    fail(2, `${name} must be an ISO-8601 timestamp (got ${JSON.stringify(raw)})`);
  }
  return new Date(t);
}

export function parseEnv(env: NodeJS.ProcessEnv = process.env, now: Date = new Date()): ParsedEnv {
  const databaseUrl = requireString('DATABASE_URL', env.DATABASE_URL);
  const workspace   = requireString('OBS_WORKSPACE_ID', env.OBS_WORKSPACE_ID);
  const site        = requireString('OBS_SITE_ID', env.OBS_SITE_ID);

  const windowHours = parseIntOrFail(env.OBS_WINDOW_HOURS, DEFAULT_WINDOW_HOURS, 'OBS_WINDOW_HOURS');
  const limit       = parseIntOrFail(env.OBS_LIMIT, DEFAULT_LIMIT, 'OBS_LIMIT');

  const window_end   = parseIsoOrFail(env.OBS_UNTIL, now, 'OBS_UNTIL');
  const fallbackStart = new Date(window_end.getTime() - windowHours * 3_600_000);
  const window_start = parseIsoOrFail(env.OBS_SINCE, fallbackStart, 'OBS_SINCE');

  if (window_end.getTime() <= window_start.getTime()) {
    fail(2, `window_end (${window_end.toISOString()}) must be strictly after window_start (${window_start.toISOString()})`);
  }

  const require_timing_product_context = env.OBS_REQUIRE_TIMING_PRODUCT_CONTEXT === 'true';

  const options: ObserverRunOptions = Object.freeze({
    workspace_id:                  workspace,
    site_id:                       site,
    window_start,
    window_end,
    window_hours:                  windowHours,
    evaluation_at:                 now,
    limit,
    require_timing_product_context,
  });

  return { databaseUrl, options };
}

export function decideCliExitCode(report: TimingProductContextObservationReport): number {
  if (report.final_status === 'BLOCKED') return 2;
  // PASS or PASS_WITH_WARNINGS → 0
  return 0;
}

async function main(): Promise<void> {
  const env = parseEnv();
  const dsn = parseDatabaseUrl(env.databaseUrl);

  const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 4 });
  try {
    const report = await runTimingProductContextObserver({
      client:        pool,
      options:       env.options,
      database_host: dsn.host,
      database_name: dsn.name,
    });
    process.stdout.write(renderMarkdown(report));
    process.stdout.write('\n');
    process.exit(decideCliExitCode(report));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    fail(2, `runner failed: ${msg}`);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

// Only run when invoked as a script, not when imported.
const isDirectInvocation =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  process.argv[1].endsWith('timing-product-context-observation-report.ts');

if (isDirectInvocation) {
  void main();
}
