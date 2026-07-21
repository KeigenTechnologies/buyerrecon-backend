# Sprint 3 — Riskworker Option B — Worker Verification Dependency-Decoupling Command Pack (Planning Only)

## Document Class

- document_kind: planning_command_pack
- planning_only: true
- docs_only: true
- executes_nothing: true
- implementation_authorized: false
- execution_authorized: false
- worker_verification_run: false
- gate_d_e_moved: false
- gate_d_e_marked_passed: false
- pass_marking_enacted: false
- canonical_registry_modified: false

This document plans how a future, separately authorized remediation may
establish a deterministic, governance-safe worker-verification surface for the
riskworker Option B path. It authorizes nothing: no implementation, no
remediation, no execution, no command exposure, no DB access, no secrets
access, no build, no worker invocation, and no Gate D/E movement. Every action
class described here requires its own separate exact scoped GO.

## Current External-Dependency Blocker

The completed read-only worker readiness and verification-surface static
assessment (recorded for this governance step against base merge commit
`463333f5547b8848a9c91a58031cc332ab77daf9`) returned:

- worker_readiness_classification: `worker_exists_but_external_dependencies_block_verification`
- verification_surface_classification: `multiple_candidate_verification_surfaces`
- recommended_next_action: `plan_worker_dependency_decoupling`

Safe facts establishing the blocker:

- A substantive governed Option B worker implementation exists.
- Multiple candidate invocation surfaces exist: a source-level full runner, a
  source-level record-only runner, and a compiled-artifact surface that is
  wired but dormant.
- The compiled-artifact surface requires a prior build; no compiled artifact
  is committed.
- Every currently identifiable worker invocation surface requires DB access,
  and DB access requires a credential.
- Record-only mode suppresses persistent writes but still reads from the DB.
- Production dependency, network dependency, and customer-input provenance
  are unknown rather than proven safe.
- No dedicated safe failure classifier for worker execution exists. The
  success path may emit safe aggregates, but the failure path may emit raw
  error content, so raw-output-free failure classification is not established.
- Private capture and raw inspection are not yet separated in implementation.
- No worker proof command has been selected or authorized, and no worker
  verification has run.

Because every candidate surface shares the DB-plus-credential dependency, no
worker proof execution GO can currently be written without either authorizing
that dependency explicitly or decoupling the proof from it. This command-pack
plans the decoupling path.

## Statically Observed Decoupling Seams (facts, not selections)

Narrow static inspection of the governed worker implementation records the
following seam facts. They inform Family A feasibility but do not select it:

- The worker's main entry function receives its database connection as an
  injected parameter (a pg pool/client-shaped value supplied by the caller),
  not by constructing a connection internally.
- The candidate-building step is a separable exported function operating on
  already-fetched input rows, so substantive mapping/normalisation logic is
  statically separable from data access.
- Persistence is an isolated exported function; the governed record-only mode
  already skips it, demonstrating an existing write-suppression boundary.

These are static observations only. Feasibility of any family below must be
re-verified statically under a future scoped GO before selection.

## Candidate Decoupling Architecture Families

### Family A — Fixture or in-memory dependency decoupling

Future design: the substantive worker logic receives deterministic synthetic
input or an injected data-access boundary without connecting to a real DB.

The future design must consider:

- a repository or data-access interface for the worker's reads and writes;
- dependency injection or an equivalent explicit seam (the injected
  connection parameter noted above is a candidate seam);
- a fixture, fake, stub, or in-memory adapter satisfying that seam;
- deterministic input rows with fixed timestamps and identifiers;
- deterministic expected safe result categories for classification;
- prevention of persistent writes (no real persistence target exists);
- no DB credential, no production service, no network dependency;
- no customer data — synthetic rows only, never copied records;
- no raw-output inspection for classification;
- no repository modification during proof execution.

Feasibility caution: this family must not be assumed feasible until the
relevant seams have been statically verified under a future GO — in
particular, which connection methods the worker actually invokes, and whether
a fake adapter can satisfy them without materially diverging from production
worker semantics.

### Family B — Ephemeral isolated non-production DB proof (fallback)

Future fallback design: an isolated, synthetic, non-production database
environment.

This family still requires separate exact-scoped authorization for each of:
DB access; credential or secret access; database creation or provisioning;
schema or migration preparation; synthetic fixture insertion; read and write
permissions; cleanup; and network access where applicable.

