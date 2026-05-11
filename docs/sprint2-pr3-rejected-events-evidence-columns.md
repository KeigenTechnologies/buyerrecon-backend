# Sprint 1 PR#3 — `rejected_events` evidence-column augmentation

**Date:** 2026-05-10
**Repo:** `buyerrecon-backend` (Track B — BuyerRecon Evidence Foundation)
**Spec:** `/Users/admin/github/buyerrecon-study/docs/federal/sprint-1-engineering-handoff-v0.1.md` — §2.6 + §3.PR#3 + Appendix A.2 + §2.12 (checks #6, #14, #15)
**Status:** additive migration + schema-append + structural smoke tests + reconciliation-SQL update + this doc. **No collector wiring, no production migration run, no live tests, no commit.**

> Note on filename. This doc keeps the `sprint2-pr3-…` prefix for review-trail continuity with PR#1 / PR#2 docs. Body content uses the canonical numbering: **Sprint 1 §3.PR#3** (the third migration of the Sprint 1 PR sequence).

---

## Hard-rule disclaimer (verbatim)

```
This PR does not implement bot detection.
This PR does not implement AI-agent detection.
This PR does not implement Stage 0 / Stage 1 scoring.
This PR does not implement live RECORD_ONLY.
This PR does not implement collector routes.
This PR only prepares rejected_events evidence columns for future collector/database evidence.
```

---

## Three-part architecture rule (this PR is Track B only)

- **Core AMS** = `/github/keigentechnologies/ams` — future productized scoring/report home. Untouched in this PR.
- **Track A** = `/Users/admin/github/ams-qa-behaviour-tests` — experimental scoring/QA harness. Untouched in this PR.
- **Track B** = `/Users/admin/github/buyerrecon-backend` — evidence-foundation backend. **This PR.**

PR#3 is Track B evidence schema. It is **not** Track A scoring and **not** Core AMS product code. The future bridge (Track B evidence → adapter → Core AMS scoring → RECORD_ONLY scoring/report output) is **not** built here. Track A scoring remains a local harness until a later, explicitly scoped bridge PR.

---

## Purpose

Per handoff §3.PR#3: prepare `rejected_events` so future collector writes (§3.PR#5) can link rejected rows to the `ingest_requests` ledger (created in PR#1), preserve a stable singular `reason_code` (per the §2.8 canonical reason-code enum), record per-event rejected payload hashes, and enable rejected-side cross-table reconciliation against `ingest_requests.rejected_count`. Activates check #15 (JOIN-gated) of the §2.12 SQL verification suite as a runnable SQL script (full scheduled execution lands in §3.PR#8).

This PR is purely **additive schema** on the table plus one bounded `UPDATE` backfill on the new singular `reason_code` from legacy `reason_codes[1]`. **No application code yet writes to these new columns.** The collector write path lands in §3.PR#5.

---

## Columns added (18, all additive)

Grouped to match handoff §2.6:

| Group | Column | Type | PR#3 nullability | Eventual §2.6 target |
|---|---|---|---|---|
| Request linkage | `request_id` | `UUID` | nullable | `NOT NULL` (deferred to post-cutover) |
| Request linkage | `rejected_at` | `TIMESTAMPTZ DEFAULT NOW()` | nullable (with default) | `NOT NULL DEFAULT NOW()` (deferred) |
| Boundary | `workspace_id` | `TEXT` | nullable | nullable in §2.6 target ("nullable when auth itself failed") |
| Identity | `client_event_id` | `TEXT` | nullable | nullable (best-effort) |
| Identity | `id_format` | `TEXT` | nullable | nullable (best-effort) |
| Identity | `event_name` | `TEXT` | nullable | nullable (best-effort) |
| Identity | `event_type` | `TEXT` | nullable | nullable (best-effort) |
| Schema | `schema_key` | `TEXT` | nullable | nullable (best-effort) |
| Schema | `schema_version` | `TEXT` | nullable | nullable (best-effort) |
| Rejection | `rejected_stage` | `TEXT` | nullable | `NOT NULL` (deferred) — admit set: `auth` \| `envelope` \| `validation` \| `pii` \| `boundary` \| `dedupe` \| `storage` |
| Rejection | `reason_code` | `TEXT` | nullable | `NOT NULL` (deferred) — singular form of the §2.8 canonical enum |
| Rejection | `reason_detail` | `TEXT` | nullable | nullable in §2.6 target |
| Rejection | `schema_errors_jsonb` | `JSONB` | nullable | nullable in §2.6 target |
| Rejection | `pii_hits_jsonb` | `JSONB` | nullable | nullable in §2.6 target |
| Evidence | `raw_payload_sha256` | `TEXT` | nullable | `NOT NULL` (deferred) — see "raw_payload_sha256 nullable-first rationale" below |
| Evidence | `size_bytes` | `INT` | nullable | `NOT NULL` (deferred) |
| Evidence | `debug_mode` | `BOOLEAN DEFAULT FALSE` | nullable (with default) | `NOT NULL DEFAULT FALSE` (deferred) |
| Evidence | `sample_visible_to_admin` | `BOOLEAN DEFAULT TRUE` | nullable (with default) | `NOT NULL DEFAULT TRUE` (deferred) |

