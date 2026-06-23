# Sprint 3 — Risk Worker `runtime_dependency_or_build_failure` Remediation Plan (Planning-Only)

**Status:** `RISK_WORKER_RUNTIME_DEPENDENCY_OR_BUILD_FAILURE_REMEDIATION_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans a **bounded remediation
path** for the classifier-emitted category
`diagnostic_category=runtime_dependency_or_build_failure` — **without reading raw
runtime output and without applying any fix**.

This PR **executes nothing** and **authorizes no remediation**: no code change, no
worker rerun, no capture rerun, no classifier rerun, no `risk-evidence:run`, no
`risk-evidence:record-only`, no read/`cat`/`grep`/copy/summarize of `run.err` or
`run.safe.out`, no SQL/psql, no DB mutation, no deploy, no Lane/scoring/AMS/customer/
Gate 4E/Gate 4F action, and no edit to package/source/scripts/config/runtime/DSN/secret
files. **The exact raw runtime error line remains `unknown` and must not be inferred.**

---

## 1. Trusted Base

```text
sprint2-architecture-contracts-d4cc2bf
03e48f0ea6707d3ad55a2acf3863ae434594e5a2
```

---

## 2. Evidence Carried Forward

```text
capture_id=risk_record_only_20260623T143244Z
worker_exit_code=1
diagnostic_result=classified
diagnostic_category=runtime_dependency_or_build_failure
classifier_execution_count=1
raw_output_printed=false
raw_output_read_outside_classifier=false
fix_executed=false
runtime_cause_exact_line=unknown
```

Provenance chain:

- **PR #348** — static RECORD_ONLY proof evidence **merged**.
- **PR #349** — RECORD_ONLY capture evidence **merged**
  (`capture_id=risk_record_only_20260623T143244Z`, `worker_exit_code=1`).
- **PR #350** — allowlisted classifier evidence **merged**
  (`diagnostic_result=classified`,
  `diagnostic_category=runtime_dependency_or_build_failure`).

**Bounded standing conclusion:** the risk worker exited non-zero (`worker_exit_code=1`)
and an allowlisted classifier — running exactly **once** — placed the failure in the
**`runtime_dependency_or_build_failure`** category **without** the raw output being
printed or read outside the classifier. This is a **category label only**, **not** the
exact raw error line and **not** a proven failure surface.

---

## 3. Problem Statement (what remediation must achieve)

Narrow `runtime_dependency_or_build_failure` to a **specific, likely failure surface**
that a future minimal fix could target — using **only static repository inspection and
safe labels** — **without** reading raw runtime output, rerunning any worker/capture/
classifier, or applying a fix. If the category cannot be narrowed safely without raw
output, **stop**.

---

## 4. Safe Candidate Failure Surfaces (hypotheses only — none confirmed)

```text
package script wiring
tsx/TypeScript execution
ESM import path or extension mismatch
module export/import mismatch
missing dependency
build/type-only import runtime issue
Node runtime compatibility
wrapper-to-worker import boundary
```

Each is a **candidate** consistent with a category-`runtime_dependency_or_build_failure`
exit. **None is selected or confirmed here.** Confirmation, if any, comes only from a
future reviewed static-inspection evidence PR (Option A), not from this plan.

---

## 5. Remediation Options (no option is implemented here)

### Option A — static repository inspection (no raw output, no execution)
Inspect already-committed repository wiring — `package.json` scripts, the wrapper
entrypoint, the wrapper→worker import target, `tsconfig` module mode, `package.json`
`type`, static import/export shape, declared dependency presence, and Node engine
constraints — and emit **safe labels only** (Section 6). Reads **source/config files
that are already in the repo**; reads **no** `run.err` / `run.safe.out`; runs **no**
worker/capture/classifier; applies **no** fix.
- **Pros:** smallest safe step; zero execution; no raw-output exposure; can confirm or
  eliminate several Section 4 surfaces from committed files alone.
- **Cons:** static only — cannot observe the actual runtime error; may leave the surface
  `unknown` if the failure is not statically visible.

### Option B — separate allowlisted sub-classifier (narrower category only)
If static inspection (Option A) cannot narrow the surface, plan a **separate
allowlisted sub-classifier** that emits a **narrower category only** (e.g.
`import_path_mismatch` vs `missing_dependency` vs `node_runtime_incompatibility`),
under the **same allowlist discipline** as the prior classifier — **no raw output
printed or read outside the sub-classifier**.
- **Pros:** can narrow the category without exposing raw output; reuses the proven
  allowlisted-classifier pattern.
- **Cons:** requires its **own** docs-only plan, review, and fresh explicit GO; is an
  execution step (sub-classifier run) and is **not** authorized here.

### Option C — minimal future fix PR (only after a reviewed plan)
**Only after** Option A (and/or Option B) identifies a **likely failure surface** in a
**reviewed** plan, a **minimal fix PR** may be considered that touches the **smallest
possible** wiring surface.
- **Pros:** targeted, minimal, reviewable.
- **Cons:** a **code change** — larger review surface; must be its **own** separately
  reviewed, GO-gated PR; must **not** precede a reviewed identification of the failure
  surface.

### Option D — inconclusive stop
If the category **cannot** be narrowed safely **without raw output**, **stop**: record
the blocked state in a docs-only evidence PR (safe labels only) and take **no** fix,
rerun, or raw-output read under this plan.

---

## 6. Allowed Future Static-Inspection Labels (Option A, when later planned/run)

```text
package_script_record_only_present=true/false
wrapper_entrypoint_present=true/false
wrapper_import_target_exists=true/false
tsconfig_module_mode_recorded=true/false
package_type_module_recorded=true/false
static_import_export_mismatch_detected=true/false/unknown
dependency_presence_static_check_pass=true/false/unknown
node_runtime_compatibility_static_check_pass=true/false/unknown
remediation_planning_result=static_inspection_needed|subclassifier_needed|minimal_fix_plan_needed|inconclusive_stop
```

These are **safe labels / booleans / `unknown`** only — no raw output, no error text,
no secret, no DSN, no customer data.

---

## 7. Stop-Lines

Abort (safe stop-line; no raw value emitted/recorded) if any of:

```text
raw runtime output would need to be read
classifier would need to be rerun without new GO
worker would need to be rerun
fix would be required before planning is reviewed
diagnostic would require SQL/psql or DB access
diagnostic would expose DSN/secret/customer/raw output
```

If a stop-line is hit, withhold all raw output, record the blocked state in a docs-only
evidence PR (safe labels only), and take **no** fix/rerun/raw-read without separate
review/GO. This corresponds to **Option D (inconclusive stop)**.

---

## 8. Next-Gate Decision Tree

```text
If static inspection can identify likely failure surface:
  create docs-only evidence PR, then separate minimal fix planning/implementation GO may be considered.

