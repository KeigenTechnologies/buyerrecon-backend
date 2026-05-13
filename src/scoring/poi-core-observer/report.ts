/**
 * Sprint 2 PR#11b — POI Core Input Observer — report aggregator.
 *
 * Pure module. No DB. No HTTP. No clock (except via the explicit
 * `run_started_at` / `run_ended_at` ISO-8601 strings the runner
 * supplies). No filesystem.
 *
 * Aggregates per-row outcomes into the final `ObserverReport` shape.
 * Applies masking (PR#11a §5.1 — session_id masking, DSN masking) at
 * the sample-list edge so the serialised report never carries a full
 * session_id or DSN.
 */

import {
  POI_SURFACE_CLASSES_ALLOWED,
  POI_TYPE,
  POI_TYPES_ALLOWED,
  REFERRER_CLASSES_ALLOWED,
  type PoiSourceTable,
  type PoiSurfaceClass,
  type PoiType,
  type ReferrerClass,
} from '../poi-core/index.js';
import type {
  ObserverReport,
  ObserverRowResult,
  ObserverRunMetadata,
  RejectReason,
} from './types.js';
import { REJECT_REASONS } from './types.js';

const PRIMARY_SOURCE_TABLES: readonly PoiSourceTable[] = Object.freeze([
  'session_features',
  'session_behavioural_features_v0_2',
]);

/**
 * Mask a session_id (mirrors PR#8b §9.2): first 8 chars + `…` + last 4.
 *
 * Short session IDs (length < 12) are returned as `'***'` to avoid
 * the prefix + suffix overlapping and effectively printing the full
 * value. This is the safe-truncated form mandated by PR#11a §5.1
 * "Full session_id MUST be masked".
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
 *
 * `rows_scanned_by_source_table` tracks how many raw pg rows the
 * runner pulled from each primary source table — this is the SF-vs-
 * SBF readiness comparison PR#11a §6 calls for.
 *
 * `source_table_distribution` counts how many envelopes were built
 * (i.e. how many rows of each source table produced a valid
 * `PoiCoreInput`). In PR#11b v0.1 the expectation is `session_features`
 * dominates and `session_behavioural_features_v0_2 = 0` (because SBF
 * has no path/cta/form/offer/referrer columns — see mapper.ts).
 * ------------------------------------------------------------------------ */

export interface AggregateInputs {
  readonly results:                      readonly ObserverRowResult[];
  readonly rows_scanned_by_source_table: Readonly<Record<PoiSourceTable, number>>;
  readonly sample_limit:                 number;
  readonly run_metadata:                 ObserverRunMetadata;
}

