# Sprint 3 — Riskworker Option B — Package Script Contract Remediation: Planning Command-Pack

## Classification

- **Type:** Command pack (planning only).
- **Model:** Model B — exact inspection/patch file names and the intended script
  mapping are **deferred** to a future exact scoped GO.

### This PR states, clearly:

1. This PR is **docs-only**.
2. This PR is **planning-only**.
3. This PR authorizes **no current execution**.
4. This PR authorizes **no current package.json patch**.
5. This PR authorizes **no current build**.
6. This PR authorizes **no current parity proof**.
7. This PR authorizes **no generated artifact inspection**.
8. This PR authorizes **no runtime/worker/classifier/record-only rerun**.
9. This PR authorizes **no DB/network/SQL/server/production action**.
10. This PR **does not move Gate D/E**.
11. Any future package script contract remediation requires a **separate exact
    scoped GO**.

## Source state (context, not an authorization)

- PR #415 merged: wider named-file remediation failed closed.
- PR #416 merged: package/config/build-parity diagnostic command pack.
- PR #417 merged: package/config/build-parity static diagnostic evidence.
- PR #418 merged: build/parity/generated-artifact command-absent fail-closed
  evidence, recording:
  - `diagnostic_status=fail_closed`
  - `build_command_present=true`
  - `parity_command_present=false`
  - `build_invoked=false`, `parity_invoked=false`,
    `generated_artifact_inspection_invoked=false`
  - `stop_label=build_parity_generated_artifact_command_absent`
- Interpretation carried forward: this is a **package script contract exposure
  gap** — not a build failure, not a parity failure, not a generated-artifact
  failure, not a runtime failure.
- `gate_d_e_status=blocked_where_dependent`
- `gate_d_or_e_moved=false`

## Future remediation surface

The future remediation may be **limited to package script contract exposure**,
specifically deciding whether to add or align the missing exact package script
key:

- `check:riskworker-build-parity`

The future remediation **must not assume the command value**. It must require a
future exact scoped GO to either specify the safe intended script mapping, or
authorize key-only inspection sufficient to derive it **without printing script
values**.

The future remediation must distinguish these states:

- package script key absent
- package script key present but value mismatch
- package script value unknown because value inspection is not authorized
- parity checker file absent
- parity checker file present but not exposed by package script
- build script present but paired parity script absent
- build/parity diagnostic blocked by package script contract exposure gap

## Future exact GO requirements

A future exact scoped GO must explicitly state:

- `exact_allowed_inspection_files`
- `exact_allowed_patch_files`
- whether package.json patching is authorized
- whether script key inspection is authorized
- whether script value inspection is authorized
- whether adding the missing script key is authorized
- whether modifying existing script values is authorized
- whether build is authorized after patch
- whether parity proof is authorized after patch
- whether generated artifact inspection is authorized after patch
- whether runtime/worker/classifier/record-only rerun is authorized
- whether dependency changes are authorized
- whether lockfile changes are authorized
- safe-output-only constraints
- raw-output inspection forbidden
- stop labels
- Gate D/E movement authorization status (default `false`)

### Default future authorization values

Unless a future exact scoped GO explicitly sets otherwise:

- `package_json_patch_authorized=false` unless explicitly `true` in future GO
- `script_value_inspection_authorized=false` unless explicitly `true` in future GO
- `build_authorized=false` unless explicitly `true` in future GO
- `parity_proof_authorized=false` unless explicitly `true` in future GO
- `generated_artifact_inspection_authorized=false` unless explicitly `true` in future GO
- `runtime_authorized=false`
- `worker_rerun_authorized=false`
- `classifier_rerun_authorized=false`
- `record_only_rerun_authorized=false`
- `dependency_change_authorized=false`
- `lockfile_change_authorized=false`
- `DB_network_SQL_authorized=false`
- `server_action_authorized=false`
- `production_action_authorized=false`
- `customer_output_movement_authorized=false`
- `Gate_D_E_movement_authorized=false`

## Allowed future patch family

The document defines this candidate patch family only:

- `package_script_contract_exposure_patch`

This candidate patch family may be considered safe **only if all** are true:

1. The future exact GO explicitly authorizes package.json patching.
2. The future exact GO explicitly names package.json as an allowed patch file.
3. The future exact GO explicitly names any allowed inspection files.
4. The patch is limited to adding or aligning the exact missing package script
   key: `check:riskworker-build-parity`.
5. The patch does not change dependencies.
6. The patch does not change lockfiles.
7. The patch does not change source code.
8. The patch does not change tsconfig files.
9. The patch does not change workflows.
10. The patch does not run build/parity unless separately authorized after patch.
11. The patch does not move Gate D/E.

If any of those are not satisfied, the future attempt **must fail closed**.

## Safe-output model

A future remediation must record **safe metadata only**, such as:

- `remediation_status`
- `inspected_file_count`
- `inspected_files`
- `changed_file_count`
- `changed_files`
- `selected_patch_family`
- `package_json_patch_authorized`
- `script_key_inspection_authorized`
- `script_value_inspection_authorized`
- `build_command_key_present`
- `parity_command_key_present_before`
- `parity_command_key_present_after`
- `package_script_contract_gap_signal`
- `package_script_contract_patch_selected`
- `package_script_contract_patch_applied`
- `dependency_change_required`
- `lockfile_change_required`
- `build_invoked`
- `parity_invoked`
- `generated_artifact_inspection_invoked`
- `runtime_invoked`
- `worker_rerun`
- `classifier_rerun`
- `record_only_rerun`
- `DB_network_SQL_invoked`
- `server_action_invoked`
- `forbidden_output_printed`
- `raw_build_output_printed`
- `raw_parity_output_printed`
- `source_excerpts_printed`
- `script_values_printed`
- `config_values_printed`
- `dependency_contents_printed`
- `exact_errors_printed`
- `generated_artifact_paths_printed`
- `gate_d_e_status`
- `gate_d_or_e_moved`
- `stop_label`
- `next_step_label`

## Forbidden future outputs

A future remediation must **not** print or record:

- script values unless a future GO explicitly authorizes safe value inspection
- raw build output
- raw parity output
- raw runtime output
- exact errors
- stack traces
- source excerpts
- config values
- dependency contents
- generated artifact contents
- generated artifact paths
- secrets
- DSNs
- credentials
- hosts
- customer data
- private paths
- custody paths
- evidence paths
- base64 blobs

## Fail-closed stop labels

A future remediation must stop and record fail-closed under any of:

- `package_script_contract_scope_not_named`
- `package_script_contract_requires_unnamed_file`
- `package_script_contract_patch_requires_unnamed_file`
- `package_script_contract_package_json_patch_not_authorized`
- `package_script_contract_script_value_inspection_not_authorized`
- `package_script_contract_missing_mapping_not_safely_derivable`
- `package_script_contract_dependency_change_required`
- `package_script_contract_lockfile_change_required`
- `package_script_contract_build_required_but_not_authorized`
- `package_script_contract_parity_required_but_not_authorized`
- `package_script_contract_generated_artifact_inspection_required_but_not_authorized`
- `package_script_contract_raw_output_required`
- `package_script_contract_forbidden_output_required`
- `package_script_contract_no_safe_patch_selected`
- `package_script_contract_gate_d_e_blocked_where_dependent`

On any stop label: change zero files, infer no root cause, keep
`module_resolution_surface` a surface label only, and leave Gate D/E
`blocked_where_dependent`.

## Authorization boundary

This command pack does **not** authorize:

- package.json patching
- script value inspection
- build
- parity proof
- generated artifact inspection
- runtime execution
- worker rerun
- classifier rerun
- record-only rerun
- source patching
- package/config patching
- dependency changes
- lockfile changes
- DB/network/SQL
- server action
- production action
- customer-output movement
- Gate D/E movement

Any such action requires **separate planning/review and a separate exact scoped
GO**.

## Gate status

- `gate_d_e_status=blocked_where_dependent`
- `gate_d_or_e_moved=false`
- This document records planning only. `module_resolution_surface` remains a
  safe surface label, not a root-cause inference.
- `next_step_label=await_governance_review_for_package_script_contract_remediation_command_pack`
