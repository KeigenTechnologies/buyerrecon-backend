# BuyerRecon Evidence Review Pack v0.1

**Status.** Product-facing, founder-led, service-first.
Phase-1 service-led Evidence Review (£1,250). Not a self-serve dashboard.
Not a scoring claim. Not a real-time decisioning surface.

**Owner.** Helen Chen, Keigen Technologies (UK) Limited.
**Date.** 2026-05-16.

---

## 1. What this is

The BuyerRecon Evidence Review is a one-week, founder-led
diagnostic that looks at a customer's existing website traffic and
answers, in plain language:

- Which of your sessions look like real buyer-motion?
- Which look like noise — bots, scrapers, accidental visits,
  consent dust, drive-by clicks?
- Where are the evidence gaps stopping you from telling those two
  groups apart today?
- What would change if those gaps were closed?

The deliverable is a written review — a sample structure ships in
`evidence-review-sample-report-v0.1.md`. Helen walks the customer
through it on a call. The review is the product at Phase 1; the
dashboard is a later phase.

---

## 2. Who it is for

- B2B sites where each closed deal is worth ≥ £5k LTV, so even one
  missed buyer hurts.
- Teams that already have GA4, PostHog, Clarity, or similar — and
  feel they still can't tell who is real.
- Founders or heads of growth who want a second pair of eyes on
  their evidence before changing strategy.
- Sales / marketing operators who suspect they are routing on
  noisy signals.

Not for: pure consumer / B2C, sites with no commercial intent
funnel, sites with zero traffic, or anyone looking for a fully
automated black-box recommendation.

---

## 3. What problem it solves

Most analytics tooling is volume-first. It counts sessions, page
views, conversion-rate-style ratios. It is good at "how many" and
poor at "who is real."

The result: a B2B site sees rising traffic, rising signups, rising
form-fills — and still cannot answer the question Helen hears every
week:

> "Are these real buyers, or are we celebrating noise?"

The Evidence Review answers that question for the customer's last
N days of traffic using the evidence they already have.

---

## 4. What it is NOT

- **Not GA4.** GA4 measures volume + flow. BuyerRecon does not
  replace it; it reads from / alongside it.
- **Not PostHog or Clarity.** Those record sessions and replay
  interactions. BuyerRecon is not a session-replay tool.
- **Not visitor-ID / reverse-IP.** BuyerRecon does NOT promise to
  resolve every visitor to a person or a company.
- **Not bot security.** BuyerRecon flags evidence quality, not
  attack mitigation. (Bot-security vendors do the latter; their
  signal is a useful input.)
- **Not a "score-everyone-out-of-100" engine.** Phase 1 does not
  surface customer-facing scores. The first deliverable is
  *evidence quality* and *what you can / cannot say today*, not a
  per-visitor probability.
- **Not automated.** Helen reviews the evidence in person.

---

## 5. What evidence the review can use

The review is opportunistic — Helen works with what the customer
already has. Typical inputs (any combination is acceptable; none
is mandatory unless flagged):

| Source | What we read from it |
| --- | --- |
| BuyerRecon collector (recommended; see `evidence-review-install-checklist-v0.1.md`) | Session-level point-of-interaction (POI) evidence — surface visited, dwell, scroll, click depth, ordering, return-visit pattern. |
| Customer GA4 / Matomo / Plausible / equivalent | Volume baseline; channel / source / medium attribution; conversion-event counts for comparison. |
| Customer PostHog / Mixpanel / Amplitude exports | Event-level granularity where the customer has it; product-touch events; funnel drop-off. |
| Customer bot-security / WAF logs | Already-classified noise traffic — useful for cross-check, not the only signal. |
| Customer CRM export (HubSpot / Salesforce / etc.) | Closed-loop sample: did the sessions we flagged convert? Did the ones we dismissed not convert? Sample size only — privacy-respected. |
| Customer-supplied form-fill / demo-request logs | Last-mile commercial intent evidence. |

If the customer has none of the above, the install checklist
(`evidence-review-install-checklist-v0.1.md`) describes the
minimum to capture before the review can be useful.

---

## 6. What output the customer receives

Each engagement ships:

1. **A written Evidence Review** in the structure of
   `evidence-review-sample-report-v0.1.md` — typically 6–10
   pages, customer-readable, no jargon-for-jargon's-sake. It is
   designed for the founder / head of growth / head of sales to
   read in one sitting.
2. **A 60-minute walkthrough call** with Helen — covering the
   findings, the verifiable claims, the explicit non-claims, and
   the recommended next steps.
3. **A short "what we can / cannot verify yet"** appendix —
   tells the customer exactly which questions BuyerRecon CAN
   answer with the evidence they have today, and which ones
   require more evidence collection or a longer engagement.
