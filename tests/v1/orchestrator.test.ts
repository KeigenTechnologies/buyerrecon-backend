/**
 * Sprint 1 PR#5c-2 — v1 collector orchestrator (runRequest) tests.
 *
 * Pure unit tests. No DB / env / network. Auth is fully injected (no
 * resolveSiteWriteToken call, no lookupByHash). Deterministic clock via
 * config.now_ms.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runRequest, type CollectorConfig, type RunRequestInput } from '../../src/collector/v1/orchestrator.js';
import { sha256Hex } from '../../src/collector/v1/hash.js';
import { payloadSha256 } from '../../src/collector/v1/payload-hash.js';
import { stableStringify } from '../../src/collector/v1/stable-json.js';
import * as v1 from '../../src/collector/v1/index.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'orchestrator.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');
const INDEX_SRC = readFileSync(
  join(__dirname, '..', '..', 'src', 'collector', 'v1', 'index.ts'),
  'utf8',
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PEPPER = '0'.repeat(64);
const NOW_MS = new Date('2026-05-10T12:00:00.000Z').getTime();

const baseConfig: CollectorConfig = {
  collector_version: 'c-test-0.1',
  validator_version: 'v-test-0.1',
  event_contract_version: 'event-contract-v0.1',
  ip_hash_pepper: PEPPER,
  allow_consent_state_summary: false,
  now_ms: NOW_MS,
};

const baseResolved = { workspace_id: 'ws_alpha', site_id: 'site_alpha' };

const validBrowserEvent: Record<string, unknown> = {
  client_event_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  event_name: 'page_view',
  event_type: 'page',
  event_origin: 'browser',
  schema_key: 'br.page',
  schema_version: '1.0.0',
  occurred_at: '2026-05-10T11:59:59Z',
  session_id: 'sess_alpha',
  anonymous_id: 'a_alpha',
  page_url: 'https://example.com/p',
  page_path: '/p',
  consent_state: 'granted',
  consent_source: 'cmp',
  tracking_mode: 'full',
  storage_mechanism: 'cookie',
};

function makeCtx(
  overrides: Partial<{
    endpoint: '/v1/event' | '/v1/batch';
    content_type: string | null;
    ip: string | null;
    raw_body_bytes: Buffer;
  }> = {},
) {
  const endpoint = overrides.endpoint ?? '/v1/event';
  const rawBodyBytes =
    overrides.raw_body_bytes ??
    Buffer.from(
      JSON.stringify(endpoint === '/v1/event' ? validBrowserEvent : { events: [validBrowserEvent] }),
      'utf8',
    );
  return {
    request_id: '00000000-0000-0000-0000-000000000001',
    received_at: new Date(NOW_MS),
    endpoint,
    method: 'POST',
    content_type: overrides.content_type ?? 'application/json',
    user_agent: 'test-ua',
    ip: overrides.ip === undefined ? '192.0.2.1' : overrides.ip,
    auth_header: 'Bearer test',
    raw_body_bytes: rawBodyBytes,
  };
}

function makeInput(
  overrides: Partial<RunRequestInput> = {},
  ctxOverrides: Parameters<typeof makeCtx>[0] = {},
): RunRequestInput {
  return {
    ctx: makeCtx(ctxOverrides),
    auth: { status: 'ok', resolved: baseResolved, reason_code: null },
    config: baseConfig,
    ...overrides,
  };
}

// ===========================================================================
// 1. Request-level rejection paths
// ===========================================================================

describe('runRequest — request-level rejection (auth + envelope)', () => {
  it('auth invalid → ingest row only, http 401, no event rows', () => {
    const out = runRequest(
      makeInput({
        auth: { status: 'invalid_token', resolved: null, reason_code: 'auth_invalid' },
      }),
    );
    expect(out.accepted).toEqual([]);
    expect(out.rejected).toEqual([]);
    expect(out.response.results).toEqual([]);
    expect(out.response.expected_event_count).toBe(0);
    expect(out.http_status).toBe(401);
    expect(out.ingest_request.auth_status).toBe('invalid_token');
    expect(out.ingest_request.reject_reason_code).toBe('auth_invalid');
    expect(out.ingest_request.workspace_id).toBeNull();
    expect(out.ingest_request.site_id).toBeNull();
    expect(out.ingest_request.reconciled_at).toEqual(out.ingest_request.received_at);
  });

  it('site disabled → ingest row only, http 403, no event rows', () => {
    const out = runRequest(
      makeInput({
        auth: { status: 'site_disabled', resolved: null, reason_code: 'auth_site_disabled' },
      }),
    );
    expect(out.http_status).toBe(403);
    expect(out.accepted).toEqual([]);
    expect(out.rejected).toEqual([]);
    expect(out.ingest_request.auth_status).toBe('site_disabled');
    expect(out.ingest_request.reject_reason_code).toBe('auth_site_disabled');
  });

  it('boundary_mismatch at auth level → http 403, no event rows', () => {
    const out = runRequest(
      makeInput({
        auth: {
          status: 'boundary_mismatch',
          resolved: null,
          reason_code: 'workspace_site_mismatch',
        },
      }),
    );
    expect(out.http_status).toBe(403);
    expect(out.ingest_request.auth_status).toBe('boundary_mismatch');
  });

  it('invalid content-type → ingest row only, http 415, no event rows', () => {
    const out = runRequest(
      makeInput({}, { content_type: 'text/plain' }),
    );
    expect(out.http_status).toBe(415);
    expect(out.accepted).toEqual([]);
    expect(out.rejected).toEqual([]);
    expect(out.ingest_request.reject_reason_code).toBe('content_type_invalid');
    expect(out.ingest_request.auth_status).toBe('ok');
    expect(out.ingest_request.workspace_id).toBe('ws_alpha');
    expect(out.ingest_request.site_id).toBe('site_alpha');
  });

  it('malformed JSON → ingest row only, http 400, no event rows', () => {
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from('{not json', 'utf8') }),
    );
    expect(out.http_status).toBe(400);
    expect(out.ingest_request.reject_reason_code).toBe('request_body_invalid_json');
    expect(out.accepted).toEqual([]);
    expect(out.rejected).toEqual([]);
  });

  it('batch too large → ingest row only, http 413, no event rows', () => {
    const tooBig = Buffer.alloc(513 * 1024, 0x20);
    const out = runRequest(
      makeInput({}, { endpoint: '/v1/batch', raw_body_bytes: tooBig }),
    );
    expect(out.http_status).toBe(413);
    expect(out.ingest_request.reject_reason_code).toBe('batch_too_large');
    expect(out.accepted).toEqual([]);
    expect(out.rejected).toEqual([]);
  });

  it('/v1/event body too large → http 413, request_too_large', () => {
    const tooBig = Buffer.alloc(33 * 1024, 0x20);
    const out = runRequest(
      makeInput({}, { endpoint: '/v1/event', raw_body_bytes: tooBig }),
    );
    expect(out.http_status).toBe(413);
    expect(out.ingest_request.reject_reason_code).toBe('request_too_large');
  });

  it('batch_item_count_exceeded → http 413', () => {
    const events = Array.from({ length: 101 }, () => validBrowserEvent);
    const out = runRequest(
      makeInput(
        {},
        {
          endpoint: '/v1/batch',
          raw_body_bytes: Buffer.from(JSON.stringify({ events }), 'utf8'),
        },
      ),
    );
    expect(out.http_status).toBe(413);
    expect(out.ingest_request.reject_reason_code).toBe('batch_item_count_exceeded');
  });

  it('missing ctx.ip → TypeError (no fake IP fallback)', () => {
    expect(() => runRequest(makeInput({}, { ip: null }))).toThrow(TypeError);
  });

  it('missing ctx.ip throws even on auth-reject path (no fake IP)', () => {
    expect(() =>
      runRequest(
        makeInput(
          {
            auth: { status: 'invalid_token', resolved: null, reason_code: 'auth_invalid' },
          },
          { ip: null },
        ),
      ),
    ).toThrow(TypeError);
  });

  it('throws TypeError when auth.status="ok" but auth.resolved=null (contract violation)', () => {
    expect(() =>
      runRequest({
        ctx: makeCtx(),
        auth: { status: 'ok', resolved: null, reason_code: null },
        config: baseConfig,
      }),
    ).toThrow(TypeError);
  });
});

// ===========================================================================
// 2. Single valid event
// ===========================================================================

describe('runRequest — single valid /v1/event', () => {
  it('produces 1 accepted row, 0 rejected, http 200', () => {
    const out = runRequest(makeInput());
    expect(out.accepted.length).toBe(1);
    expect(out.rejected.length).toBe(0);
    expect(out.http_status).toBe(200);
    expect(out.response.expected_event_count).toBe(1);
    expect(out.response.accepted_count).toBe(1);
    expect(out.response.rejected_count).toBe(0);
    expect(out.response.results.length).toBe(1);
    expect(out.response.results[0]!.status).toBe('accepted');
  });

  it('accepted row carries payload_sha256 and canonical_jsonb as SEPARATE values', () => {
    const out = runRequest(makeInput());
    const row = out.accepted[0]!;
    expect(row.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.canonical_jsonb).toBeTypeOf('object');
    // Critical §2.5 invariant
    expect(row.payload_sha256).not.toBe(payloadSha256(row.canonical_jsonb));
  });

  it('canonical_jsonb has exactly 19 keys (Decision D3)', () => {
    const out = runRequest(makeInput());
    const row = out.accepted[0]!;
    expect(Object.keys(row.canonical_jsonb).length).toBe(19);
  });

  it('request_id is shared across ingest_request / accepted[0] / response', () => {
    const out = runRequest(makeInput());
    const ctx = makeCtx();
    expect(out.ingest_request.request_id).toBe(ctx.request_id);
    expect(out.accepted[0]!.request_id).toBe(ctx.request_id);
    expect(out.response.request_id).toBe(ctx.request_id);
  });

  it('ingest_request.request_body_sha256 = sha256Hex(raw_body_bytes)', () => {
    const input = makeInput();
    const out = runRequest(input);
    expect(out.ingest_request.request_body_sha256).toBe(sha256Hex(input.ctx.raw_body_bytes));
  });

  it('reconciled_at uses config.now_ms when supplied', () => {
    const out = runRequest(makeInput());
    expect(out.ingest_request.reconciled_at?.getTime()).toBe(NOW_MS);
  });

  it("traffic_class is always 'unknown' on accepted rows", () => {
    const out = runRequest(makeInput());
    expect(out.accepted[0]!.traffic_class).toBe('unknown');
  });

  it('debug_mode is always false on accepted rows', () => {
    const out = runRequest(makeInput());
    expect(out.accepted[0]!.debug_mode).toBe(false);
  });
});

// ===========================================================================
// 3. Batch — order, mixed, all-rejected, empty
// ===========================================================================

describe('runRequest — /v1/batch', () => {
  const makeBatchBody = (events: unknown[]): Buffer =>
    Buffer.from(JSON.stringify({ events }), 'utf8');

  it('valid batch → accepted rows in input order', () => {
    const e0 = { ...validBrowserEvent, client_event_id: 'f47ac10b-58cc-4372-a567-000000000001' };
    const e1 = { ...validBrowserEvent, client_event_id: 'f47ac10b-58cc-4372-a567-000000000002' };
    const e2 = { ...validBrowserEvent, client_event_id: 'f47ac10b-58cc-4372-a567-000000000003' };
    const out = runRequest(
      makeInput({}, { endpoint: '/v1/batch', raw_body_bytes: makeBatchBody([e0, e1, e2]) }),
    );
    expect(out.accepted.length).toBe(3);
    expect(out.rejected.length).toBe(0);
    expect(out.response.results.map(r => r.client_event_id)).toEqual([
      e0.client_event_id,
      e1.client_event_id,
      e2.client_event_id,
    ]);
    expect(out.http_status).toBe(200);
  });

  it('mixed batch → accepted + rejected, response.results preserves input order', () => {
    const valid0 = { ...validBrowserEvent, client_event_id: 'f47ac10b-58cc-4372-a567-000000000001' };
    const invalid = { ...validBrowserEvent, client_event_id: 'not-a-uuid' };
    const valid2 = { ...validBrowserEvent, client_event_id: 'f47ac10b-58cc-4372-a567-000000000003' };
    const out = runRequest(
      makeInput({}, { endpoint: '/v1/batch', raw_body_bytes: makeBatchBody([valid0, invalid, valid2]) }),
    );
    expect(out.accepted.length).toBe(2);
    expect(out.rejected.length).toBe(1);
    expect(out.response.results.length).toBe(3);
    expect(out.response.results[0]!.status).toBe('accepted');
    expect(out.response.results[1]!.status).toBe('rejected');
    expect(out.response.results[1]!.reason_code).toBe('client_event_id_invalid');
    expect(out.response.results[2]!.status).toBe('accepted');
    expect(out.http_status).toBe(200);
  });

  it('all parseable events rejected → http 200, rejected rows, no accepted rows', () => {
    const bad0 = { ...validBrowserEvent, client_event_id: 'not-a-uuid' };
    const bad1 = { ...validBrowserEvent, client_event_id: 'also-not-a-uuid' };
    const out = runRequest(
      makeInput({}, { endpoint: '/v1/batch', raw_body_bytes: makeBatchBody([bad0, bad1]) }),
    );
    expect(out.accepted.length).toBe(0);
    expect(out.rejected.length).toBe(2);
    expect(out.http_status).toBe(200);
  });

  it('empty batch → http 200, expected_event_count 0, no event rows', () => {
    const out = runRequest(
      makeInput({}, { endpoint: '/v1/batch', raw_body_bytes: makeBatchBody([]) }),
    );
    expect(out.accepted.length).toBe(0);
    expect(out.rejected.length).toBe(0);
    expect(out.response.expected_event_count).toBe(0);
    expect(out.response.results.length).toBe(0);
    expect(out.http_status).toBe(200);
  });

  it('non-object fragment (number) in batch → rejected with missing_required_field', () => {
    const out = runRequest(
      makeInput(
        {},
        { endpoint: '/v1/batch', raw_body_bytes: makeBatchBody([validBrowserEvent, 42]) },
      ),
    );
    expect(out.accepted.length).toBe(1);
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.reason_code).toBe('missing_required_field');
    expect(out.rejected[0]!.raw).toBe(42);
    // raw_payload_sha256 hashes the actual fragment, not a wrapper
    expect(out.rejected[0]!.raw_payload_sha256).toBe(payloadSha256(42));
  });

  it('non-object fragment (null) in batch → rejected with missing_required_field', () => {
    const out = runRequest(
      makeInput(
        {},
        { endpoint: '/v1/batch', raw_body_bytes: makeBatchBody([null]) },
      ),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.raw).toBeNull();
    expect(out.rejected[0]!.raw_payload_sha256).toBe(payloadSha256(null));
  });

  it('non-object fragment (array) in batch → rejected with missing_required_field', () => {
    const out = runRequest(
      makeInput(
        {},
        { endpoint: '/v1/batch', raw_body_bytes: makeBatchBody([[1, 2, 3]]) },
      ),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.raw).toEqual([1, 2, 3]);
    expect(out.rejected[0]!.raw_payload_sha256).toBe(payloadSha256([1, 2, 3]));
  });

  it('non-object fragment (string) in batch → rejected with missing_required_field', () => {
    const out = runRequest(
      makeInput(
        {},
        { endpoint: '/v1/batch', raw_body_bytes: makeBatchBody(['oops']) },
      ),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.raw).toBe('oops');
    expect(out.rejected[0]!.raw_payload_sha256).toBe(payloadSha256('oops'));
  });
});

// ===========================================================================
// 4. Event-level rejection paths
// ===========================================================================

describe('runRequest — event-level rejection paths', () => {
  it('validation failure → rejected_stage = validation', () => {
    const event = { ...validBrowserEvent, client_event_id: 'not-a-uuid' };
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.reason_code).toBe('client_event_id_invalid');
    expect(out.rejected[0]!.rejected_stage).toBe('validation');
  });

  it('PII detected → rejected_stage = pii, pii_hits_jsonb populated', () => {
    const event = {
      ...validBrowserEvent,
      properties: { contact: 'alice@example.com' },
    };
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.reason_code).toBe('pii_email_detected');
    expect(out.rejected[0]!.rejected_stage).toBe('pii');
    expect(out.rejected[0]!.pii_hits_jsonb).not.toBeNull();
    expect(out.rejected[0]!.pii_hits_jsonb!.hits).toBeInstanceOf(Array);
  });

  it('consent_denied (behavioural page) → rejected_stage = validation', () => {
    const event = { ...validBrowserEvent, consent_state: 'denied' };
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.reason_code).toBe('consent_denied');
    expect(out.rejected[0]!.rejected_stage).toBe('validation');
  });

  it('boundary mismatch (payload site_id ≠ resolved) → rejected_stage = boundary', () => {
    const event = { ...validBrowserEvent, site_id: 'site_attacker' };
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.reason_code).toBe('workspace_site_mismatch');
    expect(out.rejected[0]!.rejected_stage).toBe('boundary');
  });

  it('intra-batch duplicate → first accepted, second rejected with duplicate_client_event_id', () => {
    const e0 = validBrowserEvent;
    const e1Same = { ...validBrowserEvent };
    const e2Different = { ...validBrowserEvent, client_event_id: 'f47ac10b-58cc-4372-a567-000000000099' };
    const body = Buffer.from(JSON.stringify({ events: [e0, e1Same, e2Different] }), 'utf8');
    const out = runRequest(
      makeInput({}, { endpoint: '/v1/batch', raw_body_bytes: body }),
    );
    expect(out.accepted.length).toBe(2);
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.reason_code).toBe('duplicate_client_event_id');
    expect(out.rejected[0]!.rejected_stage).toBe('dedupe');
    // Response order: [accepted, rejected, accepted]
    expect(out.response.results.map(r => r.status)).toEqual(['accepted', 'rejected', 'accepted']);
  });
});

// ===========================================================================
// 5. consent_state_summary — PR#5b-2 deny-by-default preserved
// ===========================================================================

describe('runRequest — consent_state_summary handling (PR#5b-2 regression)', () => {
  const summaryEvent: Record<string, unknown> = {
    client_event_id: 'f47ac10b-58cc-4372-a567-000000000001',
    event_name: 'consent_state_summary',
    event_type: 'system',
    event_origin: 'system',
    schema_key: 'br.system',
    schema_version: '1.0.0',
    occurred_at: '2026-05-10T11:59:59Z',
    consent_state: 'denied',
    tracking_mode: 'disabled',
    storage_mechanism: 'memory',
  };

  it('consent_state_summary by default (allow=false) → rejected with consent_denied', () => {
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(summaryEvent), 'utf8') }),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.reason_code).toBe('consent_denied');
    expect(out.accepted.length).toBe(0);
  });

  it('consent_state_summary accepted when allow=true + strict shape + clean', () => {
    const out = runRequest(
      makeInput({
        config: { ...baseConfig, allow_consent_state_summary: true },
      }, { raw_body_bytes: Buffer.from(JSON.stringify(summaryEvent), 'utf8') }),
    );
    expect(out.accepted.length).toBe(1);
    expect(out.rejected.length).toBe(0);
  });

  it('consent_state_summary with forbidden field (anonymous_id) → rejected even with allow=true', () => {
    const event = { ...summaryEvent, anonymous_id: 'leaked' };
    const out = runRequest(
      makeInput({
        config: { ...baseConfig, allow_consent_state_summary: true },
      }, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    expect(out.rejected.length).toBe(1);
    expect(out.rejected[0]!.reason_code).toBe('consent_denied');
  });

  it('denied non-summary system event passes the consent gate (PR#5b-2 contract preserved)', () => {
    // event_origin=system, event_type=system, event_name='heartbeat' (not consent_state_summary).
    // Consent gate: denied + system non-summary → passes (downstream gates handle).
    // No forbidden boundary / PII / dedupe issues → ends up accepted.
    const event = {
      client_event_id: 'f47ac10b-58cc-4372-a567-000000000007',
      event_name: 'heartbeat',
      event_type: 'system',
      event_origin: 'system',
      schema_key: 'br.system',
      schema_version: '1.0.0',
      occurred_at: '2026-05-10T11:59:59Z',
      consent_state: 'denied',
    };
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    expect(out.accepted.length).toBe(1);
    expect(out.rejected.length).toBe(0);
  });
});

// ===========================================================================
// 6. Reconciliation invariants
// ===========================================================================

describe('runRequest — reconciliation invariants', () => {
  it('accepted_count + rejected_count === expected_event_count for parseable requests', () => {
    const e0 = { ...validBrowserEvent, client_event_id: 'f47ac10b-58cc-4372-a567-000000000001' };
    const e1 = { ...validBrowserEvent, client_event_id: 'not-a-uuid' };
    const e2 = { ...validBrowserEvent, client_event_id: 'f47ac10b-58cc-4372-a567-000000000003' };
    const out = runRequest(
      makeInput(
        {},
        {
          endpoint: '/v1/batch',
          raw_body_bytes: Buffer.from(JSON.stringify({ events: [e0, e1, e2] }), 'utf8'),
        },
      ),
    );
    expect(out.accepted.length + out.rejected.length).toBe(out.response.expected_event_count);
    expect(out.response.expected_event_count).toBe(3);
  });

  it('response.results.length === expected_event_count', () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      ...validBrowserEvent,
      client_event_id: `f47ac10b-58cc-4372-a567-00000000000${i}`,
    }));
    const out = runRequest(
      makeInput(
        {},
        {
          endpoint: '/v1/batch',
          raw_body_bytes: Buffer.from(JSON.stringify({ events }), 'utf8'),
        },
      ),
    );
    expect(out.response.results.length).toBe(out.response.expected_event_count);
  });

  it('every accepted row has request_id === ctx.request_id', () => {
    const out = runRequest(makeInput());
    const ctx = makeCtx();
    for (const row of out.accepted) {
      expect(row.request_id).toBe(ctx.request_id);
    }
  });

  it('every rejected row has request_id === ctx.request_id', () => {
    const event = { ...validBrowserEvent, client_event_id: 'not-a-uuid' };
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    const ctx = makeCtx();
    for (const row of out.rejected) {
      expect(row.request_id).toBe(ctx.request_id);
    }
  });

  it('ingest_request.expected_event_count / accepted_count / rejected_count reconcile', () => {
    const out = runRequest(makeInput());
    expect(out.ingest_request.expected_event_count).toBe(1);
    expect(out.ingest_request.accepted_count).toBe(1);
    expect(out.ingest_request.rejected_count).toBe(0);
  });

  it('rejected_events.raw_payload_sha256 hashes the actual fragment (not a wrapper)', () => {
    const event = { ...validBrowserEvent, client_event_id: 'not-a-uuid' };
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    // The rejected row's raw_payload_sha256 should hash the actual event object.
    // parseEnvelope gave us [event], and the row uses raw_event = event.
    const expectedHash = payloadSha256(event);
    expect(out.rejected[0]!.raw_payload_sha256).toBe(expectedHash);
  });
});

// ===========================================================================
// 7. Module-level scope discipline
// ===========================================================================

describe('orchestrator.ts — import discipline (Track B only)', () => {
  it('does NOT import DB / express / pino / env / Track A / Core AMS', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT register HTTP routes', () => {
    expect(source).not.toMatch(/\bRouter\s*\(/);
    expect(source).not.toMatch(/\b(?:app|router)\.(?:get|post|put|delete|patch|use|listen)\s*\(/);
  });

  it('does NOT execute SQL', () => {
    // Tightened to call-syntax / SQL-statement patterns so disclaimer prose
    // in JSDoc (e.g. "PR#7 will execute via `pool.query`") does not FP.
    expect(source).not.toMatch(/pool\.query\s*\(/);
    expect(source).not.toMatch(/\bINSERT\s+INTO\s+\w+/i);
    expect(source).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
    expect(source).not.toMatch(/\bSELECT\s+[\w*]+\s+FROM\b/i);
  });

  it('does NOT call resolveSiteWriteToken / hashSiteWriteToken / accept a lookupByHash callback', () => {
    expect(source).not.toMatch(/\bresolveSiteWriteToken\s*\(/);
    expect(source).not.toMatch(/\bhashSiteWriteToken\s*\(/);
    expect(source).not.toMatch(/\blookupByHash\b/);
  });

  it('does NOT hash canonical_jsonb (critical §2.5 contract)', () => {
    expect(source).not.toMatch(/payloadSha256\s*\(\s*[a-zA-Z_]*[Cc]anonical/);
  });

  it('does NOT introduce scoring symbols as identifiers', () => {
    const forbidden = /\b(risk_score|classification|recommended_action|behavioural_score|behavior_score|bot_score|agent_score|is_bot|is_agent)\s*[:=(]/;
    expect(source).not.toMatch(forbidden);
  });
});

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

  it('orchestrator is NOT re-exported via the barrel (separate import path)', () => {
    // The PR#5a barrel's own JSDoc legitimately mentions "orchestrator" in
    // prose ("...the orchestrator and row-builder bodies land in PR#5c..."),
    // so checking for the bare word would FP. Instead, verify there is no
    // `export * from './orchestrator.js'` re-export line.
    expect(INDEX_SRC).not.toMatch(/export\s+\*\s+from\s+['"]\.\/orchestrator\.js['"]/);
    expect(v1).not.toHaveProperty('runRequest');
  });
});

// ===========================================================================
// 8. Output shape correctness
// ===========================================================================

describe('runRequest — output shape', () => {
  it('OrchestratorOutput has the 5 expected top-level keys', () => {
    const out = runRequest(makeInput());
    expect(Object.keys(out).sort()).toEqual(['accepted', 'http_status', 'ingest_request', 'rejected', 'response']);
  });

  it('size_bytes for ingest_request matches raw_body_bytes.byteLength', () => {
    const input = makeInput();
    const out = runRequest(input);
    expect(out.ingest_request.size_bytes).toBe(input.ctx.raw_body_bytes.byteLength);
  });

  it('size_bytes for accepted row uses stableStringify (deterministic)', () => {
    const out = runRequest(makeInput());
    const row = out.accepted[0]!;
    // The accepted row's size_bytes is byteLength of stableStringify(raw_event).
    expect(row.size_bytes).toBe(Buffer.byteLength(stableStringify(validBrowserEvent), 'utf8'));
  });

  it('rejected result entries carry the best-effort client_event_id from the input event', () => {
    // event has a non-UUID client_event_id — best-effort still extracts it as a string.
    const event = { ...validBrowserEvent, client_event_id: 'not-a-uuid' };
    const out = runRequest(
      makeInput({}, { raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8') }),
    );
    expect(out.response.results[0]!.client_event_id).toBe('not-a-uuid');
  });

  it('accepted result entries carry validated.client_event_id', () => {
    const out = runRequest(makeInput());
    expect(out.response.results[0]!.client_event_id).toBe(validBrowserEvent.client_event_id);
    expect(out.response.results[0]!.reason_code).toBeNull();
  });
});
