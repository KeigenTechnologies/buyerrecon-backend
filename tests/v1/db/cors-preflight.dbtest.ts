/**
 * Sprint 1 PR#8 — CORS preflight for /v1/event and /v1/batch.
 *
 * Verifies that OPTIONS preflight returns
 *   Access-Control-Allow-Headers: ... Authorization ...
 * so browser SDKs can send the bearer token cross-origin.
 *
 * PR#8b — this test now drives the same createApp(...) factory the prod
 * entrypoint uses (src/app.ts). Per the PR#8b approval, the test passes
 * `allowed_origins: ['https://example.com']` and the OPTIONS request sends
 * a matching Origin header, so the CORS origin callback returns true and
 * the preflight response carries the Allow-Headers we assert on.
 *
 * Does NOT require a DB connection — but lives in tests/v1/db/ so it ships
 * with the opt-in DB suite. (Vitest still runs it under `test:db:v1`; the
 * shared `_setup` is not invoked here.)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import { createApp } from '../../../src/app.js';
import type { LoadedV1Config } from '../../../src/collector/v1/config.js';
import { VALIDATOR_VERSION } from '../../../src/collector/v1/index.js';
import type { SiteWriteTokenRow } from '../../../src/auth/workspace.js';

interface TestApp {
  server: Server;
  baseUrl: string;
}

const TEST_ORIGIN = 'https://example.com';

async function startPreflightApp(enableBatch: boolean): Promise<TestApp> {
  const v1Loaded: LoadedV1Config = {
    config: {
      collector_version: 'pr8b-cors',
      validator_version: VALIDATOR_VERSION,
      event_contract_version: 'event-contract-v0.1',
      ip_hash_pepper: 'cors-test-ip-pepper',
      allow_consent_state_summary: false,
    },
    site_write_token_pepper: 'cors-test-token-pepper',
    enable_v1_batch: enableBatch,
  };

  // Stub pool — CORS preflight short-circuits before any handler runs, so the
  // pool must never be touched. Throws loudly on contact (regression guard
  // against preflight accidentally invoking the v1 handler).
  const stubPool = {
    connect: async () => {
      throw new Error('CORS preflight test: pool.connect must not be called');
    },
    query: async (): Promise<{ rowCount: number; rows: SiteWriteTokenRow[] }> => {
      throw new Error('CORS preflight test: pool.query must not be called');
    },
  };

  const app = createApp({
    pool: stubPool as never,
    v1Loaded,
    allowed_origins: [TEST_ORIGIN],
    log_error: () => {},
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

async function stopApp(app: TestApp): Promise<void> {
  await new Promise<void>((resolve) => app.server.close(() => resolve()));
}

let app: TestApp;

beforeAll(async () => {
  app = await startPreflightApp(true);
});

afterAll(async () => {
  await stopApp(app);
});

function parseAllowHeaders(headerValue: string | null): string[] {
  if (headerValue === null) return [];
  return headerValue.split(',').map((h) => h.trim().toLowerCase());
}

describe('PR#8 — CORS preflight allows Authorization', () => {
  it('OPTIONS /v1/event returns Access-Control-Allow-Headers including Authorization', async () => {
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'OPTIONS',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type',
      },
    });
    expect(res.status).toBeLessThan(300);
    const allowHeaders = parseAllowHeaders(
      res.headers.get('access-control-allow-headers'),
    );
    expect(allowHeaders).toContain('authorization');
  });

  it('OPTIONS /v1/batch returns Access-Control-Allow-Headers including Authorization', async () => {
    const res = await fetch(`${app.baseUrl}/v1/batch`, {
      method: 'OPTIONS',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type',
      },
    });
    expect(res.status).toBeLessThan(300);
    const allowHeaders = parseAllowHeaders(
      res.headers.get('access-control-allow-headers'),
    );
    expect(allowHeaders).toContain('authorization');
  });

  it('OPTIONS preflight does not invoke the handler / pool / runRequest', async () => {
    // If preflight reached the handler, the stub pool would throw. We test
    // by completing the preflight and checking the status — any handler
    // execution would surface as a 5xx.
    const res = await fetch(`${app.baseUrl}/v1/event`, {
      method: 'OPTIONS',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization',
      },
    });
    expect(res.status).toBeLessThan(500);
  });
});
