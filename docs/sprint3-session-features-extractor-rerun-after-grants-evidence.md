# Sprint 3 — Session Features Extractor Rerun After Grants Evidence (Docs-Only)

> **DOCS-ONLY POST-EXTRACTOR EVIDENCE RECORD.** This PR records the
> successful session_features extractor rerun under the PR #123 GO,
> following both privilege fix proofs (PR #114 for `session_features`
> write path; PR #122 for `accepted_events` read path). It does not
> activate any downstream worker, does not write to DB, does not
> contact production beyond the already-completed operator session
> described below, and does not open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id`.

---

## 1. Verdict

**`SESSION_FEATURES_EXTRACTION_PASS`**

The session_features extractor ran successfully, exiting `0`, and
upserted 1 `session_features` row for `extraction_version =
session-features-v0.1`. Both prior privilege blockers have been
resolved and this run confirms the privilege chain is correct
end-to-end.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #114 | Merged — `SESSION_FEATURES_GRANT_FIX_PROOF_PASS` |
| PR #122 | Merged — `ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_PROOF_PASS` |
| PR #123 | Merged — `SESSION_FEATURES_EXTRACTOR_RERUN_AFTER_GRANTS_GO_PLANNING` |
| PR #123 merge commit | `e0474f9c2dd96429281b6788ced6ec204e452afd` |
| `session_features` rows | **1** — extractor wrote successfully |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |

---

## 3. Extractor rerun summary

| Item | Value |
| --- | --- |
| Script | `scripts/extract-session-features.ts` |
| npm alias | `npm run extract:session-features` |
| `SINCE` | `2026-06-02T21:14:34.000Z` |
| `EXTRACTION_VERSION` | `session-features-v0.1` |
| `DATABASE_URL` | Loaded from `.env.production`; never printed |
| Log file | `/tmp/session-features-extractor-rerun-after-grants.log` |

---

## 4. Extractor output

```
# Session-features extraction summary

- extraction_version: session-features-v0.1
- workspace_id filter: (none)
- site_id filter:      (none)
- candidate window:    2026-06-02T21:14:34.000Z → 2026-06-05T10:00:44.506Z
- database_url:        postgresql://<user:****>@127.0.0.1:5432/<db>
- rows upserted:       1

extractor_exit_code: 0
```

---

## 5. Exit code and scan

| Item | Value |
| --- | --- |
| Exit code | `0` — success |
| `database_url` in output | Masked by `maskUrl()` — no real DSN printed |
| Raw identifier scan | `RAW_IDENTIFIER_SCAN_CLEAN` |

---

## 6. Post-run audit-safe evidence

All queries ran inside `BEGIN READ ONLY ... ROLLBACK` using the
audit role. No row-level `session_features` data was queried.

```
AUDIT_DSN loaded
BEGIN
E1_AUDIT_READONLY|buyerrecon_prod_audit_readonly|buyerrecon_production|on|2026-06-05 10:02:42.487158
E2_SESSION_FEATURES_BY_VERSION|session-features-v0.1|1
E3_AUDIT_DENIALS|f|f
E4_LANE_COUNTS|0|0
ROLLBACK
```

### 6.1 Summary

| Check | Label | Value |
| --- | --- | --- |
| Audit role / DB / `txn_read_only` / timestamp (E1) | `E1_AUDIT_READONLY` | `buyerrecon_prod_audit_readonly \| buyerrecon_production \| on \| 2026-06-05 10:02:42.487158 UTC` |
| `session_features` by `extraction_version` (E2) | `E2_SESSION_FEATURES_BY_VERSION` | `session-features-v0.1 \| 1` ✓ |
| Audit table-level SELECT / `session_id` SELECT (E3) | `E3_AUDIT_DENIALS` | `f \| f` ✓ — both remain denied |
| Lane A / Lane B row counts (E4) | `E4_LANE_COUNTS` | `0 \| 0` ✓ |

---

## 7. Interpretation

- The extractor successfully read from `accepted_events` (using the
  8 column-level SELECT grants from PR #122) and wrote 1 row to
  `session_features` (using the INSERT/UPDATE/SELECT grants from
  PR #114).
- The candidate window (`2026-06-02T21:14:34.000Z →
  2026-06-05T10:00:44.506Z`) covered the 9 Gate 4C canary events.
  The extractor groups by `(workspace_id, site_id, session_id,
  extraction_version)` — the 9 events belong to fewer distinct
  session triples, producing 1 `session_features` row.
- Audit table-level SELECT and `session_id` SELECT remain denied —
  column-level protections are intact.
- Lane A/B writer remained inactive.

---

## 8. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| Extractor rerun after this run | Not attempted |
| Downstream worker run | Not run |
| Additional GRANT | None |
| Schema / migration change | None |
| Deploy | None |
| Customer output | None |
| Lane write | None |
| Scoring runtime | None |
| AMS Trust / Pass runtime | None |
| Gate 4E opened | No |
| Gate 4F invented | No |
| Raw `request_id` / `session_id` / IP hash / payload printed | No |
| DSN or secret printed | No |

---

## 9. Next step

`SESSION_FEATURES_EXTRACTION_PASS` confirms the extractor can run
end-to-end against production with both privilege fixes in place.

**Downstream worker GOs remain separately gated.** No downstream
worker is authorized by this evidence PR. The activation sequence
per PR #102 (Sprint 3 worker sequencing planning) applies:

1. `session_features` extractor — **done**
2. `behavioural_features` extractor — requires separate GO
3. Stage 0 worker — requires separate GO (depends on step 1)
4. Risk evidence worker — requires separate GO (depends on steps 2 + 3)
5. POI workers — requires separate GO (depends on step 3)
6. Evidence snapshot — requires separate GO (depends on step 1 + 2)

---

## 10. Machine-readable block

```yaml
status: SESSION_FEATURES_EXTRACTION_PASS
go_source: PR_123_SESSION_FEATURES_EXTRACTOR_RERUN_AFTER_GRANTS_GO_PLANNING
pr123_merge_commit: e0474f9c2dd96429281b6788ced6ec204e452afd
extractor_exit_code: 0
extraction_version: session-features-v0.1
candidate_window_start: "2026-06-02T21:14:34.000Z"
candidate_window_end: "2026-06-05T10:00:44.506Z"
rows_upserted: 1
database_url_masked: true
raw_identifier_scan: CLEAN
session_features_v01_row_count: 1
audit_tbl_select: false
audit_session_id_select: false
lane_a_count: 0
lane_b_count: 0
extractor_rerun_by_this_pr: false
downstream_worker_activated: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: downstream_worker_gos_per_pr102_sequence_each_separately_gated
```

---

## 11. Hard boundaries

This PR does **not**:
- rerun the extractor or any downstream worker
- contact production or perform DB writes
- apply any further DB grant
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- change backend code, packages, migrations, or schema
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the session_features extractor rerun evidence only.

`next_step: downstream_worker_gos_per_pr102_sequence_each_separately_gated`
