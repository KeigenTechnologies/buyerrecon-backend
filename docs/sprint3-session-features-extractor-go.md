# Sprint 3 — Session Feature Extractor GO Planning (Docs-Only)

> **DOCS-ONLY EXTRACTOR GO PLANNING RECORD. THIS PR DOES NOT
> EXECUTE.** It plans the first run of `scripts/extract-session-features.ts`
> against production following `FILTER_PRECHECK_PASS` (PR #106).
> The extractor run happens **only** in a later, separate operator
> session after this PR merges. This PR runs no commands, does not
> write to DB, does not contact production, does not activate
> customer output, and does not open Gate 4E. No secrets, no raw
> payloads, no raw `request_id` / `session_id`.

---

## 1. Status

- **Status:** `SPRINT3_SESSION_FEATURES_EXTRACTOR_GO_PLANNING`
- **Precondition source:** PR #106
  (`docs/sprint3-accepted-events-filter-precheck-evidence.md`,
  merged `2026-06-04T11:36:30Z`, commit
  `9ba445c46328e8e2dce251acdf103ffa4668cc0f`)
- **Precondition verdict:** `FILTER_PRECHECK_PASS` —
  `filter_matched_count = 9` (all 9 accepted_events in window match
  all six extractor gating filters)

**Authorization granted by this PR (after merge only):**

- `session_features_extractor_go_recorded=true`
- `single_run_only=true`
- `post_run_evidence_pr_required=true`

**Still false (NOT authorized by this PR):**

- `extractor_run_by_this_pr=false`
- `behavioural_extractor_authorised_by_this_pr=false`
- `stage0_authorised_by_this_pr=false`
- `risk_worker_authorised_by_this_pr=false`
- `poi_worker_authorised_by_this_pr=false`
- `evidence_snapshot_authorised_by_this_pr=false`
- `lane_preview_authorised_by_this_pr=false`
- `lane_writer_authorised_by_this_pr=false`
- `scoring_runtime_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `ams_trust_pass_runtime_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_by_this_pr=false`
- `extractor_before_this_pr_merges_authorised=false`

---

## 2. Preconditions (all must be confirmed before run)

| Precondition | Source |
| --- | --- |
| `FILTER_PRECHECK_PASS` recorded | PR #106, merged |
| `filter_matched_count = 9` in bounded window | PR #106 §6 |
| No previous `session_features` extractor run | `session_features` row count = 0 (confirmed in PR #101 Gate 4D observation) |
| `accepted_events` in production confirmed | Gate 4C PASS (PR #92); Gate 4D PASS (PR #101) |
| PR #106 merge commit on base | `9ba445c46328e8e2dce251acdf103ffa4668cc0f` |
| `DATABASE_URL` bound to `buyerrecon_production` | Must be confirmed from `.env.production` without printing DSN |
| No Gate 4E, Gate 4F | Confirmed closed / not invented |

---

## 3. Repo-verified extractor interface

Script: `scripts/extract-session-features.ts` (Sprint 1 PR#11)
npm alias: `npm run extract:session-features`

**Required env var:**

| Var | Value |
| --- | --- |
| `DATABASE_URL` | Production DSN — reads from `.env.production`; **REQUIRED; never printed** |

**Optional env vars** (confirmed from source):

| Var | Purpose | Default |
| --- | --- | --- |
| `SINCE` | ISO timestamp lower bound for candidate session window | 168h before NOW (via `SINCE_HOURS`) |
| `UNTIL` | ISO timestamp upper bound | NOW at run time |
| `SINCE_HOURS` | Hours to look back if `SINCE` not set | `168` (7 days) |
| `WORKSPACE_ID` | Optional workspace filter | None (all workspaces) |
| `SITE_ID` | Optional site filter | None (all sites) |
| `EXTRACTION_VERSION` | Version stamp on `session_features` rows | `'session-features-v0.1'` |

**Approved run configuration for this GO:**

```
SINCE=2026-06-02T21:14:34Z
UNTIL=(omit — defaults to NOW at run time)
WORKSPACE_ID=(omit — no filter)
SITE_ID=(omit — no filter)
EXTRACTION_VERSION=session-features-v0.1
DATABASE_URL=(loaded from .env.production; never printed)
```

**Why `SINCE=2026-06-02T21:14:34Z`:** This matches the Gate 4C PASS
/ canary start timestamp used in the PR #106 pre-check, ensuring the
candidate session window covers the 9 known matching events.

---

## 4. Critical behavior — candidate window vs full-session aggregation

**Important:** `SINCE` bounds the *candidate session selection*, not
the full aggregation. From the source (lines 9–15):

> The window selects CANDIDATE SESSIONS — sessions with at least one
> accepted_event whose `received_at` falls in the window. Then
> aggregation runs over ALL `accepted_events` for those candidate
> sessions, regardless of `received_at`.

This means: if a session had events both before and after
`2026-06-02 21:14:34+00`, *all* of that session's events
are aggregated into the `session_features` row — not just those in
the window. For the 9 canary events, this is expected behaviour.

---

## 5. Read / write tables

| Operation | Table |
| --- | --- |
| Reads | `public.accepted_events` |
| Writes / upserts | `public.session_features` |
| NEVER writes | `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens` |
| NEVER reads | `token_hash`, peppers, auth secrets |

Idempotent upsert key: `(workspace_id, site_id, session_id, extraction_version)`

---

## 6. Expected output (stdout, auto-masked)

The extractor prints a summary to stdout. The `database_url` field
is automatically masked by `maskUrl()` to `<user:****>@<host>/<db>`:

```
# Session-features extraction summary

- extraction_version: session-features-v0.1
- workspace_id filter: (none)
- site_id filter:      (none)
- candidate window:    2026-06-02T21:14:34.000Z → <NOW at run time>
- database_url:        <user:****>@<host>/<db>
- rows upserted:       <N>
```

`rows upserted` will be the actual number of `session_features`
upsert operations. Because there are 9 matching
`accepted_events` rows belonging to potentially fewer distinct
`(workspace_id, site_id, session_id)` triples, `rows upserted`
may be less than 9. The exact count depends on session grouping
and must be recorded in the post-run evidence PR — do not pre-claim
a specific number.

---

## 7. Execution safety

| Requirement | Detail |
| --- | --- |
| `DATABASE_URL` | Load from `.env.production`; never print |
| `maskUrl()` | Built into the extractor; `database_url` in output is always masked |
| Log scan | Before preserving any extractor stdout/stderr as evidence, scan for raw `request_id`, `session_id`, IP hashes, user agents, or customer data — if found, do not include in evidence PR |
| No downstream activation | Extractor exit (success or failure) must not trigger any downstream worker run |
| Exit code | 0 on success; 1 on missing env or DB failure |

**Explicitly forbidden outputs** — must not be printed or included
in the evidence PR:

`request_id` · `session_id` · `raw` · `canonical_jsonb` · `ip_hash` ·
`user_agent` · raw UUIDs · tokens · full DSN · Authorization values ·
customer-identifying data

---

## 8. Stop-lines

Halt and do not proceed with post-run evidence if:

| Stop-line | Action |
| --- | --- |
| Wrong database / wrong role in masked output | Stop |
| `DATABASE_URL` missing or empty | Stop — exit code 1 expected |
| Extractor writes to any table other than `session_features` | Stop |
| Extractor stdout / stderr contains raw `request_id`, `session_id`, IP hash, user agent, or payload | Stop — do not include in evidence; diagnose separately |
| Any Lane A/B row count becomes non-zero | Stop |
| Any scoring runtime, customer output, or AMS Trust / Pass activates | Stop |
| Gate 4E opening, readiness, or automatic-advance language appears | Stop |
| Gate 4F language appears | Stop |
| Any downstream worker runs automatically | Stop |

---

## 9. Post-run evidence requirements

After the extractor run, a separate docs-only evidence PR must record:

| Evidence item | Format |
| --- | --- |
| Extractor command summary | Categorical (extraction_version, window, masked DB URL, rows upserted) — no raw DSN, no secrets |
| `session_features` row count after run | Integer count (read-only query) |
| Source `accepted_events` bounded count | Integer (same window; carry forward from PR #106: 9) |
| Extractor exit code | `0` (success) or `1` (failure) |
| No raw identifiers in extractor output | Confirmed |
| No downstream worker activated | Confirmed |
| Lane A/B row counts | `0 / 0` if checked (must remain zero) |
| No customer output / scoring / AMS Trust / Pass activated | Confirmed |
| Final verdict | `SESSION_FEATURES_EXTRACTION_PASS` or `SESSION_FEATURES_EXTRACTION_FAILED` |

---

## 10. Governance locks carry-forward

| Lock | State |
| --- | --- |
| `customer_claim_allowed` | false |
| `lane_output_allowed` | false |
| `customer_visibility_allowed` | false |
| `lane_write_allowed` | false |
| `allowed_customer_language` | `[]` |
| `SAFE_CLAIMS_DICTIONARY` | `Object.freeze({})` — empty |
| `DEFAULT_EXTERNAL_OUTPUT_FLAGS` | All `false` |
| PR#18ab locks | In force |
| Lane A/B row counts | Must remain `0/0` |
| Migration 016 grant safety | In force |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |
| Gate 4E | Closed |
| Gate 4F | Not invented |

---

## 11. Machine-readable block

```yaml
status: SPRINT3_SESSION_FEATURES_EXTRACTOR_GO_PLANNING
precheck_pass_source: PR_106_FILTER_PRECHECK_PASS
precheck_filter_matched_count: 9
pr106_merge_commit: 9ba445c46328e8e2dce251acdf103ffa4668cc0f
script: scripts/extract-session-features.ts
npm_alias: npm run extract:session-features
reads: accepted_events
writes: session_features
approved_since: "2026-06-02T21:14:34Z"
approved_until: NOW_at_run_time
approved_extraction_version: session-features-v0.1
workspace_id_filter: none
site_id_filter: none
database_url_source: .env.production
database_url_never_printed: true
maskUrl_applied: true
session_features_extractor_go_recorded: true
extractor_run_by_this_pr: false
extractor_before_this_pr_merges_authorised: false
single_run_only: true
post_run_evidence_pr_required: true
behavioural_extractor_authorised_by_this_pr: false
stage0_authorised_by_this_pr: false
risk_worker_authorised_by_this_pr: false
poi_worker_authorised_by_this_pr: false
evidence_snapshot_authorised_by_this_pr: false
lane_preview_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_by_this_pr: false
lane_preview_in_scope: false
next_step: operator_run_extractor_per_section_3_then_open_post_run_evidence_pr
```

---

## 12. Hard boundaries

This PR does **not**:
- run the session feature extractor or any other worker
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

It records the session feature extractor GO planning only.

`next_step: operator_run_extractor_per_section_3_then_open_post_run_evidence_pr`