If category remains too broad:
  create separate allowlisted sub-classifier planning PR or stop.

If raw output is required:
  stop; do not read raw output under this plan.
```

**No code fix, worker rerun, capture rerun, or downstream/Gate action is authorized by
this planning PR.**

---

## 9. Recommended Smallest Safe Next Gate

**Recommend Option A first** — a docs-only **static repository-inspection evidence plan**
that emits the Section 6 safe labels only, **without** reading raw output or rerunning
anything. If Option A narrows the surface → a reviewed minimal-fix plan (Option C) may be
considered under its own GO. If Option A cannot narrow it → Option B (sub-classifier
plan) or Option D (stop). **No remediation is recommended for execution in this PR.**

---

## 10. Safety Boundaries (this planning PR)

- **Docs-only planning.** No code change.
- No read/`cat`/`grep`/copy/summarize of `run.err` or `run.safe.out`.
- No classifier rerun.
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
- **no** code fix;
- **no** worker rerun;
- **no** capture rerun;
- **no** classifier rerun;
- **no** raw-output read;
- **no** SQL/psql or DB access;
- **and no** downstream / Lane / scoring / AMS / customer / Gate 4E / Gate 4F action.

**Option A (static inspection), Option B (sub-classifier), and Option C (minimal fix)
each require their own docs-only plan, review, and a fresh explicit GO.** The exact raw
runtime error line remains `unknown` and **must not be inferred**.

---

## 12. Safety / Raw-Data Boundary

This record contains no raw runtime output, no `run.err` / `run.safe.out` content, no
raw error line, no DSN URI, connection string, password, token, host, port, IP, URI,
hostname, raw payload, raw SQL, raw psql output, or customer data. This is a docs-only
remediation plan that compares options and recommends the smallest safe next gate; it
**implements no remediation**, reads **no** raw output, reruns **nothing**, and emits
**safe labels / option names / category names only**. All values above are safe labels /
booleans / `unknown` / option names / public git commit hashes — not raw, secret, or row
values.
