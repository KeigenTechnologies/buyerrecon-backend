# L3 Production Validation Planning Template

> **Docs-only template.** This file is reusable planning/guidance boilerplate for future
> L3 production-validation planning PRs. It authorizes **no execution**. Copy this file into a
> dated planning document, fill in every `<...>` placeholder, and open it as its own planning PR.
> Filling in this template does **not** authorize any L3 action. Execution requires a separate,
> explicit, exact operator GO after the planning PR is reviewed and merged.
>
> **Non-authorization:** Nothing in this template — including its examples — authorizes production
> access, DB/network/SQL/psql, secret/env reads or edits, worker/classifier/risk-evidence
> execution, deploy, Lane/scoring/AMS/customer-output generation, Gate4E/Gate4F, private capture
> access, or `run.err` / `run.safe.out` access. Every such action requires its own explicit GO.

---

## STATUS: `<L3_STATUS_NAME_HERE>`

<!-- Example placeholder only: SPRINT3_5_L3_<OPERATION>_PLANNING. Do not treat as authorization. -->

---

## 1. Title

**L3 Production Validation Planning Template**

Instantiated title for this instance: `<L3 Production Validation Planning — {operation name}>`

---

## 2. Status field

- `STATUS: <L3_STATUS_NAME_HERE>`
- Planning-PR state: `<draft | in-review | approved-planning | merged-planning>`
- Execution state: `<not-authorized>` (default; only an exact operator GO changes this)

---

## 3. Target operation summary

| Field | Value |
| --- | --- |
| Operation name | `<operation name>` |
| Target system | `<target system — e.g. production API host, production DB role, worker runner>` |
| Target branch / base SHA | `<branch>` @ `<base SHA>` |
| Target server / path (if applicable) | `<server label / deploy path — no secrets, no private capture paths>` |
| Why L1/L2 cannot prove the claim | `<why static + non-prod integration are insufficient for this exact claim>` |
| Operation category | `<diagnostic | evidence-capture | deploy-verification | rollback-verification | Gate/customer-output-validation>` |

> Keep this summary factual and secret-free. Do not paste DSNs, hosts, ports, usernames,
> passwords, tokens, private keys, or connection components.

---

## 4. Layer classification

- **Layer: L3 (production verification).** This is explicitly marked L3.
- **Production-touching boundary involved:** `<name the exact boundary — e.g. production DB read,
  worker execution, deploy verification, Gate4E/Gate4F, customer-output surface>`
- **Why this cannot be hidden inside a normal code PR:** L3 touches production
  server / DB / credentials / real captures / worker or classifier execution / risk-evidence /
  SQL/psql / deploy / Lane/scoring/AMS/customer output / Gate4E/Gate4F. Such actions carry
  irreversible or customer-visible risk, require explicit human authorization, must be narrowly
  scoped, and must produce safe labels/evidence only. A normal code PR is L1/static; silently
  performing L2 or L3 work inside it is a prohibited escalation.

---

## 5. Preconditions

All preconditions must be satisfied and recorded before any GO is requested.

- [ ] Required merged PRs: `<list PR numbers / titles>`
- [ ] Required base tip: `<base SHA>` is the tip of `<base branch>`
- [ ] Required clean worktree (if server/repo involved): `git status` reports no uncommitted changes
- [ ] Required `static-guardrails` green on the relevant branch (L1/static bundle passing)
- [ ] Required custody / secret readiness confirmed **without printing any secret** (presence/permission only)
- [ ] Required operator identity / permission boundary confirmed: `<operator role / least-privilege scope>`
- [ ] Required backups / rollback readiness confirmed (if operation is not read-only)

---

## 6. Explicit GO phrase

- Exact GO phrase (placeholder): **`HELEN GO: <OPERATION> L3 EXECUTE`**
- No execution is authorized until the operator sends the **exact** GO phrase for this exact operation.
- A partial, paraphrased, ambiguous, or scope-mismatched GO is **invalid** and must be treated as
  "no GO". When in doubt, stop and re-request an exact GO.
- The GO authorizes only the actions enumerated in this document's **Allowed actions** section —
  nothing beyond them.

---

## 7. Command-pack boundary

- The exact command pack for this operation must be **attached to or referenced by** this planning
  document (as a fenced block or a committed script-file path).
