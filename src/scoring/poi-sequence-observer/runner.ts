/**
 * Sprint 2 PR#12b — POI Sequence Observer — runner.
 *
 * Orchestrator. Issues the read-only SELECTs (query.ts) against an
 * already-constructed pg pool/client, threads results through the
 * pure mapper (mapper.ts) and aggregator (report.ts), returns a
 * `PoiSequenceObserverReport`. Writes nothing.
 *
 * The runner does NOT read `process.env`. The CLI parses env vars
 * and supplies the options.
 *
 * Read scope (PR#12b locked boundary):
 *   - `poi_observations_v0_1`             (primary)
 *   - `information_schema.tables`         (table-presence check)
 *
 * Forbidden reads enforced by `query.ts` SQL constants + the
 * static-source sweep in `tests/v1/poi-sequence-observer.test.ts`.
 *
 * SQL / connection errors propagate out of the runner. The CLI
 * catches them and exits non-zero (exit 2). Data-shape problems are
 * folded into anomaly counters — never crash the run.
 */

import pg from 'pg';
import {
  buildSequenceRecord,
  groupRowsBySession,
  isValidEvidenceRefs,
  isValidSourceVersions,
  type GroupedRows,
} from './mapper.js';
import {
  SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL,
  SELECT_TABLE_PRESENT_SQL,
} from './query.js';
import {
  aggregateReport,
  parseDatabaseUrl,
  serialiseReport,
  truncateSessionId,
  type AggregateInputs,
} from './report.js';
import {
  ANOMALY_KINDS,
  FORBIDDEN_REF_KEYS,
  POI_SEQUENCE_VERSION,
  type AnomalyKind,
  type ObserverRunMetadata,
  type ObserverRunOptions,
  type PoiObservationRowRaw,
  type PoiSequenceObserverReport,
  type PoiSequenceRecord,
} from './types.js';

/* --------------------------------------------------------------------------
 * Lightweight client abstraction (mirrors PR#11b/PR#11d precedent)
 * ------------------------------------------------------------------------ */

type PgQueryable = pg.Pool | pg.PoolClient | pg.Client;

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export interface RunObserverArgs {
  readonly client:        PgQueryable;
  readonly options:       ObserverRunOptions;
  readonly database_host: string;
  readonly database_name: string;
}

