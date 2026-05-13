/**
 * Sprint 2 PR#11c — POI Core Worker.
 *
 * Manual-CLI batch trigger. NO cron, NO queue, NO post-commit hook,
 * NO scheduler (per PR#11a OD-6 + PR#11c OD-4).
 *
 * Pipeline:
 *   1. PR#4 contract guards (assertScoringContractsOrThrow +
 *      assertActiveScoringSourceCleanOrThrow).
 *   2. Validate caller's poi_input_version against
 *      POI_CORE_INPUT_VERSION (defence-in-depth before SQL).
 *   3. SELECT session_features rows (window + optional filters).
 *   4. For each SF row:
 *      - triage identity
 *      - Stage 0 side-read by lineage (0 / 1 / 2+ → absent / use / invalid)
 *      - map row → BuildPoiCoreInputArgs (or row-level reject)
 *      - buildPoiCoreInput(args)  [PR#10 adapter — throws on validation]
 *      - assemble upsert parameters + INSERT … ON CONFLICT DO UPDATE
 *      - count inserted / updated
 *   5. Aggregate WorkerReport, return.
 *
 * Forbidden reads: `session_behavioural_features_v0_2`,
 * `accepted_events`, `rejected_events`, `ingest_requests`,
 * `risk_observations_v0_1`, `scoring_output_lane_a`,
 * `scoring_output_lane_b`, `site_write_tokens`.
 * Forbidden writes: any table other than `poi_observations_v0_1`.
 *
 * No customer-facing output. No Lane A/B writes. No Policy/Trust/
 * Series/Product-Context-Fit implementation. No Render production
 * deploy (A0 P-4 still blocking).
 *
 * SQL/connection errors propagate to the CLI (which exits non-zero).
 * Only data-shape errors become row-level rejects.
 */

import pg from 'pg';
import {
  assertActiveScoringSourceCleanOrThrow,
  assertScoringContractsOrThrow,
} from '../contracts.js';
import {
  buildPoiCoreInput,
  POI_CORE_INPUT_VERSION,
  POI_TYPES_ALLOWED,
  POI_SURFACE_CLASSES_ALLOWED,
  REFERRER_CLASSES_ALLOWED,
  POI_TYPE,
  type PoiCoreInput,
  type PoiSourceTable,
  type PoiStage0Context,
  type PoiSurfaceClass,
  type PoiType,
  type ReferrerClass,
} from '../poi-core/index.js';
import {
  classifyAdapterError,
  mapSessionFeaturesRowToArgs,
  mapStage0Row,
  type MapperOutcome,
} from './mapper.js';
import {
  SELECT_SESSION_FEATURES_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
  UPSERT_POI_OBSERVATION_SQL,
} from './query.js';
import { buildUpsertParams } from './upsert.js';
import {
  POI_OBSERVATION_VERSION_DEFAULT,
  REJECT_REASONS,
  type RejectReason,
  type SessionFeaturesRowRaw,
  type Stage0RowRaw,
  type UpsertAction,
  type WorkerReport,
  type WorkerRowResult,
  type WorkerRunMetadata,
  type WorkerRunOptions,
} from './types.js';

const PRIMARY_SOURCE_TABLES: readonly PoiSourceTable[] = Object.freeze([
  'session_features',
  'session_behavioural_features_v0_2',
]);

/* --------------------------------------------------------------------------
 * Stage 0 side-read truth table — mirrors PR#11b §5.1.1 Path B
 *
 * PR#11c source rows (SF) do NOT carry stage0_decision_id pointers,
 * so there is no Path A (exact pointer lookup). Only Path B (lineage
 * by workspace_id + site_id + session_id). 0 rows → absent; 1 → use;
 * 2+ → INVALID_STAGE0_CONTEXT.
 * ------------------------------------------------------------------------ */

type Stage0LookupOutcome =
  | { readonly outcome: 'use'; readonly stage0: PoiStage0Context }
  | { readonly outcome: 'absent' }
  | { readonly outcome: 'invalid'; readonly detail: string };

