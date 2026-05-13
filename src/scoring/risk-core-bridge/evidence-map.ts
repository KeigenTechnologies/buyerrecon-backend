/**
 * Sprint 2 PR#7b — AMS Risk Core bridge — pure evidence + velocity helpers.
 *
 * Pure module. No DB. No HTTP. No clock. No filesystem.
 *
 * The bridge MUST preserve `evidence_refs` verbatim (PR#7a §5.3 +
 * §11.2 #3). The helpers below produce **defensively-frozen, structurally
 * cloned** copies — same data, deep-immutable, so the envelope cannot
 * leak a writable reference back into the caller's input. Cloning is
 * cheap (small arrays of plain JSON values) and the immutability
 * guarantee is part of what makes the adapter byte-stable across
 * re-invocations on the same input.
 */

import type { EvidenceRef } from './types.js';

/**
 * Deep-freeze any JSON-compatible value. The bridge never persists
 * arbitrary objects; the deepest nesting it sees is the PR#6
 * `evidence_refs` entries (one level of object, scalar values). The
 * recursion below is correct for that shape and tolerant of nested
 * arrays / nested objects if a future PR widens the entry schema.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const v of value) deepFreeze(v);
    return Object.freeze(value);
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return Object.freeze(value);
}

/**
 * Structural clone for plain JSON-shaped values (objects, arrays,
 * scalars, null). Skips prototypes; preserves order. Used to build
 * the envelope's `evidence_refs` + `velocity` so the output object is
 * fully decoupled from the caller's input.
 *
 * NOT a generic deep clone — it does not handle Date, Map, Set,
 * RegExp, class instances. The bridge's inputs are JSON shapes from
 * PR#6's row, so this is sufficient.
 */
function jsonClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(jsonClone) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>)) {
    out[k] = jsonClone((value as Record<string, unknown>)[k]);
  }
  return out as T;
}

/**
 * Returns a deep-immutable verbatim copy of the input evidence_refs
 * array. Per PR#7a §5.3, the bridge does NOT rewrite, deduplicate, or
 * summarise evidence_refs. The only transform applied here is
 * structural cloning + deep freeze.
 */
export function preserveEvidenceRefs(
  refs: readonly EvidenceRef[],
): readonly EvidenceRef[] {
  const cloned = refs.map((r) => jsonClone(r) as EvidenceRef);
  return deepFreeze(cloned);
}

/**
 * Returns a deep-immutable verbatim copy of the input velocity record.
 * Per PR#7a §6.1, `velocity` is `Record<string, number>` carried
 * verbatim from `risk_observations_v0_1.velocity`. The bridge does
 * not compute new velocity values; it only forwards.
 */
export function preserveVelocity(
  velocity: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const cloned: Record<string, number> = {};
  for (const k of Object.keys(velocity)) {
    cloned[k] = velocity[k]!;
  }
  return deepFreeze(cloned);
}

/**
 * Returns a deep-immutable verbatim copy of the input context_tags
 * array. Per PR#7a §8 + §11.2 #6, tags carry as context only — the
 * bridge does NOT interpret them as verdicts. Cloning prevents the
 * envelope from sharing array identity with the caller's input.
 */
export function preserveContextTags(
  tags: readonly string[],
): readonly string[] {
  const cloned = tags.slice();
  return deepFreeze(cloned);
}
