# Sprint 3 — Risk-Worker Option B Step A Build-Failure Diagnosis Command-Pack (Review-Only)

> **Docs-only command-pack review document.** Defines — for **review only** — the exact, bounded
> command-pack a future operator would run to **safely classify** the L3 **Step A** build-command
> failure (`build_command_failed`, PR #399) into **one** safe surface label, emitting **safe
> labels/booleans/counts only** and **never** printing or committing raw output. This document
> **defines but does not execute**. It runs **no** command, reads **no** raw build/parity output,
> changes no source/package/script/workflow/dependency/lockfile/runtime behavior, and infers **no**
> root cause.
>
> **Authorizes nothing.** Reviewing/merging this command-pack is **not** a GO and **not** a diagnosis.
> It grants no diagnosis execution, no retry, no fix, no build execution, no compiled-run, no Step B,
> no raw-log printing/commit, no runtime/server touch, no DB/network/SQL, no production access, no
> customer-output action, no Gate D/E movement, and no root-cause inference. The future diagnosis run
> may proceed **only** under the **exact scoped GO** in §2, after this review PR is merged.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`;
> `runtime_cause_inference = false`. None of these are root-cause inferences; none unblock Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_STEP_A_BUILD_FAILURE_DIAGNOSIS_COMMAND_PACK_REVIEW_ONLY`

---

## 0. Scope, layer, and known safe facts

- **Change class:** docs-only (this PR). Adds exactly one command-pack review file under `docs/ops/`.
- **Layer (this PR):** L1 (docs-only, review-only). The **future diagnosis run** the pack describes is
  a separately-GO'd activity that must remain **safe-label-only** (it may read raw output **privately**
  but must never print/commit it).
- **This PR executes nothing** and is validated with the static bundle + `proof:riskworker-ci-build-parity`.

Known safe facts (base `sprint2-architecture-contracts-d4cc2bf` @
`15b915928c79f15136fcf2331788eff911c0b257`):

- **PR #399** recorded Step A **fail-closed** evidence.
- **PR #400** merged the build-failure **diagnosis planning**.
- `proof:riskworker-ci-build-parity` **passed before** the build (`parity_exit_zero: true`).
- `build:riskworker-artifact` was **invoked exactly once** and **failed**.
- `stop_label = build_command_failed`.
- **Raw build/parity output was not printed.**
- `run:riskworker-compiled` was **not executed**; runtime preflight was **not executed**.
- **Step B was not started**; **no artifact was committed**.
- `runtime_cause_inference = false`.
- Gate D/E remain **blocked where dependent**.

---

## 1. Exact diagnostic objective

Classify the Step A build failure into **exactly one** safe **surface** label (§8 candidate set),
moving the surface from `unknown_build_surface` toward a classified surface **only when it can be done
safely**, and emitting **safe labels/booleans/counts only**. The objective is **classification of the
failure surface** — **not** a fix, **not** a retry, and **not** a root-cause claim. If the surface
cannot be safely classified, it **stays `unknown_build_failure_surface`**.

A surface label describes **where** the build stopped structurally, **not why**. Selecting a label
asserts **no** root cause and unblocks **no** Gate.

---

## 2. Exact future GO phrase

The future diagnosis run may proceed **only** when the operator issues, **verbatim** and scoped to the
exact action:

```
HELEN GO: SPRINT3_RISKWORKER_OPTION_B_STEP_A_BUILD_FAILURE_DIAGNOSIS_SAFE_CLASSIFY_ONCE
```

This GO authorizes **one** safe-classification run **only**, in a **non-production, source-only**
context, and **nothing else** (no retry, no fix, no Step B, no raw-log printing/commit).

---

## 3. Ambiguous / partial-GO-invalid rule

- A GO is valid **only** if it is the **exact** phrase in §2, issued by the operator, scoped to the
  safe-classification action alone.
- **Any** ambiguity, paraphrase, partial match, missing/altered token, combined request, wrong
  ordering, or scope drift makes the GO **INVALID** → **do not execute**; stop and request a clean,
  exact, scoped GO.
