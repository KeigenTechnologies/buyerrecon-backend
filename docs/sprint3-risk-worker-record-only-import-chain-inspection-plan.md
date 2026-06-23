# Sprint 3 — Risk-Worker RECORD_ONLY Import-Chain Inspection — Planning (Docs-Only)

**Status:** `RISK_WORKER_RECORD_ONLY_IMPORT_CHAIN_INSPECTION_PLANNING_ONLY`

This is a **docs-only planning record**. It defines a more precise future,
**docs-first / review-gated** repo-source inspection to resolve the risk-worker
RECORD_ONLY command contract, after the prior command-contract inspection landed
`inspection_result=inconclusive` (PR #338).

This PR **plans only**. It does **not** run the worker, run any classifier,
read/`cat`/`grep`/copy any old or new `run.err`/`run.safe.out`, run SQL/psql,
apply any fix, mutate the DB, edit any source/config/runtime/DSN/secret file,
install tools, modify protected paths, or run Lane/scoring/AMS/customer
output/Gate4E/Gate4F.

---

## 1. Current trusted base

```text
base_branch=sprint2-architecture-contracts-d4cc2bf
trusted_base=e27962a649038c5fb2082514800bffc889d5d695
```

---

## 2. Carry-forward context

```text
PR #337: command-contract resolution planning merged.
PR #338: repo-only command-contract inspection evidence merged.
PR #338 result: inspection_result=inconclusive.
```

Observed PR #338 labels (carry-forward):

```text
command_path_confirmed=true
entrypoint_import_chain_mapped=false
record_only_control_found=true
record_only_control_kind=unknown
record_only_control_name=safe_identifier_present
db_write_path_present=true
record_only_execution_provable=false
wrapper_or_code_change_required=unknown
worker_execution_authorized=false
```

The prior inspection confirmed the command path but **did not map the entrypoint
import chain** and left the RECORD_ONLY control unresolved
(`record_only_control_name=safe_identifier_present` is a placeholder, not the
specific identifier). This plan scopes a **more precise** inspection to resolve
those gaps — without any execution.

---

## 3. Explicit non-authorization

This planning PR does **NOT** authorize:

- a worker run / rerun;
- classifier execution;
- raw output reading;
- SQL/psql;
- DB mutation;
- source/config/secret/runtime changes;
- a wrapper / flag / code fix;
- Lane/scoring/AMS/customer output/Gate4E/Gate4F.

Merging this PR changes no runtime/enforcement behavior and authorizes no
execution. The future inspection itself is **read-only over tracked repo
artifacts** and also authorizes none of the above.

---

## 4. Inspection goal

The future precise inspection must, from tracked repo source only:

1. **Map the full local import/call chain** from
   `scripts/run-risk-evidence-worker.ts`.
2. **Resolve the specific RECORD_ONLY-like control identifier** (replace the
   placeholder `safe_identifier_present` with the actual identifier).
3. **Determine the control's kind** — env var, CLI flag, config key, code
   invariant, or only a coincidental keyword.
4. **Identify whether DB write-like paths are reachable** from the risk-worker
   command path.
5. **Decide** whether RECORD_ONLY execution can be proven, requires a
   wrapper/code change, or remains inconclusive.

---

## 5. Planned inspection scope

> **PLANNED INSPECTION ONLY — DO NOT RUN WORKER.** Read-only over tracked repo
> artifacts. No worker run, no runtime output files, no execution of any kind.

The future inspection may inspect **only** these tracked repo artifacts:

```text
package.json
scripts/run-risk-evidence-worker.ts
local imports / callees reachable from scripts/run-risk-evidence-worker.ts
risk / evidence / worker modules under src/**  (e.g. src/scoring/risk-evidence/**)
docs/sprint3-risk-worker-record-only-command-contract-inspection-evidence.md
docs/sprint3-risk-worker-record-only-command-contract-resolution-plan.md
```

It must **not** inspect runtime output files (no old or new `run.err` /
`run.safe.out`), must not run anything, and must not read DSN/env/secret values.

---

## 6. Required future evidence labels

```text
command_path_confirmed=true|false
entrypoint_import_chain_mapped=true|false
entrypoint_import_chain_files=<safe repo paths only>
record_only_control_identifier_resolved=true|false
record_only_control_kind=env_var|cli_flag|config_key|code_invariant|coincidental_keyword|missing|unknown
record_only_control_name=<safe identifier only or none>
record_only_control_location=<safe repo path only or none>
db_write_path_present=true|false|unknown
db_write_path_reachable_from_entrypoint=true|false|unknown
customer_visible_output_path_present=true|false|unknown
record_only_execution_provable=true|false
wrapper_or_code_change_required=true|false|unknown
inspection_result=proven_record_only|requires_wrapper_or_code_change|inconclusive
worker_execution_authorized=false
```

`record_only_control_name`, `record_only_control_location`, and
`entrypoint_import_chain_files` record **safe identifiers / repo paths only** (or
`none`) — never a secret or value. `worker_execution_authorized` is **always
`false`** for the inspection step (inspection resolves a contract; it does not
authorize a run).

---

## 7. Stop-lines

The future inspection (and this plan) must stop if:

- source inspection would require **worker execution**;
- source inspection would require **runtime output read** (`run.err` /
  `run.safe.out`, old or new);
- source inspection would require **SQL/psql**;
- the **import chain cannot be mapped**;
- the **RECORD_ONLY-like control identifier cannot be resolved**;
- the **control exists but cannot be proven to gate write / customer-visible
  paths**;
- **DB write path reachability remains unknown**;
- **customer-visible output ambiguity remains**;
- **any code / wrapper / flag change would be required** before proof.

On any stop-line: halt and record it (safe labels only); do not proceed to any
execution.

---

## 8. Next-gate decision tree

- **If the RECORD_ONLY control and write / customer-output gating are proven**
  (`inspection_result=proven_record_only`, `record_only_execution_provable=true`,
  write/customer paths shown gated): create a **docs-only evidence PR** — **no
  capture yet**.
- **If source lacks a provable control or write paths cannot be gated**
  (`inspection_result=requires_wrapper_or_code_change`): create a **separate
  wrapper / flag / code-path planning PR** — **no implementation**.
- **If the import chain / control reachability remains inconclusive**
  (`inspection_result=inconclusive`): **stop** — **no capture GO**.

In all branches, any worker run, fix/implementation, or downstream/Gate action
requires its own separate explicit scoped Helen GO after the relevant evidence is
reviewed.

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
contents. This plan and the future inspection read **only tracked repo
source/docs/package artifacts** — no captured runtime output, no DSN/env/secret
values; any inspection evidence records **only safe labels / booleans / category
tokens / safe identifiers / safe repo paths**. The `package.json` script name
(`risk-evidence:run`), the `scripts/*.ts` path
(`scripts/run-risk-evidence-worker.ts`), the module tree
(`src/scoring/risk-evidence/**`), the role name (`buyerrecon_risk_worker`), the
table name (`risk_observations_v0_1`), the database name
(`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`), and the
recorded commit hash are **non-secret** identifiers. All values above are safe
labels / booleans / category tokens / non-secret identifiers / a public git
commit hash — not secret or row values. **This PR runs nothing.**
