# Sprint 3 — Risk Worker `runtime_dependency_or_build_failure` Static Inspection Evidence

**Status:** `RISK_WORKER_RUNTIME_DEPENDENCY_STATIC_INSPECTION_EVIDENCE`

This is a **docs-only static repository-inspection evidence record**. It inspects only
**tracked repository artifacts** to narrow the likely failure surface for the
classifier-emitted category `runtime_dependency_or_build_failure` — **without reading raw
runtime output and without applying any fix**.

This PR **executes nothing** and **authorizes no remediation**: no read/`cat`/`grep`/
copy/summarize of `run.err` / `run.safe.out`; no private capture path or pointer
inspection; no classifier rerun; no worker rerun; no `risk-evidence:run`; no
`risk-evidence:record-only`; no SQL/psql; no DB mutation; no deploy; no fix; no edit to
package/source/scripts/config/runtime/DSN/secret files; no Lane/scoring/AMS/customer/
Gate 4E/Gate 4F action.

---

## 1. Trusted Base

```text
sprint2-architecture-contracts-d4cc2bf
3f5b5b2586da6cfb4ab528d790d1d49a94c66966
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
- **PR #350** — classifier evidence **merged** (`diagnostic_result=classified`,
  `diagnostic_category=runtime_dependency_or_build_failure`).
- **PR #351** — remediation planning **merged**
  (`RISK_WORKER_RUNTIME_DEPENDENCY_OR_BUILD_FAILURE_REMEDIATION_PLANNING_ONLY`,
  recommended Option A = this static inspection).

---

## 3. Inspection Inputs (tracked repo artifacts only)

All inputs are tracked repository files inspected as committed source text. **No** raw
runtime output, **no** `run.err` / `run.safe.out`, **no** private capture path/pointer
content was read.

```text
package.json
tsconfig.json
scripts/run-risk-evidence-record-only-worker.ts
scripts/run-risk-evidence-worker.ts
src/scoring/risk-evidence/index.ts
src/scoring/risk-evidence/record-only.ts
src/scoring/risk-evidence/worker.ts
tests/static/risk-evidence-record-only-wrapper.contract.test.mjs
tests/static/risk-evidence-record-only-write-path-refactor.contract.test.mjs
docs/sprint3-risk-worker-runtime-dependency-build-failure-remediation-plan.md
```

---

## 4. Static Inspection Labels (safe; booleans / category tokens / safe paths only)

```text
package_script_record_only_present=true
package_script_record_only_value=tsx scripts/run-risk-evidence-record-only-worker.ts
wrapper_entrypoint_present=true
wrapper_import_target_exists=true
wrapper_import_target=scripts/run-risk-evidence-worker.ts
tsconfig_module_mode_recorded=true
tsconfig_module_value=NodeNext
tsconfig_module_resolution_value=NodeNext
package_type_module_recorded=true
package_type_value=commonjs
static_import_export_mismatch_detected=false
dependency_presence_static_check_pass=unknown
node_runtime_compatibility_static_check_pass=unknown
likely_failure_surface=unknown
remediation_planning_result=subclassifier_needed
```

---

## 5. Static Findings (structure only — no raw error, no inference of the exact line)

1. **Package-script wiring is present and pinned.** `package.json` defines
   `risk-evidence:record-only` = `tsx scripts/run-risk-evidence-record-only-worker.ts`
   and `risk-evidence:run` = `tsx scripts/run-risk-evidence-worker.ts`. Both static
   contract tests pin these exact values. → `package_script_record_only_present=true`.

2. **Wrapper entrypoint is present.** `scripts/run-risk-evidence-record-only-worker.ts`
   exists, sets `RISK_EVIDENCE_RECORD_ONLY` / `RISK_EVIDENCE_CAPTURE_MODE`, fails closed
   (`process.exit(2)`) if it cannot confirm RECORD_ONLY, and then dynamically imports the
   worker. → `wrapper_entrypoint_present=true`.

3. **Wrapper → worker import target resolves to a tracked file.** The wrapper imports
   `./run-risk-evidence-worker` (extensionless; this exact extensionless form is *pinned*
   by `tests/static/risk-evidence-record-only-wrapper.contract.test.mjs`), which resolves
   to the tracked `scripts/run-risk-evidence-worker.ts`. →
   `wrapper_import_target_exists=true`, `wrapper_import_target=scripts/run-risk-evidence-worker.ts`.

4. **TypeScript module mode recorded.** `tsconfig.json` sets `module=NodeNext` and
   `moduleResolution=NodeNext` (`rootDir=src`, `include=["src"]`, `exclude=[…,"tests"]` —
   note `scripts/` is outside the `tsc` `include`, but both scripts are executed via
   `tsx`, not `tsc`). → `tsconfig_module_value=NodeNext`,
   `tsconfig_module_resolution_value=NodeNext`.

5. **Package `type` recorded as `commonjs`.** `package.json` declares `"type":
   "commonjs"`, while `tsconfig` uses `NodeNext` and the worker CLI imports the module
   barrel with an explicit `.js` extension on a `.ts` source
   (`../src/scoring/risk-evidence/index.js`). This `commonjs` + `NodeNext` + `tsx`-runner
   combination is recorded as a **structural observation only** — it is **not** asserted
   to be the cause; `tsx` resolves both the extensionless wrapper import and the
   `.js`-suffixed source import. → `package_type_value=commonjs`.

6. **Import/export boundary among the inspected files is internally consistent.** The
   worker CLI imports `parseRiskEvidenceEnvOptions` and `runRiskEvidenceWorker` from the
   barrel `index.ts`, which re-exports both from `./worker.js`; `worker.ts` defines both;
   `record-only.ts` exports the `isRiskEvidenceRecordOnlyMode` / env-name symbols the
   barrel re-exports. No mismatch is detected **across the inspected wrapper → worker →
   index boundary**. → `static_import_export_mismatch_detected=false`.
   - **Scope caveat:** `index.ts` additionally re-exports from sibling modules
     (`./adapter.js`, `./context-tags.js`, `./normalisation-config.js`,
     `./normalise-behavioural-risk.js`, `./types.js`) and `worker.ts` imports
     `../contracts.js` — **these targets are outside the allowed inspection set**, so the
     **full module graph is not verified here** (status `unknown`, not `false`).

7. **Dependency presence is not determinable from the allowed inputs.** `package.json`
   *declares* the imports visible in the inspected files (`pg`, `dotenv` as runtime deps;
   `tsx` as a dev dep). However, **installed/`node_modules`/lockfile state is out of the
   allowed inspection scope**, and a `runtime_dependency` failure is precisely an
   install-/runtime-resolution condition the manifest cannot confirm or refute. →
   `dependency_presence_static_check_pass=unknown`.

8. **Node runtime compatibility is not determinable from the allowed inputs.**
   `package.json` declares **no `engines` field**; the wrapper uses top-level `await
   import(...)`. Without a declared engine constraint or runtime-version evidence, Node
   compatibility cannot be statically confirmed. →
   `node_runtime_compatibility_static_check_pass=unknown`.

9. **Exit-code origin (structural note, not raw-error inference).** Read purely from
   tracked source: the **wrapper** fail-closed path exits `2`, whereas the **worker CLI**
   (`scripts/run-risk-evidence-worker.ts`) error/fatal paths exit `1`. The carried-forward
   `worker_exit_code=1` is therefore consistent with **either** the worker CLI reaching an
   error path **or** an unhandled rejection during module load — these are **not
   distinguishable without raw output**, which this record does **not** read. This note
   **does not** identify or infer the exact raw error line
   (`runtime_cause_exact_line=unknown`).

---

## 6. Surface Narrowing Outcome

Static inspection of the allowed tracked artifacts **confirmed** that the package-script
wiring, the wrapper entrypoint, and the wrapper → worker import target are all **present
and internally consistent**, and that the wrapper form is **pinned by static contract
tests**. It therefore **eliminates "wiring absent / entrypoint missing / pinned-import
drift" as the failure** within the inspected boundary.

It **could not isolate a single failure surface**, because the discriminating
inputs — installed-dependency/runtime state, the full sibling/`contracts` module graph,
and the Node runtime version — are **out of the allowed inspection scope**, and the raw
runtime output **must not be read** under this plan. The remaining plausible-but-not-
isolable surfaces are `missing_dependency`, `type_only_import_runtime_issue`,
`node_runtime_compatibility`, `esm_import_path_or_extension`, and
`module_export_import_mismatch` (the last two only via the unverified sibling/`contracts`
graph). Accordingly:

```text
likely_failure_surface=unknown
remediation_planning_result=subclassifier_needed
```

---

## 7. Interpretation

```text
This is static repository-inspection evidence only.
It does not read raw runtime output and does not identify the exact raw error line.
It does not authorize a fix, rerun, capture, classifier, SQL/psql, DB mutation, deploy, customer output, Lane/scoring/AMS, Gate4E, or Gate4F.
```

---

## 8. Next-Gate Decision Tree

```text
If likely_failure_surface is narrowed:
  next safe step is a separate minimal-fix planning PR or implementation GO, depending on governance choice.

