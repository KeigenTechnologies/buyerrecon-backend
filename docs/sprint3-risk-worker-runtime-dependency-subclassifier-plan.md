# Sprint 3 — Risk Worker Runtime-Dependency Sub-Classifier Plan (Planning-Only)

**Status:** `RISK_WORKER_RUNTIME_DEPENDENCY_SUBCLASSIFIER_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It **plans, but does not run**, a
future **allowlisted sub-classifier** that may read the existing private captured
`run.err` / `run.safe.out` **internally only** and emit **a single narrower safe
category**. The plan — and any future sub-classifier it describes — must **never** reveal,
quote, copy, summarize, or infer exact raw runtime output, the exact error line, a stack
trace, or exception text.

This PR **executes nothing** and **authorizes no execution**: no read/`cat`/`grep`/copy/
summarize of `run.err` / `run.safe.out`; no private capture path/pointer inspection; no
sub-classifier run; no rerun of the existing classifier; no worker rerun; no
`risk-evidence:run`; no `risk-evidence:record-only`; no SQL/psql; no DB mutation; no
deploy; no fix; no edit to package/source/scripts/config/runtime/DSN/secret files; no
Lane/scoring/AMS/customer/Gate 4E/Gate 4F action. **The exact raw runtime error line
remains `unknown` and must not be inferred.**

---

## 1. Trusted Base

```text
sprint2-architecture-contracts-d4cc2bf
cda0cd48ca8d28a50dbd58961feef9273b1ef01d
verified_base_tip=cda0cd48ca8d28a50dbd58961feef9273b1ef01d
```

---

## 2. Evidence Carried Forward

```text
capture_id=risk_record_only_20260623T143244Z
worker_exit_code=1
diagnostic_result=classified
diagnostic_category=runtime_dependency_or_build_failure
classifier_execution_count=1
likely_failure_surface=unknown
remediation_planning_result=subclassifier_needed
raw_output_printed=false
raw_output_read_outside_classifier=false
fix_executed=false
runtime_cause_exact_line=unknown
```

Provenance chain:

- **PR #348** — static RECORD_ONLY proof evidence **merged**.
- **PR #349** — RECORD_ONLY capture evidence **merged**
  (`capture_id=risk_record_only_20260623T143244Z`, `worker_exit_code=1`).
- **PR #350** — classifier evidence **merged** (`diagnostic_result=classified`,
  `diagnostic_category=runtime_dependency_or_build_failure`).
- **PR #351** — remediation planning **merged**
  (`RISK_WORKER_RUNTIME_DEPENDENCY_OR_BUILD_FAILURE_REMEDIATION_PLANNING_ONLY`).
- **PR #352** — static repository-inspection evidence **merged**
  (`likely_failure_surface=unknown`, `remediation_planning_result=subclassifier_needed`).

**Standing position:** PR #352 confirmed the wiring/entrypoint/import boundary are present
and internally consistent but **could not isolate a single failure surface** from
tracked-file inspection alone, because the discriminating inputs are out of static scope
and **raw output must not be read** outside an allowlisted classifier. PR #352 therefore
recommended a **narrower allowlisted sub-classifier**. This PR plans that sub-classifier.

---

## 3. Problem Statement (what the future sub-classifier must achieve)

Narrow the broad `runtime_dependency_or_build_failure` category to **exactly one** of a
fixed set of **narrower safe categories** (Section 4), by reading the **existing private
capture** (`run.err` / `run.safe.out`) **internally, inside the classifier process
only** — emitting **only a single allowlisted category token and safe booleans**, and
**never** printing, quoting, summarizing, or inferring the raw output, the exact error
line, a stack trace, or exception text.

---

## 4. Allowed Future Sub-Classifier Output Categories (fixed set)

```text
missing_dependency
node_runtime_incompatibility
tsx_typescript_execution_failure
esm_import_path_or_extension_mismatch
module_export_import_mismatch
type_only_import_runtime_issue
build_artifact_or_transpile_failure
unknown_runtime_dependency_or_build_failure
```

The future sub-classifier must emit **at most one** of these tokens. `unknown_runtime_
dependency_or_build_failure` is the **fail-safe** value when the capture does not map
cleanly to a single narrower category (it does **not** authorize printing raw output to
"explain" the ambiguity).

---

## 5. Required Future Sub-Classifier Safety Rules (invariants)

When the sub-classifier is later executed (under its own separate explicit GO), it must
hold **all** of the following:

```text
classifier_execution_count=1
raw_output_printed=false
raw_output_read_outside_classifier=false
private_capture_paths_printed=false
private_capture_pointer_printed=false
exact_error_line_printed=false
stack_trace_printed=false
exception_text_printed=false
only_allowlisted_category_printed=true
```

- **Read-internal-only:** the capture may be read **inside the classifier process** to
  derive the category; the raw bytes never leave the process as output.
- **Exactly one execution:** `classifier_execution_count=1` — a single bounded run; no
  loop, no retry that re-reads and re-emits.
- **Allowlisted output only:** the only emitted strings are the Section 4 category token
  and the Section 6 safe labels; nothing else.

---

## 6. Allowed Future Sub-Classifier Emitted Labels (safe; booleans / category tokens only)

The future sub-classifier may emit **only** labels of these shapes:

```text
subclassifier_execution_attempted=true/false
subclassifier_execution_count=1
subclassifier_result=classified|inconclusive|blocked
subclassifier_category=missing_dependency|node_runtime_incompatibility|tsx_typescript_execution_failure|esm_import_path_or_extension_mismatch|module_export_import_mismatch|type_only_import_runtime_issue|build_artifact_or_transpile_failure|unknown_runtime_dependency_or_build_failure
raw_output_printed=false
raw_output_read_outside_classifier=false
exact_error_line_printed=false
stack_trace_printed=false
exception_text_printed=false
fix_executed=false
worker_rerun_executed=false
sql_psql_executed=false
db_mutation_executed=false
deploy_executed=false
lane_scoring_ams_customer_gate_executed=false
```

No other output is permitted: no raw line, no file path, no pointer, no excerpt, no
paraphrase of the captured error.

---

## 7. Stop-Lines

The future sub-classifier (and this plan) must **abort** (safe stop-line; emit
`subclassifier_result=blocked` with no raw value) if any of:

```text
subclassifier would need to print raw output
subclassifier would need to print exact error line
subclassifier would need to print stack trace or exception text
classifier would need to run before planning review/merge
worker would need to rerun
diagnostic would require SQL/psql or DB access
diagnostic would expose DSN/secret/customer/raw output
fix would be required before category is safely narrowed
```

If a stop-line is hit, withhold all raw output, record the blocked state in a docs-only
evidence PR (safe labels only), and take **no** fix/rerun/raw-read without separate
review/GO.

---

## 8. Next-Gate Decision Tree

```text
If plan is reviewed and merged:
  future separate explicit GO may authorize exactly one allowlisted sub-classifier execution against the existing private capture.

