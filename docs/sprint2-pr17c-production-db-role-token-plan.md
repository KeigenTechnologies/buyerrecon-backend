# BuyerRecon Sprint 2 PR#17c — Production DB / Role / Token Plan

Status: planning / docs-only. No implementation. No DB connection. No DB creation. No role creation. No token creation. No secret creation or rotation. No migration execution. No deployment. No DNS change. No Render touch. No Hetzner touch.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `9b50a5d` — PR#17b merged, "plan production collector deployment").

PR branch: `buyerrecon-sprint2-pr17c-production-db-role-token-plan`

---

## 1. Purpose

PR#17c plans **production database identity, role model, workspace/site identity, and `site_write_tokens` provisioning posture** for the future Sprint 2 production collector path that PR#17b described.

It is the next planning step after PR#17a (architectural posture) and PR#17b (collector deployment shape). PR#17c does not create or modify any production resource. It does not connect to any database. It does not issue tokens. It does not write SQL that would run anywhere. It produces one docs file that:

1. records the inputs inherited from PR#17a and PR#17b,
2. names production DB identity at placeholder level only,
3. defines migration posture (deferred to a later explicitly-scoped PR),
4. describes a production role model in role-family categories,
5. describes per-table access boundaries by role family,
6. describes workspace/site identity for the five live sites,
7. describes `site_write_tokens` provisioning posture *without values*,
8. describes secret-handling categories,
9. lists production/staging separation checks,
10. reaffirms Render legacy separation,
11. defines audit/verification posture (categories and expected proof artefacts only),
12. reaffirms Track A label discipline and output-gate restrictions,
13. defines rollback/revocation posture,
14. lists production readiness checklist,
15. lists explicit non-approvals,
16. recommends next PRs,
17. records acceptance criteria and stop-the-line conditions.

Anything in PR#17c that resembles an instruction is a **plan**, not an action.

---

## 2. Inputs from PR#17a and PR#17b

PR#17a and PR#17b are merged and govern PR#17c:

