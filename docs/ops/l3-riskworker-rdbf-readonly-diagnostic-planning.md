# L3 Production Validation Planning — Risk-Worker RDBF Read-Only Diagnostic

> **Docs-only planning document.** Instantiated from
> `docs/templates/l3-production-validation-planning-template.md`. This document authorizes **no
> execution**. Filling it in does not authorize any L3 action. Execution requires a separate,
> explicit, exact operator GO after this planning PR is reviewed and merged.
>
> **Non-authorization:** Nothing here — including examples — authorizes production access,
> DB/network/SQL/psql, secret/env reads or edits, worker/classifier/risk-evidence execution,
> deploy, Lane/scoring/AMS/customer-output generation, Gate4E/Gate4F, private capture access, or
> `run.err` / `run.safe.out` access.
>
> **Risk-worker sealed state (preserved).** This document performs **no runtime read, no execution,
> and no inference** on risk-worker state. The sealed classification is carried forward unchanged:
> broad category remains `runtime_dependency_or_build_failure`; subclassifier retry result remains
> `blocked / none_not_classified`; `likely_failure_surface = unknown`. This planning document does
> not infer, narrow, or resolve the failure surface.

---

## STATUS: `L3_PRODUCTION_VALIDATION_PLANNING_ONLY`

---

## 1. Title

**L3 Production Validation Planning — Risk-Worker RDBF Read-Only Diagnostic**

---

## 2. Status field

- `STATUS: L3_PRODUCTION_VALIDATION_PLANNING_ONLY`
- Planning-PR state: `draft` (to be updated by review)
- Execution state: `not-authorized` (default; only an exact operator GO changes this)

---

## 3. Target operation summary

| Field | Value |
| --- | --- |
| Operation name | Risk-worker RDBF read-only diagnostic |
| Target system | Production risk-worker surface (read-only inspection only) |
| Target branch / base SHA | `sprint2-architecture-contracts-d4cc2bf` @ `<base SHA at execution planning time>` |
| Target server / path (if applicable) | `<server label>` — read-only inspection only; no private capture paths named here |
| Why L1/L2 cannot prove the claim | The sealed broad category `runtime_dependency_or_build_failure` and `likely_failure_surface = unknown` are properties of the real production runtime/build environment. Static (L1) checks and non-production integration (L2) cannot observe the production runtime dependency/build state, so neither can confirm or refine the sealed classification. |
| Operation category | **diagnostic** (read-only) |

> This is a **read-only diagnostic**. It does not run the worker, run a classifier, run
> risk-evidence, or perform a record-only rerun. It does not infer the failure surface; the surface
> remains `unknown` regardless of diagnostic outcome unless a separate planning PR + GO authorizes
> further work.

---

## 4. Layer classification

- **Layer: L3 (production verification).** Explicitly marked L3.
- **Production-touching boundary involved:** read-only inspection of the production risk-worker
  environment (server/runtime-dependency/build presence check). No execution boundary is crossed.
- **Why this cannot be hidden inside a normal code PR:** any inspection of the production
  risk-worker surface touches the production server/runtime environment, carries leakage and
  scope-creep risk, and requires explicit human authorization plus narrow scoping with safe
  labels/evidence only. A normal code PR is L1/static; performing this inspection inside one would
  be a prohibited silent escalation.

---

## 5. Preconditions

All must be satisfied and recorded before any GO is requested.

- [ ] Required merged PRs: PR #378 (L3 planning template) merged.
- [ ] Required base tip: `<base SHA>` is the tip of `sprint2-architecture-contracts-d4cc2bf`.
- [ ] Required clean worktree (server/repo involved): `git status` reports no uncommitted changes.
- [ ] Required `static-guardrails` green on the relevant branch (L1/static bundle passing).
- [ ] Required custody / secret readiness confirmed **without printing any secret** (presence/permission only).
- [ ] Required operator identity / permission boundary confirmed: least-privilege, read-only operator scope.
- [ ] Required backups / rollback readiness: **N/A — operation is read-only** (see Section 13).

---

## 6. Explicit GO phrase

- Exact GO phrase (placeholder): **`HELEN GO: RISKWORKER RDBF READ-ONLY DIAGNOSTIC L3 EXECUTE`**
- No execution is authorized until the operator sends the **exact** GO phrase for this exact operation.
- A partial, paraphrased, ambiguous, or scope-mismatched GO is **invalid** and must be treated as
  "no GO". When in doubt, stop and re-request an exact GO.
- The GO authorizes only the read-only actions enumerated in **Allowed actions** — nothing beyond them.

---

## 7. Command-pack boundary

- The exact command pack must be **attached to or referenced by** this document (fenced block or
  committed script-file path) before any GO.
