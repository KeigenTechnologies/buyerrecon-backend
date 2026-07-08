# Sprint 3 — Risk-Worker Option B L3 (Build Execution + Compiled-Run Validation) Planning

> **Docs-only planning document.** Plans a **future, controlled L3 operation**: executing
> `build:riskworker-artifact` (build execution) and — as a **separate** later step — validating
> `run:riskworker-compiled` (compiled-run validation). This document **plans but does not implement or
> execute anything**. It registers no constant, edits no registry file, changes no
> source/package/script/workflow/dependency/lockfile/runtime behavior, and **does not run**
> `build:riskworker-artifact`, `run:riskworker-compiled`, or any worker/classifier/risk-evidence/
> record-only command.
>
> **Authorizes nothing.** This planning PR is **not** a GO. It grants no execution, no build, no
> compiled run, no runtime/server touch, no production access, no DB/network, no SQL/psql, no
> customer-output action, no Gate D/E movement, no fix, no retry, no root-cause inference. The future
> L3 operation may proceed **only** under a **separate, explicit, scoped HELEN GO** matching the exact
> phrase in §5, after this planning PR is reviewed and merged.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None of these labels are root-cause inferences; none unblock
> Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_L3_BUILD_AND_COMPILED_RUN_VALIDATION_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Option B L3 (Build Execution + Compiled-Run Validation) Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_L3_BUILD_AND_COMPILED_RUN_VALIDATION_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file under `docs/ops/`. Plan a future controlled **L3**
  operation to (Step A) execute the build once and prove artifact presence with safe labels, and
  (Step B, separate) validate the compiled run. No implementation, no execution, no
  source/package/script/workflow/dependency/lockfile change, no refactor, no Phase C in this PR.
- **Change class:** **docs-only**.
- **Layer (this PR):** L1 (docs-only). **The operation it plans is L3.**
- **Suggested file:** `docs/ops/sprint3-riskworker-option-b-l3-build-and-compiled-run-validation-planning.md`.

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

Known safe state as of PR #397 merge (base `sprint2-architecture-contracts-d4cc2bf`
@ `82e491dd267bb0ae7c3ea407cd456036d728f063`):

- **PR #393** registered the Option B constants and the **minimal build scaffold**
  (`tsconfig.riskworker-artifact.json` + `build:riskworker-artifact`).
- **PR #395** wired and **enforced** the CI/build parity proof (`proof:riskworker-ci-build-parity`).
- **PR #397** wired `run:riskworker-compiled` as a **dormant** package script pointing to the
  registered compiled entrypoint (L1/static wiring; not executed).
- `build:riskworker-artifact` **exists but has not been executed**.
- `run:riskworker-compiled` **exists but has not been executed**.
- The **compiled runtime path remains inactive**.
- Runtime preflight (`proof:riskworker-runtime-preflight`) **remains unwired**.
- Existing `tsx` risk-worker scripts (`risk-evidence:run`, `risk-evidence:record-only`) **remain active
  and unchanged** as the rollback path.
- `proof:riskworker-ci-build-parity` is the **only** proof command that has been executed; it stays
  green (build/run wiring present, referenced, consistent; compiled run command wired-but-dormant).
- **No generated artifact has been committed.**
- `build_surface`, `unknown_build_surface`, and `structurally_expected_dual_signal` are **safe
  diagnostic labels only** — not root-cause inferences.
- Gate D/E remain **blocked where dependent** (risk-worker, risk evidence, scoring readiness, customer
  output, or production validation).
- Trail: PR #378 → … → #389 → #390 → #391 → #392 → #393 → #394 → #395 → #396 → #397.

---

## 4. L3 classification rationale

This operation is **L3** — it crosses the L1/static boundary — because it **executes** rather than
merely wires:

- **Step A executes the build.** Running `build:riskworker-artifact` invokes `tsc` and **generates a
  compiled artifact** on disk. Execution of a build command is beyond L1/static (which is text/config
  scans only) even though it touches no server, DB, or production.
- **Step B executes the compiled worker (validation).** Running `run:riskworker-compiled` **executes**
  the compiled risk-evidence worker entrypoint — a **worker run** and a **runtime** action.
- Per PR #396 §11 and CLAUDE.md, executing `build:riskworker-artifact`, activating/running
  `run:riskworker-compiled`, touching server/runtime, or changing worker execution behavior is **L3**
  and requires **separate planning + a separate exact GO**. **No silent escalation**: neither step may
  be hidden inside a normal code PR.

Layer classification for the eventual work: **L3 required.** L1/L2 cannot prove that the build actually
emits the artifact or that the compiled worker runs, because those are execution facts, not
statically-representable ones.

