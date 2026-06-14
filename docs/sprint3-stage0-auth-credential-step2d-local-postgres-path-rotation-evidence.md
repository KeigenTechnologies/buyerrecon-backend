# Sprint 3 — Stage 0 auth/credential Step 2D — Local-Postgres-Path Password Rotation — Evidence (COMMITTED)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2D_LOCAL_POSTGRES_PATH_ROTATION_COMMITTED`

This is a **docs-only evidence record**. Under the GO
`HELEN STAGE0 AUTH CREDENTIAL STEP 2D LOCAL POSTGRES PATH ROTATION GO`, the operator
executed **exactly one** revised Step 2D local-postgres-path password rotation for
`buyerrecon_stage0_runner`, using the PR #223/PR #224 model — production host
root/admin shell → `sudo -u postgres` → local `psql` — **not** an external admin DSN.
The scoped `ALTER ROLE` was **attempted and committed** with the new password handled
via **hidden input only** (double-confirmed), and **no secret/raw value printed,
stored, or recorded** → `step2d_local_postgres_rotation_result=rotation_committed`.

**This is a rotation-committed finding only — it records no password/raw value, used
no external admin DSN, updated no custody value, ran no Step 2E or Stage 0, and does
NOT by itself prove the Stage 0 psql gate is clean.** This PR records safe
**booleans/labels only** — no secrets, password, DSN, connection string, token, host,
port, IP, URI, raw SQL/error text, host/network details, or raw data.

> Provenance: PR #223 local postgres admin authority ready
> (`23879d070f9923851c96117822f5c175a4eb0bbb`,
> `STAGE0_AUTH_CREDENTIAL_STEP2D_LOCAL_POSTGRES_ADMIN_AUTHORITY_READY`); PR #224
> revised Step 2D local-postgres-path rotation command-pack plan
> (`4108e1d0c9b9765911d43dcce52ea364cf5644b9`,
> `STAGE0_AUTH_CREDENTIAL_STEP2D_LOCAL_POSTGRES_PATH_ROTATION_COMMAND_PACK_PLANNING_ONLY`);
> built on PR #222 external/admin DSN source not identified
> (`ef3cb8522f3246afe02963b51acf5612f109aa1a`) and PR #218 Step 2C
> `auth_or_credential` reproduced (`92d568a6b7491500db4de1732c3b9015a0ddc14e`).

---

## 1. Authorization

- GO: `HELEN STAGE0 AUTH CREDENTIAL STEP 2D LOCAL POSTGRES PATH ROTATION GO` — exactly
  **one** revised Step 2D local-postgres-path rotation per the PR #224 command-pack;
  local `sudo -u postgres` → `psql` authority only (no external admin DSN); hidden
  input only; allowlist labels only; raw output withheld; password never
  printed/stored; **no** Step 2E; **no** Stage 0.
- This did **not** authorize a custody value update, a Step 2E diagnostic, a Stage 0
  retry, a run-lock touch, or any runtime/downstream/customer action.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the actual Step 2D execution)

```text
step2d_local_postgres_rotation_attempted=true
diagnostic_scope=pr223_step2d_local_postgres_path_rotation_command_pack
password_value_printed=false
password_value_stored_in_repo=false
password_value_recorded_in_evidence=false
raw_sql_output_printed=false
raw_postgres_error_printed=false
dsn_password_host_port_ip_uri_printed=false
custody_value_updated=false
step2e_diagnostic_run=false
stage0_executed=false
run_lock_touched=false
production_host_confirmed=true
expected_branch_head_confirmed=true
pr223_authority_evidence_present=true
postgres_system_user_present=true
sudo_postgres_available=true
psql_binary_available=true
hidden_password_received=true
hidden_password_confirmed=true
alter_role_attempted=true
alter_role_committed=true
step2d_local_postgres_rotation_result=rotation_committed
```

---

## 3. Interpretation (bounded)

- The **Step 2D local-postgres-path rotation was executed exactly once** under the
  explicit GO (`step2d_local_postgres_rotation_attempted=true`), scope label
  `diagnostic_scope=pr223_step2d_local_postgres_path_rotation_command_pack`.
- **All preflight gates were confirmed:** production host
  (`production_host_confirmed=true`), expected branch/head
  (`expected_branch_head_confirmed=true`), PR #223 authority evidence present
  (`pr223_authority_evidence_present=true`), postgres system user present
  (`postgres_system_user_present=true`), `sudo -u postgres` available
  (`sudo_postgres_available=true`), and the `psql` binary available
  (`psql_binary_available=true`).
- The **new `buyerrecon_stage0_runner` password was received via hidden input only**
  (`hidden_password_received=true`) and **confirmed by double-entry**
  (`hidden_password_confirmed=true`).
