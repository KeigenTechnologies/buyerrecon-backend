# Sprint 3 Risk-Worker Option B Module Resolution Broader Named-File Remediation Command-Pack

> **Docs-only broader named-file remediation planning/command-pack.** This PR defines, for review
> only, a possible future broader named-file remediation workflow for the safe surface label
> `module_resolution_surface` after the config-only remediation attempt failed closed. It is
> **planning/command-pack only** and **review-only**. It authorizes no execution, no remediation, no
> fix, no source/config/package/workflow/schema/migration/env/runtime change, no build, no parity
> proof, no compiled run, no Step B rerun, no Step C rerun, no higher-disclosure diagnostic rerun, no
> remediation rerun, no worker/classifier/record-only command, no retry, no server touch, no
> DB/network/SQL action, no production command, no customer-output action, no scoring/downstream
> action, no Gate D/E movement, and no root-cause inference.
>
> **No raw output or forbidden content is included.** This document records only safe labels,
> booleans, aggregate-safe state, and future command-pack boundaries. It contains no raw build
> stdout/stderr, no raw parity stdout/stderr, no exact compiler errors, no stack traces, no
> dependency-file contents, no source excerpts beyond safe labels, no secrets, DSNs, hosts, private
> paths, base64 blobs, generated artifacts, generated artifact contents, customer data, customer
> output, evidence file paths, or custody paths.
>
> **Prerequisite merged blocked-evidence state:** PR #411 is merged into
> `sprint2-architecture-contracts-d4cc2bf` at
> `fa3d3066d548ae0bfe9a8b8395fdc5da0b8e7173`.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_MODULE_RESOLUTION_BROADER_NAMED_FILE_REMEDIATION_COMMAND_PACK_REVIEW_ONLY`

---

## 1. Status and purpose

```yaml
command_pack_status: module_resolution_broader_named_file_remediation_command_pack_review_only
docs_only: true
planning_command_pack_only: true
review_only: true
prerequisite_merged_pr: 411
prerequisite_base_sha: fa3d3066d548ae0bfe9a8b8395fdc5da0b8e7173
safe_surface_label: module_resolution_surface
remediation_status: fail_closed
stop_label: remediation_no_safe_patch_selected
safe_patch_selected: false
selected_patch_family: none
changed_file_count: 0
runtime_cause_inference: false
root_cause_inference: false
gate_d_e_status: blocked_where_dependent
execution_authorized: false
remediation_authorized: false
fix_authorized: false
```

Purpose:

- Define a possible future broader named-file remediation boundary after the config-only path failed
  closed.
- Require exact tracked source/config files to be named before any future source/config inspection or
  patch.
- Define future candidate patch families, validation boundaries, stop conditions, output policy, and
  exact-GO requirements.
- Preserve Gate D/E as blocked where dependent.

This PR is not a remediation PR and not a GO. It adds exactly one docs-only file under `docs/ops/`.

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
  root_cause_inference: false
  gate_d_e_status: blocked_where_dependent

pr_409_module_resolution_design_planning:
  design_planning_completed: true
  recommended_next_path: separate_module_resolution_remediation_command_pack
  direct_code_remediation_recommended: false
  remediation_authorized_by_pr: false

pr_410_module_resolution_remediation_command_pack:
  command_pack_reviewed_and_merged: true
  future_remediation_boundary_defined: true
  remediation_authorized_by_pr: false

pr_411_remediation_blocked_evidence:
  remediation_status: fail_closed
  safe_surface_label: module_resolution_surface
  stop_label: remediation_no_safe_patch_selected
  changed_file_count: 0
  safe_patch_selected: false
  selected_patch_family: none
  runtime_cause_inference: false
  root_cause_inference: false
  gate_d_e_status: blocked_where_dependent
```

Safe aggregate result from PR #411:

```yaml
package_json_top_level_field_count: 11
package_json_has_type_field: true
tsconfig_top_level_field_count: 6
tsconfig_compilerOptions_field_count: 3
tsconfig_has_module_field: false
tsconfig_has_moduleResolution_field: false
tsconfig_has_rootDir_field: true
tsconfig_has_outDir_field: true
tsconfig_has_include_field: true
```

