# Sprint 3 — Risk-Worker Option B Slice 3 (Compiled Runtime Switch) Planning

> **Docs-only planning document.** Plans the **next implementation slice** for Option B
> (*compiled build artifact / compiled runtime path*) after PR #393 (constants + build scaffold) and
> PR #395 (CI/build parity proof): the slice that will later **switch the risk-worker runtime** from
> the current `tsx` scripts to the compiled `node`-runnable artifact. This document **plans but does
> not implement**; it registers no constant, edits no registry file, changes no
> source/package/script/workflow/dependency/lockfile/runtime behavior, and **does not run**
> `build:riskworker-artifact` or generate any artifact.
>
> **Authorizes nothing.** No implementation, no workflow change, no package-script change, no build
> execution, no artifact generation, no runtime switch, no worker/classifier/risk-evidence/record-only
> execution, no SQL/psql, no DB/network, no production access, no server/runtime touch, no Gate D/E
> movement, no customer-output action, no fix, no retry, no root-cause inference. The eventual Slice 3
> implementation PR may proceed **only after this planning PR is reviewed and merged**, under its own
> review and — where server/runtime/build execution is involved — under a **separate exact GO** (see
> §12 and §13).
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None of these labels are root-cause inferences; none unblock
> Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_SLICE3_COMPILED_RUNTIME_SWITCH_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Option B Slice 3 (Compiled Runtime Switch) Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_SLICE3_COMPILED_RUNTIME_SWITCH_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file under `docs/ops/`. Plan the next Option B
  implementation slice (the compiled runtime switch: wiring and — later — activating the compiled
  `node` risk-worker run path). No implementation, no workflow change, no package-script change, no
  dependency/lockfile change, no source/runtime behavior change, and no execution in this PR.
- **Change class:** **docs-only**.
- **Layer (this PR):** L1 (docs-only).
- **Suggested file:** `docs/ops/sprint3-riskworker-option-b-slice3-compiled-runtime-switch-planning.md`.

---

## 3. Current known safe facts (from merged trail)

```yaml
broad_category: runtime_dependency_or_build_failure
prior_subclassifier_retry_state: blocked_none_not_classified
surface_label: build_surface
previous_sublabel: unknown_build_surface
disambiguation_label: structurally_expected_dual_signal
runtime_cause_inference: false
```

Known safe state as of PR #395 merge (base `sprint2-architecture-contracts-d4cc2bf`
@ `f3d86de5a317a9b166843b9b4888414ee4b5ea42`):

- **PR #393** registered the Option B constants and introduced the **minimal build scaffold**
  (`tsconfig.riskworker-artifact.json` + the `build:riskworker-artifact` npm script).
- **PR #395** added and **enforced** the **CI/build parity proof**: `proof:riskworker-ci-build-parity`
  is wired to `scripts/checks/check-riskworker-build-parity.mjs`, added to the static-guardrail bundle,
  and run by the `static-guardrails` workflow.
- **`proof:riskworker-ci-build-parity` is green** — it proves the Option B build path is present,
  referenced, and internally consistent (build-path parity **only**), without invoking the build.
- `build:riskworker-artifact` **exists but has not been executed**.
- The **compiled runtime path is not active**.
- `run:riskworker-compiled` (`RISKWORKER_COMPILED_RUN_COMMAND`) **remains unwired**.
- Runtime preflight (`proof:riskworker-runtime-preflight`, `RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND`)
  **remains unwired**.
- Existing `tsx` risk-worker scripts (`risk-evidence:run`, `risk-evidence:record-only`) **remain active
  and unchanged**.
- **No generated artifact is committed.**
- `build_surface`, `unknown_build_surface`, and `structurally_expected_dual_signal` are **safe
  diagnostic labels only** — not root-cause inferences.
- Gate D/E remain **blocked where dependent** (risk-worker, risk evidence, scoring readiness, customer
  output, or production validation).
- Trail: PR #378 → … → #389 (Option B chosen) → #390 (design) → #391 (constants planning) →
  #392 (Slice 1 planning) → #393 (Slice 1 impl) → #394 (Slice 2 planning) → #395 (Slice 2 impl).

---

## 4. Slice 3 objective

Plan the slice that, in a **future** separately-reviewed PR (and — where it executes build/runtime or
touches server — under a **separate exact GO**), will **switch the risk-worker runtime** from the
current `tsx` scripts to the **compiled `node`-runnable artifact** produced by the Slice 1 build
scaffold and proven coherent by the Slice 2 parity proof.

