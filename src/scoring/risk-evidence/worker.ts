/**
 * Sprint 2 PR#6 — behavioural-pattern evidence DB worker.
 *
 * Pipeline:
 *   1. Call PR#4 `assertScoringContractsOrThrow()` — refuses to start
 *      if scoring/version.yml / dictionary / forbidden_codes.yml are
 *      malformed or if `status !== 'record_only'` /
 *      `automated_action_enabled !== false`.
 *   2. Call PR#4 `assertActiveScoringSourceCleanOrThrow()` —
 *      defence-in-depth source-code grep on `src/scoring/**`.
 *   3. SELECT eligible sessions from `stage0_decisions`
 *      (excluded = FALSE) JOIN `session_behavioural_features_v0_2`
 *      (PR#1 + PR#2 v0.3) — these are the ONLY two read sources.
 *   4. For each row, call the pure adapter
 *      `buyerreconBehaviouralToRiskInputs(sbf, stage0)`.
 *   5. UPSERT `risk_observations_v0_1` under the 5-column natural key
 *      `(workspace_id, site_id, session_id, observation_version,
 *      scoring_version)` — `ON CONFLICT DO UPDATE`.
 *
 * Forbidden reads: `accepted_events`, `ingest_requests`,
 * `session_features`, `scoring_output_lane_a`, `scoring_output_lane_b`.
 * Forbidden writes: any table other than `risk_observations_v0_1`.
 *
 * No `INSERT INTO scoring_output_lane_a` / `_b`. No reason_code
 * emission. No customer-facing output. No automated action. No
 * `risk_index` / `verification_score` / `evidence_band` / etc.
 */

import pg from 'pg';
import {
  assertActiveScoringSourceCleanOrThrow,
  assertScoringContractsOrThrow,
} from '../contracts.js';
import { buyerreconBehaviouralToRiskInputs } from './adapter.js';
import {
  CURRENT_BEHAVIOURAL_FEATURE_VERSION,
  OBSERVATION_VERSION_DEFAULT,
  type RiskObservationRow,
  type SessionBehaviouralFeaturesV0_3Row,
  type Stage0DecisionRowReadView,
} from './types.js';

export interface RiskEvidenceWorkerOptions {
  workspace_id:           string | null;
  site_id:                string | null;
  window_start:           Date;
  window_end:             Date;
  observation_version:    string;
  /**
   * Optional override (defaults to the loaded scoring contracts'
   * `scoring_version`). Useful for tests that want a synthetic value.
   */
  scoring_version_override?: string;
  /**
   * Optional override for the stage0_decisions filter. PR#6 reads
   * only Stage-0-eligible rows at this stage0_version pairing; if
   * omitted, the worker matches the same scoring_version against
   * stage0_decisions (i.e. only stage0 rows produced under the same
   * scoring contract version are considered).
   */
  stage0_version_filter?:   string;
  /**
   * Optional override for the
   * `session_behavioural_features_v0_2.feature_version` filter.
   * Defaults to `CURRENT_BEHAVIOURAL_FEATURE_VERSION`
   * ('behavioural-features-v0.3'). The Hetzner-staging finding under
   * commit `de76950` is the reason this filter exists at all — without
   * it the worker double-processed v0.2 + v0.3 SBF rows for the same
   * session. Tests that need to exercise a synthetic version override
   * the value here.
   */
  behavioural_feature_version?: string;
  /** Repo root for the PR#4 contract loader (defaults to auto-detect). */
  rootDir?:                 string;
}

export interface RiskEvidenceWorkerResult {
  upserted_rows:               number;
  bytespider_tagged:           number;
  observation_version:         string;
  scoring_version:             string;
  behavioural_feature_version: string;
  window_start:                Date;
  window_end:                  Date;
}

/* --------------------------------------------------------------------------
 * SELECT — join PR#5 stage0_decisions with PR#1+PR#2 SBF.
 *
 * The JOIN keys are (workspace_id, site_id, session_id). The Stage 0
 * row is the eligibility filter (excluded = FALSE); the SBF row
 * carries the behavioural evidence the adapter normalises.
 *
 * IMPORTANT (Hetzner staging finding under commit de76950):
 *   SBF rows under multiple `feature_version` values may coexist for
 *   the same (workspace, site, session) — the SBF natural key permits
 *   one row per (ws, site, session, feature_version). Without an
 *   explicit feature_version filter the JOIN matches each session
 *   ONCE PER SBF VERSION, causing the worker to UPSERT the same
 *   risk_observations_v0_1 natural key twice (the second UPSERT
 *   overwrites the first via ON CONFLICT DO UPDATE — final rows are
 *   clean, but `upserted_rows` is wrong and obsolete versions are
 *   wastefully reprocessed). The filter below is the fix: PR#6 reads
 *   only the current behavioural feature version (default
 *   `behavioural-features-v0.3`; override via
 *   `behavioural_feature_version` opt).
 *
 * No raw UA. No raw page_url. No payload bytes. The Stage 0
 * `rule_inputs` JSONB is read for the `user_agent_family` provenance
 * label only (PR#5 OD-11 allowlist).
 * ------------------------------------------------------------------------ */

