/**
 * Sprint 2 PR#11b — POI Core Input Observer — runner.
 *
 * Orchestrator. Takes an already-constructed `pg.Pool` / `pg.Client`
 * + `ObserverRunOptions`, issues the read-only SELECTs (sql.ts),
 * runs the Stage 0 side-read truth table, calls the pure mapper
 * (mapper.ts), invokes PR#10's pure `buildPoiCoreInput`, catches all
 * adapter errors as observer diagnostics, aggregates via report.ts.
 *
 * The runner DOES NOT read `process.env`. The CLI is responsible
 * for parsing env vars and supplying the options. This keeps the
 * runner testable from in-memory fixtures.
 *
 * No DB writes. No psql. No Lane A / Lane B reads. No raw upstream
 * reads. No envelope persistence (PR#11a §5.1 / PR#9a OD-8).
 *
 * SQL/connection errors propagate out of the runner to the CLI
 * (which exits 2). Only data-shape errors become row-level rejects.
 * This mirrors the PR#8b Codex blocker fix: SQL/connection failures
 * are NOT silently swallowed.
 */

import pg from 'pg';
import {
  buildPoiCoreInput,
  POI_CORE_INPUT_VERSION,
  type PoiCoreInput,
  type PoiSourceTable,
  type PoiStage0Context,
} from '../poi-core/index.js';
import {
  classifyAdapterError,
  mapSessionBehaviouralFeaturesRow,
  mapSessionFeaturesRow,
  mapStage0Row,
  type MapperOutcome,
} from './mapper.js';
import { aggregateReport, parseDatabaseUrl } from './report.js';
import {
  SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL,
  SELECT_SESSION_FEATURES_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
} from './sql.js';
import type {
  ObserverReport,
  ObserverRowResult,
  ObserverRunMetadata,
  ObserverRunOptions,
  SessionBehaviouralFeaturesRowRaw,
  SessionFeaturesRowRaw,
  Stage0RowRaw,
} from './types.js';

/* --------------------------------------------------------------------------
 * Stage 0 side-read — mirrors PR#8b §5.1.1 Path B
 *
 * PR#11b sources do NOT carry stage0_decision_id pointers (SF/SBF
 * schemas have no evidence_refs column), so there is no Path A
 * (exact pointer lookup). Only Path B (lineage lookup by
 * workspace_id + site_id + session_id).
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
  // SQL-path errors (connection / permission / network) from this
  // .query() call are NOT caught here. They propagate out of
  // resolveStage0 → out of processRow → out of
  // runPoiCoreInputObserver → CLI catch → exit 2.
  const r = await client.query<Stage0RowRaw>(SELECT_STAGE0_BY_LINEAGE_SQL, [workspaceId, siteId, sessionId]);
  if (r.rowCount === 0) {
    return { outcome: 'absent' };
  }
  if (r.rowCount !== null && r.rowCount > 1) {
    return {
      outcome: 'invalid',
      detail:  `Stage 0 lineage fallback resolved ${r.rowCount} stage0_decisions rows for (workspace, site, session) — observer MUST NOT guess which Stage 0 row to consume`,
    };
  }
  const out = mapStage0Row(r.rows[0]!);
  if (out.outcome === 'ok') return { outcome: 'use', stage0: out.stage0 };
  return { outcome: 'invalid', detail: out.detail };
}

/* --------------------------------------------------------------------------
 * Per-row processor
 *
 * Common path: triage identity → side-read Stage 0 by lineage → map
 * to BuildPoiCoreInputArgs → call PR#10 adapter (try/catch) → return
 * outcome.
 *
 * SQL/connection errors from the Stage 0 lookup propagate. Data-shape
 * errors are mapped to row-level rejects.
 * ------------------------------------------------------------------------ */

interface ProcessRowCommon {
  readonly poi_input_version: string;
  readonly scoring_version:   string;
}

async function processRow(
  client:      pg.Pool | pg.PoolClient | pg.Client,
  sourceTable: PoiSourceTable,
  row:         SessionFeaturesRowRaw | SessionBehaviouralFeaturesRowRaw,
  common:      ProcessRowCommon,
): Promise<ObserverRowResult> {
  const workspaceId = typeof row.workspace_id === 'string' && row.workspace_id.length > 0 ? row.workspace_id : null;
  const siteId      = typeof row.site_id      === 'string' && row.site_id.length      > 0 ? row.site_id      : null;
  const sessionId   = typeof row.session_id   === 'string' && row.session_id.length   > 0 ? row.session_id   : null;

  let stage0ContextOrNull: PoiStage0Context | null = null;
  if (workspaceId !== null && siteId !== null && sessionId !== null) {
    const lookup = await resolveStage0(client, workspaceId, siteId, sessionId);
    if (lookup.outcome === 'invalid') {
      return {
        outcome:      'rejected',
        reason:       'INVALID_STAGE0_CONTEXT',
        session_id:   sessionId,
        source_table: sourceTable,
        detail:       lookup.detail,
      };
    }
    if (lookup.outcome === 'use') {
      stage0ContextOrNull = lookup.stage0;
    }
    // 'absent' → no stage0 forwarded; envelope still builds with
    // stage0_excluded=false / poi_eligible=true via the PR#10 adapter
    // defaults.
  }

  // Map raw row → BuildPoiCoreInputArgs
  const mapped: MapperOutcome = sourceTable === 'session_features'
    ? mapSessionFeaturesRow(row as SessionFeaturesRowRaw, stage0ContextOrNull, common)
    : mapSessionBehaviouralFeaturesRow(row as SessionBehaviouralFeaturesRowRaw, stage0ContextOrNull, common);

  if (mapped.outcome === 'rejected') {
    return {
      outcome:      'rejected',
      reason:       mapped.reason,
      session_id:   sessionId,
      source_table: sourceTable,
      detail:       mapped.detail,
    };
  }

  // Call the PR#10 pure adapter (throws on validation)
  let envelope: PoiCoreInput;
  try {
    envelope = buildPoiCoreInput(mapped.input);
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    return {
      outcome:      'rejected',
      reason:       classifyAdapterError(message),
      session_id:   sessionId,
      source_table: sourceTable,
      detail:       message,
    };
  }

  return {
    outcome:      'envelope_built',
    envelope,
    session_id:   envelope.session_id,
    source_table: sourceTable,
  };
}