async function resolveStage0(
  client:      pg.Pool | pg.PoolClient | pg.Client,
  workspaceId: string,
  siteId:      string,
  sessionId:   string,
): Promise<Stage0LookupOutcome> {
  // SQL/connection errors propagate out of resolveStage0 → processRow
  // → runPoiCoreWorker → CLI catch.
  const r = await client.query<Stage0RowRaw>(SELECT_STAGE0_BY_LINEAGE_SQL, [workspaceId, siteId, sessionId]);
  if (r.rowCount === 0) {
    return { outcome: 'absent' };
  }
  if (r.rowCount !== null && r.rowCount > 1) {
    return {
      outcome: 'invalid',
      detail:  `Stage 0 lineage fallback resolved ${r.rowCount} stage0_decisions rows for (workspace, site, session) — worker MUST NOT guess which Stage 0 row to consume`,
    };
  }
  const out = mapStage0Row(r.rows[0]!);
  if (out.outcome === 'ok') return { outcome: 'use', stage0: out.stage0 };
  return { outcome: 'invalid', detail: out.detail };
}

/* --------------------------------------------------------------------------
 * Per-row processor
 *
 * SF row → Stage 0 side-read → mapper → PR#10 adapter → UPSERT.
 * SQL/connection errors propagate; only data-shape errors become
 * row-level rejects.
 * ------------------------------------------------------------------------ */

interface ProcessRowCommon {
  readonly poi_input_version:       string;
  readonly poi_observation_version: string;
  readonly scoring_version:         string;
}

async function processRow(
  client: pg.Pool | pg.PoolClient | pg.Client,
  row:    SessionFeaturesRowRaw,
  common: ProcessRowCommon,
): Promise<WorkerRowResult> {
  const workspaceId = typeof row.workspace_id === 'string' && row.workspace_id.length > 0 ? row.workspace_id : null;
  const siteId      = typeof row.site_id      === 'string' && row.site_id.length      > 0 ? row.site_id      : null;
  const sessionId   = typeof row.session_id   === 'string' && row.session_id.length   > 0 ? row.session_id   : null;

  let stage0ContextOrNull: PoiStage0Context | null = null;
  if (workspaceId !== null && siteId !== null && sessionId !== null) {
    const lookup = await resolveStage0(client, workspaceId, siteId, sessionId);
    if (lookup.outcome === 'invalid') {
      return {
        outcome:    'rejected',
        reason:     'INVALID_STAGE0_CONTEXT',
        session_id: sessionId,
        detail:     lookup.detail,
      };
    }
    if (lookup.outcome === 'use') {
      stage0ContextOrNull = lookup.stage0;
    }
    // 'absent' → envelope still builds with stage0_excluded=false /
    // poi_eligible=true via the PR#10 adapter defaults.
  }

  // Map SF row → BuildPoiCoreInputArgs
  const mapped: MapperOutcome = mapSessionFeaturesRowToArgs(row, stage0ContextOrNull, {
    poi_input_version: common.poi_input_version,
    scoring_version:   common.scoring_version,
  });
  if (mapped.outcome === 'rejected') {
    return {
      outcome:    'rejected',
      reason:     mapped.reason,
      session_id: sessionId,
      detail:     mapped.detail,
    };
  }

  // PR#10 adapter (throws on validation)
  let envelope: PoiCoreInput;
  try {
    envelope = buildPoiCoreInput(mapped.input);
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    return {
      outcome:    'rejected',
      reason:     classifyAdapterError(message),
      session_id: sessionId,
      detail:     message,
    };
  }

  // Build upsert parameters (local invariant guards on top of PR#10's)
  let upsertParams: readonly unknown[];
  try {
    upsertParams = buildUpsertParams({
      envelope,
      poi_observation_version: common.poi_observation_version,
      poi_key_source_field:    mapped.poi_key_source_field,
      source_versions:         mapped.source_versions,
    });
  } catch (err) {
    return {
      outcome:    'rejected',
      reason:     'ADAPTER_VALIDATION_ERROR',
      session_id: sessionId,
      detail:     (err as Error).message ?? String(err),
    };
  }

  // UPSERT (SQL/connection errors propagate)
  const upsertResult = await client.query<{ poi_observation_id: number | string; inserted: boolean }>(
    UPSERT_POI_OBSERVATION_SQL,
    upsertParams as unknown[],
  );
  const inserted = upsertResult.rows[0]?.inserted === true;
  const action: UpsertAction = inserted ? 'inserted' : 'updated';

  return {
    outcome:       'upserted',
    envelope,
    session_id:    envelope.session_id,
    upsert_action: action,
  };
}

/* --------------------------------------------------------------------------
 * Masking helpers (mirror PR#11b precedent)
 * ------------------------------------------------------------------------ */

export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  const prefix = sessionId.slice(0, 8);
  const suffix = sessionId.slice(-4);
  return `${prefix}…${suffix}`;
}

