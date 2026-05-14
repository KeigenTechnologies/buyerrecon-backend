/**
 * Sprint 2 PR#13b — Product-Context / Timing Observer — pure mapper.
 *
 * Pure module. NO clock reads (no `Date.now`, no `new Date()` for
 * timing decisions; `evaluation_at` is passed in by the runner). NO
 * randomness. NO DB. NO process.env reads.
 *
 * Maps `poi_observations_v0_1` + `poi_sequence_observations_v0_1`
 * rows into a per-session preview shape alignable with AMS
 * `BuyerReconProductFeatures` JSON (but NOT identical to and NOT
 * dependent on AMS runtime).
 */

import {
  ACTIONABILITY_BANDS_ALLOWED,
  EXCLUDED_SURFACES,
  TIMING_THRESHOLDS_BY_SALES_MOTION,
  UNIVERSAL_SURFACES_ALLOWED,
  type ActionabilityBand,
  type EvidencePreviewRejectReason,
  type PoiRowRaw,
  type PoiSequenceRowRaw,
  type SalesMotion,
  type UniversalSurface,
} from './types.js';

const EXCLUDED_SURFACE_SET: ReadonlySet<UniversalSurface> = new Set(EXCLUDED_SURFACES);
const UNIVERSAL_SURFACE_SET: ReadonlySet<string> = new Set(UNIVERSAL_SURFACES_ALLOWED);

/* --------------------------------------------------------------------------
 * Coercion helpers (defensive — pg returns BIGINT/JSONB as strings).
 * ------------------------------------------------------------------------ */

function coerceText(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function coerceBoolean(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function coerceInteger(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n) && Number.isInteger(n)) return n;
  }
  return null;
}

