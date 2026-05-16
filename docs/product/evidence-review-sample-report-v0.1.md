# BuyerRecon Evidence Review — Sample Report v0.1

> **Note.** This is a customer-readable *sample* structure for the
> written deliverable Phase-1 customers receive. All numbers,
> domains, segment names, and findings below are
> **placeholders** and do not represent a real customer. Real
> reviews follow the same shape but with the customer's actual
> evidence.

---

**Prepared for:** *Sample Co. Ltd.* (`samplecompany.example`)
**Reviewed by:** Helen Chen, Keigen Technologies (UK) Limited.
**Period reviewed:** *Sample period — 4 weeks*.
**Engagement type:** BuyerRecon Phase-1 Evidence Review (£1,250).
**Date:** *YYYY-MM-DD*.

---

## 1. Executive summary

Three things the founder of *Sample Co.* should take away from the
review:

1. **Most of *Sample Co.*'s website traffic in the reviewed period
   shows weak buyer-motion evidence.** The volume looks reassuring
   on a GA4 dashboard, but the underlying session shapes do not
   match how a real evaluator moves. Roughly *X%* of sessions are
   plausible buyer-motion; the rest is noise of various flavours.
2. ***Sample Co.*'s paid traffic channel "[placeholder channel
   name]" is the most expensive source of noise.** It accounts
   for *Y%* of spend and produces buyer-motion shapes at *Z%* the
   rate of organic search.
3. **The evidence chain has a gap at form-fill.** *Sample Co.*
   captures form submissions but does not capture the
   pre-submission session shape, which means today *Sample Co.*
   cannot tell a real prospect from a competitor scraping its
   demo-request form.

Each finding is expanded below with the evidence used and the
explicit non-claims.

---

## 2. What we reviewed

| Evidence source | Coverage |
| --- | --- |
| GA4 channel + landing-page data | Full period |
| BuyerRecon collector (installed prior to review) | Last 14 days of period |
| PostHog event export | Last 7 days of period (customer-supplied) |
| HubSpot closed-loop sample | 12 closed-won + 12 closed-lost in the period |
| Customer-supplied bot-security WAF aggregate counts | Daily totals only |

What we deliberately did NOT use:

- Per-visitor identity resolution (no third-party visitor-ID
  vendor was queried).
- Session replays (PostHog had recordings but we did not watch
  them; the review reads structural evidence only).
- Any inference about people / companies not present in
  *Sample Co.*'s own systems.

---

## 3. Evidence quality snapshot

*Sample Co.*'s evidence chain for the reviewed period:

| Layer | Quality | Notes |
| --- | --- | --- |
| Page-view collection | Good | GA4 + collector agree on volume within 3%. |
| Session boundary | OK | GA4's session-cut behaviour is fine for this site. |
| UTM hygiene | Patchy | About *N%* of paid sessions have either no UTM or a malformed UTM. The review cannot fully attribute those. |
| Form-fill capture | Partial gap | Form submissions are captured; the *15 seconds before* the submission are not. |
| Consent state | Unknown | The consent banner records granted/declined but does not propagate that into the analytics layer. Review treats consent state as "unknown" for the period. |
| Bot / scraper traffic | Mostly filtered | The WAF blocks the obvious volume. Lower-volume residual remains (see §5). |

This snapshot is **descriptive**, not prescriptive — it tells
*Sample Co.* what they can confidently say about their evidence
today, not whether they should change tooling.

---

## 4. Buyer-motion observations

Plausible buyer-motion sessions for the period have the following
shapes (placeholder counts):

| Shape | Count | Comment |
| --- | --- | --- |
| Pricing → comparison → demo-request, ≤ 24h | *NN* | Strongest commercial-intent shape in the data. |
| Pricing → case-study → return-visit (within 7 days) | *NN* | Repeat-evaluator shape; commercially useful. |
| Documentation-deep → integration page | *NN* | Technical-evaluator shape; converts at a different rate. |
| Direct-to-pricing return visits | *NN* | Likely existing pipeline; check CRM cross-match. |

These shapes are **descriptive evidence patterns** that the review
identified by inspection of *Sample Co.*'s data. They are not
"scores", they are not "intent ratings", and they are not produced
by an automated classifier — Helen identified them by reading the
session-level evidence.

The review does NOT claim any of the *NN* sessions above are
individually convertible. It claims only that *as a class* they
look like real evaluators rather than noise.

---

## 5. Low-quality / bot-like / ambiguous traffic observations

For the same period, the review identified the following
**likely-noise** patterns (placeholder counts):

