/**
 * Sprint 1 PR#5b-3 — stable deterministic JSON stringify (Track B).
 *
 * Pure function. No env reads, no DB, no logging, no network.
 *
 * Produces a deterministic JSON-compatible string representation of a value
 * that PR#5b-3's payload-hash helper feeds to SHA-256. Two values that are
 * structurally equal (even with different object-key insertion order) MUST
 * produce identical output strings.
 *
 * Allowed inputs:
 *   - string, boolean, null, finite number
 *   - Date (converted via toISOString)
 *   - arrays
 *   - plain objects (literal {} or Object.create(null))
 *
 * Rejected inputs (throws TypeError):
 *   - undefined (anywhere — top level, object value, array element)
 *   - function, symbol, BigInt
 *   - NaN, Infinity, -Infinity
 *   - circular references
 *   - Map, Set, RegExp, Buffer
 *   - class instances and other non-plain objects
 *   - invalid Date (NaN time)
 *
 * Object policy:
 *   - Object keys sorted lexicographically (Array.prototype.sort default).
 *     Applied recursively to nested objects.
 *   - Array element order preserved.
 *   - No whitespace, no replacer hook, no indentation.
 *
 * Circular detection:
 *   - WeakSet-based path tracking: an ancestor object is "seen"; sibling
 *     references to the same object are NOT considered circular.
 */

const NEG_INFINITY = Number.NEGATIVE_INFINITY;

/** Stringify a value to a deterministic JSON-compatible string. */
export function stableStringify(value: unknown): string {
  return serialise(value, new WeakSet<object>());
}

function serialise(v: unknown, seen: WeakSet<object>): string {
  // Per policy: undefined is rejected anywhere it appears.
  if (v === undefined) {
    throw new TypeError('stableStringify: undefined is not supported');
  }
  if (v === null) return 'null';

  const t = typeof v;

  if (t === 'boolean') return v ? 'true' : 'false';

  if (t === 'number') {
    const n = v as number;
    if (!Number.isFinite(n)) {
      // Captures NaN, Infinity, -Infinity.
      const label = Number.isNaN(n) ? 'NaN' : n === NEG_INFINITY ? '-Infinity' : 'Infinity';
      throw new TypeError(`stableStringify: non-finite number (${label}) is not supported`);
    }
    // JSON.stringify on a finite number produces the canonical JSON form
    // (e.g. -0 → '0', 1e21 → '1e+21').
    return JSON.stringify(n);
  }

  if (t === 'string') {
    // Use JSON.stringify for proper escaping of control chars, quotes, etc.
    return JSON.stringify(v);
  }

  if (t === 'bigint') {
    throw new TypeError('stableStringify: BigInt is not supported');
  }
  if (t === 'symbol') {
    throw new TypeError('stableStringify: symbol is not supported');
  }
  if (t === 'function') {
    throw new TypeError('stableStringify: function is not supported');
  }

  // typeof === 'object' (and v !== null).
  const obj = v as object;

  // Date — must check before plain-object check so Date isn't rejected as non-plain.
  if (obj instanceof Date) {
    const ms = obj.getTime();
    if (!Number.isFinite(ms)) {
      throw new TypeError('stableStringify: invalid Date is not supported');
    }
    return JSON.stringify(obj.toISOString());
  }

  // Reject specific non-plain object types with descriptive errors.
  if (obj instanceof Map) {
    throw new TypeError('stableStringify: Map is not supported');
  }
  if (obj instanceof Set) {
    throw new TypeError('stableStringify: Set is not supported');
  }
  if (obj instanceof RegExp) {
    throw new TypeError('stableStringify: RegExp is not supported');
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) {
    throw new TypeError('stableStringify: Buffer is not supported');
  }

  // Array — check before generic plain-object branch.
  if (Array.isArray(obj)) {
    if (seen.has(obj)) {
      throw new TypeError('stableStringify: circular reference detected');
    }
    seen.add(obj);
    const parts: string[] = [];
    for (const item of obj) {
      parts.push(serialise(item, seen));
    }
    seen.delete(obj);
    return '[' + parts.join(',') + ']';
  }

  // Plain object only: prototype must be Object.prototype or null.
  // Class instances (Foo.prototype), Buffer (already caught above), and any
  // other exotic object will fail this check and throw.
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(
      'stableStringify: only plain objects are supported (got class instance or unsupported object type)',
    );
  }

  if (seen.has(obj)) {
    throw new TypeError('stableStringify: circular reference detected');
  }
  seen.add(obj);

  const rec = obj as Record<string, unknown>;
  // Reject symbol-keyed properties. Object.keys() does not enumerate symbol
  // keys, so without this guard a symbol-keyed property would be silently
  // omitted from the stringified output — which would break the
  // evidence-hash invariant that no unsupported property is silently
  // dropped before hashing.
  const symbolKeys = Object.getOwnPropertySymbols(rec);
  if (symbolKeys.length > 0) {
    throw new TypeError('stableStringify: symbol keys are not supported');
  }
  const keys = Object.keys(rec).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const childValue = rec[key];
    // Per policy: undefined value at any object key is rejected.
    if (childValue === undefined) {
      throw new TypeError(
        `stableStringify: undefined value at key "${key}" is not supported`,
      );
    }
    parts.push(JSON.stringify(key) + ':' + serialise(childValue, seen));
  }
  seen.delete(obj);
  return '{' + parts.join(',') + '}';
}
