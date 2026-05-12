/**
 * Sprint 2 PR#6 — opt-in DB tests for the behavioural-pattern evidence
 * worker and the `risk_observations_v0_1` schema.
 *
 * Runs only under `npm run test:db:v1` with TEST_DATABASE_URL set.
 *
 * Test boundary: `__test_ws_pr6__`. Disjoint from prior PR boundaries.
 *
 * PR#6 ships RECORD_ONLY. No Lane A / Lane B writes. No reason-code
 * emission. No risk_index / verification_score / evidence_band columns.
 * behavioural_risk_01 is a normalised input feature in [0, 1], not a
 * score.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import {
  applyMigration013,
  bootstrapTestDb,
  endTestPool,
  getTestPool,
} from './_setup.js';
import {
  CURRENT_BEHAVIOURAL_FEATURE_VERSION,
  OBSERVATION_VERSION_DEFAULT,
  runRiskEvidenceWorker,
} from '../../../src/scoring/risk-evidence/index.js';

const TEST_WORKSPACE = '__test_ws_pr6__';
const TEST_SITE      = '__test_site_pr6__';
const TEST_OBS_V1    = 'risk-obs-test-v0.1';
const TEST_OBS_V2    = 'risk-obs-test-v0.2';

let pool: Pool;

beforeAll(async () => {
  pool = getTestPool();
  await bootstrapTestDb(pool);
}, 30_000);

afterAll(async () => {
  await endTestPool(pool);
});

beforeEach(async () => {
  await pool.query('DELETE FROM risk_observations_v0_1 WHERE workspace_id = $1', [TEST_WORKSPACE]);
  await pool.query('DELETE FROM stage0_decisions WHERE workspace_id = $1', [TEST_WORKSPACE]);
  await pool.query('DELETE FROM session_behavioural_features_v0_2 WHERE workspace_id = $1', [TEST_WORKSPACE]);
});

/* --------------------------------------------------------------------------
 * Compact seed helpers
 * ------------------------------------------------------------------------ */

interface SeedOpts {
  sessionId:                          string;
  /** Default false (eligible). */
  stage0Excluded?:                    boolean;
  stage0RuleId?:                      string;
  stage0RuleInputs?:                  Record<string, unknown>;
  /**
   * SBF `feature_version` to stamp on the seeded row. Defaults to
   * `CURRENT_BEHAVIOURAL_FEATURE_VERSION` ('behavioural-features-v0.3')
   * — the version the PR#6 worker reads by default. Tests that
   * exercise the multi-version-coexistence Hetzner finding override
   * this to seed obsolete v0.2 rows alongside.
   */
  featureVersion?:                    string;
  /** SBF field overrides. */
  maxEventsPerSecond?:                number;
  pageviewBurstCount10s?:             number;
  sub200msTransitionCount?:           number;
  refreshLoopCandidate?:              boolean | null;
  refreshLoopCount?:                  number;
  samePathRepeatCount?:               number;
  samePathRepeatMinDeltaMs?:          number | null;
  formStartCountBeforeFirstCta?:      number;
  formSubmitCountBeforeFirstFormStart?: number;
  msFromConsentToFirstCta?:           number | null;
  dwellMsBeforeFirstAction?:          number | null;
  validFeatureCount?:                 number;
  missingFeatureCount?:               number;
  sourceEventCount?:                  number;
  baseTimeMs?:                        number;
}