- Commands must be copy/paste-ready or script-file-ready — no on-the-fly improvisation at execution time.
- The command pack must **avoid secrets in argv and output** (no DSNs, tokens, or credentials on the
  command line or in printed results).
- The command pack must **avoid raw customer data** in output.
- The command pack must include a **fail-closed preflight** (verify branch/base/worktree/env presence
  before doing anything else; abort on mismatch).
- The command pack must emit **safe labels** (e.g. `PREFLIGHT_OK`, `STEP_DONE`, `RESULT_BLOCKED`)
  rather than raw payloads.
- The command pack must include **exit-code handling** (stop on nonzero before emitting success labels).
- The command pack must include **cleanup behavior** (remove temp files, unset transient shell state,
  leave no residual secret material).

> This template intentionally contains **no** executable production commands. The command pack is
> authored per-operation in the instantiated planning document and reviewed before any GO.

---

## 8. Secret / custody discipline

- No secrets in git.
- No secrets in chat.
- No secrets in command argv.
- No secrets in logs.
- No DSN printing (never echo `DATABASE_URL`, `*_DSN`, connection strings, or any component).
- Hidden input only if a secret must be provided interactively (never on the command line).
- Root-only / permissioned files if applicable (custody files restricted to the least-privilege owner).
- Custody write/read boundaries if applicable: `<who may write custody, who may read, where it lives —
  described without values>`.

---

## 9. Allowed actions

Fill in the exact, narrow, operation-specific allowed actions. Each must map to the command pack and
be covered by the GO. Keep the list minimal.

- [ ] `<allowed action 1 — narrow and specific>`
- [ ] `<allowed action 2>`
- [ ] `<allowed action 3>`

**Example categories (NOT authorization — illustrative only):**

- read-only server inspection
- one auth preflight
- one worker run
- one classifier run
- one SQL read-only diagnostic
- one deploy verification

> ⚠️ The example categories above are examples of *shapes* of allowed actions. They are **not**
> authorization. Only the filled-in, reviewed, GO-covered list authorizes anything, and only for this
> exact operation.

---

## 10. Forbidden actions

The following are forbidden unless each is **explicitly planned in this document, reviewed, and
covered by the exact GO**:

- [ ] No unplanned worker rerun.
- [ ] No unplanned classifier execution.
- [ ] No unplanned risk-evidence run / record-only rerun.
- [ ] No unplanned SQL / psql.
- [ ] No DB mutation unless explicitly planned.
- [ ] No secret / env edit unless explicitly planned.
- [ ] No source / config edit unless explicitly planned.
- [ ] No deploy unless explicitly planned.
- [ ] No Lane / scoring / AMS / customer output unless explicitly planned.
- [ ] No Gate4E / Gate4F unless explicitly planned.
- [ ] No private capture path printing unless explicitly planned and safe.
- [ ] No raw `run.err` / `run.safe.out` printing unless explicitly planned and safe.
- [ ] No raw customer data (never, under any plan output — see Safe output contract).

---

## 11. Safe output contract

| Output element | Allowed? |
| --- | --- |
| Required safe labels | Yes — required (e.g. `PREFLIGHT_OK`, `RESULT_OK`, `RESULT_BLOCKED`, `RESULT_INCONCLUSIVE`) |
| Raw output | `<yes/no — default no; justify if yes>` |
| Exact error lines | `<yes/no — default no; sanitize/summarize instead>` |
| Stack traces | `<yes/no — default no>` |
| Private paths | `<yes/no — default no>` |
| Customer data | **No** by default |
| Secrets / DSNs | **No** |

- Evidence file / path permissions (if applicable): `<least-privilege owner, restricted mode>`
- Log retention rules (if applicable): `<retention window, storage location described without secrets,
  deletion policy>`

---

## 12. Fail-closed criteria

Abort immediately (fail closed, emit a `RESULT_BLOCKED` safe label, take no further action) on any of:

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

---

## 13. Rollback / no-op boundary

- Is this operation read-only? `<yes/no>`
- If **not** read-only, a rollback plan is **required**: `<exact rollback steps / restore point / backup reference>`
- What counts as a no-op: `<define the state where nothing was changed and it is safe to stop>`
- How to stop safely: `<the safe stop procedure — leave no partial mutation, no residual secret>`
- What must **not** be retried without a new GO: `<enumerate — any mutation, deploy, worker rerun, etc.>`

