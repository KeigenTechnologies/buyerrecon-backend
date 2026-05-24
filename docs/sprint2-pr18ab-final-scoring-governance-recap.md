# Sprint 2 PR#18ab: Final Scoring / Governance Recap Before Gate 4C

> Docs-only governance recap. No production command is executed by
> this PR. No `endpointUrl` re-flip. No Gate 4C approval. No canary.
> No production traffic generation. No `/var/www` edit. No website
> ThinSDK production activation. No production artifact / config mode
> flip. No DB write, no DB grant, no migration, no `schema.sql`
> change. No Nginx reload. No `systemctl`. No DNS change. No Track A.
> No Playwright. No customer output. No Lane writer activation. No
> runtime scoring. No AMS Trust runtime activation. No Pass 1 runtime
> activation. No Pass 2 runtime activation. No customer-facing
> dashboard / report / claim activation. No secrets.

---

## 1. Status / verdict

**Verdict: GOVERNANCE_RECAP_ONLY — no production execution, no Gate 4C approval.**

PR#18ab is the **final scoring / governance recap** required by the
Gate 4 chain (cutover-hard-gates §9, PR#18m §11, PR#18w §12, PR#18x
§9, PR#18y §12, PR#18z §11, PR#18aa §9). Its purpose is to record,
in one place, before any Gate 4C planning / canary work is opened,
the categorical separation between **infrastructure readiness** (what
the merged Gate 4A / Gate 4B evidence chain proves) and
**customer-facing scoring / output readiness** (which is **not**
proven by that chain and which remains separately locked here).

PR#18ab does **not** approve Gate 4C, Gate 4D, Gate 4E, any
production execution, any `endpointUrl` re-flip, any canary, any
production traffic, any DB write, any Nginx / systemd / DNS change,
any Lane writer, any customer-facing output, any AMS Trust / Pass 1
/ Pass 2 runtime, any dashboard / report / claim, or any commercial
language upgrade.

Anchored governance phrases (carried verbatim from
`docs/ops/cutover-hard-gates.md` §7):

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Why this recap exists

Gate 4B artifact / config / rollback re-audit closed `non-BLOCKED`
in PR#18aa / PR #59. Before any Gate 4C `endpointUrl` re-flip /
canary planning PR is opened — let alone executed — governance must
define, in one place, what is permitted and what is forbidden. The
recap exists to:

1. **Prevent infrastructure-vs-output confusion.** Gate 4A / Gate 4B
   readiness means production DB / grant / artifact / config /
   rollback posture is controlled enough to *consider* a future
   Gate 4C canary. It does **not** mean customer-facing scoring or
   output is approved, that Lane A/B writers may run, that AMS
   Trust / Pass 1 / Pass 2 runtime is approved, or that commercial
   / customer-facing claims may upgrade.
2. **Lock scoring / output governance categorically.** Section §9
   records explicit `*_allowed=false` locks for every
   customer-facing surface and every scoring / runtime path. The
   locks remain in force unless a later explicit governance PR
   changes them.
3. **Carry historical evidence forward.** The 26 historical PR#17s
   `request_body_invalid_json` `/v1/event` ingest rows from
   `2026-05-19` must continue to be preserved as evidence (no
   delete, no mutate, no annotate, no normalise away). Gate 4C
   canary success must be measured as a **delta from that 26-row
   baseline**, not as an absolute count.
4. **Define the Gate 4C planning surface.** Section §13 enumerates
   the fields a future Gate 4C planning PR must include. PR#18ab
   does **not** open Gate 4C; it defines what Gate 4C planning
   would have to record.
5. **Make the recap part of the merged record.** Future Gate 4
   sub-gate PRs reference this recap by name so the governance
   locks are auditable in one merged file.

PR#18ab is **not** itself a production-cutover readiness statement.
It is one input to that future statement, alongside Gate 4C / 4D /
4E outcomes (if and when those are recorded).

---

## 3. Current merged evidence chain

The Gate 4 evidence chain at the moment PR#18ab is opened (all merged
into base `sprint2-architecture-contracts-d4cc2bf`):

- **PR#18v / PR #54** — Dedicated production audit read-only
  credential proof. Verdict: **PASS**. Created
  `buyerrecon_prod_audit_readonly` (LOGIN, `CONNECT` on
  `buyerrecon_production`, `USAGE` on schema `public`, `SELECT` only
  on the five Gate 4A audit tables; no INSERT/UPDATE/DELETE on Lane
  A/B). Stored DSN in `/root/buyerrecon-production-db.env` at mode
  `0600`, owner `root:root`. `DATABASE_URL_fallback_used=no`.
  `db_name_category=production`.
  `current_user_category=production_audit_readonly`. No password or
  DSN printed.
