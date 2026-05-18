# BuyerRecon Sprint 2 PR#17d — buyerrecon.com Canary Endpoint Cutover Runbook

Status: planning / docs-only. **Future runbook for the first-site canary only.** No implementation. No deployment. No DNS change. No ThinLayer `endpointUrl` change. No production traffic. No Track A execution. No DB connection. No secret creation or rotation. No migration execution. No Render touch. No Hetzner touch.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `0713037` — PR#17c merged, "plan production DB roles tokens").

PR branch: `buyerrecon-sprint2-pr17d-buyerrecon-com-canary-cutover-runbook`

---

## 1. Purpose

PR#17d plans the **future** `buyerrecon.com` first-site canary endpoint cutover runbook — the documented procedure that will be followed (when, and only when, all upstream prerequisites are approved) to move `buyerrecon.com` ThinLayer traffic from the Render legacy collector to the Sprint 2 production collector.

It does **not**:

- perform the cutover,
- approve the cutover for execution,
- change DNS,
- change any ThinLayer `endpointUrl` on any live site,
- deploy any service,
- create or modify any DB / role / token,
- generate or test production traffic,
- run Track A in any environment,
- enable any customer-facing automated output.

PR#17d is the *written runbook* that a later operator PR will reference when execution is finally authorised. Execution authorisation comes from later, explicitly-scoped PRs and from production-readiness proof — not from PR#17d.

Anything in PR#17d that resembles an instruction is a **planned step**, not an action.

---

## 2. Inputs from PR#17a / PR#17b / PR#17c

PR#17a, PR#17b, and PR#17c are merged and govern PR#17d:

