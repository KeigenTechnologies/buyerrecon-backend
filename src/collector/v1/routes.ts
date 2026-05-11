/**
 * Sprint 1 PR#7 — v1 collector routes (Track B).
 *
 * Mounts POST /v1/event and POST /v1/batch on an Express router with a
 * route-scoped express.raw middleware. /v1/batch is feature-gated by
 * deps.enable_v1_batch — when false, returns HTTP 404 { error: 'v1_batch_disabled' }
 * WITHOUT calling runRequest and WITHOUT writing to the DB.
 *
 * Per-route flow (per planning §D + §I):
 *   1. Generate request_id + received_at via injectable deps.
 *   2. Build RequestContext (raw_body_bytes is the exact express.raw Buffer).
 *   3. Extract bearer token from Authorization header.
 *   4. Resolve auth via the prefetch-adapter helper.
 *   5. If ctx.ip is null → HTTP 500 { request_id, error: 'collector_misconfigured' }.
 *   6. Call runRequest({ ctx, auth, config }).
 *   7. Persist OrchestratorOutput via writeOrchestratorOutput (transaction).
 *      Persistence may reclassify accepted candidates as duplicate rejected
 *      rows; final response.results / counts reflect actual DB state.
 *   8. Return { final_http_status, final_response }.
 *   9. Best-effort UPDATE site_write_tokens.last_used_at outside the main
 *      transaction. Never blocks the response.
 *
 * Error handling — every failure path returns 500 with a safe-enum error
 * code only; no raw payloads, no token hashes, no env names, no PG details.
 *
 * NOT Track A scoring. NOT Core AMS product code.
 */

import { Router, type Request, type Response } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { runRequest, type CollectorConfig, type RunRequestInput } from './orchestrator.js';
import { buildRequestContext } from './http-context.js';
import {
  resolveAuthForRunRequest,
  type AsyncLookupByHash,
} from './auth-route.js';
import { writeOrchestratorOutput, touchTokenLastUsedAt } from './persistence.js';

/* --------------------------------------------------------------------------
 * Public deps contract
 * ------------------------------------------------------------------------ */

export interface V1RouterDeps {
  pool: Pool;
  config: CollectorConfig;
  site_write_token_pepper: string;
  lookupByHash: AsyncLookupByHash;
  enable_v1_batch: boolean;
  /** Injectable for deterministic tests. Defaults to crypto.randomUUID. */
  uuid?: () => string;
  /** Injectable clock. Defaults to () => new Date(). */
  now?: () => Date;
  /**
   * Injectable error logger. Defaults to console.error. Tests stub to silence
   * + capture. MUST NOT log raw payloads, tokens, or hashes.
   */
  log_error?: (event: { request_id: string; kind: string; message: string }) => void;
}

/* --------------------------------------------------------------------------
 * Router factory
 * ------------------------------------------------------------------------ */

export function createV1Router(deps: V1RouterDeps): Router {
  const router = Router();

  // Route-scoped raw body capture. 1mb is the OUTER transport cap — above the
  // 512 KB batch contract limit so runRequest can still emit batch_too_large
  // ledger rows for in-near-miss bodies. The contract limits (32 KB / 512 KB
  // / 100 events) are enforced inside parseEnvelope at the orchestrator.
  // type:'*/*' so malformed Content-Type bodies still reach our handler
  // (runRequest emits content_type_invalid then).
  router.use(express.raw({ type: '*/*', limit: '1mb' }));

  const uuid = deps.uuid ?? randomUUID;
  const now = deps.now ?? (() => new Date());
  const logError =
    deps.log_error ??
    ((event) => {
      // eslint-disable-next-line no-console
      console.error('v1 collector error', event);
    });

  router.post('/v1/event', async (req, res) => {
    await handleV1Request(req, res, '/v1/event', deps, uuid, now, logError);
  });

  router.post('/v1/batch', async (req, res) => {
    // Feature-flag gate per handoff Decision #1 + locked PR#7 decision #6.
    // Safe 404 + structured body; do NOT call runRequest, do NOT write DB.
    if (deps.enable_v1_batch !== true) {
      res.status(404).json({ error: 'v1_batch_disabled' });
      return;
    }
    await handleV1Request(req, res, '/v1/batch', deps, uuid, now, logError);
  });

  return router;
}

