/**
 * Sprint 2 PR#12b — POI Sequence Observer — pure mapper.
 *
 * Pure functions. NO clock reads (no `Date.now`, no `new Date()` —
 * timestamps are taken from row data only). NO randomness. NO DB.
 * NO process.env reads.
 *
 * Groups POI observation rows by (workspace_id, site_id, session_id)
 * and derives per-session POI Sequence facts. Pattern classification
 * is deterministic and follows the v0.1 taxonomy locked in the
 * workflow truth file §9.
 */

import { POI_TYPES_ALLOWED, type PoiType } from '../poi-core/index.js';
import {
  ALLOWED_EVIDENCE_REF_SOURCE_TABLES,
  ALLOWED_POI_SOURCE_TABLES,
  FORBIDDEN_REF_KEYS,
  POI_SEQUENCE_VERSION,
  type PoiObservationRowRaw,
  type PoiSequencePatternClass,
  type PoiSequenceRecord,
} from './types.js';

/* --------------------------------------------------------------------------
 * Coercion + validation helpers
 * ------------------------------------------------------------------------ */

function coerceText(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function coerceBoolean(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function coerceBigserial(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

function coerceIsoTimestamp(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString();
  }
  if (typeof v === 'string' && v.length > 0) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function isAllowedPoiType(v: unknown): v is PoiType {
  return typeof v === 'string' && (POI_TYPES_ALLOWED as readonly string[]).includes(v);
}

/* --------------------------------------------------------------------------
 * Recursive forbidden-key sweep over JSONB content
 * ------------------------------------------------------------------------ */

const FORBIDDEN_KEY_SET: ReadonlySet<string> = new Set(FORBIDDEN_REF_KEYS);

export function hasForbiddenKeyRecursive(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasForbiddenKeyRecursive(item)) return true;
    }
    return false;
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_SET.has(k)) return true;
    if (hasForbiddenKeyRecursive((value as Record<string, unknown>)[k])) return true;
  }
  return false;
}

/* --------------------------------------------------------------------------
 * Validate evidence_refs shape
 *
 * Rules (per PR#10 PoiEvidenceRef contract + PR#11c worker rules —
 * see `src/scoring/poi-core/types.ts` `PoiEvidenceRef.table`):
 *   - must be a non-empty array
 *   - every entry must be a plain object (not null / not array)
 *   - every entry MUST carry a non-empty string `table` field
 *     (canonical PR#10 field is `table`, NOT `source_table` — the
 *     observer must read the canonical name)
 *   - `entry.table` MUST be in ALLOWED_EVIDENCE_REF_SOURCE_TABLES,
 *     which rejects raw-lineage tables (accepted_events,
 *     rejected_events, ingest_requests, risk_observations_v0_1,
 *     scoring_output_lane_a, scoring_output_lane_b, site_write_tokens)
 *     and any other table outside the allowlist
 *
 * Returns `true` when shape is valid; `false` otherwise. Does NOT
 * check forbidden keys (that's a separate recursive sweep —
 * `hasForbiddenKeyRecursive`).
 * ------------------------------------------------------------------------ */

export function isValidEvidenceRefs(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const rec = entry as Record<string, unknown>;
    const t = rec['table'];
    if (typeof t !== 'string' || t.length === 0) return false;
    if (!ALLOWED_EVIDENCE_REF_SOURCE_TABLES.includes(t)) return false;
  }
  return true;
}

/* --------------------------------------------------------------------------
 * Validate source_versions shape
 *
 * Rules:
 *   - must be a plain object (not array, not null)
 *   - every value must be a string (version stamps)
 *
 * Returns `true` when shape is valid; `false` otherwise.
 * ------------------------------------------------------------------------ */

export function isValidSourceVersions(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (typeof rec[k] !== 'string') return false;
  }
  return true;
}

/* --------------------------------------------------------------------------
 * Session-key construction
 *
 * Composite key: workspace_id + 0x1F + site_id + 0x1F + session_id.
 * Using a non-printable separator avoids collision with text that
 * could appear in any field.
 * ------------------------------------------------------------------------ */

const SEP = '\x1f';

function makeSessionKey(workspace_id: string, site_id: string, session_id: string): string {
  return `${workspace_id}${SEP}${site_id}${SEP}${session_id}`;
}

/* --------------------------------------------------------------------------
 * Group rows by session — input order is the SQL ordering
 * (workspace_id, site_id, session_id, first_seen_at NULLS LAST,
 * poi_observation_id). We preserve that order inside each group.
 * ------------------------------------------------------------------------ */

export interface GroupedRows {
  readonly key:          string;
  readonly workspace_id: string;
  readonly site_id:      string;
  readonly session_id:   string;
  readonly rows:         readonly PoiObservationRowRaw[];
}

