# Sprint 3 — `accepted_events` Filter Pre-Check Operator GO (Docs-Only)

> **DOCS-ONLY OPERATOR GO RECORD. THIS PR DOES NOT EXECUTE.** It
> records Helen's explicit GO for one bounded read-only aggregate
> pre-check confirming whether production `accepted_events` contains
> rows matching the session feature extractor's locked filter
> criteria. The pre-check happens only in a later, separate operator
> session. This PR runs no queries, writes no data, contacts no
> production environment, does not run the session feature extractor,
> and does not open Gate 4E. No secrets, no raw payloads, no raw
> `request_id` / `session_id` — aggregate counts and categorical
> verdicts only.

---

## 1. Status / verdict

- **Status:** `SPRINT3_ACCEPTED_EVENTS_FILTER_PRECHECK_GO_RECORDED`
- **Planning source:** PR #103
  (`docs/sprint3-accepted-events-filter-precheck.md`, merged
  `2026-06-04T10:21:41Z`, commit
  `60ebc45c7847329af59d87872f844913620b6a42`)
- **Pre-check type:** Read-only aggregate filter check — not
  extractor execution

**Authorization granted by this PR (after merge only):**

- `precheck_go_recorded=true`
- `read_only_role_required=true` (`buyerrecon_prod_audit_readonly`)
- `production_db_required=true` (`buyerrecon_production`)
- `transaction_read_only_required=true`
- `post_precheck_evidence_pr_required=true`
- `single_session_only=true`

**Still false (NOT authorized by this PR):**

- `extractor_authorized_by_this_pr=false`
- `extractor_run_by_this_pr=false`
- `worker_activation_authorised_by_this_pr=false`
- `lane_writer_authorised_by_this_pr=false`
- `scoring_runtime_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `ams_trust_pass_runtime_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_authorised_by_this_pr=false`
- `precheck_before_this_pr_merges_authorised=false`

---

## 2. Helen GO statement

> **Helen authorizes the operator to execute one bounded read-only
> aggregate filter pre-check against `buyerrecon_production` using
> `buyerrecon_prod_audit_readonly` with `transaction_read_only=on`,
> strictly per the query scope in §3 and the safety posture in §4.
> No extractor execution. No worker activation. No DML. No DDL.
> No GRANT.**

Clarifications:

- This GO authorizes the pre-check queries only. The session feature
  extractor (`scripts/extract-session-features.ts`) requires its
  own separate GO PR.
- **No pre-check before this PR is merged.**
- After the pre-check: a separate post-pre-check evidence PR is
  required before any extractor GO is issued.

---

## 3. Authorized pre-check queries

All queries must run under `buyerrecon_prod_audit_readonly` with
`transaction_read_only=on`. No DML. No DDL. No GRANT.

### Query 1 — Role, database, and read-only mode

```sql
SELECT
  current_user,
  current_database(),
  current_setting('transaction_read_only') AS txn_read_only,
  now() AT TIME ZONE 'UTC' AS ts_utc;
