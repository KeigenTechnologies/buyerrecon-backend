# Sprint 3 — Risk-Worker Option B Step B Safe Disambiguation Planning

> **Docs-only planning document.** Plans a **future, safe, label-only Step B disambiguation** of the
> **ambiguous** Step A build-failure surfaces recorded in PR #402
> (`ambiguous_multiple_safe_surfaces` → `unknown_build_failure_surface`). This document **plans but
> does not disambiguate, execute, build, run, retry, or fix anything**. It registers no constant,
> edits no registry/source/package/script/workflow/config/schema/migration/env/runtime file, changes
> no dependency/lockfile, and **does not run** `build:riskworker-artifact`, `run:riskworker-compiled`,
> or any worker/classifier/risk-evidence/record-only/DB/network/SQL/customer-output command. It
> **reads no raw build output, no raw parity output, no exact errors** and infers **no root cause**.
>
> **Authorizes nothing.** This planning PR is **not** a GO and is **not** a disambiguation. It grants
> no Step B execution, no retry, no fix, no build execution, no compiled-run execution, no raw-output
> inspection, no runtime/server touch, no DB/network/SQL, no production access, no customer-output
> action, no Gate D/E movement, and no root-cause inference. A future Step B may proceed **only** under
> a separately reviewed command-pack and a **separate exact scoped GO** (see §7), after this planning
> PR is reviewed and merged.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`; Step A
> safe surface `unknown_build_failure_surface`; `runtime_cause_inference = false`. None of these are
> root-cause inferences; none unblock Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_STEP_B_DISAMBIGUATION_PLANNING_ONLY`

---

## 1. Status and purpose

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_STEP_B_DISAMBIGUATION_PLANNING_ONLY`
- **Purpose:** Define a **safe Step B disambiguation plan** for the ambiguous Step A build-failure
  surfaces — specifying what a future, separately authorized Step B **may inspect**, how it must
  **reduce evidence to safe labels**, and what remains **forbidden** — **without executing anything**.
- **Change class:** **docs-only, planning-only, evidence-policy-only.** Adds exactly one file under
  `docs/ops/`.
- **Layer (this PR):** L1 (docs-only). The **future Step B** is a separately-reviewed, separately-GO'd
  activity that must remain safe-label-only.
- **No execution authorized.** This PR plans; it does not disambiguate, build, run, retry, fix, or
  touch runtime/server/DB/customer-output.
- **Prerequisite merged evidence state:** **PR #402** —
  `SPRINT3_RISKWORKER_OPTION_B_STEP_A_BUILD_FAILURE_DIAGNOSIS_EVIDENCE`, merged into
  `sprint2-architecture-contracts-d4cc2bf` at merge commit
  `1f12c54dcfe7626d03356bf4d5647903a368fa21`.

---

## 2. Inputs from PR #402 (recorded safe facts — carried, not re-derived)

```yaml
diagnosis_status: completed
one_classification_run_only: true
candidate_output_tuple_count: 1
safe_surface_signal_count: 4
diagnostic_result: ambiguous_multiple_safe_surfaces
safe_build_failure_surface: unknown_build_failure_surface
runtime_cause_inference: false
```

- The Step A safe-classification run **completed** exactly once.
- Exactly **one** candidate output tuple was emitted.
- **Four** safe surface signals were true.
- The result was **ambiguous** across multiple safe surfaces.
- The only safe classification was `unknown_build_failure_surface`.
- This is a **safe diagnostic label only — not a root-cause inference.**
- **Gate D/E remain blocked where dependent.** PR #402 authorized **no further action.**

---

## 3. Remaining ambiguity (why Step B is being planned)

Step A safely identified **multiple co-present** build-failure **surfaces**
(`safe_surface_signal_count: 4`) and could **not** reduce them to a single surface without unsafe raw
exposure. It therefore recorded `ambiguous_multiple_safe_surfaces` and held the safe surface at
`unknown_build_failure_surface`. Step A **did not determine root cause** and asserted none.

The remaining ambiguity is strictly at the **surface** level: *which* single build-failure surface (if
any) can be safely selected. It is **not** a root-cause question. A surface describes **where** a build
stops structurally, **not why**. Step B, if ever authorized, exists **only** to attempt a **safe**
reduction of this surface ambiguity — never to infer cause, never to fix, never to retry.

---

## 4. Future Step B design (what a later, separately authorized Step B would be allowed to do)

> The following describes a **future** activity that is **not authorized by this PR** and may proceed
> only under §7. It is a design boundary, not a grant.

If — and only if — separately approved under §7, a future Step B **would be allowed to**:

- **Read only allowlisted, already-existing safe artifacts or metadata.** No new build, no new run, no
  new capture is produced by Step B. It may consult only pre-existing safe inputs on the allowlist:
  - presence/emptiness flags already recorded (e.g. `build_stdout_nonempty`, `parity_stdout_nonempty`);
  - aggregate artifact **counts** already recorded (e.g. `artifact_file_count`, `expected_entrypoint_count`);
  - static repo-shape metadata (presence/parse-ok/count of `package.json`/`tsconfig` **fields only**,
    never their bodies) as already surfaced by the merged static-guardrail trail.
- **Reduce every observation to safe labels, booleans, and aggregate counts** before it is recorded —
  emitting at most **one** safe surface label from the §5 taxonomy, plus derived booleans and counts.
- **Emit a single candidate output tuple** and a pass / fail-closed status with a safe stop label.
- **Stay fail-closed:** if any observation could only be made by reading forbidden raw output (§6), or
  a single safe surface cannot be selected, Step B **must** stop and record `no_safe_disambiguation_possible`
  (or carry `ambiguous_multiple_safe_surfaces` / `unknown_build_failure_surface`) rather than expose
  anything unsafe.

A future Step B **must never**, under any circumstance:

- print raw outputs or exact errors (§6);
- execute any build, compiled run, runtime, worker, classifier, record-only, server, DB/network/SQL,
  production, or customer-output action;
- perform a retry, a fix, or any source/package/config/runtime change;
- infer root cause or move any Gate.

---

## 5. Proposed safe label taxonomy (for a future Step B output only)

A future Step B, if authorized, would emit **exactly one** surface label from this closed set. Each is
a **surface**, not a cause; selecting one asserts no root cause and unblocks no Gate.

```yaml
step_b_safe_surface_label:            # exactly one of:
  - typescript_compile_error_surface
  - tsconfig_include_or_outdir_surface
  - module_resolution_surface
  - emitted_artifact_path_mismatch_surface
  - dependency_or_type_surface
  - generated_artifact_partial_or_absent_surface
  - unknown_build_failure_surface
  - ambiguous_multiple_safe_surfaces
  - no_safe_disambiguation_possible