/* --------------------------------------------------------------------------
 * Shared handler
 * ------------------------------------------------------------------------ */

async function handleV1Request(
  req: Request,
  res: Response,
  endpoint: '/v1/event' | '/v1/batch',
  deps: V1RouterDeps,
  uuid: () => string,
  now: () => Date,
  logError: NonNullable<V1RouterDeps['log_error']>,
): Promise<void> {
  // Raw body MUST come from the route-scoped express.raw middleware. If it
  // didn't (middleware bypass / misordering / earlier parser consumed the
  // body / runtime stripped req.body), refuse the request rather than
  // silently hashing empty bytes into request_body_sha256. Faking the hash
  // would corrupt every downstream evidence reconciliation.
  if (!Buffer.isBuffer(req.body)) {
    const requestId = uuid();
    logError({
      request_id: requestId,
      kind: 'collector_misconfigured',
      message: 'raw body middleware did not provide Buffer',
    });
    res.status(500).json({ request_id: requestId, error: 'collector_misconfigured' });
    return;
  }
  const rawBody: Buffer = req.body;

  const ctx = buildRequestContext(
    { uuid, now },
    { req, raw_body_bytes: rawBody, endpoint },
  );

  // Auth must run BEFORE the missing-IP check so that auth-only failures
  // (which still produce an ingest_request row) get persisted through the
  // normal runRequest path. But the ingest_request row requires a non-null
  // ctx.ip via buildIngestRequestRow, so if ip is null we cannot persist
  // ANY ingest row — return collector_misconfigured immediately.
  if (ctx.ip === null) {
    logError({
      request_id: ctx.request_id,
      kind: 'collector_misconfigured',
      message: 'missing client ip (req.socket.remoteAddress null)',
    });
    res.status(500).json({ request_id: ctx.request_id, error: 'collector_misconfigured' });
    return;
  }

  // Auth lookup. DB failures throw — caught below and mapped to 500
  // auth_lookup_failure (no ingest row written, since we haven't started the
  // transaction yet).
  let auth: RunRequestInput['auth'];
  try {
    auth = await resolveAuthForRunRequest(
      ctx.auth_header,
      deps.site_write_token_pepper,
      deps.lookupByHash,
    );
  } catch (err) {
    logError({
      request_id: ctx.request_id,
      kind: 'auth_lookup_failure',
      message: errorMessage(err),
    });
    res.status(500).json({ request_id: ctx.request_id, error: 'auth_lookup_failure' });
    return;
  }

  // Run the pure orchestrator. The only way it throws is the missing-IP
  // precondition (we already guarded above) or a contract violation
  // (auth.status==='ok' && auth.resolved===null — also guarded by the auth
  // helper which returns 'ok' only when resolved is set).
  let output;
  try {
    output = runRequest({ ctx, auth, config: deps.config });
  } catch (err) {
    logError({
      request_id: ctx.request_id,
      kind: 'collector_misconfigured',
      message: errorMessage(err),
    });
    res.status(500).json({ request_id: ctx.request_id, error: 'collector_misconfigured' });
    return;
  }

  // Persist. ON CONFLICT inside writeOrchestratorOutput silently rebuckets
  // PR#6 dedup hits; legacy 23505 is caught and reclassified the same way;
  // unknown 23505 / other errors roll back and rethrow → 500 storage_failure.
  let persistence;
  try {
    persistence = await writeOrchestratorOutput(deps.pool, output);
  } catch (err) {
    logError({
      request_id: ctx.request_id,
      kind: 'storage_failure',
      message: errorMessage(err),
    });
    res.status(500).json({ request_id: ctx.request_id, error: 'storage_failure' });
    return;
  }

  // Best-effort token last_used_at touch — OUTSIDE main transaction, never
  // awaited in the response critical path.
  if (auth.status === 'ok' && auth.resolved !== null) {
    void touchTokenLastUsedAt(deps.pool, auth.resolved.token_id);
  }

  res.status(persistence.final_http_status).json(persistence.final_response);
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

/**
 * Stringify an unknown error to its message field only, never the full object
 * or stack — keeps PG error details / stack traces out of logs. Tests assert
 * sensitive markers never appear in logged events.
 */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'unknown error';
}
