# Sprint 3 Risk-Worker Option B Module Resolution Remediation Command-Pack

> **Docs-only remediation/fix command-pack review document.** This PR defines, for review only, a
> possible future narrow remediation workflow for the safe surface label `module_resolution_surface`.
> It is **command-pack-only** and **review-only**. It authorizes no execution, no remediation, no fix,
> no source/config/package/workflow/schema/migration/env/runtime change, no build, no parity proof, no
> compiled run, no Step B rerun, no Step C rerun, no higher-disclosure diagnostic rerun, no
> worker/classifier/record-only command, no retry, no server touch, no DB/network/SQL action, no
> production command, no customer-output action, no scoring/downstream action, no Gate D/E movement,
> and no root-cause inference.
>
> **No raw output or forbidden content is included.** This document records only safe labels,
> booleans, aggregate-safe state, and future command-pack boundaries. It contains no raw build
> stdout/stderr, no raw parity stdout/stderr, no exact compiler errors, no stack traces, no
> dependency-file contents, no source excerpts beyond safe labels, no secrets, DSNs, hosts, private
> paths, base64 blobs, generated artifacts, generated artifact contents, customer data, customer
> output, exact evidence file paths, or custody paths.
>
> **Prerequisite merged design-planning state:** PR #409 is merged into
> `sprint2-architecture-contracts-d4cc2bf` at
> `88a84a7ad007f0a933ac8182172d3a77b2c8eba2`.

---

## STATUS: `SPRINT3_RISKWORKER_OPTION_B_MODULE_RESOLUTION_REMEDIATION_COMMAND_PACK_REVIEW_ONLY`

---

## 1. Status and purpose

```yaml
command_pack_status: module_resolution_remediation_command_pack_review_only
docs_only: true
review_only: true
command_pack_only: true
prerequisite_merged_pr: 409
prerequisite_base_sha: 88a84a7ad007f0a933ac8182172d3a77b2c8eba2
safe_surface_label: module_resolution_surface
disambiguation_reduced_to_single_surface: true
runtime_cause_inference: false
gate_d_e_status: blocked_where_dependent
execution_authorized: false
remediation_authorized: false
fix_authorized: false
```

Purpose:

- Define the possible future remediation/fix workflow for `module_resolution_surface`.
- Define future inspection scope, patch constraints, validation boundaries, stop conditions, output
  policy, and exact-GO requirements.
- Keep this PR as a review-only command-pack, not a remediation PR.
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

pr_409_module_resolution_design_planning:
  design_planning_completed: true
  recommended_next_path: separate_module_resolution_remediation_command_pack
  direct_code_remediation_recommended: false
  remediation_authorized_by_pr: false
```

Plain reading: the diagnostic trail has reduced the ambiguous build-failure surface to
`module_resolution_surface`, but this remains a safe surface classification only. It is not a
root-cause inference and does not authorize remediation or validation.

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

- The build-failure surface has been reduced to `module_resolution_surface`.
- This is a surface classification only.
- The specific root cause is not proven.
- The future remediation must therefore be narrow, reversible, and validated without expanding scope.

This command-pack defines a future workflow only. It does not inspect files, create a patch, run
validation, or move gates.

---

## 4. Future remediation objective

If separately authorized in the future, the objective is:

```yaml
future_objective: narrow_module_resolution_remediation
smallest_repository_visible_change: true
limited_to_riskworker_artifact_module_resolution_surface: true
customer_output_produced: false
gate_movement: false
runtime_server_db_network_sql_change: false
root_cause_claim_beyond_patch_rationale: false
```

Future remediation may make the smallest repository-visible change needed to resolve a
module-resolution surface, if and only if supported by allowed source/config inspection under a
separate exact scoped GO.

The future remediation must:

- stay limited to riskworker artifact/module-resolution surfaces;
- produce no customer output;
- move no Gate;
- make no runtime/server/DB/network/SQL changes;
- make no root-cause claim beyond a conservative accepted patch rationale.

---

## 5. Future allowed inspection scope

This section defines future-only scope. It is **not authorized by this PR**.

A future remediation/fix GO may allow inspection of only explicitly named tracked files. Candidate
file categories include:

```yaml
candidate_tracked_file_allowlist_categories:
  - package_json
  - tsconfig_riskworker_artifact_json
  - explicitly_named_riskworker_artifact_entrypoint_source_files
  - explicitly_named_riskworker_artifact_import_export_boundary_files
  - explicitly_named_static_guardrail_registry_or_constants_files_if_directly_relevant
