# Replacement Golden Session — A1 Architecture Amendment v0.1

`STATUS = HETZNER_AWS_A1_ARCHITECTURE_AMENDMENT_V0_1`

## 1. Status and authority

This document performs exactly one governance operation: it amends the selected
**A1 durable authoritative artifact-storage topology** and nothing else.

```text
previous_A1_architecture=AWS_S3_DUAL_ACCOUNT_DUAL_REGION_OBJECT_LOCK_COMPLIANCE_EVIDENCE_VAULT
new_A1_architecture=HETZNER_PRIMARY_AWS_SECONDARY_IMMUTABLE_EVIDENCE_VAULT

amendment_reason=operational fit with BuyerRecon's Hetzner-first infrastructure while preserving independent immutable evidence retention

security_invariant_weakened=false
B3_changed=false
retention_policy_changed=false
Policy_Pass_2_contract_changed=false
```

This amendment implements nothing, provisions nothing, and authorizes nothing.

```text
implementation_authorized=false
hetzner_provisioning_authorized=false
aws_provisioning_authorized=false
credential_creation_authorized=false
replacement_session_execution_authorized=false
browser_execution_authorized=false
AMS_execution_authorized=false
packaging_authorized=false

hetzner_resources_created=0
aws_resources_created=0
credentials_created=0
```

### 1.1 Amendment method

This is a **superseding amendment document**, not an in-place edit of the merged
contracts. The merged readiness contract, architecture selection, and
implementation readiness ratification were each independently reviewed and merged
at exact SHAs; editing them in place would mutate reviewed artefacts and make it
ambiguous what the independent reviewers approved. Readiness contract §7.5
already establishes versioned revision as this repository's governance method.

Where this document and a merged contract conflict **on an A1-specific
provision listed in §1.2**, this document governs. On every other provision the
merged contracts remain authoritative and unchanged.

### 1.2 Exact supersession scope

Only the following A1-specific provisions are superseded.

| Document | Section | Superseded provision | Replaced by |
|---|---|---|---|
| architecture-selection v0.1 | §2.4 | AWS-only provider capability sources | §3 (adds Hetzner sources) |
| architecture-selection v0.1 | §2.5 | AWS-only capability limits | §3.3 (adds Hetzner limits) |
| architecture-selection v0.1 | §4 | C2 read as "both copies in AWS" | §2.2 (C2 read as "S3-compatible object storage", provider-split) |
| architecture-selection v0.1 | §5.1 | `selected_storage_design`, `selection_id` | §2.1 |
| architecture-selection v0.1 | §5.2 | AWS-only per-side selection fields | §4 (Hetzner primary), §5 (AWS secondary) |
| architecture-selection v0.1 | §5.3 | Independence boundary expressed in AWS terms | §6 |
| architecture-selection v0.1 | §10.1–10.3 | Per-copy identity assuming S3 `versionId` semantics | §8 (provider-qualified identity) |
| architecture-selection v0.1 | §11 | Failure rows naming AWS-only mechanisms | §10 |
| architecture-selection v0.1 | §12 | "Primary vault"/"Secondary vault" infrastructure rows | §12 |
| architecture-selection v0.1 | §13.1.3 | Copy-independence sub-cases named in AWS terms | §11.3 |
| architecture-selection v0.1 | §16 | A1 lines only | §15 |
| ratification v0.1 | §3.1 | A1 frozen selection restatement | §2.1 |
| ratification v0.1 | §5.1 | Role responsibilities bound to two AWS accounts | §13.1 |
| ratification v0.1 | §6 | Matrix authority/audit columns assuming AWS-only | §13.2 |
| ratification v0.1 | §7.1–7.5 | Six AWS-only execution identities | §7 |
| ratification v0.1 | §10.1–10.2 | Dual-AWS infrastructure surface | §12 |
| ratification v0.1 | §11 | AWS-only independence static gates | §14 |
| ratification v0.1 | §16 | A1 lines only | §15 |

**Explicitly NOT superseded, and carried forward unchanged:**

```text
readiness contract v0.1 in full, except where A1 topology is implied
B3 producer selection and every Policy Pass 2 semantic
FinalDecisionPublicationLedger architecture and the Finalize convergence precondition
the two-phase record model (Phase 1 / Phase 2)
the eight-object lifecycle
the record digest self-exclusion rule
the cleanup gate conditions and fail-closed behaviour
BR-GOLDEN-EVIDENCE-RETENTION-V0_1 in full
the authority wording boundary and neutral-wording fallback
the mandatory A1 and B3 test matrices, except for provider-qualified renaming in §11
the governance sequence and all authorization boundaries
the ten canonical Role IDs
```

### 1.3 Amendment basis

This amendment rests on the completed `A1_OPERATIONAL_FIT_FEASIBILITY` result:

```text
feasibility_status=PASS
recommended_decision=AMEND_TO_HETZNER_AWS_HYBRID
operationally_preferred=true
```

The OPTION_A versus OPTION_B comparison is closed and is not reopened here.

---

## 2. Canonical baseline and the amended selection

### 2.1 Amended A1 selection

```text
repository=KeigenTechnologies/buyerrecon-backend
canonical_branch=sprint2-architecture-contracts-d4cc2bf
base_sha=69890ae790d8b32f4685be2feea50b8646a1a54a
```

