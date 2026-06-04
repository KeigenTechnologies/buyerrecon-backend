# Sprint 3 — `accepted_events` Filter Pre-Check Evidence (Docs-Only)

> **DOCS-ONLY EVIDENCE RECORD.** This PR records the execution
> result of the bounded read-only `accepted_events` aggregate filter
> pre-check authorized by PR #104 (amended by PR #105). It does not
> run the session feature extractor, does not activate any worker,
> does not write to DB, does not contact production beyond the
> described read-only session, and does not open Gate 4E. No secrets,
> no raw payloads, no raw `request_id` / `session_id` — aggregate
> counts and categorical results only.

---

## 1. Evidence verdict

**`FILTER_PRECHECK_PASS`**

All 9 accepted_events rows in the bounded window matched all six
session feature extractor filter conditions.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #103 | Merged — `SPRINT3_ACCEPTED_EVENTS_FILTER_PRECHECK_PLANNING` |
| PR #104 | Merged — `SPRINT3_ACCEPTED_EVENTS_FILTER_PRECHECK_GO_RECORDED` |
| PR #105 | Merged — GO amendment; Q1 hard gate + bounded window + no `eval` |
| PR #105 merge commit | `725bc0ee0c0204ab03e0cf650f157ddd328fcf64` |
| Session feature extractor | **Not run; not authorized by this PR** |
| `session_features` | 0 rows — extractor not yet run |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |

---

## 3. Initial Q1 attempt — PGOPTIONS-only hard-gate failure

The first attempt ran Q1 with only `PGOPTIONS`:

```
PGOPTIONS="-c statement_timeout=15000 -c transaction_read_only=on"
```

Q1 output:

```
buyerrecon_prod_audit_readonly|buyerrecon_production|off|2026-06-04 11:21:39.803774
```

`txn_read_only = off`. **Hard-gate failed.**

Per the PR #105 amendment: Q2–Q5 were **not run** under this failed
attempt. The `PGOPTIONS` approach did not override the role's default
transaction mode in this configuration.

**Interpretation:** `PGOPTIONS` sets session-level defaults, but for
this role/connection, `current_setting('transaction_read_only')`
reflected `off`. The actual transaction isolation was confirmed by
the corrected method below.

---

## 4. Corrected execution method — explicit `BEGIN READ ONLY`

A diagnostic explicit transaction check was run:

```sql
BEGIN READ ONLY;
SELECT current_user, current_database(),
       current_setting('transaction_read_only') AS txn_read_only,
       now() AT TIME ZONE 'UTC' AS ts_utc;
ROLLBACK;
```

Output:

```
BEGIN
buyerrecon_prod_audit_readonly|buyerrecon_production|on|2026-06-04 11:22:19.359735
ROLLBACK
```

`txn_read_only = on` — hard-gate passed.

**Interpretation:** `BEGIN READ ONLY` sets the transaction as
read-only at the transaction level. `current_setting('transaction_read_only')`
correctly reports `on` inside a `BEGIN READ ONLY` block. All Q2–Q5
were run inside one explicit `BEGIN READ ONLY ... ROLLBACK`
transaction, which provides the same protection as a session-level
`transaction_read_only` flag.

---

## 5. Final execution — queries and raw output

All queries ran inside one explicit `BEGIN READ ONLY ... ROLLBACK`
block. No `eval`. No DML. No DDL. No GRANT.

Execution timestamp (Q1): `2026-06-04 11:23:09.583853 UTC`

Raw output (categorical — no row-level content, no identifiers):

```
BEGIN
Q1_GATE|buyerrecon_prod_audit_readonly|buyerrecon_production|on|2026-06-04 11:23:09.583853
Q2_ACCEPTED_TOTAL|9
Q3_FILTER_MATCHED|9
Q4_VERSION_DIST|event-contract-v0.1|9
Q5_ORIGIN_DIST|browser|9
ROLLBACK
```

---

## 6. Evidence summary

| Metric | Value |
| --- | --- |
| `current_user` | `buyerrecon_prod_audit_readonly` |
| `current_database()` | `buyerrecon_production` |
| `txn_read_only` | `on` |
| Execution timestamp | `2026-06-04 11:23:09.583853 UTC` |
| Bounded window | `received_at >= '2026-06-02 21:14:34+00'` |
| `accepted_total` (Q2) | 9 |
| `filter_matched_count` (Q3) | **9** |
| `event_contract_version` distribution (Q4) | `event-contract-v0.1` → 9 |
| `event_origin` distribution (Q5) | `browser` → 9 |

