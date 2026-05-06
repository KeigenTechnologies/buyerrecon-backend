import {
  VALID_SITE_IDS, VALID_EVENT_TYPES, VALID_SCHEMA_VERSION,
  VALID_DWELL_BUCKETS, VALID_SCROLL_BUCKETS, VALID_INTERACTION_BUCKETS,
  LEGACY_CONTRACT_VERSION, CANONICAL_CONTRACT_VERSION,
} from '../constants.js';

// ── Legacy production events that may arrive without new contract fields ──
const LEGACY_COMPATIBLE_TYPES = new Set(['session_start', 'page_state', 'session_summary']);
const NEW_CANONICAL_TYPES = new Set(['page_view', 'cta_click', 'form_start', 'form_submit', 'generate_lead']);

// ── PII detection ──
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,4}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
const PII_KEYS = new Set([
  'email', 'phone', 'name', 'first_name', 'last_name', 'full_name',
  'message', 'address', 'postcode', 'zip_code', 'postal_code',
  'company', 'organisation', 'organization',
]);

// Structural ID keys — exempt from phone/email value scanning
const STRUCTURAL_ID_KEYS = new Set([
  'anon_session_id', 'anon_browser_id', 'session_id', 'browser_id',
  'client_event_id', 'page_view_id', 'previous_page_view_id',
  'source_page_view_id', 'event_type', 'event_schema_version',
  'event_contract_version', 'site_id', 'hostname', 'collector_version',
  'client_timestamp_ms', 'event_sequence_index', 'occurred_at', 'timestamp',
  'adapter_id', 'adapter_version', 'dedupe_key',
]);

function containsPII(val: unknown): boolean {
  if (typeof val === 'string') {
    if (EMAIL_RE.test(val)) return true;
    if (PHONE_RE.test(val) && val.replace(/\D/g, '').length >= 7) return true;
  }
  return false;
}

function scanPayloadForPII(obj: unknown, path: string = ''): string | null {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string') {
    if (containsPII(obj)) return `PII_IN_VALUE:${path}`;
    return null;
  }
  if (typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const r = scanPayloadForPII(obj[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  const rec = obj as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    const lk = key.toLowerCase();
    // Reject explicit PII keys anywhere
    if (PII_KEYS.has(lk)) return `PII_KEY_PRESENT:${path}.${key}`;
    // Skip value scanning for structural ID fields
    if (STRUCTURAL_ID_KEYS.has(lk)) continue;
    // Scan content-like string values for accidental PII
    if (typeof rec[key] === 'string' && containsPII(rec[key])) return `PII_IN_VALUE:${path}.${key}`;
    // Recurse into nested objects
    if (typeof rec[key] === 'object' && rec[key] !== null) {
      const r = scanPayloadForPII(rec[key], `${path}.${key}`);
      if (r) return r;
    }
  }
  return null;
}

/** Redact a raw payload for PII-rejected events: keep only structural metadata. */
export function redactForPII(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) return { _redacted: true };
  const e = raw as Record<string, unknown>;
  return {
    _redacted: true,
    event_type: e.event_type,
    site_id: e.site_id,
    anon_session_id: e.anon_session_id,
    client_event_id: e.client_event_id,
    client_timestamp_ms: e.client_timestamp_ms,
    event_schema_version: e.event_schema_version,
  };
}

export interface ValidationResult {
  accepted: boolean;
  reasonCodes: string[];
  siteId: string | null;
  sessionId: string | null;
  browserId: string | null;
  hostname: string | null;
  eventType: string | null;
  clientTimestampMs: number | null;
  clientEventId: string | null;
  pageViewId: string | null;
  previousPageViewId: string | null;
  eventSequenceIndex: number | null;
  eventContractVersion: string;
  piiRejected: boolean;
}

