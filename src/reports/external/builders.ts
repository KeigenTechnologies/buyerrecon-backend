import {
  CLAIM_INFERENCE_CONFIDENCE_FIELD,
  DEFAULT_EXTERNAL_OUTPUT_FLAGS,
  EXTERNAL_REPORT_SCHEMA_VERSION,
  type AccountEvidenceCard,
  type ClaimBlock,
  type ClaimFact,
  type ClaimInference,
  type ClaimLimitation,
  type ClaimRecommendation,
  type EvidenceAtom,
  type EvidenceGrade,
  type ExternalOutputFeatureFlags,
  type FirstValueState,
  type InstallationStatus,
  type MotionTimelineNode,
  type ReportSnapshot,
  type SessionEvidenceCard,
} from './contracts.js';
import { validateClaimBlock } from './safe-claims.js';

export interface SessionEvidenceInput {
  session_ref: string;
  atoms: EvidenceAtom[];
  session_started_at: string;
  session_ended_at: string | null;
  session_status?: 'open' | 'closed' | 'expired';
  has_repeated_navigation?: boolean;
  has_focus_loss?: boolean;
  conflicting_evidence?: boolean;
}

export interface AccountEvidenceInput {
  account_ref: string;
  sessions: SessionEvidenceCard[];
  first_seen_at: string;
  last_seen_at: string;
  has_cross_site_evidence?: boolean;
  has_outcome_link?: boolean;
  conflicting_evidence?: boolean;
}

export interface ExternalReportInput {
  snapshot_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  window_kind: 'first_value' | '24h' | 'ad_hoc';
  collector_reachability: 'reachable' | 'degraded' | 'unknown';
  ingest_request_count: number;
  accepted_event_count: number;
  sessions: SessionEvidenceInput[];
  accounts?: AccountEvidenceInput[];
  flags?: Partial<ExternalOutputFeatureFlags>;
}

export function buildSessionEvidenceCard(input: SessionEvidenceInput): SessionEvidenceCard {
  const first = input.atoms[0] ?? emptyAtom();
  const grade = aggregateEvidenceGrade(input.atoms);
  const claim_block = buildClaimBlock({
    block_id: `claim_session_${input.session_ref}`,
    workspace_id: first.workspace_id,
    project_id: first.project_id,
    site_id: first.site_id,
    atoms: input.atoms,
    grade,
    conflicting: input.conflicting_evidence ?? false,
    scope: 'session',
  });

  return {
    card_id: `session_card_${input.session_ref}`,
    workspace_id: first.workspace_id,
    project_id: first.project_id,
    site_id: first.site_id,
    schema_version: EXTERNAL_REPORT_SCHEMA_VERSION,
    session_ref: input.session_ref,
    session_started_at: input.session_started_at,
    session_ended_at: input.session_ended_at,
    session_status: input.session_status ?? 'closed',
    evidence_atom_ids: input.atoms.map((a) => a.atom_id),
    evidence_grade: grade,
    motion_timeline_node_ids: input.atoms.length > 0 ? [`timeline_${input.session_ref}`] : [],
    claim_block,
    installation_status: input.atoms.length > 0 ? 'verified' : 'collecting',
    has_repeated_navigation: input.has_repeated_navigation ?? false,
    has_focus_loss: input.has_focus_loss ?? false,
    conflicting_evidence: input.conflicting_evidence ?? false,
  };
}

