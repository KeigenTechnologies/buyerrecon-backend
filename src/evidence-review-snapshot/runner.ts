/**
 * Sprint 2 PR#15a — Evidence Review Snapshot — runner.
 *
 * Pure orchestration over a `pg`-shaped client (pg.Pool, pg.Client,
 * or test stub). Reads only. Tolerates missing tables. Emits a
 * structured `EvidenceReviewSnapshotReport`; the markdown
 * renderer lives in `report.ts`.
 *
 * Hard boundary (carried verbatim from types.ts):
 *   - No DB writes.
 *   - No durable Lane A / Lane B writer.
 *   - No ProductDecision / RequestedAction / scorer call.
 *   - No customer-facing surface.
 *   - No HTTP / network / file write.
 *   - No clock dependency inside the per-table SQL (the runner
 *     captures a single `checked_at` boundary timestamp; tests
 *     can inject it).
 */

import {
  parseDatabaseUrl,
  sanitizeBoundaryLabel,
  sanitizeErrorNote,
  sanitizeOutputText,
} from './sanitize.js';
import {
  buildCountSql,
  SNAPSHOT_TABLES,
  SQL_STAGE0_ELIGIBLE_COUNT,
  SQL_STAGE0_EXCLUDED_COUNT,
  SQL_TABLE_EXISTS,
  type TableSpec,
} from './sql.js';
import {
  SNAPSHOT_OBSERVER_VERSION,
  type EvidenceChainSummary,
  type EvidenceGaps,
  type EvidenceReviewSnapshotReport,
  type FounderNotesPrompt,
  type LaneACandidates,
  type LaneBInternal,
  type ReadinessAssessment,
  type SnapshotBoundary,
  type SnapshotRunOptions,
  type SourceAvailabilityBlock,
  type TableAvailability,
} from './types.js';

/**
 * Minimal pg-compatible client interface — covers `pg.Pool`,
 * `pg.Client`, and test stubs. Only `.query(text, values)` is
 * used.
 */
export interface PgQueryable {
  query: <Row = unknown>(
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: readonly Row[] }>;
}

