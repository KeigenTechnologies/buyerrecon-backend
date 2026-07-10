# Sprint 3 — Riskworker Option B — Gate D/E Dependency Reassessment: Planning Command-Pack

## Classification

- **Type:** Command pack (planning only).
- **Reassesses Gate D/E now:** No.
- **Moves Gate D/E:** No.
- **Model:** Model B — the future reassessment is read-only and emits safe
  labels/booleans/counts only; it does not itself change any gate status.

### This PR states, clearly:

1. This PR is **docs-only**.
2. This PR is **planning-only**.
3. This PR **does not reassess Gate D/E now**.
4. This PR **does not move Gate D/E**.
5. Gate D/E movement is **out of scope** for both this PR and the future
   reassessment step it plans.
6. Any future reassessment requires this command-pack, and any subsequent Gate
   D/E movement requires a **separate exact scoped GO**.

## Source state (context, not an authorization)

- PR #420 merged: package-script exposure patch.
  - PR #420 merge commit: `db8fda21ff5a5df9daf4b72dd548ecc788b35eea`
- PR #421 merged: docs-only package-script build-parity proof evidence.
  - PR #421 head SHA: `7ff92904dd06800a92d1f9faabc5c377fd0402f7`
  - PR #421 merge commit prefix: `36ecc8ca17a`
- Recorded proof evidence (safe labels only):
  - `npm run check:riskworker-build-parity` invoked exactly once after PR #420
  - `exit_code=0`
  - stdout/stderr captured privately and not printed
  - no retry, no remediation, no files modified
  - no separate build, no runtime, no worker
  - no DB access, no secrets access, no customer output
  - no Gate D/E movement
- `prior_gate_d_e_status=blocked_where_dependent`
- `gate_d_or_e_moved=false`

## Future reassessment surface

The future scoped reassessment step must be **read-only** and limited to
determining whether the prior `blocked_where_dependent` status can be
reclassified, based only on already-merged evidence. It must:

- Perform read-only repo/status inspection only.
- Use merged PR #420 and PR #421 evidence as prerequisites.
- Verify the package-script parity-proof evidence document exists on base.
- Verify the authorized package script key/value still exists on base:
  - key: `check:riskworker-build-parity`
  - value: `node scripts/checks/check-riskworker-build-parity.mjs`
- Determine whether the previous `blocked_where_dependent` status can be
  reclassified.
- Emit only safe labels/booleans/counts.

The future reassessment step must **not**:

- inspect raw parity stdout/stderr,
- run parity again unless separately authorized,
- run build,
- run runtime,
- run worker,
- access DB,
- access secrets,
- generate customer output,
- move Gate D/E,
- perform remediation.

Gate D/E movement remains **out of scope**. The reassessment may only **plan** a
future recommendation and define fail-closed conditions; it does not enact any
status change.

## Required safe output model for the future reassessment

The future reassessment step must return only:

- `reassessment_status=<planned|blocked|completed>`
- `base_contains_pr420=<true|false>`
- `base_contains_pr421=<true|false>`
- `package_script_key_present=<true|false>`
- `package_script_value_exact_match=<true|false>`
- `parity_proof_evidence_present=<true|false>`
- `parity_proof_exit_code_recorded_zero=<true|false>`
- `raw_parity_output_inspected=false`
- `parity_rerun=false`
- `build_run=false`
- `runtime_run=false`
- `worker_run=false`
- `db_access=false`
- `secrets_access=false`
- `customer_output_generated=false`
- `gate_d_e_moved=false`
- `prior_gate_d_e_status=blocked_where_dependent`
- `recommended_next_status=<safe label only>`
- `blockers=<none or safe labels>`

`recommended_next_status` is a **safe label only** — a planning recommendation,
not an enacted status change. Enacting any Gate D/E status change requires a
separate exact scoped GO.

## Fail-closed conditions

The future reassessment must stop and record fail-closed (and recommend no
reclassification) under any of:

- `gate_dependency_reassessment_base_missing_pr420`
- `gate_dependency_reassessment_base_missing_pr421`
- `gate_dependency_reassessment_package_script_key_absent`
- `gate_dependency_reassessment_package_script_value_mismatch`
- `gate_dependency_reassessment_parity_proof_evidence_absent`
- `gate_dependency_reassessment_parity_proof_exit_not_zero_recorded`
- `gate_dependency_reassessment_raw_output_required`
- `gate_dependency_reassessment_forbidden_output_required`
- `gate_dependency_reassessment_requires_parity_rerun_not_authorized`
- `gate_dependency_reassessment_requires_build_not_authorized`
- `gate_dependency_reassessment_requires_runtime_not_authorized`
- `gate_dependency_reassessment_gate_movement_out_of_scope`
- `gate_dependency_reassessment_no_safe_reclassification_derivable`

On any fail-closed condition: change zero files, move no gate, keep
`prior_gate_d_e_status=blocked_where_dependent`, and emit safe labels only.

## Authorization boundary

This command pack does **not** authorize:

- Gate D/E reassessment execution now
- Gate D/E movement
- parity rerun
- build
- runtime execution
- worker rerun
- classifier rerun
- record-only rerun
- source/package/config patching
- dependency or lockfile changes
- DB/network/SQL
- server action
- production action
- customer-output movement
- raw parity stdout/stderr inspection

Any such action requires **separate planning/review and a separate exact scoped
GO**.

## Gate status

- `gate_d_e_status=blocked_where_dependent`
- `gate_d_or_e_moved=false`
- This document records planning only. It plans a read-only reassessment and
  keeps Gate D/E movement out of scope.
- `next_step_label=await_governance_review_for_gate_dependency_reassessment_command_pack`