If category remains too broad:
  next safe step is separate allowlisted sub-classifier planning PR or stop.

If raw output would be required:
  stop; do not read raw output under this plan.
```

**Applicable branch:** `likely_failure_surface=unknown` (category remains too broad to
isolate from the allowed inputs) → **next safe step is a separate allowlisted
sub-classifier planning PR** (emitting a *narrower* category only, e.g.
`missing_dependency` vs `node_runtime_incompatibility` vs `import_path_mismatch`), **or
stop**. **No** minimal-fix PR is warranted yet, and raw output is **not** read here.

---

## 9. Safety Boundaries (this evidence PR)

- **Docs-only.** No code change.
- No read/`cat`/`grep`/copy/summarize of `run.err` / `run.safe.out`.
- No private capture path / pointer inspection.
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

## 10. Safety / Raw-Data Boundary

This record contains no raw runtime output, no `run.err` / `run.safe.out` content, no raw
error line, no private capture path/pointer value, no DSN URI, connection string,
password, token, host, port, IP, URI, hostname, raw payload, raw SQL output, or customer
data. The `package.json` script value and config values quoted above are **public,
tracked, non-secret repository literals** (command strings / `NodeNext` / `commonjs`).
This is docs-only static inspection evidence: it reads only tracked source files, emits
**safe labels / booleans / category tokens / safe repo paths only**, identifies **no**
exact raw error, and authorizes **no** remediation. The exact raw runtime error line
remains `unknown` and **must not be inferred**.