---

## 5. Target operation summary + exact future GO phrase

**Target operation (future, controlled, non-production, source-only):**

- **Step A — build artifact generation/proof only:** on a clean tree pinned to the reviewed base/head,
  run `npm run proof:riskworker-ci-build-parity` as preflight, then run `npm run build:riskworker-artifact`
  **exactly once**, then verify artifact **presence** using safe labels/booleans/counts only. Produce a
  **docs-only evidence PR**. **Do not** run `run:riskworker-compiled` in Step A.
- **Step B — compiled-run validation only:** **only after** the Step A evidence PR merges, and under
  its **own** separate exact GO, validate `run:riskworker-compiled` in a non-production, source-only
  context and produce a **docs-only evidence PR**.

**Exact future GO phrase (Step A).** The future Step A operation may proceed **only** when the operator
issues, verbatim and scoped to the exact action:

```
HELEN GO: SPRINT3_RISKWORKER_OPTION_B_L3_STEP_A_BUILD_ARTIFACT_GENERATION_ONCE
```

**Exact future GO phrase (Step B).** The future Step B operation may proceed **only** when the operator
issues, verbatim and scoped to the exact action, **after Step A evidence has merged**:

```
HELEN GO: SPRINT3_RISKWORKER_OPTION_B_L3_STEP_B_COMPILED_RUN_VALIDATION_ONCE
```

Each GO authorizes **only** its own step, **once**, in a **non-production** context, and **nothing
else**.

---

## 6. Ambiguous / partial-GO-invalid rule

- A GO is valid **only** if it is the **exact** phrase for the exact step (§5), issued by the operator,
  scoped to that step alone.
- **Any** ambiguity, paraphrase, partial match, missing token, altered status string, combined
  A+B request, wrong step order (Step B before Step A evidence merges), or scope drift makes the GO
  **INVALID** → **do not execute**; stop and request a clean, exact, scoped GO.
- A GO for Step A does **not** authorize Step B (and vice-versa). A GO for one run does **not** authorize
  a retry. **No inference, no "close enough."** When in doubt, treat as no-GO and take the safe,
  read-only interpretation.

---

## 7. Operator preconditions

Before issuing a GO (and before the operator executes), all must hold:

- This planning PR is **reviewed and merged**.
- For Step B: the **Step A evidence PR is merged** first.
- The working tree is **clean** and the **HEAD is pinned** to the reviewed base/head (§8).
- The operation runs in a **non-production, source-only** environment: no server, no production data, no
  secrets, no DB, no network beyond the normal toolchain, no customer-output surface.
- The operator confirms **no** secret/DSN/host/private-path will be printed, and the **safe output
  contract** (§13) and **forbidden outputs** (§14) are understood.
- A **rollback/no-op** understanding is in place (§16): the artifact is transient/gitignored; the tsx
  path remains active.

---

## 8. Clean-tree / head-pinned requirements

- Before any execution: verify `git status` shows a **clean tree** (no uncommitted changes; pre-existing
  untracked research notes are ignored and never staged) and `git diff --check` is clean.
- Verify **base** = `sprint2-architecture-contracts-d4cc2bf` at or after
  `82e491dd267bb0ae7c3ea407cd456036d728f063`, and **HEAD** is the exact reviewed commit.
- If the head changed after the reviewed state, or the tree is not clean, **stop** — do not execute.
- The evidence PR records the exact base/head SHAs it validated against.

---

## 9. Build execution boundary (Step A)

- Step A runs `build:riskworker-artifact` **exactly once**, non-production, source-only. It invokes
  `tsc` to emit into the gitignored `COMPILED_ARTIFACT_ROOT` = `dist/riskworker/`.
- Building **does not execute** the worker. Step A must **not** run `run:riskworker-compiled`, any tsx
  worker, any classifier, risk-evidence, or record-only pass.
- No server, no runtime worker invocation, no DB/network, no secrets, no production data, no customer
  output, no Gate action.
- On any build failure: **fail closed** (§15) and record only safe labels — no raw build output, no
  exact errors, no stack traces.

---

## 10. Compiled-run validation boundary (Step B)

- Step B validates `run:riskworker-compiled` **only after** Step A evidence merges and under its **own**
  exact GO (§5). It runs in a **non-production, source-only** context.
- Step B is a **validation** that the compiled entrypoint is runnable in parity terms — it must **not**
  become the default/authorized runtime, must **not** touch production data/DB/network/secrets, must
  **not** generate customer output, and must **not** move a Gate.
- The existing `tsx` scripts remain the **active/rollback** path throughout; Step B does not replace
  them.
