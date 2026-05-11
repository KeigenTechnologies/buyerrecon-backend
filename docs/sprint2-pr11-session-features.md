# Sprint 1 PR#11 — `session_features` (downstream factual extraction)

> **Hard-rule disclaimer.** PR#11 is Track B (BuyerRecon Evidence Foundation)
> only. It is **NOT** Track A (AMS Behaviour QA scoring harness) and **NOT**
> Core AMS (the future productized scoring/report home). PR#11 introduces NO
> scoring, NO classification, NO bot detection, NO AI-agent taxonomy, NO
> `risk_score` / `buyer_score` / `intent_score` / `bot_score` / `human_score`
> / `classification` / `recommended_action` / `confidence_band` / `is_bot` /
> `is_agent` / `ai_agent` / `lead_quality` / `crm` / `company_enrichment` /
> `ip_enrichment` surfaces. No production DB. No production auto collection.
> No deploy. No commit, no push.
>
> `accepted_events` remains the raw evidence ledger. `session_features` is
> the first downstream factual layer above it.

## 1. PR#11 scope

| Goal | In scope |
|---|---|
| New `session_features` table — one row per `(workspace_id, site_id, session_id, extraction_version)` | ✅ |
| Idempotent on-demand extractor reading `accepted_events`, upserting `session_features` | ✅ |
| Tests (pure + opt-in DB) | ✅ |
| `npm run extract:session-features` script entry | ✅ |
| Verification SQL for operators | ✅ |
| Cron / scheduler wiring | ❌ (operator wires later) |
| Legacy `event_contract_version='legacy-thin-v2.0'` extraction | ❌ (v1 only) |
| Purge / delete cascade handling | ❌ (future PR) |
| Any scoring / classification / dashboard wording | ❌ |
| Any change to `/v1/event` or `/v1/batch` | ❌ |
| Any change to orchestrator, row-builders, persistence, validation, PR#5 helpers, `src/collector/v1/index.ts` barrel, `src/app.ts`, `src/server.ts`, `src/auth/workspace.ts`, migrations 002–007 | ❌ |
| Any production / staging network call | ❌ (operator runs staging later) |

## 2. Non-scoring boundary

`session_features` columns are **factual aggregates only**:

- counts (`source_event_count`, `page_view_count`, `cta_click_count`,
  `form_start_count`, `form_submit_count`, `unique_path_count`)
- timestamps (`first_seen_at`, `last_seen_at`, `session_duration_ms`,
  `extracted_at`)
- evidence references (`source_event_id_min/max`, `first_event_id`,
  `last_event_id`)
- URL / path facts (`landing_page_url/path`, `last_page_url/path`)
- presence flags derived directly from counts (`has_cta_click`,
  `has_form_start`, `has_form_submit`)
- sparse JSONB count maps (`event_name_counts`, `schema_key_counts`,
  `consent_source_counts`)
- canonical-projection key counts (`canonical_key_count_min/max`) for
  evidence-quality observation

**Nothing in this table is a judgement.** Whether a session is "good" or
"bad", "human" or "bot", "buyer" or "noise", "high intent" or "low intent"
lives in a separate, later product layer (Core AMS) and never bleeds into
collector-side derived tables.

## 3. Schema contract

### 3.1 Migration

