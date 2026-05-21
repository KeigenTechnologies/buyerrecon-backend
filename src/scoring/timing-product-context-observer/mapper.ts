/**
 * Sprint 2 PR#18c — Timing / Product-Context Observer — pure mapper.
 *
 * Pure module. No DB, no HTTP, no clock reads outside the supplied
 * `evaluation_at`. Every input is plain TypeScript data; every output
 * is categorical / counted / redacted.
 *
 * Responsibilities:
 *   1. Categorical synthetic-fixture exclusion (PR#18b §6).
 *   2. Timing-band classification (PR#18c v0.1 observer thresholds).
 *   3. Confidence cap derivation (PR#18b §7.2 — never 'high').
 *   4. Per-session product-context candidate assembly.
 *   5. Pass-forward shape construction for PR#18d (Pass 1 planning).
 *
 * Privacy / boundary:
 *   - No raw session_id is ever surfaced; only truncated form.
 *   - No request_id UUID is ever surfaced.
 *   - No payload byte / canonical_jsonb projection / raw URL / hostname
 *     query string / Authorization header / DSN / pepper / token / hash
 *     is ever surfaced.
 *   - No customer claim text is emitted.
 */

import {
  TIMING_BAND_THRESHOLDS_HOURS,
  type ConfidenceCap,
  type ConfidenceReason,
  type ExclusionFlag,
  type ProductContextCandidate,
  type ProductContextSessionCandidate,
  type TimingBand,
  type TimingBandDistribution,
} from './types.js';

/* --------------------------------------------------------------------------
 * Synthetic-fixture exclusion contract (PR#18b §6).
 *
 * The staging proof boundary used by PR#17x Gate 2 and PR#17z Gate 3 is
 * (workspace_id, site_id) = ('buyerrecon_staging_ws', 'buyerrecon_com').
 * Any row whose workspace/site pair matches this **staging proof pair**
 * is treated as control / proof evidence, not commercial buyer-motion.
 *
 * The schema_key namespace `buyerrecon.test.%` (e.g. `buyerrecon.test.page_view`,
 * `buyerrecon.test.cta_click`) is reserved for synthetic test fixtures.
 *
 * The site_write_tokens label set captures the Gate-N fixture provisioning
 * labels (extendable as future Gate-N runs add more).
 * ------------------------------------------------------------------------ */

export const SYNTHETIC_FIXTURE_WORKSPACE_ID = 'buyerrecon_staging_ws' as const;
export const SYNTHETIC_FIXTURE_SITE_ID      = 'buyerrecon_com'        as const;

export const SYNTHETIC_FIXTURE_SCHEMA_KEY_PREFIX = 'buyerrecon.test.' as const;

export const SYNTHETIC_FIXTURE_TOKEN_LABELS: readonly string[] = Object.freeze([
  'pr17x_gate2_fixture',
  'pr17z_gate3_fixture',
]);

export interface SyntheticFixtureRowProbe {
  readonly workspace_id?: string | null;
  readonly site_id?:      string | null;
  readonly schema_key?:   string | null;
}

/**
 * Categorical predicate — true if the row matches any synthetic-fixture
 * marker (workspace/site pair OR schema_key namespace). Token-label
 * matching is handled separately at the token table.
 */
export function isSyntheticFixtureRow(row: SyntheticFixtureRowProbe): boolean {
  if (
    typeof row.workspace_id === 'string' &&
    row.workspace_id === SYNTHETIC_FIXTURE_WORKSPACE_ID &&
    typeof row.site_id === 'string' &&
    row.site_id === SYNTHETIC_FIXTURE_SITE_ID
  ) {
    return true;
  }
  if (
    typeof row.schema_key === 'string' &&
    row.schema_key.startsWith(SYNTHETIC_FIXTURE_SCHEMA_KEY_PREFIX)
  ) {
    return true;
  }
  return false;
}

