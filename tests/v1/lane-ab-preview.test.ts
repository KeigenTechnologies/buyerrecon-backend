/**
 * Sprint 2 PR#16b — Lane A / Lane B Evidence Review preview — tests.
 *
 * Pure tests. The preview is a pure projection over the PR#15a
 * `EvidenceReviewSnapshotReport`, so the tests construct synthetic
 * snapshot literals and assert against the rendered markdown +
 * structured report.
 *
 * Groups (A..K) cover the 10 spec requirements plus a small
 * exports sanity group.
 */

import { describe, expect, it } from 'vitest';

import {
  SNAPSHOT_OBSERVER_VERSION,
  type EvidenceReviewSnapshotReport,
} from '../../src/evidence-review-snapshot/index.js';
import {
  buildLaneABPreview,
  LANE_AB_PREVIEW_VERSION,
  renderLaneABPreviewMarkdown,
  type LaneABPreviewReport,
} from '../../src/lane-ab-preview/index.js';

/* --------------------------------------------------------------------------
 * Snapshot literal builder
 *
 * Default counts are non-zero so the default Lane-A / Lane-B
 * observations are well-formed; individual tests override fields
 * to exercise missing-source / tainted-input behaviour.
 * ------------------------------------------------------------------------ */

interface SnapshotOverrides {
  boundary?: Partial<EvidenceReviewSnapshotReport['boundary']>;
  evidence_chain?: Partial<EvidenceReviewSnapshotReport['evidence_chain']>;
  lane_a_candidates?: Partial<EvidenceReviewSnapshotReport['lane_a_candidates']>;
  lane_b_internal?: Partial<EvidenceReviewSnapshotReport['lane_b_internal']>;
  evidence_gaps?: Partial<EvidenceReviewSnapshotReport['evidence_gaps']>;
  readiness?: Partial<EvidenceReviewSnapshotReport['readiness']>;
  founder_notes_prompt?: Partial<EvidenceReviewSnapshotReport['founder_notes_prompt']>;
  source_availability?: EvidenceReviewSnapshotReport['source_availability'];
}

function makeSnapshot(overrides: SnapshotOverrides = {}): EvidenceReviewSnapshotReport {
  const defaultTables = [
    { table_name: 'accepted_events',                   exists: true,  row_count: 100, note: null },
    { table_name: 'rejected_events',                   exists: true,  row_count:  10, note: null },
    { table_name: 'ingest_requests',                   exists: true,  row_count: 105, note: null },
    { table_name: 'session_features',                  exists: true,  row_count:  80, note: null },
    { table_name: 'session_behavioural_features_v0_2', exists: true,  row_count:  70, note: null },
    { table_name: 'stage0_decisions',                  exists: true,  row_count:  80, note: null },
    { table_name: 'risk_observations_v0_1',            exists: true,  row_count:  50, note: null },
    { table_name: 'poi_observations_v0_1',             exists: true,  row_count:  40, note: null },
    { table_name: 'poi_sequence_observations_v0_1',    exists: true,  row_count:  20, note: null },
  ] as const;

  return {
    boundary: {
      observer_version:     SNAPSHOT_OBSERVER_VERSION,
      workspace_id:         'workspace_test_a',
      site_id:              'site.example.test',
      window_start_iso:     '2026-05-01T00:00:00.000Z',
      window_end_iso:       '2026-05-15T00:00:00.000Z',
      checked_at_iso:       '2026-05-15T12:00:00.000Z',
      database_host_masked: 'db.host.example.test:5432',
      database_name_masked: 'buyerrecon_test',
      ...overrides.boundary,
    },
    source_availability: overrides.source_availability ?? {
      tables: defaultTables,
    },
    evidence_chain: {
      accepted_events_rows:              100,
      rejected_events_rows:               10,
      ingest_requests_rows:              105,
      session_features_rows:              80,
      session_behavioural_features_rows:  70,
      stage0_decisions_rows:              80,
      risk_observations_rows:             50,
      poi_observations_rows:              40,
      poi_sequence_observations_rows:     20,
      ...overrides.evidence_chain,
    },
    lane_a_candidates: {
      rejected_event_count:                      10,
      stage0_excluded_count:                      6,
      risk_observation_rows_with_evidence:        2,
      bot_like_or_ambiguous_evidence_count_note:
        'Lane A candidate observations are evidence-review inputs, not automated customer-facing scores.',
      evidence_gaps_affecting_traffic_quality:   [],
      ...overrides.lane_a_candidates,
    },
    lane_b_internal: {
      poi_observation_rows:                       40,
      poi_sequence_observation_rows:              20,
      session_features_coverage_rows:             80,
      session_behavioural_features_coverage_rows: 70,
      stage0_eligible_count:                      74,
      ambiguous_or_insufficient_buckets_note:
        'Lane B observations are internal learning inputs only and must not be exposed as customer-facing claims.',
      ...overrides.lane_b_internal,
    },
    evidence_gaps: {
      missing_accepted_events_coverage:     false,
      missing_session_features:             false,
      missing_behavioural_features:         false,
      missing_poi_observations:             false,
      missing_risk_observations:            false,
      missing_productfeatures_observations: true,
      insufficient_window:                  false,
      no_conversion_evidence:               false,
      insufficient_utm_source_context:      false,
      gaps_summary:                         [],
      ...overrides.evidence_gaps,
    },
    readiness: {
      bucket:  'READY_FOR_MANUAL_REVIEW',
      reasons: ['default fixture'],
      ...overrides.readiness,
    },
    founder_notes_prompt: {
      what_looks_verifiable:             [],
      what_remains_unknown:              [],
      what_should_not_be_claimed:        [],
      what_needs_customer_confirmation:  [],
      what_to_check_in_ga4_or_crm:       [],
      ...overrides.founder_notes_prompt,
    },
  };
}

