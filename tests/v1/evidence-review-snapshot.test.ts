/**
 * Sprint 2 PR#15a — Evidence Review Snapshot Observer — tests.
 *
 * Pure tests. No DB. A small in-memory pg-shaped stub client
 * answers the runner's table-existence and count queries.
 *
 * Test groups (A..N) cover the 14 spec requirements.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  EMAIL_SHAPE_RE,
  parseDatabaseUrl,
  renderEvidenceReviewSnapshotMarkdown,
  runEvidenceReviewSnapshot,
  stripQueryString,
  SNAPSHOT_OBSERVER_VERSION,
  SNAPSHOT_TABLES,
  truncateSessionId,
  URL_WITH_QUERY_STRING_RE,
  type EvidenceReviewSnapshotReport,
  type PgQueryable,
} from '../../src/evidence-review-snapshot/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..');

/* --------------------------------------------------------------------------
 * Stub pg client builder
 * ------------------------------------------------------------------------ */

interface StubProgram {
  /** Tables that should report `exists: true`. Default: all SNAPSHOT_TABLES. */
  existingTables?: ReadonlySet<string>;
  /** Per-table count answers. Default: all 0. */
  rowCounts?: Readonly<Record<string, number>>;
  /** Tables for which the COUNT query should THROW (column shape mismatch). */
  failingCountTables?: ReadonlySet<string>;
  /** Override for stage0_excluded count. */
  stage0Excluded?: number | null;
  /** Override for stage0_eligible count. */
  stage0Eligible?: number | null;
}

function buildStubClient(prog: StubProgram = {}): PgQueryable {
  const existing  = prog.existingTables    ?? new Set(SNAPSHOT_TABLES.map((t) => t.name));
  const rowCounts = prog.rowCounts         ?? {};
  const failing   = prog.failingCountTables ?? new Set<string>();

  return {
    async query<Row = unknown>(text: string, values?: readonly unknown[]): Promise<{ rows: readonly Row[] }> {
      // Table-existence probe.
      if (text.includes('to_regclass')) {
        const tableName = (values?.[0] as string) ?? '';
        return { rows: [{ exists: existing.has(tableName) }] as unknown as Row[] };
      }
      // Stage-0 excluded.
      if (text.includes('excluded') && text.includes('IS TRUE')) {
        return { rows: [{ n: prog.stage0Excluded ?? 0 }] as unknown as Row[] };
      }
      // Stage-0 eligible.
      if (text.includes('excluded') && text.includes('IS FALSE')) {
        return { rows: [{ n: prog.stage0Eligible ?? 0 }] as unknown as Row[] };
      }
      // Per-table window count.
      for (const spec of SNAPSHOT_TABLES) {
        if (text.includes(`FROM ${spec.name}`)) {
          if (failing.has(spec.name)) {
            throw new Error(`stub: forced count failure for ${spec.name}`);
          }
          return { rows: [{ n: rowCounts[spec.name] ?? 0 }] as unknown as Row[] };
        }
      }
      throw new Error(`stub: unhandled query: ${text.slice(0, 80)}`);
    },
  };
}

function defaultOptions() {
  return {
    workspace_id: 'workspace_test_a',
    site_id:      'site.example.test',
    window_start: new Date('2026-05-01T00:00:00Z'),
    window_end:   new Date('2026-05-15T00:00:00Z'),
  };
}

function defaultArgs(stub: PgQueryable) {
  return {
    client:        stub,
    options:       defaultOptions(),
    database_host: 'db.host.example.test:5432',
    database_name: 'buyerrecon_test',
    checked_at:    new Date('2026-05-15T12:00:00Z'),
  };
}

/* --------------------------------------------------------------------------
 * A. Report renders all required sections
 * ------------------------------------------------------------------------ */