async function seedSbfRow(opts: SeedOpts & { featureVersion: string }): Promise<number> {
  const base = opts.baseTimeMs ?? Date.now() - 60_000;
  const sbfRes = await pool.query<{ behavioural_features_id: string }>(
    `INSERT INTO session_behavioural_features_v0_2 (
       workspace_id, site_id, session_id,
       feature_version, extracted_at,
       first_seen_at, last_seen_at, source_event_count,
       ms_from_consent_to_first_cta, dwell_ms_before_first_action,
       first_form_start_precedes_first_cta,
       form_start_count_before_first_cta,
       has_form_submit_without_prior_form_start,
       form_submit_count_before_first_form_start,
       ms_between_pageviews_p50, pageview_burst_count_10s,
       max_events_per_second, sub_200ms_transition_count,
       interaction_density_bucket, scroll_depth_bucket_before_first_cta,
       valid_feature_count, missing_feature_count,
       feature_presence_map, feature_source_map,
       refresh_loop_candidate, refresh_loop_count,
       same_path_repeat_count, same_path_repeat_max_span_ms,
       same_path_repeat_min_delta_ms, same_path_repeat_median_delta_ms,
       repeat_pageview_candidate_count, refresh_loop_source
     ) VALUES (
       $1, $2, $3,
       $19, $4,
       $4, $4, $5,
       $6, $7,
       NULL,
       $8,
       FALSE,
       $9,
       NULL, $10,
       $11, $12,
       NULL, NULL,
       $13, $14,
       '{}'::jsonb, '{}'::jsonb,
       $15, $16,
       $17, NULL,
       $18, NULL,
       0, NULL
     )
     RETURNING behavioural_features_id`,
    [
      TEST_WORKSPACE, TEST_SITE, opts.sessionId,
      new Date(base),
      opts.sourceEventCount ?? 3,
      opts.msFromConsentToFirstCta ?? 12000,
      opts.dwellMsBeforeFirstAction ?? 4000,
      opts.formStartCountBeforeFirstCta ?? 0,
      opts.formSubmitCountBeforeFirstFormStart ?? 0,
      opts.pageviewBurstCount10s ?? 0,
      opts.maxEventsPerSecond ?? 1,
      opts.sub200msTransitionCount ?? 0,
      opts.validFeatureCount ?? 9,
      opts.missingFeatureCount ?? 0,
      opts.refreshLoopCandidate ?? false,
      opts.refreshLoopCount ?? 0,
      opts.samePathRepeatCount ?? 0,
      opts.samePathRepeatMinDeltaMs,
      opts.featureVersion,
    ],
  );
  return Number(sbfRes.rows[0]!.behavioural_features_id);
}

async function seedStage0AndSbf(opts: SeedOpts): Promise<{
  stage0_decision_id:       string;
  behavioural_features_id:  number;
}> {
  const base = opts.baseTimeMs ?? Date.now() - 60_000;
  const stage0Id = randomUUID();
  const excluded = opts.stage0Excluded === true;
  const ruleId   = opts.stage0RuleId ?? (excluded ? 'known_bot_ua_family' : 'no_stage0_exclusion');
  const ruleInputs = opts.stage0RuleInputs ?? {
    matched_rule_id:    ruleId,
    user_agent_family:  'browser',
    ua_source:          'ingest_requests',
    events_per_second:  opts.maxEventsPerSecond ?? 1,
    path_loop_count:    1,
  };

  await pool.query(
    `INSERT INTO stage0_decisions (
       stage0_decision_id, workspace_id, site_id, session_id,
       stage0_version, scoring_version,
       excluded, rule_id, rule_inputs, evidence_refs,
       record_only, source_event_count, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,'stage0-test-v0.1','s2.v1.0',$5,$6,$7::jsonb,'[]'::jsonb, TRUE, $8, $9, $9)`,
    [
      stage0Id, TEST_WORKSPACE, TEST_SITE, opts.sessionId,
      excluded, ruleId, JSON.stringify(ruleInputs),
      opts.sourceEventCount ?? 3,
      new Date(base),
    ],
  );

  const sbfId = await seedSbfRow({
    ...opts,
    featureVersion: opts.featureVersion ?? CURRENT_BEHAVIOURAL_FEATURE_VERSION,
  });

  return {
    stage0_decision_id:      stage0Id,
    behavioural_features_id: sbfId,
  };
}

