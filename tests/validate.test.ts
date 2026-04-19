import { describe, it, expect } from 'vitest';
import { validateEvent } from '../src/collector/validate.js';

const validSessionStart = {
  event_schema_version: 'thin.v2.0',
  event_type: 'session_start',
  client_timestamp_ms: Date.now(),
  consent_signal: 'granted',
  site_id: 'buyerrecon_com',
  hostname: 'buyerrecon.com',
  anon_session_id: 'ses_abc123',
  anon_browser_id: 'brw_def456',
};

describe('validateEvent', () => {
  it('accepts valid session_start', () => {
    const r = validateEvent(validSessionStart);
    expect(r.accepted).toBe(true);
    expect(r.reasonCodes).toEqual([]);
  });

  it('rejects unknown event_type', () => {
    const r = validateEvent({ ...validSessionStart, event_type: 'click' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('UNKNOWN_EVENT_TYPE');
  });

  it('rejects wrong schema version', () => {
    const r = validateEvent({ ...validSessionStart, event_schema_version: 'thin.v1.0' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('UNKNOWN_SCHEMA_VERSION');
  });

  it('rejects consent not granted', () => {
    const r = validateEvent({ ...validSessionStart, consent_signal: 'pending' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('CONSENT_NOT_GRANTED');
  });

  it('rejects unknown site_id', () => {
    const r = validateEvent({ ...validSessionStart, site_id: 'unknown_site' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('UNKNOWN_SITE_ID');
  });

  it('rejects missing session_id', () => {
    const r = validateEvent({ ...validSessionStart, anon_session_id: '' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_SESSION_ID');
  });

  it('rejects missing browser_id', () => {
    const r = validateEvent({ ...validSessionStart, anon_browser_id: '' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('MISSING_BROWSER_ID');
  });

  it('rejects future timestamp', () => {
    const r = validateEvent({ ...validSessionStart, client_timestamp_ms: Date.now() + 600000 });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('FUTURE_TIMESTAMP');
  });

  it('rejects stale timestamp', () => {
    const r = validateEvent({ ...validSessionStart, client_timestamp_ms: Date.now() - 91 * 86400000 });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('STALE_TIMESTAMP');
  });

  it('rejects invalid dwell_bucket on page_state', () => {
    const r = validateEvent({
      ...validSessionStart,
      event_type: 'page_state',
      engagement_proxy: { dwell_bucket: 'invalid', scroll_depth_bucket: '0', interaction_density_bucket: '0' },
    });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('UNKNOWN_BUCKET_VALUE');
  });

  it('accepts valid page_state with valid buckets', () => {
    const r = validateEvent({
      ...validSessionStart,
      event_type: 'page_state',
      engagement_proxy: { dwell_bucket: '30-90s', scroll_depth_bucket: '76-100', interaction_density_bucket: '3-5' },
    });
    expect(r.accepted).toBe(true);
  });

  it('collects multiple reason codes', () => {
    const r = validateEvent({ ...validSessionStart, consent_signal: 'denied', site_id: 'bad' });
    expect(r.accepted).toBe(false);
    expect(r.reasonCodes).toContain('CONSENT_NOT_GRANTED');
    expect(r.reasonCodes).toContain('UNKNOWN_SITE_ID');
  });
});
