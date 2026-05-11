/**
 * Sprint 1 PR#5b-2 — boundary wrapper tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validatePayloadBoundary } from '../../src/collector/v1/boundary.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'boundary.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

const RESOLVED = { workspace_id: 'ws_alpha', site_id: 'site_alpha' };

describe('validatePayloadBoundary — pass-through cases', () => {
  it('passes when payload is undefined', () => {
    expect(validatePayloadBoundary(RESOLVED, undefined)).toEqual({ ok: true });
  });

  it('passes when payload is null', () => {
    expect(validatePayloadBoundary(RESOLVED, null)).toEqual({ ok: true });
  });

  it('passes when payload is empty {}', () => {
    expect(validatePayloadBoundary(RESOLVED, {})).toEqual({ ok: true });
  });

  it('passes when payload values match resolved values', () => {
    expect(
      validatePayloadBoundary(RESOLVED, { workspace_id: 'ws_alpha', site_id: 'site_alpha' }),
    ).toEqual({ ok: true });
  });

  it('passes when payload fields are null (treated as not-present)', () => {
    expect(
      validatePayloadBoundary(RESOLVED, { workspace_id: null, site_id: null }),
    ).toEqual({ ok: true });
  });

  it('passes when payload fields are non-string (treated as not-present per Decision D10)', () => {
    expect(
      validatePayloadBoundary(RESOLVED, { workspace_id: 12345, site_id: ['unexpected'] }),
    ).toEqual({ ok: true });
  });
});

describe('validatePayloadBoundary — mismatch cases', () => {
  it('rejects when payload workspace_id differs', () => {
    expect(
      validatePayloadBoundary(RESOLVED, { workspace_id: 'ws_beta', site_id: 'site_alpha' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });
  });

  it('rejects when payload site_id differs (§4.1 #5 Site-A token + payload site_id=B)', () => {
    expect(
      validatePayloadBoundary(RESOLVED, { workspace_id: 'ws_alpha', site_id: 'site_beta' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });
  });

  it('rejects when both fields differ', () => {
    expect(
      validatePayloadBoundary(RESOLVED, { workspace_id: 'ws_beta', site_id: 'site_beta' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });
  });

  it('rejects when only one field is supplied and differs', () => {
    expect(
      validatePayloadBoundary(RESOLVED, { workspace_id: 'ws_attacker' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });
    expect(
      validatePayloadBoundary(RESOLVED, { site_id: 'site_attacker' }),
    ).toEqual({ ok: false, reason_code: 'workspace_site_mismatch' });
  });
});

describe('validatePayloadBoundary — result safety', () => {
  it('result never echoes payload-side workspace/site values', () => {
    const r = validatePayloadBoundary(RESOLVED, {
      workspace_id: 'leakage_canary_workspace',
      site_id: 'leakage_canary_site',
    });
    const serialised = JSON.stringify(r);
    expect(serialised).not.toContain('leakage_canary_workspace');
    expect(serialised).not.toContain('leakage_canary_site');
    expect(serialised).toContain('"reason_code":"workspace_site_mismatch"');
  });

  it('result is structurally minimal (just ok or ok+reason_code)', () => {
    const ok = validatePayloadBoundary(RESOLVED, {});
    const reject = validatePayloadBoundary(RESOLVED, { workspace_id: 'wrong' });
    expect(Object.keys(ok)).toEqual(['ok']);
    expect(Object.keys(reject).sort()).toEqual(['ok', 'reason_code']);
  });
});

describe('boundary.ts — import discipline (Track B only; PR#4 helper allowed)', () => {
  it('imports ONLY from ../../auth/workspace.js (PR#4 helper)', () => {
    const importStatements = source.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBeGreaterThan(0);
    for (const stmt of importStatements) {
      expect(stmt).toMatch(/from\s+['"]\.\.\/\.\.\/auth\/workspace\.js['"]/);
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

  it('does NOT register any HTTP route handler or middleware', () => {
    expect(source).not.toMatch(/\bRouter\s*\(/);
    expect(source).not.toMatch(/\b(?:app|router)\.(?:get|post|put|delete|patch|use|listen)\s*\(/);
  });
});
