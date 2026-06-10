# Sprint 3 — Dedicated Stage 0 Role Create/Grant/Proof — Production-Host Evidence (BLOCKED: admin connection lacks CREATEROLE/superuser)

**Status:** `STAGE0_DEDICATED_ROLE_CREATE_GRANT_PROOF_PROD_BLOCKED`

This is a **docs-only evidence record**. Helen/operator ran the **actual
production-host preflight** for the merged PR #179 dedicated Stage 0 role command
pack. The preflight reached `buyerrecon_production` with a writable but
**non-admin** connection (`.env.production` `DATABASE_URL`), so the operator
**correctly stopped before `CREATE ROLE` / password / grants / proof**. **No
role was created, no grant ran, no proof connected, and no secret/raw output was
printed.**

This is a **real production-host blocked result** — **distinct from PR #180's
local blocked result** (which stopped because the local environment was not the
production host). This PR creates no role, applies no grant, runs no SQL/DDL/DML,
and runs no Stage 0. It records safe labels only — no secrets, password, DSN, or
raw data.

> Provenance: PR #179 dedicated login-role plan / command pack
> (`5af3da6575521446d95adf0b82ed8044efa30a6b`); PR #180 local blocked evidence
> (`4da2cbe72d4fdd3aa35abb82aa1117decddf5f87`,
> `STAGE0_DEDICATED_ROLE_CREATE_GRANT_PROOF_BLOCKED`).

---

## 1. Authorization

- Exact GO phrase: `HELEN STAGE0 DEDICATED ROLE CREATE-GRANT-PROOF GO`.
- Scope authorized: exactly **one** bounded production operator action — create
  `buyerrecon_stage0_runner` (safe attributes), apply the PR #179 direct-grant
  set, and prove it.
- The GO did **not** authorize Stage 0 execution.
- Helen/operator ran the preflight manually on the production host. Claude Code
  did not execute anything.

---

## 2. Safe Labels (from the production host)

```text
STAGE0_DEDICATED_ROLE_CREATE_GRANT_PROOF_PROD_BLOCKED
on_production_host=true
repo_head=4da2cbe72d4fdd3aa35abb82aa1117decddf5f87
pr179_merge_present=true
pr180_merge_present=true
command_pack_doc_present=true
dburl_loaded_without_printing=true
db_expected=true
admin_role_createrole=false
admin_role_superuser=false
session_readonly=false
admin_probe_ok=true
raw_output_printed=false
role_created=false
grants_applied=false
proof_connected=false
stage0_command_run=false
run_lock_touched=false
stop_line=admin_connection_lacks_createrole_or_superuser
```

---

## 3. Interpretation

- This is a **real production-host blocked result** (`on_production_host=true`),
  **not** the same as PR #180's local block.
- **Production host / path was correct**; **repo base was correct**
  (`repo_head=4da2cbe…`).
- **PR #179 and PR #180 merges were present** (`pr179_merge_present=true`,
  `pr180_merge_present=true`); the **command-pack doc was present**.
- The `.env.production` `DATABASE_URL` was **loaded without printing**
  (`dburl_loaded_without_printing=true`) and reached **`buyerrecon_production`**
  (`db_expected=true`).
- The connection role was **writable** (`session_readonly=false`) **but not
  admin**:
  - `admin_role_createrole=false`
  - `admin_role_superuser=false`
- Therefore the operator **correctly stopped before** `CREATE ROLE`, password
  setting, direct grants, and the dedicated-role proof. The admin probe itself
  succeeded read-only (`admin_probe_ok=true`) and **no raw output was printed**
  (`raw_output_printed=false`).

**Stop-line:** `admin_connection_lacks_createrole_or_superuser`.

This is **not** a dedicated-role proof pass, **not** a dedicated-role proof fail,
**not** a Stage 0 runtime/permission/code failure, and **not** a PR #179
command-pack failure. It is a **production admin-custody block**: the available
production connection cannot create roles or grant.

---

## 4. What Did Not Happen

- No `CREATE ROLE`.
- No password set / change.
- No DSN create / change.
- No grant applied (`grants_applied=false`).
- No role change.
- No DDL / DML beyond the safe read-only metadata / admin probe.
- No proof connection as the dedicated role (`proof_connected=false`).
- No Stage 0 command (`stage0_command_run=false`).
- No run-lock touch (`run_lock_touched=false`).
- No extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.
- No DSN / password / token / hostname / IP / raw IDs / raw row values / payload
  / customer data printed; raw `psql` output withheld (`raw_output_printed=false`).

---

## 5. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not retry with `.env.production`** — it is **not** an admin connection
   (`admin_role_createrole=false`, `admin_role_superuser=false`).
3. A **separate admin-custody resolution** is required before any
   create/grant/proof retry, one of:
   - **provide a secure production admin / `CREATEROLE` connection mechanism** on
     `/opt/buyerrecon-backend` (used only for the bounded create/grant action,
     secret-safe, never printed); **or**
   - **have the DBA / operator run the PR #179 direct-grant command pack using an
     approved admin connection** and return **safe labels only**.
4. After a successful create/grant/proof (positive Stage 0 privileges present +
   all negative-absence checks hold), record a **docs-only evidence PR**.
5. **Stage 0 execution remains separately GO-gated** even if a future
   dedicated-role proof passes.

---

## 6. Safety / Raw-Data Boundary

This record contains no password, DSN URI, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. The `DATABASE_URL` was
loaded without printing and reached `buyerrecon_production`; raw `psql` output
was withheld. All values above are **safe labels / booleans / a commit hash /
role-attribute and gate facts / a stop-line token** — not secret or row values.
`repo_head` is a public git commit hash, not a secret.