export function buildAccountEvidenceCard(input: AccountEvidenceInput): AccountEvidenceCard {
  const first = input.sessions[0] ?? emptySessionCard();
  const atoms = input.sessions.flatMap((s) => s.claim_block.evidence_refs.map((r) => ({
    atom_id: r.atom_id,
    source_type: r.source_type,
  })));
  const grade = accountEvidenceGrade(input.sessions, input.has_outcome_link ?? false);
  const claim_block = buildClaimBlock({
    block_id: `claim_account_${input.account_ref}`,
    workspace_id: first.workspace_id,
    project_id: first.project_id,
    site_id: first.site_id,
    atoms: atoms.map((a, idx) => ({
      ...emptyAtom(),
      atom_id: a.atom_id,
      workspace_id: first.workspace_id,
      project_id: first.project_id,
      site_id: first.site_id,
      source_type: a.source_type,
      category: 'account_pattern',
      facet: `session_${idx + 1}`,
      evidence_grade: grade,
    })),
    grade,
    conflicting: input.conflicting_evidence ?? false,
    scope: 'account',
  });

  return {
    card_id: `account_card_${input.account_ref}`,
    workspace_id: first.workspace_id,
    project_id: first.project_id,
    site_id: first.site_id,
    schema_version: EXTERNAL_REPORT_SCHEMA_VERSION,
    account_ref: input.account_ref,
    first_seen_at: input.first_seen_at,
    last_seen_at: input.last_seen_at,
    session_count: input.sessions.length,
    session_evidence_card_ids: input.sessions.map((s) => s.card_id),
    evidence_grade: grade,
    motion_timeline_node_ids: [`timeline_${input.account_ref}`],
    claim_block,
    account_inference_visible: false,
    has_cross_site_evidence: input.has_cross_site_evidence ?? false,
    has_outcome_link: input.has_outcome_link ?? false,
    conflicting_evidence: input.conflicting_evidence ?? false,
  };
}

