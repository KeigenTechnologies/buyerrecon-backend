# Sprint 3 — Risk-Worker Option B (Compiled Artifact / Compiled Runtime Path) Implementation Design Planning

> **Docs-only design-planning document.** Designs — at planning level only — a future implementation
> path for **Option B** (*compiled build artifact / compiled runtime path*), the preferred target
> architecture recorded in PR #389. This document **designs but does not implement**. It changes no
> source, package scripts, workflows, dependencies, lockfile, runtime behavior, or worker entrypoints.
>
> **Authorizes nothing.** No implementation, no execution, no diagnostic run, no worker/classifier/
> risk-evidence/record-only rerun, no SQL/psql, no DB/network, no Gate D/E movement, no customer-output
> action, no fix, no retry, no root-cause inference. Any future implementation requires its own PR(s),
> its own review, and — where server/runtime is touched — a **separate exact GO**.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation result `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None of these labels are root-cause inferences and none unblock
> Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_COMPILED_ARTIFACT_IMPLEMENTATION_DESIGN_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Option B (Compiled Artifact / Compiled Runtime Path) Implementation Design
Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_COMPILED_ARTIFACT_IMPLEMENTATION_DESIGN_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only design-planning file. Design a future Option B implementation
  path at planning level only. No code, package script, workflow, checker, dependency, lockfile,
  refactor, or Phase C change. No execution of any kind. **Design is not implementation.**
- **Layer:** L1 (docs-only).

---

## 3. Current known safe facts (from merged trail)

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

- **Option B** is the preferred target architecture (PR #389).
- **Option C** (CI/build parity proof) is the supporting proof.
- **Runtime preflight proof** (Option A element) is the final verification.
- Gate D/E remain blocked where dependent.
- None of these labels are root-cause inferences; none unblock Gate D/E.
- Trail: PR #378 → #379 → #380 → #381 → #382 → #383 → #384 → #385 → #386 → #387 → #388 → #389.

---

## 4. Design goal

Describe, at planning level, how a future implementation could execute the risk-worker from a
**compiled JavaScript build artifact** (a compiled runtime path) instead of a runtime-loader (`tsx`)
path — in a **behavior-preserving** way — so that the structurally-expected dual signal
(`tsx_runtime_reliance_signal` + `ci_build_parity_signal`) is resolved at the runtime-model root, with
CI/build parity proof (Option C) and a runtime preflight proof as verification.

---

## 5. Non-goals

This design-planning document explicitly does **not**:

- implement Option B or any part of it;
- edit source, package scripts, workflows, dependencies, lockfile, runtime behavior, or worker
  entrypoints;
- execute anything or run any diagnostic;
- rerun the worker, a classifier, risk-evidence, or a record-only pass;
- perform SQL/psql or any DB/network action;
- read raw logs, raw runtime output, exact errors, dependency-file contents, env values, `run.err`,
  `run.safe.out`, or private captures;
- generate Lane/scoring/AMS/customer output;
- move Gate D, Gate E, Gate4E, or Gate4F;
- infer, assert, or narrow a runtime **root cause** (`runtime_cause_inference` stays `false`);
- assert specific real entrypoint filenames as committed facts (paths below are design placeholders to
  be confirmed by a future design/implementation PR against the registry).

---

## 6. Proposed compiled artifact architecture (planning-only)

- A future implementation *could* introduce a discrete build step that emits compiled JavaScript from
  the TypeScript sources into an explicit artifact directory, and switch the risk-worker runtime
  invocation to run that compiled artifact with `node`, instead of transpiling on the fly via a
  runtime loader.
- The compiled runtime path *should* be behavior-preserving: same logical entrypoints, same contracts,
  same record-only / risk-evidence boundaries — only the execution mechanism changes (compiled artifact
  vs runtime transpile).
- CI/build parity proof (Option C) *should* assert that the compiled artifact shape matches the
  runtime expectation. A runtime preflight proof *should* verify the compiled path is present and
  invocable before any production reliance.

> All specifics are design placeholders. Exact directories, commands, and entrypoints are to be fixed
> in a future design/implementation PR against `.claude/constants.md` / `config/constants.ts`, not
> invented here.

---

## 7. Current runtime model to be replaced or bypassed (safe description)

- Recorded safe signal: `tsx_runtime_reliance_signal = true` — risk-related scripts currently rely on a
  runtime loader (`tsx`) to execute TypeScript directly, with no tracked/filesystem build-artifact
  candidate observed (per PR #384 static facts: `tracked_build_artifact_candidate_count: 0`,
  `filesystem_build_artifact_candidate_count: 0`).
- Option B would replace or bypass that runtime-transpile execution for the risk-worker with a compiled
  artifact executed by `node`, while preserving behavior.
- This document does **not** change that model; it only describes the target of a future change.

---

## 8. Build artifact boundary (planning-only)

- The artifact boundary *should* live at an **explicit, registered path** (candidate placeholders:
  `dist/`, `build/`, or another explicit directory) — the exact choice to be **registered in
  `.claude/constants.md` and `config/constants.ts` before use**, per Configuration Discipline.
- The artifact directory *should* be build-output only (generated), with clear ignore/retention rules,
  and *should not* overlap with tracked source or with record-only/risk-evidence capture paths.
- No artifact path is created, written, or committed by this planning PR.

---

## 9. Runtime entrypoint boundary (planning-only)

- The runtime entrypoint boundary *should* change from a runtime-loader invocation
  (`tsx <source-entrypoint>`) to a compiled-artifact invocation (`node <artifact-entrypoint>`), where
  `<artifact-entrypoint>` is the compiled form of the same logical risk-worker entrypoint.
- The logical entrypoint identity, arguments, and contracts *should* be preserved (behavior-preserving).
- Exact entrypoint names are design placeholders to be confirmed against the registry in a future PR.

---

## 10. Package / script / workflow impact map (planning-only, no edits)

- **Package scripts:** a future implementation PR *would likely* add a build script (compile step) and
  switch the risk-worker run script(s) from a runtime-loader invocation to a compiled-artifact
  invocation. Per PR #384 facts, `build_related_package_script_count: 1` and `build_script_uses_tsc:
  true` were observed — a build script family already exists as a starting point. **No script is edited
  here.**
- **Workflow/CI:** a future PR *would likely* add a CI build + parity-proof step (Option C). Per PR
  #387 facts, `workflow_file_count: 1` with `workflow_build_mention_count: 0` — CI currently has no
  build mention, so a parity/build proof would be additive. **No workflow is edited here.**
- This is an impact map only; it enumerates *what a future PR would touch*, not *what this PR touches*.
  This PR touches nothing but the one docs file.

---

## 11. Dependency / lockfile impact assessment (planning-only)

- Compiling TypeScript to JavaScript *should* be achievable with the already-present TypeScript
  toolchain (PR #384 facts: `typescript_dependency_present: true`, `build_script_uses_tsc: true`), so a
  future implementation *may need no new runtime dependency* for the compile step.
- Whether the runtime-loader dependency (`tsx`) is retained (as fallback per Option A) or removed is a
  **future decision**, not made here; removing it would be a dependency/lockfile change requiring its
  own PR.
- **No dependency or lockfile change occurs in this PR.**

---

## 12. Worker / risk-evidence / record-only impact assessment (planning-only)

- Option B changes **how** the worker is executed (compiled artifact vs runtime transpile), not **what**
  it does. The design intent is behavior-preserving.
- Record-only and risk-evidence boundaries *must remain intact*: the compiled path must map to the same
  entrypoints and must not couple record-only to customer-output/Lane (per existing
  `check:record-only-gate` and `check:customer-output-boundary` guardrails).
- Any future implementation *must* be verified to preserve these boundaries (static guardrails + a
  controlled runtime preflight proof) before any production reliance.
- **No worker/risk-evidence/record-only path is executed, rerun, or edited in this PR.**

---

## 13. Customer-output / Gate D/E boundary (planning-only)

- Option B design *must not* touch customer-output generation or Gate D/E surfaces.
- The compiled runtime path is a risk-worker execution-model change only; it does not produce customer
  output and does not move any Gate.
- Customer-output/Gate D/E remain untouched until remediation evidence exists and a separate readiness
  review authorizes any movement.

---

## 14. Implementation slice proposal (planning-only)

A future implementation *could* be sliced minimally as:

1. **Slice 1 (build):** add/confirm a build step that emits the compiled artifact to a registered
   artifact path — no runtime switch yet.
2. **Slice 2 (parity proof):** add Option C CI/build parity proof asserting artifact-vs-runtime shape —
   still no runtime switch.
3. **Slice 3 (runtime switch):** switch the risk-worker run script(s) to the compiled-artifact
   invocation, behavior-preserving.
4. **Slice 4 (preflight proof):** controlled runtime preflight proof verifying the compiled path, under
   a separate exact GO (L3).

Each slice is a separate PR with its own review; slices 3–4 (runtime-affecting / server-touching)
require the appropriate authorization. **This PR implements no slice.**

---

## 15. Required future PR sequence (planning-only)

1. This **design-planning PR** (docs-only) — current.
2. **Slice 1 build implementation PR**, if approved (static code PR).
3. **Slice 2 CI/build parity proof PR** (Option C).
4. **Slice 3 runtime-switch implementation PR**, behavior-preserving (separate review; runtime-affecting).
5. **Slice 4 controlled runtime/preflight proof**, if needed, under a separate exact GO.
6. **Post-remediation evidence PR** (safe labels).
7. Separate **Gate D/E readiness review**, only after remediation evidence.

> This PR opens none of these and authorizes none of them.

---

## 16. Validation and evidence plan (planning-only)

- Each future slice *must* pass the static guardrail bundle (`check:constants`,
  `check:static-boundaries`, `check:pg-pool-construction`, `check:observer-shape`,
  `check:record-only-gate`, `check:customer-output-boundary`, `check:db-pool-factory-scaffold`,
  `check:no-runtime-imports`) and record safe-labelled evidence.
- Runtime-affecting slices additionally require L2/L3 verification (parity proof; controlled preflight
  under exact GO) with safe-labelled evidence PRs.
- No evidence in any PR may contain raw logs, exact errors, stack traces, dependency-file contents, env
  values, SQL results, customer data, secrets, DSNs, hosts, private paths, or base64 blobs.

---

## 17. Rollback / no-op boundary (planning-only)

- This design-planning PR is **inherently a no-op** on runtime/build state; there is nothing to roll
  back beyond reverting the single docs file.
- For future slices: build-only and parity-proof slices roll back by reverting their PRs; the
  runtime-switch slice *must* define a clean rollback point (revert to the runtime-loader invocation)
  before execution; the preflight proof is read-only and is itself a no-op.

---

## 18. Forbidden actions

Forbidden here and unless separately planned, reviewed, and (where applicable) covered by a distinct
exact GO:

- [ ] No implementation of Option B or any slice.
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
- [ ] No design detail treated as authorization to implement.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.
- [ ] No Phase C migration.

---

## 19. Negative-action ledger (this design-planning PR)

```yaml
option_b_implemented: false
implementation_performed: false
build_artifact_created: false
runtime_entrypoint_changed: false
package_script_changed: false
workflow_changed: false
dependency_or_lockfile_changed: false
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
source_change_performed: false
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

## 20. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Designing Option B does not unblock Gate D/E.**
- No design detail in this PR may be treated as authorization to move Gate D/E.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + (where applicable) exact GO.

---

## 21. Post-design interpretation rules

- **This document's effect:** a recorded, planning-level implementation design for Option B. No
  implementation, no Gate movement, no state change beyond recording the design.
- **Allowed follow-up:** open the Slice 1 build implementation PR (static code PR) when approved, per
  Section 15.
- **Requires new PR + review + (where applicable) exact GO:** any implementation, build, runtime
  switch, static or runtime verification, worker/classifier/risk-evidence/record-only execution,
  SQL/psql, mutation, deploy, Gate D/E movement, or customer-output action.
- Any concrete constant (artifact path, entrypoint name, build/run command) must be **registered in
  `.claude/constants.md` and `config/constants.ts` before use** in a future implementation PR.
- No interpretation may treat this design as authorization or as a root-cause inference; the sealed
  classification stands unchanged.

---

_End of design-planning document. Docs-only. Designs a future Option B implementation path but authorizes no implementation, fix, execution, retry, Gate D/E, or customer-output action. Sealed state preserved._
