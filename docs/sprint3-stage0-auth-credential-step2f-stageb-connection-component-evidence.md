# Sprint 3 — Stage 0 auth/credential Step 2F Stage B — Connection-Component Category Diagnostic — Evidence (user category unexpected)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2F_STAGE_B_CONNECTION_COMPONENT_USER_CATEGORY_UNEXPECTED`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2F STAGE B CONNECTION-COMPONENT CATEGORY GO`, the
operator ran **exactly one** PR #227 Step 2F **Stage B** connection-component category
diagnostic. It **parsed the relevant connection source in memory only** and emitted
**safe categories/booleans** — no database connection, no psql/SQL, no raw value. The
finding: the connection source is present and parseable, the database category is
expected, but the **user category is unexpected** (`app_or_collector`, not a
`buyerrecon_stage0_runner` category) →
`connection_components_result=user_category_unexpected`.

**This localizes a likely connection-source/category mismatch — it does NOT print any
raw connection value, does NOT prove the exact raw PostgreSQL error or final
remediation, and is NOT a Stage 0 execution.** This PR records safe
**booleans/categories only** — no secrets, DSN, password, token, host, port, IP, URI,
`.env.production` content, raw SQL/error text, host/network details, or raw data.

> Provenance: PR #227 Step 2F persistent-auth localization plan
> (`c1b3dd2d8c311b9fd568b304841050630486d607`,
> `STAGE0_AUTH_CREDENTIAL_STEP2F_PERSISTENT_AUTH_LOCALIZATION_PLANNING_ONLY`); built on
> PR #226 Step 2E post-fix gate `auth_or_credential` persists
> (`48f7731e8e138d10d4c5d699314c6aacf583b2bc`) and PR #225 Step 2D rotation committed
> (`1107ecff7a400ef12d56056dcde7c757bc692237`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2F STAGE B CONNECTION-COMPONENT CATEGORY GO`
  — exactly **one** PR #227 Step 2F Stage B connection-component category diagnostic;
  in-memory parse only; safe categories/booleans only; **no** database connection;
  **no** psql/SQL; **no** DSN/password/host/port/IP/URI printed; raw output withheld.
- This did **not** authorize modifying `.env.production`, adding a runner DSN, another
  diagnostic, a password reset/rotation, a Step 2E rerun, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Stage B diagnostic)

```text
step2f_stage_b_connection_component_diagnostic_run=true
diagnostic_scope=step2f_stage_b_connection_component_category
stage0_executed=false
run_lock_touched=false
env_production_mutated=false
psql_sql_invoked=false
database_connection_attempted=false
password_reset_attempted=false
credential_rotation_attempted=false
custody_value_updated=false
grant_dml_ddl_run=false
raw_output_printed=false
raw_postgres_error_printed=false
dsn_password_host_port_ip_uri_printed=false
runtime_downstream_customer_action=false
lane_scoring_ams_customer_output=false
gate4e_gate4f_action=false
production_host_confirmed=true
expected_branch_head_confirmed=true
pr227_plan_present=true
connection_source_present=true
connection_source_category=database_url
connection_parseable=true
db_expected=true
user_expected_category=app_or_collector
sslmode_category=not_specified
host_present=true
port_present=true
connection_components_result=user_category_unexpected
```

---

## 3. Interpretation (bounded)

- The **Step 2F Stage B diagnostic ran exactly once**
  (`step2f_stage_b_connection_component_diagnostic_run=true`) under the trusted scope
  label `diagnostic_scope=step2f_stage_b_connection_component_category`, on the
  confirmed production host and expected branch/head (`production_host_confirmed=true`,
  `expected_branch_head_confirmed=true`, `pr227_plan_present=true`).
- It **parsed the connection source in memory only** and emitted **safe
  categories/booleans**; **no database connection was attempted**
  (`database_connection_attempted=false`); **no** psql/SQL (`psql_sql_invoked=false`).
- **No raw value was exposed:** no DSN/password/token/host/port/IP/URI printed
  (`dsn_password_host_port_ip_uri_printed=false`), no `.env.production` content, no raw
  SQL/PostgreSQL error text (`raw_output_printed=false`,
  `raw_postgres_error_printed=false`).
- **Connection-component categories:**
  - the connection source is **present and parseable**
    (`connection_source_present=true`, `connection_parseable=true`);
  - the source category is **`database_url`**
    (`connection_source_category=database_url`);
  - the **database category is expected** (`db_expected=true`);
  - **host and port components are present as booleans only** — **no values printed**
    (`host_present=true`, `port_present=true`);
  - `sslmode` is **not specified** (`sslmode_category=not_specified`);
  - the **user category is unexpected** — `app_or_collector`, not a
    `buyerrecon_stage0_runner` category (`user_expected_category=app_or_collector`).
- **Result:** `user_category_unexpected`.
- **This localizes a likely connection-source/category mismatch:** the diagnostic path
  appears to parse a `DATABASE_URL` / app-or-collector-style **user category** rather
  than a `buyerrecon_stage0_runner` connection category.
- **This explains why rotating `buyerrecon_stage0_runner` did not clear the Step 2E
  gate** (PR #226): if the gate/diagnostic path authenticates as an app/collector user
  category rather than the runner, then rotating the runner password would not change
  that path's auth outcome. **However**, it still does **not** prove the exact raw
  PostgreSQL error or the final remediation.
- This is a **connection-component category finding only.** It:
  - does **not** authorize modifying `.env.production`;
  - does **not** authorize adding a runner DSN;
  - does **not** authorize another diagnostic;
  - does **not** authorize a password reset/rotation;
  - does **not** authorize a Step 2E rerun;
  - does **not** authorize Stage 0.

---

## 4. What Did Not Happen

- No database connection; no psql/SQL.
- No DSN / password / token / host / port / IP / URI printed or recorded.
- No `.env.production` content printed; no `.env.production` mutation.
- No raw SQL output; no raw psql output; no raw PostgreSQL error text.
- No password reset; no credential rotation; no custody value update.
- No GRANT / DML / DDL.
- No another diagnostic beyond the one authorized; no Step 2E rerun.
- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No role / grant / schema / deploy / runtime / downstream change.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- No SSH banner, login source, IP address, local IP, IPv6 address, or host/network
  detail recorded.

---

## 5. Verdict

- **LOCALIZED (category mismatch) — Step 2F Stage B is `user_category_unexpected`**:
  the connection source is present/parseable, source category `database_url`, database
  category expected, host/port present as booleans only, `sslmode` not specified, but
  the **user category is `app_or_collector`** rather than a `buyerrecon_stage0_runner`
  category; in-memory parse only; no database connection; raw output withheld; no
  secret used or exposed, printed, or recorded.
- This is a **strong candidate explanation** for why the Step 2D rotation did not clear
  the Step 2E gate, but it is **not** proof of the exact raw PostgreSQL error, **not**
  a final remediation, **not** authorization to modify `.env.production` / add a runner
  DSN / rerun a diagnostic / rotate again / run Step 2E / Stage 0, and **not** a Stage 0
  execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** modify `.env.production`, add/modify a runner DSN or any secret, run
   another diagnostic, reset/rotate a password, rerun Step 2E, run Stage 0, touch the
   run-lock, or run any runtime/downstream/customer action off this evidence.
3. Prepare a **docs-only remediation/plan branch** to define the **correct Stage 0
   runner connection-source contract or execution binding**, based on this Stage B
   finding (the diagnostic/Stage 0 path should authenticate as
   `buyerrecon_stage0_runner`, not an app/collector user category) — secret-safe,
   fail-closed, no raw value — then **Codex review** and a **fresh explicit Helen GO**.
4. **Any change** to connection source, env binding, runner DSN, command-pack, or
   Stage 0 execution requires its **own Codex review and fresh explicit Helen GO**.
5. **Stage 0 execution remains separately GO-gated.**

---

## 7. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local),
IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw
SQL, raw psql output, raw PostgreSQL error text, or customer data. Stage B parsed the
connection source **in memory only** and emitted **safe categories/booleans only**
(presence/parseable/category flags) — host/port were recorded as **boolean presence
only** (`host_present=true`, `port_present=true`) with **no values printed**, and the
user mismatch is recorded as a **category** (`app_or_collector`) **not** a username or
connection value; **no database connection was attempted** and raw output was withheld.
(Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret
value exposed, printed, or recorded.") All values above are safe labels / booleans /
categories / public git commit hashes / role / database names — not secret or row
values.
