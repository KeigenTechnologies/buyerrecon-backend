/**
 * Sprint 1 PR#8b — pure tests for the createApp(...) factory.
 *
 * No DB connection. No env vars required at import time. These tests run
 * under the default `npm test`.
 *
 * src/app.ts must be import-safe (no process.env reads, no env-dependent
 * module-load failures). src/server.ts is NOT import-safe — it still calls
 * start() at module top — so these tests deliberately import app.ts only.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import { join } from 'path';
import { createApp } from '../../src/app.js';
import type { LoadedV1Config } from '../../src/collector/v1/config.js';
import { VALIDATOR_VERSION } from '../../src/collector/v1/index.js';
import type { SiteWriteTokenRow } from '../../src/auth/workspace.js';

const ROOT = join(__dirname, '..', '..');
const APP_PATH = join(ROOT, 'src', 'app.ts');
const SERVER_PATH = join(ROOT, 'src', 'server.ts');

/**
 * Strip /* … *​/ block comments and // line comments from a TypeScript
 * source string. JSDoc that mentions the banned identifiers (process.env,
 * initDb, loadV1ConfigFromEnv, createApp) would otherwise cause false
 * positives on the file-string regex assertions below. We deliberately
 * scan only the executable surface.
 */
function stripTsComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const TEST_ORIGIN = 'https://example.com';

function makeStubPool() {
  // Pool that throws if any code path actually queries — guards against the
  // factory or any registered middleware accidentally touching the DB during
  // app construction or simple GET /health flows.
  return {
    connect: async () => {
      throw new Error('stub pool: connect must not be called in factory tests');
    },
    query: async (): Promise<{ rowCount: number; rows: SiteWriteTokenRow[] }> => {
      throw new Error('stub pool: query must not be called in factory tests');
    },
  };
}

function makeTestV1Loaded(enable_v1_batch = false): LoadedV1Config {
  return {
    config: {
      collector_version: 'pr8b-test',
      validator_version: VALIDATOR_VERSION,
      event_contract_version: 'event-contract-v0.1',
      ip_hash_pepper: 'test-ip-pepper-app-factory',
      allow_consent_state_summary: false,
    },
    site_write_token_pepper: 'test-site-pepper-app-factory',
    enable_v1_batch,
  };
}

/* --------------------------------------------------------------------------
 * Source-string invariants
 * ------------------------------------------------------------------------ */

