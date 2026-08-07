# Replacement Golden Session — Implementation Readiness Ratification v0.1

`STATUS = REPLACEMENT_GOLDEN_SESSION_IMPLEMENTATION_READINESS_RATIFICATION_V0_1`

## 1. Status and authority

This document performs exactly one governance operation:
`IMPLEMENTATION_READINESS_RATIFICATION` for the merged replacement Golden Session
architecture. It ratifies five readiness areas and freezes nothing else.

```text
R1 operative retention period
R2 named roles/custodians and separated authority
R3 credential-delivery model
R4 exact implementation surface
R5 implementation and non-production qualification boundary
```

This is not an implementation operation. It creates no AWS resource, no
credential, no account, no key, no bucket, no trail, and no code change.

```text
implementation_authorized=false
aws_provisioning_authorized=false
credential_creation_authorized=false
replacement_session_execution_authorized=false
browser_execution_authorized=false
AMS_execution_authorized=false
packaging_authorized=false

aws_resources_provisioned=false
credentials_created=false
storage_provisioned=false
producer_implemented=false
```

Ratifying readiness does not authorize implementation. Under readiness contract
INV-7 and §10, and architecture selection §14.2, no later governance step may be
inferred from completion of an earlier one. A separate implementation
authorization is required after this document is independently reviewed.

### 1.1 What PASS means here

```text
PASS = the implementation-readiness contract is eligible for
       personnel-independent docs-only review
```

It means nothing else. It is not an implementation authorization, not a
provisioning authorization, and not an execution authorization.

### 1.2 Downstream assignment gates that remain open

This ratification freezes models, roles, rules, and surfaces. It deliberately
does **not** invent operational facts that do not yet exist. Three assignment
gates remain open and each independently blocks implementation authorization:

| Gate | Frozen here | Still required before implementation authorization |
|---|---|---|
| `G1-NAMED-ASSIGNMENT` | The nine accountable roles and the authority-separation matrix (§5, §6) | Assignment of named accountable humans to every role, with the separation matrix satisfied by the actual assignment |
| `G2-RESOURCE-IDENTIFIER` | The required infrastructure surface and its mandatory properties (§10) | Ratified account IDs/aliases, regions, bucket names, KMS key identities, IAM role names, and trail identities |
| `G3-CONSTANT-REGISTRATION` | The obligation and its target files (§10.4) | Registration of every non-secret store location and parameter name in `.claude/constants.md`, `config/constants.ts`, and `.claude/production-parameters.md` |

Per architecture selection §14.1, named human owners, account/region/bucket/key
identifiers, role names, and custody registrations **are not invented**. This
document honours that prohibition; it defines the roles that must be filled and
the properties that must hold, and it makes filling them a blocking precondition.

No implementation may begin until G1, G2, and G3 are all closed.

---

## 2. Canonical merged baseline

Resolved remotely at the start of this operation.

```text
repository=KeigenTechnologies/buyerrecon-backend
canonical_branch=sprint2-architecture-contracts-d4cc2bf

current_base_sha=3b0a9699eb728b0260b56a54b4c39ffb21876ba1
pr_443_merge_commit_sha=3b0a9699eb728b0260b56a54b4c39ffb21876ba1
pr_443_merge_parent_1=00f1234fa7fb47f770b84869d42ca6be7d00de30
pr_443_merge_parent_2=366925691e54d3bdba6ef2e028958adbeb2d663a
pr_443_reviewed_head_ancestor_of_base=true
```

Both canonical contracts are present on the base and are treated as normative:

```text
docs/architecture/replacement-golden-session-readiness-contract-v0.1.md
docs/architecture/replacement-golden-session-architecture-selection-v0.1.md
```

Merge review is not reopened. PR #441, PR #442, and PR #443 are not reopened.
The closed session `ses_x0vrbqik` is not reopened, retried, reconstructed,
reused, or reclassified.

### 2.1 AMS architecture reference and drift check

```text
repository=KeigenTechnologies/ams
b3_architecture_reference_commit=3e280b40e67d7d8be0ad163a13cf22e31c770d9a
ams_default_branch=main
ams_main_head_at_ratification=3e280b40e67d7d8be0ad163a13cf22e31c770d9a
producer_boundary_drift_since_selection=NONE
```

AMS `main` is still exactly the commit the B3 selection was pinned to, so the
observation boundary described in architecture selection §6 has not drifted.
This does not waive the re-pin obligation: architecture selection §14.1 requires
the AMS implementation base to be re-pinned and drift-reviewed at implementation
authorization time, not at ratification time.

Both repositories were read only. Neither was edited.

---

## 3. Frozen A1 and B3 selections

Carried forward unchanged. This document selects nothing new.

### 3.1 A1 — durable retention architecture

```text
durable_storage_selection_status=SELECTED
selection_id=A1-C2-AWS-S3-DUAL-ACCOUNT-DUAL-REGION-OBJECT-LOCK-V0_1
selected_storage_design=AWS_S3_DUAL_ACCOUNT_DUAL_REGION_OBJECT_LOCK_COMPLIANCE_EVIDENCE_VAULT
```

Frozen independence model:

```text
different AWS accounts
different AWS regions
different S3 buckets
different IAM credential boundaries
different KMS keys
different audit boundaries
different lifecycle boundaries
different custodians
```

### 3.2 B3 — Policy Pass 2 authority-evidence producer

```text
authority_evidence_producer_selection_status=SELECTED
selected_producer_boundary=KeigenTechnologies/ams@3e280b40e67d7d8be0ad163a13cf22e31c770d9a::internal/orchestration.Pipeline.ExecuteWithRecord::FinalDecisionPublicationLedger.Finalize_after_all_decision_paths_converge_before_Step_13_writeback
```

```text
backend packaging remains a consumer and validator
backend packaging is NOT the Policy Pass 2 authority producer
```

### 3.3 Two-phase retention lifecycle

```text
Phase 1: execution_retention_manifest    cleanup_authorized=false
Phase 2: cleanup_authorization_record    cleanup_authorized=true
```

No in-place mutation of an immutable record or object version is permitted.
Cleanup requires verified primary and secondary Phase 2 copies.

### 3.4 Eight-object lifecycle

```text
2 Golden JSON copies
2 authority-evidence copies
2 execution-retention-manifest copies
2 cleanup-authorization-record copies

total=8 retained object versions
```

Every retained object version requires, individually and without aggregation:

```text
object identity
version ID
byte count
SHA-256
write confirmation
read-back verification
Object Lock state
retention expiry
```

### 3.5 Policy Pass 2 authority qualification

Preserved exactly:

```text
policy_pass_1_is_not_final=true
policy_pass_2_executed=true
policy_pass_2_final_decision_verified=true
policy_pass_2_is_sole_final_decision=true
sole_final_decision_owner="policy_pass_2"
conflicting_final_decision_count=0
duplicate_final_decision_count=0
```

All conditions must hold before `policy_pass_2_authority_verified=true`.
Otherwise:

```text
policy_pass_2_authority_verified=false
policy_pass_2_acceptance_readiness=BLOCKED
```

and wording remains exactly:

```text
Authoritative AMS final decision: <decision>
```

---

## 4. Retention-period ratification (R1)

### 4.1 Ratified policy

