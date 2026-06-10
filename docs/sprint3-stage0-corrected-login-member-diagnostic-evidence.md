# Sprint 3 — Corrected Stage 0 Login-Member Read-Only Diagnostic — Evidence (PASS)

**Status:** `STAGE0_CORRECTED_LOGIN_MEMBER_READONLY_DIAGNOSTIC_PASS`

This is a **docs-only evidence record**. It captures the result of the
**corrected** read-only Stage 0 login-member diagnostic (PR #170 command pack).
The **corrected diagnostic passed cleanly** (exit 0, read-only, `ROLLBACK`, no
COMMIT), and the **previous summary-count query-shape error is resolved**.

This PR changes **no** roles, runs **no** SQL, and authorizes **no** Stage 0
execution. It records role names / booleans / counts only — no secrets,
passwords, DSN, or raw data.

> Provenance: PR #170 corrected diagnostic plan/command pack
> (`8e2655dd2a21d64b33a8358714e1833a79411d1a`, status
> `STAGE0_LOGIN_MEMBER_CORRECTED_DIAGNOSTIC_PLANNING_ONLY`).

---

## 1. Title & Status

- Title: Corrected Stage 0 Login-Member Read-Only Diagnostic — Evidence (PASS).
- Status: `STAGE0_CORRECTED_LOGIN_MEMBER_READONLY_DIAGNOSTIC_PASS`.
- One line: corrected diagnostic passed cleanly; `buyerrecon_app` is the only
  inspected login member of `buyerrecon_scoring_worker` and can reach all proven
  Stage 0 privileges — technical reachability only, not identity approval.

---

## 2. Authorization & Scope

- Helen issued the GO:
  `HELEN STAGE0 CORRECTED LOGIN-MEMBER READONLY DIAGNOSTIC GO`.
- The GO authorized **exactly one** corrected read-only diagnostic only.
- It did **not** authorize role change, `ALTER ROLE`, `GRANT role TO role`,
  Stage 0 execution, runtime, or downstream execution.
- Helen ran the diagnostic manually. Claude Code did not execute anything.

---

## 3. PR #170 Prerequisite

- PR #170 (corrected diagnostic plan / command pack) merged
  (`8e2655dd2a21d64b33a8358714e1833a79411d1a`). It fixed the prior
  `SUMMARY_COUNTS_ONLY` query-shape error (`missing FROM-clause entry for table
  "r"` → proper `FROM pg_roles r`) and defined the read-only reachability checks
  used here.

---

## 4. Execution Summary

- HEAD: `8e2655dd2a21d64b33a8358714e1833a79411d1a`.
- Log path:
  `/tmp/stage0-corrected-login-member-readonly-diagnostic-20260610T092806Z.log`.
- Diagnostic exit code: `0`.
- Read-only transaction used; `ROLLBACK` completed; **no COMMIT**.

---

## 5. DB / Read-Only Gate

- database: `buyerrecon_production`
- current_user: `postgres`
- current_role: `postgres`
- transaction_read_only: `on`

---

## 6. Scoring Worker Role Gate

- `scoring_worker_role_exists=true`
- `scoring_worker_can_login=false`

`buyerrecon_scoring_worker` exists and remains **NOLOGIN**.

---

## 7. Membership Inventory

Role names + booleans only (`can_login`, `inherits`, `member_of_scoring_worker`):

| role | can_login | inherits | member_of_scoring_worker |
|---|---|---|---|
| `buyerrecon_app` | true | true | **true** |
| `buyerrecon_prod_audit_readonly` | true | true | false |
| `buyerrecon_prod_collector_app` | true | true | false |
| `buyerrecon_customer_api` | false | true | false |
| `buyerrecon_internal_readonly` | false | true | false |
| `buyerrecon_migrator` | false | true | false |
| `buyerrecon_scoring_worker` | false | true | true |

---

## 8. Corrected Summary Counts

- `buyerrecon_login_role_count=3`
- `login_member_of_scoring_worker_count=1`

The corrected `SUMMARY_COUNTS_ONLY` query (proper `FROM pg_roles r`) completed
without error.

---

## 9. `buyerrecon_app` Reachability Booleans

For `buyerrecon_app` (booleans only):
- `buyerrecon_app_member_of_scoring_worker=true`
- `buyerrecon_app_accepted_events_select=true`
- `buyerrecon_app_ingest_requests_select=true`
- `buyerrecon_app_stage0_insert=true`
- `buyerrecon_app_stage0_update=true`
- `buyerrecon_app_stage0_select_returning=true`

---

## 10. Optional `SET ROLE buyerrecon_app` Reachability Proof

Read-only `SET ROLE` reachability check (no Stage 0, no writes):
- `current_user_after_set_role=buyerrecon_app`
- `current_role_after_set_role=buyerrecon_app`
- `current_user_member_of_scoring_worker=true`
- `current_user_accepted_events_select=true`
- `current_user_ingest_requests_select=true`
- `current_user_stage0_insert=true`
- `current_user_stage0_update=true`
- `current_user_stage0_select_returning=true`
- `RESET ROLE` completed
- `ROLLBACK` completed

---

## 11. Interpretation

- The **corrected diagnostic passed cleanly** (exit 0, read-only, `ROLLBACK`,
  no COMMIT).
- The **previous summary-count query-shape error is resolved.**
- **`buyerrecon_app` is the only inspected login member of
  `buyerrecon_scoring_worker`.**
- **`buyerrecon_app` can reach all proven Stage 0 privileges** needed for the
  Stage 0 command path: `accepted_events SELECT`, `ingest_requests SELECT`,
  `stage0_decisions INSERT`, `stage0_decisions UPDATE`,
  `stage0_decisions SELECT/RETURNING` — confirmed both via membership booleans
  and the read-only `SET ROLE buyerrecon_app` reachability check.
- **This proves technical membership/reachability only.**
- **It does not approve `buyerrecon_app` as the production Stage 0 execution
  identity.** Suitability / custody / intended-use / least-privilege review
  remains a **separate decision**.
- **Stage 0 execution remains unauthorized.**
- No role change occurred. No Stage 0 execution occurred. No runtime was
  authorized.

---

## 12. What Did Not Run

- No diagnostic rerun by this PR.
- No role change; no `ALTER ROLE`; no `GRANT role TO role`.
- No production command by this PR; no SQL by this PR.
- No GRANT / DML / DDL; no permission fix.
- No Stage 0 execution.
- No extractor rerun.
- No risk worker / POI worker / evidence snapshot execution.
- No Lane A / Lane B preview or writes.
- No scoring runtime.
- No AMS Trust / Pass runtime.
- No customer output.
- No Gate 4E. No Gate 4F.

---

## 13. Next Gated Step

1. **Codex review and merge** of this evidence PR.
2. Then create a **docs-only Stage 0 execution-identity suitability decision
   PR** — decide whether `buyerrecon_app` is acceptable as the production Stage 0
   execution identity (Option A) or whether a **dedicated Stage 0 login role**
   is still required (Option B), using the custody / intended-use /
   least-privilege criteria.
3. Any role change remains gated: command-pack PR → Codex review → explicit
   Helen GO → execution → post-change proof.
4. **Stage 0 execution remains separately GO-gated** and unauthorized until the
   identity decision is made/proofed and a separate explicit Stage 0 execution
   GO is given.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column names, booleans, counts, SQL
identifiers, or stop-line / boundary language — not row values or credential
values. The diagnostic ran read-only (`ROLLBACK`, no COMMIT); no DSN/secret was
printed.