export function groupRowsBySession(rows: readonly PoiObservationRowRaw[]): readonly GroupedRows[] {
  const buckets = new Map<string, { workspace_id: string; site_id: string; session_id: string; rows: PoiObservationRowRaw[] }>();
  for (const r of rows) {
    const ws  = coerceText(r.workspace_id);
    const sid = coerceText(r.site_id);
    const ses = coerceText(r.session_id);
    if (ws === null || sid === null || ses === null) continue;
    const key = makeSessionKey(ws, sid, ses);
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      bucket = { workspace_id: ws, site_id: sid, session_id: ses, rows: [] };
      buckets.set(key, bucket);
    }
    bucket.rows.push(r);
  }
  const out: GroupedRows[] = [];
  for (const [key, bucket] of buckets) {
    out.push({
      key,
      workspace_id: bucket.workspace_id,
      site_id:      bucket.site_id,
      session_id:   bucket.session_id,
      rows:         Object.freeze([...bucket.rows]),
    });
  }
  return Object.freeze(out);
}

/* --------------------------------------------------------------------------
 * Pattern classification
 *
 * Rules locked by truth file §9 + this PR:
 *   - exactly 1 row                      → single_poi
 *   - poi_count >= 2 AND unique_poi == 1 → repeated_same_poi
 *   - unique_poi_count >= 2, no repeats  → multi_poi_linear
 *   - unique_poi_count >= 2, with repeat → loop_or_backtrack
 *   - timestamps missing/inconsistent    → insufficient_temporal_data
 *   - everything else                    → unknown (must stay 0 in healthy run)
 *
 * `insufficient_temporal_data` is checked FIRST when the row count is
 * >= 2 — any session whose POI rows all have NULL first_seen_at is
 * flagged because in-session ordering is meaningless without
 * timestamps. A single POI row with NULL timestamps is still
 * classified as `single_poi` (no ordering to verify).
 * ------------------------------------------------------------------------ */

interface SequenceFacts {
  readonly poi_count:         number;
  readonly unique_poi_count:  number;
  readonly repeated_poi_count: number;
  readonly has_temporal_data: boolean;
}

function computeSequenceFacts(rows: readonly PoiObservationRowRaw[]): SequenceFacts {
  const seen = new Set<string>();
  let repeated = 0;
  let timestampsPresent = 0;
  for (const r of rows) {
    const t = coerceText(r.poi_type);
    const k = coerceText(r.poi_key);
    const combo = `${t ?? ''}\x1f${k ?? ''}`;
    if (seen.has(combo)) {
      repeated++;
    } else {
      seen.add(combo);
    }
    if (coerceIsoTimestamp(r.first_seen_at) !== null) timestampsPresent++;
  }
  return {
    poi_count:          rows.length,
    unique_poi_count:   seen.size,
    repeated_poi_count: repeated,
    // We need at least one POI row to have a usable first_seen_at to
    // claim "temporal data present"; the SQL ORDER BY uses NULLS LAST
    // so unsorted rows will be at the tail but mixed with sorted ones.
    // For v0.1 we require ALL POI rows in a session with >=2 rows to
    // carry a first_seen_at; otherwise we cannot trust the order.
    has_temporal_data: rows.length <= 1 || timestampsPresent === rows.length,
  };
}

export function classifyPattern(facts: SequenceFacts): PoiSequencePatternClass {
  if (facts.poi_count === 1)                                              return 'single_poi';
  if (facts.poi_count >= 2 && !facts.has_temporal_data)                   return 'insufficient_temporal_data';
  if (facts.poi_count >= 2 && facts.unique_poi_count === 1)               return 'repeated_same_poi';
  if (facts.unique_poi_count >= 2 && facts.repeated_poi_count === 0)      return 'multi_poi_linear';
  if (facts.unique_poi_count >= 2 && facts.repeated_poi_count >= 1)       return 'loop_or_backtrack';
  return 'unknown';
}

/* --------------------------------------------------------------------------
 * buildSequenceRecord — derive a PoiSequenceRecord for one session
 *
 * Per-record anomaly counters are independent of run-level counters;
 * the run-level rollup is a sum over per-record counts plus the
 * pattern-classification rollups (unknown_pattern / insufficient_*)
 * which are scoped to the session, not to individual POI rows.
 * ------------------------------------------------------------------------ */

