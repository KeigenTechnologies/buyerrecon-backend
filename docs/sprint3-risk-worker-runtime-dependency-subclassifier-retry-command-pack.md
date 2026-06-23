# Sprint 3 — Risk Worker Runtime-Dependency Sub-Classifier — Safer Retry Command Pack (Review-Only)

**Status:** `RISK_WORKER_RUNTIME_DEPENDENCY_SUBCLASSIFIER_RETRY_COMMAND_PACK_REVIEW_ONLY`

This is a **docs-only, review-only command pack**. It is the Option-A execution artifact
planned in PR #355 for **exactly one** future allowlisted sub-classifier retry against the
existing private capture (`capture_id=risk_record_only_20260623T143244Z`). **This PR does
not execute the command pack.** The commands below are **recorded for review only** and
run **only later, under a separate explicit GO**.

This PR **executes nothing** and **authorizes no execution**: no read/`cat`/`grep`/copy/
summarize of `run.err` / `run.safe.out`; no private capture path/pointer inspection; no
sub-classifier run; no rerun of the failed or existing classifier; no worker rerun; no
`risk-evidence:run`; no `risk-evidence:record-only`; no SQL/psql; no DB mutation; no
deploy; no fix; no edit to package/source/scripts/config/runtime/DSN/secret files; no
Lane/scoring/AMS/customer/Gate 4E/Gate 4F action. **The exact raw runtime error line
remains `unknown` and must not be inferred.**

---

## 1. Trusted Base

```text
sprint2-architecture-contracts-d4cc2bf
fd62a87859f855339170c458fa71c8c72690c096
verified_base_tip=fd62a87859f855339170c458fa71c8c72690c096
```

---

## 2. Evidence Carried Forward

```text
PR #348 static RECORD_ONLY proof evidence merged.
PR #349 capture evidence merged; capture_id=risk_record_only_20260623T143244Z; worker_exit_code=1.
PR #350 classifier evidence merged; diagnostic_result=classified; diagnostic_category=runtime_dependency_or_build_failure.
PR #351 remediation planning merged.
PR #352 static inspection evidence merged; likely_failure_surface=unknown; remediation_planning_result=subclassifier_needed.
PR #353 sub-classifier planning merged.
PR #354 first GO consumed/blocked by shell/Markdown paste/history expansion; none_not_classified.
PR #355 safer retry planning merged.
runtime_cause_exact_line=unknown
```

---

## 3. Design Constraints (this command pack must satisfy)

```text
Preferred shape: base64-safe server-side classifier creation.
No Markdown fences in the operator command body.
No bang characters in the pasted shell.
Explicit set +H.
No raw output printing.
No private capture path printing.
No pointer contents printing.
No exact error line printing.
No stack trace printing.
No exception text printing.
Only one allowlisted category emitted.
```

**Why base64:** the base64 alphabet (`A–Z a–z 0–9 + / =`) contains **no** Markdown fence
characters and **no** bang character, so the classifier source is delivered without ever
placing a fence or a bang on an interactive shell line. `set +H` disables Bash history
expansion as defence-in-depth. This structurally prevents the PR #354 failure mode.

> **Authoring note (review-only):** the base64 payload referenced in §6 is **generated at
> execution time from a reviewed classifier source**, under the separate GO — it is **not**
> embedded or executed here. The skeleton in §7 is an **illustrative, review-only** shape
> showing the required no-bang / read-internal-only / single-category style; it is **not**
> a runnable payload in this PR.

---

## 4. Allowed Future Categories (unchanged fixed set)

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

The classifier emits **at most one** of these (or `none_not_classified` if blocked).

---

## 5. Required Safe Labels (the future execution may emit ONLY these)

```text
verified_base_tip=<current base tip at execution time>
local_head=<current local HEAD>
capture_id=risk_record_only_20260623T143244Z
subclassifier_execution_attempted=true
subclassifier_execution_count=1
subclassifier_result=classified|inconclusive|blocked
subclassifier_category=<one allowed category or none_not_classified if blocked>
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

## 6. Operator Command Body (review-only; run later only under a separate GO)

The operator command body below contains **no Markdown fence characters** and **no bang
character**. It runs after `set +H`. Placeholders `<RETRY_CLASSIFIER_B64>`,
`<EXPECTED_BASE_TIP>`, and `<EXPECTED_LOCAL_HEAD>` are filled at execution time from the
reviewed source and the then-current SHAs; the payload decodes to the reviewed classifier
described in §7. The classifier itself resolves and reads the capture pair **internally**
and prints **only** the §5 safe labels.

```text
set +H
set -u

EXPECTED_BASE_TIP=<EXPECTED_BASE_TIP>
EXPECTED_LOCAL_HEAD=<EXPECTED_LOCAL_HEAD>
CAPTURE_ID=risk_record_only_20260623T143244Z

