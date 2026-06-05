# Sprint 3 - Behavioural Features Extractor Failure Evidence (Docs-Only)

> **DOCS-ONLY FAILURE EVIDENCE RECORD.** This PR records one
> production behavioural features extractor attempt after Helen's
> explicit execution GO under PR #130 stop-lines. The extractor
> failed with a permission error on
> `session_behavioural_features_v0_2`, and the non-zero-exit
> stop-line triggered. This PR does not rerun the extractor, does
> not apply grants, performs no DML/DDL, runs no workers, writes no
> Lane rows, creates no customer output, opens no Gate 4E, and
> invents no Gate 4F. No DSN, password, token, raw identifier,
> payload, or customer data is recorded here.

---

## 1. Verdict

**`BEHAVIOURAL_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED`**

This is a failed extractor execution attempt, not a pass.

The extractor command was attempted exactly once and exited with
code `1` after PostgreSQL returned:

```text
permission denied for table session_behavioural_features_v0_2
```

The operator stopped on the non-zero extractor exit. No rerun was
attempted.

---

## 2. Authorization And Preconditions

Helen's explicit execution GO was present:

```text
HELEN BEHAVIOURAL EXTRACTOR EXECUTION GO: run exactly one production behavioural features extractor using `npm run extract:behavioural-features`, with all PR #130 stop-lines active. No downstream workers, no Stage 0, no risk worker, no POI worker, no evidence snapshot, no Lane preview, no Lane writes, no customer output, no scoring runtime, no AMS Trust/Pass runtime, no Gate 4E, and no Gate 4F.
```

Pre-run gates passed:

| Gate | Observed |
| --- | --- |
| Production path | `/opt/buyerrecon-backend` |
| `.env.production` present | Yes |
| `package.json` present | Yes |
| Origin included PR #130 merge | `b362dfa Sprint 3: plan behavioural features extractor execution GO (#130)` |
| Package command exists | `"extract:behavioural-features": "tsx scripts/extract-behavioural-features.ts"` |
| App DSN loaded silently | `APP_DSN_loaded=true` |
| Database gate | `db_name: buyerrecon_production` |
| App role gate | `PRE_RUN_ROLE_GATE|buyerrecon_prod_collector_app|buyerrecon_production|on` |

The run was therefore attempted only after the PR #130 pre-run gates
passed.

---

## 3. Exact Command Attempted

Exactly one extractor command was attempted:

```bash
DATABASE_URL="$APP_DSN" npm run extract:behavioural-features
```

Log path:

```text
/tmp/behavioural-extractor-run-20260605T165630Z.log
```

The command used the existing package script. No ad hoc SQL writer,
custom runtime path, worker command, grant command, migration, or
manual insert/update path was used.

---

## 4. Safe Failure Output

Safe output tail:

```text
> buyerrecon-backend@1.0.0 extract:behavioural-features
> tsx scripts/extract-behavioural-features.ts

Sprint 2 PR#1+PR#2 behavioural-features extractor —extraction failed: permission denied for table session_behavioural_features_v0_2
ERROR: extractor exited non-zero - stop
```

Exit code:

```text
extractor_exit_code=1
```

Interpretation:

| Check | Result |
| --- | --- |
| Extractor attempted exactly once | Yes |
| Existing package command used | Yes |
| Exit code | `1` |
| Failure class | Permission denied |
| Failed target | `session_behavioural_features_v0_2` |
| Stop-line triggered | Non-zero extractor exit |
| Rerun attempted | No |

---

## 5. Stop-Line And No-Rerun Confirmation

The active stop-line was:

```text
non-zero extractor exit
```

After the failure:

| Boundary | Status |
| --- | --- |
| Extractor rerun | No |
| Ad hoc grant | No |
| GRANT/DML/DDL after failure | No |
| Worker run | No |
| Stage 0 run | No |
| Risk worker run | No |
| POI worker run | No |
| Evidence snapshot run | No |
| Lane preview run | No |
| Lane write | No |
| Scoring runtime run | No |
| AMS Trust / Pass runtime run | No |
| Customer output created | No |
| Gate 4E opened | No |
| Gate 4F invented | No |

