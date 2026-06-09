# Sprint 3 — Stage 0 Corrected Login-Member Diagnostic / Execution-Identity Suitability Plan

**Status:** `STAGE0_LOGIN_MEMBER_CORRECTED_DIAGNOSTIC_PLANNING_ONLY`

This is a **docs-only planning / command-pack record**. It plans a **narrow,
corrected read-only diagnostic** (fixing the prior summary-query error) and the
**execution-identity suitability decision** for Stage 0, before any Stage 0
execution.

This PR **executes nothing**: no diagnostic rerun, no SQL, no role change, no
Stage 0. Any command pack below is **CANDIDATE ONLY — DO NOT RUN**.

> Provenance: PR #168 login/member-role path plan
> (`4a253fc20f9865c028c4e34d5ec3e7d19f14b864`); PR #169 login-member diagnostic
> evidence (`3b8ece6230f79e669aad80d528f84b351b49c74b`, status
> `STAGE0_LOGIN_MEMBER_READONLY_DIAGNOSTIC_EXECUTED_WITH_SUMMARY_QUERY_ERROR`).

---

## 1. Title & Status

- Title: Stage 0 Corrected Login-Member Diagnostic / Execution-Identity
  Suitability Plan.
- Status: `STAGE0_LOGIN_MEMBER_CORRECTED_DIAGNOSTIC_PLANNING_ONLY`.
- Planning / command-pack only; authorizes no diagnostic, role change, or
  execution.

---

## 2. Inputs / Prerequisite Chain

- **PR #168 — merged** (`4a253fc20f9865c028c4e34d5ec3e7d19f14b864`,
  `STAGE0_LOGIN_MEMBER_ROLE_PATH_PLANNING_ONLY`): recommended a read-only
  role-membership diagnostic to pick Option A (existing login member) vs Option
  B (dedicated login role).
- **PR #169 — merged** (`3b8ece6230f79e669aad80d528f84b351b49c74b`,
  `STAGE0_LOGIN_MEMBER_READONLY_DIAGNOSTIC_EXECUTED_WITH_SUMMARY_QUERY_ERROR`):
  produced membership evidence but exited non-zero on a summary-query shape
  error.

---

## 3. PR #169 Useful Evidence (carried forward)

Role names / booleans only (valid; emitted before the failing summary query):
- `buyerrecon_app` — login role: **true**; member of `buyerrecon_scoring_worker`:
  **true** (only login member found).
- `buyerrecon_prod_collector_app` — login: true; member: **false**.
- `buyerrecon_prod_audit_readonly` — login: true; member: **false**.
- `buyerrecon_scoring_worker` — login: **false** (NOLOGIN); is the scoring-worker
  group role itself.

---

## 4. PR #169 Diagnostic Limitation

- **What failed:** the final `SUMMARY_COUNTS_ONLY` query failed with
  `ERROR: missing FROM-clause entry for table "r"` — a **query-shape error**
  (an aggregate/summary referencing an unqualified alias `r` without a matching
  `FROM pg_roles r`). It is **not** an extractor or privilege finding.
- Exit code `3`; `ON_ERROR_STOP=1` halted the psql script at the error, so the
  explicit `ROLLBACK` line was not printed. The transaction was read-only with
  no write statements.
- **Recorded as executed-with-summary-query-error — not a clean PASS.** The
  membership inventory itself is valid; only the trailing summary aggregation
  failed.

---

## 5. Corrected Diagnostic Objective

- Re-run the **same read-only membership inventory** with the
  **`SUMMARY_COUNTS_ONLY` query corrected** (proper `FROM pg_roles r`), so the
  diagnostic completes cleanly (exit 0, explicit `ROLLBACK`).
- **Prove `buyerrecon_app` can safely reach `buyerrecon_scoring_worker`
  privileges** via role membership (membership boolean, and optionally a
  read-only `SET ROLE` reachability check) — **without running Stage 0**.
- Output the evidence needed to make the Option A vs Option B identity decision.

---

## 6. Candidate Corrected Diagnostic Command Pack — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO. Read-only; role names / booleans only; no row data; no secrets; no
> role change; one run.

```sql
-- CANDIDATE ONLY — DO NOT RUN — read-only role-membership diagnostic (corrected)
BEGIN;
  SET LOCAL transaction_read_only = on;        -- hard read-only guard
  SET LOCAL statement_timeout = '15s';

  -- (a) scoring worker role gate
  SELECT rolname, rolcanlogin
  FROM pg_roles
  WHERE rolname = 'buyerrecon_scoring_worker';        -- expect rolcanlogin=false

  -- (b) login roles + membership booleans (names/booleans only)
  SELECT r.rolname,
         r.rolcanlogin,
         pg_has_role(r.rolname, 'buyerrecon_scoring_worker', 'MEMBER') AS member_of_scoring_worker
  FROM pg_roles r
  WHERE r.rolname LIKE 'buyerrecon\_%'
  ORDER BY r.rolname;

  -- (c) CORRECTED summary counts (note the proper FROM pg_roles r — the prior
  --     run failed here with: missing FROM-clause entry for table "r")
  SELECT
    count(*) FILTER (WHERE r.rolcanlogin)                                           AS login_role_count,
    count(*) FILTER (WHERE pg_has_role(r.rolname,'buyerrecon_scoring_worker','MEMBER')) AS scoring_worker_member_count,
    count(*) FILTER (WHERE r.rolcanlogin
                       AND pg_has_role(r.rolname,'buyerrecon_scoring_worker','MEMBER')) AS login_member_count
  FROM pg_roles r
  WHERE r.rolname LIKE 'buyerrecon\_%';

  -- (d) OPTIONAL reachability check (read-only; no Stage 0, no writes):
  --     SET ROLE buyerrecon_app;  -- session_user remains the operator
  --     SELECT current_user,
  --            pg_has_role(current_user,'buyerrecon_scoring_worker','MEMBER') AS reaches_scoring_worker;
  --     -- optionally then SET ROLE buyerrecon_scoring_worker (only if membership allows)
  --     -- and probe has_table_privilege booleans for the Stage 0 surfaces
  --     -- (accepted_events/ingest_requests SELECT; stage0_decisions INSERT/UPDATE/SELECT)
  --     -- as the current role — booleans only, NO INSERT/UPDATE executed.
  --     RESET ROLE;
ROLLBACK;                                              -- no COMMIT; no writes
```

