# Sprint 3 — Risk Worker Phase B Sub-Classifier Retry — Executed Blocked Evidence

**Status:** `RISK_WORKER_SUBCLASSIFIER_RETRY_EXECUTED_BLOCKED_NONE_NOT_CLASSIFIED`

This is a **docs-only evidence record**. It records the **executed** result of the PR #358
revised risk-worker Phase B sub-classifier retry command pack against the existing private
capture (`capture_id=risk_record_only_20260623T143244Z`): the retry reached the expected
PR #358 base, invoked the sub-classifier **exactly once**, and the outcome was
**blocked / none_not_classified** — no refined category was produced.

---

## 1. Scope and Non-Authorization

This PR is **evidence-only** and **authorizes no further execution**. It records
safe-label output produced on the server by the operator-run command pack; it performs no
execution itself. **The exact raw runtime error line remains `unknown` and must not be
inferred, and the internal blocked reason must not be inferred from private capture
contents.**

This PR **does not**: execute the classifier; run `node` on the classifier; rerun the
worker; run `risk-evidence:run` or `risk-evidence:record-only`; read/`cat`/`grep`/copy/
summarize `run.err` / `run.safe.out`; inspect or print private capture paths/pointers; run
SQL/psql; mutate the DB; edit secret/env/config/source/scripts/runtime files; deploy; or
run Lane/scoring/AMS/customer/Gate 4E/Gate 4F.

---

## 2. Trusted Base

```text
sprint2-architecture-contracts-d4cc2bf
ae1ae6fcd8026b332eaeea29be96a91656b87870
verified_base_tip=ae1ae6fcd8026b332eaeea29be96a91656b87870
```

---

## 3. Evidence Carried Forward

```text
PR #348: static RECORD_ONLY proof evidence merged.
PR #349: capture evidence merged; capture_id=risk_record_only_20260623T143244Z; worker_exit_code=1.
PR #350: classifier evidence merged; diagnostic_result=classified; diagnostic_category=runtime_dependency_or_build_failure.
PR #351: remediation planning merged.
PR #352: static inspection evidence merged; likely_failure_surface=unknown; remediation_planning_result=subclassifier_needed.
PR #353: sub-classifier planning merged.
PR #354: first sub-classifier GO consumed/blocked by shell/Markdown paste/history expansion; none_not_classified.
PR #355: safer retry planning merged.
PR #356: safer retry command-pack merged as review-only.
PR #357: exact-artifact review blocked; prepared PR #356 artifact must not execute as-is.
PR #358: revised command-pack merged (real classifier, full STOP labels, corrected preflight).
runtime_cause_exact_line=unknown
```

---

## 4. Preconditions and Base Transition

- Before retry execution, the server repo was **fast-forwarded** from local head
  `351d18044d61da13c998a58830193d6e2b5a7ca8` to the PR #358 base
  `ae1ae6fcd8026b332eaeea29be96a91656b87870`.
- **PR #358 merge present** in base history:

```text
ae1ae6f Merge PR #358: docs: revise risk worker runtime dependency sub-classifier command pack
```

---

## 5. Artifact Transfer and Validation

The paste-ready script was transferred to the server as `/tmp/paste_ready358_clean.sh`.

**Initial server transfer validation (before wrapper hardening):**

```text
server_bytes=9707
server_sha256=328b4a4bb7a8dd177f7971aeff561fca916565a89c9ff0dafee1f6b07e1e996d
server_bash_n=true
pr357_stale_guard_present=false
```

---

## 6. Wrapper Safety Hardening

Wrapper safety inspection found that the original `node` invocation allowed **direct Node
stderr/stdout** to reach the terminal:

```text
CAPTURE_ID="$CAPTURE_ID" VERIFIED_BASE_TIP="$REMOTE_TIP" LOCAL_HEAD="$LOCAL_HEAD" node "$CLASSIFIER_TMP"
```

**Why this was blocked:** a raw `node` invocation could leak Node-level stderr/stdout (an
uncaught error, a stack trace, or exception text) directly to the terminal — bypassing the
safe-label-only contract and risking exposure of raw runtime detail / the exact error line.
The operator therefore **patched the server wrapper** to capture Node stdout/stderr to temp
files, **discard stderr on nonzero**, and emit **only safe labels** on
`classifier_nonzero_exit`.

**Patched wrapper validation:**

```text
final_server_bytes=9939
final_server_sha256=9d31ef72db401d010b25f86c72fc1d3843b82c100a0c0d9f882b3838ce82054f
pr357_stale_guard_present=false
literal_bang_in_script=false
unredirected_node_call_present=false
redirected_node_call_present=true
```

---

## 7. First Preflight Blocked Attempt (before fast-forward)

The first execution — run **before** the fast-forward — blocked safely at the local-HEAD
preflight guard, with **no** sub-classifier invocation:

```text
blocked_reason=local_head_not_expected_base
verified_base_tip=ae1ae6fcd8026b332eaeea29be96a91656b87870
local_head=351d18044d61da13c998a58830193d6e2b5a7ca8
capture_id=risk_record_only_20260623T143244Z
subclassifier_execution_attempted=false
subclassifier_execution_count=0
subclassifier_result=blocked
subclassifier_category=none_not_classified
```

This confirms the corrected preflight is **fail-closed**: a local HEAD that does not match
the expected PR #358 base stops before any classifier execution and emits the full blocked
label set.

---

## 8. Fast-Forward Evidence

After the preflight block, the server repo was fast-forwarded so local HEAD matched the
expected base:

```text
from_local_head=351d18044d61da13c998a58830193d6e2b5a7ca8
to_base=ae1ae6fcd8026b332eaeea29be96a91656b87870
pr358_merge_present=true
```

---

## 9. Final One-Time Retry Output (after fast-forward)

After the fast-forward, **exactly one** sub-classifier retry execution occurred, emitting
only safe labels:

```text
verified_base_tip=ae1ae6fcd8026b332eaeea29be96a91656b87870
local_head=ae1ae6fcd8026b332eaeea29be96a91656b87870
capture_id=risk_record_only_20260623T143244Z
subclassifier_execution_attempted=true
subclassifier_execution_count=1
subclassifier_result=blocked
subclassifier_category=none_not_classified
raw_output_printed=false
raw_output_read_outside_classifier=false
private_capture_paths_printed=false
private_capture_pointer_printed=false
exact_error_line_printed=false
stack_trace_printed=false
exception_text_printed=false
only_allowlisted_category_printed=true
fix_executed=false
worker_rerun_executed=false
risk_evidence_run_executed=false
risk_evidence_record_only_rerun_executed=false
sql_psql_executed=false
db_mutation_executed=false
deploy_executed=false
lane_scoring_ams_customer_gate_executed=false
gate4e_executed=false
gate4f_executed=false
subclassifier_wrapper_exit_code=0
```

---

## 10. Interpretation

- The retry **reached the expected PR #358 base** and **invoked the sub-classifier exactly
  once** (`subclassifier_execution_count=1`, `subclassifier_wrapper_exit_code=0`).
- The sub-classifier **did not** classify the runtime dependency/build failure into a
  refined allowlisted category.
- The final diagnostic result remains **`blocked` / `none_not_classified`**.
- No raw runtime output, exact error line, stack trace, exception text, private capture
  path, private pointer, SQL, DB/customer data, or secrets were printed.
- The broad category from PR #350 (`runtime_dependency_or_build_failure`) is therefore
  **unchanged and not narrowed**, and `likely_failure_surface` remains `unknown` (PR #352).
- **The internal blocked reason is not inferred here** and must not be inferred from
  private capture contents.

---

## 11. Negative-Action Ledger (this PR)

```text
classifier_executed=false
node_execution_of_classifier=false
worker_rerun=false
risk_evidence_run=false
risk_evidence_record_only_rerun=false
run_err_or_run_safe_out_read=false
private_capture_path_or_pointer_inspected=false
sql_psql_executed=false
db_mutation=false
secret_or_env_or_config_edited=false
source_fixed=false
deploy=false
lane_scoring_ams_customer_output=false
gate4e=false
gate4f=false
raw_runtime_output_included=false
exact_error_line_included=false
stack_trace_or_exception_text_included=false
private_path_or_pointer_included=false
```

This evidence PR records server-produced **safe labels only**; it performs none of the
above actions.

---

## 12. Next-Step Boundary

- This PR is **evidence-only** and **authorizes no further execution**.
- Because the retry result is `blocked` / `none_not_classified`, the category remains
  **un-narrowed**. Any next step (e.g. a narrower reviewed classifier plan, a different
  diagnostic approach, or a stop) requires its **own separate docs-only planning PR**,
  review, and a **fresh explicit GO**.
- **No** code fix, worker rerun, capture rerun, classifier rerun, or downstream/Gate action
  is authorized by this PR. The exact raw runtime error line remains `unknown` and **must
  not be inferred**.

---

## 13. Safety / Raw-Data Boundary

This record contains no raw runtime output, no `run.err` / `run.safe.out` content, no raw
runtime error line, no stack trace, no exception text, no private capture path/pointer
value, no base64 payload blob, no DSN URI, connection string, password, token, host, port,
IP, URI, hostname, raw identifier, `accepted_events` payload, `canonical_jsonb` value, raw
PostgreSQL error, `pg_hba` content, raw SQL output, or customer data. The SHA-256 digests
and byte counts above are **non-secret integrity metadata** for the transferred script;
the git SHAs are **public commit hashes**. This is a docs-only evidence record of a
completed, safe-label-only sub-classifier retry: it **runs nothing** and emits **safe
labels / category tokens / public git commit hashes / script integrity metadata only**.
The exact raw runtime error line remains `unknown` and **must not be inferred**.