describe('PR#8b — src/app.ts is import-safe (no process.env, no env loaders)', () => {
  const rawSource = readFileSync(APP_PATH, 'utf8');
  const source = stripTsComments(rawSource);

  it('contains no reference to process.env in active code', () => {
    expect(source).not.toMatch(/\bprocess\.env\b/);
  });

  it('does not call loadV1ConfigFromEnv in active code', () => {
    expect(source).not.toMatch(/\bloadV1ConfigFromEnv\s*\(/);
  });

  it('does not import dotenv/config', () => {
    expect(source).not.toMatch(/['"]dotenv\/config['"]/);
  });

  it('does not call initDb in active code', () => {
    expect(source).not.toMatch(/\binitDb\s*\(/);
  });

  it('exports createApp', () => {
    expect(source).toMatch(/export\s+function\s+createApp\b/);
  });
});

describe('PR#8b — middleware order in src/app.ts (file-string regex)', () => {
  const source = readFileSync(APP_PATH, 'utf8');

  it('v1 router mount appears before app.use(express.json(', () => {
    const v1Idx = source.search(/app\.use\(\s*\n?\s*createV1Router\(/);
    const jsonIdx = source.search(/app\.use\(express\.json\(/);
    expect(v1Idx).toBeGreaterThan(-1);
    expect(jsonIdx).toBeGreaterThan(-1);
    expect(v1Idx).toBeLessThan(jsonIdx);
  });

  it('helmet mounts before cors mounts before v1 router', () => {
    const helmetIdx = source.search(/app\.use\(\s*helmet\(/);
    const corsIdx = source.search(/app\.use\(\s*\n?\s*cors\(/);
    const v1Idx = source.search(/app\.use\(\s*\n?\s*createV1Router\(/);
    expect(helmetIdx).toBeGreaterThan(-1);
    expect(corsIdx).toBeGreaterThan(-1);
    expect(v1Idx).toBeGreaterThan(-1);
    expect(helmetIdx).toBeLessThan(corsIdx);
    expect(corsIdx).toBeLessThan(v1Idx);
  });

  it('CORS allowedHeaders includes Authorization in both casings', () => {
    expect(source).toMatch(/'Authorization'/);
    expect(source).toMatch(/'authorization'/);
  });

  it('legacy routers mounted AFTER express.json (preserving prior behaviour)', () => {
    const jsonIdx = source.search(/app\.use\(express\.json\(/);
    const collectorIdx = source.search(/app\.use\(\s*collectorRoutes\s*\)/);
    const configIdx = source.search(/app\.use\(\s*configRoutes\s*\)/);
    const probeIdx = source.search(/app\.use\(\s*probeRoutes\s*\)/);
    expect(jsonIdx).toBeGreaterThan(-1);
    expect(collectorIdx).toBeGreaterThan(jsonIdx);
    expect(configIdx).toBeGreaterThan(jsonIdx);
    expect(probeIdx).toBeGreaterThan(jsonIdx);
  });
});

describe('PR#8b — src/server.ts shape', () => {
  const rawSource = readFileSync(SERVER_PATH, 'utf8');
  const source = stripTsComments(rawSource);

  it('imports createApp', () => {
    expect(source).toMatch(/from\s+['"]\.\/app\.js['"]/);
  });

  it('calls createApp inside start() (not at module top)', () => {
    const startIdx = source.search(/async\s+function\s+start\s*\(/);
    expect(startIdx).toBeGreaterThan(-1);
    const createAppIdx = source.search(/\bcreateApp\s*\(/);
    expect(createAppIdx).toBeGreaterThan(startIdx);
  });

  it('does not call loadV1ConfigFromEnv at module top', () => {
    const startIdx = source.search(/async\s+function\s+start\s*\(/);
    const loaderIdx = source.search(/loadV1ConfigFromEnv\s*\(/);
    expect(loaderIdx).toBeGreaterThan(startIdx);
  });
});

/* --------------------------------------------------------------------------
 * Runtime behaviour — createApp builds a working app without env access
 * ------------------------------------------------------------------------ */

describe('PR#8b — createApp returns a working Express app (no env required)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp({
      pool: makeStubPool() as never,
      v1Loaded: makeTestV1Loaded(),
      allowed_origins: [],
      log_error: () => {},
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns 200 with status:"ok" + ISO timestamp', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it('GET /health succeeds without touching the DB (stub pool would throw)', async () => {
    // If the pool were consulted, the stub would throw and the response would
    // be 5xx. A clean 200 proves the health path is pure.
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});

describe('PR#8b — CORS preflight via createApp (with explicit allowed_origins)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp({
      pool: makeStubPool() as never,
      v1Loaded: makeTestV1Loaded(true), // batch on
      // Per PR#8b correction #2: tests asserting Authorization preflight
      // succeeds must pass an allow-list that matches the preflight's Origin.
      allowed_origins: [TEST_ORIGIN],
      log_error: () => {},
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function parseAllowHeaders(headerValue: string | null): string[] {
    if (headerValue === null) return [];
    return headerValue.split(',').map((h) => h.trim().toLowerCase());
  }

  it('OPTIONS /v1/event with matching Origin → Allow-Headers includes Authorization', async () => {
    const res = await fetch(`${baseUrl}/v1/event`, {
      method: 'OPTIONS',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type',
      },
    });
    expect(res.status).toBeLessThan(300);
    const allow = parseAllowHeaders(res.headers.get('access-control-allow-headers'));
    expect(allow).toContain('authorization');
  });

  it('OPTIONS /v1/batch with matching Origin → Allow-Headers includes Authorization', async () => {
    const res = await fetch(`${baseUrl}/v1/batch`, {
      method: 'OPTIONS',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type',
      },
    });
    expect(res.status).toBeLessThan(300);
    const allow = parseAllowHeaders(res.headers.get('access-control-allow-headers'));
    expect(allow).toContain('authorization');
  });

  it('OPTIONS preflight does not invoke the handler / pool (stub would throw otherwise)', async () => {
    const res = await fetch(`${baseUrl}/v1/event`, {
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
