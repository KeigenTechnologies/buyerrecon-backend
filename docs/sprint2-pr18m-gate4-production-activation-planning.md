# BuyerRecon PR#18m — Gate 4 production activation planning after scoring/governance chain

Status: **docs-only planning record. Verdict: PLANNING ONLY — Gate 4 production activation planning. No execution, no production activation, no `endpointUrl` re-flip, no customer output, no Lane writer.**

PR#18m is the planning layer for **Gate 4** (production activation), opened after the scoring / governance contract chain is complete: PR#18c (observer) → PR#18e/PR#18i (Pass 1 v0.2) → PR#18j (Trust v0.1) → PR#18k (Pass 2 claim-governance v0.1) → PR#18l (Lane A/B output governance v0.1, PR #44 merged at `0e52fdc`). PR#18m defines the sub-gate structure, prerequisites, non-goals, safety rules, evidence-capture rules, stop-lines, and open decisions for Gate 4 — without authorising any execution, any production traffic, any `endpointUrl` re-flip, any website artefact / config mode flip, any production DB mutation, any production token provisioning, any DB grant change, any migration, any schema.sql change, any Track A invocation, any Playwright run, any customer-facing output, any Lane A/B writer, any dashboard implementation, any AMS runtime bridge, or any Pass 1 / Trust / Pass 2 / Lane runtime.

PR#18m is a **planning document only**. It introduces no implementation, no preflight script, no operator runbook, and no execution sequence beyond the planning sub-gate enumeration in §6. Gate 4 execution, Gate 4 preflight, and every fix PR that may emerge from Gate 4 preflight remain separately gated by their own explicit Helen GO, scoped to that specific work alone.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **PR#18m plans Gate 4 sub-gates; it does NOT execute or pre-authorise any of them.**
> **No production `endpointUrl` re-flip is approved by PR#18m.**
> **No production traffic, no buyerrecon.com production `/v1/event`, no Render `/collect` replacement is approved by PR#18m.**
> **No `/var/www` edit, no production DB mutation, no production token provisioning, no production secret exposure is approved by PR#18m.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18m; no production artefact / config mode flip is approved by PR#18m.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no dashboard, no AMS runtime bridge, no Pass 1 runtime, no Trust runtime, no Pass 2 runtime, no Lane governance runtime is approved by PR#18m.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config / DB grant changes are introduced by PR#18m.**
> **PR#18m is planning-layer only. It does NOT amend the Pass 1 v0.2 contract, the Trust v0.1 contract, the Pass 2 v0.1 contract, or the Lane governance v0.1 contract.** Any future Gate 4 sub-gate execution PR, future preflight PR, future fix PR, future final recap PR, future runtime PR, or future customer-surface PR remains separately gated by its own explicit Helen GO.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest: `0e52fdc` — "Sprint 2 PR#18l: plan Lane A/B output governance (#44)").

PR branch: `buyerrecon-sprint2-pr18m-gate4-production-activation-planning`

Mandatory reference compliance (read-only):

- `docs/sprint2-pr17a-production-cutover-output-gates-planning.md` — original production-cutover output-gates plan. PR#18m carries forward the §6 hard-rule posture and §11 sub-gate philosophy.
- `docs/sprint2-pr17b-production-collector-deployment-planning.md` — production collector deployment plan; not modified by PR#18m.
- `docs/sprint2-pr17c-production-db-role-token-plan.md` — production DB role / token posture baseline; PR#18m §4 prerequisites reference, not modified.
- `docs/sprint2-pr17d-buyerrecon-com-canary-cutover-runbook.md` — canary cutover runbook reference; PR#18m §6 Gate 4C derives canary scope philosophy without executing.
- `docs/sprint2-pr17e-track-a-unlabelled-staging-canary-proof-plan.md` — Track A staging canary plan baseline; PR#18m §6 Gate 4E references but does not invoke.
- `docs/sprint2-pr17f-production-migration-operator-runbook.md` and `docs/sprint2-pr17h-pr17f-production-migration-proof.md` — production-migration grant-safety posture; PR#18l §10.2 grant posture stands; PR#18m re-affirms.
- `docs/sprint2-pr17m-production-secret-recovery-rotation-runbook.md` — production secret recovery / rotation runbook; PR#18m §7 / §8 secret-safety rules reference; not modified.
- `docs/sprint2-pr17p-buyerrecon-com-thinlayer-endpoint-proof.md` and `docs/sprint2-pr17u-host-thinlayer-hash-crosscheck.md` — website ThinSDK / thinlayer artefact and hash baseline; PR#18m §6 Gate 4A / Gate 4B reference, not modified.
- `docs/sprint2-pr17x-gate2-controlled-fixture-dry-run.md` — Gate 2 closed proof.
- `docs/sprint2-pr17y-gate3-staging-replay-runbook.md` — Gate 3 staging runbook.
- `docs/sprint2-pr17z-gate3-execution-proof.md` — Gate 3 closed proof (execution evidence on staging).
- `docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md` — strategic chain.
- `docs/sprint2-pr18c-timing-product-context-observer.md` and `docs/sprint2-pr18d-timing-product-context-observer-proof.md` — observer code and staging proof; observer is implemented and merged but does NOT make Pass 1 / Trust / Pass 2 / Lane runtime active.
- `docs/sprint2-pr18e-pass1-output-contract-planning.md` and `docs/sprint2-pr18i-pass1-risk-evidence-amendment.md` — Pass 1 contract v0.2.
- `docs/sprint2-pr18j-trust-contract-planning.md` — Trust contract v0.1.
- `docs/sprint2-pr18k-pass2-claim-governance-planning.md` — Pass 2 claim-governance contract v0.1.
- `docs/sprint2-pr18l-lane-ab-output-governance-planning.md` — Lane A/B output governance contract v0.1.
- `docs/ops/cutover-hard-gates.md` — cutover hard-gates baseline; PR#18m §9 stop-lines reference, not modified.

