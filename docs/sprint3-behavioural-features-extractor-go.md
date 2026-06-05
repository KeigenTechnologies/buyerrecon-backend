# Sprint 3 — Behavioural Features Extractor GO Planning (Docs-Only)

> **DOCS-ONLY EXTRACTOR GO PLANNING RECORD. THIS PR DOES NOT
> EXECUTE.** It plans one run of `scripts/extract-behavioural-features.ts`
> following `SESSION_FEATURES_EXTRACTION_PASS` (PR #124). The run
> happens **only** in a later, separate operator session after the
> prerequisite privilege check in §4 is resolved. This PR runs no
> commands, writes no data, contacts no production environment, does
> not run Stage 0 or any downstream worker, and does not open Gate
> 4E. No secrets, no raw payloads, no raw `request_id` / `session_id`.

---

## 1. Status

- **Status:** `BEHAVIOURAL_FEATURES_EXTRACTOR_GO_PLANNING`
- **Precondition source:** PR #124
  (`SESSION_FEATURES_EXTRACTION_PASS`, merged
  `2026-06-05T10:27:00Z`, commit
  `085cc1c140a9d835c3b1f641615aead4cc46ed9b`)

**⚠️ PERMISSION READINESS UNRESOLVED — read §4 before execution.**

Merging this PR alone does **not** authorize behavioural extractor
execution. The `consent_state` column-level SELECT privilege gap in
§4 must be resolved first, via:

1. A `consent_state` grant planning PR (separate).
2. Grant GO, operator apply, and post-grant proof PR.
3. A read-only privilege pre-check confirming all required
   `accepted_events` columns are granted.

Only after those steps may the extractor be run. **Do not run the
extractor directly after merging this PR.**

**Authorization recorded (effective only after privilege gap is
resolved per §4 above):**

- `behavioural_extractor_go_recorded=true`
- `consent_state_grant_required_before_run=true`
- `read_privilege_precheck_required_before_run=true`
- `single_run_only=true`
- `post_run_evidence_pr_required=true`

**Still false (NOT authorized by this PR):**

- `extractor_run_by_this_pr=false`
- `stage0_authorised_by_this_pr=false`
- `risk_worker_authorised_by_this_pr=false`
- `poi_worker_authorised_by_this_pr=false`
- `evidence_snapshot_authorised_by_this_pr=false`
- `lane_preview_authorised_by_this_pr=false`
- `lane_writer_authorised_by_this_pr=false`
- `scoring_runtime_authorised_by_this_pr=false`
- `customer_output_authorised_by_this_pr=false`
- `ams_trust_pass_runtime_authorised_by_this_pr=false`
- `further_grant_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_by_this_pr=false`

---

## 2. Repo-verified extractor interface

Script: `scripts/extract-behavioural-features.ts` (Sprint 2 PR#1 + PR#2)
npm alias: `npm run extract:behavioural-features` (confirmed from `package.json`)

**Source table:** `accepted_events` (direct read, same source as session_features extractor)
**Write table:** `session_behavioural_features_v0_2`
**NEVER writes:** `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features`

**env vars (confirmed from source):**

| Var | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | Production DSN — REQUIRED; never printed | — |
| `SINCE` | ISO timestamp lower bound | 168h before NOW (via `SINCE_HOURS`) |
| `UNTIL` | ISO timestamp upper bound | NOW |
| `SINCE_HOURS` | Hours to look back if `SINCE` not set | `168` |
| `FEATURE_VERSION` | Version stamp on output rows | `'behavioural-features-v0.3'` |
| `WORKSPACE_ID` | Optional filter | None |
| `SITE_ID` | Optional filter | None |

**Idempotent upsert key:** `(workspace_id, site_id, session_id, feature_version)`

**Stdout summary (auto-masked):**

```
# Behavioural-features extraction summary

- feature_version:        behavioural-features-v0.3
- workspace_id filter:    (none)
- site_id filter:         (none)
- candidate window:       <start> → <end>
- database_url:           postgresql://<user:****>@<host>/<db>
- rows upserted:          <N>
```

**Exit codes:** 0 success, 1 missing env or DB failure.

---

## 3. Accepted_events columns read by the behavioural extractor

The behavioural extractor reads `accepted_events` in two CTEs
(confirmed from source lines 283–310):

**`candidate_sessions` CTE:** `workspace_id`, `site_id`,
`session_id`, `received_at`, `event_contract_version`,
`event_origin`

**`session_events` CTE:** `event_id`, `workspace_id`, `site_id`,
`session_id`, `received_at`, `consent_state`,
`raw` (via `raw->>'event_name'`, `raw->>'page_path'`)

**Complete list of directly-read columns:**

| Column | Currently granted |
| --- | --- |
| `workspace_id` | Yes (PR #87) |
| `site_id` | Yes (PR #87) |
| `event_id` | Yes |
| `session_id` | Yes (PR #122) |
| `received_at` | Yes (PR #122) |
| `raw` | Yes (PR #122) |
| `event_contract_version` | Yes (PR #122) |
| `event_origin` | Yes (PR #122) |
| **`consent_state`** | **No — missing** |

---

## 4. Critical — `consent_state` privilege gap

**`consent_state` is NOT in the current `accepted_events` column-level
SELECT grant.** PR #122 granted `consent_source` (a different column)
but not `consent_state`.

If the extractor is run without first granting SELECT on
`consent_state`, it will fail with `permission denied for column
consent_state` (analogous to the prior `session_id` gap).

**Required before this GO is executed:**

A separate narrow column-level SELECT grant must be applied and
proofed:

```sql
-- CANDIDATE ONLY — DO NOT RUN UNTIL SEPARATE GRANT GO + CODEX PASS
GRANT SELECT (consent_state)
ON public.accepted_events
TO buyerrecon_prod_collector_app;
```

This grant must go through the same planning → GO → operator apply
→ proof-PR chain used for prior grants. It is a single-column
addition to the existing PR #122 column-level SELECT.

**This GO PR does not authorize that grant.** A separate grant
planning PR is needed first. The operator must not run the
behavioural extractor until:

1. The `consent_state` column-level SELECT grant is planned,
   reviewed, applied, and proofed.
2. This planning PR has been reviewed and merged.

---

## 4a. Required sequence before extractor execution

The correct next steps after this planning PR merges are:

1. **`consent_state` grant planning PR** — plan and review the
   narrow `GRANT SELECT (consent_state) ON accepted_events TO
   buyerrecon_prod_collector_app` following the same process as
   PR #120–#122.
2. **Grant GO + operator apply + post-grant proof PR** — same
   pattern as prior grants.
3. **Behavioural extractor `accepted_events` read-privilege
   pre-check** — a read-only diagnostic session (analogous to
   PR #118–#119) confirming `consent_state SELECT = true` and
   all other required columns confirmed, before attempting the
   run. This pre-check should be authorized by its own GO PR.
4. **Only then** — run the behavioural extractor under this GO.

**Skipping the pre-check and running the extractor directly is a
stop-line** (see §8).

---

## 5. Authorized run configuration (after §4 and §4a are resolved)

```
SINCE=2026-06-02T21:14:34.000Z
FEATURE_VERSION=behavioural-features-v0.3
DATABASE_URL=(loaded from .env.production; never printed)
WORKSPACE_ID=(omit)
SITE_ID=(omit)
```

---

## 6. Execution safety posture

### 6.1 Setup

```bash
cd /opt/buyerrecon-backend || exit 1

export APP_DSN="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)"
[ -n "$APP_DSN" ] && echo "APP_DSN loaded" || { echo "ERROR: APP_DSN not loaded — stop"; exit 1; }

DATABASE_URL="$APP_DSN" node -e "
const u = new URL(process.env.DATABASE_URL);
console.log('db_name:', u.pathname.replace(/^\//, ''));
"
```

Expected: `db_name: buyerrecon_production`. If not — **stop.**

### 6.2 Run extractor (one run; preserve exit code)

```bash
set -o pipefail

SINCE='2026-06-02T21:14:34.000Z' \
FEATURE_VERSION='behavioural-features-v0.3' \
npm run extract:behavioural-features 2>&1 | \
  tee /tmp/behavioural-features-extractor-run.log

EXTRACTOR_EXIT=${PIPESTATUS[0]}
echo "extractor_exit_code: $EXTRACTOR_EXIT"
```

**⛔ STOP if `extractor_exit_code` is not `0`.**

### 6.3 Silent raw-identifier scan

```bash
grep -qiE '(request_id|session_id|canonical_jsonb|ip_hash|user_agent)' \
  /tmp/behavioural-features-extractor-run.log \
  && echo "RAW_IDENTIFIER_SCAN_BLOCKED — stop, do not use log in evidence" \
  || echo "RAW_IDENTIFIER_SCAN_CLEAN"
```

**⛔ STOP if output is `RAW_IDENTIFIER_SCAN_BLOCKED`.**

---

## 7. Post-run evidence plan

After the run, a separate docs-only evidence PR must record:

| Evidence item | Format |
| --- | --- |
| Extractor exit code | Integer (`0` = success) |
| Feature version | `behavioural-features-v0.3` |
| Candidate window start | `2026-06-02T21:14:34.000Z` |
| Masked database URL | From extractor stdout |
| Rows upserted | From extractor stdout |
| Raw identifier scan | `CLEAN` or `BLOCKED` |
| `session_behavioural_features_v0_2` count | Via audit-safe query |
| Audit table-level SELECT / `session_id` SELECT remain denied | Confirmed |
| Lane A/B counts | `0/0` |
| No Stage 0 activated | Confirmed |
| No downstream worker / customer output / Lane / scoring / AMS Trust-Pass | Confirmed |
| Gate 4E / Gate 4F | Not opened / not invented |
| Final verdict | `BEHAVIOURAL_FEATURES_EXTRACTION_PASS` or `FAILED` |

---

## 8. Stop-lines

| Stop-line | Action |
| --- | --- |
| `consent_state` SELECT grant not yet applied and proofed | Stop — do not run |
| Read-privilege pre-check (§4a step 3) not yet completed | Stop — do not run |
| `db_name` is not `buyerrecon_production` | Stop |
| `DATABASE_URL` missing or empty | Stop |
| DSN printed | Stop |
| Extractor exit code non-zero | Stop |
| `RAW_IDENTIFIER_SCAN_BLOCKED` | Stop |
| Extractor writes outside `session_behavioural_features_v0_2` | Stop |
| Stage 0 or any downstream worker command appears | Stop |
| Customer output / Lane write / scoring runtime / AMS Trust-Pass activation | Stop |
| Gate 4E opening, readiness, or auto-advance language | Stop |
| Gate 4F language | Stop |

---

## 9. Machine-readable block

```yaml
status: BEHAVIOURAL_FEATURES_EXTRACTOR_GO_PLANNING
precondition_source: PR_124_SESSION_FEATURES_EXTRACTION_PASS
pr124_merge_commit: 085cc1c140a9d835c3b1f641615aead4cc46ed9b
script: scripts/extract-behavioural-features.ts
npm_alias: npm run extract:behavioural-features
reads: accepted_events
writes: session_behavioural_features_v0_2
approved_since: "2026-06-02T21:14:34.000Z"
approved_feature_version: behavioural-features-v0.3
critical_gap: consent_state_column_select_not_yet_granted
consent_state_grant_required_before_run: true
behavioural_extractor_go_recorded: true
extractor_run_by_this_pr: false
extractor_before_gap_resolved_authorised: false
single_run_only: true
post_run_evidence_pr_required: true
stage0_authorised_by_this_pr: false
risk_worker_authorised_by_this_pr: false
poi_worker_authorised_by_this_pr: false
evidence_snapshot_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
further_grant_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_by_this_pr: false
lane_preview_in_scope: false
next_step: consent_state_grant_planning_pr_then_grant_go_proof_then_precheck_diagnostic_go_then_run_extractor
```

---

## 10. Hard boundaries

This PR does **not**:
- run the behavioural extractor or any other worker
- apply any DB grant
- contact production or perform DB writes
- deploy
- open Gate 4E
- invent Gate 4F
- activate Stage 0, risk worker, POI worker, evidence snapshot,
  Lane preview, Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- change backend code, packages, migrations, or schema
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the behavioural features extractor GO planning — with
the explicit prerequisite that the `consent_state` column-level
SELECT grant must be separately planned, applied, and proofed
before the extractor is run.

`next_step: consent_state_grant_planning_pr_then_grant_go_proof_then_precheck_diagnostic_go_then_run_extractor`
