/**
 * Sprint 1 PR#5b-2 — intra-batch dedupe tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  makeDedupeKey,
  markIntraBatchDuplicates,
  type DedupeInput,
} from '../../src/collector/v1/dedupe.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'dedupe.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

const ev = (
  workspace_id: string,
  site_id: string,
  client_event_id: string | null | undefined,
): DedupeInput => ({ workspace_id, site_id, client_event_id });

describe('makeDedupeKey', () => {
  it('produces a deterministic stable join string', () => {
    const k1 = makeDedupeKey('ws', 'site', 'evt');
    const k2 = makeDedupeKey('ws', 'site', 'evt');
    expect(k1).toBe(k2);
  });

  it('produces different keys for different inputs', () => {
    expect(makeDedupeKey('ws_a', 'site', 'evt')).not.toBe(makeDedupeKey('ws_b', 'site', 'evt'));
    expect(makeDedupeKey('ws', 'site_a', 'evt')).not.toBe(makeDedupeKey('ws', 'site_b', 'evt'));
    expect(makeDedupeKey('ws', 'site', 'evt_a')).not.toBe(makeDedupeKey('ws', 'site', 'evt_b'));
  });

  it('uses a NUL-byte separator (collision-safe across realistic identifiers)', () => {
    const k = makeDedupeKey('ws', 'site', 'evt');
    expect(k).toContain('\x00');
  });

  it('does not collide between (a, b, c) and (a:b, c) style attacker inputs', () => {
    // Without the NUL separator, "a:b" + ":" + "c" would equal "a" + ":" + "b:c".
    // With NUL, identifiers can't smuggle a separator (JSON disallows U+0000 in strings).
    const k1 = makeDedupeKey('ab', 'cd', 'ef');
    const k2 = makeDedupeKey('a', 'bcd', 'ef');
    expect(k1).not.toBe(k2);
  });
});

describe('markIntraBatchDuplicates — basic occurrences', () => {
  it('one event is not a duplicate', () => {
    const r = markIntraBatchDuplicates([ev('ws', 'site', 'evt')]);
    expect(r).toEqual([{ index: 0, duplicate: false, reason_code: null }]);
  });

  it('a second occurrence of the same key is a duplicate', () => {
    const r = markIntraBatchDuplicates([
      ev('ws', 'site', 'evt'),
      ev('ws', 'site', 'evt'),
    ]);
    expect(r).toEqual([
      { index: 0, duplicate: false, reason_code: null },
      { index: 1, duplicate: true, reason_code: 'duplicate_client_event_id' },
    ]);
  });

  it('a third occurrence of the same key is also a duplicate', () => {
    const r = markIntraBatchDuplicates([
      ev('ws', 'site', 'evt'),
      ev('ws', 'site', 'evt'),
      ev('ws', 'site', 'evt'),
    ]);
    expect(r.map(x => x.duplicate)).toEqual([false, true, true]);
    expect(r[2]!.reason_code).toBe('duplicate_client_event_id');
  });
});

describe('markIntraBatchDuplicates — workspace / site / client_event_id are part of the key', () => {
  it('different workspace_id with same client_event_id is NOT a duplicate', () => {
    const r = markIntraBatchDuplicates([
      ev('ws_a', 'site', 'evt'),
      ev('ws_b', 'site', 'evt'),
    ]);
    expect(r.every(x => !x.duplicate)).toBe(true);
  });

  it('different site_id with same client_event_id is NOT a duplicate', () => {
    const r = markIntraBatchDuplicates([
      ev('ws', 'site_a', 'evt'),
      ev('ws', 'site_b', 'evt'),
    ]);
    expect(r.every(x => !x.duplicate)).toBe(true);
  });

  it('different client_event_id values within same workspace+site are NOT duplicates', () => {
    const r = markIntraBatchDuplicates([
      ev('ws', 'site', 'evt_a'),
      ev('ws', 'site', 'evt_b'),
      ev('ws', 'site', 'evt_c'),
    ]);
    expect(r.every(x => !x.duplicate)).toBe(true);
  });
});

describe('markIntraBatchDuplicates — missing/empty client_event_id is not deduped', () => {
  it('null client_event_id is not marked duplicate', () => {
    const r = markIntraBatchDuplicates([
      ev('ws', 'site', null),
      ev('ws', 'site', null),
    ]);
    expect(r.every(x => !x.duplicate)).toBe(true);
  });

  it('undefined client_event_id is not marked duplicate', () => {
    const r = markIntraBatchDuplicates([
      ev('ws', 'site', undefined),
      ev('ws', 'site', undefined),
    ]);
    expect(r.every(x => !x.duplicate)).toBe(true);
  });

  it('empty-string client_event_id is not marked duplicate', () => {
    const r = markIntraBatchDuplicates([
      ev('ws', 'site', ''),
      ev('ws', 'site', ''),
    ]);
    expect(r.every(x => !x.duplicate)).toBe(true);
  });

  it('mixes valid keys and missing ids correctly', () => {
    const r = markIntraBatchDuplicates([
      ev('ws', 'site', 'evt_a'),
      ev('ws', 'site', null),
      ev('ws', 'site', 'evt_a'), // duplicate of [0]
      ev('ws', 'site', null),    // not a duplicate (null is never deduped)
    ]);
    expect(r.map(x => x.duplicate)).toEqual([false, false, true, false]);
  });
});

describe('markIntraBatchDuplicates — output shape', () => {
  it('output length equals input length', () => {
    const events = [
      ev('ws', 'site', 'a'),
      ev('ws', 'site', 'a'),
      ev('ws', 'site', 'b'),
      ev('ws', 'site', null),
      ev('ws', 'site', 'a'),
    ];
    const r = markIntraBatchDuplicates(events);
    expect(r.length).toBe(events.length);
  });

  it('output indexes preserve input indexes (output[i].index === i)', () => {
    const events = [
      ev('ws', 'site', 'a'),
      ev('ws', 'site', 'b'),
      ev('ws', 'site', 'c'),
      ev('ws', 'site', 'a'), // duplicate
    ];
    const r = markIntraBatchDuplicates(events);
    expect(r.map(x => x.index)).toEqual([0, 1, 2, 3]);
  });

  it('empty input returns empty output', () => {
    expect(markIntraBatchDuplicates([])).toEqual([]);
  });

  it('result entries have only index, duplicate, reason_code keys', () => {
    const r = markIntraBatchDuplicates([ev('ws', 'site', 'a')]);
    expect(Object.keys(r[0]!).sort()).toEqual(['duplicate', 'index', 'reason_code']);
  });
});

describe('dedupe.ts — import discipline (Track B only)', () => {
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

  it('does NOT introduce scoring symbols or cross-request DB lookup', () => {
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|is_bot|is_agent|pool\.query|SELECT\s+\*\s+FROM)\b/i;
    expect(source).not.toMatch(forbidden);
  });
});
