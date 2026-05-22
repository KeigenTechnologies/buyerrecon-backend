# BuyerRecon PR#18f — `risk_observations_v0_1` source-health diagnostic

Status: **docs-only proof record. Verdict: BLOCKED / schema_mismatch — the staging table `public.risk_observations_v0_1` exists and is `SELECT`-able, but the Timing / Product-Context observer's count query references a non-existent column (`derived_at`). The table's canonical timestamp column is `created_at`. A narrow code-fix PR is required before any Pass 1 / Trust / Pass 2 / runtime / scoring PR consumes risk-observation evidence.**

PR#18f is a read-only source-health diagnostic for `public.risk_observations_v0_1`, opened in response to PR#18d's `optional_source_count_query_failed / warn / public.risk_observations_v0_1` carry-forward warning. The diagnostic combined a repo-level schema/query assessment (PR#18f §3 below — performed by Claude Code in the planning turn) with a staging-side read-only operator run (PR#18f §4 below — performed by Helen-as-operator on the Hetzner staging host).

PR#18f is a **proof record only**. It introduces no code fix, no schema change, no migration, no DB write, no grant change, no Lane A/B writer, no AMS runtime bridge, no Pass 1 / Pass 2 / Trust runtime, no Gate 4 work. It classifies the warning and recommends a narrow follow-up code-fix PR; it does not apply that fix.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18f.**
> **No production traffic is approved by PR#18f.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18f; no production artefact / config mode flip is approved by PR#18f.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime is approved by PR#18f.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18f.**
> **No grant change is approved or applied by PR#18f.**
> **PR#18f does NOT pre-authorise the follow-up code-fix PR (PR#18f-impl / PR#18g). That PR remains separately gated by its own explicit Helen GO.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `1fd044e` — "Sprint 2 PR#18e: plan Pass 1 output contract (#37)").

PR branch: `buyerrecon-sprint2-pr18f-risk-observations-source-health`

Mandatory reference compliance:

- `docs/sprint2-pr18d-timing-product-context-observer-proof.md` — §8 carry-forward warning that motivated PR#18f.
- `docs/sprint2-pr18e-pass1-output-contract-planning.md` — §7 risk-evidence carry-forward into the Pass 1 contract; PR#18f informs `risk_evidence_status` ahead of any runtime PR.
- `docs/sprint2-pr18c-timing-product-context-observer.md` — the observer whose query mis-references `derived_at`.
- `src/scoring/timing-product-context-observer/query.ts` lines 169–176 — the failing `COUNT_RISK_OBSERVATIONS_SQL`.
- `src/db/schema.sql` lines 669–720 — boot-time CREATE TABLE parity block for `risk_observations_v0_1`.
- `migrations/013_risk_observations_v0_1.sql` lines 105–171 — canonical migration that creates the table and grants.

---

## 1. Status / verdict

**BLOCKED / schema_mismatch.**

- Table exists on staging: **yes**.
- `SELECT` privilege held by the connected role: **yes**.
- Required workspace_id / site_id columns present: **yes**.
- Observer's `derived_at` filter column exists on the table: **no** — the table has `created_at` and `updated_at` only.
- The PR#18d warning is **explained**: the observer's `COUNT_RISK_OBSERVATIONS_SQL` deterministically fails with PostgreSQL `42703 / undefined_column` (`column "derived_at" does not exist`).
- The corrected query (substituting `created_at` for `derived_at`) succeeds on staging and returns a non-zero count.

Risk evidence therefore remains **unavailable for any runtime / scoring path** in BuyerRecon until a narrow code-fix PR amends the observer's `COUNT_RISK_OBSERVATIONS_SQL` and adds a defensive schema-guard test. The PR#18e §7 `risk_evidence_status` field must remain at `'warning'` (effectively `'blocked'` for any runtime that would otherwise have consumed risk evidence) until that fix lands and a follow-up staging proof re-runs.

---

## 2. Why this PR exists

PR#18d's staging proof for the Timing / Product-Context observer surfaced a single warning:

| Field | Value |
|---|---|
| Anomaly kind | `optional_source_count_query_failed` |
| Severity | `warn` |
| Detail | `public.risk_observations_v0_1` |
| Reported count in PR#18d | `0` — default-on-failure value from the observer's `countOptional` helper, **NOT** a confirmed empty source |

