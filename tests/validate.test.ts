import { describe, it, expect } from 'vitest';
import { validateEvent, redactForPII } from '../src/collector/validate.js';
import {
  sessionStart, pageView, pageState, ctaClick,
  formStart, formSubmit, generateLead, sessionSummary,
  allCanonical,
} from './fixtures/canonical-events.js';

// ══════════════════════════════════════════════════
// All 8 canonical event types accepted
// ══════════════════════════════════════════════════

describe('canonical event types', () => {
  it.each([
    ['session_start', sessionStart],
    ['page_view', pageView],
    ['page_state', pageState],
    ['cta_click', ctaClick],
    ['form_start', formStart],
    ['form_submit', formSubmit],
    ['generate_lead', generateLead],
    ['session_summary', sessionSummary],
  ])('accepts valid %s', (_name, evt) => {
    const r = validateEvent(evt);
    expect(r.accepted).toBe(true);
    expect(r.reasonCodes).toEqual([]);
  });
});

// ══════════════════════════════════════════════════
// Legacy production events accepted without new fields
// ══════════════════════════════════════════════════

describe('legacy production compatibility', () => {
  const legacyBase = {
    event_schema_version: 'thin.v2.0',
    client_timestamp_ms: Date.now(),
    consent_signal: 'granted',
    site_id: 'buyerrecon_com',
    hostname: 'buyerrecon.com',
    anon_session_id: 'ses_legacy_001',
    anon_browser_id: 'brw_legacy_001',
  };

  it('accepts old session_start without client_event_id or event_contract_version', () => {
    const r = validateEvent({ ...legacyBase, event_type: 'session_start' });
    expect(r.accepted).toBe(true);
    expect(r.clientEventId).toBeNull();
    expect(r.eventContractVersion).toBe('legacy-thin-v2.0');
  });

  it('accepts old page_state without client_event_id or event_contract_version', () => {
    const r = validateEvent({
      ...legacyBase,
      event_type: 'page_state',
      engagement_proxy: { dwell_bucket: '10-30s', scroll_depth_bucket: '26-50', interaction_density_bucket: '1-2' },
    });
    expect(r.accepted).toBe(true);
    expect(r.eventContractVersion).toBe('legacy-thin-v2.0');
  });

  it('accepts old session_summary without client_event_id or event_contract_version', () => {
    const r = validateEvent({
      ...legacyBase,
      event_type: 'session_summary',
      engagement_proxy: { dwell_bucket: '30-90s', scroll_depth_bucket: '51-75', interaction_density_bucket: '3-5' },
    });
    expect(r.accepted).toBe(true);
    expect(r.eventContractVersion).toBe('legacy-thin-v2.0');
  });

  it('accepts occurred_at as timestamp alternative', () => {
    const { client_timestamp_ms, ...rest } = legacyBase;
    const r = validateEvent({ ...rest, event_type: 'session_start', occurred_at: Date.now() });
    expect(r.accepted).toBe(true);
    expect(r.clientTimestampMs).toBeGreaterThan(0);
  });

  it('accepts timestamp as timestamp alternative', () => {
    const { client_timestamp_ms, ...rest } = legacyBase;
    const r = validateEvent({ ...rest, event_type: 'session_start', timestamp: Date.now() });
    expect(r.accepted).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// New canonical events require strict contract fields
// ══════════════════════════════════════════════════

describe('new canonical events strict requirements', () => {
  it('rejects page_view without client_event_id', () => {
    const { client_event_id, ...rest } = pageView;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_CLIENT_EVENT_ID');
  });

  it('rejects cta_click without event_contract_version', () => {
    const { event_contract_version, ...rest } = ctaClick;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_OR_INVALID_EVENT_CONTRACT_VERSION');
  });

  it('rejects page_view without page_view_id', () => {
    const { page_view_id, ...rest } = pageView;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_PAGE_VIEW_ID');
  });

  it('rejects page_view without path', () => {
    const { path, ...rest } = pageView;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_PATH');
  });
});

// ══════════════════════════════════════════════════
// Per-event required fields
// ══════════════════════════════════════════════════

describe('per-event required fields', () => {
  it('rejects cta_click without cta_id and cta_label_bucket', () => {
    const { cta_id, ...rest } = ctaClick;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_CTA_ID_OR_LABEL_BUCKET');
  });

  it('accepts cta_click with cta_label_bucket instead of cta_id', () => {
    const { cta_id, ...rest } = ctaClick;
    const r = validateEvent({ ...rest, cta_label_bucket: 'hero_report_cta' });
    expect(r.accepted).toBe(true);
  });

  it('rejects cta_click without href_category', () => {
    const { href_category, ...rest } = ctaClick;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_HREF_CATEGORY');
  });

  it('rejects cta_click without click offset', () => {
    const { click_offset_ms, ...rest } = ctaClick;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_CLICK_OFFSET');
  });

  it('accepts cta_click with ms_since_page_load', () => {
    const { click_offset_ms, ...rest } = ctaClick;
    const r = validateEvent({ ...rest, ms_since_page_load: 12500 });
    expect(r.accepted).toBe(true);
  });

  it('rejects form_start without form_id', () => {
    const { form_id, ...rest } = formStart;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_FORM_ID');
  });

  it('rejects form_start without page_view_id', () => {
    const { page_view_id, ...rest } = formStart;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_PAGE_VIEW_ID');
  });

  it('rejects form_start without timing offset', () => {
    const { ms_since_page_load, ...rest } = formStart;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_FORM_START_OFFSET');
  });

  it('accepts form_start with form_start_offset_ms', () => {
    const { ms_since_page_load, ...rest } = formStart;
    const r = validateEvent({ ...rest, form_start_offset_ms: 5000 });
    expect(r.accepted).toBe(true);
  });

  it('rejects form_submit without form_id', () => {
    const { form_id, ...rest } = formSubmit;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_FORM_ID');
  });

  it('rejects form_submit without submit_outcome', () => {
    const { submit_outcome, ...rest } = formSubmit;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_OR_INVALID_SUBMIT_OUTCOME');
  });

  it('rejects form_submit with invalid submit_outcome', () => {
    const r = validateEvent({ ...formSubmit, submit_outcome: 'maybe' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_OR_INVALID_SUBMIT_OUTCOME');
  });

  it('accepts form_submit with submit_outcome=error', () => {
    const r = validateEvent({ ...formSubmit, submit_outcome: 'error' });
    expect(r.accepted).toBe(true);
  });

  it('rejects generate_lead without lead_type', () => {
    const { lead_type, ...rest } = generateLead;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_LEAD_TYPE');
  });

  it('rejects generate_lead without source_kind', () => {
    const { source_kind, ...rest } = generateLead;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_OR_INVALID_SOURCE_KIND');
  });

  it('rejects generate_lead with invalid source_kind', () => {
    const r = validateEvent({ ...generateLead, source_kind: 'magic' });
    expect(r.accepted).toBe(false);
  });

  it('accepts generate_lead with source_kind=thank_you_page', () => {
    const r = validateEvent({ ...generateLead, source_kind: 'thank_you_page' });
    expect(r.accepted).toBe(true);
  });

  it('rejects generate_lead without source_page_view_id or page_view_id', () => {
    const { source_page_view_id, page_view_id, ...rest } = generateLead;
    const r = validateEvent(rest);
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_SOURCE_PAGE_VIEW_ID');
  });
});

// ══════════════════════════════════════════════════
// PII protection
// ══════════════════════════════════════════════════

describe('PII protection', () => {
  it('rejects email in payload value', () => {
    const r = validateEvent({ ...ctaClick, cta_text_truncated_safe: 'Contact pii-test@example.invalid now' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes.some(c => c.startsWith('PII_IN_VALUE'))).toBe(true);
    expect(r.piiRejected).toBe(true);
  });

  it('rejects email key in payload', () => {
    const r = validateEvent({ ...sessionStart, email: 'test@example.com' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes.some(c => c.startsWith('PII_KEY_PRESENT'))).toBe(true);
  });

  it('rejects phone in payload value', () => {
    const r = validateEvent({ ...ctaClick, cta_text_truncated_safe: 'Call +44 20 7946 0958' });
    expect(r.accepted).toBe(false);
    expect(r.piiRejected).toBe(true);
  });

  it('rejects company key', () => {
    const r = validateEvent({ ...formStart, company: 'Acme Ltd' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes.some(c => c.startsWith('PII_KEY_PRESENT'))).toBe(true);
  });

  it('rejects name key', () => {
    const r = validateEvent({ ...sessionStart, name: 'Test User' });
    expect(r.accepted).toBe(false);
  });

  it('rejects nested PII in adapter_context', () => {
    const r = validateEvent({
      ...pageState,
      adapter_context: { adapter_page_group: 'home', user_email: 'test@example.com' },
    });
    expect(r.accepted).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// Structural ID fields exempt from PII value scanning
// ══════════════════════════════════════════════════

describe('structural ID exemption (hotfix)', () => {
  const legacyBase = {
    event_schema_version: 'thin.v2.0',
    client_timestamp_ms: Date.now(),
    consent_signal: 'granted',
    site_id: 'buyerrecon_com',
    hostname: 'buyerrecon.com',
  };

  it('accepts legacy session_start with numeric anon_session_id', () => {
    const r = validateEvent({
      ...legacyBase,
      event_type: 'session_start',
      anon_session_id: 'ses_smoke_1778067320_legacy',
      anon_browser_id: 'brw_smoke_1778067320_legacy',
    });
    expect(r.accepted).toBe(true);
    expect(r.reasonCodes).toEqual([]);
  });

  it('accepts page_view with numeric client_event_id and page_view_id', () => {
    const r = validateEvent({
      ...legacyBase,
      event_contract_version: 'event-contract-v0.1',
      event_type: 'page_view',
      client_event_id: 'evt_1778067320000_pv_001',
      page_view_id: 'pvid_1778067320000_001',
      path: '/en/',
      anon_session_id: 'ses_1778067320000',
      anon_browser_id: 'brw_1778067320000',
    });
    expect(r.accepted).toBe(true);
  });

  it('still rejects email key even with structural IDs present', () => {
    const r = validateEvent({
      ...legacyBase,
      event_type: 'session_start',
      anon_session_id: 'ses_smoke_001',
      anon_browser_id: 'brw_smoke_001',
      email: 'pii-test@example.invalid',
    });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes.some(c => c.startsWith('PII_KEY_PRESENT'))).toBe(true);
  });

  it('redacted PII payload does not contain the email value', () => {
    const raw = {
      ...legacyBase,
      event_type: 'session_start',
      anon_session_id: 'ses_001',
      anon_browser_id: 'brw_001',
      email: 'pii-test@example.invalid',
    };
    const redacted = redactForPII(raw);
    expect(JSON.stringify(redacted)).not.toContain('pii-test@example.invalid');
    expect(redacted._redacted).toBe(true);
  });

  it('still rejects phone in cta_text_truncated_safe', () => {
    const r = validateEvent({ ...ctaClick, cta_text_truncated_safe: 'Call +44 20 7946 0958' });
    expect(r.accepted).toBe(false);
    expect(r.piiRejected).toBe(true);
  });

  it('accepts cta_text_truncated_safe = "Company name"', () => {
    const r = validateEvent({ ...ctaClick, cta_text_truncated_safe: 'Company name' });
    expect(r.accepted).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// PII redaction helper
// ══════════════════════════════════════════════════

describe('redactForPII', () => {
  it('strips raw values and keeps only structural metadata', () => {
    const raw = {
      event_type: 'form_start',
      site_id: 'buyerrecon_com',
      anon_session_id: 'ses_001',
      client_event_id: 'evt_001',
      client_timestamp_ms: 1234567890,
      event_schema_version: 'thin.v2.0',
      form_id: 'some_form',
      email: 'test@example.com',
      name: 'Secret Name',
    };
    const redacted = redactForPII(raw);
    expect(redacted._redacted).toBe(true);
    expect(redacted.event_type).toBe('form_start');
    expect(redacted.site_id).toBe('buyerrecon_com');
    expect((redacted as any).email).toBeUndefined();
    expect((redacted as any).name).toBeUndefined();
    expect((redacted as any).form_id).toBeUndefined();
  });

  it('handles non-object input', () => {
    const redacted = redactForPII('just a string');
    expect(redacted._redacted).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// Envelope validation
// ══════════════════════════════════════════════════

describe('envelope validation', () => {
  it('rejects unknown event_type', () => {
    const r = validateEvent({ ...sessionStart, event_type: 'click' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('UNKNOWN_EVENT_TYPE');
  });

  it('rejects wrong schema version', () => {
    const r = validateEvent({ ...sessionStart, event_schema_version: 'thin.v1.0' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('UNKNOWN_SCHEMA_VERSION');
  });

  it('rejects consent not granted', () => {
    const r = validateEvent({ ...sessionStart, consent_signal: 'pending' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('CONSENT_NOT_GRANTED');
  });

  it('rejects unknown site_id', () => {
    const r = validateEvent({ ...sessionStart, site_id: 'unknown_site' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('UNKNOWN_SITE_ID');
  });

  it('rejects missing session_id', () => {
    const r = validateEvent({ ...sessionStart, anon_session_id: '' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_SESSION_ID');
  });

  it('rejects future timestamp', () => {
    const r = validateEvent({ ...sessionStart, client_timestamp_ms: Date.now() + 600000 });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('FUTURE_TIMESTAMP');
  });

  it('rejects stale timestamp', () => {
    const r = validateEvent({ ...sessionStart, client_timestamp_ms: Date.now() - 91 * 86400000 });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('STALE_TIMESTAMP');
  });

  it('collects multiple reason codes', () => {
    const r = validateEvent({ ...sessionStart, consent_signal: 'denied', site_id: 'bad' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('CONSENT_NOT_GRANTED');
    expect(r.reasonCodes).toContain('UNKNOWN_SITE_ID');
  });
});

// ══════════════════════════════════════════════════
// Engagement buckets
// ══════════════════════════════════════════════════

describe('engagement buckets', () => {
  it('rejects invalid dwell_bucket on page_state', () => {
    const r = validateEvent({
      ...pageState,
      engagement_proxy: { ...pageState.engagement_proxy, dwell_bucket: 'invalid' },
    });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('UNKNOWN_BUCKET_VALUE');
  });
});