/* --------------------------------------------------------------------------
 * Section-slicing helper.
 *
 * Splits the rendered markdown into a map keyed by section heading
 * (`§1`..`§10`). Used so the strict-scope assertions in Groups E
 * and F can verify a phrase appears ONLY in the intended section.
 * ------------------------------------------------------------------------ */

function sliceSections(md: string): Map<string, string> {
  const sections = new Map<string, string>();
  const headingRe = /^## (§\d+)\b.*$/gm;
  const headings: { tag: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(md)) !== null) {
    headings.push({ tag: match[1] ?? '', index: match.index });
  }
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i]!.index;
    const end   = i + 1 < headings.length ? headings[i + 1]!.index : md.length;
    sections.set(headings[i]!.tag, md.slice(start, end));
  }
  return sections;
}

/* --------------------------------------------------------------------------
 * A. Report renders all required sections
 * ------------------------------------------------------------------------ */

describe('A. report renders all required sections', () => {
  it('renders §1..§10 with the spec headings', () => {
    const r = buildLaneABPreview(makeSnapshot());
    const md = renderLaneABPreviewMarkdown(r);
    expect(md).toContain('# Lane A / Lane B Evidence Review preview — internal only');
    expect(md).toContain('## §1 Boundary');
    expect(md).toContain('## §2 Source availability summary');
    expect(md).toContain('## §3 Lane A preview');
    expect(md).toContain('## §4 Lane B preview');
    expect(md).toContain('## §5 Evidence gaps affecting Lane A');
    expect(md).toContain('## §6 Evidence gaps affecting Lane B');
    expect(md).toContain('## §7 What may be shown in an Evidence Review');
    expect(md).toContain('## §8 What must stay internal');
    expect(md).toContain('## §9 Track A readiness note');
    expect(md).toContain('## §10 Final boundary');
  });

  it('preview boundary carries the preview + snapshot version stamps', () => {
    const r = buildLaneABPreview(makeSnapshot());
    expect(r.boundary.preview_version).toBe(LANE_AB_PREVIEW_VERSION);
    expect(r.boundary.snapshot_version).toBe(SNAPSHOT_OBSERVER_VERSION);
  });
});

/* --------------------------------------------------------------------------
 * B. Lane A wording says candidate / evidence-quality, not score
 * ------------------------------------------------------------------------ */

describe('B. Lane A wording says candidate, not score', () => {
  it('§3 contains "candidate" and "evidence-review inputs"', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec3 = sliceSections(md).get('§3') ?? '';
    expect(sec3.toLowerCase()).toContain('candidate observations');
    expect(sec3.toLowerCase()).toContain('evidence-review inputs');
    expect(sec3.toLowerCase()).toContain('not automated');
  });

  it('§3 does not say "score", "scored", or "buyer-intent" anywhere', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec3 = sliceSections(md).get('§3') ?? '';
    expect(sec3).not.toMatch(/\bscore\b/i);
    expect(sec3).not.toMatch(/\bscored\b/i);
    expect(sec3).not.toMatch(/\bbuyer[\- ]intent\b/i);
  });

  it('Lane A observation family labels never include "score"', () => {
    const r = buildLaneABPreview(makeSnapshot());
    for (const o of r.lane_a.observations) {
      expect(o.family).not.toMatch(/score/i);
      expect(o.evidence_source).not.toMatch(/score/i);
    }
  });
});

