# Sprint 3 — Risk-Worker Structural Remediation Options Planning

> **Docs-only planning document.** Compares — at planning level only — structural remediation
> **options** following the merged disambiguation evidence (PR #387), which recorded
> `safe_disambiguation_label = structurally_expected_dual_signal`. This document **plans options
> only**; it does **not choose, execute, or implement** any fix, and changes no runtime/source/
> package/dependency/script/workflow/checker behavior.
>
> **Authorizes nothing.** No execution, no diagnostic run, no worker/classifier/risk-evidence/
> record-only rerun, no SQL/psql, no DB/network, no Gate D/E movement, no customer-output action, no
> fix, no retry, no root-cause inference. Any future remediation requires its own PR(s), its own
> review, and — where applicable — a **separate exact GO**.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation result `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. `structurally_expected_dual_signal` is a **safe diagnostic label
> only, not a root-cause inference**, and **unblocks no Gate**.

---

## STATUS: `SPRINT3_RISKWORKER_STRUCTURAL_REMEDIATION_OPTIONS_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Structural Remediation Options Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_STRUCTURAL_REMEDIATION_OPTIONS_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file. Compare structural remediation **options** at
  planning level only. No code, config, workflow, checker, package, script, dependency, lockfile,
  refactor, or Phase C change. No execution of any kind. **No option is chosen or authorized.**
- **Layer:** L1 (docs-only).

---

## 3. Current known safe facts (from merged trail)

Recorded context — safe labels only:

- **PR #378** merged the reusable L3 planning template.
- **PR #379** merged the risk-worker RDBF L3 planning document.
- **PR #380** merged the risk-worker RDBF diagnostic command-pack.
- **PR #381** merged the RDBF read-only diagnostic evidence (`likely_failure_surface = build_surface`).
- **PR #382** merged the `build_surface` investigation planning.
- **PR #383** merged the `build_surface` sublabel diagnostic command-pack.
- **PR #384** merged the sublabel diagnostic evidence (`unknown_build_surface`; two active signals).
- **PR #385** merged the ambiguity disambiguation planning.
- **PR #386** merged the ambiguity disambiguation command-pack.
- **PR #387** merged the disambiguation evidence:
  - `diagnostic_result: classified_safe_disambiguation_label`
  - `safe_disambiguation_label: structurally_expected_dual_signal`
  - `tsx_runtime_reliance_signal: true`
  - `ci_build_parity_signal: true`
  - `runtime_cause_inference: false`

Sealed labels (unchanged):

```yaml
broad_category: runtime_dependency_or_build_failure
prior_subclassifier_retry_state: blocked_none_not_classified
surface_label: build_surface
previous_sublabel: unknown_build_surface
disambiguation_result: structurally_expected_dual_signal
tsx_runtime_reliance_signal: true
ci_build_parity_signal: true
runtime_cause_inference: false
```

- `structurally_expected_dual_signal` is a safe diagnostic label only, not a root-cause inference.
- `structurally_expected_dual_signal` unblocks no Gate.

---

## 4. Explicit non-goals

This planning document explicitly does **not**:

- choose, execute, or implement any remediation option;
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

## 5. Remediation option matrix (planning-only)

> Each option below is a **planning-level description** only. Nothing here is chosen, recommended as
> binding, executed, or authorized. Any option that would change files, runtime, or Gate state
> requires its own separate PR(s), review, and (where applicable) a separate exact GO.

### Option A — Preserve `tsx` runtime model + add explicit runtime preflight proof

- **What it would change:** add an explicit, safe-labelled runtime preflight proof step (evidence that
  the `tsx` runtime path is present and invocable in a read-only sense), without altering the runtime
  execution model.
- **What it would not change:** the `tsx`-based runtime execution model itself; no compiled artifact
  introduced.
- **Expected risk reduction:** converts the `tsx_runtime_reliance_signal` from an unproven assumption
  into a preflight-proven, safe-labelled fact; reduces ambiguity about runtime-loader availability.
- **Risks introduced:** low; a preflight step that is itself L3 if it touches the server; risk of
  scope creep into execution if not tightly bounded.
- **Touches source/package/script/workflow/dependency/lockfile:** likely a small script/preflight
  addition (package script or workflow step) — **to be confirmed in a separate planning PR**.
- **Could affect worker/risk-evidence/record-only paths:** only as read-only preflight; must not
  execute them.
- **Could affect customer-output / Gate D/E:** no; must not.
- **Required future PR type:** command-pack + (if any file change) a separate code PR.
- **Required future review:** yes.
- **Required future exact GO:** yes, if it touches the server/runtime (L3 preflight).
- **Evidence needed after execution:** safe-labelled preflight evidence PR.
- **Rollback / no-op boundary:** read-only preflight is a no-op; any added file change rolls back by
  reverting that separate PR.

### Option B — Introduce a compiled build artifact / compiled runtime path

- **What it would change:** add a compiled build artifact and a compiled runtime path for risk-worker
  execution (e.g. `tsc`-emitted output consumed at runtime instead of `tsx`).
- **What it would not change:** the risk-worker's logical behavior/contract (goal: behavior-preserving).
- **Expected risk reduction:** removes runtime-loader reliance; aligns runtime with a build artifact,
  addressing both `tsx_runtime_reliance_signal` and `ci_build_parity_signal` at the structural root.
- **Risks introduced:** highest of the options — build/runtime wiring change, potential behavior drift,
  new build-artifact management, CI implications; must be behavior-verified.
- **Touches source/package/script/workflow/dependency/lockfile:** yes — package scripts, likely
  workflow, possibly dependencies/lockfile. Significant change surface.
- **Could affect worker/risk-evidence/record-only paths:** yes — this changes how the worker is
  executed; requires careful L2/L3 verification.
- **Could affect customer-output / Gate D/E:** not directly, but must be proven not to; Gate remains
  blocked until separately proven.
- **Required future PR type:** planning PR → command-pack/verification → code PR(s), staged.
- **Required future review:** yes, thorough.
- **Required future exact GO:** yes, for any server/runtime/deploy verification (L3).
- **Evidence needed after execution:** behavior-parity evidence + safe-labelled build/runtime evidence.
- **Rollback / no-op boundary:** revert the code PR(s); build path reverts to `tsx`; must define a
  clean rollback point before execution.

### Option C — Add CI/build parity proof without changing runtime behavior

- **What it would change:** add a CI/build parity proof (e.g. a static/CI check that build shape and
  runtime expectation agree), leaving runtime behavior unchanged.
- **What it would not change:** the runtime execution model; no compiled runtime path introduced.
- **Expected risk reduction:** converts `ci_build_parity_signal` into a proven, safe-labelled parity
  fact; reduces the parity dimension of the ambiguity without runtime risk.
- **Risks introduced:** low–moderate; a CI/workflow or checker addition — must itself pass the static
  guardrail discipline and not alter runtime.
- **Touches source/package/script/workflow/dependency/lockfile:** likely workflow and/or a checker/
  script addition — **to be confirmed in a separate planning PR**.
- **Could affect worker/risk-evidence/record-only paths:** no (static/CI only); must not execute them.
- **Could affect customer-output / Gate D/E:** no; must not.
- **Required future PR type:** planning PR → checker/workflow code PR.
- **Required future review:** yes.
- **Required future exact GO:** not necessarily (may be L1/static if no server touch); confirm per
  scope. Any server/CI-secret touch escalates to L3.
- **Evidence needed after execution:** safe-labelled parity-proof evidence (static).
- **Rollback / no-op boundary:** revert the checker/workflow PR; no runtime state to roll back.

### Option D — Defer remediation and keep Gate D/E blocked

- **What it would change:** nothing. Record a decision to defer.
- **What it would not change:** everything — the current sealed state, runtime, and Gate-blocked status
  all persist.
- **Expected risk reduction:** none (status quo); but zero new risk introduced.
- **Risks introduced:** none technical; carries the standing risk that the dual signal remains
  unremediated and Gate D/E stays blocked.
- **Touches source/package/script/workflow/dependency/lockfile:** no.
- **Could affect worker/risk-evidence/record-only paths:** no.
- **Could affect customer-output / Gate D/E:** no; Gate D/E remains blocked.
- **Required future PR type:** none (or a short docs-only decision record).
- **Required future review:** minimal.
- **Required future exact GO:** none.
- **Evidence needed after execution:** none beyond the deferral record.
- **Rollback / no-op boundary:** inherently a no-op; reversible by opening a new remediation planning PR.

---

## 6. Recommended sequencing (planning-only, non-binding)

> Non-binding planning suggestion only; authorizes nothing and chooses no option.

- A low-risk, evidence-first sequence *could* be: **Option C (static parity proof)** and/or
  **Option A (runtime preflight proof)** first — because they are lower-risk and produce safe-labelled
  facts — before considering **Option B (compiled runtime path)**, which is the largest change surface.
- **Option D (defer)** remains valid at any point and is the default until a remediation option is
  separately planned, reviewed, and (where applicable) GO-authorized.
- This sequencing is illustrative. The actual choice is a separate architecture-judgment decision made
  in a follow-up planning PR; nothing here commits to it.

---

## 7. Forbidden actions

Forbidden here and unless separately planned, reviewed, and (where applicable) covered by a distinct
exact GO:

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
- [ ] No option selection treated as authorization.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.
- [ ] No Phase C migration.

---

## 8. Safe output / evidence contract

- This planning document contains **safe labels / booleans / counts and planning prose only**.
- Any future remediation must record its outcome in a **separate PR** with safe labels/evidence only —
  no raw logs, exact errors, stack traces, dependency-file contents, env values, SQL results, customer
  data, secrets, DSNs, hosts, private paths, or base64 blobs.
- Future remediation evidence must reaffirm sealed state and `runtime_cause_inference: false` unless a
  separately-authorized step legitimately changes it with recorded justification.

---

## 9. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **This PR authorizes no Gate D / Gate E movement.**
- **No option** described in this planning PR (A, B, C, or D) may be treated as authorization to move
  Gate D/E.
- Any Gate D / Gate E movement must be **separately proven independent** of the sealed risk-worker
  state, or **separately authorized after remediation evidence**, under its own planning + (where
  applicable) exact GO.
- No remediation option outcome, by itself, unblocks any Gate or implies scoring/customer-output
  readiness.

---

## 10. Negative-action ledger (this planning PR)

```yaml
option_selected: false
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

## 11. Future authorization model

- **Option selection** is a separate architecture-judgment decision recorded in a follow-up planning PR.
- **Static-only remediation** (e.g. a checker/parity proof with no server touch) may proceed as an
  L1/static code PR under normal review; no exact GO required unless it touches the server or secrets.
- **Server/runtime/deploy remediation** (e.g. Option A preflight touching the server, or Option B
  compiled runtime path) is L3: requires its own planning PR, command-pack review, and a **separate
  exact GO**, with safe-labelled evidence afterward.
- **No silent escalation:** a PR that starts as static/planning may not perform L2/L3 actions; any such
  action requires its own planning + GO.

---

## 12. Post-remediation interpretation rules

For a future, separately-authorized remediation (not this PR):

- **Success:** the chosen option's stated change is applied within its authorized scope, safe-labelled
  evidence recorded, sealed state and `runtime_cause_inference: false` preserved (or changed only with
  recorded, authorized justification).
- **Blocked:** any precondition, review blocker, or fail-closed criterion tripped.
- **Inconclusive:** remediation applied but the dual signal persists as structurally expected;
  acceptable — authorizes no Gate movement.
- **Allowed follow-up:** record safe-labelled evidence; open the next planning PR if needed.
- **Requires new planning PR + (where applicable) exact GO:** any further remediation, worker/
  classifier/risk-evidence/record-only execution, SQL/psql, mutation, deploy, Gate D/E movement, or
  customer-output action.
- No interpretation may assert a runtime root cause on the basis of this planning document.

---

_End of planning document. Docs-only. Authorizes no fix, execution, retry, Gate D/E, or customer-output action. No option chosen. Sealed state preserved._
