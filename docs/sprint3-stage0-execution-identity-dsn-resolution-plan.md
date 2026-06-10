# Sprint 3 — Stage 0 Execution-Identity / DSN-Binding Resolution Plan

**Status:** `STAGE0_EXECUTION_IDENTITY_DSN_RESOLUTION_PLANNING_ONLY`

This is a **docs-only planning record**. It plans the safe resolution of the
pre-execution identity / DSN-binding mismatch that blocked the Stage 0 run
(PR #173), before any rerun.

This PR **changes no DSN, edits no secret, mutates no `.env.production`, changes
no roles, runs no SQL, and reruns no Stage 0.** It records a plan only;
execution remains separately GO-gated.

> Provenance: PR #172 execution-identity decision
> (`5d9bf66489eb696f7fd1b1098b1874f7126478e0`,
> `STAGE0_EXECUTION_IDENTITY_DECISION_PLANNING_ONLY`); PR #173 blocked evidence
> (`7062588519c3b4fdf9b1cd15403e38ad8d829848`,
> `STAGE0_EXECUTION_BLOCKED_UNEXPECTED_ROLE`).

---

## 1. Title & Status

- Title: Stage 0 Execution-Identity / DSN-Binding Resolution Plan.
- Status: `STAGE0_EXECUTION_IDENTITY_DSN_RESOLUTION_PLANNING_ONLY`.
- Planning only; no DSN change, secret edit, role change, or execution.

---

## 2. Inputs / Prerequisite Chain

- **PR #172 — merged** (`5d9bf66489eb696f7fd1b1098b1874f7126478e0`,
  `STAGE0_EXECUTION_IDENTITY_DECISION_PLANNING_ONLY`): scoped **Option A**
  approved `buyerrecon_app` as the Stage 0 execution identity for **one gated
  run only** (not broad approval).
- **PR #173 — merged** (`7062588519c3b4fdf9b1cd15403e38ad8d829848`,
  `STAGE0_EXECUTION_BLOCKED_UNEXPECTED_ROLE`): the authorized attempt stopped at
  the role gate — `STOP_LINE: unexpected execution role`.

---

## 3. Blocked Attempt Recap

After PR #172 merged, Helen issued the explicit Stage 0 execution GO authorizing
exactly one production Stage 0 execution only if the reviewed gates passed.

- Pre-execution gates synced to PR #172 merge; `APP_DSN` loaded without
  printing; `stage0:run` present → `tsx scripts/run-stage0-worker.ts`.
- Role/database gate observed:
  - `current_user=buyerrecon_prod_collector_app`
  - `current_database=buyerrecon_production`
  - `transaction_read_only=off`
- Expected execution role: `buyerrecon_app`.
- **`STOP_LINE: unexpected execution role`** triggered; Stage 0 did not run;
  `npm run stage0:run` not reached; run lock not touched; the one authorized
  execution was **not** consumed.

---

## 4. Known Safe Facts (technical work succeeded)

