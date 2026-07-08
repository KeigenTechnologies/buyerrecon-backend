# Sprint 3 — Risk-Worker Option B Step A Build-Failure Diagnosis Planning

> **Docs-only planning document.** Plans a **future, safe, label-only diagnosis** of the L3 **Step A**
> build-command failure recorded (fail-closed, `build_command_failed`) in PR #399. This document
> **plans but does not diagnose, execute, retry, or fix anything**. It registers no constant, edits no
> registry file, changes no source/package/script/workflow/dependency/lockfile/runtime behavior, and
> **does not run** `build:riskworker-artifact`, `run:riskworker-compiled`, or any worker/classifier/
> risk-evidence/record-only command. It **reads no raw build output** and infers **no root cause**.
>
> **Authorizes nothing.** This planning PR is **not** a GO and is **not** a diagnosis. It grants no
> retry, no fix, no build execution, no compiled-run execution, no raw-log inspection, no Step B, no
> runtime/server touch, no DB/network/SQL, no production access, no customer-output action, no Gate D/E
> movement, and no root-cause inference. The future diagnosis may proceed **only** under a separate
> reviewed **command-pack** and a **separate exact scoped GO** (see §7–§8), after this planning PR is
> reviewed and merged.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None of these are root-cause inferences; none unblock Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_STEP_A_BUILD_FAILURE_DIAGNOSIS_PLANNING_ONLY`

---

## 1. Title

**Sprint 3 — Risk-Worker Option B Step A Build-Failure Diagnosis Planning**

---

## 2. Status and scope

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_STEP_A_BUILD_FAILURE_DIAGNOSIS_PLANNING_ONLY`
- **Scope:** Add exactly one docs-only planning file under `docs/ops/`. Plan a future **safe,
  label-only** diagnosis of the Step A build-command failure. No diagnosis, no execution, no retry, no
  fix, no source/package/script/workflow/dependency/lockfile change, no refactor, no Phase C in this
  PR.
- **Change class:** **docs-only**.
- **Layer (this PR):** L1 (docs-only). The **future diagnosis** is a separately-reviewed activity
  (command-pack) that must remain safe-label-only.
- **Suggested file:** `docs/ops/sprint3-riskworker-option-b-step-a-build-failure-diagnosis-planning.md`.

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

Known safe state as of PR #399 merge (base `sprint2-architecture-contracts-d4cc2bf`
@ `745ee5803dab42f52bbdce9752d1460a7db4b4e5`):

- **PR #399** merged the **Step A evidence** record (docs-only, safe labels).
- The **Step A exact GO** was issued and **executed once**
  (`HELEN GO: SPRINT3_RISKWORKER_OPTION_B_L3_STEP_A_BUILD_ARTIFACT_GENERATION_ONCE`).
- `proof:riskworker-ci-build-parity` **passed before** the build (`parity_exit_zero: true`).
- `build:riskworker-artifact` was **invoked exactly once**.
- `build:riskworker-artifact` **failed** (`build_exit_zero: false`).
- Stop label: **`stop_label = build_command_failed`** — Step A halted **fail-closed**.
- **Raw build/parity output was not printed** (captured privately; not committed).
- `run:riskworker-compiled` was **not executed**.
- Runtime preflight was **not executed** (and remains unwired).
- **Step B was not started.**
- **No artifact was committed** (`dist/riskworker/` gitignored; 0 tracked).
- **No server commit or server push** occurred.
- `runtime_cause_inference = false` — **no root cause inferred**.
- Existing `tsx` risk-worker scripts remain **active and unchanged** as the rollback path; the compiled
  runtime path remains **inactive**.
- Gate D/E remain **blocked where dependent** (risk-worker, risk evidence, scoring readiness, customer
  output, or production validation).
- Trail: PR #378 → … → #393 → #395 → #397 → #398 (L3 plan) → #399 (Step A evidence).

---

## 4. Diagnosis objective

Plan a **future, safe, label-only** way to move the build-failure surface from **`unknown_build_surface`**
toward a **classified** safe category (see §6) — **without** printing raw logs, **without** re-running
the build in this planning context, and **without** inferring a root cause. The objective is
**classification of the failure surface into a safe category**, not a fix and not a cause claim.