The intent: give the risk-worker a **compiled runtime path** (`node dist/riskworker/...`) as the Option
B design specifies, so risk-worker execution no longer depends on the `tsx` transpile-at-runtime
toolchain — while keeping every safety boundary (record-only gate, customer-output boundary, Gate D/E)
intact and reversible.

Slice 3 is where the **runtime actually changes** (or is at least *wired* to change). It is therefore
the slice at which the layer **escalates from L1/static to L3** the moment it executes the build,
activates the compiled run command, touches server/runtime, or changes actual worker execution
behavior (see §11–§13).

---

## 5. Compiled runtime switch goal

The compiled runtime switch, when later implemented and (where applicable) authorized, is intended to:

- provide a **compiled run command** — the reserved `run:riskworker-compiled`
  (`RISKWORKER_COMPILED_RUN_COMMAND`) — that runs the **compiled** risk-evidence worker entrypoint
  (`RISKWORKER_COMPILED_ENTRYPOINT` = `dist/riskworker/scripts/run-risk-evidence-worker.js`) via `node`,
  in parity with the existing `tsx` entrypoint (same inputs/behavior contract, compiled form only);
- keep the **record-only** wrapper's compiled form
  (`RECORD_ONLY_COMPILED_ENTRYPOINT` = `dist/riskworker/scripts/run-risk-evidence-record-only-worker.js`)
  behind the **same** fail-closed record-only gate that governs the `tsx` wrapper today — no relaxation;
- make the switch **staged and reversible**: wiring the command name (L1/static) is distinct from
  executing the build (L3) which is distinct from making the compiled path the **default/authorized**
  runtime (L3, production) — each is its own separately-reviewed step (see §6, §7, §8);
- preserve every existing boundary: the existing `tsx` scripts remain available as the rollback path
  until the compiled path is separately proven and authorized; the record-only gate,
  customer-output boundary, observer boundaries, and pg-pool construction allowlist stay green.

The switch changes **how the risk-worker is invoked** (compiled `node` vs `tsx`). It asserts **no** root
cause for the sealed classification, and it unblocks **no** Gate by itself.

---

## 6. Proposed future package-script wiring (for the future implementation PR, not this one)

Illustrative, **non-binding** shapes to be fixed against the registry in the future PR:

- **Wire (L1/static-representable):** add a `run:riskworker-compiled` npm script whose command is the
  registered compiled run form (e.g. `node dist/riskworker/scripts/run-risk-evidence-worker.js`),
  referencing the **already-registered** `RISKWORKER_COMPILED_RUN_COMMAND` /
  `RISKWORKER_COMPILED_ENTRYPOINT` names from PR #393 (no new raw literal). Merely **adding** the script
  text — without running it, without executing the build, without touching server/runtime — is
  **L1/static** wiring (it does not, by itself, change how any *existing* command runs).
- **Any execution of that script is NOT wiring.** Running `run:riskworker-compiled` (which runs the
  worker) is **L3** runtime execution and requires a separate exact GO (see §12, §13).
- Any new package-script must **not** modify or remove existing scripts, must **not** relax the
  static-guardrail bundle, and must keep `build:riskworker-artifact` and the parity proof unchanged
  unless a change is separately justified and reviewed.

> **This planning PR adds no package script and wires nothing.** It only enumerates the candidate wiring
> shape for the future PR.

---

## 7. Proposed future build execution boundary (for the future implementation PR, not this one)

- **Building is not switching.** Executing `build:riskworker-artifact` (running `tsc` to emit the
  compiled artifact into the gitignored `dist/riskworker/`) is a **build execution**, not a runtime
  switch and not a worker run. Even so, build execution is **beyond L1/static** and must be done in a
  **non-production** context under its **own** separately-reviewed step (see §11) — this planning PR
  does **not** run it and does **not** authorize it.
- Build execution must remain **source-only** and **non-production**: no server, no runtime worker
  invocation, no DB/network, no secrets, no production data, no customer output.
- Building or parity-checking an artifact **does not execute** it. The compiled artifact must not be
  **run** as part of a build step.
- **This planning PR runs no build.** `build:riskworker-artifact` is **not executed** here.

---

## 8. Proposed future compiled run command boundary (for the future implementation PR, not this one)

