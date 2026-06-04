# Sprint 3 — Session Feature Extractor Rerun Failure Evidence (Docs-Only)

> **DOCS-ONLY FAILURE EVIDENCE RECORD.** This PR records the result
> of the single authorized session_features extractor rerun under
> PR #115. The rerun failed with `permission denied for table
> accepted_events`. It does not apply any grant, does not rerun the
> extractor, does not activate any worker, and does not open Gate 4E.
> No secrets, no raw payloads, no raw `request_id` / `session_id`.

---

## 1. Verdict

**`SESSION_FEATURES_EXTRACTOR_RERUN_FAILED_PERMISSION_DENIED_ACCEPTED_EVENTS`**

The extractor failed to read from `public.accepted_events`, which is
its source table. The prior `session_features` grant fix (PR #114)
resolved the prior blocker on `session_features` write access, but
the rerun revealed a further missing privilege: the app role lacks
`SELECT` on `public.accepted_events`.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #115 | Merged — `SESSION_FEATURES_EXTRACTOR_RERUN_GO_PLANNING` |
| PR #115 merge commit | `29d1b28833c6af539caa22beffb681c017099865` |
| PR #114 | Merged — `SESSION_FEATURES_GRANT_FIX_PROOF_PASS` — session_features grants remain in place |
| `session_features` rows | Unknown — extractor failed before completing any write |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |

---

## 3. Rerun command summary (no secrets)

| Item | Value |
| --- | --- |
| Script | `scripts/extract-session-features.ts` |
| npm alias | `npm run extract:session-features` |
| `SINCE` | `2026-06-02T21:14:34.000Z` |
| `EXTRACTION_VERSION` | `session-features-v0.1` |
| `DATABASE_URL` | Loaded from `.env.production`; never printed |
| `WORKSPACE_ID` | None (omitted) |
| `SITE_ID` | None (omitted) |

---

## 4. Extractor rerun output

```
> buyerrecon-backend@1.0.0 extract:session-features
> tsx scripts/extract-session-features.ts

PR#11 session-features extractor — extraction failed: permission denied for table accepted_events
extractor_exit_code: 1
```

---

## 5. Exit code and scan

| Item | Value |
| --- | --- |
| Exit code | `1` — failure |
| Failure message | `permission denied for table accepted_events` |
| Raw identifier scan | `RAW_IDENTIFIER_SCAN_CLEAN` |

No raw `request_id`, `session_id`, `canonical_jsonb`, `ip_hash`, or
user agent appeared in the extractor stdout / stderr.

---

## 6. Interpretation

The extractor (`scripts/extract-session-features.ts`) reads from
`public.accepted_events` as its source table — specifically, it
selects accepted events to group into session records. This requires
the app role (`buyerrecon_prod_collector_app`) to have `SELECT` on
`public.accepted_events`.

The prior Gate 4C fix (PR #84–#87) granted column-level `SELECT`
on `(workspace_id, site_id, client_event_id)` to
`buyerrecon_prod_collector_app` on `accepted_events` — sufficient
for the v1 event collector's `ON CONFLICT` path. However, the
session feature extractor reads a broader set of columns from
`accepted_events` (event shape, timestamps, URL paths, schema
keys, etc.) and likely requires table-level `SELECT` or a wider
column-level `SELECT` than was granted for the collector path.

**The session_features grant fix (PR #114) is still correct and
in place.** The new blocker is on the source table `accepted_events`,
not on `session_features`.

---

## 7. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| Extractor rerun after this failure | Not attempted |
| Manual GRANT after failure | Not executed |
| Schema change | None |
| Deploy | None |
| Downstream worker run | Not run |
| Customer output | None |
| Lane write | None |
| Scoring runtime | None |
| AMS Trust / Pass runtime | None |
| Gate 4E opened | No |
| Gate 4F invented | No |
| Raw `request_id` / `session_id` / IP hash / user agent / payload printed | No |
| DSN or secret printed | No |

---

## 8. Next step

The extractor must **not** be rerun until the `accepted_events` read
privilege gap is diagnosed and fixed. The required sequence:

1. Separate `accepted_events` read-privilege diagnostic/planning PR —
   characterize exactly which `SELECT` columns the extractor needs
   on `accepted_events` (confirm from extractor SQL source), and
   determine what gap exists given the existing column-level grants
   from the Gate 4C fix.
2. Grant-fix PR for `accepted_events` read access on the extractor
   path — reviewed before any privilege is applied.
3. Post-grant proof PR.
4. New extractor rerun GO PR.
5. New single-attempt extractor run under the new GO.

**The PR #115 single-attempt GO is consumed by this run attempt.**
A new GO is required.

---

## 9. Machine-readable block

```yaml
status: SESSION_FEATURES_EXTRACTOR_RERUN_FAILED_PERMISSION_DENIED_ACCEPTED_EVENTS
go_source: PR_115_SESSION_FEATURES_EXTRACTOR_RERUN_GO_PLANNING
pr115_merge_commit: 29d1b28833c6af539caa22beffb681c017099865
pr114_grant_fix: SESSION_FEATURES_GRANT_FIX_PROOF_PASS_still_in_place
script: scripts/extract-session-features.ts
extractor_exit_code: 1
failure_message: permission denied for table accepted_events
raw_identifier_scan: CLEAN
session_features_write_confirmed: false
pr115_go_consumed: true
grant_applied_by_this_pr: false
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: accepted_events_read_privilege_diagnostic_planning_pr_then_fix_then_proof_then_new_extractor_go
```

---

## 10. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- rerun the extractor or any other worker
- contact production or perform DB writes
- change backend code, packages, migrations, or schema
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the extractor rerun failure evidence only.

`next_step: accepted_events_read_privilege_diagnostic_planning_pr_then_fix_then_proof_then_new_extractor_go`
