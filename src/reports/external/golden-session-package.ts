/**
 * BuyerRecon Golden Session v0.1 — packaging of the authoritative AMS result.
 *
 * Combines (1) the validated authoritative AMS Golden Session JSON (produced by
 * the merged AMS cmd/buyerrecon-report surface at its deterministic JSON mode)
 * with (2) the backend's persisted evidence for one controlled session, into
 * one deterministic machine-readable JSON artifact and one deterministic
 * human-readable Markdown artifact.
 *
 * Authority split (never violated here):
 *   - AMS owns Risk / Series / PoI / Fit / Intent / Window-Timing / TRQ /
 *     Action proposal / Policy Pass 1 / Trust / Policy Pass 2 final decision.
 *     Nothing in this module recalculates, re-scores, or overrides any of it.
 *   - The backend owns event truth, persisted session evidence, EvidenceAtom
 *     construction, SessionEvidenceCard, ReportSnapshot, and packaging.
 *
 * Dual identity truth (recorded explicitly, never conflated):
 *   - backend evidence identity: workspace_id + site_id + session_id + bounds;
 *   - AMS decision identity: browser_subject + bounds, with
 *     session_level_isolation=false. The AMS browser subject is NOT an exact
 *     session identity; the artifact records this limitation.
 *
 * Internal-only for v0.1: no delivery, no external flags, no customer send.
 */

import {
  buildReportSnapshot,
  buildSessionEvidenceCard,
  type SessionEvidenceInput,
} from './builders.js';
import type { EvidenceAtom, ReportSnapshot, SessionEvidenceCard } from './contracts.js';
import { renderReportMarkdown } from './renderer.js';
import { sanitizeCustomerText } from './safe-claims.js';
import {
  mapSessionRowsToEvidenceAtoms,
  summarizeStagePresence,
  type BackendSessionIdentity,
  type SessionPersistedRows,
  type StagePresenceEntry,
} from './session-evidence-atoms.js';

/** Version marker of the merged AMS golden JSON this backend build validates. */
export const AMS_GOLDEN_SCHEMA_VERSION = 'golden-session-ams-v0.1';
/** Version marker of the combined backend package artifact. */
export const GOLDEN_PACKAGE_ARTIFACT_VERSION = 'golden-session-package-v0.1';

export const AMS_GOLDEN_STATUSES = Object.freeze([
  'SCORED',
  'UNSCORABLE',
  'NO_EVENTS_IN_SCOPE',
  'PIPELINE_ERROR',
] as const);
export type AmsGoldenStatus = (typeof AMS_GOLDEN_STATUSES)[number];

/**
 * Narrowest local integration contract for the merged AMS safe JSON output.
 * Top-level and scope fields are snake_case (AMS GoldenSessionResult tags);
 * nested frozen-contract objects use the exact Go field names (PascalCase).
 * Only fields the packaging layer relies on are typed; the full validated
 * object is preserved verbatim as the authoritative decision payload.
 */
export interface AmsGoldenScope {
  site_id: string;
  subject_id: string;
  subject_identity_model: string;
  session_level_isolation: boolean;
  session_id?: string;
  window_start: string;
  window_end: string;
}

export interface AmsRuntimeDecision {
  FinalDecision: string;
  GatingReasonCodes?: string[] | null;
  ActionTier?: string;
  ExitReason?: string;
}

export interface AmsGoldenSessionResult {
  schema_version: string;
  status: AmsGoldenStatus;
  missing_stage?: string;
  limitations: string[];
  scope: AmsGoldenScope;
  authoritative_final_decision: string;
  risk?: { RiskIndex: number; ReasonCodes?: string[] | null } | null;
  series?: Record<string, unknown> | null;
  poi?: { PoiScore: number; IntentClass?: string; Confidence01?: number; ReasonCodes?: string[] | null } | null;
  product_decision?: {
    ProductScore: number;
    RequestedAction: string;
    ReasonCodes?: string[] | null;
    DecisionConfidence01?: number;
  } | null;
  policy_pass_1?: {
    TrustInvocationMode?: string;
    ActionTier?: string;
    GatingReasonCodes?: string[] | null;
    EarlyExit?: boolean;
    ExitReason?: string;
  } | null;
  trust?: {
    TrustBand?: string;
    Decision?: string;
    ConfidenceScore01?: number;
    ReasonCodes?: string[] | null;
  } | null;
  runtime_decision?: AmsRuntimeDecision | null;
  evidence_card?: {
    FitScore?: number;
    FitReasonCodes?: string[] | null;
    IntentScore?: number;
    IntentState?: string;
    IntentReasonCodes?: string[] | null;
    WindowScore?: number;
    WindowState?: string;
    WindowReasonCodes?: string[] | null;
    TRQScore?: number;
    TRQBand?: string;
    RequestedAction?: string;
    ActionReasonCodes?: string[] | null;
  } | null;
  adapter_quality?: Record<string, unknown> | null;
  source_event_ids: number[];
}