- File: `migrations/008_session_features.sql`
- Idempotent: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`
- No `CONCURRENTLY` needed — `session_features` starts empty and is
  rebuilt from `accepted_events` at any time.
- Apply on the operator host via `psql "$DATABASE_URL" -f migrations/008_session_features.sql`.
- The same block is also appended to `src/db/schema.sql` so `initDb()` works
  on fresh boots.

### 3.2 Columns (full list — see `migrations/008_session_features.sql` for SQL)

| Column | Type | Notes |
|---|---|---|
| `session_features_id` | `BIGSERIAL` PRIMARY KEY | stable across rerun upserts |
| `workspace_id` | `TEXT NOT NULL` | boundary |
| `site_id` | `TEXT NOT NULL` | boundary |
| `session_id` | `TEXT NOT NULL` | boundary |
| `extraction_version` | `TEXT NOT NULL` | default `session-features-v0.1` |
| `extracted_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | refreshed on every upsert |
| `first_seen_at` | `TIMESTAMPTZ NOT NULL` | `MIN(received_at)` |
| `last_seen_at` | `TIMESTAMPTZ NOT NULL` | `MAX(received_at)` |
| `session_duration_ms` | `BIGINT NOT NULL` | `(last - first) * 1000` |
| `source_event_id_min/max` | `BIGINT` | `MIN/MAX(event_id)` for forensics |
| `first_event_id`, `last_event_id` | `BIGINT` | endpoint event ids (deterministic tie-break) |
| `source_event_count` | `INT NOT NULL` | `COUNT(*)` |
| `page_view_count`, `cta_click_count`, `form_start_count`, `form_submit_count` | `INT NOT NULL DEFAULT 0` | `COUNT(*) FILTER (WHERE raw->>'event_name'=…)` |
| `unique_path_count` | `INT NOT NULL DEFAULT 0` | `COUNT(DISTINCT raw->>'page_path')` excluding nulls |
| `landing_page_url/path`, `last_page_url/path` | `TEXT` | from earliest / latest event |
| `has_cta_click`, `has_form_start`, `has_form_submit` | `BOOLEAN NOT NULL DEFAULT FALSE` | `*_count > 0` |
| `event_name_counts`, `schema_key_counts`, `consent_source_counts` | `JSONB NOT NULL DEFAULT '{}'::jsonb` | sparse maps |
| `canonical_key_count_min/max` | `INT` | from `jsonb_object_keys(canonical_jsonb)` per row |

Natural key: `UNIQUE (workspace_id, site_id, session_id, extraction_version)`.

Indexes:

- `(workspace_id, site_id, last_seen_at DESC)`
- `(workspace_id, site_id, session_id)`
- `(extraction_version, extracted_at DESC)`

## 4. Extraction semantics

### 4.1 Locked filters (apply to candidate session selection AND aggregation)

- `event_contract_version = 'event-contract-v0.1'` _(v1 only; legacy excluded)_
- `event_origin = 'browser'` _(visitor sessions only)_
- `workspace_id IS NOT NULL AND site_id IS NOT NULL`
- `session_id IS NOT NULL AND session_id <> '__server__'`

### 4.2 Candidate-window vs full-session aggregation (CRITICAL)

The window (`SINCE_HOURS`, default 168, override via `SINCE` / `UNTIL` ISO
timestamps) selects **candidate sessions** — sessions touched at least once
inside the window. Aggregation then runs over **all matching
accepted_events for those candidate sessions**, regardless of `received_at`.

This prevents a narrow later run from overwriting full session facts with
partial-window facts. Concretely:

- An older event whose `received_at` is **before** the window start is
  included in aggregation if a newer event (inside the window) for the
  same session pulled that session into the candidate set.
- A session whose entire history lies outside the window is **not**
  extracted.

The SQL implementation is:

```
WITH candidate_sessions AS (
  SELECT DISTINCT workspace_id, site_id, session_id
    FROM accepted_events
   WHERE received_at >= $1 AND received_at <= $2
     AND … locked filters …
)
session_events AS (
  SELECT … FROM accepted_events ae
   JOIN candidate_sessions cs USING (workspace_id, site_id, session_id)
  WHERE … locked filters …      -- NOTE: no received_at filter here
)
```

The PR#11 pure tests assert this shape via regex inspection of the SQL
string (`EXTRACTION_SQL`) — the candidate window filter must appear
**only** in `candidate_sessions`, never inside `session_events`.

### 4.3 Timing source

Server clock (`accepted_events.received_at`) — not `raw->>'occurred_at'`.
The server clock is monotonic, authoritative, and not subject to client
clock skew. Already gated by PR#5 validation into a `(-24h, +5min)` window
so the two won't diverge wildly.

### 4.4 Landing / last endpoint determinism

```
ROW_NUMBER() OVER (PARTITION BY workspace_id, site_id, session_id
                   ORDER BY received_at ASC,  event_id ASC ) AS rn_first
ROW_NUMBER() OVER (PARTITION BY workspace_id, site_id, session_id
                   ORDER BY received_at DESC, event_id DESC) AS rn_last
```