```text
retention_policy_id=BR-GOLDEN-EVIDENCE-RETENTION-V0_1
policy_class=operational retention policy
minimum_retention_duration=730 calendar days (24 months)
retention_start_event=successful creation of that exact S3 object version (per-version object_created_at, recorded per copy)
retention_expiry_rule=retain_until = max(object_created_at + 730d, execution_authorization.retention_expires_at), computed and recorded independently for every one of the eight object versions; a missing or shorter authorized horizon fails closed
extension_rule=extend-only; retain_until may be extended by the retention-policy approver at any time before expiry, and may never be shortened, reduced, or bypassed
early_deletion_allowed=false
object_lock_mode=COMPLIANCE
versioning_required=true
retention_period_ratification_status=RATIFIED
```

The operative period is no longer `PENDING`.

### 4.2 Classification

This is an **operational retention policy**. It is not a legal, regulatory, or
statutory data-retention assertion, and it must never be represented as one. No
external legal or regulatory retention requirement was identified or relied upon.
The duration is chosen as the minimum operational period that safely covers the
complete Golden Session lifecycle plus a post-acceptance audit window.

If a legal or regulatory retention requirement is later identified and is longer,
the extend-only rule in §4.1 accommodates it. A shorter external requirement
never shortens this policy: compliance mode makes shortening impossible before
expiry, and §4.5 records that limitation as intended.

### 4.3 Relationship to the frozen A1 selection

