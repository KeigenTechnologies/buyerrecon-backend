# BuyerRecon PR#19b: Sprint 3 External Output / Report Contract Handoff

> Docs-only contract handoff. No code. No DB change. No migration. No
> `schema.sql` change. No production command. No website change. No
> customer-output activation. No report-runtime activation. No Lane
> writer. No runtime scoring. No AMS Trust / Pass 1 / Pass 2 runtime.
> No Gate 4C execution. No secrets.

---

## 1. Status / verdict

**Verdict: CONTRACT_HANDOFF_ONLY — no implementation, no customer-output activation, no Gate 4C approval.**

PR#19b is the contract handoff for the **Sprint 3 External Output /
Report layer** identified as Track A by PR#19a §3. It defines the
TypeScript-style data contracts, enums, the safe-claim dictionary,
the v0.1 external report layout, the first-value states, the
runtime-proof schema, the four feature flags, and the test fixture
set required before any Sprint 3 implementation PR may be opened.

PR#19b is purely a docs-only contract artefact. It:

- defines the **shape** that future Track A implementation PRs must
  conform to,
- does **not** populate the `safe_claims` enum (the
  `allowed_customer_language=[]` lock in PR#18ab §9 keeps it empty
  until a separate governance PR fills it),
- does **not** activate any customer-facing surface,
- does **not** flip any of the eleven PR#18ab §9 governance locks,
- does **not** authorise any Sprint 3 implementation PR (the next
  step is the first Sprint 3 implementation PR opened under its own
  Helen GO),
- does **not** authorise any Gate 4C compatibility-plan work,
  Gate 4C canary, Gate 4D observation, or Gate 4E Track A /
  Playwright work.

### 1.1 Carry-forward from merged base

