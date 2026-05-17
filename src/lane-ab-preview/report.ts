/**
 * Sprint 2 PR#16b — Lane A / Lane B Evidence Review preview — markdown renderer.
 *
 * Pure function. Takes a `LaneABPreviewReport` and emits markdown
 * to a single string. Internal-only — for Helen's eyes alongside
 * the customer's written Evidence Review.
 *
 * Hard rendering rules:
 *   - Every dynamic value routes through PR#15a `sanitizeOutputText`
 *     (defence-in-depth even though the snapshot pre-sanitizes).
 *   - Counts, family labels, and short prompt strings only; no raw
 *     identifiers, URLs with query strings, emails, tokens, UAs,
 *     session IDs, UUIDs, IPs, JWTs, or raw JSON payloads.
 *   - No automated per-visitor / per-session score, ever.
 *   - "ProductDecision" and "RequestedAction" appear only inside
 *     the §10 forbidden-boundary text.
 *   - "Track A" appears only inside the §9 readiness note and the
 *     §10 forbidden-boundary text.
 */

import { sanitizeOutputText } from '../evidence-review-snapshot/sanitize.js';
import type {
  LaneABPreviewReport,
  LaneAObservation,
  LaneBObservation,
} from './types.js';

export function renderLaneABPreviewMarkdown(r: LaneABPreviewReport): string {
  const out: string[] = [];

  out.push('# Lane A / Lane B Evidence Review preview — internal only');
  out.push('');
  out.push(
    'This preview applies the PR#16a Lane A / Lane B Evidence Review ' +
      'contract to the PR#15a snapshot output. It is **internal**, ' +
      '**founder-readable**, **read-only**, and **not a customer-' +
      'facing automated claim**. No durable Lane-A / Lane-B writer ' +
      'is added. No per-visitor / per-session score is produced. ' +
      'See §10 for the explicit forbidden-boundary list.',
  );
  out.push('');

  // §1 Boundary
  out.push('## §1 Boundary');
  out.push('');
  out.push(table(['Field', 'Value'], [
    ['preview_version',        r.boundary.preview_version],
    ['snapshot_version',       safe(r.boundary.snapshot_version)],
    ['workspace_id',           safe(r.boundary.workspace_id)],
    ['site_id',                safe(r.boundary.site_id)],
    ['window_start',           r.boundary.window_start_iso],
    ['window_end',             r.boundary.window_end_iso],
    ['checked_at',             r.boundary.checked_at_iso],
    ['database_host (masked)', safe(r.boundary.database_host_masked)],
    ['database_name (masked)', safe(r.boundary.database_name_masked)],
  ]));
  out.push('');

  // §2 Source availability summary
  out.push('## §2 Source availability summary');
  out.push('');
  out.push(table(
    ['Evidence source', 'Exists', 'Rows in window', 'Note'],
    r.source_availability.rows.map((row) => [
      safe(row.evidence_source),
      row.exists ? 'yes' : 'no',
      row.rows_in_window === null ? '—' : String(row.rows_in_window),
      safe(row.note),
    ]),
  ));
  out.push('');

  // §3 Lane A preview
  out.push('## §3 Lane A preview — customer-safer evidence-quality observations');
  out.push('');
  out.push(`> **${safe(r.lane_a.posture_note)}**`);
  out.push('');
  out.push(
    '_Lane A is the lane Helen may discuss with the customer, with ' +
      'appropriate caveat language. Counts here are **candidate ' +
      'observations**, not automated scores._',
  );
  out.push('');
  if (r.lane_a.observations.length === 0) {
    out.push('- (no Lane-A candidate observations were generated for this window)');
  } else {
    out.push(renderLaneAObservationsTable(r.lane_a.observations));
  }
  out.push('');

  // §4 Lane B preview
  out.push('## §4 Lane B preview — internal-only buyer-motion / product-context / timing observations');
  out.push('');
  out.push(`> **${safe(r.lane_b.posture_note)}**`);
  out.push('');
  out.push(
    '_Lane B is internal only. Founder review input. A Lane-B ' +
      'observation is **never** pasted verbatim into a customer-' +
      'facing review; if it inspires customer-facing copy, the ' +
      'founder rewrites it in customer-readable, claim-safe language._',
  );
  out.push('');
  if (r.lane_b.observations.length === 0) {
    out.push('- (no Lane-B internal observations were generated for this window)');
  } else {
    out.push(renderLaneBObservationsTable(r.lane_b.observations));
  }
  out.push('');

  // §5 Evidence gaps affecting Lane A
  out.push('## §5 Evidence gaps affecting Lane A');
  out.push('');
  if (r.lane_a.evidence_gaps_affecting_lane_a.length === 0) {
    out.push('- (no Lane-A evidence gaps flagged for this window)');
  } else {
    for (const g of r.lane_a.evidence_gaps_affecting_lane_a) out.push(`- ${safe(g)}`);
  }
  out.push('');

  // §6 Evidence gaps affecting Lane B
  out.push('## §6 Evidence gaps affecting Lane B');
  out.push('');
  if (r.lane_b.evidence_gaps_affecting_lane_b.length === 0) {
    out.push('- (no Lane-B evidence gaps flagged for this window)');
  } else {
    for (const g of r.lane_b.evidence_gaps_affecting_lane_b) out.push(`- ${safe(g)}`);
  }
  out.push('');

  // §7 What may be shown in an Evidence Review
  out.push('## §7 What may be shown in an Evidence Review');
  out.push('');
  out.push('**Allowed customer-facing wording (carry from PR#16a §8):**');
  out.push('');
  for (const a of r.customer_wording_rails.allowed) out.push(`- ${safe(a)}`);
  out.push('');
  out.push('**Forbidden customer-facing wording:**');
  out.push('');
  for (const f of r.customer_wording_rails.forbidden) out.push(`- ${safe(f)}`);
  out.push('');

  // §8 What must stay internal
  out.push('## §8 What must stay internal');
  out.push('');
  out.push('**Internal-only (Lane B):**');
  out.push('');
  for (const i of r.internal_only_rails.internal_only) out.push(`- ${safe(i)}`);
  out.push('');
  out.push('**Forbidden anywhere customer-facing:**');
  out.push('');
  for (const f of r.internal_only_rails.forbidden) out.push(`- ${safe(f)}`);
  out.push('');

  // §9 Track A readiness note
  out.push('## §9 Track A readiness note');
  out.push('');
  out.push(`**Track A run in this PR:** ${r.track_a_readiness.track_a_run_in_this_pr ? 'yes' : 'no'}`);
  out.push('');
  out.push('**Posture:**');
  out.push('');
  for (const p of r.track_a_readiness.posture) out.push(`- ${safe(p)}`);
  out.push('');
  out.push('**Forbidden leakage rules:**');
  out.push('');
  for (const f of r.track_a_readiness.forbidden_leakage) out.push(`- ${safe(f)}`);
  out.push('');

  // §10 Final boundary
  out.push('## §10 Final boundary');
  out.push('');
  out.push('- No durable Lane-A / Lane-B writer is added by this preview.');
  out.push('- No automated Lane-A or Lane-B output flows to any customer surface.');
  out.push('- No per-visitor / per-session customer-facing score is produced.');
  out.push('- No identity-resolution claim is produced.');
  out.push('- No ROI / conversion-rate-lift number is produced.');
  out.push('- No AMS Product Layer execution; no AMS runtime bridge wiring.');
  out.push('- No `ProductDecision`. No `RequestedAction`.');
  out.push('- No DB writes; the preview is strictly read-only over the PR#15a snapshot.');
  out.push('- No Track A labels appear in any Lane-A or Lane-B observation; Track A is named only in §9 and this §10 forbidden-boundary text.');
  out.push('- Private customer notes stay in `/Users/admin/buyerrecon-engagements/`, outside any git repo.');
  out.push('');
  out.push('**End of Lane A / Lane B Evidence Review preview — internal only.**');
  out.push('');

  return out.join('\n');
}

