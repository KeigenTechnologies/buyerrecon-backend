/**
 * Sprint 1 PR#7 — route tests.
 *
 * Uses node:http + global fetch (Node 22+) to drive the real Express
 * createV1Router across a real raw-body capture middleware. No supertest
 * dependency. No real DB — a fake pg pool records query calls.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import express, { type Express } from 'express';
import { createV1Router } from '../../src/collector/v1/routes.js';
import type { CollectorConfig } from '../../src/collector/v1/orchestrator.js';
import type { SiteWriteTokenRow, hashSiteWriteToken as _h } from '../../src/auth/workspace.js';
import { hashSiteWriteToken } from '../../src/auth/workspace.js';

/* --------------------------------------------------------------------------
 * Fake pg pool — same call recording as persistence tests
 * ------------------------------------------------------------------------ */

interface QueryCall {
  text: string;
  values?: unknown[];
}

interface FakePoolOptions {
  /** If set, all client.query calls record here. */
  collectClientCalls?: QueryCall[];
  /** If set, all pool.query calls record here. */
  collectPoolCalls?: QueryCall[];
  /** Throw on pool.query for site_write_tokens SELECT. */
  throwOnTokenLookup?: unknown;
  /** Throw on accepted_events insert (first). */
  throwOnAcceptedInsert?: unknown;
  /** Mock token lookup row to return (default null). */
  tokenRow?: SiteWriteTokenRow | null;
}

