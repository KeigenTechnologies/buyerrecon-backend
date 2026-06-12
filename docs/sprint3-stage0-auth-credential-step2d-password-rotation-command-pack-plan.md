# Sprint 3 — Stage 0 auth/credential Step 2D — Password Reset / Credential Rotation Command-Pack Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2D_PASSWORD_ROTATION_COMMAND_PACK_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **secret-safe,
fail-closed** password reset / credential rotation command-pack for
`buyerrecon_stage0_runner`, after **Step 2C** (PR #218) reproduced the broad
`auth_or_credential` psql gate failure **despite** clean role metadata (PR #206),
a clean grant boundary (PR #213), custody-pointer readiness (PR #216), and
secret-safe operator confirmation (PR #217).

This PR **executes nothing**: no production command, no `psql`, no SQL, no
password read/use/reset/change, no credential rotation, no custody value change, no
psql login as the runner, no role/grant/schema/deploy/runtime change, no
GRANT/DML/DDL, no Stage 0, no run-lock touch, no `.env.production` mutation, no
runtime/deploy/downstream/customer action. No raw password, DSN, token, host, port,
IP, URI, or raw PostgreSQL error text appears in this document.

> Provenance: PR #201 broad `auth_or_credential`
> (`f592c1313081956e4c4277dfd23bdb72afd74fa1`); PR #206 role metadata clean
> (`b2a38af7588ceaeda87f41050c621dc4af80206d`); PR #213 grant-boundary clean
> (`0e84bf14268eda4fd28d39e5516d8abf7e92fda6`); PR #214 Step 1C decision plan
> (`37fd02b80f5fbefa2edf546eea3ab2c438f51a00`); PR #215 Step 2 verification plan
> (`ed4a46e44f992f5f443a2bd48df9cba0937393a6`); PR #216 Step 2A custody pointer
> ready (`e959071ec4faf686d41a58b2c621fb30bc07c7c7`); PR #217 Step 2B operator
> confirmation clean (`1cae6cb21ced2d6409910f4000f805462492b104`); PR #218 Step 2C
> psql gate diagnostic — `auth_or_credential` reproduced
> (`92d568a6b7491500db4de1732c3b9015a0ddc14e`,
> `STAGE0_AUTH_CREDENTIAL_STEP2C_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`).

---

## 1. Purpose

- **Plan** a secret-safe credential rotation/reset command-pack for
  `buyerrecon_stage0_runner` after **Step 2C reproduced `auth_or_credential`**
  despite clean role metadata, a clean grant boundary, custody-pointer readiness,
  and secret-safe operator confirmation.
- **This is a planning PR only** — it designs the command-pack shape and evidence
  contract; it runs nothing.
- **Step 2D does not prove the exact root cause.** It is the **next remediation
  branch** indicated by the reproduced `auth_or_credential` once role/grant/custody/
  operator-confirmation surfaces are all clean — not a proof that the password value
  is wrong.

---

## 2. Inputs

- Merged evidence PRs: #201 (`f592c1313081956e4c4277dfd23bdb72afd74fa1`), #206
  (`b2a38af7588ceaeda87f41050c621dc4af80206d`), #213
  (`0e84bf14268eda4fd28d39e5516d8abf7e92fda6`), #214
  (`37fd02b80f5fbefa2edf546eea3ab2c438f51a00`), #215
  (`ed4a46e44f992f5f443a2bd48df9cba0937393a6`), #216
  (`e959071ec4faf686d41a58b2c621fb30bc07c7c7`), #217
  (`1cae6cb21ced2d6409910f4000f805462492b104`), #218
  (`92d568a6b7491500db4de1732c3b9015a0ddc14e`).
- The **approved custody pointer** for `buyerrecon_stage0_runner` (identity/scope
  per Step 2A — never its secret value).
- An **operator-generated new password or an approved password generation method**
  (provided/handled secret-safely; never an input/output/recorded value here).
- **No** raw password, DSN, token, host, port, IP, URI, or raw PostgreSQL error
  text appears in this document.

---

## 3. Proposed Step 2D Execution Shape — CANDIDATE ONLY — DO NOT RUN

> The following is a **design sketch for review**, not a runnable command and not
> authorization to run anything. Every step is **fail-closed** and **secret-safe**;
> the password is **only ever** handled via hidden input and is **never** printed,
> logged, pasted, committed, recorded, or assembled into any printed string.

1. **Preflight sync gate** to the expected branch/head (verify current head matches
   the expected merged base; abort on mismatch).
2. **Confirm PR #215 / #216 / #217 / #218 docs are present** on the checked-out
   tree (provenance/readiness gate).
3. **Confirm admin connection / custody capability** **without printing** the DSN,
   host, port, or any secret (boolean capability check only).
4. **Generate or receive the new password through hidden input only**
   (`read -r -s`-style; no echo; no argv; no env-var leak into logs).
5. **Require double hidden entry / confirmation** of the new password (second hidden
   read), comparing in-memory only.
6. **Fail closed if the hidden entries mismatch** (non-zero exit; no value emitted;
   nothing recorded).
7. **Apply the password reset / rotation in a single tightly scoped command**
   (e.g. one role-scoped credential change), **only after explicit GO**, with the
   secret passed in-memory only — never on a printed command line or in logs.
8. **Update the authoritative custody pointer value secret-safely** **if and only
   if** the command-pack explicitly includes that step **and** the GO authorizes it
   (otherwise skip; never partial).
9. **Do not mutate `.env.production`.**
10. **Do not print or log the password.**
11. **Do not commit or paste the password.**
12. **Do not print DSN / host / port / IP / token / URI / raw PostgreSQL error
    text.**
13. **After any successful rotation, run no Stage 0**; only proceed to **Step 2E**
    post-fix psql gate diagnostic **under a separate GO**.

---

## 4. Candidate Safe Labels (for future Step 2D execution evidence)

> Allowlist only. Booleans/tokens — **never** a password or raw value. The
> password value itself is **never** among these labels.

```text
step2d_password_rotation_attempted=true
diagnostic_scope=pr215_step2d_password_rotation_command_pack
production_host_confirmed=true/false
expected_branch_head_confirmed=true/false
authoritative_custody_pointer_confirmed=true/false
hidden_password_received=true/false
hidden_password_confirmed=true/false
password_value_printed=false
password_value_stored_in_repo=false
password_value_recorded_in_evidence=false
db_password_rotation_attempted=true/false
db_password_rotation_committed=true/false
custody_pointer_update_attempted=true/false
custody_pointer_update_confirmed=true/false
env_production_mutated=false
raw_sql_output_printed=false
raw_postgres_error_printed=false
stage0_executed=false
run_lock_touched=false
step2d_password_rotation_result=<allowlisted result>
```

---

## 5. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- a raw password would be printed, stored, logged, pasted, committed, or recorded;
- the hidden password entries mismatch;
- the authoritative custody pointer is missing or ambiguous;
- the operator lacks admin capability;
- DSN / token / host / port / IP / URI would be printed;
- raw PostgreSQL error text would be printed;
- `.env.production` would be mutated;
- any GRANT / DML / DDL beyond the tightly scoped password rotation would occur;
- any role / grant / schema / deploy / runtime change outside the password rotation
  would occur;
- Stage 0 or the run-lock would be touched;
- any downstream / Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F
  would run;
- any command would run outside an explicit Helen GO.

If a stop-line is hit, withhold all secret/raw output, record the blocked state in a
docs-only evidence PR (safe labels only), and take no fix/retry without separate
review/GO.

---

## 6. Safety Boundaries (this planning PR)

- **No production command** run by this PR.
- **No psql / SQL** executed by this PR.
- No password read / use / reset / change.
- No credential rotation.
- No custody value change.
- No psql login as `buyerrecon_stage0_runner`.
- No role / grant / schema / deploy / runtime change.
- No GRANT / DML / DDL.
- No Stage 0.
- No run-lock.
- No `.env.production` mutation.
- No runtime / deploy / downstream / customer action.

---

## 7. Evidence Requirements (for any future Step 2D execution)

Every future Step 2D execution (separately GO-gated) must:
- emit **safe labels only** (the §4 allowlist; never a password/raw value);
- **withhold raw output** (raw text → chmod-600 temp; never printed);
- contain **no secret / raw infrastructure values** (no password/DSN/token/host/
  port/IP/URI/raw PostgreSQL error text/customer/row data);
- be recorded in a **docs-only evidence PR after execution**;
- trigger **no Step 2E diagnostic until** the Step 2D evidence is reviewed/merged
  **and** a fresh GO is issued;
- trigger **no Stage 0 retry until** a later **clean** post-fix psql gate diagnostic
  **and** a separate Stage 0 GO.

---

## 8. Explicit Non-Authorization

**Merging this Step 2D planning PR does not authorize:**
- a password reset;
- a credential rotation;
- a custody pointer update;
- any psql / SQL;
- Step 2E;
- Stage 0.

**Step 2D execution requires Codex review and a fresh explicit Helen GO.** **Stage 0
execution remains separately GO-gated.**

---

## 9. Next Gated Step

1. **Codex review and merge** of this Step 2D planning PR.
2. **Helen issues a separate explicit GO** for **one** Step 2D password reset /
   credential rotation execution (secret-safe, fail-closed, hidden input only,
   allowlist labels only, raw output withheld, password never printed/stored).
3. Docs-only **Step 2D evidence PR** (safe labels only; no password/raw value).
4. **Step 2E** (one post-fix PR #198-style psql gate diagnostic rerun) only after
   the Step 2D evidence is reviewed/merged and a **fresh GO** is issued → docs-only
   evidence PR.
5. **Stage 0 execution remains separately GO-gated** (only after a later clean
   post-fix psql gate diagnostic and a separate Stage 0 GO).

---

## 10. Safety / Raw-Data Boundary

This record contains no raw password, hidden password, `.env.production` content,
real DSN URI, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source,
host/network detail, raw payload, `canonical_jsonb` payload, `accepted_events` row
data, raw behavioural row data, real `session_id` / `request_id` value, user-agent
value, raw SQL, raw psql output, raw PostgreSQL error text, or customer data. The
candidate Step 2D command-pack handles the new password via **hidden input only**,
**never** prints/logs/pastes/commits/records it, uses the **approved custody
pointer** (identity/scope only), and emits **safe allowlist labels only**. All
values above are safe labels / booleans / public git commit hashes / role / database
names — not secret or row values. (Per the PR #218 Codex note: "no secret used or
exposed" is to be read as "no secret value exposed, printed, or recorded.")
