# Replacement Golden Session — Architecture Selection v0.1

`STATUS = REPLACEMENT_GOLDEN_SESSION_ARCHITECTURE_SELECTION_V0_1`

## 1. Status and authority

This document completes exactly the two architecture choices required by the
merged Replacement Golden Session Readiness Contract v0.1:

```text
A1-SELECT — one durable authoritative artifact-storage design
B3-SELECT — one canonical Policy Pass 2 execution-authority evidence producer
```

The choices are selected architecture, not implemented capability:

```text
durable_storage_selection_status=SELECTED
authority_evidence_producer_selection_status=SELECTED
storage_provisioned=false
producer_implemented=false
implementation_authorized=false
replacement_session_execution_authorized=false
browser_execution_authorized=false
AMS_execution_authorized=false
packaging_authorized=false
```

The state of each selection is exactly:

```text
selected=true
implemented=false
independently_reviewed=false
non_production_qualified=false
authorized_for_execution=false
```

Merging this document would advance the two selection statuses from `PENDING`
to `SELECTED`. It would not advance either workstream to `IMPLEMENTED`,
`INDEPENDENTLY_VERIFIED`, or `AUTHORIZED_FOR_EXECUTION`.

---

## 2. Canonical baseline

### 2.1 BuyerRecon backend

```text
repository=KeigenTechnologies/buyerrecon-backend
base_branch=sprint2-architecture-contracts-d4cc2bf
base_sha=00f1234fa7fb47f770b84869d42ca6be7d00de30
readiness_contract=docs/architecture/replacement-golden-session-readiness-contract-v0.1.md
readiness_contract_merge_commit=00f1234fa7fb47f770b84869d42ca6be7d00de30
readiness_contract_merge_parent_1=a0fd148b43db7d1ac1bb1e98d2265a975451c4ba
readiness_contract_merge_parent_2=5ea78156e70406b6a01e2db8fd7ff1517999b810
```

Remote verification before this selection confirmed that the base was still at
the exact merge commit, the readiness contract existed at the canonical path,
and PR #442 was merged.

### 2.2 Exact AMS code baseline

```text
repository=KeigenTechnologies/ams
canonical_commit=3e280b40e67d7d8be0ad163a13cf22e31c770d9a
canonical_branch_at_inspection=main
topic_branch=buyerrecon-golden-session-v0-1-runtime-output
topic_branch_tip_at_inspection=40d97833f7af577d0b198a1180eaa9557ea31818
topic_branch_relation=ancestor_of_canonical_commit_by_5_commits
```

The B3 analysis is pinned to the full canonical commit, not to a moving branch
label. A future implementation PR must re-pin its AMS base and prove that the
selected observation boundary has not drifted.

### 2.3 Capability discovery result

Repository discovery found no object-store integration, provisioned object-store
configuration, or documented off-host volume with an independent failure domain.
The production checkout path is not evidence of authoritative storage. Existing
governance requires repositories to contain only non-secret names and custody
rules; credential values remain in approved secret custody. Existing static
gates cover registered constants and customer-output boundaries.

Storage provisioning and credentials therefore remain future dependencies. They
do not prevent selection of an implementable storage architecture.

### 2.4 Provider capability sources

The selected C2 design relies on these current official AWS capabilities:

- [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
  requires versioning and provides WORM retention; compliance mode prevents an
  object version from being overwritten or deleted during its retention period.
- [S3 bucket policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)
  and [S3 IAM policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-policy-language-overview.html)
  provide restricted resource- and identity-based access, including explicit
  cross-account grants.
- [S3 Object Lock management](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-managing.html)
  exposes retention metadata through `HeadObject`/`GetObject` and supports
  Object Lock with encryption.
- [CloudTrail S3 data events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-events.html)
  can record object-level `PutObject`, `GetObject`, and `DeleteObject` activity.

These citations establish product capabilities only. No AWS account, region,
bucket, key, role, credential, or trail is created or selected by identifier here.

---

## 3. Closed-session boundary

The prior session remains permanently closed:

```text
workspace_id=buyerrecon_staging_ws
site_id=buyerrecon_com
browser_id=brw_dnrzh1ta
session_id=ses_x0vrbqik
AMS_run_id=9005b50c-e37e-4e78-81c0-a3ec94f4f9f9
engineering_execution_status=COMPLETE
customer_package_status=UNRECOVERABLE
customer_package_failure_classification=AUTHORITATIVE_ARTIFACT_RETENTION_FAILURE
session_closed=true
session_retry_authorized=false
AMS_retry_authorized=false
browser_retry_authorized=false
golden_session_acceptance_status=NOT_ASSESSED
acceptance_claimed=false
```

This selection does not reopen, retry, reconstruct, reuse, or reclassify that
session. The deleted Golden JSON must not be reconstructed. Its browser,
session, event, and AMS-run identities must not be reused. It must never be
represented, described, marketed, or recorded as accepted, and it must not be
used as a fixture that requires recreation of the deleted artifact.

---

## 4. A1 candidate evaluation

The readiness contract bounded A1 to candidates C1, C2, and C3. This decision
does not introduce a fourth candidate.

| Candidate | Decision | Evidence and reason |
|---|---|---|
| `C1` — durable host directory outside the execution tree | Rejected | The repository establishes a production checkout path but supplies no evidence of a separately durable mount, independent local disk, off-host replica, or cleanup-independent retention owner. Selecting C1 would require guessing the host failure and backup boundaries. |
| `C2` — S3-compatible object storage | **Selected** | Amazon S3 provides stable versioned object identity, full-object read-back, restricted policy-based access, WORM Object Lock retention, and object-level audit events. Two buckets in separate AWS accounts and regions provide independent administrative, credential, bucket, KMS-key, region, and lifecycle boundaries. |
| `C3` — dedicated evidence repository or release asset | Rejected | The readiness contract classified it as only partially conforming. Discovery did not establish approval to retain internal scoring/customer artifacts in VCS or releases, independent retention ownership, or a lifecycle suitable for both authoritative copies. |

There is exactly one selected A1 design. C1 and C3 are not fallback modes.

---

## 5. A1 selected design

### 5.1 Final A1 selection

```text
durable_storage_selection_status=SELECTED
selection_id=A1-C2-AWS-S3-DUAL-ACCOUNT-DUAL-REGION-OBJECT-LOCK-V0_1
selected_storage_design=AWS_S3_DUAL_ACCOUNT_DUAL_REGION_OBJECT_LOCK_COMPLIANCE_EVIDENCE_VAULT
storage_design_name=Amazon S3 dual-account dual-region Object Lock compliance-mode evidence vault
primary_authoritative_store=dedicated primary-account primary-region S3 Object Lock compliance bucket
secondary_verification_store=separate secondary-account secondary-region S3 Object Lock compliance bucket
storage_provisioned=false
storage_implementation_authorized=false
```

This is one integrated C2 design. It requires an independently administered
primary bucket and secondary bucket; it is not a menu from which an implementer
may choose only one bucket.

### 5.2 Required selection fields

| Field | Selected value |
|---|---|
| `primary_store_type` | Amazon S3 general-purpose bucket with Versioning and Object Lock enabled in compliance mode |
| `primary_store_location_class` | Dedicated evidence-custody bucket in the primary evidence AWS account and a ratified primary AWS region; never mounted inside the execution host |
| `primary_object_naming_scheme` | `golden-sessions/v0.1/<workspace_id>/<site_id>/<session_id>/<AMS_run_id>/<object_kind>/<sha256>.<ext>` plus immutable S3 `versionId`; `object_kind` is `golden-json`, `authority-evidence`, or `retention-manifest` |
| `primary_owner` | `PENDING_RATIFICATION`: one named human primary evidence custodian; never the execution agent or runtime role |
| `primary_access_control_model` | Block Public Access; bucket-owner-enforced ownership; least-privilege write/read-back role; separate custodian read/review role; no delete or retention-bypass permission in the execution role |
| `primary_retention_period` | Minimum 730 calendar days per immutable object version |
| `primary_retention_expiry_rule` | `retain_until=max(object_created_at+730d, execution_authorization.retention_expires_at)`; a missing or shorter authorized horizon fails closed |
| `primary_versioning_or_immutability_behavior` | S3 Versioning required; each exact version enters Object Lock compliance mode at write time; retention cannot be shortened; lifecycle expiration must not precede `retain_until` |
| `secondary_store_type` | Amazon S3 general-purpose bucket with Versioning and Object Lock enabled in compliance mode |
| `secondary_store_location_class` | Dedicated evidence-custody bucket in a different AWS account and different AWS region from primary; never mounted inside the execution host |
| `secondary_object_naming_scheme` | Same deterministic logical key as primary plus the independently returned secondary `versionId`; bucket/account identity makes the object ID distinct |
| `secondary_owner` | `PENDING_RATIFICATION`: a different named human secondary evidence custodian with separately administered access |
| `secondary_access_control_model` | Independent account policy, Block Public Access, bucket-owner-enforced ownership, independent write/read-back role and KMS key; the primary credential cannot administer or delete secondary objects |
| `secondary_retention_period` | Minimum 730 calendar days per immutable object version |
| `secondary_retention_expiry_rule` | Same rule as primary, evaluated and recorded independently; neither copy may have an earlier expiry |
| `copy_independence_boundary` | Different AWS account, bucket, region, IAM administration boundary, execution credential, KMS key, Object Lock configuration, lifecycle rule, audit stream, and named custodian. Neither copy depends on the execution directory, host filesystem, local disk, local cleanup command, or the other bucket. |
| `read_back_verification_method` | Full `GetObject` by exact bucket, key, and `versionId` after each write; stream every returned byte; metadata-only `HEAD` is insufficient |
| `SHA_256_verification_method` | Compute SHA-256 over each full read-back and require equality with the canonical pre-store digest and the other read-back digest; ETag or upload-time digest is not read-back proof |
| `byte_count_verification_method` | Count bytes during each full read-back and require equality with the canonical pre-store count and the other copy's count |
| `retention_manifest_location` | One logical deterministic manifest, serialized once, retained as immutable versioned objects in both buckets; primary is authoritative and secondary is its independently read-back-verified copy |
| `cleanup_authorization_dependency` | Cleanup remains false until both Golden JSON copies, both authority-evidence copies, and both manifest copies are readable by exact version, hash-valid, byte-count-valid, retention-valid, and mutually consistent |
| `credential_delivery_model` | Two separately scoped short-lived IAM role sessions supplied from approved secret custody or workload identity; values are never printed, logged, embedded, committed, or placed in the manifest. Non-secret parameter names must be registered before implementation. |
| `audit_log_source` | Independent CloudTrail S3 data-event trails/event data stores in the two custody accounts, covering object writes, reads, retention operations, and attempted deletes; audit destinations do not share the execution-workspace lifecycle |
| `failure_behavior` | Fail closed. Any write, read-back, hash, byte-count, retention, encryption, manifest, credential, audit-configuration, or cross-store contradiction keeps `cleanup_authorized=false` and permits no ephemeral or one-copy fallback. |

### 5.3 Precise independence boundary

Each bucket uses encryption with a different key in its own account. The two
execution roles are separately scoped; possession or failure of one role does
not grant administration of the other bucket or key. Neither role may shorten
retention, bypass Object Lock, alter lifecycle rules, or delete an object version.

An authoritative object ID is the tuple of account class, bucket identifier,
region, object key, and `versionId`. Resolved non-secret identifiers are recorded
in the manifest; credential values are never recorded.

---

## 6. B3 current AMS observation analysis

The following observations come from the exact AMS commit in §2.2. No AMS code
was executed.

| Required boundary | Current code observation | Selection consequence |
|---|---|---|
| Pass 1 decision boundary | `internal/policy/pass1.go :: EvaluatePreTrust()` returns `PolicyPassOneResolution`; `CONTINUE` and `CONSTRAINED_BLOCK` are non-final while `SKIP_TRUST` carries a pre-trust terminal decision | A producer must observe the actual branch and must not label every Pass 1 result non-final |
| Pass 2 invocation boundary | `internal/orchestration/pipeline.go` invokes `policy.ResolveFinal()` only after successful Trust on `CONTINUE` or `CONSTRAINED_BLOCK` | The orchestration call site can directly observe execution; downstream output alone cannot |
| Pass 2 result boundary | `internal/policy/pass2.go :: ResolveFinal()` constructs a `RuntimeDecisionOutput` through several internal returns | `ResolveFinal()` can establish its result but lacks exact execution identity and cannot see competing publications |
| Other final-decision paths | `SKIP_TRUST`, duplicate-trace/config fail-safe exits, and Trust failure produce `RuntimeDecisionOutput` without executing Pass 2 | All paths must converge through one publication ledger; output value cannot establish provenance |
| Current final publication | No single explicit publication primitive exists. Branches assign or return output, and `buildAuditRecord()` is called but discarded | Current code cannot authoritatively count publications, duplicates, conflicts, or sole ownership |
| Workspace identity | `accepted_events.workspace_id` exists in the backend schema and adapter row contract, but the report command does not select or pass it into `OrchestrationContext` | Required exact identity input is absent at the decision boundary |
| Site identity | The report command has `--site` and SQL scoping, but `OrchestrationContext` carries only `Domain`, not `site_id` | Site identity must be atomically bound as a distinct field; domain inference is prohibited |
| Subject identity | `accepted_events.browser_id`, adapter `SubjectID`, and `OrchestrationContext.SubjectID` are present | The producer can receive it after exact equality validation |
| Session identity | The current Golden surface declares browser-subject scope and treats `session_id` as informational | A replacement session requires exact non-empty persisted session scope; the existing broad scope is not authority-qualifying |
| AMS run identity | `runID` is allocated after scoped pipeline execution and after the Golden JSON is written | `AMS_run_id` must be allocated once before execution and included in the immutable identity envelope |
| Source-event identity | `SubjectAssemblyReport.EventIDs` includes every yielded ID, including rejected projections | A new accepted/projected event-ID set is required; rejected rows must not be claimed as decision inputs |
| Producer identity | No full AMS build commit is carried into the execution record | A validated full 40-hex build SHA must be supplied by immutable build metadata |

### 6.1 Current observation gaps

```text
workspace_id absent at final-decision boundary
site_id absent as a distinct final-decision identity
session_id not enforced as exact non-empty execution scope
AMS_run_id allocated too late
source_event_ids do not distinguish accepted decision inputs from rejected IDs
no single final-decision publication boundary
no decision-owner tag bound to the actual branch
no authoritative publication ledger
no duplicate publication count
no conflicting publication count
no full producer build identity
```

These gaps reject the existing unenhanced call site as a producer. They do not
leave B3 open: §8 selects one narrowly enhanced boundary that closes them.

---

## 7. B3 candidate evaluation

| Candidate | Decision | Reason |
|---|---|---|
| `internal/policy/pass2.go :: ResolveFinal()` alone | Rejected | It sees Pass 2 inputs/result but not workspace, site, session, AMS run, accepted source-event set, other finalization paths, or publication counts. It cannot prove sole ownership from inside a pure function. |
| Existing `pipeline.go` return/call sites without enhancement | Rejected | They see branch control flow and result but lack the complete identity envelope and one accounting/closure primitive; early exits bypass a common boundary. |
| BuyerRecon backend packaging layer | Rejected | It is downstream and may validate/consume evidence, but cannot infer AMS execution history or become authority merely because it sees output. |
| **Enhanced AMS orchestration final-publication ledger boundary** | **Selected** | It is atomically coupled to the actual Pass 1/Pass 2/fail-safe branch, can require immutable exact-execution identity, can force every final-decision path through one ledger, and closes accounting before evidence serialization. |

There is exactly one selected producer. `ResolveFinal()` remains a policy
sub-boundary supplying authoritative Pass 2 facts, not a second evidence producer.

---

## 8. B3 selected producer boundary

### 8.1 Final B3 selection

```text
authority_evidence_producer_selection_status=SELECTED
selected_producer_boundary=KeigenTechnologies/ams@3e280b40e67d7d8be0ad163a13cf22e31c770d9a::internal/orchestration.Pipeline.ExecuteWithRecord::FinalDecisionPublicationLedger.Finalize_after_all_decision_paths_converge_before_Step_13_writeback
producer_implemented=false
producer_implementation_authorized=false
```

`FinalDecisionPublicationLedger.Finalize()` is one narrowly defined future
orchestration enhancement at the existing `ExecuteWithRecord` boundary. It is
the sole canonical evidence producer. It is invoked exactly once after decision
branch convergence and before Trust/Series write-back, audit rendering, Golden
JSON rendering, backend consumption, or packaging.

### 8.2 Required authoritative inputs and atomic handoff

Before the pipeline begins, the AMS command creates one immutable
`GoldenExecutionIdentity` from authoritative sources:

```text
workspace_id          persisted accepted_events.workspace_id; one non-null value
site_id               persisted accepted_events.site_id; one non-null value
subject_id            persisted accepted_events.browser_id; one non-null value
session_id            persisted accepted_events.session_id; one non-null value
AMS_run_id             generated once by AMS before any pipeline execution
source_event_ids       sorted unique IDs successfully projected into decision input
producer_build_sha     full 40-hex AMS commit from immutable build metadata
execution_started_at   UTC timestamp from the injected AMS clock
```

The event query is constrained by workspace, site, subject, and session. Every
accepted row must match all four. The adapter returns a distinct accepted ID set;
a rejected row is diagnostic input, not a claimed source event. Any null,
mismatch, duplicate ID, empty set, or disagreement between persisted scope,
adapter scope, common features, and execution identity stops qualification.

The immutable identity is passed atomically into `ExecuteWithRecord`. No field is
reconstructed from logs, prose, filenames, packaging, or operator booleans.

### 8.3 Canonical publication ledger

All current final-decision paths offer one typed candidate to the same ledger:

```text
PASS_2_RESULT             owner=policy_pass_2
PASS_1_SKIP_TRUST         owner=policy_pass_1
ORCHESTRATION_FAIL_SAFE   owner=orchestration_fail_safe
```

The owner is a closed internal enum chosen by the branch that actually ran. A
caller cannot supply the authority-qualifying string. Only the code path that
invokes `policy.ResolveFinal()` may map the enum to:

```text
sole_final_decision_owner="policy_pass_2"
```

Pre-engine degraded outputs that currently return early are routed through the
same ledger as nonqualifying fail-safe publications. A pipeline error that
produces no final decision produces no authority evidence; downstream remains
neutral and blocked.

### 8.4 Publication, duplicate, and conflict semantics

The accounting scope is the exact tuple:

```text
AMS_run_id
session_id
subject_id
source_event_ids (sorted-set equality)
```

- **One final-decision publication** is one call crossing `Record()` with a
  typed owner and complete `RuntimeDecisionOutput` for the exact scope. Internal
  assignments are candidates, not publications, until they cross `Record()`.
- **Duplicate final-decision publication** is each publication after the first
  whose decision and typed owner both equal the first. The duplicate count is
  the number of those additional occurrences.
- **Conflicting final-decision publication** is each publication after the first
  whose decision or typed owner differs from the first. The conflict count is
  the number of those additional occurrences. The same decision from a
  different owner is a conflict because sole ownership is contradicted.

The ledger accepts records only for its immutable scope. A scope mismatch is a
contradiction, not a second scope. After branch convergence, `Finalize()`
atomically closes the ledger. Counts and owner are immutable at closure. The
closed ledger is not reachable by later steps; any attempted late publication is
a fatal governance error and invalidates authority qualification.

`policy_pass_2_is_sole_final_decision=true` is emitted only when:

```text
publication_count=1
typed_owner=PASS_2_RESULT
conflicting_final_decision_count=0
duplicate_final_decision_count=0
```

### 8.5 Evidence production sequence

```text
Pass 1 state becomes known
→ Pass 2 execution state becomes known
→ one typed final-decision candidate crosses Record()
→ all decision paths converge
→ duplicate/conflict accounting is finalized and the ledger closes
→ exact GoldenExecutionIdentity equality is revalidated
→ evidence object is serialized deterministically
→ evidence SHA-256 and byte count are calculated
→ evidence enters the A1 primary/secondary retention flow
```

Evidence is never emitted as authority-qualifying before ledger closure and
identity revalidation.

### 8.6 Minimum future implementation surface for the enhancement

```text
add immutable GoldenExecutionIdentity contract
allocate AMS_run_id before scoped execution
query and enforce exact workspace/site/subject/session scope
expose accepted/projected event IDs separately from rejected IDs
add closed typed DecisionOwner enum
funnel every final-decision path through one FinalDecisionPublicationLedger
atomically close publication accounting before serialization
add deterministic authority-evidence schema and serializer
bind producer identity to full AMS build commit
emit evidence bytes separately from Golden JSON
```

No other producer placement remains open.

---

## 9. Field-to-authoritative-source map

The selected producer is conforming only when every row is implemented and
independently verified. “Atomic receive” means the fact enters in the immutable
identity or typed branch result before ledger closure.

| `field_name` | `authoritative_source` | `code_or_runtime_observation_point` | `when_the_fact_becomes_final` | `how_the_field_is_linked_to_the_exact_run` | `how_contradictions_are_detected` | direct or atomic |
|---|---|---|---|---|---|---|
| `workspace_id` | Persisted `accepted_events.workspace_id` for every accepted source row | Exact-scope reader creates identity; ledger revalidates | When row set closes before pipeline | Immutable run/session/event identity | Null, multiple values, query/scope mismatch, or mutation rejects evidence | Atomically received |
| `site_id` | Persisted `accepted_events.site_id`, equal to authorized query scope | Exact-scope reader; never `Domain` inference | When row set closes | Same identity | Persisted/query/adapter inequality rejects | Atomically received |
| `subject_id` | Persisted `browser_id`, equal to adapter/common/orchestration subject | Reader and `OrchestrationContext.SubjectID` equality gate | Before pipeline | Same identity | Any inequality across sources rejects | Atomic plus direct equality observation |
| `session_id` | Persisted non-null `accepted_events.session_id` for every accepted row | Exact-session query and adapter scope | When row set closes | Same identity | Empty, multiple sessions, or mismatch rejects | Atomically received |
| `AMS_run_id` | UUID generated once by AMS before query/pipeline work | AMS command creates identity and ledger | At ledger construction | Ledger primary identity | Reuse, mutation, or different run record rejects | Atomic from AMS-owned generator |
| `source_event_ids` | Sorted unique accepted/projected row IDs | Enhanced `SubjectAssemblyReport.AcceptedEventIDs` | When accepted row set closes | Exact sorted set in identity | Empty, duplicate, rejected-ID inclusion, or set mismatch rejects | Atomically received |
| `final_decision` | Actual branch's `RuntimeDecisionOutput.FinalDecision` | Ledger `Record()` and closed first publication | At closure | Publication keyed by exact identity | Empty/invalid, differing publication, or serializer mismatch blocks | Directly observed |
| `policy_pass_1_is_not_final` | Actual Pass 1 branch plus absence of Pass1-owned publication | Typed branch and closed ledger | At closure | Same record | `SKIP_TRUST`, Pass1 ownership, missing Pass1, or competitor forces false | Directly observed |
| `policy_pass_2_executed` | Call path that invokes `policy.ResolveFinal()` and returns normally | `PASS_2_RESULT` record immediately after call | When result returns and is recorded | Same ledger | Output without invocation, nil return, fail-safe, or branch mismatch forces false | Directly observed |
| `policy_pass_2_final_decision_verified` | Equality of Pass2 result, ledger publication, and serialized decision | `Finalize()` plus serializer postcondition | After serialization comparison | Same closed record | Any inequality forces false and rejection | Directly observed |
| `policy_pass_2_is_sole_final_decision` | Closed count, owner, duplicate count, conflict count | `Finalize()` | Atomic closure | Same ledger | Count not one, non-Pass2 owner, duplicate, conflict, or late attempt forces false | Directly observed |
| `sole_final_decision_owner` | Closed internal owner enum attached by actual branch | `Finalize()` maps only `PASS_2_RESULT` to allowed literal | At closure | Owner belongs to exact record | Non-Pass2/multiple/caller-supplied/unknown owner rejects | Directly observed |
| `conflicting_final_decision_count` | Later ledger records with differing decision or owner | `Record()` accumulation and `Finalize()` | At closure | Exact tuple | Scope or count/record disagreement invalidates | Directly observed |
| `duplicate_final_decision_count` | Later ledger records with same decision and owner | `Record()` accumulation and `Finalize()` | At closure | Exact tuple | Scope or count/record disagreement invalidates | Directly observed |
| `producer_identity` | Fixed producer name plus full AMS commit from immutable build metadata | Ledger construction validates `name@40-hex-sha` | Before execution | Copied into identity and evidence | Missing, malformed, overridden, or wrong SHA rejects | Atomically received |
| `produced_at` | Injected AMS UTC clock at closure | `Finalize()` | At closure | Must be in execution window | Non-UTC, out-of-window, pre-start, or mutable time rejects | Directly observed |

No field may come from documentation prose, operator assertion,
`RequestedAction`, `final_decision` alone, run ID alone, replay-card existence,
backend packaging inference, or an operator-supplied boolean.

---

## 10. Cross-workstream manifest and lifecycle

### 10.1 Separate authoritative objects

The selected integration requires:

```text
Golden JSON and execution-authority evidence are separate authoritative objects
each object has a primary and secondary retained copy
each object has its own SHA-256 and byte count
one logical durable manifest links both objects to the same exact execution
the logical manifest itself has primary and secondary immutable retained copies
cleanup remains prohibited until both object pairs and both manifest copies verify
```

Neither object may be derived from the other. The backend retention layer is a
consumer of AMS-produced bytes and must not alter them.

### 10.2 Manifest binding

The deterministically serialized manifest binds at least:

```text
schema_version
workspace_id
site_id
subject_id
session_id
AMS_run_id
source_event_ids
Golden_JSON_primary_object_ID
Golden_JSON_secondary_object_ID
Golden_JSON_SHA_256
Golden_JSON_byte_count
authority_evidence_primary_object_ID
authority_evidence_secondary_object_ID
authority_evidence_SHA_256
authority_evidence_byte_count
manifest_SHA_256
manifest_byte_count
retention_expiry
primary_read_back_status
secondary_read_back_status
cleanup_authorized
```

Every object ID includes the exact S3 `versionId`. The manifest is written only
after the four data-object copies are stored and read back. Its two serialized
copies are then read back and verified before the cleanup gate can set
`cleanup_authorized=true`.

### 10.3 Integrated lifecycle

```text
exact execution identity is frozen
→ B3 ledger observes the real decision path
→ B3 ledger closes duplicate/conflict accounting
→ authority evidence is deterministically serialized
→ Golden JSON is deterministically serialized as a separate object
→ each object's SHA-256 and byte count are calculated
→ Golden JSON is written to A1 primary then A1 secondary
→ authority evidence is written to A1 primary then A1 secondary
→ all four exact versions are fully read back
→ all four hashes and byte counts are verified
→ one manifest is serialized and written to both stores
→ both manifest versions are fully read back and verified
→ packaging input readiness may be declared
→ cleanup may be considered by the separate cleanup gate
```

No arrow authorizes the next step automatically. Any failure keeps cleanup
prohibited.

### 10.4 Authority wording boundary

Policy Pass 2 authority wording remains permitted only when one strictly valid,
exactly linked evidence object affirmatively contains every condition:

```text
policy_pass_1_is_not_final=true
policy_pass_2_executed=true
policy_pass_2_final_decision_verified=true
policy_pass_2_is_sole_final_decision=true
sole_final_decision_owner="policy_pass_2"
conflicting_final_decision_count=0
duplicate_final_decision_count=0
```

Every other state requires:

```text
policy_pass_2_authority_verified=false
policy_pass_2_acceptance_readiness=BLOCKED
```

and exactly neutral wording:

```text
Authoritative AMS final decision: <decision>
```

Schema validity, a decision, `RequestedAction`, run ID, replay card, operator
assertion, or retained files alone never upgrade wording.

---

## 11. Failure behavior

All failures are fail-closed and preserve original bytes where they still exist.
No path falls back to temporary storage, one durable copy, a VCS attachment, or
reconstruction.

| Failure | Required behavior |
|---|---|
| Primary object write fails | Secondary-only state is invalid; do not clean up |
| Secondary object write fails | Primary remains retained but the pair is invalid; do not clean up |
| Either full read-back fails | Upload response/HEAD cannot substitute; retention invalid |
| SHA-256 mismatch | Neither mismatching pair is declared authoritative; do not clean up |
| Byte-count mismatch | Retention invalid; do not clean up |
| Object Lock/retention shorter than rule | Retention invalid; no cleanup or authority packaging |
| Manifest write/read-back fails | Data copies alone do not authorize cleanup |
| Manifest contradicts object metadata | Manifest invalid; `cleanup_authorized=false` |
| Primary store unavailable | Abort; no secondary-only execution exception |
| Secondary store unavailable | Abort; no primary-only execution exception |
| Credential missing or over-privileged | Abort before writes; never print or persist credential |
| Exact identity missing or mismatched | No qualifying evidence; neutral wording and `BLOCKED` |
| Pass 2 not directly observed | `policy_pass_2_executed=false`; neutral wording and `BLOCKED` |
| Final decision differs across Pass 2, ledger, serialization | Evidence rejected; neutral wording and `BLOCKED` |
| Duplicate publication | Nonzero duplicate count; sole-final false; neutral wording and `BLOCKED` |
| Conflicting decision or owner | Nonzero conflict count; sole-final false; neutral wording and `BLOCKED` |
| Late publication after ledger closure | Fatal governance error; evidence invalidated; no cleanup |
| Producer build identity absent/malformed | Evidence rejected; neutral wording and `BLOCKED` |
| Evidence serialization/hash failure | Evidence invalid/absent; neutral wording, `BLOCKED`, no cleanup |
| Cleanup attempted before complete verification | Reject non-zero and record governance violation |

Object Lock may retain a partial failed-attempt object until expiry. That residue
is diagnostic custody material, not a qualifying pair, and cannot be relabelled
to manufacture success.

---

## 12. Implementation surface map

This is the minimum likely future surface. It is a complete responsibility map,
not permission to edit any component.

| Area | Component | Likely files or modules | Required responsibility | Explicitly excluded responsibility |
|---|---|---|---|---|
| AMS repository | Exact identity construction | `cmd/buyerrecon-report/main.go`; `internal/contracts/orchestration.go` | Allocate run ID before execution; enforce workspace/site/subject/session query; pass immutable identity | Storage provisioning, backend validation, authority wording |
| AMS repository | Accepted-event identity | `internal/products/buyerrecon/adapter/accepted_event_row.go` | Preserve distinct sorted accepted/projected IDs and exact identity equality | Reconstructing rejected/deleted events; packaging inference |
| AMS repository | Canonical producer | `internal/orchestration/pipeline.go`; new `internal/orchestration/authority_evidence.go` | Funnel every decision path through typed ledger; count; close once; serialize evidence | Product scoring, storage writes, customer wording |
| AMS repository | Evidence contract | new `internal/contracts/authority_evidence.go` | Closed schema, owner enum, identity, claims, producer provenance, deterministic serialization | Backend repair/defaulting or second decision authority |
| AMS repository | Pass 2 sub-boundary | `internal/policy/pass2.go` | Produce Pass 2 result consumed atomically by selected producer | Incomplete evidence or identities it cannot observe |
| AMS repository | Golden/evidence output | `internal/products/buyerrecon/report/golden_session.go`; `cmd/buyerrecon-report/main.go` | Emit separate deterministic Golden JSON and evidence bytes from same record | Retention qualification or packaging wording |
| buyerrecon-backend repository | Retention coordinator | `scripts/run-golden-session.ts`; likely new `src/reports/external/golden-session-retention.ts` | Store/read back four copies; verify; create/verify manifest pair; gate cleanup | Producing AMS authority facts or reconstructing artifacts |
| buyerrecon-backend repository | Evidence validator | likely new `src/reports/external/policy-pass-2-authority-evidence.ts` | Strict schema, identity, hash, owner, count, and qualification validation | Defaulting, repairing, or inferring evidence |
| buyerrecon-backend repository | Packaging consumer | `src/reports/external/golden-session-package.ts`; `src/reports/external/ams-existing-run.ts` | Resolve immutable objects; authority wording only for fully qualifying evidence | Evidence production or retention bypass |
| storage/infrastructure configuration | Primary vault | Future separately reviewed infrastructure definitions | Dedicated primary account/bucket/region/KMS key, Versioning, compliance Object Lock, retention, CloudTrail | Runtime execution, shared temporary storage, credentials in source |
| storage/infrastructure configuration | Secondary vault | Future separately reviewed infrastructure definitions | Different account/bucket/region/KMS key/admin/lifecycle/audit boundary | Replication substituting for independent verified write/read-back |
| credential management | Two execution roles | Approved secret manager/workload identity and non-secret registry entries | Separate short-lived least-privilege sessions without disclosure | Static keys, committed values, shared delete/admin capability |
| tests | A1 fixtures | Backend unit/integration fixture modules; no production connections | Complete A1 matrix against non-production fakes/emulators or isolated test stores | Production storage, real Golden Session, authoritative-data cleanup |
| tests | B3 fixtures | AMS orchestration/contract tests and backend validator fixtures | Every decision path, identity mismatch, ledger, hash, wording case | Production AMS invocation, packaging, closed-session reconstruction |
| static gates | Registry and boundaries | `check:constants`; `check:customer-output-boundary`; new narrow checks | Reject unregistered names, producer drift, authority inference, unconditional cleanup | Runtime qualification claims |
| documentation | Contract/selection/evidence | This document and future versioned implementation/review records | Preserve status, mappings, evidence, authorization | Treating prose as implementation evidence |

New-module filenames may change only in a separately reviewed implementation
plan that preserves these responsibilities and the single-producer boundary. No
alternative architecture may be substituted implicitly.

---

## 13. Mandatory test matrix

All tests are mandatory, non-production, and non-executing with respect to a
real Golden Session. They must not connect to production, run a real browser,
invoke production AMS, or reconstruct the closed session.

### 13.1 A1 selected-design tests

| # | Mandatory case | Selected-design assertion |
|---|---|---|
| A1-1 | Primary-copy write failure | Secondary-only state invalid; cleanup prohibited |
| A1-2 | Secondary-copy write failure | Primary-only state invalid; cleanup prohibited |
| A1-3 | Primary read-back failure | Upload/HEAD cannot substitute; cleanup prohibited |
| A1-4 | Secondary read-back failure | Pair invalid; cleanup prohibited |
| A1-5 | SHA-256 mismatch | Read-back digest contradiction invalidates pair |
| A1-6 | Byte-count mismatch | Read-back count contradiction invalidates pair |
| A1-7 | Manifest write failure | Verified data objects alone do not authorize cleanup |
| A1-8 | Manifest contradiction | Wrong identity, object/version, digest, count, expiry, or status rejected |
| A1-9 | Premature cleanup rejection | Cleanup exits non-zero before every gate condition passes |
| A1-10 | Artifact survival after execution-directory deletion | Both objects and manifest remain readable/hash-valid by exact version in both stores |
| A1-11 | Primary-store outage | No secondary-only fallback; qualification aborts |
| A1-12 | Secondary-store outage | No primary-only fallback; qualification aborts |

Every applicable A1 case runs for Golden JSON and authority evidence, and
manifest-copy failures are exercised independently.

### 13.2 B3 selected-producer tests

| # | Mandatory case | Selected-producer assertion |
|---|---|---|
| B3-1 | Missing execution-authority evidence | Reject; neutral wording; `BLOCKED` |
| B3-2 | Invalid schema | Reject without defaults; neutral wording; `BLOCKED` |
| B3-3 | Wrong workspace linkage | Reject against manifest/execution identity |
| B3-4 | Wrong site linkage | Reject against manifest/execution identity |
| B3-5 | Wrong subject linkage | Reject against manifest/execution identity |
| B3-6 | Wrong session linkage | Reject against manifest/execution identity |
| B3-7 | Wrong AMS run linkage | Reject against manifest/execution identity |
| B3-8 | Source-event mismatch | Set inequality, rejected-ID inclusion, duplicate, or empty set rejected |
| B3-9 | Pass 2 not executed | Direct Pass1/fail-safe route records false; neutral; `BLOCKED` |
| B3-10 | Final decision unverified | Pass2/ledger/serialization mismatch rejected; neutral; `BLOCKED` |
| B3-11 | Sole ownership false | Multiple publication or non-Pass2 owner forces false and blocks |
| B3-12 | Wrong owner literal | Anything except exact `"policy_pass_2"` rejects qualification |
| B3-13 | Duplicate final-decision evidence | Extra same-decision/same-owner publication increments count; neutral; `BLOCKED` |
| B3-14 | Conflicting final-decision evidence | Extra different-decision/owner publication increments count; neutral; `BLOCKED` |
| B3-15 | Invalid evidence hash | Recomputed SHA-256 mismatch rejects evidence |
| B3-16 | Neutral wording fallback | Every missing, invalid, unlinked, contradictory, nonqualifying state emits exact neutral sentence |
| B3-17 | Policy Pass 2 wording only after fully qualifying evidence | Permitted only after one strict, exactly linked object satisfies every affirmative condition |

Every mandatory A1 and B3 test must pass before either implementation may be
classified as `INDEPENDENTLY_VERIFIED`. A passing subset is not qualification.

---

## 14. Governance and authorization sequence

### 14.1 Minimum implementation-authorization prerequisites

Implementation authorization remains blocked until all are complete:

```text
A1 selected design is independently reviewed
B3 selected producer is independently reviewed
storage credential-delivery design is approved
retention period and ownership are ratified
field-to-authoritative-source map is complete and independently accepted
implementation file map is complete and independently accepted
fixture plan is complete
rollback and failure behavior are defined
AMS implementation base is re-pinned and drift-reviewed
```

This document defines the credential-delivery model and retention rule, but
operational ratification remains separate. Named human owners, account/region/
bucket/key identifiers, role names, and custody registrations are not invented.

### 14.2 Frozen sequence

```text
1.  docs-only architecture-selection record
2.  independent architecture review of A1 and B3
3.  credential, retention, owner, map, fixture, rollback, and AMS-base ratification
4.  separate implementation authorization
5.  implementation PR or explicitly coordinated implementation PRs
6.  independent implementation review
7.  complete non-production fixture qualification
8.  separate replacement-session execution authorization
9.  browser execution
10. backend processing
11. exactly-once AMS execution
12. durable two-store retention and read-back verification
13. packaging
14. acceptance assessment
15. cleanup only after retention and packaging gates
```

No step automatically authorizes the next. This document is step 1 only.

### 14.3 Frozen no-execution state

```text
implementation_authorized=false
replacement_session_execution_authorized=false
browser_execution_authorized=false
AMS_execution_authorized=false
packaging_authorized=false
```

---

## 15. Explicit prohibitions

This selection does not permit:

```text
provisioning either S3 bucket, account, region, KMS key, role, trail, or lifecycle
creating, reading, testing, printing, embedding, or committing credentials
editing AMS, backend application code, tests, runtime configuration, or infrastructure
running a proof of concept against AMS or any real storage
running a browser, backend worker, AMS invocation, packaging, or deployment
accessing staging or application data
moving deployment pointers or restarting services
using backend packaging as the authority producer
using ResolveFinal alone as the authority producer
using final_decision, RequestedAction, run ID, replay card, prose, or operator assertion as proof
using a second local filename, directory, or volume as the secondary copy
falling back to one copy or ephemeral storage
reconstructing or retrying ses_x0vrbqik
reusing any closed-session browser, session, event, or run identity
authorizing a reduced-scope real replacement execution
authorizing implementation or replacement-session execution
```

---

## 16. Final selection record

```text
selection_status=PASS
status=REPLACEMENT_GOLDEN_SESSION_ARCHITECTURE_SELECTION_V0_1

durable_storage_selection_status=SELECTED
selection_id=A1-C2-AWS-S3-DUAL-ACCOUNT-DUAL-REGION-OBJECT-LOCK-V0_1
selected_storage_design=AWS_S3_DUAL_ACCOUNT_DUAL_REGION_OBJECT_LOCK_COMPLIANCE_EVIDENCE_VAULT

authority_evidence_producer_selection_status=SELECTED
selected_producer_boundary=KeigenTechnologies/ams@3e280b40e67d7d8be0ad163a13cf22e31c770d9a::internal/orchestration.Pipeline.ExecuteWithRecord::FinalDecisionPublicationLedger.Finalize_after_all_decision_paths_converge_before_Step_13_writeback

producer_observes_all_required_fields=true_by_selected_design
field_authoritative_source_map_status=COMPLETE
conflict_count_observation_status=DEFINED
duplicate_count_observation_status=DEFINED
sole_owner_observation_status=DEFINED
exact_execution_linkage_status=DEFINED

cross_workstream_manifest_status=DEFINED
golden_json_retention_flow_status=DEFINED
authority_evidence_retention_flow_status=DEFINED
cleanup_gate_integration_status=DEFINED

credential_delivery_design_status=DEFINED
retention_period_ratification_status=PENDING
owner_ratification_status=PENDING

storage_provisioned=false
producer_implemented=false
implementation_authorized=false
replacement_session_execution_authorized=false
browser_execution_authorized=false
AMS_execution_authorized=false
packaging_authorized=false
```

A1 and B3 are selected. The resulting docs-only PR is eligible only for an
independent architecture review. It authorizes no implementation or execution.

---

**End of architecture selection v0.1.**
