/**
 * Sprint 1 PR#5a — reason-code & rejected-stage enum tests.
 *
 * Asserts the §2.8 / §2.6 enums are complete, unique, lowercase_with_underscores,
 * carry no behavioural-quality / scoring values, and import nothing from
 * Track A or Core AMS.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  REASON_CODES,
  REJECTED_STAGES,
  type ReasonCode,
  type RejectedStage,
} from '../../src/collector/v1/reason-codes.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'reason-codes.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

/** The full §2.8 list, as Helen specified in the PR#5 prompt. */
const EXPECTED_REASON_CODES: readonly string[] = [
  'auth_invalid',
  'auth_site_disabled',
  'workspace_site_mismatch',
  'content_type_invalid',
  'request_body_invalid_json',
  'request_too_large',
  'batch_too_large',
  'batch_item_count_exceeded',
  'schema_unknown',
  'schema_version_unsupported',
  'schema_version_malformed',
  'event_name_invalid',
  'event_type_invalid',
  'event_origin_invalid',
  'occurred_at_missing',
  'occurred_at_invalid',
  'occurred_at_too_old',
  'occurred_at_too_future',
  'session_id_missing',
  'session_id_invalid',
  'client_event_id_missing',
  'client_event_id_invalid',
  'missing_required_field',
  'property_type_mismatch',
  'property_not_allowed',
  'context_not_allowed',
  'pii_email_detected',
  'pii_phone_detected',
  'pii_government_id_detected',
  'pii_payment_detected',
  'pii_credential_detected',
  'consent_denied',
  'consent_required_but_missing',
  'debug_only_not_allowed',
  'duplicate_client_event_id',
  'internal_validation_error',
];

/** The §2.6 stage list. */
const EXPECTED_STAGES: readonly string[] = [
  'auth',
  'envelope',
  'validation',
  'pii',
  'boundary',
  'dedupe',
  'storage',
];

describe('REASON_CODES — §2.8 canonical reject-reason enum', () => {
  it('contains every expected §2.8 code', () => {
    for (const code of EXPECTED_REASON_CODES) {
      expect(REASON_CODES).toContain(code);
    }
  });

  it('contains exactly the expected number of codes (no extras)', () => {
    expect(REASON_CODES.length).toBe(EXPECTED_REASON_CODES.length);
  });

  it('every code is unique (no duplicates)', () => {
    expect(new Set(REASON_CODES).size).toBe(REASON_CODES.length);
  });

  it('every code is lowercase_with_underscores (matches /^[a-z][a-z0-9_]*$/)', () => {
    for (const code of REASON_CODES) {
      expect(code).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('does NOT include any behavioural-quality / scoring codes', () => {
    const forbidden = [
      'risk_score', 'classification', 'recommended_action',
      'behavioural_score', 'behavior_score',
      'bot_score', 'agent_score',
      'is_bot', 'is_agent',
    ];
    for (const code of forbidden) {
      expect(REASON_CODES).not.toContain(code as ReasonCode);
    }
  });

  it('ReasonCode type narrowing accepts a known code', () => {
    const ok: ReasonCode = 'auth_invalid';
    expect(REASON_CODES).toContain(ok);
  });
});

describe('REJECTED_STAGES — §2.6 stage enum', () => {
  it('contains exactly the 7 expected stages', () => {
    expect(REJECTED_STAGES.length).toBe(EXPECTED_STAGES.length);
    for (const s of EXPECTED_STAGES) {
      expect(REJECTED_STAGES).toContain(s);
    }
  });

  it('every stage is unique', () => {
    expect(new Set(REJECTED_STAGES).size).toBe(REJECTED_STAGES.length);
  });

  it('RejectedStage type narrowing accepts a known stage', () => {
    const s: RejectedStage = 'validation';
    expect(REJECTED_STAGES).toContain(s);
  });
});

describe('reason-codes.ts module — import discipline (Track B only)', () => {
  it('imports nothing — pure data module', () => {
    // No `import` statements at all in this module.
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  it('does NOT reference Track A or Core AMS paths', () => {
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT import a DB driver, env, logger, or HTTP module', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
  });
});
