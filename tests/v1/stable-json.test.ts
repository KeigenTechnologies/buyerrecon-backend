/**
 * Sprint 1 PR#5b-3 — stable deterministic JSON stringify tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { stableStringify } from '../../src/collector/v1/stable-json.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'stable-json.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

// ---------------------------------------------------------------------------
// 1. Key-order invariance + recursive sorting
// ---------------------------------------------------------------------------

describe('stableStringify — recursive key sorting', () => {
  it('produces identical output for differently ordered top-level keys', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('emits keys in sorted order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('sorts nested object keys recursively', () => {
    expect(stableStringify({ outer: { z: 1, a: 2 } })).toBe('{"outer":{"a":2,"z":1}}');
  });

  it('sorts deeply nested object keys (3 levels)', () => {
    const input = { z: { y: { x: 1, a: 2 } }, a: { b: 1, a: 2 } };
    expect(stableStringify(input)).toBe('{"a":{"a":2,"b":1},"z":{"y":{"a":2,"x":1}}}');
  });

  it('preserves array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('sorts inner object keys when objects appear inside arrays', () => {
    expect(stableStringify([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it('does not sort across array elements (each object sorted in place)', () => {
    expect(stableStringify([{ b: 1 }, { a: 2 }])).toBe('[{"b":1},{"a":2}]');
  });
});

// ---------------------------------------------------------------------------
// 2. Allowed primitives + Date
// ---------------------------------------------------------------------------

describe('stableStringify — allowed primitives + Date', () => {
  it('serialises strings with proper escaping', () => {
    expect(stableStringify('foo')).toBe('"foo"');
    expect(stableStringify('a\nb')).toBe('"a\\nb"');
    expect(stableStringify('q"q')).toBe('"q\\"q"');
  });

  it('serialises booleans', () => {
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(false)).toBe('false');
  });

  it('serialises null', () => {
    expect(stableStringify(null)).toBe('null');
  });

  it('serialises finite numbers', () => {
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify(0)).toBe('0');
    expect(stableStringify(-1)).toBe('-1');
    expect(stableStringify(1.5)).toBe('1.5');
  });

  it('serialises -0 as 0 (matching JSON.stringify)', () => {
    expect(stableStringify(-0)).toBe('0');
  });

  it('converts Date to ISO string', () => {
    expect(stableStringify(new Date('2026-05-10T12:00:00Z'))).toBe('"2026-05-10T12:00:00.000Z"');
  });

  it('Date inside an object is converted to ISO string', () => {
    const out = stableStringify({ ts: new Date('2026-01-02T03:04:05Z') });
    expect(out).toBe('{"ts":"2026-01-02T03:04:05.000Z"}');
  });

  it('serialises empty object as {}', () => {
    expect(stableStringify({})).toBe('{}');
  });

  it('serialises empty array as []', () => {
    expect(stableStringify([])).toBe('[]');
  });

  it('accepts Object.create(null) as a plain object', () => {
    const o = Object.create(null) as Record<string, unknown>;
    o.a = 1;
    o.b = 2;
    expect(stableStringify(o)).toBe('{"a":1,"b":2}');
  });
});

// ---------------------------------------------------------------------------
// 3. Rejected values
// ---------------------------------------------------------------------------

describe('stableStringify — rejected values throw TypeError', () => {
  it('rejects undefined at top level', () => {
    expect(() => stableStringify(undefined)).toThrow(TypeError);
  });

  it('rejects undefined inside an object value', () => {
    expect(() => stableStringify({ a: 1, b: undefined })).toThrow(TypeError);
  });

  it('rejects undefined inside an array', () => {
    expect(() => stableStringify([1, undefined, 3])).toThrow(TypeError);
  });

  it('rejects function values', () => {
    expect(() => stableStringify(() => 1)).toThrow(TypeError);
    expect(() => stableStringify({ f: () => 1 })).toThrow(TypeError);
  });

  it('rejects symbol values', () => {
    expect(() => stableStringify(Symbol('s'))).toThrow(TypeError);
    expect(() => stableStringify({ s: Symbol('s') })).toThrow(TypeError);
  });

  it('rejects BigInt', () => {
    expect(() => stableStringify(1n)).toThrow(TypeError);
    expect(() => stableStringify({ b: 2n })).toThrow(TypeError);
  });

  it('rejects NaN', () => {
    expect(() => stableStringify(Number.NaN)).toThrow(TypeError);
    expect(() => stableStringify({ n: Number.NaN })).toThrow(TypeError);
  });

  it('rejects Infinity', () => {
    expect(() => stableStringify(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('rejects -Infinity', () => {
    expect(() => stableStringify(Number.NEGATIVE_INFINITY)).toThrow(TypeError);
  });

  it('rejects invalid Date', () => {
    expect(() => stableStringify(new Date('not-a-date'))).toThrow(TypeError);
  });

  it('rejects Map', () => {
    expect(() => stableStringify(new Map())).toThrow(TypeError);
  });

  it('rejects Set', () => {
    expect(() => stableStringify(new Set())).toThrow(TypeError);
  });

  it('rejects RegExp', () => {
    expect(() => stableStringify(/abc/)).toThrow(TypeError);
    expect(() => stableStringify(new RegExp('abc'))).toThrow(TypeError);
  });

  it('rejects Buffer', () => {
    expect(() => stableStringify(Buffer.from('hi'))).toThrow(TypeError);
  });

  it('rejects class instances', () => {
    class Foo {
      x = 1;
    }
    expect(() => stableStringify(new Foo())).toThrow(TypeError);
  });

  it('rejects objects with symbol-keyed own properties (no silent drop before hashing)', () => {
    const key = Symbol('secret');
    const input: Record<string | symbol, unknown> = { a: 1 };
    input[key] = 'hidden';
    expect(() => stableStringify(input)).toThrow(TypeError);
  });

  it('rejects objects with symbol-keyed properties even when no string keys are present', () => {
    const key = Symbol('only_symbol');
    const input: Record<string | symbol, unknown> = {};
    input[key] = 'hidden';
    expect(() => stableStringify(input)).toThrow(TypeError);
  });

  it('rejects nested objects with symbol-keyed properties', () => {
    const key = Symbol('nested');
    const inner: Record<string | symbol, unknown> = { a: 1 };
    inner[key] = 'hidden';
    expect(() => stableStringify({ outer: inner })).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// 4. Circular reference detection
// ---------------------------------------------------------------------------

describe('stableStringify — circular reference detection', () => {
  it('throws on a self-referential object', () => {
    const o: Record<string, unknown> = { a: 1 };
    o.self = o;
    expect(() => stableStringify(o)).toThrow(TypeError);
  });

  it('throws on a self-referential array', () => {
    const a: unknown[] = [1];
    a.push(a);
    expect(() => stableStringify(a)).toThrow(TypeError);
  });

  it('throws on a deeper cycle', () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { a };
    a.b = b;
    expect(() => stableStringify(a)).toThrow(TypeError);
  });

  it('does NOT throw on a sibling reference (same object referenced twice, no cycle)', () => {
    const child = { a: 1 };
    const parent = { x: child, y: child };
    expect(() => stableStringify(parent)).not.toThrow();
    expect(stableStringify(parent)).toBe('{"x":{"a":1},"y":{"a":1}}');
  });
});

// ---------------------------------------------------------------------------
// 5. Determinism + output stability
// ---------------------------------------------------------------------------

describe('stableStringify — determinism', () => {
  it('returns identical output across repeated calls', () => {
    const input = { z: 1, a: { b: 2, a: 3 }, m: [1, 2, 3] };
    const calls = Array.from({ length: 5 }, () => stableStringify(input));
    const first = calls[0]!;
    expect(calls.every(c => c === first)).toBe(true);
  });

  it('does not depend on object insertion order', () => {
    const a: Record<string, unknown> = {};
    a.k1 = 1; a.k2 = 2; a.k3 = 3;
    const b: Record<string, unknown> = {};
    b.k3 = 3; b.k2 = 2; b.k1 = 1;
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('emits no whitespace between tokens', () => {
    expect(stableStringify({ a: 1, b: [1, 2] })).not.toContain(' ');
    expect(stableStringify({ a: 1, b: [1, 2] })).not.toContain('\n');
  });
});

// ---------------------------------------------------------------------------
// 6. Module-level scope discipline
// ---------------------------------------------------------------------------

describe('stable-json.ts — import discipline (Track B only)', () => {
  it('contains no import statements (pure stdlib reliance via globals)', () => {
    // The module uses Buffer from the Node runtime global; no `import`
    // statements should appear.
    const importStatements = source.match(/^import\s.*$/gm) ?? [];
    expect(importStatements.length).toBe(0);
  });

  it('does NOT read process.env / import DB / express / pino / scoring path', () => {
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

  it('does NOT register any HTTP route handler or middleware', () => {
    expect(source).not.toMatch(/\bRouter\s*\(/);
    expect(source).not.toMatch(/\b(?:app|router)\.(?:get|post|put|delete|patch|use|listen)\s*\(/);
  });
});
