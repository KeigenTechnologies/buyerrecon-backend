# Sprint 2 PR#1 — `behavioural_features_v0.2` planning

| Field | Value |
|---|---|
| Status | **PLANNING ONLY — no implementation has started, no DB / migration / production work has occurred.** |
| Date | 2026-05-11 |
| Owner | Helen Chen, Keigen Technologies (UK) Limited |
| Authority | `docs/architecture/ARCHITECTURE_GATE_A0.md` (commit `a87eb05`) + `docs/contracts/signal-truth-v0.1.md` + `scoring/*.yml` (Sprint 2 PR#0 commit `d4cc2bf`) |
| Prerequisite for implementation | **Helen's written sign-off on this planning document.** Implementation cannot begin until that sign-off is recorded per A0 §0.7. |
| Codex review status | Revised after PASS-WITH-REQUIRED-FIXES; this document supersedes the prior in-chat planning report. |

> **Hard rule.** This document is a planning artefact. No code, migration, schema, or scoring path has been created. Sprint 2 PR#1 implementation MUST NOT begin before Helen explicitly approves this document per A0 §0.7.

---

## §1 Hard scope statement (planning gate)

**Sprint 2 PR#1 is:**

- ✅ downstream factual feature extraction only
- ✅ a new derived-factual sibling table to `session_features` (PR#11)
- ✅ an idempotent extractor following the PR#11 pattern exactly
- ✅ pure tests + opt-in DB tests + verification SQL + a PR doc

**Sprint 2 PR#1 is NOT:**

- ❌ no collector write-path changes (`src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**` unchanged)
- ❌ no scoring of any kind
- ❌ no reason-code emission. PR#1 MUST NOT emit any code matching the prefixes `A_*`, `B_*`, `REVIEW_*`, or `OBS_*`
- ❌ no Lane A output (`scoring_output_lane_a` is Sprint 2 PR#3)
- ❌ no Lane B output (`scoring_output_lane_b` is Sprint 2 PR#3)
- ❌ no Stage 0 worker (vendor of Track A `stage0-hard-exclusion.js` is Sprint 2 PR#5)
- ❌ no Stage 1 worker (vendor of Track A `stage1-behaviour-score.js` is Sprint 2 PR#6)
- ❌ no false-positive review queue (Sprint 2 PR#7)
- ❌ no customer-facing output (Sprint 3)
- ❌ no Render production path (P-4 still blocking per A0)
- ❌ no live SDK rollout
- ❌ no frontend / GTM / GA4 / LinkedIn / ThinSDK touch
- ❌ no AMS repo touch
- ❌ no Track A repo touch (Track A is reference / prototype only; **PR#1 imports zero Track A code**)

**Hard non-emission rule, code/CI-enforced via Sprint 2 PR#0 forbidden-codes sweep:**
PR#1's extractor MUST NOT emit, write, route, or label any record with a string that begins with `A_`, `B_`, `REVIEW_`, or `OBS_`. PR#1 produces factual derived-aggregate columns only. Reason-code emission belongs to Sprint 2 PR#5/PR#6 and writes to the Lane A/B tables that do not exist yet.

---

## §2 Architecture authority + locked commits

| Authority | Path | Locked commit |
|---|---|---|
| Master architecture gate | `docs/architecture/ARCHITECTURE_GATE_A0.md` | `a87eb05` |
| Sprint 2 canonical contract | `docs/contracts/signal-truth-v0.1.md` | `d4cc2bf` (Sprint 2 PR#0) |
| Reason-code dictionary | `scoring/reason_code_dictionary.yml` | `d4cc2bf` (Sprint 2 PR#0) |
| Forbidden-code list | `scoring/forbidden_codes.yml` | `d4cc2bf` (Sprint 2 PR#0) |
| Scoring version baseline | `scoring/version.yml` | `d4cc2bf` (Sprint 2 PR#0) |
| Sprint 1 evidence foundation | `migrations/008_session_features.sql` + `scripts/extract-session-features.ts` | `4fec39e` (PR#12) |

PR#1 reads these as authority; PR#1 does **not** modify them.

---

## §3 Table name + feature version (Codex-adopted defaults)

| Property | Value |
|---|---|
| **Table name** | `session_behavioural_features_v0_2` |
| **Feature version** (table column value) | `behavioural-features-v0.2` |
| **Natural key** | `UNIQUE (workspace_id, site_id, session_id, feature_version)` |
| **Primary key** | `behavioural_features_id BIGSERIAL` |

**Rationale.** A0 §C + §K names this layer as the `v0.2` behavioural feature table. Pinning the version into the table name is more explicit for the first behavioural feature layer, avoids confusion with future scoring outputs, and makes a future v0.3 table creation an explicit migration rather than a silent semantic shift on the same table. The `feature_version` column lets multiple versions coexist row-wise if needed during transition.

---

## §4 Refresh-loop boundary (A0 PR#1 / PR#2 split)

**FACT.** A0 §K Sprint 2 PR#1 (behavioural_features_v0.2 extractor) and PR#2 (server-side refresh-loop derivation) are listed as **separate PRs**.

**Codex correction.** PR#1 must not silently absorb PR#2's work. Doing so would (a) make PR#1 too large, (b) couple the refresh-loop algorithm to behavioural feature extraction without a separate review pass, and (c) make refresh-loop thresholds bleed into row-level feature semantics without a dedicated audit.

**Decision (D-3 default).** **PR#1 does NOT absorb PR#2.** Full server-side refresh-loop derivation lands in **Sprint 2 PR#2**. PR#1 either:

- **Option α (recommended default).** Omit the refresh-loop field entirely from the PR#1 schema. PR#2 adds it via a follow-up additive migration.
- **Option β (only if Helen explicitly approves at D-3).** Include the field as `refresh_loop_candidate BOOLEAN` defaulting to NULL with `feature_source_map.refresh_loop_candidate = "deferred_to_pr2"`. The column exists structurally but is never populated by PR#1; PR#2's migration may then `UPDATE` semantics or add a sibling column.

**Hard PR#1 rules around refresh-loop:**

- ❌ PR#1 MUST NOT trust SDK-emitted `refresh_loop_observed` flags as source of truth. Per signal-truth-v0.1 §6.5, refresh-loop is a server-derived `refresh_loop` feature object, not an SDK-emitted boolean.
- ❌ PR#1 MUST NOT name a field `refresh_loop_observed`. "Observed" implies an authoritative judgement that PR#1 cannot make. Use `refresh_loop_candidate` if included.
- ❌ PR#1 MUST NOT couple refresh-loop thresholds (N consecutive same-path views, W window ms, K max interactions between) into its extraction SQL. Thresholds belong to PR#2 where they get their own contract.
- ✅ If `refresh_loop_candidate` is included as a deferred placeholder, `feature_source_map.refresh_loop_candidate` MUST equal `"deferred_to_pr2"` for every row in v0.2.

**Open decision D-3.** "May PR#1 absorb A0 PR#2 refresh-loop server-side derivation?" **Default: no.**

---

## §5 Field naming corrections (Codex risk-label neutralisation)

The prior in-chat planning report named several factual fields in ways that implied judgement. Codex flagged these. The revised planning adopts the safer names:

| Prior name (in-chat) | Revised name (planning) | Type | Why renamed |
|---|---|---|---|
| `refresh_loop_observed` | **defer to PR#2** OR `refresh_loop_candidate` (NULL only) | BOOLEAN nullable | "Observed" implies a finding/judgement. PR#1 cannot make that finding. |
| `form_start_without_prior_cta` | `first_form_start_precedes_first_cta` **and** `form_start_count_before_first_cta` | BOOLEAN + INT | "Without prior CTA" hints at a "missing-step" judgement. The boolean is a literal temporal-order observation; the count is a factual measurement. Including both is factual and neutral. |
| `form_submit_without_form_start` | `has_form_submit_without_prior_form_start` **and** `form_submit_count_before_first_form_start` | BOOLEAN + INT | Same neutralisation pattern. The `has_` prefix already signals "observation" (not "verdict"); the count is a literal measurement. |
| `zero_dwell_transition_count` | `sub_200ms_transition_count` | INT | "Zero dwell" is implicitly judgemental ("the user didn't really visit"). `sub_200ms_transition_count` is an explicit empirical threshold (transitions where the inter-pageview delta is < 200ms). The 200ms threshold is documented as the operational definition of "indistinguishable from instantaneous". |
| `dwell_ms_before_first_action` | `dwell_ms_before_first_action` (kept, but **define "action" exactly**) | INT (ms, nullable) | Field name unchanged. The contract MUST define "action" exactly as: an `accepted_events` row whose `raw->>'event_name'` is one of `cta_click`, `form_start`, or `form_submit`. No other event qualifies as "action" in v1. |

**Field-description discipline.** Every field's description in the migration comment + PR doc + schema.sql append block MUST state:

1. The exact derivation source.
2. **"Factual only — no judgement, no risk implication."**
3. **"Future scoring layers (Sprint 2 PR#5/PR#6) may consume this field as input, but PR#1 does not score it."**

This pattern matches PR#11's session_features field comments and prevents downstream readers from misinterpreting factual aggregates as scored signals.

---

## §6 Source-table choice (Codex-approved)

**Recommendation: read from `accepted_events` directly.** Use `session_features` only for **optional invariant comparison** (verification SQL §M), never as a primary input.

Rationale:

- `session_features` may be stale (extractor runs are async; behavioural extraction must not inherit that staleness).
- `session_features` lacks the per-event ordering needed for behavioural derivation (`session_events` ranked by `received_at`, `event_id`).
- Behavioural extraction should not inherit `session_features` aggregation bugs (if any future bug is found there, PR#1 isolation prevents propagation).
- A0 §I.2 K-α current state: AMS reads `accepted_events` directly; PR#1 follows the same source-table-of-record pattern.

**Filters (locked, identical to PR#11):**

- `event_contract_version = 'event-contract-v0.1'`
- `event_origin = 'browser'`
- `workspace_id IS NOT NULL AND site_id IS NOT NULL`
- `session_id IS NOT NULL AND session_id <> '__server__'`

PR#1 does **not** modify `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, or `session_features`. It only reads from `accepted_events`.

---

## §7 Proposed schema

```sql
-- migrations/009_session_behavioural_features.sql
-- Sprint 2 PR#1 — derived factual layer: behavioural features v0.2
-- Additive only. CREATE TABLE / INDEX IF NOT EXISTS. No FK. No DDL on
-- existing tables. Read-only against accepted_events at extract time.

CREATE TABLE IF NOT EXISTS session_behavioural_features_v0_2 (
  behavioural_features_id           BIGSERIAL PRIMARY KEY,

  -- Boundary (mirrors session_features)
  workspace_id                      TEXT        NOT NULL,
  site_id                           TEXT        NOT NULL,
  session_id                        TEXT        NOT NULL,

  -- Versioning + provenance
  feature_version                   TEXT        NOT NULL,
  extracted_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Session endpoints (re-derived from accepted_events; compared to
  -- session_features in invariant SQL but NOT taken from there)
  first_seen_at                     TIMESTAMPTZ,
  last_seen_at                      TIMESTAMPTZ,
  source_event_count                INT         NOT NULL,
  source_event_id_min               BIGINT,
  source_event_id_max               BIGINT,
  first_event_id                    BIGINT,
  last_event_id                     BIGINT,

  -- 8 Stage-1-shaped factual fields (Sprint 2 PR#5/PR#6 may consume;
  -- PR#1 does NOT score them).
  ms_from_consent_to_first_cta              INT,                    -- ms; NULL when no consent event or no CTA in session
  dwell_ms_before_first_action              INT,                    -- ms; NULL when no first-action observable; "action" = event_name IN ('cta_click','form_start','form_submit')
  first_form_start_precedes_first_cta       BOOLEAN,                -- NULL when no form_start in session; TRUE iff first form_start.received_at < first cta_click.received_at
  form_start_count_before_first_cta         INT,                    -- 0 when no form_start before first cta; NULL when no cta in session
  has_form_submit_without_prior_form_start  BOOLEAN     NOT NULL DEFAULT FALSE, -- TRUE iff at least one form_submit precedes any form_start
  form_submit_count_before_first_form_start INT         NOT NULL DEFAULT 0,
  ms_between_pageviews_p50                  INT,                    -- median inter-pageview delta in ms; NULL when fewer than 2 page_view events
  pageview_burst_count_10s                  INT         NOT NULL DEFAULT 0,
  max_events_per_second                     INT         NOT NULL DEFAULT 0,
  sub_200ms_transition_count                INT         NOT NULL DEFAULT 0,    -- pageviews where inter-pageview delta < 200ms (explicit threshold)
  interaction_density_bucket                TEXT,                              -- enum bucket: '0' / '1-2' / '3-5' / '6-10' / '>10' — see §10 on CHECK constraints
  scroll_depth_bucket_before_first_cta      TEXT,                              -- enum bucket: '0' / '1-25' / '26-50' / '51-75' / '76-100' — NULL when not extractable (open decision D-5)

  -- Refresh-loop: deferred to Sprint 2 PR#2. See §4.
  -- (Column omitted in default schema. If Helen approves D-3 Option β,
  --  add: refresh_loop_candidate BOOLEAN, populated as NULL in v0.2.)

  -- Provenance / sparsity metadata
  valid_feature_count               INT         NOT NULL DEFAULT 0,  -- 0..N: count of Stage-1-shaped fields that are non-null and type-valid
  missing_feature_count             INT         NOT NULL DEFAULT 0,  -- N - valid_feature_count, where N is the documented expected count for v0.2
  feature_presence_map              JSONB       NOT NULL DEFAULT '{}'::jsonb,
    -- Per-field presence: { "<field>": "present" | "missing" | "not_extractable" }
  feature_source_map                JSONB       NOT NULL DEFAULT '{}'::jsonb,
    -- Per-field derivation source: { "<field>": "server_derived" | "deferred_to_pr2" | … }

  CONSTRAINT session_behavioural_features_v0_2_natural_key UNIQUE
    (workspace_id, site_id, session_id, feature_version)
);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_workspace_site
  ON session_behavioural_features_v0_2 (workspace_id, site_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_session
  ON session_behavioural_features_v0_2 (workspace_id, site_id, session_id);

CREATE INDEX IF NOT EXISTS session_behavioural_features_v0_2_version
  ON session_behavioural_features_v0_2 (feature_version, extracted_at DESC);
```

### Field-by-field derivation table

| Field | Type | Derivation | Why factual (not scoring) | Future-PR consumer |
|---|---|---|---|---|
| `ms_from_consent_to_first_cta` | INT (ms) | `accepted_events` ordered by `received_at`: most recent consent-establishing event before first cta_click → first cta_click.received_at delta in ms | A duration measurement. No claim that fast or slow CTA is good or bad. | Stage 1 (PR#6) input |
| `dwell_ms_before_first_action` | INT (ms) | First page_view.received_at → first event whose `raw->>'event_name'` IN `('cta_click','form_start','form_submit')` delta in ms | A duration measurement. "Action" explicitly defined; no other event qualifies. | Stage 1 (PR#6) input |
| `first_form_start_precedes_first_cta` | BOOLEAN | TRUE iff `min(form_start.received_at) < min(cta_click.received_at)` for the session; NULL when no form_start in session | Temporal order observation. No interpretation. | Stage 1 (PR#6) input |
| `form_start_count_before_first_cta` | INT | Count of form_start events with `received_at < min(cta_click.received_at)`; NULL when no cta_click | Count. | Stage 1 (PR#6) input |
| `has_form_submit_without_prior_form_start` | BOOLEAN | TRUE iff any form_submit event has `received_at < min(form_start.received_at)` OR the session has form_submit but no form_start | Order observation. The `has_` prefix marks it as a "did this pattern appear?" observation. | Stage 1 (PR#6) input |
| `form_submit_count_before_first_form_start` | INT | Count. 0 when no anomaly. | Count. | Stage 1 (PR#6) input |
| `ms_between_pageviews_p50` | INT (ms) | Median inter-pageview delta for the session; NULL when fewer than 2 page_view events | Statistical aggregate. | Stage 1 (PR#6) input |
| `pageview_burst_count_10s` | INT | Max number of page_view events in any 10-second sliding window | Count. | Stage 1 (PR#6) input |
| `max_events_per_second` | INT | Max events of any kind in any 1-second window | Count. Future Stage 0 (PR#5) "impossible-speed" rule input. | Stage 0 (PR#5) input |
| `sub_200ms_transition_count` | INT | Pageviews where inter-pageview delta < 200ms (explicit empirical threshold) | Count with documented threshold. 200ms is the explicit operational definition of "indistinguishable from instantaneous"; thresholds in PR#1 are extraction thresholds, not scoring thresholds. | Stage 1 (PR#6) input |
| `interaction_density_bucket` | TEXT (enum or NULL) | `(cta_click_count + form_start_count + form_submit_count)` bucketised: 0 / 1-2 / 3-5 / 6-10 / >10 | Enum bucket. | Stage 1 (PR#6) input |
| `scroll_depth_bucket_before_first_cta` | TEXT (enum or NULL) | Max `raw->>'scroll_depth_pct'` (if SDK emits it) bucketised: 0 / 1-25 / 26-50 / 51-75 / 76-100. **NULL when SDK does not emit scroll events** (v1 state). | Enum bucket. Open decision D-5: include or defer. | Stage 1 (PR#6) input |
| `valid_feature_count` / `missing_feature_count` | INT / INT | Count of Stage-1-shaped fields present/missing. The expected total (`valid + missing`) is fixed per `feature_version` and documented as `EXPECTED_FEATURE_COUNT_BY_VERSION = { 'behavioural-features-v0.2': N }` in the extractor. | Provenance metadata. Sparseness gate for Stage 1 (≥ 3 valid). | Stage 1 (PR#6) input |
| `feature_presence_map` | JSONB | `{ "<field_name>": "present"\|"missing"\|"not_extractable" }` for every Stage-1-shaped field | Provenance JSONB. | Stage 1 (PR#6) input |
| `feature_source_map` | JSONB | `{ "<field_name>": "server_derived"\|"deferred_to_pr2"\|… }` | Provenance JSONB. | Stage 1 (PR#6) input |

**Hard rule on field semantics.** Every column above is a count, duration (ms), boolean temporal-order observation, enum bucket, or provenance metadata. **No `score`, `risk`, `classification`, `confidence`, `recommend`, `bot`, `agent`, `human`, `lead`, `crm`, `enrich`, `verified`, `confirmed`, `intent_score`, `buyer_score`** field exists or may be added in PR#1.

---

## §8 What PR#1 explicitly does NOT include in the schema

The following names are **forbidden columns** for PR#1. The implementation pure tests sweep both the migration SQL and the extractor source for these strings:

- `risk_score`, `score`, `risk`
- `classification`, `recommended_action`, `confidence_band`, `confidence`
- `is_bot`, `is_agent`, `ai_agent`, `is_human`, `is_real_buyer`, `is_fraud`, `is_ai`
- `buyer`, `intent`, `lead_quality`, `lead_score`
- `crm`, `company_enrich`, `ip_enrich`, `enrich`
- `reason_code` (as a column name; the file-level reason-code list lives in `scoring/reason_code_dictionary.yml`, not here)
- `verified`, `confirmed`, `certain`, `detected`, `identified` — these are reserved per `scoring/forbidden_codes.yml` `hard_blocked_code_patterns.patterns` for reason codes; PR#1 does not emit reason codes but the pattern sweep verifies they don't appear as column names either, with one exception: schema field names like `verification_method_strength` (defined in `signal-truth-v0.1.md`) are allowed per CF-2 (`forbidden_codes.yml` `hard_blocked_code_patterns.applies_to: emitted_reason_codes_only`).

---

## §9 Extraction semantics

**Pattern: identical to `scripts/extract-session-features.ts` (PR#11).**

### Environment contract

| Env var | Required | Default | Meaning |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres URL; never printed |
| `WORKSPACE_ID` | no | (no filter) | Optional workspace filter |
| `SITE_ID` | no | (no filter) | Optional site filter |
| `SINCE_HOURS` | no | `168` | Candidate window in hours (7 days) |
| `SINCE` | no | — | ISO timestamp; overrides `SINCE_HOURS` lower bound |
| `UNTIL` | no | (NOW) | ISO timestamp; overrides upper bound |
| `FEATURE_VERSION` | no | `behavioural-features-v0.2` | Versioned natural-key component |

### Candidate-window vs full-session aggregation (locked from PR#11)

- The window (`SINCE_HOURS`, default 168h) selects **candidate sessions** — sessions with at least one `accepted_events` row whose `received_at` falls in the window.
- Aggregation then runs over **all `accepted_events` rows for those candidate sessions**, regardless of `received_at`. This prevents a narrow rerun from overwriting full-session facts with partial-window facts.
- This is identical to PR#11 and verified in PR#11's DB tests.

### Idempotent upsert

```sql
INSERT INTO session_behavioural_features_v0_2 (…)
SELECT … FROM <CTE pipeline> …
ON CONFLICT (workspace_id, site_id, session_id, feature_version)
DO UPDATE SET
  -- every non-PK column refreshed from EXCLUDED
  …
RETURNING behavioural_features_id, workspace_id, site_id, session_id;
```

Re-runs refresh the same row; `behavioural_features_id` (BIGSERIAL) is stable.

### Single-SQL pipeline shape

CTE structure (draft; final SQL will be reviewed in implementation PR):

```
candidate_sessions                 — sessions touched in window
  → session_events                 — ALL v1 browser events for those sessions
    → consent_landmarks            — most-recent consent event before first cta per session
    → first_cta_per_session
    → first_action_per_session     — first cta_click/form_start/form_submit
    → first_form_start_per_session
    → ordered_pageviews            — for p50 delta, 10s burst, sub-200ms transition, max events/sec
    → order_anomalies              — form_start before first cta, form_submit before first form_start
    → density_buckets              — interaction_density_bucket
    → presence_provenance          — feature_presence_map, feature_source_map, valid_feature_count, missing_feature_count
    → feature_aggs                 — UNION of all per-session feature rows
  → INSERT … ON CONFLICT DO UPDATE
```

### Hard boundaries

- ❌ MUST NOT mutate `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features`
- ❌ MUST NOT select `token_hash`, peppers, raw bearer tokens, IP addresses, or `user_agent` (no v0.2 field requires UA; UA-taxonomy belongs to a separate PR — see D-6)
- ❌ MUST NOT make HTTP calls (Hard Rule G in signal-truth-v0.1 §10)
- ❌ MUST NOT import ML libraries (Hard Rule F)
- ❌ MUST NOT emit reason codes (PR#1 is not a scorer)
- ✅ Pure-function SQL pipeline; single transaction-friendly statement

---

## §10 CHECK constraint caution

**Codex correction.** Hard CHECK constraints on evolving bucket enums (`interaction_density_bucket`, `scroll_depth_bucket_before_first_cta`) may freeze values too aggressively and force a column migration when v0.3 bucket boundaries change.

**Revised recommendation.**

- **Do NOT** apply `CHECK (interaction_density_bucket IN (…))` or `CHECK (scroll_depth_bucket_before_first_cta IN (…))` in the migration.
- **Use invariant SQL (verification §M) to assert bucket validity** in operator tooling. Bucket validity changes via a new `feature_version` value, not a column migration.
- **Do** apply minimal CHECK constraints on numeric non-negativity if useful — e.g. `CHECK (source_event_count >= 0)`, `CHECK (valid_feature_count >= 0)`, `CHECK (missing_feature_count >= 0)`, `CHECK (sub_200ms_transition_count >= 0)`, `CHECK (pageview_burst_count_10s >= 0)`, `CHECK (max_events_per_second >= 0)`, `CHECK (form_submit_count_before_first_form_start >= 0)`. These won't constrain future bucket evolution.
- If a future `feature_version` (v0.3+) needs additional bucket values or new columns, the upgrade path is: (a) emit rows with the new `feature_version` value; (b) a future migration may add new columns/tables. No backfill is required because `feature_version` is part of the natural key.

**Documentation requirement.** The PR doc must state: *"Bucket enums (`interaction_density_bucket`, `scroll_depth_bucket_before_first_cta`) are validated by invariant SQL, not by DB CHECK constraint. Future `feature_version` values may introduce new bucket boundaries without a column-level migration."*

---

## §11 Privacy / non-scoring boundary (carried forward from PR#11/PR#12)

| Rule | PR#1 application |
|---|---|
| No full URL rendering in future observation | When PR#1's observation extension lands (later PR), it renders paths-only. PR#1 itself produces no observation report. |
| Paths only where possible | Future observation queries use `raw->>'page_path'` and never `raw->>'page_url'`. PR#1 does not duplicate URL/path columns in the schema (those live on `session_features`). |
| No raw payload exposure | `feature_presence_map` / `feature_source_map` contain only field-presence labels (`"present"` / `"missing"` / `"not_extractable"` / `"server_derived"` / `"deferred_to_pr2"`) — never raw event payload contents. |
| No `token_hash` / `ip_hash` / `user_agent` | None of these are referenced in the extraction SQL or test fixtures. |
| No QA / bot / synthetic labels in production payloads | PR#1 vendors zero Track A code. No `KNOWN_BOT_UA_FAMILIES`, no Stage 0 lib, no Stage 1 lib import. |
| Track A labels remain local / prototype | Same as above. |
| Feature extraction creates no customer-facing claims | PR#1 produces a derived-factual table consumed only by future Sprint 2 scoring PRs (PR#5, PR#6) — never read by customer-facing API. |

---

## §12 Forbidden-code sweep test plan (CF-2 compliant)

Implementation tests MUST read `scoring/forbidden_codes.yml` via the new `.patterns` shape (per Sprint 2 PR#0 CF-2):

```yaml
hard_blocked_code_patterns:
  applies_to: emitted_reason_codes_only
  note: …
  patterns:
    - "^A_REAL_BUYER_.*"
    - "^REAL_BUYER_.*"
    - "^BUYER_.*"
    - "^INTENT_.*"
    - ".*_CONFIRMED$"
    - ".*_VERIFIED$"
    - ".*_CERTAIN$"
    - ".*_DETECTED$"
    - ".*_IDENTIFIED$"

string_patterns_blocked_in_code:
  applies_to: source_code_strings_only
  note: …
  patterns:
    - fraud_confirmed
    - bot_confirmed
    - ai_detected
    - intent_verified
    - buyer_verified
    - real_buyer_verified
    - is_real_buyer
    - is_bot
    - is_ai
    - is_fraud
    - is_human
    - human_score
    - bot_score
    - buyer_score
    - fraud_score
    - intent_score
    - "import sklearn"
    - "from sklearn"
    - "import xgboost"
    - "from xgboost"
    - "import torch"
    - "from torch"
    - "import onnx"
    - "from onnx"
    - "import lightgbm"
    - "from lightgbm"
```

### Sweep rules

1. **`hard_blocked_code_patterns.patterns`** apply to **emitted reason-code strings only**. PR#1 emits no reason codes, so this list is a tripwire: if any future PR#1 string output starts to look like a reason code matching one of these patterns, the test fails.
2. **`string_patterns_blocked_in_code.patterns`** apply to **source-code strings** (field names, variable names, string literals) in PR#1's TypeScript files + SQL migration. The test reads each pattern from the YAML and asserts no match in the implementation files.
3. **Schema field names like `verification_method_strength` (defined in `signal-truth-v0.1.md`) are allowed.** CF-2 explicitly carves these out of `hard_blocked_code_patterns`. The test that sweeps source code must NOT block such schema names — only the emitted-reason-code regex applies them.
4. **The forbidden-code list is the source of truth.** PR#1's pure tests load the YAML at test time, parse the two `.patterns` arrays, and apply them programmatically. Tests do not hard-code the forbidden strings in their own source (that would diverge from the YAML over time).

---

## §13 Expected files

| File | Status | Reason |
|---|---|---|
| `migrations/009_session_behavioural_features.sql` | **new** | Additive `CREATE TABLE IF NOT EXISTS` + 3 `CREATE INDEX IF NOT EXISTS`. No FK. No DDL on existing tables. Minimal non-negativity CHECK constraints (per §10). |
| `src/db/schema.sql` | **modified (append-only block)** | Add the new table block at the end, matching PR#11's append pattern. No edits to existing blocks. |
| `scripts/extract-behavioural-features.ts` | **new** | Idempotent extractor. Exports `parseOptionsFromEnv`, `EXTRACTION_SQL`, `runExtraction` (matches PR#11's exported surface for testability). |
| `package.json` | **modified (one line)** | Add `"extract:behavioural-features": "tsx scripts/extract-behavioural-features.ts"` to `scripts`. |
| `tests/v1/behavioural-features-extraction.test.ts` | **new** | Pure tests (no DB). |
| `tests/v1/db/behavioural-features.dbtest.ts` | **new** (opt-in via `vitest.db.config.ts`) | DB integration tests. |
| `docs/sprint2-pr1-behavioural-features-v0.2.md` | **new** | Implementation PR doc (separate from this planning doc). |
| `docs/sql/verification/08_behavioural_features_invariants.sql` | **new** | Read-only operator SQL with `to_regclass` presence guards. |

### Files that MUST NOT change

- `src/collector/v1/**` — collector route, orchestrator, persistence, row-builders, validation, auth, normalised-envelope, hash, canonical, stable-json, payload-hash, dedupe, pii, consent, boundary, reason-codes, stage-map, types
- `src/app.ts`, `src/server.ts`, `src/auth/**`
- `migrations/001 … 008` — frozen
- `scripts/extract-session-features.ts` — frozen unless a true bug is found and fixed in a **separate** PR
- `scripts/collector-observation-report.ts`, `scripts/observation-session-features.ts` — PR#9/PR#12 helpers, frozen
- `render.yaml`, `Dockerfile` — frozen
- `docs/contracts/signal-truth-v0.1.md` — frozen per Sprint 2 PR#0
- `scoring/reason_code_dictionary.yml`, `scoring/forbidden_codes.yml`, `scoring/version.yml`, `scoring/README.md` — frozen per Sprint 2 PR#0
- `docs/architecture/ARCHITECTURE_GATE_A0.md` — frozen per Helen sign-off at `a87eb05`

### Repos that MUST NOT be touched

- `/Users/admin/github/keigentechnologies/AMS`
- `/Users/admin/github/ams-qa-behaviour-tests`
- Any frontend / GTM / GA4 / LinkedIn / ThinSDK repo

---

## §14 Test plan

### Pure tests (`tests/v1/behavioural-features-extraction.test.ts`)

**Static scope tests** (no source modification of forbidden surfaces):

- assert `src/collector/v1/**` is unchanged in this PR (via `fs.statSync(...).mtimeMs` snapshot or `git diff` introspection at CI time)
- assert no `src/app.ts` / `src/server.ts` / `src/auth/**` modification
- assert no Track A import: extractor source contains no `ams-qa-behaviour-tests` string and no `require('…/stage0…')` / `require('…/stage1…')`
- assert no Core AMS import: no `keigentechnologies/AMS` string in PR#1 sources
- assert no `render.yaml` / `Dockerfile` / frontend / SDK change

**Forbidden-term tests** (loaded from `scoring/forbidden_codes.yml`):

- read the YAML via the operator's chosen YAML parser (per Codex review: Ruby works; Node + Python parsers may be unavailable in CI — implementation PR will pick one)
- parse `string_patterns_blocked_in_code.patterns`
- for each pattern, sweep `migrations/009_session_behavioural_features.sql`, `scripts/extract-behavioural-features.ts`, the schema append block, and the new test file itself for a match
- expected: zero matches (except inside the YAML loader code which references pattern names as data, never as literal field names)
- a controlled test fixture verifies the schema name `verification_method_strength` is **not** flagged by `hard_blocked_code_patterns.patterns` when those patterns are scoped to emitted-reason-code strings (CF-2 carve-out)

**Env parsing tests** (~6):

- defaults: `SINCE_HOURS=168`, `FEATURE_VERSION='behavioural-features-v0.2'`
- `SINCE` ISO parsing
- `UNTIL` ISO parsing
- `SINCE` overrides `SINCE_HOURS`
- invalid `SINCE_HOURS` → fail
- `window_start >= window_end` → fail
- `WORKSPACE_ID` / `SITE_ID` filters → null/string handling

**SQL string sweep tests** (~10):

- SQL contains `event_contract_version = 'event-contract-v0.1'`
- SQL contains `event_origin = 'browser'`
- SQL excludes `session_id = '__server__'`
- SQL is idempotent: contains `ON CONFLICT (workspace_id, site_id, session_id, feature_version)` and `DO UPDATE`
- SQL has no source-table mutation: no `UPDATE accepted_events`, `DELETE FROM accepted_events`, `INSERT INTO accepted_events`, `TRUNCATE`, `DROP`, `ALTER` of source tables
- SQL never selects `token_hash`, `ip_hash`, `user_agent`
- SQL filters on `workspace_id IS NOT NULL` and `site_id IS NOT NULL`
- SQL writes only to `session_behavioural_features_v0_2` (not `session_features`, not Lane A/B)
- SQL contains no string matching `hard_blocked_code_patterns.patterns` as a reason-code-shaped literal

**Feature derivation helper tests** (~10):

- `bucketiseScrollDepth(pct)` → expected enum bucket string or NULL
- `bucketiseInteractionDensity(n)` → expected enum bucket string
- `computeFeaturePresenceMap(row)` → JSONB shape with expected keys
- `countValidFeatures(map)` → non-negative integer
- `computeFeatureSourceMap(row, opts)` → JSONB shape with derivation labels
- `defineActionEvents()` returns exactly `['cta_click','form_start','form_submit']` (no other event qualifies as "action")
- `firstFormStartPrecedesFirstCta` returns NULL when no form_start present
- `subTwoHundredMsTransitionCount` uses exactly 200ms threshold

### DB tests (`tests/v1/db/behavioural-features.dbtest.ts`)

**Candidate-window / full-session aggregation:**
- event outside the window but for a candidate session is still counted in feature aggregation
- session with no events in the window is NOT a candidate; no row produced

**Cross-isolation tests:**
- cross-workspace isolation: same `session_id` in two workspaces produces 2 distinct rows
- cross-site isolation: same `session_id` under two different `site_id` values within the same workspace produces 2 distinct rows (sites do not merge)

**Idempotency tests:**
- run extractor twice with the same window → row count stable; `behavioural_features_id` stable; `extracted_at` updates
- late event arrives, rerun → updated row, same `behavioural_features_id`

**Source-table untouched:**
- snapshot row counts of `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features` before extraction
- run extractor
- assert all five source-table counts unchanged

**Null / missing evidence preservation:**
- session with no consent event → `ms_from_consent_to_first_cta IS NULL`, `feature_presence_map.ms_from_consent_to_first_cta = "missing"`
- session with no form events → `first_form_start_precedes_first_cta IS NULL`, `form_start_count_before_first_cta IS NULL`
- `feature_presence_map` is JSONB object with the expected key set
- `feature_source_map` is JSONB object

**Order-anomaly tests:**
- cta-after-pageview session → `dwell_ms_before_first_action` non-null
- immediate cta (<1000ms after consent) → `ms_from_consent_to_first_cta` < 1000
- form_submit without prior form_start → `has_form_submit_without_prior_form_start = TRUE`

**No scoring columns present:**
- query `information_schema.columns` for `session_behavioural_features_v0_2`
- assert column names contain none of: `score`, `risk`, `classification`, `recommended`, `confidence`, `is_bot`, `is_agent`, `ai_agent`, `buyer_intent`, `lead_quality`

**If refresh-loop included (only under D-3 Option β):**
- `refresh_loop_candidate IS NULL` for every row in v0.2 (placeholder only)
- `feature_source_map.refresh_loop_candidate = "deferred_to_pr2"` for every row
- no threshold edge tests in PR#1 (those land in PR#2)

**Total: ~50 pure tests + ~18 DB tests (DB tests opt-in via `vitest.db.config.ts`, matching PR#11 pattern).**

---

## §15 Verification SQL plan (`docs/sql/verification/08_behavioural_features_invariants.sql`)

All read-only. **Every query gated by `to_regclass('public.session_behavioural_features_v0_2')` presence check** so the file does not fail when run before migration 009 is applied.

```sql
-- 0. Presence guard
SELECT to_regclass('public.session_behavioural_features_v0_2') AS regclass;
-- Subsequent queries are operator-skipped if regclass IS NULL.

-- 1. Natural-key duplicate check
SELECT workspace_id, site_id, session_id, feature_version, COUNT(*)
  FROM session_behavioural_features_v0_2
 GROUP BY workspace_id, site_id, session_id, feature_version
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 2. valid + missing = expected feature count for this version
-- (Documented constant per feature_version; e.g. for behavioural-features-v0.2
--  the expected total is the number of Stage-1-shaped fields tracked in
--  feature_presence_map for v0.2. Operator substitutes the literal value.)
SELECT workspace_id, session_id, valid_feature_count, missing_feature_count,
       valid_feature_count + missing_feature_count AS total
  FROM session_behavioural_features_v0_2
 WHERE valid_feature_count + missing_feature_count
       <> <EXPECTED_FEATURE_COUNT_FOR_VERSION>;
-- Expected: 0 rows

-- 3. last_seen_at >= first_seen_at (duration non-negative)
SELECT workspace_id, session_id, first_seen_at, last_seen_at
  FROM session_behavioural_features_v0_2
 WHERE last_seen_at IS NOT NULL
   AND first_seen_at IS NOT NULL
   AND last_seen_at < first_seen_at;
-- Expected: 0 rows

-- 4. Bucket enum validity (invariant SQL, NOT a DB CHECK)
SELECT workspace_id, session_id, interaction_density_bucket
  FROM session_behavioural_features_v0_2
 WHERE interaction_density_bucket IS NOT NULL
   AND interaction_density_bucket NOT IN ('0','1-2','3-5','6-10','>10');
-- Expected: 0 rows

SELECT workspace_id, session_id, scroll_depth_bucket_before_first_cta
  FROM session_behavioural_features_v0_2
 WHERE scroll_depth_bucket_before_first_cta IS NOT NULL
   AND scroll_depth_bucket_before_first_cta NOT IN
       ('0','1-25','26-50','51-75','76-100');
-- Expected: 0 rows

-- 5. Boolean / count consistency
SELECT workspace_id, session_id,
       has_form_submit_without_prior_form_start,
       form_submit_count_before_first_form_start
  FROM session_behavioural_features_v0_2
 WHERE (has_form_submit_without_prior_form_start = TRUE
        AND form_submit_count_before_first_form_start = 0)
    OR (has_form_submit_without_prior_form_start = FALSE
        AND form_submit_count_before_first_form_start > 0);
-- Expected: 0 rows

-- 6. Cross-table source_event_count matches accepted_events full-session count
SELECT sbf.workspace_id, sbf.session_id,
       sbf.source_event_count AS sbf_count,
       (SELECT COUNT(*)::int
          FROM accepted_events ae
         WHERE ae.workspace_id = sbf.workspace_id
           AND ae.site_id      = sbf.site_id
           AND ae.session_id   = sbf.session_id
           AND ae.event_contract_version = 'event-contract-v0.1'
           AND ae.event_origin = 'browser'
           AND ae.session_id  <> '__server__') AS ae_count
  FROM session_behavioural_features_v0_2 sbf
 WHERE sbf.workspace_id    = '<WORKSPACE_ID>'
   AND sbf.site_id         = '<SITE_ID>'
   AND sbf.feature_version = 'behavioural-features-v0.2'
   AND sbf.source_event_count <> (
         SELECT COUNT(*)::int FROM accepted_events ae
          WHERE ae.workspace_id = sbf.workspace_id
            AND ae.site_id      = sbf.site_id
            AND ae.session_id   = sbf.session_id
            AND ae.event_contract_version = 'event-contract-v0.1'
            AND ae.event_origin = 'browser'
            AND ae.session_id  <> '__server__');
-- Expected: 0 rows (candidate-window / full-session invariant)

-- 7. feature_presence_map / feature_source_map are JSONB objects
SELECT workspace_id, session_id, jsonb_typeof(feature_presence_map) AS pmap,
       jsonb_typeof(feature_source_map) AS smap
  FROM session_behavioural_features_v0_2
 WHERE jsonb_typeof(feature_presence_map) <> 'object'
    OR jsonb_typeof(feature_source_map)   <> 'object';
-- Expected: 0 rows

-- 8. Non-negative counts
SELECT workspace_id, session_id
  FROM session_behavioural_features_v0_2
 WHERE source_event_count < 0
    OR valid_feature_count < 0
    OR missing_feature_count < 0
    OR pageview_burst_count_10s < 0
    OR max_events_per_second < 0
    OR sub_200ms_transition_count < 0
    OR form_submit_count_before_first_form_start < 0
    OR (form_start_count_before_first_cta IS NOT NULL
        AND form_start_count_before_first_cta < 0);
-- Expected: 0 rows

-- 9. No scoring/judgement columns present
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'session_behavioural_features_v0_2'
   AND column_name ~ '(score|risk|classification|recommend|confidence|is_bot|is_agent|ai_agent|buyer_intent|lead_quality|verified|confirmed)';
-- Expected: 0 rows

-- 10. Latest 20 rows for human inspection (one boundary)
SELECT session_id, first_seen_at, last_seen_at, source_event_count,
       ms_from_consent_to_first_cta, dwell_ms_before_first_action,
       first_form_start_precedes_first_cta,
       form_start_count_before_first_cta,
       has_form_submit_without_prior_form_start,
       form_submit_count_before_first_form_start,
       ms_between_pageviews_p50, pageview_burst_count_10s,
       max_events_per_second, sub_200ms_transition_count,
       interaction_density_bucket, scroll_depth_bucket_before_first_cta,
       valid_feature_count, missing_feature_count
  FROM session_behavioural_features_v0_2
 WHERE workspace_id    = '<WORKSPACE_ID>'
   AND site_id         = '<SITE_ID>'
   AND feature_version = 'behavioural-features-v0.2'
 ORDER BY last_seen_at DESC
 LIMIT 20;
```

**Operator notes** (will be embedded in the SQL file as comments):

- Each query is a separate statement. Operator runs them individually. Query 0 (`to_regclass`) is the presence gate; if it returns NULL, queries 1–10 are skipped (the table does not exist yet).
- All queries are read-only `SELECT`.
- Run against a **staging mirror** (not Render production) per A0 P-4 (still blocking).

---

## §16 Migration / SQL safety — rollback (no CASCADE)

**Codex correction.** Earlier draft used `DROP TABLE … CASCADE`. CASCADE is too aggressive — it would silently drop any future foreign-key-referencing object. Use explicit, non-CASCADE drops.

**Rollback procedure:**

```sql
-- Drop the table. No FK references exist in v0.2 (PR#1 introduces no FK).
-- Indexes are dropped automatically when the table is dropped.
DROP TABLE IF EXISTS session_behavioural_features_v0_2;
```

If, in a future PR, indexes are separately named in a way that requires explicit drop (e.g. migration 010 adds an additional index outside the table-drop scope), rollback for that future migration must explicitly `DROP INDEX IF EXISTS …` before `DROP TABLE` — but no such case exists in PR#1.

**Rollback steps:**

1. Revert PR#1 commit (or merge the revert commit).
2. Run: `DROP TABLE IF EXISTS session_behavioural_features_v0_2;` against staging.
3. Revert the `src/db/schema.sql` append block.
4. Revert `package.json` to remove the `extract:behavioural-features` script entry.
5. Delete the extractor script, tests, doc, and verification SQL (revert removes them).

**No raw-evidence rollback needed.** `accepted_events`, `rejected_events`, `ingest_requests`, `site_write_tokens`, `session_features` are untouched.

**No collector-route rollback needed.** v1 collector routes are unchanged.

**No production rollback needed.** PR#1 never touches Render production (Hetzner staging only, per P-4 still blocking).

---

## §17 Runtime proof plan

### Local-only

1. `npx tsc --noEmit` — clean
2. `unset TEST_DATABASE_URL; npm test` — 1677/1677 + new pure tests (~50)
3. Apply migration 009 to local test DB: `psql "$TEST_DATABASE_URL" -f migrations/009_session_behavioural_features.sql`
4. `npm run test:db:v1` — include new ~18 DB tests
5. Run extractor against local DB with `WORKSPACE_ID=buyerrecon_smoke_ws SITE_ID=buyerrecon_com SINCE_HOURS=720`
6. Run `08_behavioural_features_invariants.sql` queries against local DB
7. Rerun extractor for idempotency
8. Verify source-table row counts unchanged

### Hetzner staging proof (Helen-operated, after Codex review)

1. `git pull` PR#1 branch on Hetzner
2. Apply migration 009 via P-4 approved ops mechanism (operator workstation)
3. Run extractor against `buyerrecon_smoke_ws` / `buyerrecon_com`
4. Verify expected ~8 rows (matching PR#11's staging proof)
5. Run invariant SQL (file 08); expect all queries return 0 rows except the latest-20 inspection query
6. Rerun extractor; confirm idempotency
7. Source-table row counts unchanged
8. `observe:collector` still PASS

**No Render production work. No production DB connection. No live SDK rollout.** Per A0 P-4 (still blocking) and A0 §H.5.

---

## §18 Open decisions (blocking before implementation)

| ID | Decision | Default | Status |
|---|---|---|---|
| **D-1** | Table name | **`session_behavioural_features_v0_2`** | Codex-adopted default |
| **D-2** | `feature_version` string | **`behavioural-features-v0.2`** | Codex-adopted default |
| **D-3** | May PR#1 absorb A0 PR#2 refresh-loop server-side derivation? | **No — PR#1 omits refresh-loop; PR#2 adds it.** Option β (placeholder `refresh_loop_candidate BOOLEAN NULL`) only if Helen explicitly approves. | Codex-adopted default; blocking decision |
| **D-4** | SDK refresh-loop boolean treatment | **Ignore as truth. If captured at all, only as provenance — never override server-derived.** PR#1 doesn't derive refresh-loop, so this defaults to "not applicable in PR#1". | Codex-adopted default |
| **D-5** | `scroll_depth_bucket_before_first_cta` — include nullable / defer? | **Include nullable / `not_extractable` only if low-cost.** Otherwise defer to a later PR when SDK emits scroll events. The schema entry above includes the column nullable; Helen may opt to remove it from v0.2 and add it in v0.3. | Helen-binary; non-blocking but recommended decision |
| **D-6** | UA-derived crawler / AI-agent taxonomy (Bytespider, GPTBot, etc) | **Defer to Lane B / crawler taxonomy PR (Sprint 2 PR#5).** Not PR#1's job. | Codex-adopted default; aligns with A0 P-11 |
| **D-7** | `interaction_density_bucket` — include or defer? | **Include** if deterministic and factual (it is: simple count + bucketise). | Codex-adopted default |
| **D-8** | DB tests scope | **Required: pure tests + opt-in DB tests via `vitest.db.config.ts`** (matches PR#11 pattern). | Codex-adopted default |

**All 8 decisions must be resolved in writing per A0 §0.7 before implementation begins.** Defaults reflect Codex review recommendations. Helen may accept all defaults with a single sign-off, or override individual decisions before implementation.

---

## §19 Go / no-go recommendation

**GO for implementation, contingent on Helen sign-off on D-1 through D-8.**

The plan:

- preserves the PR#11 pattern exactly (idempotent SQL pipeline, candidate-window/full-session aggregation, no source-table mutation, no token/secret access)
- adopts Codex's risk-label-neutralisation field renames (`form_start_count_before_first_cta` etc) without losing factual content
- defers refresh-loop server-side derivation to A0 PR#2 (default), preserving the planned PR boundary
- forbids reason-code emission, scoring fields, and Lane A/B output explicitly via the §1 scope statement and §12 forbidden-code sweep tests
- uses `to_regclass` presence guards in verification SQL so the file is safe to run pre-migration
- uses minimal CHECK constraints (non-negativity only) and validates bucket enums via invariant SQL, leaving room for v0.3 evolution
- replaces CASCADE rollback with explicit `DROP TABLE IF EXISTS …` (no FK references in v0.2 → safe)
- bounds privacy via inherited PR#11/PR#12 rules (no `token_hash`, no `user_agent`, no URL render in future observation, paths only)
- documents Hetzner-staging-only proof; no Render production work until P-4 is resolved

**Pre-implementation checklist** (every box must be TRUE before Sprint 2 PR#1 code is written):

- [ ] Helen signs off on this planning document per A0 §0.7
- [ ] D-1 table name confirmed: `session_behavioural_features_v0_2`
- [ ] D-2 `feature_version` confirmed: `behavioural-features-v0.2`
- [ ] D-3 refresh-loop boundary confirmed: PR#1 omits (default) OR includes placeholder per Option β (explicit approval)
- [ ] D-4 SDK refresh-loop treatment confirmed: ignore as truth
- [ ] D-5 scroll-depth column decided: nullable include OR defer to later PR
- [ ] D-6 UA-taxonomy deferred to crawler-taxonomy PR
- [ ] D-7 `interaction_density_bucket` confirmed: include
- [ ] D-8 DB tests required: pure + opt-in DB tests
- [ ] No P-4 (Render production ops) work begins; PR#1 is local + Hetzner only
- [ ] No regressions in 1677 existing tests on the implementation branch

After Helen's written sign-off, Sprint 2 PR#1 implementation may begin on a feature branch in `buyerrecon-backend`. No production impact. No collector code change. No frontend change. Pure derived-factual layer extension.

**No code was implemented for this planning revision. No files were created or modified beyond this planning document itself.**

---

**End of planning document.**

This document supersedes the prior in-chat Sprint 2 PR#1 planning report and incorporates all Codex required fixes. Awaiting Helen's review and written sign-off per A0 §0.7 before implementation begins.
