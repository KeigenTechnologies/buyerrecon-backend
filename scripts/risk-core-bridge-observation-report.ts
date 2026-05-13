#!/usr/bin/env tsx
/**
 * Sprint 2 PR#8b — Risk Core Bridge Observer CLI.
 *
 * Read-only internal engineering diagnostic. Reads
 * `risk_observations_v0_1` (+ optional `stage0_decisions` side-read),
 * builds `RiskCoreBridgeEnvelope` in memory via PR#7b's pure adapter,
 * aggregates a diagnostic report, prints JSON to stdout. Envelopes
 * are discarded after counting (PR#8a OD-8 — no persistence).
 *
 * STRICTLY READ-ONLY. No INSERT / UPDATE / DELETE. No DDL. No psql.
 * No Lane A / Lane B reads. No raw upstream reads. No customer
 * output. No Render production deploy (A0 P-4 still blocking).
 *
 * Env (all optional except DATABASE_URL):
 *   DATABASE_URL                  required; never printed (host + db only)
 *   OBS_WORKSPACE_ID              optional filter
 *   OBS_SITE_ID                   optional filter
 *   OBS_WINDOW_HOURS              default 720 (30 days)
 *   OBS_SINCE / OBS_UNTIL         ISO-8601 overrides (mirror PR#5 / PR#6 worker pattern)
 *   OBS_LIMIT                     default 10000
 *   OBS_SAMPLE_LIMIT              default 10
 *   OBS_REQUIRE_ROWS              default false; if true, exit 1 when rows_scanned === 0
 *   OBS_OBSERVATION_VERSION       default 'risk-obs-v0.1'
 *   OBS_SCORING_VERSION           default 's2.v1.0'
 *
 * Exit codes:
 *   0 — report generated
 *   1 — OBS_REQUIRE_ROWS=true and rows_scanned === 0
 *   2 — connection / SQL error
 */

import 'dotenv/config';
import pg from 'pg';
import {
  parseDatabaseUrl,
  runRiskCoreBridgeObserver,
  serialiseReport,
  type ObserverRunOptions,
} from '../src/scoring/risk-core-bridge-observer/index.js';
// PR#6's authoritative observation_version constant — imported so the
// CLI default tracks PR#6's source-of-truth instead of duplicating a
// literal. Per PR#8a §10 cleanup #2.
import { OBSERVATION_VERSION_DEFAULT } from '../src/scoring/risk-evidence/types.js';

/* --------------------------------------------------------------------------
 * Env-var parsing (no DB access here — purely string→typed conversion)
 * ------------------------------------------------------------------------ */

const DEFAULT_WINDOW_HOURS    = 720;
const DEFAULT_LIMIT           = 10_000;
const DEFAULT_SAMPLE_LIMIT    = 10;
const DEFAULT_OBSERVATION_VER = OBSERVATION_VERSION_DEFAULT;  // PR#6 single source of truth
// `DEFAULT_SCORING_VER` mirrors the current PR#4 contract default
// (`scoring/version.yml.scoring_version`). It is intentionally kept
// as a literal here rather than loaded via the PR#4 contract loader
// to avoid pulling YAML I/O into the CLI's hot-path. When PR#4's
// scoring_version bumps, this literal must be updated. A future PR
// can promote this to a loader call without changing the CLI's
// outward contract.
const DEFAULT_SCORING_VER     = 's2.v1.0';

interface ParsedEnv {
  readonly databaseUrl:     string;
  readonly options:         ObserverRunOptions;
  readonly require_rows:    boolean;
}

function fail(code: number, msg: string): never {
  process.stderr.write(`PR#8b risk-core-bridge observer — ${msg}\n`);
  process.exit(code);
}