4. **A recommendation memo** — three to five concrete next
   actions, ordered by ROI and effort. No vague "improve
   conversion" advice.

The review does NOT ship: a dashboard, an API, a webhook, a CSV
export of per-visitor scores, or any automated decisioning
artifact.

---

## 7. What decisions it supports

The customer can use the review to decide things like:

- "Should we keep paying for [paid traffic source X]?" — does that
  source produce buyer-motion or noise?
- "Is our chatbot / SDR / inbound-AI tool wasting calls on
  noise?"
- "Is our newest landing page producing the kind of session we
  actually want?"
- "Did our last conversion-rate-optimisation change really help,
  or did it just lift the noise floor?"
- "Where should we invest in better evidence collection before we
  invest in more traffic?"

The review does NOT support: real-time visitor routing, customer-
facing scoring, automated outreach triggers, or any decisioning
that crosses Gate 5 / Gate 6 boundaries from the AMS evidence
chain. Those remain separate, later-phase concerns.

---

## 8. What claims the review must NOT make (yet)

This is a hard discipline. The Evidence Review v0.1 MUST NOT
promise or imply any of the following:

- **No automated buyer scores.** A per-visitor score (`87/100`,
  `"high intent"`, `"warm"`, `"cold"`) is NOT a v0.1 deliverable.
  The review can describe *evidence band* descriptively, but it
  does not output a public number.
- **No identity resolution.** "We can tell you who this person is"
  is NOT a v0.1 claim. The review carries no person-level or
  company-level enrichment unless the customer's own systems
  already have that data and the customer asks for it explicitly.
- **No "we caught every bot"** type bot-detection claim. BuyerRecon
  is not a security product.
- **No "our AI tells you what to do"** claim. The deliverable is
  founder-led judgment over evidence, not an automated
  recommendation.
- **No quantitative ROI predictions** ("you will see a 20% lift").
  ROI sits on the customer's side of the line.
- **No GA4-replacement positioning.** GA4 / PostHog / Clarity
  remain useful. BuyerRecon adds an evidence-first layer.

This list is the v0.1 commercial boundary. Crossing it later
requires explicit Helen sign-off + new evidence to back the new
claim, never the reverse.

---

## 9. Pricing posture

**Phase-1 Evidence Review: £1,250.** This is a service-led
first review, not SaaS subscription pricing. It includes evidence
setup/review, a written findings pack, and a founder-led
walkthrough call. It does not guarantee that specific buyer-motion
patterns, bot-like traffic, or ROI findings will be present.

One customer, one review, one walkthrough. No coupon gate, no
contract lock-in, no recurring billing. The price covers Helen's
time across kickoff, evidence-window review, writing the findings
pack, and the walkthrough.

The review is a **limited-scope first engagement**. It is not a
discounted audit and it is not a "cheap to try" loss-leader. The
goal at Phase 1 is to deliver a written, defensible evidence
picture for the customer and to learn which evidence shapes are
commercially load-bearing across customers. A subscription /
dashboard product is a Phase-2 question, not a Phase-1 one, and
will be priced accordingly when it ships.

---

## 10. Boundary statements (carried from prior architecture work)

The Evidence Review Pack sits on Track B (evidence backend) of the
BuyerRecon three-part architecture and is **strictly downstream**
of all of the following:

- The Core AMS Product Layer scoring chain remains internal-only;
  no `ProductDecision` / `RequestedAction` / scorer output is
  surfaced to customers (AMS PR#A1–PR#A7 boundary).
- The BuyerRecon collector behaves as it does today; the Evidence
  Review consumes its existing output, not a new runtime path.
- No new DB write, no new HTTP endpoint, no new env flag, no new
  CI workflow, no production-deploy posture change is required to
  ship v0.1 of the Evidence Review. The review is built from the
  customer's existing evidence + Helen's review work.

---

## 11. Files in the Evidence Review Pack v0.1

| Path | Role |
| --- | --- |
| `docs/product/evidence-review-pack-v0.1.md` | This umbrella doc — positioning, scope, claims, non-claims. |
| `docs/product/evidence-review-sample-report-v0.1.md` | Customer-readable sample structure of the written review (placeholder data only). |
| `docs/product/evidence-review-install-checklist-v0.1.md` | Practical checklist Helen uses pre- and post-install. |
| `docs/product/evidence-review-sales-demo-script-v0.1.md` | 5–7 minute founder-led demo flow. |

---

## 12. Next moves after v0.1

If five Phase-1 reviews land cleanly:

- Cluster the customer questions Helen heard most often.
- Identify which questions can be answered with *existing*
  evidence and which need new collection.
- Decide whether v0.2 widens the review (more evidence shapes) or
  starts the path toward a customer-readable dashboard surface.

That decision is Helen's, post-v0.1. This doc does not pre-commit
it.

---

**End of Evidence Review Pack v0.1.**
