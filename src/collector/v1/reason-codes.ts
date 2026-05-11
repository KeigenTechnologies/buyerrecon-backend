/**
 * Sprint 1 PR#5a — canonical §2.8 reject-reason enum + §2.6 rejected-stage enum.
 *
 * Track B (BuyerRecon Evidence Foundation). NOT Track A scoring.
 *
 * Source of truth: handoff §2.8 (canonical reason-code enum) + §2.6 (rejected_stage).
 * The list is grouped by stage for readability — the runtime `REASON_CODES` tuple
 * is flat and its order is non-semantic.
 *
 * No reason-code → stage mapping in PR#5a (deferred to PR#5b alongside the
 * orchestrator's stage handlers). No behavioural-quality / scoring reason codes.
 */

export const REASON_CODES = [
  // Auth (§2.8)
  'auth_invalid',
  'auth_site_disabled',
  'workspace_site_mismatch',
  // Envelope (§2.8 + §2.9 R-1, R-6)
  'content_type_invalid',
  'request_body_invalid_json',
  'request_too_large',
  'batch_too_large',
  'batch_item_count_exceeded',
  // Schema (§2.9 R-2)
  'schema_unknown',
  'schema_version_unsupported',
  'schema_version_malformed',
  // Identity / event (§2.9 R-9, R-10)
  'event_name_invalid',
  'event_type_invalid',
  'event_origin_invalid',
  // Time (§2.9 R-5)
  'occurred_at_missing',
  'occurred_at_invalid',
  'occurred_at_too_old',
  'occurred_at_too_future',
  // Session (§2.9 R-3)
  'session_id_missing',
  'session_id_invalid',
  // Client event id (§2.4 + §2.9 R-9)
  'client_event_id_missing',
  'client_event_id_invalid',
  // Field-level (§2.9 R-2, R-4)
  'missing_required_field',
  'property_type_mismatch',
  'property_not_allowed',
  'context_not_allowed',
  // PII (§2.10)
  'pii_email_detected',
  'pii_phone_detected',
  'pii_government_id_detected',
  'pii_payment_detected',
  'pii_credential_detected',
  // Consent (§2.9 R-11)
  'consent_denied',
  'consent_required_but_missing',
  // Debug (§2.9 R-12)
  'debug_only_not_allowed',
  // Dedupe (§2.4 + §2.9 R-7)
  'duplicate_client_event_id',
  // Internal
  'internal_validation_error',
] as const;

export type ReasonCode = typeof REASON_CODES[number];

export const REJECTED_STAGES = [
  'auth',
  'envelope',
  'validation',
  'pii',
  'boundary',
  'dedupe',
  'storage',
] as const;

export type RejectedStage = typeof REJECTED_STAGES[number];
