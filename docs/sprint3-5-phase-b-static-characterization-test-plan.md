# Sprint 3.5 — Phase B: Static / Characterization Test Plan (Review-Only)

**Status:** `SPRINT3_5_PHASE_B_STATIC_CHARACTERIZATION_TEST_PLAN_REVIEW_ONLY`

This is a **review-only planning record**. It **plans** the first safe post-audit
implementation slice — **Phase B** of the merged refactor roadmap
(`SPRINT3_5_AMS_BUYERRECON_REFACTOR_ROADMAP_REVIEW_ONLY`): a suite of **static / no-DB /
no-network characterization tests**. **This PR adds no tests, edits no source, and executes
no runtime command.** No DB/network/runtime service is touched; no server access; no
classifier/worker/`risk-evidence` run; no SQL/psql; no customer-output generation; no
private capture read (`run.err` / `run.safe.out`).

**Base:** `sprint2-architecture-contracts-d4cc2bf` @ `0a23e479a11bf664aac4ab43fb6740cb6344da87`.

**Provenance:** PR #360 (`SPRINT3_5_AMS_BUYERRECON_READ_ONLY_ARCHITECTURE_AUDIT` +
roadmap + risk register). This plan operationalizes roadmap **Phase B** only; Phases C–E
remain gated and untouched.

---

## 0. Preserved Risk-Worker Sealed State (must not be re-litigated or inferred)

```text
diagnostic_category (broad, PR #350) = runtime_dependency_or_build_failure   [unchanged]
final subclassifier retry result     = blocked / none_not_classified          [unchanged]
likely_failure_surface               = unknown                                [unchanged]
runtime_cause_exact_line             = unknown
```

No Phase B test may read `run.err`/`run.safe.out`, rerun the worker/classifier, or infer
the sealed runtime cause. `src/scoring/risk-evidence/**` **runtime behavior** stays frozen
(risk register R-1/R-2/R-3); only **static, synthetic-fixture, pure-compute** aspects are
in scope for characterization.

---

## 1. Objective

Pin the **current, confirmed** behavior/structure of low-risk targets from PR #360 with
tests that need **no DB, no network, no runtime services** — so that the later mechanical
refactors (roadmap Phase C) can be proven behavior-preserving. Phase B **characterizes**;
it does not refactor.

---

## 2. Safest Test Targets (from PR #360, with why-safe)

| Target | Source anchor (from audit) | Why safe to characterize statically |
| --- | --- | --- |
| Duplicated `pg.Pool` construction | 4 workers + observation scripts (`scripts/run-*.ts`) | The pool **config shape** (max, idleTimeoutMillis, connectionString source) is a static literal; assert it by reading source text — never open a pool. |
| Near-identical observer modules | 7 `*-observer/` (index/query/mapper/report/runner) | Structure + **pure mapper** output on synthetic input is deterministic and DB-free. |
| Record-only contract gate | `src/scoring/contracts.ts` (`assertScoringContractsOrThrow`, validation) + `scoring/version.yml` | Validator is a **pure function** over parsed YAML/objects; testable with synthetic contract objects, no worker start. |
| Customer-output observer-only/unwired boundary | `src/reports/external/**`, `src/lane-ab-preview/**`, `src/app.ts` route wiring | Assert **statically** that no HTTP route imports/mounts the external-report/Lane-AB builders — a source/import graph check, no execution. |
| Lane/scoring/AMS boundary assumptions | `migrations/016` (grants), `AMS_RESERVED_*` guards, "NOT Core AMS" markers | Assert as **static text/AST invariants** (reserved-name lists present; no Lane A/B writer import in workers) — no DB, no AMS runtime. |

All targets are **structure or pure-function** aspects. None requires a live DB, network,
worker run, or customer output.

---

## 3. Allowed Test Categories (Phase B)

1. **Static import / dependency-direction checks** — parse/inspect source to assert the
   acyclic direction from the audit (ingest → stage0 → risk/POI → observers) and that
   forbidden cross-imports are absent (e.g. a worker importing a Lane A/B writer). Realizable
   as source-text/AST assertions in the existing `tests/static/*.contract.test.mjs` style
   (node:fs + node:assert only).
2. **Config/env boundary checks without reading secrets** — assert that env-var **names**
   and the safe-log blocklist regexes exist and cover `*DATABASE_URL`
   (`src/reports/external/safe-claims.ts`); assert code references `process.env.DATABASE_URL`
   consistently. **Never read a secret value**; assert on names/shape only.
3. **No-DB / no-network characterization tests** — exercise **pure** functions (adapters,
   the contract validator, mappers) with in-memory inputs; assert returned objects. No pool,
   no `pg`, no fetch.
4. **Observer output-shape tests using synthetic fixtures only** — feed hand-authored
   synthetic rows to the pure mapper of each observer and snapshot the **shape** (keys/types)
   of the output; fixtures contain **no real** identifiers, payloads, or customer data.
5. **Contract guard tests that do not call production services** — pass synthetic
   `version`/`dictionary`/`forbidden_codes` objects to the validator and assert it flags
   `status !== 'record_only'` / `automated_action_enabled !== false` / activation flags as
   hard failures. No worker `main()` invocation.

