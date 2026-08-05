/**
 * BuyerRecon Golden Session v0.1 — persisted session evidence → EvidenceAtom mapper.
 *
 * Read-only mapper for EXACTLY ONE backend session (workspace_id + site_id +
 * session_id + pinned bounds). Maps already-persisted backend rows onto the
 * existing EvidenceAtom contract. It creates NO score, NO buyer-intent value,
 * and NO AMS duplicate — AMS remains the only scoring/policy authority and its
 * output never enters this module.
 *
 * Determinism: the same rows and pinned bounds produce byte-equivalent ordered
 * atoms. No wall clock, no randomness, no generated UUIDs, no env identity —
 * every atom_id derives from stable persisted row identity, every timestamp is
 * a persisted value, and ordering has a total deterministic tie-break.
 *
 * The database dependency is injected (same shape as the pg pool used by the
 * sibling report CLIs); this module never constructs a connection and never
 * reads environment values. All queries are SELECT-only.
 */

import { EXTERNAL_REPORT_SCHEMA_VERSION, type EvidenceAtom } from './contracts.js';

/** Minimal injected read-only query interface (satisfied by pg.Pool / pg.Client). */
export interface GoldenSessionDbClient {
  query(text: string, values: ReadonlyArray<string>): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** Backend evidence identity for exactly one session (identity truth #1). */
export interface BackendSessionIdentity {
  workspace_id: string;
  project_id: string;
  site_id: string;
  session_id: string;
  /** Pinned ISO-8601 window start bound. */
  window_start: string;
  /** Pinned ISO-8601 window end bound. */
  window_end: string;
}

export interface AcceptedEventAggregate {
  source_event_count: number;
  first_event_id: number | null;
  last_event_id: number | null;
  first_received_at: string | null;
  last_received_at: string | null;
}

export interface SessionFeaturesRow {
  session_features_id: number;
  extraction_version: string;
  extracted_at: string;
  first_seen_at: string;
  last_seen_at: string;
  session_duration_ms: number;
  source_event_count: number;
  page_view_count: number;
  cta_click_count: number;
  form_start_count: number;
  form_submit_count: number;
  unique_path_count: number;
}

export interface BehaviouralFeaturesRow {
  behavioural_features_id: number;
  feature_version: string;
  extracted_at: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  source_event_count: number;
  valid_feature_count: number;
  missing_feature_count: number;
}

export interface Stage0DecisionRow {
  stage0_decision_id: string;
  scoring_version: string;
  excluded: boolean;
  rule_id: string;
  created_at: string;
  source_event_count: number;
}

export interface RiskObservationRow {
  risk_observation_id: string;
  observation_version: string;
  scoring_version: string;
  created_at: string;
  source_event_count: number;
}

export interface PoiObservationRow {
  poi_observation_id: number;
  poi_type: string;
  poi_key: string;
  poi_observation_version: string;
  poi_eligible: boolean;
  derived_at: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  source_event_count: number;
}

export interface PoiSequenceObservationRow {
  poi_sequence_observation_id: number;
  poi_sequence_version: string;
  poi_count: number;
  unique_poi_count: number;
  poi_sequence_pattern_class: string;
  has_repetition: boolean;
  has_progression: boolean;
  derived_at: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

/** All persisted rows read for one session under the pinned bounds. */
export interface SessionPersistedRows {
  accepted_events_aggregate: AcceptedEventAggregate | null;
  session_features: SessionFeaturesRow | null;
  behavioural_features: BehaviouralFeaturesRow | null;
  stage0_decisions: Stage0DecisionRow[];
  risk_observations: RiskObservationRow[];
  poi_observations: PoiObservationRow[];
  poi_sequence_observations: PoiSequenceObservationRow[];
}

/** Finite, safe, stage-specific missing labels (never raw diagnostics). */
export const GOLDEN_SESSION_STAGE_MISSING_LABELS = Object.freeze({
  accepted_events: 'accepted_event_stage_missing',
  session_features: 'session_feature_stage_missing',
  behavioural_features: 'behavioural_feature_stage_missing',
  stage0_decisions: 'stage0_stage_missing',
  risk_observations: 'risk_observation_stage_missing',
  poi_observations: 'poi_observation_stage_missing',
  poi_sequence_observations: 'poi_sequence_observation_stage_missing',
} as const);

export type GoldenSessionStageName = keyof typeof GOLDEN_SESSION_STAGE_MISSING_LABELS;

export interface StagePresenceEntry {
  stage: GoldenSessionStageName;
  present: boolean;
  missing_label: string | null;
}

/** Normalize a persisted timestamp (pg Date object or string) to a stable ISO string. */
export function toIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function asInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return 0;
}

function asIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return asInt(value);
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 't';
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

/**
 * Read the persisted evidence rows for exactly one session. SELECT-only; every
 * query is scoped to the one session identity and the pinned bounds, and every
 * multi-row read has a stable ORDER BY so downstream mapping is deterministic.
 */
/**
 * Read the canonical ordered accepted-event id sequence for EXACTLY one
 * workspace + site + session inside the pinned bounds. SELECT-only.
 *
 * This is the independent third provenance source: it is derived from event
 * truth itself, not from the AMS artifact or the replay card, so a malformation
 * those two happen to share cannot survive comparison against it.
 *
 * Canonical ordering is `received_at ASC, event_id ASC` — the same order AMS
 * consumed — so the comparison is order-sensitive and not merely set-based.
 */
export async function readAcceptedEventIdSequence(
  db: GoldenSessionDbClient,
  identity: BackendSessionIdentity,
): Promise<ReadonlyArray<unknown>> {
  const result = await db.query(
    `SELECT event_id
       FROM accepted_events
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
        AND received_at >= $4::timestamptz AND received_at <= $5::timestamptz
      ORDER BY received_at ASC, event_id ASC`,
    [identity.workspace_id, identity.site_id, identity.session_id, identity.window_start, identity.window_end],
  );
  return result.rows.map((row) => row.event_id);
}

export async function readSessionPersistedRows(
  db: GoldenSessionDbClient,
  identity: BackendSessionIdentity,
): Promise<SessionPersistedRows> {
  const sessionScope = [identity.site_id, identity.session_id, identity.window_start, identity.window_end];
  const workspaceScope = [identity.workspace_id, ...sessionScope];

  // Workspace-scoped like every sibling read. Without workspace_id in the
  // predicate, two workspaces sharing a site_id + session_id pair would pool
  // their events into one session's evidence.
  const accepted = await db.query(
    `SELECT COUNT(*)::int AS source_event_count,
            MIN(event_id) AS first_event_id,
            MAX(event_id) AS last_event_id,
            MIN(received_at) AS first_received_at,
            MAX(received_at) AS last_received_at
       FROM accepted_events
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
        AND received_at >= $4::timestamptz AND received_at <= $5::timestamptz`,
    workspaceScope,
  );

  const features = await db.query(
    `SELECT session_features_id, extraction_version, extracted_at, first_seen_at, last_seen_at,
            session_duration_ms, source_event_count, page_view_count, cta_click_count,
            form_start_count, form_submit_count, unique_path_count
       FROM session_features
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
        AND first_seen_at >= $4::timestamptz AND first_seen_at <= $5::timestamptz
      ORDER BY extracted_at DESC, session_features_id DESC
      LIMIT 1`,
    workspaceScope,
  );

  const behavioural = await db.query(
    `SELECT behavioural_features_id, feature_version, extracted_at, first_seen_at, last_seen_at,
            source_event_count, valid_feature_count, missing_feature_count
       FROM session_behavioural_features_v0_2
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
      ORDER BY extracted_at DESC, behavioural_features_id DESC
      LIMIT 1`,
    [identity.workspace_id, identity.site_id, identity.session_id],
  );

  const stage0 = await db.query(
    `SELECT stage0_decision_id, scoring_version, excluded, rule_id, created_at, source_event_count
       FROM stage0_decisions
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
      ORDER BY created_at ASC, stage0_decision_id ASC`,
    [identity.workspace_id, identity.site_id, identity.session_id],
  );

  const risk = await db.query(
    `SELECT risk_observation_id, observation_version, scoring_version, created_at, source_event_count
       FROM risk_observations_v0_1
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
      ORDER BY created_at ASC, risk_observation_id ASC`,
    [identity.workspace_id, identity.site_id, identity.session_id],
  );

  const poi = await db.query(
    `SELECT poi_observation_id, poi_type, poi_key, poi_observation_version, poi_eligible,
            derived_at, first_seen_at, last_seen_at, source_event_count
       FROM poi_observations_v0_1
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
      ORDER BY poi_observation_id ASC`,
    [identity.workspace_id, identity.site_id, identity.session_id],
  );

  const poiSequence = await db.query(
    `SELECT poi_sequence_observation_id, poi_sequence_version, poi_count, unique_poi_count,
            poi_sequence_pattern_class, has_repetition, has_progression,
            derived_at, first_seen_at, last_seen_at
       FROM poi_sequence_observations_v0_1
      WHERE workspace_id = $1 AND site_id = $2 AND session_id = $3
      ORDER BY poi_sequence_observation_id ASC`,
    [identity.workspace_id, identity.site_id, identity.session_id],
  );

  const acceptedRow = accepted.rows[0];
  const aggregate: AcceptedEventAggregate | null =
    acceptedRow !== undefined && asInt(acceptedRow.source_event_count) > 0
      ? {
          source_event_count: asInt(acceptedRow.source_event_count),
          first_event_id: asIntOrNull(acceptedRow.first_event_id),
          last_event_id: asIntOrNull(acceptedRow.last_event_id),
          first_received_at: toIsoString(acceptedRow.first_received_at),
          last_received_at: toIsoString(acceptedRow.last_received_at),
        }
      : null;

  return {
    accepted_events_aggregate: aggregate,
    session_features: features.rows[0] === undefined ? null : normalizeSessionFeatures(features.rows[0]),
    behavioural_features: behavioural.rows[0] === undefined ? null : normalizeBehavioural(behavioural.rows[0]),
    stage0_decisions: stage0.rows.map(normalizeStage0),
    risk_observations: risk.rows.map(normalizeRisk),
    poi_observations: poi.rows.map(normalizePoi),
    poi_sequence_observations: poiSequence.rows.map(normalizePoiSequence),
  };
}

function normalizeSessionFeatures(row: Record<string, unknown>): SessionFeaturesRow {
  return {
    session_features_id: asInt(row.session_features_id),
    extraction_version: asText(row.extraction_version),
    extracted_at: toIsoString(row.extracted_at) ?? '',
    first_seen_at: toIsoString(row.first_seen_at) ?? '',
    last_seen_at: toIsoString(row.last_seen_at) ?? '',
    session_duration_ms: asInt(row.session_duration_ms),
    source_event_count: asInt(row.source_event_count),
    page_view_count: asInt(row.page_view_count),
    cta_click_count: asInt(row.cta_click_count),
    form_start_count: asInt(row.form_start_count),
    form_submit_count: asInt(row.form_submit_count),
    unique_path_count: asInt(row.unique_path_count),
  };
}

function normalizeBehavioural(row: Record<string, unknown>): BehaviouralFeaturesRow {
  return {
    behavioural_features_id: asInt(row.behavioural_features_id),
    feature_version: asText(row.feature_version),
    extracted_at: toIsoString(row.extracted_at) ?? '',
    first_seen_at: toIsoString(row.first_seen_at),
    last_seen_at: toIsoString(row.last_seen_at),
    source_event_count: asInt(row.source_event_count),
    valid_feature_count: asInt(row.valid_feature_count),
    missing_feature_count: asInt(row.missing_feature_count),
  };
}

function normalizeStage0(row: Record<string, unknown>): Stage0DecisionRow {
  return {
    stage0_decision_id: asText(row.stage0_decision_id),
    scoring_version: asText(row.scoring_version),
    excluded: asBool(row.excluded),
    rule_id: asText(row.rule_id),
    created_at: toIsoString(row.created_at) ?? '',
    source_event_count: asInt(row.source_event_count),
  };
}

function normalizeRisk(row: Record<string, unknown>): RiskObservationRow {
  return {
    risk_observation_id: asText(row.risk_observation_id),
    observation_version: asText(row.observation_version),
    scoring_version: asText(row.scoring_version),
    created_at: toIsoString(row.created_at) ?? '',
    source_event_count: asInt(row.source_event_count),
  };
}

function normalizePoi(row: Record<string, unknown>): PoiObservationRow {
  return {
    poi_observation_id: asInt(row.poi_observation_id),
    poi_type: asText(row.poi_type),
    poi_key: asText(row.poi_key),
    poi_observation_version: asText(row.poi_observation_version),
    poi_eligible: asBool(row.poi_eligible),
    derived_at: toIsoString(row.derived_at) ?? '',
    first_seen_at: toIsoString(row.first_seen_at),
    last_seen_at: toIsoString(row.last_seen_at),
    source_event_count: asInt(row.source_event_count),
  };
}

function normalizePoiSequence(row: Record<string, unknown>): PoiSequenceObservationRow {
  return {
    poi_sequence_observation_id: asInt(row.poi_sequence_observation_id),
    poi_sequence_version: asText(row.poi_sequence_version),
    poi_count: asInt(row.poi_count),
    unique_poi_count: asInt(row.unique_poi_count),
    poi_sequence_pattern_class: asText(row.poi_sequence_pattern_class),
    has_repetition: asBool(row.has_repetition),
    has_progression: asBool(row.has_progression),
    derived_at: toIsoString(row.derived_at) ?? '',
    first_seen_at: toIsoString(row.first_seen_at),
    last_seen_at: toIsoString(row.last_seen_at),
  };
}

/** Per-stage presence with the exact safe missing labels; order is fixed. */
export function summarizeStagePresence(rows: SessionPersistedRows): StagePresenceEntry[] {
  const presence: Array<[GoldenSessionStageName, boolean]> = [
    ['accepted_events', rows.accepted_events_aggregate !== null],
    ['session_features', rows.session_features !== null],
    ['behavioural_features', rows.behavioural_features !== null],
    ['stage0_decisions', rows.stage0_decisions.length > 0],
    ['risk_observations', rows.risk_observations.length > 0],
    ['poi_observations', rows.poi_observations.length > 0],
    ['poi_sequence_observations', rows.poi_sequence_observations.length > 0],
  ];
  return presence.map(([stage, present]) => ({
    stage,
    present,
    missing_label: present ? null : GOLDEN_SESSION_STAGE_MISSING_LABELS[stage],
  }));
}

/**
 * Map the persisted rows for one session to ordered EvidenceAtom[].
 *
 * Deterministic: atom_id derives from the originating persisted row identity;
 * observed_at/recorded_at are persisted values; ordering is chronological with
 * a total (observed_at, atom_id) tie-break. Absence of evidence maps to
 * absence of atoms — never to positive buyer intent.
 */
export function mapSessionRowsToEvidenceAtoms(
  identity: BackendSessionIdentity,
  rows: SessionPersistedRows,
): EvidenceAtom[] {
  const atoms: EvidenceAtom[] = [];

  const agg = rows.accepted_events_aggregate;
  if (agg !== null) {
    atoms.push(atom(identity, {
      atom_id: `atom_accepted_events_${agg.first_event_id ?? 0}_${agg.last_event_id ?? 0}`,
      source_type: 'thinlayer_event',
      source_ref: `accepted_events:event_id:${agg.first_event_id ?? 0}-${agg.last_event_id ?? 0}`,
      observed_at: agg.first_received_at ?? identity.window_start,
      recorded_at: agg.last_received_at ?? identity.window_start,
      category: 'accepted_event_aggregate',
      facet: 'session_event_window',
      numeric_value: agg.source_event_count,
      null_fields: agg.first_event_id === null ? ['first_event_id'] : [],
    }));
  }

  const sf = rows.session_features;
  if (sf !== null) {
    atoms.push(atom(identity, {
      atom_id: `atom_session_features_${sf.session_features_id}`,
      source_type: 'scoring_worker_output',
      source_ref: `session_features:session_features_id:${sf.session_features_id}`,
      observed_at: sf.first_seen_at,
      recorded_at: sf.extracted_at,
      category: 'session_features',
      facet: sf.extraction_version,
      numeric_value: sf.source_event_count,
      null_fields: [],
    }));
  }

  const bf = rows.behavioural_features;
  if (bf !== null) {
    atoms.push(atom(identity, {
      atom_id: `atom_behavioural_features_${bf.behavioural_features_id}`,
      source_type: 'scoring_worker_output',
      source_ref: `session_behavioural_features_v0_2:behavioural_features_id:${bf.behavioural_features_id}`,
      observed_at: bf.first_seen_at ?? bf.extracted_at,
      recorded_at: bf.extracted_at,
      category: 'behavioural_features',
      facet: bf.feature_version,
      numeric_value: bf.valid_feature_count,
      null_fields: bf.first_seen_at === null ? ['first_seen_at'] : [],
    }));
  }

  for (const row of rows.stage0_decisions) {
    atoms.push(atom(identity, {
      atom_id: `atom_stage0_${row.stage0_decision_id}`,
      source_type: 'collector_decision',
      source_ref: `stage0_decisions:stage0_decision_id:${row.stage0_decision_id}`,
      observed_at: row.created_at,
      recorded_at: row.created_at,
      category: 'stage0_decision',
      facet: `${row.rule_id}:${row.excluded ? 'excluded' : 'included'}`,
      numeric_value: row.source_event_count,
      null_fields: [],
    }));
  }

  for (const row of rows.risk_observations) {
    atoms.push(atom(identity, {
      atom_id: `atom_risk_observation_${row.risk_observation_id}`,
      source_type: 'scoring_worker_output',
      source_ref: `risk_observations_v0_1:risk_observation_id:${row.risk_observation_id}`,
      observed_at: row.created_at,
      recorded_at: row.created_at,
      category: 'risk_observation',
      facet: row.observation_version,
      numeric_value: row.source_event_count,
      null_fields: [],
    }));
  }

  for (const row of rows.poi_observations) {
    atoms.push(atom(identity, {
      atom_id: `atom_poi_observation_${row.poi_observation_id}`,
      source_type: 'scoring_worker_output',
      source_ref: `poi_observations_v0_1:poi_observation_id:${row.poi_observation_id}`,
      observed_at: row.first_seen_at ?? row.derived_at,
      recorded_at: row.derived_at,
      category: 'poi_observation',
      facet: `${row.poi_type}:${row.poi_key}`,
      numeric_value: row.source_event_count,
      null_fields: row.first_seen_at === null ? ['first_seen_at'] : [],
    }));
  }

  for (const row of rows.poi_sequence_observations) {
    atoms.push(atom(identity, {
      atom_id: `atom_poi_sequence_${row.poi_sequence_observation_id}`,
      source_type: 'scoring_worker_output',
      source_ref: `poi_sequence_observations_v0_1:poi_sequence_observation_id:${row.poi_sequence_observation_id}`,
      observed_at: row.first_seen_at ?? row.derived_at,
      recorded_at: row.derived_at,
      category: 'poi_sequence_observation',
      facet: row.poi_sequence_pattern_class,
      numeric_value: row.poi_count,
      null_fields: row.first_seen_at === null ? ['first_seen_at'] : [],
    }));
  }

  return atoms.sort((a, b) =>
    a.observed_at.localeCompare(b.observed_at) || a.atom_id.localeCompare(b.atom_id));
}

interface AtomFields {
  atom_id: string;
  source_type: EvidenceAtom['source_type'];
  source_ref: string;
  observed_at: string;
  recorded_at: string;
  category: string;
  facet: string;
  numeric_value: number | null;
  null_fields: string[];
}

function atom(identity: BackendSessionIdentity, fields: AtomFields): EvidenceAtom {
  return {
    atom_id: fields.atom_id,
    workspace_id: identity.workspace_id,
    project_id: identity.project_id,
    site_id: identity.site_id,
    schema_version: EXTERNAL_REPORT_SCHEMA_VERSION,
    source_type: fields.source_type,
    source_ref: fields.source_ref,
    observed_at: fields.observed_at,
    recorded_at: fields.recorded_at,
    category: fields.category,
    facet: fields.facet,
    numeric_value: fields.numeric_value,
    evidence_grade: 'E1',
    is_complete: fields.null_fields.length === 0,
    null_fields: fields.null_fields,
    ingest_reason_codes: [],
  };
}
