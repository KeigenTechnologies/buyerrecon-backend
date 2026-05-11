/**
 * Sprint 1 PR#5b-3 — canonical_jsonb projection tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildCanonicalJsonb,
  type CanonicalJsonbInput,
} from '../../src/collector/v1/canonical.js';
import type { EventValidationOk } from '../../src/collector/v1/validation.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'canonical.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

const EXPECTED_KEYS: ReadonlyArray<string> = [
  'request_id',
  'workspace_id',
  'site_id',
  'client_event_id',
  'event_name',
  'event_type',
  'event_origin',
  'occurred_at',
  'received_at',
  'schema_key',
  'schema_version',
  'id_format',
  'traffic_class',
  'session_id',
  'session_seq',
  'consent_state',
  'consent_source',
  'tracking_mode',
  'storage_mechanism',
];

const validatedBrowser: EventValidationOk = {
  ok: true,
  event_origin: 'browser',
  event_type: 'page',
  event_name: 'page_view',
  schema_key: 'br.page',
  schema_version: '1.0.0',
  client_event_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  id_format: 'uuidv4',
  session_id: 'sess_alpha',
  occurred_at: new Date('2026-05-10T11:59:59Z'),
};

const validatedServer: EventValidationOk = {
  ok: true,
  event_origin: 'server',
  event_type: 'track',
  event_name: 'lead_qualified',
  schema_key: 'br.track',
  schema_version: '1.0.0',
  client_event_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
  id_format: 'uuidv7',
  session_id: null,
  occurred_at: new Date('2026-05-10T11:59:59Z'),
};

const baseCtx = {
  request_id: '00000000-0000-0000-0000-000000000001',
  received_at: new Date('2026-05-10T12:00:00Z'),
};
const baseResolved = { workspace_id: 'ws_alpha', site_id: 'site_alpha' };

const buildBrowser = (
  overrides: Partial<CanonicalJsonbInput> = {},
): Record<string, unknown> =>
  buildCanonicalJsonb({
    validated: validatedBrowser,
    resolved: baseResolved,
    ctx: baseCtx,
    ...overrides,
  });

// ---------------------------------------------------------------------------
// 1. Output shape — exactly the 19 keys, always
// ---------------------------------------------------------------------------

describe('buildCanonicalJsonb — output shape (19 keys, always present)', () => {
  it('has exactly the 19 expected keys when all sources are populated', () => {
    const out = buildBrowser({
      optional: {
        session_seq: 5,
        traffic_class: 'unknown',
        consent_state: 'granted',
        consent_source: 'cmp_v1',
        tracking_mode: 'enabled',
        storage_mechanism: 'cookie',
      },
    });
    expect(Object.keys(out).sort()).toEqual([...EXPECTED_KEYS].sort());
    expect(Object.keys(out).length).toBe(19);
  });

  it('still emits all 19 keys when optional={} is empty', () => {
    const out = buildBrowser({ optional: {} });
    expect(Object.keys(out).sort()).toEqual([...EXPECTED_KEYS].sort());
    expect(Object.keys(out).length).toBe(19);
  });

  it('still emits all 19 keys when optional is omitted entirely', () => {
    const out = buildBrowser();
    expect(Object.keys(out).sort()).toEqual([...EXPECTED_KEYS].sort());
    expect(Object.keys(out).length).toBe(19);
  });
});

// ---------------------------------------------------------------------------
// 2. Null policy for unavailable optional fields
// ---------------------------------------------------------------------------

describe('buildCanonicalJsonb — null policy for unavailable optionals', () => {
  it('emits session_seq as null when optional.session_seq is undefined', () => {
    const out = buildBrowser();
    expect(out.session_seq).toBeNull();
  });

  it('emits session_seq as null when optional.session_seq is explicitly null', () => {
    const out = buildBrowser({ optional: { session_seq: null } });
    expect(out.session_seq).toBeNull();
  });

  it('emits session_seq as the supplied finite number', () => {
    const out = buildBrowser({ optional: { session_seq: 7 } });
    expect(out.session_seq).toBe(7);
  });

  it('emits consent_state / consent_source / tracking_mode / storage_mechanism as null when optional is empty', () => {
    const out = buildBrowser();
    expect(out.consent_state).toBeNull();
    expect(out.consent_source).toBeNull();
    expect(out.tracking_mode).toBeNull();
    expect(out.storage_mechanism).toBeNull();
  });

  it('emits optional consent fields as supplied when present', () => {
    const out = buildBrowser({
      optional: {
        consent_state: 'granted',
        consent_source: 'cmp_v1',
        tracking_mode: 'enabled',
        storage_mechanism: 'cookie',
      },
    });
    expect(out.consent_state).toBe('granted');
    expect(out.consent_source).toBe('cmp_v1');
    expect(out.tracking_mode).toBe('enabled');
    expect(out.storage_mechanism).toBe('cookie');
  });
});

// ---------------------------------------------------------------------------
// 3. traffic_class default and policy
// ---------------------------------------------------------------------------

describe('buildCanonicalJsonb — traffic_class', () => {
  it("defaults to 'unknown' when optional.traffic_class is undefined", () => {
    const out = buildBrowser();
    expect(out.traffic_class).toBe('unknown');
  });

  it("defaults to 'unknown' when optional.traffic_class is explicitly null", () => {
    const out = buildBrowser({ optional: { traffic_class: null } });
    expect(out.traffic_class).toBe('unknown');
  });

  it("retains 'unknown' when supplied explicitly", () => {
    const out = buildBrowser({ optional: { traffic_class: 'unknown' } });
    expect(out.traffic_class).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// 4. ISO-string timestamp policy
// ---------------------------------------------------------------------------

describe('buildCanonicalJsonb — ISO-string timestamps', () => {
  it('emits occurred_at as ISO 8601 string', () => {
    const out = buildBrowser();
    expect(out.occurred_at).toBe('2026-05-10T11:59:59.000Z');
  });

  it('emits received_at as ISO 8601 string', () => {
    const out = buildBrowser();
    expect(out.received_at).toBe('2026-05-10T12:00:00.000Z');
  });

  it('preserves millisecond precision in ISO output', () => {
    const out = buildCanonicalJsonb({
      validated: validatedBrowser,
      resolved: baseResolved,
      ctx: { request_id: 'r1', received_at: new Date('2026-05-10T12:00:00.123Z') },
    });
    expect(out.received_at).toBe('2026-05-10T12:00:00.123Z');
  });
});

// ---------------------------------------------------------------------------
// 5. session_id null policy (server vs browser)
// ---------------------------------------------------------------------------

describe('buildCanonicalJsonb — session_id', () => {
  it('emits session_id as the validated string for browser-origin events', () => {
    const out = buildBrowser();
    expect(out.session_id).toBe('sess_alpha');
  });

  it('emits session_id as null for server-origin events that have no session', () => {
    const out = buildCanonicalJsonb({
      validated: validatedServer,
      resolved: baseResolved,
      ctx: baseCtx,
    });
    expect(out.session_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Exclusion policy — never include attacker-style or non-D3 fields
// ---------------------------------------------------------------------------

describe('buildCanonicalJsonb — exclusion policy', () => {
  it('does NOT include any field that is not on the 19-key whitelist', () => {
    // Even if attacker-style fields appear on `validated` (via casts), the
    // projection only reads the typed properties it knows about.
    const out = buildBrowser();
    const keys = new Set(Object.keys(out));
    for (const forbidden of [
      'properties', 'context',
      'page_url', 'page_path', 'page_referrer', 'page_title',
      'user_id', 'company_id', 'anonymous_id', 'browser_id',
      'email', 'phone', 'name', 'address',
      'ip', 'user_agent', 'ip_hash',
      'debug', 'debug_mode',
      'raw', 'payload_jsonb', 'payload_sha256',
      'accepted_at', 'validator_version', 'sent_at',
      'risk_score', 'classification', 'recommended_action',
      'behavioural_score', 'bot_score', 'agent_score',
      'is_bot', 'is_agent',
    ]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it('JSON-stringified output contains none of the forbidden field names', () => {
    const out = buildBrowser();
    const serialised = JSON.stringify(out);
    for (const forbidden of [
      'page_url', 'user_agent', 'ip_hash', 'email', 'phone', 'debug',
      'payload_sha256', 'risk_score', 'classification',
      'recommended_action', 'bot_score', 'agent_score',
    ]) {
      expect(serialised).not.toContain(`"${forbidden}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Input non-mutation
// ---------------------------------------------------------------------------

describe('buildCanonicalJsonb — input non-mutation', () => {
  it('does not mutate validated', () => {
    const v = { ...validatedBrowser };
    const before = JSON.stringify(v);
    buildCanonicalJsonb({ validated: v, resolved: baseResolved, ctx: baseCtx });
    expect(JSON.stringify(v)).toBe(before);
  });

  it('does not mutate resolved', () => {
    const r = { ...baseResolved };
    const before = JSON.stringify(r);
    buildCanonicalJsonb({ validated: validatedBrowser, resolved: r, ctx: baseCtx });
    expect(JSON.stringify(r)).toBe(before);
  });

  it('does not mutate ctx', () => {
    const c = { request_id: baseCtx.request_id, received_at: baseCtx.received_at };
    const before = JSON.stringify(c);
    buildCanonicalJsonb({ validated: validatedBrowser, resolved: baseResolved, ctx: c });
    expect(JSON.stringify(c)).toBe(before);
  });

  it('does not mutate optional', () => {
    const o = { session_seq: 5, consent_state: 'granted' };
    const before = JSON.stringify(o);
    buildCanonicalJsonb({
      validated: validatedBrowser,
      resolved: baseResolved,
      ctx: baseCtx,
      optional: o,
    });
    expect(JSON.stringify(o)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// 8. Module-level scope discipline (Track B only)
// ---------------------------------------------------------------------------

describe('canonical.ts — import discipline (Track B only)', () => {
  it('imports ONLY a type from ./validation.js (no runtime imports)', () => {
    const importStatements = source.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBe(1);
    const stmt = importStatements[0]!;
    expect(stmt).toMatch(/from\s+['"]\.\/validation\.js['"]/);
    expect(stmt).toMatch(/^import\s+type\s/);
  });

  it('does NOT import pii.ts / consent.ts / boundary.ts / dedupe.ts (PR#5b-2 modules)', () => {
    expect(source).not.toMatch(/from\s+['"]\.\/pii\.js['"]/);
    expect(source).not.toMatch(/from\s+['"]\.\/consent\.js['"]/);
    expect(source).not.toMatch(/from\s+['"]\.\/boundary\.js['"]/);
    expect(source).not.toMatch(/from\s+['"]\.\/dedupe\.js['"]/);
  });

  it('does NOT read process.env / import DB / express / pino / scoring path', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT introduce scoring symbols as identifiers (column-position regex; disclaimer prose may name them)', () => {
    // Catches `risk_score:` / `risk_score =` / `risk_score(` in code; not
    // bare mentions inside JSDoc disclaimer prose.
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|is_bot|is_agent)\s*[:=(]/;
    expect(source).not.toMatch(forbidden);
  });

  it('does NOT register any HTTP route handler or middleware', () => {
    expect(source).not.toMatch(/\bRouter\s*\(/);
    expect(source).not.toMatch(/\b(?:app|router)\.(?:get|post|put|delete|patch|use|listen)\s*\(/);
  });
});
