/**
 * Sprint 1 PR#5b-2 — regex-only PII detection (Track B).
 *
 * Pure function. No env reads, no DB, no logging, no network, no NLP.
 *
 * Five kinds detected per §2.10:
 *   email | phone | government_id | payment | credential
 *
 * Per Decision D6, firstPiiReasonCode returns the FIRST hit by traversal order
 * (depth-first, keys in insertion order, array indices ascending). Within a
 * single string, multiple kinds are reported in canonical detector order
 * (credential → government_id → payment → email → phone).
 *
 * Per Decision D5, no key-name rejection (PII_KEYS) is performed in PR#5b-2.
 * Detection is regex-only on string values. STRUCTURAL_ID_KEYS exempt the
 * sub-tree under known structural identifier keys from low-confidence
 * email/phone scanning to avoid false positives on application IDs.
 * High-confidence credential / government_id / payment detectors STILL run
 * under structural-exempt sub-trees because their patterns rarely collide
 * with structural ID values.
 *
 * Critical guardrail: PiiHit carries kind + reason_code + path ONLY. The
 * matched string, sample, excerpt, or surrounding text is NEVER included.
 * Tests assert this property explicitly.
 */

import type { ReasonCode } from './reason-codes.js';

export type PiiKind = 'email' | 'phone' | 'government_id' | 'payment' | 'credential';

export interface PiiHit {
  kind: PiiKind;
  reason_code: ReasonCode;
  path: string;
}

const KIND_TO_REASON: Record<PiiKind, ReasonCode> = {
  email: 'pii_email_detected',
  phone: 'pii_phone_detected',
  government_id: 'pii_government_id_detected',
  payment: 'pii_payment_detected',
  credential: 'pii_credential_detected',
};

/* --------------------------------------------------------------------------
 * Regex set
 * ------------------------------------------------------------------------ */

/** Conservative email shape; matches legacy validate.ts for /collect parity. */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Phone shape, lifted from legacy validate.ts (Decision D3). Pairs with a
 * digit-density floor of >= 7 to avoid flagging short codes.
 *
 * Known limitation (documented): a free-text contiguous 7+ digit run may FP.
 * Mitigation: STRUCTURAL_ID_KEYS exempt the most common application-side IDs.
 */
const PHONE_RE = /(?:\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;

/** Strict US SSN: 3-2-4 hyphenated digits. Bare 9-digit numbers are NOT flagged. */
const US_SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;

/** Strict UK NI: two prefix letters (admit set), six digits, one suffix letter A-D. */
const UK_NI_RE = /\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/;

/** Private key block markers — RSA, DSA, EC, OPENSSH, ENCRYPTED, etc. */
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]+PRIVATE KEY-----/;

/** AWS access key id format. */
const AWS_AKIA_RE = /\bAKIA[0-9A-Z]{16}\b/;

/** GitHub personal/OAuth/server/user tokens. */
const GITHUB_TOKEN_RE = /\bgh[opsu]_[A-Za-z0-9_]{36,}\b/;

/** Slack tokens (bot, public, app, system). */
const SLACK_TOKEN_RE = /\bxox[bpas]-[A-Za-z0-9-]+\b/;

/** Google API key. */
const GOOGLE_API_KEY_RE = /\bAIza[A-Za-z0-9_-]{35}\b/;

/**
 * Payment-candidate digit-group regex. Matches sequences of 13–19 digits
 * with optional space/hyphen separators (the canonical card number formats).
 * Each match is then digit-stripped and Luhn-checked.
 */
const PAYMENT_DIGIT_GROUPS_RE = /(?:\d[ -]?){12,18}\d/g;

/* --------------------------------------------------------------------------
 * STRUCTURAL_ID_KEYS — Decision D4 v1-aligned union
 * ------------------------------------------------------------------------ */

/**
 * Object keys whose VALUES are exempt from low-confidence (email/phone)
 * scanning. The sub-tree under any structural key cascades the exemption
 * (matching legacy validate.ts behaviour).
 *
 * High-confidence detectors (credential, government_id, payment) still run
 * even under structural-exempt sub-trees — their patterns rarely collide
 * with structural ID values, and the safety win outweighs the FP risk.
 */
