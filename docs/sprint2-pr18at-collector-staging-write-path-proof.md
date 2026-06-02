# Sprint 2 PR#18at — Gate 4C: Staging Collector Write-Path Proof After `accepted_events` Grant (Docs-Only)

> **DOCS-ONLY STAGING WRITE-PATH PROOF RECORD.** This PR records
> the staging collector write-path proof session run against
> `buyerrecon-backend.service` (port 3071) and `buyerrecon_staging`.
> The proof was run in a prior operator session and is recorded here.
> This PR itself contacts no environment, applies no grant, performs
> no DB write, and does not authorize a Gate 4C production retry.
> No secrets, no raw payloads, no raw `request_id` / `session_id`,
> no raw tokens — categorical / structural facts and redactions only.

---

## 1. Proof verdict

**`COLLECTOR_WRITE_PATH_PROOF_PASS_STAGING`**

---

## 2. Classification

| Item | Value |
| --- | --- |
| Proof environment | Staging — `buyerrecon_staging` DB, `buyerrecon-backend.service` port 3071 |
| Gate 4C retry | **No** |
| Production website canary | **No** |
| `buyerrecon.com` contacted | **No** |
| Deployment performed | **No** |
| `/var/www` edited | **No** |
| Gate 4D opened | **No** |
| New retry authorized by this PR | **No** |
| New fresh Gate 4C GO PR required | **Yes** — still required before any future production retry |

---

## 3. Current state

| Item | Value |
| --- | --- |
| PR #84 | Merged — `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK` |
| PR #85–#89 | Merged — diagnostic, grant, and pre-check evidence chain |
| PR #89 merge commit | `443ea405b2c7c37e2cdc111c6e8255dac5db8fa7` |
| Grant applied | `GRANT SELECT (workspace_id, site_id, client_event_id) ON public.accepted_events TO buyerrecon_prod_collector_app` at `2026-06-02T17:01:16Z` |
| `EXPLAIN_PRECHECK_PASS` | Recorded in PR #89 |
| PR #83 GO | Consumed |
| Gate 4C | Blocked — proof evidence present; new fresh GO PR still required |
| Gate 4D | Closed |
| Production posture | Rolled back to legacy `/collect` |

---

## 4. Staging environment

| Item | Value |
| --- | --- |
| Service | `buyerrecon-backend.service` |
| Port | `3071` |
| Service state | Active and listening on `:3071` at time of proof |
| DB | `buyerrecon_staging` |
| App role | `buyerrecon_app` |
| Endpoint used | `http://127.0.0.1:3071/v1/event` |
| Token source | `/root/buyerrecon_staging_site_token_meta.env` — loaded silently; raw token not reproduced |

Production separation: `buyerrecon_app` cannot connect to
`buyerrecon_production`; `buyerrecon_prod_collector_app` cannot
connect to `buyerrecon_staging`. These cross-environment guards
remain in force.

---

## 5. Staging schema / role readiness

Verified via read-only pre-proof check against `buyerrecon_staging`.

### 5.1 Tables present

| Table | Present |
| --- | --- |
| `public.accepted_events` | Yes |
| `public.ingest_requests` | Yes |
| `public.rejected_events` | Yes |
| `public.site_write_tokens` | Yes |

### 5.2 `accepted_events` key columns present

| Column |
| --- |
| `canonical_jsonb` |
| `client_event_id` |
| `debug_mode` |
| `event_contract_version` |
| `event_id` |
| `session_id` |
| `site_id` |
| `workspace_id` |

### 5.3 Indexes on `accepted_events`

| Index | Definition summary |
| --- | --- |
| `accepted_events_dedup` | Unique on `(workspace_id, site_id, client_event_id)` with `WHERE workspace_id IS NOT NULL AND site_id IS NOT NULL AND client_event_id IS NOT NULL` |
| `idx_accepted_dedup_client_event` | On `(site_id, session_id, client_event_id)` with `WHERE client_event_id IS NOT NULL` |

Both conflict-path indexes confirmed present in staging schema.

### 5.4 `buyerrecon_app` privileges on `accepted_events` (staging)

| Privilege | Value |
| --- | --- |
| `INSERT` (table-level) | true |
| `SELECT` (table-level) | true |
| `event_id` SELECT | true |
| `workspace_id` SELECT | true |
| `site_id` SELECT | true |
| `client_event_id` SELECT | true |
| `session_id` SELECT | true |

Note: `buyerrecon_app` in `buyerrecon_staging` holds table-level
`SELECT=true`, which is broader than the production posture after the
narrow column-level grant (`buyerrecon_prod_collector_app` has
table-level `SELECT=false`, column-level `SELECT=true` on the three
conflict-target columns). The staging proof therefore covers the write
path under a grant that is **at least as permissive as** the
production posture. It does not test the exact minimum column-level
production grant in isolation, but it confirms the persistence SQL
path itself succeeds.

### 5.5 RLS / policies / triggers

| Check | Value |
| --- | --- |
| `accepted_events.relrowsecurity` | false |
| `ingest_requests.relrowsecurity` | false |
| `rejected_events.relrowsecurity` | false |
| Policy count | 0 |
| Trigger count | 0 |

---

## 6. Request shape

The proof request was derived from the real `/v1/event` DB test
path in `tests/v1/db/route-event.dbtest.ts`, which uses
`makeValidEvent()` from `tests/v1/db/_setup.ts`.

Field names used (synthetic values only; no real customer data):

