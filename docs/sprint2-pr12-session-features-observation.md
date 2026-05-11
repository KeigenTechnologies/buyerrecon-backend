# Sprint 1 PR#12 — Session features derived-layer observation (§9b)

> **Hard-rule disclaimer.** PR#12 is a **read-only operator report extension**
> over the Track B collector DB. It is **NOT** Track A scoring. It is **NOT**
> the Core AMS productized scoring layer. It is **NOT** a dashboard, classifier,
> bot/AI-agent detector, lead-quality grader, CRM router, or enrichment surface.
> It introduces no `risk_score` / `classification` / `recommended_action` /
> `bot_score` / `agent_score` / `is_bot` / `is_agent` / `ai_agent` /
> `lead_quality` / `company_enrichment` / `ip_enrichment` / CRM fields.
>
> It performs **no DB writes**, **no schema changes**, **no migrations**,
> **no scripts/extract-session-features.ts invocations**. It never reads or
> prints `token_hash`, `ip_hash`, `user_agent`, raw payload bytes,
> `SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`, raw bearer tokens, IP
> addresses, emails, phone numbers, names, or any other PII / secret. It
> renders **paths only — never URLs** — for the §9b top-10 row table, and
> truncates `session_id` to its first 8 characters plus an ellipsis. No
> deploy, no push.

## 1. Scope

PR#12 extends `npm run observe:collector` with a single new section —
**§9b. Session features summary (derived layer — PR#11 output, observation
only)** — placed after §9 Token health and before §10 Final observation
status. The section reports factual aggregates and anomaly counts over the
`session_features` table introduced by PR#11.

PR#12 does **not** touch:

- the collector route, orchestrator, persistence, row-builders, validation,
  auth, or app/server wiring (`src/collector/v1/**`, `src/app.ts`,
  `src/server.ts`, `src/auth/workspace.ts`, `src/db/client.ts`)
