# Sprint 2 PR#12d — POI Sequence Observations Table + Manual Worker

**Status.** IMPLEMENTATION. Helen-signed OD-1..OD-14 (PR#12c, commit
`f991e0b`) implemented here. No table observer in PR#12d — that
ships separately as PR#12e (mirrors PR#11c → PR#11d split).

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` (truth file).
- `docs/sprint2-pr12c-poi-sequence-observations-table-worker-planning.md`
  (Helen-signed OD-1..OD-14 at commit `f991e0b`).
- `docs/sprint2-pr12b-poi-sequence-observer.md` (Hetzner-proven
  observer at commit `04def87`).
- PR#11c worker + migration 014 (durable-table precedent).

---

## §1 Files in this PR

| Path | Purpose |
| --- | --- |
| `migrations/015_poi_sequence_observations_v0_1.sql` | New durable table + indexes + role grants + Hard-Rule-I parity assertion |
| `src/db/schema.sql` | Mirror block appended (idempotent `CREATE TABLE IF NOT EXISTS`) |
| `package.json` | Single new npm script `run:poi-sequence-worker` |
| `scripts/run-poi-sequence-worker.ts` | CLI runner |
| `src/scoring/poi-sequence-worker/{types,query,mapper,upsert,worker,index}.ts` | Worker module |
| `tests/v1/poi-sequence-worker.test.ts` | Pure tests (stub client) |
| `docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql` | Verification SQL (read-only) |
| `docs/sprint2-pr12d-poi-sequence-observations-table-worker.md` | This implementation doc |
| `src/scoring/poi-sequence-observer/types.ts` | **Modified.** Adds optional `stage0_rule_id?: unknown` to the shared raw POI observation row type (`PoiObservationRowRaw`). The PR#12d worker's SELECT pulls `stage0_rule_id` for provenance carry-through; the PR#12b observer's SELECT does not, so the field is declared optional. **Does NOT change PR#12b observer query / report behaviour** — observer rows simply have `undefined` for this field (which is then discarded by the observer mapper that doesn't read it). |

No other files in PR#12d scope are touched outside the list above.

---

## §2 Source boundary

**Reads:** `poi_observations_v0_1` only (single SELECT in `query.ts`).
**Writes:** `poi_sequence_observations_v0_1` only (UPSERT in `query.ts`).

Forbidden reads (enforced by static-source sweep in
`tests/v1/poi-sequence-worker.test.ts` Group H + SQL constant
allowlist in Group N):
- `accepted_events`
- `rejected_events`
- `ingest_requests`
- `session_features`
- `session_behavioural_features_v0_2`
- `stage0_decisions` (no re-read — Stage 0 carry-through via POI fields)
- `risk_observations_v0_1`
- `scoring_output_lane_a`
- `scoring_output_lane_b`
- `site_write_tokens`

Forbidden writes: any table other than `poi_sequence_observations_v0_1`.

---

## §3 Table design summary

`poi_sequence_observations_v0_1` (29 columns + PK + indexes):

- **Natural key:** `(workspace_id, site_id, session_id,
  poi_sequence_version, poi_observation_version)`.
- **Frozen version pin:** `poi_sequence_version = 'poi-sequence-v0.1'`
  via CHECK.
- **Sequence facts** (mirroring PR#12b observer taxonomy):
  `poi_count`, `unique_poi_count`, `first/last_poi_type`,
  `first/last_poi_key`, `first/last_seen_at`, `duration_seconds`,
  `repeated_poi_count`, `has_repetition`, `has_progression`,
  `progression_depth`, `poi_sequence_pattern_class`.
- **Stage 0 carry-through:** `stage0_excluded`, `poi_sequence_eligible`
  (= NOT stage0_excluded, CHECK), `stage0_rule_id` (nullable
  provenance-only).
- **Lineage:** `evidence_refs` (JSONB array of direct POI refs only —
  OD-14), `source_versions` (JSONB object), `source_poi_observation_count`,
  `source_min/max_poi_observation_id`.
- **Provenance:** `record_only` (TRUE, CHECK), `derived_at`,
  `created_at`, `updated_at`.

### CHECK constraints (full list)

`poi_seq_obs_v0_1_version_pin` · `pattern_class_enum` ·
`eligible_is_pure_inverse_of_stage0_excluded` ·
`poi_count_pos` · `unique_poi_count_pos` ·
`progression_depth_equals_unique` · `has_progression_rule` ·
`repeated_poi_count_identity` · `has_repetition_rule` ·
`duration_nonneg` · `timestamps_ordered` ·
`source_count_matches_poi_count` · `source_id_range_ordered` ·
`record_only_must_be_true` · `evidence_refs_is_array` ·
`evidence_refs_nonempty` · `source_versions_is_object` ·
`natural_key` (UNIQUE).

### Role grants (mirror PR#11c)

- `buyerrecon_migrator`: ALL.
- `buyerrecon_scoring_worker`: SELECT, INSERT, UPDATE + sequence
  USAGE, SELECT, UPDATE.
- `buyerrecon_internal_readonly`: SELECT on table only — zero
  sequence USAGE/UPDATE (PR#11c Codex-blocker precedent).
- `buyerrecon_customer_api`: REVOKE ALL (Hard-Rule-I parity
  assertion in the migration's DO block).

### `poi_input_version` is NOT in the natural key

Per PR#12c §7 + Helen OD-5: `poi_input_version` stays in
`source_versions` JSONB only. A future natural-key extension migration
can add it if cross-version replay becomes a need.

---

## §4 Worker behaviour summary

**Manual CLI only**, mirrors PR#11c shape:

```
DATABASE_URL=postgres://... \
WORKSPACE_ID=ws_demo SITE_ID=site_demo WINDOW_HOURS=720 \
  npm run run:poi-sequence-worker
