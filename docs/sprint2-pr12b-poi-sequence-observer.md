# Sprint 2 PR#12b — POI Sequence Observer

**Status.** Implementation, read-only observer. Helen sign-off required
before Hetzner staging proof. No code in `src/scoring/` outside
`src/scoring/poi-sequence-observer/**`, no migration, no `schema.sql`
change, no DB writes, no `psql`, no Render. PR#0–PR#12a implementation
files are referenced read-only.

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` (commit `c063784`)
  — §4C POI Sequence evidence, §9 POI Sequence facts/taxonomy,
  §10 AMS Series Core reserved-name guard, §23 frozen-name guard.
- `docs/sprint2-pr12a-poi-sequence-planning.md` (commit `ca3f174`) —
  Helen sign-off OD-1..OD-13.
- `docs/sprint2-pr11d-poi-table-observer-hetzner-proof.md` (Hetzner
  PASS 2026-05-13 at `8e0841d`) — load-bearing upstream POI evidence.
- `migrations/014_poi_observations_v0_1.sql` — durable POI evidence
  schema (read-only consumer in PR#12b).

---

## §1 Scope

PR#12b ships a **read-only POI Sequence Observer** over
`poi_observations_v0_1`. The observer groups POI rows by
`(workspace_id, site_id, session_id)` and derives in-memory POI
Sequence facts: pattern class, POI counts, distinct-POI counts,
first/last POI, duration, Stage 0 carry-through.

The observer **writes nothing**. It is engineering diagnostics only.
No durable POI Sequence table is created in PR#12b. A future PR
(PR#12c / PR#13 line) will introduce `poi_sequence_observations_v0_1`
as a durable layer after PR#12b proves the in-memory shape on real
staging data — mirroring the PR#11b → PR#11c → PR#11d observer-
first cadence.

### Deliverables (this PR)

- `src/scoring/poi-sequence-observer/{types,query,mapper,report,runner,index}.ts`
- `scripts/poi-sequence-observation-report.ts` (CLI)
- `package.json` — one new npm script: `observe:poi-sequence`
- `tests/v1/poi-sequence-observer.test.ts`
- `docs/sprint2-pr12b-poi-sequence-observer.md` (this file)

### Non-deliverables (intentional, future PRs)

- Durable `poi_sequence_observations_v0_1` table
- Worker that persists POI Sequence records
- Product-Context Fit interpretation
- Trust / Policy / Lane A/B consumption
- AMS Series Core (cross-session continuity — different layer entirely;
  see workflow truth file §10)

---

## §2 Source boundary

The observer reads **exactly one DB table**:

- `poi_observations_v0_1`

Plus one read-only schema check:

- `information_schema.tables` (table-presence probe)

### Forbidden source reads (enforced by static-source sweep + SQL allowlist test)

- `accepted_events`
- `rejected_events`
- `ingest_requests`
- `session_features`
- `session_behavioural_features_v0_2`
- `stage0_decisions`
- `risk_observations_v0_1`
- `scoring_output_lane_a`
- `scoring_output_lane_b`
- `site_write_tokens`

Stage 0 carry-through is read **only** via fields that already exist
on `poi_observations_v0_1` (`stage0_excluded`, `poi_eligible`,
`stage0_rule_id`). The observer does NOT re-read `stage0_decisions`.

---

## §3 Privacy posture

Mirrors PR#11b / PR#11d:

- **No raw URL query.** Not stored upstream and not surfaced by the
  observer.
- **No raw referrer / user agent / IP.**
- **No token / hash / auth / cookie / pepper.**
- **No person / company / visitor / email identity.**
- **No raw ledger evidence_refs.** The observer treats POI
  `evidence_refs` (which may reference `session_features` /
  `session_behavioural_features_v0_2` / `stage0_decisions`) as opaque
  for purposes of the report — the report surfaces a count, not
  contents.
- **`session_id` is never printed in full.** Masked via
  `truncateSessionId` (`prefix(8) + … + suffix(4)`; `***` for short
  IDs) at the report edge.
- **`DATABASE_URL` is never printed in full.** Masked via
  `parseDatabaseUrl` (host + db name only; password / userinfo never
  emitted).
- **No `poi_key` values in samples by default.** The report uses
  aggregate distributions, not samples, for POI counts /
  classifications.
- **Anomaly samples are `poi_observation_id` (BIGSERIAL) values
  only** — non-PII internal row IDs. No `session_id`, no `poi_key`,
  no `evidence_refs`, no raw row content.

A recursive forbidden-key sweep walks `evidence_refs` and
`source_versions` JSONB content; any of the 47 forbidden field names
(see `FORBIDDEN_REF_KEYS` in `types.ts` — mirrors PR#11d
`FORBIDDEN_COLUMNS`) trips the `forbidden_key_present` anomaly.

---

## §4 Sequence taxonomy (v0.1)

Six pattern classes locked by truth file §9:

| Class | Rule |
| --- | --- |
| `single_poi` | exactly one POI row in the session |
| `repeated_same_poi` | `poi_count >= 2` AND `unique_poi_count == 1` |
| `multi_poi_linear` | `unique_poi_count >= 2` AND `repeated_poi_count == 0` |
| `loop_or_backtrack` | `unique_poi_count >= 2` AND `repeated_poi_count >= 1` |
| `insufficient_temporal_data` | `poi_count >= 2` AND any POI row lacks `first_seen_at` |
| `unknown` | fallback; MUST stay 0 in a healthy run |

### Progression rules

- `has_progression = unique_poi_count >= 2`
- `progression_depth = unique_poi_count`
- `single_poi` is NOT progression
- `repeated_same_poi` is NOT progression (same POI does not
  constitute moving through the funnel)

### Repetition rules

- `repeated_poi_count` counts POI rows whose `(poi_type, poi_key)`
  pair has already appeared earlier in the session-ordered list.
- `has_repetition = repeated_poi_count > 0`

### Determinism

- Rows are returned by SQL `ORDER BY workspace_id ASC, site_id ASC,
  session_id ASC, first_seen_at ASC NULLS LAST, poi_observation_id
  ASC`. The BIGSERIAL `poi_observation_id` is the deterministic
  tie-break.
- The mapper does NOT call `Date.now()` or `Math.random()` (enforced
  by static-source sweep in §G of the test file).

---

## §5 Stage 0 carry-through

- A session's `stage0_excluded` is **TRUE** if ANY POI row in the
  session has `stage0_excluded = TRUE`. Otherwise FALSE.
- `poi_sequence_eligible = NOT stage0_excluded` (pure boolean
  inverse, mirroring `poi_observations_v0_1` CHECK constraint
  `poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded`).
- **Stage 0-excluded sessions still produce POI Sequence records.**
  The observer marks them `poi_sequence_eligible = FALSE` but does
  NOT drop them. Carry-through, not reject.
- The observer does NOT re-read `stage0_decisions`. `stage0_rule_id`
  carries through POI rows as provenance only — it is NEVER surfaced
  in a customer-facing position, scoring reason, Policy / Trust
  reason, or Product-Context-Fit input.

---

## §6 AMS Series Core name guard

PR#12b is **POI Sequence**, NOT AMS Series Core. AMS canonical Series
Core (`internal/seriescore`, frozen contract `SeriesOutput` with
legacy alias `TimeOutput` per ADR-005) is reserved for **cross-
session continuity** — cadence, compression, acceleration, revisit,
`SeriesConfidence` over multi-session history. That is a different
layer from PR#12b.

### Reserved AMS names — MUST NOT appear in PR#12b runtime source

- `SeriesOutput`
- `TimeOutput`
- `seriescore`
- `series_version`
- `series_eligible`
- `series_observations_v0_1`
- `observe:series`
- `Cadence` / `Compression` / `Acceleration` / `Revisit` /
  `SeriesConfidence` as PR#12b runtime field names

Enforced by static-source sweep in `tests/v1/poi-sequence-observer.test.ts`
group L ("PR#12b runtime source does NOT mint AMS Series Core
reserved names").

**Docs and test assertions may reference these names** when
explaining the boundary; the guard applies to runtime source only.

---

## §7 No-score / no-policy / no-trust / no-product-context-fit boundary

PR#12b emits NONE of the following:

- `risk_index` / `verification_score` / `evidence_band` /
  `action_recommendation` / `reason_codes` / `reason_impacts` /
  `triggered_tags` / `penalty_total`
- `trust_decision` / `policy_decision` / `final_decision`
- Lane A / Lane B output
- `PoiScore` / `IntentClass` / `Confidence01` / `EntryRecommendation`
  / `LegitimacyFlags` / `AnomalyFlags` (those are AMS PoI Core
  outputs, not BuyerRecon POI Sequence outputs)
- Customer-facing field of any kind
- Product-Context Fit observation (future layer)

POI Sequence is **evidence/feature-observation only**, per workflow
truth file §3 layer taxonomy and §4C master workflow row.

---

## §8 Expected current staging result (Hetzner)

Based on the PR#11d PASS state (8 POI rows, 6 stage0_excluded, 2
eligible, all `single_poi` for staging seed):

| Field | Expected |
| --- | --- |
| `rows_scanned` | 8 |
| `sessions_seen` | 8 |
| `poi_sequences_built` | 8 |
| `poi_sequence_pattern_class_distribution.single_poi` | 8 (likely) |
| `poi_sequence_pattern_class_distribution.*` (others) | 0 |
| `stage0_excluded_distribution.true_count` | 6 |
| `stage0_excluded_distribution.false_count` | 2 |
| `poi_sequence_eligible_distribution.true_count` | 2 |
| `poi_sequence_eligible_distribution.false_count` | 6 |
| `total_anomalies` | 0 |
| `unique_session_ids_seen` | 8 |
| `unique_workspace_site_pairs_seen` | 1 |

If staging seeds ever introduce multi-POI sessions, the distribution
shifts to include `repeated_same_poi`, `multi_poi_linear`, or
`loop_or_backtrack` counts. `unknown` must remain 0.

---

## §9 Hetzner proof plan

The PR#12b Hetzner staging proof follows the PR#11d-locked
7-step ordering (see PR#11d runbook §9 for the canonical pattern):

1. **Codex re-review** of PR#12b uncommitted patch.
2. **Helen sign-off** on PR#12b implementation.
3. **Commit** PR#12b on `sprint2-architecture-contracts-d4cc2bf`.
4. **Push** to `origin`.
5. **Hetzner proof** — operator runs the runbook at the pushed HEAD:

   ```bash
   ssh hetzner-buyerrecon
   cd /opt/buyerrecon-backend
   git fetch origin
   git checkout sprint2-architecture-contracts-d4cc2bf
   git pull --ff-only
   npm ci
   npx tsc --noEmit
   npm run check:scoring-contracts
   npm test -- tests/v1/poi-sequence-observer.test.ts

   # Pre-counts (parity baseline; PR#12b writes nothing)
   psql "$DATABASE_URL" -c "SELECT 'poi_observations_v0_1' AS t, COUNT(*) FROM poi_observations_v0_1
                            UNION ALL SELECT 'lane_a',  COUNT(*) FROM scoring_output_lane_a
                            UNION ALL SELECT 'lane_b',  COUNT(*) FROM scoring_output_lane_b;"

   # Observer run
   DATABASE_URL="$DATABASE_URL" \
   OBS_WORKSPACE_ID=ws_demo \
   OBS_SITE_ID=site_demo \
   OBS_WINDOW_HOURS=720 \
   OBS_ANOMALY_SAMPLE_LIMIT=5 \
     npm run observe:poi-sequence | tee /tmp/pr12b-poi-sequence.json

   # Post-counts (must equal pre-counts; observer is read-only)
   psql "$DATABASE_URL" -c "SELECT 'poi_observations_v0_1' AS t, COUNT(*) FROM poi_observations_v0_1
                            UNION ALL SELECT 'lane_a',  COUNT(*) FROM scoring_output_lane_a
                            UNION ALL SELECT 'lane_b',  COUNT(*) FROM scoring_output_lane_b;"
   ```

6. **Optional transcript paste** to record observed output.
7. **PR#12 chain close** — mark PR#12b DONE in `docs/architecture/buyerrecon-workflow-locked-v0.1.md` §22 PR mapping; tag the proof commit if applicable.

### Pass conditions

- `npx tsc --noEmit` — no TypeScript errors.
- `npm run check:scoring-contracts` — PASS.
- `npm test -- tests/v1/poi-sequence-observer.test.ts` — all tests pass.
- Observer exits 0.
- Pre-counts equal post-counts on `poi_observations_v0_1`, Lane A, Lane B.
- `total_anomalies = 0` in the report.
- `unknown_pattern_count = 0`.
- `sessions_seen` matches the count of distinct
  `(workspace_id, site_id, session_id)` triples in
  `poi_observations_v0_1` for the window.

### Architecture Gate A0 P-4

Render production deploy remains **BLOCKED** by Architecture Gate A0
P-4. PR#12b only proves staging on Hetzner. No production push.

---

## §10 Rollback path

Forward-only at the file level. To revert PR#12b:

```bash
# Remove the observer module + script + test + this doc.
git rm -r src/scoring/poi-sequence-observer
git rm scripts/poi-sequence-observation-report.ts
git rm tests/v1/poi-sequence-observer.test.ts
git rm docs/sprint2-pr12b-poi-sequence-observer.md