Plain reading: the diagnostic/remediation trail remains at `module_resolution_surface`, but the
config-only path selected no safe patch and changed no files. `module_resolution_surface` remains a
safe surface label only, not a root-cause inference.

---

## 3. Problem statement

The current safe state is:

```yaml
safe_surface_label: module_resolution_surface
remediation_status: fail_closed
stop_label: remediation_no_safe_patch_selected
safe_patch_selected: false
selected_patch_family: none
changed_file_count: 0
runtime_cause_inference: false
root_cause_inference: false
gate_d_e_status: blocked_where_dependent
```

The config-only path failed closed because no safe patch was selected after inspecting only the
previously allowed config/package files and allowing patching only the previously allowed config file.

A broader source-level path may be needed, but it must remain narrow. It can proceed only if exact
tracked source/config files are named by a reviewed command-pack or later exact GO, with strict patch
constraints and fail-closed behavior. The surface label does not prove a specific root cause and does
not authorize remediation by itself.

---

## 4. Future broader named-file objective

If separately authorized in the future, the objective is:

```yaml
future_objective: broader_named_file_module_resolution_remediation
inspection_limited_to_exact_named_tracked_files: true
patch_limited_to_exact_named_tracked_files: true
at_most_one_minimal_patch_if_authorized_later: true
broad_refactor_allowed: false
dependency_or_lockfile_movement_allowed: false
safe_output_only: true
gate_movement: false
```

Future remediation may:

- inspect only exact tracked files named by the reviewed command-pack or later exact GO;
- determine whether a narrow import/export boundary, entrypoint contract, or module-resolution
  source/config patch is safely selectable;
- create at most one minimal patch only if explicitly authorized later;
- avoid broad refactor and dependency/lockfile movement;
- produce safe output only;
- move no Gate.

---

## 5. Future allowed file identification model

```yaml
file_identification_model: model_b_exact_file_names_deferred
model_a_exact_file_names_resolved_in_this_pr: false
model_b_exact_file_names_deferred: true
broader_remediation_allowed_files_not_resolved_stop_label: broader_remediation_allowed_files_not_resolved
```

**Model B is used.** Exact broader source files cannot be safely identified from the current
safe-label/aggregate trail without broader source inspection. Therefore:

- This PR does **not** resolve exact future source inspection files.
- This PR does **not** resolve exact future source patch files.
- A future exact GO must name every exact allowed inspection file before any inspection.
- A future exact GO must name every exact allowed patch file before any patch.
- No future source inspection may run until exact files are named.
- If exact files are not named, the future run must stop with
  `broader_remediation_allowed_files_not_resolved` or `broader_remediation_allowed_files_not_named`.

Previously used config/package filenames may remain candidate config inputs, but under this broader
Model B workflow they are not sufficient by themselves and must still be explicitly named in the future
GO if they are to be inspected again.

---

## 6. Candidate future allowed inspection files

This section defines future-only candidate categories. It authorizes no inspection now.

```yaml
candidate_future_inspection_categories:
  - package_json
  - tsconfig_riskworker_artifact_json
  - exact_riskworker_artifact_entrypoint_source_files_if_named
  - exact_import_export_boundary_files_if_named
  - exact_static_guardrail_registry_or_constant_files_if_directly_relevant_and_named
```

Future inspection rules:

- No broad repository search during future remediation unless explicitly authorized.
- No raw build/parity output.
- No evidence paths or custody paths.
- No generated artifacts.
- No customer-output files.
- No env, secrets, DB, network, production, deploy, schema, migration, or runtime files unless
  separately planned.
- No dependency contents dump.
- No source excerpts committed to docs.
- Exact allowed tracked files must be named before any inspection.

Boundary:

```yaml
inspection_authorized_by_this_pr: false
exact_inspection_files_named_by_this_pr: false
broad_repository_search_authorized_by_this_pr: false
raw_output_inspection_authorized_by_this_pr: false
```

---

## 7. Candidate future allowed patch files

This section defines future-only patch scope. It authorizes no patch now.

