#!/usr/bin/env tsx
/**
 * Sprint 2 PR#6 — CLI runner for the behavioural-pattern evidence
 * RECORD_ONLY worker.
 *
 * Reads env:
 *   DATABASE_URL            required; never printed (only host + database name)
 *   WORKSPACE_ID            optional filter
 *   SITE_ID                 optional filter
 *   SINCE_HOURS             candidate window in hours (default 168)
 *   SINCE                   optional ISO timestamp; overrides SINCE_HOURS lower bound
 *   UNTIL                   optional ISO timestamp; overrides upper bound (default NOW)
 *   OBSERVATION_VERSION     default 'risk-obs-v0.1'
 *   STAGE0_VERSION_FILTER   optional filter for the stage0_decisions read
 *   BEHAVIOURAL_FEATURE_VERSION  optional override for the SBF
 *                                feature_version filter (default
 *                                'behavioural-features-v0.3'). See
 *                                Hetzner-staging finding under commit
 *                                de76950 for why this filter exists.
 *
 * Output: PASS summary on stdout; never prints raw UA / token / IP /
 * payload / canonical_jsonb.
 *
 * Wire-up: `npm run risk-evidence:run`.
 */

import 'dotenv/config';
import pg from 'pg';
import {
  parseRiskEvidenceEnvOptions,
  runRiskEvidenceWorker,
} from '../src/scoring/risk-evidence/index.js';

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
    parsed = parseRiskEvidenceEnvOptions();
  } catch (err) {
    process.stderr.write(`Sprint 2 PR#6 risk-evidence worker — ${(err as Error).message}\n`);
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString:  parsed.databaseUrl,
    max:               4,
    idleTimeoutMillis: 5000,
  });

  let result;
  try {
    result = await runRiskEvidenceWorker(pool, parsed.options);
  } catch (err) {
    process.stderr.write(
      `Sprint 2 PR#6 risk-evidence worker — execution failed: ${(err as Error).message}\n`,
    );
    await pool.end().catch(() => undefined);
    process.exit(1);
  }

  process.stdout.write([
    `Sprint 2 PR#6 risk-evidence worker — PASS`,
    `  database:                     ${maskUrl(parsed.databaseUrl)}`,
    `  observation_version:          ${result.observation_version}`,
    `  scoring_version:              ${result.scoring_version}`,
    `  behavioural_feature_version:  ${result.behavioural_feature_version}`,
    `  window:                       ${result.window_start.toISOString()} → ${result.window_end.toISOString()}`,
    `  upserted_rows:                ${result.upserted_rows}`,
    `  bytespider_tagged:            ${result.bytespider_tagged}`,
    '',
  ].join('\n'));

  await pool.end();
}

main().catch((err) => {
  process.stderr.write(`Sprint 2 PR#6 risk-evidence worker — fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
