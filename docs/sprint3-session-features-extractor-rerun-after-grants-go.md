# Sprint 3 — Session Feature Extractor Rerun GO After Both Grant Fixes (Docs-Only)

> **DOCS-ONLY RERUN GO PLANNING RECORD. THIS PR DOES NOT EXECUTE.**
> It plans exactly one rerun of `scripts/extract-session-features.ts`
> following both privilege fix proofs: `session_features` write path
> (PR #114) and `accepted_events` read path (PR #122). The rerun
> happens **only** in a later, separate operator session after this
> PR merges. This PR runs no commands, writes no data, contacts no
> production environment, does not run any downstream worker, and
> does not open Gate 4E. No secrets, no raw payloads, no raw
> `request_id` / `session_id`.

---

## 1. Status

- **Status:** `SESSION_FEATURES_EXTRACTOR_RERUN_AFTER_GRANTS_GO_PLANNING`
- **session_features write fix proof:** PR #114
  (`SESSION_FEATURES_GRANT_FIX_PROOF_PASS`)
- **accepted_events read fix proof:** PR #122
  (`ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_PROOF_PASS`, merged
  `2026-06-05T09:46:02Z`, commit
  `294f5d5ca7ce5eef058fd3c74143f9801c101919`)

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
- `ams_trust_pass_runtime_authorised_by_this_pr=false`
- `further_grant_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`
- `db_write_by_this_pr=false`
- `extractor_before_this_pr_merges_authorised=false`

---

## 2. Current privilege state

Both privilege blockers that caused prior extractor failures are
now fixed and proofed:

| Fix | Status |
| --- | --- |
| `session_features` INSERT / UPDATE / SELECT + sequence USAGE (PR #114) | Proofed |
| `accepted_events` column-level SELECT on 11 extractor-required columns (PR #122) | Proofed |

**`accepted_events` SELECT state (confirmed by PR #122 proof):**

| Column | SELECT |
| --- | --- |
| `event_id` | true |
| `workspace_id` | true (PR #87) |
| `site_id` | true (PR #87) |
| `session_id` | true (PR #122) |
| `received_at` | true (PR #122) |
| `raw` | true (PR #122) |
| `consent_source` | true (PR #122) |
| `schema_key` | true (PR #122) |
| `canonical_jsonb` | true (PR #122) |
| `event_contract_version` | true (PR #122) |
| `event_origin` | true (PR #122) |
| Table-level SELECT | false (intentional) |
| `ip_hash` SELECT | false |
| `request_id` SELECT | false |

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
npm run extract:session-features 2>&1 | \
  tee /tmp/session-features-extractor-rerun-after-grants.log

EXTRACTOR_EXIT=${PIPESTATUS[0]}
echo "extractor_exit_code: $EXTRACTOR_EXIT"
```

**⛔ STOP if `extractor_exit_code` is not `0`.**

### 4.3 Silent raw-identifier scan

```bash
grep -qiE '(request_id|session_id|canonical_jsonb|ip_hash|user_agent)' \
  /tmp/session-features-extractor-rerun-after-grants.log \
  && echo "RAW_IDENTIFIER_SCAN_BLOCKED — stop, do not use log in evidence" \
  || echo "RAW_IDENTIFIER_SCAN_CLEAN"
```

**⛔ STOP if output is `RAW_IDENTIFIER_SCAN_BLOCKED`.**

---

## 5. Post-run read-only evidence counts

Use `BEGIN READ ONLY ... ROLLBACK`:

```bash
set -a
. /root/buyerrecon-production-db.env
set +a
export AUDIT_DSN="$PRODUCTION_DATABASE_URL"
unset PRODUCTION_DATABASE_URL
[ -n "$AUDIT_DSN" ] && echo "AUDIT_DSN loaded" || { echo "ERROR: AUDIT_DSN not loaded — stop"; exit 1; }

psql --no-password --tuples-only --no-align -d "$AUDIT_DSN" <<'SQL'
BEGIN READ ONLY;

SELECT current_user, current_database(),
       current_setting('transaction_read_only') AS txn_read_only,
       now() AT TIME ZONE 'UTC' AS ts_utc;

SELECT extraction_version,
       COUNT(session_features_id) AS row_count
FROM public.session_features
GROUP BY extraction_version
ORDER BY row_count DESC;

SELECT
  has_table_privilege('buyerrecon_prod_audit_readonly',
                      'public.session_features', 'SELECT') AS tbl_select,
  has_column_privilege('buyerrecon_prod_audit_readonly',
                       'public.session_features', 'session_id', 'SELECT') AS session_id_select;

SELECT
  (SELECT COUNT(*) FROM public.scoring_output_lane_a) AS lane_a_count,
  (SELECT COUNT(*) FROM public.scoring_output_lane_b) AS lane_b_count;

ROLLBACK;
SQL
```

**Note on evidence query:** `COUNT(session_features_id)` uses only
the granted column; `GROUP BY extraction_version` uses the second
granted column. No `session_id`, URL fields, or JSONB content is
read.

---

## 6. Required post-run evidence PR

A separate docs-only evidence PR must record (no secrets, no raw
identifiers):

| Evidence item | Format |
| --- | --- |
| Extractor exit code | Integer (`0` = success) |
| Extraction version | `session-features-v0.1` |
| Candidate window start | `2026-06-02T21:14:34.000Z` |
| Masked database URL | From extractor stdout (auto-masked by `maskUrl()`) |
| Rows upserted | From extractor stdout summary |
| Raw identifier scan result | `CLEAN` or `BLOCKED` |
| Audit role / DB / `txn_read_only` | Confirmed |
| `session_features` count by `extraction_version` | Integer counts |
| `tbl_select=false`; `session_id_select=false` | Confirmed |
| Lane A/B counts | Expected `0/0` |
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
| DSN printed | Stop |
| Extractor exit code non-zero | Stop |
| `RAW_IDENTIFIER_SCAN_BLOCKED` | Stop |
| Extractor writes to any table other than `session_features` | Stop |
| Any downstream worker command appears | Stop |
| Any GRANT / schema change / deploy appears | Stop |
| Customer output / Lane write / scoring runtime / AMS Trust-Pass activation | Stop |
| Gate 4E opening, readiness, or auto-advance language | Stop |
| Gate 4F language | Stop |

---

## 8. Machine-readable block

```yaml
status: SESSION_FEATURES_EXTRACTOR_RERUN_AFTER_GRANTS_GO_PLANNING
session_features_grant_fix_proof: PR_114_SESSION_FEATURES_GRANT_FIX_PROOF_PASS
accepted_events_grant_fix_proof: PR_122_ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_PROOF_PASS
pr122_merge_commit: 294f5d5ca7ce5eef058fd3c74143f9801c101919
script: scripts/extract-session-features.ts
npm_alias: npm run extract:session-features
approved_since: "2026-06-02T21:14:34.000Z"
approved_extraction_version: session-features-v0.1
database_url_source: .env.production
database_url_never_printed: true
maskUrl_applied: true
audit_evidence_columns: [session_features_id, extraction_version]
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
ams_trust_pass_runtime_authorised_by_this_pr: false
further_grant_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_write_by_this_pr: false
lane_preview_in_scope: false
next_step: operator_run_extractor_per_section_4_then_open_evidence_pr
```

---

## 9. Hard boundaries

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
