# Sprint 3 — Minimal RECORD_ONLY Wrapper Implementation — Planning (Docs-Only)

**Status:** `RISK_WORKER_RECORD_ONLY_WRAPPER_IMPLEMENTATION_PLANNING_ONLY`

This is a **docs-only planning record**. It plans the **smallest future
implementation path** for a *provable* RECORD_ONLY wrapper / flag / code path for
the risk-worker, before any capture GO can be reconsidered — after two read-only
inspection passes (PR #338, PR #340) both landed `inspection_result=inconclusive`
and PR #341 planned the wrapper-path direction.

This PR **plans only**. It does **not** implement any code, modify
`package.json`/scripts/source/config/runtime/DSN/secret/schema/migration/deploy/
env/worker/extractor/Lane/scoring/AMS/customer-output files, run the worker, run
any classifier, run a capture, read/`cat`/`grep`/copy any old or new
`run.err`/`run.safe.out`, run SQL/psql, mutate the DB, apply any fix, or run
Gate4E/Gate4F.

---

## 1. Current trusted base

```text
base_branch=sprint2-architecture-contracts-d4cc2bf
trusted_base=b6f538b5800585ac83142df28627aa24e46ff0bc
```

---

## 2. Context / carry-forward

```text
PR #338: command-contract inspection evidence merged; inspection_result=inconclusive.
PR #340: precise import-chain inspection evidence merged; inspection_result=inconclusive.
PR #341: minimal RECORD_ONLY wrapper path planning merged.
Current blocker: RECORD_ONLY execution cannot be proven from current source.
Capture GO remains blocked.
Runtime cause remains unknown_or_unclassified.
```

Read-only inspection has been exhausted; the agreed direction (PR #341) is to
*add* a provable RECORD_ONLY control. This PR plans the **minimal implementation
shape** for that control — planning only, no code here.

---

## 3. Explicit non-authorization

This PR does **NOT** authorize: code implementation; any change to
`package.json`/scripts/source/config/runtime/DSN/secret/schema/migration/deploy/
env/worker-extractor/Lane-scoring-AMS-customer-output files; a worker run;
classifier execution; a capture; raw output reading; SQL/psql; DB mutation; a
fix; or Gate4E/Gate4F. Merging this PR implements nothing and authorizes no
execution.

---

## 4. Minimal future implementation options

```text
Option A: package-script wrapper command, e.g. risk-evidence:record-only, that
          invokes a dedicated wrapper / entrypoint.
Option B: explicit env / CLI flag accepted by scripts/run-risk-evidence-worker.ts
          and enforced fail-closed.
Option C: separate non-writing recorder entrypoint that cannot reach
          write / customer-visible output paths.
```

---

## 5. Recommended default option (with rationale)

**Recommended default: Option A — a dedicated package-script wrapper command
(e.g. `risk-evidence:record-only`) invoking a dedicated wrapper/entrypoint.**

Rationale:

- **Smallest review surface** — a new, isolated entrypoint + one `package.json`
  script line, rather than threading a flag through existing worker control flow
  (Option B) or duplicating a recorder path (Option C).
- **Fail-closed by construction** — the existing default command path is left
  untouched and keeps no implicit RECORD_ONLY meaning; RECORD_ONLY is reachable
  **only** via the explicit new command, so absence cannot silently write.
- **Easiest proof labels** — `record_only_entrypoint_present` /
  `record_only_flag_or_wrapper_present` / `record_only_absence_fails_closed` are
  statically demonstrable from the new isolated entrypoint and the unchanged
  default path.
- **Avoids altering existing runtime behavior unless explicitly called** — the
  current `risk-evidence:run` behavior is unchanged; the new behavior exists only
  under the new command.

Option B is acceptable only if the flag can be proven to gate **all** write /
customer-visible paths with no bypass; Option C only if the recorder entrypoint
provably cannot reach any write path. Both have larger proof surfaces than A. The
final selection is a **governance decision** at implementation-PR review.

---

## 6. Required implementation proof labels

A later proof (Step 2 below; its own reviewed PR) must show:

```text
record_only_entrypoint_present=true
record_only_flag_or_wrapper_present=true
record_only_absence_fails_closed=true
record_only_gates_db_writes=true
record_only_gates_customer_visible_output=true
write_path_bypass_detected=false
customer_visible_bypass_detected=false
capture_command_reviewed=true
worker_execution_authorized=false
```

`worker_execution_authorized` remains **`false`** even at proof time — proving the
RECORD_ONLY control is provable does not authorize a capture run.

---

## 7. Future implementation-PR constraints

The future implementation PR must observe:

- **no DB / schema / grant / migration change**;
- **no production command**;
- **no capture**;
- **no classifier**;
- **no raw output read**;
- **tests / static proof only** where possible (prefer statically-demonstrable
  fail-closed gating over any runtime check);
- the **source change must be minimal and isolated** (a new entrypoint + minimal
  wiring; do not refactor existing worker write paths).

---

## 8. Future proof-PR sequence

```text
Step 1: implementation PR reviewed/merged, no execution.
Step 2: static proof evidence PR proving fail-closed RECORD_ONLY gating, no execution.
Step 3: only after proof is merged, a separate capture GO may be considered.
```

Each step is its own separately reviewed change; any worker run, capture, or
downstream/Gate action requires its own separate explicit scoped Helen GO after
the relevant evidence is reviewed.

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
contents. This plan implements nothing, runs nothing, and reads no captured
runtime output; any future implementation / proof must record **only safe labels
/ booleans / category tokens / safe identifiers / a numeric exit code**. The
`package.json` script names (`risk-evidence:run`, the proposed
`risk-evidence:record-only`), the `scripts/*.ts` path
(`scripts/run-risk-evidence-worker.ts`), the role name (`buyerrecon_risk_worker`),
the table name (`risk_observations_v0_1`), the database name
(`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`), and the
recorded commit hash are **non-secret** identifiers. All values above are safe
labels / booleans / category tokens / non-secret identifiers / a public git
commit hash — not secret or row values. **This PR runs nothing.**
