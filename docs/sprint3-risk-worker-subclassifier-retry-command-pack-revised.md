# Sprint 3 — Risk Worker Runtime-Dependency Sub-Classifier — Revised Command Pack (Review-Only)

**Status:** `RISK_WORKER_SUBCLASSIFIER_RETRY_COMMAND_PACK_REVISED_REVIEW_ONLY`

This is a **docs-only, review-only command pack**. It is the **revised** Option-A execution
artifact that fixes the PR #357 review blockers against the PR #356 pack, for **exactly
one** future allowlisted sub-classifier retry against the existing private capture
(`capture_id=risk_record_only_20260623T143244Z`). **This PR does not execute the command
pack and generates no payload.** The commands below are **recorded for review only** and run
**only later, under a separate explicit GO**.

This PR **executes nothing** and **authorizes no execution**: no command-pack run; no
payload generation or run; no read/`cat`/`grep`/copy/summarize of `run.err` / `run.safe.out`;
no private capture path/pointer inspection; no classifier rerun; no worker rerun; no
`risk-evidence:run`; no `risk-evidence:record-only`; no SQL/psql; no DB mutation; no deploy;
no fix; no edit to package/source/scripts/config/runtime/DSN/secret files; no
Lane/scoring/AMS/customer/Gate 4E/Gate 4F action. **The exact raw runtime error line remains
`unknown` and must not be inferred.**

---

## 1. Trusted Base

```text
sprint2-architecture-contracts-d4cc2bf
30a8d7581402df01a50786a7021af2f9a2298cd4
verified_base_tip=30a8d7581402df01a50786a7021af2f9a2298cd4
```

---

## 2. Evidence Carried Forward

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
runtime_cause_exact_line=unknown
likely_failure_surface=unknown
subclassifier_category=none_not_classified
```

---

## 3. PR #357 Blockers and How This Revision Fixes Them

| PR #357 blocker | Fix in this revision |
| --- | --- |
| §7 skeleton was illustrative placeholder (`classifyInternally` returned a hard-coded `unknown`; no capture located/read; no signals) | §7 here is a **real reviewed classifier**: it internally locates the capture pair, reads `run.err` / `run.safe.out` **inside the process only**, and derives **exactly one** allowlisted category from internal signal rules (§6). |
| STOP path emitted only `subclassifier_result=blocked` + `blocked_reason` | **Every** STOP / blocked path now emits the **full required safe-label set** (§5) via a single label emitter. |
| Server preflight insufficient/stale (no `cd`, no fresh fetch, stale origin ref, stale `PR #355` merge check, stale PR-#355 merge stop-line) | Preflight now `cd /opt/buyerrecon-backend`, runs a **fresh `git fetch`** before reading `origin/...`, verifies remote tip + local HEAD against execution-time expected SHAs, verifies the **current base / PR #357 merge** presence, and the stale PR-#355 merge stop-line is **renamed** to `current_base_merge_not_present`. |
| Exact substituted artifact/payload not verifiable | The payload remains a **named placeholder** `<RETRY_CLASSIFIER_B64>`, generated from the §7 reviewed source **only under the later GO**; no payload blob is embedded here. |

Shell-hazard protections from PR #356 are **preserved**: no Markdown fences in the operator
command body, zero literal bang characters in the operator command body, explicit `set +H`,
no bang-bearing JavaScript on an interactive line, base64-safe payload delivery.

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

## 5. Required Safe Labels — emitted on EVERY path (success AND every STOP/blocked)