describe('A. report renders all required sections', () => {
  it('renders §1..§9 with the spec headings', async () => {
    const stub = buildStubClient({
      rowCounts: {
        accepted_events:                   100,
        rejected_events:                    10,
        ingest_requests:                   105,
        session_features:                   80,
        session_behavioural_features_v0_2:  70,
        stage0_decisions:                   80,
        risk_observations_v0_1:             50,
        poi_observations_v0_1:              40,
        poi_sequence_observations_v0_1:     20,
      },
      stage0Excluded: 15,
      stage0Eligible: 65,
    });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);

    expect(md).toContain('# Evidence Review Snapshot — internal only');
    expect(md).toContain('## §1 Boundary');
    expect(md).toContain('## §2 Source availability');
    expect(md).toContain('## §3 Evidence chain summary');
    expect(md).toContain('## §4 Lane A candidate observations');
    expect(md).toContain('## §5 Lane B internal observations');
    expect(md).toContain('## §6 Evidence gaps');
    expect(md).toContain('## §7 Evidence Review readiness');
    expect(md).toContain('## §8 Founder notes prompt');
    expect(md).toContain('## §9 Final boundary');
  });
});

/* --------------------------------------------------------------------------
 * B. Missing optional table handled without crash
 * ------------------------------------------------------------------------ */

describe('B. missing optional table handled without crash', () => {
  it('marks absent tables as "not present in schema" and does not throw', async () => {
    const stub = buildStubClient({
      existingTables: new Set(['accepted_events', 'rejected_events', 'ingest_requests']),
      rowCounts: { accepted_events: 5, ingest_requests: 5 },
    });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);

    const poiAvailability = r.source_availability.tables.find((t) => t.table_name === 'poi_observations_v0_1');
    expect(poiAvailability?.exists).toBe(false);
    expect(poiAvailability?.row_count).toBeNull();
    expect(poiAvailability?.note).toMatch(/not present/);
    expect(md).toContain('table not present in schema');
  });

  it('handles a count-query failure (column shape mismatch) gracefully', async () => {
    const stub = buildStubClient({
      failingCountTables: new Set(['session_features']),
      rowCounts: { accepted_events: 1 },
    });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const sf = r.source_availability.tables.find((t) => t.table_name === 'session_features');
    expect(sf?.exists).toBe(true);
    expect(sf?.row_count).toBeNull();
    expect(sf?.note).toMatch(/count query failed/);
  });
});

/* --------------------------------------------------------------------------
 * C. database_url masked
 * ------------------------------------------------------------------------ */

describe('C. database_url masked', () => {
  it('parseDatabaseUrl returns host + db only, never password', () => {
    const { host, name } = parseDatabaseUrl('postgres://user:s3cret@db.host.example.test:5432/buyerrecon_test');
    expect(host).toBe('db.host.example.test:5432');
    expect(name).toBe('buyerrecon_test');
  });

  it('rendered markdown carries masked DSN, not the full URL', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('db.host.example.test:5432');
    expect(md).not.toContain('s3cret');
    expect(md).not.toContain('postgres://');
  });
});

/* --------------------------------------------------------------------------
 * D. Raw token_hash / ip_hash / user_agent not printed
 * E. Full session IDs not printed
 * F. URL query strings stripped
 * ------------------------------------------------------------------------ */

describe('D/E/F. PII / token / session-id / query-string never surfaced', () => {
  it('rendered markdown contains no forbidden field-name tokens', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    const forbidden = [
      'token_hash',
      'ip_hash',
      'user_agent',
      'page_url',
      'full_url',
      'url_query',
      'raw_payload',
      'canonical_jsonb',
      'cookie',
      'authorization',
      'bearer',
      'pepper',
      'phone',
    ];
    for (const tok of forbidden) {
      // The rendered markdown is internal-only and should not echo
      // any per-row PII field name. None of these should appear.
      expect(md, `forbidden token leaked: ${tok}`).not.toMatch(new RegExp(`\\b${tok}\\b`));
    }
  });

  it('rendered markdown contains no email-shape values', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(EMAIL_SHAPE_RE.test(md)).toBe(false);
  });

  it('rendered markdown contains no URL with query-string suffix', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(URL_WITH_QUERY_STRING_RE.test(md)).toBe(false);
  });

  it('stripQueryString trims `?utm=…` and `#…` cleanly', () => {
    expect(stripQueryString('https://example.test/pricing?utm_source=ad')).toBe('https://example.test/pricing');
    expect(stripQueryString('/contact#section')).toBe('/contact');
    expect(stripQueryString('')).toBe('');
  });

  it('truncateSessionId never returns the full session ID', () => {
    const sid = 'ses_0123456789abcdef0123456789abcdef';
    expect(truncateSessionId(sid)).toBe('ses_0123…cdef');
    expect(truncateSessionId('short')).toBe('***');
    expect(truncateSessionId('')).toBe('***');
  });
});

