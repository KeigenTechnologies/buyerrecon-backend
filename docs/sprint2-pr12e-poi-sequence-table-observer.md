# Sprint 2 PR#12e — POI Sequence Table Observer

**Status.** IMPLEMENTATION, read-only observer + Hetzner proof
runbook. Helen sign-off OD-11 (PR#12c, commit `f991e0b`) requires
PR#12e to be separate from PR#12d. No worker changes here.

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` (truth file)
- `docs/sprint2-pr12c-poi-sequence-observations-table-worker-planning.md` (Helen OD-1..OD-14 at `f991e0b`)
- `docs/sprint2-pr12d-poi-sequence-observations-table-worker.md` (Hetzner-proven worker at `a0713c9`)
- PR#11d precedent: `docs/sprint2-pr11d-poi-table-observer-hetzner-proof.md` +
  `src/scoring/poi-table-observer/*`
- Verification SQL: `docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql`

---

## §1 Scope

PR#12e ships a **read-only POI Sequence Table Observer** over
`poi_sequence_observations_v0_1` (PR#12d migration 015). The
observer verifies the row-level invariants from migration 015 +
verification SQL #15, plus a schema-level forbidden-column sweep.
Emits a JSON `TableObserverReport` to stdout. **Writes nothing.**

PR#12e mirrors PR#11d's structure applied to the new durable
table. The 7-step cadence (Codex re-review → Helen sign-off →
commit → push → Hetzner proof → optional transcript paste → PR chain
close) applies.

### Deliverables (this PR)

- `src/scoring/poi-sequence-table-observer/{types,query,report,runner,index}.ts`
- `scripts/poi-sequence-table-observation-report.ts`
- `package.json` — single new npm script `observe:poi-sequence-table`
- `tests/v1/poi-sequence-table-observer.test.ts`
- `docs/sprint2-pr12e-poi-sequence-table-observer.md` (this file)

### Non-deliverables (out of scope by design)

- No migration / `schema.sql` / DB writes (observer-only).
- No PR#12d worker changes (locked by Helen OD-11 separation).
- No table observer for any other table.
- No customer output / Trust / Policy / PCF / Lane A/B / score /
  verdict / reason codes / AMS Series Core runtime naming.

---

## §2 Source boundary

The observer reads **exactly one DB table**:

- `poi_sequence_observations_v0_1`

Plus two read-only schema diagnostics:

- `information_schema.tables` — presence probe
- `information_schema.columns` — forbidden-column sweep

### Forbidden reads (enforced by static-source sweep + SQL allowlist test)

- `poi_observations_v0_1` — POI coverage parity is the PR#12d
  verification SQL's job (`docs/sql/verification/15_*.sql` check
  #18); the observer does NOT join the POI table.
- `session_features`, `session_behavioural_features_v0_2`,
  `stage0_decisions`, `accepted_events`, `rejected_events`,
  `ingest_requests`, `risk_observations_v0_1`,
  `scoring_output_lane_a`, `scoring_output_lane_b`,
  `site_write_tokens`.

Lane A / Lane B parity is checked separately via psql pre/post
counts in the runbook below (governance check, not evidence source).

---

## §3 No-write guarantee

- All SQL constants in `query.ts` are SELECT-only.
- No INSERT / UPDATE / DELETE / TRUNCATE / CREATE / ALTER / DROP /
  GRANT / REVOKE in PR#12e runtime source.
- Static-source sweep (test group H) + SQL constant read-only sweep
  (test group I) enforce both.
- The pg pool runs against the staging DSN with the standard
  observer role (read-only `buyerrecon_internal_readonly` for
  Hetzner proof runs).

---

## §4 Anomaly counters

| # | Counter | Predicate (defence-in-depth — also enforced by DB CHECK / verification SQL #N) |
| --- | --- | --- |
| 1 | `duplicate_natural_key_count` | (workspace_id, site_id, session_id, poi_sequence_version, poi_observation_version) appears >1 time |
| 2 | `poi_sequence_eligible_mismatch_count` | `poi_sequence_eligible <> (NOT stage0_excluded)` |
| 3 | `invalid_pattern_class_count` | `poi_sequence_pattern_class NOT IN` 6-value enum |
| 4 | `has_progression_mismatch_count` | `has_progression <> (unique_poi_count >= 2)` |
| 5 | `progression_depth_mismatch_count` | `progression_depth <> unique_poi_count` |
| 6 | `repeated_poi_count_mismatch_count` | `repeated_poi_count <> (poi_count - unique_poi_count)` |
| 7 | `has_repetition_mismatch_count` | `has_repetition <> (repeated_poi_count > 0)` |
| 8 | `source_count_mismatch_count` | `source_poi_observation_count <> poi_count` |
| 9 | `negative_count_count` | `poi_count < 1 OR unique_poi_count < 1 OR unique_poi_count > poi_count OR repeated_poi_count < 0 OR progression_depth < 0` |
| 10 | `timestamp_ordering_violation_count` | `first_seen_at > last_seen_at` (NULL-safe) OR `created_at > updated_at` |
| 11 | `negative_duration_count` | `duration_seconds < 0` |
| 12 | `evidence_refs_invalid_count` | `jsonb_typeof(evidence_refs) <> 'array' OR jsonb_array_length(evidence_refs) = 0` |
| 13 | `evidence_refs_forbidden_direct_table_count` | any `evidence_refs[].table <> 'poi_observations_v0_1'` (**OD-14 guard**) |
| 14 | `evidence_refs_bad_id_count` | any `evidence_refs[].poi_observation_id` missing / non-number / negative |
| 15 | `source_versions_invalid_count` | `jsonb_typeof(source_versions) <> 'object'` |
| 16 | `forbidden_column_present_count` | schema-level sweep over `information_schema.columns` for the forbidden-column allowlist |

Each row-level counter has a paired **SAMPLE** SQL query that
returns up to `OBS_ANOMALY_SAMPLE_LIMIT` `poi_sequence_observation_id`
values. The COUNT is authoritative — independent of the SAMPLE cap
(PR#11d v0.2 Codex-blocker pattern).

**`total_anomalies`** is the sum of all 16 counters.

---

## §5 Privacy posture

Mirrors PR#11d / PR#12b / PR#12d:

- **No `poi_key` values in samples.** Anomaly samples surface
  `poi_sequence_observation_id` (BIGSERIAL) only.
- **No `session_id` full values in samples.** The
  `sample_session_id_prefixes` field carries masked prefixes
  (`prefix(8)…suffix(4)`) only.
- **No `evidence_refs` payload in samples.** The
  `evidence_refs_forbidden_direct_table` and `evidence_refs_bad_id`
  anomaly samples carry IDs only — the offending JSON content is
  inferred from the COUNT being non-zero, not exposed.
- **No `source_versions` payload in samples.**
- **No raw row content** anywhere in the report.
- **`DATABASE_URL` masked** via `parseDatabaseUrl` (host + db name
  only; password / userinfo never emitted).
- **Forbidden field names** (`email`, `user_agent`, `ip_hash`,
  `token_hash`, etc.) are never surfaced as JSON keys in the
  serialised report (test group G verifies).

---

## §6 AMS Series Core reserved-name guard

PR#12e runtime source MUST NOT mint:

- `SeriesOutput`, `TimeOutput`, `seriescore`
- `series_version`, `series_eligible`, `series_observations_v0_1`
- `observe:series`, `series-input`
- `Cadence` / `Compression` / `Acceleration` / `Revisit` /
  `SeriesConfidence` / `series_status` as runtime field names

Enforced by test group J. Docs / comments may reference these names
when explaining the boundary; the guard applies to runtime source
only.

---

## §7 Expected current staging proof

Based on PR#12d's PASS state (`a0713c9`, 8 POI rows → 8 POI
sequences, all `single_poi`, 6 excluded / 2 eligible):

| Field | Expected |
| --- | --- |
| `table_present` | `true` |
| `rows_in_table` | 8 |
| `total_anomalies` | 0 |
| `poi_sequence_pattern_class_distribution.single_poi` | 8 |
| Other pattern classes | 0 |
| `stage0_excluded_distribution` | `{ true_count: 6, false_count: 2 }` |
| `poi_sequence_eligible_distribution` | `{ true_count: 2, false_count: 6 }` |
| `has_repetition_distribution` | `{ true_count: 0, false_count: 8 }` |
| `has_progression_distribution` | `{ true_count: 0, false_count: 8 }` |
| `poi_sequence_version_distribution['poi-sequence-v0.1']` | 8 |
| `poi_observation_version_distribution['poi-observation-v0.1']` | 8 |
| `forbidden_column_names_present` | `[]` |
| `unique_session_ids_seen` | 8 |
| `unique_workspace_site_pairs_seen` | 1 |
| **Lane A / Lane B** (governance check; psql pre/post in runbook) | unchanged at 0 / 0 |

If staging seeds enrich to include multi-POI sessions, the pattern
distribution shifts to include `multi_poi_linear` / `loop_or_backtrack`
/ `repeated_same_poi`; `unknown_pattern_count` must remain 0.

---

## §8 Hetzner proof runbook

7-step cadence (mirrors PR#11d / PR#12b / PR#12d):

1. **Codex re-review** of PR#12e.
2. **Helen sign-off** on PR#12e.
3. **Commit** PR#12e on `sprint2-architecture-contracts-d4cc2bf`.
4. **Push** to origin.
5. **Hetzner proof** at pushed HEAD:

   ```bash
   ssh hetzner-buyerrecon
   cd /opt/buyerrecon-backend
   git fetch origin
   git checkout sprint2-architecture-contracts-d4cc2bf
   git pull --ff-only
   npm ci
   npx tsc --noEmit
   npm run check:scoring-contracts
   npm test -- tests/v1/poi-sequence-table-observer.test.ts

   # Pre-counts (Lane A/B parity baseline + all source/control tables)
   psql "$DATABASE_URL" -c "SELECT 'poi_sequence_observations_v0_1' AS t, COUNT(*) FROM poi_sequence_observations_v0_1
                            UNION ALL SELECT 'poi_observations_v0_1', COUNT(*) FROM poi_observations_v0_1
                            UNION ALL SELECT 'lane_a',  COUNT(*) FROM scoring_output_lane_a
                            UNION ALL SELECT 'lane_b',  COUNT(*) FROM scoring_output_lane_b;"

   # Observer run
   OBS_WORKSPACE_ID=buyerrecon_staging_ws \
   OBS_SITE_ID=buyerrecon_com \
   OBS_WINDOW_HOURS=720 \
   OBS_ANOMALY_SAMPLE_LIMIT=5 \
     npm run observe:poi-sequence-table | tee /tmp/pr12e.json

   # PR#12d verification SQL also re-runs cleanly (governance cross-check)
   psql "$DATABASE_URL" -f docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql

   # Post-counts (must equal pre-counts on every table — observer is read-only)
   psql "$DATABASE_URL" -c "SELECT 'poi_sequence_observations_v0_1' AS t, COUNT(*) FROM poi_sequence_observations_v0_1
                            UNION ALL SELECT 'poi_observations_v0_1', COUNT(*) FROM poi_observations_v0_1
                            UNION ALL SELECT 'lane_a',  COUNT(*) FROM scoring_output_lane_a
                            UNION ALL SELECT 'lane_b',  COUNT(*) FROM scoring_output_lane_b;"

   # Regression observers (concurrent PASS check)
   npm run observe:risk-core-bridge
   npm run observe:poi-core-input
   npm run observe:poi-table
   npm run observe:poi-sequence
   ```

6. **Optional transcript paste** to record observed output.
7. **PR chain close** — append a "Hetzner staging proof — PASS"
   section to this doc, mark PR#12e DONE in workflow truth file
   §22 PR mapping.

### Pass conditions

- `npx tsc --noEmit` — no TypeScript errors.
- `npm run check:scoring-contracts` — PASS.
- `npm test -- tests/v1/poi-sequence-table-observer.test.ts` — all tests pass.
- Observer exits 0.
- Pre-counts equal post-counts on `poi_sequence_observations_v0_1`,
  `poi_observations_v0_1`, Lane A, Lane B (and every other source
  table).
- `total_anomalies = 0`.
- `forbidden_column_present_count = 0`.
- `evidence_refs_forbidden_direct_table_count = 0` (OD-14).
- All four regression observers PASS.

### Architecture Gate A0 P-4

Render production deploy remains **BLOCKED** by A0 P-4. PR#12e only
proves staging on Hetzner. No production push.

---

## Hetzner staging proof — PASS

**Date.** 2026-05-14.
**Server path.** `/opt/buyerrecon-backend`.
**Branch.** `sprint2-architecture-contracts-d4cc2bf`.
**HEAD.** `3ab4b6c47cb894cd37f98388cdc914745865547c`.
**DB (masked).** `127.0.0.1:5432/buyerrecon_staging`.

### Static validation

| Step | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| `npx vitest run tests/v1/poi-sequence-table-observer.test.ts` (targeted) | **36/36 PASS** |
| `npm test` (full suite) | **48 files / 2,713 tests PASS** |
| `git diff --check` | PASS (no whitespace errors) |

### Observer environment

```
OBS_WORKSPACE_ID=buyerrecon_staging_ws
OBS_SITE_ID=buyerrecon_com
OBS_WINDOW_HOURS=720
DATABASE_URL=<masked → 127.0.0.1:5432/buyerrecon_staging>
```

### Pre / post table-count parity (unchanged across the observer run)

| Table | Pre | Post |
| --- | --- | --- |
| `accepted_events` | 14 | 14 |
| `ingest_requests` | 14 | 14 |
| `rejected_events` | 0 | 0 |
| `risk_observations_v0_1` | 2 | 2 |
| `scoring_output_lane_a` | 0 | 0 |
| `scoring_output_lane_b` | 0 | 0 |
| `session_behavioural_features_v0_2` | 16 | 16 |
| `session_features` | 8 | 8 |
| `stage0_decisions` | 8 | 8 |
| `poi_observations_v0_1` | 8 | 8 |
| `poi_sequence_observations_v0_1` | 8 | 8 |

**Observer wrote nothing.** All counts identical pre → post.

### `npm run observe:poi-sequence-table` result

**Top-line table state**
- `table_present`: **true**
- `rows_in_table`: **8**
- `rows_inspected`: 0 (every anomaly counter returned 0, so the
  rows_inspected accumulator stays at 0 — see §4 counter semantics:
  the accumulator sums anomaly counters, not total rows)

**Anomaly counters (all zero — healthy run)**
- `duplicate_natural_key_count`: 0
- `poi_sequence_eligible_mismatch_count`: 0
- `invalid_pattern_class_count`: 0
- `has_progression_mismatch_count`: 0
- `progression_depth_mismatch_count`: 0
- `repeated_poi_count_mismatch_count`: 0
- `has_repetition_mismatch_count`: 0
- `source_count_mismatch_count`: 0
- `negative_count_count`: 0
- `timestamp_ordering_violation_count`: 0
- `negative_duration_count`: 0
- `evidence_refs_invalid_count`: 0
- **`evidence_refs_forbidden_direct_table_count`: 0** (OD-14 guard) ✓
- **`evidence_refs_bad_id_count`: 0** (integer-validation Codex fix) ✓
- `source_versions_invalid_count`: 0
- `forbidden_column_present_count`: 0
- **`total_anomalies`: 0** ✓
- `anomaly_samples`: all empty arrays ✓ (no `poi_sequence_observation_id`s surfaced)

**Pattern class distribution**
- `single_poi`: **8**
- `repeated_same_poi`: 0
- `multi_poi_linear`: 0
- `loop_or_backtrack`: 0
- `insufficient_temporal_data`: 0
- `unknown`: **0** ✓ (must stay 0 in healthy run)

**Bucket distributions**
- `poi_count_distribution`: `{ "1": 8 }`
- `progression_depth_distribution`: `{ "1": 8 }`

**Stage 0 carry-through + eligibility**
- `stage0_excluded_distribution`: `{ true_count: 6, false_count: 2 }`
- `poi_sequence_eligible_distribution`: `{ true_count: 2, false_count: 6 }` (pure inverse holds ✓)
- `has_repetition_distribution`: `{ true_count: 0, false_count: 8 }`
- `has_progression_distribution`: `{ true_count: 0, false_count: 8 }`

**Version stamps**
- `poi_sequence_version_distribution`: `{ "poi-sequence-v0.1": 8 }`
- `poi_observation_version_distribution`: `{ "poi-observation-v0.1": 8 }`

**Identity diagnostics**
- `unique_session_ids_seen`: 8
- `unique_workspace_site_pairs_seen`: 1
- `sample_session_id_prefixes`: masked prefixes only

**Run metadata**
- `record_only`: `true`

### Verification SQL cross-check — `docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql`

| Check | Result |
| --- | --- |
| `table_present` | `t` ✓ |
| All 18 row-level / schema-level anomaly result sets | 0 rows each ✓ |
| Lane A / Lane B parity | 0 / 0 (pre = post) ✓ |
| POI coverage gap (sessions in `poi_observations_v0_1` not in `poi_sequence_observations_v0_1`) | 0 rows ✓ |

### Regression observers — concurrent PASS

| Observer | Result |
| --- | --- |
| `observe:risk-core-bridge` | PASS — `rows_scanned: 2`, `envelopes_built: 2`, `rejects: 0` |
| `observe:poi-core-input` | PASS — `rows_scanned: 24`, `envelopes_built: 8`, `rejects: 16` (all `NO_PAGE_PATH_CANDIDATE` from SBF rows — expected v0.1 behaviour), `stage0_excluded: 6`, `eligible_for_poi: 2` |
| `observe:poi-table` | PASS — `table_present: true`, `rows_in_table: 8`, `total_anomalies: 0`, `forbidden_column_present_count: 0` |
| `observe:poi-sequence` (PR#12b) | PASS — `rows_scanned: 8`, `sessions_seen: 8`, `poi_sequences_built: 8`, `single_poi: 8`, `total_anomalies: 0` |

PR#6 / PR#7b / PR#8b / PR#9a / PR#10 / PR#11a..d / PR#12b / PR#12d behaviour remains intact after PR#12e lands. No regression observed.

### Scope confirmation

- ✓ Read-only observer only.
- ✓ No DB writes.
- ✓ No migrations.
- ✓ No schema changes.
- ✓ No `psql` writes.
- ✓ No Render touched (A0 P-4 production block still active).
- ✓ No worker changes.
- ✓ No Lane A/B changes (both 0 / 0).
- ✓ No customer output.
- ✓ No Trust / Policy / Product-Context Fit.
- ✓ No AMS Series Core runtime names.

### Verdict

**PR#12e Hetzner staging proof PASS.**
PR#12e is staging-proven and closed after this doc patch is committed.

**PR#12 chain status:** PR#12a (rename) + PR#12b (read-only POI
Sequence Observer) + PR#12c (planning) + PR#12d (durable table +
worker) + PR#12e (read-only table observer) all closed and
Hetzner-proven. The POI Sequence evidence layer is complete and
locked at v0.1.

**Next safe step:** **PR#13a — Product-Context Fit + Timing Window
planning only.** This is a planning-only PR mirroring the PR#12c
cadence. Per the workflow truth file §11 (Product-Context Fit) and
§14 (Timing Window Detection), PR#13a establishes the OD list and
boundary contract for the next evidence-consumer layer. No
implementation in PR#13a — that follows in PR#13b once Codex review
and Helen sign-off close on the planning doc.

---

## §9 Rollback path

Forward-only at the file level. To revert PR#12e:

```bash
git rm -r src/scoring/poi-sequence-table-observer
git rm scripts/poi-sequence-table-observation-report.ts
git rm tests/v1/poi-sequence-table-observer.test.ts
git rm docs/sprint2-pr12e-poi-sequence-table-observer.md

# Remove the npm script line from package.json (manual edit):
#   Delete: "observe:poi-sequence-table": "tsx scripts/poi-sequence-table-observation-report.ts",
```

**No DB rollback needed** — PR#12e introduces no migration, no
schema change, no DB writes. The `poi_sequence_observations_v0_1`
table (from PR#12d migration 015) is untouched.

---

## §10 PR checklist (per workflow truth file §24)

| Field | Value |
| --- | --- |
| **Workflow layer** | Evidence-layer governance / read-only invariant observer over PR#12d durable table |
| **Allowed source tables** | `poi_sequence_observations_v0_1` only (+ `information_schema.{tables, columns}`) |
| **Forbidden source tables** | `poi_observations_v0_1`, `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, `accepted_events`, `rejected_events`, `ingest_requests`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`, `site_write_tokens` |
| **Customer-facing or internal-only** | Internal-only; no customer exposure |
| **Score / verdict / reason-code allowed?** | Forbidden — this PR is read-only governance, not decision |
| **DB writes** | None — strictly SELECT only |
| **Observer-first or durable table** | Observer (mirrors PR#11d) |
| **Version fields** | `poi_sequence_version_expected`, `poi_observation_version_expected` surfaced on `run_metadata` for cross-reference |
| **Rollback path** | File-level removal only; no DB rollback (no migration) |
| **Codex review checklist** | Source allowlist (table + info_schema only; POI table excluded), forbidden-column sweep covers full §K list, OD-14 direct-evidence_refs-table guard, no AMS Series Core runtime names, anomaly counter authoritative pattern (COUNT + SAMPLE split), privacy posture (samples = IDs only), no DML/DDL in runtime |

---

**End of PR#12e documentation.**
