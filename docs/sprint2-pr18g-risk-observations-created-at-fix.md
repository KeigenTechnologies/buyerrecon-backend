# BuyerRecon PR#18g — Fix `risk_observations_v0_1` timestamp query in Timing/Product Context observer

Status: **narrow code fix. Verdict: PASS — `COUNT_RISK_OBSERVATIONS_SQL` now filters on the canonical `created_at` column; four new schema-guard tests (K.6 → K.9) prevent regression; tsc clean; 52 / 52 targeted observer tests pass. PR#18g does NOT by itself transition `risk_evidence_status` to `'usable_later'` — a follow-up staging proof must re-run and confirm the corrected query succeeds.**

PR#18g is the narrow code-fix follow-up recommended by PR#18f §8. It changes exactly two lines of SQL in `src/scoring/timing-product-context-observer/query.ts` — substituting the canonical `created_at` column for the non-existent `derived_at` column on `public.risk_observations_v0_1` — and adds four schema-guard tests in `tests/v1/timing-product-context-observer.test.ts` that prevent the same bug class from re-regressing. No migration, no `schema.sql` edit, no DB write, no grant change, no runtime / customer / Lane / AMS / Gate 4 work.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18g.**
> **No production traffic is approved by PR#18g.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18g; no production artefact / config mode flip is approved by PR#18g.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime, no AMS repo modification is approved by PR#18g.**
> **No migrations, no `schema.sql` change, no DB grants, no DB writes, no durable table, no runtime scoring are approved or introduced by PR#18g.**
> **PR#18g does NOT pre-authorise the follow-up staging proof PR; that PR remains separately gated by its own explicit Helen GO.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `96d0563` — "Sprint 2 PR#18f: record risk observations source health (#38)").

PR branch: `buyerrecon-sprint2-pr18g-risk-observations-created-at-fix`

Mandatory reference compliance:

- `docs/sprint2-pr18f-risk-observations-source-health.md` — PR#18f §1 / §5 / §8 directly motivates PR#18g's scope: the categorical `BLOCKED / schema_mismatch` finding and the narrow code-fix recommendation.
- `docs/sprint2-pr18e-pass1-output-contract-planning.md` — §7 `risk_evidence_status` carry-forward. PR#18g lands the fix but does NOT itself flip the Pass 1 contract field; that transition requires the follow-up staging proof.
- `docs/sprint2-pr18c-timing-product-context-observer.md` — the observer being patched.
- `src/scoring/timing-product-context-observer/query.ts` — the file containing `COUNT_RISK_OBSERVATIONS_SQL`.
- `tests/v1/timing-product-context-observer.test.ts` — the suite gaining schema-guard tests K.6 → K.9.
- `src/db/schema.sql` lines 669–720 and `migrations/013_risk_observations_v0_1.sql` lines 105–171 — the canonical sources the schema-guard tests read.

---

## 1. Why this PR exists

PR#18f (PR #38, merge `96d0563`) recorded the source-health diagnosis for `public.risk_observations_v0_1`:

| Field | Value |
|---|---|
| `table_exists` | true |
| `select_privilege` | true |
| `connected_role` | `buyerrecon_app` |
| `derived_at_present` | **false** |
| `created_at_present` | **true** |
| `observer_query_repro` | `ERROR column "derived_at" does not exist` (PostgreSQL `42703 / undefined_column`) |
| `corrected_query_with_created_at` | `2` |
| `workspace_site_count_no_time_filter` | `2` |
| `final verdict` | **BLOCKED / schema_mismatch** |

PR#18f §8 explicitly recommended a narrow code-fix PR with the following scope: change `COUNT_RISK_OBSERVATIONS_SQL` from `derived_at` to `created_at`, add a schema-guard test pair (paralleling K.2 → K.5), re-run targeted observer tests, and run a follow-up staging proof. PR#18g implements the first three of those four items — the staging re-run is left to a separately-gated follow-up under its own Helen GO.

