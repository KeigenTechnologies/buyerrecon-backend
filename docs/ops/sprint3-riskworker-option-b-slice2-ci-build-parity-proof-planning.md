# Sprint 3 — Risk-Worker Option B Slice 2 (CI / Build Parity Proof) Planning

> **Docs-only planning document.** Plans the **next implementation slice** for Option B
> (*compiled build artifact / compiled runtime path*) after PR #393: the slice that will later add a
> **CI / build parity proof** for the Option B compiled-artifact build path. This document
> **plans but does not implement**; it registers no constant, edits no registry file, changes no
> source/package/script/workflow/dependency/lockfile/runtime behavior, and **does not run**
> `build:riskworker-artifact` or generate any artifact.
>
> **Authorizes nothing.** No implementation, no workflow change, no package-script change, no build
> execution, no artifact generation, no worker/classifier/risk-evidence/record-only execution, no
> SQL/psql, no DB/network, no production access, no Gate D/E movement, no customer-output action, no
> fix, no retry, no root-cause inference. The eventual Slice 2 implementation PR may proceed **only
> after this planning PR is reviewed and merged**, under its own review.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None of these labels are root-cause inferences; none unblock
> Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_SLICE2_CI_BUILD_PARITY_PROOF_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Option B Slice 2 (CI / Build Parity Proof) Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_SLICE2_CI_BUILD_PARITY_PROOF_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file under `docs/ops/`. Plan the next Option B
  implementation slice (a CI / build parity proof for the compiled-artifact build path). No
  implementation, no workflow change, no package-script change, no dependency/lockfile change, no
  source/runtime behavior change, and no execution in this PR.
- **Change class:** **docs-only**.
- **Layer:** L1 (docs-only).
- **Suggested file:** `docs/ops/sprint3-riskworker-option-b-slice2-ci-build-parity-proof-planning.md`.

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

Known safe state as of PR #393 merge (base `sprint2-architecture-contracts-d4cc2bf`
@ `6f503fb6ff128169c886ab912763acb85c912294`):

- **PR #393** registered the Option B constants and introduced the **minimal build scaffold**.
- `build:riskworker-artifact` **exists but has not been executed**.
- The **compiled runtime path is not active**.
- Existing `tsx` risk-worker scripts **remain active and unchanged**.
- The reserved **run / preflight / parity** commands are **not wired**.
- **No generated artifact is committed.**
- `build_surface`, `unknown_build_surface`, and `structurally_expected_dual_signal` are **safe
  diagnostic labels only** — not root-cause inferences.
- Gate D/E remain **blocked where dependent** (risk-worker, risk evidence, scoring readiness, customer
  output, or production validation).
- Trail: PR #378 → … → #389 → #390 → #391 → #393.

---

## 4. Slice 2 objective

Plan the slice that, in a **future** separately-reviewed PR, will add a **CI / build parity proof** for
the Option B compiled-artifact build path introduced (as scaffold only) in PR #393.

The intent: give CI a way to prove — statically and reproducibly, **without switching the runtime** —
that the registered `build:riskworker-artifact` build path is **coherent and buildable in CI parity**
with the local toolchain, so a later runtime-switch slice has a trustworthy build foundation.

Slice 2 is deliberately **proof-only**: it establishes that the build path *can* be exercised and
verified in CI parity terms. It does **not** activate the compiled runtime path, does **not** wire any
run command, and does **not** change how the risk-worker currently runs (existing `tsx` scripts stay
active and unchanged).

---

## 5. CI / build parity proof goal

The parity proof, when later implemented, is intended to establish (as safe, emitted signals):

- that the CI environment and the local build toolchain agree on the Option B build path — i.e. the
  build wiring registered in PR #393 is **structurally present, referenced, and internally consistent**;
- that the build path is **exercisable in CI** on the same terms it is exercisable locally (parity of
  inputs/entrypoints/output location as registered), so a later runtime-switch slice does not discover
  build drift for the first time at runtime;
- that this proof **remains distinct from runtime execution** — a build/parity proof is not a run of the
  worker, not a classifier pass, not risk-evidence, and not a record-only pass.

The proof proves **build-path parity only**. It proves **no** runtime behavior, **no** DB role binding,
**no** worker/classifier/risk-evidence behavior, **no** customer-output behavior, and **no** Gate
behavior. It asserts **no root cause** and unblocks **no** Gate.

---

## 6. Proposed future workflow / check shape (for the future implementation PR, not this one)

