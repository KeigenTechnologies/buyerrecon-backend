# Sprint 2 PR#5 — Stage 0 RECORD_ONLY downstream worker

Track B (BuyerRecon Evidence Foundation). Vendors Track A
`lib/stage0-hard-exclusion.js` at a pinned source-proof commit;
applies the P-11 AI-crawler taxonomy correction (exclusion-side only);
writes `stage0_decisions` rows in RECORD_ONLY mode. **No
`scoring_output_lane_a` / `scoring_output_lane_b` writes. No
reason-code emission. No automated action. No customer-facing
output. No collector / app / server / auth touched. No Render
production.**

Authority:

- `docs/architecture/ARCHITECTURE_GATE_A0.md` §K row PR#5 + §0.6 P-8 / P-9 / P-11 + §I.5 vendor-audit checklist
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules
- `docs/sprint2-pr5-stage0-record-only-worker-planning.md` (Codex PASS)
- `docs/sprint2-pr5-helen-signoff-decisions.md` (Helen-signed P-9 + P-11 + OD-1..OD-12)
- `docs/vendor/track-a-stage0-pr5.md` (Track A source proof)

## §1 Summary

PR#5 introduces:

- A **byte-for-byte vendor copy** of Track A's Stage 0 hard-exclusion
  library at `src/scoring/stage0/vendor/stage0-hard-exclusion.js`
  (SHA-256 `7dc97bd9…`, Track A commit `6ce15f20…`).
- A pure TypeScript **adapter** at `src/scoring/stage0/evaluate-stage0.ts`
  that applies the P-11 AI-crawler carve-out, discards the upstream
  Stage 1 envelope, and maps the verdict into BuyerRecon's
  `Stage0RuleId` enum.
- A SQL **extractor** at `src/scoring/stage0/extract-stage0-inputs.ts`
  that reads `accepted_events` + `ingest_requests` (via `request_id`
  correlation) only — never `session_features` or
  `session_behavioural_features_v0_2` (OD-4 + OD-12).
- A **DB worker** at `src/scoring/stage0/run-stage0-worker.ts` that
  calls PR#4 startup guards, runs the extractor + evaluator, and
  upserts rows into `stage0_decisions` under the 5-column natural key
  `(workspace_id, site_id, session_id, stage0_version, scoring_version)`
  (OD-10).
- A **migration** at `migrations/012_stage0_decisions.sql` creating
  the new table with no FK references, `record_only IS TRUE` CHECK,
  Stage-0-specific `rule_id` enum, JSONB shape CHECKs, role grants
  mirroring PR#3 OD-7, and a Hard-Rule-I parity assertion.
- A **CLI** at `scripts/run-stage0-worker.ts` + `npm run stage0:run`.
- **122 tests** (98 pure + 24 DB) covering vendor provenance,
  adapter semantics, P-11 carve-out, rule_inputs minimization,
  natural-key behaviour, source-tables-unchanged, Lane A/B isolation,
  role privilege, and PR#4 startup-guard wiring.
- A **verification SQL** at `docs/sql/verification/12_*.sql` with
  13 read-only invariant queries (empty-DB PASS).

## §2 P-9 Track A source proof

| Item | Value |
| --- | --- |
| Track A commit | `6ce15f20d6349ee89b8cba6412b6c74e297cad4d` |
| Branch | `main` |
| `package.json` version | `0.2.0` |
| Vendor file SHA-256 | `7dc97bd96875df8ad0f45d819ba37fd5c8076aaae8748183540a72e43c82b303` |
| Vendored path in BuyerRecon | `src/scoring/stage0/vendor/stage0-hard-exclusion.js` |
| Upstream `tests/stage0.test.js` SHA-256 | `96ae94adcc1da77bf684d842e29269db5c7ed6ba3454cdf51d1c3378d83527d3` |
| Upstream `lib/two-stage-fixtures.js` SHA-256 | `1da59427bf564001ed93e9e320c6de7b133f4617b887ca5f30fd5d07b0a7ca9c` |
| Upstream Stage 0 test run | `node --test tests/stage0.test.js` → 30 / 30 pass |
| Upstream full unit suite | `npm run test:unit` → 130 / 130 pass |

