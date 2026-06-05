# Sprint 3 - Behavioural Features Extractor Execution GO Planning (Docs-Only)

> **DOCS-ONLY EXTRACTOR EXECUTION GO PLANNING RECORD. THIS PR DOES
> NOT EXECUTE.** It records the reviewed plan for one future
> behavioural features extractor run after the accepted_events
> `consent_state` grant proof and accepted_events read-privilege
> pre-check evidence both passed. This PR does not run the
> extractor, does not run workers, does not run Stage 0, does not
> apply grants, performs no DML/DDL, writes no Lane rows, creates no
> customer output, opens no Gate 4E, and invents no Gate 4F. No
> secrets, raw identifiers, raw payloads, canonical_jsonb payloads,
> or customer data are recorded here.

---

## 1. Status

- **Status:** `BEHAVIOURAL_FEATURES_EXTRACTOR_EXECUTION_GO_PLANNING`
- **Precondition proof:** PR #127
  (`accepted_events.consent_state` grant proof, merge commit
  `487d7488691afb44706203f8a0ba98768a477283`)
- **Precondition evidence:** PR #129
  (`ACCEPTED_EVENTS_READ_PRIVILEGE_PRECHECK_PASS`, merge commit
  `25fbab5c2b1c44ab4542dfa500705b33e5c8acb8`, merged
  `2026-06-05T16:35:53Z`)

The required accepted_events read privileges are now proofed, but
extractor execution still requires Helen's explicit GO after this
planning PR passes review and merges. Merging this PR alone is not
operator authorization to run the extractor.

**Authorization recorded by this PR after merge and explicit Helen GO
only:**

- `behavioural_extractor_execution_go_planned=true`
- `helen_explicit_go_required_before_execution=true`
- `single_extractor_run_only=true`
- `post_run_evidence_pr_required=true`

**Still false and not authorized by this PR:**

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
- `ad_hoc_grant_dml_ddl_authorised_by_this_pr=false`
- `gate_4e_authorised_by_this_pr=false`
- `gate_4f_invented_by_this_pr=false`

---

## 2. Preconditions Satisfied

| Precondition | Evidence | Status |
| --- | --- | --- |
| `accepted_events.consent_state` SELECT granted to app role | PR #127 | Satisfied |
| Production DB verified as `buyerrecon_production` for pre-check | PR #129 | Satisfied |
| App role verified as `buyerrecon_prod_collector_app` for pre-check | PR #129 | Satisfied |
| `transaction_read_only=on` for pre-check | PR #129 | Satisfied |
| Table-level accepted_events SELECT remained false | PR #129 | Satisfied |
| Extractor-required accepted_events columns all true | PR #129 | Satisfied |
| `ip_hash=false` and `request_id=false` | PR #129 | Satisfied |
| `raw` and `canonical_jsonb` carry-forward status documented | PR #129 | Satisfied |
| No row reads, secrets, raw identifiers, payloads, or customer data printed | PR #129 | Satisfied |

The extractor is no longer blocked by the accepted_events
`consent_state` privilege gap. Execution remains separately gated by
this planning PR, Codex review, merge, and Helen's explicit
execution GO.

---

## 3. Exact Intended Operator Action

The intended future operator action is one behavioural features
extractor run only.

| Field | Value |
| --- | --- |
| Production DB | `buyerrecon_production` |
| App role / DSN | `.env.production` `DATABASE_URL` loaded silently as `APP_DSN` |
| Existing package command | `npm run extract:behavioural-features` |
| Script behind package command | `tsx scripts/extract-behavioural-features.ts` |
| Feature version | `behavioural-features-v0.3` |
| Candidate window start | `2026-06-02T21:14:34.000Z` |
| Candidate window end | extractor default `NOW` unless explicitly set by operator GO |
| Workspace filter | Omit |
| Site filter | Omit |
| Downstream workers | Not authorized |

The operator must use the existing package command. Do not improvise
a direct SQL write, ad hoc TypeScript runner, custom script, or
manual insert/update path.

---

## 4. Planned Operator Command Pack

The following command pack is the planned future operator action. It
must not be run by this PR. It may be run only after this planning PR
passes review, merges, and Helen gives explicit extractor execution
GO.

