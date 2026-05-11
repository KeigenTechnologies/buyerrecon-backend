-- Sprint 1 PR#8 verification — cross-request duplicate retry proof.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL only. NEVER production.
-- Mirrors tests/v1/db/duplicate-retry.dbtest.ts.

-- 1. PR#6 partial unique index invariant: no two accepted rows may share
--    the triple (workspace_id, site_id, client_event_id) when all three
--    are non-null.
SELECT workspace_id,
       site_id,
       client_event_id,
       COUNT(*) AS accepted_count
FROM   accepted_events
WHERE  workspace_id    IS NOT NULL
  AND  site_id         IS NOT NULL
  AND  client_event_id IS NOT NULL
GROUP  BY workspace_id, site_id, client_event_id
HAVING COUNT(*) > 1;
-- Expected: zero rows.

-- 2. SDK retry visibility: count duplicate rejections per client_event_id
--    for the test boundary. Useful to confirm the reclassification path
--    actually wrote the rejected rows.
SELECT client_event_id,
       COUNT(*) FILTER (WHERE reason_code = 'duplicate_client_event_id') AS dup_rejected,
       COUNT(*) FILTER (WHERE reason_code <> 'duplicate_client_event_id') AS other_rejected
FROM   rejected_events
WHERE  workspace_id = '__test_ws_pr8__'
GROUP  BY client_event_id
ORDER  BY client_event_id;

-- 3. Per-triple summary: accepted count + duplicate rejected count for the
--    test boundary. After N sequential identical retries we expect
--    (accepted=1, dup_rejected=N-1, total=N).
SELECT a.workspace_id,
       a.site_id,
       a.client_event_id,
       COALESCE(a.cnt, 0) AS accepted_cnt,
       COALESCE(r.cnt, 0) AS dup_rejected_cnt
FROM   (
  SELECT workspace_id, site_id, client_event_id, COUNT(*)::int AS cnt
    FROM accepted_events
   WHERE workspace_id = '__test_ws_pr8__'
   GROUP BY workspace_id, site_id, client_event_id
) a
LEFT JOIN (
  SELECT workspace_id, client_event_id, COUNT(*)::int AS cnt
    FROM rejected_events
   WHERE workspace_id = '__test_ws_pr8__'
     AND reason_code = 'duplicate_client_event_id'
   GROUP BY workspace_id, client_event_id
) r ON r.workspace_id = a.workspace_id AND r.client_event_id = a.client_event_id
ORDER BY a.client_event_id;
-- Expected: accepted_cnt always 1; dup_rejected_cnt = retries - 1.