export interface RunSnapshotArgs {
  readonly client:        PgQueryable;
  readonly options:       SnapshotRunOptions;
  readonly database_host: string;
  readonly database_name: string;
  readonly checked_at?:   Date;
}

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export async function runEvidenceReviewSnapshot(
  args: RunSnapshotArgs,
): Promise<EvidenceReviewSnapshotReport> {
  const { client, options, database_host, database_name } = args;
  const checked_at = args.checked_at ?? new Date();

  // Codex blocker fix: workspace_id and site_id are caller-
  // controlled (CLI env-vars or library callers). Validate as
  // safe structural labels OR substitute a redacted fallback so
  // no caller-tainted text can flow into the rendered markdown
  // via the boundary block.
  const boundary: SnapshotBoundary = {
    observer_version:     SNAPSHOT_OBSERVER_VERSION,
    workspace_id:         sanitizeBoundaryLabel(options.workspace_id, '<redacted-unsafe-workspace-id>'),
    site_id:              sanitizeBoundaryLabel(options.site_id, '<redacted-unsafe-site-id>'),
    window_start_iso:     options.window_start.toISOString(),
    window_end_iso:       options.window_end.toISOString(),
    checked_at_iso:       checked_at.toISOString(),
    database_host_masked: sanitizeOutputText(database_host),
    database_name_masked: sanitizeOutputText(database_name),
  };

  // Per-table availability + count.
  const tables: TableAvailability[] = [];
  for (const spec of SNAPSHOT_TABLES) {
    tables.push(await probeTable(client, spec, options));
  }

  const byName = (n: string): TableAvailability | undefined =>
    tables.find((t) => t.table_name === n);

  // Evidence chain summary — pure projection of the table counts.
  const evidence_chain: EvidenceChainSummary = {
    accepted_events_rows:              byName('accepted_events')?.row_count                   ?? null,
    rejected_events_rows:              byName('rejected_events')?.row_count                   ?? null,
    ingest_requests_rows:              byName('ingest_requests')?.row_count                   ?? null,
    session_features_rows:             byName('session_features')?.row_count                  ?? null,
    session_behavioural_features_rows: byName('session_behavioural_features_v0_2')?.row_count ?? null,
    stage0_decisions_rows:             byName('stage0_decisions')?.row_count                  ?? null,
    risk_observations_rows:            byName('risk_observations_v0_1')?.row_count            ?? null,
    poi_observations_rows:             byName('poi_observations_v0_1')?.row_count             ?? null,
    poi_sequence_observations_rows:    byName('poi_sequence_observations_v0_1')?.row_count    ?? null,
  };

  // Lane A — customer-safer candidate observations.
  const stage0_exists = byName('stage0_decisions')?.exists ?? false;
  const stage0_excluded_count = stage0_exists
    ? await safeCount(client, SQL_STAGE0_EXCLUDED_COUNT, [
        options.workspace_id,
        options.site_id,
        options.window_start,
        options.window_end,
      ])
    : null;
  const stage0_eligible_count = stage0_exists
    ? await safeCount(client, SQL_STAGE0_ELIGIBLE_COUNT, [
        options.workspace_id,
        options.site_id,
        options.window_start,
        options.window_end,
      ])
    : null;

  const lane_a_evidence_gaps: string[] = [];
  if ((evidence_chain.session_features_rows ?? 0) === 0) {
    lane_a_evidence_gaps.push(
      'session_features has zero rows in window — cannot tell automated traffic from human evaluators by behaviour shape.',
    );
  }
  if ((evidence_chain.session_behavioural_features_rows ?? 0) === 0) {
    lane_a_evidence_gaps.push(
      'session_behavioural_features_v0_2 has zero rows in window — burst / dwell / interaction-density signals unavailable.',
    );
  }
  if (!stage0_exists || (evidence_chain.stage0_decisions_rows ?? 0) === 0) {
    lane_a_evidence_gaps.push(
      'stage0_decisions absent or empty — no upstream exclusion gating signal to corroborate Lane-A candidate counts.',
    );
  }

  const lane_a_candidates: LaneACandidates = {
    rejected_event_count:                      evidence_chain.rejected_events_rows,
    stage0_excluded_count,
    risk_observation_rows_with_evidence:       evidence_chain.risk_observations_rows,
    bot_like_or_ambiguous_evidence_count_note:
      'Lane A candidate observations are evidence-review inputs, not automated customer-facing scores.',
    evidence_gaps_affecting_traffic_quality:   Object.freeze(lane_a_evidence_gaps),
  };

  // Lane B — internal-only observations.
  const lane_b_internal: LaneBInternal = {
    poi_observation_rows:                       evidence_chain.poi_observations_rows,
    poi_sequence_observation_rows:              evidence_chain.poi_sequence_observations_rows,
    session_features_coverage_rows:             evidence_chain.session_features_rows,
    session_behavioural_features_coverage_rows: evidence_chain.session_behavioural_features_rows,
    stage0_eligible_count,
    ambiguous_or_insufficient_buckets_note:
      'Lane B observations are internal learning inputs only and must not be exposed as customer-facing claims.',
  };

  // Evidence gaps — derived from the counts.
  const evidence_gaps = computeEvidenceGaps(evidence_chain, options);

  // Readiness bucket — operator status, NOT a numeric score.
  const readiness = computeReadiness(evidence_chain, evidence_gaps);

  // Founder notes prompt — copyable into the private customer folder.
  const founder_notes_prompt = computeFounderNotesPrompt(evidence_chain, evidence_gaps);

  return {
    boundary,
    source_availability: { tables: Object.freeze(tables) },
    evidence_chain,
    lane_a_candidates,
    lane_b_internal,
    evidence_gaps,
    readiness,
    founder_notes_prompt,
  };
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

async function probeTable(
  client: PgQueryable,
  spec:   TableSpec,
  opts:   SnapshotRunOptions,
): Promise<TableAvailability> {
  // 1. Existence check. Codex blocker fix: do NOT echo raw
  // err.message — sanitizeErrorNote returns a generic note so
  // a tainted DB error cannot leak via markdown.
  let exists = false;
  try {
    const res = await client.query<{ exists: boolean }>(SQL_TABLE_EXISTS, [spec.name]);
    exists = Boolean(res.rows[0]?.exists);
  } catch (err) {
    return {
      table_name: spec.name,
      exists:     false,
      row_count:  null,
      note:       sanitizeErrorNote(err),
    };
  }
  if (!exists) {
    return {
      table_name: spec.name,
      exists:     false,
      row_count:  null,
      note:       'table not present in schema',
    };
  }

  // 2. Window-filtered count.
  try {
    const sql = buildCountSql(spec);
    const res = await client.query<{ n: string | number }>(sql, [
      opts.workspace_id,
      opts.site_id,
      opts.window_start,
      opts.window_end,
    ]);
    const rowCount = Number(res.rows[0]?.n ?? 0);
    return {
      table_name: spec.name,
      exists:     true,
      row_count:  Number.isFinite(rowCount) ? rowCount : null,
      note:       null,
    };
  } catch (err) {
    return {
      table_name: spec.name,
      exists:     true,
      row_count:  null,
      note:       sanitizeErrorNote(err),
    };
  }
}

async function safeCount(
  client: PgQueryable,
  sql:    string,
  args:   readonly unknown[],
): Promise<number | null> {
  try {
    const res = await client.query<{ n: string | number }>(sql, args);
    const n = Number(res.rows[0]?.n ?? 0);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function computeEvidenceGaps(
  ec:   EvidenceChainSummary,
  opts: SnapshotRunOptions,
): EvidenceGaps {
  const summary: string[] = [];
  const windowHours =
    (opts.window_end.getTime() - opts.window_start.getTime()) / 3_600_000;

  const missing_accepted_events_coverage    = (ec.accepted_events_rows              ?? 0) === 0;
  const missing_session_features            = (ec.session_features_rows             ?? 0) === 0;
  const missing_behavioural_features        = (ec.session_behavioural_features_rows ?? 0) === 0;
  const missing_poi_observations            = (ec.poi_observations_rows             ?? 0) === 0;
  const missing_risk_observations           = (ec.risk_observations_rows            ?? 0) === 0;
  // Track-A / B has no ProductFeatures observation TABLE today — PR#14c
  // is a CLI-only observer; we surface its absence as a known-gap.
  const missing_productfeatures_observations = true;
  const insufficient_window                 = windowHours < 24;
  // The snapshot can't infer "no conversion event" without reading
  // accepted_events.event_type; that's deeper than v0.1. Default
  // false; future PRs can refine.
  const no_conversion_evidence              = false;
  const insufficient_utm_source_context     = false;

  if (missing_accepted_events_coverage)    summary.push('No accepted_events in window — collector may not be installed or not firing.');
  if (missing_session_features)            summary.push('No session_features in window — Stage-0 / behavioural pipeline not running.');
  if (missing_behavioural_features)        summary.push('No session_behavioural_features_v0_2 in window — behavioural depth unavailable.');
  if (missing_poi_observations)            summary.push('No POI observations in window — buyer-motion shape signals unavailable.');
  if (missing_risk_observations)           summary.push('No risk observations in window — Lane-A bad-traffic candidates have no risk-side corroboration.');
  if (missing_productfeatures_observations) summary.push('ProductFeatures observer is CLI-only (PR#14c) — no durable table; re-run that observer for product-context coverage.');
  if (insufficient_window)                 summary.push(`Observation window is ${windowHours.toFixed(1)}h — likely too short to draw stable patterns.`);

  return {
    missing_accepted_events_coverage,
    missing_session_features,
    missing_behavioural_features,
    missing_poi_observations,
    missing_risk_observations,
    missing_productfeatures_observations,
    insufficient_window,
    no_conversion_evidence,
    insufficient_utm_source_context,
    gaps_summary: Object.freeze(summary),
  };
}

function computeReadiness(
  ec:   EvidenceChainSummary,
  gaps: EvidenceGaps,
): ReadinessAssessment {
  const reasons: string[] = [];

  // STOP_THE_LINE — no accepted_events table at all (or zero rows
  // AND zero ingest rows AND zero rejected rows — the collector
  // has produced nothing reachable in this window).
  const totalCollectorRows =
    (ec.accepted_events_rows ?? 0)
    + (ec.rejected_events_rows ?? 0)
    + (ec.ingest_requests_rows ?? 0);
  if (totalCollectorRows === 0) {
    reasons.push('Collector layer (accepted_events + rejected_events + ingest_requests) produced zero rows in the window.');
    return {
      bucket:  'STOP_THE_LINE',
      reasons: Object.freeze(reasons),
    };
  }

  // INSTALL_OR_DATA_GAP — accepted_events present but session-level
  // feature pipeline empty.
  if (gaps.missing_session_features && gaps.missing_behavioural_features) {
    reasons.push('accepted_events present but BOTH session_features and behavioural_features are empty — Stage-0 / feature extraction pipeline not running for this workspace.');
    return {
      bucket:  'INSTALL_OR_DATA_GAP',
      reasons: Object.freeze(reasons),
    };
  }

  // NEEDS_MORE_EVIDENCE — features present but downstream observers
  // (POI / risk) are empty.
  if (gaps.missing_poi_observations && gaps.missing_risk_observations) {
    reasons.push('Features extracted but no POI / risk observations in window — Evidence Review can describe shape, not corroborate with downstream evidence.');
    return {
      bucket:  'NEEDS_MORE_EVIDENCE',
      reasons: Object.freeze(reasons),
    };
  }

  if (gaps.insufficient_window) {
    reasons.push('Observation window is too short for stable patterns; extend before manual review.');
    return {
      bucket:  'NEEDS_MORE_EVIDENCE',
      reasons: Object.freeze(reasons),
    };
  }

  // READY — accepted_events + at least one of features + at least
  // one of POI/risk in the window.
  reasons.push('accepted_events + session-level features + at least one downstream observation table all populated for this workspace + site.');
  return {
    bucket:  'READY_FOR_MANUAL_REVIEW',
    reasons: Object.freeze(reasons),
  };
}

function computeFounderNotesPrompt(
  ec:   EvidenceChainSummary,
  gaps: EvidenceGaps,
): FounderNotesPrompt {
  const what_looks_verifiable: string[] = [];
  const what_remains_unknown: string[] = [];
  const what_should_not_be_claimed: string[] = [
    'No per-visitor scores in the customer-facing review.',
    'No identity-resolution claim (no "we identified this company").',
    'No ROI / conversion-rate-lift number.',
    'No "we catch every bot" claim.',
    'No "BuyerRecon replaces GA4 / PostHog / Clarity" framing.',
  ];
  const what_needs_customer_confirmation: string[] = [
    'Customer confirms which session_features / behavioural_features in the window correspond to their own analytics counts.',
    'Customer confirms consent banner state for the period (granted / declined / not-set).',
    'Customer confirms no analytics-config change happened mid-window.',
  ];
  const what_to_check_in_ga4_or_crm: string[] = [
    'GA4 channel + landing-page distribution for the same window.',
    'CRM closed-loop sample (12 closed-won + 12 closed-lost) for retroactive validation.',
    'Customer-side bot/WAF aggregate counts for the same period.',
  ];

  if ((ec.accepted_events_rows ?? 0) > 0) {
    what_looks_verifiable.push('Site has collector traffic in the window — volume baseline is real.');
  }
  if ((ec.session_features_rows ?? 0) > 0) {
    what_looks_verifiable.push('Session-level features extracted — buyer-motion shape questions can be answered.');
  }
  if ((ec.poi_observations_rows ?? 0) > 0 || (ec.poi_sequence_observations_rows ?? 0) > 0) {
    what_looks_verifiable.push('POI observations present — buyer-motion shapes vs. noise shapes can be described.');
  }
  if ((ec.risk_observations_rows ?? 0) > 0) {
    what_looks_verifiable.push('Risk observations present — Lane-A bad-traffic candidates can be cross-checked against risk signals.');
  }

  if (gaps.missing_accepted_events_coverage)    what_remains_unknown.push('Whether the collector is installed on production paths the customer cares about.');
  if (gaps.missing_session_features)            what_remains_unknown.push('Whether session_features extraction has run for this workspace at all.');
  if (gaps.missing_behavioural_features)        what_remains_unknown.push('Whether behavioural feature extraction has run for this workspace.');
  if (gaps.missing_poi_observations)            what_remains_unknown.push('Whether buyer-motion shapes are present (need POI observations).');
  if (gaps.missing_risk_observations)           what_remains_unknown.push('Whether risk observations corroborate any bad-traffic suspicion.');
  if (gaps.missing_productfeatures_observations) what_remains_unknown.push('ProductFeatures coverage (PR#14c CLI-only) — re-run that observer if product-context detail is needed.');
  if (gaps.insufficient_window)                 what_remains_unknown.push('Whether the patterns observed are stable across a longer window.');

  return {
    what_looks_verifiable:             Object.freeze(what_looks_verifiable),
    what_remains_unknown:              Object.freeze(what_remains_unknown),
    what_should_not_be_claimed:        Object.freeze(what_should_not_be_claimed),
    what_needs_customer_confirmation:  Object.freeze(what_needs_customer_confirmation),
    what_to_check_in_ga4_or_crm:       Object.freeze(what_to_check_in_ga4_or_crm),
  };
}

export { parseDatabaseUrl };
