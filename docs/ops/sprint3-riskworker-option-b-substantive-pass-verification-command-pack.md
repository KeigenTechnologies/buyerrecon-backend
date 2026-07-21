# Sprint 3 — Riskworker Option B — Substantive Gate D/E Pass-Verification Command Pack (Planning Only)

## Document Class

- document_kind: planning_command_pack
- planning_only: true
- executes_nothing: true
- substantive_pass_verification_run: false
- gate_d_e_moved: false
- gate_d_e_marked_passed: false
- pass_marking_enacted: false
- canonical_registry_modified: false

This document defines a **future, separately authorized** substantive Gate D/E
pass-verification step for the riskworker Option B path. It plans that step; it
does not perform it. Nothing in this document authorizes any execution. Every
action class described here requires its own separate exact scoped GO.

## Purpose

The purpose of the future substantive pass-verification step is to determine
whether Gate D/E can be substantively verified as **passed** — that is, whether
separately authorized proof (some or all of runtime verification, worker
verification, and parity verification) demonstrates that the Gate D/E criteria
are substantively satisfied, beyond governance eligibility.

## Governance Distinctions

This command-pack distinguishes four separate concepts. None implies any other:

1. **Governance eligibility status** — the canonical registry's current label
   describing what the next authorized governance step may be. It is a
   governance-state label only.
2. **Substantive pass verification** — a future, separately authorized
   evidence-producing step that runs narrowly authorized proof components to
   determine whether Gate D/E substantively pass.
3. **Pass-marking** — a future, separately authorized mutation of the canonical
   registry recording Gate D/E as passed. Verification never enacts this.
4. **Downstream/customer-output authorization** — a future, separately
   authorized action class. Neither verification nor pass-marking authorizes
   downstream execution or customer output.

## Current Status Meaning

The current canonical status is exactly:

`eligible_for_scoped_gate_d_e_status_movement_go`

This status does **not** mean Gate D/E passed. It does not mean substantive
pass verification was performed, does not mean pass-marking occurred, and does
not authorize runtime, worker, parity, build, DB, secrets, downstream, or
customer-output activity.

## Status-of-Record

- canonical_registry: `docs/ops/sprint3-riskworker-option-b-canonical-gate-de-status-registry.md`
- canonical_registry_single_mutable_status_of_record: true

The canonical registry remains the single mutable Gate D/E status-of-record.
This planning document is not a status document and must never be treated as
one.

## Candidate Proof Components

The future substantive pass-verification step is expected to require separately
authorized proof involving some or all of the following components, defined
here as distinct authorization units:

- `runtime_verification` — narrowly scoped runtime proof that the riskworker
  Option B runtime path behaves as required by Gate D/E.
- `worker_verification` — narrowly scoped worker proof that the riskworker
  worker path behaves as required by Gate D/E.
- `parity_verification` — narrowly scoped parity proof that required parity
  holds for the riskworker Option B path.

Rules:

- The future exact execution GO must **name explicitly** each component it
  authorizes. Only named components may run.
- A GO may authorize an exact subset (one, two, or all three). The subset must
  be named explicitly; this command-pack does not assume all three will be
  authorized in one GO.
- No component may be inferred from broad instruction language such as
  "verify pass", "check the gates", or "run verification". Broad language is a
  fail-closed condition, not an authorization.
- Any component not explicitly named is not authorized and must not run.

## Future Preflight Requirements

Before executing any authorized proof component, the future pass-verification
attempt must confirm all of the following:

1. Exact base SHA matches the SHA named in the future execution GO.
2. Working tree is clean.
3. The canonical registry exists.
4. The canonical registry is the single mutable Gate D/E status-of-record.
5. Canonical status is exactly:
   `eligible_for_scoped_gate_d_e_status_movement_go`
   (or the exact successor status named by the future GO, if governance moves
   the status between now and then — in which case the GO must name it).
6. Merged evaluation evidence and merged post-movement verification evidence
   exist in the base branch.
7. Gate D/E are not already marked passed.
8. Pass-marking has not already been enacted.
9. `customer_output_generated` remains false in the registry.
10. `downstream_execution` remains false in the registry.
11. The future GO explicitly names every authorized proof component.
12. The future GO explicitly names allowed commands or command families.
13. The future GO explicitly defines the invocation count.
14. The future GO explicitly defines whether retries are permitted.
15. The future GO explicitly defines safe-output handling.
16. The future GO explicitly defines whether raw output may be inspected.
17. The future GO explicitly defines whether file modification is allowed.

## Fail-Closed Requirements