- A GO to **classify** never authorizes a **fix**, a **retry**, **Step B**, a build re-run beyond what
  §6 permits, or raw-log printing/committing. **No inference, no "close enough."** When in doubt, treat
  as no-GO and take the safe, read-only interpretation.

---

## 4. Operator preconditions

Before issuing the GO (and before the operator runs the pack), all must hold:

- PR #400 (diagnosis planning) and **this** command-pack review PR are **reviewed and merged**.
- The working tree is **clean** and **HEAD is pinned** to the reviewed base/head (§5).
- The run is **non-production, source-only**: no server, no production data, no secrets, no DB, no
  network beyond the normal toolchain, no customer-output surface.
- The operator understands the **private raw-output custody boundary** (§6), the **safe output
  contract** (§7), and the **forbidden outputs** (§9): raw output may be read **privately** but **never**
  printed or committed.
- A **no-op/rollback** understanding is in place (§12): classification mutates nothing.

---

## 5. Clean-tree / head-pinned requirements

- Before any execution: verify `git status` shows a **clean tree** (pre-existing untracked research
  notes are ignored and never staged) and `git diff --check` is clean.
- Verify **base** = `sprint2-architecture-contracts-d4cc2bf` at or after
  `15b915928c79f15136fcf2331788eff911c0b257`, and **HEAD** is the exact reviewed commit.
- If the head changed after the reviewed state, or the tree is not clean, **stop** — do not execute.
- The evidence PR records the exact base/head SHAs it classified against.

---

## 6. Private raw-output custody boundary

- The diagnosis may **re-invoke the build once** (or reuse the privately-captured Step A output) **only
  if** classification genuinely requires it, and **only** in a non-production, source-only context. Any
  such re-invocation is bounded to **one** invocation and is **not** a retry/fix — it exists solely to
  obtain the signal needed to select a safe surface label.
- Raw build/parity output is **private, transient custody only**: it may be read **in-process** by the
  classifier to derive safe labels, then **discarded**. It must **never** be printed to the console,
  written to a tracked file, committed, attached, or pasted into any PR/doc.
- Only **derived-safe** signals (a single surface label + booleans/counts + status) leave the custody
  boundary. Raw content never crosses it.
- If safe classification is **not** achievable without exposing raw content, the classifier **fails
  closed** (§11) and the surface stays `unknown_build_failure_surface`.

---

## 7. Safe classifier logic

The classifier resolves to **exactly one** surface label (§8) using only **structural, non-sensitive**
signals derived privately (never emitted raw). Illustrative, **non-binding** decision shape:

- **`emitted_artifact_path_mismatch`** — the build emitted output, but the emitted path does not match
  the registered compiled-entrypoint path contract (`RISKWORKER_COMPILED_ENTRYPOINT` under
  `COMPILED_ARTIFACT_ROOT`). Signal: presence/absence of expected emitted path (boolean), not contents.
- **`generated_artifact_partial_or_absent`** — non-zero exit with **no** or **partial** emit into the
  artifact root. Signal: emitted-file **count** (0 / partial), not paths/contents.
- **`tsconfig_include_or_outdir_surface`** — failure localizes to the build-config surface
  (include / outDir / rootDir) as represented in tracked `tsconfig.riskworker-artifact.json`. Signal:
  config-shape boolean, not raw error text.
- **`module_resolution_surface`** — failure class is import/module resolution. Signal: resolution-class
  boolean, not the offending specifier text.
- **`dependency_or_type_surface`** — failure class is dependency/`@types` availability. Signal:
  dependency-class boolean, not dependency-file contents.
- **`typescript_compile_error_class`** — failure class is TS type/compile checking. Signal:
  compile-error **class** only (never the error text, never a code+message, never a stack).
- **`unknown_build_failure_surface`** — none of the above can be selected **safely** (only raw-content
  exposure would disambiguate). The surface **stays unknown**. **Default when uncertain.**

The classifier emits **one** label. It never emits which file/line/specifier/error produced it.

---

## 8. Candidate safe labels