function parseEnv(env: NodeJS.ProcessEnv = process.env, now: Date = new Date()): ParsedEnv {
  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    fail(2, 'DATABASE_URL is required (host + db name will be printed; full URL is never printed)');
  }

  const workspace_id = typeof env.OBS_WORKSPACE_ID === 'string' && env.OBS_WORKSPACE_ID.length > 0
    ? env.OBS_WORKSPACE_ID : null;
  const site_id = typeof env.OBS_SITE_ID === 'string' && env.OBS_SITE_ID.length > 0
    ? env.OBS_SITE_ID : null;

  // Window
  let window_end: Date;
  if (typeof env.OBS_UNTIL === 'string' && env.OBS_UNTIL.length > 0) {
    const u = Date.parse(env.OBS_UNTIL);
    if (!Number.isFinite(u)) fail(2, `OBS_UNTIL is not a parseable timestamp: ${JSON.stringify(env.OBS_UNTIL)}`);
    window_end = new Date(u);
  } else {
    window_end = now;
  }
  let window_start: Date;
  if (typeof env.OBS_SINCE === 'string' && env.OBS_SINCE.length > 0) {
    const s = Date.parse(env.OBS_SINCE);
    if (!Number.isFinite(s)) fail(2, `OBS_SINCE is not a parseable timestamp: ${JSON.stringify(env.OBS_SINCE)}`);
    window_start = new Date(s);
  } else {
    const rawHours = env.OBS_WINDOW_HOURS ?? String(DEFAULT_WINDOW_HOURS);
    const hours = Number.parseInt(rawHours, 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      fail(2, `OBS_WINDOW_HOURS must be a positive integer (got ${JSON.stringify(rawHours)})`);
    }
    window_start = new Date(window_end.getTime() - hours * 3600 * 1000);
  }
  if (window_start.getTime() >= window_end.getTime()) {
    fail(2, 'window_start must be strictly before window_end');
  }

  // Limits
  const rawLimit = env.OBS_LIMIT ?? String(DEFAULT_LIMIT);
  const limit = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    fail(2, `OBS_LIMIT must be a positive integer (got ${JSON.stringify(rawLimit)})`);
  }
  const rawSampleLimit = env.OBS_SAMPLE_LIMIT ?? String(DEFAULT_SAMPLE_LIMIT);
  const sample_limit = Number.parseInt(rawSampleLimit, 10);
  if (!Number.isFinite(sample_limit) || sample_limit < 0) {
    fail(2, `OBS_SAMPLE_LIMIT must be a non-negative integer (got ${JSON.stringify(rawSampleLimit)})`);
  }

  const observation_version = typeof env.OBS_OBSERVATION_VERSION === 'string' && env.OBS_OBSERVATION_VERSION.length > 0
    ? env.OBS_OBSERVATION_VERSION : DEFAULT_OBSERVATION_VER;
  const scoring_version = typeof env.OBS_SCORING_VERSION === 'string' && env.OBS_SCORING_VERSION.length > 0
    ? env.OBS_SCORING_VERSION : DEFAULT_SCORING_VER;

  const require_rows = env.OBS_REQUIRE_ROWS === 'true';

  return {
    databaseUrl,
    options: {
      observation_version,
      scoring_version,
      workspace_id,
      site_id,
      window_start,
      window_end,
      limit,
      sample_limit,
    },
    require_rows,
  };
}

/* --------------------------------------------------------------------------
 * Main
 * ------------------------------------------------------------------------ */

async function main(): Promise<void> {
  const parsed = parseEnv();
  const { host, name } = parseDatabaseUrl(parsed.databaseUrl);

  const pool = new pg.Pool({
    connectionString:  parsed.databaseUrl,
    max:               4,
    idleTimeoutMillis: 5000,
  });

  let report;
  try {
    report = await runRiskCoreBridgeObserver({
      client:         pool,
      options:        parsed.options,
      database_host:  host,
      database_name:  name,
    });
  } catch (err) {
    await pool.end().catch(() => undefined);
    fail(2, `observer execution failed: ${(err as Error).message}`);
  }

  await pool.end();

  // Emit the report (JSON, masked, no full session_id, no secrets).
  process.stdout.write(serialiseReport(report));
  process.stdout.write('\n');

  if (parsed.require_rows && report.rows_scanned === 0) {
    process.stderr.write('PR#8b risk-core-bridge observer — OBS_REQUIRE_ROWS=true and rows_scanned === 0\n');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`PR#8b risk-core-bridge observer — fatal: ${(err as Error).message}\n`);
  process.exit(2);
});