- Read-source SELECT grants proofed for `buyerrecon_scoring_worker` (PR #167).
- `buyerrecon_app` is the only login member of `buyerrecon_scoring_worker`
  (PR #171) and can reach all proven Stage 0 privileges
  (`accepted_events`/`ingest_requests` SELECT; `stage0_decisions`
  INSERT/UPDATE/SELECT).
- `buyerrecon_scoring_worker` remains NOLOGIN.
- The role gate (PR #172 §9) worked as designed — it refused to run under an
  unapproved identity.
- This is **not** a Stage 0 runtime failure, **not** a permission failure inside
  Stage 0, and **not** evidence that Stage 0 code is broken.

---

## 5. Remaining Gap

The operator's current `APP_DSN` is bound to **`buyerrecon_prod_collector_app`**,
**not** the approved `buyerrecon_app` execution identity. The remaining gap is
purely **execution-identity custody / DSN binding** — obtaining/binding the
correct `buyerrecon_app` DSN safely (or choosing a dedicated login role) before
any rerun.

---

## 6. Resolution Options

### Option A1 — obtain/bind the approved `buyerrecon_app` production DSN safely
- Identify the correct **secret/custody path** for the `buyerrecon_app` DSN.
- **Never print** the DSN / password / token.
- Load it into a **dedicated shell variable / temporary environment path** for
  the gated run only (no persistent `.env.production` mutation unless separately
  reviewed).
- Prove via a **read-only role/database gate** that it resolves to:
  - `current_user=buyerrecon_app`
  - `current_database=buyerrecon_production`
  - `transaction_read_only=off`
- Then require a **separate explicit Helen Stage 0 execution GO** before running.

### Option A2 — one-off secret-safe operator handoff path
- Helen/admin manually provides or binds the approved `buyerrecon_app` DSN into a
  **temporary env var on the production host without printing it**.
- Run **only the read-only role/database gate first**.
- If the gate passes, **stop and record proof**, or proceed only under a
  separate explicit Stage 0 execution GO (per the chosen plan).
- **No persistent `.env.production` mutation** unless separately reviewed.

### Option B — reopen the dedicated Stage 0 login-role path
- If `buyerrecon_app` DSN custody is **unavailable, unclear, or not acceptable**.
- Create a **dedicated Stage 0 login role**, **member of
  `buyerrecon_scoring_worker` only**.
- Via a separate command-pack → Codex review → explicit Helen GO → role change →
  post-change proof → then a separate Stage 0 execution GO.

### Rejected
- using `buyerrecon_prod_collector_app`;
- using `postgres` / superuser runtime;
- mutating `.env.production` ad hoc;
- editing secrets without review;
- granting roles ad hoc;
- rerunning Stage 0 before identity/DSN binding is resolved;
- treating PR #173 as permission to rerun.

---

## 7. Recommended Resolution Path

- **Prefer Option A1 only if** the approved `buyerrecon_app` DSN custody path is
  **known and acceptable** (a managed secret path exists and can be loaded
  secret-safe).
- **Otherwise prefer Option B** (dedicated Stage 0 login role) — do **not** force
  Option A if DSN custody is unclear.
- **Option A2** is a viable variant of A1 when custody is held by Helen/admin and
  a one-off secret-safe handoff is preferred over a managed secret path.
- The choice depends on **where the approved `buyerrecon_app` credential lives
  and whether it can be loaded without exposure** — a custody question for Helen
  to confirm; this plan does not assume it.

---

## 8. Required Pre-Rerun Proof

Before any Stage 0 rerun, a **secret-safe read-only role/database gate** must
prove:
- DSN loaded **without printing**;
- `current_user=buyerrecon_app` (Option A) **or** the approved dedicated login
  role (Option B);
- `current_database=buyerrecon_production`;
- `transaction_read_only=off`;
- `stage0:run` still maps to `tsx scripts/run-stage0-worker.ts`;
- HEAD matches the reviewed/merged chain;
- **no Stage 0 command has run during the proof** unless separately authorized.

This proof is itself separately GO-gated and recorded in a docs-only evidence
PR; it does **not** run Stage 0.

---

## 9. Stop-Lines

Abort the resolution / pre-rerun proof / any rerun if any of the following:
- any DSN / password / token would be printed;
- the DSN resolves to `buyerrecon_prod_collector_app`;
- the DSN resolves to `postgres` or any superuser;
- the DSN resolves to any role **other than** the approved Stage 0 execution
  identity;
- the database is not `buyerrecon_production`;
- the DSN cannot be loaded without exposing it;
- `.env.production` would need ad hoc mutation;
- a role change / grant / SQL fix / permission fix would be needed;
- a Stage 0 command would be run **before** the proof;
- more than one execution would be attempted;
- downstream runtime would be bundled;
- raw row values, raw identifiers, payload/customer data would be printed.

If any stop-line is hit, record the blocked state in a separate docs-only
evidence PR before further action.

---

## 10. Explicit Non-Authorization

This PR is **docs-only / planning-only** and authorizes **none** of:
- no diagnostic rerun by this PR;
- no production command; no SQL; no DSN change; no secret edit; no
  `.env.production` mutation;
- no role change; no `ALTER ROLE`; no `GRANT role TO role`; no GRANT/DML/DDL; no
  permission fix;
- no Stage 0 rerun; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F; no downstream runtime.

---

## 11. Next Step After This PR

1. **Codex review and merge** of this planning PR.
2. **Helen confirms the `buyerrecon_app` DSN custody path** → choose **Option A1
   / A2** (if custody known/acceptable) or **Option B** (dedicated login role).
3. **If Option A1/A2:** a separately-GO'd, secret-safe **read-only role/database
   gate proof** (per §8) → docs-only proof evidence PR → then a **separate
   explicit Stage 0 execution GO**.
4. **If Option B:** dedicated login-role command-pack PR → Codex review →
   explicit Helen GO → role change → post-change proof → then a **separate Stage
   0 execution GO**.
5. **No Stage 0 rerun** is authorized until the identity/DSN binding is resolved,
   proven via the §8 gate, and a separate explicit Stage 0 execution GO is given.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / database / relation names, env-var names, SQL identifiers,
the masked `DATABASE_URL="$APP_DSN" npm run stage0:run` command example,
role/gate facts, or stop-line / boundary language — not secret or row values.
Any future DSN is loaded from its managed secret path / `DATABASE_URL` only and
never printed.
