# BuyerRecon Evidence Review — Sales Demo Script v0.1

> **Format.** 5–7 minute founder-led demo. Helen on a call,
> screen-share optional. Evidence-first, no slides required. The
> close is a £1,250 Phase-1 Evidence Review, not an annual contract.

---

## 0. Pre-call (60 seconds, before joining)

- Open the prospect's website in an incognito tab.
- Open their pricing page, their demo-request page, and one
  case-study page.
- Note any visible analytics (GA4 tag, PostHog snippet, Clarity
  banner) — useful for the framing in §2.
- Have `evidence-review-pack-v0.1.md` open in another tab as a
  silent reference, not a script to read aloud.

---

## 1. Opening problem (≈ 1 minute)

> "Most B2B sites have plenty of analytics. GA4, maybe PostHog or
> Clarity, maybe a visitor-ID tool. And most of those sites still
> can't answer one question their CEO asks every week —
>
> *'Are these real buyers, or are we celebrating noise?'*
>
> The reason is structural. The tools you have count sessions and
> events. They're good at *how many*. They're not built to tell
> you *who's real*. So your dashboards go up and to the right and
> you still don't know whether your last paid-traffic spend
> produced six evaluators or six hundred scrapers."

**Pause briefly.** Let the prospect react. They almost always
recognise the question.

---

## 2. Why GA4 / Clarity / visitor-ID are not enough (≈ 1 minute)

> "Quick sketch of where each tool sits:
>
> - **GA4** measures volume and flow. It's accurate at counting.
>   It does not tell you which sessions are real buyer-motion.
> - **PostHog / Clarity** record what people do on the page. They
>   show you the session; they don't tell you whether the session
>   matches how a real evaluator behaves.
> - **Visitor-ID / reverse-IP tools** try to put a company name
>   on an anonymous visit. They're directionally useful for
>   account targeting. They don't tell you whether that
>   identified visit was a real evaluator, a scraper, an analyst,
>   or someone clicking by accident.
> - **Bot security / WAF** filters the obvious volume. Good at
>   what it does. The residual — the stuff that gets *past* the
>   WAF and looks human but isn't — is exactly where the noise
>   problem sits.
>
> Each tool answers a different question. None of them answers
> 'who's real among the ones who got through.'"

---

## 3. BuyerRecon evidence-first framing (≈ 1 minute)

> "BuyerRecon takes a different starting point. Instead of asking
> 'how do we score each visitor,' it asks 'what evidence do you
> have, and what does that evidence let you say honestly?'
>
> We look at:
>
> - The shape of each session — pages, ordering, dwell, scroll,
>   click depth, return behaviour.
> - Where the evidence chain has gaps — UTM hygiene, form-fill
>   context, closed-loop signal back from your CRM.
> - Which sessions look like real buyer-motion. Which look like
>   noise. Which are ambiguous because your evidence isn't deep
>   enough yet.
>
> Three things we *don't* do, that I want to put on the table
> early:
>
> 1. We don't replace GA4 or PostHog. We sit alongside them.
> 2. We don't promise to identify every visitor by name or
>    company. That's a different category of tool.
> 3. We don't ship you an AI dashboard that scores everyone
>    out of a hundred. Phase 1 is a founder-led written review,
>    not a black-box recommendation."

---

## 4. Example evidence-review flow (≈ 2 minutes)

If screen-share is on, show a redacted page from the sample
report; if not, walk through it verbally:

> "Here's the shape of what you get. It's a written review,
> roughly six to ten pages, customer-readable. You and I read it
> together on a one-hour call.
>
> Section by section:
>
> 1. **Executive summary** — three things the founder needs to
>    know. Not twenty.
> 2. **What we reviewed** — exactly which evidence we used,
>    exactly what we didn't.
> 3. **Evidence quality snapshot** — where your chain is solid,
>    where it's patchy, where it's broken.
> 4. **Buyer-motion observations** — the session shapes that
>    look like real evaluators. Counts, not names.
> 5. **Noise observations** — the patterns that look like bots,
>    scrapers, accidental visits. Structural patterns, not
>    identity claims.
> 6. **Conversion-path evidence gaps** — usually two or three
>    concrete gaps that, if closed, change which questions you
>    can ask honestly.
> 7. **What we can verify** — the claims I'm willing to put my
>    name to, on this data.
> 8. **What we cannot verify yet** — the claims I am NOT willing
>    to make on this data, and what would let us make them.
> 9. **Recommended next steps** — three concrete actions ranked
>    by ROI and effort. No 'improve conversion' fluff.
>
> The sample structure ships with the engagement so you know
> what you're paying for before you pay."

