# BuyerRecon Sprint 2 PR#17b — Production Collector Deployment Planning

Status: planning / docs-only. No implementation. No deployment. No DNS change. No secret creation. No production touch. No Render touch. No Hetzner touch. No migration.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `881739c` — PR#17a merged, "plan production cutover output gates").

PR branch: `buyerrecon-sprint2-pr17b-production-collector-deployment-planning`

---

## 1. Purpose

PR#17b plans the **future Sprint 2 production collector deployment shape** after PR#17a, without deploying or changing any runtime.

PR#17a established the architectural posture: Render legacy is retained as fallback/archive, Sprint 2 schema is the canonical future, customer-facing automated output remains gated by Pass 1 / Trust / Pass 2, and production cutover must be site-by-site beginning with `buyerrecon.com`. PR#17b takes the next planning step: *what would a production-grade Sprint 2 collector deployment look like* so that — when a later PR approves cutover — there is a documented target shape to deploy into.

PR#17b is **only a plan**. It does not:

- deploy the collector,
- create DNS records,
- create or rotate secrets,
- create a production DB,
- run migrations,
- touch Render or Hetzner,
- cut any ThinLayer endpoint,
- run Track A in production,
- approve any customer-facing automated output.

It produces one docs file describing endpoint shape, hosting shape, DB separation, environment categories, edge/DNS/TLS plan, readiness requirements, smoke proof sequence, Track A discipline, rollback, security and privacy guardrails, readiness checklist, explicit non-approvals, recommended next PRs, acceptance criteria, and stop-the-line conditions.

---

## 2. Inputs from PR#17a

PR#17a is merged and governs PR#17b:

- **Render legacy remains fallback/archive.** `https://buyerrecon-backend.onrender.com/collect` and the legacy Render Postgres remain live and untouched. They are the rollback target during and after cutover.
- **Sprint 2 schema is the canonical future.** New production traffic will enter the Sprint 2 canonical ledger (`ingest_requests`, `accepted_events` / `rejected_events`) and feature/observation chain.
- **A new production collector endpoint is required.** It must be distinct from the Render legacy host and distinct from any Hetzner staging collector.
- **Production must be separate from staging.** Separate host (or clearly isolated process), separate DB, separate roles, separate workspace/site rows, separate secrets. The Hetzner staging DB (`buyerrecon_staging` family) is not promoted.
- **`buyerrecon.com` is the first canary site.** The remaining live sites (`realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk`) are cut one at a time, only after `buyerrecon.com` proves out.
- **Customer-facing automated output remains gated by Pass 1 / Trust / Pass 2.** Internal Evidence Snapshot and Lane A/B preview are allowed against the new production stream; customer-facing automated reports and actions are not.

PR#17b inherits these constraints and does not relax any of them.

---

## 3. Non-goals

PR#17b explicitly does **not** approve and does **not** perform any of the following:

- deployment of the Sprint 2 production collector,
- any DNS change (no `collector.buyerrecon.com` record creation, no CNAME, no edge change),
- shutdown, downgrade, or modification of the Render legacy collector or Render legacy DB,
- modification of the Hetzner production environment (any new production resources, if introduced later, are out of scope for this PR),
- creation of the Sprint 2 production database,
- execution of any migration against any production DB,
- creation, rotation, or storage of any production token, key, or secret,
- ThinLayer endpoint cutover on any live site (`buyerrecon.com` included),
- customer-facing automated output (reports, actions, scores),
- broad Track A production testing — only the planning of a narrow future canary `B_analytics_only` proof is in scope (planning only).

Anything in PR#17b that resembles an instruction is a **plan**, not an action.

---

## 4. Target production collector endpoint

The planned Sprint 2 production collector endpoint (planning only):

- **Hostname (planned):** `collector.buyerrecon.com` — placeholder; final hostname is approved in a later PR. The key property is that it is **not** the Render legacy host (`buyerrecon-backend.onrender.com`) and **not** any Hetzner staging collector hostname.
- **Path:** `/collect` for the event ingestion endpoint, matching the existing ThinLayer client contract surface.
- **Health endpoint:** a separate path (e.g. `/healthz`) returning a known-good status response with no event-bearing payload, suitable for monitoring/probe and unauthenticated probing within rate-limit policy.
- **TLS:** valid production TLS certificate for the chosen hostname. No mixed content from ThinLayer. No staging certs in production.
- **Distinct from Render legacy:** Render's `/collect` continues to exist and to receive any ThinLayer traffic still pointed at it. The Sprint 2 collector is an *additional* endpoint, not a replacement of the Render route at the network level.
- **Distinct from Hetzner staging collector:** if a Hetzner staging collector exists for Sprint 2 staging proofs, the production collector is a separate hostname, separate DB, separate tokens. Staging and production must not share entry surface.

