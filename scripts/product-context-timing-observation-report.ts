#!/usr/bin/env tsx
/**
 * Sprint 2 PR#13b — Product-Context / Timing Observer CLI.
 *
 * Read-only internal engineering diagnostic. Reads
 * `poi_observations_v0_1` + `poi_sequence_observations_v0_1`
 * + `information_schema.{tables, columns}` only. Builds a
 * structured `ObserverReport` and emits it as a **markdown** report
 * to stdout, with an embedded JSON code block holding the
 * AMS-aligned non-authoritative preview sample.
 *
 * STRICTLY READ-ONLY. No INSERT / UPDATE / DELETE. No DDL. No psql.
 * No Lane A/B reads. No POI/Risk/Stage 0 raw reads. No customer
 * output. No AMS Product Layer runtime execution. No Render
 * production deploy (A0 P-4 still blocking).
 *
 * Env (required):
 *   DATABASE_URL                          masked in output (host + db only)
 *   OBS_WORKSPACE_ID                      required
 *   OBS_SITE_ID                           required
 * Env (optional):
 *   OBS_WINDOW_HOURS                      default 720
 *   OBS_SINCE / OBS_UNTIL                 ISO-8601 overrides
 *   OBS_LIMIT                             default 10000
 *   OBS_SAMPLE_LIMIT                      default 3
 *   OBS_CATEGORY_TEMPLATE                 default 'generic_b2b'
 *   OBS_PRIMARY_CONVERSION_GOAL           default 'request_diagnostic'
 *   OBS_SALES_MOTION                      default 'sales_led'
 *
 * Exit codes:
 *   0 — report generated
 *   2 — env / connection / SQL error / missing required input
 */

import 'dotenv/config';
import pg from 'pg';
import {
  CATEGORY_TEMPLATES_ALLOWED,
  decideProductContextTimingCliExitCode,
  DEFAULT_CATEGORY_TEMPLATE,
  DEFAULT_PRIMARY_CONVERSION_GOAL,
  DEFAULT_SALES_MOTION,
  parseDatabaseUrl,
  PRIMARY_CONVERSION_GOALS_ALLOWED,
  renderMarkdown,
  runProductContextTimingObserver,
  SALES_MOTIONS_ALLOWED,
  type CategoryTemplate,
  type ObserverRunOptions,
  type PrimaryConversionGoal,
  type SalesMotion,
} from '../src/scoring/product-context-timing-observer/index.js';

const DEFAULT_WINDOW_HOURS = 720;
const DEFAULT_LIMIT        = 10_000;
const DEFAULT_SAMPLE_LIMIT = 3;

interface ParsedEnv {
  readonly databaseUrl: string;
  readonly options:     ObserverRunOptions;
}

function fail(code: number, msg: string): never {
  process.stderr.write(`PR#13b product-context-timing observer — ${msg}\n`);
  process.exit(code);
}

function parseEnumOrFail<T extends string>(
  raw:        string | undefined,
  allowed:    readonly T[],
  defaultVal: T,
  envName:    string,
): T {
  if (typeof raw !== 'string' || raw.length === 0) return defaultVal;
  if ((allowed as readonly string[]).includes(raw)) return raw as T;
  fail(2, `${envName} must be one of [${allowed.join(', ')}] (got ${JSON.stringify(raw)})`);
}

function parseEnv(env: NodeJS.ProcessEnv = process.env, now: Date = new Date()): ParsedEnv {
  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    fail(2, 'DATABASE_URL is required (host + db name will be printed; full URL is never printed)');
  }

  const workspace_id = env.OBS_WORKSPACE_ID;
  if (typeof workspace_id !== 'string' || workspace_id.length === 0) {
    fail(2, 'OBS_WORKSPACE_ID is required');
  }
  const site_id = env.OBS_SITE_ID;
  if (typeof site_id !== 'string' || site_id.length === 0) {
    fail(2, 'OBS_SITE_ID is required');
  }

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

  const category_template: CategoryTemplate = parseEnumOrFail(
    env.OBS_CATEGORY_TEMPLATE, CATEGORY_TEMPLATES_ALLOWED, DEFAULT_CATEGORY_TEMPLATE, 'OBS_CATEGORY_TEMPLATE');
  const primary_conversion_goal: PrimaryConversionGoal = parseEnumOrFail(
    env.OBS_PRIMARY_CONVERSION_GOAL, PRIMARY_CONVERSION_GOALS_ALLOWED, DEFAULT_PRIMARY_CONVERSION_GOAL, 'OBS_PRIMARY_CONVERSION_GOAL');
  const sales_motion: SalesMotion = parseEnumOrFail(
    env.OBS_SALES_MOTION, SALES_MOTIONS_ALLOWED, DEFAULT_SALES_MOTION, 'OBS_SALES_MOTION');

  return {
    databaseUrl,
    options: {
      workspace_id,
      site_id,
      window_start,
      window_end,
      limit,
      sample_limit,
      category_template,
      primary_conversion_goal,
      sales_motion,
      evaluation_at: now,
    },
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
    report = await runProductContextTimingObserver({
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

  process.stdout.write(renderMarkdown(report));
  process.stdout.write('\n');

  // Fail-closed source readiness MUST surface as a non-zero CLI exit
  // (Codex blocker fix). The markdown report is still rendered for
  // operator triage; the structured `source_readiness.fail_closed`
  // flag drives the exit code via the pure helper.
  const decision = decideProductContextTimingCliExitCode(report);
  if (decision.exit_code !== 0) {
    if (decision.stderr_message !== null) {
      process.stderr.write(`PR#13b product-context-timing observer — ${decision.stderr_message}\n`);
    }
    process.exit(decision.exit_code);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`PR#13b product-context-timing observer — fatal: ${(err as Error).message}\n`);
  process.exit(2);
});