```

Pipeline:
1. PR#4 contract guards (`assertScoringContractsOrThrow` +
   `assertActiveScoringSourceCleanOrThrow`).
2. `SELECT_POI_OBSERVATIONS_FOR_SEQUENCE_WORKER_SQL` against
   `poi_observations_v0_1` (window-bounded, `WORKER_LIMIT`-capped).
3. `groupRowsBySession` (re-uses PR#12b observer mapper as the
   single source of truth for grouping + classification).
4. Per group: `buildDurableSequenceRecord` (extends observer's
   `PoiSequenceRecord` with `first_poi_key` / `last_poi_key` strings
   + direct POI evidence_refs + ID range).
5. `buildUpsertParams` (defence-in-depth invariant checks).
6. `INSERT ... ON CONFLICT ON CONSTRAINT poi_seq_obs_v0_1_natural_key
   DO UPDATE` with `xmax = 0` RETURNING flag for inserted/updated
   classification.
7. `aggregateReport` emits a JSON `WorkerReport` to stdout.

**No scheduler.** Manual CLI only (Helen OD-4).
**No customer output.** No score, verdict, reason codes, Lane A/B,
Trust, Policy, PCF, AMS Series Core runtime names.

### Per-row error handling

- SQL / connection errors → propagate to CLI, exit 1.
- Per-group shape errors → counted in `reject_reasons` counter,
  surfaced in report, do NOT crash the run.

### Reject reasons

`MISSING_IDENTITY` · `MISSING_POI_TYPE` · `MISSING_POI_KEY` ·
`INVALID_PATTERN_CLASS` · `INVALID_EVIDENCE_REFS` ·
`ADAPTER_VALIDATION_ERROR`.

---

## §5 evidence_refs — direct POI rows only (OD-14)

Per Helen-signed OD-14 (PR#12c):

- Every `evidence_refs` entry written by PR#12d has exact shape:
  ```json
  { "table": "poi_observations_v0_1", "poi_observation_id": <BIGSERIAL id> }
  ```
- `buildUpsertParams` (`upsert.ts`) **throws** if any entry's
  `table` is anything other than `'poi_observations_v0_1'` — the
  worker classifies the throw as `ADAPTER_VALIDATION_ERROR`.
- Lower-layer PR#11c POI evidence_refs (`session_features`,
  `session_behavioural_features_v0_2`, `stage0_decisions`) are NOT
  copied / flattened / inlined.
- Lower-layer lineage remains discoverable **transitively** via the
  referenced `poi_observations_v0_1.evidence_refs`.
- Verification SQL check #13 (`elem ->> 'table' IS DISTINCT FROM
  'poi_observations_v0_1'`) trips on any direct ref outside the
  allowlist.

---

## §6 derived_at semantics (locked)

- `derived_at` is the **worker-run wall-clock at derivation**
  (ISO-8601 string captured at the top of `runPoiSequenceWorker`).
- On rerun against unchanged source rows:
  - **Row count is stable** (idempotency requirement under the
    natural key).
  - `derived_at` is **updated** to the new run's wall-clock.
  - `updated_at` is bumped to `NOW()` by the `ON CONFLICT DO UPDATE`
    clause.
- **Byte-stability is NOT required** — only row-count idempotency
  is. This matches PR#11c precedent (`updated_at = NOW()` on every
  conflict).
- If a future PR introduces a content-hash field, byte-level
  idempotency can be added via a `WHEN ... DISTINCT FROM` clause.

---

## §7 Constraints summary (DB CHECK + worker defence-in-depth)

| Invariant | DB CHECK | Worker check |
| --- | --- | --- |
| `poi_sequence_version = 'poi-sequence-v0.1'` | ✓ | ✓ |
| `poi_sequence_pattern_class` enum (6 classes) | ✓ | mapper input |
| `poi_sequence_eligible = NOT stage0_excluded` | ✓ | ✓ |
| `poi_count >= 1` | ✓ | ✓ |
| `unique_poi_count >= 1 AND <= poi_count` | ✓ | ✓ |
| `progression_depth = unique_poi_count` | ✓ | observer-derived |
| `has_progression = (unique_poi_count >= 2)` | ✓ | ✓ |
| `repeated_poi_count = poi_count - unique_poi_count` | ✓ | ✓ |
| `has_repetition = (repeated_poi_count > 0)` | ✓ | ✓ |
| `duration_seconds IS NULL OR >= 0` | ✓ | observer-derived |
| `first_seen_at <= last_seen_at` (NULL-safe) | ✓ | observer-derived |
| `source_poi_observation_count = poi_count` | ✓ | ✓ |
| `source_min_poi_observation_id <= source_max_poi_observation_id` (NULL-safe) | ✓ | mapper |
| `record_only IS TRUE` | ✓ | mapper |
| `evidence_refs` is non-empty JSONB array | ✓ | ✓ |
| `source_versions` is JSONB object | ✓ | ✓ |
| `evidence_refs[].table = 'poi_observations_v0_1'` (OD-14) | enforced by worker + verification SQL | ✓ |
| UNIQUE `(workspace_id, site_id, session_id, poi_sequence_version, poi_observation_version)` | ✓ | natural-key UPSERT |

---

## §8 Validation results (this PR)

To be filled by the validation step. Expected:

- `npx tsc --noEmit` → PASS
- `npm run check:scoring-contracts` → PASS
- `npx vitest run tests/v1/poi-sequence-worker.test.ts` → all tests PASS
- `npm test` (full suite) → all tests PASS
- `git diff --check` → no whitespace errors

---

## §9 Hetzner proof plan (PR#12d implementation proof — not the
table observer; that's PR#12e)

Locked 7-step cadence (mirrors PR#11c-to-PR#11d):

1. **Codex re-review** of PR#12d.
2. **Helen sign-off** on PR#12d.
3. **Commit** PR#12d on `sprint2-architecture-contracts-d4cc2bf`.
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
   npm test -- tests/v1/poi-sequence-worker.test.ts

   # Apply migration 015
   psql "$DATABASE_URL_MIGRATOR" -f migrations/015_poi_sequence_observations_v0_1.sql

   # Pre-counts
   psql "$DATABASE_URL" -c "SELECT 'poi_observations_v0_1' AS t, COUNT(*)
                            FROM poi_observations_v0_1
                            UNION ALL SELECT 'poi_seq', COUNT(*) FROM poi_sequence_observations_v0_1
                            UNION ALL SELECT 'lane_a',  COUNT(*) FROM scoring_output_lane_a
                            UNION ALL SELECT 'lane_b',  COUNT(*) FROM scoring_output_lane_b;"

   # Worker first run
   WORKSPACE_ID=buyerrecon_staging_ws SITE_ID=buyerrecon_com WINDOW_HOURS=720 \
     npm run run:poi-sequence-worker | tee /tmp/pr12d-first.json

   # Worker rerun (idempotency)
   WORKSPACE_ID=buyerrecon_staging_ws SITE_ID=buyerrecon_com WINDOW_HOURS=720 \
     npm run run:poi-sequence-worker | tee /tmp/pr12d-rerun.json

   # Verification SQL
   psql "$DATABASE_URL" -f docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql

   # Post-counts (must equal pre-counts on all source/control tables;
   # poi_sequence_observations_v0_1 has 8 rows after first run, still
   # 8 after rerun)
   psql "$DATABASE_URL" -c "SELECT 'poi_observations_v0_1' AS t, COUNT(*) FROM poi_observations_v0_1
                            UNION ALL SELECT 'poi_seq', COUNT(*) FROM poi_sequence_observations_v0_1
                            UNION ALL SELECT 'lane_a',  COUNT(*) FROM scoring_output_lane_a
                            UNION ALL SELECT 'lane_b',  COUNT(*) FROM scoring_output_lane_b;"

   # Regression observers
   npm run observe:risk-core-bridge
   npm run observe:poi-core-input
   npm run observe:poi-table
   npm run observe:poi-sequence
   ```