function coerceMillisFromTimestamp(v: unknown): number | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.getTime();
  if (typeof v === 'string' && v.length > 0) {
    const t = Date.parse(v);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Universal surface taxonomy classifier — baseline pattern rules.
 *
 * Inputs: `poi_type` (always `'page_path'` for v0.1 per migration
 * 014 CHECK), `poi_key` (normalised page path).
 *
 * Returns one of `UNIVERSAL_SURFACES_ALLOWED`. Falls back to
 * `'unknown'` when no pattern matches — the runner counts those.
 *
 * Patterns are deterministic and conservative. They MUST NOT
 * inspect raw URLs / queries / fragments (POI keys are already
 * normalised). Customer-specific overrides will arrive through a
 * `site_mapping` profile field in a later PR; v0.1 uses this
 * baseline.
 * ------------------------------------------------------------------------ */

interface SurfaceRule {
  readonly label:    UniversalSurface;
  readonly suffixes: readonly string[];
  readonly exacts?:  readonly string[];
  readonly contains?: readonly string[];
}

const SURFACE_RULES: readonly SurfaceRule[] = Object.freeze([
  { label: 'homepage',         exacts: ['/', ''],                          suffixes: [] },
  { label: 'pricing',          suffixes: ['/pricing', '/plans', '/buy'] },
  { label: 'demo_request',     suffixes: ['/demo', '/get-demo', '/request-demo', '/book-demo', '/free-trial'] },
  { label: 'case_study',       contains: ['/case-stud', '/customer-stories', '/case-studies'], suffixes: [] },
  { label: 'integration',      contains: ['/integration'], suffixes: [] },
  { label: 'comparison',       contains: ['/compare', '/vs/', '/comparison'], suffixes: [] },
  { label: 'trust_security',   contains: ['/security', '/trust', '/compliance', '/gdpr'], suffixes: [] },
  // `developer` must come BEFORE `documentation` so `/developer/docs`
  // resolves to `developer` (more specific) instead of `documentation`.
  { label: 'developer',        contains: ['/developer', '/api', '/sdk'], suffixes: [] },
  { label: 'documentation',    contains: ['/docs', '/help', '/support', '/guides'], suffixes: [] },
  { label: 'contact',          suffixes: ['/contact', '/contact-us', '/talk-to-sales'] },
  { label: 'resource',         contains: ['/resources', '/library', '/learn'], suffixes: [] },
  { label: 'careers',          suffixes: ['/careers', '/jobs', '/work-with-us'] },
  { label: 'legal_terms',      suffixes: ['/terms', '/terms-of-service', '/tos'] },
  { label: 'legal_privacy',    suffixes: ['/privacy', '/privacy-policy', '/cookies', '/cookie-policy'] },
  { label: 'blog_post',        contains: ['/blog/'], suffixes: ['/blog'] },
  { label: 'feature_detail',   contains: ['/features/', '/product/feature/'], suffixes: [] },
  { label: 'product_overview', contains: ['/product/', '/platform/'], suffixes: ['/product', '/platform'] },
]);

export function classifyUniversalSurface(poiType: string, poiKey: string): UniversalSurface {
  if (poiType !== 'page_path') return 'unknown';
  const normalised = poiKey.toLowerCase();

  for (const rule of SURFACE_RULES) {
    if (rule.exacts !== undefined) {
      for (const e of rule.exacts) {
        if (normalised === e) return rule.label;
      }
    }
    for (const suffix of rule.suffixes) {
      if (normalised === suffix || normalised.endsWith(suffix)) return rule.label;
    }
    if (rule.contains !== undefined) {
      for (const c of rule.contains) {
        if (normalised.includes(c)) return rule.label;
      }
    }
  }
  return 'unknown';
}

export function isExcludedSurface(label: UniversalSurface): boolean {
  return EXCLUDED_SURFACE_SET.has(label);
}

export function isKnownSurface(label: string): boolean {
  return UNIVERSAL_SURFACE_SET.has(label);
}

/* --------------------------------------------------------------------------
 * Timing band classifier.
 *
 * Inputs:
 *   - `last_activity_ms` — millis-since-epoch of last POI Sequence
 *     activity for the session (already coerced).
 *   - `evaluation_ms` — millis-since-epoch the runner captured at
 *     run start; passed in explicitly.
 *   - `sales_motion` — selects threshold set.
 *
 * Returns one of `ACTIONABILITY_BANDS_ALLOWED`. The coincidental
 * `dormant` overlap with AMS `WindowState` is namespace-disjoint
 * (PR#13a §4.10 / §17).
 * ------------------------------------------------------------------------ */

export function classifyActionabilityBand(
  last_activity_ms: number | null,
  evaluation_ms:    number,
  sales_motion:     SalesMotion,
  poi_count:        number,
  unique_poi_count: number,
): ActionabilityBand {
  if (poi_count < 1 || unique_poi_count < 1) return 'insufficient_evidence';
  if (last_activity_ms === null) return 'insufficient_evidence';
  if (evaluation_ms < last_activity_ms) {
    // Defensive — if evaluation clock predates evidence, the row is
    // unsafe to band. Treat as insufficient_evidence rather than
    // attempting backward time arithmetic.
    return 'insufficient_evidence';
  }

  const t = TIMING_THRESHOLDS_BY_SALES_MOTION[sales_motion];
  const hoursSince = (evaluation_ms - last_activity_ms) / (3600 * 1000);

  if (hoursSince <= t.t_hot)     return 'hot_now';
  if (hoursSince <= t.t_warm)    return 'warm_recent';
  if (hoursSince <= t.t_stale)   return 'cooling';
  if (hoursSince <= t.t_dormant) return 'stale';
  return 'dormant';
}

/* --------------------------------------------------------------------------
 * Per-session preview record — assembled in-memory from grouped POI
 * + POI Sequence rows for one session.
 * ------------------------------------------------------------------------ */

export interface SessionPreview {
  readonly workspace_id:                       string;
  readonly site_id:                            string;
  readonly session_id:                         string;
  readonly poi_count:                          number;
  readonly unique_poi_count:                   number;
  readonly progression_depth:                  number;
  readonly poi_sequence_pattern_class:         string;
  readonly stage0_excluded:                    boolean;
  readonly poi_sequence_eligible:              boolean;
  readonly hours_since_last_session_or_null:   number | null;
  readonly actionability_band:                 ActionabilityBand;
  readonly surface_distribution:               Readonly<Record<string, number>>;
  readonly excluded_surface_count:             number;
  readonly unknown_surface_count:              number;
  readonly mapping_coverage_percent:           number;
  readonly pricing_signal_present:             boolean;
  readonly comparison_signal_present:          boolean;
  readonly accepted_into_preview:              boolean;
  readonly reject_reason:                      EvidencePreviewRejectReason | null;
}

export interface GroupedRows {
  readonly key:                  string;
  readonly workspace_id:         string;
  readonly site_id:              string;
  readonly session_id:           string;
  readonly poi_rows:             readonly PoiRowRaw[];
  readonly poi_sequence_row:     PoiSequenceRowRaw | null;
}

const SEP = '\x1f';

function sessionKey(ws: string, site: string, sess: string): string {
  return `${ws}${SEP}${site}${SEP}${sess}`;
}

/* --------------------------------------------------------------------------
 * Group POI rows + POI Sequence rows by (workspace, site, session).
 *
 * POI Sequence has at most one row per session (per migration 015
 * natural-key UNIQUE). If multiple exist (e.g. distinct
 * `poi_observation_version` values), the latest by id wins for
 * preview purposes.
 * ------------------------------------------------------------------------ */

export function groupBySession(
  poiRows:         readonly PoiRowRaw[],
  poiSequenceRows: readonly PoiSequenceRowRaw[],
): readonly GroupedRows[] {
  const buckets = new Map<string, {
    workspace_id: string;
    site_id: string;
    session_id: string;
    poi_rows: PoiRowRaw[];
    poi_sequence_row: PoiSequenceRowRaw | null;
    seq_id: number;
  }>();

  for (const r of poiRows) {
    const ws   = coerceText(r.workspace_id);
    const site = coerceText(r.site_id);
    const sess = coerceText(r.session_id);
    if (ws === null || site === null || sess === null) continue;
    const k = sessionKey(ws, site, sess);
    let bucket = buckets.get(k);
    if (bucket === undefined) {
      bucket = { workspace_id: ws, site_id: site, session_id: sess, poi_rows: [], poi_sequence_row: null, seq_id: -1 };
      buckets.set(k, bucket);
    }
    bucket.poi_rows.push(r);
  }

  for (const r of poiSequenceRows) {
    const ws   = coerceText(r.workspace_id);
    const site = coerceText(r.site_id);
    const sess = coerceText(r.session_id);
    if (ws === null || site === null || sess === null) continue;
    const k = sessionKey(ws, site, sess);
    let bucket = buckets.get(k);
    if (bucket === undefined) {
      bucket = { workspace_id: ws, site_id: site, session_id: sess, poi_rows: [], poi_sequence_row: null, seq_id: -1 };
      buckets.set(k, bucket);
    }
    const id = coerceInteger(r.poi_sequence_observation_id) ?? -1;
    if (id > bucket.seq_id) {
      bucket.seq_id = id;
      bucket.poi_sequence_row = r;
    }
  }

  const out: GroupedRows[] = [];
  for (const [k, b] of buckets) {
    out.push({
      key:              k,
      workspace_id:     b.workspace_id,
      site_id:          b.site_id,
      session_id:       b.session_id,
      poi_rows:         Object.freeze([...b.poi_rows]),
      poi_sequence_row: b.poi_sequence_row,
    });
  }
  return Object.freeze(out);
}

/* --------------------------------------------------------------------------
 * Validate evidence_refs.
 *
 * Mirrors the PR#12e SQL bad-id predicate (Codex blocker fix in
 * `EVIDENCE_REFS_BAD_ID_PREDICATE` — rejects fractional / negative /
 * non-number poi_observation_id) plus the OD-14 direct-table guard.
 *
 * Rejects:
 *   - non-array / empty array
 *   - non-object / null / array entries
 *   - missing `table` field
 *   - `table` other than 'poi_observations_v0_1' (OD-14)
 *   - missing `poi_observation_id`
 *   - non-number poi_observation_id (e.g. string "42")
 *   - non-finite poi_observation_id (NaN / Infinity)
 *   - negative poi_observation_id
 *   - fractional poi_observation_id (e.g. 1.5)
 *
 * Accepts:
 *   - non-empty array where every entry is `{ table: "poi_observations_v0_1",
 *     poi_observation_id: <finite non-negative integer> }` (including 0).
 *
 * Malformed evidence_refs become row-level rejects (handled by
 * `buildSessionPreview`), never run-level crashes.
 * ------------------------------------------------------------------------ */

export function isValidEvidenceRefs(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const rec = entry as { table?: unknown; poi_observation_id?: unknown };
    const t = rec.table;
    if (typeof t !== 'string' || t.length === 0) return false;
    if (t !== 'poi_observations_v0_1') return false;
    const id = rec.poi_observation_id;
    if (typeof id !== 'number') return false;
    if (!Number.isFinite(id)) return false;          // rejects NaN + Infinity
    if (id < 0) return false;                         // rejects negatives
    if (id !== Math.trunc(id)) return false;          // rejects fractionals
  }
  return true;
}

