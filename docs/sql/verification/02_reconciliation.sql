-- Sprint 1 PR#8 verification — reconciliation invariants.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL only. NEVER production.
-- Mirrors tests/v1/db/reconciliation.dbtest.ts.
-- Replace '__test_ws_pr8__' with the workspace_id you want to inspect.

-- 1. Per-request: accepted_count + rejected_count = expected_event_count
--    must hold whenever reconciled_at IS NOT NULL.
SELECT request_id,
       endpoint,
       expected_event_count,
       accepted_count,
       rejected_count,
       accepted_count + rejected_count AS sum_actual,
       reconciled_at
FROM   ingest_requests
WHERE  workspace_id = '__test_ws_pr8__'
  AND  reconciled_at IS NOT NULL
  AND  accepted_count + rejected_count <> expected_event_count;
-- Expected: zero rows.

-- 2. Actual accepted_events row count by request_id must equal
--    ingest_requests.accepted_count.
SELECT ir.request_id,
       ir.accepted_count          AS ledger_accepted,
       COALESCE(a.cnt, 0)         AS actual_accepted
FROM   ingest_requests ir
LEFT JOIN (
  SELECT request_id, COUNT(*)::int AS cnt
    FROM accepted_events
   WHERE workspace_id = '__test_ws_pr8__'
   GROUP BY request_id
) a ON a.request_id = ir.request_id
WHERE  ir.workspace_id = '__test_ws_pr8__'
  AND  ir.accepted_count <> COALESCE(a.cnt, 0);
-- Expected: zero rows.

-- 3. Actual rejected_events row count by request_id must equal
--    ingest_requests.rejected_count.
SELECT ir.request_id,
       ir.rejected_count          AS ledger_rejected,
       COALESCE(r.cnt, 0)         AS actual_rejected
FROM   ingest_requests ir
LEFT JOIN (
  SELECT request_id, COUNT(*)::int AS cnt
    FROM rejected_events
   WHERE workspace_id = '__test_ws_pr8__'
   GROUP BY request_id
) r ON r.request_id = ir.request_id
WHERE  ir.workspace_id = '__test_ws_pr8__'
  AND  ir.rejected_count <> COALESCE(r.cnt, 0);
-- Expected: zero rows.

-- 4. reconciled_at must be set on every parseable request.
SELECT request_id, endpoint, http_status, reject_reason_code, reconciled_at
FROM   ingest_requests
WHERE  workspace_id = '__test_ws_pr8__'
  AND  reconciled_at IS NULL;
-- Expected: zero rows.
