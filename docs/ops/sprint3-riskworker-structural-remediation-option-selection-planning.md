# Sprint 3 — Risk-Worker Structural Remediation Option Selection Planning

> **Docs-only planning document.** Records a **planning-level recommended direction** following the
> merged options comparison (PR #388, Options A/B/C/D). This document **recommends** a preferred
> target architecture; it does **not authorize implementation** and changes no source, package
> scripts, workflow, dependencies, lockfile, runtime behavior, worker execution, or Gate D/E state.
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

## STATUS: `SPRINT3_RISKWORKER_STRUCTURAL_REMEDIATION_OPTION_SELECTION_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Structural Remediation Option Selection Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_STRUCTURAL_REMEDIATION_OPTION_SELECTION_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file recording a planning-level recommended direction.
  No implementation. No code, package script, workflow, checker, dependency, lockfile, refactor, or
  Phase C change. No execution of any kind.
- **Layer:** L1 (docs-only).
- **Recommendation is not authorization:** recommending a preferred target architecture does not
  authorize building it.

---

## 3. Current known safe facts (from merged trail)

Recorded context — safe labels only:

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

- None of these labels are root-cause inferences.
- None of these labels unblock Gate D/E.
- Trail: PR #378 (template) → #379 (RDBF planning) → #380 (RDBF command-pack) → #381 (RDBF evidence,
  `build_surface`) → #382 (build_surface investigation planning) → #383 (sublabel command-pack) →
  #384 (sublabel evidence, `unknown_build_surface`) → #385 (ambiguity disambiguation planning) →
  #386 (disambiguation command-pack) → #387 (disambiguation evidence,
  `structurally_expected_dual_signal`) → #388 (remediation options A/B/C/D).

---

## 4. Decision context from PR #388

PR #388 compared four remediation options at planning level, chose none, and authorized nothing:

- **Option A** — Preserve `tsx` runtime model + add explicit runtime preflight proof.
- **Option B** — Introduce a compiled build artifact / compiled runtime path for risk-worker execution.
- **Option C** — Add CI/build parity proof without changing runtime behavior.
- **Option D** — Defer remediation and keep Gate D/E blocked.

PR #388 recorded, per option: what would/would not change, expected risk reduction, risks introduced,
file/path impact, worker/risk-evidence/record-only impact, customer-output/Gate D/E impact, required
future PR type/review/exact-GO, evidence needed, and rollback/no-op boundary. This document builds on
that comparison to record a **planning-level recommended direction only**.

---

## 5. Selected recommended direction (planning-only)

> Planning recommendation only. **Not** an authorization to implement.

- **Recommended target architecture: Option B** — *compiled build artifact / compiled runtime path*
  for risk-worker execution.
- **Option C** (CI/build parity proof) should be used as **supporting proof** alongside Option B.
- **Runtime preflight proof** (the preflight element from Option A) should be used as **final
  deployment/runtime verification** of the Option B path.
- **Option A** (preserve `tsx` runtime model) may be **retained only as a fallback or temporary
  diagnostic model**, not the preferred long-term Gate D/E foundation.
- **Option D** (defer) remains valid **only if** remediation is deferred and Gate D/E remain blocked.

This selection is a recommended direction for a future, separately-authorized implementation sequence.
It does not build, change, or execute anything.

---

## 6. Why Option B is preferred

- It addresses the structural root of `structurally_expected_dual_signal`: both
  `tsx_runtime_reliance_signal` and `ci_build_parity_signal` stem from a runtime-loader execution model
  without a compiled artifact. A compiled build artifact / compiled runtime path removes runtime-loader
  reliance and aligns runtime with a built artifact.
- It provides the most durable long-term foundation for a future Gate D/E readiness review, because it
  reduces the runtime/build ambiguity rather than only proving it.
- It converts an ambiguous dual signal into a single, well-defined runtime model that can be verified
  with parity proof (Option C) and preflight verification (Option A preflight element).

> Preference is architecture judgment recorded for planning. It authorizes no implementation.

---

## 7. Why Option A is weaker

- Preserving the `tsx` runtime model leaves the runtime-loader reliance in place; the preflight proof
  documents the reliance rather than removing it.
- It does not resolve the structural dual signal; it only adds evidence about one side of it.
- It is therefore suitable as a **fallback or temporary diagnostic model**, or as the **preflight
  verification element** of Option B — not as the preferred long-term Gate D/E foundation.

---

## 8. Why Option C is necessary but insufficient alone

- A CI/build parity proof is **necessary**: it converts `ci_build_parity_signal` into a proven,
  safe-labelled parity fact and guards against build/runtime drift.
