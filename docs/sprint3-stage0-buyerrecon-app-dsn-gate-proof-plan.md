# Sprint 3 — `buyerrecon_app` DSN Role/Database Gate Proof — Command-Pack / GO Plan (Review-Only)

**Status:** `STAGE0_BUYERRECON_APP_DSN_GATE_PROOF_PLANNING_ONLY`

This is a **reviewable, docs-only command-pack / GO-planning record**. It plans
**one secret-safe, read-only role/database gate proof** for an approved
`buyerrecon_app` DSN — to confirm the DSN resolves to the approved Stage 0
execution identity **before** any Stage 0 rerun, **without running Stage 0**.

This PR **runs nothing**: no production command, no SQL, no DSN value in repo,
no secret edit, no `.env.production` mutation, no role change, no Stage 0 rerun.
The candidate commands below are **CANDIDATE ONLY — DO NOT RUN**. Execution
requires Codex review + merge of this PR **and** a separate explicit Helen GO for
the gate proof only.

> Provenance: PR #173 blocked evidence
> (`7062588519c3b4fdf9b1cd15403e38ad8d829848`,
> `STAGE0_EXECUTION_BLOCKED_UNEXPECTED_ROLE`); PR #174 DSN-binding resolution
> plan (`7beb316a08df3e2ad7ae878d720ed86b5dd7d746`,
> `STAGE0_EXECUTION_IDENTITY_DSN_RESOLUTION_PLANNING_ONLY`).

---

## 1. Title & Status

- Title: `buyerrecon_app` DSN Role/Database Gate Proof — Command-Pack / GO Plan.
- Status: `STAGE0_BUYERRECON_APP_DSN_GATE_PROOF_PLANNING_ONLY`.
- Review-only; not the proof execution; authorizes nothing.

---

## 2. Inputs / Prerequisite Chain

- **PR #173 — merged** (`7062588519c3b4fdf9b1cd15403e38ad8d829848`,
  `STAGE0_EXECUTION_BLOCKED_UNEXPECTED_ROLE`): the Stage 0 attempt stopped at the
  role gate because `APP_DSN` resolved to `buyerrecon_prod_collector_app`, not
  `buyerrecon_app`.
- **PR #174 — merged** (`7beb316a08df3e2ad7ae878d720ed86b5dd7d746`,
  `STAGE0_EXECUTION_IDENTITY_DSN_RESOLUTION_PLANNING_ONLY`): records Option A1/A2
  **only if** the approved `buyerrecon_app` DSN custody path is known/acceptable;
  Stage 0 rerun remains unauthorized.

---

## 3. Purpose & Bounded Scope

- **Purpose:** plan **one** secret-safe, **read-only** role/database gate proof
  for an approved `buyerrecon_app` DSN, to confirm it resolves to the approved
  Stage 0 execution identity in the expected production database — **without
  running Stage 0**.
- **Bounded scope:** this is an **identity/connection proof only**. It does not
  run the Stage 0 worker, performs no writes, and changes no roles/secrets.
- It **does not** authorize a Stage 0 rerun; a passing proof is a **precondition**
  for a later, separately-GO'd Stage 0 execution — not an execution trigger.

---

## 4. Required Proof Checks

The planned proof must verify (and emit only role/db facts / booleans):
- the **DSN is loaded without printing** (`APP_DSN_loaded=true`; value never
  echoed);
- `current_user=buyerrecon_app`;
- `current_database=buyerrecon_production`;
- `transaction_read_only=off`;
- `stage0:run` **still maps to** `tsx scripts/run-stage0-worker.ts`;
- **HEAD matches** the reviewed/merged chain;
- **no Stage 0 command runs** during the proof;
- **no** raw row values, raw identifiers, payload/customer data, or
  DSN/password/token printed.

---

## 5. Secret-Safe DSN Handling

- The approved `buyerrecon_app` DSN is provided/bound by Helen/admin into a
  **temporary env var on the production host** (e.g. `APP_DSN`) **without
  printing it** — its value is **never** placed in the repo, this doc, logs, or
  any artifact.