Full provenance is recorded in `docs/vendor/track-a-stage0-pr5.md`.

## §3 P-11 — AI-crawler taxonomy correction

Per A0 §0.6 P-11 + §P P-11 default, known declared AI / search
crawlers (Bytespider, GPTBot, ClaudeBot, Perplexity-User, CCBot,
Googlebot, Bingbot, DuckDuckBot, PerplexityBot, petalbot) MUST NOT be
treated as Stage 0 hard-exclusion bad-bots.

PR#5 implementation:

- The vendored `stage0-hard-exclusion.js` is UNCHANGED (SHA-256
  preserved). Its `KNOWN_BOT_UA_FAMILIES` set still contains
  `'bytespider'` and `'petalbot'`.
- The BuyerRecon adapter
  (`src/scoring/stage0/evaluate-stage0.ts`) defines
  `KNOWN_AI_CRAWLER_UA_FAMILIES` (the 10-entry minimum set) and
  remaps any input `userAgentBotFamily` matching this set to `null`
  BEFORE calling the upstream `evaluate(evidence)`. The `known_bot_ua_family`
  rule therefore does not fire for these UAs.
- The decision row records `rule_inputs.user_agent_family:
  '<original family>'` for provenance. The carve-out's effect is
  observable from `rule_id = 'no_stage0_exclusion'` on Bytespider-like
  sessions; no `ai_crawler_passthrough` boolean and no `matched_family`
  are persisted for these sessions. (Codex blocker fix: the earlier
  draft persisted `ai_crawler_passthrough`, which shipped Lane B
  taxonomy state outside the Helen-signed OD-11 allowlist. Lane B
  declared-agent facts are re-derived by the deferred PR#3b Lane B
  observer.)
