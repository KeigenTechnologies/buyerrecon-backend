# Replacement Golden Session — Readiness Contract v0.1

`STATUS = REPLACEMENT_GOLDEN_SESSION_READINESS_CONTRACT_V0_1`

## 0. Purpose and status

This document is the **normative, fail-closed readiness contract** that must be
satisfied before any replacement BuyerRecon Golden Session may be authorized for
execution.

- **It is docs-only.** No application code, no tests, no runtime configuration,
  no migration, no infrastructure, and no deployment are changed by the PR that
  introduces it.
- **It authorizes nothing.** It does not authorize implementation, merge, browser
  execution, AMS invocation, backend worker execution, packaging, or acceptance.
- **It defines requirements, not completions.** Nothing in this document may be
  read as evidence that a requirement is implemented or verified.

### 0.1 Four-state vocabulary (normative)

Every readiness item in this contract carries exactly one state. The states are
ordered and no state may be inferred from a lower one.

| State | Meaning |
|---|---|
| `DEFINED` | The requirement is written down here with normative detail. |
| `IMPLEMENTED` | Code, schema, or infrastructure satisfying it exists and is merged. |
| `INDEPENDENTLY_VERIFIED` | A reviewer who is not the implementer has confirmed it against evidence, not against prose. |
| `AUTHORIZED_FOR_EXECUTION` | A scoped human GO has been issued for a specific replacement session. |

**Every item in this document is at `DEFINED` and no higher.** Describing an item
here never advances it. A PR that merges this document advances nothing beyond
`DEFINED`.

### 0.2 Baseline

| Field | Value |
|---|---|
| Repository | `KeigenTechnologies/buyerrecon-backend` |
| Canonical base branch | `sprint2-architecture-contracts-d4cc2bf` |
| Base SHA (full) | `a0fd148b43db7d1ac1bb1e98d2265a975451c4ba` |
| PR #441 | MERGED at 2026-08-05T15:27:03Z |
| PR #441 reviewed head | `beb5eec5d34c46b026a21fd7cb8c04f0ed39e58c` |
| Containment | `beb5eec5…` is an ancestor of `a0fd148b…` — verified |
| Related AMS surface | `KeigenTechnologies/ams` @ `3e280b40e67d7d8be0ad163a13cf22e31c770d9a` (branch `buyerrecon-golden-session-v0-1-runtime-output`) |

---

## 1. Closed-session authority (frozen)

The previous Golden Session is permanently closed. It is recorded here so that no
future work reopens it by accident.

```text
session_id=ses_x0vrbqik
browser_id=brw_dnrzh1ta
AMS_run_id=9005b50c-e37e-4e78-81c0-a3ec94f4f9f9

engineering_execution_status=COMPLETE
customer_package_status=UNRECOVERABLE
customer_package_failure_classification=AUTHORITATIVE_ARTIFACT_RETENTION_FAILURE

session_closed=true
session_retry_authorized=false
AMS_retry_authorized=false
browser_retry_authorized=false

policy_pass_2_acceptance_readiness=BLOCKED
golden_session_acceptance_status=NOT_ASSESSED
```

The engineering pipeline for that session succeeded. The customer package was
never produced and cannot be produced. These are separate facts and must remain
separately stated wherever the session is referenced.

### 1.1 Prohibitions carried forward (frozen)

These prohibitions are permanent and are not discharged by any later gate:

```text
no retry of ses_x0vrbqik
no retry of AMS run 9005b50c-e37e-4e78-81c0-a3ec94f4f9f9
no reconstruction of the deleted Golden JSON
no ephemeral-only canonical artifacts
no cleanup before retention verification
no Policy Pass 2 authority claim without validated evidence
no replacement-session execution from this planning operation
```

The deleted artifact must never be reconstructed from database rows, logs,
transcripts, selected JSON fields, hash records, human prose, or any prompt. A
file that reproduces the expected hash by reassembly is prohibited regardless of
the hash matching.

