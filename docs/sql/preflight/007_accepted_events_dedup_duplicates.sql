-- Preflight 007: Sprint 1 PR#6 — duplicate detection for accepted_events_dedup
-- Track B (BuyerRecon Evidence Foundation), NOT Track A scoring, NOT Core AMS.
-- Spec: /Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md
--   - §3.PR#6 (cross-request dedupe unique index)
--   - §2.9 R-7 (duplicate_client_event_id)
--   - §2.12 verification check #3
--
-- Purpose:
--   Detect existing duplicate accepted_events rows on the
--   (workspace_id, site_id, client_event_id) triple BEFORE applying
--   migrations/007_accepted_events_dedup_index.sql.
--
-- Contract:
--   - READ-ONLY. No DELETE, UPDATE, INSERT, TRUNCATE, ALTER, DROP.
--   - Idempotent. Safe to re-run.
--   - Track B evidence-ledger rule: this query MUST NOT delete or modify any
--     accepted_events row. Remediation is a separate manual operator decision
--     (PR#6 is detection-only).
--
-- Usage:
--   psql "$DATABASE_URL" -f docs/sql/preflight/007_accepted_events_dedup_duplicates.sql
--
-- Expected result:
--   ZERO rows. If non-empty, do NOT apply migration 007. Triage manually.
--
-- Why the WHERE clause matches the partial-index WHERE:
--   The unique index in migration 007 is partial on
--     workspace_id IS NOT NULL AND site_id IS NOT NULL AND client_event_id IS NOT NULL.
--   Only rows that satisfy that predicate can violate the unique constraint.
--   Legacy pre-PR#5 rows (workspace_id IS NULL) are excluded from the index
--   AND from this preflight to avoid noise.

SELECT workspace_id,
       site_id,
       client_event_id,
       COUNT(*)                                          AS duplicate_count,
       MIN(received_at)                                  AS earliest_received_at,
       MAX(received_at)                                  AS latest_received_at,
       (ARRAY_AGG(event_id ORDER BY received_at))[1:5]   AS sample_event_ids
FROM   accepted_events
WHERE  workspace_id    IS NOT NULL
  AND  site_id         IS NOT NULL
  AND  client_event_id IS NOT NULL
GROUP BY workspace_id, site_id, client_event_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, latest_received_at DESC;
