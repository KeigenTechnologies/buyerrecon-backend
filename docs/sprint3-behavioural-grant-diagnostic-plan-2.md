# Sprint 3: Behavioural Output Grant — Diagnostic / Planning Record (Round 2)

**Status:** `BEHAVIOURAL_GRANT_DIAGNOSTIC_PLAN_2_ONLY`

This is a **docs-only diagnostic / planning record**. It investigates why the
behavioural features extractor **still** fails with `permission denied for
table session_behavioural_features_v0_2` even after the revised grant fix
(PR #140) made table-level INSERT and UPDATE true.

This PR is **planning only**. It runs **no** production command, applies
**no** GRANT, runs **no** DML/DDL, runs **no** extractor rerun, and runs
**no** worker or downstream runtime. All diagnostics below are **planned
only**; all candidate fixes are **candidate only**. No fix execution and no
rerun are authorized by this PR.

---

## 1. Problem & Evidence Basis

- **PR #140** (revised grant-fix proof, merge
  `c92ddd110b4c05e345afb17893b44b3bd5e68f38`) proved, as role
  `buyerrecon_prod_collector_app` in `buyerrecon_production`:
  - table-level INSERT = true, table-level UPDATE = true,
  - table-level SELECT = false, sequence USAGE = true, sequence SELECT = false,
  - column-scoped INSERT/UPDATE/SELECT preserved.
- **PR #141** (rerun-after-revised-fix failure evidence, merge
  `2eed34e2a8253298633d651727daf68c11c5e9a0`): exactly one rerun was attempted
  with pre-rerun gate `table_insert=true|table_update=true|table_select=false`,
  and it **still failed** with
  `permission denied for table session_behavioural_features_v0_2`
  (`extractor_exit_code=1`).

So **table-level INSERT and UPDATE are now true, but the extractor still fails
with permission denied** on `session_behavioural_features_v0_2`. The earlier
table-level INSERT/UPDATE hypothesis is therefore **insufficient on its own**.

`table_select=false` is one **diagnostic direction**, but it is **not** a
proven fix and is **not** proposed for execution here. This PR is planning
only; it does not fix or rerun anything.

---

## 2. Diagnostic Hypotheses (none proven)

The following are hypotheses to investigate. None is claimed as proven.

- **H1 — `ON CONFLICT DO UPDATE … RETURNING` may require table-level SELECT.**
  This exact upsert path might trigger a SELECT privilege check (e.g. via
  RETURNING, the conflict arbiter, or planner behavior) that column-level
  SELECT does not satisfy. To be confirmed by catalog/behavior checks, not
  assumed.
- **H2 — Runtime role mismatch.** The extractor may not run as the exact
  proofed role `buyerrecon_prod_collector_app` despite the APP_DSN gate (e.g.
  the DSN user differs, or a `SET ROLE`/role-default applies elsewhere). The
  privilege state was proofed for the proofed role; the runtime role must be
  captured at failure time.
- **H3 — search_path / schema resolution.** Source review shows the extractor
  references the target **unqualified** as `session_behavioural_features_v0_2`
  (`scripts/extract-behavioural-features.ts:727`), while the grants were
  applied to the **`public.`-qualified** object. The connection is opened with
  `new pg.Client({ connectionString })` and performs **no `SET search_path`
  and no `SET ROLE`**. If the runtime role's `search_path` does not resolve the
  unqualified name to `public.session_behavioural_features_v0_2` (e.g. a
  same-named relation/view in another schema, or `public` not on the path),
  the runtime could be touching a **different object** than the one granted.
- **H4 — Additional relation / sequence / view / trigger touched at runtime.**
  The runtime path may touch an object beyond the proofed target+sequence
  (e.g. a view, rule, or trigger-invoked function) whose privileges were not
  checked. (Source also reads `accepted_events` and intermediate CTEs; the
  error names the target specifically, but adjacent objects should be ruled
  out.)
- **H5 — RLS / policy / ownership.** Row-level security, a restrictive
  policy, or an ownership/`FORCE ROW LEVEL SECURITY` setting on the table
  could produce a permission-denied even with table grants present. To be
  read from catalog metadata only.
- **H6 — Actual runtime SQL differs from the inspected source path.** The
  inspected statement (`INSERT … ON CONFLICT … DO UPDATE … RETURNING`) is
  assumed to be the failing one; the runtime may execute a different/
  additional statement. The failing statement must be confirmed, not assumed.
- **H7 — Error thrown before/around the final upsert.** The
  `permission denied` may originate in a preflight/CTE/RETURNING path rather
  than the upsert write itself. Whether the failure occurs before, during, or
  after the target upsert should be localized.

> Open framing: the persistence of `permission denied` with table INSERT/UPDATE
> true **and** full column coverage is anomalous for this path, so non-SELECT
> explanations (H2–H7) must be kept open alongside H1. Do not presume
> table-level SELECT is the fix.

---

## 3. Proposed Safe Diagnostic Plan

Goal: localize the **exact** runtime permission failure **without** exposing
raw data. Nothing here is executed by this PR; execution requires a separate
explicit GO.

