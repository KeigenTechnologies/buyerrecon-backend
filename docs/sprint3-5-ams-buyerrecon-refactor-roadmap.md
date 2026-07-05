# Sprint 3.5 — AMS / BuyerRecon Refactor Roadmap (Review-Only)

**Status:** `SPRINT3_5_AMS_BUYERRECON_REFACTOR_ROADMAP_REVIEW_ONLY`

This is a **review-only** roadmap. It **recommends** a staged refactor sequence; it
**changes no source, config, schema, runtime, DB, deploy, or customer output**, and
**authorizes no execution**. Every phase past Phase A requires its **own** PR, review, and
(where noted) a fresh explicit GO. Companion: the read-only audit
(`SPRINT3_5_AMS_BUYERRECON_READ_ONLY_ARCHITECTURE_AUDIT`) supplies the facts; this file
supplies the recommendations.

**Preserved state (non-negotiable input):** the Risk worker remains
`runtime_dependency_or_build_failure` (broad), final subclassifier retry
`blocked / none_not_classified`, `likely_failure_surface = unknown`. **No refactor in any
phase may depend on, touch, or attempt to resolve the sealed Risk-worker runtime cause**
until its diagnostics close under a separate GO (see "Do Not Touch Yet").

---

## 1. Guiding Principles

- **One concern per PR.** No PR mixes a mechanical rename with a behavior change.
- **Characterize before you change.** No behavior-preserving refactor of a worker/observer
  until a characterization test pins its current output (Phase B precedes Phase C+).
- **Record-only + grant boundaries are invariants.** No phase may weaken the
  `assertScoringContractsOrThrow()` gate or the `migrations/016` Lane A/B grant posture.
- **Docs-only phases are safe now; code phases are gated.**
- **Sealed diagnostics stay sealed.** No phase reads `run.err`/`run.safe.out` or infers the
  Risk-worker cause.

---

## 2. Staged Roadmap

### Phase A — Documentation & Boundary Map **(safe now; docs-only)**
Scope: this audit set + a boundary/dependency diagram doc; label module ownership; record the
open questions from audit §6. No code.
- **Preconditions:** none beyond review.
- **Exit:** merged docs; open questions assigned owners.
- **Risk:** minimal (docs-only).

### Phase B — Test Harness & Characterization Tests **(gated: needs test-harness GO)**
Scope: add **static/pure** characterization tests around the pure adapters
(`poi-core/adapter.ts`, `risk-core-bridge/adapter.ts`, risk-evidence compute path) and the
contract validator (`contracts.ts`), plus static contract tests (the existing
`tests/static/*.contract.test.mjs` pattern) for worker wiring. **No DB/network/runtime tests.**
- **Preconditions:** confirm which tests can run without DB/network (unit/pure + static only).
- **Exit:** green pure/static characterization suite pinning current adapter outputs.
- **Risk:** low; test-only, but must be justified as static-metadata/pure (no DB) per the
  forbidden-actions list.

### Phase C — Mechanical / No-Op Refactors **(gated: needs Phase B green + GO)**
Scope: behavior-preserving extractions with zero output change, each its own PR:
- C1: extract a shared `pg.Pool` factory used by the 4 workers + observation scripts
  (removes the 15+ duplicated pool blocks). **No pool-sizing change.**
- C2: extract shared `parseDatabaseUrl`/mask utility into `src/db/`.
- C3: split oversized files by responsibility **without** logic change (e.g. move
  markdown/JSON report generation out of `*-observer/runner.ts` into `report.ts`).
- **Preconditions:** characterization tests (Phase B) cover the touched modules.
- **Exit:** identical outputs verified by Phase B tests; diff is mechanical.
- **Risk:** low–medium; the only real risk is an accidental behavior change — Phase B guards it.

### Phase D — Service Boundary Extraction **(gated: separate planning PR + GO)**
Scope: formalize the observer template (7 near-identical `*-observer` modules) into a shared
abstraction; consolidate worker `main()` scaffolding (contract-guard → select → adapter →
UPSERT → aggregate) behind a shared runner. Consider resolving the
`product-context-timing-observer` vs `timing-product-context-observer` naming question.
- **Preconditions:** Phase C landed; audit open-questions #2 answered; per-module
  characterization coverage.
- **Exit:** reduced duplication with unchanged outputs; ownership clarified.
- **Risk:** medium; touches many modules — must be sliced (one observer/worker per PR).

