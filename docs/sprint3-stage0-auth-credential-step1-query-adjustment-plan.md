# Sprint 3 — Stage 0 auth/credential Step 1 — Query/Command Adjustment Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP1_QUERY_ADJUSTMENT_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **corrected Step 1
command/query** for the role login/usability metadata preflight, after the first
Step 1 attempt's **metadata query failed** without producing any role booleans
(PR #203). The correction keeps Step 1 **catalog-booleans-only**, **secret-safe**,
and **fail-closed**, and starts with a **smaller query shape** before reintroducing
the full grant matrix.

This PR **executes nothing**: no production command, no `psql`, no SQL, no query
rerun, no raw-output inspection, no password use, no psql login as
`buyerrecon_stage0_runner`, no password reset, no role change, no GRANT/DML/DDL,
no Stage 0, no run-lock touch, no runtime/deploy/downstream/customer action. No
real DSN, password, host, port, token, or raw value appears in this document.

> Provenance: PR #201 diagnostic result
> (`f592c1313081956e4c4277dfd23bdb72afd74fa1`,
> `STAGE0_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`); PR #202 auth/credential
> resolution plan (`4b1aa590aa8e32385c39e044d3cbcd5be9a20177`); PR #203 Step 1
> metadata preflight blocked evidence
> (`ab921c0faa649772ce3a40002b76373b7592ae8d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1_METADATA_PREFLIGHT_BLOCKED_QUERY_FAILED`).

---

## 1. Problem to Solve

The first Step 1 metadata preflight attempted to emit role login/usability
booleans, but the **metadata query failed**:
- `metadata_query_invoked=true`;
- `metadata_query_pass=false`;
- `raw_sql_output_printed=false`;
- `step1_role_metadata_preflight_result=blocked_metadata_query_failed`.

**No role booleans were produced.** Therefore this plan does **not** claim
`role_exists`, `role_can_login`, `role_validity_state`, `required_grants_hold`,
or `forbidden_privileges_absent`, and does **not** infer password issue vs
role-usability issue. The blockage is at the **query execution / output** stage,
so the fix is a **smaller, fail-closed query shape** that is more likely to
execute cleanly and emit a strict allowlist of booleans.

---

## 2. Planning Intent

- Keep Step 1 **catalog-booleans-only** (no row/value output).
- **Do not** use the `buyerrecon_stage0_runner` password.
- **Do not** psql login as `buyerrecon_stage0_runner`.
- Use the **existing approved custody connection only** (the same approved
  read/diagnostic path already used; never the runner login).
- **Raw SQL / PostgreSQL output must remain withheld** (→ chmod-600 temp; never
  printed).
- **Emit safe labels only.**
- Prefer a **smaller, fail-closed query shape** before reintroducing the full
  grant matrix.

---

## 3. Recommended Adjusted Sequence (each step separately GO-gated)

### Step 1A — minimal role metadata classifier (no privilege checks yet)
Emit **only** this strict allowlist of booleans (catalog metadata only; no
table/sequence privilege checks):
- `role_exists`;
- `role_can_login`;
- `role_validity_state` (e.g. not-expired boolean if a validity is set);
- `role_has_no_superuser`;
- `role_has_no_createdb`;
- `role_has_no_createrole`;
- `step1a_role_metadata_result`.

Rationale: this avoids the table/sequence privilege joins (the likely source of
the failed query) and tests whether a **minimal** `pg_roles`-only query executes
and emits the allowlist cleanly. **Fail closed** if the query errors or the label
set does not match the allowlist exactly.

### Step 1B — grant boundary check (only if Step 1A passes; separately GO-gated if desired)
Emit **only**:
- `required_grants_hold` (positive Stage 0 grants present — boolean);
- `forbidden_privileges_absent` (Risk/POI/POI-seq/Lane/scoring/AMS, `stage0_decisions`
  DELETE, membership, ownership all absent — boolean);
- `step1b_grant_boundary_result`.

Reintroduces the grant matrix **only after** the minimal classifier (1A) is known
to execute cleanly.

### Step 1C — decision (only after 1A/1B evidence)
- Based on 1A/1B booleans, decide whether the remaining `auth_or_credential`
  issue points to **password custody/reset planning** (PR #202 Step 2) or **role
  usability planning** — itself a **separate** docs-only plan + Codex review +
  fresh GO. **Do not pre-judge** here.

### Step 1D / beyond — no Stage 0 retry
- **No Stage 0 retry** unless a later PR #198-style psql gate diagnostic passes
  **and** Stage 0 receives a **separate explicit GO** (under the full PR #189
  flow). **Stage 0 execution remains separately GO-gated.**

---

## 4. Stop-Lines

Abort (safe stop-line + non-zero exit) if any of:
- raw SQL output would be printed;
- raw PostgreSQL error text would be printed;
- DSN / password / token / host / port / IP would be printed;
- the query emits **unexpected labels**, or **more/fewer** labels than the
  allowlist (exact label-set match required);
- the metadata query fails again;
- any password / reset / role change / GRANT / DML / DDL would occur;
- any psql login as `buyerrecon_stage0_runner` would occur;
- Stage 0 or the run-lock would be touched;
- `.env.production` would be mutated;
- any runtime / downstream / Lane A·B / scoring / AMS / customer output would be
  touched.

If a stop-line is hit, withhold raw output, record the blocked state in a
docs-only evidence PR, and take no fix/retry without separate review/GO.

---

## 5. Safety Boundaries (this planning PR)

- **No production command** run by this PR.
- **No SQL / psql** executed by this PR.
- No raw output inspection.
- No password use.
- No psql login as `buyerrecon_stage0_runner`.
- No password reset.
- No role change.
- No GRANT / DML / DDL.
- No Stage 0.
- No run-lock.
- No runtime / deploy / downstream / customer action.

---

## 6. Evidence Requirements (for any future execution)

Every future Step 1A/1B execution (each separately GO-gated) must:
- emit **safe labels only** (the exact allowlist for that step);
- **withhold raw output** (raw SQL → chmod-600 temp; never printed);
- contain **no secret / raw infrastructure values** (no DSN/password/token/host/
  port/IP/raw SQL/raw error text/customer/row data);
- be recorded in a **docs-only evidence PR after execution**;
- **no retry or fix after a blocked result without separate review/GO.**

---

## 7. Explicit Non-Authorization

**Merging this planning PR does not authorize** a corrected Step 1 run, query
execution, raw-output inspection, password reset, role change, GRANT/DML/DDL,
psql login as the runner, Stage 0 retry, run-lock touch, or runtime action.
**Corrected Step 1A requires Codex review and a fresh explicit Helen GO.**

---

## 8. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Helen issues a separate explicit GO** for **one** corrected **Step 1A**
   minimal role metadata classifier (approved custody connection only; no runner
   password; no login as the runner; raw output withheld; allowlist booleans
   only).
3. Docs-only **Step 1A evidence PR** (safe labels only).
4. **Step 1B** only if 1A passes (own GO / evidence PR).
5. **Step 1C** decision → separate plan (password custody/reset vs role
   usability) → Codex review → GO.
6. **Stage 0 execution remains separately GO-gated.**

---

## 9. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. The corrected Step 1 uses the **approved custody connection only**
(never the `buyerrecon_stage0_runner` login/password), emits **catalog booleans
only**, and withholds raw output. All values above are safe labels / booleans /
public git commit hashes / role / database names — not secret or row values.
