/**
 * Sprint 1 PR#5b-2 — R-11 consent-denied validation (Track B).
 *
 * Pure function. No env reads, no DB, no logging, no network.
 *
 * Decision order (D3 first-reason discipline):
 *   1. tracking_mode === 'buffer_only'                    → consent_required_but_missing
 *   2. consent_state !== 'denied'                          → ok (gate pass-through)
 *   3. event qualifies as consent_state_summary AND
 *      config.allowConsentStateSummary === true:
 *        a. has any forbidden field on event              → consent_denied
 *        b. canonical provided AND has forbidden field    → consent_denied
 *        c. otherwise                                      → ok
 *   4. denied + event_name === 'consent_state_summary'
 *      that did NOT qualify above                          → consent_denied
 *      (the spec admits the summary ONLY in the strict-shape + opt-in form;
 *      a denied event using the summary name without qualifying is rejected)
 *   5. event_type ∈ {page, track, identify, group}        → consent_denied
 *   6. otherwise                                           → ok (downstream gates handle)
 *
 * Per Decision D7, the consent_state_summary exception is strict:
 *   event_origin = system
 *   event_type   = system
 *   event_name   = consent_state_summary
 *   tracking_mode = disabled
 *   storage_mechanism ∈ { none, memory }
 *
 * Per Decision D8, properties: {} and context: {} are allowed; non-empty
 * objects are rejected.
 *
 * Per Decision D9, the optional `canonical` parameter applies the same
 * forbidden-field check to the data-minimised canonical projection (when
 * supplied by the orchestrator in PR#5c after PR#5b-3 lands the projection).
 */

import type { ReasonCode } from './reason-codes.js';

export interface ConsentValidationConfig {
  /** Default false (deny by default). Per-site opt-in; the orchestrator (PR#5c) supplies the resolved per-site flag. */
  allowConsentStateSummary: boolean;
}

export interface ConsentValidationInput {
  event: Record<string, unknown>;
  /** Optional canonical projection (PR#5b-3 lands the projection helper). When supplied, the forbidden-field check applies to BOTH event and canonical. */
  canonical?: Record<string, unknown> | null;
  config: ConsentValidationConfig;
}

export type ConsentValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason_code: Extract<ReasonCode, 'consent_denied' | 'consent_required_but_missing'>;
    };

/* --------------------------------------------------------------------------
 * Constants — Decision D7 / D8
 * ------------------------------------------------------------------------ */

const FORBIDDEN_NAMED_FIELDS: ReadonlySet<string> = new Set([
  'anonymous_id',
  'user_id',
  'company_id',
  'session_id',
  'session_seq',
  'page_url',
  'page_path',
  'page_referrer',
  'page_title',
]);

const BEHAVIOURAL_EVENT_TYPES: ReadonlySet<string> = new Set([
  'page',
  'track',
  'identify',
  'group',
]);

const ALLOWED_SUMMARY_STORAGE: ReadonlySet<string> = new Set(['none', 'memory']);

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null;
}

function isNonEmptyPlainObject(v: unknown): boolean {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.keys(v as Record<string, unknown>).length > 0;
}

/**
 * True iff `event.event_origin/event_type/event_name/tracking_mode/storage_mechanism`
 * match the strict consent_state_summary exception shape (Decision D7).
 */
export function isConsentStateSummary(event: Record<string, unknown>): boolean {
  return (
    event.event_origin === 'system' &&
    event.event_type === 'system' &&
    event.event_name === 'consent_state_summary' &&
    event.tracking_mode === 'disabled' &&
    typeof event.storage_mechanism === 'string' &&
    ALLOWED_SUMMARY_STORAGE.has(event.storage_mechanism)
  );
}

/**
 * True iff `value` carries any of the forbidden denied-consent fields:
 *   - any of the named fields with a present (non-null/non-undefined) value
 *   - non-empty `properties` object (Decision D8)
 *   - non-empty `context` object  (Decision D8)
 *
 * Top-level only — forbidden fields are top-level by spec.
 */
export function hasDeniedConsentForbiddenFields(value: Record<string, unknown>): boolean {
  for (const field of FORBIDDEN_NAMED_FIELDS) {
    if (isPresent(value[field])) return true;
  }
  if (isNonEmptyPlainObject(value.properties)) return true;
  if (isNonEmptyPlainObject(value.context)) return true;
  return false;
}

/* --------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

export function validateConsent(input: ConsentValidationInput): ConsentValidationResult {
  const { event, canonical, config } = input;

  // Step 1 — buffer_only is invalid in Sprint 1 regardless of consent state.
  if (event.tracking_mode === 'buffer_only') {
    return { ok: false, reason_code: 'consent_required_but_missing' };
  }

  // Step 2 — only the denied-consent path is enforced here.
  if (event.consent_state !== 'denied') {
    return { ok: true };
  }

  // Step 3 — consent_state_summary exception (strict shape + per-site opt-in).
  if (config.allowConsentStateSummary && isConsentStateSummary(event)) {
    if (hasDeniedConsentForbiddenFields(event)) {
      return { ok: false, reason_code: 'consent_denied' };
    }
    if (canonical !== undefined && canonical !== null) {
      if (hasDeniedConsentForbiddenFields(canonical)) {
        return { ok: false, reason_code: 'consent_denied' };
      }
    }
    return { ok: true };
  }

  // Step 4 — denied + event_name === 'consent_state_summary' that did NOT
  // qualify for the strict-shape exception above is rejected. The spec admits
  // the summary ONLY in the (config.allowConsentStateSummary === true AND
  // strict 5-field shape AND no forbidden fields) form. Anything else carrying
  // the summary name under denied consent is a deny-by-default rejection.
  if (event.event_name === 'consent_state_summary') {
    return { ok: false, reason_code: 'consent_denied' };
  }

  // Step 5 — denied behavioural events are rejected.
  if (
    typeof event.event_type === 'string' &&
    BEHAVIOURAL_EVENT_TYPES.has(event.event_type)
  ) {
    return { ok: false, reason_code: 'consent_denied' };
  }

  // Step 6 — denied + non-behavioural NOT named consent_state_summary:
  // pass the consent gate. The R-10 origin/type matrix and other gates handle
  // any further rejection.
  return { ok: true };
}
