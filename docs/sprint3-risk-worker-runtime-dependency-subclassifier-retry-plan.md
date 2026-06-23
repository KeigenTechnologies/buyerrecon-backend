# Sprint 3 — Risk Worker Runtime-Dependency Sub-Classifier — Safer Retry Plan (Planning-Only)

**Status:** `RISK_WORKER_RUNTIME_DEPENDENCY_SUBCLASSIFIER_RETRY_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It **plans, but does not run**, a
**safer retry shape** for **exactly one** future allowlisted sub-classifier execution
against the existing private capture (`capture_id=risk_record_only_20260623T143244Z`). It
is the follow-up to PR #354, where the first sub-classifier GO was **consumed/blocked** by
an operator-shell / Markdown-paste / Bash history-expansion artifact
(`subclassifier_result=blocked`, `subclassifier_category=none_not_classified`).

This PR **executes nothing** and **authorizes no execution**: no read/`cat`/`grep`/copy/
summarize of `run.err` / `run.safe.out`; no private capture path/pointer inspection; no
revised sub-classifier run; no rerun of the failed sub-classifier; no existing-classifier
rerun; no worker rerun; no `risk-evidence:run`; no `risk-evidence:record-only`; no
SQL/psql; no DB mutation; no deploy; no fix; no edit to package/source/scripts/config/
runtime/DSN/secret files; no Lane/scoring/AMS/customer/Gate 4E/Gate 4F action. **The exact
raw runtime error line remains `unknown` and must not be inferred.**

---

## 1. Trusted Base

```text
sprint2-architecture-contracts-d4cc2bf
fadc47adf14062ce1e453c929fe0763dbc083a57
verified_base_tip=fadc47adf14062ce1e453c929fe0763dbc083a57
```

---

## 2. Evidence Carried Forward

```text
PR #348: static RECORD_ONLY proof evidence merged.
PR #349: RECORD_ONLY capture evidence merged; capture_id=risk_record_only_20260623T143244Z; worker_exit_code=1.
PR #350: classifier evidence merged; diagnostic_result=classified; diagnostic_category=runtime_dependency_or_build_failure.
PR #351: remediation planning merged.
PR #352: static repository-inspection evidence merged; likely_failure_surface=unknown; remediation_planning_result=subclassifier_needed.
PR #353: sub-classifier planning merged; planning only.
PR #354: first sub-classifier GO consumed/blocked by shell/Markdown paste/history-expansion artifact; subclassifier_result=blocked; subclassifier_category=none_not_classified.
raw_output_printed=false
raw_output_read_outside_classifier=false
runtime_cause_exact_line=unknown
```

**Standing position:** the broad category from PR #350
(`runtime_dependency_or_build_failure`) is **still not narrowed**;
`likely_failure_surface` remains `unknown` (PR #352). The PR #354 block was a **delivery/
invocation failure**, not a classification result — so the sub-classifier intent of PR #353
is still valid and needs **a safer invocation shape**, which this PR plans.

---

## 3. Problem Statement (what the safer retry must achieve)

Deliver **exactly one** allowlisted sub-classifier execution against
`capture_id=risk_record_only_20260623T143244Z` **without** reintroducing the PR #354
failure mode, and emit **only** a single allowlisted category token plus safe booleans —
**never** raw output, private path/pointer, exact error line, stack trace, or exception
text.

---

## 4. PR #354 Failure Mode (what must be prevented)

The retry shape must **structurally prevent** all of:

```text
no Markdown fences pasted into interactive Bash
no JavaScript containing `!` pasted into interactive Bash
explicit `set +H`
no raw-output printing
no private path/pointer printing
no exact error line / stack trace / exception text printing
```

Root cause recap (from PR #354, operator-shell artifacts only): pasted Markdown fence text
and `!`-bearing JavaScript triggered Bash **history expansion** (`event not found`) and
stray tokens were treated as commands/paths. The fix is a **delivery method that never
puts fence characters or `!` into an interactive shell line**, plus `set +H` to disable
history expansion as defence-in-depth.

---

## 5. Preferred Retry Shapes (no shape is executed here)

### Option A — checked-in docs-only command pack (preferred)
A **checked-in docs-only command pack** containing only **safe shell commands** plus an
inline classifier **encoded heredoc-safe / base64-safe**, so the operator runs a small set
of pre-reviewed commands rather than pasting a long ad-hoc block. The classifier source
never appears as raw `!`-bearing text on an interactive line; it is decoded from a
single-quoted / base64 payload inside the pack.
- **Pros:** pre-reviewed, reproducible, no fence/`!` ever reaches the interactive shell;
  smallest paste surface; auditable.
- **Cons:** requires authoring the command pack as its own reviewed artifact under a fresh
  GO (this PR does not author or run it).

### Option B — server-side base64 one-liner (no `!`, no fences)
A server-side one-liner that **writes the classifier from base64 text**, where the pasted
shell contains **no `!` characters and no Markdown fences**. The base64 payload decodes to
the classifier file; the shell line itself is fence-free and `!`-free, run after `set +H`.
- **Pros:** single safe paste; base64 neutralises `!` and fence hazards; no history
  expansion exposure.
- **Cons:** base64 is opaque at a glance (must be generated from a reviewed source);
  still operator-paste dependent; needs care that the decode/run step prints no raw output.

### Option C — stop (fail-safe)
If a safe invocation **cannot** be expressed without interactive-shell hazards, **stop**
and record a blocked/stop evidence PR (safe labels only). Do **not** force an unsafe paste.
- **Pros:** never trades safety for progress.
- **Cons:** leaves the category un-narrowed (acceptable — `unknown` is a valid standing
  state).

**Recommendation:** **Option A** (checked-in docs-only command pack) as the smallest,
pre-reviewed, lowest-paste-surface shape; **Option B** only if a command pack is not
practical; **Option C** if neither can be made hazard-free. The choice is made in the
**retry execution plan / command pack** under its **own** fresh GO — not here.

---

## 6. Allowed Future Sub-Classifier Categories (unchanged fixed set)

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

The future sub-classifier must emit **at most one** of these tokens (or
`none_not_classified` if blocked). `unknown_runtime_dependency_or_build_failure` is the
fail-safe value when the capture does not map cleanly to a single narrower category.

---

## 7. Required Future Emitted Labels (safe; booleans / category tokens only)

When the safer retry is later executed (under its own separate explicit GO), it must emit
**only** labels of these shapes:

```text
subclassifier_execution_attempted=true
subclassifier_execution_count=1
subclassifier_result=classified|inconclusive|blocked
subclassifier_category=<one allowed category or none_not_classified if blocked>
capture_id=risk_record_only_20260623T143244Z
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
```

No other output is permitted: no raw line, no file path, no pointer, no excerpt, no
paraphrase of the captured error.

---

## 8. Stop-Lines

The safer retry (and this plan) must **abort** (safe stop-line; emit
`subclassifier_result=blocked` / record a stop evidence PR with no raw value) if any of:

```text
retry command would require printing raw output
retry command would require printing exact error line
retry command would require printing stack trace or exception text
retry command would require printing private capture path or pointer contents
retry command still contains Markdown fences
retry command still contains interactive-shell `!` hazards
retry would require worker rerun
retry would require SQL/psql or DB access
retry would expose DSN/secret/customer/raw output
fix would be required before safe category narrowing
```

---

## 9. Next-Gate Decision Tree

```text
If retry plan is reviewed and merged:
  future separate explicit GO may authorize exactly one safer allowlisted sub-classifier retry.