| Field |
| --- |
| `client_event_id` |
| `event_name` |
| `event_type` |
| `event_origin` |
| `schema_key` |
| `schema_version` |
| `occurred_at` |
| `session_id` |
| `anonymous_id` |
| `page_url` |
| `page_path` |
| `consent_state` |
| `consent_source` |
| `tracking_mode` |
| `storage_mechanism` |

All values were synthetic proof placeholders. The raw bearer token,
raw `request_id`, raw `session_id`, and raw `client_event_id` UUID
are not reproduced in this record.

---

## 7. Proof run evidence

| Item | Value |
| --- | --- |
| Proof identifier | Redacted — synthetic label; raw ID not reproduced |
| Proof `occurred_at` | `2026-06-02T18:06:51Z` |
| Staging POST timestamp | `2026-06-02T18:08:11Z` |
| POST target | `http://127.0.0.1:3071/v1/event` |
| HTTP status | **200** |

Redacted response category:

| Field | Value |
| --- | --- |
| `expected_event_count` | 1 |
| `accepted_count` | 1 |
| `rejected_count` | 0 |
| Result status | `accepted` |

Raw `request_id`, raw token, and raw payload values are not
reproduced.

---

## 8. DB observation after proof

| Item | Value |
| --- | --- |
| Observation timestamp | `2026-06-02T18:08:55Z` |
| Accepted proof rows | 1 |
| Rejected proof rows | 0 |
| Recent ingest categorical | `http_status=200`, `reject_reason_code=<null>`, `expected_event_count=1` |

---

## 9. Interpretation

- The staging collector accepted a valid synthetic v1 event and
  returned HTTP 200.
- The `accepted_events` persistence path wrote exactly 1 row.
- No `rejected_events` row was produced for the proof event.
- `ingest_requests` recorded a successful 200 request with no
  reject reason code.
- No `permission denied` error was observed.
- This confirms the v1 collector persistence SQL path —
  `INSERT INTO accepted_events … ON CONFLICT (workspace_id,
  site_id, client_event_id) … DO NOTHING RETURNING event_id` —
  executes successfully in a schema-equivalent environment.

**What this does not prove:**

- The staging role (`buyerrecon_app`) has broader privileges
  (table-level `SELECT=true`) than the production role after the
  narrow column-level grant. The proof covers the write path under
  ≥ the production grant, not the exact minimum.
- The proof was against `buyerrecon_staging`, not
  `buyerrecon_production`.
- This does not authorize a Gate 4C production retry.
- This does not prove production website cutover success.
- A new fresh Gate 4C execution GO PR is still required.

---

## 10. Cleanup / safety

| Item | Value |
| --- | --- |
| `RAW_TOKEN` / `STAGING_DSN` / `APP_DSN` unset | Verified |
| `/tmp/gate4c-staging-proof-event.json` removed | Verified |
| `/tmp/gate4c-staging-proof-response.json` removed | Verified |
| Production rows created | None |
| Production website traffic generated | None |
| Customer output / Lane writer / scoring / AMS Trust / Pass runtime | None activated |

---

## 11. Required next steps before any Gate 4C production retry

| Step | Status |
| --- | --- |
| 1. Conflict-target SELECT grant applied | Done (PR #87) |
| 2. Post-grant privilege snapshot | Done (PR #87 §4) |
| 3. `EXPLAIN` pre-check | Done — `EXPLAIN_PRECHECK_PASS` (PR #89) |
| 4. Staging write-path proof | **Done — `COLLECTOR_WRITE_PATH_PROOF_PASS_STAGING` (this PR)** |
| 5. Post-proof evidence merged | This PR — pending review and merge |
| 6. New fresh Gate 4C execution GO PR | **Not yet done — required** |
| 7. Single-attempt Gate 4C production retry | Not yet done — gated on 5 + 6 |

Gate 4D remains closed until a future Gate 4C execution
`GATE4C_EXECUTION_PASS` evidence PR is merged. A staging proof does
not open Gate 4D.

---

## 12. Machine-readable block

```yaml
status: GATE4C_BLOCKED_STAGING_WRITE_PROOF_PASS_GO_PENDING
pr89_status: GATE4C_BLOCKED_EXPLAIN_PRECHECK_PASS_WRITE_PROOF_PENDING
staging_proof_verdict: COLLECTOR_WRITE_PATH_PROOF_PASS_STAGING
proof_environment: staging_buyerrecon_staging
staging_service: buyerrecon-backend.service
staging_port: 3071
staging_db: buyerrecon_staging
staging_role: buyerrecon_app
proof_post_timestamp: 2026-06-02T18:08:11Z
http_status: 200
accepted_count: 1
rejected_count: 0
accepted_events_row_written: true
permission_denied_observed: false
production_rows_created: false
production_website_contacted: false
customer_output_activated: false
lane_writer_activated: false
runtime_scoring_activated: false
ams_trust_pass_activated: false
gate_4c_retry_authorised_by_this_pr: false
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_grant_applied_by_this_pr: false
production_contact_by_this_pr: false
deploy_by_this_pr: false
canary_by_this_pr: false
new_gate4c_go_pr_required: true
next_step: merge_this_evidence_pr_then_create_new_fresh_gate4c_execution_go_pr_then_single_retry
```

---

## 13. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- perform any DB write
- deploy or edit `/var/www`
- contact production or run a canary
- retry Gate 4C
- open Gate 4D / Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  raw bearer tokens, Authorization values, DSNs, IP hashes,
  user agents, or customer data
- activate customer output / Lane writers / runtime scoring /
  AMS Trust / Pass runtime

It records the staging collector write-path proof only.

`next_step: merge_this_evidence_pr_then_create_new_fresh_gate4c_execution_go_pr_then_single_retry`
