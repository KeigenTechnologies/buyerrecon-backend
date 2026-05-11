/**
 * Sprint 1 PR#5c-1 — buildAcceptedNormalisedEnvelope tests.
 *
 * Pure-function tests. No DB / env / network / route.
 *
 * Critical invariant verified: payloadSha256(normalisedEnvelope) !== payloadSha256(canonical_jsonb).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildAcceptedNormalisedEnvelope,
  NORMALISED_ENVELOPE_KEYS,
  type NormalisedEnvelopeInput,
} from '../../src/collector/v1/normalised-envelope.js';
import { buildCanonicalJsonb } from '../../src/collector/v1/canonical.js';
import { payloadSha256 } from '../../src/collector/v1/payload-hash.js';
import type { EventValidationOk } from '../../src/collector/v1/validation.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'normalised-envelope.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

// ---- Fixtures ----

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
const baseConfig = { validator_version: 'v-test-0.1', collector_version: 'c-test-0.1' };

const buildFromBrowser = (
  rawOverrides: Record<string, unknown> = {},
): Record<string, unknown> =>
  buildAcceptedNormalisedEnvelope({
    validated: validatedBrowser,
    resolved: baseResolved,
    ctx: baseCtx,
    raw_event: {
      client_event_id: validatedBrowser.client_event_id,
      event_name: validatedBrowser.event_name,
      event_type: validatedBrowser.event_type,
      event_origin: validatedBrowser.event_origin,
      schema_key: validatedBrowser.schema_key,
      schema_version: validatedBrowser.schema_version,
      occurred_at: '2026-05-10T11:59:59Z',
      session_id: validatedBrowser.session_id,
      ...rawOverrides,
    },
    config: baseConfig,
  });

// ---------------------------------------------------------------------------
// 1. Fixed allowlist shape — exactly 36 keys, always
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — fixed allowlist shape', () => {
  it('exports the 36-key allowlist as NORMALISED_ENVELOPE_KEYS', () => {
    expect(NORMALISED_ENVELOPE_KEYS.length).toBe(36);
  });

  it('output keys exactly match the allowlist when raw_event is rich', () => {
    const out = buildFromBrowser({
      anonymous_id: 'a_123',
      user_id: 'u_123',
      company_id: 'c_123',
      session_seq: 4,
      session_started_at: '2026-05-10T11:55:00Z',
      session_last_seen_at: '2026-05-10T11:59:55Z',
      consent_state: 'granted',
      consent_source: 'cmp',
      consent_updated_at: '2026-05-10T11:50:00Z',
      pre_consent_mode: false,
      tracking_mode: 'full',
      storage_mechanism: 'cookie',
      page_url: 'https://example.com/p',
      page_path: '/p',
      page_referrer: 'https://google.com/',
      page_title: 'Product',
      properties: { color: 'blue' },
      context: { campaign: 'spring' },
    });
    expect(Object.keys(out).sort()).toEqual([...NORMALISED_ENVELOPE_KEYS].sort());
    expect(Object.keys(out).length).toBe(36);
  });

  it('output keys still match the allowlist when raw_event is minimal', () => {
    const out = buildFromBrowser();
    expect(Object.keys(out).sort()).toEqual([...NORMALISED_ENVELOPE_KEYS].sort());
    expect(Object.keys(out).length).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// 2. Null policy for unavailable optional fields
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — null policy', () => {
  it('emits null for unavailable optional string fields', () => {
    const out = buildFromBrowser();
    expect(out.anonymous_id).toBeNull();
    expect(out.user_id).toBeNull();
    expect(out.company_id).toBeNull();
    expect(out.consent_state).toBeNull();
    expect(out.consent_source).toBeNull();
    expect(out.tracking_mode).toBeNull();
    expect(out.storage_mechanism).toBeNull();
    expect(out.page_url).toBeNull();
    expect(out.page_path).toBeNull();
    expect(out.page_referrer).toBeNull();
    expect(out.page_title).toBeNull();
  });

  it('emits null for unavailable optional number / boolean / date fields', () => {
    const out = buildFromBrowser();
    expect(out.session_seq).toBeNull();
    expect(out.session_started_at).toBeNull();
    expect(out.session_last_seen_at).toBeNull();
    expect(out.consent_updated_at).toBeNull();
    expect(out.pre_consent_mode).toBeNull();
  });

  it('emits null for unavailable container objects', () => {
    const out = buildFromBrowser();
    expect(out.properties).toBeNull();
    expect(out.context).toBeNull();
  });

  it('type-narrows on unexpected types (non-string user_id → null)', () => {
    const out = buildFromBrowser({ user_id: 12345 });
    expect(out.user_id).toBeNull();
  });

  it('type-narrows on unexpected types (non-plain-object properties → null)', () => {
    const out = buildFromBrowser({ properties: ['not', 'an', 'object'] });
    expect(out.properties).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. ISO timestamp policy (all Date inputs and date-shaped strings normalised)
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — ISO timestamps', () => {
  it('emits occurred_at and received_at as ISO 8601 strings', () => {
    const out = buildFromBrowser();
    expect(out.occurred_at).toBe('2026-05-10T11:59:59.000Z');
    expect(out.received_at).toBe('2026-05-10T12:00:00.000Z');
  });

  it('normalises date-shaped string inputs through Date.parse → toISOString', () => {
    // "2026-05-10T11:50:00Z" should canonicalise to "2026-05-10T11:50:00.000Z".
    const out = buildFromBrowser({ consent_updated_at: '2026-05-10T11:50:00Z' });
    expect(out.consent_updated_at).toBe('2026-05-10T11:50:00.000Z');
  });

  it('emits null on unparseable date strings', () => {
    const out = buildFromBrowser({ consent_updated_at: 'not-a-date' });
    expect(out.consent_updated_at).toBeNull();
  });

  it('preserves millisecond precision', () => {
    const out = buildAcceptedNormalisedEnvelope({
      validated: validatedBrowser,
      resolved: baseResolved,
      ctx: { request_id: 'r1', received_at: new Date('2026-05-10T12:00:00.123Z') },
      raw_event: {},
      config: baseConfig,
    });
    expect(out.received_at).toBe('2026-05-10T12:00:00.123Z');
  });
});

// ---------------------------------------------------------------------------
// 4. traffic_class is always 'unknown' (Decision #13)
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — traffic_class always "unknown"', () => {
  it("emits 'unknown' regardless of input", () => {
    expect(buildFromBrowser().traffic_class).toBe('unknown');
  });

  it("emits 'unknown' even when raw_event tries to set traffic_class to something else", () => {
    const out = buildFromBrowser({ traffic_class: 'bot' });
    expect(out.traffic_class).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// 5. debug is always false (R-12 already rejected debug=true upstream)
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — debug always false', () => {
  it('emits debug=false even when raw_event.debug=true (R-12 already filtered)', () => {
    const out = buildFromBrowser({ debug: true });
    expect(out.debug).toBe(false);
  });

  it('emits debug=false when raw_event.debug is absent', () => {
    expect(buildFromBrowser().debug).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Page / properties / context flow through (broader than canonical_jsonb)
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — page / properties / context inclusion', () => {
  it('includes page_url, page_path, page_referrer, page_title when present', () => {
    const out = buildFromBrowser({
      page_url: 'https://example.com/p?x=1',
      page_path: '/p',
      page_referrer: 'https://google.com/',
      page_title: 'Product',
    });
    expect(out.page_url).toBe('https://example.com/p?x=1');
    expect(out.page_path).toBe('/p');
    expect(out.page_referrer).toBe('https://google.com/');
    expect(out.page_title).toBe('Product');
  });

  it('includes properties and context as plain objects when present', () => {
    const out = buildFromBrowser({
      properties: { color: 'blue', qty: 2 },
      context: { campaign: 'spring' },
    });
    expect(out.properties).toEqual({ color: 'blue', qty: 2 });
    expect(out.context).toEqual({ campaign: 'spring' });
  });
});

// ---------------------------------------------------------------------------
// 7. Exclusion policy — never include forbidden fields
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — exclusion policy', () => {
  it('never includes canonical_jsonb / payload_sha256 / accepted_at / payload_purged_at', () => {
    const out = buildFromBrowser({
      canonical_jsonb: { fake: true },
      payload_sha256: 'fake_hash',
      accepted_at: new Date(),
      payload_purged_at: new Date(),
    });
    expect(out).not.toHaveProperty('canonical_jsonb');
    expect(out).not.toHaveProperty('payload_sha256');
    expect(out).not.toHaveProperty('accepted_at');
    expect(out).not.toHaveProperty('payload_purged_at');
  });

  it('never includes ip_hash, user_agent, raw IP', () => {
    const out = buildFromBrowser({
      ip_hash: 'fake_hash',
      user_agent: 'attacker-supplied-UA',
      ip: '1.2.3.4',
    });
    expect(out).not.toHaveProperty('ip_hash');
    expect(out).not.toHaveProperty('user_agent');
    expect(out).not.toHaveProperty('ip');
  });

  it('never includes scoring / bot / AI-agent fields', () => {
    const out = buildFromBrowser({
      risk_score: 0.99,
      classification: 'bot',
      recommended_action: 'block',
      behavioural_score: 1.0,
      bot_score: 1.0,
      agent_score: 0.5,
      is_bot: true,
      is_agent: true,
    });
    for (const k of [
      'risk_score', 'classification', 'recommended_action',
      'behavioural_score', 'bot_score', 'agent_score',
      'is_bot', 'is_agent',
    ]) {
      expect(out).not.toHaveProperty(k);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Determinism + size_bytes via stableStringify
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — determinism', () => {
  it('returns identical output across repeated calls with same input', () => {
    const a = buildFromBrowser({ properties: { z: 1, a: 2 } });
    const b = buildFromBrowser({ properties: { z: 1, a: 2 } });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('size_bytes is computed via stableStringify (key-order-independent)', () => {
    const a = buildFromBrowser({ properties: { z: 1, a: 2 } });
    // Same logical input, different key order on properties.
    const b = buildFromBrowser({ properties: { a: 2, z: 1 } });
    expect(a.size_bytes).toBe(b.size_bytes);
  });

  it('different content produces different size_bytes', () => {
    const a = buildFromBrowser({ properties: { x: 1 } });
    const b = buildFromBrowser({ properties: { x: 1, y: 2 } });
    expect(a.size_bytes).not.toBe(b.size_bytes);
  });
});

// ---------------------------------------------------------------------------
// 9. CRITICAL: payloadSha256(normalisedEnvelope) !== payloadSha256(canonical_jsonb)
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — distinct from canonical_jsonb', () => {
  it('payloadSha256(normalisedEnvelope) differs from payloadSha256(canonical_jsonb)', () => {
    const normalised = buildFromBrowser({
      anonymous_id: 'a_alpha',
      page_url: 'https://example.com/p',
      properties: { color: 'blue' },
    });

    const canonical = buildCanonicalJsonb({
      validated: validatedBrowser,
      resolved: baseResolved,
      ctx: baseCtx,
      optional: {
        session_seq: null,
        traffic_class: 'unknown',
        consent_state: null,
        consent_source: null,
        tracking_mode: null,
        storage_mechanism: null,
      },
    });

    const hashNormalised = payloadSha256(normalised);
    const hashCanonical = payloadSha256(canonical);
    expect(hashNormalised).not.toBe(hashCanonical);
  });

  it('normalisedEnvelope has more keys than canonical_jsonb (36 vs 19)', () => {
    const normalised = buildFromBrowser();
    const canonical = buildCanonicalJsonb({
      validated: validatedBrowser,
      resolved: baseResolved,
      ctx: baseCtx,
    });
    expect(Object.keys(normalised).length).toBe(36);
    expect(Object.keys(canonical).length).toBe(19);
    expect(Object.keys(normalised).length).toBeGreaterThan(Object.keys(canonical).length);
  });

  it('normalisedEnvelope contains page_url / properties / context which canonical_jsonb excludes', () => {
    const normalised = buildFromBrowser({
      page_url: 'https://example.com/p',
      properties: { x: 1 },
      context: { y: 2 },
    });
    expect(normalised).toHaveProperty('page_url');
    expect(normalised).toHaveProperty('properties');
    expect(normalised).toHaveProperty('context');

    const canonical = buildCanonicalJsonb({
      validated: validatedBrowser,
      resolved: baseResolved,
      ctx: baseCtx,
    });
    expect(canonical).not.toHaveProperty('page_url');
    expect(canonical).not.toHaveProperty('properties');
    expect(canonical).not.toHaveProperty('context');
  });
});

// ---------------------------------------------------------------------------
// 10. Server-origin events
// ---------------------------------------------------------------------------

describe('buildAcceptedNormalisedEnvelope — server-origin events', () => {
  it('emits session_id=null for server-origin events with no session', () => {
    const out = buildAcceptedNormalisedEnvelope({
      validated: validatedServer,
      resolved: baseResolved,
      ctx: baseCtx,
      raw_event: {},
      config: baseConfig,
    });
    expect(out.session_id).toBeNull();
    expect(out.event_origin).toBe('server');
    expect(out.event_type).toBe('track');
  });
});

// ---------------------------------------------------------------------------
// 11. Module-level scope discipline (Track B only)
// ---------------------------------------------------------------------------

describe('normalised-envelope.ts — import discipline (Track B only)', () => {
  it('imports only the EventValidationOk type and stableStringify', () => {
    const importStatements = source.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBe(2);
    const sources = importStatements.map(s => s.match(/from\s+['"]([^'"]+)['"]/)?.[1]).sort();
    expect(sources).toEqual(['./stable-json.js', './validation.js']);
  });

  it('does NOT read process.env / import DB / express / pino / scoring path', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT introduce scoring symbols as identifiers', () => {
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|is_bot|is_agent)\s*[:=(]/;
    expect(source).not.toMatch(forbidden);
  });

  it('does NOT call Date.now or other runtime clocks', () => {
    expect(source).not.toMatch(/\bDate\.now\s*\(/);
    expect(source).not.toMatch(/\bperformance\.now\s*\(/);
    expect(source).not.toMatch(/\bnew Date\s*\(\s*\)/);
  });

  it('does NOT register any HTTP route handler or middleware', () => {
    expect(source).not.toMatch(/\bRouter\s*\(/);
    expect(source).not.toMatch(/\b(?:app|router)\.(?:get|post|put|delete|patch|use|listen)\s*\(/);
  });
});
