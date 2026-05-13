/**
 * Sprint 2 PR#8b — AMS Risk Core Bridge Observer — runner.
 *
 * Orchestrator. Takes an already-constructed `pg.Pool` / `pg.Client`
 * + `ObserverRunOptions`, issues the read-only SELECTs (sql.ts),
 * runs the §5.1.1 Stage 0 truth-table, calls the pure mapper
 * (mapper.ts), invokes PR#7b's pure `buildRiskCoreBridgeEnvelope`,
 * catches all errors as observer diagnostics, aggregates via
 * report.ts.
 *
 * The runner DOES NOT read `process.env`. The CLI is responsible
 * for parsing env vars and supplying the options. This keeps the
 * runner testable from in-memory fixtures.
 *
 * No DB writes. No psql. No Lane A / Lane B reads. No raw upstream
 * reads. No envelope persistence (PR#8a OD-8).
 */

import pg from 'pg';
import {
  buildRiskCoreBridgeEnvelope,
  RISK_CORE_BRIDGE_ENVELOPE_VERSION,
  type BridgeStage0Context,
  type EvidenceRef,
  type RiskCoreBridgeEnvelope,
} from '../risk-core-bridge/index.js';
import {
  classifyAdapterError,
  extractStage0Pointers,
  isPlausibleUuid,
  mapRiskObservationRow,
  mapStage0Row,
  validateEvidenceRefsShape,
} from './mapper.js';
import { aggregateReport, parseDatabaseUrl } from './report.js';
import {
  SELECT_RISK_OBSERVATIONS_SQL,
  SELECT_STAGE0_BY_DECISION_ID_SQL,
  SELECT_STAGE0_BY_LINEAGE_SQL,
} from './sql.js';
import type {
  ObserverReport,
  ObserverRowResult,
  ObserverRunMetadata,
  ObserverRunOptions,
  RiskObservationRowRaw,
  Stage0RowRaw,
} from './types.js';

/* --------------------------------------------------------------------------
 * Stage 0 lookup — implements PR#8a §5.1.1 truth table
 * ------------------------------------------------------------------------ */

type Stage0LookupOutcome =
  | { readonly outcome: 'use'; readonly stage0: BridgeStage0Context }
  | { readonly outcome: 'absent' }
  | { readonly outcome: 'invalid'; readonly detail: string };

async function resolveStage0(
  client:        pg.Pool | pg.PoolClient | pg.Client,
  workspaceId:   string,
  siteId:        string,
  sessionId:     string,
  evidenceRefs:  readonly EvidenceRef[],
): Promise<Stage0LookupOutcome> {
  const { pointers } = extractStage0Pointers(evidenceRefs);

  if (pointers.length > 1) {
    return {
      outcome: 'invalid',
      detail:  `evidence_refs[] contains ${pointers.length} stage0_decision_id pointers (PR#8a §5.1.1 — multiple exact pointers is INVALID_STAGE0_CONTEXT)`,
    };
  }

  // Path A — exact pointer
  if (pointers.length === 1) {
    const pointer = pointers[0]!;

    // Codex blocker pre-validation: if the pointer is not a plausible
    // UUID string, the PostgreSQL `$1::uuid` cast inside
    // SELECT_STAGE0_BY_DECISION_ID_SQL would throw a 22P02 error.
    // That error is a *data* problem (malformed lineage), not a
    // SQL-path failure — so classify it as INVALID_STAGE0_CONTEXT
    // BEFORE issuing SQL. This avoids spurious CLI exit-2s when the
    // PR#6 row's evidence_refs has a malformed pointer.
    if (!isPlausibleUuid(pointer)) {
      return {
        outcome: 'invalid',
        detail:  `evidence_refs[] stage0_decision_id ${JSON.stringify(pointer)} is not a plausible UUID — observer rejects before issuing SQL ($1::uuid cast would fail with 22P02)`,
      };
    }

    // SQL-path errors (connection / permission / network) from this
    // .query() call are NOT caught here. They propagate out of
    // resolveStage0 → out of processRow → out of
    // runRiskCoreBridgeObserver → CLI catch → exit 2 (Codex blocker fix).
    const r = await client.query<Stage0RowRaw>(SELECT_STAGE0_BY_DECISION_ID_SQL, [pointer]);
    if (r.rowCount === 0) {
      return {
        outcome: 'invalid',
        detail:  `evidence_refs[] stage0_decision_id pointer ${JSON.stringify(pointer)} resolves to 0 stage0_decisions rows (dangling pointer / lineage break)`,
      };
    }
    if (r.rowCount !== null && r.rowCount > 1) {
      return {
        outcome: 'invalid',
        detail:  `evidence_refs[] stage0_decision_id pointer ${JSON.stringify(pointer)} resolves to ${r.rowCount} rows (PK lookup is supposed to be 1:1)`,
      };
    }
    const out = mapStage0Row(r.rows[0]!);
    if (out.outcome === 'ok') return { outcome: 'use', stage0: out.stage0 };
    return { outcome: 'invalid', detail: out.detail };
  }

  // Path B — lineage fallback. Same SQL-error-propagation rule as
  // Path A above: connection / permission / network errors are NOT
  // caught here.
  const r = await client.query<Stage0RowRaw>(SELECT_STAGE0_BY_LINEAGE_SQL, [workspaceId, siteId, sessionId]);
  if (r.rowCount === 0) {
    return { outcome: 'absent' };
  }
  if (r.rowCount !== null && r.rowCount > 1) {
    return {
      outcome: 'invalid',
      detail:  `lineage fallback resolved ${r.rowCount} stage0_decisions rows for (workspace, site, session) — observer MUST NOT guess`,
    };
  }
  const out = mapStage0Row(r.rows[0]!);
  if (out.outcome === 'ok') return { outcome: 'use', stage0: out.stage0 };
  return { outcome: 'invalid', detail: out.detail };
}

