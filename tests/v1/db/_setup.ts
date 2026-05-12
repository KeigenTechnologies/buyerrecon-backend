/**
 * Sprint 1 PR#8 — shared DB test setup (Track B).
 *
 * NOT picked up by default `npm test` (filename does not match the `.test.ts`
 * include glob). Imported only by `*.dbtest.ts` files which run under
 * `npm run test:db:v1`.
 *
 * Responsibilities:
 *   - Resolve TEST_DATABASE_URL; throw a clear error if missing.
 *   - Refuse to run against production-shaped URLs.
 *   - Apply src/db/schema.sql (idempotent).
 *   - Apply migrations/007_accepted_events_dedup_index.sql as a single-statement
 *     query OUTSIDE any transaction (CREATE INDEX CONCURRENTLY constraint).
 *   - Provide a deterministic test boundary (workspace_id / site_id / token)
 *     that production code never produces.
 *   - Seed / clean up the test boundary between tests.
 *   - Spin a real Express app with the real createV1Router on an ephemeral
 *     port — same wiring as src/server.ts, but without importing it (so the
 *     test app does not require production env vars).
 *
 * Not Track A scoring. Not Core AMS product code.
 */

import { readFileSync } from 'fs';
import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import { join } from 'path';
import pg from 'pg';
import { hashSiteWriteToken } from '../../../src/auth/workspace.js';
import type { CollectorConfig } from '../../../src/collector/v1/orchestrator.js';
import { VALIDATOR_VERSION } from '../../../src/collector/v1/index.js';
import type { LoadedV1Config } from '../../../src/collector/v1/config.js';
import { createApp } from '../../../src/app.js';

const ROOT = join(__dirname, '..', '..', '..');
const SCHEMA_PATH = join(ROOT, 'src', 'db', 'schema.sql');
const MIGRATION_007_PATH = join(
  ROOT,
  'migrations',
  '007_accepted_events_dedup_index.sql',
);
// PR#2 (Sprint 2) — additive refresh-loop columns on
// session_behavioural_features_v0_2. `ADD COLUMN IF NOT EXISTS` makes this
// idempotent for test DBs that already hold the PR#1 baseline schema.
const MIGRATION_010_PATH = join(
  ROOT,
  'migrations',
  '010_session_behavioural_features_v0_2_refresh_loop.sql',
);
// PR#3 (Sprint 2) — Lane A / Lane B scoring output contract tables.
// Schema-only: tables + role grants + Hard Rule I assertion. No writer.
// Migration 011 asserts the four canonical roles exist; the test
// bootstrap below pre-creates them in the test environment so the
// migration's role-existence guard passes.
const MIGRATION_011_PATH = join(
  ROOT,
  'migrations',
  '011_scoring_output_lanes.sql',
);
// PR#5 (Sprint 2) — Stage 0 RECORD_ONLY decisions table.
// New table; mirrors PR#3 role-existence + Hard-Rule-I-style guard.
const MIGRATION_012_PATH = join(
  ROOT,
  'migrations',
  '012_stage0_decisions.sql',
);

/* --------------------------------------------------------------------------
 * Deterministic test boundary constants
 * ------------------------------------------------------------------------ */

export const TEST_WORKSPACE_ID = '__test_ws_pr8__';
export const TEST_SITE_ID = '__test_site_pr8__';
export const TEST_TOKEN = 'test-token-pr8';
export const TEST_TOKEN_ID = '00000000-0000-4000-8000-0000000000a1';
export const TEST_DISABLED_TOKEN = 'test-disabled-token-pr8';
export const TEST_DISABLED_TOKEN_ID = '00000000-0000-4000-8000-0000000000a2';
export const TEST_SITE_WRITE_TOKEN_PEPPER = 'test-site-pepper-pr8';
export const TEST_IP_HASH_PEPPER = 'test-ip-pepper-pr8';
export const TEST_COLLECTOR_VERSION = 'pr8-test';
export const TEST_EVENT_CONTRACT_VERSION = 'event-contract-v0.1';

/* --------------------------------------------------------------------------
 * Env guards
 * ------------------------------------------------------------------------ */

export function requireTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.TEST_DATABASE_URL;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error(
      'PR#8 DB tests require TEST_DATABASE_URL — see docs/sprint2-pr8-db-verification.md',
    );
  }
  return url;
}

/**
 * Refuse to run against production-shaped URLs. The guard is intentionally
 * conservative: developer mistakes (pointing TEST_DATABASE_URL at the real DB)
 * are the most likely failure mode, not malicious bypass. Documented as
 * non-airtight; operator discipline is the primary safeguard.
 */