Per PR#18e §7.2, future Pass 1 runtime / Trust runtime / Pass 2 runtime cannot rely on `risk_observations_v0_1` evidence until the underlying cause of the failure is investigated and resolved. Letting a future scoring path treat the failure-as-zero as "no risk evidence" would silently undercount risk signal — a categorical risk to commercial scoring quality once Gate 4 PR C re-flips production `endpointUrl` and commercial Sprint 2 evidence accumulates.

PR#18f's job is to **categorically classify** the failure (table_missing / permission_issue / schema_mismatch / empty_but_healthy / query_failure) so the next PR can be scoped narrowly.

---

## 3. Repo schema / query assessment

Performed by Claude Code via read-only file inspection on the synced base (`1fd044e`). No DB query.

### 3.1 Table presence in repo

- `src/db/schema.sql` lines 669–720: boot-time `CREATE TABLE IF NOT EXISTS risk_observations_v0_1` parity block.
- `migrations/013_risk_observations_v0_1.sql` lines 105–147: canonical migration that creates the table.
- Both agree on the column list, constraints, and indexes. There is no shape drift between schema.sql and the migration.

### 3.2 Canonical column list (from schema.sql + migration 013)

```
risk_observation_id    UUID         PRIMARY KEY
workspace_id           TEXT         NOT NULL
site_id                TEXT         NOT NULL
session_id             TEXT         NOT NULL
observation_version    TEXT         NOT NULL
scoring_version        TEXT         NOT NULL
velocity               JSONB        NOT NULL DEFAULT '{}'::jsonb
device_risk_01         NUMERIC(4,3) NOT NULL DEFAULT 0
network_risk_01        NUMERIC(4,3) NOT NULL DEFAULT 0
identity_risk_01       NUMERIC(4,3) NOT NULL DEFAULT 0
behavioural_risk_01    NUMERIC(4,3) NOT NULL DEFAULT 0
tags                   JSONB        NOT NULL DEFAULT '[]'::jsonb
record_only            BOOLEAN      NOT NULL DEFAULT TRUE
source_event_count     INT          NOT NULL DEFAULT 0
evidence_refs          JSONB        NOT NULL DEFAULT '[]'::jsonb
created_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
```

Canonical timestamp columns: **`created_at`** and **`updated_at`**. There is **no `derived_at` column** anywhere in the table definition.

Indexes (migration 013 lines 149–156):

- `risk_observations_v0_1_workspace_site` on `(workspace_id, site_id, created_at DESC)`.
- `risk_observations_v0_1_session` on `(workspace_id, site_id, session_id)`.
- `risk_observations_v0_1_versions` on `(observation_version, scoring_version, created_at DESC)`.

All three indexes use `created_at` (not `derived_at`).

### 3.3 Observer query (`src/scoring/timing-product-context-observer/query.ts` lines 169–176)

```sql
SELECT count(*)::bigint AS n
  FROM public.risk_observations_v0_1
 WHERE workspace_id = $3
   AND site_id      = $4
   AND derived_at   >= $1
   AND derived_at   <  $2
```

The query references `derived_at` — a column that does not exist on this table. The observer's `countOptional` helper catches the resulting pg-driver exception (deliberately discarding the SQL error text per PR#18c's secret-safety contract) and surfaces an `optional_source_count_query_failed` anomaly. This is exactly what PR#18d observed.

### 3.4 Bug class — same as the PR#18c blocker patch caught for `session_behavioural_features_v0_2`

The PR#18c Codex review previously caught a sibling instance of this same bug class — `COUNT_SESSION_BEHAVIOURAL_FEATURES_V0_2_SQL` referenced `last_refreshed_at` (a column that did not exist; the canonical column was `last_seen_at`). The PR#18c blocker patch fixed that query and added schema-guard tests (`K.2` / `K.3` / `K.4` / `K.5` in `tests/v1/timing-product-context-observer.test.ts`) that assert the SQL constants do not reference non-existent columns. Those tests cover `session_behavioural_features_v0_2` but do **not** cover `risk_observations_v0_1`. The same bug class therefore slipped through for `risk_observations_v0_1` because no equivalent schema-guard test was added for that table.

### 3.5 Cross-check — other observer-queried tables

