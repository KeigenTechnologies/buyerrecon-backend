# BuyerRecon Sprint 2 PR#17e — Track A Unlabelled Staging/Canary Proof Plan

Status: **planning-only**. No execution. No Track A run. No Track A repo touch. No staging traffic generated. No production traffic generated. No DB connection. No deployment. No DNS change. No ThinLayer `endpointUrl` change. No secret creation or rotation. No migration execution. No Render touch. No Hetzner touch.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `bfbf25c` — PR#17d merged, "add buyerrecon.com canary cutover runbook").

PR branch: `buyerrecon-sprint2-pr17e-track-a-unlabelled-staging-canary-proof-plan`

---

## 1. Purpose

PR#17e plans a **future Track A unlabelled proof path** for validating the Sprint 2 staging/canary collector path with normal browser-like traffic, under analytics-only consent, without any Track A label leakage anywhere in transmitted telemetry.

It is planning-only. It does not:

- run Track A (in any environment, on any host, against any endpoint),
- touch the Track A repo at `/Users/admin/github/ams-qa-behaviour-tests`,
- generate staging traffic,
- generate production traffic,
- change DNS, deploy services, create DBs, create roles, create tokens, rotate secrets, or run migrations,
- approve execution of the proof.

PR#17e produces one docs file that records the future proof scope, label-leakage discipline, prerequisites, mode A/B target choices (staging first, canary later), future proof sequence, evidence surfaces, expected evidence, failure/rollback/stop triggers, private report format, output-gate restrictions, security/privacy guardrails, the relationship to PR#17d, explicit non-approvals, recommended next PRs, acceptance criteria, and stop-the-line conditions.

Anything in PR#17e that resembles an instruction is a **planned step**, not an action.

---

## 2. Execution status

PR#17e is explicit on its own status:

- **PR#17e is planning-only.**
- **PR#17e does not run Track A.** Not against staging. Not against canary. Not against production. Not against Render legacy. Not anywhere.
- **PR#17e does not touch the Track A repo.** The Track A repo at `/Users/admin/github/ams-qa-behaviour-tests` is not opened, edited, or used as part of this PR.
- **PR#17e does not generate staging or production traffic.** No browser session. No Playwright run. No headless run. No `curl`. No `fetch`. No synthetic probe.
- **Any future execution requires a separate explicit approval / runbook PR or operator approval.** The act of merging PR#17e is not, and must not be read as, approval to execute the proof.

This section governs the entire document. Wherever steps appear elsewhere in this PR (e.g. §11 "Future proof sequence"), they are the **future** runbook the operator will follow when execution is separately approved — never an authorisation flowing from PR#17e itself.

---

## 3. Inputs from PR#17a / PR#17b / PR#17c / PR#17d

PR#17a, PR#17b, PR#17c, and PR#17d are merged and govern PR#17e:

