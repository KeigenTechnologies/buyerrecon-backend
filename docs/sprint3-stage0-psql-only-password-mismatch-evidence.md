# Sprint 3 — Corrected psql-only Option A Create/Grant/Proof — Evidence (BLOCKED: hidden password confirmation mismatch)

**Status:** `STAGE0_ADMIN_CUSTODY_OPTION_A_PSQL_ONLY_CREATE_GRANT_PROOF_PASSWORD_MISMATCH_BLOCKED`

This is a **docs-only evidence record**. The operator ran the **corrected
psql-only** command pack (PR #185) for the bounded admin-custody **Option A**
create/grant/proof action for `buyerrecon_stage0_runner`. Preflight gates passed,
but the action **stopped at the hidden password-confirmation step** — the two
hidden entries did **not** match, so the **fail-closed password-confirmation gate
triggered before any DB change**. **No role was created, no password was set, no
grant ran, no proof connected.**

This is **not** a psql-only command-pack failure, **not** a DB/admin-permission
failure, and **not** a Stage 0 runtime/permission/code failure. This PR creates
no role, sets no password, applies no grant, runs no SQL/DDL/DML, and runs no
Stage 0. It records safe labels only — no secrets, password, DSN, or raw data.

> Provenance: PR #185 psql-only operator-safe command pack
> (`77b520ae3a30f71880d101004504dea01e1239a4`,
> `STAGE0_DEDICATED_ROLE_PSQL_ONLY_COMMAND_PACK_PLANNING_ONLY`).

---

## 1. Authorization

- Admin-custody **Option A** retry using the **corrected psql-only** command pack
  (PR #185), for exactly **one** bounded create/grant/proof action for
  `buyerrecon_stage0_runner`.
- This did **not** authorize Stage 0 execution.
- The operator ran the action manually on the production host. Claude Code did
  not execute anything.

---

## 2. Safe Labels (from the production host)

```text
STAGE0_ADMIN_CUSTODY_OPTION_A_PSQL_ONLY_CREATE_GRANT_PROOF_START
on_production_host=true
repo_head=77b520ae3a30f71880d101004504dea01e1239a4
pr179_merge_present=true
pr182_merge_present=true
pr183_merge_present=true
pr184_merge_present=true
pr185_merge_present=true
psql_only_command_pack_present=true
password_received=true
password_confirmed=false
stop_line=stage0_runner_password_mismatch
```

---

## 3. Interpretation

- This was the **corrected psql-only command-pack path** from PR #185.
- All preflight gates passed: production host (`on_production_host=true`), correct
  repo head (`repo_head=77b520a…`), **all four prerequisite merges present**
  (PR #179/#182/#183/#184) plus PR #185, and the psql-only command-pack doc
  present.
- The hidden password was **received** (`password_received=true`) but the
  **confirmation entry did not match** (`password_confirmed=false`) — the
  operator typed two different hidden password values.
- The **fail-closed password-confirmation gate** triggered:
  `stop_line=stage0_runner_password_mismatch`. It stopped **before** any
  `CREATE ROLE`, grants, proof SQL, and Stage 0 — no DB change occurred.

**This is:**
- an **operator input mismatch** in the hidden password-confirmation step, caught
  by the fail-closed design **before** any privileged DB action.

**This is not:**
- a psql-only command-pack failure (the gate worked as designed);
- a DB / admin-permission failure;
- a Stage 0 runtime / permission / code failure;
- a dedicated-role proof pass or fail after a DB action.

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

---

## 5. Verdict

- **BLOCKED — stopped before any DB change.** The dedicated role
  `buyerrecon_stage0_runner` was **not** created, granted, or proven; no password
  was set.
- The corrected psql-only command pack's fail-closed password-confirmation gate
  held: a mismatched hidden password entry stopped the flow **before**
  `CREATE ROLE`/grants/proof, with no secret printed.

---

## 6. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. Helen may then issue a **fresh explicit GO** for **exactly one** corrected
   psql-only Option A create/grant/proof retry.
3. The operator must **enter the same password twice carefully** in the hidden
   prompts. Suggested handling: type it once into a local password-manager note,
   copy it once, then paste the **exact same value** into both hidden prompts —
   **never** paste it into chat, and **never** commit or log it.
4. The operator runs only that bounded action on production and returns **safe
   labels only** for a **docs-only evidence PR**.
5. **Only if the dedicated-role proof passes** (all required positive labels true
   + all forbidden labels false) may Helen issue a **separate Stage 0 execution
   GO**. Stage 0 execution remains separately GO-gated.

---

## 7. Safety / Raw-Data Boundary

This record contains no password, DSN URI, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. No password value was
read into this record — only the boolean facts `password_received=true` /
`password_confirmed=false`. All values above are **safe labels / booleans / a
public git commit hash / a stop-line token** — not secret or row values.
