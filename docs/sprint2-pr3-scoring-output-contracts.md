# Sprint 2 PR#3 — Lane A / Lane B scoring output contract layer

Track B (BuyerRecon Evidence Foundation). Schema-only — the typed
surface that future scoring workers (Sprint 2 PR#5 Stage 0, PR#6 Stage 1
Lane A scorer, deferred PR#3b router / Lane B observer) will write to.
PR#3 ships **no writer**.

Authority:

- `docs/architecture/ARCHITECTURE_GATE_A0.md` §K row PR#3 + §D 6 + 8
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules A / B / H / I
- `docs/sprint2-pr3-scoring-output-contracts-planning.md` — Codex PASS, Helen OD-1..OD-8 sign-off
- `docs/ops/pr3-db-role-setup-staging.md` — operator role pack (Phase 1 / 2 / 3 executed; Phase 4 contract delivered in this PR)

## 1. Summary

PR#3 introduces two additive tables (`scoring_output_lane_a`,
`scoring_output_lane_b`), idempotent role-existence assertions against
the four canonical group roles (`buyerrecon_migrator`,
`buyerrecon_scoring_worker`, `buyerrecon_customer_api`,
`buyerrecon_internal_readonly`), grants matching the role boundaries,
PUBLIC revocation as defence-in-depth, and a post-migration Hard Rule I
assertion. PR#3 emits no rows, no reason codes, no scores, no
classifications.

## 2. Files changed / added

| File | Type | Notes |
| --- | --- | --- |
| `migrations/011_scoring_output_lanes.sql` | new | Two `CREATE TABLE IF NOT EXISTS` + role-existence assertions + REVOKE PUBLIC + grants + final Hard Rule I + OD-7 assertions. No `CREATE ROLE`, no `INSERT INTO`, no `CASCADE`. |
| `src/db/schema.sql` | modified | Mirrors both tables in idempotent `CREATE TABLE IF NOT EXISTS` form. GRANT-free in schema.sql (grants live only in migration 011). |
| `tests/v1/scoring-output-contracts.test.ts` | new | 95 pure tests — table/column shape, CHECK constraints, natural key, role-existence assertions, no-CREATE-ROLE / no-INSERT / no-CASCADE, `verification_score` carve-out allowlist sweep, generic score-shaped forbidden sweep, `reason_codes` plural / no singular column, `forbidden_codes.yml` `.patterns` scope sweeps, no Track A / AMS / collector imports. |
| `tests/v1/scoring-output-contracts.lint.test.ts` | new | 12 lint tests — Hard Rule H SQL JOIN detector with inline positive + negative fixtures, repo-wide sweep over `migrations/**`, `docs/sql/verification/**`, `src/db/schema.sql`, `src/**`, `scripts/**`. No-writer sweep over the same scope; migration 011 contains no `INSERT INTO`. |
| `tests/v1/db/scoring-output-contracts.dbtest.ts` | new | 27 DB tests — table presence, column set, idempotent migration rerun, Lane A invariants (Hard Rule A/B + JSONB + verification_score range), Lane B invariants (verification_method enum + strength NULL + JSONB), natural-key uniqueness, cross-workspace isolation, source-tables unchanged, role privilege assertions (Hard Rule I + OD-7 baseline + scorer/readonly grants). |
| `tests/v1/db/_setup.ts` | modified | `ensureCanonicalRolesForTests(pool)` (test-only group-role creation) + `applyMigration011(pool)` (idempotent migration) wired into `bootstrapTestDb`. Migration 011 itself never creates roles. |
| `docs/sql/verification/10_scoring_output_lane_a_invariants.sql` | new | 11 read-only queries; `to_regclass` presence guard; column-set, Hard Rule A/B regression, JSONB shape, natural-key, forbidden-column sweep, OD-7 zero-direct-SELECT for customer-API. Empty-DB PASS. |
| `docs/sql/verification/11_scoring_output_lane_b_invariants.sql` | new | 10 read-only queries; `to_regclass` presence guard; column-set, verification_method enum, verification_method_strength-must-be-NULL, JSONB shape, natural-key, forbidden-column sweep, Hard Rule I (zero SELECT + zero INSERT/UPDATE/DELETE for customer-API). Empty-DB PASS. |
| `docs/sprint2-pr3-scoring-output-contracts.md` | new (this file) | Implementation summary. |

