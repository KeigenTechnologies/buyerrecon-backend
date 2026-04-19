import {
  VALID_SITE_IDS, VALID_EVENT_TYPES, VALID_SCHEMA_VERSION,
  VALID_DWELL_BUCKETS, VALID_SCROLL_BUCKETS, VALID_INTERACTION_BUCKETS,
} from '../constants.js';

interface ValidationResult {
  accepted: boolean;
  reasonCodes: string[];
  siteId: string | null;
  sessionId: string | null;
  browserId: string | null;
  hostname: string | null;
  eventType: string | null;
  clientTimestampMs: number | null;
}

export function validateEvent(evt: unknown): ValidationResult {
  const reasons: string[] = [];
  const result: ValidationResult = {
    accepted: false, reasonCodes: reasons,
    siteId: null, sessionId: null, browserId: null,
    hostname: null, eventType: null, clientTimestampMs: null,
  };

  if (typeof evt !== 'object' || evt === null) {
    reasons.push('INVALID_EVENT_OBJECT');
    return result;
  }

  const e = evt as Record<string, unknown>;

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

  const ts = e.client_timestamp_ms;
  if (typeof ts !== 'number' || !Number.isInteger(ts) || ts <= 0) {
    reasons.push('INVALID_TIMESTAMP');
  } else {
    const now = Date.now();
    if (ts > now + 300000) {
      reasons.push('FUTURE_TIMESTAMP');
    }
    if (ts < now - 90 * 86400000) {
      reasons.push('STALE_TIMESTAMP');
    }
    result.clientTimestampMs = ts;
  }

  if (eventType === 'page_state' || eventType === 'session_summary') {
    const eng = e.engagement_proxy as Record<string, unknown> | undefined;
    if (eng && typeof eng === 'object') {
      if (eng.dwell_bucket && !VALID_DWELL_BUCKETS.has(eng.dwell_bucket as string)) {
        reasons.push('UNKNOWN_BUCKET_VALUE');
      }
      if (eng.scroll_depth_bucket && !VALID_SCROLL_BUCKETS.has(eng.scroll_depth_bucket as string)) {
        reasons.push('UNKNOWN_BUCKET_VALUE');
      }
      if (eng.interaction_density_bucket && !VALID_INTERACTION_BUCKETS.has(eng.interaction_density_bucket as string)) {
        reasons.push('UNKNOWN_BUCKET_VALUE');
      }
    }
  }

  result.accepted = reasons.length === 0;
  return result;
}

export function validateBatch(input: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(input)) return { valid: false, error: 'INVALID_BATCH_FORMAT' };
  if (input.length > 50) return { valid: false, error: 'INVALID_BATCH_FORMAT' };
  return { valid: true };
}
