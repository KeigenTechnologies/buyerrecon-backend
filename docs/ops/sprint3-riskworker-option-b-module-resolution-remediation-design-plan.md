# Sprint 3 Risk-Worker Option B Module Resolution Remediation Design Plan

> **Docs-only remediation/fix design planning document.** This PR defines possible future remediation
> design paths for the safe surface label `module_resolution_surface`. It is **design-planning-only**:
> it authorizes no execution, no remediation, no fix, no build retry, no parity proof, no compiled
> run, no Step B rerun, no Step C rerun, no higher-disclosure diagnostic rerun, no worker/classifier/
> record-only command, no source/config/package/workflow/schema/migration/env/runtime change, no
> server touch, no DB/network/SQL action, no production command, no customer-output action, no
> scoring/downstream action, no Gate D/E movement, and no root-cause inference.
>
> **No raw output or forbidden content is included.** This document records only safe labels,
> booleans, aggregate-safe state, and future planning boundaries. It contains no raw build
> stdout/stderr, no raw parity stdout/stderr, no exact compiler errors, no stack traces, no
> dependency-file contents, no source excerpts beyond safe labels, no secrets, DSNs, hosts, private
> paths, base64 blobs, generated artifacts, generated artifact contents, customer data, customer
> output, exact evidence file paths, or custody paths.
>
> **Prerequisite merged diagnostic evidence state:** PR #408 is merged into
> `sprint2-architecture-contracts-d4cc2bf` at
> `94d3a8735fd1f7cbd011820947e4a070cc0f8154`.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_MODULE_RESOLUTION_REMEDIATION_DESIGN_PLANNING_ONLY`

---

## 1. Status and purpose

```yaml
planning_status: module_resolution_remediation_design_planning_only
docs_only: true
design_planning_only: true
prerequisite_merged_pr: 408
prerequisite_base_sha: 94d3a8735fd1f7cbd011820947e4a070cc0f8154
safe_surface_label: module_resolution_surface
disambiguation_reduced_to_single_surface: true
runtime_cause_inference: false
gate_d_e_status: blocked_where_dependent
execution_authorized: false
remediation_authorized: false
fix_authorized: false
build_retry_authorized: false
raw_output_inspection_authorized: false
gate_d_e_movement_authorized: false
```

Purpose:

- Record a conservative remediation/fix design framework after PR #408 selected the safe surface label
  `module_resolution_surface`.
- Define possible future remediation design paths without choosing or applying a fix.
- Define what a future remediation command-pack must specify before any source/config/package change
  can be considered.
- Preserve Gate D/E as blocked where dependent.

This PR is not a GO. It adds exactly one docs-only file under `docs/ops/`.

---

## 2. Prior merged trail

Only safe labels and aggregate-safe state are carried forward.

```yaml
pr_402_step_a_evidence:
  diagnostic_result: ambiguous_multiple_safe_surfaces
  safe_build_failure_surface: unknown_build_failure_surface
  runtime_cause_inference: false

pr_403_step_b_planning:
  framework: safe_label_only_disambiguation
  raw_output_disclosure_authorized: false
  gate_movement_authorized: false

pr_404_step_b_command_pack:
  exact_go_boundary_defined: true
  execution_authorized_by_pr: false

pr_405_step_b_run_evidence:
  step_b_status: fail_closed
  step_b_safe_surface_label: no_safe_disambiguation_possible
  disambiguation_reduced_to_single_surface: false
  runtime_cause_inference: false

pr_406_step_c_remediation_planning:
  decision_framework_defined: true
  direct_remediation_recommended: false
  remediation_authorized_by_pr: false

pr_407_step_c_higher_disclosure_command_pack:
  higher_disclosure_boundary_defined: true
  exact_go_boundary_defined: true
  execution_authorized_by_pr: false

pr_408_step_c_higher_disclosure_evidence:
  run_status: completed
  safe_surface_label: module_resolution_surface
  disambiguation_reduced_to_single_surface: true
  runtime_cause_inference: false
  gate_d_e_status: blocked_where_dependent