Files **not** touched (verified):

- `migrations/001..010` — unchanged.
- `src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`.
- `scripts/extract-behavioural-features.ts` (PR#1 + PR#2 — read-only reference).
- `scoring/version.yml`, `scoring/reason_code_dictionary.yml`, `scoring/forbidden_codes.yml`.
- `docs/architecture/ARCHITECTURE_GATE_A0.md`, `docs/contracts/signal-truth-v0.1.md`.
- `docs/sprint2-pr3-scoring-output-contracts-planning.md` (Helen-signed planning doc, untouched in this PR).
- `docs/ops/pr3-db-role-setup-staging.md` (operator pack, untouched in this PR).

## 3. OD-1..OD-8 decisions implemented

| OD | Decision | Implementation |
| --- | --- | --- |
| **OD-1** | Schema-only PR#3; router (A0 §D 6) + Lane B observer (A0 §D 8) deferred to PR#3b. | Migration 011 ships tables + role grants only. No router. No observer. No INSERT into either table. |
| **OD-2** | Natural key = `(workspace_id, site_id, session_id, scoring_version)`. | `UNIQUE (workspace_id, site_id, session_id, scoring_version)` on both tables; DB tests confirm uniqueness rejection. |
| **OD-3** | Migration name = `migrations/011_scoring_output_lanes.sql`. | File created at that exact path. |
| **OD-4** | `reason_codes` JSONB array with `'[]'::jsonb` default, no element-level SQL CHECK; scorer validates dictionary later. | `reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reason_codes) = 'array')` on both tables. No element validation. |
| **OD-5** | Deferred router/observer named PR#3b. | Referenced in migration 011 prologue + this doc. No PR#3b artefacts in this commit. |
| **OD-6** | Reserve `verification_method_strength` as nullable `TEXT`; v1 rows must keep it NULL. | `verification_method_strength TEXT` + `CHECK (verification_method_strength IS NULL)`. DB test for `'strong'` insert rejection. Verification SQL 11 asserts every row is NULL. |
| **OD-7** | Defer Lane A customer-facing redacted view. | Customer-facing role has zero direct SELECT on `scoring_output_lane_a` in PR#3 (REVOKE in migration; assertion at end of migration; verification SQL 10 query 10 + DB test confirm). |
| **OD-8** | Canonical roles confirmed on Hetzner staging. Migration 011 asserts presence; never `CREATE ROLE`; PUBLIC revocation is defence-in-depth only. | DO/RAISE blocks at top of migration check all four canonical roles. Pure test asserts migration contains no `CREATE ROLE` / dangerous `ALTER ROLE`. Test-only `_setup.ts` helper pre-creates the roles in the test environment; the migration never does. |

## 4. Schema summary

### scoring_output_lane_a (Lane A — invalid-traffic / behavioural rubric)

| Column | Type | Constraint |
| --- | --- | --- |
| `scoring_output_lane_a_id` | `UUID` | PRIMARY KEY DEFAULT `gen_random_uuid()` |
| `workspace_id` | `TEXT` | NOT NULL |
| `site_id` | `TEXT` | NOT NULL |
| `session_id` | `TEXT` | NOT NULL |
| `scoring_version` | `TEXT` | NOT NULL |
| `source_feature_version` | `TEXT` | nullable |
| `verification_score` | `INT` | NOT NULL, CHECK 0..99 (Hard Rule A canonical column) |
| `evidence_band` | `TEXT` | NOT NULL, CHECK IN ('low','medium') (Hard Rule A) |
| `action_recommendation` | `TEXT` | NOT NULL DEFAULT 'record_only', CHECK IN ('record_only','review') (Hard Rule B) |
| `reason_codes` | `JSONB` | NOT NULL DEFAULT `'[]'::jsonb`, CHECK `jsonb_typeof = 'array'` |
| `evidence_refs` | `JSONB` | NOT NULL DEFAULT `'[]'::jsonb`, CHECK `jsonb_typeof = 'array'` |
| `knob_version_id` | `TEXT` | nullable |
| `record_only` | `BOOLEAN` | NOT NULL DEFAULT TRUE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` |

Natural key: `UNIQUE (workspace_id, site_id, session_id, scoring_version)`.
Indexes: `(workspace_id, site_id, created_at DESC)`, `(workspace_id, site_id, session_id)`, `(scoring_version, created_at DESC)`.

### scoring_output_lane_b (Lane B — declared-agent observation)

| Column | Type | Constraint |
| --- | --- | --- |
| `scoring_output_lane_b_id` | `UUID` | PRIMARY KEY DEFAULT `gen_random_uuid()` |
| `workspace_id` | `TEXT` | NOT NULL |
| `site_id` | `TEXT` | NOT NULL |
| `session_id` | `TEXT` | NOT NULL |
| `scoring_version` | `TEXT` | NOT NULL |
| `agent_family` | `TEXT` | NOT NULL |
| `verification_method` | `TEXT` | NOT NULL, CHECK IN ('reverse_dns','ip_validation','web_bot_auth','partner_allowlist','none') |
| `verification_method_strength` | `TEXT` | nullable, CHECK IS NULL (OD-6 v1 invariant; signal-truth §11) |
| `reason_codes` | `JSONB` | NOT NULL DEFAULT `'[]'::jsonb`, CHECK `jsonb_typeof = 'array'` |
| `evidence_refs` | `JSONB` | NOT NULL DEFAULT `'[]'::jsonb`, CHECK `jsonb_typeof = 'array'` |
| `record_only` | `BOOLEAN` | NOT NULL DEFAULT TRUE |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` |

Natural key: `UNIQUE (workspace_id, site_id, session_id, scoring_version)`.
Indexes: `(workspace_id, site_id, created_at DESC)`, `(workspace_id, site_id, session_id)`, `(scoring_version, created_at DESC)`.

## 5. Role enforcement summary

| Role | Lane A | Lane B |
| --- | --- | --- |
| `buyerrecon_migrator` | `GRANT ALL` (DDL-class) | `GRANT ALL` |
| `buyerrecon_scoring_worker` | `GRANT SELECT, INSERT, UPDATE` (future writer) | `GRANT SELECT, INSERT, UPDATE` (future writer) |
| `buyerrecon_internal_readonly` | `GRANT SELECT` | `GRANT SELECT` |
| `buyerrecon_customer_api` | `REVOKE ALL` (OD-7 — redacted view deferred) | `REVOKE ALL` (Hard Rule I) |

Plus `REVOKE ALL ... FROM PUBLIC` on both tables as **defence-in-depth
only** (never as proof of Hard Rule I).

Migration 011 ends with a `DO $$ ... RAISE EXCEPTION ... END $$` block
that asserts `has_table_privilege('buyerrecon_customer_api'::name,
'scoring_output_lane_b'::regclass, 'SELECT'::text) = FALSE` (Hard Rule
I) and the OD-7 baseline on Lane A. The migration rolls back the
transaction if either assertion fails — there is no silent path through.

## 6. Hard Rule H linter summary

Hard Rule H (signal-truth-v0.1 §10): "No JOIN between
`scoring_output_lane_a` and `scoring_output_lane_b` in any query."

Implementation: `tests/v1/scoring-output-contracts.lint.test.ts`.

- Detector recognises explicit `JOIN` keyword (in either ordering A→B / B→A) **and** comma-cross-product (`FROM a, b`).
- Inline positive controls (3 fixtures) and negative controls (4 fixtures) assert detector behaviour.
- Repo-wide sweep over `migrations/**`, `docs/sql/verification/**`, `src/db/schema.sql`, `src/**/*.{ts,tsx,js,...}`, `scripts/**`.
- Wired into `npm test` (file lives under `tests/v1` and is picked up by the default vitest include glob).

PR#3 ships zero JOINs across the two lane tables — the linter PASSes on the active repo at this commit.

## 7. Hard Rule I proof summary

Hard Rule I (signal-truth-v0.1 §10): "Postgres role used by
customer-facing API has zero SELECT on `scoring_output_lane_b`."

Three independent enforcement layers, all passing:

| Layer | Mechanism | Result |
| --- | --- | --- |
| Migration 011 | `DO $$ ... RAISE EXCEPTION ... END $$` final block calls `has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_b'::regclass, 'SELECT'::text)` and aborts the migration if TRUE. | PASS on local test DB. |
| DB test | `tests/v1/db/scoring-output-contracts.dbtest.ts` queries `has_table_privilege` directly for the customer-API role on Lane B (SELECT, INSERT, UPDATE, DELETE). | All four privilege bits PASS as FALSE. |
| Verification SQL 11 | `docs/sql/verification/11_scoring_output_lane_b_invariants.sql` query 9 returns `allowed_for_customer_api = f`; queries 9b add INSERT/UPDATE/DELETE bits all FALSE. | PASS on local test DB. |

OD-7 baseline (Lane A direct customer-facing access deferred) is
enforced symmetrically.

## 8. Test results

| Step | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx vitest run tests/v1/scoring-output-contracts.test.ts` (pure) | 95 passing |
| `npx vitest run tests/v1/scoring-output-contracts.lint.test.ts` (lint) | 12 passing |
| `npx vitest run` (full pure suite) | 1904 / 1904 passing |
| `TEST_DATABASE_URL=… vitest run --config vitest.db.config.ts tests/v1/db/scoring-output-contracts.dbtest.ts` | 27 / 27 passing |
| `TEST_DATABASE_URL=… vitest run --config vitest.db.config.ts` (full DB suite) | 154 passing, 1 skipped (pre-existing) |
| `docs/sql/verification/10_*.sql` against empty test DB | All anomaly queries 0 rows; OD-7 zero-direct-SELECT confirmed |
| `docs/sql/verification/11_*.sql` against empty test DB | All anomaly queries 0 rows; Hard Rule I `allowed_for_customer_api = f` confirmed |

## 9. Rollback

PR#3 migration 011 is purely additive (two new tables, role grants, no
modification of any existing table). PR#3 writes no rows.

Operator rollback (no CASCADE):

```sql
-- Revoke grants first.
REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_migrator;
REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_scoring_worker;
REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_internal_readonly;
REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_migrator;
REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_scoring_worker;
REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_internal_readonly;

-- Drop tables (no CASCADE — neither table is FK-referenced).
DROP TABLE IF EXISTS scoring_output_lane_a;
DROP TABLE IF EXISTS scoring_output_lane_b;
```

Rollback is data-loss-free: PR#3 writes no rows, neither table is FK-
referenced. The four canonical group roles are NOT dropped (operator-
owned; lifecycle lives in `docs/ops/pr3-db-role-setup-staging.md`).

## 10. No-production / no-writer / no-scorer-router-observer statement

- **No Render production.** A0 P-4 still blocks. PR#3 ships local +
  Hetzner staging only.
- **No production DB.** Migration 011 runs on Hetzner staging only.
- **No collector touch.** `src/collector/v1/**`, `src/app.ts`,
  `src/server.ts`, `src/auth/**` are unchanged.
- **No frontend / GTM / GA4 / LinkedIn / ThinSDK touched.**
- **No writer.** PR#3 emits zero rows. Pure-test sweep + repo-wide
  no-INSERT-INTO grep enforce this.
- **No scoring algorithm.** No `verification_score` is computed in
  PR#3; the column is a typed reservation.
- **No reason-code emission.** `reason_codes JSONB` is reserved as
  array shape; PR#3 inserts none.
- **No router** (A0 §D 6) — deferred to PR#3b.
- **No Lane B observer** (A0 §D 8) — deferred to PR#3b.
- **No Stage 0 worker** — PR#5 territory.
- **No Stage 1 worker** — PR#6 territory.
- **No AI-agent / crawler taxonomy implementation.** P-11 lives in
  PR#5 Stage 0 productionisation.
- **No customer-facing dashboard / report.** Customer-facing role has
  zero direct SELECT on either lane table; OD-7 view is deferred.