- **Gate 4B artifact / config / rollback re-audit:** **non-`BLOCKED`**
  (PR#18aa PASS, recorded on base at PR#18ab merge).
- **Gate 4C `endpointUrl` re-flip execution:** **still unapproved**
  (PR#18ac sub-status `BLOCKED_PENDING_COMPATIBILITY_PLAN`).
- **Eleven PR#18ab §9 governance locks remain in force**:
  `customer_claim_allowed=false`,
  `customer_visibility_allowed=false`,
  `lane_output_allowed=false`, `lane_write_allowed=false`,
  `runtime_scoring_allowed=false`,
  `ams_trust_runtime_allowed=false`,
  `pass1_runtime_allowed=false`, `pass2_runtime_allowed=false`,
  `dashboard_customer_output_allowed=false`,
  `sales_claim_upgrade_allowed=false`,
  `allowed_customer_language=[]`.
- **PR#17s / PR#18w 26-row warning preserved** (no delete, mutate,
  annotate, normalise on the production cluster).
- **PR#19a §3 Track A row** is the parent reference for this PR.

Anchored governance phrases (carried verbatim from
`docs/ops/cutover-hard-gates.md` §7):

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. External output purpose

BuyerRecon's external output exists to surface **evidence**, not
**conclusions**. The product is positioned as buyer-motion
verification, not buyer-intent prediction; the customer-facing
surface must reflect that positioning at the contract layer, not
only at the copy layer.

### 2.1 Three governing principles

1. **Evidence-first, not generic analytics.** The external surface
   shows what was observed and how reliably it was observed, not a
   composite "buyer score" or generic dashboard funnel. The
   competitive set surveyed in Report (24) treats first-value as
   *installation-status + first activity + first drill-down
   object*, never as an overview tile-wall.
2. **No overclaim of buyer certainty.** No customer-facing
   surface, copy, report, claim, or surface element may assert
   verified buyer identity, high-confidence buyer intent, fraud
   conclusion, AI-agent classification, or readiness-to-buy. These
   are forbidden by §7.2 and by PR#18ab §9 / §12.
3. **Facts, inferences, recommendations, and limitations must be
   visually and structurally separated.** The `ClaimBlock`
   contract (§4) enforces this at the data layer; rendering layer
   compliance is a Sprint 3 implementation acceptance criterion.

### 2.2 What the external surface is *for*

- Show the customer that BuyerRecon is **installed, connected, and
  capturing** evidence (the `installation_status` enum at §5).
- Show **the first session-level and account-level evidence** as
  it appears, with full fact-vs-inference separation (§4 / §6).
- Show **the motion timeline** so the customer can navigate from
  install → first event → first session → first account → 24h
  report (§8 / §10).
- Show **limitations** alongside any claim, including evidence
  grade (§6), missing-data caveats, and explicit "this is not a
  buyer-intent claim" boundary statements.
- Show **recommended next steps** (review this session, check
  install on page X, etc.) — never auto-actioned; always
  template-driven (§7.1).

### 2.3 What the external surface is **not** for

- **Not** a generic "buyer score". No composite score is rendered
  to customers.
- **Not** a fraud / bot / AI-agent classification surface. Lane A
  / Lane B work stays internal-only under
  `lane_output_allowed=false`.
- **Not** a marketing claim engine. The `safe_claims` template-ID
  enum is the only allowed copy source; free-text model output is
  never rendered.
- **Not** an early-access surface for AMS Trust / Pass 1 / Pass 2
  runtime. All four are locked off (§1.1).

---

## 3. Core contracts

The seven core data contracts below are specified TypeScript-style
for clarity. They are **contract definitions only**, not
implementation. A future Sprint 3 implementation PR is free to
realise them in TypeScript, JSON Schema, OpenAPI, Pydantic, or any
other concrete artefact — but the shape, field names, and
nullability must match.

### 3.1 `EvidenceAtom`

Minimal observation unit. One atom = one observed fact at one
moment.

```ts
interface EvidenceAtom {
  // Identity
  atom_id: string;                          // ULID or UUID, stable
  workspace_id: string;                     // PR#19a §3 tenancy
  project_id: string;
  site_id: string;
  schema_version: string;                   // e.g. "0.1.0"; pinned

  // Source
  source_type:
    | "thinlayer_event"                     // browser-captured envelope
    | "collector_decision"                  // server-side accept/reject
    | "scoring_worker_output"               // Lane A or Lane B row
    | "manual_record";                      // operator-entered
  source_ref: string;                       // pointer to source row id
  observed_at: string;                      // ISO 8601 UTC
  recorded_at: string;                      // ISO 8601 UTC; ingest time

  // Categorical content (no raw payload, no raw identifiers)
  category: string;                         // e.g. "navigation", "auth", "visibility"
  facet: string;                            // e.g. "reload", "ok", "hidden"
  numeric_value: number | null;             // e.g. dwell ms; null if non-numeric
  evidence_grade: EvidenceGrade;            // E0..E4 — §6

  // Provenance & quality
  is_complete: boolean;                     // false = thin / partial
  null_fields: string[];                    // explicit list of missing fields
  ingest_reason_codes: string[];            // collector reasons (e.g. content_type_ok)
}
```

### 3.2 `SessionEvidenceCard`

Aggregation of `EvidenceAtom` for a single session.

```ts
interface SessionEvidenceCard {
  card_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;

  // Session anchor (no raw session_id; categorical session_ref only)
  session_ref: string;                      // opaque categorical ID; not the raw session_id
  session_started_at: string;
  session_ended_at: string | null;          // null = open session
  session_status: "open" | "closed" | "expired";

  // Aggregate observations
  evidence_atom_ids: string[];              // links to §3.1 rows
  evidence_grade: EvidenceGrade;            // aggregated; §6
  motion_timeline_node_ids: string[];       // links to §3.4 rows

  // Single ClaimBlock summary (no per-atom claims in the card)
  claim_block: ClaimBlock;                  // §3.5
  installation_status: InstallationStatus;  // §5

  // Quality flags
  has_repeated_navigation: boolean;         // reload-loop detection
  has_focus_loss: boolean;                  // visibility-vs-focus
  conflicting_evidence: boolean;            // see §11 fixture 6
}
```

### 3.3 `AccountEvidenceCard`

Aggregation across sessions for one account-like entity.

```ts
interface AccountEvidenceCard {
  card_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;

  // Account anchor (no raw account_id; categorical account_ref only)
  account_ref: string;                      // opaque categorical ID
  first_seen_at: string;
  last_seen_at: string;
  session_count: number;

  // Aggregate observations
  session_evidence_card_ids: string[];      // links to §3.2 rows
  evidence_grade: EvidenceGrade;            // §6
  motion_timeline_node_ids: string[];       // §3.4

  // ClaimBlock summary — rendered only when show_account_inference=true
  claim_block: ClaimBlock;                  // §3.5
  account_inference_visible: boolean;       // mirror of show_account_inference flag at render time

  // Quality flags
  has_cross_site_evidence: boolean;
  has_outcome_link: boolean;                // delayed-actual joined?
  conflicting_evidence: boolean;
}
```

### 3.4 `MotionTimelineNode`

One node on the visitor / account motion timeline.

```ts
interface MotionTimelineNode {
  node_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;

  // Position
  node_kind:
    | "install_attempt"
    | "install_verified"
    | "first_event"
    | "first_session"
    | "first_account_observation"
    | "session_evidence_added"
    | "account_evidence_added"
    | "report_generated"
    | "report_delivered"
    | "alert_raised";
  occurred_at: string;
  parent_node_id: string | null;

  // Anchors
  evidence_atom_ids: string[];
  session_evidence_card_id: string | null;
  account_evidence_card_id: string | null;

  // Categorical label only — never raw identifiers in customer surface
  label_template_id: string;                // points to a safe_claims entry
}
```

### 3.5 `ClaimBlock`

The central claim-safety contract. See §4 for the full structural
specification; the type definition below is the contract surface.

```ts
interface ClaimBlock {
  block_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;

  // Four-section structural separation (§4)
  facts: ClaimFact[];
  inferences: ClaimInference[];
  recommendations: ClaimRecommendation[];
  limitations: ClaimLimitation[];

  // Anchoring (§4)
  evidence_refs: EvidenceAtomRef[];         // back-pointers to §3.1
  claim_template_id: string;                // points to §7.1 safe_claims enum
  visibility: ClaimVisibility;              // §4
  minimum_evidence_grade: EvidenceGrade;    // §6 — block is suppressed below this
}

interface ClaimFact {
  template_id: string;                      // safe_claims entry
  evidence_atom_id: string;                 // exactly one anchor
  category: string;                         // e.g. "navigation_type=reload"
}

interface ClaimInference {
  template_id: string;                      // safe_claims entry
  evidence_atom_ids: string[];              // one or more anchors
  reason_codes: string[];                   // e.g. ["GIVT_DC_IP", "good_bot_signed_agent"]
  confidence_band: "low" | "medium" | "high";   // never numeric to customer surface
  score_version_id: string;
  knob_version_id: string;
}

interface ClaimRecommendation {
  template_id: string;                      // safe_claims entry
  call_to_action: "review_session" | "check_install" | "review_account" | "open_report" | "open_method_note";
  evidence_atom_ids: string[];              // back-anchors
  auto_action_allowed: false;               // hard-coded; recommendations never auto-execute
}

interface ClaimLimitation {
  template_id: string;                      // safe_claims entry
  category: "evidence_thinness" | "missing_field" | "single_signal" | "conflicting_evidence" | "scope_boundary";
}

interface EvidenceAtomRef {
  atom_id: string;
  source_type: string;                      // mirrors §3.1.source_type
}

type ClaimVisibility =
  | "customer_visible"                      // requires flag-gated unlock; default suppressed
  | "internal_only_founder"
  | "internal_only_ops"
  | "internal_only_eng";
```

### 3.6 `ReportSnapshot`

Serialised v0.1 external report. One snapshot = one rendered report
for one customer at one moment.

```ts
interface ReportSnapshot {
  snapshot_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;

  // Window
  window_start: string;                     // ISO 8601 UTC
  window_end: string;
  window_kind: "first_value" | "24h" | "ad_hoc";

  // Sections (§8 layout)
  system_status: SystemStatusSection;
  first_value_evidence: FirstValueSection;
  session_evidence_cards: SessionEvidenceCard[];     // §3.2
  account_evidence_cards: AccountEvidenceCard[];     // §3.3
  buyer_motion_timeline: MotionTimelineNode[];       // §3.4
  limitations: ClaimLimitation[];
  recommended_next_steps: ClaimRecommendation[];
  method_note: MethodNoteSection;

  // Feature flag posture at render time (§10)
  flags_snapshot: {
    show_evidence_grade: boolean;
    show_recommendations: boolean;
    show_account_inference: boolean;
    auto_send_reports: boolean;
  };

  // Empty-window handling
  is_no_event_yet: boolean;                 // §8.2 / cutover-hard-gates §7
}

interface SystemStatusSection {
  installation_status: InstallationStatus;  // §5
  first_value_state: FirstValueState;       // §9
  last_event_at: string | null;
  collector_reachability: "reachable" | "degraded" | "unknown";
}

interface FirstValueSection {
  state: FirstValueState;                   // §9
  installation_status: InstallationStatus;  // §5
  past_30min_activity_count: number;
  first_session_evidence_card_id: string | null;
  boundary_statement_template_id: string;   // safe_claims entry
}

interface MethodNoteSection {
  method_template_id: string;               // safe_claims entry; describes evidence-grade ladder
  evidence_grade_explanation_template_id: string;
  not_buyer_intent_disclaimer_template_id: string;
}
```

### 3.7 `ReportDeliveryProof`

Audit row for each report delivery (email / webhook / download).

```ts
interface ReportDeliveryProof {
  proof_id: string;
  workspace_id: string;
  project_id: string;
  site_id: string;
  schema_version: string;

  // Anchor
  snapshot_id: string;                      // §3.6 row
  delivered_at: string;                     // ISO 8601 UTC

  // Recipient identity — categorical only (no raw email)
  recipient_category: "primary_admin" | "secondary_admin" | "internal_ops" | "webhook_endpoint";
  delivery_channel: "email" | "webhook" | "download_url" | "in_app";

  // Runtime proof (§10)
  request_id: string;                       // shared with Track B audit row
  rule_version_id: string;
  model_version_id: string | null;
  knob_version_id: string;

  // Outcome
  delivery_status: "queued" | "sent" | "failed" | "withheld_no_event";
  failure_reason_code: string | null;       // categorical only; no raw error body
}
```

---

## 4. ClaimBlock structure (detail)

The `ClaimBlock` type at §3.5 enforces four hard structural rules.
Sprint 3 implementation must surface each rule in both the data
layer and the rendering layer; PR#19b records them as contract
requirements.

### 4.1 Required arrays — `facts[]` / `inferences[]` / `recommendations[]` / `limitations[]`

- **All four arrays are mandatory.** Even when empty, they must be
  serialised as `[]`, never as `null` and never omitted. A renderer
  that receives a `ClaimBlock` with a missing key must throw an
  error, not silently coerce.
- **No cross-pollination.** No field of type `ClaimInference` may
  appear in `facts[]`. No `ClaimRecommendation` may appear in
  `inferences[]`. The four collections are disjoint by type, by
  template-ID space, and by visual rendering.
- **No free-text fields.** Every entry references a
  `claim_template_id` (or `template_id` on the sub-types). The
  rendering layer resolves the template against the §7.1
  `safe_claims` dictionary. There is **no** field in any of the
  four arrays that carries a customer-facing string composed at
  runtime by the model or rule layer.

### 4.2 `evidence_refs[]`

- **Every `ClaimBlock` carries at least one entry in
  `evidence_refs[]`.** A `ClaimBlock` with zero anchors is
  invalid; it must be suppressed at render time.
- Each entry is an `EvidenceAtomRef` (§3.5), back-pointing to a
  specific `EvidenceAtom` (§3.1).
- The anchor set defines the **provenance** of the block: every
  fact, inference, or recommendation in the block must trace back
  to one or more atoms in this set.
- The customer-facing surface must support drilling from the block
  into its anchors (one click → atom; one more click → source
  row).

### 4.3 `claim_template_id`

- Top-level `claim_template_id` is the canonical safe-claims entry
  that names this block (e.g. `safe.session_summary_low_conf.v1`).
- The set of valid IDs is defined by the §7.1 dictionary. The
  dictionary is **empty** at PR#19b merge because
  `allowed_customer_language=[]` is locked in PR#18ab §9; a
  separate governance PR populates it.
- Renderer behaviour with an unknown / unresolved
  `claim_template_id` is: do not render. No fall-back text.

### 4.4 `visibility`

- `ClaimVisibility` (§3.5) defaults to the most restrictive value
  (`internal_only_eng`) unless explicitly elevated.
- `customer_visible` is gated on PR#18ab §9
  `customer_visibility_allowed=true`. While the lock holds at
  `false`, no block may serialise with `visibility="customer_visible"`
  even if other criteria are met.
- The three `internal_only_*` levels exist so Track C internal
  learning surfaces (PR#19a §6) can subscribe to relevant blocks
  without exposing them externally.

### 4.5 `minimum_evidence_grade`

- Each `ClaimBlock` declares its `minimum_evidence_grade` (§6).
- A block whose aggregate evidence grade falls below this minimum
  must be suppressed at render time, regardless of
  `customer_visibility_allowed` flag state.
- This is a **hard floor** preventing thin or single-signal claims
  from surfacing.

### 4.6 ClaimBlock invariants — summary

| Invariant | Enforcement |
|---|---|
| All four arrays present (even if empty) | renderer-side schema validation |
| `facts[]` / `inferences[]` / `recommendations[]` / `limitations[]` types disjoint | TypeScript type system + runtime guard |
| `evidence_refs[]` non-empty | renderer suppresses blocks with empty anchors |
| All copy via `template_id` only | renderer suppresses on unknown ID |
| `visibility="customer_visible"` requires §9 lock unlock | renderer downgrades to `internal_only_*` if lock holds |
| Below `minimum_evidence_grade` ⇒ suppress | renderer hard-floor |
| `auto_action_allowed=false` on every recommendation | type-system enforcement |

---

## 5. `installation_status` enum

`installation_status` describes whether BuyerRecon is connected and
capturing on the customer's site. The enum has **six** values, two
more than the PR#19a §4.2 sketch — `degraded` and `unknown` are
added explicitly so the rendering layer can express "BuyerRecon is
trying but something is off" and "BuyerRecon can't yet tell" without
falsely promoting to `verified` or falsely demoting to
`not_installed`.

```ts
type InstallationStatus =
  | "not_installed"
  | "connected_no_data"
  | "collecting"
  | "verified"
  | "degraded"
  | "unknown";
```

### 5.1 Value semantics

- **`not_installed`** — ThinSDK not detected on any page reachable
  by BuyerRecon. Default state for any new site. First-value
  state §9.1.
- **`connected_no_data`** — ThinSDK detected and produced at
  least one HTTP request, but no `ingest_requests` row was
  persisted. First-value state §9.2.
- **`collecting`** — `ingest_requests` rows present but no
  `accepted_events` row produced yet. (At PR#19b merge time,
  production is in this state for the 26 historical PR#17s rows:
  the bundle reaches the collector but the contract-shape mismatch
  prevents propagation. First-value state §9.3.)
- **`verified`** — at least one `accepted_events` row produced
  for this site. The system has demonstrated end-to-end capture.
- **`degraded`** — system has been `verified` previously but the
  most recent window shows elevated `request_body_invalid_json`,
  `auth_status` failures, or other reject-reason codes above a
  monitored threshold. Rendering layer must show
  `degraded` distinctly so the customer can take action without
  thinking the whole install is broken.
- **`unknown`** — installation state cannot be categorically
  resolved (e.g. probe failure, monitoring gap, fresh workspace
  with no observations yet within the lookback window). Rendering
  layer must show `unknown` distinctly from `not_installed` to
  avoid implying a failed install.

### 5.2 Forbidden inferences

- The renderer must not promote `connected_no_data` to
  `verified` based on optimism.
- The renderer must not demote `verified` to `not_installed` on
  a single failed probe; that's `degraded` or `unknown`.
- `degraded` is **not** a buyer claim. It says nothing about who
  is visiting the site; it says only that the capture pipeline is
  not producing accept-class outcomes at the expected rate.

---

## 6. `evidence_grade` enum

```ts
type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4";
```

### 6.1 Value semantics

- **`E0` — no sufficient evidence.** No `EvidenceAtom` for the
  scope (session, account, window) yet. Block is never rendered to
  customer surface.
- **`E1` — connected / thin evidence.** At least one
  `EvidenceAtom`, but evidence is single-source (e.g. one
  navigation event with no follow-up). Surface as fact only;
  inferences forbidden.
- **`E2` — single-session evidence.** Multiple atoms in one
  session, validated cross-signal (e.g. navigation + visibility +
  focus). Inferences permitted at `confidence_band="low"` only.
- **`E3` — repeated or multi-signal evidence.** Multi-session or
  cross-signal evidence across atoms (e.g. multiple sessions with
  consistent navigation patterns + auth + dwell). Inferences
  permitted at `confidence_band="low" | "medium"`.
- **`E4` — multi-session + account aggregation + key action
  consistency.** Account-level aggregation with delayed-actual
  outcome linkage (Track C `customer_outcome`). Inferences
  permitted at `confidence_band="low" | "medium" | "high"` —
  though `high` is still forbidden from customer surfaces while
  PR#18ab §9 locks hold.

### 6.2 What `evidence_grade` is

`evidence_grade` measures the **completeness and coherence of the
observed evidence**:

- how many distinct atoms,
- across how many distinct sessions,
- across how many distinct signal categories
  (navigation / visibility / auth / dwell / etc.),
- with how much agreement / disagreement,
- whether a delayed actual has been linked.

### 6.3 What `evidence_grade` is **not**

`evidence_grade` is **not** a purchase probability, intent score,
buyer score, conversion likelihood, or any composite of those. It
does **not** describe the customer; it describes the BuyerRecon
observation pipeline's confidence in the completeness of its
record.

Customer-facing copy for `evidence_grade` (when
`show_evidence_grade=true`, which is `false` by default — §10)
must read as "we have **observed** N pieces of evidence across M
sessions" rather than "this is an N% likely buyer". The Sprint 3
implementation PR must verify this distinction in copy review.

### 6.4 Minimum-grade gates for rendering

| Surface | Minimum render grade | Notes |
|---|---|---|
| `installation_status` block | none | always rendered |
| First-value `past_30min_activity_count` | none | count-only, no claim |
| `SessionEvidenceCard` facts-only block | E1 | factual rendering only |
| `SessionEvidenceCard` with inferences | E2 | confidence_band=low only |
| `AccountEvidenceCard` facts-only block | E2 | requires cross-session atoms |
| `AccountEvidenceCard` with inferences | E3 | confidence_band ≤ medium |
| `AccountEvidenceCard` with outcome linkage | E4 | confidence_band ≤ medium customer-side |
| `MotionTimelineNode` (install / first-event / report kinds) | none | navigational nodes |
| `MotionTimelineNode` (evidence-added kinds) | E1 | mirrors atom |
| 24h report `recommended_next_steps` | E2 | template-only |
| 24h report `claim block` with inference | E3 | template-only, low confidence |

---

## 7. Safe claims dictionary

The `safe_claims` dictionary is the **single source** of all
customer-facing copy. The rendering layer never composes free text
from model or rule output; it resolves a `template_id` to an entry
in this dictionary.

### 7.1 Dictionary entry shape

```ts
interface SafeClaimEntry {
  template_id: string;                      // e.g. "safe.session_summary_low_conf.v1"
  template_kind:
    | "fact"
    | "inference"
    | "recommendation"
    | "limitation"
    | "boundary_statement"
    | "method_note";
  copy_template: string;                    // e.g. "BuyerRecon observed {n} events in this session"
  required_placeholders: string[];          // e.g. ["n"]
  allowed_language_tags: AllowedLanguageTag[];
  forbidden_language_tags: ForbiddenLanguageTag[];
  minimum_evidence_grade: EvidenceGrade;    // §6
  minimum_confidence_band: "low" | "medium" | "high" | null;
}
```

### 7.2 Allowed language

Allowed customer-facing phrasings draw **only** from the following
verbs / qualifiers:

- **`observed`** — "BuyerRecon observed N navigation events in
  this session."
- **`consistent with`** — "This pattern is consistent with a
  multi-session visitor."
- **`suggests`** — "Repeated cross-page activity suggests the
  visitor returned to evaluate content X."
- **`insufficient evidence`** — "Insufficient evidence to
  characterise account-level behaviour."
- **`not yet verified`** — "Installation has connected but no
  events have been captured yet; not yet verified."

Plus structural / navigational copy (button labels, section
headers, dates, counts, evidence-grade labels, install-status
labels) that does not make a buyer claim.

### 7.3 Forbidden language

The following are forbidden in every customer-facing surface
(website, dashboard, report, email, webhook payload, sales
material, marketing copy, demo script, pitch deck, press release,
blog post, social post):

- **`confirmed buyer`** — any phrasing that asserts the visitor
  is confirmed as a buyer.
- **`guaranteed intent`** — any phrasing that asserts intent is
  guaranteed.
- **`high-confidence buyer identity`** — even if the underlying
  evidence-grade is E4, no customer surface may use this phrasing.
- **`fraud conclusion`** — no fraud / bot / invalid-traffic
  conclusion may appear in customer copy.
- **`AI-agent classification` in customer output** — Lane B
  classification stays internal-only under
  `lane_output_allowed=false`.
- **`readiness-to-buy conclusion`** — no scoring claim about
  buyer readiness may appear.

### 7.4 Dictionary population gate

- **`allowed_customer_language=[]`** at PR#18ab §9 keeps the
  dictionary empty at PR#19b merge.
- The Sprint 3 implementation PR(s) may **define candidate
  entries** (template-IDs, copy strings, required placeholder
  tokens, tags, grade gates) — but those candidate entries are
  not customer-surfaceable until a **separate governance PR**
  under explicit Helen GO flips the lock and approves the
  specific entries.
- The governance PR adds entries one at a time, each pinned to
  evidence-grade requirements and feature-flag states.
- A future PR may amend this dictionary; PR#19b does not.

---

## 8. External report sections (v0.1 layout)

The v0.1 external report (rendered as either a first-value dashboard
or a 24h-window report — `ReportSnapshot.window_kind`) contains
exactly these eight sections in this order:

1. **System status.** `installation_status`, collector
   reachability, last-event-at, first-value-state. Driven by
   `SystemStatusSection` (§3.6).
2. **First-value evidence.** Past-30-min activity count plus first
   session evidence card, plus boundary statement. Driven by
   `FirstValueSection` (§3.6).
3. **Session evidence.** Zero-to-many
   `SessionEvidenceCard` rows for the window. Ordered by
   `session_started_at` descending.
4. **Account evidence.** Zero-to-many
   `AccountEvidenceCard` rows for the window. Rendered only when
   `show_account_inference=true` and at least one card meets
   E2 minimum. Otherwise the section is suppressed (not shown as
   "empty").
5. **Buyer-motion timeline.**
   `MotionTimelineNode` rows for the window, oldest-first.
6. **Limitations.** Aggregated `ClaimLimitation` entries across
   the report. Always rendered; never suppressed.
7. **Recommended next steps.** Aggregated `ClaimRecommendation`
   entries. Rendered only when `show_recommendations=true`
   (default `false`) and at least one recommendation meets E2
   minimum. Otherwise the section is suppressed.
8. **Method note.** `MethodNoteSection` — evidence-grade ladder
   explanation, not-buyer-intent disclaimer. Always rendered.

### 8.1 Ordering rule

The eight-section ordering is fixed. No section may be reordered
without a new contract version (`ReportSnapshot.schema_version`
bump). Sections may be suppressed (per §4 / §10 flag rules) but
their position in the sequence cannot move.

### 8.2 `NO_EVENT_YET` empty-window handling

If `ReportSnapshot.is_no_event_yet=true`:

- Section 1 (System status) renders.
- Section 2 (First-value evidence) renders with explicit "no event
  yet in this window" copy from `safe_claims` (specific template-ID
  to be defined by the governance PR that populates the
  dictionary).
- Sections 3–5 (Session / Account / Timeline) render as empty (no
  rows) — but the section frame is still present so the customer
  knows the surface exists.
- Sections 6–8 still render normally.

The anchor governance phrase from cutover-hard-gates §7 —
"`NO_EVENT_YET` is not failure if no event was expected or
observed" — must appear (via a `safe_claims` template) in the
empty-window method note.

### 8.3 Delivery suppression for `auto_send_reports`

When the report is delivered via the auto-send subscription path
(`auto_send_reports=true`):

- If `is_no_event_yet=true`, the delivery layer **withholds**
  delivery (`ReportDeliveryProof.delivery_status="withheld_no_event"`).
  The customer is not spammed with empty reports.
- If `is_no_event_yet=false`, the delivery layer sends per the
  subscription configuration.

This is the "no result → no send" pattern from Report (24)
§"报告" lesson 4 (Metabase precedent).

---

## 9. First-value states

`FirstValueState` enumerates the customer-experience flavours of the
first-value screen:

```ts
type FirstValueState =
  | "no_install"
  | "installed_no_data"
  | "connected_no_evidence"
  | "first_session_evidence"
  | "first_account_evidence"
  | "limitation_heavy_or_conflicting";
```

### 9.1 `no_install`

- `installation_status === "not_installed"`.
- Past-30-min activity count: 0.
- Renders install-instructions block plus boundary statement.
- No session evidence card. No account evidence card. No timeline.

### 9.2 `installed_no_data`

- `installation_status === "connected_no_data"`.
- Past-30-min activity count: 0 (no `ingest_requests` rows).
- Renders diagnostic-help block ("check site X is reachable",
  "check Content-Security-Policy", "check ThinSDK initialiser").
- No session evidence card. No account evidence card. No timeline.

### 9.3 `connected_no_evidence`

- `installation_status === "collecting"`.
- `ingest_requests` rows exist, but no `accepted_events` row yet.
- This is the **production state at PR#19b merge time** for the
  26 PR#17s rows (`auth_status=ok` × 26,
  `reject_reason_code=request_body_invalid_json` × 26).