/* --------------------------------------------------------------------------
 * Build per-session preview record.
 *
 * Decision tree:
 *   1. Identity missing → reject `missing_identity`
 *   2. POI Sequence row absent OR timestamps missing → reject `missing_timestamps`
 *   3. stage0_excluded session → reject `stage0_excluded_session` (still surfaced
 *      in counts; carry-through, not erased)
 *   4. evidence_refs invalid (PR#12d OD-14 violation) → reject `invalid_evidence_refs`
 *   5. All POI rows resolve to excluded surfaces only → reject `excluded_surface_only`
 *   6. All POI rows resolve to `unknown` surface → reject `mapping_unknown_surface`
 *   7. Otherwise → accept into preview
 *
 * In all cases the surface_distribution + actionability band are
 * still computed so the report can show the shape; only the
 * `accepted_into_preview` flag and `reject_reason` differ.
 * ------------------------------------------------------------------------ */

export function buildSessionPreview(
  group:         GroupedRows,
  evaluation_ms: number,
  sales_motion:  SalesMotion,
): SessionPreview {
  const surfaceDist: Record<string, number> = Object.create(null);
  let excludedCount = 0;
  let unknownCount  = 0;
  let pricingSignal     = false;
  let comparisonSignal  = false;

  for (const r of group.poi_rows) {
    const poiType = coerceText(r.poi_type) ?? 'unknown';
    const poiKey  = coerceText(r.poi_key)  ?? '';
    const label   = classifyUniversalSurface(poiType, poiKey);
    surfaceDist[label] = (surfaceDist[label] ?? 0) + 1;
    if (label === 'unknown')             unknownCount++;
    if (isExcludedSurface(label))        excludedCount++;
    if (label === 'pricing')             pricingSignal    = true;
    if (label === 'comparison')          comparisonSignal = true;
  }

  const totalSurfaces       = group.poi_rows.length;
  const mappedSurfaces      = totalSurfaces - unknownCount;
  const mappingCoveragePct  = totalSurfaces === 0 ? 0 : Math.round((mappedSurfaces / totalSurfaces) * 1000) / 10;

  const seq = group.poi_sequence_row;
  const poiCount         = seq !== null ? (coerceInteger(seq.poi_count)         ?? 0) : group.poi_rows.length;
  const uniquePoiCount   = seq !== null ? (coerceInteger(seq.unique_poi_count)  ?? 0) : new Set(group.poi_rows.map((r) => coerceText(r.poi_key))).size;
  const progressionDepth = seq !== null ? (coerceInteger(seq.progression_depth) ?? uniquePoiCount) : uniquePoiCount;
  const patternClass     = seq !== null ? (coerceText(seq.poi_sequence_pattern_class) ?? 'unknown') : 'unknown';
  const stage0Excluded   = seq !== null ? (coerceBoolean(seq.stage0_excluded) ?? false) : group.poi_rows.some((r) => coerceBoolean(r.stage0_excluded) === true);
  const seqEligible      = seq !== null ? (coerceBoolean(seq.poi_sequence_eligible) ?? !stage0Excluded) : !stage0Excluded;
  const lastSeenMs       = seq !== null ? coerceMillisFromTimestamp(seq.last_seen_at) : null;
  const hoursSinceLast   = lastSeenMs !== null && evaluation_ms >= lastSeenMs
    ? Math.round(((evaluation_ms - lastSeenMs) / (3600 * 1000)) * 10) / 10
    : null;
  const band             = classifyActionabilityBand(lastSeenMs, evaluation_ms, sales_motion, poiCount, uniquePoiCount);

  let rejectReason: EvidencePreviewRejectReason | null = null;

  if (totalSurfaces === 0 || seq === null) {
    rejectReason = 'missing_timestamps';
  } else if (lastSeenMs === null) {
    rejectReason = 'missing_timestamps';
  } else if (stage0Excluded) {
    rejectReason = 'stage0_excluded_session';
  } else if (seq !== null && !isValidEvidenceRefs(seq.evidence_refs)) {
    rejectReason = 'invalid_evidence_refs';
  } else if (totalSurfaces > 0 && excludedCount === totalSurfaces) {
    rejectReason = 'excluded_surface_only';
  } else if (totalSurfaces > 0 && unknownCount === totalSurfaces) {
    rejectReason = 'mapping_unknown_surface';
  }

  return {
    workspace_id:                       group.workspace_id,
    site_id:                            group.site_id,
    session_id:                         group.session_id,
    poi_count:                          poiCount,
    unique_poi_count:                   uniquePoiCount,
    progression_depth:                  progressionDepth,
    poi_sequence_pattern_class:         patternClass,
    stage0_excluded:                    stage0Excluded,
    poi_sequence_eligible:              seqEligible,
    hours_since_last_session_or_null:   hoursSinceLast,
    actionability_band:                 band,
    surface_distribution:               Object.freeze(surfaceDist),
    excluded_surface_count:             excludedCount,
    unknown_surface_count:              unknownCount,
    mapping_coverage_percent:           mappingCoveragePct,
    pricing_signal_present:             pricingSignal,
    comparison_signal_present:          comparisonSignal,
    accepted_into_preview:              rejectReason === null,
    reject_reason:                      rejectReason,
  };
}

/* --------------------------------------------------------------------------
 * Session-id masking helper (mirrors PR#11b / PR#11d / PR#12b / PR#12d).
 * ------------------------------------------------------------------------ */

export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  return `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`;
}

/* --------------------------------------------------------------------------
 * Distribution-fold helper used by the runner.
 * ------------------------------------------------------------------------ */

export function emptyActionabilityDist(): Record<ActionabilityBand, number> {
  const out = Object.create(null) as Record<ActionabilityBand, number>;
  for (const b of ACTIONABILITY_BANDS_ALLOWED) out[b] = 0;
  return out;
}

export function emptyUniversalSurfaceDist(): Record<string, number> {
  const out = Object.create(null) as Record<string, number>;
  for (const s of UNIVERSAL_SURFACES_ALLOWED) out[s] = 0;
  return out;
}
