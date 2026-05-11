/**
 * Sprint 1 PR#7 — accepted_events_dedup conflict tests.
 *
 * PR#6 ships a partial UNIQUE INDEX on (workspace_id, site_id, client_event_id).
 * The legacy idx_accepted_dedup_client_event index is keyed on
 * (site_id, session_id, client_event_id). Both raise SQLSTATE 23505.
 *
 * PR#7 must:
 *   - silently swallow PR#6 conflicts via ON CONFLICT DO NOTHING (no exception)
 *   - reclassify the accepted candidate as a duplicate_client_event_id rejected row
 *   - catch legacy 23505 via try/catch and reclassify the same way
 *   - ROLLBACK + rethrow for unknown 23505 constraints (defence in depth)
 *   - never let an SDK cross-request retry produce a raw 500
 */

import { describe, it, expect } from 'vitest';
import { writeOrchestratorOutput } from '../../src/collector/v1/persistence.js';
import type {
  AcceptedEventRow,
  IngestRequestRow,
  OrchestratorOutput,
  RejectedEventRow,
} from '../../src/collector/v1/types.js';
import { payloadSha256 } from '../../src/collector/v1/payload-hash.js';

/* --------------------------------------------------------------------------
 * Fake pg pool with per-row conflict programming
 * ------------------------------------------------------------------------ */

interface QueryCall {
  text: string;
  values?: unknown[];
}

interface AcceptedBehaviour {
  /** 'rowCount=0' = PR#6 ON CONFLICT silent swallow. */
  kind: 'insert' | 'rowCount=0' | '23505_new' | '23505_legacy' | '23505_unknown';
}

class FakeClient {
  public calls: QueryCall[] = [];
  private acceptedSeen = 0;
  constructor(public readonly script: AcceptedBehaviour[]) {}

  async query(text: string, values?: unknown[]): Promise<{ rowCount: number; rows: unknown[] }> {
    this.calls.push({ text, values });
    const head = text.split('\n')[0].trim();
    if (head.startsWith('BEGIN') || head.startsWith('COMMIT') || head.startsWith('ROLLBACK')) {
      return { rowCount: 0, rows: [] };
    }
    if (head.startsWith('INSERT INTO ingest_requests')) return { rowCount: 1, rows: [] };
    if (head.startsWith('INSERT INTO accepted_events')) {
      const behaviour = this.script[this.acceptedSeen];
      this.acceptedSeen += 1;
      if (behaviour === undefined) return { rowCount: 1, rows: [{ event_id: 1 }] };
      switch (behaviour.kind) {
        case 'insert':
          return { rowCount: 1, rows: [{ event_id: this.acceptedSeen }] };
        case 'rowCount=0':
          return { rowCount: 0, rows: [] };
        case '23505_new':
          throw Object.assign(new Error('duplicate key'), {
            code: '23505',
            constraint: 'accepted_events_dedup',
          });
        case '23505_legacy':
          throw Object.assign(new Error('duplicate key'), {
            code: '23505',
            constraint: 'idx_accepted_dedup_client_event',
          });
        case '23505_unknown':
          throw Object.assign(new Error('duplicate key'), {
            code: '23505',
            constraint: 'some_other_unique_index',
          });
      }
    }
    if (head.startsWith('INSERT INTO rejected_events')) return { rowCount: 1, rows: [] };
    if (head.startsWith('UPDATE ingest_requests')) return { rowCount: 1, rows: [] };
    return { rowCount: 0, rows: [] };
  }

  release(): void {
    /* no-op */
  }
}

class FakePool {
  public clients: FakeClient[] = [];
  constructor(public readonly script: AcceptedBehaviour[]) {}

  async connect(): Promise<FakeClient> {
    const c = new FakeClient(this.script);
    this.clients.push(c);
    return c;
  }

  async query(): Promise<{ rowCount: number; rows: unknown[] }> {
    return { rowCount: 0, rows: [] };
  }
}

/* --------------------------------------------------------------------------
 * Fixtures (lightly mirrored from persistence.test.ts; intentionally local)
 * ------------------------------------------------------------------------ */