### Indexes added

```sql
CREATE INDEX IF NOT EXISTS rejected_events_request_id ON rejected_events (request_id);
CREATE INDEX IF NOT EXISTS rejected_events_reason     ON rejected_events (workspace_id, site_id, reason_code);
CREATE INDEX IF NOT EXISTS rejected_events_received   ON rejected_events (workspace_id, site_id, received_at);
```

These three indexes match §2.6 target naming. The legacy `idx_rejected_received` and `idx_rejected_site` indexes are **untouched** (preserved for back-compat).

---

## Nullable-first migration rationale (§3.PR#3 migration rule)

The collector is not wired yet (§3.PR#5). Existing `rejected_events` rows pre-date the `ingest_requests` ledger and cannot be reconstructed back to a ledger row safely. Promoting any new column to `NOT NULL` at PR#3 time would either require an unsafe synthetic backfill or fail outright on legacy rows. The §3.PR#3 migration rule defers DB-level `NOT NULL` enforcement until §3.PR#5+ has run a verified backfill / cutover.

In the meantime, the application write path and the §2.12 SQL verification suite enforce the NOT-NULL invariants for **new v1 rows**:
- Check #15 is **JOIN-gated on `request_id`** — legacy rows with `request_id IS NULL` are naturally exempt.
- Checks #6 and #14 read the new singular `reason_code` via the COALESCE pattern documented below.

---

## Legacy `reason_codes[]` preservation (dual-write transition)

The legacy `reason_codes TEXT[] NOT NULL` column is **preserved** by PR#3 — never dropped, never altered. The migration backfills the new singular `reason_code` from `reason_codes[1]` for existing rows so both columns are populated on legacy data:

```sql
UPDATE rejected_events
SET reason_code = reason_codes[1]
WHERE reason_code IS NULL
  AND reason_codes IS NOT NULL
  AND array_length(reason_codes, 1) >= 1;
```

Bounded WHERE clause; idempotent on re-run.

The collector-side write transition (lands in §3.PR#5) is **dual-write**: every new write populates both `reason_code` (canonical singular) and appends to `reason_codes[]` (legacy array). Removal of `reason_codes[]` is **explicitly deferred** to a later PR after a full read-path audit confirms no consumer depends on it.

### `reason_code` read transition — COALESCE pattern

During the dual-write transition window, every reader of the rejected reason code should use:

```sql
COALESCE(reason_code, reason_codes[1])  -- SQL
```

```ts
reason_code ?? reason_codes?.[0] ?? null  // TypeScript
```

This produces the same value for legacy rows (where the backfill populated `reason_code`), for in-flight v1 rows (where the collector dual-writes), and for any edge-case row that somehow lacks `reason_code` (falls back to the legacy array's first element).

### Why no new TypeScript helper module in this PR

The repo's existing `rejected_events` reads live in `src/metrics/truth-metrics.ts` and operate on `reason_codes[]` (`unnest`, `= ANY`). Those queries continue to function unchanged because the legacy array is preserved; no read-path mutation is required. `src/collector/routes.ts` writes legacy `reason_codes[]` only — modifying the collector is §3.PR#5 scope and is deliberately out of PR#3. Per your "do not invent a large new repository/service layer just for this PR" rule, no new helper is added; the COALESCE pattern is documented here and covered by a structural smoke test asserting the migration carries the documented backfill.

---

## `raw_payload_sha256` nullable-first rationale

§2.6 target: `raw_payload_sha256 TEXT NOT NULL` — required on every v1 row. PR#3 lands it as nullable because legacy rejected rows do not carry the original payload bytes individually (they were stored as `raw JSONB` only) and re-hashing legacy `raw` would produce a hash of the wrong scope (often the request body, not the individual event envelope). Synthesising a `raw_payload_sha256` for legacy rows would be misleading; leaving it `NULL` is the honest record.

The §2.12 check #15 enforcement is JOIN-gated on `request_id`, so legacy rows (where `request_id IS NULL`) are naturally exempt from the non-null requirement. New v1 rows written by the §3.PR#5 collector will always populate `raw_payload_sha256`.

---

## Request-level rejection vs per-event rejection (§2.6 case table)

Two cases — both produce defensible proof, neither produces silent loss:

| Case | What is created | `raw_payload_sha256` source |
|---|---|---|
| **Whole request unparseable** (malformed JSON, wrong content-type, oversized body, auth failure) | `ingest_requests` row only — **no `rejected_events` row** | `ingest_requests.request_body_sha256` is the only proof; computed over the raw HTTP body bytes |
| **Parseable request, individual event envelope invalid** (e.g. `/v1/batch` with 9 valid + 1 invalid event; or `/v1/event` with a structurally valid JSON body that fails per-event validation) | `ingest_requests` row + one `rejected_events` row per invalid event | `rejected_events.raw_payload_sha256` is computed from that **individual event envelope / batch fragment**, independent of the request-level `request_body_sha256` |

Every v1 `rejected_events` row therefore carries a non-null `raw_payload_sha256` keyed to the rejected event itself, and §2.12 check #15 enforces this on new rows.

---

## What this PR does

1. Adds `migrations/005_rejected_events_evidence_columns.sql` — single `ALTER TABLE rejected_events` with **18 `ADD COLUMN IF NOT EXISTS`** clauses, **one bounded `UPDATE` backfill** for `reason_code`, and three `CREATE INDEX IF NOT EXISTS` statements (`rejected_events_request_id`, `rejected_events_reason`, `rejected_events_received`). Idempotent. No existing row is forced to a non-NULL value the application depends on. Legacy `reason_codes[]` preserved.
2. Updates `src/db/schema.sql` so fresh `initDb()` installs include the same 18 columns inside the `rejected_events` `CREATE TABLE` block, plus the three new indexes. (Same convention used by migrations 002 and 004.)
3. Updates `docs/sql/reconciliation/001_ingest_requests_reconciliation.sql` — adds **check 003** (rejected-side cross-table reconciliation) as a runnable `SELECT`, and removes the prior PR#3 TODO block since it is now implemented.
4. Updates two prior-PR tests that asserted "rejected-side TODO": one in `tests/ingest-requests.test.ts`, one in `tests/accepted-events-pr2.test.ts`. Both flipped to assert **check 003 is active** and the PR#3 TODO header is gone.
5. Adds `tests/rejected-events-pr3.test.ts` — pure-text-level structural smoke tests covering the migration, schema.sql, reconciliation SQL, and Track-B/scope-discipline assertions.
6. Adds this document.

---

## What this PR does NOT do

- **Does NOT modify `accepted_events`.** That was §3.PR#2 (CLOSED).
- **Does NOT modify `ingest_requests`.** That was §3.PR#1 (CLOSED).
- **Does NOT modify any source code in `src/`** — no collector route, no validator, no auth module, no metrics worker. The metrics worker's existing `unnest(reason_codes)` queries continue to function unchanged because the legacy column is preserved.
- **Does NOT introduce auth-derived `workspace_id` / `site_id` resolution.** That is §3.PR#4.
- **Does NOT wire the collector to write the new columns.** That is §3.PR#5.
- **Does NOT promote the dedup unique index.** That is §3.PR#6.
- **Does NOT add `/v1/event` or `/v1/batch` routes.** That is §3.PR#7.
- **Does NOT schedule the §2.12 verification suite.** That is §3.PR#8 — this PR ships only the runnable SQL.
- **Does NOT add the admin debug API.** That is §3.PR#9.
- **Does NOT introduce a foreign key from `rejected_events.request_id` → `ingest_requests.request_id`.** Existing repo uses FKs only for `replay_evidence_cards → replay_runs`; per the handoff, no FK in PR#3.
- **Does NOT rename the existing `raw JSONB NOT NULL` column to `raw_payload_jsonb`** (the §2.6 target name) and **does NOT drop NOT NULL on `raw`.** Renames / NOT-NULL drops on legacy hot-table columns are out of PR#3 scope. The eventual `raw → raw_payload_jsonb` reconciliation (30-day rejected-payload retention per Decision #8) is a separate, post-cutover PR.
- **Does NOT rename the existing PK `id BIGSERIAL` to `rejected_event_pk`** (the §2.6 target name). PK rename is out of PR#3 scope; check 003 uses `re.id` accordingly.
- **Does NOT introduce Track A scoring fields.** No `risk_score`, `classification`, `recommended_action`, `behavioural_score`, `bot_score`, `agent_score`, or any other scoring column. Track B Sprint 1 has no scoring surface (handoff §1 Sprint 1 Scope Exclusions).
- **Does NOT introduce bot detection or AI-agent detection** — out-of-scope per §4.1 Task 1.
- **Does NOT touch `traffic_class`** — that's an `accepted_events` column (set in PR#2, stays `'unknown'` in Sprint 1 per Decision #13). PR#3 doesn't add a parallel column on `rejected_events`.
- **Does NOT touch production website repos, GTM, GA4, LinkedIn, ThinSDK, the report renderer, the Track A harness at `/Users/admin/github/ams-qa-behaviour-tests`, or Core AMS at `/github/keigentechnologies/ams`.**
- **Does NOT build the future Track A backend bridge or any Core AMS scoring package.**

---

## Three deferrals from a literal §2.6 transcription (flagged for reviewer awareness)

1. **All §2.6 NOT NULL targets land nullable in PR#3** (`request_id`, `rejected_stage`, `reason_code`, `raw_payload_sha256`, `size_bytes`, `debug_mode`, `sample_visible_to_admin`). Same §3.PR#3 migration rule (legacy rows can't be backfilled to the canonical shape safely).
2. **The existing `raw JSONB NOT NULL` column is not renamed and not dropped to nullable.** §2.6 target: `raw_payload_jsonb JSONB` (nullable, purgeable, 30-day retention).
3. **The existing PK `id BIGSERIAL` is not renamed to `rejected_event_pk`.** Check 003 uses `re.id` accordingly.

---

## Reconciliation SQL update

`docs/sql/reconciliation/001_ingest_requests_reconciliation.sql` now contains three runnable checks (the prior PR#3 TODO block has been removed because it is now implemented):

- **Check 001 (unchanged):** `ingest_requests` internal-count invariant.
- **Check 002 (unchanged):** accepted-side cross-table.
- **Check 003 (NEW, runnable):**
  ```sql
  SELECT ir.request_id,
         ir.rejected_count    AS ledger_rejected,
         COUNT(re.id)         AS table_rejected
  FROM ingest_requests ir
  LEFT JOIN rejected_events re ON re.request_id = ir.request_id
  WHERE ir.reconciled_at IS NOT NULL
  GROUP BY ir.request_id, ir.rejected_count
  HAVING ir.rejected_count <> COUNT(re.id);
  ```
  Healthy result: zero rows. Legacy `rejected_events` rows with `request_id IS NULL` are exempt by the LEFT JOIN gate. Per §2.6 case table, request-level rejections (whole request unparseable) have `rejected_count = 0` and zero matching rejected_events rows, so the check holds trivially.

No scheduled execution in this PR — that is §3.PR#8.

---

## Local test command

```bash
cd /Users/admin/github/buyerrecon-backend
npm test
```

Vitest runs `tests/rejected-events-pr3.test.ts` alongside the existing test files. All tests are pure-text-level structural smoke — no Postgres connection.

To verify the migration end-to-end against a **local dev** Postgres (do **not** point `$DATABASE_URL` at production):

```bash
psql "$DATABASE_URL" -f migrations/005_rejected_events_evidence_columns.sql
psql "$DATABASE_URL" -c '\d rejected_events'
psql "$DATABASE_URL" -f docs/sql/reconciliation/001_ingest_requests_reconciliation.sql
```

`\d rejected_events` should show all 18 new columns + the three new indexes. All three reconciliation queries (check 001, 002, 003) should return zero rows on an empty / healthy database.

---

## Rollback plan

Migration is strictly additive. Rollback drops the three new indexes and the 18 new columns:

```sql
DROP INDEX IF EXISTS rejected_events_received;
DROP INDEX IF EXISTS rejected_events_reason;
DROP INDEX IF EXISTS rejected_events_request_id;
ALTER TABLE rejected_events
  DROP COLUMN IF EXISTS rejected_at,
  DROP COLUMN IF EXISTS sample_visible_to_admin,
  DROP COLUMN IF EXISTS debug_mode,
  DROP COLUMN IF EXISTS size_bytes,
  DROP COLUMN IF EXISTS raw_payload_sha256,
  DROP COLUMN IF EXISTS pii_hits_jsonb,
  DROP COLUMN IF EXISTS schema_errors_jsonb,
  DROP COLUMN IF EXISTS reason_detail,
  DROP COLUMN IF EXISTS reason_code,
  DROP COLUMN IF EXISTS rejected_stage,
  DROP COLUMN IF EXISTS schema_version,
  DROP COLUMN IF EXISTS schema_key,
  DROP COLUMN IF EXISTS event_type,
  DROP COLUMN IF EXISTS event_name,
  DROP COLUMN IF EXISTS id_format,
  DROP COLUMN IF EXISTS client_event_id,
  DROP COLUMN IF EXISTS workspace_id,
  DROP COLUMN IF EXISTS request_id;
```

- **Legacy `reason_codes[]` is preserved** throughout PR#3 — rollback cannot affect it. Existing rejected rows remain readable through the legacy `reason_codes[]` read path (`src/metrics/truth-metrics.ts` continues to function).
- The `reason_code` backfill values are dropped along with the column; this is fine because the source of truth (`reason_codes[]`) is untouched and the singular column was a transition aid, not a source.
- **No existing `accepted_events` / `ingest_requests` data is affected.**
- No application code yet reads or writes the new columns, so rollback cannot break a runtime path.
- Reverting check 003 in `001_ingest_requests_reconciliation.sql` and reverting the two test-assertion flips in `tests/ingest-requests.test.ts` + `tests/accepted-events-pr2.test.ts` is straightforward (removed file in `git`, revert the file edits).

---

## Tests run

- `npx tsc --noEmit` — pass (clean exit).
- `npm test` — pass. See "Final report" in the conversation for the exact post-edit count.

---

## Relationship to the three-part architecture

- **PR#3 is Track B evidence schema** — additive columns + indexes + reconciliation SQL. No scoring.
- **PR#3 is not Track A scoring.** No risk score, no classification, no recommended action, no behavioural-quality column, no bot/agent flag.
- **PR#3 is not Core AMS product code.** No package import from `/github/keigentechnologies/ams`. No move of harness code into Core AMS.
- **Track A scoring remains a local harness** at `/Users/admin/github/ams-qa-behaviour-tests` until a later, explicitly scoped bridge PR.
- **Future direction (not built here):** Track B DB evidence → adapter / bridge → Core AMS scoring package → RECORD_ONLY scoring/report output (stored in a separate table, never overwriting evidence rows). The bridge is a separate Track A → Core AMS deliverable.
- **Dependency chain to Track A Sprint 2:** §3.PR#1 (CLOSED) → §3.PR#2 (CLOSED) → **§3.PR#3 (this)** → §3.PR#4 → §3.PR#5 → §3.PR#7 → Track A Sprint 2 backend bridge → one-site RECORD_ONLY → five-site RECORD_ONLY.

---

## Hard guarantees for this PR

- **Repo:** `buyerrecon-backend` only. Track A harness and Core AMS untouched.
- **No production:** no production website repo touched; no GTM / GA4 / LinkedIn pixel touched; no ThinSDK file touched; no production endpoint called; no production database migration run.
- **No live tests:** `npm test` runs Vitest in pure unit mode. `LIVE_TESTS=true` never set. No Playwright, no network call.
- **No collector / route / validator / auth / metrics code** modified anywhere under `src/`.
- **No `accepted_events` or `ingest_requests` change** — verified by structural smoke tests asserting both blocks retain their PR#1 / PR#2 shape.
- **No Track A scoring surface introduced** — verified by structural smoke tests asserting absence of `risk_score`, `classification`, `recommended_action`, `behavioural_score`, `bot_score`, `agent_score`, and bot/agent column patterns.
- **No commit was created by this PR.** Working-tree changes only; `git status` will show the new files until the maintainer reviews and commits.

---

## Next PR — §3.PR#4

Workspace / site resolution layer. Adds `src/auth/workspace.ts` + a new `site_write_tokens (token_hash, workspace_id, site_id, disabled_at)` table; middleware that resolves auth-derived `workspace_id` + `site_id` and rejects payload-side boundary mismatch with `workspace_site_mismatch`. **Out of scope for PR#3 — do not start.**