- Renders explanatory boundary statement ("connected and reaching
  the collector, but no event has been successfully captured —
  see method note") plus method-note pointer.
- No session evidence card. No account evidence card. No timeline.

### 9.4 `first_session_evidence`

- `installation_status === "verified"`.
- At least one `accepted_events` row in the window.
- Renders the first `SessionEvidenceCard` (E1+ depending on
  atom count).
- Account evidence card and timeline render only as additional
  data accrues.

### 9.5 `first_account_evidence`

- `installation_status === "verified"`.
- At least one account has accumulated enough cross-session
  evidence to support an `AccountEvidenceCard` at E2+.
- Renders the first such `AccountEvidenceCard` plus its bound
  session cards plus the motion timeline up to this node.
- `show_account_inference` flag must be `true` for the
  AccountEvidenceCard claim block to render with inferences.

### 9.6 `limitation_heavy_or_conflicting`

- Any first-value path where multiple `ClaimLimitation` entries
  fire (e.g. evidence is thin **and** signals conflict, or
  installation is degraded with partial evidence, or evidence is
  E4 but with reason-code disagreement).
- Renders the available evidence with **prominent limitation
  block at the top** instead of treating limitations as a footnote.
- No "upgrade" CTAs in this state (no sales path; safety first).

### 9.7 State transitions

The state is derived from `installation_status`, recent
`ingest_requests` / `accepted_events` counts, and the most recent
`SessionEvidenceCard` / `AccountEvidenceCard` aggregates. State
transitions are **forward-only on improvement**:
`no_install` → `installed_no_data` → `connected_no_evidence` →
`first_session_evidence` → `first_account_evidence`.

The `limitation_heavy_or_conflicting` state can be entered from
any of the others when the conflicting-evidence flag fires;
returning to a non-conflicted state requires the underlying
limitation cause to clear.

---

## 10. Runtime proof

Every external-surface emission produces a runtime-proof row, in
shared schema with Track B (PR#19a §7.3). External surface emits
five proof categories:

### 10.1 Connected proof

Records that BuyerRecon's collector accepted at least one
`ingest_requests` write for the site in the window.

- Fields: `proof_id`, `workspace_id`, `project_id`, `site_id`,
  `proof_kind="connected"`, `observed_at`, `evidence_atom_ids[]`,
  `request_id`, `rule_version_id`, `knob_version_id`.
- Drives the `connected_no_data` → `collecting` transition in
  §5.

### 10.2 Data proof

Records that at least one `accepted_events` row has been written
for the site.

- Fields: as above, `proof_kind="data"`.
- Drives the `collecting` → `verified` transition.

### 10.3 Evidence proof

Records that at least one `EvidenceAtom` has been written for the
site at evidence-grade E1+.

- Fields: as above, `proof_kind="evidence"`,
  `evidence_grade`, `session_evidence_card_id` (optional).
- Drives surfacing of session / account / timeline sections.

### 10.4 Narrative proof

Records that at least one `ClaimBlock` was successfully
constructed and rendered.

- Fields: as above, `proof_kind="narrative"`,
  `claim_block_id`, `claim_template_id`, `visibility`,
  `confidence_band`.
- Used by Track B audit to confirm what was actually shown.

### 10.5 Delivery proof

Records that a `ReportSnapshot` was delivered (or explicitly
withheld) — `ReportDeliveryProof` (§3.7).

- Mandatory for every subscription / on-demand delivery.
- Mandatory for `withheld_no_event` non-deliveries (records the
  decision to withhold).

### 10.6 Runtime-proof retention

Per PR#19a §5 / Track B retention policy:

- Connected / data / evidence proofs: medium retention (e.g.
  180–365 days).
- Narrative proof: medium retention.
- Delivery proof: long retention (e.g. 365–730 days; matches
  audit-log retention class).

Exact retention values are set by the Track B `retention_policy`
implementation PR, not by PR#19b.

---

## 11. Feature flags

Four feature flags govern external-surface rendering. All four
default to **`false`** at PR#19b merge to respect the PR#18ab §9
locks. Each flag's flip path is the same: a separate scoring /
governance / output PR under its own explicit Helen GO.

```ts
interface ExternalOutputFeatureFlags {
  show_evidence_grade: boolean;        // default: false
  show_recommendations: boolean;       // default: false
  show_account_inference: boolean;     // default: false
  auto_send_reports: boolean;          // default: false
}
```

### 11.1 `show_evidence_grade`

- Controls whether `evidence_grade` (E0–E4) is rendered to the
  customer alongside cards and reports.
- Default `false` until the `safe_claims` dictionary is populated
  with evidence-grade explanation copy (§7).
- The flag does not change which evidence-grade gates apply at the
  data layer — minimum-grade rules (§6.4) hold regardless of
  flag state.

### 11.2 `show_recommendations`

- Controls whether the `recommended_next_steps` section (§8.7)
  renders.
- Default `false` until governance PR approves the recommendation
  templates and CTAs.
- When `false`, the section is suppressed entirely (not shown
  empty). `ReportSnapshot.recommended_next_steps` may still be
  populated in the snapshot (for Track C internal-learning
  subscription), but is not rendered.

### 11.3 `show_account_inference`

- Controls whether `AccountEvidenceCard.claim_block.inferences[]`
  renders.
- Default `false`. Without the flag, the account section may
  still render facts and limitations, but inferences are
  suppressed.
- `AccountEvidenceCard.account_inference_visible` mirrors the
  flag at render time so downstream consumers (Track C) can
  reconstruct rendering state.

### 11.4 `auto_send_reports`

- Controls whether the report-scheduler delivers reports
  automatically per subscription.
- Default `false`. While off, reports may be generated on-demand
  via the dashboard but are not pushed.
- Even when `true`, `is_no_event_yet=true` snapshots are withheld
  (§8.3).

### 11.5 Flag observability

Every `ReportSnapshot` records the four flag values in
`flags_snapshot` at render time (§3.6). This allows Track B audit
to confirm which surfaces were enabled when a given snapshot was
rendered. Flag flips must produce a `audit_events` row (Track B
PR#19a §5.1).

---

## 12. Tests / fixtures

Sprint 3 implementation PRs must implement against at least the
following six fixtures. Each fixture is a deterministic input set
that produces a known `ReportSnapshot` shape.

### 12.1 Empty state

- Input: no `ingest_requests`, no `accepted_events`, no
  `EvidenceAtom`.
- Expected: `installation_status="not_installed"`,
  `first_value_state="no_install"`, all evidence / account /
  timeline sections empty, limitations include "no install"
  template, method note rendered.

### 12.2 Connected no data

- Input: ThinSDK probe succeeded (collector-reachable proof), but
  zero `ingest_requests`.
- Expected: `installation_status="connected_no_data"`,
  `first_value_state="installed_no_data"`, diagnostic-help block
  rendered.

### 12.3 Single session

- Input: one session with three `EvidenceAtom` rows
  (navigation + visibility + dwell), all in the past 30 minutes.
- Expected: `installation_status="verified"` once at least one
  `accepted_events` row exists; `first_value_state="first_session_evidence"`;
  one `SessionEvidenceCard` at E2; `ClaimBlock.facts[]` populated
  via templates; `inferences[]` populated at
  `confidence_band="low"` only; `recommendations[]` suppressed
  unless `show_recommendations=true`.

### 12.4 Weak account evidence

- Input: two sessions in the past 24 hours, same `account_ref`,
  but signals are limited (no cross-signal coherence).
- Expected: `SessionEvidenceCard` at E2, `AccountEvidenceCard`
  at E2 with `facts[]` only; `inferences[]` empty; `limitations[]`
  includes `evidence_thinness` template;
  `AccountEvidenceCard.conflicting_evidence=false`.

### 12.5 Repeated account pattern

- Input: five sessions across three days for the same
  `account_ref`, with consistent multi-signal evidence
  (navigation + visibility + auth + dwell + repeat-visit
  pattern).
- Expected: `AccountEvidenceCard` at E3, `claim_block.inferences[]`
  populated at `confidence_band="medium"` (assuming the
  classifier output supports it), `recommendations[]` populated
  with `review_account` CTA.
- Customer-side rendering still respects `show_recommendations`
  and `show_account_inference` flag state.

### 12.6 Conflicting evidence

- Input: session with high navigation activity but consistent
  visibility-hidden state (e.g. background tab); or account with
  one strong-signal session and one no-signal session.
- Expected: `SessionEvidenceCard.conflicting_evidence=true` or
  `AccountEvidenceCard.conflicting_evidence=true`;
  `first_value_state="limitation_heavy_or_conflicting"`;
  prominent limitation block at the top; no
  `recommended_next_steps` even if `show_recommendations=true`.

### 12.7 Test additionality

Sprint 3 implementation PRs may add more fixtures (they almost
certainly will need to — e.g. retention boundary, cross-tenant
isolation, install-degraded transitions). The six fixtures above
are the **minimum** Sprint 3 must implement against.

---

## 13. Non-goals

PR#19b explicitly does **not** approve any of the following. Each
requires its own explicit Helen GO scoped to that specific work:

- no Sprint 3 implementation PR opened by PR#19b (the next step is
  the first Sprint 3 implementation PR under its own Helen GO);
- no population of the `safe_claims` dictionary;
- no flipping of any PR#18ab §9 lock
  (`customer_claim_allowed`, `customer_visibility_allowed`,
  `lane_output_allowed`, `lane_write_allowed`,
  `runtime_scoring_allowed`, `ams_trust_runtime_allowed`,
  `pass1_runtime_allowed`, `pass2_runtime_allowed`,
  `dashboard_customer_output_allowed`,
  `sales_claim_upgrade_allowed`,
  `allowed_customer_language=[]`);
- no flipping of any of the four §11 feature flags;
- no Lane A / Lane B writer activation;
- no AMS Trust runtime;
- no Pass 1 / Pass 2 runtime;
- no Gate 4C execution;
- no Gate 4D organic observation;
- no Gate 4E Track A / Playwright;
- no production traffic generation;
- no `endpointUrl` re-flip;
- no `buyerrecon.com` production `/v1/event` call;
- no Render `/collect` call;
- no `/var/www` edit;
- no symlink change;
- no `nginx -s reload`, no `systemctl` action, no service restart;
- no DNS change;
- no DB write, no DB grant, no migration, no `schema.sql` change;
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no
  `buyerrecon_migrator` reset, no production token provisioning;
- no Track A invocation, no Playwright run;
- no website ThinSDK production-mode activation;
- no production artifact / config mode flip;
- no runtime code;
- no deletion / mutation / annotation / normalisation of the 26
  historical PR#17s rows on the production cluster;
- no secret printing (DSN, generated password, DB username /
  password pair, `Authorization:` header value, raw `request_id`,
  raw `session_id`, raw payload, raw response body, env dump,
  private key / cert body, vault content, shell history, raw row
  data).

---

## 14. Acceptance criteria

PR#19b is acceptable for merge into
`sprint2-architecture-contracts-d4cc2bf` only if **all** of the
following hold:

- **Docs-only.** Exactly one new file changes in the repo:
  `docs/engineering/pr19b-sprint3-external-output-contract-handoff.md`.
  No code, no scripts, no tests, no package files, no migrations,
  no `schema.sql`, no env files, no systemd / Nginx files, no AMS
  source, no website artifacts, no production config, no DB grant
  files change.
- **External output contract complete.** §3 specifies all seven
  core contracts (`EvidenceAtom`, `SessionEvidenceCard`,
  `AccountEvidenceCard`, `MotionTimelineNode`, `ClaimBlock`,
  `ReportSnapshot`, `ReportDeliveryProof`).
- **No customer-output activation.** §1, §7.4, §11, §13 all
  restate that the `safe_claims` dictionary is empty,
  `allowed_customer_language=[]` holds, and the four feature
  flags are all `false`.
- **No runtime code.** PR#19b is purely a contract artefact;
  no implementation surface is touched.
- **Claim-safety rules explicit.** §4 (ClaimBlock invariants),
  §7.2 (allowed language), §7.3 (forbidden language), §6.3
  (`evidence_grade` is not a probability), §13 (non-goals).
- **Report object contracts explicit.** §3 + §8 + §9 specify
  `ReportSnapshot`, the eight-section layout, and the six
  first-value states.
- **Tests / fixtures listed.** §12 enumerates six fixtures with
  expected outputs.
- **Gate 4C remains unapproved.** §1.1, §13 restate
  non-approval; PR#18ac sub-status
  `BLOCKED_PENDING_COMPATIBILITY_PLAN` carried forward.
- **Governance locks preserved.** §1.1 carries all eleven
  PR#18ab §9 locks verbatim; §13 restates them as non-goals.
- **No secrets.** Secret-safety grep returns only metadata /
  governance / attestation hits inside §7.3 / §13 forbiddance
  lists.

---

## 15. Files planned to change

### 15.1 Repo (this PR, docs-only)

| Path | Action | Lines |
|---|---|---|
| `docs/engineering/pr19b-sprint3-external-output-contract-handoff.md` | NEW | 1291 |

No code, scripts, tests, package files, migrations, `schema.sql`,
env files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

The four deep-research reports
(`deep-research-report (23).md` … `(26).md`) remain in the repo
root as untracked working-tree files; PR#19b does not commit them.

### 15.2 Production host

| Path | Action |
|---|---|
| any | NOT TOUCHED |

PR#19b does not read, write, edit, copy, move, remove, chmod,
chown, symlink, or otherwise touch the production host in any way.
No commands of any kind are executed against the production host.

---

End of PR#19b. **Sprint 3 External Output / Report contract handoff.
Verdict: CONTRACT_HANDOFF_ONLY — no implementation, no
customer-output activation, no Gate 4C approval. Defines seven core
data contracts (EvidenceAtom, SessionEvidenceCard,
AccountEvidenceCard, MotionTimelineNode, ClaimBlock, ReportSnapshot,
ReportDeliveryProof) with TypeScript-style type definitions and
explicit field-level semantics. ClaimBlock contract enforces four
structural invariants: facts/inferences/recommendations/limitations
arrays mandatory and disjoint; evidence_refs non-empty; copy via
safe_claims template_id only; visibility defaults to
internal_only_eng; minimum_evidence_grade is a hard floor below
which blocks are suppressed at render. installation_status enum has
six values (not_installed / connected_no_data / collecting /
verified / degraded / unknown). evidence_grade enum has five values
E0..E4 measuring observation completeness — explicitly NOT purchase
probability — with per-grade rendering gates. safe_claims dictionary
allows only observed / consistent with / suggests / insufficient
evidence / not yet verified verbs; forbids confirmed buyer /
guaranteed intent / high-confidence buyer identity / fraud
conclusion / AI-agent classification in customer output /
readiness-to-buy. Dictionary is empty at PR#19b merge because
PR#18ab §9 allowed_customer_language=[] lock holds; populated only
via separate governance PR. v0.1 external report has fixed
eight-section layout (system status / first-value evidence /
session evidence / account evidence / buyer-motion timeline /
limitations / recommended next steps / method note) with explicit
NO_EVENT_YET empty-window handling. Six first-value states
(no_install / installed_no_data / connected_no_evidence /
first_session_evidence / first_account_evidence /
limitation_heavy_or_conflicting). Runtime proof has five categories
(connected / data / evidence / narrative / delivery) all sharing
schema with Track B audit. Four feature flags
(show_evidence_grade / show_recommendations / show_account_inference
/ auto_send_reports) all default to false; flip requires separate
governance PR. Six test fixtures (empty / connected_no_data /
single_session / weak_account / repeated_account_pattern /
conflicting_evidence) define the minimum Sprint 3 implementation
must implement against. All eleven PR#18ab §9 governance locks
carried forward verbatim. PR#17s 26-row warning carried forward
with do-not-delete / do-not-mutate / do-not-annotate /
do-not-normalise rule. Gate 4C execution remains unapproved
(PR#18ac BLOCKED_PENDING_COMPATIBILITY_PLAN). The repo change is
docs-only. No code, scripts, tests, package files, migrations,
schema.sql, env files, systemd / Nginx files, AMS source, website
artifacts, production config, or DB grant files modified in the
repo. No production-host write, no production-host read, no HTTP
call, no command execution of any kind is performed by PR#19b. No
Sprint 3 implementation PR opened by PR#19b. No safe_claims
dictionary population. No feature-flag flip. No Lane A / B writer.
No AMS Trust / Pass 1 / Pass 2 runtime. No Gate 4C / 4D / 4E
execution. No endpointUrl re-flip. No production traffic. No
customer-facing language upgrade. No secret printing. Any future
Sprint 3 implementation PR, safe_claims governance population PR,
feature-flag flip PR, Lane writer activation PR, AMS bridge /
runtime PR, Pass 1 / Trust / Pass 2 runtime PR, Gate 4C
compatibility-plan PR, Gate 4C execution PR, Gate 4D observation
PR, Gate 4E Track A / Playwright PR, scoring / governance / output
lock-amendment PR, dashboard PR, customer-facing report PR,
customer-facing claim / marketing / sales material PR, deep
research commit PR, issue-fix PR, runtime PR, or final
cutover-readiness claim PR remains separately gated by its own
explicit Helen GO.**