- **PR#18w / PR #55** — Gate 4A DB / grant / traffic re-audit.
  Verdict: **PASS_WITH_WARNINGS**. Production DB binding valid;
  all five required count-access checks passed; Lane A/B row counts
  zero; migration-016 grant posture holds for
  `buyerrecon_migrator`, `buyerrecon_internal_readonly`,
  `buyerrecon_customer_api`, `buyerrecon_scoring_worker`,
  `buyerrecon_prod_audit_readonly`, and `PUBLIC`. Warning
  carried: `historical_rejected_only_v1_event_rows_present` (26
  HTTP `400` `request_body_invalid_json` `/v1/event` ingest rows
  from `2026-05-19`, zero propagation to `accepted_events`,
  `rejected_events`, or Lane A/B; documented in PR#17s).
- **PR#18x / PR #56** — Gate 4B website artifact / config bundle
  planning / check. Verdict: **PLANNING / CHECK ONLY**. Defined
  the canonical Gate 4B inventory and the eight Gate 4C
  preconditions.
- **PR#18y / PR #57** — Gate 4B read-only artifact / config check
  execution proof. Verdict: **BLOCKED**. Stop-lines:
  `rollback_artifact_source_missing`,
  `rollback_procedure_source_missing`. Artifact and endpoint
  surfaces clean; rollback posture missing.
- **PR#18z / PR #58** — Gate 4B rollback reconstitution
  remediation. Verdict: **PASS**. Established canonical
  `/root/buyerrecon-rollback/` (mode `0700`, owner `root:root`),
  timestamped bundle
  `buyerrecon-gate4b-rollback-20260524T115806Z` containing
  byte-identical copies of the four live static artifacts plus
  `MANIFEST.txt` and `LIVE-HASHES-AT-CAPTURE.txt`, and
  `ROLLBACK-PROCEDURE.md` recording the rollback runbook with the
  pre-restore `stat -c '%a %U:%G %n'` step and the `sha256sum -c
  MANIFEST.txt` bundle-intact verify.
- **PR#18aa / PR #59** — Gate 4B re-audit after rollback
  reconstitution. Verdict: **PASS**. Every PASS condition met; no
  stop-line triggered. The Gate 4B blocker stack from PR#18p →
  PR#18y → PR#18z → PR#18aa is closed.

PR#18ab is sequenced **after** PR#18aa and **before** any Gate 4C
planning PR.

---

## 4. Historical warning carry-forward

The PR#17s / PR#18w 26-row warning is carried forward verbatim by
this recap and must continue to travel with every future Gate 4 PR
until the recap is superseded by a later governance PR.

- **Count:** `ingest_requests_endpoint_v1_event_count = 26` on the
  production cluster (per PR#18w §3.5).
- **Window:** `v1_event_first_seen_day = 2026-05-19`,
  `v1_event_last_seen_day = 2026-05-19`. All 26 rows landed on a
  single day.
- **Status distribution:** `distribution_http_status = 400: 26` —
  every row is HTTP `400`.
- **Reason distribution:** `distribution_reject_reason_code =
  request_body_invalid_json: 26` — every row carries the same
  reject reason.
- **Downstream propagation:** `accepted_events_count = 0`,
  `rejected_events_count = 0`, `lane_a_row_count = 0`,
  `lane_b_row_count = 0`. The 26 rows did not propagate to
  accepted events, rejected events, Lane A, or Lane B.
- **Origin:** ThinSDK ↔ Sprint 2 `/v1/event` contract-shape
  mismatch documented in
  `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`.
  The request body either parsed to a non-object (most likely a
  top-level JSON array), failed `JSON.parse` outright, or sent a
  body whose envelope shape did not match the strict
  `application/json` single-object contract.
- **Preservation rule.** The 26 rows are **not** newly observed
  unexplained traffic; they are categorical evidence of a prior
  failed canary attempt. **Do not delete, mutate, annotate, or
  normalise these rows.** This rule is also embedded in the
  on-host `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` (per
  PR#18z §G) under its `## Do-not rules` section, so the rule
  survives even if this repo doc is later moved or renamed.

**Gate 4C canary measurement rule.** Any future Gate 4C canary PR
that contemplates re-flipping `endpointUrl` to `/v1/event` must:

- explicitly reference the PR#17s 26-row baseline,
- measure canary success as a **delta from that 26-row baseline**,
  not as an absolute count,
- record `ingest_requests_endpoint_v1_event_pre_count = 26`
  immediately before the flip; any drift from `26` is itself a
  stop-line,
- enumerate `request_body_invalid_json_observed_post_flip` as a
  stop-line (a recurrence of the PR#17s pattern is a regression,
  not a success),
- not delete, mutate, annotate, or normalise the original 26 rows.

---

## 5. What is now proven (infrastructure only)

The Gate 4A / Gate 4B evidence chain proves the following — and
**only** the following — about production-host posture:

- **Production audit credential posture works.** A dedicated,
  minimally-scoped, SELECT-only read-only credential
  (`buyerrecon_prod_audit_readonly`) is bound at
  `/root/buyerrecon-production-db.env` (mode `0600`, owner
  `root:root`) without `DATABASE_URL` fallback. The database
  categorises as production (PR#18v PASS).
- **Production DB / grant posture was checked.** The five Gate 4A
  table count-access checks pass (`public.ingest_requests`,
  `public.accepted_events`, `public.rejected_events`,
  `public.scoring_output_lane_a`, `public.scoring_output_lane_b`).
  Migration-016 grant posture holds for the six checked roles
  (PR#18w PASS_WITH_WARNINGS).
- **Lane A / Lane B grants remain controlled.**
  `buyerrecon_migrator`: all S/I/U/D. `buyerrecon_internal_readonly`:
  SELECT only. `buyerrecon_customer_api`: no access.
  `buyerrecon_scoring_worker`: no access.
  `buyerrecon_prod_audit_readonly`: SELECT only. `PUBLIC`: no access.
  Lane A/B row counts are zero (PR#18w §3.5, §3.6).
- **Website artifact / config posture is known.** The four live
  static artifacts (`br-thinlayer-init.js`, `thin-sdk.iife.js`,
  `br-probe-init.js`, `index.html`) are present at
  `/var/www/buyerrecon.com/html/`, with sha256 hashes matching the
  PR#18p / PR#18x / PR#18y / PR#18z / PR#18aa baseline (PR#18aa
  §5.4).
- **Endpoint currently remains `render_legacy_collect`.**
  `br-thinlayer-init.js /collect count = 1`, `/v1/event count = 0`;
  all other artifacts both counts `0` (PR#18aa §5.5).
- **Sprint 2 `/v1/event` config is not active on the live website.**
  `sprint2_endpoint_config_present=no`,
  `both_collect_and_v1event_present=no` (PR#18aa §5.5).
- **Rollback bundle / procedure exists on the production host.**
  `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`
  contains byte-identical copies of the four live artifacts plus
  `MANIFEST.txt` and `LIVE-HASHES-AT-CAPTURE.txt`;
  `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` records the
  rollback runbook. `bundle_intact=yes` via `sha256sum -c
  MANIFEST.txt`; per-file `_backup_matches_live=yes` for all four
  artifacts (PR#18z §6, PR#18aa §5.6).
- **Gate 4B artifact / config / rollback re-audit is non-`BLOCKED`.**
  The PR#18y stop-lines
  (`rollback_artifact_source_missing`,
  `rollback_procedure_source_missing`) are categorically lifted
  (PR#18aa §1, §7).
- **Final recap is now being recorded.** This PR (PR#18ab) is that
  recap.

That is the complete list of what is proven. Everything else
remains unproven (see §6).

---

## 6. What remains unproven / not approved

The merged evidence chain **does not** prove, and PR#18ab does
**not** approve, any of the following:

- **Gate 4C `endpointUrl` re-flip is not approved.** No PR may flip
  `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
  from `/collect` to `/v1/event` without a separate Gate 4C PR
  satisfying all eight §8 preconditions under explicit Helen GO.
- **Canary behaviour is not approved.** No controlled human
  page-load, no fixture event, no synthetic write smoke, no Track A
  invocation, and no Playwright run may target the production
  Sprint 2 `/v1/event` collector. The Render legacy `/collect`
  endpoint also receives no canary under PR#18ab.
- **Production Sprint 2 collector traffic is not yet approved.**
  `accepted_events`, `rejected_events`, Lane A, and Lane B row
  counts must remain at zero on production until a Gate 4C canary
  PR (or a later Gate 4D / Gate 4E PR) explicitly authorises and
  records a controlled deviation.
- **Customer-facing outputs are not approved.** No customer-facing
  report, dashboard, claim, language upgrade, or surface activation
  is approved by PR#18ab. See §9 for the explicit locks.
- **Lane A / Lane B writes are not approved.** Lane A and Lane B
  writers remain dark.
- **Runtime scoring is not approved.** No production-cluster
  scoring decision may be computed, recorded, or surfaced under
  PR#18ab's scope.
- **AMS Trust / Pass 1 / Pass 2 runtime decisions are not
  approved.** AMS Trust runtime, Pass 1 runtime, and Pass 2 runtime
  remain unauthorised.
- **Dashboards, reports, customer claims, and commercial evidence
  language are not approved.** No customer-facing artefact may
  describe BuyerRecon's production posture as anything beyond
  "infrastructure readiness check passed; evidence pipe not
  activated".
- **Gate 4D / Gate 4E are not approved.** Gate 4D organic
  observation and Gate 4E Track A / Playwright work both require
  separate explicit Helen GO and their own proof PRs after Gate 4C
  closes.

---

## 7. Permitted behaviour after this recap, before Gate 4C

### 7.1 Allowed

Only the following kinds of work are allowed in the window between
PR#18ab merge and a future Gate 4C planning PR being opened:

- **Docs / planning only.** New docs that describe future work
  without authorising any production action.
- **Gate 4C planning PR.** A PR that records the exact target file,
  exact before / after hashes, exact endpoint change, exact rollback
  command source, exact canary scope, exact stop-lines, exact proof
  fields, and explicit non-approvals — without executing the flip
  or any traffic. See §13.
- **Exact file-diff planning.** Pre-computed shape of the single
  one-line change in `br-thinlayer-init.js` (with no actual edit).
- **Exact pre / post hash planning.** Pre-recorded expected sha256
  values bracketing the planned flip (with no actual flip).
- **Canary-scope planning.** Definition of "the canary" — typically
  one controlled human page-load or one approved fixture event per
  `docs/ops/cutover-hard-gates.md` §6.3 PR C semantics — with
  Track A, Playwright, and synthetic write smoke explicitly
  excluded.
- **Stop-line planning.** Enumeration of Gate-4C-specific stop-lines
  (including a `request_body_invalid_json_observed_post_flip`
  stop-line that captures PR#17s pattern recurrence).
- **Rollback command reference.** Reference to
  `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` and the latest
  bundle on the production host.
- **Proof-template preparation.** Stub of a Gate 4C proof doc
  following the PR#18p / PR#18w / PR#18y / PR#18z / PR#18aa
  structural template (§1 verdict, §evidence summary, §stop-line
  assessment, §impact, §boundaries, closing recap).

### 7.2 Not allowed

The following remain forbidden until a separate explicit Helen GO
authorises each item:

- **Actual endpoint flip.** No edit to
  `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js` or
  any other file under `/var/www/`.
- **Production traffic generation.** No `curl` / `wget` / `httpie`
  / `nc` / browser invocation targeting the production collector,
  the Render legacy `/collect`, or any production endpoint.
- **Live config change.** No Nginx config edit, no Nginx reload,
  no `systemctl` action, no DNS change, no env file edit, no
  credential rotation, no token provisioning.
- **Customer output.** No customer-facing report, dashboard,
  claim, language upgrade, or surface activation.
- **Scoring / runtime activation.** No AMS Trust runtime, no
  Pass 1 runtime, no Pass 2 runtime, no Lane A / Lane B writer, no
  dashboard implementation, no AMS bridge activation, no scoring
  worker run.

---

## 8. Gate 4C preconditions still required

The eight Gate 4C preconditions established in PR#18x §5 / PR#18y
§11 still apply. Their status at PR#18ab is:

1. **Explicit Helen GO for Gate 4C.** Status: **unsatisfied**.
   Gate 4C requires its own explicit Helen GO scoped narrowly to
   the `endpointUrl` re-flip and nothing else. PR#18ab does not
   carry forward a Gate 4C GO.
2. **Exact file-diff plan.** Status: **unsatisfied**. The Gate 4C
   PR must record the exact file path
   (`/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
   per PR#18x §4.5), the exact pre-change literal string, the exact
   post-change literal string, and a categorical attestation that
   no other file in `/var/www/buyerrecon.com/html/` is touched.
3. **Exact pre / post artifact hash plan.** Status: **unsatisfied**.
   The Gate 4C PR must record the sha256 of `br-thinlayer-init.js`
   immediately before the flip (must equal the PR#18p / PR#18x /
   PR#18y / PR#18z / PR#18aa baseline
   `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`)
   and immediately after the flip (must be a new, single, recorded
   value). The sha256 of the three unchanged artifacts
   (`thin-sdk.iife.js`, `br-probe-init.js`, `index.html`) must
   equal their baselines both before and after.
4. **No raw secrets posture.** Status: **unsatisfied**. The Gate 4C
   PR must reaffirm that no DSN, password, `Authorization:` header
   value, bearer token, `request_id`, `session_id`, payload,
   response body, env dump, private key / cert body, or vault
   content is printed, echoed, written to disk, captured into a
   proof, or included in any commit.
5. **Canary scope definition.** Status: **unsatisfied**. The Gate
   4C PR must record what counts as "the canary" — typically one
   controlled human page-load or one approved fixture event per
   `docs/ops/cutover-hard-gates.md` §6.3 PR C — and explicitly
   exclude Track A, Playwright, organic observation, and any
   synthetic write smoke that has not been separately approved by
   its own Helen GO.
6. **Gate 4C-specific stop-lines.** Status: **unsatisfied**. The
   Gate 4C PR must enumerate at least the stop-lines listed in
   PR#18x §5 precondition 7 (`route_health_check_5xx`,
   `route_health_check_4xx_unexpected`,
   `route_health_check_timeout`, `endpointUrl_pre_count_not_one`,
   `endpointUrl_pre_count_drifted`, `endpointUrl_post_count_not_one`,
   `unchanged_artifact_hash_drift`, `unauthorised_file_changed`,
   `request_body_invalid_json_observed_post_flip`,
   `accepted_events_5xx_class_observed`,
   `accepted_events_delta_unexpected`,
   `lane_writer_activity_observed`, `customer_output_observed`,
   `secret_printed`, `operator_uncertain`).
7. **Gate 4C proof record.** Status: **unsatisfied**. The Gate 4C
   PR must produce a docs-only proof record following the
   structure of PR#18p / PR#18w / PR#18y / PR#18z / PR#18aa and
   explicitly state whether the canary succeeded, failed, or was
   rolled back.
8. **Rollback-first condition.** Status: **satisfied** by PR#18z +
   PR#18aa. The canonical rollback root
   `/root/buyerrecon-rollback/` is established on the production
   host at mode `0700` owner `root:root`; the timestamped bundle
   `buyerrecon-gate4b-rollback-20260524T115806Z` exists at mode
   `0700` owner `root:root` and contains byte-identical copies of
   the four live static artifacts plus `MANIFEST.txt` and
   `LIVE-HASHES-AT-CAPTURE.txt`;
   `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` records the
   rollback runbook with the pre-restore `stat -c '%a %U:%G %n'`
   step and the `sha256sum -c MANIFEST.txt` bundle-intact verify;
   `bundle_intact=yes` and `backup_hashes_match_live=yes` per
   PR#18aa §5.6 / §6.

**Only precondition 8 (rollback-first) is satisfied.** The other
seven preconditions remain unsatisfied until a dedicated Gate 4C
planning / execution chain records them. PR#18ab does **not**
satisfy any precondition other than 8, and PR#18ab does **not**
authorise Gate 4C.

---

## 9. Scoring and output governance locks

The following locks are recorded categorically. They remain in
force unless a later explicit governance PR — under its own Helen
GO, scoped narrowly to the lock being changed — supersedes them.

```
customer_claim_allowed=false
customer_visibility_allowed=false
lane_output_allowed=false
lane_write_allowed=false
runtime_scoring_allowed=false
ams_trust_runtime_allowed=false
pass1_runtime_allowed=false
pass2_runtime_allowed=false
dashboard_customer_output_allowed=false
sales_claim_upgrade_allowed=false
allowed_customer_language=[]
```

### 9.1 Interpretation

- `customer_claim_allowed=false` — no customer-facing claim about
  buyer intent, identity verification, fraud / bot classification,
  Trust / confidence scoring, AI-agent detection, or
  readiness-to-buy may be made by any BuyerRecon surface (website,
  dashboard, report, API response, sales material, marketing copy)
  under PR#18ab.
- `customer_visibility_allowed=false` — no scoring output,
  classification, or Trust / confidence value may be made visible
  to the customer under any surface.
- `lane_output_allowed=false` — Lane A and Lane B outputs may not
  be surfaced anywhere customer-readable. Internal-only inspection
  by the audit role remains the only permitted access path, and
  even that is bounded by the migration-016 grant posture
  (`buyerrecon_prod_audit_readonly` SELECT only on Lane A/B; per
  PR#18w §3.6).
- `lane_write_allowed=false` — no Lane A or Lane B writer (no
  scoring worker, no AMS bridge, no observer-derived Lane row, no
  manual `INSERT`) may run against the production cluster.
- `runtime_scoring_allowed=false` — no scoring decision (Pass 1
  evidence-based, Pass 2 claim-governance, Trust v0.1) may be
  computed at production runtime.
- `ams_trust_runtime_allowed=false` — the AMS Trust runtime (the
  bridge that would consume BuyerRecon scoring output) is not
  approved.
- `pass1_runtime_allowed=false` — Pass 1 (evidence-based scoring)
  runtime is not approved.
- `pass2_runtime_allowed=false` — Pass 2 (claim-governance)
  runtime is not approved.
- `dashboard_customer_output_allowed=false` — no customer-facing
  dashboard, no customer-facing report panel, no customer-facing
  scorecard surface is approved.
- `sales_claim_upgrade_allowed=false` — no marketing, sales,
  pitch, or commercial-evidence claim may upgrade from "evidence
  capture only" to "scoring / classification / decision" under
  PR#18ab.
- `allowed_customer_language=[]` — the empty list. No
  customer-facing phrasing about buyer scoring is whitelisted by
  PR#18ab.

### 9.2 Persistence rule

Each `*_allowed=false` lock above survives **any** future Gate 4C
canary, Gate 4D organic observation, Gate 4E Track A / Playwright
work, or fix PR **unless** a separate scoring / governance / output
PR explicitly amends the lock under its own Helen GO. A Gate 4C
canary that produces a clean `accepted_events` row is **not** a
license to unlock any of these surfaces — see §6 and §10.

---

## 10. Lane A / Lane B posture

The Lane A / Lane B governance posture is recorded categorically:

- **Lane A / Lane B row counts are currently zero from prior
  evidence.** PR#18w §3.5 / §6 recorded `lane_a_row_count=0`,
  `lane_b_row_count=0`, `lane_counts_category=both_zero`. PR#18aa
  did not alter this.
- **Lane A / Lane B writer activation remains forbidden.** No
  scoring worker, no AMS bridge, no observer-derived row, no
  manual `INSERT` against `public.scoring_output_lane_a` or
  `public.scoring_output_lane_b` is approved.
- **Lane A customer-facing output remains forbidden.** Lane A —
  the "primary, customer-visible" output lane defined by PR#18l —
  has no customer-facing surface enabled. Any future surface
  requires a separate scoring / governance / output PR.
- **Lane B remains dark / internal-only.** Lane B — the
  "auxiliary, internal-only" output lane defined by PR#18l —
  cannot be exposed to customers in any form.
- **No AI-agent / Lane B leakage into customer output is allowed.**
  Even if Lane B were later populated for internal analysis under
  a separate PR, no Lane B field, no Lane B classification, no
  Lane B confidence value, no Lane B reason code may surface in a
  customer-facing report, dashboard, API response, sales
  material, or marketing copy.
- **Any future Lane writer / output PR must be separate and
  explicitly approved.** A single PR may not bundle Lane writer
  activation with any other gate work; each requires its own
  Helen GO, its own scope, its own proof record, and its own
  rollback plan.

The migration-016 grant posture recorded in PR#18w §3.6 — which
keeps `buyerrecon_customer_api`, `buyerrecon_scoring_worker`, and
`PUBLIC` with **no** access on Lane A/B, and limits
`buyerrecon_internal_readonly` and `buyerrecon_prod_audit_readonly`
to SELECT only — is the technical floor that supports these
governance locks. Any later PR that broadens those grants is itself
a high-impact governance change and must be opened as its own PR.

---

## 11. AMS / Trust / Policy / Pass 1 / Pass 2 posture

The AMS / Trust / Policy / Pass 1 / Pass 2 runtime posture is
recorded categorically:

- **AMS Trust runtime is not approved.** No AMS Trust runtime
  process may run against production data; no AMS Trust output
  may be consumed by any customer-facing surface.
- **Pass 1 runtime is not approved.** PR#18e / PR#18i defined the
  Pass 1 evidence-based contract v0.2; PR#18ab does not authorise
  Pass 1 to run against production at runtime.
- **Pass 2 runtime is not approved.** PR#18k defined the Pass 2
  claim-governance contract v0.1; PR#18ab does not authorise
  Pass 2 to run against production at runtime.
- **Trust / confidence scoring output is not approved for
  customer-facing use.** PR#18j defined the Trust contract v0.1;
  PR#18ab does not authorise Trust output to surface to customers,
  to be quoted in marketing / sales materials, or to upgrade any
  commercial claim.
- **Any AMS bridge / runtime / customer-decision activation
  requires a later separate PR.** No PR — including a future
  Gate 4C canary PR — may bundle AMS bridge activation, runtime
  scoring activation, or customer-decision activation with its
  primary scope. AMS / Trust / Pass / Policy activation is a
  separate governance act and must be its own PR under its own
  Helen GO.
- **This recap preserves the separation between evidence capture
  and scoring / output.** Gate 4 (route readiness → endpoint
  change → controlled event proof → organic observation → Track A)
  is about **evidence capture**. Scoring (Pass 1 / Trust / Pass 2)
  and output (dashboards, reports, customer claims) are
  separately gated. PR#18ab makes this separation
  categorically explicit so a future PR cannot blur it.

---

## 12. Customer-facing language lock

The customer-facing language lock is recorded categorically.

### 12.1 Forbidden customer-facing language

No customer-facing surface (website, dashboard, report, API
response, sales material, marketing copy, demo script, pitch deck,
press release, blog post, social post, or any other channel
reachable by a current or prospective BuyerRecon customer) may
claim any of the following under PR#18ab:

- **Verified buyer intent.** No claim that BuyerRecon has verified
  a visitor's intent to buy.
- **High-confidence buyer identity.** No claim that BuyerRecon
  identifies the visitor with high confidence.
- **Scoring decision.** No claim that BuyerRecon produces a buyer
  score, a readiness score, a trust score, or any other
  decision-grade value about a visitor.
- **AI-agent classification.** No claim that BuyerRecon classifies
  traffic as AI-agent vs human-agent at a customer-actionable
  level.
- **Fraud / bot conclusion.** No claim that BuyerRecon detects
  fraud or bot traffic and surfaces that conclusion to the
  customer.
- **Readiness-to-buy conclusion.** No claim that BuyerRecon
  determines a visitor's readiness to buy.
- **Trust / Policy decision.** No claim that BuyerRecon produces a
  Trust or Policy decision against a visitor or session.

A customer-facing claim from any of the above categories is
permitted **only** after a later explicit scoring / governance /
output PR — under its own Helen GO, scoped narrowly to that
upgrade — amends the §9 `*_allowed=false` locks and §12.1
forbiddance list.

### 12.2 Allowed internal language

The following descriptions of BuyerRecon's posture are permitted
under PR#18ab. They are internal / operational language only and
should not be quoted to customers without separate review:

- **"Record-only evidence."** BuyerRecon production currently
  records evidence (the 26 PR#17s rows being the only such
  evidence captured so far via the live ThinSDK). It produces no
  scoring decision and no customer-facing output.
- **"Canary proof."** Future Gate 4C work, if approved, will
  produce a single controlled canary proof — not a production
  rollout. Canary outcomes belong in proof documents, not in
  customer-facing materials.
- **"Artifact / config posture."** The four live static artifacts
  and the `render_legacy_collect` endpoint posture are known and
  hash-verified.
- **"Rollback posture."** A canonical rollback bundle and
  procedure source exist on the production host (PR#18z, PR#18aa).
- **"Collector reachability / historical rejected-row evidence."**
  The Sprint 2 `/v1/event` collector was reachable at the time the
  26 PR#17s rows landed (`2026-05-19`), but every one of those rows
  returned HTTP `400` with `reject_reason_code=request_body_invalid_json`
  — they are envelope-parse rejections recorded in
  `public.ingest_requests`, not event-contract acceptances (zero
  rows reached `public.accepted_events` or `public.rejected_events`).
  The Sprint 2 `/v1/event` path is currently inactive on the live
  website.
- **"Historical warning carried forward."** The 26 PR#17s rows
  are documented and preserved.

---

## 13. Gate 4C planning requirements

A future Gate 4C planning PR — when one is opened — must include
at minimum:

- **Exact target file(s).** The single target is
  `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`.
  No other file under `/var/www/buyerrecon.com/html/` is to be
  touched (the other three artifacts `thin-sdk.iife.js`,
  `br-probe-init.js`, `index.html` must remain byte-identical).
- **Exact before hash(es).** The pre-flip sha256 of
  `br-thinlayer-init.js` must equal
  `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`.
  The sha256 of the three unchanged artifacts must equal their
  baselines.
- **Exact after hash(es).** The post-flip sha256 of
  `br-thinlayer-init.js` must be a single, pre-recorded, expected
  value. The sha256 of the three unchanged artifacts must equal
  their baselines (any drift is a stop-line).
- **Exact endpoint change.** The exact pre-change literal string
  (the Render legacy `/collect` URL as it appears in the file) and
  the exact post-change literal string (the Sprint 2 `/v1/event`
  URL) must be recorded.
- **Exact rollback command source.** Reference to
  `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` and the latest
  bundle on the production host, including the pre-restore `stat
  -c '%a %U:%G %n'` step (PR#18z §G "How to restore") and the
  `sha256sum -c MANIFEST.txt` bundle-intact verify.
- **Exact canary scope.** One controlled human page-load or one
  approved fixture event per `docs/ops/cutover-hard-gates.md`
  §6.3 PR C. Track A, Playwright, organic observation, and
  synthetic write smoke are explicitly out of scope.
- **Exact stop-lines.** The Gate-4C-specific stop-line set from
  §8 precondition 6, plus a
  `request_body_invalid_json_observed_post_flip` stop-line
  capturing PR#17s pattern recurrence.
- **Exact proof fields.** Categorical paste-back fields following
  the PR#18p / PR#18w / PR#18y / PR#18z / PR#18aa structural
  template.
- **No customer output.** The Gate 4C PR must restate
  `customer_claim_allowed=false`,
  `customer_visibility_allowed=false`, etc., per §9.
- **No scoring activation.** The Gate 4C PR must restate
  `runtime_scoring_allowed=false`,
  `ams_trust_runtime_allowed=false`, `pass1_runtime_allowed=false`,
  `pass2_runtime_allowed=false`.
- **No Lane writer.** `lane_write_allowed=false` /
  `lane_output_allowed=false` must hold throughout the Gate 4C
  canary window. No `INSERT` against
  `public.scoring_output_lane_a` or `public.scoring_output_lane_b`
  is permitted.
- **No DB mutation unless explicitly approved.** The Gate 4C PR
  must not silently approve any DB write; if a controlled fixture
  event creates an `ingest_requests` row, that row is the only
  permitted DB write, and the PR must explicitly call this out.
  No DB grant change, no migration, no `schema.sql` change.
- **Rollback test / verification plan.** The Gate 4C PR must
  include a dry-run of the rollback procedure (or a categorical
  proof that the rollback procedure has been validated against
  the current bundle) before the canary is executed.

Until a Gate 4C planning PR records all of the above under explicit
Helen GO, Gate 4C remains unapproved.

---

## 14. Non-goals

PR#18ab explicitly does **not** approve any of the following. Each
requires its own explicit Helen GO scoped to that specific work:

- no production execution of any kind,
- no `endpointUrl` re-flip,
- no canary,
- no production traffic generation,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no `/var/www` edit,
- no `cp` / `mv` / `rm` / `chmod` / `chown` / `ln -s` / `rsync`
  / `sed -i` / `awk -i inplace` / `patch` against any production
  file,
- no symlink change,
- no `nginx -s reload`, no `systemctl`, no service restart,
- no DNS change,
- no DB write, no DB grant, no migration, no `schema.sql` change,
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no `buyerrecon_migrator`
  reset, no production token provisioning,
- no Lane A / Lane B writer,
- no runtime scoring,
- no AMS Trust runtime,
- no Pass 1 runtime,
- no Pass 2 runtime,
- no customer-facing output (Pass 1 / Trust / Pass 2 / Lane
  report / dashboard / API response / sales material / marketing
  copy),
- no dashboard implementation, no AMS bridge activation,
- no Track A,
- no Playwright,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no Gate 4C approval,
- no Gate 4D organic observation,
- no Gate 4E Track A / Playwright work,
- no deletion / mutation / annotation / normalisation of the 26
  historical PR#17s rows on the production cluster,
- no secret printing (DSN, generated password, DB username /
  password pair, `Authorization:` header value, raw `request_id`,
  raw `session_id`, raw payload, raw response body, env dump,
  private key / cert body, vault content, shell history, raw row
  data).

---

## 15. Acceptance criteria

PR#18ab is acceptable for merge into
`sprint2-architecture-contracts-d4cc2bf` only if **all** of the
following hold:

- **Docs-only.** Exactly one new file changes:
  `docs/sprint2-pr18ab-final-scoring-governance-recap.md`. No
  code, no scripts, no tests, no package files, no migrations, no
  `schema.sql`, no env files, no systemd / Nginx files, no AMS
  source, no website artifacts, no production config, no DB grant
  files change.
- **Final recap recorded.** §1 records
  `GOVERNANCE_RECAP_ONLY` and §2–§13 record the recap content per
  the specification.
- **Gate 4B non-`BLOCKED` carried forward.** §3 records PR#18aa
  PASS / non-`BLOCKED`.
- **Gate 4C remains unapproved.** §6, §7, §8, §13, §14 all
  restate that Gate 4C remains unapproved and that only one of
  the eight Gate 4C preconditions (rollback-first) is satisfied.
- **Scoring / output locks recorded.** §9 records all eleven
  `*_allowed=false` / `allowed_customer_language=[]` locks.
- **Lane writer / output locks recorded.** §10 records the Lane
  A / Lane B forbiddance.
- **AMS / Trust / Pass locks recorded.** §11 records the AMS
  Trust / Pass 1 / Pass 2 / customer-decision forbiddance.
- **Historical 26-row warning carried forward.** §4 carries the
  warning verbatim with the do-not-delete / do-not-mutate /
  do-not-annotate / do-not-normalise rule.
- **Final scoring / governance recap requirement.** PR#18ab is
  the recap. It does **not** by itself approve production-cutover
  readiness; it records the governance posture against which a
  later cutover-readiness claim (after Gate 4C / 4D / 4E) would
  be measured.
- **No secrets.** Secret-safety grep returns only
  metadata / governance / attestation hits inside §1 / §6 / §8 /
  §13 / §14 forbiddance lists; no leaked value.
- **No code / config / runtime changes.** No code, config, DB,
  website artifact, route, collector, scoring worker, Lane A/B
  writer, AMS bridge / runtime, dashboard, customer output, or
  production infrastructure modified.

---

## 16. Files planned to change

### 16.1 Repo (this PR, docs-only)

| Path | Action | Lines |
|---|---|---|
| `docs/sprint2-pr18ab-final-scoring-governance-recap.md` | NEW | 884 |

No code, scripts, tests, package files, migrations, `schema.sql`,
env files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

### 16.2 Production host

| Path | Action |
|---|---|
| any | NOT TOUCHED |

PR#18ab does not read, write, edit, copy, move, remove, chmod,
chown, symlink, or otherwise touch the production host in any way.
No commands of any kind are executed against the production host.

---

End of PR#18ab. **Final scoring / governance recap before Gate 4C.
Verdict: GOVERNANCE_RECAP_ONLY — no production execution, no Gate
4C approval. The Gate 4A / Gate 4B evidence chain (PR#18v PASS,
PR#18w PASS_WITH_WARNINGS, PR#18x PLANNING / CHECK ONLY, PR#18y
BLOCKED then PR#18z PASS then PR#18aa PASS) proves production
audit credential posture, production DB / grant posture, Lane A / B
grant safety, website artifact / config posture, `render_legacy_collect`
endpoint posture, and reconstituted rollback bundle / procedure
posture. The Gate 4A / Gate 4B chain does NOT prove customer-facing
output, scoring claims, Lane A / B writer activation, AMS Trust /
Pass 1 / Pass 2 runtime, dashboards, reports, marketing / sales
claims, or any customer-decision surface. Eleven explicit
`*_allowed=false` / `allowed_customer_language=[]` governance locks
are recorded categorically (§9). Lane A / B writer + output remains
forbidden (§10). AMS Trust / Pass 1 / Pass 2 runtime remains
forbidden (§11). Seven customer-facing language claim categories
remain forbidden (§12.1). The PR#17s 26-row historical warning is
carried forward verbatim with do-not-delete / do-not-mutate /
do-not-annotate / do-not-normalise rule (§4). Only one of the eight
Gate 4C preconditions (rollback-first; §8 precondition 8) is
satisfied; the other seven (explicit Helen GO scoped narrowly to
Gate 4C, exact file-diff plan, exact pre / post artifact hash, no
raw secrets posture, canary scope, Gate-4C-specific stop-lines,
Gate 4C proof record) remain unsatisfied. Gate 4C `endpointUrl`
re-flip remains unapproved; Gate 4D organic observation remains
unapproved; Gate 4E Track A / Playwright work remains unapproved.
The recap is one input to any future production-cutover readiness
claim; it is not the claim itself. No production-host write, no
production-host read, no HTTP call, no command execution of any
kind is performed by PR#18ab. The repo change is docs-only. No
code, scripts, tests, package files, migrations, `schema.sql`,
env files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified. No `endpointUrl`
re-flip, no Gate 4C approval, no Gate 4C canary, no production
traffic generation, no `buyerrecon.com` production `/v1/event`
call, no Render `/collect` call, no `/var/www` edit, no symlink
change, no `nginx -s reload`, no `systemctl` action, no service
restart, no DNS change, no DB write, no DB grant, no migration, no
`schema.sql` change, no env file edit, no credential rotation, no
`buyerrecon_prod_collector_app` reset, no `buyerrecon_migrator`
reset, no production token provisioning, no Lane A / B writer, no
runtime scoring, no AMS Trust runtime, no Pass 1 runtime, no Pass
2 runtime, no customer-facing output, no dashboard implementation,
no AMS bridge activation, no Track A, no Playwright, no website
ThinSDK production-mode activation, no production artifact /
config mode flip, no Gate 4D observation, no Gate 4E Track A /
Playwright work, no deletion / mutation / annotation /
normalisation of the 26 historical PR#17s rows on the production
cluster, no customer-facing language upgrade, and no secret
printing are approved by PR#18ab. Any future Gate 4C planning PR
(which must satisfy §8's seven remaining preconditions and §13's
planning fields), Gate 4C canary PR, Gate 4D observation PR,
Gate 4E Track A / Playwright PR, scoring / governance / output PR
(which alone may amend the §9 locks under its own explicit Helen
GO), Lane A / B writer PR, AMS bridge / runtime PR, Pass 1 / Trust
/ Pass 2 runtime PR, dashboard PR, customer-facing report PR,
customer-facing claim / marketing / sales material PR, issue-fix
PR, runtime PR, or final cutover-readiness claim PR remains
separately gated by its own explicit Helen GO.**
