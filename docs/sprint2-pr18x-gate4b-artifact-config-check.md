# Sprint 2 PR#18x: Gate 4B Website Artifact / Config Bundle Planning / Check

> Docs-only planning record. No execution is performed by this PR.
> No `endpointUrl` re-flip. No production traffic generation. No `/var/www`
> edit. No file copied, moved, removed, symlinked, or service-reloaded by
> PR#18x. PR#18x defines the **planning / check** layer for Gate 4B; it does
> **not** authorise any artifact change, any config flip, or any later
> Gate 4C canary.

---

## 1. Status / verdict

**Verdict: PLANNING / CHECK ONLY — Gate 4B website artifact / config bundle planning / check.**

- No `endpointUrl` re-flip.
- No production traffic generation.
- No `/var/www` edit unless explicitly approved by Helen in a later
  execution PR with its own scope, its own rollback plan, its own stop-lines,
  and its own proof record.
- No `rsync`, no `cp`, no `mv`, no `rm`, no `chown`, no `chmod`, no `ln -s`.
- No `nginx -s reload`, no `systemctl`, no service restart.
- No DNS change.
- No DB write. No DB grant. No migration. No `schema.sql` change.
- No env file edit. No credential rotation. No token provisioning.
- No website ThinSDK production-mode activation.
- No production artifact / config mode flip.
- No customer-facing output (Pass 1 / Trust / Pass 2 / dashboard / Lane report).
- No Lane A/B writer.
- No runtime scoring.
- No Track A.
- No Playwright.
- No Gate 4C / Gate 4D / Gate 4E execution.
- No secrets printed.

Anchored governance phrases (carried verbatim from `docs/ops/cutover-hard-gates.md` §7):

- "Route readiness is not traffic cutover."
- "EndpointUrl update is not event-capture proof."
- "Health check is not event-contract proof."
- "`NO_EVENT_YET` is not failure if no event was expected or observed."
- "`500` means runtime / system failure; rollback first, then diagnose."
- "Do not delete failed canary evidence rows."
- "Do not broaden grants to make a proof pass."

---

## 2. Why Gate 4B comes after Gate 4A

The Gate 4A DB / grant / traffic re-audit (PR#18w / PR #55, verdict
`PASS_WITH_WARNINGS`) closed the DB / binding / category / grant blocker
recorded in PR#18p:

- The dedicated `buyerrecon_prod_audit_readonly` role created and proved in
  PR#18v / PR #54 (verdict `PASS`) provides a read-only production audit
  credential bound via a root-only `/root/buyerrecon-production-db.env`
  (mode `0600`, owner `root:root`) with no `DATABASE_URL` fallback.
- PR#18w §3.2 / §3.3 record: `PRODUCTION_DATABASE_URL_present=yes`,
  `DATABASE_URL_fallback_used=no`, `dsn_loaded_from_production_binding=yes`,
  `db_name_category=production`, `production_name_match=yes`,
  `staging_name_match=no`, `current_user_category=production_audit_readonly`.
- PR#18w §3.4 records the five required Gate 4A table count-access checks as
  passing (`public.ingest_requests`, `public.accepted_events`,
  `public.rejected_events`, `public.scoring_output_lane_a`,
  `public.scoring_output_lane_b`).
- PR#18w §3.5 records `lane_a_row_count=0`, `lane_b_row_count=0`,
  `lane_counts_category=both_zero`. PR#18w §3.6 records the migration-016
  Lane grant posture as holding for `buyerrecon_migrator`,
  `buyerrecon_internal_readonly`, `buyerrecon_customer_api`,
  `buyerrecon_scoring_worker`, `buyerrecon_prod_audit_readonly`, and `PUBLIC`.
- PR#18w §7 records `stop_lines_triggered=none` and one warning,
  `historical_rejected_only_v1_event_rows_present=yes` — the 26 historical
  `/v1/event` HTTP `400` `request_body_invalid_json` rows from `2026-05-19`
  documented in `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`,
  which did not propagate to `accepted_events`, `rejected_events`, or Lane A/B.

With the DB / grant / traffic branch non-`BLOCKED`, the next narrow layer of
Gate 4 work that can be considered under its own Helen GO is the **website
artifact / config bundle** layer: confirming what is currently deployed at
`/var/www/buyerrecon.com/html`, recording the bundle / hash inventory,
identifying which files would change if a Gate 4C `endpointUrl` re-flip were
later approved, and identifying the rollback artifact source and rollback
procedure source. PR#18x is the **planning / check** layer for that work; it
does not execute the artifact check, and it does not pre-authorise any
Gate 4C canary.

