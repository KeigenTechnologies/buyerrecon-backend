/**
 * Sprint 1 PR#7 — persistence (transaction writer) tests.
 *
 * Uses a hand-rolled fake pg pool that records every query call. No real DB.
 * Real-DB reconciliation is PR#8's responsibility.
 */

import { describe, it, expect } from 'vitest';
import {
  writeOrchestratorOutput,
  touchTokenLastUsedAt,
} from '../../src/collector/v1/persistence.js';
import type {
  AcceptedEventRow,
  IngestRequestRow,
  OrchestratorOutput,
  RejectedEventRow,
} from '../../src/collector/v1/types.js';

/* --------------------------------------------------------------------------
 * Fake pg pool + client
 * ------------------------------------------------------------------------ */

interface QueryCall {
  text: string;
  values?: unknown[];
}

interface FakeClientOptions {
  /** Optional rowCount override for accepted INSERTs (default 1). */
  acceptedRowCount?: number;
  /** Optional throw on Nth ACCEPTED insert (1-indexed). */
  throwOnAcceptedInsert?: { atIndex: number; err: unknown };
  /** Optional throw on Nth REJECTED insert. */
  throwOnRejectedInsert?: { atIndex: number; err: unknown };
  /** Optional throw on INGEST INSERT. */
  throwOnIngestInsert?: unknown;
  /** Optional throw on the final UPDATE ingest_requests statement. */
  throwOnIngestUpdate?: unknown;
  /** Optional throw on the ROLLBACK statement itself (Blocker 2 stress test). */
  throwOnRollback?: unknown;
}

class FakeClient {
  public calls: QueryCall[] = [];
  private acceptedInsertSeen = 0;
  private rejectedInsertSeen = 0;
  constructor(public readonly opts: FakeClientOptions = {}) {}

  async query(text: string, values?: unknown[]): Promise<{ rowCount: number; rows: unknown[] }> {
    this.calls.push({ text, values });
    const head = text.split('\n')[0].trim();
    if (head.startsWith('BEGIN')) return { rowCount: 0, rows: [] };
    if (head.startsWith('COMMIT')) return { rowCount: 0, rows: [] };
    if (head.startsWith('ROLLBACK')) {
      if (this.opts.throwOnRollback !== undefined) {
        throw this.opts.throwOnRollback;
      }
      return { rowCount: 0, rows: [] };
    }
    if (head.startsWith('INSERT INTO ingest_requests')) {
      if (this.opts.throwOnIngestInsert !== undefined) {
        throw this.opts.throwOnIngestInsert;
      }
      return { rowCount: 1, rows: [] };
    }
    if (head.startsWith('INSERT INTO accepted_events')) {
      this.acceptedInsertSeen += 1;
      if (
        this.opts.throwOnAcceptedInsert !== undefined &&
        this.opts.throwOnAcceptedInsert.atIndex === this.acceptedInsertSeen
      ) {
        throw this.opts.throwOnAcceptedInsert.err;
      }
      return {
        rowCount: this.opts.acceptedRowCount ?? 1,
        rows: [{ event_id: 100 + this.acceptedInsertSeen }],
      };
    }
    if (head.startsWith('INSERT INTO rejected_events')) {
      this.rejectedInsertSeen += 1;
      if (
        this.opts.throwOnRejectedInsert !== undefined &&
        this.opts.throwOnRejectedInsert.atIndex === this.rejectedInsertSeen
      ) {
        throw this.opts.throwOnRejectedInsert.err;
      }
      return { rowCount: 1, rows: [] };
    }
    if (head.startsWith('UPDATE ingest_requests')) {
      if (this.opts.throwOnIngestUpdate !== undefined) {
        throw this.opts.throwOnIngestUpdate;
      }
      return { rowCount: 1, rows: [] };
    }
    if (head.startsWith('UPDATE site_write_tokens')) return { rowCount: 1, rows: [] };
    return { rowCount: 0, rows: [] };
  }

  release(): void {
    /* no-op */
  }
}

class FakePool {
  public clients: FakeClient[] = [];
  public queryCalls: QueryCall[] = [];
  constructor(public readonly opts: FakeClientOptions = {}) {}