- **Render legacy remains fallback / archive.** `https://buyerrecon-backend.onrender.com/collect` and the legacy Render Postgres remain live, untouched, and available as rollback. Render legacy data is not force-migrated. (PR#17a §2, §4, §10.)
- **Sprint 2 schema is the canonical future** for BuyerRecon evidence (ledger → features → observations → internal Evidence Review → future output gates). (PR#17a §4.)
- **A new production collector endpoint is planned** but not deployed (e.g. placeholder `collector.buyerrecon.com`, `/collect` plus `/healthz`, production TLS, distinct from Render legacy and Hetzner staging). (PR#17b §4, §5, §8, §9.)
- **Production DB / roles / workspaces / `site_write_tokens` must be separate from staging** and separate from Render legacy at name, host, credentials, role grants, workspace/site rows, and token level. The Hetzner staging DB is not promoted. The Render legacy DB is not treated as Sprint 2 canonical. (PR#17b §6; PR#17c §4, §6, §8, §9, §11, §12.)
- **`buyerrecon.com` is the first canary site.** The remaining live sites (`realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk`) are cut later, one at a time, only after `buyerrecon.com` proves out. (PR#17a §11; PR#17b §10; PR#17c §8.)
- **Track A labels remain private run-log only** and never appear in URL, UTM, dataLayer, cookies, storage, backend payload, GA4, Lane A/B rendered output, logs, reports, or tokens. (PR#17a §12; PR#17b §13; PR#17c §14.)
- **Customer-facing automated output remains gated by Pass 1 / Trust / Pass 2.** Internal Evidence Snapshot and Lane A/B preview are allowed against the production stream; customer-facing automated reports/actions are not. (PR#17a §6.5, §8, §9; PR#17b §17; PR#17c §15.)
- **Two trust concepts remain separated.** Internal claim-confidence is distinct from AMS Shared Core Trust output; Trust Core remains future-gated. (PR#17a §8.)

PR#17d inherits these constraints and does not relax any of them.

---

## 3. Non-goals

PR#17d explicitly does **not** approve and does **not** perform any of the following:

- endpoint cutover now (no `buyerrecon.com` `endpointUrl` change),
- DNS change (no `collector.buyerrecon.com` record creation, no CNAME, no zone edit),
- ThinLayer `endpointUrl` change on any live site,
- production deployment of the Sprint 2 collector,
- creation of the Sprint 2 production DB,
- creation of any DB role,
- creation, hashing, or rotation of any `site_write_token`,
- rotation of any existing secret,
- execution of any migration against any DB,
- shutdown, downgrade, or modification of the Render legacy collector or Render legacy DB,
- Track A production execution (broad or narrow),
- enabling customer-facing automated output (reports, actions, scores),
- introduction of durable Lane A/B writers,
- introduction of an AMS runtime bridge,
- exposure of AMS Trust Core output through BuyerRecon.

PR#17d is a description of the **future** runbook. Nothing in this document is executable.

---

## 4. Canary scope

- **Site in scope: `buyerrecon.com` only.**
- **Sites explicitly out of scope:**
  - `realbuyergrowth.com`
  - `timetopoint.com`
  - `fidcern.com`
  - `keigen.co.uk`
- **Narrowest safe traffic path first.** The canary begins with normal organic `buyerrecon.com` traffic as it exists today, posting to the (future) Sprint 2 production collector via the approved ThinLayer endpoint change. No broadened scope, no additional sites, no synthetic broad-traffic generation as part of the first canary.
- **No batch / all-site cutover.** Under no circumstances does this runbook authorise cutting multiple sites at once. Each subsequent site has its own later cutover runbook.
- **Runbook is future-only until prerequisites are met.** This document defines *what would happen*. Execution is gated on §5.

---

## 5. Required prerequisites before execution

The runbook may be executed **only** when every prerequisite below is satisfied. PR#17d does not satisfy any of these; it merely lists them.

- **PR#17d merged as planning.** This document exists in the canonical Sprint 2 branch history.
- **Production host approved and deployed** by a later approved operator PR (the deployment of the Sprint 2 production collector service, per PR#17b §5).
- **Production DB created** by a later approved operator PR (the production DB provisioning, per PR#17c §4).
- **Migrations applied** to the production DB by a later approved migration / operator PR (per PR#17c §5; "PR#17f or later").
- **Production roles created** by a later approved operator PR, with least-privilege grants (per PR#17c §6, §7).
- **`buyerrecon.com` production workspace/site mapping created and verified** by a later approved operator PR (per PR#17c §8).
- **`buyerrecon.com` production `site_write_token` created and stored outside repo/chat** by a later approved operator PR (per PR#17c §9, §10). The raw token lives only in the approved secret manager.
- **`collector.buyerrecon.com`** (or the equivalent approved hostname) **live with production TLS** (per PR#17b §4, §8).
- **Health endpoint proof completed.** A documented `/healthz` (or equivalent) proof recorded against the production collector.
- **Rollback path to Render legacy confirmed.** ThinLayer `endpointUrl` reversion to `https://buyerrecon-backend.onrender.com/collect` documented and pre-staged; Render legacy collector and DB confirmed reachable and accepting.
- **Forbidden-output / secrets scan plan ready.** Automated scan plan exists for logs, observability surfaces, and produced artefacts, covering QA/test/bot/synthetic/adversary labels, Track A markers, raw tokens / token prefixes / token hashes, DB URLs, AMS Trust Core leakage, and PII leakage.
- **Operator approval recorded.** The execution PR records who approved cutover, when, and against which prerequisite state.

**If any prerequisite is missing, do not execute the cutover.** Open the missing prerequisite first, satisfy it in its own PR, then re-enter this runbook.

---

## 6. Current-state snapshot before cutover

Planned future pre-cutover snapshot — **categories only, no executable commands, no secrets, no raw token, no DB URL**:

- `buyerrecon.com` ThinLayer `endpointUrl` currently points to the Render legacy collector (`https://buyerrecon-backend.onrender.com/collect`).
- The Render legacy collector is reachable: a `/healthz`-equivalent (or HTTP probe at the documented level) returns the known-good response, with timestamp captured.
- The Render legacy `accepted_events` is still receiving normal `buyerrecon.com` production traffic (row counts and freshness recorded categorically — no row contents copied into the snapshot).
- Current `buyerrecon.com` site config is known and recorded (which ThinLayer release is in place, which deploy/build hash of the site is live, which `endpointUrl` value is configured), without exposing any secret or credential.
- No Track A labels are present in `buyerrecon.com` telemetry (verified by the §11 / §13 / §17 scans applied to a recent representative window).
- No customer-facing automated output is enabled.
- Rollback endpoint (Render legacy) is confirmed reachable and confirmed to be the target of `endpointUrl` reversion if rollback fires.
- The snapshot is stored as a recorded artefact, distinct from this docs file, in the future execution PR.

---

## 7. Target-state snapshot after cutover

Planned future expected post-cutover state, captured as a recorded artefact in the future execution PR:

- `buyerrecon.com` ThinLayer `endpointUrl` points to the Sprint 2 production collector endpoint (e.g. `https://collector.buyerrecon.com/collect`, exact hostname per approved deployment).
- The Sprint 2 production collector is observed receiving `buyerrecon.com` traffic (no traffic stalled, no DNS resolution failure, no TLS error).
- `ingest_requests` records every incoming request from `buyerrecon.com` for the canary window (accepted or rejected).
- `accepted_events` / `rejected_events` populate Sprint 2 schema rows including `workspace_id`, contract version, sequencing.
- Downstream feature extraction can run against the canary session(s) and populates `session_features` / `session_behavioural_features` and refresh-loop / repeated-pageview derivation.
- Stage 0 record-only decisions write as expected.
- Evidence Snapshot can run and produces the expected internal shape.
- Lane A/B preview can run and behaves as on Hetzner staging (read-only internal preview).
- **No customer-facing automated output.** Pass 1 / Trust / Pass 2 are unimplemented; nothing customer-facing leaves the collector or the internal review tools.
- The Render legacy endpoint remains available; reverting `endpointUrl` would restore prior behaviour.

---

## 8. Endpoint cutover mechanism

Planned mechanism shape (planning only — **PR#17d does not choose, configure, or mutate any live mechanism**):

- **ThinLayer config change.** The most likely mechanism: change the `endpointUrl` configured by the ThinLayer integration on `buyerrecon.com` to point at the Sprint 2 production collector hostname.
- **Site HTML / env / config update.** Depending on how ThinLayer is wired into `buyerrecon.com`, the change may be a site HTML edit, an environment variable update, or a deployed config bundle.
- **GTM / config variable** *(if applicable).* If ThinLayer's `endpointUrl` is sourced from a Google Tag Manager variable or equivalent tag-management configuration variable, the change is made there.
- **CDN / cache invalidation** *(if applicable, and only if explicitly approved in the future execution PR).* If `buyerrecon.com` serves the ThinLayer config from a CDN-cached asset, an invalidation may be required after the config change.
- **DNS / routing changes are out of scope here unless explicitly planned elsewhere.** PR#17d does not introduce DNS-level cutover for `buyerrecon.com`. DNS planning for `collector.buyerrecon.com` lives upstream (PR#17b §8) and is separately approved.

Governing constraints:

- PR#17d does **not** choose the final mechanism. The successor operator-runbook PR confirms which mechanism applies given the deployed state of `buyerrecon.com`.
- The chosen mechanism must be **reversible**: reverting `endpointUrl` back to the Render legacy collector must not require a code change or deployment of `buyerrecon.com` itself.
- Cache invalidation, if used, must also be reversible (no destructive cache wipe that would prevent rollback).

---

## 9. Canary traffic policy

- **Normal unlabelled production traffic only.** The canary observes whatever organic `buyerrecon.com` traffic naturally occurs after the `endpointUrl` change.
- **No QA / test / bot / synthetic / adversary labels in URL, UTM, dataLayer, cookies, storage, backend payload, GA4, Lane A/B rendered output, logs, reports, or tokens.**
- **No broad Track A adversarial traffic.** No mass programmatic runs against the canary endpoint as part of, or as a consequence of, the first canary.
- **No form submission test in the first canary.** Form submission is not exercised in the first canary window.
- **No customer-facing output.** Internal Evidence Snapshot and Lane A/B preview are read-only internal tools; nothing customer-facing is enabled.
- **First future programmatic proof remains unlabelled `B_analytics_only`** and is scoped by PR#17e — not by PR#17d.
- **Traffic expansion requires later approval.** Broader canary scope (more sites, additional Track A scenarios, form submission proof, marketing-tag scenarios) is approved separately in successor PRs.

---

## 10. Future cutover sequence

Planning only. The sequence below describes the **future** runbook steps the operator will follow in the execution PR. PR#17d does not authorise any of these to run now.

1. **Confirm prerequisites** (§5). If any item is missing, stop.
2. **Record current-state snapshot** (§6) as an artefact in the execution PR.
3. **Confirm Render rollback endpoint** is reachable and accepting traffic.
4. **Confirm Sprint 2 production health endpoint** (`/healthz` or equivalent) returns the expected status.
5. **Apply `buyerrecon.com` `endpointUrl` change** using the approved mechanism (§8). Reversibility must be demonstrably retained.
6. **Clear relevant cache only if approved.** No destructive cache operations.
7. **Load `buyerrecon.com` normally** (organic user-style load, no labels, no synthetic UTMs) — verify the page is healthy and ThinLayer initialises against the new endpoint.
8. **Verify the Sprint 2 collector receives the request** at the network / log level.
9. **Verify `ingest_requests`** — a row exists for the request with the expected site, validated token outcome, contract version, and timestamps.
10. **Verify `accepted_events` / `rejected_events`** — the event lands in the correct table with `workspace_id`, contract version, and sequencing intact.
11. **Verify no unexpected rejected spike** — `rejected_events` rate is within expected baseline for the canary window.
12. **Run feature extraction** — `session_features` and `session_behavioural_features` populate; refresh-loop / repeated-pageview derivation runs.
13. **Run Stage 0** — Stage 0 record-only decisions write as expected.
14. **Run Evidence Snapshot** — internal Evidence Review Snapshot produces the expected shape.
15. **Run Lane A/B preview** — read-only internal preview behaves as on Hetzner staging.
16. **Run forbidden-output / secrets / Track A label scan** over logs, observability surfaces, and produced artefacts.
17. **Record evidence report** (§16).
18. **Hold canary window.** Observe the canary for a documented duration (defined in the future execution PR) before any decision.
19. **Decide continue / rollback / pause.** Based on §19 success criteria and §14 triggers.

These are **future** runbook steps. They are not permission to execute now.

---

## 11. Smoke proof requirements

The future execution PR's smoke proof must include:

- **Health status** — Sprint 2 production collector health endpoint returns expected response before and after the cutover step.
- **One normal `page_view`-style proof** — a single real, organic, unlabelled `buyerrecon.com` page view observed end-to-end.
- **`ingest_requests` count** — count delta observed for the canary window, broken out by accept/reject outcome.
- **`accepted_events` / `rejected_events` counts** — counts observed for the canary window, with reject reasons categorised.
- **Event contract version visibility** — `event_contract_version` on accepted/rejected rows is the expected Sprint 2 contract value; no `legacy-thin-v2.0` arriving at the Sprint 2 collector.
- **Collector version visibility** — current Sprint 2 collector build/version recorded in health-endpoint metadata or equivalent surface.
- **`workspace_id` / `site_id` resolved server-side** — confirmed populated from the validated `site_write_token`, not from any client-supplied field.
- **No staging IDs** — no staging `workspace_id` / `site_id` appears on `buyerrecon.com` production rows.
- **No raw token exposure** — logs, error messages, observability surfaces, and the produced evidence report contain no raw token, token prefix, or token hash.
- **No Track A label exposure** — scan confirms no QA/test/bot/synthetic/adversary label and no Track A scenario marker in any telemetry, log, report, or token surface.
- **No customer-facing output** — no customer-visible automated artefact is produced as part of smoke proof.

---

## 12. Observer proof requirements

The future execution PR's observer proof must include:

- **Feature extraction result** — recorded outcome of the feature extractor running over the canary session(s).
- **`session_features` check** — expected per-session rows present with expected shape.
- **`session_behavioural_features` check** — expected per-session rows present with expected shape, using the **exact versioned table names** as they exist in the deployed Sprint 2 production schema at execution time (PR#17d does not pin a version here; the execution PR records the version it observed).
- **Stage 0 record-only decisions** — Stage 0 decisions recorded; **not wired** to any customer-facing action.
- **Risk observations** *(if applicable to the canary session)* — recorded.
- **POI observations** *(if applicable)* — recorded.
- **POI sequence observations** *(if applicable)* — recorded.
- **ProductFeatures candidate observation** *(if applicable)* — recorded; remains **record-only candidate**, with no AMS runtime call.
- **Evidence Snapshot** — internal Evidence Review Snapshot produced and recorded as an internal artefact.
- **Lane A/B preview** — read-only internal preview produced and recorded as an internal artefact.

Governing constraints:

- **Observer proof is internal validation only.** It is not, and must not be presented as, a customer-facing output.
- **Observer proof is not customer-facing output approval.** Pass 1 / Trust / Pass 2 remain unimplemented; this canary does not change that.

---

## 13. Track A canary proof path

- **PR#17d does not run Track A.** It does not touch the Track A repo at `/Users/admin/github/ams-qa-behaviour-tests`.
- **Track A proof against the Sprint 2 canary collector is deferred to PR#17e** (or a later approved Track A PR). PR#17d does not authorise any Track A run against any environment.
- **First Track A proof against the Sprint 2 collector must be unlabelled `B_analytics_only`** — single, narrow, gated, no label leakage anywhere.
- **Labels remain private run-log only.** Helen's private run log is the only record of Track A scenario labels.
- **Labels must not enter** URL, UTM, dataLayer, cookies, storage, backend payload, logs, GA4, Lane A/B rendered output, Evidence Snapshot, reports, or any token (per PR#17a §12; PR#17b §13; PR#17c §14).
- **Low-dwell, refresh-loop, adversarial CTA, and broader behaviour tests require later gates** — they are not part of the first canary and not part of PR#17e's first proof.

---

## 14. Rollback triggers

Rollback is invoked immediately if any of the following is observed during the canary window:

- **Sprint 2 collector unavailable** — the production collector is unreachable, timing out, or returning persistent 5xx.
- **TLS / health failure** — TLS handshake failures from `buyerrecon.com` to the collector, or the health endpoint failing the documented probe.
- **Event loss** — events generated by `buyerrecon.com` traffic are not arriving at the Sprint 2 collector or are missing from `ingest_requests`.
- **`rejected_events` spike** — rejection rate exceeds the canary baseline by a margin documented in the future execution PR.
- **`ingest_requests` missing** — request-level ledger rows are not being written.
- **`accepted_events` missing** — accepted events are not landing in the Sprint 2 schema despite being received.
- **Workspace / site mapping wrong** — `buyerrecon.com` traffic is being attributed to the wrong workspace_id / site_id, or to a staging workspace/site row.
- **Staging DB accidentally used** — the production collector is observed writing to a staging DB target (env-guard breach).
- **Token validation failure** — `buyerrecon.com`'s production `site_write_token` does not validate, or validates against a wrong workspace/site.
- **Secrets / log leakage** — any raw secret, raw token, token hash/prefix, DB URL, private IP, or credential-bearing env value appears in logs, observability surfaces, or produced artefacts.
- **Track A label leakage** — any QA/test/bot/synthetic/adversary label or Track A scenario marker appears in any telemetry, log, report, or token surface.
- **Customer-facing output appears** — any customer-visible automated artefact is produced (it must not be — Pass 1 / Trust / Pass 2 are unimplemented).
- **Unexpected LinkedIn / marketing tag behaviour** *(if relevant to `buyerrecon.com` at execution time)* — e.g. marketing tags firing under analytics-only consent.
- **Operator uncertainty** — the operator running the runbook is not confident the canary is sane. Uncertainty is itself a rollback trigger; do not "ride it out".

**If any trigger is hit, roll back immediately.**

---

## 15. Rollback sequence

Planning only — these are the future steps the operator will follow if a §14 trigger fires:

1. **Revert `buyerrecon.com` `endpointUrl`** to the Render legacy endpoint (`https://buyerrecon-backend.onrender.com/collect`) using the approved mechanism (§8).
2. **Clear cache if applicable and approved.** No destructive cache operations; only the minimum invalidation needed to ensure the reverted `endpointUrl` is live.
3. **Verify `buyerrecon.com` traffic returns to the Render legacy collector.** Render legacy `accepted_events` is observed receiving `buyerrecon.com` rows again.
4. **Stop any further canary expansion.** Other sites remain on Render legacy. No additional cutover work proceeds until rollback is reviewed.
5. **Preserve Sprint 2 evidence rows.** Do not delete `ingest_requests`, `accepted_events`, or `rejected_events` rows from the canary window. The Sprint 2 ledger remains intact for forensic and verification purposes.
6. **Mark canary as rolled back** in the execution PR / operator runbook.
7. **Create evidence gap report** (§16).
8. **Open follow-up issue / PR before retry.** Identify root cause, propose fix, and approve a new canary attempt in a new PR. Do not retry from the same in-flight runbook execution.

**No destructive rollback of the evidence ledger.** The point of rollback is to restore capture continuity, not to erase what was captured during the failed canary.

---

## 16. Evidence gap report

If a rollback occurs (or even if the canary completes successfully — both cases produce an evidence report), the report records:

- **Cutover start / end time.**
- **Endpoint before / after.** Recorded as the documented endpoint identifiers (Render legacy host vs Sprint 2 production host placeholder). No raw token, no DB URL.
- **Affected site:** `buyerrecon.com` only.
- **Event counts before / during / after.** `ingest_requests`, `accepted_events`, `rejected_events` counts on the Sprint 2 production DB and on the Render legacy DB for the comparable window.
- **Accepted / rejected counts.** Broken out by reject reason category.
- **Failure trigger** *(if any).* Which §14 trigger fired, with categorical detail.
- **Rollback time** *(if any).* When the `endpointUrl` reversion was applied and when Render legacy was confirmed receiving traffic again.
- **Data gap estimate.** Approximate count of events that may have been affected (e.g. lost, mis-attributed, or unobserved) during the rollback window. No raw event contents copied into the report.
- **No secrets / tokens / raw PII** in the report. No raw token, no token hash/prefix, no DB URL, no private IP, no PII payload. Categorical references only.
- **Operator decision.** Continue (canary success → hold for next-site decision), rollback (failure), or pause (uncertainty / out-of-scope finding).

---

## 17. Security and privacy guardrails

- **No secrets in docs / chat / PR.** No real or fake-but-credible secret material in this docs file, in any companion artefact in PR#17d, in any later execution PR's report (beyond categorical references), or in chat.
- **No raw tokens in logs.** Logs may record "token valid for workspace/site X" or "token validation failed (reason category)", but never a raw token, hash, or prefix thereof.
- **No token hashes / prefixes in the report** — categorical references only.
- **No private IPs** in the report or this doc.
- **No PII over-collection.** The Sprint 2 collector continues to follow the existing event-contract privacy posture; the canary does not broaden capture scope.
- **Consent posture preserved.** Analytics-only consent traffic continues to be handled as analytics-only.
- **No Track A labels in telemetry.** (Re-emphasised across §13, §14, §17.)
- **No customer-facing output.** Pass 1 / Trust / Pass 2 remain unimplemented.
- **Staging / production separation verified.** The canary must not produce evidence that staging and production are sharing tokens, workspace/site rows, DB targets, or roles. If it does — that is a §14 trigger.
- **Render rollback remains independent.** Any incident inside the Sprint 2 canary path must not affect the Render legacy collector or DB; Render legacy continues to be the safe rollback target.

---

## 18. Output-gate restrictions

- **Cutover only changes the collector path.** It does not change what is shown to customers.
- **No customer-facing automated scores** are produced or exposed by the canary.
- **No durable Lane A/B writers.** Lane A/B remains a read-only preview.
- **No Lane B exposure.** Lane B internal hypotheses remain internal.
- **No AMS Trust Core output exposure** through BuyerRecon.
- **No AMS runtime bridge.** PR#14 ProductFeatures bridge candidate observer remains record-only.
- **No Pass 1 / Pass 2 implementation.** The output-gate machinery is not in scope for PR#17d, and cannot be silently introduced via the canary.
- **Evidence Snapshot and Lane A/B preview remain internal-only.** They serve internal review; they do not produce customer-facing artefacts.

---

## 19. Success criteria

Future canary success is recorded only if **all** of the following hold during and after the canary window:

- `buyerrecon.com` traffic reaches the Sprint 2 production collector (no DNS, TLS, or transport failures).
- No event loss between ThinLayer and `ingest_requests`.
- Expected accepted / rejected pattern: rejection rate within baseline, reject reasons within expected categories.
- Production workspace / site mapping correct: `buyerrecon.com` traffic attributes to the production workspace_id / site_id for `buyerrecon.com`, not to staging or to another site.
- No staging DB used: env-guard never trips, no write path lands in `buyerrecon_staging`.
- No secrets leaked: forbidden-output / secrets scan passes across logs, observability surfaces, and produced artefacts.
- Feature extraction works on canary sessions (`session_features`, `session_behavioural_features`, refresh-loop / repeated-pageview).
- Stage 0 works (record-only).
- Evidence Snapshot works internally.
- Lane A/B preview works internally (read-only).
- Track A labels absent everywhere they could appear.
- Customer-facing output absent.
- Rollback remains available — at any point during the canary, the operator could revert `buyerrecon.com` `endpointUrl` to Render legacy without site code change.

If any of the above is not satisfied, the canary is not a success — the operator either rolls back, pauses, or escalates per the future execution PR's decision rules.

---

## 20. Stop-the-line conditions

Stop and re-plan if any of the following appears in PR#17d, in a successor PR claiming PR#17d approval, or in conversation around PR#17d:

- anyone proposes **all-site cutover** (cutting more than `buyerrecon.com` in the first canary, or batching multiple sites at once),
- **staging DB is used as production** (renaming, re-pointing, or re-tagging `buyerrecon_staging`),
- **Render legacy DB is used as Sprint 2 canonical production**,
- **real secrets, tokens, token hashes, DB URLs, role passwords, peppers, private IPs, or credential-bearing env values** are written into this doc, the repo, or chat,
- a **live endpoint change** is attempted in PR#17d (e.g. mutating `buyerrecon.com` ThinLayer `endpointUrl` from within this PR's scope),
- a **DNS change** is attempted in PR#17d,
- the **production host is touched** as part of PR#17d (Hetzner production or otherwise),
- **migrations are run** as part of PR#17d (in any environment),
- **roles or tokens are created** as part of PR#17d (in any environment),
- **Track A labels** enter any telemetry, log, report, token, URL, UTM, dataLayer, storage, backend payload, GA4 surface, or Lane A/B output,
- **customer-facing output** appears before Pass 1 / Trust / Pass 2 are implemented and proved,
- the **rollback path is missing** — for any reason, for any planned step.

Stop-the-line means: do not cut, do not deploy, do not change DNS, do not change `endpointUrl`, do not create resources. Return to planning.

---

## 21. What PR#17d explicitly does not approve

PR#17d explicitly does **not** approve any of the following:

- live cutover now,
- DNS change now,
- ThinLayer `endpointUrl` change now,
- production deployment of the Sprint 2 collector,
- creation of the Sprint 2 production DB,
- execution of any migration,
- creation of any DB role,
- creation, hashing, or rotation of any `site_write_token`,
- rotation of any other secret,
- Track A execution against any environment,
- all-site rollout (cutting any site beyond `buyerrecon.com`, or cutting `buyerrecon.com` in batch with others),
- enabling customer-facing automated output,
- introduction of an AMS runtime bridge,
- exposure of AMS Trust Core output,
- implementation of Pass 1 or Pass 2 governance.

These remain for explicitly-scoped successor PRs.

---

## 22. Recommended next PRs

PR#17d recommends the following successor PRs, each tightly scoped:

- **PR#17e — Track A unlabelled staging/canary proof plan.** The narrow unlabelled `B_analytics_only` proof against the Sprint 2 staging/canary collector, with full label-leakage discipline. Planning + (later) execution under existing Track A discipline.
- **PR#17f — Production migration / operator runbook.** The first PR that actually creates the production DB, applies migrations, creates roles, and provisions tokens — *only* after explicit approval. PR#17f's own review approves its execution.
- **PR#17g (or later) — Actual production collector deployment / operator proof.** The PR in which the Sprint 2 production collector is deployed and its health/smoke/observer proofs are recorded — *only* after explicit approval. This is also the PR sequence within which PR#17d's runbook is finally executed for `buyerrecon.com`.
- **Later (separate PR sequences):**
  - Pass 1 eligibility planning,
  - AMS Shared Core Trust bridge planning (Trust Core output remains future-gated),
  - Pass 2 customer-safe projection planning,
  - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

---

## 23. Acceptance criteria

PR#17d is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17d-buyerrecon-com-canary-cutover-runbook.md`,
- the content is **planning only** — no live endpoint change, no DNS change, no deployment, no DB connection, no resource creation, no secret rotation, no migration execution, no Track A execution, no production traffic generation,
- the **canary scope is `buyerrecon.com` only** (§4),
- **no endpoint change** is performed as part of PR#17d,
- **no DNS change** is performed as part of PR#17d,
- **no deployment** is performed as part of PR#17d,
- **no DB connection** or **resource creation** occurs as part of PR#17d,
- **no secrets** (real or fake-but-credible) appear in the doc — no DB URLs, no tokens, no token hashes, no role passwords, no peppers, no private IPs, no certificate material,
- the doc includes the **rollback plan** (§14, §15),
- the doc includes the **smoke proof plan** (§11),
- the doc includes the **observer proof plan** (§12),
- the doc includes **Track A label discipline** (§13, §17),
- the doc includes **output-gate restrictions** (§18),
- **no customer-facing automated output is approved** — Pass 1 / Trust / Pass 2 remain unimplemented and future-gated.

---

End of PR#17d planning. Docs only.
