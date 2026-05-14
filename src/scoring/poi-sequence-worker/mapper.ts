/**
 * Sprint 2 PR#12d — POI Sequence Worker — mapper.
 *
 * Pure module. NO clock reads. NO randomness. NO DB. NO process.env.
 *
 * Wraps the PR#12b observer's `buildSequenceRecord` (single source of
 * truth for in-session POI ordering classification) and extends the
 * result with the durable-row fields the table requires
 * (`first_poi_key`, `last_poi_key`, BIGSERIAL id range, ISO-8601
 * `derived_at`).
 *
 * Per Helen OD-14: `evidence_refs` entries point ONLY to direct
 * `poi_observations_v0_1` rows via shape
 * `{ "table": "poi_observations_v0_1", "poi_observation_id": <BIGSERIAL id> }`.
 * Lower-layer PR#11c POI evidence_refs (session_features /
 * session_behavioural_features_v0_2 / stage0_decisions) MUST NOT
 * be flattened, copied, or inlined here.
 */

import {
  buildSequenceRecord,
  groupRowsBySession,
  POI_SEQUENCE_VERSION,
  type GroupedRows,
  type PoiObservationRowRaw,
  type PoiSequencePatternClass,
  type PoiSequenceRecord,
} from '../poi-sequence-observer/index.js';
import type { RejectReason } from './types.js';

export { buildSequenceRecord, groupRowsBySession };
export type { GroupedRows };

/* --------------------------------------------------------------------------
 * Coercion helpers — defensive copies of the observer's helpers
 * (kept local so this module remains importable in tests without
 * pulling in the observer's full surface).
 * ------------------------------------------------------------------------ */

function coerceTextOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function coerceBigserialOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

/* --------------------------------------------------------------------------
 * DurableSequenceRow — exactly the column set the worker upserts.
 * ------------------------------------------------------------------------ */

export interface DurableSequenceRow {
  readonly workspace_id:                  string;
  readonly site_id:                       string;
  readonly session_id:                    string;
  readonly poi_sequence_version:          string;
  readonly poi_observation_version:       string;

  readonly poi_count:                     number;
  readonly unique_poi_count:              number;
  readonly first_poi_type:                string;
  readonly first_poi_key:                 string;
  readonly last_poi_type:                 string;
  readonly last_poi_key:                  string;
  readonly first_seen_at:                 string | null;
  readonly last_seen_at:                  string | null;
  readonly duration_seconds:              number | null;
  readonly repeated_poi_count:            number;
  readonly has_repetition:                boolean;
  readonly has_progression:               boolean;
  readonly progression_depth:             number;
  readonly poi_sequence_pattern_class:    PoiSequencePatternClass;

  readonly stage0_excluded:               boolean;
  readonly poi_sequence_eligible:         boolean;
  readonly stage0_rule_id:                string | null;

  /** Direct refs only — every entry `{ table: 'poi_observations_v0_1', poi_observation_id }`. */
  readonly evidence_refs:                 ReadonlyArray<{ readonly table: 'poi_observations_v0_1'; readonly poi_observation_id: number }>;
  readonly source_versions:               Readonly<Record<string, string>>;
  readonly source_poi_observation_count:  number;
  readonly source_min_poi_observation_id: number | null;
  readonly source_max_poi_observation_id: number | null;

  readonly derived_at:                    string; // ISO-8601 — worker run timestamp per OD-12 doc note
}

/* --------------------------------------------------------------------------
 * MapperOutcome — same vocabulary as PR#11c mapper.
 * ------------------------------------------------------------------------ */

export type MapperOutcome =
  | { readonly outcome: 'ok'; readonly record: DurableSequenceRow }
  | { readonly outcome: 'rejected'; readonly reason: RejectReason; readonly detail: string };

/* --------------------------------------------------------------------------
 * BuildDurableSequenceRecordArgs
 * ------------------------------------------------------------------------ */

export interface BuildDurableSequenceRecordArgs {
  readonly group:                              GroupedRows;
  /** ISO-8601 — worker wall-clock at derivation. */
  readonly derived_at_iso:                     string;
  /** Forward-compat versions map base. Worker fills in dynamic version values. */
  readonly poi_input_version_expected:         string;
  readonly poi_observation_version_expected:   string;
  readonly poi_observations_table_version:     string;
}

/* --------------------------------------------------------------------------
 * buildDurableSequenceRecord — extend the observer's PoiSequenceRecord
 * with the durable-row fields.
 *
 * Returns a `rejected` outcome (NOT a throw) when:
 *   - first/last POI type can't be resolved to an allowed PoiType
 *   - first/last POI key is missing
 *
 * SQL/connection errors do not appear here — they propagate up from
 * the worker.
 * ------------------------------------------------------------------------ */

