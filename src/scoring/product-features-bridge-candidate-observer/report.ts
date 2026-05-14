/**
 * Sprint 2 PR#14c — ProductFeatures Bridge Candidate Observer — markdown report.
 *
 * Pure module. No DB. No HTTP. No clock reads.
 *
 * Renders the structured `BridgeCandidateObserverReport` to a
 * markdown string for stdout. The structured data is the source of
 * truth; markdown is the operator surface.
 *
 * Privacy posture:
 *   - DSN already masked at the report boundary (host + db name).
 *   - Sample carries truncated session-id prefix only.
 *   - PR#14b's recursive guards would have rejected any candidate
 *     containing raw URLs / query strings / email-shaped values /
 *     PII / AMS reason-code values before they reached the sample.
 */

import type { BridgeCandidateObserverReport } from './types.js';

function fmtNum(n: number): string {
  return String(n);
}

function fmtNumOrNull(n: number | null): string {
  return n === null ? 'null' : String(n);
}

function fmtPercent(n: number | null): string {
  return n === null ? 'null' : `${n.toFixed(1)}%`;
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep  = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return rows.length === 0 ? `${head}\n${sep}\n` : `${head}\n${sep}\n${body}`;
}

function distToRows(dist: Readonly<Record<string, number>>): readonly (readonly string[])[] {
  return Object.entries(dist)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => Object.freeze([k, fmtNum(v)]));
}

