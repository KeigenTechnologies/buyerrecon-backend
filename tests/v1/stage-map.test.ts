/**
 * Sprint 1 PR#5b-1 — reason-code → stage map tests.
 *
 * Asserts the map covers every §2.8 ReasonCode exactly once and routes each
 * code to the correct §2.6 RejectedStage. Pure-function tests; no DB / env / I/O.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  REASON_CODES,
  REJECTED_STAGES,
  type ReasonCode,
} from '../../src/collector/v1/reason-codes.js';
import {
  REASON_CODE_TO_STAGE,
  stageForReasonCode,
} from '../../src/collector/v1/stage-map.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'stage-map.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

describe('REASON_CODE_TO_STAGE — completeness', () => {
  it('maps every ReasonCode in REASON_CODES', () => {
    for (const code of REASON_CODES) {
      expect(REASON_CODE_TO_STAGE).toHaveProperty(code);
    }
  });

  it('every mapped value is one of the 7 RejectedStages', () => {
    const validStages = new Set<string>(REJECTED_STAGES);
    for (const code of REASON_CODES) {
      expect(validStages.has(REASON_CODE_TO_STAGE[code])).toBe(true);
    }
  });

  it('has no extra keys beyond REASON_CODES', () => {
    const expected = new Set<string>(REASON_CODES);
    for (const k of Object.keys(REASON_CODE_TO_STAGE)) {
      expect(expected.has(k)).toBe(true);
    }
  });

  it('key count equals REASON_CODES count (currently 36)', () => {
    expect(Object.keys(REASON_CODE_TO_STAGE).length).toBe(REASON_CODES.length);
  });
});

describe('REASON_CODE_TO_STAGE — explicit per-group mapping', () => {
  it('auth codes → "auth"', () => {
    expect(REASON_CODE_TO_STAGE.auth_invalid).toBe('auth');
    expect(REASON_CODE_TO_STAGE.auth_site_disabled).toBe('auth');
  });

  it('workspace_site_mismatch → "boundary"', () => {
    expect(REASON_CODE_TO_STAGE.workspace_site_mismatch).toBe('boundary');
  });

  it('all envelope codes → "envelope"', () => {
    expect(REASON_CODE_TO_STAGE.content_type_invalid).toBe('envelope');
    expect(REASON_CODE_TO_STAGE.request_body_invalid_json).toBe('envelope');
    expect(REASON_CODE_TO_STAGE.request_too_large).toBe('envelope');
    expect(REASON_CODE_TO_STAGE.batch_too_large).toBe('envelope');
    expect(REASON_CODE_TO_STAGE.batch_item_count_exceeded).toBe('envelope');
  });

  it('all pii_* codes → "pii"', () => {
    expect(REASON_CODE_TO_STAGE.pii_email_detected).toBe('pii');
    expect(REASON_CODE_TO_STAGE.pii_phone_detected).toBe('pii');
    expect(REASON_CODE_TO_STAGE.pii_government_id_detected).toBe('pii');
    expect(REASON_CODE_TO_STAGE.pii_payment_detected).toBe('pii');
    expect(REASON_CODE_TO_STAGE.pii_credential_detected).toBe('pii');
  });

  it('duplicate_client_event_id → "dedupe"', () => {
    expect(REASON_CODE_TO_STAGE.duplicate_client_event_id).toBe('dedupe');
  });

  it('internal_validation_error → "storage"', () => {
    expect(REASON_CODE_TO_STAGE.internal_validation_error).toBe('storage');
  });

  it('all remaining schema/event/time/session/client/field/consent/debug codes → "validation"', () => {
    const validationCodes: ReasonCode[] = [
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
      'consent_denied',
      'consent_required_but_missing',
      'debug_only_not_allowed',
    ];
    for (const c of validationCodes) {
      expect(REASON_CODE_TO_STAGE[c]).toBe('validation');
    }
  });
});

describe('stageForReasonCode — function helper', () => {
  it('returns the same value as REASON_CODE_TO_STAGE for every reason', () => {
    for (const code of REASON_CODES) {
      expect(stageForReasonCode(code)).toBe(REASON_CODE_TO_STAGE[code]);
    }
  });
});

describe('stage-map.ts — no scoring / bot / agent codes anywhere in the map', () => {
  it('does not include any behavioural-quality / scoring code as a key', () => {
    const forbidden = [
      'risk_score',
      'classification',
      'recommended_action',
      'behavioural_score',
      'behavior_score',
      'bot_score',
      'agent_score',
      'is_bot',
      'is_agent',
    ];
    for (const k of forbidden) {
      expect(Object.keys(REASON_CODE_TO_STAGE)).not.toContain(k);
    }
  });
});

describe('stage-map.ts — import discipline (Track B only)', () => {
  it('imports only types from ./reason-codes.js', () => {
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
});
