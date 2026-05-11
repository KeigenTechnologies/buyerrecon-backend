# BuyerRecon signal-truth-v0.1

| Field | Value |
|---|---|
| Status | Extension to `event-contract-v0.1` |
| Date | 2026-05-11 |
| Owner | Helen Chen, Keigen Technologies (UK) Limited |
| Sprint | Sprint 2 — Signal Truth + AI Agent Behaviour |
| Companion files | `reason_code_dictionary.yml`, `forbidden_codes.yml` |
| Promoted-to-required in | `signal-truth-v0.2` (gated on new SDK version) |

---

## 1. Purpose

BuyerRecon is an evidence-first buyer-motion verification layer. `signal-truth-v0.1` defines the additional fields, schemas, and operational rules that allow downstream feature extraction, lane separation, deterministic scoring, false-positive review, and the RECORD_ONLY harness to operate against the Sprint 1 evidence foundation **without modifying the collector or its ledger**.

This document is canonical for Sprint 2 build. Any deviation requires a `scoring_version` bump and Helen sign-off.

---

## 2. Compatibility with `event-contract-v0.1`

`signal-truth-v0.1` is a strict extension. It adds fields and downstream schemas; it does not change required fields in `event-contract-v0.1`.

| Aspect | `event-contract-v0.1` | `signal-truth-v0.1` |
|---|---|---|
| Universal required fields (`client_event_id`, `session_id`, `site_id`, `event_type`, timestamp, `event_contract_version`) | Required | Unchanged — still required |
| Legacy event types (`session_start`, `page_state`, `session_summary`) without `client_event_id` / `event_contract_version` | Accepted as `legacy-thin-v2.0` | Unchanged — still accepted |
| New extension fields (`tab_session_id`, `nav.*`, `continuity.*`, etc.) | Not defined | **Optional**, default null |
| `event_contract_version` accepted values at collector | `event-contract-v0.1`, `legacy-thin-v2.0` | Adds `signal-truth-v0.1` |
| Required SDK upgrade | No | No |

Legacy SDKs continue to work. `signal-truth-v0.1` extension fields default to null when not sent; the feature_extraction worker degrades gracefully.

Promotion of any extension field to required happens only in `signal-truth-v0.2`, gated on an explicit SDK version.

---

## 3. External naming and customer-facing copy

### 3.1 Names

| Surface | Field name | Type | Notes |
|---|---|---|---|
| Customer-facing API / report | `evidence_band` | enum: `low \| medium` | "high" intentionally absent in v1 |
| Customer-facing UI label | "Evidence signal strength" | — | Never "confidence", never "score" |
| Internal scorer + proof bundle | `verification_score` | integer 0–99 | **Never** serialised in customer-facing responses |
| Internal scorer + proof bundle | `evidence_band` | enum (same as external) | Same name, same values |

### 3.2 Canonical customer-facing copy

> Evidence signal strength shows how much observable evidence BuyerRecon found for this reason-coded pattern. It does not prove fraud, bot activity, buyer intent, or human legitimacy.

### 3.3 Band semantics

| Band | Semantics (customer-facing) |
|---|---|
| `low` | Limited evidence signal; recorded for context; no action recommended. |
| `medium` | Multiple independent evidence signals; review recommended in RECORD_ONLY mode. |
| `high` | **Not emitted in v1.** Structurally unreachable until server-side evidence ingestion is live. |

---

## 4. Sales and copy guardrails (May–June 2026 pilot phase)

### 4.1 Approved language

- "Evidence observation phase"
- "Traffic-specific calibration"
- "Reason-code calibration against your real site behaviour"
- "RECORD_ONLY evidence review"
- "BuyerRecon is learning your site's normal and abnormal behavioural baselines before recommending action."

### 4.2 Forbidden language

- "Not live yet"
- "Testing bot detection"
- "AI detects fraud"
- "We are training the model"
- Any reference to "real buyer", "buyer intent", "bot detection", "AI agent classification", or "verification" in customer-facing surfaces
- Any reproduction of internal `verification_score` integer
- Any reference to `B_*` or `OBS_*` reason codes