---

## 2. Scope

This contract has **exactly two implementation workstreams**:

```text
A. Durable authoritative artifact retention
B. Machine-readable Policy Pass 2 execution-authority evidence
```

**Out of scope, explicitly:** product features, adapter work, GTM, platform
migration, scoring changes, new observers, schema changes unrelated to the two
workstreams, and any improvement to the packaging report body. Work outside these
two workstreams does not belong in a replacement-readiness PR.

### 2.1 Root cause this contract closes

```text
root_cause_category=ARTIFACT_LIFECYCLE_AND_RETENTION
```

The canonical Golden JSON was written only into an execution directory that was
already scheduled for containment cleanup, and was deleted by that cleanup
approximately two minutes after creation. The sole byte-complete, hash-verified
copy was written to an ephemeral agent scratchpad which was later purged. No
durable store and no pre-cleanup retention gate existed.

The artifact was valid, verified, and unretained. Workstream A closes the
retention hole. Workstream B closes the separate, pre-existing acceptance hole
that would have blocked acceptance even if the artifact had survived.

---

## 3. Normative invariants (frozen)

These hold for every replacement session and are not waivable per-run.

- **INV-1.** The canonical Golden JSON is authoritative. It is never regenerated,
  reconstructed, or substituted.
- **INV-2.** AMS is invoked at most once per session. A session whose AMS
  invocation is consumed is never retried.
- **INV-3.** No canonical artifact may exist only inside an execution directory,
  a temporary filesystem, or an agent workspace.
- **INV-4.** Cleanup is a gated operation with preconditions, never a trailing
  teardown step.
- **INV-5.** Final-decision authority is proven by evidence, never inferred from a
  decision value.
- **INV-6.** Every gate fails closed. Absence of evidence is failure, not pass.
- **INV-7.** No later governance step may be inferred from completion of an
  earlier one.

---

# Workstream A — Durable authoritative artifact retention

## A1. Authoritative destination

### A1.1 Prohibited destinations (frozen)

The primary durable store must **not** be any of:

```text
/tmp
/private/tmp
an agent scratchpad
an execution directory
any directory scheduled for containment cleanup
a transient SSH session directory
a disposable checkout or worktree
```

### A1.2 Required properties (frozen)

```text
stable path or object identifier
restricted access
durable retention through packaging and acceptance
independent integrity verification
not deleted by containment cleanup
lifecycle independent of the execution workspace
```

### A1.3 Required contract fields

Every replacement session must resolve all of the following **before** execution:

| Field | Type | Rule |
|---|---|---|
| `artifact_store_type` | enum | One of the ratified candidates in A1.4. |
| `artifact_store_location` | string | Stable, non-ephemeral root. Must not match any A1.1 prohibition. |
| `artifact_object_id_or_path` | string | Assigned before cleanup; recorded in the manifest. |
| `artifact_owner` | string | Named accountable human owner. Never the execution agent. |
| `access_control` | string | Owner read/write only; no world-readable or broad grant. |
| `retention_period` | duration | Must exceed the review + packaging + acceptance horizon. |
| `retention_expiry` | RFC3339 UTC | Absolute expiry, computed at store time. |
| `cleanup_policy` | string | Explicit; must not be triggered by execution-workspace teardown. |

### A1.4 Bounded store candidates and the selection gate

No vendor is selected here. The repository contains no provisioned object-store
dependency, and inventing one would be unsupported by evidence. The candidate set
is bounded to three; exactly one must be ratified before implementation begins.

| ID | Candidate | Satisfies A1.2? | Open question |
|---|---|---|---|
| `C1` | Durable host directory outside the execution tree, restricted mode `0700`, with an explicit retention policy and no cleanup coupling | Yes, if the host itself is durable and the directory is excluded from teardown | Host durability and who owns the retention policy |
| `C2` | S3-compatible object storage (provider unselected) | Yes, natively | Requires provisioning, credential custody, and a registered env-var name |
| `C3` | Dedicated evidence repository or release asset | Partially — durable and hash-addressable, but couples artifact custody to VCS | Whether an internal scoring artifact may be VCS-retained under the customer-output boundary |

