# BuyerRecon Sprint 2 PR#16a — Lane A / Lane B Evidence Review Contract Planning

**Status.** PLANNING ONLY. Docs-only. No code, no DB, no
migrations, no schema changes, no collector / scoring change, no
durable Lane-A / Lane-B writer, no dashboard, no API, no AMS
repo touch, no Track-A code touch, no bad-traffic test execution,
no customer-facing automated scoring, no customer private notes
committed to the repo.

**Date.** 2026-05-17. **Owner.** Helen Chen, Keigen Technologies
(UK) Limited.

**Authority.**
- `docs/product/evidence-review-pack-v0.1.md` (merged `a2f81dc`)
  — Phase-1 £1,250 service-led Evidence Review umbrella doc.
- `docs/sprint2-pr15a-evidence-review-snapshot-observer.md`
  (merged `a3cd369`) — read-only snapshot observer that already
  emits a §4 Lane-A and a §5 Lane-B *section*; PR#16a defines
  the *contract* governing what those sections may say in any
  future report flow.
- AMS PR#A7 merge `a6855a5` — runtime-bridge work paused;
  AMS-side execution remains out of scope.

---

## 1. Purpose

PR#16a defines the **Lane A / Lane B evidence contract** that
will govern the BuyerRecon Evidence Review output **before** any
Track-A bad-traffic testing runs and **before** any durable
Lane-A / Lane-B writer lands.