---

## 5. `tab_session_id` storage contract

### 5.1 Purpose

`tab_session_id` is a per-browser-tab continuity identifier used by the downstream feature_extraction worker to distinguish refresh-loop scenarios from "new session, same URL" scenarios. **It is not a fraud signal.**

### 5.2 Storage rules

`tab_session_id` may be persisted only in `sessionStorage`. Cookies and `localStorage` are forbidden as storage layers for this field.

`sessionStorage` writes are permitted only when `consent_state` is one of:

- `granted_full`
- `granted_analytics`
- `granted_functional`

`sessionStorage` writes are forbidden when `consent_state` is any of:

- `denied`
- `unknown`
- `pre_consent`
- `analytics_denied`
- `functional_denied`
- `missing`

Before qualifying consent is established:

- `tab_session_id` is held in JS memory only
- No cookie, no localStorage, no sessionStorage write
- `tab_session_storage_mechanism = memory`

### 5.3 Consent transitions

**From `denied` / `unknown` / `pre_consent` → `granted_full` / `granted_analytics` / `granted_functional`:**

- SDK may begin `sessionStorage` writes from that point forward
- Do NOT backfill prior continuity
- Set `tab_session_continuity_quality = medium` until stability is observed across at least one reload

**From granted → denied / withdrawn:**

- Stop `sessionStorage` writes immediately
- Remove stored `tab_session_id` where technically possible
- Continue memory-only `tab_session_id` if page runtime continues
- Set `tab_session_storage_mechanism = memory`
- Lower `tab_session_continuity_quality`
- NEVER emit a Lane A reason code due to storage or consent failure

### 5.4 Storage failure handling

Storage failure (`sessionStorage` blocked, quota exceeded, private mode, browser blocking, enterprise policy) is a **continuity problem**, not a fraud signal.

Permitted internal codes when storage fails:

- `OBS_STORAGE_BLOCKED`
- `OBS_TAB_CONTINUITY_LOW`

These codes cannot affect `evidence_band` or `action_recommendation`. They appear in the internal proof bundle only.

### 5.5 Fields

```yaml
tab_session_id:
  type: string
  required: false
  nullable: true

tab_session_storage_mechanism:
  values: [memory, sessionStorage, blocked, unknown]
  required: false
  semantics:
    memory: held in JS variable only (pre-consent, or sessionStorage blocked)
    sessionStorage: persisted in window.sessionStorage (post-consent only)
    blocked: browser, CMP, private mode, or quota prevents storage
    unknown: legacy SDK or detection failed

tab_session_continuity_quality:
  values: [high, medium, low, broken]
  required: false
  semantics:
    high: tab_session_id stable across reload and back/forward
    medium: tab_session_id stable across SPA nav; may break on hard reload
    low: regenerated on most page_views (memory-only)
    broken: storage failure prevented continuity entirely

storage_blocked_reason:
  values: [consent_not_given, browser_blocked, private_mode, quota_exceeded, unknown]
  required: false
  populated_when: tab_session_storage_mechanism == blocked
```

---

## 6. Schema extensions

### 6.1 `page_view` extensions

```yaml
page_view_extensions:
  nav:
    type:
      values: [navigate, reload, back_forward, prerender, unknown]
      required: false
      source: PerformanceNavigationTiming.type
    same_document:
      type: boolean
      required: false
    hash_change:
      type: boolean
      required: false
    history_change_kind:
      values: [push, replace, traverse, none, unknown]
      required: false
  continuity:
    tab_session_id: (see §5)
    tab_session_storage_mechanism: (see §5)
    tab_session_continuity_quality: (see §5)
    storage_blocked_reason: (see §5)
    page_instance_id:
      type: string
      required: false
      semantics: per-page-load unique id, regenerated on every page_view
    previous_page_view_id:
      type: string
      required: false
      nullable: true
    consecutive_same_url_views:
      type: integer
      required: false
      derivation: computed by feature_extraction worker; never sent by SDK
    consecutive_reload_count:
      type: integer
      required: false
      derivation: computed by feature_extraction worker
```