The diagnosis is intended, when later run under its own reviewed command-pack + GO, to emit a **single
safe category label** (plus safe booleans/counts) describing *where* the build failed structurally
(e.g. compile-error class vs tsconfig surface vs module-resolution surface), so a later, separately
planned remediation can be scoped. It stops at **classification**; it does not remediate.

---

## 5. Explicit non-goals

The future diagnosis (and this plan) explicitly do **not**:

- retry or re-run `build:riskworker-artifact` as a "fix attempt";
- run `run:riskworker-compiled`, the worker, a classifier, risk-evidence, or a record-only pass;
- print, inspect, store, or commit **raw** build/parity output, exact errors, or stack traces;
- infer, assert, or imply a **root cause** (`runtime_cause_inference` stays `false`);
- propose or apply a **fix** / remediation / code or config change;
- change source/package/script/workflow/dependency/lockfile; refactor; or perform a Phase C migration;
- touch DB/network/SQL, production, server/runtime, secrets/env values, or customer output;
- start **Step B**;
- move **Gate D/E**.

Classification ≠ cause. A safe category label describes the **surface**, not the **reason**, and is not
a root-cause inference.

---

## 6. Proposed safe diagnostic categories

The future diagnosis must resolve to **exactly one** of these safe, enumerated categories (a surface
label only — not a root cause):

```yaml
diagnostic_category:            # exactly one of:
  - typescript_compile_error_class        # build stopped in TS type/compile checking (class only)
  - tsconfig_include_or_outdir_surface    # include/outDir/rootDir config surface
  - module_resolution_surface             # import/module-resolution surface
  - emitted_artifact_path_mismatch        # emitted path vs registered compiled-entrypoint mismatch
  - dependency_or_type_surface            # dependency/@types availability surface
  - generated_artifact_partial_or_absent  # emit incomplete/absent after non-zero exit
  - unknown_build_failure_surface         # cannot be safely classified into the above (stays unknown)
```

- These are **surfaces**, not causes. Selecting one asserts **no** root cause and unblocks **no** Gate.
- If the failure cannot be classified **safely** (i.e. only raw-log inspection would disambiguate, and
  no reviewed safe command-pack is available), the category **stays `unknown_build_failure_surface`** —
  the surface remains `unknown_build_surface`. **No guessing.**

---

## 7. Future command-pack requirement

- Any diagnosis that would require reading raw build logs to classify **must** be performed by a
  **separately reviewed command-pack** that:
  - emits **safe labels/booleans/counts only** (one `diagnostic_category` + safe booleans);
  - **never prints, stores, or commits raw logs**, exact errors, stack traces, dependency-file
    contents, env values, private paths, secrets, DSNs, hosts, customer data, or base64 blobs;
  - performs **no fix, no retry, no remediation**, and changes no source/config;
  - runs in a **non-production, source-only** context, touching no server/DB/network/secret;
  - is reviewed and merged as its own artifact **before** any diagnosis run.
- Absent such a reviewed command-pack, the diagnosis **may not read raw logs** and the category stays
  `unknown_build_failure_surface`.

---

## 8. Exact future GO placeholder + ambiguous/partial-GO-invalid rule

**Exact future GO placeholder.** A future diagnosis run that executes any command (e.g. a reviewed
safe-classification command-pack) may proceed **only** when the operator issues, verbatim and scoped to
the exact action:

```
HELEN GO: SPRINT3_RISKWORKER_OPTION_B_STEP_A_BUILD_FAILURE_DIAGNOSIS_SAFE_CLASSIFY_ONCE
```

(The exact final phrase is fixed in the command-pack PR that this plan anticipates; this placeholder
marks its shape and intent.)

**Ambiguous / partial-GO-invalid rule.** A GO is valid **only** if it is the exact phrase for the exact
action, issued by the operator, scoped to that action alone. **Any** ambiguity, paraphrase, partial
match, missing/altered token, combined request, wrong ordering, or scope drift makes the GO **INVALID**
→ **do not execute**; stop and request a clean, exact, scoped GO. A GO to *classify* never authorizes a
*fix*, a *retry*, *Step B*, or raw-log printing. **No inference, no "close enough."** When in doubt,
treat as no-GO and take the safe, read-only interpretation.

