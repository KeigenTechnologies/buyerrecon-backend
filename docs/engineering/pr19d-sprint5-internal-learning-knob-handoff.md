# BuyerRecon PR#19d: Sprint 5 Internal Learning / Knob Runtime Handoff

> Docs-only contract handoff. No code. No DB change. No migration. No
> `schema.sql` change. No production command. No website change. No
> customer-output activation. No report-runtime activation. No knob
> runtime activation. No scoring runtime activation. No model /
> runtime decision activation. No AMS Trust / Pass 1 / Pass 2 runtime.
> No Lane writer. No Gate 4C execution. No endpoint flip. No canary.
> No secrets.

---

## 1. Status / verdict

**Verdict: CONTRACT_HANDOFF_ONLY — no implementation, no production execution, no Gate 4C approval.**

PR#19d is the contract handoff for the **Sprint 5 Internal Learning
/ Knob Runtime layer** identified as Track C by PR#19a §3 and PR#19a
§6. It defines the table / type contracts for the nine internal
learning surfaces (Founder Pulse, Knob Control, Experiment Lab,
Review Ops, Model Health, Customer Outcomes, Sales Signal Loop,
Insight Library, Improvement Log), the seven core records
(`score_version`, `knob_version`, `review_case`, `outcome_event`,
`replay_corpus`, `improvement_record`, `insight_record`), the four
review queues, the calibration / model-health view set, the knob
governance posture, the official-vs-draft separation rules, the
access matrix, the runtime-proof integration with Sprint 3 / Sprint
4, the minimum test fixtures, the Codex review checklist, and the
proposed implementation sequencing — required before any Sprint 5
implementation PR may be opened.

PR#19d is purely a docs-only contract artefact. It:

- defines the **shape** that future Track C implementation PRs must
  conform to,
- does **not** create any DB table, migration, `schema.sql` entry,
  scoring runtime, knob runtime, review queue runtime,
  improvement-log writer, insight-library reader, calibration
  pipeline, model-health collector, or Founder Pulse view,
- does **not** activate any scoring decision, model decision,
  customer-decision surface, or AMS / Trust / Pass / Lane writer,
- does **not** flip any of the eleven PR#18ab §9 governance locks,
- does **not** authorise any Sprint 5 implementation PR (the next
  step is the first Sprint 5 implementation PR opened under its own
  Helen GO),
- does **not** authorise any Gate 4C compatibility-plan work,
  Gate 4C canary, Gate 4D observation, or Gate 4E Track A /
  Playwright work.

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

## 2. Carry-forward governance posture

