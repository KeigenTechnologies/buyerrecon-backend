# Sprint 2 PR#18an — Gate 4C Execution Evidence: HTTP 500 / Accepted Events Grant Blocker (Docs-Only)

> **DOCS-ONLY POST-EXECUTION EVIDENCE RECORD.** This PR records what
> happened during the Gate 4C combined mode+endpoint cutover attempt
> executed under the PR #83 fresh execution GO. It records the
> stop-line hit (HTTP 500 at `/v1/event`), the root-cause evidence
> (production collector app role lacks the required privilege on
> `accepted_events`), and the rollback. It performs **no** execution,
> **no** retry, **no** DB grant, **no** DB write, **no** production
> contact, **no** deploy, **no** website change, **no** canary, and
> does **not** open Gate 4D. No secrets, no raw payloads, no raw
> `request_id` / `session_id` — categorical/structural facts and
> redactions only.

---

## 1. Verdict

**`GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`**

The Gate 4C combined mode+endpoint cutover was executed in an operator
session under the PR #83 execution GO and the PR #80 runbook. The
cache-safe frontend deployment succeeded and the old invalid-json /
cache-mix failure was **not** reproduced. However, the canary browser
observed `POST https://buyerrecon.com/v1/event → HTTP 500`, which is a
stop-line because `PASS` requires HTTP 2xx and `accepted_since_canary
>= 1`. Collector logs showed `permission denied for table
accepted_events`. The operator rolled back per PR #80. Production is
back on the pre-cutover legacy `/collect` posture. The PR #83 GO is
consumed. Gate 4D remains closed.

---

## 2. GO status

| Item | Value |
| --- | --- |
| GO source | Backend PR #83 (`docs/sprint2-pr18al-gate4c-fresh-execution-go.md`, merged) — `EXECUTION_GO_RECORDED` |
| PR #83 merge commit | `cbd4c026afe41a92535baaede0eb9ea7e1ce418a` |
| Single-attempt constraint | `single_attempt_only=true` — this GO authorized exactly **one** Gate 4C retry attempt |
| GO consumed | **Yes.** The retry reached production (`POST /v1/event` was served) and therefore consumed the PR #83 GO |
| Further Gate 4C retry | Requires a **new** GO record — this GO may not be reused |
| Gate 4D | **Remains closed.** A `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK` verdict does not open Gate 4D |

---

## 3. Static frontend cutover evidence

| Item | Value |
| --- | --- |
| Website repo source | `production-live-20260508` at/after website PR #8 merge commit `e7918f6c78f1cb67b9807b21519db220a8cffa19` |
| Website PR #7 ancestor | `8fe6be4ab12e93ec39dfd08e42b1e9dd7fdb9e6d` |
| Versioned SDK path | `/thinlayer/thin-sdk.048d1d23.iife.js` |
| Versioned init path | `/thinlayer/br-thinlayer-init.69f898f8.js` |
| Served versioned SDK sha256 | `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7` |
| Served versioned init sha256 | `69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770` |
| Served init `endpointUrl` | `https://buyerrecon.com/v1/event` |
| Served init `mode` | `sprint2_v1_event` |
| Served init `/collect` present | No |
| Served init `onrender` present | No |
| Served `index.html` | Versioned SDK + versioned init; SDK-before-init order confirmed |
| Unversioned refs on sampled served page | None |

---

## 4. Pre-apply / pre-canary baseline

| Item | Value |
| --- | --- |
| Phase 2 cutover marker | `2026-06-02T14:48:02Z` |
| Live pre-apply versioned SDK pages | 0 |
| Live pre-apply versioned init pages | 0 |
| Live pre-apply legacy SDK pages | 103 |
| Live pre-apply legacy init pages | 103 |
| Legacy init sha256 | `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` |
| Legacy SDK sha256 | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` |

---

## 5. DB pre-canary baseline

| Item | Value |
| --- | --- |
| DB role | `buyerrecon_prod_audit_readonly` |
| DB | `buyerrecon_production` |
| `transaction_read_only` | `on` |
| Phase 3 baseline timestamp | `2026-06-02T15:00:00Z` |
| `rows_total` | 29 |
| Status/reason breakdown | `/v1/event \| 400 \| request_body_invalid_json \| 29` |
| `invalid_json_total` | 29 |
| `latest_row_ts_utc` | `2026-05-31 21:16:55.684+00` |
| Protected invalid-json baseline (pre-2026-05-20) | 26 |
| `accepted_events_total` | 0 |
| `rejected_events_total` | 0 |

The 26-row protected baseline is intact. The additional 3 rows (for a
total of 29) are the post-baseline invalid-json rows from prior
attempts; they predate this execution session.

---

## 6. Apply evidence

Phase 4 apply was performed using the exported website source artifact
at the website repo commit described in §3.

Post-apply local filesystem verification:

| Item | Result |
| --- | --- |
| Versioned SDK hash | Matched `048d1d23…` |
| Versioned init hash | Matched `69f898f8…` |
| Live pages → versioned SDK | 103 |
| Live pages → versioned init | 103 |
| Live pages → legacy SDK | 0 |
| Live pages → legacy init | 0 |
| Legacy rollback files | Remained present |

---

## 7. Static HTTPS verify

| Item | Value |
| --- | --- |
| Phase 5 timestamp | `2026-06-02T15:04:55Z` |
| Served SDK sha256 | `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7` ✓ |
| Served init sha256 | `69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770` ✓ |
| Served init `endpointUrl` | `https://buyerrecon.com/v1/event` ✓ |
| Served init `mode` | `sprint2_v1_event` ✓ |
| Served init `/collect` present | No ✓ |
| Served init `onrender` present | No ✓ |
| Served `index.html` | Versioned SDK + versioned init ✓ |
| Unversioned refs on served page | None ✓ |
| SDK-before-init order | Confirmed ✓ |