function makeFakePool(opts: FakePoolOptions = {}) {
  const clientCalls = opts.collectClientCalls ?? [];
  const poolCalls = opts.collectPoolCalls ?? [];
  let acceptedInsertSeen = 0;

  const client = {
    async query(text: string, values?: unknown[]) {
      clientCalls.push({ text, values });
      const head = text.split('\n')[0].trim();
      if (head.startsWith('BEGIN') || head.startsWith('COMMIT') || head.startsWith('ROLLBACK')) {
        return { rowCount: 0, rows: [] };
      }
      if (head.startsWith('INSERT INTO ingest_requests')) return { rowCount: 1, rows: [] };
      if (head.startsWith('INSERT INTO accepted_events')) {
        acceptedInsertSeen += 1;
        if (opts.throwOnAcceptedInsert !== undefined) {
          throw opts.throwOnAcceptedInsert;
        }
        return { rowCount: 1, rows: [{ event_id: acceptedInsertSeen }] };
      }
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
    async query(text: string, values?: unknown[]) {
      poolCalls.push({ text, values });
      const head = text.split('\n')[0].trim();
      if (head.startsWith('SELECT')) {
        if (opts.throwOnTokenLookup !== undefined) {
          throw opts.throwOnTokenLookup;
        }
        return { rowCount: opts.tokenRow ? 1 : 0, rows: opts.tokenRow ? [opts.tokenRow] : [] };
      }
      if (head.startsWith('UPDATE site_write_tokens')) return { rowCount: 1, rows: [] };
      return { rowCount: 0, rows: [] };
    },
  };
}

/* --------------------------------------------------------------------------
 * Test server + tear-down
 * ------------------------------------------------------------------------ */

const PEPPER = 'test-site-pepper-1';
const VALID_TOKEN = 'valid-token-1';
const DISABLED_TOKEN = 'disabled-token-1';

const config: CollectorConfig = {
  collector_version: '1.0.0',
  validator_version: 'buyerrecon-v1-validator-0.1',
  event_contract_version: 'event-contract-v0.1',
  ip_hash_pepper: 'test-ip-pepper-1',
  allow_consent_state_summary: false,
};

interface TestContext {
  app: Express;
  server: Server;
  baseUrl: string;
  clientCalls: QueryCall[];
  poolCalls: QueryCall[];
  loggedErrors: Array<{ request_id: string; kind: string; message: string }>;
}

async function startTestServer(
  poolOpts: FakePoolOptions = {},
  options: {
    enable_v1_batch?: boolean;
    lookupOverride?: (hash: string) => Promise<SiteWriteTokenRow | null>;
  } = {},
): Promise<TestContext> {
  const clientCalls: QueryCall[] = [];
  const poolCalls: QueryCall[] = [];
  const loggedErrors: TestContext['loggedErrors'] = [];

  const fakePool = makeFakePool({
    ...poolOpts,
    collectClientCalls: clientCalls,
    collectPoolCalls: poolCalls,
  });

  const validHash = hashSiteWriteToken(VALID_TOKEN, PEPPER);
  const disabledHash = hashSiteWriteToken(DISABLED_TOKEN, PEPPER);

  const defaultLookup = async (hash: string): Promise<SiteWriteTokenRow | null> => {
    if (hash === validHash) {
      return {
        token_id: 'tok-valid',
        workspace_id: 'ws-1',
        site_id: 'site-1',
        disabled_at: null,
      };
    }
    if (hash === disabledHash) {
      return {
        token_id: 'tok-disabled',
        workspace_id: 'ws-1',
        site_id: 'site-1',
        disabled_at: new Date('2026-05-01'),
      };
    }
    return null;
  };

  const app = express();
  app.use(
    createV1Router({
      pool: fakePool as never,
      config,
      site_write_token_pepper: PEPPER,
      enable_v1_batch: options.enable_v1_batch ?? true,
      lookupByHash: options.lookupOverride ?? defaultLookup,
      log_error: (event) => loggedErrors.push(event),
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return { app, server, baseUrl, clientCalls, poolCalls, loggedErrors };
}

async function stopServer(ctx: TestContext): Promise<void> {
  await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
}

function validEvent(overrides: Record<string, unknown> = {}) {
  // occurred_at must fall inside the validator's (-24h, +5min) window per
  // R-5. A hard-coded literal worked while the test suite was clock-pinned
  // to a fixed CI date but drifts out of bounds once the host clock moves
  // forward. Use a dynamic timestamp so the fixture stays valid over time.
  return {
    client_event_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    event_name: 'page_view',
    event_type: 'page',
    event_origin: 'browser',
    schema_key: 'br.page',
    schema_version: '1.0.0',
    occurred_at: new Date(Date.now() - 60_000).toISOString(),
    session_id: 'sess_alpha',
    anonymous_id: 'a_alpha',
    page_url: 'https://example.com/p',
    page_path: '/p',
    consent_state: 'granted',
    consent_source: 'cmp',
    tracking_mode: 'full',
    storage_mechanism: 'cookie',
    ...overrides,
  };
}

/* --------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------ */

describe('POST /v1/event — happy path', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await startTestServer();
  });
  afterEach(async () => {
    await stopServer(ctx);
  });

  it('returns 200 and writes ingest + accepted rows', async () => {
    const res = await fetch(`${ctx.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify(validEvent()),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accepted_count: number; rejected_count: number; request_id: string };
    expect(body.accepted_count + body.rejected_count).toBe(1);
    expect(typeof body.request_id).toBe('string');

    const heads = ctx.clientCalls.map((c) => c.text.split('\n')[0].trim());
    expect(heads.some((h) => h.startsWith('INSERT INTO ingest_requests'))).toBe(true);
    expect(heads).toContain('COMMIT');
  });
});

describe('POST /v1/batch — feature flag', () => {
  it('returns HTTP 404 with v1_batch_disabled when flag is off and writes NO DB rows', async () => {
    const ctx = await startTestServer({}, { enable_v1_batch: false });
    try {
      const res = await fetch(`${ctx.baseUrl}/v1/batch`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify({ events: [validEvent()] }),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'v1_batch_disabled' });
      expect(ctx.clientCalls).toHaveLength(0);
      expect(ctx.poolCalls).toHaveLength(0);
    } finally {
      await stopServer(ctx);
    }
  });

  it('returns 200 + writes rows when flag is on', async () => {
    const ctx = await startTestServer({}, { enable_v1_batch: true });
    try {
      const res = await fetch(`${ctx.baseUrl}/v1/batch`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify({ events: [validEvent()] }),
      });
      expect(res.status).toBe(200);
      const heads = ctx.clientCalls.map((c) => c.text.split('\n')[0].trim());
      expect(heads.some((h) => h.startsWith('INSERT INTO ingest_requests'))).toBe(true);
      expect(heads).toContain('COMMIT');
    } finally {
      await stopServer(ctx);
    }
  });
});

describe('envelope-level rejects', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await startTestServer();
  });
  afterEach(async () => {
    await stopServer(ctx);
  });

  it('invalid JSON → 400 and only ingest insert', async () => {
    const res = await fetch(`${ctx.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: '{not-json',
    });
    expect(res.status).toBe(400);
    const insertCalls = ctx.clientCalls.filter((c) => c.text.trim().startsWith('INSERT INTO'));
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].text.trim().startsWith('INSERT INTO ingest_requests')).toBe(true);
  });

  it('non-JSON content-type → 415 and only ingest insert', async () => {
    const res = await fetch(`${ctx.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: 'hello',
    });
    expect(res.status).toBe(415);
    const insertCalls = ctx.clientCalls.filter((c) => c.text.trim().startsWith('INSERT INTO'));
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].text.trim().startsWith('INSERT INTO ingest_requests')).toBe(true);
  });

  it('oversized /v1/event body (> 32 KB) → 413', async () => {
    // Build a 40 KB body within the 1 MB outer transport cap.
    const big = 'x'.repeat(40_000);
    const res = await fetch(`${ctx.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({ ...validEvent(), filler: big }),
    });
    expect(res.status).toBe(413);
  });
});

