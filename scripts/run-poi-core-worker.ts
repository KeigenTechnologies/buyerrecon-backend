#!/usr/bin/env tsx
/**
 * Sprint 2 PR#11c — POI Core Worker CLI.
 *
 * Manual-CLI batch trigger. Reads `session_features` + Stage 0
 * side-read, builds `PoiCoreInput` envelopes via the PR#10 adapter,
 * UPSERTs them into `poi_observations_v0_1`. Idempotent under the
 * 8-column natural key.
 *
 * No customer-facing output. No Lane A/B writes. No Render production
 * deploy (A0 P-4 still blocking).
 *
 * Env (all optional except DATABASE_URL):
 *   DATABASE_URL                  required; never printed (host + db only)
 *   WORKSPACE_ID                  optional filter
 *   SITE_ID                       optional filter
 *   EXTRACTION_VERSION            optional filter on session_features.extraction_version
 *   WINDOW_HOURS                  default 720 (30 days)
 *   SINCE / UNTIL                 ISO-8601 overrides
 *   WORKER_LIMIT                  default 10000
 *   SAMPLE_LIMIT                  default 10
 *   POI_INPUT_VERSION             default POI_CORE_INPUT_VERSION (PR#10)
 *   POI_OBSERVATION_VERSION       default POI_OBSERVATION_VERSION_DEFAULT (PR#11c)
 *   SCORING_VERSION               default 's2.v1.0'
 *
 * Exit codes:
 *   0 — worker PASS (rows_inserted + rows_updated may be 0)
 *   1 — env-parsing / contract-guard / execution failure
 */

import 'dotenv/config';
import pg from 'pg';
import {
  parseDatabaseUrl,
  parsePoiCoreWorkerEnvOptions,
  runPoiCoreWorker,
} from '../src/scoring/poi-core-worker/index.js';

function fail(code: number, msg: string): never {
  process.stderr.write(`Sprint 2 PR#11c poi-core-worker — ${msg}\n`);
  process.exit(code);
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parsePoiCoreWorkerEnvOptions();
  } catch (err) {
    fail(1, (err as Error).message);
  }

  const { host, name } = parseDatabaseUrl(parsed.databaseUrl);

  const pool = new pg.Pool({
    connectionString:  parsed.databaseUrl,
    max:               4,
    idleTimeoutMillis: 5000,
  });

  let report;
  try {
    report = await runPoiCoreWorker({
      client:        pool,
      options:       parsed.options,
      database_host: host,
      database_name: name,
    });
  } catch (err) {
    await pool.end().catch(() => undefined);
    fail(1, `worker execution failed: ${(err as Error).message}`);
  }

  await pool.end();

  // Emit the report (JSON, masked, no full session_id, no secrets).
  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Sprint 2 PR#11c poi-core-worker — fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
