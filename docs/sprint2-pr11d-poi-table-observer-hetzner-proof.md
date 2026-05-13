# Sprint 2 PR#11d — POI Observations Table Observer + Hetzner Proof

**Status.** Implementation complete. Read-only table observer module +
CLI + tests + this impl/runbook/proof doc. **No DB applied yet — local
gates green; Hetzner staging proof is the runbook below (Helen runs
manually). Not committed. Not pushed.**

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| Parent (PR#11c impl) | `e90b18b3d4e02ba4daef278a78e499ade6ed66c0` |
| PR#11b commit (POI observer Hetzner-proven) | `1a3b252` (read-only reference) |
| PR#10 POI Core Input Contract HEAD | `f9d2a75` (read-only reference) |

**Authority.**

- `docs/sprint2-pr11c-poi-observations-table-worker.md` (PR#11c impl + Hetzner-proof gate)
- `docs/sprint2-pr11c-poi-observations-table-worker-planning.md` (Helen-signed OD-1..OD-11)
- `docs/sprint2-pr11b-poi-core-input-observer.md` (PR#11b impl + Hetzner proof)
- `docs/sprint2-pr11a-poi-derived-observation-planning.md` (Helen-signed OD-1..OD-10)
- `docs/sprint2-pr10-poi-core-input.md` (PR#10 contract — shared adapter)
- `migrations/014_poi_observations_v0_1.sql` (PR#11c migration)
- `docs/sql/verification/14_poi_observations_v0_1_invariants.sql` (PR#11c invariants)
- AMS shared-core priority: **Risk → POI → Series → Trust → Policy**

---

## §1 What PR#11d ships

Seven new files + a one-line `package.json` modification. Read-only
diagnostic over the durable `poi_observations_v0_1` table PR#11c
created. **No DB write, no migration, no schema change, no worker,
no customer-facing output, no Render touch.**

**Created (7 new files):**

| Path | Purpose |
| --- | --- |
| `src/scoring/poi-table-observer/types.ts` | `AnomalyKind` union (9 kinds, mirrors verification SQL checks #1-#8 + #13); `FORBIDDEN_COLUMNS` allowlist (mirrors check #9); `POI_OBSERVATION_VERSION_EXPECTED = 'poi-observation-v0.1'` PR#11d-local literal (Codex-blocker fix — PR#11d does NOT import from PR#11c worker runtime; dual source of truth deliberately forces a contract review on future bumps); `TableObserverRunOptions`; `TableObserverReport`; `TableObserverRunMetadata`. The `verification_score` literal is constructed at module-load time so this file complies with the PR#3 `verification_score` allowlist sweep without disabling the privacy check. |
| `src/scoring/poi-table-observer/query.ts` | 30 parameterised SQL constants — table-presence, row-count, forbidden-column sweep, **9 anomaly COUNT(*) queries (authoritative, no LIMIT)**, **9 anomaly sample queries (capped at $5 anomaly_sample_limit)**, 9 distribution queries, identity-diagnostic counts, sample-session-id query. The COUNT/SAMPLE split is the Codex-blocker fix in this revision — counters are now exact regardless of sample cap. All positional params. Zero DML / DDL / GRANT / REVOKE / writes against ANY table. |
| `src/scoring/poi-table-observer/report.ts` | Pure aggregator + masking. `truncateSessionId` (prefix+`…`+suffix, `***` if <12 chars), `parseDatabaseUrl` (host+name only). Anomaly samples are integer-only `poi_observation_id` arrays — no session_id, no poi_key, no evidence_refs, no source_row_id, no raw row contents. `anomaly_sample_limit=0` suppresses samples entirely. |
| `src/scoring/poi-table-observer/runner.ts` | Orchestrator. Calls SELECT_TABLE_PRESENT_SQL first; if false, returns an early empty report. Otherwise issues the separate COUNT/SAMPLE and distribution SELECTs in sequence, threads results through the aggregator. Exports `runPoiTableObserver`, `makeStubClient`, `parseDatabaseUrl`, `truncateSessionId`, `serialiseReport`. |
| `src/scoring/poi-table-observer/index.ts` | Public re-exports. |
| `scripts/poi-table-observation-report.ts` | CLI: env parse → pg pool → run → emit JSON to stdout → close pool. DSN masked. Exit 0/1 (require_rows)/2 (fatal). |
| `tests/v1/poi-table-observer.test.ts` | 32 pure tests across groups A–K. Stub-client tests cover authoritative anomaly counters (counter remains exact when samples are suppressed, capped, or empty — Codex-blocker fix), distribution folding, healthy-run end-to-end, table-absent early exit, forbidden-column sweep, static-source boundary discipline (now also asserts no imports from `poi-core-worker` per BLOCKER 2 fix), SQL-constant allowlist for both COUNT and SAMPLE families. |
| `docs/sprint2-pr11d-poi-table-observer-hetzner-proof.md` | (this file) |

**Modified (1 file):**

| Path | Change |
| --- | --- |
| `package.json` | One new script entry only: `"observe:poi-table": "tsx scripts/poi-table-observation-report.ts"`. Zero dependency / devDependency / unrelated-script change. |

---

## §2 What PR#11d does NOT ship

- ❌ No `migrations/*.sql`.
- ❌ No `schema.sql` change.
- ❌ No new dependency / no `package-lock.json` regeneration.
- ❌ No Render production deploy — A0 P-4 still blocking.
- ❌ No DB applied during implementation. Migration 014 is applied
  manually by Helen via the runbook in §6 below.
- ❌ No worker. No persistence path of any kind.
- ❌ No customer-facing output. JSON-to-stdout for engineering only.
- ❌ No Policy / Trust / Series / Product-Context-Fit implementation.
- ❌ No `accepted_events` / `rejected_events` / `ingest_requests` /
  `risk_observations_v0_1` / `session_features` /
  `session_behavioural_features_v0_2` / `stage0_decisions` /
  `scoring_output_lane_a` / `scoring_output_lane_b` /
  `site_write_tokens` reads. Static-source sweep verifies. Source-
  vs-table parity + Lane A/B comparison belong to the operator
  runbook (§6 — `psql` count commands).
- ❌ No PR#0..PR#11c source modified. PR#11b observer + PR#11c
  worker remain untouched; PR#11d has its own observer module.
- ❌ No imports from PR#11b observer or PR#11c worker. The expected
  POI observation version literal is local to
  `src/scoring/poi-table-observer/types.ts` as
  `POI_OBSERVATION_VERSION_EXPECTED` (Codex-blocker fix in this
  revision — the prior import from
  `src/scoring/poi-core-worker/index.js` has been removed; the
  test-J static-source sweep now asserts ZERO imports from either
  module under the PR#11d source tree).
- ❌ No anomaly sample carries session_id / poi_key /
  evidence_refs / source_row_id / raw row contents. Samples are
  non-PII BIGSERIAL integers (`poi_observation_id`) only.

---

## §3 Read-only boundary (locked)

**Allowed reads:**

- `poi_observations_v0_1`           (primary diagnostic target)
- `information_schema.tables`       (table-presence check)
- `information_schema.columns`      (forbidden-column sweep, check #9)

**Forbidden reads (PR#11d locked boundary — enforced by `query.ts`
constants + the static-source sweep in `tests/v1/poi-table-observer.test.ts`
group J):**

- `session_features`
- `session_behavioural_features_v0_2`
- `stage0_decisions`
- `accepted_events`, `rejected_events`, `ingest_requests`
- `risk_observations_v0_1`
- `scoring_output_lane_a`, `scoring_output_lane_b`
- `site_write_tokens`

**Forbidden writes:** any DML/DDL anywhere. Zero `INSERT/UPDATE/DELETE/
TRUNCATE/CREATE/ALTER/DROP/GRANT/REVOKE` in active source.

Any comparison with source / Lane / Stage 0 counts is operator-side
proof via `psql` in the runbook (§6), NOT observer SQL.

---

## §4 Observer report shape

```ts
TableObserverReport = {
  // Top-line state
  table_present:                    boolean,
  rows_in_table:                    number,
  rows_inspected:                   number,

  // Anomaly counters (all should be 0 in a healthy run)
  duplicate_natural_key_count:        number,
  poi_eligible_mismatch_count:        number,
  evidence_refs_invalid_count:        number,
  source_versions_invalid_count:      number,
  v0_1_enum_violation_count:          number,
  negative_source_event_count_count:  number,
  timestamp_ordering_violation_count: number,
  poi_key_unsafe_count:               number,
  evidence_refs_forbidden_key_count:  number,

  // Schema-level forbidden-column sweep (check #9)
  forbidden_column_present_count:     number,
  forbidden_column_names_present:     string[],

  total_anomalies:                    number,  // rollup of all 10 above

  // Anomaly samples — non-PII poi_observation_id values only
  // (default 5 per kind; OBS_ANOMALY_SAMPLE_LIMIT=0 suppresses)
  anomaly_samples: {
    duplicate_natural_key:           number[],
    poi_eligible_mismatch:           number[],
    evidence_refs_invalid:           number[],
    source_versions_invalid:         number[],
    v0_1_enum_violation:             number[],
    negative_source_event_count:     number[],
    timestamp_ordering_violation:    number[],
    poi_key_unsafe:                  number[],
    evidence_refs_forbidden_key:     number[],
  },

  // Distributions (engineering inspection)
  poi_type_distribution:                  Record<PoiType, number>,                            // 6 buckets initialised to 0
  poi_surface_class_distribution:         Record<PoiSurfaceClass, number>,                    // 14 buckets initialised to 0
  source_table_distribution:              Record<PoiSourceTable, number>,                     // 2 buckets initialised to 0
  poi_key_source_field_distribution:      Record<'landing_page_path' | 'last_page_path', number>,
  stage0_excluded_distribution:           { true_count: number, false_count: number },
  poi_eligible_distribution:              { true_count: number, false_count: number },
  extraction_version_distribution:        Record<string, number>,
  poi_input_version_distribution:         Record<string, number>,
  poi_observation_version_distribution:   Record<string, number>,

  // Identity diagnostics — masked
  unique_session_ids_seen:                number,
  unique_workspace_site_pairs_seen:       number,
  sample_session_id_prefixes:             string[],   // prefix+…+suffix; raw never serialised

  run_metadata: {
    source_table:                         'poi_observations_v0_1',
    workspace_id_filter:                  string | null,
    site_id_filter:                       string | null,
    window_start:                         string,    // ISO-8601
    window_end:                           string,    // ISO-8601
    row_limit:                            number,
    sample_limit:                         number,
    anomaly_sample_limit:                 number,
    database_host:                        string,    // host (DSN masked)
    database_name:                        string,
    run_started_at:                       string,    // observer wall-clock
    run_ended_at:                         string,    // observer wall-clock
    poi_input_version_expected:           string,    // 'poi-core-input-v0.1'
    poi_observation_version_expected:     string,    // 'poi-observation-v0.1'
    forbidden_columns_checked:            string[],  // the v0.1 column allowlist
    record_only:                          true,
  },
}
```

### §4.1 Anomaly-sample privacy invariants

Per Helen's locked rules:

- Samples are arrays of `poi_observation_id` values only — non-PII
  internal BIGSERIAL integers.
- No `session_id` in samples.
- No `poi_key` in samples.
- No `evidence_refs` in samples.
- No `source_row_id` in samples.
- No raw row contents in samples.
- `OBS_ANOMALY_SAMPLE_LIMIT` defaults to 5; set to 0 to suppress
  samples entirely (samples become empty arrays for every kind).
- `forbidden_column_names_present` carries column names verbatim
  because column names are schema metadata, not row data.

**Counters are authoritative.** Each anomaly check runs TWO SQL
queries: an exact `COUNT(*)` (no LIMIT) and a separate sample query
(capped at `OBS_ANOMALY_SAMPLE_LIMIT`). The counter is the count
returned by the `COUNT(*)` query — it is exact regardless of how
many samples the operator asked for, and it does NOT derive from
sample-array length. Samples are an investigation aid; when
`OBS_ANOMALY_SAMPLE_LIMIT=0` the runner skips the sample query
entirely but still issues the count query, so the counter reflects
the true total even when samples are fully suppressed. (This is the
Codex-blocker fix applied in this revision: the previous design
returned offending IDs up to a LIMIT and derived the counter from
the returned array length, which made the counter a lower bound
when the LIMIT capped — that contract violation is now removed.)

---

## §5 Test results (local gates)

```
> npx tsc --noEmit                                  → PASS (exit 0)
> npm run check:scoring-contracts                    → Scoring contracts check PASS
> npm test -- tests/v1/poi-table-observer.test.ts
  Test Files  1 passed (1)
       Tests  32 passed (32)            ← +2 from the Codex-blocker patch
                                          (authoritative-counter Group C
                                          gained 2 new scenarios; existing
                                          tests still pass)
   Duration  ~255ms
> npm test
  Test Files  45 passed (45)        ← +1 vs. PR#11c's 44 files
       Tests  2556 passed (2556)    ← +32 vs. PR#11c's 2524 tests
   Duration  ~1.18s
> git diff --check                                  → clean (exit 0)
```

The **32 PR#11d targeted tests** cover:

- **A. Masking helpers** (4): `truncateSessionId` long/short/empty +
  `parseDatabaseUrl` masking.
- **B. Aggregator counters + rollup** (3): empty → zero anomalies;
  per-kind IDs feed correct counter + `total_anomalies` rollup;
  `forbidden_column_names_present` surfaces verbatim.
- **C. Anomaly samples** (5): default sample_limit=5 caps to 5;
  `anomaly_sample_limit=0` suppresses ALL samples; samples
  integer-only; serialised JSON anomaly-samples block is
  integer-only (parsed-JSON structural check, not regex); report
  JSON has no forbidden field-name keys.
- **D. Distribution folding** (4): text bucket+count → record;
  boolean bucket → `{true_count, false_count}`; `poi_surface_class`
  initialised to all 14 zero buckets; `poi_key_source_field` folds
  both enum values.
- **E. Run metadata** (1): source_table, target stamps, `record_only:
  true`, `forbidden_columns_checked` = FORBIDDEN_COLUMNS.
- **F. End-to-end healthy run** (1): 8 SF-derived POI envelopes,
  6 Stage-0-excluded / 2 eligible, distributions match, samples
  masked, counters all zero.
- **G. Table absent** (1): `table_present=false` → early empty
  report, NO further queries issued.
- **H. Anomalies surface** (2): duplicate + unsafe rows propagate
  to counters + samples; `anomaly_sample_limit=0` option suppresses
  samples while counters still reflect truth.
- **I. Forbidden-column sweep** (2): observed offenders land on the
  report; FORBIDDEN_COLUMNS contains all PR#11c §4.2 exclusions
  including `behavioural_feature_version`.
- **J. Static-source sweep** (3): no DML/DDL in active source; no
  `FROM`/`JOIN` against forbidden tables; no imports from PR#11b
  observer, policy/trust/series/lane, collector/app/server/auth.
- **K. SQL constants** (4): every query reads only
  `poi_observations_v0_1` or `information_schema`; every query is
  read-only; `SELECT_TABLE_PRESENT_SQL` targets
  `information_schema.tables`; `SELECT_FORBIDDEN_COLUMNS_SQL`
  targets `information_schema.columns`.

---

## §6 Hetzner staging proof — runbook (Helen runs manually)

The runbook reproduces the PR#11b / PR#8b cadence verbatim: sync the
Hetzner working tree to the branch HEAD, run local gates on the
Hetzner tree, set OBS env vars, capture PRE counts, apply migration
014, run worker, run verification SQL, run table observer, capture
POST counts, confirm read-only invariants. **Each command below is
exactly what Helen runs against Hetzner staging.**

> **Path note:** the Hetzner staging server holds the repository at
> `/opt/buyerrecon-backend`. Every `cd` / `git` / `npm` / `psql`
> command in §6 runs from that directory on the Hetzner server, NOT
> from the operator's local Mac path (`/Users/admin/github/buyerrecon-backend`).
>
> **Pre-conditions:** the Hetzner staging DSN is set in the
> environment, the four DB roles (`buyerrecon_migrator`,
> `buyerrecon_scoring_worker`, `buyerrecon_internal_readonly`,
> `buyerrecon_customer_api`) exist (per PR#3 OD-7 / PR#5 / PR#6 /
> PR#11c migration role-existence assertions), and the operator has
> migrator-level privileges to apply migration 014. **No production.
> No Render.**

### §6.1 Step 1 — Sync the Hetzner working tree to the branch HEAD

The Hetzner staging server holds the repository at
`/opt/buyerrecon-backend` (NOT the operator's local Mac path). Sync
the tree to the latest pushed commit of the sprint branch and
confirm a clean state before running any gate.

```bash
cd /opt/buyerrecon-backend

git fetch origin sprint2-architecture-contracts-d4cc2bf
git switch sprint2-architecture-contracts-d4cc2bf 2>/dev/null \
  || git switch -c sprint2-architecture-contracts-d4cc2bf \
       --track origin/sprint2-architecture-contracts-d4cc2bf

git reset --hard origin/sprint2-architecture-contracts-d4cc2bf

git rev-parse HEAD
git status --short
```

**Expected:** branch `sprint2-architecture-contracts-d4cc2bf`;
`git rev-parse HEAD` returns `<PR11D_HEAD_AFTER_COMMIT>` (the
PR#11d commit pushed to origin after Codex xhigh PASS and Helen
sign-off — see §9 for the exact pre-proof ordering). `git status
--short` returns an empty line set (clean working tree after the
`git reset --hard`).

> **Do not continue if `git rev-parse HEAD` is `e90b18b`.** That
> commit is the PR#11c parent only and does NOT include the PR#11d
> table observer, the COUNT/SAMPLE SQL constants, or any of the
> Codex-blocker patches landed in this revision. Running the proof
> against `e90b18b` would invoke `npm run observe:poi-table` with
> the script missing on disk — and even if it were present, would
> use stale anomaly-counter semantics (sample-derived, not
> authoritative). The Hetzner proof MUST run only against the
> committed-and-pushed PR#11d HEAD.

### §6.2 Step 2 — Local gates on the Hetzner working tree

```bash
cd /opt/buyerrecon-backend

# Type-check + scoring contracts + targeted + full suite
npx tsc --noEmit
npm run check:scoring-contracts
npm test -- tests/v1/poi-table-observer.test.ts
npm test
git diff --check
```

**Expected:** all gates exit 0; 45/45 files / 2554/2554 tests pass.

### §6.3 Step 3 — Set environment variables (both observer + worker)

The PR#11b Risk-Core observer, PR#11b POI observer, and PR#11d POI
table observer all share the `OBS_*` env-var prefix. The PR#11c
worker uses **unprefixed** env-var names (`WORKSPACE_ID`, `SITE_ID`,
`WINDOW_HOURS`). To avoid an inline re-export inside the worker
step, set **both** variants together here so every later step picks
up the right value verbatim — no in-step re-exports.

```bash
export DATABASE_URL='<HETZNER STAGING DSN>'    # never logged; host + db name only surface

# Observer prefix (used by §6.6, §6.10, §6.12)
export OBS_WORKSPACE_ID=buyerrecon_staging_ws
export OBS_SITE_ID=buyerrecon_com
export OBS_WINDOW_HOURS=720

# Worker unprefixed names (used by §6.7 / §6.8)
export WORKSPACE_ID=buyerrecon_staging_ws
export SITE_ID=buyerrecon_com
export WINDOW_HOURS=720
```

> **DSN role note:** `DATABASE_URL` must resolve to a role that has
> migrator privileges (for §6.5) AND scoring_worker INSERT/UPDATE
> privileges on `poi_observations_v0_1` (for §6.7) AND read access
> on every monitored table (for psql counts in §6.4 / §6.11). On
> Hetzner staging this is the migrator DSN; production has stricter
> separation (not exercised here — A0 P-4 still blocks Render).

### §6.4 Step 4 — PRE counts via psql (operator-side parity baseline)

```bash
psql "$DATABASE_URL" -At -c "SELECT 'accepted_events', COUNT(*) FROM accepted_events;"
psql "$DATABASE_URL" -At -c "SELECT 'ingest_requests', COUNT(*) FROM ingest_requests;"
psql "$DATABASE_URL" -At -c "SELECT 'rejected_events', COUNT(*) FROM rejected_events;"
psql "$DATABASE_URL" -At -c "SELECT 'risk_observations_v0_1', COUNT(*) FROM risk_observations_v0_1;"
psql "$DATABASE_URL" -At -c "SELECT 'scoring_output_lane_a', COUNT(*) FROM scoring_output_lane_a;"
psql "$DATABASE_URL" -At -c "SELECT 'scoring_output_lane_b', COUNT(*) FROM scoring_output_lane_b;"
psql "$DATABASE_URL" -At -c "SELECT 'session_behavioural_features_v0_2', COUNT(*) FROM session_behavioural_features_v0_2;"
psql "$DATABASE_URL" -At -c "SELECT 'session_features', COUNT(*) FROM session_features;"
psql "$DATABASE_URL" -At -c "SELECT 'stage0_decisions', COUNT(*) FROM stage0_decisions;"
# poi_observations_v0_1 doesn't exist yet — skip until after migration apply
```

**Expected** (carries forward from PR#11b Hetzner proof):
accepted_events 14, ingest_requests 14, rejected_events 0,
risk_observations_v0_1 2, scoring_output_lane_a 0,
scoring_output_lane_b 0, session_behavioural_features_v0_2 16,
session_features 8, stage0_decisions 8.

### §6.5 Step 5 — Apply migration 014

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/014_poi_observations_v0_1.sql
```

**Expected:** exit 0. The migration's role-existence DO blocks pass
(roles exist). The Hard-Rule-I parity DO block passes
(`buyerrecon_customer_api` has zero SELECT on `poi_observations_v0_1`;
`buyerrecon_internal_readonly` has SELECT on the table but zero
USAGE/UPDATE on the BIGSERIAL sequence — Codex blocker fix).

**Re-apply check** (idempotency):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/014_poi_observations_v0_1.sql
```

**Expected:** exit 0 (no-op; `IF NOT EXISTS` clauses on table + indexes).

### §6.6 Step 6 — Verification SQL run (pre-worker, table empty)

```bash
psql "$DATABASE_URL" -At -f docs/sql/verification/14_poi_observations_v0_1_invariants.sql
```

**Expected:** every numbered check returns zero rows OR an empty
distribution. The table exists but is empty.

### §6.7 Step 7 — PR#11c worker run

```bash
npm run run:poi-core-worker
```

(Worker reads `WORKSPACE_ID` / `SITE_ID` / `WINDOW_HOURS` from the
exports in §6.3 — no re-export needed.)

**Expected:** exit 0; stdout JSON report carries:
- `rows_scanned: 8` (matches PR#11b's 8 SF envelopes)
- `rows_inserted: 8`
- `rows_updated: 0`
- `rejects: 0`
- `poi_type_distribution.page_path: 8`
- `source_table_distribution.session_features: 8`
- `stage0_excluded_count: 6`
- `eligible_for_poi_count: 2`
- `unsafe_poi_key_reject_count: 0`
- `evidence_ref_reject_count: 0`
- DSN masked, full session_id never printed.

### §6.8 Step 8 — Idempotency check (re-run worker)

```bash
npm run run:poi-core-worker
```

**Expected:** exit 0; same 8 rows but now hit ON CONFLICT DO UPDATE:
- `rows_inserted: 0`
- `rows_updated: 8`
- `rows_unchanged: 0` (PR#11c v0.1 always sets `updated_at = NOW()`)

### §6.9 Step 9 — Verification SQL re-run (post-worker, table populated)

```bash
psql "$DATABASE_URL" -At -f docs/sql/verification/14_poi_observations_v0_1_invariants.sql
```

**Expected:**
- Checks #1-#9 + #13: **zero rows** (all anomaly checks clean).
- Check #10 (Lane A/B parity): `scoring_output_lane_a` row count `0`,
  `scoring_output_lane_b` row count `0`.
- Check #11 (stage0 distribution): `stage0_excluded=TRUE` count `6`,
  `stage0_excluded=FALSE` count `2`.
- Check #12 (poi_key_source_field): one or both of
  `landing_page_path` / `last_page_path` populated, totals to 8.
- Check #14 (sample 20): up to 8 rows, each with `poi_type='page_path'`,
  `source_table='session_features'`, `record_only=TRUE`.

### §6.10 Step 10 — PR#11d table observer run

```bash
npm run observe:poi-table
```

**Expected:** exit 0; stdout JSON report:
- `table_present: true`
- `rows_in_table: 8`
- `total_anomalies: 0`
- All 9 anomaly counters: `0`
- `forbidden_column_present_count: 0`
- `forbidden_column_names_present: []`
- `poi_type_distribution: { page_path: 8, route: 0, cta_id: 0, form_id: 0, offer_surface: 0, referrer_class: 0 }`
- `source_table_distribution: { session_features: 8, session_behavioural_features_v0_2: 0 }`
- `stage0_excluded_distribution: { true_count: 6, false_count: 2 }`
- `poi_eligible_distribution: { true_count: 2, false_count: 6 }`
- `poi_key_source_field_distribution`: 8 across `landing_page_path` / `last_page_path`
- `extraction_version_distribution: { 'session-features-v0.1': 8 }`
- `poi_input_version_distribution: { 'poi-core-input-v0.1': 8 }`
- `poi_observation_version_distribution: { 'poi-observation-v0.1': 8 }`
- `unique_session_ids_seen: 8`
- `unique_workspace_site_pairs_seen: 1`
- `sample_session_id_prefixes`: array of masked prefixes (e.g.
  `["sess_aaa…2222", ...]`)
- `anomaly_samples`: all 9 arrays empty
- `run_metadata.source_table: 'poi_observations_v0_1'`
- `run_metadata.record_only: true`
- DSN masked, full session_id never printed.

### §6.11 Step 11 — POST counts via psql (parity check)

```bash
psql "$DATABASE_URL" -At -c "SELECT 'accepted_events', COUNT(*) FROM accepted_events;"
psql "$DATABASE_URL" -At -c "SELECT 'ingest_requests', COUNT(*) FROM ingest_requests;"
psql "$DATABASE_URL" -At -c "SELECT 'rejected_events', COUNT(*) FROM rejected_events;"
psql "$DATABASE_URL" -At -c "SELECT 'risk_observations_v0_1', COUNT(*) FROM risk_observations_v0_1;"
psql "$DATABASE_URL" -At -c "SELECT 'scoring_output_lane_a', COUNT(*) FROM scoring_output_lane_a;"
psql "$DATABASE_URL" -At -c "SELECT 'scoring_output_lane_b', COUNT(*) FROM scoring_output_lane_b;"
psql "$DATABASE_URL" -At -c "SELECT 'session_behavioural_features_v0_2', COUNT(*) FROM session_behavioural_features_v0_2;"
psql "$DATABASE_URL" -At -c "SELECT 'session_features', COUNT(*) FROM session_features;"
psql "$DATABASE_URL" -At -c "SELECT 'stage0_decisions', COUNT(*) FROM stage0_decisions;"
psql "$DATABASE_URL" -At -c "SELECT 'poi_observations_v0_1', COUNT(*) FROM poi_observations_v0_1;"
```

**Expected:**
- All counts EQUAL to PRE counts from §6.4 except
  `poi_observations_v0_1 = 8`.
- **Lane A/B parity** confirmed: `scoring_output_lane_a` and
  `scoring_output_lane_b` both `0` PRE and `0` POST.

### §6.12 Step 12 — Regression checks (other observers still PASS)

```bash
npm run observe:risk-core-bridge       # PR#8b observer
npm run observe:poi-core-input         # PR#11b observer
```

**Expected:** both exit 0 and report counts unchanged from prior
Hetzner proofs (PR#8b @ 011b6c2, PR#11b @ 1a3b252).

---

## §7 Hetzner staging proof — transcript

> **For Helen to paste her actual command output below after the
> review→commit→push→proof ordering in §9 has completed (Codex PASS
> → sign-off → commit → push → Hetzner proof run). Each subsection
> mirrors the §6 runbook steps. Do not paste output from a proof
> run against any HEAD other than `<PR11D_HEAD_AFTER_COMMIT>`.**

### §7.1 Step 1 — Sync Hetzner working tree

```
<paste git fetch / git switch / git reset --hard / git rev-parse HEAD / git status --short output here>
```

### §7.2 Step 2 — Local gates on the Hetzner tree

```
<paste tsc / scoring-contracts / npm test (targeted + full) / git diff --check output here>
```

### §7.3 Step 3 — Environment variables (observer + worker)

```
<paste any env confirmation here (do NOT paste the full DSN); both OBS_* and unprefixed forms are set>
```

### §7.4 Step 4 — PRE counts

```
<paste psql count output here>
```

### §7.5 Step 5 — Migration 014 apply

```
<paste psql migration apply output here>
<paste idempotency re-apply output here>
```

### §7.6 Step 6 — Verification SQL pre-worker

```
<paste psql -f output here (all anomaly checks empty; table empty)>
```

### §7.7 Step 7 — Worker run

```
<paste npm run run:poi-core-worker stdout here (JSON report)>
```

### §7.8 Step 8 — Idempotency re-run

```
<paste second worker run stdout here>
```

### §7.9 Step 9 — Verification SQL post-worker

```
<paste psql -f output here>
```

### §7.10 Step 10 — Table observer run

```
<paste npm run observe:poi-table stdout here (JSON report)>
```

### §7.11 Step 11 — POST counts

```
<paste psql count output here>
```

### §7.12 Step 12 — Regression checks

```
<paste npm run observe:risk-core-bridge output here>
<paste npm run observe:poi-core-input output here>
```

### §7.13 PASS / FAIL summary

- Migration 014 apply: <PASS / FAIL>
- Migration 014 idempotency: <PASS / FAIL>
- Worker first run: <PASS / FAIL>  (expected rows_inserted=8)
- Worker re-run idempotency: <PASS / FAIL>  (expected rows_updated=8)
- Verification SQL (post-worker): <PASS / FAIL>
- Table observer: <PASS / FAIL>  (expected total_anomalies=0)
- Source-table parity (PRE == POST): <PASS / FAIL>
- Lane A/B parity (0/0 PRE and POST): <PASS / FAIL>
- PR#8b observer regression: <PASS / FAIL>
- PR#11b observer regression: <PASS / FAIL>
- Render production untouched: <PASS / FAIL>  (A0 P-4 still blocking)
- No secrets / full DSN / full session_id in any stdout: <PASS / FAIL>

---

## §8 Confirmations

- ✅ **PR#11d ships only allowed files.** 7 new files + 1 line added
  to `package.json`. Zero other tracked-file modifications.
- ✅ **No DB applied during implementation.** Migration apply is in
  the runbook for Helen to execute.
- ✅ **Render production untouched.** A0 P-4 still blocking.
- ✅ **Observer reads only `poi_observations_v0_1` and
  `information_schema`.** Static-source sweep verifies — no
  `FROM`/`JOIN` against any forbidden table.
- ✅ **No DML / DDL in active source.** Zero `INSERT/UPDATE/DELETE/
  TRUNCATE/CREATE/ALTER/DROP/GRANT/REVOKE`.
- ✅ **No customer-facing output.** JSON-to-stdout for engineering.
- ✅ **No Policy / Trust / Series / Product-Context-Fit
  implementation.**
- ✅ **No PR#0..PR#11c source modified.**
- ✅ **No imports from PR#11b observer or PR#11c worker.** The
  expected POI observation version literal is local to
  `src/scoring/poi-table-observer/types.ts` as
  `POI_OBSERVATION_VERSION_EXPECTED`. The earlier worker-import
  exception has been removed in this revision (Codex BLOCKER 2
  patch). The test-J static-source sweep enforces ZERO imports
  from `src/scoring/poi-core-worker` under the PR#11d source tree.
- ✅ **Anomaly samples are non-PII integer arrays only.** No
  `session_id`, no `poi_key`, no `evidence_refs`, no `source_row_id`,
  no raw row contents.
- ✅ **`OBS_ANOMALY_SAMPLE_LIMIT=0` suppresses samples while
  counters still reflect truth.** Test C verifies.
- ✅ **DSN masked + session_id masked in every report path.**
- ✅ **Codex xhigh review pending.** Awaiting Codex review before
  commit.

---

## §9 Next step — review/commit/proof ordering (LOCKED)

The Hetzner staging proof in §6 / §7 MUST run only against a
committed-and-pushed PR#11d HEAD. The correct end-to-end ordering
is:

1. **Codex xhigh re-review PASS** on the local (uncommitted) PR#11d
   implementation. Codex inspects the impl doc + the source tree +
   the §5 local-gate results. Any BLOCKER → patch locally, re-review.
2. **Helen written sign-off** on the PR#11d implementation +
   runbook.
3. **Commit PR#11d** to `sprint2-architecture-contracts-d4cc2bf`
   locally. This creates `<PR11D_HEAD_AFTER_COMMIT>`.
4. **Push PR#11d** to `origin/sprint2-architecture-contracts-d4cc2bf`.
   Now `<PR11D_HEAD_AFTER_COMMIT>` is reachable from the Hetzner
   server.
5. **Helen runs the Hetzner staging proof** (§6):
   - SSH to the Hetzner staging server.
   - `cd /opt/buyerrecon-backend`.
   - Run §6.1 — `git fetch` + `git reset --hard
     origin/sprint2-architecture-contracts-d4cc2bf`. Confirm
     `git rev-parse HEAD` equals `<PR11D_HEAD_AFTER_COMMIT>` (NOT
     `e90b18b` — see §6.1 do-not-continue note).
   - Run §6.2..§6.12 in order; capture each step's output.
6. **(Optional) Paste §7 transcript** into the impl doc as a
   permanent staging-proof artefact. Push the transcript update as
   a follow-up commit if Helen wants it captured.
7. **PR#11 chain CLOSED** after the §7.13 PASS / FAIL summary is
   all PASS. With PR#11d Hetzner-proven, downstream consumers
   (Series / Trust / Policy / Product-Context-Fit) are now allowed
   to read or join `poi_observations_v0_1` per PR#11a §13 / PR#11c
   planning §10.

**Common-mistake guard.** The pre-revision ordering put Codex
review AFTER the Hetzner transcript. That was backwards: the
transcript proves behaviour on a real DB, but Codex must approve
the code that will run BEFORE it lands on staging. Codex →
sign-off → commit → push → proof is the only safe order. Do not
collapse steps; do not reorder.

**AMS shared-core priority continues:**

- Risk core: COMPLETE (PR#6 / PR#7 / PR#8b — Hetzner-proven).
- POI core: COMPLETE (PR#9a / PR#10 / PR#11a..d — Hetzner-proven
  once Helen pastes a PASS §7 transcript per the order above).
- Series core: NEXT.
- Trust core: follows Series.
- Policy: follows Trust.
- Product-Context-Fit: after Policy (or in parallel as a separate
  adapter PR, gated by Helen).

---

## §10 What this implementation does NOT do

- Does **not** apply the migration.
- Does **not** run the worker.
- Does **not** touch the DB or run `psql`.
- Does **not** touch Render.
- Does **not** modify PR#0..PR#11c source.
- Does **not** add a dependency.
- Does **not** create a migration / table / worker / shadow store.
- Does **not** create customer-facing output.
- Does **not** persist any state.
- Does **not** commit. Does **not** push.

Awaiting (in this exact order — see §9): Codex xhigh re-review
PASS → Helen sign-off → commit → push → Hetzner staging proof
(§6) → optional §7 transcript paste → PR#11 chain close.
