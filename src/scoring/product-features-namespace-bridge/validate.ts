/**
 * Sprint 2 PR#14b — ProductFeatures-Namespace Bridge — validators.
 *
 * Pure module. No DB. No SQL. No clock reads. No randomness.
 *
 * Two validator entry points:
 *   - `validateBridgeMapperInput(input)` — pre-mapper validation;
 *     catches malformed inputs before any shaping work.
 *   - `validateBridgeCandidate(candidate)` — post-mapper validation;
 *     defence-in-depth that the built candidate honours every
 *     constraint listed in PR#14a §11 + the user's PR#14b spec.
 *
 * Both return `string[]` of reject reasons. Empty array means OK.
 */

import {
  ALLOWED_CONVERSION_PROXIMITY_INDICATORS,
  BRIDGE_ACTIONABILITY_BANDS_ALLOWED,
  BRIDGE_UNIVERSAL_SURFACES_ALLOWED,
  FORBIDDEN_AMS_PAYLOAD_KEYS,
  FORBIDDEN_PII_KEYS,
  NAMESPACE_KEY_CANDIDATE,
  type ActionabilityBand,
  type BridgeMapperInput,
  type BridgeNamespaceCandidate,
} from './types.js';

const ACTIONABILITY_BAND_SET:                ReadonlySet<string> = new Set(BRIDGE_ACTIONABILITY_BANDS_ALLOWED);
const UNIVERSAL_SURFACE_SET:                 ReadonlySet<string> = new Set(BRIDGE_UNIVERSAL_SURFACES_ALLOWED);
const FORBIDDEN_AMS_KEY_SET:                 ReadonlySet<string> = new Set(FORBIDDEN_AMS_PAYLOAD_KEYS);
const FORBIDDEN_PII_KEY_SET:                 ReadonlySet<string> = new Set(FORBIDDEN_PII_KEYS);
const CONVERSION_PROXIMITY_INDICATOR_SET:    ReadonlySet<string> = new Set(ALLOWED_CONVERSION_PROXIMITY_INDICATORS);

const REASON_NAMESPACE_PATTERN = /^(?:FIT|INTENT|WINDOW)\.[A-Z][A-Z0-9_]*$/;

/* --------------------------------------------------------------------------
 * Coercion-style guards
 * ------------------------------------------------------------------------ */

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonNegativeInteger(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v) && v >= 0;
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isStringArray(v: unknown): v is readonly string[] {
  if (!Array.isArray(v)) return false;
  for (const s of v) {
    if (!isNonEmptyString(s)) return false;
  }
  return true;
}

function isNonNegIntegerMap(v: unknown): v is Readonly<Record<string, number>> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  for (const k of Object.keys(v as Record<string, unknown>)) {
    const val = (v as Record<string, unknown>)[k];
    if (!isNonNegativeInteger(val)) return false;
  }
  return true;
}

/**
 * Validates `conversion_proximity_indicators` with both KEY and
 * VALUE constraints (Codex blocker fix).
 *
 *   - object-shape only (not null, not array)
 *   - every key MUST be in `ALLOWED_CONVERSION_PROXIMITY_INDICATORS`
 *     — rejects raw URLs, query strings, email-shaped tokens,
 *     PII-shaped keys, and any free-form label
 *   - every value MUST be a finite non-negative integer JSON number
 *
 * Empty map is allowed (mirrors PR#13b: a session with no
 * conversion-proximity hits produces an empty indicator map).
 *
 * Returns reason tokens for each violation, suitable for adding
 * to the validator's reasons array.
 */
function validateConversionProximityIndicators(v: unknown): readonly string[] {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return Object.freeze(['invalid_conversion_proximity_indicators']);
  }
  const reasons: string[] = [];
  const rec = v as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (!CONVERSION_PROXIMITY_INDICATOR_SET.has(k)) {
      reasons.push(`unknown_conversion_proximity_indicator_key:${k}`);
    }
    if (!isNonNegativeInteger(rec[k])) {
      reasons.push(`invalid_conversion_proximity_indicator_value:${k}`);
    }
  }
  return Object.freeze(reasons);
}

