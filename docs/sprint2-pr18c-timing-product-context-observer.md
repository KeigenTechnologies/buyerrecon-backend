# BuyerRecon PR#18c — Timing / Product-Context Read-Only Observer (Refresh)

Status: **code-only implementation (read-only observer + CLI + tests + doc). Verdict: PASS — observer runs read-only, produces categorical preview only, no durable writes, no customer output, no Lane A/B writer, no AMS runtime bridge.**

PR#18c implements the first BuyerRecon-side read-only observer in the post-Gate-3 chain defined by PR#18a → PR#18b. It produces a structured, categorical-only `TimingProductContextObservationReport` that captures (a) Timing / Product-Context evidence shape, (b) per-session candidates with timing-band placement and confidence cap, (c) categorical synthetic-fixture exclusion accounting, and (d) anomalies — all bounded by the workspace / site pair the operator supplies. The report is the pass-forward to PR#18d (Pass 1 planning).

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) are closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18c.**
> **No production traffic is approved by PR#18c.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18c; no production artefact / config mode flip is approved by PR#18c.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime, no Timing / Product Context runtime decisioning, no knobs / dashboard implementation is approved by PR#18c.**
> **No AMS repo modification, no AMS runtime call. No durable ProductFeatures bridge.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `f5f4b32` — "Sprint 2 PR#18b: plan timing product-context refresh (#34)").

PR branch: `buyerrecon-sprint2-pr18c-timing-product-context-observer`

Mandatory reference compliance:

- `docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md` — chain (PR#18c is step 1 implementation under §4).
- `docs/sprint2-pr18b-timing-product-context-refresh-planning.md` — Timing / Product-Context refresh plan + AMS reference + dirty-worktree guard.
- `docs/sprint2-pr17z-gate3-execution-proof.md` — Gate 3 PASS (the proof rows that PR#18c categorically excludes from commercial evaluation).
- `docs/sprint2-pr13a-product-context-fit-timing-window-planning.md` and `docs/sprint2-pr13b-product-context-timing-observer.md` — predecessor Product-Context / Timing observer (PR#13b read-only).
- `docs/sprint2-pr14a-ams-productfeatures-bridge-planning.md` — AMS reserved-name guard reaffirmed.
- `docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md` and `docs/sprint2-pr16b-lane-ab-preview-observer.md` — Lane A / B preview baseline.

---

## 1. Status / verdict

**Code-only implementation. No runtime decisioning. No customer output.**

What PR#18c ships:

- **`src/scoring/timing-product-context-observer/`** — module with `types.ts`, `query.ts`, `mapper.ts`, `report.ts`, `runner.ts`, `index.ts`. Read-only against the §2 source set. No DDL. No DML.
- **`scripts/timing-product-context-observation-report.ts`** — CLI script that connects to the DB via `DATABASE_URL`, invokes the runner, and emits markdown to stdout.
- **`tests/v1/timing-product-context-observer.test.ts`** — 39 pure unit tests covering synthetic exclusion, timing-band classification, confidence-cap policy, optional/required source handling, redaction, AMS reserved-name guard, SELECT-only SQL guard, and reason-code namespace guard.
- **`package.json`** — adds the `observe:timing-product-context` script.
- This documentation file.

What PR#18c does **not** ship and does **not** approve:

- Gate 4 of any kind (PR B / PR C / PR D / PR E).
- Production `endpointUrl` re-flip; production traffic; buyerrecon.com production `/v1/event`; Render `/collect` replacement.
- `/var/www` edit; DB grant change; AMS source / website artefact / production config change.
- Track A; Playwright; customer-facing output; Lane A/B writer; AMS Trust runtime; Pass 1 runtime; Pass 2 runtime; Timing / Product Context runtime decisioning; knobs / dashboard implementation; website ThinSDK production activation; production artefact / config mode flip.
- AMS repo modification; AMS runtime call; durable ProductFeatures bridge; customer claim text.

---

## 2. What PR#18c implements

### 2.1 Module structure (`src/scoring/timing-product-context-observer/`)

| File | Purpose | LOC bucket |
|---|---|---|
| `types.ts` | Frozen-literal version stamps, enums (timing bands, confidence caps, product-context candidate labels, exclusion flags, anomaly kinds, final statuses), output contract types, AMS reserved-name allowlist + reason-code namespace allowlist | ~240 |
| `query.ts` | Read-only SQL constants. `to_regclass`-based presence probes. Window-bounded primary SELECTs (`accepted_events`, `ingest_requests`, `rejected_events`). Window-bounded count-only secondary SELECTs (`session_features`, `session_behavioural_features_v0_2`, `poi_observations_v0_1`, `poi_sequence_observations_v0_1`, `risk_observations_v0_1`). Lane A/B count queries. Token-label-only `site_write_tokens` query (label column only — never `token_hash` / `token_id` / `pepper` / etc.) | ~160 |
| `mapper.ts` | Pure functions. Synthetic-fixture row predicate; session-id redaction; timing-band classification; confidence-cap derivation (never `'high'`); per-session candidate construction; timing-band distribution aggregation | ~240 |
| `report.ts` | Pure markdown renderer; DSN masking (host + db name only) | ~140 |
| `runner.ts` | Orchestrator. Probes table presence, fetches required rows, counts optional sources, queries Lane A/B and token-labels, calls mapper, assembles report, derives final status. Fails closed on missing required source. No `process.env` reads in the runner; the CLI parses env and supplies `ObserverRunOptions` | ~340 |
| `index.ts` | Public re-exports (CLI + tests import from here) | ~70 |

### 2.2 CLI (`scripts/timing-product-context-observation-report.ts`)

- Required env: `DATABASE_URL`, `OBS_WORKSPACE_ID`, `OBS_SITE_ID`.
- Optional env: `OBS_WINDOW_HOURS` (default 720 = 30 days), `OBS_SINCE` / `OBS_UNTIL` (ISO-8601 window overrides), `OBS_LIMIT` (default 10000), `OBS_REQUIRE_TIMING_PRODUCT_CONTEXT` (`'true'` upgrades optional-source-missing anomalies from `info` to `warn`).
- Output: structured markdown to stdout.
- Exit codes: `0` on PASS / PASS_WITH_WARNINGS; `2` on BLOCKED / env / connection / SQL error.

Invocation: `npm run observe:timing-product-context`.

### 2.3 Tests (`tests/v1/timing-product-context-observer.test.ts`)

39 pure unit tests covering required surface (see §6 below). No real `pg` connection; stub client with SQL-routed responses.

---

## 3. Source tables

All reads are SELECT-only against `public` schema. The runner uses `to_regclass` for presence probing so optional sources degrade gracefully when absent.

| Table | Role | Failure if absent |
|---|---|---|
| `public.accepted_events` | required — per-session timing input | `final_status = BLOCKED` |
| `public.ingest_requests` | required — request-level posture + boundary identifiers | `final_status = BLOCKED` |
| `public.rejected_events` | required — counterfactual coverage | `final_status = BLOCKED` |
| `public.session_features` | optional — server-side richness signal | anomaly `optional_source_missing` (info or warn) |
| `public.session_behavioural_features_v0_2` | optional — behavioural roll-up | anomaly `optional_source_missing` |
| `public.poi_observations_v0_1` | optional — POI signal coverage | anomaly `optional_source_missing` |
| `public.poi_sequence_observations_v0_1` | optional — POI sequence coverage | anomaly `optional_source_missing` |
| `public.risk_observations_v0_1` | optional — risk signal coverage | anomaly `optional_source_missing` |
| `public.site_write_tokens` | label-column only — synthetic-fixture token detection | anomaly logged; label count reported as 0 |
| `public.scoring_output_lane_a` | count-only — PR#18b §9 expects 0 | anomaly `unexpected_lane_a_row_count_nonzero` if > 0 |
| `public.scoring_output_lane_b` | count-only — PR#18b §9 expects 0; Lane B stays dark | anomaly `unexpected_lane_b_row_count_nonzero` if > 0 |

Required base set (`accepted_events`, `ingest_requests`, `rejected_events`) is the v1 collector's three-table ledger from PR#5c / PR#7. The collector cannot produce evidence without these tables; their absence is structurally BLOCKED.

The runner does not create temp tables; it does not call any extension; it does not modify `search_path`; it makes one query per primary table and one per probed optional source.

---

## 4. Synthetic / control-traffic exclusion rules

Per PR#18b §6, Gate 2 and Gate 3 fixture rows are control / proof traffic and must not feed commercial evaluation.

The observer applies the following categorical exclusion rules at the mapper layer (after fetch), then reports the exclusion counts:

- **Workspace / site pair**: any row with `(workspace_id = 'buyerrecon_staging_ws', site_id = 'buyerrecon_com')` is treated as proof traffic. Constant: `SYNTHETIC_FIXTURE_WORKSPACE_ID` / `SYNTHETIC_FIXTURE_SITE_ID` in `mapper.ts`.
- **Schema-key namespace**: any row whose `schema_key` starts with `buyerrecon.test.` (e.g. `buyerrecon.test.page_view`, `buyerrecon.test.cta_click` from Gate 3 fixtures F1 / F2 / F3) is treated as proof traffic. Constant: `SYNTHETIC_FIXTURE_SCHEMA_KEY_PREFIX`.
- **Token label match**: `site_write_tokens.label IN ('pr17x_gate2_fixture', 'pr17z_gate3_fixture')` matches the Gate-N fixture provisioning labels from PR#17x §15 / PR#17z §D. Constant: `SYNTHETIC_FIXTURE_TOKEN_LABELS`. The query reads ONLY the `label` column — never `token_hash`, `token_id`, `created_at`, or any other column.

Hard rules:

- **Excluded rows are NOT deleted.** The exclusion is observer-side only. `synthetic_control_exclusion.proof_rows_preserved` is `true` by categorical contract.
- **Synthetic rows are NOT used to increase confidence.** If after exclusion the only signal that remains is synthetic, the confidence cap is `low` with reason `synthetic_only_after_exclusion`.
- **Synthetic rows are NOT treated as negative commercial evidence.** Their exclusion does not move any session toward `dormant`; it removes the row from the commercial calculation entirely.
- **Excluded counts are reported separately** in `synthetic_control_exclusion.{excluded_workspace_site_pair_matches, excluded_schema_key_namespace_matches, excluded_token_label_matches, excluded_accepted_events_rows, excluded_rejected_events_rows, excluded_ingest_requests_rows}`.

Future Gate-N runs adding new fixture labels (e.g. `pr??_gate?_fixture` or future `pr18d_pass1_fixture`) must add their labels to `SYNTHETIC_FIXTURE_TOKEN_LABELS` (a frozen `readonly string[]`) via a docs-only or trivial PR before that Gate-N execution.

---

## 5. Timing bands and confidence cap policy

### 5.1 Timing bands (PR#18b §7.1)

Six categorical bands. Classification is the most recent server-side evidence timestamp's age vs. `evaluation_at`:

| Band | Threshold |
|---|---|
| `hot_now` | age ≤ 1 hour |
| `warm_recent` | 1h < age ≤ 24h |
| `cooling` | 24h < age ≤ 168h (7d) |
| `stale` | 168h < age ≤ 720h (30d) |
| `dormant` | 720h < age ≤ 2160h (90d) |
| `insufficient_evidence` | no evidence in window OR future-dated OR age > 2160h |

`insufficient_evidence` is **categorically distinct** from `dormant`. `dormant` is "we observed evidence; the answer is: no recent activity". `insufficient_evidence` is "we cannot say". Tests F.1 / F.2 / F.3 lock this distinction.

Thresholds are versioned `timing-band-thresholds-v0.1-observer-only`. They are **observer-only v0.1 placeholders**, not customer-facing scoring; PR#18d (Pass 1) or later may recalibrate after commercial v1 evidence accumulates per PR#18b §10 OD-3.

### 5.2 Confidence cap policy (PR#18b §7.2)

Two categorical caps. **`'high'` is never emitted by PR#18c.**

| Cap | Categorical reasons |
|---|---|
| `low` | `no_evidence_in_window` / `single_source_only` / `client_only_evidence` / `synthetic_only_after_exclusion` / `threshold_not_locked` |
| `medium` | `multi_source_server_side` (≥ 2 server-side sources) / `missing_optional_sources` (multi-source but at least one optional source absent — cap remains medium) |

Tests C.1 → C.7 lock the cap policy. Test C.1 explicitly asserts `CONFIDENCE_CAPS_ALLOWED` does not contain `'high'`.

### 5.3 Product-context candidate labels (v0.1)

Five categorical labels — internal only. Not customer claims. Not Product Decisions. Not Trust scores. Not Pass 1 / Pass 2 verdicts.

| Label | Meaning |
|---|---|
| `evidence_observed` | ≥ 2 server-side sources show signal globally AND this session has accepted_events |
| `single_source_signal` | exactly one server-side source shows signal globally |
| `synthetic_only_excluded` | reserved for future use (no candidate currently emits this label; synthetic rows are excluded upstream of candidate construction) |
| `insufficient_evidence` | no qualifying evidence |
| `threshold_not_locked` | observer cannot classify reliably (reserved for future calibration moments) |

---

## 6. Pass-forward contract to Pass 1 (PR#18d)

Each `ProductContextSessionCandidate` carries:

- `session_id_redacted` — truncated form `prefix(8)…suffix(4)`; never the raw id.
- `timing_band_candidate` — one of the six bands.
- `product_context_candidate` — one of the five labels.
- `confidence_cap` — `'low'` or `'medium'`.
- `confidence_reason` — one of the seven categorical reasons.
- `evidence_refs` — categorical labels like `accepted_events:3` (count, not row content).
- `exclusion_flags` — categorical flags including `session_id_redacted` (always), `optional_source_missing` (when applicable), `lane_b_dark_internal` (when Lane B count > 0 globally).
- `pass_forward_to_pass1` — `true` only when band ≠ `insufficient_evidence` AND candidate ∉ {`insufficient_evidence`, `threshold_not_locked`, `synthetic_only_excluded`}.

The observer report itself (`TimingProductContextObservationReport`) is a versioned categorical envelope: `report_version`, `observer_version`, `pass_forward_contract_version`, `synthetic_exclusion_rule_version`, `timing_band_thresholds_version`, `confidence_cap_policy_version`, `checked_at`, window metadata, source presence + counts, synthetic control exclusion summary, timing band distribution, the per-session candidate array, anomalies, final status, and a frozen boundary-affirmations list.

**No customer claim text appears anywhere.** No "this lead is", "this user will convert", "buyer-intent detected", "good bot", "AI agent detected", "invalid traffic confirmed" wording is in any field, anywhere in the codebase. Test I.2 asserts this explicitly.

---

## 7. Non-goals (re-affirmed)

- No code path produces customer output.
- No code path writes Lane A/B rows.
- No code path calls AMS at runtime.
- No code path issues DML / DDL / GRANT / REVOKE.
- No code path mutates `search_path`, creates temp tables, or installs extensions.
- No code path prints raw `request_id` UUID values, raw payload bytes, Authorization header values, DSN values, `token_hash`, `token_id`, pepper, private key, certificate, env dump, or vault content.
- No code path emits a confidence cap of `'high'` (test C.1 + the static type `ConfidenceCap = 'low' | 'medium'` lock this).
- No code path emits AMS reserved names (`Fit` / `Intent` / `Window` / `ProductDecision` / `RequestedAction` / `Pass1` / `Pass2` / `TrustDecisionV3` / `BuyerReconProductFeatures`) as TypeScript exports (test J.1 + the `AMS_RESERVED_NAMES_FORBIDDEN` allowlist lock this).
- No code path emits AMS reason-code namespaces (`FIT.*` / `INTENT.*` / `WINDOW.*` / `PRODUCT_DECISION.*` / `REQUESTED_ACTION.*`) in runtime sources (test L.1 + the `AMS_RESERVED_REASON_NAMESPACES_FORBIDDEN` allowlist lock this).

---

## 8. Test evidence

Run: `npx vitest run tests/v1/timing-product-context-observer.test.ts`

Result at PR submission: **39 / 39 passed.**

Test surface (mapped to PR#18c §13 requirements):

| Group | Coverage |
|---|---|
| A | Synthetic-fixture exclusion (workspace/site pair, schema_key namespace, token label, additive non-mutating counts) — 5 tests |
| B | Timing-band classification — band boundaries, null evidence, future-dated, frozen thresholds — 9 tests |
| C | Confidence cap policy — `'high'` never emitted; all seven reasons exercised — 7 tests |
| D | Missing optional-source handling — anomalies logged, run continues — 1 test |
| E | Required-source missing → BLOCKED — 1 test |
| F | `insufficient_evidence` distinct from `dormant` — 3 tests |
| G | Pass-forward shape carries no customer claim text; sessions without evidence are not passed forward — 2 tests |
| H | Session_id redaction; short / invalid inputs collapse to `***` — 2 tests |
| I | Lane B presence sets dark/internal flag and emits anomaly only — never customer language — 2 tests |
| J | AMS reserved-name guard — no `Fit` / `Intent` / `Window` / etc. exports — 2 tests |
| K | SQL constants SELECT-only — no DML / DDL verbs in any backticked SQL string — 1 test |
| L | AMS reason-code namespace guard — no `FIT.*` / `INTENT.*` / `WINDOW.*` in `mapper.ts` / `query.ts` / `report.ts` / `runner.ts` — 1 test |
| Z | Aggregate distribution math + DSN masking + frozen version stamps — 3 tests |

Type-check: `npx tsc --noEmit` — passes.

---

## 9. Boundaries / hard rules carried forward

The implementation re-asserts every PR#18a / PR#18b boundary at runtime via the `boundary_affirmations` block on every report:

```
read_only: yes
no_durable_table_created: yes
no_migration: yes
no_schema_change: yes
no_db_write: yes
no_customer_output: yes
no_lane_a_b_writer: yes
no_ams_runtime_bridge: yes
no_pass_1_runtime: yes
no_pass_2_runtime: yes
no_trust_runtime: yes
no_request_id_uuid_value_printed: yes
no_raw_payload_printed: yes
no_token_or_hash_or_pepper_or_dsn_printed: yes
confidence_cap_high_emitted: no
synthetic_proof_rows_preserved: yes
```

These are emitted from `boundaryAffirmations()` in `runner.ts` and rendered into the markdown report; they are the categorical guarantees Codex / Helen review can grep for.

---

## 10. AMS posture (PR#18b §4 carry-forward)

PR#18c does **not** re-inspect AMS. The PR#18b inspection at AMS HEAD `9bf4cc921629272b08e7287a9c216ad11d8c9609` (workspace dirty: 6 modified files, multiple untracked) remains the only AMS observation in this chain.

Per PR#18b §4.1.1: AMS dirty-worktree observations are reference-only and non-contractual until committed/merged. PR#18c does not introduce any code path that depends on a dirty-AMS observation; the BuyerRecon observer is fully self-contained and reads only from BuyerRecon's own DB tables.

The AMS reserved-name guard (PR#14a §10) and the namespace-disjoint candidate contract (PR#14b) remain the canonical BuyerRecon-side constraints. Tests J.1 / J.2 / L.1 enforce them at the source-file level.

---

## 11. Next step in the chain

PR#18d — Pass 1 output contract planning (PR#18a §13). PR#18d will consume the categorical pass-forward shape defined in §6 above and lock OD-P1 → OD-P5 from PR#18a §6.3. PR#18d is **not** opened by PR#18c. It requires its own explicit Helen GO.

---

End of PR#18c. **Verdict: code-only implementation of a read-only Timing / Product-Context observer; PASS — 39 / 39 tests pass; tsc clean; no DML / DDL / GRANT / REVOKE; no customer output; no Lane A/B writer; no AMS runtime bridge; no Gate 4 work; no production `endpointUrl` re-flip; no website ThinSDK production activation; no production artefact / config mode flip; AMS repo unmodified. PR#18d (Pass 1 output contract planning) requires its own separate Helen GO and is not opened by PR#18c.**