/* --------------------------------------------------------------------------
 * C. Lane B wording says internal-only
 * ------------------------------------------------------------------------ */

describe('C. Lane B wording says internal-only', () => {
  it('§4 contains "internal only" and "founder review"', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec4 = sliceSections(md).get('§4') ?? '';
    expect(sec4.toLowerCase()).toContain('internal only');
    expect(sec4.toLowerCase()).toContain('founder');
  });

  it('§4 contains the "internal learning inputs only" PR#15a posture banner', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec4 = sliceSections(md).get('§4') ?? '';
    expect(sec4).toContain('internal learning inputs only');
    expect(sec4).toContain('must not be exposed as customer-facing claims');
  });
});

/* --------------------------------------------------------------------------
 * D. No customer-facing automated score
 * ------------------------------------------------------------------------ */

describe('D. no customer-facing automated score', () => {
  it('the rendered markdown contains no per-visitor decimal score', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    // Strip ISO timestamps (which contain `.000Z`) before scanning
    // for decimal-score shapes.
    const withoutTimestamps = md.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<ts>');
    expect(withoutTimestamps).not.toMatch(/\b0\.\d{2,}\b/);
    expect(withoutTimestamps).not.toMatch(/\bscored\s+\d/i);
    expect(withoutTimestamps).not.toMatch(/score:\s*\d/i);
  });

  it('Lane A and Lane B observations never carry a numeric score field', () => {
    const r = buildLaneABPreview(makeSnapshot());
    for (const o of r.lane_a.observations) {
      // aggregate_count is allowed; nothing else numeric.
      expect(Object.keys(o)).toEqual(
        expect.arrayContaining(['family', 'evidence_source', 'aggregate_count']),
      );
      expect((o as unknown as Record<string, unknown>).score).toBeUndefined();
      expect((o as unknown as Record<string, unknown>).buyer_intent_score).toBeUndefined();
    }
    for (const o of r.lane_b.observations) {
      expect((o as unknown as Record<string, unknown>).score).toBeUndefined();
      expect((o as unknown as Record<string, unknown>).buyer_intent_score).toBeUndefined();
    }
  });
});

/* --------------------------------------------------------------------------
 * E. No ProductDecision / RequestedAction except forbidden-boundary text
 * ------------------------------------------------------------------------ */

describe('E. ProductDecision / RequestedAction appear only inside forbidden-boundary text', () => {
  it('Lane A observation sections (§3, §5) contain neither token', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec = sliceSections(md);
    for (const tag of ['§3', '§5']) {
      const body = sec.get(tag) ?? '';
      expect(body).not.toContain('ProductDecision');
      expect(body).not.toContain('RequestedAction');
    }
  });

  it('Lane B observation sections (§4, §6) contain neither token', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec = sliceSections(md);
    for (const tag of ['§4', '§6']) {
      const body = sec.get(tag) ?? '';
      expect(body).not.toContain('ProductDecision');
      expect(body).not.toContain('RequestedAction');
    }
  });

  it('the tokens appear ONLY inside §8 internal-only rails or §10 final boundary', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec = sliceSections(md);
    const totalProductDecision = (md.match(/ProductDecision/g) ?? []).length;
    const totalRequestedAction = (md.match(/RequestedAction/g) ?? []).length;
    const allowedProductDecision =
      ((sec.get('§8') ?? '').match(/ProductDecision/g) ?? []).length +
      ((sec.get('§10') ?? '').match(/ProductDecision/g) ?? []).length;
    const allowedRequestedAction =
      ((sec.get('§8') ?? '').match(/RequestedAction/g) ?? []).length +
      ((sec.get('§10') ?? '').match(/RequestedAction/g) ?? []).length;
    expect(totalProductDecision).toBeGreaterThan(0);
    expect(totalRequestedAction).toBeGreaterThan(0);
    expect(allowedProductDecision).toBe(totalProductDecision);
    expect(allowedRequestedAction).toBe(totalRequestedAction);
  });
});

