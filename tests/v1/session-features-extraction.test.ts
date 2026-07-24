/**
 * Sprint 1 PR#11 — pure tests for the session-features extractor.
 *
 * Verifies:
 *   - parseOptionsFromEnv contract (defaults, overrides, validation)
 *   - EXTRACTION_SQL string contains all the locked-down filters and
 *     idempotency pieces and contains NO banned scoring identifiers and NO
 *     DML/DDL against accepted_events / rejected_events / ingest_requests /
 *     site_write_tokens.
 *   - runExtraction calls pool.query exactly once with the right parameter
 *     shape.
 *
 * No DB. No live network. All assertions are string-level or against a fake
 * pg client.
 */

import { describe, it, expect } from 'vitest';
import {
  EXTRACTION_SQL,
  EXACT_VERIFY_SQL,
  assertExactEventSet,
  parseOptionsFromEnv,
  runExtraction,
  type ExactVerifyRow,
  type ExtractorOptions,
} from '../../scripts/extract-session-features.js';

/* --------------------------------------------------------------------------
 * parseOptionsFromEnv
 * ------------------------------------------------------------------------ */

describe('PR#11 parseOptionsFromEnv — defaults and overrides', () => {
  const NOW = new Date('2026-05-11T16:00:00.000Z');

  it('defaults: 168-hour window, no workspace/site filter, version session-features-v0.1', () => {
    const opts = parseOptionsFromEnv({} as NodeJS.ProcessEnv, NOW);
    expect(opts.workspace_id).toBeNull();
    expect(opts.site_id).toBeNull();
    expect(opts.extraction_version).toBe('session-features-v0.1');
    expect(opts.window_end.toISOString()).toBe(NOW.toISOString());
    // 168 h before NOW.
    expect(opts.window_start.toISOString()).toBe('2026-05-04T16:00:00.000Z');
  });

  it('SINCE_HOURS overrides the window', () => {
    const opts = parseOptionsFromEnv({ SINCE_HOURS: '24' } as NodeJS.ProcessEnv, NOW);
    expect(opts.window_start.toISOString()).toBe('2026-05-10T16:00:00.000Z');
  });

  it('explicit SINCE / UNTIL ISO timestamps override', () => {
    const opts = parseOptionsFromEnv(
      { SINCE: '2026-05-01T00:00:00Z', UNTIL: '2026-05-05T00:00:00Z' } as NodeJS.ProcessEnv,
      NOW,
    );
    expect(opts.window_start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(opts.window_end.toISOString()).toBe('2026-05-05T00:00:00.000Z');
  });

  it('WORKSPACE_ID / SITE_ID surface as filter strings', () => {
    const opts = parseOptionsFromEnv(
      { WORKSPACE_ID: 'ws_x', SITE_ID: 'site_y' } as NodeJS.ProcessEnv,
      NOW,
    );
    expect(opts.workspace_id).toBe('ws_x');
    expect(opts.site_id).toBe('site_y');
  });

  it('EXTRACTION_VERSION override is honoured', () => {
    const opts = parseOptionsFromEnv(
      { EXTRACTION_VERSION: 'session-features-v0.2-rc' } as NodeJS.ProcessEnv,
      NOW,
    );
    expect(opts.extraction_version).toBe('session-features-v0.2-rc');
  });

  it('empty WORKSPACE_ID / SITE_ID strings resolve to null (no filter)', () => {
    const opts = parseOptionsFromEnv(
      { WORKSPACE_ID: '', SITE_ID: '' } as NodeJS.ProcessEnv,
      NOW,
    );
    expect(opts.workspace_id).toBeNull();
    expect(opts.site_id).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * EXTRACTION_SQL — string-level contract checks
 * ------------------------------------------------------------------------ */

describe('PR#11 EXTRACTION_SQL — locked filter clauses present', () => {
  it('candidate_sessions CTE filters event_contract_version = event-contract-v0.1', () => {
    expect(EXTRACTION_SQL).toMatch(/event_contract_version\s*=\s*'event-contract-v0\.1'/);
  });

  it('filters event_origin = browser', () => {
    expect(EXTRACTION_SQL).toMatch(/event_origin\s*=\s*'browser'/);
  });

  it('excludes the __server__ legacy sentinel', () => {
    expect(EXTRACTION_SQL).toMatch(/session_id\s*<>\s*'__server__'/);
  });

  it('requires workspace_id / site_id / session_id IS NOT NULL', () => {
    expect(EXTRACTION_SQL).toMatch(/workspace_id\s+IS\s+NOT\s+NULL/);
    expect(EXTRACTION_SQL).toMatch(/site_id\s+IS\s+NOT\s+NULL/);
    expect(EXTRACTION_SQL).toMatch(/session_id\s+IS\s+NOT\s+NULL/);
  });

  it('uses received_at (NOT raw->>"occurred_at") for timing', () => {
    expect(EXTRACTION_SQL).toMatch(/received_at\s+>=\s+\$1/);
    expect(EXTRACTION_SQL).toMatch(/received_at\s+<=\s+\$2/);
    // No reliance on raw->>'occurred_at' for endpoints / duration.
    const occurredAtRefs = EXTRACTION_SQL.match(/raw->>'occurred_at'/g) ?? [];
    expect(occurredAtRefs).toHaveLength(0);
  });

  it('uses deterministic event_id tie-break in first/last ORDER BY', () => {
    expect(EXTRACTION_SQL).toMatch(/ORDER\s+BY\s+received_at\s+ASC,\s+event_id\s+ASC/);
    expect(EXTRACTION_SQL).toMatch(/ORDER\s+BY\s+received_at\s+DESC,\s+event_id\s+DESC/);
  });

  it('computes session_duration_ms from received_at delta', () => {
    expect(EXTRACTION_SQL).toMatch(/EXTRACT\(EPOCH FROM \(ep\.last_seen_at - ep\.first_seen_at\)\)\s*\*\s*1000/);
  });

  it('uses canonical_jsonb keys via jsonb_object_keys + COUNT, NULL-safe', () => {
    expect(EXTRACTION_SQL).toMatch(/canonical_jsonb\s+IS\s+NULL\s+THEN\s+NULL/);
    expect(EXTRACTION_SQL).toMatch(/jsonb_object_keys\(ae\.canonical_jsonb\)/);
  });

  it('candidate-window vs full-session: session_events JOINs candidate_sessions WITHOUT a received_at filter', () => {
    // The session_events CTE selects ALL events for candidate sessions; the
    // candidate window appears only on candidate_sessions. We assert by
    // checking the session_events CTE body contains no "received_at >= $1"
    // or "received_at <= $2" — that filter belongs to candidate_sessions only.
    const seBlockMatch = EXTRACTION_SQL.match(
      /session_events AS \([\s\S]*?\n\),\nranked AS/,
    );
    expect(seBlockMatch).not.toBeNull();
    const seBlock = seBlockMatch![0];
    expect(seBlock).not.toMatch(/received_at\s+>=\s+\$1/);
    expect(seBlock).not.toMatch(/received_at\s+<=\s+\$2/);
  });
});

describe('PR#11 EXTRACTION_SQL — idempotency / upsert', () => {
  it('targets session_features only', () => {
    expect(EXTRACTION_SQL).toMatch(/INSERT\s+INTO\s+session_features/);
  });

  it('uses ON CONFLICT on the natural key', () => {
    expect(EXTRACTION_SQL).toMatch(
      /ON\s+CONFLICT\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*session_id\s*,\s*extraction_version\s*\)\s+DO\s+UPDATE/,
    );
  });

  it('RETURNING captures session_features_id for stable identity', () => {
    expect(EXTRACTION_SQL).toMatch(/RETURNING\s+session_features_id/);
  });

  it('DO UPDATE refreshes every aggregate column (but NOT session_features_id)', () => {
    expect(EXTRACTION_SQL).toMatch(/extracted_at\s*=\s*EXCLUDED\.extracted_at/);
    expect(EXTRACTION_SQL).toMatch(/source_event_count\s*=\s*EXCLUDED\.source_event_count/);
    expect(EXTRACTION_SQL).toMatch(/last_page_url\s*=\s*EXCLUDED\.last_page_url/);
    expect(EXTRACTION_SQL).toMatch(/event_name_counts\s*=\s*EXCLUDED\.event_name_counts/);
    // session_features_id MUST NOT appear in DO UPDATE SET — it stays stable.
    expect(EXTRACTION_SQL).not.toMatch(/session_features_id\s*=\s*EXCLUDED/);
  });

  it('writes default \'{}\'::jsonb when a count map has no entries (LEFT JOIN + COALESCE)', () => {
    expect(EXTRACTION_SQL).toMatch(/COALESCE\(enc\.counts,\s*'\{\}'::jsonb\)/);
    expect(EXTRACTION_SQL).toMatch(/COALESCE\(skc\.counts,\s*'\{\}'::jsonb\)/);
    expect(EXTRACTION_SQL).toMatch(/COALESCE\(csc\.counts,\s*'\{\}'::jsonb\)/);
  });
});

describe('PR#11 EXTRACTION_SQL — non-mutation of source tables', () => {
  // The extractor must NEVER write to the raw evidence ledger. The only
  // write is the INSERT INTO session_features above.

  it('no INSERT into accepted_events / rejected_events / ingest_requests / site_write_tokens', () => {
    expect(EXTRACTION_SQL).not.toMatch(/INSERT\s+INTO\s+accepted_events/i);
    expect(EXTRACTION_SQL).not.toMatch(/INSERT\s+INTO\s+rejected_events/i);
    expect(EXTRACTION_SQL).not.toMatch(/INSERT\s+INTO\s+ingest_requests/i);
    expect(EXTRACTION_SQL).not.toMatch(/INSERT\s+INTO\s+site_write_tokens/i);
  });

  it('no UPDATE / DELETE / TRUNCATE / DROP / ALTER against source tables', () => {
    expect(EXTRACTION_SQL).not.toMatch(/UPDATE\s+accepted_events/i);
    expect(EXTRACTION_SQL).not.toMatch(/UPDATE\s+rejected_events/i);
    expect(EXTRACTION_SQL).not.toMatch(/UPDATE\s+ingest_requests/i);
    expect(EXTRACTION_SQL).not.toMatch(/UPDATE\s+site_write_tokens/i);
    expect(EXTRACTION_SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(EXTRACTION_SQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(EXTRACTION_SQL).not.toMatch(/\bDROP\s+(TABLE|INDEX)\b/i);
    expect(EXTRACTION_SQL).not.toMatch(/\bALTER\s+TABLE\s+(accepted_events|rejected_events|ingest_requests|site_write_tokens)\b/i);
  });

  it('does not select token_hash or ip_hash anywhere', () => {
    expect(EXTRACTION_SQL).not.toMatch(/\btoken_hash\b/);
    expect(EXTRACTION_SQL).not.toMatch(/\bip_hash\b/);
  });
});

describe('PR#11 EXTRACTION_SQL — no banned scoring/judgement identifiers', () => {
  const BANNED = [
    'risk_score',
    'buyer_score',
    'intent_score',
    'bot_score',
    'human_score',
    'classification',
    'recommended_action',
    'confidence_band',
    'is_bot',
    'is_agent',
    'ai_agent',
    'lead_quality',
    'crm',
    'company_enrichment',
    'ip_enrichment',
  ];
  for (const banned of BANNED) {
    it(`SQL contains no \`${banned}\` identifier`, () => {
      const re = new RegExp(`\\b${banned}\\b`, 'i');
      expect(EXTRACTION_SQL).not.toMatch(re);
    });
  }
});

/* --------------------------------------------------------------------------
 * runExtraction — call shape against a fake pool
 * ------------------------------------------------------------------------ */

describe('PR#11 runExtraction — pool.query call shape', () => {
  function makeFakePool(): { calls: Array<{ text: string; values: unknown[] }>; query: (t: string, v: unknown[]) => Promise<{ rowCount: number; rows: unknown[] }> } {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    return {
      calls,
      query: async (text: string, values: unknown[]) => {
        calls.push({ text, values });
        return { rowCount: 0, rows: [] };
      },
    };
  }

  it('issues exactly one query — the upsert pipeline', async () => {
    const pool = makeFakePool();
    await runExtraction(pool as never, {
      workspace_id: 'ws_test',
      site_id: 'site_test',
      window_start: new Date('2026-05-04T16:00:00.000Z'),
      window_end: new Date('2026-05-11T16:00:00.000Z'),
      extraction_version: 'session-features-v0.1',
    });
    expect(pool.calls).toHaveLength(1);
    expect(pool.calls[0].text).toBe(EXTRACTION_SQL);
  });

  it('passes parameters in the locked order [window_start, window_end, workspace_id, site_id, extraction_version, session_id, event_ids] (legacy → session_id/event_ids null)', async () => {
    const pool = makeFakePool();
    const window_start = new Date('2026-05-04T16:00:00.000Z');
    const window_end = new Date('2026-05-11T16:00:00.000Z');
    await runExtraction(pool as never, {
      workspace_id: 'ws_x',
      site_id: 'site_y',
      window_start,
      window_end,
      extraction_version: 'session-features-v0.1',
    });
    expect(pool.calls[0].values).toEqual([
      window_start,
      window_end,
      'ws_x',
      'site_y',
      'session-features-v0.1',
      null,
      null,
    ]);
  });

  it('passes null workspace/site filters through (so the SQL OR clause matches all)', async () => {
    const pool = makeFakePool();
    await runExtraction(pool as never, {
      workspace_id: null,
      site_id: null,
      window_start: new Date('2026-05-04T16:00:00.000Z'),
      window_end: new Date('2026-05-11T16:00:00.000Z'),
      extraction_version: 'session-features-v0.1',
    });
    expect(pool.calls[0].values?.[2]).toBeNull();
    expect(pool.calls[0].values?.[3]).toBeNull();
  });
});

/* --------------------------------------------------------------------------
 * Remediation — canonical route extraction (raw.path preferred, page_view only)
 * ------------------------------------------------------------------------ */

describe('remediation EXTRACTION_SQL — canonical page-path extraction', () => {
  it('derives landing/last route via COALESCE(NULLIF(raw.path,\'\'), NULLIF(raw.page_path,\'\')) — path preferred, empty-as-absent', () => {
    expect(EXTRACTION_SQL).toMatch(
      /COALESCE\(\s*NULLIF\(raw->>'path',\s*''\),\s*NULLIF\(raw->>'page_path',\s*''\)\s*\)\s+AS\s+route_path/,
    );
  });

  it('establishes landing/last from semantic page_view events only (event_name unknown/empty falls back to legacy_event_type)', () => {
    expect(EXTRACTION_SQL).toMatch(
      /WHERE\s+COALESCE\(NULLIF\(NULLIF\(raw->>'event_name',\s*''\),\s*'unknown'\),\s*raw->>'legacy_event_type'\)\s*=\s*'page_view'/,
    );
  });

  it('does NOT use session_start / session_summary to set landing/last (page-view CTE only)', () => {
    // The only route_path derivation is inside page_view_events / page_endpoints.
    expect(EXTRACTION_SQL).toMatch(/page_view_events AS \(/);
    expect(EXTRACTION_SQL).toMatch(/page_endpoints AS \(/);
    // landing/last page_path selected from page_endpoints (pep), never from the
    // all-events endpoints (ep) CTE.
    expect(EXTRACTION_SQL).toMatch(/pep\.landing_page_path/);
    expect(EXTRACTION_SQL).toMatch(/pep\.last_page_path/);
    // The all-events endpoints alias `ep.` must NOT supply landing/last paths
    // (word boundary so this does not match the `pep.` page-endpoints alias).
    expect(EXTRACTION_SQL).not.toMatch(/\bep\.landing_page_path/);
    expect(EXTRACTION_SQL).not.toMatch(/\bep\.last_page_path/);
  });

  it('ranks page views by received_at with event_id tie-break (ascending landing, descending last)', () => {
    const pv = EXTRACTION_SQL.match(/page_ranked AS \([\s\S]*?\n\),/);
    expect(pv).not.toBeNull();
    expect(pv![0]).toMatch(/ORDER BY\s+received_at ASC,\s+event_id ASC/);
    expect(pv![0]).toMatch(/ORDER BY\s+received_at DESC,\s+event_id DESC/);
  });

  it('deferred (NOT broadened): aggregate page_view_count still counts raw.event_name = page_view, unchanged', () => {
    expect(EXTRACTION_SQL).toMatch(/FILTER \(WHERE raw->>'event_name' = 'page_view'\)\)::int\s+AS page_view_count/);
  });

  it('still upserts the same v0.1 natural key (no new extraction version introduced)', () => {
    expect(EXTRACTION_SQL).toMatch(
      /ON\s+CONFLICT\s*\(\s*workspace_id\s*,\s*site_id\s*,\s*session_id\s*,\s*extraction_version\s*\)\s+DO\s+UPDATE/,
    );
  });
});

/* --------------------------------------------------------------------------
 * Remediation — exact-session query-time scope in EXTRACTION_SQL
 * ------------------------------------------------------------------------ */

describe('remediation EXTRACTION_SQL — exact-session predicates (query-time)', () => {
  it('candidate_sessions constrains session_id ($6) and explicit event IDs ($7)', () => {
    const cs = EXTRACTION_SQL.match(/candidate_sessions AS \([\s\S]*?\n\),/);
    expect(cs).not.toBeNull();
    expect(cs![0]).toMatch(/\(\$6::text IS NULL OR session_id\s*=\s*\$6\)/);
    expect(cs![0]).toMatch(/\(\$7::bigint\[\] IS NULL OR event_id\s*=\s*ANY\(\$7\)\)/);
  });

  it('session_events also constrains session_id ($6) and event IDs ($7) — no unrelated session leaks in', () => {
    const se = EXTRACTION_SQL.match(/session_events AS \([\s\S]*?\n\),\nranked AS/);
    expect(se).not.toBeNull();
    expect(se![0]).toMatch(/\(\$6::text IS NULL OR ae\.session_id\s*=\s*\$6\)/);
    expect(se![0]).toMatch(/\(\$7::bigint\[\] IS NULL OR ae\.event_id\s*=\s*ANY\(\$7\)\)/);
  });

  it('EXACT_VERIFY_SQL reads accepted_events by event_id ANY only (membership proven in code)', () => {
    expect(EXACT_VERIFY_SQL).toMatch(/FROM accepted_events/);
    expect(EXACT_VERIFY_SQL).toMatch(/event_id\s*=\s*ANY\(\$1::bigint\[\]\)/);
  });
});

/* --------------------------------------------------------------------------
 * Remediation — exact-mode env parsing (fail-closed)
 * ------------------------------------------------------------------------ */

const EX_ENV = {
  WORKSPACE_ID: 'buyerrecon_staging_ws',
  SITE_ID: 'buyerrecon_com',
  SESSION_ID: 'ses_x0vrbqik',
  EVENT_IDS: '51,52,53,54,55,56,57,58,59',
  EXPECTED_EVENT_COUNT: '9',
} as const;

describe('remediation parseOptionsFromEnv — exact mode fail-closed', () => {
  const NOW = new Date('2026-07-24T16:00:00.000Z');

  it('parses a complete exact-mode config', () => {
    const o = parseOptionsFromEnv({ ...EX_ENV } as NodeJS.ProcessEnv, NOW);
    expect(o.session_id).toBe('ses_x0vrbqik');
    expect(o.event_ids).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59]);
    expect(o.expected_event_count).toBe(9);
    expect(o.extraction_version).toBe('session-features-v0.1');
  });

  it('legacy mode leaves exact fields null', () => {
    const o = parseOptionsFromEnv({ WORKSPACE_ID: 'ws', SITE_ID: 'st' } as NodeJS.ProcessEnv, NOW);
    expect(o.session_id ?? null).toBeNull();
    expect(o.event_ids ?? null).toBeNull();
    expect(o.expected_event_count ?? null).toBeNull();
  });

  it('rejects partial exact config (SESSION_ID without EVENT_IDS/EXPECTED_EVENT_COUNT)', () => {
    expect(() => parseOptionsFromEnv({ WORKSPACE_ID: 'ws', SITE_ID: 'st', SESSION_ID: 'ses_x' } as NodeJS.ProcessEnv, NOW))
      .toThrow(/exact mode requires all of SESSION_ID, EVENT_IDS and EXPECTED_EVENT_COUNT/);
  });

  it('exact mode requires non-empty WORKSPACE_ID and SITE_ID', () => {
    expect(() => parseOptionsFromEnv({ ...EX_ENV, WORKSPACE_ID: '' } as NodeJS.ProcessEnv, NOW))
      .toThrow(/exact mode requires non-empty WORKSPACE_ID and SITE_ID/);
  });

  it('rejects empty SESSION_ID', () => {
    expect(() => parseOptionsFromEnv({ ...EX_ENV, SESSION_ID: '   ' } as NodeJS.ProcessEnv, NOW))
      .toThrow(/SESSION_ID must be a non-empty string/);
  });

  it('rejects malformed EVENT_IDS', () => {
    expect(() => parseOptionsFromEnv({ ...EX_ENV, EVENT_IDS: '51,foo,53' } as NodeJS.ProcessEnv, NOW))
      .toThrow(/EVENT_IDS contains a malformed id/);
  });

  it('rejects duplicate EVENT_IDS', () => {
    expect(() => parseOptionsFromEnv({ ...EX_ENV, EVENT_IDS: '51,51,52', EXPECTED_EVENT_COUNT: '3' } as NodeJS.ProcessEnv, NOW))
      .toThrow(/EVENT_IDS must not contain duplicates/);
  });

  it('rejects EVENT_IDS length != EXPECTED_EVENT_COUNT', () => {
    expect(() => parseOptionsFromEnv({ ...EX_ENV, EXPECTED_EVENT_COUNT: '8' } as NodeJS.ProcessEnv, NOW))
      .toThrow(/must equal EXPECTED_EVENT_COUNT/);
  });

  it('rejects non-positive EXPECTED_EVENT_COUNT', () => {
    expect(() => parseOptionsFromEnv({ ...EX_ENV, EVENT_IDS: '51', EXPECTED_EVENT_COUNT: '0' } as NodeJS.ProcessEnv, NOW))
      .toThrow(/EXPECTED_EVENT_COUNT must be a positive integer/);
  });
});

/* --------------------------------------------------------------------------
 * Remediation — assertExactEventSet (browser4 shape + mismatch fail-closed)
 * ------------------------------------------------------------------------ */

function exactOpts(over: Partial<ExtractorOptions> = {}): ExtractorOptions {
  return {
    workspace_id: 'buyerrecon_staging_ws',
    site_id: 'buyerrecon_com',
    window_start: new Date('2026-07-24T14:59:39.000Z'),
    window_end: new Date('2026-07-24T14:59:52.000Z'),
    extraction_version: 'session-features-v0.1',
    session_id: 'ses_x0vrbqik',
    event_ids: [51, 52, 53, 54, 55, 56, 57, 58, 59],
    expected_event_count: 9,
    ...over,
  };
}

function browser4Rows(): ExactVerifyRow[] {
  return [51, 52, 53, 54, 55, 56, 57, 58, 59].map((id) => ({
    event_id: id,
    client_event_id: `cid-${id}`,
    workspace_id: 'buyerrecon_staging_ws',
    site_id: 'buyerrecon_com',
    session_id: 'ses_x0vrbqik',
    consent_state: 'granted',
  }));
}

describe('remediation assertExactEventSet — fail-closed guard', () => {
  it('accepts the exact browser4 event set (9, granted, one session)', () => {
    expect(() => assertExactEventSet(browser4Rows(), exactOpts())).not.toThrow();
  });

  it('rejects event-count mismatch (8 of 9 present)', () => {
    expect(() => assertExactEventSet(browser4Rows().slice(0, 8), exactOpts()))
      .toThrow(/selected event count 8 != EXPECTED_EVENT_COUNT 9/);
  });

  it('rejects a foreign event-id in the selection (set mismatch)', () => {
    const rows = browser4Rows();
    rows[8] = { ...rows[8], event_id: 999 };
    expect(() => assertExactEventSet(rows, exactOpts())).toThrow(/expected event_id 59 not selected/);
  });

  it('rejects an event belonging to another workspace', () => {
    const rows = browser4Rows();
    rows[0] = { ...rows[0], workspace_id: 'other_ws' };
    expect(() => assertExactEventSet(rows, exactOpts())).toThrow(/workspace_id mismatch/);
  });

  it('rejects an event belonging to another session (more than one session)', () => {
    const rows = browser4Rows();
    rows[4] = { ...rows[4], session_id: 'ses_other' };
    expect(() => assertExactEventSet(rows, exactOpts())).toThrow(/session_id mismatch/);
  });

  it('rejects a non-granted-consent event', () => {
    const rows = browser4Rows();
    rows[3] = { ...rows[3], consent_state: 'pending' };
    expect(() => assertExactEventSet(rows, exactOpts())).toThrow(/consent_state is not granted/);
  });

  it('rejects duplicate client_event_id', () => {
    const rows = browser4Rows();
    rows[1] = { ...rows[1], client_event_id: 'cid-51' };
    expect(() => assertExactEventSet(rows, exactOpts())).toThrow(/duplicate client_event_id/);
  });
});

/* --------------------------------------------------------------------------
 * Remediation — runExtraction exact mode runs the guard BEFORE the upsert
 * ------------------------------------------------------------------------ */

describe('remediation runExtraction — exact mode order + params', () => {
  function makeRoutingPool(verifyRows: ExactVerifyRow[]) {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    return {
      calls,
      query: async (text: string, values: unknown[]) => {
        calls.push({ text, values });
        if (text === EXACT_VERIFY_SQL) return { rowCount: verifyRows.length, rows: verifyRows };
        return { rowCount: 1, rows: [{ session_features_id: '1' }] };
      },
    };
  }

  it('exact mode: verify runs first, then the upsert; params include session_id ($6) + event_ids ($7)', async () => {
    const pool = makeRoutingPool(browser4Rows());
    await runExtraction(pool as never, exactOpts());
    expect(pool.calls).toHaveLength(2);
    expect(pool.calls[0].text).toBe(EXACT_VERIFY_SQL);
    expect(pool.calls[0].values).toEqual([[51, 52, 53, 54, 55, 56, 57, 58, 59]]);
    expect(pool.calls[1].text).toBe(EXTRACTION_SQL);
    expect(pool.calls[1].values[5]).toBe('ses_x0vrbqik');
    expect(pool.calls[1].values[6]).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59]);
  });

  it('exact mode: guard mismatch throws and the upsert is NEVER issued', async () => {
    const pool = makeRoutingPool(browser4Rows().slice(0, 8)); // only 8 present
    await expect(runExtraction(pool as never, exactOpts())).rejects.toThrow(/selected event count 8/);
    // Only the verify query ran; no upsert.
    expect(pool.calls).toHaveLength(1);
    expect(pool.calls[0].text).toBe(EXACT_VERIFY_SQL);
  });
});
