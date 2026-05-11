/**
 * Sprint 1 PR#5b-1 — reason-code → stage map (Track B).
 *
 * Pure data + one O(1) lookup. No I/O, no env reads, no validation logic.
 *
 * Maps every §2.8 ReasonCode to the §2.6 RejectedStage where it surfaces.
 * The `Record<ReasonCode, RejectedStage>` type guarantees every reason code
 * has a mapping at compile time.
 */

import type { ReasonCode, RejectedStage } from './reason-codes.js';

/** Exhaustive map. Compile error if any §2.8 ReasonCode is omitted. */
export const REASON_CODE_TO_STAGE: Record<ReasonCode, RejectedStage> = {
  // Auth (§2.8 → §2.6 'auth')
  auth_invalid: 'auth',
  auth_site_disabled: 'auth',
  // Boundary — workspace_site_mismatch surfaces at the boundary stage where
  // payload values are compared to the auth-derived (workspace_id, site_id).
  workspace_site_mismatch: 'boundary',
  // Envelope (§2.9 R-1 / R-6)
  content_type_invalid: 'envelope',
  request_body_invalid_json: 'envelope',
  request_too_large: 'envelope',
  batch_too_large: 'envelope',
  batch_item_count_exceeded: 'envelope',
  // Validation (schema / event / time / session / client_event_id / field-level / consent / debug)
  schema_unknown: 'validation',
  schema_version_unsupported: 'validation',
  schema_version_malformed: 'validation',
  event_name_invalid: 'validation',
  event_type_invalid: 'validation',
  event_origin_invalid: 'validation',
  occurred_at_missing: 'validation',
  occurred_at_invalid: 'validation',
  occurred_at_too_old: 'validation',
  occurred_at_too_future: 'validation',
  session_id_missing: 'validation',
  session_id_invalid: 'validation',
  client_event_id_missing: 'validation',
  client_event_id_invalid: 'validation',
  missing_required_field: 'validation',
  property_type_mismatch: 'validation',
  property_not_allowed: 'validation',
  context_not_allowed: 'validation',
  consent_denied: 'validation',
  consent_required_but_missing: 'validation',
  debug_only_not_allowed: 'validation',
  // PII
  pii_email_detected: 'pii',
  pii_phone_detected: 'pii',
  pii_government_id_detected: 'pii',
  pii_payment_detected: 'pii',
  pii_credential_detected: 'pii',
  // Dedupe
  duplicate_client_event_id: 'dedupe',
  // Internal
  internal_validation_error: 'storage',
};

/** O(1) helper. Equivalent to REASON_CODE_TO_STAGE[code] but with a stable function shape for callers. */
export function stageForReasonCode(code: ReasonCode): RejectedStage {
  return REASON_CODE_TO_STAGE[code];
}
