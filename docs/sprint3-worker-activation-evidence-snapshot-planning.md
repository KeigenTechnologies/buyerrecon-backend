# Sprint 3 — Worker Activation and Evidence Snapshot Sequencing Planning (Docs-Only)

> **DOCS-ONLY PLANNING RECORD.** This PR plans the safe worker
> activation and evidence snapshot sequencing after Gate 4D PASS.
> It does **not** authorize any worker run, does not contact
> production, does not write to DB, does not activate customer
> output, does not activate scoring runtime, does not open Gate 4E,
> and does not invent Gate 4F. Each worker activation requires its
> own separate GO and post-run evidence PR. No secrets, no raw
> payloads, no raw `request_id` / `session_id` — categorical /
> structural facts only.

---

## 1. Current state after Gate 4D PASS

| Item | Value |
| --- | --- |
| Gate 4C | **`GATE4C_EXECUTION_PASS`** — PR #92 |
| Gate 4D | **`GATE4D_OBSERVATION_PASS`** — PR #101, merged `2026-06-04T09:02:06Z`, commit `cfbb2c49835b5d5770fb972043bb84cb953d34a9` |
| PR #98 GO | Consumed |
| `session_features` | 0 rows — extractor not yet run |
| `session_behavioural_features_v0_2` | 0 rows — extractor not yet run |
| `stage0_decisions` | 0 rows — worker not yet run |
| `risk_observations_v0_1` | 0 rows — worker not yet run |
| `poi_observations_v0_1` | 0 rows — worker not yet run |
| `poi_sequence_observations_v0_1` | 0 rows — worker not yet run |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |

**Note on Gate 4D observation volume:** The 24h24m Gate 4D observation
window (`2026-06-02 21:14:34+00` to `2026-06-03 21:38:37+00`) contained
only the original 9 Gate 4C canary events. No new organic `/v1/event`
volume appeared. This is benign context. The `GATE4D_OBSERVATION_PASS`
verdict rests on error-absence, stable ingestion, `COUNT(*)` readiness
under Option B audit grants, and column-protection holding — not on
volume. New volume will arrive when the public `endpointUrl` continues
to be served.

---

## 2. Worker activation prerequisites (pre-run checks required)

Before any worker script is executed in production, all of the
following must be confirmed in a separate read-only pre-check and
explicitly recorded in the GO PR for that worker:

1. **Database connectivity and role** — the worker must connect to
   `buyerrecon_production` using the correct role. The DSN must not
   be printed.