```

Expected: `buyerrecon_prod_audit_readonly | buyerrecon_production | on | <timestamp>`

> **Stop immediately if `txn_read_only` is not `on`.**

### Query 2 — Total accepted events in Gate 4C+ window

```sql
SELECT COUNT(*) AS accepted_total
FROM public.accepted_events
WHERE received_at >= '2026-06-02 21:14:34+00';
```

Returns one integer. No `request_id`, `session_id`, `raw`,
`canonical_jsonb`, `ip_hash`, or other column is selected.

### Query 3 — Count matching all six extractor filters

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

Returns one integer. This mirrors the exact six locked gating
conditions from `scripts/extract-session-features.ts` lines
137–142 (confirmed from source).

### Query 4 — Distribution by `event_contract_version`

```sql
SELECT event_contract_version, COUNT(*) AS row_count
FROM public.accepted_events
GROUP BY event_contract_version
ORDER BY row_count DESC;
```

Returns version strings and counts only. No row-level content.

### Query 5 — Distribution by `event_origin`

```sql
SELECT event_origin, COUNT(*) AS row_count
FROM public.accepted_events
GROUP BY event_origin
ORDER BY row_count DESC;
```

Returns origin strings and counts only.

---

## 4. Safety posture

| Requirement | Value |
| --- | --- |
| Role | `buyerrecon_prod_audit_readonly` |
| Database | `buyerrecon_production` |
| `transaction_read_only` | `on` (confirm via Query 1 before proceeding) |
| `statement_timeout` | `15000` (15 s) |
| Query types | `SELECT` / `COUNT(*)` / `GROUP BY` only |
| DML / DDL / GRANT | Forbidden |
| Worker / extractor execution | Forbidden |

**Forbidden outputs** — must not be printed or recorded:

`request_id` · `session_id` · `raw` · `canonical_jsonb` ·
`ip_hash` · `user_agent` · raw UUIDs · tokens · DSNs ·
Authorization values · customer-identifying data

---

## 5. Categorical verdict rules

**`FILTER_PRECHECK_PASS`** if:
- `txn_read_only = on`
- `filter_matched_count ≥ 1`
- No stop-lines triggered

**`FILTER_PRECHECK_ZERO_MATCHES`** if:
- `filter_matched_count = 0`
- Record the distributions from Query 4 and Query 5.
- Do **not** proceed to extractor GO; open a diagnostic PR first.

**`FILTER_PRECHECK_BLOCKED`** if:
- Any stop-line from §6 is triggered.
- Record the specific stop-line.

---

## 6. Stop-lines

Halt the session immediately if any of the following:

| Stop-line | Action |
| --- | --- |
| `txn_read_only` is not `on` (Query 1) | Stop — do not run further queries |
| Audit-readonly role cannot `SELECT` from `accepted_events` | Stop |
| Any query would require printing raw identifiers or payloads | Stop — do not run |
| Any DML / DDL / GRANT appears in the session | Stop |
| Any worker or extractor command appears | Stop |
| Customer output / Lane / scoring / AMS Trust / Pass activation | Stop |
| Gate 4E opening, activation, readiness, or automatic-advance language | Stop |
| Gate 4F language | Stop |

---

## 7. Required post-pre-check evidence PR

A separate docs-only evidence PR must be created after the operator
session, recording (no secrets, no raw identifiers):

| Evidence item | Format |
| --- | --- |
| Pre-check timestamp | UTC timestamp |
| `current_user` | `buyerrecon_prod_audit_readonly` |
| `current_database()` | `buyerrecon_production` |
| `transaction_read_only` | `on` |
| `accepted_total` | Integer count |
| `filter_matched_count` | Integer count |
| `event_contract_version` distribution | Version strings + counts |
| `event_origin` distribution | Origin strings + counts |
| No raw identifiers / payloads selected | Confirmed |
| No DML / DDL / GRANT executed | Confirmed |
| No worker / extractor executed | Confirmed |
| No customer output / Lane / scoring / AMS Trust / Pass | Confirmed |
| Categorical verdict | `FILTER_PRECHECK_PASS`, `FILTER_PRECHECK_ZERO_MATCHES`, or `FILTER_PRECHECK_BLOCKED` |

---

## 8. Next step after evidence PR

**If `FILTER_PRECHECK_PASS`:**
- Create a separate session feature extractor GO PR.
- That GO PR will authorize one run of
  `scripts/extract-session-features.ts` against
  `buyerrecon_production`.

**If `FILTER_PRECHECK_ZERO_MATCHES`:**
- Create a diagnostic PR recording the distributions.
- Investigate which filter(s) the canary events fail.
- Do not issue an extractor GO until the gap is understood.

**If `FILTER_PRECHECK_BLOCKED`:**
- Record the specific stop-line in the evidence PR.
- Do not proceed to extractor GO.

---

## 9. Governance locks carry-forward

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
| Lane A/B row counts | Must remain `0/0` |
| Migration 016 grant safety | In force |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |
| Gate 4E | Closed |
| Gate 4F | Not invented |

---

## 10. Machine-readable block

```yaml
status: SPRINT3_ACCEPTED_EVENTS_FILTER_PRECHECK_GO_RECORDED
planning_source: PR_103_merged_2026-06-04T10:21:41Z
planning_merge_commit: 60ebc45c7847329af59d87872f844913620b6a42
precheck_go_recorded: true
precheck_before_this_pr_merges_authorised: false
precheck_role: buyerrecon_prod_audit_readonly
precheck_db: buyerrecon_production
transaction_read_only_required: true
single_session_only: true
extractor_filter_conditions:
  - event_contract_version = 'event-contract-v0.1'
  - event_origin = 'browser'
  - workspace_id IS NOT NULL
  - site_id IS NOT NULL
  - session_id IS NOT NULL
  - "session_id <> '__server__'"
allowed_outputs: aggregate_counts_and_version_strings_only
post_precheck_evidence_pr_required: true
extractor_authorized_by_this_pr: false
extractor_run_by_this_pr: false
worker_activation_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_authorised_by_this_pr: false
lane_preview_in_scope: false
next_step_if_pass: session_features_extractor_go_pr
next_step_if_zero_matches: diagnostic_pr_then_gap_analysis
next_step_if_blocked: evidence_pr_recording_stop_line
```

---

## 11. Hard boundaries

This PR does **not**:
- run any database query or pre-check
- contact production
- perform any DB write
- apply any DB grant
- run the session feature extractor or any other worker
- activate customer output, Lane writer, scoring runtime,
  AMS Trust / Pass runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the operator GO for one bounded read-only pre-check only.

`next_step: operator_run_precheck_per_section_3_then_open_evidence_pr`
