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
- the persistence disposition, per the requirements below;
- whether the result is sufficient for pass recommendation;
- whether another proof component remains necessary.

No surface may be selected merely because its public npm key exists. No broad
instruction such as "test the worker" may authorize a surface.

### Persistence disposition

Every future worker semantic-surface selection must explicitly classify
persistence behavior as exactly one of:

- `persistence_exercised`
- `persistence_prevented`
- `persistence_simulated`

Persistence behavior must never be left implicit. The future implementation
or execution proposal must state:

`persistence_disposition=<exercised|prevented|simulated>`

and must explain:

- why the selected disposition is appropriate for the intended Gate D/E
  worker proof;
- which substantive persistence-related behavior is covered;
- which persistence-related behavior is excluded;
- how persistent writes are prevented when the disposition is `prevented`;
- how production semantics are represented when the disposition is
  `simulated`;
- what DB, credential, fixture, adapter, or in-memory boundary is involved;
- whether the disposition is sufficient for a pass recommendation;
- whether an additional proof surface remains necessary.

`persistence_prevented` is a valid future semantic choice. For a
`persistence_prevented` surface, the future proposal must additionally
define:

- the exact mechanism that prevents writes;
- whether persistence code is bypassed, disabled, injected away, or guarded;
- whether read behavior is still exercised;
- whether candidate-building and worker decision logic remain substantive;
- whether preventing persistence leaves any material worker behavior
  unproved;
- why the result should or should not contribute to a Gate D/E pass
  recommendation.

The existing governed record-only mode must not be assumed to prove that
persistence is safely prevented or that a record-only proof is semantically
sufficient; those facts must be established explicitly.

This planning document does not select a disposition.

Fail closed if the selected worker semantic surface does not explicitly
declare persistence as exercised, prevented, or simulated; if more than one
disposition is implied; or if the selected disposition's mechanism,
coverage, exclusions, and sufficiency are not defined.

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
- the persistence disposition is not explicitly declared as exercised,
  prevented, or simulated, more than one disposition is implied, or the
  selected disposition's mechanism, coverage, exclusions, and sufficiency
  are not defined;
- an implementation merge would occur before independent head-pinned review
  returns PASS against the exact unchanged implementation PR head;
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

## Implementation Review Before Implementation Merge

Any future dependency-decoupling implementation occurs on a dedicated branch
and PR and must receive independent static and governance review **before**
that implementation PR may merge. The required order is:

1. Merge the dependency-decoupling planning command-pack.
2. Separately select and authorize one implementation architecture.
3. Create a dedicated implementation branch and PR.
4. Implement only the exact authorized files and surfaces.
5. Perform authorized static checks against the implementation PR head.
6. Obtain the full immutable implementation PR head SHA.
7. Perform independent, head-pinned static and governance review of that
   exact implementation PR head.
8. Remediate and repeat review if the result is FAIL.
9. Merge the implementation PR only after an explicit PASS against the exact
   unchanged head.
10. Perform narrow post-merge verification.
11. Only then proceed to proof-command and safe-classifier establishment.

Binding statements:

- No implementation PR may merge before independent review.
- Review against a stale or superseded implementation head is invalid.
- Any new implementation commit invalidates the prior review.
- Post-merge verification does not substitute for pre-merge review.
- Implementation review and implementation merge are separate authorization
  surfaces.
- A planning document alone does not authorize implementation merge.

Fail closed if an implementation merge is attempted before independent,
head-pinned static and governance review returns PASS against the exact
unchanged implementation PR head.

## Proof-Command and Safe-Classifier Establishment Stages

The following stages are distinct governance stages. They must not be
combined into a single implicit step, and none of them executes the
substantive worker proof.

### Stage A — Establish one unique proof command

After the dependency-decoupling implementation is merged and post-merge
verification passes, a separate planning and implementation surface must
establish:

- exactly one worker proof command;
- exactly one governed worker semantic surface;
- exact command arguments;
- exact prerequisites;
- exact invocation count;
- exact DB, secrets, network, build, parity, and file-modification policy;
- exact proof-command label;
- no alternative or inferred command.

This stage must not execute the worker proof.

### Stage B — Establish one safe classifier

A separate or explicitly scoped implementation surface must establish one
safe classifier connected to the unique proof command, defining:

- enumerated success labels;
- deterministic worker-failure labels;
- infrastructure or dependency-failure labels;
- authorization and preflight-failure labels;
- ambiguous or contradictory-result labels;
- retry-eligible labels, if any;
- non-retryable labels;
- private capture behavior;
- raw-output inspection prohibition;
- fail-closed behavior when safe classification is impossible.

This stage must not execute the substantive worker proof unless a separate
execution GO explicitly authorizes it.

The proof command and classifier may be implemented in one future PR only if
the exact GO names both action classes and their exact allowed files. Even
then, their contracts and review results must remain separately
identifiable.

### Stage C — Independently review the proof command and classifier

Before any worker proof execution GO:

1. Obtain the immutable PR head containing the proof command and classifier.
2. Independently review that exact head.
3. Confirm there is exactly one proof command.
4. Confirm the command maps to exactly one semantic surface.
5. Confirm the safe classifier is connected to that command.
6. Confirm classification does not require raw-output inspection.
7. Confirm private capture is distinct from raw inspection.
8. Confirm repository and persistent-write behavior matches policy.
9. Confirm DB, secrets, network, build, parity, and customer-data policies
   are explicit.
10. Confirm retry remains unauthorized unless safe retry labels are
    complete.
11. Merge only after PASS.
12. Perform post-merge verification.
13. Issue a separate exact-scoped worker proof execution GO only after those
    stages pass.

Stage-related fail-closed requirements:

- Fail closed if more than one candidate proof command remains, if no unique
  proof command has been established, or if command identity, arguments,
  semantic surface, or prerequisites are ambiguous.
- Fail closed if no safe classifier has been established and connected to
  the unique proof command.
- Fail closed if the proof command and classifier have not received
  independent, head-pinned review before worker proof execution.
- Fail closed if the reviewed proof-command or classifier head changes after
  review.

## Governance Sequence Back to Worker Proof Execution

1. Merge this planning command-pack PR (PR #435) after independent
   governance review returns PASS, with post-merge verification.
2. Select and authorize one implementation architecture (separate scoped
   authorization; classification/selection only).
3. Create a dedicated implementation branch and PR.
4. Implement the dependency decoupling within the exact authorized files and
   surfaces.
5. Perform authorized pre-merge static checks against the implementation PR
   head.
6. Independently review the exact implementation PR head (head-pinned).
7. Merge the implementation PR only after PASS against the unchanged head.
8. Perform implementation post-merge verification.
9. Establish exactly one proof command (Stage A).
10. Establish exactly one safe classifier connected to it (Stage B).
11. Perform independent head-pinned review of the proof command and
    classifier (Stage C).
12. Merge the command/classifier implementation only after PASS.
13. Perform command/classifier post-merge verification.
14. Issue a separate exact-scoped worker proof execution GO conforming to
    the merged substantive pass-verification planning command-pack
    (PR #434), naming `worker_verification` explicitly as an authorized
    proof component.
15. Execute only the exact worker proof authorized by that GO.
16. Emit a recommendation label only.
17. Separately authorize pass-marking or canonical status movement if later
    justified. Pass-marking, status movement, downstream execution, and
    customer output each remain separate authorization surfaces.

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
