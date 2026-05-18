/**
 * Sprint 1 PR#8b — Node entrypoint.
 *
 * This file runs only when invoked as the Node entry script (e.g.
 * `node dist/server.js` or `tsx src/server.ts`). All Express wiring lives
 * in src/app.ts via createApp(...); tests import that module directly and
 * therefore do not need this entrypoint's env contract.
 *
 * Env contract (boot-only):
 *   - dotenv populates process.env from .env at module top (side-effect import).
 *   - loadV1ConfigFromEnv() is now called INSIDE start(), no longer at module top.
 *     Missing required peppers still fail-fast via start().catch → process.exit(1).
 */

import 'dotenv/config';
import pool, { initDb, shouldSkipDbInit } from './db/client.js';
import { loadV1ConfigFromEnv } from './collector/v1/config.js';
import { createApp } from './app.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const allowed_origins = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);

async function start() {
  const v1Loaded = loadV1ConfigFromEnv();
  // Sprint 2 PR#17k — production-safe skip. Production runtime roles are
  // intentionally non-DDL (per PR#17f / PR#17h); the production schema
  // lifecycle is operator-managed (baseline + migrations 002–016). When
  // SKIP_DB_INIT=true, do not run schema.sql DDL through the runtime role.
  if (shouldSkipDbInit()) {
    console.log('Database schema bootstrap skipped by SKIP_DB_INIT=true');
  } else {
    await initDb();
  }
  const app = createApp({ pool, v1Loaded, allowed_origins });
  app.listen(PORT, () => console.log(`br-collector listening on :${PORT}`));
}

start().catch((err) => { console.error('Failed to start:', err); process.exit(1); });