const SELECT_SQL = `
SELECT
  s.stage0_decision_id,
  s.workspace_id,
  s.site_id,
  s.session_id,
  s.excluded,
  s.rule_id,
  s.rule_inputs,

  b.behavioural_features_id,
  b.feature_version,
  b.source_event_count,
  b.ms_from_consent_to_first_cta,
  b.dwell_ms_before_first_action,
  b.first_form_start_precedes_first_cta,
  b.form_start_count_before_first_cta,
  b.has_form_submit_without_prior_form_start,
  b.form_submit_count_before_first_form_start,
  b.ms_between_pageviews_p50,
  b.pageview_burst_count_10s,
  b.max_events_per_second,
  b.sub_200ms_transition_count,
  b.refresh_loop_candidate,
  b.refresh_loop_count,
  b.same_path_repeat_count,
  b.same_path_repeat_min_delta_ms,
  b.valid_feature_count,
  b.missing_feature_count
FROM stage0_decisions s
JOIN session_behavioural_features_v0_2 b
  ON  b.workspace_id = s.workspace_id
  AND b.site_id      = s.site_id
  AND b.session_id   = s.session_id
WHERE s.excluded        = FALSE
  AND s.scoring_version = $1
  AND b.feature_version = $2
  AND ($3::text IS NULL OR s.stage0_version = $3)
  AND ($4::text IS NULL OR s.workspace_id   = $4)
  AND ($5::text IS NULL OR s.site_id        = $5)
  AND s.created_at >= $6
  AND s.created_at <  $7
ORDER BY s.created_at ASC, s.stage0_decision_id ASC
`;

/* --------------------------------------------------------------------------
 * UPSERT — idempotent under the 5-column natural key (D-14).
 *
 * Re-running under the same
 *   (workspace_id, site_id, session_id, observation_version, scoring_version)
 * refreshes the same row; any version change produces a NEW row
 * (replay / provenance preserved).
 * ------------------------------------------------------------------------ */

const UPSERT_SQL = `
INSERT INTO risk_observations_v0_1 (
  workspace_id,
  site_id,
  session_id,
  observation_version,
  scoring_version,
  velocity,
  device_risk_01,
  network_risk_01,
  identity_risk_01,
  behavioural_risk_01,
  tags,
  record_only,
  source_event_count,
  evidence_refs
) VALUES (
  $1, $2, $3, $4, $5,
  $6::jsonb, $7, $8, $9, $10,
  $11::jsonb, TRUE, $12, $13::jsonb
)
ON CONFLICT (workspace_id, site_id, session_id, observation_version, scoring_version)
DO UPDATE SET
  velocity            = EXCLUDED.velocity,
  device_risk_01      = EXCLUDED.device_risk_01,
  network_risk_01     = EXCLUDED.network_risk_01,
  identity_risk_01    = EXCLUDED.identity_risk_01,
  behavioural_risk_01 = EXCLUDED.behavioural_risk_01,
  tags                = EXCLUDED.tags,
  source_event_count  = EXCLUDED.source_event_count,
  evidence_refs       = EXCLUDED.evidence_refs,
  updated_at          = now()
RETURNING risk_observation_id, behavioural_risk_01
`;

interface JoinedRow {
  stage0_decision_id:                          string;
  workspace_id:                                string;
  site_id:                                     string;
  session_id:                                  string;
  excluded:                                    boolean;
  rule_id:                                     string;
  rule_inputs:                                 Record<string, unknown>;
  behavioural_features_id:                     number;
  feature_version:                             string;
  source_event_count:                          number;
  ms_from_consent_to_first_cta:                number | null;
  dwell_ms_before_first_action:                number | null;
  first_form_start_precedes_first_cta:         boolean | null;
  form_start_count_before_first_cta:           number;
  has_form_submit_without_prior_form_start:    boolean;
  form_submit_count_before_first_form_start:   number;
  ms_between_pageviews_p50:                    number | null;
  pageview_burst_count_10s:                    number;
  max_events_per_second:                       number;
  sub_200ms_transition_count:                  number;
  refresh_loop_candidate:                      boolean | null;
  refresh_loop_count:                          number;
  same_path_repeat_count:                      number;
  same_path_repeat_min_delta_ms:               number | null;
  valid_feature_count:                         number;
  missing_feature_count:                       number;
}

