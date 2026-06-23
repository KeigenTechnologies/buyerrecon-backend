# Sprint 3 - Risk Worker RECORD_ONLY Capture Evidence

**Status:** `RISK_WORKER_RECORD_ONLY_CAPTURE_EVIDENCE`

This is a **docs-only evidence** record for the Step 4 RECORD_ONLY capture
attempt identified by `capture_id=risk_record_only_20260623T143244Z`.

This record contains safe labels only. It does not include private capture
directory paths, private pointer file contents, raw worker output, `run.err`,
`run.safe.out`, DSN values, credentials, customer data, SQL output, or runtime
cause classification.

---

## Trusted Base

```text
base_branch=sprint2-architecture-contracts-d4cc2bf
trusted_base=14709fb17b10dd8df834d6c16af4641089066745
```

---

## Capture Result

```text
capture_id=risk_record_only_20260623T143244Z
result=record_only_capture_completed
worker_exit_code=1
```

---

## Safe Evidence Labels

```text
risk_evidence_record_only_capture_go_start=true
capture_id=risk_record_only_20260623T143244Z
repo_preflight_pass=true
trusted_base_confirmed=true
static_proof_labels_confirmed=true
normal_risk_evidence_run_unchanged=true
record_only_command_present=true
record_only_wrapper_present=true
static_validation_pass=true
database_url_present=true
database_url_printed=false
private_capture_dir_created=true
capture_dir_mode_0700=true
run_err_created=true
run_safe_out_created=true
run_err_mode_0600=true
run_safe_out_mode_0600=true
raw_output_paths_printed=false
worker_command_invoked=true
worker_invocation_count=1
record_only_command_invoked=true
risk_evidence_run_executed=false
risk_evidence_record_only_executed=true
worker_exit_code=1
run_err_nonempty=true
run_safe_out_nonempty=true
raw_output_printed=false
raw_output_read_after_capture=false
classifier_execution_attempted=false
classifier_execution_count=0
sql_psql_executed=false
db_mutation_command_executed=false
capture_executed=true
fix_executed=false
deploy_executed=false
lane_scoring_ams_customer_gate_executed=false
gate4e_executed=false
gate4f_executed=false
capture_output_file_count=2
latest_capture_pointer_created=true
latest_capture_pointer_printed=false
record_only_capture_completed=true
```

---

## Interpretation

- Exactly one `risk-evidence:record-only` command was invoked.
- The normal `risk-evidence:run` command was not executed.
- The worker exited non-zero with `worker_exit_code=1`.
- This is capture evidence only, not runtime-cause classification.
- The private output pair exists and is nonempty.
- Raw output was not printed or read after capture.
- The latest capture pointer was created but not printed.
- The classifier was not run.
- No fix, SQL/psql, DB mutation command, deploy, customer output,
  Lane/scoring/AMS, Gate4E, or Gate4F occurred.

The non-zero worker exit is recorded as a numeric result only. This evidence does
not inspect, summarize, classify, or quote the private output pair.

---

## Explicit Non-Authorization

This evidence PR does **not** authorize:

```text
raw output read/cat/grep/copy/inspection
run.err read/cat/grep/copy/inspection
run.safe.out read/cat/grep/copy/inspection
classifier execution
worker rerun
risk-evidence:run
risk-evidence:record-only rerun
SQL/psql
DB mutation
deploy
fix
Lane/scoring/AMS/customer/Gate4E/F
private capture directory path printing
private pointer file content printing
```

---

## Validation

```text
git_diff_check_passed=true
check_constants_passed=true
git_status_short_reviewed=true
validation_worker_rerun_executed=false
validation_classifier_execution_attempted=false
validation_raw_output_read=false
validation_sql_psql_executed=false
validation_db_mutation_executed=false
```

Validation commands used:

```text
git diff --check
npm run check:constants
git status --short
```

These validation commands did not read, inspect, cat, grep, copy, or summarize
`run.err`, `run.safe.out`, private capture directory contents, or private pointer
file contents. They did not run worker/runtime commands.

---

## Safety / Raw-Data Boundary

This record contains no private capture directory path, no private pointer file
content, no raw `run.err`, no raw `run.safe.out`, no raw stdout/stderr, no raw
runtime output, no DSN value or DSN component, no password, no credential, no
token, no host value, no port value, no connection string, no env value, no raw
PostgreSQL error, no `pg_hba` line, no SQL output, no customer payload, no
customer data, no raw `accepted_events` payload, no raw `canonical_jsonb`, no
real `request_id`, no real `session_id`, no user identifier, no IP address, no
user-agent value, no header value, no body value, no stack trace, and no
exception text.

The capture id, command names, filenames, status labels, and boolean/numeric
labels above are non-secret evidence identifiers.

---

## Next Safe Step

After this evidence PR is reviewed and merged, the next possible step is a
separate allowlisted classifier GO against the private captured output pair. This
capture evidence PR does not authorize classifier execution.
