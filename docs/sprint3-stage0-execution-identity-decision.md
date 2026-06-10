# Sprint 3 — Stage 0 Execution-Identity Decision

**Status:** `STAGE0_EXECUTION_IDENTITY_DECISION_PLANNING_ONLY`

This is a **docs-only decision / planning record**. It decides whether
`buyerrecon_app` is acceptable as the production Stage 0 execution identity, or
whether a dedicated Stage 0 login role is still required, after the corrected
login-member diagnostic PASS (PR #171).

This PR **runs no Stage 0, changes no roles, and runs no SQL.** It records a
recommendation only; execution remains separately GO-gated.

> Provenance: PR #167 (`a0457d0dd55b10d358283792a6faa7e0a0dabe08`,
> `STAGE0_READ_SOURCE_SELECT_GRANT_PROOF_PASS`); PR #168
> (`4a253fc20f9865c028c4e34d5ec3e7d19f14b864`,
> `STAGE0_LOGIN_MEMBER_ROLE_PATH_PLANNING_ONLY`); PR #169
> (`3b8ece6230f79e669aad80d528f84b351b49c74b`,
> `STAGE0_LOGIN_MEMBER_READONLY_DIAGNOSTIC_EXECUTED_WITH_SUMMARY_QUERY_ERROR`);
> PR #170 (`8e2655dd2a21d64b33a8358714e1833a79411d1a`,
> `STAGE0_LOGIN_MEMBER_CORRECTED_DIAGNOSTIC_PLANNING_ONLY`); PR #171
> (`622066588ec8698b2138d48f97e04c033ef1eafb`,
> `STAGE0_CORRECTED_LOGIN_MEMBER_READONLY_DIAGNOSTIC_PASS`).

---

## 1. Title & Status

- Title: Stage 0 Execution-Identity Decision.
- Status: `STAGE0_EXECUTION_IDENTITY_DECISION_PLANNING_ONLY`.
- Decision/planning only; no execution; no role change.

---

## 2. Inputs / Prerequisite Chain

- PR #167 — read-source SELECT grant **proof PASS** for
  `buyerrecon_scoring_worker`.
- PR #168 — login/member-role path plan (Option B role selected:
  `buyerrecon_scoring_worker`; login path to resolve).
- PR #169 — login-member diagnostic (membership evidence; summary-query error).
- PR #170 — corrected diagnostic plan / command pack.
- PR #171 — corrected login-member diagnostic **PASS** (clean exit 0,
  read-only, ROLLBACK).

---

## 3. Proven Technical State (after PR #171)

- `buyerrecon_app` is the **only inspected login role** that is a member of
  `buyerrecon_scoring_worker` (production-observed, not a staging assumption).
- `buyerrecon_app` can **reach all proven Stage 0 privileges**:
  `accepted_events SELECT`, `ingest_requests SELECT`,
  `stage0_decisions INSERT/UPDATE/SELECT` — confirmed via membership booleans
  and a read-only `SET ROLE buyerrecon_app` reachability proof.
- `buyerrecon_scoring_worker` remains **NOLOGIN**.
- Corrected diagnostic passed cleanly (exit 0, read-only, ROLLBACK, no COMMIT).
- Stage 0 has not run; no role change occurred.

---

## 4. Remaining Decision

Technical reachability is **proven**. The remaining decision is an
**identity-approval** one: is `buyerrecon_app` the appropriate **production
Stage 0 execution identity** for a gated run, or should a **dedicated Stage 0
login role** be created first? Reachability ≠ approval.

---

## 5. Suitability Criteria

