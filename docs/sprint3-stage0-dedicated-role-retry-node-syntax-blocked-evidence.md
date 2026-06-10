# Sprint 3 — Dedicated Stage 0 Role Create/Grant/Proof Retry — Evidence (BLOCKED: Node command-generation error; no role created)

**Status:** `STAGE0_ADMIN_CUSTODY_OPTION_A_CREATE_GRANT_PROOF_RETRY_BLOCKED_NODE_SYNTAX`

This is a **docs-only evidence record**. The operator retried the bounded
admin-custody **Option A** create/grant/proof action for
`buyerrecon_stage0_runner`. Preflight (incl. matched hidden password) passed, but
the command hit a **Node SQL-generation error** (`SyntaxError: Unexpected end of
input`). Misleading success labels printed **after** the error are **untrusted /
superseded**; an **authoritative post-error catalog check proves the role does
not exist**. **No usable role was created, no grants were applied, no
dedicated-role proof passed.**

This is **not** a create/grant/proof PASS, **not** a Stage 0
runtime/permission/code failure, and **not** a DB admin-permission failure — it
is a **command-generation / shell-heredoc / Node-template failure before
successful SQL execution**. This PR creates no role, applies no grant, runs no
SQL/DDL/DML, and runs no Stage 0. It records safe labels only — no secrets,
password, DSN, or raw data.

> Provenance: PR #179 dedicated login-role plan/command pack
> (`5af3da6575521446d95adf0b82ed8044efa30a6b`); PR #182 admin-custody resolution
> plan (`e31a8fb9449151e5312ae1600f5fb59b96839ef6`); PR #183 password-mismatch
> evidence (`8d647c74232e86c79b1e8645af3d17de444f0e10`,
> `STAGE0_ADMIN_CUSTODY_OPTION_A_CREATE_GRANT_PROOF_PASSWORD_MISMATCH_BLOCKED`).

---

## 1. Authorization

- Admin-custody **Option A** retry, after PR #183 merge, for exactly **one**
  bounded create/grant/proof action for `buyerrecon_stage0_runner` using the
  merged PR #179 command pack.
- This did **not** authorize Stage 0 execution.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Preflight Labels (from the production host)

```text
STAGE0_ADMIN_CUSTODY_OPTION_A_CREATE_GRANT_PROOF_RETRY_START
on_production_host=true
repo_head=8d647c74232e86c79b1e8645af3d17de444f0e10
pr179_merge_present=true
pr182_merge_present=true
pr183_merge_present=true
command_pack_doc_present=true
password_received=true
password_confirmed=true
password_printed=false
```

Preflight passed, including the **matched** hidden password confirmation
(`password_confirmed=true`; `password_printed=false`).

---

## 3. Command-Generation Error

The command then hit a Node SQL-generation error:

```text
SyntaxError: Unexpected end of input
```

This occurred in the **Node SQL/command-generation path** (fragile shell-heredoc
/ Node template), **before** successful SQL execution.

---

## 4. Untrusted / Superseded Labels (DO NOT TRUST)

The following labels were printed **after the Node error path** and are
**UNTRUSTED / SUPERSEDED** — they are **not** supported by catalog state and must
**not** be relied upon:

```text
create_grant_proof_ok=true      # UNTRUSTED / SUPERSEDED — printed after Node error; not catalog-backed
role_created=true               # UNTRUSTED / SUPERSEDED — contradicted by §5 catalog check (role_exists|false)
grants_applied=true             # UNTRUSTED / SUPERSEDED — contradicted by §5 catalog check
```

These are a reporting artifact of the failure path emitting success labels after
an upstream command failure — a defect to fix (see §7). The **authoritative**
state is the post-error catalog check in §5.

---

## 5. Authoritative Post-Error Catalog Check

```text
post_error_catalog_check=true
db_expected|true
role_exists|false
role_can_login|false
role_is_superuser|false
role_createdb|false
role_createrole|false
role_replication|false
role_bypassrls|false
priv_accepted_events_select|false
priv_ingest_requests_select|false
priv_stage0_select|false
priv_stage0_insert|false
priv_stage0_update|false
not_member_scoring_worker|true
owns_no_tables|true
stage0_command_run=false
run_lock_touched=false
raw_output_printed=false
```

The catalog check ran against `buyerrecon_production` (`db_expected|true`) and
**proves `buyerrecon_stage0_runner` does not exist** (`role_exists|false`) —
therefore no login/privilege flags are set, **no Stage 0 privileges were
granted** (all `priv_*|false`), no membership, and no ownership. This is the
authoritative state that **supersedes** the §4 labels.

---

## 6. Verdict & Interpretation

- **Verdict: `BLOCKED — no role created`.**
- This is **not** a create/grant/proof PASS.
- This is **not** a Stage 0 runtime / permission / code failure.
- This is **not** a DB admin-permission failure.
- This **is** a **command-generation / shell-heredoc / Node-template failure
  before successful SQL execution**.
- The **post-error catalog check proves `buyerrecon_stage0_runner` does not
  exist** → no grants were applied and **no dedicated-role proof passed**.

---

## 7. What Did Not Happen

- No usable dedicated role was created (`role_exists|false`).
- No grants were applied (all `priv_*|false`).
- No positive Stage 0 privileges exist for `buyerrecon_stage0_runner`.
- No dedicated-role proof passed.
- No Stage 0 command ran (`stage0_command_run=false`).
- No run-lock touch (`run_lock_touched=false`).
- No extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.
- No password / DSN / token / hostname / IP / raw IDs / raw row values / payload
  / customer data printed (`password_printed=false`, `raw_output_printed=false`).

---

## 8. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. **Do not retry the same Node heredoc command as-is** — its
   command-generation path is fragile and also mis-reported success after
   failure.
3. Before any further create/grant/proof retry, create a **small docs-only patch
   / review artifact (operator-safe command correction)** that **removes the
   fragile Node template-generation path**, with a safer design:
   - use a **plain `sudo -u postgres psql` heredoc**;
   - supply the password via a **hidden / operator-safe mechanism** (e.g.
     `\set STAGE0_RUNNER_PW '…'` injected secret-safe) — reviewed before
     execution;
   - **failure paths must not print misleading success labels** after an upstream
     command failure;
   - emit `role_created=true` / `grants_applied=true` **only after** a catalog
     proof confirms the role exists and the required grants are present.
4. Then Helen may issue a **fresh explicit GO** for **one** bounded corrected
   create/grant/proof retry → docs-only evidence PR.
5. **Only if the dedicated-role proof passes** may Helen issue a **separate Stage
   0 execution GO**. Stage 0 execution remains separately GO-gated.

---

## 9. Safety / Raw-Data Boundary

This record contains no password, DSN URI, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. No password value was
read into this record (`password_printed=false`); raw `psql` output was withheld
(`raw_output_printed=false`). All values above are **safe labels / booleans / a
public git commit hash / a stop-line/error-shape token** — not secret or row
values. The `SyntaxError: Unexpected end of input` line is a generic Node
error-shape string, not data.