```text
verified_base_tip=<current base tip at execution time>
local_head=<current local HEAD at execution time>
capture_id=risk_record_only_20260623T143244Z
subclassifier_execution_attempted=false or true as appropriate
subclassifier_execution_count=0 or 1 as appropriate
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

A **shell preflight STOP** emits this set with `subclassifier_execution_attempted=false`,
`subclassifier_execution_count=0`, `subclassifier_result=blocked`,
`subclassifier_category=none_not_classified`. A **classifier-internal block** (pair not
found / read failed) emits it with `subclassifier_execution_attempted=true`,
`subclassifier_execution_count=1`, `subclassifier_result=blocked`,
`subclassifier_category=none_not_classified`. No other output is permitted: no raw line, no
path, no pointer, no excerpt, no paraphrase of the captured error.

---

## 6. Classifier Internal Signal Rules (categorical; no capture-derived examples)

The classifier reads the capture pair **internally** and applies an **ordered** set of
signal rules to the in-process text, returning the **first** matching allowlisted category,
else the fallback. The rule descriptions below are **generic detection heuristics authored
independently of this capture** — they are **not** examples of the actual raw output, and no
real error line, stack frame, or private path appears here:

```text
missing_dependency                  -> internal raw text matches module/package "not found / cannot resolve" patterns
node_runtime_incompatibility        -> internal raw text matches Node engine/version/runtime-feature patterns
tsx_typescript_execution_failure    -> internal raw text matches tsx / TypeScript / tsconfig / TS-diagnostic patterns
esm_import_path_or_extension_mismatch -> internal raw text matches ESM / import-extension / module-loader patterns
module_export_import_mismatch       -> internal raw text matches export/import name-mismatch patterns
type_only_import_runtime_issue      -> internal raw text matches type-only-import / runtime-value patterns
build_artifact_or_transpile_failure -> internal raw text matches dist / build / transpile / artifact patterns
unknown_runtime_dependency_or_build_failure -> fallback when no narrower allowlisted category is safely derived
```

Ordering note: the rules are evaluated most-specific-first so that, e.g., an ESM
extension-mismatch is not mis-bucketed as a generic missing dependency. Only the resulting
**category token** ever leaves the process.

---

## 7. Reviewed Classifier Source (review-only; base64-encoded only under the later GO)

The reviewed classifier below: resolves the capture directory for `CAPTURE_ID`
**internally** from a configured capture root; reads `run.err` and `run.safe.out`
**inside the process only**; applies the §6 ordered signal rules; prints **only** the §5
safe labels. It contains **no bang character** (negation uses `=== false` / `indexOf(...) >
-1` / `.test(...) === true`), and it **never** prints the raw bytes, the resolved path, a
pointer, an exact line, a stack trace, or exception text. It is **not** base64-encoded or
executed in this PR; `<RETRY_CLASSIFIER_B64>` is generated from this source **only** under
the later execution GO.

```text
// review-only reviewed classifier — base64-encoded only under the later GO.
// Reads the capture pair INTERNALLY; prints ONLY safe labels; no bang character used.
const fs = require('fs');
const path = require('path');

const CAPTURE_ID = process.env.CAPTURE_ID;
const VERIFIED_BASE_TIP = process.env.VERIFIED_BASE_TIP === undefined ? '' : process.env.VERIFIED_BASE_TIP;
const LOCAL_HEAD = process.env.LOCAL_HEAD === undefined ? '' : process.env.LOCAL_HEAD;

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

// Ordered, most-specific-first. Generic heuristics — NOT capture-derived examples.
const RULES = [
  { cat: 'esm_import_path_or_extension_mismatch', re: /err[_a-z]*module|unknown file extension|importing extension|esm|loader/i },
  { cat: 'module_export_import_mismatch',         re: /does not provide an export|named export|no matching export/i },
  { cat: 'type_only_import_runtime_issue',        re: /type-only|import type|is a type and cannot be used as a value/i },
  { cat: 'tsx_typescript_execution_failure',      re: /tsx|tsconfig|typescript|ts[0-9]{3,}/i },
  { cat: 'build_artifact_or_transpile_failure',   re: /dist\/|transpile|build output|emit|artifact/i },
  { cat: 'node_runtime_incompatibility',          re: /engine|node version|unsupported|requires node|runtime feature/i },
  { cat: 'missing_dependency',                    re: /cannot find module|module not found|cannot resolve|missing dependency/i },
];

