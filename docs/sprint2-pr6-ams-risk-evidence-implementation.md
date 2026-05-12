# Sprint 2 PR#6 — behavioural-pattern evidence + AMS Risk Core input upgrade — implementation

**Status.** Implementation complete. Hetzner staging proof + Codex
implementation review pending. **Not committed. Not pushed.**

**Date.** 2026-05-12. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| Parent (PR#5 committed) | `baa17f9793dd10b95ee143a7f237ad966b4f183e` |
| PR#6 planning commit | `9794210a34c3eed1b7b821de32d7bc2168635b85` |
| AMS repo HEAD at impl | `9bf4cc921629272b08e7287a9c216ad11d8c9609` (read-only reference) |

**Authority.**

- `docs/sprint2-pr6-ams-risk-core-v0.1-buyerrecon-lane-a-planning.md`
  (Helen-signed §0 architecture correction; Codex PASS WITH
  NON-BLOCKING NOTES).
- AMS `internal/contracts/signals.go` — frozen `RiskInputs` /
  `CommonFeatures` shapes.
- AMS `internal/riskcore/engine.go:14-21` — the upstream adapter
  TODO that PR#6 fulfils on the BuyerRecon side.
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules A / B / C / D
  / F / I.
- `docs/architecture/ARCHITECTURE_GATE_A0.md` §K row PR#6.

**Helen D-11 upgrade-not-restart rule.** PR#6 is an evidence-layer
upgrade for the existing AMS Risk Core pathway. The existing AMS Risk
Core, POI Core, Series Core, Trust Core, Policy Pass 1, and Policy
Pass 2 algorithms remain authoritative and unchanged. PR#6 adds
behavioural-pattern evidence INTO the existing pathway via the
adapter slot the AMS Risk Core spec already anticipated.

---

## §1 File inventory

**Created (13 files):**

| Path | Lines | Purpose |
| --- | --- | --- |
| `migrations/013_risk_observations_v0_1.sql` | ~165 | New table + role grants + Hard-Rule-I parity assertion |
| `src/scoring/risk-evidence/types.ts` | ~180 | `RiskInputsCompat`, `RiskObservationRow`, SBF v0.3 read view, Stage 0 read view, `OBSERVATION_VERSION_DEFAULT` |
| `src/scoring/risk-evidence/context-tags.ts` | ~200 | `CONTEXT_TAG` enum + validator + BYTESPIDER_PASSTHROUGH provenance predicate |
| `src/scoring/risk-evidence/normalisation-config.ts` | ~120 | v0.1 deterministic warn/hard thresholds + weights |
| `src/scoring/risk-evidence/normalise-behavioural-risk.ts` | ~110 | Pure deterministic `behavioural_risk_01` normaliser |
| `src/scoring/risk-evidence/adapter.ts` | ~190 | Pure `buyerreconBehaviouralToRiskInputs(sbf, stage0)` |
| `src/scoring/risk-evidence/worker.ts` | ~340 | DB worker — SELECT join + UPSERT; PR#4 startup guard wiring |
| `src/scoring/risk-evidence/index.ts` | ~60 | Public re-exports |
| `scripts/run-risk-evidence-worker.ts` | ~80 | CLI runner (`npm run risk-evidence:run`) |
| `tests/v1/risk-evidence-v0_1.test.ts` | ~590 | Pure tests (35) |
| `tests/v1/db/risk-observations-v0_1.dbtest.ts` | ~470 | DB tests (22 invariants, opt-in via `npm run test:db:v1`) |
| `docs/sql/verification/13_risk_observations_v0_1_invariants.sql` | ~330 | Read-only verification SQL |
| `docs/sprint2-pr6-ams-risk-evidence-implementation.md` | (this file) | Implementation report |

**Modified (3 files):**

| Path | Change |
| --- | --- |
| `package.json` | Added `risk-evidence:run` script (1 line) — no dep/devDep changes |
| `src/db/schema.sql` | Appended GRANT-free `CREATE TABLE IF NOT EXISTS risk_observations_v0_1` block mirroring migration 013 (PR#3 / PR#5 pattern) |
| `tests/v1/db/_setup.ts` | Added `applyMigration013` + included in `bootstrapTestDb` |

**Forbidden files NOT touched** (verified via `git status` /
`git diff` after implementation):

| Hard boundary | Touched? |
| --- | --- |
| `src/app.ts` | No |
| `src/server.ts` | No |
| `src/auth/**` | No |
| `src/collector/v1/**` | No |
| `/v1/event`, `/v1/batch` | No |
| Migrations 001..012 | No |
| `scoring/version.yml`, `scoring/reason_code_dictionary.yml`, `scoring/forbidden_codes.yml` | No |
| AMS repo (`/Users/admin/github/keigentechnologies/ams`) | No |
| PR#1..PR#5 implementation files | No |

---

## §2 Migration summary

`migrations/013_risk_observations_v0_1.sql`:

- **New table only.** Additive. No `ALTER` on existing tables, no
  `DROP`, no `CASCADE`.
- **5-column natural-key UNIQUE constraint** (D-14):
  `(workspace_id, site_id, session_id, observation_version,
  scoring_version)`.
- **CHECK constraints:**
  - `record_only IS TRUE`
  - `behavioural_risk_01 BETWEEN 0 AND 1`
  - `device_risk_01 BETWEEN 0 AND 1`
  - `network_risk_01 BETWEEN 0 AND 1`
  - `identity_risk_01 BETWEEN 0 AND 1`
  - `source_event_count >= 0`
  - `jsonb_typeof(velocity) = 'object'`
  - `jsonb_typeof(tags) = 'array'`
  - `jsonb_typeof(evidence_refs) = 'array'`
- **Role grants** (mirrors PR#3 OD-7 / PR#5 posture):
  - `buyerrecon_migrator`: ALL
  - `buyerrecon_scoring_worker`: SELECT / INSERT / UPDATE
  - `buyerrecon_internal_readonly`: SELECT
  - `buyerrecon_customer_api`: **ZERO** (REVOKE ALL + Hard-Rule-I
    parity assertion via `has_table_privilege(...)`)
- **Role-existence DO/RAISE blocks** for all four canonical roles,
  matching PR#5 migration 012.
- **No FK references either way** — additive only; rollback is
  `DROP TABLE IF EXISTS risk_observations_v0_1` (no CASCADE).

---

## §3 Table shape summary

```
risk_observations_v0_1
  risk_observation_id    UUID         PK
  workspace_id           TEXT         NOT NULL
  site_id                TEXT         NOT NULL
  session_id             TEXT         NOT NULL
  observation_version    TEXT         NOT NULL          -- e.g. 'risk-obs-v0.1'
  scoring_version        TEXT         NOT NULL          -- mirrors scoring/version.yml

  velocity               JSONB        '{}'::jsonb       -- object; numeric rates per metric
  device_risk_01         NUMERIC(4,3) 0                 -- v1 default
  network_risk_01        NUMERIC(4,3) 0                 -- v1 default
  identity_risk_01       NUMERIC(4,3) 0                 -- v1 default
  behavioural_risk_01    NUMERIC(4,3) 0                 -- normalised INPUT feature in [0,1], NOT a score
  tags                   JSONB        '[]'::jsonb       -- array of UPPER_SNAKE_CASE ContextTag strings

  record_only            BOOLEAN      TRUE              -- CHECK IS TRUE
  source_event_count     INT          0                 -- CHECK >= 0
  evidence_refs          JSONB        '[]'::jsonb       -- array of {table, ...} provenance pointers
  created_at, updated_at TIMESTAMPTZ  now()

  UNIQUE (workspace_id, site_id, session_id, observation_version, scoring_version)
```

**Critical absences (BY DESIGN).** The table has NO column named:

- `risk_index` (AMS Risk Core's `RiskOutput.RiskIndex` 0..100 —
  produced downstream by AMS, not by PR#6)
- `verification_score`
- `evidence_band`
- `action_recommendation`
- `reason_codes`
- `reason_impacts`
- `triggered_tags`
- `penalty_total`
- `final_decision`, `trust_decision`, `policy_decision`

These are AMS `RiskOutput` / `ProductDecision` / Policy Pass 1
projection territory. PR#6 is upstream of all of them.

---

## §4 Worker behaviour summary

`src/scoring/risk-evidence/worker.ts`:

1. **Startup guards** (PR#4):
   - `assertScoringContractsOrThrow()` — refuses to start if
     `scoring/version.yml.status !== 'record_only'`,
     `automated_action_enabled !== false`, or any contract is
     malformed.
   - `assertActiveScoringSourceCleanOrThrow()` — defence-in-depth
     source-code grep on `src/scoring/**`.
2. **SELECT** — single JOIN over `stage0_decisions s` and
   `session_behavioural_features_v0_2 b` on
   `(workspace_id, site_id, session_id)`, filtered by
   `s.excluded = FALSE` + `s.scoring_version = $1` + optional
   `s.stage0_version` / `workspace_id` / `site_id` / time-window
   filters. **No other tables are read.**
3. **Adapter call** — for each joined row, the pure
   `buyerreconBehaviouralToRiskInputs(sbf, stage0)` produces a
   `RiskInputsCompat` payload. The adapter:
   - normalises `behavioural_risk_01` deterministically via the v0.1
     warn/hard thresholds + weighted aggregation;
   - emits the `velocity` map (events/sec, pageview-burst,
     sub-200ms-transition, refresh-loop, same-path-repeat);
   - derives ContextTags from finite predicates over SBF columns +
     the Stage 0 `user_agent_family` provenance label;
   - defaults `device_risk_01` / `network_risk_01` / `identity_risk_01`
     to `0` (no SDK fingerprint signal at v1).
4. **UPSERT** under the 5-column natural key with
   `ON CONFLICT DO UPDATE`. `record_only` is hard-coded to `TRUE`
   in the INSERT.
5. **No customer-facing output.** Worker stdout is a PASS summary
   only — no raw UA, no raw IP, no payload.

**Forbidden reads in worker source** (verified by pure-test sweep):
`accepted_events`, `ingest_requests`, `session_features`,
`scoring_output_lane_a`, `scoring_output_lane_b`.

**Forbidden writes in worker source** (verified by pure-test sweep
of `INSERT INTO` / `UPDATE`): any table other than
`risk_observations_v0_1`.

---

## §5 ContextTag emission discipline

Initial allowed enum (Helen D-13):

```
REFRESH_LOOP_CANDIDATE
HIGH_REQUEST_BURST
ZERO_FOREGROUND_TIME
NO_MEANINGFUL_INTERACTION
JS_NOT_EXECUTED
SUB_200MS_TRANSITION_RUN
BEHAVIOURAL_CADENCE_ANOMALY
BYTESPIDER_PASSTHROUGH
```

**BYTESPIDER_PASSTHROUGH discipline (Codex non-blocking note #2).**

| Property | Status |
| --- | --- |
| Is a ContextTag (provenance only) | ✅ enum member |
| Emitted when Stage 0 saw a declared AI / search crawler family AND `excluded === FALSE` | ✅ adapter predicate |
| Emits any `B_*` reason code | ❌ — pure test `expect(tags.some(t => t.startsWith('B_'))).toBe(false)` |
| Writes a Lane B row | ❌ — pure test `expect(/INSERT.+scoring_output_lane_b/i.test(worker)).toBe(false)` + DB test `scoring_output_lane_b count unchanged` |
| Is a declared-agent scoring field | ❌ — `RiskObservationRow` shape has no declared-agent field; tested |
| Is an AI-agent classification | ❌ — no classification field on the row |
| Lane B declared-agent facts are re-derived by … | The deferred PR#3b Lane B observer |

`shouldEmitBytespiderPassthrough()` reads
`stage0_decisions.rule_inputs.user_agent_family` (a normalised label
per PR#5 OD-11), case-insensitive matches against
`BYTESPIDER_PASSTHROUGH_UA_FAMILIES = { bytespider, gptbot,
claudebot, perplexity-user, perplexitybot, ccbot, googlebot, bingbot,
duckduckbot, petalbot }`.

**`behavioural_risk_01` naming discipline (Codex non-blocking note #1).**

| Property | Status |
| --- | --- |
| Described as a normalised INPUT FEATURE | ✅ ("normalised input feature" appears in `types.ts`, `normalisation-config.ts`, `normalise-behavioural-risk.ts`, `adapter.ts`, migration 013) |
| Called a "score" in code / tests / SQL / impl doc | ❌ — `risk_index` / `verification_score` / `score` are NOT declared as fields on any PR#6 type or column |
| Is `RiskIndex` | ❌ — AMS Risk Core's `RiskOutput.RiskIndex` 0..100 is downstream; PR#6 emits a [0,1] input scalar |
| Is `verification_score` | ❌ — that is a Policy Pass 1 / `ProductDecision` concern |
| Is `evidence_band` | ❌ — same |
| Customer-facing | ❌ — `buyerrecon_customer_api` zero SELECT (Hard Rule I parity asserted at migration + verification SQL + DB test) |
| Bounded [0,1] | ✅ DB CHECK + pure-test invariant |
| Deterministic | ✅ pure-test invariant |
| Monotonic per configured feature | ✅ pure-test invariant |
| Baseline non-anomalous row → ≈ 0 | ✅ pure-test invariant |

---

## §6 Test results

### Pure tests — PASS

```
> npm test
 Test Files  39 passed (39)
      Tests  2094 passed (2094)
   Start at  19:29:43
   Duration  1.07s
```

Of those 2094:

- **35** new PR#6 pure tests under
  `tests/v1/risk-evidence-v0_1.test.ts`:
  - Adapter purity (`pure: same input → same output`)
  - Adapter mapping correctness
  - `behavioural_risk_01` bounded [0,1]
  - `behavioural_risk_01` deterministic
  - `behavioural_risk_01` monotonic in each configured feature
  - Baseline non-anomalous → 0; all-hard → 1
  - ContextTag enum shape + allowed-set + forbidden prefixes +
    forbidden patterns + cardinality cap
  - BYTESPIDER_PASSTHROUGH provenance discipline (4 sub-tests)
  - `behavioural_risk_01` naming discipline (Codex note #1)
  - No risk_index / verification_score / etc. on
    `RiskObservationRow` shape or migration column list
  - No `INSERT INTO scoring_output_lane_a / _b` in PR#6 source
  - No imports from collector / app / server / auth
  - No forbidden ML imports or truth-claim substrings
  - PR#4 startup-guard wiring asserted
  - Worker reads only `stage0_decisions` +
    `session_behavioural_features_v0_2`
- **2058** prior-PR tests pass unchanged.

### DB tests — NOT RUN (no local `TEST_DATABASE_URL`)

`tests/v1/db/risk-observations-v0_1.dbtest.ts` ships 22 invariants
that run under `npm run test:db:v1` against a local-only test DB
(`TEST_DATABASE_URL`). The local environment for this implementation
turn has no such DB configured (`TEST_DATABASE_URL` unset). Per the
task's hard boundary ("Do not run DB tests against Hetzner or
Render"), the DB tests are **deferred to the Hetzner staging proof
turn** (planning doc §12).

The DB-tests cover:

1. Migration applies idempotently
2. Expected column set is present; forbidden columns absent
3. Natural-key upsert idempotency (5-column key)
4. Different `observation_version` → separate row
5. Different `scoring_version` → separate row
6. `record_only = FALSE` rejected
7. `behavioural_risk_01 > 1` rejected
8. `device_risk_01 < 0` rejected
9. `network_risk_01 > 1` rejected
10. `identity_risk_01 < 0` rejected
11. `source_event_count < 0` rejected
12. `velocity` non-object rejected
13. `tags` non-array rejected
14. `evidence_refs` non-array rejected
15. Worker writes only `excluded = FALSE` sessions
16. Fully-excluded seed → zero PR#6 rows
17. Bytespider passthrough produces row + zero Lane B row
18. Source-tables-unchanged invariant (accepted_events,
    rejected_events, ingest_requests, session_features, SBF,
    stage0, Lane A, Lane B counts unchanged)
19. `buyerrecon_customer_api` zero privilege
20. `buyerrecon_scoring_worker` SELECT + INSERT + UPDATE
21. `buyerrecon_internal_readonly` SELECT
22. Forbidden JSON keys absent; replay determinism;
    `OBSERVATION_VERSION_DEFAULT` stamped

### Typecheck — PASS

```
> npx tsc --noEmit
(no output — clean)
```

### Scoring contracts loader (PR#4) — PASS

```
> npm run check:scoring-contracts
Scoring contracts check PASS
```

---

## §7 Grep / static proof

| Claim | Command + result |
| --- | --- |
| No `INSERT INTO scoring_output_lane_a` in PR#6 active source | `grep -RniE 'INSERT INTO\s+scoring_output_lane_a' src/scoring/risk-evidence scripts/run-risk-evidence-worker.ts` → 0 matches (the only worker.ts mention is in a docstring listing the denylist, stripped before the pure-test sweep) |
| No `INSERT INTO scoring_output_lane_b` in PR#6 active source | Same as above with `_b` |
| No `risk_index` column in `risk_observations_v0_1` | `grep -n risk_index migrations/013_*.sql` → 0 matches |
| No `verification_score` column | `grep -n verification_score migrations/013_*.sql` → 0 matches |
| No `reason_codes` column | `grep -n reason_codes migrations/013_*.sql` → 0 matches |
| No `B_*` emission in PR#6 source | Pure-test sweep + dedicated `BYTESPIDER_PASSTHROUGH does NOT emit any B_*` test |
| No customer-facing output | Migration 013 + DB test + verification SQL §12: `buyerrecon_customer_api` zero SELECT/INSERT/UPDATE/DELETE |
| No ML imports | Pure-test sweep against forbidden_codes.yml `string_patterns_blocked_in_code.patterns` |

---

## §8 Allowed implementation scope vs. forbidden — explicit table

| Allowed | Done? |
| --- | --- |
| Add PR#6 risk evidence types | ✅ `src/scoring/risk-evidence/types.ts` |
| Add pure adapter from SBF + Stage 0 to RiskInputs-compatible evidence | ✅ `src/scoring/risk-evidence/adapter.ts` |
| Add deterministic `behavioural_risk_01` normalisation | ✅ `normalise-behavioural-risk.ts` + `normalisation-config.ts` |
| Add ContextTag enum / validation | ✅ `context-tags.ts` |
| Add `risk_observations_v0_1` migration | ✅ `migrations/013_*.sql` |
| Update `schema.sql` mirror (repo convention) | ✅ append-only block added (PR#3 / PR#5 pattern) |
| Add PR#6 worker that writes only `risk_observations_v0_1` | ✅ `worker.ts` |
| Add CLI script | ✅ `scripts/run-risk-evidence-worker.ts` |
| Add `risk-evidence:run` npm script | ✅ |
| Add tests | ✅ 35 pure + 22 DB |
| Add verification SQL | ✅ `docs/sql/verification/13_*.sql` |
| Add implementation doc | ✅ (this file) |

| Forbidden | Avoided? |
| --- | --- |
| Touch AMS repo | ✅ untouched |
| Touch collector, app, server, auth | ✅ untouched |
| Modify migrations 001..012 | ✅ untouched |
| Write / read `scoring_output_lane_a` | ✅ no INSERT / SELECT in PR#6 source |
| Write / read `scoring_output_lane_b` | ✅ no INSERT / SELECT in PR#6 source |
| Implement POI / Series / Trust / Policy Pass 1 / Pass 2 / product adapter / Fit / Intent / Window / TRQ / Action / Encode | ✅ none implemented |
| Customer-facing output | ✅ `customer_api` zero SELECT |
| Automated action | ✅ `record_only IS TRUE` CHECK + PR#4 startup guard |
| Touch Render production | ✅ no `psql` run anywhere; no deploy |
| Run psql against Hetzner staging or Render production | ✅ not run from this turn |
| Commit | ✅ not committed |
| Push | ✅ not pushed |

---

## §9 Hetzner staging proof plan (deferred to next turn)

Per planning doc §12. Operator command sequence on Hetzner staging
(NOT Render production — A0 P-4 still blocking):

```bash
cd /opt/buyerrecon-backend
git pull
npm install
npx tsc --noEmit
npm run check:scoring-contracts        # PR#4 still PASS
npm test                               # full pure suite incl. PR#6's 35 new tests

# Apply migration 013 (NEW table only)
node -e 'console.log("host=" + new URL(process.env.DATABASE_URL).host)'
psql "$DATABASE_URL" -f migrations/013_risk_observations_v0_1.sql

# Pre-write source-table counts (for the unchanged-invariant proof)
psql "$DATABASE_URL" -c "SELECT
  (SELECT COUNT(*) FROM accepted_events)                     AS accepted,
  (SELECT COUNT(*) FROM rejected_events)                     AS rejected,
  (SELECT COUNT(*) FROM ingest_requests)                     AS ingest,
  (SELECT COUNT(*) FROM session_features)                    AS session_features,
  (SELECT COUNT(*) FROM session_behavioural_features_v0_2)   AS sbf_v0_2,
  (SELECT COUNT(*) FROM stage0_decisions)                    AS stage0,
  (SELECT COUNT(*) FROM scoring_output_lane_a)               AS lane_a,
  (SELECT COUNT(*) FROM scoring_output_lane_b)               AS lane_b,
  (SELECT COUNT(*) FROM risk_observations_v0_1)              AS risk_evidence;"

# Run evidence worker RECORD_ONLY over a small candidate window
WORKSPACE_ID="<helen_staging_ws>" SITE_ID="<helen_staging_site>" SINCE_HOURS=24 \
  npm run risk-evidence:run

# Re-run the same SELECT — only risk_evidence may have grown
psql "$DATABASE_URL" -c "SELECT
  (SELECT COUNT(*) FROM accepted_events)                     AS accepted,
  (SELECT COUNT(*) FROM rejected_events)                     AS rejected,
  (SELECT COUNT(*) FROM ingest_requests)                     AS ingest,
  (SELECT COUNT(*) FROM session_features)                    AS session_features,
  (SELECT COUNT(*) FROM session_behavioural_features_v0_2)   AS sbf_v0_2,
  (SELECT COUNT(*) FROM stage0_decisions)                    AS stage0,
  (SELECT COUNT(*) FROM scoring_output_lane_a)               AS lane_a,
  (SELECT COUNT(*) FROM scoring_output_lane_b)               AS lane_b,
  (SELECT COUNT(*) FROM risk_observations_v0_1)              AS risk_evidence;"

# Eligibility-gate invariant
psql "$DATABASE_URL" -c "
  SELECT COUNT(*) FROM risk_observations_v0_1 r
   WHERE NOT EXISTS (
     SELECT 1 FROM stage0_decisions s
      WHERE s.workspace_id = r.workspace_id
        AND s.site_id      = r.site_id
        AND s.session_id   = r.session_id
        AND s.excluded     = FALSE
   );"
# Expected: 0.

# Verification SQL
# Operator-scoped queries (sections 14 + 17) use psql variables; pass
# WORKSPACE_ID + SITE_ID via -v so psql escapes the quoted values.
# Global / empty-DB invariants (sections 0–13, 15, 16) run regardless.
psql "$DATABASE_URL" \
  -v WORKSPACE_ID="<helen_staging_ws>" \
  -v SITE_ID="<helen_staging_site>" \
  -f docs/sql/verification/13_risk_observations_v0_1_invariants.sql

npm run observe:collector              # PR#12 still PASS
```

**No write to `scoring_output_lane_a` is expected from PR#6** — the
staging proof asserts the Lane A row count is unchanged. The Policy
Pass 1 projection writer is a separate later PR.

---

## §9b Hetzner staging finding under commit `de76950` — multi-feature-version filter

**Symptom** (Hetzner proof, PR#6 commit `de76950`):

| Probe | Value | Interpretation |
| --- | --- | --- |
| `stage0_decisions` non-excluded rows | 2 | 2 eligible sessions |
| `session_behavioural_features_v0_2` rows by `feature_version` | `behavioural-features-v0.2`: 8 · `behavioural-features-v0.3`: 8 | two SBF versions coexist |
| eligible JOIN candidates (worker SELECT cardinality) | 4 | each session matched twice — once per SBF version |
| PR#6 worker `upserted_rows` | 4 | reflects JOIN cardinality |
| Final `risk_observations_v0_1` rows | 2 | second UPSERT per session overwrote the first via `ON CONFLICT DO UPDATE` |
| `evidence_refs.feature_version` on the final rows | v0.3 only | the later UPSERT was the v0.3 row, so the final pointer is v0.3 — but the v0.2 work was wasted |

**Root cause.** The PR#6 worker SELECT joined
`stage0_decisions` × `session_behavioural_features_v0_2` on
`(workspace_id, site_id, session_id)` with no
`feature_version` filter. The SBF natural key
`(workspace, site, session, feature_version)` permits one row per
version, so the unfiltered JOIN matched each eligible session N
times (once per SBF version present). The natural-key UPSERT on the
destination then collapsed the duplicates — final rows looked clean,
but `upserted_rows` was misleading and the worker re-ran the adapter
on obsolete versions.

**Fix.** Filter the worker SELECT to a single source SBF version.

- New constant in `src/scoring/risk-evidence/types.ts`:
  ```ts
  export const CURRENT_BEHAVIOURAL_FEATURE_VERSION = 'behavioural-features-v0.3';
  ```
  (Matches `scripts/extract-behavioural-features.ts`'s
  `DEFAULT_FEATURE_VERSION` value.)
- `worker.ts` `SELECT_SQL` adds
  `AND b.feature_version = $2` (param 2; later params shifted by one).
- `RiskEvidenceWorkerOptions` gains an optional
  `behavioural_feature_version?: string` override (defaults to the
  constant). `RiskEvidenceWorkerResult` adds the resolved value as
  `behavioural_feature_version: string` so the CLI reports which
  version actually flowed.
- `parseRiskEvidenceEnvOptions` reads optional
  `BEHAVIOURAL_FEATURE_VERSION` env var.
- CLI runner prints the resolved value.
- Tests cover: (a) obsolete v0.2 rows ignored; (b) when v0.2 + v0.3
  coexist for the same session, only the v0.3 row contributes (and
  `evidence_refs.feature_version` proves it); (c) `upserted_rows`
  equals the v0.3-eligible session count (2), not the multi-version
  JOIN cardinality (4); (d) pure-test SQL grep asserting
  `b.feature_version = $N` appears in `worker.ts`.

**Bumping the source SBF version.** Per the planning doc D-12 +
this fix: bumping `CURRENT_BEHAVIOURAL_FEATURE_VERSION` (e.g. when
PR#1 ships v0.4) requires a matching bump in
`OBSERVATION_VERSION_DEFAULT` so prior persisted rows remain
reproducible from their own provenance row.

---

## §10 Implementation gate status

| Gate | Status |
| --- | --- |
| Helen sign-off on planning doc D-1..D-14 | ✅ recorded in planning §0 + §10 |
| Codex PASS WITH NON-BLOCKING NOTES on planning doc | ✅ recorded in planning |
| PR#5 commit `baa17f97…` stable | ✅ parent of PR#6 |
| `scoring/version.yml.scoring_version === 's2.v1.0'` | ✅ unchanged |
| `automated_action_enabled === false` | ✅ unchanged + PR#4 enforces |
| AMS Risk Core spec stable | ✅ unchanged (read-only reference) |
| Typecheck | ✅ PASS |
| Pure tests | ✅ 2093/2093 PASS |
| `check:scoring-contracts` | ✅ PASS |
| DB tests | ⏳ deferred to Hetzner staging |
| Hetzner staging proof | ⏳ next turn |
| Codex implementation review | ⏳ next turn |

PR#6 ready for: **Codex implementation review** → Hetzner staging
proof → final Helen sign-off.