1. **Technical reachability** — **PASS** (PR #171): `buyerrecon_app` reaches all
   Stage 0 privileges via `buyerrecon_scoring_worker` membership.
2. **Intended use / role purpose** — `buyerrecon_app` is the app/extractor login
   role; it is also a member of `buyerrecon_scoring_worker`. Running a
   scoring-stage worker under it is consistent with that membership but **mixes**
   the app/extractor identity with the scoring-stage worker identity.
3. **Credential custody** — `buyerrecon_app` is a managed login role with an
   existing DSN/credential under the established secret-handling posture (DSN
   never printed). (Distinct from `buyerrecon_prod_collector_app`, whose
   password the operator does not hold.)
4. **Least-privilege fit** — `buyerrecon_app` inherits `buyerrecon_scoring_worker`
   (proven). It **may** also hold other group memberships (e.g. migrator) per
   the staging mapping pattern; the corrected diagnostic confirmed
   scoring-worker membership but did not enumerate **all** of its memberships.
   This is the **main least-privilege caveat** for Option A.
5. **Separation of duties** — using `buyerrecon_app` keeps one login role for
   app/extractor **and** Stage 0; a dedicated role would keep these separate.
6. **Operational simplicity vs role purity** — Option A is simplest (no role
   change, uses proven reachability); Option B is purer (dedicated minimal
   Stage 0 login role) at the cost of an extra gated role-change chain.
7. **Staging-vs-production** — the `buyerrecon_app ← buyerrecon_scoring_worker`
   membership is now **production-observed** (PR #171), so this is no longer a
   staging-only assumption for membership; intended-use purity (criterion 4/5)
   remains the open consideration.
8. **Dedicated role necessity** — not technically required for a Stage 0 run
   (reachability proven); it is a **role-purity / least-privilege** preference,
   not a functional blocker.

---

## 6. Options Table

| Option | Description | Assessment |
|---|---|---|
| **A** | Approve `buyerrecon_app` as the production Stage 0 execution identity **for this gated run** (Stage 0-only scope), on proven reachability + accepted custody/intended-use review | **Recommended (scoped)** — see §7. Not broad approval for any other worker. |
| **B** | Require a **dedicated Stage 0 login role** (member of `buyerrecon_scoring_worker` only) before execution | **Viable alternative** — purer least-privilege; choose if the §5.4 membership-breadth caveat is unacceptable. Requires its own command-pack → review → GO → proof. |
| **C** | `postgres` / superuser runtime | **Reject** — no superuser for runtime workers. |
| **D** | `buyerrecon_prod_collector_app` | **Reject** — prior rejection (PR #164); not a member of `buyerrecon_scoring_worker`; operator lacks its password. Unless a separate reviewed plan reverses this. |
| **E** | Run Stage 0 before the identity decision | **Reject** — identity must be decided first. |

---

## 7. Recommended Decision

**Recommend Option A — approve `buyerrecon_app` as the Stage 0 execution
identity for this single gated run, scoped to Stage 0 only.** Basis:
- technical reachability is proven (PR #171) and `buyerrecon_app` is the only
  login member of `buyerrecon_scoring_worker`;
- custody is acceptable (managed login role; DSN never printed);
- it avoids an extra role-change chain for the immediate gated run.

**Scope limitation (important):** this is **not** broad approval for all future
workers or any other runtime. It is limited to **Stage 0 execution under the
current evidence chain**, one gated run, with post-run evidence. Any other
worker/runtime identity remains a separate decision.

**Least-privilege caveat to record:** `buyerrecon_app` may carry additional
group memberships beyond `buyerrecon_scoring_worker` (not fully enumerated). If
the team requires strict role purity for the scoring stage, prefer **Option B**
(dedicated Stage 0 login role) instead — both are acceptable; Option A is the
recommended pragmatic path for the immediate gated run, Option B is the purer
long-term posture. **Final call rests with Helen at the execution GO.**

---

## 8. Conditions Before Stage 0 Execution (if Option A is accepted)

1. **Codex review and merge** of this decision PR.
2. **Separate explicit Helen GO** for Stage 0 execution.
3. Use the **exact command** from PR #162:
   `DATABASE_URL="$APP_DSN" npm run stage0:run`
4. **Secret-safe DSN loading** (`DATABASE_URL`-only parse into `APP_DSN`; never
   printed; `APP_DSN` unset afterward).
5. **One execution only.**
6. **Stop if** the role/database gate is unexpected (must be the approved login
   identity in `buyerrecon_production`).
7. **Stop if** output would print secrets / raw payloads / raw identifiers.
8. **No** risk / POI / evidence snapshot / Lane / scoring / AMS / customer /
   Gate runtime bundled.
9. A **docs-only Stage 0 execution evidence PR** afterward (masked summary /
   counts only).

(If **Option B** is chosen instead: dedicated login-role command-pack PR →
Codex review → explicit Helen GO → role change → post-change proof → then a
separate Stage 0 execution GO.)

---

## 9. Stop-Lines

- no Stage 0 execution by this PR;
- no role change; no `ALTER ROLE`; no `GRANT role TO role`;
- no SQL / production command by this PR; no GRANT/DML/DDL; no permission fix;
- no use of `postgres` / superuser as the Stage 0 runtime identity;
- no use of `buyerrecon_prod_collector_app` for Stage 0 without a separate
  reviewed reversal;
- no broad approval of `buyerrecon_app` beyond this Stage 0 gated run;
- no bundling Stage 0 with risk/POI/evidence-snapshot/Lane/scoring/AMS/customer
  output/Gate 4E/4F;
- no secrets / DSN / password / token printed; no raw row values, raw
  identifiers, payload/customer data.

Any future Stage 0 execution attempt must **stop immediately** if any of the
following occur:

- branch, base branch, or HEAD does not match the reviewed and merged
  decision/evidence chain;
- execution role is not the approved Stage 0 execution identity from this
  decision path;
- database is not the expected production database;
- DSN cannot be loaded without printing or exposing it;
- Stage 0 command differs from the reviewed command:
  `DATABASE_URL="$APP_DSN" npm run stage0:run`;
- more than one Stage 0 execution would be attempted;
- Stage 0 command exits non-zero;
- any permission error occurs;
- any ad hoc grant, role change, SQL fix, or permission fix is needed;
- output prints secrets, DSN, password, token, raw row values, raw identifiers,
  payload data, or customer data;
- any risk worker, POI worker, evidence snapshot, Lane A/B preview/write,
  scoring runtime, AMS Trust/Pass runtime, customer output, Gate 4E, or Gate 4F
  action is bundled into the same execution;
- this decision PR is treated as Stage 0 execution authorization.

If any stop-line is hit, record the blocked state in a separate docs-only
evidence PR before taking any further action.

---

## 10. Explicit Non-Authorization

This PR is **docs-only / decision-only** and authorizes **none** of:
- no production command; no SQL; no role change; no GRANT / ALTER ROLE / DML /
  DDL; no permission fix;
- no Stage 0 execution; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F.

---

## 11. Next Step After This PR

1. **Codex review and merge** of this decision PR.
2. **Helen decides** Option A (approve `buyerrecon_app`, scoped) or Option B
   (dedicated Stage 0 login role) at the execution GO.
3. **If Option A:** separate explicit Stage 0 execution GO → one gated run (per
   §8) → docs-only Stage 0 execution evidence PR.
4. **If Option B:** dedicated login-role command-pack PR → Codex review →
   explicit Helen GO → role change → post-change proof → separate Stage 0
   execution GO → one gated run → evidence PR.
5. **Stage 0 execution remains separately GO-gated** and unauthorized until the
   chosen path completes its gates.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column names, SQL identifiers, the masked
`DATABASE_URL="$APP_DSN" npm run stage0:run` command example, or stop-line /
boundary language — not row values or credential values. The DSN is parsed from
`DATABASE_URL` only and never printed.