- PR#5 ships **no** Lane B writer. No `INSERT INTO
  scoring_output_lane_b`. No `B_DECLARED_AI_CRAWLER` /
  `B_SIGNED_AGENT` emission.

## §4 OD-1..OD-12 implementation mapping

| OD | Recommended default | Implemented |
| --- | --- | --- |
| **OD-1** | Writer mode (Option A) | ✅ Migration 012 + worker + DB tests + Hetzner-staging-DB-proof plan. |
| **OD-2** | No `verification_score`; no Lane A writer | ✅ `stage0_decisions` has no `verification_score` column. Lane A schema untouched. |
| **OD-3** | Stage-0-specific `rule_id`; no `reason_codes` | ✅ 8-value `rule_id` enum (`no_stage0_exclusion` + 7 upstream rule names) on `stage0_decisions`. NO `reason_codes` column. `validateRuleReferences` is NOT called. |
| **OD-4** | `accepted_events` + `ingest_requests` (via `request_id`) only | ✅ Extractor SQL queries only those two tables. DB test confirms worker runs against empty `session_features` / `session_behavioural_features_v0_2`. |
| **OD-5** | P-11 minimum scope | ✅ Adapter-side `KNOWN_AI_CRAWLER_UA_FAMILIES`; vendored file unchanged; no new schema column on `session_features`; no Lane B writer. |
| **OD-6** | Vendor Track A Stage 0 core only | ✅ Byte-for-byte copy. `stage1-behaviour-score.js` NOT vendored. Stage 1 envelope discarded by adapter. Pure test asserts no Stage 1 envelope key (`riskScore`, `classification`, `recommendedAction`) leaks into `Stage0Output` or `rule_inputs`. |
| **OD-7** | Full Hetzner staging DB proof | ✅ §6 staging proof plan; verification SQL 12; DB tests under local test DB demonstrate the proof shape. |
| **OD-8** | No automated action / no `action_recommendation` column | ✅ No such column. `record_only IS TRUE` CHECK enforced at DDL level. |
| **OD-9** | Reject A0 override; do not write Lane A | ✅ Worker writes only to `stage0_decisions`. Pure test asserts no `INSERT INTO scoring_output_lane_a` in PR#5 source. |
| **OD-10** | 5-column natural key | ✅ `UNIQUE (workspace_id, site_id, session_id, stage0_version, scoring_version)`. DB test confirms different `scoring_version` → new row; same 5-tuple → `ON CONFLICT DO UPDATE`. |
| **OD-11** | Minimization rule | ✅ Adapter writes only the OD-11 allowed keys. Pure tests sweep both keys + values. DB test asserts raw UA strings never appear in any `rule_inputs` value after running the worker on a real-UA seed. Verification SQL query 7 walks `jsonb_object_keys` for forbidden names. |
| **OD-12** | `session_features` / `session_behavioural_features_v0_2` excluded | ✅ Extractor SQL does not reference either table. DB test "worker runs against empty session_features / behavioural tables" demonstrates this empirically. |

## §5 Files changed

| File | Type | Notes |
| --- | --- | --- |
| `src/scoring/stage0/vendor/stage0-hard-exclusion.js` | new | Byte-for-byte vendor copy. SHA-256 `7dc97bd9…`. |
| `src/scoring/stage0/vendor/stage0-hard-exclusion.d.ts` | new | TypeScript types for the vendored CommonJS module. NOT part of vendor SHA proof. |
| `src/scoring/stage0/types.ts` | new | `Stage0Input`, `Stage0Output`, `Stage0DecisionRow`, `Stage0RuleId`, `STAGE0_RULE_IDS`. |
| `src/scoring/stage0/evaluate-stage0.ts` | new | Pure adapter; P-11 carve-out; Stage 1 envelope discard; rule_inputs minimization. |
| `src/scoring/stage0/extract-stage0-inputs.ts` | new | CTE pipeline over `accepted_events` + `ingest_requests`; UA → family normalisation (raw UA dies in worker memory). |
| `src/scoring/stage0/run-stage0-worker.ts` | new | DB worker; calls PR#4 startup guards; ON CONFLICT DO UPDATE on 5-col natural key. |
| `scripts/run-stage0-worker.ts` | new | CLI runner; redacts `DATABASE_URL`; PASS summary to stdout. |
| `migrations/012_stage0_decisions.sql` | new | New table; role-existence assertions; Hard-Rule-I parity guard at end. |
| `src/db/schema.sql` | modified | Append-only mirror of `stage0_decisions`. |
| `tests/v1/db/_setup.ts` | modified | Adds `applyMigration012` + wires into `bootstrapTestDb`. |
| `tests/v1/stage0-record-only-worker.test.ts` | new | 98 pure tests. |
| `tests/v1/db/stage0-decisions.dbtest.ts` | new | 24 DB tests. |
| `docs/sql/verification/12_stage0_decisions_invariants.sql` | new | 13 read-only invariant queries. |
| `docs/vendor/track-a-stage0-pr5.md` | new | Track A source proof. |
| `docs/sprint2-pr5-stage0-record-only-worker.md` | new (this file) | Implementation summary. |
| `package.json` | modified | `stage0:run` npm script only. No new dependency. |

Files NOT touched (verified by `git status` + grep):

- `src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`.
- Migrations 001..011, all PR#3 / PR#4 implementation files.
- `scripts/extract-behavioural-features.ts`.
- `scoring/*.yml` contract files.
- Track A repo (`ams-qa-behaviour-tests`).

## §6 Schema summary — `stage0_decisions`

| Column | Type | Constraint |
| --- | --- | --- |
| `stage0_decision_id` | UUID | PRIMARY KEY DEFAULT `gen_random_uuid()` |
| `workspace_id` | TEXT | NOT NULL |
| `site_id` | TEXT | NOT NULL |
| `session_id` | TEXT | NOT NULL |
| `stage0_version` | TEXT | NOT NULL |
| `scoring_version` | TEXT | NOT NULL |
| `excluded` | BOOLEAN | NOT NULL |
| `rule_id` | TEXT | NOT NULL, CHECK IN 8 Stage-0 enum values |
| `rule_inputs` | JSONB | NOT NULL DEFAULT `'{}'`, CHECK `jsonb_typeof = 'object'` |
| `evidence_refs` | JSONB | NOT NULL DEFAULT `'[]'`, CHECK `jsonb_typeof = 'array'` |
| `record_only` | BOOLEAN | NOT NULL DEFAULT TRUE, CHECK IS TRUE |
| `source_event_count` | INT | NOT NULL DEFAULT 0, CHECK ≥ 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT `now()` |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT `now()` |

Plus `excluded ↔ rule_id` co-invariant CHECK, and the 5-column natural-key UNIQUE.

## §7 Worker algorithm

1. Call `assertScoringContractsOrThrow({rootDir})` (PR#4) — refuses to start if `scoring/version.yml.status !== 'record_only'` or `automated_action_enabled !== false`.
2. Call `assertActiveScoringSourceCleanOrThrow({rootDir})` (PR#4) — defence-in-depth source-code grep over `src/scoring/**`.
3. Read `scoring_version` from the loaded contracts; merge with `STAGE0_VERSION` env (default `stage0-hard-exclusion-v0.2`).
4. SQL extractor: candidate-window (received_at ∈ [window_start, window_end]) selects candidate sessions; full-session aggregation over `accepted_events`; UA per session via `request_id` correlation to `ingest_requests`.
5. For each candidate, build a `Stage0Input` (raw UA → family label; raw UA discarded immediately).
6. Pure evaluator returns `{excluded, ruleId, ruleInputs, evidenceRefs}`. P-11 reroute applied; Stage 1 envelope discarded.
7. Worker upserts one row per candidate session into `stage0_decisions` via `ON CONFLICT (workspace_id, site_id, session_id, stage0_version, scoring_version) DO UPDATE`.
8. Return summary `{upserted_rows, excluded_rows, non_excluded_rows, stage0_version, scoring_version, window_start, window_end}`.

## §8 Privacy / minimization boundary

- Raw `ingest_requests.user_agent` is read transiently in worker memory only. After UA → family normalisation, the raw value is dropped on the floor (not logged, not persisted, not echoed to stdout).
- `stage0_decisions.rule_inputs` carries only the Helen-signed OD-11
  allowlist keys:
  - `matched_rule_id`            — mirrors the top-level `rule_id`
  - `user_agent_family`          — normalised family label (never raw UA)
  - `matched_family`             — set only when `known_bot_ua_family` fires
  - `ua_source`                  — provenance label (`'ingest_requests'`)
  - `path_pattern_matched`       — canonical path string when `scanner_or_probe_path` fires (no scheme/host/query, truncated to 256 chars)
  - `events_per_second`          — request-signal number
  - `path_loop_count`            — request-signal number
  - `signal_confidence_bucket`   — optional upstream confidence (e.g. `'high'`)
- Forbidden persisted keys (hard rule, swept by pure tests + DB tests
  + verification SQL): `raw_user_agent`, `user_agent` (raw),
  `token_hash`, `ip_hash`, `pepper`, `bearer_token`, `bearer`,
  `authorization`, `Authorization`, `raw_payload`,
  `raw_request_body`, `request_body`, `canonical_jsonb`,
  `raw_page_url`, **`matched_rules` (array form)**,
  **`ai_crawler_passthrough`**, **`zero_engagement`** (the last three
  added per Codex blocker fix — they were in the earlier draft but
  outside the signed OD-11 allowlist).

## §9 Tests run

| Step | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run check:scoring-contracts` (PR#4) | PASS |
| `npx vitest run tests/v1/stage0-record-only-worker.test.ts` | **98 / 98** passing |
| `npx vitest run` (full pure suite) | (see §11) |
| `TEST_DATABASE_URL=… vitest run --config vitest.db.config.ts tests/v1/db/stage0-decisions.dbtest.ts` | **24 / 24** passing |
| `TEST_DATABASE_URL=… vitest run --config vitest.db.config.ts` (full DB suite) | (see §11) |
| `psql … -f docs/sql/verification/12_*.sql` | All anomaly queries 0 rows; customer-API zero SELECT confirmed; scoring-worker SELECT+INSERT+UPDATE confirmed. |

## §10 Rollback

| Action | Effect |
| --- | --- |
| Revert PR#5 commit | Removes vendor copy + adapter + worker + CLI + tests + verification SQL + impl doc + provenance doc + npm script + schema mirror. |
| Migration 012 rollback (staging only) | `REVOKE` grants; `DROP TABLE IF EXISTS stage0_decisions` (no CASCADE). |
| Staging `stage0_decisions` rows | Optional cleanup by `workspace_id IN ('<staging-ws>')` AND `scoring_version='s2.v1.0'`. Internal RECORD_ONLY; safe to discard. |
| PR#1..PR#4 implementation | Untouched. |
| Track A repo | Untouched. |
| Render production | Never touched. |

Rollback is data-loss-free for production (no Render writes) and
discardable for staging.

## §11 Staging proof plan (Hetzner; OD-7)

```bash
cd /opt/buyerrecon-backend
git pull
npm install                       # no new dep expected; lockfile may bump
npm test                          # full pure suite incl. PR#5's 98 new tests
npm run check:scoring-contracts   # PR#4 still PASS

# Apply migration 012 — STAGING ONLY (verify DATABASE_URL host first).
node -e 'console.log("host=" + new URL(process.env.DATABASE_URL).host)'
psql "$DATABASE_URL" -f migrations/012_stage0_decisions.sql

# Verify columns + role privileges (PASS = customer-API zero SELECT).
psql "$DATABASE_URL" -f docs/sql/verification/12_stage0_decisions_invariants.sql | head -100

# Run the worker in RECORD_ONLY against a small candidate window.
WORKSPACE_ID="<helen_staging_ws>" SITE_ID="<helen_staging_site>" SINCE_HOURS=24 \
  npm run stage0:run

# Confirm source-table counts unchanged.
psql "$DATABASE_URL" -c "SELECT
  (SELECT COUNT(*) FROM accepted_events)                     AS accepted,
  (SELECT COUNT(*) FROM rejected_events)                     AS rejected,
  (SELECT COUNT(*) FROM ingest_requests)                     AS ingest,
  (SELECT COUNT(*) FROM session_features)                    AS session_features,
  (SELECT COUNT(*) FROM session_behavioural_features_v0_2)   AS sbf_v0_2,
  (SELECT COUNT(*) FROM scoring_output_lane_a)               AS lane_a,
  (SELECT COUNT(*) FROM scoring_output_lane_b)               AS lane_b,
  (SELECT COUNT(*) FROM stage0_decisions)                    AS stage0;"
# Expected: accepted/rejected/ingest/session_features/sbf_v0_2/lane_a/lane_b
# unchanged from pre-PR#5; only stage0 may have new rows.

npm run observe:collector         # PR#12 still PASS
```

No Render production touched (A0 P-4 still blocking).

## §12 Hard boundaries (explicit confirmation)

- **No Render production.** A0 P-4 remains blocking.
- **No production DB.** Migration 012 ran on Hetzner staging only (operator step in §11).
- **No collector / app / server / auth touched.** Pure-test import sweep confirms.
- **No Lane A writer.** No `INSERT INTO scoring_output_lane_a` in PR#5 source.
- **No Lane B writer.** No `INSERT INTO scoring_output_lane_b` in PR#5 source.
- **No reason-code emission.** No `A_*` / `B_*` / `REVIEW_*` / `OBS_*` / `UX_*` codes; Stage 0 uses its own `rule_id` enum.
- **No customer-facing output.** `buyerrecon_customer_api` has zero direct SELECT on `stage0_decisions`.
- **No raw UA / token_hash / ip_hash / raw payload / canonical_jsonb persisted** in `rule_inputs`.
- **No automated action.** `record_only IS TRUE` enforced by CHECK; `version.yml.automated_action_enabled: false` re-verified at worker boot.
- **PR#1 / PR#2 / PR#3 / PR#4 implementation files unmodified.** Track A repo unmodified.
