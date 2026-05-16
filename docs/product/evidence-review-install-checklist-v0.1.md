# BuyerRecon Evidence Review — Install Checklist v0.1

> **Purpose.** Practical, founder-usable checklist Helen runs
> with each Phase-1 customer **before** the Evidence Review can
> produce useful findings. Covers what to ask, what to install,
> what to verify, and what counts as PASS / stop-the-line.

---

## 1. Pre-install — questions to ask the customer

Ask these on the kickoff call. Write the answers in the engagement
file; without them the review is opportunistic at best.

### 1.1 Commercial context

- What does *one closed customer* look like for you in revenue
  terms? (Used to decide whether the LTV-≥-£5k posture in the
  pack applies.)
- Roughly how many closed customers per month do you have today?
- What is the primary conversion event on the site? (Form-fill,
  demo-request, signup, calculator, free-trial, other.)
- How long is your typical sales cycle, from first website touch
  to closed-won? (Used to scope review period.)

### 1.2 Stack context

- Which analytics tooling is currently installed?
  (GA4 / PostHog / Mixpanel / Amplitude / Matomo / Plausible /
  Clarity / Heap / nothing.)
- Which CRM, if any? (HubSpot / Salesforce / Pipedrive / Close /
  spreadsheet.)
- Which bot / WAF layer, if any? (Cloudflare / Akamai / nothing.)
- Any session replay? (PostHog / FullStory / Hotjar / nothing.) —
  We will NOT watch replays for v0.1; we ask only to know what's
  present.
- Are there marketing-automation tools that fire pixels?
  (HubSpot, Marketo, ActiveCampaign, etc.)

### 1.3 Privacy / consent context

- Where do your visitors come from (UK / EU / US / global)?
- What does your cookie banner currently do? (Granted / declined
  / no banner / not enforced.)
- Are you bound by any specific contractual data-handling
  requirements? (Customer data residency, SOC2, ISO, etc.)
- Does your existing analytics tooling respect the consent state,
  or does it fire regardless?

### 1.4 Traffic shape

- Roughly how many sessions per week does the site see?
- Any large paid-traffic source we should know about?
- Any large bot / scraper / monitoring traffic the customer has
  already noticed?
- Anything seasonal or campaign-driven happening during the review
  period that we should account for?

### 1.5 Out-of-scope clarification

- Confirm with the customer **in writing** before installing:
  - The review is service-led.
  - The review will NOT identify individual visitors by name /
    company.
  - The review will NOT promise a conversion-rate lift.
  - The review will NOT replace GA4 / PostHog / Clarity.
  - The review will NOT mint scores per visitor.

---

## 2. Site / domain / workspace info to capture

Before any technical work:

- [ ] Production domain (and any www / apex variants).
- [ ] Staging domain (if any).
- [ ] Workspace / site ID the customer wants the collector tagged
      with.
- [ ] Primary contact for install access (developer / agency / no
      one — affects what we can do).
- [ ] Tag manager in use (GTM / Segment / native code) — affects
      install method.
- [ ] Any IP allowlist / geo-block we need to know about.

---

## 3. Collector install verification

The BuyerRecon collector is the canonical evidence source. Install
or co-install (it can run alongside GA4 + PostHog without
conflict).

### 3.1 Install method

Pick ONE per customer, in order of preference:

1. **GTM container** — preferred for most customers. One tag, one
   trigger ("All Pages"), config object pre-filled with the
   workspace ID. No code change in the customer codebase.
2. **Direct `<script>` tag** in the site `<head>` — for customers
   without GTM. Helen / customer dev pastes one snippet.
3. **Segment source** — for customers already using Segment as a
   tag-management layer.

### 3.2 Post-install verification (CRITICAL — do this on the call)

Open the site in a fresh incognito window with devtools open.
Verify EACH:

- [ ] Network panel shows the collector beacon firing on the
      landing page (status code 200/204).
- [ ] No JavaScript errors in the console attributable to the
      collector.
- [ ] No CSP / cross-origin error blocking the beacon.
- [ ] No double-fire (same beacon firing twice for one page-load).
- [ ] Site rendering is unaffected (Cumulative Layout Shift /
      timing not visibly degraded).
- [ ] Consent banner state is captured (if customer has one) —
      either via the banner's own callback or via a documented
      assumption recorded in the engagement file.

### 3.3 Walk through three sessions yourself

Before claiming PASS, Helen herself opens three sessions on the
customer site and confirms each session shape comes through:

- A simple landing + bounce.
- A multi-page scroll-and-click sequence.
- A form-fill (using a test address).

If any of those three does not appear in the collector's evidence
within the customer's documented capture latency, the install is
NOT PASS — debug before continuing.

---

## 4. Consent / privacy notes

The Phase-1 Evidence Review treats consent state as
authoritative: if a session declined cookies, the collector should
not capture it, or should capture only the bare minimum the
customer's privacy policy authorises.