No downstream path was authorized or run.

---

## 6. Data Safety Confirmation

| Boundary | Status |
| --- | --- |
| Raw accepted_events rows printed | No |
| Raw identifiers printed | No |
| `session_id` values printed | No |
| `request_id` values printed | No |
| Raw payload printed | No |
| `canonical_jsonb` payload printed | No |
| DSN printed | No |
| Password printed | No |
| Token printed | No |
| Customer data printed | No |

Only the safe package command header, extractor failure message,
permission-denied target table name, non-zero exit status, and
stop-line confirmation are recorded.

---

## 7. Next Required Step

The next step is a separate permission diagnostic and grant-fix
planning PR for `session_behavioural_features_v0_2`.

No extractor rerun is authorized until all of the following occur:

1. This failure evidence PR merges.
2. A permission diagnostic is completed for
   `session_behavioural_features_v0_2`.
3. A grant/fix planning PR is reviewed.
4. The fix is applied and proofed.
5. A new explicit extractor rerun GO is given.

Do not rerun the extractor directly from this evidence PR.

---

## 8. Carry-Forward Gating

This PR does **not** authorize:

- extractor rerun
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
- GRANT/DML/DDL
- any worker execution

The only recorded action is the one failed behavioural extractor
attempt described above.

---

## 9. Machine-Readable Block

```yaml
status: BEHAVIOURAL_FEATURES_EXTRACTION_FAILED_PERMISSION_DENIED
pr130_execution_go_planning_merge_commit: b362dfab3d6da6ce863729c3627d9e127b9fbe21
helen_execution_go_present: true
production_path: /opt/buyerrecon-backend
env_production_present: true
package_json_present: true
package_command_verified: true
package_command: npm_run_extract_behavioural_features
script_path: scripts/extract-behavioural-features.ts
app_dsn_loaded_silently: true
database_verified: buyerrecon_production
role_gate: PRE_RUN_ROLE_GATE_buyerrecon_prod_collector_app_buyerrecon_production_on
extractor_command_attempted_once: true
exact_command: DATABASE_URL_APP_DSN_npm_run_extract_behavioural_features
log_path: /tmp/behavioural-extractor-run-20260605T165630Z.log
extractor_exit_code: 1
failure: permission_denied_for_table_session_behavioural_features_v0_2
stop_line_triggered: non_zero_extractor_exit
extractor_rerun_attempted: false
ad_hoc_grant_after_failure: false
grant_dml_ddl_after_failure: false
worker_run: false
stage0_run: false
risk_worker_run: false
poi_worker_run: false
evidence_snapshot_run: false
lane_preview_run: false
lane_write: false
scoring_runtime_run: false
ams_trust_pass_runtime_run: false
customer_output_created: false
gate_4e_opened: false
gate_4f_invented: false
raw_accepted_events_rows_printed: false
raw_identifiers_printed: false
session_id_values_printed: false
request_id_values_printed: false
raw_payload_printed: false
canonical_jsonb_payload_printed: false
dsn_printed: false
password_printed: false
token_printed: false
customer_data_printed: false
next_step: permission_diagnostic_and_grant_fix_planning_for_session_behavioural_features_v0_2
extractor_rerun_requires_new_explicit_go: true
```

---

## 10. Hard Boundaries

This PR does **not**:

- rerun the behavioural extractor
- apply ad hoc grants
- run GRANT, DML, or DDL after the failure
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
- open Gate 4E
- invent Gate 4F
- change backend code, scripts, package files, migrations, schema,
  env files, deployment files, website files, AMS files, runtime
  files, worker files, Lane/scoring files, or customer-output
  artifacts
- reproduce DSNs, passwords, tokens, raw UUIDs, raw identifiers,
  raw `session_id` values, raw `request_id` values, IP addresses,
  user agents, raw rows, accepted_events row data, raw payloads,
  canonical_jsonb payloads, or customer data

It records behavioural features extractor failure evidence only.