> A **purely static** diagnosis (reasoning over already-safe labels and tracked config **without**
> reading raw logs and **without** running any command) needs no GO — but it also cannot claim more
> than the static evidence supports, and must still emit safe labels only.

---

## 9. Safe output contract

All future diagnosis output/evidence must be **derived-safe** — a single enumerated category plus
booleans/counts and non-sensitive labels only. Permitted examples (illustrative, non-binding):

```yaml
diagnostic_category: <one of §6>
classified_from_raw_logs: <bool>          # true only under a reviewed safe command-pack + GO
classified_statically_only: <bool>
raw_build_output_printed: false           # must stay false
raw_parity_output_printed: false          # must stay false
build_reinvoked_during_diagnosis: false   # must stay false (no retry)
artifact_committed: false
fix_proposed_or_applied: false
gate_d_or_e_moved: false
# carried safe labels (not re-derived, not root-cause)
build_surface_label: build_surface
previous_sublabel: unknown_build_surface
disambiguation_label: structurally_expected_dual_signal
runtime_cause_inference: false
```

The diagnosis asserts **no** root cause and unblocks **no** Gate.

---

## 10. Forbidden outputs

The future diagnosis (and this planning doc) must never emit:

- raw build logs, raw parity logs, raw build output, exact error strings, or stack traces;
- dependency-file contents, lockfile contents, or `package.json` bodies;
- environment values, secrets, tokens, private keys, DSNs, connection strings, hosts, ports,
  usernames, or passwords (or any connection component);
- SQL text or SQL results;
- private capture paths or capture contents (`run.err` / `run.safe.out` / private captures);
- private paths (absolute or user paths);
- customer data (never);
- base64 blobs or other opaque encoded payloads;
- any concrete new constant value committed ahead of registration (no raw literal drift).

---

## 11. Forbidden actions

Forbidden here (this planning PR) and, in the future diagnosis, **unless** covered by a reviewed safe
command-pack + exact scoped GO:

- [ ] No diagnosis execution in this planning PR.
- [ ] No retry; no re-run of `build:riskworker-artifact`.
- [ ] No `run:riskworker-compiled` execution; no compiled runtime activation.
- [ ] No worker / classifier / risk-evidence / record-only execution.
- [ ] No runtime preflight wiring or execution.
- [ ] No raw-log inspection/printing/committing (safe classification only, via reviewed command-pack).
- [ ] No fix / remediation / code or config change.
- [ ] No source / package / script / workflow / dependency / lockfile change; no refactor; no Phase C.
- [ ] No SQL / psql; no DB / network action; no DB mutation.
- [ ] No production access; no server / runtime touch; no secret / env read (values); no deploy.
- [ ] No artifact generation or commit.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate D / Gate E / Gate4E / Gate4F movement.
- [ ] No Step B start.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.

---

## 12. Fail-closed criteria

The future diagnosis stops immediately, takes no further action, and records only safe labels if **any**
of these occur: GO phrase not exact/scoped (§8); a step would require raw-log inspection but no reviewed
safe command-pack exists (§7); any attempt to print/commit a forbidden output (§10); any build re-run /
retry / fix attempt; any `run:riskworker-compiled` / worker / classifier / risk-evidence / record-only
execution; any DB/network/server/production/secret access; any customer-output or Gate action; any Step
B initiation; or any ambiguity. **Fail-closed = halt + safe-label-only report; category stays
`unknown_build_failure_surface` when it cannot be safely classified.**

---

## 13. Evidence plan

- Any future diagnosis run produces a **docs-only evidence PR** under `docs/ops/`, using **safe labels
  only** (§9): the single `diagnostic_category`, the classification-mode booleans, and the preserved
  sealed state. No raw logs, no exact errors, no stack traces, no private paths.
- If the diagnosis used a reviewed command-pack, the evidence PR records that it did so and that the
  command-pack emitted safe labels only (`raw_build_output_printed: false`).
