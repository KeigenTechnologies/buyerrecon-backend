# Sprint 3 — Dedicated Stage 0 Role Create/Grant/Proof — Evidence (BLOCKED: hidden password confirmation mismatch)

**Status:** `STAGE0_ADMIN_CUSTODY_OPTION_A_CREATE_GRANT_PROOF_PASSWORD_MISMATCH_BLOCKED`

This is a **docs-only evidence record**. Under admin-custody **Option A** (secure
admin connection on the production host), the operator began the bounded
create/grant/proof action for `buyerrecon_stage0_runner` but it **stopped at the
hidden password-confirmation step** — the two hidden password entries did **not
match**, so the **fail-closed password-confirmation stop-line triggered before
any DB change**. **No role was created, no password was set, no grant ran, no
proof connected.**

This is **not** a DB/admin-permission failure, **not** a PR #179 or PR #182
command-pack failure, and **not** a Stage 0 runtime/permission/code failure. This
PR creates no role, sets no password, applies no grant, runs no SQL/DDL/DML, and
runs no Stage 0. It records safe labels only — no secrets, password, DSN, or raw
data.

> Provenance: PR #179 dedicated login-role plan/command pack
> (`5af3da6575521446d95adf0b82ed8044efa30a6b`); PR #182 admin-custody resolution
> plan (`e31a8fb9449151e5312ae1600f5fb59b96839ef6`,
> `STAGE0_ADMIN_CUSTODY_RESOLUTION_PLANNING_ONLY`).

---

## 1. Authorization

- Admin-custody **Option A** (secure admin/`CREATEROLE` connection on the
  production host) was selected for this bounded action.
- Scope: exactly **one** bounded create/grant/proof action for
  `buyerrecon_stage0_runner`, using the merged PR #179 command pack.
- This did **not** authorize Stage 0 execution.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the production host)

```text
STAGE0_ADMIN_CUSTODY_OPTION_A_CREATE_GRANT_PROOF_START
on_production_host=true
repo_head=e31a8fb9449151e5312ae1600f5fb59b96839ef6
pr179_merge_present=true
pr182_merge_present=true
command_pack_doc_present=true
password_received=true
password_confirmed=false
stop_line=stage0_runner_password_mismatch
```

---

## 3. Interpretation

- The action **started** on the production host (`on_production_host=true`) with
  the correct repo head (`repo_head=e31a8fb…`); PR #179 and PR #182 merges
  present; command-pack doc present.
- The hidden password was **received** (`password_received=true`) but the
  **confirmation entry did not match** (`password_confirmed=false`) — the
  operator typed two different hidden password values.
- The **fail-closed password-confirmation stop-line** triggered:
  `stop_line=stage0_runner_password_mismatch`.
- It stopped **before** `CREATE ROLE`, grants, proof SQL, and Stage 0 — no DB
  change occurred.

**This is:**
- **not** a DB / admin-permission failure;
- **not** a PR #179 or PR #182 command-pack failure;
- **not** a Stage 0 runtime / permission / code failure.

It is an **operator input mismatch** in the hidden password-confirmation step,
caught by the fail-closed design before any privileged DB action.

---

## 4. What Did Not Happen

- No `CREATE ROLE`.
- No password was set.
- No role was created.
- No grants were applied.
- No proof SQL ran.
- No dedicated-role proof connected.
- No Stage 0 command ran.
- No run-lock touch.
- No DML / DDL.
- No extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.
- No password / DSN / token / hostname / IP / raw IDs / raw row values / payload
  / customer data printed.

> Note: any later local-shell `fatal: not a git repository` lines occurred after
> SSH logout from the production host and are **out of scope** for this
> production action — they reflect the local shell, not the bounded operator
> action.

---

## 5. Verdict

- **BLOCKED — stopped before any DB change.** The dedicated role
  `buyerrecon_stage0_runner` was **not** created, granted, or proven; no password
  was set.
- The fail-closed password-confirmation posture held: a mismatched hidden
  password entry stopped the flow **before** `CREATE ROLE`/grants/proof, with no
  secret printed.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. Helen may then issue a **fresh explicit GO** to retry **exactly one** bounded
   Option A create/grant/proof action, **entering the same password twice
   carefully** in the hidden prompts (secret-safe; never printed).
3. The operator runs only that bounded action on production and returns **safe
   labels only** for a **docs-only evidence PR**.
4. **Only if the dedicated-role proof passes** (positive Stage 0 privileges
   present + all negative-absence checks hold) may Helen issue a **separate Stage
   0 execution GO**. Stage 0 execution remains separately GO-gated.

---

## 7. Safety / Raw-Data Boundary

This record contains no password, DSN URI, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. No password value was
read into this record — only the boolean facts `password_received=true` /
`password_confirmed=false`. All values above are **safe labels / booleans / a
public git commit hash / a stop-line token** — not secret or row values.
