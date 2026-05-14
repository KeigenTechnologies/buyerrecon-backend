/**
 * Sprint 2 PR#12d — POI Sequence Worker — upsert parameter builder.
 *
 * Pure module. Given a `DurableSequenceRow` (already validated by
 * the mapper) produces the 28-element positional parameter array
 * for `UPSERT_POI_SEQUENCE_OBSERVATION_SQL`.
 *
 * Defence-in-depth invariants (the DB CHECK constraints are the
 * authoritative gate):
 *   - poi_sequence_version literal pin
 *   - poi_sequence_eligible = NOT stage0_excluded
 *   - evidence_refs is a non-empty array of direct POI refs only
 *   - source_versions is a plain object with string values
 *
 * If any invariant fails, the builder throws — the worker treats the
 * throw as `ADAPTER_VALIDATION_ERROR`.
 */

import { POI_SEQUENCE_VERSION } from '../poi-sequence-observer/index.js';
import type { DurableSequenceRow } from './mapper.js';

export function buildUpsertParams(record: DurableSequenceRow): readonly unknown[] {
  // Frozen literal pin.
  if (record.poi_sequence_version !== POI_SEQUENCE_VERSION) {
    throw new Error(`PR#12d worker invariant violated: poi_sequence_version must be ${JSON.stringify(POI_SEQUENCE_VERSION)} (got ${JSON.stringify(record.poi_sequence_version)})`);
  }
  // Pure inverse.
  if (record.poi_sequence_eligible !== !record.stage0_excluded) {
    throw new Error(`PR#12d worker invariant violated: poi_sequence_eligible (${record.poi_sequence_eligible}) must equal NOT stage0_excluded (${!record.stage0_excluded})`);
  }
  // evidence_refs must be a non-empty array of direct POI refs.
  if (!Array.isArray(record.evidence_refs) || record.evidence_refs.length === 0) {
    throw new Error('PR#12d worker invariant violated: evidence_refs must be a non-empty array');
  }
  for (const ref of record.evidence_refs) {
    if (ref === null || typeof ref !== 'object' || Array.isArray(ref)) {
      throw new Error('PR#12d worker invariant violated: every evidence_refs entry must be a plain object');
    }
    if ((ref as { table?: unknown }).table !== 'poi_observations_v0_1') {
      throw new Error(`PR#12d worker invariant violated (OD-14): evidence_refs[].table must be 'poi_observations_v0_1' (got ${JSON.stringify((ref as { table?: unknown }).table)})`);
    }
    const id = (ref as { poi_observation_id?: unknown }).poi_observation_id;
    if (typeof id !== 'number' || !Number.isFinite(id) || !Number.isInteger(id) || id < 0) {
      throw new Error('PR#12d worker invariant violated: evidence_refs[].poi_observation_id must be a non-negative integer');
    }
  }
  // source_versions must be a plain object with string values.
  if (record.source_versions === null || typeof record.source_versions !== 'object' || Array.isArray(record.source_versions)) {
    throw new Error('PR#12d worker invariant violated: source_versions must be a plain object');
  }
  for (const k of Object.keys(record.source_versions)) {
    if (typeof record.source_versions[k] !== 'string') {
      throw new Error(`PR#12d worker invariant violated: source_versions[${JSON.stringify(k)}] must be a string`);
    }
  }
  // source_poi_observation_count = poi_count
  if (record.source_poi_observation_count !== record.poi_count) {
    throw new Error('PR#12d worker invariant violated: source_poi_observation_count must equal poi_count');
  }
  // poi_count / unique_poi_count bounds
  if (record.poi_count < 1) {
    throw new Error('PR#12d worker invariant violated: poi_count must be >= 1');
  }
  if (record.unique_poi_count < 1 || record.unique_poi_count > record.poi_count) {
    throw new Error('PR#12d worker invariant violated: unique_poi_count must be in [1, poi_count]');
  }

  return [
    record.workspace_id,                                  // $1
    record.site_id,                                       // $2
    record.session_id,                                    // $3
    record.poi_sequence_version,                          // $4
    record.poi_observation_version,                       // $5
    record.poi_count,                                     // $6
    record.unique_poi_count,                              // $7
    record.first_poi_type,                                // $8
    record.first_poi_key,                                 // $9
    record.last_poi_type,                                 // $10
    record.last_poi_key,                                  // $11
    record.first_seen_at,                                 // $12  nullable ISO-8601
    record.last_seen_at,                                  // $13  nullable ISO-8601
    record.duration_seconds,                              // $14  nullable int
    record.repeated_poi_count,                            // $15
    record.has_repetition,                                // $16
    record.has_progression,                               // $17
    record.progression_depth,                             // $18
    record.poi_sequence_pattern_class,                    // $19
    record.stage0_excluded,                               // $20
    record.poi_sequence_eligible,                         // $21
    record.stage0_rule_id,                                // $22  nullable
    JSON.stringify(record.evidence_refs),                 // $23  jsonb
    JSON.stringify(record.source_versions),               // $24  jsonb
    record.source_poi_observation_count,                  // $25
    record.source_min_poi_observation_id,                 // $26  nullable BIGINT
    record.source_max_poi_observation_id,                 // $27  nullable BIGINT
    record.derived_at,                                    // $28  required ISO-8601
  ];
}