PR#18x is sequenced **after** Gate 4A and **before** Gate 4C. It does not
fold the route-readiness, client-endpoint-change, controlled-event-proof,
passive-organic-observation, or Track A layers (cutover-hard-gates §6.1 →
§6.5) into a single artefact. Per cutover-hard-gates §6.6: "If PR A's 'route
readiness' claim is folded into the same artefact as PR C's 'event captured'
claim, a runtime privilege failure (Gate 3 failure) reads as 'the cutover
broke' instead of 'the route is fine but the runtime role is missing a
privilege'."

---

## 3. Current known production artifact posture

The categorical evidence below is carried verbatim from
`docs/sprint2-pr18p-gate4a-readiness-audit-execution-proof.md` §3.1, §3.2,
and §3.3. PR#18p §3.1's note still applies: "The four sha256 hashes are of
publicly-served static artifact files and are therefore not secret-bearing
under PR#18o §4."

### 3.1 Website / artifact posture (from PR#18p §3.1)

- `website_root_found`: yes
- corrected website root: `/var/www/buyerrecon.com/html`
- ThinLayer root: `/var/www/buyerrecon.com/html/thinlayer`
- `artifact_hashes_captured`: yes
- `br-thinlayer-init.js`: present
- `thin-sdk.iife.js`: present
- `br-probe-init.js`: present
- `index.html`: present
- `br_thinlayer_init_sha256`: `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`
- `thin_sdk_iife_sha256`: `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1`
- `br_probe_init_sha256`: `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84`
- `index_html_sha256`: `30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c`

PR#18p §3.1 also records: "No `/var/www` file was edited, copied, moved,
removed, or symlinked. No `rsync`. No `chown`. No `chmod`. No service
reload." PR#18x continues that posture: no edit, no copy, no move, no remove,
no symlink, no `rsync`, no `chown`, no `chmod`, no service reload.

### 3.2 Endpoint category (from PR#18p §3.2)

- `br_thinlayer_init_collect_count`: 1
- `br_thinlayer_init_v1event_count`: 0
- `thin_sdk_iife_collect_count`: 0
- `thin_sdk_iife_v1event_count`: 0
- `br_probe_init_collect_count`: 0
- `br_probe_init_v1event_count`: 0
- `endpointUrl_category`: `render_legacy_collect`
- `render_collect_legacy_present`: yes
- `sprint2_endpoint_config_present`: no