export async function runPoiSequenceObserver(args: RunObserverArgs): Promise<PoiSequenceObserverReport> {
  const run_started_at = new Date().toISOString();

  const workspaceId = args.options.workspace_id ?? null;
  const siteId      = args.options.site_id      ?? null;

  // ---- Table-presence check ------------------------------------------------
  const present = await args.client.query<{ table_present: boolean }>(SELECT_TABLE_PRESENT_SQL);
  const table_present = present.rows[0]?.table_present === true;

  if (!table_present) {
    const run_ended_at = new Date().toISOString();
    return aggregateReport({
      rows_scanned:           0,
      records:                [],
      anomaly_sample_ids:     emptyAnomalyIds(),
      sample_session_ids_raw: [],
      run_metadata: buildRunMetadata(args, workspaceId, siteId, run_started_at, run_ended_at),
    });
  }

  // ---- POI observations fetch --------------------------------------------
  const fetchRes = await args.client.query<PoiObservationRowRaw>(
    SELECT_POI_OBSERVATIONS_FOR_SEQUENCES_SQL,
    [
      args.options.window_start,
      args.options.window_end,
      workspaceId,
      siteId,
      args.options.limit,
    ],
  );
  const rawRows: readonly PoiObservationRowRaw[] = fetchRes.rows;
  const rows_scanned = rawRows.length;

  // ---- Group + classify ---------------------------------------------------
  const grouped: readonly GroupedRows[] = groupRowsBySession(rawRows);
  const records: PoiSequenceRecord[] = [];
  for (const g of grouped) {
    records.push(buildSequenceRecord(g));
  }

  // ---- Collect anomaly sample IDs (poi_observation_id only) ---------------
  const anomaly_sample_ids: Record<AnomalyKind, number[]> = emptyAnomalyIdsMutable();
  const sampleCap = args.options.anomaly_sample_limit;
  if (sampleCap > 0) {
    // Per-session pattern anomalies — sample = first poi_observation_id of the session.
    for (let i = 0; i < grouped.length; i++) {
      const g   = grouped[i];
      const rec = records[i];
      if (g === undefined || rec === undefined) continue;
      const firstId = coerceBigserialFromRow(g.rows[0]);
      if (firstId === null) continue;
      if (rec.poi_sequence_pattern_class === 'unknown'
          && anomaly_sample_ids.unknown_pattern.length < sampleCap) {
        anomaly_sample_ids.unknown_pattern.push(firstId);
      }
      if (rec.poi_sequence_pattern_class === 'insufficient_temporal_data'
          && anomaly_sample_ids.insufficient_temporal_data.length < sampleCap) {
        anomaly_sample_ids.insufficient_temporal_data.push(firstId);
      }
    }
    // Per-row anomalies — walk raw rows.
    const allowedSourceTables = new Set<string>(['session_features']);
    for (const r of rawRows) {
      const id = coerceBigserialFromRow(r);
      if (id === null) continue;

      if (anomaly_sample_ids.invalid_evidence_refs.length < sampleCap
          && !isValidEvidenceRefs(r.evidence_refs)) {
        anomaly_sample_ids.invalid_evidence_refs.push(id);
      }
      if (anomaly_sample_ids.invalid_source_versions.length < sampleCap
          && !isValidSourceVersions(r.source_versions)) {
        anomaly_sample_ids.invalid_source_versions.push(id);
      }
      if (anomaly_sample_ids.forbidden_source_table.length < sampleCap) {
        const st = typeof r.source_table === 'string' ? r.source_table : null;
        if (st === null || !allowedSourceTables.has(st)) {
          anomaly_sample_ids.forbidden_source_table.push(id);
        }
      }
      if (anomaly_sample_ids.forbidden_key_present.length < sampleCap
          && (containsForbiddenKey(r.evidence_refs) || containsForbiddenKey(r.source_versions))) {
        anomaly_sample_ids.forbidden_key_present.push(id);
      }
    }
  }

  // ---- Sample session_id prefixes (masked downstream by the aggregator) --
  const sample_session_ids_raw: string[] = [];
  const seenSessKey = new Set<string>();
  for (const g of grouped) {
    if (sample_session_ids_raw.length >= args.options.sample_limit) break;
    if (!seenSessKey.has(g.session_id)) {
      sample_session_ids_raw.push(g.session_id);
      seenSessKey.add(g.session_id);
    }
  }

  const run_ended_at = new Date().toISOString();

  const inputs: AggregateInputs = {
    rows_scanned,
    records:                Object.freeze(records),
    anomaly_sample_ids:     freezeAnomalyIds(anomaly_sample_ids),
    sample_session_ids_raw: Object.freeze(sample_session_ids_raw),
    run_metadata:           buildRunMetadata(args, workspaceId, siteId, run_started_at, run_ended_at),
  };

  return aggregateReport(inputs);
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function emptyAnomalyIds(): Record<AnomalyKind, readonly number[]> {
  const out = Object.create(null) as Record<AnomalyKind, readonly number[]>;
  for (const k of ANOMALY_KINDS) out[k] = Object.freeze<number[]>([]);
  return out;
}

function emptyAnomalyIdsMutable(): Record<AnomalyKind, number[]> {
  const out = Object.create(null) as Record<AnomalyKind, number[]>;
  for (const k of ANOMALY_KINDS) out[k] = [];
  return out;
}

function freezeAnomalyIds(src: Record<AnomalyKind, number[]>): Record<AnomalyKind, readonly number[]> {
  const out = Object.create(null) as Record<AnomalyKind, readonly number[]>;
  for (const k of ANOMALY_KINDS) out[k] = Object.freeze([...src[k]]);
  return out;
}

function coerceBigserialFromRow(r: PoiObservationRowRaw | undefined): number | null {
  if (r === undefined) return null;
  const v = r.poi_observation_id;
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) return n;
  }
  return null;
}

const FORBIDDEN_KEY_SET: ReadonlySet<string> = new Set(FORBIDDEN_REF_KEYS);

function containsForbiddenKey(v: unknown): boolean {
  if (v === null || v === undefined || typeof v !== 'object') return false;
  if (Array.isArray(v)) {
    for (const item of v) if (containsForbiddenKey(item)) return true;
    return false;
  }
  for (const k of Object.keys(v as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_SET.has(k)) return true;
    if (containsForbiddenKey((v as Record<string, unknown>)[k])) return true;
  }
  return false;
}

function buildRunMetadata(
  args:           RunObserverArgs,
  workspaceId:    string | null,
  siteId:         string | null,
  run_started_at: string,
  run_ended_at:   string,
): ObserverRunMetadata {
  return {
    source_table:                     'poi_observations_v0_1',
    workspace_id_filter:              workspaceId,
    site_id_filter:                   siteId,
    window_start:                     args.options.window_start.toISOString(),
    window_end:                       args.options.window_end.toISOString(),
    row_limit:                        args.options.limit,
    sample_limit:                     args.options.sample_limit,
    anomaly_sample_limit:             args.options.anomaly_sample_limit,
    database_host:                    args.database_host,
    database_name:                    args.database_name,
    run_started_at,
    run_ended_at,
    poi_sequence_version:             POI_SEQUENCE_VERSION,
    poi_input_version_expected:       args.options.poi_input_version_expected,
    poi_observation_version_expected: args.options.poi_observation_version_expected,
    forbidden_ref_keys_checked:       FORBIDDEN_REF_KEYS,
    record_only:                      true,
  };
}

/* --------------------------------------------------------------------------
 * Stub client for pure tests (mirrors PR#11b/PR#11d precedent)
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

/* --------------------------------------------------------------------------
 * Re-exports for the CLI
 * ------------------------------------------------------------------------ */

export { parseDatabaseUrl, serialiseReport, truncateSessionId };
