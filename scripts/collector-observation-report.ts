#!/usr/bin/env tsx
/**
 * Sprint 1 PR#9 — Collector Observation Report (Track B, read-only).
 *
 * Prints a human-readable markdown report over the collector DB for a single
 * (workspace_id, site_id) boundary across a recent window (default 24 hours,
 * override via OBS_WINDOW_HOURS).
 *
 * STRICT READ-ONLY. The script issues no DML and no DDL. It never echoes
 * secrets: DATABASE_URL is masked, token_hash is never SELECTed, IP hashes
 * are never SELECTed, user_agent is omitted by default, peppers are not
 * touched.
 *
 * Inputs (env vars):
 *   DATABASE_URL       — collector Postgres URL (REQUIRED; never printed)
 *   WORKSPACE_ID       — boundary workspace_id (REQUIRED)
 *   SITE_ID            — boundary site_id     (REQUIRED)
 *   OBS_WINDOW_HOURS   — observation window in hours (default 24)
 *
 * Exit codes:
 *   0 — PASS or WATCH
 *   1 — BLOCK, or missing required env, or DB connection failure
 *
 * NOT Track A. NOT Core AMS. NO scoring / bot / AI-agent / risk_score /
 * classification / recommended_action / bot_score / agent_score / is_bot /
 * is_agent / ai_agent surfaces. NO writes. NO schema or migration changes.
 */

import 'dotenv/config';
import pg from 'pg';

/* --------------------------------------------------------------------------
 * Env + arg parsing
 * ------------------------------------------------------------------------ */

const DATABASE_URL = process.env.DATABASE_URL;
const WORKSPACE_ID = process.env.WORKSPACE_ID;
const SITE_ID = process.env.SITE_ID;
const WINDOW_HOURS_RAW = process.env.OBS_WINDOW_HOURS ?? '24';

function fail(msg: string): never {
  console.error(`PR#9 observation report — ${msg}`);
  process.exit(1);
}

if (typeof DATABASE_URL !== 'string' || DATABASE_URL.length === 0) {
  fail('DATABASE_URL is required. Source .env on the operator host before running.');
}
if (typeof WORKSPACE_ID !== 'string' || WORKSPACE_ID.length === 0) {
  fail('WORKSPACE_ID is required. Source the site-token meta env before running.');
}
if (typeof SITE_ID !== 'string' || SITE_ID.length === 0) {
  fail('SITE_ID is required. Source the site-token meta env before running.');
}
const WINDOW_HOURS = Number.parseInt(WINDOW_HOURS_RAW, 10);
if (!Number.isFinite(WINDOW_HOURS) || WINDOW_HOURS <= 0) {
  fail(`OBS_WINDOW_HOURS must be a positive integer (got ${JSON.stringify(WINDOW_HOURS_RAW)})`);
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function maskDatabaseUrl(url: string): string {
  // Show only protocol + host. Userinfo and dbname are masked.
  try {
    const u = new URL(url);
    const host = u.host || '<host>';
    return `${u.protocol}//<user:****>@${host}/<db>`;
  } catch {
    return '<set, masked>';
  }
}

function fmtTs(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return String(v);
}

function asInt(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number.parseInt(v, 10);
  if (typeof v === 'bigint') return Number(v);
  return 0;
}

function pct(part: number, total: number): string {
  if (total === 0) return 'n/a';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function mdTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '_(no rows)_';
  const out: string[] = [];
  out.push(`| ${headers.join(' | ')} |`);
  out.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const r of rows) out.push(`| ${r.join(' | ')} |`);
  return out.join('\n');
}

/* --------------------------------------------------------------------------
 * Read-only DB queries
 * ------------------------------------------------------------------------ */

interface IngestSummary {
  total: number;
  ok_rows: number;
  error_rows: number;
  first_seen: Date | null;
  last_seen: Date | null;
}

interface AcceptedRejectedSummary {
  accepted: number;
  rejected: number;
  rejected_breakdown: Array<{ reason_code: string | null; rejected_stage: string | null; rows: number }>;
}

interface EvidenceQuality {
  ingest_total: number;
  ingest_body_sha_complete: number;
  accepted_total: number;
  accepted_payload_sha_complete: number;
  canonical_present: number;
  canonical_key_19: number;
  canonical_key_not_19: number;
}

interface ReconciliationHealth {
  violations: number;
  ledger_skew: number;
  unreconciled: number;
}

interface SourceRow {
  consent_source: string | null;
  rows: number;
  accepted_count: number;
  first_seen: Date | null;
  last_seen: Date | null;
}