Output: role names + booleans + counts only — **no row values, no raw
identifiers, no secrets, no DSN/password/token**. No Stage 0 execution; no
writes; no role change.

---

## 7. `buyerrecon_app` Suitability Criteria (review before approving as Stage 0 identity)

Before approving `buyerrecon_app` as the **production Stage 0 execution
identity**, review:
- **Membership reachability:** corrected diagnostic proves `buyerrecon_app` is a
  member of `buyerrecon_scoring_worker` and can reach the proven Stage 0
  privileges (directly or via `SET ROLE`).
- **Intended use / role purpose:** is `buyerrecon_app` the appropriate runtime
  identity for a scoring-stage worker, or is it the app/extractor login role
  with a broader purpose? (Staging mapped it to `scoring_worker`; production
  intent must be confirmed, not assumed from staging.)
- **Least-privilege fit:** does `buyerrecon_app` carry **only** the memberships
  appropriate for Stage 0, or does it also inherit other groups (e.g.
  `buyerrecon_migrator`) that would over-privilege the Stage 0 runtime?
- **Credential custody:** who holds the `buyerrecon_app` DSN/credential; is it
  managed under the same secret-handling posture; is it distinct from the
  collector credential.
- **Separation of duties:** does using `buyerrecon_app` blur collector vs
  scoring-worker boundaries in production.

If any criterion is unclear or fails, prefer **Option B** (dedicated Stage 0
login role).

---

## 8. Option A / Option B Decision Frame

| Option | Description | Assessment |
|---|---|---|
| **A** | `buyerrecon_app` as the production Stage 0 execution login member | **Acceptable only if** the corrected diagnostic proves membership/role reachability **and** the §7 custody/intended-use review accepts it. |
| **B** | Create / use a **dedicated Stage 0 login role** (member of `buyerrecon_scoring_worker` only) | **Preferred if** `buyerrecon_app` is unsuitable or custody/intended-use is unclear. Requires its own command-pack + review + explicit GO + proof. |
| **C** | `postgres` / superuser runtime | **Reject** — no superuser for runtime workers. |
| **D** | `buyerrecon_prod_collector_app` | **Reject** unless a separate reviewed plan reverses the prior rejection (PR #164); also not a member of `buyerrecon_scoring_worker`. |
| **E** | Run Stage 0 before identity proof | **Reject** — identity must be resolved/proofed first. |

This PR does **not** choose; the corrected diagnostic evidence + §7 review feed
the decision in a later PR.

---

## 9. Stop-Lines

- no diagnostic rerun by this PR;
- no role change; no `ALTER ROLE`; no `GRANT role TO role`;
- no SQL execution by this PR; no production command by this PR;
- no GRANT/DML/DDL; no permission fix;
- no Stage 0 execution; no extractor/worker/downstream runtime;
- the corrected diagnostic (when later authorized) must stay **read-only**
  (`transaction_read_only=on`, `ROLLBACK`, no COMMIT), names/booleans/counts
  only, with **no** `SET ROLE … ` that performs any write and **no** Stage 0;
- no superuser used as the Stage 0 runtime identity;
- no reuse of `buyerrecon_prod_collector_app` for Stage 0 without a separate
  reviewed reversal;
- no assumption that the staging `buyerrecon_app` mapping is the approved
  production identity;
- no secrets / DSN / password / token printed; no raw row values, raw
  identifiers, payload/customer data.

---

## 10. Explicit Non-Authorization

This PR is **docs-only / planning-only** and authorizes **none** of:
- no production command; no SQL; no diagnostic rerun; no role change;
- no GRANT / ALTER ROLE / GRANT role TO role / DML / DDL; no permission fix;
- no Stage 0 execution; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F.

---

## 11. Next Step After This PR

1. **Codex review and merge** of this planning PR.
2. **Separate explicit Helen GO** for **one** corrected read-only diagnostic
   (the §6 command pack).
3. **Docs-only corrected diagnostic evidence PR** afterward (names/booleans/
   counts only; clean exit + ROLLBACK).
4. **Then decide** `buyerrecon_app` acceptable (Option A) vs dedicated login-role
   command-pack needed (Option B), using §7 criteria.
5. Any role change requires its own command-pack PR → Codex review → explicit
   Helen GO → execution → post-change proof.
6. **Stage 0 execution remains separately GO-gated** and unauthorized until the
   identity is resolved and proofed.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column names, SQL identifiers, role-membership
concepts, SQLSTATE/error-shape text, or stop-line / boundary language — not row
values or credential values. The candidate SQL is fenced
`CANDIDATE ONLY — DO NOT RUN` and emits names/booleans/counts only; any future
DSN is parsed from `DATABASE_URL` only and never printed.