6. **Optional transcript paste** to record observed output.
7. **PR#12 chain progress** — mark PR#12d DONE in workflow truth
   file §22 PR mapping; queue PR#12e (read-only table observer).

### Expected proof state (current staging seed)

| Signal | Expected |
| --- | --- |
| Migration 015 apply | success; Hard-Rule-I parity DO block passes |
| First run `rows_scanned` | 8 |
| First run `sessions_seen` | 8 |
| First run `rows_inserted` | 8 |
| First run `rows_updated` | 0 |
| First run `pattern_class.single_poi` | 8 |
| First run `stage0_excluded_count` | 6 |
| First run `poi_sequence_eligible_count` | 2 |
| First run `rejects` | 0 |
| Rerun `rows_inserted` | 0 |
| Rerun `rows_updated` | 8 |
| Rerun `poi_sequence_observations_v0_1` row count | 8 (stable) |
| Verification SQL anomaly checks | all zero rows |
| Lane A / Lane B pre vs post | unchanged (0 / 0) |
| Source table counts pre vs post | unchanged |
| Regression observers | all PASS |

### Architecture Gate A0 P-4

Render production deploy remains **BLOCKED** by A0 P-4. PR#12d only
proves staging on Hetzner. No production push.

---

## Hetzner staging proof — PASS

