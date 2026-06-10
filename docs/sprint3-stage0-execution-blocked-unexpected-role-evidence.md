# Sprint 3 — Stage 0 Execution — Blocked on Unexpected Role (Evidence)

**Status:** `STAGE0_EXECUTION_BLOCKED_UNEXPECTED_ROLE`

This is a **docs-only evidence record**. It records that the authorized Stage 0
execution attempt **stopped at the pre-execution role gate**: the loaded DSN
resolved to `buyerrecon_prod_collector_app`, not the approved `buyerrecon_app`
execution identity from PR #172, so the **`STOP_LINE: unexpected execution
role`** triggered. **Stage 0 did not run.**

This is a **pre-execution identity mismatch — not a Stage 0 runtime failure and
not a permission failure inside Stage 0.** This PR changes no roles, runs no
SQL, and authorizes no rerun. It records booleans / role-gate facts only — no
secrets, DSN, passwords, or raw data.

> Provenance: PR #172 Stage 0 execution-identity decision
> (`5d9bf66489eb696f7fd1b1098b1874f7126478e0`, status
> `STAGE0_EXECUTION_IDENTITY_DECISION_PLANNING_ONLY`).

---

## 1. Title & Status

- Title: Stage 0 Execution — Blocked on Unexpected Role (Evidence).
- Status: `STAGE0_EXECUTION_BLOCKED_UNEXPECTED_ROLE`.
- One line: the role gate failed (DSN resolved to
  `buyerrecon_prod_collector_app`, expected `buyerrecon_app`); Stage 0 did not
  run; the one authorized execution was **not** consumed.

---

## 2. Authorization & Expected Identity

- Helen issued the Stage 0 execution GO:
  `HELEN STAGE0 EXECUTION GO: run exactly one production Stage 0 execution using DATABASE_URL="$APP_DSN" npm run stage0:run, with buyerrecon_app as the approved scoped execution identity from PR #172, secret-safe DSN loading, role/database gates before execution, no DSN/password/token output, no raw row values, no raw identifiers, no payload/customer data, no ad hoc grant/role/SQL/permission fix, no extractor rerun, no risk worker, no POI worker, no evidence snapshot, no Lane/scoring/AMS/customer output, no Gate 4E/F, and create a docs-only Stage 0 execution evidence PR afterward.`
- The GO authorized **exactly one** Stage 0 execution **only if the gates
  passed**.
- **Expected (approved) execution identity:** `buyerrecon_app` (scoped Option A,
  PR #172).
- Helen ran the attempt manually. Claude Code did not execute anything.

---

## 3. PR #172 Prerequisite

- PR #172 (Stage 0 execution-identity decision) merged
  (`5d9bf66489eb696f7fd1b1098b1874f7126478e0`). It recommended **scoped Option
  A** — approve `buyerrecon_app` for **one** gated Stage 0 run — and required a
  **role/database gate before execution** plus an **unexpected-execution-role
  stop-line** (§9).

---

## 4. Attempt Summary

- HEAD synced to the expected PR #172 merge:
  `5d9bf66489eb696f7fd1b1098b1874f7126478e0`.
- `APP_DSN` loaded **without printing**.
- `stage0:run` script present; maps to `tsx scripts/run-stage0-worker.ts`.
- The attempt **stopped at the role gate before** the `npm run stage0:run`
  command was reached.

---

## 5. Preflight Gates That Passed (before the stop)

- HEAD matched the reviewed/merged decision chain
  (`5d9bf66489eb696f7fd1b1098b1874f7126478e0`).
- `APP_DSN` loaded secret-safe (value not printed).
- `stage0:run` script present (`tsx scripts/run-stage0-worker.ts`).
- Role/database gate **output**:
  - `current_user=buyerrecon_prod_collector_app`
  - `current_database=buyerrecon_production`
  - `transaction_read_only=off`

---

## 6. Stop-Line That Triggered

- Expected execution role from PR #172: **`buyerrecon_app`**.
- Observed `current_user`: **`buyerrecon_prod_collector_app`**.
- **`STOP_LINE: unexpected execution role`** — the observed role is not the
  approved scoped execution identity.
- The attempt stopped here, **before** reaching `npm run stage0:run` and
  **before** `touch "$RUN_LOCK"`.

---

## 7. What Did Not Run

- **Stage 0 did not run.** The `npm run stage0:run` command was **not reached**.
- The run lock was **not** touched (stop occurred before `touch "$RUN_LOCK"`);
  **the one authorized execution was not consumed.**
- No role change; no `ALTER ROLE`; no `GRANT role TO role`.
- No GRANT / DML / DDL; no permission fix.
- No extractor rerun.
- No risk worker; no POI worker; no evidence snapshot execution.
- No Lane A / Lane B preview or writes.
- No scoring runtime; no AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.
- No downstream runtime.
- No secrets, DSN, password, token, raw row values, raw identifiers, payload
  data, or customer data were printed.

---

## 8. Interpretation

- This is a **pre-execution identity mismatch**.
- The loaded `APP_DSN` appears to resolve to `buyerrecon_prod_collector_app`,
  **not** the approved `buyerrecon_app` identity.
- **This is not a Stage 0 runtime failure.**
- **This is not a permission failure inside Stage 0.**
- **This is not evidence that Stage 0 code is broken.**
- It means the **execution-identity custody / DSN binding remains unresolved**
  before Stage 0 can run: the DSN supplied to the worker is the collector
  credential, not the approved `buyerrecon_app` login identity.
- The role gate worked as designed (PR #172 §9) — it correctly refused to run
  Stage 0 under an unapproved identity.

---

## 9. Required Next Step

1. **Codex review and merge** of this evidence PR.
2. Then create a **separate docs-only resolution planning PR before any rerun.**
   That planning PR should decide how to **obtain or bind the approved
   `buyerrecon_app` execution identity safely** (correct DSN custody for the
   approved login role, secret-safe), **or reopen the Option B dedicated
   login-role path** if `buyerrecon_app` DSN custody is not available/acceptable.
3. **No Stage 0 rerun** until the execution-identity/DSN binding is resolved,
   reviewed, and a **separate explicit Stage 0 execution GO** is given. The
   single authorized execution from this GO was **not** consumed, but a rerun
   still requires the identity to be correct and a fresh GO per the gating
   posture.

---

## 10. Explicit Non-Authorization

This PR is **docs-only / evidence-only** and authorizes **none** of:
- no production command; no SQL; no diagnostic rerun; no role change;
- no `ALTER ROLE`; no `GRANT role TO role`; no GRANT/DML/DDL; no permission fix;
- no Stage 0 rerun; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F; no downstream runtime.

---

## 11. Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / database / relation names, SQL identifiers, the masked
`DATABASE_URL="$APP_DSN" npm run stage0:run` command example, role-gate booleans
/ values (`current_user` / `current_database` / `transaction_read_only` are role
and gate facts, not secrets), or stop-line / boundary language. The DSN was
loaded from `DATABASE_URL` only and never printed.
