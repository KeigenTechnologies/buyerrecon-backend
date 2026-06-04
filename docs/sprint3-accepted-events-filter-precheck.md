# Sprint 3 — `accepted_events` Filter Pre-Check for Session Feature Extractor (Docs-Only)

> **DOCS-ONLY PRE-CHECK PLANNING RECORD.** This PR plans the
> read-only aggregate check that must confirm whether production
> `accepted_events` rows match the session feature extractor's
> locked filter criteria before any extractor GO is issued. It does
> **not** run the session feature extractor, does not authorize the
> extractor, does not write to DB, does not contact production, does
> not activate any worker or customer output, and does not open Gate
> 4E. No secrets, no raw payloads, no raw `request_id` /
> `session_id` — categorical / aggregate counts only.

---

## 1. Purpose

`scripts/extract-session-features.ts` (Sprint 1 PR#11) filters
`accepted_events` using six locked gating conditions (confirmed from source):

```
event_contract_version = 'event-contract-v0.1'
event_origin           = 'browser'
workspace_id IS NOT NULL
site_id      IS NOT NULL
session_id   IS NOT NULL
session_id  <> '__server__'
```

Before a session feature extractor GO is issued, a read-only
pre-check must confirm that at least one `accepted_events` row in
production matches all six conditions. Without this confirmation,
the extractor would run successfully but produce zero
`session_features` rows — making it impossible to distinguish
"no matching events" from "extractor bug."

This PR plans the pre-check only. It does not execute any query.
The actual query execution happens in a separate operator session,
authorized by the merge of this planning PR.

---

## 2. Current state

| Item | Value |
| --- | --- |
| Gate 4C | **`GATE4C_EXECUTION_PASS`** |
| Gate 4D | **`GATE4D_OBSERVATION_PASS`** — PR #101 |
| PR #102 | Merged — `SPRINT3_WORKER_ACTIVATION_SEQUENCE_PLANNING` |
| PR #102 merge commit | `4d4f44a1393a39f8c5facc23b8c3c4bc925d70de` |
| `session_features` | 0 rows |
| Session feature extractor | **Not yet run; not authorized by this PR** |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope for worker-activation sequence |

---

## 3. Pre-check authorization

This PR **plans** the accepted_events filter pre-check. It does
**not** itself run the pre-check and does not authorize extractor
execution. A future operator session may run the read-only
aggregate queries in §4 only after this PR is merged and an
explicit operator GO is confirmed, using the safety posture in §4
(read-only role, `transaction_read_only=on`, aggregate counts
only, no raw identifiers). The session feature extractor itself
requires its own separate GO PR; that GO is not issued by this PR.

---

## 4. Authorized pre-check queries

All queries must run under `buyerrecon_prod_audit_readonly` with
`transaction_read_only=on`. No DML. No DDL. No GRANT.

### 4.1 Confirm role, database, and read-only mode

```sql
SELECT
  current_user,
  current_database(),
  current_setting('transaction_read_only') AS txn_read_only,
  now() AT TIME ZONE 'UTC' AS ts_utc;
```

Expected: `buyerrecon_prod_audit_readonly | buyerrecon_production | on | <timestamp>`

> If `txn_read_only` is not `on` — **stop immediately**.

### 4.2 Total accepted events in observation window

```sql
SELECT COUNT(*) AS accepted_total
FROM public.accepted_events
WHERE received_at >= '2026-06-02 21:14:34+00';
```

Record the count only. Do **not** select `request_id`, `session_id`,
`raw`, `canonical_jsonb`, `ip_hash`, or any other column.

### 4.3 Count matching extractor primary filters

```sql
SELECT COUNT(*) AS filter_matched_count
FROM public.accepted_events
WHERE event_contract_version = 'event-contract-v0.1'
  AND event_origin            = 'browser'
  AND workspace_id IS NOT NULL
  AND site_id      IS NOT NULL
  AND session_id   IS NOT NULL
  AND session_id  <> '__server__';
```

Record the integer count only.

### 4.4 Distribution by `event_contract_version`

```sql
SELECT event_contract_version, COUNT(*) AS row_count
FROM public.accepted_events
GROUP BY event_contract_version
ORDER BY row_count DESC;
```

Record the version strings and counts. Do **not** include any
row-level content.

### 4.5 Distribution by `event_origin`

```sql
SELECT event_origin, COUNT(*) AS row_count
FROM public.accepted_events
GROUP BY event_origin
ORDER BY row_count DESC;
```

Record the origin strings and counts only.

---

## 5. Required evidence after the pre-check

The results must be recorded in a post-pre-check docs-only evidence
PR. That PR must include:

| Evidence item | Format |
| --- | --- |
| `current_user` confirmed | `buyerrecon_prod_audit_readonly` |
| `current_database()` confirmed | `buyerrecon_production` |
| `transaction_read_only` confirmed | `on` |
| `accepted_total` | Integer count |
| `filter_matched_count` | Integer count |
| `event_contract_version` distribution | Version strings + counts |
| `event_origin` distribution | Origin strings + counts |
| Categorical verdict | `FILTER_PRECHECK_PASS` or `FILTER_PRECHECK_ZERO_MATCHES` |
| No raw `request_id` / `session_id` / IP hash / user agent / payload | Confirmed |
| No DML / DDL / GRANT executed | Confirmed |
| No worker / extractor executed | Confirmed |
| No customer output / Lane / scoring / AMS Trust / Pass activated | Confirmed |

---

## 6. Categorical verdict rules

**`FILTER_PRECHECK_PASS`** if:
- `transaction_read_only = on`
- `filter_matched_count ≥ 1`
- No stop-lines triggered

**`FILTER_PRECHECK_ZERO_MATCHES`** if:
- `filter_matched_count = 0`
- This means the Gate 4C canary events do not match both
  `event_contract_version='event-contract-v0.1'` and
  `event_origin='browser'`.
- If this occurs: **do not proceed to the extractor GO.** Record
  the `event_contract_version` and `event_origin` distributions
  from §4.4–§4.5, and open a diagnostic PR before any extractor run.

---

## 7. Post-pre-check next step

If verdict is `FILTER_PRECHECK_PASS`:
→ Create a separate session feature extractor GO PR.
→ That PR will authorize one extractor run per PR #102 §3 sequence.

If verdict is `FILTER_PRECHECK_ZERO_MATCHES`:
→ Create a diagnostic PR recording the distribution outputs.
→ Do not issue an extractor GO until the filter gap is understood.

In both cases: no extractor run is authorized by this planning PR.

---

## 8. Stop-lines

Halt the pre-check session and do not proceed if any of the following:

| Stop-line | Action |
| --- | --- |
| `transaction_read_only` is not `on` | Stop — do not run queries |
| Audit-readonly role cannot SELECT from `accepted_events` | Stop |
| Any query would require printing raw `request_id`, `session_id`, `ip_hash`, user agent, or payload | Stop — do not run |
| Any DML / DDL / GRANT appears in the session | Stop |
| Any worker or extractor command appears in the session | Stop |
| Customer output / Lane / scoring / AMS Trust / Pass activation language appears | Stop |
| Gate 4E opening, activation, readiness, or automatic-advance language appears | Stop |
| Gate 4F language appears | Stop |

---

## 9. Governance locks carry-forward

All of the following remain in force:

| Lock | State |
| --- | --- |
| `customer_claim_allowed` | false |
| `lane_output_allowed` | false |
| `customer_visibility_allowed` | false |
| `lane_write_allowed` | false |
| `allowed_customer_language` | `[]` |
| `SAFE_CLAIMS_DICTIONARY` | `Object.freeze({})` — empty |
| `DEFAULT_EXTERNAL_OUTPUT_FLAGS` | All `false` |
| PR#18ab eleven `false` / `[]` locks | In force |
| PR#73 hard-gate carry-forward | In force |
| Lane A/B row counts | Must remain `0/0` |
| Migration 016 grant safety | In force |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |

---

## 10. Non-goals

This PR does **not**:
- run the session feature extractor or any other worker
- authorize the session feature extractor GO
- execute any database query
- contact production
- perform DB writes or grants
- activate any worker, customer output, Lane writer, scoring
  runtime, AMS Trust / Pass runtime
- change code, tests, migrations, or schema
- open Gate 4E
- invent Gate 4F

---

## 11. Machine-readable block

```yaml
status: SPRINT3_ACCEPTED_EVENTS_FILTER_PRECHECK_PLANNING
gate4c_status: GATE4C_EXECUTION_PASS
gate4d_status: GATE4D_OBSERVATION_PASS
pr102_status: SPRINT3_WORKER_ACTIVATION_SEQUENCE_PLANNING_merged
pr102_merge_commit: 4d4f44a1393a39f8c5facc23b8c3c4bc925d70de
precheck_planned_by_this_pr: true
precheck_executed_by_this_pr: false
precheck_operator_go_required: true
extractor_authorized_by_this_pr: false
extractor_run_by_this_pr: false
precheck_role: buyerrecon_prod_audit_readonly
precheck_db: buyerrecon_production
transaction_read_only_required: true
filter_v1_contract_version: event-contract-v0.1
filter_origin: browser
filter_workspace_id: IS NOT NULL
filter_site_id: IS NOT NULL
filter_session_id: IS NOT NULL AND != __server__
allowed_evidence: aggregate_counts_and_version_strings_only
forbidden_evidence:
  - raw request_id
  - raw session_id
  - raw payloads
  - canonical_jsonb
  - ip_hash
  - user_agent
  - token
  - DSN
  - customer_data
customer_claim_allowed: false
lane_output_allowed: false
customer_visibility_allowed: false
lane_write_allowed: false
allowed_customer_language: []
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step_if_pass: session_features_extractor_go_pr
next_step_if_zero_matches: diagnostic_pr_then_gap_analysis_before_extractor_go
```

---

## 12. Hard boundaries

This PR does **not**:
- run any database query
- contact production or perform DB writes
- apply any DB grant
- deploy or activate any worker
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It plans the accepted_events filter pre-check only.

`next_step: post-merge_run_precheck_then_record_verdict_in_evidence_pr_then_extractor_go_if_pass`
