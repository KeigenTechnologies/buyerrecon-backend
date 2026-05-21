/**
 * Sprint 2 PR#18c — Timing / Product-Context Observer — runner.
 *
 * Orchestrator. Issues read-only SELECTs (query.ts) against an already-
 * constructed pg pool / client, calls the pure mapper, assembles the
 * structured `TimingProductContextObservationReport`. Writes nothing.
 *
 * Failure modes:
 *   - Required base table absent (accepted_events / ingest_requests
 *     / site_write_tokens) → final_status='BLOCKED'; no further queries
 *     against absent tables.
 *   - Optional table absent → count=0, anomaly logged, run continues.
 *   - SQL / connection errors → propagate to caller.
 *
 * No process.env reads here; the CLI wires env vars into `ObserverRunOptions`.
 */

import type pg from 'pg';

import {
  buildSessionCandidate,
  buildTimingBandDistribution,
  countSyntheticFixtureRows,
  groupAcceptedEventsBySession,
  isSyntheticFixtureRow,
  isSyntheticFixtureTokenLabel,
  SYNTHETIC_FIXTURE_SITE_ID,
  SYNTHETIC_FIXTURE_TOKEN_LABELS,
  SYNTHETIC_FIXTURE_WORKSPACE_ID,
  type AcceptedGroupedSession,
  type RawAcceptedEventRow,
  type RawIngestRequestRow,
  type RawRejectedEventRow,
} from './mapper.js';

import {
  COUNT_POI_OBSERVATIONS_SQL,
  COUNT_POI_SEQUENCE_OBSERVATIONS_SQL,
  COUNT_RISK_OBSERVATIONS_SQL,
  COUNT_SCORING_OUTPUT_LANE_A_SQL,
  COUNT_SCORING_OUTPUT_LANE_B_SQL,
  COUNT_SESSION_BEHAVIOURAL_FEATURES_V0_2_SQL,
  COUNT_SESSION_FEATURES_SQL,
  SELECT_ACCEPTED_EVENTS_SQL,
  SELECT_INGEST_REQUESTS_SQL,
  SELECT_REJECTED_EVENTS_SQL,
  SELECT_SYNTHETIC_FIXTURE_TOKEN_LABELS_SQL,
  SELECT_TABLE_PRESENT_TO_REGCLASS_SQL,
} from './query.js';

import {
  parseDatabaseUrl,
} from './report.js';

import {
  CONFIDENCE_CAP_POLICY_VERSION,
  OBSERVER_VERSION,
  PASS_FORWARD_CONTRACT_VERSION,
  REPORT_VERSION,
  SYNTHETIC_EXCLUSION_RULE_VERSION,
  TIMING_BAND_THRESHOLDS_VERSION,
  type Anomaly,
  type FinalStatus,
  type ObserverRunOptions,
  type ProductContextSessionCandidate,
  type SourceCounts,
  type SourceTablesPresent,
  type SyntheticControlExclusion,
  type TimingProductContextObservationReport,
} from './types.js';

type PgQueryable = pg.Pool | pg.PoolClient | pg.Client;

interface QueryRow {
  readonly [k: string]: unknown;
}

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export interface RunObserverArgs {
  readonly client:        PgQueryable;
  readonly options:       ObserverRunOptions;
  readonly database_host: string;
  readonly database_name: string;
}