/* --------------------------------------------------------------------------
 * Per-row processor
 * ------------------------------------------------------------------------ */

async function processRow(
  client: pg.Pool | pg.PoolClient | pg.Client,
  row:    RiskObservationRowRaw,
): Promise<ObserverRowResult> {
  // Pull a string session_id for the rejection-path session_id (the
  // mapper rejects when this is empty, but we still want to log
  // something useful in pre-mapper bail-outs).
  const sessionIdForRejectPath = typeof row.session_id === 'string' && row.session_id.length > 0
    ? row.session_id
    : null;

  // ---- Pre-guard: evidence_refs SHAPE (Codex re-review fix) -----------
  // Validate evidence_refs structure BEFORE any Stage 0 SQL is
  // issued. Malformed entries (`[null]`, `["bad"]`, missing `.table`,
  // etc.) become a row-level MISSING_EVIDENCE_REFS reject — they do
  // NOT crash `extractStage0Pointers` and do NOT propagate as SQL-
  // path failures (which would exit the CLI with code 2). This
  // preserves PR#8a §7.2 ("wrong-shaped row fields must be rejected
  // and reported, not abort the observer") while keeping the
  // SQL/connection-failure propagation fix intact.
  const refsShape = validateEvidenceRefsShape(row.evidence_refs);
  if (refsShape.outcome === 'rejected') {
    return {
      outcome:    'rejected',
      reason:     refsShape.reason,
      session_id: sessionIdForRejectPath,
      detail:     refsShape.detail,
    };
  }
  const evidenceRefs: readonly EvidenceRef[] = refsShape.evidenceRefs;

  // Workspace / site / session id triage (used by the Stage 0 lookup
  // before the full row-validation runs). If any is missing, fall
  // through to the mapper which will reject MISSING_REQUIRED_ID.
  const workspaceId = typeof row.workspace_id === 'string' && row.workspace_id.length > 0 ? row.workspace_id : null;
  const siteId      = typeof row.site_id      === 'string' && row.site_id.length      > 0 ? row.site_id      : null;
  const sessionId   = typeof row.session_id   === 'string' && row.session_id.length   > 0 ? row.session_id   : null;

  let stage0ContextOrNull: BridgeStage0Context | null = null;
  if (workspaceId !== null && siteId !== null && sessionId !== null) {
    // Codex blocker fix: SQL/connection/permission errors from
    // resolveStage0 are NOT caught here. They propagate out of
    // processRow → out of runRiskCoreBridgeObserver → CLI catch →
    // exit 2 per PR#8a §10. Only data-shape problems (which
    // resolveStage0 surfaces as `outcome: 'invalid'`) become
    // row-level INVALID_STAGE0_CONTEXT rejects.
    const lookup = await resolveStage0(client, workspaceId, siteId, sessionId, evidenceRefs);
    if (lookup.outcome === 'invalid') {
      return {
        outcome:    'rejected',
        reason:     'INVALID_STAGE0_CONTEXT',
        session_id: sessionIdForRejectPath,
        detail:     lookup.detail,
      };
    }
    if (lookup.outcome === 'use') {
      stage0ContextOrNull = lookup.stage0;
    }
    // 'absent' → no stage0 forwarded, envelope may still build (PR#8a §5.1.1 Path B / 0 rows)
  }

  // Map row → RiskCoreBridgeInput
  const mapped = mapRiskObservationRow(row, stage0ContextOrNull);
  if (mapped.outcome === 'rejected') {
    return {
      outcome:    'rejected',
      reason:     mapped.reason,
      session_id: sessionIdForRejectPath,
      detail:     mapped.detail,
    };
  }

  // Call the PR#7b pure adapter
  let envelope: RiskCoreBridgeEnvelope;
  try {
    envelope = buildRiskCoreBridgeEnvelope(mapped.input);
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    return {
      outcome:    'rejected',
      reason:     classifyAdapterError(message),
      session_id: sessionIdForRejectPath,
      detail:     message,
    };
  }

  return {
    outcome:    'envelope_built',
    envelope,
    session_id: envelope.session_id,
  };
}