**Date.** 2026-05-14.
**Server path.** `/opt/buyerrecon-backend`.
**Branch.** `sprint2-architecture-contracts-d4cc2bf`.
**HEAD.** `f5e4889999aa8caabe97c8a5fe9c95df3b0592ae`.

### Static validation

| Step | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run check:scoring-contracts` | PASS |
| `npx vitest run tests/v1/poi-sequence-worker.test.ts` (targeted) | **59/59 PASS** |
| `npm test` (full suite) | **47 files / 2,677 tests PASS** |
| `git diff --check` | PASS (no whitespace errors) |

### Migration 015 apply

- **Environment note (operator):** `DATABASE_URL_MIGRATOR` was missing
  on Hetzner; the first invocation fell back to the local OS role
  `root` and failed with `role "root" does not exist`. Operator then
  re-ran migration 015 using the established staging
  `DATABASE_URL` role and the migration applied successfully.
- `poi_sequence_observations_v0_1` exists after migration. Role
  grants applied; Hard-Rule-I parity DO block passed (customer_api
  zero SELECT; internal_readonly SELECT-only with zero sequence
  USAGE / UPDATE).
- **Staging environment note only — no production / Render DB
  touched.**

### Pre-counts after migration apply

| Table | Pre |
| --- | --- |
| `accepted_events` | 14 |
| `ingest_requests` | 14 |
| `rejected_events` | 0 |
| `risk_observations_v0_1` | 2 |
| `scoring_output_lane_a` | 0 |
| `scoring_output_lane_b` | 0 |
| `session_behavioural_features_v0_2` | 16 |
| `session_features` | 8 |
| `stage0_decisions` | 8 |
| `poi_observations_v0_1` | 8 |
| `poi_sequence_observations_v0_1` | 0 (table just created, empty) |

### Worker first run — `npm run run:poi-sequence-worker`

| Signal | Result |
| --- | --- |
| `rows_scanned` | **8** |
| `sessions_seen` | **8** |
| `rows_inserted` | **8** |
| `rows_updated` | 0 |
| `rejects` | 0 |
| `pattern_class.single_poi` | **8** |
| `repeated_same_poi` / `multi_poi_linear` / `loop_or_backtrack` / `insufficient_temporal_data` / `unknown` | 0 each ✓ |
| `stage0_excluded_count` | **6** |
| `poi_sequence_eligible_count` | **2** (pure inverse holds ✓) |
| `run_metadata.source_table` | `poi_observations_v0_1` |
| `run_metadata.target_table` | `poi_sequence_observations_v0_1` |
| `run_metadata.record_only` | `true` |

### Worker rerun — idempotency check

| Signal | Result |
| --- | --- |
| `rows_scanned` | 8 |
| `sessions_seen` | 8 |
| `rows_inserted` | **0** |
| `rows_updated` | **8** |
| `rejects` | 0 |
| `pattern_class.single_poi` | 8 |
| `stage0_excluded_count` | 6 |
| `poi_sequence_eligible_count` | 2 |
| `poi_sequence_observations_v0_1` row count after rerun | **8 (stable)** ✓ |

Row-count idempotency confirmed. `derived_at` and `updated_at` advanced per the locked semantics in §6.

### Verification SQL — `docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql`

| Check | Result |
| --- | --- |
| `table_present` | `t` ✓ |
| Duplicate natural keys | 0 |
| `poi_sequence_eligible` mismatch (≠ NOT stage0_excluded) | 0 |
| Invalid `poi_sequence_pattern_class` | 0 |
| `has_progression` mismatch (≠ `unique_poi_count >= 2`) | 0 |
| `progression_depth` mismatch (≠ `unique_poi_count`) | 0 |
| `repeated_poi_count` mismatch (≠ `poi_count - unique_poi_count`) | 0 |
| `has_repetition` mismatch (≠ `repeated_poi_count > 0`) | 0 |
| `source_poi_observation_count` ≠ `poi_count` | 0 |
| Negative counts / out-of-range `unique_poi_count` | 0 |
| Timestamp ordering violations | 0 |
| Negative duration | 0 |
| Empty / non-array `evidence_refs` | 0 |
| Forbidden direct `evidence_refs[].table` (OD-14 check) | **0** ✓ |
| Bad `evidence_refs[].poi_observation_id` | 0 |
| Non-object `source_versions` | 0 |
| Forbidden column names present | **0** ✓ |
| Lane A / Lane B parity | both 0 / 0 (pre = post) ✓ |
| POI coverage gap (sessions in `poi_observations_v0_1` not in `poi_sequence_observations_v0_1`) | **0** ✓ |

### Post-counts after worker (pre = post on every monitored table; only `poi_sequence_observations_v0_1` grew from 0 → 8)

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
| `poi_sequence_observations_v0_1` | 0 | **8** (worker insertions; expected) |

Source / control tables unchanged. Lane A / Lane B unchanged. Only target table grew, exactly as the locked scope requires.

### Regression observers — concurrent PASS

| Observer | Result |
| --- | --- |
| `observe:risk-core-bridge` | PASS — `rows_scanned: 2`, `envelopes_built: 2`, `rejects: 0` |
| `observe:poi-core-input` | PASS — `rows_scanned: 24`, `envelopes_built: 8`, `rejects: 16` (all `NO_PAGE_PATH_CANDIDATE` from SBF rows — expected v0.1 behaviour), `stage0_excluded: 6`, `eligible_for_poi: 2` |
| `observe:poi-table` | PASS — `table_present: true`, `rows_in_table: 8`, `total_anomalies: 0`, `forbidden_column_present_count: 0` |
| `observe:poi-sequence` (PR#12b) | PASS — `rows_scanned: 8`, `sessions_seen: 8`, `poi_sequences_built: 8`, `single_poi: 8`, `total_anomalies: 0` |

PR#6 / PR#7b / PR#8b / PR#9a / PR#10 / PR#11a..d / PR#12b behaviour remains intact after PR#12d lands. No regression observed.

### Scope confirmation

- ✓ Migration 015 applied on staging only.
- ✓ Worker wrote only `poi_sequence_observations_v0_1`.
- ✓ Source / control tables unchanged.
- ✓ Lane A / Lane B unchanged at 0 / 0.
- ✓ No Render production touched (A0 P-4 still active).
- ✓ No customer output.
- ✓ No Trust / Policy / Product-Context Fit.
- ✓ No AMS Series Core runtime naming.

### Verdict

**PR#12d Hetzner staging proof PASS.**
PR#12d is staging-proven and closed after this doc patch is committed.

**Next safe step:** PR#12e planning / implementation for the
read-only POI Sequence table observer (mirrors PR#11d structure
applied to `poi_sequence_observations_v0_1`) + its own Hetzner
proof. **Keep PR#12e separate** — do NOT bundle observer work into
PR#12d post-hoc.

---

## §10 Rollback path

Forward-only at the file level. To revert PR#12d:

```bash
# Remove migration + worker module + script + test + verification + this doc.
git rm migrations/015_poi_sequence_observations_v0_1.sql
git rm -r src/scoring/poi-sequence-worker
git rm scripts/run-poi-sequence-worker.ts
git rm tests/v1/poi-sequence-worker.test.ts
git rm docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql
git rm docs/sprint2-pr12d-poi-sequence-observations-table-worker.md