export function assertNotProduction(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('assertNotProduction: TEST_DATABASE_URL missing or empty');
  }
  if (env.DATABASE_URL !== undefined && env.DATABASE_URL === url) {
    throw new Error(
      'assertNotProduction: TEST_DATABASE_URL must NOT equal DATABASE_URL — refusing to run',
    );
  }
  if (/prod/i.test(url)) {
    throw new Error(
      'assertNotProduction: TEST_DATABASE_URL contains "prod" — refusing to run',
    );
  }
  // Allow localhost / 127.0.0.1 unconditionally. Allow staging-shaped URLs
  // only when the operator explicitly opts in via ALLOW_STAGING_DB=true.
  const isLocal = /(localhost|127\.0\.0\.1)/i.test(url);
  const looksLikeTestUrl = /(test|staging)/i.test(url);
  if (!isLocal && !looksLikeTestUrl && env.ALLOW_STAGING_DB !== 'true') {
    throw new Error(
      'assertNotProduction: TEST_DATABASE_URL must be local (localhost / 127.0.0.1) ' +
        'or contain "test"/"staging" — set ALLOW_STAGING_DB=true to bypass for an ' +
        'explicit staging URL',
    );
  }
}

/* --------------------------------------------------------------------------
 * Pool acquisition + schema/migration setup
 * ------------------------------------------------------------------------ */

export function getTestPool(env: NodeJS.ProcessEnv = process.env): pg.Pool {
  const url = requireTestDatabaseUrl(env);
  assertNotProduction(url, env);
  return new pg.Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 5000,
  });
}

/**
 * Apply src/db/schema.sql to the test DB. Idempotent — every CREATE in
 * schema.sql uses IF NOT EXISTS. Multi-statement query, exactly as
 * src/db/client.ts initDb() does for boot.
 */
export async function ensureSchema(pool: pg.Pool): Promise<void> {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(schema);
}

/**
 * Apply migrations/007_accepted_events_dedup_index.sql.
 *
 * CREATE INDEX CONCURRENTLY cannot run inside a transaction block. pg sends
 * a single-statement string in simple-query mode, NOT wrapped in an implicit
 * transaction, so this works. Idempotent — IF NOT EXISTS in the migration.
 *
 * If a prior failed build left an INVALID index, the operator must DROP it
 * before re-running this. verifyAcceptedEventsDedupValid surfaces that case.
 */
export async function applyMigration007(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(MIGRATION_007_PATH, 'utf8');
  await pool.query(sql);
}

/**
 * Apply migrations/010 — PR#2 refresh-loop additive columns.
 *
 * Idempotent (`ADD COLUMN IF NOT EXISTS`, `DO` blocks guard CHECK
 * constraints). Safe to call when the table is fresh from schema.sql
 * (already has the columns) or carried over from a prior PR#1 test run.
 */
export async function applyMigration010(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(MIGRATION_010_PATH, 'utf8');
  await pool.query(sql);
}

/**
 * Test-environment ONLY: ensure the four PR#3 canonical group roles
 * exist before migration 011 runs its role-presence assertion.
 *
 * IMPORTANT: this helper exists because the test bootstrap is a
 * test-only fixture, NOT production migration code. The roles are
 * NOLOGIN group roles with no passwords. This helper is the test-side
 * equivalent of docs/ops/pr3-db-role-setup-staging.md Phase 3 (which
 * is the operator action on real environments).
 *
 * Migration 011 itself is FORBIDDEN from running CREATE ROLE. The
 * separation is deliberate: the migration models the production
 * contract where roles pre-exist (per OD-8); the bootstrap pretends
 * they have been pre-created.
 *
 * Postgres has no native CREATE ROLE IF NOT EXISTS, so each statement
 * is wrapped in a DO block that catches duplicate_object.
 */
export async function ensureCanonicalRolesForTests(pool: pg.Pool): Promise<void> {
  const sql = `
    DO $$ BEGIN
      CREATE ROLE buyerrecon_migrator NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE ROLE buyerrecon_scoring_worker NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE ROLE buyerrecon_customer_api NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE ROLE buyerrecon_internal_readonly NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `;
  await pool.query(sql);
}

/**
 * Apply migrations/011 — PR#3 Lane A / Lane B scoring output contract
 * tables + role grants + Hard Rule I assertion.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS, role-existence DO/RAISE
 * guards, REVOKE/GRANT are safe to re-run. Calling this twice succeeds.
 *
 * Prerequisite: ensureCanonicalRolesForTests(pool) must have run, or
 * the migration's role-presence assertion will RAISE EXCEPTION and
 * fail this call (which is the intended behaviour in production —
 * here we satisfy it via the test-only role helper above).
 */
export async function applyMigration011(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(MIGRATION_011_PATH, 'utf8');
  await pool.query(sql);
}

/**
 * Apply migrations/012 — PR#5 Stage 0 RECORD_ONLY decisions table.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS, REVOKE/GRANT are safe to
 * re-run. Prerequisite: the four canonical group roles already exist
 * (ensureCanonicalRolesForTests pre-creates them in tests).
 */