export function parseDatabaseUrl(url: string | undefined): { host: string; name: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { host: '<unset>', name: '<unset>' };
  }
  try {
    const u = new URL(url);
    const host = u.host || '<host>';
    const name = u.pathname.replace(/^\//, '') || '<db>';
    return { host, name };
  } catch {
    return { host: '<unparseable>', name: '<unparseable>' };
  }
}

/* --------------------------------------------------------------------------
 * Aggregator — builds the WorkerReport from per-row outcomes
 * ------------------------------------------------------------------------ */

function newRejectCounter(): Record<RejectReason, number> {
  const out = Object.create(null) as Record<RejectReason, number>;
  for (const r of REJECT_REASONS) out[r] = 0;
  return out;
}

function newPoiTypeCounter(): Record<PoiType, number> {
  const out = Object.create(null) as Record<PoiType, number>;
  for (const t of POI_TYPES_ALLOWED) out[t] = 0;
  return out;
}

function newPoiSurfaceClassCounter(): Record<PoiSurfaceClass, number> {
  const out = Object.create(null) as Record<PoiSurfaceClass, number>;
  for (const c of POI_SURFACE_CLASSES_ALLOWED) out[c] = 0;
  return out;
}

function newReferrerClassCounter(): Record<ReferrerClass, number> {
  const out = Object.create(null) as Record<ReferrerClass, number>;
  for (const c of REFERRER_CLASSES_ALLOWED) out[c] = 0;
  return out;
}

function newSourceTableCounter(): Record<PoiSourceTable, number> {
  const out = Object.create(null) as Record<PoiSourceTable, number>;
  for (const t of PRIMARY_SOURCE_TABLES) out[t] = 0;
  return out;
}

export interface AggregateInputs {
  readonly results:        readonly WorkerRowResult[];
  readonly rows_scanned:   number;
  readonly sample_limit:   number;
  readonly run_metadata:   WorkerRunMetadata;
}

export function aggregateReport(args: AggregateInputs): WorkerReport {
  const reject_reasons:                  Record<RejectReason, number>     = newRejectCounter();
  const poi_type_distribution:           Record<PoiType, number>          = newPoiTypeCounter();
  const poi_surface_class_distribution:  Record<PoiSurfaceClass, number>  = newPoiSurfaceClassCounter();
  const referrer_class_distribution:     Record<ReferrerClass, number>    = newReferrerClassCounter();
  const source_table_distribution:       Record<PoiSourceTable, number>   = newSourceTableCounter();
  const sample:                          string[]                         = [];
  const seenSessions:                    Set<string>                      = new Set();

  let rows_inserted          = 0;
  let rows_updated           = 0;
  // rows_unchanged is reserved for a future compare-and-skip mode
  // (PR#11c v0.1 always sets updated_at = NOW(), so this is 0).
  const rows_unchanged       = 0;
  let rejects                = 0;
  let stage0_excluded_count  = 0;
  let eligible_for_poi_count = 0;

  for (const r of args.results) {
    const sid = r.outcome === 'upserted' ? r.session_id : r.session_id;
    if (sid !== null) seenSessions.add(sid);

    if (r.outcome === 'upserted') {
      if (r.upsert_action === 'inserted') rows_inserted += 1;
      else if (r.upsert_action === 'updated') rows_updated += 1;

      const env = r.envelope;
      poi_type_distribution[env.poi.poi_type] = (poi_type_distribution[env.poi.poi_type] ?? 0) + 1;

      const surfaceClass = env.poi.poi_surface_class;
      if (surfaceClass !== null) {
        poi_surface_class_distribution[surfaceClass] =
          (poi_surface_class_distribution[surfaceClass] ?? 0) + 1;
      }

      if (env.poi.poi_type === POI_TYPE.REFERRER_CLASS) {
        const referrerClass = env.poi.poi_key as ReferrerClass;
        if (referrer_class_distribution[referrerClass] !== undefined) {
          referrer_class_distribution[referrerClass] += 1;
        }
      }

      source_table_distribution[env.source_identity.source_table] =
        (source_table_distribution[env.source_identity.source_table] ?? 0) + 1;

      if (env.eligibility.stage0_excluded === true) stage0_excluded_count += 1;
      if (env.eligibility.poi_eligible === true)    eligible_for_poi_count  += 1;

      if (sample.length < args.sample_limit && r.session_id) {
        sample.push(truncateSessionId(r.session_id));
      }
      continue;
    }

    // rejected
    rejects += 1;
    reject_reasons[r.reason] = (reject_reasons[r.reason] ?? 0) + 1;
  }

  return {
    rows_scanned:                 args.rows_scanned,
    rows_inserted,
    rows_updated,
    rows_unchanged,
    rejects,
    reject_reasons:                  Object.freeze(reject_reasons),
    poi_type_distribution:           Object.freeze(poi_type_distribution),
    poi_surface_class_distribution:  Object.freeze(poi_surface_class_distribution),
    referrer_class_distribution:     Object.freeze(referrer_class_distribution),
    source_table_distribution:       Object.freeze(source_table_distribution),
    stage0_excluded_count,
    eligible_for_poi_count,
    unsafe_poi_key_reject_count:  reject_reasons.INVALID_PAGE_PATH,
    evidence_ref_reject_count:    reject_reasons.EVIDENCE_REF_REJECT,
    unique_session_ids_seen:      seenSessions.size,
    sample_session_id_prefixes:   Object.freeze(sample.slice()),
    run_metadata:                 args.run_metadata,
  };
}