/* --------------------------------------------------------------------------
 * G. Lane A section says candidate observations, not scores
 * H. Lane B section says internal/dark only
 * ------------------------------------------------------------------------ */

describe('G/H. Lane A and Lane B labels are explicit non-scoring boundary statements', () => {
  it('Lane A markdown carries the candidate-observation-not-score label verbatim', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('Lane A candidate observations are evidence-review inputs, not automated customer-facing scores.');
  });

  it('Lane B markdown carries the internal-only label verbatim', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('Lane B observations are internal learning inputs only and must not be exposed as customer-facing claims.');
  });
});

/* --------------------------------------------------------------------------
 * I. No ProductDecision / RequestedAction language except explicit
 *    forbidden-boundary statement (§9)
 * J. No AMS runtime bridge wording except explicit forbidden-boundary
 *    statement (§9)
 * ------------------------------------------------------------------------ */

describe('I/J. ProductDecision / RequestedAction / AMS-bridge only inside §9 forbidden-boundary block', () => {
  it('ProductDecision / RequestedAction / AMS-runtime-bridge appear only inside §9', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);

    const idx9 = md.indexOf('## §9 Final boundary');
    expect(idx9).toBeGreaterThanOrEqual(0);
    const before9 = md.slice(0, idx9);
    const after9  = md.slice(idx9);

    expect(before9).not.toContain('ProductDecision');
    expect(before9).not.toContain('RequestedAction');
    expect(before9).not.toMatch(/AMS\s+runtime\s+bridge/i);
    expect(before9).not.toMatch(/AMS\s+Product\s+Layer/i);
    expect(after9).toContain('ProductDecision');
    expect(after9).toContain('RequestedAction');
    expect(after9).toMatch(/AMS\s+runtime\s+bridge/i);
  });
});

/* --------------------------------------------------------------------------
 * K. Readiness bucket is not numeric score
 * ------------------------------------------------------------------------ */

describe('K. readiness bucket is a string label, not a number', () => {
  it('READY_FOR_MANUAL_REVIEW when accepted_events + features + downstream observations are populated', async () => {
    const stub = buildStubClient({
      rowCounts: {
        accepted_events:                   100,
        session_features:                   80,
        session_behavioural_features_v0_2:  70,
        poi_observations_v0_1:              40,
        risk_observations_v0_1:             10,
      },
    });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    expect(r.readiness.bucket).toBe('READY_FOR_MANUAL_REVIEW');
    expect(typeof r.readiness.bucket).toBe('string');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('`READY_FOR_MANUAL_REVIEW`');
    expect(md).toMatch(/operator readiness status.*not a numeric score/i);
  });

  it('STOP_THE_LINE when entire collector layer is empty', async () => {
    const stub = buildStubClient({ rowCounts: {} });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    expect(r.readiness.bucket).toBe('STOP_THE_LINE');
  });

  it('INSTALL_OR_DATA_GAP when accepted_events present but no features', async () => {
    const stub = buildStubClient({
      rowCounts: { accepted_events: 50, ingest_requests: 50 },
    });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    expect(r.readiness.bucket).toBe('INSTALL_OR_DATA_GAP');
  });

  it('NEEDS_MORE_EVIDENCE when features present but POI/risk empty', async () => {
    const stub = buildStubClient({
      rowCounts: {
        accepted_events:                   100,
        session_features:                   80,
        session_behavioural_features_v0_2:  70,
      },
    });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    expect(r.readiness.bucket).toBe('NEEDS_MORE_EVIDENCE');
  });
});

/* --------------------------------------------------------------------------
 * L. Deterministic output for same input
 * ------------------------------------------------------------------------ */

describe('L. deterministic output for same input', () => {
  it('two runs over the same stub produce identical reports and identical markdown', async () => {
    const stub = buildStubClient({
      rowCounts: {
        accepted_events:                   100,
        session_features:                   80,
        poi_observations_v0_1:              40,
      },
      stage0Excluded: 12,
    });
    const r1 = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const r2 = await runEvidenceReviewSnapshot(defaultArgs(stub));
    expect(r1).toEqual(r2);
    const m1 = renderEvidenceReviewSnapshotMarkdown(r1);
    const m2 = renderEvidenceReviewSnapshotMarkdown(r2);
    expect(m1).toBe(m2);
  });
});

