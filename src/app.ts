/**
 * Sprint 1 PR#8b — Express app factory (Track B).
 *
 * Pure construction. NO process.env reads. NO initDb() side-effects. NO
 * dotenv side-effects. Importing this module from a test does not require
 * any env vars to be set.
 *
 * Production boot (src/server.ts) and the PR#8 DB test harness
 * (tests/v1/db/_setup.ts) both go through this factory so middleware wiring
 * has a single source of truth.
 *
 * Middleware order (must match prior src/server.ts behaviour):
 *   1. helmet()
 *   2. cors(...)  — including 'Authorization' / 'authorization' in allowedHeaders
 *   3. createV1Router(...)  — MOUNTED BEFORE the global JSON parser so the
 *                             route-scoped express.raw inside the v1 router
 *                             can capture the exact wire bytes for
 *                             request_body_sha256.
 *   4. express.json({ limit: '100kb' })
 *   5. GET /health
 *   6. legacy collectorRoutes (/collect)
 *   7. configRoutes
 *   8. probeRoutes
 *
 * NOT Track A scoring. NOT Core AMS product code.
 */

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Pool } from 'pg';
import collectorRoutes from './collector/routes.js';
import configRoutes from './config/routes.js';
import probeRoutes from './probe/routes.js';
import { createV1Router } from './collector/v1/routes.js';
import type { LoadedV1Config } from './collector/v1/config.js';
import type { SiteWriteTokenRow } from './auth/workspace.js';

export interface CreateAppOptions {
  pool: Pool;
  v1Loaded: LoadedV1Config;
  /**
   * Already-split CORS allow-list. The factory does NOT read process.env;
   * caller (src/server.ts in prod, tests in test) computes this from env or
   * passes a hard-coded list.
   */
  allowed_origins: string[];
  /**
   * Optional structured error sink for the v1 router. Defaults to
   * console.error in prod; tests inject silence + capture. NEVER receives
   * raw payloads, tokens, or hashes (per PR#7 safe-log contract).
   */
  log_error?: (event: { request_id: string; kind: string; message: string }) => void;
}

/**
 * Build a fully-wired Express app. Idempotent and side-effect-free apart
 * from constructing one Express instance.
 */
export function createApp(opts: CreateAppOptions): Express {
  const { pool, v1Loaded, allowed_origins, log_error } = opts;
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowed_origins.includes(origin)) callback(null, true);
        else callback(null, false);
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'content-type', 'Authorization', 'authorization'],
      credentials: true,
      maxAge: 86400,
    }),
  );

  // Sprint 1 PR#7 — v1 collector routes mounted BEFORE express.json so the
  // route-scoped express.raw inside the v1 router captures exact body bytes
  // for ingest_requests.request_body_sha256. The legacy /collect, /config,
  // /probe routes continue to use the global JSON parser below.
  app.use(
    createV1Router({
      pool,
      config: v1Loaded.config,
      site_write_token_pepper: v1Loaded.site_write_token_pepper,
      enable_v1_batch: v1Loaded.enable_v1_batch,
      lookupByHash: async (hash): Promise<SiteWriteTokenRow | null> => {
        const result = await pool.query(
          'SELECT token_id, workspace_id, site_id, disabled_at FROM site_write_tokens WHERE token_hash = $1 LIMIT 1',
          [hash],
        );
        return (result.rows[0] as SiteWriteTokenRow | undefined) ?? null;
      },
      ...(log_error !== undefined ? { log_error } : {}),
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(collectorRoutes);
  app.use(configRoutes);
  app.use(probeRoutes);

  return app;
}