# Remove the npm script line from package.json (manual edit).
#   Delete: "run:poi-sequence-worker": "tsx scripts/run-poi-sequence-worker.ts",

# Remove the schema.sql mirror block (manual edit; lines between the
# new "Sprint 2 PR#12d — POI Sequence observation evidence layer"
# header and the final CREATE INDEX for poi_seq_obs_v0_1_stage0_excluded).
```

**DB rollback** (operator-only; not executed by CI):

```sql
REVOKE ALL ON poi_sequence_observations_v0_1 FROM buyerrecon_migrator;
REVOKE ALL ON poi_sequence_observations_v0_1 FROM buyerrecon_scoring_worker;
REVOKE ALL ON poi_sequence_observations_v0_1 FROM buyerrecon_internal_readonly;
REVOKE ALL ON SEQUENCE poi_sequence_observations_v0_1_poi_sequence_observation_id_seq
       FROM buyerrecon_scoring_worker;
DROP TABLE IF EXISTS poi_sequence_observations_v0_1;
```

No CASCADE — there are no FK references either way.

---

## §11 PR checklist (per workflow truth file §24)

| Field | Value |
| --- | --- |
| **Workflow layer** | Evidence layer / POI Sequence durable persistence (truth file §4C / §9) |
| **Allowed source tables** | `poi_observations_v0_1` only |
| **Forbidden source tables** | `accepted_events`, `rejected_events`, `ingest_requests`, `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`, `site_write_tokens` |
| **Customer-facing or internal-only** | Internal-only; no customer exposure |
| **Score / verdict / reason-code allowed?** | Forbidden — this PR is evidence persistence, not decision |
| **DB writes** | Single durable table write to `poi_sequence_observations_v0_1` only; no other writes |
| **Observer-first or durable table** | Durable table + manual worker (PR#11c precedent). Observer is PR#12e (deferred) |
| **Version fields** | `poi_sequence_version = 'poi-sequence-v0.1'`, frozen literal |
| **Rollback path** | File-level removal + operator DROP TABLE; see §10 |
| **Codex review checklist** | Source allowlist, forbidden-table sweep, AMS Series-name guard, classification mirrors PR#12b, evidence_refs direct-POI-only (OD-14), Stage 0 carry-through, privacy posture, idempotency, no scheduler |

---

**End of PR#12d implementation documentation.**
