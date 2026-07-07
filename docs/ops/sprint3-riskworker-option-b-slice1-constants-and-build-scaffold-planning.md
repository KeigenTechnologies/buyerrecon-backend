# Sprint 3 — Risk-Worker Option B Slice 1 (Constants + Build Scaffold) Planning

> **Docs-only planning document.** Plans the **first actual implementation slice** for Option B
> (*compiled build artifact / compiled runtime path*): the slice that will later register concrete
> constants **at first use** and introduce the **minimal build-artifact scaffold**. This document
> **plans but does not implement**; it registers no constant, edits no registry file, and changes no
> source/package/script/workflow/dependency/lockfile/runtime behavior.
>
> **Authorizes nothing.** No implementation, no constants registration, no `.claude/constants.md` or
> `config/constants.ts` edit, no execution, no worker/classifier/risk-evidence/record-only rerun, no
> SQL/psql, no DB/network, no Gate D/E movement, no customer-output action, no fix, no retry, no
> root-cause inference. The eventual implementation PR may proceed **only after this planning PR is
> reviewed and merged**, under its own review.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None of these labels are root-cause inferences; none unblock
> Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_SLICE1_CONSTANTS_AND_BUILD_SCAFFOLD_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Option B Slice 1 (Constants + Build Scaffold) Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_SLICE1_CONSTANTS_AND_BUILD_SCAFFOLD_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file under `docs/ops/`. Plan the first Option B
  implementation slice (constants registration at first use + minimal build scaffold). No
  implementation, no constants registration, no registry edit, no package-script/workflow/dependency/
  lockfile/runtime change in this PR.
- **Change class:** **docs-only**.
- **Layer:** L1 (docs-only).

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