describe('auth failures', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await startTestServer();
  });
  afterEach(async () => {
    await stopServer(ctx);
  });

  it('missing Authorization → 401 (auth_invalid via orchestrator)', async () => {
    const res = await fetch(`${ctx.baseUrl}/v1/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validEvent()),
    });
    expect(res.status).toBe(401);
  });

  it('disabled token → 403 (auth_site_disabled)', async () => {
    const res = await fetch(`${ctx.baseUrl}/v1/event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${DISABLED_TOKEN}`,
      },
      body: JSON.stringify(validEvent()),
    });
    expect(res.status).toBe(403);
  });

  it('auth lookup DB failure → 500 auth_lookup_failure', async () => {
    const lookupCtx = await startTestServer(
      {},
      {
        lookupOverride: async () => {
          throw new Error('synthetic lookup failure');
        },
      },
    );
    try {
      const res = await fetch(`${lookupCtx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify(validEvent()),
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string; request_id: string };
      expect(body.error).toBe('auth_lookup_failure');
      expect(typeof body.request_id).toBe('string');
      // NO ingest insert, since we never reached the transaction.
      expect(
        lookupCtx.clientCalls.filter((c) => c.text.trim().startsWith('INSERT INTO ingest_requests')),
      ).toHaveLength(0);
    } finally {
      await stopServer(lookupCtx);
    }
  });
});

describe('persistence failure', () => {
  it('non-conflict accepted insert failure → 500 storage_failure', async () => {
    const ctx = await startTestServer({
      throwOnAcceptedInsert: new Error('synthetic storage failure'),
    });
    try {
      const res = await fetch(`${ctx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify(validEvent()),
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('storage_failure');
      const heads = ctx.clientCalls.map((c) => c.text.split('\n')[0].trim());
      expect(heads).toContain('ROLLBACK');
    } finally {
      await stopServer(ctx);
    }
  });
});

describe('raw body bytes preserved for request_body_sha256', () => {
  it('request_body_sha256 INSERT param = sha256Hex(raw bytes)', async () => {
    const ctx = await startTestServer();
    try {
      // Use a deterministic body string.
      const bodyStr = JSON.stringify(validEvent());
      await fetch(`${ctx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: bodyStr,
      });
      const ingestCall = ctx.clientCalls.find((c) =>
        c.text.trim().startsWith('INSERT INTO ingest_requests'),
      );
      expect(ingestCall).toBeDefined();
      // request_body_sha256 is param $10.
      const sha = ingestCall!.values?.[9];
      const { sha256Hex } = await import('../../src/collector/v1/hash.js');
      expect(sha).toBe(sha256Hex(Buffer.from(bodyStr)));
    } finally {
      await stopServer(ctx);
    }
  });
});