async function runWorker(observationVersion = TEST_OBS_V1): Promise<number> {
  const result = await runRiskEvidenceWorker(pool, {
    workspace_id:        TEST_WORKSPACE,
    site_id:             TEST_SITE,
    window_start:        new Date(Date.now() - 24 * 3600 * 1000),
    window_end:          new Date(Date.now() + 3600 * 1000),
    observation_version: observationVersion,
  });
  return result.upserted_rows;
}

async function countRows(table: string, ws: string = TEST_WORKSPACE): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table} WHERE workspace_id = $1`, [ws]);
  return Number(r.rows[0]!.n);
}

async function countGlobal(table: string): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table}`);
  return Number(r.rows[0]!.n);
}

/* --------------------------------------------------------------------------
 * 1. Migration applies idempotently
 * ------------------------------------------------------------------------ */

describe('PR#6 — migration 013', () => {
  it('applies idempotently (CREATE TABLE IF NOT EXISTS is safe to re-run)', async () => {
    await applyMigration013(pool);
    await applyMigration013(pool);
    const present = await pool.query<{ regclass: string | null }>(
      "SELECT to_regclass('public.risk_observations_v0_1') AS regclass",
    );
    expect(present.rows[0]!.regclass).toBe('risk_observations_v0_1');
  });

  it('column set matches the planned shape', async () => {
    const cols = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'risk_observations_v0_1'
        ORDER BY ordinal_position`,
    );
    const names = cols.rows.map((r) => r.column_name);
    for (const expected of [
      'risk_observation_id', 'workspace_id', 'site_id', 'session_id',
      'observation_version', 'scoring_version',
      'velocity', 'device_risk_01', 'network_risk_01', 'identity_risk_01',
      'behavioural_risk_01', 'tags',
      'record_only', 'source_event_count', 'evidence_refs',
      'created_at', 'updated_at',
    ]) {
      expect(names).toContain(expected);
    }
    for (const forbidden of [
      'risk_index', 'verification_score', 'evidence_band',
      'action_recommendation', 'reason_codes', 'reason_impacts',
      'triggered_tags', 'penalty_total',
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });
});

/* --------------------------------------------------------------------------
 * 2. Natural-key upsert idempotency + version-bump separation
 * ------------------------------------------------------------------------ */

describe('PR#6 — natural-key upsert', () => {
  it('re-running the worker over the same seed upserts the same row (idempotent)', async () => {
    await seedStage0AndSbf({ sessionId: 'sess-1', maxEventsPerSecond: 10 });
    const n1 = await runWorker();
    const c1 = await countRows('risk_observations_v0_1');
    const n2 = await runWorker();
    const c2 = await countRows('risk_observations_v0_1');
    expect(n1).toBe(1);
    expect(n2).toBe(1);
    expect(c1).toBe(1);
    expect(c2).toBe(1);
  });

  it('different observation_version creates a separate row', async () => {
    await seedStage0AndSbf({ sessionId: 'sess-2' });
    await runWorker(TEST_OBS_V1);
    await runWorker(TEST_OBS_V2);
    const c = await countRows('risk_observations_v0_1');
    expect(c).toBe(2);
  });

  it('different scoring_version creates a separate row', async () => {
    await seedStage0AndSbf({ sessionId: 'sess-3' });
    // Run once with the default scoring_version
    await runWorker(TEST_OBS_V1);
    // Manually upsert a synthetic row at a different scoring_version
    // to mimic a scoring_version bump (full worker invocation against a
    // synthetic version is exercised in PR#4 tests).
    await pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id,
         observation_version, scoring_version,
         velocity, behavioural_risk_01, tags, record_only,
         source_event_count, evidence_refs
       ) VALUES ($1,$2,$3,$4,'s2.v1.1','{}'::jsonb,0,'[]'::jsonb,TRUE,0,'[]'::jsonb)`,
      [TEST_WORKSPACE, TEST_SITE, 'sess-3', TEST_OBS_V1],
    );
    const c = await countRows('risk_observations_v0_1');
    expect(c).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * 3. DB CHECK rejections
 * ------------------------------------------------------------------------ */

describe('PR#6 — DB CHECK rejections', () => {
  it('record_only = FALSE is rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id,
         observation_version, scoring_version, record_only
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', FALSE)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/record_only/i);
  });

  it('behavioural_risk_01 > 1 is rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id, observation_version,
         scoring_version, behavioural_risk_01
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', 1.5)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/behavioural_risk_01/i);
  });

  it('device_risk_01 < 0 is rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id, observation_version,
         scoring_version, device_risk_01
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', -0.1)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/device_risk_01/i);
  });

  it('network_risk_01 > 1 is rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id, observation_version,
         scoring_version, network_risk_01
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', 2)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/network_risk_01/i);
  });

  it('identity_risk_01 < 0 is rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id, observation_version,
         scoring_version, identity_risk_01
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', -0.5)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/identity_risk_01/i);
  });

  it('source_event_count < 0 is rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id, observation_version,
         scoring_version, source_event_count
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', -1)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/source_event_count/i);
  });

  it('velocity that is not a JSONB object is rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id, observation_version,
         scoring_version, velocity
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', '[1,2,3]'::jsonb)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/velocity/i);
  });

  it('tags that are not a JSONB array are rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id, observation_version,
         scoring_version, tags
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', '{"k":"v"}'::jsonb)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/tags/i);
  });

  it('evidence_refs that is not a JSONB array is rejected', async () => {
    await expect(pool.query(
      `INSERT INTO risk_observations_v0_1 (
         workspace_id, site_id, session_id, observation_version,
         scoring_version, evidence_refs
       ) VALUES ($1,$2,'s',$3,'s2.v1.0', '{"k":"v"}'::jsonb)`,
      [TEST_WORKSPACE, TEST_SITE, TEST_OBS_V1],
    )).rejects.toThrow(/evidence_refs/i);
  });
});