**Selection gate `A1-SELECT` (blocking):** a named owner must ratify exactly one
candidate, and — for `C2` — register the store location and credential env-var
name in `.claude/constants.md`, `config/constants.ts`, and
`.claude/production-parameters.md` before any implementation PR opens. Until
`A1-SELECT` closes, Workstream A cannot advance past `DEFINED`.

## A2. Two-copy rule

Two independently retained, byte-complete copies are required:

```text
primary_authoritative_copy
secondary_verification_copy
```

For **each** copy the following must be recorded:

```text
absolute path or object ID
byte count
SHA-256
creation timestamp (RFC3339 UTC)
retention expiry (RFC3339 UTC)
read-back verification status
```

Cleanup remains prohibited unless **all four** hold:

```text
primary copy is readable
secondary copy is readable
SHA-256 values match
byte counts match
```

**Independence requirement (normative).** The secondary copy must not share a
lifecycle with the primary. A second file on the same volume that expires with the
execution workspace does not satisfy A2. That is precisely the configuration that
destroyed `ses_x0vrbqik`: a verified copy existed, on ephemeral storage, and was
purged.

Hashes must be computed by reading each stored copy back from its store — never by
reusing the digest computed at write time.

## A3. Retention manifest

### A3.1 Required fields

```text
schema_version
workspace_id
site_id
browser_id
session_id
AMS_run_id
Golden_JSON_object_id_or_path
Golden_JSON_SHA256
Golden_JSON_byte_count
created_at
retention_expires_at
primary_copy_status
secondary_copy_status
read_back_verified
cleanup_authorized
```

### A3.2 Boundaries

| Aspect | Definition |
|---|---|
| Producer | The retention step that runs after AMS completes and before any cleanup consideration. It is the only writer. |
| Consumer | (a) the cleanup authorization gate (E); (b) the packaging input resolver; (c) independent review. |
| Validation | All fields present; `read_back_verified=true`; both copy statuses `OK`; `Golden_JSON_SHA256` matches both read-back digests; `Golden_JSON_byte_count` matches both; `retention_expires_at` strictly greater than the required horizon. |
| Failure behavior | Any missing, malformed, or contradictory field ⇒ manifest invalid ⇒ `cleanup_authorized=false` ⇒ cleanup prohibited. Fail closed; never default a field. |
| Storage location class | Durable, independent of the execution directory. The only copy of the manifest must never live in the execution workspace. |

`cleanup_authorized` is written by the gate in §A5/E, never by the producer
optimistically.

## A4. Atomic execution-to-retention sequence (frozen order)

```text
AMS execution completes
→ Golden JSON is written
→ primary durable copy is stored
→ secondary copy is stored
→ both copies are read back
→ hashes and byte counts are compared
→ retention manifest is durably stored
→ packaging input readiness may be declared
→ execution-directory cleanup may be considered
```

No step may be reordered. No cleanup is permitted before every preceding step
passes. "Considered" is deliberate: reaching the final arrow makes cleanup
*eligible*, not authorized — authorization is Gate E.

## A5. Failure modes (all fail closed)

| Failure | Required behavior |
|---|---|
| Primary copy write failure | Abort retention. `cleanup_authorized=false`. Artifact remains in the execution directory, undeleted. Report a safe stage label. |
| Secondary copy write failure | Same as above. A single copy never satisfies A2. |
| Read-back failure (either copy) | Retention invalid. Cleanup prohibited. |
| Hash mismatch between copies | Retention invalid. Cleanup prohibited. Neither copy is treated as authoritative. |
| Byte-count mismatch | Retention invalid. Cleanup prohibited. |
| Manifest write failure | Retention invalid. Cleanup prohibited even if both copies verified. |
| Retention expiry shorter than required | Retention invalid. Cleanup prohibited. |
| Cleanup attempted before verification | Rejected. Non-zero exit. Recorded as a governance violation. |