export function aggregateReport(args: AggregateInputs): ObserverReport {
  const reject_reasons:                  Record<RejectReason, number>     = newRejectCounter();
  const poi_type_distribution:           Record<PoiType, number>          = newPoiTypeCounter();
  const poi_surface_class_distribution:  Record<PoiSurfaceClass, number>  = newPoiSurfaceClassCounter();
  const referrer_class_distribution:     Record<ReferrerClass, number>    = newReferrerClassCounter();
  const source_table_distribution:       Record<PoiSourceTable, number>   = newSourceTableCounter();
  const sample:                          string[]                         = [];

  const seenSessions: Set<string> = new Set();
  const sessionsBySourceTable: Map<PoiSourceTable, Set<string>> = new Map([
    ['session_features',                  new Set<string>()],
    ['session_behavioural_features_v0_2', new Set<string>()],
  ]);

  let envelopes_built          = 0;
  let rejects                  = 0;
  let stage0_excluded_count    = 0;
  let eligible_for_poi_count   = 0;

  for (const r of args.results) {
    // Track session-id coverage by source table so we can compute
    // "sessions seen on both tables" for the readiness comparison.
    // Use the result's session_id even on the reject path when
    // available — we want to know that the row existed for that
    // session_id, even if the envelope failed to build.
    const seenSessionId = r.outcome === 'envelope_built'
      ? r.session_id
      : (r.session_id !== null ? r.session_id : null);
    if (seenSessionId !== null) {
      seenSessions.add(seenSessionId);
      sessionsBySourceTable.get(r.source_table)!.add(seenSessionId);
    }

    if (r.outcome === 'envelope_built') {
      envelopes_built += 1;
      const env = r.envelope;

      // poi_type distribution (PR#11b v0.1 only sees `page_path`)
      poi_type_distribution[env.poi.poi_type] = (poi_type_distribution[env.poi.poi_type] ?? 0) + 1;

      // poi_surface_class distribution — increment only when the
      // envelope carries a finite (non-null) PoiSurfaceClass. PR#11b
      // does not classify surface_class itself; future PRs may. The
      // distribution is initialised with all 14 enum values at 0 so
      // a future bump remains backwards-compatible.
      const surfaceClass = env.poi.poi_surface_class;
      if (surfaceClass !== null) {
        poi_surface_class_distribution[surfaceClass] =
          (poi_surface_class_distribution[surfaceClass] ?? 0) + 1;
      }

      // referrer_class distribution — increment only when the
      // envelope carries poi_type === 'referrer_class' (in which case
      // env.poi.poi_key holds the ReferrerClass enum value). PR#11b
      // is hard-coded to page_path, so this distribution is expected
      // to remain all-zero in v0.1; the initialised buckets keep the
      // shape stable for future multi-POI-type runs.
      if (env.poi.poi_type === POI_TYPE.REFERRER_CLASS) {
        const referrerClass = env.poi.poi_key as ReferrerClass;
        if (referrer_class_distribution[referrerClass] !== undefined) {
          referrer_class_distribution[referrerClass] += 1;
        }
      }

      // source_table distribution
      source_table_distribution[env.source_identity.source_table] =
        (source_table_distribution[env.source_identity.source_table] ?? 0) + 1;

      // eligibility flags (carry-through, NOT reject reasons — PR#11a §5.1 patch)
      if (env.eligibility.stage0_excluded === true) stage0_excluded_count += 1;
      if (env.eligibility.poi_eligible === true)    eligible_for_poi_count  += 1;

      // sample (masked)
      if (sample.length < args.sample_limit && r.session_id) {
        sample.push(truncateSessionId(r.session_id));
      }
      continue;
    }

    // rejected
    rejects += 1;
    reject_reasons[r.reason] = (reject_reasons[r.reason] ?? 0) + 1;
  }

  // sessions_seen_on_both_tables = intersection of the two session-id sets
  const sfSet  = sessionsBySourceTable.get('session_features')!;
  const sbfSet = sessionsBySourceTable.get('session_behavioural_features_v0_2')!;
  let sessions_seen_on_both_tables = 0;
  for (const s of sfSet) if (sbfSet.has(s)) sessions_seen_on_both_tables += 1;

  const rows_scanned =
    (args.rows_scanned_by_source_table.session_features ?? 0) +
    (args.rows_scanned_by_source_table.session_behavioural_features_v0_2 ?? 0);

  return {
    rows_scanned,
    rows_scanned_by_source_table: Object.freeze({
      session_features:                  args.rows_scanned_by_source_table.session_features ?? 0,
      session_behavioural_features_v0_2: args.rows_scanned_by_source_table.session_behavioural_features_v0_2 ?? 0,
    }),
    envelopes_built,
    rejects,
    reject_reasons:                  Object.freeze(reject_reasons),
    poi_type_distribution:           Object.freeze(poi_type_distribution),
    poi_surface_class_distribution:  Object.freeze(poi_surface_class_distribution),
    referrer_class_distribution:     Object.freeze(referrer_class_distribution),
    source_table_distribution:       Object.freeze(source_table_distribution),
    stage0_excluded_count,
    eligible_for_poi_count,
    // Derived counters — surface the privacy-sensitive reject classes
    // explicitly. Both are mirrors of `reject_reasons[...]`; they exist
    // so an operator can spot privacy-key failures without scanning
    // the full reject_reasons map.
    //
    // `unsafe_poi_key_reject_count` counts page-path normalisation
    // rejects — these are PR#10 Codex-blocker hits (credential markers
    // in path segments, email-shaped PII, etc.). A non-zero value here
    // means the observer's privacy filter is doing useful work on real
    // data.
    //
    // `evidence_ref_reject_count` counts PR#10 adapter rejections of
    // evidence_refs (allowlist failure, forbidden-key sweep, missing
    // table field). PR#11b's mapper builds evidence_refs from
    // controlled inputs, so a non-zero value here would indicate a
    // logic bug or a contract drift between the observer and PR#10 —
    // not a user-data issue.
    unsafe_poi_key_reject_count:  reject_reasons.INVALID_PAGE_PATH,
    evidence_ref_reject_count:    reject_reasons.EVIDENCE_REF_REJECT,
    unique_session_ids_seen:      seenSessions.size,
    sessions_seen_on_both_tables,
    sample_session_id_prefixes:   Object.freeze(sample.slice()),
    run_metadata:                 args.run_metadata,
  };
}

function newRejectCounter(): Record<RejectReason, number> {
  const out = Object.create(null) as Record<RejectReason, number>;
  for (const r of REJECT_REASONS) out[r] = 0;
  return out;
}

function newPoiTypeCounter(): Record<PoiType, number> {
  const out = Object.create(null) as Record<PoiType, number>;
  for (const t of POI_TYPES_ALLOWED) out[t] = 0;
  return out;
}

function newSourceTableCounter(): Record<PoiSourceTable, number> {
  const out = Object.create(null) as Record<PoiSourceTable, number>;
  for (const t of PRIMARY_SOURCE_TABLES) out[t] = 0;
  return out;
}

function newPoiSurfaceClassCounter(): Record<PoiSurfaceClass, number> {
  const out = Object.create(null) as Record<PoiSurfaceClass, number>;
  for (const c of POI_SURFACE_CLASSES_ALLOWED) out[c] = 0;
  return out;
}

function newReferrerClassCounter(): Record<ReferrerClass, number> {
  const out = Object.create(null) as Record<ReferrerClass, number>;
  for (const c of REFERRER_CLASSES_ALLOWED) out[c] = 0;
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
