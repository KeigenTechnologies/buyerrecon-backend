/**
 * Sprint 1 PR#4 — workspace/site auth resolution layer smoke + unit tests.
 *
 * Two test categories, both pure-function (no DB connection):
 *   1. Migration / schema structural smoke (text-level, mirrors PR#1–PR#3 convention).
 *   2. Auth helper unit tests (pure-function: hashSiteWriteToken, resolveSiteWriteToken,
 *      assertPayloadBoundary). The lookup callback is a synchronous in-memory stub.
 *
 * Track B (BuyerRecon Evidence Foundation), NOT Track A scoring,
 * NOT Core AMS product code.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  hashSiteWriteToken,
  resolveSiteWriteToken,
  assertPayloadBoundary,
  constantTimeHexEqual,
  type SiteWriteTokenRow,
  type LookupByHash,
} from '../src/auth/workspace.js';

const ROOT = join(__dirname, '..');
const MIGRATION_PATH = join(ROOT, 'migrations', '006_site_write_tokens.sql');
const SCHEMA_PATH    = join(ROOT, 'src', 'db', 'schema.sql');
const HELPER_PATH    = join(ROOT, 'src', 'auth', 'workspace.ts');
const DOC_PATH       = join(ROOT, 'docs', 'sprint2-pr4-workspace-site-auth-resolution.md');
const ENV_PATH       = join(ROOT, '.env.example');

const migration = readFileSync(MIGRATION_PATH, 'utf8');
const schema    = readFileSync(SCHEMA_PATH, 'utf8');
const helper    = readFileSync(HELPER_PATH, 'utf8');
const doc       = readFileSync(DOC_PATH, 'utf8');
const envExample = readFileSync(ENV_PATH, 'utf8');

// Slice the schema's site_write_tokens block so column-presence assertions
// don't false-positive against the other 10 tables.
const tokensBlock = (() => {
  const start = schema.indexOf('CREATE TABLE IF NOT EXISTS site_write_tokens');
  if (start < 0) throw new Error('site_write_tokens block not found in schema.sql');
  // Find the closing ); of the CREATE TABLE.
  const end = schema.indexOf(');', start);
  if (end < 0) throw new Error('site_write_tokens block end not found');
  return schema.slice(start, end + 2);
})();

// ---------------------------------------------------------------------------
// 1. Migration / schema structural smoke tests
// ---------------------------------------------------------------------------

describe('migration 006 — site_write_tokens (per §3.PR#4)', () => {
  it('migration file exists and is non-empty', () => {
    expect(migration.length).toBeGreaterThan(0);
  });

  it('creates the site_write_tokens table (idempotent)', () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS site_write_tokens/);
  });

  it('declares all 8 columns with the expected types', () => {
    const columns: ReadonlyArray<{ name: string; pattern: RegExp }> = [
      { name: 'token_id',     pattern: /token_id\s+UUID\s+PRIMARY KEY\s+DEFAULT\s+gen_random_uuid\(\)/i },
      { name: 'token_hash',   pattern: /token_hash\s+TEXT NOT NULL UNIQUE/i },
      { name: 'workspace_id', pattern: /workspace_id\s+TEXT NOT NULL/i },
      { name: 'site_id',      pattern: /site_id\s+TEXT NOT NULL/i },
      { name: 'label',        pattern: /label\s+TEXT(?!\s+NOT NULL)/i },
      { name: 'created_at',   pattern: /created_at\s+TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/i },
      { name: 'disabled_at',  pattern: /disabled_at\s+TIMESTAMPTZ(?!\s+NOT NULL)/i },
      { name: 'last_used_at', pattern: /last_used_at\s+TIMESTAMPTZ(?!\s+NOT NULL)/i },
    ];
    for (const col of columns) {
      expect(migration).toMatch(col.pattern);
    }
  });

  it('does NOT introduce a raw token column (column-position check only — disclaimer prose may mention these names)', () => {
    // Each pattern is a column declaration: name then SQL type. Disclaimer
    // prose like "Raw token is NEVER stored." is allowed and expected.
    const forbiddenColumnRe = /^\s*(token|raw_token|write_token|token_plaintext|token_value)\s+(TEXT|UUID|JSONB|BYTEA)\b/im;
    expect(migration).not.toMatch(forbiddenColumnRe);
  });

  it('does NOT alter accepted_events / rejected_events / ingest_requests', () => {
    expect(migration).not.toMatch(/ALTER TABLE accepted_events/);
    expect(migration).not.toMatch(/ALTER TABLE rejected_events/);
    expect(migration).not.toMatch(/ALTER TABLE ingest_requests/);
  });

  it('does NOT introduce Track A scoring columns (column-position check only — disclaimer prose may name them)', () => {
    // Column-position regex: a column declaration is `name TYPE` at start of
    // line or after the open-paren of a CREATE TABLE column list.
    const forbiddenColumnRe = /^\s*(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|traffic_class)\s+(TEXT|INT|UUID|BOOLEAN|JSONB|TIMESTAMPTZ|BIGINT|REAL)\b/im;
    expect(migration).not.toMatch(forbiddenColumnRe);
  });

  it('creates site_write_tokens_workspace_site index on (workspace_id, site_id)', () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+site_write_tokens_workspace_site\s+ON site_write_tokens\s*\(workspace_id,\s*site_id\)/i,
    );
  });

  it('creates site_write_tokens_active partial index on (token_hash) WHERE disabled_at IS NULL', () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+site_write_tokens_active\s+ON site_write_tokens\s*\(token_hash\)\s*WHERE disabled_at IS NULL/i,
    );
  });

  it('does NOT introduce a foreign key', () => {
    expect(migration).not.toMatch(/REFERENCES\s+\w+\s*\(/i);
    expect(migration).not.toMatch(/FOREIGN KEY/i);
  });

  it('does NOT introduce a DB CHECK constraint', () => {
    // §2.9 closing-note deferral applies to PR#4 too.
    expect(migration).not.toMatch(/CHECK\s*\(/i);
  });

  it('cites canonical handoff sections in the header', () => {
    expect(migration).toMatch(/§3\.PR#4/);
    expect(migration).toMatch(/§1 Decision #4/);
    expect(migration).toMatch(/§4\.1/);
  });

  it('includes a documented rollback section', () => {
    expect(migration).toMatch(/Rollback/);
    expect(migration).toMatch(/DROP INDEX IF EXISTS site_write_tokens_active/);
    expect(migration).toMatch(/DROP INDEX IF EXISTS site_write_tokens_workspace_site/);
    expect(migration).toMatch(/DROP TABLE IF EXISTS site_write_tokens/);
  });
});

describe('schema.sql — fresh-install path includes site_write_tokens', () => {
  it('contains the site_write_tokens CREATE TABLE block', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS site_write_tokens/);
  });

  it('site_write_tokens block carries token_hash TEXT NOT NULL UNIQUE', () => {
    expect(tokensBlock).toMatch(/token_hash\s+TEXT NOT NULL UNIQUE/i);
  });

  it('site_write_tokens block carries NOT NULL workspace_id and site_id', () => {
    expect(tokensBlock).toMatch(/workspace_id\s+TEXT NOT NULL/i);
    expect(tokensBlock).toMatch(/site_id\s+TEXT NOT NULL/i);
  });

  it('schema.sql declares both new indexes', () => {
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS site_write_tokens_workspace_site\s+ON site_write_tokens \(workspace_id, site_id\)/i);
    expect(schema).toMatch(/CREATE INDEX IF NOT EXISTS site_write_tokens_active\s+ON site_write_tokens \(token_hash\)\s+WHERE disabled_at IS NULL/i);
  });

  it('schema.sql still ships pgcrypto (token_id uses gen_random_uuid())', () => {
    expect(schema).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  });

  it('site_write_tokens block contains no raw-token column', () => {
    expect(tokensBlock).not.toMatch(/^\s*token\s+TEXT/im);
    expect(tokensBlock).not.toMatch(/\braw_token\b/i);
    expect(tokensBlock).not.toMatch(/\bwrite_token\b/i);
  });

  it('does NOT modify the accepted_events / rejected_events / ingest_requests blocks', () => {
    // Cheap guard: PR#3 columns must still be on rejected_events, PR#2 columns
    // must still be on accepted_events, PR#1 columns must still be on ingest_requests.
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS rejected_events[\s\S]*request_id\s+UUID/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS accepted_events[\s\S]*canonical_jsonb\s+JSONB/);
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS ingest_requests[\s\S]*request_body_sha256\s+TEXT NOT NULL/);
  });
});

describe('.env.example — SITE_WRITE_TOKEN_PEPPER is documented', () => {
  it('documents SITE_WRITE_TOKEN_PEPPER with a generation hint', () => {
    expect(envExample).toMatch(/SITE_WRITE_TOKEN_PEPPER=/);
    expect(envExample).toMatch(/randomBytes\(32\)\.toString\('hex'\)/);
  });
});

// ---------------------------------------------------------------------------
// 2. Auth helper unit tests
// ---------------------------------------------------------------------------

const PEPPER = '0'.repeat(64); // 32 bytes hex — deterministic test pepper, never used in production.

describe('hashSiteWriteToken', () => {
  it('returns a 64-char lowercase hex digest', () => {
    const h = hashSiteWriteToken('tok_alpha', PEPPER);
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same (token, pepper)', () => {
    const a = hashSiteWriteToken('tok_alpha', PEPPER);
    const b = hashSiteWriteToken('tok_alpha', PEPPER);
    expect(a).toBe(b);
  });

  it('produces different hashes for different tokens (collision-resistant)', () => {
    const a = hashSiteWriteToken('tok_alpha', PEPPER);
    const b = hashSiteWriteToken('tok_beta', PEPPER);
    expect(a).not.toBe(b);
  });

  it('produces different hashes for different peppers (the pepper actually peppers)', () => {
    const a = hashSiteWriteToken('tok_alpha', PEPPER);
    const b = hashSiteWriteToken('tok_alpha', '1'.repeat(64));
    expect(a).not.toBe(b);
  });

  it('does NOT return the raw token in any form', () => {
    const token = 'tok_alpha_secret_ABC123_xyz';
    const h = hashSiteWriteToken(token, PEPPER);
    expect(h).not.toContain(token);
    expect(h).not.toContain('alpha');
    expect(h).not.toContain('secret');
    expect(h).not.toContain('ABC123');
  });

  it('is case-sensitive on the token (does NOT lowercase, unlike hashEmail)', () => {
    // Critical: write tokens are opaque high-entropy strings; normalising
    // would silently lose entropy and produce false matches.
    const a = hashSiteWriteToken('Tok_Alpha', PEPPER);
    const b = hashSiteWriteToken('tok_alpha', PEPPER);
    expect(a).not.toBe(b);
  });

  it('throws on empty token', () => {
    expect(() => hashSiteWriteToken('', PEPPER)).toThrow();
  });

  it('throws on empty pepper', () => {
    expect(() => hashSiteWriteToken('tok_alpha', '')).toThrow();
  });
});

describe('constantTimeHexEqual', () => {
  it('returns true on identical hex strings', () => {
    expect(constantTimeHexEqual('abcdef', 'abcdef')).toBe(true);
  });

  it('returns false on different equal-length hex strings', () => {
    expect(constantTimeHexEqual('abcdef', 'abcde0')).toBe(false);
  });

  it('returns false on length mismatch (does not throw)', () => {
    expect(constantTimeHexEqual('abcdef', 'abcd')).toBe(false);
  });
});

// In-memory stub of the lookupByHash callback. The real collector will pass
// a function that runs SELECT against site_write_tokens; PR#4 only ships the
// resolution helper that calls back into whatever the caller provides.
function makeStub(rows: ReadonlyArray<SiteWriteTokenRow>): LookupByHash {
  const byHash = new Map(rows.map(r => [hashSiteWriteToken(r.__rawToken, PEPPER), r] as const));
  return (h: string): SiteWriteTokenRow | null => byHash.get(h) ?? null;
}
// Augment the row shape for stub-only convenience.
interface StubRow extends SiteWriteTokenRow {
  __rawToken: string;
}
const ACTIVE_TOKEN: StubRow = {
  __rawToken: 'tok_active_alpha',
  token_id: '11111111-1111-1111-1111-111111111111',
  workspace_id: 'ws_alpha',
  site_id: 'site_alpha',
  disabled_at: null,
};
const DISABLED_TOKEN: StubRow = {
  __rawToken: 'tok_disabled_beta',
  token_id: '22222222-2222-2222-2222-222222222222',
  workspace_id: 'ws_beta',
  site_id: 'site_beta',
  disabled_at: new Date('2026-01-01T00:00:00Z'),
};
const lookup = makeStub([ACTIVE_TOKEN, DISABLED_TOKEN]);

describe('resolveSiteWriteToken', () => {
  it('resolves an active token to its (workspace_id, site_id, token_id)', () => {
    const r = resolveSiteWriteToken('tok_active_alpha', PEPPER, lookup);
    expect(r).toEqual({
      ok: true,
      token_id: '11111111-1111-1111-1111-111111111111',
      workspace_id: 'ws_alpha',
      site_id: 'site_alpha',
    });
  });

  it('returns auth_invalid when token is missing (null)', () => {
    expect(resolveSiteWriteToken(null, PEPPER, lookup)).toEqual({
      ok: false,
      reason_code: 'auth_invalid',
    });
  });

  it('returns auth_invalid when token is undefined', () => {
    expect(resolveSiteWriteToken(undefined, PEPPER, lookup)).toEqual({
      ok: false,
      reason_code: 'auth_invalid',
    });
  });

  it('returns auth_invalid when token is the empty string', () => {
    expect(resolveSiteWriteToken('', PEPPER, lookup)).toEqual({
      ok: false,
      reason_code: 'auth_invalid',
    });
  });

  it('returns auth_invalid when token is unknown to the lookup', () => {
    expect(resolveSiteWriteToken('tok_unknown_gamma', PEPPER, lookup)).toEqual({
      ok: false,
      reason_code: 'auth_invalid',
    });
  });

  it('returns auth_site_disabled when token row exists but disabled_at is set', () => {
    expect(resolveSiteWriteToken('tok_disabled_beta', PEPPER, lookup)).toEqual({
      ok: false,
      reason_code: 'auth_site_disabled',
    });
  });

  it('returns auth_invalid when pepper is missing (server config error)', () => {
    expect(resolveSiteWriteToken('tok_active_alpha', '', lookup)).toEqual({
      ok: false,
      reason_code: 'auth_invalid',
    });
  });

  it('does NOT call lookupByHash with anything that resembles the raw token', () => {
    let captured = '';
    const spy: LookupByHash = (h) => {
      captured = h;
      return null;
    };
    resolveSiteWriteToken('tok_active_alpha', PEPPER, spy);
    expect(captured).toHaveLength(64);
    expect(captured).toMatch(/^[0-9a-f]{64}$/);
    expect(captured).not.toContain('tok_active_alpha');
    expect(captured).not.toContain('alpha');
  });
});

describe('assertPayloadBoundary', () => {
  const resolved = { workspace_id: 'ws_alpha', site_id: 'site_alpha' };

  it('passes when payload is undefined (server stamps resolved values later)', () => {
    expect(assertPayloadBoundary(resolved, undefined)).toEqual({ ok: true });
  });

  it('passes when payload is null', () => {
    expect(assertPayloadBoundary(resolved, null)).toEqual({ ok: true });
  });

  it('passes when payload is empty {}', () => {
    expect(assertPayloadBoundary(resolved, {})).toEqual({ ok: true });
  });

  it('passes when payload-side workspace_id and site_id match resolved values', () => {
    expect(
      assertPayloadBoundary(resolved, { workspace_id: 'ws_alpha', site_id: 'site_alpha' }),
    ).toEqual({ ok: true });
  });

  it('returns workspace_site_mismatch when payload workspace_id differs', () => {
    expect(
      assertPayloadBoundary(resolved, { workspace_id: 'ws_beta', site_id: 'site_alpha' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });
  });

  it('returns workspace_site_mismatch when payload site_id differs (Site-A token + payload site=B per §4.1 #5)', () => {
    expect(
      assertPayloadBoundary(resolved, { workspace_id: 'ws_alpha', site_id: 'site_beta' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });
  });

  it('returns workspace_site_mismatch when only one of two payload fields differs', () => {
    expect(
      assertPayloadBoundary(resolved, { workspace_id: 'ws_beta' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });

    expect(
      assertPayloadBoundary(resolved, { site_id: 'site_beta' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });
  });

  it('treats payload null/undefined fields as not-present (server stamps the resolved values)', () => {
    expect(
      assertPayloadBoundary(resolved, { workspace_id: undefined, site_id: null }),
    ).toEqual({ ok: true });
  });

  it('result shape never contains payload-side workspace/site values (only ok/reason_code)', () => {
    const r = assertPayloadBoundary(resolved, { workspace_id: 'ws_attacker', site_id: 'site_attacker' });
    expect(JSON.stringify(r)).not.toContain('ws_attacker');
    expect(JSON.stringify(r)).not.toContain('site_attacker');
  });
});

// ---------------------------------------------------------------------------
// 3. PR#4 scope discipline — three-part architecture
// ---------------------------------------------------------------------------

describe('PR#4 scope discipline — Track B only', () => {
  it('helper module is pure: imports only node:crypto, no DB driver, no env read, no logger', () => {
    expect(helper).toMatch(/^import \{[^}]*\} from 'crypto';/m);
    // Negative: must not import pg, pino, winston, axios, fetch, env libraries.
    expect(helper).not.toMatch(/from\s+['"]pg['"]/);
    expect(helper).not.toMatch(/from\s+['"]pino['"]/);
    expect(helper).not.toMatch(/from\s+['"]winston['"]/);
    expect(helper).not.toMatch(/from\s+['"]axios['"]/);
    expect(helper).not.toMatch(/process\.env\./);
  });

  it('helper module does NOT import Track A or Core AMS', () => {
    expect(helper).not.toMatch(/ams-qa-behaviour-tests/);
    expect(helper).not.toMatch(/keigentechnologies\/ams/);
    expect(helper).not.toMatch(/from\s+['"]\.\.\/.*scoring/);
    expect(helper).not.toMatch(/from\s+['"]\.\.\/.*stage[01]/);
  });

  it('helper module does NOT introduce scoring fields or bot/agent logic', () => {
    for (const forbidden of [
      'risk_score',
      'classification',
      'recommended_action',
      'behavioural_score',
      'behavior_score',
      'bot_score',
      'agent_score',
      'is_bot',
      'agent_ai',
      'agent_human',
    ]) {
      const re = new RegExp(`\\b${forbidden}\\b`, 'i');
      expect(helper).not.toMatch(re);
    }
  });

  it('helper module never updates last_used_at (PR#5 wires that)', () => {
    expect(helper).not.toMatch(/last_used_at\s*=/);
    expect(helper).not.toMatch(/UPDATE\s+site_write_tokens/i);
  });

  it('migration does NOT touch any source code, route, validator, auth runtime, or metrics module', () => {
    expect(migration).not.toMatch(/src\/(collector|routes|metrics|admin)/);
  });

  it('migration does NOT add /v1/event or /v1/batch routes', () => {
    expect(migration).not.toMatch(/\/v1\/event\b/);
    expect(migration).not.toMatch(/\/v1\/batch\b/);
  });

  it('PR#4 doc carries the verbatim disclaimer block', () => {
    expect(doc).toMatch(/This PR does not implement bot detection/);
    expect(doc).toMatch(/This PR does not implement AI-agent detection/);
    expect(doc).toMatch(/This PR does not implement Stage 0 \/ Stage 1 scoring/);
    expect(doc).toMatch(/This PR does not implement live RECORD_ONLY/);
    expect(doc).toMatch(/This PR does not implement collector routes/);
    expect(doc).toMatch(/This PR only prepares workspace\/site auth resolution for future collector\/database evidence/);
  });

  it('PR#4 doc identifies it as Track B and references the three-part architecture', () => {
    expect(doc).toMatch(/Track B/);
    expect(doc).toMatch(/Track A/);
    expect(doc).toMatch(/Core AMS/);
    expect(doc).toMatch(/three-part architecture/i);
  });

  it('PR#4 doc explains the three reason codes from §2.8', () => {
    expect(doc).toMatch(/auth_invalid/);
    expect(doc).toMatch(/auth_site_disabled/);
    expect(doc).toMatch(/workspace_site_mismatch/);
  });

  it('PR#4 doc explains why raw token is never stored', () => {
    expect(doc).toMatch(/never stored/i);
    expect(doc).toMatch(/HMAC-SHA256/i);
    expect(doc).toMatch(/pepper/i);
  });
});
