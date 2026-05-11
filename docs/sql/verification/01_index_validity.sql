-- Sprint 1 PR#8 verification — accepted_events_dedup index validity.
-- Track B (BuyerRecon Evidence Foundation) — read-only. No DML.
--
-- Run against TEST_DATABASE_URL only. NEVER production.
-- Mirrors the assertions in tests/v1/db/index-validity.dbtest.ts.

-- 1. accepted_events_dedup must exist, be unique, valid, and partial.
SELECT i.indexname,
       ix.indisunique,
       ix.indisvalid,
       pg_get_indexdef(ix.indexrelid) AS indexdef
FROM   pg_indexes i
JOIN   pg_class   c  ON c.relname = i.indexname
JOIN   pg_index   ix ON ix.indexrelid = c.oid
WHERE  i.schemaname = 'public'
  AND  i.indexname  = 'accepted_events_dedup';

-- Expected: exactly one row.
--   indisunique = t
--   indisvalid  = t
--   indexdef matches:
--     CREATE UNIQUE INDEX accepted_events_dedup ON public.accepted_events
--     USING btree (workspace_id, site_id, client_event_id)
--     WHERE ((workspace_id IS NOT NULL) AND (site_id IS NOT NULL) AND (client_event_id IS NOT NULL))

-- 2. Legacy partial unique index still present and untouched by PR#6/PR#7.
SELECT indexname, pg_get_indexdef((SELECT oid FROM pg_class WHERE relname = 'idx_accepted_dedup_client_event'))
FROM   pg_indexes
WHERE  schemaname = 'public'
  AND  indexname  = 'idx_accepted_dedup_client_event';

-- Expected: exactly one row.