export function buildDurableSequenceRecord(args: BuildDurableSequenceRecordArgs): MapperOutcome {
  const group = args.group;
  const obs:   PoiSequenceRecord = buildSequenceRecord(group);

  // Defensive — should never trip with v0.1 POI rows (migration 014
  // pins poi_type='page_path'), but the observer mapper allows for
  // PoiType | null returns.
  if (obs.first_poi_type === null || obs.last_poi_type === null) {
    return {
      outcome: 'rejected',
      reason:  'MISSING_POI_TYPE',
      detail:  `session ${group.session_id}: observer mapper did not resolve first/last POI type`,
    };
  }

  // Extract POI keys directly from the grouped rows (the observer's
  // PoiSequenceRecord intentionally exposes only key-present booleans
  // for privacy; the worker needs the actual key strings to persist).
  const firstRow = group.rows[0];
  const lastRow  = group.rows[group.rows.length - 1];

  const firstPoiKey = firstRow !== undefined ? coerceTextOrNull(firstRow.poi_key) : null;
  const lastPoiKey  = lastRow  !== undefined ? coerceTextOrNull(lastRow.poi_key)  : null;
  if (firstPoiKey === null || lastPoiKey === null) {
    return {
      outcome: 'rejected',
      reason:  'MISSING_POI_KEY',
      detail:  `session ${group.session_id}: first/last poi_key missing or empty on grouped rows`,
    };
  }

  // Direct evidence_refs — OD-14 strict: { table: 'poi_observations_v0_1', poi_observation_id }
  const evidence_refs: { table: 'poi_observations_v0_1'; poi_observation_id: number }[] = [];
  let minId: number | null = null;
  let maxId: number | null = null;
  for (const r of group.rows) {
    const id = coerceBigserialOrNull(r.poi_observation_id);
    if (id === null) {
      return {
        outcome: 'rejected',
        reason:  'INVALID_EVIDENCE_REFS',
        detail:  `session ${group.session_id}: POI observation row missing/invalid poi_observation_id`,
      };
    }
    evidence_refs.push({ table: 'poi_observations_v0_1', poi_observation_id: id });
    if (minId === null || id < minId) minId = id;
    if (maxId === null || id > maxId) maxId = id;
  }
  if (evidence_refs.length === 0) {
    return {
      outcome: 'rejected',
      reason:  'INVALID_EVIDENCE_REFS',
      detail:  `session ${group.session_id}: empty grouped rows (should not happen post-grouping)`,
    };
  }

  // Carry-through version stamps — pick the first (POI rows for a
  // session share their POI input / observation versions; the
  // observer mapper already deduplicates these into sorted distinct
  // lists).
  const poi_observation_version =
    obs.poi_observation_versions[0] ?? args.poi_observation_version_expected;
  const poi_input_version_carried =
    obs.poi_input_versions[0] ?? args.poi_input_version_expected;

  // source_versions JSONB object — every value a string (DB CHECK
  // requires JSONB object; worker requires string-valued entries).
  const source_versions: Record<string, string> = {
    poi_observations:           args.poi_observations_table_version,
    poi_input_version:          poi_input_version_carried,
    poi_observation_version,
    poi_sequence_version:       POI_SEQUENCE_VERSION,
  };

  // duration_seconds: nullable when both timestamps were absent.
  const duration_seconds =
    obs.first_seen_at === null || obs.last_seen_at === null
      ? null
      : obs.duration_seconds;

  // Stage 0 rule id — pick the first non-null rule id from the POI
  // rows for the session (provenance-only).
  let stage0_rule_id: string | null = null;
  for (const r of group.rows) {
    const v = coerceTextOrNull(r.stage0_rule_id);
    if (v !== null) {
      stage0_rule_id = v;
      break;
    }
  }

  // Defence-in-depth invariant (mirrors DB CHECK):
  //   repeated_poi_count = poi_count - unique_poi_count
  //   has_repetition     = (repeated_poi_count > 0)
  //   progression_depth  = unique_poi_count
  //   has_progression    = (unique_poi_count >= 2)
  //   poi_sequence_eligible = NOT stage0_excluded
  // The observer's buildSequenceRecord already enforces these via its
  // construction; if any drifts we hit this assertion before SQL.
  if (obs.repeated_poi_count !== obs.poi_count - obs.unique_poi_count) {
    return {
      outcome: 'rejected',
      reason:  'INVALID_PATTERN_CLASS',
      detail:  `session ${group.session_id}: observer drift — repeated_poi_count != poi_count - unique_poi_count`,
    };
  }
  if (obs.has_repetition !== (obs.repeated_poi_count > 0)) {
    return {
      outcome: 'rejected',
      reason:  'INVALID_PATTERN_CLASS',
      detail:  `session ${group.session_id}: observer drift — has_repetition != (repeated_poi_count > 0)`,
    };
  }
  if (obs.has_progression !== (obs.unique_poi_count >= 2)) {
    return {
      outcome: 'rejected',
      reason:  'INVALID_PATTERN_CLASS',
      detail:  `session ${group.session_id}: observer drift — has_progression != (unique_poi_count >= 2)`,
    };
  }

  const record: DurableSequenceRow = {
    workspace_id:                  obs.workspace_id,
    site_id:                       obs.site_id,
    session_id:                    obs.session_id,
    poi_sequence_version:          POI_SEQUENCE_VERSION,
    poi_observation_version,
    poi_count:                     obs.poi_count,
    unique_poi_count:              obs.unique_poi_count,
    first_poi_type:                obs.first_poi_type,
    first_poi_key:                 firstPoiKey,
    last_poi_type:                 obs.last_poi_type,
    last_poi_key:                  lastPoiKey,
    first_seen_at:                 obs.first_seen_at,
    last_seen_at:                  obs.last_seen_at,
    duration_seconds,
    repeated_poi_count:            obs.repeated_poi_count,
    has_repetition:                obs.has_repetition,
    has_progression:               obs.has_progression,
    progression_depth:             obs.progression_depth,
    poi_sequence_pattern_class:    obs.poi_sequence_pattern_class,
    stage0_excluded:               obs.stage0_excluded,
    poi_sequence_eligible:         obs.poi_sequence_eligible,
    stage0_rule_id,
    evidence_refs,
    source_versions,
    source_poi_observation_count:  obs.poi_count,
    source_min_poi_observation_id: minId,
    source_max_poi_observation_id: maxId,
    derived_at:                    args.derived_at_iso,
  };

  return { outcome: 'ok', record };
}
