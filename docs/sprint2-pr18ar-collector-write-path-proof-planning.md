# Sprint 2 PR#18ar — Gate 4C: Collector Write-Path Proof Planning (Docs-Only)

> **DOCS-ONLY PROOF PLANNING RECORD.** This PR plans the safe
> collector write-path proof required after the `accepted_events`
> conflict-target SELECT grant (PR #87). It does not run the proof,
> does not contact production, does not apply further grants, does
> not deploy, does not run a canary, does not retry Gate 4C, and
> does not open Gate 4D. No secrets, no raw payloads, no raw
> `request_id` / `session_id` — categorical / structural facts only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #84 | Merged — `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK` |
| PR #85 | Merged — `GATE4C_BLOCKED_DIAGNOSTIC_PENDING` |
| PR #86 | Merged — `GATE4C_BLOCKED_GRANT_PROPOSAL_PENDING_REVIEW` |
| PR #87 | Merged — `GATE4C_BLOCKED_GRANT_APPLIED_WRITE_PROOF_PENDING` |
| PR #87 merge commit | `458188519f50a15087721c5b72dd671ec82dc035` |
| Grant applied | `GRANT SELECT (workspace_id, site_id, client_event_id) ON public.accepted_events TO buyerrecon_prod_collector_app` at `2026-06-02T17:01:16Z` |
| PR #83 GO | Consumed |
| Gate 4C | Blocked — write-path proof pending |
| Gate 4D | Closed |
| Production posture | Rolled back to legacy `/collect` |
| Retry authorized | No — write-path proof + new fresh GO still required |

---

## 2. Proof objective

The write-path proof must answer:

1. Does `buyerrecon_prod_collector_app` now successfully execute the
   v1 persistence write path that previously failed with
   `storage_failure / permission denied for table accepted_events`?

2. Does the `INSERT INTO accepted_events … ON CONFLICT (workspace_id,
   site_id, client_event_id) … DO NOTHING RETURNING event_id` path
   succeed after the conflict-target `SELECT` grant?

3. Does the proof complete without activating customer output, Lane
   writers, scoring, AMS Trust / Pass runtime, or opening Gate 4D?

The proof is **not** a Gate 4C retry. It does not flip the live
frontend endpoint. It does not involve the public website cutover.
It is a narrowly scoped confirmation that the permission blocker
identified in PR #84 is resolved at the DB layer.

---

## 3. Proof hierarchy

Options are ordered from safest to most invasive. Stop at the
first option that produces a conclusive result.

### Option A — Staging proof (preferred)

Reproduce the production schema and app role / grant posture in
staging, then run a bounded v1 collector fixture or controlled
SDK-like event against the staging environment only.

**Steps:**

1. Confirm staging DB has the same schema version as production
   (`accepted_events`, `ingest_requests`, `rejected_events` tables
   present with the same column set).
2. Confirm staging has a role equivalent to
   `buyerrecon_prod_collector_app` or create one temporarily.
3. Apply the equivalent column-level grant in staging:
   ```sql
   GRANT SELECT (workspace_id, site_id, client_event_id)
   ON public.accepted_events
   TO <staging_app_role>;
   ```
4. Run a bounded synthetic v1 event through the staging collector
   (e.g. a minimal well-formed `session_start` or `page_view` event
   with a synthetic `workspace_id` / `site_id` / `client_event_id`
   that will not conflict with any real customer row).
5. Observe the HTTP response and the resulting DB state via a
   read-only query.
6. Confirm `accepted_events` insert succeeded (row present, or
   `DO NOTHING` on conflict — both are PASS).
7. Confirm no customer-visible path was touched.
8. Record outcome.

**PASS criteria:** HTTP 2xx from staging `/v1/event`; at least one
row written to `accepted_events` or `ON CONFLICT DO NOTHING`
reclassification to `rejected_events`; no `permission denied` error.

**Why preferred:** Does not consume production retry authority. Does
not generate production rows. Does not touch the public website or
the live endpoint flip. Fully reversible.

---

### Option B — Local transaction-rollback SQL proof

If staging is unavailable or the staging schema does not match
production, execute the minimal v1 persistence SQL shape as
`buyerrecon_prod_collector_app` inside an explicit `BEGIN` /
`ROLLBACK` transaction against the production DB.

**Constraints:**

- The transaction **must** be explicitly rolled back; no durable
  rows may be created.
- All values must be clearly synthetic (e.g. a `workspace_id`
  known not to exist in any real customer row).
- Must not print raw payloads, `request_id`, `session_id`, IP
  hashes, user agents, tokens, DSNs, or customer data.
- **Sequence side-effect warning:** `accepted_events_event_id_seq`
  and `rejected_events_id_seq` may increment even inside a rolled-
  back transaction in PostgreSQL. This is expected behaviour for
  sequences (`CACHE` / `NO ROLLBACK`). If sequence gaps are
  operationally unacceptable, do not use this option.
- The proof SQL must be the minimum needed to exercise the conflict
  path — not a full collector request.

**Minimal proof SQL shape (illustrative; values must be synthetic):**

```sql
BEGIN;

INSERT INTO accepted_events (
  site_id, hostname, event_type, session_id, browser_id,
  client_timestamp_ms, received_at, raw, collector_version,
  client_event_id, page_view_id, previous_page_view_id,
  event_sequence_index, event_contract_version, request_id,
  workspace_id, validator_version, schema_key, schema_version,
  event_origin, id_format, traffic_class, payload_sha256,
  size_bytes, ip_hash, consent_state, consent_source,
  consent_updated_at, pre_consent_mode, tracking_mode,
  storage_mechanism, session_seq, session_started_at,
  session_last_seen_at, canonical_jsonb, payload_purged_at,
  debug_mode
)
VALUES (
  'proof-site-id',                         -- site_id       (synthetic)
  'proof.local',                            -- hostname
  'page_view',                              -- event_type
  'proof-session-id',                       -- session_id    (synthetic)
  'proof-browser-id',                       -- browser_id
  0,                                        -- client_timestamp_ms
  NOW(),                                    -- received_at
  '{}',                                     -- raw
  'proof',                                  -- collector_version
  'proof-client-event-id',                  -- client_event_id (synthetic)
  NULL, NULL,                               -- page_view_id, previous_page_view_id
  0,                                        -- event_sequence_index
  'v1',                                     -- event_contract_version
  gen_random_uuid(),                        -- request_id    (synthetic)
  'proof-workspace-id',                     -- workspace_id  (synthetic)
  'proof', 'proof', 'v1',                   -- validator_version, schema_key, schema_version
  'sdk', 'v1', 'standard',                  -- event_origin, id_format, traffic_class
  'proof-sha256',                           -- payload_sha256
  0,                                        -- size_bytes
  'proof-ip-hash',                          -- ip_hash       (synthetic hash)
  'granted', 'sdk', NOW(),                  -- consent_state, consent_source, consent_updated_at
  'none', 'sprint2_v1_event', 'local',      -- pre_consent_mode, tracking_mode, storage_mechanism
  1, NOW(), NOW(),                          -- session_seq, session_started_at, session_last_seen_at
  '{}', NULL, false                         -- canonical_jsonb, payload_purged_at, debug_mode
)
ON CONFLICT (workspace_id, site_id, client_event_id)
  WHERE workspace_id IS NOT NULL
    AND site_id IS NOT NULL
    AND client_event_id IS NOT NULL
  DO NOTHING
RETURNING event_id;

ROLLBACK;
```

**PASS criteria:** The `INSERT … ON CONFLICT … RETURNING` executes
without `permission denied`. Either `event_id` is returned (insert
succeeded) or zero rows returned (conflict hit `DO NOTHING`) — both
are PASS. Error output of any kind containing `permission denied` is
FAIL.

**Why a fallback:** Sequence side effects may be undesirable;
requires direct DB access as the app role; produces no durable rows
but leaves a sequence gap. Acceptable only if the sequence gap is
operationally acceptable and explicitly noted in the evidence record.

---

### Option C — Production write-path probe

Only if Options A and B are both unavailable or inconclusive.

**Requirements:**

- Separate explicit Helen production proof GO — a standalone
  authorization record. This PR does not provide it.
- Bounded, synthetic request only — not a real customer event.
- Must not be a Gate 4C retry (no website frontend flip; no public
  endpoint cutover).
- Must not open Gate 4D.
- Must have defined rollback / cleanup / evidence rules stated in
  the GO.
- Must not activate customer output, Lane writers, scoring, AMS
  Trust / Pass runtime.

This option is listed for completeness. The strong preference is
Option A (staging). Option B is acceptable with acknowledged
sequence caveat. Option C requires its own GO before any action.

---

## 4. Pre-proof checks

Before executing whichever proof path is chosen, confirm all of
the following:

| Check | Expected |
| --- | --- |
| `current_user` in proof session | `buyerrecon_prod_collector_app` (or staging equivalent) |
| `accepted_events.workspace_id` column SELECT | true |
| `accepted_events.site_id` column SELECT | true |
| `accepted_events.client_event_id` column SELECT | true |
| `accepted_events.event_id` column SELECT | true |
| `accepted_events` table-level SELECT | false (unless explicitly changed) |
| `accepted_events` INSERT | true |
| RLS on `accepted_events` | false |
| Policies on `accepted_events` | 0 |
| Triggers on `accepted_events` | 0 |
| Further grants applied since PR #87 | None — if any, record them |
| Gate 4C retry performed | No |
| `accepted_events_dedup` index present | Yes — verify definition unchanged |

---

## 5. Required evidence record

For whichever option is executed, the post-proof evidence PR must
record all of the following (no secrets, no raw payloads, no raw
request IDs):

| Evidence item | Notes |
| --- | --- |
| Proof environment | staging / local rollback / production probe |
| Role used | `buyerrecon_prod_collector_app` or staging equivalent |
| Pre-proof privilege snapshot | Column SELECT values for conflict-target columns |
| Proof command category | Categorical description only — no DSN, no token |
| `accepted_events` write result | insert succeeded / `DO NOTHING` conflict hit / error |
| `event_id` returned or zero rows | Record which |
| Sequence side effects | Document if sequence incremented |
| `ingest_requests` / `rejected_events` side effects | Record if rows written |
| Transaction committed or rolled back | Explicit statement |
| Customer-visible path touched | No (must be true for PASS) |
| Lane / scoring / AMS Trust / Pass / customer output active | No (must be true for PASS) |
| Gate 4D opened | No (must be true for PASS) |
| Final proof verdict | `COLLECTOR_WRITE_PATH_PROOF_PASS` or `COLLECTOR_WRITE_PATH_PROOF_BLOCKED` |

---

## 6. After a PASS verdict

A `COLLECTOR_WRITE_PATH_PROOF_PASS` result unlocks the next step
but does **not** by itself authorize a Gate 4C retry. The remaining
gate sequence is:

1. Post-proof evidence docs PR (records §5 evidence; this PR
   plans that record, not executes it).
2. Review and merge the evidence PR.
3. New fresh Gate 4C execution GO PR — a PR#83-style record with
   `single_attempt_only=true`, explicitly referencing the proof
   evidence.
4. Review and merge the GO PR.
5. Single-attempt Gate 4C retry under the new GO, per PR #80
   runbook.

A `COLLECTOR_WRITE_PATH_PROOF_BLOCKED` result requires a further
diagnostic cycle before any retry.

---

## 7. Machine-readable block

```yaml
status: GATE4C_BLOCKED_WRITE_PROOF_PLANNING
pr87_status: GATE4C_BLOCKED_GRANT_APPLIED_WRITE_PROOF_PENDING
proof_objective: confirm_accepted_events_on_conflict_returning_path_succeeds_after_grant
preferred_proof_option: A_staging
fallback_proof_option: B_local_rollback_transaction
last_resort_option: C_production_probe_requires_separate_go
proof_run_by_this_pr: false
production_contact_by_this_pr: false
gate_4c_retry_authorised_by_this_pr: false
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_grant_applied_by_this_pr: false
deploy_by_this_pr: false
canary_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
runtime_scoring_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
next_step: execute_selected_proof_option_then_record_in_docs_pr_then_new_gate4c_go_pr_then_single_retry
```

---

## 8. Hard boundaries

This PR does **not**:
- run the write-path proof
- contact production or staging
- apply any DB grant or further privilege change
- perform any DB write
- deploy or edit `/var/www`
- run a canary or retry Gate 4C
- authorize a production write-path probe (Option C requires its
  own GO)
- open Gate 4D / Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data
- activate customer output / Lane writers / runtime scoring /
  AMS Trust / Pass runtime

It records the proof planning only.

`next_step: execute_selected_proof_option_then_record_in_docs_pr_then_new_gate4c_go_pr_then_single_retry`