PR#17b does not register, request, or rotate the hostname; that is for PR#17b's recommended successor PRs.

---

## 5. Production hosting shape

The planned Sprint 2 production collector hosting shape (planning only, placeholders only — no real production secrets, IPs, hostnames, or credentials in this document):

- **Host posture:**
  - production host **separate from staging host**, or clearly isolated (separate VM/instance/role/network namespace),
  - production host **not** the Hetzner staging host that has been used for PR#11d / PR#14c / PR#15b proofs,
  - production host capacity planning out of scope (sized in PR#17b's successor planning PRs).
- **OS / runtime assumptions (placeholders):**
  - Linux server, Node.js runtime version pinned by the existing repo configuration (decided in a later PR; PR#17b does not pin a version),
  - production process is the same Sprint 2 collector code that runs on staging; no production-only code path is introduced by PR#17b.
- **Process manager (placeholder):**
  - a supervised process (e.g. systemd unit or equivalent) to provide restart-on-failure and structured logging,
  - exact process manager choice deferred to PR#17b's successor.
- **Layout categories only (no values, no credentials):**
  - dedicated deploy user (least privilege),
  - dedicated app directory,
  - dedicated logs directory with retention policy,
  - dedicated secrets path **outside the repo** (no production secrets in `.env` files committed to the repo, no production secrets in chat),
  - dedicated release-versioned directory layout so previous release artefacts can be reverted to without re-fetching from source.
- **Rollback-ready release layout:**
  - one current release, at least one prior release preserved,
  - rollback is a service pointer flip, not a re-clone,
  - rollback does not require touching the DB (see §6 and §14).
- **No direct commands in this doc** that mutate any production resource. No `ssh`, no `scp`, no `apt`, no `psql`, no `nginx -s reload`, no `systemctl`. PR#17b is a target description, not a runbook.

---

## 6. Production database separation

Planned posture for the Sprint 2 production database (planning only):

- **Production DB separate from `buyerrecon_staging`.** Distinct database name (e.g. `buyerrecon_production` as a placeholder), distinct credentials, distinct connection target. No reuse of the staging connection string in production.
- **Production roles separate from staging roles.** Production application role (least-privilege grants for `ingest_requests`, `accepted_events`, `rejected_events`, `session_features`, `session_behavioural_features`, observation tables, Stage 0 tables, ProductFeatures candidate tables, Evidence Snapshot tables, Lane A/B preview supporting tables — where they exist). Production read-only role for Evidence Snapshot / Lane A/B preview readers. No shared superuser usage by the app process.
- **Production workspace/site records separate from staging.** The five live sites (`buyerrecon.com`, `realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk`) are represented as production workspace/site rows in the production DB, not as staging rows.
- **Migrations applied only in a future approved PR.** PR#17b does not run, queue, or include any migration SQL. The Sprint 2 canonical schema is applied to the production DB inside PR#17c (or a later, explicitly migration-scoped PR).
- **No promotion of the staging DB to production.** The Hetzner staging DB is not renamed, re-pointed, or re-tagged to become production. A *new* production DB is provisioned in a later PR.
- **No use of the Render legacy DB as the Sprint 2 canonical production DB.** Render legacy Postgres remains read-only archive / fallback. The Sprint 2 canonical schema is **not** applied to the Render legacy DB. Render legacy rows are not migrated into the Sprint 2 production DB (per PR#17a §10).

---

## 7. Environment and secret categories

The Sprint 2 production collector will need configuration. PR#17b lists **categories only**, with no values, no real tokens, no real DB URLs:

- `DATABASE_URL` — connection target for the Sprint 2 production DB (never staging, never Render legacy, never committed).
- `NODE_ENV` — production marker.
- Allowed origins — explicit allow-list (or policy) for ThinLayer-originating posts; not a "wildcard" production setting.
- `site_write_tokens` — per-site write tokens, never reused from staging, never logged, never in repo.
- Workspace/site mapping — mapping from token (or token claim) → workspace/site row IDs, resolved server-side.
- Logging configuration — log level, structured format, retention, redaction policy.
- Rate-limit / abuse-guard configuration — request size cap, per-IP/per-site throttle, drop policy. Decided in PR#17b's successor planning PRs.
- Collector public base URL — the hostname used to construct callbacks/self-references, if any.

**Secrets posture:**
- Secrets live **outside the repo**. Not in `.env.example`, not committed `.env`, not in CI logs, not in this doc, not in chat.
- Secrets management mechanism (vault / encrypted env / platform secret store) is chosen in PR#17b's successor (likely PR#17c).
- This doc must not contain values for any of the above categories.

---

## 8. Edge, DNS, TLS, and routing plan

Planned edge/DNS/TLS shape (planning only; **no actual DNS or server change is performed by PR#17b**):

- **DNS record (planned):** `collector.buyerrecon.com` resolving to the production collector entry point. The record is *not* created by PR#17b. Creation is approved in a later PR after the host is provisioned.
- **Edge / CDN (optional, planned):** Cloudflare or equivalent edge layer in front of the collector for DNS, TLS termination, basic rate-limit, and bot-management policy (subject to PR#17b's successor). Choice of edge provider is deferred.
- **TLS certificate:** production certificate for the chosen hostname (e.g. via the chosen edge provider, or via on-host certificate management). Staging certificates must not be reused.
- **Reverse proxy:** Nginx (or equivalent) terminating connections to the collector process, with:
  - sensible request size cap suitable for ThinLayer event payloads,
  - sensible client/server timeouts,
  - access logs and error logs separated and rotated,
  - rollback-safe upstream switching (so the upstream can be flipped to a prior release without DNS change).
- **Rollback routing:**
  - the Render legacy endpoint is not behind this proxy and is not affected by any change here,
  - if the Sprint 2 collector misbehaves, rollback is performed at the ThinLayer `endpointUrl` layer (see §14), not by destructive edge changes.

No DNS API calls, no zone-file edits, no certificate-issuance commands, no edge-provider mutations are part of PR#17b.

---

## 9. Collector service readiness

Functional readiness requirements the Sprint 2 production collector must meet **before** any future cutover PR may begin (planning only — PR#17b does not test against production):

- **Health endpoint** returns the expected status payload under normal conditions, and remains responsive under collector load.
- **Valid Sprint 2 event-contract traffic is accepted.** ThinLayer events matching the Sprint 2 event contract are recorded into `ingest_requests` and into `accepted_events`.
- **Invalid traffic is rejected safely.** Malformed payloads, unknown tokens, missing required fields, and contract-mismatch payloads are recorded into `rejected_events` (or rejected at `ingest_requests` with reason) without crashing the service and without leaking sensitive context into responses.
- **`ingest_requests` writes** are durable for every incoming request, accepted or rejected.
- **`accepted_events` / `rejected_events` writes** populate the Sprint 2 schema columns including `workspace_id`, contract version, sequencing.
- **No sensitive raw output in logs.** Logs do not include raw secrets, tokens, full payload bodies with PII, or Track A labels.
- **No customer-facing output from the collector.** The collector is a capture-only service. Customer-facing automated output remains gated by Pass 1 / Trust / Pass 2 in a later PR sequence.

PR#17b does not verify these on production. It only *requires* that a successor PR's deployment plan demonstrates them on a controlled canary before any live site is cut.

---

## 10. Site auth and workspace boundaries

Planned site authentication and workspace/site boundary posture (planning only):

- **`site_write_tokens` per site.** One token per live site:
  - `buyerrecon.com`
  - `realbuyergrowth.com`
  - `timetopoint.com`
  - `fidcern.com`
  - `keigen.co.uk`
- **`buyerrecon.com` is the first canary site.** It receives the first production write token and the first ThinLayer endpoint cutover (in a later PR's runbook, not in PR#17b).
- **`workspace_id` / `site_id` are resolved server-side.** ThinLayer does not send workspace/site identifiers directly; the collector resolves them from the validated write token. ThinLayer cannot impersonate another site by client-side forgery.
- **No shared staging token in production.** Staging tokens are not copied, renamed, or repurposed for production use. Production tokens are issued fresh in PR#17b's successor planning PRs and provisioned via the chosen secrets mechanism.
- **No token values in this doc.** Token format, scope, and rotation cadence are described categorically (per-site, scoped to workspace/site, rotatable), not by example value. No real or fake token strings appear in this doc.
- **Per-site provisioning order respects PR#17a.** Tokens for sites other than `buyerrecon.com` are not used until `buyerrecon.com` has cleared smoke and observer proofs.

---

## 11. Observability and logs

Planned observability posture (planning only):

- **Service health logs** — process lifecycle, restart events, health-check responses.
- **Request ledger counts** — `ingest_requests` write rate, broken out by site and by accept/reject outcome.
- **Accepted/rejected event counts** — `accepted_events` and `rejected_events` rates, broken out by site, contract version, and rejection reason.
- **Error rates** — application errors, DB errors, auth-failure rates, with redacted context.
- **Latency** — request handling latency at the collector (p50/p95/p99 as practical), and downstream DB write latency.
- **Collector version visibility** — current collector build/version surfaced in logs and on health endpoint metadata, so cutover/rollback state is observable.
- **Event contract version visibility** — `event_contract_version` per accepted/rejected event surfaced in counts, so contract drift is detectable (e.g. a site still sending `legacy-thin-v2.0` after cutover would be visible immediately).
- **Forbidden-output / secrets scan for logs** — automated scan plan (in a later PR) checks logs for:
  - any QA/test/bot/synthetic/adversary label,
  - any Track A marker,
  - any apparent secret material (token/DB URL fragments),
  - any PII pattern that should not be in logs.
- **Evidence gap notes** — if observability indicates dropped/lost events on the Sprint 2 collector, the operator records an evidence gap report linking affected window, affected sites, and what (if anything) needs to be re-considered (planning only; no automatic re-ingestion).

---

## 12. Smoke proof plan

Planning only. Defines the **future** sequence to prove the Sprint 2 production collector is sane, performed in a successor PR (likely PR#17b → PR#17d). PR#17b does not run any of these steps.

1. **Health check.** Hit `/healthz` (or equivalent), expect known-good response.
2. **One safe normal `page_view`-style event from a controlled canary.** Single, unlabelled, real-shaped event — no QA/test/bot/synthetic markers, no Track A markers, no synthetic UTMs. (Track A involvement is gated separately in §13.)
3. **Verify `ingest_requests`.** Confirm a row was written for the request with the expected site, token, contract version, and timestamps.
4. **Verify `accepted_events` / `rejected_events`.** Confirm the event landed in the correct table with `workspace_id`, contract version, sequencing intact.
5. **Run feature extraction.** Confirm `session_features` and `session_behavioural_features` populate for the test session, including refresh-loop / repeated-pageview derivation if relevant.
6. **Run Stage 0.** Confirm Stage 0 record-only decisions write as expected.
7. **Run Evidence Snapshot.** Confirm Evidence Review Snapshot produces the expected internal shape against this production session.
8. **Run Lane A/B preview.** Confirm read-only Lane A/B preview observer behaves on production data the way it has behaved on Hetzner staging.
9. **Run forbidden-output scan.** Confirm no QA/test/bot/synthetic labels, no Track A markers, no apparent secret material, and no AMS Trust Core output appear anywhere in the produced artefacts.
10. **Document rollback readiness.** Confirm the ThinLayer `endpointUrl` rollback to Render legacy works without site code change, and confirm the runbook step is recorded.

Only after every step above passes — in the later cutover PR, not in PR#17b — may a live site be cut.

---

## 13. Track A proof path

Planning only. Track A is the unlabelled programmatic behaviour-testing repo at `/Users/admin/github/ams-qa-behaviour-tests`. PR#17b does not run Track A and does not touch the Track A repo.

- **Track A first production/canary proof against the Sprint 2 collector must be unlabelled `B_analytics_only`.** No additional Track A scenarios run on production until earlier gates pass.
- **Track A labels remain private run-log only.** `B_analytics_only`, low-dwell, refresh-loop, adversarial CTA, and any other Track A scenario label live in Helen's private run log only.
- **No QA/test/bot/synthetic labels in telemetry.** Labels must not appear in URL, UTM, dataLayer, cookies, storage, backend payload, GA4, Lane A/B rendered output, or logs.
- **No broad production bot/adversarial traffic in PR#17b's scope.** No mass programmatic runs against any production endpoint as part of, or as a consequence of, PR#17b.
- **Track A proof waits until the production collector endpoint exists and is approved.** Only a later PR (proposed PR#17e) may schedule, scope, and gate a narrow unlabelled canary proof against the Sprint 2 collector. PR#17b only documents this future shape.

---

## 14. Rollback plan

Planned rollback posture (planning only; PR#17b is not deployable and has no live rollback to perform):

- **Render legacy endpoint remains available.** `https://buyerrecon-backend.onrender.com/collect` continues to accept ThinLayer traffic from any site whose `endpointUrl` is still pointed at it.
- **ThinLayer `endpointUrl` is the primary rollback lever.** For any site that has been cut to the Sprint 2 collector, rollback is performed by reverting that site's ThinLayer `endpointUrl` back to the Render legacy endpoint — no backend code change required at the site.
- **DNS rollback if applicable.** If a DNS-level cutover (e.g. CNAME flip for `collector.buyerrecon.com`) is later used, a DNS rollback path is pre-recorded; this is planned in a later PR, not executed here.
- **Service rollback to prior release.** The release-versioned host layout (see §5) supports flipping the supervised process to a prior release without re-fetching, in case a Sprint 2 collector release regresses.
- **Production DB streams remain separate from Render legacy.** Sprint 2 canonical writes go to the Sprint 2 production DB only. Render legacy writes go to Render legacy DB only. Nothing is overwritten; nothing is migrated. Therefore no DB-level rollback is required for the legacy stream.
- **Evidence gap report after rollback.** If any rollback fires, the operator produces an evidence gap report covering:
  - which sites rolled back,
  - when,
  - what symptoms triggered rollback,
  - which collector handled what fraction of traffic during the window,
  - what is in the Sprint 2 production DB vs the Render legacy DB for that window,
  - what (if anything) might be re-considered later (planning notes only; no automatic re-ingestion).
- **Immediate revert on event loss / rejection spike.** If the Sprint 2 collector is observed to lose events or to reject events at an anomalous rate on any cut site, that site's ThinLayer `endpointUrl` is reverted immediately and further cutover is paused.

---

## 15. Security and privacy guardrails

Planned guardrails (planning only; PR#17b does not introduce or store any secret):

- **No secrets in repo or chat.** No production tokens, DB URLs, private IPs, certificate keys, or platform credentials appear in the repo, in this doc, or in conversation transcripts.
- **No production DB URL in docs.** `buyerrecon_production` and similar are *placeholder* names. The actual DB hostname and credentials are never committed.
- **No raw tokens in logs.** Logs may reference token presence/absence and validity outcome, but never the token value or any prefix that could narrow it.
- **No Track A labels in telemetry.** Labels stay in Helen's private run log only (per §13 and per PR#17a §12).
- **No PII over-collection.** The Sprint 2 collector continues to follow the existing event-contract privacy posture; no new identity fields are introduced by PR#17b.
- **Consent / privacy posture preserved.** Analytics-only consent traffic continues to be handled as analytics-only. No silent broadening of capture scope as part of a cutover plan.
- **Least-privilege DB roles planned.** Application role has only the grants it needs. Read-only role for Evidence Snapshot / Lane A/B preview readers. No superuser usage from the app process.
- **Staging/production separation verified before any future cutover.** Before a successor PR may approve any live cut, it must demonstrate that staging and production DBs, roles, hosts, secrets, and tokens are not shared.

---

## 16. Production readiness checklist

Items below must each be **approved** (in a successor PR, not in PR#17b) before any live site may be cut from Render legacy to the Sprint 2 production collector:

- **Production host approved** — host posture, isolation from staging, supervised process, release-versioned layout.
- **Production DB approved and separate from staging** — distinct DB name, host, credentials, roles; not the staging DB; not the Render legacy DB.
- **Migrations plan approved** — Sprint 2 canonical schema migrations sequenced for application to the production DB in a later, explicitly migration-scoped PR.
- **Roles plan approved** — application role and reader role grants, with least privilege.
- **Site token plan approved** — per-site `site_write_tokens` for the five live sites, scoped to workspace/site, secrets-stored, never in repo.
- **DNS/TLS plan approved** — chosen hostname, edge/CDN posture, TLS issuance and renewal, rollback DNS path.
- **Reverse proxy plan approved** — Nginx (or equivalent), request size, timeouts, access logs.
- **Health check plan approved** — health endpoint contract, probe cadence, alerting wiring.
- **Logs / observability plan approved** — log structure, retention, redaction, metric set, forbidden-output / secrets scan.
- **Smoke proof plan approved** — §12 sequence approved as the gate for any live cut.
- **Rollback plan approved** — §14 rollback levers documented, tested, and pre-staged before any live cut.
- **Track A canary proof plan approved** — narrow unlabelled `B_analytics_only` proof scope (proposed PR#17e), label discipline enforced.
- **Evidence Snapshot / Lane A/B preview proof plan approved** — these internal review tools demonstrably operate on the new production stream the way they operate on Hetzner staging.

If any item above is unapproved, no live site is cut.

---

## 17. What PR#17b explicitly does not approve

PR#17b explicitly does **not** approve any of the following:

- deploy now,
- create the production DB now,
- run any migration now (against any DB, on any host),
- touch Render now,
- touch Hetzner now,
- cut ThinLayer endpoint on any live site now (`buyerrecon.com` included),
- run Track A against any production endpoint now,
- enable customer-facing automated output,
- introduce an AMS runtime bridge (PR#14 remains record-only candidate observer),
- expose AMS Trust Core output through BuyerRecon,
- implement Pass 1 or Pass 2 governance.

These remain for explicitly-scoped successor PRs.

---

## 18. Recommended next PRs

PR#17b recommends the following successor PRs, each tightly scoped:

- **PR#17c — Production DB / role / token plan.** Production Postgres provisioning plan, distinct role grants, `site_write_tokens` provisioning plan, secrets-handling mechanism. Planning only.
- **PR#17d — `buyerrecon.com` canary endpoint cutover runbook.** Per-site cutover runbook for the first canary site only, including the §12 smoke sequence and the §14 rollback levers. Planning only; execution is gated on PR#17c approval and host availability.
- **PR#17e — Track A unlabelled staging/canary proof plan.** The narrow unlabelled `B_analytics_only` proof against the Sprint 2 staging/canary collector, with full label-leakage discipline. Planning + (later) execution under existing Track A discipline.
- **Later (separate PR sequences):**
  - Pass 1 eligibility planning,
  - AMS Shared Core Trust bridge planning (Trust Core output remains future-gated),
  - Pass 2 customer-safe projection planning,
  - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

---

## 19. Acceptance criteria

PR#17b is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17b-production-collector-deployment-planning.md`,
- the content is **planning only** — no runtime change, no deploy, no schema/code change, no migration, no DNS change, no secret creation,
- a **production collector endpoint plan** exists (hostname placeholder, health endpoint requirement, TLS requirement, distinct from Render legacy and Hetzner staging),
- **production / staging separation is explicit** at the host, DB, role, workspace/site, secrets, and token layers,
- **Render fallback is explicit** (Render legacy endpoint and DB retained, ThinLayer endpoint rollback as primary lever),
- **rollback is explicit** at the ThinLayer endpoint, DNS (if applicable), and release-versioned service level,
- **Track A label discipline is explicit** (labels never in telemetry; first canary is unlabelled `B_analytics_only`; broad production Track A is non-approved),
- **no secrets are exposed** — no real tokens, DB URLs, private IPs, certificate material, or credential-bearing env values appear in the doc,
- **no customer-facing automated output is approved** — Pass 1 / Trust / Pass 2 remain unimplemented and future-gated.

---

## 20. Stop-the-line conditions

Stop and re-plan if any of the following appears in PR#17b, in a successor PR claiming PR#17b approval, or in conversation around PR#17b:

- anyone proposes the **staging DB as production** (e.g. renaming, re-pointing, or re-tagging `buyerrecon_staging`),
- anyone proposes the **Render legacy DB as the Sprint 2 canonical production DB**,
- **real secrets, tokens, DB URLs, certificate material, or credential-bearing env values** are written into this doc, the repo, or chat,
- **deployment commands** are introduced into this doc or any companion file in PR#17b (e.g. `systemctl`, `nginx`, `psql`, `scp`, `ssh`, `kubectl`, edge-provider API calls, secret-store API calls),
- **DNS changes** are proposed as part of PR#17b itself (rather than as future work for a successor PR),
- an **all-site cutover** is proposed (cutting more than `buyerrecon.com` in the first canary),
- **Track A labels** appear in URL, UTM, dataLayer, cookies, storage, backend payload, GA4, Lane A/B rendered output, or logs,
- **customer-facing automated output** is enabled (or its approval is requested) before Pass 1 / Trust / Pass 2 are implemented and proved,
- the **rollback path is missing** — for the planned production collector, for ThinLayer endpoint reversion, or for service release-version reversion.

Stop-the-line means: do not deploy, do not create DNS, do not provision DB, do not issue tokens, do not cut. Return to planning.

---

End of PR#17b planning. Docs only.