/* --------------------------------------------------------------------------
 * 4. Stage 0 eligibility — worker writes only excluded=FALSE sessions
 * ------------------------------------------------------------------------ */

describe('PR#6 — Stage 0 eligibility', () => {
  it('worker writes only Stage-0-non-excluded sessions', async () => {
    await seedStage0AndSbf({ sessionId: 'eligible-1', maxEventsPerSecond: 3 });
    await seedStage0AndSbf({ sessionId: 'excluded-1', stage0Excluded: true, stage0RuleId: 'known_bot_ua_family' });
    const upserted = await runWorker();
    expect(upserted).toBe(1);
    const rows = await pool.query<{ session_id: string }>(
      `SELECT session_id FROM risk_observations_v0_1 WHERE workspace_id = $1 ORDER BY session_id`,
      [TEST_WORKSPACE],
    );
    expect(rows.rows.map((r) => r.session_id)).toEqual(['eligible-1']);
  });

  it('a fully-excluded seed produces zero PR#6 rows', async () => {
    await seedStage0AndSbf({ sessionId: 'excluded-only', stage0Excluded: true, stage0RuleId: 'webdriver_global_present' });
    const upserted = await runWorker();
    expect(upserted).toBe(0);
    expect(await countRows('risk_observations_v0_1')).toBe(0);
  });
});

/* --------------------------------------------------------------------------
 * 5. BYTESPIDER_PASSTHROUGH — row written, but no Lane B row
 * ------------------------------------------------------------------------ */

