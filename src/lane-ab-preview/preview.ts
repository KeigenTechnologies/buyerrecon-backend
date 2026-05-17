/**
 * Sprint 2 PR#16b — Lane A / Lane B Evidence Review preview observer
 * — pure projection.
 *
 * `buildLaneABPreview` takes an `EvidenceReviewSnapshotReport` (the
 * PR#15a observer output) and emits a structured `LaneABPreviewReport`
 * that obeys the PR#16a Lane A / Lane B contract.
 *
 * This module performs NO database queries. It is a pure function:
 * same input → same output. No clock, no random, no I/O. The CLI
 * (scripts/lane-ab-preview-report.ts) is the only seam that opens
 * a DB connection, runs the PR#15a snapshot, and pipes the result
 * into this builder.
 *
 * Hard boundary:
 *   - No DB writes.
 *   - No durable Lane-A / Lane-B writer.
 *   - No automated customer-facing scoring.
 *   - No AMS Product Layer execution.
 *   - "Track A" appears ONLY inside the dedicated readiness note
 *     and forbidden-boundary text; never as a Lane-A or Lane-B
 *     observation family or evidence source.
 */

import type { EvidenceReviewSnapshotReport } from '../evidence-review-snapshot/index.js';
import {
  LANE_AB_PREVIEW_VERSION,
  type CustomerWordingRails,
  type InternalOnlyRails,
  type LaneABPreviewBoundary,
  type LaneABPreviewReport,
  type LaneAObservation,
  type LaneAPreview,
  type LaneBObservation,
  type LaneBPreview,
  type SourceAvailabilityRow,
  type SourceAvailabilitySummary,
  type TrackAReadinessNote,
} from './types.js';

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export function buildLaneABPreview(
  snapshot: EvidenceReviewSnapshotReport,
): LaneABPreviewReport {
  const boundary: LaneABPreviewBoundary = {
    preview_version:      LANE_AB_PREVIEW_VERSION,
    snapshot_version:     snapshot.boundary.observer_version,
    workspace_id:         snapshot.boundary.workspace_id,
    site_id:              snapshot.boundary.site_id,
    window_start_iso:     snapshot.boundary.window_start_iso,
    window_end_iso:       snapshot.boundary.window_end_iso,
    checked_at_iso:       snapshot.boundary.checked_at_iso,
    database_host_masked: snapshot.boundary.database_host_masked,
    database_name_masked: snapshot.boundary.database_name_masked,
  };

  return {
    boundary,
    source_availability:    buildSourceAvailability(snapshot),
    lane_a:                 buildLaneA(snapshot),
    lane_b:                 buildLaneB(snapshot),
    customer_wording_rails: buildCustomerWordingRails(),
    internal_only_rails:    buildInternalOnlyRails(),
    track_a_readiness:      buildTrackAReadiness(),
  };
}

/* --------------------------------------------------------------------------
 * Source availability — flatten the snapshot's per-table availability
 * into a preview-shaped list.
 * ------------------------------------------------------------------------ */

function buildSourceAvailability(
  snapshot: EvidenceReviewSnapshotReport,
): SourceAvailabilitySummary {
  const rows: SourceAvailabilityRow[] = snapshot.source_availability.tables.map((t) => ({
    evidence_source: t.table_name,
    exists:          t.exists,
    rows_in_window:  t.row_count,
    note:            t.note ?? '',
  }));
  return { rows: Object.freeze(rows) };
}

/* --------------------------------------------------------------------------
 * Lane A — customer-safer candidate observations.
 *
 * Maps each Lane-A-candidate count from the snapshot into a Lane A
 * observation. Counts that come back null are surfaced as a
 * "cannot verify yet" observation rather than crashing.
 * ------------------------------------------------------------------------ */

function buildLaneA(snapshot: EvidenceReviewSnapshotReport): LaneAPreview {
  const obs: LaneAObservation[] = [];

  obs.push(buildLaneAObservation({
    family:           'rejected_event',
    evidence_source:  'rejected_events',
    aggregate_count:  snapshot.lane_a_candidates.rejected_event_count,
    missing_reason:   'rejected_events table missing or count query failed; cannot characterise the invalid-traffic candidate volume.',
  }));

  obs.push(buildLaneAObservation({
    family:           'stage0_excluded',
    evidence_source:  'stage0_decisions',
    aggregate_count:  snapshot.lane_a_candidates.stage0_excluded_count,
    missing_reason:   'stage0_decisions table missing, empty, or count failed; cannot characterise Stage-0 exclusion volume.',
  }));

  obs.push(buildLaneAObservation({
    family:           'risk_corroboration',
    evidence_source:  'risk_observations_v0_1',
    aggregate_count:  snapshot.lane_a_candidates.risk_observation_rows_with_evidence,
    missing_reason:   'risk_observations_v0_1 missing or empty; Lane-A candidates have no risk-side corroboration in this window.',
  }));

  for (const gap of snapshot.lane_a_candidates.evidence_gaps_affecting_traffic_quality) {
    obs.push({
      family:                   'evidence_chain_gap',
      evidence_source:          'evidence_chain',
      aggregate_count:          null,
      cannot_verify_yet_reason: gap,
      manual_review_needed:     true,
    });
  }

  return {
    posture_note:                    snapshot.lane_a_candidates.bot_like_or_ambiguous_evidence_count_note,
    observations:                    Object.freeze(obs),
    evidence_gaps_affecting_lane_a:  buildLaneAGaps(snapshot),
  };
}