const NOW = new Date('2026-05-11T12:00:00.000Z');
const REQ_ID = '00000000-0000-4000-8000-000000000abc';

function ingestRow(overrides: Partial<IngestRequestRow> = {}): IngestRequestRow {
  return {
    request_id: REQ_ID,
    received_at: NOW,
    workspace_id: 'w-1',
    site_id: 's-1',
    endpoint: '/v1/batch',
    http_status: 200,
    size_bytes: 50,
    user_agent: 'TestSDK/1.0',
    ip_hash: 'h'.repeat(64),
    request_body_sha256: 'a'.repeat(64),
    expected_event_count: 0,
    accepted_count: 0,
    rejected_count: 0,
    reconciled_at: NOW,
    auth_status: 'ok',
    reject_reason_code: null,
    collector_version: '1.0.0',
    ...overrides,
  };
}

function acceptedRow(client_event_id: string): AcceptedEventRow {
  return {
    site_id: 's-1',
    hostname: 'host.example',
    event_type: 'page_view',
    session_id: 'sess-1',
    browser_id: 'br-1',
    client_timestamp_ms: 1746000000000,
    received_at: NOW,
    raw: { client_event_id, event_type: 'page_view' },
    collector_version: '1.0.0',
    client_event_id,
    page_view_id: null,
    previous_page_view_id: null,
    event_sequence_index: 0,
    event_contract_version: 'event-contract-v0.1',
    request_id: REQ_ID,
    workspace_id: 'w-1',
    validator_version: 'buyerrecon-v1-validator-0.1',
    schema_key: 'page_view',
    schema_version: 'thin.v2.0',
    event_origin: 'browser',
    id_format: 'uuidv4',
    traffic_class: 'unknown',
    payload_sha256: 'p'.repeat(64),
    size_bytes: 100,
    ip_hash: 'h'.repeat(64),
    consent_state: null,
    consent_source: null,
    consent_updated_at: null,
    pre_consent_mode: null,
    tracking_mode: null,
    storage_mechanism: null,
    session_seq: null,
    session_started_at: null,
    session_last_seen_at: null,
    canonical_jsonb: { event_type: 'page_view' },
    payload_purged_at: null,
    debug_mode: false,
  };
}

function rejectedRow(client_event_id: string | null = null): RejectedEventRow {
  return {
    site_id: 's-1',
    raw: { malformed: true },
    reason_codes: ['missing_required_field'],
    received_at: NOW,
    collector_version: '1.0.0',
    request_id: REQ_ID,
    workspace_id: 'w-1',
    client_event_id,
    id_format: null,
    event_name: null,
    event_type: null,
    schema_key: null,
    schema_version: null,
    rejected_stage: 'validation',
    reason_code: 'missing_required_field',
    reason_detail: null,
    schema_errors_jsonb: null,
    pii_hits_jsonb: null,
    raw_payload_sha256: 'd'.repeat(64),
    size_bytes: 30,
    debug_mode: false,
    sample_visible_to_admin: true,
    rejected_at: NOW,
  };
}

function output(accepted: AcceptedEventRow[], rejected: RejectedEventRow[] = []): OrchestratorOutput {
  return {
    ingest_request: ingestRow({
      expected_event_count: accepted.length + rejected.length,
      accepted_count: accepted.length,
      rejected_count: rejected.length,
    }),
    accepted,
    rejected,
    response: {
      request_id: REQ_ID,
      expected_event_count: accepted.length + rejected.length,
      accepted_count: accepted.length,
      rejected_count: rejected.length,
      results: [
        ...accepted.map((a) => ({
          status: 'accepted' as const,
          client_event_id: a.client_event_id,
          reason_code: null,
        })),
        ...rejected.map((r) => ({
          status: 'rejected' as const,
          client_event_id: r.client_event_id,
          reason_code: r.reason_code,
        })),
      ],
    },
    http_status: 200,
  };
}

/* --------------------------------------------------------------------------
 * Tests — PR#6 accepted_events_dedup conflict (ON CONFLICT silent swallow)
 * ------------------------------------------------------------------------ */