PR#19d inherits the following posture from the merged base
(`b7db493` — PR#19c merge #66; also includes PR#18ac merge #63,
PR#20 merge #64, and PR#18ad merge #65 ingested ahead of PR#19c):

- **Gate 4B artifact / config / rollback re-audit:** **non-`BLOCKED`**
  (PR#18aa PASS, recorded on base at PR#18ab merge).
- **Gate 4C `endpointUrl` re-flip execution:** **still unapproved /
  `BLOCKED_PENDING_COMPATIBILITY_PLAN`** per PR#18ac (sub-status
  recorded; pending compatibility-plan chain PR#18ad → PR#18aj).
  PR#18ad (Gate 1 static contract diff confirmation) merged via
  #65 but does **not** lift the sub-status; it only confirms the
  static mismatch and identifies what PR#18ae must do.
- **Gate 4D organic observation:** unapproved.
- **Gate 4E Track A / Playwright:** unapproved.
- **PR#19a deep-research handoff index:** merged on base via #61;
  PR#19d realises Track C of that index.
- **PR#19b Sprint 3 external output contract handoff:** merged on
  base via #62. **External output contracts remain governed by
  PR#18ab safe-claim / output locks** — the `safe_claims`
  dictionary is empty (`allowed_customer_language=[]` holds), and
  the four PR#19b feature flags (`show_evidence_grade`,
  `show_recommendations`, `show_account_inference`,
  `auto_send_reports`) all default to `false`. PR#19b contracts
  remain **inactive** until a separate Sprint 3 implementation
  PR plus a separate governance PR populate the dictionary and
  flip the relevant §9 locks.
- **PR#19c Sprint 4 governance runtime handoff:** **merged on
  base via #66**. PR#19c remains **contract / handoff-only**:
  governance runtime contracts (audit_events, retention,
  deletion workflow, suppression tombstone, deletion receipt,
  retention jobs, monitoring metrics, alert thresholds, incident
  record, workspace / project / site tenancy, role matrix,
  negative tests, external-audit trigger) **remain inactive
  unless a later implementation PR explicitly activates them
  under its own Helen GO**. PR#19d's audit / runtime-proof
  references treat PR#19c contracts as designed-and-merged-but-
  not-runtime-active; PR#19d does **not** pre-authorise
  activation of any PR#19c implementation step
  (PR#19c-impl-a → PR#19c-impl-f per PR#19c §17).
- **PR#20 Sprint 3 external report MVP:** **merged on base via
  #64** (or present as local / testable implementation only).
  PR#20 is a local-testable MVP scaffold; it does **not**
  activate production customer output, does **not** change any
  PR#18ab §9 lock, and does **not** approve report auto-send,
  production / customer activation, Gate 4C execution, Lane A /
  Lane B writer activation, runtime scoring, AMS Trust / Pass 1
  / Pass 2 runtime, or DB changes. PR#19d treats PR#20 as
  designed-and-merged-but-locked-off for customer surfaces;
  Sprint 5 internal-learning surfaces (§4) read PR#20-shaped
  `ReportSnapshot` rows only via internal-only audit / runtime-
  proof paths (§17), never via a customer-facing surface.
- **PR#17s / PR#18w 26-row warning preserved** (no delete,
  mutate, annotate, normalise on the production cluster).

### 2.1 Eleven PR#18ab §9 governance locks (in force)

```
customer_claim_allowed=false
customer_visibility_allowed=false
lane_output_allowed=false
lane_write_allowed=false
runtime_scoring_allowed=false
ams_trust_runtime_allowed=false
pass1_runtime_allowed=false
pass2_runtime_allowed=false
dashboard_customer_output_allowed=false
sales_claim_upgrade_allowed=false
allowed_customer_language=[]
```

No track in §3 – §20 of this handoff flips any of those locks.
Each Track C implementation PR must independently restate this set
(or a strict superset) in its own header.

### 2.2 Upstream dependency: ProductContextProfile v0.1 (PR #76)

`docs/contracts/product-context-profile-v0.1.md` (locked via PR #76,
merged at base `0f98967`) is now upstream of all Sprint 5
internal-learning surfaces.

- The `score_version` / `knob_version` axes defined in this handoff
  are **distinct** from the ProductContextProfile version stamps.
  They do not replace them.
- Any future learning / replay / feedback observation that consumes
  a Product-Context Fit observation must **co-record** the relevant
  PCP §6 version stamps alongside its own version IDs:
  - `product_context_profile_version`
  - `category_template_version`
  - `site_mapping_version`
  - `buying_role_lens_version`
  - `universal_surface_taxonomy_version`
  - `product_fit_model_version`
  - `product_fit_rule_version`
- Internal learning must **not** convert customer-specific feedback
  into customer-private scoring code, if/else logic, or a
  customer-private custom model.
- Recurring patterns become **proposed template / mapping version
  changes** that are replay-tested, shadow-run, then promoted to an
  active version — never private code.

This note is a forward-reference only. It does **not** activate
internal-learning runtime, does **not** activate customer output,
and does **not** flip any PR#18ab §9 lock.

---

## 3. Sprint 5 purpose

Sprint 5 is **not** a customer-facing dashboard. It is **not** a
runtime-scoring approval. It is BuyerRecon's **internal learning
operating system** — a controlled internal workbench whose purpose
is to optimise decision quality over time by learning from
evidence, outcomes, human review, and versioned changes.

### 3.1 Core questions Sprint 5 must answer

1. **What did we learn?** Which patterns recur across cases; which
   limitations recur; which failure modes recur.
2. **Which scoring / knob version produced this result?** Every
   decision-grade artefact must trace back to a specific
   `score_version_id` and `knob_version_id`. No silent version
   drift.
3. **Which cases were false positives / false negatives?** FP and
   FN must be in separate queues, because the operational cost
   shapes differ (FP = customer friction; FN = missed buyer).
4. **Which slices got worse or better?** Cross-version A/B at the
   slice level (workspace, site, segment) — not aggregate-only.
5. **Which changes are official vs draft?** Official metrics /
   insights / knobs are owner-verified and read-only outside their
   versioning flow; drafts are exploratory and never customer-
   facing.
6. **Can we replay and rollback?** Every production-impacting
   change must be replayable against a fixed corpus and one-step-
   rollback-able via aliases.

### 3.2 What Sprint 5 is *not*

- **Not a customer-facing analytics dashboard.** Customer surfaces
  are PR#19b's job (and PR#19b is itself inactive at PR#19d merge).
  Track C surfaces are internal-only.
- **Not a runtime-scoring approval.** All eleven PR#18ab §9 locks
  remain `false`; Sprint 5 does not unlock `runtime_scoring_allowed`,
  `ams_trust_runtime_allowed`, `pass1_runtime_allowed`,
  `pass2_runtime_allowed`, or any customer-output flag.
- **Not a generic BI tool.** No "build any chart" surface; no
  ad-hoc SQL exposed to non-engineering roles; no embedded BI
  product. Specific surfaces, specific contracts.
- **Not a customer-self-service appeal system.** Customers do not
  see review queues, reviewer notes, or insights in v0.1.

---

## 4. Internal learning surfaces (v0.1)

Nine surfaces, each with a clear purpose, audience, and forbidden-
data set. PR#19d records the contracts; PR#19d does not implement
any of them.

### 4.1 Founder Pulse

- **Purpose:** Single weekly view for Helen / founder showing
  whether decision quality is improving, what's queueing, what's
  drifting, and what's awaiting an approval.
- **Audience:** Founder + selected internal admins (read-only).
- **Allowed data:** This-week quality trend; FP / FN trend with
  delta vs prior week; queue aging summary (no per-case PII);
  risky-slice top-5 (slice IDs, not per-case identifiers);
  improvement-record decisions awaiting approval; latest 5
  official insights.
- **Forbidden data:** Raw payloads; raw `request_id` /
  `session_id`; customer names; non-categorical reviewer notes;
  Lane B classifications (always internal-only).
- **Minimum fields:** `week_start`, `decision_quality_score_band`,
  `fp_count`, `fn_count`, `queue_aging_top_5_slice_ids[]`,
  `improvement_records_awaiting_approval_count`,
  `latest_official_insight_ids[]`.
- **First implementation cutline:** Table-first view (no
  visualisation library); read-only; weekly refresh; gated by
  founder role only.
- **Not-now / defer:** Real-time streaming; per-account drilldown;
  customer-facing version; predictive forecast.

### 4.2 Knob Control

- **Purpose:** The canonical place to view what knob versions are
  active, shadow, draft, and rollback-targeted; the only place to
  propose a knob change.
- **Audience:** Product / engineering / founder; analyst read-only.
- **Allowed data:** `knob_version` records (per §6); active /
  shadow / draft status; rollback pointers; recent
  improvement-record decisions affecting knobs.
- **Forbidden data:** Customer PII; raw payloads; production
  secrets; raw site_id mappings for high-value accounts in any
  customer-readable export.
- **Minimum fields (per knob row):** `knob_version_id`,
  `knob_family`, `status`, `owner`, `created_at`,
  `activation_audit_event_id`.
- **First implementation cutline:** Table-first; proposal-by-text
  (link to improvement-record); no auto-rollout.
- **Not-now / defer:** UI knob-editor; auto-tuning; per-customer
  knobs in v0.1.

### 4.3 Experiment Lab

- **Purpose:** Where a shadow knob or shadow scoring version is
  compared against the active version on a fixed replay corpus.
- **Audience:** Product / engineering / analyst.
- **Allowed data:** Replay-corpus IDs; per-slice deltas in
  precision / recall / queue-load; reason-code agreement rates;
  feature-coverage / drift placeholder metrics.
- **Forbidden data:** Raw case bodies; raw `request_id` /
  `session_id`; customer-facing copy; production-activation
  buttons (activation is a separate improvement-record flow).
- **Minimum fields:** `experiment_id`,
  `baseline_score_version_id`, `challenger_score_version_id`,
  `replay_corpus_id`, `slice_delta_summary`,
  `recommendation` ∈ {`keep_baseline`, `promote_challenger`,
  `keep_shadow`, `needs_more_data`}.
- **First implementation cutline:** One challenger at a time per
  scoring-family.
- **Not-now / defer:** Multi-arm A/B; Bayesian decision automation;
  live-traffic A/B (locked off by §2.1).

### 4.4 Review Ops

- **Purpose:** The case-review surface with FP / FN / novelty /
  escalation queues, SLA timers, and disposition recording.
- **Audience:** Internal analyst / reviewer / product.
- **Allowed data:** `review_case` records (per §7); evidence
  bundles linked to the case (categorical evidence; no raw
  payloads); reviewer-note text (internal only).
- **Forbidden data:** Customer-facing reviewer notes by default;
  raw payloads in case detail unless the case has been explicitly
  promoted into the reviewer's full-access scope via break-glass
  audit (PR#19c §14).
- **Minimum fields:** `case_id`, `case_type`, `status`,
  `disposition`, `reviewer_id`, `created_at`, `resolved_at`.
- **First implementation cutline:** Two-queue MVP (FP queue + FN
  queue) plus novelty and escalation as secondary tabs.
- **Not-now / defer:** Customer-self-service appeals; reviewer
  collaboration / multi-reviewer per case in v0.1.

### 4.5 Model Health

- **Purpose:** Internal calibration / drift / coverage / lag view
  across active scoring versions.
- **Audience:** Product / engineering / analyst.
- **Allowed data:** Confusion delta on replay corpus; band
  precision / recall; placeholder reliability diagram; queue-load
  delta; reason-code agreement; slice winners / losers; feature
  coverage; missing-data rate; drift / distribution-shift
  placeholder; delayed-outcome lag distribution.
- **Forbidden data:** Customer-facing confidence claims derived
  from these metrics; per-customer model decisions; any leakage
  of calibration metrics into customer copy (PR#19b
  `safe_claims` forbids this).
- **Minimum fields:** `score_version_id`, `replay_corpus_id`,
  `metric_kind`, `metric_value`, `metric_band`, `as_of`.
- **First implementation cutline:** Table-first read-only view;
  no visualisation library in v0.1.
- **Not-now / defer:** Real-time alerting on drift (Track B
  thresholds may cover the operational alert; calibration drift
  alerting is a later PR).

### 4.6 Customer Outcomes

- **Purpose:** Where delayed actuals (CRM-confirmed buyer / not-
  buyer / qualified / lost outcomes) are recorded, linked to
  prediction cases, and made available for calibration.
- **Audience:** Sales / CS submit; product / engineering /
  analyst read.
- **Allowed data:** `outcome_event` records (per §8); outcome
  status; outcome source; outcome confidence; lag in days; case /
  prediction linkage.
- **Forbidden data:** Raw CRM payloads; raw customer notes;
  customer PII beyond the categorical fields. Source-ref values
  are hashed where possible.
- **Minimum fields (per outcome row):** `outcome_event_id`,
  `case_id`, `outcome_status`, `outcome_source`,
  `outcome_confidence`, `lag_days`, `created_at`.
- **First implementation cutline:** Manual CRM-paste flow before
  CRM integration; integration is its own later PR.
- **Not-now / defer:** Bi-directional CRM sync; auto-classification
  of outcomes; customer-facing outcome surfaces.

### 4.7 Sales Signal Loop

- **Purpose:** Where sales / CS submit categorical feedback ("this
  was a missed buyer", "this was a false alarm", "we lost this
  deal at stage X for reason Y") that feeds into FP / FN queues
  and improvement records.
- **Audience:** Sales / CS submit; product / analyst read.
- **Allowed data:** Categorical feedback tags from a fixed
  taxonomy; deal-stage references (categorical); free-text
  reviewer-only notes (internal only).
- **Forbidden data:** Customer PII; raw CRM payloads; reviewer
  notes in customer surfaces.
- **Minimum fields:** `feedback_id`, `feedback_kind` ∈
  {`missed_buyer`, `false_alarm`, `lost_at_stage`,
  `won_late`, `unclear`}, `tag_set[]`, `submitted_by`,
  `submitted_at`.
- **First implementation cutline:** Form-based intake; routing
  into FP or FN queue per feedback_kind.
- **Not-now / defer:** Auto-tagging by NLP; per-deal CRM
  sub-views; customer-self-reported outcome path.

### 4.8 Insight Library

- **Purpose:** Where verified patterns, limitations, scoring
  rules, customer segments, and failure modes are promoted from
  case-level findings into official internal knowledge.
- **Audience:** Whole internal team read; product / engineering /
  founder verify and promote.
- **Allowed data:** `insight_record` rows (per §11); draft and
  official insights; before / after metric summaries; case
  references.
- **Forbidden data:** Customer-facing copy; raw payloads;
  reviewer-only diagnostic notes.
- **Minimum fields:** `insight_id`, `title`, `status`,
  `insight_type`, `owner`, `verified_at`, `created_at`.
- **First implementation cutline:** Append-only with `status`
  transitions; verification by founder + product.
- **Not-now / defer:** Customer-facing knowledge base; auto-
  generation of insights from patterns; insight-search UI.

### 4.9 Improvement Log

- **Purpose:** Append-only audit ledger of every production-
  impacting change (scoring version, knob version, reason-code
  dictionary, evidence contract, report template, review policy)
  with hypothesis, replay-result summary, decision, and rollback
  pointer.
- **Audience:** Read-only for the whole internal team; founder
  approves additions affecting production aliases.
- **Allowed data:** `improvement_record` rows (per §10); replay-
  result summaries; slice-impact summaries.
- **Forbidden data:** Customer PII; raw payloads; production
  secrets.
- **Minimum fields:** `improvement_record_id`, `change_type`,
  `before_version_id`, `after_version_id`, `decision`,
  `decided_by`, `decided_at`, `rollback_pointer`,
  `audit_event_id`.
- **First implementation cutline:** Append-only; no mutation; no
  deletion; one record per production-impacting change attempt.
- **Not-now / defer:** Automated drafting from experiment
  results; multi-stage approval workflows.

---

## 5. `score_version` contract

```ts
interface ScoreVersion {
  // Identity
  score_version_id: string;                 // ULID / UUIDv7
  version_label: string;                    // human-readable, e.g. "scoring-v0.3.1"
  scoring_family: string;                   // e.g. "lane_a_classifier", "lane_b_classifier",
                                            //   "pass1_evidence", "trust_v01"
  lane_scope: "lane_a" | "lane_b" | "shared" | "none";
  reason_code_dictionary_version: string;   // pinned dictionary version
  evidence_contract_version: string;        // pinned evidence-contract version (PR#19b §3)

  // Provenance
  created_at: string;                       // ISO 8601 UTC
  created_by: string;                       // actor_id (PR#19c §4)

  // Lifecycle
  status:
    | "draft"
    | "shadow"
    | "active"
    | "deprecated"
    | "rolled_back";

  // Lineage
  predecessor_version_id: string | null;    // what this version replaced
  rollback_version_id: string | null;       // what this version rolled back to (if rolled_back)

  // Activation governance
  activation_approved_by: string | null;    // actor_id; only set on transition into "active"
  activation_audit_event_id: string | null; // PR#19c §4 audit row

  notes: string | null;                     // internal-only; not customer-readable
}
```

### 5.1 Rules

- **No silent scoring changes.** Every transition from `draft` to
  `shadow`, `shadow` to `active`, or `active` to `deprecated` /
  `rolled_back` writes an `improvement_record` (§10) and one
  `audit_events` row.
- **Any runtime scoring version change requires a separate
  governance PR.** PR#19d does not flip
  `runtime_scoring_allowed=false`. The `active` status defined
  here is the **internal state machine** position; flipping the
  governance lock to actually run an `active` scoring version in
  production is a separate later PR under its own Helen GO.
- **`predecessor_version_id` is required for any non-initial
  version.** Lineage cannot be inferred.
- **`activation_approved_by` and `activation_audit_event_id` are
  required for `status="active"`.** Both fields null + status
  `active` is a contract violation.

---

## 6. `knob_version` contract

```ts
interface KnobVersion {
  // Identity
  knob_version_id: string;                  // ULID / UUIDv7
  version_label: string;                    // e.g. "review_band_thresholds-v0.4"
  knob_family: string;                      // §14 knob family enum

  // Scope
  scope: "global" | "workspace" | "site" | "segment" | "shadow_only";

  // Lifecycle
  status:
    | "draft"
    | "shadow"
    | "active"
    | "deprecated"
    | "rolled_back";

  // Content (categorical-only; no secrets)
  config_json: Record<string, unknown>;     // structured knob values; no DSN / token / payload
  hypothesis: string;                       // why this knob change is proposed
  expected_effect: string;                  // categorical predicted effect
  queue_impact_estimate: {
    fp_delta_band: "negative" | "neutral" | "positive" | "unknown";
    fn_delta_band: "negative" | "neutral" | "positive" | "unknown";
    queue_load_delta_band: "negative" | "neutral" | "positive" | "unknown";
  };

  // Provenance
  owner: string;                            // actor_id
  created_at: string;                       // ISO 8601 UTC

  // Activation governance
  approved_by: string | null;
  activation_audit_event_id: string | null;
  rollback_pointer: string | null;          // pointer back to the prior active knob_version_id

  notes: string | null;                     // internal-only
}
```

### 6.1 Rules

- **No freeform production knob mutation.** A production-active
  knob may only be changed by transitioning the active alias to
  a different `knob_version_id` whose `status="active"`. Direct
  edit of an `active` row is forbidden.
- **Every knob change requires a hypothesis.** `hypothesis` is a
  non-empty string for every record in `draft` / `shadow` /
  `active`. Records without hypothesis cannot transition past
  `draft`.
- **Production activation requires a separate Helen GO.** Marking
  `status="active"` in the table is allowed only after a
  governance PR explicitly approves the activation. The act of
  changing the runtime alias to point at this version is **also**
  a separate Helen GO.
- **v0.1 may use a table-first internal view.** A full
  Knob-Control dashboard is deferred. A read-only table over
  `knob_version` and the active-alias pointer is sufficient for
  v0.1.

---

## 7. `review_case` contract

```ts
interface ReviewCase {
  // Identity
  case_id: string;                          // ULID / UUIDv7
  case_type:
    | "false_positive"
    | "false_negative"
    | "novelty"
    | "escalation"
    | "unclear";

  // Tenancy
  workspace_id: string;
  site_id: string;
  account_id: string | null;                // categorical account_ref (not raw)
  session_id: string | null;                // categorical session_ref (not raw)

  // Anchors
  evidence_bundle_id: string;               // links to evidence (PR#19b §3.1 atoms)
  score_version_id: string;                 // §5
  knob_version_id: string;                  // §6

  // Predicted outcome at case open time
  predicted_route: "review" | "approve" | "suppress" | "ignore";
  predicted_evidence_grade: "E0" | "E1" | "E2" | "E3" | "E4";   // PR#19b §6

  // Review
  reviewer_id: string | null;
  status:
    | "open"
    | "in_review"
    | "resolved"
    | "superseded";
  disposition:
    | "confirmed_fp"
    | "confirmed_fn"
    | "confirmed_tp"
    | "confirmed_tn"
    | "unclear"
    | "insufficient_evidence"
    | null;
  override_reason_code: string | null;      // categorical-only
  reviewer_notes: string | null;            // internal-only; never customer-visible

  // Lifecycle
  created_at: string;
  resolved_at: string | null;
  outcome_event_id: string | null;          // §8 link once delayed actual arrives
}
```

### 7.1 Rules

- **FP and FN are separate queues.** §12 enforces this at the
  queue layer; the contract enforces it at the disposition layer
  (`confirmed_fp` vs `confirmed_fn`).
- **Every override has reason + reviewer.** A case whose
  `override_reason_code` is set must also have `reviewer_id` set.
  Anonymous overrides are forbidden.
- **Customer-visible output must not expose `reviewer_notes` by
  default.** Reviewer notes are internal-only.
- **`evidence_bundle_id` must resolve to a valid bundle.** A case
  cannot be opened without anchored evidence.

---

## 8. `outcome_event` contract

```ts
interface OutcomeEvent {
  // Identity
  outcome_event_id: string;
  case_id: string | null;                   // §7 link
  prediction_id: string | null;             // link to scoring-output row when available
  workspace_id: string;
  site_id: string | null;

  // Outcome content
  outcome_status:
    | "won"
    | "lost"
    | "qualified"
    | "not_buyer"
    | "still_researching"
    | "unknown";
  outcome_source:
    | "CRM"
    | "sales_feedback"
    | "customer_feedback"
    | "manual_review"
    | "imported";
  outcome_confidence: "low" | "medium" | "high";

  // Provenance
  lag_days: number;                         // days from case opened to outcome arrived
  source_ref_hash: string | null;           // hash of source-system ID; never raw
  notes: string | null;                     // internal-only
  created_at: string;
  created_by: string;                       // actor_id
}
```

### 8.1 Rules

- **Delayed actuals are expected.** `lag_days > 0` is the norm;
  the runtime must tolerate outcome arrival days / weeks after
  case open.
- **Outcome can arrive after report generation.** If a customer
  has already received a 24h report (PR#19b §3.6 `ReportSnapshot`),
  a later outcome event must **not** silently rewrite the historic
  snapshot — the snapshot is immutable. The outcome flows into
  internal learning only.
- **Outcome confidence is required.** A `low` outcome confidence
  produces a different weight in calibration than `high`; the
  calibration view (§13) treats them separately.
- **Source references are hashed.** Raw CRM IDs are not stored;
  `source_ref_hash` is sufficient for re-correlation and avoids
  raw-data persistence in the learning ledger.

---

## 9. `replay_corpus` contract

```ts
interface ReplayCorpus {
  // Identity
  replay_corpus_id: string;
  name: string;                             // e.g. "lane_a_baseline_v0.1"
  purpose: string;                          // e.g. "Smoke-test classifier changes against
                                            //   known-good and known-bad cases"

  // Lifecycle
  status: "draft" | "official" | "archived";
  created_at: string;
  owner: string;                            // actor_id

  // Contents
  case_ids: string[];                       // §7 case_ids
  evidence_bundle_ids: string[];            // PR#19b §3.1 evidence anchors
  inclusion_rules: string;                  // categorical rule description
  exclusion_rules: string;                  // categorical rule description

  // Privacy
  privacy_class:
    | "hashed_only"
    | "categorical_only"
    | "evidence_atoms_no_payload"
    | "elevated_includes_payload";          // elevated_includes_payload requires
                                            //   separate Helen GO; v0.1 default is
                                            //   evidence_atoms_no_payload or lower

  // Bookkeeping
  last_replayed_at: string | null;
  notes: string | null;
}
```

### 9.1 Rules

- **Every production scoring / knob change must be tested against
  at least one replay corpus before activation.** No activation PR
  may merge without a recorded replay-result summary in the
  matching `improvement_record` (§10).
- **Official corpora are read-only except through versioned
  updates.** Cases may be **added** to an official corpus via a
  new versioned corpus (e.g. `official-v0.2`), but cases cannot
  be modified or removed from a prior official version. This
  preserves comparability of replay results across time.
- **Raw payloads are not included unless separately approved.**
  Default `privacy_class` is `evidence_atoms_no_payload` or lower;
  `elevated_includes_payload` requires a separate Helen GO.

---

## 10. `improvement_record` contract

```ts
interface ImprovementRecord {
  // Identity
  improvement_record_id: string;            // ULID / UUIDv7
  hypothesis: string;                       // non-empty
  change_type:
    | "scoring"
    | "knob"
    | "reason_code"
    | "evidence_contract"
    | "report_template"
    | "review_policy";
  changed_object_id: string;                // points at score_version_id, knob_version_id,
                                            //   etc. depending on change_type

  // Lineage
  before_version_id: string;
  after_version_id: string;

  // Replay evidence
  benchmark_corpus_id: string;              // §9 replay_corpus_id
  replay_result_summary: string;            // categorical summary
  slice_impact_summary: string;             // categorical per-slice winners / losers
  queue_impact_summary: string;             // categorical FP / FN / queue-load delta

  // Decision
  decision:
    | "accept"
    | "reject"
    | "shadow"
    | "rollback"
    | "needs_more_data";
  decided_by: string;                       // actor_id
  decided_at: string;                       // ISO 8601 UTC

  // Reversibility
  rollback_pointer: string;                 // points back to the prior active version

  // Cross-link
  audit_event_id: string;                   // PR#19c §4 audit row

  notes: string | null;                     // internal-only
}
```

### 10.1 Rules

- **Append-only.** No `UPDATE`, no `DELETE` against
  `improvement_record`. A reversal is itself a new
  `improvement_record` with `change_type` matching the original
  and `decision="rollback"`.
- **No silent deletion.** Even if a decision turns out to be a
  mistake, the original record stays; the correction is a new
  appended record.
- **Every production activation links to an improvement_record.**
  Promoting a `score_version` or `knob_version` to `active`
  requires a matching `improvement_record` with
  `decision="accept"`.
- **Incident-related rollbacks also create an improvement_record.**
  When a Track B incident (PR#19c §12) leads to a scoring /
  knob rollback, the rollback emits an `improvement_record` with
  `decision="rollback"`, plus the originating
  `incident_id` in the cross-link metadata.

---

## 11. `insight_record` contract

```ts
interface InsightRecord {
  // Identity
  insight_id: string;
  title: string;

  // Lifecycle
  status: "draft" | "official" | "superseded";
  insight_type:
    | "pattern"
    | "limitation"
    | "scoring_rule"
    | "customer_segment"
    | "failure_mode";

  // Anchors
  related_case_ids: string[];               // §7 cases that surfaced this insight
  related_improvement_records: string[];    // §10 improvement records that acted on it

  // Content
  evidence_summary: string;                 // categorical, internal-only
  before_after_metric_summary: string;      // categorical, internal-only

  // Provenance
  owner: string;                            // actor_id
  verified_at: string | null;               // only set on transition to "official"
  superseded_by: string | null;             // insight_id of the successor
  created_at: string;
}
```

### 11.1 Rules

- **Repeated case findings should be promoted to official
  insights.** A pattern that surfaces across N ≥ 3 review cases
  with consistent disposition is a candidate for promotion.
- **Draft insights cannot be customer-facing.** §15 enforces
  this at the visibility layer.
- **Official insights require `owner` and `verified_at`.** A
  record with `status="official"` must have both fields
  non-null.
- **Supersession preserves history.** An insight that is
  superseded is **not** deleted; `status="superseded"` and
  `superseded_by` are set, and the record stays in the library
  for cross-version comparison.

---

## 12. Review queues

Four queues. Each has its own SLA, entry conditions, and downstream
learning action.

### 12.1 `false_positive_queue`

- **Purpose:** Cases where BuyerRecon flagged a session / account
  but later evidence or sales / CS feedback indicates the flag
  was wrong (real customer friction).
- **Entry conditions:** `review_case.case_type="false_positive"`
  OR a `sales_feedback` row with `feedback_kind="false_alarm"`
  matched to a recent prediction.
- **Default priority:** higher than novelty / unclear; lower
  than escalation. Within the queue: prioritise high-value
  accounts (revenue-weighted).
- **SLA:** internal review within 5 working days.
- **Required fields:** `case_id`, `evidence_bundle_id`,
  `score_version_id`, `knob_version_id`,
  `predicted_evidence_grade`.
- **Close condition:** `status="resolved"` with `disposition` ∈
  {`confirmed_fp`, `confirmed_tp`, `unclear`,
  `insufficient_evidence`}.
- **Downstream learning action:** a confirmed FP may feed an
  `improvement_record` proposing a scoring / knob change; a
  confirmed TP closes without learning action; unclear cases may
  promote to a deeper-review queue.

### 12.2 `false_negative_queue`

- **Purpose:** Cases where BuyerRecon failed to flag a session /
  account but later evidence or CRM outcome shows the visitor was
  a real buyer (missed-buyer).
- **Entry conditions:** `outcome_event.outcome_status="won"`
  matched to a case that BuyerRecon scored as approve / suppress;
  OR a `sales_feedback` row with `feedback_kind="missed_buyer"`.
- **Default priority:** **revenue-weighted** — FN on a
  high-revenue account outranks FN on a low-revenue account.
- **SLA:** internal review within 5 working days.
- **Required fields:** same as §12.1 plus `outcome_event_id`.
- **Close condition:** same as §12.1 with `disposition` ∈
  {`confirmed_fn`, `confirmed_tn`, `unclear`,
  `insufficient_evidence`}.
- **Downstream learning action:** confirmed FN feeds an
  `improvement_record` proposing scoring / knob updates to
  reduce missed-buyer rate without inflating FP.

### 12.3 `novelty_queue`

- **Purpose:** Cases that don't match any existing reason-code
  pattern strongly — candidates for new pattern discovery.
- **Entry conditions:** `review_case.case_type="novelty"`; or
  scoring-worker emits a `novel_pattern` flag.
- **Default priority:** lower than FP / FN; higher than unclear.
- **SLA:** internal review within 10 working days.
- **Required fields:** same as §12.1.
- **Close condition:** `disposition` may be any of the FP-queue
  set, plus `unclear` if the case truly is novel and needs more
  data.
- **Downstream learning action:** novel patterns surface to
  `insight_record` candidates.

### 12.4 `escalation_queue`

- **Purpose:** High-value or high-risk cases where a confident
  decision needs founder / product attention before review.
- **Entry conditions:** high-value account flagged with low
  evidence-grade; or a case touching a Track B incident; or a
  case where the scoring version disagrees strongly between
  active and shadow versions.
- **Default priority:** highest.
- **SLA:** internal review within 2 working days.
- **Required fields:** same as §12.1 plus `escalation_reason`
  (categorical).
- **Close condition:** founder or product owner records
  disposition.
- **Downstream learning action:** may trigger an immediate
  `improvement_record` (especially in incident-linked cases).

### 12.5 Queue invariants

- **FP and FN are not merged.** A single ambiguous case is
  routed to whichever queue its `case_type` indicates; if truly
  ambiguous, it enters `novelty_queue`, not a merged-FP/FN
  surface.
- **Revenue-weighted misses for FN.** §12.2 ordering rule.
- **High-value account FP prioritised.** §12.1 ordering rule.
- **Unclear / insufficient evidence is a valid resolution.**
  Forcing a disposition when evidence does not support one is a
  contract violation; `disposition="unclear"` or
  `"insufficient_evidence"` is the right answer in that case.

---

## 13. Calibration and model-health views (v0.1, internal-only)

Per `replay_corpus` (§9) and per `score_version` (§5), the
following metrics are recorded for internal use:

| Metric | Shape | Notes |
|---|---|---|
| Confusion delta vs prior version | `{ tp_delta, fp_delta, tn_delta, fn_delta }` | absolute counts on the same replay corpus |
| Band precision per evidence-grade band | `precision_at_band(E1..E4)` | bucketed by PR#19b §6 evidence_grade |
| Band recall per evidence-grade band | `recall_at_band(E1..E4)` | same bucketing |
| Reliability diagram (placeholder) | bin → predicted-prob vs observed-rate | placeholder for v0.1; full diagram is a later impl |
| Brier-style calibration metric (placeholder) | scalar | placeholder for v0.1 |
| Queue-load delta | `{ fp_queue_delta, fn_queue_delta, novelty_queue_delta, escalation_queue_delta }` | per replay |
| Reason-code agreement | per-code agreement rate vs prior version | which codes are stable |
| Slice winners / losers | per-slice (workspace, site, segment) precision/recall delta | small-N slices flagged separately |
| Feature coverage | per-feature non-null rate | identifies missing-data dependencies |
| Missing-data rate | overall non-null rate across required features | tracks ingest-quality drift |
| Drift / distribution-shift (placeholder) | scalar per feature | placeholder for v0.1 |
| Delayed-outcome lag distribution | histogram of `outcome_event.lag_days` | informs when calibration is valid |

### 13.1 Rules

- **Internal only.** None of these metrics may be surfaced to
  customers under v0.1. `runtime_scoring_allowed=false` /
  `customer_visibility_allowed=false` keep the door closed.
- **Not a customer-facing model-health dashboard.** PR#19d does
  **not** implement a public model-health dashboard.
- **No model-health dashboard implementation in PR#19d.** The
  Model Health surface (§4.5) is a contract; the implementation
  is a separate later PR.
- **Table-first view acceptable for MVP.** No visualisation
  library required in v0.1.

---

## 14. Knob governance

High-leverage knob families that the §6 `knob_version` contract
must support. Each knob family below specifies who may propose,
who may approve, what evidence is required before activation, the
rollback method, and the v0.1 default status.

### 14.1 Knob families

1. **Review-band thresholds** — where the scoring bands cut for
   review vs auto-approve vs auto-suppress.
2. **Source-trust weights** — relative trust applied to each
   evidence source (ThinSDK / collector / signed-agent / etc.).
3. **Freshness-decay window** — how quickly old evidence loses
   weight.
4. **Minimum evidence count** — minimum atoms required for a
   non-thin scoring decision.
5. **Missing-data penalty** — penalty applied when required
   fields are absent.
6. **Reason-code confidence gate** — minimum confidence before a
   reason code can be surfaced.
7. **High-value escalation threshold** — revenue threshold above
   which any flag escalates to §12.4.
8. **Novelty routing threshold** — distance from known patterns
   above which a case routes to §12.3.
9. **Shadow ratio / holdout ratio** — fraction of traffic
   evaluated by a shadow version vs the active version (always
   non-customer-impacting in v0.1; shadow_only scope).
10. **Model / version alias** — which `score_version` or
    `knob_version` is currently `active` vs `shadow` vs
    `rolled_back`.

### 14.2 Per-family governance (v0.1)

| Knob family | Who may propose | Who may approve | Evidence required | Rollback method | v0.1 default status |
|---|---|---|---|---|---|
| Review-band thresholds | Product / analyst | Founder | replay-corpus result + slice impact | alias revert to prior `knob_version_id` | locked / not active |
| Source-trust weights | Engineering / product | Founder | replay-corpus result + reason-code agreement | alias revert | locked / not active |
| Freshness-decay window | Engineering | Product | replay-corpus result | alias revert | locked / not active |
| Minimum evidence count | Engineering / product | Founder | replay-corpus result + queue-load delta | alias revert | locked / not active |
| Missing-data penalty | Engineering | Product | replay-corpus result | alias revert | locked / not active |
| Reason-code confidence gate | Product / analyst | Founder | replay-corpus result + reason-code agreement | alias revert | locked / not active |
| High-value escalation threshold | Founder / sales lead | Founder | escalation-queue audit + revenue-weighted FN | alias revert | locked / not active |
| Novelty routing threshold | Engineering / analyst | Product | novelty-queue load history | alias revert | locked / not active |
| Shadow / holdout ratio | Engineering | Product | shadow_only scope; no customer impact required | shadow disable | shadow_only allowed for non-prod traffic; locked for prod |
| Model / version alias | Engineering / product | Founder | improvement_record with `decision="accept"` | alias revert | locked / not active |

### 14.3 Rules

- **All production knobs default locked.** Until a Helen GO + an
  `improvement_record.decision="accept"` matches a specific
  `knob_version_id`, no production runtime consults it.
- **Active alias cannot change without approval.** Promoting a
  `knob_version` to `active` requires the approval matrix above.
- **Sandbox / shadow allowed only as non-customer-impacting
  state.** `scope="shadow_only"` is the v0.1 default for
  experimental knob versions; cases routed through a shadow knob
  produce **internal** comparison data only, never a customer-
  facing decision.

---

## 15. Official vs draft spaces

A strict separation between **draft / sandbox / experimental**
artefacts and **official / production-relevant** artefacts. The
separation is enforced at the contract layer so the rendering
layer can't accidentally surface drafts to customers.

### 15.1 Per-artefact dimensions

- **Draft metrics** — calibration / model-health views computed
  against a draft `score_version` or draft `replay_corpus`. Never
  customer-facing.
- **Official metrics** — same kind, but computed against an
  `official` `replay_corpus` and an `active` (or prior `active`)
  `score_version`. Internal team-wide read; never customer-
  facing in v0.1.
- **Draft insights** — `insight_record.status="draft"`. Never
  customer-facing.
- **Official insights** — `insight_record.status="official"` with
  `verified_at` non-null. Internal team-wide read; not
  customer-facing in v0.1.
- **Sandbox knobs** — `knob_version` with `scope="shadow_only"`
  or `status="draft"`. Never used by production runtime.
- **Active knobs** — `knob_version` with `status="active"`, used
  by production runtime (when the §2.1 locks are eventually lifted
  by a separate governance PR).
- **Shadow challengers** — `score_version` /
  `knob_version` with `status="shadow"`, evaluated in parallel
  against an `active` for comparison. No customer impact.
- **Production aliases** — runtime pointers to the currently
  `active` versions. Aliases change only via
  `improvement_record.decision="accept"` plus an
  `audit_events` row.

### 15.2 Rules

- **Draft cannot become customer-facing.** No transition path
  exists in v0.1 that turns a draft into a customer-rendered
  artefact without going through `official` (or `active`).
- **Official requires verification.** `verified_at` is mandatory
  for official insights; `activation_approved_by` is mandatory
  for active versions.
- **Query / contract change invalidates verification.** If the
  underlying evidence contract (PR#19b §3) changes such that
  metrics computed against the old contract no longer apply,
  the dependent official insights / official metrics revert to
  `status="superseded"` and a new verification cycle is
  required.
- **Superseded state preserves history.** Superseded records
  are not deleted; `superseded_by` is set, and the original is
  retained for cross-version comparison.

---

## 16. Access and visibility

### 16.1 Internal roles

The Sprint 5 surfaces extend the PR#19c §14 role matrix with
internal-team-only roles for the learning system. External
customer roles (Viewer, etc.) do **not** see any Sprint 5
surface in v0.1.

- **Helen / founder** — approves production aliases, knob
  activations, official insight promotion; reads all Sprint 5
  surfaces.
- **Product / engineering** — proposes scoring / knob changes;
  writes `improvement_record`; manages replay corpora; reads all
  Sprint 5 surfaces.
- **Analyst / reviewer** — reviews cases in §12 queues; can
  promote draft insights to candidates for verification (but
  cannot mark `status="official"` themselves).
- **Sales / CS** — submits §4.7 sales-signal feedback; reads
  Customer Outcomes (§4.6) for their accounts; cannot change
  knobs, scoring, or aliases.
- **External customer** — **no access** to any Sprint 5 surface
  in v0.1.

### 16.2 Forbidden cross-role leakage

- **External customer cannot see:** internal knobs (§6 / §14),
  raw reviewer notes (§7 `reviewer_notes`), hidden scoring
  weights, Lane B classifications, internal model-health
  metrics (§13), raw evidence beyond what the PR#19b approved
  report objects already expose.
- **Sales / CS can submit feedback but cannot change knobs.**
  Submission flows go through §4.7 intake; knob changes go
  through §6 + §10 with Founder approval.
- **Analyst can review cases but cannot activate production
  scoring / knobs.** Analyst proposes; founder approves;
  engineering wires.
- **Founder approves production alias / knob activation.** No
  other role has alias-flip authority in v0.1.

---

## 17. Runtime-proof integration

Sprint 5 links to Sprint 3 (PR#19b) and Sprint 4 (PR#19c) via the
shared runtime-proof / audit-event schema. Specifically:

- **Every `ReportSnapshot` (PR#19b §3.6) links to
  `score_version_id` and `knob_version_id` if any scoring or
  knob influenced its content.** The link goes through the
  shared runtime-proof row (PR#19b §10 narrative proof) so a
  rendered snapshot can always be traced to the scoring /
  knob versions in effect at render time.
- **Every `ClaimBlock` (PR#19b §3.5) links to `evidence_refs`.**
  PR#19d does not change this; it confirms the linkage is
  required.
- **Every `review_case` (§7) links to `evidence_bundle_id`.** No
  case may be opened without anchored evidence.
- **Every `improvement_record` (§10) links to
  `replay_corpus_id` and `audit_event_id`.** The
  `replay_corpus_id` provides the evidence; the
  `audit_event_id` records the decision (PR#19c §4).
- **Every production activation requires an `audit_event_id`.**
  Promoting any `score_version` or `knob_version` to `active`,
  flipping any alias, or updating any official insight requires
  a matching PR#19c §4 audit row.
- **Every rollback links to `rollback_pointer`.** The pointer
  identifies the prior version the runtime returns to; the
  rollback itself is its own `improvement_record` and its own
  `audit_event_id`.

---

## 18. Test fixtures

Sprint 5 implementation PRs must implement against at least the
following fixtures. Each fixture is a deterministic input set
that produces a known internal-learning state.

1. **False-positive case.** A case where evidence supports
   "approve" but BuyerRecon scored "review" or "suppress";
   confirmed FP via §12.1 disposition. Asserts FP queue routing,
   `improvement_record` candidacy, and no customer-facing
   leakage.
2. **False-negative case.** A case where evidence missed a real
   buyer; `outcome_event.outcome_status="won"` arrives later.
   Asserts FN queue routing, revenue-weighted ordering, and
   `improvement_record` candidacy.
3. **Unclear / insufficient-evidence case.** A case where
   `disposition="unclear"` or `"insufficient_evidence"` is the
   right outcome. Asserts that no forced disposition is allowed
   and no `improvement_record` is auto-generated.
4. **Delayed actual after report generation.** An `outcome_event`
   arrives after a `ReportSnapshot` (PR#19b §3.6) has been
   rendered for the same window. Asserts that the snapshot
   stays immutable and the outcome flows into internal learning
   only.
5. **Knob-version shadow comparison.** Two `knob_version` rows
   evaluated against the same `replay_corpus`; the experiment
   lab (§4.3) produces a slice-impact summary. Asserts that
   shadow status produces no customer impact.
6. **Rollback alias restore.** An active `score_version` rolled
   back to its predecessor via alias revert. Asserts that the
   rollback writes an `improvement_record` with
   `decision="rollback"` and an `audit_events` row.
7. **Official insight superseded by later evidence.** An
   `insight_record` with `status="official"` is superseded by a
   later record; `superseded_by` is set; both records remain
   queryable. Asserts no deletion.
8. **Sales feedback mapped to taxonomy.** A sales-feedback row
   with `feedback_kind="missed_buyer"` routes into the FN queue
   with categorical tags; the original free-text reviewer note
   stays internal-only.
9. **Customer-visible report excludes internal notes.** A
   `ReportSnapshot` rendered for a case with non-null
   `reviewer_notes` must serialise without those notes.
   Asserts §7 visibility rule.
10. **Lane B evidence cannot enter customer output.** A
    `review_case` whose evidence includes Lane B
    classifications routes through internal review only; the
    customer-facing `ClaimBlock` is suppressed for any field
    that would surface Lane B content.

---

## 19. Codex review checklist

Track C implementation PRs must pass:

- **No runtime scoring activation.** No PR may flip
  `runtime_scoring_allowed=false` without a separate governance
  PR.
- **No customer-visible knob leak.** `knob_version.config_json`
  must not appear in any customer-facing output.
- **No Lane B customer leak.** Lane B classifications must not
  surface in any customer-facing artefact.
- **No reviewer notes in external output.**
  `review_case.reviewer_notes` must be suppressed in every
  `ReportSnapshot` / dashboard render.
- **No production alias change without `audit_event_id`.** Any
  alias flip must reference a non-null PR#19c §4 audit row.
- **No scoring change without `score_version_id`.** Every
  scoring path must carry the version forward into runtime
  proof.
- **No knob change without `knob_version_id`.** Every knob path
  must carry the version forward.
- **No `improvement_record` mutation / deletion.** Append-only
  invariant.
- **No official insight without `verified_at`.** The
  `status="official"` transition without `verified_at` is a
  contract violation.
- **No delayed outcome rewriting old `ReportSnapshot`.** PR#19b
  §3.6 snapshots are immutable; an `outcome_event` may inform
  internal learning but not retroactively edit a rendered
  customer artefact.
- **No raw payloads in `replay_corpus` by default.** Default
  `privacy_class` is `evidence_atoms_no_payload` or stricter.
- **No customer-facing confidence claim from calibration-only
  metric.** Calibration metrics (§13) are internal-only;
  PR#19b's `safe_claims` dictionary may not include any entry
  that surfaces a calibration value directly.

---

## 20. Implementation sequencing

PR#19d does not implement anything. The following sequence is
the recommended path forward; each future PR requires its own
explicit Helen GO scoped to that step:

1. **PR#22a — `score_version` / `knob_version` contracts.**
   Schema PR for the two version tables (per §5 + §6). No
   activation runtime; only the schema + a stub write path.
2. **PR#22b — `improvement_log` append-only record.** Implements
   the `improvement_record` table (§10) with the append-only
   invariant. Hooks into PR#19c §4 `audit_events` for the
   cross-link.
3. **PR#22c — `case_review_queue` skeleton.** Implements the
   four §12 queues as four queries / views over `review_case`
   (§7). No reviewer-runtime UI in this PR.
4. **PR#22d — FP / FN taxonomy and fixtures.** Implements the
   §18 fixtures 1–3 against the §12 queues. Green-on-deny
   first.
5. **PR#22e — `replay_corpus` placeholder.** Implements the
   `replay_corpus` table (§9) with `privacy_class` default
   `evidence_atoms_no_payload`. No real corpus seeded.
6. **PR#22f — `outcome_event` object.** Implements the §8
   contract plus manual CRM-paste flow. No CRM integration in
   this PR.
7. **PR#22g — Founder Pulse table-first view.** Implements §4.1
   as a read-only table query. No visualisation library.
8. **PR#22h — knob alias / rollback pointer.** Implements the
   `knob_version` alias mechanism (§6 / §15) and the rollback-
   pointer wiring (§17). Still no production activation.

Each PR#22* requires separate Helen GO and Codex review. No
implementation in PR#19d.

---

## 21. Non-goals

PR#19d explicitly does **not** approve any of the following.
Each requires its own explicit Helen GO scoped to that specific
work:

- no code,
- no migrations,
- no DB writes,
- no `schema.sql` change,
- no runtime scoring,
- no knob runtime activation,
- no production alias flip,
- no customer-output activation,
- no Lane A / Lane B writer activation,
- no AMS Trust runtime,
- no Pass 1 runtime,
- no Pass 2 runtime,
- no Gate 4C execution,
- no Gate 4C canary,
- no Gate 4D organic observation,
- no Gate 4E Track A / Playwright work,
- no `endpointUrl` re-flip,
- no production traffic generation,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no `/var/www` edit,
- no symlink change,
- no `nginx -s reload`, no `systemctl` action, no service
  restart,
- no DNS change,
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no
  `buyerrecon_migrator` reset, no production token provisioning,
- no Track A invocation, no Playwright run,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no dashboard implementation,
- no Model Health dashboard implementation,
- no Insight Library UI implementation,
- no Founder Pulse visualisation layer beyond table-first,
- no Knob Control UI beyond table-first,
- no Experiment Lab automation beyond manual approval,
- no Review Ops customer-self-service flow,
- no flipping of any PR#18ab §9 lock
  (`customer_claim_allowed`, `customer_visibility_allowed`,
  `lane_output_allowed`, `lane_write_allowed`,
  `runtime_scoring_allowed`, `ams_trust_runtime_allowed`,
  `pass1_runtime_allowed`, `pass2_runtime_allowed`,
  `dashboard_customer_output_allowed`,
  `sales_claim_upgrade_allowed`,
  `allowed_customer_language=[]`),
- no flipping of any PR#19b external-output feature flag
  (`show_evidence_grade`, `show_recommendations`,
  `show_account_inference`, `auto_send_reports`),
- no population of the PR#19b `safe_claims` dictionary,
- no PR#19c governance-runtime implementation,
- no deletion / mutation / annotation / normalisation of the 26
  historical PR#17s rows on the production cluster,
- no secret printing (DSN, generated password, DB username /
  password pair, `Authorization:` header value, raw
  `request_id`, raw `session_id`, raw payload, raw response
  body, env dump, private key / cert body, vault content, shell
  history, raw row data).

---

## 22. Acceptance criteria

PR#19d is acceptable for merge into
`sprint2-architecture-contracts-d4cc2bf` only if **all** of the
following hold:

- **Docs-only.** Exactly one new file changes in the repo:
  `docs/engineering/pr19d-sprint5-internal-learning-knob-handoff.md`.
  No code, no scripts, no tests, no package files, no
  migrations, no `schema.sql`, no env files, no systemd / Nginx
  files, no AMS source, no website artifacts, no production
  config, no DB grant files change.
- **Internal learning contracts defined.** §4 enumerates the
  nine surfaces.
- **`score_version` / `knob_version` contracts defined.** §5
  and §6 are field-level explicit.
- **`review_case` / `outcome_event` / `replay_corpus` /
  `improvement_record` / `insight_record` contracts defined.**
  §7 through §11 are field-level explicit.
- **Review queues defined.** §12 enumerates four queues with
  entry / SLA / fields / close / downstream actions.
- **Calibration / model-health internal metrics defined.** §13
  enumerates the metric set; v0.1 table-first allowed.
- **Knob governance defined.** §14 lists 10 knob families and
  the per-family approval matrix.
- **Official-vs-draft rules defined.** §15.
- **Access / visibility rules defined.** §16.
- **Runtime-proof integration defined.** §17 cross-links to
  PR#19b + PR#19c.
- **Fixtures listed.** §18 enumerates 10 fixtures.
- **Codex checklist included.** §19 has 12 rules.
- **Implementation sequencing proposed.** §20 sequences PR#22a
  → PR#22h, each requiring its own Helen GO.
- **PR#18ab locks preserved.** §2.1 carries all eleven
  `*_allowed=false` / `allowed_customer_language=[]` locks
  verbatim; §21 non-goals restate them.
- **Gate 4C remains unapproved.** §2 carries forward the
  PR#18ac `BLOCKED_PENDING_COMPATIBILITY_PLAN` sub-status; §21
  non-goals restate no Gate 4C execution.
- **No secrets.** Secret-safety grep returns only metadata /
  governance / attestation hits inside §4 / §5 / §6 / §16 /
  §19 / §21 forbiddance lists; no leaked value.
- **No runtime changes.** PR#19d is purely a contract
  artefact.

---

## 23. Files planned to change

### 23.1 Repo (this PR, docs-only)

| Path | Action | Lines |
|---|---|---|
| `docs/engineering/pr19d-sprint5-internal-learning-knob-handoff.md` | NEW | 1511 |

No code, scripts, tests, package files, migrations, `schema.sql`,
env files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

PR#19d is **path-restricted** to the single new file above. The
PR#18ac doc (merged via #63), the PR#18ad doc (merged via #65),
the PR#19c doc (merged via #66), the PR#20 implementation files
under `src/reports/external` and `tests/v1/external-report`
(merged via #64), and the four root `deep-research-report
(23..26).md` files (untracked working-tree only) all remain
**excluded** from PR#19d's diff via `git diff --name-only --
<this-file>` path restriction.

### 23.2 Production host

| Path | Action |
|---|---|
| any | NOT TOUCHED |

PR#19d does not read, write, edit, copy, move, remove, chmod,
chown, symlink, or otherwise touch the production host in any
way. No commands of any kind are executed against the production
host.

---

End of PR#19d. **Sprint 5 Internal Learning / Knob Runtime
contract handoff. Verdict: CONTRACT_HANDOFF_ONLY — no
implementation, no production execution, no Gate 4C approval.
Defines nine internal-learning surfaces (Founder Pulse, Knob
Control, Experiment Lab, Review Ops, Model Health, Customer
Outcomes, Sales Signal Loop, Insight Library, Improvement Log)
with per-surface purpose / audience / allowed-data / forbidden-
data / minimum-fields / first-implementation-cutline /
not-now-defer. Defines seven core record contracts: score_version
(identity, scoring_family, lane_scope, lifecycle, lineage,
activation governance; no silent scoring change rule),
knob_version (identity, family, scope, lifecycle, config_json,
hypothesis required, queue-impact estimate, rollback_pointer; no
freeform production knob mutation rule; activation requires
separate Helen GO), review_case (FP/FN separate queues; every
override has reason + reviewer; customer-visible output must not
expose reviewer_notes), outcome_event (delayed actuals expected;
outcome can arrive after report generation; outcome flows into
internal learning but does not silently rewrite old snapshots;
source refs hashed), replay_corpus (every production change
tested against a corpus before activation; official corpora
read-only except via versioned updates; raw payloads not
included unless separately approved), improvement_record
(append-only; no silent deletion; every production activation
links to an improvement record; incident-related rollbacks also
create improvement records), insight_record (repeated case
findings promoted to official insights; draft cannot be
customer-facing; official requires owner + verified_at;
supersession preserves history). Defines four review queues
(false_positive / false_negative / novelty / escalation) with
per-queue entry conditions / SLA / fields / close conditions /
downstream learning action; FP and FN separate by design;
revenue-weighted FN ordering; high-value FP prioritisation;
unclear / insufficient-evidence is a valid resolution. Defines
twelve calibration / model-health metric families (confusion
delta, band precision, band recall, reliability diagram
placeholder, Brier-style calibration placeholder, queue-load
delta, reason-code agreement, slice winners/losers, feature
coverage, missing-data rate, drift placeholder, delayed-outcome
lag distribution) — internal-only, table-first acceptable for
MVP, no customer-facing model-health dashboard implementation.
Defines knob governance for ten knob families (review-band
thresholds, source-trust weights, freshness-decay window,
minimum evidence count, missing-data penalty, reason-code
confidence gate, high-value escalation threshold, novelty
routing threshold, shadow/holdout ratio, model/version alias)
with per-family propose/approve/evidence/rollback matrix; all
production knobs default locked in v0.1; active alias cannot
change without approval; sandbox/shadow allowed only as
non-customer-impacting state. Defines official-vs-draft
separation across draft metrics / official metrics / draft
insights / official insights / sandbox knobs / active knobs /
shadow challengers / production aliases; draft cannot become
customer-facing; official requires verification;
query/contract change invalidates verification; superseded
state preserves history. Defines internal role visibility
(Helen/founder, product/engineering, analyst/reviewer, sales/CS,
external customer); external customer has no Sprint 5 access in
v0.1; sales/CS may submit but cannot change knobs; analyst may
review but cannot activate production scoring/knobs; founder
approves production alias/knob activation. Defines runtime-proof
integration with PR#19b (every ReportSnapshot links to
score_version_id / knob_version_id when applicable; every
ClaimBlock links to evidence_refs) and PR#19c (every production
activation requires audit_event_id; every rollback links to
rollback_pointer). Enumerates ten test fixtures (FP case, FN
case, unclear/insufficient evidence, delayed actual after
report, knob version shadow comparison, rollback alias restore,
official insight superseded, sales feedback mapped to taxonomy,
customer-visible report excludes internal notes, Lane B evidence
cannot enter customer output). Includes twelve-item Codex review
checklist preventing runtime scoring activation, customer-
visible knob leak, Lane B customer leak, reviewer notes in
external output, alias change without audit_event, scoring/knob
change without version_id, improvement_record
mutation/deletion, official insight without verification,
delayed outcome rewriting snapshot, raw payloads in replay
corpus by default, and customer-facing confidence claims from
calibration-only metrics. Proposes sequencing PR#22a → PR#22h
(score/knob version contracts → improvement log append-only →
case review queue skeleton → FP/FN taxonomy and fixtures →
replay corpus placeholder → outcome event object → Founder Pulse
table-first view → knob alias and rollback pointer) with each
step requiring its own Helen GO. Carries the eleven PR#18ab §9
governance locks forward verbatim in §2.1 and §21; flips none.
Carries Gate 4C BLOCKED_PENDING_COMPATIBILITY_PLAN forward in
§2. Carries PR#17s 26-row warning by reference. The repo change
is docs-only. PR#19d is path-restricted to the single new file
docs/engineering/pr19d-sprint5-internal-learning-knob-handoff.md;
PR#18ac (merged #63), PR#18ad (merged #65), PR#19c (merged #66),
PR#20 (merged #64), and root deep-research reports are all
excluded from PR#19d's diff. No code,
scripts, tests, package files, migrations, schema.sql, env
files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files modified in the repo. No
production-host write, no production-host read, no HTTP call,
no command execution of any kind is performed by PR#19d. No
Sprint 5 implementation PR opened by PR#19d. No score_version /
knob_version activation. No improvement_record write. No
replay_corpus seeding. No outcome_event ingestion. No Founder
Pulse / Knob Control / Experiment Lab / Review Ops / Model
Health / Customer Outcomes / Sales Signal Loop / Insight
Library / Improvement Log surface implementation. No Lane A / B
writer. No AMS Trust / Pass 1 / Pass 2 runtime. No Gate 4C / 4D
/ 4E execution. No endpointUrl re-flip. No production traffic.
No customer-facing language upgrade. No secret printing. Any
future Sprint 5 implementation PR (PR#22a through PR#22h),
score_version activation PR, knob_version activation PR,
production alias flip PR, improvement_record write PR,
customer-outcome ingestion PR, sales-feedback ingestion PR,
insight promotion PR, replay corpus seeding PR, Lane A / B
writer PR, AMS bridge / runtime PR, Pass 1 / Trust / Pass 2
runtime PR, Gate 4C compatibility-plan PR (PR#18ad → PR#18aj),
Gate 4C execution PR, Gate 4D observation PR, Gate 4E Track A /
Playwright PR, scoring / governance / output lock-amendment PR,
dashboard PR, customer-facing report PR, customer-facing claim
/ marketing / sales material PR, deep-research-commit PR,
issue-fix PR, runtime PR, or final cutover-readiness claim PR
remains separately gated by its own explicit Helen GO.**
