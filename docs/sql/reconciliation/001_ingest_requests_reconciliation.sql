-- ============================================================================
-- Reconciliation check 001: ingest_requests internal counts
-- Spec: handoff §2.7 invariant —
--   "for every row, accepted_count + rejected_count = expected_event_count
--    once reconciled_at is set. The §2.12 SQL suite enforces this."
--
-- This file is the standalone, runnable form of that check, so it can be
-- exercised by hand against a local Postgres dev clone before §3.PR#8 wires
-- the §2.12 SQL verification suite as a scheduled job.
--
-- Healthy result: zero rows.
--
-- What this checks:
--   For every reconciled ingest_requests row (reconciled_at IS NOT NULL),
--   accepted_count + rejected_count must equal expected_event_count.
--   Any other row is unexplained — some events were neither accepted nor
--   rejected, which is the failure mode this ledger is designed to catch.
--
--   Request-level rejections are explicitly covered: per §2.7 they have
--   expected_event_count = 0, accepted_count = 0, rejected_count = 0,
--   reconciled_at IS NOT NULL — so 0 + 0 = 0 satisfies the invariant
--   trivially and they will not appear here.
--
-- What this does NOT check (deferred to later PRs):
--   - Non-reconciled rows (reconciled_at IS NULL): in steady state the
--     §3.PR#5 collector sets reconciled_at synchronously, so a row with
--     IS NULL after a few seconds is itself a violation. The "stale
--     unreconciled" check is part of the §2.12 suite and lives there.
--   - Scheduled execution / verification_violations write-out: that is
--     §3.PR#8. This file ships the runnable SQL only.
--
-- Active accepted-side cross-table check: see check 002 below (added in
-- §3.PR#2 once accepted_events.request_id existed).
-- Active rejected-side cross-table check: see check 003 below (added in
-- §3.PR#3 once rejected_events.request_id existed).
--
-- Run locally (NEVER against production):
--   psql "$DATABASE_URL" \
--     -f docs/sql/reconciliation/001_ingest_requests_reconciliation.sql
-- ============================================================================

SELECT request_id,
       expected_event_count,
       accepted_count,
       rejected_count,
       (accepted_count + rejected_count) AS explained_count,
       reconciled_at,
       received_at
FROM ingest_requests
WHERE reconciled_at IS NOT NULL
  AND accepted_count + rejected_count <> expected_event_count;

-- ============================================================================
-- Reconciliation check 002: ingest_requests.accepted_count vs accepted_events
-- (accepted-side cross-table — runnable since §3.PR#2)
-- Spec: handoff §2.12 cross-table checks, accepted-side variant.
--
-- Healthy result: zero rows.
--
-- For every reconciled ingest_requests row, the ledger's accepted_count must
-- equal the actual count of accepted_events rows linked to the same
-- request_id. The LEFT JOIN gate naturally exempts legacy accepted_events
-- rows (request_id IS NULL pre-cutover) — they will not match any ingest
-- request row, so they don't contribute to COUNT(ae.event_id).
--
-- Note: ingest_requests.accepted_count is NOT NULL (default 0); pre-collector-
-- wiring (§3.PR#5) the table is empty, so this check returns zero rows
-- trivially until the collector starts writing real data.
-- ============================================================================

SELECT ir.request_id,
       ir.accepted_count    AS ledger_accepted,
       COUNT(ae.event_id)   AS table_accepted
FROM ingest_requests ir
LEFT JOIN accepted_events ae ON ae.request_id = ir.request_id
WHERE ir.reconciled_at IS NOT NULL
GROUP BY ir.request_id, ir.accepted_count
HAVING ir.accepted_count <> COUNT(ae.event_id);

-- ============================================================================
-- Reconciliation check 003: ingest_requests.rejected_count vs rejected_events
-- (rejected-side cross-table — runnable since §3.PR#3)
-- Spec: handoff §2.12 cross-table checks, rejected-side variant (corresponds
-- to §2.12 check #15 JOIN-gated form).
--
-- Healthy result: zero rows.
--
-- For every reconciled ingest_requests row, the ledger's rejected_count must
-- equal the actual count of rejected_events rows linked to the same
-- request_id. The LEFT JOIN gate naturally exempts legacy rejected_events
-- rows (request_id IS NULL pre-cutover) — they will not match any ingest
-- request row, so they don't contribute to COUNT(re.id).
--
-- Per §2.6 case table, request-level rejections (whole request unparseable)
-- do NOT create a rejected_events row — the proof lives on
-- ingest_requests.request_body_sha256 only. Those rows have rejected_count=0
-- in the ledger and zero matching rejected_events rows, so the check holds
-- trivially.
--
-- Note: ingest_requests.rejected_count is NOT NULL (default 0); pre-collector-
-- wiring (§3.PR#5) the table is empty, so this check returns zero rows
-- trivially until the collector starts writing real data.
-- ============================================================================

SELECT ir.request_id,
       ir.rejected_count    AS ledger_rejected,
       COUNT(re.id)         AS table_rejected
FROM ingest_requests ir
LEFT JOIN rejected_events re ON re.request_id = ir.request_id
WHERE ir.reconciled_at IS NOT NULL
GROUP BY ir.request_id, ir.rejected_count
HAVING ir.rejected_count <> COUNT(re.id);