```yaml
diagnostic_category:            # exactly one:
  - typescript_compile_error_class
  - tsconfig_include_or_outdir_surface
  - module_resolution_surface
  - emitted_artifact_path_mismatch
  - dependency_or_type_surface
  - generated_artifact_partial_or_absent
  - unknown_build_failure_surface
```

Each is a **surface**, not a cause. Selecting one asserts no root cause and unblocks no Gate.

---

## 9. Safe output contract

The future run emits **derived-safe** signals only — a single surface label plus booleans, aggregate
counts, pass/fail status, and fail-closed stop labels. Permitted examples (illustrative, non-binding):

```yaml
diagnostic_category: <one of §8>
classified: <bool>
classified_from_private_raw_output: <bool>   # true only under this pack + GO; raw NEVER emitted
classified_statically_only: <bool>
build_reinvoked_for_classification_count: 0 | 1   # bounded to at most 1; not a retry/fix
emitted_artifact_file_count: <int>           # aggregate count only, never paths/contents
expected_compiled_entrypoint_present: <bool>
raw_build_output_printed: false              # must stay false
raw_build_output_committed: false            # must stay false
raw_parity_output_printed: false             # must stay false
fix_proposed_or_applied: false
retry_loop: false
step_b_started: false
artifact_committed: false
gate_d_or_e_moved: false
classify_status: pass | fail_closed
stop_label: <safe stop label, e.g. build_command_failed | classification_unsafe_without_raw_exposure>
# carried safe labels (not re-derived, not root-cause)
build_surface_label: build_surface
previous_sublabel: unknown_build_surface
disambiguation_label: structurally_expected_dual_signal
runtime_cause_inference: false
```

The run asserts **no** root cause and unblocks **no** Gate.

---

## 10. Forbidden outputs

The future run (and this document) must never print or commit:

- raw build logs, raw parity logs, raw build output, exact error strings, error codes+messages, or
  stack traces;
- the offending file path, line, or import specifier;
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

## 11. Forbidden actions + fail-closed criteria

**Forbidden here (this review PR)** and, in the future run, **unless** covered by the exact scoped GO
(§2) and bounded by this pack:

- [ ] No diagnosis execution in this review PR.
- [ ] No retry; no build re-run beyond the single bounded classification invocation permitted by §6.
- [ ] No fix / remediation / code or config change.
- [ ] No `run:riskworker-compiled` execution; no compiled runtime activation; no runtime preflight.
- [ ] No worker / classifier / risk-evidence / record-only execution.
- [ ] No raw-log printing or committing; no raw content across the custody boundary (§6).
- [ ] No source / package / script / workflow / dependency / lockfile change; no refactor; no Phase C.
- [ ] No SQL / psql; no DB / network action; no DB mutation.
- [ ] No production access; no server / runtime touch; no secret / env read (values); no deploy.
- [ ] No artifact generation or commit.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate D / Gate E / Gate4E / Gate4F movement.
- [ ] No Step B start.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.

**Fail-closed criteria** (future run): stop immediately, take no further action, and record only safe
labels if **any** occur — GO phrase not exact/scoped (§3); tree not clean or head not pinned (§5); base
mismatch; classification would require exposing raw content (§6); more than one classification
invocation attempted; any attempt to print/commit a forbidden output (§10); any fix/retry attempt; any
`run:riskworker-compiled` / worker / classifier / risk-evidence / record-only execution; any
DB/network/server/production/secret access; any customer-output or Gate action; any Step B initiation;
or any ambiguity. **Fail-closed = halt + safe-label-only report; `classify_status: fail_closed`; the
surface stays `unknown_build_failure_surface`.**

---

## 12. No-op / rollback boundary

- **This review PR** is a no-op on runtime/build/workflow/registry state; nothing to roll back beyond
  reverting the single docs file.
- **Future run** is inherently non-mutating: it classifies a surface using safe labels and changes
  nothing tracked. Any single bounded build re-invocation (§6) emits only into the gitignored artifact
  root (transient, discarded, never committed). There is nothing to roll back beyond reverting the
  evidence doc; the tsx path stays active throughout.

---

## 13. Evidence capture plan

