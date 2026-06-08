# Sprint 3: Behavioural Output Grant — Error-Localization Diagnostic Plan

**Status:** `BEHAVIOURAL_GRANT_ERROR_LOCALIZATION_PLAN_ONLY`

This is a **docs-only diagnostic planning record**. It plans how to localize
**exactly where** the behavioural features extractor hits
`permission denied for table session_behavioural_features_v0_2`, after Stage 1
(PR #143) verified the privilege/metadata state but did **not** reproduce or
localize the runtime failure.

This PR is **planning only**. It runs **no** production command, **no**
diagnostic, applies **no** GRANT, runs **no** DML/DDL, runs **no** extractor
rerun, and runs **no** worker or downstream runtime. All diagnostics below are
**planned only**; all candidate fixes are **candidate only**. No fix and no
rerun are authorized by this PR.

---

## 1. Problem & Evidence Basis

- **PR #143** (Stage 1 diagnostic evidence, merge
  `71e1fad5f80d5da1b70fe30c817605f1c22b5f17`) confirmed, as role
  `buyerrecon_prod_collector_app` in `buyerrecon_production` (read-only,
  rolled back):
  - role / database / read-only verified;
  - unqualified and `public.`-qualified names resolve to the **same OID**
    (`oid_equal=true`) → search_path/schema mismatch likely ruled out (H3);
  - `relrowsecurity=false`, `relforcerowsecurity=false`, `policy_count=0`,
    `trigger_count=0` → RLS/policy/trigger likely ruled out (H5, part of H4);
  - role gates match the expected app role → role mismatch not supported (H2);
  - table INSERT/UPDATE = true, table SELECT = false; column INSERT/UPDATE =
    true; limited + conflict-target SELECT = true; sequence USAGE = true,
    SELECT = false.
- **Still unresolved:** the extractor still fails with
  `permission denied for table session_behavioural_features_v0_2`, and Stage 1
  did not localize the failing operation.

**Strongest remaining leads:** exact failing SQL / error localization;
runtime SQL differing from inspected source (H6); an adjacent
relation/sequence/view path not covered by Stage 1 (H4); and the specific
PostgreSQL permission behavior for the real statement path (H1). Table-level
SELECT remains a **possible** direction, **not** a proven cause.

### Source-grounded facts (read-only review)
- The extractor executes the entire pipeline as a **single statement**:
  `await pool.query(EXTRACTION_SQL, params)`
  (`scripts/extract-behavioural-features.ts`, `runExtraction`). The combined
  CTE chain + terminal `INSERT … ON CONFLICT … DO UPDATE … RETURNING` is one
  `query()` call, so PostgreSQL reports a single error for the whole statement
  and does not, by itself, tell us which sub-operation failed.
- The runner's catch block logs **only** `(err as Error).message` (the
  `extraction failed: …` line). It does **not** surface the structured
  PostgreSQL error fields (`code`, `position`, `schema`, `table`, `column`,
  `constraint`, `where`, `routine`) that the `pg` driver attaches — these are
  **structural metadata, not row/customer data** — and they are exactly what
  would localize the failure.

---

## 2. Can This Be Done Without Running the Full Extractor?

**Yes — preferred.** The localization does **not** require running the full
extractor end to end. Two safe, narrowly scoped approaches, in order of
preference:

- **Approach A — structured error-field capture (lowest risk).** Reproduce the
  failing statement (or its components) in a read-only / rolled-back session
  and capture the **structured `pg` error fields** (`code`, `position`,
  `schema`, `table`, `column`, `constraint`, `where`, `routine`) instead of
  only `err.message`. These fields are catalog/structural and contain no row
  values. `code`/`column`/`position` typically reveal whether the denial is on
  INSERT, UPDATE, SELECT, the sequence, or a specific column/object.
- **Approach B — statement decomposition (read-only first).** Run the
  read-only **prefix** of the pipeline (the candidate-sessions / CTE SELECT
  chain that reads `accepted_events` and intermediate CTEs) on its own to
  confirm the reads succeed and are not the source of the denial; then test the
  **terminal upsert** separately. This isolates "before vs at" the target
  upsert without running the production extractor binary.

Running the full extractor again is **not** required for localization and is
**not** planned here.

---

## 3. Planned Diagnostic Design (planned only — not executed)

### Stage 2a — read-only decomposition (no writes)
Within `BEGIN; … ROLLBACK;`, as `buyerrecon_prod_collector_app`:

- Execute the read-only SELECT/CTE prefix of `EXTRACTION_SQL` (the parts that
  read `accepted_events` and build the intermediate CTEs) **without** the
  terminal INSERT, to confirm whether the read chain succeeds or is itself the
  denial source. Output: success/failure + structured error fields only;
  **no row values** (e.g. wrap as `SELECT count(*)`/`EXISTS`, or `EXPLAIN`
  without `ANALYZE`, so no business rows are returned or printed).

### Stage 2b — terminal-upsert localization (write path, rollback-contained)
Only if 2a is clean and a write-path reproduction is required:

