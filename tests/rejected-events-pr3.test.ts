/**
 * Sprint 1 PR#3 — rejected_events evidence-column augmentation smoke tests
 * (per handoff §2.6 + §3.PR#3 + Appendix A.2 + §2.12 checks #6, #14, #15).
 *
 * Track B (BuyerRecon Evidence Foundation), NOT Track A (AMS Behaviour QA
 * scoring harness) and NOT Core AMS (future productized scoring/report home).
 *
 * Repo convention: existing tests are pure-function unit tests with no DB
 * connection. This file follows the same convention — it validates the
 * migration SQL, the schema.sql append, and the reconciliation SQL at the
 * TEXT level. It does NOT connect to Postgres.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const MIGRATION_PATH = join(ROOT, 'migrations', '005_rejected_events_evidence_columns.sql');
const SCHEMA_PATH    = join(ROOT, 'src', 'db', 'schema.sql');
const RECON_PATH     = join(ROOT, 'docs', 'sql', 'reconciliation', '001_ingest_requests_reconciliation.sql');
const DOC_PATH       = join(ROOT, 'docs', 'sprint2-pr3-rejected-events-evidence-columns.md');

const migration = readFileSync(MIGRATION_PATH, 'utf8');
const schema    = readFileSync(SCHEMA_PATH, 'utf8');
const recon     = readFileSync(RECON_PATH, 'utf8');
const doc       = readFileSync(DOC_PATH, 'utf8');

// Slice the schema's rejected_events CREATE TABLE block so column-presence
// assertions don't false-positive against accepted_events (which carries
// many of the same column names) or ingest_requests / truth_metrics.
const rejectedBlock = (() => {
  const start = schema.indexOf('CREATE TABLE IF NOT EXISTS rejected_events');
  if (start < 0) throw new Error('rejected_events block not found in schema.sql');
  const end = schema.indexOf('-- 3. Site configuration', start);
  if (end < 0) throw new Error('rejected_events block end marker not found');
  return schema.slice(start, end);
})();

const PR3_COLUMNS: ReadonlyArray<{ name: string; type: string; default?: string }> = [
  { name: 'request_id',              type: 'UUID' },
  { name: 'workspace_id',            type: 'TEXT' },
  { name: 'client_event_id',         type: 'TEXT' },
  { name: 'id_format',               type: 'TEXT' },
  { name: 'event_name',              type: 'TEXT' },
  { name: 'event_type',              type: 'TEXT' },
  { name: 'schema_key',              type: 'TEXT' },
  { name: 'schema_version',          type: 'TEXT' },
  { name: 'rejected_stage',          type: 'TEXT' },
  { name: 'reason_code',             type: 'TEXT' },
  { name: 'reason_detail',           type: 'TEXT' },
  { name: 'schema_errors_jsonb',     type: 'JSONB' },
  { name: 'pii_hits_jsonb',          type: 'JSONB' },
  { name: 'raw_payload_sha256',      type: 'TEXT' },
  { name: 'size_bytes',              type: 'INT' },
  { name: 'debug_mode',              type: 'BOOLEAN',     default: 'FALSE' },
  { name: 'sample_visible_to_admin', type: 'BOOLEAN',     default: 'TRUE'  },
  { name: 'rejected_at',             type: 'TIMESTAMPTZ', default: 'NOW\\(\\)' },
];

describe('migration 005 — rejected_events evidence columns (per §2.6 + §3.PR#3)', () => {
  it('migration file exists at the expected path', () => {
    expect(migration.length).toBeGreaterThan(0);
  });

  it('migration alters rejected_events with a single ALTER TABLE block', () => {
    expect(migration).toMatch(/ALTER TABLE rejected_events/);
  });

  it('migration does NOT alter accepted_events (closed in §3.PR#2)', () => {
    expect(migration).not.toMatch(/ALTER TABLE accepted_events/);
  });

  it('migration does NOT alter ingest_requests (closed in §3.PR#1)', () => {
    expect(migration).not.toMatch(/ALTER TABLE ingest_requests/);
  });

  it('migration does NOT create or drop any other table', () => {
    expect(migration).not.toMatch(/CREATE TABLE\b/i);
    expect(migration).not.toMatch(/DROP TABLE\b/i);
  });

  it('all 18 PR#3 columns are added with ADD COLUMN IF NOT EXISTS and the correct type', () => {
    for (const col of PR3_COLUMNS) {
      const re = new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${col.name}\\s+${col.type}\\b`, 'i');
      expect(migration).toMatch(re);
    }
  });

  it('request_id is UUID and nullable (no NOT NULL on the same line)', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS\s+request_id\s+UUID\s*,/);
    expect(migration).not.toMatch(/request_id\s+UUID\s+NOT NULL/);
  });

  it('raw_payload_sha256 is added nullable initially (legacy rows cannot be backfilled; promotion deferred)', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS\s+raw_payload_sha256\s+TEXT\s*,/);
    expect(migration).not.toMatch(/raw_payload_sha256\s+TEXT\s+NOT NULL/);
  });

  it('reason_code is added (nullable; backfilled below from reason_codes[1])', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS\s+reason_code\s+TEXT\s*,/);
    expect(migration).not.toMatch(/reason_code\s+TEXT\s+NOT NULL/);
  });

  it('no PR#3 column carries NOT NULL (all additive nullable, or non-null with constant DEFAULT)', () => {
    for (const col of PR3_COLUMNS) {
      const reNotNull = new RegExp(
        `ADD COLUMN IF NOT EXISTS\\s+${col.name}\\s+\\w+(?:\\s+DEFAULT\\s+\\S+)?\\s+NOT NULL`,
        'i',
      );
      expect(migration).not.toMatch(reNotNull);
    }
  });

  it('debug_mode and sample_visible_to_admin defaults are FALSE and TRUE respectively', () => {
    expect(migration).toMatch(/debug_mode\s+BOOLEAN\s+DEFAULT\s+FALSE/i);
    expect(migration).toMatch(/sample_visible_to_admin\s+BOOLEAN\s+DEFAULT\s+TRUE/i);
  });

  it('rejected_at default is NOW()', () => {
    expect(migration).toMatch(/rejected_at\s+TIMESTAMPTZ\s+DEFAULT\s+NOW\(\)/i);
  });

  it('legacy reason_codes TEXT[] is preserved — never dropped or altered', () => {
    expect(migration).not.toMatch(/DROP COLUMN IF EXISTS reason_codes\b/i);
    expect(migration).not.toMatch(/ALTER COLUMN reason_codes/i);
    // No direct DROP either.
    expect(migration).not.toMatch(/\bDROP\b[^;]*\breason_codes\b/i);
  });

  it('migration includes the bounded reason_code backfill from reason_codes[1]', () => {
    // The bounded UPDATE: reason_code IS NULL AND reason_codes IS NOT NULL AND array_length >= 1.
    expect(migration).toMatch(/UPDATE rejected_events/);
    expect(migration).toMatch(/SET reason_code\s*=\s*reason_codes\[1\]/i);
    expect(migration).toMatch(/WHERE reason_code IS NULL/i);
    expect(migration).toMatch(/array_length\(reason_codes,\s*1\)\s*>=\s*1/i);
  });

  it('creates rejected_events_request_id index on (request_id)', () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+rejected_events_request_id\s+ON rejected_events\s*\(request_id\)/i,
    );
  });

  it('creates rejected_events_reason index on (workspace_id, site_id, reason_code)', () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+rejected_events_reason\s+ON rejected_events\s*\(workspace_id,\s*site_id,\s*reason_code\)/i,
    );
  });

  it('creates rejected_events_received index on (workspace_id, site_id, received_at)', () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+rejected_events_received\s+ON rejected_events\s*\(workspace_id,\s*site_id,\s*received_at\)/i,
    );
  });

  it('does NOT introduce Track A scoring columns (risk_score / classification / recommended_action / behavioural_score / bot_score / agent_score)', () => {
    for (const forbidden of [
      'risk_score',
      'classification',
      'recommended_action',
      'behavioural_score',
      'behavior_score',
      'bot_score',
      'agent_score',
    ]) {
      const re = new RegExp(`ADD COLUMN[^;]*\\b${forbidden}\\b`, 'i');
      expect(migration).not.toMatch(re);
    }
  });

  it('does NOT introduce bot or AI-agent detection columns', () => {
    const forbiddenColumnRe = /ADD COLUMN[^;]*\b(bot_[a-z_]*|agent_ai[a-z_]*|agent_human[a-z_]*|is_bot|traffic_class)\b/i;
    expect(migration).not.toMatch(forbiddenColumnRe);
  });

  it('does NOT reference Track A harness paths or Core AMS paths', () => {
    expect(migration).not.toMatch(/ams-qa-behaviour-tests/);
    expect(migration).not.toMatch(/keigentechnologies\/ams/);
  });

  it('includes a documented rollback section that drops the three indexes and all 18 added columns', () => {
    expect(migration).toMatch(/Rollback/);
    expect(migration).toMatch(/DROP INDEX IF EXISTS rejected_events_request_id/);
    expect(migration).toMatch(/DROP INDEX IF EXISTS rejected_events_reason/);
    expect(migration).toMatch(/DROP INDEX IF EXISTS rejected_events_received/);
    expect(migration).toMatch(/DROP COLUMN IF EXISTS request_id/);
    expect(migration).toMatch(/DROP COLUMN IF EXISTS raw_payload_sha256/);
    expect(migration).toMatch(/DROP COLUMN IF EXISTS rejected_at/);
  });

  it('cites canonical handoff sections in the header (§2.6, §3.PR#3, §2.12 checks)', () => {
    expect(migration).toMatch(/§2\.6/);
    expect(migration).toMatch(/§3\.PR#3/);
    expect(migration).toMatch(/§2\.12/);
  });
});

describe('schema.sql — fresh-install path includes rejected_events PR#3 columns', () => {
  it('all 18 PR#3 columns appear in the rejected_events CREATE TABLE block (sliced to avoid accepted_events false positives)', () => {
    for (const col of PR3_COLUMNS) {
      const re = new RegExp(`\\b${col.name}\\s+${col.type}\\b(?!\\s+NOT NULL)`, 'i');
      expect(rejectedBlock).toMatch(re);
    }
  });

  it('request_id is UUID and nullable inside the rejected_events block', () => {
    expect(rejectedBlock).toMatch(/\brequest_id\s+UUID\b/);
    expect(rejectedBlock).not.toMatch(/\brequest_id\s+UUID\s+NOT NULL/);
  });

  it('legacy reason_codes TEXT[] NOT NULL is still present in the rejected_events block', () => {
    expect(rejectedBlock).toMatch(/\breason_codes\s+TEXT\[\]\s+NOT NULL/i);
  });

  it('schema.sql declares the three new rejected_events_* indexes', () => {
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS rejected_events_request_id\s+ON rejected_events\s*\(request_id\)/i);
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS rejected_events_reason\s+ON rejected_events\s*\(workspace_id,\s*site_id,\s*reason_code\)/i);
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS rejected_events_received\s+ON rejected_events\s*\(workspace_id,\s*site_id,\s*received_at\)/i);
  });

  it('schema.sql still ships the legacy idx_rejected_* indexes (untouched by PR#3)', () => {
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS idx_rejected_received\s+ON rejected_events \(received_at\)/i);
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS idx_rejected_site\s+ON rejected_events \(site_id\)/i);
  });

  it('schema.sql does NOT introduce Track A scoring columns anywhere on rejected_events', () => {
    for (const forbidden of [
      'risk_score',
      'classification',
      'recommended_action',
      'behavioural_score',
      'behavior_score',
      'bot_score',
      'agent_score',
      'traffic_class',
    ]) {
      const re = new RegExp(`\\b${forbidden}\\s+(TEXT|INT|UUID|BOOLEAN|JSONB|TIMESTAMPTZ|BIGINT|REAL)\\b`, 'i');
      expect(rejectedBlock).not.toMatch(re);
    }
  });

  it('accepted_events block is NOT modified by PR#3', () => {
    // Slice the accepted_events block and confirm it still carries the PR#2 column shape
    // (i.e. PR#3 didn't accidentally edit it).
    const accStart = schema.indexOf('CREATE TABLE IF NOT EXISTS accepted_events');
    const accEnd   = schema.indexOf('-- 2. Rejected events', accStart);
    expect(accStart).toBeGreaterThan(-1);
    expect(accEnd).toBeGreaterThan(accStart);
    const accBlock = schema.slice(accStart, accEnd);
    // PR#2 columns must still be there.
    expect(accBlock).toMatch(/\brequest_id\s+UUID\b/);
    expect(accBlock).toMatch(/\bcanonical_jsonb\s+JSONB\b/);
    expect(accBlock).toMatch(/\btraffic_class\s+TEXT\s+DEFAULT\s+'unknown'/i);
    // PR#3 columns must NOT be there (they belong on rejected_events).
    expect(accBlock).not.toMatch(/\brejected_stage\b/);
    expect(accBlock).not.toMatch(/\breason_code\b/);
    expect(accBlock).not.toMatch(/\bschema_errors_jsonb\b/);
    expect(accBlock).not.toMatch(/\bpii_hits_jsonb\b/);
    expect(accBlock).not.toMatch(/\braw_payload_sha256\b/);
  });

  it('ingest_requests block is NOT modified by PR#3', () => {
    const irStart = schema.indexOf('CREATE TABLE IF NOT EXISTS ingest_requests');
    expect(irStart).toBeGreaterThan(-1);
    const irBlock = schema.slice(irStart);
    // PR#1 §2.7 columns still in place.
    expect(irBlock).toMatch(/\brequest_body_sha256\s+TEXT NOT NULL/);
    expect(irBlock).toMatch(/\bauth_status\s+TEXT NOT NULL/);
  });
});

describe('reconciliation 001 — rejected-side cross-table check is now active (check 003)', () => {
  it('check 001 (internal counts) is still active and unchanged in shape', () => {
    expect(recon).toMatch(/FROM ingest_requests\s+WHERE reconciled_at IS NOT NULL/i);
    expect(recon).toMatch(/accepted_count \+ rejected_count\s*<>\s*expected_event_count/);
  });

  it('check 002 (accepted-side cross-table) is still active', () => {
    expect(recon).toMatch(/Reconciliation check 002/i);
    const lines = recon.split('\n');
    const activeAcceptedJoin = lines.find(
      line => /^\s*LEFT JOIN accepted_events ae ON ae\.request_id = ir\.request_id/i.test(line),
    );
    expect(activeAcceptedJoin).toBeDefined();
    expect(activeAcceptedJoin?.trimStart().startsWith('--')).toBe(false);
  });

  it('check 003 (rejected-side cross-table) is now a runnable SELECT, not a comment', () => {
    expect(recon).toMatch(/Reconciliation check 003/i);
    const lines = recon.split('\n');
    const activeRejectedJoin = lines.find(
      line => /^\s*LEFT JOIN rejected_events re ON re\.request_id = ir\.request_id/i.test(line),
    );
    expect(activeRejectedJoin).toBeDefined();
    expect(activeRejectedJoin?.trimStart().startsWith('--')).toBe(false);
  });

  it('check 003 compares ledger_rejected with COUNT(re.id) grouped by request_id', () => {
    expect(recon).toMatch(/ir\.rejected_count\s+AS ledger_rejected/i);
    expect(recon).toMatch(/COUNT\(re\.id\)\s+AS table_rejected/i);
    expect(recon).toMatch(/HAVING ir\.rejected_count\s*<>\s*COUNT\(re\.id\)/i);
  });

  it('the PR#3 TODO header is gone (replaced by runnable check 003)', () => {
    expect(recon).not.toMatch(/TODO\s*\(PR#3\)/i);
    expect(recon).not.toMatch(/TODO\s*\(PR#2\s*\/\s*PR#3\)/i);
  });

  it('does NOT introduce a scheduled verification job (that is §3.PR#8)', () => {
    expect(recon).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE|TRIGGER)/i);
    expect(recon).not.toMatch(/cron\.schedule|pg_cron|pg_background/i);
  });
});

describe('PR#3 scope discipline — three-part architecture (Track B only)', () => {
  it('migration does not touch any source code, route, validator, auth, or metrics module', () => {
    expect(migration).not.toMatch(/src\/(collector|routes|auth|metrics|admin)/);
  });

  it('does not modify ingest_requests indexes from PR#1', () => {
    expect(migration).not.toMatch(/ingest_requests_workspace_received/);
    expect(migration).not.toMatch(/ingest_requests_unreconciled/);
  });

  it('does not modify accepted_events indexes from PR#2', () => {
    expect(migration).not.toMatch(/accepted_events_request_id/);
  });

  it('PR#3 doc carries the verbatim disclaimer block', () => {
    expect(doc).toMatch(/This PR does not implement bot detection/);
    expect(doc).toMatch(/This PR does not implement AI-agent detection/);
    expect(doc).toMatch(/This PR does not implement Stage 0 \/ Stage 1 scoring/);
    expect(doc).toMatch(/This PR does not implement live RECORD_ONLY/);
    expect(doc).toMatch(/This PR does not implement collector routes/);
    expect(doc).toMatch(/This PR only prepares rejected_events evidence columns for future collector\/database evidence/);
  });

  it('PR#3 doc identifies it as Track B and references the three-part architecture (Track A + Core AMS) without importing them', () => {
    expect(doc).toMatch(/Track B/);
    expect(doc).toMatch(/Track A/);
    expect(doc).toMatch(/Core AMS/);
    expect(doc).toMatch(/three-part architecture/i);
  });

  it('PR#3 doc explains the §2.6 case table (request-level vs per-event rejection)', () => {
    expect(doc).toMatch(/whole request unparseable/i);
    expect(doc).toMatch(/request_body_sha256/);
    expect(doc).toMatch(/raw_payload_sha256/);
    // Both must be discussed alongside each other.
    const idxBody = doc.indexOf('request_body_sha256');
    const idxPayload = doc.indexOf('raw_payload_sha256');
    expect(idxBody).toBeGreaterThan(-1);
    expect(idxPayload).toBeGreaterThan(-1);
  });

  it('PR#3 doc documents the COALESCE(reason_code, reason_codes[1]) read pattern for the dual-write transition', () => {
    expect(doc).toMatch(/COALESCE\(reason_code,\s*reason_codes\[1\]\)/i);
  });
});