interface LaneABuildOpts {
  readonly family:           LaneAObservation['family'];
  readonly evidence_source:  string;
  readonly aggregate_count:  number | null;
  readonly missing_reason:   string;
}

function buildLaneAObservation(opts: LaneABuildOpts): LaneAObservation {
  if (opts.aggregate_count === null) {
    return {
      family:                   opts.family,
      evidence_source:          opts.evidence_source,
      aggregate_count:          null,
      cannot_verify_yet_reason: opts.missing_reason,
      manual_review_needed:     true,
    };
  }
  if (opts.aggregate_count === 0) {
    return {
      family:                   opts.family,
      evidence_source:          opts.evidence_source,
      aggregate_count:          0,
      cannot_verify_yet_reason: 'zero rows in window; treat as no evidence rather than a negative finding.',
      manual_review_needed:     false,
    };
  }
  return {
    family:                   opts.family,
    evidence_source:          opts.evidence_source,
    aggregate_count:          opts.aggregate_count,
    cannot_verify_yet_reason: null,
    manual_review_needed:     true,
  };
}

function buildLaneAGaps(snapshot: EvidenceReviewSnapshotReport): readonly string[] {
  const gaps: string[] = [];
  for (const g of snapshot.lane_a_candidates.evidence_gaps_affecting_traffic_quality) {
    gaps.push(g);
  }
  if (snapshot.evidence_gaps.missing_accepted_events_coverage) {
    gaps.push('accepted_events empty in window — Lane-A volume baseline missing.');
  }
  if (snapshot.evidence_gaps.missing_risk_observations) {
    gaps.push('risk_observations_v0_1 empty in window — no risk-side corroboration for Lane-A candidates.');
  }
  if (snapshot.evidence_gaps.insufficient_window) {
    gaps.push('observation window too short for stable Lane-A patterns.');
  }
  return Object.freeze(gaps);
}

/* --------------------------------------------------------------------------
 * Lane B — internal-only observations.
 * ------------------------------------------------------------------------ */

function buildLaneB(snapshot: EvidenceReviewSnapshotReport): LaneBPreview {
  const obs: LaneBObservation[] = [];

  obs.push(buildLaneBObservation({
    family:           'buyer_motion_hypothesis',
    evidence_source:  'poi_observations_v0_1',
    aggregate_count:  snapshot.lane_b_internal.poi_observation_rows,
    missing_bucket:   'poi_observations_v0_1 missing or empty; buyer-motion shapes cannot be hypothesised for this window.',
    prompt:           'Internal only: which buyer-motion shapes (if any) correspond to real buying interest vs. evaluator browsing?',
  }));

  obs.push(buildLaneBObservation({
    family:           'buyer_motion_hypothesis',
    evidence_source:  'poi_sequence_observations_v0_1',
    aggregate_count:  snapshot.lane_b_internal.poi_sequence_observation_rows,
    missing_bucket:   'poi_sequence_observations_v0_1 missing or empty; ordered POI sequences unavailable.',
    prompt:           'Internal only: do any ordered POI sequences suggest a recognisable buying motion vs. noise?',
  }));

  obs.push(buildLaneBObservation({
    family:           'product_context_hypothesis',
    evidence_source:  'session_features',
    aggregate_count:  snapshot.lane_b_internal.session_features_coverage_rows,
    missing_bucket:   'session_features empty; product-context hypotheses cannot be drawn from per-session shape.',
    prompt:           'Internal only: which session-feature shapes suggest evaluation of a specific product surface vs. generic browsing?',
  }));

  obs.push(buildLaneBObservation({
    family:           'timing_window_hypothesis',
    evidence_source:  'session_behavioural_features_v0_2',
    aggregate_count:  snapshot.lane_b_internal.session_behavioural_features_coverage_rows,
    missing_bucket:   'session_behavioural_features_v0_2 empty; burst / dwell / pacing signals unavailable.',
    prompt:           'Internal only: do behavioural pacing signals suggest a timing window for this customer’s buyer motion?',
  }));

  obs.push(buildLaneBObservation({
    family:           'evidence_pipeline_coverage',
    evidence_source:  'stage0_decisions',
    aggregate_count:  snapshot.lane_b_internal.stage0_eligible_count,
    missing_bucket:   'stage0_decisions absent or empty; cannot describe eligible-vs-excluded split as pipeline coverage.',
    prompt:           'Internal only: does Stage-0 eligible / excluded split match what the customer expects from their traffic mix?',
  }));

  return {
    posture_note:                    snapshot.lane_b_internal.ambiguous_or_insufficient_buckets_note,
    observations:                    Object.freeze(obs),
    evidence_gaps_affecting_lane_b:  buildLaneBGaps(snapshot),
  };
}

