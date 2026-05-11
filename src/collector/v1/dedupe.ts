/**
 * Sprint 1 PR#5b-2 — intra-batch dedupe (Track B).
 *
 * Pure function. No env reads, no DB, no logging, no network.
 *
 * Marks the second-and-subsequent occurrence of any
 *   (workspace_id, site_id, client_event_id)
 * tuple within a single request batch as `duplicate_client_event_id`.
 *
 * Cross-request dedupe is OUT of PR#5b-2 scope — that lands as the DB
 * UNIQUE INDEX in §3.PR#6. Missing / null / empty `client_event_id` is NOT
 * marked here because PR#5b-1 validation (R-9) is the gate for that
 * condition; double-rejecting would muddy the reason-code surface.
 */

import type { ReasonCode } from './reason-codes.js';

export interface DedupeInput {
  workspace_id: string;
  site_id: string;
  client_event_id: string | null | undefined;
}

export interface DedupeResult {
  index: number;
  duplicate: boolean;
  reason_code: Extract<ReasonCode, 'duplicate_client_event_id'> | null;
}

/**
 * NUL-byte separator. Field values from JSON cannot legally contain U+0000,
 * so the joined key is collision-safe regardless of what characters the
 * caller's identifiers use.
 */
const KEY_SEP = '\x00';

/** Stable join across (workspace_id, site_id, client_event_id). */
export function makeDedupeKey(
  workspaceId: string,
  siteId: string,
  clientEventId: string,
): string {
  return `${workspaceId}${KEY_SEP}${siteId}${KEY_SEP}${clientEventId}`;
}

/**
 * Linear scan. Returns one DedupeResult per input event with input indexes
 * preserved. Output length === input length.
 */
export function markIntraBatchDuplicates(
  events: ReadonlyArray<DedupeInput>,
): DedupeResult[] {
  const seen = new Set<string>();
  const result: DedupeResult[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (typeof e.client_event_id !== 'string' || e.client_event_id.length === 0) {
      // Missing / null / empty client_event_id — defer to PR#5b-1 validation.
      result.push({ index: i, duplicate: false, reason_code: null });
      continue;
    }
    const key = makeDedupeKey(e.workspace_id, e.site_id, e.client_event_id);
    if (seen.has(key)) {
      result.push({ index: i, duplicate: true, reason_code: 'duplicate_client_event_id' });
    } else {
      seen.add(key);
      result.push({ index: i, duplicate: false, reason_code: null });
    }
  }
  return result;
}