export function validateEvent(evt: unknown): ValidationResult {
  const reasons: string[] = [];
  const result: ValidationResult = {
    accepted: false, reasonCodes: reasons,
    siteId: null, sessionId: null, browserId: null,
    hostname: null, eventType: null, clientTimestampMs: null,
    clientEventId: null, pageViewId: null, previousPageViewId: null,
    eventSequenceIndex: null, eventContractVersion: LEGACY_CONTRACT_VERSION,
    piiRejected: false,
  };

  if (typeof evt !== 'object' || evt === null) {
    reasons.push('INVALID_EVENT_OBJECT');
    return result;
  }

  const e = evt as Record<string, unknown>;

  // ── Core envelope ──
  const eventType = e.event_type as string | undefined;
  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    reasons.push('UNKNOWN_EVENT_TYPE');
  }
  result.eventType = typeof eventType === 'string' ? eventType : null;

  if (e.event_schema_version !== VALID_SCHEMA_VERSION) {
    reasons.push('UNKNOWN_SCHEMA_VERSION');
  }

  if (e.consent_signal !== 'granted') {
    reasons.push('CONSENT_NOT_GRANTED');
  }

  const siteId = e.site_id as string | undefined;
  if (!siteId || !VALID_SITE_IDS.has(siteId)) {
    reasons.push('UNKNOWN_SITE_ID');
  }
  result.siteId = typeof siteId === 'string' ? siteId : null;

  const sessionId = e.anon_session_id as string | undefined;
  if (!sessionId || typeof sessionId !== 'string') {
    reasons.push('MISSING_SESSION_ID');
  }
  result.sessionId = typeof sessionId === 'string' ? sessionId : null;

  const browserId = e.anon_browser_id as string | undefined;
  if (!browserId || typeof browserId !== 'string') {
    reasons.push('MISSING_BROWSER_ID');
  }
  result.browserId = typeof browserId === 'string' ? browserId : null;

  result.hostname = typeof e.hostname === 'string' ? e.hostname : null;

  // ── Timestamp — normalize occurred_at / timestamp / client_timestamp_ms ──
  let ts: number | undefined;
  if (typeof e.client_timestamp_ms === 'number') ts = e.client_timestamp_ms as number;
  else if (typeof e.occurred_at === 'number') ts = e.occurred_at as number;
  else if (typeof e.timestamp === 'number') ts = e.timestamp as number;

  if (ts === undefined || !Number.isInteger(ts) || ts <= 0) {
    reasons.push('INVALID_TIMESTAMP');
  } else {
    const now = Date.now();
    if (ts > now + 300000) reasons.push('FUTURE_TIMESTAMP');
    if (ts < now - 90 * 86400000) reasons.push('STALE_TIMESTAMP');
    result.clientTimestampMs = ts;
  }

  // ── Lineage fields ──
  if (typeof e.client_event_id === 'string' && e.client_event_id.length > 0) {
    result.clientEventId = e.client_event_id as string;
  }
  if (typeof e.page_view_id === 'string') result.pageViewId = e.page_view_id as string;
  if (typeof e.previous_page_view_id === 'string') result.previousPageViewId = e.previous_page_view_id as string;
  if (typeof e.event_sequence_index === 'number') result.eventSequenceIndex = e.event_sequence_index as number;

  // ── Contract version + client_event_id: conditional on event category ──
  const isNewCanonical = eventType ? NEW_CANONICAL_TYPES.has(eventType) : false;
  const isLegacy = eventType ? LEGACY_COMPATIBLE_TYPES.has(eventType) : false;

  if (isNewCanonical) {
    if (!result.clientEventId) reasons.push('MISSING_CLIENT_EVENT_ID');
    if (e.event_contract_version !== CANONICAL_CONTRACT_VERSION) reasons.push('MISSING_OR_INVALID_EVENT_CONTRACT_VERSION');
    result.eventContractVersion = CANONICAL_CONTRACT_VERSION;
  } else if (isLegacy) {
    if (typeof e.event_contract_version === 'string' && e.event_contract_version.length > 0) {
      result.eventContractVersion = e.event_contract_version as string;
    } else {
      result.eventContractVersion = LEGACY_CONTRACT_VERSION;
    }
  }

  // ── Per-event-type field validation ──
  if (eventType && VALID_EVENT_TYPES.has(eventType)) {
    validateEventFields(eventType, e, reasons, isNewCanonical);
  }

  // ── Engagement bucket validation ──
  if (eventType === 'page_state' || eventType === 'session_summary') {
    const eng = e.engagement_proxy as Record<string, unknown> | undefined;
    if (eng && typeof eng === 'object') {
      if (eng.dwell_bucket && !VALID_DWELL_BUCKETS.has(eng.dwell_bucket as string)) reasons.push('UNKNOWN_BUCKET_VALUE');
      if (eng.scroll_depth_bucket && !VALID_SCROLL_BUCKETS.has(eng.scroll_depth_bucket as string)) reasons.push('UNKNOWN_BUCKET_VALUE');
      if (eng.interaction_density_bucket && !VALID_INTERACTION_BUCKETS.has(eng.interaction_density_bucket as string)) reasons.push('UNKNOWN_BUCKET_VALUE');
    }
  }

  // ── PII scan ──
  const piiHit = scanPayloadForPII(e);
  if (piiHit) {
    reasons.push(piiHit);
    result.piiRejected = true;
  }

  result.accepted = reasons.length === 0;
  return result;
}

