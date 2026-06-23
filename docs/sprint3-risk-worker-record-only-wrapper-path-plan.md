# Sprint 3 — Minimal Risk-Worker RECORD_ONLY Wrapper Path — Planning (Docs-Only)

**Status:** `RISK_WORKER_RECORD_ONLY_WRAPPER_PATH_PLANNING_ONLY`

This is a **docs-only planning record**. It defines a future minimal, reviewed
RECORD_ONLY wrapper / flag / code path that would make risk-worker capture
**provably non-writing** before any future capture GO is reconsidered — after two
read-only inspection passes (PR #338, PR #340) both landed
`inspection_result=inconclusive`.

This PR **plans only**. It does **not** implement any wrapper/flag/code, edit any
source/scripts/package/runtime/config/DSN/secret/schema/migration/deploy/env/
worker/extractor/Lane/scoring/AMS/customer-output file, run the worker, run any
classifier, run a capture, read/`cat`/`grep`/copy any old or new
`run.err`/`run.safe.out`, run SQL/psql, mutate the DB, apply any fix, install
tools, or run Lane/scoring/AMS/customer output/Gate4E/Gate4F.

---

## 1. Current trusted base

```text
base_branch=sprint2-architecture-contracts-d4cc2bf
trusted_base=79f6abecd76098831ff6c0f0a45cb107974a7c0f
```

---

## 2. Evidence chain (carry-forward)

```text
PR #338: repo-only command-contract inspection evidence merged; inspection_result=inconclusive.
PR #340: precise import-chain inspection evidence merged; inspection_result=inconclusive.
Two read-only inspection passes failed to prove RECORD_ONLY execution from current source.
Current blocker: RECORD_ONLY control / gating cannot be proven from current source.
Capture GO remains blocked.
Runtime cause remains unknown_or_unclassified.
```

```text
PR_338_inspection_result=inconclusive
PR_340_inspection_result=inconclusive
record_only_execution_provable=false
worker_execution_authorized=false
capture_go_authorized=false
```

Two read-only inspection passes have been exhausted without proving a RECORD_ONLY
control. The next safe move is therefore to **plan** a minimal, reviewed code
path that *adds* a provable RECORD_ONLY mode — planning only, no implementation
here.

---

## 3. Explicit non-authorization

This PR does **NOT** authorize:

```text
worker execution
classifier execution
capture execution
source/code/package changes
wrapper/flag implementation
SQL/psql
DB mutation
raw output reading
Lane/scoring/AMS/customer/Gate4E/F
```

Merging this PR changes no runtime/enforcement behavior, implements nothing, and
authorizes no execution.

---

## 4. Planning targets

```text
npm run risk-evidence:run
scripts/run-risk-evidence-worker.ts
```

The plan defines a minimal future path to provide a **provable** RECORD_ONLY
mode, as exactly one of:

- **A. Dedicated wrapper command** that executes the risk-worker in a
  no-write / record-only mode.
- **B. Reviewed env flag or CLI flag** that gates **all** DB / customer-visible
  write paths.
- **C. Code-level invariant** that routes execution through a non-writing
  recorder only.

The choice among A / B / C is a **governance decision** to be made when the
implementation plan is reviewed; this PR records the options and the invariants
each must satisfy (§5–§6), not the selection.

---

## 5. Future design requirements for a valid RECORD_ONLY path

Any chosen path (A/B/C) must satisfy **all** of:

- **one explicit command or flag** (a single, unambiguous RECORD_ONLY selector);
- **fail-closed when RECORD_ONLY is absent** (no implicit/default write mode at
  the capture entrypoint);
- **all DB write / customer-visible output paths gated** by the control;
- **safe startup labels only** (no secrets, no raw values at startup);
- **numeric exit code only** surfaced as the outcome signal;
- **stdout/stderr captured privately** (private temp files; not printed);
- **no raw output printed**;
- **no classifier in the same run**;
- **a separate capture evidence PR after any future run** (booleans + numeric
  exit code only).

---

## 6. Required proof labels before any future capture GO

A later proof (its own separate, reviewed, GO-gated step — **after** the
implementation is merged) must show:

```text
record_only_entrypoint_present=true
record_only_flag_or_wrapper_present=true
record_only_gates_db_writes=true
record_only_gates_customer_visible_output=true
record_only_absence_fails_closed=true
write_path_bypass_detected=false
capture_command_reviewed=true
worker_execution_authorized=false
```

`worker_execution_authorized` remains **`false`** even at proof time — proving the
RECORD_ONLY path is provable does not itself authorize a capture run; the capture
GO is a separate later decision.

---

## 7. Stop-lines

The future implementation / proof (and this plan) must stop if:

```text
RECORD_ONLY gate does not cover all write paths
customer-visible output path cannot be ruled out
flag/wrapper can be bypassed
default mode can write
proof requires runtime output read
proof requires SQL/psql
proof requires executing worker
implementation scope exceeds minimal wrapper/flag path
```

On any stop-line: halt and record it (safe labels only); do not proceed to
implementation, proof, or capture.

---

## 8. Next-gate decision tree

- **If this planning is approved/merged:** the next step is a **separate
  implementation-plan PR or implementation PR** (depending on the governance
  choice of A/B/C) — **no execution**.
- **If an implementation is later merged and reviewed:** the next step is a
  **separate proof-evidence PR** (read-only / static where possible) — **still no
  capture**.
- **Only after the proof evidence is reviewed/merged:** a **future capture GO**
  may be considered (its own separate explicit scoped Helen GO; the PR #335
  capture path, re-gated on the new proof).

In all branches, any source/code change, worker run, capture, or downstream/Gate
action requires its own separate explicit scoped Helen GO after the relevant
evidence is reviewed.

---

## 9. Safety / Raw-Data Boundary

This record contains no secret value, **no DSN value or DSN component**, raw
password, password hash, DSN URI, connection string, raw secret-manager payload,
service-file content, `.env.production` / `risk-worker.env` content/value, token,
private key, IP address, host value, port value, real URI, login source, **raw
`pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real
`session_id` / `request_id` / user identifier, user-agent, header, body value,
customer row data, **raw psql output, raw PostgreSQL error text**, **stack trace
/ exception text**, **worker stdout/stderr**, or `run.safe.out` / `run.err`
contents. This plan implements nothing and reads no captured runtime output; any
future implementation / proof must record **only safe labels / booleans /
category tokens / safe identifiers / a numeric exit code**. The `package.json`
script name (`risk-evidence:run`), the `scripts/*.ts` path
(`scripts/run-risk-evidence-worker.ts`), the role name (`buyerrecon_risk_worker`),
the table name (`risk_observations_v0_1`), the database name
(`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`), and the
recorded commit hash are **non-secret** identifiers. All values above are safe
labels / booleans / category tokens / non-secret identifiers / a public git
commit hash — not secret or row values. **This PR runs nothing.**