  async connect(): Promise<FakeClient> {
    const c = new FakeClient(this.opts);
    this.clients.push(c);
    return c;
  }

  async query(text: string, values?: unknown[]): Promise<{ rowCount: number; rows: unknown[] }> {
    this.queryCalls.push({ text, values });
    return { rowCount: 1, rows: [] };
  }
}

/* --------------------------------------------------------------------------
 * Fixture builders
 * ------------------------------------------------------------------------ */

const NOW = new Date('2026-05-11T12:00:00.000Z');
const REQ_ID = '00000000-0000-4000-8000-000000000abc';

function ingestRow(overrides: Partial<IngestRequestRow> = {}): IngestRequestRow {
  return {
    request_id: REQ_ID,
    received_at: NOW,
    workspace_id: 'w-1',
    site_id: 's-1',
    endpoint: '/v1/event',
    http_status: 200,
    size_bytes: 50,
    user_agent: 'TestSDK/1.0',
    ip_hash: 'abc'.repeat(21).slice(0, 64),
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

function acceptedRow(overrides: Partial<AcceptedEventRow> = {}): AcceptedEventRow {
  return {
    site_id: 's-1',
    hostname: 'host.example',
    event_type: 'page_view',
    session_id: 'sess-1',
    browser_id: 'br-1',
    client_timestamp_ms: 1746000000000,
    received_at: NOW,
    raw: { client_event_id: 'cev-1', event_type: 'page_view', event_name: 'view' },
    collector_version: '1.0.0',
    client_event_id: 'cev-1',
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
    payload_sha256: 'b'.repeat(64),
    size_bytes: 100,
    ip_hash: 'c'.repeat(64),
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
    ...overrides,
  };
}

function rejectedRow(overrides: Partial<RejectedEventRow> = {}): RejectedEventRow {
  return {
    site_id: 's-1',
    raw: { malformed: true },
    reason_codes: ['missing_required_field'],
    received_at: NOW,
    collector_version: '1.0.0',
    request_id: REQ_ID,
    workspace_id: 'w-1',
    client_event_id: null,
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
    ...overrides,
  };
}

function output(args: {
  accepted?: AcceptedEventRow[];
  rejected?: RejectedEventRow[];
  http_status?: number;
}): OrchestratorOutput {
  const accepted = args.accepted ?? [];
  const rejected = args.rejected ?? [];
  return {
    ingest_request: ingestRow({
      expected_event_count: accepted.length + rejected.length,
      accepted_count: accepted.length,
      rejected_count: rejected.length,
      http_status: args.http_status ?? 200,
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
    http_status: args.http_status ?? 200,
  };
}

/* --------------------------------------------------------------------------
 * Tests — happy path transaction order
 * ------------------------------------------------------------------------ */

describe('writeOrchestratorOutput — happy path', () => {
  it('BEGIN → INSERT ingest → INSERT accepted → INSERT rejected → UPDATE ingest → COMMIT', async () => {
    const pool = new FakePool();
    const out = output({ accepted: [acceptedRow()], rejected: [rejectedRow()] });

    const result = await writeOrchestratorOutput(pool as never, out);

    expect(pool.clients).toHaveLength(1);
    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads[0]).toMatch(/^BEGIN$/);
    expect(heads[1]).toMatch(/^INSERT INTO ingest_requests/);
    expect(heads[2]).toMatch(/^INSERT INTO accepted_events/);
    expect(heads[3]).toMatch(/^INSERT INTO rejected_events/);
    expect(heads[4]).toMatch(/^UPDATE ingest_requests$/);
    expect(heads[5]).toMatch(/^COMMIT$/);

    expect(result.accepted_written).toBe(1);
    expect(result.rejected_written).toBe(1);
    expect(result.dedupe_reclassified).toBe(0);
    expect(result.final_http_status).toBe(200);
  });

  it('request-level reject inserts ingest only (no accepted/rejected inserts)', async () => {
    const pool = new FakePool();
    const out = output({ accepted: [], rejected: [], http_status: 401 });

    await writeOrchestratorOutput(pool as never, out);

    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads.filter((h) => h.startsWith('INSERT INTO accepted_events'))).toHaveLength(0);
    expect(heads.filter((h) => h.startsWith('INSERT INTO rejected_events'))).toHaveLength(0);
    expect(heads.filter((h) => h.startsWith('INSERT INTO ingest_requests'))).toHaveLength(1);
  });

  it('inserts all accepted rows in order', async () => {
    const pool = new FakePool();
    const a1 = acceptedRow({ client_event_id: 'cev-1' });
    const a2 = acceptedRow({ client_event_id: 'cev-2' });
    const a3 = acceptedRow({ client_event_id: 'cev-3' });

    await writeOrchestratorOutput(pool as never, output({ accepted: [a1, a2, a3] }));

    const acceptedCalls = pool.clients[0].calls.filter((c) =>
      c.text.trim().startsWith('INSERT INTO accepted_events'),
    );
    expect(acceptedCalls).toHaveLength(3);
    // client_event_id is param $10 in the accepted-row builder.
    expect(acceptedCalls[0].values?.[9]).toBe('cev-1');
    expect(acceptedCalls[1].values?.[9]).toBe('cev-2');
    expect(acceptedCalls[2].values?.[9]).toBe('cev-3');
  });

  it('zero accepted and zero rejected handled (only ingest + update + commit)', async () => {
    const pool = new FakePool();
    await writeOrchestratorOutput(pool as never, output({}));
    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    // Use prefix matching because the SQL constants carry a trailing "(" on
    // the INSERT/UPDATE header line after the multi-line column list.
    expect(heads).toHaveLength(4);
    expect(heads[0]).toMatch(/^BEGIN$/);
    expect(heads[1]).toMatch(/^INSERT INTO ingest_requests/);
    expect(heads[2]).toMatch(/^UPDATE ingest_requests/);
    expect(heads[3]).toMatch(/^COMMIT$/);
  });

  it('final UPDATE ingest_requests carries actual final counts and reconciled_at', async () => {
    const pool = new FakePool();
    const out = output({
      accepted: [acceptedRow({ client_event_id: 'a' }), acceptedRow({ client_event_id: 'b' })],
      rejected: [rejectedRow()],
    });

    await writeOrchestratorOutput(pool as never, out);

    const updateCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('UPDATE ingest_requests'),
    );
    expect(updateCall).toBeDefined();
    // params: [accepted_count, rejected_count, reconciled_at, http_status, request_id]
    expect(updateCall!.values?.[0]).toBe(2);
    expect(updateCall!.values?.[1]).toBe(1);
    expect(updateCall!.values?.[2]).toEqual(NOW);
    expect(updateCall!.values?.[3]).toBe(200);
    expect(updateCall!.values?.[4]).toBe(REQ_ID);
  });

  it('client is acquired exactly once via pool.connect()', async () => {
    const pool = new FakePool();
    await writeOrchestratorOutput(pool as never, output({ accepted: [acceptedRow()] }));
    expect(pool.clients).toHaveLength(1);
  });
});

/* --------------------------------------------------------------------------
 * Tests — pg parameter shapes (JSONB / Date / arrays)
 * ------------------------------------------------------------------------ */

describe('writeOrchestratorOutput — pg parameter shapes', () => {
  it('JSONB params on ingest insert are NOT pre-stringified (no JSONB on ingest_requests, this is a control test)', async () => {
    // ingest_requests has no JSONB columns. The check is structural —
    // params are an array, not a stringified blob.
    const pool = new FakePool();
    await writeOrchestratorOutput(pool as never, output({}));
    const ingestCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO ingest_requests'),
    );
    expect(Array.isArray(ingestCall!.values)).toBe(true);
  });

  it('accepted JSONB params (raw, canonical_jsonb) are JS objects, not strings', async () => {
    const pool = new FakePool();
    const a = acceptedRow();
    await writeOrchestratorOutput(pool as never, output({ accepted: [a] }));
    const acceptedCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO accepted_events'),
    );
    // raw is param $8, canonical_jsonb is param $35.
    expect(typeof acceptedCall!.values?.[7]).toBe('object');
    expect(typeof acceptedCall!.values?.[34]).toBe('object');
    expect(typeof acceptedCall!.values?.[7]).not.toBe('string');
    expect(typeof acceptedCall!.values?.[34]).not.toBe('string');
  });

  it('accepted Date params are Date instances', async () => {
    const pool = new FakePool();
    const a = acceptedRow();
    await writeOrchestratorOutput(pool as never, output({ accepted: [a] }));
    const acceptedCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO accepted_events'),
    );
    // received_at is param $7 in the accepted-row builder.
    expect(acceptedCall!.values?.[6]).toBeInstanceOf(Date);
  });

  it('rejected reason_codes param is a JS array, not a string', async () => {
    const pool = new FakePool();
    await writeOrchestratorOutput(
      pool as never,
      output({ rejected: [rejectedRow({ reason_codes: ['missing_required_field'] })] }),
    );
    const rejectedCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO rejected_events'),
    );
    // reason_codes is param $3.
    expect(Array.isArray(rejectedCall!.values?.[2])).toBe(true);
    expect(rejectedCall!.values?.[2]).toEqual(['missing_required_field']);
  });

  it('rejected raw param is a JSON text that parses back to the original raw; schema_errors_jsonb and pii_hits_jsonb remain JS objects', async () => {
    // Post-PR#8 patch A: rejected_events.raw is sent as JSON text with a
    // $2::jsonb cast in the SQL. PR#5c-2 Option A allows primitive / null /
    // array / string raw fragments; pg's default prepareValue would fail in
    // real Postgres for null (NOT NULL violation), arrays (PG array literal),
    // and bare strings (invalid JSON syntax). schema_errors_jsonb and
    // pii_hits_jsonb are always plain Record<string, unknown> | null from
    // row-builders, so they continue to pass as JS objects.
    const pool = new FakePool();
    await writeOrchestratorOutput(
      pool as never,
      output({
        rejected: [
          rejectedRow({
            schema_errors_jsonb: { errors: ['bad'] },
            pii_hits_jsonb: { hits: 1 },
          }),
        ],
      }),
    );
    const rejectedCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO rejected_events'),
    );
    // raw=$2 is now a JSON text. Parses back to the original raw value.
    expect(typeof rejectedCall!.values?.[1]).toBe('string');
    expect(JSON.parse(rejectedCall!.values?.[1] as string)).toEqual({ malformed: true });
    // schema_errors_jsonb=$17 and pii_hits_jsonb=$18 remain JS objects.
    expect(typeof rejectedCall!.values?.[16]).toBe('object');
    expect(typeof rejectedCall!.values?.[17]).toBe('object');
  });

  it('rejected raw param produces valid JSON text for primitive / null / array / string / object (Option A coverage)', async () => {
    // Each input is what PR#5c-2 Option A may pass through as raw on non-object
    // /v1/batch fragments. The persistence layer must encode each as valid
    // JSON text so pg can cast to JSONB. The corresponding $2::jsonb cast in
    // the SQL is asserted by index by the heads-shape test elsewhere.
    const cases: Array<{ raw: unknown; parsesBackTo: unknown }> = [
      { raw: 42, parsesBackTo: 42 },
      { raw: null, parsesBackTo: null },
      { raw: [1, 2, 3], parsesBackTo: [1, 2, 3] },
      { raw: 'oops', parsesBackTo: 'oops' },
      { raw: { ok: 1 }, parsesBackTo: { ok: 1 } },
    ];

    for (const { raw, parsesBackTo } of cases) {
      const pool = new FakePool();
      await writeOrchestratorOutput(pool as never, output({ rejected: [rejectedRow({ raw })] }));
      const rejectedCall = pool.clients[0].calls.find((c) =>
        c.text.trim().startsWith('INSERT INTO rejected_events'),
      );
      const rawParam = rejectedCall!.values?.[1];
      expect(typeof rawParam).toBe('string');
      // Each encoded value is valid JSON and parses back to the input.
      expect(() => JSON.parse(rawParam as string)).not.toThrow();
      expect(JSON.parse(rawParam as string)).toEqual(parsesBackTo);
    }
  });

  it('rejected_events INSERT SQL casts $2 to ::jsonb so pg can accept JSON text input for primitive/null/array', async () => {
    const pool = new FakePool();
    await writeOrchestratorOutput(pool as never, output({ rejected: [rejectedRow()] }));
    const rejectedCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO rejected_events'),
    );
    // The SQL must cast $2 to jsonb. Without the cast, pg sends raw $2 as
    // text and PG cannot insert text into a JSONB NOT NULL column (verified
    // against real Postgres in the PR#8 DB suite).
    expect(rejectedCall!.text).toMatch(/\$2::jsonb/);
  });

  it('rejected_at is a Date instance', async () => {
    const pool = new FakePool();
    await writeOrchestratorOutput(pool as never, output({ rejected: [rejectedRow()] }));
    const rejectedCall = pool.clients[0].calls.find((c) =>
      c.text.trim().startsWith('INSERT INTO rejected_events'),
    );
    // rejected_at is param $23.
    expect(rejectedCall!.values?.[22]).toBeInstanceOf(Date);
  });
});

