/**
 * Sprint 1 PR#1 — ingest_requests ledger smoke tests (per handoff §2.7 + §3.PR#1).
 *
 * Repo convention: existing tests (validate.test.ts, encrypt.test.ts) are
 * pure-function unit tests with no DB connection. This file follows the
 * same convention — it validates the migration SQL, the schema.sql append,
 * and the reconciliation SQL at the TEXT level. It does NOT connect to
 * Postgres.
 *
 * To verify the migration end-to-end against a local Postgres dev DB:
 *   psql "$DATABASE_URL" -f migrations/003_ingest_requests.sql
 *   psql "$DATABASE_URL" -c '\d ingest_requests'
 * The handoff §3.PR#1 acceptance is: "DDL applies cleanly on staging clone;
 * \d ingest_requests matches §2.7 shape, including request_body_sha256
 * column." (Run on a local dev clone; never on production.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const MIGRATION_PATH = join(ROOT, 'migrations', '003_ingest_requests.sql');
const SCHEMA_PATH    = join(ROOT, 'src', 'db', 'schema.sql');
const RECON_PATH     = join(ROOT, 'docs', 'sql', 'reconciliation', '001_ingest_requests_reconciliation.sql');

const migration = readFileSync(MIGRATION_PATH, 'utf8');
const schema    = readFileSync(SCHEMA_PATH, 'utf8');
const recon     = readFileSync(RECON_PATH, 'utf8');

describe('migration 003 — ingest_requests per §2.7', () => {
  it('creates the ingest_requests table (idempotent)', () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS ingest_requests/);
  });

  it('declares request_id as a UUID PRIMARY KEY (no DB default; collector generates)', () => {
    expect(migration).toMatch(/request_id\s+UUID PRIMARY KEY(?!\s+DEFAULT)/);
  });

  it('declares received_at NOT NULL with NOW() default', () => {
    expect(migration).toMatch(/received_at\s+TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
  });

  it('declares workspace_id and site_id as nullable TEXT (auth-derived in §3.PR#4)', () => {
    expect(migration).toMatch(/workspace_id\s+TEXT,/);
    expect(migration).toMatch(/site_id\s+TEXT,/);
  });

  it('declares endpoint NOT NULL TEXT', () => {
    expect(migration).toMatch(/endpoint\s+TEXT NOT NULL/);
  });

  it('declares http_status INT (nullable per §2.7)', () => {
    // Must be present, must NOT carry NOT NULL on the same line.
    expect(migration).toMatch(/http_status\s+INT(?!\s+NOT NULL)/);
  });

  it('declares size_bytes NOT NULL INT (per §2.7)', () => {
    expect(migration).toMatch(/size_bytes\s+INT NOT NULL/);
  });

  it('declares user_agent TEXT (nullable per §2.7)', () => {
    expect(migration).toMatch(/user_agent\s+TEXT(?!\s+NOT NULL)/);
  });

  it('declares ip_hash TEXT NOT NULL (per §2.7)', () => {
    expect(migration).toMatch(/ip_hash\s+TEXT NOT NULL/);
  });

  it('declares request_body_sha256 TEXT NOT NULL (per §2.7 + §3.PR#1 acceptance)', () => {
    // §3.PR#1 acceptance literally says "including request_body_sha256 column".
    expect(migration).toMatch(/request_body_sha256\s+TEXT NOT NULL/);
  });

  it('declares expected_event_count INT NOT NULL (no DB default per §2.7)', () => {
    // §2.7 has NO DEFAULT on expected_event_count — collector sets it explicitly.
    expect(migration).toMatch(/expected_event_count\s+INT NOT NULL(?!\s+DEFAULT)/);
  });

  it('declares accepted_count and rejected_count NOT NULL DEFAULT 0', () => {
    expect(migration).toMatch(/accepted_count\s+INT NOT NULL DEFAULT 0/);
    expect(migration).toMatch(/rejected_count\s+INT NOT NULL DEFAULT 0/);
  });

  it('declares reconciled_at TIMESTAMPTZ (nullable; partial-index sentinel)', () => {
    expect(migration).toMatch(/reconciled_at\s+TIMESTAMPTZ(?!\s+NOT NULL)/);
  });

  it('declares auth_status TEXT NOT NULL (per §2.7; DB CHECK enum deferred per §2.9)', () => {
    expect(migration).toMatch(/auth_status\s+TEXT NOT NULL/);
    // §2.7 documents the allowed values; verify the comment captures all four.
    for (const value of ['ok', 'invalid_token', 'site_disabled', 'boundary_mismatch']) {
      expect(migration).toContain(value);
    }
  });

  it('declares reject_reason_code TEXT (nullable; only set on request-level reject)', () => {
    expect(migration).toMatch(/reject_reason_code\s+TEXT(?!\s+NOT NULL)/);
  });

  it('declares collector_version TEXT NOT NULL', () => {
    expect(migration).toMatch(/collector_version\s+TEXT NOT NULL/);
  });

  it('does NOT enforce the reconciliation invariant as a table CHECK constraint (§2.7 places enforcement on §2.12 SQL suite)', () => {
    expect(migration).not.toMatch(/CHECK\s*\(\s*accepted_count\s*\+\s*rejected_count/);
    expect(migration).not.toMatch(/CONSTRAINT chk_ingest_requests/);
  });

  it('does NOT introduce a DB CHECK enum on auth_status or any other field (per §2.9 closing note)', () => {
    // No CHECK (... IN (...)) clauses in this migration — DB CHECK promotion is deferred to Sprint 2+.
    expect(migration).not.toMatch(/CHECK\s*\([^)]*IN\s*\(/);
  });

  it('does NOT introduce request_status, method, completed_at, debug_mode, content_type, schema_version, validator_version, error_code, error_detail, created_at, updated_at (none of these are in §2.7)', () => {
    for (const field of [
      'request_status',
      /\bmethod\b/, // careful: do not match "method" inside HTTP description, but our DDL has no such word
      'completed_at',
      'debug_mode',
      'content_type',
      'schema_version',
      'validator_version',
      'error_code',
      'error_detail',
      'created_at',
      'updated_at',
    ]) {
      const pat = field instanceof RegExp ? field : new RegExp(`\\b${field}\\b`);
      expect(migration).not.toMatch(pat);
    }
  });

  it('creates ingest_requests_workspace_received on (workspace_id, site_id, received_at)', () => {
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS ingest_requests_workspace_received/);
    expect(migration).toMatch(/ON ingest_requests \(workspace_id, site_id, received_at\)/);
  });

  it('creates ingest_requests_unreconciled as a partial index on (received_at) WHERE reconciled_at IS NULL', () => {
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS ingest_requests_unreconciled/);
    expect(migration).toMatch(/ON ingest_requests \(received_at\)\s+WHERE reconciled_at IS NULL/);
  });

  it('does NOT create the legacy idx_ingest_requests_* indexes from the prior draft', () => {
    expect(migration).not.toMatch(/idx_ingest_requests_received_at/);
    expect(migration).not.toMatch(/idx_ingest_requests_workspace_site_received/);
    expect(migration).not.toMatch(/idx_ingest_requests_status_received/);
  });

  it('includes a documented rollback section that drops both indexes and the table', () => {
    expect(migration).toMatch(/Rollback/);
    expect(migration).toMatch(/DROP INDEX IF EXISTS ingest_requests_unreconciled/);
    expect(migration).toMatch(/DROP INDEX IF EXISTS ingest_requests_workspace_received/);
    expect(migration).toMatch(/DROP TABLE IF EXISTS ingest_requests/);
  });
});

describe('schema.sql — fresh-install path includes ingest_requests', () => {
  it('schema.sql contains the ingest_requests CREATE TABLE block (so initDb() picks it up on fresh installs)', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS ingest_requests/);
  });

  it('schema.sql ingest_requests block matches §2.7 column shape', () => {
    // Spot-check the columns most likely to drift (NOT NULL on critical evidence + reconciliation fields).
    expect(schema).toMatch(/request_id\s+UUID PRIMARY KEY(?!\s+DEFAULT)/);
    expect(schema).toMatch(/request_body_sha256\s+TEXT NOT NULL/);
    expect(schema).toMatch(/ip_hash\s+TEXT NOT NULL/);
    expect(schema).toMatch(/size_bytes\s+INT NOT NULL/);
    expect(schema).toMatch(/expected_event_count\s+INT NOT NULL/);
    expect(schema).toMatch(/auth_status\s+TEXT NOT NULL/);
    expect(schema).toMatch(/collector_version\s+TEXT NOT NULL/);
    expect(schema).toMatch(/reconciled_at\s+TIMESTAMPTZ/);
  });

  it('schema.sql still ships pgcrypto extension (used elsewhere by replay_runs)', () => {
    expect(schema).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  });

  it('schema.sql does NOT carry the prior draft request_status enum or chk_ingest_requests_count_sum', () => {
    // Make sure the realignment removed the legacy block.
    const ingestBlock = schema.split(/CREATE TABLE IF NOT EXISTS ingest_requests/)[1] ?? '';
    expect(ingestBlock).not.toMatch(/request_status/);
    expect(ingestBlock).not.toMatch(/chk_ingest_requests_count_sum/);
  });
});

describe('reconciliation 001 — internal-count check (§2.7 invariant)', () => {
  it('queries ingest_requests for unexplained counts on reconciled rows only', () => {
    expect(recon).toMatch(/FROM ingest_requests/);
    // §2.7: invariant holds "once reconciled_at is set" — the check must filter to those rows.
    expect(recon).toMatch(/reconciled_at IS NOT NULL/);
    expect(recon).toMatch(/accepted_count \+ rejected_count\s*<>\s*expected_event_count/);
  });

  it('rejected-side cross-table check is now active as check 003 (no longer TODO since §3.PR#3 landed rejected_events.request_id)', () => {
    // Negative: the prior PR#2/PR#3 and PR#3-only TODO headers must both be gone.
    expect(recon).not.toMatch(/TODO\s*\(PR#3\)/i);
    expect(recon).not.toMatch(/TODO\s*\(PR#2\s*\/\s*PR#3\)/i);
    // Positive: check 003 header must be present.
    expect(recon).toMatch(/Reconciliation check 003/i);
    // Positive: rejected-side LEFT JOIN must appear at least once on a non-comment line.
    const lines = recon.split('\n');
    const activeRejectedJoin = lines.find(
      line => /^\s*LEFT JOIN rejected_events re ON re\.request_id = ir\.request_id/i.test(line),
    );
    expect(activeRejectedJoin).toBeDefined();
    expect(activeRejectedJoin?.trimStart().startsWith('--')).toBe(false);
  });

  it('documents the local run command (psql against $DATABASE_URL)', () => {
    expect(recon).toMatch(/psql "\$DATABASE_URL"/);
  });
});

describe('PR#1 scope discipline (per §3.PR#1)', () => {
  it('does not ALTER existing tables — accepted_events / rejected_events are untouched', () => {
    expect(migration).not.toMatch(/ALTER TABLE accepted_events/);
    expect(migration).not.toMatch(/ALTER TABLE rejected_events/);
  });

  it('does not introduce columns named *bot*, *agent_ai*, *agent_human*, *traffic_class*, *risk_score*, *classification* (out-of-scope per §4.1 "Out of scope for Task 1")', () => {
    /* These would indicate bot-detection or AI-agent classification creeping
       into PR#1. Disclaimers in COMMENTS are allowed; positive column
       introductions are not. */
    const forbiddenColumnRe = /^\s*(bot_[a-z_]*|agent_ai[a-z_]*|agent_human[a-z_]*|traffic_class|risk_score|classification)\s+(TEXT|INT|UUID|BOOLEAN|JSONB|TIMESTAMPTZ|BIGINT)/im;
    expect(migration).not.toMatch(forbiddenColumnRe);
    expect(schema.split(/CREATE TABLE IF NOT EXISTS ingest_requests/)[1] ?? '')
      .not.toMatch(forbiddenColumnRe);
  });

  it('explicitly cites §2.7 and §3.PR#1 in the migration header so the contract is visible to reviewers', () => {
    expect(migration).toMatch(/§2\.7/);
    expect(migration).toMatch(/§3\.PR#1/);
  });
});
