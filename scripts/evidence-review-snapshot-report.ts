#!/usr/bin/env tsx
/**
 * Sprint 2 PR#15a — Evidence Review Snapshot Observer CLI.
 *
 * Read-only internal diagnostic. Produces a markdown snapshot
 * supporting the Phase-1 £1,250 BuyerRecon Evidence Review.
 *
 * STRICTLY READ-ONLY. No INSERT / UPDATE / DELETE. No DDL. No
 * customer output. No durable Lane-A / Lane-B writer. No AMS
 * Product Layer execution. No `ProductDecision`. No Render
 * production deploy.
 *
 * Env (required):
 *   DATABASE_URL          masked in output (host + db name only)
 *   OBS_WORKSPACE_ID
 *   OBS_SITE_ID
 *
 * Env (optional):
 *   OBS_WINDOW_HOURS      default 720 (30 days)
 *   OBS_SINCE / OBS_UNTIL ISO-8601 overrides
 *
 * Exit codes:
 *   0 — markdown rendered, all queries returned (some tables may
 *       be absent; that's fine, they show as "not present").
 *   2 — env / connection error.
 */

import 'dotenv/config';
import pg from 'pg';
import {
  parseDatabaseUrl,
  renderEvidenceReviewSnapshotMarkdown,
  runEvidenceReviewSnapshot,
} from '../src/evidence-review-snapshot/index.js';

const DEFAULT_WINDOW_HOURS = 720;

interface ParsedEnv {
  readonly databaseUrl:  string;
  readonly workspace_id: string;
  readonly site_id:      string;
  readonly window_start: Date;
  readonly window_end:   Date;
}

function fail(code: number, msg: string): never {
  process.stderr.write(`PR#15a evidence-review-snapshot observer — ${msg}\n`);
  process.exit(code);
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

  return { databaseUrl, workspace_id, site_id, window_start, window_end };
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
    report = await runEvidenceReviewSnapshot({
      client:        pool,
      options:       {
        workspace_id: parsed.workspace_id,
        site_id:      parsed.site_id,
        window_start: parsed.window_start,
        window_end:   parsed.window_end,
      },
      database_host: host,
      database_name: name,
    });
  } catch (err) {
    await pool.end().catch(() => undefined);
    fail(2, `snapshot execution failed: ${(err as Error).message}`);
  }

  await pool.end();
  process.stdout.write(renderEvidenceReviewSnapshotMarkdown(report));
  process.stdout.write('\n');
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`PR#15a evidence-review-snapshot observer — fatal: ${(err as Error).message}\n`);
  process.exit(2);
});