describe('PR#6 — BYTESPIDER_PASSTHROUGH discipline', () => {
  it('a Bytespider Stage 0 row produces a risk_observations_v0_1 row but no Lane B row', async () => {
    await seedStage0AndSbf({
      sessionId: 'sess-bytespider',
      stage0Excluded: false,
      stage0RuleId: 'no_stage0_exclusion',
      stage0RuleInputs: {
        matched_rule_id:    'no_stage0_exclusion',
        user_agent_family:  'bytespider',
        ua_source:          'ingest_requests',
        events_per_second:  1,
        path_loop_count:    1,
      },
    });
    const laneBBefore = await countGlobal('scoring_output_lane_b');
    const upserted = await runWorker();
    expect(upserted).toBe(1);

    const row = await pool.query<{ tags: unknown }>(
      `SELECT tags FROM risk_observations_v0_1 WHERE workspace_id = $1`,
      [TEST_WORKSPACE],
    );
    const tagArr = row.rows[0]!.tags as string[];
    expect(tagArr).toContain('BYTESPIDER_PASSTHROUGH');

    const laneBAfter = await countGlobal('scoring_output_lane_b');
    expect(laneBAfter).toBe(laneBBefore);
  });
});

/* --------------------------------------------------------------------------
 * 6. Source-tables-unchanged invariant
 * ------------------------------------------------------------------------ */

describe('PR#6 — source-tables-unchanged invariant', () => {
  it('PR#6 worker run never touches accepted_events / ingest_requests / session_features / SBF / stage0 / Lane A / Lane B counts', async () => {
    await seedStage0AndSbf({ sessionId: 'src-1', maxEventsPerSecond: 7 });
    await seedStage0AndSbf({ sessionId: 'src-2', refreshLoopCandidate: true, refreshLoopCount: 4 });
    const before = {
      accepted_events:                  await countGlobal('accepted_events'),
      rejected_events:                  await countGlobal('rejected_events'),
      ingest_requests:                  await countGlobal('ingest_requests'),
      session_features:                 await countGlobal('session_features'),
      session_behavioural_features_v0_2: await countGlobal('session_behavioural_features_v0_2'),
      stage0_decisions:                 await countGlobal('stage0_decisions'),
      scoring_output_lane_a:            await countGlobal('scoring_output_lane_a'),
      scoring_output_lane_b:            await countGlobal('scoring_output_lane_b'),
    };
    await runWorker();
    const after = {
      accepted_events:                  await countGlobal('accepted_events'),
      rejected_events:                  await countGlobal('rejected_events'),
      ingest_requests:                  await countGlobal('ingest_requests'),
      session_features:                 await countGlobal('session_features'),
      session_behavioural_features_v0_2: await countGlobal('session_behavioural_features_v0_2'),
      stage0_decisions:                 await countGlobal('stage0_decisions'),
      scoring_output_lane_a:            await countGlobal('scoring_output_lane_a'),
      scoring_output_lane_b:            await countGlobal('scoring_output_lane_b'),
    };
    expect(after).toEqual(before);
  });
});

/* --------------------------------------------------------------------------
 * 7. Customer-API role zero SELECT (Hard Rule I parity)
 * ------------------------------------------------------------------------ */

describe('PR#6 — customer-API SELECT discipline', () => {
  it('buyerrecon_customer_api has zero SELECT / INSERT / UPDATE / DELETE on risk_observations_v0_1', async () => {
    const r = await pool.query<{ s: boolean; i: boolean; u: boolean; d: boolean }>(
      `SELECT
         has_table_privilege('buyerrecon_customer_api'::name, 'risk_observations_v0_1'::regclass, 'SELECT'::text) AS s,
         has_table_privilege('buyerrecon_customer_api'::name, 'risk_observations_v0_1'::regclass, 'INSERT'::text) AS i,
         has_table_privilege('buyerrecon_customer_api'::name, 'risk_observations_v0_1'::regclass, 'UPDATE'::text) AS u,
         has_table_privilege('buyerrecon_customer_api'::name, 'risk_observations_v0_1'::regclass, 'DELETE'::text) AS d`,
    );
    expect(r.rows[0]).toEqual({ s: false, i: false, u: false, d: false });
  });

  it('buyerrecon_scoring_worker has SELECT + INSERT + UPDATE', async () => {
    const r = await pool.query<{ s: boolean; i: boolean; u: boolean }>(
      `SELECT
         has_table_privilege('buyerrecon_scoring_worker'::name, 'risk_observations_v0_1'::regclass, 'SELECT'::text) AS s,
         has_table_privilege('buyerrecon_scoring_worker'::name, 'risk_observations_v0_1'::regclass, 'INSERT'::text) AS i,
         has_table_privilege('buyerrecon_scoring_worker'::name, 'risk_observations_v0_1'::regclass, 'UPDATE'::text) AS u`,
    );
    expect(r.rows[0]).toEqual({ s: true, i: true, u: true });
  });

  it('buyerrecon_internal_readonly has SELECT', async () => {
    const r = await pool.query<{ s: boolean }>(
      `SELECT has_table_privilege('buyerrecon_internal_readonly'::name, 'risk_observations_v0_1'::regclass, 'SELECT'::text) AS s`,
    );
    expect(r.rows[0]!.s).toBe(true);
  });
});

