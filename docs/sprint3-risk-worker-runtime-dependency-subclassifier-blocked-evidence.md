# Sprint 3 — Risk Worker Runtime-Dependency Sub-Classifier — Blocked Shell/Paste Evidence

**Status:** `RISK_WORKER_RUNTIME_DEPENDENCY_SUBCLASSIFIER_BLOCKED_SHELL_PASTE_EVIDENCE`

This is a **docs-only evidence record**. It records that an attempted allowlisted
sub-classifier invocation (planned in PR #353) was **blocked by an operator-shell / paste
failure** — **not** a classified runtime result. **No** allowed sub-classifier category
was validly emitted; the attempted sub-classifier GO should be treated as **consumed /
blocked, not successful**.

This PR **executes nothing** and **authorizes no remediation**: no read/`cat`/`grep`/
copy/summarize of `run.err` / `run.safe.out`; no private capture path/pointer inspection;
no sub-classifier rerun; no existing-classifier rerun; no worker rerun; no
`risk-evidence:run`; no `risk-evidence:record-only`; no SQL/psql; no DB mutation; no
deploy; no fix; no edit to package/source/scripts/config/runtime/DSN/secret files; no
Lane/scoring/AMS/customer/Gate 4E/Gate 4F action. **The exact raw runtime error line
remains `unknown` and must not be inferred.**

> **Scope note on the error text below:** the lines recorded in §4 are **operator
> interactive-Bash / paste errors** (history-expansion and "command not found" / "No such
> file or directory" messages produced by the *shell* against contaminated pasted text).
> They are **not** the risk worker's captured `run.err` / `run.safe.out` content, **not**
> the worker's raw runtime error, and reveal **no** capture output. They are recorded only
> to evidence *why the sub-classifier attempt was blocked*.

---

## 1. Trusted Base

```text
sprint2-architecture-contracts-d4cc2bf
3d703386186be3ead9e24e17215cb2f9dd0e8cb4
verified_base_tip=3d703386186be3ead9e24e17215cb2f9dd0e8cb4
```

---

## 2. Evidence Recorded

```text
capture_id=risk_record_only_20260623T143244Z
subclassifier_result=blocked
subclassifier_category=none_not_classified
blocked_reason=interactive_shell_history_expansion_or_markdown_fence_paste
runtime_cause_exact_line=unknown
```

---

## 3. Evidence Carried Forward

```text
PR #348: static RECORD_ONLY proof evidence merged.
PR #349: RECORD_ONLY capture evidence merged; capture_id=risk_record_only_20260623T143244Z; worker_exit_code=1.
PR #350: classifier evidence merged; diagnostic_result=classified; diagnostic_category=runtime_dependency_or_build_failure.
PR #351: remediation planning merged.
PR #352: static repository-inspection evidence merged; likely_failure_surface=unknown; remediation_planning_result=subclassifier_needed.
PR #353: sub-classifier planning merged; planning only.
```

---

## 4. Actual Event Summary (operator-shell / paste failure — not a runtime result)

A first pasted long shell/Node command was contaminated by Markdown fence text and Bash
history expansion (`!`-triggered). The visible **interactive-shell** errors were:

```text
-bash: !entry.isDirectory: event not found
-bash: !isDir: event not found
-bash: !captureDir: event not found
-bash: !allowedCategories.includes: event not found
```

A later pasted block also included Markdown / `id` contamination and produced the visible
**shell** errors:

```text
bash: id=c4q7tm: No such file or directory
risk_worker_runtime_dependency_subclassifier_go_blocked=true: command not found
```

A final safe cleanup/label command was attempted after `set +H`, but the visible
transcript **did not show label stdout**. Therefore this evidence **does not** claim a
successful safe-label emission; the outcome is recorded as **blocked and not classified**.

**Interpretation of these lines:** every line above is a *shell-level* rejection of
contaminated pasted text (history expansion on `!`, a stray `id=...` token treated as a
command/path, and a `key=value` token treated as a command). **None** is worker output,
**none** is captured `run.err` / `run.safe.out` content, and **none** reveals the raw
runtime error.

---

## 5. Boundary Facts Recorded

```text
raw_output_printed=false
raw_output_read_outside_classifier=false
private_capture_paths_printed=false
private_capture_pointer_printed=false
exact_error_line_printed=false
stack_trace_printed=false
exception_text_printed=false
subclassifier_completed=false
subclassifier_category=none_not_classified
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
temporary_subclassifier_cleanup_attempted=true
```

---

## 6. Interpretation

```text
This evidence records a blocked operator-shell/paste failure, not a classified runtime result.
No allowed sub-classifier category was validly emitted.
No exact raw runtime error line is known.
No remediation/fix is authorized.
The attempted sub-classifier GO should be treated as consumed/blocked, not successful.
```

Because `subclassifier_completed=false` and `subclassifier_category=none_not_classified`,
the broad category from PR #350 (`runtime_dependency_or_build_failure`) is **unchanged and
not narrowed**, and `likely_failure_surface` remains `unknown` (PR #352).

---

## 7. Next Safe Step

```text
Review and merge this blocked evidence PR.
After that, create a revised sub-classifier retry plan with a safer invocation shape:
- no Markdown fences
- no JavaScript containing `!` pasted into interactive Bash
- preferably a checked-in docs-only command pack or base64/single-quoted heredoc-safe method
- explicit `set +H`
- no raw output printing
```

The revised retry plan and any future sub-classifier execution each require their **own**
docs-only plan / fresh explicit GO, and must still honour the PR #353 safety rules
(read-internal-only, exactly one execution, allowlisted output only, no raw output / exact
line / stack trace / exception text printed).

---

## 8. Safety Boundaries (this evidence PR)

- **Docs-only evidence.** No code change.
- No read/`cat`/`grep`/copy/summarize of `run.err` / `run.safe.out`.
- No private capture path / pointer inspection.
- No sub-classifier rerun.
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

## 9. Safety / Raw-Data Boundary

This record contains no raw runtime output, no `run.err` / `run.safe.out` content, no raw
runtime error line, no stack trace, no exception text, no private capture path/pointer
value, no DSN URI, connection string, password, token, host, port, IP, URI, hostname, raw
identifier, `accepted_events` payload, `canonical_jsonb` value, raw PostgreSQL error,
`pg_hba` content, raw SQL output, or customer data. The error lines quoted in §4 are
**operator interactive-Bash / paste rejection messages** (history-expansion and
command/path "not found" errors against contaminated pasted text), **not** worker capture
output. This is a docs-only blocked-attempt evidence record: it **runs nothing**, reads
**no** raw capture output, narrows **no** category, and emits **safe labels / category
tokens / public git commit hashes only**. The exact raw runtime error line remains
`unknown` and **must not be inferred**.