| Pattern | Count | Comment |
| --- | --- | --- |
| Single-page landing → bounce in < 2s, repeated UA | *NN* | Looks like a non-human spike from a scraper or a load test. |
| Sessions touching only `/robots.txt` or `/sitemap.xml`-style paths via "regular" landing-page tracking | *NN* | Likely misconfigured monitor / uptime probe leaking into analytics. |
| Sessions with no scroll, no click, no visibility-events, from a single ASN | *NN* | Either headless automation or a corporate proxy noise cluster. |
| Form-fills with implausible field-completion times | *NN* | Either a script or aggressive autofill — not a human evaluator. |

Two **important non-claims** about this section:

- The review does NOT classify *individual visitors* as bots. It
  describes *patterns of evidence* that match low-quality traffic
  in aggregate.
- The review does NOT make any IP / company / person claim about
  any of the sessions in the noise patterns. The patterns are
  structural, not identity-based.

---

## 6. Conversion-path evidence gaps

The review flagged three concrete gaps that are stopping *Sample
Co.* from answering "real buyer or noise" today:

1. **Pre-submission form context not captured.** The collector and
   GA4 both see the form submission event; neither sees the 15
   seconds before. Closing this gap (a small collector change)
   would let *Sample Co.* distinguish a deliberate fill from an
   autofill / paste-and-submit.
2. **UTM hygiene gap on paid traffic.** Roughly *N%* of paid
   landings carry no UTM or a malformed one. A small media-tagging
   convention would close this for under £0 capex.
3. **No closed-loop signal back from CRM to website evidence.**
   *Sample Co.* knows which 12 prospects converted, but the
   conversion event is not attached to a session-level evidence
   chain. Without that, retroactive validation of any signal is
   approximate.

---

## 7. What we CAN verify with today's evidence

- That the reviewed period contained measurable buyer-motion shapes
  (§4) AND measurable noise shapes (§5).
- That *Sample Co.*'s paid traffic produces buyer-motion shapes at
  a meaningfully lower rate than organic and direct.
- That four of the 12 closed-won prospects in the sample CRM data
  produced one of the four buyer-motion shapes in §4 in the period
  immediately before conversion. (Sample size is too small to
  generalise the ratio; the directional signal is real.)
- That residual bot/scraper traffic is small relative to organic
  volume but non-zero, and the WAF aggregate totals corroborate
  this.

---

## 8. What we CANNOT verify with today's evidence

- We cannot say which **specific individual visitor** was a real
  buyer.
- We cannot attribute any specific anonymous session to a specific
  company.
- We cannot promise that closing the gaps in §6 will lift
  conversion by a specific %. (We can only say which gap, if
  closed, would let us answer specific commercial questions.)
- We cannot, today, tell *Sample Co.* whether the four uncategorised
  closed-won prospects in the sample CRM data did NOT match a
  buyer-motion shape because they really did follow a different
  path, or because *Sample Co.*'s evidence chain didn't capture
  the path they followed.

---

## 9. Recommended next steps

Three, in order of estimated ROI vs. effort:

1. **Close the pre-submission form gap** — small collector / event
   change. Lets *Sample Co.* answer a question it currently
   cannot. Estimated effort: low. Recommended.
2. **Tighten UTM hygiene on paid spend** — pure ops, no code.
   Removes the largest single attribution noise factor in §3.
   Estimated effort: low. Recommended.
3. **Attach closed-loop conversion to session evidence** — small
   integration between *Sample Co.*'s CRM and the collector.
   Unblocks retroactive validation of every later finding.
   Estimated effort: medium. Recommended once #1 and #2 are
   done.

---

## 10. Appendix: evidence definitions

The terms used in this review are intentionally narrow and
descriptive:

- **Session** — a single visit, in *Sample Co.*'s own
  GA4/collector session boundary. Not a "user".
- **Buyer-motion shape** — a structural pattern of pages visited,
  ordering, dwell, and return-visit behaviour that resembles how
  evaluators behave on B2B sites in general. Descriptive only.
- **Noise shape** — a structural pattern that does NOT resemble
  human evaluator behaviour (no scroll, no visibility events,
  implausible timing, single repeated path, etc.). Structural,
  not identity-based.
- **Evidence gap** — a question *Sample Co.* asked during the
  engagement that cannot be answered with the evidence captured
  today.

---

## 11. Boundary statements

The review is service-led, founder-reviewed, and customer-readable.
It does not produce automated scores, does not surface AMS Product
Layer output, does not modify *Sample Co.*'s production systems,
and does not introduce any new dashboard, API, or webhook.

---

**End of sample Evidence Review (v0.1 structure).**