| Table | Observer timestamp filter | Schema timestamp columns | Match? |
|---|---|---|---|
| `public.accepted_events` | `received_at` (no derived_at filter) | `received_at` etc. | ✓ |
| `public.ingest_requests` | `received_at` | `received_at` etc. | ✓ |
| `public.rejected_events` | `received_at` | `received_at` etc. | ✓ |
| `public.session_features` | `last_seen_at` | `last_seen_at`, `extracted_at` | ✓ |
| `public.session_behavioural_features_v0_2` | `last_seen_at` (PR#18c blocker patch) | `last_seen_at`, `extracted_at` | ✓ |
| `public.poi_observations_v0_1` | `derived_at` | `derived_at`, `created_at`, `first_seen_at`, `last_seen_at` | ✓ |
| `public.poi_sequence_observations_v0_1` | `derived_at` | `derived_at`, `created_at`, `first_seen_at`, `last_seen_at` | ✓ |
| **`public.risk_observations_v0_1`** | **`derived_at`** | **`created_at`, `updated_at` only — no `derived_at`** | **✗** |

The bug is **isolated to `risk_observations_v0_1`**. Every other observer-queried timestamp filter matches a canonical column on its target table.

---

## 4. Staging source-health evidence (Helen-as-operator, Hetzner staging, read-only)

The staging operator command sequence (PR#18f Step 5 plan, executed by Helen-as-operator on the Hetzner staging host under explicit Helen GO) confirmed the repo finding categorically.

| Check | Value |
|---|---|
| `table_exists` (`to_regclass('public.risk_observations_v0_1') IS NOT NULL`) | **true** |
| `select_privilege` (`has_table_privilege(current_user, 'public.risk_observations_v0_1'::regclass, 'SELECT')`) | **true** |
| `connected_role` | `buyerrecon_app` |
| `required_columns_present` (workspace_id, site_id, created_at, session_id) | **true** (all present in column inventory below) |
| `observer_query_shape_valid` (does `COUNT_RISK_OBSERVATIONS_SQL` succeed against the deployed schema?) | **false** — the `derived_at` filter triggers `42703 / undefined_column` |
| `count_query_success` (the observer's exact query) | **false** |
| `total_count` (no time filter) | `2` |
| `workspace_site_count` (no time filter, bound to `buyerrecon_staging_ws` / `buyerrecon_com`) | `2` |
| `window_count_with_corrected_column` (substituting `created_at` for `derived_at` over a 720-hour window) | `2` |

### 4.1 Column inventory (from `information_schema.columns`)

The staging schema's actual column set for `public.risk_observations_v0_1` (sorted alphabetically), as returned by the operator's `B.3` query:

- `behavioural_risk_01`
- `created_at`
- `device_risk_01`
- `evidence_refs`
- `identity_risk_01`
- `network_risk_01`
- `observation_version`
- `record_only`
- `risk_observation_id`
- `scoring_version`
- `session_id`
- `site_id`
- `source_event_count`
- `tags`
- `updated_at`
- `velocity`
- `workspace_id`

17 columns. **`derived_at` is absent** (confirmed by the dedicated probe `B.3a derived_at_present: false`). **`created_at` is present** (confirmed by `B.3b created_at_present: true`). The staging column inventory matches the repo schema (PR#18f §3.2) line-for-line.

### 4.2 Observer query repro (B.4)

Running the observer's exact failing query against staging produced PostgreSQL error class `42703 / undefined_column` (`column "derived_at" does not exist`). This is the canonical "column does not exist" error — definitively a schema/query mismatch, not a permission_issue (which would surface as `42501 / insufficient_privilege`) and not a table_missing (`42P01 / undefined_table`) condition.

### 4.3 Corrected query (B.5)

Substituting `created_at` for `derived_at` in the same query shape — `WHERE workspace_id = 'buyerrecon_staging_ws' AND site_id = 'buyerrecon_com' AND created_at >= (now() - interval '720 hours') AND created_at < now()` — succeeded and returned **2** rows. This proves:

- The table is reachable.
- The connected role has working `SELECT` privilege.
- The workspace_id / site_id binding semantics work.
- Two `risk_observations_v0_1` rows exist within the 720-hour window for the staging proof boundary.

### 4.4 Workspace/site-only count (B.6)

Filtering only by `(workspace_id = 'buyerrecon_staging_ws', site_id = 'buyerrecon_com')` (no time filter) returned **2** rows. The window-bounded count (4.3) equals the workspace-site-only count, so the two rows have `created_at` values inside the 720-hour window. This is consistent — there is real risk-observation data on staging, and the observer would have surfaced it if the column reference were correct.

### 4.5 Cleanup

| Field | Value |
|---|---|
| `DATABASE_URL_unset` | **yes** (staging DSN unset from the operator shell after the diagnostic run) |

The operator's command sequence used `psql "$DATABASE_URL" ...` with read-only metadata and count-only queries; no DSN was echoed, no row content beyond the integer counts and column-name list was surfaced.

---

## 5. Resolution classification

| Classification | Applicable? | Why |
|---|---|---|
| `PASS / usable` | no | Observer's actual query fails deterministically; cannot be called "usable" today. |
| `PASS_WITH_WARNINGS / empty_but_healthy` | no | The corrected query confirms 2 rows exist; the source is **not** empty. Calling this `empty_but_healthy` would be wrong — the source has data but the observer cannot see it. |
| `BLOCKED / permission_issue` | no | `select_privilege: true`; `connected_role: buyerrecon_app` has `SELECT`. |
| **`BLOCKED / schema_mismatch`** | **yes** | **Observer query references `derived_at`; the table's canonical timestamp columns are `created_at` and `updated_at` only.** Repo evidence (§3) and staging evidence (§4) agree categorically. |
| `BLOCKED / table_missing` | no | `table_exists: true`. |
| `BLOCKED / query_failure` (generic) | superseded | The query failure observed in PR#18d is the manifestation of the schema_mismatch above. Recording the specific classification is more useful than the generic one. |

**Categorical verdict: `BLOCKED / schema_mismatch`.**

---

## 6. Impact on Pass 1 / Trust / Pass 2 / runtime / scoring

### 6.1 PR#18e Pass 1 output contract — `risk_evidence_status` posture

Per PR#18e §4.1, the Pass 1 candidate carries a `risk_evidence_status` field with three categorical states (`'unavailable'`, `'warning'`, `'usable_later'`). PR#18f's BLOCKED finding sharpens the posture:

- The field must NOT be `'usable_later'` until a narrow code-fix PR resolves the `derived_at` → `created_at` mismatch AND a follow-up staging proof re-runs successfully.
- Effective posture today is `'unavailable'` (the observer cannot reach risk evidence at all under the current query) — categorically stronger than `'warning'`, but the PR#18e contract's three-value enum accepts both. The follow-up code-fix PR will choose whether to keep the field at `'warning'` (PR#18e default) or strengthen it to `'unavailable'` while the fix is in flight; PR#18f does not amend the PR#18e contract.
- The `blocked_by_risk_warning` interpretation enum in PR#18e §5 remains active.

### 6.2 Pass 1 / Trust / Pass 2 / runtime / scoring implications

- **PR#18e Pass 1 planning** remains valid as docs-only. PR#18f does not invalidate the Pass 1 contract; the Pass 1 contract already anticipates this carry-forward.
- **Any future Pass 1 runtime PR** that consumes `risk_observations_v0_1` evidence must first cite the merger of the follow-up code-fix PR and a staging proof showing the corrected query succeeds.
- **Trust planning (PR#18g per PR#18a §13)** is unblocked for docs-only planning (it does not consume risk evidence at planning time); any Trust runtime PR follows the same rule as Pass 1 runtime.
- **Pass 2 planning** is unaffected.
- **Lane A/B governance planning** is unaffected.
- **Customer-facing output / runtime emission / Lane A/B writer / AMS Trust runtime / Gate 4 / production traffic** — all remain non-approved by PR#18f and continue to be separately gated.

### 6.3 Runtime scoring boundary (reaffirmed)

Runtime scoring still requires its own separate PR with its own Helen GO under PR#18a's chain. PR#18f does not approve any runtime scoring path. PR#18f only resolves the source-health diagnostic that was holding Pass 1 / Trust / Pass 2 runtime planning at `risk_evidence_status: warning`.

---

## 7. Boundaries (re-asserted)

- **No DB writes.** No `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE`. PR#18f's operator commands were all `SELECT` + `information_schema` reads.
- **No DDL.** No `ALTER` / `CREATE` / `DROP`. The PR#18f-impl code-fix PR (separate) will not introduce DDL either; it changes a TypeScript SQL string constant.
- **No grant change.** No `GRANT` / `REVOKE`. The existing migration-013 grants are unchanged.
- **No migration.** No new file in `migrations/`. No `schema.sql` edit. The PR#18f-impl code-fix PR (separate) will not add a migration either.
- **No runtime scoring** in this PR or in the follow-up code-fix PR (the follow-up only repairs the observer's SQL constant and adds a regression test).
- **No customer output.**
- **No Lane A/B writer.** PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- **No AMS runtime bridge.** AMS Pass 1 / Pass 2 / Trust Core remain reference-only.
- **No Gate 4.** Gate 4 PR B / PR C / PR D / PR E remain separately gated.
- **No production `endpointUrl` re-flip.** `buyerrecon.com` ThinLayer endpointUrl remains on Render legacy.
- **No production traffic.** No `curl` / browser / synthetic generator against any production endpoint.
- **No Track A.** No Playwright. No knobs / dashboard. No website ThinSDK production activation. No production artefact / config mode flip.
- **No AMS repo modification.** PR#18b §4.1.1 dirty-worktree rule still applies; AMS observations are reference-only and non-contractual.
- **No secrets in any artefact.** No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw payload / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this proof record. Categorical counts (`2`), boolean flags (`true` / `false`), and column names are the only data points surfaced.

---

## 8. Recommended next PR (PR#18f-impl or PR#18g — narrow code fix)

The recommended follow-up is a **narrow code-fix PR**, separately gated by its own Helen GO. PR#18f does NOT open or pre-authorise it.

### 8.1 Scope

- Change `COUNT_RISK_OBSERVATIONS_SQL` in `src/scoring/timing-product-context-observer/query.ts` from filtering on `derived_at` to filtering on `created_at`. This matches:
  - The table's canonical timestamp column per `migrations/013_risk_observations_v0_1.sql` and `src/db/schema.sql`.
  - The table's existing index `risk_observations_v0_1_workspace_site` on `(workspace_id, site_id, created_at DESC)` — same access shape as the corrected staging query (§4.3) used.
- Add a schema-guard test pair in `tests/v1/timing-product-context-observer.test.ts` paralleling the K.2 / K.3 / K.4 / K.5 tests already in place for `session_behavioural_features_v0_2`:
  - Assert `COUNT_RISK_OBSERVATIONS_SQL` does **not** match `/derived_at/`.
  - Assert `COUNT_RISK_OBSERVATIONS_SQL` **does** match `/created_at/`.
  - Assert the `risk_observations_v0_1` `CREATE TABLE` block in `src/db/schema.sql` declares `created_at TIMESTAMPTZ` and does NOT declare `derived_at`.
- Re-run the targeted Timing / Product-Context observer suite (`npx vitest run tests/v1/timing-product-context-observer.test.ts`). Expected result: all tests pass; the new tests catch any future regression.
- Re-run a targeted risk-source-health staging proof OR the full Timing / Product-Context observer staging proof (operator-only) to confirm the corrected query returns the expected count categorically (today: `2` on staging).
- Only after the code-fix PR is merged and the staging re-run is recorded may `risk_evidence_status` transition from `'warning'` / `'unavailable'` to `'usable_later'` under the PR#18e §7.3 contract — and that transition itself requires an amendment to PR#18e (`pass1-output-contract-v0.2`) under its own separate Helen GO.

### 8.2 What the follow-up PR must NOT do

- No DDL on `risk_observations_v0_1` (no rename of `created_at` → `derived_at`; the table's canonical column stays `created_at`).
- No migration.
- No `schema.sql` edit other than what tests would compare against (the K-style tests read schema.sql; they do not modify it).
- No grant change.
- No customer output / Lane A/B writer / AMS runtime call / Trust runtime / Pass 1 runtime / Pass 2 runtime / Gate 4 work / production traffic.
- No secret values introduced anywhere.

---

End of PR#18f. **Verdict: BLOCKED / schema_mismatch — `public.risk_observations_v0_1` exists on staging (`table_exists: true`), the connected role `buyerrecon_app` holds `SELECT` privilege (`select_privilege: true`), the canonical timestamp column is `created_at` (NOT `derived_at`), the corrected query returns 2 rows for the staging proof boundary, and the observer's existing `COUNT_RISK_OBSERVATIONS_SQL` deterministically fails with PostgreSQL `42703 / undefined_column` because it references the non-existent `derived_at` column. The PR#18d warning is therefore fully explained as a schema/query drift bug isolated to `risk_observations_v0_1`. PR#18f is docs-only; no code, no DB write, no migration, no schema.sql change, no grant change, no Lane A/B writer, no AMS runtime bridge, no Pass 1 / Pass 2 / Trust runtime, no Gate 4, no production `endpointUrl` re-flip, no production traffic, no Track A, no Playwright, no website ThinSDK production activation, no production artefact / config mode flip. The recommended next PR (PR#18f-impl or PR#18g) is a narrow code fix changing `derived_at` → `created_at` in the observer's count SQL and adding a schema-guard test pair to prevent regression; that PR remains separately gated by its own explicit Helen GO and is NOT opened by PR#18f. Until that fix is merged and a follow-up staging proof confirms the corrected query, `risk_evidence_status` in PR#18e's Pass 1 contract must remain `'warning'` / effectively `'unavailable'`, and no Pass 1 / Trust / Pass 2 runtime path may consume risk-observation evidence.**