interface PageUrlRow {
  page_url: string | null;
  rows: number;
  first_seen: Date | null;
  last_seen: Date | null;
}

interface EventTypeBreakdownRow {
  event_name: string | null;
  event_type: string;
  schema_key: string | null;
  rows: number;
  first_seen: Date | null;
  last_seen: Date | null;
}

interface LatestAcceptedRow {
  received_at: Date;
  request_id: string;
  client_event_id: string | null;
  page_url: string | null;
  consent_source: string | null;
  event_type: string;
  schema_key: string | null;
  canonical_key_count: number;
}

interface TokenRow {
  token_id: string;
  disabled_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

async function loadIngestSummary(client: pg.Client): Promise<IngestSummary> {
  const r = await client.query(
    `SELECT COUNT(*)::int                                                            AS total,
            COUNT(*) FILTER (WHERE auth_status = 'ok' AND reject_reason_code IS NULL)::int AS ok_rows,
            COUNT(*) FILTER (WHERE auth_status <> 'ok' OR reject_reason_code IS NOT NULL)::int AS error_rows,
            MIN(received_at)                                                          AS first_seen,
            MAX(received_at)                                                          AS last_seen
       FROM ingest_requests
      WHERE workspace_id = $1
        AND site_id      = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  const row = r.rows[0] ?? {};
  return {
    total: asInt(row.total),
    ok_rows: asInt(row.ok_rows),
    error_rows: asInt(row.error_rows),
    first_seen: row.first_seen ?? null,
    last_seen: row.last_seen ?? null,
  };
}

async function loadAcceptedRejectedSummary(client: pg.Client): Promise<AcceptedRejectedSummary> {
  const accepted = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM accepted_events
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  const rejected = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM rejected_events
      WHERE workspace_id = $1 AND site_id IS NOT DISTINCT FROM $2
        AND received_at >= NOW() - make_interval(hours => $3::int)`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  const breakdown = await client.query(
    `SELECT reason_code, rejected_stage, COUNT(*)::int AS rows
       FROM rejected_events
      WHERE workspace_id = $1 AND site_id IS NOT DISTINCT FROM $2
        AND received_at >= NOW() - make_interval(hours => $3::int)
      GROUP BY reason_code, rejected_stage
      ORDER BY rows DESC, reason_code NULLS LAST, rejected_stage NULLS LAST`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  return {
    accepted: asInt(accepted.rows[0]?.c),
    rejected: asInt(rejected.rows[0]?.c),
    rejected_breakdown: breakdown.rows.map((row: Record<string, unknown>) => ({
      reason_code: (row.reason_code as string | null) ?? null,
      rejected_stage: (row.rejected_stage as string | null) ?? null,
      rows: asInt(row.rows),
    })),
  };
}

async function loadEvidenceQuality(client: pg.Client): Promise<EvidenceQuality> {
  const ingest = await client.query(
    `SELECT COUNT(*)::int                                                  AS total,
            COUNT(*) FILTER (WHERE LENGTH(request_body_sha256) = 64)::int  AS body_sha_complete
       FROM ingest_requests
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  const accepted = await client.query(
    `SELECT COUNT(*)::int                                                  AS total,
            COUNT(*) FILTER (WHERE LENGTH(payload_sha256) = 64)::int       AS payload_sha_complete,
            COUNT(*) FILTER (WHERE canonical_jsonb IS NOT NULL)::int       AS canonical_present,
            COUNT(*) FILTER (
              WHERE canonical_jsonb IS NOT NULL
                AND (SELECT COUNT(*)::int FROM jsonb_object_keys(canonical_jsonb)) = 19
            )::int                                                         AS canonical_key_19,
            COUNT(*) FILTER (
              WHERE canonical_jsonb IS NULL
                 OR (SELECT COUNT(*)::int FROM jsonb_object_keys(canonical_jsonb)) <> 19
            )::int                                                         AS canonical_key_not_19
       FROM accepted_events
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  return {
    ingest_total: asInt(ingest.rows[0]?.total),
    ingest_body_sha_complete: asInt(ingest.rows[0]?.body_sha_complete),
    accepted_total: asInt(accepted.rows[0]?.total),
    accepted_payload_sha_complete: asInt(accepted.rows[0]?.payload_sha_complete),
    canonical_present: asInt(accepted.rows[0]?.canonical_present),
    canonical_key_19: asInt(accepted.rows[0]?.canonical_key_19),
    canonical_key_not_19: asInt(accepted.rows[0]?.canonical_key_not_19),
  };
}

async function loadReconciliationHealth(client: pg.Client): Promise<ReconciliationHealth> {
  const violations = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM ingest_requests
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)
        AND reconciled_at IS NOT NULL
        AND accepted_count + rejected_count <> expected_event_count`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  const unreconciled = await client.query(
    `SELECT COUNT(*)::int AS c
       FROM ingest_requests
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)
        AND reconciled_at IS NULL`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  const ledger = await client.query(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT ir.request_id
         FROM ingest_requests ir
         LEFT JOIN (
           SELECT request_id, COUNT(*)::int AS cnt FROM accepted_events
            WHERE workspace_id = $1 AND site_id = $2
            GROUP BY request_id
         ) a ON a.request_id = ir.request_id
         LEFT JOIN (
           SELECT request_id, COUNT(*)::int AS cnt FROM rejected_events
            WHERE workspace_id = $1 AND site_id IS NOT DISTINCT FROM $2
            GROUP BY request_id
         ) r ON r.request_id = ir.request_id
        WHERE ir.workspace_id = $1 AND ir.site_id = $2
          AND ir.received_at >= NOW() - make_interval(hours => $3::int)
          AND (ir.accepted_count <> COALESCE(a.cnt, 0)
               OR ir.rejected_count <> COALESCE(r.cnt, 0))
     ) sk`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  return {
    violations: asInt(violations.rows[0]?.c),
    unreconciled: asInt(unreconciled.rows[0]?.c),
    ledger_skew: asInt(ledger.rows[0]?.c),
  };
}

async function loadSourceBreakdown(client: pg.Client): Promise<SourceRow[]> {
  const r = await client.query(
    `SELECT raw->>'consent_source'    AS consent_source,
            COUNT(*)::int             AS rows,
            COUNT(*)::int             AS accepted_count,
            MIN(received_at)          AS first_seen,
            MAX(received_at)          AS last_seen
       FROM accepted_events
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)
      GROUP BY raw->>'consent_source'
      ORDER BY rows DESC, consent_source NULLS LAST`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  return r.rows.map((row: Record<string, unknown>) => ({
    consent_source: (row.consent_source as string | null) ?? null,
    rows: asInt(row.rows),
    accepted_count: asInt(row.accepted_count),
    first_seen: (row.first_seen as Date | null) ?? null,
    last_seen: (row.last_seen as Date | null) ?? null,
  }));
}

async function loadPageUrlBreakdown(client: pg.Client): Promise<PageUrlRow[]> {
  const r = await client.query(
    `SELECT raw->>'page_url'   AS page_url,
            COUNT(*)::int      AS rows,
            MIN(received_at)   AS first_seen,
            MAX(received_at)   AS last_seen
       FROM accepted_events
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)
      GROUP BY raw->>'page_url'
      ORDER BY rows DESC, page_url NULLS LAST
      LIMIT 25`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  return r.rows.map((row: Record<string, unknown>) => ({
    page_url: (row.page_url as string | null) ?? null,
    rows: asInt(row.rows),
    first_seen: (row.first_seen as Date | null) ?? null,
    last_seen: (row.last_seen as Date | null) ?? null,
  }));
}

async function loadEventTypeBreakdown(client: pg.Client): Promise<EventTypeBreakdownRow[]> {
  // PR#10 — grouped counts by (event_name, event_type, schema_key) over
  // accepted rows in the window. event_name is read from raw->>'event_name'
  // since accepted_events does not have a dedicated event_name column; the
  // accepted_events.event_type column holds the validated event_type.
  // Only grouped counts are emitted — no individual event payload values.
  const r = await client.query(
    `SELECT raw->>'event_name'   AS event_name,
            event_type           AS event_type,
            schema_key           AS schema_key,
            COUNT(*)::int        AS rows,
            MIN(received_at)     AS first_seen,
            MAX(received_at)     AS last_seen
       FROM accepted_events
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)
      GROUP BY raw->>'event_name', event_type, schema_key
      ORDER BY rows DESC, event_name NULLS LAST, event_type, schema_key NULLS LAST
      LIMIT 50`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  return r.rows.map((row: Record<string, unknown>) => ({
    event_name: (row.event_name as string | null) ?? null,
    event_type: row.event_type as string,
    schema_key: (row.schema_key as string | null) ?? null,
    rows: asInt(row.rows),
    first_seen: (row.first_seen as Date | null) ?? null,
    last_seen: (row.last_seen as Date | null) ?? null,
  }));
}

async function loadLatestAccepted(client: pg.Client): Promise<LatestAcceptedRow[]> {
  const r = await client.query(
    `SELECT received_at, request_id, client_event_id,
            raw->>'page_url'        AS page_url,
            raw->>'consent_source'  AS consent_source,
            event_type, schema_key,
            (SELECT COUNT(*)::int FROM jsonb_object_keys(canonical_jsonb)) AS canonical_key_count
       FROM accepted_events
      WHERE workspace_id = $1 AND site_id = $2
        AND received_at >= NOW() - make_interval(hours => $3::int)
      ORDER BY received_at DESC
      LIMIT 10`,
    [WORKSPACE_ID, SITE_ID, WINDOW_HOURS],
  );
  return r.rows.map((row: Record<string, unknown>) => ({
    received_at: row.received_at as Date,
    request_id: row.request_id as string,
    client_event_id: (row.client_event_id as string | null) ?? null,
    page_url: (row.page_url as string | null) ?? null,
    consent_source: (row.consent_source as string | null) ?? null,
    event_type: row.event_type as string,
    schema_key: (row.schema_key as string | null) ?? null,
    canonical_key_count: asInt(row.canonical_key_count),
  }));
}

async function loadTokenHealth(client: pg.Client): Promise<TokenRow[]> {
  // token_hash is NEVER selected. Only public row identifiers + timestamps.
  const r = await client.query(
    `SELECT token_id, disabled_at, last_used_at, created_at
       FROM site_write_tokens
      WHERE workspace_id = $1 AND site_id = $2
      ORDER BY created_at DESC`,
    [WORKSPACE_ID, SITE_ID],
  );
  return r.rows.map((row: Record<string, unknown>) => ({
    token_id: row.token_id as string,
    disabled_at: (row.disabled_at as Date | null) ?? null,
    last_used_at: (row.last_used_at as Date | null) ?? null,
    created_at: row.created_at as Date,
  }));
}

/* --------------------------------------------------------------------------
 * PASS / WATCH / BLOCK decision
 * ------------------------------------------------------------------------ */

type Status = 'PASS' | 'WATCH' | 'BLOCK';

interface Decision {
  status: Status;
  blocks: string[];
  watches: string[];
  recommendation: string;
}

function decide(
  ingest: IngestSummary,
  accRej: AcceptedRejectedSummary,
  evidence: EvidenceQuality,
  recon: ReconciliationHealth,
  tokens: TokenRow[],
  windowStart: Date,
): Decision {
  const blocks: string[] = [];
  const watches: string[] = [];

  // BLOCK conditions (any one is enough).
  if (ingest.error_rows > 0) blocks.push(`error ingest rows = ${ingest.error_rows}`);
  if (recon.violations > 0) blocks.push(`reconciliation violations = ${recon.violations}`);
  if (recon.ledger_skew > 0) blocks.push(`ledger join skew = ${recon.ledger_skew}`);
  if (recon.unreconciled > 0) blocks.push(`unreconciled ingest rows = ${recon.unreconciled}`);
  if (evidence.canonical_key_not_19 > 0) blocks.push(`canonical malformed rows = ${evidence.canonical_key_not_19}`);
  if (evidence.accepted_total > 0 && evidence.accepted_payload_sha_complete < evidence.accepted_total) {
    blocks.push(`accepted rows with malformed payload_sha256 = ${evidence.accepted_total - evidence.accepted_payload_sha_complete}`);
  }
  if (evidence.ingest_total > 0 && evidence.ingest_body_sha_complete < evidence.ingest_total) {
    blocks.push(`ingest rows with malformed request_body_sha256 = ${evidence.ingest_total - evidence.ingest_body_sha_complete}`);
  }
  // Token: most-recently-created token is the active one. If it's disabled,
  // event capture is dead — that's a BLOCK. If no tokens exist at all → BLOCK.
  if (tokens.length === 0) {
    blocks.push('no site_write_tokens row for boundary');
  } else if (tokens[0].disabled_at !== null) {
    blocks.push(`active token disabled_at = ${fmtTs(tokens[0].disabled_at)}`);
  }

  // WATCH conditions (only meaningful if no BLOCK).
  if (accRej.rejected > 0) {
    watches.push(`rejected events present (rows = ${accRej.rejected})`);
  }
  if (ingest.total === 0) {
    watches.push('no ingest rows in window');
  }
  if (tokens.length > 0 && tokens[0].disabled_at === null) {
    const lastUsed = tokens[0].last_used_at;
    if (lastUsed === null && accRej.accepted > 0) {
      watches.push('token.last_used_at is null despite accepted events in window');
    } else if (lastUsed !== null && lastUsed.getTime() < windowStart.getTime()) {
      watches.push(`token.last_used_at (${fmtTs(lastUsed)}) is older than window start (${fmtTs(windowStart)})`);
    }
  }

  let status: Status;
  let recommendation: string;
  if (blocks.length > 0) {
    status = 'BLOCK';
    recommendation = 'Collector blocked. Do not expand.';
  } else if (watches.length > 0) {
    status = 'WATCH';
    recommendation = 'Collector readable observation has warnings. Fix before event expansion.';
  } else {
    status = 'PASS';
    recommendation = 'Collector healthy. Ready to add next RECORD_ONLY event types.';
  }
  return { status, blocks, watches, recommendation };
}

/* --------------------------------------------------------------------------
 * Main
 * ------------------------------------------------------------------------ */

async function main(): Promise<number> {
  const checkedAt = new Date();
  const windowStart = new Date(checkedAt.getTime() - WINDOW_HOURS * 3600 * 1000);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
  } catch (err) {
    console.error('PR#9 observation report — DB connection failed:', (err as Error).message);
    return 1;
  }

  try {
    const ingest = await loadIngestSummary(client);
    const accRej = await loadAcceptedRejectedSummary(client);
    const evidence = await loadEvidenceQuality(client);
    const recon = await loadReconciliationHealth(client);
    const sources = await loadSourceBreakdown(client);
    const pageUrls = await loadPageUrlBreakdown(client);
    const eventBreakdown = await loadEventTypeBreakdown(client);
    const latest = await loadLatestAccepted(client);
    const tokens = await loadTokenHealth(client);
    const decision = decide(ingest, accRej, evidence, recon, tokens, windowStart);

    // -------- Render markdown report --------
    const lines: string[] = [];
    lines.push('# BuyerRecon Collector Observation Report');
    lines.push('');

    lines.push('## 1. Boundary');
    lines.push(`- workspace_id: \`${WORKSPACE_ID}\``);
    lines.push(`- site_id: \`${SITE_ID}\``);
    lines.push(`- observation window: last ${WINDOW_HOURS} hour(s) — from ${fmtTs(windowStart)} to ${fmtTs(checkedAt)}`);
    lines.push(`- checked_at: ${fmtTs(checkedAt)}`);
    lines.push(`- database_url: ${maskDatabaseUrl(DATABASE_URL!)}`);
    lines.push('');

    lines.push('## 2. Ingest summary');
    lines.push(`- total ingest rows: ${ingest.total}`);
    lines.push(`- ok ingest rows: ${ingest.ok_rows}`);
    lines.push(`- error ingest rows: ${ingest.error_rows}`);
    lines.push(`- first_seen: ${fmtTs(ingest.first_seen)}`);
    lines.push(`- last_seen: ${fmtTs(ingest.last_seen)}`);
    lines.push('');

    lines.push('## 3. Accepted / rejected summary');
    lines.push(`- accepted rows: ${accRej.accepted}`);
    lines.push(`- rejected rows: ${accRej.rejected}`);
    if (accRej.rejected_breakdown.length === 0) {
      lines.push('- rejected breakdown: _(no rejected rows in window)_');
    } else {
      lines.push('- rejected breakdown:');
      lines.push(
        mdTable(
          ['reason_code', 'rejected_stage', 'rows'],
          accRej.rejected_breakdown.map((b) => [
            b.reason_code ?? '_(null)_',
            b.rejected_stage ?? '_(null)_',
            String(b.rows),
          ]),
        ),
      );
    }
    lines.push('');

    lines.push('## 4. Evidence quality');
    lines.push(`- ingest rows: ${evidence.ingest_total}`);
    lines.push(`- request_body_sha256 length=64: ${evidence.ingest_body_sha_complete} / ${evidence.ingest_total} (${pct(evidence.ingest_body_sha_complete, evidence.ingest_total)})`);
    lines.push(`- accepted rows: ${evidence.accepted_total}`);
    lines.push(`- payload_sha256 length=64: ${evidence.accepted_payload_sha_complete} / ${evidence.accepted_total} (${pct(evidence.accepted_payload_sha_complete, evidence.accepted_total)})`);
    lines.push(`- canonical_jsonb present: ${evidence.canonical_present} / ${evidence.accepted_total} (${pct(evidence.canonical_present, evidence.accepted_total)})`);
    lines.push(`- canonical_key_count = 19: ${evidence.canonical_key_19} / ${evidence.accepted_total} (${pct(evidence.canonical_key_19, evidence.accepted_total)})`);
    lines.push(`- canonical_key_count != 19 (malformed): ${evidence.canonical_key_not_19}`);
    lines.push('');

    lines.push('## 5. Reconciliation health');
    lines.push(`- accepted_count + rejected_count != expected_event_count: ${recon.violations}`);
    lines.push(`- ledger join skew (ingest counts vs actual row counts): ${recon.ledger_skew}`);
    lines.push(`- unreconciled rows (reconciled_at IS NULL): ${recon.unreconciled}`);
    lines.push('');

    lines.push('## 6. Source breakdown (consent_source)');
    lines.push(
      mdTable(
        ['consent_source', 'rows', 'accepted_count', 'first_seen', 'last_seen'],
        sources.map((s) => [
          s.consent_source ?? '_(null)_',
          String(s.rows),
          String(s.accepted_count),
          fmtTs(s.first_seen),
          fmtTs(s.last_seen),
        ]),
      ),
    );
    lines.push('');

    lines.push('## 7. Page URL breakdown (top 25 by rows)');
    lines.push(
      mdTable(
        ['page_url', 'rows', 'first_seen', 'last_seen'],
        pageUrls.map((p) => [
          p.page_url ?? '_(null)_',
          String(p.rows),
          fmtTs(p.first_seen),
          fmtTs(p.last_seen),
        ]),
      ),
    );
    lines.push('');

    lines.push('## 7b. Event type breakdown (PR#10 — grouped counts only)');
    lines.push('_Only grouped counts shown; no per-event raw payload values rendered._');
    lines.push('');
    lines.push(
      mdTable(
        ['event_name', 'event_type', 'schema_key', 'rows', 'first_seen', 'last_seen'],
        eventBreakdown.map((e) => [
          e.event_name ?? '_(null)_',
          e.event_type,
          e.schema_key ?? '_(null)_',
          String(e.rows),
          fmtTs(e.first_seen),
          fmtTs(e.last_seen),
        ]),
      ),
    );
    lines.push('');

    lines.push('## 8. Latest accepted events (most recent 10)');
    lines.push(
      mdTable(
        [
          'received_at',
          'request_id',
          'client_event_id',
          'page_url',
          'consent_source',
          'event_type',
          'schema_key',
          'canonical_key_count',
        ],
        latest.map((row) => [
          fmtTs(row.received_at),
          row.request_id,
          row.client_event_id ?? '_(null)_',
          row.page_url ?? '_(null)_',
          row.consent_source ?? '_(null)_',
          row.event_type,
          row.schema_key ?? '_(null)_',
          String(row.canonical_key_count),
        ]),
      ),
    );
    lines.push('');

    lines.push('## 9. Token health');
    lines.push('_token_hash is intentionally NOT selected — only public identifiers + timestamps shown._');
    if (tokens.length === 0) {
      lines.push('');
      lines.push('_(no site_write_tokens row found for this boundary)_');
    } else {
      lines.push('');
      lines.push(
        mdTable(
          ['token_id', 'disabled_at', 'last_used_at', 'created_at'],
          tokens.map((t) => [
            t.token_id,
            fmtTs(t.disabled_at),
            fmtTs(t.last_used_at),
            fmtTs(t.created_at),
          ]),
        ),
      );
    }
    lines.push('');

    lines.push('## 10. Final observation status');
    lines.push(`- **status: ${decision.status}**`);
    if (decision.blocks.length > 0) {
      lines.push('- BLOCK reasons:');
      for (const b of decision.blocks) lines.push(`  - ${b}`);
    }
    if (decision.watches.length > 0) {
      lines.push('- WATCH reasons:');
      for (const w of decision.watches) lines.push(`  - ${w}`);
    }
    if (decision.status === 'PASS') lines.push('- All checks green.');
    lines.push('');

    lines.push('## 11. Recommendation');
    lines.push(`> ${decision.recommendation}`);
    lines.push('');

    process.stdout.write(lines.join('\n'));
    if (!lines[lines.length - 1].endsWith('\n')) process.stdout.write('\n');

    return decision.status === 'BLOCK' ? 1 : 0;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('PR#9 observation report — fatal:', (err as Error).message);
    process.exit(1);
  });
