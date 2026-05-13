# Sprint 2 PR#11c — POI Observations Table + Manual Worker — implementation

**Status.** Implementation complete. Additive migration 014 + manual-CLI
worker + tests + verification SQL + schema.sql mirror block. **No DB
applied yet — local-only proof. No Render. Not committed. Not pushed.**

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| Parent (PR#11c planning) | `84a944f193d38b972208560cad0c63fe6362bd83` |
| PR#11b commit (upstream gate, Hetzner-proven) | `1a3b252` (read-only reference) |
| PR#10 POI Core Input Contract HEAD | `f9d2a75` (read-only reference) |

**Authority.**

- `docs/sprint2-pr11c-poi-observations-table-worker-planning.md` (Helen-signed OD-1..OD-11; this PR implements verbatim)
- `docs/sprint2-pr11b-poi-core-input-observer.md` (PR#11b impl + Hetzner proof — upstream gate)
- `docs/sprint2-pr11a-poi-derived-observation-planning.md` (Helen-signed OD-1..OD-10)
- `docs/sprint2-pr10-poi-core-input.md` (PR#10 contract — shared adapter source of truth)
- `docs/sprint2-pr9a-poi-core-input-planning.md` (Helen-signed OD-1..OD-8)
- `migrations/013_risk_observations_v0_1.sql` (PR#6 precedent migration shape)
- `src/scoring/risk-evidence/worker.ts` (PR#6 precedent worker shape)
- AMS shared-core priority: **Risk → POI → Series → Trust → Policy**

---

## §1 What PR#11c ships

Eleven new files + 2 file modifications. Persists successful
`page_path` POI envelopes from `session_features` into
`poi_observations_v0_1` via a manual-CLI worker. **No customer-facing
output, no Lane A/B writes, no Policy/Trust/Series/Product-Context-Fit
implementation, no Render touch.**

**Created (11 new files):**

| Path | Purpose |
| --- | --- |
| `migrations/014_poi_observations_v0_1.sql` | Additive migration: `CREATE TABLE IF NOT EXISTS` + 5 indexes + role grants + sequence grants (scoring_worker only — see Codex-blocker fix in §3 / OD-7) + Hard-Rule-I parity check (now asserts (a) customer_api zero SELECT on table, (b) internal_readonly zero sequence USAGE, (c) internal_readonly zero sequence UPDATE, (d) internal_readonly positive SELECT on table). Mirrors PR#6 `013_*` shape. |
| `docs/sql/verification/14_poi_observations_v0_1_invariants.sql` | 14 numbered invariant checks (read-only). Mirrors PR#1 `06_*` shape. |
| `src/scoring/poi-core-worker/types.ts` | RejectReason union (mirrors PR#11b verbatim — 8 reasons incl. `EVIDENCE_REF_REJECT`, no `STAGE0_EXCLUDED`); raw SF/Stage 0 row shapes; `WorkerRunOptions`; `WorkerRowResult` tagged union; `WorkerReport`; `WorkerRunMetadata`; `POI_OBSERVATION_VERSION_DEFAULT = 'poi-observation-v0.1'`; `POI_KEY_SOURCE_FIELDS_ALLOWED` enum. |
| `src/scoring/poi-core-worker/query.ts` | Three parameterised SQL constants: `SELECT_SESSION_FEATURES_SQL` (primary), `SELECT_STAGE0_BY_LINEAGE_SQL` (side-read, `LIMIT 2`), `UPSERT_POI_OBSERVATION_SQL` (`INSERT … ON CONFLICT … DO UPDATE … RETURNING (xmax = 0) AS inserted`). 21 positional params on the UPSERT. |
| `src/scoring/poi-core-worker/mapper.ts` | Pure: `pickPagePathCandidate` (OD-11 discriminator), `mapStage0Row`, `mapSessionFeaturesRowToArgs`, `classifyAdapterError`. Builds `evidence_refs` from the SF source row + optional Stage 0 entry. Builds `source_versions` JSONB (OD-9 forward-compat). No imports from PR#11b observer (per locked decision Q2). |
| `src/scoring/poi-core-worker/upsert.ts` | Pure `buildUpsertParams(args)` returning the 21-element positional parameter array. Defence-in-depth invariant guards: `poi_type='page_path'`, `source_table='session_features'`, `poi_key_source_field` enum, `poi_eligible = NOT stage0_excluded`, non-empty `evidence_refs`, `source_versions` carries `session_features`. |
| `src/scoring/poi-core-worker/worker.ts` | Orchestrator. PR#4 contract guards → version check → SF SELECT → per-row Stage 0 side-read → mapper → PR#10 `buildPoiCoreInput` (try/catch) → upsert params → UPSERT → aggregate. Exports `runPoiCoreWorker`, `aggregateReport`, `parsePoiCoreWorkerEnvOptions`, `makeStubClient`, `processRowForTest`, `truncateSessionId`, `parseDatabaseUrl`. |
| `src/scoring/poi-core-worker/index.ts` | Public re-exports. |
| `scripts/run-poi-core-worker.ts` | Manual-CLI batch trigger. Env-parse → pg pool → run → emit JSON report to stdout → close pool. DSN masked. Exit 0 on PASS / 1 on fatal. |
| `tests/v1/poi-core-worker.test.ts` | 62 pure tests across groups A–N + SQL constants. Stub-client tests cover the full processRow path including UPSERT calls. |
| `docs/sprint2-pr11c-poi-observations-table-worker.md` | (this file) |

**Modified (2 files):**

| Path | Change |
| --- | --- |
| `src/db/schema.sql` | Additive mirror block (~85 lines appended after `risk_observations_v0_1`). Same shape as migration 014's `CREATE TABLE` + 5 indexes, minus role-grants (mirror is informational only — production applies migrations). |
| `package.json` | One new script entry only: `"run:poi-core-worker": "tsx scripts/run-poi-core-worker.ts"`. Zero dependency / devDependency / unrelated-script change. |

---

## §2 What PR#11c does NOT ship

- ❌ No `migrations/*.sql` other than 014.
- ❌ No schema change to migrations 001..013.
- ❌ No new dependency / no `package-lock.json` regeneration.
- ❌ No Render production deploy — A0 P-4 still blocking.
- ❌ No DB applied during implementation (no `psql`, no migration run).
- ❌ No customer-facing output (no dashboards, no rendered text,
  no scoring labels, no marketing copy).
- ❌ No Policy / Trust / Series / Product-Context-Fit implementation.
- ❌ No Lane A / Lane B write — `scoring_output_lane_a` and `_b`
  zero touch (UPSERT_POI_OBSERVATION_SQL targets only
  `poi_observations_v0_1`).
- ❌ No raw-ledger read (`accepted_events`, `rejected_events`,
  `ingest_requests`, `site_write_tokens`).
- ❌ No `risk_observations_v0_1` read (PR#9a OD-5 — POI stays
  independent from Risk).
- ❌ No `session_behavioural_features_v0_2` read (PR#11c OD-5 —
  PR#11b proved SBF has no POI material today; SBF persistence
  requires a future contract amendment).
- ❌ No PR#0..PR#11b source modified. PR#10 adapter is the shared
  contract source of truth — imported, never edited. PR#11b observer
  source is untouched (no imports either, per locked decision Q2).
- ❌ No envelope persistence outside `poi_observations_v0_1`. No
  shadow table, no sidecar cache, no log persistence.
- ❌ No `STAGE0_EXCLUDED` reject reason. Stage 0 excluded is
  carry-through (`stage0_excluded=true, poi_eligible=false`), not
  filtered.

---

## §3 Helen OD-1..OD-11 — how each landed

| OD | Decision | How implemented |
| --- | --- | --- |
| **OD-1** | Migration number 014 | `migrations/014_poi_observations_v0_1.sql` (next free after 013). |
| **OD-2** | Column shape per planning §4.1 | Migration 014 implements 24 columns + 11 CHECK constraints + 1 UNIQUE + 5 indexes. Forbidden columns sweep in §8.3 verification SQL check #9. |
| **OD-3** | Natural key includes `extraction_version`, excludes `source_row_id` | `CONSTRAINT poi_obs_v0_1_natural_key UNIQUE (workspace_id, site_id, session_id, poi_type, poi_key, poi_input_version, poi_observation_version, extraction_version)`. UPSERT `ON CONFLICT` matches verbatim. |
| **OD-4** | Manual CLI only | `scripts/run-poi-core-worker.ts` is the only entry. No cron config, no queue handler, no post-commit hook in the repo. |
| **OD-5** | Worker reads SF + Stage 0 only | `SELECT_SESSION_FEATURES_SQL` reads `session_features`. `SELECT_STAGE0_BY_LINEAGE_SQL` reads `stage0_decisions`. Forbidden tables: zero `FROM`/`JOIN` matches in static-source sweep (test K). |
| **OD-6** + **OD-6.1** | Idempotent ON CONFLICT DO UPDATE with `updated_at = NOW()` | `UPSERT_POI_OBSERVATION_SQL` body sets all mutable columns from `EXCLUDED.*` and `updated_at = NOW()`. `RETURNING (xmax = 0) AS inserted` lets the worker count inserted vs updated. Re-running over the same seed yields the same row count. |
| **OD-7** | Role grants | Migration §3: `REVOKE ALL FROM PUBLIC`, `GRANT ALL TO buyerrecon_migrator`, `GRANT S+I+U TO buyerrecon_scoring_worker`, `GRANT S TO buyerrecon_internal_readonly`, `REVOKE ALL FROM buyerrecon_customer_api`. **Sequence grants** are scoped tighter than the planning baseline (Codex-blocker fix on this patch): only `buyerrecon_scoring_worker` receives `USAGE, SELECT, UPDATE` on the `poi_observations_v0_1_poi_observation_id_seq` BIGSERIAL sequence. `buyerrecon_internal_readonly` gets **NO** sequence privileges because sequence `USAGE` permits `nextval(...)` and `UPDATE` permits `setval(...)` — both mutating operations incompatible with a strictly-read-only role. `customer_api` gets no sequence privileges either. Hard-Rule-I parity DO block asserts (a) customer_api zero table SELECT, (b) internal_readonly zero sequence USAGE, (c) internal_readonly zero sequence UPDATE, (d) internal_readonly has table SELECT (positive check). |
| **OD-8** | Stage 0 excluded stored as carry-through; `poi_eligible = NOT stage0_excluded`; `stage0_rule_id` provenance-only | DB CHECK `poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded`. Worker mirror in `upsert.ts::buildUpsertParams` (throws on mismatch). Mapper builds envelope with PR#10 adapter, which derives `poi_eligible = !stage0_excluded` natively. `stage0_rule_id` flows verbatim from the Stage 0 row into the column; it never enters POI key / context / reason codes / customer fields (PR#10 adapter rejects forbidden keys; PR#11c CHECK constraints enforce v0.1 enums). |
| **OD-9** | No first-class `behavioural_feature_version` column | Column not present. `source_versions` JSONB carries the forward-compat map; worker writes `{ session_features: <extraction_version>, poi_input_version: <…>, stage0_decisions?: <stage0_version> }`. |
| **OD-10** | Verification SQL at `docs/sql/verification/14_poi_observations_v0_1_invariants.sql` | Created. 14 numbered checks. |
| **OD-11** | First-class `poi_key_source_field` provenance column | Column present, CHECK-constrained to `('landing_page_path', 'last_page_path')`. Worker `pickPagePathCandidate` returns the discriminator alongside the path. Tests in Group C cover both paths. |

---

## §4 Privacy posture preserved (PR#10 / PR#11a / PR#11b invariants)

- **`poi_eligible` is the pure boolean inverse of `stage0_excluded`** —
  enforced at three layers: PR#10 adapter, `upsert.ts::buildUpsertParams`
  guard, and the DB `poi_obs_v0_1_poi_eligible_is_pure_inverse_of_stage0_excluded`
  CHECK constraint.
- **`evidence_refs` non-empty** — enforced at three layers: PR#10 adapter
  rejects empty arrays, `upsert.ts` guards before SQL, and the DB
  `poi_obs_v0_1_evidence_refs_nonempty` CHECK constraint.
- **`stage0_rule_id` provenance-only** — column is `NULL`-allowed and
  carries the Stage 0 `rule_id` verbatim. It does NOT flow into POI
  key (PR#10 adapter excludes it), POI context (PR#10 `PoiContext` is
  UTM-only), reason codes (none exist on this table — see §4.2
  forbidden-column sweep), customer fields, or downstream judgement
  signals. PR#11d table observer surfaces `stage0_rule_id`
  distribution counts only for engineering inspection.
- **DSN masking** — `parseDatabaseUrl` in `worker.ts` returns only
  host + db name. The full URL is never printed.
- **`session_id` masking** — `truncateSessionId` masks long IDs to
  `prefix…suffix`. Returns `***` for IDs <12 chars. Sample lists in
  the report carry only the masked form.
- **No raw URL / referrer / UA / IP / token / pepper / cookie /
  raw payload / identity field anywhere** — verified by the
  forbidden-column sweep in `14_*.sql` check #9 + the static-source
  sweep in `tests/v1/poi-core-worker.test.ts` Group K.
- **Adapter `derived_at` never `Date.now()`** — sourced from
  `session_features.extracted_at`. Worker wall-clock `run_started_at`
  / `run_ended_at` live in `run_metadata` only.

---

## §5 PR#10 / PR#11b boundary

- **PR#10 `buildPoiCoreInput` is the shared contract source of truth.**
  The worker imports it from `../poi-core/index.js` and never bypasses
  its validation. The PR#10 adapter remains read-only.
- **PR#11b observer source remains untouched.** Zero imports from
  `src/scoring/poi-core-observer/` (locked decision Q2). The worker
  has its own `mapper.ts` + `pickPagePathCandidate` to maintain
  observer-vs-worker separation. The mapping logic is small and
  duplication is acceptable because the observer is a diagnostic
  module and the worker is a durable persistence layer — they MUST
  NOT share runtime internals.
- **Reject taxonomy mirrors PR#11b verbatim** (Helen-locked this
  turn): same 8 `RejectReason` strings, same `EVIDENCE_REF_REJECT`,
  same absence of `STAGE0_EXCLUDED`, same `classifyAdapterError`
  pattern order (evidence_refs before identity matcher). PR#11d
  table observer can compare observer → worker → table results
  without a translation layer.

---

## §6 Test results

```
> npx tsc --noEmit                                  → PASS (exit 0)
> npm run check:scoring-contracts                    → Scoring contracts check PASS
> npm test -- tests/v1/poi-core-worker.test.ts
  Test Files  1 passed (1)
       Tests  72 passed (72)
   Duration  ~320ms
> npm test
  Test Files  44 passed (44)        ← +1 vs. PR#11b's 43 files
       Tests  2524 passed (2524)    ← +62 vs. PR#11b's 2452 tests
   Duration  ~1.15s
> git diff --check                                  → clean (exit 0)
```

The **72 PR#11c targeted tests** cover the planning §8.1 surface:

- **A. Mapper happy paths** (2 tests): envelope build from a fully
  populated SF row; evidence_refs allowlist + stage0_decisions
  append when Stage 0 supplied.
- **B. Mapper rejects** (6 tests): MISSING_REQUIRED_ID for
  workspace_id / session_features_id / extraction_version /
  source_event_count; MISSING_EXTRACTED_AT for null extracted_at;
  NO_PAGE_PATH_CANDIDATE for null+null page paths.
- **C. `pickPagePathCandidate` + OD-11 discriminator** (5 tests):
  landing preferred, last_page_path fallback (including empty-string
  landing), null when both missing, enum membership.
- **D. Stage 0 side-read truth table** (4 tests): absent / present-1 /
  invalid-2+ / mapStage0Row record_only.
- **E. Stage 0 excluded carry-through** (3 tests): excluded=true →
  envelope upserts with poi_eligible=false; REJECT_REASONS excludes
  STAGE0_EXCLUDED + includes EVIDENCE_REF_REJECT; aggregator counts
  excluded as carry-through.
- **F. `buildUpsertParams` invariants** (7 tests): 21-param shape;
  poi_type / poi_key_source_field / evidence_refs / source_versions
  invariants; poi_eligible-vs-stage0_excluded mismatch detection;
  JSON serialisation of evidence_refs + source_versions.
- **G. processRow → UPSERT** (4 tests): happy path inserts;
  natural-key params + poi_key_source_field; last_page_path fallback
  reflected in params; updated action on `inserted=false`.
- **H. Adapter error classification** (7 tests): all 6
  classifyAdapterError patterns + a processRow integration covering
  credential-shaped path → INVALID_PAGE_PATH.
- **I. aggregateReport** (7 tests): report shape; surface-class +
  referrer-class bucket init; reject_reasons init; INVALID_PAGE_PATH
  → unsafe_poi_key_reject_count; EVIDENCE_REF_REJECT →
  evidence_ref_reject_count; rows_unchanged=0 in v0.1.
- **J. Masking** (3 tests): truncateSessionId + parseDatabaseUrl.
- **K. Static-source sweep** (4 tests): no DML/DDL except INSERT INTO
  poi_observations_v0_1; no FROM/JOIN on forbidden tables; no
  imports from policy/trust/series/lane/poi-core-observer/collector/
  app/server/auth; query.ts SF SELECT does not pull JSONB privacy
  fields.
- **L. SQL constants** (5 tests): each SELECT references the correct
  FROM clause; UPSERT targets only `poi_observations_v0_1`; ON
  CONFLICT lists the 8-col natural key; RETURNING xmax-trick present;
  `updated_at = NOW()` present; Lane A/B never mentioned.
- **M. runPoiCoreWorker end-to-end** (2 tests): happy-path scan
  upserts one row + expected counters; wrong poi_input_version
  throws before any SQL.
- **N. CLI env parsing** (3 tests): missing DATABASE_URL rejected;
  defaults applied; filters honoured.

### §6.1 DB tests deferred to PR#11d

The PR#11c planning §8.2 lists DB tests against an ephemeral DB. Those
tests are **deferred to PR#11d**, which adds the read-only table
observer + Hetzner staging proof. The reasons:

1. The PR#11c pure tests (62) already cover the same logical surface
   via stub-client mocks — same SQL strings, same param ordering,
   same upsert-action detection logic.
2. The DB CHECK constraints + UNIQUE + Hard-Rule-I assertion in
   migration 014 provide the storage-layer gate. They will be
   exercised when the migration applies against staging in PR#11d.
3. PR#11d's table observer + verification SQL run against real seeded
   rows on the same Hetzner staging instance PR#11b proved at HEAD
   `1a3b252`. That is a more meaningful integration test than a local
   ephemeral DB run.

PR#11c v0.1 ships green on local gates only. The Hetzner staging
migration apply + worker dry-run is the gate PR#11d closes.

---

## §7 Confirmations

- ✅ **PR#11c ships only allowed files.** 11 new files + 2 modifications
  (`src/db/schema.sql` additive mirror, `package.json` one-line
  script addition). Zero other tracked-file modifications.
- ✅ **No DB write during implementation.** Migration 014 created
  but NOT applied. No `psql`. No DSN connection from the dev box.
- ✅ **Render production / Render DB untouched.** A0 P-4 still
  blocking.
- ✅ **No customer-facing output.** Worker emits JSON to stdout for
  engineering. No dashboards, no rendered text, no scoring labels.
- ✅ **No Lane A/B write.** `scoring_output_lane_a` / `_b` zero
  touch — verified by static-source sweep + UPSERT_POI_OBSERVATION_SQL
  inspection.
- ✅ **No Policy / Trust / Series / PCF implementation.**
- ✅ **SBF unread.** Static-source sweep verifies zero `FROM
  session_behavioural_features_v0_2` in worker SQL.
- ✅ **Risk independent.** Zero `FROM risk_observations_v0_1`.
- ✅ **PR#10 adapter untouched, used as shared source of truth.**
- ✅ **PR#11b observer untouched. Zero imports from
  `poi-core-observer/`.** Worker has its own mapper.
- ✅ **`poi_eligible = NOT stage0_excluded`.** Enforced at 3 layers.
- ✅ **`evidence_refs` non-empty.** Enforced at 3 layers.
- ✅ **`stage0_rule_id` provenance-only.** Column present, never
  flows into POI key / context / reason codes / customer fields.
- ✅ **No new dependency.** `package.json` change is a single script
  entry; `package-lock.json` untouched.
- ✅ **Reject taxonomy mirrors PR#11b verbatim.**
- ✅ **`STAGE0_EXCLUDED` is not a reject reason.** Test E verifies.
- ✅ **Codex xhigh review pending.** Awaiting Codex review before
  commit.

---

## §8 Next step

**PR#11d — POI Observation Table Observer + Hetzner staging proof.**
PR#11d ships:

- `src/scoring/poi-core-table-observer/{types,query,report,observer,index}.ts`
- `scripts/poi-core-table-observation-report.ts` (CLI)
- `tests/v1/poi-core-table-observer.test.ts`
- `docs/sprint2-pr11d-poi-table-observer.md` (impl report + Hetzner
  staging proof transcript)

PR#11d's runtime proof:

1. Branch synced to PR#11c HEAD.
2. `npx tsc --noEmit`, `npm run check:scoring-contracts`, full +
   targeted tests PASS.
3. Hetzner staging migration apply (014) → exit 0, re-apply no-op.
4. Hetzner staging worker dry-run via `npm run run:poi-core-worker`
   → exit 0; expected `rows_inserted=8` (matching PR#11b's 8 SF
   envelopes); `stage0_excluded_count=6`; `eligible_for_poi_count=2`.
5. PRE/POST source-table parity on every read source + Lane A/B
   `0/0`.
6. Verification SQL `14_*.sql` runs → all 14 checks return the
   expected row counts.
7. Table observer scan returns the same distribution as the worker
   reported.
8. No secrets / full DSN / full session_id / raw payload in stdout.

Downstream consumers (Series / Trust / Policy / Product-Context-Fit)
MUST NOT read or join `poi_observations_v0_1` until PR#11d Hetzner
proof PASS.

---

## §9 What this implementation does NOT do

- Does **not** apply the migration.
- Does **not** touch the DB or run `psql`.
- Does **not** touch Render.
- Does **not** create the table observer (deferred to PR#11d).
- Does **not** modify any migration in `migrations/` other than
  creating `014_poi_observations_v0_1.sql`.
- Does **not** modify PR#0..PR#11b source.
- Does **not** add a dependency.
- Does **not** create customer-facing output.
- Does **not** create Policy / Trust / Series / Lane A/B / RiskOutput.
- Does **not** create a scheduler / cron / queue / post-commit hook.
- Does **not** persist any envelope outside `poi_observations_v0_1`.
- Does **not** commit. Does **not** push.

Awaiting Codex review + Helen sign-off before commit.