### Phase E — Architecture-Changing Refactors **(forbidden until separate approval)**
Scope: anything that changes behavior, contracts, dependency direction, DB roles/DSN wiring,
or the customer-output path (e.g. introducing real `STAGE0_RUNNER_DSN`/role-scoped
connections in code; wiring `src/reports/external/**` to an HTTP/customer route; any Lane A/B
writer). **Not authorized here.** Requires its own design PR, Codex review, and explicit Helen
GO, and — for DSN/role/Stage0/customer-output items — the production-parameter governance path.

---

## 3. Change-Class Matrix

| Change | Class | Phase | Gate |
| --- | --- | --- | --- |
| This audit/roadmap/risk-register docs | Docs-only | A | Review |
| Pure/static characterization tests | Test-only (no DB) | B | Test-harness GO |
| Shared `pg.Pool` factory | Mechanical no-op | C1 | Phase B green + GO |
| Shared DATABASE_URL parse/mask util | Mechanical no-op | C2 | Phase B green + GO |
| Split report-gen out of runners | Mechanical no-op | C3 | Phase B green + GO |
| Observer template abstraction | Boundary extraction | D | Planning PR + GO |
| Worker scaffolding consolidation | Boundary extraction | D | Planning PR + GO |
| Observer naming consolidation | Boundary extraction | D | Planning PR + GO (after open-Q #2) |
| Role-scoped DSN in code | Architecture change | E | Production-parameter GO |
| Customer-output route wiring | Architecture change | E | Separate approval + Gate governance |
| Any Lane A/B writer | Architecture change | E | Separate approval + grant governance |
| Anything touching Risk-worker runtime cause | — | — | **Blocked** (do not touch yet) |

---

## 4. Do Not Touch Yet (unresolved diagnostics)

The following are **frozen** until their diagnostics close under a separate GO:

- **Risk worker runtime failure surface.** Category `runtime_dependency_or_build_failure`,
  `likely_failure_surface=unknown`, subclassifier result `blocked/none_not_classified`. Do
  **not** refactor `scripts/run-risk-evidence-worker.ts`,
  `scripts/run-risk-evidence-record-only-worker.ts`, or `src/scoring/risk-evidence/**` for
  runtime-behavior reasons; do **not** read `run.err`/`run.safe.out`; do **not** rerun the
  worker/classifier to "test" a refactor.
- **DSN/role binding in code.** Do not introduce `STAGE0_RUNNER_DSN`/role-scoped connections
  until the runner-binding governance question (audit §3.5, open-Q #1) is resolved.
- **Customer-output activation.** Do not wire `src/reports/external/**` or Lane A/B to any
  customer path; the record-only + grant posture stands.
- **Contract/version bumps.** Do not change `scoring/version.yml`, weights, thresholds, or
  reason-code dictionary — those require Helen sign-off per the file's own note.

---

## 5. PR Slicing Recommendations (one concern per PR)

1. **PR-A1:** merge audit + roadmap + risk register (this set). *Docs-only.*
2. **PR-A2:** boundary/dependency diagram doc + module ownership table. *Docs-only.*
3. **PR-B1:** pure characterization tests for `poi-core/adapter.ts`. *Test-only.*
4. **PR-B2:** pure characterization tests for `risk-core-bridge/adapter.ts`. *Test-only.*
5. **PR-B3:** static contract tests extending the risk-evidence compute path. *Test-only.*
6. **PR-C1:** shared `pg.Pool` factory (workers first, then observation scripts). *Mechanical.*
7. **PR-C2:** shared `parseDatabaseUrl`/mask util. *Mechanical.*
8. **PR-C3a..n:** one PR per oversized runner to move report-gen into `report.ts`. *Mechanical.*
9. **PR-D*:** one PR per observer/worker for template/scaffolding extraction. *Boundary.*
10. **PR-E*:** design-only planning PRs for any Phase-E item (no implementation without GO).

**Never** combine: a rename + a behavior change; a pool-factory extraction + a pool-sizing
tweak; a report-gen move + a mapping change. Each such pairing must be two PRs.

---

## 6. Safety / Non-Authorization

Merging this roadmap authorizes **no** code/config/schema/runtime/DB/deploy/customer-output
change and **no** execution. Phases B–E each require their own PR and gate as tabled above.
No secrets, DSNs, private paths, raw runtime output, exact error lines, stack traces, SQL
results, or customer data appear here. The Risk-worker sealed state is preserved unchanged.