```

Future inspection rules:

- Exact allowed files must be named in the future exact GO before inspection.
- No broad repository search is allowed unless separately and explicitly authorized.
- No raw build/parity output may be inspected.
- No evidence paths or custody paths may be inspected or recorded.
- No generated artifacts may be inspected or committed.
- No customer-output files may be inspected.
- No env, secrets, DB, network, production, deploy, schema, migration, or runtime operation files may
  be inspected unless a later command-pack separately authorizes them.

Boundary:

```yaml
inspection_authorized_by_this_pr: false
exact_allowed_files_named_by_this_pr: false
broad_repository_search_authorized_by_this_pr: false
raw_output_inspection_authorized_by_this_pr: false
```

---

## 6. Future allowed patch scope

This section defines future-only patch scope. It is **not authorized by this PR**.

A future remediation PR may change at most the minimum explicitly allowlisted tracked files needed for
module-resolution remediation, for example:

```yaml
candidate_patch_families:
  - one_tracked_typescript_source_file_for_import_export_boundary_alignment
  - one_typescript_config_or_package_module_resolution_setting
  - one_entrypoint_contract_reference_if_supported_by_allowed_evidence
```

Future patch rules:

- No unrelated refactor.
- No dependency upgrade unless a separate dependency-specific command-pack is reviewed.
- No package-lock or package-manager lockfile changes unless explicitly authorized.
- No generated artifacts committed.
- No runtime, env, deploy, schema, migration, or customer-output changes.
- No DB/network/SQL/production changes.
- No Gate D/E movement.

Boundary:

```yaml
patch_authorized_by_this_pr: false
source_config_package_change_authorized_by_this_pr: false
dependency_or_lockfile_change_authorized_by_this_pr: false
generated_artifact_change_authorized_by_this_pr: false
runtime_or_production_change_authorized_by_this_pr: false
```

---

## 7. Candidate remediation branches

The following future patch families are defined for planning only. This PR chooses none.

### Path A - Import/export boundary alignment

Align an import/export reference or artifact entrypoint reference when allowed tracked-source
inspection supports it.

Rules:

- Avoid broad refactors.
- Keep the patch narrow and reversible.
- Do not claim root cause unless later validation and allowed evidence support that claim.
- Do not touch runtime/server/customer-output surfaces.

### Path B - TypeScript module-resolution config alignment

Adjust module-resolution-related configuration shape only if allowed inspection supports it.

Candidate shape families:

```yaml
candidate_config_shape_families:
  - module_resolution_shape
  - module_shape
  - paths_shape
  - root_dir_shape
  - out_dir_shape
  - include_shape
```

Rules:

- Avoid changing runtime behavior beyond the artifact build surface.
- Do not change production env.
- Do not create dependency or lockfile movement unless separately planned.

### Path C - Entry-point contract alignment

Align compiled entrypoint contract naming or reference shape if allowed inspection supports it.

Rules:

- Preserve existing guardrail contracts unless separately reviewed.
- Keep the patch limited to the reviewed contract shape.
- Do not infer root cause from contract alignment alone.

### Path D - No-fix / fail-closed

If safe allowed inspection does not support a narrow patch, do not fix.

Future output:

```yaml
future_outcome: blocked_evidence_pr
safe_stop_label: remediation_no_safe_patch_selected
gate_d_e_status: blocked_where_dependent
```

---

## 8. Future validation plan

This section defines future validation layers only. They are **not authorized by this PR**.

For a future remediation PR, validation may be layered:

```yaml
future_validation_layers:
  - git_status_file_list_inspection
  - git_diff_check
  - static_guardrails
  - targeted_non_runtime_module_resolution_static_checker_if_already_present
  - build_riskworker_artifact_if_separately_authorized_after_patch_scope_review
  - proof_riskworker_ci_build_parity_if_separately_authorized_after_patch_scope_review
```

Still forbidden unless separately planned and authorized:

```yaml
still_forbidden_without_separate_authorization:
  - run_riskworker_compiled
  - runtime_worker_command
  - classifier_command
  - record_only_command
  - db_network_sql
  - server_production_customer_output_scoring_downstream
  - gate_d_e_movement