- Commands must be copy/paste-ready or script-file-ready — no improvisation at execution time.
- The command pack must **avoid secrets in argv and output** (no DSNs, tokens, credentials).
- The command pack must **avoid raw customer data** in output.
- The command pack must include a **fail-closed preflight** (verify branch/base/worktree/env
  presence, and read-only operator scope, before anything else; abort on mismatch).
- The command pack must emit **safe labels** (e.g. `PREFLIGHT_OK`, `INSPECT_DONE`,
  `RESULT_INCONCLUSIVE`) rather than raw payloads.
- The command pack must include **exit-code handling** (stop on nonzero before success labels).
- The command pack must include **cleanup behavior** (remove temp files, unset transient state,
  leave no residual secret material).

> This document intentionally contains **no** executable production commands. The read-only command
> pack is authored and reviewed separately before any GO.

---

## 8. Secret / custody discipline

- No secrets in git.
- No secrets in chat.
- No secrets in command argv.
- No secrets in logs.
- No DSN printing (never echo `DATABASE_URL`, `*_DSN`, connection strings, or any component).
- Hidden input only if a secret must be provided interactively (never on the command line).
- Root-only / permissioned files if applicable (custody files restricted to least-privilege owner).
- Custody write/read boundaries: read-only diagnostic performs **no custody write**; any custody
  read is presence/permission only, never value.

---

## 9. Allowed actions

Narrow, read-only, operation-specific. Each maps to the command pack and is covered by the GO.

- [ ] One fail-closed preflight (branch/base/worktree/scope verification).
- [ ] Read-only inspection of the production risk-worker surface sufficient to report a safe-labelled
      status only (no execution, no worker/classifier run, no risk-evidence run, no record-only rerun).
- [ ] Emit safe labels summarizing the diagnostic outcome.

**Example categories (NOT authorization — illustrative only):**

- read-only server inspection
- one auth preflight

> ⚠️ The example categories above are examples of *shapes* of allowed actions. They are **not**
> authorization. Only the filled-in, reviewed, GO-covered list authorizes anything, and only for
> this exact read-only operation.

---

## 10. Forbidden actions

Forbidden unless each is **explicitly planned here, reviewed, and covered by the exact GO** — and for
this read-only diagnostic, none of the mutating/executing actions below are planned:

- [ ] No unplanned worker rerun. (Not planned for this operation.)
- [ ] No unplanned classifier execution. (Not planned.)
- [ ] No unplanned risk-evidence run / record-only rerun. (Not planned.)
- [ ] No unplanned SQL / psql. (Not planned.)
- [ ] No DB mutation unless explicitly planned. (Not planned.)
- [ ] No secret / env edit unless explicitly planned. (Not planned.)
- [ ] No source / config edit unless explicitly planned. (Not planned.)
- [ ] No deploy unless explicitly planned. (Not planned.)
- [ ] No Lane / scoring / AMS / customer output unless explicitly planned. (Not planned.)
- [ ] No Gate4E / Gate4F unless explicitly planned. (Not planned.)
- [ ] No private capture path printing unless explicitly planned and safe. (Not planned.)
- [ ] No raw `run.err` / `run.safe.out` printing unless explicitly planned and safe. (Not planned.)
- [ ] No raw customer data (never).
- [ ] No inference of `likely_failure_surface` (remains `unknown`).

---

## 11. Safe output contract

| Output element | Allowed? |
| --- | --- |
| Required safe labels | Yes — required (`PREFLIGHT_OK`, `INSPECT_DONE`, `RESULT_OK`, `RESULT_BLOCKED`, `RESULT_INCONCLUSIVE`) |
| Raw output | No |
| Exact error lines | No (sanitize/summarize instead) |
| Stack traces | No |
| Private paths | No |
| Customer data | No |
| Secrets / DSNs | No |

- Evidence file / path permissions: least-privilege owner, restricted mode.
- Log retention rules: safe-labelled diagnostic notes only; no raw payloads retained; delete transient
  material after the evidence doc is written.

---

## 12. Fail-closed criteria

Abort immediately (fail closed, emit `RESULT_BLOCKED`, take no further action) on any of:

- Wrong branch / base.
- Dirty worktree.
- Missing expected PR / base SHA.
- Missing required env / custody file.
- Ambiguous target.
- Unexpected output shape.
- Any command exits nonzero before safe labels are emitted.
- `static-guardrails` not green.
- Operator GO missing or mismatched.
- Any secret / raw-data leakage risk detected.
- Any signal that the inspection would cross into execution/mutation (immediately stop).

---

## 13. Rollback / no-op boundary

- Is this operation read-only? **Yes.**
- Rollback plan: **N/A** — read-only diagnostic makes no change; there is nothing to roll back.
- What counts as a no-op: the environment state is unchanged and no worker/classifier/risk-evidence
  ran; a preflight-only abort is also a no-op.