Static HTTPS verification: **PASS**.

---

## 8. Canary evidence

| Item | Value |
| --- | --- |
| Canary start | `2026-06-02T15:05:58Z` |
| Browser canary target | `POST https://buyerrecon.com/v1/event` |
| Browser observed HTTP status | **500** |
| Stop-line triggered | Yes — `PASS` required HTTP 2xx and `accepted_since_canary >= 1`; neither condition was met |

No raw payloads, headers, request IDs, session IDs, tokens, or
customer data are reproduced in this record.

---

## 9. Post-canary DB observation

| Item | Value |
| --- | --- |
| Canary end | `2026-06-02T15:11:15Z` |
| `accepted_since_canary` | 0 |
| `new_invalid_json_post_flip` | 0 |
| Protected invalid-json baseline (post-canary) | 26 — **intact** |
| `collect_hits_post_flip` | 0 |
| `accepted_events_total_after` | 0 |
| `rejected_events_total_after` | 0 |

**Important distinction:** This execution did **not** reproduce the
old invalid-json / cache-mix failure from PR #82. No new
`request_body_invalid_json` rows were added to
`ingest_requests_ledger` after canary start. The 500 response was
produced upstream of the `request_body_invalid_json` validation path.

---

## 10. Collector log evidence

Logs from `buyerrecon-production-collector` around canary time
contained v1 collector errors with the following categorical content:

| Field | Value |
| --- | --- |
| `kind` | `storage_failure` |
| `message` | `permission denied for table accepted_events` |
| Approximate timestamps | `2026-06-02 15:06:59 UTC`, `2026-06-02 15:07:09 UTC`, `2026-06-02 15:10:42 UTC` |

Request IDs are redacted; no raw UUIDs are reproduced here.

**Interpretation:** The cache-safe frontend path successfully reached
the v1 collector. The 500 was produced because production collector
storage failed due to a DB permission error on `accepted_events`.
This is a backend/database permission issue, not a frontend
cache-mix issue.

---

## 11. Collector app role privilege snapshot

| Item | Value |
| --- | --- |
| App DB role | `buyerrecon_prod_collector_app` |
| DB | `buyerrecon_production` |

Table privileges observed:

| Table | `SELECT` | `INSERT` | `UPDATE` |
| --- | --- | --- | --- |
| `accepted_events` | false | true | false |
| `ingest_requests` | false | true | true |
| `rejected_events` | false | true | false |

Sequence privileges observed:

| Sequence | `USAGE` | `SELECT` | `UPDATE` |
| --- | --- | --- | --- |
| `public.accepted_events_event_id_seq` | true | true | false |
| `public.rejected_events_id_seq` | true | true | false |

Service and runtime context:

| Item | Value |
| --- | --- |
| Service | `buyerrecon-production-collector.service` |
| `WorkingDirectory` | `/opt/buyerrecon-backend` |
| `ExecStart` | `/usr/bin/node /opt/buyerrecon-backend/dist/server.js` |
| `EnvironmentFile` | Exists; path and sensitive values redacted |

DSN, connection strings, and credential values are not reproduced.

---

## 12. Code inspection evidence

`src/collector/v1/persistence.ts` and
`dist/collector/v1/persistence.js` show the v1 persistence path
performs:

```sql
INSERT INTO accepted_events (...)
ON CONFLICT (workspace_id, site_id, client_event_id)
DO NOTHING
RETURNING event_id
```

The same persistence path also:
- updates `ingest_requests` with final counts
- writes `rejected_events` for rejected and reclassified rows

**Interpretation:** The production collector likely requires `SELECT`
on `accepted_events` for the `INSERT … ON CONFLICT … RETURNING event_id`
path to function correctly under the PostgreSQL role in use. The
privilege snapshot in §11 shows `SELECT=false` on `accepted_events`
for `buyerrecon_prod_collector_app`. The evidence indicates a
production DB grant mismatch — not a frontend cache-mix issue.

---

## 13. Rollback evidence

