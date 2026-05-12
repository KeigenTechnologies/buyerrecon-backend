#!/usr/bin/env tsx
/**
 * Sprint 2 PR#5 — CLI runner for the Stage 0 RECORD_ONLY worker.
 *
 * Reads env:
 *   DATABASE_URL       required; never printed (only host + database name)
 *   WORKSPACE_ID       optional filter
 *   SITE_ID            optional filter
 *   SINCE_HOURS        candidate window in hours (default 168)
 *   SINCE              optional ISO timestamp; overrides SINCE_HOURS lower bound
 *   UNTIL              optional ISO timestamp; overrides upper bound (default NOW)
 *   STAGE0_VERSION     default 'stage0-hard-exclusion-v0.2'
 *
 * Output: PASS summary on stdout; never prints raw UA / token / IP /
 * payload / canonical_jsonb.
 *
 * Wire-up: `npm run stage0:run`.
 */

import 'dotenv/config';
import pg from 'pg';
import { parseStage0EnvOptions, runStage0Worker } from '../src/scoring/stage0/run-stage0-worker.js';

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}/${u.pathname.replace(/^\//, '')}`;
  } catch {
    return '<unparseable DATABASE_URL>';
  }
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseStage0EnvOptions();
  } catch (err) {
    process.stderr.write(`Sprint 2 PR#5 stage0 worker — ${(err as Error).message}\n`);
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: parsed.databaseUrl,
    max:              4,
    idleTimeoutMillis: 5000,
  });

  let result;
  try {
    result = await runStage0Worker(pool, parsed.options);
  } catch (err) {
    process.stderr.write(
      `Sprint 2 PR#5 stage0 worker — execution failed: ${(err as Error).message}\n`,
    );
    await pool.end().catch(() => undefined);
    process.exit(1);
  }

  process.stdout.write([
    `Sprint 2 PR#5 stage0 worker — PASS`,
    `  database:         ${maskUrl(parsed.databaseUrl)}`,
    `  stage0_version:   ${result.stage0_version}`,
    `  scoring_version:  ${result.scoring_version}`,
    `  window:           ${result.window_start.toISOString()} → ${result.window_end.toISOString()}`,
    `  upserted_rows:    ${result.upserted_rows}`,
    `  excluded:         ${result.excluded_rows}`,
    `  non_excluded:     ${result.non_excluded_rows}`,
    '',
  ].join('\n'));

  await pool.end();
}

main().catch((err) => {
  process.stderr.write(`Sprint 2 PR#5 stage0 worker — fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