- How to stop safely: end after emitting safe labels; leave no temp files or residual secret material.
- What must **not** be retried without a new GO: any escalation to execution (worker/classifier/
  risk-evidence/record-only), any SQL/psql, any mutation, or any surface-inference step.

---

## 14. Evidence plan

- Expected evidence artifact: a safe-labelled diagnostic note (labels + interpretation only).
- Expected safe labels: `PREFLIGHT_OK`, `INSPECT_DONE`, and one of
  `RESULT_OK` / `RESULT_BLOCKED` / `RESULT_INCONCLUSIVE`.
- What gets committed afterward: the safe-labelled note in a **docs-only evidence PR**; no raw data.
- The evidence PR must reaffirm sealed state: `likely_failure_surface = unknown` unless a separate
  planning PR + GO authorizes further work.
- No execution result may be silently folded into a code PR.

---

## 15. Post-run interpretation

- **Success criteria:** preflight passed, read-only inspection completed, safe labels emitted, no
  boundary crossed, sealed state preserved.
- **Blocked criteria:** any fail-closed criterion tripped (e.g. wrong branch, GO mismatch, leakage risk).
- **Inconclusive criteria:** inspection completed but signal insufficient to characterize RDBF; surface
  remains `unknown`. (This is an expected and acceptable outcome.)
- **Failure criteria:** the operation could not complete read-only within scope.
- **Allowed follow-up:** update the sealed-state evidence note with safe labels only.
- **Follow-up requiring new planning PR / GO:** any worker/classifier/risk-evidence execution,
  record-only rerun, SQL/psql, mutation, deploy, or any attempt to infer/narrow the failure surface.

---

## 16. Negative-action ledger

Default expectation is **not performed**. To be confirmed per run (read-only diagnostic plans none of these):

- [ ] Runtime command — expected: not performed
- [ ] Server access — read-only inspection only (per Allowed actions)
- [ ] DB / network / SQL / psql — expected: not performed
- [ ] Env / secret read or edit — expected: not performed (presence/permission only, no values)
- [ ] Worker execution — expected: not performed
- [ ] Classifier execution — expected: not performed
- [ ] Risk-evidence execution — expected: not performed
- [ ] Deploy — expected: not performed
- [ ] Lane / scoring / AMS / customer output — expected: not performed
- [ ] Gate4E / Gate4F — expected: not performed
- [ ] Private capture access — expected: not performed
- [ ] `run.err` / `run.safe.out` access — expected: not performed
- [ ] Customer data — expected: not performed
- [ ] Source / config edit — expected: not performed
- [ ] DB mutation — expected: not performed
- [ ] Rollback action — expected: not performed (N/A, read-only)

---

## 17. Required review before execution

- This planning PR must be reviewed before it is merged.
- All blockers raised in review must be resolved before merge.
- **Merging this planning PR does not itself execute anything.** It is docs-only.
- Execution requires a **separate explicit GO** sent by the operator **after** this planning PR is
  merged, using the exact GO phrase from Section 6, and only for the exact read-only scope here.

---

## 18. Example minimal L3 execution record

> Skeletal example with **placeholders only**. Illustrative structure, not a runnable command pack.
> No real commands, no secrets, no real DSNs, no private paths.

```text
STATUS: L3_PRODUCTION_VALIDATION_PLANNING_ONLY
OPERATION: Risk-worker RDBF read-only diagnostic
BASE: sprint2-architecture-contracts-d4cc2bf @ <base SHA>
GO RECEIVED: <exact GO phrase> (verified: yes/no)

PREFLIGHT:
  branch/base check ........ <PREFLIGHT_OK | RESULT_BLOCKED>
  clean worktree ........... <PREFLIGHT_OK | RESULT_BLOCKED>
  static-guardrails green .. <PREFLIGHT_OK | RESULT_BLOCKED>
  read-only scope .......... <PREFLIGHT_OK | RESULT_BLOCKED>
  custody presence ......... <PREFLIGHT_OK | RESULT_BLOCKED>   # presence only, no values

STEP 1 read-only inspection: <INSPECT_DONE | RESULT_BLOCKED>

RESULT: <RESULT_OK | RESULT_BLOCKED | RESULT_INCONCLUSIVE>
SEALED STATE: likely_failure_surface=unknown (unchanged)
SAFE LABELS ONLY: yes
RAW OUTPUT / ERRORS / STACKS / PRIVATE PATHS / CUSTOMER DATA / SECRETS: none

NEGATIVE-ACTION LEDGER: see Section 16 (fill per run)
FOLLOW-UP: <in-scope safe-label note | requires new planning PR + GO>
```

---

_End of planning document. Docs-only. Authorizes no execution. Risk-worker sealed state preserved._