/* --------------------------------------------------------------------------
 * F. Track A labels appear only as forbidden-boundary warnings
 * ------------------------------------------------------------------------ */

describe('F. Track A labels appear only as forbidden-boundary warnings', () => {
  it('Lane A / Lane B observation sections never mention Track A', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec = sliceSections(md);
    for (const tag of ['§3', '§4', '§5', '§6']) {
      const body = sec.get(tag) ?? '';
      expect(body).not.toMatch(/track[\s\-]a\b/i);
    }
  });

  it('Track A appears ONLY inside §9 readiness note + §10 final boundary', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec = sliceSections(md);
    const totalMentions = (md.match(/Track A/g) ?? []).length;
    const allowedMentions =
      ((sec.get('§9')  ?? '').match(/Track A/g) ?? []).length +
      ((sec.get('§10') ?? '').match(/Track A/g) ?? []).length;
    expect(totalMentions).toBeGreaterThan(0);
    expect(allowedMentions).toBe(totalMentions);
  });

  it('Lane A and Lane B observation families never carry a Track-A family token', () => {
    const r = buildLaneABPreview(makeSnapshot());
    for (const o of r.lane_a.observations) {
      expect(o.family).not.toMatch(/track[\s\-]?a/i);
      expect(o.evidence_source).not.toMatch(/track[\s\-]?a/i);
    }
    for (const o of r.lane_b.observations) {
      expect(o.family).not.toMatch(/track[\s\-]?a/i);
      expect(o.evidence_source).not.toMatch(/track[\s\-]?a/i);
    }
  });
});

/* --------------------------------------------------------------------------
 * G. Sanitization inherited from PR#15a
 * ------------------------------------------------------------------------ */

describe('G. sanitization inherited from PR#15a works on tainted snapshot input', () => {
  const TAINT = {
    url:       'https://leak.example.test/path?token=ZZZ&session=ses_AAAABBBBCCCCDDDD1234',
    email:     'pii.user@leak.example.test',
    sessionId: 'ses_AAAABBBBCCCCDDDD12345678',
    jwt:       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signaturepart9876',
    bearer:    'Authorization: Bearer ZZZ1234567890abcdefXYZ',
    ip:        '203.0.113.42',
    uuid:      'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  };

  it('boundary database_host_masked is sanitized at render time', () => {
    const snap = makeSnapshot({
      boundary: { database_host_masked: TAINT.url },
    });
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(snap));
    expect(md).not.toContain('token=');
    expect(md).not.toContain('?token');
    expect(md).not.toContain('leak.example.test');
    expect(md).toMatch(/<redacted-/);
  });

  it('Lane A evidence gaps containing emails / sessions / JWTs are sanitized', () => {
    const snap = makeSnapshot({
      lane_a_candidates: {
        evidence_gaps_affecting_traffic_quality: [
          `email leaked: ${TAINT.email}`,
          `session leaked: ${TAINT.sessionId}`,
          `jwt leaked: ${TAINT.jwt}`,
          `bearer leaked: ${TAINT.bearer}`,
        ],
      },
    });
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(snap));
    expect(md).not.toContain(TAINT.email);
    expect(md).not.toContain(TAINT.sessionId);
    expect(md).not.toContain(TAINT.jwt);
    expect(md).not.toContain('Bearer ZZZ');
    expect(md).toMatch(/<redacted-contact>/);
    expect(md).toMatch(/<redacted-(?:session|token|auth)>/);
  });

  it('Lane B posture note is sanitized when tainted', () => {
    const snap = makeSnapshot({
      lane_b_internal: {
        ambiguous_or_insufficient_buckets_note:
          `internal note leak ${TAINT.url} ip=${TAINT.ip} uuid=${TAINT.uuid}`,
      },
    });
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(snap));
    expect(md).not.toContain(TAINT.ip);
    expect(md).not.toContain(TAINT.uuid);
    expect(md).not.toContain('leak.example.test');
  });
});

/* --------------------------------------------------------------------------
 * H. Deterministic output for same input
 * ------------------------------------------------------------------------ */

