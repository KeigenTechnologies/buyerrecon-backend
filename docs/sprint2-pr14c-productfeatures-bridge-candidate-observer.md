# Sprint 2 PR#14c — ProductFeatures Bridge Candidate Observer

**Status.** IMPLEMENTATION. Read-only observer CLI per PR#14a §12
Option C. Reuses PR#13b's preview pipeline + PR#14b's pure bridge
mapper. **No DB writes, no durable bridge table, no migration, no
AMS runtime execution.**

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` — workflow
  truth file.
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md`
  (commit `982e90e`) — §12 Option C scope; §11 validation strategy.
- `docs/sprint2-pr14b-productfeatures-namespace-bridge-mapper.md`
  (commit `1441c86`) — PR#14b pure mapper consumed here.
- `docs/sprint2-pr13b-product-context-timing-observer.md`
  (commit `469b203`) — PR#13b preview pipeline reused here.

---

## §1 Files in this PR

| Path | Purpose |
| --- | --- |
| `src/scoring/product-context-timing-observer/runner.ts` | **Modified.** Extracted `runProductContextTimingObserverDetailed` returning `{ report, previews }`. Existing `runProductContextTimingObserver` delegates to it; behaviour unchanged. `timingBucketLabel` is now exported for PR#14c reuse. |
| `src/scoring/product-context-timing-observer/index.ts` | **Modified.** Re-exports `runProductContextTimingObserverDetailed`, `DetailedObserverResult`, `timingBucketLabel`. |
| `src/scoring/product-features-bridge-candidate-observer/types.ts` | NEW. `BridgeCandidateObserverReport`, `BridgeCandidateSample`, version stamp `BRIDGE_CANDIDATE_OBSERVER_VERSION`. |
| `src/scoring/product-features-bridge-candidate-observer/runner.ts` | NEW. `runBridgeCandidateObserver`, `buildBridgeMapperInputFromPreview`, `decideBridgeCandidateObserverExit`, `rejectReasonFamily`. |
| `src/scoring/product-features-bridge-candidate-observer/report.ts` | NEW. `renderBridgeCandidateObserverMarkdown` (8-section structured markdown). |
| `src/scoring/product-features-bridge-candidate-observer/index.ts` | NEW. Public re-exports. |
| `scripts/product-features-bridge-candidate-observation-report.ts` | NEW. CLI runner with env-parser, masked DSN, exit-code propagation. |
| `package.json` | **Modified.** Single new script `observe:product-features-bridge-candidate`. |
| `tests/v1/product-features-bridge-candidate-observer.test.ts` | NEW. 20-requirement coverage (Groups A–V). |
| `docs/sprint2-pr14c-productfeatures-bridge-candidate-observer.md` | NEW. This implementation doc. |

**No changes** to: migrations, `schema.sql`, DB, AMS repo, PR#14b
mapper source, PR#13b mapper / query / types / report / CLI, other
observers.

---

## §2 PR#13b minimal extraction

The smallest safe surface change:

1. The body of `runProductContextTimingObserver` was renamed to
   `runProductContextTimingObserverDetailed` and its return type
   widened to `{ report, previews }`.
2. `runProductContextTimingObserver` now delegates:
   `return (await runProductContextTimingObserverDetailed(args)).report;`
3. `timingBucketLabel` (previously module-private) is now exported.

Tests:
- PR#13b's existing test suite (`tests/v1/product-context-timing-observer.test.ts`) passes unchanged — observer behaviour, exit codes, sample masking, and aggregations all still hold.
- PR#14c test Group S explicitly verifies the three contract points (existing function signature preserved, detailed function exported, `timingBucketLabel` exported).

---

## §3 Observer behaviour

### Pipeline

