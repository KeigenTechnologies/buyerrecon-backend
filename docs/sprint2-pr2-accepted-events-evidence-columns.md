# Sprint 1 PR#2 — `accepted_events` evidence-column augmentation

**Date:** 2026-05-09
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §2.5 + §3.PR#2 + Appendix A.1
**Status:** additive migration + schema-append + structural smoke tests + reconciliation-SQL update + this doc. **No collector wiring, no production migration run, no live tests, no commit.**

> Note on filename. This doc keeps the `sprint2-pr2-…` prefix for review-trail continuity with the closed PR#1 doc. Body content uses the canonical numbering: **Sprint 1 §3.PR#2** (the second migration of the Sprint 1 PR sequence).

---

## Hard-rule disclaimer (verbatim)

```
This PR does not implement bot detection.
This PR does not implement AI-agent detection.
This PR does not implement Stage 0 / Stage 1 scoring.
This PR does not implement live RECORD_ONLY.
This PR only prepares accepted_events evidence columns for future collector/database evidence.
```

---

## Purpose

Per handoff §3.PR#2: prepare `accepted_events` so future collector writes (§3.PR#5) can link accepted rows to the `ingest_requests` ledger created in PR#1, and carry the evidence required for the §2.12 SQL verification suite, the admin debug API (§3.PR#9), and any later read/projection layer (including Track A Sprint 2's backend bridge — see "Relationship to Track A" below).

This PR is purely **additive schema** on the table. **No application code yet writes to these columns.** The collector write path lands in §3.PR#5.

---

## Columns added (23, all additive)

Grouped to match handoff §2.5:

| Group | Column | Type | PR#2 nullability | Eventual §2.5 target |
|---|---|---|---|---|
| Request linkage | `request_id` | `UUID` | nullable | `NOT NULL` (deferred to post-cutover) |
| Boundary | `workspace_id` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Identity | `id_format` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Identity | `event_origin` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Identity | `traffic_class` | `TEXT DEFAULT 'unknown'` | nullable (with default) | `NOT NULL DEFAULT 'unknown'` (deferred) — **stays `'unknown'` across all of Sprint 1** (Decision #13) |
| Schema | `schema_key` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Schema | `schema_version` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Schema | `validator_version` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Session | `session_seq` | `INT` | nullable | nullable for server-origin; required browser-origin via app rule |
| Session | `session_started_at` | `TIMESTAMPTZ` | nullable | nullable for server-origin; required browser-origin via app rule |
| Session | `session_last_seen_at` | `TIMESTAMPTZ` | nullable | as above |
| Consent | `consent_state` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Consent | `consent_source` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Consent | `consent_updated_at` | `TIMESTAMPTZ` | nullable | nullable in §2.5 target |
| Consent | `pre_consent_mode` | `BOOLEAN DEFAULT FALSE` | nullable (with default) | `NOT NULL DEFAULT FALSE` (deferred) |
| Consent | `tracking_mode` | `TEXT` | nullable | `NOT NULL` (deferred) |
| Consent | `storage_mechanism` | `TEXT` | nullable | `NOT NULL` (deferred) — Sprint 1 admit set: `cookie` \| `session_storage` \| `memory` \| `none` |
| Payload | `payload_sha256` | `TEXT` | nullable | `NOT NULL` (deferred); per-event hash; never auto-purged |
| Payload | `size_bytes` | `INT` | nullable | `NOT NULL` (deferred); size of the individual event envelope |
| Payload | `canonical_jsonb` | `JSONB` | nullable | `NOT NULL` (deferred) — durable canonical projection; **NOT purgeable** |
| Payload | `payload_purged_at` | `TIMESTAMPTZ` | nullable | nullable; set when `raw` / future `payload_jsonb` is purged |
| Runtime | `ip_hash` | `TEXT` | nullable | `NOT NULL` (deferred); workspace-salted; raw IP never stored |
| Runtime | `debug_mode` | `BOOLEAN DEFAULT FALSE` | nullable (with default) | `NOT NULL DEFAULT FALSE` (deferred) |

### Index added

```sql
CREATE INDEX IF NOT EXISTS accepted_events_request_id ON accepted_events (request_id);
```

Plain (non-`CONCURRENTLY`) index — repo convention. The column is `NULL` on every legacy row, so initial index size is small.

---

## What this PR does

1. Adds `migrations/004_accepted_events_evidence_columns.sql` — single `ALTER TABLE accepted_events` with 23 `ADD COLUMN IF NOT EXISTS` clauses, plus `CREATE INDEX IF NOT EXISTS accepted_events_request_id`. Idempotent. No existing row is forced to a non-NULL value the application depends on.
2. Updates `src/db/schema.sql` so fresh `initDb()` installs include the same 23 columns inside the `accepted_events` `CREATE TABLE` block, plus the new index. (Same convention used by migration 002.)
3. Updates `docs/sql/reconciliation/001_ingest_requests_reconciliation.sql` — adds **check 002** (accepted-side cross-table reconciliation) as a runnable `SELECT`, and narrows the cross-table TODO to PR#3 only (the rejected-side join).
4. Adds `tests/accepted-events-pr2.test.ts` — 22 pure-text-level structural smoke tests (column shape, index, scope-discipline, Track A/B separation, doc-disclaimer wording).
5. Updates one existing test in `tests/ingest-requests.test.ts` — narrows the recon-TODO assertion from `/TODO.*PR#2.*PR#3/` to `/TODO\s*\(PR#3\)/` since PR#2 just landed accepted-side.
6. Adds this document.

---

## What this PR does NOT do (per handoff §1 / §4.1 + Track A/B separation rule)

- **Does NOT modify `rejected_events`.** That is §3.PR#3.
- **Does NOT wire the collector to write any of these columns.** That is §3.PR#5.
- **Does NOT introduce the `(workspace_id, site_id, client_event_id)` unique dedup index.** That is §3.PR#6.
- **Does NOT add `/v1/event` or `/v1/batch` routes.** That is §3.PR#7.
- **Does NOT wire the §2.12 SQL verification suite as a scheduled job.** That is §3.PR#8.
- **Does NOT add the admin debug API.** That is §3.PR#9.
- **Does NOT introduce auth-derived `workspace_id` / `site_id` resolution.** That is §3.PR#4.
- **Does NOT promote any new column to `NOT NULL`.** All §2.5 `NOT NULL` targets are deferred until post-collector-cutover backfill is verified (the §3.PR#2 migration rule).
- **Does NOT introduce a foreign key from `accepted_events.request_id` → `ingest_requests.request_id`.** Existing repo uses FKs only for `replay_evidence_cards → replay_runs`; per the handoff and your instruction, no FK in PR#2.
- **Does NOT rename the existing `raw JSONB NOT NULL` column to `payload_jsonb`** (the §2.5 target name) and **does NOT drop NOT NULL on `raw`.** Renames / NOT-NULL-drops on legacy hot-table columns are out of PR#2 scope. The eventual `raw → payload_jsonb` reconciliation (90-day purge tier) is a separate, post-backfill PR.
- **Does NOT create the `accepted_events_workspace_site` index** (§2.5 keys it on `occurred_at`; `occurred_at` is not yet a column on `accepted_events`; the PR#2 column list does not add it).
- **Does NOT introduce Track A scoring fields** — no `risk_score`, `classification`, `recommended_action`, or behavioural-quality columns. Track B Sprint 1 has no scoring surface (handoff §1 Sprint 1 Scope Exclusions).
- **Does NOT introduce bot detection or AI-agent detection** — those are explicitly out-of-scope per §4.1 Task 1.
- **Does NOT touch production website repos, GTM, GA4, LinkedIn, ThinSDK, the report renderer, or the Track A harness at `/Users/admin/github/ams-qa-behaviour-tests`.**

---

## Three deferrals from a literal §2.5 transcription (flagged for reviewer awareness)

1. **`canonical_jsonb` is nullable.** §2.5 target: `JSONB NOT NULL`. PR#2 leaves it nullable because legacy rows cannot be safely projected to a canonical shape in this PR. Promotion to `NOT NULL` is deferred to a post-backfill PR.
2. **The existing `raw JSONB NOT NULL` column is not renamed and not dropped to nullable.** §2.5 target: `payload_jsonb JSONB` (nullable, purgeable). The rename + nullability change is out of PR#2 scope.
3. **`accepted_events_workspace_site` index is not created.** §2.5 keys it on `occurred_at`, which is not yet a column. The index lands when `occurred_at` lands.

---

## Local test command

```bash
cd /Users/admin/github/buyerrecon-backend
npm test
```

Vitest runs `tests/accepted-events-pr2.test.ts` alongside the existing `tests/validate.test.ts`, `tests/encrypt.test.ts`, and `tests/ingest-requests.test.ts`. All tests are pure-text-level structural smoke — no Postgres connection.

To verify the migration end-to-end against a **local dev** Postgres (do **not** point `$DATABASE_URL` at production):

```bash
psql "$DATABASE_URL" -f migrations/004_accepted_events_evidence_columns.sql
psql "$DATABASE_URL" -c '\d accepted_events'
psql "$DATABASE_URL" -f docs/sql/reconciliation/001_ingest_requests_reconciliation.sql
```

`\d accepted_events` should show all 23 new columns + the new `accepted_events_request_id` index. Both reconciliation queries (check 001 and check 002) should return zero rows on an empty / healthy database.

---

## Rollback plan

Migration is strictly additive. Rollback is one `DROP INDEX` + one `ALTER TABLE` with 23 `DROP COLUMN IF EXISTS`:

```sql
DROP INDEX IF EXISTS accepted_events_request_id;
ALTER TABLE accepted_events
  DROP COLUMN IF EXISTS debug_mode,
  DROP COLUMN IF EXISTS payload_purged_at,
  DROP COLUMN IF EXISTS canonical_jsonb,
  DROP COLUMN IF EXISTS session_last_seen_at,
  DROP COLUMN IF EXISTS session_started_at,
  DROP COLUMN IF EXISTS session_seq,
  DROP COLUMN IF EXISTS storage_mechanism,
  DROP COLUMN IF EXISTS tracking_mode,
  DROP COLUMN IF EXISTS pre_consent_mode,
  DROP COLUMN IF EXISTS consent_updated_at,
  DROP COLUMN IF EXISTS consent_source,
  DROP COLUMN IF EXISTS consent_state,
  DROP COLUMN IF EXISTS ip_hash,
  DROP COLUMN IF EXISTS size_bytes,
  DROP COLUMN IF EXISTS payload_sha256,
  DROP COLUMN IF EXISTS traffic_class,
  DROP COLUMN IF EXISTS id_format,
  DROP COLUMN IF EXISTS event_origin,
  DROP COLUMN IF EXISTS schema_version,
  DROP COLUMN IF EXISTS schema_key,
  DROP COLUMN IF EXISTS validator_version,
  DROP COLUMN IF EXISTS workspace_id,
  DROP COLUMN IF EXISTS request_id;
```

Safe because (a) all adds were nullable or non-nullable-with-constant-DEFAULT, so no row was forced to a non-NULL value the app depends on; (b) no FK references any new column; (c) no application code yet reads or writes these columns; (d) `rejected_events` is not touched.

To roll back the schema-append: revert the `-- Sprint 1 PR#2 evidence-column augmentation` block inside the `accepted_events` `CREATE TABLE` plus the trailing `accepted_events_request_id` index. To roll back the recon-SQL update: revert the new "Reconciliation check 002" block and restore the prior PR#2/PR#3 TODO header. To roll back the new test file: delete `tests/accepted-events-pr2.test.ts` and revert the one updated assertion in `tests/ingest-requests.test.ts`.

---

## Tests run

- `npx tsc --noEmit` — pass (clean exit).
- `npm test` — pass (4 test files, 127/127 passing; baseline pre-PR#2 was 96/96 + 31 new tests in `tests/accepted-events-pr2.test.ts`).

---

## Relationship to Track A

- **Track B PR#2 is a dependency for Track A Sprint 2 backend bridge** — the bridge needs these accepted-side evidence columns (`request_id`, `workspace_id`, `validator_version`, `schema_key`, `schema_version`, `event_origin`, `id_format`, `traffic_class`, `payload_sha256`, `canonical_jsonb`, etc.) to read backend evidence and produce reports.
- **Track B PR#2 is NOT Track A scoring.** None of these columns store a Track A scoring output. `traffic_class` is a structural enum that stays `'unknown'` across all of Sprint 1 (Decision #13); `event_origin` is a structural enum (`browser`/`server`/`system`); both are evidence labels, not classifications. No `risk_score`, no `classification`, no `recommended_action`, no behavioural-quality column.
- **Track A scoring remains in the local harness until a later bridge PR.** That bridge PR is a separate Track A deliverable and will consume Track B evidence as a read source — it will not import scoring code into Track B.
- **Dependency chain to Track A Sprint 2:** PR#2 (this) → PR#3 (rejected_events evidence) → PR#4 (auth-derived workspace boundary) → PR#5 (collector wiring) → PR#7 (`/v1/*` routes) → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. The Track A harness was not opened, read for editing, or modified.
- **No production:** no production website repo touched; no GTM / GA4 / LinkedIn pixel touched; no ThinSDK file touched; no production endpoint called; no production database migration run.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS=true` is never set. No Playwright, no network call.
- **No collector / route / validator / auth code** modified anywhere under `src/`.
- **No `rejected_events` change.** Verified by structural smoke test.
- **No Track A scoring surface introduced.** Verified by structural smoke test.
- **No commit was created by this PR.** Working tree changes only; `git status` will show the new files until the maintainer reviews and commits.

---

## Next PR — §3.PR#3

Mirror this PR for `rejected_events`: add `request_id UUID` (nullable in PR#3 per the §3.PR#3 migration rule), `workspace_id`, `client_event_id`, `id_format`, `event_name`, `event_type`, `schema_key`, `schema_version`, `rejected_stage`, `reason_code`, `reason_detail`, `schema_errors_jsonb`, `pii_hits_jsonb`, `raw_payload_sha256`, `size_bytes`, `debug_mode`, `sample_visible_to_admin`. Preserve existing `reason_codes TEXT[]` for back-compat (dual-write transition). Activate the rejected-side cross-table reconciliation that's currently a TODO in `001_ingest_requests_reconciliation.sql`. **Out of scope for PR#2 — do not start.**