- **Sprint 2 schema is the canonical future** for BuyerRecon evidence (ledger → features → observations → internal Evidence Review → future output gates). (PR#17a §4.)
- **Render legacy is archive/fallback.** `https://buyerrecon-backend.onrender.com/collect` and the legacy Render Postgres remain live, read-only, and untouched. Render is not extended; Render legacy data is not force-migrated. (PR#17a §2, §4, §10.)
- **A production collector endpoint is planned but not deployed** (e.g. placeholder `collector.buyerrecon.com`). (PR#17b §4.)
- **Production DB must be separate from staging.** Separate DB name, host, credentials, roles, workspace/site rows, secrets. The Hetzner staging DB (`buyerrecon_staging` family) is not promoted. (PR#17b §6.)
- **`buyerrecon.com` is the first canary site.** The remaining live sites (`realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk`) follow one at a time. (PR#17a §11; PR#17b §10.)
- **Track A labels remain private** (in Helen's private run log only) and never appear in URL, UTM, dataLayer, cookies, storage, backend payload, GA4, Lane A/B rendered output, or logs. (PR#17a §12; PR#17b §13.)
- **Customer-facing automated output remains gated by Pass 1 / Trust / Pass 2.** Internal Evidence Snapshot and Lane A/B preview are allowed against the production stream; customer-facing automated reports/actions are not. (PR#17a §6.5, §9; PR#17b §9, §17.)
- **Two trust concepts are separated.** Internal claim-confidence (used by Evidence Snapshot / Lane A/B preview) is distinct from AMS Shared Core Trust output (future-gated, not exposed by cutover). (PR#17a §8.)

PR#17c inherits these constraints and does not relax any of them.

---

## 3. Non-goals

PR#17c explicitly does **not** approve and does **not** perform any of the following:

- creation of the Sprint 2 production database,
- creation of any DB role (migrator, collector writer, worker, customer/API read, internal read, backup/operator),
- creation, hashing, or rotation of any `site_write_token` or other secret,
- rotation of any existing secret,
- execution of any migration against any DB (production, staging, Render legacy),
- deployment of the Sprint 2 production collector,
- any DNS change (`collector.buyerrecon.com` or otherwise),
- any ThinLayer endpoint cutover on any live site (`buyerrecon.com` included),
- any Track A production run, broad or narrow,
- any customer-facing automated output (reports, actions, scores),
- introduction of durable Lane A/B writers (Lane A/B remains read-only preview),
- introduction of an AMS runtime bridge (PR#14 remains record-only candidate observer),
- exposure of AMS Trust Core output through BuyerRecon.

PR#17c is a description of the target. Nothing in this document is executable.

---

## 4. Production database identity

Placeholder identity for the planned Sprint 2 production DB (planning only — **no real host, port, username, password, private IP, or connection string in this doc**):

- The production DB must be **separate from `buyerrecon_staging`**. Distinct database name. Distinct credentials. Distinct connection target. No reuse of the staging connection string in production.
- The production DB must **not** be the Render legacy DB. Render legacy Postgres remains read-only archive/fallback and is not promoted, re-tagged, or extended into Sprint 2 canonical use.
- The production DB **name** may be referenced in this doc as a placeholder only — e.g. `buyerrecon_production` — to keep the planning text concrete. The actual production DB name, host, port, and credentials are decided in a successor PR and never appear in this doc.
- The production DB must be treated as a **separate evidence ledger** from staging and from Render legacy. Rows in production are not interchangeable with rows in staging, and not interchangeable with rows in Render legacy. No automated cross-environment write paths exist.
- Hosting is **likely** alongside the planned Sprint 2 production collector (see PR#17b §5). PR#17c does not pin host, region, instance class, or backup strategy.

Nothing in this section authorises creating, naming, or connecting to a production database.

---

## 5. Migration posture

Planned migration posture (planning only — PR#17c does not run, queue, or include any migration SQL):

- **Migrations are applied only in a future approved migration/runbook PR.** PR#17c does not declare a migration set, does not stage SQL files, and does not change `schema.sql`.
- **The production migration must be auditable.** The successor migration-scoped PR must record which migrations were applied, in what order, against which DB identity, by whom, and at what timestamp.
- **Ordered.** Migrations are applied in their canonical Sprint 2 order. No partial or out-of-order application.
- **Reversible where applicable.** Migrations that can be cleanly reversed should have a documented reverse step. Migrations that cannot be cleanly reversed (e.g. data-destructive ones) must be flagged as forward-only with explicit risk acceptance recorded in the migration-scoped PR.
- **Proofed.** Migrations must be proofed against a non-production target first (typically Hetzner staging) and that proof recorded.
- **Staging proof does not equal production migration approval.** A migration that succeeded on staging is necessary but not sufficient; the production-scoped migration PR must still be reviewed and approved on its own merits.
- **Schema drift check required before any future production migration.** The successor PR must verify that the target production DB is in the expected pre-migration state (no unexpected manual changes, no foreign objects, no stale partial migrations).
- **No executable migration commands in this doc.** No `psql ... < ...`, no migration runner CLI invocation, no SQL snippets that would alter any DB. PR#17c is a plan, not a runbook.

---

## 6. Production role model

The Sprint 2 production DB role model, expressed **as role families only** — no role passwords, no connection strings, no GRANT statements, no real role names tied to credentials:

- **Migrator role** — used only during migration application, by the migration runner; no application traffic uses this role; revoked from interactive use after migration. Has the elevated grants required to alter schema.
- **Collector writer role** — used by the Sprint 2 production collector service. Has write access only to the ledger surface the collector needs at runtime (see §7). No DDL. No access to roles, secrets tables, or anything outside its remit.
- **Feature / scoring worker role** — used by downstream feature extractors, Stage 0 record-only worker, and observation workers. Reads from the ledger surface; writes to feature/observation surfaces it owns. Does not mutate source ledger tables.
- **Customer / API read role** *(if later needed)* — read-only, scoped to whatever customer-safe view is approved by a later output-gate PR. Not introduced as a writer. Not introduced with access to internal Lane B, internal claim-confidence, or any AMS Trust Core surface in PR#17c's scope.
- **Internal readonly / observer role** — read-only, used by Evidence Snapshot and Lane A/B preview observers, and by internal review tooling. Sees the canonical evidence surface; does not write.
- **Backup / operator role** *(if needed)* — used by backup, monitoring, and operator tooling. Scope is whatever is required for backup/restore and health-checks, no application read/write.

Governing constraints:

- **Least privilege.** Each role family receives only the grants required by its function.
- **No superuser app role.** The collector and the workers never run as superuser. Superuser usage is restricted to one-off operator activity, recorded in the operator runbook.
- **No shared staging role in production.** Role names, passwords, and connection strings are distinct between staging and production.
- **No role passwords or connection strings in docs.** Not in this file. Not in any companion file in PR#17c. Not in chat.
- **Exact table grants are finalised in a future operator runbook PR.** The role families above are categories; the precise `GRANT … ON … TO …` set is decided in PR#17c's successor (operator runbook), not here.

Important precision (per PR#17a / PR#17b):

- **Evidence Snapshot and Lane A/B preview are read-only observer outputs**, not necessarily backed by their own durable Lane A/B writer tables. The role model assumes read access against the canonical evidence surface, not against a new "Lane A/B writer" surface.
- If a future PR introduces supporting tables for these observers, the **successor operator-runbook PR** must name the new tables explicitly when finalising role grants. PR#17c does not pre-grant against tables that do not yet exist.
- **PR#17c does not imply approval of durable Lane A/B writers.** Lane A/B remains read-only preview unless an explicit later PR changes that.

---

## 7. Table access boundaries

Planned per-table access categories, by role family (planning only; **no executable GRANT statements**):

| Surface | Migrator | Collector writer | Feature/scoring worker | Internal readonly / observer | Customer/API read (if later) | Backup/operator |
|---|---|---|---|---|---|---|
| `ingest_requests` | DDL | INSERT | SELECT | SELECT | none in PR#17c scope | backup/restore scope only |
| `accepted_events` | DDL | INSERT | SELECT | SELECT | none in PR#17c scope | backup/restore scope only |
| `rejected_events` | DDL | INSERT | SELECT | SELECT | none in PR#17c scope | backup/restore scope only |
| `session_features` | DDL | none | INSERT/UPDATE as owner | SELECT | none in PR#17c scope | backup/restore scope only |
| `session_behavioural_features` | DDL | none | INSERT/UPDATE as owner | SELECT | none in PR#17c scope | backup/restore scope only |
| Stage 0 decision tables | DDL | none | INSERT (record-only) | SELECT | none in PR#17c scope | backup/restore scope only |
| Risk observation tables | DDL | none | INSERT (observer-owned) | SELECT | none in PR#17c scope | backup/restore scope only |
| POI observation tables | DDL | none | INSERT (observer-owned) | SELECT | none in PR#17c scope | backup/restore scope only |
| POI sequence observation tables | DDL | none | INSERT (observer-owned) | SELECT | none in PR#17c scope | backup/restore scope only |
| Product-context / timing-window / ProductFeatures candidate observation tables (where present) | DDL | none | INSERT (observer-owned) | SELECT | none in PR#17c scope | backup/restore scope only |
| Evidence Snapshot observer reads | DDL | none | none (read-only observer output) | SELECT (read) | none in PR#17c scope | backup/restore scope only |
| Lane A/B preview observer reads | DDL | none | none (read-only observer output) | SELECT (read) | none in PR#17c scope | backup/restore scope only |

Governing constraints:

- **Collector writes only what it needs at runtime.** The collector role writes to `ingest_requests`, `accepted_events`, and `rejected_events`. It does not write to feature, observation, Snapshot, or Lane A/B surfaces.
- **Downstream workers do not mutate source ledger tables.** Feature/scoring workers read the ledger and write to surfaces they own.
- **Customer / API read role does not see internal Lane B, internal claim-confidence, or any AMS Trust Core surface** unless a later, explicit output-gate PR approves a customer-safe projection (Pass 1 / Trust / Pass 2 — PR#17a §6.5, §8, §9). In PR#17c's scope, no such access is granted.
- **No Trust Core output exposure in this plan.** PR#14 ProductFeatures bridge candidate remains record-only; no AMS runtime is bridged.
- **No durable Lane A/B writers in this plan.** Lane A/B preview is read-only. If supporting tables ever exist, the successor operator-runbook PR names them explicitly before granting access.

This table is illustrative scope, not a final grant set; the successor operator-runbook PR finalises grants.

---

## 8. Workspace and site identity plan

Planned production workspace/site identity (planning only — actual workspace_id / site_id values are decided in the successor operator-runbook PR, not here):

- The five live sites each get **production workspace/site rows** in the production DB:
  - `buyerrecon.com`
  - `realbuyergrowth.com`
  - `timetopoint.com`
  - `fidcern.com`
  - `keigen.co.uk`
- **`buyerrecon.com` is the first canary site.** Its workspace/site rows are provisioned (and used) before the others. The other four are provisioned in advance only to the extent required to issue tokens; their actual cutover follows the per-site order in PR#17a §11.
- **`workspace_id` and `site_id` are resolved server-side.** The collector resolves them from the validated `site_write_token` (or from validated token-claim/site mapping), not from any client-supplied identifier.
- **No client-supplied `workspace_id` is trusted.** A site cannot impersonate another site by client-side forgery. The collector ignores any client-supplied workspace/site fields for routing.
- **No staging workspace/site is reused for production.** Staging workspace_ids and site_ids are not copied into the production DB; production rows are provisioned fresh.
- **Mapping must be auditable before cutover.** The successor operator-runbook PR records the production workspace_id → site_id → hostname mapping for the five live sites, the timestamp and operator of provisioning, and any later changes.

Nothing in this section authorises creating workspace/site rows now.

---

## 9. `site_write_tokens` plan

Planned production `site_write_tokens` posture (planning only — **no token values, no token hashes, no token prefixes, no token formats that include real material in this doc**):

- **One or more production `site_write_tokens` per site** (`buyerrecon.com` first; the other four sites issued in the order PR#17a §11 specifies).
- **The raw token is generated and stored only in the approved secret manager / operator vault** — see §10. It is not stored in the repo, not in chat, not in this doc, not in any CI log.
- **The DB stores only the permitted server-side representation.** Where the schema supports it, the DB stores hash/metadata (e.g. a one-way hash of the token, an issued-at timestamp, a label, a workspace/site reference, and revocation state). PR#17c does not specify the hash function, salt/pepper, or stored fields in execution detail — those are finalised in the successor operator-runbook PR.
- **Docs must not include the raw token or any stored token hash.** Not even as an "example value". Not as a partial prefix.
- **Token validation outcome may be observed; raw-token inspection / raw-token logging is forbidden.** Logs may record "token valid for workspace/site X" or "token validation failed (reason category)", but never a raw token, hash, or fragment thereof.
- **Token rotation and disablement plan is required before cutover.** The successor operator-runbook PR documents:
  - the rotation cadence,
  - the rotation procedure (issue new → roll over → revoke old),
  - the disablement procedure (`disabled_at` or equivalent if the schema supports it),
  - the rollback procedure if a rotation is botched.
- **Disabled / revoked tokens** are honoured at the collector: a presented token whose revocation state indicates disabled is rejected, and the reason is recorded in `rejected_events` / `ingest_requests` reason fields (without echoing the token value).

Nothing in this section authorises generating, hashing, distributing, or storing any token now.

---

## 10. Secret handling plan

Planned secret-handling categories (planning only — **no values for any category appear in this doc**):

- `DATABASE_URL` — production DB connection string. Never staging. Never Render legacy. Never committed.
- `SITE_WRITE_TOKEN_PEPPER` (or equivalent, if applicable) — server-side pepper used in token hashing if the schema/algorithm requires it.
- `IP_HASH_PEPPER` (if applicable) — server-side pepper used in any IP-hashing path that may be employed by the collector or workers.
- `site_write_tokens` — per-site raw tokens (see §9), held only in the secret manager / operator vault.
- DB role credentials — passwords or equivalent for the role families in §6.
- Deployment env values — any other production-only env values referenced by the runtime.
- Logging / observability credentials (if applicable) — credentials for any external log sink or metrics backend.

Governing constraints:

- **Secrets live outside the repo and outside chat.** No `.env` committed. No `.env.example` containing real values. No secret pasted into terminal transcript, docs, PR, issue, Slack, or chat.
- **Future operator proof must mask secrets.** When the successor operator-runbook PR records proof of provisioning or rotation, secret values must be masked or omitted; only outcome categories (success/fail, masked identifier, timestamp) are recorded.
- **No secret leakage via tooling.** Logs, error messages, stack traces, and observability surfaces must not echo secrets, even partially.
- **Storage mechanism is decided in PR#17c's successor.** PR#17c does not pin a vault product, a CLI, or an env-injection mechanism; it only requires that whatever mechanism is chosen keeps secrets out of repo/chat.

---

## 11. Production / staging separation checks

Planned checklist that must pass before any successor PR may approve provisioning of production resources (planning only):

- **DB name differs** between production and staging.
- **DB host differs**, or isolation between staging and production processes is explicitly documented and enforced (e.g. separate instances, separate networks, separate credentials with no cross-grant).
- **Roles differ.** Production role families (per §6) are not the staging role families; production role passwords are not the staging passwords.
- **Workspace/site IDs differ** between production and staging for the same hostnames. Production workspace/site rows are provisioned independently.
- **Site tokens differ.** Staging `site_write_tokens` are never accepted in production; production `site_write_tokens` are never accepted in staging.
- **Collector public base URL differs.** Production collector hostname (e.g. placeholder `collector.buyerrecon.com`) is distinct from any staging collector hostname.
- **Logs distinguish production from staging.** Every log entry can be traced to environment without ambiguity (e.g. via an environment tag or log destination separation).
- **No staging token accepted in production.** Token validation is environment-scoped: a token issued under the staging secret pepper cannot validate against production, and vice versa.
- **No production token accepted in staging.**
- **No staging DB used as production by env mistake.** The collector refuses to start if its `DATABASE_URL` resolves to a staging DB while its `NODE_ENV` claims production (or equivalent guard, finalised in the successor operator-runbook PR).

---

## 12. Render legacy separation

Planned posture (planning only):

- **Render legacy DB remains archive/fallback.** It is not migrated. It is not extended with new Sprint 2 tables. It is not read by Sprint 2 production roles.
- **Render legacy schema lacks the full Sprint 2 canonical chain.** It has no `workspace_id`, no `ingest_requests` ledger, no Stage 0 decisions, no `session_features` / `session_behavioural_features`, no observation chain, no Evidence Snapshot or Lane A/B preview compatible shape (per PR#17a §10).
- **No production Sprint 2 role/token plan depends on the Render legacy DB.** No role family in §6 has grants on Render legacy. No `site_write_token` is reused between Render legacy and Sprint 2 production. The two environments are isolated at credential and schema level.
- **An optional future legacy adapter / report** may be planned later if a specific historical question is worth answering. PR#17c does not approve or scope such an adapter.
- **No forced legacy migration in PR#17c.** Render legacy rows are not lifted into the Sprint 2 production DB.

---

## 13. Audit and verification posture

Planned categories of audit/verification proof, to be performed in a successor operator-runbook PR — **PR#17c does not execute any of these**:

- **Role discovery** — list of roles present in the production DB, expected to match the §6 role families.
- **Role membership check** — confirms which login roles are members of which groups, and confirms no app role inherits superuser.
- **Table privilege check** — confirms each role family's grants match §7's intended access boundaries.
- **Workspace/site row check** — confirms production workspace/site rows for the five live sites, with `buyerrecon.com` provisioned as the canary, mapping recorded.
- **Token metadata check** — confirms `site_write_tokens` exist for the live sites at metadata level only (e.g. count, label, workspace/site reference, revocation state). **Raw token values are never read for verification.**
- **Migration status check** — confirms the production DB is at the expected Sprint 2 canonical schema revision, with no drift.
- **Ledger write/read smoke** — performed *only* after the successor migration/operator runbook PR's approval, and *only* in coordination with the canary cutover (PR#17d). PR#17c does not approve smoke against production.
- **Forbidden-secrets scan** — automated scan over logs, observability surfaces, repo, and produced artefacts to verify that no secret material appears.
- **Staging / production confusion check** — confirms the production collector cannot reach staging DB or staging tokens and vice versa.

Each item above must produce a **proof artefact** (a recorded check outcome) in the successor PR. PR#17c does not include executable commands; it lists the categories and the expected artefact shapes only.

---

## 14. Track A implications

- **PR#17c does not run Track A.** It does not touch the Track A repo at `/Users/admin/github/ams-qa-behaviour-tests`.
- **Track A labels remain private run-log only.** `B_analytics_only`, low-dwell, refresh-loop, adversarial CTA, and any other Track A scenario label live in Helen's private run log only.
- **Production `site_write_tokens` must not encode Track A labels.** Token metadata (label, scope, etc.) must not include any QA/test/bot/synthetic/adversary marker, nor any reference to Track A scenarios.
- **Track A proof against the Sprint 2 production / canary collector waits for a later approved PR** (PR#17e in the recommended sequence).
- **First future Track A proof against the Sprint 2 collector remains unlabelled `B_analytics_only`** — single, narrow, gated, no label leakage anywhere in telemetry.

---

## 15. Output-gate implications

- **PR#17c does not create customer-facing output roles.** The customer/API read role family in §6 is conditional ("if later needed") and remains unscoped in PR#17c.
- **PR#17c does not expose Lane B, AMS Trust Core, the AMS runtime bridge, or any Pass 1 / Pass 2 output.** These remain future-gated (PR#17a §6.5, §8, §9).
- **Customer-safe output roles or views** require a later, explicit PR that comes *after* Pass 1 / Trust / Pass 2 are designed and approved. PR#17c does not pre-grant anything against such future surfaces.

---

## 16. Rollback and revocation posture

Planned rollback / revocation posture (planning only — PR#17c has no live state to revoke):

- **Token disablement / revocation.** The successor operator-runbook PR documents how to mark a `site_write_token` disabled/revoked, how to issue a replacement, and how to confirm that the disabled token no longer validates at the collector. Revocation must be possible per-site without affecting other sites.
- **Collector env rollback.** If a production env change (e.g. updating a token reference, switching pepper) regresses the collector, the operator can revert the env change via the chosen secret manager mechanism, and restart the collector against the prior env state.
- **DB access revocation.** If a role or role-credential is suspected of compromise, the operator can revoke that role's grants and/or rotate the role credential, and re-issue least-privilege access — without disturbing other roles.
- **Render fallback remains independent.** Token / role rollback inside Sprint 2 production does not affect the Render legacy collector or the Render legacy DB. If Sprint 2 production access is fully revoked, the ThinLayer endpoint reversion to Render legacy (PR#17b §14) restores capture.
- **Evidence gap report if rollback occurs.** If any rollback fires, the operator produces an evidence gap report covering: which sites/tokens/roles were affected, when, what symptoms triggered rollback, which collector handled what fraction of traffic during the window, what is in the Sprint 2 production DB vs Render legacy DB for that window, and what (if anything) might be re-considered later (planning notes only; no automatic re-ingestion).
- **No destructive rollback of evidence ledgers.** Rolling back tokens or roles does not delete `ingest_requests`, `accepted_events`, or `rejected_events` rows already written; the ledger remains intact for forensic and verification purposes.

---

## 17. Production readiness checklist

Items below must each be **approved** (in a successor PR, not in PR#17c) before any production DB, role, or token is created, and before any live site is cut:

- **Production DB identity approved** — placeholder identity in PR#17c is finalised in PR#17c's successor (operator runbook); name, host, credentials decided there.
- **Production DB separate from staging** — per §11 checks; demonstrably distinct DB name, host, credentials, roles, workspace/site rows, tokens.
- **Render legacy separation confirmed** — per §12; no cross-dependency at credential or schema level.
- **Role model approved** — per §6; role families, least-privilege intent, finalised grants come in the operator-runbook PR.
- **Table access boundaries approved** — per §7; the operator-runbook PR finalises the exact grant set against the surfaces present at that time.
- **Workspace/site mapping approved** — per §8; production workspace/site rows for the five live sites with `buyerrecon.com` as canary, mapping auditable.
- **`site_write_tokens` provisioning plan approved** — per §9; per-site tokens, server-side hash/metadata only in DB, rotation/revocation procedure documented.
- **Secret storage mechanism approved** — per §10; vault / encrypted env / platform secret store chosen, with no secrets in repo/chat.
- **Token rotation / revocation plan approved** — per §9 and §16; rotation cadence, revocation steps, rollback steps documented.
- **Migration posture approved** — per §5; ordered, auditable, proofed, reversible-where-applicable, no drift on the target DB.
- **Audit / verification proof plan approved** — per §13; each category produces a recorded proof artefact in the operator-runbook PR.
- **Track A label discipline confirmed** — per §14 and PR#17a §12 / PR#17b §13; labels never enter tokens, telemetry, URL, UTM, dataLayer, storage, backend payload, logs, GA4, or any report.
- **Output-gate restrictions confirmed** — per §15 and PR#17a §6.5 / §9; customer-facing automated output remains gated; Lane B / Trust Core / AMS runtime bridge / Pass 1 / Pass 2 are not exposed.
- **Rollback / revocation posture approved** — per §16; token disablement, env rollback, DB access revocation, Render fallback independence, evidence gap report, non-destructive ledger.

If any item above is unapproved, no production DB, role, or token is created, and no live site is cut.

---

## 18. What PR#17c explicitly does not approve

PR#17c explicitly does **not** approve any of the following:

- creating the production DB now,
- creating any DB role now,
- creating any `site_write_token` now,
- rotating any secret now,
- running any migration now,
- deploying the Sprint 2 production collector,
- changing DNS,
- changing any ThinLayer `endpointUrl` on any live site,
- touching the Render legacy backend or DB,
- touching the Hetzner production environment,
- using the staging DB as production,
- migrating Render legacy data into the Sprint 2 production DB,
- running Track A against any production endpoint,
- enabling customer-facing automated output,
- exposing AMS Trust Core output through BuyerRecon,
- implementing Pass 1 or Pass 2 governance.

These remain for explicitly-scoped successor PRs.

---

## 19. Recommended next PRs

PR#17c recommends the following successor PRs, each tightly scoped:

- **PR#17d — `buyerrecon.com` canary endpoint cutover runbook.** Per-site cutover runbook for the first canary site only: smoke sequence, observer proof, and rollback levers. Planning only; execution is gated on PR#17c's successor operator-runbook approval and host availability.
- **PR#17e — Track A unlabelled staging/canary proof plan.** Narrow unlabelled `B_analytics_only` proof against the Sprint 2 staging/canary collector, with full label-leakage discipline. Planning + (later) execution under existing Track A discipline.
- **PR#17f (or later) — Production migration / operator runbook.** The first PR that actually creates the production DB, applies migrations, creates roles, and provisions tokens — *only* after explicit approval. PR#17c does not authorise PR#17f's execution; PR#17f's own review approves that.
- **Later (separate PR sequences):**
  - Pass 1 eligibility planning,
  - AMS Shared Core Trust bridge planning (Trust Core output remains future-gated),
  - Pass 2 customer-safe projection planning,
  - customer-facing automated Evidence Review output planning — only after Pass 1 / Trust / Pass 2 are designed.

---

## 20. Acceptance criteria

PR#17c is accepted if and only if:

- exactly **one docs file** is added: `docs/sprint2-pr17c-production-db-role-token-plan.md`,
- the content is **planning only** — no DB connection, no DB creation, no role creation, no token creation, no secret rotation, no migration execution,
- **no resource is created** in any environment as part of this PR,
- **no secrets** (real or fake-but-credible) appear in the doc — no DB URLs, no tokens, no token hashes, no role passwords, no peppers, no private IPs, no certificate material,
- **production / staging separation is explicit** at DB identity, role, workspace/site, token, secret, log, and env-guard levels (§11),
- **Render legacy separation is explicit** — no cross-dependency at credential or schema level (§12),
- **role model is planned** in role families with least-privilege intent (§6),
- **token plan is safe** — per-site tokens, server-side hash/metadata only in DB, rotation/revocation procedure documented, no token values in doc (§9),
- **workspace/site mapping is planned** — production rows for the five live sites with `buyerrecon.com` as canary (§8),
- **no customer-facing automated output is approved** — Pass 1 / Trust / Pass 2 remain unimplemented and future-gated (§15),
- **no Track A execution is approved** — labels remain private run-log only (§14),
- **rollback / revocation posture is included** — token disablement, env rollback, DB access revocation, Render fallback independence, evidence gap report, non-destructive ledger (§16).

---

## 21. Stop-the-line conditions

Stop and re-plan if any of the following appears in PR#17c, in a successor PR claiming PR#17c approval, or in conversation around PR#17c:

- anyone proposes the **staging DB as production** (e.g. renaming, re-pointing, re-tagging `buyerrecon_staging`),
- anyone proposes the **Render legacy DB as the Sprint 2 canonical production DB**,
- **real secrets, tokens, token hashes, DB URLs, role passwords, peppers, private IPs, or credential-bearing env values** are written into this doc, the repo, or chat,
- **executable DB commands** (e.g. `CREATE ROLE`, `CREATE DATABASE`, `GRANT …`, `psql …`, migration runner invocations) are introduced into PR#17c,
- **role creation** is performed (in any environment, as part of PR#17c),
- **token creation** is performed (in any environment, as part of PR#17c),
- **migrations are run** (in any environment, as part of PR#17c),
- the **production host is touched** (Hetzner production or otherwise),
- **DNS is changed** as part of PR#17c,
- **Track A labels** appear in any token, telemetry, URL, UTM, dataLayer, storage, backend payload, logs, GA4, or report,
- **customer-facing automated output** is enabled (or its approval is requested) before Pass 1 / Trust / Pass 2 are implemented and proved,
- **durable Lane A/B writers** are implied or pre-granted against (Lane A/B remains read-only preview),
- the **rollback / revocation path is missing** for any planned role, token, or env category.

Stop-the-line means: do not create the DB, do not create roles, do not create tokens, do not rotate secrets, do not run migrations, do not deploy, do not cut. Return to planning.

---

End of PR#17c planning. Docs only.
