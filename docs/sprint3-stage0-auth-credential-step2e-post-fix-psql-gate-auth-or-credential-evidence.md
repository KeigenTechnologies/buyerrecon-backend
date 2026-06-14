# Sprint 3 — Stage 0 auth/credential Step 2E — Post-Fix psql Gate Diagnostic — Evidence (auth_or_credential persists)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2E_POST_FIX_PSQL_GATE_AUTH_OR_CREDENTIAL`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2E POST-FIX PSQL GATE DIAGNOSTIC GO`, the operator
ran **exactly one** post-fix PR #198-style safe-label-only psql gate diagnostic after
the PR #225 Step 2D password rotation committed. The classifier passed shape
(`psql_gate_classifier_pass=true`) but the gate query **still did not pass**
(`psql_gate_query_pass=false`), classifying the failure **again** as broad
`psql_gate_failure_class=auth_or_credential` — with raw psql output and raw
PostgreSQL error text **withheld** →
`step2e_psql_gate_result=gate_failed_raw_output_withheld`.

**This means the Step 2D password rotation did NOT clear the psql gate. It does NOT
expose or prove the exact raw PostgreSQL error, does NOT prove a specific root cause,
and is NOT a Stage 0 execution.** This PR changes nothing and records safe
**booleans/labels only** — no secrets, password, DSN, connection string, token, host,
port, IP, URI, raw SQL/error text, host/network details, or raw data.