Illustrative, **non-binding** shapes to be fixed against the registry in the future PR:

- **Option (static, preferred where sufficient):** a static `check:*`-style guardrail (in the existing
  static-guardrail family) that verifies the Option B build wiring is present and internally consistent
  (registered constant names referenced, build-script name registered, artifact-root path registered) —
  **without** invoking the build. This keeps the proof **L1/static**: no server, no runtime, no secret.
- **Option (CI parity, if a build invocation is later judged necessary):** a CI job step that invokes the
  registered build command in a non-production CI environment against source only, emitting safe
  pass/fail parity signals. This step must not touch server, runtime, secrets, DB, network, or
  production data; it must not run the worker; it must not generate customer output.
- Any such workflow/check must slot into the existing static-guardrail bundle discipline (see Baseline
  in `CLAUDE.md`) and must **not** relax, bypass, or reorder existing guardrails.

> **This planning PR adds no workflow, no CI job, and no `check:*` script.** It only enumerates candidate
> shapes for the future PR. The choice between the static-only and CI-invocation shapes (and its layer
> consequence — see §18) is deferred to the future PR under its own review.

---

## 7. Proposed future proof command behavior (for the future implementation PR, not this one)

The future proof command, when implemented, is expected to:

- resolve and reference the **already-registered** Option B constants/names (from PR #393) rather than
  introduce new raw literals;
- verify the build path's **structural coherence / parity** (presence, references, and consistency of
  the registered build wiring) and, only if the CI-invocation shape is chosen, exercise the registered
  build command in a non-production CI context against source only;
- terminate as a **pure proof**: it must not switch the runtime, not wire a run command, not execute the
  worker/classifier/risk-evidence/record-only, not touch DB/network/SQL, and not produce customer output
  or move a Gate;
- emit only **safe, structured, non-sensitive** signals (see §8) — never raw logs, exact errors, stack
  traces, dependency-file contents, env/secret values, DSNs, hosts, private paths, SQL results, customer
  data, or base64 blobs (see §9).

> **This planning PR defines no command and runs no command.** In particular it does **not** run
> `build:riskworker-artifact`.

---

## 8. Safe labels / booleans / counts the proof should emit

When later implemented, the proof should emit only safe, structured signals such as (illustrative,
non-binding names to be fixed in the future PR against the registry):

```yaml
# booleans (structural / parity presence & consistency)
build_wiring_present: <bool>
build_command_registered: <bool>
artifact_root_registered: <bool>
compiled_entrypoint_registered: <bool>
build_path_internally_consistent: <bool>
ci_local_build_parity_ok: <bool>
compiled_runtime_path_active: false   # must stay false in Slice 2
run_command_wired: false              # must stay false in Slice 2
tsx_scripts_unchanged: true

# counts (aggregate, non-sensitive)
registered_constants_referenced_count: <int>
build_wiring_checks_passed_count: <int>
build_wiring_checks_failed_count: <int>

# safe diagnostic labels (carried, not re-derived, not root-cause)
build_surface_label: build_surface
disambiguation_label: structurally_expected_dual_signal
runtime_cause_inference: false
```

All emitted values must be **derived-safe aggregates or booleans** — presence/consistency/parity flags
and counts — never raw content. The proof asserts **no** root cause and unblocks **no** Gate.

---

## 9. Forbidden outputs

The future proof (and this planning doc) must never emit:

- raw logs, raw build output, exact error strings, or stack traces;
- dependency-file contents, lockfile contents, or `package.json` bodies;
- environment values, secrets, tokens, private keys, DSNs, connection strings, hosts, ports,
  usernames, or passwords (or any connection component);
- SQL text or SQL results;
- private capture paths or capture contents (`run.err` / `run.safe.out` / private captures);
- customer data (never);
- base64 blobs or other opaque encoded payloads;
- any concrete new constant value committed ahead of registration (no raw literal drift).

---

## 10. Package / workflow impact expected in the future implementation PR (not this one)

The future Slice 2 implementation PR is expected — depending on the chosen shape (§6) — to touch **only**:

- a static guardrail script (e.g. a new `check:*` script) and its wiring into the static-guardrail
  bundle in `package.json`, **and/or**
- a CI workflow file to add a build-parity job step (non-production, source-only), **and/or**
- exactly one supporting docs file under `docs/ops/` (implementation evidence/notes),

registering (in **both** `.claude/constants.md` and `config/constants.ts`) any **new** constant-like
literal it first uses, at first use, in the same PR — or referencing the **already-registered** Option B
names from PR #393 without introducing new literals.

