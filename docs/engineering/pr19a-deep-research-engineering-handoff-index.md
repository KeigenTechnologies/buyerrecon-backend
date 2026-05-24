# BuyerRecon PR#19a: Deep-Research → Engineering Handoff Index

> Docs-only handoff index. No code, no DB change, no migration, no
> `schema.sql` change, no production command, no website change, no
> customer-output activation, no Lane writer activation, no runtime
> scoring activation, no AMS Trust / Pass 1 / Pass 2 runtime
> activation, no Gate 4C / Gate 4D / Gate 4E execution, no secrets.

---

## 1. Purpose

Four deep-research reports were captured against public-pattern,
external-output, governance, and internal-learning surfaces:

- `deep-research-report (23).md` — **Sprint 2 public-pattern
  research** (behaviour evidence, bot / fraud signals, scoring
  worker, reason codes, Lane A / Lane B separation).
- `deep-research-report (24).md` — **Sprint 3 output-layer research**
  (external report, first-value screen, evidence cards, motion
  timeline, safe-claim templates, runtime proof).
- `deep-research-report (26).md` — **Sprint 4 governance-layer
  research** (retention, deletion, audit logs, monitoring, access
  boundaries, incident response).
- `deep-research-report (25).md` — **Sprint 5 internal-learning
  research** (knob dashboard, review queues, delayed actuals,
  calibration, internal learning OS, case memory, improvement log).

Those reports record **conclusions and engineering objects** (e.g.
`EvidenceAtom`, `audit_events`, `Founder Pulse`, `score_version_id`,
`alias rollback`) but they are research outputs, not implementation
plans. **Before any code is written, those conclusions must be
converted into engineering handoff artefacts** — structured tracks,
contracts, tests, sequencing, and explicit non-goals.

PR#19a is that handoff artefact. It does **not** approve any
implementation work; it indexes the research into tracks so a future
chain of PRs can pick up each track under its own explicit Helen GO.

PR#19a is also distinct from the merged Gate 4 chain (PR#18v →
PR#18ab) and from the staged Gate 4C planning record (PR#18ac,
verdict `PLANNING_ONLY` / sub-status
`BLOCKED_PENDING_COMPATIBILITY_PLAN`). PR#19a does not unblock,
sequence, or pre-authorise any Gate 4C compatibility-plan step.

---

## 2. Current Gate 4 status

