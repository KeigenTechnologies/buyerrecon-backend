# BuyerRecon PR#19c: Sprint 4 Governance Runtime Handoff

> Docs-only contract handoff. No code. No DB change. No migration. No
> `schema.sql` change. No production command. No website change. No
> customer-output activation. No report-runtime activation. No deletion
> execution. No retention job execution. No monitoring integration
> execution. No auth / role runtime change. No Lane writer. No
> runtime scoring. No AMS Trust / Pass 1 / Pass 2 runtime. No Gate
> 4C execution. No endpoint flip. No canary. No secrets.

---

## 1. Status / verdict

**Verdict: CONTRACT_HANDOFF_ONLY — no implementation, no production execution, no Gate 4C approval.**

PR#19c is the contract handoff for the **Sprint 4 Governance
Runtime layer** identified as Track B by PR#19a §3 and PR#19a §5.
It defines the table / type contracts for the audit-log, retention,
deletion, suppression-tombstone, deletion-receipt, retention-job,
monitoring-metric, alert-threshold, incident-response, tenancy, and
role-matrix surfaces required before any Sprint 4 implementation PR
may be opened.

PR#19c is purely a docs-only contract artefact. It:

- defines the **shape** that future Track B implementation PRs must
  conform to,
- does **not** create any DB table, migration, `schema.sql` entry,
  monitoring integration, alert route, audit row, retention job,
  deletion request, suppression tombstone, deletion receipt,
  incident record, role grant, or runtime auth surface,
- does **not** activate any customer-visible governance surface,
- does **not** flip any of the eleven PR#18ab §9 governance locks,
- does **not** authorise any Sprint 4 implementation PR (the next
  step is the first Sprint 4 implementation PR opened under its own
  Helen GO),
- does **not** authorise any Gate 4C compatibility-plan work,
  Gate 4C canary, Gate 4D observation, or Gate 4E Track A /
  Playwright work.

Anchored governance phrases (carried verbatim from
`docs/ops/cutover-hard-gates.md` §7):

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Carry-forward governance posture