The future pass-verification attempt must fail closed — stop without running or
continuing any proof component, report blockers via safe labels only, and make
no mutation — if any of the following holds:

- Base SHA does not match the GO-named SHA.
- The canonical registry is missing.
- The canonical registry is ambiguous or duplicated.
- Canonical status is not exactly
  `eligible_for_scoped_gate_d_e_status_movement_go`
  (or the exact successor status named by the GO).
- Gate D/E are already marked passed.
- The GO does not name exactly the authorized proof components.
- The GO uses broad or ambiguous execution language.
- A command needed for a proof component is not explicitly named or covered by
  an explicitly named command family in the GO.
- Invocation count is not explicit.
- Retry policy is not explicit.
- Safe-output policy is not explicit.
- Required merged evidence is missing.
- Verification would require unauthorized DB access or secrets access.
- Verification would require unauthorized production access.
- Verification would require unauthorized downstream execution.
- Verification would generate customer output.
- Verification would modify source, package.json, scripts, configuration,
  workflows, lockfiles, dependencies, or the canonical registry.
- Results are incomplete, contradictory, or ambiguous.
- Any required proof component fails.
- Pass-marking would be attempted in the same step without a separately
  authorized exact scoped pass-marking GO.

## Required Authorization Separation

The following remain separate authorization surfaces. Each requires its own
separate exact scoped GO; none is implied by, or bundled with, any other:

1. Substantive pass-verification execution.
2. Pass-marking / canonical status movement.
3. Downstream execution.
4. Runtime execution beyond the narrowly authorized proof.
5. Worker execution beyond the narrowly authorized proof.
6. Parity execution beyond the narrowly authorized proof.
7. Customer-output generation.

A successful future verification produces a **recommendation label only**
(for example `recommended_next_status=<safe label>` and
`recommended_next_action=<safe label>`). It must not itself mark Gate D/E
passed, move the canonical status, or mutate the canonical registry unless a
separate exact scoped pass-marking GO explicitly authorizes that mutation.

## Future Safe-Output Model

The future pass-verification attempt must report results only through a
safe-output block. Raw runtime, worker, or parity output; exact package-script
values; secrets; DSNs; database output; runtime payloads; customer data; and
private paths must never appear in the safe output. Required fields:

```
verification_status=<completed|blocked|failed>
authorized_proof_component_count=<number>
runtime_verification_authorized=<true|false>
runtime_verification_run=<true|false>
worker_verification_authorized=<true|false>
worker_verification_run=<true|false>
parity_verification_authorized=<true|false>
parity_verification_run=<true|false>
command_invocation_count=<number>
retry_count=<number>
raw_output_inspected=<true|false>
stdout_captured_private=<true|false>
stderr_captured_private=<true|false>
working_tree_clean_before=<true|false>
working_tree_clean_after=<true|false>
files_modified=<true|false>
gate_d_e_marked_passed=false
pass_marking_enacted=false
customer_output_generated=false
downstream_execution=false
db_access=false
secrets_access=false
recommended_next_status=<safe label only>
recommended_next_action=<safe label only>
blockers=<none or safe labels>
```

Rules:

- A component's `*_run` field may be true only if its `*_authorized` field is
  true under the future GO.
- `gate_d_e_marked_passed`, `pass_marking_enacted`,
  `customer_output_generated`, `downstream_execution`, `db_access`, and
  `secrets_access` are fixed at `false` for the verification step; if any would
  become true, the step must fail closed instead.
- `recommended_next_status` and `recommended_next_action` are safe labels
  only. They are recommendations, not enactments.

## Merged Governance Evidence Chain (references only)

The future step relies on the following merged governance chain, referenced by
PR number only. Raw proof output and exact package-script values are
intentionally not reproduced here:

- PR #420 — package-script exposure.
- PR #421 — parity-proof evidence.
- PR #428 — canonical status movement.
- PR #431 — read-only evaluation evidence.
- PR #432 — evaluated status movement.
- PR #433 — post-movement verification evidence.

## Boundaries of This Planning Document

This document is docs-only planning. It performs and authorizes nothing. In
particular, under this document alone:

- No substantive pass verification runs.
- No runtime, worker, parity, or build execution occurs.
- No DB, secrets, or production access occurs.
- No downstream execution or customer output occurs.
- Gate D/E are not moved and not marked passed.
- Pass-marking is not enacted.
- The canonical registry is not modified.
- No reassessment or remediation occurs.

The next governance sequence after this planning PR is: independent governance
review of this PR; normal merge and post-merge verification if PASS; and only
then consideration of a separately authorized substantive pass-verification
execution command-pack or exact GO.
