/**
 * Sprint 2 PR#15a — Evidence Review Snapshot Observer — type contract.
 *
 * Read-only. No DB writes. No customer-facing automated scoring.
 * The snapshot supports the Phase-1 £1,250 Evidence Review by
 * giving Helen an internal, founder-readable picture of evidence
 * quality + Lane-A-candidate / Lane-B-internal counts before she
 * writes the customer review.
 *
 * Hard boundary (carried verbatim into runner / report):
 *   - No durable Lane A / Lane B writer.
 *   - No ProductDecision / RequestedAction.
 *   - No AMS Product Layer execution.
 *   - No customer-facing surface; output is markdown to stdout
 *     for Helen's eyes only.
 */

export const SNAPSHOT_OBSERVER_VERSION =
  'evidence-review-snapshot-observer-v0.1' as const;

/* --------------------------------------------------------------------------
 * Run options + boundary block
 * ------------------------------------------------------------------------ */

export interface SnapshotRunOptions {
  readonly workspace_id:   string;
  readonly site_id:        string;
  readonly window_start:   Date;
  readonly window_end:     Date;
}

export interface SnapshotBoundary {
  readonly observer_version:     typeof SNAPSHOT_OBSERVER_VERSION;
  readonly workspace_id:         string;
  readonly site_id:              string;
  readonly window_start_iso:     string;
  readonly window_end_iso:       string;
  readonly checked_at_iso:       string;
  readonly database_host_masked: string;
  readonly database_name_masked: string;
}

/* --------------------------------------------------------------------------
 * Source availability
 * ------------------------------------------------------------------------ */

/**
 * Per-table availability + window-filtered row count. A table that
 * does not exist in the schema is reported `exists: false`, never
 * crashes the snapshot.
 */
export interface TableAvailability {
  readonly table_name:    string;
  readonly exists:        boolean;
  readonly row_count:     number | null; // null when table missing OR query failed
  readonly note:          string | null; // optional note (e.g. "table missing", "column shape mismatch")
}

export interface SourceAvailabilityBlock {
  readonly tables: readonly TableAvailability[];
}

/* --------------------------------------------------------------------------
 * Evidence chain summary
 * ------------------------------------------------------------------------ */

export interface EvidenceChainSummary {
  readonly accepted_events_rows:               number | null;
  readonly rejected_events_rows:               number | null;
  readonly ingest_requests_rows:               number | null;
  readonly session_features_rows:              number | null;
  readonly session_behavioural_features_rows:  number | null;
  readonly stage0_decisions_rows:              number | null;
  readonly risk_observations_rows:             number | null;
  readonly poi_observations_rows:              number | null;
  readonly poi_sequence_observations_rows:     number | null;
}

/* --------------------------------------------------------------------------
 * Lane A — customer-safer candidate observations
 *
 * "Lane A candidate observations are evidence-review inputs, not
 *  automated customer-facing scores." (PR#15a §4 boundary label.)
 * ------------------------------------------------------------------------ */

export interface LaneACandidates {
  readonly rejected_event_count:                       number | null;
  readonly stage0_excluded_count:                      number | null;
  readonly risk_observation_rows_with_evidence:        number | null;
  readonly bot_like_or_ambiguous_evidence_count_note:  string;
  readonly evidence_gaps_affecting_traffic_quality:    readonly string[];
}

/* --------------------------------------------------------------------------
 * Lane B — internal-only observations
 *
 * "Lane B observations are internal learning inputs only and must
 *  not be exposed as customer-facing claims." (PR#15a §5 boundary
 *  label.)
 * ------------------------------------------------------------------------ */

export interface LaneBInternal {
  readonly poi_observation_rows:                       number | null;
  readonly poi_sequence_observation_rows:              number | null;
  readonly session_features_coverage_rows:             number | null;
  readonly session_behavioural_features_coverage_rows: number | null;
  readonly stage0_eligible_count:                      number | null;
  readonly ambiguous_or_insufficient_buckets_note:     string;
}

/* --------------------------------------------------------------------------
 * Evidence gaps
 * ------------------------------------------------------------------------ */

export interface EvidenceGaps {
  readonly missing_accepted_events_coverage:    boolean;
  readonly missing_session_features:            boolean;
  readonly missing_behavioural_features:        boolean;
  readonly missing_poi_observations:            boolean;
  readonly missing_risk_observations:           boolean;
  readonly missing_productfeatures_observations: boolean;
  readonly insufficient_window:                 boolean;
  readonly no_conversion_evidence:              boolean;
  readonly insufficient_utm_source_context:     boolean;
  readonly gaps_summary:                        readonly string[];
}

/* --------------------------------------------------------------------------
 * Evidence Review readiness — operator bucket, NOT a numeric score
 * ------------------------------------------------------------------------ */

export type ReadinessBucket =
  | 'READY_FOR_MANUAL_REVIEW'
  | 'NEEDS_MORE_EVIDENCE'
  | 'INSTALL_OR_DATA_GAP'
  | 'STOP_THE_LINE';

export interface ReadinessAssessment {
  readonly bucket:        ReadinessBucket;
  readonly reasons:       readonly string[];
}

/* --------------------------------------------------------------------------
 * Founder notes prompt (copyable into private customer folder)
 * ------------------------------------------------------------------------ */

export interface FounderNotesPrompt {
  readonly what_looks_verifiable:        readonly string[];
  readonly what_remains_unknown:         readonly string[];
  readonly what_should_not_be_claimed:   readonly string[];
  readonly what_needs_customer_confirmation: readonly string[];
  readonly what_to_check_in_ga4_or_crm:  readonly string[];
}

/* --------------------------------------------------------------------------
 * Composite report
 * ------------------------------------------------------------------------ */

export interface EvidenceReviewSnapshotReport {
  readonly boundary:           SnapshotBoundary;
  readonly source_availability: SourceAvailabilityBlock;
  readonly evidence_chain:     EvidenceChainSummary;
  readonly lane_a_candidates:  LaneACandidates;
  readonly lane_b_internal:    LaneBInternal;
  readonly evidence_gaps:      EvidenceGaps;
  readonly readiness:          ReadinessAssessment;
  readonly founder_notes_prompt: FounderNotesPrompt;
}
