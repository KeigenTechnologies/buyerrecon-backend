# Sprint 3 — Risk-Worker Option B Step B Safe Disambiguation Command-Pack (Review-Only)

> **Docs-only command-pack review document.** Defines — for **review only** — the exact, bounded
> command-pack a future operator would run to attempt a **safe Step B disambiguation** of the
> **ambiguous** Step A build-failure surfaces recorded in PR #402
> (`ambiguous_multiple_safe_surfaces` → `unknown_build_failure_surface`), under the plan merged in
> PR #403. This document **defines but does not execute**. It runs **no** command, reads **no** raw
> build/parity output, changes no source/package/script/workflow/config/schema/migration/env/runtime
> behavior, commits no dependency/lockfile change, and infers **no** root cause.
>
> **Authorizes nothing.** Reviewing/merging this command-pack is **not** a GO and **not** a
> disambiguation. It grants no Step B execution, no retry, no fix, no build execution, no parity proof,
> no compiled-run, no worker/classifier/record-only command, no raw-output printing/commit, no
> runtime/server touch, no DB/network/SQL, no production access, no customer-output action, no Gate D/E
> movement, and no root-cause inference. The future Step B run may proceed **only** under the **exact
> scoped GO** in §7, after this review PR is merged.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`; Step A
> safe surface `unknown_build_failure_surface`; `runtime_cause_inference = false`. None of these are
> root-cause inferences; none unblock Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_STEP_B_DISAMBIGUATION_COMMAND_PACK_REVIEW_ONLY`

---

## 0. Scope, layer, and known safe facts

- **Change class:** docs-only (this PR). Adds exactly one command-pack review file under `docs/ops/`.
- **Layer (this PR):** L1 (docs-only, review-only). The **future Step B run** the pack describes is a
  separately-GO'd activity that must remain **safe-label-only** — read-only over allowlisted
  already-existing inputs, never printing/committing raw content.
- **This PR executes nothing** and is validated with the static guardrail bundle only (§6).

Known safe facts (base `sprint2-architecture-contracts-d4cc2bf` @
`85ac3314cda150f1ce80de411059d1254ced2174`):

- **PR #402** recorded the Step A safe-classification evidence: `diagnosis_status=completed`, one
  classification run, `candidate_output_tuple_count=1`, `safe_surface_signal_count=4` →
  `ambiguous_multiple_safe_surfaces` → `unknown_build_failure_surface` (safe label only).
- **PR #403** merged the Step B **disambiguation planning** (safe-label-only design + taxonomy).
- `runtime_cause_inference = false`.
- Gate D/E remain **blocked where dependent**.

---

## 1. Exact future Step B objective

Attempt to reduce the **ambiguous** Step A build-failure surface
(`ambiguous_multiple_safe_surfaces` / `unknown_build_failure_surface`) to **exactly one** safe surface
label (§4), using only **read-only, already-existing** allowlisted inputs (§2) reduced to safe labels
/ booleans / aggregate counts. The objective is a **safe surface disambiguation** — **not** a fix,
**not** a retry, **not** a build/run, and **not** a root-cause claim. A surface describes **where** the
build stops structurally, **not why**.

If a single surface cannot be selected **safely** (i.e. only forbidden raw exposure would
disambiguate), Step B **fails closed** (§5) and the surface **stays** `unknown_build_failure_surface`
(or records `no_safe_disambiguation_possible`).

---

## 2. Allowed read-only inputs (allowlist)

The future Step B may read **only** these **already-existing, safe** inputs. It produces **no** new
build, run, or capture.

- **Recorded safe presence/emptiness flags** from PR #402 (e.g. `build_stdout_nonempty`,
  `build_stderr_nonempty`, `parity_stdout_nonempty`, `parity_stderr_nonempty`) — the **flags only**,
  never the underlying output.
- **Recorded aggregate counts** from PR #402 (e.g. `artifact_file_count`, `artifact_js_file_count`,
  `expected_entrypoint_count`, `expected_entrypoint_nonempty_count`) — **counts only**, never paths or
  contents.
- **Recorded safe surface signals** from PR #402 (the six boolean surface signals + `safe_surface_signal_count`).
- **Static repo-shape metadata** already surfaced by the merged static-guardrail trail: presence /
  parse-ok / field-count of tracked `package.json` and `tsconfig.riskworker-artifact.json`
  (**field presence and counts only**, never their bodies), and the registered compiled-entrypoint
  **path contract name** (`RISKWORKER_COMPILED_ENTRYPOINT` under `COMPILED_ARTIFACT_ROOT`) as a
  **name/shape** reference, never a filesystem dump.