- the v1 barrel `src/collector/v1/index.ts`
- `migrations/**` (no new migration introduced)
- `src/db/schema.sql` (no schema change)
- `scripts/extract-session-features.ts` (read-only; PR#12 never invokes it)
- `.env.example`
- `package.json` (the existing `observe:collector` script line continues to
  work unchanged)

## 2. Non-scoring boundary

The §9b section is a derived-layer health view. It reports only:

- counts (rows, source events, page views, CTA clicks, form starts/submits,
  unique paths)
- timestamps (first_seen_at, last_seen_at, extracted_at, latest received_at)
- canonical_key_count min/max (expected 19/19 per the §2.5 line 168 contract)
- anomaly counters (duplicate natural keys, source_event_count mismatch,
  canonical anomaly, has_* flag mismatches, duration anomaly, JSONB type
  anomaly — all should be 0)
- extraction lag (computed from received_at and extracted_at timestamps)
- a top-10 table of latest sessions in the window, paths only

It does not, and must not, surface scoring, classification, intent grading,
buyer rating, fraud risk, bot detection, AI-agent detection, lead quality,
or any other judgement-rendering output. Future scoring lives on a separate
productized table at the Core AMS layer, not here.

## 3. Read-only contract

Every SQL string in `scripts/observation-session-features.ts` is
`SELECT`-only. The §9b query layer:

- contains no `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `DROP` /
  `ALTER` / `CREATE` / `GRANT` / `REVOKE` / `COPY` / `BEGIN` / `COMMIT` /
  `ROLLBACK` statements anywhere
- never selects `token_hash`, `ip_hash`, `user_agent`, raw payload bytes,
  `request_body`, peppers, bearer tokens, or authorization headers
- contains none of the banned scoring identifiers
- never invokes the extractor (`scripts/extract-session-features.ts`); if
  `session_features` is stale, the WATCH lag signal surfaces it and the
  operator runs the extractor as a separate step

## 4. Env knobs

Three new env vars, all optional, all consumed inside the observation
script and the §9b helper module. None are written to `.env.example` in
PR#12 (consistency with PR#9's `OBS_WINDOW_HOURS` policy).

| Var | Default | Effect |
|---|---|---|
| `OBS_SESSION_FEATURES_VERSION` | `session-features-v0.1` | scopes §9b queries to a single `extraction_version` |
| `OBS_SESSION_FEATURES_MAX_LAG_HOURS` | `24` | extractor lag above this → WATCH (never BLOCK); positive integer only |
| `OBS_REQUIRE_SESSION_FEATURES` | `false` | true only when env value equals the literal string `"true"`. When true, missing `session_features` table → WATCH; when false, missing table → no status impact |

## 5. Window-scoping rule

§9b respects the existing `OBS_WINDOW_HOURS` window. Specifically:

- `session_features` rows are selected by `last_seen_at` ∈
  `[windowStart, checkedAt]`. Sessions whose `last_seen_at` falls outside
  the window are excluded from the summary, anomaly counters, and top-10
  table.
- For each **selected** session, the `source_event_count` mismatch check
  validates against the **full-session** `accepted_events` count for that
  `(workspace_id, site_id, session_id)` tuple — i.e. the inner subquery
  applies **no time filter** on `accepted_events.received_at`. This
  preserves correctness because `session_features` stores full-session
  aggregates, not window-scoped slices.
- The freshness signal (`latest_accepted_received_at` and
  `latest_extracted_at_overall`) is computed boundary-wide (no window
  filter), since "is the extractor stale?" is a global health question
  rather than a window-scoped one.

## 6. Full-session mismatch validation rule

The PR#12 invariant is:

> For every `session_features` row selected by the observation window, the
> stored `source_event_count` must equal the count of matching v1 browser
> events in `accepted_events` for that same `(workspace_id, site_id,
> session_id)`, where matching is defined as:
>
>   - `event_contract_version = 'event-contract-v0.1'`
>   - `event_origin = 'browser'`
>   - `session_id <> '__server__'`

Any non-zero count of session_features rows failing this invariant → BLOCK.
This catches:

- extractor regressions that mis-count source events
- accepted_events being re-inserted (would not happen under the §6 unique
  index, but the cross-check guards against any future drift)
- session_features being mutated by an out-of-band path (which should never
  happen — extractor is the only writer)

## 7. Status logic

§9b contributions are computed by `decideSessionFeatures(health, config,
acceptedCountInWindow)` and merged into the existing `decide()` function's
`blocks` / `watches` arrays. Final status precedence is unchanged:
**BLOCK > WATCH > PASS**.

| Condition | Contribution |
|---|---|
| Table missing AND `OBS_REQUIRE_SESSION_FEATURES != 'true'` | _(nothing — section says "table not present", status unaffected)_ |
| Table missing AND `OBS_REQUIRE_SESSION_FEATURES == 'true'` | **WATCH** — never BLOCK |
| Table present, rows = 0, accepted_events in window > 0 | **WATCH** — rerun extractor |
| Table present, rows = 0, accepted_events in window = 0 | _(nothing — steady-state empty boundary)_ |
| `duplicate_natural_key_count > 0` | **BLOCK** |
| `source_event_count_mismatch_count > 0` (full-session check) | **BLOCK** |
| `canonical_key_anomaly_count > 0` (min ≠ 19 or max ≠ 19) | **BLOCK** |
| `has_cta_click_mismatch_count > 0` | **BLOCK** |
| `has_form_start_mismatch_count > 0` | **BLOCK** |
| `has_form_submit_mismatch_count > 0` | **BLOCK** |
| `session_duration_ms anomaly_count > 0` | **BLOCK** |
| JSONB count-map type anomaly > 0 | **BLOCK** |
| `extraction_lag_hours > OBS_SESSION_FEATURES_MAX_LAG_HOURS` | **WATCH** — never BLOCK |
| All clear | no contribution; overall status determined by other sections |

## 8. Local proof

```bash
# Type-check
npx tsc --noEmit

# Full test suite (pure tests only — no DB required for PR#12)
unset TEST_DATABASE_URL; npm test
# Expected: 33 files, 1677 tests pass

# Optional: dry-run §9b against a local DB that already has PR#11 data.
DATABASE_URL=postgres://$(whoami)@localhost:5432/br_collector_test \
  WORKSPACE_ID=buyerrecon_smoke_ws \
  SITE_ID=buyerrecon_com \
  OBS_WINDOW_HOURS=720 \
  OBS_REQUIRE_SESSION_FEATURES=true \
  npm run observe:collector
# Expected: §9b section renders with the existing smoke session(s);
# anomaly counters all 0; status PASS (or WATCH if pre-existing).
```

## 9. Staging proof (operator-run; not PR#12 work)

PR#12 is a code-only change. Helen runs the §9b staging proof:

```bash
ssh <staging-host>
cd /opt/buyerrecon-backend
set -a; source .env; source /root/buyerrecon_staging_site_token_meta.env; set +a

# §9b dormant (table not required, default behaviour):
OBS_WINDOW_HOURS=168 npm run observe:collector
# Expected: §9b shows existing PR#11 session_features rows for the boundary,
# canonical min/max = 19/19, anomaly counters = 0, status PASS.

# §9b active (explicitly required):
OBS_WINDOW_HOURS=168 OBS_REQUIRE_SESSION_FEATURES=true npm run observe:collector
# Expected: identical output to the previous run, since session_features is
# present and healthy. If a future environment had migration 008 missing,
# this command would surface WATCH with the "table not present" reason.

# §9b lag stress (tighter threshold):
OBS_WINDOW_HOURS=168 OBS_SESSION_FEATURES_MAX_LAG_HOURS=1 npm run observe:collector
# Expected: WATCH if the extractor hasn't run in the past hour, PASS
# otherwise. This is a way to alert sooner on staleness.
```

PR#12 does not run staging commands itself. No live network. No production
DB access.

## 10. Rollback

| Step | Action |
|---|---|
| 1 | Delete `scripts/observation-session-features.ts`. |
| 2 | Revert `scripts/collector-observation-report.ts` to remove the import block, the `validateRequiredEnvOrFail()` extraction + `require.main` gate, the `decide()` extension argument, the §9b loader/render wiring, and the `decideSessionFeatures` merge call. |
| 3 | Delete `tests/v1/observation-report-pr12.test.ts`. |
| 4 | Delete `docs/sprint2-pr12-session-features-observation.md`. |
| 5 | Delete `docs/sql/verification/07_session_features_observation.sql` (if added). |
| 6 | Revert the §9b paragraph appended to `docs/sprint2-pr9-collector-observation-report.md`. |
| 7 | No DB rollback — PR#12 wrote nothing. |
| 8 | No migration rollback — PR#12 added no migration. |
| 9 | `session_features` table remains untouched (PR#11 artefact). |
| 10 | Verify `npm test` returns to its pre-PR#12 count; `npx tsc --noEmit` clean. |

## 11. Codex review checklist

1. ✅ `scripts/observation-session-features.ts` contains no `INSERT` /
   `UPDATE` / `DELETE` / `TRUNCATE` / `DROP` / `ALTER` / `CREATE` /
   `BEGIN` / `COMMIT` / `ROLLBACK` / `GRANT` / `REVOKE` / `COPY`.
2. ✅ The §9b SQL strings never SELECT `token_hash`, `ip_hash`,
   `user_agent`, `request_body`, peppers, bearer tokens, or
   authorization headers.
3. ✅ The §9b SQL strings contain no scoring / classification / bot /
   AI-agent / lead-quality / enrichment identifiers.
4. ✅ All queries are parameterised on `workspace_id`, `site_id`,
   `extraction_version`, `window_start`, `window_end`.
5. ✅ `OBS_REQUIRE_SESSION_FEATURES` is true only when the env value
   equals the literal string `"true"` (no case-folding, no truthy
   coercion).
6. ✅ Missing `session_features` table never produces BLOCK; only
   no-impact (default) or WATCH (require=true).
7. ✅ Lag > threshold produces WATCH, never BLOCK.
8. ✅ Rendered §9b output never contains a full session_id, a
   `landing_page_url`, a `last_page_url`, or any token / IP / UA /
   secret material. Pure tests sweep for these strings.
9. ✅ Rendered §9b output truncates session_id to first 8 chars +
   ellipsis. Pure test asserts.
10. ✅ Window-scoping rule: `session_features.last_seen_at >= window_start
    AND <= window_end`. Pure test inspects SQL.
11. ✅ Full-session mismatch validation: inner accepted_events join has
    no `received_at` filter. Pure test inspects SQL.
12. ✅ No changes to: `src/collector/v1/**`, `src/app.ts`,
    `src/server.ts`, `src/db/**`, `migrations/**`, `src/auth/**`,
    `src/collector/v1/index.ts` barrel, `.env.example`,
    `vitest.db.config.ts`.
13. ✅ No Track A imports (`ams-qa-behaviour-tests`). No Core AMS imports
    (`keigentechnologies/ams`).
14. ✅ No Playwright. No live production URLs in the script source.
15. ✅ No new npm dependencies (`pg`, `dotenv`, `tsx`, `vitest` already
    present).
16. ✅ `npx tsc --noEmit` clean.
17. ✅ `unset TEST_DATABASE_URL; npm test` passes 1677/1677.
18. ✅ The existing `observe:collector` script entry in `package.json` is
    unchanged.
19. ✅ No commit, no push, no deploy in PR#12 implementation work.
20. ✅ The PR#11 staging proof state is untouched (8 session_features
    rows, canonical 19/19, 0 anomalies). PR#12 only adds an observation
    surface over this state.

## 12. Three-part architecture boundary

| Layer | Touched? |
|---|---|
| **Core AMS** (productized scoring/report home) | ❌ no |
| **Track A** (experimental scoring harness — `ams-qa-behaviour-tests`) | ❌ no |
| **Track B** (BuyerRecon Evidence Foundation — this repo) | ✅ observation-only |

PR#12 is a **read-only Track B observation surface**. It does not introduce
scoring, does not couple to Track A, and does not write to Core AMS tables.
The §9b queries read `accepted_events` (for the mismatch join) and
`session_features` (for the summary); both are Track B tables owned by this
repo.
