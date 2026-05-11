/**
 * Sprint 1 PR#5c-1 — row-builders tests (real bodies; PR#5a stub-throw
 * assertions removed).
 *
 * Pure-function tests. No DB / env / network / route.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildIngestRequestRow,
  buildAcceptedEventRow,
  buildRejectedEventRow,
  LEGACY_SESSION_ID_SENTINEL,
  LEGACY_BROWSER_ID_SENTINEL,
  LEGACY_HOSTNAME_SENTINEL,
  UNAUTH_WORKSPACE_SENTINEL,
} from '../../src/collector/v1/row-builders.js';
import { payloadSha256 } from '../../src/collector/v1/payload-hash.js';
import { sha256Hex } from '../../src/collector/v1/hash.js';
import { stableStringify } from '../../src/collector/v1/stable-json.js';
import * as v1 from '../../src/collector/v1/index.js';
import type { EventValidationOk } from '../../src/collector/v1/validation.js';

const ROW_BUILDERS_SRC = readFileSync(
  join(__dirname, '..', '..', 'src', 'collector', 'v1', 'row-builders.ts'),
  'utf8',
);
const INDEX_SRC = readFileSync(
  join(__dirname, '..', '..', 'src', 'collector', 'v1', 'index.ts'),
  'utf8',
);

// ---- Fixtures ----

const PEPPER = '0'.repeat(64);

const validatedBrowser: EventValidationOk = {
  ok: true,
  event_origin: 'browser',
  event_type: 'page',
  event_name: 'page_view',
  schema_key: 'br.page',
  schema_version: '1.0.0',
  client_event_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  id_format: 'uuidv4',
  session_id: 'sess_alpha',
  occurred_at: new Date('2026-05-10T11:59:59Z'),
};

const validatedServer: EventValidationOk = {
  ok: true,
  event_origin: 'server',
  event_type: 'track',
  event_name: 'lead_qualified',
  schema_key: 'br.track',
  schema_version: '1.0.0',
  client_event_id: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
  id_format: 'uuidv7',
  session_id: null,
  occurred_at: new Date('2026-05-10T11:59:59Z'),
};

const baseCtx = {
  request_id: '00000000-0000-0000-0000-000000000001',
  received_at: new Date('2026-05-10T12:00:00Z'),
  endpoint: '/v1/event',
  method: 'POST',
  content_type: 'application/json',
  user_agent: 'test-ua',
  ip: '192.0.2.1',
  auth_header: 'Bearer test',
  raw_body_bytes: Buffer.from('{"event_name":"page_view"}', 'utf8'),
};

const baseResolved = { workspace_id: 'ws_alpha', site_id: 'site_alpha' };

const baseAcceptedConfig = {
  validator_version: 'v-test-0.1',
  collector_version: 'c-test-0.1',
  event_contract_version: 'event-contract-v0.1',
  ip_hash_pepper: PEPPER,
};

const rawBrowserEvent: Record<string, unknown> = {
  client_event_id: validatedBrowser.client_event_id,
  event_name: validatedBrowser.event_name,
  event_type: validatedBrowser.event_type,
  event_origin: validatedBrowser.event_origin,
  schema_key: validatedBrowser.schema_key,
  schema_version: validatedBrowser.schema_version,
  occurred_at: '2026-05-10T11:59:59Z',
  session_id: validatedBrowser.session_id,
  anonymous_id: 'a_alpha',
  page_url: 'https://example.com/p',
  page_path: '/p',
  page_title: 'Product',
  properties: { color: 'blue' },
  context: { campaign: 'spring' },
  consent_state: 'granted',
  consent_source: 'cmp',
  tracking_mode: 'full',
  storage_mechanism: 'cookie',
};

// ===========================================================================
// buildIngestRequestRow
// ===========================================================================

describe('buildIngestRequestRow — real body', () => {
  const baseArgs = {
    ctx: baseCtx,
    resolved: baseResolved,
    ip_hash_pepper: PEPPER,
    expected_event_count: 1,
    accepted_count: 1,
    rejected_count: 0,
    reconciled_at: baseCtx.received_at,
    http_status: 200,
    auth_status: 'ok' as const,
    reject_reason_code: null,
    collector_version: 'c-test-0.1',
  };

  it('computes request_body_sha256 from raw body bytes (not via payloadSha256)', () => {
    const row = buildIngestRequestRow(baseArgs);
    expect(row.request_body_sha256).toBe(sha256Hex(baseCtx.raw_body_bytes));
    // Verify it's the bytes-based hash, not the JSON-value-based hash
    expect(row.request_body_sha256).toHaveLength(64);
    expect(row.request_body_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('populates size_bytes from raw_body_bytes byteLength', () => {
    const row = buildIngestRequestRow(baseArgs);
    expect(row.size_bytes).toBe(baseCtx.raw_body_bytes.byteLength);
  });

  it('propagates request_id and received_at from ctx', () => {
    const row = buildIngestRequestRow(baseArgs);
    expect(row.request_id).toBe(baseCtx.request_id);
    expect(row.received_at).toBe(baseCtx.received_at);
  });

  it('takes auth_status from args (not inferred from reject_reason_code)', () => {
    const row = buildIngestRequestRow({
      ...baseArgs,
      auth_status: 'site_disabled',
      reject_reason_code: 'auth_site_disabled',
    });
    expect(row.auth_status).toBe('site_disabled');
    expect(row.reject_reason_code).toBe('auth_site_disabled');
  });

  it('populates workspace_id and site_id from resolved when present', () => {
    const row = buildIngestRequestRow(baseArgs);
    expect(row.workspace_id).toBe('ws_alpha');
    expect(row.site_id).toBe('site_alpha');
  });

  it('emits null workspace_id and site_id when resolved is null (auth failure)', () => {
    const row = buildIngestRequestRow({
      ...baseArgs,
      resolved: null,
      auth_status: 'invalid_token',
      reject_reason_code: 'auth_invalid',
      http_status: 401,
    });
    expect(row.workspace_id).toBeNull();
    expect(row.site_id).toBeNull();
  });

  it('uses UNAUTH_WORKSPACE_SENTINEL as ip_hash salt when resolved is null', () => {
    const row = buildIngestRequestRow({
      ...baseArgs,
      resolved: null,
      auth_status: 'invalid_token',
      reject_reason_code: 'auth_invalid',
      http_status: 401,
    });
    expect(row.ip_hash).toHaveLength(64);
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    // Distinct from the resolved-workspace hash of the same IP.
    const rowResolved = buildIngestRequestRow(baseArgs);
    expect(row.ip_hash).not.toBe(rowResolved.ip_hash);
  });

  it('throws TypeError when ctx.ip is null (no fake fallback IP)', () => {
    expect(() =>
      buildIngestRequestRow({
        ...baseArgs,
        ctx: { ...baseCtx, ip: null },
      }),
    ).toThrow(TypeError);
  });

  it('throws TypeError when ctx.ip is empty string', () => {
    expect(() =>
      buildIngestRequestRow({
        ...baseArgs,
        ctx: { ...baseCtx, ip: '' },
      }),
    ).toThrow(TypeError);
  });

  it('propagates counts and reconciled_at from args', () => {
    const row = buildIngestRequestRow({
      ...baseArgs,
      expected_event_count: 10,
      accepted_count: 9,
      rejected_count: 1,
      reconciled_at: new Date('2026-05-10T12:00:01Z'),
    });
    expect(row.expected_event_count).toBe(10);
    expect(row.accepted_count).toBe(9);
    expect(row.rejected_count).toBe(1);
    expect(row.reconciled_at?.toISOString()).toBe('2026-05-10T12:00:01.000Z');
  });

  it('exports UNAUTH_WORKSPACE_SENTINEL as a documented constant', () => {
    expect(UNAUTH_WORKSPACE_SENTINEL).toBe('__unauth__');
  });
});

// ===========================================================================
// buildAcceptedEventRow
// ===========================================================================

describe('buildAcceptedEventRow — real body', () => {
  const baseArgs = {
    ctx: baseCtx,
    resolved: baseResolved,
    validated: validatedBrowser,
    raw_event: rawBrowserEvent,
    config: baseAcceptedConfig,
  };

  it('produces payload_sha256 and canonical_jsonb as SEPARATE values (critical §2.5 contract)', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.canonical_jsonb).toBeTypeOf('object');
    // The CRITICAL invariant: payload_sha256 must NOT equal hash(canonical_jsonb).
    const fakeHash = payloadSha256(row.canonical_jsonb);
    expect(row.payload_sha256).not.toBe(fakeHash);
  });

  it('canonical_jsonb has exactly 19 keys (Decision D3)', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(Object.keys(row.canonical_jsonb).length).toBe(19);
  });

  it("traffic_class is always 'unknown' (Decision #13)", () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.traffic_class).toBe('unknown');
  });

  it('debug_mode is always false on accepted rows (site-token writes)', () => {
    const row = buildAcceptedEventRow({
      ...baseArgs,
      raw_event: { ...rawBrowserEvent, debug: true }, // R-12 would reject upstream; sanity-check no leak
    });
    expect(row.debug_mode).toBe(false);
  });

  it('raw column stores the original raw_event verbatim', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.raw).toBe(rawBrowserEvent);
  });

  it('payload_purged_at is null at write time', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.payload_purged_at).toBeNull();
  });

  it('populates request_id, workspace_id, site_id from ctx + resolved', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.request_id).toBe(baseCtx.request_id);
    expect(row.workspace_id).toBe('ws_alpha');
    expect(row.site_id).toBe('site_alpha');
  });

  it('populates validator_version, collector_version, event_contract_version from config', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.validator_version).toBe('v-test-0.1');
    expect(row.collector_version).toBe('c-test-0.1');
    expect(row.event_contract_version).toBe('event-contract-v0.1');
  });

  it('populates schema_key, schema_version, id_format, event_origin, event_type, event_name from validated', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.schema_key).toBe('br.page');
    expect(row.schema_version).toBe('1.0.0');
    expect(row.id_format).toBe('uuidv4');
    expect(row.event_origin).toBe('browser');
    expect(row.event_type).toBe('page');
    expect(row.client_event_id).toBe(validatedBrowser.client_event_id);
  });

  it('uses validated.occurred_at for client_timestamp_ms (legacy column)', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.client_timestamp_ms).toBe(validatedBrowser.occurred_at.getTime());
  });

  it('computes ip_hash via PR#5a ipHash (workspace-salted)', () => {
    const row = buildAcceptedEventRow(baseArgs);
    expect(row.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    // Different workspace → different hash for same IP
    const otherRow = buildAcceptedEventRow({
      ...baseArgs,
      resolved: { workspace_id: 'ws_beta', site_id: 'site_alpha' },
    });
    expect(row.ip_hash).not.toBe(otherRow.ip_hash);
  });

  it('size_bytes uses stableStringify (key-order-independent)', () => {
    const a = buildAcceptedEventRow({
      ...baseArgs,
      raw_event: { ...rawBrowserEvent, properties: { z: 1, a: 2 } },
    });
    const b = buildAcceptedEventRow({
      ...baseArgs,
      raw_event: { ...rawBrowserEvent, properties: { a: 2, z: 1 } },
    });
    expect(a.size_bytes).toBe(b.size_bytes);
  });

  it('throws TypeError when ctx.ip is missing', () => {
    expect(() =>
      buildAcceptedEventRow({
        ...baseArgs,
        ctx: { ...baseCtx, ip: null },
      }),
    ).toThrow(TypeError);
  });

  describe('legacy NOT NULL compatibility shims', () => {
    it('uses validated.session_id when present', () => {
      const row = buildAcceptedEventRow(baseArgs);
      expect(row.session_id).toBe('sess_alpha');
    });

    it('falls back to LEGACY_SESSION_ID_SENTINEL when validated.session_id is null', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        validated: validatedServer,
      });
      expect(row.session_id).toBe(LEGACY_SESSION_ID_SENTINEL);
      expect(LEGACY_SESSION_ID_SENTINEL).toBe('__server__');
    });

    it('uses raw_event.anonymous_id for browser_id when present', () => {
      const row = buildAcceptedEventRow(baseArgs);
      expect(row.browser_id).toBe('a_alpha');
    });

    it('falls back to LEGACY_BROWSER_ID_SENTINEL when anonymous_id is missing', () => {
      // Build raw_event WITHOUT anonymous_id (key absent, not undefined — stableStringify
      // rejects undefined values; the realistic missing-field shape is a missing key).
      const { anonymous_id: _omitAnonymousId, ...rawWithoutAnonymous } = rawBrowserEvent;
      void _omitAnonymousId;
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: rawWithoutAnonymous,
      });
      expect(row.browser_id).toBe(LEGACY_BROWSER_ID_SENTINEL);
    });

    it('derives hostname from page_url when raw_event.hostname is missing', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: { ...rawBrowserEvent, page_url: 'https://shop.example.com/p' },
      });
      expect(row.hostname).toBe('shop.example.com');
    });

    it('falls back to LEGACY_HOSTNAME_SENTINEL when neither hostname nor page_url is present', () => {
      // Build raw_event WITHOUT hostname and page_url (keys absent, not undefined —
      // stableStringify rejects undefined values).
      const {
        hostname: _omitHost,
        page_url: _omitPageUrl,
        ...rawWithoutHostOrUrl
      } = rawBrowserEvent;
      void _omitHost;
      void _omitPageUrl;
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: rawWithoutHostOrUrl,
      });
      expect(row.hostname).toBe(LEGACY_HOSTNAME_SENTINEL);
      expect(LEGACY_HOSTNAME_SENTINEL).toBe('__unknown_host__');
    });

    it('prefers explicit raw_event.hostname over page_url', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: { ...rawBrowserEvent, hostname: 'explicit.example.com' },
      });
      expect(row.hostname).toBe('explicit.example.com');
    });
  });

  describe('optional date fields', () => {
    it('parses consent_updated_at, session_started_at, session_last_seen_at to Date', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: {
          ...rawBrowserEvent,
          consent_updated_at: '2026-05-10T11:50:00Z',
          session_started_at: '2026-05-10T11:55:00Z',
          session_last_seen_at: '2026-05-10T11:59:55Z',
        },
      });
      expect(row.consent_updated_at).toBeInstanceOf(Date);
      expect(row.session_started_at).toBeInstanceOf(Date);
      expect(row.session_last_seen_at).toBeInstanceOf(Date);
    });

    it('emits null on missing optional dates', () => {
      const row = buildAcceptedEventRow(baseArgs);
      expect(row.consent_updated_at).toBeNull();
      expect(row.session_started_at).toBeNull();
      expect(row.session_last_seen_at).toBeNull();
    });
  });

  describe('missing-evidence policy (consent / tracking / storage fields)', () => {
    // Build a raw_event WITHOUT the consent/tracking/storage fields. Use
    // destructuring-omit because spread+undefined leaves explicit undefined
    // keys that stableStringify rejects.
    const {
      consent_state: _omitCs,
      consent_source: _omitCsrc,
      tracking_mode: _omitTm,
      storage_mechanism: _omitSm,
      ...rawWithoutConsent
    } = rawBrowserEvent;
    void _omitCs;
    void _omitCsrc;
    void _omitTm;
    void _omitSm;

    it('emits consent_state = null when SDK did not supply it (no invented "unknown")', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: rawWithoutConsent,
      });
      expect(row.consent_state).toBeNull();
    });

    it('emits consent_source = null when SDK did not supply it (no invented "inferred")', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: rawWithoutConsent,
      });
      expect(row.consent_source).toBeNull();
    });

    it('emits tracking_mode = null when SDK did not supply it (no invented "full")', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: rawWithoutConsent,
      });
      expect(row.tracking_mode).toBeNull();
    });

    it('emits storage_mechanism = null when SDK did not supply it (no invented "none")', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: rawWithoutConsent,
      });
      expect(row.storage_mechanism).toBeNull();
    });

    it('emits pre_consent_mode = null when SDK did not supply it (no invented false)', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: rawWithoutConsent,
      });
      expect(row.pre_consent_mode).toBeNull();
    });

    it('supplied consent_state passes through unchanged', () => {
      const row = buildAcceptedEventRow(baseArgs);
      expect(row.consent_state).toBe('granted');
    });

    it('supplied consent_source passes through unchanged', () => {
      const row = buildAcceptedEventRow(baseArgs);
      expect(row.consent_source).toBe('cmp');
    });

    it('supplied tracking_mode passes through unchanged', () => {
      const row = buildAcceptedEventRow(baseArgs);
      expect(row.tracking_mode).toBe('full');
    });

    it('supplied storage_mechanism passes through unchanged', () => {
      const row = buildAcceptedEventRow(baseArgs);
      expect(row.storage_mechanism).toBe('cookie');
    });

    it('supplied pre_consent_mode = false passes through unchanged (not converted to null)', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: { ...rawBrowserEvent, pre_consent_mode: false },
      });
      expect(row.pre_consent_mode).toBe(false);
    });

    it('supplied pre_consent_mode = true passes through unchanged', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: { ...rawBrowserEvent, pre_consent_mode: true },
      });
      expect(row.pre_consent_mode).toBe(true);
    });

    it('non-string consent_state value (number) records null (defensive type-narrowing)', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: { ...rawBrowserEvent, consent_state: 12345 },
      });
      expect(row.consent_state).toBeNull();
    });

    it('non-boolean pre_consent_mode value (string) records null (defensive type-narrowing)', () => {
      const row = buildAcceptedEventRow({
        ...baseArgs,
        raw_event: { ...rawBrowserEvent, pre_consent_mode: 'truthy' },
      });
      expect(row.pre_consent_mode).toBeNull();
    });
  });
});

// ===========================================================================
// buildRejectedEventRow
// ===========================================================================

describe('buildRejectedEventRow — real body', () => {
  const baseArgs = {
    ctx: baseCtx,
    resolved: baseResolved,
    raw_event: rawBrowserEvent,
    reason_code: 'client_event_id_invalid' as const,
    rejected_stage: 'validation' as const,
    reason_detail: 'malformed UUID',
    schema_errors_jsonb: null,
    pii_hits_jsonb: null,
    best_effort: {
      client_event_id: null,
      id_format: null,
      event_name: 'page_view',
      event_type: 'page',
      schema_key: 'br.page',
      schema_version: '1.0.0',
    },
    config: { collector_version: 'c-test-0.1' },
  };

  it('computes raw_payload_sha256 via payloadSha256(raw_event)', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.raw_payload_sha256).toBe(payloadSha256(rawBrowserEvent));
    expect(row.raw_payload_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('NEVER falls back to sha256Hex("") on hash failure (errors propagate)', () => {
    // Construct a raw_event with an unsupported value to trigger stableStringify throw.
    const badRawEvent: Record<string, unknown> = { x: undefined };
    expect(() =>
      buildRejectedEventRow({ ...baseArgs, raw_event: badRawEvent }),
    ).toThrow(TypeError);
  });

  it('dual-writes reason_codes: [reason_code] (PR#3 transition)', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.reason_codes).toEqual(['client_event_id_invalid']);
    expect(row.reason_code).toBe('client_event_id_invalid');
  });

  it('populates rejected_stage and reason_detail from args', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.rejected_stage).toBe('validation');
    expect(row.reason_detail).toBe('malformed UUID');
  });

  it('debug_mode is always false; sample_visible_to_admin is true by default', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.debug_mode).toBe(false);
    expect(row.sample_visible_to_admin).toBe(true);
  });

  it('rejected_at and received_at come from ctx.received_at', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.rejected_at).toBe(baseCtx.received_at);
    expect(row.received_at).toBe(baseCtx.received_at);
  });

  it('size_bytes uses stableStringify (deterministic)', () => {
    const a = buildRejectedEventRow({
      ...baseArgs,
      raw_event: { ...rawBrowserEvent, properties: { z: 1, a: 2 } },
    });
    const b = buildRejectedEventRow({
      ...baseArgs,
      raw_event: { ...rawBrowserEvent, properties: { a: 2, z: 1 } },
    });
    expect(a.size_bytes).toBe(b.size_bytes);
  });

  it('best-effort fields propagate when validation partially extracted them', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.event_name).toBe('page_view');
    expect(row.event_type).toBe('page');
    expect(row.schema_key).toBe('br.page');
    expect(row.schema_version).toBe('1.0.0');
    expect(row.client_event_id).toBeNull();
    expect(row.id_format).toBeNull();
  });

  it('site_id and workspace_id null when resolved is null', () => {
    const row = buildRejectedEventRow({ ...baseArgs, resolved: null });
    expect(row.site_id).toBeNull();
    expect(row.workspace_id).toBeNull();
  });

  it('site_id and workspace_id populated when resolved is present', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.site_id).toBe('site_alpha');
    expect(row.workspace_id).toBe('ws_alpha');
  });

  it('request_id propagates from ctx', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.request_id).toBe(baseCtx.request_id);
  });

  it('stores raw_event verbatim in the legacy raw column', () => {
    const row = buildRejectedEventRow(baseArgs);
    expect(row.raw).toBe(rawBrowserEvent);
  });

  describe('non-object event fragments (PR#5c-2 type widening)', () => {
    // PR#5c-2 widened BuildRejectedEventRowArgs.raw_event from
    // Record<string, unknown> to unknown so the orchestrator can record
    // non-object /v1/batch fragments verbatim. No sentinel wrapping.

    const fragmentArgs = (raw_event: unknown) => ({
      ...baseArgs,
      raw_event,
      reason_code: 'missing_required_field' as const,
      rejected_stage: 'validation' as const,
      best_effort: {
        client_event_id: null,
        id_format: null,
        event_name: null,
        event_type: null,
        schema_key: null,
        schema_version: null,
      },
    });

    it('accepts a number fragment (raw_event = 42)', () => {
      const fragment = 42;
      const row = buildRejectedEventRow(fragmentArgs(fragment));
      expect(row.raw).toBe(fragment);
      expect(row.raw_payload_sha256).toBe(payloadSha256(fragment));
      expect(row.size_bytes).toBe(Buffer.byteLength(stableStringify(fragment), 'utf8'));
    });

    it('accepts a null fragment (raw_event = null)', () => {
      const fragment = null;
      const row = buildRejectedEventRow(fragmentArgs(fragment));
      expect(row.raw).toBeNull();
      expect(row.raw_payload_sha256).toBe(payloadSha256(fragment));
      expect(row.size_bytes).toBe(Buffer.byteLength(stableStringify(fragment), 'utf8'));
    });

    it('accepts a string fragment (raw_event = "free-text-fragment")', () => {
      const fragment = 'free-text-fragment';
      const row = buildRejectedEventRow(fragmentArgs(fragment));
      expect(row.raw).toBe(fragment);
      expect(row.raw_payload_sha256).toBe(payloadSha256(fragment));
      expect(row.size_bytes).toBe(Buffer.byteLength(stableStringify(fragment), 'utf8'));
    });

    it('accepts an array fragment (raw_event = [1, 2, 3])', () => {
      const fragment = [1, 2, 3];
      const row = buildRejectedEventRow(fragmentArgs(fragment));
      expect(row.raw).toBe(fragment);
      expect(row.raw_payload_sha256).toBe(payloadSha256(fragment));
      expect(row.size_bytes).toBe(Buffer.byteLength(stableStringify(fragment), 'utf8'));
    });

    it('does NOT produce an empty-hash fallback for non-object fragments', () => {
      const emptyStringHash = sha256Hex('');
      for (const fragment of [42, null, 'x', [1, 2, 3]]) {
        const row = buildRejectedEventRow(fragmentArgs(fragment));
        expect(row.raw_payload_sha256).not.toBe(emptyStringHash);
        expect(row.raw_payload_sha256).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('non-object fragments do NOT get silently wrapped into a sentinel object', () => {
      // Wrapped sentinel would change the hash to payloadSha256({...wrapper, fragment}).
      // We explicitly compare against the unwrapped value's hash.
      const fragment = 42;
      const row = buildRejectedEventRow(fragmentArgs(fragment));
      const wrappedHashIfBuggy = payloadSha256({ _non_object: fragment });
      expect(row.raw_payload_sha256).not.toBe(wrappedHashIfBuggy);
      expect(row.raw_payload_sha256).toBe(payloadSha256(fragment));
    });
  });
});

// ===========================================================================
// row-builders.ts — import discipline (Track B only)
// ===========================================================================

describe('row-builders.ts — import discipline (Track B only)', () => {
  it('imports only PR#5a / PR#5b helpers via relative paths', () => {
    const importStatements = ROW_BUILDERS_SRC.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBeGreaterThan(0);
    for (const stmt of importStatements) {
      expect(stmt).toMatch(/from\s+['"]\.\/[a-z-]+\.js['"]/);
    }
  });

  it('does NOT import a DB driver / express / pino / env', () => {
    expect(ROW_BUILDERS_SRC).not.toMatch(/from\s+['"]pg['"]/);
    expect(ROW_BUILDERS_SRC).not.toMatch(/from\s+['"]express['"]/);
    expect(ROW_BUILDERS_SRC).not.toMatch(/from\s+['"]pino['"]/);
    expect(ROW_BUILDERS_SRC).not.toMatch(/process\.env\./);
  });

  it('does NOT reference Track A or Core AMS paths', () => {
    expect(ROW_BUILDERS_SRC).not.toMatch(/ams-qa-behaviour-tests/);
    expect(ROW_BUILDERS_SRC).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT introduce scoring symbols as identifiers', () => {
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|is_bot|is_agent)\s*[:=(]/;
    expect(ROW_BUILDERS_SRC).not.toMatch(forbidden);
  });

  it('does NOT register any HTTP route handler or middleware', () => {
    expect(ROW_BUILDERS_SRC).not.toMatch(/\bRouter\s*\(/);
    expect(ROW_BUILDERS_SRC).not.toMatch(/\b(?:app|router)\.(?:get|post|put|delete|patch|use|listen)\s*\(/);
  });

  it('does NOT hash canonical_jsonb (critical §2.5 contract)', () => {
    // The literal pattern would be payloadSha256(canonical*) or payloadSha256(...canonical_jsonb...).
    expect(ROW_BUILDERS_SRC).not.toMatch(/payloadSha256\s*\(\s*[a-zA-Z_]*[Cc]anonical/);
  });

  it('does NOT call Date.now or generate accepted_at internally', () => {
    expect(ROW_BUILDERS_SRC).not.toMatch(/\bDate\.now\s*\(/);
    expect(ROW_BUILDERS_SRC).not.toMatch(/\baccepted_at\s*[:=]\s*new Date/);
  });
});

// ===========================================================================
// index.ts barrel discipline — must remain at 4 PR#5a re-exports
// ===========================================================================

describe('index.ts barrel — PR#5a discipline preserved', () => {
  it('still re-exports exactly the four PR#5a sub-modules', () => {
    const reExports = INDEX_SRC.match(/^export \* from ['"]\.\/[a-z-]+\.js['"];$/gm) ?? [];
    expect(reExports.length).toBe(4);
    const reExportTargets = reExports
      .map(line => line.match(/\.\/([a-z-]+)\.js/)?.[1])
      .filter((s): s is string => typeof s === 'string')
      .sort();
    expect(reExportTargets).toEqual(['hash', 'reason-codes', 'row-builders', 'types']);
  });

  it('still exports VALIDATOR_VERSION', () => {
    expect(v1.VALIDATOR_VERSION).toBe('buyerrecon-v1-validator-0.1');
  });

  it('still re-exports the row-builder functions via the barrel', () => {
    expect(typeof v1.buildIngestRequestRow).toBe('function');
    expect(typeof v1.buildAcceptedEventRow).toBe('function');
    expect(typeof v1.buildRejectedEventRow).toBe('function');
  });
});