All six extractor filter conditions were implicitly confirmed by Q3:
- `event_contract_version = 'event-contract-v0.1'` — present in Q4
- `event_origin = 'browser'` — present in Q5
- `workspace_id IS NOT NULL` — included in Q3 filter
- `site_id IS NOT NULL` — included in Q3 filter
- `session_id IS NOT NULL` — included in Q3 filter
- `session_id <> '__server__'` — included in Q3 filter

---

## 7. Interpretation

The current bounded `accepted_events` window (the 9 Gate 4C canary
events) matches **all six** session feature extractor filter
conditions. `filter_matched_count = accepted_total = 9` means every
event in the window passes every filter.

When the session feature extractor is separately authorized and run,
this evidence indicates the bounded window should have non-zero
candidate `accepted_events` rows matching the extractor's six gating
filters. The actual number of `session_features` upsert rows still
depends on the extractor's grouping / upsert logic and must be proven
by a separate post-run evidence PR.

**What this evidence does not prove:**

- It does not prove the extractor has run or will run successfully.
- It does not prove sufficient volume for meaningful feature derivation.
- It does not authorize the session feature extractor.
- It does not authorize any downstream worker.
- It does not open Gate 4E.

---

## 8. Next step

`FILTER_PRECHECK_PASS` clears the pre-check gate. The next
separately gated step is a **session feature extractor GO PR**
authorizing one run of `scripts/extract-session-features.ts`
against `buyerrecon_production`.

That GO PR must:
- be a separate docs-only PR, reviewed and merged before execution
- specify the extractor run parameters (SINCE\_HOURS or SINCE/UNTIL,
  WORKSPACE\_ID, SITE\_ID if applicable)
- state `RECORD_ONLY`-equivalent posture (extractor writes only to
  `session_features`; no customer output; no Lane writes)
- require a post-run read-only evidence PR

**No extractor run is authorized by this evidence PR.**

---

## 9. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| Session feature extractor run | Not run |
| Behavioural extractor run | Not run |
| Stage 0 run | Not run |
| Risk worker run | Not run |
| POI worker run | Not run |
| Evidence snapshot run | Not run |
| Lane preview run | Not run |
| DML / DDL / GRANT | None |
| DB write | None |
| Schema change | None |
| Grant change | None |
| Deploy | None |
| Customer output | None |
| Lane write | None |
| Scoring runtime | None |
| AMS Trust / Pass runtime | None |
| Gate 4E opened | No |
| Gate 4F invented | No |
| Raw `request_id` printed | No |
| Raw `session_id` printed | No |
| Raw payload printed | No |
| `canonical_jsonb` printed | No |
| IP hash printed | No |
| User agent printed | No |
| DSN or secret printed | No |
| Customer data printed | No |

---

## 10. Machine-readable block

```yaml
status: SPRINT3_ACCEPTED_EVENTS_FILTER_PRECHECK_PASS_EVIDENCE
go_source: PR_104_PR_105
pgoptions_only_attempt_txn_read_only: off
pgoptions_only_q1_hard_gate: FAILED
corrected_method: BEGIN_READ_ONLY_transaction
final_txn_read_only: on
execution_timestamp_utc: "2026-06-04 11:23:09.583853"
observation_window_start: "2026-06-02 21:14:34+00"
role: buyerrecon_prod_audit_readonly
database: buyerrecon_production
accepted_total: 9
filter_matched_count: 9
event_contract_version_dist:
  event-contract-v0.1: 9
event_origin_dist:
  browser: 9
verdict: FILTER_PRECHECK_PASS
extractor_authorized_by_this_pr: false
extractor_run_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: session_features_extractor_go_pr_then_extractor_run_then_evidence_pr
```

---

## 11. Hard boundaries

This PR does **not**:
- run any additional production query — the bounded read-only
  aggregate operator session described above is already completed
  and recorded; no further production query is being run by this PR
- run any worker or extractor — the session feature extractor and
  all downstream workers remain not run and not authorized by this PR
- contact production beyond the already-completed read-only session
- perform DB writes
- apply any DB grant
- deploy or activate any worker
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw `request_id`, raw `session_id`, raw payloads,
  `canonical_jsonb`, Authorization values, DSNs, IP hashes,
  user agents, or customer data

It records the accepted_events filter pre-check execution evidence only.

`next_step: session_features_extractor_go_pr_then_extractor_run_then_evidence_pr`
