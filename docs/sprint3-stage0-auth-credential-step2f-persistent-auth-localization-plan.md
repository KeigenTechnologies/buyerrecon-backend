# Sprint 3 — Stage 0 auth/credential Step 2F — Persistent-Auth Localization Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2F_PERSISTENT_AUTH_LOCALIZATION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans **safe-label-only
diagnostics to localize why `auth_or_credential` persists** after a **confirmed**
Step 2D password rotation (PR #225) — **without** exposing raw PostgreSQL errors,
DSNs, passwords, host/port/IP/URI, pg_hba lines, or customer data.

This PR **executes nothing** and **authorizes no production command**: no `psql`, no
SQL, no password reset/rotation, no Stage 0, no run-lock touch, no `.env.production`
mutation, no raw-output inspection, no runtime/deploy/downstream/customer action. No
real DSN, password, host, port, IP, token, URI, or raw value appears in this document.

> Provenance: PR #225 Step 2D local-postgres-path rotation committed
> (`1107ecff7a400ef12d56056dcde7c757bc692237`,
> `STAGE0_AUTH_CREDENTIAL_STEP2D_LOCAL_POSTGRES_PATH_ROTATION_COMMITTED`); PR #226
> Step 2E post-fix psql gate — `auth_or_credential` persists
> (`48f7731e8e138d10d4c5d699314c6aacf583b2bc`,
> `STAGE0_AUTH_CREDENTIAL_STEP2E_POST_FIX_PSQL_GATE_AUTH_OR_CREDENTIAL`); built on PR
> #218 Step 2C `auth_or_credential` reproduced
> (`92d568a6b7491500db4de1732c3b9015a0ddc14e`) and PR #201 original broad
> `auth_or_credential` (`f592c1313081956e4c4277dfd23bdb72afd74fa1`).

---

## 1. Problem to Localize

- Step 2D **committed** the scoped `ALTER ROLE buyerrecon_stage0_runner` password
  rotation via the local postgres admin authority path (PR #225,
  `rotation_committed`).
- Step 2E's post-fix PR #198-style psql gate diagnostic **still failed** (PR #226):
  `psql_invoked=true`, `psql_gate_query_pass=false`, `psql_gate_classifier_pass=true`,
  `psql_gate_failure_class=auth_or_credential`,
  `step2e_psql_gate_result=gate_failed_raw_output_withheld`.
- Therefore the **committed password rotation did not clear the psql gate**, and the
  persistent failure is **not explained by the runner password value alone**.
- The **exact raw PostgreSQL error and the exact root cause remain unproven and
  unexposed.** This plan localizes **which** of several unproven hypotheses holds,
  using safe-label-only probes. **No hypothesis is pre-judged.**

---

## 2. Candidate Hypotheses to Separate (all UNPROVEN)

1. **Connection-field mismatch** — the diagnostic connection fields may not target the
   same database/path assumed by the rotation. (Do **not** print host/port/URI.)
2. **Role/login state mismatch** — `buyerrecon_stage0_runner` may not be the login
   identity actually reached by the diagnostic path, or may have login/validity/role
   attributes differing from expected.
3. **pg_hba / auth-method / SSL rule issue** — the failure could be auth-method, an
   SSL requirement, or pg_hba matching behaviour rather than the password value.
4. **Connection routing layer** — pgbouncer / proxy / local-vs-remote routing may be
   involved.
5. **Cached or second credential location** — the password used by the diagnostic may
   not be the rotated value, despite hidden-input discipline.
6. **Diagnostic command shape mismatch** — the post-fix gate command may differ in
   material ways from the intended Stage 0 runner connection path.

---

## 3. Planning-Only / Non-Authorization

- **This PR runs no production command.**
- No psql/SQL.
- No password reset or credential rotation.
- No Stage 0.
- No run-lock.
- No `.env.production` mutation.
- No raw-output inspection.
- The operator performs any future diagnostic manually, under a separate fresh GO.
  Claude Code executes nothing.

---

## 4. Proposed Safe Diagnostic Stages — CANDIDATE ONLY — DO NOT RUN

> Design sketch for review; not runnable commands and not authorization to run
> anything. Every stage is **fail-closed**, emits **safe booleans/categories only**,
> and **withholds raw output** (raw text → `chmod 600` temp; never printed). No stage
> prints a password, DSN, host, port, IP, URI, raw pg_hba line, raw PostgreSQL error,
> or row value. Each stage is **separately GO-gated** (or under a clearly bounded
> staged GO if separately reviewed), each with its own docs-only evidence PR.

### Stage A — local catalog-only structural role-state check (via local postgres admin path)
- Via the confirmed local postgres admin authority path (PR #223), catalog-only.
- Emit **safe booleans only**, e.g.: `role_exists`, `role_login_enabled`,
  `role_validity_category` (e.g. `unbounded`/`bounded`/`expired`), `role_superuser=false`,
  `role_createrole=false`, `expected_role_name_match`.
- **No password value; no raw role list; no raw catalog dump.**

### Stage B — connection-component category check
- Parse the diagnostic connection source **in memory only**.
- Print **only categories/booleans**, e.g.: `db_expected=true/false`,
  `host_present=true/false`, `port_present=true/false`, `sslmode_required=true/false`,
  `user_is_expected_runner=true/false`.
- **No host / port / URI / DSN printed.**

### Stage C — pg_hba / auth-method / SSL structural classification
- Classify the relevant auth rule **structurally** only.
- Emit **safe booleans/categories only**, e.g.: `auth_method_category`
  (e.g. `md5`/`scram`/`peer`/`trust`/`cert`/`other`), `ssl_required_category`,
  `hba_match_category`.
- **No raw pg_hba lines, no IPs, no host/network values.**

### Stage D — local-vs-remote path comparison
- Compare whether the **local admin path** and the **diagnostic path** target the
  **same database/role category**, using booleans only, e.g.:
  `same_database_category=true/false`, `same_role_category=true/false`,
  `same_auth_path_category=true/false`.
- **No connection strings or raw outputs.**

### Stage E — optional one bounded authentication classifier rerun (only if separately GO-gated)
- One PR #198-style classifier rerun, **raw output withheld**, **same classifier
  vocabulary only** (`psql_gate_query_pass`, `psql_gate_classifier_pass`,
  `psql_gate_failure_class`), **no Stage 0**.

---

## 5. Candidate Safe Labels

> Allowlist only. Booleans/categories — **never** a password, DSN, host, port, IP,
> URI, raw pg_hba line, raw PostgreSQL error, or row value.

```text
step2f_persistent_auth_localization_plan_created=true
diagnostic_scope=step2f_persistent_auth_after_rotation
prior_step2d_rotation_committed=true
prior_step2e_auth_or_credential_persisted=true
exact_root_cause_proven=false
stage0_authorized=false
psql_sql_invoked=false
password_reset_attempted=false
credential_rotation_attempted=false
raw_output_printed=false
raw_postgres_error_printed=false
dsn_password_host_port_ip_uri_printed=false
```

---

## 6. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- a raw password / DSN / token / host / port / IP / URI would be printed;
- raw PostgreSQL error text would be printed;
- raw pg_hba lines or network values would be printed;
- the command would reset / rotate a password;
- the command would run Stage 0;
- the command would touch the run-lock;
- the command would mutate `.env.production`;
- the command would run GRANT / DML / DDL or schema / runtime changes;
- the command would inspect or print customer data or row values.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 7. Safety Boundaries (this planning PR)

- **No production command** run by this PR.
- **No psql / SQL** executed by this PR.
- No password reset / credential rotation.
- No Stage 0.
- No run-lock.
- No `.env.production` mutation.
- No raw-output inspection.
- No runtime / deploy / downstream / customer action.

---

## 8. Evidence Requirements (for any future Step 2F diagnostic)

Every future Step 2F stage execution (separately GO-gated) must:
- emit **safe labels only** (the §5 allowlist + that stage's allowlisted booleans;
  never a password/DSN/raw value);
- **withhold raw output** (raw text → `chmod 600` temp; never printed);
- contain **no password / DSN / host / port / IP / URI / raw pg_hba line / raw
  PostgreSQL error text / customer / row data**;
- be recorded in a **docs-only evidence PR after each stage**;
- carry out **no password rotation / Stage 0 / next fix** off the diagnostic without
  separate review/GO.

---

## 9. Explicit Non-Authorization

**Merging this plan does not authorize:**
- any diagnostic;
- Step 2F execution;
- another password rotation;
- Stage 0.

**Any diagnostic requires Codex review and a fresh explicit Helen GO.** **Stage 0
remains separately GO-gated.**

---

## 10. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Helen issues a separate explicit GO** for **one** Step 2F stage (A/B/C/D, or E if
   separately GO-gated) — safe-label-only, raw output withheld, no Stage 0.
3. Docs-only **Step 2F stage evidence PR** (safe labels only) → repeat per stage as
   separately GO-gated.
4. Once the persistence cause is localized, a **separately reviewed remediation plan**
   (its own docs-only plan/command-pack) under a **fresh explicit Helen GO**. **Do not
   pre-judge** the cause.
5. **Stage 0 execution remains separately GO-gated** (only after a later clean post-fix
   psql gate diagnostic and a separate Stage 0 GO).

---

## 11. Safety / Raw-Data Boundary

This record contains no password value, DSN URI, connection string, `.env.production`
content, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local),
IPv6 address, hostname, port value, URI, raw pg_hba line, SSH banner, login source,
host/network detail, raw payload, `canonical_jsonb` payload, `accepted_events` row
data, raw behavioural row data, real `session_id` / `request_id` value, user-agent
value, raw SQL, raw psql output, raw PostgreSQL error text, or customer data. Every
candidate Step 2F stage emits **safe booleans/categories only**, withholds raw output,
and uses catalog-only / in-memory-only parsing — never printing a secret or raw value.
(Per the PR #218 Codex note: "no secret used or exposed" is to be read as "no secret
value exposed, printed, or recorded.") All values above are safe labels / booleans /
public git commit hashes / role / database names — not secret or row values.