/* --------------------------------------------------------------------------
 * runRiskCoreBridgeObserver — public entry point
 *
 * Reads PR#6 rows + optional PR#5 rows, builds envelopes in memory,
 * aggregates a report, returns it. Discards envelopes (no persistence).
 * Caller is responsible for the pg pool lifecycle.
 * ------------------------------------------------------------------------ */

export interface RunObserverArgs {
  readonly client:        pg.Pool | pg.PoolClient | pg.Client;
  readonly options:       ObserverRunOptions;
  readonly database_host: string;
  readonly database_name: string;
}

export async function runRiskCoreBridgeObserver(args: RunObserverArgs): Promise<ObserverReport> {
  const run_started_at = new Date().toISOString();

  const select = await args.client.query<RiskObservationRowRaw>(SELECT_RISK_OBSERVATIONS_SQL, [
    args.options.observation_version,
    args.options.scoring_version,
    args.options.workspace_id ?? null,
    args.options.site_id ?? null,
    args.options.window_start,
    args.options.window_end,
    args.options.limit,
  ]);

  const results: ObserverRowResult[] = [];
  for (const row of select.rows) {
    // Codex blocker fix: SQL/connection/permission errors from
    // processRow are NOT caught here. They propagate out of
    // runRiskCoreBridgeObserver → CLI catch → exit 2 per PR#8a §10.
    // Data-shape problems (mapper validation, adapter validation)
    // are already returned as `ObserverRowResult` with the correct
    // `RejectReason` from inside processRow.
    const r = await processRow(args.client, row);
    results.push(r);
  }

  const run_ended_at = new Date().toISOString();

  const run_metadata: ObserverRunMetadata = {
    observation_version:        args.options.observation_version,
    scoring_version:             args.options.scoring_version,
    window_start:                args.options.window_start.toISOString(),
    window_end:                  args.options.window_end.toISOString(),
    database_host:               args.database_host,
    database_name:               args.database_name,
    run_started_at,
    run_ended_at,
    source_table:                'risk_observations_v0_1',
    bridge_envelope_version:     RISK_CORE_BRIDGE_ENVELOPE_VERSION,
  };

  return aggregateReport({
    results,
    rows_scanned:   select.rowCount ?? 0,
    sample_limit:   args.options.sample_limit,
    run_metadata,
  });
}

/* --------------------------------------------------------------------------
 * Pure-test entry point — exposes `processRow` against an in-memory
 * mock client so tests can exercise the Stage 0 truth table without
 * a real pg connection. The mock is a `pg.QueryResult`-shaped
 * function the runner uses through the same `query()` interface.
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
  row:    RiskObservationRowRaw,
): Promise<ObserverRowResult> {
  return processRow(client as unknown as pg.Pool, row);
}

/* --------------------------------------------------------------------------
 * Re-export helpers used by the CLI
 * ------------------------------------------------------------------------ */

export { parseDatabaseUrl };