- The compiled run command `run:riskworker-compiled` is the point at which the **worker actually
  executes** on the compiled path. **Executing** it is **L3 runtime execution** and requires a
  **separate exact GO** (server/runtime touch, and — if pointed at production data/DB — production
  authorization).
- **Wiring** the command name (adding the script) may be L1/static (see §6); **running** it is never
  L1/static.
- The compiled run command must run the **same** worker behavior contract as the current `tsx`
  entrypoint — it is a **form** change (compiled `node`), not a behavior change. Any behavior change is
  out of scope for Option B and requires its own separate planning.
- Until separately proven and authorized, the compiled run command must **not** become the
  **default/authorized** runtime; the existing `tsx` scripts remain the active path and the rollback.
- **This planning PR wires no run command and runs nothing.**

---

## 9. Artifact generation and artifact retention policy

- The compiled artifact (under `COMPILED_ARTIFACT_ROOT` = `dist/riskworker/`) is a **generated,
  gitignored** build by-product. It is **not committed**, **not published**, and **not promoted** to a
  runtime path by this plan.
- **Generation** happens only if/when the build execution step (§7) is separately run in a
  non-production context. **Retention** is **transient**: the artifact is a local/CI build output, not a
  source-controlled artifact; it is rebuilt from source and never checked in.