export function buildMotionTimeline(
  workspace_id: string,
  project_id: string,
  site_id: string,
  sessions: SessionEvidenceCard[],
  accounts: AccountEvidenceCard[],
): MotionTimelineNode[] {
  const nodes: MotionTimelineNode[] = [];
  nodes.push(node('timeline_install_verified', workspace_id, project_id, site_id, 'install_verified', null, [], null, null));
  for (const session of sessions) {
    nodes.push(node(
      `timeline_${session.session_ref}`,
      workspace_id,
      project_id,
      site_id,
      'first_session',
      nodes[nodes.length - 1]?.node_id ?? null,
      session.evidence_atom_ids,
      session.card_id,
      null,
      session.session_started_at,
    ));
  }
  for (const account of accounts) {
    nodes.push(node(
      `timeline_${account.account_ref}`,
      workspace_id,
      project_id,
      site_id,
      'first_account_observation',
      nodes[nodes.length - 1]?.node_id ?? null,
      [],
      null,
      account.card_id,
      account.first_seen_at,
    ));
  }
  return nodes.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

export function buildClaimBlocks(cards: Array<SessionEvidenceCard | AccountEvidenceCard>): ClaimBlock[] {
  return cards.map((c) => c.claim_block);
}

export function buildReportSnapshot(input: ExternalReportInput): ReportSnapshot {
  const flags: ExternalOutputFeatureFlags = { ...DEFAULT_EXTERNAL_OUTPUT_FLAGS, ...input.flags };
  const sessionCards = input.sessions.map(buildSessionEvidenceCard);
  const accountInputs = input.accounts ?? [];
  const accountCards = accountInputs.map((a) => buildAccountEvidenceCard({ ...a, sessions: a.sessions.length > 0 ? a.sessions : sessionCards }));
  const installation_status = deriveInstallationStatus(input, sessionCards);
  const first_value_state = deriveFirstValueState(installation_status, sessionCards, accountCards);
  const timeline = buildMotionTimeline(input.workspace_id, input.project_id, input.site_id, sessionCards, accountCards);
  const limitations = [...sessionCards, ...accountCards].flatMap((c) => c.claim_block.limitations);
  const recommendations = [...sessionCards, ...accountCards].flatMap((c) => c.claim_block.recommendations);
  const firstSession = sessionCards[0] ?? null;

  return {
    snapshot_id: input.snapshot_id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    site_id: input.site_id,
    schema_version: EXTERNAL_REPORT_SCHEMA_VERSION,
    window_start: input.window_start,
    window_end: input.window_end,
    window_kind: input.window_kind,
    system_status: {
      installation_status,
      first_value_state,
      last_event_at: latestObservedAt(input.sessions.flatMap((s) => s.atoms)),
      collector_reachability: input.collector_reachability,
    },
    first_value_evidence: {
      state: first_value_state,
      installation_status,
      past_30min_activity_count: input.accepted_event_count,
      first_session_evidence_card_id: firstSession?.card_id ?? null,
      boundary_statement_template_id: 'safe.boundary.not_buyer_intent.v1',
    },
    session_evidence_cards: sessionCards,
    account_evidence_cards: accountCards.map((c) => ({
      ...c,
      account_inference_visible: flags.show_account_inference,
    })),
    buyer_motion_timeline: timeline,
    limitations,
    recommended_next_steps: recommendations,
    method_note: {
      method_template_id: 'safe.method.no_event_yet.v1',
      evidence_grade_explanation_template_id: 'safe.method.evidence_grade.v1',
      not_buyer_intent_disclaimer_template_id: 'safe.boundary.not_buyer_intent.v1',
    },
    flags_snapshot: flags,
    is_no_event_yet: input.accepted_event_count === 0,
  };
}

interface ClaimBlockBuildInput {
  block_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  atoms: EvidenceAtom[];
  grade: EvidenceGrade;
  conflicting: boolean;
  scope: 'session' | 'account';
}

function buildClaimBlock(input: ClaimBlockBuildInput): ClaimBlock {
  const facts: ClaimFact[] = input.atoms.map((atom) => ({
    template_id: 'safe.fact.observed_signal.v1',
    evidence_atom_id: atom.atom_id,
    category: `${atom.category}:${atom.facet}`,
  }));
  const inferences: ClaimInference[] = input.conflicting || gradeRank(input.grade) < gradeRank(input.scope === 'account' ? 'E3' : 'E2')
    ? []
    : [{
      template_id: input.scope === 'account'
        ? 'safe.inference.suggests_return_visit.v1'
        : 'safe.inference.consistent_multi_signal.v1',
      evidence_atom_ids: input.atoms.map((a) => a.atom_id),
      reason_codes: ['evidence_complete_enough_for_review'],
      [CLAIM_INFERENCE_CONFIDENCE_FIELD]: input.scope === 'account' ? 'medium' : 'low',
      score_version_id: 'external-report-mvp-v0',
      knob_version_id: 'external-report-mvp-v0',
    }];
  const recommendations: ClaimRecommendation[] = input.conflicting || gradeRank(input.grade) < gradeRank(input.scope === 'account' ? 'E3' : 'E2')
    ? []
    : [{
      template_id: input.scope === 'account'
        ? 'safe.recommendation.review_account.v1'
        : 'safe.recommendation.review_session.v1',
      call_to_action: input.scope === 'account' ? 'review_account' : 'review_session',
      evidence_atom_ids: input.atoms.map((a) => a.atom_id),
      auto_action_allowed: false,
    }];
  const limitations: ClaimLimitation[] = [];
  if (input.atoms.length === 0) limitations.push({ template_id: 'safe.limitation.not_yet_verified.v1', category: 'missing_field' });
  if (gradeRank(input.grade) < gradeRank('E2')) limitations.push({ template_id: 'safe.limitation.insufficient_evidence.v1', category: 'single_signal' });
  if (input.conflicting) limitations.push({ template_id: 'safe.limitation.conflicting_evidence.v1', category: 'conflicting_evidence' });

  const block: ClaimBlock = {
    block_id: input.block_id,
    workspace_id: input.workspace_id,
    project_id: input.project_id,
    site_id: input.site_id,
    schema_version: EXTERNAL_REPORT_SCHEMA_VERSION,
    facts,
    inferences,
    recommendations,
    limitations,
    evidence_refs: input.atoms.map((a) => ({ atom_id: a.atom_id, source_type: a.source_type })),
    claim_template_id: 'safe.boundary.not_buyer_intent.v1',
    visibility: 'internal_only_eng',
    minimum_evidence_grade: input.scope === 'account' ? 'E2' : 'E1',
  };
  const errors = validateClaimBlock(block);
  if (errors.length > 0) throw new Error(`invalid_claim_block:${errors.join(',')}`);
  return block;
}

function deriveInstallationStatus(input: ExternalReportInput, sessions: SessionEvidenceCard[]): InstallationStatus {
  if (input.collector_reachability === 'unknown') return 'not_installed';
  if (input.ingest_request_count === 0 && input.accepted_event_count === 0) return 'connected_no_data';
  if (input.accepted_event_count === 0) return 'collecting';
  if (sessions.some((s) => s.conflicting_evidence)) return 'degraded';
  return 'verified';
}

function deriveFirstValueState(
  status: InstallationStatus,
  sessions: SessionEvidenceCard[],
  accounts: AccountEvidenceCard[],
): FirstValueState {
  if (status === 'not_installed') return 'no_install';
  if (status === 'connected_no_data') return 'installed_no_data';
  if (status === 'collecting') return 'connected_no_evidence';
  if (sessions.some((s) => s.conflicting_evidence) || accounts.some((a) => a.conflicting_evidence)) {
    return 'limitation_heavy_or_conflicting';
  }
  if (accounts.length > 0) return 'first_account_evidence';
  return 'first_session_evidence';
}

function aggregateEvidenceGrade(atoms: EvidenceAtom[]): EvidenceGrade {
  if (atoms.length === 0) return 'E0';
  const categories = new Set(atoms.map((a) => a.category));
  if (atoms.length === 1) return 'E1';
  if (categories.size >= 3 && atoms.length >= 3) return 'E2';
  return 'E1';
}

function accountEvidenceGrade(sessions: SessionEvidenceCard[], hasOutcomeLink: boolean): EvidenceGrade {
  if (hasOutcomeLink && sessions.length >= 3) return 'E4';
  if (sessions.length >= 3) return 'E3';
  if (sessions.length >= 2) return 'E2';
  return 'E1';
}

function gradeRank(grade: EvidenceGrade): number {
  return ['E0', 'E1', 'E2', 'E3', 'E4'].indexOf(grade);
}

function latestObservedAt(atoms: EvidenceAtom[]): string | null {
  const latest = atoms.map((a) => a.observed_at).sort().at(-1);
  return latest ?? null;
}

function node(
  node_id: string,
  workspace_id: string,
  project_id: string,
  site_id: string,
  node_kind: MotionTimelineNode['node_kind'],
  parent_node_id: string | null,
  evidence_atom_ids: string[],
  session_evidence_card_id: string | null,
  account_evidence_card_id: string | null,
  occurred_at = '2026-05-24T00:00:00Z',
): MotionTimelineNode {
  return {
    node_id,
    workspace_id,
    project_id,
    site_id,
    schema_version: EXTERNAL_REPORT_SCHEMA_VERSION,
    node_kind,
    occurred_at,
    parent_node_id,
    evidence_atom_ids,
    session_evidence_card_id,
    account_evidence_card_id,
    label_template_id: 'safe.fact.observed_signal.v1',
  };
}

function emptyAtom(): EvidenceAtom {
  return {
    atom_id: 'atom_empty',
    workspace_id: 'workspace_fixture',
    project_id: 'project_fixture',
    site_id: 'site_fixture',
    schema_version: EXTERNAL_REPORT_SCHEMA_VERSION,
    source_type: 'manual_record',
    source_ref: 'fixture_empty',
    observed_at: '2026-05-24T00:00:00Z',
    recorded_at: '2026-05-24T00:00:00Z',
    category: 'none',
    facet: 'none',
    numeric_value: null,
    evidence_grade: 'E0',
    is_complete: false,
    null_fields: [],
    ingest_reason_codes: [],
  };
}

function emptySessionCard(): SessionEvidenceCard {
  return buildSessionEvidenceCard({
    session_ref: 'session_display_empty',
    atoms: [],
    session_started_at: '2026-05-24T00:00:00Z',
    session_ended_at: null,
  });
}
