-- Sprint 1 PR#8 verification — site_write_tokens.last_used_at touched after auth.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL only. NEVER production.
-- Mirrors tests/v1/db/last-used-at.dbtest.ts.

-- 1. Inspect last_used_at for the PR#8 test token.
SELECT token_id,
       workspace_id,
       site_id,
       disabled_at,
       last_used_at,
       last_used_at IS NOT NULL AS touched
FROM   site_write_tokens
WHERE  token_id = '00000000-0000-4000-8000-0000000000a1';

-- Expected after a successful /v1/event:
--   last_used_at IS NOT NULL (typically within a few hundred ms of the response).

-- 2. Sanity: last_used_at touch must not zero out evidence rows. After many
--    requests, accepted_events for the workspace should still exist and
--    site_write_tokens.last_used_at should be a recent timestamp.
SELECT (SELECT COUNT(*) FROM accepted_events
         WHERE workspace_id = '__test_ws_pr8__')                AS accepted_total,
       (SELECT last_used_at FROM site_write_tokens
         WHERE token_id = '00000000-0000-4000-8000-0000000000a1') AS token_last_used;