```

- The first six are candidate **single** surfaces a safe reduction might select.
- `unknown_build_failure_surface` and `ambiguous_multiple_safe_surfaces` are the **carried** Step A
  states, retained when no safe single-surface reduction is available.
- `no_safe_disambiguation_possible` is the explicit **fail-closed** outcome when disambiguation cannot
  be completed without unsafe raw exposure.

---

## 6. Explicit forbidden outputs (a future Step B must never disclose)

A future Step B (and this document) must **never** print, record, or commit:

- raw build **stdout/stderr**;
- raw parity **stdout/stderr**;
- exact compiler errors, error codes, or error messages;
- stack traces;
- dependency-file contents (`package.json` bodies, lockfile contents);
- source excerpts beyond safe labels (no offending file path, line, or import specifier);
- secrets, tokens, private keys, DSNs, connection strings, hosts, ports, usernames, passwords, or any
  connection component;
- private paths (absolute or user paths) and private capture contents;
- base64 blobs or other opaque encoded payloads;
- generated artifacts (contents or committed files);
- customer data or generated customer output (never).

Only derived-safe booleans, aggregate counts, and enumerated safe labels may ever be recorded.

---

## 7. Authorization boundary

- **This planning PR authorizes no Step B execution.** It is **not** a GO, **not** a disambiguation,
  and **not** a command-pack.
- A future Step B requires a **separate exact scoped GO**, issued **after** this planning PR is
  reviewed and merged, and bounded by a separately reviewed command-pack.
- No content in this document may be treated as authorization to inspect raw output, build, run, retry,
  fix, execute any worker/classifier/record-only/DB/network/SQL/server/production/customer-output
  command, move any Gate, or infer any root cause.
- **No silent escalation.** Any deviation from the safe-label-only boundary halts fail-closed and
  requires separate planning + a separate exact GO.

---

## 8. Gate status

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **This PR does not move gates.** The ambiguous Step A surface and any future Step B outcome unblock
  **no** Gate and imply **no** scoring/customer-output readiness.
- Any Gate D/E movement must be separately proven independent or separately authorized, under its own
  planning + exact GO where applicable.

---

## 9. Negative-action ledger (this planning PR)

```yaml
planning_pr_is_docs_only: true
execution_performed: false
build_executed: false
compiled_run_executed: false
retry_performed: false
fix_attempted: false
step_b_started: false
step_b_authorized: false
source_change: false
package_or_config_or_workflow_change: false
schema_or_migration_or_env_change: false
runtime_or_generated_artifact_change: false
customer_output_file_change: false
worker_rerun: false
classifier_rerun: false
record_only_rerun: false
risk_evidence_rerun: false
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

_End of planning document. Docs-only, planning-only, evidence-policy-only. Defines a future safe Step B
disambiguation plan for the ambiguous Step A build-failure surfaces (PR #402:
`ambiguous_multiple_safe_surfaces` → `unknown_build_failure_surface`). Authorizes no Step B execution,
no build, no run, no retry, no fix, no runtime/server touch, no DB/network/SQL action, no
customer-output action, and no Gate D/E movement; infers no root cause. A future Step B requires a
separate reviewed command-pack and a separate exact scoped GO. Sealed state preserved. Gate D/E remain
blocked where dependent._
