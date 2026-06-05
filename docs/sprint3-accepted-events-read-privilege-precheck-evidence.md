# Sprint 3 - `accepted_events` Read-Privilege Pre-Check Evidence (Docs-Only)

> **DOCS-ONLY DIAGNOSTIC EVIDENCE RECORD.** This PR records the
> manual production output from the accepted_events read-privilege
> pre-check diagnostic planned by PR #128. It does not run the
> diagnostic, does not run the behavioural extractor, does not run
> any worker, applies no grant, performs no DML/DDL, writes no data,
> opens no Gate 4E, and invents no Gate 4F. No DSN, password, token,
> raw identifier, payload, or customer data is recorded here.

---

## 1. Verdict

**`ACCEPTED_EVENTS_READ_PRIVILEGE_PRECHECK_PASS`**

The app role has the accepted_events column-level read privileges
required for the behavioural extractor precondition, including the
`consent_state` column proofed by PR #127. Table-level
`accepted_events` SELECT remains denied. `ip_hash` and `request_id`
remain denied.

This evidence does **not** authorize behavioural extractor execution.
The next step after this PR merges remains a separate behavioural
extractor execution GO PR and a separate operator session.

---

## 2. Scope And Prerequisite

| Item | Value |
| --- | --- |
| Planning PR | PR #128 |
| PR #128 merge commit | `670879c0aae9918482c8f76a1d60f61731781c91` |
| PR #128 merged at | `2026-06-05T16:14:31Z` |
| Diagnostic type | Read-only privilege pre-check |
| Role under test | `buyerrecon_prod_collector_app` |
| Database under test | `buyerrecon_production` |
| Behavioural extractor authorized by this PR | No |

The diagnostic was run manually by the operator after PR #128
merged. This evidence PR only records the operator-provided safe
status and boolean privilege output.

---

## 3. Paste Artifact Note

A garbled terminal paste artifact appeared before the valid SQL
output. It is excluded from the evidence below. It contained no DSN,
password, token, raw identifier, accepted_events row data, raw
payload, canonical_jsonb payload, or customer data.

The valid evidence starts with the DB gate and SQL output recorded
in the following sections.

---

## 4. DB Gate Evidence

```text
APP_DSN_loaded=true
db_name: buyerrecon_production
```

Interpretation:

| Check | Result |
| --- | --- |
| App DSN loaded silently | Pass |
| DSN value printed | No |
| Database name | `buyerrecon_production` |
| Wrong-database stop-line triggered | No |

---

## 5. Read-Only Privilege Diagnostic Evidence

```text
BEGIN
ROLE_GATE|buyerrecon_prod_collector_app|buyerrecon_production|on
AE_PRIVILEGE_PRECHECK|ae_table_select=false|event_id_sel=true|workspace_id_sel=true|site_id_sel=true|session_id_sel=true|received_at_sel=true|raw_sel=true|consent_source_sel=true|schema_key_sel=true|canonical_jsonb_sel=true|event_contract_version_sel=true|event_origin_sel=true|consent_state_sel=true|ip_hash_sel=false|request_id_sel=false
ROLLBACK
no_row_reads=true
no_raw_identifiers_printed=true
no_secret_printed=true
no_grant_dml_ddl=true
no_extractor_run=true
no_worker_run=true
```

---

## 6. Role And Transaction Interpretation

| Check | Expected | Observed | Verdict |
| --- | --- | --- | --- |
| `current_user` | `buyerrecon_prod_collector_app` | `buyerrecon_prod_collector_app` | Pass |
| `current_database` | `buyerrecon_production` | `buyerrecon_production` | Pass |
| `transaction_read_only` | `on` | `on` | Pass |
| Transaction wrapper | `BEGIN READ ONLY ... ROLLBACK` | `BEGIN ... ROLLBACK` output from read-only diagnostic | Pass |

---

## 7. Privilege Interpretation