Architecture selection §5.2 already froze `primary_retention_period` and
`secondary_retention_period` at "minimum 730 calendar days per immutable object
version", with expiry rule `retain_until=max(object_created_at+730d,
execution_authorization.retention_expires_at)`.

R1 therefore **carries that frozen minimum forward as the operative value**. It
does not weaken, shorten, or reinterpret it. Ratification here converts a frozen
minimum into the ratified operative policy and extends it explicitly to all eight
object versions.

### 4.4 Lifecycle coverage

The policy must outlast every stage below. Coverage is asserted as a governance
bound, not derived from a delivery schedule; no stage duration is invented here.

| Covered stage | Covered by `BR-GOLDEN-EVIDENCE-RETENTION-V0_1` |
|---|---|
| replacement-session execution | Yes |
| independent implementation review | Yes |
| non-production qualification | Yes |
| browser execution | Yes |
| backend processing | Yes |
| exactly-once AMS execution | Yes |
| retention verification | Yes |
| packaging | Yes |
| acceptance assessment | Yes |
| post-acceptance audit/review period | Yes — the residual balance of the 730-day horizon after acceptance |

If any stage were to approach the horizon, the required action is extension under
§4.1, never cleanup, never re-execution, and never reclassification. Retention
expiry is not an acceptance deadline.

### 4.5 Application to all eight object versions

The policy applies independently to each of:

```text
Golden JSON primary copy
Golden JSON secondary copy
authority-evidence primary copy
authority-evidence secondary copy
execution-retention-manifest primary copy
execution-retention-manifest secondary copy
cleanup-authorization-record primary copy
cleanup-authorization-record secondary copy
```

Per architecture selection §10.2, a single generic `retention_expiry` covering
all retained objects is prohibited. Each object version carries its own
`retain_until`, evaluated independently against this policy.

Additional ordering constraints, all fail-closed:

```text
Phase 1 manifest retention MUST NOT be shorter than the evidence retention it describes
Phase 2 cleanup-authorization retention MUST NOT be shorter than the protected lifecycle
primary and secondary retention expiries for the same logical object MUST agree
```

### 4.6 Object Lock compliance-mode truthfulness

```text
compliance mode CANNOT be shortened before expiry
compliance mode CANNOT be bypassed before expiry
compliance mode CANNOT be downgraded to governance mode for an existing version
```

This document makes no claim that compliance mode can be shortened or bypassed.
It also makes no claim that compliance mode protects against AWS account closure
or KMS-key deletion — see §6.6 and §6.7.

---

## 5. Owner/custodian ratification (R2)

### 5.1 Role model, not invented humans

Nine separately accountable roles are ratified. Actual human assignment is
deferred to gate `G1-NAMED-ASSIGNMENT` (§1.2) and blocks implementation
authorization. No human name, account identifier, or credential is invented here.

| Role ID | Accountability | May not also hold |
|---|---|---|
| `EVIDENCE_PRIMARY_ACCOUNT_CUSTODIAN` | Ownership and lifecycle of the primary evidence AWS account, including closure authority | Any secondary-side role |
| `EVIDENCE_SECONDARY_ACCOUNT_CUSTODIAN` | Ownership and lifecycle of the secondary evidence AWS account, including closure authority | Any primary-side role |
| `KMS_PRIMARY_CUSTODIAN` | Lifecycle of the primary KMS key, including scheduled deletion and key policy | `KMS_SECONDARY_CUSTODIAN`; any secondary-side role |
| `KMS_SECONDARY_CUSTODIAN` | Lifecycle of the secondary KMS key, including scheduled deletion and key policy | `KMS_PRIMARY_CUSTODIAN`; any primary-side role |
| `BUCKET_OBJECT_LOCK_ADMINISTRATOR_PRIMARY` | Primary bucket configuration, versioning, Object Lock default retention, lifecycle rules | The secondary bucket administrator role; `CLEANUP_AUTHORIZATION_APPROVER` |
| `BUCKET_OBJECT_LOCK_ADMINISTRATOR_SECONDARY` | Secondary bucket configuration, versioning, Object Lock default retention, lifecycle rules | The primary bucket administrator role; `CLEANUP_AUTHORIZATION_APPROVER` |
| `RETENTION_POLICY_APPROVER` | Approves and extends `BR-GOLDEN-EVIDENCE-RETENTION-V0_1`; approves per-object `retain_until` extensions | Either account custodian; either KMS custodian; `CLEANUP_AUTHORIZATION_APPROVER` |
| `CLEANUP_AUTHORIZATION_APPROVER` | Approves emission of the Phase 2 cleanup authorization record after the §10.6 gate of the architecture selection passes | Any account, KMS, bucket, or retention administration role |
| `IMPLEMENTATION_OPERATOR` | Writes and operates implementation code under explicit authorization | `INDEPENDENT_REVIEWER`; any custodian, approver, or administration role |
| `INDEPENDENT_REVIEWER` | Personnel-independent review of contracts, implementation, and qualification evidence | `IMPLEMENTATION_OPERATOR`; any custodian or approver role for the artefact under review |

`EVIDENCE_PRIMARY_ACCOUNT_CUSTODIAN` and `EVIDENCE_SECONDARY_ACCOUNT_CUSTODIAN`
satisfy readiness contract A1.3 `artifact_owner` once G1 closes. Neither may ever
be the execution agent, a runtime role, or a service principal.

### 5.2 Non-collapse requirement

The following powers must not collapse into one uncontrolled principal:

```text
AWS account closure
KMS-key deletion
bucket administration
retention-policy administration
cleanup authorization
```

No single role, human, credential, or automation principal may be able to:

```text
destroy both retained copies
disable both evidence sides
delete or make unreadable both KMS-protected copies
authorize cleanup and simultaneously control all durable evidence
```

Every one of those four capabilities requires the cooperation of at least two
separately accountable roles that sit on opposite independence boundaries.

### 5.3 Assignment validation rule

At gate `G1-NAMED-ASSIGNMENT`, the proposed assignment is valid only when all
hold:

```text
every role in §5.1 has exactly one named accountable human
no named human holds a primary-side and a secondary-side role
no named human holds both KMS custodian roles
no named human holds both bucket administrator roles
CLEANUP_AUTHORIZATION_APPROVER holds no account, KMS, bucket, or retention administration role
RETENTION_POLICY_APPROVER holds no account-closure or KMS-deletion authority
IMPLEMENTATION_OPERATOR and INDEPENDENT_REVIEWER are different humans
no role is held by the execution agent or a runtime service principal
```

Any violation fails closed. Implementation authorization remains blocked.

```text
owner_custodian_model_status=RATIFIED
named_assignment_status=PENDING_G1_NAMED_ASSIGNMENT_GATE
named_assignment_blocking_for_implementation_authorization=true
```

---

## 6. Authority-separation matrix

Rows are the five powers. Columns are as required by the ratification scope.

| Power | `primary_side_authority` | `secondary_side_authority` | `approval_requirement` | `prohibited_combination` | `audit_source` |
|---|---|---|---|---|---|
| `account_closure` | `EVIDENCE_PRIMARY_ACCOUNT_CUSTODIAN` only, within the primary AWS organization boundary | `EVIDENCE_SECONDARY_ACCOUNT_CUSTODIAN` only, within a separate AWS organization boundary | Two-person approval on the affected side, plus written non-objection from the opposite-side custodian and `RETENTION_POLICY_APPROVER`, recorded before any closure request | Same human holding both account-custodian roles; either custodian also holding the opposite side's KMS custodian role; any custodian also holding `CLEANUP_AUTHORIZATION_APPROVER` | AWS Organizations / account-lifecycle audit trail in each organization, plus CloudTrail management events in the affected account |
| `KMS_key_deletion` | `KMS_PRIMARY_CUSTODIAN` only, over the primary key | `KMS_SECONDARY_CUSTODIAN` only, over the secondary key | Two-person approval on the affected side, plus written non-objection from `RETENTION_POLICY_APPROVER`; scheduled-deletion window must exceed the notice period and be observable to the opposite side before it elapses | One human holding both KMS custodian roles; a KMS custodian also holding the same side's account-closure authority; any KMS custodian also holding `CLEANUP_AUTHORIZATION_APPROVER` | CloudTrail management events for `ScheduleKeyDeletion`, `DisableKey`, `PutKeyPolicy` in each custody account, on independent trails |
| `bucket_administration` | `BUCKET_OBJECT_LOCK_ADMINISTRATOR_PRIMARY` | `BUCKET_OBJECT_LOCK_ADMINISTRATOR_SECONDARY` | Change to versioning, Object Lock default retention, bucket policy, or lifecycle requires `RETENTION_POLICY_APPROVER` sign-off; no change may reduce protection for existing object versions | One human administering both buckets; a bucket administrator also holding `CLEANUP_AUTHORIZATION_APPROVER`; a bucket administrator holding a write or read-back execution credential | CloudTrail management events (`PutBucketVersioning`, `PutObjectLockConfiguration`, `PutBucketPolicy`, `PutBucketLifecycleConfiguration`) on independent per-account trails |
| `retention_policy_administration` | `RETENTION_POLICY_APPROVER`, applied identically to both sides | `RETENTION_POLICY_APPROVER`, applied identically to both sides | Extension-only. Any proposed reduction is rejected without review. Adoption of a longer horizon requires notification to both account custodians | `RETENTION_POLICY_APPROVER` also holding account-closure or KMS-deletion authority, or `CLEANUP_AUTHORIZATION_APPROVER` | The ratified policy record plus CloudTrail retention-configuration events on both sides; per-object `retain_until` is additionally recorded in the Phase 1 execution retention manifest |
| `cleanup_authorization` | `CLEANUP_AUTHORIZATION_APPROVER`, acting only on verified evidence from both sides | `CLEANUP_AUTHORIZATION_APPROVER`, acting only on verified evidence from both sides | Emission of the Phase 2 cleanup authorization record requires every condition of architecture selection §10.6 to be independently satisfied and evidenced; approval may never be inferred from uploads, absence of errors, or AMS completion | `CLEANUP_AUTHORIZATION_APPROVER` holding any account, KMS, bucket, or retention administration authority, or any credential that can delete or shorten retention on either side | Both Phase 2 cleanup-authorization copies, plus CloudTrail S3 data events for the writes and read-backs on both independent trails |

### 6.1 Matrix invariant

Reading the matrix by column, no single principal appears as the authority for
the same power on both the primary and the secondary side, and no principal
appears in more than one row's authority column where §5.2 forbids the
combination. That property is what makes the four prohibited outcomes in §5.2
unreachable by one actor.

### 6.2 Audit independence

Each side's audit source is in that side's own account, on its own trail or event
data store, with a lifecycle independent of the execution workspace and of the
other side. A single shared trail would collapse the audit boundary and is
prohibited.

### 6.3 Credential exclusion

No role in §5.1 may hold a runtime write, read-back, manifest, or
cleanup-authorization execution credential as defined in §7. Administration
authority and execution authority are separate by construction.

### 6.4 Account-closure boundary

Preserved explicitly:

```text
S3 Object Lock does not make AWS account closure impossible.
```

Object Lock compliance mode protects an object version from overwrite and
deletion for the duration of that version's retention period. It does not survive
closure or deletion of the AWS account that holds the bucket. Account-closure
authority is therefore governed separately in its own matrix row, is split across
two organizations, and requires opposite-side non-objection.

### 6.5 KMS boundary

Preserved explicitly:

```text
S3 Object Lock does not guarantee ciphertext remains readable if the
corresponding KMS key is destroyed.
```

An object version may remain undeletable while becoming permanently
undecryptable. The two KMS key lifecycles are therefore protected independently:
different keys, different accounts, different custodians, different key policies,
and different trails. No single KMS custodian can render both copies unreadable.

### 6.6 What Object Lock is relied upon for

```text
relied upon: prevention of overwrite of a specific object version before expiry
relied upon: prevention of deletion of a specific object version before expiry
relied upon: prevention of retention shortening before expiry
```

### 6.7 What Object Lock is not relied upon for

```text
NOT relied upon: protection against AWS account closure
NOT relied upon: protection against KMS-key deletion
NOT relied upon: protection against loss of the custodian relationship
NOT relied upon: protection against bucket-administration authority applied to future writes
```

Those residual risks are addressed only by the separation in §5 and §6, and by
gate `G1-NAMED-ASSIGNMENT`. No implementation, runbook, or review may claim
otherwise.

```text
account_closure_authority_separation_status=RATIFIED
kms_deletion_authority_separation_status=RATIFIED
bucket_admin_authority_separation_status=RATIFIED
retention_admin_authority_separation_status=RATIFIED
cleanup_authority_separation_status=RATIFIED
```

---

## 7. Credential-delivery ratification (R3)

### 7.1 Ratified model

```text
credential_model=short-lived, role-based, federated session credentials only
persistent_access_keys_allowed=false
cross_store_single_credential_allowed=false
credential_delivery_status=RATIFIED
```

Implementation and runtime code obtains AWS permissions exclusively by assuming a
narrowly scoped IAM role and receiving temporary session credentials. No
long-lived secret is stored, committed, printed, or handed to an agent.

### 7.2 Absolute prohibitions

```text
AWS access keys committed to Git
credentials embedded in source
credentials embedded in Golden artifacts
credentials embedded in manifests
credentials printed in logs
credentials copied into Claude/Codex prompts
credentials stored in /tmp
one credential capable of writing both primary and secondary stores
```

Each is prohibited without exception. "Manifests" here covers both the Phase 1
execution retention manifest and the Phase 2 cleanup authorization record.

### 7.3 The six ratified execution identities

| Identity | `credential_type` | `trust source` | `scope` | `maximum permissions` | `credential lifetime` | `delivery mechanism` | `rotation/revocation model` | `audit source` |
|---|---|---|---|---|---|---|---|---|
| `primary_store_writer_identity` | Temporary IAM role session | Federated workload identity in the primary evidence account, trust policy constrained to the approved workload principal and external/session condition | Primary account, primary bucket, the exact Golden JSON and authority-evidence key prefixes for the run | `s3:PutObject` and `s3:PutObjectRetention` (set-on-write only) on the scoped prefix; `kms:GenerateDataKey` and `kms:Encrypt` on the primary key | Minimum viable; must not exceed the single retention sequence and must expire before packaging begins | Role assumption at execution start; never materialized to disk, env file, or prompt | Revoked by trust-policy or session-policy change and by session expiry; no rotation of static material because none exists | Primary-account CloudTrail S3 data events plus `AssumeRole` management events |
| `secondary_store_writer_identity` | Temporary IAM role session | Federated workload identity in the **secondary** evidence account, separate trust policy | Secondary account, secondary bucket, same logical key prefixes | Same shape as primary, scoped to the secondary bucket and `kms:GenerateDataKey`/`kms:Encrypt` on the **secondary** key | Same as primary, issued and expiring independently | Independent role assumption; never derived from the primary session | Independent of primary; revoking one does not revoke the other and does not grant the other's authority | Secondary-account CloudTrail, on an independent trail |
| `primary_readback_identity` | Temporary IAM role session | Primary-account federated workload identity, distinct role from the writer | Primary account, primary bucket, exact object keys and `versionId`s written in this run | `s3:GetObject`, `s3:GetObjectVersion`, `s3:GetObjectRetention`, `s3:GetObjectLegalHold`; `kms:Decrypt` on the primary key. No write, no delete, no retention modification | Bounded to the read-back and verification phase | Separate role assumption after writes complete | Session expiry; independently revocable from the writer role | Primary-account CloudTrail S3 data events |
| `secondary_readback_identity` | Temporary IAM role session | Secondary-account federated workload identity, distinct role from the secondary writer | Secondary account, secondary bucket, exact object keys and `versionId`s | Same read-only shape, `kms:Decrypt` on the **secondary** key only | Bounded to the read-back and verification phase | Separate role assumption | Independent of every primary-side identity | Secondary-account CloudTrail, independent trail |
| `manifest_writer_identity` | Two temporary IAM role sessions — one per side, never one session spanning both | Per-account federated workload identity, distinct roles from the evidence writers | Primary or secondary account, the `execution-retention-manifest` key prefix only | `s3:PutObject` and `s3:PutObjectRetention` (set-on-write) restricted to the manifest prefix; `kms:GenerateDataKey`/`kms:Encrypt` on that side's key. No authority over evidence objects | Bounded to Phase 1 manifest write and its read-back | Per-side role assumption after the four evidence copies verify | Per-side session expiry; independently revocable | Per-account CloudTrail S3 data events |
| `cleanup_authorization_writer_identity` | Two temporary IAM role sessions — one per side | Per-account federated workload identity, distinct roles from every identity above | Primary or secondary account, the `cleanup-authorization-record` key prefix only | `s3:PutObject` and `s3:PutObjectRetention` (set-on-write) restricted to the cleanup-authorization prefix; `kms:GenerateDataKey`/`kms:Encrypt` on that side's key. **No** `s3:DeleteObject`, **no** `s3:DeleteObjectVersion`, **no** `s3:BypassGovernanceRetention`, **no** retention shortening, **no** authority over evidence or manifest objects on either side | Bounded to Phase 2 record write and its read-back | Per-side session expiry; independently revocable | Per-account CloudTrail S3 data events, correlated with the Phase 2 record copies |

### 7.4 Least privilege

```text
a primary credential MUST NOT have secondary-store authority
a secondary credential MUST NOT have primary-store authority
a writer credential MUST NOT have read-back authority beyond write confirmation
a read-back credential MUST NOT have write, delete, or retention-modification authority
no credential in §7.3 may shorten retention, bypass Object Lock, or delete an object version
no credential in §7.3 may administer a bucket, a key, an account, or a retention policy
```

Each identity is scoped only to its required account, bucket, key prefix, and KMS
key surface. Cross-store authority in a single credential is prohibited by §7.1
and is independently a copy-independence violation under architecture selection
§5.3.

### 7.5 Cleanup-record authority boundary

The credential capable of creating the `cleanup_authorization_record` must not
itself be sufficient to delete, shorten retention on, or destroy both retained
evidence sides. As specified in §7.3, `cleanup_authorization_writer_identity`
carries write-only authority over one side's cleanup-authorization key prefix and
holds no delete, no retention-modification, and no bypass permission anywhere.

Consequently, possession or compromise of the cleanup-authorization credential
yields the ability to write a record, never the ability to destroy evidence.
Actual workspace cleanup remains gated on two verified Phase 2 copies and on the
`CLEANUP_AUTHORIZATION_APPROVER` role, which by §6.3 holds no execution
credential at all.

### 7.6 Non-secret registration obligation

Every non-secret parameter name, role name, bucket location, and env-var name
used by the above must be registered in `.claude/constants.md`,
`config/constants.ts`, and `.claude/production-parameters.md` before any
implementation PR opens, per readiness contract A1.4 and the repository
Configuration Discipline rules.

That registration is gate `G3-CONSTANT-REGISTRATION`. It is **not** performed by
this document, because no identifier has been ratified yet (gate `G2`), and
inventing one is prohibited.

---

## 8. AMS implementation surface (R4)

Frozen minimum scope in `KeigenTechnologies/ams`, referenced against commit
`3e280b40e67d7d8be0ad163a13cf22e31c770d9a`. Observations below are read-only
findings at that commit. **No AMS file is edited by this document.**

### 8.1 Observed current state at the reference commit

```text
internal/orchestration/pipeline.go :: ExecuteWithRecord is the convergence-capable boundary
five distinct final-decision assignment sites exist, two of which return before the main path
buildAuditRecord(...) is called and its result is discarded
OrchestrationContext carries SessionID, SubjectID, Domain, TraceID — but no WorkspaceID and no SiteID
AcceptedEventScope carries WorkspaceID and SiteID and enforces scope mismatch fail-closed
SubjectAssemblyReport.EventIDs is every yielded ID, including rejected projections
cmd/buyerrecon-report/main.go allocates runID after the Golden JSON is written
cmd/buyerrecon-report/main.go leaves SessionID deliberately empty in GoldenSessionScope
```

These are exactly the gaps enumerated in architecture selection §6.1. They are
recorded here as the implementation starting state, not as new findings.

### 8.2 Frozen AMS responsibilities

| `repository` | `file_or_module` | `responsibility` | `why_authoritative` | `explicitly_not_responsible_for` |
|---|---|---|---|---|
| `KeigenTechnologies/ams` | new `internal/orchestration/publication_ledger.go` | `FinalDecisionPublicationLedger`: construction bound to one immutable scope; `Record()`; typed `DecisionOwner` enum; publication accounting | It is the only place all decision paths can be forced to converge before write-back | Producing scores, deciding policy, writing storage, emitting customer wording |
| `KeigenTechnologies/ams` | new `internal/orchestration/publication_ledger.go` | Publication-path **registration**: every possible final-decision path declares itself to the ledger before the pipeline branches | Convergence cannot be proven without knowing the complete set of possible publishers | Inferring paths from observed behaviour or from an absence of publications |
| `KeigenTechnologies/ams` | new `internal/orchestration/publication_ledger.go` | Duplicate detection: publication after the first whose decision **and** typed owner both equal the first | Duplicate counting is only meaningful inside the single accounting scope | Deduplicating across runs, sessions, or scopes |
| `KeigenTechnologies/ams` | new `internal/orchestration/publication_ledger.go` | Conflict detection: publication after the first whose decision **or** typed owner differs, including same-decision-different-owner | Sole ownership is contradicted by owner divergence, not only by decision divergence | Resolving conflicts, choosing a winner, or suppressing a conflicting record |
| `KeigenTechnologies/ams` | new `internal/orchestration/publication_ledger.go` | Convergence/closure tracking: each registered path is `converged` or `excluded`; anything open, pending, or unaccounted blocks closure | Zero-count and sole-ownership claims are claims about the complete publication set | Timing optimisation, best-effort closure, or closing on a timeout |
| `KeigenTechnologies/ams` | new `internal/orchestration/publication_ledger.go` | `Finalize()` guard: fails closed unless every registered path is converged or excluded; counts and owner immutable at closure; late publication is a fatal governance error | Closure is the moment authority claims become immutable | Emitting evidence, serializing bytes, or writing to storage |
| `KeigenTechnologies/ams` | `internal/orchestration/pipeline.go` (`ExecuteWithRecord`, line ~111) | Route **all five** existing final-decision sites through the ledger, including the pre-engine `DUPLICATE_TRACE` and `CONFIG_RESOLUTION_FAILED` early returns; invoke `Finalize()` after branch convergence and before Step 13 Trust write-back | It is the selected producer boundary and the only site atomically coupled to the branch that actually ran | Adding scoring logic, altering decision semantics, or performing retention |
| `KeigenTechnologies/ams` | new `internal/orchestration/authority_evidence.go` | Deterministic execution-authority evidence serialization; canonical byte ordering; evidence emitted separately from Golden JSON | Serialization must be reproducible for hash comparison at the backend | Deciding qualification, storing bytes, or rendering customer output |
| `KeigenTechnologies/ams` | new `internal/orchestration/authority_evidence.go` | Canonical evidence hashing: SHA-256 and byte count over the canonical serialization, computed after closure | The digest must correspond to exactly the bytes handed to retention | Read-back verification, which belongs to the backend retention coordinator |
| `KeigenTechnologies/ams` | new `internal/contracts/authority_evidence.go` | Closed evidence schema: claims, typed owner enum, identity envelope, producer provenance, counts | A closed schema is what makes backend defaulting impossible | Backend repair, defaulting, or a second decision authority |
| `KeigenTechnologies/ams` | `internal/contracts/orchestration.go` | Immutable `GoldenExecutionIdentity`; add `WorkspaceID` and `SiteID` as distinct fields at the decision boundary | `OrchestrationContext` currently lacks both; `Domain` inference is prohibited | Carrying credentials, storage identifiers, or authority wording |
| `KeigenTechnologies/ams` | `internal/contracts/orchestration.go` | Producer identity: fixed producer name plus full 40-hex AMS build commit from immutable build metadata | Provenance must be validated at ledger construction, not asserted later | Accepting an operator-supplied or overridden SHA |
| `KeigenTechnologies/ams` | `internal/products/buyerrecon/adapter/accepted_event_row.go` | Expose accepted/projected event IDs **separately** from rejected IDs; preserve exact workspace/site/subject/session scope equality | `SubjectAssemblyReport.EventIDs` currently includes every yielded ID including rejected projections | Reconstructing rejected or deleted events; packaging inference |
| `KeigenTechnologies/ams` | `cmd/buyerrecon-report/main.go` | Allocate `AMS_run_id` **once, before** any query or pipeline execution; bind exact non-empty `session_id`; construct the immutable identity and pass it atomically | `runID` is currently allocated after the Golden JSON is written, and `SessionID` is left empty | Storage writes, retention qualification, cleanup, or authority wording |
| `KeigenTechnologies/ams` | `cmd/buyerrecon-report/main.go`; `internal/products/buyerrecon/report/golden_session.go` | Exact execution linkage: same identity in Golden JSON and evidence; handoff of both byte streams plus their digests to the retention layer | One producer, two separately retained authoritative objects | Writing to S3, verifying read-back, or authorizing cleanup |
| `KeigenTechnologies/ams` | `internal/policy/pass2.go` (`ResolveFinal`, line 47) | Remain a policy sub-boundary supplying authoritative Pass 2 facts consumed atomically by the ledger | It cannot see competing publications or exact execution identity from inside a pure function | Being a second evidence producer or emitting evidence directly |
| `KeigenTechnologies/ams` | `internal/orchestration/audit.go` (`buildAuditRecord`, line 16) | Remain diagnostic. Its result must not be treated as a publication or as authority evidence | Its output is currently discarded and was never an accounting primitive | Publication counting, duplicate/conflict detection, or authority qualification |

```text
ams_implementation_surface_status=FROZEN
```

---

## 9. Backend implementation surface (R4)

Frozen minimum scope in `KeigenTechnologies/buyerrecon-backend` at base
`3b0a9699eb728b0260b56a54b4c39ffb21876ba1`. **No backend source file is edited by
this document.**

```text
backend is NOT the Policy Pass 2 authority producer
backend is a consumer and validator only
```

| `repository` | `file_or_module` | `responsibility` | `why_authoritative` | `explicitly_not_responsible_for` |
|---|---|---|---|---|
| `buyerrecon-backend` | new `src/reports/external/policy-pass-2-authority-evidence.ts` | Authority-evidence **schema**: closed structural contract mirroring the AMS schema; no optional fields with silent defaults | The validator must reject, never repair | Producing evidence or supplying any missing field |
| `buyerrecon-backend` | new `src/reports/external/policy-pass-2-authority-evidence.ts` | Authority-evidence **validation**: strict schema, recomputed SHA-256 over received bytes, byte-count equality, typed owner literal, counts | Validation is the backend's only authority-related power | Defaulting, repairing, inferring, or upgrading a nonqualifying object |
| `buyerrecon-backend` | new `src/reports/external/policy-pass-2-authority-evidence.ts` | Identity linkage validation against workspace, site, subject, session, AMS run, and sorted accepted source-event set | Linkage failure means the evidence is not about this execution | Reconstructing identity from filenames, prose, or operator input |
| `buyerrecon-backend` | new `src/reports/external/policy-pass-2-authority-evidence.ts` | Authority-qualifying **predicate**: all seven §3.5 conditions true, else `policy_pass_2_authority_verified=false` and `policy_pass_2_acceptance_readiness=BLOCKED` | A single predicate prevents partial qualification drifting into wording | Deciding packaging layout or customer presentation |
| `buyerrecon-backend` | `src/reports/external/ams-existing-run.ts` | Neutral wording fallback; resolve Golden JSON from the durable object identifier rather than a local path. Existing `POLICY_PASS_2_AUTHORITY_VERIFIED=false`, `GOLDEN_JSON_EMBEDDED_RUN_ID=false`, `CRYPTOGRAPHIC_LINKAGE=false`, `EMBEDDED_RUN_LINKAGE=false` constants are the current fail-closed defaults and must only become dynamic through the validator | The neutral sentence is the default state, not an error state | Emitting authority wording on its own judgement |
| `buyerrecon-backend` | `src/reports/external/safe-claims.ts` | Continue enforcing forbidden phrasing and customer-safe text for any wording derived from evidence | Wording enforcement already exists and must not be bypassed | Deciding authority qualification |
| `buyerrecon-backend` | new `src/reports/external/golden-session-retention.ts` | Artifact-retention client/orchestration: write 2 Golden JSON copies and 2 authority-evidence copies to the two independent stores; per-copy write confirmation | Retention is a backend responsibility; evidence production is not | Producing AMS authority facts or altering AMS-produced bytes |
| `buyerrecon-backend` | new `src/reports/external/golden-session-retention.ts` | Read-back verification: full `GetObject` by exact bucket, key, and `versionId`; stream every byte; recompute SHA-256 and byte count. `HEAD`/ETag is insufficient | The `ses_x0vrbqik` failure is precisely a verified-then-lost copy | Trusting upload responses or write-time digests |
| `buyerrecon-backend` | new `src/reports/external/golden-session-retention.ts` | Phase 1 manifest construction and validation: per-copy identity, four separate retention expiries, `cleanup_authorized=false`, digest with only `record_sha256` excluded; store and verify 2 copies | The Phase 1 record is the evidence-of-retention primitive | Claiming cleanup authorization or mutating any stored version |
| `buyerrecon-backend` | new `src/reports/external/golden-session-retention.ts` | Cleanup-gate validation: evaluate every condition of architecture selection §10.6; emit the Phase 2 record only on full pass; store and verify 2 copies | The gate is the only path to cleanup | Inferring authorization from uploads, absence of errors, or AMS completion |
| `buyerrecon-backend` | `scripts/run-golden-session.ts` | Drive the frozen 13-step lifecycle; refuse cleanup until both Phase 2 copies are read back and verified; exit non-zero on any gate failure | It is the existing runner and the only place cleanup could be triggered | Unconditional execution-directory removal; degraded or single-copy retention modes |
| `buyerrecon-backend` | `src/reports/external/golden-session-package.ts` | Packaging consumption: resolve immutable objects by exact version; emit authority wording only for fully qualifying evidence; retain `validateAmsGoldenSessionJson` and identity-expectation checks | Packaging is downstream of both AMS and retention | Evidence production, retention bypass, or authority inference from output |

```text
backend_implementation_surface_status=FROZEN
```

---

## 10. Infrastructure implementation surface (R4)

Frozen as a required-properties surface. **Nothing here is provisioned, created,
named, or credentialed by this document.**

### 10.1 Required resources and mandatory properties

| Resource | Mandatory properties | Assignment gate |
|---|---|---|
| Primary AWS evidence account | Dedicated to evidence custody; separate AWS organization boundary from secondary; owned by `EVIDENCE_PRIMARY_ACCOUNT_CUSTODIAN`; closure governed per §6 | `G2` |
| Secondary AWS evidence account | Dedicated; different account **and** different organization boundary from primary; owned by `EVIDENCE_SECONDARY_ACCOUNT_CUSTODIAN` | `G2` |
| Primary S3 bucket | In the primary account and a ratified primary region; Block Public Access; bucket-owner-enforced ownership; never mounted in the execution host | `G2` |
| Secondary S3 bucket | In the secondary account and a **different** region; independently administered; same protective posture | `G2` |
| Object Lock compliance configuration | Enabled in **compliance** mode on both buckets at creation; governance mode is not acceptable; default retention consistent with `BR-GOLDEN-EVIDENCE-RETENTION-V0_1` | `G2` |
| Bucket versioning | Required and permanently enabled on both buckets; Object Lock depends on it | `G2` |
| Primary KMS key | Customer-managed key in the primary account; key policy administered by `KMS_PRIMARY_CUSTODIAN`; used only by primary-side identities | `G2` |
| Secondary KMS key | Customer-managed key in the secondary account; **different key**, different custodian, different policy | `G2` |
| IAM roles and trust policies | Six execution identities per §7.3, split across the two accounts; federated trust; no static keys; no cross-store authority | `G2` |
| CloudTrail / audit configuration | Independent trail or event data store per account, covering S3 object writes, reads, retention operations, attempted deletes, and the KMS and bucket management events named in §6; lifecycle independent of the execution workspace and of the other side | `G2` |
| Retention policy | `BR-GOLDEN-EVIDENCE-RETENTION-V0_1` applied to all eight object versions; extend-only | Ratified in §4 |
| Primary/secondary custodians | The nine roles of §5.1, assigned to named humans satisfying §5.3 | `G1` |

### 10.2 Independence assertion

The primary and secondary sides must differ on **every** boundary below; sharing
any one is a copy-independence violation and fails retention readiness:

```text
AWS account
AWS region
S3 bucket
IAM administration boundary and execution credential
KMS key
Object Lock configuration
lifecycle rule
audit stream
named custodian and account-closure authority
cleanup path
```

### 10.3 Not provisioned

```text
aws_resources_provisioned=false
accounts_created=false
buckets_created=false
kms_keys_created=false
iam_roles_created=false
cloudtrail_trails_created=false
credentials_created=false
```

### 10.4 Registration obligation (`G3-CONSTANT-REGISTRATION`)

Before any implementation PR opens, every non-secret store location, parameter
name, role name, and env-var name must be registered in:

```text
.claude/constants.md
config/constants.ts
.claude/production-parameters.md
```

per readiness contract A1.4 and the repository Configuration Discipline rules.
No such value is registered here, because none has been ratified (gate `G2`) and
inventing one is prohibited.

```text
infrastructure_implementation_surface_status=FROZEN
```

---

## 11. Static gates

Minimum static controls required to prevent regression of the ratified
architecture. Existing gates are reused; new gates are named as obligations, not
implemented here.

| Regression to prevent | Gate | Status |
|---|---|---|
| Ephemeral canonical artifact storage | New `check:golden-artifact-durability` — reject any canonical artifact path resolving to `/tmp`, `/private/tmp`, a scratchpad, an execution directory, or a disposable worktree | New; obligation frozen |
| Single-account primary/secondary collapse | New `check:evidence-store-independence` — reject configuration where primary and secondary resolve to the same account, region, or bucket constant | New; obligation frozen |
| Same KMS key on both copies | `check:evidence-store-independence` — reject a shared key constant across the two sides | New; obligation frozen |
| Missing Object Lock | `check:evidence-store-independence` — reject a store definition lacking compliance-mode Object Lock or versioning | New; obligation frozen |
| Cleanup before a verified Phase 2 record | New `check:cleanup-gate` — reject unconditional execution-directory removal in `scripts/`, and reject any cleanup path not guarded by verified Phase 2 copies | New; obligation frozen (readiness contract §7.4 candidate, §12 follow-up) |
| Backend-generated Pass 2 authority | `check:customer-output-boundary`, extended — authority wording must remain reachable only through the validator predicate | Existing gate, extension frozen |
| Operator-supplied authority claims | `check:customer-output-boundary`, extended — reject operator booleans, `RequestedAction`, run ID alone, or replay-card existence as authority inputs | Existing gate, extension frozen |
| Unregistered store/credential names | `check:constants` | Existing gate, unchanged |
| Persistent or embedded AWS credential secrets | New `check:aws-credential-secrets` — fail closed when persistent AWS credential material is committed or embedded in repository-controlled runtime, configuration, manifest, artifact-fixture, documentation-example, or generated-evidence-template surfaces | New; obligation frozen as `DEFINED` / `REQUIRED`; not implemented or verified |
| One identity or credential controls both evidence stores | New `check:cross-store-credential-authority` — validate registered identity-to-store authority and fail closed when one runtime identity unexpectedly spans both primary and secondary evidence stores | New; obligation frozen as `DEFINED` / `REQUIRED`; not implemented or verified |
| Producer drift away from the selected boundary | New `check:authority-producer-boundary` — reject a second evidence producer or a backend-side producer | New; obligation frozen |
| Runtime drift on L1 surfaces | `check:no-runtime-imports`, `check:static-boundaries` | Existing gates, unchanged |

### 11.1 Credential static-gate obligations

Exactly two credential static-gate obligations are frozen here. They preserve
the credential model ratified in §7; they do not implement a checker or claim a
passing result.

**Persistent or embedded credential-secret gate.**

```text
credential_static_gate_persistent_secret_status=REQUIRED
credential_static_gate_persistent_secret_implementation_status=NOT_IMPLEMENTED
credential_static_gate_persistent_secret_verification_status=NOT_VERIFIED
```

The future gate must fail closed when repository-controlled runtime or
configuration surfaces contain persistent AWS credential material. Its minimum
rejection contract is:

```text
AWS access key IDs committed to source or tracked configuration
AWS secret access keys
AWS session-token literals persisted in tracked files
long-lived static credential pairs
credentials embedded in source code
credentials embedded in manifests or artifact fixtures
credentials embedded in runtime configuration committed to Git
credentials written into documentation examples as real values
credentials written into generated evidence templates as literal secrets
```

The checker implementation must define exact secret-pattern and allowlist
behaviour. It must distinguish authentic secret material from harmless,
non-secret resource and configuration identifiers. AWS account IDs, bucket
names, IAM role ARNs, KMS key ARNs, CloudTrail identifiers, environment-variable
names, and clearly marked placeholder/example values must not fail merely for
being AWS-shaped identifiers.

```text
No persistent AWS credential secret may be committed, embedded, or registered
as a BuyerRecon implementation constant.