export async function applyMigration012(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(MIGRATION_012_PATH, 'utf8');
  await pool.query(sql);
}

export interface DedupIndexState {
  exists: boolean;
  is_unique: boolean;
  is_valid: boolean;
  indexdef: string | null;
}

/**
 * Read pg_index/pg_indexes state for accepted_events_dedup. Returns a small
 * shape that the index-validity test asserts against.
 */
export async function verifyAcceptedEventsDedupValid(
  pool: pg.Pool,
): Promise<DedupIndexState> {
  const result = await pool.query<{
    indexname: string;
    indisunique: boolean;
    indisvalid: boolean;
    indexdef: string;
  }>(
    `SELECT i.indexname,
            ix.indisunique,
            ix.indisvalid,
            pg_get_indexdef(ix.indexrelid) AS indexdef
       FROM pg_indexes i
       JOIN pg_class c   ON c.relname = i.indexname
       JOIN pg_index ix  ON ix.indexrelid = c.oid
      WHERE i.schemaname = 'public'
        AND i.indexname  = 'accepted_events_dedup'`,
  );
  if (result.rowCount === 0 || !result.rows[0]) {
    return { exists: false, is_unique: false, is_valid: false, indexdef: null };
  }
  const row = result.rows[0];
  return {
    exists: true,
    is_unique: row.indisunique === true,
    is_valid: row.indisvalid === true,
    indexdef: row.indexdef,
  };
}

/* --------------------------------------------------------------------------
 * Test-boundary cleanup + seeding
 * ------------------------------------------------------------------------ */

/**
 * Remove every row created by prior runs under the deterministic test
 * boundary. Safe to re-run. Does NOT touch rows outside this boundary.
 */
export async function cleanupTestBoundary(pool: pg.Pool): Promise<void> {
  await pool.query('DELETE FROM accepted_events WHERE workspace_id = $1', [
    TEST_WORKSPACE_ID,
  ]);
  await pool.query('DELETE FROM rejected_events WHERE workspace_id = $1', [
    TEST_WORKSPACE_ID,
  ]);
  await pool.query('DELETE FROM ingest_requests WHERE workspace_id = $1', [
    TEST_WORKSPACE_ID,
  ]);
  await pool.query(
    'DELETE FROM site_write_tokens WHERE token_id IN ($1, $2)',
    [TEST_TOKEN_ID, TEST_DISABLED_TOKEN_ID],
  );
}

/**
 * Insert a single active site_write_tokens row for the test boundary.
 * Recomputes token_hash with the test pepper so resolveSiteWriteToken matches.
 * `last_used_at` starts null so the touch-test has a clean before-state.
 */
export async function seedTestToken(pool: pg.Pool): Promise<void> {
  const tokenHash = hashSiteWriteToken(TEST_TOKEN, TEST_SITE_WRITE_TOKEN_PEPPER);
  await pool.query(
    `INSERT INTO site_write_tokens
       (token_id, token_hash, workspace_id, site_id, label, created_at, disabled_at, last_used_at)
     VALUES ($1, $2, $3, $4, 'pr8-test', NOW(), NULL, NULL)`,
    [TEST_TOKEN_ID, tokenHash, TEST_WORKSPACE_ID, TEST_SITE_ID],
  );
}

/** Same as seedTestToken but inserts a row with disabled_at set in the past. */
export async function seedDisabledToken(pool: pg.Pool): Promise<void> {
  const tokenHash = hashSiteWriteToken(
    TEST_DISABLED_TOKEN,
    TEST_SITE_WRITE_TOKEN_PEPPER,
  );
  await pool.query(
    `INSERT INTO site_write_tokens
       (token_id, token_hash, workspace_id, site_id, label, created_at, disabled_at, last_used_at)
     VALUES ($1, $2, $3, $4, 'pr8-test-disabled', NOW(), NOW(), NULL)`,
    [TEST_DISABLED_TOKEN_ID, tokenHash, TEST_WORKSPACE_ID, TEST_SITE_ID],
  );
}

/* --------------------------------------------------------------------------
 * Real Express test app — mirrors src/server.ts wiring, does NOT import it
 * ------------------------------------------------------------------------ */

export interface StartV1TestAppOpts {
  enable_v1_batch?: boolean;
  /**
   * PR#8b — explicit CORS allow-list passed to createApp. Default `[]` means
   * same-origin / no-Origin-header requests pass through (which is what
   * fetch-from-Node looks like to the server). Cross-origin preflight tests
   * should pass `['https://example.com']` (or similar) and send an Origin
   * header matching one of the listed values.
   */
  allowed_origins?: string[];
  /**
   * Back-compat shim from the pre-PR#8b inline-app path. Currently unused
   * after the createApp refactor; left in place so existing test call-sites
   * keep compiling. Prefer `allowed_origins` directly.
   */
  mount_cors?: boolean;
}