| Privilege check | Expected | Observed | Verdict |
| --- | --- | --- | --- |
| Table-level `accepted_events` SELECT | `false` | `false` | Pass |
| `event_id` SELECT | `true` | `true` | Pass |
| `workspace_id` SELECT | `true` | `true` | Pass |
| `site_id` SELECT | `true` | `true` | Pass |
| `session_id` SELECT | `true` | `true` | Pass |
| `received_at` SELECT | `true` | `true` | Pass |
| `raw` SELECT | `true` | `true` | Pass - prior carry-forward |
| `consent_source` SELECT | `true` | `true` | Pass |
| `schema_key` SELECT | `true` | `true` | Pass |
| `canonical_jsonb` SELECT | `true` | `true` | Pass - prior carry-forward |
| `event_contract_version` SELECT | `true` | `true` | Pass |
| `event_origin` SELECT | `true` | `true` | Pass |
| `consent_state` SELECT | `true` | `true` | Pass - PR #127 grant proof confirmed |
| `ip_hash` SELECT | `false` | `false` | Pass |
| `request_id` SELECT | `false` | `false` | Pass |

`raw_sel=true` and `canonical_jsonb_sel=true` are prior
carry-forward privileges. They were not newly granted by this
diagnostic and are not newly authorized by this evidence PR.

---

## 8. Data Safety Confirmation

| Boundary | Status |
| --- | --- |
| `accepted_events` row data selected | No |
| `SELECT *` used | No |
| Raw identifiers printed | No |
| `session_id` values printed | No |
| `request_id` values printed | No |
| Raw payload printed | No |
| `canonical_jsonb` payload printed | No |
| Customer data printed | No |
| DSN/password/token printed | No |
| GRANT attempted | No |
| DML attempted | No |
| DDL attempted | No |
| Behavioural extractor run | No |
| Worker run | No |

Only safe status lines and boolean privilege results are recorded.

---

## 9. Carry-Forward Gating

This PR does **not** authorize:

- behavioural extractor execution
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

If this evidence PR merges, the next step is still a separate
behavioural extractor execution GO PR and a separate operator
session. The extractor remains blocked until that separate GO is
authorized.

---

## 10. Machine-Readable Block

```yaml
status: ACCEPTED_EVENTS_READ_PRIVILEGE_PRECHECK_PASS
planning_source: PR_128_ACCEPTED_EVENTS_READ_PRIVILEGE_PRECHECK_DIAGNOSTIC_GO
pr128_merge_commit: 670879c0aae9918482c8f76a1d60f61731781c91
pr128_merged_at: "2026-06-05T16:14:31Z"
app_dsn_loaded_silently: true
dsn_printed: false
database_verified: buyerrecon_production
role_verified: buyerrecon_prod_collector_app
transaction_read_only: on
accepted_events_table_select: false
event_id_sel: true
workspace_id_sel: true
site_id_sel: true
session_id_sel: true
received_at_sel: true
raw_sel: true
raw_sel_status: prior_carry_forward_not_new
consent_source_sel: true
schema_key_sel: true
canonical_jsonb_sel: true
canonical_jsonb_sel_status: prior_carry_forward_not_new
event_contract_version_sel: true
event_origin_sel: true
consent_state_sel: true
consent_state_source: PR_127_single_column_grant_proof
ip_hash_sel: false
request_id_sel: false
no_row_reads: true
no_select_star: true
no_raw_identifiers_printed: true
no_session_id_values_printed: true
no_request_id_values_printed: true
no_raw_payload_printed: true
no_canonical_jsonb_payload_printed: true
no_customer_data_printed: true
no_secret_printed: true
no_grant_dml_ddl: true
no_extractor_run: true
no_worker_run: true
paste_artifact_excluded_from_evidence: true
paste_artifact_secret_or_raw_data: false
behavioural_extractor_authorised_by_this_pr: false
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
next_step: separate_behavioural_extractor_execution_go_pr
```

---

## 11. Hard Boundaries

This PR does **not**:

- run the diagnostic
- run any production command
- apply any DB grant or change privileges
- run the behavioural extractor
- run Stage 0
- run any risk worker, POI worker, or downstream worker
- create an evidence snapshot
- activate Lane preview, Lane writes, scoring runtime, customer
  output, or AMS Trust / Pass runtime
- change backend code, scripts, package files, migrations, schema,
  env files, deployment files, website files, AMS files, runtime
  files, worker files, Lane/scoring files, or customer-output
  artifacts
- open Gate 4E
- invent Gate 4F
- reproduce DSNs, passwords, tokens, raw UUIDs, raw `session_id`
  values, raw `request_id` values, IP addresses, user agents,
  raw rows, `accepted_events` row data, raw payloads,
  `canonical_jsonb` payloads, or customer data

It records the accepted_events read-privilege pre-check diagnostic
evidence only.
