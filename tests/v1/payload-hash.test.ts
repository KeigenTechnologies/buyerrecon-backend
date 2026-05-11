/**
 * Sprint 1 PR#5b-3 — payload hash helper tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { payloadSha256 } from '../../src/collector/v1/payload-hash.js';
import { sha256Hex } from '../../src/collector/v1/hash.js';
import { stableStringify } from '../../src/collector/v1/stable-json.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'payload-hash.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

describe('payloadSha256 — determinism + format', () => {
  it('produces identical hashes for object literals with different key insertion order', () => {
    expect(payloadSha256({ a: 1, b: 2 })).toBe(payloadSha256({ b: 2, a: 1 }));
  });

  it('produces different hashes for different meaningful values', () => {
    expect(payloadSha256({ a: 1 })).not.toBe(payloadSha256({ a: 2 }));
  });

  it('returns a 64-char lowercase hex string (no sha256: prefix)', () => {
    const h = payloadSha256({ a: 1 });
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toMatch(/^sha256:/);
  });

  it('output equals sha256Hex(stableStringify(input))', () => {
    const input = { z: 1, a: { b: 2 }, m: [3, 1, 2] };
    expect(payloadSha256(input)).toBe(sha256Hex(stableStringify(input)));
  });

  it('repeated calls with the same input return the same hash', () => {
    const input = { foo: 'bar', baz: [1, 2, 3] };
    const calls = Array.from({ length: 5 }, () => payloadSha256(input));
    const first = calls[0]!;
    expect(calls.every(c => c === first)).toBe(true);
  });

  it('Date input produces a stable hash (matches ISO-string serialisation)', () => {
    const d = new Date('2026-05-10T12:00:00Z');
    expect(payloadSha256({ ts: d })).toBe(payloadSha256({ ts: d }));
    expect(payloadSha256({ ts: d })).toBe(sha256Hex('{"ts":"2026-05-10T12:00:00.000Z"}'));
  });

  it('does NOT depend on Date.now() or any runtime timestamp', () => {
    // Two calls with the same input separated by a microtask tick must
    // return the same hash. payloadSha256 must not stamp any clock.
    const input = { fixed: 'value' };
    const a = payloadSha256(input);
    return new Promise<void>(resolve => {
      setImmediate(() => {
        const b = payloadSha256(input);
        expect(b).toBe(a);
        resolve();
      });
    });
  });

  it('arrays preserve order in the hash', () => {
    expect(payloadSha256([1, 2, 3])).not.toBe(payloadSha256([3, 2, 1]));
  });
});

describe('payloadSha256 — error propagation from stableStringify', () => {
  it('throws TypeError on undefined input', () => {
    expect(() => payloadSha256(undefined)).toThrow(TypeError);
  });

  it('throws TypeError on BigInt input', () => {
    expect(() => payloadSha256(1n)).toThrow(TypeError);
  });

  it('throws TypeError on NaN input', () => {
    expect(() => payloadSha256(Number.NaN)).toThrow(TypeError);
  });

  it('throws TypeError on Infinity input', () => {
    expect(() => payloadSha256(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('throws TypeError on circular input', () => {
    const o: Record<string, unknown> = { a: 1 };
    o.self = o;
    expect(() => payloadSha256(o)).toThrow(TypeError);
  });

  it('throws TypeError on Map / Set / RegExp / Buffer / class instance', () => {
    expect(() => payloadSha256(new Map())).toThrow(TypeError);
    expect(() => payloadSha256(new Set())).toThrow(TypeError);
    expect(() => payloadSha256(/abc/)).toThrow(TypeError);
    expect(() => payloadSha256(Buffer.from('hi'))).toThrow(TypeError);
    class Foo { x = 1; }
    expect(() => payloadSha256(new Foo())).toThrow(TypeError);
  });

  it('throws TypeError when input contains a symbol-keyed object property (delegated from stableStringify)', () => {
    const key = Symbol('secret');
    const input: Record<string | symbol, unknown> = { a: 1 };
    input[key] = 'hidden';
    expect(() => payloadSha256(input)).toThrow(TypeError);
  });
});

describe('payload-hash.ts — import discipline (Track B only)', () => {
  it('imports ONLY sha256Hex from ./hash.js and stableStringify from ./stable-json.js', () => {
    const importStatements = source.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBe(2);
    const sources = importStatements.map(stmt => stmt.match(/from\s+['"]([^'"]+)['"]/)?.[1]).sort();
    expect(sources).toEqual(['./hash.js', './stable-json.js']);
  });

  it('does NOT read process.env / import DB / express / pino / scoring path', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT call Date.now() or any runtime clock', () => {
    expect(source).not.toMatch(/Date\.now\(/);
    expect(source).not.toMatch(/performance\.now\(/);
    expect(source).not.toMatch(/new Date\(\)/);
  });

  it('does NOT introduce scoring symbols anywhere in source', () => {
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|is_bot|is_agent)\b/;
    expect(source).not.toMatch(forbidden);
  });

  it('does NOT introduce its own SHA-256 / crypto code (delegates to PR#5a hash.ts)', () => {
    expect(source).not.toMatch(/\bcreateHash\s*\(/);
    expect(source).not.toMatch(/\bcreateHmac\s*\(/);
    expect(source).not.toMatch(/from\s+['"]crypto['"]/);
  });
});