- Step B records **safe labels only** (e.g. `compiled_run_started`, `compiled_run_exit_class`,
  `compiled_run_completed_without_customer_output`) — never raw worker output, captures, DSNs, or
  customer data. On any failure: **fail closed** (§15).

---

## 11. Runtime preflight boundary

- The runtime preflight command (`proof:riskworker-runtime-preflight`,
  `RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND`) **remains unwired** and is **out of scope** for this
  plan. Neither Step A nor Step B wires or runs it.
- Any future preflight wiring/execution is its **own** separately-planned slice under its own review /
  GO. This plan neither wires nor authorizes it.

---

## 12. Artifact generation and retention policy

- The compiled artifact under `dist/riskworker/` is a **generated, gitignored, transient** by-product.
  It is **never committed**, never published, and never promoted to a runtime path by this plan.
- Step A **generates** the artifact locally/CI-side; **retention is transient** — it is rebuilt from
  source and discarded, not source-controlled. The evidence PR commits **no** artifact — only a
  safe-labelled docs note.
- If any future need to retain/publish an artifact arises, that is a **separate** decision requiring its
  own planning + review (default policy: **never commit generated artifacts**).

---

## 13. Safe output contract

All evidence and console output from the future operation must be **derived-safe** — booleans, counts,
enumerated status classes, and non-sensitive labels only. Permitted examples (illustrative,
non-binding):

```yaml
# Step A (build)
base_head_verified: <bool>
clean_tree_verified: <bool>
preflight_parity_proof_green: <bool>
build_executed_once: <bool>
build_exit_class: ok | failed          # class only, never raw output
artifact_present: <bool>
artifact_file_count: <int>             # count only, never paths/contents
artifact_committed: false              # must stay false
compiled_runtime_path_active: false    # Step A does not activate runtime
tsx_scripts_unchanged: true

# Step B (compiled run)
compiled_run_started: <bool>
compiled_run_exit_class: ok | failed
compiled_run_completed_without_customer_output: <bool>
gate_d_or_e_moved: false

# carried safe labels (not re-derived, not root-cause)
build_surface_label: build_surface
disambiguation_label: structurally_expected_dual_signal
runtime_cause_inference: false
```

The operation asserts **no** root cause and unblocks **no** Gate.

---

## 14. Forbidden outputs

The future operation (and this planning doc) must never emit:

- raw build output, raw worker output, exact error strings, or stack traces;
- artifact **file paths** or artifact **contents**; dependency-file contents, lockfile contents, or
  `package.json` bodies;
- environment values, secrets, tokens, private keys, DSNs, connection strings, hosts, ports,
  usernames, or passwords (or any connection component);
- SQL text or SQL results;
- private capture paths or capture contents (`run.err` / `run.safe.out` / private captures);
- customer data (never);
- base64 blobs or other opaque encoded payloads;
- any concrete new constant value committed ahead of registration (no raw literal drift).

---

## 15. Forbidden actions + fail-closed criteria

**Forbidden here (this planning PR)** and, in the future operation, **unless** covered by the exact
scoped GO for that step:

- [ ] No execution of any kind in this planning PR.
- [ ] No `build:riskworker-artifact` execution (Step A only, under Step-A GO).
- [ ] No `run:riskworker-compiled` execution (Step B only, under Step-B GO, after Step A evidence merges).
- [ ] No worker / classifier / risk-evidence / record-only execution.
- [ ] No runtime preflight wiring or execution.
- [ ] No SQL / psql; no DB / network action; no DB mutation.
- [ ] No production access; no server / runtime touch (beyond the scoped, non-production execution).
- [ ] No secret / env read (values); no deploy.
- [ ] No artifact committed; no artifact path/contents printed.
- [ ] No source / package / script / workflow / dependency / lockfile change; no refactor; no Phase C.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate D / Gate E / Gate4E / Gate4F movement.
- [ ] No fix / remediation / retry loop.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.

**Fail-closed criteria** (future operation): stop immediately, take no further action, and record only
safe labels if **any** of these occur — GO phrase not exact/scoped (§6); tree not clean or head not
pinned (§8); base mismatch; build/run non-zero exit; any attempt to print a forbidden output (§14); any
DB/network/server/production/secret access; any customer-output or Gate action; Step B invoked before
Step A evidence merges; or any ambiguity. **Fail-closed = no execution / halt + safe-label-only
report.**

---

## 16. Rollback / no-op boundary

- **This planning PR** is inherently a no-op on runtime/build/workflow/registry state; nothing to roll
  back beyond reverting the single docs file.