**Stage 1 — read-only catalog / metadata checks (booleans & status only).**
Within a `BEGIN; … ROLLBACK;` block, as the runtime role, using
privilege-introspection and catalog views that return only booleans /
names / status:

- `current_user`, `current_role`, `current_database`, `transaction_read_only`,
  `current_setting('search_path')`.
- Role membership / `pg_has_role` checks for the runtime role.
- Schema + relation OID resolution for the **unqualified** name vs
  `public.session_behavioural_features_v0_2` (compare `'sbf'::regclass` style
  resolution under the runtime `search_path` to the qualified OID).
- `has_table_privilege` for SELECT / INSERT / UPDATE (booleans).
- `has_column_privilege` for SELECT / INSERT / UPDATE on the relevant columns
  (booleans).
- `has_sequence_privilege` USAGE / SELECT (booleans).
- RLS status from `pg_class.relrowsecurity` / `relforcerowsecurity` (booleans).
- Triggers from `pg_trigger` (names / counts only, no row data).
- Policies from `pg_policies` (names / commands only, no row data).
- Table owner + grantee privilege bits from `information_schema.table_privileges`
  / `pg_class` (names / booleans only).

**Stop-lines for the diagnostic (when later authorized):** read-only session;
explicit `BEGIN … ROLLBACK`; emit booleans / names / status only; print no
DSN / password / token; no row reads; no raw identifiers; no payload /
customer data; no GRANT / DML / DDL; no extractor rerun; no worker; no
downstream runtime.

**Stage 2 — runtime-path diagnostic (only if Stage 1 is inconclusive).**
If needed, a minimal reproduction of the failing statement could be run inside
`BEGIN; … ROLLBACK;` to observe the live privilege error and localize it
(H6/H7). This is **planned only** and must require: a separate explicit GO; a
guaranteed `ROLLBACK` (no commit); booleans / error-class output only with
**no raw or customer data**; no worker; no downstream runtime; a single
attempt with the error/non-zero stop-line active.

---

## 4. Specific Checks To Plan

Candidate checks (read-only, catalog/metadata; booleans/status only):

- `current_user` / `current_role` / `current_database` / `transaction_read_only`.
- role membership / `current_role` vs proofed role.
- schema + relation OID checks for `public.session_behavioural_features_v0_2`
  **and** for the unqualified name as resolved under the runtime `search_path`.
- table-level SELECT / INSERT / UPDATE booleans.
- column-level SELECT / INSERT / UPDATE booleans.
- sequence USAGE / SELECT booleans.
- RLS status from catalog metadata.
- triggers on the table from catalog metadata only.
- policies on the table from catalog metadata only.
- exact table owner / privileges from catalog metadata.
- `search_path` value.
- source-review confirmation of qualified vs unqualified table name
  (already observed: **unqualified** at
  `scripts/extract-behavioural-features.ts:727`).
- source/behavior confirmation of whether any preflight SELECT / RETURNING /
  CTE path could require table-level SELECT.

---

## 5. Candidate Fix Posture (candidate-only; none authorized)

- Any candidate fix remains **candidate only**; nothing is executed here.
- **No table-level SELECT grant is proposed** — current evidence does not
  support it. If, and only if, Stage 1/2 evidence shows table-level SELECT is
  genuinely required, it may become a **candidate**, labelled
  `CANDIDATE ONLY — DO NOT RUN` and requiring **Codex review + explicit Helen
  GO** before any execution.
- Likewise, if the cause is non-SELECT (role mismatch, search_path/schema,
  RLS/policy/owner, adjacent object), the fix would target that root cause
  (e.g. correcting the runtime role/DSN, schema-qualifying the reference,
  adjusting search_path, or a policy/ownership change) — each candidate-only,
  separately planned, reviewed, GO-approved, and proofed.
- No grant execution by this PR. No extractor rerun by this PR.

---

## 6. Proof / Rerun Gating

- A **diagnostic evidence PR** is required after any diagnostic is run.
- If the diagnostic identifies a fix, a **revised fix planning PR** is required
  (candidate-only).
- **Explicit Helen GO** is required before any grant or fix is applied.
- A **post-fix proof PR** is required after any fix.
- A **new explicit extractor rerun GO** is required before any rerun.
- Any future rerun must be a **separate operator session with all approved
  stop-lines active**.

No extractor rerun, grant, DML/DDL, worker, or downstream runtime is
authorized until that chain is complete.

---

## 7. Boundaries / Non-Authorization

This PR does **not** authorize:

- grant execution
- extractor rerun
- worker execution
- Stage 0
- risk worker
- POI worker
- evidence snapshot
- Lane preview / Lane write
- customer output
- scoring runtime
- AMS Trust / Pass runtime
- Gate 4E
- Gate 4F
- any GRANT / DML / DDL
- any downstream runtime

---

## 8. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, raw identifier value,
`session_id` / `request_id` value, user-agent value, or customer data. All
identifier references are column / object names, catalog-metadata concepts, or
stop-line language only — not values.
