# Sprint 2 PR#13b — Product-Context / Timing Observer (Option C)

**Status.** IMPLEMENTATION. Read-only observer per PR#13a §14
Option C. Helen sign-off OD-1..OD-15 (PR#13a, commit `6739bc7`)
implemented here. **No durable table, no migration, no DB writes.**

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` — §11
  Product-Context Fit, §14 Timing Window Detection (in-session only).
- `docs/sprint2-pr13a-product-context-fit-timing-window-planning.md`
  (commit `6739bc7`) — Helen-signed OD-1..OD-15; §2.1 AMS Product
  Layer reference alignment; §17 AMS reserved-name guard.
- `docs/sprint2-pr12e-poi-sequence-table-observer.md` (`ab9d800`) —
  PR#12e Hetzner-PASS upstream evidence layer.
- AMS read-only references (NOT runtime imports):
  `docs/algorithms/BUYERRECON_PRODUCT_LAYER_ALGORITHM_SPEC_v2_0.md`,
  `internal/products/buyerrecon/scorer/types.go`,
  `internal/products/buyerrecon/adapter/feature_adapter.go`,
  `internal/contracts/features.go`.

---

## §1 Files in this PR

| Path | Purpose |
| --- | --- |
| `src/scoring/product-context-timing-observer/types.ts` | Type contract + frozen version stamps + enums + raw row shapes |
| `src/scoring/product-context-timing-observer/query.ts` | 5 read-only SQL constants (table-presence, column-presence, POI + POI Sequence fetches) |
| `src/scoring/product-context-timing-observer/mapper.ts` | Pure mapper — universal-surface classifier, actionability-band classifier, per-session preview builder, session-id masking |
| `src/scoring/product-context-timing-observer/report.ts` | Pure markdown renderer for the structured `ObserverReport` |
| `src/scoring/product-context-timing-observer/runner.ts` | Orchestrator: source-readiness probes, fetches, mapper, aggregator |
| `src/scoring/product-context-timing-observer/index.ts` | Public re-exports |
| `scripts/product-context-timing-observation-report.ts` | CLI runner (markdown to stdout, exit 0 on success / 2 on env/SQL error) |
| `package.json` | Single new npm script `observe:product-context-timing` |
| `tests/v1/product-context-timing-observer.test.ts` | Pure tests covering all 12 spec testing requirements |
| `docs/sprint2-pr13b-product-context-timing-observer.md` | This implementation doc |

No migration. No `schema.sql` change. No worker. No durable table.
No AMS code touched.

---

## §2 Source boundary

**Reads:** `poi_observations_v0_1` + `poi_sequence_observations_v0_1`
+ `information_schema.tables` (presence) + `information_schema.columns`
(required-column readiness).

**Writes:** None.

### Forbidden reads (enforced by static-source sweep + SQL allowlist)

- `accepted_events`, `rejected_events`, `ingest_requests`
- `session_features`, `session_behavioural_features_v0_2`
- `stage0_decisions`
- `risk_observations_v0_1`
- `scoring_output_lane_a`, `scoring_output_lane_b`
- `site_write_tokens`

### Fail-closed

When `poi_observations_v0_1` or `poi_sequence_observations_v0_1` is
absent, OR when a required column is missing on either table, the
observer fails closed with a clear `fail_closed_reason` and emits
no further queries. Required-column allowlists live in
`types.ts::REQUIRED_POI_COLUMNS` + `REQUIRED_POI_SEQUENCE_COLUMNS`.

---

## §3 What the observer produces

A **markdown report to stdout** with 8 sections (plus a run-metadata
footer):

1. **Boundary** — workspace, site, window, masked DSN, checked_at
2. **Source table readiness** — presence + required-column diff
3. **Source scan summary** — row counts, unique sessions, version stamps observed, time range
4. **Evidence quality summary** — accepted/rejected counts, reject-reason distribution, invalid-evidence_refs counter
5. **Product-context preview summary** — universal-surface distribution, category template, primary conversion goal, sales motion, mapping coverage %
6. **Timing / actionability summary** — band distribution, timing-bucket distribution, stale/dormant/insufficient_evidence counts, conversion-proximity indicators
7. **AMS-aligned JSON preview** — non-authoritative, internal-only, capped sample of accepted sessions in `BuyerReconProductFeatures`-compatible shape
8. **Read-only proof** — 8 boolean invariants (no DB writes, no Lane A/B, no Trust, no Policy, no customer output, no AMS Product Layer runtime, no durable table, no migration)

### Universal-surface taxonomy (v0.1 seed — PR#13a §4.2)

`homepage`, `pricing`, `demo_request`, `case_study`, `integration`,
`comparison`, `trust_security`, `documentation`, `contact`,
`resource`, `careers`, `legal_terms`, `legal_privacy`, `blog_post`,
`product_overview`, `feature_detail`, `developer`, `unknown`.

Baseline pattern rules apply suffix / contains matches deterministically
on already-normalised POI `poi_key` strings. Customer-specific
`site_mapping` overrides are NOT a PR#13b feature — they arrive in a
later PR (per PR#13a §4.5).

### Actionability bands (v0.1 — PR#13a §4.10)

`hot_now`, `warm_recent`, `cooling`, `stale`, `dormant`,
`insufficient_evidence`.

**Disjoint from AMS `WindowState`** (`in_window` / `approaching` /
`too_early` / `dormant`). The coincidental `dormant` overlap is
namespace-only; PR#13b runtime never emits AMS `WindowState` values
(enforced by test Group I + Group J).

Timing thresholds vary per `sales_motion` per
`TIMING_THRESHOLDS_BY_SALES_MOTION` (v0.1 seed; Helen OD-6 finalises
production values).

### AMS-aligned JSON preview shape

Each sample wraps under the key
`buyerrecon_product_features_shape_preview` (NOT
`BuyerReconProductFeatures`, which is AMS-reserved per PR#13a §17):

```json
{
  "truncated_session_id_prefix": "sess_aaa…1111",
  "buyerrecon_product_features_shape_preview": {
    "fit": {
      "page_type_distribution": { "pricing": 1, "demo_request": 1 },
      "mapping_coverage_percent": 100.0
    },
    "intent": {
      "pricing_signal_present": true,
      "comparison_signal_present": false,
      "poi_count": 2,
      "unique_poi_count": 2
    },
    "window": {
      "hours_since_last_session_or_null": 5.5,
      "session_in_window_band": "warm_recent",
      "progression_depth": 2
    }
  },
  "preview_metadata": {
    "non_authoritative": true,
    "internal_only": true,
    "alignable_with_ams_product_features_namespace": true,
    "must_not_be_treated_as_ams_runtime_output": true
  }
}
```

Capped at `OBS_SAMPLE_LIMIT` accepted sessions (default 3). Session
IDs masked via `truncateSessionId` at the report edge.

---

## §4 AMS reserved-name guard (PR#13a §17)

PR#13b runtime source MUST NOT define any of these as TypeScript
identifiers (types, classes, interfaces, enums, exported constants,
top-level variables):

- `Fit`, `FitFeatures`, `FitResult`, `FitScore`, `FitConfidence01`, `NonFitMarkers`, `HardSuppress`
- `Intent`, `IntentFeatures`, `IntentResult`, `IntentScore`, `IntentState`
- `Window`, `WindowFeatures`, `WindowResult`, `WindowState`
- `TRQ`, `TRQResult`, `TRQBand`, `TRQScore`, `TRQConfidence01`
- `ProductDecision`, `ProductFeatures`, `ProductScorerInput`, `ProductScorer`
- `BuyerReconConfig`, `BuyerReconProductFeatures`
- `RequestedAction`

PR#13b runtime source MUST NOT emit `FIT.*` / `INTENT.*` /
`WINDOW.*` reason-code namespace strings.

Enforced by test Groups I + J (static-source sweep over the 7
PR#13b runtime files).

PR#13b internal names use the namespace-disjoint convention:
`product_context_*`, `pcf_*`, `timing_*`, `actionability_*`,
`evidence_preview_*`.

---

## §5 CLI usage

```bash
DATABASE_URL=postgres://user:password@host:5432/buyerrecon_staging \
OBS_WORKSPACE_ID=buyerrecon_staging_ws \
OBS_SITE_ID=buyerrecon_com \
OBS_WINDOW_HOURS=720 \
OBS_SAMPLE_LIMIT=3 \
OBS_CATEGORY_TEMPLATE=generic_b2b \
OBS_PRIMARY_CONVERSION_GOAL=request_diagnostic \
OBS_SALES_MOTION=sales_led \
  npm run observe:product-context-timing
```

### Env vars

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | Masked in output (host + db name only; never printed in full) |
| `OBS_WORKSPACE_ID` | yes | — | Identity filter (exact match, not NULL-able) |
| `OBS_SITE_ID` | yes | — | Identity filter (exact match, not NULL-able) |
| `OBS_WINDOW_HOURS` | no | 720 | Bounds `derived_at >= now - hours AND < now` |
| `OBS_SINCE` / `OBS_UNTIL` | no | — | ISO-8601 overrides for the window |
| `OBS_LIMIT` | no | 10000 | Row LIMIT cap on both source SELECTs |
| `OBS_SAMPLE_LIMIT` | no | 3 | Number of accepted-session JSON preview samples |
| `OBS_CATEGORY_TEMPLATE` | no | `generic_b2b` | Must be in `CATEGORY_TEMPLATES_ALLOWED` |
| `OBS_PRIMARY_CONVERSION_GOAL` | no | `request_diagnostic` | Must be in `PRIMARY_CONVERSION_GOALS_ALLOWED` |
| `OBS_SALES_MOTION` | no | `sales_led` | Must be in `SALES_MOTIONS_ALLOWED` |

### Exit codes

- `0` — report generated.
- `2` — missing required env, invalid CLI option, SQL/connection failure, fail-closed source readiness.

---

## §6 Hetzner staging proof plan (deferred to a separate proof PR)

Locked 7-step cadence (mirrors PR#11d / PR#12b / PR#12d / PR#12e):

1. Codex re-review of PR#13b.
2. Helen sign-off.
3. Commit PR#13b on `sprint2-architecture-contracts-d4cc2bf`.
4. Push to origin.
5. Hetzner proof at pushed HEAD:

   ```bash
   ssh hetzner-buyerrecon
   cd /opt/buyerrecon-backend
   git fetch origin && git checkout sprint2-architecture-contracts-d4cc2bf && git pull --ff-only
   npm ci && npx tsc --noEmit && npm run check:scoring-contracts
   npm test -- tests/v1/product-context-timing-observer.test.ts

   # Pre-counts (no Lane A/B writes expected)
   psql "$DATABASE_URL" -c "SELECT 'lane_a', COUNT(*) FROM scoring_output_lane_a
                            UNION ALL SELECT 'lane_b', COUNT(*) FROM scoring_output_lane_b
                            UNION ALL SELECT 'poi', COUNT(*) FROM poi_observations_v0_1
                            UNION ALL SELECT 'poi_seq', COUNT(*) FROM poi_sequence_observations_v0_1;"

   # Observer run
   OBS_WORKSPACE_ID=buyerrecon_staging_ws OBS_SITE_ID=buyerrecon_com OBS_WINDOW_HOURS=720 \
     npm run observe:product-context-timing | tee /tmp/pr13b.md

   # Post-counts must equal pre-counts on every monitored table
   psql "$DATABASE_URL" -c "..."

   # Regression observers (concurrent PASS check)
   npm run observe:risk-core-bridge && npm run observe:poi-core-input && \
     npm run observe:poi-table && npm run observe:poi-sequence && \
     npm run observe:poi-sequence-table
   ```

6. Optional transcript paste.
7. PR chain close.

### Expected current staging proof

Based on PR#12e PASS (`ab9d800`): 8 POI rows / 8 POI sequences / 6
excluded / 2 eligible / all `single_poi`.

| Field | Expected |
| --- | --- |
| `source_readiness.fail_closed` | false |
| `source_scan.poi_rows_scanned` | 8 |
| `source_scan.poi_sequence_rows_scanned` | 8 |
| `source_scan.unique_session_ids_seen` | 8 |
| `evidence_quality.rows_accepted_into_preview` | 2 (the eligible sessions) |
| `evidence_quality.rows_rejected_from_preview` | 6 |
| `evidence_quality.reject_reason_counts.stage0_excluded_session` | 6 |
| `timing_actionability.actionability_band_distribution` | varies by sales_motion and POI recency on the staging seed |
| `read_only_proof.*` | all true ✓ |
| Pre = Post on every monitored table | ✓ |
| Lane A / Lane B pre vs post | 0 / 0 |

### Architecture Gate A0 P-4

Render production deploy remains **BLOCKED** by A0 P-4.

---

## Hetzner staging proof — PASS

**Date.** 2026-05-14.
**Server path.** `/opt/buyerrecon-backend`.
**Branch.** `sprint2-architecture-contracts-d4cc2bf`.
**HEAD.** `e20ad7b7a89c5d74bdfa378ad613442c0335b33f`.
**DB (masked).** `127.0.0.1:5432/buyerrecon_staging`.
**Final working tree.** Clean after restoring server-side
`package-lock.json` change written by `npm install`.

### Static validation

| Step | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| `npx vitest run tests/v1/product-context-timing-observer.test.ts` (targeted) | **82/82 PASS** |
| `npm test` (full suite) | **49 files / 2,795 tests PASS** |
| `git diff --check` | PASS (no whitespace errors) |

### Observer environment

```
OBS_WORKSPACE_ID=buyerrecon_staging_ws
OBS_SITE_ID=buyerrecon_com
OBS_WINDOW_HOURS=720
DATABASE_URL=<masked → 127.0.0.1:5432/buyerrecon_staging>
```

### Observer run — `npm run observe:product-context-timing`

| Signal | Result |
| --- | --- |
| CLI exit code | 0 (success) |
| `source_readiness.fail_closed` | `false` |
| `source_scan.poi_rows_scanned` | 8 |
| `source_scan.poi_sequence_rows_scanned` | 8 |
| `source_scan.unique_session_ids_seen` | 8 |
| `evidence_quality.rows_accepted_into_preview` | **2** |
| `evidence_quality.rows_rejected_from_preview` | **6** |
| `evidence_quality.reject_reason_counts.stage0_excluded_session` | 6 (Stage 0 carry-through — expected) |
| `product_context_preview.mapping_coverage_percent` | **100.0%** |
| `product_context_preview.universal_surface_distribution` | `{ homepage: 7, pricing: 1 }` |
| `timing_actionability.actionability_band_distribution` | `{ warm_recent: 8 }` |
| `timing_actionability.conversion_proximity_indicators` | `{ pricing_visited: 1 }` |
| AMS-aligned JSON preview emitted | yes — internal-only `buyerrecon_product_features_shape_preview` shape, capped at `OBS_SAMPLE_LIMIT` |
| Customer output | none |
| AMS Product Layer runtime execution | none |

### Pre / post table-count parity (unchanged across the observer run)

| Table | Pre | Post |
| --- | --- | --- |
| `accepted_events` | 16 | 16 |
| `ingest_requests` | 16 | 16 |
| `rejected_events` | 0 | 0 |
| `poi_observations_v0_1` | 8 | 8 |
| `poi_sequence_observations_v0_1` | 8 | 8 |
| `risk_observations_v0_1` | 2 | 2 |
| `scoring_output_lane_a` | 0 | 0 |
| `scoring_output_lane_b` | 0 | 0 |

**Observer wrote nothing.** All counts identical pre → post.

### Regression observers — concurrent PASS

| Observer | Result |
| --- | --- |
| `observe:poi-table` | PASS — `total_anomalies: 0` |
| `observe:poi-sequence-table` | PASS — `total_anomalies: 0` |

PR#11d / PR#12e behaviour remains intact after PR#13b lands. No
regression observed.

### Operator note (non-failure)

The first observer invocation on the Hetzner host had pasted-in
explanatory text directly into the shell, which produced harmless
lines like `Expected:: command not found` as the shell tried to
interpret the explanatory text as commands. The observer itself was
re-run cleanly afterwards and produced the PASS result above. This
is recorded as an **operator-side paste artifact**, not an observer
failure.

### Scope confirmation

- ✓ Read-only observer only.
- ✓ No DB writes.
- ✓ No migrations.
- ✓ No `schema.sql` change.
- ✓ No `psql` mutation.
- ✓ No collector change.
- ✓ No Lane A/B writes.
- ✓ No Trust / Policy output.
- ✓ No customer output.
- ✓ No AMS Product Layer runtime execution.
- ✓ No Render touched (A0 P-4 production block still active).
- ✓ No production DB touched.

### Verdict

**PR#13b Hetzner staging proof PASS.**
PR#13b is staging-proven and closed after this doc patch is committed.

**Next safe step:** Hetzner proof closure commit + push, then
PR#13c planning for the next evidence-consumer layer (AMS bridge
work or Product-Context Fit profile persistence — Helen's call per
PR#13a §14 implementation-options ladder).

---

## §7 Rollback path

Forward-only at the file level. To revert PR#13b:

```bash
git rm -r src/scoring/product-context-timing-observer
git rm scripts/product-context-timing-observation-report.ts
git rm tests/v1/product-context-timing-observer.test.ts
git rm docs/sprint2-pr13b-product-context-timing-observer.md

# Remove the npm script line from package.json (manual edit):
#   "observe:product-context-timing": "tsx scripts/product-context-timing-observation-report.ts",
```

**No DB rollback needed** — PR#13b introduces no migration, no
schema change, no DB writes. Both source tables remain untouched.

---

## §8 PR checklist (per workflow truth file §24)

| Field | Value |
| --- | --- |
| **Workflow layer** | Evidence-consumer layer (PR#13a §11 Product-Context Fit + §14 Timing Window) — Option C read-only observer |
| **Allowed source tables** | `poi_observations_v0_1` + `poi_sequence_observations_v0_1` + `information_schema.{tables, columns}` |
| **Forbidden source tables** | `accepted_events`, `rejected_events`, `ingest_requests`, `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`, `site_write_tokens` |
| **Customer-facing or internal-only** | Internal-only; no customer exposure |
| **Score / verdict / reason-code allowed?** | Forbidden — observer emits internal preview only, never customer-facing scoring |
| **DB writes** | None — strictly SELECT only |
| **Observer-first or durable table** | Observer (Option C; mirrors PR#11b / PR#12b cadence) |
| **Version fields** | 9 frozen `*_version` stamps surfaced on `run_metadata` |
| **Rollback path** | File-level removal only; no DB rollback |
| **Codex review checklist** | Source allowlist, no-write guarantee, fail-closed readiness, AMS reserved-name guard (PR#13a §17), no FIT./INTENT./WINDOW. reason codes, actionability bands disjoint from AMS WindowState, anomaly samples ID-only, OD-15 alignment (JSON shape compatible with `BuyerReconProductFeatures` under `ProductFeatures.Namespace`) |

---

**End of PR#13b implementation documentation.**