PR#19c inherits the following posture from the merged base
(`ba2301a` — PR#19b merge):

- **Gate 4B artifact / config / rollback re-audit:** **non-`BLOCKED`**
  (PR#18aa PASS, recorded on base at PR#18ab merge).
- **Gate 4C `endpointUrl` re-flip execution:** **still unapproved /
  `BLOCKED_PENDING_COMPATIBILITY_PLAN`** per PR#18ac (sub-status
  recorded; pending compatibility-plan chain PR#18ad → PR#18aj).
- **Gate 4D organic observation:** unapproved.
- **Gate 4E Track A / Playwright:** unapproved.
- **PR#19a deep-research handoff index:** merged on base; defines
  Track A (Sprint 3), Track B (Sprint 4 — this PR), Track C
  (Sprint 5), Track D (Sprint 2 carry-forward).
- **PR#19b Sprint 3 external output contract handoff:** merged on
  base; remains **inactive** until a separate Sprint 3
  implementation PR + a separate governance PR that populates the
  `safe_claims` dictionary and flips the relevant §9 locks.
- **PR#17s / PR#18w 26-row warning preserved** (no delete, mutate,
  annotate, normalise on the production cluster).

### 2.1 Eleven PR#18ab §9 governance locks (in force)

```
customer_claim_allowed=false
customer_visibility_allowed=false
lane_output_allowed=false
lane_write_allowed=false
runtime_scoring_allowed=false
ams_trust_runtime_allowed=false
pass1_runtime_allowed=false
pass2_runtime_allowed=false
dashboard_customer_output_allowed=false
sales_claim_upgrade_allowed=false
allowed_customer_language=[]
```

No track in §4 – §16 of this handoff flips any of those locks.
Each Track B implementation PR must independently restate this set
(or a strict superset) in its own header.

### 2.2 Upstream dependency: ProductContextProfile v0.1 (PR #76)

`docs/contracts/product-context-profile-v0.1.md` (locked via PR #76,
merged at base `0f98967`) is now the upstream semantic-configuration
contract. Sprint 4 governance runtime, when later activated, must
respect it:

- `site_mapping` is a semantic adapter (route/expression → standard
  BuyerRecon semantics), not part of the industry/category tree.
- the buying-role lens is evidence/category input, not a final
  identity claim (allowed: "behaviour consistent with
  finance/procurement evaluation"; forbidden: "this visitor is the
  CFO").
- no customer-private scoring code, customer-private if/else logic,
  or customer-private custom model.
- no silent mutation of old observations after a template/mapping
  update — old observations must remain explainable under their
  original version stamps.

This note is a forward-reference only. It does **not** activate
governance runtime, does **not** flip any of the eleven PR#18ab §9
locks above, does **not** modify the `safe_claims` dictionary, and
does **not** authorize customer output.

---

## 3. Governance runtime purpose

BuyerRecon v1 does **not** need enterprise-compliance theatre
(SCIM, SOC 2-level continuous monitoring, customer-controlled
fine-grained per-row ACLs, complex policy-as-code engines). It
**does** need a **minimum trustworthy governance runtime** so the
product can credibly tell paying customers "we have a custody chain
on your data and we can prove it on demand".

The minimum trustworthy v1 governance runtime is five surfaces:

1. **Layered retention.** Per-data-class TTL, not a single global
   TTL. Raw collector bodies don't persist; normalised evidence
   has its own window; audit and admin logs have a long window;
   backups expire naturally. See §5.
2. **Executable deletion.** A real workflow — request → scope →
   dry-run → approve → suppression-tombstone → execute → verify
   → receipt — not a "we'll ask DBs to forget" promise. See §6 /
   §7 / §8.
3. **Immutable admin audit.** Every grant change, role change,
   site mutation, token rotation, retention-policy edit, and
   deletion lifecycle event lands in `audit_events`, append-only,
   with `before_hash` / `after_hash` so a diff is reproducible
   without storing raw before / after values. See §4.
4. **Actionable monitoring.** Metric families and thresholds that
   trigger a ticket or a page when an operator can act, not when
   noise hits a moving average. See §10 / §11.
5. **Fixed tenant access boundaries.** `workspace` / `project` /
   `site` three-layer tenancy with mandatory `workspace_id` on
   every business row and `WHERE workspace_id` first on every read.
   No implicit cross-tenant sharing. See §13 / §14.

Plus the negative-test set (§15) that proves the boundaries hold,
and the external-audit trigger conditions (§16) that say when the
team should expect to lift the v1 ceiling.

PR#19c does **not** implement any of these surfaces. It records
the contracts they must conform to so that the future
implementation PRs (proposed sequencing in §17) can pick them up
under their own explicit Helen GO.

---

## 4. `audit_events` contract

`audit_events` is the **first-class core table** for governance
custody. It is append-only and is consulted before any deletion,
retention, role-change, or break-glass action is considered
complete.

### 4.1 Table-style contract (field-level)

```ts
interface AuditEvent {
  // Identity
  audit_event_id: string;                   // ULID or UUIDv7, monotonic-ish
  occurred_at: string;                      // ISO 8601 UTC, when the action happened
  created_at: string;                       // ISO 8601 UTC, when the row was persisted

  // Tenancy (mandatory; see §13)
  workspace_id: string;
  project_id: string | null;                // null = workspace-scope action
  site_id: string | null;                   // null = workspace- or project-scope action

  // Actor
  actor_type: "user" | "service" | "system" | "support_break_glass";
  actor_id: string;                         // stable user_id / service_id / system marker
  actor_role_snapshot: string;              // role at action time (e.g. "WorkspaceAdmin"); not current role

  // Action
  action: string;                           // one of the §4.2 action enum
  target_type: string;                      // e.g. "site", "token", "member", "deletion_request"
  target_id: string;                        // stable id of the target object

  // Outcome
  outcome: "success" | "failure" | "denied" | "partial";
  reason_code: string | null;               // categorical only; never raw error body

  // Source
  source: "ui" | "api" | "cli" | "internal_job" | "support_break_glass";
  request_id: string | null;                // shared with runtime-proof; internal only

  // Diffs for config-style actions (no raw values stored)
  before_hash: string | null;               // sha256 of canonicalised before-state
  after_hash: string | null;                // sha256 of canonicalised after-state

  // Categorical context only — no PII, no raw payloads, no raw IPs
  ip_truncated: string | null;              // e.g. "203.0.113.0/24"; never the full address
  ua_hash: string | null;                   // sha256 of normalised User-Agent; never the raw UA

  // Structured optional metadata; categorical-only by contract
  metadata_json: Record<string, unknown> | null;
}
```

### 4.2 Required action enum (minimum v1 set)

The action enum is the **first** governance surface to lock down.
A Track B implementation PR may add actions but may not rename or
remove these. The enum must cover every state transition in the
§6 deletion workflow, every suppression-tombstone lifecycle step
(§7), every retention-job lifecycle step (§5 / §9), every
audit-subsystem outcome (so the negative test in §15.7 has a
real action to land on), and every Gate-4C / 4D / 4E proof
emission shape.

- **Auth / member:**
  `login_success`, `login_failure`, `mfa_enable`, `mfa_remove`,
  `member_invite`, `member_remove`.
- **Role:**
  `role_grant`, `role_revoke`.
- **Site / token:**
  `site_create`, `site_update`, `site_delete`,
  `token_create`, `token_rotate`, `token_revoke`.
- **Retention policy:**
  `retention_policy_change`.
- **Retention jobs (§9):**
  `retention_dry_run_start`, `retention_dry_run_complete`,
  `retention_dry_run_fail`,
  `retention_execute_start`, `retention_execute_complete`,
  `retention_execute_fail`,
  `retention_execute_blocked_snapshot_mismatch`.
- **Deletion lifecycle (every §6 state transition; cannot be
  skipped):**
  `deletion_request_create`,
  `deletion_request_scope`,
  `deletion_request_dry_run_ready`,
  `deletion_request_approve`,
  `deletion_request_cancel`,
  `deletion_request_execute_start`,
  `deletion_request_execute_complete`,
  `deletion_request_execute_fail`,
  `deletion_request_verification_start`,
  `deletion_request_verification_complete`,
  `deletion_request_verification_fail`,
  `deletion_receipt_emit`,
  `deletion_receipt_emit_fail`,
  `deletion_request_fail`.

  Naming family is `deletion_request_*` for state-machine
  transitions on the request itself, and `deletion_receipt_*`
  for actions on the `DeletionReceipt` object (§8) which is a
  distinct artefact emitted at the end of the workflow.

  Failure-action selection rule: every transition writes a
  failure-side action when it fails. The failure action **must
  be the most specific available** — `deletion_request_execute_fail`
  for execute-stage failures, `deletion_request_verification_fail`
  for verification-stage failures, `deletion_receipt_emit_fail`
  for receipt-emission failures. The generic
  `deletion_request_fail` is used **only** when no more specific
  failure action applies — e.g. scope-stage failure, dry-run-prep
  failure (the prep step itself, not the dry-run job in §9
  which has `retention_dry_run_fail`), approval-stage failure
  (approver returns error), suppression-prep failure (the prep
  to call `suppression_tombstone_create` errors before the
  tombstone is written; note `suppression_tombstone_create`
  itself fails via its own action and metric path).
- **Suppression-tombstone lifecycle (§7):**
  `suppression_tombstone_create`,
  `suppression_tombstone_retract`,
  `suppression_tombstone_expire`.
- **Audit subsystem outcomes (used by the §15.7 audit-write-
  failure negative test and by the §10 / §11 audit-write-
  failure metric / alert pair):**
  `audit_write_success` — emitted when an upstream action's
  audit row was persisted normally. Optional in v1; useful for
  reconciliation when the upstream action and the audit row are
  written across a transaction boundary.
  `audit_write_fail` — emitted via the audit subsystem's
  fallback / error channel (e.g. structured log + monitoring
  metric increment) when an attempt to write a primary
  `audit_events` row failed. Treats this as the audit-subsystem
  failure mode itself, not as a "denied" decision.
  `audit_write_pending` — emitted when an upstream action
  proceeded but its audit row could not be persisted
  synchronously (e.g. logout already in progress). The pending
  state is reconciled by a separate retry / sweeper job; the
  reconciliation outcome lands as `audit_write_success` or
  `audit_write_fail`.
- **Support break-glass:**
  `support_break_glass_open`, `support_break_glass_close`.
- **Export:**
  `report_export`.
- **Project lifecycle:**
  `project_archive`, `project_restore`.
- **Gate / canary (only after a Gate 4C / 4D / 4E execution PR
  approves the proof shape; reserved enum slots; PR#19c does
  **not** authorise emitting these actions, it reserves their
  names so future Gate 4C / 4D / 4E proof emission has a place
  to land):**
  `gate_canary_proof_record`,
  `gate_canary_proof_fail`,
  `gate_canary_execution_proof` (legacy name; retained for
  backward compatibility with PR#18ac §6.2 references; future
  proofs should prefer `gate_canary_proof_record`).

### 4.3 Rules

- **Append-only.** No `UPDATE`, no `DELETE` against `audit_events`.
  Mutating an audit row is itself a Sev1 incident (§12).
- **No secrets.** No DSN, password, bearer token, `Authorization:`
  header value, raw `request_id` outside internal-only fields, raw
  `session_id`, raw payload body, env dump, private key, cert
  body, vault content, shell history, or raw row data may appear
  in any audit-event field (including `metadata_json`).
- **No raw payloads.** Configuration diffs are captured as
  `before_hash` / `after_hash`, not as raw JSON.
- **No raw `request_id` in customer-visible surfaces.** The
  `request_id` field is internal-only; customer-facing receipts
  and exports reference the `audit_event_id` instead.
- **Viewer role cannot access audit events.** §14 role matrix
  enforces this.
- **Owner / Admin only**, with a separate **internal read-only
  path** for the audit-export pipeline (Track B impl-b / impl-e).
- **Tenancy filter:** every read query filters on `workspace_id`
  first. No cross-tenant audit reads in v1 (cf. §13 / §15).

---

## 5. Retention policy contract

### 5.1 Per-class retention windows (v1 recommended)

| Data class | Retention window | Hard-delete after | Notes |
|---|---|---|---|
| Raw collector request body | **0 days / not persisted** | `null` (persist_policy = `not_persisted`) | The collector never stores the raw POST body; only categorical metadata + accept/reject outcome. Hard-delete-after is `null` because there is nothing persisted to hard-delete. |
| Normalised evidence events (`ingest_requests`, `accepted_events`, `rejected_events` and successor `EvidenceAtom`-like tables) | **30 days** | 35 days | Short window; primary product surface only needs days, not months. |
| Scoring / decision proof records (runtime proofs from PR#19b §10; future Lane A/B output) | **180 days** | 200 days | Required for downstream Track C delayed-actuals join. |
| Report cache / export cache (`ReportSnapshot`, `ReportDeliveryProof` per PR#19b §3.6 / §3.7) | **7 days** | 14 days | Cached renders only; the underlying evidence has its own window. |
| Application logs (request logs, scoring-worker logs, retention-job logs) | **30 days** | 35 days | Short; structured + PII-redacted by contract. |
| Audit / admin logs (`audit_events`) | **365 days** | 400 days | Long; required for governance custody chain. |
| Deletion requests / receipts (§6 / §8) | **365 days** | 400 days | Long; the receipt is itself the proof of deletion. |
| Backups | **≤ 35 days natural expiry** (via `backup_natural_expiry_days`) | `null` (persist_policy = `backup_natural_expiry`) | Documented; not customer-deletable. Hard-delete-after is `null` because backups expire naturally per the backup retention policy (max 35 days); active deletion is not the governing mechanism. See §6 backup-expiry note. |

### 5.2 `retention_policy` contract (table-style)

```ts
interface RetentionPolicy {
  retention_policy_id: string;              // ULID/UUIDv7
  workspace_id: string;                     // mandatory tenancy

  data_class:                               // matches §5.1 row
    | "raw_collector_request_body"
    | "normalised_evidence_event"
    | "scoring_decision_proof"
    | "report_cache"
    | "application_log"
    | "audit_admin_log"
    | "deletion_request_receipt"
    | "backup";

  // How this data class is governed at the bottom end. The field
  // is mandatory because the contract must distinguish "we delete
  // it" from "we never persisted it" from "it lives only as long
  // as the backup tail does". Earlier drafts used the string
  // "n/a" for non-persisted and backup rows; that ambiguity is
  // replaced by a typed enum.
  persist_policy:
    | "not_persisted"                       // raw_collector_request_body: never written to DB / disk
    | "retained_then_deleted"               // active retention window then hard delete
    | "backup_natural_expiry";              // tail lives only as long as the backup tail does

  retention_days: number;                   // §5.1 retention window;
                                            //   for persist_policy="not_persisted" this is 0
                                            //   for persist_policy="backup_natural_expiry" this is the
                                            //     active-side retention window (often 0 because the
                                            //     active store is governed elsewhere)
  hard_delete_after_days: number | null;    // §5.1 hard-delete-after;
                                            //   `null` when persist_policy in
                                            //   {"not_persisted", "backup_natural_expiry"}
                                            //   (active deletion is not the governing mechanism)

  // Backup natural-expiry window. Mandatory when persist_policy
  // is "backup_natural_expiry"; otherwise null. Decouples the
  // active-store retention from the backup tail, so the customer
  // -visible receipt (§8 backup_expiry_note) can be honest about
  // both surfaces.
  backup_natural_expiry_days: number | null;

  legal_hold_allowed: boolean;              // v1 default: false; future legal-hold feature
  customer_visible: boolean;                // whether this policy row is listed in customer-facing receipts

  effective_from: string;                   // ISO 8601 UTC

  // Provenance
  created_by: string;                       // actor_id
  approved_by: string | null;               // dual-control for sensitive classes
  audit_event_id: string;                   // pointer to the audit row recording this policy
}
```

#### 5.2.1 Per-class encoding under the typed `persist_policy`

Two rows in §5.1 that the contract must encode without ambiguity:

- **Raw collector request body.**
  `persist_policy="not_persisted"`, `retention_days=0`,
  `hard_delete_after_days=null`,
  `backup_natural_expiry_days=null`. The category records the
  fact that the raw body never enters the persistent store;
  there is nothing to hard-delete.
- **Backups.**
  `persist_policy="backup_natural_expiry"`, `retention_days=0`
  (active-store window is governed by the per-data-class row,
  not by this backup row), `hard_delete_after_days=null`,
  `backup_natural_expiry_days <= 35`. The `null` encodes that
  active deletion is not the governing mechanism; the
  backup-side window (≤ 35 days) is.

The other six classes (`normalised_evidence_event`,
`scoring_decision_proof`, `report_cache`, `application_log`,
`audit_admin_log`, `deletion_request_receipt`) all use
`persist_policy="retained_then_deleted"` and both
`hard_delete_after_days` and `retention_days` are positive
integers per §5.1.

The table in §5.1 and the contract in §5.2 must agree row-by-row;
the "n/a" string is **forbidden** as a value because it has no
typed representation. A Track B implementation PR may add new
data classes but must declare a `persist_policy` value for each.

### 5.3 v1 retention rules

- **Fixed defaults, not custom matrices.** Each workspace at v1
  inherits the same per-data-class defaults from §5.1. No
  customer-facing "set your own retention" surface in v1. A
  customer that needs a specific custom window enters the external
  audit-trigger surface (§16).
- **Retention-policy changes are audited.** Any
  `retention_policy_change` action creates an `audit_events` row
  with `before_hash` / `after_hash`.
- **No `0` shortcut for normalised evidence in v1.** If a customer
  asks for "delete it all immediately", that's a deletion request
  (§6), not a retention change.
- **Backups expire naturally.** The deletion workflow (§8 receipt)
  records the backup-expiry note so the receipt's "all data
  removed" status is honest about backup tails.

---

## 6. Deletion workflow contract

### 6.1 State machine

A `deletion_request` moves through a fixed state machine. No
transition is skippable.

```
requested
   ↓
scoped                       (operator/system resolves scope)
   ↓
dry_run_ready                (counts computed; dry-run hash recorded)
   ↓
approved                     (owner/admin approves)
   ↓
suppression_written          (tombstone written first; §7)
   ↓
executing                    (retention/deletion job runs)
   ↓
verification_pending         (post-delete reads confirm zeroed counts)
   ↓
completed                    (deletion_receipt emitted; §8)

Sidetracks:
   ↓ → failed                (any step fails → audit row with the most specific §4.2
                              failure action available + receipt with failure_reason_code;
                              use deletion_request_execute_fail / _verification_fail /
                              deletion_receipt_emit_fail where they apply; use the
                              generic deletion_request_fail only when no more specific
                              action exists, e.g. scope / dry-run-prep / approval /
                              suppression-prep failures)
   ↓ → cancelled             (requester or admin cancels before approval →
                              deletion_request_cancel audit action)
```

### 6.2 Objects

The workflow uses four objects:

```ts
interface DeletionRequest {
  deletion_request_id: string;
  workspace_id: string;
  scope_type:                               // mirrors §7 tombstone scope
    | "workspace"
    | "project"
    | "site"
    | "identifier_hash";
  scope_value_hash: string | null;          // hash only; never raw identifier
  project_id: string | null;
  site_id: string | null;
  requested_at: string;
  requested_by: string;
  reason_code: string;                      // categorical; not free-text customer comms
  status:                                   // current state-machine state
    | "requested"
    | "scoped"
    | "dry_run_ready"
    | "approved"
    | "suppression_written"
    | "executing"
    | "verification_pending"
    | "completed"
    | "failed"
    | "cancelled";
  approved_by: string | null;
  approved_at: string | null;
  audit_event_ids: string[];                // every state transition pushes one
}

interface DeletionDryRunResult {
  deletion_dry_run_id: string;
  deletion_request_id: string;
  computed_at: string;
  candidate_counts_by_table: Record<string, number>;
  dry_run_snapshot_hash: string;            // sha256 of canonicalised candidate set
  audit_event_id: string;
}

interface DeletionExecution {
  deletion_execution_id: string;
  deletion_request_id: string;
  started_at: string;
  finished_at: string | null;
  status: "executing" | "completed" | "failed";
  deleted_counts_by_table: Record<string, number>;
  failure_reason_code: string | null;
  audit_event_id: string;
}

interface DeletionReceipt {
  // see §8 for the full receipt contract
  // referenced here for cross-link only
  receipt_id: string;
  deletion_request_id: string;
}
```

### 6.3 Required steps (cannot be skipped)

Every step below writes one `audit_events` row using the
**specific** §4.2 action listed. Failure-side actions are also
listed per step. The generic `deletion_request_fail` is used
**only** when no more specific failure action applies (see
§4.2 failure-action selection rule).

1. **Request intake.** UI / API / CLI creates a
   `deletion_request` row with `status="requested"`. Audit row
   written immediately.
   - Success action: **`deletion_request_create`**.
   - Failure action: **`deletion_request_fail`** (intake-side
     failure; no more specific action exists).
2. **Scope resolution.** Operator (or system rule) resolves the
   abstract request into concrete `workspace_id` / `project_id` /
   `site_id` / `identifier_hash`. Transition →
   `status="scoped"`.
   - Success action: **`deletion_request_scope`**.
   - Failure action: **`deletion_request_fail`** (no more
     specific action exists for scope-stage failures).
3. **Dry-run counts.** A `DeletionDryRunResult` is computed:
   per-table candidate counts plus `dry_run_snapshot_hash`. The
   dry-run job must be **read-only**. Transition →
   `status="dry_run_ready"`.
   - Success action: **`deletion_request_dry_run_ready`**.
   - Failure action on dry-run-prep failure (the prep wiring
     itself): **`deletion_request_fail`**. (Failure of the §9
     retention `retention_dry_run` job uses
     `retention_dry_run_fail` — that's the §9 retention surface,
     not this deletion-workflow step.)
4. **Owner approval.** An actor whose `actor_role_snapshot` is
   `WorkspaceOwner` or `WorkspaceAdmin` (or a separately-approved
   support role under break-glass; §14) explicitly approves.
   Transition → `status="approved"`. Alternative transition →
   `status="cancelled"` if the requester or an admin cancels
   before approval is granted.
   - Success action (approved): **`deletion_request_approve`**.
   - Cancellation action: **`deletion_request_cancel`**.
   - Failure action: **`deletion_request_fail`** (approval-stage
     failure, e.g. approver returns error before either
     approve / cancel completes).
5. **Suppression tombstone write.** §7 tombstone is written
   **before** any DELETE runs. Transition →
   `status="suppression_written"`.
   - Success action: **`suppression_tombstone_create`** (per §7
     suppression-tombstone lifecycle; the action is on the
     tombstone object, not the deletion request).
   - Failure action: if the tombstone-write itself errors, the
     audit row uses **`deletion_request_fail`** (suppression-prep
     stage failure of the deletion workflow; the suppression
     subsystem also emits its own failure-channel signal via
     monitoring metrics + alert per §10 / §11).
6. **Deletion execution.** The retention / deletion job deletes
   only the records that the prior `DeletionDryRunResult` flagged
   (cross-checked by `dry_run_snapshot_hash` at execute time;
   §9.3). Transition → `status="executing"`. Audit row at start
   **and** at end.
   - Start action: **`deletion_request_execute_start`**.
   - Success-end action:
     **`deletion_request_execute_complete`**.
   - Failure action: **`deletion_request_execute_fail`** (the
     specific execute-stage failure action).
7. **Verification.** Post-delete reads confirm the per-table
   counts are zeroed (or reduced by the dry-run candidate
   counts). Transition → `status="verification_pending"` →
   `status="completed"` once verify passes. Audit row at start
   **and** at end.
   - Start action: **`deletion_request_verification_start`**.
   - Success-end action:
     **`deletion_request_verification_complete`**.
   - Failure action: **`deletion_request_verification_fail`**
     (the specific verification-stage failure action).
8. **Receipt.** §8 `deletion_receipt` is emitted, linking the
   `deletion_request`, the dry-run, the execution, the
   suppression tombstone, and the chain of `audit_event_id`s.
   - Success action: **`deletion_receipt_emit`** (action on the
     `DeletionReceipt` object, not on the request itself; see
     §4.2 naming family note).
   - Failure action: **`deletion_receipt_emit_fail`** (the
     specific receipt-emission failure action).
9. **Audit log invariant.** Every transition above writes one
   `audit_events` row with the **specific** §4.2 action listed
   in steps 1–8 (or the failure action listed alongside that
   step). The generic `deletion_request_fail` is reserved for
   stages where no more specific failure action exists (intake,
   scope, dry-run-prep, approval, suppression-prep) and **must
   not** be used in place of `deletion_request_execute_fail` /
   `deletion_request_verification_fail` /
   `deletion_receipt_emit_fail` where those apply.
10. **Backup natural-expiry note.** The receipt includes a
    machine-readable `backup_expiry_note` field stating that
    backup tails for the affected data class will expire per
    §5.1 backup window (≤ 35 days). The customer-facing summary
    must state this honestly.

### 6.4 No implementation in PR#19c

PR#19c does not run the dry-run, does not write the suppression
tombstone, does not execute the deletion, does not emit the
receipt. PR#19c only records the contract for those steps.

---

## 7. `suppression_tombstone` contract

The suppression tombstone is the **defensive shield** that
prevents a deleted identifier from being silently re-collected
during the window between deletion-execute and the customer's
next site-load. It is written **before** the deletion runs.

### 7.1 Table-style contract

```ts
interface SuppressionTombstone {
  tombstone_id: string;                     // ULID/UUIDv7
  workspace_id: string;                     // mandatory tenancy
  project_id: string | null;
  site_id: string | null;

  scope_type:
    | "workspace"
    | "project"
    | "site"
    | "identifier_hash";
  scope_value_hash: string;                 // sha256 of canonicalised scope value;
                                            //   NEVER the raw identifier in v1

  reason_code: string;                      // categorical; e.g. "customer_request",
                                            //   "support_break_glass", "policy_violation",
                                            //   "test_account_cleanup"
  created_at: string;
  expires_at: string | null;                // null = indefinite suppression
  created_by: string;                       // actor_id
  audit_event_id: string;                   // pointer to creation audit row

  active: boolean;                          // true unless explicitly retracted; retraction
                                            //   itself is a separate audit-bearing action
}
```

### 7.2 Rules

- **Tombstone is written before deletion execution.** The §6 state
  machine enforces this — `suppression_written` must precede
  `executing`.
- **The tombstone prevents future ingestion** for the matching
  identifier / scope. The collector reads `suppression_tombstone`
  before persisting any row; a match drops the request with a
  categorical `suppression_match` reason code (no raw identifier
  surfaced in logs).
- **No raw identifier if a hash is sufficient.** In v1, the only
  exception is when the scope is `workspace` / `project` / `site`
  (in which case the raw `workspace_id` / `project_id` / `site_id`
  is already a tenancy ID and stored as `scope_value_hash` of that
  tenancy ID for uniformity). For `identifier_hash` scope, the
  raw identifier is hashed at write time and never persisted.
- **All suppression actions are audited.** Tombstone creation
  emits one audit row. Tombstone retraction emits another. Both
  carry `before_hash` / `after_hash` of the `active` boolean.
- **Tenancy filter:** every tombstone is bound to a single
  `workspace_id`. A tombstone in workspace A is invisible to
  workspace B.

---

## 8. `deletion_receipt` contract

The deletion receipt is the **customer-visible custody record** of
a completed deletion. It is the only Track B governance surface
that can have a customer-visible summary (§14 viewer role can read
it).

### 8.1 Table-style contract

```ts
interface DeletionReceipt {
  receipt_id: string;                       // ULID/UUIDv7
  deletion_request_id: string;              // §6 pointer
  workspace_id: string;                     // mandatory tenancy

  // Scope — categorical only
  scope_summary: {
    scope_type: "workspace" | "project" | "site" | "identifier_hash";
    project_id: string | null;
    site_id: string | null;
    identifier_present: boolean;            // true only if scope was identifier_hash
                                            //   (raw identifier is NEVER in the receipt)
  };

  // Timeline
  requested_at: string;
  approved_at: string;
  completed_at: string;

  // Outcome
  deleted_record_counts_by_table: Record<string, number>;
                                            // e.g. { "ingest_requests": 142,
                                            //         "accepted_events": 18 }
  suppression_tombstone_id: string;         // pointer; raw scope value hashed only

  // Verification
  verification_summary: {
    post_delete_counts_zero: boolean;
    verification_failure_reason_code: string | null;
  };

  // Backup honesty note
  backup_expiry_note: string;               // e.g. "Affected backup tails expire
                                            //   within 35 days per workspace policy"

  // Provenance
  audit_event_ids: string[];                // every relevant transition
  generated_by: string;                     // actor_id of the receipt-generating job
  generated_at: string;

  // Customer-facing summary (the only customer-visible field)
  customer_visible_summary: string;         // template-driven; resolved against the
                                            //   PR#19b safe_claims dictionary once a
                                            //   governance PR populates the entries
}
```

### 8.2 Rules

- **Receipt summary can be customer-visible.** The
  `customer_visible_summary` field is the only customer-readable
  field on the receipt. It is template-driven against a future
  governance-PR-populated `safe_claims` entry (PR#19b §7.4); raw
  free text is forbidden.
- **No raw secrets in any field.** No DSN, no password, no
  `Authorization:` header value, no bearer token, no env dump,
  no private key, no cert body, no vault content.
- **No raw payloads in any field.** Even on a deletion of a
  specific identifier, the receipt records counts and hashes, not
  the payload that was deleted.
- **No raw identifiers unless explicitly approved by policy.** The
  receipt records `identifier_present: boolean` but **never** the
  raw identifier value. A future policy PR may, under explicit
  Helen GO, allow customer-self-service receipts that include the
  raw scope identifier (e.g. so the customer can confirm the right
  email/UUID was removed) — but v1 keeps the identifier hashed
  end-to-end.
- **Receipts are retained per §5.1** (365 days, hard-delete after
  400 days). The receipt is itself the proof of deletion and
  outlives the deleted data.

---

## 9. Retention job contracts

Three job objects sit behind the §5 retention policy and the §6
deletion workflow:

### 9.1 `retention_runs` (umbrella record)

```ts
interface RetentionRun {
  run_id: string;
  job_type: "retention_dry_run" | "retention_execute";
  started_at: string;
  finished_at: string | null;
  status:
    | "running"
    | "completed"
    | "failed"
    | "blocked_dry_run_mismatch";
  workspace_id: string | null;              // null = all workspaces
  data_class: string;                       // §5.1 row
  candidate_count: number;
  deleted_count: number;                    // 0 for dry-run
  skipped_count: number;
  failure_count: number;
  failure_reason_code: string | null;
  dry_run_snapshot_hash: string;            // mandatory link to the dry-run row
  audit_event_id: string;
}
```

### 9.2 `retention_dry_run` (read-only)

Daily job. Computes the rows that **would** be deleted per
`data_class` per workspace given the active `RetentionPolicy`. The
job is **read-only**: it must not delete, mutate, or annotate any
row.

Output:

- per-table candidate counts,
- `dry_run_snapshot_hash` covering the candidate set.

### 9.3 `retention_execute` (gated by dry-run)

Daily job (or on-demand for deletion-workflow execution). Deletes
only the rows the prior `retention_dry_run` flagged for the
same `data_class` and the same `dry_run_snapshot_hash`.

Stop-line: **`blocked_dry_run_mismatch`.** If the current candidate
set's hash does not match the most recent `retention_dry_run`'s
`dry_run_snapshot_hash` (because rows were added, mutated, or
removed between dry-run and execute), execute halts and emits a
failure audit row. The operator must re-run the dry-run before
retrying execute.

### 9.4 Rules

- **Execute only deletes what dry-run flagged.** A row that became
  eligible after the dry-run is **not** deleted by the matching
  execute; it waits for the next day's dry-run.
- **Dry-run must precede execute.** A `retention_execute` without
  a same-day `retention_dry_run` is a contract violation and is
  blocked.
- **All failures auditable.** Every `failure_*` exit path writes
  one `audit_events` row with the appropriate categorical
  `failure_reason_code`.
- **No execution in PR#19c.** PR#19c reserves the contract; it
  does not run the jobs.

---

## 10. Monitoring metrics handoff

Minimum metric families to instrument across the runtime.
Naming conventions and label rules are below the table.

### 10.1 Collector metric family

- `collector.request_count` — counter; labels `{endpoint, http_status_class}`.
- `collector.http_status_2xx` — counter; label `{endpoint}`.
- `collector.http_status_4xx` — counter; label `{endpoint, reject_reason_code}`.
- `collector.http_status_5xx` — counter; label `{endpoint}`.
- `collector.latency_p95` — histogram; label `{endpoint}`.
- `collector.auth_fail_rate` — gauge; label `{endpoint}`.
- `collector.queue_depth` — gauge; no per-request labels.

### 10.2 DB-writes metric family

- `db.write_success_rate` — gauge; label `{table}`.
- `db.write_error_rate` — gauge; label `{table, error_class}`.
- `db.write_latency_p95` — histogram; label `{table}`.
- `db.retry_count` — counter; label `{table}`.

### 10.3 Scoring / report / deletion / retention / audit / admin

- `scoring.success_rate` — gauge; label `{score_version_id}`.
- `scoring.error_rate` — gauge; label `{score_version_id, error_class}`.
- `report.job_success_rate` — gauge; label `{report_kind}`.
- `report.delivery_success_rate` — gauge; label `{delivery_channel}`.
- `deletion.queue_depth` — gauge.
- `deletion.success_rate` — gauge.
- `retention.dry_run_last_success_at` — gauge (UNIX timestamp).
- `retention.execute_last_success_at` — gauge (UNIX timestamp).
- `audit.write_failures` — counter.
- `audit.lag_seconds` — gauge (time between `occurred_at` and `created_at`).
- `admin.login_failures` — counter; label `{actor_category}`.
- `admin.break_glass_open_count` — counter.

### 10.4 Naming convention rules

- **Low-cardinality labels only.** Labels are categorical
  (`endpoint`, `http_status_class`, `reject_reason_code`,
  `report_kind`, `delivery_channel`, `error_class`,
  `actor_category`, `table`, `score_version_id`). No
  high-cardinality dimensions.
- **No raw `request_id` in labels.** That field is on
  `audit_events` and runtime-proof rows, not on metrics.
- **No raw `session_id` in labels.** Same reason.
- **No payload fragments.** Reason codes are enum values, not
  truncated payload bodies.
- **No customer PII in metric labels.** No emails, names,
  domains-as-PII, IPs (only categorical buckets like
  `actor_category=root`).

PR#19c does **not** create the monitoring integration. A Track B
implementation PR is responsible for wiring these into Prometheus
/ Grafana / equivalent under its own Helen GO.

---

## 11. Alert threshold handoff

Each alert is classified as **page** (wake someone up) or
**ticket** (file it in the work queue). Both kinds are
**actionable** — no silent watchers, no purely informational
alerts.

### 11.1 Page vs ticket distinction

- **Page** — pages an on-call. Used only for surfaces where a
  human needs to act now (collector uptime, DB write errors,
  audit-write failures, Sev1-class incident triggers).
- **Ticket** — files a work item. Used for surfaces that should
  be inspected and fixed within the SLA window but do not need
  out-of-hours response.

### 11.2 Threshold table (v1 recommended)

| Surface | Trigger | Page or Ticket |
|---|---|---|
| Collector uptime | 3 consecutive `/v1/event` health failures within 5 min | **Page** |
| Collector 5xx rate | `>= 1%` over 5 min rolling | **Page** |
| Collector 4xx rate spike on a specific `reject_reason_code` (especially `request_body_invalid_json`) | rate `>= 2×` the 7-day baseline | **Ticket** |
| DB write errors | `>= 0.5%` over 5 min rolling | **Page** |
| Scoring worker error rate | `>= 1%` over 30 min rolling | **Ticket** |
| Report-job failure rate | `>= 5%` over 1 hour rolling | **Ticket** |
| Deletion-job failure | any single `failed` execution | **Page** |
| Retention dry-run skipped | `retention.dry_run_last_success_at` > 36 hours stale | **Ticket** |
| Retention execute skipped / blocked | `retention.execute_last_success_at` > 48 hours stale, **or** any `blocked_dry_run_mismatch` | **Page** |
| `audit.write_failures` | `>= 1` per minute | **Page** |
| Admin login failures | `>= 5` failures per actor per 15 min | **Ticket** |
| Break-glass timeout | open break-glass exceeds its time-bound | **Page** |

### 11.3 Actionable-alert rules

- **Uptime alerts use 3 consecutive failures before page** (not a
  single missed probe; not a moving average).
- **Each alert has a runbook link** in the alert payload
  (production runbook lives in the team's ops repo / wiki — not
  in PR#19c).
- **No noisy thresholds.** A page that fires more than once a
  week on noise is downgraded to a ticket and the threshold is
  re-tuned. The Track B implementation PR includes the
  alert-tuning policy.

### 11.4 Suggested SLOs

- **Collector ingest path** (i.e. the production `/v1/event` route
  end-to-end): **99.5% / 30 days**.
- **Scoring runtime** (when later activated under its own
  governance PR — currently locked by §2.1
  `runtime_scoring_allowed=false`): **99.0% / 30 days**.
- **Report runtime** (when later activated under a separate Track
  A governance PR — currently locked by §2.1
  `dashboard_customer_output_allowed=false`): **99.0% / 30 days**.
- **Deletion-completion SLA:** **7 calendar days** from
  `status="approved"` to `status="completed"`. Sev1-class
  governance failure if exceeded.

---

## 12. Incident response contract

### 12.1 `incident_record` (table-style)

```ts
interface IncidentRecord {
  incident_id: string;                      // ULID/UUIDv7
  severity: "Sev1" | "Sev2" | "Sev3";

  // Timeline
  detected_at: string;
  declared_at: string;
  resolved_at: string | null;

  // Ownership
  commander: string;                        // actor_id; nullable until declared

  // Scope
  affected_workspace_id: string | null;
  affected_project_id: string | null;
  affected_site_id: string | null;

  customer_impact:
    | "none"
    | "internal_only"
    | "single_customer"
    | "multi_customer"
    | "all_customers";
  data_exposure:
    | "none"
    | "metadata_only"
    | "evidence_event_only"
    | "potential_pii";

  retention_deletion_audit_impact:
    | "none"
    | "retention_job_skipped"
    | "deletion_failed"
    | "audit_write_failed"
    | "audit_log_gap";

  // Narrative (categorical / template-driven; not free-text customer comms)
  current_hypothesis: string;
  mitigation_taken: string;
  rollback_taken: string;

  // Comms
  customer_comms_owner: string;             // actor_id
  next_update_at: string | null;

  // Sequence of state changes
  timeline_entries: {
    at: string;
    by: string;                             // actor_id
    note: string;                           // template-driven
    audit_event_id: string;
  }[];

  // Follow-ups
  follow_up_actions: {
    description: string;
    owner: string;                          // actor_id
    due_at: string;
    status: "open" | "in_progress" | "completed" | "cancelled";
  }[];

  postmortem_due_at: string | null;         // Sev1/Sev2 only

  status:
    | "detected"
    | "declared"
    | "in_progress"
    | "mitigated"
    | "resolved"
    | "post_mortem_pending"
    | "closed";
}
```

### 12.2 Minimum incident response cadence

- **Sev1:** commander assigned within **15 min** of declaration;
  customer-update cadence every **30 min** until mitigated.
- **Sev2:** owner assigned within **60 min**.
- **Sev1 / Sev2 postmortem:** due within **5 working days** of
  `resolved_at`.

### 12.3 Linking rules

- Every `incident_record` links to one or more `audit_event_id`s
  recording the underlying detection signal, the
  commander-assignment action, the mitigation steps, the rollback
  steps, and the resolution.
- Customer-facing communications referencing an incident must
  reference the `incident_id` (an opaque ID), not internal
  surfaces (no `request_id`, no `session_id`, no internal table
  names in customer copy).

---

## 13. `workspace` / `project` / `site` tenancy model

### 13.1 Three layers

- **`workspace`** — customer tenant. The unit of billing,
  member-management, role-grants, retention-policy ownership, and
  the topmost scope for every governance action.
- **`project`** — environment or business boundary inside a
  workspace (e.g. `production`, `staging`, `app-flagship`,
  `app-experiment`). A project belongs to exactly one workspace.
- **`site`** — a tracked domain / collector origin / token
  binding. A site belongs to one workspace and one project. A
  `site` is the unit a ThinSDK installation maps to.

### 13.2 Hard tenancy rules

- **Every business table must include `workspace_id`.** No
  exceptions. New tables in any Track A / B / C implementation PR
  that omit `workspace_id` fail review.
- **`project` belongs to one workspace.**
  `project.workspace_id` is mandatory; cross-workspace projects
  do not exist in v1.
- **`site` belongs to one workspace and one project.**
  `site.workspace_id` and `site.project_id` are both mandatory.
- **All queries filter `workspace_id` first.** The query planner
  must see `workspace_id` as the leading predicate. The Codex
  review checklist (per PR#19a §7.4) catches missing predicates.
- **Site tokens can only write to their bound site.** Token
  validation rejects any write whose body claims a different
  `site_id` than the token's binding. (Carry-forward from PR#17s
  §6.6: "the **token binding** is the source of truth for
  `workspace_id` and `site_id`; whatever the body claims is
  overridden / ignored.")
- **Cross-workspace export forbidden in v1.** No customer-facing
  report, export, or API response may surface data from a
  workspace other than the requester's. (External-audit-trigger
  surface in §16 can change this later.)

---

## 14. Roles and access matrix

### 14.1 v1 roles

- **Workspace Owner** — the single accountable customer admin.
  Can manage members, change roles (including promote / demote
  other members but not self-demote without successor),
  approve / execute deletions, change retention policy, manage
  sites and tokens, view all internal-only surfaces.
- **Workspace Admin** — member with elevated permissions inside a
  workspace. Can manage members below Admin, manage sites and
  tokens, approve deletions, view audit logs and monitoring.
- **Analyst** — internal-facing analyst role. Can view reports
  and evidence cards, export summaries (against `safe_claims`
  templates only), view monitoring. Cannot modify site config or
  policy.
- **Viewer** — read-only customer role. Can view reports, can
  view their own deletion receipts (the `customer_visible_summary`
  field only). **Cannot view audit logs**, cannot view internal
  diagnostic surfaces, cannot export raw rows.
- **`support_break_glass`** — internal BuyerRecon team role.
  Default no access. Granted only through a ticketed break-glass
  request, time-bound (max 4 hours unless explicitly extended),
  fully audited (`support_break_glass_open` +
  `support_break_glass_close` actions), auto-revoked at expiry.

### 14.2 Access matrix

| Capability | Owner | Admin | Analyst | Viewer | support_break_glass (when open) |
|---|---|---|---|---|---|
| Manage members (invite / remove below own role) | yes | yes (below Admin) | no | no | no (unless ticket explicitly authorises) |
| Change roles | yes | yes (below Admin) | no | no | no |
| Manage sites (create / update / delete) | yes | yes | no | no | no (read-only) |
| View reports | yes | yes | yes | yes | yes (read-only) |
| Export summaries (`safe_claims`-template-driven) | yes | yes | yes | no | no |
| View audit logs (`audit_events`) | yes | yes | no | **no** | yes (read-only, with audit row recorded) |
| Approve deletion request | yes | yes | no | no | yes (only with ticketed authorisation) |
| Execute deletion (run the job) | yes | yes | no | no | no |
| View monitoring metrics | yes | yes | yes | no | yes (read-only) |
| Open break-glass | n/a | n/a | n/a | n/a | self |

### 14.3 Rules

- **Viewer cannot see audit logs.** The audit-log surface in §4
  enforces this at the read-API layer (not just at the UI layer).
- **Analyst cannot modify site config.** Site CRUD is
  Admin/Owner-only.
- **`support_break_glass` defaults to no access.** It activates
  only when:
  - a ticket exists (linked in the
    `support_break_glass_open` audit row),
  - the access is time-bound (`expires_at` mandatory),
  - the open and the close are both audited,
  - the access auto-revokes at `expires_at` even if the
    `support_break_glass_close` action is never explicitly
    triggered.
- **Custom roles / SCIM / SSO are deferred.** v1 ships with the
  fixed role set above. SCIM provisioning, SSO via OIDC, and
  customer-defined fine-grained roles are external-audit-trigger
  surfaces (§16).

---

## 15. Negative tests

Track B implementation PRs must implement against at least the
following negative tests. Each must produce a **categorical
denial (not a silent allow)** and either:

- **(A) Normal denied-security path** — an `audit_events` row
  with `outcome="denied"` and a categorical `reason_code`. Tests
  1, 2, 3, 4, 5, 6, 8, 9, and 10 below take this path.
- **(B) Audit-subsystem failure path** — the audit subsystem
  itself has failed, so a synchronously-persisted `audit_events`
  row may be impossible. The test must instead surface the
  failure via the audit subsystem's fallback / error channel
  using an `audit_write_fail` or `audit_write_pending` action
  (§4.2), plus an operator-visible signal (metric
  `audit.write_failures` from §10.3 + alert per §11). The test
  must **not** silently pretend the audit succeeded and must
  **not** synthesise a false `outcome="denied"` row when audit
  itself could not be written. Only test 7 below takes this
  path.

The two paths are mutually exclusive — a test that simulates
audit-subsystem failure cannot satisfy (A); a test that
simulates a normal denied security decision cannot satisfy (B).
Each test below declares which path it follows.

1. **Workspace-A viewer cannot read workspace-B.** A read query
   from a viewer in workspace A against any object in workspace
   B returns `denied` regardless of object type.
2. **Project admin cannot promote self to Owner.** A role-change
   action where `actor_id == target_id` and the role transition
   is admin → owner is denied. Audit row records the attempt.
3. **Site key cannot write to other site.** A `site_write` token
   bound to site X attempting to write a `body.site_id = "Y"`
   payload is rejected at the auth layer (the body claim is
   ignored per §13.2; the token binding wins).
4. **Removed member's old token cannot access.** After
   `member_remove`, any session token / API token bound to the
   removed actor must be revoked. The next request using that
   token returns `denied`.
5. **Deleted identifier suppressed before future ingest.** After
   a `deletion_request` completes with an `identifier_hash`
   scope, the next ingest event matching that identifier hash is
   rejected at the collector front-of-pipe with
   `suppression_match` and never reaches the database.
6. **Deletion dry-run mismatch blocks execute.** If the candidate
   set at execute time hashes to a different
   `dry_run_snapshot_hash` than the prior dry-run, execute halts
   with `blocked_dry_run_mismatch` and audits the block.
7. **Audit write failure is not swallowed.** *Path (B) — audit-
   subsystem failure path.* A simulated failure to write to
   `audit_events` (e.g. DB write error against the audit table
   itself) must:
   - surface the failure via the audit subsystem's fallback /
     error channel using the `audit_write_fail` action (§4.2)
     emitted through a structured operational log / alternate
     persistence path, **not** a freshly-written primary
     `audit_events` row (that's the resource that just failed);
   - increment the `audit.write_failures` metric (§10.3) and
     trigger the alert per §11 (page on `>= 1 per minute`);
   - cause the originating upstream action to **fail** wherever
     possible (the action does not silently succeed without an
     audit row);
   - where the originating action is genuinely unavoidable
     mid-flight (e.g. a logout already in progress that cannot
     be unwound), record an `audit_write_pending` state (§4.2)
     to be reconciled by a separate retry / sweeper job; the
     reconciliation outcome later lands as
     `audit_write_success` or `audit_write_fail`;
   - **must not** synthesise a false `outcome="denied"`
     `audit_events` row when the audit table is itself the
     failing resource (that would obscure the failure mode);
   - **must not** silently pass.

   The expected categorical outcome of this test is
   `audit_write_fail` (or `audit_write_pending` in the
   unavoidable-mid-flight case) **plus** an operator-visible
   signal (metric + alert) — **never** a clean
   `audit_events.outcome="denied"` row, because the audit
   subsystem cannot persist any row in that scenario.
8. **Retention execute cannot delete records outside window.** A
   retention-execute job attempting to delete a row whose
   age does not meet the active `RetentionPolicy.retention_days`
   threshold fails the per-row predicate check.
9. **Break-glass auto-closes after timeout.** After
   `support_break_glass_open`'s `expires_at`, any subsequent
   action attempted via the break-glass session returns
   `denied`. An implicit `support_break_glass_close` audit row is
   written.
10. **Report export cannot cross workspace.** A report export
    request whose target_workspace_id differs from the
    requesting actor's workspace_id is denied. Audit row
    recorded.

---

## 16. External audit trigger

The v1 governance runtime is **deliberately under-built**. The
following conditions raise the ceiling — they say "now is the
moment to add SOC 2-class monitoring, SCIM provisioning, SSO,
customer-defined retention matrices, fine-grained per-row ACLs,
external audit-export pipelines, etc.":

1. **First paid customer requiring a security questionnaire or
   DPA attachment.** A real procurement-driven customer ask is
   a stronger trigger than internal speculation.
2. **More than three paid workspaces in production.** Above this
   threshold, the lack of customer-defined retention matrices
   and SCIM provisioning becomes a real operational burden, not
   a theoretical one.
3. **More than three internal admins with production data
   access.** Break-glass alone scales poorly past three regular
   admins; a fine-grained role model becomes necessary.
4. **First Sev1 data exposure / deletion failure / audit gap.**
   Any such incident immediately raises the ceiling and triggers
   a postmortem-driven governance upgrade PR.
5. **Need for SSO / SCIM / custom roles / cross-workspace
   sharing.** These four features are individually deferred;
   each one's first real customer-driven ask triggers the
   ceiling-raise PR for that feature.

Until one of these triggers fires, v1 holds the line at the §4 –
§14 contract set.

---

## 17. Implementation sequencing

PR#19c does not implement anything. The following sequence is the
recommended path forward; each future PR requires its own explicit
Helen GO scoped to that step:

1. **PR#19c-impl-a — `audit_events` contract / table planning.**
   Schema PR for the `audit_events` table (per §4) plus the
   minimum `action` enum (per §4.2). No data writes; only the
   schema + migration. Stops at the point where the table exists
   and a stub write path is wired but unused.
2. **PR#19c-impl-b — role / access negative tests.** Implements
   the §15 negative tests against stub code paths (the actual
   role-runtime change is a separate PR). The negative tests
   ship green-on-deny first.
3. **PR#19c-impl-c — retention dry-run skeleton.** Implements
   `retention_dry_run` as a read-only job emitting candidate
   counts and the `dry_run_snapshot_hash`. No execute, no
   delete.
4. **PR#19c-impl-d — deletion workflow skeleton.** Implements
   the §6 state machine and the §7 / §8 contracts (tombstone +
   receipt) end-to-end against the dry-run scaffolding. Still
   no destructive delete in this PR.
5. **PR#19c-impl-e — monitoring metric names + runtime-proof
   fields.** Declares the §10 metric families, the §11 alert
   thresholds, and the runtime-proof bridge to `audit_events`
   (shared schema per PR#19b §10.6 / PR#19a §7.3). No alert
   wiring yet.
6. **PR#19c-impl-f — incident template and break-glass audit
   path.** Wires the §12 `incident_record` template and the
   `support_break_glass` action audit path. No incident
   declaration triggered by this PR.

After PR#19c-impl-a → impl-f close, separate PRs can authorise
each runtime activation step (retention execute, deletion
execute, alert routing). PR#19c does **not** authorise any of
those activation steps.

---

## 18. Non-goals

PR#19c explicitly does **not** approve any of the following.
Each requires its own explicit Helen GO scoped to that specific
work:

- no code,
- no migrations,
- no DB writes,
- no `schema.sql` change,
- no deletion execution,
- no retention execution,
- no monitoring integration,
- no alert routing,
- no incident declaration,
- no runtime auth change,
- no role-runtime change,
- no SCIM / SSO / custom role enablement,
- no break-glass open / close in production,
- no Gate 4C execution,
- no Gate 4C canary,
- no Gate 4D organic observation,
- no Gate 4E Track A / Playwright work,
- no customer-output activation,
- no runtime scoring,
- no Lane A / Lane B writer activation,
- no AMS Trust runtime,
- no Pass 1 runtime,
- no Pass 2 runtime,
- no `endpointUrl` re-flip,
- no production traffic generation,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no `/var/www` edit,
- no symlink change,
- no `nginx -s reload`, no `systemctl` action, no service
  restart,
- no DNS change,
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no
  `buyerrecon_migrator` reset, no production token provisioning,
- no Track A invocation, no Playwright run,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no flipping of any PR#18ab §9 lock
  (`customer_claim_allowed`, `customer_visibility_allowed`,
  `lane_output_allowed`, `lane_write_allowed`,
  `runtime_scoring_allowed`, `ams_trust_runtime_allowed`,
  `pass1_runtime_allowed`, `pass2_runtime_allowed`,
  `dashboard_customer_output_allowed`,
  `sales_claim_upgrade_allowed`,
  `allowed_customer_language=[]`),
- no flipping of any PR#19b external-output feature flag
  (`show_evidence_grade`, `show_recommendations`,
  `show_account_inference`, `auto_send_reports`),
- no population of the PR#19b `safe_claims` dictionary,
- no deletion / mutation / annotation / normalisation of the 26
  historical PR#17s rows on the production cluster,
- no secret printing (DSN, generated password, DB username /
  password pair, `Authorization:` header value, raw
  `request_id`, raw `session_id`, raw payload, raw response
  body, env dump, private key / cert body, vault content, shell
  history, raw row data).

---

## 19. Acceptance criteria

PR#19c is acceptable for merge into
`sprint2-architecture-contracts-d4cc2bf` only if **all** of the
following hold:

- **Docs-only.** Exactly one new file changes in the repo:
  `docs/engineering/pr19c-sprint4-governance-runtime-handoff.md`.
  No code, no scripts, no tests, no package files, no
  migrations, no `schema.sql`, no env files, no systemd / Nginx
  files, no AMS source, no website artifacts, no production
  config, no DB grant files change.
- **Governance runtime contracts defined.** §4 (`audit_events`),
  §5 (retention policy), §6 (deletion workflow), §7
  (`suppression_tombstone`), §8 (`deletion_receipt`), §9
  (retention jobs), §10 (monitoring metrics), §11 (alert
  thresholds), §12 (`incident_record`), §13 (tenancy), §14 (role
  matrix) are all present and field-level explicit.
- **Audit / retention / deletion / suppression / receipt
  contracts defined.** §4 + §5 + §6 + §7 + §8 + §9.
- **Monitoring / alert / incident contracts defined.**
  §10 + §11 + §12.
- **Workspace / project / site model defined.** §13.
- **Role / access matrix defined.** §14.1 + §14.2 + §14.3.
- **Negative tests listed.** §15 enumerates ten negative tests.
- **External audit trigger listed.** §16 enumerates five
  triggers.
- **Implementation sequencing proposed.** §17 sequences PR#19c-impl-a
  → PR#19c-impl-f with rationale and explicit non-authorisation.
- **PR#18ab locks preserved.** §2.1 carries all eleven
  `*_allowed=false` / `allowed_customer_language=[]` locks
  verbatim; §18 non-goals restate them.
- **Gate 4C remains unapproved.** §2 carries forward the
  PR#18ac `BLOCKED_PENDING_COMPATIBILITY_PLAN` sub-status; §18
  non-goals restate no Gate 4C execution.
- **No secrets.** Secret-safety grep returns only metadata /
  governance / attestation hits inside §4 / §7 / §8 / §10 / §18
  forbiddance lists; no leaked value.
- **No runtime changes.** PR#19c is purely a contract artefact.

---

## 20. Files planned to change

### 20.1 Repo (this PR, docs-only)

| Path | Action | Lines |
|---|---|---|
| `docs/engineering/pr19c-sprint4-governance-runtime-handoff.md` | NEW | 1572 |

No code, scripts, tests, package files, migrations, `schema.sql`,
env files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

PR#19c is path-restricted to the single new file above. If
PR#18ac, PR#19b artifacts, or the four root deep-research reports
appear in the working tree from prior tasks, they remain
**excluded** from PR#19c's diff via `git diff --name-only --
<this-file>` path restriction.

### 20.2 Production host

| Path | Action |
|---|---|
| any | NOT TOUCHED |

PR#19c does not read, write, edit, copy, move, remove, chmod,
chown, symlink, or otherwise touch the production host in any
way. No commands of any kind are executed against the production
host.

---

End of PR#19c. **Sprint 4 Governance Runtime contract handoff.
Verdict: CONTRACT_HANDOFF_ONLY — no implementation, no production
execution, no Gate 4C approval. Defines the `audit_events` core
table (append-only; full action enum covering auth / member /
role / site / token / retention / deletion / break-glass /
export / project / gate-canary; before_hash / after_hash for
config diffs; categorical-only metadata; viewer-cannot-read rule;
tenancy filter). Defines the eight-class retention policy (raw
body 0 days / not persisted; normalised evidence 30 days;
scoring / decision proof 180 days; report cache 7 days; app log
30 days; audit log 365 days; deletion receipt 365 days; backup
≤ 35 days natural expiry). Defines the ten-state deletion
workflow (requested / scoped / dry_run_ready / approved /
suppression_written / executing / verification_pending /
completed / failed / cancelled) with four object types
(deletion_request / deletion_dry_run_result /
deletion_execution / deletion_receipt) and the mandatory
suppression-tombstone-before-execute rule. Defines the
suppression_tombstone contract (hash-only scope; never raw
identifier; always audited; tenancy-scoped). Defines the
deletion_receipt contract with the customer-visible summary as
the only customer-readable field (template-driven against future
safe_claims). Defines three retention-job contracts
(retention_runs / retention_dry_run / retention_execute) with
the dry-run-precedes-execute and snapshot-hash-match rules.
Defines minimum monitoring metric families across collector / DB
writes / scoring / report / deletion / retention / audit /
admin, with low-cardinality-label-only conventions. Defines
page-vs-ticket alert thresholds (collector uptime / 5xx; DB
write errors; scoring errors; report job; deletion job;
retention dry-run / execute; audit-write failures; admin login
failures; break-glass timeout) plus SLO suggestions (collector
99.5%/30d; scoring/report 99.0%/30d; deletion 7-day SLA).
Defines the incident_record contract with severity-based cadence
(Sev1 commander 15 min, update 30 min; Sev2 owner 60 min; Sev1/2
postmortem 5 working days). Defines the workspace / project /
site three-layer tenancy model with mandatory workspace_id on
every business row, WHERE workspace_id first on every read, site
token bound to single site, and cross-workspace export
forbidden in v1. Defines five v1 roles (Workspace Owner,
Workspace Admin, Analyst, Viewer, support_break_glass) and the
access matrix with viewer-cannot-see-audit-logs,
analyst-cannot-modify-site, support_break_glass time-bound +
ticketed + audited + auto-revoked rules. Enumerates ten
negative tests (cross-workspace read, self-promote, site-token
cross-write, removed-member-token-revoke, deletion-suppress,
dry-run-mismatch, audit-write-failure, retention-window,
break-glass-auto-close, report-cross-workspace). Enumerates five
external-audit-trigger conditions (first paid security
questionnaire / DPA; >3 paid workspaces; >3 internal admins;
first Sev1 data-exposure / deletion-failure / audit-gap; first
SSO / SCIM / custom roles / cross-workspace ask). Proposes
sequencing PR#19c-impl-a → impl-f (audit_events schema → role
negative tests → retention dry-run skeleton → deletion workflow
skeleton → monitoring metric names → incident template +
break-glass audit) with each step requiring its own Helen GO.
Carries the eleven PR#18ab §9 governance locks forward verbatim
in §2.1 and §18; flips none. Carries Gate 4C
BLOCKED_PENDING_COMPATIBILITY_PLAN forward in §2. Carries PR#17s
26-row warning by reference. The repo change is docs-only.
PR#19c is path-restricted to the single new file
docs/engineering/pr19c-sprint4-governance-runtime-handoff.md;
PR#18ac, PR#19b artifacts, and root deep-research reports are
excluded from PR#19c's diff. No code, scripts, tests, package
files, migrations, schema.sql, env files, systemd / Nginx files,
AMS source, website artifacts, production config, or DB grant
files modified in the repo. No production-host write, no
production-host read, no HTTP call, no command execution of any
kind is performed by PR#19c. No Sprint 4 implementation PR
opened by PR#19c. No safe_claims dictionary population. No
feature-flag flip. No Lane A / B writer. No AMS Trust / Pass 1 /
Pass 2 runtime. No Gate 4C / 4D / 4E execution. No endpointUrl
re-flip. No production traffic. No customer-facing language
upgrade. No secret printing. Any future Sprint 4 implementation
PR, audit / retention / deletion / suppression / receipt
implementation PR, monitoring / alert / incident implementation
PR, role-runtime PR, SCIM / SSO / custom-role PR, customer-self-
service deletion PR, break-glass-runtime PR, external-audit-
export PR, Gate 4C compatibility-plan PR (PR#18ad → PR#18aj),
Gate 4C execution PR, Gate 4D observation PR, Gate 4E Track A /
Playwright PR, scoring / governance / output lock-amendment PR,
dashboard PR, customer-facing report PR, customer-facing claim /
marketing / sales material PR, deep-research-commit PR, issue-fix
PR, runtime PR, or final cutover-readiness claim PR remains
separately gated by its own explicit Helen GO.**