**No failure path may fall back to an ephemeral file, a temporary directory, or a
single copy.** A degraded retention mode does not exist.

---

# Workstream B — Policy Pass 2 execution-authority evidence

## B1. Required claims

The evidence contract must be *capable of proving*, for one exact execution:

```text
policy_pass_1_is_not_final
policy_pass_2_executed
policy_pass_2_final_decision_verified
policy_pass_2_is_sole_final_decision
sole_final_decision_owner
conflicting_final_decision_count
duplicate_final_decision_count
```

**No claim is marked true by this document.** All are `DEFINED` only.

## B2. Required identity linkage

| Field | Mandatory | Contradiction behavior |
|---|---|---|
| `workspace_id` | Yes | Mismatch ⇒ evidence rejected |
| `site_id` | Yes | Mismatch ⇒ evidence rejected |
| `subject_id` (browser subject) | Yes | Mismatch ⇒ evidence rejected |
| `session_id` | Yes | Mismatch ⇒ evidence rejected |
| `AMS_run_id` | Yes | Mismatch or absent ⇒ evidence rejected |
| `source_event_ids` | Yes | Set inequality (order-insensitive) ⇒ evidence rejected |
| `final_decision` | Yes | Must equal the Golden JSON decision; divergence ⇒ evidence rejected **and** `policy_pass_2_acceptance_readiness=BLOCKED` |

Evidence that is unlinked, partially linked, or linked to a different run is
treated as absent. Fail closed.

### B2.1 Insufficient signals (frozen)

None of the following, alone or combined, may be used to conclude that Pass 2
executed or that its decision is sole and final:

```text
final_decision value
RequestedAction
run ID alone
replay-card existence
documentation prose
operator-supplied boolean
```

## B3. Canonical producer

### B3.1 Architectural finding (evidence-based)

In `KeigenTechnologies/ams`, the runtime pipeline
(`internal/orchestration/pipeline.go`, steps 10–12) can produce a
`contracts.RuntimeDecisionOutput` by **three distinct paths**:

1. `TrustInvocationMode = SKIP_TRUST` — the output is constructed directly from
   the Pass 1 resolution with `EarlyExit=true`. **Policy Pass 2 never runs.**
2. Trust computation failure — `degradedRuntimeOutput("ORCHESTRATION.TRUST_FAILED")`.
   **Policy Pass 2 never runs.**
3. `policy.ResolveFinal(&policy.Pass2Input{…})` — `internal/policy/pass2.go`.
   **This is the only Policy Pass 2 execution site.**

`RuntimeDecisionOutput` (`internal/contracts/orchestration.go`) carries
`FinalDecision`, `EarlyExit`, and `ExitReason`, but carries **no field that
identifies which of the three paths produced it**. A consumer holding only the
emitted struct — or the Golden JSON derived from it — cannot distinguish a
Pass-2-resolved decision from a pre-Pass-2 early exit or a degraded fallback.

This is the concrete, code-level reason `final_decision=HOLD` cannot establish
Pass 2 authority, and why Gate D exists independently of the retention failure.

### B3.2 Narrowest truthful producer

```text
producer_boundary = internal/policy/pass2.go :: ResolveFinal()
                    (or its immediate return site in internal/orchestration/pipeline.go)
```

This is the narrowest boundary that can truthfully assert
`policy_pass_2_executed=true`, because it is the only site that executes Pass 2.
Any producer further downstream would be inferring, not observing.

### B3.3 Unresolved architectural choice

Two viable placements remain, and the choice is **not** resolved by this document:

- **`B3-a` — inside `ResolveFinal()`.** Pass 2 emits its own evidence. Narrowest
  and least inferential, but places emission concerns inside a pure policy
  function and changes its signature or adds an output field.
