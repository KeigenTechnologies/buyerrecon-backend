# Sprint 3 — Riskworker Option B — Package / Config / Build-Parity Diagnostic: Planning Command-Pack

## Classification

- **Type:** Command pack (planning only).
- **Authorizes execution:** No.
- **Authorizes source/config/package patch:** No.
- **Authorizes build or parity proof:** No.
- **Model:** Model B — exact package/config/build-parity inspection and patch
  file names are **deferred** and must be named in a future exact scoped GO
  before any inspection or patch.

### This PR states, clearly:

1. This PR is **docs-only**.
2. This PR is **planning-only**.
3. This PR authorizes **no current execution**.
4. This PR authorizes **no current source patch**.
5. This PR authorizes **no current build or parity proof**.
6. Any future package/config/build-parity diagnostic requires a **separate exact
   scoped GO**.
7. **Gate D/E remain blocked.**

## Source state (context, not an authorization)

- PR #412: broader named-file remediation attempt failed closed.
- PR #413: blocked-evidence merged.
- PR #414: wider-scope command-pack merged.
- PR #415: wider named-file remediation blocked-evidence merged.
- `stop_label_carried_forward=wider_remediation_no_safe_patch_selected`
- `selected_patch_family=none`
- `safe_patch_selected=false`
- `gate_d_e_status=blocked_where_dependent`
- `gate_d_or_e_moved=false`

## Interpretation

The named-file relative-import `.js`-suffix patch family is **exhausted**: two
named-file remediation attempts (narrow and wider) both stopped fail-closed with
`selected_patch_family=none`. The next **planning** surface is
package/config/build-parity **diagnostic planning only**. This document plans
that surface. It inspects and prints **no** source or config contents now.

## Future diagnostic surface

The future diagnostic may concern package/config/build-parity surfaces,
addressed only through **safe aggregate questions**, such as:

- package script contract presence/shape
- tsconfig artifact contract presence/shape
- outDir/include/top-level field aggregate counts
- build-parity checker contract aggregate structure
- artifact entrypoint expectation counts
- module-resolution contract classification
- package/config mismatch classification
- emitted artifact path mismatch classification
- dependency/package movement requirement classification

This document must **not** inspect or print source/config contents now. All of
the above are deferred to a future exact scoped GO and, even then, are answered
with safe aggregate metadata only — never raw content.

## Future exact GO requirements

A future exact scoped GO must explicitly state:

- `exact_allowed_inspection_files`
- `exact_allowed_patch_files`, if any
- whether source/config/package patching is authorized
- whether build is authorized
- whether parity proof is authorized
- whether static-only classification is required
- whether any generated artifact inspection is authorized
- safe-output-only constraints
- raw-output inspection forbidden
- stop labels
- Gate D/E movement authorization status (default `false`)

### Default future authorization values

Unless a future exact scoped GO explicitly sets otherwise:

- `build_authorized=false` unless explicitly `true` in future GO
- `parity_proof_authorized=false` unless explicitly `true` in future GO
- `runtime_authorized=false`
- `worker_rerun_authorized=false`
- `classifier_rerun_authorized=false`
- `record_only_rerun_authorized=false`
- `DB_network_SQL_authorized=false`
- `server_action_authorized=false`
- `Gate_D_E_movement_authorized=false`

## Safe-output model

A future diagnostic must record **safe metadata only**, such as:

- `diagnostic_status`
- `inspected_file_count`
- `inspected_files`
- `changed_file_count`
- `changed_files`
- `selected_diagnostic_surface`
- `package_contract_signal`
- `tsconfig_contract_signal`
- `parity_contract_signal`
- `artifact_path_mismatch_signal`
- `module_resolution_surface_signal`
- `dependency_or_package_movement_required`
- `build_invoked`
- `parity_invoked`
- `runtime_invoked`
- `worker_rerun`
- `classifier_rerun`
- `record_only_rerun`
- `DB_network_SQL_invoked`
- `server_action_invoked`
- `forbidden_output_printed`
- `source_excerpts_printed`
- `dependency_contents_printed`
- `exact_errors_printed`
- `gate_d_e_status`
- `gate_d_or_e_moved`
- `stop_label`
- `next_step_label`

No raw build/parity/runtime output, exact errors, stack traces, source
excerpts, dependency contents, secrets, DSNs, credentials, hosts, customer
data, private paths, custody paths, evidence paths, or base64 blobs may ever be
inspected, printed, or recorded.

## Fail-closed stop labels

A future diagnostic must stop and record fail-closed under any of:

- `package_config_build_parity_scope_not_named`
- `package_config_build_parity_requires_unnamed_file`
- `package_config_build_parity_patch_requires_unnamed_file`
- `package_config_build_parity_build_required_but_not_authorized`
- `package_config_build_parity_parity_required_but_not_authorized`
- `package_config_build_parity_raw_output_required`
- `package_config_build_parity_forbidden_output_required`
- `package_config_build_parity_dependency_or_package_movement_required`
- `package_config_build_parity_no_safe_diagnostic_selected`
- `package_config_build_parity_no_safe_patch_selected`
- `package_config_build_parity_gate_d_e_blocked_where_dependent`

On any stop label: change zero files, infer no root cause, keep
`module_resolution_surface` a surface label only, and leave Gate D/E
`blocked_where_dependent`.

## Authorization boundary

This command pack does **not** authorize:

- build
- parity proof
- runtime execution
- worker rerun
- classifier rerun
- record-only rerun
- source patching
- package/config patching
- dependency changes
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
- `next_step_label=await_governance_review_for_package_config_build_parity_diagnostic_command_pack`
