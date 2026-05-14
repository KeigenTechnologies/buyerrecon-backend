#!/usr/bin/env tsx
/**
 * Sprint 2 PR#12e — POI Sequence Table Observer CLI.
 *
 * Read-only internal engineering diagnostic. Reads
 * `poi_sequence_observations_v0_1` + `information_schema.{tables,
 * columns}` only. Verifies the row-level invariants from migration
 * 015 + the PR#12d verification SQL, plus a schema-level forbidden-
 * column sweep. Emits a JSON report to stdout. Writes nothing.
 *
 * STRICTLY READ-ONLY. No INSERT / UPDATE / DELETE. No DDL. No psql.
 * No Lane A/B reads. No POI table re-read. No customer output. No
 * Render production deploy (A0 P-4 still blocking).
 *
 * Env (all optional except DATABASE_URL):
 *   DATABASE_URL                          required; never printed (host + db only)
 *   OBS_WORKSPACE_ID                      optional filter
 *   OBS_SITE_ID                           optional filter
 *   OBS_WINDOW_HOURS                      default 720 (30 days)
 *   OBS_SINCE / OBS_UNTIL                 ISO-8601 overrides
 *   OBS_LIMIT                             default 10000 (informational; runner uses COUNT, not LIMIT)
 *   OBS_SAMPLE_LIMIT                      default 10 (session-id prefix sample)
 *   OBS_ANOMALY_SAMPLE_LIMIT              default 5; 0 suppresses anomaly samples
 *   OBS_REQUIRE_ROWS                      default false; if true, exit 1 when rows_in_table === 0
 *   OBS_POI_SEQUENCE_VERSION              default 'poi-sequence-v0.1'
 *   OBS_POI_OBSERVATION_VERSION           default 'poi-observation-v0.1'
 *
 * Exit codes:
 *   0 — report generated (anomalies may still be > 0 — caller inspects)
 *   1 — OBS_REQUIRE_ROWS=true and rows_in_table === 0
 *   2 — connection / SQL error / invalid CLI option / missing DATABASE_URL
 */

import 'dotenv/config';
import pg from 'pg';
import {
  parseDatabaseUrl,
  runPoiSequenceTableObserver,
  serialiseReport,
  type TableObserverRunOptions,
} from '../src/scoring/poi-sequence-table-observer/index.js';

const DEFAULT_WINDOW_HOURS         = 720;
const DEFAULT_LIMIT                = 10_000;
const DEFAULT_SAMPLE_LIMIT         = 10;
const DEFAULT_ANOMALY_SAMPLE_LIMIT = 5;

interface ParsedEnv {
  readonly databaseUrl:  string;
  readonly options:      TableObserverRunOptions;
  readonly require_rows: boolean;
}

function fail(code: number, msg: string): never {
  process.stderr.write(`PR#12e poi-sequence-table observer — ${msg}\n`);
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

  const rawAnomalySampleLimit = env.OBS_ANOMALY_SAMPLE_LIMIT ?? String(DEFAULT_ANOMALY_SAMPLE_LIMIT);
  const anomaly_sample_limit = Number.parseInt(rawAnomalySampleLimit, 10);
  if (!Number.isFinite(anomaly_sample_limit) || anomaly_sample_limit < 0) {
    fail(2, `OBS_ANOMALY_SAMPLE_LIMIT must be a non-negative integer (got ${JSON.stringify(rawAnomalySampleLimit)})`);
  }

  const poi_sequence_version_expected =
    typeof env.OBS_POI_SEQUENCE_VERSION === 'string' && env.OBS_POI_SEQUENCE_VERSION.length > 0
      ? env.OBS_POI_SEQUENCE_VERSION : 'poi-sequence-v0.1';
  const poi_observation_version_expected =
    typeof env.OBS_POI_OBSERVATION_VERSION === 'string' && env.OBS_POI_OBSERVATION_VERSION.length > 0
      ? env.OBS_POI_OBSERVATION_VERSION : 'poi-observation-v0.1';

  const require_rows = env.OBS_REQUIRE_ROWS === 'true';

  return {
    databaseUrl,
    options: {
      workspace_id,
      site_id,
      window_start,
      window_end,
      limit,
      sample_limit,
      anomaly_sample_limit,
      poi_sequence_version_expected,
      poi_observation_version_expected,
    },
    require_rows,
  };
}

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
    report = await runPoiSequenceTableObserver({
      client:        pool,
      options:       parsed.options,
      database_host: host,
      database_name: name,
    });
  } catch (err) {
    await pool.end().catch(() => undefined);
    fail(2, `observer execution failed: ${(err as Error).message}`);
  }

  await pool.end();

  process.stdout.write(serialiseReport(report));
  process.stdout.write('\n');

  if (parsed.require_rows && report.rows_in_table === 0) {
    process.stderr.write('PR#12e poi-sequence-table observer — OBS_REQUIRE_ROWS=true and rows_in_table === 0\n');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`PR#12e poi-sequence-table observer — fatal: ${(err as Error).message}\n`);
  process.exit(2);
});