```yaml
candidate_future_patch_scope:
  max_changed_files: 2
  exact_patch_files_must_be_named: true
  source_or_config_only_if_named: true
  package_lock_or_lockfile_movement_allowed: false
  dependency_upgrade_allowed: false
  generated_artifacts_allowed: false
  runtime_env_deploy_schema_migration_customer_output_allowed: false
  db_network_sql_production_allowed: false
  gate_d_e_movement_allowed: false
```

Future patch rules:

- At most one or two explicitly named tracked source/config files may change.
- No package-lock or lockfile movement unless separately authorized.
- No dependency upgrades unless separately planned.
- No generated artifacts.
- No runtime, env, deploy, schema, migration, or customer-output changes.
- No DB/network/SQL/production changes.
- No Gate D/E movement.

Boundary:

```yaml
patch_authorized_by_this_pr: false
exact_patch_files_named_by_this_pr: false
source_config_package_change_authorized_by_this_pr: false
dependency_or_lockfile_change_authorized_by_this_pr: false
```

---

## 8. Candidate patch families

The following future patch families are planning-only. This PR chooses none and applies none.

### Path A - Import/export boundary alignment

Future patch may align one import/export reference if allowed named-file inspection supports it.

Rules:

- No broad refactor.
- No root-cause claim.
- No source excerpt committed to docs.
- No runtime/server/customer-output movement.

### Path B - Entrypoint contract alignment

Future patch may align one entrypoint reference/contract if allowed named-file inspection supports it.

Rules:

- Preserve guardrail contracts unless separately reviewed.
- Keep the patch limited to exact named files.
- Do not claim root cause from a contract adjustment alone.

### Path C - Module-resolution config/source alignment

Future patch may align config/source module-resolution shape if allowed named-file inspection supports
it.

Rules:

- No runtime or production environment change.
- No dependency/lockfile movement.
- No generated artifact movement.

### Path D - No-fix / fail-closed

If allowed named-file inspection does not support a narrow patch, record blocked evidence.

```yaml
future_outcome: blocked_evidence_pr
safe_stop_label: broader_remediation_no_safe_patch_selected
gate_d_e_status: blocked_where_dependent
```

---

## 9. Future exact-GO requirements

A future broader remediation/fix requires all of:

```yaml
required_for_future_broader_remediation:
  command_pack_pr_reviewed_and_merged: true
  separate_exact_scoped_go: true
  exact_allowed_inspection_files_named: true
  exact_allowed_patch_files_named: true
  explicit_patch_permission: true
  explicit_build_riskworker_artifact_authorization_status: true
  explicit_proof_riskworker_ci_build_parity_authorization_status: true
  raw_output_inspection_forbidden: true
  safe_output_only: true
```

The future GO must state:

- that this broader named-file command-pack has been reviewed and merged;
- the exact scoped GO phrase for the broader remediation/fix action;
- every exact allowed inspection file;
- every exact allowed patch file;
- whether a patch may be created;
- whether `build:riskworker-artifact` is authorized after patch;
- whether `proof:riskworker-ci-build-parity` is authorized after patch;
- that raw-output inspection remains forbidden;
- that output must remain safe-only.

Absent all required items, no broader remediation/fix may run.

---

## 10. Future validation boundary

Future validation may include only if explicitly authorized:

```yaml
future_validation_layers:
  - git_status_file_list_inspection
  - git_diff_check
  - static_guardrails
  - targeted_non_runtime_static_checker_if_already_present
  - build_riskworker_artifact_if_explicitly_authorized
  - proof_riskworker_ci_build_parity_if_explicitly_authorized
```

Still forbidden unless separately planned:

```yaml
still_forbidden_without_separate_authorization:
  - run_riskworker_compiled
  - worker_runtime
  - classifier
  - record_only
  - db_network_sql
  - server_production_customer_output_scoring_downstream
  - gate_d_e_movement
```

Validation boundary:

- `git status` and file-list inspection may be allowed by a future exact GO.
- `git diff --check` may be allowed by a future exact GO.
- Existing static guardrails may be allowed only if they do not build, run runtime, touch server, touch
  DB/network/SQL, inspect forbidden raw outputs, or produce customer output.
- A targeted non-runtime static checker may be allowed only if already present and explicitly
  authorized.
