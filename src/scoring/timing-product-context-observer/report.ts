/**
 * Sprint 2 PR#18c — Timing / Product-Context Observer — markdown report.
 *
 * Pure module. No DB, no HTTP, no clock reads, no process side effects.
 *
 * Renders the structured `TimingProductContextObservationReport` to a
 * markdown string. The structured data is the source of truth; markdown
 * is the readable surface for engineering review.
 *
 * Privacy posture:
 *   - DSN is masked (host + db name only).
 *   - Session IDs are pre-redacted by the mapper (truncated form only).
 *   - No request_id UUID, no payload byte, no Authorization header,
 *     no token / token_hash / pepper appears in the output.
 */

import {
  type TimingProductContextObservationReport,
} from './types.js';

/* --------------------------------------------------------------------------
 * DSN masking — host + db name only. NEVER user / password / params.
 * ------------------------------------------------------------------------ */

export function parseDatabaseUrl(url: string | undefined): { host: string; name: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { host: '<unset>', name: '<unset>' };
  }
  try {
    const u = new URL(url);
    return {
      host: u.host           || '<host>',
      name: u.pathname.replace(/^\//, '') || '<db>',
    };
  } catch {
    return { host: '<unparseable>', name: '<unparseable>' };
  }
}

/* --------------------------------------------------------------------------
 * Markdown helpers.
 * ------------------------------------------------------------------------ */

function fmtBool(b: boolean): string { return b ? 'yes' : 'no'; }

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep  = `| ${headers.map(() => '---').join(' | ')} |`;
  if (rows.length === 0) return `${head}\n${sep}\n`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

/* --------------------------------------------------------------------------
 * Top-level renderer.
 * ------------------------------------------------------------------------ */