Tie-break on `accepted_events.event_id` (BIGSERIAL, monotonic) when two
events share the same `received_at`. Result is deterministic.

### 4.5 Idempotency

```
INSERT INTO session_features (...)
SELECT ...
ON CONFLICT (workspace_id, site_id, session_id, extraction_version)
DO UPDATE SET ... every aggregate column ...
RETURNING session_features_id, workspace_id, site_id, session_id
```

`session_features_id` (`BIGSERIAL` PK) is **NOT** in the `DO UPDATE SET`
list, so it's stable across reruns. The `extracted_at` column refreshes to
NOW() on every upsert so the operator can see when each row was last
recomputed.

### 4.6 Late-arriving event behaviour

`accepted_events` is append-only. New events arriving for an existing
session after a previous extraction simply land in the ledger; the next
extractor run upserts the same `session_features` row with updated counts,
`last_seen_at`, `last_page_url`, etc. No row delete, no row duplication,
no lost facts.

### 4.7 `consent_source` resolution

`COALESCE(accepted_events.consent_source, raw->>'consent_source')`. The
top-level column is populated by row-builders for v1 events; the COALESCE
defends against legacy or sparse rows.

### 4.8 Extractor inputs

| Env | Required | Default | Effect |
|---|---|---|---|
| `DATABASE_URL` | yes | — | masked in output |
| `WORKSPACE_ID` | no | none | optional filter |
| `SITE_ID` | no | none | optional filter |
| `SINCE_HOURS` | no | `168` | candidate window lower bound (`NOW - hours`) |
| `SINCE` | no | — | ISO timestamp; overrides `SINCE_HOURS` |
| `UNTIL` | no | NOW | ISO timestamp; overrides upper bound |
| `EXTRACTION_VERSION` | no | `session-features-v0.1` | scopes the upsert key |

## 5. Local proof

```bash
# After PR#11 lands:
npx tsc --noEmit
unset TEST_DATABASE_URL; npm test          # 1194 + new pure tests

# Apply migration 008 to the local test DB (one-time, idempotent).
psql "postgres://$(whoami)@localhost:5432/br_collector_test" \
  -f migrations/008_session_features.sql

# Run the opt-in DB suite (includes new session-features.dbtest.ts).
export TEST_DATABASE_URL="postgres://$(whoami)@localhost:5432/br_collector_test"
npm run test:db:v1

# Run the extractor against the existing buyerrecon.com smoke boundary
# (1 accepted page_view row from prior PR#8c smoke). Expect 1 row upserted.
DATABASE_URL="postgres://$(whoami)@localhost:5432/br_collector_test" \
  WORKSPACE_ID=buyerrecon_smoke_ws \
  SITE_ID=buyerrecon_com \
  SINCE_HOURS=720 \
  npm run extract:session-features

# Verify.
psql "$TEST_DATABASE_URL" -c "
  SELECT workspace_id, site_id, session_id, extraction_version,
         source_event_count, page_view_count, cta_click_count,
         form_start_count, form_submit_count, unique_path_count,
         landing_page_url, last_page_url,
         canonical_key_count_min, canonical_key_count_max
    FROM session_features WHERE workspace_id = 'buyerrecon_smoke_ws';"
```

## 6. Staging proof (operator-run only — NOT executed in PR#11)

```bash
# Operator on staging host AFTER explicit go-ahead.
cd /opt/buyerrecon-backend
set -a; source .env; source /root/buyerrecon_staging_site_token_meta.env; set +a

# 1. Apply migration 008.
psql "$DATABASE_URL" -f migrations/008_session_features.sql

# 2. Extract over staging's accepted_events.
EXTRACTION_VERSION=session-features-v0.1 SINCE_HOURS=168 \
  npm run extract:session-features

# 3. Inspect.
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM session_features
   WHERE workspace_id = '$WORKSPACE_ID'
     AND extraction_version = 'session-features-v0.1';"

# 4. Run verification SQL (docs/sql/verification/06_session_features_invariants.sql).
psql "$DATABASE_URL" -f docs/sql/verification/06_session_features_invariants.sql
```

PR#11 does **not** run staging itself. The staging recipe is reproducible from
this doc.