# Remove the npm script line from package.json (manual edit).
#   Delete: "observe:poi-sequence": "tsx scripts/poi-sequence-observation-report.ts",
```

**No DB rollback needed** — PR#12b introduces no migration, no
schema change, no DB writes. The `poi_observations_v0_1` table (from
PR#11c migration 014) is untouched.

---

## §11 PR checklist (per workflow truth file §24)

| Field | Value |
| --- | --- |
| **Workflow layer** | Evidence layer (truth file §3) / POI Sequence evidence branch (§4C / §9) |
| **Allowed source tables** | `poi_observations_v0_1` only |
| **Forbidden source tables** | `accepted_events`, `rejected_events`, `ingest_requests`, `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`, `site_write_tokens` |
| **Customer-facing or internal-only** | Internal-only; no customer exposure |
| **Score / verdict / reason-code allowed?** | Forbidden — this PR is evidence-observation, not decision |
| **DB writes** | Read-only — no INSERT / UPDATE / DELETE / DDL |
| **Observer-first or durable table** | Observer-first (mirrors PR#11b precedent) |
| **Version fields** | `poi_sequence_version = 'poi-sequence-v0.1'`, frozen literal |
| **Rollback path** | File-level removal only; no DB rollback (no migration) |
| **Codex review checklist** | Source allowlist, forbidden-table sweep, AMS Series-name guard, classification rules, Stage 0 carry-through, privacy posture, deterministic ordering, no Date.now / no randomness |

---

**End of PR#12b documentation.**
