# Sprint 3 — Risk-Worker Option B Step C Higher-Disclosure Diagnostic Command-Pack (Review-Only)

> **Docs-only command-pack review document.** Defines — for **review only** — a possible **future,
> separately authorized higher-disclosure diagnostic** path that could safely inspect a minimal,
> allowlisted set of controlled failure evidence **if the operator later grants explicit permission**,
> to attempt to distinguish the still-ambiguous build-failure surfaces from the Step B fail-closed
> outcome (PR #405). This document **defines the command-pack and custody model only**. It runs **no**
> command, inspects **no** raw output, builds/runs/retries/fixes nothing, and moves **no** gates.
>
> **Authorizes nothing.** Reviewing/merging this command-pack is **not** a GO and **not** a diagnostic
> run. It grants no higher-disclosure diagnostic execution, no raw-output inspection, no remediation,
> no Step C execution, no build, no parity proof, no compiled run, no Step B rerun, no
> worker/classifier/record-only command, no retry, no fix, no runtime/server touch, no DB/network/SQL,
> no production access, no customer-output action, no Gate D/E movement, and no root-cause inference.
> A future higher-disclosure diagnostic may proceed **only** under the boundary in §10.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked_none_not_classified`; surface label `build_surface`; previous
> sublabel `unknown_build_surface`; disambiguation label `structurally_expected_dual_signal`; Step A
> safe surface `unknown_build_failure_surface`; Step B outcome `no_safe_disambiguation_possible`;
> `runtime_cause_inference = false`. None of these are root-cause inferences; none unblock Gate D/E.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_STEP_C_HIGHER_DISCLOSURE_DIAGNOSTIC_COMMAND_PACK_REVIEW_ONLY`

---

## 1. Status and purpose

- **Status:** `SPRINT3_RISKWORKER_OPTION_B_STEP_C_HIGHER_DISCLOSURE_DIAGNOSTIC_COMMAND_PACK_REVIEW_ONLY`
- **Purpose:** Define — **for review only** — the exact, bounded higher-disclosure diagnostic
  command-pack and its **custody model**, so that a future, separately authorized run *could* safely
  inspect controlled failure evidence under strict custody **if** the operator later grants explicit
  permission.
- **Change class:** **docs-only, command-pack-only, review-only.** Adds exactly one file under
  `docs/ops/`.
- **Layer (this PR):** L1 (docs-only, review-only). The **future diagnostic run** is a separately-GO'd,
  higher-risk activity that must remain safe-label-only on output while inspecting more evidence than
  prior safe steps.
- **No execution authorized.** This PR **defines a possible future diagnostic boundary, not a
  diagnostic run.** It executes nothing beyond static validation (see "Allowed validation").
- **Prerequisite merged planning state:** **PR #406** —
  `SPRINT3_RISKWORKER_OPTION_B_STEP_C_REMEDIATION_PLANNING`, merged into
  `sprint2-architecture-contracts-d4cc2bf` at merge commit
  `1e29e0c02fd35931ea00e0d1af455c9de06b5d72`.

---

## 2. Prior merged trail (safe labels / aggregate state only)

```yaml
pr_402_step_a_evidence: ambiguous_multiple_safe_surfaces -> unknown_build_failure_surface
pr_403_step_b_planning: safe_label_only_disambiguation_framework
pr_404_step_b_command_pack: exact_go_safe_step_b_boundary
pr_405_step_b_run_evidence: fail_closed / no_safe_disambiguation_possible
pr_406_step_c_planning: next_path_must_be_separately_planned_reviewed_and_go_d
gate_d_e_status: blocked_where_dependent
runtime_cause_inference: false
```

- **#402 — Step A evidence:** `ambiguous_multiple_safe_surfaces` → `unknown_build_failure_surface`.
- **#403 — Step B planning:** safe-label-only disambiguation framework.
- **#404 — Step B command-pack:** exact-GO safe Step B boundary.
- **#405 — Step B run evidence:** `fail_closed` / `no_safe_disambiguation_possible`.
- **#406 — Step C planning:** any next path must be separately planned, reviewed, and GO'd.
- **Gate D/E remain `blocked_where_dependent`.**

---

## 3. Problem statement

- The build-failure **surface remains ambiguous** and **un-root-caused**.
- Step B observed **multiple** safe surface signals (four co-present) and could **not** reduce them to
  a single surface using only the low-disclosure, allowlisted safe inputs — it recorded
  `no_safe_disambiguation_possible` and **failed closed**.
- Distinguishing the surfaces **may** require **controlled inspection of higher-disclosure failure
  evidence** (e.g. previously-captured build/parity output already in the sealed evidence trail).
- Because such inspection carries **more disclosure risk** than the prior safe steps, it is a
  **higher-risk diagnostic path** that must **not** proceed without **explicit operator
  authorization**, a defined **custody model** (§6), and a strict **redaction policy** (§7). This
  document defines those preconditions; it does **not** perform the inspection.

---

## 4. Higher-disclosure diagnostic objective (future, not authorized here)

> The following describes a **future** activity that is **not authorized by this PR** and may proceed
> only under §10. It is a design boundary, not a grant.

If — and only if — separately approved under §10, a future higher-disclosure diagnostic **would**:

- **Inspect only a minimal, allowlisted failure-evidence set** strictly necessary to distinguish
  build-failure surfaces (§5).
- **Reduce all observations into safe labels only** (single surface label + booleans + aggregate
  counts) before anything leaves the server.
- **Not commit raw evidence** to git, ever.
- **Not print raw evidence** into chat or any PR/doc, ever.
- **Not infer root cause** unless the allowed evidence **explicitly supports a safe surface-level
  classification** — and even then it records a **surface**, never a cause.
- Treat any selected surface as **diagnostic only**: selecting a surface **does not** authorize
  remediation, Step C execution, or Gate D/E movement.

---

## 5. Proposed future diagnostic inputs (possible future inputs — not authorized by this PR)

These are **candidate** inputs a future run *might* be allowed to read **only if explicitly allowlisted
in a later exact GO**. This PR authorizes reading **none** of them.

- **already-existing captured build stdout/stderr and parity stdout/stderr** from the sealed Step A
  evidence trail — **only if they exist and are explicitly allowlisted later**;
- **already-existing local diagnostic artifacts** referenced by prior evidence — **only if explicitly
  allowlisted later**;
- **tracked repo metadata** needed to contextualize the evidence — but **only** through field
  names/counts or safe summaries (never file bodies);
- **no** secrets, DSNs, hosts, customer data, generated customer output, or DB/network/SQL evidence —
  **ever**.

> **Exact paths, custody location, and access method must be named in a future exact GO before any
> read happens.** No path is allowlisted by this document; naming a source here is descriptive, not a
> grant.

---

## 6. Higher-disclosure custody model (strict future custody requirements)

A future higher-disclosure diagnostic must satisfy **all** of the following custody requirements:

- **operator-only** local/server visibility of any raw evidence;
- **no raw evidence committed to git** — ever;
- **no raw evidence pasted into chat** — ever;
- **no raw evidence printed to terminal**, except inside a **private local file with restrictive
  permissions** if absolutely required by the future command-pack;
- **temporary files must be `chmod 600` or stricter** and confined to operator-only local/server
  storage;
- **output must be reduced to safe labels / booleans / counts before leaving the server**;
- **raw material must be left in place or deleted according to the future GO**, but **never copied
  into repo docs**;
- **fail closed** on: missing files, multiple candidate files, unexpected file shape, oversized input,
  or any secret / customer-data risk.

---

## 7. Redaction and output policy (future run)

A future higher-disclosure diagnostic may emit **only**:

```yaml
run_status: completed | blocked | fail_closed
one_run_only: true
exact_go_confirmed: true
inputs_read_were_allowlisted_only: true | false
raw_output_committed: false
raw_output_pasted: false
exact_errors_committed: false
safe_surface_label: <one allowed label from §8>
stop_label: <safe stop label>
# aggregate counts only
# forbidden-action booleans (all must be false)
```

A future higher-disclosure diagnostic must **not** emit:

- raw build stdout/stderr;
- raw parity stdout/stderr;
- exact compiler errors;
- stack traces;
- dependency-file contents;
- source excerpts;
- exact file paths beyond reviewed safe path **labels**;
- secrets, DSNs, hosts, private paths, base64 blobs;
- generated artifacts;
- customer data or customer output.

---

## 8. Safe label taxonomy (closed set)

A future run emits **exactly one** surface/outcome label from this closed set. Each is a **surface or
safe outcome**, not a cause; selecting one asserts no root cause and unblocks no Gate.

```yaml
safe_surface_label:            # exactly one of:
  - typescript_compile_error_surface
  - tsconfig_include_or_outdir_surface
  - module_resolution_surface
  - emitted_artifact_path_mismatch_surface
  - dependency_or_type_surface
  - generated_artifact_partial_or_absent_surface
  - unknown_build_failure_surface
  - ambiguous_multiple_safe_surfaces
  - no_safe_disambiguation_possible
  - higher_disclosure_diagnostic_blocked
  - higher_disclosure_diagnostic_unsafe_without_operator_custody
```

---

## 9. Fail-closed conditions (future run must stop safely)

A future higher-disclosure diagnostic **must stop safely** (record a safe stop label, mutate nothing,
disclose nothing) if **any** of the following holds:

- the exact GO is **absent, altered, combined with another request, or ambiguous**;
- the working tree is **not clean**;
- the base is **not pinned** to the reviewed command-pack merge;
- **more than one** candidate evidence source is found where exactly one is expected;
- the evidence source is **missing or malformed**;
- the diagnostic would require **secrets, DSNs, hosts, DB/network/SQL, customer data, or generated
  customer output**;
- the diagnostic would require **build / run / retry / fix / remediation**;
- the diagnostic would require **committing raw output or exact errors**;
- a safe label **cannot be selected without over-disclosure**.

On any of these, record e.g. `higher_disclosure_diagnostic_blocked` or
`higher_disclosure_diagnostic_unsafe_without_operator_custody`. **No silent escalation.**

---

## 10. Authorization boundary

- **This PR authorizes no higher-disclosure diagnostic execution.**
- **This PR authorizes no raw-output inspection.**
- **This PR authorizes no remediation.**
- **This PR authorizes no Step C execution.**
- **This PR authorizes no build / run / retry / fix.**
- **This PR authorizes no Gate D/E movement.**

A future higher-disclosure diagnostic requires **all** of the following, in order:

1. **this command-pack PR reviewed and merged**;
2. a **separate exact scoped GO**;
3. **explicit operator acceptance** that limited higher-disclosure evidence may be inspected **under
   custody** (§6);
4. **safe output only** (§7).

Absent all four, no higher-disclosure evidence may be read, and the diagnostic must not run. **No
silent escalation.**

---

## 11. Gate status

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation (`gate_d_e_status: blocked_where_dependent`).
- **This PR moves no gates.**
- **Any future diagnostic result also moves no gates** unless separately planned and authorized under
  its own planning + exact GO.

---

## 12. Allowed validation for THIS PR only

This review PR executes nothing. It is validated with **local, static, docs/guardrail checks only**
that do **not** build, run runtime, touch server, touch DB/network/SQL, inspect forbidden raw outputs,
or produce customer output:

- `git status` — confirm clean tree (pre-existing untracked research notes ignored, never staged).
- `git diff --check` — confirm no whitespace/conflict artifacts.
- File-list inspection — confirm **exactly one** added file under `docs/ops/`, `.md` only.
- Static guardrail bundle (pure-static node scripts): `check:constants`, `check:static-boundaries`,
  `check:pg-pool-construction`, `check:observer-shape`, `check:record-only-gate`,
  `check:customer-output-boundary`, `check:db-pool-factory-scaffold`, `check:no-runtime-imports`.

**Must NOT run for this PR:** `build:riskworker-artifact`, `proof:riskworker-ci-build-parity`,
`run:riskworker-compiled`, Step B, Step C, worker/classifier/record-only commands, any
DB/network/SQL/server/production/customer-output command, or any command that opens or prints raw
build/parity outputs.

---

## 13. Negative-action ledger (this command-pack PR)

```yaml
command_pack_pr_is_docs_only: true
execution_performed: false
higher_disclosure_diagnostic_executed: false
raw_output_inspected: false
step_b_rerun: false
step_c_started: false
remediation_performed: false
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

_End of command-pack review document. Docs-only, review-only. Defines a possible future,
separately-authorized higher-disclosure diagnostic path and its custody/redaction model for the
still-ambiguous, un-root-caused build-failure surface (Step B: `no_safe_disambiguation_possible`,
PR #405; Step C planning PR #406). Authorizes no higher-disclosure diagnostic execution, no raw-output
inspection, no remediation, no Step C execution, no build/parity/run/retry/fix, no worker/classifier/
record-only command, no runtime/server touch, no DB/network/SQL action, no customer-output action, and
no Gate D/E movement; infers no root cause. A future higher-disclosure diagnostic requires this pack
reviewed and merged, a separate exact scoped GO, explicit operator acceptance of custody, and safe
output only. Sealed state preserved. Gate D/E remain blocked where dependent._
