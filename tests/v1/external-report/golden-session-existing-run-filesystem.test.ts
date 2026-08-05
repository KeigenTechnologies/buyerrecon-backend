import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  runGoldenSessionCli,
  type GoldenSessionRunDependencies,
} from '../../../scripts/run-golden-session.js';

const RUN_ID = '9005b50c-e37e-4e78-81c0-a3ec94f4f9f9';
const WORKSPACE = 'ws_golden';
const SITE = 'site_golden';
const SESSION = 'session_golden';
const SUBJECT = 'browser_subject_abc';
const START = '2026-07-24';
const END = '2026-07-24';
const IDS = [51, 52, 53, 54, 55, 56, 57, 58, 59];

const RAW_EVENTS = [
  { event_id: 51, received_at: '2026-07-24T19:40:00.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'session_start', path: '/en', page_path: null },
  { event_id: 52, received_at: '2026-07-24T19:40:01.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_view', path: '/en', page_path: null },
  { event_id: 53, received_at: '2026-07-24T19:40:12.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_view', path: '/en/product', page_path: null },
  { event_id: 54, received_at: '2026-07-24T19:40:20.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'cta_click', path: '/en/product', page_path: null },
  { event_id: 55, received_at: '2026-07-24T19:40:31.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_view', path: '/en/buyer-motion-evidence-report', page_path: null },
  { event_id: 56, received_at: '2026-07-24T19:40:44.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_state', path: '/en/buyer-motion-evidence-report', page_path: null },
  { event_id: 57, received_at: '2026-07-24T19:40:52.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'form_start', path: '/en/buyer-motion-evidence-report', page_path: null },
  { event_id: 58, received_at: '2026-07-24T19:41:03.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_state', path: '/en/buyer-motion-evidence-report', page_path: null },
  { event_id: 59, received_at: '2026-07-24T19:41:15.000Z', event_type: 'track', event_name: 'unknown', legacy_event_type: 'page_view', path: '/en', page_path: null },
];

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function goldenJson(): string {
  return JSON.stringify({
    schema_version: 'golden-session-ams-v0.1',
    status: 'SCORED',
    limitations: [],
    scope: {
      site_id: SITE,
      subject_id: SUBJECT,
      subject_identity_model: 'browser_subject',
      session_level_isolation: false,
      session_id: SESSION,
      workspace_id: WORKSPACE,
      window_start: `${START}T00:00:00Z`,
      window_end: `${END}T23:59:59Z`,
    },
    authoritative_final_decision: 'HOLD',
    risk: { RiskIndex: 12, ReasonCodes: ['RISK.TEST'] },
    series: {},
    poi: { PoiScore: 61, IntentClass: 'evaluation', ReasonCodes: ['POI.TEST'] },
    product_decision: {
      ProductScore: 55,
      RequestedAction: 'suppress',
      ReasonCodes: ['PRODUCT.TEST'],
    },
    policy_pass_1: {
      TrustInvocationMode: 'CONTINUE',
      ActionTier: 'tier_2',
      GatingReasonCodes: ['P1.TEST'],
    },
    trust: {
      TrustBand: 'building',
      Decision: 'HOLD',
      ConfidenceScore01: 0.5,
      ReasonCodes: ['TRUST.TEST'],
    },
    runtime_decision: { FinalDecision: 'HOLD', GatingReasonCodes: ['FINAL.TEST'] },
    evidence_card: {
      FitScore: 70,
      IntentScore: 55,
      WindowScore: 45,
      RequestedAction: 'suppress',
    },
    adapter_quality: {},
    source_event_ids: IDS,
  });
}

function makeRoot(): { root: string; goldenPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'buyerrecon-existing-run-'));
  roots.push(root);
  const goldenPath = join(root, 'golden.json');
  writeFileSync(goldenPath, goldenJson(), 'utf8');
  return { root, goldenPath };
}

function makeFakePool() {
  const queries: string[] = [];
  let ended = false;
  return {
    queries,
    get ended() {
      return ended;
    },
    pool: {
      async query(text: string, _values: ReadonlyArray<string>) {
        queries.push(text);
        if (text.includes('FROM replay_evidence_cards c')) {
          return { rows: [{ run_id: RUN_ID, subject_id: SUBJECT, source_event_ids: IDS, site_id: SITE }] };
        }
        if (text.includes('FROM replay_runs')) {
          return {
            rows: [{
              run_id: RUN_ID,
              site_id: SITE,
              window_start: `${START}T00:00:00Z`,
              window_end: `${END}T23:59:59Z`,
              subjects_total: 1,
              subjects_scoreable: 1,
            }],
          };
        }
        if (text.includes('FROM replay_evidence_cards')) {
          return {
            rows: [{
              run_id: RUN_ID,
              subject_id: SUBJECT,
              status: 'SCORED',
              source_event_ids: IDS,
              evidence_card: { RequestedAction: 'suppress' },
            }],
          };
        }
        if (text.includes('SELECT event_id,') && text.includes('FROM accepted_events')) {
          return { rows: RAW_EVENTS };
        }
        if (text.includes('SELECT event_id') && text.includes('FROM accepted_events')) {
          return { rows: IDS.map((event_id) => ({ event_id })) };
        }
        if (text.includes('SELECT COUNT(*)') && text.includes('FROM accepted_events')) {
          return {
            rows: [{
              source_event_count: 9,
              first_event_id: 51,
              last_event_id: 59,
              first_received_at: RAW_EVENTS[0].received_at,
              last_received_at: RAW_EVENTS[8].received_at,
            }],
          };
        }
        return { rows: [] };
      },
      async end() {
        ended = true;
      },
    },
  };
}

function args(goldenPath: string, output: string): string[] {
  return [
    '--workspace', WORKSPACE,
    '--site', SITE,
    '--session', SESSION,
    '--subject', SUBJECT,
    '--start', START,
    '--end', END,
    '--ams-golden-json', goldenPath,
    '--ams-run-id', RUN_ID,
    '--output', output,
  ];
}

function dependencies(
  fake: ReturnType<typeof makeFakePool>,
  overrides: Partial<GoldenSessionRunDependencies['fileSystem']> = {},
) {
  let amsInvocations = 0;
  const stdout: string[] = [];
  const deps: GoldenSessionRunDependencies = {
    pool: fake.pool,
    fileSystem: {
      existsSync,
      mkdirSync,
      readFileSync,
      writeFileSync,
      ...overrides,
    },
    runAmsOnce: async () => {
      amsInvocations += 1;
    },
    stdout: {
      write(value: string) {
        stdout.push(value);
      },
    },
  };
  return { deps, stdout, get amsInvocations() { return amsInvocations; } };
}

function artifactPaths(output: string) {
  const base = `golden-session_${SITE}_${SESSION}_${START}_${END}`;
  return {
    json: join(output, `${base}.json`),
    markdown: join(output, `${base}.md`),
  };
}

describe('existing-run CLI output-directory contract', () => {
  it('creates an absent output directory and writes both internal artifacts', async () => {
    const { root, goldenPath } = makeRoot();
    const output = join(root, 'output');
    const fake = makeFakePool();
    const harness = dependencies(fake);
    const stderr: string[] = [];

    expect(existsSync(output)).toBe(false);
    const exitCode = await runGoldenSessionCli(args(goldenPath, output), harness.deps, {
      write: (value) => stderr.push(value),
    });

    const paths = artifactPaths(output);
    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(harness.amsInvocations).toBe(0);
    expect(fake.queries.length).toBeGreaterThan(0);
    expect(fake.ended).toBe(true);
    expect(existsSync(output)).toBe(true);
    expect(existsSync(join(output, 'ams'))).toBe(false);
    expect(existsSync(paths.json)).toBe(true);
    expect(existsSync(paths.markdown)).toBe(true);

    const json = JSON.parse(readFileSync(paths.json, 'utf8'));
    expect(json.backend_session_identity).toMatchObject({
      workspace_id: WORKSPACE,
      site_id: SITE,
      session_id: SESSION,
    });
    expect(json.ams_authoritative.authoritative_final_decision).toBe('HOLD');
    expect(json.existing_run_verification).toMatchObject({
      cryptographic_linkage: false,
      embedded_run_linkage: false,
      cross_source_linkage: 'consistency_linkage',
    });

    const markdown = readFileSync(paths.markdown, 'utf8');
    expect(markdown).toContain(`workspace ${WORKSPACE}, site ${SITE}`);
    expect(markdown).toContain('Authoritative AMS final decision: HOLD');
    expect(markdown).toContain('Cryptographic linkage: false');
  });

  it('accepts an already-existing output directory', async () => {
    const { root, goldenPath } = makeRoot();
    const output = join(root, 'existing-output');
    mkdirSync(output, { recursive: true });
    const fake = makeFakePool();
    const harness = dependencies(fake);

    expect(await runGoldenSessionCli(args(goldenPath, output), harness.deps)).toBe(0);
    expect(harness.amsInvocations).toBe(0);
    expect(existsSync(artifactPaths(output).json)).toBe(true);
    expect(existsSync(artifactPaths(output).markdown)).toBe(true);
  });

  it('recursively creates a missing nested output directory', async () => {
    const { root, goldenPath } = makeRoot();
    const output = join(root, 'one', 'two', 'three');
    const fake = makeFakePool();
    const harness = dependencies(fake);

    expect(existsSync(output)).toBe(false);
    expect(await runGoldenSessionCli(args(goldenPath, output), harness.deps)).toBe(0);
    expect(harness.amsInvocations).toBe(0);
    expect(existsSync(artifactPaths(output).json)).toBe(true);
    expect(existsSync(join(output, 'ams'))).toBe(false);
  });

  it('fails closed with a non-zero result when output-directory creation fails', async () => {
    const { root, goldenPath } = makeRoot();
    const output = join(root, 'cannot-create');
    const fake = makeFakePool();
    const harness = dependencies(fake, {
      mkdirSync: () => {
        throw new Error('simulated mkdir failure');
      },
    });
    const stderr: string[] = [];

    const exitCode = await runGoldenSessionCli(args(goldenPath, output), harness.deps, {
      write: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([
      'run-golden-session FAILED stage=artifact_write_failed (output_directory)\n',
    ]);
    expect(harness.amsInvocations).toBe(0);
    expect(existsSync(artifactPaths(output).json)).toBe(false);
  });

  it('fails closed with a non-zero result when an artifact write fails', async () => {
    const { root, goldenPath } = makeRoot();
    const output = join(root, 'write-failure');
    const fake = makeFakePool();
    const harness = dependencies(fake, {
      writeFileSync: () => {
        throw new Error('simulated write failure');
      },
    });
    const stderr: string[] = [];

    const exitCode = await runGoldenSessionCli(args(goldenPath, output), harness.deps, {
      write: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual(['run-golden-session FAILED stage=artifact_write_failed\n']);
    expect(harness.amsInvocations).toBe(0);
    expect(existsSync(output)).toBe(true);
    expect(existsSync(artifactPaths(output).json)).toBe(false);
    expect(existsSync(artifactPaths(output).markdown)).toBe(false);
  });
});