| Item | Value |
| --- | --- |
| Rollback start | `2026-06-02T15:11:44Z` |
| Restored `thin-sdk.iife.js` sha256 | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` |
| Restored `br-thinlayer-init.js` sha256 | `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` |

Post-rollback page ref counts:

| Ref type | Count |
| --- | --- |
| Versioned SDK | 0 |
| Versioned init | 0 |
| Legacy SDK | 103 |
| Legacy init | 103 |

HTTPS rollback verification:

| Check | Result |
| --- | --- |
| `sprint2_v1_event` served | No |
| `/collect` restored | Yes |
| Legacy SDK served | Yes |
| Legacy init served | Yes |
| Versioned ref served | No |

| Item | Value |
| --- | --- |
| Rollback verify timestamp | `2026-06-02T15:12:25Z` |
| `invalid_json_after_rollback` | 0 |
| Protected invalid-json baseline (post-rollback) | 26 — **intact** |

Rollback verification: **PASS**. Production is back on the
pre-cutover legacy `/collect` posture.

---

## 14. Conclusion

- Static cache-safe frontend deployment **worked.** §7 static HTTPS
  verify passed with expected hashes and correct `endpointUrl` /
  `mode`.
- Old invalid-json / cache-mix failure from PR #82 was **not**
  reproduced. No new `request_body_invalid_json` rows were observed
  after canary start.
- The new stop-line is a backend/database permission issue: the
  production collector app role (`buyerrecon_prod_collector_app`)
  lacks the privilege required for the `accepted_events` storage path
  (`SELECT=false` on `accepted_events`; the `INSERT … ON CONFLICT …
  RETURNING` path requires it).
- **Verdict: `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK`**
- Gate 4D remains closed.
- PR #83 GO is consumed.

Any future retry requires:

1. A separate grant/permission diagnostic and fix PR, or an approved
   production grant fix, addressing the `accepted_events` privilege
   gap for `buyerrecon_prod_collector_app`.
2. Evidence that the collector app role has the minimum required
   privileges for all tables in the `INSERT → accepted_events` /
   `ingest_requests` / `rejected_events` persistence path.
3. A new fresh Gate 4C execution GO PR (a PR#83-style record) — this
   GO is consumed and cannot be reused.
4. Then a new single-attempt Gate 4C retry under the new GO.

---

## 15. Machine-readable block

```yaml
status: GATE4C_EXECUTION_BLOCKED_ROLLED_BACK
execution_go_source: PR_83
pr83_merge_commit: cbd4c026afe41a92535baaede0eb9ea7e1ce418a
runbook_source: PR_80
path_alpha_acceptance_source: PR_77
cache_safe_asset_source: WEBSITE_PR_7_MERGE_8fe6be4ab12e93ec39dfd08e42b1e9dd7fdb9e6d
versioned_pair_wiring_source: WEBSITE_PR_8_MERGE_e7918f6c78f1cb67b9807b21519db220a8cffa19
versioned_sdk_path: /thinlayer/thin-sdk.048d1d23.iife.js
versioned_sdk_sha256: 048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7
versioned_init_path: /thinlayer/br-thinlayer-init.69f898f8.js
versioned_init_sha256: 69f898f8a8ab329eb30d96e90ecf2102521bb2b08faccb6fa0c3fe620fb67770
static_https_verify_result: PASS
canary_start: 2026-06-02T15:05:58Z
canary_end: 2026-06-02T15:11:15Z
browser_observed_status: 500
stop_line_triggered: http_500_not_2xx_and_accepted_since_canary_zero
cache_mix_reproduced: false
new_invalid_json_post_flip: 0
accepted_since_canary: 0
protected_invalid_json_baseline_preserved: true
protected_invalid_json_baseline_count: 26
rollback_start: 2026-06-02T15:11:44Z
rollback_verify_timestamp: 2026-06-02T15:12:25Z
rollback_executed: true
sdk_hash_post_rollback: 7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1
init_hash_post_rollback: 9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0
endpoint_post_rollback: legacy_collect
rollback_verify_result: PASS
collector_error_kind: storage_failure
collector_error_message: permission_denied_for_table_accepted_events
app_role: buyerrecon_prod_collector_app
accepted_events_select_grant: false
accepted_events_insert_grant: true
root_cause: production_collector_app_role_lacks_select_on_accepted_events
pr83_go_consumed: true
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
retry_authorised_by_this_pr: false
db_grant_applied_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
runtime_scoring_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
next_step: separate_grant_fix_pr_then_privilege_evidence_then_new_gate4c_execution_go_then_single_retry
```

---

## 16. Hard boundaries

This PR does **not**:
- execute or retry the cutover
- contact staging or production
- apply any DB grant
- perform any DB write
- deploy or edit `/var/www`
- touch the website repo
- merge or modify any website PR
- run a canary
- open Gate 4D / Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer data
- activate customer output / Lane writers / runtime scoring / AMS
  Trust / Pass runtime

It records the rolled-back Gate 4C execution attempt, the HTTP 500
stop-line, the collector permission evidence, and the rollback only.

`next_step: separate_grant_fix_pr_then_privilege_evidence_then_new_gate4c_execution_go_then_single_retry`