- **`B3-b` — at the call site in `pipeline.go`.** The orchestrator records which
  branch it took. Keeps `ResolveFinal()` pure, but the assertion is made one frame
  away from the fact, and each of the three branches must be instrumented
  correctly and exhaustively or the evidence silently under-reports.

Selecting between `B3-a` and `B3-b` is a prerequisite to implementation and is
recorded as a blocking finding.

### B3.4 Consumer boundary

The validator is backend-side and must be independent of the producer. Candidate
location follows the existing external-report validation surface established by
PR #441 (`src/reports/external/`). The validator never repairs, defaults, or
infers a missing field.

## B4. Proposed schema

Machine-readable. No free-form prose field carries authority.

| Field | Type | Allowed values / rule |
|---|---|---|
| `schema_version` | string | Exact literal `"v0.1"`. Unknown version ⇒ reject. |
| `workspace_id` | string | `^[A-Za-z0-9._:-]{1,128}$`, must equal session identity |
| `site_id` | string | same pattern, must equal session identity |
| `subject_id` | string | same pattern, must equal session identity |
| `session_id` | string | same pattern, must equal session identity |
| `AMS_run_id` | string | RFC 4122 UUID; must equal the run under package |
| `source_event_ids` | array&lt;integer&gt; | Non-empty, unique, order-insensitive equality with the session's set |
| `final_decision` | string | One of `ALLOW`, `ALLOW_WITH_FRICTION`, `HOLD`, `REVIEW`, `DENY`, `NO_ACTION` |
| `policy_pass_1_is_not_final` | boolean | Must be `true` for the evidence to support acceptance |
| `policy_pass_2_executed` | boolean | Must be `true`; `false` ⇒ acceptance BLOCKED (not an error) |
| `policy_pass_2_final_decision_verified` | boolean | `true` only if the recorded decision equals the Golden JSON decision |
| `policy_pass_2_is_sole_final_decision` | boolean | `true` only if conflict and duplicate counts are both `0` |
| `sole_final_decision_owner` | string | Exact literal identifying the Pass 2 boundary; unknown value ⇒ reject |
| `conflicting_final_decision_count` | integer | `>= 0`; any value `> 0` ⇒ acceptance BLOCKED |
| `duplicate_final_decision_count` | integer | `>= 0`; any value `> 0` ⇒ acceptance BLOCKED |
| `producer_identity` | string | Producer name + AMS commit SHA (full, 40 hex) |
| `produced_at` | string | RFC3339 UTC, must fall within the execution window |
| `evidence_sha256` | string | 64 lowercase hex; digest of the canonical serialization excluding this field |

### B4.1 Fail-closed validation rules

1. Any missing field ⇒ **reject**. No defaulting.
2. Any type mismatch or out-of-domain literal ⇒ **reject**.
3. Any identity field not matching §B2 ⇒ **reject**.
4. `policy_pass_2_executed=false` ⇒ evidence is *valid* but acceptance is
   `BLOCKED`. This is a legitimate outcome, distinct from malformed evidence.
5. `conflicting_final_decision_count > 0` or `duplicate_final_decision_count > 0`
   ⇒ `policy_pass_2_is_sole_final_decision` must be `false`; if it is `true`,
   the evidence is self-contradictory ⇒ **reject**.
6. `final_decision` ≠ Golden JSON decision ⇒ **reject** and `BLOCKED`.
7. `evidence_sha256` mismatch on recomputation ⇒ **reject**.
8. Rejection never degrades to partial acceptance. There is no partial-credit path.

## B5. Durable retention of the evidence

The execution-authority evidence is subject to the **same** Workstream A
requirements as the Golden JSON:

```text
durable primary copy
independent verification copy
SHA-256 recorded
byte count recorded
retention manifest linkage (A3)
```

It must survive execution-directory cleanup. The retention manifest must
reference both the Golden JSON and the evidence object, and Gate E must verify
both before authorizing cleanup.

## B6. Packaging boundary