/* --------------------------------------------------------------------------
 * M. Source availability table handles zero rows
 * ------------------------------------------------------------------------ */

describe('M. source availability handles zero rows', () => {
  it('renders "—" for absent tables and "0" for present-but-empty tables', async () => {
    const stub = buildStubClient({
      existingTables: new Set(['accepted_events']),
      rowCounts: { accepted_events: 0 },
    });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    const ae = r.source_availability.tables.find((t) => t.table_name === 'accepted_events');
    expect(ae?.exists).toBe(true);
    expect(ae?.row_count).toBe(0);
    // The §3 chain summary shows 0 for accepted_events.
    expect(md).toMatch(/accepted_events\s+\|\s+0/);
  });
});

/* --------------------------------------------------------------------------
 * N. Founder notes prompt present
 * ------------------------------------------------------------------------ */

describe('N. founder notes prompt present', () => {
  it('§8 lists five subsections with their canonical headings', async () => {
    const stub = buildStubClient({
      rowCounts: { accepted_events: 100, session_features: 50, poi_observations_v0_1: 10 },
    });
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('**What looks verifiable?**');
    expect(md).toContain('**What remains unknown?**');
    expect(md).toContain('**What should NOT be claimed?**');
    expect(md).toContain('**What needs customer confirmation?**');
    expect(md).toContain('**What to check in GA4 / CRM / customer-side analytics?**');
  });

  it('"should NOT be claimed" list explicitly forbids scores, identity resolution, and ROI promises', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toMatch(/per-visitor scores/i);
    expect(md).toMatch(/identity[-\s]resolution/i);
    expect(md).toMatch(/ROI/);
  });
});

/* --------------------------------------------------------------------------
 * Static-source guards — observer source contains no DML/DDL.
 * ------------------------------------------------------------------------ */

describe('static-source guard — runtime files contain no DML / DDL', () => {
  const runtimeFiles = [
    'src/evidence-review-snapshot/runner.ts',
    'src/evidence-review-snapshot/report.ts',
    'src/evidence-review-snapshot/sql.ts',
    'src/evidence-review-snapshot/sanitize.ts',
    'src/evidence-review-snapshot/types.ts',
    'src/evidence-review-snapshot/index.ts',
  ];
  it('no INSERT / UPDATE / DELETE / CREATE / ALTER / DROP / TRUNCATE in any runtime file', () => {
    for (const f of runtimeFiles) {
      const src = readFileSync(join(REPO_ROOT, f), 'utf8');
      // Strip line + block comments before scanning.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      expect(stripped, `${f}: INSERT INTO`).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(stripped, `${f}: UPDATE … SET`).not.toMatch(/\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b/i);
      expect(stripped, `${f}: DELETE FROM`).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(stripped, `${f}: CREATE TABLE`).not.toMatch(/\bCREATE\s+TABLE\b/i);
      expect(stripped, `${f}: ALTER TABLE`).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(stripped, `${f}: DROP TABLE`).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(stripped, `${f}: TRUNCATE`).not.toMatch(/\bTRUNCATE\b/i);
    }
  });
});

/* --------------------------------------------------------------------------
 * Observer-version stamp regression guard
 * ------------------------------------------------------------------------ */

describe('observer version stamp', () => {
  it('exposes the v0.1 version constant', () => {
    expect(SNAPSHOT_OBSERVER_VERSION).toBe('evidence-review-snapshot-observer-v0.1');
  });
});

/* --------------------------------------------------------------------------
 * Sample report fixture — extra type guard
 * ------------------------------------------------------------------------ */

describe('report structure', () => {
  it('returns a fully-populated EvidenceReviewSnapshotReport', async () => {
    const stub = buildStubClient({
      rowCounts: { accepted_events: 7, session_features: 5, poi_observations_v0_1: 3 },
    });
    const r: EvidenceReviewSnapshotReport = await runEvidenceReviewSnapshot(defaultArgs(stub));
    expect(r.boundary.observer_version).toBe('evidence-review-snapshot-observer-v0.1');
    expect(r.boundary.workspace_id).toBe('workspace_test_a');
    expect(r.evidence_chain.accepted_events_rows).toBe(7);
    expect(r.evidence_chain.session_features_rows).toBe(5);
    expect(r.evidence_chain.poi_observations_rows).toBe(3);
    expect(r.lane_a_candidates.rejected_event_count).toBe(0);
    expect(r.lane_b_internal.poi_observation_rows).toBe(3);
    expect(r.readiness.bucket).toBe('READY_FOR_MANUAL_REVIEW');
  });
});

