# Sprint 3 — Risk-Worker RECORD_ONLY Command-Contract Resolution — Planning (Docs-Only)

**Status:** `RISK_WORKER_RECORD_ONLY_COMMAND_CONTRACT_RESOLUTION_PLANNING_ONLY`

This is a **docs-only planning record**. It defines a future, **docs-first /
review-gated** source-inspection step to determine — from existing repo
artifacts only — how RECORD_ONLY is intended to be selected or enforced for the
risk-evidence worker, after the fresh capture attempt blocked at
`record_only_control_not_proven_from_source` (PR #336).

This PR **plans only**. It does **not** run the worker, run any classifier,
read/`cat`/`grep`/copy/inspect any old or new `run.err`/`run.safe.out`, run
SQL/psql, apply any fix, mutate the DB, edit any source/config/runtime/DSN/secret
file, change scripts/package/schema/migrations/deploy/env/secret files, install
tools, modify `.claude/constants.md` / `config/constants.ts` / `CLAUDE.md`, or
run Lane/scoring/AMS/customer output/Gate4E/Gate4F.

---

## 1. Current trusted base

```text
base_branch=sprint2-architecture-contracts-d4cc2bf
trusted_base=9dee232237906b2b39f5d07a1e030df4cd2088cb
```

---

## 2. Carry-forward context

```text
PR #333: Phase A static inspection completed; diagnostic_result=inconclusive.
PR #334: Phase B classification blocked; stored private run.err + run.safe.out pair not found.
PR #335: fresh RECORD_ONLY capture planning merged.
PR #336: fresh RECORD_ONLY capture attempt blocked before worker execution
         because RECORD_ONLY control was not proven from current source.
Current runtime cause: unknown_or_unclassified.
```

Observed PR #336 safe labels (carry-forward):

```text
repo_preflight_pass=true
head_equals_pr335_base=true
working_tree_clean=true
package_script_path_proven=true
reviewed_command_path_proven=true
record_only_control_proven=false
stop_line=record_only_control_not_proven_from_source
worker_command_invoked=false
worker_invocation_count=0
raw_output_read=false
classifier_execution_attempted=false
diagnostic_result=blocked_before_worker_execution
runtime_cause=unknown_or_unclassified
```

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

## 4. Future inspection scope

> **PLANNED INSPECTION ONLY — DO NOT RUN WORKER.** Read-only over tracked repo
> source/docs/package artifacts. No worker run, no runtime output files, no
> execution of any kind.

The future inspection may inspect **only** repo artifacts such as:

```text
package.json
scripts/run-risk-evidence-worker.ts
src/**  (risk-evidence / risk-worker modules, e.g. src/scoring/risk-evidence/**)
docs/sprint3-risk-worker-record-only-output-capture-plan.md
docs/sprint3-risk-worker-record-only-capture-blocked-evidence.md
```

It must **not** inspect any captured runtime output files (no old or new
`run.err` / `run.safe.out`), must not run anything, and must not read DSN/env/
secret values.

It must answer exactly **one** of (only after the future reviewed inspection):

```text
A. Existing source already has a RECORD_ONLY / dry-run / observe-only / non-write
   control, but it is named differently or located in downstream modules.
B. Existing command is inherently non-writing / record-only by code invariant,
   and this can be proven from source.
C. Existing source lacks a provable RECORD_ONLY control, so a separate reviewed
   wrapper/flag/code change is required before any capture GO can be retried.
D. Inspection is inconclusive, so no worker execution may proceed.
```

---

## 5. Source-inspection questions

The future inspection must resolve, from tracked source/docs only:

1. What command does `risk-evidence:run` actually invoke (confirm the
   `package.json` mapping → `tsx scripts/run-risk-evidence-worker.ts`)?
2. What modules does `scripts/run-risk-evidence-worker.ts` import/call (map the
   entrypoint → `src/scoring/risk-evidence/**` import chain)?
3. Is there any **env var, CLI flag, config key, or constant** controlling
   write / record / dry-run behavior?
4. Does the worker **write to the DB** or only **record observations** (and to
   which table — e.g. `risk_observations_v0_1`)?
5. If it writes, can a **true RECORD_ONLY mode be selected without code
   changes**?
6. If not, what **minimal future wrapper / flag / code path** would be needed?
7. What **exact positive proof labels** would be required before a future
   capture GO (i.e. which of §6's labels must be `true`)?

---

## 6. Allowed future inspection-evidence labels

```text
command_path_confirmed=true|false
entrypoint_import_chain_mapped=true|false
record_only_control_found=true|false
record_only_control_kind=env_var|cli_flag|config_key|code_invariant|missing|unknown
record_only_control_name=<safe identifier only or none>
db_write_path_present=true|false|unknown
record_only_execution_provable=true|false
wrapper_or_code_change_required=true|false|unknown
inspection_result=proven_record_only|requires_wrapper_or_code_change|inconclusive
worker_execution_authorized=false
```

`record_only_control_name` records a **safe identifier only** (e.g. an env-var
name or flag name) or `none` — never a secret or value. `worker_execution_authorized`
is **always `false`** for the inspection step (inspection proves a contract; it
does not authorize a run).

---

## 7. Stop-lines

The future inspection (and this plan) must stop if:

- the source inspection would require **running the worker**;
- the inspection would require **reading runtime output** (`run.err` /
  `run.safe.out`, old or new);
- the inspection would require **SQL/psql**;
- the **RECORD_ONLY control cannot be proven**;
- the **write path cannot be ruled out** (when RECORD_ONLY hinges on no-write);
- the **command path / import chain is ambiguous**;
- **any fix / code change would be required** before proof;
- **customer-visible output ambiguity** remains.

On any stop-line: halt and record it (safe labels only); do not proceed to any
execution.

---

## 8. Next-gate decision tree

- **If existing RECORD_ONLY control is proven** (`inspection_result=proven_record_only`,
  `record_only_execution_provable=true`): create a **docs-only evidence PR**
  recording the proof; **then** a future **separate capture GO** may be
  considered (its own scoped Helen GO; the PR #335 capture path).
- **If a wrapper / code change is required**
  (`inspection_result=requires_wrapper_or_code_change`): create a **separate
  planning PR** for the minimal wrapper / flag / code path — **planning-only, no
  execution**, reviewed/merged before anything else.
- **If inconclusive** (`inspection_result=inconclusive`): **stop** — **no
  capture GO**; re-scope the inspection under a new plan.

In all branches, any worker run, fix, or downstream/Gate action requires its own
separate explicit scoped Helen GO after the relevant evidence is reviewed.

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
tokens / safe identifiers**. The `package.json` script name (`risk-evidence:run`),
the `scripts/*.ts` path (`scripts/run-risk-evidence-worker.ts`), the module tree
(`src/scoring/risk-evidence/**`), the role name (`buyerrecon_risk_worker`), the
table name (`risk_observations_v0_1`), the database name
(`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`), and the
recorded commit hash are **non-secret** identifiers. All values above are safe
labels / booleans / category tokens / non-secret identifiers / a public git
commit hash — not secret or row values. **This PR runs nothing.**
