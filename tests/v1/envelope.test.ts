/**
 * Sprint 1 PR#5b-1 — request envelope parser tests.
 *
 * Pure-function tests; no Express, no HTTP, no DB.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  V1_EVENT_MAX_BYTES,
  V1_BATCH_MAX_BYTES,
  V1_BATCH_MAX_EVENTS,
  parseEnvelope,
  isJsonContentType,
  type EnvelopeResult,
} from '../../src/collector/v1/envelope.js';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'collector', 'v1', 'envelope.ts');
const source = readFileSync(SOURCE_PATH, 'utf8');

const tinyEventBody = (extra: Record<string, unknown> = {}): Buffer =>
  Buffer.from(JSON.stringify({ event_type: 'page', ...extra }), 'utf8');

const tinyBatchBody = (n = 1, extra: Record<string, unknown> = {}): Buffer =>
  Buffer.from(
    JSON.stringify({
      events: Array.from({ length: n }, (_, i) => ({ event_type: 'page', i, ...extra })),
    }),
    'utf8',
  );

describe('isJsonContentType', () => {
  it('accepts plain application/json', () => {
    expect(isJsonContentType('application/json')).toBe(true);
  });

  it('accepts application/json with charset parameter', () => {
    expect(isJsonContentType('application/json; charset=utf-8')).toBe(true);
    expect(isJsonContentType('application/json;charset=UTF-8')).toBe(true);
    expect(isJsonContentType('application/json ; charset=utf-8')).toBe(true);
  });

  it('is case-insensitive on the base media type', () => {
    expect(isJsonContentType('Application/JSON')).toBe(true);
    expect(isJsonContentType('APPLICATION/JSON; CHARSET=UTF-8')).toBe(true);
  });

  it('rejects null / empty', () => {
    expect(isJsonContentType(null)).toBe(false);
    expect(isJsonContentType('')).toBe(false);
  });

  it('rejects non-JSON media types', () => {
    expect(isJsonContentType('text/plain')).toBe(false);
    expect(isJsonContentType('application/xml')).toBe(false);
    expect(isJsonContentType('application/x-www-form-urlencoded')).toBe(false);
    expect(isJsonContentType('multipart/form-data')).toBe(false);
  });

  it('rejects +json suffix variants (strict — no application/vnd.api+json)', () => {
    expect(isJsonContentType('application/vnd.api+json')).toBe(false);
    expect(isJsonContentType('application/ld+json')).toBe(false);
  });
});

describe('parseEnvelope — content-type', () => {
  it('rejects non-JSON content-type → content_type_invalid', () => {
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'text/plain',
      raw_body_bytes: tinyEventBody(),
    });
    expect(r).toEqual({ ok: false, reason_code: 'content_type_invalid' });
  });

  it('rejects null content-type → content_type_invalid', () => {
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: null,
      raw_body_bytes: tinyEventBody(),
    });
    expect(r).toEqual({ ok: false, reason_code: 'content_type_invalid' });
  });

  it('accepts application/json with charset', () => {
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json; charset=utf-8',
      raw_body_bytes: tinyEventBody(),
    });
    expect(r.ok).toBe(true);
  });
});

describe('parseEnvelope — JSON parse', () => {
  it('rejects malformed JSON → request_body_invalid_json', () => {
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json',
      raw_body_bytes: Buffer.from('{not json', 'utf8'),
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_body_invalid_json' });
  });

  it('rejects /v1/event body that is a JSON array (envelope shape) → request_body_invalid_json', () => {
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json',
      raw_body_bytes: Buffer.from('[1, 2, 3]', 'utf8'),
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_body_invalid_json' });
  });

  it('rejects /v1/event body that is null → request_body_invalid_json', () => {
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json',
      raw_body_bytes: Buffer.from('null', 'utf8'),
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_body_invalid_json' });
  });

  it('rejects /v1/event body that is a JSON primitive → request_body_invalid_json', () => {
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json',
      raw_body_bytes: Buffer.from('42', 'utf8'),
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_body_invalid_json' });
  });
});

describe('parseEnvelope — size caps (R-6)', () => {
  it('rejects /v1/event body over 32KB → request_too_large', () => {
    const big = Buffer.alloc(V1_EVENT_MAX_BYTES + 1, 0x20); // 32_769 bytes of spaces
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json',
      raw_body_bytes: big,
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_too_large' });
  });

  it('accepts /v1/event body at exactly 32KB', () => {
    // Build a JSON object that pads to exactly V1_EVENT_MAX_BYTES.
    const prefix = '{"k":"';
    const suffix = '"}';
    const padLen = V1_EVENT_MAX_BYTES - prefix.length - suffix.length;
    const body = Buffer.from(prefix + 'a'.repeat(padLen) + suffix, 'utf8');
    expect(body.byteLength).toBe(V1_EVENT_MAX_BYTES);
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json',
      raw_body_bytes: body,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects /v1/batch body over 512KB → batch_too_large', () => {
    const big = Buffer.alloc(V1_BATCH_MAX_BYTES + 1, 0x20);
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: big,
    });
    expect(r).toEqual({ ok: false, reason_code: 'batch_too_large' });
  });

  it('does not apply /v1/event size cap to /v1/batch', () => {
    // 33KB body — over /v1/event cap but well under /v1/batch cap.
    const body = Buffer.from(
      JSON.stringify({ events: [{ pad: 'a'.repeat(33 * 1024) }] }),
      'utf8',
    );
    expect(body.byteLength).toBeGreaterThan(V1_EVENT_MAX_BYTES);
    expect(body.byteLength).toBeLessThan(V1_BATCH_MAX_BYTES);
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: body,
    });
    expect(r.ok).toBe(true);
  });
});

describe('parseEnvelope — batch shape & item count', () => {
  it('valid /v1/event returns one event', () => {
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json',
      raw_body_bytes: tinyEventBody(),
    });
    expect(r.ok).toBe(true);
    expect((r as Extract<EnvelopeResult, { ok: true }>).events.length).toBe(1);
  });

  it('valid /v1/batch returns the events array (length matches)', () => {
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: tinyBatchBody(3),
    });
    expect(r.ok).toBe(true);
    expect((r as Extract<EnvelopeResult, { ok: true }>).events.length).toBe(3);
  });

  it('valid /v1/batch with empty events array is accepted (events.length === 0)', () => {
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: Buffer.from('{"events": []}', 'utf8'),
    });
    expect(r.ok).toBe(true);
    expect((r as Extract<EnvelopeResult, { ok: true }>).events.length).toBe(0);
  });

  it('rejects /v1/batch when events is not an array → request_body_invalid_json', () => {
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: Buffer.from(JSON.stringify({ events: 'not-an-array' }), 'utf8'),
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_body_invalid_json' });
  });

  it('rejects /v1/batch when events field is missing → request_body_invalid_json', () => {
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: Buffer.from('{"foo": 1}', 'utf8'),
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_body_invalid_json' });
  });

  it('rejects /v1/batch when body is a top-level array → request_body_invalid_json', () => {
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: Buffer.from('[]', 'utf8'),
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_body_invalid_json' });
  });

  it('rejects /v1/batch with > 100 events → batch_item_count_exceeded', () => {
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: tinyBatchBody(V1_BATCH_MAX_EVENTS + 1),
    });
    expect(r).toEqual({ ok: false, reason_code: 'batch_item_count_exceeded' });
  });

  it('accepts /v1/batch at exactly 100 events', () => {
    const r = parseEnvelope({
      endpoint: '/v1/batch',
      content_type: 'application/json',
      raw_body_bytes: tinyBatchBody(V1_BATCH_MAX_EVENTS),
    });
    expect(r.ok).toBe(true);
    expect((r as Extract<EnvelopeResult, { ok: true }>).events.length).toBe(V1_BATCH_MAX_EVENTS);
  });
});

describe('parseEnvelope — deterministic precedence (D3 first reason wins)', () => {
  it('content_type_invalid wins over a too-large body', () => {
    const big = Buffer.alloc(V1_EVENT_MAX_BYTES + 1, 0x20);
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'text/plain',
      raw_body_bytes: big,
    });
    expect(r).toEqual({ ok: false, reason_code: 'content_type_invalid' });
  });

  it('size cap wins over a malformed JSON body', () => {
    const big = Buffer.alloc(V1_EVENT_MAX_BYTES + 1, 0x20);
    // Fill with junk; the size cap should fire before parse is attempted.
    big.write('{not json', 0, 'utf8');
    const r = parseEnvelope({
      endpoint: '/v1/event',
      content_type: 'application/json',
      raw_body_bytes: big,
    });
    expect(r).toEqual({ ok: false, reason_code: 'request_too_large' });
  });
});

describe('envelope.ts — import discipline (Track B only)', () => {
  it('imports only the ReasonCode type from ./reason-codes.js', () => {
    const importStatements = source.match(/import\s[\s\S]*?from\s+['"][^'"]+['"];/g) ?? [];
    expect(importStatements.length).toBeGreaterThan(0);
    for (const stmt of importStatements) {
      expect(stmt).toMatch(/from\s+['"]\.\/reason-codes\.js['"]/);
      expect(stmt).toMatch(/^import\s+type\s/);
    }
  });

  it('does NOT import a DB driver, env, logger, HTTP module, or scoring path', () => {
    expect(source).not.toMatch(/from\s+['"]pg['"]/);
    expect(source).not.toMatch(/from\s+['"]express['"]/);
    expect(source).not.toMatch(/from\s+['"]pino['"]/);
    expect(source).not.toMatch(/process\.env\./);
    expect(source).not.toMatch(/ams-qa-behaviour-tests/);
    expect(source).not.toMatch(/keigentechnologies\/ams/);
  });

  it('does NOT register any HTTP route handler or middleware (the /v1/* string literals in the V1Endpoint type are expected)', () => {
    // No router / app instantiation or method-call patterns.
    expect(source).not.toMatch(/\bRouter\s*\(/);
    expect(source).not.toMatch(/\b(?:app|router)\.(?:get|post|put|delete|patch|use|listen)\s*\(/);
    // No express import.
    expect(source).not.toMatch(/from\s+['"]express['"]/);
  });
});
