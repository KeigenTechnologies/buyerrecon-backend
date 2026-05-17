/**
 * Sprint 2 PR#16b — Lane A / Lane B Evidence Review preview observer — types.
 *
 * Read-only. No DB writes. No durable Lane-A / Lane-B writer.
 * No customer-facing automated scoring. No AMS runtime bridge.
 *
 * The preview consumes a PR#15a `EvidenceReviewSnapshotReport`
 * in memory and projects it into a customer-shaped, internal-only
 * preview that obeys the PR#16a Lane A / Lane B contract.
 *
 * Hard boundary (carried verbatim into preview.ts / report.ts):
 *   - Output is markdown to stdout, internal-only.
 *   - No durable table; no migration; no schema change.
 *   - No automated per-visitor / per-session score.
 *   - No `ProductDecision`. No `RequestedAction`.
 *   - No AMS Product Layer execution; no runtime bridge.
 *   - No Track-A label inside any Lane-A or Lane-B observation;
 *     "Track A" may appear only in the dedicated readiness note
 *     and forbidden-boundary text.
 *   - No raw identifiers — no full session_id, visitor_id,
 *     person_id, company_id, account_id, email_hash, person_hash,
 *     token_hash, ip_hash, user_agent, full URLs with query
 *     strings, cookies, JWTs, or raw JSON payloads.
 */

export const LANE_AB_PREVIEW_VERSION =
  'lane-ab-preview-observer-v0.1' as const;

/* --------------------------------------------------------------------------
 * Boundary
 * ------------------------------------------------------------------------ */

export interface LaneABPreviewBoundary {
  readonly preview_version:      typeof LANE_AB_PREVIEW_VERSION;
  readonly snapshot_version:     string;
  readonly workspace_id:         string;
  readonly site_id:              string;
  readonly window_start_iso:     string;
  readonly window_end_iso:       string;
  readonly checked_at_iso:       string;
  readonly database_host_masked: string;
  readonly database_name_masked: string;
}

/* --------------------------------------------------------------------------
 * Lane A — customer-safer evidence-quality observations.
 *
 * "Lane A candidate observations are evidence-review inputs, not
 *  automated customer-facing scores." (PR#16a §3 Lane A.)
 * ------------------------------------------------------------------------ */

export type LaneAObservationFamily =
  | 'rejected_event'
  | 'stage0_excluded'
  | 'risk_corroboration'
  | 'evidence_chain_gap';

export interface LaneAObservation {
  readonly family:                   LaneAObservationFamily;
  readonly evidence_source:          string;
  readonly aggregate_count:          number | null;
  readonly cannot_verify_yet_reason: string | null;
  readonly manual_review_needed:     boolean;
}

export interface LaneAPreview {
  readonly posture_note:                    string;
  readonly observations:                    readonly LaneAObservation[];
  readonly evidence_gaps_affecting_lane_a:  readonly string[];
}

/* --------------------------------------------------------------------------
 * Lane B — internal-only buyer-motion / product-context / timing.
 *
 * "Lane B observations are internal learning inputs only and must
 *  not be exposed as customer-facing claims." (PR#16a §3 Lane B.)
 * ------------------------------------------------------------------------ */

export type LaneBObservationFamily =
  | 'buyer_motion_hypothesis'
  | 'product_context_hypothesis'
  | 'timing_window_hypothesis'
  | 'evidence_pipeline_coverage';

export interface LaneBObservation {
  readonly family:                       LaneBObservationFamily;
  readonly evidence_source:              string;
  readonly aggregate_count:              number | null;
  readonly missing_evidence_bucket:      string | null;
  readonly private_founder_note_prompt:  string;
}

export interface LaneBPreview {
  readonly posture_note:                    string;
  readonly observations:                    readonly LaneBObservation[];
  readonly evidence_gaps_affecting_lane_b:  readonly string[];
}

/* --------------------------------------------------------------------------
 * Customer-wording rails
 *
 * §7 "What may be shown in an Evidence Review" and §8 "What must
 * stay internal" carry the PR#16a customer-wording rules verbatim
 * into the preview so a downstream reader sees them next to the
 * Lane A / Lane B counts.
 * ------------------------------------------------------------------------ */

export interface CustomerWordingRails {
  readonly allowed:    readonly string[];
  readonly forbidden:  readonly string[];
}

export interface InternalOnlyRails {
  readonly internal_only:  readonly string[];
  readonly forbidden:      readonly string[];
}

/* --------------------------------------------------------------------------
 * Track A readiness — repeats PR#16a §6 / §11 verbatim so the
 * preview itself documents that Track A has not been run.
 * ------------------------------------------------------------------------ */

export interface TrackAReadinessNote {
  readonly track_a_run_in_this_pr: false;
  readonly posture:                readonly string[];
  readonly forbidden_leakage:      readonly string[];
}

/* --------------------------------------------------------------------------
 * Composite preview report
 * ------------------------------------------------------------------------ */

export interface LaneABPreviewReport {
  readonly boundary:               LaneABPreviewBoundary;
  readonly source_availability:    SourceAvailabilitySummary;
  readonly lane_a:                 LaneAPreview;
  readonly lane_b:                 LaneBPreview;
  readonly customer_wording_rails: CustomerWordingRails;
  readonly internal_only_rails:    InternalOnlyRails;
  readonly track_a_readiness:      TrackAReadinessNote;
}

export interface SourceAvailabilityRow {
  readonly evidence_source: string;
  readonly exists:          boolean;
  readonly rows_in_window:  number | null;
  readonly note:            string;
}

export interface SourceAvailabilitySummary {
  readonly rows: readonly SourceAvailabilityRow[];
}
