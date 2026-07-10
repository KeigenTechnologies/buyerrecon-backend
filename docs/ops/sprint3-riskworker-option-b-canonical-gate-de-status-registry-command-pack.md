# Sprint 3 — Riskworker Option B — Canonical Gate D/E Status Registry: Planning Command-Pack

## Classification

- docs-only planning command-pack
- planning only; authorizes no execution, no registry creation, no registry
  designation, and no Gate D/E movement

## Source State

- base_branch: sprint2-architecture-contracts-d4cc2bf
- required_base_tip: 791927880f1140caab02744a7c5a709a3d677db0
- base_contains_pr425_head: true (c031553f16a1e25bccea541ec0accb61c0fc90e6)
- working_tree_clean: true

## Purpose

Define a future, separately-authorized scoped step that establishes exactly one
canonical mutable Gate D/E status registry (status-of-record) for the riskworker
Option B path. This command-pack is planning only: it does not create the
registry, does not designate the registry, and does not move Gate D/E.

## Problem Recap (safe labels)

- prior_movement_attempt: scoped_gate_d_e_status_movement
- prior_movement_status: blocked
- prior_failure_mode: fail_closed
- prior_failed_at_preflight_checks: 9_10_11
- blocker: canonical_gate_d_e_status_location_not_found_or_ambiguous
- canonical_status_location_found: false
- canonical_status_location_ambiguous: true
- candidate_status_document_count: 34
- candidate_status_documents_are_point_in_time: true
- candidate_status_documents_are_mutable_status_of_record: false
- gate_d_e_status: blocked_where_dependent
- gate_d_e_moved: false

## Scope Boundaries (must hold for the future step)

- docs-only / governance-state only.
- Exactly one canonical Gate D/E status registry may be created or designated.
- No package.json, source, scripts, tsconfig, workflow, lockfile, or dependency
  changes.
- No reassessment rerun, parity rerun, build, runtime, worker, DB access,
  secrets access, remediation, downstream execution, or customer output.
- No Gate D/E evaluation and no Gate D/E movement.

## Future Scoped Step — Required Procedure

The future registry step, when separately authorized by an exact scoped GO,
must:

1. Fetch/prune origin and confirm the reviewed base tip and clean working tree.
2. Enumerate all candidate Gate D/E status locations for the riskworker Option B
   path using safe labels only.
3. Classify each candidate as either:
   - `point_in_time_evidence` (immutable historical artifact), or
   - `mutable_status_of_record` (canonical registry candidate).
4. Select exactly one canonical mutable status-of-record location.
   - If more than one candidate canonical registry exists → fail closed.
   - If no safe registry location can be selected → fail closed.
   - If a canonical registry already exists → designate it (do not recreate).
   - If none exists → create exactly one canonical registry at the selected
     safe location.
5. Preserve every historical evidence/command-pack/planning doc unchanged. The
   34 point-in-time documents remain immutable and are not rewritten.
6. Initialize the canonical registry status to `blocked_where_dependent`.
7. Record safe labels only; print no forbidden content.
8. Do not move Gate D/E. Do not mark Gate D/E passed. Do not authorize
   downstream execution or customer output.

## Fail-Closed Conditions (future step)

- more_than_one_candidate_canonical_registry → blocked
- no_safe_registry_location_selectable → blocked
- ambiguous_status_of_record → blocked
- would_require_source_scripts_config_package_lockfile_workflow_dependency_change → blocked
- would_require_reassessment_parity_build_runtime_worker_db_secrets → blocked
- would_require_gate_d_e_evaluation_or_movement → blocked

## Canonical Registry Schema (safe labels only)

The future canonical registry, once established, records status-of-record using
safe labels, booleans, counts, and commit references only. Proposed fields:

- registry_path: <canonical path>
- registry_kind: mutable_status_of_record
- riskworker_option_b_path: true
- current_gate_d_e_status: blocked_where_dependent
- gate_d_status: blocked_where_dependent
- gate_e_status: blocked_where_dependent
- gate_d_e_marked_passed: false
- reclassification_enacted: false
- last_movement_go_ref: none
- last_movement_commit_ref: none
- evidence_chain_refs: <commit references only>
- movement_requires_separate_exact_scoped_go: true

Initial status must remain `blocked_where_dependent` unless a later separate
exact scoped GO authorizes movement.

## Future Safe Output Model

The future registry step must emit safe labels only, including:

- registry_plan_status=<planned|blocked|completed>
- canonical_registry_action=<create|designate|blocked>
- candidate_status_document_count=34
- candidate_status_documents_are_point_in_time=true
- canonical_registry_location=<path or none>
- canonical_registry_created=<true|false>
- canonical_registry_designated=<true|false>
- initial_gate_d_e_status=blocked_where_dependent
- gate_d_e_moved=false
- gate_d_e_marked_passed=false
- downstream_execution=false
- customer_output_generated=false
- blockers=<none or safe labels>

## This PR — Execution Boundary

- canonical_registry_created: false
- canonical_registry_designated: false
- gate_d_e_evaluated: false
- gate_d_e_moved: false
- gate_d_e_marked_passed: false
- reassessment_rerun: false
- parity_rerun: false
- build_run: false
- runtime_run: false
- worker_run: false
- db_access: false
- secrets_access: false
- customer_output_generated: false
- remediation_attempted: false
- downstream_execution: false
- existing_docs_modified: false
- changed_file_count: 1

## Output Safety

- forbidden_output_printed: false
- raw_parity_output_printed: false
- source_excerpts_printed: false
- script_values_printed: false
- config_values_printed: false
- secrets_recorded: false
- DSNs_recorded: false
- credentials_recorded: false
- hosts_recorded: false
- customer_data_recorded: false
- runtime_payloads_recorded: false
- private_paths_recorded: false
- custody_paths_recorded: false
- evidence_temp_paths_recorded: false
- base64_blobs_recorded: false

## Authorization Boundary

This planning command-pack **does not authorize** any of the following:
canonical status registry creation, canonical status registry designation, Gate
D/E status movement, Gate D/E evaluation, downstream execution, customer output,
runtime, worker execution, DB access, secrets access, remediation, build, parity
rerun, or reassessment rerun.

Gate D/E remain `blocked_where_dependent`. Establishing the canonical registry,
and any future Gate D/E movement thereafter, each require a **separate exact
scoped GO**.
