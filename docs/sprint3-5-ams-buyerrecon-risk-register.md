# Sprint 3.5 — AMS / BuyerRecon Risk Register (Review-Only)

**Status:** `SPRINT3_5_AMS_BUYERRECON_RISK_REGISTER_REVIEW_ONLY`

This is a **review-only risk register** produced by static inspection only. It **records and
rates risks**; it **changes nothing** and **authorizes no execution** — no source/config/
runtime/DB/deploy/customer-output action. Each entry separates the **observation [FACT]/
[HYPOTHESIS]** from the **recommended mitigation** (the mitigation is a proposal, gated to the
roadmap, not an action taken here).

**Preserved state:** Risk worker remains `runtime_dependency_or_build_failure` (broad),
final subclassifier retry `blocked / none_not_classified`, `likely_failure_surface = unknown`.
No entry infers the sealed runtime cause.

Severity scale: **S1** critical / **S2** high / **S3** medium / **S4** low.
Likelihood: **L-High / L-Med / L-Low**. "Confidence" = confidence in the *observation*.

---

## 1. Architectural Risks

| ID | Risk | Sev | Likelihood | Confidence | Observation | Recommended mitigation (gated) |
| --- | --- | --- | --- | --- | --- | --- |
| A-1 | Duplicated `pg.Pool` construction across 15+ scripts drifts (pool sizing/timeout inconsistency) | S3 | L-Med | [FACT] | Identical pool block repeated in 4 workers + observation scripts | Roadmap C1 shared factory (after Phase B) |
| A-2 | Seven near-identical `*-observer` modules drift in behavior | S3 | L-Med | [FACT] | Same index/query/mapper/report/runner shape ×7 | Roadmap D template extraction, sliced 1/PR |
| A-3 | Possible naming drift `product-context-timing-observer` vs `timing-product-context-observer` | S3 | L-Med | [HYPOTHESIS] | Near-mirror names, ~550 lines each | Resolve audit open-Q #2 before any consolidation |
| A-4 | Oversized files mix responsibilities (query+map+report) | S3 | L-Med | [FACT] | contracts.ts 717; several runners ~550 | Roadmap C3 responsibility split (no logic change) |
| A-5 | Legacy `/collect` route coexists with `/v1/*` | S4 | L-Low | [FACT] | `src/collector/routes.ts` legacy path | Confirm deprecation intent (open-Q #4) before removal |

---

## 2. Operational Risks

| ID | Risk | Sev | Likelihood | Confidence | Observation | Recommended mitigation (gated) |
| --- | --- | --- | --- | --- | --- | --- |
| O-1 | Workers are out-of-band CLIs with independent pools; no shared orchestration/health | S3 | L-Med | [FACT] | Each `scripts/run-*.ts` self-contained | Document run order + preconditions (Phase A diagram) |
| O-2 | Idempotency semantics change across a `*_version` bump (new rows vs refresh) | S3 | L-Med | [HYPOTHESIS] | UPSERT on natural keys incl. version | Characterization test (Phase B) to pin behavior |
| O-3 | Re-run of a worker as a "test" during refactor could mutate rows | S2 | L-Low | [FACT] | Workers UPSERT durable tables | Roadmap forbids worker rerun for refactor validation |

---

## 3. DB / Permission Risks

| ID | Risk | Sev | Likelihood | Confidence | Observation | Recommended mitigation (gated) |
| --- | --- | --- | --- | --- | --- | --- |
| D-1 | Least-privilege depends on which role a single `DATABASE_URL` resolves to; code cannot enforce role separation | S2 | L-Med | [FACT]+[HYPOTHESIS] | All access via one `DATABASE_URL`; DSN role names not in code (audit §3.5) | Governance-verify runtime role binding (Phase E / production-parameter GO) — **not** a code change here |
| D-2 | Lane A/B grant boundary is the only durable customer-output gate | S2 | L-Low | [FACT] | `migrations/016` REVOKEs; only migrator writes | Treat `migrations/016` posture as an invariant; no weakening |
| D-3 | A future Lane A/B writer could bypass the record-only intent if added without the grant/gate | S1 | L-Low | [HYPOTHESIS] | No writer today; gate is procedural + grant | Phase E only, separate approval + grant governance |

---

## 4. Secret / Custody Risks

| ID | Risk | Sev | Likelihood | Confidence | Observation | Recommended mitigation (gated) |
| --- | --- | --- | --- | --- | --- | --- |
| S-1 | Raw connection string handling centralized on `DATABASE_URL`; masking is per-runner and duplicated | S3 | L-Med | [FACT] | Repeated URL parse/mask across runners | Shared mask util (Roadmap C2) to reduce inconsistent masking |
| S-2 | Report path could log sensitive values if blocklist drifts | S3 | L-Low | [FACT] | `safe-claims.ts` regex blocklist for `*DATABASE_URL` | Keep blocklist coverage under test (Phase B) |
| S-3 | Constants guardrail must stay green to prevent raw-literal secret leakage | S3 | L-Low | [FACT] | `check:constants` enforces registry | Continue running `npm run check:constants` per PR |

---

## 5. Runtime / Classifier Risks (sealed — no inference)

| ID | Risk | Sev | Likelihood | Confidence | Observation | Recommended mitigation (gated) |
| --- | --- | --- | --- | --- | --- | --- |
| R-1 | Risk worker runtime failure unresolved; category broad | S2 | L-Med | [FACT/preserved] | `runtime_dependency_or_build_failure`; `likely_failure_surface=unknown`; retry `blocked/none_not_classified` | **Frozen**; separate diagnostics GO only; do not read `run.err`/`run.safe.out`, do not rerun |
| R-2 | Refactoring risk-evidence modules could perturb the sealed failure | S2 | L-Low | [HYPOTHESIS] | Refactor could mask/alter the unresolved surface | Roadmap "do not touch yet" freeze on `risk-evidence/**` runtime behavior |
| R-3 | Temptation to infer the internal blocked reason from captures | S1 | L-Low | [FACT] | Blocked reason is sealed by design | Prohibited; category/surface stay as recorded |

---

## 6. AMS / Customer-Output Risks

| ID | Risk | Sev | Likelihood | Confidence | Observation | Recommended mitigation (gated) |
| --- | --- | --- | --- | --- | --- | --- |
| C-1 | `src/reports/external/**` exists but is unwired; accidental activation would create customer output | S2 | L-Low | [FACT] | Observer-only today; not routed | Keep unwired; any activation is Phase E + Gate governance |
| C-2 | Reserved-name guards (`AMS_RESERVED_*`) could be bypassed by a careless rename | S3 | L-Low | [FACT] | Guards in `timing-product-context-observer/types.ts:294-322` | Keep guards under test; no rename without check |
| C-3 | Gate4E/Gate4F are procedural (no code artifact) — enforcement is external | S3 | L-Med | [FACT]+[HYPOTHESIS] | Zero `Gate4E/4F` refs in code | Do not assume in-code enforcement; keep governance in the loop |

---

## 7. Testing / Release Risks

| ID | Risk | Sev | Likelihood | Confidence | Observation | Recommended mitigation (gated) |
| --- | --- | --- | --- | --- | --- | --- |
| T-1 | Worker `main()` end-to-end paths need DB → not unit-testable without runtime | S3 | L-Med | [FACT] | env-parse+pool+I/O wired in `main()` | Phase B pure/static tests around adapters + contracts only (no DB) |
| T-2 | Mechanical refactor without characterization could silently change output | S2 | L-Med | [HYPOTHESIS] | Large modules, no per-module output pin | Enforce Phase B green **before** Phase C |
| T-3 | Running DB/network tests in this workstream is forbidden | S3 | L-Low | [FACT] | Scope forbids DB/network tests | Limit to pure/static; justify any `npm` static-metadata check |

---

## 8. Top Priorities (proposal only)

1. **R-1/R-2/R-3** — keep Risk-worker runtime **frozen**; no inference, no rerun, no refactor.
2. **D-1** — governance-verify runtime DB role binding (not a code change here).
3. **T-2 → B before C** — characterization tests must precede any mechanical refactor.
4. **C-1/D-3** — keep customer-output/Lane-A/B **unwired** until Phase E + gate governance.

---

## 9. Safety / Non-Authorization

This register records risks and **proposed** (gated) mitigations only. It performs no
source/config/schema/runtime/DB/deploy/customer-output action and authorizes no execution.
It contains no secrets, DSNs, private paths, raw runtime output, exact error lines, stack
traces, SQL results, or customer data — only public code paths, table/role names, and public
git commit hashes. The Risk-worker sealed state is preserved unchanged.