function numberOrZero(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function booleanOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  return v === true;
}

function toSbfRow(j: JoinedRow): SessionBehaviouralFeaturesV0_3Row {
  return {
    behavioural_features_id:                     numberOrZero(j.behavioural_features_id),
    workspace_id:                                j.workspace_id,
    site_id:                                     j.site_id,
    session_id:                                  j.session_id,
    feature_version:                             j.feature_version,
    source_event_count:                          numberOrZero(j.source_event_count),
    ms_from_consent_to_first_cta:                numberOrNull(j.ms_from_consent_to_first_cta),
    dwell_ms_before_first_action:                numberOrNull(j.dwell_ms_before_first_action),
    first_form_start_precedes_first_cta:         booleanOrNull(j.first_form_start_precedes_first_cta),
    form_start_count_before_first_cta:           numberOrZero(j.form_start_count_before_first_cta),
    has_form_submit_without_prior_form_start:    j.has_form_submit_without_prior_form_start === true,
    form_submit_count_before_first_form_start:   numberOrZero(j.form_submit_count_before_first_form_start),
    ms_between_pageviews_p50:                    numberOrNull(j.ms_between_pageviews_p50),
    pageview_burst_count_10s:                    numberOrZero(j.pageview_burst_count_10s),
    max_events_per_second:                       numberOrZero(j.max_events_per_second),
    sub_200ms_transition_count:                  numberOrZero(j.sub_200ms_transition_count),
    refresh_loop_candidate:                      booleanOrNull(j.refresh_loop_candidate),
    refresh_loop_count:                          numberOrZero(j.refresh_loop_count),
    same_path_repeat_count:                      numberOrZero(j.same_path_repeat_count),
    same_path_repeat_min_delta_ms:               numberOrNull(j.same_path_repeat_min_delta_ms),
    valid_feature_count:                         numberOrZero(j.valid_feature_count),
    missing_feature_count:                       numberOrZero(j.missing_feature_count),
  };
}

function toStage0ReadView(j: JoinedRow): Stage0DecisionRowReadView {
  return {
    stage0_decision_id:  j.stage0_decision_id,
    workspace_id:        j.workspace_id,
    site_id:             j.site_id,
    session_id:          j.session_id,
    excluded:            j.excluded === true,
    rule_id:             j.rule_id,
    rule_inputs:         j.rule_inputs ?? {},
  };
}

export async function runRiskEvidenceWorker(
  pool: pg.Pool | pg.PoolClient | pg.Client,
  opts: RiskEvidenceWorkerOptions,
): Promise<RiskEvidenceWorkerResult> {
  // §1–§2 — PR#4 startup guards.
  const contracts = assertScoringContractsOrThrow({ rootDir: opts.rootDir });
  assertActiveScoringSourceCleanOrThrow({ rootDir: opts.rootDir });

  const scoring_version     = opts.scoring_version_override ?? contracts.version.scoring_version;
  const observation_version = opts.observation_version;
  const stage0_version_filter = opts.stage0_version_filter ?? null;
  const behavioural_feature_version =
    opts.behavioural_feature_version ?? CURRENT_BEHAVIOURAL_FEATURE_VERSION;

  // §3 — SELECT eligible joined rows. The behavioural_feature_version
  // filter is REQUIRED (not nullable) — see SELECT_SQL doc comment for
  // the Hetzner-staging double-process bug under commit de76950.
  const select = await pool.query<JoinedRow>(SELECT_SQL, [
    scoring_version,
    behavioural_feature_version,
    stage0_version_filter,
    opts.workspace_id,
    opts.site_id,
    opts.window_start,
    opts.window_end,
  ]);

  let upserted = 0;
  let bytespider_tagged = 0;

  for (const j of select.rows) {
    const sbf    = toSbfRow(j);
    const stage0 = toStage0ReadView(j);

    // §4 — pure adapter call.
    const inputs = buyerreconBehaviouralToRiskInputs(sbf, stage0);

    const row: RiskObservationRow = {
      workspace_id:         sbf.workspace_id,
      site_id:              sbf.site_id,
      session_id:           sbf.session_id,
      observation_version,
      scoring_version,
      velocity:             inputs.velocity,
      device_risk_01:       inputs.device_risk_01,
      network_risk_01:      inputs.network_risk_01,
      identity_risk_01:     inputs.identity_risk_01,
      behavioural_risk_01:  inputs.behavioural_risk_01,
      tags:                 [...inputs.tags],
      record_only:          true,
      source_event_count:   sbf.source_event_count,
      evidence_refs:        [
        {
          table: 'session_behavioural_features_v0_2',
          behavioural_features_id: sbf.behavioural_features_id,
          feature_version:         sbf.feature_version,
        },
        {
          table: 'stage0_decisions',
          stage0_decision_id: stage0.stage0_decision_id,
          rule_id:            stage0.rule_id,
        },
      ],
    };

    // §5 — UPSERT.
    await pool.query<{ risk_observation_id: string; behavioural_risk_01: number }>(
      UPSERT_SQL,
      [
        row.workspace_id,
        row.site_id,
        row.session_id,
        row.observation_version,
        row.scoring_version,
        JSON.stringify(row.velocity),
        row.device_risk_01,
        row.network_risk_01,
        row.identity_risk_01,
        row.behavioural_risk_01,
        JSON.stringify(row.tags),
        row.source_event_count,
        JSON.stringify(row.evidence_refs),
      ],
    );
    upserted++;
    if (row.tags.includes('BYTESPIDER_PASSTHROUGH')) bytespider_tagged++;
  }

  return {
    upserted_rows:               upserted,
    bytespider_tagged,
    observation_version,
    scoring_version,
    behavioural_feature_version,
    window_start:                opts.window_start,
    window_end:                  opts.window_end,
  };
}

