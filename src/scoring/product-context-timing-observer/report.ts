/**
 * Sprint 2 PR#13b — Product-Context / Timing Observer — markdown
 * report builder.
 *
 * Pure module. No DB. No HTTP. No clock reads.
 *
 * Renders the structured `ObserverReport` to a markdown string. The
 * structured data is the source of truth; markdown is the output
 * surface for runbook readability.
 *
 * Privacy posture (mirrors PR#12b / PR#12d / PR#12e):
 *   - DSN is masked at the boundary (host + db name only).
 *   - Session IDs are truncated (`prefix(8)…suffix(4)`).
 *   - JSON preview samples carry truncated session prefixes only.
 *   - No poi_key values in samples beyond aggregate surface labels
 *     (which are normalised/allowlisted universal-surface tokens).
 */

import {
  ACTIONABILITY_BANDS_ALLOWED,
  type ObserverReport,
} from './types.js';

/* --------------------------------------------------------------------------
 * Masking helpers
 * ------------------------------------------------------------------------ */

export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  return `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`;
}

export function parseDatabaseUrl(url: string | undefined): { host: string; name: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { host: '<unset>', name: '<unset>' };
  }
  try {
    const u = new URL(url);
    return { host: u.host || '<host>', name: u.pathname.replace(/^\//, '') || '<db>' };
  } catch {
    return { host: '<unparseable>', name: '<unparseable>' };
  }
}

/* --------------------------------------------------------------------------
 * Markdown builders
 * ------------------------------------------------------------------------ */

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep  = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return rows.length === 0 ? `${head}\n${sep}\n` : `${head}\n${sep}\n${body}`;
}

function fmtNum(n: number): string {
  return String(n);
}

function distToRows(dist: Readonly<Record<string, number>>): readonly (readonly string[])[] {
  return Object.entries(dist)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => Object.freeze([k, fmtNum(v)]));
}

/* --------------------------------------------------------------------------
 * Main renderer — turns ObserverReport → markdown string
 * ------------------------------------------------------------------------ */

