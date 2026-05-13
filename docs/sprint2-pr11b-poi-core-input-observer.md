# Sprint 2 PR#11b — POI Core Input Observer — implementation

**Status.** Implementation complete. Read-only observer module + CLI +
tests only. **No DB write, no migration, no schema change, no worker,
no shadow table, no customer-facing output. Not committed. Not pushed.**

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| Parent (PR#11a planning) | `3007162ee377ba2747a20c2fa0413cb9df15a5ca` |
| Prior closed commits | PR#0..PR#10 + PR#11a |
| PR#10 POI Core Input Contract HEAD | `f9d2a75` (read-only reference) |

**Authority.**

- `docs/sprint2-pr11a-poi-derived-observation-planning.md` (Helen-signed OD-1..OD-10)
- `docs/sprint2-pr10-poi-core-input.md` (PR#10 contract — read-only reference)
- `docs/sprint2-pr9a-poi-core-input-planning.md` (Helen-signed OD-1..OD-8)
- `docs/sprint2-pr8a-risk-core-bridge-observer-planning.md` (PR#8b observer pattern precedent)
- `docs/sprint2-pr8b-risk-core-bridge-observer.md` (PR#8b impl precedent + Hetzner proof shape)
- AMS shared-core priority: **Risk → POI → Series → Trust → Policy**

---

## §1 What PR#11b ships

Seven new files under `src/scoring/poi-core-observer/`, `scripts/`,
`tests/v1/`, plus a single `package.json` script entry and this impl
report. No tracked file is modified beyond the one new `package.json`
script.

**Created (8 new files):**

| Path | Purpose |
| --- | --- |
| `src/scoring/poi-core-observer/types.ts` | RejectReason union + REJECT_REASONS frozen array, raw pg row shapes (SF / SBF / Stage 0), ObserverRunOptions, ObserverRowResult tagged union, ObserverReport, ObserverRunMetadata |
| `src/scoring/poi-core-observer/sql.ts` | Three parameterised SELECTs: `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions` (by lineage, LIMIT 2). All positional params. Zero DML / DDL / GRANT / REVOKE in active SQL |
| `src/scoring/poi-core-observer/mapper.ts` | Pure: `mapSessionFeaturesRow`, `mapSessionBehaviouralFeaturesRow`, `mapStage0Row`, `classifyAdapterError`. Builds evidence_refs from the source row identity; PR#11b does NOT read source-row evidence_refs JSONB |
| `src/scoring/poi-core-observer/report.ts` | Pure: `truncateSessionId` (prefix+`…`+suffix, `***` if <12 chars), `parseDatabaseUrl` (host+name only), `aggregateReport`, `serialiseReport` |
| `src/scoring/poi-core-observer/runner.ts` | Orchestrator: accepts `pg.Pool | pg.Client`, issues SF + SBF SELECTs + per-row processor + Stage 0 side-read + PR#10 adapter try/catch + report aggregator. Exports `makeStubClient` + `processRowForTest` for in-memory tests |
| `src/scoring/poi-core-observer/index.ts` | Public re-exports |
| `scripts/poi-core-input-observation-report.ts` | CLI: env-var parsing + pg pool setup + `runPoiCoreInputObserver` call + masked stdout JSON. Exit 0 / 1 (require_rows) / 2 (fatal) |
| `tests/v1/poi-core-observer.test.ts` | 72 pure tests across groups A–K + SQL constants |
| `docs/sprint2-pr11b-poi-core-input-observer.md` | (this file) |

**Modified.** One file: `package.json`. A single new script entry:

```json
"observe:poi-core-input": "tsx scripts/poi-core-input-observation-report.ts"
```

No dependencies added. No test scripts changed. No `prepare` / `build`
scripts touched.

---

## §2 What PR#11b does NOT ship

- ❌ No DB migration (`migrations/` untouched).
- ❌ No `schema.sql` change.
- ❌ No worker / no scheduler / no cron / no queue / no post-commit hook.
- ❌ No table (`poi_observations_v0_1` is reserved for PR#11c, not this PR).
- ❌ No shadow / temporary observation table.
- ❌ No DB write — `INSERT INTO`, `UPDATE`, `DELETE`, `TRUNCATE`,
  `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`, `GRANT`,
  `REVOKE` zero occurrences in PR#11b active source (test sweep verifies).
- ❌ No customer-facing output (no dashboards, no rendered text, no scoring labels, no marketing copy).
- ❌ No Policy / Trust / Series / Product-Context-Fit implementation.
- ❌ No Lane A / Lane B write — `scoring_output_lane_a` and `_b` zero touch.
- ❌ No Render production deploy — A0 P-4 still blocking.
- ❌ No PR#10 / PR#9a / PR#8b / PR#7 / PR#6 / PR#5 source modified.
- ❌ No raw-ledger read (`accepted_events`, `rejected_events`,
  `ingest_requests`, `site_write_tokens`, `risk_observations_v0_1`).
- ❌ No envelope persistence — envelopes are deep-frozen, counted in
  the aggregator, then discarded.

---

## §3 Decision applied — hard-coded `poi_type = 'page_path'`

PR#11b v0.1 hard-codes the POI type to `page_path` (Helen sign-off
this turn). The observer asks one question:

> "Can the current derived rows produce safe `page_path` `PoiCoreInput`
> envelopes?"

Implementation rule applied verbatim:

- **`session_features`** — prefer `landing_page_path`, fall back to
  `last_page_path`; the chosen value is passed as `raw_page_path` to
  the PR#10 adapter (`mapper.ts::pickPagePathCandidate`).
- **`session_behavioural_features_v0_2`** — the SBF schema carries no
  path / cta / form / offer / referrer columns. The mapper does NOT
  reconstruct paths from `accepted_events` (raw ledger forbidden), does
  NOT invent POI keys, and does NOT silently fall back. Every SBF row
  rejects with `NO_PAGE_PATH_CANDIDATE` — a deliberate diagnostic
  finding that surfaces SBF's POI-material gap (PR#11a §6
  observer-first rationale).
- **`OBS_POI_TYPE`** env var is NOT introduced. `route_rules` JSON
  parsing is NOT introduced. Multi-POI-type support is deferred to a
  future PR after PR#11b proof.
- **Report** carries `rows_scanned_by_source_table`, `envelopes_built`,
  `rejects` (by reason), `source_table_distribution`, plus
  `poi_type_distribution` (which shows only `page_path` in v0.1 and
  zero for the other five POI types), plus the Codex-blocker-mandated
  diagnostics: `poi_surface_class_distribution`,
  `referrer_class_distribution`, `unsafe_poi_key_reject_count`,
  `evidence_ref_reject_count` (see §7 + §8).

---

## §4 Boundary applied — PR#11a OD-1..OD-10

| OD | Behaviour in PR#11b |
| --- | --- |
| **OD-1** observer-first | Yes — no durable table, no shadow table, no envelope persistence. Mirrors PR#8b read-only-observer cadence. |
| **OD-2** read allowlist | Only three tables appear in PR#11b SQL: `session_features` + `session_behavioural_features_v0_2` (primary) + `stage0_decisions` (side-read). Static-source test sweep verifies. |
| **OD-3** forbidden reads | Zero `FROM` / `JOIN` against `accepted_events`, `rejected_events`, `ingest_requests`, `risk_observations_v0_1`, `scoring_output_lane_a`, `scoring_output_lane_b`, `site_write_tokens`. Static-source test sweep verifies (against `sql.ts` + `runner.ts` + CLI with comments stripped). |
| **OD-4** output sink | Stdout JSON report only. No DB write. No shadow table. No `*_obs` artefact. Mirrors PR#8b. |
| **OD-5** (PR#11c column shape) | Not applicable to PR#11b — PR#11c builds the table. |
| **OD-6** (PR#11c trigger) | Not applicable to PR#11b. |
| **OD-7** (PR#11d Hetzner proof shape) | PR#11b runtime proof is local + targeted. Optional staging dry-run available via `observe:poi-core-input` CLI; full Hetzner proof reserved for PR#11d. |
| **OD-8** privacy gate | Both synthetic fixtures (72 pure tests) and optional Hetzner staging dry-run via CLI. The Group I/J static + serialised-report sweeps catch deterministic edge cases. |
| **OD-9** Stage 0 carry-through | Stage 0 excluded source rows build a successful envelope with `stage0_excluded=true`, `poi_eligible=false`. Counter is `stage0_excluded_count`, NOT a reject reason. `REJECT_REASONS` does NOT contain `STAGE0_EXCLUDED`. Tests in Group E verify. |
| **OD-10** sample POI keys | Report does NOT emit sample POI keys in PR#11b. Only counts/distributions surface. (Sample POI keys may be added in a future revision if Helen approves a privacy-safe truncation scheme.) |

---

## §5 Stage 0 side-read truth table

PR#11b sources (SF / SBF) do NOT carry `stage0_decision_id` pointers
(their schemas have no `evidence_refs` column). So unlike PR#8b
which has both Path A (exact pointer) and Path B (lineage fallback),
PR#11b uses only Path B — `(workspace_id, site_id, session_id)`
lineage lookup with `LIMIT 2`.

| Stage 0 row count | Observer behaviour |
| --- | --- |
| 0 | `outcome: 'absent'` — envelope still builds; `stage0_excluded=false, poi_eligible=true, stage0_rule_id=null`. |
| 1 | `outcome: 'use'` — envelope built with `PoiStage0Context` forwarded. If `excluded=true`, the envelope's `eligibility.poi_eligible=false` (carry-through, not reject). |
| 2+ | `outcome: 'invalid'` → row-level `INVALID_STAGE0_CONTEXT` reject — observer MUST NOT guess which Stage 0 row to consume. |

Stage 0 SQL/connection errors propagate to the CLI (exit 2). Only
data-shape errors become row-level rejects. Same Codex blocker
discipline as PR#8b `runner.ts:80-96`.

---

## §6 Reject taxonomy

PR#11b's `RejectReason` union:

| Reason | Trigger |
| --- | --- |
| `MISSING_REQUIRED_ID` | source row identity / version / source_event_count missing or invalid |
| `MISSING_EXTRACTED_AT` | source row's `extracted_at` is null or unparseable — observer MUST NOT invent `derived_at` |
| `NO_PAGE_PATH_CANDIDATE` | SF row has neither `landing_page_path` nor `last_page_path`; OR SBF row (which has no path columns at all) |
| `INVALID_PAGE_PATH` | PR#10 `normalisePagePath` rejected the candidate (e.g. email-shaped PII, token-shaped credential markers, query-string fragment) |
| `EVIDENCE_REF_REJECT` | PR#10 adapter rejected `evidence_refs` shape, allowlist, or forbidden-key sweep (added in the Codex blocker patch — `classifyAdapterError` now classifies any PR#10 message prefixed `evidence_refs` into this dedicated reason rather than the generic `ADAPTER_VALIDATION_ERROR`) |
| `INVALID_STAGE0_CONTEXT` | Stage 0 side-read returned 2+ rows, or the row failed `mapStage0Row` |
| `ADAPTER_VALIDATION_ERROR` | PR#10 adapter threw with a message not matching any classifier pattern |
| `UNEXPECTED_ERROR` | reserved for runner-level surprises |

**Stage 0 exclusion is NOT a reject reason** (PR#11a §5.1 patch).
`REJECT_REASONS` test verifies the union does not contain
`STAGE0_EXCLUDED` and does contain `EVIDENCE_REF_REJECT`.

---

## §7 Report shape

```ts
ObserverReport = {
  rows_scanned: number,                                 // total SF + SBF rows scanned
  rows_scanned_by_source_table: {                       // SF vs SBF readiness comparison
    session_features: number,
    session_behavioural_features_v0_2: number,
  },
  envelopes_built: number,
  rejects: number,
  reject_reasons: Record<RejectReason, number>,         // 8 keys (incl. EVIDENCE_REF_REJECT), defaults 0
  poi_type_distribution: Record<PoiType, number>,       // 6 keys; only page_path > 0 in v0.1
  poi_surface_class_distribution:
    Record<PoiSurfaceClass, number>,                    // 14 keys (PR#10 POI_SURFACE_CLASSES_ALLOWED), defaults 0
  referrer_class_distribution:
    Record<ReferrerClass, number>,                      // 5 keys (PR#10 REFERRER_CLASSES_ALLOWED), defaults 0
  source_table_distribution: Record<PoiSourceTable, number>,  // envelopes built per source table
  stage0_excluded_count: number,                        // carry-through, NOT reject
  eligible_for_poi_count: number,                       // carry-through
  unsafe_poi_key_reject_count: number,                  // = reject_reasons.INVALID_PAGE_PATH
  evidence_ref_reject_count: number,                    // = reject_reasons.EVIDENCE_REF_REJECT
  unique_session_ids_seen: number,
  sessions_seen_on_both_tables: number,                 // intersection of SF + SBF session_id sets
  sample_session_id_prefixes: string[],                 // masked
  run_metadata: {
    poi_input_version, scoring_version,
    extraction_version, feature_version,
    window_start, window_end,
    database_host, database_name,                       // never the password
    run_started_at, run_ended_at,                       // observer wall-clock; NEVER flows to PoiCoreInput.derived_at
    primary_source_tables: ['session_features', 'session_behavioural_features_v0_2'],
    stage0_side_read_table: 'stage0_decisions',
    poi_type: 'page_path',                              // hard-coded for v0.1
    record_only: true,
  },
}
```

### §7.1 The four Codex-blocker-mandated fields

The full diagnostics contract requires these four fields in addition
to the v0.1 minimum. Each is initialised at run-start and updated
inside the `envelope_built` / `rejected` branches of `aggregateReport`:

- **`poi_surface_class_distribution`** — `Record<PoiSurfaceClass, number>`
  with all 14 `POI_SURFACE_CLASSES_ALLOWED` buckets initialised to 0.
  Increments only when a built envelope's `env.poi.poi_surface_class`
  is non-null. PR#11b's mapper sets `poi_surface_class = null` on
  every page_path envelope (the observer does not classify surface
  class), so this distribution is expected to remain all-zero in
  v0.1. A future PR that tags surface class on the envelope will
  populate it without a schema change.

- **`referrer_class_distribution`** — `Record<ReferrerClass, number>`
  with all 5 `REFERRER_CLASSES_ALLOWED` buckets initialised to 0
  (`referrer.search` / `referrer.social` / `referrer.email` /
  `referrer.direct` / `referrer.unknown`). Increments only when a
  built envelope has `poi_type === 'referrer_class'` (in which case
  `env.poi.poi_key` holds the referrer-class enum value). PR#11b is
  hard-coded to `page_path`, so this distribution is expected to
  remain all-zero in v0.1. The initialised buckets keep the report
  shape stable for future multi-POI-type runs.

- **`unsafe_poi_key_reject_count`** — derived counter mirroring
  `reject_reasons.INVALID_PAGE_PATH`. Surfaces the privacy-sensitive
  reject class explicitly so an operator can spot
  `normalisePagePath()` filter hits (credential markers, email-shaped
  PII, percent-encoded `%40`, etc.) without scanning the full
  `reject_reasons` map. A non-zero value here means PR#10's privacy
  filter caught real data — exactly the observer-first signal PR#11a
  §6 wants.

- **`evidence_ref_reject_count`** — derived counter mirroring
  `reject_reasons.EVIDENCE_REF_REJECT`. Counts PR#10 adapter
  rejections of `evidence_refs` (allowlist failure, forbidden-key
  sweep, missing `table` field, empty array). The new dedicated
  `EVIDENCE_REF_REJECT` reject reason is set by `classifyAdapterError`
  whenever the PR#10 adapter throws with a message prefixed
  `evidence_refs` — placed BEFORE the generic identity matcher in the
  classifier so forbidden-key errors mentioning fields like
  `account_id` are not misclassified as `MISSING_REQUIRED_ID`. In
  PR#11b, the mapper builds `evidence_refs` from controlled inputs,
  so a non-zero value here would indicate a logic bug or a contract
  drift between the observer and PR#10 — not a user-data issue. The
  count is therefore both a diagnostic AND a contract-drift
  canary.

**Privacy invariant.** None of the four new fields contains raw
adapter error strings, free-form text, or user-supplied values. They
are pure integer counters keyed on PR#10's frozen enum literals. The
per-row reject `detail` strings (which CAN contain `JSON.stringify`'d
source values) live only on the internal `ObserverRowResult` and are
discarded by the aggregator — they are NEVER serialised into the
report. The Group J `serialised report contains no forbidden privacy
markers as JSON keys` test verifies this with a JSON-key-position
regex sweep (so legitimate enum values like `"referrer.email"` do
not trip the sweep, but forbidden field names like `"email":`
would).

---

## §8 Test results

```
> npx tsc --noEmit                                  → PASS (exit 0)
> npm run check:scoring-contracts                    → Scoring contracts check PASS
> npm test -- tests/v1/poi-core-observer.test.ts
  Test Files  1 passed (1)
       Tests  72 passed (72)            ← +14 from the Codex blocker patch (Group L + reworked Group J)
   Duration  ~250ms
> npm test
  Test Files  43 passed (43)        ← +1 vs. PR#10's 42 files
       Tests  2452 passed (2452)    ← +72 vs. PR#10's 2380 tests
   Duration  ~1.10s
> git diff --check                                  → clean (exit 0)
```

The **58 PR#11b targeted tests** cover the PR#11a §9.1 test surface:

- **A. mapSessionFeaturesRow happy paths + identity rejects** (9 tests):
  envelope shape; evidence_refs allowlisted tables; Stage 0 evidence_ref
  appended; MISSING_REQUIRED_ID for missing identity / version /
  source_event_count; MISSING_EXTRACTED_AT for null/unparseable.
- **B. mapSessionBehaviouralFeaturesRow deliberate reject** (4 tests):
  NO_PAGE_PATH_CANDIDATE detail mentions the SBF schema gap; identity
  + version + extracted_at checks still run before the deliberate
  reject (preserves a consistent diagnostic taxonomy).
- **C. Page-path candidate selection** (5 tests): landing preferred;
  fallback to last_page_path on null / empty; NO_PAGE_PATH_CANDIDATE
  when both are missing/empty.
- **D. Stage 0 side-read truth table** (6 tests): absent → envelope
  built no-Stage-0; 1 row → forwarded; 2+ rows → INVALID_STAGE0_CONTEXT;
  mapStage0Row shape validation.
- **E. Stage 0 excluded is carry-through, NOT a reject** (3 tests):
  excluded=true envelope built with poi_eligible=false; aggregator
  increments stage0_excluded_count not a reject_reason; REJECT_REASONS
  has no STAGE0_EXCLUDED entry.
- **F. Adapter-thrown errors → RejectReason classification** (6 tests):
  page_path normalisation → INVALID_PAGE_PATH; stage0 → INVALID_STAGE0_CONTEXT;
  identity → MISSING_REQUIRED_ID; unknown → ADAPTER_VALIDATION_ERROR;
  credential-shaped path → INVALID_PAGE_PATH; email-shaped path →
  INVALID_PAGE_PATH.
- **G. Report aggregation** (5 tests): rows_scanned_by_source_table
  totals; SF vs SBF source_table_distribution; poi_type_distribution
  only page_path in v0.1; sessions_seen_on_both_tables intersection
  counter; reject_reasons defaults all zero.
- **H. Masking helpers** (5 tests): truncateSessionId prefix+suffix;
  *** for short IDs; parseDatabaseUrl host+name only; sentinels for
  garbage / undefined.
- **I. Static-source boundary sweep** (5 tests): no DML/DDL/GRANT/REVOKE
  (with TS comments stripped); no forbidden FROM/JOIN against
  raw-ledger / risk / Lane tables; no imports from policy / trust /
  series / lane; no imports from collector / app / server / auth; SQL
  module does not reference evidence_refs / raw_payload /
  canonical_jsonb / user_agent / ip_hash / token_hash.
- **J. Privacy invariants** (5 tests): built envelope evidence_refs
  only allowlisted tables; serialised report never contains the full
  session_id; serialised report contains no forbidden privacy markers
  (raw_payload, canonical_jsonb, user_agent, ip_hash, token_hash,
  authorization, bearer, cookie, pepper, person_id, visitor_id,
  company_id, email); envelope shape has no Lane A/B / Risk / Trust /
  Policy fields; record_only is the literal true.
- **K. runPoiCoreInputObserver end-to-end via stub client** (2 tests):
  happy-path SF + SBF scan produces expected counters; wrong
  `poi_input_version` throws before any SQL fires.
- **L. Codex blocker — full diagnostics contract** (13 tests): report
  includes the four new fields; all 14 `POI_SURFACE_CLASSES_ALLOWED`
  buckets initialised to 0; all 5 `REFERRER_CLASSES_ALLOWED` buckets
  initialised to 0; `unsafe_poi_key_reject_count` /
  `evidence_ref_reject_count` default to 0; built envelope with
  `poi_surface_class='page.pricing'` increments the correct bucket;
  null `poi_surface_class` increments nothing; PR#11b page_path-only
  run keeps `referrer_class_distribution` all zero; hypothetical
  `referrer_class` envelope increments the matching bucket
  (forward-compatibility for future multi-POI-type runs);
  `INVALID_PAGE_PATH` reject increments
  `unsafe_poi_key_reject_count`; synthesized `EVIDENCE_REF_REJECT`
  reject increments `evidence_ref_reject_count`;
  `classifyAdapterError` maps `evidence_refs` adapter messages to
  `EVIDENCE_REF_REJECT`; `REJECT_REASONS` still excludes
  `STAGE0_EXCLUDED` and includes `EVIDENCE_REF_REJECT`; Stage 0
  excluded still carries through (NOT a reject) after the Codex
  blocker patch.
- **SQL constants** (3 tests): each SELECT references the correct
  FROM clause and only that one; Stage 0 SELECT uses `LIMIT 2`.

---

## §9 Confirmations

- ✅ **PR#11b ships only allowed files.** 9 new files + 1 line added
  to `package.json`. Zero other tracked-file modifications. No
  `migrations/*`, no `schema.sql`, no `scoring/*.yml`, no collector /
  app / server / auth touched.
- ✅ **No DB write / no `psql`.** No `INSERT/UPDATE/DELETE/TRUNCATE/
  CREATE TABLE/ALTER/DROP/GRANT/REVOKE` in PR#11b active source
  (static sweep verifies).
- ✅ **Render production / Render DB untouched.** A0 P-4 still
  blocking. PR#11b is read-only observer.
- ✅ **No customer-facing output.** No dashboards, no rendered text,
  no report renderer, no Lane A/B writer, no Policy / Trust / Series
  implementation.
- ✅ **No envelope persistence.** Aggregator counts envelopes then
  discards them (PR#9a OD-8 / PR#11a §5.1).
- ✅ **No shadow table.** PR#11b is report-only.
- ✅ **POI source_table boundary preserved.** Only `session_features`
  and `session_behavioural_features_v0_2` appear as
  `PoiCoreInput.source_identity.source_table`. `stage0_decisions` is
  side-read + evidence_ref only (Codex blocker patch from PR#11a).
- ✅ **Stage 0 carry-through preserved.** Excluded rows build envelopes
  with `poi_eligible=false`; `stage0_excluded_count` is a separate
  counter, NOT a reject reason.
- ✅ **Identity boundary preserved.** No person / visitor / company /
  email / IP-org / hashed-identity fields land in the report or
  envelope.
- ✅ **Risk independence (PR#9a OD-5 / PR#11a OD-3).**
  `risk_observations_v0_1` is in the forbidden FROM/JOIN list. Zero
  reads.
- ✅ **Determinism.** No `Date.now()` inside `mapper.ts`. The runner's
  `new Date().toISOString()` is used only for `run_metadata.run_*_at`,
  never for `PoiCoreInput.derived_at` (which is sourced from the row's
  `extracted_at`).
- ✅ **Privacy masking.** `truncateSessionId` masks the session_id;
  `parseDatabaseUrl` masks DSN to host + db name only.
- ✅ **Codex xhigh review pending.** Awaiting Codex review before
  commit.

---

## §10 Next step

**PR#11c — `poi_observations_v0_1` table + manual-CLI worker.** Per
PR#11a §5.2: additive migration + idempotent upsert + manual CLI
trigger only (no cron / queue / post-commit hook). Column shape per
PR#11a §5.2 / OD-5 (mirrors `PoiCoreInput` concepts; no score / verdict
/ policy / trust / lane fields). After PR#11c passes Codex review,
PR#11d adds the table observer + Hetzner staging proof mirroring PR#8b.

PR#11b shipping unblocks PR#11c's table-column-shape design: the
observer's evidence_refs + Stage 0 carry-through path is now validated
in 72 pure tests against the PR#10 contract, so PR#11c's upsert
builder can rest on the same envelope shape.

---

## §11 What this implementation does NOT do

- Does **not** create a migration.
- Does **not** modify `schema.sql`.
- Does **not** add a dependency.
- Does **not** touch the DB or run `psql`.
- Does **not** touch `src/collector/v1/**`, `src/app.ts`,
  `src/server.ts`, `src/auth/**`.
- Does **not** modify PR#0..PR#11a implementation files.
- Does **not** amend `scoring/version.yml`,
  `reason_code_dictionary.yml`, or `forbidden_codes.yml`.
- Does **not** create customer-facing output.
- Does **not** create Policy / Trust / Series / Lane A/B / RiskOutput.
- Does **not** create a worker, table, or shadow table.
- Does **not** persist any envelope.
- Does **not** commit. Does **not** push.

Awaiting Codex review + Helen sign-off before commit.
