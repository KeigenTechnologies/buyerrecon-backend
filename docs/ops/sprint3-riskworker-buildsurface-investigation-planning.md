# Sprint 3 — Risk-Worker `build_surface` Investigation Planning

> **Docs-only planning document.** Plans the next investigation step for the safe
> `likely_failure_surface = build_surface` label produced by the single approved-GO risk-worker RDBF
> read-only diagnostic (evidence PR #381). This document **executes nothing, fixes nothing, and
> changes no runtime/source/package/dependency/script/workflow/checker behavior**.
>
> **Authorizes nothing.** No execution, no diagnostic run, no worker/classifier/risk-evidence/
> record-only command, no SQL/psql, no DB/network, no customer-output/Gate action, no fix, no retry,
> no root-cause inference. Any future diagnostic requires its own command-pack PR and a **separate
> exact GO**.
>
> **Sealed state preserved:** broad category `runtime_dependency_or_build_failure` (unchanged);
> prior subclassifier retry state `blocked / none_not_classified` (unchanged); `build_surface` is a
> **safe-pattern-family label only, not a root-cause inference**.

---

## STATUS: `SPRINT3_RISKWORKER_BUILDSURFACE_INVESTIGATION_PLANNING_ONLY`

---

## 1. Status and scope

- **Status:** `SPRINT3_RISKWORKER_BUILDSURFACE_INVESTIGATION_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file. Define — at planning level only — the next
  investigation step for the `build_surface` label. No code, config, workflow, checker, package,
  script, dependency, lockfile, refactor, or Phase C change. No execution of any kind.
- **Layer:** L1 (docs-only).

---

## 2. Target operation summary

| Field | Value |
| --- | --- |
| Target | Risk-worker `runtime_dependency_or_build_failure` |
| Safe diagnostic surface label | `likely_failure_surface = build_surface` |
| Purpose | Plan the next safe investigation step for `build_surface` |
| This document does | Planning only; defines questions, a planning-level strategy, and the boundary for a future command-pack PR |
| This document does not do | Execute, run any diagnostic, rerun any worker/classifier/record-only, touch DB/network/SQL, generate customer output, move any Gate, or infer root cause |

---

## 3. Current known safe facts (from merged trail)

Recorded context from the merged governance/diagnostic trail — safe labels only:

- **PR #378** merged the reusable L3 planning template.
- **PR #379** merged the risk-worker RDBF L3 planning document.
- **PR #380** merged the risk-worker RDBF diagnostic command-pack.
- **Exact GO issued once:** `HELEN L3 RISKWORKER RDBF READONLY DIAGNOSTIC GO`.
- **PR #381** merged the docs-only evidence record.
- **Safe evidence result:**
  - `diagnostic_result: classified_safe_surface`
  - `likely_failure_surface: build_surface`
  - `runtime_cause_inference: false`
- **Broad category remains:** `runtime_dependency_or_build_failure`.
- **Prior subclassifier retry state remains:** `blocked / none_not_classified`.
- `build_surface` is a **safe-pattern-family label only**, not a root-cause inference.

---

## 4. Explicit non-goals

This planning document explicitly does **not**:

- execute anything or run any diagnostic;
- rerun the worker, a classifier, risk-evidence, or a record-only pass;
- perform SQL/psql or any DB/network action;
- read raw runtime output, `run.err`, `run.safe.out`, or private captures;
- generate Lane/scoring/AMS/customer output;
- move Gate D, Gate E, Gate4E, or Gate4F;
- change source, workflow, ruleset, checker, package, script, dependency, or lockfile;
- perform any fix, remediation, or retry loop;
- infer, assert, or narrow a runtime **root cause** (`runtime_cause_inference` stays `false`);
- resolve the sealed broad category or the prior subclassifier retry state.

---

## 5. `build_surface` investigation questions (planning-level only)

Planning-level questions only. Each is a question to be answered **later**, by a separately-reviewed
and separately-GO'd read-only command-pack, using **safe labels/booleans/counts only** — never raw
output. None of these questions is answered here.

1. Is the failure surface related to **build artifact availability** (expected build output present /
   absent)?
2. Is it **TypeScript / tsx / ts-node / transpilation** related?
3. Is it **package / dependency resolution** related?
4. Is it **script-entrypoint or module-resolution** related?
5. Is it **runtime environment / build mismatch** related (built artifact vs runtime expectation)?
6. Is it **CI / build parity** related (local/CI build shape vs server build shape)?
7. **What safe labels / booleans / counts** would distinguish the above **without** raw output,
   exact errors, stack traces, SQL results, or customer data?

> These are hypotheses to be discriminated by safe signals only. Recording a question here is not a
> claim about the cause and does not narrow the sealed state.

---

## 6. Proposed diagnostic strategy (planning level only)

Planning-level shape only — **not** a command pack, **not** executable, authorizes nothing:

- The future investigation should be a **single, read-only, safe-labelled** discrimination pass that
  maps each question in Section 5 to a boolean/count signal (e.g. `build_artifact_present`,
  `transpile_config_present`, `dependency_resolution_ok`, `entrypoint_resolvable`,
  `ci_build_parity_ok`) — presence/shape signals only, never contents.
- It should **stop at classification**: emit a safe sub-surface label and stop; no remediation.
- It should be **fail-closed** and **head-pinned**, matching the discipline of the merged command-pack
  (PR #380).
- It should require its **own command-pack PR**, its own review, and a **separate exact GO**.
- It must **not** escalate to a fix, a worker rerun, or any DB/network/customer-output action.

---

## 7. Required future command-pack PR

Before any execution:

- A **separate docs-only command-pack PR** must define the exact read-only investigation command pack
  (fail-closed preflight, head-pin, safe labels/booleans/counts, exit-code handling, cleanup).
- That PR must be reviewed and merged.
- Only then may a **separate exact GO** authorize a single read-only investigation run.
- This planning PR does **not** substitute for that command-pack PR and does not authorize execution.

---

## 8. Exact future GO placeholder

- Exact future GO phrase (placeholder): **`HELEN GO: RISKWORKER BUILD-SURFACE READ-ONLY INVESTIGATION L3 EXECUTE`**
- No execution is authorized until the operator sends this **exact** phrase for this **exact**
  operation, after the future command-pack PR is reviewed and merged.

---

## 9. Ambiguous / partial GO invalid rule

- A partial, paraphrased, ambiguous, reordered, or scope-mismatched GO is **invalid** and must be
  treated as "no GO".
- A GO referencing a different operation or a step not enumerated in the future command-pack's allowed
  envelope is invalid.
- When in doubt, stop and re-request an exact GO. Approximation is never a GO.

---

## 10. Secret / custody discipline

- No secrets in git.
- No secrets in chat.
- No secrets in command argv.
- No secrets in logs.
- No DSN printing (never echo `DATABASE_URL`, `*_DSN`, connection strings, or any component).
- Hidden input only if a secret must ever be provided interactively (never on the command line).
- Root-only / permissioned custody files if applicable; the future investigation is read-only and
  performs no custody write. Any custody read is presence/permission only, never value.

---

## 11. Allowed future action envelope (for the future GO'd investigation)

Describes the **shape** of what a future investigation may do — authorizes nothing now:

- [ ] One fail-closed preflight (branch/base/head-pin/clean-tree/read-only-scope verification).
- [ ] One read-only discrimination pass mapping Section 5 questions to safe booleans/counts.
- [ ] Emit a safe sub-surface label plus supporting booleans/counts; stop at classification.
- [ ] Cleanup: remove temp files, unset transient state, leave no residual secret material.

> ⚠️ **Examples are not authorization.** These shapes describe the *kind* of future action permitted
> only under a separate reviewed command-pack and a separate exact GO.

---

## 12. Forbidden actions

Forbidden here and unless separately planned, reviewed, and covered by a distinct exact GO:

- [ ] No execution / diagnostic run.
- [ ] No worker rerun / execution.
- [ ] No classifier rerun / execution.
- [ ] No risk-evidence run / record-only rerun.
- [ ] No SQL / psql.
- [ ] No DB / network action.
- [ ] No DB mutation.
- [ ] No secret / env read (values) or edit.
- [ ] No source / config / workflow / ruleset / checker / package / script / dependency / lockfile edit.
- [ ] No deploy.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate D / Gate E / Gate4E / Gate4F movement.
- [ ] No private capture path printing.
- [ ] No raw `run.err` / `run.safe.out` printing.
- [ ] No raw customer data (never).
- [ ] No fix / remediation / retry loop.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.
- [ ] No Phase C migration.

---

## 13. Safe output contract

Any future investigation output is restricted to **labels, booleans, and counts only**.

| Output element | Allowed? |
| --- | --- |
| Safe labels (`PREFLIGHT_OK`, `INVESTIGATE_DONE`, safe sub-surface label) | Yes — required |
| Booleans (e.g. `build_artifact_present=true/false`) | Yes |
| Counts (e.g. `signals_checked=<n>`) | Yes |
| Raw runtime output | **No** |
| Exact raw error lines | **No** |
| Stack traces | **No** |
| SQL results | **No** |
| Private paths | **No** |
| Customer data | **No** |
| Secrets / DSNs | **No** |

---

## 14. Fail-closed criteria

Any future investigation must fail closed (emit `RESULT_BLOCKED`, take no further action) on any of:

- Wrong branch / base / head SHA.
- Dirty worktree.
- Missing expected PR / base SHA.
- Missing required env / custody file (presence check only).
- Ambiguous target.
- Unexpected output shape.
- Any command exits nonzero before safe labels are emitted.
- `static-guardrails` not green.
- Operator GO missing or mismatched.
- Any secret / raw-data leakage risk detected.
- Any signal the pass would cross into execution/mutation/remediation → stop immediately.

---

## 15. Evidence plan

- A future investigation must record its outcome in a **separate docs-only evidence PR** with safe
  labels/booleans/counts only.
- Expected safe labels: `PREFLIGHT_OK`, `INVESTIGATE_DONE`, a safe sub-surface label, plus
  supporting booleans/counts.
- The evidence PR must reaffirm sealed state and `runtime_cause_inference: false`.
- No execution result may be silently folded into a code PR.

---

## 16. Negative-action ledger (this planning PR)

```yaml
execution_performed: false
diagnostic_run_performed: false
worker_rerun_performed: false
classifier_rerun_performed: false
record_only_rerun_performed: false
sql_or_psql_performed: false
db_network_action_performed: false
customer_output_or_gate_performed: false
gate_d_or_e_movement_performed: false
source_or_workflow_change_performed: false
checker_or_script_or_package_change_performed: false
dependency_or_lockfile_change_performed: false
fix_or_retry_loop_performed: false
root_cause_inference_performed: false
raw_runtime_output_in_doc: false
exact_raw_error_in_doc: false
stack_trace_in_doc: false
sql_result_in_doc: false
customer_data_in_doc: false
secret_or_dsn_in_doc: false
private_path_in_doc: false
base64_blob_in_doc: false
```

---

## 17. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** if they depend on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **This PR does not authorize** Gate D, Gate E, customer-output generation, or any downstream
  customer-facing action.
- Any Gate D / Gate E movement must be **separately proven independent** of the sealed risk-worker
  state, or **separately authorized** under its own planning + exact GO.
- The `build_surface` label does not unblock any Gate and does not imply scoring/customer-output
  readiness.

---

## 18. Post-investigation interpretation rules

For a future GO'd investigation (not this PR):

- **Success:** preflight passed, one read-only discrimination pass completed, a safe sub-surface label
  emitted, no boundary crossed, sealed state and `runtime_cause_inference: false` preserved.
- **Blocked:** any fail-closed criterion tripped.
- **Inconclusive:** signals insufficient to discriminate the sub-surface; label stays at
  `build_surface`. Acceptable; authorizes no escalation.
- **Allowed follow-up:** write/update the safe-labelled evidence PR only.
- **Requires new planning PR + exact GO:** any remediation, worker/classifier/risk-evidence/
  record-only execution, SQL/psql, mutation, deploy, Gate D/E movement, or customer-output action.
- No interpretation may assert a runtime root cause; the sealed classification stands unchanged.

---

_End of planning document. Docs-only. Authorizes no execution, fix, retry, Gate D/E, or customer-output action. Sealed state preserved._
