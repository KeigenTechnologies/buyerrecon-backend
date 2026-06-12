# Sprint 3 — Stage 0 auth/credential Step 1B — Query/Command Adjustment Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1B_QUERY_ADJUSTMENT_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **corrected Step
1B grant-boundary command/query**, after the first Step 1B attempt's query failed
without producing any grant-boundary booleans (PR #207). The correction keeps
Step 1B **catalog-booleans-only**, **secret-safe**, and **fail-closed**, and
**splits the combined grant-boundary query into smaller slices** before
recombining.

This PR **executes nothing**: no production command, no `psql`, no SQL, no query
rerun, no raw-output inspection, no `buyerrecon_stage0_runner` password use, no
psql login as the runner, no password reset, no role change, no GRANT/DML/DDL, no
Stage 0, no run-lock touch, no runtime/deploy/downstream/customer action. No real
DSN, password, host, port, token, or raw value appears in this document.

> Provenance: PR #204 corrected Step 1 query/command adjustment plan
> (`e22ff83045017e56082ff009a69257901b547d4d`); PR #206 Step 1A role metadata
> clean evidence (`b2a38af7588ceaeda87f41050c621dc4af80206d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1A_ROLE_METADATA_CLEAN`); PR #207 Step 1B
> grant-boundary blocked evidence (`333064965e6d5dd9121a113ae49f0ade531f0197`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_GRANT_BOUNDARY_BLOCKED_QUERY_FAILED`).

---

## 1. Problem to Solve

- **Step 1A is clean** (PR #206): `role_exists=true`, `role_can_login=true`,
  `role_validity_state=unbounded`, `role_has_no_superuser/createdb/createrole=true`,
  `step1a_role_metadata_result=role_metadata_clean`.
- **Step 1B was invoked but blocked** (PR #207):
  `diagnostic_scope=pr204_step1b_grant_boundary_classifier`,
  `step1b_query_invoked=true`, `step1b_query_pass=false`,
  `raw_sql_output_printed=false`,
  `step1b_grant_boundary_result=blocked_step1b_query_failed`.

**No Step 1B booleans were produced.** Therefore this plan does **not** claim
`required_grants_hold` or `forbidden_privileges_absent`, does **not** infer that
required grants are missing or forbidden privileges are present, and does **not**
infer that password/custody is the cause. **The combined privilege joins are one
possible fragile element of the query path**, but the **exact Step 1B query
failure cause remains unproven** because raw output was withheld. The fix is to
**split the combined query into smaller fail-closed slices** — **Step 1B-A is
designed as a smaller first slice to test object-presence labels before privilege
probes** — each emitting a strict allowlist of booleans.

---

## 2. Planning Intent

- Keep Step 1B **catalog-booleans-only** (no row/value output).
- Use the **approved custody connection only**.
- **Do not** use the `buyerrecon_stage0_runner` password.
- **Do not** psql login as `buyerrecon_stage0_runner`.
- **Raw SQL / PostgreSQL output must remain withheld** (→ chmod-600 temp; never
  printed).
- **Emit safe allowlist labels only.**
- **Split the combined grant-boundary query into smaller fail-closed slices
  before recombining.**

---

## 3. Recommended Adjusted Sequence (smallest-first; one sub-step at a time)

> **Safest path: one corrected sub-step at a time, each with its own evidence
> PR.** **Step 1B-A** is the **first** corrected execution unit. Later B/C/D/E
> steps require **either a separate GO each, or a clearly bounded staged GO** if
> separately reviewed. Each slice is **fail-closed** (exact label-set match;
> non-zero exit on any error/mismatch) and emits **booleans only**.

### Step 1B-A — relation/sequence presence only
Emit **only**:
- `accepted_events_relation_present`;
- `ingest_requests_relation_present`;
- `stage0_decisions_relation_present`;
- `stage0_decisions_sequence_present`;
- `step1b_a_object_presence_result`.

Catalog presence checks only (`pg_class` / `information_schema` / `pg_sequences`);
**no** `has_table_privilege` / `has_sequence_privilege` joins yet. This tests
object-presence labels separately, before any privilege probes, so each part is
evaluated on its own (object resolution being **one possible fragile element**;
the exact Step 1B failure cause remains unproven).

### Step 1B-B — required table privileges only
Emit **only**:
- `accepted_events_select_hold`;
- `ingest_requests_select_hold`;
- `stage0_decisions_select_hold`;
- `stage0_decisions_insert_hold`;
- `stage0_decisions_update_hold`;
- `step1b_b_required_table_privileges_result`.

Uses `has_table_privilege(...)` booleans only, per relation/operation.

### Step 1B-C — required sequence privileges only
Emit **only**:
- `stage0_decisions_sequence_usage_hold`;
- `step1b_c_required_sequence_privileges_result`.

Uses `has_sequence_privilege(...)` booleans only. (Note: `stage0_decisions` PK is
`gen_random_uuid()` per migration 012 — whether a sequence is involved at all is
itself verified by 1B-A; this slice is included for completeness and fails closed
if the object is absent.)

### Step 1B-D — forbidden privileges absent only
Emit **only**:
- `public_schema_create_absent`;
- `accepted_events_write_privileges_absent`;
- `ingest_requests_write_privileges_absent`;
- `stage0_decisions_destructive_privileges_absent`;
- `step1b_d_forbidden_privileges_result`.

Negative booleans only (forbidden write/destructive/schema-create privileges must
be absent).

### Step 1B-E — combined decision (only after A–D evidence)
Emit **only**:
- `required_grants_hold`;
- `forbidden_privileges_absent`;
- `step1b_grant_boundary_result`.

Recombines the A–D results into the original Step 1B verdict **only after** each
slice has executed cleanly with its own evidence.

---

## 4. Stop-Lines

Abort (safe stop-line + non-zero exit) if any of:
- raw SQL output would be printed;
- raw PostgreSQL error text would be printed;
- DSN / password / token / host / port / IP would be printed;
- any query emits **unexpected labels**, or **more/fewer** labels than the
  allowlist (exact label-set match required per sub-step);
- any Step 1B sub-query fails;
- any password / reset / role change / GRANT / DML / DDL would occur;
- any psql login as `buyerrecon_stage0_runner` would occur;
- Stage 0 or the run-lock would be touched;
- `.env.production` would be mutated;
- any runtime / downstream / Lane A·B / scoring / AMS / customer output would be
  touched;
- Gate 4E or Gate 4F would run.

If a stop-line is hit, withhold raw output, record the blocked state in a
docs-only evidence PR, and take no fix/retry without separate review/GO.

---

## 5. Safety Boundaries (this planning PR)

- **No production command** run by this PR.
- **No SQL / psql** executed by this PR.
- No query rerun.
- No raw-output inspection.
- No `buyerrecon_stage0_runner` password use.
- No psql login as `buyerrecon_stage0_runner`.
- No password reset.
- No role change.
- No GRANT / DML / DDL.
- No Stage 0.
- No run-lock.
- No runtime / deploy / downstream / customer action.

---

## 6. Evidence Requirements (for any future execution)

Every future Step 1B-A/B/C/D/E execution (each separately GO-gated, or under a
clearly bounded staged GO) must:
- emit **safe labels only** (the exact allowlist for that sub-step);
- **withhold raw output** (raw SQL → chmod-600 temp; never printed);
- contain **no secret / raw infrastructure values** (no DSN/password/token/host/
  port/IP/raw SQL/raw error text/customer/row data);
- be recorded in a **docs-only evidence PR after each execution step**;
- **no retry or fix after a blocked result without separate review/GO.**

---

## 7. Explicit Non-Authorization

**Merging this planning PR does not authorize** corrected Step 1B execution, query
rerun, raw-output inspection, password reset, role change, GRANT/DML/DDL, psql
login as the runner, Stage 0 retry, run-lock touch, or runtime action.
**Corrected Step 1B-A requires Codex review and a fresh explicit Helen GO.**

---

## 8. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Helen issues a separate explicit GO** for **one** corrected **Step 1B-A**
   relation/sequence presence check (approved custody connection only; no runner
   password; no login as the runner; raw output withheld; allowlist booleans
   only).
3. Docs-only **Step 1B-A evidence PR** (safe labels only).
4. **Step 1B-B/C/D** each only after the prior slice's clean evidence — separate
   GO each (or a clearly bounded staged GO if separately reviewed).
5. **Step 1B-E** combined decision only after A–D evidence → docs-only evidence
   PR.
6. **Step 1C** decision (password custody/reset vs role usability) only after the
   full Step 1B picture — its own plan + Codex review + GO. **Do not pre-judge.**
7. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. The corrected Step 1B sub-steps use the **approved custody
connection only** (never the `buyerrecon_stage0_runner` login/password), emit
**catalog booleans only**, and withhold raw output. All values above are safe
labels / booleans / public git commit hashes / role / database / relation names —
not secret or row values.