Per-customer:

- [ ] Privacy policy URL recorded in the engagement file.
- [ ] Consent banner behaviour documented (granted / declined /
      not-set assumption).
- [ ] No PII (name, email, phone, IP-derived-person) is asked for
      or stored during the review beyond what the customer's own
      systems already store.
- [ ] If the customer is EU / UK, confirm in writing that the
      review uses only the customer's own evidence and does NOT
      attempt third-party enrichment.

---

## 5. UTM / source context

Tagging discipline is one of the most common evidence-quality
issues. Capture:

- [ ] List of current paid traffic sources (Google Ads, LinkedIn
      Ads, Meta Ads, sponsorships, partnerships, etc.).
- [ ] Current UTM tagging convention (or absence of one).
- [ ] Whether the customer has any "house" rules for `utm_source`
      / `utm_medium` / `utm_campaign` values.
- [ ] Any landing-page-specific URLs the customer treats as
      campaign destinations.

If UTM hygiene is patchy (common), record it as a known evidence
gap rather than as a blocker — it will appear in §3 of the sample
report.

---

## 6. Test events to send

Before the review window begins, send (or ask the customer to
send) the following test traffic — these are sanity checks for
the evidence chain end-to-end:

1. **One pricing-deep session.** Land on home, click to pricing,
   scroll the pricing page, click an FAQ, leave. Should appear as
   a "buyer-motion-shape candidate" in the evidence collected.
2. **One demo-request session.** Land on a landing page, click
   demo CTA, complete the form with a known-test email (e.g.
   `helen+test@keigen.technology`), submit.
3. **One quick-bounce session.** Land, do nothing, close in under
   2 seconds. Should appear as low-quality / noise.
4. **One non-human session.** If the customer is comfortable, run
   a `curl` or headless-browser hit at the landing page. Should
   appear as noise (no scroll, no visibility, no clicks).

These four sessions are the "smoke test" of the evidence chain.
If even one is missing post-collection, the install is NOT yet
PASS.

---

## 7. Evidence chain checks (pre-review)

Before booking the review window:

- [ ] Collector has run for at least 7 calendar days on the
      customer's production site.
- [ ] GA4 / PostHog / equivalent has not changed configuration
      during the period.
- [ ] No campaign launches / pauses that would invalidate the
      period unless the customer wants those events specifically
      reviewed.
- [ ] CRM closed-loop sample requested from the customer (12
      closed-won, 12 closed-lost minimum — anonymised /
      pseudonymised; only what they're willing to share).
- [ ] Customer has confirmed the test events from §6 appeared in
      their own analytics layer (cross-check, not just BuyerRecon's
      view).

---

## 8. What counts as install PASS

ALL of the following must be true:

- [ ] Collector beacon fires reliably on production landing pages.
- [ ] All four §6 test sessions appear in the evidence collection.
- [ ] No CSP / CORS / console errors attributable to the collector.
- [ ] Consent state is documented (granted / declined / not-set
      assumption).
- [ ] Customer has provided closed-loop CRM sample data.
- [ ] At least 7 days of evidence accumulated since install.
- [ ] Customer has signed-off the v0.1 commercial boundary (§1.5
      out-of-scope clarification).

If all are true, the review can proceed.

---

## 9. What counts as stop-the-line

ANY of the following stops the engagement until resolved — no
review delivery, no claims made:

- Collector cannot be installed without modifying customer
  production-deploy posture (e.g. blocked by their security review).
- CSP / consent / privacy policy blocks evidence capture in a way
  that leaves nothing useful to review.
- Customer expects v0.1 to deliver per-visitor scores, automated
  scoring, identity resolution, or any other v0.1 explicit
  non-claim. Reset the expectation in writing before continuing.
- Customer's traffic volume is so low (single-digit sessions/day)
  that the review cannot produce statistically interesting
  evidence; recommend an alternative engagement scope.
- The customer's CRM closed-loop sample is unavailable AND no
  proxy for conversion is available — the retroactive validation
  step of §7 of the sample report cannot run.

Stop-the-line is recorded in the engagement file. The £1,250
Evidence Review fee is not charged for stopped engagements; that
is a policy choice about reputation, not contractual lock-in.

---

## 10. Engagement file template

For each Phase-1 customer Helen runs:

```
customers/<customer-slug>/
  kickoff-notes.md         (answers to §1)
  install-notes.md         (§2 + §3 + §4)
  smoke-test-results.md    (§6)
  evidence-window.md       (§7 + period chosen)
  review-draft.md          (sample report shape)
  walkthrough-notes.md     (call notes)
  post-review-actions.md   (what the customer agreed to do next)
```

Kept in a private folder, not in this repo. (This repo carries
the *template* and *posture*, not customer data.)

---

**End of Install Checklist v0.1.**
