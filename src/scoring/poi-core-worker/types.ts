/**
 * Sprint 2 PR#11c — POI Core Worker — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * Persists successful `page_path` POI envelopes derived from
 * `session_features` rows into `poi_observations_v0_1`. Mirrors the
 * PR#11b observer's diagnostic vocabulary so PR#11d can compare
 * observer → worker → table results without a translation layer.
 *
 * IMPORTANT (PR#11c planning §4–§5 + Helen OD-1..OD-11):
 *   - poi_type is hard-coded to 'page_path' in v0.1 (CHECK constraint).
 *   - source_table is hard-coded to 'session_features' in v0.1 (CHECK).
 *   - Stage 0 is side-read only. Never a primary source_table. Never
 *     POI key / POI context / scoring reason / customer-facing reason
 *     code / downstream judgement / Policy/Trust reason / report
 *     language / Product-Context-Fit input.
 *   - poi_eligible = NOT stage0_excluded (pure boolean inverse;
 *     enforced at both worker and DB-CHECK layers).
 *   - stage0_rule_id is provenance-only.
 *   - evidence_refs MUST be non-empty (DB CHECK + adapter rejects).
 *   - SBF is NOT a PR#11c v0.1 read source (Helen OD-5).
 *   - risk_observations_v0_1 / accepted_events / rejected_events /
 *     ingest_requests / scoring_output_lane_a / scoring_output_lane_b /
 *     site_write_tokens are FORBIDDEN reads.
 */

import type {
  PoiCoreInput,
  PoiSourceTable,
  PoiSurfaceClass,
  PoiType,
  ReferrerClass,
} from '../poi-core/index.js';

/* --------------------------------------------------------------------------
 * Versioning constants
 *
 * `POI_OBSERVATION_VERSION_DEFAULT` is the literal version stamped on
 * every PR#11c v0.1 row. Mirrors PR#6's `OBSERVATION_VERSION_DEFAULT`
 * pattern. A future PR that changes the observation contract bumps
 * this literal.
 * ------------------------------------------------------------------------ */

export const POI_OBSERVATION_VERSION_DEFAULT = 'poi-observation-v0.1' as const;
export type PoiObservationVersion = typeof POI_OBSERVATION_VERSION_DEFAULT;

/* --------------------------------------------------------------------------
 * RejectReason — worker diagnostic taxonomy (mirrors PR#11b verbatim)
 *
 * Internal labels. NOT product reason codes, NOT Lane A/B codes, NOT
 * `reason_code_dictionary.yml` entries. They appear only in the
 * engineering report.
 *
 * NOTE: Stage 0 exclusion is NOT a reject reason. A Stage-0-excluded
 * source row still builds a successful envelope with
 * `stage0_excluded=true, poi_eligible=false` and is UPSERTed. The
 * counter is `stage0_excluded_count` on the worker report, not a
 * reject reason. `REJECT_REASONS` MUST NOT contain `STAGE0_EXCLUDED`.
 * ------------------------------------------------------------------------ */

export type RejectReason =
  | 'MISSING_REQUIRED_ID'
  | 'MISSING_EXTRACTED_AT'
  | 'NO_PAGE_PATH_CANDIDATE'
  | 'INVALID_PAGE_PATH'
  | 'EVIDENCE_REF_REJECT'
  | 'INVALID_STAGE0_CONTEXT'
  | 'ADAPTER_VALIDATION_ERROR'
  | 'UNEXPECTED_ERROR';

export const REJECT_REASONS: readonly RejectReason[] = Object.freeze([
  'MISSING_REQUIRED_ID',
  'MISSING_EXTRACTED_AT',
  'NO_PAGE_PATH_CANDIDATE',
  'INVALID_PAGE_PATH',
  'EVIDENCE_REF_REJECT',
  'INVALID_STAGE0_CONTEXT',
  'ADAPTER_VALIDATION_ERROR',
  'UNEXPECTED_ERROR',
] as const);

/* --------------------------------------------------------------------------
 * poi_key_source_field discriminator (OD-11)
 *
 * Records which SF column produced `poi_key`:
 *   - `landing_page_path` (preferred)
 *   - `last_page_path`    (fallback)
 *
 * Provenance only. NEVER a POI key, POI context, customer-facing
 * label, or downstream judgement signal. CHECK-enforced at the DB
 * layer.
 * ------------------------------------------------------------------------ */

export type PoiKeySourceField = 'landing_page_path' | 'last_page_path';

export const POI_KEY_SOURCE_FIELDS_ALLOWED: readonly PoiKeySourceField[] = Object.freeze([
  'landing_page_path',
  'last_page_path',
]);

/* --------------------------------------------------------------------------
 * Raw row shapes returned by pg
 *
 * pg returns BIGINT/BIGSERIAL as JavaScript strings by default;
 * TIMESTAMPTZ arrives as `Date`; BOOLEAN as boolean.
 *
 * The worker reads `session_features` (primary) + `stage0_decisions`
 * (side-read). SBF is NOT read. JSONB columns from source tables are
 * NOT selected — evidence_refs are BUILT by the worker.
 * ------------------------------------------------------------------------ */

export interface SessionFeaturesRowRaw {
  readonly session_features_id:  unknown;
  readonly workspace_id:         unknown;
  readonly site_id:              unknown;
  readonly session_id:           unknown;
  readonly extraction_version:   unknown;
  readonly extracted_at:         unknown;
  readonly first_seen_at:        unknown;
  readonly last_seen_at:         unknown;
  readonly source_event_count:   unknown;
  readonly landing_page_path:    unknown;
  readonly last_page_path:       unknown;
}