/* --------------------------------------------------------------------------
 * Tests — rollback paths
 * ------------------------------------------------------------------------ */

describe('writeOrchestratorOutput — rollback paths', () => {
  it('non-23505 error on accepted insert → ROLLBACK + rethrow, no COMMIT', async () => {
    const err = new Error('synthetic non-conflict failure');
    const pool = new FakePool({ throwOnAcceptedInsert: { atIndex: 1, err } });

    await expect(
      writeOrchestratorOutput(pool as never, output({ accepted: [acceptedRow()] })),
    ).rejects.toThrow(/synthetic non-conflict failure/);

    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads).toContain('ROLLBACK');
    expect(heads).not.toContain('COMMIT');
  });

  it('non-23505 error on rejected insert → ROLLBACK + rethrow', async () => {
    const err = new Error('synthetic rejected failure');
    const pool = new FakePool({ throwOnRejectedInsert: { atIndex: 1, err } });

    await expect(
      writeOrchestratorOutput(
        pool as never,
        output({ accepted: [acceptedRow()], rejected: [rejectedRow()] }),
      ),
    ).rejects.toThrow(/synthetic rejected failure/);

    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads).toContain('ROLLBACK');
    expect(heads).not.toContain('COMMIT');
  });

  it('Blocker 2 — ingest_requests INSERT failure → ROLLBACK + rethrow, client released, no COMMIT', async () => {
    const err = new Error('synthetic ingest failure');
    const pool = new FakePool({ throwOnIngestInsert: err });
    const releaseSpy: number[] = [];
    const origConnect = pool.connect.bind(pool);
    pool.connect = async () => {
      const c = await origConnect();
      const origRelease = c.release.bind(c);
      c.release = () => {
        releaseSpy.push(1);
        origRelease();
      };
      return c;
    };

    await expect(
      writeOrchestratorOutput(pool as never, output({ accepted: [acceptedRow()] })),
    ).rejects.toThrow(/synthetic ingest failure/);

    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads.filter((h) => h.startsWith('INSERT INTO accepted_events'))).toHaveLength(0);
    expect(heads).toContain('ROLLBACK');
    expect(heads).not.toContain('COMMIT');
    expect(releaseSpy).toEqual([1]);
  });

  it('Blocker 2 — final UPDATE ingest_requests failure → ROLLBACK + rethrow, client released, no COMMIT', async () => {
    const err = new Error('synthetic final-update failure');
    const pool = new FakePool({ throwOnIngestUpdate: err });
    const releaseSpy: number[] = [];
    const origConnect = pool.connect.bind(pool);
    pool.connect = async () => {
      const c = await origConnect();
      const origRelease = c.release.bind(c);
      c.release = () => {
        releaseSpy.push(1);
        origRelease();
      };
      return c;
    };

    await expect(
      writeOrchestratorOutput(
        pool as never,
        output({ accepted: [acceptedRow()], rejected: [rejectedRow()] }),
      ),
    ).rejects.toThrow(/synthetic final-update failure/);

    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    // Accepted + rejected inserts had already succeeded before the failing UPDATE.
    expect(heads.filter((h) => h.startsWith('INSERT INTO accepted_events'))).toHaveLength(1);
    expect(heads.filter((h) => h.startsWith('INSERT INTO rejected_events'))).toHaveLength(1);
    expect(heads).toContain('ROLLBACK');
    expect(heads).not.toContain('COMMIT');
    expect(releaseSpy).toEqual([1]);
  });

  it('Blocker 2 — ROLLBACK itself failing does NOT mask the original error (and client still releases)', async () => {
    const originalErr = new Error('synthetic original-cause');
    const pool = new FakePool({
      throwOnIngestInsert: originalErr,
      throwOnRollback: new Error('synthetic rollback failure'),
    });
    const releaseSpy: number[] = [];
    const origConnect = pool.connect.bind(pool);
    pool.connect = async () => {
      const c = await origConnect();
      const origRelease = c.release.bind(c);
      c.release = () => {
        releaseSpy.push(1);
        origRelease();
      };
      return c;
    };

    await expect(
      writeOrchestratorOutput(pool as never, output({ accepted: [acceptedRow()] })),
    ).rejects.toThrow(/synthetic original-cause/);
    expect(releaseSpy).toEqual([1]);
  });

  it('Blocker 2 — exactly ONE ROLLBACK is issued on accepted insert failure (no double-rollback)', async () => {
    const pool = new FakePool({
      throwOnAcceptedInsert: { atIndex: 1, err: new Error('boom') },
    });
    await expect(
      writeOrchestratorOutput(pool as never, output({ accepted: [acceptedRow()] })),
    ).rejects.toThrow();
    const heads = pool.clients[0].calls.map((c) => c.text.split('\n')[0].trim());
    expect(heads.filter((h) => h === 'ROLLBACK')).toHaveLength(1);
  });

  it('client is released even on rollback', async () => {
    const pool = new FakePool({
      throwOnAcceptedInsert: { atIndex: 1, err: new Error('boom') },
    });
    const releaseSpy: number[] = [];
    const origConnect = pool.connect.bind(pool);
    pool.connect = async () => {
      const c = await origConnect();
      const origRelease = c.release.bind(c);
      c.release = () => {
        releaseSpy.push(1);
        origRelease();
      };
      return c;
    };
    await expect(
      writeOrchestratorOutput(pool as never, output({ accepted: [acceptedRow()] })),
    ).rejects.toThrow();
    expect(releaseSpy).toEqual([1]);
  });
});

