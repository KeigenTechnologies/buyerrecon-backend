# Sprint 3.5 — AMS / BuyerRecon Read-Only Architecture Audit

**Status:** `SPRINT3_5_AMS_BUYERRECON_READ_ONLY_ARCHITECTURE_AUDIT`

This is a **read-only, review-only architecture audit**. It was produced by static
inspection of committed source, config, and docs only. **No source, config, runtime, DB,
deploy, or customer-output action is authorized or performed by this document.** No server
access, worker/classifier execution, `risk-evidence` run, SQL/psql, DB mutation, private
capture read (`run.err` / `run.safe.out`), or private path/pointer inspection occurred.

**Method:** `git`/`grep`/file reads over the tree at base
`aebf3a199d89896f4a869897c011760755dd4385` (branch `sprint2-architecture-contracts-d4cc2bf`).
Every claim below is tagged **[FACT]** (verified from a cited file) or **[HYPOTHESIS]**
(inference requiring confirmation). Observations and recommendations are separated;
recommendations live in the companion roadmap, not here.

---

## 0. Preserved Risk-Worker State (must not be re-litigated here)

Carried forward from PR #359 (`RISK_WORKER_SUBCLASSIFIER_RETRY_EXECUTED_BLOCKED_NONE_NOT_CLASSIFIED`):

```text
diagnostic_category (broad, PR #350) = runtime_dependency_or_build_failure   [unchanged]
final subclassifier retry result     = blocked / none_not_classified          [unchanged]
likely_failure_surface               = unknown                                [unchanged]
runtime_cause_exact_line             = unknown
```

