# Sprint 3 — Risk-Worker Write-Path Refactor for RECORD_ONLY Gating — Planning (Docs-Only)

**Status:** `RISK_WORKER_RECORD_ONLY_WRITE_PATH_REFACTOR_PLANNING_ONLY`

This is a **docs-only planning record**. It designs a careful future refactor that
can **safely gate the `risk_observations_v0_1` UPSERT / write path** so a future
RECORD_ONLY capture can run read/compute/summarize while suppressing all DB
writes and customer-visible output — after the naive flag-consumption attempt
blocked at `write_path_pattern_not_patchable_safely` (PR #344 / PR #345).

This PR **plans only**. It does **not** implement code, patch PR #344, modify
`package.json`/scripts/source/config/runtime/DSN/secret/schema/migration/deploy/
env/worker/extractor/Lane/scoring/AMS/customer-output files, run the worker, run
`risk-evidence:run` or `risk-evidence:record-only`, run any classifier, run a
capture, read/`cat`/`grep`/copy any old or new `run.err`/`run.safe.out`, run
SQL/psql, mutate the DB, deploy, touch production, or run Gate4E/Gate4F.

---

## 1. Current trusted base

```text
base_branch=sprint2-architecture-contracts-d4cc2bf
trusted_base=bde7b71af2c36b9f46f6e5b48fa7ba0503c97dc3
```

---

## 2. Evidence chain

```text
PR_343_record_only_wrapper_added=true
PR_344_closed_unmerged=true
PR_345_blocked_evidence_merged=true
worker_consumes_record_only_flag=false
write_path_pattern_not_patchable_safely=true
record_only_execution_provable=false
capture_go_authorized=false
runtime_cause=unknown_or_unclassified
```

---

## 3. Current design problem

```text
src/scoring/risk-evidence/worker.ts contains a combined compute + persist flow.
The UPSERT/write path is embedded in the worker loop.
A naive patch could not safely isolate the write path.
Therefore a careful refactor/design is required before any flag-consumption
implementation can proceed.
```

Because the UPSERT is interleaved with the compute loop, a single flag check
cannot reliably suppress *every* write without risking partial/bypassed writes or
unintended behavior changes to the normal run. The write path must first be
**isolated** into one function before any RECORD_ONLY gate can be proven.

---

## 4. Target future architecture

```text
RiskEvidenceCandidate          = computed, non-persisted observation object
buildRiskEvidenceCandidates(…) = pure / mostly-pure compute path (read + adapt + compute)
persistRiskEvidenceCandidates(…) = the ONLY function allowed to UPSERT
runRiskEvidenceWorker(…)       = orchestrator
record-only mode               = compute candidates + safe counts only; SKIP persist function
```

Separation of concerns (the four stages the goal calls for):

1. **read/select input rows** — read `stage0_decisions` + `session_behavioural_features_v0_2`.
2. **adapt/compute risk observation candidates** — `buildRiskEvidenceCandidates(…)`
   returns `RiskEvidenceCandidate[]` with **no** DB write and **no** customer-visible
   output.
3. **summarize safe result counts/labels** — derive booleans/counts only (no rows,
   no payloads).
4. **persist UPSERT rows** — `persistRiskEvidenceCandidates(…)` is the **single**
   function that touches `risk_observations_v0_1`; in RECORD_ONLY mode the
   orchestrator **does not call it**.

In RECORD_ONLY mode the orchestrator runs stages 1–3 and **skips stage 4**; in the
normal run, stage 4 is reached **only** through `persistRiskEvidenceCandidates(…)`.

---

## 5. Required future implementation invariants

```text
record_only_mode_explicit=true
record_only_absence_fails_closed=true
persist_function_single_entrypoint=true
all_upsert_sql_confined_to_persist_function=true
record_only_path_does_not_call_persist_function=true
customer_visible_output_path_gated=true
write_path_bypass_detected=false
normal_risk_evidence_run_unchanged=true
```

---

## 6. Required future tests / static proof

```text
static test: package script risk-evidence:run remains unchanged
static test: package script risk-evidence:record-only remains dedicated wrapper
static test: UPSERT_SQL is referenced only by the persist function
static test: record-only branch does not call the persist function
static test: absence of RECORD_ONLY fails closed for the wrapper
static test: normal run path remains write-capable only through the persist function
static test: no classifier/capture/customer/Gate path is introduced
```

Proof must be **static / file-read only** where possible (string/AST-shape
assertions over source), never requiring worker execution, SQL/psql, or runtime
output reads.

---

## 7. Stop-lines

The future refactor / proof (and this plan) must stop if:

```text
cannot isolate UPSERT into a single persist function
record-only path can still reach the persist function
normal run behavior would be changed unintentionally
customer-visible output path cannot be ruled out
refactor requires schema/migration/grant/DB change
proof requires worker execution
proof requires SQL/psql
proof requires runtime output read
implementation scope becomes a broad refactor beyond the risk-evidence worker
```

On any stop-line: halt and record it (safe labels only); do not proceed to
implementation, proof, or capture.

---

## 8. Future sequence

```text
Step 1: review/merge this planning PR only.
Step 2: separate implementation PR for the careful refactor, no execution.
Step 3: separate static proof-evidence PR, no execution.
Step 4: only after the proof PR is reviewed/merged may a future capture GO be considered.
```

Each step is its own separately reviewed change; any worker run, capture, or
downstream/Gate action requires its own separate explicit scoped Helen GO after
the relevant evidence is reviewed.

---

## 9. Explicit non-authorization

This PR does **NOT** authorize:

```text
code implementation
worker execution
risk-evidence:run
risk-evidence:record-only
classifier
capture
raw output read
SQL/psql
DB mutation
deploy
production touch
Lane/scoring/AMS/customer/Gate4E/F
```

Merging this PR changes no runtime/enforcement behavior, implements nothing, and
authorizes no execution.

---

## 10. Safety / Raw-Data Boundary

This record contains no secret value, **no DSN value or DSN component**, raw
password, password hash, DSN URI, connection string, raw secret-manager payload,
service-file content, `.env.production` / `risk-worker.env` content/value, token,
private key, IP address, host value, port value, real URI, login source, **raw
`pg_hba` lines**, raw `accepted_events` payload, raw `canonical_jsonb`, real
`session_id` / `request_id` / user identifier, user-agent, header, body value,
customer row data, **raw psql output, raw PostgreSQL error text**, **stack trace
/ exception text**, **worker stdout/stderr**, or `run.safe.out` / `run.err`
contents. This plan implements nothing, runs nothing, and reads no captured
runtime output; the proposed symbol names (`RiskEvidenceCandidate`,
`buildRiskEvidenceCandidates`, `persistRiskEvidenceCandidates`,
`runRiskEvidenceWorker`) are **design identifiers**, not code introduced here.
The env-var names (`RISK_EVIDENCE_RECORD_ONLY`, `RISK_EVIDENCE_CAPTURE_MODE`), the
`package.json` script names (`risk-evidence:run`, `risk-evidence:record-only`),
the `scripts/*.ts` paths, the module path (`src/scoring/risk-evidence/worker.ts`),
the role name (`buyerrecon_risk_worker`), the table name
(`risk_observations_v0_1`), the database name (`buyerrecon_production`), the repo
path (`/opt/buyerrecon-backend`), and the recorded commit hash are **non-secret**
identifiers. All values above are safe labels / booleans / category tokens /
non-secret identifiers / a public git commit hash — not secret or row values.
**This PR runs nothing.**
