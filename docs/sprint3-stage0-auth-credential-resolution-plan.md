# Sprint 3 — Stage 0 psql Gate `auth_or_credential` Resolution Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_RESOLUTION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It proposes a **staged,
fail-closed, secret-safe** approach to resolve the `auth_or_credential` blocker
classified in PR #201, so the Stage 0 psql gate can eventually pass — while
keeping **Stage 0 execution separately GO-gated**.

This PR **executes nothing**: no production command, no `psql`, no SQL, no DB
mutation, no password reset, no role change, no GRANT/DML/DDL, no Stage 0, no
run-lock touch, no runtime/deploy/downstream/customer output. No real DSN,
password, host, port, token, or raw value appears in this document.

> Provenance: PR #198 psql gate diagnostic plan
> (`274a99c828888494f3ba326959ab1051aeef18b5`); PR #199 runtime registry
> (`193cdc96bfabe9893b330910b36cf681db77a20a`); PR #200 blocked evidence
> (`72c929801faea7a8080c095e994a2cbc08426992`); PR #201 actual diagnostic result
> (`f592c1313081956e4c4277dfd23bdb72afd74fa1`,
> `STAGE0_PSQL_GATE_DIAGNOSTIC_AUTH_OR_CREDENTIAL`).

---

## 1. Purpose

- **Resolve the `auth_or_credential` blocker from PR #201** — the actual
  operator-run diagnostic had complete custody-derived input and invoked `psql`,
  but the gate query failed and the broad classifier returned
  `psql_gate_failure_class=auth_or_credential` (raw output withheld; exact cause
  unproven).
- **Keep Stage 0 execution separately GO-gated** — this plan does not authorize
  Stage 0, and a passing gate diagnostic is a precondition, not a trigger.

**Bounded interpretation (carried forward, not over-claimed):** the class is the
broad **`auth_or_credential`**; possible causes include password mismatch,
role-auth issue, role existence/usability issue, or another credential/auth-layer
issue. It is **not** connectivity and **not** SSL/`pg_hba`.

---

## 2. Inputs

- Existing merged evidence: PRs #198–#201 (plan / registry / blocked / actual
  result).