/* --------------------------------------------------------------------------
 * Codex blocker patch — output-sanitization regression tests
 *
 * Cover the new sanitizers added in sanitize.ts:
 *   sanitizeOutputText / sanitizeBoundaryLabel / sanitizeErrorNote
 * applied at runner.ts (boundary labels + table notes) and at
 * report.ts (defense-in-depth safe()).
 *
 * Spec test letters A..I map to:
 *   A unsafe workspace_id with email -> redacted
 *   B unsafe site_id with URL+query -> redacted
 *   C boundary value with UUID -> redacted
 *   D boundary value with token-like string -> redacted
 *   E boundary value with user-agent-like string -> redacted
 *   F DB error containing email/URL/token/cookie/UA/raw_payload
 *       is sanitised (generic note) — no leak
 *   G rendered markdown contains no raw unsafe values
 *   H normal safe workspace_id/site_id render unchanged
 *   I existing PII/token/session-id/URL-query/email guards still
 *     pass (covered by the original D/E/F suite above)
 * ------------------------------------------------------------------------ */

function defaultArgsWith(stub: PgQueryable, overrides: { workspace_id?: string; site_id?: string }) {
  const base = defaultArgs(stub);
  return {
    ...base,
    options: {
      ...base.options,
      workspace_id: overrides.workspace_id ?? base.options.workspace_id,
      site_id:      overrides.site_id      ?? base.options.site_id,
    },
  };
}

describe('Codex blocker — A. unsafe workspace_id with email is redacted', () => {
  it('email-shape workspace_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { workspace_id: 'helen@example.test' }),
    );
    expect(r.boundary.workspace_id).toBe('<redacted-unsafe-workspace-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('<redacted-unsafe-workspace-id>');
    expect(md).not.toContain('helen@example.test');
  });
});

describe('Codex blocker — B. unsafe site_id with URL+query is redacted', () => {
  it('URL-shape site_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { site_id: 'https://example.test/path?utm_source=spam' }),
    );
    expect(r.boundary.site_id).toBe('<redacted-unsafe-site-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('<redacted-unsafe-site-id>');
    expect(md).not.toContain('https://example.test');
    expect(md).not.toContain('utm_source=spam');
  });
});

describe('Codex blocker — B2. IP-shaped boundary labels are redacted', () => {
  it('IPv4-shape workspace_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const rawIp = '192.168.1.1';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { workspace_id: rawIp }),
    );
    expect(r.boundary.workspace_id).toBe('<redacted-unsafe-workspace-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('<redacted-unsafe-workspace-id>');
    expect(md).not.toContain(rawIp);
  });

  it('IPv4-shape site_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const rawIp = '10.0.0.42';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { site_id: rawIp }),
    );
    expect(r.boundary.site_id).toBe('<redacted-unsafe-site-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('<redacted-unsafe-site-id>');
    expect(md).not.toContain(rawIp);
  });

  it('IPv6-shape workspace_id is replaced by the redacted fallback while k8s.cluster:1 remains safe elsewhere', async () => {
    const stub = buildStubClient();
    const rawIpv6 = '2001:db8::1';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { workspace_id: rawIpv6 }),
    );
    expect(r.boundary.workspace_id).toBe('<redacted-unsafe-workspace-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain(rawIpv6);
  });
});

describe('Codex blocker — C. boundary value with UUID-like string is redacted', () => {
  it('UUID-shape workspace_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { workspace_id: uuid }),
    );
    expect(r.boundary.workspace_id).toBe('<redacted-unsafe-workspace-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain(uuid);
  });
});

describe('Codex blocker — C2. full session-id-shaped boundary labels are redacted', () => {
  it('session-id-shape workspace_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const sessionId = 'ses_0123456789abcdef0123456789abcdef';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { workspace_id: sessionId }),
    );
    expect(r.boundary.workspace_id).toBe('<redacted-unsafe-workspace-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain(sessionId);
  });

  it('session-id-shape site_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const sessionId = 'ses_0123456789abcdef0123456789abcdef';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { site_id: sessionId }),
    );
    expect(r.boundary.site_id).toBe('<redacted-unsafe-site-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain(sessionId);
  });
});