/**
 * Categorical predicate — true if the token label is a known Gate-N
 * fixture label. Used only on `site_write_tokens.label` (never on
 * token_hash, token_id, or any other column).
 */
export function isSyntheticFixtureTokenLabel(label: unknown): boolean {
  if (typeof label !== 'string' || label.length === 0) return false;
  return SYNTHETIC_FIXTURE_TOKEN_LABELS.includes(label);
}

/* --------------------------------------------------------------------------
 * Session-id redaction.
 *
 * Truncated form: prefix(8)…suffix(4). For shorter inputs, returns '***'.
 * NEVER returns the full session_id.
 * ------------------------------------------------------------------------ */

export function truncateSessionId(sessionId: unknown): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  return `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`;
}

/* --------------------------------------------------------------------------
 * Timing-band classification.
 *
 * Takes the most recent server-side evidence timestamp (Date | null) and
 * the evaluation_at clock, returns one of the categorical bands.
 *
 * `null` (no evidence seen for this session in window) → `insufficient_evidence`.
 *
 * v0.1 OBSERVER thresholds only. NOT customer-facing scoring.
 * ------------------------------------------------------------------------ */

export function classifyTimingBand(
  mostRecentEvidenceAt: Date | null,
  evaluationAt: Date,
): TimingBand {
  if (!(mostRecentEvidenceAt instanceof Date) || isNaN(mostRecentEvidenceAt.getTime())) {
    return 'insufficient_evidence';
  }
  if (!(evaluationAt instanceof Date) || isNaN(evaluationAt.getTime())) {
    return 'insufficient_evidence';
  }
  const ageMs    = evaluationAt.getTime() - mostRecentEvidenceAt.getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    // Future-dated evidence is anomalous — treat as insufficient.
    return 'insufficient_evidence';
  }
  const ageHours = ageMs / 3_600_000;
  const T = TIMING_BAND_THRESHOLDS_HOURS;
  if (ageHours <= T.hot_now_max_hours)     return 'hot_now';
  if (ageHours <= T.warm_recent_max_hours) return 'warm_recent';
  if (ageHours <= T.cooling_max_hours)     return 'cooling';
  if (ageHours <= T.stale_max_hours)       return 'stale';
  if (ageHours <= T.dormant_max_hours)     return 'dormant';
  return 'insufficient_evidence';
}

/* --------------------------------------------------------------------------
 * Confidence-cap derivation.
 *
 * Inputs are categorical counts of server-side evidence sources that
 * contributed signal for this session. Client-only flag forces 'low'.
 *
 * Returns one of {'low', 'medium'} — NEVER 'high'. PR#18b §7.2.
 * ------------------------------------------------------------------------ */

export interface ConfidenceInputs {
  readonly server_side_source_count: number;  // count of distinct server-side sources with signal
  readonly client_only_evidence:     boolean;
  readonly synthetic_only_evidence:  boolean;
  readonly missing_optional_sources: boolean;
  readonly threshold_not_locked:     boolean;
}

export function computeConfidenceCap(input: ConfidenceInputs): {
  readonly cap:    ConfidenceCap;
  readonly reason: ConfidenceReason;
} {
  if (input.synthetic_only_evidence) {
    return { cap: 'low', reason: 'synthetic_only_after_exclusion' };
  }
  if (input.threshold_not_locked) {
    return { cap: 'low', reason: 'threshold_not_locked' };
  }
  if (input.client_only_evidence) {
    return { cap: 'low', reason: 'client_only_evidence' };
  }
  if (input.server_side_source_count <= 0) {
    return { cap: 'low', reason: 'no_evidence_in_window' };
  }
  if (input.server_side_source_count === 1) {
    return { cap: 'low', reason: 'single_source_only' };
  }
  if (input.missing_optional_sources) {
    // Multiple server-side sources show signal but at least one optional
    // source the policy would prefer is absent — cap at medium with the
    // missing-optional reason rather than promoting toward an unsupported
    // 'high'. (Observer never emits 'high' anyway.)
    return { cap: 'medium', reason: 'missing_optional_sources' };
  }
  return { cap: 'medium', reason: 'multi_source_server_side' };
}

