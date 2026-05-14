#!/usr/bin/env tsx
/**
 * Sprint 2 PR#12d — POI Sequence Worker CLI.
 *
 * Manual-CLI batch trigger. Reads `poi_observations_v0_1`, groups
 * rows by session, builds durable POI Sequence records, UPSERTs them
 * into `poi_sequence_observations_v0_1`. Idempotent under the natural
 * key `(workspace_id, site_id, session_id, poi_sequence_version,
 * poi_observation_version)`.
 *
 * No customer-facing output. No Lane A/B writes. No Render production
 * deploy (A0 P-4 still blocking).
 *
 * Env (all optional except DATABASE_URL):
 *   DATABASE_URL                       required; never printed (host + db only)
 *   WORKSPACE_ID                       optional filter
 *   SITE_ID                            optional filter
 *   WINDOW_HOURS                       default 720 (30 days)
 *   SINCE / UNTIL                      ISO-8601 overrides
 *   WORKER_LIMIT                       default 50000
 *   SAMPLE_LIMIT                       default 10
 *   POI_SEQUENCE_VERSION               default 'poi-sequence-v0.1'
 *   POI_INPUT_VERSION                  default 'poi-core-input-v0.1'
 *   POI_OBSERVATION_VERSION            default 'poi-observation-v0.1'
 *   POI_OBSERVATIONS_TABLE_VERSION     default 'poi-observations-v0.1'
 *
 * Exit codes:
 *   0 — worker PASS (rows_inserted + rows_updated may be 0)
 *   1 — env-parsing / contract-guard / execution failure
 */

import 'dotenv/config';
import pg from 'pg';
import {
  parseDatabaseUrl,
  parsePoiSequenceWorkerEnvOptions,
  runPoiSequenceWorker,
} from '../src/scoring/poi-sequence-worker/index.js';

function fail(code: number, msg: string): never {
  process.stderr.write(`Sprint 2 PR#12d poi-sequence-worker — ${msg}\n`);
  process.exit(code);
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parsePoiSequenceWorkerEnvOptions();
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
    report = await runPoiSequenceWorker({
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

  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n');
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Sprint 2 PR#12d poi-sequence-worker — fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
