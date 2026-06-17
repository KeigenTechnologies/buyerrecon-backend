# Sprint 3 — Stage 0 — Route C Role / Connection-Policy Diagnostics Plan (Review-Only)

**Status:** `STAGE0_ROUTE_C_ROLE_CONNECTION_POLICY_DIAGNOSTICS_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. Route A safely classified the live-auth
failure as **`role_missing_or_not_login`** (PR #291). This plans a **future boolean/category-only
diagnostic command pack** to identify **which DB-side role / connection-policy condition**
explains that class — **as planning only, not execution**.

This PR **executes nothing** and **authorizes no** production command, psql/auth rerun,
raw-output inspection, credential rotation, custody write, Route B execution, Route C execution,
Step 2E, Stage 0, run-lock touch, grants, schema/data changes, source-selection change, Option B
code change, remediation, downstream runtime, Lane/scoring/AMS/customer output, Gate 4E, or
Gate 4F. **No** raw `pg_hba`, host, port, IP, DSN, credential, role password/hash, service
detail, `.env.production` value, custody contents, raw PostgreSQL error text, customer payload,
or PII appears in this document.

> Provenance: PR #291 Route A classifier result `role_missing_or_not_login`
> (`e84f8775cfef24ea2e08dfe62fee37558dca7e9a`,
> `STAGE0_ROUTE_A_CLASSIFIER_RESULT_ROLE_MISSING_OR_NOT_LOGIN`); PR #290 retained-capture
> PRESENT (`464ef735e85f39de79c60a3b2e675097a29ac37e`); PR #284 Option A live-auth preflight
> AUTH_FAILED, raw withheld (`f710696b20278d406f0b5f5a457ac7b81ccb5664`); PR #285 investigation
> plan (Route C defined) (`2d985e5643136b78281c8c06742f5f6443f57349`).

---

## 1. Evidence Chain

- **PR #291** (`e84f8775cfef24ea2e08dfe62fee37558dca7e9a`): Route A classifier result
  **`classifier_result=role_missing_or_not_login`**, `classifier_result_safe=true`. Route A
  printed **no raw output, no matched text, no DSN, and no connection components**; **Stage 0
  did not run** and the **run-lock was not touched**.
- **Bounded:** Route A classified the failure into the **role-existence / `LOGIN` / role-policy**
  family. It does **not** prove exact role existence, `LOGIN` state, `VALID UNTIL`,
  connection-limit state, `pg_hba`/SSL condition, live auth, or Stage 0 readiness; and it does
  **not** authorize Stage 0.
- **Route C is now the correct next planning route** (not Route B password/custody correction).

---

## 2. Purpose

Define a **future** diagnostic command pack that identifies **which DB-side role /
connection-policy condition** explains `role_missing_or_not_login` for the runner role
`buyerrecon_stage0_runner`. Diagnostic output must be **boolean/category-only** and must **not**
expose raw `pg_hba`, host, port, DSN, credential, service details, `.env.production` values,
custody contents, raw PostgreSQL error text, customer payload, or PII.

---

## 3. Candidate Diagnostic Categories

```text
role_exists=true|false
role_can_login=true|false
role_valid_until_state=valid|expired|unset|unknown
role_connection_limit_state=unlimited|within_limit|at_or_over_limit|unknown
database_connect_privilege=true|false|unknown
required_role_membership_or_grants_state=present|missing|unknown
server_connection_policy_category=allows_connection|rejects_connection|unknown
ssl_policy_category=compatible|required_or_mismatch|unknown
route_c_result=role_missing|login_disabled|valid_until_expired|connection_limit_blocked|database_connect_missing|grant_or_membership_missing|connection_policy_blocked|ssl_policy_blocked|unknown
```

---

## 4. Safe SQL / Command Design Requirements (CANDIDATE ONLY — DO NOT RUN)

> Design contract for a **future, separately-reviewed, separately GO-gated** diagnostic —
> **not** run here.

- Prefer **catalog-only / metadata-only** queries (e.g. read `pg_roles` / `pg_catalog`
  attributes for the target role: `rolcanlogin`, `rolvaliduntil` state, `rolconnlimit` state;
  database `CONNECT` privilege via `has_database_privilege`-style checks; role membership/grant
  presence) — reducing each to a **boolean/category** only.
- Use a **read-only transaction** where applicable (e.g. `SET default_transaction_read_only=on`).
- Emit **booleans and categories only**.
- Do **not** print role password, password hash, secret, DSN, host, port, raw `pg_hba` lines,
  raw connection strings, or raw PostgreSQL error text.
- Do **not** run a live psql/auth **retry** as the runner unless separately planned and
  GO-gated. (Catalog reads would run via an already-authorized admin/diagnostic path, not by
  re-attempting the runner's failing login — and even that is a future, separately GO-gated
  step.)
- Do **not** mutate DB state.
- Do **not** run `ALTER ROLE` / `CREATE ROLE` / `GRANT` / `REVOKE` / DDL / DML.
- Do **not** touch Stage 0 or the run-lock.
- Do **not** use customer data.

> `server_connection_policy_category` / `ssl_policy_category` must be derived as **categories**
> only (e.g. "allows_connection" vs "rejects_connection"), **never** by printing raw `pg_hba`
> lines or host/port; if a category cannot be derived safely, it is `unknown` (fail closed).

---

## 5. Role Target

- The target role is **`buyerrecon_stage0_runner`**.
- The role **name** may appear (it is already part of the reviewed docs chain).
- **No** role password or secret material may appear.

---

## 6. Hard Boundaries

- **No** production command execution in this PR.
- **No** psql/auth rerun.
- **No** raw-output inspection.
- **No** credential rotation.
- **No** custody write.
- **No** Route B execution.
- **No** Route C execution.
- **No** Step 2E.
- **No** Stage 0.
- **No** run-lock touch.
- **No** grants, schema/data changes, source-selection change, Option B code change,
  remediation, downstream runtime, Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F.

---

## 7. Stop-Lines (future execution)

Abort (safe stop-line; boolean/category labels only; nothing sensitive printed) if any of:
- the **PR #291 merge commit** `e84f8775cfef24ea2e08dfe62fee37558dca7e9a` is **not present**;
- the working tree is **dirty** (except pre-existing untracked `deep-research-report*` files);
- any command would **print raw `pg_hba` lines**;
- any command would **print host / port / IP / DSN / credential / service details**;
- any command would **print role password / hash**;
- any command would **run an auth retry**;
- any command would **mutate role, grants, schema, or data**;
- any command would **touch Stage 0 / run-lock / downstream** action;
- the output **cannot be reduced to approved boolean/category labels**.

If a stop-line is hit, withhold all sensitive output, record the blocked/`unknown` state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate review/GO.

---

## 8. Future Evidence Labels

```text
route_c_diagnostic_attempted=true
pr291_merge_present=true|false
tracked_working_tree_clean=true|false
target_role_name_allowed=true
raw_pg_hba_printed=false
host_port_printed=false
dsn_printed=false
credential_printed=false
raw_postgres_error_printed=false
auth_retry_executed=false
db_mutation_executed=false
stage0_executed=false
run_lock_touched=false
role_exists=true|false|unknown
role_can_login=true|false|unknown
role_valid_until_state=valid|expired|unset|unknown
role_connection_limit_state=unlimited|within_limit|at_or_over_limit|unknown
database_connect_privilege=true|false|unknown
required_role_membership_or_grants_state=present|missing|unknown
server_connection_policy_category=allows_connection|rejects_connection|unknown
ssl_policy_category=compatible|required_or_mismatch|unknown
route_c_result=role_missing|login_disabled|valid_until_expired|connection_limit_blocked|database_connect_missing|grant_or_membership_missing|connection_policy_blocked|ssl_policy_blocked|unknown
```

---

## 9. Route Decision After Future Route C Evidence

- `role_missing` → plan a **separately reviewed / GO-gated** role creation or role restoration
  step.
- `login_disabled` → plan a **separately reviewed / GO-gated** role `LOGIN` correction step.
- `valid_until_expired` → plan a **separately reviewed / GO-gated** `VALID UNTIL` correction
  step.
- `connection_limit_blocked` → plan a **separately reviewed / GO-gated** connection-limit
  correction step.
- `database_connect_missing` or `grant_or_membership_missing` → plan a **separately reviewed /
  GO-gated** privilege/grant correction step.
- `connection_policy_blocked` or `ssl_policy_blocked` → plan a **separately reviewed / GO-gated**
  connection/SSL policy fix or runtime-binding change.
- `unknown` → **re-plan**.
- **No fix is authorized by this PR.**

After any such corrective step (separately reviewed and GO-gated), live auth must be re-proven
via a **separately GO-gated Option A binding/auth preflight rerun** before Step 2E / Stage 0.

---

## 10. Future Gated Sequence

1. **Merge** this docs-only Route C planning PR (after Codex review).
2. **Fresh explicit Helen GO** for **one** Route C diagnostic run (catalog/metadata-only,
   read-only, boolean/category labels only, fail closed).
3. Docs-only **Route C evidence PR** (safe labels + `route_c_result`).
4. Based on `route_c_result`, plan the matching **separately reviewed / GO-gated** corrective
   step (§9), then a **separately GO-gated Option A binding/auth preflight rerun** to re-prove
   live auth.
5. **Only if live auth passes** → plan **Step 2E / Stage 0** separately.
6. **Stage 0 execution remains separately GO-gated; `live_auth_proven` remains false** until
   live auth is genuinely proven.

---

## 11. Safety / Raw-Data Boundary

This record contains no secret value, DSN URI, connection string, raw password, password hash,
generated password, raw secret-manager payload, service-file content, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local),
IPv6 address, host value, port value, real URI, SSH banner, login source, host/network detail,
**raw `pg_hba` lines**, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw SQL output,
**raw psql output, raw PostgreSQL error text**, Node stack trace, or customer data. This is a
docs-only plan for a **future** role / connection-policy diagnostic that uses **catalog-only /
metadata-only** reads under a read-only transaction, reduces every result to a
**boolean/category** label (role existence, `LOGIN`, `VALID UNTIL` state, connection-limit
state, database `CONNECT` privilege, membership/grant presence, connection-policy category, SSL
category, and a single `route_c_result`), and **fails closed** to `unknown`; it **runs no
command**, performs **no** auth retry, mutates **no** role/grant/schema/data, prints **no** raw
`pg_hba`/host/port/DSN/credential/role-password/raw-error, and touches **no** Stage 0 / run-lock
/ downstream. The role name `buyerrecon_stage0_runner` and the database name
`buyerrecon_production` are non-secret identifiers; the recorded commit hashes are public.
(Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret value
exposed, printed, or recorded.") All values above are safe labels / booleans / category tokens
/ non-secret identifiers / public git commit hashes — not secret or row values.