credential_model=short-lived, role-based, federated session credentials only
persistent_access_keys_allowed=false
```

**Cross-store credential-authority gate.**

```text
credential_static_gate_cross_store_authority_status=REQUIRED
credential_static_gate_cross_store_authority_implementation_status=NOT_IMPLEMENTED
credential_static_gate_cross_store_authority_verification_status=NOT_VERIFIED
one_identity_controls_both_evidence_stores=false
```

The future gate must validate registered identity-to-store authority and fail
closed when any unexpected cross-store authority exists. The frozen assertions
are:

```text
primary writer cannot write the secondary evidence store
secondary writer cannot write the primary evidence store
primary read-back identity cannot read the secondary evidence store
secondary read-back identity cannot read the primary evidence store
no manifest writer may receive unrestricted primary plus secondary evidence-object administration
no cleanup-authorization identity may possess destructive or retention-shortening authority over both stores
```

The gate may evaluate ratified constants and registries, IAM policy fixtures,
infrastructure definitions, role-to-store mappings, or generated policy
documents. The exact mechanism belongs to the future implementation PR. Any
unexpected cross-store authority fails implementation qualification; it cannot
be accepted as a warning or manually defaulted to pass.

### 11.2 Relationship to `G2` and `G3`

The credential static gates are frozen as implementation obligations now. They
are not implemented, not verified, and do not pretend that unresolved resource
or role bindings can be fully evaluated today.

```text
G2-RESOURCE-IDENTIFIER=OPEN
G3-CONSTANT-REGISTRATION=OPEN