REMOTE_TIP=$(git rev-parse origin/sprint2-architecture-contracts-d4cc2bf)
LOCAL_HEAD=$(git rev-parse HEAD)

STOP() { printf '%s\n' "subclassifier_result=blocked"; printf '%s\n' "blocked_reason=$1"; exit 3; }

if [ "$REMOTE_TIP" = "$EXPECTED_BASE_TIP" ]; then :; else STOP unexpected_remote_base_tip; fi
if [ -z "$(git status --porcelain --untracked-files=no)" ]; then :; else STOP tracked_worktree_not_clean; fi
if [ "$LOCAL_HEAD" = "$EXPECTED_LOCAL_HEAD" ]; then :; else STOP local_head_not_expected_base; fi
if git log --oneline -n 80 | grep -q "Merge PR #355"; then :; else STOP pr355_merge_not_present; fi

printf '%s\n' "verified_base_tip=$REMOTE_TIP"
printf '%s\n' "local_head=$LOCAL_HEAD"

CLASSIFIER_TMP=$(mktemp -t retry_subclassifier_XXXXXX.cjs)
printf '%s' '<RETRY_CLASSIFIER_B64>' | base64 -d > "$CLASSIFIER_TMP"

# Hazard guards: build fence and bang patterns via printf octals so the operator body
# itself contains no Markdown fence and no bang character (\140 = backtick, \041 = bang).
FENCE=$(printf '\140\140\140')
BANG=$(printf '\041')
if grep -q "$FENCE" "$CLASSIFIER_TMP"; then rm -f "$CLASSIFIER_TMP"; STOP classifier_payload_contains_markdown_fence; fi
if grep -q "$BANG" "$CLASSIFIER_TMP"; then rm -f "$CLASSIFIER_TMP"; STOP classifier_payload_contains_interactive_shell_hazard; fi

CAPTURE_ID="$CAPTURE_ID" node "$CLASSIFIER_TMP"
CLS_STATUS=$?

rm -f "$CLASSIFIER_TMP"
if [ "$CLS_STATUS" = "0" ]; then :; else STOP classifier_nonzero_exit; fi
```

Notes:
- The classifier is written to a temp file from base64 and removed after the single run
  (`subclassifier_execution_count=1`).
- The fence-guard (`grep -q` for a fence) trips
  `classifier_payload_contains_markdown_fence` before any execution if the decoded payload
  is contaminated.
- The classifier prints `verified_base_tip` / `local_head` (passed in via env or recomputed
  internally) plus the §5 labels; the operator body above prints **no** capture content.

---

## 7. Review-Only Classifier Skeleton (illustrative; not a runnable payload in this PR)

The reviewed classifier source (from which `<RETRY_CLASSIFIER_B64>` is generated at
execution time) must: resolve the capture pair for `CAPTURE_ID` **internally**; read the
pair **inside the process**; classify into exactly one allowed category; print **only**
the §5 safe labels. It must contain **no bang character**, must **never** print the raw
bytes, the resolved paths, a pointer, an exact line, a stack trace, or exception text.
Negation uses `=== false` / `indexOf(...) === -1` (no bang) to honour the no-bang rule.

```text
// review-only skeleton — generated to base64 at execution time, under a separate GO.
// Reads the capture pair INTERNALLY; prints ONLY safe labels; no bang character used.
const ALLOWED = [
  'missing_dependency',
  'node_runtime_incompatibility',
  'tsx_typescript_execution_failure',
  'esm_import_path_or_extension_mismatch',
  'module_export_import_mismatch',
  'type_only_import_runtime_issue',
  'build_artifact_or_transpile_failure',
  'unknown_runtime_dependency_or_build_failure',
];

function classifyInternally(captureId) {
  // Resolve + read the private capture pair INSIDE this process only.
  // Derive a single category token from internal signal checks.
  // Returns one ALLOWED token, or 'none_not_classified' when it cannot map cleanly.
  // The raw bytes never leave this function as output.
  return 'unknown_runtime_dependency_or_build_failure'; // illustrative default
}

const captureId = process.env.CAPTURE_ID;
let result = 'classified';
let category = 'none_not_classified';
try {
  const c = classifyInternally(captureId);
  const ok = ALLOWED.indexOf(c) > -1;
  if (ok === true) { category = c; } else { result = 'blocked'; }
} catch (e) {
  // Do not print the exception text / stack trace.
  result = 'blocked';
}