- No artifact is generated or committed in this planning PR, in Slice 1 (PR #393), or in Slice 2
  (PR #395). Any future PR that would **commit** an artifact is explicitly out of scope and would need
  its own separate justification and review (the default policy is: **never commit generated
  artifacts**).

---

## 10. Worker / risk-evidence / record-only boundary

- **Wiring** the compiled run command (§6) executes **nothing**: it runs no worker, no classifier, no
  risk-evidence, and no record-only pass.
- **Executing** the compiled worker (running `run:riskworker-compiled`) is a **worker run** and is **L3**
  runtime execution; it is **not** performed or authorized by this plan.
- The record-only and risk-evidence boundaries must remain intact: the compiled record-only wrapper
  (`RECORD_ONLY_COMPILED_ENTRYPOINT`) must stay behind the **same** fail-closed record-only gate
  (`worker_execution_authorized=false` marker; `check:record-only-gate` stays green) with **no** coupling
  to customer-output/Lane. The `check:record-only-gate` and `check:customer-output-boundary` guardrails
  must stay green in any future Slice 3 PR.
- **This planning PR executes nothing.**

---

## 11. Layer classification (Slice 3) — L3 classification trigger criteria

Slice 3's layer depends entirely on **what the future PR does**:

- **L1 / static** — *only if* the future PR **only adds package-script wiring** (e.g. the
  `run:riskworker-compiled` script text) and does **not** execute the build, does **not** run the
  compiled worker, does **not** touch server/runtime, and does **not** change actual worker execution
  behavior. Pure wiring that leaves every existing command running exactly as before may be reviewed as
  **L1/static** under normal review with the guardrail bundle — **no exact GO required**.
- **L3 — triggered the moment** the future PR does **any** of the following:
  - executes `build:riskworker-artifact` (build execution), **or**
  - activates / executes `run:riskworker-compiled` (compiled worker run), **or**
  - touches server / runtime / production / DB / network / secrets, **or**
  - changes actual worker execution behavior (makes the compiled path the default/authorized runtime, or
    alters how the risk-worker runs).

  Any of these makes Slice 3 **L3**: it must be **separately planned**, **narrowly scoped**, **never
  hidden inside a normal code PR**, and covered by a **separate exact GO** (see §12).
- **No silent escalation.** A Slice 3 PR that starts as L1/static wiring may **not** silently perform L2
  or L3 actions. Any build/runtime/server/DB/network/customer-output/Gate action requires its **own
  planning PR and explicit GO**.

---

## 12. Required future exact-GO conditions (if server/runtime/build execution is involved)

If (and only if) Slice 3 involves build execution, compiled-run activation, server/runtime touch, or a
worker-behavior change, the future work must, **before** any such action:

- have this planning PR (and, for the L3 portion, a **separate L3 planning PR**) reviewed and merged;
- obtain a **scoped, explicit HELEN GO** for the **exact** action (build execution / compiled-run
  activation / runtime switch), per the CLAUDE.md stop-lines;
- run any build execution in a **non-production, source-only** context (no server, no production data,
  no secrets, no DB/network, no customer output);
- keep the existing `tsx` scripts available as the **rollback** path until the compiled path is
  separately proven and authorized;
- record **safe-labelled** evidence only (see §15) — no raw logs, exact errors, stack traces,
  dependency-file contents, env/secret values, DSNs, hosts, private paths, SQL results, customer data,
  or base64 blobs.

Absent such a scoped GO, Slice 3 must remain **L1/static wiring only** or **not proceed**.

---

## 13. Customer-output / Gate D/E boundary

- Slice 3 must **not** touch customer-output generation or Gate D/E surfaces.
- Wiring or (separately authorized) running the compiled worker produces **no** customer output and
  moves **no** Gate by itself.
- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Planning Slice 3 does not unblock Gate D/E.** Any Gate D/E movement requires **separate remediation
  evidence** and a **separate readiness review**, under its own planning + (where applicable) exact GO.

---

## 14. Validation plan

- This planning PR (docs-only) is validated with the safe static bundle **plus the parity proof**
  (`git diff --check` + the eight `check:*` scripts + `proof:riskworker-ci-build-parity`).
  `check:constants` stays green because no raw constant-like literal is introduced in code and no
  registry file is edited. The parity proof stays green because no build wiring changes.
- The commands run for **this** PR:
  - `git diff --check`
  - `npm run check:constants`
  - `npm run check:static-boundaries`
  - `npm run check:pg-pool-construction`
  - `npm run check:observer-shape`
  - `npm run check:record-only-gate`
  - `npm run check:customer-output-boundary`
  - `npm run check:db-pool-factory-scaffold`
  - `npm run check:no-runtime-imports`
  - `npm run proof:riskworker-ci-build-parity`
- The future Slice 3 implementation PR must additionally: pass the full static guardrail bundle
  (including the parity proof); if it adds `run:riskworker-compiled` wiring, keep the bundle green with
  the reserved-name wiring now present; register any new constant-like literal in **both** registry
  files before use; and be reviewed. Its layer (L1/static wiring vs L3) is determined per §11, and any
  build/runtime/server-touching portion requires a separate L3 plan + exact GO (§12).

---

## 15. Evidence plan

- The future Slice 3 PR records its outcome as a supporting docs file using **safe labels only** (e.g.
  wiring-presence booleans such as `compiled_run_command_wired`, `compiled_runtime_path_active`,
  `tsx_scripts_unchanged`, and counts) — no raw logs, raw build/worker output, exact errors, stack
  traces, dependency-file contents, env values, SQL results, customer data, secrets, DSNs, hosts,
  private paths, or base64 blobs.
- Any build-execution or compiled-run (L3) step records its **own** safe-labelled evidence under its
  **separate** exact GO, in a non-production context.

---

## 16. Rollback / no-op boundary

- **This planning PR** is inherently a no-op on runtime/build/workflow/registry state; there is nothing
  to roll back beyond reverting the single docs file.
- **Future Slice 3 (L1/static wiring)** rolls back by reverting its PR: remove the added
  `run:riskworker-compiled` script (and any registry entry it introduced). Because pure wiring does not
  switch the runtime and commits no artifact, this rollback carries no runtime-behavior risk.
- **Future Slice 3 (L3 activation)** rolls back by reverting to the existing `tsx` scripts (which remain
  present as the active/rollback path) and de-authorizing the compiled path; the gitignored artifact is
  transient and simply not run. Full rollback semantics are defined in the separate L3 plan.

---

## 17. Forbidden actions

Forbidden here, and unless separately planned, reviewed, and (where applicable) covered by a distinct
exact GO:

- [ ] No implementation of Slice 3 or any other slice.
- [ ] No package-script change; no `run:riskworker-compiled` wiring; no `check:*`/`proof:*` change.
- [ ] No workflow change; no CI job addition.
- [ ] No dependency or lockfile change.
- [ ] No constants registration; no `.claude/constants.md` edit; no `config/constants.ts` edit.
- [ ] No source or runtime behavior change; no command runs differently.
- [ ] No execution of `build:riskworker-artifact`; no build run.
- [ ] No activation or execution of `run:riskworker-compiled`; no compiled worker run.
- [ ] No runtime preflight wiring or execution.
- [ ] No activation of the compiled runtime path; no runtime switch.
- [ ] No artifact generation; no generated artifact committed.
- [ ] No worker / classifier / risk-evidence / record-only execution.
- [ ] No SQL / psql.
- [ ] No DB / network action.
- [ ] No DB mutation.
- [ ] No production access.
- [ ] No server / runtime touch.
- [ ] No secret / env read (values) or edit.
- [ ] No deploy.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate D / Gate E / Gate4E / Gate4F movement.
- [ ] No private capture path printing (`run.err` / `run.safe.out` / private captures).
- [ ] No raw logs, raw build/worker output, exact errors, stack traces, dependency-file contents, env
      values, DSNs, hosts, or private paths in output.
- [ ] No raw customer data (never).
- [ ] No fix / remediation / retry loop.
- [ ] No concrete new constant value committed (no raw literal ahead of registration).
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.

---

## 18. Negative-action ledger (this planning PR)

```yaml
slice3_implemented: false
package_script_changed: false
run_command_wired: false
workflow_changed: false
ci_job_added: false
dependency_or_lockfile_changed: false
constants_md_edited: false
config_constants_ts_edited: false
constant_value_registered: false
source_or_runtime_changed: false
command_runs_differently: false
build_riskworker_artifact_executed: false
build_run_performed: false
artifact_generated: false
artifact_committed: false
compiled_runtime_path_activated: false
compiled_run_command_executed: false
runtime_preflight_wired_or_executed: false
runtime_switch_performed: false
execution_performed: false
worker_rerun_performed: false
classifier_rerun_performed: false
risk_evidence_rerun_performed: false
record_only_rerun_performed: false
sql_or_psql_performed: false
db_network_action_performed: false
production_access_performed: false
server_or_runtime_touch_performed: false
secret_or_env_read_performed: false
deploy_performed: false
customer_output_or_gate_performed: false
gate_d_or_e_movement_performed: false
fix_or_retry_loop_performed: false
root_cause_inference_performed: false
raw_logs_in_doc: false
raw_build_output_in_doc: false
raw_worker_output_in_doc: false
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

## 19. Future authorization model

The eventual **Slice 3 implementation PR** may proceed **only after this planning PR is reviewed and
merged**, and must:

- reference the **already-registered** Option B names (PR #393) and register any **new** constant-like
  literal in **both** `.claude/constants.md` and `config/constants.ts` **before use** (registration +
  first use in the same PR);
- **distinguish** the layers explicitly:
  - **L1/static wiring** (adding `run:riskworker-compiled` script text only, no execution) → normal
    review with the guardrail bundle, **no exact GO required**;
  - **L3** (build execution, compiled-run activation, server/runtime touch, or worker-behavior change)
    → **separate L3 planning PR + separate exact GO**, non-production/source-only where applicable;
- **not** execute the build, activate the compiled run, or switch the runtime without the exact GO;
- **not** run worker / classifier / risk-evidence / record-only without the exact GO;
- **not** touch DB / network / SQL / server / production / secrets;
- **not** touch customer-output / Gate D/E;
- **not** claim root cause;
- **not** unblock Gate D/E;
- keep the existing `tsx` scripts as the active/rollback path until the compiled path is separately
  proven and authorized.

**No silent escalation.**

---

## 20. Post-planning interpretation rules

- **This document's effect:** a recorded, planning-level definition of the next Option B implementation
  slice (the compiled runtime switch). No implementation, no workflow change, no package-script change,
  no build execution, no artifact generation, no runtime switch, no Gate movement, no state change
  beyond recording the plan.
- **Allowed follow-up:** open the Slice 3 implementation PR once this planning PR is reviewed and
  merged, under the layer determination in §11 — L1/static for pure wiring, **or** a separate L3 plan +
  exact GO for any build/runtime/server/worker-behavior action.
- **Requires new PR + review + (where applicable) exact GO:** any package-script change, workflow
  change, build execution, artifact generation, compiled-run activation, runtime switch, runtime
  preflight wiring/execution, worker/classifier/risk-evidence/record-only execution, SQL/psql, mutation,
  deploy, Gate D/E movement, or customer-output action.
- No interpretation may treat this plan as authorization or as a root-cause inference; the sealed
  classification stands unchanged.

---

## 21. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Planning Slice 3 does not unblock Gate D/E.**
- No plan in this PR may be treated as authorization to move Gate D/E or to implement anything.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + (where applicable) exact GO.

---

_End of planning document. Docs-only. Plans Slice 3 (compiled runtime switch) but authorizes no
implementation, package-script change, workflow change, build execution, artifact generation, runtime
switch, runtime/server touch, worker/risk-evidence/record-only execution, fix, retry, Gate D/E, or
customer-output action. Sealed state preserved._
