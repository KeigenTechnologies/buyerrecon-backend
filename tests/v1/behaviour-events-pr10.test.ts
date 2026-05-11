/**
 * Sprint 1 PR#10 — RECORD_ONLY behaviour-event coverage (cta_click, form_start,
 * form_submit) end-to-end through the v1 collector pipeline.
 *
 * Track B evidence-write only. RECORD_ONLY. No scoring. No Track A. No Core
 * AMS. No bot / AI-agent identifiers. No PII. No schema migration. No DB.
 *
 * Why this file exists:
 *   The v1 collector's validator / orchestrator / row-builders / canonical
 *   projection are already event-name agnostic and schema-key agnostic.
 *   Browser-origin `event_type='track'` is admitted by validateEventCore for
 *   ANY non-empty event_name / schema_key. PR#10's job is therefore to PROVE
 *   the three new behaviour events flow cleanly without changing any
 *   runtime code, and to lock the contract via tests:
 *
 *     1. validation accepts each event with safe event-specific raw fields
 *     2. PII guard rejects unsafe fields (literal email / phone / Luhn card)
 *     3. orchestrator accepts each end-to-end (single + batch)
 *     4. row-builders preserve event-specific fields verbatim in raw
 *     5. canonical_jsonb stays at exactly 19 keys regardless of event_name
 *     6. routes /v1/event admits each via real HTTP through the app factory
 *     7. request_body_sha256 + payload_sha256 stay 64-hex on accepted rows
 */

import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import { runRequest, type RunRequestInput } from '../../src/collector/v1/orchestrator.js';
import { validateEventCore } from '../../src/collector/v1/validation.js';
import { buildAcceptedEventRow } from '../../src/collector/v1/row-builders.js';
import { buildCanonicalJsonb } from '../../src/collector/v1/canonical.js';
import { sha256Hex } from '../../src/collector/v1/hash.js';
import { payloadSha256 } from '../../src/collector/v1/payload-hash.js';
import { createApp } from '../../src/app.js';
import type { CollectorConfig } from '../../src/collector/v1/orchestrator.js';
import type { LoadedV1Config } from '../../src/collector/v1/config.js';
import { VALIDATOR_VERSION } from '../../src/collector/v1/index.js';
import {
  hashSiteWriteToken,
  type SiteWriteTokenRow,
} from '../../src/auth/workspace.js';

/* --------------------------------------------------------------------------
 * Shared fixtures
 * ------------------------------------------------------------------------ */

const TEST_PEPPER = 'pr10-test-token-pepper';
const TEST_IP_PEPPER = 'pr10-test-ip-pepper';
const TEST_TOKEN = 'pr10-test-token';
const TEST_WORKSPACE = 'ws_pr10_test';
const TEST_SITE = 'site_pr10_test';
const TEST_TOKEN_ID = '00000000-0000-4000-8000-0000000010aa';

const TEST_ORIGIN_HEADER = 'https://buyerrecon.com';

const baseConfig: CollectorConfig = {
  collector_version: 'pr10-test',
  validator_version: VALIDATOR_VERSION,
  event_contract_version: 'event-contract-v0.1',
  ip_hash_pepper: TEST_IP_PEPPER,
  allow_consent_state_summary: false,
};

const baseResolved = {
  token_id: TEST_TOKEN_ID,
  workspace_id: TEST_WORKSPACE,
  site_id: TEST_SITE,
};

/** Dynamic occurred_at — stays inside the validator's (-24h, +5min) window. */
function freshOccurredAt(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

/** Common base fields shared by all three new event types. */
function baseBrowserEvent(client_event_id: string): Record<string, unknown> {
  return {
    client_event_id,
    event_origin: 'browser',
    schema_version: '1.0.0',
    occurred_at: freshOccurredAt(),
    session_id: 'pr10_session_001',
    anonymous_id: 'pr10_anon_001',
    page_url: 'https://buyerrecon.com/pricing',
    page_path: '/pricing',
    consent_state: 'granted',
    consent_source: 'cmp',
    tracking_mode: 'full',
    storage_mechanism: 'cookie',
  };
}

function ctaClickEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...baseBrowserEvent('11111111-1111-4111-8111-111111111111'),
    event_name: 'cta_click',
    event_type: 'track',
    schema_key: 'br.cta',
    cta_id: 'hero-book-demo',
    cta_label: 'Book a demo',
    cta_href: 'https://buyerrecon.com/contact',
    cta_location: 'hero',
    cta_text_hash: 'a'.repeat(64),
    element_role: 'button',
    ...overrides,
  };
}

function formStartEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...baseBrowserEvent('22222222-2222-4222-8222-222222222222'),
    event_name: 'form_start',
    event_type: 'track',
    schema_key: 'br.form',
    form_id: 'contact-us',
    form_name: 'contact_us',
    form_location: 'footer',
    form_action_path: '/contact',
    form_method: 'POST',
    ...overrides,
  };
}

function formSubmitEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...baseBrowserEvent('44444444-4444-4444-8444-444444444444'),
    event_name: 'form_submit',
    event_type: 'track',
    schema_key: 'br.form',
    form_id: 'contact-us',
    form_name: 'contact_us',
    form_location: 'footer',
    form_action_path: '/contact',
    form_method: 'POST',
    submit_result: 'success_visible',
    ...overrides,
  };
}

/** Synthetic raw-body buffer + sha for HTTP-path tests. */
function makeBodyAndSha(event: Record<string, unknown>): { body: string; sha: string; buf: Buffer } {
  const body = JSON.stringify(event);
  const buf = Buffer.from(body, 'utf8');
  return { body, buf, sha: sha256Hex(buf) };
}

/* --------------------------------------------------------------------------
 * 1. validation accepts each new event with safe event-specific raw fields
 * ------------------------------------------------------------------------ */

describe('PR#10 — validation admits cta_click / form_start / form_submit (event_type="track")', () => {
  it('cta_click validates', () => {
    const r = validateEventCore({ event: ctaClickEvent(), source_token_kind: 'site_write' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.event_type).toBe('track');
      expect(r.event_name).toBe('cta_click');
      expect(r.schema_key).toBe('br.cta');
      expect(r.id_format).toBe('uuidv4');
    }
  });

  it('form_start validates', () => {
    const r = validateEventCore({ event: formStartEvent(), source_token_kind: 'site_write' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.event_type).toBe('track');
      expect(r.event_name).toBe('form_start');
      expect(r.schema_key).toBe('br.form');
    }
  });

  it('form_submit validates', () => {
    const r = validateEventCore({ event: formSubmitEvent(), source_token_kind: 'site_write' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.event_type).toBe('track');
      expect(r.event_name).toBe('form_submit');
      expect(r.schema_key).toBe('br.form');
    }
  });

  it('rejects bare event_type="interaction" — not in the browser admit set', () => {
    const r = validateEventCore({
      event: ctaClickEvent({ event_type: 'interaction' }),
      source_token_kind: 'site_write',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe('event_type_invalid');
  });

  it('rejects bare event_type="form" — not in the browser admit set', () => {
    const r = validateEventCore({
      event: formStartEvent({ event_type: 'form' }),
      source_token_kind: 'site_write',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe('event_type_invalid');
  });

  it('rejects empty event_name for cta_click', () => {
    const r = validateEventCore({
      event: ctaClickEvent({ event_name: '' }),
      source_token_kind: 'site_write',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe('event_name_invalid');
  });

  it('rejects empty schema_key for form_submit', () => {
    const r = validateEventCore({
      event: formSubmitEvent({ schema_key: '' }),
      source_token_kind: 'site_write',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason_code).toBe('schema_unknown');
  });
});

/* --------------------------------------------------------------------------
 * 2. orchestrator accepts each event end-to-end (request → OrchestratorOutput)
 * ------------------------------------------------------------------------ */

function makeCtx(body: Buffer, ip = '198.51.100.10') {
  return {
    request_id: '00000000-0000-4000-8000-0000000010ab',
    received_at: new Date(),
    endpoint: '/v1/event',
    method: 'POST',
    content_type: 'application/json',
    user_agent: 'pr10-test-ua',
    ip,
    auth_header: `Bearer ${TEST_TOKEN}`,
    raw_body_bytes: body,
  };
}

function makeInput(event: Record<string, unknown>): RunRequestInput {
  const body = Buffer.from(JSON.stringify(event), 'utf8');
  return {
    ctx: makeCtx(body),
    auth: { status: 'ok', resolved: baseResolved, reason_code: null },
    config: baseConfig,
  };
}

describe('PR#10 — orchestrator accepts each behaviour event', () => {
  for (const [name, factory] of [
    ['cta_click', ctaClickEvent],
    ['form_start', formStartEvent],
    ['form_submit', formSubmitEvent],
  ] as const) {
    it(`${name} → 1 accepted, 0 rejected, HTTP 200`, () => {
      const out = runRequest(makeInput(factory()));
      expect(out.http_status).toBe(200);
      expect(out.accepted).toHaveLength(1);
      expect(out.rejected).toHaveLength(0);
      expect(out.response.accepted_count).toBe(1);
      expect(out.response.rejected_count).toBe(0);
      expect(out.response.results).toHaveLength(1);
      expect(out.response.results[0]?.status).toBe('accepted');
    });
  }
});

/* --------------------------------------------------------------------------
 * 3. row-builders preserve event-specific raw fields verbatim
 * ------------------------------------------------------------------------ */

describe('PR#10 — row-builders preserve event-specific raw fields in accepted_events.raw', () => {
  function buildAcceptedFor(event: Record<string, unknown>) {
    const validated = validateEventCore({ event, source_token_kind: 'site_write' });
    if (!validated.ok) throw new Error('fixture should validate');
    return buildAcceptedEventRow({
      ctx: {
        request_id: '00000000-0000-4000-8000-0000000010ac',
        received_at: new Date(),
        endpoint: '/v1/event',
        method: 'POST',
        content_type: 'application/json',
        user_agent: 'pr10-test-ua',
        ip: '198.51.100.11',
        auth_header: null,
        raw_body_bytes: Buffer.from(JSON.stringify(event), 'utf8'),
      },
      resolved: baseResolved,
      validated,
      raw_event: event as Record<string, unknown>,
      config: {
        validator_version: VALIDATOR_VERSION,
        collector_version: 'pr10-test',
        event_contract_version: 'event-contract-v0.1',
        ip_hash_pepper: TEST_IP_PEPPER,
      },
    });
  }

  it('cta_click raw preserves cta_* fields verbatim', () => {
    const evt = ctaClickEvent();
    const row = buildAcceptedFor(evt);
    expect(row.raw).toBe(evt);
    expect((row.raw as Record<string, unknown>).cta_id).toBe('hero-book-demo');
    expect((row.raw as Record<string, unknown>).cta_label).toBe('Book a demo');
    expect((row.raw as Record<string, unknown>).element_role).toBe('button');
  });

  it('form_start raw preserves form_* fields verbatim', () => {
    const evt = formStartEvent();
    const row = buildAcceptedFor(evt);
    expect(row.raw).toBe(evt);
    expect((row.raw as Record<string, unknown>).form_id).toBe('contact-us');
    expect((row.raw as Record<string, unknown>).form_method).toBe('POST');
  });

  it('form_submit raw preserves submit_result verbatim', () => {
    const evt = formSubmitEvent({ submit_result: 'attempted' });
    const row = buildAcceptedFor(evt);
    expect((row.raw as Record<string, unknown>).submit_result).toBe('attempted');
  });

  it('hashes still 64-hex on accepted rows for all three event types', () => {
    for (const factory of [ctaClickEvent, formStartEvent, formSubmitEvent]) {
      const row = buildAcceptedFor(factory());
      expect(row.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

/* --------------------------------------------------------------------------
 * 4. canonical_jsonb stays at exactly 19 keys for every new event type
 * ------------------------------------------------------------------------ */

describe('PR#10 — canonical_jsonb is the same 19-key projection for all three new event types', () => {
  function canonicalKeysFor(event: Record<string, unknown>): string[] {
    const validated = validateEventCore({ event, source_token_kind: 'site_write' });
    if (!validated.ok) throw new Error('fixture should validate');
    const canonical = buildCanonicalJsonb({
      validated,
      resolved: baseResolved,
      ctx: { request_id: '00000000-0000-4000-8000-0000000010ad', received_at: new Date() },
      optional: {
        session_seq: null,
        traffic_class: 'unknown',
        consent_state: validated.event_name ? 'granted' : null,
        consent_source: null,
        tracking_mode: null,
        storage_mechanism: null,
      },
    });
    return Object.keys(canonical);
  }

  it('cta_click canonical has exactly 19 keys', () => {
    expect(canonicalKeysFor(ctaClickEvent())).toHaveLength(19);
  });

  it('form_start canonical has exactly 19 keys', () => {
    expect(canonicalKeysFor(formStartEvent())).toHaveLength(19);
  });

  it('form_submit canonical has exactly 19 keys', () => {
    expect(canonicalKeysFor(formSubmitEvent())).toHaveLength(19);
  });

  it('canonical does NOT include cta_* / form_* event-specific fields', () => {
    const keys = canonicalKeysFor(ctaClickEvent());
    for (const k of keys) {
      expect(k.startsWith('cta_')).toBe(false);
      expect(k.startsWith('form_')).toBe(false);
      expect(k).not.toBe('element_role');
      expect(k).not.toBe('submit_result');
    }
  });
});

/* --------------------------------------------------------------------------
 * 5. PII gate still rejects unsafe values inside the new event shapes
 * ------------------------------------------------------------------------ */

describe('PR#10 — PII guard rejects unsafe values even with new event_name', () => {
  it('cta_click with email-shaped cta_label rejects as pii_email_detected', () => {
    const out = runRequest(
      makeInput(ctaClickEvent({ cta_label: 'Email me at user@example.com' })),
    );
    expect(out.rejected).toHaveLength(1);
    expect(out.accepted).toHaveLength(0);
    expect(out.rejected[0].reason_code).toBe('pii_email_detected');
  });

  it('form_start with email-shaped form_id rejects as pii_email_detected', () => {
    const out = runRequest(
      makeInput(formStartEvent({ form_id: 'contact billing@example.com please' })),
    );
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0].reason_code).toBe('pii_email_detected');
  });

  it('form_submit with phone-shaped extra value rejects as pii_phone_detected', () => {
    const out = runRequest(
      makeInput(formSubmitEvent({ extra_note: 'Call +1 415 555 0199 today' })),
    );
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0].reason_code).toBe('pii_phone_detected');
  });

  it('cta_click with Luhn-passing 13-digit run rejects as pii_payment_detected', () => {
    // 13 sixes = Luhn sum 60 → passes (same trap as PR#8 / fixture-fix C).
    const out = runRequest(
      makeInput(ctaClickEvent({ cta_label: 'Promo code 6666666666666' })),
    );
    expect(out.rejected).toHaveLength(1);
    expect(out.rejected[0].reason_code).toBe('pii_payment_detected');
  });

  it('legitimate cta_label "Book a demo" does NOT trigger PII', () => {
    const out = runRequest(makeInput(ctaClickEvent({ cta_label: 'Book a demo' })));
    expect(out.accepted).toHaveLength(1);
    expect(out.rejected).toHaveLength(0);
  });
});

/* --------------------------------------------------------------------------
 * 6. Real HTTP path via createApp — /v1/event admits the three new events
 * ------------------------------------------------------------------------ */

describe('PR#10 — /v1/event accepts cta_click / form_start / form_submit over real HTTP', () => {
  // Fake pg pool — records query calls; resolves the test token via
  // lookupByHash (so the createApp-mounted route reaches runRequest with
  // auth.status='ok'). The persistence path runs successfully.
  function makeFakePool(clientCalls: Array<{ text: string; values?: unknown[] }> = []) {
    const validHash = hashSiteWriteToken(TEST_TOKEN, TEST_PEPPER);
    const client = {
      async query(text: string, values?: unknown[]) {
        clientCalls.push({ text, values });
        const head = text.split('\n')[0].trim();
        if (head.startsWith('BEGIN') || head.startsWith('COMMIT') || head.startsWith('ROLLBACK')) {
          return { rowCount: 0, rows: [] };
        }
        if (head.startsWith('INSERT INTO ingest_requests')) return { rowCount: 1, rows: [] };
        if (head.startsWith('INSERT INTO accepted_events')) return { rowCount: 1, rows: [{ event_id: 1 }] };
        if (head.startsWith('INSERT INTO rejected_events')) return { rowCount: 1, rows: [] };
        if (head.startsWith('UPDATE ingest_requests')) return { rowCount: 1, rows: [] };
        return { rowCount: 0, rows: [] };
      },
      release() {
        /* no-op */
      },
    };
    return {
      async connect() {
        return client;
      },
      async query(text: string): Promise<{ rowCount: number; rows: SiteWriteTokenRow[] }> {
        if (text.trim().startsWith('SELECT')) {
          return {
            rowCount: 1,
            rows: [
              {
                token_id: TEST_TOKEN_ID,
                workspace_id: TEST_WORKSPACE,
                site_id: TEST_SITE,
                disabled_at: null,
              },
            ],
          };
        }
        if (text.trim().startsWith('UPDATE site_write_tokens')) return { rowCount: 1, rows: [] };
        return { rowCount: 0, rows: [] };
      },
    };
  }

  async function startTestApp(clientCalls: Array<{ text: string; values?: unknown[] }>): Promise<{
    server: Server;
    baseUrl: string;
  }> {
    const v1Loaded: LoadedV1Config = {
      config: baseConfig,
      site_write_token_pepper: TEST_PEPPER,
      enable_v1_batch: false,
    };
    const fakePool = makeFakePool(clientCalls);
    const app = createApp({
      pool: fakePool as never,
      v1Loaded,
      allowed_origins: [TEST_ORIGIN_HEADER],
      log_error: () => {},
    });
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
  }

  async function stopServer(server: Server): Promise<void> {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  for (const [name, factory] of [
    ['cta_click', ctaClickEvent],
    ['form_start', formStartEvent],
    ['form_submit', formSubmitEvent],
  ] as const) {
    it(`${name} → HTTP 200 with accepted=1 via /v1/event`, async () => {
      const calls: Array<{ text: string; values?: unknown[] }> = [];
      const app = await startTestApp(calls);
      try {
        const evt = factory();
        const { body, sha } = makeBodyAndSha(evt);
        const res = await fetch(`${app.baseUrl}/v1/event`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${TEST_TOKEN}`,
          },
          body,
        });
        expect(res.status).toBe(200);
        const respBody = (await res.json()) as {
          accepted_count: number;
          rejected_count: number;
          results: Array<{ status: string }>;
        };
        expect(respBody.accepted_count).toBe(1);
        expect(respBody.rejected_count).toBe(0);
        expect(respBody.results[0]?.status).toBe('accepted');

        // request_body_sha256 byte-accurate match.
        const ingestCall = calls.find((c) =>
          c.text.trim().startsWith('INSERT INTO ingest_requests'),
        );
        expect(ingestCall).toBeDefined();
        // request_body_sha256 is param $10 in the ingest INSERT.
        expect(ingestCall?.values?.[9]).toBe(sha);
      } finally {
        await stopServer(app.server);
      }
    });
  }
});

/* --------------------------------------------------------------------------
 * 7. payloadSha256 stays distinct from canonical-hash for new event types
 * ------------------------------------------------------------------------ */

describe('PR#10 — payloadSha256 (normalised envelope) is distinct from canonical hash for new events', () => {
  // Same contract lock proven against page_view in PR#8 hash-invariants — must
  // also hold for cta_click / form_start / form_submit.
  for (const [name, factory] of [
    ['cta_click', ctaClickEvent],
    ['form_start', formStartEvent],
    ['form_submit', formSubmitEvent],
  ] as const) {
    it(`${name}: payload_sha256 !== payloadSha256(canonical_jsonb)`, () => {
      const out = runRequest(makeInput(factory()));
      expect(out.accepted).toHaveLength(1);
      const accepted = out.accepted[0];
      const canonicalHash = payloadSha256(accepted.canonical_jsonb);
      expect(accepted.payload_sha256).not.toBe(canonicalHash);
    });
  }
});