function resolveCaptureDir(captureId) {
  // Resolve the private capture directory from configured roots; never print the path.
  const roots = [process.env.RISK_CAPTURE_ROOT].filter(function (v) { return typeof v === 'string' && v.length > 0; });
  for (const root of roots) {
    const dir = path.join(root, captureId);
    const errExists = fs.existsSync(path.join(dir, 'run.err'));
    const safeExists = fs.existsSync(path.join(dir, 'run.safe.out'));
    if (errExists === true && safeExists === true) { return dir; }
  }
  return null;
}

function emitLabels(result, category, attempted, count) {
  const onlyAllowlisted = (category === 'none_not_classified') || (ALLOWED.indexOf(category) > -1);
  const lines = [
    'verified_base_tip=' + VERIFIED_BASE_TIP,
    'local_head=' + LOCAL_HEAD,
    'capture_id=' + CAPTURE_ID,
    'subclassifier_execution_attempted=' + (attempted === true ? 'true' : 'false'),
    'subclassifier_execution_count=' + String(count),
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
}

function classify(text) {
  for (const rule of RULES) {
    if (rule.re.test(text) === true) { return rule.cat; }
  }
  return 'unknown_runtime_dependency_or_build_failure';
}

// Design: classifier-internal blocked paths emit the FULL safe-label set and exit 0
// (a complete, single emission). The shell treats exit 0 as "labels already emitted" and
// does NOT re-emit. Only a node exit BEFORE emitting labels (a crash) yields a nonzero
// status, which the shell turns into a single classifier_nonzero_exit emission.
const dir = resolveCaptureDir(CAPTURE_ID);
if (dir === null) {
  emitLabels('blocked', 'none_not_classified', true, 1); // private_capture_pair_not_found
  process.exit(0);
}

let text = '';
try {
  // Read the pair INSIDE the process only; the bytes never leave this function as output.
  const err = fs.readFileSync(path.join(dir, 'run.err'), 'utf8');
  const safe = fs.readFileSync(path.join(dir, 'run.safe.out'), 'utf8');
  text = err + '\n' + safe;
} catch (e) {
  // Do not print the exception text / stack trace.
  emitLabels('blocked', 'none_not_classified', true, 1); // private_capture_pair_read_failed
  process.exit(0);
}

const category = classify(text);
const result = (ALLOWED.indexOf(category) > -1) ? 'classified' : 'blocked';
emitLabels(result, (result === 'classified' ? category : 'none_not_classified'), true, 1);
```

This source is **review-only**; the generic regex heuristics are authored independently of
the capture and contain no real error line, stack frame, or private path.

---

## 8. Operator Command Body (review-only; run later only under a separate GO)

The operator command body below contains **no Markdown fence characters** and **no bang
character**. It runs after `set +H`. Placeholders `<RETRY_CLASSIFIER_B64>`,
`<EXPECTED_BASE_TIP>`, and `<EXPECTED_LOCAL_HEAD>` are filled at execution time from the
reviewed §7 source and the then-current SHAs. Every STOP path emits the full §5 label set
via `EMIT_BLOCKED`.

```text
set +H
set -u

EXPECTED_BASE_TIP=<EXPECTED_BASE_TIP>
EXPECTED_LOCAL_HEAD=<EXPECTED_LOCAL_HEAD>
CAPTURE_ID=risk_record_only_20260623T143244Z

EMIT_BLOCKED() {
  REASON=$1
  ATTEMPTED=$2
  COUNT=$3
  printf '%s\n' "blocked_reason=$REASON"
  printf '%s\n' "verified_base_tip=$REMOTE_TIP"
  printf '%s\n' "local_head=$LOCAL_HEAD"
  printf '%s\n' "capture_id=$CAPTURE_ID"
  printf '%s\n' "subclassifier_execution_attempted=$ATTEMPTED"
  printf '%s\n' "subclassifier_execution_count=$COUNT"
  printf '%s\n' "subclassifier_result=blocked"
  printf '%s\n' "subclassifier_category=none_not_classified"
  printf '%s\n' "raw_output_printed=false"
  printf '%s\n' "raw_output_read_outside_classifier=false"
  printf '%s\n' "private_capture_paths_printed=false"
  printf '%s\n' "private_capture_pointer_printed=false"
  printf '%s\n' "exact_error_line_printed=false"
  printf '%s\n' "stack_trace_printed=false"
  printf '%s\n' "exception_text_printed=false"
  printf '%s\n' "only_allowlisted_category_printed=true"
  printf '%s\n' "fix_executed=false"
  printf '%s\n' "worker_rerun_executed=false"
  printf '%s\n' "risk_evidence_run_executed=false"
  printf '%s\n' "risk_evidence_record_only_rerun_executed=false"
  printf '%s\n' "sql_psql_executed=false"
  printf '%s\n' "db_mutation_executed=false"
  printf '%s\n' "deploy_executed=false"
  printf '%s\n' "lane_scoring_ams_customer_gate_executed=false"
  printf '%s\n' "gate4e_executed=false"
  printf '%s\n' "gate4f_executed=false"
  exit 3
}

REMOTE_TIP=stale
LOCAL_HEAD=stale

if cd /opt/buyerrecon-backend; then :; else EMIT_BLOCKED wrong_working_directory false 0; fi

if git fetch origin sprint2-architecture-contracts-d4cc2bf; then :; else EMIT_BLOCKED git_fetch_failed false 0; fi

REMOTE_TIP=$(git rev-parse origin/sprint2-architecture-contracts-d4cc2bf)
LOCAL_HEAD=$(git rev-parse HEAD)

if [ "$REMOTE_TIP" = "$EXPECTED_BASE_TIP" ]; then :; else EMIT_BLOCKED unexpected_remote_base_tip false 0; fi
if [ -z "$(git status --porcelain --untracked-files=no)" ]; then :; else EMIT_BLOCKED tracked_worktree_not_clean false 0; fi
if [ "$LOCAL_HEAD" = "$EXPECTED_LOCAL_HEAD" ]; then :; else EMIT_BLOCKED local_head_not_expected_base false 0; fi
if [ "$REMOTE_TIP" = "$EXPECTED_BASE_TIP" ] && git log --oneline -n 80 | grep -q "Merge PR #357"; then :; else EMIT_BLOCKED current_base_merge_not_present false 0; fi

CLASSIFIER_TMP=$(mktemp -t retry_subclassifier_XXXXXX.cjs)
if printf '%s' '<RETRY_CLASSIFIER_B64>' | base64 -d > "$CLASSIFIER_TMP"; then :; else rm -f "$CLASSIFIER_TMP"; EMIT_BLOCKED classifier_payload_decode_failed false 0; fi

FENCE=$(printf '\140\140\140')
BANG=$(printf '\041')
if grep -q "$FENCE" "$CLASSIFIER_TMP"; then rm -f "$CLASSIFIER_TMP"; EMIT_BLOCKED classifier_payload_contains_markdown_fence false 0; fi
if grep -q "$BANG" "$CLASSIFIER_TMP"; then rm -f "$CLASSIFIER_TMP"; EMIT_BLOCKED classifier_payload_contains_interactive_shell_hazard false 0; fi

CAPTURE_ID="$CAPTURE_ID" VERIFIED_BASE_TIP="$REMOTE_TIP" LOCAL_HEAD="$LOCAL_HEAD" node "$CLASSIFIER_TMP"
CLS_STATUS=$?

rm -f "$CLASSIFIER_TMP"
if [ "$CLS_STATUS" = "0" ]; then :; else EMIT_BLOCKED classifier_nonzero_exit true 1; fi
```

Notes (single, unambiguous emission — exactly once on every path):
- `git fetch` is **fail-closed**: a fetch failure emits the full §5 blocked set
  (`git_fetch_failed`, `attempted=false`, `count=0`) and exits **before** any remote-tip read.
- The base64 decode is **fail-closed**: a decode failure removes the temp file, emits the
  full §5 blocked set (`classifier_payload_decode_failed`, `attempted=false`, `count=0`),
  and exits **before** any `node` execution.
- The classifier is written to a temp file from base64 and removed after the single run
  (`subclassifier_execution_count=1`).
- `EMIT_BLOCKED` prints the **full** §5 safe-label set on every preflight stop (with
  `attempted=false`, `count=0`) so no blocked path is under-specified.
- **Classifier ↔ shell contract:** the classifier's own internal blocked paths (pair not
  found / read failed) emit the **full** label set (`attempted=true`, `count=1`) and **exit
  0**. The shell treats **exit 0 as "labels already emitted"** and does **not** re-emit.
  `EMIT_BLOCKED classifier_nonzero_exit true 1` fires **only** when `node` exits **nonzero**,
  i.e. it crashed **before** emitting labels — guaranteeing the blocked label set is emitted
  **exactly once** on every path (no duplicate, no gap).

---

## 9. Preflight Stop-Lines (revised; current, not stale)

```text
wrong_working_directory
git_fetch_failed
unexpected_remote_base_tip
tracked_worktree_not_clean
local_head_not_expected_base
current_base_merge_not_present
classifier_payload_decode_failed
private_capture_pair_not_found_without_path_printing
private_capture_pair_read_failed_inside_classifier
classifier_payload_contains_interactive_shell_hazard
classifier_payload_contains_markdown_fence
classifier_would_emit_non_allowlisted_category
```

The stale PR-#355 merge stop-line is **removed/renamed** to
`current_base_merge_not_present` (checks the **PR #357 / current base** merge).

---

## 10. Explicitly Forbidden (this command pack and its future execution)

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

## 11. Next-Gate Decision Tree

```text
If this revised command pack is reviewed and merged:
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

## 12. Safety Boundaries (this command-pack PR)

- **Docs-only, review-only.** No command in this pack is executed by this PR.
- No payload generation or run.
- No read/`cat`/`grep`/copy/summarize of `run.err` / `run.safe.out`.
- No private capture path / pointer inspection.
- No classifier rerun; no worker rerun.
- No `risk-evidence:run`; no `risk-evidence:record-only`.
- No SQL/psql; no DB mutation; no deploy; no fix.
- No edit to package/source/scripts/config/runtime/DSN/secret files.
- No Lane / scoring / AMS / customer / Gate 4E / Gate 4F action.

---

## 13. Explicit Non-Authorization

**Merging this revised command pack authorizes:**
- **no** sub-classifier execution;
- **no** payload generation or run;
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

## 14. Safety / Raw-Data Boundary

This record contains no raw runtime output, no `run.err` / `run.safe.out` content, no raw
runtime error line, no exact-error example, no stack trace, no exception text, no private
capture path/pointer value, no generated base64 payload blob, no DSN URI, connection string,
password, token, host, port, IP, URI, hostname, raw identifier, `accepted_events` payload,
`canonical_jsonb` value, raw PostgreSQL error, `pg_hba` content, raw SQL output, or customer
data. The §6/§7 signal patterns are **generic detection heuristics authored independently of
the capture** — not examples of the actual output. This is a docs-only, review-only command
pack: it **runs nothing**, **generates no payload**, reads **no** raw output, narrows **no**
category, and emits **safe labels / category tokens / public git commit hashes only**. The
`<RETRY_CLASSIFIER_B64>` payload is **not** present here; it is generated from the reviewed
§7 source at execution time under a separate GO. The exact raw runtime error line remains
`unknown` and **must not be inferred**.
