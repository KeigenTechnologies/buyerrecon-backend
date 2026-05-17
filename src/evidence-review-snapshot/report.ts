/**
 * Sprint 2 PR#15a — Evidence Review Snapshot — markdown renderer.
 *
 * Pure function. Takes the structured report from runner.ts and
 * emits a markdown string. Internal-only — for Helen's eyes in
 * the engagement folder, never customer-facing.
 *
 * Hard rendering rules:
 *   - Counts, buckets, and sanitized path-only examples only.
 *   - No raw URLs with query strings; no emails; no token / IP
 *     / user-agent / session-id material.
 *   - The renderer carries the §4 / §5 labels verbatim so a
 *     downstream reader cannot mistake Lane A / Lane B output for
 *     automated customer-facing scoring.
 */

import { sanitizeOutputText } from './sanitize.js';
import type { EvidenceReviewSnapshotReport, ReadinessBucket } from './types.js';

/* --------------------------------------------------------------------------
 * Public entry point
 * ------------------------------------------------------------------------ */

export function renderEvidenceReviewSnapshotMarkdown(
  r: EvidenceReviewSnapshotReport,
): string {
  const out: string[] = [];

  out.push('# Evidence Review Snapshot — internal only');
  out.push('');
  out.push(
    'This snapshot supports the Phase-1 £1,250 BuyerRecon Evidence Review. ' +
      'It is **internal**, **founder-readable**, **read-only**, and ' +
      '**not a customer-facing automated claim**. Counts only; no per-visitor ' +
      'scores, no identity resolution, no ROI claim. See §9 for the explicit ' +
      'forbidden-boundary list.',
  );
  out.push('');

  // §1 Boundary
  out.push('## §1 Boundary');
  out.push('');
  out.push(table(['Field', 'Value'], [
    ['observer_version',       r.boundary.observer_version],
    ['workspace_id',           safe(r.boundary.workspace_id)],
    ['site_id',                safe(r.boundary.site_id)],
    ['window_start',           r.boundary.window_start_iso],
    ['window_end',             r.boundary.window_end_iso],
    ['checked_at',             r.boundary.checked_at_iso],
    ['database_host (masked)', safe(r.boundary.database_host_masked)],
    ['database_name (masked)', safe(r.boundary.database_name_masked)],
  ]));
  out.push('');

  // §2 Source availability
  out.push('## §2 Source availability');
  out.push('');
  out.push(table(
    ['Table', 'Exists', 'Rows in window', 'Note'],
    r.source_availability.tables.map((t) => [
      // table_name is a static catalogue value, but route it
      // through `safe` anyway so a future SNAPSHOT_TABLES addition
      // cannot bypass sanitization.
      safe(t.table_name),
      t.exists ? 'yes' : 'no',
      t.row_count === null ? '—' : String(t.row_count),
      safe(t.note ?? ''),
    ]),
  ));
  out.push('');

  // §3 Evidence chain summary
  out.push('## §3 Evidence chain summary');
  out.push('');
  out.push(table(
    ['Layer', 'Rows in window'],
    [
      ['accepted_events',                   numOrDash(r.evidence_chain.accepted_events_rows)],
      ['rejected_events',                   numOrDash(r.evidence_chain.rejected_events_rows)],
      ['ingest_requests',                   numOrDash(r.evidence_chain.ingest_requests_rows)],
      ['session_features',                  numOrDash(r.evidence_chain.session_features_rows)],
      ['session_behavioural_features_v0_2', numOrDash(r.evidence_chain.session_behavioural_features_rows)],
      ['stage0_decisions',                  numOrDash(r.evidence_chain.stage0_decisions_rows)],
      ['risk_observations_v0_1',            numOrDash(r.evidence_chain.risk_observations_rows)],
      ['poi_observations_v0_1',             numOrDash(r.evidence_chain.poi_observations_rows)],
      ['poi_sequence_observations_v0_1',    numOrDash(r.evidence_chain.poi_sequence_observations_rows)],
    ],
  ));
  out.push('');

  // §4 Lane A — customer-safer candidate observations.
  out.push('## §4 Lane A candidate observations — evidence-review inputs, not scores');
  out.push('');
  out.push(
    '> **Lane A candidate observations are evidence-review inputs, ' +
      'not automated customer-facing scores.**',
  );
  out.push('');
  out.push(table(
    ['Lane A field', 'Value'],
    [
      ['rejected_event_count (window)',     numOrDash(r.lane_a_candidates.rejected_event_count)],
      ['stage0_excluded_count (window)',    numOrDash(r.lane_a_candidates.stage0_excluded_count)],
      ['risk_observation_rows_with_evidence (window)', numOrDash(r.lane_a_candidates.risk_observation_rows_with_evidence)],
    ],
  ));
  out.push('');
  out.push('**Evidence gaps affecting Lane-A traffic-quality confidence**:');
  out.push('');
  if (r.lane_a_candidates.evidence_gaps_affecting_traffic_quality.length === 0) {
    out.push('- (none flagged for this window)');
  } else {
    for (const g of r.lane_a_candidates.evidence_gaps_affecting_traffic_quality) out.push(`- ${g}`);
  }
  out.push('');

  // §5 Lane B — internal-only observations.
  out.push('## §5 Lane B internal observations — internal learning inputs only');
  out.push('');
  out.push(
    '> **Lane B observations are internal learning inputs only and ' +
      'must not be exposed as customer-facing claims.**',
  );
  out.push('');
  out.push(table(
    ['Lane B field', 'Value'],
    [
      ['poi_observation_rows (window)',          numOrDash(r.lane_b_internal.poi_observation_rows)],
      ['poi_sequence_observation_rows (window)', numOrDash(r.lane_b_internal.poi_sequence_observation_rows)],
      ['session_features_coverage_rows (window)', numOrDash(r.lane_b_internal.session_features_coverage_rows)],
      ['session_behavioural_features_coverage_rows (window)', numOrDash(r.lane_b_internal.session_behavioural_features_coverage_rows)],
      ['stage0_eligible_count (window)',         numOrDash(r.lane_b_internal.stage0_eligible_count)],
    ],
  ));
  out.push('');
  out.push(`_${r.lane_b_internal.ambiguous_or_insufficient_buckets_note}_`);
  out.push('');

  // §6 Evidence gaps
  out.push('## §6 Evidence gaps');
  out.push('');
  out.push(table(
    ['Gap', 'Present?'],
    [
      ['missing_accepted_events_coverage',     yesNo(r.evidence_gaps.missing_accepted_events_coverage)],
      ['missing_session_features',             yesNo(r.evidence_gaps.missing_session_features)],
      ['missing_behavioural_features',         yesNo(r.evidence_gaps.missing_behavioural_features)],
      ['missing_poi_observations',             yesNo(r.evidence_gaps.missing_poi_observations)],
      ['missing_risk_observations',            yesNo(r.evidence_gaps.missing_risk_observations)],
      ['missing_productfeatures_observations', yesNo(r.evidence_gaps.missing_productfeatures_observations)],
      ['insufficient_window',                  yesNo(r.evidence_gaps.insufficient_window)],
      ['no_conversion_evidence',               yesNo(r.evidence_gaps.no_conversion_evidence)],
      ['insufficient_utm_source_context',      yesNo(r.evidence_gaps.insufficient_utm_source_context)],
    ],
  ));
  out.push('');
  if (r.evidence_gaps.gaps_summary.length > 0) {
    out.push('**Gap notes**:');
    out.push('');
    for (const g of r.evidence_gaps.gaps_summary) out.push(`- ${g}`);
    out.push('');
  }

  // §7 Evidence Review readiness
  out.push('## §7 Evidence Review readiness');
  out.push('');
  out.push(`**Bucket:** \`${r.readiness.bucket}\``);
  out.push('');
  out.push('> This is an **operator readiness status**, not a numeric score.');
  out.push('');
  out.push('**Reasons:**');
  out.push('');
  for (const reason of r.readiness.reasons) out.push(`- ${reason}`);
  out.push('');
  out.push(readinessGuidance(r.readiness.bucket));
  out.push('');

  // §8 Founder notes prompt
  out.push('## §8 Founder notes prompt (copy into the private customer folder)');
  out.push('');
  out.push('**What looks verifiable?**');
  out.push('');
  if (r.founder_notes_prompt.what_looks_verifiable.length === 0) {
    out.push('- (snapshot found no clearly-verifiable claims for this window)');
  } else {
    for (const s of r.founder_notes_prompt.what_looks_verifiable) out.push(`- ${s}`);
  }
  out.push('');
  out.push('**What remains unknown?**');
  out.push('');
  if (r.founder_notes_prompt.what_remains_unknown.length === 0) {
    out.push('- (snapshot found no major unknowns for this window)');
  } else {
    for (const s of r.founder_notes_prompt.what_remains_unknown) out.push(`- ${s}`);
  }
  out.push('');
  out.push('**What should NOT be claimed?**');
  out.push('');
  for (const s of r.founder_notes_prompt.what_should_not_be_claimed) out.push(`- ${s}`);
  out.push('');
  out.push('**What needs customer confirmation?**');
  out.push('');
  for (const s of r.founder_notes_prompt.what_needs_customer_confirmation) out.push(`- ${s}`);
  out.push('');
  out.push("**What to check in GA4 / CRM / customer-side analytics?**");
  out.push('');
  for (const s of r.founder_notes_prompt.what_to_check_in_ga4_or_crm) out.push(`- ${s}`);
  out.push('');

  // §9 Final boundary
  out.push('## §9 Final boundary');
  out.push('');
  out.push('- No durable Lane-A / Lane-B writer is added by this snapshot.');
  out.push('- No automated Lane-A or Lane-B output flows to any customer surface.');
  out.push('- No per-visitor / per-session customer-facing score is produced.');
  out.push('- No identity-resolution claim is produced.');
  out.push('- No ROI / conversion-rate-lift number is produced.');
  out.push('- No AMS Product Layer execution; no AMS runtime bridge wiring.');
  out.push('- No `ProductDecision`. No `RequestedAction`.');
  out.push('- No DB writes; this snapshot is strictly SELECT-only.');
  out.push('- Private customer notes stay in `/Users/admin/buyerrecon-engagements/`, outside any git repo.');
  out.push('');
  out.push('**End of Evidence Review Snapshot — internal only.**');
  out.push('');

  return out.join('\n');
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = `| ${headers.join(' | ')} |`;
  const sep  = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

function numOrDash(n: number | null): string {
  return n === null ? '—' : String(n);
}

function yesNo(b: boolean): string {
  return b ? 'yes' : 'no';
}

function safe(s: string): string {
  // Codex blocker fix: route every dynamic markdown value through
  // sanitizeOutputText so unsafe content can never reach stdout
  // even when the runner forgets a sanitizer. Cap length at 200
  // for table cells.
  if (typeof s !== 'string' || s.length === 0) return '';
  return sanitizeOutputText(s).slice(0, 200);
}

function readinessGuidance(bucket: ReadinessBucket): string {
  switch (bucket) {
    case 'READY_FOR_MANUAL_REVIEW':
      return '_Operator action:_ proceed with the manual Evidence Review write-up.';
    case 'NEEDS_MORE_EVIDENCE':
      return '_Operator action:_ extend the observation window OR re-run upstream observers (POI / risk / ProductFeatures CLI) and re-snapshot.';
    case 'INSTALL_OR_DATA_GAP':
      return '_Operator action:_ verify the collector install + Stage-0 / feature-extraction pipeline are running for this workspace_id. Do NOT proceed with the customer review until this is fixed.';
    case 'STOP_THE_LINE':
      return '_Operator action:_ STOP. The collector layer produced zero rows in the window. Halt the engagement until the customer-side install can be verified.';
  }
}