- `build:riskworker-artifact` may run only if explicitly authorized.
- `proof:riskworker-ci-build-parity` may run only if explicitly authorized.

---

## 11. Future output policy

Future output may contain only:

```yaml
allowed_future_outputs:
  - changed_file_list
  - validation_command_names
  - validation_pass_fail_statuses
  - safe_labels
  - aggregate_counts
  - booleans
  - stop_labels
```

Future output must not contain:

```yaml
raw_build_or_parity_output: false
exact_compiler_errors: false
stack_traces: false
dependency_file_contents: false
source_excerpts_beyond_safe_labels: false
secret_or_dsn_or_host_or_private_path: false
evidence_or_custody_paths: false
generated_artifacts: false
customer_data_or_output: false
```

No raw build/parity output, exact compiler errors, stack traces, dependency-file contents, source
excerpts beyond safe labels, secrets, DSNs, hosts, private paths, evidence/custody paths, generated
artifacts, customer data, or customer output may be printed, pasted, committed, or summarized beyond
safe labels/booleans/counts.

---

## 12. Fail-closed conditions

Future broader remediation must stop if any of the following occurs:

- exact GO is missing, altered, combined, or ambiguous;
- command-pack merge is not present;
- working tree is not clean;
- exact allowed files are not named;
- exact allowed files are not resolved;
- inspection attempts outside allowed files;
- patch attempts outside allowed files;
- more than the allowed number of files would change;
- dependency or lockfile change is needed;
- build/parity is needed but not explicitly authorized;
- raw-output inspection is needed;
- generated artifact or customer-output movement is needed;
- DB/network/SQL/server/production is needed;
- Gate D/E movement would be implied;
- no narrow patch can be safely selected.

Safe stop labels:

```yaml
stop_labels:
  - broader_remediation_exact_go_missing
  - broader_remediation_base_not_pinned
  - broader_remediation_worktree_not_clean
  - broader_remediation_allowed_files_not_named
  - broader_remediation_allowed_files_not_resolved
  - broader_remediation_inspection_scope_exceeded
  - broader_remediation_patch_scope_exceeded
  - broader_remediation_requires_dependency_or_lockfile_change
  - broader_remediation_requires_build_without_authorization
  - broader_remediation_requires_raw_output
  - broader_remediation_no_safe_patch_selected
```

---

## 13. Authorization boundary

```yaml
this_pr_is_not_a_go: true
inspection_beyond_docs_or_file_list_authorized: false
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

This PR authorizes no inspection beyond docs/file-list needed for planning, no remediation, no fix, no
source/config/package change, no build retry, no parity proof, no compiled run, no Step B/C rerun, no
higher-disclosure diagnostic rerun, no raw-output inspection, no customer-output/scoring/downstream
action, and no Gate D/E movement.

---

## 14. Gate status

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
- Even a future successful remediation does not automatically move Gate D/E.
- Gate movement requires separate evidence, planning, review, and exact scoped GO.

---

## 15. Forbidden content and action ledger

```yaml
docs_only: true
planning_command_pack_only: true
review_only: true
file_identification_model: model_b_exact_file_names_deferred
execution_performed: false
remediation_started: false
fix_attempted: false
source_or_config_changed: false
package_or_workflow_changed: false
schema_or_migration_or_env_changed: false
runtime_file_changed: false
generated_artifact_changed: false
customer_output_file_changed: false
build_executed: false
parity_proof_executed: false
compiled_run_executed: false
step_b_rerun: false
step_c_rerun: false
higher_disclosure_diagnostic_rerun: false
remediation_rerun: false
worker_command_executed: false
classifier_command_executed: false
record_only_command_executed: false
retry_performed: false
server_touch: false
db_network_sql_action: false
production_command: false
customer_output_action: false
scoring_downstream_action: false
gate_d_e_movement: false
runtime_cause_inference: false
root_cause_inference: false
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

_End of broader named-file remediation command-pack review document. Docs-only, planning/command-pack
only, review-only. Uses Model B: exact broader source/config file names are deferred and must be named
in a future exact GO before any inspection or patch. Authorizes no remediation, no fix, no build/parity
validation, no raw-output inspection, no customer-output/scoring/downstream action, and no Gate D/E
movement._