> **This planning PR touches none of these.** It changes no package script, adds no workflow, adds no
> `check:*` script, and edits no registry file.

---

## 11. Artifact generation boundary

- Slice 2 is a **parity proof**, not an artifact-publishing slice. It must **not commit** a generated
  artifact.
- If (and only if) the CI-invocation shape is later chosen, any build output produced in CI is a
  **transient, generated, ignored** by-product of the parity check — it is not committed, not published,
  and not promoted to a runtime path.
- Building or parity-checking an artifact **does not execute** it; Slice 2 produces **no runtime
  behavior** and **no capture**.
- **This planning PR generates no artifact and runs no build.** `build:riskworker-artifact` is **not
  executed** here.

---

## 12. Worker / risk-evidence / record-only boundary

- Slice 2 must **not** run the worker, a classifier, risk-evidence, or a record-only pass; it is a
  build-parity proof slice only.
- Record-only and risk-evidence boundaries must remain intact (no coupling to customer-output/Lane; the
  existing `check:record-only-gate` and `check:customer-output-boundary` guardrails must stay green).
- A build/parity proof exercises the build path only — it is **not** a run of the worker and produces
  **no** classification, risk evidence, or record-only output.
- **This planning PR executes nothing.**

---

## 13. Customer-output / Gate D/E boundary

- Slice 2 must **not** touch customer-output generation or Gate D/E surfaces.
- A build-parity proof produces **no** customer output and moves **no** Gate.
- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Planning Slice 2 does not unblock Gate D/E.** Any Gate D/E movement requires **separate remediation
  evidence** and a **separate readiness review**, under its own planning + (where applicable) exact GO.

---

## 14. Validation plan

- This planning PR (docs-only) is validated with the safe static bundle only (`git diff --check` + the
  eight `check:*` scripts). `check:constants` stays green because no raw constant-like literal is
  introduced in code and no registry file is edited.
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
- The future Slice 2 implementation PR must additionally pass the full static guardrail bundle
  (including any new `check:*` it adds), run `npm run check:constants` (enforcing registration of any
  new constant-like literal in both files), and be reviewed. Its layer (L1/static vs L3) is determined
  per §18; the static-only shape requires no exact GO, while any server/runtime/secret-touching shape is
  L3 and requires a separate planning PR and exact GO.

---

## 15. Evidence plan

- The future Slice 2 PR records its outcome as a supporting docs file using **safe labels only** (per
  §8: parity/consistency booleans and counts) — no raw logs, raw build output, exact errors, stack
  traces, dependency-file contents, env values, SQL results, customer data, secrets, DSNs, hosts,
  private paths, or base64 blobs.
- Any later runtime-affecting slice records its own safe-labelled evidence PR (and, if server/runtime is
  touched, under a separate exact GO).

---

## 16. Rollback / no-op boundary

- **This planning PR** is inherently a no-op on runtime/build/workflow/registry state; there is nothing
  to roll back beyond reverting the single docs file.
- **Future Slice 2** rolls back by reverting its PR: remove the added `check:*` script and its bundle
  wiring, remove the CI parity step (if any), and remove the registry entries (both files) for any new
  constant it introduced. Because Slice 2 does not switch the runtime and commits no artifact, rollback
  carries no runtime-behavior risk.

---

## 17. Forbidden actions

Forbidden here, and unless separately planned, reviewed, and (where applicable) covered by a distinct
exact GO:

- [ ] No implementation of Slice 2 or any other slice.
- [ ] No workflow change; no CI job addition.
- [ ] No package-script change; no `check:*` script addition or bundle re-wiring.
- [ ] No dependency or lockfile change.
- [ ] No constants registration; no `.claude/constants.md` edit; no `config/constants.ts` edit.
- [ ] No source or runtime behavior change; no command runs differently.
- [ ] No execution of `build:riskworker-artifact`; no build run.
- [ ] No artifact generation; no generated artifact committed.
- [ ] No activation of the compiled runtime path; no run/preflight/parity command wiring.
- [ ] No worker / classifier / risk-evidence / record-only execution.
- [ ] No SQL / psql.
- [ ] No DB / network action.
- [ ] No DB mutation.
- [ ] No production access.
- [ ] No secret / env read (values) or edit.
- [ ] No deploy.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate D / Gate E / Gate4E / Gate4F movement.
- [ ] No private capture path printing (`run.err` / `run.safe.out` / private captures).
- [ ] No raw logs, raw build output, exact errors, stack traces, dependency-file contents, env values,
      DSNs, hosts, or private paths in output.
