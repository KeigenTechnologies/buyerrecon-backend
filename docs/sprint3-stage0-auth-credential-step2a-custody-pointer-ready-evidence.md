# Sprint 3 — Stage 0 auth/credential Step 2A — Custody-Pointer Inventory — Evidence (READY)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2A_CUSTODY_POINTER_READY`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2A CUSTODY-POINTER INVENTORY GO`, the operator
ran the PR #215 **Step 2A** custody-pointer inventory on production. The output
**matched the Step 2A safe allowlist shape**: the approved custody pointer is
**present**, **authoritative**, and its **identity/scope matches**
`buyerrecon_stage0_runner` — with the **secret value neither read nor printed** →
`step2a_custody_pointer_result=custody_pointer_ready`.

**This is a custody-pointer metadata finding only — it does NOT read/print the
secret, NOT prove the actual password value is correct, NOT prove password/custody
as the exact root cause, and NOT a Stage 0 execution.** This PR changes no
roles/grants/custody values, runs no SQL, and records safe **booleans/labels
only** — no secrets, DSN, password, raw SQL/error text, host/network details, or
raw data.

> Provenance: PR #215 Step 2 password/custody verification plan
> (`ed4a46e44f992f5f443a2bd48df9cba0937393a6`,
> `STAGE0_AUTH_CREDENTIAL_STEP2_PASSWORD_CUSTODY_VERIFICATION_PLANNING_ONLY`); built
> on PR #201 broad `auth_or_credential` (`f592c1313081956e4c4277dfd23bdb72afd74fa1`),
> PR #206 role metadata clean (`b2a38af7588ceaeda87f41050c621dc4af80206d`), PR #213
> grant-boundary clean (`0e84bf14268eda4fd28d39e5516d8abf7e92fda6`), PR #214 Step 1C
> decision plan (`37fd02b80f5fbefa2edf546eea3ab2c438f51a00`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2A CUSTODY-POINTER INVENTORY GO` — exactly
  **one** PR #215 Step 2A custody-pointer inventory; pointer/identity/scope only;
  **no** secret value read/print/copy/store; **no** runner password use; **no**
  login as `buyerrecon_stage0_runner`; raw output withheld; allowlist labels only.
- This did **not** authorize Step 2B/2C/2D/2E, a fix, password/custody secret read,
  password reset, credential change, role change, or Stage 0.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 2A inventory)

```text
step2a_custody_pointer_inventory_attempted=true
diagnostic_scope=pr215_step2a_custody_pointer_inventory
on_expected_repo_path=true
stage0_executed=false
run_lock_touched=false
env_production_mutated=false
psql_sql_invoked=false
psql_login_as_stage0_runner=false
grant_dml_ddl_run=false
password_reset_attempted=false
credential_change_attempted=false
custody_value_changed=false
custody_pointer_present=true
custody_pointer_authoritative=true
custody_pointer_scope_matches_stage0_runner=true
custody_pointer_secret_value_read=false
custody_pointer_secret_value_printed=false
step2a_custody_pointer_result=custody_pointer_ready
```

---

## 3. Interpretation (bounded)

- The **Step 2A custody-pointer inventory ran** under the trusted scope label
  `diagnostic_scope=pr215_step2a_custody_pointer_inventory`, and the output
  **matched the Step 2A safe allowlist shape**.
- **Custody-pointer findings for `buyerrecon_stage0_runner`:**
  - the approved custody pointer is **present** (`custody_pointer_present=true`);
  - the custody pointer is **authoritative** for the production Stage 0 runner
    credential (`custody_pointer_authoritative=true`);
  - the custody pointer **identity/scope matches** `buyerrecon_stage0_runner` for
    the Stage 0 production path
    (`custody_pointer_scope_matches_stage0_runner=true`).
- **The secret value was neither read nor printed**
  (`custody_pointer_secret_value_read=false`,
  `custody_pointer_secret_value_printed=false`); **no** password value was copied,
  stored, reset, rotated, or changed (`custody_value_changed=false`,
  `password_reset_attempted=false`, `credential_change_attempted=false`).
- **No psql/SQL** was invoked (`psql_sql_invoked=false`); **no** psql login as the
  runner (`psql_login_as_stage0_runner=false`); **no** Stage 0
  (`stage0_executed=false`).
- **Step 2A result:** `custody_pointer_ready`.
- This is a **custody-pointer metadata finding only.** It:
  - does **not** prove the actual password **value** is correct;
  - does **not** prove password/custody as the exact root cause;
  - does **not** complete Step 2B/2C and is **not** a credential fix.

This confirms — **for the custody-pointer metadata only** — that an authoritative,
correctly-scoped custody pointer exists for the runner; it does **not** by itself
explain or resolve the PR #201 `auth_or_credential` blocker, and no broader
inference is drawn here.

---

## 4. What Did Not Happen

- No Step 2B; no Step 2C; no Step 2D; no Step 2E.
- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No `.env.production` mutation.
- No password read; no password print; no password copy; no password store.
- No password reset; no credential change; no custody value change.
- No psql / SQL.
- No psql login as `buyerrecon_stage0_runner`.
- No role change.
- No GRANT / DML / DDL.
- No schema / deploy / runtime / downstream change.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- No DSN / password / token / host / port / IP / URI / raw PostgreSQL error text
  printed or recorded; no SSH banner, IP addresses, local IPs, IPv6 addresses,
  login source, prompts, operator y/n input lines, or host/network details
  recorded.

---

## 5. Verdict

- **READY — Step 2A custody pointer is `custody_pointer_ready`**: the approved
  custody pointer is present, authoritative, and scope-matched to
  `buyerrecon_stage0_runner`; the secret value was neither read nor printed;
  allowlist shape matched; raw output withheld; no secret used or exposed.
- This is **not** proof that the actual password value is correct, **not** a
  password/custody root-cause proof, **not** a Step 2B/2C/2D/2E result, and **not**
  a Stage 0 execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run Step 2B/2C/2D/2E, read/print/store a password, reset a password,
   change a credential, change a custody value, run psql/SQL, log in as the runner,
   change a role, run GRANT/DML/DDL, run Stage 0, touch the run-lock, or run any
   runtime/downstream/customer action off this evidence.
3. **Step 2B** (secret-safe operator confirmation — whether the PR #198 diagnostic
   password came from the approved authoritative custody source; yes/no-style labels
   only; **no** password value recorded) requires its **own fresh explicit Helen GO**
   and its own docs-only evidence PR.
4. **Step 2C** (one PR #198-style safe-label-only psql gate diagnostic rerun) only
   if Step 2A/2B support it and only under a fresh GO — its own evidence PR.
5. **Step 2D** (password reset / credential rotation) only if a custody mismatch is
   indicated — separately planned, Codex-reviewed, fresh GO, never print/store the
   password. **Step 2E** post-fix diagnostic rerun only if separately GO-gated.
6. **Stage 0 execution remains separately GO-gated** (only after a clean psql gate
   diagnostic).

---

## 7. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value,
SSH banner, login source, operator prompt or y/n input line, host/network detail,
raw payload, `canonical_jsonb` payload, `accepted_events` row data, raw behavioural
row data, real `session_id` / `request_id` value, user-agent value, raw SQL or raw
PostgreSQL error text, or customer data. Step 2A inspected **custody-pointer
metadata only** (pointer presence / authority / scope) using the **approved custody
source pointers** — the **secret value was neither read nor printed**
(`custody_pointer_secret_value_read=false`,
`custody_pointer_secret_value_printed=false`), and no `buyerrecon_stage0_runner`
login/password was used; raw output was withheld; only the **allowlisted
custody-pointer labels** were emitted. All values above are safe labels / booleans /
public git commit hashes / role / database names — not secret or row values.