export function renderBridgeCandidateObserverMarkdown(report: BridgeCandidateObserverReport): string {
  const out: string[] = [];

  out.push(`# Sprint 2 PR#14c — ProductFeatures Bridge Candidate Observer Report`);
  out.push('');
  out.push(`> **Internal evidence preview. Not customer-facing. Not authoritative.**`);
  out.push(`> Reuses PR#13b POI / POI Sequence evidence and PR#14b pure mapper to`);
  out.push(`> emit \`product_features_namespace_candidate\` samples shape-alignable`);
  out.push(`> with AMS \`ProductFeatures.Namespace\`. Does NOT execute AMS Product`);
  out.push(`> Layer logic. Does NOT create \`ProductDecision\`.`);
  out.push('');

  // §1 Boundary
  const b = report.boundary;
  out.push(`## 1. Boundary`);
  out.push('');
  out.push(table(['Field', 'Value'], [
    ['workspace_id',                       b.workspace_id],
    ['site_id',                            b.site_id],
    ['window_start',                       b.window_start],
    ['window_end',                         b.window_end],
    ['checked_at',                         b.checked_at],
    ['database_host (masked)',             b.database_host],
    ['database_name',                      b.database_name],
    ['bridge_candidate_observer_version',  b.bridge_candidate_observer_version],
    ['bridge_contract_version',            b.bridge_contract_version],
    ['bridge_payload_version',             b.bridge_payload_version],
  ]));
  out.push('');

  // §2 Source readiness
  const sr = report.source_readiness;
  out.push(`## 2. Source readiness (carry-through from PR#13b)`);
  out.push('');
  out.push(table(['Check', 'Result'], [
    ['poi_observations_v0_1 present',          sr.poi_observations_v0_1_present          ? 'yes' : 'no'],
    ['poi_sequence_observations_v0_1 present', sr.poi_sequence_observations_v0_1_present ? 'yes' : 'no'],
    ['poi missing columns',                    sr.poi_missing_columns.length === 0          ? 'none' : sr.poi_missing_columns.join(', ')],
    ['poi_sequence missing columns',           sr.poi_sequence_missing_columns.length === 0 ? 'none' : sr.poi_sequence_missing_columns.join(', ')],
    ['fail_closed',                            sr.fail_closed ? `yes — ${sr.fail_closed_reason ?? 'unspecified'}` : 'no'],
  ]));
  out.push('');

  // §3 Product-context observer input
  const pi = report.product_context_observer_input;
  out.push(`## 3. Product-context observer input summary`);
  out.push('');
  out.push(table(['Metric', 'Value'], [
    ['poi_rows_scanned',           fmtNum(pi.poi_rows_scanned)],
    ['poi_sequence_rows_scanned',  fmtNum(pi.poi_sequence_rows_scanned)],
    ['unique_sessions_seen',       fmtNum(pi.unique_sessions_seen)],
    ['preview_accepted_rows',      fmtNum(pi.preview_accepted_rows)],
    ['preview_rejected_rows',      fmtNum(pi.preview_rejected_rows)],
    ['source_poi_input_versions',         pi.source_poi_input_versions.length         === 0 ? '(none)' : pi.source_poi_input_versions.join(', ')],
    ['source_poi_observation_versions',   pi.source_poi_observation_versions.length   === 0 ? '(none)' : pi.source_poi_observation_versions.join(', ')],
    ['source_poi_sequence_versions',      pi.source_poi_sequence_versions.length      === 0 ? '(none)' : pi.source_poi_sequence_versions.join(', ')],
  ]));
  out.push('');
  out.push(`### PR#13b preview reject-reason distribution`);
  out.push('');
  out.push(table(['reject_reason', 'count'], distToRows(pi.preview_reject_reason_counts)));
  out.push('');

  // §4 Bridge candidate generation
  const g = report.bridge_candidate_generation;
  out.push(`## 4. Bridge candidate generation summary`);
  out.push('');
  out.push(table(['Metric', 'Value'], [
    ['candidate_inputs_seen',  fmtNum(g.candidate_inputs_seen)],
    ['candidates_built',       fmtNum(g.candidates_built)],
    ['candidates_rejected',    fmtNum(g.candidates_rejected)],
  ]));
  out.push('');
  out.push(`### PR#14b validator reject-reason families`);
  out.push('');
  out.push(table(['family', 'count'], distToRows(g.reject_reason_counts)));
  out.push('');
  out.push(`### namespace_key_candidate distribution`);
  out.push('');
  out.push(table(['namespace_key_candidate', 'count'], distToRows(g.namespace_key_candidate_distribution)));
  out.push('');
  out.push(`### bridge_contract_version distribution`);
  out.push('');
  out.push(table(['bridge_contract_version', 'count'], distToRows(g.bridge_contract_version_distribution)));
  out.push('');
  out.push(`### bridge_payload_version distribution`);
  out.push('');
  out.push(table(['bridge_payload_version', 'count'], distToRows(g.bridge_payload_version_distribution)));
  out.push('');

  // §5 Candidate feature summary
  const cf = report.candidate_feature_summary;
  out.push(`## 5. Candidate feature summary`);
  out.push('');
  out.push(`### Surface distribution aggregate`);
  out.push('');
  out.push(table(['universal_surface', 'count'], distToRows(cf.surface_distribution_aggregate)));
  out.push('');
  out.push(`### Actionability band distribution (PR#13a §4.10; NOT AMS WindowState)`);
  out.push('');
  out.push(table(['actionability_band', 'count'], distToRows(cf.actionability_band_distribution)));
  out.push('');
  out.push(`### Conversion proximity indicator distribution (allowed keys only)`);
  out.push('');
  out.push(table(['indicator', 'count'], distToRows(cf.conversion_proximity_indicator_distribution)));
  out.push('');
  out.push(`### Progression depth distribution (bucketed)`);
  out.push('');
  out.push(table(['progression_depth_bucket', 'count'], distToRows(cf.progression_depth_distribution)));
  out.push('');
  out.push(`### Numeric aggregates`);
  out.push('');
  out.push(table(['Metric', 'min', 'max', 'avg'], [
    ['mapping_coverage_percent',
      fmtPercent(cf.mapping_coverage_min),
      fmtPercent(cf.mapping_coverage_max),
      fmtPercent(cf.mapping_coverage_avg)],
    ['hours_since_last_qualifying_activity (excl. null)',
      fmtNumOrNull(cf.hours_since_last_min_excluding_null),
      fmtNumOrNull(cf.hours_since_last_max_excluding_null),
      fmtNumOrNull(cf.hours_since_last_avg_excluding_null)],
  ]));
  out.push('');

  // §6 Sample candidates
  out.push(`## 6. Internal sample candidates`);
  out.push('');
  out.push(`> Capped sample; PR#14b validator already rejected any candidate carrying full session IDs, raw URLs, query strings, email-shaped values, AMS reserved keys, or AMS reason-code values. Every sample carries the internal-only / non-authoritative flags below.`);
  out.push('');
  if (report.samples.length === 0) {
    out.push(`_(No accepted candidates to sample.)_`);
  } else {
    out.push('```json');
    out.push(JSON.stringify(report.samples, null, 2));
    out.push('```');
  }
  out.push('');

  // §7 Read-only proof
  const rp = report.read_only_proof;
  out.push(`## 7. Read-only proof`);
  out.push('');
  out.push(table(['Assertion', 'Value'], [
    ['no_db_writes_performed',                  String(rp.no_db_writes_performed)],
    ['no_durable_bridge_table',                 String(rp.no_durable_bridge_table)],
    ['no_migration_or_schema_change',           String(rp.no_migration_or_schema_change)],
    ['no_customer_output',                      String(rp.no_customer_output)],
    ['no_lane_a_b_output',                      String(rp.no_lane_a_b_output)],
    ['no_trust_policy_output',                  String(rp.no_trust_policy_output)],
    ['no_ams_product_layer_runtime_execution',  String(rp.no_ams_product_layer_runtime_execution)],
    ['no_product_decision_created',             String(rp.no_product_decision_created)],
  ]));
  out.push('');

  // §8 Exit decision
  const ed = report.exit_decision;
  out.push(`## 8. Exit decision`);
  out.push('');
  out.push(table(['Field', 'Value'], [
    ['exit_code',  String(ed.exit_code)],
    ['status',     ed.status],
    ['stderr_message', ed.stderr_message ?? '(none)'],
  ]));
  out.push('');

  return out.join('\n');
}