export function renderMarkdown(report: ObserverReport): string {
  const sections: string[] = [];

  // Title + masthead
  sections.push(`# Sprint 2 PR#13b — Product-Context / Timing Observer Report`);
  sections.push('');
  sections.push(`> **Internal evidence preview. Not customer-facing. Not authoritative.**`);
  sections.push(`> Aligns with the AMS BuyerRecon Product Layer JSON shape under`);
  sections.push(`> \`ProductFeatures.Namespace\` but does NOT execute AMS Product Layer logic.`);
  sections.push('');

  // §1 Boundary
  const b = report.boundary;
  sections.push(`## 1. Boundary`);
  sections.push('');
  sections.push(table(['Field', 'Value'], [
    ['workspace_id',   b.workspace_id],
    ['site_id',        b.site_id],
    ['window_start',   b.window_start],
    ['window_end',     b.window_end],
    ['checked_at',     b.checked_at],
    ['database_host (masked)', b.database_host],
    ['database_name',  b.database_name],
  ]));
  sections.push('');

  // §2 Source readiness
  const sr = report.source_readiness;
  sections.push(`## 2. Source table readiness`);
  sections.push('');
  sections.push(table(['Check', 'Result'], [
    ['poi_observations_v0_1 present',          sr.poi_observations_v0_1_present ? 'yes' : 'no'],
    ['poi_sequence_observations_v0_1 present', sr.poi_sequence_observations_v0_1_present ? 'yes' : 'no'],
    ['poi missing columns',                    sr.poi_missing_columns.length === 0 ? 'none' : sr.poi_missing_columns.join(', ')],
    ['poi_sequence missing columns',           sr.poi_sequence_missing_columns.length === 0 ? 'none' : sr.poi_sequence_missing_columns.join(', ')],
    ['fail_closed',                            sr.fail_closed ? `yes — ${sr.fail_closed_reason ?? 'unspecified'}` : 'no'],
  ]));
  sections.push('');

  // §3 Source scan
  const ss = report.source_scan;
  sections.push(`## 3. Source scan summary`);
  sections.push('');
  sections.push(table(['Metric', 'Value'], [
    ['poi_rows_scanned',           fmtNum(ss.poi_rows_scanned)],
    ['poi_sequence_rows_scanned',  fmtNum(ss.poi_sequence_rows_scanned)],
    ['unique_session_ids_seen',    fmtNum(ss.unique_session_ids_seen)],
    ['poi_input_versions_observed',         ss.poi_input_versions_observed.length === 0 ? '(none)' : ss.poi_input_versions_observed.join(', ')],
    ['poi_observation_versions_observed',   ss.poi_observation_versions_observed.length === 0 ? '(none)' : ss.poi_observation_versions_observed.join(', ')],
    ['poi_sequence_versions_observed',      ss.poi_sequence_versions_observed.length === 0 ? '(none)' : ss.poi_sequence_versions_observed.join(', ')],
    ['earliest_observed_at',       ss.earliest_observed_at ?? '(none)'],
    ['latest_observed_at',         ss.latest_observed_at ?? '(none)'],
  ]));
  sections.push('');

  // §4 Evidence quality
  const eq = report.evidence_quality;
  sections.push(`## 4. Evidence quality summary`);
  sections.push('');
  sections.push(table(['Metric', 'Value'], [
    ['rows_accepted_into_preview',        fmtNum(eq.rows_accepted_into_preview)],
    ['rows_rejected_from_preview',        fmtNum(eq.rows_rejected_from_preview)],
    ['invalid_evidence_refs_count',       fmtNum(eq.invalid_evidence_refs_count)],
    ['unknown_surface_count',             fmtNum(eq.unknown_surface_count)],
    ['excluded_surface_count',            fmtNum(eq.excluded_surface_count)],
  ]));
  sections.push('');
  sections.push(`### Reject-reason distribution`);
  sections.push('');
  sections.push(table(['reject_reason', 'count'], distToRows(eq.reject_reason_counts)));
  sections.push('');

  // §5 Product-context preview
  const pc = report.product_context_preview;
  sections.push(`## 5. Product-context preview summary`);
  sections.push('');
  sections.push(table(['Field', 'Value'], [
    ['category_template',          pc.category_template],
    ['primary_conversion_goal',    pc.primary_conversion_goal],
    ['sales_motion',               pc.sales_motion],
    ['site_mapping_version',       pc.site_mapping_version],
    ['excluded_mapping_version',   pc.excluded_mapping_version],
    ['mapping_coverage_percent',   `${pc.mapping_coverage_percent.toFixed(1)}%`],
  ]));
  sections.push('');
  sections.push(`### Universal-surface distribution`);
  sections.push('');
  sections.push(table(['universal_surface', 'count'], distToRows(pc.universal_surface_distribution)));
  sections.push('');

  // §6 Timing / actionability
  const ta = report.timing_actionability;
  sections.push(`## 6. Timing / actionability summary`);
  sections.push('');
  sections.push(`### Actionability-band distribution (BuyerRecon-side; NOT AMS \`WindowState\`)`);
  sections.push('');
  const bandRows = ACTIONABILITY_BANDS_ALLOWED.map((b) => Object.freeze([b, fmtNum(ta.actionability_band_distribution[b] ?? 0)]));
  sections.push(table(['actionability_band', 'count'], bandRows));
  sections.push('');
  sections.push(`### Timing-window bucket distribution`);
  sections.push('');
  sections.push(table(['bucket_hours', 'count'], distToRows(ta.timing_window_bucket_distribution)));
  sections.push('');
  sections.push(table(['Metric', 'Value'], [
    ['stale_count',                   fmtNum(ta.stale_count)],
    ['dormant_count',                 fmtNum(ta.dormant_count)],
    ['insufficient_evidence_count',   fmtNum(ta.insufficient_evidence_count)],
  ]));
  sections.push('');
  sections.push(`### Conversion-proximity indicators (derived from POI / POI Sequence only)`);
  sections.push('');
  sections.push(table(['indicator', 'count'], distToRows(ta.conversion_proximity_indicators)));
  sections.push('');

  // §7 AMS-aligned JSON preview
  const ap = report.ams_aligned_json_preview;
  sections.push(`## 7. AMS-aligned JSON preview (non-authoritative, internal-only)`);
  sections.push('');
  sections.push(`> ${ap.disclaimer}`);
  sections.push('');
  if (ap.samples.length === 0) {
    sections.push(`_(No accepted sessions to sample.)_`);
  } else {
    sections.push('```json');
    sections.push(JSON.stringify(ap.samples, null, 2));
    sections.push('```');
  }
  sections.push('');

  // §8 Read-only proof
  const rp = report.read_only_proof;
  sections.push(`## 8. Read-only proof`);
  sections.push('');
  sections.push(table(['Assertion', 'Value'], [
    ['no_db_writes_performed',                  String(rp.no_db_writes_performed)],
    ['no_lane_a_b_writes',                      String(rp.no_lane_a_b_writes)],
    ['no_trust_writes',                         String(rp.no_trust_writes)],
    ['no_policy_writes',                        String(rp.no_policy_writes)],
    ['no_customer_output',                      String(rp.no_customer_output)],
    ['no_ams_product_layer_runtime_execution',  String(rp.no_ams_product_layer_runtime_execution)],
    ['no_durable_pcf_table',                    String(rp.no_durable_pcf_table)],
    ['no_migration_or_schema_change',           String(rp.no_migration_or_schema_change)],
  ]));
  sections.push('');

  // Run metadata footer
  const rm = report.run_metadata;
  sections.push(`## Run metadata (version stamps)`);
  sections.push('');
  sections.push(table(['Field', 'Value'], [
    ['observer_version',                       rm.observer_version],
    ['product_context_profile_version',        rm.product_context_profile_version],
    ['universal_surface_taxonomy_version',     rm.universal_surface_taxonomy_version],
    ['category_template_version',              rm.category_template_version],
    ['buying_role_lens_version',               rm.buying_role_lens_version],
    ['site_mapping_version',                   rm.site_mapping_version],
    ['excluded_mapping_version',               rm.excluded_mapping_version],
    ['timing_window_model_version',            rm.timing_window_model_version],
    ['freshness_decay_model_version',          rm.freshness_decay_model_version],
    ['source_table_poi',                       rm.source_table_poi],
    ['source_table_poi_sequence',              rm.source_table_poi_sequence],
    ['record_only',                            String(rm.record_only)],
    ['run_started_at',                         rm.run_started_at],
    ['run_ended_at',                           rm.run_ended_at],
  ]));
  sections.push('');

  return sections.join('\n');
}