export interface Stage0RowRaw {
  readonly stage0_decision_id:  unknown;
  readonly workspace_id:        unknown;
  readonly site_id:             unknown;
  readonly session_id:          unknown;
  readonly stage0_version:      unknown;
  readonly excluded:            unknown;
  readonly rule_id:             unknown;
  readonly record_only:         unknown;
}

/* --------------------------------------------------------------------------
 * WorkerRunOptions — caller-supplied configuration
 *
 * The runner accepts an already-constructed pg pool/client. Env-var
 * parsing happens in `parsePoiCoreWorkerEnvOptions` (also in this
 * module); the worker function is pure of process-env reads.
 * ------------------------------------------------------------------------ */

export interface WorkerRunOptions {
  /** PR#10 contract stamp. MUST equal `POI_CORE_INPUT_VERSION`. */
  readonly poi_input_version:       string;
  /** PR#11c observation contract stamp. Defaults to
   *  `POI_OBSERVATION_VERSION_DEFAULT`. */
  readonly poi_observation_version: string;
  /** PR#4 contract stamp. MUST match a real `scoring/version.yml`. */
  readonly scoring_version:         string;

  /** Optional version filter on `session_features.extraction_version`. */
  readonly extraction_version?:     string | null;

  readonly workspace_id?:           string | null;
  readonly site_id?:                string | null;

  /** Time-window filter on `session_features.extracted_at`. */
  readonly window_start:            Date;
  readonly window_end:              Date;

  /** Hard cap on SF rows scanned per run. */
  readonly limit:                   number;
  /** Max truncated session IDs in `sample_session_id_prefixes`. */
  readonly sample_limit:            number;

  /** Repo root for the PR#4 contract loader (defaults to auto-detect). */
  readonly rootDir?:                string;
}

/* --------------------------------------------------------------------------
 * WorkerRowResult — internal per-row outcome
 *
 * Either:
 *   - upserted (envelope built + INSERT … ON CONFLICT … DO UPDATE ran)
 *   - rejected (no DB write happened)
 * ------------------------------------------------------------------------ */

export type WorkerRowResult =
  | {
      readonly outcome:       'upserted';
      readonly envelope:      PoiCoreInput;
      readonly session_id:    string;
      readonly upsert_action: UpsertAction;
    }
  | {
      readonly outcome:       'rejected';
      readonly reason:        RejectReason;
      readonly session_id:    string | null;
      readonly detail:        string;
    };

/**
 * Upsert action returned by the DB:
 *   - 'inserted': new row landed (xmax = 0)
 *   - 'updated':  ON CONFLICT DO UPDATE fired (xmax != 0)
 *   - 'unchanged': RESERVED for a future compare-and-skip mode
 *     (PR#11c v0.1 always sets updated_at = NOW(), so this value is
 *     not produced in v0.1)
 */
export type UpsertAction = 'inserted' | 'updated' | 'unchanged';

/* --------------------------------------------------------------------------
 * WorkerReport — the public report shape (stdout JSON)
 *
 * Mirrors the PR#11b observer report shape with worker-specific
 * deltas (`rows_inserted` / `rows_updated` / `rows_unchanged` instead
 * of `envelopes_built`). The diagnostic vocabulary is identical so an
 * operator can compare observer ↔ worker ↔ PR#11d table without
 * mental translation.
 * ------------------------------------------------------------------------ */

export interface WorkerReport {
  readonly rows_scanned:                    number;
  readonly rows_inserted:                   number;
  readonly rows_updated:                    number;
  readonly rows_unchanged:                  number;
  readonly rejects:                         number;
  readonly reject_reasons:                  Readonly<Record<RejectReason, number>>;
  readonly poi_type_distribution:           Readonly<Record<PoiType, number>>;
  readonly poi_surface_class_distribution:  Readonly<Record<PoiSurfaceClass, number>>;
  readonly referrer_class_distribution:     Readonly<Record<ReferrerClass, number>>;
  readonly source_table_distribution:       Readonly<Record<PoiSourceTable, number>>;
  readonly stage0_excluded_count:           number;
  readonly eligible_for_poi_count:          number;
  readonly unsafe_poi_key_reject_count:     number;
  readonly evidence_ref_reject_count:       number;
  readonly unique_session_ids_seen:         number;
  readonly sample_session_id_prefixes:      readonly string[];
  readonly run_metadata:                    WorkerRunMetadata;
}

export interface WorkerRunMetadata {
  readonly poi_input_version:        string;
  readonly poi_observation_version:  string;
  readonly scoring_version:          string;
  readonly extraction_version:       string | null;
  readonly window_start:             string;   // ISO-8601
  readonly window_end:               string;   // ISO-8601
  readonly database_host:            string;
  readonly database_name:            string;
  readonly run_started_at:           string;   // ISO-8601 — worker wall-clock; NEVER flows to PoiCoreInput.derived_at
  readonly run_ended_at:             string;   // ISO-8601 — worker wall-clock; NEVER flows to PoiCoreInput.derived_at
  readonly primary_source_tables:    readonly PoiSourceTable[];
  readonly stage0_side_read_table:   'stage0_decisions';
  readonly poi_type:                 'page_path';
  readonly target_table:             'poi_observations_v0_1';
  readonly record_only:              true;
}