const AMS_TOP_LEVEL_KEYS = new Set([
  'schema_version',
  'status',
  'missing_stage',
  'limitations',
  'scope',
  'authoritative_final_decision',
  'risk',
  'series',
  'poi',
  'product_decision',
  'policy_pass_1',
  'trust',
  'runtime_decision',
  'evidence_card',
  'adapter_quality',
  'source_event_ids',
]);

/** Expected AMS decision identity (identity truth #2), pinned by the operator. */
export interface AmsIdentityExpectation {
  site_id: string;
  subject_id: string;
  window_start: string;
  window_end: string;
}

export type AmsValidationFailureStage = 'ams_output_invalid' | 'ams_identity_mismatch';

export type AmsValidationResult =
  | { ok: true; result: AmsGoldenSessionResult }
  | { ok: false; failure_stage: AmsValidationFailureStage; reasons: string[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Array.isArray(value) === false;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * Validate the raw AMS golden JSON text against the narrow local contract.
 * Rejects malformed/multiple JSON values, unsupported versions, unexpected
 * shapes, unexpected identity, mismatched bounds, and contradictory
 * final-decision data. Never substitutes backend-derived values for missing
 * AMS values and never recalculates any decision.
 */
export function validateAmsGoldenSessionJson(
  rawText: string,
  expected: AmsIdentityExpectation,
): AmsValidationResult {
  const invalid = (reasons: string[]): AmsValidationResult =>
    ({ ok: false, failure_stage: 'ams_output_invalid', reasons });
  const mismatch = (reasons: string[]): AmsValidationResult =>
    ({ ok: false, failure_stage: 'ams_identity_mismatch', reasons });

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return invalid(['malformed_json_or_multiple_json_values']);
  }
  if (isPlainObject(parsed) === false) return invalid(['top_level_not_object']);

  const shapeReasons: string[] = [];
  for (const key of Object.keys(parsed)) {
    if (AMS_TOP_LEVEL_KEYS.has(key) === false) shapeReasons.push(`unexpected_top_level_key:${key}`);
  }
  if (shapeReasons.length > 0) return invalid(shapeReasons);

  if (parsed.schema_version !== AMS_GOLDEN_SCHEMA_VERSION) {
    return invalid(['unsupported_schema_version']);
  }
  const status = parsed.status;
  if (typeof status !== 'string' || (AMS_GOLDEN_STATUSES as readonly string[]).includes(status) === false) {
    return invalid(['unknown_status']);
  }
  if (isStringArray(parsed.limitations) === false) return invalid(['limitations_not_string_array']);
  if (Array.isArray(parsed.source_event_ids) === false ||
      (parsed.source_event_ids as unknown[]).every((v) => typeof v === 'number') === false) {
    return invalid(['source_event_ids_not_number_array']);
  }

  const scope = parsed.scope;
  if (isPlainObject(scope) === false) return invalid(['scope_missing']);
  if (typeof scope.site_id !== 'string' || typeof scope.subject_id !== 'string' ||
      typeof scope.window_start !== 'string' || typeof scope.window_end !== 'string') {
    return invalid(['scope_fields_invalid']);
  }
  if (scope.subject_identity_model !== 'browser_subject') {
    return invalid(['unexpected_subject_identity_model']);
  }
  if (scope.session_level_isolation !== false) {
    return invalid(['session_level_isolation_must_be_false']);
  }

  const identityReasons: string[] = [];
  if (scope.site_id !== expected.site_id) identityReasons.push('site_mismatch');
  if (scope.subject_id !== expected.subject_id) identityReasons.push('subject_mismatch');
  if (scope.window_start !== expected.window_start) identityReasons.push('window_start_mismatch');
  if (scope.window_end !== expected.window_end) identityReasons.push('window_end_mismatch');
  if (identityReasons.length > 0) return mismatch(identityReasons);

  if (typeof parsed.authoritative_final_decision !== 'string') {
    return invalid(['authoritative_final_decision_missing']);
  }

  if (status === 'SCORED') {
    const scoredReasons: string[] = [];
    const runtime = parsed.runtime_decision;
    if (isPlainObject(runtime) === false || typeof runtime.FinalDecision !== 'string' ||
        runtime.FinalDecision === '') {
      scoredReasons.push('runtime_decision_missing');
    } else if (parsed.authoritative_final_decision !== runtime.FinalDecision) {
      scoredReasons.push('contradictory_final_decision');
    }
    for (const [key, label] of [
      ['risk', 'risk_missing'],
      ['poi', 'poi_missing'],
      ['product_decision', 'product_decision_missing'],
      ['policy_pass_1', 'policy_pass_1_missing'],
    ] as const) {
      if (isPlainObject(parsed[key]) === false) scoredReasons.push(label);
    }
    if (scoredReasons.length > 0) return invalid(scoredReasons);
  }

  return { ok: true, result: parsed as unknown as AmsGoldenSessionResult };
}

/** Buyer-motion presentation value derived categorically from the AMS result. */
export type BuyerMotionPresentation = 'present' | 'absent' | 'uncertain';

/**
 * Categorical presentation of the authoritative AMS result — NOT a new score.
 * Unscored / degraded results are 'uncertain'; a scored result whose product
 * proposal is NO_ACTION presents as 'absent'; any other scored proposal
 * presents as 'present'. Absence of evidence is never presented as presence.
 */
export function deriveBuyerMotionPresentation(ams: AmsGoldenSessionResult): BuyerMotionPresentation {
  if (ams.status !== 'SCORED') return 'uncertain';
  if (ams.limitations.some((l) => l.startsWith('degraded:'))) return 'uncertain';
  const proposal = ams.product_decision?.RequestedAction ?? '';
  if (proposal === '') return 'uncertain';
  return proposal === 'NO_ACTION' ? 'absent' : 'present';
}

const OPERATOR_ACTION_BY_FINAL_DECISION: Readonly<Record<string, string>> = Object.freeze({
  ALLOW: 'no_operator_action_required',
  ALLOW_WITH_FRICTION: 'review_session_evidence_and_friction_outcome',
  HOLD: 'review_session_evidence',
  REVIEW: 'review_session_evidence',
  DENY: 'review_session_evidence_before_any_follow_up',
  NO_ACTION: 'no_operator_action_required',
});

/** Fixed safe operator-action label for the authoritative final decision. */
export function deriveRecommendedOperatorAction(ams: AmsGoldenSessionResult): string {
  if (ams.status !== 'SCORED') return 'review_missing_stage_before_interpretation';
  return OPERATOR_ACTION_BY_FINAL_DECISION[ams.authoritative_final_decision] ?? 'review_session_evidence';
}

export const GOLDEN_IDENTITY_LIMITATION =
  'ams_browser_subject_is_not_an_exact_session_identity: the AMS decision is scoped to a browser ' +
  'subject within the pinned bounds (session_level_isolation=false); the backend evidence is scoped ' +
  'to one exact backend session. The two identities are recorded separately and were correlated ' +
  'manually by the operator for Golden Session v0.1.';

/** The combined machine-readable Golden Session package artifact. */
export interface GoldenSessionPackage {
  golden_session_artifact_version: string;
  internal_only: true;
  backend_session_identity: {
    workspace_id: string;
    project_id: string;
    site_id: string;
    session_id: string;
    window_start: string;
    window_end: string;
  };
  ams_browser_subject_identity: {
    subject_id: string;
    subject_identity_model: 'browser_subject';
    session_level_isolation: false;
    window_start: string;
    window_end: string;
  };
  session_level_isolation: false;
  identity_limitation: string;
  buyer_motion: BuyerMotionPresentation;
  recommended_operator_action: string;
  ams_authoritative: AmsGoldenSessionResult;
  stage_presence: StagePresenceEntry[];
  limitations: string[];
  evidence_atoms: EvidenceAtom[];
  evidence_references: Array<{ atom_id: string; source_ref: string }>;
  /**
   * Built by the existing builder when at least one evidence atom exists.
   * The existing safe-claims contract requires >=1 evidence reference per
   * claim block, so a session with zero persisted evidence is represented
   * typed-and-safe as null (with the stage limitations above), never as a
   * fabricated card.
   */
  session_evidence_card: SessionEvidenceCard | null;
  report_snapshot: ReportSnapshot;
}

export interface GoldenSessionPackageInput {
  backend_identity: BackendSessionIdentity;
  ams: AmsGoldenSessionResult;
  rows: SessionPersistedRows;
}

/**
 * Compose the Golden Session package from the validated AMS result and the
 * persisted backend rows, reusing the existing card/snapshot builders. Fully
 * deterministic for identical input: no wall clock, no randomness.
 */
export function buildGoldenSessionPackage(input: GoldenSessionPackageInput): GoldenSessionPackage {
  const { backend_identity: identity, ams, rows } = input;

  const atoms = mapSessionRowsToEvidenceAtoms(identity, rows);
  const stagePresence = summarizeStagePresence(rows);

  const sessionStartedAt =
    rows.session_features?.first_seen_at ??
    rows.accepted_events_aggregate?.first_received_at ??
    identity.window_start;
  const sessionEndedAt =
    rows.session_features?.last_seen_at ??
    rows.accepted_events_aggregate?.last_received_at ??
    null;

  const sessionInput: SessionEvidenceInput = {
    session_ref: identity.session_id,
    atoms,
    session_started_at: sessionStartedAt,
    session_ended_at: sessionEndedAt,
    session_status: 'closed',
  };
  // The safe-claims contract requires >=1 evidence ref per claim block; a
  // zero-evidence session is represented as null card + empty snapshot session
  // list (typed safe missing handling), never as a fabricated card.
  const card = atoms.length > 0 ? buildSessionEvidenceCard(sessionInput) : null;

  const acceptedCount = rows.accepted_events_aggregate?.source_event_count ?? 0;
  const snapshot = buildReportSnapshot({
    snapshot_id: `golden_session_${identity.site_id}_${identity.session_id}`,
    workspace_id: identity.workspace_id,
    project_id: identity.project_id,
    site_id: identity.site_id,
    generated_at: identity.window_end,
    window_start: identity.window_start,
    window_end: identity.window_end,
    window_kind: 'ad_hoc',
    collector_reachability: acceptedCount > 0 ? 'reachable' : 'unknown',
    ingest_request_count: acceptedCount,
    accepted_event_count: acceptedCount,
    sessions: atoms.length > 0 ? [sessionInput] : [],
  });

  const limitations = [
    GOLDEN_IDENTITY_LIMITATION,
    ...stagePresence.filter((s) => s.missing_label !== null).map((s) => s.missing_label as string),
    ...ams.limitations.map((l) => `ams:${l}`),
  ];

  return {
    golden_session_artifact_version: GOLDEN_PACKAGE_ARTIFACT_VERSION,
    internal_only: true,
    backend_session_identity: {
      workspace_id: identity.workspace_id,
      project_id: identity.project_id,
      site_id: identity.site_id,
      session_id: identity.session_id,
      window_start: identity.window_start,
      window_end: identity.window_end,
    },
    ams_browser_subject_identity: {
      subject_id: ams.scope.subject_id,
      subject_identity_model: 'browser_subject',
      session_level_isolation: false,
      window_start: ams.scope.window_start,
      window_end: ams.scope.window_end,
    },
    session_level_isolation: false,
    identity_limitation: GOLDEN_IDENTITY_LIMITATION,
    buyer_motion: deriveBuyerMotionPresentation(ams),
    recommended_operator_action: deriveRecommendedOperatorAction(ams),
    ams_authoritative: ams,
    stage_presence: stagePresence,
    limitations,
    evidence_atoms: atoms,
    evidence_references: atoms.map((a) => ({ atom_id: a.atom_id, source_ref: a.source_ref })),
    session_evidence_card: card,
    report_snapshot: snapshot,
  };
}

/** Deterministic machine-readable serialization (fixed key insertion order). */
export function serializeGoldenSessionPackage(pkg: GoldenSessionPackage): string {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function codes(values: string[] | null | undefined): string {
  if (values === null || values === undefined || values.length === 0) return 'none';
  return values.join(', ');
}

function num(value: number | undefined): string {
  return value === undefined ? 'not_reported' : String(value);
}

/**
 * Deterministic human-readable Markdown: one internal-operator section for the
 * authoritative AMS result, followed by the existing (unchanged) report
 * renderer output for the backend evidence snapshot.
 */
export function renderGoldenSessionMarkdown(pkg: GoldenSessionPackage): string {
  const ams = pkg.ams_authoritative;
  const card = ams.evidence_card ?? null;
  const out: string[] = [];

  out.push('# BuyerRecon Golden Session v0.1 (internal only)');
  out.push('');
  out.push('Internal Golden Session artifact. Not customer delivery. Observed evidence and');
  out.push('authoritative policy decisions only — this is not a purchase-intent confirmation.');
  out.push('');
  out.push('## Identity scope');
  out.push('');
  out.push(`- Backend evidence identity — workspace ${pkg.backend_session_identity.workspace_id}, site ${pkg.backend_session_identity.site_id}, one exact backend session (reference ${pkg.backend_session_identity.session_id}).`);
  out.push(`- Pinned bounds: ${pkg.backend_session_identity.window_start} to ${pkg.backend_session_identity.window_end}.`);
  out.push(`- AMS decision identity — browser subject ${pkg.ams_browser_subject_identity.subject_id} (subject_identity_model=browser_subject).`);
  out.push('- session_level_isolation=false: the AMS browser subject is not an exact session identity; the operator correlated the two identities manually for this run.');
  out.push('');
  out.push('## Authoritative AMS result');
  out.push('');
  out.push(`- Status: ${ams.status}${ams.missing_stage !== undefined && ams.missing_stage !== '' ? ` (missing stage: ${ams.missing_stage})` : ''}`);
  out.push(`- Buyer motion: ${pkg.buyer_motion} (categorical presentation of the authoritative AMS result; not a new score)`);
  out.push(`- Fit: score ${num(card?.FitScore)}; reason codes: ${codes(card?.FitReasonCodes)}`);
  out.push(`- Intent: score ${num(card?.IntentScore)}; state ${card?.IntentState ?? 'not_reported'}; reason codes: ${codes(card?.IntentReasonCodes)}`);
  out.push(`- Window / Timing: score ${num(card?.WindowScore)}; state ${card?.WindowState ?? 'not_reported'}; reason codes: ${codes(card?.WindowReasonCodes)}`);
  out.push(`- TRQ: score ${num(card?.TRQScore)}; band ${card?.TRQBand ?? 'not_reported'}`);
  out.push(`- Risk: index ${num(ams.risk?.RiskIndex)}; reason codes: ${codes(ams.risk?.ReasonCodes)}`);
  out.push(`- PoI: score ${num(ams.poi?.PoiScore)}; intent class ${ams.poi?.IntentClass ?? 'not_reported'}; reason codes: ${codes(ams.poi?.ReasonCodes)}`);
  out.push(`- Action proposal (product layer): ${ams.product_decision?.RequestedAction ?? 'not_reported'}; reason codes: ${codes(ams.product_decision?.ReasonCodes)}`);
  out.push(`- Policy Pass 1: trust invocation ${ams.policy_pass_1?.TrustInvocationMode ?? 'not_reported'}; action tier ${ams.policy_pass_1?.ActionTier ?? 'not_reported'}; gating reason codes: ${codes(ams.policy_pass_1?.GatingReasonCodes)}`);
  out.push(`- Trust / confidence: band ${ams.trust?.TrustBand ?? 'not_invoked'}; decision ${ams.trust?.Decision ?? 'not_invoked'}; confidence ${ams.trust?.ConfidenceScore01 !== undefined ? String(ams.trust.ConfidenceScore01) : 'not_reported'}; reason codes: ${codes(ams.trust?.ReasonCodes)}`);
  out.push(`- Policy Pass 2 final decision (authoritative): ${ams.authoritative_final_decision}; gating reason codes: ${codes(ams.runtime_decision?.GatingReasonCodes)}`);
  out.push(`- Recommended operator action: ${pkg.recommended_operator_action}`);
  out.push('');
  out.push('## Limitations');
  out.push('');
  for (const limitation of pkg.limitations) out.push(`- ${limitation}`);
  out.push('');
  out.push('## Stage presence (backend persisted evidence)');
  out.push('');
  for (const stage of pkg.stage_presence) {
    out.push(`- ${stage.stage}: ${stage.present ? 'present' : `missing (${stage.missing_label})`}`);
  }
  out.push('');
  out.push('## Traceable evidence references');
  out.push('');
  if (pkg.evidence_references.length === 0) {
    out.push('- No persisted backend evidence rows were found for this session in the pinned bounds.');
  }
  for (const ref of pkg.evidence_references) out.push(`- ${ref.atom_id} -> ${ref.source_ref}`);
  out.push('');
  out.push('---');
  out.push('');

  const header = out.map((line) => sanitizeCustomerText(line)).join('\n');
  return `${header}\n${renderReportMarkdown(pkg.report_snapshot)}\n`;
}