- [ ] No raw customer data (never).
- [ ] No fix / remediation / retry loop.
- [ ] No concrete new constant value committed (no raw literal ahead of registration).
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.

---

## 18. Layer classification (Slice 2)

Slice 2's layer is determined by the shape chosen in the future implementation PR:

- **If Slice 2 only adds CI / static proof wiring** (a static `check:*` guardrail and/or a
  non-production, source-only CI parity step) and **does not touch server / runtime / secrets**, it may
  remain **L1 / static** and proceed under normal review with the guardrail bundle — **no exact GO
  required**.
- **If Slice 2 requires server / runtime execution** (or touches secrets, production, DB, or network),
  it becomes **L3** and requires a **separate planning PR and an exact GO**. It must be narrowly scoped,
  separately planned, and never hidden inside a normal code PR.
- **No silent escalation:** a Slice 2 PR that starts as L1/static may not silently perform L2 or L3
  actions. Any DB/network/server/runtime/customer-output/Gate action requires its own planning PR and
  explicit GO.

---

## 19. Negative-action ledger (this planning PR)

```yaml
slice2_implemented: false
workflow_changed: false
ci_job_added: false
package_script_changed: false
check_script_added: false
guardrail_bundle_rewired: false
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
run_or_preflight_or_parity_command_wired: false
execution_performed: false
worker_rerun_performed: false
classifier_rerun_performed: false
risk_evidence_rerun_performed: false
record_only_rerun_performed: false
sql_or_psql_performed: false
db_network_action_performed: false
production_access_performed: false
secret_or_env_read_performed: false
deploy_performed: false
customer_output_or_gate_performed: false
gate_d_or_e_movement_performed: false
fix_or_retry_loop_performed: false
root_cause_inference_performed: false
raw_logs_in_doc: false
raw_build_output_in_doc: false
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

## 20. Future authorization model

The eventual **Slice 2 implementation PR** may proceed **only after this planning PR is reviewed and
merged**, and must:

- reference the **already-registered** Option B names (PR #393) and register any **new** constant-like
  literal in **both** `.claude/constants.md` and `config/constants.ts` **before use** (registration +
  first use in the same PR);
- add only the **CI / build parity proof** wiring needed (static `check:*` and/or non-production CI
  step);
- **not** activate the compiled runtime path;
- **not** wire the runtime run command;
- **not** run worker / classifier / risk-evidence / record-only;
- **not** touch DB / network / SQL;
- **not** touch customer-output / Gate D/E;
- **not** claim root cause;
- **not** unblock Gate D/E;
- **clearly distinguish** build / parity proof from runtime execution.

Per §18, if Slice 2 as scoped stays static/CI-only and touches no server/runtime/secret, it is
**L1/static** and needs normal review with the guardrail bundle — **no exact GO required**. Any
server/runtime/secret-touching variant is **L3** and needs its own planning + a **separate exact GO**.
**No silent escalation.**

---

## 21. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Planning Slice 2 does not unblock Gate D/E.**
- No plan in this PR may be treated as authorization to move Gate D/E or to implement anything.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + (where applicable) exact GO.

---

## 22. Post-planning interpretation rules

- **This document's effect:** a recorded, planning-level definition of the next Option B implementation
  slice (a CI / build parity proof for the compiled-artifact build path). No implementation, no workflow
  change, no package-script change, no build execution, no artifact generation, no Gate movement, no
  state change beyond recording the plan.
- **Allowed follow-up:** open the Slice 2 implementation PR (CI / build parity proof wiring) once this
  planning PR is reviewed and merged, under the layer determination in §18.
- **Requires new PR + review + (where applicable) exact GO:** any workflow change, `check:*` addition,
  package-script change, build execution, artifact generation, runtime switch, run/preflight/parity
  command wiring, verification, worker/classifier/risk-evidence/record-only execution, SQL/psql,
  mutation, deploy, Gate D/E movement, or customer-output action.
- No interpretation may treat this plan as authorization or as a root-cause inference; the sealed
  classification stands unchanged.

---

_End of planning document. Docs-only. Plans Slice 2 (CI / build parity proof) but authorizes no
implementation, workflow change, package-script change, build execution, artifact generation, runtime/
server touch, fix, retry, Gate D/E, or customer-output action. Sealed state preserved._
