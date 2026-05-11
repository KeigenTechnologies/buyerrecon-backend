-- Sprint 1 PR#8 verification — hash columns present on stored rows.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL only. NEVER production.
-- Mirrors tests/v1/db/hash-invariants.dbtest.ts.
--
-- Note: the equality checks (e.g. request_body_sha256 = sha256Hex(raw bytes),
-- payload_sha256 != payloadSha256(canonical_jsonb), raw_payload_sha256 =
-- payloadSha256(raw)) are computed in the TypeScript test against the same
-- helpers the orchestrator uses. SQL can only confirm presence/shape.

-- 1. ingest_requests.request_body_sha256 always populated (NOT NULL by schema).
SELECT request_id, request_body_sha256
FROM   ingest_requests
WHERE  workspace_id = '__test_ws_pr8__'
  AND  (request_body_sha256 IS NULL OR LENGTH(request_body_sha256) <> 64);
-- Expected: zero rows.

-- 2. Accepted rows always carry payload_sha256 + canonical_jsonb in v1 writes.
SELECT event_id, payload_sha256, canonical_jsonb IS NULL AS canonical_missing
FROM   accepted_events
WHERE  workspace_id = '__test_ws_pr8__'
  AND  (payload_sha256 IS NULL OR canonical_jsonb IS NULL OR LENGTH(payload_sha256) <> 64);
-- Expected: zero rows.

-- 3. canonical_jsonb has exactly 19 keys per the §2.5 line 168 canonical
--    projection contract.
SELECT event_id, jsonb_object_keys(canonical_jsonb) AS k
FROM   accepted_events
WHERE  workspace_id = '__test_ws_pr8__'
ORDER  BY event_id, k;
-- Operator: GROUP BY event_id and COUNT(*) should be 19 per row.

SELECT event_id, COUNT(*) AS key_count
FROM   accepted_events,
       jsonb_object_keys(canonical_jsonb) AS k
WHERE  workspace_id = '__test_ws_pr8__'
GROUP  BY event_id
HAVING COUNT(*) <> 19;
-- Expected: zero rows.

-- 4. Rejected rows always carry raw_payload_sha256 + raw.
SELECT id, raw IS NULL AS raw_missing, raw_payload_sha256
FROM   rejected_events
WHERE  workspace_id = '__test_ws_pr8__'
  AND  (raw IS NULL OR raw_payload_sha256 IS NULL OR LENGTH(raw_payload_sha256) <> 64);
-- Expected: zero rows.

-- 5. Duplicate-reclassified rejects carry the expected reason_code + stage.
SELECT id, raw_payload_sha256, reason_code, rejected_stage
FROM   rejected_events
WHERE  workspace_id = '__test_ws_pr8__'
  AND  reason_code = 'duplicate_client_event_id'
  AND  rejected_stage <> 'dedupe';
-- Expected: zero rows.