The same bug class was already caught by Codex for `session_behavioural_features_v0_2.last_refreshed_at` → `last_seen_at` in the PR#18c blocker patch. The schema-guard tests K.2 → K.5 covered that sibling table but did not cover `risk_observations_v0_1`. PR#18g closes that gap.

---

## 2. Exact code change

### 2.1 `src/scoring/timing-product-context-observer/query.ts` — `COUNT_RISK_OBSERVATIONS_SQL`

Two lines changed (`derived_at` → `created_at`):

Before:

```sql
SELECT count(*)::bigint AS n
  FROM public.risk_observations_v0_1
 WHERE workspace_id = $3
   AND site_id      = $4
   AND derived_at   >= $1
   AND derived_at   <  $2
```

After:

```sql
SELECT count(*)::bigint AS n
  FROM public.risk_observations_v0_1
 WHERE workspace_id = $3
   AND site_id      = $4
   AND created_at   >= $1
   AND created_at   <  $2
```

Parameter order and shape are unchanged (`$1` window_start, `$2` window_end, `$3` workspace_id, `$4` site_id). The query remains SELECT-only, count-only, window-bounded, and workspace/site-bounded.

### 2.2 Why `created_at` is the right column

- **Schema-backed**: `src/db/schema.sql` lines 669–720 declares `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` on `risk_observations_v0_1`. There is no `derived_at` column anywhere in the table.
- **Migration-backed**: `migrations/013_risk_observations_v0_1.sql` lines 105–147 (the canonical creation point) carries the same column list, including `created_at`.
- **Indexed**: `migrations/013_risk_observations_v0_1.sql` lines 149–150 declares `CREATE INDEX IF NOT EXISTS risk_observations_v0_1_workspace_site ON risk_observations_v0_1 (workspace_id, site_id, created_at DESC)`. The corrected query's `(workspace_id, site_id, created_at)` predicate shape directly exploits this index.
- **Staging-confirmed**: PR#18f §4 ran the corrected query against the live staging DB; it returned `2` (the actual row count for the staging proof boundary) — no error.
- **Cross-checked against sibling tables**: `poi_observations_v0_1` and `poi_sequence_observations_v0_1` *do* have a `derived_at` column (declared NOT NULL in schema.sql) — those queries are unchanged. Only `risk_observations_v0_1` has the missing column. PR#18g's change is scoped to that one table.

### 2.3 No other code paths changed

- `src/scoring/timing-product-context-observer/runner.ts`: untouched. The runner's helper `countOptional` already routes `COUNT_RISK_OBSERVATIONS_SQL` through the same path it used before; the SQL change is transparent to the helper.
- `src/scoring/timing-product-context-observer/{mapper,report,index,types}.ts`: untouched.
- `scripts/timing-product-context-observation-report.ts`: untouched.
- `src/db/schema.sql`: untouched (verifying tests read it, do not mutate it).
- `migrations/`: untouched (verifying test reads `013_risk_observations_v0_1.sql`, does not mutate).
- `package.json`: untouched.

---

## 3. Tests added

Four new tests added to the `K. SQL constants are SELECT-only` describe block in `tests/v1/timing-product-context-observer.test.ts`, paralleling the K.2 → K.5 pattern that already covers `session_behavioural_features_v0_2` and `session_features`.

| Test | Asserts |
|---|---|
| **K.6** `risk_observations_v0_1 SQL uses canonical created_at (not derived_at)` | `COUNT_RISK_OBSERVATIONS_SQL` does NOT match `/derived_at/` AND DOES match `/created_at/`. |
| **K.7** `query.ts COUNT_RISK_OBSERVATIONS_SQL block contains no derived_at reference` | The exported constant does not contain `\bderived_at\b` AND does contain `FROM public.risk_observations_v0_1`. Scoped narrowly so the POI queries (which legitimately use `derived_at`) are unaffected. |
| **K.8** `risk_observations_v0_1.created_at column exists in canonical schema.sql AND derived_at does not` | Loads `src/db/schema.sql`, isolates the `CREATE TABLE IF NOT EXISTS risk_observations_v0_1 (...)` block, and asserts (a) `\bcreated_at\b\s+TIMESTAMPTZ` is declared inside it, (b) `\bderived_at\b` is NOT declared inside it. |
| **K.9** `migrations/013_risk_observations_v0_1.sql indexes risk_observations on created_at (not derived_at)` | Loads the canonical migration, asserts the workspace_site index uses `(workspace_id, site_id, created_at DESC)`, and asserts the `CREATE TABLE` block does NOT declare `\bderived_at\b`. |