> Provenance: PR #225 Step 2D local-postgres-path rotation committed
> (`1107ecff7a400ef12d56056dcde7c757bc692237`,
> `STAGE0_AUTH_CREDENTIAL_STEP2D_LOCAL_POSTGRES_PATH_ROTATION_COMMITTED`); PR #224
> revised Step 2D command-pack plan (`4108e1d0c9b9765911d43dcce52ea364cf5644b9`); PR
> #223 local postgres admin authority ready
> (`23879d070f9923851c96117822f5c175a4eb0bbb`); PR #218 Step 2C `auth_or_credential`
> reproduced (`92d568a6b7491500db4de1732c3b9015a0ddc14e`); PR #201 original broad
> `auth_or_credential` (`f592c1313081956e4c4277dfd23bdb72afd74fa1`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2E POST-FIX PSQL GATE DIAGNOSTIC GO` —
  exactly **one** post-fix PR #198-style safe-label-only psql gate diagnostic; raw
  output → withheld; allowlist labels only; **no** Stage 0.
- This did **not** authorize another password rotation, a Step 2F or any next fix, a
  Stage 0 retry, a run-lock touch, or any runtime/downstream/customer action.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 2E diagnostic)

```text
step2e_diagnostic_run=true
diagnostic_scope=post_step2d_pr198_style_psql_gate_rerun
stage0_executed=false
run_lock_touched=false
env_production_mutated=false
password_reset_attempted=false
credential_rotation_attempted=false
custody_value_updated=false
grant_dml_ddl_run=false
raw_output_withheld=true
raw_psql_output_printed=false
raw_postgres_error_printed=false
dsn_password_host_port_ip_uri_printed=false
runtime_downstream_customer_action=false
lane_scoring_ams_customer_output=false
gate4e_gate4f_action=false
production_host_confirmed=true
expected_branch_head_confirmed=true
pr225_rotation_evidence_present=true
runner_secret_present=true
psql_invoked=true
psql_gate_query_pass=false
psql_gate_classifier_pass=true
psql_gate_failure_class=auth_or_credential
step2e_psql_gate_result=gate_failed_raw_output_withheld
```

---

## 3. Interpretation (bounded)

- The **Step 2E post-fix psql gate diagnostic was run exactly once**
  (`step2e_diagnostic_run=true`) under the trusted scope label
  `diagnostic_scope=post_step2d_pr198_style_psql_gate_rerun`, on the confirmed
  production host and expected branch/head (`production_host_confirmed=true`,
  `expected_branch_head_confirmed=true`).
- **PR #225 rotation evidence was present** (`pr225_rotation_evidence_present=true`),
  and the **runner secret was supplied through hidden input only**
  (`runner_secret_present=true`).
- **psql was invoked** (`psql_invoked=true`).
- The **gate query did not pass** (`psql_gate_query_pass=false`), the **classifier
  passed shape** (`psql_gate_classifier_pass=true`), and the failure class **remains
  broad `auth_or_credential`** (`psql_gate_failure_class=auth_or_credential`).
- **Raw psql output and raw PostgreSQL error text were withheld**
  (`raw_output_withheld=true`, `raw_psql_output_printed=false`,
  `raw_postgres_error_printed=false`); **no** DSN/password/token/host/port/IP/URI
  printed (`dsn_password_host_port_ip_uri_printed=false`).
- **Result:** `gate_failed_raw_output_withheld`.
- **This means the Step 2D password rotation did NOT clear the psql gate.** It:
  - does **not** expose or prove the exact raw PostgreSQL error;
  - does **not** prove a specific exact root cause;
  - does **not** authorize another password rotation;
  - does **not** authorize Stage 0;
  - does **not** authorize a Step 2F or any next fix.

A correctly-committed rotation (PR #225, `rotation_committed`) followed by a still-
failing `auth_or_credential` gate means the persistent failure is **not** explained by
the runner password value alone. The next step must be a **new diagnostic/planning
branch to localize why `auth_or_credential` persists after password rotation** — its
own plan, Codex review, and a fresh GO; **no pre-judging** the cause.

---

## 4. What Did Not Happen

- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No password reset; no credential rotation; no custody value update.
- No GRANT / DML / DDL.
- No another diagnostic rerun beyond the one authorized.
- No Step 2F or next fix.
- No schema / deploy / runtime / downstream change beyond nothing (no change at all).
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- No DSN / password / token / host / port / IP / URI printed or recorded; no raw SQL
  output, raw psql output, or raw PostgreSQL error text; no SSH banner, login source,
  IP address, local IP, IPv6 address, or host/network detail recorded.

---

## 5. Verdict

- **GATE STILL FAILING — Step 2E is `gate_failed_raw_output_withheld`,
  `psql_gate_failure_class=auth_or_credential`**: the diagnostic was invoked, the
  classifier passed shape, the gate query did not pass; raw psql output and raw
  PostgreSQL error text withheld; no secret used or exposed, printed, or recorded; no
  Stage 0.
- This is **not** proof the rotation succeeded at clearing the gate (it did not),
  **not** an exposure/proof of the exact raw PostgreSQL error, **not** a specific
  root-cause proof, **not** authorization for another rotation / Step 2F / Stage 0,
  and **not** a Stage 0 execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run another diagnostic, rotate/reset any credential, update a custody
   value, run GRANT/DML/DDL, run Stage 0, touch the run-lock, or run any
   runtime/downstream/customer action off this evidence.
3. Prepare a **new diagnostic/planning branch to localize why `auth_or_credential`
   persists after password rotation** (a docs-only plan) — secret-safe, fail-closed,
   safe-label-only, raw output withheld — then **Codex review** and a **fresh explicit
   Helen GO** before any action. **Do not pre-judge** the cause.
4. **Stage 0 execution remains separately GO-gated** (only after a later clean
   post-fix psql gate diagnostic and a separate Stage 0 GO).

---

## 7. Safety / Raw-Data Boundary

This record contains no password value, DSN URI, connection string, `.env.production`
content, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or local),
IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw
behavioural row data, real `session_id` / `request_id` value, user-agent value, raw
SQL, raw psql output, raw PostgreSQL error text, or customer data. Step 2E used the
runner secret via **hidden input only**; **raw output was withheld**
(`raw_output_withheld=true`, `raw_psql_output_printed=false`,
`raw_postgres_error_printed=false`) and only the **allowlisted classifier labels** were
emitted — including the broad `psql_gate_failure_class=auth_or_credential` label, which
is a safe classification token, **not** the raw PostgreSQL error text. (Per the PR #218
Codex note: "no secret used or exposed" is to be read as "no secret value exposed,
printed, or recorded.") All values above are safe labels / booleans / public git commit
hashes / role / database names — not secret or row values.
