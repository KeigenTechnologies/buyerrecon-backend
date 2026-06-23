# Risk-Worker RECORD_ONLY Classifier Evidence

## Status

**Status:** `RISK_WORKER_RECORD_ONLY_CLASSIFIER_EVIDENCE`

- **Evidence-only.** **Docs-only.**
- Under a scoped classifier GO, **exactly one** allowlisted classifier execution
  ran against the private captured output pair from capture
  `risk_record_only_20260623T143244Z`. It classified the RECORD_ONLY worker's
  nonzero exit into a bounded safe category:
  `diagnostic_category=runtime_dependency_or_build_failure`
  (`diagnostic_result=classified`).
- The classifier read the private `run.err` / `run.safe.out` **internally only**;
  **no raw output was printed, copied, summarized, or read outside the
  classifier**. The private capture directory path and pointer-file contents are
  **not** printed.
- This is **classification evidence only** — it does **not** identify the exact
  raw error line, and it does **not** authorize remediation.
- No worker rerun, no `risk-evidence:run`, no `risk-evidence:record-only` rerun,
  no SQL/psql, no DB mutation, no fix, no deploy, no customer output, no
  Lane/scoring/AMS, no Gate4E/Gate4F occurred.
- **No** DSN value/component, password, token, host, port, raw PostgreSQL error
  text, `pg_hba` line, stack trace, customer payload, raw `accepted_events`
  payload, raw `canonical_jsonb`, `request_id`, `session_id`, user identifier,
  IP, user-agent, header, body value, private capture path, or `run.err`/
  `run.safe.out` content appears in this document.

This PR **records** the already-run, GO-scoped classifier result. **This PR
reruns nothing, reads no raw output, applies no fix, and authorizes no
remediation.**

---

## Evidence chain

- Capture `risk_record_only_20260623T143244Z` produced a private `run.err` +
  `run.safe.out` pair from exactly one `risk-evidence:record-only` invocation;
  the RECORD_ONLY worker exited nonzero (`worker_exit_code=1`).
- A scoped classifier GO authorized **exactly one** allowlisted classifier pass
  over that private pair, emitting a bounded category label only.
- Result: `diagnostic_result=classified`,
  `diagnostic_category=runtime_dependency_or_build_failure`.

---

## Evidence labels

```text
risk_record_only_capture_classifier_go_start=true
capture_id=risk_record_only_20260623T143244Z
repo_preflight_pass=true
trusted_base_confirmed=true
latest_capture_pointer_found=true
latest_capture_pointer_printed=false
private_capture_pair_found=true
private_capture_paths_printed=false
run_err_present=true
run_safe_out_present=true
run_err_nonempty=true
run_safe_out_nonempty=true
classifier_execution_attempted=true
classifier_execution_count=1
raw_output_printed=false
raw_output_read_outside_classifier=false
worker_rerun_executed=false
risk_evidence_run_executed=false
risk_evidence_record_only_rerun_executed=false
sql_psql_executed=false
fix_executed=false
db_mutation_executed=false
deploy_executed=false
lane_scoring_ams_customer_gate_executed=false
gate4e_executed=false
gate4f_executed=false
diagnostic_result=classified
diagnostic_category=runtime_dependency_or_build_failure
allowlisted_classifier_completed=true
```

---

## Interpretation

- **Exactly one** allowlisted classifier execution occurred
  (`classifier_execution_attempted=true`, `classifier_execution_count=1`,
  `allowlisted_classifier_completed=true`).
- The classifier **read private `run.err` / `run.safe.out` internally only**
  (`private_capture_pair_found=true`, `run_err_present=true`,
  `run_safe_out_present=true`, both nonempty).
- **Raw output was not printed, copied, summarized, or read outside the
  classifier** (`raw_output_printed=false`,
  `raw_output_read_outside_classifier=false`); the private capture paths and the
  latest-capture pointer were **not** printed
  (`private_capture_paths_printed=false`,
  `latest_capture_pointer_printed=false`).
- The result is **classified** as **`runtime_dependency_or_build_failure`**.
- This evidence **does not identify the exact raw error line**.
- This evidence **does not authorize remediation**.
- **No** worker rerun, `risk-evidence:run`, `risk-evidence:record-only` rerun,
  SQL/psql, DB mutation, fix, deploy, customer output, Lane/scoring/AMS, Gate4E,
  or Gate4F occurred.
- **No secret / DSN / raw / customer / request / session / IP / header / body /
  private-path / `run.err` / `run.safe.out` value was printed.**

---

## Does NOT authorize

This PR does **NOT** authorize: a remediation/fix of the
`runtime_dependency_or_build_failure`, another classifier run, a worker
run/rerun, `risk-evidence:run`, a `risk-evidence:record-only` rerun, reading/
`cat`/`grep`/copying/summarizing any `run.err`/`run.safe.out` or private capture
path, any SQL/psql, any DB mutation, any deploy or production touch, or any
Lane/scoring/AMS/customer/Gate4E/Gate4F action. Any remediation requires its own
separate planning, review, and explicit scoped Helen GO.

---

## Next safe step

After this classifier evidence PR is reviewed and merged, the next possible step
is a **separate docs-only remediation planning PR** for
`runtime_dependency_or_build_failure`. This classifier evidence PR does **not**
authorize a fix.

---

## Safety / Raw-Data Boundary

This record contains no secret value, **no DSN value or DSN component**, raw
password, password hash, DSN URI, connection string, raw secret-manager payload,
service-file content, `.env.production` / `risk-worker.env` content/value, token,
private key, IP address, host value, port value, real URI, login source, **raw
`pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real
`session_id` / `request_id` / user identifier, user-agent, header, body value,
customer row data, **raw psql output, raw PostgreSQL error text**, **stack trace
/ exception text**, **worker stdout/stderr**, `run.safe.out` / `run.err`
contents, **private capture directory path**, or **private pointer file
contents**. The classifier read the private captured pair **internally only** and
emitted a single bounded **category token** plus safe booleans/counts; no raw
line was printed, copied, summarized, or read outside it. The capture id token
(`risk_record_only_20260623T143244Z`), the `package.json` script names
(`risk-evidence:run`, `risk-evidence:record-only`), the role name
(`buyerrecon_risk_worker`), the table name (`risk_observations_v0_1`), the
database name (`buyerrecon_production`), the repo path (`/opt/buyerrecon-backend`),
and the recorded commit hash are **non-secret** identifiers. All values above are
safe labels / booleans / counts / category tokens / non-secret identifiers / a
public git commit hash — not secret or row values. **This PR runs nothing.**