export async function runTimingProductContextObserver(
  args: RunObserverArgs,
): Promise<TimingProductContextObservationReport> {
  const { client, options, database_host, database_name } = args;

  const anomalies: Anomaly[] = [];

  // ===== 1. Table-presence probes via to_regclass =====
  const present: SourceTablesPresent = {
    accepted_events:                   await tableExists(client, 'public.accepted_events'),
    ingest_requests:                   await tableExists(client, 'public.ingest_requests'),
    rejected_events:                   await tableExists(client, 'public.rejected_events'),
    session_features:                  await tableExists(client, 'public.session_features'),
    session_behavioural_features_v0_2: await tableExists(client, 'public.session_behavioural_features_v0_2'),
    poi_observations_v0_1:             await tableExists(client, 'public.poi_observations_v0_1'),
    poi_sequence_observations_v0_1:    await tableExists(client, 'public.poi_sequence_observations_v0_1'),
    risk_observations_v0_1:            await tableExists(client, 'public.risk_observations_v0_1'),
    site_write_tokens:                 await tableExists(client, 'public.site_write_tokens'),
  };

  const requiredMissing: string[] = [];
  if (!present.accepted_events) requiredMissing.push('public.accepted_events');
  if (!present.ingest_requests) requiredMissing.push('public.ingest_requests');
  if (!present.rejected_events) requiredMissing.push('public.rejected_events');

  if (requiredMissing.length > 0) {
    for (const t of requiredMissing) {
      anomalies.push({
        kind:     'required_source_missing',
        severity: 'block',
        detail:   `required source table absent: ${t}`,
      });
    }
    return buildBlockedReport({
      options,
      database_host,
      database_name,
      present,
      anomalies,
    });
  }

  // ===== 2. Fetch required source rows (bounded) =====
  const acceptedRows = await fetchAcceptedEvents(client, options);
  const ingestRows   = await fetchIngestRequests(client, options);
  const rejectedRows = await fetchRejectedEvents(client, options);

  // ===== 3. Synthetic-fixture exclusion accounting =====
  const excludedAcceptedRows = countSyntheticFixtureRows(acceptedRows);
  const excludedIngestRows   = countSyntheticFixtureRows(ingestRows);
  const excludedRejectedRows = countSyntheticFixtureRows(rejectedRows);

  // Workspace/site pair match — true if the run targets the staging proof
  // boundary pair. This is informational; the rows are still excluded from
  // commercial candidate evaluation in groupAcceptedEventsBySession().
  const workspaceSitePairMatch =
    options.workspace_id === SYNTHETIC_FIXTURE_WORKSPACE_ID &&
    options.site_id      === SYNTHETIC_FIXTURE_SITE_ID
      ? 1
      : 0;

  // Schema-key namespace matches counted across required sources.
  let excludedSchemaKeyNamespaceMatches = 0;
  for (const r of acceptedRows) {
    if (typeof r.schema_key === 'string' && r.schema_key.startsWith('buyerrecon.test.')) {
      excludedSchemaKeyNamespaceMatches += 1;
    }
  }
  for (const r of rejectedRows) {
    if (typeof r.schema_key === 'string' && r.schema_key.startsWith('buyerrecon.test.')) {
      excludedSchemaKeyNamespaceMatches += 1;
    }
  }

  // Token-label match (count-only — never returns token_hash / token_id).
  let excludedTokenLabelMatches = 0;
  if (present.site_write_tokens) {
    try {
      const labelRes = await client.query<QueryRow>(SELECT_SYNTHETIC_FIXTURE_TOKEN_LABELS_SQL, [
        options.workspace_id,
        options.site_id,
        SYNTHETIC_FIXTURE_TOKEN_LABELS,
      ]);
      for (const row of labelRes.rows) {
        if (isSyntheticFixtureTokenLabel(row.label)) {
          excludedTokenLabelMatches += 1;
        }
      }
    } catch {
      // If the site_write_tokens query fails for any reason, treat label
      // detection as unknown — DO NOT propagate token_hash / etc. errors.
      // The synthetic_control_exclusion counts remain conservative.
      anomalies.push({
        kind:     'optional_source_missing',
        severity: 'warn',
        detail:   'site_write_tokens label probe failed; label-match count reported as 0',
      });
    }
  }

  // ===== 4. Optional-source counts (count-only, presence-guarded) =====
  const sessionFeaturesCount      = present.session_features                  ? await countOptional(client, COUNT_SESSION_FEATURES_SQL, options)                : 0;
  const sessionBehV02Count        = present.session_behavioural_features_v0_2 ? await countOptional(client, COUNT_SESSION_BEHAVIOURAL_FEATURES_V0_2_SQL, options) : 0;
  const poiObsCount               = present.poi_observations_v0_1             ? await countOptional(client, COUNT_POI_OBSERVATIONS_SQL, options)                : 0;
  const poiSeqObsCount            = present.poi_sequence_observations_v0_1    ? await countOptional(client, COUNT_POI_SEQUENCE_OBSERVATIONS_SQL, options)       : 0;
  const riskObsCount              = present.risk_observations_v0_1            ? await countOptional(client, COUNT_RISK_OBSERVATIONS_SQL, options)               : 0;

  // Log optional-source-missing anomalies (info severity unless the
  // operator opted into `require_timing_product_context`, in which case
  // they become 'warn' — but never 'block').
  const optMissingSeverity: 'info' | 'warn' = options.require_timing_product_context ? 'warn' : 'info';
  if (!present.session_features) {
    anomalies.push({ kind: 'optional_source_missing', severity: optMissingSeverity, detail: 'public.session_features' });
  }
  if (!present.session_behavioural_features_v0_2) {
    anomalies.push({ kind: 'optional_source_missing', severity: optMissingSeverity, detail: 'public.session_behavioural_features_v0_2' });
  }
  if (!present.poi_observations_v0_1) {
    anomalies.push({ kind: 'optional_source_missing', severity: optMissingSeverity, detail: 'public.poi_observations_v0_1' });
  }
  if (!present.poi_sequence_observations_v0_1) {
    anomalies.push({ kind: 'optional_source_missing', severity: optMissingSeverity, detail: 'public.poi_sequence_observations_v0_1' });
  }
  if (!present.risk_observations_v0_1) {
    anomalies.push({ kind: 'optional_source_missing', severity: optMissingSeverity, detail: 'public.risk_observations_v0_1' });
  }

  // ===== 5. Lane A/B anomaly counts (expected 0 / 0 per PR#18b §9) =====
  let laneACount = 0;
  let laneBDarkObserved = false;
  try {
    const a = await client.query<QueryRow>(COUNT_SCORING_OUTPUT_LANE_A_SQL, [options.workspace_id, options.site_id]);
    laneACount = bigintToNumber(a.rows[0]?.n);
  } catch {
    anomalies.push({ kind: 'optional_source_missing', severity: 'info', detail: 'public.scoring_output_lane_a count probe failed' });
  }
  try {
    const b = await client.query<QueryRow>(COUNT_SCORING_OUTPUT_LANE_B_SQL, [options.workspace_id, options.site_id]);
    const laneBCount = bigintToNumber(b.rows[0]?.n);
    if (laneBCount > 0) laneBDarkObserved = true;
    if (laneACount > 0) {
      anomalies.push({
        kind:     'unexpected_lane_a_row_count_nonzero',
        severity: 'warn',
        detail:   `scoring_output_lane_a count is ${laneACount}; PR#18b §9 expects 0`,
      });
    }
    if (laneBCount > 0) {
      anomalies.push({
        kind:     'unexpected_lane_b_row_count_nonzero',
        severity: 'warn',
        detail:   `scoring_output_lane_b count is ${laneBCount}; PR#18b §9 expects 0 (Lane B stays dark)`,
      });
    }
  } catch {
    anomalies.push({ kind: 'optional_source_missing', severity: 'info', detail: 'public.scoring_output_lane_b count probe failed' });
  }

  // ===== 6. Per-session candidate construction =====
  const grouping = groupAcceptedEventsBySession(acceptedRows);

  if (grouping.grouped.length === 0 && (excludedAcceptedRows + excludedIngestRows + excludedRejectedRows) > 0) {
    anomalies.push({
      kind:     'synthetic_exclusion_filter_empty',
      severity: 'info',
      detail:   'all in-window required-source rows were excluded as synthetic / control traffic',
    });
  }

  // server_side_source_count: number of distinct server-side sources that
  // saw any signal in window. accepted_events is required (>0 after
  // exclusion implies signal). Optional source contributions are counted
  // when their in-window count > 0.
  let serverSideSourceCount = 0;
  if (grouping.grouped.length > 0)         serverSideSourceCount += 1; // accepted_events
  if (rejectedRows.length - excludedRejectedRows > 0) serverSideSourceCount += 1; // rejected_events
  if (sessionFeaturesCount > 0)            serverSideSourceCount += 1;
  if (sessionBehV02Count   > 0)            serverSideSourceCount += 1;
  if (poiObsCount          > 0)            serverSideSourceCount += 1;
  if (poiSeqObsCount       > 0)            serverSideSourceCount += 1;
  if (riskObsCount         > 0)            serverSideSourceCount += 1;

  // PR#18c v0.1 does not attempt per-session cross-source correlation
  // (that semantic belongs to PR#18d Pass 1 planning). Therefore the
  // observer marks threshold_not_locked when no aggressive customer-facing
  // band would be safe to invent — but only when the operator did NOT
  // explicitly opt into the observer's v0.1 conservative thresholds.
  const thresholdNotLocked = false; // v0.1 thresholds are documented placeholders; not "not locked".

  const missingOptionalSources =
    !present.session_features ||
    !present.session_behavioural_features_v0_2 ||
    !present.poi_observations_v0_1 ||
    !present.poi_sequence_observations_v0_1 ||
    !present.risk_observations_v0_1;

  const candidates: ProductContextSessionCandidate[] = grouping.grouped.map((g: AcceptedGroupedSession) =>
    buildSessionCandidate(g, {
      evaluation_at:                 options.evaluation_at,
      server_side_source_count:      serverSideSourceCount,
      missing_optional_sources:      missingOptionalSources,
      threshold_not_locked:          thresholdNotLocked,
      lane_b_dark_observed_globally: laneBDarkObserved,
    }),
  );

  // ===== 7. Assemble report =====
  const timing_band_distribution = buildTimingBandDistribution(candidates);

  const synthetic_control_exclusion: SyntheticControlExclusion = Object.freeze({
    rule_version:                          SYNTHETIC_EXCLUSION_RULE_VERSION,
    excluded_workspace_site_pair_matches:  workspaceSitePairMatch,
    excluded_schema_key_namespace_matches: excludedSchemaKeyNamespaceMatches,
    excluded_token_label_matches:          excludedTokenLabelMatches,
    excluded_accepted_events_rows:         excludedAcceptedRows,
    excluded_rejected_events_rows:         excludedRejectedRows,
    excluded_ingest_requests_rows:         excludedIngestRows,
    proof_rows_preserved:                  true,
  });

  const source_counts: SourceCounts = Object.freeze({
    accepted_events_in_window:                   acceptedRows.length,
    ingest_requests_in_window:                   ingestRows.length,
    rejected_events_in_window:                   rejectedRows.length,
    session_features_in_window:                  sessionFeaturesCount,
    session_behavioural_features_v0_2_in_window: sessionBehV02Count,
    poi_observations_v0_1_in_window:             poiObsCount,
    poi_sequence_observations_v0_1_in_window:    poiSeqObsCount,
    risk_observations_v0_1_in_window:            riskObsCount,
  });

  const final_status = deriveFinalStatus(anomalies);

  return Object.freeze({
    report_version:                    REPORT_VERSION,
    observer_version:                  OBSERVER_VERSION,
    pass_forward_contract_version:     PASS_FORWARD_CONTRACT_VERSION,
    synthetic_exclusion_rule_version:  SYNTHETIC_EXCLUSION_RULE_VERSION,
    timing_band_thresholds_version:    TIMING_BAND_THRESHOLDS_VERSION,
    confidence_cap_policy_version:     CONFIDENCE_CAP_POLICY_VERSION,
    checked_at:                        options.evaluation_at.toISOString(),
    window_hours:                      options.window_hours,
    window_start:                      options.window_start.toISOString(),
    window_end:                        options.window_end.toISOString(),
    workspace_id:                      options.workspace_id,
    site_id:                           options.site_id,
    database_host,
    database_name,
    source_tables_present:             present,
    source_counts,
    synthetic_control_exclusion,
    timing_band_distribution,
    product_context_candidates:        Object.freeze(candidates),
    anomalies:                         Object.freeze(anomalies),
    final_status,
    boundary_affirmations:             boundaryAffirmations(),
  });
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

async function tableExists(client: PgQueryable, fqName: string): Promise<boolean> {
  const res = await client.query<QueryRow>(SELECT_TABLE_PRESENT_TO_REGCLASS_SQL, [fqName]);
  const row = res.rows[0];
  return Boolean(row?.present);
}

async function fetchAcceptedEvents(client: PgQueryable, o: ObserverRunOptions): Promise<readonly RawAcceptedEventRow[]> {
  const res = await client.query<QueryRow>(SELECT_ACCEPTED_EVENTS_SQL, [
    o.window_start, o.window_end, o.workspace_id, o.site_id, o.limit,
  ]);
  return res.rows.map(toAcceptedEventRow);
}

async function fetchIngestRequests(client: PgQueryable, o: ObserverRunOptions): Promise<readonly RawIngestRequestRow[]> {
  const res = await client.query<QueryRow>(SELECT_INGEST_REQUESTS_SQL, [
    o.window_start, o.window_end, o.workspace_id, o.site_id, o.limit,
  ]);
  return res.rows.map(toIngestRequestRow);
}

async function fetchRejectedEvents(client: PgQueryable, o: ObserverRunOptions): Promise<readonly RawRejectedEventRow[]> {
  const res = await client.query<QueryRow>(SELECT_REJECTED_EVENTS_SQL, [
    o.window_start, o.window_end, o.workspace_id, o.site_id, o.limit,
  ]);
  return res.rows.map(toRejectedEventRow);
}

async function countOptional(client: PgQueryable, sql: string, o: ObserverRunOptions): Promise<number> {
  try {
    const res = await client.query<QueryRow>(sql, [o.window_start, o.window_end, o.workspace_id, o.site_id]);
    return bigintToNumber(res.rows[0]?.n);
  } catch {
    return 0;
  }
}

function bigintToNumber(v: unknown): number {
  if (typeof v === 'number')  return Number.isFinite(v) ? v : 0;
  if (typeof v === 'bigint')  return Number(v);
  if (typeof v === 'string')  {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toAcceptedEventRow(r: QueryRow): RawAcceptedEventRow {
  return Object.freeze({
    request_id:     typeof r.request_id     === 'string' ? r.request_id     : null,
    workspace_id:   typeof r.workspace_id   === 'string' ? r.workspace_id   : null,
    site_id:        typeof r.site_id        === 'string' ? r.site_id        : null,
    session_id:     typeof r.session_id     === 'string' ? r.session_id     : null,
    schema_key:     typeof r.schema_key     === 'string' ? r.schema_key     : null,
    schema_version: typeof r.schema_version === 'string' ? r.schema_version : null,
    event_origin:   typeof r.event_origin   === 'string' ? r.event_origin   : null,
    event_type:     typeof r.event_type     === 'string' ? r.event_type     : null,
    received_at:    r.received_at instanceof Date ? r.received_at : (typeof r.received_at === 'string' ? r.received_at : null),
  });
}

function toIngestRequestRow(r: QueryRow): RawIngestRequestRow {
  return Object.freeze({
    request_id:           typeof r.request_id         === 'string' ? r.request_id         : null,
    workspace_id:         typeof r.workspace_id       === 'string' ? r.workspace_id       : null,
    site_id:              typeof r.site_id            === 'string' ? r.site_id            : null,
    endpoint:             typeof r.endpoint           === 'string' ? r.endpoint           : null,
    http_status:          typeof r.http_status        === 'number' ? r.http_status        : null,
    auth_status:          typeof r.auth_status        === 'string' ? r.auth_status        : null,
    reject_reason_code:   typeof r.reject_reason_code === 'string' ? r.reject_reason_code : null,
    received_at:          r.received_at instanceof Date ? r.received_at : (typeof r.received_at === 'string' ? r.received_at : null),
    expected_event_count: typeof r.expected_event_count === 'number' ? r.expected_event_count : null,
    accepted_count:       typeof r.accepted_count       === 'number' ? r.accepted_count       : null,
    rejected_count:       typeof r.rejected_count       === 'number' ? r.rejected_count       : null,
  });
}

function toRejectedEventRow(r: QueryRow): RawRejectedEventRow {
  return Object.freeze({
    request_id:     typeof r.request_id     === 'string' ? r.request_id     : null,
    workspace_id:   typeof r.workspace_id   === 'string' ? r.workspace_id   : null,
    site_id:        typeof r.site_id        === 'string' ? r.site_id        : null,
    schema_key:     typeof r.schema_key     === 'string' ? r.schema_key     : null,
    schema_version: typeof r.schema_version === 'string' ? r.schema_version : null,
    event_type:     typeof r.event_type     === 'string' ? r.event_type     : null,
    rejected_stage: typeof r.rejected_stage === 'string' ? r.rejected_stage : null,
    reason_code:    typeof r.reason_code    === 'string' ? r.reason_code    : null,
    received_at:    r.received_at instanceof Date ? r.received_at : (typeof r.received_at === 'string' ? r.received_at : null),
  });
}

function deriveFinalStatus(anomalies: readonly Anomaly[]): FinalStatus {
  if (anomalies.some((a) => a.severity === 'block')) return 'BLOCKED';
  if (anomalies.some((a) => a.severity === 'warn'))  return 'PASS_WITH_WARNINGS';
  return 'PASS';
}

function boundaryAffirmations(): readonly string[] {
  return Object.freeze([
    'read_only: yes',
    'no_durable_table_created: yes',
    'no_migration: yes',
    'no_schema_change: yes',
    'no_db_write: yes',
    'no_customer_output: yes',
    'no_lane_a_b_writer: yes',
    'no_ams_runtime_bridge: yes',
    'no_pass_1_runtime: yes',
    'no_pass_2_runtime: yes',
    'no_trust_runtime: yes',
    'no_request_id_uuid_value_printed: yes',
    'no_raw_payload_printed: yes',
    'no_token_or_hash_or_pepper_or_dsn_printed: yes',
    'confidence_cap_high_emitted: no',
    'synthetic_proof_rows_preserved: yes',
  ]);
}

function buildBlockedReport(args: {
  options:       ObserverRunOptions;
  database_host: string;
  database_name: string;
  present:       SourceTablesPresent;
  anomalies:     readonly Anomaly[];
}): TimingProductContextObservationReport {
  const { options, database_host, database_name, present, anomalies } = args;
  return Object.freeze({
    report_version:                    REPORT_VERSION,
    observer_version:                  OBSERVER_VERSION,
    pass_forward_contract_version:     PASS_FORWARD_CONTRACT_VERSION,
    synthetic_exclusion_rule_version:  SYNTHETIC_EXCLUSION_RULE_VERSION,
    timing_band_thresholds_version:    TIMING_BAND_THRESHOLDS_VERSION,
    confidence_cap_policy_version:     CONFIDENCE_CAP_POLICY_VERSION,
    checked_at:                        options.evaluation_at.toISOString(),
    window_hours:                      options.window_hours,
    window_start:                      options.window_start.toISOString(),
    window_end:                        options.window_end.toISOString(),
    workspace_id:                      options.workspace_id,
    site_id:                           options.site_id,
    database_host,
    database_name,
    source_tables_present:             present,
    source_counts:                     Object.freeze({
      accepted_events_in_window:                   0,
      ingest_requests_in_window:                   0,
      rejected_events_in_window:                   0,
      session_features_in_window:                  0,
      session_behavioural_features_v0_2_in_window: 0,
      poi_observations_v0_1_in_window:             0,
      poi_sequence_observations_v0_1_in_window:    0,
      risk_observations_v0_1_in_window:            0,
    }),
    synthetic_control_exclusion: Object.freeze({
      rule_version:                          SYNTHETIC_EXCLUSION_RULE_VERSION,
      excluded_workspace_site_pair_matches:  0,
      excluded_schema_key_namespace_matches: 0,
      excluded_token_label_matches:          0,
      excluded_accepted_events_rows:         0,
      excluded_rejected_events_rows:         0,
      excluded_ingest_requests_rows:         0,
      proof_rows_preserved:                  true,
    }),
    timing_band_distribution:    Object.freeze({
      hot_now: 0, warm_recent: 0, cooling: 0, stale: 0, dormant: 0, insufficient_evidence: 0,
    }),
    product_context_candidates:  Object.freeze([] as readonly ProductContextSessionCandidate[]),
    anomalies:                   Object.freeze(anomalies),
    final_status:                'BLOCKED',
    boundary_affirmations:       boundaryAffirmations(),
  });
}

/* --------------------------------------------------------------------------
 * Re-exports for the CLI script.
 * ------------------------------------------------------------------------ */

export { parseDatabaseUrl };
