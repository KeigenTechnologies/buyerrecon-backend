/**
 * Sprint 2 PR#11c — POI Core Worker — upsert parameter builder.
 *
 * Pure module. Given a successful `PoiCoreInput` envelope (from PR#10
 * `buildPoiCoreInput`) + the worker-derived `poi_key_source_field`
 * + `source_versions`, produces the 21-element positional parameter
 * array for `UPSERT_POI_OBSERVATION_SQL`.
 *
 * Invariants enforced here (defence in depth — the DB CHECK
 * constraints are the authoritative gate):
 *   - poi_eligible = NOT stage0_excluded (mirrors DB CHECK)
 *   - evidence_refs JSON-serialised array, never empty
 *   - source_versions JSON-serialised object containing session_features
 *   - poi_type = 'page_path' (v0.1; mirrors DB CHECK)
 *   - source_table = 'session_features' (v0.1; mirrors DB CHECK)
 *   - poi_key_source_field ∈ { 'landing_page_path', 'last_page_path' }
 *     (mirrors DB CHECK)
 *
 * If any invariant fails, the builder throws — the worker treats the
 * throw as ADAPTER_VALIDATION_ERROR. This shouldn't fire in practice
 * because the PR#10 adapter has already validated the envelope; the
 * local guards exist so a future regression surfaces before the SQL
 * round-trip.
 */

import type { PoiCoreInput } from '../poi-core/index.js';
import {
  POI_KEY_SOURCE_FIELDS_ALLOWED,
  POI_OBSERVATION_VERSION_DEFAULT,
  type PoiKeySourceField,
} from './types.js';

export interface BuildUpsertParamsArgs {
  readonly envelope:                  PoiCoreInput;
  readonly poi_observation_version:   string;
  readonly poi_key_source_field:      PoiKeySourceField;
  /**
   * Forward-compat versions map. MUST contain a `session_features`
   * entry whose value is the SF row's `extraction_version`. Optional
   * `stage0_decisions` entry carries the Stage 0 row's
   * `stage0_version` when Stage 0 was side-read.
   */
  readonly source_versions:           Readonly<Record<string, string>>;
}

/**
 * Returns the 21-element positional parameter array for
 * UPSERT_POI_OBSERVATION_SQL. JSONB params are pre-stringified.
 *
 * Param order MUST match the $1..$21 positions in
 * `query.ts::UPSERT_POI_OBSERVATION_SQL`. Any reordering requires a
 * matching change to that SQL string + the worker tests.
 */
export function buildUpsertParams(args: BuildUpsertParamsArgs): readonly unknown[] {
  const env = args.envelope;

  // v0.1 hard invariants
  if (env.poi.poi_type !== 'page_path') {
    throw new Error(`PR#11c worker invariant violated: poi_type must be 'page_path' in v0.1 (got ${JSON.stringify(env.poi.poi_type)})`);
  }
  if (env.source_identity.source_table !== 'session_features') {
    throw new Error(`PR#11c worker invariant violated: source_table must be 'session_features' in v0.1 (got ${JSON.stringify(env.source_identity.source_table)})`);
  }
  if (!POI_KEY_SOURCE_FIELDS_ALLOWED.includes(args.poi_key_source_field)) {
    throw new Error(`PR#11c worker invariant violated: poi_key_source_field must be one of ${JSON.stringify(POI_KEY_SOURCE_FIELDS_ALLOWED)} (got ${JSON.stringify(args.poi_key_source_field)})`);
  }

  // poi_eligible is the pure boolean inverse of stage0_excluded
  // (mirrors the DB CHECK `poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded`).
  // The PR#10 adapter already derives `poi_eligible = !stage0_excluded`
  // on the envelope, so the two MUST agree.
  const stage0_excluded = env.eligibility.stage0_excluded;
  const poi_eligible    = !stage0_excluded;
  if (env.eligibility.poi_eligible !== poi_eligible) {
    throw new Error(`PR#11c worker invariant violated: envelope.eligibility.poi_eligible (${env.eligibility.poi_eligible}) does not equal NOT stage0_excluded (${poi_eligible}); PR#10 adapter contract drift?`);
  }

  // evidence_refs MUST be non-empty (DB CHECK
  // `poi_obs_v0_1_evidence_refs_nonempty`; PR#10 adapter already
  // rejects empty arrays).
  if (env.evidence_refs.length === 0) {
    throw new Error('PR#11c worker invariant violated: evidence_refs must be non-empty before UPSERT');
  }

  // source_versions must be a plain object (DB CHECK
  // `poi_obs_v0_1_source_versions_is_object`) and MUST contain a
  // `session_features` entry — that value populates the first-class
  // `extraction_version` column.
  const sv = args.source_versions;
  if (sv === null || typeof sv !== 'object' || Array.isArray(sv)) {
    throw new Error('PR#11c worker invariant violated: source_versions must be a plain object');
  }
  const extractionVersion = sv['session_features'];
  if (typeof extractionVersion !== 'string' || extractionVersion.length === 0) {
    throw new Error('PR#11c worker invariant violated: source_versions["session_features"] must be a non-empty string (the SF row\'s extraction_version)');
  }

  // poi_observation_version is the literal from PR#11c types unless
  // the caller overrode it. The PR#10 adapter does not stamp this on
  // the envelope (it stamps `poi_input_version`); it comes from the
  // caller.
  const poi_observation_version =
    args.poi_observation_version && args.poi_observation_version.length > 0
      ? args.poi_observation_version
      : POI_OBSERVATION_VERSION_DEFAULT;

  return [
    env.workspace_id,                          // $1
    env.site_id,                               // $2
    env.session_id,                            // $3
    env.poi.poi_type,                          // $4   'page_path'
    env.poi.poi_key,                           // $5
    env.poi.poi_surface_class,                 // $6   nullable
    env.poi_input_version,                     // $7   'poi-core-input-v0.1'
    poi_observation_version,                   // $8   'poi-observation-v0.1'
    extractionVersion,                         // $9   SF.extraction_version
    JSON.stringify(env.evidence_refs),         // $10  JSONB array
    env.source_identity.source_table,          // $11  'session_features'
    env.source_identity.source_row_id,         // $12
    env.provenance.source_event_count,         // $13
    args.poi_key_source_field,                 // $14
    JSON.stringify(sv),                        // $15  JSONB object
    stage0_excluded,                           // $16
    poi_eligible,                              // $17  = NOT stage0_excluded
    env.eligibility.stage0_rule_id,            // $18  nullable
    env.provenance.first_seen_at,              // $19  nullable ISO-8601
    env.provenance.last_seen_at,               // $20  nullable ISO-8601
    env.provenance.derived_at,                 // $21  required ISO-8601
  ];
}
