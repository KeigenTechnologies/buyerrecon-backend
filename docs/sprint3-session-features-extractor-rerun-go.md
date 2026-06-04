# Sprint 3 — Session Feature Extractor Rerun GO Planning (Docs-Only)

> **DOCS-ONLY RERUN GO PLANNING RECORD. THIS PR DOES NOT EXECUTE.**
> It plans exactly one rerun of `scripts/extract-session-features.ts`
> following the grant fix proof in PR #114. The rerun happens **only**
> in a later, separate operator session after this PR merges. This PR
> runs no commands, writes no data, contacts no production environment,
> does not run any downstream worker, and does not open Gate 4E. No
> secrets, no raw payloads, no raw `request_id` / `session_id`.

---

## 1. Status

- **Status:** `SESSION_FEATURES_EXTRACTOR_RERUN_GO_PLANNING`
- **Grant fix proof source:** PR #114
  (`SESSION_FEATURES_GRANT_FIX_PROOF_PASS`, merged
  `2026-06-04T17:20:48Z`, commit
  `da34f9ff13827536c9a360bec008e290995de956`)
- **Prior failed run:** PR #108
  (`SESSION_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED`) — fixed
  by grant chain PR #109–#114

**Authorization granted by this PR (after merge only):**

- `extractor_rerun_go_recorded=true`
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
- `ams_trust_pass_authorised_by_this_pr=false`
- `further_grant_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_by_this_pr=false`
- `extractor_before_this_pr_merges_authorised=false`

---

## 2. Current privilege state (confirmed by PR #114)

| Privilege | Value |
| --- | --- |
| `buyerrecon_prod_collector_app` SELECT on `session_features` | true |
| `buyerrecon_prod_collector_app` INSERT on `session_features` | true |
| `buyerrecon_prod_collector_app` UPDATE on `session_features` | true |
| `buyerrecon_prod_collector_app` USAGE on `session_features_session_features_id_seq` | true |
| `buyerrecon_prod_collector_app` SELECT on sequence | false (intentional) |
| `buyerrecon_prod_audit_readonly` column SELECT on `session_features_id` | true |
| `buyerrecon_prod_audit_readonly` column SELECT on `extraction_version` | true |
| `buyerrecon_prod_audit_readonly` SELECT on `session_id` | false (intentional) |
| `buyerrecon_prod_audit_readonly` table-level SELECT | false (intentional) |

---

## 3. Authorized rerun command