- **Preferred architecture (PR #389):** Option B — compiled build artifact / compiled runtime path.
- **Option B design (PR #390):** compiled-artifact implementation design, concrete constants deferred.
- **Constants registry planning (PR #391):** proposed constant names, values deferred to first use.
- Gate D/E remain blocked where dependent; none of these labels are root-cause inferences; none unblock
  Gate D/E.
- Trail: PR #378 → … → #389 → #390 → #391.

---

## 4. Slice 1 objective

Plan the first implementation slice that, in a **future** separately-reviewed PR, will:

- register the concrete Option B constants **at first use** in **both** `.claude/constants.md` and
  `config/constants.ts`; and
- introduce the **minimal build-artifact scaffold** (a build step that can emit a compiled JavaScript
  artifact from the TypeScript sources) — **without switching the runtime yet** (no runtime behavior
  change in Slice 1).

Slice 1 is deliberately **build-scaffold only**: it makes it *possible* to produce a compiled artifact
and registers the names/paths, but the risk-worker continues to run via its current path until a later
slice (Slice 3, runtime switch) is separately planned, reviewed, and authorized.

---

## 5. Exact future implementation surfaces (for the future PR, not this one)

The future Slice 1 implementation PR would be limited to:

- `.claude/constants.md` — register the concrete constant values (human/Claude registry).
- `config/constants.ts` — register the same concrete constant values (machine-consumed).
- `package.json` — add the minimal build script only (no runtime run-script switch in Slice 1).
- exactly one supporting docs file under `docs/ops/` (implementation evidence/notes).

> **This planning PR touches none of these.** It only enumerates what the future PR would touch.

---

## 6. Constants to be registered at first use

Per PR #391, the candidate constant key names (registered **at first use** in the future slice):

- `COMPILED_ARTIFACT_ROOT`
- `RISKWORKER_COMPILED_ENTRYPOINT`
- `RECORD_ONLY_COMPILED_ENTRYPOINT` (only if a distinct record-only entrypoint exists)
- `RISKWORKER_BUILD_COMMAND`
- `RISKWORKER_COMPILED_RUN_COMMAND` (defined but **not wired** in Slice 1; runtime switch is a later slice)
- `RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND` (defined for later use)
- `RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND` (defined for later use, Option C)

---

## 7. Proposed concrete constant values / unresolved placeholder policy

- **Values are NOT asserted in this planning PR.** Concrete values remain **unresolved placeholders**
  until the future implementation PR decides and registers them at first use.
- **Placeholder policy:** no concrete path or command value is committed anywhere in this PR (not in
  code, not in registry files, not as a raw literal). The future PR must choose values against the
  registry and register in **both** files in the same PR that first uses them.
- **No defaults / no drift:** an unresolved constant (e.g. record-only entrypoint applicability) stays
  unregistered rather than defaulted; a value must land in both registry files together.
- Candidate *shapes* only (illustrative, non-binding, to be fixed in the future PR against the
  registry): an explicit artifact root directory; a compiled entrypoint under that root; a build
  command that compiles TS→JS; a run/preflight/parity command family. **No shape here is a committed
  value.**

---

## 8. Expected `.claude/constants.md` additions (for the future implementation PR)

The future Slice 1 PR is expected to add, to `.claude/constants.md`, human-registry entries for each
constant it first uses (key name + concrete value + short description), covering at minimum
`COMPILED_ARTIFACT_ROOT`, `RISKWORKER_COMPILED_ENTRYPOINT`, and `RISKWORKER_BUILD_COMMAND` (the
build-scaffold subset), and any additional names it actually uses. **This planning PR adds none of
them.**

---

## 9. Expected `config/constants.ts` additions (for the future implementation PR)

The future Slice 1 PR is expected to add, to `config/constants.ts`, the machine-consumed counterparts
of the same registry entries, kept in lockstep with `.claude/constants.md` (same names, same values).
**This planning PR adds none of them.**

---

## 10. Expected package-script / build-scaffold changes (for the future implementation PR)

The future Slice 1 PR is expected to:

- add a **minimal build script** that compiles the TypeScript sources into the registered artifact root
  (leveraging the already-present TypeScript toolchain observed in prior evidence:
  `typescript_dependency_present: true`, `build_script_uses_tsc: true`);
- **not** switch the risk-worker run script to the compiled path (that is a later slice);
- keep the scaffold minimal, additive, and behavior-preserving for existing commands.

**This planning PR changes no package script and adds no build scaffold.**

---

## 11. Expected source / runtime behavior non-change or change boundary

- **Slice 1 is runtime-behavior non-changing:** it adds the ability to *produce* a compiled artifact but
  does **not** switch how the risk-worker runs. Existing commands continue to behave identically.
- The **change boundary** in Slice 1 is limited to: registry entries (both files) + one minimal build
  script + build-output artifact directory (generated, ignored). No source logic change, no runtime
  entrypoint switch.
- Any runtime entrypoint switch (`node <artifact>` instead of the current path) is **out of Slice 1**
  and belongs to a later, separately-authorized slice.

---

## 12. Worker / risk-evidence / record-only boundary

- Slice 1 must **not** run the worker, a classifier, risk-evidence, or a record-only pass; it is a
  build-scaffold + registry slice only.
- Record-only and risk-evidence boundaries must remain intact (no coupling to customer-output/Lane; the
  existing `check:record-only-gate` and `check:customer-output-boundary` guardrails must stay green).
- Building an artifact does not execute it; Slice 1 produces no runtime behavior and no capture.
- **This planning PR executes nothing.**

---

## 13. Customer-output / Gate D/E boundary

- Slice 1 must **not** touch customer-output generation or Gate D/E surfaces.
- A build scaffold produces no customer output and moves no Gate.
- Customer-output/Gate D/E remain untouched until remediation evidence exists and a separate readiness
  review authorizes any movement.

---

## 14. Validation plan

- This planning PR (docs-only) is validated with the safe static bundle only (`git diff --check` +
  the eight `check:*` scripts). `check:constants` stays green because no raw constant-like literal is
  introduced in code and no registry file is edited.
- The future Slice 1 implementation PR must additionally: run `npm run check:constants` (which will
  enforce that any new constant-like literal is registered in both files), pass the full static
  guardrail bundle, and be reviewed. It requires no server/DB/network and no exact GO (build-scaffold +
  registry is L1/static), provided it touches no server/runtime and no secret.

---

## 15. Evidence plan

- The future Slice 1 PR records its outcome as a supporting docs file (safe labels: constants
  registered, build script added, artifact root created-as-generated) — no raw logs, exact errors,
  stack traces, dependency-file contents, env values, SQL results, customer data, secrets, DSNs, hosts,
  private paths, or base64 blobs.
- Any later runtime-affecting slice records its own safe-labelled evidence PR (and, if server/runtime is
  touched, under a separate exact GO).

---

## 16. Rollback / no-op boundary

- **This planning PR** is inherently a no-op on runtime/build/registry state; there is nothing to roll
  back beyond reverting the single docs file.
- **Future Slice 1** rolls back by reverting its PR: remove the build script, remove the registry
  entries (both files), and drop the generated artifact directory. Because Slice 1 does not switch the
  runtime, rollback carries no runtime-behavior risk.

---

## 17. Forbidden actions

Forbidden here and unless separately planned, reviewed, and (where applicable) covered by a distinct
exact GO:

- [ ] No implementation of Slice 1 or any other slice.
- [ ] No constants registration; no `.claude/constants.md` edit; no `config/constants.ts` edit.
- [ ] No package-script / build-scaffold change.
- [ ] No workflow change.
- [ ] No dependency or lockfile change.
- [ ] No source or runtime behavior change; no command runs differently.
- [ ] No worker / classifier / risk-evidence / record-only execution.
- [ ] No SQL / psql.
- [ ] No DB / network action.
- [ ] No DB mutation.
- [ ] No secret / env read (values) or edit.
- [ ] No deploy.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate D / Gate E / Gate4E / Gate4F movement.
- [ ] No private capture path printing.
- [ ] No raw logs, exact errors, stack traces, dependency-file contents, env values, DSNs, hosts, or
      private paths in output.
- [ ] No raw customer data (never).
- [ ] No fix / remediation / retry loop.
- [ ] No concrete constant value committed (no raw literal ahead of registration).
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.
- [ ] No Phase C migration.

---

## 18. Negative-action ledger (this planning PR)

```yaml
slice1_implemented: false
constant_value_registered: false
constants_md_edited: false
config_constants_ts_edited: false
package_script_changed: false
build_scaffold_added: false
workflow_changed: false
dependency_or_lockfile_changed: false
source_or_runtime_changed: false
command_runs_differently: false
execution_performed: false
worker_rerun_performed: false
classifier_rerun_performed: false
risk_evidence_rerun_performed: false
record_only_rerun_performed: false
sql_or_psql_performed: false
db_network_action_performed: false
customer_output_or_gate_performed: false
gate_d_or_e_movement_performed: false
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

## 19. Future authorization model

The eventual **Slice 1 implementation PR** may proceed **only after this planning PR is reviewed and
merged**, and must:

- register any concrete constant in **both** `.claude/constants.md` and `config/constants.ts`
  **before use** (registration + first use in the same PR);
- introduce only the **minimal build scaffold** needed for compiled-artifact creation;
- **not** run worker / classifier / risk-evidence / record-only;
- **not** touch customer-output / Gate D/E;
- **not** perform DB / network / SQL;
- **not** claim root cause;
- **not** unblock Gate D/E.

Because Slice 1 (build scaffold + registry) touches no server/runtime and no secret, it is **L1/static**
and needs normal review with the guardrail bundle — **no exact GO required** for Slice 1 as scoped. Any
later runtime-affecting or server-touching slice is L3 and needs its own planning + a **separate exact
GO**. **No silent escalation.**

---

## 20. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Planning Slice 1 does not unblock Gate D/E.**
- No plan in this PR may be treated as authorization to move Gate D/E or to implement anything.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + (where applicable) exact GO.

---

## 21. Post-planning interpretation rules

- **This document's effect:** a recorded, planning-level definition of the first Option B implementation
  slice (constants-at-first-use + minimal build scaffold). No implementation, no registration, no Gate
  movement, no state change beyond recording the plan.
- **Allowed follow-up:** open the Slice 1 implementation PR (registry + build scaffold, L1/static) once
  this planning PR is reviewed and merged.
- **Requires new PR + review + (where applicable) exact GO:** any registration-with-use, build-scaffold
  addition, runtime switch, verification, worker/classifier/risk-evidence/record-only execution,
  SQL/psql, mutation, deploy, Gate D/E movement, or customer-output action.
- No interpretation may treat this plan as authorization or as a root-cause inference; the sealed
  classification stands unchanged.

---

_End of planning document. Docs-only. Plans Slice 1 but authorizes no implementation, constants registration, fix, execution, retry, Gate D/E, or customer-output action. Sealed state preserved._