G2 resource identities are ratified
→ G3 constants/registries are populated
→ implementation static gates are implemented
→ concrete resource/role bindings become enforceable
```

Neither open gate is advanced by this section. The two static-gate obligations
remain blocking for future implementation qualification, not evidence that any
AWS resource, identity, credential, or checker already exists.

Every new gate is L1/static. None may claim to prove runtime behaviour, DB role
binding, worker behaviour, L2, or L3.

```text
static_gate_surface_status=FROZEN
```

---

## 12. Mandatory test matrix

Carried forward and frozen. All cases are mandatory, non-production, and
non-executing with respect to a real Golden Session. None may connect to
production, run a real browser, invoke production AMS, or reconstruct
`ses_x0vrbqik`.

### 12.1 A1 — mandatory

```text
primary-copy write failure
secondary-copy write failure
primary read-back failure
secondary read-back failure
SHA-256 mismatch
byte-count mismatch
manifest write failure
manifest contradiction
premature cleanup rejection
artifact survival after execution-directory deletion
primary-store outage
secondary-store outage
Object Lock missing
Object Lock misconfigured
governance instead of required compliance mode
versioning absent
retention mismatch
copy-independence violation
same-account violation
same-region violation
same-bucket violation
same-IAM-authority violation
same-KMS-key violation
same-custodian violation
cleanup-path collapse
Phase 2 record missing
Phase 2 record mismatch
digest-exclusion regression
immutable-record mutation attempt
```

"manifest write failure" and "manifest contradiction" apply to the **Phase 1
execution retention manifest**; the Phase 2 cases are named separately above.
Each copy-independence sub-case is exercised as its own case; a single combined
fixture does not satisfy the requirement.

```text
mandatory_a1_test_matrix_status=FROZEN
```

### 12.2 B3 — mandatory

```text
missing evidence
invalid evidence schema
wrong workspace linkage
wrong site linkage
wrong subject linkage
wrong session linkage
wrong AMS-run linkage
source-event mismatch
Pass 2 not executed
final decision unverified
sole ownership false
wrong owner literal
duplicate final-decision evidence
conflicting final-decision evidence
invalid evidence hash
neutral wording fallback
Policy Pass 2 wording only after fully qualifying evidence

