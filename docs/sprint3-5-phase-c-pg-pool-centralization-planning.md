# Sprint 3.5 — Phase C: pg.Pool Construction Centralization (Planning-Only)

**Status:** `SPRINT3_5_PHASE_C_PG_POOL_CENTRALIZATION_PLANNING_ONLY`

## 0. Scope

This is a **docs-only planning record**. It defines a safe, mechanical / no-op plan for
centralizing `pg.Pool` construction **later**; it **does not implement it**. **No** source/
package/script change, **no** DB/runtime execution, **no** refactor, **no** behavior change,
and **no Phase C implementation is authorized by this PR** (see §10).

Provenance: Phase B is closed (`SPRINT3_5_PHASE_B_STATIC_GUARDRAIL_SET_CLOSURE_EVIDENCE`,
PR #368). The first Phase C candidate from the merged roadmap
(`SPRINT3_5_AMS_BUYERRECON_REFACTOR_ROADMAP_REVIEW_ONLY`) is the shared `pg.Pool` factory.

**Base:** `sprint2-architecture-contracts-d4cc2bf` @ `dd1edef89254e188a899a9e405850dcec42a3f37`.

**Risk-worker sealed state (preserved, not inferred):**

```text
diagnostic_category (broad, PR #350) = runtime_dependency_or_build_failure   [unchanged]
final subclassifier retry result     = blocked / none_not_classified          [unchanged]
likely_failure_surface               = unknown                                [unchanged]
runtime_cause_exact_line             = unknown
```

---

## 1. Current Topology (from Phase B PR B, `check:pg-pool-construction`)

The characterized, allowlisted DB-connection construction / `DATABASE_URL` read sites:

```text
CONSTRUCTION — new pg.Pool (15 sites), by class:
  SERVER_APP_POOL (1):
    src/db/client.ts                         (long-lived Express app pool, max:10)
  CLI_WORKER_POOL (4):
    scripts/run-stage0-worker.ts
    scripts/run-risk-evidence-worker.ts
    scripts/run-poi-core-worker.ts
    scripts/run-poi-sequence-worker.ts       (per-process worker pools, max:4)
  CLI_OBSERVATION_POOL (10):
    scripts/evidence-review-snapshot-report.ts
    scripts/lane-ab-preview-report.ts
    scripts/poi-core-input-observation-report.ts
    scripts/poi-sequence-observation-report.ts
    scripts/poi-sequence-table-observation-report.ts
    scripts/poi-table-observation-report.ts
    scripts/product-context-timing-observation-report.ts
    scripts/product-features-bridge-candidate-observation-report.ts
    scripts/risk-core-bridge-observation-report.ts
    scripts/timing-product-context-observation-report.ts

CONSTRUCTION — new pg.Client (3 sites), CLI_SINGLE_CLIENT:
  scripts/collector-observation-report.ts
  scripts/extract-behavioural-features.ts
  scripts/extract-session-features.ts

DATABASE_URL connection-read sites: 18 files (the above CLI families + the src worker modules
  src/db/client.ts, src/scoring/poi-core-worker/worker.ts, poi-sequence-worker/worker.ts,
  risk-evidence/worker.ts, stage0/run-stage0-worker.ts).
```

The `check:pg-pool-construction` guardrail fails closed if a **new** construction/read site
appears outside this allowlist, or if any appears in a customer-output/observer surface.

---

## 2. Why Centralization Is Useful

- **DRY** — the `new pg.Pool({ connectionString, max, idleTimeoutMillis })` block is repeated
  across ~15 scripts (and `DATABASE_URL` parse/mask logic is duplicated across runners), which
  drifts (risk register A-1 / S-1).
- **Consistency** — one factory can pin pool sizing/timeouts and the masking helper in a single
  reviewed place, reducing inconsistent configuration.
- **Auditability** — a single construction seam is easier to characterize and to reason about for
  least-privilege posture (which the guardrails already track).

---

## 3. Why Implementation Is NOT Authorized Yet

- Phase C is **gated** per the roadmap; each mechanical slice needs its **own** planning/review/GO.
- Centralization touches DB-connection construction — a load-bearing seam. Even a "no-op" refactor
  can subtly change pool sizing, lifecycle, or `DATABASE_URL` resolution if done carelessly.
- The **"do not touch yet"** freeze stands, including **risk-evidence runtime behavior** (the
  sealed runtime failure remains `runtime_dependency_or_build_failure` / `unknown`). Worker paths
  must not be refactored for runtime reasons or in a way that could perturb the sealed surface.
- No behavior-preserving proof exists yet for the specific factory shape; it must be introduced and
  reviewed under its own PR, guarded by the Phase B checks (and any targeted no-runtime tests).

---

## 4. Candidate Target Shape (future — illustrative, not implemented here)

A single, side-effect-free factory module (e.g. `src/db/pool-factory.ts`) that **preserves current
behavior exactly**:

```text
// Illustrative shape only — NOT implemented in this PR.
// createAppPool()      -> pool with the CURRENT src/db/client.ts config (max:10, idle:30000)
// createWorkerPool()   -> pool with the CURRENT CLI worker config (max:4, idle:5000)
// createClientConn()   -> single pg.Client for the CURRENT CLI_SINGLE_CLIENT scripts
// maskDatabaseUrl()    -> the CURRENT host+db masking helper (dedup of per-runner copies)
```

- The factory reads the **same** `process.env.DATABASE_URL` the call sites read today — **no new
  env names, no role/DSN changes** (§5).
- Call sites are migrated to call the factory instead of constructing inline — a **mechanical**
  substitution with identical resulting pool/client configuration.
- The `check:pg-pool-construction` allowlist would be updated to point at the factory as the single
  construction site (a reviewed allowlist change, still fail-closed).

---

## 5. Required Invariants (every future slice must hold)

```text
no role/DSN behavior change         — same DATABASE_URL, same resolved role; no APP_DSN/ADMIN_DSN/
                                      RUNNER_DSN/STAGE0_RUNNER_DSN introduced
no new env loading                  — no new env var names read; no dotenv behavior change
no DB connection during tests/checks — the factory is not invoked by any check; guardrails stay static
no customer-output/Gate/Lane/AMS coupling — the factory imports none of these; boundaries (PR A/E) hold
no worker execution                 — no worker/classifier/risk-evidence run to "validate" a slice
pool config preserved               — max / idleTimeoutMillis identical per class (app vs worker)
behavior-neutral                    — outputs identical; proven against the Phase B baseline
```

---

## 6. Future Implementation Slicing (one concern per PR; each gated)

```text
PR C1: introduce the factory behind an unused / static-only path (module added, not yet wired),
       or wired to a single low-risk seam; guardrails updated to allow the factory construction site.
PR C2: migrate ONE low-risk CLI observation/report path to the factory (e.g. one *-observation-report.ts),
       proving identical pool config; no worker path touched.
PR C3: migrate worker paths (CLI_WORKER_POOL / src worker modules) ONLY after separate explicit approval —
       these are adjacent to the sealed risk-evidence surface and stay frozen until then.
PR C4: remove duplicate inline construction ONLY after the characterization checks pass against the
       factory-based topology (the final DRY cleanup).
```

Each PR is **mechanical / no-op**, one concern, and requires its **own** review and fresh GO. No PR
combines a factory extraction with a config/behavior change.

---

## 7. Validation Bundle Required for Every Future Implementation PR

```text
git diff --check
npm run check:constants
npm run check:static-boundaries
npm run check:pg-pool-construction
npm run check:observer-shape
npm run check:record-only-gate
npm run check:customer-output-boundary
plus any targeted no-runtime tests introduced later (pure/static only; no DB/network)
```

`check:pg-pool-construction` is the primary guard for this workstream: any factory/migration slice
must keep it green (with its allowlist updated to the factory seam under review).

---

## 8. Negative-Action Ledger (this PR)

```text
source_or_package_or_script_changed=false
refactor_performed=false
phase_c_implemented=false
db_or_network_or_sql_psql=false
server_or_production_command=false
worker_or_classifier_or_risk_evidence_run=false
env_or_secret_read_or_edit=false
deploy=false
lane_scoring_ams_customer_output=false
gate4e_or_gate4f=false
private_capture_or_run_err_run_safe_out_access=false
```

This PR adds exactly one docs file and performs only read-only static validation.

---

## 9. Next-Step Recommendation

1. Review + merge this planning PR.
2. Under a **separate** GO, open **PR C1** (introduce the factory; static-only / unused-path first),
   keeping the full Phase B validation bundle green.
3. Proceed C2 → C3 → C4 as separate, individually-approved slices, with worker paths (C3) frozen
   until their own explicit approval.

---

## 10. Explicit Non-Authorization

**This PR authorizes no Phase C implementation.** It is planning only: no factory is created, no
call site is migrated, no guardrail allowlist is changed, and no behavior is altered. Each future
slice (C1–C4) requires its own docs/PR, review, and a fresh explicit GO. Phases C–E remain gated;
the "do not touch yet" freeze (including risk-evidence runtime behavior) stands.

---

## 11. Safety / Raw-Data Boundary

This document contains no secrets, DSNs, connection strings, env values, private capture
paths/pointers, raw runtime output, exact error lines, stack traces, SQL results, DB/customer data,
base64 blobs, or generated customer output. All identifiers are public code paths, command names,
status labels, and public git commit hashes. It is docs-only planning and authorizes no execution
or refactor. The risk-worker sealed state is preserved unchanged.