```text
validated execution-authority evidence present
→ Policy Pass 2 authority wording may be emitted

evidence absent, invalid, contradictory or unlinked
→ only neutral authoritative-AMS wording is permitted
→ policy_pass_2_acceptance_readiness=BLOCKED
```

Neutral wording remains exactly:

```text
Authoritative AMS final decision: <decision>
```

Neutral wording is the **default**. Authority wording is a narrow, evidence-gated
exception. Packaging must never upgrade wording on the basis of a decision value,
a run id, or an operator assertion.

---

## 4. Gate E — Cleanup authorization

Containment cleanup may occur only after a pre-cleanup verification reports **all**:

```text
canonical_artifact_durably_stored=true
secondary_copy_verified=true
retention_manifest_stored=true
required_execution_evidence_stored=true|not_required_for_declared_scope
packaging_completed=true|explicitly_deferred_with_durable_inputs
cleanup_authorized=true
```

An unconditional `rm -rf <execution directory>` is **prohibited** before this gate
passes. `not_required_for_declared_scope` is permitted only when the session was
declared up front as engineering/package validation only (§6.1) — it may never be
used to retro-fit a session that attempted acceptance.

---

## 5. Frozen replacement-session preconditions

A replacement Golden Session cannot receive execution authorization until **every**
item below is `INDEPENDENTLY_VERIFIED`:

```text
artifact primary store implemented
artifact secondary copy implemented
read-back hash verification implemented
retention manifest implemented
cleanup gate implemented
Policy Pass 2 evidence producer implemented
Policy Pass 2 evidence validator implemented
execution-authority evidence durable retention implemented
end-to-end dry-run or fixture verification passed
independent review passed
```

**Planning approval alone must not authorize execution.** Merging this document
satisfies none of the above.

---

## 6. Replacement-session identity

The replacement session is a **separately identified** session requiring new:

```text
browser_id
session_id
source_event_ids
AMS_run_id
Golden JSON artifact identity
```

It must not reuse or impersonate `ses_x0vrbqik`, `brw_dnrzh1ta`, events 51–59, or
run_id `9005b50c-e37e-4e78-81c0-a3ec94f4f9f9`.

### 6.1 Declared scope classification (mandatory, pre-execution)

If Workstream B is not `INDEPENDENTLY_VERIFIED` when the replacement session is
authorized, that session **must** be declared, before execution, as:

```text
engineering/package validation only — not full Golden Session acceptance
```

The classification is chosen before execution and cannot be revised afterwards.

---

## 7. Implementation plan — minimum likely change surface

Identified for a future implementation PR. **Nothing in this section is edited by
this operation.**

### 7.1 AMS repository (`KeigenTechnologies/ams`)

| Component | Expected change |
|---|---|
| `internal/policy/pass2.go` | Emit or expose Pass 2 execution facts (choice `B3-a`) |
| `internal/orchestration/pipeline.go` | Instrument all three decision paths (choice `B3-b`) |
| `internal/contracts/orchestration.go` | Evidence struct definition, if the contract is carried in-band |
| `cmd/buyerrecon-report/main.go` | Serialize the evidence object alongside the Golden JSON |

### 7.2 Backend repository (`KeigenTechnologies/buyerrecon-backend`)

| Component | Expected change |
|---|---|
| `src/reports/external/` (new module) | Pass 2 evidence validator |
| `src/reports/external/golden-session-package.ts` | Consume validated evidence; gate authority wording |
| `src/reports/external/ams-existing-run.ts` | Resolve Golden JSON from the durable store identifier |
| `scripts/run-golden-session.ts` | Retention sequence (A4) and cleanup gate (E) |
| `config/constants.ts`, `.claude/constants.md` | Register store location and env-var names |
| `.claude/production-parameters.md` | Credential custody, if candidate `C2` is ratified |

### 7.3 Infrastructure / storage configuration

Deferred until `A1-SELECT` closes. If `C2` is ratified: bucket or container
provisioning, retention policy, restricted credential, registered env-var name.
No infrastructure is provisioned by this document.

