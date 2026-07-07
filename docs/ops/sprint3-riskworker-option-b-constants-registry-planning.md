# Sprint 3 — Risk-Worker Option B Constants Registry Planning

> **Docs-only planning document.** Plans the concrete constants that a future Option B
> (*compiled build artifact / compiled runtime path*) implementation slice will require **before** it
> may use any artifact path, entrypoint name, build command, or run command. This document
> **registers no concrete value** and **changes no behavior**.
>
> **Docs-only (not registry-only).** The concrete constant *values* were deferred by the Option B
> design-planning PR (#390) and are **not ready**; **no code consumes them yet**. Per Configuration
> Discipline, constants are registered "before reuse" — since nothing reuses them, this PR **prefers
> docs-only planning** and does **not** edit `.claude/constants.md` or `config/constants.ts`. Actual
> registration happens in the future implementation-slice PR that first uses each value, in the same
> PR that introduces the use.
>
> **Authorizes nothing.** No implementation, no runtime behavior change, no package-script/workflow/
> dependency/lockfile change, no execution, no worker/classifier/risk-evidence/record-only rerun, no
> SQL/psql, no DB/network, no Gate D/E movement, no customer-output action, no fix, no retry, no
> root-cause inference.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation result `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None of these labels are root-cause inferences; none unblock
> Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_CONSTANTS_REGISTRY_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Option B Constants Registry Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_CONSTANTS_REGISTRY_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file under `docs/ops/`. Plan (do not register) the
  concrete constants a future Option B implementation slice will need. No implementation, no runtime
  behavior change, no package-script/workflow/dependency/lockfile change.
- **Change class:** **docs-only**. `.claude/constants.md` and `config/constants.ts` are **not edited**
  in this PR (constants are not ready and are not yet reused).
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

- **Option B** is the preferred target architecture (PR #389); **Option C** is supporting parity proof;
  **runtime preflight proof** is final verification.
- **PR #390** merged the Option B compiled-artifact implementation **design** planning and explicitly
  deferred concrete constants (artifact path, entrypoint names, build/run commands) to a future
  registry-bound PR.
- Gate D/E remain blocked where dependent; none of these labels are root-cause inferences; none unblock
  Gate D/E.
- Trail: PR #378 → #379 → #380 → #381 → #382 → #383 → #384 → #385 → #386 → #387 → #388 → #389 → #390.

---

## 4. Configuration-discipline rationale

Per repository Configuration Discipline (CLAUDE.md):

- All canonical deployment paths, endpoint/route names, database identifiers, secret/env-var names,
  ports, and stage/route vocabulary must be **registered before reuse**.
- Machine-consumed constants live in `config/constants.ts`; the human/Claude registry lives in
  `.claude/constants.md`.
- Raw literals for registered constants must not be introduced; aliases must not be invented.
- **Before writing code that uses a constant-like value**, both registry files must contain it.

Implication for Option B: the compiled-artifact path, compiled entrypoint paths, and the build/run/
proof command names are **constant-like values**. They must be registered in **both** registry files
**in the same PR that first uses them** (the implementation slice), so that registration and first use
are reviewed together and no raw literal is introduced ahead of registration. Registering them now —
with no consumer and no finalized value — would create unused registry entries and risk drift.
Therefore this PR **plans the names/contracts** and defers registration to first use.

---

## 5. Constants inventory (planning intent, not registration)

| Concept | Purpose | Value status | Registered in this PR? |
| --- | --- | --- | --- |
| Compiled artifact root | Directory holding compiled JS build output | placeholder (not final) | No |
| Compiled risk-worker entrypoint path | Compiled entrypoint the runtime invokes for the risk-worker | placeholder | No |
| Compiled record-only entrypoint path (if applicable) | Compiled entrypoint for the record-only path, if a distinct one exists | placeholder / TBD applicability | No |
| Build command name | Package script name that produces the compiled artifact | placeholder | No |
| Compiled risk-worker run command name | Package script name that runs the compiled risk-worker | placeholder | No |
| Runtime preflight proof command name | Command that verifies the compiled path is present/invocable | placeholder | No |
| CI/build parity proof command name | Check that asserts artifact-vs-runtime parity (Option C) | placeholder | No |

> Every row is **planning intent only**. No value is registered, and none is used by any command.

---

## 6. Exact proposed constant names (naming plan only)

Proposed **registry key names** (not values), to be registered in `.claude/constants.md` and
`config/constants.ts` **at first use** in a future implementation slice. Names are proposals subject to
review; no value is asserted here.

- `COMPILED_ARTIFACT_ROOT` — compiled artifact root directory.
- `RISKWORKER_COMPILED_ENTRYPOINT` — compiled risk-worker entrypoint path.
- `RECORD_ONLY_COMPILED_ENTRYPOINT` — compiled record-only entrypoint path (only if a distinct
  record-only entrypoint exists; otherwise this name is dropped, not defaulted).
- `RISKWORKER_BUILD_COMMAND` — build command (package script) name that emits the artifact.
- `RISKWORKER_COMPILED_RUN_COMMAND` — run command (package script) name for the compiled risk-worker.
- `RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND` — runtime preflight proof command name.
- `RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND` — CI/build parity proof command name (Option C).

> These are **candidate key names** for review. This PR neither writes them into the registry files nor
> attaches any concrete path/command value.

---

## 7. Placeholder vs concrete-value policy

- **Now (this PR):** names/contracts are described as **placeholders**; no concrete path or command
  value is committed anywhere (not in code, not in registry files, not as a raw literal).
- **At implementation (future slice PR):** each constant's **concrete value** is decided, registered in
  **both** `.claude/constants.md` and `config/constants.ts`, and used in the same PR — never a raw
  literal ahead of registration.
- **No defaults:** an unresolved constant (e.g. record-only entrypoint applicability) is left
  unregistered, not defaulted to a guessed value.
- **No drift:** a value registered in one file but not the other is a defect; registration must land in
  both files together.

---

## 8. Allowed registry surfaces

If — and only if — a future step requires actual registration, changes are limited to the approved
registry surfaces:

- `.claude/constants.md`
- `config/constants.ts`
- exactly one supporting docs file under `docs/ops/`

**In this PR, only the supporting docs file is changed** (this file). `.claude/constants.md` and
`config/constants.ts` are **not** edited, because the constants are not ready and are not yet reused.

---

## 9. Forbidden actions

Forbidden here and unless separately planned, reviewed, and (where applicable) covered by a distinct
exact GO:

- [ ] No implementation of Option B or any slice.
- [ ] No runtime behavior change; no command runs differently as a result of this PR.
- [ ] No package-script change (unless a future registry-only step explicitly requires it and is
      reviewed as registry-only — not done here).
- [ ] No workflow change.
- [ ] No dependency or lockfile change.
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

## 10. Future implementation dependency

- No Option B implementation slice may use an artifact path, entrypoint name, build command, or run
  command **until** that constant is registered in **both** `.claude/constants.md` and
  `config/constants.ts` in the same PR that first uses it.
- The implementation-slice PR that registers a constant must also run `npm run check:constants` and the
  full static guardrail bundle, and must be reviewed.
- Runtime-affecting or server-touching slices additionally require their own planning + (where
  applicable) a **separate exact GO**.

---

## 11. Validation plan

This PR (docs-only) is validated with the safe static bundle only:

- `git diff --check`
- `npm run check:constants`
- `npm run check:static-boundaries`
- `npm run check:pg-pool-construction`
- `npm run check:observer-shape`
- `npm run check:record-only-gate`
- `npm run check:customer-output-boundary`
- `npm run check:db-pool-factory-scaffold`
- `npm run check:no-runtime-imports`

`check:constants` remains green because this PR introduces **no** raw constant-like literal in code and
edits no registry file — it only records a naming/registration plan in a docs file (markdown is out of
`check:constants` enforcement scope).

---

## 12. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Planning Option B constants does not unblock Gate D/E.**
- No name/plan in this PR may be treated as authorization to move Gate D/E or to implement anything.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + (where applicable) exact GO.

---

## 13. Negative-action ledger (this planning PR)

```yaml
constant_value_registered: false
constants_md_edited: false
config_constants_ts_edited: false
implementation_performed: false
runtime_behavior_changed: false
command_runs_differently: false
package_script_changed: false
workflow_changed: false
dependency_or_lockfile_changed: false
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

## 14. Post-merge interpretation

- **This document's effect:** a recorded, planning-level constants registration plan for Option B. No
  constant value is registered; no command runs differently; no state change beyond recording the plan.
- **Allowed follow-up:** an implementation-slice PR may, when approved, register a specific constant in
  **both** registry files and use it in the same PR, under normal review (and, if runtime/server is
  touched, separate exact GO).
- **Requires new PR + review + (where applicable) exact GO:** any registration-with-use, build, runtime
  switch, verification, worker/classifier/risk-evidence/record-only execution, SQL/psql, mutation,
  deploy, Gate D/E movement, or customer-output action.
- No interpretation may treat this plan as authorization or as a root-cause inference; the sealed
  classification stands unchanged.

---

_End of planning document. Docs-only. Registers no concrete constant and authorizes no implementation, fix, execution, retry, Gate D/E, or customer-output action. Sealed state preserved._