export interface V1TestApp {
  server: Server;
  baseUrl: string;
}

/**
 * Construct a fresh Express app via the same createApp factory that prod
 * boot uses (PR#8b). Listens on an ephemeral port; returns the server +
 * baseUrl pair for fetch-driven tests.
 *
 * `opts.mount_cors` is retained for back-compat — when true, the test runs
 * with a wide-open allow-list ('*' equivalent) so any Origin header passes.
 * Newer tests should prefer the explicit `allowed_origins` opt instead.
 */
export async function startV1TestApp(
  pool: pg.Pool,
  opts: StartV1TestAppOpts = {},
): Promise<V1TestApp> {
  const config: CollectorConfig = {
    collector_version: TEST_COLLECTOR_VERSION,
    validator_version: VALIDATOR_VERSION,
    event_contract_version: TEST_EVENT_CONTRACT_VERSION,
    ip_hash_pepper: TEST_IP_HASH_PEPPER,
    allow_consent_state_summary: false,
  };

  const v1Loaded: LoadedV1Config = {
    config,
    site_write_token_pepper: TEST_SITE_WRITE_TOKEN_PEPPER,
    enable_v1_batch: opts.enable_v1_batch ?? false,
  };

  // Build the same Express app the prod entrypoint builds — through
  // createApp(...). Tests do NOT import src/server.ts (which would call
  // start() at module load); they import src/app.ts directly.
  const allowed_origins = opts.allowed_origins ?? [];
  const app = createApp({
    pool,
    v1Loaded,
    allowed_origins,
    // Silence logs in tests — assertions inspect DB rows, not logs.
    log_error: () => {},
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

export async function stopV1TestApp(app: V1TestApp | undefined): Promise<void> {
  // Tolerates undefined so afterAll hooks don't double-fault when beforeAll
  // threw before assigning the app (e.g. missing TEST_DATABASE_URL).
  if (!app) return;
  await new Promise<void>((resolve) => app.server.close(() => resolve()));
}

/**
 * Close a pg.Pool safely. Same defensive pattern as stopV1TestApp.
 */
export async function endTestPool(pool: pg.Pool | undefined): Promise<void> {
  if (!pool) return;
  await pool.end();
}

/* --------------------------------------------------------------------------
 * Canonical valid-event fixture (matches orchestrator.test.ts shape)
 * ------------------------------------------------------------------------ */

export function makeValidEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    client_event_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    event_name: 'page_view',
    event_type: 'page',
    event_origin: 'browser',
    schema_key: 'br.page',
    schema_version: '1.0.0',
    // Dynamic occurred_at — stays inside the validator's R-5 (-24h, +5min)
    // window as the host clock moves forward. A hard-coded literal drifts
    // out of bounds after 24h and silently rejects every event.
    occurred_at: new Date(Date.now() - 60_000).toISOString(),
    session_id: 'sess_alpha',
    anonymous_id: 'a_alpha',
    page_url: 'https://example.com/p',
    page_path: '/p',
    consent_state: 'granted',
    consent_source: 'cmp',
    tracking_mode: 'full',
    storage_mechanism: 'cookie',
    ...overrides,
  };
}

/**
 * One-shot helper: full setup in the right order. beforeAll-friendly.
 *   1. assertNotProduction
 *   2. ensureSchema
 *   3. applyMigration007
 *   4. verifyAcceptedEventsDedupValid — assert indisvalid=true
 *   5. cleanupTestBoundary
 *   6. seedTestToken
 *
 * The caller still calls cleanupTestBoundary() + seedTestToken() in
 * beforeEach so each test starts clean.
 */
export async function bootstrapTestDb(pool: pg.Pool): Promise<void> {
  await ensureSchema(pool);
  await applyMigration007(pool);
  await applyMigration010(pool);
  // PR#3 test-environment role pre-creation, then schema-only migration.
  // Order matters: migration 011 asserts role presence and aborts if
  // any of the four canonical group roles is missing.
  await ensureCanonicalRolesForTests(pool);
  await applyMigration011(pool);
  // PR#5 — Stage 0 decisions table (additive; same role-existence guard).
  await applyMigration012(pool);
  const state = await verifyAcceptedEventsDedupValid(pool);
  if (!state.exists) {
    throw new Error(
      'bootstrapTestDb: accepted_events_dedup not created — migration 007 did not apply',
    );
  }
  if (!state.is_valid) {
    throw new Error(
      'bootstrapTestDb: accepted_events_dedup exists but indisvalid=false — ' +
        'DROP INDEX CONCURRENTLY IF EXISTS accepted_events_dedup, then retry',
    );
  }
  await cleanupTestBoundary(pool);
  await seedTestToken(pool);
}