/* --------------------------------------------------------------------------
 * Tests — touchTokenLastUsedAt
 * ------------------------------------------------------------------------ */

describe('touchTokenLastUsedAt', () => {
  it('queries UPDATE site_write_tokens with token_id', async () => {
    const pool = new FakePool();
    await touchTokenLastUsedAt(pool as never, 'tok-id-1');
    expect(pool.queryCalls).toHaveLength(1);
    expect(pool.queryCalls[0].text.split('\n')[0]).toMatch(/UPDATE site_write_tokens/);
    expect(pool.queryCalls[0].values).toEqual(['tok-id-1']);
  });

  it('swallows errors silently (best-effort observability metadata)', async () => {
    const pool = {
      query: async () => {
        throw new Error('synthetic DB failure');
      },
    };
    await expect(touchTokenLastUsedAt(pool as never, 'tok-1')).resolves.toBeUndefined();
  });
});

/* --------------------------------------------------------------------------
 * Tests — final_response shape
 * ------------------------------------------------------------------------ */

describe('writeOrchestratorOutput — final_response', () => {
  it('matches output.response when no conflicts occurred', async () => {
    const pool = new FakePool();
    const a = acceptedRow();
    const r = rejectedRow();
    const out = output({ accepted: [a], rejected: [r] });
    const result = await writeOrchestratorOutput(pool as never, out);

    expect(result.final_response).toEqual({
      request_id: REQ_ID,
      expected_event_count: 2,
      accepted_count: 1,
      rejected_count: 1,
      results: [
        { status: 'accepted', client_event_id: a.client_event_id, reason_code: null },
        { status: 'rejected', client_event_id: r.client_event_id, reason_code: r.reason_code },
      ],
    });
  });

  it('reconciles accepted_count + rejected_count = expected_event_count', async () => {
    const pool = new FakePool();
    const out = output({
      accepted: [acceptedRow(), acceptedRow()],
      rejected: [rejectedRow()],
    });
    const result = await writeOrchestratorOutput(pool as never, out);
    expect(result.final_response.accepted_count + result.final_response.rejected_count).toBe(
      result.final_response.expected_event_count,
    );
  });
});
