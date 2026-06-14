# Sprint 3 — Stage 0 auth/credential Step 2D — Local-Postgres-Path Password Rotation Command-Pack Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2D_LOCAL_POSTGRES_PATH_ROTATION_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **revised, secret-safe,
fail-closed** Step 2D password rotation command-pack for `buyerrecon_stage0_runner`
that uses the **confirmed local postgres admin authority path** (PR #223) — **not an
external admin DSN** (whose custody source remained unidentified in PR #222).

This PR **executes nothing** and **authorizes no production command**: no `psql`, no
SQL, no `ALTER ROLE`, no password read/use/reset/rotation, no custody value update, no
Step 2E, no Stage 0, no run-lock touch, no `.env.production` mutation, no
runtime/deploy/downstream/customer action. No real DSN, password, host, port, IP,
token, or URI appears in this document.

> Provenance: PR #218 Step 2C `auth_or_credential` reproduced
> (`92d568a6b7491500db4de1732c3b9015a0ddc14e`); PR #219 original Step 2D command-pack
> plan — assumed an approved admin/rotation DSN
> (`8ea9ece4438b45356b6a00e4039a751a534522e4`); PR #220 Step 2D execution blocked —
> admin DSN unknown (`66fcdbd4a657b40df1b59a270eef4efb60c878a1`); PR #221 admin/rotation
> connection custody plan (`30ab9c96af6a50c8ff0c5404a6fc01c226b493ed`); PR #222
> admin/rotation connection custody — blocked, source not identified
> (`ef3cb8522f3246afe02963b51acf5612f109aa1a`); PR #223 local postgres admin authority
> ready (`23879d070f9923851c96117822f5c175a4eb0bbb`,
> `STAGE0_AUTH_CREDENTIAL_STEP2D_LOCAL_POSTGRES_ADMIN_AUTHORITY_READY`).

---

## 1. Planning-Only / Non-Authorization

- **This PR is docs-only.** Merging it **authorizes no production command**.
- It does **not** run psql/SQL.
- It does **not** `ALTER ROLE`.
- It does **not** reset or rotate any password.
- It does **not** update any custody value.
- It does **not** run Step 2E.
- It does **not** run Stage 0.
- The operator performs any future execution manually, under a separate fresh GO.
  Claude Code executes nothing.

---

## 2. Authority Model

- The **external/admin DSN path remains blocked** by PR #222
  (`blocked_source_not_identified`).
- **Local postgres admin authority is ready** via PR #223
  (`authority_ready`).
- The revised execution model uses **production host root/admin shell →
  `sudo -u postgres` → local `psql`** (local server-side admin/superuser-or-createrole
  authority).
- **No external admin DSN is required** for this path.
- **No DSN / password / host / port / IP / URI is printed or recorded** at any point.

---

## 3. Proposed Execution Shape — CANDIDATE ONLY — DO NOT RUN

> The following is a **design sketch for review**, not a runnable command and not
> authorization to run anything. Every step is **fail-closed** and **secret-safe**;
> the new password is **only ever** handled via hidden input and is **never** printed,
> logged, pasted, committed, recorded, or assembled into any printed string.

1. **Sync** the production checkout to the expected base/head containing **PR #223**.
2. **Confirm the production host and repo path** (abort on mismatch).
3. **Confirm the PR #223 doc is present** on the checked-out tree (authority-evidence
   gate).
4. **Confirm the postgres system user exists.**
5. **Confirm the `sudo -u postgres` path is available.**
6. **Confirm the `psql` binary is available.**
7. **Receive the new `buyerrecon_stage0_runner` password via hidden input only**
   (`read -r -s`-style; no echo; no argv; no env-var leak into logs).
8. **Require a double hidden password confirmation** (second hidden read; compared
   in-memory only).
9. **Fail closed on mismatch or empty input** (non-zero exit; no value emitted;
   nothing recorded).
10. **Use local `sudo -u postgres psql`** to execute **only**:
    `ALTER ROLE buyerrecon_stage0_runner WITH PASSWORD <hidden password>;`
    — with the secret passed **in-memory only** (never on a printed command line, never
    in argv, never in logs).
11. Use a **transaction or fail-closed execution shape** where appropriate (so a
    partial/failed apply does not leave an ambiguous state).
12. **Raw psql output is withheld** to a `chmod 600` temp file and then **removed** —
    never printed.
13. **Emit allowlisted safe labels only** (§4).
14. **No Step 2E diagnostic** in the same command.
15. **No Stage 0** in the same command.
16. **No run-lock touch.**
17. **No `.env.production` mutation.**

---

## 4. Candidate Safe Labels (for future Step 2D execution evidence)

> Allowlist only. Booleans/tokens — **never** a password, DSN, host, port, IP, URI, or
> raw value. The password value itself is **never** among these labels.

```text
step2d_local_postgres_rotation_attempted=true
diagnostic_scope=pr223_step2d_local_postgres_path_rotation_command_pack
production_host_confirmed=true/false
expected_branch_head_confirmed=true/false
pr223_authority_evidence_present=true/false
postgres_system_user_present=true/false
sudo_postgres_available=true/false
psql_binary_available=true/false
hidden_password_received=true/false
hidden_password_confirmed=true/false
password_value_printed=false
password_value_stored_in_repo=false
password_value_recorded_in_evidence=false
raw_sql_output_printed=false
raw_postgres_error_printed=false
dsn_password_host_port_ip_uri_printed=false
alter_role_attempted=true/false
alter_role_committed=true/false
custody_value_updated=false
step2e_diagnostic_run=false
stage0_executed=false
run_lock_touched=false
step2d_local_postgres_rotation_result=<allowlisted result>
```

---

## 5. Allowlisted Result Values

```text
rotation_committed
blocked_required_pr223_missing
blocked_wrong_host_or_repo
blocked_postgres_admin_path_unavailable
blocked_hidden_password_missing
blocked_hidden_password_mismatch
rotation_failed_raw_output_withheld
```

---

## 6. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- **wrong host or wrong repo path**;
- **PR #223 evidence missing** from the checkout;
- **postgres system user missing**;
- **`sudo -u postgres` unavailable**;
- **`psql` binary missing**;
- **hidden password missing**;
- **hidden password confirmation mismatch**;
- any **password value** would be printed / stored / recorded;
- any **DSN / token / host / port / IP / URI** would be printed;
- **raw SQL output or raw PostgreSQL error text** would be printed;
- the command would **mutate anything except the scoped `buyerrecon_stage0_runner`
  password**;
- the command would **run Step 2E**;
- the command would **run Stage 0**;
- the command would **touch the run-lock**;
- the command would **mutate `.env.production`**;
- the command would **run runtime / downstream / Lane A·B / scoring / AMS / customer
  output / Gate 4E / Gate 4F** actions.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 7. Safety Boundaries (this planning PR)

- **No production command** run by this PR.
- **No psql / SQL** executed by this PR.
- No `ALTER ROLE`.
- No password read / use / reset / rotation.
- No custody value update.
- No Step 2E.
- No Stage 0.
- No run-lock.
- No `.env.production` mutation.
- No runtime / deploy / downstream / customer action.

---

## 8. Evidence Requirements (for any future Step 2D execution)

Every future Step 2D local-postgres-path execution (separately GO-gated) must:
- be recorded in a **docs-only evidence PR**;
- emit **safe labels only** (the §4 allowlist; never a password/DSN/raw value);
- **withhold raw output** (raw psql output → `chmod 600` temp; never printed; removed);
- contain **no password / DSN / host / port / IP / URI / raw SQL / raw PostgreSQL
  error text**;
- trigger **no Step 2E until** the Step 2D evidence is reviewed/merged **and** a fresh
  GO is issued;
- trigger **no Stage 0 until** a later **clean** Step 2E **and** a separate Stage 0 GO.

---

## 9. Explicit Next-Step Gating

- **Merging this PR does not authorize the rotation.**
- **Step 2D local-postgres-path rotation execution requires Codex review and a fresh
  explicit Helen GO.**
- **Step 2E remains separately GO-gated.**
- **Stage 0 remains separately GO-gated.**

---

## 10. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Helen issues a separate explicit GO** for **one** revised Step 2D
   local-postgres-path rotation (secret-safe, fail-closed, hidden input only with
   double confirmation, password never printed/stored, raw output withheld, allowlist
   labels only).
3. Docs-only **Step 2D execution evidence PR** (safe labels only; no password/raw
   value).
4. **Step 2E** (one post-fix PR #198-style diagnostic rerun) only after a successful,
   reviewed/merged Step 2D rotation and a fresh GO → docs-only evidence PR.
5. **Stage 0 execution remains separately GO-gated** (only after a later clean Step 2E
   post-fix psql gate diagnostic and a separate Stage 0 GO).

---

## 11. Safety / Raw-Data Boundary

This record contains no DSN URI, admin/rotation connection string, raw password,
hidden password, `.env.production` content, bearer token, AWS/OpenAI-style token, raw
UUID, IP address (public or local), IPv6 address, hostname, port value, URI, SSH
banner, login source, terminal input / prompt value, host/network detail, raw payload,
`canonical_jsonb` payload, `accepted_events` row data, raw behavioural row data, real
`session_id` / `request_id` value, user-agent value, raw SQL, raw psql output, raw
PostgreSQL error text, or customer data. The candidate command-pack handles the new
password via **hidden input only**, **never** prints/logs/pastes/commits/records it,
uses the **local server-side admin authority path** (root/admin shell →
`sudo -u postgres` → local `psql`) rather than any external admin DSN, and emits **safe
allowlist labels only**. (Per the PR #218 Codex note: "no secret used or exposed" is to
be read as "no secret value exposed, printed, or recorded.") All values above are safe
labels / booleans / public git commit hashes / role / database / OS-account names — not
secret or row values.
