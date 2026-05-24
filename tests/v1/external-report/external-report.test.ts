import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXTERNAL_OUTPUT_FLAGS,
  EXTERNAL_REPORT_FIXTURES,
  assertCustomerSafeText,
  buildReportSnapshot,
  renderReportMarkdown,
  validateClaimBlock,
  validateSafeClaimEntry,
  type EvidenceAtom,
  type ReportSnapshot,
  type SafeClaimEntry,
} from '../../../src/reports/external/index.js';

const forbiddenCustomerPhrases = [
  'confirmed buyer',
  'guaranteed intent',
  'high-confidence buyer identity',
  'fraud conclusion',
  'AI-agent classification in customer output',
  'readiness-to-buy conclusion',
] as const;

function report(name: keyof typeof EXTERNAL_REPORT_FIXTURES): ReportSnapshot {
  return buildReportSnapshot(EXTERNAL_REPORT_FIXTURES[name]);
}

function markdown(name: keyof typeof EXTERNAL_REPORT_FIXTURES): string {
  return renderReportMarkdown(report(name));
}

describe('external report contracts', () => {
  it('contracts compile and default feature flags remain false', () => {
    const snapshot: ReportSnapshot = report('empty_state');
    expect(snapshot.schema_version).toBe('0.1.0');
    expect(snapshot.flags_snapshot).toEqual(DEFAULT_EXTERNAL_OUTPUT_FLAGS);
    expect(DEFAULT_EXTERNAL_OUTPUT_FLAGS).toEqual({
      show_evidence_grade: false,
      show_recommendations: false,
      show_account_inference: false,
      auto_send_reports: false,
    });
  });

  it('safe-claim validation rejects forbidden phrases', () => {
    for (const phrase of forbiddenCustomerPhrases) {
      const candidate: SafeClaimEntry = {
        template_id: 'safe.test.v1',
        template_kind: 'fact',
        copy_template: `This says ${phrase}.`,
        required_placeholders: [],
        allowed_language_tags: ['observed'],
        forbidden_language_tags: [],
        minimum_evidence_grade: 'E1',
        minimum_evidence_confidence: null,
      };
      expect(validateSafeClaimEntry(candidate)).toContain('copy_template_contains_forbidden_language');
      expect(assertCustomerSafeText(candidate.copy_template).length).toBeGreaterThan(0);
    }
  });

  it('ClaimBlock arrays are mandatory and section shapes stay disjoint', () => {
    const block = report('single_session').session_evidence_cards[0]?.claim_block;
    expect(block).toBeDefined();
    expect(validateClaimBlock(block!)).toEqual([]);
    expect(validateClaimBlock({ ...block!, recommendations: [{ ...block!.recommendations[0]!, auto_action_allowed: true }] })).toContain('auto_action_must_be_false');
    expect(validateClaimBlock({ ...block!, facts: undefined })).toContain('facts_array_required');
    expect(validateClaimBlock({
      ...block!,
      facts: [{ ...block!.facts[0]!, reason_codes: ['wrong_section'] } as never],
    })).toContain('fact_shape_invalid');
  });
});

describe('external report rendering safety', () => {
  it('evidence grade disclaimer is present and never rendered as probability', () => {
    const md = markdown('single_session');
    expect(md).toContain('Evidence grade measures observed evidence completeness, not purchase probability.');
    expect(md).not.toMatch(/\b\d+%\s+likely/i);
    expect(md).not.toMatch(/purchase probability:\s*\d/i);
  });

  it('empty state report renders safely', () => {
    const md = markdown('empty_state');
    expect(md).toContain('Installation status: not_installed');
    expect(md).toContain('NO_EVENT_YET is not failure');
    expect(md).not.toContain('confirmed buyer');
  });

  it('connected-no-data report renders safely', () => {
    const md = markdown('connected_no_data');
    expect(md).toContain('Installation status: connected_no_data');
    expect(md).toContain('not a buyer-intent claim');
    expect(md).not.toContain('ready to buy');
  });

  it('single-session fixture renders facts and limitations separately', () => {
    const md = markdown('single_session');
    expect(md).toContain('- Facts:');
    expect(md).toContain('- Inferences:');
    expect(md).toContain('- Recommendations:');
    expect(md).toContain('- Limitations:');
  });

  it('weak-account fixture does not overclaim', () => {
    const md = markdown('weak_account_evidence');
    expect(md).toContain('Account inference rendering is disabled by feature flag.');
    expect(md).not.toMatch(/high[- ]intent/i);
    expect(md).not.toMatch(/ready to buy/i);
    expect(md).not.toMatch(/qualified lead/i);
  });

  it('repeated-account fixture still does not say confirmed buyer', () => {
    const md = markdown('repeated_account_pattern');
    expect(md).toContain('Sessions observed: 5');
    expect(md).not.toContain('confirmed buyer');
    expect(md).not.toContain('guaranteed intent');
  });

  it('conflicting-evidence fixture emphasizes limitations and suppresses recommendations', () => {
    const snapshot = buildReportSnapshot({
      ...EXTERNAL_REPORT_FIXTURES.conflicting_evidence,
      flags: { show_recommendations: true },
    });
    const md = renderReportMarkdown(snapshot);
    expect(md).toContain('observed signals conflict');
    expect(md).toContain('limitations should be reviewed first');
    expect(md).not.toContain('Review the observed session evidence before taking any action.');
  });

  it('raw request IDs, raw session IDs, auth headers, and token-like strings are not rendered', () => {
    const fixture = structuredClone(EXTERNAL_REPORT_FIXTURES.single_session);
    const rawAtom: EvidenceAtom = {
      ...fixture.sessions[0]!.atoms[0]!,
      atom_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      source_ref: 'request_id: f47ac10b-58cc-4372-a567-0e02b2c3d479',
      category: 'Authorization: Bearer secret-token',
      facet: 'session_id: sess_super_secret',
    };
    fixture.sessions[0] = { ...fixture.sessions[0]!, atoms: [rawAtom] };
    const md = renderReportMarkdown(buildReportSnapshot(fixture));
    expect(md).not.toContain('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(md).not.toContain('sess_super_secret');
    expect(md).not.toContain('Bearer secret-token');
    expect(md).not.toContain('Authorization:');
    expect(md).not.toContain('token_hash');
  });

  it('Lane B and AI-agent language is not rendered', () => {
    const fixture = structuredClone(EXTERNAL_REPORT_FIXTURES.single_session);
    const atom: EvidenceAtom = {
      ...fixture.sessions[0]!.atoms[0]!,
      category: 'Lane B',
      facet: 'AI-agent classification in customer output',
      source_type: 'scoring_worker_output',
    };
    fixture.sessions[0] = { ...fixture.sessions[0]!, atoms: [atom] };
    const md = renderReportMarkdown(buildReportSnapshot(fixture));
    expect(md).not.toContain('Lane B');
    expect(md).not.toContain('AI-agent');
  });

  it('report renderer preserves non-production and Gate 4C boundaries', () => {
    const md = markdown('single_session');
    expect(md).toContain('Local fixture/report-contract MVP only');
    expect(md).toContain('Gate 4C remains unapproved');
    expect(md).toContain('no runtime scoring');
    expect(md).toContain('no Lane writer');
  });
});