- **Approved custody source pointers only** — never raw host/port/DSN/password
  values (per the PR #199 registry and PR #193 custody rules).
- The **hidden `buyerrecon_stage0_runner` secret** is used **only when/if a later
  step is GO-gated**, supplied secret-safe (hidden prompt / in-memory),
  never printed/committed.

---

## 3. Candidate Diagnostic / Remediation Sequence (each step separately GO-gated)

> All steps are **fail-closed** and **secret-safe**: raw `psql` output → chmod-600
> temp, never printed; only safe labels/booleans emitted; secrets unset on every
> path. **No step is authorized by this PR.**

### Step 1 — secret-safe role login/usability metadata check (catalog booleans only)
- Using an **already-approved read connection** (e.g. an admin/diagnostic catalog
  query path), confirm via catalog booleans **where possible**, **without** the
  runner password:
  - `role_exists` for `buyerrecon_stage0_runner`;
  - `role_can_login` (`rolcanlogin`);
  - `role_valid_until_ok` (not expired, if a validity is set) — boolean only;
  - the proven least-privilege grants still hold (positive booleans) and the
    forbidden boundary is intact (negative booleans, per PR #188).
- Emits **booleans only**; **no** raw role attributes, no password, no DSN. This
  distinguishes a **role existence/usability** problem from a **password** problem
  without exposing secrets.

### Step 2 — secret-safe password custody verification / reset (only if Step 1 indicates a password issue)
- If Step 1 shows the role exists and is login-capable but the diagnostic still
  classifies `auth_or_credential`, the likely issue is the **password custody /
  value** for `buyerrecon_stage0_runner`.
- A **password verification or reset** is **separately GO-gated** and must:
  - be performed by the operator/DBA under an approved admin path;
  - **never print or store the password** (hidden prompt / secret manager only);
  - set the password to the value held in approved custody (or a new value placed
    only in approved custody);
  - emit **safe labels only** (e.g. `password_reset_done=true`,
    `password_printed=false`) — never the value;
  - be recorded in its own docs-only evidence PR.
- **Any password reset is a privileged DB action** (`ALTER ROLE … PASSWORD …`) and
  is **out of scope for this plan** — it requires its own command-pack PR, Codex
  review, and a fresh explicit GO.

### Step 3 — rerun exactly one PR #198-style psql gate diagnostic
- After any credential fix, **rerun exactly one** PR #198-style secret-safe psql
  gate diagnostic (before run-lock, before Stage 0; safe labels only incl. the
  broad `psql_gate_failure_class`; raw output withheld).
- Recorded in a docs-only evidence PR.

### Step 4 — only then consider a Stage 0 retry
- **Only after a successful psql gate diagnostic** (`psql_gate_query_pass=true`)
  may a Stage 0 retry be considered — and **Stage 0 remains separately
  GO-gated**, under the full PR #189 flow with its own evidence PR.

---

## 4. Stop-Lines

Abort (safe stop-line + non-zero exit) if any of:
- any raw DSN / password / token / host / port / IP would be printed;
- any raw PostgreSQL error text would be printed;
- more than one diagnostic attempt would run without a new GO;
- any GRANT / DML / DDL / password reset / role change would be attempted
  without a separate GO;
- Stage 0 or the run-lock would be touched;
- `.env.production` would be mutated;
- any Lane / scoring / AMS / customer output would be touched;
- any extractor / risk / POI / evidence snapshot / Gate 4E / Gate 4F runtime would
  occur.

If a stop-line is hit, record the blocked state in a docs-only evidence PR before
any further action.

---

## 5. Safety Boundaries (this planning PR)

- **No production command** run by this planning PR.
- **No SQL / psql** executed by this planning PR.
- No DB mutation.
- No password reset.
- No role change.
- No GRANT / DML / DDL.
- No Stage 0.
- No run-lock.
- No runtime / deploy / downstream / customer output.

---

## 6. Evidence Requirements (for any future execution step)

Every future execution step (each separately GO-gated) must:
- emit **safe labels only**;
- **withhold raw output** (raw `psql` → chmod-600 temp; never printed);
- include **no secret / raw infrastructure values** (no DSN/password/token/host/
  port/IP/raw error text/customer/row data);
- be recorded in a **docs-only evidence PR after each execution step**.

---

## 7. Explicit Non-Authorization

**Merging this planning PR does not authorize** any:
- fix; password reset; role change; diagnostic run; Stage 0 retry; or runtime
  action;
- production command; SQL/psql; DB mutation; GRANT/DML/DDL;
- run-lock touch; `.env.production` mutation;
- extractor / risk / POI / evidence snapshot / Lane A·B / scoring / AMS
  Trust·Pass / customer output / Gate 4E / Gate 4F runtime.

Each step above is its **own** docs-only plan/command-pack → Codex review →
explicit Helen GO → bounded operator action → docs-only evidence PR. **Stage 0
execution remains separately GO-gated.**

---

## 8. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Helen issues a separate explicit GO** for **Step 1** (secret-safe role
   login/usability metadata check) — its own bounded action, safe labels only,
   docs-only evidence PR.
3. Based on Step 1's booleans, plan **Step 2** (password custody
   verification/reset) only if indicated — its **own** command-pack PR + Codex
   review + fresh GO.
4. **Step 3** rerun one PR #198-style gate diagnostic → docs-only evidence PR.
5. **Step 4** (Stage 0 retry) only after a clean gate diagnostic, separately
   GO-gated.

---

## 9. Safety / Raw-Data Boundary

This record contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, raw PostgreSQL error text, or customer
data. The `buyerrecon_stage0_runner` secret is referenced only as a **custody
pointer** (used hidden/in-memory only under a future GO; never printed/committed).
All values above are safe labels / booleans / public git commit hashes / a broad
classifier token (`auth_or_credential`) / role / database names — not secret or
row values.