Every input above must be reduced to a **safe label / boolean / aggregate count** before it is recorded.

---

## 3. Forbidden inputs and outputs

The future Step B (and this document) must **never** read-for-disclosure, print, record, or commit:

**Forbidden inputs (must not be opened for disclosure or transcription):**

- raw build stdout/stderr; raw parity stdout/stderr; private capture files/paths;
- dependency-file contents or lockfile contents; `package.json` / `tsconfig` **bodies**;
- generated artifacts (contents); env files; secrets stores; DB/network endpoints; customer data.

**Forbidden outputs (must never appear anywhere):**

- raw build output, raw parity output;
- exact compiler errors, error codes, or error messages;
- stack traces;
- dependency-file contents;
- source excerpts beyond safe labels (no offending file path, line, or import specifier);
- secrets, tokens, private keys, DSNs, connection strings, hosts, ports, usernames, passwords, or any
  connection component;
- private paths (absolute or user paths);
- base64 blobs or other opaque encoded payloads;
- generated artifacts (contents or committed files);
- customer data or generated customer output.

Only derived-safe booleans, aggregate counts, and enumerated safe labels may ever be emitted.

---

## 4. Allowed safe output labels only

A future Step B run emits **exactly one** surface label from this closed set (per the PR #403 taxonomy),
plus derived booleans, aggregate counts, and a pass / fail-closed status with a safe stop label. Each
label is a **surface**, not a cause; selecting one asserts no root cause and unblocks no Gate.

```yaml
step_b_safe_surface_label:            # exactly one of:
  - typescript_compile_error_surface
  - tsconfig_include_or_outdir_surface
  - module_resolution_surface
  - emitted_artifact_path_mismatch_surface
  - dependency_or_type_surface
  - generated_artifact_partial_or_absent_surface
  - unknown_build_failure_surface          # carried Step A state
  - ambiguous_multiple_safe_surfaces       # carried Step A state
  - no_safe_disambiguation_possible        # explicit fail-closed outcome
```

Permitted companion safe fields (illustrative, non-binding):

```yaml
step_b_status: pass | fail_closed
disambiguation_reduced_to_single_surface: <bool>
inputs_read_were_allowlisted_only: true
raw_build_output_printed: false            # must stay false
raw_parity_output_printed: false           # must stay false
exact_errors_printed: false                # must stay false
build_invoked: false                       # must stay false
parity_proof_invoked: false                # must stay false
compiled_run_invoked: false                # must stay false
fix_attempted: false
retry_loop: false
gate_d_or_e_moved: false
runtime_cause_inference: false
stop_label: <safe stop label, e.g. no_safe_disambiguation_possible | disambiguation_unsafe_without_raw_exposure>
```

---

## 5. Stop conditions (fail-closed)

The future Step B **must stop immediately and fail closed** (recording a safe stop label, mutating
nothing) if **any** of the following holds:

- disambiguation would require reading or disclosing any **forbidden input/output** (§3) → stop,
  record `disambiguation_unsafe_without_raw_exposure`, keep `unknown_build_failure_surface`;
- **no single** safe surface can be selected from the allowlisted inputs → record
  `no_safe_disambiguation_possible` (or carry `ambiguous_multiple_safe_surfaces`);
- the working tree is **not clean**, or **HEAD is not pinned** to the reviewed base/head → stop before
  any read;
- any step would require a **build**, **parity proof**, **compiled run**, **worker/classifier/
  record-only** command, **retry**, **fix**, **runtime/server touch**, **DB/network/SQL**, **production**,
  or **customer-output** action → stop; **not authorized**;
- the GO is **not** the exact §7 phrase (any paraphrase, partial match, missing/altered token, combined
  request, or scope drift) → **do not execute**; request a clean, exact, scoped GO.

**No silent escalation.** When in doubt, take the safe, read-only interpretation and stop.

---

## 6. Validation commands for THIS command-pack PR only

This review PR executes nothing. It is validated with **local, static, docs/guardrail checks only**
that do **not** build, run runtime, touch server, touch DB/network/SQL, or inspect forbidden raw
outputs:

- `git status` — confirm clean tree (pre-existing untracked research notes ignored, never staged).
- `git diff --check` — confirm no whitespace/conflict artifacts.
- File-list inspection — confirm **exactly one** added file under `docs/ops/`, `.md` only.
- Static guardrail bundle (pure-static node scripts): `check:constants`, `check:static-boundaries`,
  `check:pg-pool-construction`, `check:observer-shape`, `check:record-only-gate`,
  `check:customer-output-boundary`, `check:db-pool-factory-scaffold`, `check:no-runtime-imports`.

**Must NOT run for this PR:** `build:riskworker-artifact`, `run:riskworker-compiled`,
`proof:riskworker-ci-build-parity`, or any Step B / worker / classifier / risk-evidence / record-only /
DB / network / SQL / server / production / customer-output command.

---

## 7. Future execution authorization boundary

- The future Step B run may proceed **only** when the operator issues, **verbatim** and scoped to the
  exact action, a **separate exact GO** (illustrative form; the operator's issued phrase governs):

  ```
  HELEN GO: SPRINT3_RISKWORKER_OPTION_B_STEP_B_DISAMBIGUATION_SAFE_ONCE
  ```

- A GO is valid **only** if it is the exact scoped phrase, issued by the operator, scoped to the safe
  Step B disambiguation action **alone**. **Any** ambiguity, paraphrase, partial match, missing/altered
  token, combined request, wrong ordering, or scope drift makes the GO **INVALID** → **do not
  execute**.
- A GO to **disambiguate** never authorizes a **fix**, a **retry**, a **build**, a **parity proof**, a
  **compiled run**, **Step C / remediation**, raw-output printing/committing, or Gate D/E movement.
- **Operator preconditions:** PR #402 (evidence) and PR #403 (planning) merged; **this** command-pack
  review PR merged; working tree clean; HEAD pinned to the reviewed base/head; run is
  **non-production, source-only** (no server, no production data, no secrets, no DB, no network beyond
  the normal toolchain, no customer-output surface).
- **No silent escalation.** Reviewing/merging this pack authorizes **no** execution. A separate exact
  scoped GO is required for the future Step B run, and any further step (remediation / Step C) requires
  its own separate planning + exact GO.

---

## 8. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **This command-pack PR authorizes no Gate D / Gate E movement** and no downstream customer-facing
  action. Any Step B outcome unblocks **no** Gate.
- Any Gate D/E movement must be separately proven independent or separately authorized, under its own
  planning + exact GO where applicable.

---

## 9. Negative-action ledger (this command-pack PR)

```yaml
command_pack_pr_is_docs_only: true
execution_performed: false
step_b_started: false
step_b_authorized: false
build_executed: false
parity_proof_executed: false
compiled_run_executed: false
worker_rerun: false
classifier_rerun: false
record_only_rerun: false
risk_evidence_rerun: false
retry_performed: false
fix_attempted: false
source_or_package_or_script_or_workflow_change: false
schema_or_migration_or_env_change: false
config_or_tsconfig_or_registry_change: false
dependency_or_lockfile_change: false
runtime_or_generated_artifact_change: false
customer_output_file_change: false
sql_psql: false
db_network_action: false
production_mutation: false
server_or_runtime_touch: false
customer_output_gate_action: false
gate_d_e_movement: false
runtime_cause_inference: false
raw_build_output_in_doc: false
raw_parity_output_in_doc: false
exact_errors_in_doc: false
stack_trace_in_doc: false
dependency_file_contents_in_doc: false
source_excerpt_in_doc: false
secret_or_dsn_or_host_in_doc: false
private_path_in_doc: false
base64_blob_in_doc: false
generated_artifact_in_doc: false
customer_data_in_doc: false
```

---

_End of command-pack review document. Docs-only, review-only. Defines the bounded future safe Step B
disambiguation the operator may run for the ambiguous Step A build-failure surfaces (PR #402:
`ambiguous_multiple_safe_surfaces` → `unknown_build_failure_surface`; plan PR #403). Authorizes no
Step B execution, no build, no parity proof, no compiled run, no worker/classifier/record-only command,
no retry, no fix, no runtime/server touch, no DB/network/SQL action, no customer-output action, and no
Gate D/E movement; infers no root cause. The future Step B run requires a separate exact scoped GO
after this review PR is merged. Sealed state preserved. Gate D/E remain blocked where dependent._
