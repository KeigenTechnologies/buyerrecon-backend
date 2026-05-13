/**
 * Sprint 2 PR#11b — POI Core Input Observer — type contract.
 *
 * Pure module. No DB import. No runtime side effects.
 *
 * IMPORTANT (PR#11a §5.1):
 *   The observer is a read-only internal engineering diagnostic. It
 *   is NOT a worker, NOT a persistence layer, NOT a Policy Pass 1,
 *   NOT a Lane A/B writer, NOT a RiskOutput emitter, NOT a Trust
 *   output, NOT a customer-facing report, NOT an envelope persistence
 *   layer. The shapes below carry that restriction structurally — no
 *   field on `ObserverReport` may match any of those concerns.
 *
 *   PR#11b builds `PoiCoreInput` envelopes in memory via PR#10's
 *   pure adapter and discards them after counting. There is NO
 *   shadow table, NO durable persistence, NO Lane A/B write.
 *
 * PR#11b boundary (Helen-signed PR#11a OD-1..OD-10):
 *   - poi_type is hard-coded to `'page_path'` in v0.1.
 *   - Primary POI derivation sources: `session_features`,
 *     `session_behavioural_features_v0_2`.
 *   - `stage0_decisions` is side-read for eligibility/provenance only.
 *     Never primary source_table. Never POI key/context.
 *   - Stage-0-excluded rows are carry-through (poi_eligible=false),
 *     NOT reject reasons.
 *   - risk_observations_v0_1 / accepted_events / rejected_events /
 *     ingest_requests / scoring_output_lane_a / scoring_output_lane_b
 *     are FORBIDDEN.
 */

import type {
  PoiCoreInput,
  PoiSourceTable,
  PoiSurfaceClass,
  PoiType,
  ReferrerClass,
} from '../poi-core/index.js';

/* --------------------------------------------------------------------------
 * RejectReason — observer diagnostic taxonomy
 *
 * Internal labels. NOT product reason codes, NOT Lane A/B codes, NOT
 * `reason_code_dictionary.yml` entries. They appear only in the
 * engineering report.
 *
 * NOTE: Stage 0 exclusion is NOT a reject reason (PR#11a §5.1 patch).
 * A Stage-0-excluded source row still builds a successful envelope
 * with `stage0_excluded=true, poi_eligible=false`. The counter is
 * `stage0_excluded_count` on the report, not a reject reason.
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
 * Raw row shapes returned by pg
 *
 * pg returns BIGINT/BIGSERIAL as JavaScript strings by default;
 * TIMESTAMPTZ arrives as `Date`; BOOLEAN as boolean. JSONB arrives
 * as parsed JS values (but PR#11b does NOT read JSONB columns from
 * source rows — evidence_refs is BUILT by the observer, not read).
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

export interface SessionBehaviouralFeaturesRowRaw {
  readonly behavioural_features_id:  unknown;
  readonly workspace_id:             unknown;
  readonly site_id:                  unknown;
  readonly session_id:               unknown;
  readonly feature_version:          unknown;
  readonly extracted_at:             unknown;
  readonly first_seen_at:            unknown;
  readonly last_seen_at:             unknown;
  readonly source_event_count:       unknown;
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
 * ObserverRunOptions — caller-supplied configuration
 *
 * The runner accepts an already-constructed pg pool/client. Env-var
 * parsing happens in the CLI script; the runner is pure of process
 * env reads.
 * ------------------------------------------------------------------------ */

export interface ObserverRunOptions {
  /** PR#10 contract stamp. MUST equal `POI_CORE_INPUT_VERSION`. */
  readonly poi_input_version:   string;
  /** PR#4 contract stamp. MUST match a real `scoring/version.yml`. */
  readonly scoring_version:     string;

  /** Optional version filter on `session_features.extraction_version`. */
  readonly extraction_version?: string | null;
  /** Optional version filter on `session_behavioural_features_v0_2.feature_version`. */
  readonly feature_version?:    string | null;

  readonly workspace_id?:       string | null;
  readonly site_id?:            string | null;

  /** Time-window filter on each source table's `extracted_at`. */
  readonly window_start:        Date;
  readonly window_end:          Date;

  /** Hard cap on rows scanned per source table per run. */
  readonly limit:               number;
  /** Max truncated session IDs in `sample_session_id_prefixes`. */
  readonly sample_limit:        number;
}

/* --------------------------------------------------------------------------
 * ObserverRowResult — internal per-row outcome
 *
 * The runner produces one of these per scanned row, then the report
 * aggregator turns them into counts + distributions. Envelopes are
 * discarded after the aggregator inspects them (PR#11a §5.1 — no
 * persistence, no shadow table).
 * ------------------------------------------------------------------------ */

export type ObserverRowResult =
  | {
      readonly outcome:       'envelope_built';
      readonly envelope:      PoiCoreInput;
      readonly session_id:    string;
      readonly source_table:  PoiSourceTable;
    }
  | {
      readonly outcome:       'rejected';
      readonly reason:        RejectReason;
      readonly session_id:    string | null;
      readonly source_table:  PoiSourceTable;
      readonly detail:        string;
    };

/* --------------------------------------------------------------------------
 * ObserverReport — the public report shape
 *
 * Matches PR#11a §5.1 verbatim (modulo PR#11b-specific shape choices).
 * JSON-serialisable. No secrets, no full session IDs (truncated only),
 * no raw payload.
 *
 * The `rows_scanned_by_source_table` + `source_table_distribution`
 * pair lets the operator compare `session_features` and
 * `session_behavioural_features_v0_2` readiness directly — which is
 * the PR#11b diagnostic question (PR#11a §6 observer-first rationale).
 * ------------------------------------------------------------------------ */

export interface ObserverReport {
  readonly rows_scanned:                    number;
  readonly rows_scanned_by_source_table:    Readonly<Record<PoiSourceTable, number>>;
  readonly envelopes_built:                 number;
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
  readonly sessions_seen_on_both_tables:    number;
  readonly sample_session_id_prefixes:      readonly string[];
  readonly run_metadata:                    ObserverRunMetadata;
}

export interface ObserverRunMetadata {
  readonly poi_input_version:        string;
  readonly scoring_version:          string;
  readonly extraction_version:       string | null;
  readonly feature_version:          string | null;
  readonly window_start:             string;   // ISO-8601
  readonly window_end:               string;   // ISO-8601
  readonly database_host:            string;
  readonly database_name:            string;
  readonly run_started_at:           string;   // ISO-8601 — observer wall-clock; NEVER flows to PoiCoreInput.derived_at
  readonly run_ended_at:             string;   // ISO-8601 — observer wall-clock; NEVER flows to PoiCoreInput.derived_at
  readonly primary_source_tables:    readonly PoiSourceTable[];
  readonly stage0_side_read_table:   'stage0_decisions';
  readonly poi_type:                 'page_path';
  readonly record_only:              true;
}