describe('Codex blocker — D. boundary value with token-like string is redacted', () => {
  it('long token-shape site_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const token = 'a1b2c3d4e5f6g7h8i9j0a1b2c3d4e5f6g7h8i9j0a1b2'; // > 40 chars
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { site_id: token }),
    );
    expect(r.boundary.site_id).toBe('<redacted-unsafe-site-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain(token);
  });

  it('JWT-like boundary label is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const jwtLike = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturePart';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { site_id: jwtLike }),
    );
    expect(r.boundary.site_id).toBe('<redacted-unsafe-site-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain(jwtLike);
  });

  it('short token-prefix boundary label is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const shortToken = 'sk_live1234';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { workspace_id: shortToken }),
    );
    expect(r.boundary.workspace_id).toBe('<redacted-unsafe-workspace-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain(shortToken);
  });
});

describe('Codex blocker — E. boundary value with user-agent-like string is redacted', () => {
  it('UA-shape workspace_id is replaced by the redacted fallback', async () => {
    const stub = buildStubClient();
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const r = await runEvidenceReviewSnapshot(
      defaultArgsWith(stub, { workspace_id: ua }),
    );
    expect(r.boundary.workspace_id).toBe('<redacted-unsafe-workspace-id>');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain('Mozilla/5.0');
    expect(md).not.toContain('AppleWebKit');
  });
});

describe('Codex blocker — F. DB error containing forbidden content is sanitised', () => {
  it('count-query failure note never echoes the raw DB error message', async () => {
    // Stub a DB error whose Error.message carries every kind of
    // forbidden content (email, URL+query, bearer token, cookie,
    // user-agent, raw_payload, long token).
    const TAINTED_ERROR_MSG =
      'syntax error near helen@example.test https://example.test?utm_source=x ' +
      'Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig Cookie: SID=abc ' +
      'Mozilla/5.0 raw_payload {"k":"v"} ' +
      'a1b2c3d4e5f6g7h8i9j0a1b2c3d4e5f6g7h8i9j0a1b2';
    const stub: PgQueryable = {
      async query<Row = unknown>(text: string): Promise<{ rows: readonly Row[] }> {
        if (text.includes('to_regclass')) {
          return { rows: [{ exists: true }] as unknown as Row[] };
        }
        throw new Error(TAINTED_ERROR_MSG);
      },
    };
    const r = await runEvidenceReviewSnapshot(defaultArgs(stub));
    const sf = r.source_availability.tables.find((t) => t.table_name === 'session_features');
    expect(sf?.exists).toBe(true);
    expect(sf?.row_count).toBeNull();
    // Generic note — does NOT echo the tainted text.
    expect(sf?.note).toBe('count query failed (sanitized database error)');

    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toContain('helen@example.test');
    expect(md).not.toContain('https://example.test');
    expect(md).not.toContain('utm_source=x');
    expect(md).not.toContain('Bearer eyJhbGciOiJSUzI1NiJ9');
    expect(md).not.toContain('Cookie: SID=abc');
    expect(md).not.toContain('Mozilla/5.0');
    expect(md).not.toContain('a1b2c3d4e5f6g7h8i9j0a1b2c3d4e5f6g7h8i9j0a1b2');
  });
});

describe('Codex blocker — G. rendered markdown contains no raw unsafe boundary values', () => {
  it('every unsafe-boundary case leaves no raw shapes in the rendered markdown', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgsWith(stub, {
      workspace_id: 'helen@example.test',
      site_id:      'https://attacker.test/path?utm_source=spam',
    }));
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).not.toMatch(/helen@example\.test/);
    expect(md).not.toMatch(/https?:\/\/attacker\.test/);
    expect(md).not.toMatch(/utm_source=spam/);
    expect(md).toContain('<redacted-unsafe-workspace-id>');
    expect(md).toContain('<redacted-unsafe-site-id>');
  });
});