- **Render legacy remains fallback / archive.** `https://buyerrecon-backend.onrender.com/collect` and the legacy Render Postgres remain live, untouched, and available as rollback. Render legacy data is not force-migrated. (PR#17a §2, §4, §10.)
- **Sprint 2 schema is the canonical future** for BuyerRecon evidence. (PR#17a §4.)
- **A production collector endpoint is planned but not deployed** by these planning PRs (e.g. placeholder `collector.buyerrecon.com`, distinct from Render legacy and from any Hetzner staging collector). (PR#17b §4, §5, §8, §9.)
- **Production DB / roles / workspaces / `site_write_tokens` must be separate from staging** and separate from Render legacy at name, host, credentials, role grants, workspace/site rows, and token level. (PR#17b §6; PR#17c §4, §6, §8, §9, §11, §12.)
- **`buyerrecon.com` is the first canary site.** Other live sites are out of scope until later approved cutover PRs. (PR#17a §11; PR#17b §10; PR#17c §8; PR#17d §4.)
- **Track A labels remain private** (in Helen's / the operator's private run log only) and never appear in URL, UTM, dataLayer, cookies, storage, backend payload, headers, user agent, GA4, LinkedIn / marketing tags, accepted/rejected events, ingest_requests, logs, Evidence Snapshot, Lane A/B preview, reports, tokens, or workspace/site IDs. (PR#17a §12; PR#17b §13; PR#17c §14; PR#17d §13.)
- **Track A proof was deferred to PR#17e or later.** PR#17d §13 and §21 forbid Track A execution as part of PR#17d itself; PR#17e is the planning PR that documents the proof shape that a later approved PR may then execute. (PR#17d §13, §21, §22.)
- **Customer-facing automated output remains gated by Pass 1 / Trust / Pass 2.** Internal Evidence Snapshot and Lane A/B preview are allowed against the production stream; customer-facing automated reports/actions are not. (PR#17a §6.5, §8, §9; PR#17b §17; PR#17c §15; PR#17d §18.)

PR#17e inherits these constraints and does not relax any of them.

---

## 4. Track A background

- **Track A is a separate repo** at `/Users/admin/github/ams-qa-behaviour-tests`. It is not edited or executed as part of PR#17e.
- **Track A is a behaviour QA / proof harness, not a product scoring component.** It does not produce customer-facing artefacts. Its purpose is to test that backend evidence-capture surfaces respond appropriately to defined behaviour profiles.
- **Track A local-mode tests have previously passed** (130/130 with no live HTTP and no GA4 leakage), per PR#17a §12.
- **A previous Render legacy production `B_analytics_only` run** was executed — unlabelled, normal browser-like, no QA/test/bot/synthetic/adversary label leakage, no form submit, no LinkedIn fire under analytics-only consent. That run proved **only** that the current Render legacy collector ingests real production traffic; rows appeared in Render `accepted_events`, keyed as `buyerrecon_com` / `buyerrecon.com`, with `collector_version = 1.0.0` and `event_contract_version = legacy-thin-v2.0` (PR#17a §2).
- **Render legacy proof is not Sprint 2 Lane A/B proof.** Render legacy rows lack the Sprint 2 ledger, feature, and observation chain (PR#17a §10; PR#17c §12). A Track A run against Render legacy cannot validate the Sprint 2 canonical path.
- **Track A labels are private run-log ground truth only.** Helen's / the operator's private run log is the only record of which run corresponded to which Track A scenario. Telemetry remains label-free.

---

## 5. Non-goals

PR#17e explicitly does **not** approve and does **not** perform any of the following:

- running Track A now (in any environment),
- touching the Track A repo,
- production execution of any proof,
- staging execution of any proof,
- broad production bot / adversarial traffic,
- low-dwell scenario execution,
- refresh-loop scenario execution,
- adversarial CTA scenario execution,
- form submission proof,
- any ThinLayer `endpointUrl` cutover on any live site (`buyerrecon.com` included),
- any DNS change (`collector.buyerrecon.com` or otherwise),
- deployment of the Sprint 2 production collector,
- creation of the Sprint 2 production DB,
- execution of any migration,
- creation of any DB role,
- creation, hashing, or rotation of any `site_write_token`,
- enabling any customer-facing automated output,
- introduction of durable Lane A/B writers,
- introduction of an AMS runtime bridge,
- exposure of AMS Trust Core output through BuyerRecon.

PR#17e is a description of the **future** proof. Nothing in this document is executable.

---

## 6. Proof scope

The future Track A proof shape that PR#17e plans:

- **First proof type: `B_analytics_only` only.** No other Track A scenario is included in the first proof. Low-dwell, refresh-loop, adversarial CTA, form-submit, and broader behaviour proofs are deferred to later approval (per §20).
- **Proof must be unlabelled in all live / staging telemetry surfaces.** No Track A scenario marker may appear in any transmitted surface; see §7.
- **Target environment may be the Sprint 2 staging collector first, then the `buyerrecon.com` canary collector only after separate approval** (per §10 Mode A / Mode B).
- **Site scope:**
  - **Staging proof:** the explicitly-named Sprint 2 staging/canary host when available, recorded by the future approved-execution PR. PR#17e does not pin a hostname.
  - **Production / canary proof:** **`buyerrecon.com` only**, and only after the PR#17d execution prerequisites are satisfied by later PRs (production host, production DB, migrations, roles, `buyerrecon.com` production workspace/site mapping, `buyerrecon.com` production `site_write_token`, production-TLS endpoint, health proof, rollback path).
- **No other live sites** in scope for the first proof:
  - `realbuyergrowth.com` — out of scope,
  - `timetopoint.com` — out of scope,
  - `fidcern.com` — out of scope,
  - `keigen.co.uk` — out of scope.

---

## 7. Label-leakage discipline

Track A labels **must never** enter the following transmitted or persisted surfaces:

- **URL** — no `_qa`, no `track-a`, no scenario marker in path or hostname,
- **UTM** parameters — no `utm_*` carrying a Track A scenario or QA/test/bot/synthetic/adversary value,
- **query string** — no Track A scenario name, no synthetic identifier,
- **path** — no Track A scenario segment, no `/qa/`, no `/test/`, no `/synthetic/`,
- **dataLayer** — no Track A scenario push, no QA/test/bot/synthetic/adversary field,
- **cookies** — no Track A scenario cookie, no test/QA/bot cookie name or value,
- **`localStorage`** — no Track A scenario key or value,
- **`sessionStorage`** — no Track A scenario key or value,
- **backend payload** — no Track A scenario field anywhere in the ThinLayer-to-collector body,
- **headers** — no `X-Track-A-*` or equivalent custom header carrying a scenario marker,
- **user agent** — no Track A UA marker, no `track-a/...` substring, no test-bot UA token,
- **GA4** — no Track A scenario event/parameter that would land in GA4,
- **LinkedIn / marketing tags** — no Track A scenario field; under analytics-only consent these tags do not fire at all,
- **`accepted_events`** — no Track A scenario column or JSON field,
- **`rejected_events`** — no Track A scenario column or JSON field,
- **`ingest_requests`** — no Track A scenario column or JSON field,
- **logs** — no Track A scenario string, no QA/test/bot/synthetic/adversary substring,
- **Evidence Snapshot** — no Track A scenario field, no QA/test marker,
- **Lane A/B preview** — no Track A scenario field, no QA/test marker,
- **reports** — no Track A scenario marker in the private proof report (the report references `B_analytics_only` only as the **mode of the run that was authorised**, not as a label transmitted to the system; even this reference lives in the private report, not in transmitted telemetry),
- **tokens** — no Track A scenario in token metadata, no scenario-encoded token,
- **workspace / site IDs** — no Track A scenario in workspace_id, site_id, or any related identifier.

**Private labels may exist only in the operator's private run log and in local Track A result metadata that is not transmitted to live or staging systems.** Anything that crosses a network boundary, lands in a DB, or appears in a customer-visible surface is treated as transmitted and must remain label-free.

---

## 8. Allowed first proof behaviour

`B_analytics_only` is the **only** allowed first-proof behaviour. It is defined as:

- **Normal browser-like page load** of the target site (staging host in Mode A; `buyerrecon.com` in Mode B after approval).
- **Analytics-only consent path** — the consent banner / consent surface is exercised exactly as a real analytics-only user would: analytics consent granted, marketing consent withheld.
- **No marketing consent grant.** Marketing-related tags must not fire on the page.
- **No form submit.** No form interaction, no field input, no submit click.
- **No CTA adversarial behaviour.** No clicks designed to trigger adversarial flows; no click sequences chosen to stress edge cases. Organic CTA interaction is also avoided in the first proof to keep the surface narrow.
- **No refresh-loop pattern.** No repeated reload, no short-cycle navigation pattern.
- **No low-dwell adversarial pattern.** No deliberately short dwell time intended to test low-dwell handling.
- **No bot / adversarial UA marker.** User agent is a normal, current Chrome (or equivalent) UA; no `bot`, no `headless`, no test-bot UA token.
- **No synthetic UTM.** No `utm_*` injected for the proof. The session reaches the site as an organic visit would.
- **No `_qa` or test path.** No `_qa` query param, no `/test/` path, no QA/test/bot/synthetic/adversary segment in URL.
- **No QA / test / bot / synthetic / adversary words in transmitted telemetry.** Across every surface in §7.
- **No intentional LinkedIn firing under analytics-only consent.** Per the previous Render legacy `B_analytics_only` finding: LinkedIn did not fire under analytics-only consent. The new proof must preserve that behaviour. If LinkedIn (or another marketing tag) is observed firing under analytics-only consent, that is a §14 trigger.

---

## 9. Future prerequisites before any execution

Future execution may begin **only** when every prerequisite below is satisfied. PR#17e does not satisfy any of these; it lists them.

- **PR#17e merged as planning.** This document exists in the canonical Sprint 2 branch history.
- **Target collector endpoint approved.** For Mode A: the Sprint 2 staging collector endpoint that the proof will target. For Mode B: the Sprint 2 production collector endpoint as approved by the later operator PR (per PR#17b, PR#17c, PR#17d prerequisites).
- **Target environment explicitly named** in the future execution PR — staging hostname *or* `buyerrecon.com` (Mode B). No "either-or" ambiguity at execution time.
- **Staging / canary DB identity confirmed.** Mode A writes to the Sprint 2 staging DB only; Mode B writes to the Sprint 2 production DB only. No cross-environment writes.
- **No production / staging confusion.** Env-guard (per PR#17b §5 and PR#17c §11) demonstrably distinguishes Sprint 2 staging from Sprint 2 production at config level.
- **Site token exists and is stored outside repo/chat.** For Mode A: the Sprint 2 staging `site_write_token`. For Mode B: the `buyerrecon.com` production `site_write_token` provisioned by the future operator PR (per PR#17c §9, §10).
- **Endpoint health proof complete.** `/healthz` (or equivalent) probe against the target collector has been recorded as healthy at the time of approval.
- **Rollback path confirmed if production canary.** For Mode B: PR#17d's rollback runbook is staged and verified (Render legacy endpoint reachable, ThinLayer `endpointUrl` reversion mechanism confirmed, evidence-gap report template ready).
- **Track A repo clean and local-only label discipline verified.** The Track A repo is in a known-good state, and its local label discipline is verified — labels live only in private run-log and in local result metadata that is not transmitted.
- **Operator approval recorded** in the future execution PR (who approved, when, against which prerequisite state).
- **Expected evidence surfaces listed** in the future execution PR — which tables, logs, observers, and reports the proof will inspect (see §12).
- **Forbidden-output / label-leakage scan plan ready** — automated scan plan exists for the surfaces in §7, covering Track A scenario markers, QA/test/bot/synthetic/adversary substrings, raw tokens / token prefixes / token hashes, DB URLs, AMS Trust Core leakage, and PII leakage.

**If any prerequisite is missing, do not execute the proof.** Open the missing prerequisite first, satisfy it in its own PR, then re-enter this proof plan.

---

## 10. Target choices: staging first, canary later

The future proof may be executed in one of two modes — never both in the same execution PR, and never Mode B before Mode A has passed.

### Mode A — Sprint 2 staging proof

- **Preferred first execution target.** Mode A validates the Track A unlabelled `B_analytics_only` path against the Sprint 2 schema without touching production cutover.
- **Must not use the production DB.** Mode A writes to the Sprint 2 staging DB only. Env-guards verify this before the run begins.
- **Must not be treated as production proof.** A passing Mode A run does not, by itself, authorise Mode B execution. Mode B execution is gated on the full PR#17d / PR#17b / PR#17c successor sequence being approved on its own merits.
- **Site-level scope:** the staging proof targets the named Sprint 2 staging/canary host. No live customer-facing site is touched in Mode A.

### Mode B — `buyerrecon.com` canary proof

- **Only after** the production collector, production DB, production roles, `buyerrecon.com` production `site_write_token`, production-TLS endpoint, health proof, rollback path, and PR#17d cutover prerequisites are satisfied by separate approved PRs.
- **`buyerrecon.com` only.** No all-site proof. No other live site is touched.
- **No broad behaviour suite.** First-proof scope remains `B_analytics_only` per §6 and §8.
- **PR#17d rollback governs Mode B failure** (per §14 and §18).

---

## 11. Future proof sequence

Planning only. The sequence below describes the **future** runbook steps the operator will follow in a later approved execution PR. PR#17e does not authorise any of these to run now.

1. **Confirm target mode A or B.** The execution PR names the mode and the target hostname explicitly.
2. **Confirm operator approval.** The execution PR records the approver, timestamp, and prerequisite state (per §9).
3. **Confirm Track A repo clean.** Track A repo is in a known-good local state and its local label discipline is verified.
4. **Confirm `B_analytics_only` profile only.** No other scenario is selected for this run.
5. **Confirm no labels in URL / UTM / storage / dataLayer / payload / header / UA.** Per §7. A pre-run check verifies the Track A configuration cannot inject scenario markers into transmitted surfaces.
6. **Confirm target endpoint health.** `/healthz` (or equivalent) probe returns expected response immediately before the run.
7. **Perform one narrow unlabelled browser session** against the target endpoint, under analytics-only consent.
8. **Confirm no form submit.** The session does not interact with any form.
9. **Confirm analytics-only consent path.** Consent banner / consent surface is exercised exactly as a real analytics-only user would.
10. **Confirm no LinkedIn / marketing tag under analytics-only consent.** If any marketing tag fires, that is a §14 trigger.
11. **Verify the collector request arrived** at the target endpoint at network / log level.
12. **Verify `ingest_requests`** — a row exists with expected site, validated-token outcome, contract version, and timestamps.
13. **Verify `accepted_events` / `rejected_events`** — the event lands in the correct table with `workspace_id`, contract version, sequencing.
14. **Verify event contract and collector version visibility** — `event_contract_version` is the expected Sprint 2 value; collector version is the deployed Sprint 2 value.
15. **Verify `workspace_id` / `site_id` resolved server-side** — populated from the validated `site_write_token`, not from any client-supplied field.
16. **Verify no staging / production ID confusion.** Mode A rows live in staging only; Mode B rows live in production only. No cross-environment rows.
17. **Run forbidden Track A label-leakage scan** over §7 surfaces and the produced artefacts.
18. **Run Evidence Snapshot if available** — internal-only result recorded.
19. **Run Lane A/B preview if available** — read-only internal-only result recorded.
20. **Produce private proof report** (per §15).

These are **future** runbook steps. They are not permission to execute now.

---

## 12. Evidence surfaces to inspect

The future proof inspects the following surfaces. PR#17e does not query any of these now.

- **Track A private local run log** — the operator's private record of the run.
- **Browser console / network observation** *(only if safe and only on the operator's controlled machine; not exported)* — the operator may observe the live session locally to confirm no labelled traffic is being sent.
- **Collector health status** — recorded before, during, and after the run.
- **`ingest_requests`** — request ledger row(s) for the proof run.
- **`accepted_events`** — accepted event row(s) for the proof run.
- **`rejected_events`** — any rejection row(s) for the proof run, with reason category.
- **`session_features`** *(if feature extraction runs against the proof session)* — feature row(s) recorded.
- **`session_behavioural_features`** *(if applicable)* — behavioural feature row(s) recorded, using the **exact versioned table names** as they exist in the deployed Sprint 2 schema at execution time (PR#17e does not pin a version here; the execution PR records the version it observed).
- **Stage 0 record-only decisions** *(if applicable)* — Stage 0 decision row(s).
- **Evidence Snapshot** *(if applicable)* — internal Evidence Review Snapshot result.
- **Lane A/B preview** *(if applicable)* — read-only internal preview result.
- **Logs** — scanned for secrets, raw tokens, token prefixes/hashes, DB URLs, private IPs, and Track A scenario markers.

**No raw secrets, no raw tokens, no token hashes, no token prefixes, no private IPs, no PII**, in any recorded artefact, log, or report.

---

## 13. Expected positive evidence

The future proof is considered "positive" if all of the following are observed:

- **Exactly the intended target receives the request** — staging hostname in Mode A, `buyerrecon.com` production collector in Mode B; no other endpoint receives the proof traffic.
- **The request is normal unlabelled browser-like traffic** — no synthetic markers in §7 surfaces.
- **`ingest_requests` contains the request ledger** — a row exists for the proof run.
- **`accepted_events` or `rejected_events` behaviour is explainable** — the outcome matches the proof intent; rejections (if any) are within expected baseline categories.
- **Accepted events have the correct production / staging workspace / site mapping for the chosen target** — Mode A → Sprint 2 staging workspace/site; Mode B → `buyerrecon.com` production workspace/site.
- **No Track A label strings appear** in any §7 surface.
- **No QA / test / bot / synthetic / adversary markers** appear in any §7 surface.
- **No `form_submit` event** is recorded for the proof session (the session did not submit a form, and the system did not invent one).
- **No marketing / LinkedIn tag fires under analytics-only consent** *(where these tags are present at the target site at execution time)*.
- **Evidence Snapshot and Lane A/B preview remain internal-only.** No customer-facing artefact is produced.

---

## 14. Failure / rollback / stop triggers

The future proof must stop (and, in Mode B, must roll back per PR#17d §15) if any of the following is observed:

- **Any Track A label leaks** into any §7 surface.
- **Any QA / test / bot / synthetic / adversary word appears** in transmitted telemetry, logs, or reports.
- **The wrong environment receives traffic** — e.g. Mode A traffic landing on production, Mode B traffic landing on staging.
- **Staging DB is confused with production** — e.g. the production collector observed writing to staging, or vice versa.
- **Render legacy receives traffic when a Sprint 2 target was expected**, unless the run is explicitly testing the Render fallback path *(which would be a separately approved scenario, not the `B_analytics_only` first proof)*.
- **Sprint 2 target receives production traffic before approved cutover** — e.g. live `buyerrecon.com` traffic is observed reaching the Sprint 2 production collector before PR#17d execution prerequisites have been approved.
- **Form submit occurs** — the proof must not submit a form; if a submit occurs, the proof is no longer `B_analytics_only`.
- **Marketing tag fires under analytics-only consent** — preserves the previous Render legacy finding that LinkedIn did not fire under analytics-only consent; any regression is a stop trigger.
- **Secrets / tokens appear in logs** — raw secret, raw token, token hash/prefix, DB URL, private IP, or credential-bearing env value observed in logs, observability surfaces, or produced artefacts.
- **Customer-facing output appears** — any customer-visible automated artefact is produced (it must not be — Pass 1 / Trust / Pass 2 are unimplemented).
- **Operator uncertainty exists** — the operator running the proof is not confident the proof is sane; uncertainty is itself a stop trigger.

**For Mode B (production canary) failures, rollback follows the PR#17d rollback runbook** (PR#17d §14, §15, §16) — revert `buyerrecon.com` ThinLayer `endpointUrl` to the Render legacy endpoint, preserve Sprint 2 evidence rows (no destructive ledger rollback), produce an evidence gap report, open a follow-up PR before any retry.

---

## 15. Report format

The future proof produces a **private proof report** with the following fields:

- **Execution approval reference** — the PR / runbook entry that approved this run.
- **Target mode** — `staging` (Mode A) or `buyerrecon.com canary` (Mode B).
- **Target endpoint category** — categorical reference only (e.g. "Sprint 2 staging collector", "Sprint 2 production collector for buyerrecon.com"). **No secret URL** if the URL is considered sensitive at execution time.
- **Run start / end time.**
- **Browser / profile summary** — UA family/version, OS family, profile category. No PII.
- **Consent path** — analytics-only confirmed; no marketing consent granted.
- **Evidence surfaces inspected** — list of §12 surfaces actually inspected for this run.
- **Ingest / accepted / rejected counts** — counts for the proof window, broken out by reject reason category.
- **Event contract version** — value observed.
- **Collector version** — value observed.
- **Workspace / site mapping result** — confirmed correct for the target mode.
- **Label-leakage scan result** — pass / fail per §7 surface.
- **Marketing / LinkedIn tag result** — fired / did not fire / not applicable, per the target site at execution time.
- **Form-submit result** — none (expected).
- **Evidence Snapshot / Lane A/B preview internal result if run** — internal-only.
- **Decision** — pass / fail / pause / rollback.

**No raw event payload**, **no secrets**, **no raw tokens**, **no token hashes / prefixes**, **no DB URLs**, **no private IPs**, **no PII** appear in the report. Categorical references only.

---

## 16. Output-gate restrictions

- **Track A proof does not create customer-facing output.**
- **Track A proof does not approve customer-facing automated scores.**
- **Evidence Snapshot and Lane A/B preview remain internal-only.** No customer-visible artefact is produced as part of the proof.
- **No Lane B exposure.** Lane B internal hypotheses stay internal.
- **No durable Lane A/B writers.** Lane A/B remains a read-only preview.
- **No AMS Trust Core output** exposure through BuyerRecon.
- **No AMS runtime bridge.** PR#14 ProductFeatures bridge candidate remains record-only.
- **No Pass 1 / Pass 2 implementation** as part of this proof.
- **No sales action recommendation.** The proof is evidence-capture validation, not commercial recommendation.

---

## 17. Security and privacy guardrails

- **No secrets in docs / chat / PR.** No real or fake-but-credible secret material in this docs file, in any companion artefact in PR#17e, in the future execution PR's report (beyond categorical references), or in chat.
- **No token values or token hashes** anywhere — not in this doc, not in the future execution PR's report, not in logs, not in any internal artefact.
- **No DB URLs** in this doc, in the future execution PR's report, or in logs.
- **No private IPs** in this doc, in the future execution PR's report, or in logs.
- **No PII over-collection.** The proof exercises only the analytics-only consent path. No identity collection is broadened.
- **No raw payload pasted into reports** unless separately redacted and approved by a later explicitly-scoped PR. Categorical references only by default.
- **No Track A labels in telemetry** (per §7).
- **Consent posture preserved.** Analytics-only consent traffic continues to be handled as analytics-only.
- **Staging / production separation verified** before the proof runs (per §9 and §14).
- **Render fallback remains independent.** Any incident inside the Sprint 2 proof path must not affect the Render legacy collector or DB. Render legacy continues to be the safe rollback target in Mode B.

---

## 18. Relationship to PR#17d

- **PR#17d is the `buyerrecon.com` canary endpoint cutover runbook.** It defines how, in the future, `buyerrecon.com` ThinLayer traffic will be moved from the Render legacy collector to the Sprint 2 production collector — for organic traffic.
- **PR#17e is the Track A proof plan** that may be **used after** a Sprint 2 collector path exists (Mode A against staging when staging is approved; Mode B against `buyerrecon.com` canary collector when PR#17d's cutover prerequisites are satisfied by separately approved PRs).
- **PR#17e does not execute PR#17d.** Running a Track A proof is not the same action as cutting `buyerrecon.com` to the Sprint 2 production collector. The two are governed by distinct execution PRs.
- **PR#17e does not approve `buyerrecon.com` cutover.** Approval for `buyerrecon.com` cutover lives in PR#17d's successor execution PR sequence (the PR#17b/PR#17c/PR#17d-mandated host, DB, role, token, endpoint, health, rollback prerequisites).
- **For production canary Mode B, PR#17d rollback and evidence-gap posture governs.** §14 stop triggers in Mode B invoke PR#17d §14 / §15 / §16.

---

## 19. What PR#17e explicitly does not approve

PR#17e explicitly does **not** approve any of the following:

- running Track A now,
- staging execution now,
- production execution now,
- the broad Track A scenario suite,
- low-dwell test,
- refresh-loop test,
- adversarial CTA test,
- form-submit test,
- ThinLayer `endpointUrl` cutover on any live site,
- any DNS change,
- deployment of the Sprint 2 production collector,
- creation of the Sprint 2 production DB,
- execution of any migration,
- creation of any DB role,
- creation, hashing, or rotation of any `site_write_token`,
- rotation of any other secret,
- enabling any customer-facing automated output,
- introduction of an AMS runtime bridge,
- exposure of AMS Trust Core output,
- implementation of Pass 1 or Pass 2 governance.

These remain for explicitly-scoped successor PRs.

---

## 20. Recommended next PRs

PR#17e recommends the following successor PRs, each tightly scoped:

- **PR#17f — Production migration / operator runbook.** The first PR that actually creates the production DB, applies migrations, creates roles, and provisions tokens — *only* after explicit approval. PR#17f's own review approves its execution.
- **PR#17g — Actual production collector deployment / operator proof.** The PR in which the Sprint 2 production collector is deployed and its health/smoke/observer proofs are recorded — *only* after explicit approval.
- **PR#17h or later — Approved execution of `buyerrecon.com` canary cutover and/or Track A `B_analytics_only` proof.** The execution PR that follows PR#17d's runbook and/or PR#17e's proof plan, *if* Helen explicitly approves; the order of cutover-first vs Track-A-first is decided in that PR.
- **Later — Low-dwell / refresh-loop / adversarial CTA Track A plans**, only after `B_analytics_only` proof passes and is reviewed.
- **Later (separate PR sequences):**
  - Pass 1 eligibility planning,
  - AMS Shared Core Trust bridge planning (Trust Core output remains future-gated),
  - Pass 2 customer-safe projection planning,
  - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

---

## 21. Acceptance criteria

PR#17e is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17e-track-a-unlabelled-staging-canary-proof-plan.md`,
- the document **explicitly states it is planning-only** (per §1 and §2),
- **no Track A execution** occurs as part of PR#17e,
- **no Track A repo touch** occurs as part of PR#17e,
- **no traffic is generated** (staging or production),
- **`B_analytics_only` is the only first-proof scope** (per §6 and §8),
- **staging-first / canary-later modes are clear** (per §10),
- **label-leakage discipline is complete** across the §7 surfaces,
- **no secrets** (real or fake-but-credible) appear in the doc — no DB URLs, no tokens, no token hashes, no role passwords, no peppers, no private IPs, no certificate material,
- **no customer-facing automated output is approved** (Pass 1 / Trust / Pass 2 remain unimplemented and future-gated),
- the **relationship to PR#17d is clear** (per §18),
- **stop triggers are included** (per §14 and §22),
- the **report format is included** (per §15).

---

## 22. Stop-the-line conditions

Stop and re-plan if any of the following appears in PR#17e, in a successor PR claiming PR#17e approval, or in conversation around PR#17e:

- PR#17e is described as execution-approved,
- the Track A repo is modified as part of PR#17e,
- Track A is run as part of PR#17e (in any environment),
- staging or production traffic is generated as part of PR#17e,
- a live endpoint is changed as part of PR#17e,
- DNS is changed as part of PR#17e,
- the production host is touched as part of PR#17e,
- any DB is accessed as part of PR#17e,
- **real secrets, tokens, token hashes, DB URLs, role passwords, peppers, private IPs, or credential-bearing env values** are written into this doc, the repo, or chat,
- **Track A labels appear in any transmitted telemetry surface or in any persisted/customer-visible artefact** (per §7),
- broad or adversarial scenarios (low-dwell, refresh-loop, adversarial CTA, form-submit, broad bot/adversarial) are included in the first proof,
- **customer-facing output** is enabled (or its approval is requested) before Pass 1 / Trust / Pass 2 are implemented and proved,
- the **rollback path for Mode B (production canary) is missing or untested** — PR#17d §14 / §15 / §16 must govern.

Stop-the-line means: do not execute, do not touch the Track A repo, do not change DNS, do not change `endpointUrl`, do not generate traffic, do not access any DB, do not introduce any secret. Return to planning.

---

End of PR#17e planning. Docs only.