/* --------------------------------------------------------------------------
 * 8. Forbidden JSON keys absent + replay determinism
 * ------------------------------------------------------------------------ */

describe('PR#6 — forbidden JSON keys + replay determinism', () => {
  it('no forbidden keys appear in persisted velocity or evidence_refs', async () => {
    await seedStage0AndSbf({ sessionId: 'sess-keys', maxEventsPerSecond: 4 });
    await runWorker();
    const r = await pool.query<{ velocity: Record<string, unknown>; evidence_refs: unknown[] }>(
      `SELECT velocity, evidence_refs FROM risk_observations_v0_1 WHERE workspace_id = $1`,
      [TEST_WORKSPACE],
    );
    const velocityKeys = Object.keys(r.rows[0]!.velocity);
    for (const forbidden of [
      'raw_user_agent', 'user_agent', 'token_hash', 'ip_hash', 'pepper',
      'bearer_token', 'bearer', 'authorization', 'Authorization',
      'raw_payload', 'raw_request_body', 'request_body',
      'canonical_jsonb', 'raw_page_url', 'page_url',
    ]) {
      expect(velocityKeys).not.toContain(forbidden);
    }
    for (const ev of r.rows[0]!.evidence_refs as Array<Record<string, unknown>>) {
      for (const forbidden of [
        'raw_user_agent', 'user_agent', 'token_hash', 'ip_hash', 'pepper',
        'bearer_token', 'bearer', 'authorization', 'Authorization',
        'raw_payload', 'raw_request_body', 'request_body',
        'canonical_jsonb', 'raw_page_url', 'page_url',
      ]) {
        expect(Object.keys(ev)).not.toContain(forbidden);
      }
    }
  });

  it('replay determinism — same seed + rerun gives identical velocity / behavioural_risk_01 / tags', async () => {
    await seedStage0AndSbf({
      sessionId: 'sess-replay',
      maxEventsPerSecond: 12,
      pageviewBurstCount10s: 5,
      sub200msTransitionCount: 4,
      refreshLoopCandidate: true,
      refreshLoopCount: 3,
      samePathRepeatCount: 4,
      samePathRepeatMinDeltaMs: 100,
    });
    await runWorker();
    const a = await pool.query<{ velocity: Record<string, unknown>; behavioural_risk_01: string; tags: string[] }>(
      `SELECT velocity, behavioural_risk_01::text, tags FROM risk_observations_v0_1 WHERE workspace_id = $1`,
      [TEST_WORKSPACE],
    );
    await runWorker();
    const b = await pool.query<{ velocity: Record<string, unknown>; behavioural_risk_01: string; tags: string[] }>(
      `SELECT velocity, behavioural_risk_01::text, tags FROM risk_observations_v0_1 WHERE workspace_id = $1`,
      [TEST_WORKSPACE],
    );
    expect(b.rows[0]!.velocity).toEqual(a.rows[0]!.velocity);
    expect(b.rows[0]!.behavioural_risk_01).toBe(a.rows[0]!.behavioural_risk_01);
    expect(b.rows[0]!.tags).toEqual(a.rows[0]!.tags);
  });
});