- It is **insufficient alone**: it proves parity but does not change the runtime execution model, so it
  does not remove runtime-loader reliance. On its own it leaves `tsx_runtime_reliance_signal` in place.
- Therefore Option C is recommended as **supporting proof for Option B**, not as a standalone remedy.

---

## 9. Why Option D keeps Gate D/E blocked

- Option D changes nothing and introduces no new risk, but performs no remediation.
- Under Option D, the structural dual signal remains and the risk-worker sealed state persists;
  therefore **Gate D and Gate E remain blocked** wherever they depend on the risk-worker, risk
  evidence, scoring readiness, customer output, or production validation.
- Option D remains valid only as an explicit deferral with Gate D/E blocked.

---

## 10. Expected future implementation phases (planning-only)

> Illustrative planning phases only. Each phase is separately planned, reviewed, and (where server/
> runtime is touched) GO-authorized. Nothing here authorizes any phase.

1. **Design** — compiled-artifact implementation design (how the compiled runtime path would be wired,
   behavior-preserving).
2. **Minimal implementation** — the smallest behavior-preserving change to introduce the compiled
   runtime path, *if approved*.
3. **Static validation evidence** — safe-labelled static proof (including Option C parity proof).
4. **Controlled runtime/preflight proof** — Option A preflight element as final runtime verification,
   *if needed*, under a separate exact GO (L3).
5. **Post-remediation evidence** — safe-labelled evidence of the remediation outcome.
6. **Gate D/E readiness review** — a separate readiness review, **only after** remediation evidence.

---

## 11. Required future PR sequence (planning-only)

1. Compiled-artifact implementation **design PR** (docs-only).
2. Minimal **implementation PR**, if approved (separate review).
3. Static **validation evidence PR**.
4. Controlled **runtime/preflight proof**, if needed, under a separate exact GO.
5. Post-remediation **evidence PR**.
6. Separate **Gate D/E readiness review**, only after remediation evidence.

> This sequence is planning-only. This PR opens none of these and authorizes none of them.

---

## 12. Forbidden actions

Forbidden here and unless separately planned, reviewed, and (where applicable) covered by a distinct
exact GO:

- [ ] No implementation of any option.
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
- [ ] No recommendation treated as authorization.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.
- [ ] No Phase C migration.

---

## 13. Safe evidence contract

- This planning document contains **safe labels / booleans / counts and planning prose only**.
- Any future implementation or verification must record its outcome in a **separate PR** with safe
  labels/evidence only — no raw logs, exact errors, stack traces, dependency-file contents, env
  values, SQL results, customer data, secrets, DSNs, hosts, private paths, or base64 blobs.
- Future evidence must reaffirm sealed state and `runtime_cause_inference: false` unless a
  separately-authorized step legitimately changes it with recorded justification.

---

## 14. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Selecting Option B as the preferred target architecture does not unblock Gate D/E.**
- No recommendation in this PR may be treated as authorization to move Gate D/E.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + (where applicable) exact GO.

---

## 15. Negative-action ledger (this planning PR)

```yaml
option_implemented: false
implementation_performed: false
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

## 16. Future authorization model

- **Recommendation** (this PR) is architecture judgment recorded for planning; it authorizes nothing.
- **Design PR** (phase 1) is docs-only; normal review.
- **Static-only implementation/validation** (phases 2–3, if no server touch) proceeds as L1/static code
  PRs under normal review; no exact GO required unless the server or secrets are touched.
- **Server/runtime/deploy verification** (phase 4) is L3: requires its own planning, command-pack
  review, and a **separate exact GO**, with safe-labelled evidence afterward.
- **Gate D/E readiness review** (phase 6) is a separate review after remediation evidence and is not
  implied by any earlier phase.
- **No silent escalation:** a PR that starts as planning/static may not perform L2/L3 actions; any such
  action requires its own planning + GO.

---

## 17. Post-selection interpretation rules

- **This document's effect:** a recorded planning-level recommendation (Option B preferred, C
  supporting, A-preflight for verification / A-model as fallback, D as deferral). No implementation,
  no Gate movement, no state change beyond recording the recommendation.
- **Allowed follow-up:** open the phase-1 design PR (docs-only) when ready.
- **Requires new planning PR + review + (where applicable) exact GO:** any implementation, static or
  runtime verification, worker/classifier/risk-evidence/record-only execution, SQL/psql, mutation,
  deploy, Gate D/E movement, or customer-output action.
- No interpretation may treat this recommendation as authorization or as a root-cause inference; the
  sealed classification stands unchanged.

---

_End of planning document. Docs-only. Recommends Option B as preferred target architecture but authorizes no implementation, fix, execution, retry, Gate D/E, or customer-output action. Sealed state preserved._