Carried verbatim from the merged base (`bc1b1ef` — PR#18ab) and the
staged PR#18ac record:

- **Gate 4B artifact / config / rollback re-audit:** **non-`BLOCKED`**
  (PR#18aa PASS, recorded on base at PR#18ab merge).
- **Gate 4C `endpointUrl` re-flip planning:** **may proceed under
  its own Helen GO**. PR#18ac (staged, pending review) records the
  planning surface. Gate 4C execution remains
  `BLOCKED_PENDING_COMPATIBILITY_PLAN` because the on-host
  ThinSDK bundle (`br-thinlayer-init.js` sha256
  `9b0e4530…cc2efda0`) is byte-identical to the bundle that
  produced the 26 HTTP `400` `request_body_invalid_json` rejections
  on `2026-05-19`.
- **Gate 4C execution:** **still unapproved** until the §6
  compatibility-plan path in PR#18ac (proposed PR#18ad → PR#18aj)
  closes under its own Helen GO sequence.
- **Gate 4D organic observation:** unapproved unless later
  recorded.
- **Gate 4E Track A / Playwright:** unapproved unless later
  recorded.
- **Final scoring / governance recap locks (PR#18ab §9) remain in
  force**:
  - `customer_claim_allowed=false`
  - `customer_visibility_allowed=false`
  - `lane_output_allowed=false`
  - `lane_write_allowed=false`
  - `runtime_scoring_allowed=false`
  - `ams_trust_runtime_allowed=false`
  - `pass1_runtime_allowed=false`
  - `pass2_runtime_allowed=false`
  - `dashboard_customer_output_allowed=false`
  - `sales_claim_upgrade_allowed=false`
  - `allowed_customer_language=[]`

PR#19a inherits these locks (§9 non-goals). No track in §3, §4, §5,
or §6 flips any lock; each track instead records what the future
implementation PRs would need to satisfy *before* a separate
governance PR could even consider flipping a lock.

---

## 3. Research-to-implementation map

The table below maps each research conclusion to its engineering
object, runtime surface, visibility scope, required contract, test
requirement, suggested PR track, and explicit defer-list. The four
tracks (A / B / C / D) are independent and may be implemented
in parallel only to the extent §7 cross-cutting contracts hold.

| Research source | Key conclusion | Engineering object | Runtime surface | Customer-visible or internal-only | Required contract | Required tests | Suggested PR track | Not-now / defer |
|---|---|---|---|---|---|---|---|---|
| Sp2 (23) §"行为信号" | reload / SPA navigation / focus-vs-visibility must be modelled separately at ingest | `ingest_requests` extension: navigation_type (`reload` / `navigate` / `back_forward`), `visibility_state`, `focus_state` | Collector (`/v1/event` envelope) + ThinSDK emit | internal-only (raw evidence; no customer surface) | PR#17s §6.4 event-object contract amendment | unit-test ThinSDK navigation-type emission; envelope.test.ts coverage for new fields | Track D — Sp2 scoring/evidence bridge carry-forward | no scoring decision, no customer surface, no Lane writer |
| Sp2 (23) §"机器人/欺诈" | client-only bot detection is one layer; final verdict must mix client signal + server evidence + Lane A/B separation | Lane A "bad-bot" classifier + Lane B "good/neutral-agent" classifier objects (separate row types per migration 016) | scoring worker (NOT runtime; offline only until §9 unlocks) | internal-only | classifier I/O contract; reason-code taxonomy (GIVT / SIVT-style); confidence band schema | replay corpus against fixed labelled set; FP/FN delta tests; reason-code presence test | Track D | no Lane writer activation; no customer surface; no AMS bridge |
| Sp2 (23) §"评分" | score is action priority, not fact; must include reason codes + version + confidence | `score_version_id`, `reason_codes[]`, `confidence_band`, `evidence_grade E0..E4` | scoring worker output rows | internal-only | scoring output v0.x contract per migration 011 / 016 | golden-fixture tests asserting deterministic rubric; version-pinning test | Track D | no runtime scoring; no customer-visible score |
| Sp2 (23) §"AI Agent" | AI agent ≠ bot; declaration-first, verification-second, behaviour inference as observational | Lane B classification surfaces: declared-crawler / signed-agent / browser-agent / unknown-agent | scoring worker | internal-only | Lane B taxonomy doc; `agent_class` enum | declared-vs-actual UA reconciliation test | Track D | no customer-visible AI classification |
| Sp3 (24) §"仪表盘" | first-value screen shows installation + first evidence, not score overview | `installation_status` enum (`not_installed`/`connected_no_data`/`collecting`/`verified`); 30-min activity counter; first evidence card | external dashboard | customer-visible (under §9 locks; no scoring claim) | first-value-screen layout contract; copy-deck (allowed text only) | empty-state test; install-detection test; "no score on first-value" assertion | Track A — Sprint 3 external output | no AMS runtime; no AI classification; no buyer-intent claim |
| Sp3 (24) §"证据卡 / 报告" | facts vs inferences vs recommendations vs limitations must be visually separated in every ClaimBlock | `EvidenceAtom`, `SessionEvidenceCard`, `AccountEvidenceCard`, `MotionTimelineNode`, `ClaimBlock { facts[], inferences[], recommendations[], limitations[] }` | external report + dashboard | customer-visible (under §9 locks) | data contract for each object; rendering contract; `safe_claims` template-ID enum | snapshot tests for fact/inference separation; null-safety; rendering tests | Track A | no high-confidence claim; no scoring decision; no Pass-runtime |
| Sp3 (24) §"24h 报告" | 24h report sequencing: "what happened → why it might matter → what to open → next step"; "no result, no send" mode | 24h report job; report-delivery proof; `auto_send_reports` flag; `show_evidence_grade`, `show_recommendations`, `show_account_inference` flags | report scheduler + email/webhook delivery | customer-visible (under §9 locks; no claim upgrade) | report-content contract; email-deliverability contract; subscription model | empty-window test ("no event → no send"); evidence-grade rendering test; recommendation safety test | Track A | no automatic decision; no marketing language; no upgrade hook |
| Sp3 (24) §"runtime proof" | every emitted output must have runtime proof: request_id, workspace/site, decision, reason codes, rule/model version, evidence refs, timestamp | `runtime_proof` row per emission | report + dashboard back-end | internal-only (one row per surfaced ClaimBlock) | runtime-proof schema; retention class | per-emission proof persistence test; idempotency test | Track A (shared with B) | no customer-visible proof URL until governance v1 |
| Sp4 (26) §"audit_events" | audit must be a first-class core table, not a log-shrub | `audit_events` (append-only): who / when / what / where / before / after | governance runtime | internal-only | audit-event schema; `before_hash`/`after_hash` for config changes; deletion-completion-receipt link | append-only invariant test; before/after-hash test; admin-elevation test | Track B — Sprint 4 governance runtime | no SIEM integration; no customer audit-export; no real-time alerting v0 |
| Sp4 (26) §"retention" | per-data-type retention windows (raw evidence / derived proof / audit log / ops log), not one global TTL | `retention_policy` table; per-class TTL; `retention_dry_run` job; `retention_execute` job | retention runtime | internal-only | retention-policy schema; per-class default TTL; PII inventory | dry-run-vs-execute parity test; tombstone-aware retention test | Track B | no per-customer retention override; no purge of suppression tombstone |
| Sp4 (26) §"deletion + suppression" | deletion = delete + suppress-future; suppression tombstone is mandatory | `deletion_request`, `deletion_receipt`, `suppression_tombstone` | governance runtime + collector front-of-pipe | internal-only | deletion-request workflow; tombstone-check at ingest; receipt format | tombstone-blocks-future-collect test; deletion-receipt persistence test; ingest-replay safety test | Track B | no GDPR-Subject-Access-Request UI v0; no customer-self-serve delete |
| Sp4 (26) §"monitoring + alerts" | only alert on actionable, threshold-bounded events; avoid alert fatigue | metrics: ingest rate, accept rate, reject-reason histogram, retention dry-run heartbeat, scoring-worker heartbeat | monitoring runtime | internal-only | metric-emission contract; alert-threshold table | failed-once-vs-twice threshold test; missing-heartbeat alert test | Track B | no PagerDuty / no Opsgenie; no SLA dashboard customer-visible |
| Sp4 (26) §"incident response" | incident template = trigger / scope / blast / actions / receipts / postmortem | `incident_record` template doc; runbook hooks | governance runtime | internal-only | incident-record schema; rollback-pointer field | incident-template-rendering test | Track B | no automated forensic capture v0 |
| Sp4 (26) §"workspace/project/site" | three-layer tenancy: workspace / project / site; no implicit cross-tenant sharing | `workspace_id`, `project_id`, `site_id` columns on every domain row; `WHERE workspace_id` mandatory | governance runtime + every existing table that lacks these | internal-only | tenancy-column invariant; role matrix | cross-tenant negative test; role-matrix coverage test | Track B | no SCIM v0; no fine-grained per-row ACL |
| Sp5 (25) §"Founder Pulse" | leader view: quality trend / FP-FN trend / queue aging / risky slices / open decisions | `Founder Pulse` dashboard panel set | internal learning UI | internal-only (founder + PM read-only) | leader-view panel contract; data-source bindings | empty-week test; rolling-window correctness test | Track C — Sprint 5 internal learning | no customer-facing leader view |
| Sp5 (25) §"Knob Control" | every knob versioned; aliasing; rollback alias | `knob_set`, `knob_version_id`, `alias` (live/challenger/shadow), `knob_change_log` | learning runtime + scoring worker config-read | internal-only | knob-versioning contract; alias-flip protocol; shadow/holdout shape | alias-rollback test; shadow-route test | Track C | no auto-tuner; no knob exposed to customer surface |
| Sp5 (25) §"Experiment Lab" | hypothesis-first; baseline vs challenger; calibration delta; queue-load delta | `experiment_record`, `replay_corpus_id`, `slice_delta` view | learning runtime | internal-only | experiment-record schema; replay-corpus pin | replay-determinism test; slice-coverage test | Track C | no A/B on customer traffic; no Bayesian auto-decision |
| Sp5 (25) §"Review Ops" | FP and FN queues separate; SLA per queue; reason-rubric on resolution | `fp_queue`, `fn_queue`, review-record schema, SLA bands | learning runtime | internal-only (ops / analyst) | queue contract; resolution-tag taxonomy | SLA-breach alert test; queue-priority test | Track C | no customer-self-service appeal v0 |
| Sp5 (25) §"Model Health" | feature coverage / drift / global importance / slice impact / delayed-actual update | `model_health_snapshot`, drift-detector record | learning runtime | internal-only | snapshot schema; drift threshold | drift-trigger test; coverage-null test | Track C | no live model retraining |
| Sp5 (25) §"Customer Outcomes" | outcome status / lag / source / note / bound case IDs | `customer_outcome` table; `delayed_actuals_backfill` job | learning runtime + CRM bridge (read-only) | internal-only (CS / sales / PM) | outcome schema; CRM-source pinning | lag-window test; backfill-idempotency test | Track C | no customer self-report v0 |
| Sp5 (25) §"Sales Signal Loop" | GTM feedback as product signal: fixed tags, deal-stage impact, false-alarm themes, missed-buyer themes | `sales_feedback` schema; segment-report contract | learning runtime + CRM bridge | internal-only (sales / PM) | feedback-tag taxonomy; segmentation contract | tag-stability test | Track C | no CRM-write back v0 |
| Sp5 (25) §"Insight Library" | case-level learning → official knowledge; verified / draft states | `insight_card`, `verified` boolean, owning-team, before/after metrics, linked change records | learning runtime | internal-only (read-only across team) | insight-card schema; verified-flow contract | promotion-from-draft-to-official test; rollback-of-promoted-insight test | Track C | no customer-facing knowledge base v0 |
| Sp5 (25) §"Improvement Log" | evidence-grade audit ledger: change id / score version / knob version / benchmark corpus / decision / rollback pointer / owner / timestamp | `improvement_log` (append-only ledger) | learning runtime | internal-only | improvement-log schema; rollback-pointer integrity | append-only invariant test; rollback-pointer-resolve test | Track C | no customer-visible change log v0 |
| Cross-cutting (24) + (25) + (26) | every emit, every change, every decision needs a runtime proof + audit row | shared `runtime_proof` + `audit_events` contract | governance runtime + report runtime + learning runtime | internal-only | shared contract (§7) | shared coverage test | A + B + C | n/a |

### Implementation tracks defined by the table

- **Track A — Sprint 3 External Output Layer.** Customer-visible
  (under §9 locks) first-value screen, evidence cards, motion
  timeline, 24h report, runtime proof. Detailed in §4.
- **Track B — Sprint 4 Governance Runtime Layer.** Internal-only
  audit, retention, deletion, monitoring, incident response, tenancy
  enforcement. Detailed in §5.
- **Track C — Sprint 5 Internal Learning / Knob Layer.**
  Internal-only knob control, review queues, experiment lab, model
  health, customer outcomes, sales signal loop, insight library,
  improvement log. Detailed in §6.
- **Track D — Sprint 2 Scoring / Evidence Bridge Carry-Forward.**
  Internal-only behaviour-evidence ingest extensions, Lane A / Lane B
  separation, scoring-output contract, reason-code taxonomy, AI-agent
  classification. Detailed below.

#### Track D — Sprint 2 carry-forward summary

Track D is the **bridge between merged Sprint 2 evidence-capture
work and any future Sprint 3 customer-visible output**. It carries
forward (but does **not** activate) the following from the merged
Sprint 2 chain and from Report (23):

- `ingest_requests` / `accepted_events` / `rejected_events` /
  `scoring_output_lane_a` / `scoring_output_lane_b` (migration 011 /
  016 schema already merged on base).
- The 26 PR#17s `request_body_invalid_json` rows preserved as
  evidence baseline (PR#17s / PR#18w / PR#18ab carry-forward).
- The Lane A / Lane B separation: Lane A = "bad-bot / invalid /
  suppress", Lane B = "good-bot / signed-agent / observed-only" per
  PR#18l output-governance planning and per Report (23) §"AI Agent".
- The deterministic-rubric / reason-code-mandatory / version-pinned
  posture per Report (23) §"评分" lessons 9–10 and Report (25)
  knob-versioning.

Track D **does not** activate the scoring worker against production
runtime, **does not** flip any §9 lock, and **does not** authorise
Lane A or Lane B writers. Track D's role at this handoff is to:

- record which evidence-capture fields Report (23) shows are
  missing or under-represented (e.g. navigation_type breakdown,
  visibility-vs-focus split, declared-vs-actual AI-agent
  reconciliation),
- record that the scoring-output schema must include
  `score_version_id`, `knob_version_id`, `reason_codes[]`,
  `confidence_band`, and `evidence_grade` per Report (23) §"评分"
  and Report (25) "Knob Control" / "Improvement Log",
- record that *before* any Lane writer activation PR is opened, a
  separate scoring / governance / output PR must amend PR#18ab §9
  locks under its own Helen GO.

---

## 4. Sprint 3 External Output Handoff Summary

Source: `deep-research-report (24).md`. Engineering objects extracted
and the customer-visibility / governance constraints applied.

### 4.1 Core data objects

- **`EvidenceAtom`** — minimal fact unit. Carries one observation
  (e.g. one navigation event, one visibility transition, one auth
  outcome). Has stable ID, source pin, timestamp, evidence_grade.
- **`SessionEvidenceCard`** — collection of `EvidenceAtom` for one
  session, with a single `ClaimBlock` summary and a
  motion-timeline-node reference.
- **`AccountEvidenceCard`** — same shape at account scope, with
  cross-session aggregates and an explicit `account_inference`
  ClaimBlock that is **only** rendered when `show_account_inference`
  flag is `true`.
- **`MotionTimelineNode`** — one node on the visitor / account
  motion timeline (install, first event, evidence card, report,
  alert). Used by both the first-value screen and the 24h report.
- **`ClaimBlock`** — four mandatory arrays:
  - `facts[]` — observed events / hashes / counters with sources.
  - `inferences[]` — model / rule outputs with explicit confidence
    band and reason codes.
  - `recommendations[]` — suggested human follow-up (never
    auto-actioned).
  - `limitations[]` — what this block does *not* assert (e.g. "this
    is not a buyer-intent claim", "AI-agent classification is
    observational only").
  Rendering must keep the four sections visually separated.
  `recommendations[]` may only contain template-ID references to
  the `safe_claims` enum; no free text from the model layer.

### 4.2 Installation-status enum

- `installation_status ∈ {not_installed, connected_no_data, collecting, verified}`
- First-value screen shows the current value prominently.
- `verified` requires at least one fully-validated ingest event;
  `collecting` requires ingest rows present but not yet validated;
  `connected_no_data` requires the ThinSDK to have made at least one
  successful request without yielding ingest data; `not_installed`
  is the default until the ThinSDK is detected.

### 4.3 Evidence grade enum

- `evidence_grade ∈ {E0, E1, E2, E3, E4}`.
- `E0`: not yet validated; placeholder; never rendered to customer.
- `E1`: single-source raw evidence; rendered as fact-only.
- `E2`: cross-validated raw evidence; rendered as fact + simple
  inference (under §9 locks; no decision-grade claim).
- `E3`: durable evidence with reason-code agreement across rule
  + classifier; rendered as fact + inference + low-confidence
  recommendation.
- `E4`: outcome-confirmed evidence (delayed actual closed the loop);
  rendered as fact + inference + recommendation. **Customer-visible
  only after a separate governance PR flips
  `customer_visibility_allowed=true`.**

### 4.4 `safe_claims` template IDs

- An enum of allowed customer-facing sentences. Front-end **never**
  composes free text from model output. Examples (placeholder
  template-ID shape; final enum to be defined by a separate Sprint 3
  contract PR):
  - `safe.install_verified.v1`
  - `safe.first_evidence_seen.v1`
  - `safe.session_summary_low_conf.v1`
  - `safe.account_summary_internal_only.v1`
  - `safe.no_event_yet_in_window.v1`
- The `allowed_customer_language=[]` lock in PR#18ab §9 means
  **the safe_claims enum is empty until a separate governance PR
  fills it**. PR#19a only sketches the shape; it does not populate
  the enum.

### 4.5 External dashboard sections

Per Report (24) §"仪表盘" the customer-facing first-value screen
contains exactly four blocks (no overview tile-wall):

1. Installation status block.
2. Past 30-minute activity counter.
3. First evidence card.
4. System-boundary statement (e.g. "this dashboard records
   evidence; it does not produce buyer-intent decisions").

Below the first-value screen, a drill-down surface exposes:

- session list → session evidence card,
- account list → account evidence card,
- motion timeline → timeline-node detail,
- 24h report archive,
- subscription / delivery settings.

### 4.6 First-value screen vs internal dashboard split

- **External (customer)**: first-value screen, evidence cards,
  timeline, safe report, report subscriptions.
- **Internal (ops)**: match pipeline, bot / proxy flags, domain /
  cookie / consent status, resolver diagnostics, suppression
  reasons, heuristic weights, false-positive audit, render logs.

The split is non-overlapping. The customer-facing surface must
**not** expose internal calibration knobs (resolver weights, bot
rules, suppression thresholds, identity confidence breakdowns, raw
enrichment provenance).

### 4.7 24h report contract

- **Sequence:** what happened → why it might matter → what to open
  → next step.
- **Anchored evidence:** every claim in the report must link back to
  at least one `EvidenceAtom` ID.
- **No-result mode:** "no event → no send" by default. If no event
  occurred in the window, the report records `NO_EVENT_YET` and
  withholds delivery (per `docs/ops/cutover-hard-gates.md` §7
  "`NO_EVENT_YET` is not failure if no event was expected or
  observed").
- **Delivery proof:** every report delivery (email / webhook /
  download) produces a `report_delivery_proof` row with
  `request_id`, `workspace_id`, `site_id`, recipient identity
  category (not raw email), timestamp.

### 4.8 Runtime proof

Every emitted ClaimBlock / report / dashboard render produces a
`runtime_proof` row (carry-forward from Report (26) §"runtime
proof"):

- `request_id`
- `workspace_id` / `project_id` / `site_id`
- `decision_category` (e.g. `ClaimBlock_emit`, `report_send`,
  `dashboard_render`)
- `reason_codes[]`
- `rule_version_id` / `model_version_id` / `knob_version_id`
- `evidence_atom_ids[]`
- `timestamp`

### 4.9 Feature flags

Per Helen's spec, Track A must define these four flags up front
(default values reflect the PR#18ab §9 locks):

- `show_evidence_grade` — default `false` until safe_claims enum
  is populated.
- `show_recommendations` — default `false` until governance PR
  flips it.
- `show_account_inference` — default `false`; required for any
  AccountEvidenceCard render.
- `auto_send_reports` — default `false`; report delivery requires
  per-subscription explicit opt-in.

### 4.10 Missing / under-represented in Report (24)

Track A's first implementation PR must record:

- Exact wire format of every object above (JSON schema or
  TypeScript types).
- Exact `safe_claims` enum population path (which governance PR
  fills it; what's the review process).
- Exact recipient-identity-category mapping for `report_delivery_proof`
  (do not log raw emails; what is the categorical replacement).
- Exact 30-minute-activity-counter source (count from
  `ingest_requests` filtered by site_id and time, or from
  `accepted_events`?).

---

## 5. Sprint 4 Governance Runtime Handoff Summary

Source: `deep-research-report (26).md`.

### 5.1 `audit_events` (append-only core table)

- **Shape:** `(event_id, workspace_id, project_id, site_id, actor,
  actor_category, timestamp, action, resource_type, resource_id,
  before_hash, after_hash, reason, request_id)`.
- **Invariants:**
  - Append-only: no `UPDATE`, no `DELETE`.
  - Every config / grant / role / data-deletion change writes one
    row.
  - `before_hash` / `after_hash` for config rows so a diff is
    reproducible without storing raw before / after values.
  - `actor_category` is e.g. `root`, `web_admin`, `migrator`,
    `prod_audit_readonly` (carry-forward from PR#18v / PR#18w
    `current_user_category`); never the raw username.

### 5.2 Retention policy

Per Report (26) §3 / §"retention", at least four classes:

- **Raw evidence** (`ingest_requests`): short, e.g. 30–90 days.
- **Derived proof** (`accepted_events`, `rejected_events`,
  scoring output): medium, e.g. 180–365 days.
- **Audit log** (`audit_events`): long, e.g. 365–730 days.
- **Ops log** (heartbeat, monitoring): short.

Each class has its own TTL in a `retention_policy` table.
PII-affecting classes (raw evidence in particular) must have
default TTLs at the **low** end of the band.

### 5.3 Deletion workflow

- **`deletion_request`**: who requested, scope (workspace / project
  / site / person-like ID), requested-at.
- **`suppression_tombstone`**: written **before** any delete runs;
  blocks future collection of the same identifier.
- **`deletion_receipt`**: written **after** delete completes;
  records rows removed per class, scope, timestamp; links back to
  `audit_events` for the originating change.

Ingest-front-of-pipe (collector) must consult `suppression_tombstone`
before persisting any new row.

### 5.4 Retention dry-run / execute jobs

- **`retention_dry_run`**: daily; computes rows that would be
  deleted per class; writes a report.
- **`retention_execute`**: only deletes rows that the prior day's
  `retention_dry_run` flagged AND that still satisfy the deletion
  predicate at execute time.
- **Stop-line:** dry-run-vs-execute parity check; any drift halts
  execute.

### 5.5 Monitoring metrics + alert thresholds

Carry-forward from Report (26) §"alert thresholds":

| Metric | Failed-once | Failed-twice (alert) |
|---|---|---|
| ingest rate (rolling 5-min vs baseline) | record | alert |
| accept rate (rolling 1-hour vs baseline) | record | alert |
| reject-reason histogram spike | record | alert (especially `request_body_invalid_json`) |
| retention dry-run heartbeat | record | alert |
| retention execute heartbeat | record | alert |
| scoring-worker heartbeat | record | alert |
| audit-log write failure | record | alert |
| `request_body_invalid_json` count delta from baseline | record | alert (PR#17s pattern recurrence watch) |

Alerts must be **actionable** (runbook link, scope, blast estimate
per Report (26) §"incident"). No silent watchers.

### 5.6 Incident response template

`incident_record`:

- `trigger` — which alert / observation initiated.
- `scope` — workspace / project / site / class.
- `blast_estimate` — rows affected, customers affected.
- `actions[]` — categorical action records (rollback, suppress,
  notify, replay).
- `receipts[]` — links to audit_event rows and rollback receipts.
- `postmortem_pointer` — link to a separate postmortem doc.

### 5.7 Tenancy: workspace / project / site

Three-layer mandatory:

- Every domain row carries `workspace_id`, `project_id`, `site_id`.
- Every read query filters on `workspace_id` **first**.
- No implicit cross-tenant sharing.
- Migrating existing tables that lack these columns is itself a
  separate governance migration PR (carries Lane A/B grant safety
  rules from migration 016).

### 5.8 Role matrix

- Roles: `founder`, `eng`, `product`, `ops`, `analyst`,
  `prod_audit_readonly` (already established by PR#18v),
  `prod_collector_app` (already established by PR#17m / PR#17o),
  `migrator` (already established by PR#17q).
- Each row in the matrix records: role × resource_type × action ×
  allowed (`yes` / `no`).
- Negative tests: any role attempting a forbidden action must fail
  with a categorical error; the failure must be captured in
  `audit_events`.

### 5.9 External audit trigger

A separate read-only audit hook (e.g. for an external auditor with
a time-bounded credential) that:

- Reads `audit_events` only.
- Cannot read raw evidence.
- Writes its own row to `audit_events` for every read.
- Time-bounded via expiry on the credential.

Not approved by PR#19a; recorded here as a future Track B sub-PR
target.

### 5.10 Missing / under-represented in Report (26)

Track B's first implementation PR must record:

- Exact column shape and indexes for each new table.
- Exact PII inventory across existing tables (which fields are
  short-retention, which are medium).
- Exact PR sequence (`audit_events` first → tenancy columns next
  → retention policy → deletion + tombstone → monitoring).
- Exact mapping between PR#17m / PR#17o / PR#17q roles and the
  governance role matrix.

---

## 6. Sprint 5 Internal Learning / Knob Handoff Summary

Source: `deep-research-report (25).md`.

### 6.1 The eight internal-learning surfaces

Track C builds eight surfaces, all internal-only:

1. **Founder Pulse** — leader view: quality trend / FP-FN trend /
   queue aging / risky-slice top-5 / launch readiness / latest
   official insights / open decisions.
2. **Knob Control** — active knob set, recent diffs, change owner,
   queue-impact estimate, shadow / holdout status, rollback alias.
3. **Experiment Lab** — hypothesis, affected slice, baseline vs
   challenger, queue-load delta, calibration delta, launch
   checklist.
4. **Review Ops** — FP queue + FN queue (separate), SLA, assignee,
   reason rubric, evidence drawer, resolution tags.
5. **Model Health** — feature coverage, drift, global importance,
   slice impact, delayed-actual updates, A/B compare.
6. **Customer Outcomes** — confirmed outcome status, lag days,
   source confidence, notes, attached CRM / customer feedback.
7. **Sales Signal Loop** — fixed tags, deal-stage impact,
   false-alarm themes, missed-buyer themes, segment report.
8. **Insight Library** — official insight cards, verified status,
   owning team, before/after metrics, linked change records.

Plus the canonical ledger:

- **Improvement Log** — append-only: change id, score version, knob
  version, benchmark corpus, decision, rollback pointer, owner,
  timestamp.

### 6.2 Version-pinning

Every artefact carries:

- `score_version_id` — points to the scoring rubric / classifier
  version active for that case.
- `knob_version_id` — points to the knob set active.
- Joined together with `replay_corpus_id` (a fixed labelled set
  used for slice/calibration comparisons).

### 6.3 Aliasing + rollback

- Each scoring version has at most three aliases:
  `live` / `challenger` / `shadow`.
- Promoting a `challenger` to `live` requires: passing the
  Experiment Lab launch checklist, no SLA breach in Review Ops,
  Customer Outcomes lag-window aligned.
- Rolling back is one-step: re-pointing the `live` alias.

### 6.4 FP / FN queues

Separate by design:

- **`fp_queue`** — BuyerRecon flagged but real-customer behaviour;
  cost = customer friction.
- **`fn_queue`** — BuyerRecon under-flagged but real-buyer
  behaviour later confirmed; cost = missed buyer.
- Each queue has its own SLA band, assignee policy, reason rubric.

### 6.5 Delayed actuals

- `customer_outcome` is **delayed** — the outcome arrives days /
  weeks after the case is opened.
- `delayed_actuals_backfill` job joins outcome back to the
  prediction by stable case_id, prediction_id, account_id, etc.
- The backfill must be idempotent.

### 6.6 Replay corpus

- A fixed, labelled set of cases for slice/calibration comparison.
- Promoting a `challenger` requires its replay-corpus performance
  meet defined deltas in the Experiment Lab launch checklist.
- The replay corpus itself is versioned (`replay_corpus_id`); cases
  may only be added, not modified, to preserve comparability.

### 6.7 Calibration views

Per Report (25) §"模型比较":

- confusion delta on same replay corpus,
- reliability diagram,
- precision/recall at key bands,
- queue-load delta,
- reason-code agreement,
- slice winners / losers,
- feature coverage / drift delta,
- customer-outcome delta.

### 6.8 Official vs draft spaces

Per Report (25) §"内部学习" #2:

- **Official collections** — Helen / founder + PM verified;
  promoted via Insight Library's verified-flow; visible to whole
  team read-only.
- **Draft / personal collections** — analyst / eng exploratory
  work; not visible to customer-facing surfaces; not consumable by
  Founder Pulse without promotion.

### 6.9 Outcome-confirmed memory

- Cases reaching `E4` evidence grade (delayed actual closed the
  loop) feed back into the Insight Library and the Improvement
  Log.
- The case-level learning is promoted to an `insight_card` only
  after the verified-flow approves it; until then it lives in
  draft.

### 6.10 Missing / under-represented in Report (25)

Track C's first implementation PR must record:

- Exact column shape for each new table (knob_set, knob_change_log,
  experiment_record, fp_queue, fn_queue, customer_outcome,
  insight_card, improvement_log).
- Exact replay-corpus seeding plan (which historical cases — given
  that Lane A / Lane B writers haven't activated, the v0 replay
  corpus may need to be synthetic-only or PR#17s-fixture-only).
- Exact promotion-flow gating (who can promote a `challenger`).
- Exact mapping between Sprint 5 internal-learning surfaces and the
  existing scoring-output tables from migrations 011 / 016.

---

## 7. Cross-cutting contracts

The four tracks share five core contracts that must be defined
before any track ships:

### 7.1 Build contract

Per Report (26) §"tracking plan" — define event schema, owner,
change history, contract version **before** writing the back-end.
Snowplow / Segment tracking-plan style. Each domain object in §4 /
§5 / §6 must have a contract version pinned in the table itself
(e.g. `schema_version`).

### 7.2 Test plan

Three tiers:

- **Unit tests** — per-object contract, null-safety, version-pin.
- **Replay corpus tests** — deterministic against the labelled
  fixed set per §6.6.
- **Negative tests** — cross-tenant access, role-matrix coverage,
  audit-event integrity, deletion-tombstone-blocks-replay.

### 7.3 Runtime proof

Per §4.8 / Report (26) §"runtime proof": every emit produces one
row. Shared schema across Track A (report / dashboard), Track B
(audit / governance), and Track C (knob / experiment / insight).

### 7.4 Codex review checklist

Per Report (26) §"Codex review checklist" — every new PR must
pass:

- Does every new table have a `workspace_id`?
- Does every new write path write an `audit_events` row?
- Does every new log path redact PII?
- Does every new job have a heartbeat?
- Does every new API have a role-matrix entry?

### 7.5 Rollback path

Every implementation PR must define its rollback path before any
merge. Carry-forward from Gate 4 chain:

- PR#17s §4 "Rollback to Render legacy is the steady state"
  principle.
- PR#18z `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md`
  template.
- Per-PR rollback artifact (e.g. for migrations: down-migration;
  for code: revert commit; for config: prior alias).

### 7.6 Access / visibility matrix

Single canonical matrix:

- Rows: every domain object across Track A / B / C / D.
- Columns: `customer_visible` / `internal_only_founder` /
  `internal_only_ops` / `internal_only_eng`.
- Default: `internal_only_eng` (most restrictive).
- A row only becomes `customer_visible` when a separate scoring /
  governance / output PR flips the relevant PR#18ab §9 lock.

### 7.7 Customer-safe language dictionary

The `allowed_customer_language=[]` lock means the dictionary is
empty at PR#19a merge. The dictionary is populated by a separate
governance PR that:

- adds `safe.<topic>.<version>` entries one at a time,
- pins each entry to specific evidence-grade requirements,
- pins each entry to specific feature-flag values,
- runs the entry through Codex review for claim safety.

---

## 8. Implementation sequence recommendation

The four tracks have natural dependencies. The recommended order:

1. **PR#19b — Sprint 3 external output contract handoff.**
   Define the Track A wire formats (`EvidenceAtom`,
   `SessionEvidenceCard`, `AccountEvidenceCard`,
   `MotionTimelineNode`, `ClaimBlock`, `installation_status`,
   `evidence_grade`), the `safe_claims` enum shape (still empty per
   §9 lock), the four feature flags, and the runtime-proof
   integration. Docs-only.
2. **PR#19c — Sprint 4 governance runtime handoff.**
   Define `audit_events`, `retention_policy`, `deletion_request` /
   `suppression_tombstone` / `deletion_receipt`,
   `retention_dry_run` / `retention_execute` jobs, monitoring
   metric + threshold table, `incident_record` template, tenancy
   columns plan, role matrix. Docs-only.
3. **PR#19d — Sprint 5 internal learning / knob handoff.**
   Define the eight surfaces (Founder Pulse, Knob Control,
   Experiment Lab, Review Ops, Model Health, Customer Outcomes,
   Sales Signal Loop, Insight Library), the `improvement_log`
   ledger shape, the alias model, the FP/FN queue shape, the
   delayed-actuals contract, the replay corpus pin. Docs-only.
4. **Sprint 3 implementation PRs** (after PR#19b). Track A
   implementation against the merged contract.
5. **Sprint 4 implementation PRs** (after PR#19c). Track B
   implementation. **Track B must merge before any Track A
   customer surface ships** because Track B owns audit /
   deletion / monitoring / role matrix.
6. **Sprint 5 implementation PRs** (after PR#19d and after
   Track B is at least partially shipped). Track C needs Track B's
   `audit_events` and tenancy plumbing.

### 8.1 Why this order

- **External output needs claim-safety first.** A Track A surface
  built before the `safe_claims` enum is populated would either be
  empty or risk leaking unsafe model output. PR#19b lays out the
  enum shape and the governance gate so Sprint 3 implementation
  doesn't run ahead of the §9 locks.
- **Governance runtime needs to be ready before broad customer
  exposure.** Audit, deletion, monitoring, role enforcement must be
  in place *before* customers can see any output, or BuyerRecon
  would be a system that emits claims without recording who saw
  them or how they can be retracted.
- **Internal learning / knobs need stable evidence and outcomes.**
  Track C calibrates against `customer_outcome` delayed-actuals; if
  there is no stable evidence (Track D pre-conditions) and no audit
  trail (Track B), the calibration loop is unfalsifiable.
- **Track D (Sprint 2 carry-forward) sits underneath.** It does
  not get its own PR#19* step because the merged migrations 011 /
  016 already supply the foundation; new Track D work surfaces
  only as needed inside Sprint 3 / 4 / 5 implementation PRs (e.g.
  the navigation-type ingest extension shows up inside the first
  Sprint 3 implementation PR that consumes it).

---

## 9. Explicit non-goals

PR#19a does **not** approve any of the following. Each requires its
own explicit Helen GO scoped to that specific work:

- no customer-facing output activation,
- no scoring claim (decision-grade, classification, AI-agent
  call-out, Trust / confidence value, readiness-to-buy),
- no Lane A / Lane B writer activation,
- no AMS Trust runtime,
- no Pass 1 runtime,
- no Pass 2 runtime,
- no Gate 4C execution,
- no Gate 4D organic observation,
- no Gate 4E Track A / Playwright work,
- no production traffic generation,
- no `endpointUrl` re-flip,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no `/var/www` edit,
- no symlink change,
- no `nginx -s reload`, no `systemctl` action, no service restart,
- no DNS change,
- no DB write, no DB grant, no migration, no `schema.sql` change,
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no `buyerrecon_migrator`
  reset, no production token provisioning,
- no Track A invocation,
- no Playwright run,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no runtime code,
- no implementation PR opened by PR#19a (only the next-PR
  sequence is sketched in §8),
- no flipping of any PR#18ab §9 lock,
- no population of the `safe_claims` enum,
- no population of the `allowed_customer_language` dictionary,
- no deletion / mutation / annotation / normalisation of the 26
  historical PR#17s rows on the production cluster,
- no secret printing (DSN, generated password, DB username /
  password pair, `Authorization:` header value, raw `request_id`,
  raw `session_id`, raw payload, raw response body, env dump,
  private key / cert body, vault content, shell history, raw row
  data).

---

## 10. Acceptance criteria

PR#19a is acceptable for merge into
`sprint2-architecture-contracts-d4cc2bf` only if **all** of the
following hold:

- **Docs-only.** Exactly one new file changes in the repo:
  `docs/engineering/pr19a-deep-research-engineering-handoff-index.md`.
  No code, no scripts, no tests, no package files, no migrations,
  no `schema.sql`, no env files, no systemd / Nginx files, no AMS
  source, no website artifacts, no production config, no DB grant
  files change.
- **All four research docs mapped.** §3 table includes rows
  derived from Report (23) (Sprint 2 / Track D), Report (24)
  (Sprint 3 / Track A), Report (26) (Sprint 4 / Track B), and
  Report (25) (Sprint 5 / Track C).
- **Missing engineering objects identified.** §4.10 / §5.10 /
  §6.10 each record what the first implementation PR in that
  track must add beyond what the research already specifies.
- **Sprint 3 / 4 / 5 handoff tracks defined.** §4 / §5 / §6 each
  enumerate the engineering objects, contracts, tests, and
  governance ties.
- **Implementation sequence proposed.** §8 lists PR#19b → PR#19c
  → PR#19d → Sprint 3 impl → Sprint 4 impl → Sprint 5 impl with
  rationale.
- **Governance locks preserved.** §2 carries all eleven PR#18ab
  §9 locks verbatim; §9 non-goals restate them; no track flips
  any lock.
- **No code / config / runtime changes.** PR#19a is a
  docs-only index; it touches no implementation surface.
- **No secrets.** Secret-safety grep returns only metadata /
  governance / attestation hits inside §9 / §10 / closing recap.

---

## 11. Files planned to change

### 11.1 Repo (this PR, docs-only)

| Path | Action | Lines |
|---|---|---|
| `docs/engineering/pr19a-deep-research-engineering-handoff-index.md` | NEW | 928 |

No code, scripts, tests, package files, migrations, `schema.sql`,
env files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

The four deep-research reports
(`deep-research-report (23).md` … `(26).md`) remain in the repo
root as **untracked** working-tree files; PR#19a does not commit
them. Whether to commit them as `docs/research/` artefacts is a
separate question for a later docs-only PR (out of scope for
PR#19a).

### 11.2 Production host

| Path | Action |
|---|---|
| any | NOT TOUCHED |

PR#19a does not read, write, edit, copy, move, remove, chmod,
chown, symlink, or otherwise touch the production host in any way.
No commands of any kind are executed against the production host.

---

End of PR#19a. **Deep-research → engineering handoff index.
Docs-only. Maps the four merged-as-research-input deep-research
reports — `(23)` Sprint 2 public-pattern, `(24)` Sprint 3
output-layer, `(26)` Sprint 4 governance-layer, `(25)` Sprint 5
internal-learning — into four engineering implementation tracks:
Track A (Sprint 3 external output), Track B (Sprint 4 governance
runtime), Track C (Sprint 5 internal learning / knob), Track D
(Sprint 2 scoring / evidence bridge carry-forward). Enumerates per
track the engineering objects (Track A: `EvidenceAtom`,
`SessionEvidenceCard`, `AccountEvidenceCard`, `MotionTimelineNode`,
`ClaimBlock { facts[], inferences[], recommendations[],
limitations[] }`, `installation_status`, `evidence_grade E0..E4`,
`safe_claims` template IDs, first-value screen, 24h report,
runtime proof, four feature flags `show_evidence_grade` /
`show_recommendations` / `show_account_inference` /
`auto_send_reports`; Track B: `audit_events`, `retention_policy`,
`deletion_request` / `suppression_tombstone` / `deletion_receipt`,
`retention_dry_run` / `retention_execute`, monitoring metrics +
alert thresholds, `incident_record`, workspace / project / site
tenancy columns, role matrix, negative tests, external audit
trigger; Track C: Founder Pulse, Knob Control, Experiment Lab,
Review Ops, Model Health, Customer Outcomes, Sales Signal Loop,
Insight Library, Improvement Log, FP / FN queues, delayed actuals,
`score_version_id`, `knob_version_id`, replay corpus, calibration
views, official vs draft spaces, alias rollback, outcome-confirmed
memory). Defines five cross-cutting contracts (build contract,
test plan, runtime proof, Codex review checklist, rollback path,
access / visibility matrix, customer-safe language dictionary).
Recommends the PR sequence PR#19b → PR#19c → PR#19d → Sprint 3
impl → Sprint 4 impl → Sprint 5 impl, with rationale that
external output needs claim-safety first, governance runtime needs
audit / deletion / monitoring before broad customers, internal
learning / knobs need stable evidence and outcomes. Carries all
eleven PR#18ab §9 governance locks forward verbatim and explicitly
states that no track flips any lock. Records what each track's
first implementation PR must add beyond the research (§4.10 /
§5.10 / §6.10). The repo change is docs-only. The four
deep-research reports remain untracked working-tree files; PR#19a
does not commit them. No code, scripts, tests, package files,
migrations, `schema.sql`, env files, systemd / Nginx files, AMS
source, website artifacts, production config, or DB grant files
are modified in the repo. No production-host write, no
production-host read, no HTTP call, no command execution of any
kind is performed by PR#19a. No `endpointUrl` re-flip, no Gate 4C
approval, no Gate 4C canary, no production traffic generation, no
`buyerrecon.com` production `/v1/event` call, no Render `/collect`
call, no `/var/www` edit, no symlink change, no `nginx -s reload`,
no `systemctl` action, no service restart, no DNS change, no DB
write, no DB grant, no migration, no `schema.sql` change, no env
file edit, no credential rotation, no
`buyerrecon_prod_collector_app` reset, no `buyerrecon_migrator`
reset, no production token provisioning, no Lane A / B writer, no
runtime scoring, no AMS Trust runtime, no Pass 1 runtime, no Pass
2 runtime, no customer-facing output, no dashboard
implementation, no AMS bridge activation, no Track A, no
Playwright, no website ThinSDK production-mode activation, no
production artifact / config mode flip, no Gate 4D observation,
no Gate 4E Track A / Playwright work, no deletion / mutation /
annotation / normalisation of the 26 historical PR#17s rows on
the production cluster, no customer-facing language upgrade, no
population of the `safe_claims` enum, no flipping of any §9 lock,
and no secret printing are approved by PR#19a. Any future
PR#19b / PR#19c / PR#19d handoff contract PR, Sprint 3 / Sprint
4 / Sprint 5 implementation PR, Gate 4C compatibility-plan or
execution PR, Gate 4D observation PR, Gate 4E Track A /
Playwright PR, scoring / governance / output lock-amendment PR,
Lane A / B writer PR, AMS bridge / runtime PR, Pass 1 / Trust /
Pass 2 runtime PR, dashboard PR, customer-facing report PR,
customer-facing claim / marketing / sales material PR, deep
research commit PR, issue-fix PR, runtime PR, or final
cutover-readiness claim PR remains separately gated by its own
explicit Helen GO.**