premature Finalize
late duplicate publication after attempted premature Finalize
late conflicting publication after attempted premature Finalize
unclosed publisher at Finalize
publisher-registration mismatch
```

`publisher-registration mismatch` covers the case where the set of paths
registered with the ledger does not equal the set of paths the pipeline can
actually take — including the two pre-engine early returns observed in §8.1. It
fails closed.

```text
mandatory_b3_test_matrix_status=FROZEN
```

### 12.3 Matrix authority

Every mandatory A1 and B3 case must pass before either workstream may be
classified as `INDEPENDENTLY_VERIFIED`, and before any replacement-session
execution authorization may be considered. A passing subset is not qualification.

---

## 13. Non-production qualification plan

### 13.1 Permitted activity before Workstream B is `INDEPENDENTLY_VERIFIED`

Per readiness contract §6.1, limited to:

```text
non-executing schema validation
unit fixtures
mocked tests
non-production dry runs that do not create a real browser session
non-production dry runs that do not invoke AMS
```

These are qualification inputs, not replacement Golden Sessions. They must not
consume or reserve replacement-session identities.

### 13.2 Fixture environment

| Concern | Ratified approach |
|---|---|
| Object store | Non-production fakes, emulators, or isolated test stores only. Never a production bucket, never a real evidence account |
| Credentials | No real AWS credential is used. Fixtures inject stub identities that model the §7.3 scope boundaries, including their prohibitions |
| AMS | AMS orchestration and contract tests run in-repo against fixtures. Production AMS is never invoked |
| Golden Session | The closed session is never reconstructed. Fixtures use synthetic identities that cannot collide with `ses_x0vrbqik`, `brw_dnrzh1ta`, events 51–59, or run `9005b50c-e37e-4e78-81c0-a3ec94f4f9f9` |
| Database | No production DB. Mock, fixture, or test database only |

### 13.3 Required qualification evidence

Qualification passes only when all of the following are demonstrated against
fixtures:

```text
all eight object versions individually tracked with their eight required fields
Phase 1 manifest produced only after four evidence copies verify
Phase 1 manifest carries cleanup_authorized=false and four separate retention expiries
Phase 2 record produced only after every §10.6 gate condition passes
cleanup blocked until both Phase 2 copies are read back and verified
no in-place mutation of any immutable object version
digest computed with only the record's own digest field excluded
retained-object survival after disposable-workspace deletion
authority evidence never emitted as qualifying before ledger closure
Finalize() fails closed with any registered path open, pending, or unaccounted
neutral wording is the default and authority wording requires all seven conditions
```

### 13.4 Layer classification

```text
qualification_layers=L1 static + L2 fixture/integration in non-production only
L3_required=false for qualification
L3_required=true only for the later replacement Golden Session, under its own separate authorization
```

If a required L2 case cannot be run because no safe test environment exists, that
gap must be documented and the work remains L1/static-only. It must not be
silently escalated.

```text
non_production_qualification_plan_status=FROZEN
```

---

## 14. Governance sequence

### 14.1 Frozen order

```text
1.  implementation-readiness ratification            <- this document
2.  independent ratification review
3.  separate implementation authorization
4.  AWS/storage provisioning under explicit authorization
5.  implementation branches/PRs
6.  implementation tests
7.  independent implementation review
8.  non-production fixture qualification
9.  retained-object survival test after disposable workspace deletion
10. authority-evidence qualification
11. cleanup-gate qualification
12. replacement Golden Session execution authorization
```

No step automatically authorizes the next. Each transition requires its own
explicit authorization. This document is step 1 only.

### 14.2 Gate closure required before step 3

```text
G1-NAMED-ASSIGNMENT      named humans assigned to all nine roles, §5.3 satisfied
G2-RESOURCE-IDENTIFIER   accounts, regions, buckets, KMS keys, IAM roles, trails ratified
G3-CONSTANT-REGISTRATION non-secret names registered in the three registry files
AMS base re-pinned and drift-reviewed
```

All four are blocking. Step 3 may not be reached with any of them open.

### 14.3 Relationship to the prior frozen sequences

This sequence is consistent with readiness contract §10 and architecture
selection §14.2. Where those sequences begin at their own docs-only step, this
document occupies the position immediately after architecture-selection merge and
immediately before independent ratification review. It introduces no new
authority and removes no prior gate.

```text
governance_sequence_status=FROZEN
```

---

## 15. Explicit prohibitions

This ratification does not permit:

```text
implementing any AMS or backend change described in §8 or §9
provisioning any account, region, bucket, KMS key, IAM role, trail, or lifecycle
creating, reading, testing, printing, embedding, or committing credentials
registering invented constants, env-var names, account IDs, or bucket names
assigning invented humans to any role in §5.1
treating role ratification as owner ratification
treating readiness PASS as implementation authorization
treating readiness PASS as provisioning authorization
treating readiness PASS as replacement-session execution authorization
editing AMS, backend application code, tests, runtime configuration, or infrastructure
running a proof of concept against AMS or any real storage
running a browser, backend worker, AMS invocation, packaging, or deployment
accessing staging or application data
moving deployment pointers or restarting services
using backend packaging as the authority producer
using ResolveFinal alone as the authority producer
shortening, bypassing, or downgrading Object Lock compliance retention
claiming Object Lock mitigates AWS account closure or KMS-key deletion
inferring cleanup authorization from uploads, absence of errors, or AMS completion
rewriting, patching, or updating any immutable retained object version in place
reopening PR #441, PR #442, or PR #443
reopening, retrying, reconstructing, reusing, or reclassifying ses_x0vrbqik
```

---

## 16. Final readiness record

```text
status=REPLACEMENT_GOLDEN_SESSION_IMPLEMENTATION_READINESS_RATIFICATION_V0_1
implementation_readiness_ratification_status=PASS

