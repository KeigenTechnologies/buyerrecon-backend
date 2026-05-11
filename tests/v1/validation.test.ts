/**
 * Sprint 1 PR#5b-1 — core per-event validation tests.
 *
 * Pure-function tests; no DB / env / network. The clock is overridden via
 * `now_ms` so occurred_at-window tests are deterministic.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectClientEventIdFormat,
  validateEventTypeOrigin,
  validateEventCore,
  type EventValidationOk,
  type EventValidationReject,
} from '../../src/collector/v1/validation.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'validation.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

// ---- Fixtures ----

/** Strict v4 — version nibble = 4, RFC 4122 variant. */
const UUID_V4 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
/** Strict v7 — version nibble = 7, RFC 4122 variant. */
const UUID_V7 = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
/** v5 — version nibble = 5; rejected in Sprint 1. */
const UUID_V5 = '2ed6657d-e927-568b-95e1-2665a8aea6a2';

/** Fixed test clock. Sprint-1-shaped timestamps relative to NOW. */
const NOW = 1_700_000_000_000;

const validBrowserEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  event_origin: 'browser',
  event_type: 'page',
  event_name: 'page_view',
  schema_key: 'br.page',
  schema_version: '1.0.0',
  client_event_id: UUID_V4,
  occurred_at: NOW - 1000,
  session_id: 'sess_alpha',
  ...overrides,
});

const validServerEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  event_origin: 'server',
  event_type: 'track',
  event_name: 'lead_qualified',
  schema_key: 'br.track',
  schema_version: '1.0.0',
  client_event_id: UUID_V7,
  occurred_at: NOW - 1000,
  // session_id omitted (server-origin events may have null session_id per R-3)
  ...overrides,
});

const validateBrowser = (overrides: Record<string, unknown> = {}) =>
  validateEventCore({ event: validBrowserEvent(overrides), now_ms: NOW });

const validateServer = (overrides: Record<string, unknown> = {}) =>
  validateEventCore({ event: validServerEvent(overrides), now_ms: NOW });

const expectAccept = (r: EventValidationOk | EventValidationReject): EventValidationOk => {
  if (!r.ok) throw new Error(`expected accept, got ${r.reason_code}`);
  return r;
};

const expectReject = (r: EventValidationOk | EventValidationReject): EventValidationReject => {
  if (r.ok) throw new Error('expected reject, got ok');
  return r;
};

// ---------------------------------------------------------------------------
// 1. detectClientEventIdFormat
// ---------------------------------------------------------------------------