Interpretation (carried from PR#18p §3.2): "The production static artifact
set remains on the Render legacy `/collect` posture. No Sprint 2 `/v1/event`
endpoint config was detected in the checked ThinLayer artifacts." PR#17s §4
records the same posture in product terms: "`buyerrecon.com` ThinLayer
`endpointUrl` = `https://buyerrecon-backend.onrender.com/collect` (Render
legacy collector). The site is on the legacy capture path."

PR#18x does **not** flip this. Any flip from `render_legacy_collect` to
`sprint2_v1_event` requires Gate 4C under its own Helen GO; see §5.

### 3.3 Rollback / backup posture (from PR#18p §3.3)

- `backup_dir_present`: yes
- `backup_artifact_present`: yes
- `rollback_doc_present`: yes
- `rollback_artifact_exists`: yes

PR#18p §3.3 also records: "No restore was executed. No `cp -f`. No `mv`. No
symlink change." PR#18x continues that posture.

The rollback artifact identified in PR#18p §3.3 and the rollback runbook
referenced in `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`
§4 ("Rollback to Render legacy is the steady state and remains the one-step
revert target throughout any downstream implementation PR") together
constitute the rollback source identified in §4.6 below.

---

## 4. Gate 4B artifact / config checklist

Gate 4B is the **artifact / config bundle planning / check** layer. It
defines what would be recorded by a later Gate 4B execution PR (if and when
Helen explicitly approves one); PR#18x itself records only the inventory of
the checks, not their re-execution. Where Gate 4A has already captured an
evidence field (§3 above), Gate 4B may reference the Gate 4A value rather
than re-running the read-only command — see §4.4.

### 4.1 Artifact root inventory check

**What must be confirmed (categorical):**

- `website_root_path_category`: `/var/www/buyerrecon.com/html` (already
  categorical-recorded in Gate 4A §3.1).
- `thinlayer_root_path_category`: `/var/www/buyerrecon.com/html/thinlayer`
  (already categorical-recorded in Gate 4A §3.1).
- `website_root_exists`: `yes` (already implied by Gate 4A
  `website_root_found=yes`).
- `thinlayer_root_exists`: `yes` (already implied by Gate 4A artifact
  inventory).

**Forbidden:** any `find` / `ls` that walks outside these two roots; any
`stat` on owner / permission bits without explicit approval; any read of a
file outside the four static artifacts listed in §4.2.

### 4.2 Static artifact presence check

**What must be confirmed (categorical):**

- `br_thinlayer_init_js_present`: `yes`
- `thin_sdk_iife_js_present`: `yes`
- `br_probe_init_js_present`: `yes`
- `index_html_present`: `yes`

All four are already categorical-recorded as `present` in Gate 4A §3.1.

**Forbidden:** any `cat` / `head` / `tail` of these files; any `cp`; any
edit; any move; any remove; any symlink. Presence-only check.

### 4.3 Endpoint category re-confirmation (categorical, no re-flip)

**What must be confirmed (categorical):**

- `endpointUrl_category`: `render_legacy_collect`
- `render_collect_legacy_present`: `yes`
- `sprint2_endpoint_config_present`: `no`

All three are already categorical-recorded in Gate 4A §3.2.

If a later Gate 4B execution PR re-runs the §5.D runbook commands (PR#18o
§5.D), it must continue to record `endpointUrl_category=render_legacy_collect`
and `sprint2_endpoint_config_present=no`. **Any deviation is a stop-line**
(see §7), because the only authorised path from `render_legacy_collect` to
`sprint2_v1_event` is a Gate 4C PR with its own Helen GO, its own rollback
plan, its own stop-lines, and its own proof record.

**Forbidden:** any `endpointUrl` write; any `sed -i`; any `cp` of a modified
file into the artifact root; any change to `br-thinlayer-init.js`,
`thin-sdk.iife.js`, `br-probe-init.js`, or `index.html`; any HTTP call to
the production collector; any traffic generation.

### 4.4 Artifact hash re-check (deferred to a separately-approved read-only execution)

**What may be confirmed under a later, separately-approved read-only command:**

- `br_thinlayer_init_sha256_current`: must equal the Gate 4A §3.1 value
  `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` unless an
  intervening authorised change has been recorded.
- `thin_sdk_iife_sha256_current`: must equal
  `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1`.
- `br_probe_init_sha256_current`: must equal
  `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84`.
- `index_html_sha256_current`: must equal
  `30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c`.

**Default behaviour for PR#18x (the planning / check PR):** **no
re-execution.** PR#18x uses the Gate 4A §3.1 values as the authoritative
record of the current artifact hashes. The four hashes are of
publicly-served static files and are not secret-bearing.

**Optional Gate 4B execution PR behaviour:** if Helen explicitly approves a
separate read-only artifact re-check (e.g. to verify no out-of-band change
since `2026-05-19`), the only commands permitted are `sha256sum
<artifact_path>` (or `shasum -a 256 <artifact_path>`) against each of the
four file paths above. No `cat`, no `head`, no `tail`, no `diff`, no `cp`,
no `mv`, no edit. Any non-matching hash is a stop-line (`unknown_artifact_hash`,
see §7).

### 4.5 Bundle / config change scope identification (Gate 4C dry plan, no execution)

**What must be inventoried before any Gate 4C consideration:**

- `gate_4c_target_files`: the exact file path(s) under
  `/var/www/buyerrecon.com/html/thinlayer/` whose contents must change if a
  Gate 4C `endpointUrl` re-flip is later approved. Based on PR#18p §3.2
  count distribution (`br_thinlayer_init_collect_count=1`, all other
  `*_collect_count=0`, all `*_v1event_count=0`), the only file currently
  carrying a `/collect` literal is **`br-thinlayer-init.js`**. A Gate 4C
  re-flip would change `br-thinlayer-init.js` and only that file.
- `gate_4c_change_shape`: the categorical change shape is a literal-string
  replacement of the Render legacy `/collect` URL with the Sprint 2
  `/v1/event` URL. The exact URLs are recorded in `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`
  §4 (Render legacy) and in the Sprint 2 collector configuration (target).
  PR#18x does not re-record the URL strings here; they belong in the Gate 4C
  PR's `gate_4c_diff_plan` field.
- `gate_4c_pre_count_expected`: `br_thinlayer_init_collect_count=1` (must
  match Gate 4A §3.2 baseline immediately before the flip).
- `gate_4c_post_count_expected`: `br_thinlayer_init_collect_count=0`,
  `br_thinlayer_init_v1event_count=1` (cutover-hard-gates §6.2 "PR B —
  Client Endpoint Change": "pre/post literal counts invert (old endpoint
  count `1 → 0`, new endpoint count `0 → 1`)").
- `gate_4c_files_unchanged_expected`: `thin-sdk.iife.js`,
  `br-probe-init.js`, `index.html`. None of the other three artifacts in
  the Gate 4A inventory should change in a Gate 4C re-flip; any change to
  those three files in a Gate 4C PR is a stop-line.

**Forbidden in PR#18x:** any actual edit, any actual file diff against a
modified source, any `sed`, any `awk -i inplace`, any `patch`, any commit
that ships a modified `br-thinlayer-init.js` artifact. PR#18x records only
the **scope identification**, not the change itself.

### 4.6 Rollback artifact source and rollback procedure source identification

**What must be recorded:**

- `rollback_artifact_source`: the backup artifact present in the production
  backup directory, already recorded as `backup_artifact_present=yes` in
  Gate 4A §3.3. The exact backup directory path is identified by the Gate 4A
  §5.E runbook (`docs/sprint2-pr18o-gate4a-readiness-audit-runbook.md` §5.E);
  PR#18x does not re-record the path here.
- `rollback_procedure_source`: the rollback runbook doc present on the
  production host, already recorded as `rollback_doc_present=yes` in Gate 4A
  §3.3, plus the rollback principle recorded in
  `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md` §4:
  "Rollback to Render legacy is the steady state and remains the one-step
  revert target throughout any downstream implementation PR (per
  `docs/ops/cutover-hard-gates.md` §6 PR D → PR E sequencing and PR#17r
  §11.7)."
- `rollback_one_step_revert_target_category`: `render_legacy_collect`. A
  Gate 4C re-flip's rollback target is the Render legacy `/collect`
  endpoint; rollback restores `br-thinlayer-init.js` to its
  pre-Gate-4C-flip state, which is the **current** state recorded by Gate 4A
  §3.1 hashes.

**Forbidden in PR#18x:** any execution of the rollback procedure; any
restore from backup; any `cp` from the backup directory into the artifact
root; any modification to the rollback runbook doc.

---

## 5. Gate 4C preconditions

Gate 4C (`endpointUrl` re-flip) **remains unapproved** by PR#18x. Before
any Gate 4C PR may be opened — let alone executed — **all** of the following
preconditions must hold:

1. **Explicit Helen GO** for the Gate 4C PR, scoped narrowly to the
   `endpointUrl` re-flip and nothing else. Helen GO is not transferable from
   Gate 4A / Gate 4B / any earlier PR; Gate 4C requires its own GO.
2. **Rollback-first.** The Gate 4C PR must specify, before any forward
   action, the exact one-step revert command, the exact rollback artifact
   source path, the exact rollback procedure source doc, the exact rollback
   verification command, and the categorical evidence field that confirms
   rollback completion. Cutover-hard-gates §2 / §6 / §7 anchors apply.
3. **Exact file diff plan.** The Gate 4C PR must record the exact file path
   (`/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js` per
   §4.5), the exact pre-change literal string, the exact post-change
   literal string, and a categorical attestation that no other file in
   `/var/www/buyerrecon.com/html/` is touched. `thin-sdk.iife.js`,
   `br-probe-init.js`, and `index.html` must remain unchanged.
4. **Exact artifact hash before / after.** The Gate 4C PR must record the
   sha256 of `br-thinlayer-init.js` immediately before the flip (must equal
   the Gate 4A §3.1 baseline
   `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`) and
   immediately after the flip (must be a new, single, recorded value). The
   sha256 of the three unchanged artifacts (`thin-sdk.iife.js`,
   `br-probe-init.js`, `index.html`) must equal their Gate 4A §3.1 baselines
   both before and after. Any sha256 drift in the three "unchanged" files
   is a stop-line.
5. **No raw secrets.** No DSN, no password, no `Authorization:` header, no
   bearer token, no `request_id`, no `session_id`, no payload, no response
   body, no env dump, no private key / cert body, no vault content may be
   printed, echoed, written to disk, captured into a proof, or included in
   any commit by the Gate 4C PR. The hash values themselves are not
   secret-bearing (per PR#18o §4).
6. **Canary scope.** The Gate 4C PR must record what counts as "the canary"
   — typically one controlled human page-load or one approved fixture event
   per cutover-hard-gates §6.3 PR C — and explicitly exclude Track A,
   Playwright, organic-observation, and any synthetic write smoke that has
   not been separately approved by its own Helen GO. The 26 historical
   PR#17s rows recorded in PR#18w §3.5 must be referenced as the prior
   baseline; canary success is measured as a **delta from that baseline**,
   not as an absolute count.
7. **Stop-lines.** The Gate 4C PR must enumerate at least the following
   stop-lines: `route_health_check_5xx`, `route_health_check_4xx_unexpected`,
   `route_health_check_timeout`, `endpointUrl_pre_count_not_one`,
   `endpointUrl_pre_count_drifted`, `endpointUrl_post_count_not_one`,
   `unchanged_artifact_hash_drift`, `unauthorised_file_changed`,
   `request_body_invalid_json_observed_post_flip` (a recurrence of the PR#17s
   pattern is itself a stop-line), `accepted_events_5xx_class_observed`,
   `accepted_events_delta_unexpected`, `lane_writer_activity_observed`,
   `customer_output_observed`, `secret_printed`, `operator_uncertain`. Any
   single triggered stop-line forces a `BLOCKED` verdict and a one-step
   revert to `render_legacy_collect`.
8. **Proof record.** The Gate 4C PR must produce a docs-only proof record
   following the structure of PR#18p / PR#18w (status / verdict, evidence
   summary, stop-line assessment, impact on next gates, boundaries) and
   must explicitly state whether the canary succeeded, failed, or was
   rolled back.

**Until all eight preconditions hold in a single Gate 4C PR proposal,
Gate 4C remains unapproved.** PR#18x does not pre-authorise, sequence, or
schedule any Gate 4C work.

---

## 6. Historical 26-row warning carry-forward

PR#18w §3.5, §5, §7, §8, and §12 record the categorical warning
`historical_rejected_only_v1_event_rows_present=yes`. PR#18x carries that
warning forward verbatim:

- **Count:** `ingest_requests_endpoint_v1_event_count = 26` on the
  production cluster.
- **Window:** `v1_event_first_seen_day = 2026-05-19`,
  `v1_event_last_seen_day = 2026-05-19`. All 26 rows landed on a single day.
- **Status distribution:** `distribution_http_status = 400: 26` — every row
  is HTTP `400`.
- **Reason distribution:** `distribution_reject_reason_code = request_body_invalid_json: 26` —
  every row carries the same reject reason.
- **Downstream propagation:** `accepted_events_count = 0`,
  `rejected_events_count = 0`, `lane_a_row_count = 0`,
  `lane_b_row_count = 0`. No row from the 26 ingest rows propagated into
  accepted events, rejected events, Lane A, or Lane B.
- **Origin:** `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`
  records these 26 rows as the ThinSDK ↔ Sprint 2 `/v1/event`
  contract-shape mismatch evidence. PR#17s §1 records that the rows
  rejected because the request body either parsed to a non-object (most
  likely a top-level JSON array), failed `JSON.parse` outright, or sent a
  body whose envelope shape did not match the strict `application/json`
  single-object contract.
- **Preservation rule:** PR#17s §4 records: "The 26 `ingest_requests`
  evidence rows are preserved. They are categorical evidence of the
  `request_body_invalid_json` rejection pattern." PR#18w honoured that rule;
  PR#18x honours it; **any future Gate 4B execution PR, Gate 4C canary PR,
  Gate 4D observation PR, Gate 4E Track A / Playwright PR, issue-fix PR,
  and final scoring / governance recap PR must continue to honour it.** No
  PR is authorised to delete, mutate, annotate, or otherwise modify those 26
  rows on the production cluster.

**Gate 4C planning impact.** Any Gate 4C canary PR that contemplates
re-flipping `endpointUrl` to `/v1/event` must:

- explicitly reference the PR#17s 26-row baseline,
- measure canary success as a **delta from that 26-row baseline**, not as
  an absolute count,
- record `ingest_requests_endpoint_v1_event_pre_count = 26` immediately
  before the flip (any drift is a stop-line — see §7),
- enumerate `request_body_invalid_json_observed_post_flip` as a stop-line
  (a recurrence of the PR#17s pattern is a regression, not a success),
- not delete, mutate, or annotate the original 26 rows under any
  circumstance.

**Final recap requirement.** The final scoring / governance recap PR
required before any production-cutover readiness claim must continue to
carry forward the 26-row warning, the PR#17s reference, and the
"do-not-delete" rule.

---

## 7. Stop-lines

Gate 4B planning / check (PR#18x) and any later Gate 4B execution PR must
treat each of the following as a categorical stop-line. Any single
triggered stop-line forces a `BLOCKED` verdict at the relevant layer and
requires resolution in a separate diagnostic / fix PR before any Gate 4C
consideration.

- **`artifact_root_unknown`** — the website root or ThinLayer root cannot
  be categorically identified as `/var/www/buyerrecon.com/html` or
  `/var/www/buyerrecon.com/html/thinlayer`.
- **`artifact_missing`** — any of `br-thinlayer-init.js`,
  `thin-sdk.iife.js`, `br-probe-init.js`, or `index.html` is not present
  under its expected root.
- **`unknown_artifact_hash`** — under a separately-approved §4.4 hash
  re-check, any of the four artifacts produces a sha256 that does not
  match the Gate 4A §3.1 baseline and no intervening authorised change has
  been recorded.
- **`unchanged_artifact_hash_drift`** — at any Gate 4C pre / post
  measurement window, the sha256 of `thin-sdk.iife.js`,
  `br-probe-init.js`, or `index.html` differs from the Gate 4A §3.1
  baseline (only `br-thinlayer-init.js` is authorised to change in a
  Gate 4C re-flip).
- **`rollback_missing`** — the backup directory, the backup artifact, or
  the rollback runbook doc is missing or unreadable. (Gate 4A §3.3
  recorded all three as `yes`; any regression is a stop-line.)
- **`endpoint_already_flipped_unexpectedly`** — `endpointUrl_category` is
  not `render_legacy_collect` without a recorded prior Gate 4C approval
  (e.g. the category is `sprint2_v1_event` or `unknown`).
- **`both_collect_and_v1event_present_unexpectedly`** — both the Render
  legacy `/collect` literal **and** the Sprint 2 `/v1/event` literal
  appear in the same ThinLayer artifact without a recorded prior Gate 4C
  approval. Cutover-hard-gates §6.2 requires the pre / post literal counts
  to **invert** (`1 → 0`, `0 → 1`); both being non-zero simultaneously
  indicates a botched flip and triggers a one-step revert.
- **`production_db_grant_warning_regression`** — the PR#18w §3.6
  migration-016 Lane grant posture no longer holds (e.g.
  `buyerrecon_customer_api` gains SELECT or DML on Lane tables,
  `buyerrecon_scoring_worker` gains any access, `buyerrecon_prod_audit_readonly`
  gains INSERT / UPDATE / DELETE, or `PUBLIC` gains any access).
- **`production_db_traffic_regression`** — `accepted_events_count`,
  `rejected_events_count`, `lane_a_row_count`, or `lane_b_row_count` is
  no longer `0` without a recorded prior Gate 4C canary approval; or
  `ingest_requests_endpoint_v1_event_count` exceeds the PR#17s 26-row
  baseline without a recorded prior Gate 4C canary approval.
- **`secret_printed`** — any DSN value, generated password, `Authorization:`
  header, bearer token, `request_id`, `session_id`, raw payload, raw
  response body, env dump, private key / cert body, vault content, shell
  history line, or raw row surfaces into any operator shell, scratch report,
  chat, PR comment, terminal scrollback, screenshot, or other artifact.
- **`production_traffic_generated`** — any HTTP call from the operator
  shell to the production collector (`/v1/event`, `/collect`, or any
  other production route), any browser-driven page-load aimed at
  generating production telemetry, or any other traffic-generating
  activity occurs under PR#18x scope.
- **`var_www_edit`** — any `cp`, `mv`, `rm`, `chown`, `chmod`, `ln -s`,
  `rsync`, `sed -i`, `awk -i inplace`, `patch`, or other write operation
  is performed under `/var/www/` by PR#18x scope.
- **`service_state_change`** — any `systemctl`, `nginx -s reload`, service
  restart, or other live-service mutation is performed under PR#18x scope.
- **`operator_uncertain`** — at any point the operator cannot
  categorically confirm a required value (host category, artifact root,
  artifact presence, endpoint category, rollback presence). Uncertainty
  is a stop-line; do not guess.

---

## 8. Non-goals (hard boundaries)

PR#18x explicitly does **not** approve any of the following. Each requires
its own explicit Helen GO scoped to that specific work:

- no Gate 4B execution beyond the planning / check recorded here,
- no `endpointUrl` re-flip,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no `/var/www` edit,
- no `cp` / `mv` / `rm` / `chown` / `chmod` / `ln -s` / `rsync` against any
  production path,
- no `sed -i` / `awk -i inplace` / `patch` against any production file,
- no `nginx -s reload`, no `systemctl`, no service restart,
- no DNS change,
- no production traffic generation,
- no `buyerrecon.com` production `/v1/event` call,
- no Render `/collect` call,
- no production DB mutation,
- no DB grants (no broadening, no narrowing, no `GRANT` / `REVOKE`),
- no migrations,
- no `schema.sql` change,
- no env file edit,
- no credential rotation,
- no `buyerrecon_prod_collector_app` reset,
- no `buyerrecon_migrator` reset,
- no production token provisioning,
- no Lane A/B writer,
- no customer-facing output (Pass 1 / Trust / Pass 2 / Lane report /
  dashboard),
- no dashboard implementation,
- no AMS runtime bridge,
- no Pass 1 / Trust / Pass 2 runtime,
- no runtime scoring,
- no Track A,
- no Playwright,
- no Gate 4C canary,
- no Gate 4C `endpointUrl` re-flip,
- no Gate 4D organic observation,
- no Gate 4E Track A / Playwright work,
- no secret printing (DSN, generated password, DB username / password
  pair, `Authorization:` header, raw `request_id`, raw `session_id`, raw
  payload, raw response body, env dump, private key / cert body, vault
  content, shell history, raw row data),
- no deletion, mutation, or annotation of the 26 historical PR#17s rows
  on the production cluster.

---

## 9. Acceptance criteria

PR#18x is acceptable for merge into `sprint2-architecture-contracts-d4cc2bf`
only if **all** of the following hold:

- **Docs-only.** Exactly one new file changes:
  `docs/sprint2-pr18x-gate4b-artifact-config-check.md`. No code, no
  scripts, no tests, no package files, no migrations, no `schema.sql`, no
  env files, no systemd / Nginx files, no AMS source, no website
  artifacts, no production config, no DB grant files change.
- **Gate 4B planning / check only.** No execution. No re-run of the
  read-only artifact check unless Helen explicitly approves a separate
  Gate 4B execution PR (see §4.4 default). PR#18x's §3 evidence is
  carried verbatim from PR#18p / PR#18w; PR#18x records no new
  categorical production fields.
- **Gate 4C remains unapproved.** No `endpointUrl` re-flip, no canary, no
  pre-authorisation of Gate 4C. §5's eight preconditions are inventory,
  not approval.
- **Final scoring / governance recap PR requirement preserved.** PR#18x
  §6 carries the 26-row warning and the recap requirement forward; PR#18x
  does not substitute for the recap.
- **No secrets printed or committed.** PR#18x contains no DSN value, no
  generated password, no `Authorization:` header value, no bearer token,
  no raw `request_id`, no raw `session_id`, no raw payload, no raw
  response body, no env dump, no private key / cert body, no vault
  content, no shell history, no raw row. The four sha256 hashes carried
  from PR#18p §3.1 are publicly-served static-artifact hashes and are not
  secret-bearing per PR#18o §4.
- **No runtime, no traffic, no endpoint flip.** PR#18x makes no HTTP
  call, generates no production traffic, performs no `endpointUrl`
  rewrite, and triggers no service-state change. PR#18x is a planning
  / check document, not an execution.

---

## 10. Relationship to Gate 4 sub-gates and the final recap PR

PR#18x sits between Gate 4A (PR#18w `PASS_WITH_WARNINGS`) and Gate 4C
(unapproved) in the Gate 4 sub-gate sequence:

- **Gate 4A** (`docs/sprint2-pr18w-gate4a-db-grant-traffic-reaudit-proof.md`) —
  DB / grant / traffic re-audit. `PASS_WITH_WARNINGS`. Closes the
  DB / binding / category / grant blocker recorded in PR#18p.
- **Gate 4B** (PR#18x — this PR) — website artifact / config bundle
  planning / check. `PLANNING / CHECK ONLY`. Inventories the artifact
  root, static artifact presence, endpoint category, hash baseline,
  bundle change scope, and rollback artifact / procedure source. Does
  **not** authorise any Gate 4C canary.
- **Gate 4C** (not yet opened) — `endpointUrl` re-flip canary, scoped to
  cutover-hard-gates §6.2 PR B and §6.3 PR C semantics. Requires all
  eight §5 preconditions.
- **Gate 4D** (not yet opened) — passive organic observation, scoped to
  cutover-hard-gates §6.4 PR D semantics. Requires Gate 4C to close
  non-`BLOCKED`.
- **Gate 4E** (not yet opened) — Track A / Playwright, scoped to
  cutover-hard-gates §6.5 PR E semantics. Requires Gate 4A → Gate 4D to
  close non-`BLOCKED`.
- **Final scoring / governance recap PR** (not yet opened) — required
  after Gate 4A → Gate 4E and any issue-fix PRs, before any
  production-cutover readiness claim. Must carry forward the customer
  governance locks (`customer_claim_allowed=false`,
  `lane_output_allowed=false`, `customer_visibility_allowed=false`,
  `lane_write_allowed=false`, `allowed_customer_language=[]`), the PR#18v
  / PR#18w / PR#18x verdicts, the 26-row PR#17s warning, the converted
  migration-016 Lane grant safety status, Gate 4C / 4D / 4E outcomes once
  recorded, and the rollback posture.

No production-cutover readiness claim may rely on PR#18x alone. PR#18x is
the planning layer for Gate 4B; it is not the recap.

---

End of PR#18x. **Gate 4B website artifact / config bundle planning / check.
Verdict: PLANNING / CHECK ONLY. Inventories the production website artifact
roots (`/var/www/buyerrecon.com/html`,
`/var/www/buyerrecon.com/html/thinlayer`), the four static artifacts
(`br-thinlayer-init.js`, `thin-sdk.iife.js`, `br-probe-init.js`,
`index.html`), the Gate 4A §3.1 hash baseline
(`br_thinlayer_init_sha256=9b0e4530…cc2efda0`,
`thin_sdk_iife_sha256=7098d648…c53538d1`,
`br_probe_init_sha256=09d68188…17060f84`,
`index_html_sha256=30b46c12…3810965c`), the current endpoint category
(`render_legacy_collect`, `render_collect_legacy_present=yes`,
`sprint2_endpoint_config_present=no`), the rollback posture
(`backup_dir_present=yes`, `backup_artifact_present=yes`,
`rollback_doc_present=yes`, `rollback_artifact_exists=yes`), the Gate 4C
bundle change scope (only `br-thinlayer-init.js` changes; the other three
artifacts must remain unchanged; pre / post literal counts must invert
`1 → 0` / `0 → 1`), and the rollback artifact / procedure source. Carries
the PR#18w 26-row historical PR#17s warning forward verbatim with a
do-not-delete rule for those rows. Defines eight Gate 4C preconditions
(explicit Helen GO, rollback-first, exact file diff plan, exact artifact
hash before / after, no raw secrets, canary scope, stop-lines, proof
record); Gate 4C remains unapproved until all eight hold in a single
Gate 4C PR proposal. No `endpointUrl` re-flip, no production traffic
generation, no `/var/www` edit, no `rsync` / `cp` / `mv` / `rm` against
production files, no Nginx reload, no `systemctl`, no DNS change, no DB
write, no DB grant, no migration, no `schema.sql` change, no env file
edit, no credential rotation, no production token provisioning, no
website ThinSDK production-mode activation, no production artifact /
config mode flip, no Lane A/B writer, no customer-facing output, no
dashboard, no AMS runtime bridge, no Pass 1 / Trust / Pass 2 runtime, no
runtime scoring, no Track A, no Playwright, no Gate 4C canary, no
Gate 4D observation, no Gate 4E Track A / Playwright work, no deletion /
mutation / annotation of the 26 historical PR#17s rows on the production
cluster, and no secret printing are approved by PR#18x. Any future
Gate 4B execution PR (e.g. a separately-approved §4.4 read-only hash
re-check), Gate 4C canary PR (which must satisfy §5's eight
preconditions and reference the PR#17s 26-row baseline), Gate 4D
observation PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime
PR, customer-surface PR, or final scoring / governance recap PR remains
separately gated by its own explicit Helen GO.**
