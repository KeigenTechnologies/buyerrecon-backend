/**
 * Sprint 2 PR#12d — POI Sequence Worker — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * Manual-CLI batch worker that reads `poi_observations_v0_1`, groups
 * rows into in-session POI sequences, and UPSERTs durable records
 * into `poi_sequence_observations_v0_1` (migration 015).
 *
 * Locked boundary (per PR#12c §5 / Helen sign-off OD-1..OD-14):
 *   - Reads ONLY `poi_observations_v0_1`.
 *   - Writes ONLY `poi_sequence_observations_v0_1`.
 *   - Stage 0 carry-through via POI fields only (no `stage0_decisions`
 *     re-read).
 *   - Direct `evidence_refs` point ONLY to `poi_observations_v0_1`
 *     rows (OD-14); lower-layer PR#11c refs are transitive only.
 *   - No score / verdict / reason codes / Lane A/B / Trust / Policy
 *     / Product-Context Fit / customer output.
 *   - No AMS Series Core runtime naming.
 */

import { POI_SEQUENCE_VERSION } from '../poi-sequence-observer/index.js';
import type {
  PoiObservationRowRaw,
  PoiSequencePatternClass,
} from '../poi-sequence-observer/index.js';

export { POI_SEQUENCE_VERSION };
export type { PoiObservationRowRaw, PoiSequencePatternClass };

/* --------------------------------------------------------------------------
 * Default version stamp recorded in `source_versions["poi_observations"]`.
 * Bumps require a coordinated PR with the PR#11c worker. The PR#12d
 * worker reads this from `WorkerRunOptions.poi_observations_table_version`
 * with this default as the fallback.
 * ------------------------------------------------------------------------ */

export const POI_OBSERVATIONS_TABLE_VERSION_DEFAULT = 'poi-observations-v0.1' as const;
export type PoiObservationsTableVersion = typeof POI_OBSERVATIONS_TABLE_VERSION_DEFAULT;

/* --------------------------------------------------------------------------
 * Per-row reject reasons. Per-row data-shape problems become rejects;
 * SQL/connection errors propagate to the CLI exit.
 * ------------------------------------------------------------------------ */

export type RejectReason =
  | 'MISSING_IDENTITY'             // workspace_id / site_id / session_id missing
  | 'MISSING_POI_TYPE'             // group-derived first_poi_type or last_poi_type unresolved
  | 'MISSING_POI_KEY'              // first_poi_key / last_poi_key empty
  | 'INVALID_PATTERN_CLASS'        // mapper produced an unexpected class (should not happen)
  | 'INVALID_EVIDENCE_REFS'        // group failed evidence_refs build (should not happen — defensive)
  | 'ADAPTER_VALIDATION_ERROR';    // upsert builder threw; row-shape problem

export const REJECT_REASONS: readonly RejectReason[] = Object.freeze([
  'MISSING_IDENTITY',
  'MISSING_POI_TYPE',
  'MISSING_POI_KEY',
  'INVALID_PATTERN_CLASS',
  'INVALID_EVIDENCE_REFS',
  'ADAPTER_VALIDATION_ERROR',
] as const);

/* --------------------------------------------------------------------------
 * Upsert action — emitted by the `INSERT ... ON CONFLICT DO UPDATE`
 * RETURNING clause. The worker counts these per run.
 * ------------------------------------------------------------------------ */

export type UpsertAction = 'inserted' | 'updated';

/* --------------------------------------------------------------------------
 * Per-row outcomes
 * ------------------------------------------------------------------------ */

export interface WorkerRowUpserted {
  readonly outcome:       'upserted';
  readonly session_id:    string;
  readonly upsert_action: UpsertAction;
  readonly pattern_class: PoiSequencePatternClass;
  readonly stage0_excluded: boolean;
  readonly poi_count:     number;
}

export interface WorkerRowRejected {
  readonly outcome:    'rejected';
  readonly reason:     RejectReason;
  readonly session_id: string | null;
  readonly detail:     string;
}

export type WorkerRowResult = WorkerRowUpserted | WorkerRowRejected;

/* --------------------------------------------------------------------------
 * Run options — CLI parses env, hands the options to the runner.
 * Mirrors PR#11c worker shape.
 * ------------------------------------------------------------------------ */

export interface WorkerRunOptions {
  readonly workspace_id?:                       string | null;
  readonly site_id?:                            string | null;

  readonly window_start:                        Date;
  readonly window_end:                          Date;

  readonly limit:                               number;
  readonly sample_limit:                        number;

  /** Frozen literal version stamps surfaced on metadata + source_versions. */
  readonly poi_sequence_version:                string;
  readonly poi_input_version_expected:          string;
  readonly poi_observation_version_expected:    string;
  readonly poi_observations_table_version:      string;

  /** Optional rootDir for the PR#4 contract guards (test injection). */
  readonly rootDir?:                            string;
}

/* --------------------------------------------------------------------------
 * Worker report — emitted to stdout (JSON) by the CLI.
 * ------------------------------------------------------------------------ */

export interface WorkerReport {
  readonly rows_scanned:                        number;
  readonly sessions_seen:                       number;
  readonly rows_inserted:                       number;
  readonly rows_updated:                        number;
  readonly rejects:                             number;
  readonly reject_reasons:                      Readonly<Record<RejectReason, number>>;

  /** Pattern-class distribution across successfully-upserted rows. */
  readonly poi_sequence_pattern_class_distribution:
    Readonly<Record<PoiSequencePatternClass, number>>;

  /** Stage 0 carry-through distribution across successfully-upserted rows. */
  readonly stage0_excluded_count:               number;
  readonly poi_sequence_eligible_count:         number;

  readonly unique_session_ids_seen:             number;
  readonly sample_session_id_prefixes:          readonly string[];

  readonly run_metadata:                        WorkerRunMetadata;
}

export interface WorkerRunMetadata {
  readonly source_table:                        'poi_observations_v0_1';
  readonly target_table:                        'poi_sequence_observations_v0_1';
  readonly workspace_id_filter:                 string | null;
  readonly site_id_filter:                      string | null;
  readonly window_start:                        string;   // ISO-8601
  readonly window_end:                          string;   // ISO-8601
  readonly row_limit:                           number;
  readonly sample_limit:                        number;
  readonly database_host:                       string;
  readonly database_name:                       string;
  readonly run_started_at:                      string;
  readonly run_ended_at:                        string;
  readonly poi_sequence_version:                string;
  readonly poi_input_version_expected:          string;
  readonly poi_observation_version_expected:    string;
  readonly poi_observations_table_version:      string;
  readonly record_only:                         true;
}