This audit **does not infer the private runtime cause from sealed captures** and treats
the Risk worker runtime failure surface as **unresolved** (see §7 and the "do not touch
yet" section of the roadmap).

---

## 1. System Shape (confirmed)

**[FACT]** The repository is a single TypeScript backend (`buyerrecon-backend`), not the
AMS product. It has three concern-groups:

1. **Ingestion / HTTP** — `src/server.ts`, `src/app.ts`, `src/collector/**`,
   `src/probe/**`, `src/config/**`.
2. **Scoring / risk pipeline (record-only)** — `src/scoring/**`, `scoring/*.yml`, driven by
   CLI workers in `scripts/run-*.ts`.
3. **Reporting / preview (internal, non-customer)** — `src/reports/external/**`,
   `src/lane-ab-preview/**`, `src/evidence-review-snapshot/**`, and the `*-observer` modules.

**[FACT]** AMS is **not a runtime dependency** of this repo. All ~50 `AMS` references in
`src/` are one of: documentation/comments asserting Track-B isolation ("NOT Core AMS
product code", "No AMS runtime bridge"), reserved-name guards
(`AMS_RESERVED_NAMES_FORBIDDEN`, `AMS_RESERVED_REASON_NAMESPACES_FORBIDDEN` in
`src/scoring/timing-product-context-observer/types.ts:294-322`), or non-authoritative JSON
shape alignment for internal preview (`src/scoring/product-context-timing-observer/runner.ts:358`).

---

## 2. AMS-Boundary Observations

### 2.1 Orchestration flow (as it exists here)
**[FACT]** The only live orchestration is the v1 collector request path:
`src/collector/v1/routes.ts:107-213` → `runRequest()` (pure, no DB, `orchestrator.ts`) →
`writeOrchestratorOutput()` (single transaction, `persistence.ts:84-135`) writing
`ingest_requests`, `accepted_events`, `rejected_events`. The scoring pipeline is **not**
invoked from HTTP; it runs only via out-of-band CLI workers.

### 2.2 Customer-output boundary
**[FACT]** `src/reports/external/**` (contracts/builders/renderer/safe-claims) and
`src/lane-ab-preview/**` produce report/preview artifacts but are **not wired to any HTTP
route** — they are observer/preview code today. `src/lane-ab-preview/report.ts:176` and
`preview.ts:19` explicitly state "No AMS Product Layer execution; no AMS runtime bridge
wiring."

**[FACT]** The durable customer-output surface (Lane A/B tables) is gated at the **database
grant layer**: `migrations/016_scoring_output_lane_grant_safety.sql` REVOKEs all Lane A/B
access from `buyerrecon_scoring_worker` and `buyerrecon_customer_api`, and grants only
SELECT to `buyerrecon_internal_readonly`; only `buyerrecon_migrator` may write.

### 2.3 Gate4E / Gate4F boundary
**[FACT]** There are **zero** `Gate4E` / `Gate4F` string references in `src/` or `scoring/`.
These gates are governance concepts (glossary/process), not code artifacts in this repo.
**[HYPOTHESIS]** Gate4E/4F enforcement is therefore procedural/external; there is no
in-repo code path to audit for them beyond the record-only + grant boundaries.

### 2.4 Lane / scoring interactions and record-only enforcement
**[FACT]** `scoring/version.yml` declares `status: record_only` and
`automated_action_enabled: false`. Every scoring worker calls
`assertScoringContractsOrThrow()` (`src/scoring/contracts.ts:489`, validation at
`:233-277`) at startup and **throws** (fails closed) if `status !== 'record_only'`,
`automated_action_enabled !== false`, or any activation flag is true. This is the primary
in-code automated-action gate.

### 2.5 State transitions and idempotency
**[FACT]** Persistence is idempotent by design: v1 ingest uses `ON CONFLICT DO NOTHING` on
`(workspace_id, site_id, client_event_id)` (`persistence.ts:145-150`); the scoring workers
UPSERT on explicit natural keys (Stage 0 5-col key; Risk Evidence 5-col key
`risk-evidence/worker.ts` UPSERT; POI/POI-sequence 5-col keys). Re-running a worker
refreshes the same rows rather than duplicating.
**[HYPOTHESIS]** Idempotency depends on the natural keys staying stable across version
bumps; a `*_version` change intentionally creates new rows (replay/provenance), which is
correct but means "re-run" semantics differ before vs. after a version bump — worth an
explicit characterization test (roadmap Phase B).

---

## 3. BuyerRecon Backend Boundary Observations

### 3.1 Module / worker boundaries
**[FACT]** Pure adapters (`src/scoring/poi-core/adapter.ts`,
`src/scoring/risk-core-bridge/adapter.ts`, the risk-evidence compute path) are cleanly
separated from DB workers; adapter modules document "No DB. No HTTP. No side effects on
import." Workers own all DB I/O.

**[FACT]** Four CLI workers (`scripts/run-stage0-worker.ts`,
`run-risk-evidence-worker.ts`, `run-poi-core-worker.ts`, `run-poi-sequence-worker.ts`) each
construct their **own** `pg.Pool` (`max: 4, idleTimeoutMillis: 5000`); the Express app has
a separate single pool (`src/db/client.ts:5-9`, `max: 10`).

### 3.2 Dependency direction (acyclic)
**[FACT]**
```text
accepted_events → stage0_decisions → risk_observations_v0_1 → risk-core-bridge (observer only)
              ↘ session_behavioural_features_v0_2 ↗
accepted_events → session_features → poi_observations_v0_1 → poi_sequence_observations_v0_1
```
Direction flows forward (ingest → stage0 → risk/POI → observers); no observed back-edges
into ingestion. **[FACT]** Each worker documents "forbidden reads" of upstream/sibling
tables (e.g. `risk-evidence/worker.ts:20-21`).

### 3.3 Stage0 / Step2E / Risk worker relationship
**[FACT]** Risk Evidence reads `stage0_decisions` (excluded=FALSE) joined to
`session_behavioural_features_v0_2`; Stage 0 is the eligibility gate upstream of Risk
Evidence. **[FACT]** The RECORD_ONLY mode for Risk Evidence is enforced by
`src/scoring/risk-evidence/record-only.ts:35-51` (both `RISK_EVIDENCE_RECORD_ONLY=true` and
`RISK_EVIDENCE_CAPTURE_MODE=RECORD_ONLY` required; partial/ambiguous state throws
`record_only_mode_ambiguous_fails_closed`). **[FACT/preserved]** The Risk worker's runtime
failure (PR #349–#359) remains categorized only as `runtime_dependency_or_build_failure`
with `likely_failure_surface=unknown`; this audit adds no new inference about it.

### 3.4 Config / env boundaries
**[FACT]** Registered constants live in `config/constants.ts` + `.claude/constants.md`; a
guardrail `scripts/check-no-raw-constants.mjs` (`npm run check:constants`) forbids raw
literals for registered constants in code. Safe-log blocklist regexes for
`DATABASE_URL`/`PRODUCTION_DATABASE_URL`/`STAGING_DATABASE_URL` exist in
`src/reports/external/safe-claims.ts`.

### 3.5 DB access pattern & least-privilege posture
**[FACT]** All DB access in `src/` and `scripts/` uses a **single** `process.env.DATABASE_URL`.
The role-separated DSN names referenced in governance (`APP_DSN`, `ADMIN_DSN`, `RUNNER_DSN`,
`STAGE0_RUNNER_DSN`) are **not implemented in code** — role separation is expressed at the
**Postgres grant layer** (`migrations/016`), not via distinct connection strings in the app.
**[HYPOTHESIS]** Therefore the least-privilege posture depends entirely on which DB role the
single `DATABASE_URL` resolves to at runtime per process; the code cannot itself guarantee a
worker connects as `buyerrecon_scoring_worker` vs. a broader role. This is consistent with
the prior Stage0 finding chain (runner-binding "documented but not proven"); it is a
**boundary observation**, not a defect claim, and any change here is governance-gated.

---

## 4. Code-Quality Observations (facts only)

**[FACT]** Largest `src/` files: `scoring/contracts.ts` (717),
`poi-sequence-table-observer/query.ts` (664), `poi-core-worker/worker.ts` (573),
`timing-product-context-observer/runner.ts` (565), `risk-evidence/worker.ts` (560),
`product-context-timing-observer/runner.ts` (551), `collector/v1/orchestrator.ts` (537),
`risk-core-bridge-observer/mapper.ts` (536), `collector/v1/persistence.ts` (498).

**[FACT] Duplication:** the `pg.Pool` construction block is repeated across 15+ scripts
(4 workers + observation scripts); DATABASE_URL parsing/masking is repeated across several
runners; seven `*-observer` modules share the identical `index/query/mapper/report/runner`
shape.

**[FACT] Mixed responsibilities (size/role signal, not a correctness claim):**
`poi-core-worker/worker.ts` combines orchestration + Stage0 side-read + UPSERT-param
building + report aggregation; several `*-observer/runner.ts` combine query + mapping +
markdown/JSON report generation.

**[HYPOTHESIS] Naming drift / ownership:** the coexistence of `product-context-timing-observer`
and `timing-product-context-observer` (near-mirror names, both ~550 lines) suggests possible
naming drift or overlapping ownership; confirm intended distinction before any consolidation.

**[FACT] Testability:** worker DB I/O is isolated behind pure adapters, which is favorable
for characterization tests; but each worker's `main()` wires env-parsing + pool + I/O
together, so end-to-end worker behavior is only exercisable with a DB (out of scope here).

---

## 5. Confirmed Strengths

- **[FACT]** Fail-closed record-only contract gate on every worker (`contracts.ts`).
- **[FACT]** DB-grant least-privilege boundary for Lane A/B output (`migrations/016`).
- **[FACT]** Pure-adapter / DB-worker separation enabling deterministic unit testing.
- **[FACT]** Idempotent UPSERT/`ON CONFLICT` persistence with explicit natural keys.
- **[FACT]** Constants guardrail + safe-log blocklist reduce raw-secret leakage risk.

---

## 6. Open Questions (require confirmation before action)

1. **[HYPOTHESIS]** Does any deployment path actually bind workers to
   `buyerrecon_scoring_worker` (vs. a broad `DATABASE_URL`)? Code cannot confirm; governance
   docs must.
2. **[HYPOTHESIS]** Are `product-context-timing-observer` and
   `timing-product-context-observer` intentionally distinct, or drift to consolidate?
3. **[HYPOTHESIS]** Is `src/reports/external/**` intended to become a customer-output path,
   and if so under which gate? Today it is observer-only.
4. **[HYPOTHESIS]** Is the legacy `/collect` route (`src/collector/routes.ts`) still required
   alongside `/v1/*`, or a deprecation candidate?

---

## 7. Explicitly Out of Scope / Sealed

- The Risk worker's private runtime cause (`run.err` / `run.safe.out`) — **sealed**; not read,
  not inferred. Category remains `runtime_dependency_or_build_failure`; surface `unknown`.
- Any production/runtime/DB/role verification — governance-gated, not performed.
- Any source/config/schema change — deferred to the companion roadmap and separate GO.

---

## 8. Safety / Raw-Data Boundary

This document contains no secrets, DSNs, connection strings, passwords, tokens, hosts, ports,
IPs, private capture paths/pointers, raw runtime output, exact error lines, stack traces,
exception text, raw SQL results, or customer data. All identifiers are public code paths,
table/role names, and public git commit hashes. It is read-only and authorizes no execution.
