# Sprint 3 — Stage 0 Login / Member Read-Only Diagnostic — Evidence (with summary-query error)

**Status:** `STAGE0_LOGIN_MEMBER_READONLY_DIAGNOSTIC_EXECUTED_WITH_SUMMARY_QUERY_ERROR`

This is a **docs-only evidence record**. It captures the result of the
read-only role-membership diagnostic authorized for the Stage 0 login-path
question. The **diagnostic produced useful membership evidence but exited
non-zero (exit code 3) due to a summary-query error** — it must **not** be
treated as a clean PASS.

This PR changes **no** roles, runs **no** SQL, and authorizes **no** Stage 0
execution. It records role names / booleans only — no secrets, passwords, DSN,
or raw data.

> Provenance: PR #168 Stage 0 login/member-role path plan
> (`4a253fc20f9865c028c4e34d5ec3e7d19f14b864`, status
> `STAGE0_LOGIN_MEMBER_ROLE_PATH_PLANNING_ONLY`).

---

## 1. Title & Status

- Title: Stage 0 Login / Member Read-Only Diagnostic — Evidence (with
  summary-query error).
- Status: `STAGE0_LOGIN_MEMBER_READONLY_DIAGNOSTIC_EXECUTED_WITH_SUMMARY_QUERY_ERROR`.
- One line: membership evidence captured; `buyerrecon_app` is a login member of
  `buyerrecon_scoring_worker`; recorded as executed-with-summary-query-error
  (not a clean PASS).

---

## 2. Authorization & Scope

- Helen issued the GO: `HELEN STAGE0 LOGIN-MEMBER READONLY DIAGNOSTIC GO`.
- The GO authorized **only** a read-only role-membership diagnostic.
- It did **not** authorize role changes, `ALTER ROLE`, `GRANT role TO role`,
  Stage 0 execution, grants, SQL fixes, downstream runtime,
  Lane/scoring/AMS/customer output, Gate 4E, or Gate 4F.
- Helen ran the diagnostic manually. Claude Code did not execute anything.

---

## 3. PR #168 Prerequisite

- PR #168 (Stage 0 login/member-role path plan) merged
  (`4a253fc20f9865c028c4e34d5ec3e7d19f14b864`). It recommended this read-only
  role-membership diagnostic to decide between Option A (existing login member)
  and Option B (dedicated login role) — names/booleans only, no role change.

---

## 4. Execution Summary

- Branch: `sprint2-architecture-contracts-d4cc2bf`.
- HEAD: `4a253fc20f9865c028c4e34d5ec3e7d19f14b864`.
- Log path:
  `/tmp/stage0-login-member-readonly-diagnostic-20260609T220557Z.log`.
- Diagnostic exit code: `3` (non-zero — see §9 summary-query error).

---

## 5. DB / Read-Only Gate

- database: `buyerrecon_production`
- current_user: `postgres`
- current_role: `postgres`
- transaction_read_only: `on`

The diagnostic ran inside a **read-only** transaction; no write statements were
included.

---

## 6. Scoring Worker Role Gate

- `scoring_worker_role_exists=true`
- `scoring_worker_can_login=false`

`buyerrecon_scoring_worker` exists and remains **NOLOGIN**.

---

## 7. Membership Inventory Evidence

Role names + booleans only (`can_login`, `member_of_scoring_worker`):

| role | can_login | member_of_scoring_worker |
|---|---|---|
| `buyerrecon_app` | true | **true** |
| `buyerrecon_prod_audit_readonly` | true | false |
| `buyerrecon_prod_collector_app` | true | false |
| `buyerrecon_customer_api` | false | false |
| `buyerrecon_internal_readonly` | false | false |
| `buyerrecon_migrator` | false | false |
| `buyerrecon_scoring_worker` | false | true |

---

## 8. Login-Member Candidate Evidence

Login roles (`can_login=true`) and their `buyerrecon_scoring_worker` membership:

- `buyerrecon_app` — `member_of_scoring_worker=true` ← **only login member**
- `buyerrecon_prod_audit_readonly` — `member_of_scoring_worker=false`
- `buyerrecon_prod_collector_app` — `member_of_scoring_worker=false`

So the **only login role that is a member of `buyerrecon_scoring_worker` is
`buyerrecon_app`**.

---

## 9. Query Error / Diagnostic Limitation

- The final `SUMMARY_COUNTS_ONLY` query failed with:
  `ERROR: missing FROM-clause entry for table "r"`.
- The explicit `ROLLBACK` line was **not printed** because `ON_ERROR_STOP=1`
  stopped the psql script at the query error.
- The transaction was **read-only** and **no write statements were included**,
  so no mutation could have occurred; but **this must not be overstated as a
  clean PASS** — the diagnostic exited non-zero (exit 3) on the summary query.
- The membership inventory (§7) and login-member candidate evidence (§8) were
  emitted **before** the failing summary query and are valid; only the final
  `SUMMARY_COUNTS_ONLY` aggregation failed (a query-shape error referencing an
  unqualified alias `r`).

---

## 10. Interpretation

- The **diagnostic produced useful membership evidence but exited non-zero due
  to a summary-query error.**
- **`buyerrecon_app` is a login role and a member of
  `buyerrecon_scoring_worker`** — the only login member found.
- `buyerrecon_prod_collector_app` is **not** a member of
  `buyerrecon_scoring_worker`.
- `buyerrecon_prod_audit_readonly` is **not** a member of
  `buyerrecon_scoring_worker`.
- `buyerrecon_scoring_worker` remains **NOLOGIN**.
- **Do not treat this as a clean PASS** because the summary-count query failed.
- No role change occurred. No Stage 0 execution occurred. No runtime was
  authorized.

> Bounded note: `buyerrecon_app` being a login member is an **Option A
> candidate**, but its suitability for Stage 0 production execution (intended
> usage, credential custody, least-privilege fit) is a **separate planning
> decision** — not concluded by this membership fact alone. Do not assume the
> staging-era `buyerrecon_app` mapping is the approved production Stage 0
> execution identity without a separate review.

---

## 11. What Did Not Run

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

## 12. Next Gated Step

1. **Codex review and merge** of this evidence PR.
2. Then **decide whether a narrow corrected diagnostic / proof is needed**
   before Stage 0 execution planning — e.g. a corrected `SUMMARY_COUNTS_ONLY`
   query (the `missing FROM-clause entry for table "r"` shape error), and/or a
   review of whether `buyerrecon_app` is the approved production Stage 0
   execution identity (Option A) versus a dedicated login role (Option B).
3. Any role change remains gated: its own command-pack PR → Codex review →
   explicit Helen GO → execution → post-change proof.
4. **Stage 0 execution remains unauthorized** until the login/member-role path
   is resolved and proofed and a **separate explicit Stage 0 execution GO** is
   given.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column names, booleans, SQLSTATE/error-shape
text, or stop-line / boundary language — not row values or credential values.
No DSN/secret was printed by the diagnostic.