repository=KeigenTechnologies/buyerrecon-backend
base_branch=sprint2-architecture-contracts-d4cc2bf
base_sha=3b0a9699eb728b0260b56a54b4c39ffb21876ba1

a1_selection_status=PRESERVED
selected_storage_design=AWS_S3_DUAL_ACCOUNT_DUAL_REGION_OBJECT_LOCK_COMPLIANCE_EVIDENCE_VAULT
b3_selection_status=PRESERVED
selected_producer_boundary=KeigenTechnologies/ams@3e280b40e67d7d8be0ad163a13cf22e31c770d9a::internal/orchestration.Pipeline.ExecuteWithRecord::FinalDecisionPublicationLedger.Finalize_after_all_decision_paths_converge_before_Step_13_writeback
producer_boundary_drift_since_selection=NONE

R1_retention_policy_status=RATIFIED
retention_policy_id=BR-GOLDEN-EVIDENCE-RETENTION-V0_1
policy_class=operational_retention_policy
minimum_retention_duration=730_calendar_days
retention_start_event=object_version_creation
retention_expiry_rule=max(object_created_at+730d, execution_authorization.retention_expires_at)
extension_rule=extend_only
early_deletion_allowed=false

R2_owner_custodian_model_status=RATIFIED
account_closure_authority_separation_status=RATIFIED
kms_deletion_authority_separation_status=RATIFIED
bucket_admin_authority_separation_status=RATIFIED
retention_admin_authority_separation_status=RATIFIED
cleanup_authority_separation_status=RATIFIED
named_assignment_status=PENDING_G1_NAMED_ASSIGNMENT_GATE