/* --------------------------------------------------------------------------
 * Per-session row grouping (categorical).
 * ------------------------------------------------------------------------ */

export interface RawAcceptedEventRow {
  readonly request_id?:    string | null;
  readonly workspace_id?:  string | null;
  readonly site_id?:       string | null;
  readonly session_id?:    string | null;
  readonly schema_key?:    string | null;
  readonly schema_version?: string | null;
  readonly event_origin?:  string | null;
  readonly event_type?:    string | null;
  readonly received_at?:   Date | string | null;
}

export interface RawIngestRequestRow {
  readonly request_id?:        string | null;
  readonly workspace_id?:      string | null;
  readonly site_id?:           string | null;
  readonly endpoint?:          string | null;
  readonly http_status?:       number | null;
  readonly auth_status?:       string | null;
  readonly reject_reason_code?: string | null;
  readonly received_at?:       Date | string | null;
  readonly expected_event_count?: number | null;
  readonly accepted_count?:    number | null;
  readonly rejected_count?:    number | null;
}

export interface RawRejectedEventRow {
  readonly request_id?:    string | null;
  readonly workspace_id?:  string | null;
  readonly site_id?:       string | null;
  readonly schema_key?:    string | null;
  readonly schema_version?: string | null;
  readonly event_type?:    string | null;
  readonly rejected_stage?: string | null;
  readonly reason_code?:   string | null;
  readonly received_at?:   Date | string | null;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' && v.length > 0) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return new Date(t);
  }
  return null;
}

/**
 * Group accepted events by session_id, retaining the most-recent
 * `received_at` per session and a count of contributing rows.
 *
 * Synthetic-fixture rows are excluded from the grouping; their counts
 * are returned separately for the synthetic_control_exclusion summary.
 */
export interface AcceptedGroupedSession {
  readonly session_id:               string;
  readonly accepted_event_count:     number;
  readonly most_recent_received_at:  Date | null;
}

export interface AcceptedGroupResult {
  readonly grouped:                       readonly AcceptedGroupedSession[];
  readonly excluded_synthetic_row_count:  number;
}

export function groupAcceptedEventsBySession(rows: readonly RawAcceptedEventRow[]): AcceptedGroupResult {
  const map = new Map<string, { count: number; mostRecent: Date | null }>();
  let excluded = 0;
  for (const r of rows) {
    if (isSyntheticFixtureRow(r)) {
      excluded += 1;
      continue;
    }
    const sid = typeof r.session_id === 'string' && r.session_id.length > 0 ? r.session_id : null;
    if (sid === null) continue;
    const recv = toDate(r.received_at);
    const cur = map.get(sid);
    if (cur === undefined) {
      map.set(sid, { count: 1, mostRecent: recv });
    } else {
      cur.count += 1;
      if (recv !== null && (cur.mostRecent === null || recv.getTime() > cur.mostRecent.getTime())) {
        cur.mostRecent = recv;
      }
    }
  }
  const grouped: AcceptedGroupedSession[] = [];
  for (const [session_id, v] of map.entries()) {
    grouped.push(Object.freeze({
      session_id,
      accepted_event_count:    v.count,
      most_recent_received_at: v.mostRecent,
    }));
  }
  grouped.sort((a, b) => a.session_id.localeCompare(b.session_id));
  return { grouped: Object.freeze(grouped), excluded_synthetic_row_count: excluded };
}

/**
 * Count synthetic-fixture rows in an arbitrary row set (used for
 * ingest_requests / rejected_events exclusion counts).
 */
export function countSyntheticFixtureRows(rows: readonly SyntheticFixtureRowProbe[]): number {
  let n = 0;
  for (const r of rows) {
    if (isSyntheticFixtureRow(r)) n += 1;
  }
  return n;
}

