# Sprint 3 — Risk-Worker `build_surface` Ambiguity Disambiguation Planning

> **Docs-only planning document.** Plans a future disambiguation step for the two active
> `build_surface` safe signals recorded by the merged evidence (PR #384):
> `tsx_ts_node_runtime_surface_signal = true` and `ci_build_parity_surface_signal = true`, which
> produced `safe_sublabel = unknown_build_surface`. This document **executes nothing, fixes nothing,
> and changes no runtime/source/package/dependency/script/workflow/checker behavior**.
>
> **Authorizes nothing.** No execution, no diagnostic run, no worker/classifier/risk-evidence/
> record-only rerun, no SQL/psql, no DB/network, no Gate D/E movement, no customer-output action, no
> fix, no retry, no root-cause inference. Any future disambiguation requires its own command-pack PR
> and a **separate exact GO**.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked / none_not_classified`; surface label `build_surface`; sublabel
> `unknown_build_surface`; `runtime_cause_inference = false`. `unknown_build_surface` unblocks no Gate.

---

## STATUS: `SPRINT3_RISKWORKER_BUILDSURFACE_AMBIGUITY_DISAMBIGUATION_PLANNING_ONLY`

---

## 1. Status and scope

- **Status:** `SPRINT3_RISKWORKER_BUILDSURFACE_AMBIGUITY_DISAMBIGUATION_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file. Define — at planning level only — a future step
  to disambiguate the two active `build_surface` safe signals. No code, config, workflow, checker,
  package, script, dependency, lockfile, refactor, or Phase C change. No execution of any kind.
- **Layer:** L1 (docs-only).

---

## 2. Target operation summary

| Field | Value |
| --- | --- |
| Target | Ambiguity between two active `build_surface` safe signals |
| Active signals | `tsx_ts_node_runtime_surface_signal = true`, `ci_build_parity_surface_signal = true` |
| Current sublabel | `unknown_build_surface` (from ambiguous multi-signal result, PR #384) |
| Purpose | Plan a future safe step that may distinguish runtime-loader reliance from CI/build parity |
| This document does | Planning only; defines questions, a planning-level strategy, and the boundary for a future command-pack PR |
| This document does not do | Execute, run any diagnostic, rerun any worker/classifier/record-only, touch DB/network/SQL, move any Gate, generate customer output, or infer root cause |

---

## 3. Current known safe facts (from merged trail)

Recorded context — safe labels only:

- **PR #378** merged the reusable L3 planning template.
- **PR #379** merged the risk-worker RDBF L3 planning document.
- **PR #380** merged the risk-worker RDBF diagnostic command-pack.
- **PR #381** merged the RDBF read-only diagnostic evidence (`likely_failure_surface = build_surface`).
- **PR #382** merged the `build_surface` investigation planning.
- **PR #383** merged the `build_surface` sublabel diagnostic command-pack.
- **PR #384** merged the sublabel diagnostic evidence:
  - `diagnostic_result: ambiguous_multiple_safe_sublabels`
  - `safe_sublabel_candidate_count: 2`
  - `safe_sublabel: unknown_build_surface`
  - `tsx_ts_node_runtime_surface_signal: true`
  - `ci_build_parity_surface_signal: true`
  - `runtime_cause_inference: false`
- **Broad category remains:** `runtime_dependency_or_build_failure`.
- **Prior subclassifier retry state remains:** `blocked / none_not_classified`.
- `build_surface` and `unknown_build_surface` are **safe-pattern-family labels only**, not root-cause
  inferences. `unknown_build_surface` unblocks no Gate.

---

## 4. Explicit non-goals

This planning document explicitly does **not**:

- execute anything or run any diagnostic;
- rerun the worker, a classifier, risk-evidence, or a record-only pass;
- perform SQL/psql or any DB/network action;
- read raw logs, raw runtime output, exact errors, dependency-file contents, env values, `run.err`,
  `run.safe.out`, or private captures;
- generate Lane/scoring/AMS/customer output;
- move Gate D, Gate E, Gate4E, or Gate4F;
- change source, workflow, ruleset, checker, package, script, dependency, or lockfile;
- perform any fix, remediation, or retry loop;
- infer, assert, or narrow a runtime **root cause** (`runtime_cause_inference` stays `false`);
- resolve the sealed broad category or the prior subclassifier retry state.

---

## 5. Ambiguity statement

The PR #384 diagnostic fired **two** safe sublabel signals
(`tsx_ts_node_runtime_surface_signal` and `ci_build_parity_surface_signal`). Per the command-pack
ambiguity rule, more than one active safe signal means the diagnostic **must remain ambiguous** and
classify as `unknown_build_surface`. The two signals are **not** currently distinguished, and it is an
open, planning-level question whether they are **independent**, **correlated**, or **both structurally
expected** (and therefore jointly non-disambiguating). This document does not resolve that ambiguity;
it plans a future safe step that might.

---

## 6. Planning-level disambiguation questions

Planning-level questions only — each to be answered **later** by a separately-reviewed and
separately-GO'd read-only/static command-pack, using **safe labels/booleans/counts only**, never raw
logs. None is answered here.

1. Is the active signal **mainly caused by risk scripts using `tsx` at runtime** (runtime-loader
   reliance)?
2. Is the active signal **mainly caused by CI / build parity assumptions**?
3. Are **both signals structurally expected** (e.g. a `tsx`-based project that also asserts CI/build
   parity) and therefore **still non-disambiguating**?
4. **What safe labels / booleans / counts** would distinguish *runtime-loader reliance* from *CI/build
   parity* **without** reading raw logs or changing source — e.g. counts of risk scripts invoking a
   runtime loader vs counts of build/parity assertions, presence/shape of a build step vs a
   direct-runtime step, tracked build-artifact candidate counts vs runtime-loader invocation counts?

> Recording a question here is not a claim about the cause and does not narrow the sealed state.

---

## 7. Proposed diagnostic strategy (planning level only)

Planning-level shape only — **not** a command pack, **not** executable, authorizes nothing:

- The future disambiguation should be a **single, read-only/static, safe-labelled** pass that maps each
  question in Section 6 to a boolean/count signal (e.g. `runtime_loader_invocation_count`,
  `build_step_present`, `direct_runtime_step_present`, `parity_assertion_count`,
  `signals_independent` / `signals_correlated` / `both_structurally_expected`) — presence/shape/count
  signals only, never contents.
- It should **stop at classification**: emit either a single disambiguated sublabel **or** an explicit
  `still_ambiguous` / `both_structurally_expected` safe label, and stop; no remediation.
- It should be **fail-closed** and **head-pinned**, matching the discipline of the merged command-packs
  (PR #380, PR #383).
- It should require its **own command-pack PR**, its own review, and a **separate exact GO**.
- It must **not** escalate to a fix, a worker rerun, or any DB/network/customer-output/Gate action.

---

## 8. Required future command-pack PR

Before any execution:

- A **separate docs-only command-pack PR** must define the exact read-only/static disambiguation
  command pack (fail-closed preflight, head-pin, safe labels/booleans/counts, exit-code handling,
  cleanup, explicit output ban).
- That PR must be reviewed and merged.
- Only then may a **separate exact GO** authorize a single read-only/static disambiguation run.
- This planning PR does **not** substitute for that command-pack PR and does not authorize execution.

---

## 9. Exact future GO placeholder

- Exact future GO phrase (placeholder):
  **`HELEN GO: RISKWORKER BUILD-SURFACE AMBIGUITY DISAMBIGUATION READ-ONLY DIAGNOSTIC L3 EXECUTE`**
- No execution is authorized until the operator sends this **exact** phrase for this **exact**
  operation, after the future command-pack PR is reviewed and merged.

---

## 10. Ambiguous / partial GO invalid rule

- A partial, paraphrased, ambiguous, reordered, or scope-mismatched GO is **invalid** and must be
  treated as "no GO".
- A GO referencing a different operation or a step not enumerated in the future command-pack's allowed
  envelope is invalid.
- When in doubt, stop and re-request an exact GO. Approximation is never a GO.

---

## 11. Safe output contract

Any future disambiguation output is restricted to **labels, booleans, aggregate counts, and
fail-closed stop labels only**.

| Output element | Allowed? |
| --- | --- |
| Safe labels (`PREFLIGHT_OK`, `DISAMBIGUATE_DONE`, disambiguated sublabel or `still_ambiguous`) | Yes — required |
| Booleans (e.g. `build_step_present=true/false`) | Yes |
| Aggregate counts (e.g. `runtime_loader_invocation_count=<n>`) | Yes |
| Fail-closed stop labels (e.g. `RESULT_BLOCKED`, `stop_label=<reason-token>`) | Yes |
| Raw logs / raw runtime output | **No** |
| Exact raw error lines | **No** |
| Stack traces | **No** |
| SQL results | **No** |
| Dependency-file contents | **No** |
| Env values | **No** |
| Private paths | **No** |
| Customer data | **No** |
| Secrets / DSNs / hosts | **No** |
| Base64 blobs | **No** |

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
- [ ] No raw logs, exact errors, stack traces, dependency-file contents, env values, DSNs, hosts, or
      private paths in output.
- [ ] No raw customer data (never).
- [ ] No fix / remediation / retry loop.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.
- [ ] No Phase C migration.

---

## 13. Fail-closed criteria

Any future disambiguation must fail closed (emit `RESULT_BLOCKED` + `stop_label`, take no further
action) on any of:

- Wrong branch / base / head SHA.
- Dirty worktree.
- Missing expected PR / base SHA.
- Missing required env / custody file (presence check only).
- Ambiguous target.
- Unexpected output shape.
- Any command exits nonzero before safe labels are emitted.
- `static-guardrails` not green.
- Operator GO missing or mismatched.
- Any secret / raw-data / dependency-content / env-value leakage risk detected.
- Any signal the pass would cross into execution/mutation/remediation → stop immediately.

---

## 14. Evidence plan

- A future disambiguation must record its outcome in a **separate docs-only evidence PR** with safe
  labels/booleans/counts only.
- Expected safe labels: `PREFLIGHT_OK`, `DISAMBIGUATE_DONE`, a disambiguated sublabel **or**
  `still_ambiguous` / `both_structurally_expected`, plus supporting booleans/counts, and `stop_label`
  if blocked.
- The evidence PR must reaffirm sealed state and `runtime_cause_inference: false`.
- No execution result may be silently folded into a code PR.

---

## 15. Negative-action ledger (this planning PR)

```yaml
execution_performed: false
diagnostic_run_performed: false
worker_rerun_performed: false
classifier_rerun_performed: false
risk_evidence_rerun_performed: false
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
raw_logs_in_doc: false
raw_runtime_output_in_doc: false
exact_raw_error_in_doc: false
dependency_file_contents_in_doc: false
env_values_in_doc: false
stack_trace_in_doc: false
sql_result_in_doc: false
customer_data_in_doc: false
secret_or_dsn_or_host_in_doc: false
private_path_in_doc: false
base64_blob_in_doc: false
```

---

## 16. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **This PR does not authorize** Gate D, Gate E, customer-output generation, or any downstream
  customer-facing action.
- Any Gate D / Gate E movement must be **separately proven independent** of the sealed risk-worker
  state, or **separately authorized** under its own planning + exact GO.
- Neither `build_surface` nor `unknown_build_surface` unblocks any Gate or implies scoring/
  customer-output readiness.

---

## 17. Post-disambiguation interpretation rules

For a future GO'd disambiguation (not this PR):

- **Success:** preflight passed, one read-only/static pass completed, either a single disambiguated
  sublabel or an explicit `still_ambiguous` / `both_structurally_expected` label emitted, no boundary
  crossed, sealed state and `runtime_cause_inference: false` preserved.
- **Blocked:** any fail-closed criterion tripped; `stop_label` records the reason token.
- **Still ambiguous:** if signals remain non-distinguishing, the sublabel stays `unknown_build_surface`.
  Acceptable; authorizes no escalation.
- **Allowed follow-up:** write/update the safe-labelled evidence PR only.
- **Requires new planning PR + exact GO:** any remediation, worker/classifier/risk-evidence/
  record-only execution, SQL/psql, mutation, deploy, Gate D/E movement, or customer-output action.
- No interpretation may assert a runtime root cause; the sealed classification stands unchanged.

---

_End of planning document. Docs-only. Authorizes no fix, execution, retry, Gate D/E, or customer-output action. Sealed state preserved._
