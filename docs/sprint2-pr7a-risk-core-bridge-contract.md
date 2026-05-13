# Sprint 2 PR#7a — AMS Risk Core Bridge Contract

**Status.** PLANNING / CONTRACT ONLY. Helen sign-off required before
any PR#7b implementation work. No code, no migration, no
`schema.sql` change, no `psql`, no DB touch, no collector / app /
server / auth change. PR#0–PR#6 implementation files are referenced
read-only. The AMS repo is referenced read-only.

**Date.** 2026-05-12. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited (gate-keeper).

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| HEAD (PR#6 patched) | `1cd9ac1e1ec6cb6467aadc31b5cde7197c01a45b` |
| AMS repo path (read-only) | `/Users/admin/github/keigentechnologies/ams` |
| Prior closed commits | PR#0 `d4cc2bf` · PR#1 `bea880d` · PR#2 `3d88177` · PR#3 `4318e02` · PR#4 `cc2ae4c` · PR#5 `baa17f9` · PR#6 plan `9794210` · PR#6 impl `de76950` · PR#6 patch `1cd9ac1` |

**Authority.**

- AMS `docs/architecture/ARCHITECTURE_V2.md` (governing workflow)
- AMS `docs/algorithms/RISK_CORE_ALGORITHM_SPEC_v2.0.md`,
  `POI_CORE_*`, `SERIES_CORE_*`, `TRUST_CORE_*`,
  `BUYERRECON_PRODUCT_LAYER_*`
- AMS `internal/contracts/signals.go` — frozen `RiskInputs` /
  `RiskOutput` / `CommonFeatures`
- AMS `internal/adapters/adapters.go` — anti-corruption mapping
  pattern (`ToRiskInputs`, etc.)
- AMS `internal/products/buyerrecon/` — BuyerRecon product adapter
  (existing in Go)
- `docs/architecture/ARCHITECTURE_GATE_A0.md` §K + §0.6 P-decisions
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules
- `docs/sprint2-pr6-ams-risk-core-v0.1-buyerrecon-lane-a-planning.md`
- `docs/sprint2-pr6-ams-risk-evidence-implementation.md` (incl. §9b
  Hetzner finding under `de76950`)
- BuyerRecon prior planning + impl docs (PR#0–PR#6)

---

## §1 Purpose

PR#7a **freezes the bridge boundary** between BuyerRecon-side
behavioural-pattern evidence (PR#6's `risk_observations_v0_1`) and
the existing AMS Risk Core pathway, **before** any PR#7b code is
written.

- PR#7a is **NOT** implementation. PR#7a creates one contract
  document and changes nothing else.
- PR#7b will implement **exactly** the adapter this contract
  defines — input shape, output shape, eligibility rules,
  ContextTag discipline, version preservation, evidence-refs
  preservation, and all hard boundaries enumerated below.
- Any deviation found during PR#7b implementation MUST come back
  here for a contract revision (with Helen sign-off) rather than
  being decided ad-hoc inside PR#7b code.

The contract is the single source of truth for "how does
BuyerRecon's behavioural-pattern evidence become valid input to the
existing AMS Risk Core, while preserving the existing Risk / POI /
Series / Trust / Policy architecture?"

---

## §2 Current baseline (PR#6 final state)

| Item | Value |
| --- | --- |
| `risk_observations_v0_1` table | exists (created by migration 013) |
| PR#6 Hetzner staging proof | PASS |
| `behavioural_feature_version` filter active | `behavioural-features-v0.3` (post `1cd9ac1` patch) |
| `risk_observations_v0_1` rows | 2 |
| `evidence_refs` pointing at `behavioural-features-v0.2` SBF | 0 |
| `evidence_refs` pointing at `behavioural-features-v0.3` SBF | 2 |
| `scoring_output_lane_a` rows | 0 |
| `scoring_output_lane_b` rows | 0 |
| Source tables unchanged through PR#6 staging | ✅ (accepted_events 14, rejected_events 0, ingest_requests 14, session_features 8, SBF 16, stage0_decisions 8) |
| Verification SQL 13 anomalies | 0 |
| `npm run observe:collector` (720h window) | PASS |
| Render production | UNTOUCHED + remains blocked (A0 P-4) |

`risk_observations_v0_1` carries the AMS `RiskInputs` /
`CommonFeatures.BehavioralRisk01` input-shape payload: `velocity`
(per-metric rates), `behavioural_risk_01` (normalised input feature
in [0,1] — **not a score**), `device_risk_01` / `network_risk_01` /
`identity_risk_01` (all 0 in v1), `tags` (UPPER_SNAKE_CASE
ContextTags from the Helen-signed D-13 enum), and provenance
fields `record_only`, `source_event_count`, `evidence_refs`.

`evidence_refs` carries pointers back to the source SBF + Stage 0
rows that produced each `risk_observations_v0_1` row, including
their version stamps. This is PR#7b's lineage anchor.

---

## §3 A0 / AMS alignment

### §3.1 Locked AMS workflow (governing)

```
Evidence layer
  → gate low-quality traffic
  → shared Risk / POI / Series cores
  → product layer: product fit + timing
  → Policy Pass 1
  → Trust Core
  → Policy Pass 2
  → report / output
```

### §3.2 PR#7a / PR#7b position in the workflow

```
[Evidence layer — factual]
  accepted_events / ingest_requests           (PR#10 collector)
    → session_features                         (PR#11)
    → session_behavioural_features_v0_2 v0.3   (PR#1 + PR#2)

[Gate low-quality traffic]
    → stage0_decisions                         (PR#5)

[Evidence layer — behavioural risk observations]
    → risk_observations_v0_1                   (PR#6 — RECORD_ONLY)
                                  ↑↓
[PR#7 BRIDGE — this contract defines it]
    risk_observations_v0_1
        → RiskCoreBridgeEnvelope (AMS Risk Core INPUT envelope)
                                  ↑↓
[Shared cores — AMS-owned, unchanged]
    → existing AMS Risk Core   (internal/riskcore/)
    → existing AMS POI Core    (internal/poicore/)
    → existing AMS Series Core (internal/seriescore/)

[Product layer — AMS-owned, unchanged]
    → AMS BuyerRecon product layer    (internal/products/buyerrecon/scorer/)

[Policy Pass 1 — AMS-owned, unchanged]
    → Policy Pass 1                    (writes scoring_output_lane_a LATER — not in PR#7)

[Trust + Policy Pass 2 — AMS-owned, unchanged]
    → AMS Trust Core
    → AMS Policy Pass 2

[Report / output — AMS-owned, unchanged]
    → AMS BuyerRecon product output
```

### §3.3 Upgrade-not-restart rule

PR#7 is an **upgrade**, not a restart. The Helen D-11 rule from
PR#6 planning carries forward verbatim:

- PR#7b MUST implement an adapter **into** the existing AMS Risk
  Core pathway. It MUST NOT be a new BuyerRecon-local scorer.
- Existing AMS Risk / POI / Series / Trust / Policy algorithms remain
  **authoritative and unchanged**. PR#7b does not fork, shadow,
  port, or re-implement any of them.
- This round adds **adapter precision** (the BuyerRecon-side
  anti-corruption boundary) and **lineage clarity** (evidence_refs
  preservation, source-version preservation). It adds no scoring
  logic.

---

## §4 Existing AMS assets that must be preserved

The bridge contract MUST preserve all of the following. PR#7b code
review SHALL reject any change that weakens any item below.

| AMS asset | Responsibility (unchanged by PR#7) | Touched by PR#7b? |
| --- | --- | --- |
| **AMS Risk Core** (`internal/riskcore/`) | risk aggregation, interpretation, confidence calibration, RiskIndex computation, versioning of risk semantics | NO |
| **AMS POI Core** (`internal/poicore/`) | point-of-interest interpretation | NO |
| **AMS Series Core** (`internal/seriescore/`) | sequence / series interpretation | NO |
| **AMS Trust Core** (`internal/trustcore/`) | trust governance, downstream of cores + product layer | NO (downstream) |
| **AMS Policy Pass 1** (`internal/policy/pass1.go`) | Lane A projection; future writer of `scoring_output_lane_a` | NO (downstream) |
| **AMS Policy Pass 2** (`internal/policy/pass2.go`) | final runtime decision | NO (downstream) |
| **AMS BuyerRecon product layer** (`internal/products/buyerrecon/scorer/`) | Fit / Intent / Window / TRQ / Action / Encode | NO (downstream of cores) |
| **AMS BuyerRecon product output** (`internal/products/buyerrecon/output/`) | report rendering | NO (terminal) |
| **Collector + evidence ledger** (BuyerRecon `accepted_events` / `rejected_events` / `ingest_requests`) | audit root; immutable write path | NO |

The bridge is purely **adapter shape**. It does not introduce any
new scoring step.

---

## §5 Bridge input contract

PR#7b bridge input has **one primary source**:
`risk_observations_v0_1`. If PR#7b needs Stage 0 eligibility or
provenance, the **only permitted side-read** is a read-only lookup
against `stage0_decisions`, keyed by the existing
`workspace_id` / `site_id` / `session_id` lineage and/or the
provenance recorded on `risk_observations_v0_1.evidence_refs[]`
entries (typically the `stage0_decisions.stage0_decision_id`
pointer). This side-read is allowed only to carry
`stage0_version`, `excluded` status, and exclusion / provenance
context into the bridge `eligibility` field (§6.1). It MUST NOT
become an additional scoring source, MUST NOT bypass
`risk_observations_v0_1`, and MUST NOT create Lane A, Lane B,
Policy, Trust, or report output.

The shape below names every input field PR#7b is permitted to
consume.

### §5.1 Source

- **Source table:** `risk_observations_v0_1` (the table PR#6
  introduced). One row per
  `(workspace_id, site_id, session_id, observation_version, scoring_version)`
  per Helen D-14 + PR#6 OD-10 parity.
- **Source filter (default):** the bridge adapter MUST default to
  reading only the current `observation_version`
  (`OBSERVATION_VERSION_DEFAULT = 'risk-obs-v0.1'`) and the current
  `scoring_version` from `scoring/version.yml` (currently
  `s2.v1.0`). Bumping either version requires a matching contract
  revision.
- **No SBF rebroadcast.** PR#7b MUST NOT re-read raw
  `session_behavioural_features_v0_2` rows. The bridge consumes the
  PR#6 evidence layer only. (If a future contract revision unlocks
  this, it MUST justify why the PR#6 layer is insufficient.)

### §5.2 Required version fields (per input row)

The adapter MUST verify the presence + non-emptiness of:

- `observation_version` — provenance of the PR#6 row
- `scoring_version` — the
  `scoring/version.yml.scoring_version` stamp that PR#6 wrote
- **`behavioural_feature_version`** — sourced from
  `evidence_refs[].feature_version` on the row's
  `session_behavioural_features_v0_2` provenance entry. PR#7b MUST
  refuse to process a row where this is missing. (Per the Hetzner
  finding under `de76950`, every PR#6 row now records its source
  SBF feature_version on the evidence_refs entry; PR#7b inherits
  that guarantee.)

### §5.3 Required lineage (per input row)

The adapter MUST preserve and propagate:

- `workspace_id`, `site_id`, `session_id`
- `risk_observation_id` — the PR#6 PK (provenance anchor)
- `evidence_refs` — verbatim copy through to the output envelope.
  The bridge does NOT rewrite, deduplicate, or summarise
  `evidence_refs`.
- `stage0` context where available — joined as a read-only side
  channel from `stage0_decisions` (rule_id + excluded flag), used
  only for eligibility / provenance. PR#7b MUST NOT re-derive
  Stage 0 decisions; it MUST trust PR#5.
- `source_event_count` — passed through unchanged

### §5.4 Forbidden inputs

The adapter MUST NOT read from:

- `accepted_events` — raw event ledger (collector territory)
- `rejected_events`
- `ingest_requests` — request-layer evidence; Stage 0's territory
- `session_features` (PR#11) — unless a future contract revision
  unlocks it with explicit justification
- `session_behavioural_features_v0_2` — bypassing PR#6 is
  forbidden by default
- `scoring_output_lane_a` / `scoring_output_lane_b` — downstream of
  the bridge; reading them would be a layering violation

### §5.5 Privacy + minimisation

Inherits PR#5 OD-11 + PR#6 discipline. PR#7b MUST NOT consume or
re-emit:

- raw `user_agent` (only the normalised `user_agent_family` label
  may flow, via Stage 0 `rule_inputs`)
- raw IP, `ip_hash`, `token_hash`, `pepper`, bearer / authorization
  tokens
- raw payload bytes, `raw_request_body`, `canonical_jsonb`,
  raw `page_url` with query string

---

## §6 Bridge output contract — `RiskCoreBridgeEnvelope`

The PR#7b adapter MUST produce an AMS Risk Core **input** envelope.
The conceptual shape below is the freeze target. PR#7b owns the
TypeScript / typed-shape implementation; PR#7a owns the
field-level contract.

### §6.1 Conceptual envelope shape

```
RiskCoreBridgeEnvelope:
  envelope_version            string             # e.g. 'risk-core-bridge-v0.1'; bumped on any field change
  workspace_id                string
  site_id                     string
  session_id                  string

  source_table                'risk_observations_v0_1'   # frozen literal
  source_versions:
    observation_version         string                   # mirrors risk_observations_v0_1.observation_version
    scoring_version             string                   # mirrors risk_observations_v0_1.scoring_version
    behavioural_feature_version string                   # mirrors evidence_refs[].feature_version
    stage0_version              string | null            # if PR#5 row joined; otherwise null

  evidence_refs               EvidenceRef[]              # VERBATIM copy from risk_observations_v0_1.evidence_refs
                                                         #   (incl. the SBF + Stage 0 provenance entries)

  normalized_risk_features:                              # The RiskInputs-compat payload PR#6 wrote
    velocity                    Record<string, number>
    device_risk_01              number  # [0,1]; 0 in v1
    network_risk_01             number  # [0,1]; 0 in v1
    identity_risk_01            number  # [0,1]; 0 in v1
    behavioural_risk_01         number  # [0,1] — normalised INPUT FEATURE; not a score

  context_tags                ContextTag[]               # from risk_observations_v0_1.tags
                                                         # (carried only as context; see §9)

  eligibility:                                           # Stage 0 join, read-only
    stage0_excluded             boolean                  # always FALSE for rows the bridge emits
    stage0_rule_id              string                   # the PR#5 enum value, typically 'no_stage0_exclusion'
    bridge_eligible             true                     # frozen literal; sessions failing eligibility are not emitted

  provenance:
    risk_observation_id         string                   # the PR#6 row PK
    source_event_count          integer                  # from risk_observations_v0_1
    record_only                 true                     # frozen literal; bridge is read-only on PR#6
    derived_at                  timestamptz              # when PR#7b derived this envelope
```

`created_at` is intentionally **not** included — the envelope is
derived state, not persisted state at this stage. PR#7b's
`derived_at` covers the audit need.

### §6.2 What the envelope is NOT

The envelope is **not** any of the following. PR#7b code review
SHALL reject any field that would make the envelope cross any of
these boundaries:

- NOT a final risk score, RiskIndex, or scoring number
- NOT a `RiskOutput` (AMS Risk Core's output shape — produced by
  AMS, not by the bridge)
- NOT a `scoring_output_lane_a` row
- NOT a Lane A row (Policy Pass 1 territory)
- NOT a Lane B row (deferred PR#3b territory)
- NOT a Policy Pass 1 / Policy Pass 2 / Trust Core output
- NOT a Trust decision, runtime decision, or final policy verdict
- NOT a `verification_score`, `evidence_band`, or
  `action_recommendation`
- NOT a `reason_codes` / `reason_impacts` / `triggered_tags` /
  `penalty_total` payload
- NOT a customer-facing judgement
- NOT report language, marketing copy, or any other rendered text

The envelope's **only** job is to hand RiskInputs-compatible
evidence (plus provenance + eligibility + context tags) to whatever
component invokes the existing AMS Risk Core. Everything else is
out of scope for PR#7.

---

## §7 Stage 0 eligibility rule

| Rule | Statement |
| --- | --- |
| **E-1** | Stage 0 hard-excluded sessions (`stage0_decisions.excluded = TRUE`) MUST NOT be treated as buyer-motion scoring inputs. PR#7b MUST filter these out at the source query (PR#6's worker already excludes them — the bridge inherits that guarantee). |
| **E-2** | Stage 0 context (the `stage0_decisions.rule_id` + the carved-out `user_agent_family` label from `rule_inputs`) MAY be carried in the envelope's `eligibility` + `context_tags` fields for **audit / provenance / eligibility** purposes only. |
| **E-3** | PR#7b MUST preserve the distinction between **hard exclusion** (Stage 0's territory — obvious bots, scanners, attack-like patterns) and **behavioural ambiguity** (Risk Core's territory — non-anomalous but borderline cadence, refresh-loop candidates, etc.). The bridge MUST NOT collapse these two questions into a single number. |
| **E-4** | **Do not mix obvious-bot blocking with buyer-motion scoring.** Stage 0 is a gate, not a score input. Risk Core is a score input, not a gate. PR#7b respects both. |

PR#7b's eligibility filter at SELECT time:

- include rows where the corresponding `stage0_decisions.excluded = FALSE`
- stamp `eligibility.stage0_rule_id` with the PR#5 enum value
  (typically `'no_stage0_exclusion'`)
- stamp `eligibility.bridge_eligible = true` (frozen literal)

---

## §8 ContextTag / declared-agent rule

| Rule | Statement |
| --- | --- |
| **T-1** | `BYTESPIDER_PASSTHROUGH` remains **ContextTag / provenance only**. It is NOT a Lane B row, NOT a B_* reason code, NOT a declared-agent classification, NOT an AI-agent scoring output. (Inherits PR#6 Codex non-blocking note #2 verbatim.) |
| **T-2** | PR#7b MUST NOT classify declared agents (Bytespider, GPTBot, ClaudeBot, Perplexity-User, CCBot, Googlebot, Bingbot, DuckDuckBot, PerplexityBot, petalbot) as **Lane B**. Lane B is the deferred PR#3b observer's territory. |
| **T-3** | PR#7b MUST NOT classify declared agents as **"good bot" / "bad bot" / "AI-agent"** taxonomy. The taxonomy question is deferred. |
| **T-4** | `context_tags` MAY be carried verbatim from `risk_observations_v0_1.tags` for **filtering / provenance / future taxonomy compatibility** only. The bridge MUST NOT interpret the tags as a verdict. |
| **T-5** | Helen-signed D-13 enum is the only allowed ContextTag set: `REFRESH_LOOP_CANDIDATE`, `HIGH_REQUEST_BURST`, `ZERO_FOREGROUND_TIME`, `NO_MEANINGFUL_INTERACTION`, `JS_NOT_EXECUTED`, `SUB_200MS_TRANSITION_RUN`, `BEHAVIOURAL_CADENCE_ANOMALY`, `BYTESPIDER_PASSTHROUGH`. Tags outside this enum are rejected by the bridge (defence-in-depth assertion; PR#6 already enforces this on the way in). |

---

## §9 Product-layer boundary

| Rule | Statement |
| --- | --- |
| **P-1** | The bridge MUST NOT make product-specific buyer-fit, intent, or timing conclusions. |
| **P-2** | Product fit + timing (Fit / Intent / Window / TRQ / Action / Encode) belongs to AMS's existing BuyerRecon product layer (`internal/products/buyerrecon/scorer/`), which runs **after** shared Risk / POI / Series cores. |
| **P-3** | BuyerRecon-specific interpretation (e.g. "this session looks like a buyer in week 3 of the timing window") MUST happen later in the product layer / policy layer — never inside the bridge. |
| **P-4** | The bridge envelope contains only AMS-`RiskInputs`-compatible evidence + lineage + Stage 0 eligibility + ContextTags. It contains zero product fields. |

---

## §10 Policy Pass 1 boundary

| Rule | Statement |
| --- | --- |
| **L-1** | `scoring_output_lane_a` is **deferred**. PR#7b MUST NOT write `scoring_output_lane_a`. |
| **L-2** | `scoring_output_lane_a` is the AMS Policy Pass 1 projection's writer target. It consumes Risk Core output + POI / Series output + product-layer output. The bridge runs **upstream** of all of these. |
| **L-3** | A direct shortcut `risk_observations_v0_1 → scoring_output_lane_a` is **forbidden**. Any such shortcut bypasses Risk Core, POI, Series, and the product layer, and is a layering violation. |
| **L-4** | PR#7b MUST NOT write `scoring_output_lane_b` either (deferred PR#3b territory). |
| **L-5** | The bridge writes zero rows to either lane table. Static-test sweep + DB-test invariant. |

---

## §11 Implementation handoff for PR#7b

### §11.1 Suggested future code shape (NOT created in PR#7a)

```
src/scoring/risk-core-bridge/
  types.ts                # RiskCoreBridgeEnvelope, EvidenceRef, ContextTag re-export
  evidence-map.ts         # Pure: map risk_observations_v0_1 row → envelope's normalized_risk_features
  version.ts              # BRIDGE_VERSION_DEFAULT = 'risk-core-bridge-v0.1' + envelope_version stamp logic
  adapter.ts              # Pure: top-level riskObservationsToBridgeEnvelope(row, stage0_view)
  __tests__/              # Pure tests (vitest)
    adapter.test.ts
    evidence-map.test.ts
    version.test.ts
```

If a worker / loader is needed in PR#7b (e.g. to enumerate eligible
rows from `risk_observations_v0_1` and call the adapter in a
batch), it lives in a separate `worker.ts` under the same
directory. **PR#7b's worker MUST be read-only on the DB** unless a
contract revision explicitly approves a write path (which would
require a new persistence table — out of PR#7 scope).

### §11.2 Adapter behaviour requirements

PR#7b's `riskObservationsToBridgeEnvelope(...)` MUST:

1. **Read/accept** a `risk_observations_v0_1` row (and an optional
   joined `stage0_decisions` read-view) as input.
2. **Produce** an `RiskCoreBridgeEnvelope` object matching §6.1.
3. **Preserve `evidence_refs`** verbatim — no rewrite,
   deduplication, summarisation, or filtering.
4. **Preserve source versions** — `observation_version`,
   `scoring_version`, `behavioural_feature_version` flow through
   exactly as recorded.
5. **Preserve Stage 0 eligibility/context** — `stage0_excluded`,
   `stage0_rule_id` carried per §7.
6. **Carry ContextTags only as context/provenance** — never as
   a verdict (per §8).
7. **Be deterministic** — same input → same envelope, byte-stable.
   No `Date.now()` in the pure adapter (the worker is responsible
   for stamping `derived_at`).
8. **Be versioned** — every envelope carries `envelope_version`.
   Bumping the envelope shape (adding / renaming / removing
   fields) requires a `BRIDGE_VERSION_DEFAULT` bump + a contract
   revision here.
9. **Be unit-tested** — pure tests assert: shape, version stamp,
   evidence_refs preservation, source-version preservation,
   eligibility behaviour, ContextTag carry-through, determinism,
   no Lane A / Lane B writer in source, no RiskOutput / Policy /
   Trust / report fields on the envelope shape, no forbidden
   imports.
10. **Avoid DB writes** unless explicitly approved in the PR#7b
    plan. The bridge is an adapter, not a persistence layer.
11. **Produce no Lane A / Lane B / Policy / Trust / Report
    output.** Static-source grep + envelope-shape test enforce
    this.

### §11.3 PR#7b out-of-scope (deferred to later PRs)

- The actual AMS Risk Core invocation (Go-side or future bridge
  RPC) — PR#7b stops at the envelope.
- Persistence of the envelope — PR#7b may keep envelopes in
  memory or stream them; no new DB table unless a contract
  revision approves one.
- Policy Pass 1 / Lane A writer.
- POI / Series core invocation.
- Product-layer Fit / Intent / Window / TRQ / Action / Encode.
- Trust Core / Policy Pass 2.
- Report / output rendering.

---

## §12 Internal tensions / blockers

The following tensions exist between the bridge contract and
adjacent concerns. PR#7b implementation MUST take a side per the
resolution column.

| ID | Tension | Resolution under this contract |
| --- | --- | --- |
| **B1** | `behavioural_risk_01` is a number in [0,1]. It is tempting to call it a "score" and forward it as the final risk number. | **Forbidden.** Per PR#6 Codex non-blocking note #1, `behavioural_risk_01` is a normalised INPUT FEATURE. AMS Risk Core produces `RiskIndex` 0..100 downstream. The bridge MUST surface `behavioural_risk_01` only inside `normalized_risk_features.behavioural_risk_01`, never as a top-level "score" or "risk_index" field on the envelope. |
| **B2** | Direct Lane A projection (`risk_observations_v0_1 → scoring_output_lane_a`) is shorter than going through Risk Core / POI / Series / product layer. | **Premature.** Per §10. Direct projection bypasses every shared AMS algorithm and re-invents Policy Pass 1. PR#7b MUST go through the existing AMS pathway. |
| **B3** | `buyerrecon-backend` vs future Core-AMS repo ownership of the bridge code. | The bridge lives in `buyerrecon-backend` for now (PR#7b implementation). The contract in this doc is written to be **future-Core-AMS-compatible**: the conceptual shape names no language-specific or repo-specific dependency. If/when the bridge moves to a shared Core-AMS repo, the contract carries over verbatim. OD-7 below confirms this with Helen. |
| **B4** | Stage 0 hard exclusion vs Risk Core eligibility. | Two separate questions, two separate layers. Per §7 E-3. The bridge does NOT merge them. Stage 0's verdict is the gate; Risk Core's risk evaluation runs over the gate-passed set only. |
| **B5** | Declared-agent taxonomy drift. The set of "known declared crawlers" (Bytespider, GPTBot, etc.) is expanding over time. | Per §8 + PR#6 D-13. The current allowlist is the Helen-signed v0.1 set. New families require a contract revision + a PR#6 `BYTESPIDER_PASSTHROUGH_UA_FAMILIES` update (one source of truth). The bridge does NOT define a new taxonomy. |
| **B6** | Product-layer timing boundary — there is pressure to put "this session is in week 3 of the timing window" into the bridge. | **Forbidden.** Per §9 P-3. Timing is product-layer territory. |
| **B7** | Risk evidence vs trust decision boundary. The Trust Core is downstream of Risk Core. There is pressure to enrich the bridge envelope with trust-prior fields. | **Forbidden.** The bridge feeds Risk Core only. Trust Core consumes Risk Core + product-layer output, not the bridge envelope directly. |
| **B8** | Multiple `observation_version` rows may eventually coexist (PR#6 supports it). The bridge's default-to-current behaviour could silently drop legacy rows. | **Accepted by default.** PR#7b defaults to the current `observation_version`. A future contract revision can add a multi-version mode if needed. Logging the count of skipped legacy rows is recommended. |

---

## §13 Open decisions for Helen

| OD | Question | Recommended default |
| --- | --- | --- |
| **OD-1** | Confirm PR#7a contract-only scope | **Yes** — this doc is contract only; no implementation. |
| **OD-2** | Confirm PR#7b implementation will be the same logical PR#7 task (PR#7a + PR#7b together) | **Yes** — one logical bridge task, split into planning + implementation. |
| **OD-3** | Confirm no separate PR#8 is created for this bridge unless scope expands beyond the approved PR#7 contract | **Yes** — PR#8 is reserved for the next distinct bridge concern (e.g. POI/Series input, or the cross-language transport layer). |
| **OD-4** | Confirm `scoring_output_lane_a` is deferred and PR#7b does NOT write it | **Yes** — per §10 L-1. |
| **OD-5** | Confirm Stage 0 hard-excluded sessions do not enter buyer-motion scoring | **Yes** — per §7 E-1. |
| **OD-6** | Confirm `BYTESPIDER_PASSTHROUGH` remains ContextTag / provenance only | **Yes** — per §8 T-1. |
| **OD-7** | Confirm the bridge contract may live in `buyerrecon-backend/docs/` now and remain future-Core-AMS-compatible | **Yes** — the contract is repo-agnostic; PR#7b code lives in `buyerrecon-backend` but the contract carries over if/when the bridge moves. |
| **OD-8** | Confirm PR#7b output is only an AMS Risk Core **input** envelope (not RiskOutput, not Policy Pass output, not Lane A row) | **Yes** — per §6.2. |

All 8 ODs are load-bearing — Helen signs all 8 (or substitutes
explicit alternatives) before PR#7b implementation begins.

---

## §14 Test plan

### §14.1 For PR#7a (this doc)

- `git diff --check` clean
- No DB tests
- No `psql`
- Optional markdown/static check if a linter is wired (not required)
- Verify the doc contains all hard-boundary phrases (manual review
  during Codex pass)

Expected diff scope: **one new file** —
`docs/sprint2-pr7a-risk-core-bridge-contract.md`.

### §14.2 For PR#7b (preview — implemented in PR#7b)

- Pure adapter tests (vitest)
- Deterministic envelope tests (same input → same envelope)
- Source-version preservation tests (`observation_version`,
  `scoring_version`, `behavioural_feature_version` flow through
  unchanged)
- `evidence_refs` preservation tests (verbatim copy, no rewrite)
- Stage 0 eligibility tests (excluded sessions → no envelope;
  eligible sessions → envelope with `stage0_rule_id` stamped)
- ContextTag non-classification tests (tags carry through as
  context; no B_* / A_* / RISK.* emission)
- No `INSERT INTO scoring_output_lane_a` / `_b` in PR#7b source
  (static grep)
- No `RiskOutput` / `RiskIndex` / `verification_score` /
  `evidence_band` / `action_recommendation` / `reason_codes` /
  `reason_impacts` / `triggered_tags` / `penalty_total` fields on
  the envelope shape (static-source assertion)
- No imports from collector / app / server / auth
- No ML imports (`sklearn` / `torch` / `xgboost` / `onnx` /
  `lightgbm`)
- PR#4 startup guard wired if a worker is added in PR#7b

---

## §15 Staging proof plan

### §15.1 For PR#7a (this doc)

- **No Hetzner DB proof required.** PR#7a creates one markdown
  file. No code, no schema, no migration, no DB read or write.
- If the doc is later pushed to the staging branch for review, the
  expected diff is **one new file only**:
  `docs/sprint2-pr7a-risk-core-bridge-contract.md`.

### §15.2 For PR#7b (preview)

- `npx tsc --noEmit` clean
- `npm test` PASS (incl. new PR#7b pure tests)
- `npm run check:scoring-contracts` PASS
- **No Render production touched.** A0 P-4 still blocking.
- **No `scoring_output_lane_a` writes.** Hetzner staging row count
  unchanged before/after PR#7b run.
- **No `scoring_output_lane_b` writes.** Same.
- `npm run observe:collector` remains PASS if PR#7b touches code
  paths it does not. (PR#7b SHOULD avoid collector changes
  entirely.)

---

## §16 Hard boundaries (explicit repeat)

PR#7a:

- Does **NOT** implement code
- Does **NOT** create a migration
- Does **NOT** edit `schema.sql`
- Does **NOT** touch the DB
- Does **NOT** run `psql`
- Does **NOT** touch Render production
- Does **NOT** touch Render DB
- Does **NOT** touch the collector (`src/collector/v1/**`)
- Does **NOT** touch `src/app.ts` / `src/server.ts` / `src/auth/**`
- Does **NOT** touch `accepted_events` / `rejected_events` /
  `ingest_requests` write paths
- Does **NOT** touch `session_features` extractor
- Does **NOT** touch the behavioural-feature extractor
- Does **NOT** touch the Stage 0 worker
- Does **NOT** touch the PR#6 risk-evidence worker
- Does **NOT** write `scoring_output_lane_a`
- Does **NOT** write Lane A rows
- Does **NOT** write Lane B rows
- Does **NOT** create a `RiskOutput`
- Does **NOT** create a Policy Pass 1
- Does **NOT** create a Trust Core
- Does **NOT** create report / output
- Does **NOT** commit
- Does **NOT** push

PR#7b inherits every "Does NOT" above except the first four
(PR#7b implements code, but no migration / no `schema.sql` change /
no DB write are still the defaults; any deviation requires a
contract revision here).

---

## §17 Final conclusion

PR#7a **approves the bridge contract**. The deliverable is this
single document plus Helen sign-off on OD-1..OD-8.

PR#7b **implements the bridge adapter** exactly to this contract.

PR#7b MUST implement:

```
risk_observations_v0_1 → AMS Risk Core input envelope
```

PR#7b MUST NOT implement:

```
risk_observations_v0_1 → scoring_output_lane_a
```

The first preserves the existing AMS Risk / POI / Series / Trust /
Policy architecture. The second would bypass it. The contract sides
with the first.

PR#7b implementation gate is:

1. Helen written sign-off on this contract (OD-1..OD-8).
2. Codex review of this contract → PASS.
3. PR#6 patch commit `1cd9ac1` stable (or later).
4. AMS Risk Core spec stable.
5. `scoring/version.yml.scoring_version === 's2.v1.0'` +
   `automated_action_enabled === false`.

After all five hold, PR#7b implementation may begin on a new
branch from `sprint2-architecture-contracts-d4cc2bf` HEAD.
