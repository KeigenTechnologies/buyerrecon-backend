# Sprint 3 — Risk-Worker Option B Slice 1 (Constants + Build Scaffold) — Implementation Note

> **L1/static implementation evidence note.** Records the actual Slice 1 change made under the merged
> Slice 1 plan (PR #392): register the Option B compiled-artifact constants **at first use** and
> introduce the **minimal static build scaffold**. This is **L1/static only** and **preserves runtime
> behavior** — the compiled runtime path is **not active**, nothing was executed, and no generated
> artifact was committed.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None unblock Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_SLICE1_CONSTANTS_AND_BUILD_SCAFFOLD_L1_STATIC_IMPLEMENTATION`

---

## 1. Change set (exact)

| File | Change | Nature |
| --- | --- | --- |
| `config/constants.ts` | Add the Option B compiled-artifact constant section (machine registry) | registry-only; no runtime behavior |
| `.claude/constants.md` | Add matching human-registry entries + status block | registry-only |
| `tsconfig.riskworker-artifact.json` | New minimal scaffold build config (compiled-artifact tsconfig) | build-scaffold config; not run |
| `package.json` | Add one non-bundle, build-only script `build:riskworker-artifact` | additive script; not run; not wired to runtime |
| `docs/ops/…-impl-note.md` | This evidence note | docs |

No other files changed. No source logic, worker entrypoint, workflow, dependency, or lockfile change.

---

## 2. Constants registered (both registry files, in lockstep)

```yaml
COMPILED_ARTIFACT_ROOT: dist/riskworker                         # used by scaffold
RISKWORKER_COMPILED_ENTRYPOINT: dist/riskworker/scripts/run-risk-evidence-worker.js            # used
RECORD_ONLY_COMPILED_ENTRYPOINT: dist/riskworker/scripts/run-risk-evidence-record-only-worker.js  # used
RISKWORKER_BUILD_COMMAND: build:riskworker-artifact            # used (package script name)
RISKWORKER_COMPILED_RUN_COMMAND: run:riskworker-compiled       # RESERVED — not wired in Slice 1
RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND: proof:riskworker-runtime-preflight   # RESERVED — not wired
RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND: proof:riskworker-ci-build-parity       # RESERVED — not wired
```

- Registered in **both** `config/constants.ts` and `.claude/constants.md` (same names, same values) —
  consistent, no drift.
- These are **non-secret** path/command names only. No DSN, host, port, password, token, or connection
  component.
- Registered as **not-yet-guardrail-enforced** candidates (matching the existing repo pattern for
  registered-but-not-enforced symbols); `check:constants` still enforces only the four project-unique
  literals.

---

## 3. Build scaffold (contract only — not run)

- `tsconfig.riskworker-artifact.json` extends the base `tsconfig.json`, sets `outDir: dist/riskworker`
  and `rootDir: .`, and includes the two risk-worker entrypoints. It exists because the base
  `tsconfig.json` (`rootDir: src`, `include: [src]`) **excludes** `scripts/`, so it cannot compile the
  risk-worker entrypoints — this scaffold is the minimal config required to make compiled-artifact
  creation *possible*.
- `package.json` adds `build:riskworker-artifact` = `tsc -p tsconfig.riskworker-artifact.json`. It is a
  **non-bundle, build-only** script (`tsc`); it runs no worker/classifier/risk-evidence/record-only, no
  DB/network, and generates no customer output.
- **Emission target is under the already-gitignored `dist/`** (`dist/riskworker`), so running the build
  later commits no artifact.

---

## 4. Runtime-behavior non-change (explicit)

- The compiled runtime path is **not active**. `RISKWORKER_COMPILED_RUN_COMMAND`,
  `RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND`, and `RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND` are
  **reserved names only** — no package script wires them.
- The existing `tsx` risk-worker scripts are **unchanged**: `risk-evidence:run`
  (`tsx scripts/run-risk-evidence-worker.ts`) and `risk-evidence:record-only`
  (`tsx scripts/run-risk-evidence-record-only-worker.ts`) still run exactly as before.
- The existing `build` (`tsc`) and `start` (`node dist/server.js`) scripts are unchanged. Adding a new
  script name makes **no existing command run differently**.

---

## 5. Build scaffold intentionally NOT executed

- `build:riskworker-artifact` was **not run** in this PR. Rationale: the Slice 1 hard boundary is
  "do not execute anything / preserve runtime behavior," and running it would emit artifacts and could
  surface pre-existing `scripts/`-tree type issues never covered by the base build (which excludes
  `scripts/`). First execution/verification of the scaffold is deferred to a later slice/step (e.g. the
  Option C parity-proof slice), under its own review.
- Consequently this note records a **scaffold contract**, not a build-success proof.

---

## 6. Validation results (this PR)

```yaml
git_diff_check: clean
check_constants: pass
check_static_boundaries: pass
check_pg_pool_construction: pass
check_observer_shape: pass
check_record_only_gate: pass
check_customer_output_boundary: pass
check_db_pool_factory_scaffold: pass
check_no_runtime_imports: pass
build_scaffold_executed: false        # intentionally not run (Section 5)
```

- `check:no-runtime-imports` stays green: the new `build:riskworker-artifact` is a **non-bundle** script
  (only the eight bundle scripts are audited) and no workflow/checker/bundle wiring changed.
- `check:record-only-gate` stays green: no new `scripts/run-*-worker.ts` or `scripts/*record-only*.ts`
  file was added; the record-only entrypoint and its markers are unchanged; no forbidden import edge.

---

## 7. Negative-action ledger

```yaml
worker_execution_performed: false
classifier_execution_performed: false
risk_evidence_execution_performed: false
record_only_execution_performed: false
build_scaffold_executed: false
runtime_or_server_command_performed: false
sql_or_psql_performed: false
db_network_action_performed: false
production_access_performed: false
customer_output_or_gate_performed: false
gate_d_or_e_movement_performed: false
worker_entrypoint_behavior_changed: false
existing_command_runs_differently: false
source_runtime_behavior_changed: false
dependency_or_lockfile_changed: false
workflow_changed: false
generated_artifact_committed: false
refactor_performed: false
phase_c_migration_performed: false
root_cause_inference_performed: false
fix_claim_made: false
retry_loop_performed: false
constants_registered_both_files: true
raw_logs_in_note: false
exact_raw_error_in_note: false
dependency_file_contents_in_note: false
env_values_in_note: false
stack_trace_in_note: false
sql_result_in_note: false
customer_data_in_note: false
secret_or_dsn_or_host_in_note: false
private_path_in_note: false
base64_blob_in_note: false
```

---

## 8. Gate D / Gate E boundary

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- This Slice 1 implementation **does not unblock Gate D/E** and moves no Gate.
- Any Gate D/E movement requires **separate remediation evidence** and a **separate readiness review**.

---

## 9. Layer classification & next steps

- **Layer:** L1 / static (registry + build-scaffold config; touches no server/runtime, no secret,
  no DB/network). Needs normal review with the guardrail bundle; **no exact GO required** for Slice 1
  as scoped.
- **Next (separate PRs, own review, and where server/runtime is touched a separate exact GO):**
  Slice 2 CI/build parity proof (Option C, wires `RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND`); Slice 3
  runtime switch (wires `RISKWORKER_COMPILED_RUN_COMMAND`, behavior-affecting); Slice 4 runtime
  preflight proof (L3, `RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND`, separate exact GO).

---

_End of implementation note. L1/static. Registers constants + a build scaffold; runs nothing; preserves runtime behavior; authorizes no Gate D/E or customer-output action. Sealed state preserved._