2. **accepted-events filter check for the session_features extractor**
   — `scripts/extract-session-features.ts` (Sprint 1 PR#11) filters
   on `event_contract_version = 'event-contract-v0.1'` and
   `event_origin = 'browser'`. A read-only pre-run query must confirm
   that accepted events matching both filters exist before the first
   extractor run. This check must be secret-safe and must not print
   raw `request_id`, `session_id`, IP hashes, user agents, tokens,
   DSNs, or customer data.

3. **Record-only posture** — the Stage 0 worker (`scripts/run-stage0-worker.ts`,
   Sprint 2 PR#5) runs in `RECORD_ONLY` mode. No customer-visible
   output is generated. This must be confirmed in the Stage 0 GO PR.

4. **Governance locks** — before each worker run, confirm that Lane
   A/B row counts remain `0/0`, no customer output is active, and
   no scoring runtime is active.

5. **No Lane writer, no scoring runtime** — worker scripts write only
   to their designated evidence tables as listed in §3. Migration 016
   grant safety is in force; `scoring_output_lane_a` /
   `scoring_output_lane_b` must not receive writes.

---

## 3. Proposed activation sequence

Ordered by data dependency. All scripts confirmed present in
`scripts/` at the time of this planning PR.

| Step | Script | Reads from | Writes / UPSERTs to | Key notes |
| --- | --- | --- | --- | --- |
| 1a | `scripts/extract-session-features.ts` (PR#11) | `accepted_events` | `session_features` | Idempotent upsert; filter: `event_contract_version='event-contract-v0.1'`, `event_origin='browser'` |
| 1b | `scripts/extract-behavioural-features.ts` (PR#1+PR#2) | `accepted_events` | `session_behavioural_features_v0_2` | Independent of session_features; can run in parallel with step 1a |
| 2 | `scripts/run-stage0-worker.ts` (PR#5) | `session_features` | `stage0_decisions` | **RECORD_ONLY** mode; no customer output |
| 3 | `scripts/run-risk-evidence-worker.ts` (PR#6) | `stage0_decisions` + `session_behavioural_features_v0_2` | `risk_observations_v0_1` | RECORD_ONLY; depends on both step 2 and step 1b |
| 4 | `scripts/run-poi-core-worker.ts` (PR#11c) | `session_features` + `stage0_decisions` (side-read) | `poi_observations_v0_1` | No customer-facing output; no Lane A/B writes |
| 5 | `scripts/run-poi-sequence-worker.ts` (PR#12d) | `poi_observations_v0_1` | `poi_sequence_observations_v0_1` | Depends on step 4 |
| 6 | `scripts/evidence-review-snapshot-report.ts` (PR#15a) | `accepted_events`, `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, `risk_observations_v0_1`, `poi_observations_v0_1` (categorical counts) | **None** — reads evidence tables and emits internal markdown snapshot to stdout only | **Strictly read-only.** No INSERT / UPDATE / DELETE / DDL. No durable table write. Produces markdown report artifact; not a DB write. |

**Steps 1a and 1b are independent** and may be run in parallel once
accepted-events filter checks pass.

**Each step requires its own separate GO PR** before the worker is
executed. This planning PR does not authorize any run.

---

## 4. Evidence snapshot readiness

The evidence review snapshot runner
(`scripts/evidence-review-snapshot-report.ts`, Sprint 2 PR#15a) is
**strictly read-only**. It executes `SELECT`-only queries against
the evidence tables and renders an internal markdown diagnostic to
stdout. It performs no INSERT, UPDATE, DELETE, or DDL. It does not
write a snapshot row to any durable table.

The runner checks for `session_features` non-zero row count in the
observation window. If `session_features_rows = 0`, it emits:
`"session_features has zero rows in window — cannot tell automated
traffic from human evaluators by behaviour shape."` This means step
1a must complete and produce non-zero rows before the snapshot report
is meaningful.

Because the snapshot is read-only and produces only a stdout artifact,
it can be re-run without a write-side GO. However, since it accesses
production data, it still requires the standard evidence-safe session
(read-only role, no raw identifiers recorded in evidence output).

---

## 5. Downstream dependencies before report work

The following prerequisite chain must complete before any report
runtime or safe-claims governance is considered:

```
Gate 4D PASS (done — PR #101)
  │
  ├── accepted-events filter pre-check (read-only; next separately gated step)
  │
  ├── 1a. session_features extractor GO + run + read-only proof
  ├── 1b. behavioural features extractor GO + run + proof  (parallel with 1a)
  │
  ├── 2. Stage 0 worker GO + run + proof  (RECORD_ONLY; requires 1a)
  │
  ├── 3. Risk evidence worker GO + run + proof  (requires 2 + 1b)
  │
  ├── 4. POI core worker GO + run + proof  (requires 1a + 2)
  ├── 5. POI sequence worker GO + run + proof  (requires 4)
  │
  ├── 6. Evidence snapshot run + internal proof  (requires 1a + 1b minimum)
  │
  ├── Report fixture/test implementation PR  (PR #100 planned)
  ├── Report contract version-stamp code PR  (ProductContextProfile §6 stamps)
  ├── Safe-claims governance review PR
  └── Customer-facing output planning  (separately gated; much later)
```

---

## 6. First next step recommendation

The immediately next separately gated step is a **pre-run
accepted-events filter check**: a read-only query confirming that
accepted events matching both `event_contract_version='event-contract-v0.1'`
and `event_origin='browser'` exist in `buyerrecon_production` before
the session_features extractor is run.

This check must be:
- Executed under `buyerrecon_prod_audit_readonly` with
  `transaction_read_only=on`
- Secret-safe: must not print raw `request_id`, `session_id`, IP
  hashes, user agents, tokens, DSNs, or customer data
- Recorded in a docs-only evidence PR with the event count (not
  individual row content) before any extractor GO is issued

---

## 7. Governance locks carry-forward

All of the following remain in force and must not be relaxed without
explicit governance review:

| Lock | State |
| --- | --- |
| `customer_claim_allowed` | false |
| `lane_output_allowed` | false |
| `customer_visibility_allowed` | false |
| `lane_write_allowed` | false |
| `allowed_customer_language` | `[]` |
| `SAFE_CLAIMS_DICTIONARY` | `Object.freeze({})` — empty |
| `DEFAULT_EXTERNAL_OUTPUT_FLAGS` | All `false` (`show_evidence_grade`, `show_recommendations`, `show_account_inference`, `auto_send_reports`) |
| PR#18ab eleven `false` / `[]` locks | In force |
| PR#73 hard-gate carry-forward | In force |
| Lane A/B row counts | Must remain `0/0` |
| Migration 016 grant safety | In force |

---

## 8. Stop-lines for this activation sequence

Progress must stop and the current step must be halted if:

| Stop-line | Action |
| --- | --- |
| Any worker produces unexpected `scoring_output_lane_a` / `_lane_b` rows | Stop |
| Any customer-visible output is generated | Stop |
| Stage 0 worker is not in `RECORD_ONLY` mode at execution time | Stop — do not run |
| `SAFE_CLAIMS_DICTIONARY` becomes non-empty without explicit approval | Stop |
| Any worker is run without its own GO PR | Stop |
| Raw identifiers / payloads / customer data appear in evidence output | Stop |
| Gate 4E opening, activation, readiness, or automatic-advance language appears | Stop |
| Any scoring runtime, AMS Trust, or Pass runtime is activated | Stop |

---

## 9. Non-goals

This PR does **not**:
- run any worker or script
- add or modify tests
- change code
- contact production or perform DB queries
- perform DB writes or grants
- activate report runtime
- activate customer output
- add safe claims
- activate scoring
- write Lane A/B rows
- change DB, schema, or migrations
- open Gate 4E
- invent Gate 4F

---

## 10. Machine-readable block

```yaml
status: SPRINT3_WORKER_ACTIVATION_SEQUENCE_PLANNING
gate4c_status: GATE4C_EXECUTION_PASS
gate4d_status: GATE4D_OBSERVATION_PASS
gate4d_pr: PR_101_merged_2026-06-04T09:02:06Z
gate4d_merge_commit: cfbb2c49835b5d5770fb972043bb84cb953d34a9
session_features_rows: 0
session_behavioural_features_v0_2_rows: 0
stage0_decisions_rows: 0
risk_observations_v0_1_rows: 0
poi_observations_v0_1_rows: 0
poi_sequence_observations_v0_1_rows: 0
evidence_snapshot_write: false
evidence_snapshot_produces: stdout_markdown_only
workers_activated_by_this_pr: false
customer_output_by_this_pr: false
lane_write_by_this_pr: false
scoring_runtime_by_this_pr: false
ams_trust_pass_by_this_pr: false
customer_claim_allowed: false
lane_output_allowed: false
customer_visibility_allowed: false
lane_write_allowed: false
allowed_customer_language: []
gate_4e_opened: false
gate_4f_invented: false
first_next_step: accepted_events_filter_pre_check_readonly_then_session_features_extractor_go
next_step: per_worker_separate_go_and_evidence_pr_per_step
```

---

## 11. Hard boundaries

This PR does **not**:
- run any worker, script, or query
- contact production or perform DB writes
- apply any DB grant or change privileges
- deploy or change website artifacts
- activate any worker, customer output, Lane writer, scoring
  runtime, AMS Trust / Pass runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the worker activation and evidence snapshot sequencing
planning only.

`first_next_step: accepted_events_filter_pre_check_readonly_then_session_features_extractor_go`