- A purely static diagnosis records `classified_statically_only: true` and asserts nothing beyond the
  static evidence.
- The evidence PR **changes no source/package/script/workflow/dependency/lockfile** and **commits no
  artifact**; it is validated with the standard static bundle + `proof:riskworker-ci-build-parity`.

---

## 14. Rollback / no-op boundary

- **This planning PR** is a no-op on runtime/build/workflow/registry state; nothing to roll back beyond
  reverting the single docs file.
- **Future diagnosis** is inherently non-mutating: it classifies a surface using safe labels and changes
  nothing. There is nothing to roll back beyond reverting its evidence doc. It commits no artifact and
  switches no runtime; the tsx path stays active throughout.

---

## 15. Negative-action ledger (this planning PR)

```yaml
diagnosis_executed: false
build_reinvoked: false
build_riskworker_artifact_executed: false
run_riskworker_compiled_executed: false
worker_rerun: false
classifier_rerun: false
risk_evidence_rerun: false
record_only_rerun: false
runtime_preflight_wired_or_executed: false
raw_build_log_read: false
raw_build_log_printed: false
raw_parity_log_printed: false
proof_executed_in_this_pr_as_validation_only: true   # static guardrail bundle only; no build/run
fix_proposed_or_applied: false
retry_loop: false
step_b_started: false
source_or_package_or_script_or_workflow_changed: false
dependency_or_lockfile_changed: false
registry_or_config_or_tsconfig_changed: false
refactor_performed: false
phase_c_migration_performed: false
artifact_generated_or_committed: false
sql_or_psql_performed: false
db_network_action_performed: false
production_access_performed: false
server_or_runtime_touch_performed: false
secret_or_env_read_performed: false
deploy_performed: false
customer_output_or_gate_performed: false
gate_d_or_e_movement_performed: false
root_cause_inference_performed: false
go_issued_in_this_pr: false
raw_build_output_in_doc: false
raw_parity_output_in_doc: false
exact_build_error_in_doc: false
stack_trace_in_doc: false
dependency_file_contents_in_doc: false
env_values_in_doc: false
private_path_in_doc: false
secret_or_dsn_or_host_in_doc: false
customer_data_in_doc: false
base64_blob_in_doc: false
```

---

## 16. Post-diagnosis interpretation rules

- **This document's effect:** a recorded, planning-level definition of a future safe, label-only
  diagnosis of the Step A build failure. No diagnosis, no execution, no retry, no fix, no Gate movement,
  no state change beyond recording the plan. **It is not a GO and not a diagnosis.**
- **Allowed follow-up:** perform a purely static, safe-label diagnosis (no raw logs, no command) once
  this plan is merged; **or** author a reviewed safe-classification command-pack and, under its exact
  scoped GO, run it once and produce a docs-only evidence PR.
- **Requires new PR + review + (where applicable) exact GO:** any command-pack, any raw-log
  inspection, any build re-run, any fix, any Step B action, any worker/classifier/risk-evidence/
  record-only execution, any SQL/psql, mutation, deploy, Gate D/E movement, or customer-output action.
- No interpretation may treat this plan, or any resulting safe category label, as a **root-cause
  inference** or as authorization to **fix**, **retry**, or **proceed to Step B**. A safe category
  describes the failure **surface** only; the sealed classification stands unchanged.

---

## 17. Gate D / Gate E boundary

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Build-failure diagnosis planning does not unblock Gate D/E.** A safe category label does not
  establish Gate readiness.
- No plan in this PR may be treated as authorization to move Gate D/E or to implement, fix, retry, or
  proceed to Step B.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + exact GO where applicable.

---

_End of planning document. Docs-only. Plans a future safe, label-only diagnosis of the Step A build
failure but is **not a GO** and authorizes no retry, fix, build execution, raw-log inspection, compiled
run, Step B, Gate D/E movement, customer-output action, DB/network/SQL action, runtime/server touch, or
root-cause inference. Existing tsx risk-worker scripts remain active and unchanged; compiled runtime
path remains inactive; no artifact committed. Sealed state preserved; Gate D/E remain blocked where
dependent._