- **Step A rollback:** the generated artifact is gitignored and transient — simply delete/ignore it;
  nothing is committed; the tsx path is unaffected. No runtime-behavior risk.
- **Step B rollback:** the compiled path is a validation only and never becomes the default runtime; the
  existing tsx scripts remain the active path and the rollback. No runtime-behavior change persists.

---

## 17. Evidence plan

- Step A produces a **docs-only evidence PR** (safe labels per §13) recording base/head verified, clean
  tree, preflight green, build executed once, artifact presence booleans/counts, artifact **not**
  committed, tsx unchanged. No raw build output.
- Step B (separate, later) produces its **own docs-only evidence PR** (safe labels per §13) recording
  the compiled-run validation outcome class, no-customer-output confirmation, and no Gate movement. No
  raw worker output.
- Neither evidence PR commits an artifact; neither changes source/package/workflow; each records the
  exact SHAs and the exact GO phrase honored.

---

## 18. Negative-action ledger (this planning PR)

```yaml
l3_operation_executed: false
build_riskworker_artifact_executed: false
run_riskworker_compiled_executed: false
compiled_runtime_path_activated: false
runtime_preflight_wired_or_executed: false
worker_rerun_performed: false
classifier_rerun_performed: false
risk_evidence_rerun_performed: false
record_only_rerun_performed: false
proof_command_executed_in_this_pr: false
artifact_generated: false
artifact_committed: false
package_script_changed: false
workflow_changed: false
dependency_or_lockfile_changed: false
constants_md_edited: false
config_constants_ts_edited: false
source_or_runtime_changed: false
refactor_performed: false
phase_c_migration_performed: false
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
go_issued_in_this_pr: false
raw_build_output_in_doc: false
raw_worker_output_in_doc: false
artifact_path_or_contents_in_doc: false
exact_raw_error_in_doc: false
stack_trace_in_doc: false
dependency_file_contents_in_doc: false
env_values_in_doc: false
sql_result_in_doc: false
customer_data_in_doc: false
secret_or_dsn_or_host_in_doc: false
private_path_in_doc: false
base64_blob_in_doc: false
```

---

## 19. Post-run interpretation rules

- **This document's effect:** a recorded, planning-level definition of a future controlled L3 operation
  (build execution + compiled-run validation), sequenced as separate Step A / Step B. No implementation,
  no execution, no Gate movement, no state change beyond recording the plan. **It is not a GO.**
- **Allowed follow-up:** issue the exact scoped GO (§5) for Step A **only after** this planning PR is
  reviewed and merged; execute Step A **once**, non-production/source-only; produce the Step A evidence
  PR. Then, separately, GO + execute Step B after Step A evidence merges.
- **Requires new GO + review:** any build execution, compiled-run execution, runtime preflight
  wiring/execution, worker/classifier/risk-evidence/record-only execution, SQL/psql, mutation, deploy,
  Gate D/E movement, or customer-output action.
- No interpretation may treat this plan as authorization, as a GO, or as a root-cause inference; the
  sealed classification stands unchanged. A successful build or compiled-run validation proves only that
  the artifact builds / the compiled entrypoint runs — **not** runtime correctness, DB role binding,
  worker behavior, customer-output behavior, or any Gate condition.

---

## 20. Gate D / Gate E boundary

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Planning this L3 build validation does not unblock Gate D/E.** A successful Step A / Step B proves
  build/run mechanics only, not Gate readiness.
- No plan in this PR may be treated as authorization to move Gate D/E or to implement anything.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + exact GO.

---

## 21. Required post-run evidence PR

- Each executed step (A, then B) **must** be followed by its **own docs-only evidence PR** under
  `docs/ops/`, using **safe labels only** (§13), recording: exact base/head SHAs, clean-tree
  confirmation, the exact GO phrase honored, preflight-green (Step A), execution-once, outcome class,
  artifact-not-committed / no-customer-output / tsx-unchanged, and the preserved sealed state.
- The evidence PR **changes no source/package/script/workflow/dependency/lockfile** and **commits no
  artifact**. It is validated with the standard static bundle + `proof:riskworker-ci-build-parity`.
- Absent a merged evidence PR, the step is considered **not evidenced**; no downstream step (or Gate
  discussion) may rely on it.

---

_End of planning document. Docs-only. Plans a future controlled L3 operation (build execution + compiled-
run validation, sequenced Step A then Step B) but is **not a GO** and authorizes no execution, build,
compiled run, runtime/server touch, artifact commit, fix, retry, Gate D/E, customer-output action, or
root-cause inference. Existing tsx risk-worker scripts remain active and unchanged. Sealed state
preserved._