---

## 14. Evidence plan

- Expected evidence artifact: `<artifact name / type — safe-labelled only>`
- Expected safe labels: `<list of labels the artifact will contain>`
- What gets committed afterward: `<safe evidence doc content — labels and interpretation, no raw data>`
- A **docs-only evidence PR** is required after execution to record the outcome.
- No execution result may be silently folded into a code PR. Evidence lives in its own docs-only PR.

---

## 15. Post-run interpretation

- **Success criteria:** `<what safe labels / conditions constitute success>`
- **Blocked criteria:** `<what constitutes blocked — e.g. precondition/fail-closed trip>`
- **Inconclusive criteria:** `<what constitutes inconclusive — insufficient signal, ambiguous shape>`
- **Failure criteria:** `<what constitutes failure>`
- **Allowed follow-up:** `<follow-up that stays within this document's scope and GO>`
- **Follow-up requiring new planning PR / GO:** `<any escalation, retry-with-mutation, new boundary,
  or broadened scope>`

---

## 16. Negative-action ledger

Confirm, for the executed operation, whether each action occurred. Default expectation is **not
performed** unless explicitly planned and GO-covered.

- [ ] Runtime command — `<performed? yes/no>`
- [ ] Server access — `<performed? yes/no>`
- [ ] DB / network / SQL / psql — `<performed? yes/no>`
- [ ] Env / secret read or edit — `<performed? yes/no>`
- [ ] Worker execution — `<performed? yes/no>`
- [ ] Classifier execution — `<performed? yes/no>`
- [ ] Risk-evidence execution — `<performed? yes/no>`
- [ ] Deploy — `<performed? yes/no>`
- [ ] Lane / scoring / AMS / customer output — `<performed? yes/no>`
- [ ] Gate4E / Gate4F — `<performed? yes/no>`
- [ ] Private capture access — `<performed? yes/no>`
- [ ] `run.err` / `run.safe.out` access — `<performed? yes/no>`
- [ ] Customer data — `<performed? yes/no>`
- [ ] Source / config edit — `<performed? yes/no>`
- [ ] DB mutation — `<performed? yes/no>`
- [ ] Rollback action — `<performed? yes/no>`

---

## 17. Required review before execution

- This planning PR must be reviewed before it is merged.
- All blockers raised in review must be resolved before merge.
- **Merging the planning PR does not itself execute anything.** The planning PR is docs-only.
- Execution requires a **separate explicit GO** sent by the operator **after** the planning PR is
  merged, using the exact GO phrase from Section 6, and only for the exact scope in this document.

---

## 18. Example minimal L3 execution record

> Skeletal example with **placeholders only**. This is illustrative structure, not a runnable
> command pack. It contains no real commands, no secrets, no real DSNs, and no private paths.

```text
STATUS: <L3_STATUS_NAME_HERE>
OPERATION: <operation name>
BASE: <base branch> @ <base SHA>
GO RECEIVED: <exact GO phrase> (verified: yes/no)

PREFLIGHT:
  branch/base check ........ <PREFLIGHT_OK | RESULT_BLOCKED>
  clean worktree ........... <PREFLIGHT_OK | RESULT_BLOCKED>
  static-guardrails green .. <PREFLIGHT_OK | RESULT_BLOCKED>
  custody presence ......... <PREFLIGHT_OK | RESULT_BLOCKED>   # presence only, no values

STEP 1 <allowed action label>: <STEP_DONE | RESULT_BLOCKED>
STEP 2 <allowed action label>: <STEP_DONE | RESULT_BLOCKED>

RESULT: <RESULT_OK | RESULT_BLOCKED | RESULT_INCONCLUSIVE | RESULT_FAILED>
SAFE LABELS ONLY: yes
RAW OUTPUT / ERRORS / STACKS / PRIVATE PATHS / CUSTOMER DATA / SECRETS: none

NEGATIVE-ACTION LEDGER: see Section 16 (fill per run)
FOLLOW-UP: <in-scope follow-up | requires new planning PR + GO>
```

---

_End of template. Docs-only. Authorizes no execution._
