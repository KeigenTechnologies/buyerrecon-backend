/**
 * Sprint 1 PR#5b-2 — R-11 consent-denied validation tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  validateConsent,
  hasDeniedConsentForbiddenFields,
  isConsentStateSummary,
  type ConsentValidationResult,
} from '../../src/collector/v1/consent.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'consent.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

const denyDefault = (event: Record<string, unknown>) =>
  validateConsent({ event, config: { allowConsentStateSummary: false } });

const denyAllowed = (event: Record<string, unknown>, canonical?: Record<string, unknown> | null) =>
  validateConsent({ event, canonical, config: { allowConsentStateSummary: true } });

const expectOk = (r: ConsentValidationResult) => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason_code}`);
};
const expectReject = (r: ConsentValidationResult, code: string) => {
  if (r.ok) throw new Error(`expected reject (${code}), got ok`);
  expect(r.reason_code).toBe(code);
};

const validSummary: Record<string, unknown> = {
  event_origin: 'system',
  event_type: 'system',
  event_name: 'consent_state_summary',
  tracking_mode: 'disabled',
  storage_mechanism: 'none',
  consent_state: 'denied',
};

// ---------------------------------------------------------------------------
// 1. denied behavioural events
// ---------------------------------------------------------------------------

describe('validateConsent — denied behavioural events', () => {
  it.each([
    ['page', { event_origin: 'browser', event_type: 'page', consent_state: 'denied' }],
    ['track', { event_origin: 'browser', event_type: 'track', consent_state: 'denied' }],
    ['identify', { event_origin: 'server', event_type: 'identify', consent_state: 'denied' }],
    ['group', { event_origin: 'server', event_type: 'group', consent_state: 'denied' }],
  ])('denied + %s → consent_denied', (_label, evt) => {
    expectReject(denyDefault(evt), 'consent_denied');
  });
});

// ---------------------------------------------------------------------------
// 2. non-denied + non-buffer-only paths
// ---------------------------------------------------------------------------

describe('validateConsent — non-denied paths pass through', () => {
  it('granted consent_state passes', () => {
    expectOk(denyDefault({ event_type: 'page', consent_state: 'granted' }));
  });

  it('missing consent_state passes (consent gate is permissive when not denied)', () => {
    expectOk(denyDefault({ event_type: 'page' }));
  });

  it('non-string consent_state passes (defensive)', () => {
    expectOk(denyDefault({ event_type: 'page', consent_state: 0 }));
  });
});

// ---------------------------------------------------------------------------
// 3. tracking_mode=buffer_only
// ---------------------------------------------------------------------------

describe('validateConsent — tracking_mode=buffer_only', () => {
  it('rejects buffer_only with consent_required_but_missing regardless of consent_state', () => {
    expectReject(
      denyDefault({ event_type: 'page', consent_state: 'granted', tracking_mode: 'buffer_only' }),
      'consent_required_but_missing',
    );
  });

  it('buffer_only takes precedence over the denied-behavioural rule', () => {
    expectReject(
      denyDefault({ event_type: 'page', consent_state: 'denied', tracking_mode: 'buffer_only' }),
      'consent_required_but_missing',
    );
  });

  it('accepts other tracking_mode values when consent_state is granted', () => {
    expectOk(denyDefault({ event_type: 'page', consent_state: 'granted', tracking_mode: 'enabled' }));
  });
});

// ---------------------------------------------------------------------------
// 4. consent_state_summary exception
// ---------------------------------------------------------------------------

describe('validateConsent — consent_state_summary exception', () => {
  it('rejects consent_state_summary by default (allowConsentStateSummary=false)', () => {
    // The spec admits the summary ONLY in the (config.allowConsentStateSummary
    // === true AND strict 5-field shape AND no forbidden fields) form.
    // A denied event with event_name='consent_state_summary' but a disabled
    // config flag must be rejected with consent_denied (deny-by-default).
    expectReject(denyDefault(validSummary), 'consent_denied');
  });

  it('accepts the strict consent_state_summary shape when enabled and clean', () => {
    expectOk(denyAllowed(validSummary));
  });

  it('rejects consent_state_summary that carries any forbidden named field', () => {
    for (const field of [
      'anonymous_id',
      'user_id',
      'company_id',
      'session_id',
      'session_seq',
      'page_url',
      'page_path',
      'page_referrer',
      'page_title',
    ]) {
      const evt = { ...validSummary, [field]: 'x' };
      expectReject(denyAllowed(evt), 'consent_denied');
    }
  });

  it('rejects consent_state_summary with non-empty properties', () => {
    expectReject(denyAllowed({ ...validSummary, properties: { foo: 1 } }), 'consent_denied');
  });

  it('rejects consent_state_summary with non-empty context', () => {
    expectReject(denyAllowed({ ...validSummary, context: { foo: 1 } }), 'consent_denied');
  });

  it('accepts consent_state_summary with empty properties (Decision D8)', () => {
    expectOk(denyAllowed({ ...validSummary, properties: {} }));
  });

  it('accepts consent_state_summary with empty context (Decision D8)', () => {
    expectOk(denyAllowed({ ...validSummary, context: {} }));
  });

  it('storage_mechanism=memory is accepted', () => {
    expectOk(denyAllowed({ ...validSummary, storage_mechanism: 'memory' }));
  });

  it('storage_mechanism=cookie is rejected (not in summary admit set; deny-by-default for summary name)', () => {
    // Wrong storage mechanism → isConsentStateSummary returns false → does
    // not qualify for the strict-shape exception, even with the config flag
    // enabled. Because event_name='consent_state_summary' is still set,
    // the deny-by-default rule rejects with consent_denied.
    expectReject(
      denyAllowed({ ...validSummary, storage_mechanism: 'cookie' }),
      'consent_denied',
    );
  });

  it('does NOT qualify when event_type is not "system"', () => {
    // Non-summary shape → falls through to behavioural-set check; type=track is rejected.
    expectReject(
      denyAllowed({ ...validSummary, event_type: 'track' }),
      'consent_denied',
    );
  });

  it('denied + non-summary system event passes the consent gate (deny-by-default scoped to event_name=consent_state_summary)', () => {
    // event_name='other_system_event' → not the summary by name, so the
    // deny-by-default rule does NOT fire. event_type='system' is not
    // behavioural, so the behavioural-set rule does NOT fire either.
    // The consent gate passes; downstream R-10 / R-12 handle any further
    // rejection on this shape.
    expectOk(denyAllowed({ ...validSummary, event_name: 'other_system_event' }));
  });
});

// ---------------------------------------------------------------------------
// 5. optional canonical pass (Decision D9)
// ---------------------------------------------------------------------------

describe('validateConsent — optional canonical pass', () => {
  it('accepts when canonical is undefined (default)', () => {
    expectOk(denyAllowed(validSummary));
  });

  it('accepts when canonical is null', () => {
    expectOk(denyAllowed(validSummary, null));
  });

  it('rejects when canonical carries a forbidden named field even if event is clean', () => {
    expectReject(
      denyAllowed(validSummary, { anonymous_id: 'leaked' }),
      'consent_denied',
    );
  });

  it('rejects when canonical carries non-empty properties', () => {
    expectReject(
      denyAllowed(validSummary, { properties: { x: 1 } }),
      'consent_denied',
    );
  });

  it('accepts when canonical is empty {}', () => {
    expectOk(denyAllowed(validSummary, {}));
  });
});

// ---------------------------------------------------------------------------
// 6. result safety — never echoes payload values
// ---------------------------------------------------------------------------

describe('validateConsent — result safety', () => {
  it('result is structurally minimal (just ok or ok+reason_code)', () => {
    const r1 = denyDefault({ event_type: 'page', consent_state: 'denied' });
    const r2 = denyDefault({ event_type: 'page', consent_state: 'granted' });
    expect(Object.keys(r1).sort()).toEqual(['ok', 'reason_code']);
    expect(Object.keys(r2)).toEqual(['ok']);
  });

  it('result does not echo payload field values back to the caller', () => {
    const r = denyAllowed(validSummary, {
      anonymous_id: 'leakage_canary_anon',
      properties: { secret_field: 'leakage_canary_secret' },
    });
    const serialised = JSON.stringify(r);
    expect(serialised).not.toContain('leakage_canary_anon');
    expect(serialised).not.toContain('leakage_canary_secret');
  });
});

// ---------------------------------------------------------------------------
// 7. helpers
// ---------------------------------------------------------------------------

describe('hasDeniedConsentForbiddenFields', () => {
  it('returns false on an empty object', () => {
    expect(hasDeniedConsentForbiddenFields({})).toBe(false);
  });

  it('returns true when any named forbidden field is present (non-null)', () => {
    expect(hasDeniedConsentForbiddenFields({ anonymous_id: 'a' })).toBe(true);
    expect(hasDeniedConsentForbiddenFields({ session_id: 's' })).toBe(true);
    expect(hasDeniedConsentForbiddenFields({ page_url: '/' })).toBe(true);
  });

  it('returns false when forbidden field is null/undefined', () => {
    expect(hasDeniedConsentForbiddenFields({ anonymous_id: null })).toBe(false);
    expect(hasDeniedConsentForbiddenFields({ session_id: undefined })).toBe(false);
  });

  it('returns true on non-empty properties / context', () => {
    expect(hasDeniedConsentForbiddenFields({ properties: { x: 1 } })).toBe(true);
    expect(hasDeniedConsentForbiddenFields({ context: { y: 2 } })).toBe(true);
  });

  it('returns false on empty properties / context (Decision D8)', () => {
    expect(hasDeniedConsentForbiddenFields({ properties: {} })).toBe(false);
    expect(hasDeniedConsentForbiddenFields({ context: {} })).toBe(false);
  });
});

describe('isConsentStateSummary', () => {
  it('true on the strict 5-field shape', () => {
    expect(isConsentStateSummary(validSummary)).toBe(true);
  });

  it('true with storage_mechanism=memory', () => {
    expect(isConsentStateSummary({ ...validSummary, storage_mechanism: 'memory' })).toBe(true);
  });

  it('false when any required field differs', () => {
    expect(isConsentStateSummary({ ...validSummary, event_origin: 'browser' })).toBe(false);
    expect(isConsentStateSummary({ ...validSummary, event_type: 'track' })).toBe(false);
    expect(isConsentStateSummary({ ...validSummary, event_name: 'other' })).toBe(false);
    expect(isConsentStateSummary({ ...validSummary, tracking_mode: 'enabled' })).toBe(false);
    expect(isConsentStateSummary({ ...validSummary, storage_mechanism: 'cookie' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. import discipline
// ---------------------------------------------------------------------------

describe('consent.ts — import discipline (Track B only)', () => {
  it('imports only the ReasonCode type from ./reason-codes.js', () => {
    const importStatements = source.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBeGreaterThan(0);
    for (const stmt of importStatements) {
      expect(stmt).toMatch(/from\s+['"]\.\/reason-codes\.js['"]/);
      expect(stmt).toMatch(/^import\s+type\s/);
    }
  });

  it('does NOT read process.env / import DB / express / pino / scoring path', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT introduce scoring symbols', () => {
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|is_bot|is_agent)\b/;
    expect(source).not.toMatch(forbidden);
  });
});