- Within `BEGIN; … ROLLBACK;` (guaranteed rollback, **no COMMIT**), attempt the
  terminal `INSERT … ON CONFLICT … DO UPDATE … RETURNING` (or a minimal
  equivalent) to observe the live `permission denied` and **capture structured
  error fields only** (`code`, `position`, `schema`, `table`, `column`,
  `constraint`, `where`, `routine`). Output: error class/fields and booleans
  only; **no row values, no raw identifiers, no payloads, no customer data**.
- This is a **write-path simulation** and therefore requires a **separate
  explicit Helen GO** (see §4), a **single attempt**, and guaranteed
  `ROLLBACK`.

### Capturing the runtime statement (addresses H6)
- Confirm the statement actually executed at runtime matches the inspected
  `EXTRACTION_SQL` — e.g. by capturing the prepared statement text / `pg`
  error `internalQuery`/`where`, or (operator-side, no code change here) a
  scoped `log_statement`/`auto_explain` capture — to rule out "runtime SQL
  differs from source." Planned only; any server-setting change is itself
  separately reviewed and GO-gated and is **not** proposed for execution here.

---

## 4. Runtime-Reproduction Guardrails (if 2b is needed)

If a runtime reproduction touching the write path is required, it must:

- require a **separate explicit Helen GO** before execution;
- be a **single attempt only**;
- be **rollback-contained** (`BEGIN … ROLLBACK`, no COMMIT) if any write path
  is touched;
- print **no customer / raw data** and **no row values** — structured error
  fields, booleans, and counts only;
- print **no DSN / password / token**;
- run **no worker** and **no downstream runtime**;
- keep the non-zero / error stop-line active.

Approach A / Stage 2a (read-only) are preferred and lower-risk; Stage 2b is a
fallback only.

---

## 5. Evidence To Collect

The follow-up diagnostic evidence PR should record (facts/booleans only):

- **Exact SQL stage / operation that fails** — read prefix vs terminal upsert
  vs sequence access.
- **Exact role / database / search_path at failure** —
  `current_user` / `current_role` / `current_database` /
  `current_setting('search_path')` captured in the same session.
- **Whether the failure happens before, during, or after the target upsert**
  (localized via 2a/2b).
- **Whether table-level SELECT is implicated, or another object/path is** —
  read from the structured error fields (`code` / `column` / `table` /
  `constraint` / `position`), e.g. whether the denied privilege is SELECT vs
  INSERT vs UPDATE and on which object.
- Stop-line confirmations: `no_row_reads` (or read-as-counts only),
  `no_secret_printed`, `no_customer_raw_data_printed`, `no_grant_dml_ddl`,
  `no_extractor_rerun`, `no_worker_run`, `no_downstream_runtime`,
  `no_gate_4e`, `no_gate_4f`, and `ROLLBACK`.

---

## 6. Candidate Fixes (candidate-only; none authorized)

- **None executed.** No fix, grant, DML/DDL, or rerun is performed by this PR
  or authorized by it.
- **Table-level SELECT must remain candidate-only** unless the runtime
  localization evidence specifically implicates it. If the structured error
  evidence shows table-level SELECT is required by the real statement path, it
  may then become a candidate — labelled `CANDIDATE ONLY — DO NOT RUN` and
  requiring Codex review + explicit Helen GO.
- If the evidence instead implicates a different object/path (adjacent
  relation/sequence/view, or a runtime-SQL difference), the fix targets that
  root cause — each candidate-only, separately planned, reviewed, GO-approved,
  and proofed.
- **Any future fix requires:** review, **explicit Helen GO**, a **post-fix
  proof PR**, and a **new explicit extractor rerun GO** before any rerun. Any
  future rerun must be a separate operator session with all approved stop-lines
  active.

---

## 7. Boundaries / Non-Authorization

This PR does **not** authorize:

- diagnostic execution
- grant execution
- DML / DDL
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
- any downstream runtime

---

## 8. Next Required Step

1. On a **separate explicit GO**, run the planned Stage 2a read-only
   decomposition (preferred); escalate to Stage 2b (rollback-contained
   write-path simulation) only if required and only under its own explicit GO.
2. Record results in a **docs-only diagnostic evidence PR** (structured error
   fields / booleans only; no row values).
3. If a fix is identified, a **candidate-only revised fix planning PR** follows,
   then Codex review → explicit Helen GO → apply → post-fix proof PR → new
   explicit extractor rerun GO.

No extractor rerun, grant, DML/DDL, worker, or downstream runtime is authorized
until that chain is complete.

---

## 9. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, raw identifier value,
`session_id` / `request_id` value, user-agent value, or customer data. All
identifier references are column / object names, SQL-structure concepts, or
stop-line language only — not values. Structured PostgreSQL error fields
referenced for the planned diagnostic (`code`, `position`, `schema`, `table`,
`column`, `constraint`, `where`, `routine`) are catalog/structural metadata and
must be captured **without** any accompanying row values.
