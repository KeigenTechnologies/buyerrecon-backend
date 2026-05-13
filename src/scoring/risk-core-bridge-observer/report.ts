/**
 * Sprint 2 PR#8b — AMS Risk Core Bridge Observer — report aggregator.
 *
 * Pure module. No DB. No HTTP. No clock (except via the explicit
 * `run_started_at` / `run_ended_at` ISO-8601 strings the runner
 * supplies). No filesystem.
 *
 * Aggregates per-row outcomes into the final `ObserverReport` shape.
 * Applies masking (PR#8a §9) at the sample-list edge so the
 * serialised report never carries a full session_id.
 */

import type {
  ObserverReport,
  ObserverRowResult,
  ObserverRunMetadata,
  RejectReason,
} from './types.js';
import { REJECT_REASONS } from './types.js';

/**
 * Mask a session_id per PR#8a §9.2: first 8 chars + `…` + last 4.
 * Anchored max-length 16 (8 + 1 + 4 + extra room for the ellipsis
 * graphical width — the string itself is 13 characters).
 *
 * Short session IDs (length < 12) are returned as `'***'` to avoid
 * the prefix + suffix overlapping and effectively printing the full
 * value. This is the safe-truncated form mandated by PR#8a §9.2
 * "if session_id too short, still do not print full value".
 */
export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  const prefix = sessionId.slice(0, 8);
  const suffix = sessionId.slice(-4);
  return `${prefix}…${suffix}`;
}

/**
 * Parse a `DATABASE_URL` into `{ host, name }` parts, masking
 * userinfo + password. Returns sentinel values on parse failure
 * (never throws). The full URL is NEVER returned.
 */
export function parseDatabaseUrl(url: string | undefined): { host: string; name: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { host: '<unset>', name: '<unset>' };
  }
  try {
    const u = new URL(url);
    const host = u.host || '<host>';
    const name = u.pathname.replace(/^\//, '') || '<db>';
    return { host, name };
  } catch {
    return { host: '<unparseable>', name: '<unparseable>' };
  }
}

/* --------------------------------------------------------------------------
 * Aggregator
 *
 * The runner produces a stream (currently array) of `ObserverRowResult`
 * values and calls `aggregateReport` once at the end.
 * ------------------------------------------------------------------------ */

export interface AggregateInputs {
  readonly results:        readonly ObserverRowResult[];
  readonly rows_scanned:   number;
  readonly sample_limit:   number;
  readonly run_metadata:   ObserverRunMetadata;
}

export function aggregateReport(args: AggregateInputs): ObserverReport {
  const reject_reasons:                      Record<RejectReason, number> = newRejectCounter();
  const behavioural_feature_version_dist:    Record<string, number>       = Object.create(null) as Record<string, number>;
  const context_tag_dist:                    Record<string, number>       = Object.create(null) as Record<string, number>;
  const sample:                              string[]                     = [];

  let envelopes_built                           = 0;
  let rejects                                   = 0;
  let missing_sbf_evidence_ref_count            = 0;
  let stage0_excluded_count                     = 0;
  let eligible_for_buyer_motion_risk_core_count = 0;

  for (const r of args.results) {
    if (r.outcome === 'envelope_built') {
      envelopes_built += 1;
      const env = r.envelope;

      // behavioural_feature_version distribution
      const bfv = env.source_versions.behavioural_feature_version;
      behavioural_feature_version_dist[bfv] = (behavioural_feature_version_dist[bfv] ?? 0) + 1;

      // context_tag distribution
      for (const tag of env.context_tags) {
        context_tag_dist[tag] = (context_tag_dist[tag] ?? 0) + 1;
      }

      // eligibility flags
      if (env.eligibility.stage0_excluded === true) stage0_excluded_count += 1;
      if (env.eligibility.eligible_for_buyer_motion_risk_core === true) {
        eligible_for_buyer_motion_risk_core_count += 1;
      }

      // sample
      if (sample.length < args.sample_limit && r.session_id) {
        sample.push(truncateSessionId(r.session_id));
      }
      continue;
    }

    // rejected
    rejects += 1;
    reject_reasons[r.reason] = (reject_reasons[r.reason] ?? 0) + 1;
    if (r.reason === 'MISSING_SBF_EVIDENCE_REF') missing_sbf_evidence_ref_count += 1;
  }

  return {
    rows_scanned:                              args.rows_scanned,
    envelopes_built,
    rejects,
    reject_reasons:                            Object.freeze(reject_reasons),
    behavioural_feature_version_distribution:  Object.freeze(behavioural_feature_version_dist),
    missing_sbf_evidence_ref_count,
    context_tag_distribution:                  Object.freeze(context_tag_dist),
    stage0_excluded_count,
    eligible_for_buyer_motion_risk_core_count,
    sample_session_id_prefixes:                Object.freeze(sample.slice()),
    run_metadata:                              args.run_metadata,
  };
}

function newRejectCounter(): Record<RejectReason, number> {
  const out = Object.create(null) as Record<RejectReason, number>;
  for (const r of REJECT_REASONS) out[r] = 0;
  return out;
}

/* --------------------------------------------------------------------------
 * JSON serialiser (defence in depth)
 *
 * The runner / CLI calls `JSON.stringify(report)` directly — there
 * is no custom serialisation step. This helper is exported only so
 * tests can assert deterministic output shape and masking behaviour
 * without re-implementing the serialiser.
 * ------------------------------------------------------------------------ */

export function serialiseReport(report: ObserverReport): string {
  return JSON.stringify(report, null, 2);
}