K.6 + K.7 are the immediate regression guards (preventing someone from re-introducing `derived_at` in the observer SQL). K.8 + K.9 are the schema-source-of-truth guards (preventing the schema and migration from drifting out from under the observer in either direction).

If anyone reintroduces `derived_at` for `risk_observations_v0_1` — in `query.ts`, in the schema CREATE TABLE block, or in the migration — at least one of K.6 / K.7 / K.8 / K.9 fails. Combined with the K.2 / K.3 / K.4 / K.5 tests that already exist for `session_behavioural_features_v0_2` and `session_features`, the observer's SQL constants now have schema-guard coverage for every optional-source timestamp column it filters on.

---

## 4. Validation results

| Check | Result |
|---|---|
| `git status --short --untracked-files=all` | 2 modified files + 1 new file: `src/scoring/timing-product-context-observer/query.ts` (M), `tests/v1/timing-product-context-observer.test.ts` (M), `docs/sprint2-pr18g-risk-observations-created-at-fix.md` (A). |
| `git diff --check` | clean (no whitespace errors, no conflict markers). |
| `npx tsc --noEmit` | clean (no output). |
| `npx vitest run tests/v1/timing-product-context-observer.test.ts` | **52 / 52 tests passed** (48 prior + 4 new K.6 → K.9). Duration ~216 ms. |
| SQL write-verb sweep over changed observer files (`query.ts`) | No matches for `\b(INSERT\|UPDATE\|DELETE\|TRUNCATE\|ALTER\|CREATE\|DROP\|GRANT\|REVOKE)\b` — observer remains SELECT-only. |
| `derived_at` references remaining in `COUNT_RISK_OBSERVATIONS_SQL` | **none** (K.6, K.7 confirm). |
| `derived_at` references remaining elsewhere in `query.ts` | only `COUNT_POI_OBSERVATIONS_SQL` and `COUNT_POI_SEQUENCE_OBSERVATIONS_SQL`, both of which are CORRECT (POI tables declare `derived_at` as NOT NULL columns; the observer filters on those tables match the canonical schema). |
| `created_at` is schema-backed for `risk_observations_v0_1` | **yes** (K.8 confirms by reading `src/db/schema.sql`). |
| Secret-safety grep over changed files | matches are all forbidden-item references in comments / prohibition docs; no real Bearer / Authorization / DSN / token_hash / pepper / UUID / payload / PEM body / env-var assignment values anywhere. |

### 4.1 SQL diff summary

```
-   AND derived_at   >= $1
-   AND derived_at   <  $2
+   AND created_at   >= $1
+   AND created_at   <  $2
```

Two lines changed inside `COUNT_RISK_OBSERVATIONS_SQL`. No other SQL constant modified.

### 4.2 Test-file additions

Four new `it(...)` blocks inside the existing `K. SQL constants are SELECT-only` describe (K.6 → K.9). One new symbol imported from the observer module (`COUNT_RISK_OBSERVATIONS_SQL`). No existing test modified; no existing test weakened.

---

## 5. Remaining requirement before risk evidence becomes usable

PR#18g lands the code fix but does **not by itself** transition the PR#18e §7 / §4.1 `risk_evidence_status` field from `'warning'` / `'unavailable'` to `'usable_later'`. That transition requires:

1. **PR#18g merge** (this PR).
2. **A follow-up staging proof PR**, separately gated by its own Helen GO. Scope:
   - Re-run either the full Timing / Product-Context observer staging proof (the same operator command sequence used in PR#18d) OR a narrower targeted risk-source-health proof, against the Hetzner staging host.
   - Confirm the observer report no longer surfaces an `optional_source_count_query_failed / warn / public.risk_observations_v0_1` anomaly.
   - Confirm the report's `source_counts.risk_observations_v0_1_in_window` field reflects a real count (today: `2` per PR#18f §4) rather than the helper's default-on-failure `0`.
   - Record the categorical evidence in a docs-only proof PR.
3. **An amendment to PR#18e Pass 1 contract** (`pass1-output-contract-v0.2`), separately gated, to allow `risk_evidence_status` to transition to `'usable_later'`. PR#18g does NOT make this contract change.

Until all three steps complete, no Pass 1 runtime / Trust runtime / Pass 2 runtime path may consume `risk_observations_v0_1` evidence. PR#18g moves the *root cause* from "unfixable due to schema mismatch" to "fixable, awaiting a staging re-proof"; the contract-level posture in PR#18e remains binding.

---

## 6. Boundaries (re-asserted)

- **No migrations.** No new file under `migrations/`. The canonical `013_risk_observations_v0_1.sql` is read by K.9 but never modified.
- **No `schema.sql` change.** Read by K.8 / K.9, never modified.
- **No DB grants.** PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety untouched. The existing `013` migration grants (`buyerrecon_migrator` ALL, `buyerrecon_scoring_worker` SELECT+INSERT+UPDATE, `buyerrecon_internal_readonly` SELECT, `buyerrecon_customer_api` REVOKED) stand.
- **No DB writes.** PR#18g modifies a TypeScript SQL string constant. No DDL, no DML, no temp table.
- **No durable table.** No new table introduced. The observer module's runtime behaviour is unchanged except that its risk-observations count query now succeeds against the canonical schema.
- **No runtime scoring.** The observer remains the only Timing / Product-Context surface; it is still read-only and emits no scoring decision.
- **No Pass 1 runtime, no Trust runtime, no Pass 2 runtime.** PR#18g changes neither the Pass 1 contract nor any runtime path.
- **No customer output.** The observer's report-level redaction (PR#18c §10) is untouched.
- **No Lane A/B writer.** PR#17f / PR#17q grant safety stands.
- **No AMS runtime bridge.** No AMS file modified. No AMS PR opened. PR#18b §4.1.1 dirty-worktree rule still applies; AMS observations remain reference-only.
- **No Gate 4.** Gate 4 PR B / PR C / PR D / PR E remain separately gated.
- **No production `endpointUrl` re-flip.** No production traffic. No Track A. No Playwright. No knobs / dashboard. No website ThinSDK production activation. No production artefact / config mode flip.
- **No secrets in any artefact.** No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw payload / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this PR's diff, in this doc, in any commit message, or in any test fixture.

---

End of PR#18g. **Verdict: PASS — `COUNT_RISK_OBSERVATIONS_SQL` now filters on the canonical schema-backed and indexed `created_at` column instead of the non-existent `derived_at`; four new schema-guard tests (K.6 → K.9) prevent regression; `npx tsc --noEmit` is clean; `npx vitest run tests/v1/timing-product-context-observer.test.ts` reports 52 / 52 tests pass; no SQL write verbs introduced; the observer remains read-only with no migration / schema / grant change. PR#18g does NOT by itself transition `risk_evidence_status` to `'usable_later'` — a follow-up staging proof and a Pass 1 contract amendment (`pass1-output-contract-v0.2`) are required, each separately gated by its own explicit Helen GO. No DB writes, no durable table, no runtime scoring, no Pass 1 / Pass 2 / Trust runtime, no customer-facing output, no Lane A/B writer, no AMS runtime bridge, no AMS repo modification, no Gate 4, no production `endpointUrl` re-flip, no production traffic, no Track A, no Playwright, no website ThinSDK production activation, no production artefact / config mode flip.**