export function buildSequenceRecord(group: GroupedRows): PoiSequenceRecord {
  const facts        = computeSequenceFacts(group.rows);
  const patternClass = classifyPattern(facts);

  // Version-stamp carry-through — collect distinct values per group.
  const poi_input_versions       = collectDistinctText(group.rows, 'poi_input_version');
  const poi_observation_versions = collectDistinctText(group.rows, 'poi_observation_version');
  const extraction_versions      = collectDistinctText(group.rows, 'extraction_version');

  // First / last POI (first by SQL ordering — rows are already
  // sorted by first_seen_at NULLS LAST + poi_observation_id ASC).
  const firstRow = group.rows[0];
  const lastRow  = group.rows[group.rows.length - 1];

  const first_poi_type  = firstRow !== undefined && isAllowedPoiType(firstRow.poi_type) ? firstRow.poi_type : null;
  const last_poi_type   = lastRow  !== undefined && isAllowedPoiType(lastRow.poi_type)  ? lastRow.poi_type  : null;
  const first_poi_key_present = firstRow !== undefined && coerceText(firstRow.poi_key) !== null;
  const last_poi_key_present  = lastRow  !== undefined && coerceText(lastRow.poi_key)  !== null;

  // Earliest first_seen_at + latest last_seen_at across the session.
  let earliestStart: number | null = null;
  let latestEnd:     number | null = null;
  for (const r of group.rows) {
    const fs = coerceIsoTimestamp(r.first_seen_at);
    if (fs !== null) {
      const t = Date.parse(fs);
      if (Number.isFinite(t) && (earliestStart === null || t < earliestStart)) earliestStart = t;
    }
    const ls = coerceIsoTimestamp(r.last_seen_at);
    if (ls !== null) {
      const t = Date.parse(ls);
      if (Number.isFinite(t) && (latestEnd === null || t > latestEnd)) latestEnd = t;
    }
  }
  const first_seen_at = earliestStart !== null ? new Date(earliestStart).toISOString() : null;
  const last_seen_at  = latestEnd     !== null ? new Date(latestEnd).toISOString()     : null;
  const duration_seconds =
    (earliestStart !== null && latestEnd !== null && latestEnd >= earliestStart)
      ? Math.floor((latestEnd - earliestStart) / 1000)
      : 0;

  // Stage 0 carry-through: TRUE if ANY POI row in the session has
  // stage0_excluded=TRUE. Eligibility is the pure inverse.
  let stage0_excluded = false;
  for (const r of group.rows) {
    if (coerceBoolean(r.stage0_excluded) === true) {
      stage0_excluded = true;
      break;
    }
  }
  const poi_sequence_eligible = !stage0_excluded;

  // Per-record anomaly counts.
  let anomaly_invalid_evidence_refs   = 0;
  let anomaly_invalid_source_versions = 0;
  let anomaly_forbidden_source_table  = 0;
  let anomaly_forbidden_key_present   = 0;
  for (const r of group.rows) {
    if (!isValidEvidenceRefs(r.evidence_refs))         anomaly_invalid_evidence_refs++;
    if (!isValidSourceVersions(r.source_versions))     anomaly_invalid_source_versions++;
    const st = coerceText(r.source_table);
    if (st === null || !ALLOWED_POI_SOURCE_TABLES.includes(st)) anomaly_forbidden_source_table++;
    if (hasForbiddenKeyRecursive(r.evidence_refs) || hasForbiddenKeyRecursive(r.source_versions)) {
      anomaly_forbidden_key_present++;
    }
  }

  return {
    poi_sequence_version:           POI_SEQUENCE_VERSION,
    workspace_id:                   group.workspace_id,
    site_id:                        group.site_id,
    session_id:                     group.session_id,
    poi_input_versions,
    poi_observation_versions,
    extraction_versions,
    poi_count:                      facts.poi_count,
    unique_poi_count:               facts.unique_poi_count,
    first_poi_type,
    first_poi_key_present,
    last_poi_type,
    last_poi_key_present,
    first_seen_at,
    last_seen_at,
    duration_seconds,
    repeated_poi_count:             facts.repeated_poi_count,
    has_repetition:                 facts.repeated_poi_count > 0,
    has_progression:                facts.unique_poi_count >= 2,
    progression_depth:              facts.unique_poi_count,
    poi_sequence_pattern_class:     patternClass,
    stage0_excluded,
    poi_sequence_eligible,
    evidence_refs_count:            group.rows.length,
    anomaly_invalid_evidence_refs,
    anomaly_invalid_source_versions,
    anomaly_forbidden_source_table,
    anomaly_forbidden_key_present,
  };
}

function collectDistinctText(
  rows: readonly PoiObservationRowRaw[],
  field: keyof PoiObservationRowRaw,
): readonly string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = coerceText(r[field]);
    if (v !== null) seen.add(v);
  }
  return Object.freeze([...seen].sort());
}

/* --------------------------------------------------------------------------
 * Anomaly-id collection — returns up to N poi_observation_id values
 * per AnomalyKind. Per Helen's locked rule the runner surfaces IDs
 * only (no session_id, no poi_key, no evidence_refs).
 *
 * Anomalies derived from per-row sweep:
 *   - invalid_evidence_refs        — row has malformed evidence_refs
 *   - invalid_source_versions      — row has malformed source_versions
 *   - forbidden_source_table       — row's source_table not in allowlist
 *   - forbidden_key_present        — forbidden key found in JSONB content
 *
 * Anomalies derived from per-session classification:
 *   - unknown_pattern              — session classified `unknown`
 *   - insufficient_temporal_data   — session classified insufficient_*
 *
 * For session-scoped anomalies, the sample IDs are the FIRST poi
 * observation id encountered in the session (deterministic by the
 * SQL ordering).
 * ------------------------------------------------------------------------ */