const onlyAllowlisted = (category === 'none_not_classified') || (ALLOWED.indexOf(category) > -1);
const lines = [
  'capture_id=' + captureId,
  'subclassifier_execution_attempted=true',
  'subclassifier_execution_count=1',
  'subclassifier_result=' + result,
  'subclassifier_category=' + category,
  'raw_output_printed=false',
  'raw_output_read_outside_classifier=false',
  'private_capture_paths_printed=false',
  'private_capture_pointer_printed=false',
  'exact_error_line_printed=false',
  'stack_trace_printed=false',
  'exception_text_printed=false',
  'only_allowlisted_category_printed=' + (onlyAllowlisted === true ? 'true' : 'false'),
  'fix_executed=false',
  'worker_rerun_executed=false',
  'risk_evidence_run_executed=false',
  'risk_evidence_record_only_rerun_executed=false',
  'sql_psql_executed=false',
  'db_mutation_executed=false',
  'deploy_executed=false',
  'lane_scoring_ams_customer_gate_executed=false',
  'gate4e_executed=false',
  'gate4f_executed=false',
];
process.stdout.write(lines.join('\n') + '\n');
```

This skeleton is **review-only**. It is **not** base64-encoded or executed in this PR, and
the `classifyInternally` body is a placeholder — the real signal logic is authored and
reviewed as part of the separate execution GO.

---

## 8. Preflight Stop-Lines (the future execution must abort on any)

```text
unexpected_remote_base_tip
tracked_worktree_not_clean
local_head_not_expected_base
pr355_merge_not_present
private_capture_pair_not_found_without_path_printing
private_capture_pair_read_failed_inside_classifier
classifier_payload_contains_interactive_shell_hazard
classifier_payload_contains_markdown_fence
classifier_would_emit_non_allowlisted_category
```

On any stop-line: emit `subclassifier_result=blocked` (safe labels only, no raw value),
record a blocked/stop evidence PR, and take **no** fix/rerun/raw-read without separate
review/GO.

---

## 9. Explicitly Forbidden (this command pack and its future execution)

```text
reading/cat/grep/copy/summarizing run.err or run.safe.out outside classifier
printing private capture paths
printing pointer contents
rerunning failed sub-classifier
rerunning existing classifier
rerunning worker
running risk-evidence:run
running risk-evidence:record-only
SQL/psql
DB mutation
deploy
fix/remediation
package/source/scripts/config/runtime/DSN/secret edits
Lane/scoring/AMS/customer/Gate4E/F
```

---

## 10. Next-Gate Decision Tree

```text
If this command pack is reviewed and merged:
  a future separate explicit GO may authorize exactly one safer allowlisted sub-classifier retry using this pack.

If the retry returns a narrow allowed category:
  create docs-only sub-classifier evidence PR.
  then consider separate minimal-fix planning PR.

If the retry is blocked or inconclusive:
  create blocked/inconclusive evidence PR or stop.

If raw output would be required:
  stop; do not read raw output.
```

**No** sub-classifier execution, classifier rerun, worker rerun, capture rerun, fix, or
downstream/Gate action is authorized by this PR.

---

## 11. Safety Boundaries (this command-pack PR)

- **Docs-only, review-only.** No command in this pack is executed by this PR.
- No read/`cat`/`grep`/copy/summarize of `run.err` / `run.safe.out`.
- No private capture path / pointer inspection.
- No sub-classifier run; no failed-/existing-classifier rerun; no worker rerun.
- No `risk-evidence:run`; no `risk-evidence:record-only`.
- No SQL/psql; no DB mutation; no deploy; no fix.
- No edit to package/source/scripts/config/runtime/DSN/secret files.
- No Lane / scoring / AMS / customer / Gate 4E / Gate 4F action.

---

## 12. Explicit Non-Authorization

**Merging this command pack authorizes:**
- **no** sub-classifier execution;
- **no** classifier rerun;
- **no** worker rerun;
- **no** capture rerun;
- **no** raw-output read;
- **no** SQL/psql or DB access;
- **no** fix/remediation;
- **and no** downstream / Lane / scoring / AMS / customer / Gate 4E / Gate 4F action.

The future single allowlisted sub-classifier retry requires its **own** fresh explicit GO,
including generating `<RETRY_CLASSIFIER_B64>` from the reviewed §7 source and filling
`<EXPECTED_BASE_TIP>` / `<EXPECTED_LOCAL_HEAD>` with the then-current SHAs. The exact raw
runtime error line remains `unknown` and **must not be inferred**.

---

## 13. Safety / Raw-Data Boundary

This record contains no raw runtime output, no `run.err` / `run.safe.out` content, no raw
runtime error line, no stack trace, no exception text, no private capture path/pointer
value, no base64-encoded capture content, no DSN URI, connection string, password, token,
host, port, IP, URI, hostname, raw identifier, `accepted_events` payload, `canonical_jsonb`
value, raw PostgreSQL error, `pg_hba` content, raw SQL output, or customer data. This is a
docs-only, review-only command pack: it **runs nothing**, reads **no** raw output, narrows
**no** category, and emits **safe labels / category tokens / public git commit hashes
only**. The `<RETRY_CLASSIFIER_B64>` payload is **not** present here; it is generated from
the reviewed §7 source at execution time under a separate GO. The exact raw runtime error
line remains `unknown` and **must not be inferred**.