---

## 1. Status / verdict

**PLANNING ONLY — Gate 4 production activation planning. No execution. No production activation. No `endpointUrl` re-flip. No customer output. No Lane writer.**

- PR#18m defines the *sub-gate structure* for Gate 4 (§6 Gate 4A → Gate 4E), the prerequisites (§4), the non-goals (§5), the safety rules (§7), the evidence-capture rules (§8), the stop-lines (§9), and the open decisions (§12).
- PR#18m does NOT execute any Gate 4 sub-gate, does NOT preflight Gate 4 against production, does NOT touch `/var/www`, does NOT change the production `endpointUrl`, does NOT invoke buyerrecon.com production `/v1/event`, does NOT replace Render `/collect`, does NOT provision production tokens, does NOT mutate production DB, does NOT alter DB grants, does NOT change migrations or schema.sql.
- PR#18m does NOT authorise any customer-facing surface. The Pass 1 v0.2 / Trust v0.1 / Pass 2 v0.1 / Lane governance v0.1 contracts all carry forward unchanged with their existing locks (`customer_claim_allowed = false`, `lane_output_allowed = false`, `customer_visibility_allowed = false`, `lane_write_allowed = false`, `allowed_customer_language = []`).
- PR#18m does NOT authorise any Lane A or Lane B writer. Migration 016 grant safety stands (see PR#18l §10.2 final-state record): `buyerrecon_scoring_worker` has no SELECT/INSERT/UPDATE/DELETE on either Lane table, `buyerrecon_customer_api` has no access, `buyerrecon_internal_readonly` is SELECT-only, `buyerrecon_migrator` is the only role with ALL.
- PR#18m does NOT authorise Track A or Playwright. Track A remains gated under PR#17e (or successor); no headless / programmatic browser run.
- PR#18m does NOT authorise any dashboard. PR#18a §10 forbids dashboard implementation in v1; PR#18m re-affirms.
- PR#18m does NOT pre-authorise the final scoring / governance recap PR (§11). The recap PR is itself separately gated by Helen GO after Gate 4 preflight and any issue-fix PRs are complete.

---

## 2. Why Gate 4 comes after scoring / governance contracts

Gate 4 sits **after** the scoring / governance contract chain because every Gate 4 sub-gate may produce evidence that downstream layers must consume safely. The sequencing:

| Gate / contract | Status | What it proved / locked | Why Gate 4 needs it first |
|---|---|---|---|
| Gate 1 | closed | One staging connectivity proof | Establishes that staging is reachable and the collector contract is testable. |
| Gate 2 (PR #30) | PASS / closed | One controlled staging fixture passes through the collector and lands a single accepted row | Establishes that the ingest path produces well-formed canonical rows on a labelled fixture. |
| Gate 3 (PR #32) | PASS / closed | Multi-fixture DB-backed collector behaviour on staging | Establishes that the staging collector behaves correctly on a labelled fixture matrix with cross-fixture isolation. |
| Timing / Product-Context observer (PR#18c / PR#18g) | implemented and staged | Read-only categorical observer on `risk_observations_v0_1` / POI tables produces source-health labels | Establishes that observer-layer reads are categorical, read-only, schema-guarded, and synthetic-excluded. |
| Pass 1 contract v0.2 (PR#18e / PR#18i) | planned | Categorical Pass 1 preview interpretation contract with 4-state `risk_evidence_status` enum | Locks the upstream input shape for Trust. |
| Trust contract v0.1 (PR#18j) | planned | Categorical Trust reliability contract with 6 dimensions and 9-value `trust_summary` enum | Locks the upstream input shape for Pass 2. |
| Pass 2 claim-governance contract v0.1 (PR#18k) | planned | Categorical claim-governance contract with closed 6-value `claim_governance_status` enum, denylist + empty allowlist | Locks the upstream input shape for Lane governance. |
| Lane A/B output governance contract v0.1 (PR#18l) | planned | Categorical Lane preview / write governance contract with closed 5-value `lane_preview_decision` enum, four locks at false / empty | Locks the upstream input shape for any future Lane writer + customer surface. |
| **Gate 4 (PR#18m)** | **planned, not executed** | **Sub-gate structure for production activation** | **Gate 4 must plan against the locked governance chain so its evidence-capture rules and stop-lines align with the contract enums.** |

Gate 4 can now be **planned**, but **not executed**. Gate 4 execution requires:

- This planning PR to be merged.
- An explicit Helen GO scoped to each Gate 4 sub-gate's execution PR (separately gated, one sub-gate per execution PR).
- Any issue-fix PRs surfaced by Gate 4 preflight to be merged before the next sub-gate proceeds.

After Gate 4 implementation / preflight is complete and any issue-fix PRs are merged, a **final scoring / governance recap PR** (§11) must summarise the full chain before production cutover is treated as ready. The recap PR is itself separately gated.

---

## 3. Gate 4 purpose

Gate 4 will eventually plan production website / ThinSDK activation and the collector cutover from Render `/collect` (the current legacy production target) to buyerrecon.com production `/v1/event` (the Sprint 2 target). Gate 4 planning should cover, in **separate** sub-gate PRs (§6):

- **Website ThinSDK artifact / config posture** — current artefact hash, current `mode` value, current `endpointUrl` value, no-deploy bundle check.
- **`endpointUrl` re-flip plan** — categorical evidence rules + rollback plan + stop-lines for the moment of flip.
- **Production `/v1/event` target** — host, path, TLS posture, latency posture, error-class expectations — described categorically only.
- **Render `/collect` replacement decision** — when (if ever) to retire the legacy target, whether to dual-write, whether to drain.
- **Canary scope** — tiny initial canary (single workspace / site, time-boxed, rollback-ready), explicit traffic threshold rules.
- **Rollback plan** — pre-staged rollback artefact bundle, exact rollback commands, rollback owner, rollback acceptance criteria.
- **Monitoring plan** — categorical observability surfaces (HTTP status class, row deltas, DB counts, lane counts), explicit no-secret-exposure rule.
- **Secret / token / DSN safety** — production token provisioning posture (planned, not executed by PR#18m), DSN handling rules, Authorization header handling rules.
- **Production DB / role sanity** — production DB and role existence verification (read-only checks), no mutation, grant-safety carry-forward from PR#17f / PR#17q / migration 016.
- **Evidence capture rules** (see §8).
- **Stop-lines** (see §9).

**PR#18m does not execute any of these.** Every bullet above is described categorically as an *eventual* Gate 4 planning concern. Each will require its own execution-scope PR.

---

## 4. Gate 4 prerequisites

Gate 4 sub-gate execution may proceed only after all of the following are confirmed:

| Prerequisite | Source | Status |
|---|---|---|
| Gate 2 PASS | PR#17x / PR #30 | closed |
| Gate 3 PASS | PR#17z / PR #32 | closed |
| Timing / Product-Context observer staged and proved | PR#18c (code), PR#18d (proof), PR#18g (risk fix), PR#18h (re-proof) | merged |
| Pass 1 contract v0.2 | PR#18e / PR#18i | merged |
| Trust contract v0.1 | PR#18j | merged |
| Pass 2 claim-governance contract v0.1 | PR#18k | merged |
| Lane A/B output governance contract v0.1 | PR#18l (with §10.2 grant-posture wording fix) | merged |
| Production DB and roles exist (read-only confirmation) | PR#17c production DB role / token plan | reference baseline; verify at Gate 4A time |
| Production token / pepper / DSN runbook confirmed | PR#17m production secret recovery / rotation runbook | reference baseline; verify at Gate 4A time |
| Website artefact / ThinSDK state confirmed (current hash + mode + endpointUrl) | PR#17p thinlayer endpoint proof + PR#17u host thinlayer hash crosscheck | reference baselines; re-verify at Gate 4A time (hash may have drifted) |
| Rollback path known and pre-staged | PR#17d canary cutover runbook | reference baseline; pre-stage at Gate 4C time |
| Explicit Helen GO before any execution | Conversation gate per sub-gate | required before each Gate 4 sub-gate execution PR |

If any prerequisite fails verification at Gate 4A time, Gate 4 execution does **not** proceed; the prerequisite gap is captured as a stop-line (§9) and addressed in a separate issue-fix PR before the next sub-gate is attempted.

---

## 5. Gate 4 non-goals

PR#18m explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **No production traffic** of any kind. No `curl` / browser / synthetic generator against buyerrecon.com production `/v1/event`. No new traffic to Render `/collect`.
- **No `endpointUrl` re-flip.** The website's `endpointUrl` value remains whatever it currently is (Render legacy target per PR#17p baseline). PR#18m does not change it.
- **No `/var/www` edit.** No website artefact change. No production config edit.
- **No Render `/collect` replacement.** The legacy target stays as-is.
- **No Track A.** Track A remains gated under PR#17e (or successor). No Track A staging canary, no Track A production proof.
- **No Playwright.** No headless / programmatic browser run.
- **No customer-facing output.** All four governance locks carry forward unchanged.
- **No Lane writer.** No INSERT/UPDATE/DELETE against `public.scoring_output_lane_a` or `public.scoring_output_lane_b`. Migration 016 grant safety stands.
- **No Pass 1 runtime.** No Pass 1 code path activation.
- **No Trust runtime.** No Trust code path activation.
- **No Pass 2 runtime.** No Pass 2 code path activation.
- **No Lane governance runtime.** No Lane governance code path activation.
- **No dashboard.** PR#18a §10 forbids in v1; PR#18m re-affirms.
- **No DB grant change.** PR#17f / PR#17q / migration 016 grant safety stands.
- **No production secret exposure.** No raw token, token hash, token prefix / suffix, token length, token_id, pepper, DSN, Authorization header value, certificate body, private key, env dump, vault content, or shell-history extract appears in any Gate 4 planning, preflight, or execution artefact.
- **No production artefact / config mode flip.** No `mode: 'sprint2_v1_event'` activation in any production website init.
- **No migrations.** No new file under `migrations/`. No `schema.sql` edit.
- **No code / scripts / tests / package / env / systemd / Nginx / AMS source / website artefact / production config changes.**
- **No AMS runtime bridge.** AMS canonical contracts remain reference-only per PR#18b §4.1.1 dirty-worktree rule.

---

## 6. Proposed Gate 4 sub-gates

Gate 4 is **not one jump**. It is decomposed into five sub-gates. Each sub-gate is its own separately-gated PR. PR#18m only *names and scopes* the sub-gates; it does not open or execute any of them.

### 6.1 Gate 4A — production-readiness audit planning

**Scope:** read-only verification that production is in the expected baseline state before any Gate 4 work proceeds.

Planning items:

- Confirm the current website ThinSDK artefact hash (per PR#17u host thinlayer hash crosscheck baseline) and any drift.
- Confirm the current website `mode` value (expected: pre-Sprint-2 / legacy / non-`sprint2_v1_event`).
- Confirm the current `endpointUrl` value remains the Render legacy target (no Sprint 2 production flip has occurred).
- Confirm no production Sprint 2 traffic has occurred yet (categorical row count on production tables that Sprint 2 writes would touch — expected: 0).
- Confirm the rollback artefact bundle is present, hash-checked, and accessible (no execution, just presence verification).
- Confirm the rollback owner is known and the rollback command source is documented.
- Confirm production DB and roles exist (read-only `pg_roles` / `information_schema` checks).
- Confirm `buyerrecon_customer_api`, `buyerrecon_scoring_worker`, `buyerrecon_internal_readonly`, `buyerrecon_migrator` are in the migration 016 final-state grant posture (read-only `has_table_privilege` checks).
- Confirm Pass 1 / Trust / Pass 2 / Lane governance contracts are merged (planning-only) and not yet runtime-active.
- Confirm production DSN / token / pepper runbook (PR#17m) is current and accessible; do **not** print any secret value.

**Gate 4A produces:** a categorical audit report (separate execution-scope PR). No mutation. No traffic.

### 6.2 Gate 4B — website artefact / config bundle planning

**Scope:** plan the exact website artefact files and configuration changes that *would* be required to flip the website to the Sprint 2 collector path. **No deploy.**

Planning items:

- Define the exact artefact file(s) that must change (path list, expected current hash, expected post-flip hash).
- Define the expected hash capture mechanism (read-only file digest tooling).
- Define a **no-deploy bundle check**: stage the post-flip artefact bundle in a non-production location and verify its shape categorically without serving it.
- Define the post-flip `mode` value, post-flip `endpointUrl` value, and any required ThinSDK schema bump (categorical only).
- Define the rollback artefact bundle (pre-flip artefact, hash-checked, ready to swap in atomically).
- Define the cache / CDN posture (categorical: invalidation strategy, edge propagation expectations).

**No `/var/www` write in PR#18m or in the Gate 4B planning PR.** Gate 4B planning describes the bundle; a separate Gate 4B execution PR would, if approved, write it — but the no-deploy bundle check produces only categorical evidence (file shape, hash, mode value), never customer traffic.

### 6.3 Gate 4C — controlled canary activation planning

**Scope:** plan the smallest possible canary activation of the Sprint 2 collector path against real production traffic, with explicit rollback preconditions.

Planning items:

- Define the tiny canary scope: single workspace + single site + time-boxed window + traffic-class allowlist + rollback-ready.
- Define the `endpointUrl` re-flip preconditions:
  - Gate 4A audit PASS, all read-only checks green.
  - Gate 4B no-deploy bundle check PASS.
  - Rollback artefact bundle staged and hash-verified.
  - Production token / DSN / pepper rotation runbook (PR#17m) re-confirmed within the last N days (N defined by Gate 4C planning PR).
  - One operator shell per execution phase (no parallel shells, no shared session).
  - Helen GO scoped to Gate 4C execution.
- Define the production token / role safety rules:
  - No raw production token printed.
  - No production Authorization header value printed.
  - All grant checks via `has_table_privilege` (categorical Y/N).
  - Migration 016 §6 invariants re-verified before and after the canary window.
- Define the rollback commands (one-shot, idempotent, rollback-first posture).
- Define the canary acceptance criteria (categorical: HTTP status class distribution, row delta on accepted_events, no Lane A/B row created, no customer output emitted).

**No execution in PR#18m or in the Gate 4C planning PR.** A separate Gate 4C execution PR would, if approved, perform the canary — and only with the rollback-first posture, the secret-safety rules (§7), and the evidence-capture rules (§8) intact.

### 6.4 Gate 4D — organic observation planning

**Scope:** plan an observation window after Gate 4C closes successfully, during which production behaves with the Sprint 2 collector path active but without any customer-facing surface.

Planning items:

- Define the observation window length and trigger conditions.
- Define the evidence to capture: row deltas, HTTP status class distribution, source-health observer output (categorical), DB lane counts (expected: 0/0 unless later approved), categorical endpoint health.
- Define the **no customer output** rule explicitly: throughout Gate 4D, `customer_claim_allowed = false`, `lane_output_allowed = false`, `customer_visibility_allowed = false`, `lane_write_allowed = false`, `allowed_customer_language = []` all stand.
- Define stop-lines (§9 mirror at Gate 4D scope) — including: unexpected lane row creation, customer output appearing, source-health observer regression, production DSN/token shape changes mid-window.
- Define the close-out criteria for Gate 4D (categorical PASS / non-PASS with categorical reason codes).

**Gate 4D does not by itself approve any customer-facing surface or Lane writer.** Those remain separately gated by their own future PRs.

### 6.5 Gate 4E — Track A / Playwright planning (separate)

**Scope:** Track A and Playwright are explicitly **separate** from Gate 4A → Gate 4D.

- Track A remains gated under PR#17e (or successor); PR#18m does NOT pre-authorise Track A staging canary, Track A production proof, or any Track A integration.
- Playwright remains separate and later; PR#18m does NOT pre-authorise any headless / programmatic browser run.
- A future Gate 4F (or successor name) PR may plan Track A / Playwright integration, separately gated by its own Helen GO. **OD-5 (§12) is open**: whether Track A gets its own Gate 4F or remains under PR#17e successor naming is unresolved.

**No Track A or Playwright in any Gate 4A → Gate 4D PR.** Their planning is deferred to a future, separately-gated PR.

---

## 7. Production activation safety rules

Every Gate 4 sub-gate execution PR (and every fix PR that emerges from Gate 4 preflight) MUST observe the following safety rules. PR#18m re-affirms these rules without authorising any execution.

- **Explicit Helen GO required for each sub-gate.** Helen GO for Gate 4A does not imply Gate 4B; Gate 4B does not imply Gate 4C; etc. Each sub-gate execution PR receives its own scoped GO.
- **One operator shell per execution phase.** No parallel shells. No shared session. The operator command sequence is single-threaded within each Gate 4 sub-gate execution.
- **No raw secrets printed.** No raw production token, token hash value, token prefix or suffix, token length value, token_id, pepper, DSN, Authorization header value, certificate body, private key, env dump, vault content, or shell-history extract appears in any Gate 4 artefact (planning doc, preflight script, execution proof, fix PR, recap PR).
- **No raw request_id UUID values.** Categorical row-count and HTTP-status-class evidence only; no UUID-shaped identifiers reproduced.
- **No raw payloads.** No request body, response body, canonical_jsonb, or accepted_event.raw bytes reproduced.
- **No full URLs with query strings.** Categorical referrer-class only (if needed); never a full query string.
- **No env dumps.** No `printenv`, `env`, or `cat .env` output captured.
- **No shell history.** No `history`, `~/.bash_history`, or `~/.zsh_history` capture.
- **No customer output.** All four governance locks stand throughout Gate 4.
- **No Lane writer.** Migration 016 grant safety stands; no INSERT / UPDATE / DELETE against `public.scoring_output_lane_a` or `public.scoring_output_lane_b`.
- **Rollback-first posture.** Every Gate 4 sub-gate execution PR stages the rollback before staging the forward action. Rollback acceptance criteria are defined before the forward action executes. If the rollback artefact bundle is unstaged, hash-mismatched, or inaccessible, Gate 4 does NOT proceed.

---

## 8. Evidence capture rules

Every Gate 4 sub-gate execution PR captures categorical evidence only. The allowlist / denylist below is **binding** across every Gate 4 sub-gate planning PR, preflight PR, execution proof PR, and fix PR.

### 8.1 Allowed evidence (categorical only)

- **Categorical endpoint checks** — Y/N reachability against a known endpoint URL; HTTP status class (`2xx`, `3xx`, `4xx`, `5xx`) only; no body capture.
- **File hash / artefact hash** — SHA-256 or equivalent digest of a website artefact, the rollback bundle, or a configuration file (categorical comparison against expected hash).
- **`endpointUrl` category** — `'render-legacy'` / `'buyerrecon-production-v1-event'` / `'staging'` / `'unknown'` — never the full URL string; never the secret query parameter (if any).
- **HTTP status class** — `2xx` / `3xx` / `4xx` / `5xx` only; never the full response body.
- **Row deltas** — integer counts of rows in production tables before and after a Gate 4 sub-gate window (e.g., `accepted_events.count` delta). Never the row contents.
- **DB counts** — integer counts categorically (e.g., `scoring_output_lane_a.count = 0`, `scoring_output_lane_b.count = 0`). Never row contents.
- **Lane counts 0/0** unless later approved — Lane A and Lane B row counts MUST remain `0/0` through Gate 4A → Gate 4D unless a future Lane writer PR has been separately approved (which PR#18m does NOT authorise).
- **Boundary affirmations** — categorical confirmation that no `/var/www` was written, no migration applied, no DB grant changed, no AMS file modified, no production token mutated, no Render `/collect` replaced.
- **Cleanup yes/no** — categorical confirmation that any staging artefacts created by a sub-gate were cleaned up afterward.

### 8.2 Forbidden evidence (binding denylist)

The following MUST NEVER appear in any Gate 4 artefact:

- **Production token** (raw bytes or shell-quoted form).
- **Token hash** (the `token_hash` column value, even if hashed — categorical "hash-present-or-absent" is acceptable; the value is not).
- **Token prefix / suffix / length value** — any partial token form, including the first or last N characters and the integer length of the token string.
- **`token_id`** — the database row identifier of a token row, even if a UUID.
- **Pepper** — the `SITE_WRITE_TOKEN_PEPPER` value (or any equivalent).
- **DSN** — the database connection string in any form (host, port, db, user, password, query parameters).
- **Authorization header value** — the full `Authorization: Bearer <…>` string or the `<…>` portion alone.
- **Raw `request_id` UUID value** — the UUID value generated by the observer for grouping.
- **Raw payload** — request body, response body, canonical_jsonb, accepted_event.raw bytes.
- **Raw response body** — full HTTP response body bytes.
- **Full URL query string** — including any token, signature, session identifier, or referrer query parameters.
- **Customer data** — any data that originated from a real customer session, even if redacted, unless a future customer-surface PR has explicitly authorised the redaction.
- **Private key / certificate body** — any `-----BEGIN PRIVATE KEY-----` / `-----BEGIN CERTIFICATE-----` block, including TLS certs in chain form.
- **Env dump / vault content / shell history** — `printenv`, `env`, `cat .env`, vault secret read output, or `~/.bash_history` / `~/.zsh_history` extracts.

---

## 9. Stop-lines

Every Gate 4 sub-gate execution PR (and every fix PR) MUST stop and report — without proceeding to the next action — if any of the following stop-lines fires. PR#18m enumerates the stop-lines; it does NOT execute any check.

- **`endpointUrl` points to an unexpected production target.** Expected at Gate 4A: Render legacy. Expected post-Gate-4C (if approved): `buyerrecon-production-v1-event` category. Any other value → stop.
- **Render `/collect` is called unexpectedly.** If a Gate 4 sub-gate observes traffic to `/collect` outside the categorical expected window (e.g., during a Gate 4D no-traffic observation), → stop.
- **Production DSN / token / pepper shape is unsafe.** If a `has_table_privilege` check, a role-presence check, or a DSN-shape check reveals an unexpected privilege, role, or DSN form (e.g., `DATABASE_URL` lacking `sslmode=` when expected) → stop.
- **Raw secret printed.** If any operator shell output contains any item from the §8.2 denylist → stop, redact, rotate (per PR#17m runbook), and re-open the affected sub-gate with a new Helen GO.
- **`/var/www` differs unexpectedly.** If a Gate 4 sub-gate observes `/var/www` content that does not match the expected artefact hash (pre-flip or post-flip, as appropriate) → stop.
- **Unknown website artefact hash.** If the categorical hash check against the PR#17u baseline (or the Gate 4B post-flip expected hash) returns an unrecognised value → stop.
- **DB row deltas unexpected.** If `accepted_events.count` delta, or any other monitored row count, deviates from the categorical expectation for the sub-gate window → stop.
- **Lane A/B rows created unexpectedly.** Any non-zero count on `scoring_output_lane_a` or `scoring_output_lane_b` during Gate 4A → Gate 4D → stop. Migration 016 grant safety should prevent this at the DB layer, but the categorical check is the second line of defence.
- **Customer output appears.** Any sign that a customer-facing surface emitted text, a score, a Lane A row, or any rendered evidence beyond the locked four-flag posture → stop.
- **Track A / Playwright starts accidentally.** Any process tree, log, or evidence that Track A code or a Playwright headless browser has started outside its explicitly scoped (future) PR → stop.
- **5xx or auth failure during canary.** During Gate 4C, any sustained 5xx pattern or auth failure pattern against buyerrecon.com production `/v1/event` → stop, roll back, capture categorical evidence.
- **Rollback not available.** If at any point the rollback artefact bundle becomes unstaged, hash-mismatched, or inaccessible → stop. Gate 4 does NOT proceed without a verified rollback.

---

## 10. Relationship to scoring / governance chain

Gate 4 MUST NOT bypass the scoring / governance chain. The categorical relationship:

- **Observer (PR#18c / PR#18g):** the read-only Timing / Product-Context observer is implemented and merged. Gate 4 sub-gates may observe its existing categorical output during preflight or observation windows, but Gate 4 does NOT implement Pass 1 / Trust / Pass 2 / Lane runtime.
- **Pass 1 contract v0.2 (PR#18e / PR#18i):** the contract is locked. Gate 4 does NOT activate Pass 1 runtime. Any future Pass 1 runtime PR is separately gated.
- **Trust contract v0.1 (PR#18j):** the contract is locked. Gate 4 does NOT activate Trust runtime.
- **Pass 2 claim-governance contract v0.1 (PR#18k):** the contract is locked, with `customer_claim_allowed = false`, `lane_output_allowed = false`, `allowed_customer_language = []`. Gate 4 does NOT lift these locks. Gate 4 does NOT activate Pass 2 runtime.
- **Lane A/B output governance contract v0.1 (PR#18l):** the contract is locked, with `customer_visibility_allowed = false`, `lane_write_allowed = false`, `customer_claim_allowed = false`, `allowed_customer_language = []`. Gate 4 does NOT lift these locks. Gate 4 does NOT activate Lane governance runtime.
- **Migration 016 grant safety:** stands as recorded in PR#18l §10.2 (final state). Gate 4 does NOT alter `buyerrecon_scoring_worker`, `buyerrecon_customer_api`, `buyerrecon_internal_readonly`, or `buyerrecon_migrator` grants.
- **AMS reference-only posture:** AMS canonical contracts remain reference-only per PR#18b §4.1.1 dirty-worktree rule. Gate 4 does NOT modify the AMS repository, does NOT call AMS at runtime, and does NOT consume AMS dirty-worktree shapes contractually.

Gate 4 planning **does not implement these runtimes**. Gate 4 plans the website / ThinSDK / collector cutover path that *would* eventually carry traffic into the existing observer (and, separately gated, into future Pass 1 / Trust / Pass 2 / Lane runtimes). The scoring / governance chain remains planning-layer throughout Gate 4A → Gate 4D.

---

## 11. Final recap PR requirement

After Gate 4 implementation / preflight is complete **and** any issue-fix PRs surfaced by Gate 4 preflight are merged, a **final scoring / governance recap PR** MUST be opened before production cutover is treated as ready. PR#18m mandates this recap; it does NOT open it.

The recap PR is itself separately gated by Helen GO. It is a planning-and-summary docs-only PR (no runtime, no execution). The recap PR MUST summarise:

- **Gate 2 / Gate 3 proofs.** Final closed-state references (PR#17x / PR #30 for Gate 2; PR#17z / PR #32 for Gate 3).
- **Timing / Product-Context observer status.** PR#18c (code), PR#18d (proof), PR#18g (risk fix), PR#18h (re-proof) — final merged state, including any further fixes that emerged from Gate 4 preflight.
- **Pass 1 / Trust / Pass 2 / Lane governance contracts.** Final contract versions, contract locks, and any amendments that emerged from Gate 4 preflight (e.g., Pass 1 v0.2 → v0.3 if a regression was found).
- **Gate 4 findings.** Per-sub-gate categorical PASS / non-PASS, with categorical reason codes for any non-PASS, and references to the issue-fix PRs that addressed them.
- **Unresolved warnings / blockers.** Any non-PASS that has been deferred (with reason code), any open decision that remains unresolved, any future-gated PR that the recap depends on.
- **Production cutover readiness.** Categorical Y/N per readiness dimension (website artefact / config posture, `endpointUrl` re-flip readiness, production DB / role posture, rollback artefact staging, monitoring / observability posture, secret / token / DSN posture).
- **Explicit remaining non-approvals.** Re-affirm every lock, every non-goal, every deferred future PR. The recap PR does NOT itself approve customer-facing surface, Lane writer, dashboard, Track A, Playwright, or any production runtime path; those remain separately gated.

The recap PR's existence is a **hard prerequisite** for any subsequent production-cutover PR. PR#18m does NOT open or pre-authorise the recap PR; it only mandates that the recap be the gate before cutover is treated as ready.

---

## 12. Open decisions

The following decisions are **open** at PR#18m's close. Each future Gate 4 sub-gate PR may resolve one or more; resolution requires Helen GO scoped to that decision.

- **OD-1: Exact Gate 4A → Gate 4E naming / sequencing.** The naming in §6 is proposed; an alternative scheme (e.g., Gate 4-Audit, Gate 4-Bundle, Gate 4-Canary, Gate 4-Observation, Gate 4-Track-A) or a different sequencing (e.g., Gate 4B before Gate 4A) is open. The current proposal: Gate 4A (audit) → Gate 4B (artefact / config) → Gate 4C (canary) → Gate 4D (observation) → Gate 4E (Track A / Playwright, separate).
- **OD-2: Whether Gate 4B artefact check should be no-deploy first.** Current proposal: yes — Gate 4B planning PR is no-deploy; a separate Gate 4B execution PR would write the artefact only after the no-deploy bundle check passes. An alternative: collapse the no-deploy check into Gate 4A. Open.
- **OD-3: Canary scope and traffic threshold.** Single workspace + single site + time-boxed + traffic-class allowlist is the floor. The specific values (workspace_id category, site_id category, time-window length, traffic-class allowlist) are open for the Gate 4C planning PR to resolve.
- **OD-4: Rollback owner and command source.** The rollback owner (Helen vs. a designated operator) and the rollback command source (pre-staged in the rollback artefact bundle vs. derived at execution time from a runbook) are open. PR#17d canary cutover runbook is the reference baseline.
- **OD-5: Whether Track A gets its own separate Gate 4F.** Current proposal: Track A remains under PR#17e (or successor) and a future Gate 4F (or differently-named PR) plans Track A integration separately from Gate 4A → Gate 4D. An alternative: keep Track A entirely outside the Gate 4 naming and treat it as its own gate family. Open.
- **OD-6: Whether final recap PR happens before or after Gate 4C canary.** Current proposal: after Gate 4D close and after all issue-fix PRs. An alternative: a partial recap PR after Gate 4A + 4B (pre-canary), then a final recap PR after Gate 4D. Open.
- **OD-7: What evidence is required before `endpointUrl` re-flip.** The Gate 4C preconditions (§6.3) are a floor; the specific evidence-set required at the moment of flip (e.g., Gate 4A audit categorical PASS within N hours of the flip, Gate 4B no-deploy bundle check PASS within N hours of the flip, rollback artefact hash-verified within N hours of the flip) is open for the Gate 4C planning PR to resolve.

---

## 13. Acceptance criteria

- **Docs-only.** Exactly one new file under `docs/`: this planning record (`docs/sprint2-pr18m-gate4-production-activation-planning.md`). No other files touched.
- **Gate 4 planning only.** PR#18m does NOT execute any sub-gate, does NOT preflight Gate 4 against production, does NOT change website artefacts, does NOT touch `/var/www`, does NOT alter the `endpointUrl`, does NOT replace Render `/collect`, does NOT provision production tokens, does NOT mutate production DB, does NOT change DB grants, does NOT introduce migrations or schema.sql changes.
- **Sub-gates defined.** §6 enumerates five sub-gates (Gate 4A audit, Gate 4B artefact / config, Gate 4C canary, Gate 4D observation, Gate 4E Track A / Playwright separate) with categorical scopes and explicit "no execution" markers.
- **Stop-lines clear.** §9 enumerates twelve categorical stop-lines covering `endpointUrl` drift, unexpected Render `/collect` calls, unsafe DSN / token / pepper shape, raw-secret-print, `/var/www` drift, unknown artefact hash, unexpected row deltas, unexpected Lane row creation, customer output appearance, accidental Track A / Playwright start, sustained 5xx / auth failure during canary, and rollback unavailability.
- **Evidence rules clear.** §8 enumerates the allowed categorical evidence (endpoint checks, file hashes, `endpointUrl` category, HTTP status class, row deltas, DB counts, lane counts, boundary affirmations, cleanup confirmation) and the binding denylist (production token, token hash, token prefix/suffix, token length, token_id, pepper, DSN, Authorization header, raw request_id UUID, raw payload, raw response body, full URL query string, customer data, private key / certificate body, env dump / vault content / shell history).
- **Final recap PR required.** §11 mandates the final scoring / governance recap PR as a hard prerequisite before any production-cutover PR is treated as ready.
- **No production activation.** §1, §3, §5, §10, §13 all assert PR#18m does not activate production.
- **No customer output.** All four governance locks (`customer_claim_allowed = false`, `lane_output_allowed = false`, `customer_visibility_allowed = false`, `lane_write_allowed = false`, `allowed_customer_language = []`) carry forward unchanged.
- **No Lane writer.** Migration 016 grant safety stands; §10 re-affirms.
- **No runtime scoring.** Pass 1 / Trust / Pass 2 / Lane governance contracts remain planning-only; §10 re-affirms.
- **No secrets.** No raw token / token_hash value / token prefix / suffix / length value / token_id / pepper / DSN / Authorization header value / `request_id` UUID literal / raw request body / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this doc.

---

End of PR#18m. **Verdict: PLANNING ONLY — Gate 4 production activation planning. Sub-gates (§6 Gate 4A audit, Gate 4B artefact / config, Gate 4C canary, Gate 4D observation, Gate 4E Track A / Playwright separate) are scoped categorically with explicit "no execution" markers. Prerequisites (§4), non-goals (§5), safety rules (§7), evidence-capture rules (§8 allowlist + binding denylist), stop-lines (§9 twelve categorical stop conditions), relationship to the scoring / governance chain (§10), final scoring / governance recap PR requirement (§11), and seven open decisions (§12 OD-1 through OD-7) are documented. No Gate 4 execution, no `endpointUrl` re-flip, no buyerrecon.com production `/v1/event` traffic, no Render `/collect` replacement, no `/var/www` edit, no production DB mutation, no production token provisioning, no production secret exposure, no DB grant change, no migration, no schema.sql change, no Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no dashboard implementation, no AMS runtime bridge, no AMS repo modification, no Pass 1 runtime, no Trust runtime, no Pass 2 runtime, no Lane governance runtime, no website ThinSDK production activation, no production artefact / config mode flip, no code / scripts / tests / package / env / systemd / Nginx / AMS source / website artefact / production config changes are approved or introduced by PR#18m. Pass 1 contract v0.2, Trust contract v0.1, Pass 2 claim-governance contract v0.1, and Lane A/B output governance contract v0.1 carry forward unchanged with all four locks (`customer_claim_allowed = false`, `lane_output_allowed = false`, `customer_visibility_allowed = false`, `lane_write_allowed = false`, `allowed_customer_language = []`) intact. Migration 016 grant safety stands (PR#18l §10.2 final-state record). Any future Gate 4 sub-gate execution PR, future preflight PR, future fix PR, future final recap PR, future runtime PR, or future customer-surface PR remains separately gated by its own explicit Helen GO.**
