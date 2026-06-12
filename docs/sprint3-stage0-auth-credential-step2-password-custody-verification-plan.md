# Sprint 3 — Stage 0 auth/credential Step 2 — Password/Custody Verification Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2_PASSWORD_CUSTODY_VERIFICATION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans an
**investigation-first, fail-closed** Step 2 password/custody verification path for
`buyerrecon_stage0_runner`, after **role metadata** (PR #206) and the **checked
grant boundary** (PR #213) were found clean and **Step 1C** (PR #214) recommended
the password/custody branch as the next investigation surface for the broad
`auth_or_credential` blocker (PR #201).

This PR **executes nothing**: no production command, no `psql`, no SQL, no
raw-output inspection, no custody/password check, no password read/use, no
`buyerrecon_stage0_runner` password use, no psql login as the runner, no password
reset, no credential change, no role change, no GRANT/DML/DDL, no Stage 0, no
run-lock touch, no `.env.production` mutation, no runtime/deploy/downstream/customer
action. No real DSN, password, host, port, token, IP, or raw value appears in this
document.

> Provenance: PR #201 psql gate diagnostic — broad `auth_or_credential`
> (`f592c1313081956e4c4277dfd23bdb72afd74fa1`,
> `STAGE0_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`); PR #206 Step 1A role metadata
> clean (`b2a38af7588ceaeda87f41050c621dc4af80206d`,
> `STAGE0_AUTH_CREDENTIAL_STEP1A_ROLE_METADATA_CLEAN`); PR #213 Step 1B-E combined
> grant-boundary clean (`0e84bf14268eda4fd28d39e5516d8abf7e92fda6`,
> `STAGE0_AUTH_CREDENTIAL_STEP1B_E_GRANT_BOUNDARY_CLEAN`); PR #214 Step 1C decision
> plan (`37fd02b80f5fbefa2edf546eea3ab2c438f51a00`,
> `STAGE0_AUTH_CREDENTIAL_STEP1C_DECISION_PLANNING_ONLY`).

---

## 1. Purpose

- **Verify the password/custody path** for `buyerrecon_stage0_runner` after role
  metadata and the checked grant boundary were found clean.
- **Determine whether** the remaining `auth_or_credential` blocker is **consistent
  with** a custody/password mismatch or a credential-handling issue.
- **Do not prove or assume root cause before evidence.** This plan is
  investigation-first: it gathers safe-label evidence before any change is even
  considered, and treats the password/custody path as the **remaining unchecked
  surface**, not a proven cause.

---

## 2. Inputs

- PR #201 `auth_or_credential` evidence
  (`f592c1313081956e4c4277dfd23bdb72afd74fa1`).
- PR #206 role metadata clean evidence
  (`b2a38af7588ceaeda87f41050c621dc4af80206d`).
- PR #213 grant boundary clean evidence
  (`0e84bf14268eda4fd28d39e5516d8abf7e92fda6`).
- PR #214 Step 1C decision plan (`37fd02b80f5fbefa2edf546eea3ab2c438f51a00`).
- **Approved custody source pointers only** (which approved store/path is
  authoritative — not its contents).
- **No** raw password, DSN, token, host, port, IP, or PostgreSQL raw error text is
  an input, an output, or a recorded value.

---

## 3. Recommended Step 2 Sequence

> **Safest path: one sub-step at a time, each separately GO-gated (or under a
> clearly bounded staged GO if separately reviewed), each with its own docs-only
> evidence PR.** Each sub-step is **fail-closed** (exact safe-label set; non-zero
> exit on any error/mismatch) and emits **safe labels only**. No sub-step reads,
> prints, copies, or stores a password.

### Step 2A — custody-pointer inventory check
- Confirm **which approved custody source is authoritative** for
  `buyerrecon_stage0_runner` (pointer/identity/scope only — never the secret
  value).
- Emit **safe labels only**, such as:
  - `custody_pointer_present`;
  - `custody_pointer_authoritative`;
  - `custody_pointer_scope_matches_stage0_runner`;
  - `step2a_custody_pointer_result`.
- **Do not read, print, copy, or store the password.**

### Step 2B — secret-safe operator confirmation
- Operator confirms whether the password used for the PR #198 diagnostic **came
  from the approved authoritative custody source** (a yes/no attestation, not a
  value).
- Emit **safe labels only**, such as:
  - `operator_used_authoritative_custody_secret` (`true`/`false`);
  - `step2b_operator_confirmation_result`.
- **No password value recorded.**

### Step 2C — one secret-safe psql gate diagnostic rerun (only if 2A/2B support it)
- Run **exactly one** PR #198-style **safe-label-only** psql gate diagnostic
  (same secret-safe, fail-closed shape: hidden DSN assembly, raw output →
  chmod-600 temp, allowlist booleans only).
- **No raw output printed.** **No Stage 0.**
- Only proceed if **Step 2A/2B support it**; otherwise stop and record evidence.

### Step 2D — separate password reset / credential rotation command-pack (only if custody mismatch is indicated)
- If 2A/2B/2C indicate a **custody mismatch**, prepare a **separate** password
  reset / credential rotation command-pack. It **must**:
  - be **separately planned** (its own docs-only command-pack);
  - be **Codex-reviewed**;
  - require a **fresh explicit Helen GO**;
  - **never print or store** the new password.

### Step 2E — post-fix psql gate diagnostic rerun
- After **any** credential fix, rerun **exactly one** PR #198-style psql gate
  diagnostic — **only if separately GO-gated** — and record an **evidence PR**.

> **Stage 0 retry remains separate** and only after a **clean** psql gate
> diagnostic; it is **separately GO-gated**.

---

## 4. Stop-Lines

Abort (safe stop-line + non-zero exit) if any of:
- any password, DSN, token, host, port, IP, URI, or raw PostgreSQL error text
  would be printed or recorded;
- any password reset or credential change would occur **without** a separate
  reviewed command-pack and fresh GO;
- any psql login as `buyerrecon_stage0_runner` would occur **without** a separate
  reviewed command and fresh GO;
- any raw output would be inspected or printed;
- any GRANT / DML / DDL / role change would occur;
- Stage 0 or the run-lock would be touched;
- `.env.production` would be mutated;
- any runtime / downstream / Lane A·B / scoring / AMS / customer output / Gate 4E
  / Gate 4F would run.

If a stop-line is hit, withhold raw output, record the blocked state in a docs-only
evidence PR, and take no fix/retry without separate review/GO.

---

## 5. Safety Boundaries (this planning PR)

- **No production command** run by this PR.
- **No psql / SQL** executed by this PR.
- No password read / use.
- No password reset.
- No credential change.
- No psql login as `buyerrecon_stage0_runner`.
- No role change.
- No GRANT / DML / DDL.
- No Stage 0.
- No run-lock.
- No `.env.production` mutation.
- No runtime / deploy / downstream / customer action.

---

## 6. Evidence Requirements (for any future Step 2 action)

Every future Step 2A/2B/2C/2D/2E execution (each separately GO-gated, or under a
clearly bounded staged GO) must:
- emit **safe labels only** (the exact allowlist for that sub-step);
- **withhold raw output** (raw text → chmod-600 temp; never printed);
- contain **no secret / raw infrastructure values** (no password/DSN/token/host/
  port/IP/URI/raw PostgreSQL error text/customer/row data);
- be recorded in a **docs-only evidence PR after each execution step**;
- carry out **no retry or fix after a blocked result without separate review/GO.**

---

## 7. Explicit Non-Authorization

**Merging this Step 2 planning PR does not authorize:**
- Step 2 execution;
- any password/custody check;
- reading, printing, storing, resetting, or changing any password;
- a psql login as `buyerrecon_stage0_runner`;
- a Stage 0 retry.

**Each Step 2 sub-step requires its own docs-only plan or command-pack (as
applicable), Codex review, and a fresh explicit Helen GO.** **Stage 0 execution
remains separately GO-gated.**

---

## 8. Next Gated Step

1. **Codex review and merge** of this Step 2 planning PR.
2. **Helen issues a separate explicit GO** for **one** Step 2A custody-pointer
   inventory check (pointers/identity/scope only; no password read/print/copy/store;
   safe labels only; raw output withheld).
3. Docs-only **Step 2A evidence PR** (safe labels only).
4. **Step 2B** secret-safe operator confirmation, then **Step 2C** one PR #198-style
   diagnostic rerun — each only on its own evidence and a fresh GO (or a clearly
   bounded staged GO if separately reviewed).
5. **Step 2D** (separate reset/rotation command-pack) only if a custody mismatch is
   indicated — separately planned, Codex-reviewed, fresh GO, never print/store the
   password.
6. **Step 2E** one post-fix PR #198-style diagnostic rerun — only if separately
   GO-gated → docs-only evidence PR.
7. **Stage 0 execution remains separately GO-gated** (only after a clean psql gate
   diagnostic).

---

## 9. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address (public or local), IPv6 address, hostname, port value,
SSH banner, login source, host/network detail, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, raw SQL or raw PostgreSQL error text, or
customer data. Every recommended Step 2 sub-step uses **approved custody source
pointers and the approved custody connection only** (never the
`buyerrecon_stage0_runner` login/password value), emits **safe labels only**, and
withholds raw output. All values above are safe labels / public git commit hashes /
role / database names — not secret or row values.
