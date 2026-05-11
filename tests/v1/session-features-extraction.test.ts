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
  parseOptionsFromEnv,
  runExtraction,
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

  it('passes parameters in the locked order [window_start, window_end, workspace_id, site_id, extraction_version]', async () => {
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