describe('Codex blocker — H. normal safe workspace_id/site_id render unchanged', () => {
  it('canonical safe-label values pass through verbatim', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgsWith(stub, {
      workspace_id: 'workspace_test_a',
      site_id:      'site.example.test',
    }));
    expect(r.boundary.workspace_id).toBe('workspace_test_a');
    expect(r.boundary.site_id).toBe('site.example.test');
    const md = renderEvidenceReviewSnapshotMarkdown(r);
    expect(md).toContain('workspace_test_a');
    expect(md).toContain('site.example.test');
  });

  it('hyphenated / dotted / colon-bearing safe labels (e.g. "buyerrecon-staging-ws", "k8s.cluster:1") pass through', async () => {
    const stub = buildStubClient();
    const r = await runEvidenceReviewSnapshot(defaultArgsWith(stub, {
      workspace_id: 'buyerrecon-staging-ws',
      site_id:      'k8s.cluster:1',
    }));
    expect(r.boundary.workspace_id).toBe('buyerrecon-staging-ws');
    expect(r.boundary.site_id).toBe('k8s.cluster:1');
  });
});

describe('Codex blocker — sanitizers direct unit tests', () => {
  it('sanitizeBoundaryLabel: empty / too long / forbidden-char inputs fall back', async () => {
    const { sanitizeBoundaryLabel } = await import('../../src/evidence-review-snapshot/sanitize.js');
    expect(sanitizeBoundaryLabel('',          'F')).toBe('F');
    expect(sanitizeBoundaryLabel(null,        'F')).toBe('F');
    expect(sanitizeBoundaryLabel(undefined,   'F')).toBe('F');
    expect(sanitizeBoundaryLabel(123 as any,  'F')).toBe('F');
    expect(sanitizeBoundaryLabel('a'.repeat(97), 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('has space', 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('has/slash', 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('has?query', 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('has@at',    'F')).toBe('F');
    expect(sanitizeBoundaryLabel('192.168.1.1', 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('2001:db8::1', 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('ses_0123456789abcdef0123456789abcdef', 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sigPart', 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('tok_abcd1234', 'F')).toBe('F');
    expect(sanitizeBoundaryLabel('safe_label-1.2:3', 'F')).toBe('safe_label-1.2:3');
  });

  it('sanitizeOutputText: redacts every covered shape', async () => {
    const { sanitizeOutputText } = await import('../../src/evidence-review-snapshot/sanitize.js');
    expect(sanitizeOutputText('reach me at helen@example.test'))
      .toMatch(/<redacted-contact>/);
    // And the resulting marker does not itself trip the
    // forbidden-field-name pass (no nested <redacted-…> markers).
    expect(sanitizeOutputText('reach me at helen@example.test'))
      .not.toMatch(/<redacted-<redacted-/);
    expect(sanitizeOutputText('go to https://x.test/path?utm_source=y'))
      .toMatch(/<redacted-url-with-query>|<redacted-url>|<redacted-query-string>/);
    expect(sanitizeOutputText('Authorization: Bearer abc'))
      .toMatch(/<redacted-auth>/);
    expect(sanitizeOutputText('Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0'))
      .toMatch(/<redacted-user-agent>/);
    expect(sanitizeOutputText('id 550e8400-e29b-41d4-a716-446655440000 here'))
      .toMatch(/<redacted-uuid>/);
    expect(sanitizeOutputText('ip 192.168.1.1 here')).toMatch(/<redacted-address>/);
    expect(sanitizeOutputText('ipv6 2001:db8::1 here')).toMatch(/<redacted-address>/);
    expect(sanitizeOutputText('sid ses_0123456789abcdef0123456789abcdef here'))
      .toMatch(/<redacted-session>/);
    expect(sanitizeOutputText('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturePart'))
      .toMatch(/<redacted-token>/);
    expect(sanitizeOutputText('prefix sk_live1234')).toMatch(/<redacted-token>/);
    expect(sanitizeOutputText('blob {"raw_payload":"x"}'))
      .toMatch(/<redacted-/);
    expect(sanitizeOutputText('regular text passes through')).toBe('regular text passes through');
  });

  it('sanitizeErrorNote: always returns generic note regardless of input', async () => {
    const { sanitizeErrorNote } = await import('../../src/evidence-review-snapshot/sanitize.js');
    expect(sanitizeErrorNote(new Error('email: helen@example.test')))
      .toBe('count query failed (sanitized database error)');
    expect(sanitizeErrorNote('Bearer eyJ...'))
      .toBe('count query failed (sanitized database error)');
    expect(sanitizeErrorNote(undefined))
      .toBe('count query failed (sanitized database error)');
  });
});
