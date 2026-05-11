/**
 * Sprint 1 PR#5b-2 — PII regex detection tests.
 *
 * Pure-function tests. No DB / env / network.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  scanForPii,
  firstPiiReasonCode,
  passesLuhn,
  STRUCTURAL_ID_KEYS,
  type PiiHit,
} from '../../src/collector/v1/pii.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'pii.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

const findHit = (hits: PiiHit[], kind: string): PiiHit | undefined =>
  hits.find(h => h.kind === kind);

// ---------------------------------------------------------------------------
// passesLuhn
// ---------------------------------------------------------------------------

describe('passesLuhn', () => {
  it('returns true for known-valid card numbers', () => {
    expect(passesLuhn('4111111111111111')).toBe(true);   // Visa test
    expect(passesLuhn('5555555555554444')).toBe(true);   // Mastercard test
    expect(passesLuhn('378282246310005')).toBe(true);    // Amex test (15 digits)
    expect(passesLuhn('6011111111111117')).toBe(true);   // Discover test
  });

  it('returns false for known-invalid digit strings of valid length', () => {
    expect(passesLuhn('4111111111111112')).toBe(false);  // off-by-one
    expect(passesLuhn('1234567890123')).toBe(false);     // 13-digit non-Luhn
  });

  it('returns false for digit-only strings outside [13, 19]', () => {
    expect(passesLuhn('123456789012')).toBe(false);      // 12 digits — too short
    expect(passesLuhn('12345678901234567890')).toBe(false); // 20 digits — too long
  });

  it('handles strings with embedded separators by stripping them', () => {
    expect(passesLuhn('4111 1111 1111 1111')).toBe(true);
    expect(passesLuhn('4111-1111-1111-1111')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// email
// ---------------------------------------------------------------------------

describe('scanForPii — email', () => {
  it('detects a bare email value', () => {
    const hits = scanForPii({ notes: 'a@b.com' });
    expect(findHit(hits, 'email')).toBeDefined();
    expect(findHit(hits, 'email')!.reason_code).toBe('pii_email_detected');
    expect(findHit(hits, 'email')!.path).toBe('notes');
  });

  it('detects an email with plus-tag and multi-label TLD', () => {
    const hits = scanForPii({ notes: 'Test+tag@example.co.uk' });
    expect(findHit(hits, 'email')).toBeDefined();
  });

  it('detects an email embedded in surrounding text', () => {
    const hits = scanForPii({ notes: 'please contact alice@example.com asap' });
    expect(findHit(hits, 'email')).toBeDefined();
    expect(findHit(hits, 'email')!.path).toBe('notes');
  });

  it('does NOT flag strings without an at-sign', () => {
    const hits = scanForPii({ notes: 'no contact info here' });
    expect(findHit(hits, 'email')).toBeUndefined();
  });

  it('does NOT flag a bare local part with no TLD', () => {
    const hits = scanForPii({ notes: 'a@b' });
    expect(findHit(hits, 'email')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// phone
// ---------------------------------------------------------------------------

describe('scanForPii — phone', () => {
  it('detects a UK-style international phone number', () => {
    const hits = scanForPii({ notes: 'call +44 20 7946 0000 today' });
    expect(findHit(hits, 'phone')).toBeDefined();
    expect(findHit(hits, 'phone')!.reason_code).toBe('pii_phone_detected');
  });

  it('detects a US-style parenthesised phone number', () => {
    const hits = scanForPii({ notes: '(415) 555-0123 office' });
    expect(findHit(hits, 'phone')).toBeDefined();
  });

  it('detects a 10-digit contiguous phone number', () => {
    const hits = scanForPii({ notes: '4155550123' });
    expect(findHit(hits, 'phone')).toBeDefined();
  });

  it('does NOT flag a short 5-digit code (digit density floor)', () => {
    const hits = scanForPii({ notes: '12345' });
    expect(findHit(hits, 'phone')).toBeUndefined();
  });

  it('does NOT flag a UUIDv4 (letters interrupt phone match groups)', () => {
    const hits = scanForPii({ notes: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });
    expect(findHit(hits, 'phone')).toBeUndefined();
  });

  it('does NOT flag a semver string', () => {
    const hits = scanForPii({ notes: 'version 1.2.3 deployed' });
    expect(findHit(hits, 'phone')).toBeUndefined();
  });

  it('does NOT flag an ISO timestamp string', () => {
    const hits = scanForPii({ notes: '2026-05-10T12:00:00Z' });
    expect(findHit(hits, 'phone')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// government_id — US SSN + UK NI (Decision D1)
// ---------------------------------------------------------------------------

describe('scanForPii — government_id (US SSN)', () => {
  it('detects a strict 3-2-4 hyphenated SSN', () => {
    const hits = scanForPii({ notes: 'SSN 123-45-6789 on file' });
    expect(findHit(hits, 'government_id')).toBeDefined();
    expect(findHit(hits, 'government_id')!.reason_code).toBe('pii_government_id_detected');
  });

  it('does NOT flag a bare 9-digit number (no hyphenation)', () => {
    const hits = scanForPii({ notes: 'reference 123456789' });
    expect(findHit(hits, 'government_id')).toBeUndefined();
  });

  it('does NOT flag wrong shape (4-2-3 hyphenation)', () => {
    const hits = scanForPii({ notes: 'reference 1234-56-789' });
    expect(findHit(hits, 'government_id')).toBeUndefined();
  });
});

describe('scanForPii — government_id (UK NI)', () => {
  it('detects a strict UK NI number (AB123456C)', () => {
    const hits = scanForPii({ notes: 'NI AB123456C' });
    expect(findHit(hits, 'government_id')).toBeDefined();
  });

  it('does NOT flag a string with an invalid UK NI prefix letter', () => {
    // 'D' is not in the admit set [A-CEGHJ-PR-TW-Z], so 'DD' is rejected.
    const hits = scanForPii({ notes: 'reference DD123456C' });
    expect(findHit(hits, 'government_id')).toBeUndefined();
  });

  it('does NOT flag a UK-NI-shape string with invalid suffix letter', () => {
    // 'E' is not in the suffix admit set [A-D].
    const hits = scanForPii({ notes: 'reference AB123456E' });
    expect(findHit(hits, 'government_id')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// payment — Luhn-gated (Decision D6)
// ---------------------------------------------------------------------------

describe('scanForPii — payment', () => {
  it('flags a Luhn-valid Visa-shape card number embedded in text', () => {
    const hits = scanForPii({ notes: 'card 4111111111111111 thanks' });
    expect(findHit(hits, 'payment')).toBeDefined();
    expect(findHit(hits, 'payment')!.reason_code).toBe('pii_payment_detected');
  });

  it('flags a Luhn-valid card number with space separators', () => {
    const hits = scanForPii({ notes: 'card 4111 1111 1111 1111' });
    expect(findHit(hits, 'payment')).toBeDefined();
  });

  it('flags a Luhn-valid Amex (15-digit) card number', () => {
    const hits = scanForPii({ notes: 'amex 378282246310005' });
    expect(findHit(hits, 'payment')).toBeDefined();
  });

  it('does NOT flag a 13-digit non-Luhn number', () => {
    const hits = scanForPii({ client_event_id: '1234567890123' });
    expect(findHit(hits, 'payment')).toBeUndefined();
  });

  it('does NOT flag a 12-digit number (below card length)', () => {
    const hits = scanForPii({ client_event_id: '123456789012' });
    expect(findHit(hits, 'payment')).toBeUndefined();
  });

  it('does NOT flag a hex string with letters', () => {
    const hits = scanForPii({ notes: 'sha256 deadbeefcafebabe1234567890' });
    expect(findHit(hits, 'payment')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// credential — high-confidence markers (Decision D2)
// ---------------------------------------------------------------------------

describe('scanForPii — credential', () => {
  it('detects a private key block marker', () => {
    const hits = scanForPii({
      notes: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
    });
    expect(findHit(hits, 'credential')).toBeDefined();
    expect(findHit(hits, 'credential')!.reason_code).toBe('pii_credential_detected');
  });

  it('detects an OPENSSH PRIVATE KEY block marker', () => {
    const hits = scanForPii({
      notes: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXkt...\n',
    });
    expect(findHit(hits, 'credential')).toBeDefined();
  });

  it('detects an AWS access key id', () => {
    const hits = scanForPii({ notes: 'cred AKIAIOSFODNN7EXAMPLE token' });
    expect(findHit(hits, 'credential')).toBeDefined();
  });

  it('detects a GitHub personal access token', () => {
    // ghp_ prefix + 40-char body
    const hits = scanForPii({ notes: 'token=ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD' });
    expect(findHit(hits, 'credential')).toBeDefined();
  });

  it('detects a Slack bot token', () => {
    // Build the fixture at runtime so GitHub push protection does not see a
    // contiguous Slack-token-looking secret in the repository text.
    const slackToken = ['xoxb', '1234567890', '9876543210', 'AbCdEfGhIjKlMnOp'].join('-');
    const hits = scanForPii({ notes: `slack=${slackToken}` });
    expect(findHit(hits, 'credential')).toBeDefined();
  });

  it('detects a Google API key', () => {
    // Real Google API keys are 39 chars total: 'AIza' (4) + 35-char body.
    const hits = scanForPii({ notes: 'key=AIzaSyA-aBcDeFgHiJkLmNoPqRsTuVwXyZ01234' });
    expect(findHit(hits, 'credential')).toBeDefined();
  });

  it('does NOT flag a random alphanumeric string that lacks credential prefixes', () => {
    const hits = scanForPii({ notes: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH' });
    expect(findHit(hits, 'credential')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// STRUCTURAL_ID_KEYS exemption
// ---------------------------------------------------------------------------

describe('scanForPii — STRUCTURAL_ID_KEYS exemption', () => {
  it('exempts request_id from email/phone scanning', () => {
    const hits = scanForPii({ request_id: '4155550123' });
    expect(findHit(hits, 'phone')).toBeUndefined();
  });

  it('exempts client_event_id from email/phone scanning', () => {
    const hits = scanForPii({ client_event_id: '4155550123' });
    expect(findHit(hits, 'phone')).toBeUndefined();
  });

  it('exempts session_id from email/phone scanning', () => {
    const hits = scanForPii({ session_id: 'a@b.com' });
    expect(findHit(hits, 'email')).toBeUndefined();
  });

  it('exempts browser_id from email/phone scanning', () => {
    const hits = scanForPii({ browser_id: '4155550123' });
    expect(findHit(hits, 'phone')).toBeUndefined();
  });

  it('exempts anonymous_id from email/phone scanning', () => {
    const hits = scanForPii({ anonymous_id: '4155550123' });
    expect(findHit(hits, 'phone')).toBeUndefined();
  });

  it('cascades exemption through nested sub-trees of structural keys', () => {
    const hits = scanForPii({
      session_id: { nested: { value: 'a@b.com' } },
    });
    expect(findHit(hits, 'email')).toBeUndefined();
  });

  it('STILL detects a credential under a structural-key sub-tree (high-confidence)', () => {
    const hits = scanForPii({ session_id: 'AKIAIOSFODNN7EXAMPLE' });
    expect(findHit(hits, 'credential')).toBeDefined();
  });

  it('STILL detects a Luhn-valid card under a structural-key sub-tree', () => {
    const hits = scanForPii({ session_id: '4111111111111111' });
    expect(findHit(hits, 'payment')).toBeDefined();
  });

  it('STILL detects a US SSN under a structural-key sub-tree', () => {
    const hits = scanForPii({ session_id: '123-45-6789' });
    expect(findHit(hits, 'government_id')).toBeDefined();
  });

  it('STRUCTURAL_ID_KEYS contains expected core entries (sample assertion)', () => {
    expect(STRUCTURAL_ID_KEYS.has('request_id')).toBe(true);
    expect(STRUCTURAL_ID_KEYS.has('client_event_id')).toBe(true);
    expect(STRUCTURAL_ID_KEYS.has('session_id')).toBe(true);
    expect(STRUCTURAL_ID_KEYS.has('browser_id')).toBe(true);
    expect(STRUCTURAL_ID_KEYS.has('anonymous_id')).toBe(true);
    expect(STRUCTURAL_ID_KEYS.has('workspace_id')).toBe(true);
    expect(STRUCTURAL_ID_KEYS.has('site_id')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Path reporting
// ---------------------------------------------------------------------------

describe('scanForPii — path reporting', () => {
  it('reports the path for a top-level key', () => {
    const hits = scanForPii({ notes: 'a@b.com' });
    expect(hits[0]!.path).toBe('notes');
  });

  it('reports the dot-path for nested object keys', () => {
    const hits = scanForPii({ user: { contact: { details: 'a@b.com' } } });
    expect(hits[0]!.path).toBe('user.contact.details');
  });

  it('reports bracket-indexed paths for arrays', () => {
    const hits = scanForPii({ events: [{ notes: 'a@b.com' }] });
    expect(hits[0]!.path).toBe('events[0].notes');
  });

  it('reports a deeper combined path for nested arrays inside objects', () => {
    const hits = scanForPii({ payload: { batch: [{ notes: 'a@b.com' }] } });
    expect(hits[0]!.path).toBe('payload.batch[0].notes');
  });
});

// ---------------------------------------------------------------------------
// PiiHit must NOT include the matched string
// ---------------------------------------------------------------------------

describe('PiiHit safety — never echoes raw value', () => {
  it('JSON-stringified hit does not contain the matched email value', () => {
    const hits = scanForPii({ notes: 'mail leakage_canary_xyz@example.com' });
    const serialised = JSON.stringify(hits);
    expect(serialised).not.toContain('leakage_canary_xyz');
    expect(serialised).not.toContain('@example.com');
    // Sanity — the serialised form contains expected fields.
    expect(serialised).toContain('"path":"notes"');
    expect(serialised).toContain('"reason_code":"pii_email_detected"');
  });

  it('JSON-stringified hit does not contain the matched card number', () => {
    const hits = scanForPii({ notes: 'card 4111111111111111' });
    const serialised = JSON.stringify(hits);
    expect(serialised).not.toContain('4111111111111111');
  });

  it('hit object has only kind, reason_code, path keys', () => {
    const hits = scanForPii({ notes: 'a@b.com' });
    expect(hits.length).toBeGreaterThan(0);
    const keys = Object.keys(hits[0]!).sort();
    expect(keys).toEqual(['kind', 'path', 'reason_code']);
  });
});

// ---------------------------------------------------------------------------
// firstPiiReasonCode determinism (Decision D6)
// ---------------------------------------------------------------------------

describe('firstPiiReasonCode — first by traversal order', () => {
  it('returns null on a clean input', () => {
    expect(firstPiiReasonCode({ a: 'no pii here', b: 12345 })).toBeNull();
  });

  it('returns the first hit in traversal order across multiple keys', () => {
    // Two PII values: email at .a, phone at .b. .a comes first in traversal.
    expect(firstPiiReasonCode({ a: 'a@b.com', b: '+44 20 7946 0000' })).toBe(
      'pii_email_detected',
    );
    // Reverse traversal order:
    expect(firstPiiReasonCode({ b: '+44 20 7946 0000', a: 'a@b.com' })).toBe(
      'pii_phone_detected',
    );
  });

  it('returns null when only structural-key values would otherwise FP', () => {
    expect(firstPiiReasonCode({ session_id: '4155550123' })).toBeNull();
  });

  it('is deterministic on repeated calls', () => {
    const input = { user: { contact: 'a@b.com' }, events: [{ notes: '+44 20 7946 0000' }] };
    expect(firstPiiReasonCode(input)).toBe(firstPiiReasonCode(input));
  });

  it('returns the credential code first when credential and email coexist in the same string', () => {
    // Within a single string, canonical detector order is credential → ... → email.
    const input = { notes: 'token=ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD; help@org.com' };
    expect(firstPiiReasonCode(input)).toBe('pii_credential_detected');
  });
});

// ---------------------------------------------------------------------------
// Module-level scope discipline (Track B only)
// ---------------------------------------------------------------------------

describe('pii.ts — import discipline (Track B only)', () => {
  it('imports only the ReasonCode type from ./reason-codes.js (and node:crypto-free)', () => {
    const importStatements = source.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBeGreaterThan(0);
    for (const stmt of importStatements) {
      expect(stmt).toMatch(/from\s+['"]\.\/reason-codes\.js['"]/);
      expect(stmt).toMatch(/^import\s+type\s/);
    }
  });

  it('does NOT read process.env / import a DB driver / express / pino / scoring path', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT introduce scoring symbols anywhere in source', () => {
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|is_bot|is_agent)\b/;
    expect(source).not.toMatch(forbidden);
  });
});
