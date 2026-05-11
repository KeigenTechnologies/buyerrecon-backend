/**
 * Sprint 1 PR#7 — HTTP context builder unit tests.
 *
 * Drives buildRequestContext directly with a hand-rolled fake Request.
 * No express runtime needed.
 */

import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { buildRequestContext } from '../../src/collector/v1/http-context.js';

interface FakeReqArgs {
  headers?: Record<string, string | string[] | undefined>;
  socket_remote?: string | undefined;
  ip?: string | undefined;
  method?: string;
}

function fakeReq(args: FakeReqArgs = {}): Request {
  return {
    method: args.method ?? 'POST',
    headers: args.headers ?? {},
    socket: { remoteAddress: args.socket_remote },
    ip: args.ip,
  } as unknown as Request;
}

const FIXED_UUID = '00000000-0000-4000-8000-000000000001';
const FIXED_DATE = new Date('2026-05-11T00:00:00.000Z');
const deps = { uuid: () => FIXED_UUID, now: () => FIXED_DATE };

describe('buildRequestContext — raw body bytes', () => {
  it('passes the Buffer through unchanged', () => {
    const body = Buffer.from([0x7b, 0x7d]); // '{}'
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '1.2.3.4' }),
      raw_body_bytes: body,
      endpoint: '/v1/event',
    });
    expect(ctx.raw_body_bytes).toBe(body);
    expect(ctx.raw_body_bytes.byteLength).toBe(2);
  });

  it('preserves bytes exactly (no JSON re-stringification)', () => {
    const original = Buffer.from('{"a":1,"b":2}');
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '1.2.3.4' }),
      raw_body_bytes: original,
      endpoint: '/v1/event',
    });
    expect(ctx.raw_body_bytes.equals(original)).toBe(true);
  });
});

describe('buildRequestContext — header extraction', () => {
  it('captures content_type from header', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({
        headers: { 'content-type': 'application/json; charset=utf-8' },
        socket_remote: '1.2.3.4',
      }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.content_type).toBe('application/json; charset=utf-8');
  });

  it('captures user_agent from header', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({
        headers: { 'user-agent': 'CustomSDK/1.2.3' },
        socket_remote: '1.2.3.4',
      }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.user_agent).toBe('CustomSDK/1.2.3');
  });

  it('captures auth_header from Authorization header', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({
        headers: { authorization: 'Bearer tok-abc' },
        socket_remote: '1.2.3.4',
      }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.auth_header).toBe('Bearer tok-abc');
  });

  it('returns null for missing headers', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '1.2.3.4' }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.content_type).toBeNull();
    expect(ctx.user_agent).toBeNull();
    expect(ctx.auth_header).toBeNull();
  });

  it('returns null for empty-string headers', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({
        headers: { 'content-type': '', authorization: '' },
        socket_remote: '1.2.3.4',
      }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.content_type).toBeNull();
    expect(ctx.auth_header).toBeNull();
  });

  it('handles duplicated headers as string[] by picking the first', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({
        headers: { 'user-agent': ['first-ua', 'second-ua'] },
        socket_remote: '1.2.3.4',
      }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.user_agent).toBe('first-ua');
  });
});

describe('buildRequestContext — injectable deps', () => {
  it('request_id comes from deps.uuid', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '1.2.3.4' }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.request_id).toBe(FIXED_UUID);
  });

  it('received_at comes from deps.now', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '1.2.3.4' }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.received_at).toBe(FIXED_DATE);
  });

  it('endpoint is passed through verbatim', () => {
    const e = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '1.2.3.4' }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    const b = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '1.2.3.4' }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/batch',
    });
    expect(e.endpoint).toBe('/v1/event');
    expect(b.endpoint).toBe('/v1/batch');
  });

  it('method comes from req.method', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ method: 'POST', socket_remote: '1.2.3.4' }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.method).toBe('POST');
  });
});

describe('buildRequestContext — IP resolution (NO fake fallback)', () => {
  it('uses socket.remoteAddress when set', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '203.0.113.7' }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.ip).toBe('203.0.113.7');
  });

  it('falls back to req.ip when socket.remoteAddress is undefined', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: undefined, ip: '198.51.100.4' }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.ip).toBe('198.51.100.4');
  });

  it('stays null when both socket.remoteAddress and req.ip are missing', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: undefined, ip: undefined }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.ip).toBeNull();
  });

  it('does NOT fake "0.0.0.0" / "unknown" / any sentinel when IP missing', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: undefined, ip: undefined }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.ip).not.toBe('0.0.0.0');
    expect(ctx.ip).not.toBe('unknown');
    expect(ctx.ip).not.toBe('');
  });

  it('stays null when socket.remoteAddress is empty string', () => {
    const ctx = buildRequestContext(deps, {
      req: fakeReq({ socket_remote: '', ip: undefined }),
      raw_body_bytes: Buffer.alloc(0),
      endpoint: '/v1/event',
    });
    expect(ctx.ip).toBeNull();
  });
});
