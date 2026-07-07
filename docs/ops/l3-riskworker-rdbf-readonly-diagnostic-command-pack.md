# L3 Risk-Worker RDBF Read-Only Diagnostic — Command-Pack (Review-Only)

> **Docs-only, review-only.** This document defines the command-pack boundary and review checklist
> for the future risk-worker RDBF read-only L3 diagnostic planned in
> `docs/ops/l3-riskworker-rdbf-readonly-diagnostic-planning.md` (PR #379).
>
> **This PR authorizes no execution.** It does not run the diagnostic, does not access production,
> does not read runtime output, does not run any worker/classifier/risk-evidence/record-only
> command, does not perform SQL/psql or DB/network action, and does not infer runtime cause. It is a
> reviewable specification only. Actual execution requires this command-pack to be reviewed and its
> parent planning merged, followed by a **separate exact operator GO**.
>
> **Risk-worker sealed state (preserved, unchanged):** broad category
> `runtime_dependency_or_build_failure`; subclassifier retry result `blocked / none_not_classified`;
> `likely_failure_surface = unknown`; **no runtime-cause inference**. This document neither reads,
> executes, nor infers any risk-worker runtime state and does not narrow the failure surface.

---

## STATUS: `L3_RISKWORKER_RDBF_READONLY_DIAGNOSTIC_COMMAND_PACK_REVIEW_ONLY`

---

## 1. Exact diagnostic objective

Define — for future review and later exact-GO execution — a **strictly read-only** L3 diagnostic
whose only purpose is to observe whether the production risk-worker surface is in a state consistent
with the sealed broad category `runtime_dependency_or_build_failure`, and to emit a **safe-labelled**
status only.

The objective explicitly is **not**:

- to run the risk-worker, a classifier, risk-evidence, or a record-only rerun;
- to read raw runtime output, `run.err`, `run.safe.out`, or private captures;
- to infer, narrow, or resolve `likely_failure_surface` (it remains `unknown`);
- to perform any fix, mutation, deploy, or configuration change.

Outcome is one of `RESULT_OK` / `RESULT_BLOCKED` / `RESULT_INCONCLUSIVE`, carried as a safe label.
`RESULT_INCONCLUSIVE` is an expected and acceptable outcome and does not authorize escalation.

---

## 2. Exact future GO phrase

- Exact GO phrase (placeholder): **`HELEN GO: RISKWORKER RDBF READ-ONLY DIAGNOSTIC L3 EXECUTE`**
- No execution is authorized until the operator sends this **exact** phrase for this **exact**
  operation, after this command-pack is reviewed and the parent planning PR (#379) is merged.

---

## 3. Ambiguous / partial GO invalid rule

- A partial, paraphrased, ambiguous, reordered, or scope-mismatched GO is **invalid** and must be
  treated as "no GO".
- A GO that references a different operation, a different scope, or an execution step not enumerated
  in the **Allowed read-only action envelope** is invalid.
- When in doubt, stop and re-request an exact GO. Silence or approximation is never a GO.

---

## 4. Operator preconditions

- [ ] Parent planning PR #379 merged.
- [ ] This command-pack reviewed and approved (see Section 15 checklist).
- [ ] Operator identity confirmed; least-privilege, **read-only** operator scope.
- [ ] `static-guardrails` green on the relevant branch (L1/static bundle passing).
- [ ] Custody / secret readiness confirmed **without printing any secret** (presence/permission only).
- [ ] Exact GO phrase received and verified against Section 2.

---

## 5. Clean-tree / head-pinned requirements

- [ ] Worktree clean: `git status` reports no uncommitted changes.
- [ ] Head pinned: execution runs against a specific, recorded head SHA on
      `sprint2-architecture-contracts-d4cc2bf` at or after `4c5f7cf67154fdc00a235b9af3ed5b1672051bf5`.
- [ ] Base/tip verified before any action; mismatch → fail closed (Section 8).
- [ ] No detached/ambiguous checkout; the exact SHA under diagnosis is logged as a safe label.

---

## 6. Production path boundary

- Any production server label, host, path, or endpoint is a **placeholder only** in this document
  (`<production-surface-placeholder>`), unless the value is already public and non-sensitive.
- No DSNs, hosts, ports, usernames, passwords, tokens, private keys, connection components, or
  private capture paths appear here. They must not be added.
- Concrete targets, if any, are supplied at execution time through the reviewed command pack and
  custody boundary — never committed to git and never printed.

---

## 7. Secret / custody discipline

- No secrets in git.
- No secrets in chat.
- No secrets in command argv.
- No secrets in logs.
- No DSN printing (never echo `DATABASE_URL`, `*_DSN`, connection strings, or any component).
- Hidden input only if a secret must be provided interactively (never on the command line).
- Root-only / permissioned custody files if applicable (least-privilege owner).
- Custody write/read boundary: the read-only diagnostic performs **no custody write**; any custody
  read is presence/permission only, never value.

---

## 8. Allowed read-only action envelope

Narrow, read-only, operation-specific. Each maps to the reviewed command pack and is covered by the GO.

- [ ] One fail-closed preflight (branch/base/head-pin/clean-tree/read-only-scope verification).
- [ ] Read-only inspection of the `<production-surface-placeholder>` sufficient to emit a
      safe-labelled status only — **no execution**, no worker/classifier/risk-evidence run, no
      record-only rerun, no SQL/psql.
- [ ] Emit safe labels/booleans/counts summarizing the diagnostic outcome.
- [ ] Cleanup: remove temp files, unset transient state, leave no residual secret material.

> ⚠️ **Examples are not authorization.** Shapes such as "read-only server inspection" or "one auth
> preflight" describe the *kind* of action permitted. Only the filled-in, reviewed, GO-covered list
> above authorizes anything, and only for this exact read-only operation.

---

## 9. Forbidden actions

Forbidden unless separately planned, reviewed, and covered by a distinct exact GO — none are planned
for this read-only diagnostic:

- [ ] No worker rerun / execution.
- [ ] No classifier execution.
- [ ] No risk-evidence run / record-only rerun.
- [ ] No SQL / psql.
- [ ] No DB / network action.
- [ ] No DB mutation.
- [ ] No secret / env read (values) or edit.
- [ ] No source / config / workflow / ruleset / checker / package / script / dependency / lockfile edit.
- [ ] No deploy.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate4E / Gate4F.
- [ ] No private capture path printing.
- [ ] No raw `run.err` / `run.safe.out` printing.
- [ ] No raw customer data (never).
- [ ] No runtime-cause inference; no narrowing of `likely_failure_surface` (remains `unknown`).
- [ ] No Phase C migration.

---

## 10. Safe output contract

Output is restricted to **labels, booleans, and counts only**.

| Output element | Allowed? |
| --- | --- |
| Safe labels (`PREFLIGHT_OK`, `INSPECT_DONE`, `RESULT_OK` / `RESULT_BLOCKED` / `RESULT_INCONCLUSIVE`) | Yes — required |
| Booleans (e.g. `clean_tree=true`, `head_pinned=true`) | Yes |
| Counts (e.g. `checks_passed=<n>`) | Yes |
| Raw runtime output | **No** |
| Exact raw error lines | **No** (sanitize/summarize to a label only) |
| Stack traces | **No** |
| SQL results | **No** |
| Private paths | **No** |
| Customer data | **No** |
| Secrets / DSNs | **No** |

- Evidence file / path permissions: least-privilege owner, restricted mode.
- Log retention: safe-labelled notes only; no raw payloads retained; delete transient material after
  the evidence note is written.

---

## 11. Fail-closed criteria

Abort immediately (fail closed, emit `RESULT_BLOCKED`, take no further action) on any of:

- Wrong branch / base / head SHA (not the pinned target).
- Dirty worktree.
- Missing expected PR / base SHA.
- Missing required env / custody file (presence check only).
- Ambiguous target.
- Unexpected output shape.
- Any command exits nonzero before safe labels are emitted.
- `static-guardrails` not green.
- Operator GO missing or mismatched (see Sections 2–3).
- Any secret / raw-data leakage risk detected.
- Any signal the inspection would cross into execution/mutation → stop immediately.

---

## 12. No-op / rollback boundary

- Is this operation read-only? **Yes.**
- Rollback plan: **N/A** — a read-only diagnostic makes no change; there is nothing to roll back.
- What counts as a no-op: environment state unchanged and no worker/classifier/risk-evidence ran; a
  preflight-only abort is also a no-op.
- How to stop safely: end after emitting safe labels; leave no temp files or residual secret material.
- Must **not** be retried without a new GO: any escalation to execution, SQL/psql, mutation, deploy,
  or any surface-inference step.

---

## 13. Evidence capture plan

- Expected evidence artifact: a safe-labelled diagnostic note (labels / booleans / counts +
  interpretation only).
- Expected safe labels: `PREFLIGHT_OK`, `INSPECT_DONE`, and one of
  `RESULT_OK` / `RESULT_BLOCKED` / `RESULT_INCONCLUSIVE`.
- The note must record the pinned head SHA (safe label) and reaffirm sealed state:
  `likely_failure_surface = unknown`.
- What gets committed afterward: the safe-labelled note in a **docs-only evidence PR**; no raw data.
- No execution result may be silently folded into a code PR.

---

## 14. Post-run interpretation rules

- **Success (`RESULT_OK`):** preflight passed, read-only inspection completed, safe labels emitted,
  no boundary crossed, sealed state preserved.
- **Blocked (`RESULT_BLOCKED`):** any fail-closed criterion tripped.
- **Inconclusive (`RESULT_INCONCLUSIVE`):** inspection completed but signal insufficient to
  characterize RDBF; surface remains `unknown`. Expected and acceptable; authorizes no escalation.
- **Allowed follow-up:** write/update the safe-labelled evidence note only.
- **Requires new planning PR / GO:** any worker/classifier/risk-evidence execution, record-only
  rerun, SQL/psql, mutation, deploy, or any attempt to infer/narrow the failure surface.
- No interpretation may assert a runtime cause; the sealed classification stands unchanged.

---

## 15. Negative-action ledger

Default expectation is **not performed**. To be confirmed per run (read-only diagnostic plans none of the mutating/executing rows):

- [ ] Runtime command — expected: not performed
- [ ] Server access — read-only inspection only (per Section 8)
- [ ] DB / network / SQL / psql — expected: not performed
- [ ] Env / secret read (values) or edit — expected: not performed (presence/permission only)
- [ ] Worker execution — expected: not performed
- [ ] Classifier execution — expected: not performed
- [ ] Risk-evidence execution — expected: not performed
- [ ] Record-only rerun — expected: not performed
- [ ] Deploy — expected: not performed
- [ ] Lane / scoring / AMS / customer output — expected: not performed
- [ ] Gate4E / Gate4F — expected: not performed
- [ ] Private capture access — expected: not performed
- [ ] `run.err` / `run.safe.out` access — expected: not performed
- [ ] Customer data — expected: not performed
- [ ] Source / config / workflow / ruleset / checker / package / script / dependency edit — expected: not performed
- [ ] DB mutation — expected: not performed
- [ ] Runtime-cause inference — expected: not performed
- [ ] Rollback action — expected: not performed (N/A, read-only)

---

## 16. Review checklist (pre-execution)

Reviewers must confirm before this command-pack may be used under a future GO:

- [ ] Objective is strictly read-only and matches Section 1.
- [ ] GO phrase (Section 2) and ambiguous/partial-GO-invalid rule (Section 3) are explicit.
- [ ] Preconditions, clean-tree, and head-pin requirements (Sections 4–5) are complete.
- [ ] Production path boundary uses placeholders only (Section 6); no sensitive values present.
- [ ] Secret/custody discipline (Section 7) forbids all secret/DSN exposure.
- [ ] Allowed action envelope (Section 8) is narrow, read-only, and carries the examples-not-authorization warning.
- [ ] Forbidden actions (Section 9) cover all execution/mutation/inference paths.
- [ ] Safe output contract (Section 10) permits labels/booleans/counts only.
- [ ] Fail-closed criteria (Section 11) trip on branch/tree/GO/leakage anomalies.
- [ ] No-op/rollback boundary (Section 12) confirms read-only.
- [ ] Evidence and interpretation rules (Sections 13–14) require a separate docs-only evidence PR.
- [ ] Sealed state preserved: `runtime_dependency_or_build_failure`; `blocked / none_not_classified`;
      `likely_failure_surface=unknown`; no runtime-cause inference.
- [ ] Merging this PR authorizes no execution; execution needs a separate exact GO.

---

## 17. Placeholder-only execution record template

> Skeletal template with **placeholders only**. Not a runnable command pack. No real commands, no
> secrets, no real DSNs, no hosts, no private paths.

```text
STATUS: L3_RISKWORKER_RDBF_READONLY_DIAGNOSTIC_COMMAND_PACK_REVIEW_ONLY
OPERATION: Risk-worker RDBF read-only diagnostic
BASE: sprint2-architecture-contracts-d4cc2bf @ <pinned head SHA >= 4c5f7cf>
GO RECEIVED: <exact GO phrase> (verified: yes/no)

PREFLIGHT:
  branch/base check ........ <PREFLIGHT_OK | RESULT_BLOCKED>
  head pinned .............. <head_pinned=true|false>
  clean worktree ........... <clean_tree=true|false>
  static-guardrails green .. <PREFLIGHT_OK | RESULT_BLOCKED>
  read-only scope .......... <PREFLIGHT_OK | RESULT_BLOCKED>
  custody presence ......... <PREFLIGHT_OK | RESULT_BLOCKED>   # presence only, no values

STEP 1 read-only inspection: <INSPECT_DONE | RESULT_BLOCKED>
  checks_passed ............ <n>

RESULT: <RESULT_OK | RESULT_BLOCKED | RESULT_INCONCLUSIVE>
SEALED STATE: likely_failure_surface=unknown (unchanged); no runtime-cause inference
SAFE LABELS ONLY: yes
RAW OUTPUT / ERRORS / STACKS / SQL RESULTS / PRIVATE PATHS / CUSTOMER DATA / SECRETS: none

NEGATIVE-ACTION LEDGER: see Section 15 (fill per run)
FOLLOW-UP: <in-scope safe-label note | requires new planning PR + GO>
```

---

_End of command-pack. Docs-only, review-only. Authorizes no execution. Risk-worker sealed state preserved._
