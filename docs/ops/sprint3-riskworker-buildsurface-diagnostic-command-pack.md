# Sprint 3 — Risk-Worker `build_surface` Diagnostic Command-Pack (Review-Only)

> **Docs-only, review-only.** This document defines the command-pack boundary and review checklist
> for a **future controlled** `build_surface` investigation diagnostic, following the merged planning
> (PR #382), evidence (PR #381), command-pack (PR #380), RDBF planning (PR #379), and template
> (PR #378).
>
> **This PR authorizes nothing.** No execution, no diagnostic run, no worker/classifier/risk-evidence/
> record-only rerun, no SQL/psql, no DB/network, no customer-output/Gate action, no fix, no retry, no
> root-cause inference. It is a reviewable specification only. Execution requires this command-pack
> reviewed and merged, then a **separate exact operator GO**.
>
> **Sealed state preserved (unchanged):** broad category `runtime_dependency_or_build_failure`; prior
> subclassifier retry state `blocked / none_not_classified`; safe surface label from PR #381
> `likely_failure_surface = build_surface`; `runtime_cause_inference = false`. `build_surface` is a
> **safe-pattern-family label only, not a root-cause inference**.

---

## STATUS: `SPRINT3_RISKWORKER_BUILDSURFACE_DIAGNOSTIC_COMMAND_PACK_REVIEW_ONLY`

---

## 1. Exact diagnostic objective

Define — for future review and later exact-GO execution — a **strictly read-only / static** diagnostic
that distinguishes `build_surface` **sublabels** using safe signals only, **without asserting a root
cause**. The diagnostic classifies into exactly one candidate sublabel and stops.

Candidate sublabels (safe-pattern-family labels only):

- `build_artifact_missing_or_stale`
- `typescript_transpile_or_compile_surface`
- `tsx_ts_node_runtime_surface`
- `package_dependency_resolution_surface`
- `script_entrypoint_or_module_resolution_surface`
- `runtime_build_environment_mismatch`
- `ci_build_parity_surface`
- `unknown_build_surface`

The objective explicitly is **not**:

- to run the risk-worker, a classifier, risk-evidence, or a record-only rerun;
- to read or print raw logs, exact errors, stack traces, dependency-file contents, env values, DSNs,
  hosts, private paths, or customer data;
- to assert, infer, or narrow a runtime **root cause** (`runtime_cause_inference` stays `false`);
- to perform any fix, remediation, retry, mutation, deploy, or configuration change;
- to move any Gate.

The future diagnostic must output **only** safe labels, booleans, aggregate counts, and fail-closed
stop labels. A `unknown_build_surface` classification is an expected, acceptable outcome and
authorizes no escalation.

---

## 2. Exact future GO phrase

- Exact GO phrase (placeholder): **`HELEN GO: RISKWORKER BUILD-SURFACE SUBLABEL READ-ONLY DIAGNOSTIC L3 EXECUTE`**
- No execution is authorized until the operator sends this **exact** phrase for this **exact**
  operation, after this command-pack is reviewed and merged.

---

## 3. Ambiguous / partial GO invalid rule

- A partial, paraphrased, ambiguous, reordered, or scope-mismatched GO is **invalid** and must be
  treated as "no GO".
- A GO referencing a different operation, a different scope, or a step not enumerated in the
  **Allowed read-only / static action envelope** is invalid.
- When in doubt, stop and re-request an exact GO. Silence or approximation is never a GO.

---

## 4. Operator preconditions

- [ ] Parent planning PR #382 merged; evidence PR #381 merged.
- [ ] This command-pack reviewed and approved (see Section 16 checklist).
- [ ] Operator identity confirmed; least-privilege, **read-only** operator scope.
- [ ] `static-guardrails` green on the relevant branch (L1/static bundle passing).
- [ ] Custody / secret readiness confirmed **without printing any secret** (presence/permission only).
- [ ] Exact GO phrase received and verified against Section 2.

---

## 5. Clean-tree / head-pinned requirements

- [ ] Worktree clean: `git status` reports no uncommitted changes.
- [ ] Head pinned: execution runs against a specific, recorded head SHA on
      `sprint2-architecture-contracts-d4cc2bf` at or after `df7a7780a508beda08656816bc9f697bdc6f1912`.
- [ ] Base/tip verified before any action; mismatch → fail closed (Section 13).
- [ ] No detached/ambiguous checkout; the exact SHA under diagnosis is logged as a safe label.

---

## 6. Production path boundary

- Any production server label, host, path, or endpoint is a **placeholder only**
  (`<production-surface-placeholder>`), unless the value is already public and non-sensitive.
- No DSNs, hosts, ports, usernames, passwords, tokens, private keys, connection components, private
  capture paths, or dependency-file contents appear here. They must not be added.
- Concrete targets, if any, are supplied at execution time through the reviewed command pack and
  custody boundary — never committed to git and never printed.

---

## 7. Secret / custody discipline

- No secrets in git.
- No secrets in chat.
- No secrets in command argv.
- No secrets in logs.
- No DSN printing (never echo `DATABASE_URL`, `*_DSN`, connection strings, or any component).
- No env-value printing; presence/shape only.
- Hidden input only if a secret must be provided interactively (never on the command line).
- Root-only / permissioned custody files if applicable (least-privilege owner).
- The diagnostic is read-only/static and performs **no custody write**; any custody read is
  presence/permission only, never value.

---

## 8. Allowed read-only / static action envelope

Narrow, read-only/static, operation-specific. Each maps to the reviewed command pack and is covered by
the GO.

- [ ] One fail-closed preflight (branch/base/head-pin/clean-tree/read-only-scope verification).
- [ ] Static/read-only presence-and-shape checks that map each candidate sublabel to a
      boolean/count signal — e.g. build-artifact presence/staleness, transpile-config presence,
      tsx/ts-node invocation-shape presence, dependency-resolution status, entrypoint/module-resolution
      shape, build/runtime target-shape comparison, CI/build parity shape — **presence/shape only, never
      contents**.
- [ ] Classify into exactly one sublabel (Section 1) and stop at classification.
- [ ] Emit safe labels / booleans / aggregate counts / stop labels only.
- [ ] Cleanup: remove temp files, unset transient state, leave no residual secret material.

> ⚠️ **Examples are not authorization.** These shapes describe the *kind* of action permitted. Only
> the filled-in, reviewed, GO-covered list authorizes anything, and only for this exact read-only/
> static operation.

---

## 9. Forbidden actions

Forbidden unless separately planned, reviewed, and covered by a distinct exact GO — none are planned
for this read-only/static diagnostic:

- [ ] No execution / diagnostic run beyond the read-only/static envelope in Section 8.
- [ ] No worker rerun / execution.
- [ ] No classifier rerun / execution.
- [ ] No risk-evidence run / record-only rerun.
- [ ] No SQL / psql.
- [ ] No DB / network action.
- [ ] No DB mutation.
- [ ] No secret / env read (values) or edit.
- [ ] No source / config / workflow / ruleset / checker / package / script / dependency / lockfile edit.
- [ ] No deploy.
- [ ] No Lane / scoring / AMS / customer-output generation.
- [ ] No Gate D / Gate E / Gate4E / Gate4F movement.
- [ ] No private capture path printing.
- [ ] No raw `run.err` / `run.safe.out` printing.
- [ ] No raw logs, exact errors, stack traces, dependency-file contents, env values, DSNs, hosts, or
      private paths in output.
- [ ] No raw customer data (never).
- [ ] No fix / remediation / retry loop.
- [ ] No root-cause inference; `runtime_cause_inference` stays `false`.
- [ ] No Phase C migration.

---

## 10. Safe output contract

Output is restricted to **labels, booleans, aggregate counts, and fail-closed stop labels only**.

| Output element | Allowed? |
| --- | --- |
| Safe labels (`PREFLIGHT_OK`, `INVESTIGATE_DONE`, one sublabel from Section 1) | Yes — required |
| Booleans (e.g. `build_artifact_present=true/false`, `transpile_config_present=true/false`) | Yes |
| Aggregate counts (e.g. `signals_checked=<n>`, `signals_hit=<n>`) | Yes |
| Fail-closed stop labels (e.g. `RESULT_BLOCKED`, `stop_label=<reason-token>`) | Yes |
| Raw runtime output / raw logs | **No** |
| Exact raw error lines | **No** |
| Stack traces | **No** |
| SQL results | **No** |
| Dependency-file contents | **No** |
| Env values | **No** |
| Private paths | **No** |
| Customer data | **No** |
| Secrets / DSNs / hosts | **No** |
| Base64 blobs | **No** |

---

## 11. Explicit output ban

The future diagnostic must **never** print: raw runtime output, raw logs, exact raw errors, stack
traces, SQL results, customer data, dependency-file contents, env values, secrets, DSNs, hosts,
private paths, or base64 blobs. Any risk of such leakage is a fail-closed condition (Section 13).

---

## 12. No-op / rollback boundary

- Is this operation read-only/static? **Yes.**
- Rollback plan: **N/A** — a read-only/static diagnostic makes no change; there is nothing to roll back.
- What counts as a no-op: environment/repo state unchanged and no worker/classifier/risk-evidence ran;
  a preflight-only abort is also a no-op.
- How to stop safely: end after emitting safe labels; leave no temp files or residual secret material.
- Must **not** be retried without a new GO: any escalation to execution, SQL/psql, mutation, deploy,
  remediation, or Gate movement.

---

## 13. Fail-closed criteria

Abort immediately (fail closed, emit `RESULT_BLOCKED` + `stop_label`, take no further action) on any of:

- Wrong branch / base / head SHA (not the pinned target).
- Dirty worktree.
- Missing expected PR / base SHA.
- Missing required env / custody file (presence check only).
- Ambiguous target.
- Unexpected output shape.
- Any command exits nonzero before safe labels are emitted.
- `static-guardrails` not green.
- Operator GO missing or mismatched (see Sections 2–3).
- Any secret / raw-data / dependency-content / env-value leakage risk detected.
- Any signal the pass would cross into execution/mutation/remediation → stop immediately.

---

## 14. Evidence capture plan

- Expected evidence artifact: a safe-labelled diagnostic note (labels / booleans / aggregate counts +
  interpretation only).
- Expected safe labels: `PREFLIGHT_OK`, `INVESTIGATE_DONE`, one sublabel from Section 1, plus
  supporting booleans/counts, and `stop_label` if blocked.
- The note must record the pinned head SHA (safe label) and reaffirm sealed state and
  `runtime_cause_inference: false`.
- What gets committed afterward: the safe-labelled note in a **separate docs-only evidence PR**; no
  raw data.
- No execution result may be silently folded into a code PR.

---

## 15. Post-run interpretation rules

- **Success:** preflight passed, one read-only/static discrimination pass completed, exactly one
  sublabel emitted, no boundary crossed, sealed state and `runtime_cause_inference: false` preserved.
- **Blocked:** any fail-closed criterion tripped; `stop_label` records the reason token.
- **Inconclusive:** signals insufficient to discriminate → `unknown_build_surface`. Acceptable;
  authorizes no escalation.
- **Allowed follow-up:** write/update the safe-labelled evidence PR only.
- **Requires new planning PR + exact GO:** any remediation, worker/classifier/risk-evidence/
  record-only execution, SQL/psql, mutation, deploy, Gate D/E movement, or customer-output action.
- No interpretation may assert a runtime root cause; the sealed classification stands unchanged.

---

## 16. Negative-action ledger (this command-pack PR)

```yaml
execution_performed: false
diagnostic_run_performed: false
worker_rerun_performed: false
classifier_rerun_performed: false
record_only_rerun_performed: false
sql_or_psql_performed: false
db_network_action_performed: false
customer_output_or_gate_performed: false
gate_d_or_e_movement_performed: false
source_or_workflow_change_performed: false
checker_or_script_or_package_change_performed: false
dependency_or_lockfile_change_performed: false
fix_or_retry_loop_performed: false
root_cause_inference_performed: false
raw_runtime_output_in_doc: false
exact_raw_error_in_doc: false
stack_trace_in_doc: false
sql_result_in_doc: false
dependency_file_contents_in_doc: false
env_value_in_doc: false
customer_data_in_doc: false
secret_or_dsn_or_host_in_doc: false
private_path_in_doc: false
base64_blob_in_doc: false
```

---

## 17. Review checklist (pre-execution)

Reviewers must confirm before this command-pack may be used under a future GO:

- [ ] Objective is strictly read-only/static and matches Section 1; sublabels are safe-pattern-family labels.
- [ ] GO phrase (Section 2) and ambiguous/partial-GO-invalid rule (Section 3) are explicit.
- [ ] Preconditions, clean-tree, and head-pin requirements (Sections 4–5) are complete.
- [ ] Production path boundary uses placeholders only (Section 6); no sensitive values present.
- [ ] Secret/custody discipline (Section 7) forbids all secret/DSN/host/env-value exposure.
- [ ] Allowed envelope (Section 8) is narrow, read-only/static, with examples-not-authorization warning.
- [ ] Forbidden actions (Section 9) cover all execution/mutation/inference/Gate paths.
- [ ] Safe output contract (Section 10) and explicit output ban (Section 11) permit labels/booleans/counts/stop-labels only.
- [ ] No-op/rollback boundary (Section 12) confirms read-only/static.
- [ ] Fail-closed criteria (Section 13) trip on branch/tree/GO/leakage anomalies.
- [ ] Evidence and interpretation rules (Sections 14–15) require a separate docs-only evidence PR.
- [ ] Sealed state preserved: `runtime_dependency_or_build_failure`; `blocked / none_not_classified`;
      `build_surface` safe-pattern-family label; `runtime_cause_inference=false`.
- [ ] Gate D / Gate E boundary (Section 19) honored.
- [ ] Merging this PR authorizes no execution; execution needs a separate exact GO.

---

## 18. Placeholder-only execution record template

> Skeletal template with **placeholders only**. Not a runnable command pack. No real commands, no
> secrets, no real DSNs, no hosts, no private paths, no dependency-file contents.

```text
STATUS: SPRINT3_RISKWORKER_BUILDSURFACE_DIAGNOSTIC_COMMAND_PACK_REVIEW_ONLY
OPERATION: Risk-worker build_surface sublabel read-only diagnostic
BASE: sprint2-architecture-contracts-d4cc2bf @ <pinned head SHA >= df7a778>
GO RECEIVED: <exact GO phrase> (verified: yes/no)

PREFLIGHT:
  branch/base check ........ <PREFLIGHT_OK | RESULT_BLOCKED>
  head pinned .............. <head_pinned=true|false>
  clean worktree ........... <clean_tree=true|false>
  static-guardrails green .. <PREFLIGHT_OK | RESULT_BLOCKED>
  read-only scope .......... <PREFLIGHT_OK | RESULT_BLOCKED>
  custody presence ......... <PREFLIGHT_OK | RESULT_BLOCKED>   # presence only, no values

STEP 1 static discrimination pass: <INVESTIGATE_DONE | RESULT_BLOCKED>
  signals_checked .......... <n>
  signals_hit .............. <n>
  <sublabel boolean signals: true/false only>

RESULT_SUBLABEL: <one of Section 1 sublabels>
STOP_LABEL: <none | reason-token>
SEALED STATE: build_surface (unchanged); runtime_cause_inference=false
SAFE LABELS ONLY: yes
RAW OUTPUT / ERRORS / STACKS / SQL / DEP-CONTENTS / ENV / PRIVATE PATHS / CUSTOMER DATA / SECRETS: none

NEGATIVE-ACTION LEDGER: see Section 16 (fill per run)
FOLLOW-UP: <in-scope safe-label evidence PR | requires new planning PR + GO>
```

---

## 19. Gate D / Gate E boundary statement

- **Gate D and Gate E remain blocked** where dependent on the risk-worker, risk evidence, scoring
  readiness, customer output, or production validation.
- **This command-pack PR authorizes no Gate D / Gate E movement** and no downstream customer-facing
  action.
- Any Gate D / Gate E movement must be **separately proven independent** of the sealed risk-worker
  state, or **separately authorized** under its own planning + exact GO.
- No `build_surface` sublabel outcome unblocks any Gate or implies scoring/customer-output readiness.

---

_End of command-pack. Docs-only, review-only. Authorizes no execution, fix, retry, Gate D/E, or customer-output action. Sealed state preserved._