/* --------------------------------------------------------------------------
 * runPoiCoreInputObserver — public entry point
 *
 * Reads SF + SBF rows (two SELECTs), builds envelopes in memory,
 * aggregates a report, returns it. Discards envelopes (no persistence).
 * Caller is responsible for the pg pool lifecycle.
 * ------------------------------------------------------------------------ */

export interface RunObserverArgs {
  readonly client:        pg.Pool | pg.PoolClient | pg.Client;
  readonly options:       ObserverRunOptions;
  readonly database_host: string;
  readonly database_name: string;
}

export async function runPoiCoreInputObserver(args: RunObserverArgs): Promise<ObserverReport> {
  // Defence in depth: re-validate the contract version the CLI passed
  // before any SQL fires. The PR#10 adapter will also reject, but
  // this short-circuits any pointless DB work if the caller is wrong.
  if (args.options.poi_input_version !== POI_CORE_INPUT_VERSION) {
    throw new Error(`PR#11b POI observer invalid: poi_input_version ${JSON.stringify(args.options.poi_input_version)} does not match POI_CORE_INPUT_VERSION ${JSON.stringify(POI_CORE_INPUT_VERSION)}`);
  }

  const run_started_at = new Date().toISOString();

  const common: ProcessRowCommon = {
    poi_input_version: args.options.poi_input_version,
    scoring_version:   args.options.scoring_version,
  };

  const extractionVersion = args.options.extraction_version ?? null;
  const featureVersion    = args.options.feature_version    ?? null;
  const workspaceId       = args.options.workspace_id       ?? null;
  const siteId            = args.options.site_id            ?? null;

  // ---- SF SELECT ----------------------------------------------------------
  const sfSelect = await args.client.query<SessionFeaturesRowRaw>(SELECT_SESSION_FEATURES_SQL, [
    extractionVersion,
    workspaceId,
    siteId,
    args.options.window_start,
    args.options.window_end,
    args.options.limit,
  ]);

  // ---- SBF SELECT ---------------------------------------------------------
  const sbfSelect = await args.client.query<SessionBehaviouralFeaturesRowRaw>(SELECT_SESSION_BEHAVIOURAL_FEATURES_SQL, [
    featureVersion,
    workspaceId,
    siteId,
    args.options.window_start,
    args.options.window_end,
    args.options.limit,
  ]);

  const results: ObserverRowResult[] = [];

  for (const row of sfSelect.rows) {
    const r = await processRow(args.client, 'session_features', row, common);
    results.push(r);
  }
  for (const row of sbfSelect.rows) {
    const r = await processRow(args.client, 'session_behavioural_features_v0_2', row, common);
    results.push(r);
  }

  const run_ended_at = new Date().toISOString();

  const run_metadata: ObserverRunMetadata = {
    poi_input_version:      args.options.poi_input_version,
    scoring_version:        args.options.scoring_version,
    extraction_version:     extractionVersion,
    feature_version:        featureVersion,
    window_start:           args.options.window_start.toISOString(),
    window_end:             args.options.window_end.toISOString(),
    database_host:          args.database_host,
    database_name:          args.database_name,
    run_started_at,
    run_ended_at,
    primary_source_tables:  Object.freeze<PoiSourceTable[]>(['session_features', 'session_behavioural_features_v0_2']),
    stage0_side_read_table: 'stage0_decisions',
    poi_type:               'page_path',
    record_only:            true,
  };

  return aggregateReport({
    results,
    rows_scanned_by_source_table: {
      session_features:                  sfSelect.rowCount ?? 0,
      session_behavioural_features_v0_2: sbfSelect.rowCount ?? 0,
    },
    sample_limit: args.options.sample_limit,
    run_metadata,
  });
}

/* --------------------------------------------------------------------------
 * Pure-test entry point — exposes `processRow` against an in-memory
 * mock client so tests can exercise the Stage 0 truth table + the
 * mapper without a real pg connection.
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
  client:      StubClient,
  sourceTable: PoiSourceTable,
  row:         SessionFeaturesRowRaw | SessionBehaviouralFeaturesRowRaw,
  common:      ProcessRowCommon,
): Promise<ObserverRowResult> {
  return processRow(client as unknown as pg.Pool, sourceTable, row, common);
}

/* --------------------------------------------------------------------------
 * Re-export helpers used by the CLI
 * ------------------------------------------------------------------------ */

export { parseDatabaseUrl };