interface LaneBBuildOpts {
  readonly family:           LaneBObservation['family'];
  readonly evidence_source:  string;
  readonly aggregate_count:  number | null;
  readonly missing_bucket:   string;
  readonly prompt:           string;
}

function buildLaneBObservation(opts: LaneBBuildOpts): LaneBObservation {
  if (opts.aggregate_count === null || opts.aggregate_count === 0) {
    return {
      family:                       opts.family,
      evidence_source:              opts.evidence_source,
      aggregate_count:              opts.aggregate_count,
      missing_evidence_bucket:      opts.missing_bucket,
      private_founder_note_prompt:  opts.prompt,
    };
  }
  return {
    family:                       opts.family,
    evidence_source:              opts.evidence_source,
    aggregate_count:              opts.aggregate_count,
    missing_evidence_bucket:      null,
    private_founder_note_prompt:  opts.prompt,
  };
}

function buildLaneBGaps(snapshot: EvidenceReviewSnapshotReport): readonly string[] {
  const gaps: string[] = [];
  if (snapshot.evidence_gaps.missing_session_features) {
    gaps.push('session_features empty in window — Lane-B product-context hypotheses unavailable.');
  }
  if (snapshot.evidence_gaps.missing_behavioural_features) {
    gaps.push('session_behavioural_features_v0_2 empty in window — Lane-B timing-window hypotheses unavailable.');
  }
  if (snapshot.evidence_gaps.missing_poi_observations) {
    gaps.push('POI observations empty in window — Lane-B buyer-motion hypotheses unavailable.');
  }
  if (snapshot.evidence_gaps.missing_productfeatures_observations) {
    gaps.push('ProductFeatures observer is CLI-only — re-run before drawing Lane-B product-context conclusions.');
  }
  if (snapshot.evidence_gaps.insufficient_window) {
    gaps.push('observation window too short for stable Lane-B patterns.');
  }
  return Object.freeze(gaps);
}

/* --------------------------------------------------------------------------
 * Customer wording rails — carries the PR#16a §8 allowed / forbidden
 * customer-facing wording into the preview so the reader sees the
 * rails alongside the counts.
 * ------------------------------------------------------------------------ */

function buildCustomerWordingRails(): CustomerWordingRails {
  return {
    allowed: Object.freeze([
      'we observed evidence consistent with...',
      'this should be reviewed manually',
      'the evidence is insufficient to verify...',
      'this pattern may reduce confidence in the traffic sample',
      'we cannot claim...',
      'the evidence suggests... but the chain has gaps that prevent verification today',
      'N sessions in the window matched a shape commonly associated with X, though that shape is necessary, not sufficient, to claim X',
    ]),
    forbidden: Object.freeze([
      'bot detected',
      'fraud detected',
      'real buyer score',
      'this account should be contacted',
      'we identified the visitor',
      'guaranteed ROI',
      'automated decision',
      'all bots filtered',
      'all bad traffic caught',
    ]),
  };
}

function buildInternalOnlyRails(): InternalOnlyRails {
  return {
    internal_only: Object.freeze([
      'buyer-motion hypotheses derived from POI observations.',
      'product-context hypotheses derived from session features.',
      'timing-window hypotheses derived from behavioural features.',
      'evidence-pipeline coverage notes derived from Stage-0 eligible counts.',
      'founder-note prompts for the private engagement folder.',
    ]),
    forbidden: Object.freeze([
      'customer-facing buyer-intent score',
      'sales-action recommendation without human review',
      'account prioritisation / lead-scoring output',
      'identity claim ("this is X at Y Corp")',
      'AMS scoring result, raw or transformed',
      'forbidden boundary identifiers: ProductDecision and RequestedAction',
    ]),
  };
}

/* --------------------------------------------------------------------------
 * Track A readiness — repeats PR#16a §6 / §11.
 * ------------------------------------------------------------------------ */

function buildTrackAReadiness(): TrackAReadinessNote {
  return {
    track_a_run_in_this_pr: false,
    posture: Object.freeze([
      'Track A has not been run in this PR.',
      'Track A remains separate and RECORD_ONLY.',
      'Future Track A summaries may only be compared against this preview contract.',
      'Track A summaries do NOT flow into backend tables, customer telemetry, or customer report text in this PR.',
    ]),
    forbidden_leakage: Object.freeze([
      'Track A labels MUST NOT appear in live URLs.',
      'Track A labels MUST NOT appear in UTMs / source tagging.',
      'Track A labels MUST NOT appear in window.dataLayer / GTM dataLayer pushes.',
      'Track A labels MUST NOT appear in GA4 event params or custom dimensions.',
      'Track A labels MUST NOT appear in cookies / localStorage / sessionStorage on production domains.',
      'Track A labels MUST NOT appear in backend DB columns or payload JSON.',
      'Track A labels MUST NOT appear in customer report text.',
    ]),
  };
}