describe('H. deterministic output', () => {
  it('same snapshot input → identical structured report', () => {
    const a = buildLaneABPreview(makeSnapshot());
    const b = buildLaneABPreview(makeSnapshot());
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('same snapshot input → identical markdown', () => {
    const a = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const b = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    expect(a).toEqual(b);
  });
});

/* --------------------------------------------------------------------------
 * I. Missing optional evidence sources produce "cannot verify yet"
 * ------------------------------------------------------------------------ */

describe('I. missing optional evidence sources produce cannot-verify-yet, not crash', () => {
  it('all-null lane-A counts still render with cannot_verify_yet_reason text', () => {
    const snap = makeSnapshot({
      lane_a_candidates: {
        rejected_event_count:                null,
        stage0_excluded_count:               null,
        risk_observation_rows_with_evidence: null,
      },
    });
    const r = buildLaneABPreview(snap);
    expect(r.lane_a.observations.length).toBeGreaterThanOrEqual(3);
    for (const o of r.lane_a.observations.slice(0, 3)) {
      expect(o.aggregate_count).toBeNull();
      expect(o.cannot_verify_yet_reason).toMatch(/missing|failed|cannot|empty/i);
      expect(o.manual_review_needed).toBe(true);
    }
    // Render does not throw.
    expect(() => renderLaneABPreviewMarkdown(r)).not.toThrow();
  });

  it('all-null lane-B counts render the missing-evidence bucket', () => {
    const snap = makeSnapshot({
      lane_b_internal: {
        poi_observation_rows:                       null,
        poi_sequence_observation_rows:              null,
        session_features_coverage_rows:             null,
        session_behavioural_features_coverage_rows: null,
        stage0_eligible_count:                      null,
      },
    });
    const r = buildLaneABPreview(snap);
    for (const o of r.lane_b.observations) {
      expect(o.aggregate_count).toBeNull();
      expect(o.missing_evidence_bucket).toMatch(/missing|empty|absent|unavailable/i);
    }
    const md = renderLaneABPreviewMarkdown(r);
    expect(md).toContain('## §4 Lane B preview');
  });

  it('a snapshot with zero source-availability rows still renders without throwing', () => {
    const snap = makeSnapshot({
      source_availability: { tables: [] },
    });
    expect(() => renderLaneABPreviewMarkdown(buildLaneABPreview(snap))).not.toThrow();
  });
});

/* --------------------------------------------------------------------------
 * J. Readiness note says Track A not run
 * ------------------------------------------------------------------------ */

describe('J. readiness note says Track A not run', () => {
  it('§9 reports Track A run = no', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec9 = sliceSections(md).get('§9') ?? '';
    expect(sec9).toMatch(/Track A run in this PR:\*{0,2}\s*no\b/i);
    expect(sec9).toContain('Track A has not been run in this PR.');
    expect(sec9).toContain('Track A remains separate and RECORD_ONLY.');
  });

  it('readiness structured field is hard-coded to false', () => {
    const r = buildLaneABPreview(makeSnapshot());
    expect(r.track_a_readiness.track_a_run_in_this_pr).toBe(false);
  });

  it('§9 enumerates the seven forbidden-leakage surfaces', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    const sec9 = sliceSections(md).get('§9') ?? '';
    for (const target of [
      'live URLs',
      'UTMs',
      'dataLayer',
      'GA4',
      'cookies',
      'backend DB',
      'customer report text',
    ]) {
      expect(sec9).toContain(target);
    }
  });
});

/* --------------------------------------------------------------------------
 * K. Exports + version sanity
 * ------------------------------------------------------------------------ */

describe('K. exports + version sanity', () => {
  it('LANE_AB_PREVIEW_VERSION is the v0.1 frozen literal', () => {
    expect(LANE_AB_PREVIEW_VERSION).toBe('lane-ab-preview-observer-v0.1');
  });

  it('buildLaneABPreview returns a LaneABPreviewReport-shaped value', () => {
    const r: LaneABPreviewReport = buildLaneABPreview(makeSnapshot());
    expect(r.boundary.preview_version).toBe(LANE_AB_PREVIEW_VERSION);
    expect(Array.isArray(r.lane_a.observations)).toBe(true);
    expect(Array.isArray(r.lane_b.observations)).toBe(true);
  });

  it('renderLaneABPreviewMarkdown returns a non-empty string ending in the close marker', () => {
    const md = renderLaneABPreviewMarkdown(buildLaneABPreview(makeSnapshot()));
    expect(md.length).toBeGreaterThan(200);
    expect(md).toContain('**End of Lane A / Lane B Evidence Review preview — internal only.**');
  });
});