export const STRUCTURAL_ID_KEYS: ReadonlySet<string> = new Set([
  // Legacy validate.ts structural identifiers
  'anon_session_id', 'anon_browser_id',
  'session_id', 'browser_id', 'client_event_id',
  'page_view_id', 'previous_page_view_id', 'source_page_view_id',
  'event_type', 'event_schema_version', 'event_contract_version',
  'site_id', 'hostname', 'collector_version',
  'client_timestamp_ms', 'event_sequence_index',
  'occurred_at', 'timestamp',
  'adapter_id', 'adapter_version', 'dedupe_key',
  // PR#1 ingest_requests
  'request_id', 'request_body_sha256', 'ip_hash',
  'received_at', 'reconciled_at', 'auth_status', 'reject_reason_code',
  // PR#2 accepted_events evidence
  'workspace_id', 'validator_version', 'schema_key', 'schema_version',
  'event_origin', 'id_format', 'traffic_class',
  'payload_sha256',
  'consent_state', 'consent_source', 'consent_updated_at',
  'pre_consent_mode', 'tracking_mode', 'storage_mechanism',
  'session_seq', 'session_started_at', 'session_last_seen_at',
  'canonical_jsonb', 'payload_purged_at', 'debug_mode',
  // PR#3 rejected_events evidence
  'rejected_stage', 'reason_code', 'reason_detail',
  'schema_errors_jsonb', 'pii_hits_jsonb',
  'raw_payload_sha256',
  'sample_visible_to_admin', 'rejected_at',
  // PR#4 site_write_tokens
  'token_id', 'token_hash',
  // V1 contract names
  'event_name', 'anonymous_id', 'sent_at', 'accepted_at',
]);

/* --------------------------------------------------------------------------
 * Luhn helper (D6 payment gate)
 * ------------------------------------------------------------------------ */

/**
 * Luhn checksum on the digit-only portion of `value`.
 * Returns false if the digit-only length is outside [13, 19] (card length).
 */
export function passesLuhn(value: string): boolean {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48; // '0' = 48
    if (n < 0 || n > 9) return false; // defensive — replace(/\D/g, '') should guarantee
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/* --------------------------------------------------------------------------
 * Per-string detectors
 * ------------------------------------------------------------------------ */

function detectPhoneInString(s: string): boolean {
  if (!PHONE_RE.test(s)) return false;
  return s.replace(/\D/g, '').length >= 7;
}

function detectPaymentInString(s: string): boolean {
  const matches = s.match(PAYMENT_DIGIT_GROUPS_RE);
  if (!matches) return false;
  for (const candidate of matches) {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the kinds detected in `s`, in canonical detector order:
 * credential → government_id → payment → email → phone.
 *
 * Email and phone are exempt under structural-key sub-trees; the high-
 * confidence detectors run regardless (Decision D4 + D5).
 */
function detectKindsInString(s: string, structuralExempt: boolean): PiiKind[] {
  const kinds: PiiKind[] = [];

  if (
    PRIVATE_KEY_RE.test(s) ||
    AWS_AKIA_RE.test(s) ||
    GITHUB_TOKEN_RE.test(s) ||
    SLACK_TOKEN_RE.test(s) ||
    GOOGLE_API_KEY_RE.test(s)
  ) {
    kinds.push('credential');
  }
  if (US_SSN_RE.test(s) || UK_NI_RE.test(s)) {
    kinds.push('government_id');
  }
  if (detectPaymentInString(s)) {
    kinds.push('payment');
  }

  if (!structuralExempt) {
    if (EMAIL_RE.test(s)) kinds.push('email');
    if (detectPhoneInString(s)) kinds.push('phone');
  }

  return kinds;
}

/* --------------------------------------------------------------------------
 * Path + recursion
 * ------------------------------------------------------------------------ */

function appendPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`;
  if (parent.length === 0) return key;
  return `${parent}.${key}`;
}

function scanRec(
  value: unknown,
  path: string,
  structuralExempt: boolean,
  hits: PiiHit[],
): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    const kinds = detectKindsInString(value, structuralExempt);
    for (const kind of kinds) {
      hits.push({ kind, reason_code: KIND_TO_REASON[kind], path });
    }
    return;
  }
  if (typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      scanRec(value[i], appendPath(path, i), structuralExempt, hits);
    }
    return;
  }
  const rec = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(rec)) {
    const childExempt = structuralExempt || STRUCTURAL_ID_KEYS.has(key);
    scanRec(child, appendPath(path, key), childExempt, hits);
  }
}

/* --------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

/**
 * Pure scan. Returns all hits in traversal order. Each hit carries kind,
 * reason_code, and JSON-style path — never the matched string itself.
 */
export function scanForPii(value: unknown): PiiHit[] {
  const hits: PiiHit[] = [];
  scanRec(value, '', false, hits);
  return hits;
}

/**
 * Returns the deterministic first PII reason code by traversal order, or
 * null if no PII found. Uses scanForPii; equivalent to `scanForPii(v)[0]?.reason_code`.
 */
export function firstPiiReasonCode(value: unknown): ReasonCode | null {
  const hits = scanForPii(value);
  if (hits.length === 0) return null;
  return hits[0]!.reason_code;
}