/* --------------------------------------------------------------------------
 * Recursive scans (used by post-mapper validator)
 * ------------------------------------------------------------------------ */

function recursiveKeyScan(value: unknown, predicate: (key: string) => boolean): string | null {
  if (value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = recursiveKeyScan(item, predicate);
      if (hit !== null) return hit;
    }
    return null;
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    if (predicate(k)) return k;
    const hit = recursiveKeyScan((value as Record<string, unknown>)[k], predicate);
    if (hit !== null) return hit;
  }
  return null;
}

function recursiveStringValueScan(value: unknown, predicate: (s: string) => boolean): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return predicate(value) ? value : null;
  if (typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = recursiveStringValueScan(item, predicate);
      if (hit !== null) return hit;
    }
    return null;
  }
  for (const k of Object.keys(value as Record<string, unknown>)) {
    const hit = recursiveStringValueScan((value as Record<string, unknown>)[k], predicate);
    if (hit !== null) return hit;
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Pre-mapper input validator
 * ------------------------------------------------------------------------ */

export function validateBridgeMapperInput(input: unknown): readonly string[] {
  const reasons: string[] = [];

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return Object.freeze(['input_not_object']);
  }
  const i = input as Record<string, unknown>;

  const requiredStringVersionFields = [
    'observer_version',
    'product_context_profile_version',
    'universal_surface_taxonomy_version',
    'category_template_version',
    'buying_role_lens_version',
    'site_mapping_version',
    'excluded_mapping_version',
    'timing_window_model_version',
    'freshness_decay_model_version',
  ];
  for (const f of requiredStringVersionFields) {
    if (!isNonEmptyString(i[f])) reasons.push(`missing_or_empty_version_field:${f}`);
  }

  for (const f of ['source_poi_observation_versions', 'source_poi_input_versions', 'source_poi_sequence_versions']) {
    if (!isStringArray(i[f])) reasons.push(`missing_or_invalid_string_array:${f}`);
  }

  if (i.ams_product_layer_reference_version !== undefined && !isNonEmptyString(i.ams_product_layer_reference_version)) {
    reasons.push('invalid_ams_product_layer_reference_version');
  }

  if (!isNonEmptyString(i.category_template))       reasons.push('missing_or_empty_field:category_template');
  if (!isNonEmptyString(i.primary_conversion_goal)) reasons.push('missing_or_empty_field:primary_conversion_goal');
  if (!isNonEmptyString(i.sales_motion))            reasons.push('missing_or_empty_field:sales_motion');

  if (!isNonNegIntegerMap(i.surface_distribution)) {
    reasons.push('invalid_surface_distribution');
  } else {
    for (const label of Object.keys(i.surface_distribution as Record<string, unknown>)) {
      if (!UNIVERSAL_SURFACE_SET.has(label)) {
        reasons.push(`unknown_surface_label:${label}`);
      }
    }
  }

  if (!isFiniteNumber(i.mapping_coverage_percent) || (i.mapping_coverage_percent as number) < 0 || (i.mapping_coverage_percent as number) > 100) {
    reasons.push('invalid_mapping_coverage_percent');
  }
  if (!isNonNegativeInteger(i.unknown_surface_count))  reasons.push('invalid_unknown_surface_count');
  if (!isNonNegativeInteger(i.excluded_surface_count)) reasons.push('invalid_excluded_surface_count');

  if (!isNonNegativeInteger(i.poi_count))        reasons.push('invalid_poi_count');
  if (!isNonNegativeInteger(i.unique_poi_count)) reasons.push('invalid_unique_poi_count');
  if (isNonNegativeInteger(i.poi_count) && isNonNegativeInteger(i.unique_poi_count)) {
    if ((i.unique_poi_count as number) > (i.poi_count as number)) {
      reasons.push('unique_poi_count_exceeds_poi_count');
    }
  }
  if (!isBoolean(i.pricing_signal_present))    reasons.push('invalid_pricing_signal_present');
  if (!isBoolean(i.comparison_signal_present)) reasons.push('invalid_comparison_signal_present');
  for (const r of validateConversionProximityIndicators(i.conversion_proximity_indicators)) {
    reasons.push(r);
  }

  const hsl = i.hours_since_last_qualifying_activity_or_null;
  if (hsl !== null && !(isFiniteNumber(hsl) && (hsl as number) >= 0)) {
    reasons.push('invalid_hours_since_last_qualifying_activity_or_null');
  }
  if (!isNonEmptyString(i.buyerrecon_actionability_band) || !ACTIONABILITY_BAND_SET.has(i.buyerrecon_actionability_band as string)) {
    reasons.push('invalid_buyerrecon_actionability_band');
  }
  if (!isNonEmptyString(i.timing_bucket))        reasons.push('missing_or_empty_field:timing_bucket');
  if (!isNonNegativeInteger(i.progression_depth)) reasons.push('invalid_progression_depth');

  return Object.freeze(reasons);
}