Explicitly prohibited under this family:

- production databases;
- customer data;
- copied production records;
- shared operational databases;
- unrestricted credentials;
- implicit migration or schema mutation;
- inferring that "non-production" removes the need for DB and secrets
  authorization — it does not.

This family must not be selected merely because the existing worker already
uses PostgreSQL.

### Family C — Safe wrapper around an existing DB-coupled runner

Future design: a classifier or output-safety layer around an existing worker
runner.

Stated clearly:

- This family may improve safe-output handling.
- It does not by itself decouple the DB or credential dependency.
- It cannot satisfy the dependency-decoupling objective alone.
- It may be combined only with another separately authorized proof
  environment (for example Family B).
- Wrapping raw failure output does not make unauthorized DB access
  acceptable.

### Family D — Compiled-artifact proof surface

The compiled surface is defined separately:

- It currently requires a prior build; no committed compiled artifact is
  presently available.
- Build authorization is separate from worker verification.
- Parity verification is separate from worker verification.
- Generated-artifact creation is a file-modification surface.
- This family cannot be selected without separate build and artifact
  governance.
- It must not be treated as automatically preferable to a source-level proof
  surface.

## Option Evaluation Criteria

Future option selection must evaluate every candidate against:

substantive coverage of worker logic; deterministic reproducibility; DB
independence; secret independence; production independence; network
independence; customer-data independence; prevention of persistent writes;
read-only repository behavior; raw-output-free safe classification;
entry-point uniqueness; proof-command uniqueness; build dependency; parity
dependency; generated-artifact dependency; implementation scope;
configuration scope; operational complexity; cleanup requirements;
retry-classification feasibility; evidence quality; and the risk of proving
only a mock rather than substantive worker behavior.

No option may be selected merely because it is easiest to invoke.

## Target Verification-Surface Contract (desired end state)

A future worker verification surface should satisfy:

```
worker_verification_surface_unique=true
worker_proof_command_count=1
db_access_required=false
secrets_access_required=false
production_access_required=false
customer_input_required=false
customer_output_generated=false
persistent_write_permitted=false
repository_file_modification_permitted=false
raw_output_inspection_required=false
safe_classifier_connected=true
deterministic_fixture_or_input=true
substantive_worker_logic_exercised=true
runtime_verification_authorized=false
parity_verification_authorized=false
pass_marking_authorized=false
```

If the selected future architecture cannot meet one or more of these fields,
the exception must be named explicitly and separately authorized. No
exception may be inferred.

## Safe-Classifier Requirements

A future safe classifier must:

- classify successful worker proof;
- classify deterministic worker failure;
- classify infrastructure or dependency failure;
- classify authorization or preflight failure;
- classify ambiguous or contradictory results;
- avoid printing raw stdout, raw stderr, stack traces, SQL or DB output,
  credentials, DSNs, host details, secret values, and customer or runtime
  payloads;
- distinguish private capture from raw inspection;
- fail closed if a safe classification cannot be produced;
- produce only enumerated safe labels and boolean/count fields;
- never convert a failed proof into a pass recommendation.

Private stdout/stderr capture, if technically necessary, does not itself
authorize human or model inspection of the captured content. Capture and
inspection remain separately authorized facts.

## Proof-Surface Uniqueness and Semantic Selection Discipline

The end state must provide exactly one proof command surface
(`worker_proof_command_count=1`). Until then, no proof command exists.

A future planning or implementation GO must explicitly select one semantic
worker surface — full worker behavior, record-only worker behavior, or
another specifically named governed mode — and must define:

- why that surface represents the required Gate D/E worker proof;
- which substantive behaviors are exercised;
- which behaviors are intentionally excluded;
- whether persistence behavior is exercised or simulated;
- whether the result is sufficient for pass recommendation;
- whether another proof component remains necessary.

No surface may be selected merely because its public npm key exists. No broad
instruction such as "test the worker" may authorize a surface.

## Separately Authorized Future Action Classes

The following remain separate authorization surfaces. Each requires its own
exact scoped GO; none is implied by any other, and none is authorized here:

1. Dependency-decoupling source or architecture modification.
2. Fixture or synthetic-input creation.
3. Safe-classifier implementation.
4. Public proof-command exposure.
5. Build or compiled-artifact creation.
6. Parity verification.
7. Static implementation review.
8. Worker proof execution.
9. DB or credential access.
10. Retry execution.
11. Raw-output inspection.
12. Remediation after failed proof.
13. Pass-marking or canonical status movement.
14. Downstream execution.
15. Customer-output generation.

A future proposal may group implementation surfaces, but grouping does not
merge authorization surfaces, and no implementation or execution is
authorized by this planning PR.

## Required Contents of Any Future Implementation Command-Pack or Exact GO

Any future implementation command-pack or exact GO must name:

- exact files allowed for inspection;
- exact files allowed for modification;
- exact selected architecture family;
- exact selected worker semantic surface;
- exact fixture or synthetic-input model;
- exact data-access seam;
- exact safe-classifier labels;
- exact proof-command exposure;
- exact build requirement;
- exact parity requirement;
- exact DB and secret policy;
- exact network policy;
- exact file-modification policy;
- exact test or static-check commands;
- exact invocation counts;
- exact retry policy;
- exact raw-output policy;
- exact safe-output fields;
- exact fail-closed conditions.

Anything not named is not authorized.

## Retry-Policy Boundary

- requested_maximum_retry_count=1 (recorded user preference only)
- retry_operationally_authorized=false

A retry may not be operationally authorized until: one exact proof command
exists; one exact safe classifier exists; retry-eligible safe labels are
defined; non-retryable failure labels are defined; the retry cannot follow
remediation or environment mutation; the retry uses the exact same proof
command and arguments; and total invocation counting is explicit. This
planning document defines no retry trigger.

## Fail-Closed Conditions for Future Work

Future dependency-decoupling and worker-proof work must fail closed if:

- base SHA does not match the GO-named SHA;
- the canonical registry is missing or ambiguous;
- canonical status is not exactly
  `eligible_for_scoped_gate_d_e_status_movement_go`;
- the selected architecture family is not explicit;
- the worker semantic surface is not explicit;
- more than one proof command remains;
- DB dependency remains implicit;
- credential dependency remains implicit;
- production dependency is assumed safe rather than proven absent;
- customer-data use is possible or ambiguous;
- synthetic input is incomplete or non-deterministic;
- persistent writes cannot be prevented;
- repository file modification during proof cannot be prevented;
- the safe classifier is missing;
- raw-output inspection is required;
- build dependency is implicit;
- parity dependency is implicit;
- generated-artifact behavior is implicit;
- proof coverage is insufficient to exercise substantive worker logic;
- fixture behavior diverges materially from production worker semantics;
- results would be incomplete, contradictory, or ambiguous;
- pass-marking would be combined with proof execution;
- downstream or customer-output authorization would be inferred.

## Governance Sequence Back to Worker Proof Execution

1. This planning command-pack PR: independent governance review, then normal
   merge and post-merge verification if PASS.
2. A separately authorized static seam-verification and architecture-family
   selection step (classification only).
3. A separately authorized implementation command-pack naming the exact
   items listed above, followed by its own independent review, merge, and
   static implementation review.
4. A separately authorized worker proof execution exact GO conforming to the
   merged substantive pass-verification planning command-pack (PR #434),
   naming `worker_verification` explicitly as an authorized proof component.
5. Verification produces a recommendation label only. Pass-marking, status
   movement, downstream execution, and customer output each remain separate
   authorization surfaces.

## Merged Governance Evidence Chain (references only)

- PR #421 — package-script build-parity proof evidence.
- PR #428 — canonical status movement.
- PR #431 — read-only Gate D/E evaluation.
- PR #432 — evaluated status movement.
- PR #433 — post-movement registry verification.
- PR #434 — substantive pass-verification planning command-pack; merge
  commit `463333f5547b8848a9c91a58031cc332ab77daf9`.
- The completed worker readiness and verification-surface static assessment
  recorded for this governance step.

Raw worker, DB, runtime, parity, and build output, and exact protected
package-script values, are intentionally not reproduced.

## Status-of-Record

The canonical registry
`docs/ops/sprint3-riskworker-option-b-canonical-gate-de-status-registry.md`
remains the single mutable Gate D/E status-of-record. Its current status,
`eligible_for_scoped_gate_d_e_status_movement_go`, is a governance-state
label only and does not mean Gate D/E passed. This planning document is not a
status document.
