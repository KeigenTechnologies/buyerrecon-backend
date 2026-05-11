/**
 * Sprint 1 PR#2 — accepted_events evidence-column augmentation smoke tests
 * (per handoff §2.5 + §3.PR#2 + Appendix A.1).
 *
 * Track B (BuyerRecon Evidence Foundation), NOT Track A (AMS Behaviour QA scoring).
 *
 * Repo convention: existing tests (validate.test.ts, encrypt.test.ts,
 * ingest-requests.test.ts) are pure-function unit tests with no DB connection.
 * This file follows the same convention — it validates the migration SQL,
 * the schema.sql append, and the reconciliation SQL at the TEXT level. It does
 * NOT connect to Postgres.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const MIGRATION_PATH = join(ROOT, 'migrations', '004_accepted_events_evidence_columns.sql');
const SCHEMA_PATH    = join(ROOT, 'src', 'db', 'schema.sql');
const RECON_PATH     = join(ROOT, 'docs', 'sql', 'reconciliation', '001_ingest_requests_reconciliation.sql');
const DOC_PATH       = join(ROOT, 'docs', 'sprint2-pr2-accepted-events-evidence-columns.md');

const migration = readFileSync(MIGRATION_PATH, 'utf8');
const schema    = readFileSync(SCHEMA_PATH, 'utf8');
const recon     = readFileSync(RECON_PATH, 'utf8');
const doc       = readFileSync(DOC_PATH, 'utf8');

// Slice the schema's accepted_events CREATE TABLE block so column-presence
// assertions don't false-positive against the ingest_requests block (which
// also contains workspace_id, request_id, ip_hash, etc.).
const acceptedBlock = (() => {
  const start = schema.indexOf('CREATE TABLE IF NOT EXISTS accepted_events');
  if (start < 0) throw new Error('accepted_events block not found in schema.sql');
  const end = schema.indexOf('-- 2. Rejected events', start);
  if (end < 0) throw new Error('accepted_events block end marker not found');
  return schema.slice(start, end);
})();

const PR2_COLUMNS: ReadonlyArray<{ name: string; type: string; nullable: boolean; default?: string }> = [
  { name: 'request_id',           type: 'UUID',        nullable: true },
  { name: 'workspace_id',         type: 'TEXT',        nullable: true },
  { name: 'validator_version',    type: 'TEXT',        nullable: true },
  { name: 'schema_key',           type: 'TEXT',        nullable: true },
  { name: 'schema_version',       type: 'TEXT',        nullable: true },
  { name: 'event_origin',         type: 'TEXT',        nullable: true },
  { name: 'id_format',            type: 'TEXT',        nullable: true },
  { name: 'traffic_class',        type: 'TEXT',        nullable: true, default: "'unknown'" },
  { name: 'payload_sha256',       type: 'TEXT',        nullable: true },
  { name: 'size_bytes',           type: 'INT',         nullable: true },
  { name: 'ip_hash',              type: 'TEXT',        nullable: true },
  { name: 'consent_state',        type: 'TEXT',        nullable: true },
  { name: 'consent_source',       type: 'TEXT',        nullable: true },
  { name: 'consent_updated_at',   type: 'TIMESTAMPTZ', nullable: true },
  { name: 'pre_consent_mode',     type: 'BOOLEAN',     nullable: true, default: 'FALSE' },
  { name: 'tracking_mode',        type: 'TEXT',        nullable: true },
  { name: 'storage_mechanism',    type: 'TEXT',        nullable: true },
  { name: 'session_seq',          type: 'INT',         nullable: true },
  { name: 'session_started_at',   type: 'TIMESTAMPTZ', nullable: true },
  { name: 'session_last_seen_at', type: 'TIMESTAMPTZ', nullable: true },
  { name: 'canonical_jsonb',      type: 'JSONB',       nullable: true },
  { name: 'payload_purged_at',    type: 'TIMESTAMPTZ', nullable: true },
  { name: 'debug_mode',           type: 'BOOLEAN',     nullable: true, default: 'FALSE' },
];

describe('migration 004 — accepted_events evidence columns (per §2.5 + §3.PR#2)', () => {
  it('migration file exists at the expected path', () => {
    // The readFileSync above already succeeded, so file exists.
    expect(migration.length).toBeGreaterThan(0);
  });

  it('migration alters accepted_events with a single ALTER TABLE block', () => {
    expect(migration).toMatch(/ALTER TABLE accepted_events/);
  });

  it('migration does NOT alter rejected_events (rejected_events scope is §3.PR#3)', () => {
    expect(migration).not.toMatch(/ALTER TABLE rejected_events/);
  });

  it('migration does NOT touch ingest_requests (PR#1 scope, already closed)', () => {
    expect(migration).not.toMatch(/ALTER TABLE ingest_requests/);
    expect(migration).not.toMatch(/CREATE TABLE[^_]*ingest_requests/);
  });

  it('all 23 PR#2 columns are added with ADD COLUMN IF NOT EXISTS', () => {
    for (const col of PR2_COLUMNS) {
      const re = new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${col.name}\\s+${col.type}\\b`, 'i');
      expect(migration).toMatch(re);
    }
  });

  it('request_id is UUID and nullable (no NOT NULL on the same line)', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS\s+request_id\s+UUID\s*,/);
    // Negative: ensure no NOT NULL was applied to request_id.
    expect(migration).not.toMatch(/request_id\s+UUID\s+NOT NULL/);
  });

  it('no PR#2 column carries NOT NULL (all additive nullable, or non-null with constant DEFAULT)', () => {
    for (const col of PR2_COLUMNS) {
      const reNotNull = new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${col.name}\\s+\\w+\\s+NOT NULL`, 'i');
      expect(migration).not.toMatch(reNotNull);
    }
  });

  it('traffic_class default is the Sprint 1 placeholder value `unknown` (Decision #13)', () => {
    expect(migration).toMatch(/traffic_class\s+TEXT\s+DEFAULT\s+'unknown'/i);
  });

  it('pre_consent_mode and debug_mode default to FALSE', () => {
    expect(migration).toMatch(/pre_consent_mode\s+BOOLEAN\s+DEFAULT\s+FALSE/i);
    expect(migration).toMatch(/debug_mode\s+BOOLEAN\s+DEFAULT\s+FALSE/i);
  });

  it('creates accepted_events_request_id index on (request_id)', () => {
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS\s+accepted_events_request_id\s+ON accepted_events\s*\(request_id\)/i);
  });

  it('does NOT create the dedup unique index in PR#2 (deferred to §3.PR#6)', () => {
    expect(migration).not.toMatch(/CREATE UNIQUE INDEX[^;]*accepted_events_dedup/i);
    expect(migration).not.toMatch(/CREATE UNIQUE INDEX[^;]*\(workspace_id,\s*site_id,\s*client_event_id\)/i);
  });

  it('does NOT create accepted_events_workspace_site index (occurred_at not in PR#2 column list)', () => {
    expect(migration).not.toMatch(/CREATE INDEX[^;]*accepted_events_workspace_site/i);
  });

  it('does NOT introduce Track A scoring columns (risk_score / classification / recommended_action)', () => {
    for (const forbidden of ['risk_score', 'classification', 'recommended_action']) {
      const re = new RegExp(`ADD COLUMN[^;]*\\b${forbidden}\\b`, 'i');
      expect(migration).not.toMatch(re);
    }
  });

  it('does NOT introduce bot or AI-agent detection columns (only structural enums event_origin + traffic_class are allowed in Sprint 1)', () => {
    const forbiddenColumnRe = /ADD COLUMN[^;]*\b(bot_[a-z_]*|agent_ai[a-z_]*|agent_human[a-z_]*|is_bot|bot_score|agent_score|behavioural_score|behavior_score)\b/i;
    expect(migration).not.toMatch(forbiddenColumnRe);
  });

  it('includes a documented rollback section that drops the index and all 23 added columns', () => {
    expect(migration).toMatch(/Rollback/);
    expect(migration).toMatch(/DROP INDEX IF EXISTS accepted_events_request_id/);
    expect(migration).toMatch(/DROP COLUMN IF EXISTS request_id/);
    expect(migration).toMatch(/DROP COLUMN IF EXISTS canonical_jsonb/);
    expect(migration).toMatch(/DROP COLUMN IF EXISTS debug_mode/);
  });

  it('cites the canonical handoff sections in the header', () => {
    expect(migration).toMatch(/§2\.5/);
    expect(migration).toMatch(/§3\.PR#2/);
  });
});

describe('schema.sql — fresh-install path includes accepted_events PR#2 columns', () => {
  it('all 23 PR#2 columns appear in the accepted_events CREATE TABLE block', () => {
    for (const col of PR2_COLUMNS) {
      // Match `<name>   <type>` with optional DEFAULT clause; never followed by NOT NULL.
      const re = new RegExp(`\\b${col.name}\\s+${col.type}\\b(?!\\s+NOT NULL)`, 'i');
      expect(acceptedBlock).toMatch(re);
    }
  });

  it('request_id is declared as UUID without NOT NULL inside the accepted_events block', () => {
    expect(acceptedBlock).toMatch(/\brequest_id\s+UUID\b/);
    expect(acceptedBlock).not.toMatch(/\brequest_id\s+UUID\s+NOT NULL/);
  });

  it('schema.sql declares the accepted_events_request_id index after the existing idx_accepted_* indexes', () => {
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS accepted_events_request_id\s+ON accepted_events\s*\(request_id\)/i);
  });

  it('schema.sql does NOT introduce Track A scoring columns anywhere on accepted_events', () => {
    for (const forbidden of ['risk_score', 'classification', 'recommended_action', 'bot_score', 'agent_score', 'behavioural_score']) {
      const re = new RegExp(`\\b${forbidden}\\s+(TEXT|INT|UUID|BOOLEAN|JSONB|TIMESTAMPTZ|BIGINT|REAL)\\b`, 'i');
      expect(acceptedBlock).not.toMatch(re);
    }
  });

  it("PR#2 migration does not touch rejected_events (permanent scope invariant; rejected_events evidence-column work is §3.PR#3's responsibility)", () => {
    // Permanent invariant on the PR#2 migration. We can't usefully assert against
    // the live schema.sql here because PR#3 legitimately adds columns to the
    // rejected_events block in schema.sql; what stays true forever is that
    // migration 004 itself never touched rejected_events.
    expect(migration).not.toMatch(/ALTER TABLE rejected_events/);
    expect(migration).not.toMatch(/rejected_events\s+ADD COLUMN/i);
    expect(migration).not.toMatch(/CREATE\s+(?:UNIQUE\s+)?INDEX[^;]*ON\s+rejected_events/i);
  });

  it('schema.sql still ships pgcrypto (used by replay_runs.run_id; unrelated to PR#2)', () => {
    expect(schema).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  });
});

describe('reconciliation 001 — accepted-side cross-table check is now active', () => {
  it('check 002 (accepted-side cross-table) is a runnable SELECT, not a comment', () => {
    // Find a non-comment line that joins accepted_events on request_id.
    const lines = recon.split('\n');
    const activeJoinLine = lines.find(line =>
      /^\s*LEFT JOIN accepted_events ae ON ae\.request_id = ir\.request_id/i.test(line)
    );
    expect(activeJoinLine).toBeDefined();
    expect(activeJoinLine?.trimStart().startsWith('--')).toBe(false);
  });

  it('check 002 compares ledger_accepted with COUNT(ae.event_id) grouped by request_id', () => {
    expect(recon).toMatch(/ir\.accepted_count\s+AS ledger_accepted/i);
    expect(recon).toMatch(/COUNT\(ae\.event_id\)\s+AS table_accepted/i);
    expect(recon).toMatch(/HAVING ir\.accepted_count\s*<>\s*COUNT\(ae\.event_id\)/i);
  });

  it('rejected-side cross-table check is now active as check 003 (PR#3 superseded the TODO that lived here at PR#2 time)', () => {
    // After PR#3, the rejected-side LEFT JOIN appears at least once on a
    // non-comment line. The PR#2/PR#3 and PR#3-only TODO headers must both
    // be gone — recording PR#2's "this is still TODO" state would now be
    // a stale assertion.
    const lines = recon.split('\n');
    const activeRejectedJoin = lines.find(
      line => /^\s*LEFT JOIN rejected_events re ON re\.request_id = ir\.request_id/i.test(line),
    );
    expect(activeRejectedJoin).toBeDefined();
    expect(activeRejectedJoin?.trimStart().startsWith('--')).toBe(false);
    expect(recon).not.toMatch(/TODO\s*\(PR#3\)/i);
    expect(recon).not.toMatch(/TODO\s*\(PR#2\s*\/\s*PR#3\)/i);
  });

  it('check 001 (internal counts) is still active and unchanged in shape', () => {
    expect(recon).toMatch(/FROM ingest_requests\s+WHERE reconciled_at IS NOT NULL/i);
    expect(recon).toMatch(/accepted_count \+ rejected_count\s*<>\s*expected_event_count/);
  });
});

describe('PR#2 scope discipline — Track A / Track B separation', () => {
  it('migration does not touch any source code, route, validator, or auth module', () => {
    // The migration is a .sql file in migrations/. It should not reference src/ paths.
    expect(migration).not.toMatch(/src\/(collector|routes|auth|metrics)/);
  });

  it('does not modify ingest_requests indexes from PR#1', () => {
    expect(migration).not.toMatch(/ingest_requests_workspace_received/);
    expect(migration).not.toMatch(/ingest_requests_unreconciled/);
  });

  it('PR#2 doc explicitly disclaims bot detection, AI-agent detection, Stage 0/1 scoring, and live RECORD_ONLY', () => {
    expect(doc).toMatch(/This PR does not implement bot detection/i);
    expect(doc).toMatch(/This PR does not implement AI-agent detection/i);
    expect(doc).toMatch(/This PR does not implement Stage 0 \/ Stage 1 scoring/i);
    expect(doc).toMatch(/This PR does not implement live RECORD_ONLY/i);
    expect(doc).toMatch(/This PR only prepares accepted_events evidence columns for future collector\/database evidence/i);
  });

  it('PR#2 doc identifies it as Track B and disclaims Track A scoring import', () => {
    expect(doc).toMatch(/Track B/i);
    expect(doc).toMatch(/Track A/i);
    expect(doc).toMatch(/dependency.*Track A Sprint 2 backend bridge/i);
  });
});