/* --------------------------------------------------------------------------
 * Per-session product-context candidate construction.
 *
 * Inputs are the per-session accepted-event aggregate plus categorical
 * flags about the broader source set availability. Output is one
 * `ProductContextSessionCandidate` per session, fully redacted.
 * ------------------------------------------------------------------------ */

export interface CandidateBuildContext {
  readonly evaluation_at:                 Date;
  readonly server_side_source_count:      number;  // distinct server-side sources with signal globally
  readonly missing_optional_sources:      boolean;
  readonly threshold_not_locked:          boolean;
  readonly lane_b_dark_observed_globally: boolean;
}

export function buildSessionCandidate(
  session: AcceptedGroupedSession,
  ctx: CandidateBuildContext,
): ProductContextSessionCandidate {
  const timingBand = classifyTimingBand(session.most_recent_received_at, ctx.evaluation_at);

  // The observer treats a single session's evidence as "single_source_signal"
  // when only accepted_events shows for it, and "evidence_observed" when
  // the global source-side count is ≥ 2 AND the session has any accepted
  // events. (Cross-session attribution of POI/session_features to a single
  // session_id is a richer correlation that requires PR#18d Pass 1 planning
  // semantics to lock — kept out of v0.1 to avoid invented thresholds.)
  let pcCandidate: ProductContextCandidate;
  if (ctx.threshold_not_locked) {
    pcCandidate = 'threshold_not_locked';
  } else if (session.accepted_event_count === 0) {
    pcCandidate = 'insufficient_evidence';
  } else if (ctx.server_side_source_count >= 2) {
    pcCandidate = 'evidence_observed';
  } else {
    pcCandidate = 'single_source_signal';
  }

  const { cap, reason } = computeConfidenceCap({
    server_side_source_count: ctx.server_side_source_count,
    client_only_evidence:     false,                 // accepted_events is server-side ingest
    synthetic_only_evidence:  false,                 // synthetic rows already excluded upstream
    missing_optional_sources: ctx.missing_optional_sources,
    threshold_not_locked:     ctx.threshold_not_locked,
  });

  const evidenceRefs: string[] = [
    `accepted_events:${session.accepted_event_count}`,
  ];

  const exclusionFlags: ExclusionFlag[] = ['session_id_redacted'];
  if (ctx.missing_optional_sources)      exclusionFlags.push('optional_source_missing');
  if (ctx.lane_b_dark_observed_globally) exclusionFlags.push('lane_b_dark_internal');

  // Pass-forward to PR#18d Pass 1 only when we have an interpretable
  // categorical signal AND a usable timing band. Synthetic rows are
  // excluded upstream of buildSessionCandidate(), so 'synthetic_only_excluded'
  // is impossible here; insufficient-evidence / threshold-not-locked
  // sessions still appear in the output for audit but pass_forward_to_pass1
  // is false.
  const passForward =
    pcCandidate !== 'insufficient_evidence' &&
    pcCandidate !== 'threshold_not_locked' &&
    timingBand !== 'insufficient_evidence';

  return Object.freeze({
    session_id_redacted:        truncateSessionId(session.session_id),
    timing_band_candidate:      timingBand,
    product_context_candidate:  pcCandidate,
    confidence_cap:             cap,
    confidence_reason:          reason,
    evidence_refs:              Object.freeze(evidenceRefs),
    exclusion_flags:            Object.freeze(exclusionFlags),
    pass_forward_to_pass1:      passForward,
  });
}

/* --------------------------------------------------------------------------
 * Timing-band distribution aggregation.
 * ------------------------------------------------------------------------ */

export function buildTimingBandDistribution(
  candidates: readonly ProductContextSessionCandidate[],
): TimingBandDistribution {
  const dist = {
    hot_now:               0,
    warm_recent:           0,
    cooling:               0,
    stale:                 0,
    dormant:               0,
    insufficient_evidence: 0,
  };
  for (const c of candidates) {
    dist[c.timing_band_candidate] += 1;
  }
  return Object.freeze(dist);
}