describe('PR#6 accepted_events_dedup conflict — ON CONFLICT rowCount=0 path', () => {
  it('rowCount=0 reclassifies accepted candidate as duplicate_client_event_id rejected', async () => {
    const pool = new FakePool([{ kind: 'rowCount=0' }]);
    const result = await writeOrchestratorOutput(pool as never, output([acceptedRow('cev-1')]));

    expect(result.dedupe_reclassified).toBe(1);
    expect(result.accepted_written).toBe(0);
    expect(result.rejected_written).toBe(1);
    expect(result.final_response.accepted_count).toBe(0);
    expect(result.final_response.rejected_count).toBe(1);
  });

  it('does NOT throw and does NOT call ROLLBACK on ON CONFLICT', async () => {
    const pool = new FakePool([{ kind: 'rowCount=0' }]);
    await expect(
      writeOrchestratorOutput(pool as never, output([acceptedRow('cev-1')])),
    ).resolves.toBeDefined();
    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads).not.toContain('ROLLBACK');
    expect(heads).toContain('COMMIT');
  });

  it('issues an extra INSERT INTO rejected_events for the reclassified row', async () => {
    const pool = new FakePool([{ kind: 'rowCount=0' }]);
    await writeOrchestratorOutput(pool as never, output([acceptedRow('cev-1')]));
    const rejectedInserts = pool.clients[0].calls.filter((c) =>
      c.text.trim().startsWith('INSERT INTO rejected_events'),
    );
    expect(rejectedInserts).toHaveLength(1);
  });

  it('flips response.results[i] from accepted → rejected/duplicate_client_event_id', async () => {
    const pool = new FakePool([{ kind: 'rowCount=0' }]);
    const result = await writeOrchestratorOutput(
      pool as never,
      output([acceptedRow('cev-flip')]),
    );
    expect(result.final_response.results).toEqual([
      {
        status: 'rejected',
        client_event_id: 'cev-flip',
        reason_code: 'duplicate_client_event_id',
      },
    ]);
  });

  it('reclassified rejected row uses payloadSha256(accepted.raw) for raw_payload_sha256', async () => {
    const pool = new FakePool([{ kind: 'rowCount=0' }]);
    const a = acceptedRow('cev-hash');
    await writeOrchestratorOutput(pool as never, output([a]));
    const rejectedCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO rejected_events'),
    );
    // raw_payload_sha256 is param $19.
    expect(rejectedCall!.values?.[18]).toBe(payloadSha256(a.raw));
    // Crucially NOT the accepted.payload_sha256 (which hashes the normalised envelope).
    expect(rejectedCall!.values?.[18]).not.toBe(a.payload_sha256);
  });

  it('reclassified rejected row uses dedupe stage + duplicate_client_event_id', async () => {
    const pool = new FakePool([{ kind: 'rowCount=0' }]);
    await writeOrchestratorOutput(pool as never, output([acceptedRow('cev-1')]));
    const rejectedCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO rejected_events'),
    );
    // rejected_stage is param $14, reason_code is param $15, reason_codes is $3.
    expect(rejectedCall!.values?.[13]).toBe('dedupe');
    expect(rejectedCall!.values?.[14]).toBe('duplicate_client_event_id');
    expect(rejectedCall!.values?.[2]).toEqual(['duplicate_client_event_id']);
  });

  it('mixed batch: some accepted, some conflict — final counts and results reconcile', async () => {
    const pool = new FakePool([{ kind: 'insert' }, { kind: 'rowCount=0' }, { kind: 'insert' }]);
    const a = [acceptedRow('cev-a'), acceptedRow('cev-b'), acceptedRow('cev-c')];
    const result = await writeOrchestratorOutput(pool as never, output(a));

    expect(result.accepted_written).toBe(2);
    expect(result.rejected_written).toBe(1);
    expect(result.dedupe_reclassified).toBe(1);
    expect(result.final_response.accepted_count + result.final_response.rejected_count).toBe(3);
    expect(result.final_response.results).toEqual([
      { status: 'accepted', client_event_id: 'cev-a', reason_code: null },
      { status: 'rejected', client_event_id: 'cev-b', reason_code: 'duplicate_client_event_id' },
      { status: 'accepted', client_event_id: 'cev-c', reason_code: null },
    ]);
  });
});