```bash
set -euo pipefail

cd /opt/buyerrecon-backend

echo "operator_scope=behavioural_features_extractor_single_run_only"
echo "downstream_workers_authorised=false"

export APP_DSN="$(grep -E '^DATABASE_URL=' .env.production | cut -d= -f2-)"
[ -n "$APP_DSN" ] && echo "APP_DSN_loaded=true" || { echo "ERROR: APP_DSN not loaded - stop"; exit 1; }

DB_NAME="$(
  DATABASE_URL="$APP_DSN" node -e "
const u = new URL(process.env.DATABASE_URL);
console.log(u.pathname.replace(/^\\//, ''));
"
)"

echo "db_name: ${DB_NAME}"
[ "$DB_NAME" = "buyerrecon_production" ] || { echo "ERROR: wrong database - stop"; exit 1; }

DATABASE_URL="$APP_DSN" psql -v ON_ERROR_STOP=1 --no-password --tuples-only --no-align -d "$APP_DSN" <<'SQL'
BEGIN READ ONLY;
SELECT
  'PRE_RUN_ROLE_GATE'
  || '|' || current_user
  || '|' || current_database()
  || '|' || current_setting('transaction_read_only') AS pre_run_role_gate;
ROLLBACK;
SQL

LOG_FILE="/tmp/buyerrecon-behavioural-features-extractor-run-$(date -u +%Y%m%dT%H%M%SZ).log"

set -o pipefail
DATABASE_URL="$APP_DSN" \
SINCE="2026-06-02T21:14:34.000Z" \
FEATURE_VERSION="behavioural-features-v0.3" \
npm run extract:behavioural-features 2>&1 | tee "$LOG_FILE"

EXTRACTOR_EXIT="${PIPESTATUS[0]}"
echo "extractor_exit_code=${EXTRACTOR_EXIT}"
[ "$EXTRACTOR_EXIT" = "0" ] || { echo "ERROR: extractor non-zero exit - stop"; exit 1; }

grep -qiE '(request_id|session_id|canonical_jsonb|ip_hash|user_agent|user-agent|authorization|bearer|postgres(ql)?://[^<])' \
  "$LOG_FILE" \
  && { echo "ERROR: unsafe output token detected - stop, do not use log in evidence"; exit 1; } \
  || echo "safe_output_scan=clean"

echo "no_downstream_worker_run=true"
echo "no_stage0_run=true"
echo "no_lane_write=true"
echo "no_customer_output=true"
```

Expected safe extractor stdout is the script's aggregate summary
only: feature version, optional filters, candidate window, masked
database URL, and rows upserted. The masked database URL must remain
masked. No DSN value, password, token, raw identifier, raw payload,
canonical_jsonb payload, accepted_events row, IP, user agent, or
customer data may appear.

---

## 5. Required Execution Safety

The future operator session must enforce all of the following:

| Safety requirement | Rule |
| --- | --- |
| Load app DSN silently | Required |
| Print DSN/password/token | Forbidden |
| Confirm DB name before run | Must be `buyerrecon_production` |
| Confirm app-role DB gate before run | Must show `buyerrecon_prod_collector_app` |
| Use existing package command | `npm run extract:behavioural-features` only |
| Run count | One extractor run only |
| Stop on non-zero exit | Required |
| Capture output | Safe aggregate output only |
| Raw accepted_events rows | Forbidden |
| `session_id` / `request_id` values | Forbidden |
| Raw payload / canonical_jsonb payload | Forbidden |
| IP / user agent values | Forbidden |
| Customer data | Forbidden |
| Downstream worker paths | Forbidden |
| Ad hoc GRANT/DML/DDL outside the existing extractor | Forbidden |

Stop immediately if the output contains raw identifiers, payloads,
secrets, customer data, or signs that the extractor triggered any
downstream worker path.

---

## 6. Post-Run Proof Requirements

A separate docs-only post-extractor evidence PR is required after
the future operator run. That evidence PR must record only safe
aggregate proof.

Required post-run evidence:

| Evidence item | Requirement |
| --- | --- |
| Extractor exit code | `0` for pass |
| Feature version | `behavioural-features-v0.3` |
| Candidate window | Safe timestamp range only |
| Rows upserted | Aggregate count only |
| Behavioural feature rows | Safe aggregate new/updated counts if available |
| DB | `buyerrecon_production` |
| Role / DSN path | Safe status only, no DSN |
| Lane A/B writes | Confirm none |
| Stage 0 / risk / POI | Confirm none |
| Evidence snapshot / Lane preview | Confirm none |
| Customer output / scoring / AMS | Confirm none |
| Gate 4E / Gate 4F | Not opened / not invented |
| Secrets/raw data | Confirm none printed |