### 6.2 `page_state` extensions

```yaml
page_state_extensions:
  state:
    visibility_state:
      values: [visible, hidden, prerender, unknown]
    has_focus:
      type: boolean
    foreground_duration_ms:
      type: integer
    hidden_duration_ms:
      type: integer
    idle_ms:
      type: integer
```

### 6.3 `feature_extraction_output` (downstream worker output, never on the wire from SDK)

```yaml
feature_extraction_output:
  interaction:
    click_count: integer
    input_count: integer
    scroll_count: integer
    max_scroll_depth_pct: integer
    rage_cluster_count: integer            # captured; NO Lane A emission (see §11)
    dead_click_candidate_count: integer    # captured; NO Lane A emission (see §11)
  response:
    dom_mutation_after_click_count: integer
    network_after_click_count: integer
    js_error_count: integer
    resource_error_count: integer
  timing:
    time_to_first_interaction_ms: integer|null
    time_to_last_interaction_ms: integer|null
    time_since_last_meaningful_input_ms: integer|null
  environment:
    js_executed: boolean
    webdriver_hint: boolean                # OBS_* only
    headless_hint: boolean                 # OBS_* only
    user_agent_declared_bot_hint: boolean
```

### 6.4 `fraud_signal` — three-tier explicit

```yaml
fraud_signal:
  client_observations:
    - code: string                         # must match A_* or OBS_*
      present: boolean
      evidence_refs: [string]
  server_observations:                     # reserved; not populated in v1
    - code: string                         # must match A_*
      present: boolean
      evidence_refs: [string]
      reserved_until: signal-truth-v0.2
  observational_only_v1:                   # explicit bucket, distinct from above
    - code: string                         # must match OBS_*
      present: boolean
      evidence_refs: [string]
      contributes_to_band: false           # enforced at scorer
      can_trigger_action: false            # enforced at scorer
      customer_facing: false               # enforced at API serialiser
  verified_agent:
    is_verified_good_bot: boolean
    is_signed_agent: boolean
    verification_method:
      values: [none, reverse_dns, ip_validation, web_bot_auth, partner_allowlist]
    verification_method_strength: (see §7)
```

### 6.5 `refresh_loop` — derived feature

```yaml
refresh_loop:
  consecutive_same_url_views: integer
  consecutive_reload_count: integer
  same_url_window_ms: integer
  reload_streak_window_ms: integer
  has_meaningful_interaction_before_reload: boolean
  back_forward_count: integer
  spa_route_change_count: integer
```

### 6.6 `scoring_input` and `scoring_output`

```yaml
scoring_input:
  lane_a_invalid_traffic_features: object
  lane_b_agent_features: object
  scoring_version: string

scoring_output:
  lane:
    values: [A_INVALID_TRAFFIC, B_DECLARED_AGENT, HUMAN_UNKNOWN, REVIEW]
  evidence_band:
    values: [low, medium]                  # "high" intentionally absent in v1
  verification_score:
    type: integer
    range: [0, 99]
    customer_facing: false                 # enforced at API serialiser
  reason_codes: [string]                   # must all be A_* / B_* / REVIEW_* / OBS_*
  evidence_refs: [string]
  action_recommendation:
    values: [record_only, review]          # 'exclude' and 'allow' deferred to v1.1
  scoring_version: string
```

### 6.7 `false_positive_review`

```yaml
false_positive_review:
  review_id: string
  status:
    values: [open, confirmed_fp, confirmed_tp, needs_more_server_data, closed]
  owner: string|null
  notes: string|null
  band_at_review:
    values: [low, medium]                  # for FP-rate-by-band tracking
  reviewed_at: timestamp|null
```

---

## 7. `verification_method_strength`

```yaml
verification_method_strength:
  values: [none, weak, moderate]           # v1 emittable values
  reserved:
    strong:
      status: reserved_not_emitted_in_v1
      requires: web_bot_auth_or_equivalent_signed_agent_verification
```