/* --------------------------------------------------------------------------
 * runPoiCoreWorker — public entry point
 * ------------------------------------------------------------------------ */

export interface RunWorkerArgs {
  readonly client:        pg.Pool | pg.PoolClient | pg.Client;
  readonly options:       WorkerRunOptions;
  readonly database_host: string;
  readonly database_name: string;
}

export async function runPoiCoreWorker(args: RunWorkerArgs): Promise<WorkerReport> {
  // §1 — PR#4 startup guards.
  assertScoringContractsOrThrow({ rootDir: args.options.rootDir });
  assertActiveScoringSourceCleanOrThrow({ rootDir: args.options.rootDir });

  // §2 — caller's poi_input_version must match POI_CORE_INPUT_VERSION
  // (defence in depth before any SQL fires).
  if (args.options.poi_input_version !== POI_CORE_INPUT_VERSION) {
    throw new Error(`PR#11c poi-core worker invalid: poi_input_version ${JSON.stringify(args.options.poi_input_version)} does not match POI_CORE_INPUT_VERSION ${JSON.stringify(POI_CORE_INPUT_VERSION)}`);
  }

  const run_started_at = new Date().toISOString();

  const common: ProcessRowCommon = {
    poi_input_version:       args.options.poi_input_version,
    poi_observation_version: args.options.poi_observation_version,
    scoring_version:         args.options.scoring_version,
  };

  const extractionVersion = args.options.extraction_version ?? null;
  const workspaceId       = args.options.workspace_id       ?? null;
  const siteId            = args.options.site_id            ?? null;

  // §3 — SELECT SF rows.
  const sfSelect = await args.client.query<SessionFeaturesRowRaw>(SELECT_SESSION_FEATURES_SQL, [
    extractionVersion,
    workspaceId,
    siteId,
    args.options.window_start,
    args.options.window_end,
    args.options.limit,
  ]);

  // §4 — per-row processing.
  const results: WorkerRowResult[] = [];
  for (const row of sfSelect.rows) {
    const r = await processRow(args.client, row, common);
    results.push(r);
  }

  const run_ended_at = new Date().toISOString();

  const run_metadata: WorkerRunMetadata = {
    poi_input_version:       args.options.poi_input_version,
    poi_observation_version: args.options.poi_observation_version,
    scoring_version:         args.options.scoring_version,
    extraction_version:      extractionVersion,
    window_start:            args.options.window_start.toISOString(),
    window_end:              args.options.window_end.toISOString(),
    database_host:           args.database_host,
    database_name:           args.database_name,
    run_started_at,
    run_ended_at,
    primary_source_tables:   Object.freeze<PoiSourceTable[]>(['session_features']),
    stage0_side_read_table:  'stage0_decisions',
    poi_type:                'page_path',
    target_table:            'poi_observations_v0_1',
    record_only:             true,
  };

  return aggregateReport({
    results,
    rows_scanned: sfSelect.rowCount ?? 0,
    sample_limit: args.options.sample_limit,
    run_metadata,
  });
}

/* --------------------------------------------------------------------------
 * Pure-test entry point — exposes `processRow` against an in-memory
 * stub client.
 * ------------------------------------------------------------------------ */

export type StubQueryFn = (sql: string, params: readonly unknown[]) => Promise<{ rows: readonly unknown[]; rowCount: number | null }>;