```

Validation boundary:

- Static file-list inspection may be allowed by a future exact GO.
- `git diff --check` may be allowed by a future exact GO.
- Existing static guardrails may be allowed if they do not build, run runtime, touch server, touch
  DB/network/SQL, inspect forbidden raw outputs, or produce customer output.
- A targeted non-runtime module-resolution/static checker may be allowed only if already present and
  explicitly authorized.
- `build:riskworker-artifact` may run only if separately authorized after patch scope review.
- `proof:riskworker-ci-build-parity` may run only if separately authorized after patch scope review.

---

## 9. Future output policy

A future remediation/fix run may output only:

```yaml
allowed_future_outputs:
  - changed_file_list
  - validation_command_names
  - validation_pass_fail_statuses
  - safe_surface_labels
  - aggregate_counts
  - forbidden_action_booleans
```

Forbidden future outputs:

```yaml
raw_build_or_parity_output: false
exact_compiler_errors: false
stack_traces: false
dependency_contents: false
secret_or_dsn_or_host_or_private_path: false
generated_artifacts: false
customer_data_or_output: false
evidence_or_custody_paths: false
```

No raw build/parity output, exact compiler errors, stack traces, dependency contents, secrets, DSNs,
hosts, private paths, generated artifacts, customer data, or customer output may be printed, pasted,
committed, or summarized beyond safe labels/booleans/counts.

---

## 10. Fail-closed conditions

Future remediation/fix must stop if any of the following occurs:

- exact GO is absent, altered, combined, or ambiguous;
- current base does not include the reviewed command-pack merge;
- working tree is not clean before start;
- allowed files are not explicitly named;
- inspection points outside allowlisted tracked files;
- remediation would require raw-output disclosure;
- remediation would require dependency upgrade, lockfile change, generated artifact, env/runtime/
  deploy/schema/migration change, DB/network/SQL, server/production touch, customer-output/scoring/
  downstream action, or Gate D/E movement;
- validation requires a build/parity proof not explicitly authorized;
- no narrow patch can be selected safely.

Safe stop labels:

```yaml
stop_labels:
  - remediation_exact_go_missing
  - remediation_base_not_pinned
  - remediation_worktree_not_clean
  - remediation_allowed_files_not_named
  - remediation_scope_exceeded
  - remediation_requires_forbidden_raw_output
  - remediation_requires_dependency_or_lockfile_change
  - remediation_requires_runtime_or_production_touch
  - remediation_requires_build_without_authorization
  - remediation_no_safe_patch_selected
```

---

## 11. Future exact-GO boundary

A future remediation/fix may run only if all required items are present:

```yaml
required_for_future_remediation:
  command_pack_pr_reviewed_and_merged: true
  separate_exact_scoped_go: true
  exact_allowed_files_named_in_go: true
  explicit_patch_permission: true
  explicit_build_riskworker_artifact_authorization_status: true
  explicit_proof_riskworker_ci_build_parity_authorization_status: true
  safe_output_only: true
```

The future GO must state:

- that this command-pack PR has been reviewed and merged;
- the exact scoped GO phrase for the remediation/fix action;
- the exact allowed tracked files;
- whether a patch may be created;
- whether `build:riskworker-artifact` is authorized after patch;
- whether `proof:riskworker-ci-build-parity` is authorized after patch;
- that output must remain safe-only.

Absent all required items, no remediation/fix may run.

No GO to remediate authorizes compiled run, worker runtime, classifier, record-only, DB/network/SQL,
server, production, customer-output, scoring, downstream, or Gate D/E movement unless separately
planned and approved.

---

## 12. Authorization boundary

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

This PR authorizes no remediation, no fix, no source/config/package change, no build retry, no parity
proof, no compiled run, no Step B/C rerun, no higher-disclosure diagnostic rerun, no raw-output
inspection, no customer-output/scoring/downstream action, and no Gate D/E movement.

---

## 13. Gate status

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
- Any Gate D/E movement requires separate evidence, planning, review, and exact scoped GO.

---

## 14. Forbidden content and action ledger

```yaml
docs_only: true
command_pack_only: true
review_only: true
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

_End of remediation/fix command-pack review document. Docs-only, command-pack-only, review-only.
Defines a future narrow module-resolution remediation/fix workflow but authorizes no remediation, no
fix, no build/parity validation, no raw-output inspection, no customer-output/scoring/downstream
action, and no Gate D/E movement. Future remediation requires this command-pack reviewed and merged,
a separate exact scoped GO, exact allowed files named, explicit patch permission, explicit build/parity
authorization status if applicable, and safe output only._