Scorer startup MUST assert that no v1 rule emits `strong`. CI tests assert the same. Any code path attempting to emit `strong` fails the scoring rule load step.

---

## 8. Lane separation policy

| Aspect | Lane A — Invalid Traffic Verification | Lane B — AI Agent Observation |
|---|---|---|
| v1 status | Active, RECORD_ONLY | Dark-launch: store, internal review only |
| `evidence_band` cap | `medium` | `medium` (only for `verification_method_strength ≥ moderate`); else `low` |
| Reason code prefix | `A_*`, `REVIEW_*`, `OBS_*` | `B_*` |
| Storage table | `scoring_output_lane_a` | `scoring_output_lane_b` |
| Customer-facing API access | Via `vw_customer_scoring_lane_a` view only | None — Postgres role has zero SELECT permission |
| Export sinks (GA4, CSV, API list, dashboard) | Lane A view only | Forbidden — `disable_lane_b_exports=true` is default and cannot toggle at runtime |
| Cross-table query | Forbidden — CI linter parses SQL and fails any JOIN between the two tables | Same |

---

## 9. RECORD_ONLY gate + calibration deadlock review

### 9.1 Default

`action_recommendation` is `record_only` for all `evidence_band` values until the RECORD_ONLY gate opens.

### 9.2 Gate to permit non-record-only action

ALL three conditions must hold:

1. **≥ 8 weeks** elapsed since first production scoring write
2. **≥ 500 medium-band classifications** reviewed in `false_positive_review` queue with status `confirmed_fp` or `confirmed_tp`
3. **≥ 2 weeks of stability** after conditions 1 and 2 are satisfied, with no FP-rate stop-the-line trigger fired in the trailing 14 days

The gate state machine is checked at scorer startup. The feature flag refuses to enable non-record-only action until all three conditions hold.

### 9.3 FP-rate stop-the-line triggers

| Band | Target FP rate | Stop-the-line trigger |
|---|---|---|
| `medium` | < 5% | FP rate ≥ 10% in 7-day rolling window → auto `quarantine_lane.A` |
| `low` | < 15% | FP rate ≥ 25% in 7-day rolling window → engineering review |

### 9.4 Calibration deadlock review

If BOTH:

- 16 weeks have elapsed since first production scoring write, AND
- Medium-band count is < 300 in `false_positive_review`

THEN a mandatory calibration deadlock review is triggered.

**The review does NOT permit non-record-only action.** There is no shortcut around the 500 reviewed medium-band records gate.

The review answers:

- Are medium-band rules too narrow?
- Is traffic volume too low?
- Are fixtures unrealistic?
- Is customer / pilot coverage insufficient?

Permitted outputs (exactly one of):

1. Keep current rules and continue RECORD_ONLY
2. Adjust thresholds with `scoring_version` bump
3. Increase pilot traffic / source coverage
4. Add more reviewed labelled fixtures
5. Defer non-record-only action indefinitely

---

## 10. Hard rules (code-enforced)

The following are enforced at code, test, or CI level. Documentation-only rules are not accepted.

| ID | Rule | Enforcement |
|---|---|---|
| A | `evidence_band` enum is `[low, medium]`. Type system makes `high` unrepresentable | Type-level enum |
| B | `action_recommendation` defaults to `record_only`. Setting otherwise requires explicit feature_flag check | Default-constructor; production-build assertion |
| C | Every emitted `reason_code` resolves against `reason_code_dictionary.yml` at scorer startup | Scorer startup; refuses to start otherwise |
| D | Codes or band values in `forbidden_codes.yml` → scorer refuses to start; CI scans for same patterns | Scorer startup + CI grep |
| E | Any change to `scoring/rules/*.yml`, `scoring/weights.yml`, or reason-code emission conditions requires matching `scoring_version` bump | Pre-commit hook + CI |
| F | No ML library imports in `scoring/`. `sklearn`, `xgboost`, `torch`, `onnx` blocked. `numpy` permitted | Pre-commit hook on imports |
| G | No HTTP calls from `scoring_worker` — pure function of DB inputs | Static analysis + integration test |
| H | No JOIN between `scoring_output_lane_a` and `scoring_output_lane_b` in any query | CI SQL linter |
| I | Postgres role used by customer-facing API has zero SELECT on `scoring_output_lane_b` | Post-deploy smoke test |