// ── Per-event field validation ──

const VALID_SUBMIT_OUTCOMES = new Set(['success', 'error', 'unknown']);
const VALID_SOURCE_KINDS = new Set([
  'form_success', 'thank_you_page', 'ajax_success',
  'external_booking_confirmation', 'gated_download_confirmation',
  'newsletter_confirmation', 'manual_test_isolated',
]);

function validateEventFields(eventType: string, e: Record<string, unknown>, reasons: string[], isNewCanonical: boolean): void {
  switch (eventType) {
    case 'page_view':
      if (typeof e.page_view_id !== 'string' || e.page_view_id.length === 0) reasons.push('MISSING_PAGE_VIEW_ID');
      if (typeof e.path !== 'string' || e.path.length === 0) reasons.push('MISSING_PATH');
      break;

    case 'page_state':
      if (isNewCanonical && (typeof e.page_view_id !== 'string' || (e.page_view_id as string).length === 0)) {
        reasons.push('MISSING_PAGE_VIEW_ID');
      }
      break;

    case 'cta_click':
      if ((typeof e.cta_id !== 'string' || e.cta_id.length === 0) &&
          (typeof e.cta_label_bucket !== 'string' || e.cta_label_bucket.length === 0)) {
        reasons.push('MISSING_CTA_ID_OR_LABEL_BUCKET');
      }
      if (typeof e.href_category !== 'string' || e.href_category.length === 0) reasons.push('MISSING_HREF_CATEGORY');
      if (typeof e.click_offset_ms !== 'number' && typeof e.ms_since_page_load !== 'number') reasons.push('MISSING_CLICK_OFFSET');
      break;

    case 'form_start':
      if (typeof e.page_view_id !== 'string' || (e.page_view_id as string).length === 0) reasons.push('MISSING_PAGE_VIEW_ID');
      if (typeof e.form_id !== 'string' || e.form_id.length === 0) reasons.push('MISSING_FORM_ID');
      if (typeof e.ms_since_page_load !== 'number' && typeof e.form_start_offset_ms !== 'number') reasons.push('MISSING_FORM_START_OFFSET');
      break;

    case 'form_submit':
      if (typeof e.page_view_id !== 'string' || (e.page_view_id as string).length === 0) reasons.push('MISSING_PAGE_VIEW_ID');
      if (typeof e.form_id !== 'string' || e.form_id.length === 0) reasons.push('MISSING_FORM_ID');
      if (typeof e.submit_outcome !== 'string' || !VALID_SUBMIT_OUTCOMES.has(e.submit_outcome as string)) reasons.push('MISSING_OR_INVALID_SUBMIT_OUTCOME');
      break;

    case 'generate_lead':
      if (typeof e.lead_type !== 'string' || e.lead_type.length === 0) reasons.push('MISSING_LEAD_TYPE');
      if (typeof e.source_kind !== 'string' || !VALID_SOURCE_KINDS.has(e.source_kind as string)) reasons.push('MISSING_OR_INVALID_SOURCE_KIND');
      if (typeof e.source_page_view_id !== 'string' && typeof e.page_view_id !== 'string') reasons.push('MISSING_SOURCE_PAGE_VIEW_ID');
      break;

    case 'session_start':
    case 'session_summary':
      break;
  }
}

export function validateBatch(input: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(input)) return { valid: false, error: 'INVALID_BATCH_FORMAT' };
  if (input.length > 50) return { valid: false, error: 'INVALID_BATCH_FORMAT' };
  return { valid: true };
}