```

Plain reading: the diagnostic trail has reduced the ambiguous build-failure surface to
`module_resolution_surface`, but this is still a surface classification only. It is not a root-cause
inference and does not authorize a fix.

---

## 3. Problem statement

The current safe diagnostic state is:

```yaml
safe_surface_label: module_resolution_surface
disambiguation_reduced_to_single_surface: true
runtime_cause_inference: false
gate_d_e_status: blocked_where_dependent
```

Interpretation:

- The build/parity failure appears to be in the module-resolution surface.
- This does **not** prove the specific root cause.
- It does **not** identify a specific import, export, entrypoint, configuration key, dependency, type
  declaration, file, or package as the cause.
- Remediation must therefore be designed conservatively and validated later under a separate reviewed
  command-pack and separate exact scoped GO.

This planning PR cannot choose a fix, cannot apply a fix, cannot run validation, and cannot move any
Gate.

---

## 4. Candidate remediation design paths

The following paths are future design options only. None is authorized by this PR.

### Path A - Import/entrypoint contract alignment

Future review may compare tracked source import shapes and compiled entrypoint contract names at an
allowed inspection level.

Potential design scope:

- Check whether future allowed evidence supports an import/export boundary mismatch at the safe
  summary level.
- Check whether future allowed evidence supports an entrypoint naming or contract alignment issue at
  the safe summary level.
- Propose aligning import/export boundaries or entrypoint naming only if supported by allowed
  evidence and only in a later remediation PR.
- Keep any proposed change narrow and reversible.

Boundary:

```yaml
path_a_authorized_by_this_pr: false
source_change_authorized_by_this_pr: false
entrypoint_contract_change_authorized_by_this_pr: false
root_cause_inference_authorized_by_this_pr: false
```

### Path B - TypeScript module-resolution configuration review

Future review may inspect tracked TypeScript/package metadata and module-resolution-related
configuration shape under a separately approved command-pack.

Potential design scope:

- Review only tracked metadata and configuration shape that the future command-pack explicitly allows.
- Compare module-resolution-related configuration shape to the compiled artifact contract at the safe
  summary level.
- Propose config-only remediation only if allowed evidence supports it.
- Avoid assuming root cause from the selected surface label alone.

Boundary:

```yaml
path_b_authorized_by_this_pr: false
config_change_authorized_by_this_pr: false
package_change_authorized_by_this_pr: false
build_retry_authorized_by_this_pr: false
```

### Path C - Dependency/type declaration surface review

Future review may inspect tracked dependency metadata and type-declaration surface at a safe summary
level under a separately approved command-pack.

Potential design scope:

- Review dependency/type declaration presence, names, and aggregate-safe shape only if the future
  command-pack permits it.
- Propose dependency or type-declaration remediation only if supported by allowed evidence.
- Avoid copying dependency-file contents or source excerpts into docs.
- Keep any proposed dependency/type declaration change isolated from unrelated runtime movement.

Boundary:

```yaml
path_c_authorized_by_this_pr: false
dependency_change_authorized_by_this_pr: false
type_declaration_change_authorized_by_this_pr: false
runtime_movement_authorized_by_this_pr: false
```

### Path D - No-fix / escalate-to-human-source-review

If no safe remediation can be selected without exact source/error review, keep the issue blocked and
escalate only through a future human source-review command-pack.

Potential design scope:

- Keep Gate D/E blocked where dependent.
- Defer remediation until the operator approves a stronger review boundary.
- Require the future command-pack to define source-viewing rules, excerpt rules, non-commit rules,
  validation limits, and fail-closed labels.
- Continue to avoid raw outputs, exact errors, dependency-file contents, generated artifacts, and
  customer data.

Boundary:

```yaml
path_d_authorized_by_this_pr: false
human_source_review_authorized_by_this_pr: false
no_fix_recorded_as_available_option: true
gate_d_e_status: blocked_where_dependent
```

---

## 5. Recommended next path

```yaml
recommended_next_path: separate_module_resolution_remediation_command_pack
direct_code_remediation_recommended: false
direct_code_remediation_authorized: false
one_narrow_remediation_pr_possible_later: true
one_narrow_remediation_pr_authorized_now: false
```

Recommended decision:

- Do **not** jump directly to code remediation.
- First create a separate docs-only module-resolution remediation command-pack.
- That command-pack should define the exact allowed tracked files, safe inspection rules, candidate
  patch constraints, output policy, fail-closed labels, validation plan, and exact future GO.
- The future command-pack should permit at most one narrow remediation PR later, and only after review
  and a separate exact scoped GO.

This recommendation authorizes no fix and no validation run.

---

## 6. Future remediation command-pack requirements

A future remediation command-pack must specify, before any remediation/fix work begins:

```yaml
must_define_allowed_tracked_files_to_inspect: true
must_define_operator_source_view_rules: true
must_define_source_excerpt_policy: true
must_define_source_config_package_change_policy: true
must_define_forbidden_files: true
must_define_validation_commands: true
must_define_build_or_parity_authorization_status: true
must_define_output_policy: true
must_define_fail_closed_labels: true
must_define_gate_d_e_status: true
must_require_separate_exact_go: true
```

Minimum policy requirements:

- It must state whether source excerpts may be viewed by the operator.
- It must state whether any source/config/package changes are allowed.
- It must list exact forbidden file categories.
- It must define exact validation commands and whether build/parity proof may be run after remediation
  design.
- It must prohibit compiled run, worker runtime, DB/network/SQL, production, customer-output movement,
  and Gate D/E movement unless separately planned and authorized.
- It must require safe outputs only: labels, booleans, counts, and reviewed summaries allowed by the
  future command-pack.
- It must fail closed on scope drift.

This PR does not supply the future exact file allowlist and does not authorize inspecting any file for
remediation.

---

## 7. Future validation boundary

The following validation layers may be considered by a future command-pack. They are **not** authorized
by this PR.

```yaml
static_file_list_inspection_future_possible: true
git_diff_check_future_possible: true
static_guardrails_future_possible: true
targeted_module_resolution_static_checker_future_possible: true
build_or_parity_proof_future_possible_only_if_separately_authorized: true
compiled_run_future_authorized_by_this_pr: false
worker_runtime_future_authorized_by_this_pr: false
db_network_sql_future_authorized_by_this_pr: false
customer_output_future_authorized_by_this_pr: false
```

Future validation constraints:

- Static file-list inspection may be allowed by a future command-pack.
- `git diff --check` may be allowed by a future command-pack.
- Existing static guardrails may be allowed if they do not build, run runtime, touch server, touch
  DB/network/SQL, inspect forbidden raw outputs, or produce customer output.
- A targeted module-resolution static checker may be allowed only if already present, non-runtime, and
  explicitly included by the future command-pack.
- Build/parity proof may be considered only if separately authorized after remediation design.
- No compiled run, worker runtime, DB/network/SQL, customer-output movement, scoring action, or
  downstream action is authorized by this PR.

---

## 8. Authorization boundary

```yaml
this_pr_is_not_a_go: true
remediation_authorized: false
fix_authorized: false
source_change_authorized: false
config_change_authorized: false
package_change_authorized: false
workflow_schema_migration_env_runtime_change_authorized: false
build_retry_authorized: false
parity_proof_authorized: false
compiled_run_authorized: false
step_b_rerun_authorized: false
step_c_rerun_authorized: false
higher_disclosure_diagnostic_rerun_authorized: false
raw_output_inspection_authorized: false
worker_classifier_record_only_authorized: false
runtime_server_touch_authorized: false
db_network_sql_authorized: false
production_action_authorized: false
customer_output_action_authorized: false
scoring_downstream_action_authorized: false
gate_d_e_movement_authorized: false
root_cause_inference_authorized: false
```

Any future remediation/fix requires:

- a separate command-pack PR;
- review of that command-pack;
- a separate exact scoped GO after review and merge;
- a fail-closed policy for scope drift;
- no implicit expansion from surface classification to root-cause claim.

No silent escalation is permitted.

---

## 9. Gate status

```yaml
gate_d_status: blocked_where_dependent
gate_e_status: blocked_where_dependent
scoring_readiness_claimed: false
customer_output_movement: false
downstream_movement: false
production_validation_claimed: false
```

- Gate D and Gate E remain blocked where dependent on risk-worker readiness, risk evidence, scoring
  readiness, customer output, downstream movement, or production validation.
- This PR moves no gates.
- Selecting `module_resolution_surface` does not unblock scoring, customer output, downstream
  movement, or production validation.
- Any Gate D/E movement must be separately proven independent or separately authorized under its own
  planning, review, and exact scoped GO.

---

## 10. Forbidden content and action ledger

```yaml
docs_only: true
design_planning_only: true
execution_performed: false
build_executed: false
parity_proof_executed: false
compiled_run_executed: false
step_b_rerun: false
step_c_rerun: false
higher_disclosure_diagnostic_rerun: false
worker_command_executed: false
classifier_command_executed: false
record_only_command_executed: false
retry_performed: false
fix_attempted: false
remediation_started: false
source_or_config_changed: false
package_or_workflow_changed: false
schema_or_migration_or_env_changed: false
runtime_file_changed: false
generated_artifact_changed: false
customer_output_file_changed: false
server_touch: false
db_network_sql_action: false
production_command: false
customer_output_action: false
scoring_downstream_action: false
gate_d_e_movement: false
runtime_cause_inference: false
raw_build_output_in_doc: false
raw_parity_output_in_doc: false
exact_compiler_errors_in_doc: false
stack_traces_in_doc: false
dependency_file_contents_in_doc: false
source_excerpts_in_doc: false
secret_or_dsn_or_host_in_doc: false
private_path_in_doc: false
base64_blob_in_doc: false
generated_artifact_contents_in_doc: false
customer_data_or_output_in_doc: false
evidence_path_in_doc: false
custody_path_in_doc: false
```

---

_End of remediation/fix design planning document. Docs-only and design-planning-only. Records
`module_resolution_surface` as a safe surface classification only, not a root-cause inference. Defines
future remediation design paths and recommends a separate module-resolution remediation command-pack
before any fix. Authorizes no remediation, no fix, no build retry, no validation run, no raw-output
inspection, no customer-output/scoring/downstream action, and no Gate D/E movement._