It exists to answer, in writing, four questions the next
implementation PR (PR#16b or later) will otherwise re-litigate
under deadline pressure:

1. What is **Lane A** allowed to mean to a customer? What is it
   forbidden to mean?
2. What is **Lane B** allowed to mean *internally*? What is
   forbidden to surface?
3. How does **Track A** (the separate bad-traffic behaviour
   testing harness) relate? When may Track-A evidence enter the
   report, and in what shape?
4. What language is allowed and forbidden in the
   customer-facing written Evidence Review when each lane's
   evidence is described?

This is planning only. PR#16a produces NO code, NO Lane-A or
Lane-B writer, NO Track-A run. The contract here is what PR#16b
(and any future writer / dashboard PR) must obey.

---

## 2. Current state

| Artifact | Status | Commit / merge |
| --- | --- | --- |
| Evidence Review Pack v0.1 (£1,250 service-led, founder-led) | Merged. | `a2f81dc` |
| PR#15a Evidence Review Snapshot observer (read-only, founder-readable markdown, §4 Lane-A section + §5 Lane-B section) | Merged. | `a3cd369` |
| PR#15b Hetzner staging proof | PASS — proof closure doc pending (stashed on its own branch awaiting Helen approval). | branch `buyerrecon-sprint2-pr15b-…` |
| AMS PR#A1–A7 (fixture compatibility → translator → offline scoring dry-run) | Merged on AMS `main`; runtime bridge **paused** by explicit Helen directive. | AMS `a6855a5` |
| Track A bad-traffic testing harness | Separate repo / separate workstream. **RECORD_ONLY**. Not merged into backend. Will run after PR#16a contract exists. | (out of repo) |

What does NOT yet exist:

- Any durable Lane-A or Lane-B writer table.
- Any customer-facing automated scoring surface.
- Any Track-A → backend import path.
- Any runtime bridge from BuyerRecon evidence into AMS Product
  Layer scoring.

PR#16a leaves all four of those non-existent and tells PR#16b+
what to obey when one or more of them is built.

---

## 3. Lane definitions

### Lane A — customer-safer evidence-quality lane

**Purpose.** Lane A carries observations about evidence quality
itself: invalid / low-quality / bot-like / ambiguous traffic
candidates, source quality, install / data gaps that affect
whether the rest of the evidence can be trusted.

Lane A is the lane Helen may *talk to the customer about*, with
appropriate caveat language.

**Allowed customer-facing posture.**

- "candidate observations" — never "scores".
- "evidence suggests" — never "we have detected".
- "requires manual review" — explicit operator action.
- "not enough evidence" — defensible non-claim.
- "cannot verify yet" — explicit non-claim with the gap named.

**Forbidden customer-facing posture.**

- Automated per-session or per-visitor score (e.g. "this visitor
  scored 0.87").
- Bot **certainty** claim ("we caught all bots", "every bot is
  flagged", "the bot rate is exactly N%").
- **Fraud** accusation of any kind. BuyerRecon is not a fraud
  product.
- Identity resolution ("this is John at Acme Co.").
- Per-visitor automated judgement ("this visitor was/wasn't a
  buyer").
- ROI claim of any kind ("you'll see X% lift", "this will save
  £Y/month").
- "we detected all bad traffic" / "we filtered everything
  suspicious" / similar exhaustive-claim phrasings.

### Lane B — internal learning / buyer-motion lane

**Purpose.** Lane B carries observations about buyer-motion
hypotheses, product-context fit, timing / window hypotheses,
POI / product-context observations, and the future learning
loop that feeds the AMS Product Layer (offline, never as a live
bridge).

Lane B is **internal only.** It feeds Helen's founder review
input. It does not, on its own, become customer-facing copy.

**Allowed posture (internal only).**

- "internal observation" — never published as a customer claim.
- "founder review input" — Helen reviews + decides what (if
  anything) flows into the customer-facing written review.
- "manually rewritten and bounded" — if a Lane-B observation
  ever inspires customer-facing copy, the founder rewrites it
  in customer-readable, claim-safe language; the original
  Lane-B observation is **never** pasted into a customer report
  verbatim.

**Forbidden.**

- Customer-facing automated judgement of any kind.
- Automated buyer-intent score surfaced to a customer.
- `ProductDecision` emission (AMS-canonical type; AMS-owned).
- `RequestedAction` emission (AMS-canonical type; AMS-owned).
- AMS scoring output flowing into a customer report (the AMS
  PR#A1–A7 chain stayed offline / dry-run; that boundary
  carries through here).
- Sales-action recommendation ("contact this account", "this
  prospect is hot") without human review.

---

## 4. Evidence sources by lane

### Lane A may consume

- `accepted_events` aggregate coverage (counts, not raw rows).
- `rejected_events` counts.
- `ingest_requests` reconciliation counts.
- `session_features` coverage (counts, never raw fields).
- `session_behavioural_features_v0_2` coverage (counts, never
  raw burst / dwell values per session).
- `stage0_decisions` (counts + exclude / eligible split).
- `risk_observations_v0_1` (counts).
- **Future Track-A RECORD_ONLY outcomes, if and only if imported
  later through an approved safe-summary path** (see §6).
  Without that approved path, Lane A consumes NO Track-A data.

### Lane B may consume

- `session_features`.
- `session_behavioural_features_v0_2`.
- POI observations (`poi_observations_v0_1`).
- POI sequence observations (`poi_sequence_observations_v0_1`).
- ProductFeatures candidate observations from the existing
  PR#14c CLI observer (read-only; no durable table).
- Risk / timing / product-context observations as evidence-shape
  signals only.
- AMS offline proof outputs (PR#A5 batch proof, PR#A7
  dry-run) as **non-runtime reference data only** — not as a
  live bridge, not as automated scoring input.

### Hard rule on Track-A leakage

**Track-A raw test labels MUST NOT leak into:**

- Backend collector telemetry (no `bot_test=true` query param
  reaching `accepted_events`).
- Live URLs / production page URLs.
- UTM parameters / source tagging on customer-visible links.
- `window.dataLayer` / GTM dataLayer of any production property.
- GA4 (no `bot_test` event params, no Track-A custom
  dimensions).
- Cookies / `localStorage` / `sessionStorage` on production
  domains.
- Backend DB (no `accepted_events.payload` carrying Track-A
  markers).
- Customer report text (no "this came from a Track-A run").

Track-A leakage is a stop-the-line condition (see §11).

---

## 5. Report output contract

The contract below governs any future report surface — whether
that's an extension of the PR#15a snapshot observer, a future
preview observer (PR#16b), or eventually a durable Lane-A / B
table read-out (PR#17+). Every surface obeys these rules.

### Lane A — allowed report fields

- `observation_family` — the category, e.g. `rejected_event`,
  `stage0_excluded`, `risk_corroboration`,
  `evidence_chain_gap`.
- `evidence_source` — which table / observer the observation
  came from.
- `aggregate_count` — integer count in the window. No
  per-session value.
- **Sanitized path-only example** — a URL path (no query, no
  fragment) if and only if it adds reviewer value AND has been
  routed through PR#15a `sanitizeOutputText`.
- **Evidence-confidence band** — explicitly defined as
  "confidence that the *evidence* is internally consistent",
  NOT a per-visitor buyer score. Only allowed if a future PR
  defines the band semantics in writing and they pass Codex
  review.
- `manual_review_needed: true|false` — operator flag, not
  customer claim.
- `cannot_verify_yet_reason` — explicit gap text, e.g.
  "session_features empty in window".

### Lane A — forbidden report fields

- Per-session raw ID. `truncateSessionId()` is the upper bound
  for any session-derived value.
- `token_hash`, `ip_hash`, `user_agent`, `ua`, `ip`, `cookie`,
  `authorization`, `bearer`, `pepper` — any of these as a
  field name OR a value.
- Raw payload JSON. `raw_payload`, `canonical_jsonb` — both
  forbidden.
- Full URL query strings. The renderer strips `?…` and `#…`.
- Email addresses, person identifiers, company identifiers
  derived from enrichment.
- **Bot label sourced from Track A.** Track-A test labels are
  evidence about Track A, not evidence about the customer's
  traffic; surfacing them as Lane-A observations would mislead.
- "fraud", "fraudulent", "definitely a bot" — claim-shaped
  language; Lane A's posture is "candidate", not "verdict".
- Numeric score, until a separate PR defines its semantics +
  threshold + audit trail AND Helen approves.

### Lane B — allowed report fields

- `internal_observation_family` — e.g. `buyer_motion_hypothesis`,
  `product_context_hypothesis`, `timing_window_hypothesis`,
  `evidence_pipeline_coverage`.
- `aggregate_count` — integer count in the window.
- `missing_evidence_bucket` — explicit named gap.
- `product_or_context_or_timing_hypothesis` — short
  human-readable hypothesis, **internal only**.
- `private_founder_note_prompt` — a prompt for Helen's private
  customer engagement file (NOT the customer's review).

### Lane B — forbidden report fields

- Customer-facing buyer-intent score of any kind.
- Sales-action recommendation ("contact this account",
  "prioritise this lead").
- Account prioritisation / lead-scoring output.
- `ProductDecision` field (AMS-canonical).
- `RequestedAction` field (AMS-canonical).
- AMS scoring result, raw or transformed.
- Identity claim ("this is X at Y Corp").

---

## 6. Track A relationship

**Track A is a separate, RECORD_ONLY bad-traffic behaviour
testing harness.** It exists to characterise how synthetic
adversarial traffic shapes look against the BuyerRecon evidence
chain. It is NOT a production / customer-facing surface.

### Track A invariants (carry-through)

- Track A does **not** merge into backend.
- Track A does **not** override backend validation. Stage 0 /
  feature extraction / observer outputs are the source of truth
  for what backend "sees"; Track A produces its own private
  test record.
- Track A should be run **after** PR#16a's contract exists, so
  Helen can see what Track-A-shaped evidence would look like
  *if* the contract were in effect.

### Future safe path (planning only — not implemented in PR#16a)

A future PR may define a safe Track-A → BuyerRecon import path:

1. Track A produces a **private test summary outside the
   backend repo** — never inside `/Users/admin/github/buyerrecon-backend/`.
2. A future planning PR (`PR#16c` candidate) defines the
   **safe-summary contract**: aggregate counts only, no raw
   test-session IDs, no synthetic-bot labels, no QA tags, no
   internal-tool markers — the same sanitization rules the
   Lane A / Lane B reports already obey.
3. After Codex review + Helen sign-off, a separate PR may
   import the safe-summary into the report as
   **aggregate / sanitized test-observation categories**, AND
   only if the report visibly labels those rows as "from a
   Track-A test harness, not from real production traffic."
4. Without that explicit approved import contract, the
   Evidence Review report carries **zero** Track-A data.

### Hard rule (repeats §4 deliberately for prominence)

Track-A QA / test / bot / synthetic labels MUST NEVER appear
in:

- Live telemetry of any production BuyerRecon collector.
- Customer-facing output of any kind.
- Backend DB tables under any column.
- Any URL, UTM, dataLayer key, cookie, or storage entry on a
  production domain.

A breach is a stop-the-line condition (§11).

---

## 7. Evidence Review Snapshot changes implied by this contract

**Planning only. PR#16a writes no code.**

The PR#15a snapshot observer already emits §4 Lane-A and §5
Lane-B sections. Once Helen signs off on the contract here,
PR#16b (read-only Lane-A / Lane-B report preview) becomes the
natural next implementation step:

| PR#16b candidate (planning only — not in this PR) | Scope |
| --- | --- |
| Read-only Lane-A / Lane-B **report preview** observer | New CLI / module that consumes the PR#15a observer output (or re-reads the same tables) and renders a **customer-shaped** Lane-A / Lane-B preview Helen can read alongside the customer's written Evidence Review. |
| **No writes.** | No new DB table. No durable Lane-A or Lane-B writer. |
| **No customer score.** | Output respects §5 forbidden-fields rules. |
| **No durable Lane-A / Lane-B tables.** | Tables are PR#17a planning territory; PR#16b does not propose them. |
| **No Track-A import yet** | Unless and until a separate PR explicitly approves a safe-summary contract (§6 future-safe-path). |

PR#16b is a planning candidate, not an instruction. Helen
chooses whether to land it, defer it, or skip it.

---

## 8. Customer wording rules

Carries forward `evidence-review-pack-v0.1.md` §8 "claims it
must NOT make" + extends with Lane-A / Lane-B-specific phrasing.

### Allowed customer-facing wording

- "we observed evidence consistent with..."
- "this should be reviewed manually"
- "the evidence is insufficient to verify..."
- "this pattern may reduce confidence in the traffic sample"
- "we cannot claim..."
- "the evidence suggests... but the chain has gaps that
  prevent verification today"
- "[N] sessions in the window matched a shape commonly
  associated with [X], though that shape is necessary, not
  sufficient, to claim [X]"

### Forbidden customer-facing wording

- "bot detected" — bot certainty is a non-claim per §3 Lane A.
- "fraud detected" — BuyerRecon is not a fraud product.
- "real buyer score" — no per-visitor score in v0.1.
- "this account should be contacted" — sales-action without
  human review.
- "we identified the visitor" — no identity resolution.
- "guaranteed ROI" — no ROI claim.
- "automated decision" — BuyerRecon's deliverable is
  founder-led judgement, not an automated decision.
- "all bots filtered" / "all bad traffic caught" — exhaustive
  claims.

Helen's tone discipline (carried from
`evidence-review-sales-demo-script-v0.1.md`): never say "AI"
unless the customer says it first; never quote a
conversion-rate-lift number; the win condition is a defensible
written review, not a viral one-liner.

---

## 9. Lane A / Lane B acceptance criteria

When any future PR implements a Lane-A or Lane-B writer / report
surface / customer-facing flow, that PR MUST:

- Be **read-only first.** No DB write in the v0.1 of any
  Lane-A / Lane-B surface.
- Produce **deterministic output.** Same input → same output;
  no clock, no rand inside the renderer.
- Produce **sanitized output.** Every dynamic value routes
  through the PR#15a `sanitizeOutputText` /
  `sanitizeBoundaryLabel` / `sanitizeErrorNote` sanitizer trio
  (or its successor); no raw identifiers / URLs / emails /
  tokens / UA strings / session IDs / UUIDs reach stdout or
  customer copy.
- Carry **no raw identifiers** — no full `session_id`, no
  `visitor_id`, no `person_id`, no `company_id`, no
  `account_id`, no `email_hash`, no `person_hash`.
- Carry **no Track-A label leakage** — see §6.
- Carry **no AMS runtime bridge** — see PR#15a §9 and PR#A4
  Gate-5 boundary.
- Carry **no `ProductDecision` / `RequestedAction`** outside
  the forbidden-boundary text.
- Carry **no customer-facing automated scoring.**
- Pass **Codex review** before merge.
- Pass **Hetzner staging proof** before use in a real
  customer Evidence Review (mirrors PR#15b cadence).

A PR that proposes to relax any of the above is a
contract-amendment PR, not an implementation PR; it requires
separate Helen sign-off and a written rationale.

---

## 10. Future PR map

PR#16a is planning. The next steps Helen can choose from:

| PR | Scope | Recommended ordering |
| --- | --- | --- |
| **PR#16b** | Read-only Lane-A / Lane-B report preview observer. Renders a customer-shaped preview using PR#15a output; no writes; no durable tables; no Track-A import. | **Default next.** Lowest blast radius; produces evidence Helen can read against the contract here. |
| **Track-A test run** | Run the existing bad-traffic harness now that this contract is locked. RECORD_ONLY. **Outside backend repo.** Produces private test summary; does NOT flow into backend yet. | Run after PR#16a is approved. Run in parallel with PR#16b decision. |
| **PR#16c (optional)** | Track-A safe-summary contract — define the aggregate/sanitized import format if Helen wants to surface test-observation categories in the report. Planning only. | Only if Helen wants to surface Track-A data in the report. Otherwise skip. |
| **PR#17a** | Durable Lane-A / Lane-B table **planning only** (not implementation). | Only after PR#16b ships and one or more customer Evidence Reviews have surfaced concrete pain that durable persistence would solve. |
| **PR#17b+** | Durable Lane-A / Lane-B writer **implementation**. | Only after PR#17a + customer evidence + Codex approval + Helen sign-off. |

What is explicitly NOT recommended:

- An AMS runtime bridge (paused since AMS PR#A7).
- A customer-facing automated scoring surface (forbidden
  until a separate, Helen-signed PR defines the score
  semantics + audit trail).
- A direct Track-A → backend DB import (forbidden until the
  PR#16c contract exists, AND a separate writer PR
  implements it).

---

## 11. Stop-the-line conditions

Any of the following triggers an immediate halt of the work
chain, a Helen notification, and a Codex review of the offending
PR before further work continues:

- **Track-A label leakage.** Any `bot_test=*` / `qa=*` /
  synthetic-traffic marker appears in a production URL, a UTM
  parameter, a `dataLayer` push, a GA4 event, a backend DB row,
  a cookie, or a storage entry.
- **Customer-facing automated score.** Any per-session or
  per-visitor numeric score reaches a customer surface.
- **Lane B → customer without human rewriting.** A Lane-B
  observation is pasted verbatim into a customer-facing
  Evidence Review.
- **`ProductDecision` / `RequestedAction` emission.** Either
  type appears in a non-AMS code path, or in a
  customer-facing surface, or in a Lane-A / Lane-B output
  outside the forbidden-boundary text.
- **AMS runtime bridge proposed.** A PR proposes wiring AMS
  Product Layer scoring into a live backend path. Pause
  directive is still in effect since PR#A7.
- **DB writer / migration before contract approval.** A PR
  proposes a Lane-A / Lane-B durable table without PR#17a
  planning + Helen sign-off.
- **Raw identifiers in report.** A full `session_id`, raw
  email, raw URL with query string, `token_hash`, `ip_hash`,
  `user_agent`, or `raw_payload` reaches stdout or customer
  copy.
- **Customer private notes enter the repo.** Customer-specific
  notes appear under `/Users/admin/github/buyerrecon-backend/`
  rather than the private engagement folder.

A stop-the-line PR is reverted (or held unmerged) and a
post-mortem is written before any related work resumes.

---

## 12. Acceptance criteria for PR#16a

PR#16a is acceptable iff:

- Exactly **one docs-only file** created
  (`docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md`).
- Lane A / Lane B definitions are clear, with explicit
  allowed-posture and forbidden-posture lists (§3).
- Track A relationship is explicit (§6); Track-A leakage is
  enumerated as a stop-the-line condition (§11).
- Customer wording boundaries (§8) extend the Evidence Review
  Pack v0.1 wording rules without contradicting them.
- Future PR map (§10) names the next 4+ candidate PRs and
  flags which ones are recommended-default vs gated.
- No code change. No `package.json` change. No test added. No
  fixture added. No CI workflow change. No DB / migration /
  schema change. No collector / scoring / Lane-A / Lane-B
  writer change.
- No AMS repo touch. No Track-A repo touch. No bad-traffic
  test execution.
- No customer-facing automated scoring surfaced anywhere.
- No customer private notes in the repo.

---

**End of PR#16a Lane A / Lane B Evidence Review Contract
Planning.**