---

## 5. What the customer gets after review (≈ 1 minute)

> "After the call, you have four things:
>
> 1. **The written review.** Yours to keep, share with your
>    investors, share with your board, share with whoever needs
>    to see the evidence picture.
> 2. **A clear list of what's verifiable today and what isn't.**
>    Most teams have never had this list. Without it, every
>    later analytics decision is partly faith-based.
> 3. **Two or three concrete next actions.** Most are not
>    BuyerRecon work. Often it's a UTM convention fix, or
>    closing a form-fill capture gap, or attaching CRM closed-
>    loop signal back to the session evidence. I'll tell you
>    when the right next move is mine to do and when it's yours.
> 4. **Honesty about whether BuyerRecon is right for you.** If
>    the review tells me your evidence chain is too thin to be
>    useful at this stage, I'll say so. I'd rather lose a £1,250
>    engagement and gain a referral two years later than oversell
>    the v0.1 product."

---

## 6. Close / next step (≈ 30 seconds)

> "If this is interesting, the next step is small:
>
> - We do a 30-minute kickoff call.
> - I send you a one-page install checklist — usually it's a
>   single GTM tag, no code change in your repo.
> - We let the collector run for one to two weeks alongside what
>   you already have.
> - I write the review. We read it together on a one-hour call.
> - £1,250. One customer, one review, one call. Service-led, not
>   SaaS. No subscription, no contract lock-in."

**Pause.** Wait for their response. The natural follow-ups are
either:

- "What if we don't have GA4 / our tooling is X?" → see §1.2 of
  the install checklist.
- "How does the £1,250 break down?" → "It covers Helen's time
  across kickoff, evidence-window review, writing the findings
  pack, and a one-hour walkthrough. It is a service-led first
  engagement, not SaaS subscription pricing. There is no
  recurring fee, no contract lock-in, no coupon gate."
- "Could you do a cheaper pilot or discounted audit instead?"
  → "No. It isn't a discounted audit and it isn't a loss-leader.
  £1,250 is what the work takes to deliver a defensible written
  review. A cheaper price would either signal we don't take the
  work seriously or force the work to be too thin to be useful."
- "Is the price the same for every customer?" → "Yes for v0.1.
  When the review scope widens — bigger evidence windows, more
  evidence sources, more sites — the price moves with the scope.
  v0.1 is the limited-scope first engagement."
- "How is this different from [vendor name]?" → return to §2.
  Stay specific. Avoid the word "AI" unless they used it first.
- "Can we just buy a dashboard?" → "Not at Phase 1. The dashboard
  is a later-phase product and only ships after the review-pack
  evidence tells me what to put in it. Buying the review now is
  how you influence what shows up in the dashboard."

---

## 7. Tone discipline (Helen's notes to self)

- **Never say "AI" unless the customer says it first.** If they
  do, redirect to "this is founder-led judgment over structured
  evidence, not a black box."
- **Never quote a conversion-rate-lift number.** Ever. ROI sits
  on their side of the line.
- **Don't hide behind jargon.** "Buyer-motion shape" is fine; it
  has a clear definition in the pack. Don't invent new jargon
  during the call.
- **Read their stack from their site, not from a discovery
  questionnaire.** They notice when you've done the homework.
- **The win condition for this call is "they want the £1,250
  review," not "they sign a contract today."** v0.1 is a
  limited-scope first engagement on purpose. The wider scope and
  the dashboard product are downstream.
- **If they push for v0.2 features (dashboard, scores, identity),
  say so on the call.** They are not v0.1. Saying "yes, eventually"
  is fine; saying "yes, today" is a commercial-boundary
  violation.

---

## 8. Boundary statements (for Helen's own reference)

The demo does NOT promise:

- Identity resolution.
- Per-visitor automated scoring.
- A dashboard at Phase 1.
- A conversion-rate-lift figure.
- A GA4 / PostHog / Clarity replacement.
- Anything that would require AMS Product Layer scoring output
  to leave the AMS canonical chain (per the AMS PR#A1–PR#A7
  evidence chain — that path stays internal-only).

The demo DOES promise:

- A written, customer-readable Evidence Review.
- A one-hour walkthrough call.
- A clear what-we-can / what-we-cannot list.
- Three concrete next actions.
- £1,250 — service-led first engagement, not SaaS subscription
  pricing. No guarantee of specific buyer-motion, bot-like, or
  ROI findings.

---

**End of Sales Demo Script v0.1.**