export interface StubClient {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

export function makeStubClient(fn: StubQueryFn): StubClient {
  return {
    async query<T = unknown>(sql: string, params: readonly unknown[] = []) {
      const r = await fn(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount };
    },
  };
}

export async function processRowForTest(
  client: StubClient,
  row:    SessionFeaturesRowRaw,
  common: ProcessRowCommon,
): Promise<WorkerRowResult> {
  return processRow(client as unknown as pg.Pool, row, common);
}

/* --------------------------------------------------------------------------
 * Env-var parsing for the CLI runner
 *
 * Co-located with the worker (PR#6 precedent). The CLI is then a
 * thin wrapper that opens a pg pool, calls `runPoiCoreWorker`,
 * prints the PASS summary, closes the pool.
 * ------------------------------------------------------------------------ */

export interface WorkerEnvOpts {
  readonly databaseUrl: string;
  readonly options:     WorkerRunOptions;
}

const DEFAULT_WINDOW_HOURS = 720;
const DEFAULT_LIMIT        = 10_000;
const DEFAULT_SAMPLE_LIMIT = 10;
const DEFAULT_SCORING_VER  = 's2.v1.0';

export function parsePoiCoreWorkerEnvOptions(
  env: NodeJS.ProcessEnv = process.env,
  now: Date              = new Date(),
): WorkerEnvOpts {
  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required (host + db name will be printed; full URL is never printed)');
  }

  const workspace_id = typeof env.WORKSPACE_ID === 'string' && env.WORKSPACE_ID.length > 0
    ? env.WORKSPACE_ID : null;
  const site_id = typeof env.SITE_ID === 'string' && env.SITE_ID.length > 0
    ? env.SITE_ID : null;
  const extraction_version = typeof env.EXTRACTION_VERSION === 'string' && env.EXTRACTION_VERSION.length > 0
    ? env.EXTRACTION_VERSION : null;

  // Window
  let window_end: Date;
  if (typeof env.UNTIL === 'string' && env.UNTIL.length > 0) {
    const u = Date.parse(env.UNTIL);
    if (!Number.isFinite(u)) throw new Error(`UNTIL is not a parseable timestamp: ${JSON.stringify(env.UNTIL)}`);
    window_end = new Date(u);
  } else {
    window_end = now;
  }
  let window_start: Date;
  if (typeof env.SINCE === 'string' && env.SINCE.length > 0) {
    const s = Date.parse(env.SINCE);
    if (!Number.isFinite(s)) throw new Error(`SINCE is not a parseable timestamp: ${JSON.stringify(env.SINCE)}`);
    window_start = new Date(s);
  } else {
    const rawHours = env.WINDOW_HOURS ?? String(DEFAULT_WINDOW_HOURS);
    const hours = Number.parseInt(rawHours, 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error(`WINDOW_HOURS must be a positive integer (got ${JSON.stringify(rawHours)})`);
    }
    window_start = new Date(window_end.getTime() - hours * 3600 * 1000);
  }
  if (window_start.getTime() >= window_end.getTime()) {
    throw new Error('window_start must be strictly before window_end');
  }

  // Limits
  const rawLimit = env.WORKER_LIMIT ?? String(DEFAULT_LIMIT);
  const limit = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`WORKER_LIMIT must be a positive integer (got ${JSON.stringify(rawLimit)})`);
  }
  const rawSampleLimit = env.SAMPLE_LIMIT ?? String(DEFAULT_SAMPLE_LIMIT);
  const sample_limit = Number.parseInt(rawSampleLimit, 10);
  if (!Number.isFinite(sample_limit) || sample_limit < 0) {
    throw new Error(`SAMPLE_LIMIT must be a non-negative integer (got ${JSON.stringify(rawSampleLimit)})`);
  }

  const poi_input_version = typeof env.POI_INPUT_VERSION === 'string' && env.POI_INPUT_VERSION.length > 0
    ? env.POI_INPUT_VERSION : POI_CORE_INPUT_VERSION;
  const poi_observation_version = typeof env.POI_OBSERVATION_VERSION === 'string' && env.POI_OBSERVATION_VERSION.length > 0
    ? env.POI_OBSERVATION_VERSION : POI_OBSERVATION_VERSION_DEFAULT;
  const scoring_version = typeof env.SCORING_VERSION === 'string' && env.SCORING_VERSION.length > 0
    ? env.SCORING_VERSION : DEFAULT_SCORING_VER;

  return {
    databaseUrl,
    options: {
      poi_input_version,
      poi_observation_version,
      scoring_version,
      extraction_version,
      workspace_id,
      site_id,
      window_start,
      window_end,
      limit,
      sample_limit,
    },
  };
}