describe('response body shape', () => {
  it('valid /v1/event returns OrchestratorOutput.response shape', async () => {
    const ctx = await startTestServer();
    try {
      const res = await fetch(`${ctx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify(validEvent()),
      });
      const body = (await res.json()) as {
        request_id: string;
        expected_event_count: number;
        accepted_count: number;
        rejected_count: number;
        results: Array<{ status: string; client_event_id: string | null; reason_code: string | null }>;
      };
      expect(body).toHaveProperty('request_id');
      expect(body).toHaveProperty('expected_event_count');
      expect(body).toHaveProperty('accepted_count');
      expect(body).toHaveProperty('rejected_count');
      expect(Array.isArray(body.results)).toBe(true);
    } finally {
      await stopServer(ctx);
    }
  });
});

/* --------------------------------------------------------------------------
 * Blocker 1 — raw body fallback removed
 * ------------------------------------------------------------------------ */

describe('raw body middleware bypassed (Blocker 1)', () => {
  // Simulate the misordering / middleware-bypass case by mounting
  // express.json BEFORE the v1 router. body-parser modules check whether
  // req.body is already populated and skip if so; the upstream JSON parser
  // sets req.body to the parsed object, so the v1 router's route-scoped
  // express.raw becomes a no-op and the handler sees req.body as an object
  // (not a Buffer). The handler must refuse rather than silently hash empty
  // bytes into request_body_sha256.
  async function startBypassServer(): Promise<TestContext> {
    const clientCalls: QueryCall[] = [];
    const poolCalls: QueryCall[] = [];
    const loggedErrors: TestContext['loggedErrors'] = [];

    const fakePool = makeFakePool({
      collectClientCalls: clientCalls,
      collectPoolCalls: poolCalls,
    });

    const validHash = hashSiteWriteToken(VALID_TOKEN, PEPPER);
    const lookup = async (hash: string): Promise<SiteWriteTokenRow | null> => {
      if (hash === validHash) {
        return {
          token_id: 'tok-valid',
          workspace_id: 'ws-1',
          site_id: 'site-1',
          disabled_at: null,
        };
      }
      return null;
    };

    const app = express();
    // GLOBAL JSON BEFORE v1 router — this is the bypass condition.
    app.use(express.json());
    app.use(
      createV1Router({
        pool: fakePool as never,
        config,
        site_write_token_pepper: PEPPER,
        enable_v1_batch: true,
        lookupByHash: lookup,
        log_error: (event) => loggedErrors.push(event),
      }),
    );

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    return {
      app,
      server,
      baseUrl: `http://127.0.0.1:${addr.port}`,
      clientCalls,
      poolCalls,
      loggedErrors,
    };
  }

  it('returns 500 collector_misconfigured when req.body is not a Buffer', async () => {
    const ctx = await startBypassServer();
    try {
      const res = await fetch(`${ctx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify(validEvent()),
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { request_id: string; error: string };
      expect(body.error).toBe('collector_misconfigured');
      expect(typeof body.request_id).toBe('string');
      expect(body.request_id.length).toBeGreaterThan(0);
      // No additional keys leaked beyond { request_id, error }.
      expect(Object.keys(body).sort()).toEqual(['error', 'request_id']);
    } finally {
      await stopServer(ctx);
    }
  });

  it('does NOT call lookupByHash, runRequest, or any DB write', async () => {
    const ctx = await startBypassServer();
    try {
      await fetch(`${ctx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify(validEvent()),
      });
      // No client (transaction) was ever acquired — no client.query calls.
      expect(ctx.clientCalls).toHaveLength(0);
      // No pool.query calls either — no auth lookup, no last_used_at touch.
      expect(ctx.poolCalls).toHaveLength(0);
    } finally {
      await stopServer(ctx);
    }
  });

  it('logs a safe structured collector_misconfigured event (no payload/token/PG details)', async () => {
    const ctx = await startBypassServer();
    try {
      await fetch(`${ctx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify(validEvent()),
      });
      expect(ctx.loggedErrors).toHaveLength(1);
      const entry = ctx.loggedErrors[0];
      expect(entry.kind).toBe('collector_misconfigured');
      expect(entry.message).toBe('raw body middleware did not provide Buffer');
      expect(typeof entry.request_id).toBe('string');
      // No raw token, no PG error fragments, no payload echo.
      expect(entry.message).not.toContain(VALID_TOKEN);
      expect(entry.message).not.toContain('page_view');
      expect(Object.keys(entry).sort()).toEqual(['kind', 'message', 'request_id']);
    } finally {
      await stopServer(ctx);
    }
  });

  it('returns request_id that ties response and log entry together', async () => {
    const ctx = await startBypassServer();
    try {
      const res = await fetch(`${ctx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify(validEvent()),
      });
      const body = (await res.json()) as { request_id: string };
      expect(ctx.loggedErrors[0].request_id).toBe(body.request_id);
    } finally {
      await stopServer(ctx);
    }
  });
});

describe('safe error response shape', () => {
  it('error responses include request_id and a fixed-enum error code only', async () => {
    const ctx = await startTestServer(
      {},
      {
        lookupOverride: async () => {
          throw new Error('synthetic with embedded secret token AKIAIOSFODNN7EXAMPLE');
        },
      },
    );
    try {
      const res = await fetch(`${ctx.baseUrl}/v1/event`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${VALID_TOKEN}`,
        },
        body: JSON.stringify(validEvent()),
      });
      const text = await res.text();
      const body = JSON.parse(text);
      expect(Object.keys(body).sort()).toEqual(['error', 'request_id']);
      // No leaked SQL / token / stack content.
      expect(text).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(text).not.toContain('synthetic');
      expect(text).not.toContain('stack');
    } finally {
      await stopServer(ctx);
    }
  });
});