## 7. Rollback

```sql
DROP INDEX IF EXISTS session_features_extraction;
DROP INDEX IF EXISTS session_features_session;
DROP INDEX IF EXISTS session_features_workspace_site;
DROP TABLE IF EXISTS session_features;
```

Safe — no FK references this table; the raw ledger (`accepted_events`,
`rejected_events`, `ingest_requests`, `site_write_tokens`) is untouched.
To fully revert PR#11: drop the table (above), delete migration 008, revert
the appended block in `src/db/schema.sql`, delete the extractor script, the
two test files, the verification SQL, this doc, and revert the
`extract:session-features` script line in `package.json`.

## 8. Codex review checklist

1. ✅ `migrations/008_session_features.sql` only `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`. No `ALTER TABLE` on any pre-existing table. No `CONCURRENTLY`.
2. ✅ `src/db/schema.sql` carries a mirrored `session_features` block (no change to the `accepted_events` / `rejected_events` / `ingest_requests` / `site_write_tokens` blocks).
3. ✅ `scripts/extract-session-features.ts` contains no `INSERT INTO accepted_events`, no `INSERT INTO rejected_events`, no `INSERT INTO ingest_requests`, no `INSERT INTO site_write_tokens`, no `UPDATE` against those tables, no `DELETE`, no `TRUNCATE`, no `DROP`, no `ALTER`.
4. ✅ Extractor SQL never selects `token_hash` or `ip_hash`. Extractor never reads `SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`, or any auth secret.
5. ✅ Extractor's `INSERT INTO session_features` column list and `DO UPDATE` clause contain none of: `risk_score`, `buyer_score`, `intent_score`, `bot_score`, `human_score`, `classification`, `recommended_action`, `confidence_band`, `is_bot`, `is_agent`, `ai_agent`, `lead_quality`, `crm`, `company_enrichment`, `ip_enrichment`.
6. ✅ Locked filters present in `candidate_sessions`: `event_contract_version = 'event-contract-v0.1'`, `event_origin = 'browser'`, `session_id <> '__server__'`, `workspace_id/site_id/session_id IS NOT NULL`.
7. ✅ `session_events` CTE has no `received_at` window filter — candidate-window vs full-session aggregation rule.
8. ✅ `session_duration_ms` computed from `received_at` (not `raw->>'occurred_at'`).
9. ✅ `ROW_NUMBER` uses `(received_at, event_id)` tie-break.
10. ✅ `ON CONFLICT (workspace_id, site_id, session_id, extraction_version) DO UPDATE` is the only upsert syntax; `session_features_id` is NOT in the `DO UPDATE SET` list (stable identity).
11. ✅ `package.json` has `extract:session-features` script. No new runtime dependencies.
12. ✅ Pure tests in `tests/v1/session-features-extraction.test.ts` assert: option parsing defaults / overrides, SQL contains locked filters, SQL contains no banned identifiers, no source-table mutations, idempotency syntax present, `runExtraction` calls pool.query exactly once with the locked parameter order.
13. ✅ DB tests in `tests/v1/db/session-features.dbtest.ts` cover: page-view-only, mixed session, multiple paths, cross-workspace isolation, `__server__` skip, legacy contract skip, non-browser skip, idempotent rerun, late-arriving event update, version isolation, canonical min/max, tie-break determinism, candidate-window semantics (older event in candidate session aggregated; session entirely outside window skipped), no source-table mutation.
14. ✅ No edits to `src/collector/v1/orchestrator.ts`, `row-builders.ts`, `routes.ts`, `persistence.ts`, `config.ts`, `http-context.ts`, `auth-route.ts`, `src/collector/v1/index.ts` (barrel still 4 `export *` lines), `src/app.ts`, `src/server.ts`, `src/auth/workspace.ts`, `migrations/002–007`.
15. ✅ `npx tsc --noEmit` clean.
16. ✅ `unset TEST_DATABASE_URL; npm test` passes (1194 + new pure tests).
17. ✅ `npm run test:db:v1` passes (DB-suite count + new dbtest count, 1 skipped Promise.all variant unchanged).
18. ✅ No commit. No push. No deploy.
