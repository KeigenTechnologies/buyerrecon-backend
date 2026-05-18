# BuyerRecon Sprint 2 PR#17a — Production Cutover and Output-Gate Architecture Planning

Status: planning / docs-only. No implementation. No code change. No deployment. No migration.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: 61d1ac5 — PR#15b Hetzner staging proof closure, including PR#15a Evidence Review Snapshot observer, PR#16a Lane A/B contract planning, PR#16b Lane A/B preview observer, and the PR#14a–14f ProductFeatures / AMS bridge candidate work).

PR branch: `buyerrecon-sprint2-pr17a-production-cutover-output-gates-planning`

---

## 1. Purpose

PR#17a plans how to connect the current Render production reality to the Sprint 2 canonical backend without:

- silently abandoning the existing production collector that five live ThinLayer sites already post to, and
- over-promoting internal Lane A/B preview into customer-facing automated output before output-gate architecture (Pass 1 / Trust / Pass 2) is built.

It is a planning bridge between:

- the *capture* reality that already exists in Render (legacy thin-v2.0 collector, legacy schema, legacy `accepted_events` rows, no `workspace_id` column), and
- the *canonical evidence* pipeline that Sprint 2 has been building on the `buyerrecon-backend` Sprint 2 branch and validating on Hetzner staging.

PR#17a does **not** decide deployment. It does not deploy. It does not migrate. It produces one docs file that:

1. records the two realities,
2. names Sprint 2 schema as the canonical future schema,
3. describes the production target architecture for a new Sprint 2 production collector,
4. describes the full canonical evidence pipeline including the future output governance layer,
5. distinguishes timing-window observation from buyer-intent action,
6. separates *evidence-confidence / claim-confidence* from *AMS Shared Core Trust scoring output*,
7. describes Pass 1 / Trust / Pass 2 customer-safe output gates,
8. proposes a site-by-site phased cutover beginning with `buyerrecon.com`,
9. defines rollback, production-readiness checklist, and stop-the-line conditions,
10. lists what PR#17a explicitly does **not** approve.

Everything beyond this docs file is deferred to later PRs.

---

## 2. Current production reality

The following is current live state, not aspiration:

- Five live sites already have **ThinLayer** installed:
  - `buyerrecon.com`
  - `realbuyergrowth.com`
  - `timetopoint.com`
  - `fidcern.com`
  - `keigen.co.uk`
- ThinLayer on `buyerrecon.com` (and the others) currently posts to the Render legacy collector endpoint:
  - `https://buyerrecon-backend.onrender.com/collect`
- Render hosts two production resources:
  - `buyerrecon-backend` service (legacy collector)
  - `buyerrecon-db` Postgres (legacy schema)
- The Render production DB uses a **legacy schema**. The `accepted_events` table has columns such as:
  - `event_id`
  - `site_id`
  - `hostname`
  - `event_type`
  - `session_id`
  - `browser_id`
  - `client_timestamp_ms`
  - `received_at`
  - `raw jsonb`
  - `collector_version`
  - `event_contract_version`
  - `client_event_id`
  - `page_view_id`
  - `previous_page_view_id`
  - `event_sequence_index`
- Render production `accepted_events` does **not** have `workspace_id`.
- Render production currently records `legacy-thin-v2.0` events.
- Render production is live and receives real ThinLayer traffic right now. It must not be casually replaced, paused, or "cleaned up".
- Track A Gate 1 `B_analytics_only` production run already proved:
  - production `buyerrecon.com` receives **unlabelled programmatic** browser traffic,
  - rows appeared in Render `accepted_events` keyed as `buyerrecon_com` / `buyerrecon.com`,
  - event types included `session_start` and `session_summary`,
  - `collector_version = 1.0.0`,
  - `event_contract_version = legacy-thin-v2.0`,
  - **no** QA/test/bot/synthetic/adversary label leakage,
  - **no** old Track A UA marker leakage,
  - **no** form submit,
  - LinkedIn did not fire under analytics-only consent.
- That production evidence proves the Render collector ingests real traffic. It does **not** enter the Sprint 2 canonical schema; it lacks the Sprint 2 ledger and feature/observation chain.

Implication: Render is the **current archive of production capture**, and Sprint 2 is the **canonical future**. They must coexist during cutover.

---

## 3. Current Sprint 2 backend reality

On the `buyerrecon-backend` Sprint 2 branch the canonical pipeline already exists in code:

- `ingest_requests`
- `accepted_events` / `rejected_events` (Sprint 2 shape)
- `session_features`
- `session_behavioural_features`
- refresh-loop / repeated-pageview derivation
- Stage 0 record-only decisions
- risk observations
- POI observations
- POI sequence observations
- product-context fit observations
- timing-window observations
- ProductFeatures candidate observations (PR#14a–14f)
- AMS ProductFeatures bridge candidate observer (record-only, no AMS runtime call)
- Evidence Review Snapshot observer (PR#15a, PR#15b Hetzner proof)
- Lane A / Lane B preview observer (PR#16a contract, PR#16b read-only observer)

Hetzner staging has been used as the proof environment for these observers (PR#11d, PR#15b, etc.). Evidence Snapshot and Lane A/B preview are **internal review tools**, not customer-facing outputs.

The Hetzner staging DB is **not** the current production DB. Render production DB and Hetzner Sprint 2 DB are not the same schema. Sprint 2 DB is **not yet** the production DB; it is staging.

Implication: Sprint 2 is *ready* in code, but it is not yet *live*. Production cutover requires a new production-grade Sprint 2 deployment — not reuse of the staging DB.

---

## 4. Canonical future schema decision

PR#17a records the following architectural decision:

- The **Sprint 2 schema is the canonical future schema** for BuyerRecon evidence (ledger → features → observations → internal Evidence Review → future output gates).
- The **Render legacy schema is the current production archive / rollback reference**. It is preserved as-is.
- New Lane A/B / Pass 1 / Trust / Pass 2 / future output governance work must **not** be layered on top of the Render legacy schema. It belongs on the Sprint 2 canonical schema.
- **Do not force-migrate** historical Render data into Sprint 2 now. Render rows lack `workspace_id`, `ingest_requests`, Stage 0 decisions, features, and observation chain. Migrating them would create false evidence-equivalence.
- Future new production traffic should enter the Sprint 2 production schema once a Sprint 2 production collector exists.
- Render is therefore frozen-in-place during cutover, not extended, not deleted.

This decision means BuyerRecon has two timelines from PR#17a onwards:

- *Historical capture* — Render legacy, retained read-only as archive.
- *Canonical capture* — Sprint 2 production collector, forward-only.

---

## 5. Production target architecture

The intended production target (planning only):

- A **new production collector endpoint** for Sprint 2, e.g.:
  - `https://collector.buyerrecon.com/collect`
  - DNS may differ at execution time; the key property is that it is not the Render legacy host.
- A **Sprint 2 production buyerrecon-backend service**, likely on Hetzner (separate from `buyerrecon_staging`).
- **Production DB / roles / workspaces separate from staging**:
  - production Postgres DB (e.g. `buyerrecon_production`) distinct from `buyerrecon_staging`,
  - production application role with least-privilege grants,
  - workspace and site rows for the five live sites,
  - production-only secrets, never reused from staging.
- **`site_write_tokens` / site auth / workspace/site boundaries**:
  - each live site issued its own write token,
  - tokens scoped per workspace/site,
  - token rotation plan (not implemented in PR#17a),
  - the collector validates token → workspace/site → record into `ingest_requests`.
- **Edge / transport**:
  - Nginx (or equivalent) reverse proxy in front of the Sprint 2 collector,
  - Cloudflare in front for DNS / TLS / basic rate-limit (subject to PR#17b),
  - production TLS certificates, not staging,
  - structured request logging,
  - health endpoint (e.g. `/healthz`) wired to monitoring,
  - rollback DNS / endpoint path retained.
- **Render legacy endpoint retained during cutover**:
  - `https://buyerrecon-backend.onrender.com/collect` stays available,
  - ThinLayer endpoint URL is the cutover lever,
  - if Sprint 2 collector fails, ThinLayer reverts to Render.

PR#17a does not deploy, configure, or rotate any of this. PR#17b (proposed) is the deployment planning PR.

---

## 6. Canonical evidence pipeline

The full canonical chain that the Sprint 2 production deployment must support. It explicitly includes the future output governance layer; it is not omitted.

### 6.1 Capture / ledger

- **ThinSDK / site event** — fired from the live site, posted to the Sprint 2 collector.
- **Sprint 2 collector** — accepts, authenticates, records.
- **`ingest_requests`** — append-only ledger of every incoming request (accepted or rejected).
- **`accepted_events` / `rejected_events`** — Sprint 2 schema rows, including `workspace_id`, contract version, sequencing.

### 6.2 Feature extraction

- **`session_features`** — per-session features.
- **`session_behavioural_features`** — behavioural-only features derived without identity.
- **Refresh-loop / repeated-pageview derivation** — surfaces repeated/short-cycle navigation patterns.
- **Stage 0 record-only decisions** — recorded; never wired to customer-facing action.

### 6.3 Observation layer

- **Risk observations** — record-only risk signals.
- **POI observations** — points of interest derived from features.
- **POI sequence observations** — ordered POI patterns.
- **Product-context fit observations** — fit between observed behaviour and product context.
- **Timing-window observations** — recent / warm / stale / too thin / ambiguous (see §7).
- **ProductFeatures candidate observations** — AMS-namespace candidate (record-only; no AMS runtime call).

### 6.4 Internal Evidence Review layer

- **Evidence Review Snapshot** — internal review surface, PR#15a/15b.
- **Lane A preview** — internal lane A view (PR#16a/16b).
- **Lane B preview** — internal lane B view (PR#16a/16b), may consume buyer-motion / product-context / timing hypotheses; remains internal.

### 6.5 Future output governance layer

This is the boundary where internal evidence becomes (or does not become) customer-facing output.

- **Pass 1** — observation eligibility filtering (see §9).
- **Trust layer** — *two distinct concepts* (see §8): claim-confidence and AMS Shared Core Trust output.
- **Pass 2** — customer-safe projection: wording, suppression, downgrade, bounded language.
- **Customer-safe Evidence Review output** — only after Pass 1 / Trust / Pass 2 are implemented and proved.

PR#17a does not implement any of §6.5. PR#17a only requires that the production cutover plan **leaves room** for §6.5 and does not bypass it.

---

## 7. Timing-window placement

Timing window is an **observation-layer** concept, not an output-layer concept.

- It answers: did the observed behaviour happen in a commercially meaningful time window?
  - `recent` — close enough to be operationally interesting,
  - `warm` — still in-window but cooling,
  - `stale` — past window,
  - `too_thin` — not enough evidence to place a window,
  - `ambiguous` — window-edge or conflicting signals.
- It may feed Lane B's internal hypotheses about buyer-motion, product-context fit, and timing.
- It must **not** be directly published as:
  - a buyer-intent score,
  - a sales action recommendation,
  - a customer-facing "this lead is hot now" claim,
  - any automated downstream trigger.
- Timing window may inform downstream output **only via Pass 1 / Trust / Pass 2**.

The Render legacy stream has no timing-window observations. That is one of several reasons Render data cannot be treated as Sprint 2 canonical evidence.

---

## 8. Trust layer distinction

PR#17a defines two trust concepts and prohibits collapsing them into a single field.

### 8.1 Evidence-confidence / claim-confidence

- Belongs to **Evidence Review Snapshot** and **Lane A/B preview**.
- Decides how safe a given internal statement is to display in the internal review tool.
- Covers:
  - evidence completeness (do we have features, observations, sequence?),
  - provenance quality (ingest_requests intact, no schema drift),
  - freshness (is the observation old?),
  - consent / privacy gaps (analytics-only vs full consent),
  - source coverage (single page vs multi-page session vs cross-session),
  - timing-window sufficiency (is the window placement reliable?),
  - whether a claim must be **downgraded to "cannot verify yet"** rather than asserted.
- Claim-confidence is **internal**. It is allowed inside Evidence Review / Lane A/B preview.

### 8.2 AMS Shared Core Trust scoring output

- Belongs to **AMS Trust Core / shared-core** scoring output, not BuyerRecon Evidence Review.
- Includes:
  - Trust Core algorithm outputs,
  - trust state,
  - trust decay,
  - trust-related score outputs,
  - `TrustOutput` and the act of scoring,
  - shared-core score envelope.
- This is **future-gated**. It must not be exposed through the BuyerRecon production cutover until a later PR:
  1. implements the AMS runtime bridge,
  2. runs dry-run proof,
  3. wires Pass 1 / Pass 2 governance,
  4. produces a customer-safe projection.
- The PR#14 ProductFeatures bridge candidate observer is **record-only**; it does not call AMS runtime and does not emit Trust Core output.

Cutover may use §8.1 internally. Cutover must **not** expose §8.2.

---

## 9. Pass 1 / Trust / Pass 2 output gates

The future output governance layer has three stages. PR#17a defines them, does not implement them.

### 9.1 Pass 1 — eligibility filtering

Decides which observations are eligible for output consideration. Examples of Pass 1 filters:

- evidence-completeness threshold met,
- timing-window placement is not `too_thin` / `ambiguous` when the candidate output depends on timing,
- consent context allows the claim,
- workspace/site policy allows the claim,
- no rejected-events drift on the underlying session,
- the candidate is not derived from a single ambiguous datapoint.

Pass 1 outputs a *candidate* set; Pass 1 alone does not authorise customer-facing publication.

### 9.2 Trust — claim-confidence + future shared-core Trust output

- Within Pass 1→Pass 2, the BuyerRecon-internal **claim-confidence** decides whether a claim should be asserted, softened, or withheld.
- The **AMS Shared Core Trust output** is a *separate* future-gated path. It is not allowed to leak into BuyerRecon customer-facing automated output during cutover.
- Trust-as-decay and Trust-Core-as-scoring belong to the AMS shared-core surface, not to PR#17a cutover.

### 9.3 Pass 2 — customer-safe projection

Pass 2 performs the customer-safe transformation:

- bounded language (no false certainty),
- suppression (don't show what isn't earned),
- downgrade (assert weaker form instead of stronger),
- wording rules (no PII, no identity leakage, no QA/test/bot/synthetic labels, no Track A markers),
- final formatting for human consumption.

### 9.4 Implication for cutover

- Customer-facing automated reports and customer-facing automated actions must wait for Pass 1 / Trust / Pass 2.
- Production cutover **may** allow internal Evidence Review / Lane A/B preview against the new Sprint 2 collector.
- Production cutover **must not** enable customer-facing automated output before Pass 1 / Trust / Pass 2.

---

## 10. Render legacy data posture

- **Retain** Render legacy data as **historical archive / rollback reference**.
- **No forced migration now.** Migrating Render legacy rows into the Sprint 2 canonical schema would falsely imply Sprint 2 ledger / feature / observation provenance that does not exist.
- An optional future **legacy adapter / report** path may be planned later if a specific historical question is worth answering; that adapter is out of scope for PR#17a.
- Render legacy data **cannot be treated as full Sprint 2 canonical evidence**, because it lacks:
  - `workspace_id`,
  - `ingest_requests` ledger,
  - Stage 0 decisions,
  - `session_features` / `session_behavioural_features`,
  - refresh-loop / repeated-pageview derivation,
  - the observation chain (risk, POI, POI sequence, product-context fit, timing-window, ProductFeatures candidate),
  - Evidence Review Snapshot and Lane A/B preview compatible shape.
- Render production remains untouched until cutover is complete and observed.

---

## 11. Site-by-site cutover plan

Phased cutover. Order is deliberate.

1. **Keep Render untouched.** Do not pause, drop, or "tidy" the Render service or DB. It remains the live capture path and rollback target.
2. **Deploy the Sprint 2 production collector endpoint** (planned in PR#17b). Production DB/roles/workspaces/tokens (planned in PR#17c). The Sprint 2 collector is reachable but not yet receiving live ThinLayer traffic.
3. **Cut `buyerrecon.com` first** (planned in PR#17d). ThinLayer endpoint URL on `buyerrecon.com` switches from the Render legacy endpoint to the Sprint 2 production collector endpoint. No other sites yet.
4. **Prove normal smoke** on `buyerrecon.com`: real organic traffic enters `ingest_requests` / `accepted_events`, no schema-drift rejects, no log errors.
5. **Prove Track A unlabelled `B_analytics_only`** against the Sprint 2 production (or canary) collector (planned in PR#17e). No QA/test/bot/synthetic labels in telemetry. No form submit.
6. **Run Evidence Snapshot / Lane A/B preview** against the new Sprint 2 production data for `buyerrecon.com`. Confirm observers behave as on Hetzner staging.
7. **Only then** cut the remaining sites, one at a time, in this order:
   - `realbuyergrowth.com`
   - `timetopoint.com`
   - `fidcern.com`
   - `keigen.co.uk`

For **each site** the per-site checklist is:

- ThinLayer `endpointUrl` update from Render legacy to Sprint 2 production collector,
- per-site `site_write_token` and workspace/site config provisioned and verified,
- smoke test: real traffic appears in `ingest_requests` / `accepted_events`,
- observer proof: Stage 0, features, risk/POI/POI-sequence/product-context/timing-window/ProductFeatures candidate observations populate as expected,
- Evidence Snapshot / Lane A/B preview behave as expected,
- rollback check: ThinLayer can revert to Render legacy endpoint without code change to the site.

No batch cutover. No "do all five at once".

---

## 12. Track A production/staging testing path

Track A is the unlabelled behavioural-testing repo at `/Users/admin/github/ams-qa-behaviour-tests`. It already passed 130/130 local-mode tests with no live HTTP and no GA4 leakage, and ran Gate 1 `B_analytics_only` against Render production with no label leakage.

Rules:

- Track A is **unlabelled programmatic behaviour testing**.
- Labels (`B_analytics_only`, low-dwell, refresh-loop, adversarial CTA, etc.) live in **Helen's private run log only**.
- Labels **must never** enter:
  - URL,
  - UTM,
  - dataLayer,
  - cookies,
  - storage,
  - backend payload,
  - GA4,
  - Lane A/B rendered output.
- The first Track A test against the new Sprint 2 collector must be `B_analytics_only`.
- Later Track A tests (low-dwell, refresh-loop, adversarial CTA) only after earlier gates pass and the Sprint 2 production / canary collector is stable.
- Track A should target the **Sprint 2 collector** (staging first, then canary, then production) once the Sprint 2 endpoint exists.
- The Render legacy Track A run is useful only as proof of *current collector ingestion*. It is **not** a proof of Lane A/B canonical evidence, because Render legacy data does not enter the Sprint 2 canonical chain.

---

## 13. Rollback plan

- Keep the Render endpoint `https://buyerrecon-backend.onrender.com/collect` **available** during and immediately after cutover.
- Rollback lever is **ThinLayer `endpointUrl`** (and/or DNS), not backend code:
  - if cutover misbehaves, switch the affected site's ThinLayer endpoint back to the Render legacy endpoint,
  - confirm Render is again receiving rows in `accepted_events`,
  - mark the Sprint 2 attempt as paused for that site.
- **DB rollback is not required for legacy data.** Render legacy and Sprint 2 canonical are *separate streams*; nothing was overwritten or migrated. Rolling back the endpoint is sufficient to restore prior behaviour.
- If the Sprint 2 collector rejects or loses events on any site, **revert that site's endpoint immediately** and pause further cutover.
- After any rollback, produce an **evidence gap report**:
  - which sites were rolled back,
  - when,
  - what symptoms triggered rollback,
  - what fraction of traffic was on which collector during the affected window,
  - what is in the Sprint 2 canonical schema vs what is in Render legacy schema for that window,
  - what (if anything) must be re-ingested or re-derived (planning only; no automatic re-ingestion).

Rollback must be testable before broad cutover.

---

## 14. Production readiness checklist

Before *any* live site is cut from Render legacy to the Sprint 2 production collector, the following must be true:

- **Production DB created and separated from staging**
  - Sprint 2 production Postgres exists,
  - distinct DB name, host/role/credentials,
  - **not** `buyerrecon_staging`,
  - production credentials never reused from staging,
  - production credentials never in repo or chat.
- **Migrations applied**
  - Sprint 2 canonical schema applied to the production DB,
  - `ingest_requests`, `accepted_events`, `rejected_events`, `session_features`, `session_behavioural_features`, observation tables, Stage 0 tables, ProductFeatures candidate tables, Evidence Snapshot tables, Lane A/B preview tables — all present.
- **Roles configured**
  - dedicated application role with least-privilege grants,
  - distinct read-only role for Evidence Snapshot / Lane A/B preview readers,
  - no shared superuser usage from the app process.
- **`site_write_tokens` created**
  - one token per live site,
  - tokens stored as secrets, never in repo,
  - workspace/site mapping verified for each token.
- **Health endpoint works**
  - `/healthz` (or equivalent) returns expected response,
  - wired into monitoring / alerting.
- **Collector endpoint TLS works**
  - production cert valid for the chosen collector hostname,
  - no mixed-content from ThinLayer when posting.
- **Logs observable**
  - structured logs on accept / reject / auth-fail,
  - retention policy known,
  - no PII / no Track A labels in logs.
- **Ledger verified**
  - `ingest_requests` rows appear on real traffic,
  - `accepted_events` and `rejected_events` populate correctly,
  - sequencing fields populate.
- **Feature extractor works**
  - `session_features` / `session_behavioural_features` populate on the production stream,
  - refresh-loop / repeated-pageview derivation runs.
- **Stage 0 works**
  - Stage 0 decisions record on production stream,
  - decisions remain record-only.
- **Evidence Snapshot works**
  - Evidence Review Snapshot produces expected shape against production data on `buyerrecon.com`.
- **Lane A/B preview works**
  - read-only Lane A/B preview observer behaves on production data the way it behaves on Hetzner staging.
- **Forbidden output scans pass**
  - no QA/test/bot/synthetic labels in telemetry,
  - no Track A markers in telemetry,
  - no PII leakage,
  - no AMS Trust Core output exposed.
- **Rollback tested**
  - ThinLayer endpoint can be reverted from Sprint 2 production back to Render legacy without site code change,
  - reverted traffic appears in Render `accepted_events` again,
  - cutover runbook documents the rollback step.

If any item above is unchecked, do not cut.

---

## 15. What is explicitly not approved by PR#17a

PR#17a explicitly does **not** approve any of the following:

- direct production cutover of any live site,
- any DB migration of any production DB,
- migration of historical Render legacy data into the Sprint 2 canonical schema,
- customer-facing automated scores,
- durable Lane A/B writers (Lane A/B remains read-only preview),
- an AMS runtime bridge (PR#14 remains record-only candidate observer),
- exposure of AMS Trust Core output through BuyerRecon,
- implementation of Pass 1 / Pass 2 / Trust output gates,
- broad Track A production bot traffic (only narrow gated tests once a Sprint 2 endpoint exists, per §12),
- deletion or shutdown of the Render legacy backend or Render legacy DB,
- promoting the Hetzner staging DB to act as the production DB,
- sharing production credentials in repo or chat,
- collapsing claim-confidence and AMS Trust Core output into a single "trust" field.

These remain for future PRs.

---

## 16. Recommended next PRs

PR#17a recommends the following follow-up PRs, each scoped tightly:

- **PR#17b — Sprint 2 production collector deployment planning**
  - host (Hetzner production), Nginx/Cloudflare/TLS, health endpoint, logging, monitoring, rollback hooks. Planning only.
- **PR#17c — Production DB / role / token plan**
  - production Postgres provisioning plan, distinct role grants, `site_write_tokens` provisioning plan, secrets handling. Planning only.
- **PR#17d — `buyerrecon.com` canary endpoint cutover plan**
  - per-site cutover runbook for the first site only, including smoke and rollback. Planning only.
- **PR#17e — Track A unlabelled staging/canary proof**
  - the first Track A `B_analytics_only` run against the Sprint 2 staging/canary collector, no label leakage. Planning + (later) execution under existing Track A discipline.
- **Later (separate PR sequences):**
  - Pass 1 eligibility planning,
  - AMS Shared Core Trust bridge planning (Trust Core output remains future-gated),
  - Pass 2 customer-safe projection planning,
  - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

---

## 17. Acceptance criteria

PR#17a is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17a-production-cutover-output-gates-planning.md`,
- it accurately describes the Render legacy vs Sprint 2 canonical split,
- it includes the **timing-window** observation layer and locates it correctly (observation, not output),
- it separates **evidence-confidence / claim-confidence** from **AMS Shared Core Trust scoring output**,
- it defines **Pass 1 / Trust / Pass 2** as the customer-safe output governance layer,
- it includes a **site-by-site cutover plan** beginning with `buyerrecon.com` and a **rollback plan**,
- it contains **no implementation** — no code change, no schema change, no migration, no script, no test change, no deploy, no production touch.

---

## 18. Stop-the-line conditions

Stop and re-plan if any of the following appears:

- anyone proposes a **direct all-site cutover** instead of the phased, site-by-site plan,
- anyone proposes **migrating Render legacy data** into the Sprint 2 canonical schema without an adapter planning PR,
- **Track A labels** (QA/test/bot/synthetic/adversary, B_analytics_only, low-dwell, refresh-loop, adversarial CTA, etc.) appear in URL, UTM, dataLayer, cookies, storage, backend payload, GA4, or Lane A/B rendered output,
- **customer-facing automated output** is enabled before Pass 1 / Trust / Pass 2 are implemented and proved,
- an **AMS runtime bridge** is proposed as part of cutover (PR#14 stays record-only candidate observer),
- **production DB secrets** enter the repo or chat,
- **staging and production DBs are confused** (e.g. reuse of `buyerrecon_staging` for live ThinLayer traffic),
- the **rollback path is missing or untested** for any site about to be cut,
- anyone proposes **deleting the Render legacy backend or DB** before cutover is complete and observed,
- anyone collapses **claim-confidence and AMS Trust Core output** into a single field.

Stop-the-line means: do not cut, do not deploy, do not migrate. Return to planning.

---

End of PR#17a planning. Docs only.
