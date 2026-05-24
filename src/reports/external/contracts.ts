export const EXTERNAL_REPORT_SCHEMA_VERSION = '0.1.0';

export type EvidenceGrade = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';

export type InstallationStatus =
  | 'not_installed'
  | 'connected_no_data'
  | 'collecting'
  | 'verified'
  | 'degraded'
  | 'unknown';

export type FirstValueState =
  | 'no_install'
  | 'installed_no_data'
  | 'connected_no_evidence'
  | 'first_session_evidence'
  | 'first_account_evidence'
  | 'limitation_heavy_or_conflicting';

export type EvidenceSourceType =
  | 'thinlayer_event'
  | 'collector_decision'
  | 'scoring_worker_output'
  | 'manual_record';

export interface EvidenceAtom {
  atom_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;
  source_type: EvidenceSourceType;
  source_ref: string;
  observed_at: string;
  recorded_at: string;
  category: string;
  facet: string;
  numeric_value: number | null;
  evidence_grade: EvidenceGrade;
  is_complete: boolean;
  null_fields: string[];
  ingest_reason_codes: string[];
}

export interface SessionEvidenceCard {
  card_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;
  session_ref: string;
  session_started_at: string;
  session_ended_at: string | null;
  session_status: 'open' | 'closed' | 'expired';
  evidence_atom_ids: string[];
  evidence_grade: EvidenceGrade;
  motion_timeline_node_ids: string[];
  claim_block: ClaimBlock;
  installation_status: InstallationStatus;
  has_repeated_navigation: boolean;
  has_focus_loss: boolean;
  conflicting_evidence: boolean;
}

export interface AccountEvidenceCard {
  card_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;
  account_ref: string;
  first_seen_at: string;
  last_seen_at: string;
  session_count: number;
  session_evidence_card_ids: string[];
  evidence_grade: EvidenceGrade;
  motion_timeline_node_ids: string[];
  claim_block: ClaimBlock;
  account_inference_visible: boolean;
  has_cross_site_evidence: boolean;
  has_outcome_link: boolean;
  conflicting_evidence: boolean;
}

export type MotionTimelineNodeKind =
  | 'install_attempt'
  | 'install_verified'
  | 'first_event'
  | 'first_session'
  | 'first_account_observation'
  | 'session_evidence_added'
  | 'account_evidence_added'
  | 'report_generated'
  | 'report_delivered'
  | 'alert_raised';

export interface MotionTimelineNode {
  node_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;
  node_kind: MotionTimelineNodeKind;
  occurred_at: string;
  parent_node_id: string | null;
  evidence_atom_ids: string[];
  session_evidence_card_id: string | null;
  account_evidence_card_id: string | null;
  label_template_id: string;
}

export interface ClaimBlock {
  block_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;
  facts: ClaimFact[];
  inferences: ClaimInference[];
  recommendations: ClaimRecommendation[];
  limitations: ClaimLimitation[];
  evidence_refs: EvidenceAtomRef[];
  claim_template_id: string;
  visibility: ClaimVisibility;
  minimum_evidence_grade: EvidenceGrade;
}

export interface ClaimFact {
  template_id: string;
  evidence_atom_id: string;
  category: string;
}

export interface ClaimInference {
  template_id: string;
  evidence_atom_ids: string[];
  reason_codes: string[];
  evidence_confidence: 'low' | 'medium' | 'high';
  score_version_id: string;
  knob_version_id: string;
}

export interface ClaimRecommendation {
  template_id: string;
  call_to_action:
    | 'review_session'
    | 'check_install'
    | 'review_account'
    | 'open_report'
    | 'open_method_note';
  evidence_atom_ids: string[];
  auto_action_allowed: false;
}

export interface ClaimLimitation {
  template_id: string;
  category:
    | 'evidence_thinness'
    | 'missing_field'
    | 'single_signal'
    | 'conflicting_evidence'
    | 'scope_boundary';
}

export interface EvidenceAtomRef {
  atom_id: string;
  source_type: EvidenceSourceType;
}

export type ClaimVisibility =
  | 'customer_visible'
  | 'internal_only_founder'
  | 'internal_only_ops'
  | 'internal_only_eng';

export interface ReportSnapshot {
  snapshot_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;
  window_start: string;
  window_end: string;
  window_kind: 'first_value' | '24h' | 'ad_hoc';
  system_status: SystemStatusSection;
  first_value_evidence: FirstValueSection;
  session_evidence_cards: SessionEvidenceCard[];
  account_evidence_cards: AccountEvidenceCard[];
  buyer_motion_timeline: MotionTimelineNode[];
  limitations: ClaimLimitation[];
  recommended_next_steps: ClaimRecommendation[];
  method_note: MethodNoteSection;
  flags_snapshot: ExternalOutputFeatureFlags;
  is_no_event_yet: boolean;
}

export interface SystemStatusSection {
  installation_status: InstallationStatus;
  first_value_state: FirstValueState;
  last_event_at: string | null;
  collector_reachability: 'reachable' | 'degraded' | 'unknown';
}

export interface FirstValueSection {
  state: FirstValueState;
  installation_status: InstallationStatus;
  past_30min_activity_count: number;
  first_session_evidence_card_id: string | null;
  boundary_statement_template_id: string;
}

export interface MethodNoteSection {
  method_template_id: string;
  evidence_grade_explanation_template_id: string;
  not_buyer_intent_disclaimer_template_id: string;
}

export interface ReportDeliveryProof {
  proof_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;
  snapshot_id: string;
  delivered_at: string;
  recipient_category: 'primary_admin' | 'secondary_admin' | 'internal_ops' | 'webhook_endpoint';
  delivery_channel: 'email' | 'webhook' | 'download_url' | 'in_app';
  request_id: string;
  rule_version_id: string;
  model_version_id: string | null;
  knob_version_id: string;
  delivery_status: 'queued' | 'sent' | 'failed' | 'withheld_no_event';
  failure_reason_code: string | null;
}

export interface ExternalOutputFeatureFlags {
  show_evidence_grade: boolean;
  show_recommendations: boolean;
  show_account_inference: boolean;
  auto_send_reports: boolean;
}

export const DEFAULT_EXTERNAL_OUTPUT_FLAGS: ExternalOutputFeatureFlags = Object.freeze({
  show_evidence_grade: false,
  show_recommendations: false,
  show_account_inference: false,
  auto_send_reports: false,
});