/* --------------------------------------------------------------------------
 * 8b. Hetzner finding — multi-feature-version coexistence
 *
 * Under PR#6 commit de76950 the Hetzner staging proof showed two SBF
 * versions ('behavioural-features-v0.2' + 'behavioural-features-v0.3')
 * coexisting for the same sessions. The unfiltered worker JOIN
 * matched every session twice (once per SBF version) and reported
 * `upserted_rows: 4` while only 2 rows landed under the natural key
 * (the second UPSERT overwrote the first via ON CONFLICT DO UPDATE).
 *
 * The fix: filter SBF reads to CURRENT_BEHAVIOURAL_FEATURE_VERSION
 * ('behavioural-features-v0.3').
 * ------------------------------------------------------------------------ */

describe('PR#6 — feature_version filter (Hetzner finding under de76950)', () => {
  it('worker ignores obsolete behavioural-features-v0.2 SBF rows', async () => {
    // Seed one Stage 0 row + a v0.2 SBF row ONLY.
    await pool.query(
      `INSERT INTO stage0_decisions (
         stage0_decision_id, workspace_id, site_id, session_id,
         stage0_version, scoring_version,
         excluded, rule_id, rule_inputs, evidence_refs,
         record_only, source_event_count, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,'stage0-test-v0.1','s2.v1.0',FALSE,'no_stage0_exclusion','{"user_agent_family":"browser"}'::jsonb,'[]'::jsonb,TRUE,3,$5,$5)`,
      [randomUUID(), TEST_WORKSPACE, TEST_SITE, 'sess-v02-only', new Date(Date.now() - 60_000)],
    );
    await seedSbfRow({
      sessionId:      'sess-v02-only',
      featureVersion: 'behavioural-features-v0.2',
    });
    const result = await runRiskEvidenceWorker(pool, {
      workspace_id:        TEST_WORKSPACE,
      site_id:             TEST_SITE,
      window_start:        new Date(Date.now() - 24 * 3600 * 1000),
      window_end:          new Date(Date.now() + 3600 * 1000),
      observation_version: TEST_OBS_V1,
    });
    expect(result.upserted_rows).toBe(0);
    expect(result.behavioural_feature_version).toBe(CURRENT_BEHAVIOURAL_FEATURE_VERSION);
    expect(await countRows('risk_observations_v0_1')).toBe(0);
  });

  it('worker processes the v0.3 SBF row when both v0.2 and v0.3 coexist for the same session', async () => {
    // Seed one Stage 0 row.
    await pool.query(
      `INSERT INTO stage0_decisions (
         stage0_decision_id, workspace_id, site_id, session_id,
         stage0_version, scoring_version,
         excluded, rule_id, rule_inputs, evidence_refs,
         record_only, source_event_count, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,'stage0-test-v0.1','s2.v1.0',FALSE,'no_stage0_exclusion','{"user_agent_family":"browser"}'::jsonb,'[]'::jsonb,TRUE,3,$5,$5)`,
      [randomUUID(), TEST_WORKSPACE, TEST_SITE, 'sess-multi', new Date(Date.now() - 60_000)],
    );
    // Seed BOTH SBF versions for the same session — the SBF natural key
    // (workspace, site, session, feature_version) permits this.
    const v02Id = await seedSbfRow({
      sessionId:           'sess-multi',
      featureVersion:      'behavioural-features-v0.2',
      maxEventsPerSecond:  99,        // distinct values so the wrong row would be visible
      pageviewBurstCount10s: 99,
    });
    const v03Id = await seedSbfRow({
      sessionId:           'sess-multi',
      featureVersion:      'behavioural-features-v0.3',
      maxEventsPerSecond:  4,
      pageviewBurstCount10s: 2,
    });
    expect(v02Id).not.toBe(v03Id);

    const result = await runRiskEvidenceWorker(pool, {
      workspace_id:        TEST_WORKSPACE,
      site_id:             TEST_SITE,
      window_start:        new Date(Date.now() - 24 * 3600 * 1000),
      window_end:          new Date(Date.now() + 3600 * 1000),
      observation_version: TEST_OBS_V1,
    });

    // Exactly one upsert (NOT two), exactly one persisted row.
    expect(result.upserted_rows).toBe(1);
    expect(await countRows('risk_observations_v0_1')).toBe(1);

    // The persisted row's evidence_refs must point at the v0.3 SBF, not the v0.2 one.
    const r = await pool.query<{
      velocity:       { events_per_second: number; pageview_burst_count_10s: number };
      evidence_refs:  Array<{ table: string; behavioural_features_id?: number; feature_version?: string }>;
    }>(
      `SELECT velocity, evidence_refs FROM risk_observations_v0_1 WHERE workspace_id = $1 AND session_id = 'sess-multi'`,
      [TEST_WORKSPACE],
    );
    const row = r.rows[0]!;
    expect(row.velocity.events_per_second).toBe(4);
    expect(row.velocity.pageview_burst_count_10s).toBe(2);

    const sbfRef = row.evidence_refs.find((ref) => ref.table === 'session_behavioural_features_v0_2');
    expect(sbfRef).toBeDefined();
    expect(sbfRef!.feature_version).toBe(CURRENT_BEHAVIOURAL_FEATURE_VERSION);
    expect(sbfRef!.behavioural_features_id).toBe(v03Id);
  });

  it('worker upserted_rows count equals the v0.3 eligible session count (not multi-version JOIN cardinality)', async () => {
    // Two eligible sessions, each with both SBF versions present.
    // Without the feature_version filter, JOIN cardinality = 4. With
    // the filter, JOIN cardinality = 2 → upserted_rows = 2.
    for (const session of ['sess-cnt-1', 'sess-cnt-2']) {
      await pool.query(
        `INSERT INTO stage0_decisions (
           stage0_decision_id, workspace_id, site_id, session_id,
           stage0_version, scoring_version,
           excluded, rule_id, rule_inputs, evidence_refs,
           record_only, source_event_count, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,'stage0-test-v0.1','s2.v1.0',FALSE,'no_stage0_exclusion','{"user_agent_family":"browser"}'::jsonb,'[]'::jsonb,TRUE,3,$5,$5)`,
        [randomUUID(), TEST_WORKSPACE, TEST_SITE, session, new Date(Date.now() - 60_000)],
      );
      await seedSbfRow({ sessionId: session, featureVersion: 'behavioural-features-v0.2' });
      await seedSbfRow({ sessionId: session, featureVersion: 'behavioural-features-v0.3' });
    }
    const result = await runRiskEvidenceWorker(pool, {
      workspace_id:        TEST_WORKSPACE,
      site_id:             TEST_SITE,
      window_start:        new Date(Date.now() - 24 * 3600 * 1000),
      window_end:          new Date(Date.now() + 3600 * 1000),
      observation_version: TEST_OBS_V1,
    });
    expect(result.upserted_rows).toBe(2);  // not 4
    expect(await countRows('risk_observations_v0_1')).toBe(2);
  });
});

/* --------------------------------------------------------------------------
 * 9. OBSERVATION_VERSION_DEFAULT round-trip
 * ------------------------------------------------------------------------ */

describe('PR#6 — version stamp', () => {
  it('worker stamps observation_version on every row', async () => {
    await seedStage0AndSbf({ sessionId: 'sess-version' });
    await runWorker(OBSERVATION_VERSION_DEFAULT);
    const r = await pool.query<{ observation_version: string; scoring_version: string }>(
      `SELECT observation_version, scoring_version FROM risk_observations_v0_1 WHERE workspace_id = $1`,
      [TEST_WORKSPACE],
    );
    expect(r.rows[0]!.observation_version).toBe(OBSERVATION_VERSION_DEFAULT);
    expect(r.rows[0]!.scoring_version).toBe('s2.v1.0');
  });
});