R3_credential_delivery_status=RATIFIED
primary_store_writer_identity_model=short_lived_federated_role_session_primary_account_scoped
secondary_store_writer_identity_model=short_lived_federated_role_session_secondary_account_scoped
primary_readback_identity_model=short_lived_federated_role_session_read_only_primary
secondary_readback_identity_model=short_lived_federated_role_session_read_only_secondary
manifest_writer_identity_model=short_lived_federated_role_session_per_side_manifest_prefix_only
cleanup_authorization_writer_identity_model=short_lived_federated_role_session_per_side_write_only_no_delete_no_retention_modification
persistent_access_keys_allowed=false
cross_store_single_credential_allowed=false

R4_ams_implementation_surface_status=FROZEN
R4_backend_implementation_surface_status=FROZEN
R4_infrastructure_implementation_surface_status=FROZEN
R4_static_gate_surface_status=FROZEN

R5_mandatory_a1_test_matrix_status=FROZEN
R5_mandatory_b3_test_matrix_status=FROZEN
R5_non_production_qualification_plan_status=FROZEN
R5_governance_sequence_status=FROZEN

two_phase_record_model_status=PRESERVED
eight_object_lifecycle_status=PRESERVED
policy_pass_2_qualification_conditions_status=PRESERVED
authority_wording_boundary_status=PRESERVED
backend_consumer_only_boundary_status=PRESERVED

open_gate_count=4
open_gates=G1-NAMED-ASSIGNMENT,G2-RESOURCE-IDENTIFIER,G3-CONSTANT-REGISTRATION,AMS-BASE-REPIN

implementation_authorized=false
aws_provisioning_authorized=false
credential_creation_authorized=false
replacement_session_execution_authorized=false
browser_execution_authorized=false
AMS_execution_authorized=false
packaging_authorized=false

aws_resources_provisioned=false
credentials_created=false
storage_provisioned=false
producer_implemented=false
source_code_modified=false
tests_modified=false
runtime_configuration_modified=false
deployment_changed=false
```

Implementation readiness is ratified at the documentation level only. The
resulting docs-only PR is eligible for exactly one personnel-independent
docs-only ratification review. It authorizes no implementation, no AWS
provisioning, no credential creation, and no replacement-session execution.

---

**End of implementation readiness ratification v0.1.**