- The **password value was not printed, stored in repo, or recorded in evidence**
  (`password_value_printed=false`, `password_value_stored_in_repo=false`,
  `password_value_recorded_in_evidence=false`); **no** DSN/password/token/host/port/
  IP/URI printed (`dsn_password_host_port_ip_uri_printed=false`).
- **Raw SQL output and raw PostgreSQL error text were withheld**
  (`raw_sql_output_printed=false`, `raw_postgres_error_printed=false`).
- The **scoped `ALTER ROLE` was attempted and committed**
  (`alter_role_attempted=true`, `alter_role_committed=true`).
- **Result:** `rotation_committed`.
- **No external admin DSN was used** (the local `sudo -u postgres` → `psql` authority
  path was used instead); **no custody value was updated**
  (`custody_value_updated=false`); **no** `.env.production` mutation occurred; **no**
  Step 2E diagnostic (`step2e_diagnostic_run=false`); **no** Stage 0
  (`stage0_executed=false`); **no** run-lock touch (`run_lock_touched=false`); **no**
  runtime/downstream/Lane/scoring/AMS/customer/Gate 4E/Gate 4F action.
- This is a **rotation-committed finding only.** It:
  - records **no password / raw value**;
  - does **not by itself prove the Stage 0 psql gate is clean** (that is Step 2E);
  - is **not** a Step 2E diagnostic, **not** a custody value update, and **not** a
    Stage 0 execution.

The rotation changed the scoped `buyerrecon_stage0_runner` password via the confirmed
local admin authority path; whether this resolves the PR #218 `auth_or_credential`
blocker is **unproven** until a post-fix Step 2E diagnostic is run under a separate GO.

---

## 4. What Did Not Happen

- No external admin DSN used; no DSN / connection string / password / token / host /
  port / IP / URI printed or recorded.
- No password value printed, stored in repo, or recorded in evidence.
- No raw SQL output; no raw psql output; no raw PostgreSQL error text.
- No custody value update.
- No `.env.production` mutation.
- No Step 2E diagnostic.
- No Stage 0; no `npm run stage0:run`.
- No run-lock touch.
- No mutation beyond the scoped `buyerrecon_stage0_runner` password rotation.
- No role / grant / schema / deploy / runtime / downstream change.
- No Lane A/B preview or writer; no scoring runtime; no AMS Trust/Pass runtime;
  no customer output.
- No Gate 4E; no Gate 4F.
- No SSH banner, login source, terminal prompt value, IP address, local IP, IPv6
  address, or host/network detail recorded.

---

## 5. Verdict

- **COMMITTED — Step 2D local-postgres-path rotation is `rotation_committed`**: the
  scoped `ALTER ROLE buyerrecon_stage0_runner` password rotation was attempted and
  committed via the confirmed local `sudo -u postgres` → `psql` authority path; the
  new password was hidden-input-only and double-confirmed; no password/raw value
  printed, stored, or recorded; raw output withheld; no external admin DSN used; no
  secret used or exposed, printed, or recorded.
- This is **not** proof the Stage 0 psql gate is clean, **not** a Step 2E diagnostic,
  **not** a custody value update, and **not** a Stage 0 execution.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not** run Step 2E, run Stage 0, touch the run-lock, run psql/SQL, ALTER ROLE,
   reset/rotate a password again, update a custody value, or run any
   runtime/downstream/customer action off this evidence.
3. **Step 2E** (exactly one post-fix PR #198-style psql gate diagnostic rerun) — to
   check whether the rotation resolved the `auth_or_credential` blocker — only **after
   this Step 2D evidence PR is Codex-reviewed and merged** and only **under a fresh
   explicit Helen GO** (safe-label-only, raw output withheld, no Stage 0) → docs-only
   evidence PR.
4. **Stage 0 execution remains separately GO-gated** (only after a later clean Step 2E
   post-fix psql gate diagnostic and a separate Stage 0 GO).

---

## 7. Safety / Raw-Data Boundary

This record contains no password value, generated password, hidden password, DSN URI,
admin/rotation connection string, `.env.production` content, bearer token,
AWS/OpenAI-style token, raw UUID, IP address (public or local), IPv6 address,
hostname, port value, URI, SSH banner, login source, terminal input / prompt value,
host/network detail, raw payload, `canonical_jsonb` payload, `accepted_events` row
data, raw behavioural row data, real `session_id` / `request_id` value, user-agent
value, raw SQL, raw psql output, raw PostgreSQL error text, or customer data. The
rotation handled the new password via **hidden input only** (double-confirmed),
**never** printed/stored/recorded it, used the **local server-side admin authority
path** (root/admin shell → `sudo -u postgres` → local `psql`) rather than any external
admin DSN, withheld raw output, and emitted **safe allowlist labels only**. (Per the
PR #218 Codex note: "no secret used or exposed" is to be read as "no secret value
exposed, printed, or recorded.") All values above are safe labels / booleans / public
git commit hashes / role / database / OS-account names — not secret or row values.