### 7.4 Static gates

| Gate | Purpose |
|---|---|
| `check:constants` | New store/env names registered before use |
| `check:customer-output-boundary` | Authority wording remains evidence-gated |
| New static check (candidate) | Reject unconditional `rm -rf` of an execution directory in `scripts/` |

### 7.5 Documentation

This file. Revisions are versioned
(`replacement-golden-session-readiness-contract-v0.2.md`, etc.).

---

## 8. Minimum required tests

All are L1/L2. **No test in this matrix may connect to production or invoke AMS.**

| # | Test | Required outcome |
|---|---|---|
| 1 | Primary write failure | Retention aborts; cleanup prohibited; artifact retained |
| 2 | Secondary write failure | Retention aborts; cleanup prohibited |
| 3 | Hash mismatch between copies | Retention invalid; neither copy authoritative |
| 4 | Read-back failure | Retention invalid; cleanup prohibited |
| 5 | Manifest write failure | Cleanup prohibited even with both copies verified |
| 6 | Premature cleanup rejection | Cleanup before Gate E exits non-zero |
| 7 | Missing Pass 2 evidence | Validator rejects; neutral wording; `BLOCKED` |
| 8 | Contradictory Pass 2 evidence | Validator rejects (rule B4.1.5) |
| 9 | Wrong run/session linkage | Validator rejects as absent |
| 10 | Duplicate final-decision evidence | `duplicate_final_decision_count > 0` ⇒ `BLOCKED` |
| 11 | Neutral wording fallback | Default path emits exactly the neutral sentence |
| 12 | Durable artifact survival after execution-directory deletion | Fixture deletes the execution dir; artifact and manifest remain readable and hash-valid |

Test 12 is the direct regression test for the failure that closed `ses_x0vrbqik`.

---

## 9. Independent-review requirements

- The reviewer must not be the implementer.
- Review is against **evidence**, never against this document's prose.
- Review must separately confirm Workstream A and Workstream B; one passing does
  not imply the other.
- Review must confirm that no readiness item was advanced past `DEFINED` without
  corresponding merged code or provisioned infrastructure.
- Review must confirm that the closed session was not reopened, retried, or
  reconstructed.

---

## 10. Governance sequence (frozen)

```text
1.  docs-only readiness contract
2.  independent review of the contract
3.  separate implementation authorization
4.  implementation PR
5.  independent implementation review
6.  non-production fixture qualification
7.  replacement-session execution authorization
8.  browser execution
9.  backend processing
10. exactly-once AMS execution
11. durable retention verification
12. packaging
13. acceptance assessment
14. cleanup only after retention and packaging gates
```

**No later step may be inferred from completion of an earlier step.** Each
transition requires its own explicit authorization. This document is step 1 only.

---

## 11. Frozen exit criteria for this document

| Criterion | Present |
|---|---|
| Exact scope | §2 |
| Normative invariants | §3 |
| Proposed schemas | §A3.1, §B4 |
| Producer/consumer boundaries | §A3.2, §B3, §B3.4 |
| Storage and retention requirements | §A1, §A2, §B5 |
| Cleanup sequencing | §A4, §4 |
| Failure behavior | §A5, §B4.1 |
| Implementation file candidates | §7 |
| Test requirements | §8 |
| Independent-review requirements | §9 |
| Future authorization sequence | §10 |

## 12. Non-blocking follow-ups

Explicitly **non-blocking**. None gates implementation or execution.

- A reusable verification helper so Gate B is mechanically checkable rather than
  operator-attested.
- Recording the AMS binary's build SHA inside the retention manifest for
  provenance convenience.
- A single narrow static check rejecting unconditional execution-directory removal
  in `scripts/` (listed as a candidate in §7.4, not required).

---

**End of readiness contract v0.1.** This document is `DEFINED` only. It authorizes
no implementation, no merge, no replacement-session execution, and no acceptance
claim.