---

## 11. Out of scope for Sprint 2

- `POST /v1/server_event` **live** ingestion (only a non-live stub for harness fixtures permitted)
- WAF / edge integration
- ML scoring of any kind
- Customer-facing display of `verification_score` integer
- Customer-facing exposure of any Lane B field or `B_*` / `OBS_*` reason code
- Customer-facing UI replay
- Automated blocking, exclusion, or allow decisions
- `UX_*` reason code emission (namespace reserved, not emitted)
- `verification_method_strength = strong` emission
- `evidence_band = high` emission
- Dead/rage click features as Lane A inputs — they are UX evidence, not fraud proof. Captured in `feature_extraction_output`, not consumed by Lane A rules

---

## 12. Backlog (non-blocking, deferred to Sprint 2.5 / Sprint 3)

### 12.1 SDK payload-field validator
Add validator that rejects or strips SDK payload fields implying buyer truth, including `is_real_buyer`, `buyer_score`, `buyer_verified`, `intent_verified`, `is_bot`, `is_ai`, `is_fraud`. Not required for commit #1 unless low-cost.

### 12.2 `OBS_*` growth control
`OBS_*` is capped at 7 emitted codes in v1. Adding the 8th `OBS_*` code requires Helen sign-off and `scoring_version` review.

### 12.3 Reason-code splitting policy
Do not create new reason codes when `proof_bundle` fields can carry the diagnostic detail. `A_REFRESH_BURST` stays unified in v1. Splitting is permitted only after v1 calibration data shows that hard reload vs mixed reload/SPA creates materially different false-positive patterns.

### 12.4 Server-side evidence ingestion (Sprint 3+)
- `POST /v1/server_event` live endpoint
- Server-observation codes: `A_BAD_NETWORK_REPUTATION`, `A_TLS_HEADER_MISMATCH`, `A_CHALLENGE_FAILED`
- Web Bot Auth signature verification path
- `verification_method_strength = strong` emission
- `evidence_band = high` reachability

### 12.5 UX friction emission (Sprint 3+)
- `UX_*` namespace emission
- `UX_DEAD_CLICK_CLUSTER`, `UX_RAGE_CLUSTER`, `UX_PAGE_FRICTION` candidate codes
- Routed to UX-friction surface, never Lane A scoring

---

## 13. Definitions of done

### 13.1 Commit #1 sign-off
- This document committed at `docs/contracts/signal-truth-v0.1.md`
- `reason_code_dictionary.yml` committed at `scoring/reason_code_dictionary.yml`
- `forbidden_codes.yml` committed at `scoring/forbidden_codes.yml`
- All three files reviewed and signed off by Helen
- No code is written before commit #1 signoff

### 13.2 Sprint 2 build complete
- All hard rules A–I enforced at code or CI level
- 8-bucket RECORD_ONLY harness operational and passing as a merge gate
- `proof_bundle` replay test: any medium-band record exports and recomputes identically under stamped `scoring_version`
- `false_positive_review` queue operational; FP-rate dashboards wired
- Sprint 1 reconciliation SQL passes unchanged (no regression)
- Postgres permissions smoke test passes (customer-facing role has zero SELECT on `scoring_output_lane_b`)

### 13.3 Definition of NOT YET releasable for non-record-only action
- Less than 8 weeks elapsed, OR
- Fewer than 500 medium-band classifications reviewed, OR
- Stability window of 2 weeks not yet observed, OR
- Any FP-rate stop-the-line trigger fired in the trailing 14 days

If at 16 weeks medium-band count is < 300 → mandatory calibration deadlock review (§9.4).