/* --------------------------------------------------------------------------
 * CLI env-var parsing helper
 * ------------------------------------------------------------------------ */

export interface RiskEvidenceEnvOpts {
  databaseUrl:  string;
  options:      RiskEvidenceWorkerOptions;
}

const DEFAULT_SINCE_HOURS = 168;

export function parseRiskEvidenceEnvOptions(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): RiskEvidenceEnvOpts {
  const databaseUrl = env.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    // Bare validation message — the CLI runner prepends the
    // 'Sprint 2 PR#6 risk-evidence worker — ' prefix once. Embedding
    // the prefix here would double it on the CLI side.
    throw new Error('DATABASE_URL is required');
  }

  const workspace_id = typeof env.WORKSPACE_ID === 'string' && env.WORKSPACE_ID.length > 0
    ? env.WORKSPACE_ID : null;
  const site_id = typeof env.SITE_ID === 'string' && env.SITE_ID.length > 0
    ? env.SITE_ID : null;

  let window_end: Date;
  if (typeof env.UNTIL === 'string' && env.UNTIL.length > 0) {
    const u = Date.parse(env.UNTIL);
    if (!Number.isFinite(u)) {
      throw new Error(`UNTIL is not a parseable timestamp: ${JSON.stringify(env.UNTIL)}`);
    }
    window_end = new Date(u);
  } else {
    window_end = now;
  }

  let window_start: Date;
  if (typeof env.SINCE === 'string' && env.SINCE.length > 0) {
    const s = Date.parse(env.SINCE);
    if (!Number.isFinite(s)) {
      throw new Error(`SINCE is not a parseable timestamp: ${JSON.stringify(env.SINCE)}`);
    }
    window_start = new Date(s);
  } else {
    const rawHours = env.SINCE_HOURS ?? String(DEFAULT_SINCE_HOURS);
    const hours = Number.parseInt(rawHours, 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error(`SINCE_HOURS must be a positive integer (got ${JSON.stringify(rawHours)})`);
    }
    window_start = new Date(window_end.getTime() - hours * 3600 * 1000);
  }
  if (window_start.getTime() >= window_end.getTime()) {
    throw new Error('window_start must be strictly before window_end');
  }

  const observation_version = typeof env.OBSERVATION_VERSION === 'string'
    && env.OBSERVATION_VERSION.length > 0
    ? env.OBSERVATION_VERSION
    : OBSERVATION_VERSION_DEFAULT;

  const stage0_version_filter =
    typeof env.STAGE0_VERSION_FILTER === 'string' && env.STAGE0_VERSION_FILTER.length > 0
      ? env.STAGE0_VERSION_FILTER
      : undefined;

  const behavioural_feature_version =
    typeof env.BEHAVIOURAL_FEATURE_VERSION === 'string'
      && env.BEHAVIOURAL_FEATURE_VERSION.length > 0
      ? env.BEHAVIOURAL_FEATURE_VERSION
      : undefined;  // worker defaults to CURRENT_BEHAVIOURAL_FEATURE_VERSION

  return {
    databaseUrl,
    options: {
      workspace_id,
      site_id,
      window_start,
      window_end,
      observation_version,
      stage0_version_filter,
      behavioural_feature_version,
    },
  };
}