If safer retry returns a narrow allowed category:
  create docs-only sub-classifier evidence PR.
  then consider separate minimal-fix planning PR.

If safer retry is blocked or inconclusive:
  create blocked/inconclusive evidence PR or stop.

If raw output would be required:
  stop; do not read raw output.
```

**No** sub-classifier execution, classifier rerun, worker rerun, capture rerun, fix, or
downstream/Gate action is authorized by this planning PR.

---

## 10. Safety Boundaries (this planning PR)

- **Docs-only planning.** No code change.
- No read/`cat`/`grep`/copy/summarize of `run.err` / `run.safe.out`.
- No private capture path / pointer inspection.
- No revised sub-classifier run.
- No rerun of the failed sub-classifier.
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

## 11. Explicit Non-Authorization

**Merging this plan authorizes:**
- **no** sub-classifier execution (safer-shape or otherwise);
- **no** classifier rerun;
- **no** worker rerun;
- **no** capture rerun;
- **no** raw-output read;
- **no** SQL/psql or DB access;
- **no** fix/remediation;
- **and no** downstream / Lane / scoring / AMS / customer / Gate 4E / Gate 4F action.

The safer-retry execution plan / command pack (Option A or B) requires its **own**
docs-only artifact, review, and a fresh explicit GO; any later minimal-fix planning
likewise requires its **own** docs-only plan, review, and fresh explicit GO. The exact raw
runtime error line remains `unknown` and **must not be inferred**.

---

## 12. Safety / Raw-Data Boundary

This record contains no raw runtime output, no `run.err` / `run.safe.out` content, no raw
runtime error line, no stack trace, no exception text, no private capture path/pointer
value, no DSN URI, connection string, password, token, host, port, IP, URI, hostname, raw
identifier, `accepted_events` payload, `canonical_jsonb` value, raw PostgreSQL error,
`pg_hba` content, raw SQL output, or customer data. This is a docs-only planning record
that specifies a **safer retry shape, categories, emitted labels, stop-lines, and
gating**; it **runs nothing**, reads **no** raw output, narrows **no** category, and emits
**safe labels / category tokens / public git commit hashes only**. The exact raw runtime
error line remains `unknown` and **must not be inferred**.