Script: `scripts/extract-session-features.ts` (Sprint 1 PR#11)
npm alias: `npm run extract:session-features` (confirmed from `package.json`)

**Authorized run configuration (after merge; one run only):**

```
SINCE=2026-06-02T21:14:34.000Z
EXTRACTION_VERSION=session-features-v0.1
DATABASE_URL=(loaded from .env.production; never printed)
WORKSPACE_ID=(omit — no filter)
SITE_ID=(omit — no filter)
```

---

## 4. Required execution safety posture

### 4.1 Setup

```bash
cd /opt/buyerrecon-backend || exit 1

# Load production app DSN silently
export APP_DSN="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)"
[ -n "$APP_DSN" ] && echo "APP_DSN loaded" || { echo "ERROR: APP_DSN not loaded — stop"; exit 1; }

# Confirm DB name only — do not print DSN
DATABASE_URL="$APP_DSN" node -e "
const u = new URL(process.env.DATABASE_URL);
console.log('db_name:', u.pathname.replace(/^\//, ''));
"
```

Expected: `db_name: buyerrecon_production`. If not — **stop.**

### 4.2 Run extractor (one run; preserve exit code)

```bash
set -o pipefail

SINCE='2026-06-02T21:14:34.000Z' \
EXTRACTION_VERSION='session-features-v0.1' \
npm run extract:session-features 2>&1 | tee /tmp/session-features-extractor-rerun.log

EXTRACTOR_EXIT=${PIPESTATUS[0]}
echo "extractor_exit_code: $EXTRACTOR_EXIT"
```

**⛔ STOP if `extractor_exit_code` is not `0`.**

### 4.3 Silent raw-identifier scan

```bash
grep -qiE '(request_id|session_id|canonical_jsonb|ip_hash|user_agent)' \
  /tmp/session-features-extractor-rerun.log \
  && echo "RAW_IDENTIFIER_SCAN_BLOCKED — stop, do not use log in evidence" \
  || echo "RAW_IDENTIFIER_SCAN_CLEAN"
```

**⛔ STOP if output is `RAW_IDENTIFIER_SCAN_BLOCKED`.**

---

## 5. Post-run read-only evidence counts

Use `BEGIN READ ONLY ... ROLLBACK` (carry-forward from PR #106 —
PGOPTIONS `transaction_read_only=on` did not take effect in that
session).

```bash
# Load audit DSN
set -a
. /root/buyerrecon-production-db.env
set +a
export AUDIT_DSN="$PRODUCTION_DATABASE_URL"
unset PRODUCTION_DATABASE_URL
[ -n "$AUDIT_DSN" ] && echo "AUDIT_DSN loaded" || { echo "ERROR: AUDIT_DSN not loaded — stop"; exit 1; }

psql --no-password --tuples-only --no-align -d "$AUDIT_DSN" <<'SQL'
BEGIN READ ONLY;

-- E1: Confirm audit role and read-only mode
SELECT current_user, current_database(),
       current_setting('transaction_read_only') AS txn_read_only,
       now() AT TIME ZONE 'UTC' AS ts_utc;

-- E2: session_features count by extraction_version
-- Using only granted columns (session_features_id, extraction_version)
SELECT extraction_version,
       COUNT(session_features_id) AS row_count
FROM public.session_features
GROUP BY extraction_version
ORDER BY row_count DESC;

-- E3: Confirm audit table-level SELECT and raw session_id remain denied
SELECT
  has_table_privilege('buyerrecon_prod_audit_readonly',
                      'public.session_features', 'SELECT') AS tbl_select,
  has_column_privilege('buyerrecon_prod_audit_readonly',
                       'public.session_features', 'session_id', 'SELECT') AS session_id_select;

-- E4: Lane A/B row counts (must remain 0/0)
SELECT
  (SELECT COUNT(*) FROM public.scoring_output_lane_a) AS lane_a_count,
  (SELECT COUNT(*) FROM public.scoring_output_lane_b) AS lane_b_count;

ROLLBACK;
SQL
```

**Note on E2:** `COUNT(session_features_id)` uses only the granted
column rather than `COUNT(*)`. `GROUP BY extraction_version` uses the
second granted column. No `session_id`, URL fields, or JSONB content
is read.

---

## 6. Required post-run evidence PR

A separate docs-only evidence PR must record (no secrets, no raw
identifiers):

| Evidence item | Format |
| --- | --- |
| Extractor exit code | Integer (`0` = success) |
| Extraction version | `session-features-v0.1` |
| Candidate window start | `2026-06-02T21:14:34.000Z` |
| Masked database URL | Value shown in extractor stdout (auto-masked by `maskUrl()`) |
| Rows upserted | From extractor stdout summary |
| Raw identifier scan result | `CLEAN` or `BLOCKED` |
| E1: audit role / DB / `txn_read_only` | Confirmed |
| E2: `session_features` count by `extraction_version` | Integer counts per version |
| E3: `tbl_select=false`; `session_id_select=false` | Confirmed |
| E4: Lane A/B counts | Expected `0/0` |
| No downstream worker activated | Confirmed |
| No customer output / Lane / scoring / AMS Trust-Pass activated | Confirmed |
| Gate 4E opened | No |
| Gate 4F invented | No |
| Final verdict | `SESSION_FEATURES_EXTRACTION_PASS` or `SESSION_FEATURES_EXTRACTION_FAILED` |

---

## 7. Stop-lines

| Stop-line | Action |
| --- | --- |
| `db_name` is not `buyerrecon_production` | Stop |
| `DATABASE_URL` missing or empty | Stop |
| DSN printed in any output | Stop |
| Extractor exit code non-zero | Stop |
| `RAW_IDENTIFIER_SCAN_BLOCKED` | Stop — do not include log in evidence |
| Extractor writes to any table other than `session_features` | Stop |
| Any downstream worker command appears | Stop |
| Any further GRANT / schema change / deploy appears | Stop |
| Customer output / Lane write / scoring runtime / AMS Trust-Pass activation | Stop |
| Gate 4E opening, readiness, or auto-advance language | Stop |
| Gate 4F language | Stop |

---

## 8. Governance locks carry-forward

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

## 9. Machine-readable block

```yaml
status: SESSION_FEATURES_EXTRACTOR_RERUN_GO_PLANNING
grant_fix_proof_source: PR_114_SESSION_FEATURES_GRANT_FIX_PROOF_PASS
pr114_merge_commit: da34f9ff13827536c9a360bec008e290995de956
script: scripts/extract-session-features.ts
npm_alias: npm run extract:session-features
approved_since: "2026-06-02T21:14:34.000Z"
approved_extraction_version: session-features-v0.1
database_url_source: .env.production
database_url_never_printed: true
maskUrl_applied: true
audit_evidence_columns: [session_features_id, extraction_version]
audit_evidence_count_form: COUNT(session_features_id)_GROUP_BY_extraction_version
extractor_rerun_go_recorded: true
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
ams_trust_pass_authorised_by_this_pr: false
further_grant_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_by_this_pr: false
lane_preview_in_scope: false
next_step: operator_run_extractor_per_section_4_then_open_evidence_pr
```

---

## 10. Hard boundaries

This PR does **not**:
- run the extractor or any other worker
- contact production or perform DB writes
- apply any DB grant
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the extractor rerun GO planning only.

`next_step: operator_run_extractor_per_section_4_then_open_evidence_pr`