/* --------------------------------------------------------------------------
 * Post-mapper candidate validator
 *
 * Defence-in-depth: even if the mapper builds an object that passed
 * the input check, scan the OUTPUT for forbidden keys / strings /
 * shape problems. This catches any drift between the input shape
 * and the bridge contract.
 * ------------------------------------------------------------------------ */

export function validateBridgeCandidate(candidate: unknown): readonly string[] {
  const reasons: string[] = [];

  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return Object.freeze(['candidate_not_object']);
  }
  const c = candidate as Record<string, unknown>;

  // Top-level version stamps
  const requiredTopLevelStrings = [
    'bridge_contract_version',
    'bridge_payload_version',
    'generated_from_observer_version',
    'product_context_profile_version',
    'universal_surface_taxonomy_version',
    'category_template_version',
    'buying_role_lens_version',
    'site_mapping_version',
    'excluded_mapping_version',
    'timing_window_model_version',
    'freshness_decay_model_version',
    'ams_product_layer_reference_version',
  ];
  for (const f of requiredTopLevelStrings) {
    if (!isNonEmptyString(c[f])) reasons.push(`missing_candidate_field:${f}`);
  }

  if (c.namespace_key_candidate !== NAMESPACE_KEY_CANDIDATE) {
    reasons.push('invalid_namespace_key_candidate');
  }

  // source_evidence_versions
  const sev = c.source_evidence_versions;
  if (sev === null || typeof sev !== 'object' || Array.isArray(sev)) {
    reasons.push('invalid_source_evidence_versions_object');
  } else {
    const s = sev as Record<string, unknown>;
    for (const f of ['poi_observation_versions', 'poi_input_versions', 'poi_sequence_versions']) {
      if (!isStringArray(s[f])) reasons.push(`invalid_source_evidence_versions_field:${f}`);
    }
  }

  // preview_metadata flags — every flag MUST be the literal `true`
  const pm = c.preview_metadata;
  if (pm === null || typeof pm !== 'object' || Array.isArray(pm)) {
    reasons.push('invalid_preview_metadata_object');
  } else {
    const requiredFlags = [
      'internal_only',
      'non_authoritative',
      'not_customer_facing',
      'does_not_execute_ams_product_layer',
      'does_not_create_product_decision',
      'exact_ams_struct_compatibility_unproven_until_fixture',
    ];
    for (const flag of requiredFlags) {
      if ((pm as Record<string, unknown>)[flag] !== true) {
        reasons.push(`preview_metadata_flag_must_be_true:${flag}`);
      }
    }
  }

  // payload_candidate shape
  const pc = c.payload_candidate;
  if (pc === null || typeof pc !== 'object' || Array.isArray(pc)) {
    reasons.push('invalid_payload_candidate_object');
  } else {
    const p = pc as Record<string, unknown>;
    for (const subKey of ['fit_like_inputs', 'intent_like_inputs', 'timing_like_inputs']) {
      if (p[subKey] === null || typeof p[subKey] !== 'object' || Array.isArray(p[subKey])) {
        reasons.push(`invalid_payload_sub_block:${subKey}`);
      }
    }

    const f = p.fit_like_inputs as Record<string, unknown> | undefined;
    if (f !== undefined && !Array.isArray(f) && f !== null && typeof f === 'object') {
      if (!isNonNegIntegerMap(f.surface_distribution)) reasons.push('payload_invalid_surface_distribution');
      const cov = f.mapping_coverage_percent;
      if (!isFiniteNumber(cov) || (cov as number) < 0 || (cov as number) > 100) {
        reasons.push('payload_invalid_mapping_coverage_percent');
      }
      if (!isNonNegativeInteger(f.unknown_surface_count))  reasons.push('payload_invalid_unknown_surface_count');
      if (!isNonNegativeInteger(f.excluded_surface_count)) reasons.push('payload_invalid_excluded_surface_count');
    }

    const intent = p.intent_like_inputs as Record<string, unknown> | undefined;
    if (intent !== undefined && !Array.isArray(intent) && intent !== null && typeof intent === 'object') {
      if (!isNonNegativeInteger(intent.poi_count))           reasons.push('payload_invalid_poi_count');
      if (!isNonNegativeInteger(intent.unique_poi_count))    reasons.push('payload_invalid_unique_poi_count');
      if (!isBoolean(intent.pricing_signal_present))         reasons.push('payload_invalid_pricing_signal_present');
      if (!isBoolean(intent.comparison_signal_present))      reasons.push('payload_invalid_comparison_signal_present');
      for (const r of validateConversionProximityIndicators(intent.conversion_proximity_indicators)) {
        reasons.push(`payload_${r}`);
      }
    }

    const t = p.timing_like_inputs as Record<string, unknown> | undefined;
    if (t !== undefined && !Array.isArray(t) && t !== null && typeof t === 'object') {
      const hsl = t.hours_since_last_qualifying_activity_or_null;
      if (hsl !== null && !(isFiniteNumber(hsl) && (hsl as number) >= 0)) {
        reasons.push('payload_invalid_hours_since_last_qualifying_activity_or_null');
      }
      const band = t.buyerrecon_actionability_band;
      if (!isNonEmptyString(band) || !ACTIONABILITY_BAND_SET.has(band as string)) {
        reasons.push('payload_invalid_buyerrecon_actionability_band');
      }
      if (!isNonNegativeInteger(t.progression_depth)) reasons.push('payload_invalid_progression_depth');
    }
  }

  // Recursive scans — forbidden AMS reserved type names as KEYS
  const forbiddenAmsHit = recursiveKeyScan(candidate, (k) => FORBIDDEN_AMS_KEY_SET.has(k));
  if (forbiddenAmsHit !== null) reasons.push(`forbidden_ams_runtime_key_present:${forbiddenAmsHit}`);

  // Recursive scans — PII / enrichment / raw-URL / score / Lane /
  // Trust / Policy / session_id keys
  const piiHit = recursiveKeyScan(candidate, (k) => FORBIDDEN_PII_KEY_SET.has(k));
  if (piiHit !== null) reasons.push(`forbidden_pii_or_enrichment_key_present:${piiHit}`);

  // Recursive scans — `FIT.*` / `INTENT.*` / `WINDOW.*` reason-code
  // namespace strings as VALUES
  const reasonNsHit = recursiveStringValueScan(candidate, (s) => REASON_NAMESPACE_PATTERN.test(s));
  if (reasonNsHit !== null) reasons.push(`forbidden_ams_reason_namespace_value_present:${reasonNsHit}`);

  return Object.freeze(reasons);
}