/* --------------------------------------------------------------------------
 * Observation tables
 * ------------------------------------------------------------------------ */

function renderLaneAObservationsTable(obs: readonly LaneAObservation[]): string {
  return table(
    ['Family', 'Evidence source', 'Aggregate count', 'Manual review needed', 'Cannot verify yet'],
    obs.map((o) => [
      safe(o.family),
      safe(o.evidence_source),
      o.aggregate_count === null ? '—' : String(o.aggregate_count),
      o.manual_review_needed ? 'yes' : 'no',
      safe(o.cannot_verify_yet_reason ?? ''),
    ]),
  );
}

function renderLaneBObservationsTable(obs: readonly LaneBObservation[]): string {
  return table(
    ['Family', 'Evidence source', 'Aggregate count', 'Missing-evidence bucket', 'Private founder-note prompt'],
    obs.map((o) => [
      safe(o.family),
      safe(o.evidence_source),
      o.aggregate_count === null ? '—' : String(o.aggregate_count),
      safe(o.missing_evidence_bucket ?? ''),
      safe(o.private_founder_note_prompt),
    ]),
  );
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

function safe(s: string): string {
  // Defence-in-depth: route every dynamic markdown value through
  // sanitizeOutputText even though the upstream PR#15a snapshot
  // pre-sanitizes the same fields. Cap length at 240 for prompt /
  // gap strings.
  if (typeof s !== 'string' || s.length === 0) return '';
  return sanitizeOutputText(s).slice(0, 240);
}
