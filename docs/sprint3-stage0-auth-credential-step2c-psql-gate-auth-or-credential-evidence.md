# Sprint 3 — Stage 0 auth/credential Step 2C — PR #198-style psql Gate Diagnostic Rerun — Evidence (auth_or_credential reproduced)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2C_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2C PSQL GATE DIAGNOSTIC RERUN GO`, the operator
ran **exactly one** PR #215 **Step 2C** PR #198-style safe-label-only psql gate
diagnostic on production. The classifier passed shape
(`psql_gate_classifier_pass=true`) but the gate query did **not** pass
(`psql_gate_query_pass=false`), classifying the failure again as broad
`psql_gate_failure_class=auth_or_credential` — with raw psql output and raw
PostgreSQL error text **withheld**.

**This reproduces the broad `auth_or_credential` class — it does NOT expose or
prove the exact raw PostgreSQL error, NOT prove a specific root cause, and is NOT a
Stage 0 execution.** This PR changes no roles/grants/credentials/custody values,
records safe **booleans/labels only** — no secrets, DSN, password, raw SQL/error
text, host/network details, or raw data.

> Provenance: PR #215 Step 2 password/custody verification plan
> (`ed4a46e44f992f5f443a2bd48df9cba0937393a6`); PR #216 Step 2A custody-pointer
> ready evidence (`e959071ec4faf686d41a58b2c621fb30bc07c7c7`,
> `STAGE0_AUTH_CREDENTIAL_STEP2A_CUSTODY_POINTER_READY`); PR #217 Step 2B
> operator-confirmation clean evidence
> (`1cae6cb21ced2d6409910f4000f805462492b104`,
> `STAGE0_AUTH_CREDENTIAL_STEP2B_OPERATOR_CONFIRMATION_CLEAN`); built on PR #201
> broad `auth_or_credential` (`f592c1313081956e4c4277dfd23bdb72afd74fa1`), PR #206
> role metadata clean (`b2a38af7588ceaeda87f41050c621dc4af80206d`), PR #213
> grant-boundary clean (`0e84bf14268eda4fd28d39e5516d8abf7e92fda6`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2C PSQL GATE DIAGNOSTIC RERUN GO` — exactly
  **one** PR #215 Step 2C PR #198-style safe-label-only psql gate diagnostic;
  approved custody connection only; raw output → withheld; allowlist labels only;
  **no** Stage 0.
- This did **not** authorize Step 2D/2E, a fix, raw-output inspection, password
  reset, credential rotation, custody value change, role change, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 2C diagnostic)

```text
stage0_auth_credential_step2c_attempted=true
diagnostic_scope=pr215_step2c_pr198_style_psql_gate_rerun
stage0_executed=false
run_lock_touched=false
env_production_mutated=false
grant_dml_ddl_run=false
credential_change_attempted=false
password_reset_attempted=false
raw_output_withheld=true
on_production_host=true
approved_custody_source_present=true
custody_components_present=true
runner_secret_present=true
psql_invoked=true
psql_gate_query_pass=false
raw_psql_output_printed=false
psql_gate_classifier_pass=true
psql_gate_failure_class=auth_or_credential
```

---

## 3. Interpretation (bounded)

- The **Step 2C PR #198-style psql gate diagnostic rerun was invoked**
  (`psql_invoked=true`) under the trusted scope label
  `diagnostic_scope=pr215_step2c_pr198_style_psql_gate_rerun`.
- **Raw psql output and raw PostgreSQL error text were withheld**
  (`raw_output_withheld=true`, `raw_psql_output_printed=false`).
- The **classifier passed shape** (`psql_gate_classifier_pass=true`) and the **gate
  query did not pass** (`psql_gate_query_pass=false`).
- The failure is classified again as broad
  **`psql_gate_failure_class=auth_or_credential`**.
- This **reproduces the broad `auth_or_credential` class** after the prior clean
  findings:
  - Step 1A role metadata clean (PR #206);
  - Step 1B full grant-boundary clean (PRs #209–#213);
  - Step 2A custody pointer ready (PR #216);
  - Step 2B operator confirmation clean (PR #217).
- It:
  - does **not** expose or prove the exact raw PostgreSQL error;
  - does **not** prove a specific root cause;
  - does **not** authorize a password reset or credential rotation;
  - does **not** authorize a Stage 0 retry.

**Bounded direction (not a proof):** with role usability, the checked grant
boundary, the custody pointer, and the secret-safe operator confirmation all
clean, **yet the gate still failing as `auth_or_credential`**, the remaining
investigation/remediation branch points to **Step 2D password reset / credential
rotation command-pack planning**. This is the **next branch to plan**, not a proven
cause; **Step 2D must be separately planned, Codex-reviewed, and GO-gated**, and
must never print/store any password.

---

## 4. What Did Not Happen

- No Step 2D; no Step 2E.
- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No password reset; no credential change; no custody value change.
- No role change.
- No GRANT / DML / DDL.
- No raw-output inspection; no raw psql output printed; no raw PostgreSQL error
  text printed.
- No schema / deploy / runtime / downstream change.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- No DSN / password / token / host / port / IP / URI printed or recorded; no hidden
  password, `.env.production` content, SSH banner, login source, IP addresses,
  local IPs, IPv6 addresses, or host/network details recorded.

---

## 5. Verdict

- **auth_or_credential REPRODUCED — Step 2C is
  `psql_gate_failure_class=auth_or_credential`**: the diagnostic was invoked, the
  classifier passed shape, the gate query did not pass; raw psql output and raw
  PostgreSQL error text withheld; no secret used or exposed; no Stage 0.
- This is **not** an exposure/proof of the exact raw PostgreSQL error, **not** a
  specific root-cause proof, **not** authorization for a password reset / credential
  rotation / Stage 0 retry, and **not** a Stage 0 execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run Step 2D/2E, reset a password, rotate a credential, change a
   custody value, inspect raw output, rerun psql, change a role, run GRANT/DML/DDL,
   run Stage 0, touch the run-lock, or run any runtime/downstream/customer action
   off this evidence.
3. **Step 2D** (password reset / credential rotation command-pack) — indicated as
   the next investigation/remediation branch given the reproduced
   `auth_or_credential` with role/grant/custody/operator-confirmation all clean —
   must be **separately planned** (its own docs-only command-pack), **Codex-reviewed**,
   and require a **fresh explicit Helen GO**, and must **never print or store** the
   password.
4. **Step 2E** (one post-fix PR #198-style diagnostic rerun) only if separately
   GO-gated → docs-only evidence PR.
5. **Stage 0 execution remains separately GO-gated** (only after a clean psql gate
   diagnostic).

---

## 7. Safety / Raw-Data Boundary

This record contains no hidden password, `.env.production` content, real DSN URI,
password, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source,
host/network detail, raw payload, `canonical_jsonb` payload, `accepted_events` row
data, raw behavioural row data, real `session_id` / `request_id` value, user-agent
value, raw SQL, raw psql output, raw PostgreSQL error text, or customer data. Step
2C used the **approved custody connection only**; **raw output was withheld**
(`raw_output_withheld=true`, `raw_psql_output_printed=false`) and only the
**allowlisted classifier labels** were emitted — including the broad
`psql_gate_failure_class=auth_or_credential` label, which is a safe classification
token, **not** the raw PostgreSQL error text. All values above are safe labels /
booleans / public git commit hashes / role / database names — not secret or row
values.