- No persistent `.env.production` mutation by the proof (a one-off,
  session-scoped binding); `APP_DSN` is `unset` afterward.
- The proof prints only booleans / role / database names — never the DSN, host,
  user password, or token.

---

## 6. Candidate Gate-Proof Commands — CANDIDATE ONLY — DO NOT RUN

> Not authorized by this PR. Requires Codex review + merge + a separate explicit
> Helen GO for the gate proof only. **Read-only**; one run; emits role/db facts
> / booleans only; **no Stage 0 command**.

```bash
# CANDIDATE ONLY — DO NOT RUN
# Preconditions: Codex PASS + merge + separate explicit Helen GO (gate proof only).
cd /opt/buyerrecon-backend

# (a) HEAD gate (must match the reviewed/merged chain):
git rev-parse HEAD            # expect the reviewed merged commit

# (b) Script-map gate (names only; no execution):
grep -n '"stage0:run"' package.json   # expect: "tsx scripts/run-stage0-worker.ts"

# (c) APP_DSN provided secret-safe by Helen/admin (never printed here):
[ -n "${APP_DSN:-}" ] && echo "APP_DSN_loaded=true" || { echo "APP_DSN_loaded=false"; exit 2; }
```

```sql
-- CANDIDATE ONLY — DO NOT RUN — role/database gate (booleans/names only)

-- (1) Pre-proof writable session/default gate (OUTSIDE any read-only block).
--     Proves the DSN/session can support the would-be Stage 0 run (writable),
--     without performing any write. Scalar/session settings only.
\echo '=== PRE_PROOF_WRITABLE_SESSION_GATE ==='
SELECT
  current_user AS gate_current_user,                                    -- expect: buyerrecon_app
  current_database() AS gate_database,                                  -- expect: buyerrecon_production
  current_setting('transaction_read_only') AS gate_transaction_read_only,           -- expect: off
  current_setting('default_transaction_read_only') AS gate_default_transaction_read_only; -- expect: off

-- (2) Protected read-only proof transaction (the actual proof query runs
--     read-only; ROLLBACK; no write, no Stage 0 command).
\echo '=== READ_ONLY_PROOF_TRANSACTION ==='
BEGIN;
SET LOCAL transaction_read_only = on;          -- hard read-only guard for the proof itself

SELECT
  current_user AS proof_current_user,                                  -- expect: buyerrecon_app
  current_database() AS proof_database,                                -- expect: buyerrecon_production
  current_setting('transaction_read_only') AS proof_transaction_read_only,           -- expect: on (proof stayed read-only)
  current_setting('default_transaction_read_only') AS proof_default_transaction_read_only; -- expect: off

ROLLBACK;
```

Safe design: the **session/default writable gate** (step 1) is captured
**outside** any read-only block and must show
`gate_transaction_read_only=off` / `gate_default_transaction_read_only=off`
(proving the DSN/session can support the later Stage 0 write); the **protected
proof transaction** (step 2) is read-only and must show
`proof_transaction_read_only=on` (proving the proof itself performed no write).
**Do not** claim the proof transaction itself has `transaction_read_only=off`.

> Note on `transaction_read_only`: the **Stage 0 runtime** requires
> `transaction_read_only=off` (it writes `stage0_decisions`). The **proof
> transaction** above is read-only by design and is **not** the Stage 0 run. The
> proof must therefore confirm the *session/connection* default is writable
> (`SHOW default_transaction_read_only` → `off`, captured outside the
> `SET LOCAL` block) so the later Stage 0 run can write — while the proof itself
> performs no write. (The operator records the session default as
> `transaction_read_only=off` per §4, distinct from the `SET LOCAL` guard used
> only to protect the proof.)

After the checks: `unset APP_DSN`. The proof runs **no** `npm run stage0:run`.

---

## 7. Expected Proof Evidence (for the future evidence PR)