export function renderMarkdown(r: TimingProductContextObservationReport): string {
  const out: string[] = [];

  out.push(`# Sprint 2 PR#18c — Timing / Product-Context Observer Report`);
  out.push('');
  out.push(`> **Internal evidence preview. Not customer-facing. Not authoritative.**`);
  out.push(`> Read-only refresh observer producing pass-forward shape for PR#18d (Pass 1) planning.`);
  out.push(`> Confidence cap policy v0.1: observer NEVER emits 'high'. Maximum cap is 'medium'.`);
  out.push('');

  out.push(`## Run metadata`);
  out.push('');
  out.push(table(
    ['field', 'value'],
    [
      ['report_version',                    r.report_version],
      ['observer_version',                  r.observer_version],
      ['pass_forward_contract_version',     r.pass_forward_contract_version],
      ['synthetic_exclusion_rule_version',  r.synthetic_exclusion_rule_version],
      ['timing_band_thresholds_version',    r.timing_band_thresholds_version],
      ['confidence_cap_policy_version',     r.confidence_cap_policy_version],
      ['checked_at',                        r.checked_at],
      ['window_hours',                      String(r.window_hours)],
      ['window_start',                      r.window_start],
      ['window_end',                        r.window_end],
      ['workspace_id',                      r.workspace_id],
      ['site_id',                           r.site_id],
      ['database_host',                     r.database_host],
      ['database_name',                     r.database_name],
    ],
  ));
  out.push('');

  out.push(`## Source tables present (read-only)`);
  out.push('');
  const p = r.source_tables_present;
  out.push(table(
    ['table', 'present'],
    [
      ['public.accepted_events',                   fmtBool(p.accepted_events)],
      ['public.ingest_requests',                   fmtBool(p.ingest_requests)],
      ['public.rejected_events',                   fmtBool(p.rejected_events)],
      ['public.session_features',                  fmtBool(p.session_features)],
      ['public.session_behavioural_features_v0_2', fmtBool(p.session_behavioural_features_v0_2)],
      ['public.poi_observations_v0_1',             fmtBool(p.poi_observations_v0_1)],
      ['public.poi_sequence_observations_v0_1',    fmtBool(p.poi_sequence_observations_v0_1)],
      ['public.risk_observations_v0_1',            fmtBool(p.risk_observations_v0_1)],
      ['public.site_write_tokens',                 fmtBool(p.site_write_tokens)],
    ],
  ));
  out.push('');

  out.push(`## Source counts (window-bounded)`);
  out.push('');
  const c = r.source_counts;
  out.push(table(
    ['source', 'count_in_window'],
    [
      ['accepted_events',                   String(c.accepted_events_in_window)],
      ['ingest_requests',                   String(c.ingest_requests_in_window)],
      ['rejected_events',                   String(c.rejected_events_in_window)],
      ['session_features',                  String(c.session_features_in_window)],
      ['session_behavioural_features_v0_2', String(c.session_behavioural_features_v0_2_in_window)],
      ['poi_observations_v0_1',             String(c.poi_observations_v0_1_in_window)],
      ['poi_sequence_observations_v0_1',    String(c.poi_sequence_observations_v0_1_in_window)],
      ['risk_observations_v0_1',            String(c.risk_observations_v0_1_in_window)],
    ],
  ));
  out.push('');

  out.push(`## Synthetic / control-traffic exclusion summary`);
  out.push('');
  const sx = r.synthetic_control_exclusion;
  out.push(table(
    ['field', 'value'],
    [
      ['rule_version',                          sx.rule_version],
      ['excluded_workspace_site_pair_matches',  String(sx.excluded_workspace_site_pair_matches)],
      ['excluded_schema_key_namespace_matches', String(sx.excluded_schema_key_namespace_matches)],
      ['excluded_token_label_matches',          String(sx.excluded_token_label_matches)],
      ['excluded_accepted_events_rows',         String(sx.excluded_accepted_events_rows)],
      ['excluded_rejected_events_rows',         String(sx.excluded_rejected_events_rows)],
      ['excluded_ingest_requests_rows',         String(sx.excluded_ingest_requests_rows)],
      ['proof_rows_preserved',                  fmtBool(sx.proof_rows_preserved)],
    ],
  ));
  out.push('');

  out.push(`## Timing band distribution (per session)`);
  out.push('');
  const d = r.timing_band_distribution;
  out.push(table(
    ['band', 'session_count'],
    [
      ['hot_now',               String(d.hot_now)],
      ['warm_recent',           String(d.warm_recent)],
      ['cooling',               String(d.cooling)],
      ['stale',                 String(d.stale)],
      ['dormant',               String(d.dormant)],
      ['insufficient_evidence', String(d.insufficient_evidence)],
    ],
  ));
  out.push('');

  out.push(`## Per-session product-context candidates (pass-forward to Pass 1)`);
  out.push('');
  out.push(`_Candidates with \`pass_forward_to_pass1=yes\` are eligible for PR#18d Pass 1 planning input. UUID / payload content never surfaced._`);
  out.push('');
  out.push(table(
    ['session_id_redacted', 'timing_band', 'product_context', 'confidence_cap', 'confidence_reason', 'evidence_refs', 'exclusion_flags', 'pass_forward_to_pass1'],
    r.product_context_candidates.map((cand) => Object.freeze([
      cand.session_id_redacted,
      cand.timing_band_candidate,
      cand.product_context_candidate,
      cand.confidence_cap,
      cand.confidence_reason,
      cand.evidence_refs.join(' '),
      cand.exclusion_flags.join(' '),
      fmtBool(cand.pass_forward_to_pass1),
    ])),
  ));
  out.push('');

  out.push(`## Anomalies`);
  out.push('');
  if (r.anomalies.length === 0) {
    out.push(`_None._`);
  } else {
    out.push(table(
      ['kind', 'severity', 'detail'],
      r.anomalies.map((a) => Object.freeze([a.kind, a.severity, a.detail])),
    ));
  }
  out.push('');

  out.push(`## Final status`);
  out.push('');
  out.push(`**${r.final_status}**`);
  out.push('');

  out.push(`## Boundary affirmations`);
  out.push('');
  for (const ba of r.boundary_affirmations) {
    out.push(`- ${ba}`);
  }
  out.push('');

  return out.join('\n');
}