- The future run produces a **docs-only evidence PR** under `docs/ops/`, using **safe labels only**
  (§9): the single `diagnostic_category`, the classification-mode booleans/counts, `classify_status`,
  the safe `stop_label` (if fail-closed), and the preserved sealed state. **No** raw logs, exact errors,
  stack traces, or private paths.
- The evidence PR records the exact base/head SHAs, the exact GO phrase honored, and confirms
  `raw_build_output_printed: false` / `raw_build_output_committed: false`.
- The evidence PR **changes no source/package/script/workflow/dependency/lockfile** and **commits no
  artifact**; it is validated with the standard static bundle + `proof:riskworker-ci-build-parity`.

---

## 14. Post-run interpretation rules

- **This document's effect:** a reviewed definition of a bounded, safe classification command-pack. It
  is **not a GO** and **not a diagnosis**; it executes nothing and changes no state beyond recording the
  pack.
- **Allowed follow-up:** once this review PR is merged, the operator may issue the exact GO (§2) and run
  the pack **once**, then produce the docs-only evidence PR (§13).
- **Requires new PR + review + (where applicable) exact GO:** any fix, any remediation, any Step B
  action, any build re-run beyond the single bounded classification invocation, any
  worker/classifier/risk-evidence/record-only execution, any SQL/psql, mutation, deploy, Gate D/E
  movement, or customer-output action.
- No interpretation may treat this pack, or any resulting **surface label**, as a **root-cause
  inference** or as authorization to **fix**, **retry**, or **proceed to Step B**. A surface label
  describes **where** the build stopped, not **why**; the sealed classification stands unchanged.

---

## 15. Negative-action ledger (this review PR)

```yaml
command_pack_executed: false
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
raw_build_log_committed: false
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

## 16. Gate D / Gate E boundary

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **Reviewing/running this command-pack does not unblock Gate D/E.** A safe surface label does not
  establish Gate readiness.
- No content in this document may be treated as authorization to move Gate D/E or to implement, fix,
  retry, or proceed to Step B.
- Any Gate D / Gate E movement requires **separate remediation evidence** and a **separate readiness
  review**, under its own planning + exact GO where applicable.

---

## 17. Placeholder-only execution record template

> **Placeholder only — NOT filled in here.** The future evidence PR fills this with **safe labels
> only** after the operator runs the pack once under the exact GO (§2). Recorded here to fix the shape;
> **no values are asserted by this review PR.**

```yaml
# === Step A build-failure safe-classification execution record (PLACEHOLDER) ===
status: SPRINT3_RISKWORKER_OPTION_B_STEP_A_BUILD_FAILURE_DIAGNOSIS_SAFE_CLASSIFY_EVIDENCE
exact_go_phrase_honored: "<HELEN GO: ...SAFE_CLASSIFY_ONCE>"   # verbatim
base_sha: "<sha>"
head_sha: "<sha>"
clean_tree_verified: <bool>
head_pinned_verified: <bool>

diagnostic_category: <one of §8>          # <-- to be filled safely, or unknown_build_failure_surface
classified: <bool>
classified_from_private_raw_output: <bool>
classified_statically_only: <bool>
build_reinvoked_for_classification_count: 0 | 1
emitted_artifact_file_count: <int>
expected_compiled_entrypoint_present: <bool>
classify_status: pass | fail_closed
stop_label: <safe stop label or null>

raw_build_output_printed: false
raw_build_output_committed: false
raw_parity_output_printed: false
fix_proposed_or_applied: false
retry_loop: false
step_b_started: false
artifact_committed: false
gate_d_or_e_moved: false
runtime_cause_inference: false
# ==============================================================================
```

---

_End of command-pack review document. Docs-only, review-only. Defines a bounded, safe, label-only
build-failure classification command-pack but is **not a GO** and **not a diagnosis**; it authorizes no
diagnosis execution, retry, fix, build execution, compiled run, Step B, raw-log printing/commit, Gate
D/E movement, customer-output action, DB/network/SQL action, runtime/server touch, or root-cause
inference. Existing tsx risk-worker scripts remain active and unchanged; compiled runtime path remains
inactive; no artifact committed. Sealed state preserved; Gate D/E remain blocked where dependent._