```text
durable_storage_selection_status=SELECTED
selection_id=A1-HETZNER-PRIMARY-AWS-SECONDARY-OBJECT-LOCK-COMPLIANCE-V0_1
selected_storage_design=HETZNER_PRIMARY_AWS_SECONDARY_IMMUTABLE_EVIDENCE_VAULT
storage_design_name=Hetzner Object Storage primary + Amazon S3 secondary cross-provider immutable evidence vault
storage_provisioned=false
storage_implementation_authorized=false
```

```text
provider=Hetzner
store=Hetzner Object Storage
role=PRIMARY_AUTHORITATIVE_EVIDENCE_STORE
```

```text
provider=AWS
store=Amazon S3
role=SECONDARY_VERIFICATION_EVIDENCE_STORE
```

This remains one integrated design. It requires both stores; it is not a menu
from which an implementer may choose one provider.

### 2.2 Relationship to the bounded candidate set

The readiness contract bounded A1 to C1, C2, and C3, and architecture selection
§4 selected **C2 — S3-compatible object storage**. That selection is unchanged.

What changes is only the reading of C2's provider topology. The readiness
contract's C2 candidate is "S3-compatible object storage (provider unselected)";
it never required a single provider on both sides. This amendment resolves C2 as
two S3-compatible stores at **two different providers** rather than two accounts
at one. C1 and C3 remain rejected and are not reopened. No fourth candidate is
introduced.

### 2.3 AMS and B3 unchanged

```text
AMS-BASE-REPIN=CLOSED
repinned_ams_implementation_base_sha=3e280b40e67d7d8be0ad163a13cf22e31c770d9a
selected_producer_boundary=KeigenTechnologies/ams@3e280b40e67d7d8be0ad163a13cf22e31c770d9a::internal/orchestration.Pipeline.ExecuteWithRecord::FinalDecisionPublicationLedger.Finalize_after_all_decision_paths_converge_before_Step_13_writeback

backend packaging remains a consumer and validator
backend packaging is NOT the Policy Pass 2 authority producer
```

The B3 boundary is provider-independent. Nothing in this amendment touches it.

---

## 3. Provider capability sources

### 3.1 Hetzner Object Storage

Verified against current official Hetzner documentation:

- [Object Lock: Retention](https://docs.hetzner.com/storage/object-storage/howto-protect-objects/protect-object-lock-retention/)
  — retention modes are `GOVERNANCE` and `COMPLIANCE`; "it is not possible to end
  'compliance mode' in advance"; "You have to enable object lock during Bucket
  creation. It is not possible to enable Object Lock on Buckets that were created
  without Object Lock"; retention periods may be specified in days or years.
- [FAQ: Buckets & objects](https://docs.hetzner.com/storage/object-storage/faq/buckets-objects/)
  — with Object Lock, "Versioning is automatically enabled and you cannot disable
  it"; "Each object is automatically assigned a version ID"; under compliance
  retention "No one can end the retention period earlier and it is not possible to
  delete the object before the retention period ended"; a bucket can only be
  deleted when empty.
- [List of supported actions](https://docs.hetzner.com/storage/object-storage/supported-actions/)
  — Object Lock retention and legal hold supported; versioning supported;
  Replication **not supported**; Logging **not supported**; Tagging not supported;
  only SSE-C encryption.
- [FAQ: General](https://docs.hetzner.com/storage/object-storage/faq/general/)
  — "There is no default data-at-rest encryption of objects, but you can encrypt
  your data during the upload using SSE-C"; locations are Nuremberg, Falkenstein,
  Helsinki; erasure coding tolerates up to three storage-server failures.
- [FAQ: S3 credentials](https://docs.hetzner.com/storage/object-storage/faq/s3-credentials/)
  — "each key pair is automatically valid for every Bucket within the same
  project"; bucket policies can allowlist individual keys and narrow `s3:*` to
  granular actions; no temporary/session-token credential type is documented.

### 3.2 Amazon S3 (secondary only)

Verified against current official AWS documentation:

- [Locking objects with Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-overview.html)
  — in compliance mode "a protected object version can't be overwritten or deleted
  by any user, including the root user in your AWS account", its retention mode
  cannot be changed and its period cannot be shortened; "Object Lock works only in
  buckets that have S3 Versioning enabled"; retention applies per object version
  and may be extended; "The only way to delete an object under the compliance mode
  before its retention date expires is to delete the associated AWS account."

Only the AWS capabilities the secondary store actually needs are relied upon.

### 3.3 Explicit capability limits

Superseding architecture selection §2.5 by extension. Object Lock compliance mode
on **either** provider prevents overwrite and deletion of a specific object
version for its retention period. It does **not** protect against:

```text
closure, suspension, or deletion of the AWS account holding the secondary bucket
closure, suspension, or deletion of the Hetzner account/project holding the primary bucket
destruction or loss of an encryption key required to read a copy
loss of the custodian relationship administering either provider
```

No statement in this or any downstream document may claim that Object Lock,
versioning, or compliance retention mitigates provider-account closure or
encryption-key loss. Those residual risks are addressed only by the
cross-provider separation in §6 and the separated-authority requirements in §13.

**Amendment note.** AWS's own documentation states that deleting the associated
AWS account is the only way to delete a compliance-locked object early. Under the
previous dual-AWS topology both copies sat inside that single vendor control
plane. Under this amendment an AWS account deletion can destroy at most the
secondary copy, and a Hetzner project deletion can destroy at most the primary
copy. This is a strengthening, not a weakening, of the failure-domain invariant.

---

## 4. Hetzner primary store contract

Expressed in Hetzner-native semantics. AWS KMS/IAM terminology is not applied to
Hetzner.

| Field | Required value |
|---|---|
| `primary_provider` | Hetzner |
| `primary_store_type` | Dedicated Hetzner Object Storage bucket with Object Lock enabled **at bucket creation** |
| `primary_store_location_class` | One ratified Hetzner Object Storage location (Nuremberg, Falkenstein, or Helsinki); never mounted inside the execution host |
| `primary_object_lock_requirement` | Object Lock enabled at creation. A bucket created without Object Lock can never be retrofitted and must be replaced, not repaired |
| `primary_retention_mode` | `COMPLIANCE`. Governance mode is not acceptable and may not be substituted |
| `primary_versioning_requirement` | Versioning is automatically enabled with Object Lock and cannot be disabled; this satisfies the version-identity invariant |
| `primary_object_naming_scheme` | `golden-sessions/v0.1/<workspace_id>/<site_id>/<session_id>/<AMS_run_id>/<object_kind>/<sha256>.<ext>` plus the Hetzner-assigned version ID; `object_kind` is exactly one of `golden-json`, `authority-evidence`, `execution-retention-manifest`, `cleanup-authorization-record` |
| `primary_version_identity` | Provider-assigned version ID, recorded as `provider_version_id` and never assumed to share AWS `versionId` format or semantics |
| `primary_retention_period` | Minimum 730 calendar days per immutable object version, per `BR-GOLDEN-EVIDENCE-RETENTION-V0_1` |
| `primary_retention_expiry_rule` | `retain_until = max(object_version_created_at + 730d, execution_authorization.retention_expires_at)`; a missing or shorter authorized horizon fails closed |
| `primary_early_deletion` | Prohibited. Compliance mode makes early deletion impossible for every principal, including the account owner and the provider |
| `primary_access_control_model` | Private access only. No public bucket policy, no public ACL, no anonymous access. Dedicated Hetzner evidence credentials, distinct from ordinary BuyerRecon application credentials |
| `primary_owner` | `PENDING_RATIFICATION` — the `EVIDENCE_PRIMARY_ACCOUNT_CUSTODIAN` role (§13.1), now the Hetzner-side custodian; never the execution agent or a runtime principal |
| `primary_read_back_verification_method` | Full `GetObject` by exact bucket, key, and provider version ID after each write; stream every returned byte; metadata-only `HEAD` is insufficient |
| `primary_byte_count_verification_method` | Count bytes during the full read-back and require equality with the canonical pre-store count and with the AWS copy's count |
| `primary_sha256_verification_method` | BuyerRecon computes SHA-256 over the full read-back and requires equality with the canonical pre-store digest and with the AWS read-back digest; ETag or upload-time digest is not read-back proof |
| `primary_immutable_retention_verification` | `GetObjectRetention` by exact version confirming mode `COMPLIANCE` and a `retain_until` satisfying the ratified policy |
| `primary_lifecycle_independence` | The bucket lifecycle is independent of the execution workspace, the host filesystem, any local disk, any local cleanup command, and the AWS secondary |
| `primary_failure_behavior` | Fail closed. See §10 |

---

## 5. AWS secondary store contract

The AWS side is a passive independent secondary evidence surface, not an
application dependency and not a re-creation of the former two-account topology.

| Field | Required value |
|---|---|
| `secondary_provider` | AWS |
| `secondary_account_requirement` | **One** dedicated AWS evidence account, or an otherwise explicitly isolated evidence account. A second AWS evidence account is **not** required; cross-provider separation already supplies the independence the old dual-account model was imitating |
| `secondary_store_type` | Dedicated Amazon S3 general-purpose bucket with Versioning and Object Lock enabled in compliance mode |
| `secondary_store_location_class` | One dedicated ratified AWS region; never mounted inside the execution host |
| `secondary_retention_mode` | `COMPLIANCE`. Governance mode is not acceptable |
| `secondary_versioning_requirement` | S3 Versioning required; Object Lock works only on versioned buckets |
| `secondary_object_naming_scheme` | Same deterministic logical key as primary, plus the independently returned S3 `versionId`; provider and account identity make the object ID distinct |
| `secondary_retention_period` | Minimum 730 calendar days per immutable object version, evaluated and recorded independently |
| `secondary_retention_expiry_rule` | Same rule as primary, evaluated independently; neither copy may have an earlier expiry |
| `secondary_encryption` | SSE-KMS using a **dedicated secondary evidence KMS key**, customer-managed, in the secondary evidence account |
| `secondary_access_control_model` | Block Public Access; bucket-owner-enforced ownership; private only; side-specific IAM roles per §7; no delete, no retention-bypass, and no Hetzner authority |
| `secondary_owner` | `PENDING_RATIFICATION` — the `EVIDENCE_SECONDARY_ACCOUNT_CUSTODIAN` role (§13.1), now the AWS-side custodian |
| `secondary_read_back_verification_method` | Full `GetObject` by exact bucket, key, and `versionId`; stream every byte |
| `secondary_byte_count_verification_method` | Count bytes during full read-back; require equality with canonical count and with the Hetzner copy |
| `secondary_sha256_verification_method` | BuyerRecon computes SHA-256 over the full read-back; require equality with the canonical digest and with the Hetzner read-back digest |
| `secondary_immutable_retention_verification` | `GetObjectRetention` by exact `versionId` confirming `COMPLIANCE` and a conforming `retain_until` |
| `secondary_audit_source` | CloudTrail S3 data events in the secondary evidence account, covering object writes, reads, retention operations, and attempted deletes |
| `secondary_failure_behavior` | Fail closed. See §10 |

---

## 6. Provider-independence invariant

Superseding architecture selection §5.3. The primary and secondary must differ
across every one of:

```text
cloud provider
administrative control plane
account/project boundary
credential boundary
storage bucket
region/location
encryption-control boundary
audit/control surface
cleanup path
```

The architecture must ensure:

```text
one ordinary Hetzner operational mistake cannot destroy the AWS copy
one ordinary AWS operational mistake cannot destroy the Hetzner copy
one provider outage does not remove both copies
one runtime credential does not control both providers
```

Sharing any one of the nine boundaries is a copy-independence violation and fails
retention readiness. An authoritative object ID is now the tuple of **provider**,
account-or-project, location, bucket identifier, object key, and provider version
ID.

### 6.1 Why this is not a weakening

Under the superseded topology, independence was enforced by configuration inside
one vendor's control plane: two accounts, two organizations, two IAM boundaries,
two KMS keys — all administered through AWS, billed through AWS, and subject to
AWS-level enforcement, suspension, and account-deletion authority. Every one of
those separations could be collapsed by misconfiguration.

Under this amendment the separation is **structural**. A Hetzner S3 access key
cannot address an AWS endpoint and an AWS IAM role cannot address Hetzner Object
Storage. Cross-store authority is not merely prohibited by policy; it is
impossible by construction.

```text
security_invariant_weakened=false
provider_failure_domain_status=STRENGTHENED
credential_failure_domain_status=STRUCTURALLY_ENFORCED
```

---

## 7. Credential model amendment

Superseding ratification §7.1–7.5. Provider-qualified identities replace the six
AWS-symmetric identities.

### 7.1 Required identities

```text
Hetzner primary writer credential      → Hetzner only
Hetzner primary readback credential    → Hetzner only
Hetzner manifest writer credential     → Hetzner only
Hetzner cleanup-authorization writer   → Hetzner only

AWS secondary writer identity          → AWS only
AWS secondary readback identity        → AWS only
AWS manifest writer identity           → AWS only
AWS cleanup-authorization writer       → AWS only
```

```text
one_identity_controls_both_evidence_stores=false
```

No credential, key pair, role, or automation principal may hold authority on both
providers. This is verified structurally, not by policy inspection alone.

### 7.2 Truthful statement of differing provider credential semantics

The two providers do **not** expose identical credential semantics, and this
document does not pretend otherwise.

| Concern | AWS secondary | Hetzner primary |
|---|---|---|
| Credential type | Temporary IAM role session via federated workload identity | Long-lived S3 access key pair. Hetzner documents no temporary/session-token credential type |
| Default scope | Explicit IAM policy, deny-by-default | Project-wide: "each key pair is automatically valid for every Bucket within the same project" |
| Narrowing mechanism | IAM policy and session policy | Bucket policies, which can allowlist individual keys and replace `s3:*` with granular actions |
| Lifetime control | Session expiry | Key rotation and revocation via Hetzner Console |
| Creation surface | IAM / STS | Hetzner Console; not available via the S3 API |

**Amended requirement.** The ratified R3 value `persistent_access_keys_allowed=false`
is superseded by a provider-qualified rule:

```text
short-lived federated role sessions are REQUIRED where the provider supports them (AWS)

provider-scoped long-lived keys are PERMITTED only where the provider offers no
short-lived credential type (Hetzner), and only under all of:
  held in approved secret custody
  never committed to a repository or embedded in any artifact
  scoped by bucket policy to the evidence bucket and the minimum action set
  a defined rotation and revocation model
  no authority on the other provider
```

The prohibitions in ratification §7.2 remain in force unchanged for both
providers:

```text
credentials committed to Git
credentials embedded in source
credentials embedded in Golden artifacts
credentials embedded in manifests or cleanup-authorization records
credentials printed in logs
credentials copied into Claude/Codex prompts
credentials stored in /tmp
one credential capable of writing both evidence stores
```

### 7.3 Blast-radius note

A leaked Hetzner evidence writer key can write new objects into the evidence
bucket. It **cannot** delete a retained object version, shorten a retention
period, or bypass Object Lock, because compliance mode forbids those operations
for every principal including the account owner. It has no AWS authority. The
deletion-resistance invariant is therefore enforced by the bucket's Object Lock
configuration rather than by credential policy, which is a stronger enforcement
point, not a weaker one.

### 7.4 Cleanup-authorization writer boundary

Unchanged in substance and now applied per provider. Each side's
cleanup-authorization writer may write only that side's immutable
`cleanup_authorization_record`. On neither provider may it delete an object
version, shorten retention, bypass Object Lock, destroy an encryption key, or
administer evidence objects across both stores.

---

## 8. Encryption and control-plane amendment

### 8.1 Provider-neutral invariant

The previous invariant `primary AWS KMS key != secondary AWS KMS key` is
superseded by:

```text
the primary and secondary encryption/control planes MUST be independent

loss or compromise of one encryption/control plane MUST NOT simultaneously
destroy or expose both retained evidence copies
```

### 8.2 Selected mechanisms

```text
Hetzner primary:
  provider-supported storage/encryption capability plus a dedicated Hetzner
  credential and control boundary, administered separately from AWS

AWS secondary:
  SSE-KMS using a dedicated secondary evidence KMS key
```

The invariant is satisfied structurally: the two control planes are two different
providers with separate administration, separate credentials, and no shared key
authority. No AWS principal can affect the Hetzner copy's readability and no
Hetzner principal can affect the AWS copy's readability.

### 8.3 Truthful record of Hetzner encryption capability

```text
Hetzner default data-at-rest encryption of objects: NONE
Hetzner server-side encryption options: SSE-C only
Hetzner SSE-S3 equivalent: NOT AVAILABLE
Hetzner KMS equivalent: NOT AVAILABLE
Hetzner copy of SSE-C encrypted objects: NOT SUPPORTED
```

No key-management service is invented for Hetzner, and none may be introduced by
an implementation without its own separate authorization.

### 8.4 SSE-C adoption is a bounded downstream decision

The governing feasibility result did **not** establish that client-side
encryption is required for Hetzner to satisfy the independence invariant, so
client-side encryption is **not** introduced by this amendment.

Whether to enable Hetzner SSE-C for the primary copy remains a bounded decision
for G2 ratification, because enabling it creates a new key-custody obligation:

```text
if SSE-C is enabled, BuyerRecon becomes the custodian of the primary-copy
encryption key for at least the full 730-day retention horizon

loss of that key renders the primary copy unreadable, and Object Lock does not
protect against it
```

That is the same class of risk already recorded for KMS-key deletion at
ratification §6.5, relocated to a different custodian. It must be ratified
explicitly with its own separation-of-authority treatment, or SSE-C must be
explicitly declined. It may not be adopted silently.

---

## 9. Provider-qualified retained-object identity and the dual-write model

### 9.1 Provider-qualified identity

Superseding the per-copy field set in architecture selection §10.1–10.3 wherever
it assumed AWS `versionId` semantics. For **every** retained object version:

```text
provider
account_or_project
location_or_region
bucket
object_key
provider_version_id
byte_count
sha256
write_confirmed
read_back_verified
retention_mode
retention_expiry
immutable_retention_verified
```

`provider_version_id` is opaque and provider-defined. No component may assume
AWS `versionId` format, ordering, or semantics for the Hetzner copy. Provider-
specific extra metadata may be carried separately and must never replace these
fields. A missing `provider` field is a fatal identity error.

Store-level, provider-level, phase-level, or pair-level status never substitutes
for these per-copy fields.

### 9.2 Eight-object lifecycle — unchanged

```text
2 Golden JSON copies                     1 Hetzner, 1 AWS
2 authority-evidence copies              1 Hetzner, 1 AWS
2 execution-retention-manifest copies    1 Hetzner, 1 AWS
2 cleanup-authorization-record copies    1 Hetzner, 1 AWS

total=8 retained object versions
```

### 9.3 Phase 1 — unchanged conceptually

```text
record_type=execution_retention_manifest
schema_version=execution_retention_manifest_v0_1
cleanup_authorized=false
```

The Phase 1 manifest binds **both provider copies** of each evidence object,
using the §9.1 field set per copy, and carries four separate evidence retention
expiries. It is serialized once, never rewritten, and stored as two independently
retained immutable copies — one Hetzner, one AWS.

### 9.4 Phase 2 — unchanged conceptually

```text
record_type=cleanup_authorization_record
schema_version=cleanup_authorization_record_v0_1
cleanup_authorized=true
```

It identifies the exact Phase 1 manifest copies on both providers using the §9.1
field set, and is itself stored as two independently retained immutable copies —
one Hetzner, one AWS. Cleanup remains prohibited until **both** provider copies
of the Phase 2 record are read back and verified.

The digest self-exclusion rule, the frozen 13-step lifecycle, and the cleanup
gate conditions are carried forward unchanged.

### 9.5 Dual-write model

```text
provider_native_replication_required=false
```

The architecture must not depend on Hetzner supporting S3 replication; Hetzner
documents Replication as not supported. BuyerRecon performs the dual write
itself:

```text
produce canonical bytes

→ write Hetzner primary
→ read back Hetzner primary
→ verify byte count and SHA-256

→ write the exact same canonical bytes to AWS secondary
→ read back AWS secondary
→ verify byte count and SHA-256

→ require Hetzner SHA-256 == AWS SHA-256
→ require Hetzner byte_count == AWS byte_count

→ only then continue the retention-manifest lifecycle
```

The exact write order may be implementation-defined provided failure remains
fail-closed, but both writes and both read-backs are mandatory and neither may be
skipped, inferred, or satisfied by a provider replication event.

---

## 10. Failure behavior

All fail closed. Any of the following sets `cleanup_authorized=false`, prevents
emission of a Phase 2 cleanup authorization record, and permits no single-copy,
single-provider, or ephemeral fallback:

```text
Hetzner write failure
AWS write failure
Hetzner read-back failure
AWS read-back failure
provider-version identity unavailable on either side
byte-count mismatch
SHA-256 mismatch
Hetzner Object Lock missing or misconfigured
AWS Object Lock missing or misconfigured
governance mode where compliance mode is required, on either provider
versioning absent on either provider
retention mismatch, including per-copy expiry disagreement
credential holding cross-provider authority
either provider copy missing
either provider unavailable before dual-copy verification
attempted rewrite or in-place update of any immutable object version
record digest computed with any exclusion other than the record's own digest field
cleanup authorization inferred from uploads, absence of errors, or AMS completion
```

Object Lock may retain a partial failed-attempt object on either provider until
expiry. That residue is diagnostic custody material, not a qualifying pair, and
cannot be relabelled to manufacture success.

---

## 11. Mandatory A1 test matrix — provider-qualified

The mandatory A1 matrix is preserved in full. Only naming becomes
provider-qualified; no case is dropped and no idealized case is added.

### 11.1 Preserved unchanged in substance

```text
primary-copy write failure          → Hetzner write failure
secondary-copy write failure        → AWS write failure
primary read-back failure           → Hetzner read-back failure
secondary read-back failure         → AWS read-back failure
SHA-256 mismatch
byte-count mismatch
Phase 1 manifest write failure
Phase 1 manifest contradiction
premature cleanup rejection
artifact survival after execution-directory deletion
primary-store outage                → Hetzner outage
secondary-store outage              → AWS outage
Phase 2 record missing
Phase 2 record mismatch
digest-exclusion regression
immutable-record mutation attempt
```

### 11.2 Object Lock and retention cases — per provider

```text
Object Lock absent                  exercised on Hetzner and on AWS
Object Lock misconfigured           exercised on Hetzner and on AWS
governance instead of compliance    exercised on Hetzner and on AWS
versioning absent                   exercised on Hetzner and on AWS
retention mismatch                  per copy, both providers
```

### 11.3 Copy-independence violation — amended sub-cases

Superseding architecture selection §13.1.3. Each is its own mandatory case:

```text
same provider on both sides          (new — replaces "same account")
same account_or_project
same location_or_region
same bucket
same credential authority            (replaces "same IAM authority")
same encryption-control plane        (replaces "same KMS key")
same custodian
cleanup-path collapse
```

Expected result is unchanged:

```text
copy_independence_status=FAIL
retention readiness remains blocked
cleanup authorization is not emitted
```

### 11.4 New mandatory cases arising from provider qualification

```text
provider field missing from retained-object identity          → identity rejected, cleanup blocked
AWS versionId semantics assumed for the Hetzner copy          → rejected, cleanup blocked
credential presented with authority on both providers         → rejected before any write
provider-native replication relied upon in place of dual write → rejected, cleanup blocked
```

### 11.5 B3 matrix unchanged

The mandatory B3 selected-producer matrix, including premature `Finalize`, late
duplicate publication, late conflicting publication, unclosed publisher at
`Finalize`, and publisher-registration mismatch, is carried forward with no
change whatsoever.

---

## 12. Infrastructure implementation surface

Superseding architecture selection §12 storage rows and ratification §10.1–10.2.
**Nothing here is provisioned, created, named, or credentialed by this document.**

| Resource | Mandatory properties | Assignment gate |
|---|---|---|
| Hetzner account/project (primary) | Dedicated to evidence custody; administratively separable from the AWS side; owned by `EVIDENCE_PRIMARY_ACCOUNT_CUSTODIAN` | `G2` |
| Hetzner Object Storage bucket (primary) | Object Lock enabled **at creation**, compliance mode, versioning (automatic), private only, dedicated evidence credentials | `G2` |
| Hetzner location (primary) | One ratified location from Nuremberg, Falkenstein, Helsinki | `G2` |
| Hetzner evidence credentials | Dedicated key pairs, bucket-policy-scoped, in approved secret custody, no AWS authority | `G2` |
| AWS evidence account (secondary) | **One** dedicated or explicitly isolated evidence account; owned by `EVIDENCE_SECONDARY_ACCOUNT_CUSTODIAN` | `G2` |
| AWS region (secondary) | One dedicated ratified region | `G2` |
| AWS S3 bucket (secondary) | Versioning, Object Lock compliance mode, Block Public Access, bucket-owner-enforced | `G2` |
| AWS KMS key (secondary) | One dedicated customer-managed key in the secondary account | `G2` |
| AWS IAM roles and trust policies | Side-specific roles per §7; federated trust; no static keys; no Hetzner authority | `G2` |
| AWS CloudTrail (secondary) | Trail or event data store covering S3 object writes, reads, retention operations and attempted deletes | `G2` |
| Retention policy binding | `BR-GOLDEN-EVIDENCE-RETENTION-V0_1` applied to all eight object versions; extend-only | Ratified, unchanged |
| Primary/secondary custodians | The ten canonical Role IDs, assigned to named humans | `G1` |

```text
hetzner_resources_created=0
aws_resources_created=0
credentials_created=0
```

### 12.1 Reduced provisioning surface

The former surface required two AWS accounts in two organizations, two regions,
two buckets, two KMS keys, roughly twelve IAM roles, two CloudTrail trails, an
Organizations account-creation ceremony, and two unique account email identities.
The amended surface requires one Hetzner project and bucket on infrastructure
BuyerRecon already operates, plus one AWS account, one region, one bucket, one
KMS key, side-specific IAM roles, and one trail.

### 12.2 AMS and backend implementation surfaces unchanged

The AMS implementation surface (ratification §8) is untouched. The backend
implementation surface (ratification §9) is untouched in responsibility; only the
retention coordinator's target stores become provider-qualified, and the
per-copy field set becomes §9.1. The backend remains a consumer and validator and
is never the Policy Pass 2 authority producer.

---

## 13. Roles, authority separation, and audit

### 13.1 Canonical Role IDs preserved

All ten canonical Role IDs from ratification §5.1 are **preserved without
rename**, to avoid breaking the ratified contract and the G1 assignment ceremony.
Only their provider mapping is amended:

| Role ID | Amended provider responsibility |
|---|---|
| `EVIDENCE_PRIMARY_ACCOUNT_CUSTODIAN` | Hetzner account/project lifecycle, including closure authority |
| `EVIDENCE_SECONDARY_ACCOUNT_CUSTODIAN` | AWS evidence account lifecycle, including closure authority |
| `KMS_PRIMARY_CUSTODIAN` | Primary-side **encryption-control-plane** custodian. Hetzner exposes no KMS; this role owns the Hetzner credential/control boundary and, if SSE-C is adopted under §8.4, the primary-copy key custody |
| `KMS_SECONDARY_CUSTODIAN` | Secondary AWS KMS key lifecycle, deletion authority, and key policy |
| `BUCKET_OBJECT_LOCK_ADMINISTRATOR_PRIMARY` | Hetzner bucket configuration, Object Lock retention, bucket policies |
| `BUCKET_OBJECT_LOCK_ADMINISTRATOR_SECONDARY` | AWS bucket configuration, versioning, Object Lock retention, lifecycle |
| `RETENTION_POLICY_APPROVER` | Unchanged; applies `BR-GOLDEN-EVIDENCE-RETENTION-V0_1` identically to both providers |
| `CLEANUP_AUTHORIZATION_APPROVER` | Unchanged; approves Phase 2 emission only on full gate pass |
| `IMPLEMENTATION_OPERATOR` | Unchanged |
| `INDEPENDENT_REVIEWER` | Unchanged |

`required_role_count=10` is unchanged. All separation rules in ratification §5.2
and §5.3 remain in force, now read as primary-side = Hetzner and secondary-side =
AWS.

```text
g1_named_assignment_status=BLOCKED_USER_INPUT_REQUIRED
```

No human is assigned by this amendment.

### 13.2 Authority-separation matrix — amended columns

Superseding the audit and authority columns of ratification §6 only.

| Power | Primary-side (Hetzner) authority | Secondary-side (AWS) authority | Audit source |
|---|---|---|---|
| `account_closure` | `EVIDENCE_PRIMARY_ACCOUNT_CUSTODIAN`, Hetzner account/project | `EVIDENCE_SECONDARY_ACCOUNT_CUSTODIAN`, AWS account | Hetzner Console administrative records; AWS Organizations and CloudTrail management events |
| `encryption_control_plane_destruction` | `KMS_PRIMARY_CUSTODIAN`, Hetzner credential/control boundary and SSE-C key custody if adopted | `KMS_SECONDARY_CUSTODIAN`, `ScheduleKeyDeletion` / `PutKeyPolicy` on the AWS key | Hetzner Console credential records; AWS CloudTrail KMS management events |
| `bucket_administration` | `BUCKET_OBJECT_LOCK_ADMINISTRATOR_PRIMARY` | `BUCKET_OBJECT_LOCK_ADMINISTRATOR_SECONDARY` | Hetzner Console bucket/policy records; AWS CloudTrail bucket management events |
| `retention_policy_administration` | `RETENTION_POLICY_APPROVER`, extension-only | `RETENTION_POLICY_APPROVER`, extension-only | The ratified policy record; per-object `retain_until` recorded in the Phase 1 manifest for both copies |
| `cleanup_authorization` | `CLEANUP_AUTHORIZATION_APPROVER` | `CLEANUP_AUTHORIZATION_APPROVER` | Both Phase 2 copies, plus AWS CloudTrail S3 data events on the secondary side |

Approval requirements and prohibited combinations from ratification §6 are
carried forward unchanged.

### 13.3 Audit invariant — amended and stated truthfully

The requirement for a CloudTrail-equivalent on **both** sides is superseded. The
invariant becomes provider-neutral:

```text
each provider side must provide sufficient observable evidence to verify:
  write
  retention state
  exact retained object/version
  read-back
```

Hetzner satisfies this through write confirmation, provider-assigned version ID,
`GetObjectRetention`, and full read-back by exact version. AWS satisfies it the
same way and **additionally** provides CloudTrail.

```text
Hetzner provider access/audit logging: NOT SUPPORTED
```

That is recorded truthfully and no Hetzner CloudTrail equivalent is invented.

**Consequence, stated plainly.** Administrative-action forensics — proving *who*
attempted an administrative operation and *when* — is available on the AWS side
and is **not** available from Hetzner provider logging. This is a genuine
reduction relative to the superseded dual-AWS topology, and it is accepted here
for these reasons:

```text
evidence integrity is proven by read-back, provider version identity, byte count,
SHA-256, retention state, and the immutable Phase 1/Phase 2 records — none of
which depend on provider logging

compliance-mode retention makes deletion impossible for every principal during
retention, so the forensic gap cannot be exploited to destroy the primary copy

the independent AWS secondary copy survives any primary-side administrative
action and carries full CloudTrail coverage
```

BuyerRecon's immutable manifest plus read-back and hash verification remains the
canonical cross-provider retention evidence. No logging requirement stronger than
the merged governing contract is invented.

---

## 14. Static gate amendment

No static gate is implemented by this document. Obligations only.

| Regression to prevent | Gate | Status |
|---|---|---|
| Persistent or embedded AWS credential secrets | `check:aws-credential-secrets` | Preserved, still `REQUIRED` / `NOT_IMPLEMENTED` / `NOT_VERIFIED` |
| One identity or credential spanning both evidence stores | `check:cross-store-credential-authority`, amended to be provider-neutral | Preserved and extended; `REQUIRED` / `NOT_IMPLEMENTED` / `NOT_VERIFIED` |
| Both evidence stores resolving to the same provider | `check:evidence-store-independence`, amended: reject same `provider`, same `account_or_project`, same `location_or_region`, same bucket, same encryption-control plane | New obligation |
| Hetzner and AWS identities collapsing into one shared credential mechanism | `check:cross-store-credential-authority` | New obligation |
| `provider` field missing from retained-object identity | New `check:provider-qualified-object-identity` | New obligation |
| AWS-specific version semantics assumed for Hetzner | `check:provider-qualified-object-identity` | New obligation |
| Cleanup occurring before both provider copies verify | `check:cleanup-gate` | Carried forward, provider-qualified |
| Ephemeral-only canonical artifact storage | `check:golden-artifact-durability` | Carried forward |
| Missing Object Lock compliance mode on either provider | `check:evidence-store-independence` | Carried forward, provider-qualified |
| Backend-generated Pass 2 authority | `check:customer-output-boundary`, extended | Carried forward unchanged |
| Operator-supplied authority claims | `check:customer-output-boundary`, extended | Carried forward unchanged |
| Unregistered store/credential names | `check:constants` | Existing, unchanged |

All new gates are L1/static and prove no runtime behaviour.

---

## 15. Amended selection record and gate state

```text
status=HETZNER_AWS_A1_ARCHITECTURE_AMENDMENT_V0_1

previous_A1_architecture=AWS_S3_DUAL_ACCOUNT_DUAL_REGION_OBJECT_LOCK_COMPLIANCE_EVIDENCE_VAULT
new_A1_architecture=HETZNER_PRIMARY_AWS_SECONDARY_IMMUTABLE_EVIDENCE_VAULT

amendment_reason=operational fit with BuyerRecon's Hetzner-first infrastructure while preserving independent immutable evidence retention

durable_storage_selection_status=SELECTED
selection_id=A1-HETZNER-PRIMARY-AWS-SECONDARY-OBJECT-LOCK-COMPLIANCE-V0_1

hetzner_primary_status=SELECTED
aws_secondary_status=SELECTED

provider_failure_domain_status=STRENGTHENED
credential_failure_domain_status=STRUCTURALLY_ENFORCED
encryption_control_plane_status=INDEPENDENT
dual_write_status=FROZEN
provider_native_replication_required=false

provider_qualified_object_identity_status=DEFINED
eight_object_lifecycle_status=UNCHANGED
phase_1_manifest_status=UNCHANGED
phase_2_cleanup_authorization_status=UNCHANGED
cleanup_gate_status=UNCHANGED

hetzner_object_lock_requirement_status=REQUIRED_AT_BUCKET_CREATION
hetzner_compliance_retention_requirement_status=REQUIRED
hetzner_versioning_requirement_status=AUTOMATIC_WITH_OBJECT_LOCK
aws_object_lock_requirement_status=REQUIRED
aws_sse_kms_requirement_status=REQUIRED

security_invariant_weakened=false
B3_changed=false
retention_policy_changed=false
Policy_Pass_2_contract_changed=false

retention_policy_id=BR-GOLDEN-EVIDENCE-RETENTION-V0_1
minimum_retention_duration_days=730
early_deletion_allowed=false

G1-NAMED-ASSIGNMENT=BLOCKED_USER_INPUT_REQUIRED
G2-RESOURCE-IDENTIFIER=BLOCKED_SEPARATE_AUTHORIZATION_REQUIRED
G3-CONSTANT-REGISTRATION=BLOCKED_ON_G2
AMS-BASE-REPIN=CLOSED
repinned_ams_implementation_base_sha=3e280b40e67d7d8be0ad163a13cf22e31c770d9a

implementation_authorized=false
hetzner_provisioning_authorized=false
aws_provisioning_authorized=false
credential_creation_authorized=false
replacement_session_execution_authorized=false
browser_execution_authorized=false
AMS_execution_authorized=false
packaging_authorized=false

hetzner_resources_created=0
aws_resources_created=0
credentials_created=0
storage_provisioned=false
producer_implemented=false
```

### 15.1 Amended G2 scope

The previous dual-AWS G2 provisioning attempt created nothing. The future G2
scope becomes:

```text
one Hetzner primary evidence vault
one AWS secondary evidence vault
```

not two AWS accounts. G2 remains `BLOCKED_SEPARATE_AUTHORIZATION_REQUIRED` and is
not opened by this document.

### 15.2 Open decision carried to G2 ratification

```text
Hetzner SSE-C adoption and, if adopted, primary-copy key custody for the full
730-day horizon with its own separation-of-authority treatment (see §8.4)
```

---

## 16. Explicit prohibitions

This amendment does not permit:

```text
provisioning any Hetzner project, bucket, or credential
provisioning any AWS account, region, bucket, KMS key, IAM role, or trail
creating, reading, testing, printing, embedding, or committing credentials
registering any constant in .claude/constants.md, config/constants.ts, or .claude/production-parameters.md
assigning any named human to any Role ID
reopening the OPTION_A versus OPTION_B comparison
reopening B3, Policy Pass 2 semantics, or the FinalDecisionPublicationLedger design
changing the two-phase record model, the eight-object lifecycle, or the cleanup gate
changing BR-GOLDEN-EVIDENCE-RETENTION-V0_1
introducing client-side encryption or a new key-management service
relying on provider-native replication in place of the dual write
claiming Object Lock mitigates provider-account closure or encryption-key loss
inventing a Hetzner CloudTrail equivalent
editing source code, tests, runtime configuration, or infrastructure
authorizing implementation, provisioning, or replacement-session execution
```

---

**End of A1 architecture amendment v0.1.** This document is a docs-only
amendment. It requires one bounded independent docs-only review before the
hybrid G2 provisioning scope may be authorized.