/* --------------------------------------------------------------------------
 * Tests — explicit 23505 throws from new index (defence in depth)
 * ------------------------------------------------------------------------ */

describe('PR#6 23505 thrown directly (defence in depth)', () => {
  it('23505 with constraint=accepted_events_dedup → reclassify, no rollback', async () => {
    const pool = new FakePool([{ kind: '23505_new' }]);
    const result = await writeOrchestratorOutput(pool as never, output([acceptedRow('cev-1')]));
    expect(result.dedupe_reclassified).toBe(1);
    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads).not.toContain('ROLLBACK');
    expect(heads).toContain('COMMIT');
  });
});

/* --------------------------------------------------------------------------
 * Tests — legacy idx_accepted_dedup_client_event 23505 path
 * ------------------------------------------------------------------------ */

describe('legacy idx_accepted_dedup_client_event 23505 conflict', () => {
  it('caught via try/catch and reclassified as duplicate_client_event_id', async () => {
    const pool = new FakePool([{ kind: '23505_legacy' }]);
    const result = await writeOrchestratorOutput(
      pool as never,
      output([acceptedRow('cev-legacy')]),
    );
    expect(result.dedupe_reclassified).toBe(1);
    expect(result.final_response.results[0]).toEqual({
      status: 'rejected',
      client_event_id: 'cev-legacy',
      reason_code: 'duplicate_client_event_id',
    });
  });

  it('does NOT rollback and DOES commit', async () => {
    const pool = new FakePool([{ kind: '23505_legacy' }]);
    await writeOrchestratorOutput(pool as never, output([acceptedRow('cev-1')]));
    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads).not.toContain('ROLLBACK');
    expect(heads).toContain('COMMIT');
  });
});

/* --------------------------------------------------------------------------
 * Tests — unknown 23505 → ROLLBACK + rethrow
 * ------------------------------------------------------------------------ */

describe('unknown 23505 constraint', () => {
  it('ROLLBACK + rethrow (never silently swallowed)', async () => {
    const pool = new FakePool([{ kind: '23505_unknown' }]);
    await expect(
      writeOrchestratorOutput(pool as never, output([acceptedRow('cev-1')])),
    ).rejects.toMatchObject({ code: '23505' });
    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads).toContain('ROLLBACK');
    expect(heads).not.toContain('COMMIT');
  });
});

/* --------------------------------------------------------------------------
 * Tests — invariants across all conflict modes
 * ------------------------------------------------------------------------ */

describe('reconciliation invariant after rebucketing', () => {
  it('accepted_count + rejected_count = expected_event_count for every mix', async () => {
    const mixes: AcceptedBehaviour[][] = [
      [{ kind: 'insert' }, { kind: 'insert' }, { kind: 'insert' }],
      [{ kind: 'rowCount=0' }, { kind: 'rowCount=0' }, { kind: 'rowCount=0' }],
      [{ kind: 'insert' }, { kind: 'rowCount=0' }, { kind: 'insert' }],
      [{ kind: '23505_legacy' }, { kind: 'insert' }, { kind: 'rowCount=0' }],
    ];
    for (const script of mixes) {
      const pool = new FakePool(script);
      const a = script.map((_, i) => acceptedRow(`cev-${i}`));
      const result = await writeOrchestratorOutput(pool as never, output(a));
      expect(result.final_response.accepted_count + result.final_response.rejected_count).toBe(
        result.final_response.expected_event_count,
      );
    }
  });

  it('final UPDATE carries the post-rebucketing accepted/rejected counts', async () => {
    const pool = new FakePool([{ kind: 'insert' }, { kind: 'rowCount=0' }]);
    await writeOrchestratorOutput(
      pool as never,
      output([acceptedRow('cev-1'), acceptedRow('cev-2')]),
    );
    const updateCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('UPDATE ingest_requests'),
    );
    expect(updateCall!.values?.[0]).toBe(1); // final accepted
    expect(updateCall!.values?.[1]).toBe(1); // final rejected
  });
});