describe('detectClientEventIdFormat', () => {
  it('accepts strict UUIDv4', () => {
    expect(detectClientEventIdFormat(UUID_V4)).toBe('uuidv4');
  });

  it('accepts strict UUIDv7', () => {
    expect(detectClientEventIdFormat(UUID_V7)).toBe('uuidv7');
  });

  it('rejects UUIDv5 (version nibble = 5) → "invalid"', () => {
    expect(detectClientEventIdFormat(UUID_V5)).toBe('invalid');
  });

  it('rejects an opaque short string → "invalid"', () => {
    expect(detectClientEventIdFormat('abc-123')).toBe('invalid');
  });

  it('rejects an integer (not a string) → "invalid"', () => {
    expect(detectClientEventIdFormat(12345)).toBe('invalid');
  });

  it('rejects an empty string → "invalid"', () => {
    expect(detectClientEventIdFormat('')).toBe('invalid');
  });

  it('rejects null / undefined → "invalid"', () => {
    expect(detectClientEventIdFormat(null)).toBe('invalid');
    expect(detectClientEventIdFormat(undefined)).toBe('invalid');
  });

  it('rejects a UUIDv4 with the wrong RFC 4122 variant nibble → "invalid"', () => {
    // Same as UUID_V4 but variant nibble flipped to '0' (not in 8/9/a/b).
    const bad = 'f47ac10b-58cc-4372-0567-0e02b2c3d479';
    expect(detectClientEventIdFormat(bad)).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// 2. validateEventTypeOrigin (R-10 matrix)
// ---------------------------------------------------------------------------

describe('validateEventTypeOrigin', () => {
  it('browser + page → ok', () => {
    expect(validateEventTypeOrigin('browser', 'page')).toBeNull();
  });

  it('browser + track → ok', () => {
    expect(validateEventTypeOrigin('browser', 'track')).toBeNull();
  });

  it('browser + identify → event_type_invalid', () => {
    expect(validateEventTypeOrigin('browser', 'identify')).toBe('event_type_invalid');
  });

  it('browser + group → event_type_invalid', () => {
    expect(validateEventTypeOrigin('browser', 'group')).toBe('event_type_invalid');
  });

  it('browser + system → event_type_invalid', () => {
    expect(validateEventTypeOrigin('browser', 'system')).toBe('event_type_invalid');
  });

  it('server + track / identify / group / system → ok', () => {
    expect(validateEventTypeOrigin('server', 'track')).toBeNull();
    expect(validateEventTypeOrigin('server', 'identify')).toBeNull();
    expect(validateEventTypeOrigin('server', 'group')).toBeNull();
    expect(validateEventTypeOrigin('server', 'system')).toBeNull();
  });

  it('server + page → event_type_invalid', () => {
    expect(validateEventTypeOrigin('server', 'page')).toBe('event_type_invalid');
  });

  it('agent_ai → event_origin_invalid (reserved)', () => {
    expect(validateEventTypeOrigin('agent_ai', 'page')).toBe('event_origin_invalid');
  });

  it('agent_human → event_origin_invalid (reserved)', () => {
    expect(validateEventTypeOrigin('agent_human', 'page')).toBe('event_origin_invalid');
  });

  it('unknown origin → event_origin_invalid', () => {
    expect(validateEventTypeOrigin('iot', 'page')).toBe('event_origin_invalid');
    expect(validateEventTypeOrigin('', 'page')).toBe('event_origin_invalid');
    expect(validateEventTypeOrigin(null, 'page')).toBe('event_origin_invalid');
    expect(validateEventTypeOrigin(undefined, 'page')).toBe('event_origin_invalid');
  });

  it('unknown event_type with valid origin → event_type_invalid', () => {
    expect(validateEventTypeOrigin('browser', 'click')).toBe('event_type_invalid');
    expect(validateEventTypeOrigin('browser', '')).toBe('event_type_invalid');
    expect(validateEventTypeOrigin('browser', null)).toBe('event_type_invalid');
  });
});

// ---------------------------------------------------------------------------
// 3. validateEventCore — happy paths
// ---------------------------------------------------------------------------

describe('validateEventCore — happy paths', () => {
  it('accepts a valid browser page event', () => {
    const r = expectAccept(validateBrowser());
    expect(r.event_origin).toBe('browser');
    expect(r.event_type).toBe('page');
    expect(r.id_format).toBe('uuidv4');
    expect(r.session_id).toBe('sess_alpha');
  });

  it('accepts a valid server track event with session_id omitted (R-3)', () => {
    const r = expectAccept(validateServer());
    expect(r.event_origin).toBe('server');
    expect(r.session_id).toBeNull();
    expect(r.id_format).toBe('uuidv7');
  });

  it('accepts a server event with explicit null session_id', () => {
    const r = expectAccept(validateServer({ session_id: null }));
    expect(r.session_id).toBeNull();
  });

  it('accepts a server identify event', () => {
    const r = expectAccept(validateServer({ event_type: 'identify', event_name: 'user_seen' }));
    expect(r.event_type).toBe('identify');
  });

  it('accepts a server group event', () => {
    const r = expectAccept(validateServer({ event_type: 'group', event_name: 'company_seen' }));
    expect(r.event_type).toBe('group');
  });

  it('accepts a server system event', () => {
    const r = expectAccept(validateServer({ event_type: 'system', event_name: 'heartbeat' }));
    expect(r.event_type).toBe('system');
  });

  it('accepts occurred_at as an ISO string', () => {
    const iso = new Date(NOW - 1000).toISOString();
    const r = expectAccept(validateBrowser({ occurred_at: iso }));
    expect(r.occurred_at.getTime()).toBe(new Date(iso).getTime());
  });
});

// ---------------------------------------------------------------------------
// 4. validateEventCore — required fields (R-2)
// ---------------------------------------------------------------------------

describe('validateEventCore — R-2 required fields', () => {
  it('rejects when event is not an object', () => {
    expect(validateEventCore({ event: null, now_ms: NOW })).toEqual({
      ok: false,
      reason_code: 'missing_required_field',
    });
    expect(validateEventCore({ event: 'not-an-event', now_ms: NOW })).toEqual({
      ok: false,
      reason_code: 'missing_required_field',
    });
    expect(validateEventCore({ event: [{}], now_ms: NOW })).toEqual({
      ok: false,
      reason_code: 'missing_required_field',
    });
  });

  it('rejects missing event_name → event_name_invalid', () => {
    const r = expectReject(validateBrowser({ event_name: undefined }));
    expect(r.reason_code).toBe('event_name_invalid');
  });

  it('rejects empty event_name → event_name_invalid', () => {
    const r = expectReject(validateBrowser({ event_name: '' }));
    expect(r.reason_code).toBe('event_name_invalid');
  });

  it('rejects missing schema_key → schema_unknown', () => {
    const r = expectReject(validateBrowser({ schema_key: undefined }));
    expect(r.reason_code).toBe('schema_unknown');
  });

  it('rejects missing schema_version → schema_version_malformed', () => {
    const r = expectReject(validateBrowser({ schema_version: undefined }));
    expect(r.reason_code).toBe('schema_version_malformed');
  });

  it('rejects malformed schema_version → schema_version_malformed', () => {
    expect(expectReject(validateBrowser({ schema_version: '1.0' })).reason_code).toBe(
      'schema_version_malformed',
    );
    expect(expectReject(validateBrowser({ schema_version: '1' })).reason_code).toBe(
      'schema_version_malformed',
    );
    expect(expectReject(validateBrowser({ schema_version: 'abc' })).reason_code).toBe(
      'schema_version_malformed',
    );
    expect(expectReject(validateBrowser({ schema_version: '1.0.0-beta' })).reason_code).toBe(
      'schema_version_malformed',
    );
  });
});

// ---------------------------------------------------------------------------
// 5. validateEventCore — R-3 session_id rules
// ---------------------------------------------------------------------------

describe('validateEventCore — R-3 session_id rules', () => {
  it('rejects browser missing session_id → session_id_missing', () => {
    const r = expectReject(validateBrowser({ session_id: undefined }));
    expect(r.reason_code).toBe('session_id_missing');
  });

  it('rejects browser empty session_id → session_id_missing', () => {
    const r = expectReject(validateBrowser({ session_id: '' }));
    expect(r.reason_code).toBe('session_id_missing');
  });

  it('rejects server non-string non-null session_id → session_id_invalid', () => {
    const r = expectReject(validateServer({ session_id: 12345 }));
    expect(r.reason_code).toBe('session_id_invalid');
  });

  it('accepts server explicit null session_id', () => {
    const r = expectAccept(validateServer({ session_id: null }));
    expect(r.session_id).toBeNull();
  });

  it('accepts server explicit string session_id', () => {
    const r = expectAccept(validateServer({ session_id: 'sess_beta' }));
    expect(r.session_id).toBe('sess_beta');
  });
});

// ---------------------------------------------------------------------------
// 6. validateEventCore — R-9 id_format rules
// ---------------------------------------------------------------------------

describe('validateEventCore — R-9 client_event_id rules', () => {
  it('accepts UUIDv4', () => {
    expect(expectAccept(validateBrowser({ client_event_id: UUID_V4 })).id_format).toBe('uuidv4');
  });

  it('accepts UUIDv7', () => {
    expect(expectAccept(validateBrowser({ client_event_id: UUID_V7 })).id_format).toBe('uuidv7');
  });

  it('rejects UUIDv5 → client_event_id_invalid', () => {
    expect(expectReject(validateBrowser({ client_event_id: UUID_V5 })).reason_code).toBe(
      'client_event_id_invalid',
    );
  });

  it('rejects opaque short string → client_event_id_invalid', () => {
    expect(expectReject(validateBrowser({ client_event_id: 'short' })).reason_code).toBe(
      'client_event_id_invalid',
    );
  });

  it('rejects integer client_event_id → client_event_id_invalid', () => {
    expect(expectReject(validateBrowser({ client_event_id: 12345 })).reason_code).toBe(
      'client_event_id_invalid',
    );
  });

  it('rejects missing client_event_id → client_event_id_missing', () => {
    expect(expectReject(validateBrowser({ client_event_id: undefined })).reason_code).toBe(
      'client_event_id_missing',
    );
  });

  it('rejects empty client_event_id → client_event_id_missing', () => {
    expect(expectReject(validateBrowser({ client_event_id: '' })).reason_code).toBe(
      'client_event_id_missing',
    );
  });
});

// ---------------------------------------------------------------------------
// 7. validateEventCore — R-5 occurred_at window
// ---------------------------------------------------------------------------

describe('validateEventCore — R-5 occurred_at window', () => {
  it('rejects missing occurred_at → occurred_at_missing', () => {
    expect(expectReject(validateBrowser({ occurred_at: undefined })).reason_code).toBe(
      'occurred_at_missing',
    );
  });

  it('rejects unparseable occurred_at string → occurred_at_invalid', () => {
    expect(expectReject(validateBrowser({ occurred_at: 'not-a-date' })).reason_code).toBe(
      'occurred_at_invalid',
    );
  });

  it('rejects non-finite occurred_at number → occurred_at_invalid', () => {
    expect(expectReject(validateBrowser({ occurred_at: Number.NaN })).reason_code).toBe(
      'occurred_at_invalid',
    );
    expect(expectReject(validateBrowser({ occurred_at: Number.POSITIVE_INFINITY })).reason_code).toBe(
      'occurred_at_invalid',
    );
  });

  it('rejects > now+5min → occurred_at_too_future', () => {
    expect(
      expectReject(validateBrowser({ occurred_at: NOW + 6 * 60 * 1000 })).reason_code,
    ).toBe('occurred_at_too_future');
  });

  it('accepts at exactly now+5min', () => {
    expect(expectAccept(validateBrowser({ occurred_at: NOW + 5 * 60 * 1000 })).occurred_at.getTime())
      .toBe(NOW + 5 * 60 * 1000);
  });

  it('rejects > 24h past → occurred_at_too_old', () => {
    expect(
      expectReject(validateBrowser({ occurred_at: NOW - 25 * 60 * 60 * 1000 })).reason_code,
    ).toBe('occurred_at_too_old');
  });

  it('accepts at exactly now-24h', () => {
    expect(expectAccept(validateBrowser({ occurred_at: NOW - 24 * 60 * 60 * 1000 })).occurred_at.getTime())
      .toBe(NOW - 24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// 8. validateEventCore — R-10 origin × type matrix at validateEventCore level
// ---------------------------------------------------------------------------

describe('validateEventCore — R-10 origin × type matrix', () => {
  it('rejects agent_ai origin → event_origin_invalid', () => {
    expect(expectReject(validateBrowser({ event_origin: 'agent_ai' })).reason_code).toBe(
      'event_origin_invalid',
    );
  });

  it('rejects agent_human origin → event_origin_invalid', () => {
    expect(expectReject(validateBrowser({ event_origin: 'agent_human' })).reason_code).toBe(
      'event_origin_invalid',
    );
  });

  it('rejects unknown origin → event_origin_invalid', () => {
    expect(expectReject(validateBrowser({ event_origin: 'iot' })).reason_code).toBe(
      'event_origin_invalid',
    );
  });

  it('rejects browser identify → event_type_invalid', () => {
    expect(expectReject(validateBrowser({ event_type: 'identify' })).reason_code).toBe(
      'event_type_invalid',
    );
  });

  it('rejects browser group → event_type_invalid', () => {
    expect(expectReject(validateBrowser({ event_type: 'group' })).reason_code).toBe(
      'event_type_invalid',
    );
  });

  it('accepts server track / identify / group / system', () => {
    expect(expectAccept(validateServer({ event_type: 'track' })).event_type).toBe('track');
    expect(expectAccept(validateServer({ event_type: 'identify' })).event_type).toBe('identify');
    expect(expectAccept(validateServer({ event_type: 'group' })).event_type).toBe('group');
    expect(expectAccept(validateServer({ event_type: 'system' })).event_type).toBe('system');
  });
});

// ---------------------------------------------------------------------------
// 9. validateEventCore — R-12 debug=true rule
// ---------------------------------------------------------------------------

describe('validateEventCore — R-12 debug rule', () => {
  it('rejects payload debug=true via site-write token (default) → debug_only_not_allowed', () => {
    const r = expectReject(validateBrowser({ debug: true }));
    expect(r.reason_code).toBe('debug_only_not_allowed');
  });

  it('rejects payload debug=true via explicit site_write source_token_kind', () => {
    const r = validateEventCore({
      event: validBrowserEvent({ debug: true }),
      now_ms: NOW,
      source_token_kind: 'site_write',
    });
    expect(r.ok).toBe(false);
    expect((r as EventValidationReject).reason_code).toBe('debug_only_not_allowed');
  });

  it('accepts payload debug=true via admin source_token_kind', () => {
    const r = validateEventCore({
      event: validBrowserEvent({ debug: true }),
      now_ms: NOW,
      source_token_kind: 'admin',
    });
    expect(r.ok).toBe(true);
  });

  it('accepts payload debug=false via site-write token', () => {
    const r = expectAccept(validateBrowser({ debug: false }));
    expect(r.event_origin).toBe('browser');
  });
});

// ---------------------------------------------------------------------------
// 10. validation.ts — import discipline (Track B only)
// ---------------------------------------------------------------------------

describe('validation.ts — import discipline (Track B only)', () => {
  it('imports only the ReasonCode type from ./reason-codes.js', () => {
    const importStatements = source.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBeGreaterThan(0);
    for (const stmt of importStatements) {
      expect(stmt).toMatch(/from\s+['"]\.\/reason-codes\.js['"]/);
      expect(stmt).toMatch(/^import\s+type\s/);
    }
  });

  it('does NOT import a DB driver, env, logger, HTTP module, or scoring path', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT introduce scoring or bot/agent symbols (column-position regex on identifiers)', () => {
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|bot_score|agent_score|is_bot|is_agent)\b/;
    expect(source).not.toMatch(forbidden);
  });
});