1. **PR#13b detailed fetch.** `runProductContextTimingObserverDetailed(args)` returns the structured `ObserverReport` AND the per-session `SessionPreview[]`. No new SQL.
2. **Per-session bridge build.** For every accepted preview (`accepted_into_preview === true`):
   - Convert to a `BridgeMapperInput` via `buildBridgeMapperInputFromPreview` (pure adapter; uses `timingBucketLabel` for the timing bucket; derives conversion-proximity indicators from per-session signals using only the PR#14b-allowed keys).
   - Call PR#14b `buildBridgeNamespaceCandidate(input)`.
   - If `ok`: count distributions, aggregate feature stats, push (up to `sample_limit`) into samples.
   - If `!ok`: count reject reasons by family.
3. **Render** structured `BridgeCandidateObserverReport` → markdown to stdout.
4. **Exit decision** via `decideBridgeCandidateObserverExit`:
   - `fail_closed` source readiness → exit 2.
   - `candidate_inputs_seen > 0 && candidates_built === 0` → exit 2 (every accepted preview rejected by PR#14b).
   - Otherwise → exit 0.

### Source boundary (carried verbatim from PR#13b)

**Allowed:**
- `poi_observations_v0_1`
- `poi_sequence_observations_v0_1`
- `information_schema.tables`
- `information_schema.columns`

**Forbidden:** all of `accepted_events`, `rejected_events`, `ingest_requests`, `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`, `site_write_tokens`. PR#14c runs no new SQL; PR#13b's existing SQL constants are the only reads.

### Privacy posture

- Bridge candidates carry no `session_id`, no raw URL, no query string, no email-shaped or PII-shaped fields — PR#14b's recursive validators reject any such payload before it reaches the sample.
- Samples include a **truncated session-id prefix only** (`prefix(8)…suffix(4)`).
- DSN masked at the report boundary (host + db name only; password never emitted).
- Every sample carries `sample_metadata` with six `true` flags: `internal_only`, `non_authoritative`, `not_customer_facing`, `does_not_execute_ams_product_layer`, `does_not_create_product_decision`, `exact_ams_struct_compatibility_unproven_until_fixture`.

### AMS reserved-name guard

PR#14c runtime source defines no reserved AMS Product Layer name as a TypeScript identifier (test Group M). No `FIT.*` / `INTENT.*` / `WINDOW.*` reason-code namespace strings (test Group L).

### Determinism

`buildBridgeMapperInputFromPreview` is a pure function. No `Date.now()`, no `new Date()`, no `Math.random()` inside the adapter (test Group N enforces by extracting the function body and scanning it). The CLI / report builder use ISO-8601 timestamps that flow from the explicit `evaluation_at` option or the PR#13b runner's existing wall-clock fields.

---

## §4 CLI usage

```bash
DATABASE_URL=postgres://user:password@host:5432/buyerrecon_staging \
OBS_WORKSPACE_ID=buyerrecon_staging_ws \
OBS_SITE_ID=buyerrecon_com \
OBS_WINDOW_HOURS=720 \
OBS_SAMPLE_LIMIT=3 \
OBS_CATEGORY_TEMPLATE=generic_b2b \
OBS_PRIMARY_CONVERSION_GOAL=request_diagnostic \
OBS_SALES_MOTION=sales_led \
  npm run observe:product-features-bridge-candidate
```

| Env var | Required | Default |
| --- | --- | --- |
| `DATABASE_URL` | yes | — |
| `OBS_WORKSPACE_ID` | yes | — |
| `OBS_SITE_ID` | yes | — |
| `OBS_WINDOW_HOURS` | no | 720 |
| `OBS_SINCE` / `OBS_UNTIL` | no | — |
| `OBS_LIMIT` | no | 10000 |
| `OBS_SAMPLE_LIMIT` | no | 3 |
| `OBS_CATEGORY_TEMPLATE` | no | `generic_b2b` |
| `OBS_PRIMARY_CONVERSION_GOAL` | no | `request_diagnostic` |
| `OBS_SALES_MOTION` | no | `sales_led` |

Exit codes:
- `0` — report rendered, source readiness OK, at least one accepted preview produced a valid bridge candidate (or no accepted previews to attempt).
- `2` — missing required env, invalid CLI option, SQL/connection failure, `fail_closed` source readiness, or all candidate inputs rejected.

---

## §5 Hetzner staging proof plan (deferred to a separate proof step)

Locked 7-step cadence:

1. Codex re-review of PR#14c.
2. Helen sign-off.
3. Commit on `sprint2-architecture-contracts-d4cc2bf`.
4. Push to origin.
5. Hetzner proof at pushed HEAD:

   ```bash
   ssh hetzner-buyerrecon
   cd /opt/buyerrecon-backend
   git fetch origin && git checkout sprint2-architecture-contracts-d4cc2bf && git pull --ff-only
   npm ci && npx tsc --noEmit && npm run check:scoring-contracts
   npm test -- tests/v1/product-features-bridge-candidate-observer.test.ts
   npm test -- tests/v1/product-features-namespace-bridge.test.ts
   npm test -- tests/v1/product-context-timing-observer.test.ts

   OBS_WORKSPACE_ID=buyerrecon_staging_ws \
   OBS_SITE_ID=buyerrecon_com \
   OBS_WINDOW_HOURS=720 \
     npm run observe:product-features-bridge-candidate | tee /tmp/pr14c.md
   ```

6. Optional transcript paste.
7. PR chain close.

### Expected current staging proof

Based on PR#13b's last PASS (`469b203`): 8 POI rows / 8 POI Sequences / 6 stage0_excluded / 2 eligible.

| Field | Expected |
| --- | --- |
| `source_readiness.fail_closed` | false |
| `product_context_observer_input.preview_accepted_rows` | 2 |
| `product_context_observer_input.preview_rejected_rows` | 6 (all `stage0_excluded_session`) |
| `bridge_candidate_generation.candidate_inputs_seen` | 2 |
| `bridge_candidate_generation.candidates_built` | 2 |
| `bridge_candidate_generation.candidates_rejected` | 0 |
| `bridge_candidate_generation.namespace_key_candidate_distribution.buyerrecon` | 2 |
| `candidate_feature_summary.surface_distribution_aggregate.pricing` | matches PR#13b's pricing count |
| `candidate_feature_summary.actionability_band_distribution.warm_recent` | 2 |
| `read_only_proof.*` | all true ✓ |
| `exit_decision.exit_code` | 0 |
| Pre = Post on every monitored table | observer wrote nothing |

### Architecture Gate A0 P-4

Render production deploy remains **BLOCKED** by A0 P-4. PR#14c only proves staging.

---

## Hetzner staging proof — PASS

**Date.** 2026-05-15. **Server.** `/opt/buyerrecon-backend`.
**Branch.** `sprint2-architecture-contracts-d4cc2bf`.
**HEAD.** `4b3b1b64defc61f6ae95106b59d3834e32e93b39` (short `4b3b1b6`).
**Final working tree.** Clean (after restoring server-side
`package-lock.json` changes caused by `npm install`; see operator
notes).

### Static validation on server

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| `npm test -- tests/v1/product-features-bridge-candidate-observer.test.ts` | **30 / 30** PASS |
| `npm test -- tests/v1/product-features-namespace-bridge.test.ts` | **116 / 116** PASS |
| `npm test -- tests/v1/product-context-timing-observer.test.ts` | **82 / 82** PASS |
| `npm test` (full suite) | **51 files / 2941 tests** PASS |
| `git diff --check` | PASS |
| No-DB smoke: `env -u DATABASE_URL npm run observe:product-features-bridge-candidate` | exit `2` with controlled `DATABASE_URL is required …` error; no full URL leak; no secret leak |

### Staging environment

| Var | Value |
| --- | --- |
| `OBS_WORKSPACE_ID` | `buyerrecon_staging_ws` |
| `OBS_SITE_ID` | `buyerrecon_com` |
| `OBS_WINDOW_HOURS` | `720` |
| DB | `127.0.0.1:5432/buyerrecon_staging` |

### Observer run

**Command.**

```bash
OBS_WORKSPACE_ID=buyerrecon_staging_ws \
OBS_SITE_ID=buyerrecon_com \
OBS_WINDOW_HOURS=720 \
  npm run observe:product-features-bridge-candidate
```

**Exit.** `0`.

**Source readiness.** `fail_closed = no`.

**Row counts scanned.**

| Counter | Value |
| --- | --- |
| `poi_rows_scanned` | 8 |
| `poi_sequence_rows_scanned` | 8 |
| unique sessions seen | 8 |

**PR#13b preview pipeline (inherited).**

| Counter | Value |
| --- | --- |
| `preview_accepted_rows` | 2 |
| `preview_rejected_rows` | 6 |
| reject reason `stage0_excluded_session` | 6 |

**Bridge candidate generation.**

| Counter | Value |
| --- | --- |
| `candidate_inputs_seen` | 2 |
| `candidates_built` | 2 |
| `candidates_rejected` | 0 |
| `namespace_key_candidate_distribution.buyerrecon` | 2 |
| `bridge_contract_version_distribution.productfeatures-namespace-bridge-contract-v0.1` | 2 |
| `bridge_payload_version_distribution.productfeatures-namespace-candidate-v0.1` | 2 |

**Candidate feature summary.**

| Field | Value |
| --- | --- |
| `surface_distribution_aggregate.homepage` | 2 |
| `actionability_band_distribution.warm_recent` | 2 |
| `conversion_proximity_indicator_distribution.pricing_visited` | 0 |
| `conversion_proximity_indicator_distribution.comparison_visited` | 0 |
| `conversion_proximity_indicator_distribution.demo_request_visited` | 0 |
| `progression_depth_bucket.1` | 2 |
| `mapping_coverage_percent` (min / max / avg) | 100.0% / 100.0% / 100.0% |
| `hours_since_last_qualifying_activity` (min / max / avg) | 93.4 / 93.5 / 93.45 |

**Sample candidates.** Internal-only sample candidates emitted.
Each sample carried all six `true` flags
(`internal_only`, `non_authoritative`, `not_customer_facing`,
`does_not_execute_ams_product_layer`, `does_not_create_product_decision`,
`exact_ams_struct_compatibility_unproven_until_fixture`).

**Privacy posture confirmed in the rendered output.**

- No full session IDs (truncated `prefix(8)…suffix(4)` only).
- No raw URLs.
- No query strings.
- No email / person / company / enrichment fields.
- No `FIT.*` / `INTENT.*` / `WINDOW.*` output.
- No AMS Product Layer runtime execution.
- No `ProductDecision`.
- No customer output.

### Pre / Post count proof (observer wrote nothing)

| Table | Before | After |
| --- | --- | --- |
| `accepted_events` | 16 | 16 |
| `ingest_requests` | 16 | 16 |
| `rejected_events` | 0 | 0 |
| `poi_observations_v0_1` | 8 | 8 |
| `poi_sequence_observations_v0_1` | 8 | 8 |
| `risk_observations_v0_1` | 2 | 2 |
| `scoring_output_lane_a` | 0 | 0 |
| `scoring_output_lane_b` | 0 | 0 |

Every monitored table unchanged across the observer run.

### Regression — adjacent observers still PASS

**`npm run observe:product-context-timing` (PR#13b):**
- `source_readiness.fail_closed = no`
- `poi_rows_scanned = 8`
- `poi_sequence_rows_scanned = 8`
- `rows_accepted_into_preview = 2`
- `rows_rejected_from_preview = 6`
- reject reason `stage0_excluded_session = 6`
- read-only proof block all true

**`npm run observe:poi-table` (PR#11c):**
- `rows_in_table = 8`
- `total_anomalies = 0`

**`npm run observe:poi-sequence-table` (PR#12d):**
- `rows_in_table = 8`
- `total_anomalies = 0`

### Boundary confirmations

- No Render.
- No production DB.
- No migration.
- No `schema.sql` change.
- No DB writes.
- No `psql` mutation.
- No collector change.
- No Lane A / Lane B writes or output.
- No Trust / Policy output.
- No customer output.
- No AMS Product Layer runtime execution.
- No `ProductDecision`.
- No durable bridge table.

### Operator notes

- One harmless shell typo prior to the observer run produced
  `OBS_WINDOW_HO: command not found`. The shell rejected the bad
  variable assignment before any node process started. No DB or code
  was touched.
- `npm install` on the server modified `package-lock.json` by
  removing optional dependency libc metadata in the lockfile output.
  That server-side `package-lock.json` change was inspected and
  restored. Final server working tree was clean.

### Result

PR#14c **PASSES Hetzner staging proof** under all constraints.
PR#14c is now ready for chain close.

---

## §6 Rollback path

Forward-only at the file level. To revert PR#14c:

```bash
git rm -r src/scoring/product-features-bridge-candidate-observer
git rm scripts/product-features-bridge-candidate-observation-report.ts
git rm tests/v1/product-features-bridge-candidate-observer.test.ts
git rm docs/sprint2-pr14c-productfeatures-bridge-candidate-observer.md

# Remove the npm script line from package.json (manual edit):
#   "observe:product-features-bridge-candidate": "tsx scripts/product-features-bridge-candidate-observation-report.ts",

# Optional: revert the PR#13b runner extraction (re-inline
# runProductContextTimingObserver, un-export timingBucketLabel) if
# the surface area is desired smaller. Existing PR#13b tests still
# pass either way.
```

**No DB rollback needed.** PR#14c writes nothing.

---

## §7 PR checklist (workflow truth file §24)

| Field | Value |
| --- | --- |
| **Workflow layer** | Bridge layer / read-only observer CLI bridging PR#13b preview shape to PR#14b candidate; PR#14a §12 Option C |
| **Allowed source tables** | PR#13b allowed set (`poi_observations_v0_1`, `poi_sequence_observations_v0_1`, `information_schema.{tables, columns}`) |
| **Forbidden source tables** | All other tables (test Group A enforces) |
| **Customer-facing or internal-only** | Internal-only; every sample carries six `true` flags including `not_customer_facing` |
| **Score / verdict / reason-code allowed?** | Forbidden — bridge candidate emits NO Fit/Intent/Window/TRQ scores; recursive validator rejects AMS `FIT.*` / `INTENT.*` / `WINDOW.*` reason codes (PR#14b enforcement carries through) |
| **DB writes** | None |
| **Observer-first or durable table** | Observer (Option C; no durable table) |
| **Version fields** | Carries `bridge_candidate_observer_version`, `bridge_contract_version`, `bridge_payload_version` + every PR#14b version stamp inside each candidate |
| **Rollback path** | File-level removal + optional PR#13b extraction revert |
| **Codex review checklist** | Source allowlist (Group A), no-write guarantee (Group B), no new SQL (Group O), PR#14b mapper reuse (Groups C/D/E), exit-decision matrix (Group R), AMS reserved-name guard (Groups L/M), no-clock-in-mapper (Group N), package.json single-script (Group P), PR#13b + PR#14b behaviour unchanged (Groups S/T), markdown read-only-proof block (Group U) |

---

**End of PR#14c implementation documentation.**