If sub-classifier returns a narrow safe category:
  create docs-only sub-classifier evidence PR.
  then consider separate minimal-fix planning PR.

If sub-classifier remains inconclusive:
  stop or create a narrower reviewed classifier plan.

If raw output would be required:
  stop; do not read raw output.
```

**No** sub-classifier execution, classifier rerun, worker rerun, capture rerun, fix, or
downstream/Gate action is authorized by this planning PR.

---

## 9. Safety Boundaries (this planning PR)

- **Docs-only planning.** No code change.
- No read/`cat`/`grep`/copy/summarize of `run.err` / `run.safe.out`.
- No private capture path / pointer inspection.
- No sub-classifier run.
- No rerun of the existing classifier.
- No worker rerun.
- No `risk-evidence:run`.
- No `risk-evidence:record-only`.
- No SQL/psql.
- No DB mutation.
- No deploy.
- No fix applied.
- No edit to package/source/scripts/config/runtime/DSN/secret files.
- No Lane / scoring / AMS / customer / Gate 4E / Gate 4F action.

---

## 10. Explicit Non-Authorization

**Merging this plan authorizes:**
- **no** sub-classifier execution;
- **no** classifier rerun;
- **no** worker rerun;
- **no** capture rerun;
- **no** raw-output read;
- **no** SQL/psql or DB access;
- **no** fix/remediation;
- **and no** downstream / Lane / scoring / AMS / customer / Gate 4E / Gate 4F action.

The future allowlisted sub-classifier execution requires its **own** fresh explicit GO,
and any later minimal-fix planning requires its **own** docs-only plan, review, and fresh
explicit GO. The exact raw runtime error line remains `unknown` and **must not be
inferred**.

---

## 11. Safety / Raw-Data Boundary

This record contains no raw runtime output, no `run.err` / `run.safe.out` content, no raw
error line, no stack trace, no exception text, no private capture path/pointer value, no
DSN URI, connection string, password, token, host, port, IP, URI, hostname, raw
identifier, `accepted_events` payload, `canonical_jsonb` value, raw PostgreSQL error,
`pg_hba` content, raw SQL output, or customer data. This is a docs-only planning record
that specifies a future allowlisted sub-classifier's **categories, safety rules, emitted
labels, stop-lines, and gating**; it **runs nothing**, reads **no** raw output, and emits
**safe labels / category tokens / public git commit hashes only**. The exact raw runtime
error line remains `unknown` and **must not be inferred**.