---

## 4. Forbidden Test Categories (Phase B)

```text
no DB / network / runtime-service tests
no production command
no server access
no classifier / worker / risk-evidence run (or record-only rerun)
no SQL / psql
no customer-output generation
no private capture reads (run.err / run.safe.out)
no reading real secret/DSN values
no live pool/connection open (even to a test DB) in this phase
no Gate4E / Gate4F action
```

If a candidate test cannot be expressed without one of the above, it is **out of Phase B**
and deferred to a later, separately-gated phase (or dropped).

---

## 5. One-Concern-Per-PR Slicing (future implementation; not created here)

| Future PR | Concern | Target | Category |
| --- | --- | --- | --- |
| **PR A** | Static dependency/import checks | direction + forbidden cross-imports | §3.1 |
| **PR B** | `pg.Pool` construction characterization | pool config-shape literals in `scripts/run-*.ts` | §3.1/§3.2 (static text) |
| **PR C** | Observer module shape characterization | pure mappers of the 7 `*-observer` modules, synthetic fixtures | §3.4 |
| **PR D** | Record-only contract gate characterization | `contracts.ts` validator with synthetic objects | §3.5 |
| **PR E** | Customer-output boundary characterization | assert `reports/external` + `lane-ab-preview` remain unwired to routes | §3.1 |

Each future PR: **one concern**, tests-only (no source/behavior change), synthetic fixtures
only. Never combine a characterization test with a refactor — the refactor is Phase C, a
separate PR after the matching Phase B test is green.

---

## 6. Required Validation for Future Phase B Implementation PRs

Each future Phase B PR must, before completion:

```text
git diff --check                       (clean)
existing static checks: npm run check:constants   (OK)
the added tests run with NO DB and NO network      (pure/static only)
synthetic fixtures only                            (no real ids/payloads/customer data)
no source behavior changes                         (test files + fixtures only)
no generated customer output                       (no reports/external or Lane output produced)
changed files limited to tests/ (+ fixtures) for that one concern
```

Runner note: the existing `tests/static/*.contract.test.mjs` (node:fs + node:assert, file
reads only) is the safe template for static checks; pure-function characterization may use
the project test runner **only** in a no-DB/no-network configuration and must be justified as
such per PR. The DB-config runner (`vitest.db.config.ts`, `test:db:v1`) is **out of scope**
for Phase B.

---

## 7. Boundary Preservation & Non-Inference

- Preserve the risk-worker sealed state verbatim (§0); do not infer the runtime cause.
- Preserve PR #360 invariants: record-only gate fail-closed; `migrations/016` grant posture;
  customer-output observer-only/unwired; AMS not a runtime dependency.
- Phase B characterizes **current** behavior; it does not "fix" or change any of the above.

---

## 8. Stop-Lines

Abort a future Phase B test (and re-plan) if it would require any of:

```text
opening a DB connection or pool (even to a test DB)
any network call
running a worker / classifier / risk-evidence command
reading a real secret/DSN value or a private capture
generating customer output or Lane A/B output
touching risk-evidence runtime behavior to force a code path
inferring the sealed risk-worker runtime cause
```

---

## 9. Next-Gate Decision Tree

```text
If this plan is reviewed and merged:
  Phase B implementation may proceed as the sliced tests-only PRs A–E, each under its own review
  (and, where the project requires, a test-harness GO), synthetic fixtures only, no DB/network.

If a target cannot be characterized without DB/network/runtime:
  defer it out of Phase B; do not add a DB/network test in this workstream.

If Phase B tests go green:
  the matching Phase C mechanical refactor may be planned (separate PR), guarded by those tests.

No source refactor, worker/classifier run, or downstream/Gate action is authorized by this plan.
```

---

## 10. Safety Boundaries (this planning PR)

- **Docs-only planning.** No test files, no source, no package/config edits.
- No server access; no production command.
- No classifier/worker/`risk-evidence` run or record-only rerun.
- No SQL/psql; no DB/network; no DB mutation.
- No env/secret edit or secret reads.
- No deploy.
- No Lane/scoring/AMS/customer output generation.
- No Gate4E/Gate4F.
- No private capture or `run.err`/`run.safe.out` access.

---

## 11. Explicit Non-Authorization

Merging this plan authorizes **no** test creation, **no** source/config change, **no**
worker/classifier/`risk-evidence` execution, **no** DB/network access, **no** customer
output, and **no** Gate action. Each future Phase B PR requires its **own** review (and any
required test-harness GO). Phases C–E remain gated per the roadmap. The exact raw runtime
error line remains `unknown` and **must not be inferred**.

---

## 12. Safety / Raw-Data Boundary

This document contains no secrets, DSNs, connection strings, passwords, tokens, hosts,
ports, IPs, private capture paths/pointers, raw runtime output, exact error lines, stack
traces, exception text, raw SQL results, DB/customer data, base64 payload blobs, or
generated customer output. All identifiers are public code paths, table/role/env-var names,
and public git commit hashes. It is review-only and authorizes no execution.