The post-run evidence PR must not include raw accepted_events rows,
raw payloads, canonical_jsonb payloads, raw identifiers,
`session_id` values, `request_id` values, IP values, user agent
values, DSNs, passwords, tokens, or customer data.

---

## 7. Carry-Forward Gating

Even if the future behavioural extractor run passes, downstream
workers remain separately gated. This planning PR does not authorize:

- Stage 0
- risk worker
- POI worker
- evidence snapshot
- Lane preview
- Lane writes
- customer output
- scoring runtime
- AMS Trust / Pass runtime
- Gate 4E
- Gate 4F

The future extractor run may only populate or update
`session_behavioural_features_v0_2` through the existing extractor.
No downstream scoring, Lane, customer, AMS, or Gate activity may be
inferred from a successful extractor run.

---

## 8. Stop-Lines

Stop immediately if any of the following occurs:

| Stop-line | Action |
| --- | --- |
| Helen explicit extractor execution GO is missing | Do not run |
| DB is not `buyerrecon_production` | Stop |
| Pre-run role gate is not `buyerrecon_prod_collector_app` | Stop |
| DSN/password/token would be printed | Stop |
| Command is not `npm run extract:behavioural-features` | Stop |
| More than one extractor run is attempted | Stop |
| Extractor exits non-zero | Stop |
| Output contains raw identifiers or payloads | Stop |
| Output contains `session_id` or `request_id` values | Stop |
| Output contains raw payload or canonical_jsonb payload | Stop |
| Output contains IP, user agent, or customer data | Stop |
| Any downstream worker command appears | Stop |
| Any Stage 0, Lane preview, Lane write, scoring, AMS, or customer-output command appears | Stop |
| Any GRANT, DML, DDL, migration, or schema command outside the package extractor appears | Stop |
| Gate 4E or Gate 4F language appears | Stop |

---

## 9. Machine-Readable Block

```yaml
status: BEHAVIOURAL_FEATURES_EXTRACTOR_EXECUTION_GO_PLANNING
pr127_consent_state_grant_proof_merge_commit: 487d7488691afb44706203f8a0ba98768a477283
pr129_precheck_pass_merge_commit: 25fbab5c2b1c44ab4542dfa500705b33e5c8acb8
pr129_merged_at: "2026-06-05T16:35:53Z"
preconditions_satisfied: true
helen_explicit_go_required_before_execution: true
merge_alone_authorises_execution: false
extractor_run_by_this_pr: false
single_extractor_run_only: true
production_db_required: buyerrecon_production
app_dsn_loaded_silently_required: true
package_command_required: npm_run_extract_behavioural_features
package_script: "extract:behavioural-features"
script_path: scripts/extract-behavioural-features.ts
feature_version: behavioural-features-v0.3
since: "2026-06-02T21:14:34.000Z"
post_run_evidence_pr_required: true
safe_aggregate_output_only: true
no_row_data_output: true
no_raw_identifier_output: true
no_raw_payload_output: true
no_canonical_jsonb_payload_output: true
no_customer_data_output: true
ad_hoc_grant_dml_ddl_authorised_by_this_pr: false
stage0_authorised_by_this_pr: false
risk_worker_authorised_by_this_pr: false
poi_worker_authorised_by_this_pr: false
evidence_snapshot_authorised_by_this_pr: false
lane_preview_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
customer_output_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
next_step_after_merge: helen_explicit_extractor_execution_go_then_single_operator_run_then_evidence_pr
```

---

## 10. Hard Boundaries

This PR does **not**:

- run the behavioural extractor
- run workers
- run Stage 0
- run risk worker
- run POI worker
- run evidence snapshot
- run Lane preview
- write Lane A/B
- run scoring runtime
- run AMS Trust / Pass runtime
- create customer output
- apply GRANT or run ad hoc DML/DDL outside the existing extractor
- change backend code, scripts, package files, migrations, schema,
  env files, deployment files, website files, AMS files, runtime
  files, worker files, Lane/scoring files, or customer-output
  artifacts
- open Gate 4E
- invent Gate 4F
- reproduce DSNs, passwords, tokens, raw UUIDs, raw identifiers,
  raw `session_id` values, raw `request_id` values, IP addresses,
  user agents, raw rows, accepted_events row data, raw payloads,
  canonical_jsonb payloads, or customer data

It records behavioural features extractor execution GO planning only.