A future docs-only **gate-proof evidence PR** (after its own GO) must record
(booleans / names only), distinguishing the **pre-proof writable session gate**
from the **protected read-only proof transaction**:
- `APP_DSN_loaded=true` (value not printed);
- **Pre-proof writable session/default gate** (outside the read-only block):
  - `gate_current_user=buyerrecon_app`;
  - `gate_database=buyerrecon_production`;
  - `gate_transaction_read_only=off` (session can support the would-be Stage 0
    write);
  - `gate_default_transaction_read_only=off`;
- **Protected read-only proof transaction:**
  - `proof_current_user=buyerrecon_app`;
  - `proof_database=buyerrecon_production`;
  - `proof_transaction_read_only=on` (the proof itself stayed read-only);
- `stage0_run_maps_to=tsx scripts/run-stage0-worker.ts`;
- `head_matches_reviewed_chain=true`;
- `stage0_command_run=false`;
- `no_dsn_secret_printed=true`, `no_row_values_printed=true`,
  `no_raw_identifier_printed=true`;
- and an explicit "Stage 0 rerun still requires a separate explicit GO" note.

Do **not** claim the proof transaction itself has `transaction_read_only=off`;
the writable state is proven by the **pre-proof gate**
(`gate_transaction_read_only=off`), and the proof transaction is intentionally
`proof_transaction_read_only=on`.

If any check fails (e.g. `current_user` is not `buyerrecon_app`), the proof
records a **blocked** state and Stage 0 rerun remains unauthorized.

---

## 8. Stop-Lines (future proof execution)

Abort the gate proof if any of the following:
- any DSN / password / token would be printed or exposed;
- the DSN resolves to `buyerrecon_prod_collector_app`;
- the DSN resolves to `postgres` or any superuser;
- the DSN resolves to any role **other than** `buyerrecon_app`;
- the database is not `buyerrecon_production`;
- the DSN cannot be loaded without exposing it;
- `.env.production` would need ad hoc mutation;
- a role change / grant / SQL fix / permission fix would be needed;
- any `npm run stage0:run` (or other Stage 0 command) would run during the proof;
- more than one proof run would be attempted in this gate;
- any downstream runtime would be bundled;
- raw row values, raw identifiers, payload/customer data would be printed.

If a stop-line is hit, record the blocked state in a docs-only evidence PR before
any further action.

---

## 9. Explicit Non-Authorization

This PR is **docs-only / planning-only** and authorizes **none** of:
- no DSN value in repo; no DSN change by this PR; no secret edit; no
  `.env.production` mutation;
- no diagnostic rerun by this PR;
- no production command; no SQL execution; no role change; no grant;
- no `ALTER ROLE`; no `GRANT role TO role`; no GRANT/DML/DDL; no permission fix;
- no Stage 0 rerun; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F; no downstream runtime.

---

## 10. Next Step After This PR

1. **Codex review and merge** of this command-pack / GO-planning PR.
2. **Helen confirms the approved `buyerrecon_app` DSN custody path** and issues a
   **separate explicit GO for the gate proof only**.
3. **One** secret-safe, read-only gate-proof run (the §6 candidate) → **docs-only
   gate-proof evidence PR** (§7).
4. **Only if the proof passes** (`current_user=buyerrecon_app` etc.) does a
   **separate explicit Stage 0 execution GO** become available for the next
   gated Stage 0 run.
5. **No Stage 0 rerun** is authorized until the gate proof passes, is reviewed,
   and a separate explicit Stage 0 execution GO is given. (If the approved
   `buyerrecon_app` DSN custody is unavailable/unacceptable, fall back to PR #174
   Option B — a dedicated Stage 0 login role.)

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / database / relation names, env-var names, SQL identifiers,
the masked `npm run stage0:run` / `tsx scripts/run-stage0-worker.ts` mapping, or
stop-line / boundary language — not secret or row values. The approved
`buyerrecon_app` DSN is bound secret-safe at proof time, loaded from its managed
secret path / env only, and **never printed** or committed.
