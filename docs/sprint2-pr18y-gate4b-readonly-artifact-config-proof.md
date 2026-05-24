# Sprint 2 PR#18y: Gate 4B Read-Only Artifact / Config Check Execution Proof

> Docs-only proof record. No execution is performed by this PR.
> The Gate 4B read-only artifact / config checks recorded by this PR were
> carried out manually by the operator (Helen) on the production host under
> explicit Helen GO scoped to Gate 4B read-only artifact / config checks
> only. The categorical paste-back from that execution is recorded into
> §5–§8 and §10 of this doc.

---

## 1. Status / verdict

**Verdict: BLOCKED.**

Gate 4B read-only artifact / config check execution proof, scoped to the
planning / check layer defined in PR#18x / PR #56 (verdict
`PLANNING / CHECK ONLY`).

**Stop-lines triggered (§10):** `rollback_artifact_source_missing`,
`rollback_procedure_source_missing`.

The artifact / endpoint surfaces are clean — every required check returned
the expected value:

- `host_category=production`, `operator_user_category=root`,
  `shell_trace=off`, `histfile_unset=yes`, `umask_077=yes`.
- `website_root_exists=yes`, `thinlayer_root_exists=yes`; all four static
  artifacts present.
- All four sha256 hashes match the PR#18p §3.1 / PR#18x §3.1 baseline
  exactly (`*_match_baseline=yes` for every artifact).
- `endpointUrl_category=render_legacy_collect`,
  `render_collect_legacy_present=yes`,
  `sprint2_endpoint_config_present=no`,
  `both_collect_and_v1event_present=no`. Per-artifact `/collect` and
  `/v1/event` counts match the PR#18p §3.2 baseline.
- `var_www_unchanged_after_check=yes`, `cleanup_done=yes`. No `/var/www`
  edit, no production traffic generated, no secret printed.

The blocker is in §8 rollback posture: at the moment of PR#18y execution,
the production host's backup directory, backup artifact, and rollback
procedure source were all categorically absent
(`rollback_backup_dir_present=no`, `rollback_backup_artifact_present=no`,
`rollback_procedure_source_present=no`, aggregate
`rollback_artifact_source_present=no`). Per the §1 classification rule
("**BLOCKED** is required if any §10 stop-line is triggered"), this forces
a `BLOCKED` verdict, regardless of the otherwise-clean artifact and endpoint
posture. This is also a categorical regression versus the PR#18p §3.3
baseline, which recorded `backup_dir_present=yes`,
`backup_artifact_present=yes`, `rollback_doc_present=yes`, and
`rollback_artifact_exists=yes` — a separate diagnostic / fix PR (under its
own Helen GO) is required to identify the cause of the regression and
reconstitute the rollback artifact + rollback procedure source on the
production host before any Gate 4C consideration can proceed.

### Verdict classification rule (applied to this proof in §1)

**PASS** would have required all of:

- `host_category=production`, `operator_user_category` ∈ {`root`,
  `web_admin`}, `shell_trace=off`, `histfile_unset=yes`, `umask_077=yes`;
- `website_root_exists=yes`, `thinlayer_root_exists=yes`;
- `br_thinlayer_init_js_present=yes`, `thin_sdk_iife_js_present=yes`,
  `br_probe_init_js_present=yes`, `index_html_present=yes`;
- each sha256 in §6 equals the PR#18p §3.1 / PR#18x §3.1 baseline:
  - `br_thinlayer_init_sha256_current = 9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`,
  - `thin_sdk_iife_sha256_current = 7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1`,
  - `br_probe_init_sha256_current = 09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84`,
  - `index_html_sha256_current = 30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c`;
- `endpointUrl_category=render_legacy_collect`,
  `render_collect_legacy_present=yes`,
  `sprint2_endpoint_config_present=no`,
  `both_collect_and_v1event_present=no`;
- `rollback_artifact_source_present=yes`,
  `rollback_procedure_source_present=yes`;
- `cleanup_done=yes`, `var_www_unchanged_after_check=yes`,
  no secrets printed during the check.

All conditions except the rollback pair are met. The rollback pair is
**not** met, so PASS does not apply.

**PASS_WITH_WARNINGS** would have been permitted only if all stop-lines
were `no` and the §9 historical PR#17s 26-row warning was the only carried
warning. Stop-lines are not all `no`, so PASS_WITH_WARNINGS does not apply.

**BLOCKED** is required because two §10 stop-lines are triggered
(`rollback_artifact_source_missing`, `rollback_procedure_source_missing`).

### Scope boundaries

- No `endpointUrl` re-flip.
- No Gate 4C approval, no canary, no production traffic generation.
- No HTTP call to the production collector by this check (no `curl`, no
  `wget`, no `httpie`, no `nc`, no browser).
- No `/var/www` edit. No `cp` / `mv` / `rm` / `chown` / `chmod` / `ln -s` /
  `rsync` / `sed -i` / `awk -i inplace` / `patch` against any production
  file.
- No symlink change.
- No `nginx -s reload`, no `systemctl`, no service restart.
- No DNS change.
- No DB write, no DB grant, no migration, no `schema.sql` change.
- No env file edit, no credential rotation, no token provisioning.
- No website ThinSDK production-mode activation.
- No production artifact / config mode flip.
- No customer-facing output, no Lane A/B writer, no runtime scoring.
- No Track A, no Playwright.
- No Gate 4C / Gate 4D / Gate 4E execution.
- No secrets printed (no DSN, no password, no `Authorization:` header value,
  no bearer token, no raw `request_id`, no raw `session_id`, no raw payload,
  no raw response body, no env dump, no private key / cert body, no vault
  content, no shell history, no raw row data).
- No `cat` / `head` / `tail` / `diff` of the four JS artifact contents
  except for **bounded `grep -c`** on the explicit endpoint string in §4.4
  (count-only; no surrounding-line capture).
- No deletion, mutation, annotation, or normalisation of the 26 historical
  PR#17s rows on the production cluster.

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

## 2. Scope and non-approval

PR#18y is the **read-only Gate 4B artifact / config check execution proof**
authorised by the operator approval boundary stated in §1 (read-only
artifact / config checks, static file existence checks, static file SHA-256
hash capture, endpoint / config category inspection without changing files,
rollback artifact / source presence check, docs-only proof record).

PR#18y does **not** approve:

- Gate 4C `endpointUrl` re-flip.
- Gate 4C canary (any controlled human page-load, fixture event, or
  synthetic write smoke).
- Production traffic generation (no `curl`, no `wget`, no browser-driven
  page-load aimed at generating production telemetry).
- Any artifact / config change (no edit, no `cp`, no `mv`, no `rm`, no
  `chown`, no `chmod`, no `ln -s`, no `rsync`, no `sed -i`, no `awk -i
  inplace`, no `patch`).
- Any production artifact / config mode flip.
- Any website ThinSDK production-mode activation.
- Any DB write, DB grant, migration, `schema.sql` change, env file edit,
  credential rotation, or token provisioning.
- Any Lane A/B writer, customer-facing output, runtime scoring, AMS
  runtime bridge, dashboard implementation, or Pass 1 / Trust / Pass 2
  runtime.
- Any Track A or Playwright work.
- Gate 4C, Gate 4D, or Gate 4E in any form.

PR#18y is one input to the final scoring / governance recap PR; it is not
the recap itself (see §11).

---

## 3. Base state

- **Base branch:** `sprint2-architecture-contracts-d4cc2bf`.
- **Base HEAD:** `2f8a37b84dda65eeb79c4ed67a270d4002fab1bd` — `Sprint 2 PR#18x: plan Gate 4B artifact config check (#56)`.
- **PR#18x merge state (source planning PR):** MERGED into base as
  PR #56 on `2026-05-24T10:49:48Z`; merge commit
  `2f8a37b84dda65eeb79c4ed67a270d4002fab1bd`.
- **PR#18x planning doc present on base:**
  `docs/sprint2-pr18x-gate4b-artifact-config-check.md` (664 lines).
- **PR#18w proof present on base:**
  `docs/sprint2-pr18w-gate4a-db-grant-traffic-reaudit-proof.md` —
  `PASS_WITH_WARNINGS`, warning `historical_rejected_only_v1_event_rows_present`.
- **PR#18v proof present on base:**
  `docs/sprint2-pr18v-production-audit-readonly-credential-proof.md` —
  `PASS`.
- **PR#18y working branch:**
  `buyerrecon-sprint2-pr18y-gate4b-readonly-artifact-config-proof`.
- **PR#18y branch parent commit:** `2f8a37b84dda65eeb79c4ed67a270d4002fab1bd`
  (same as base HEAD; branch created from clean base).
- **Working tree at finalisation:** clean except for this proof file
  (verified by `git status --short --untracked-files=all` at finalisation
  time).

The §1 / §2 boundaries and the §4 command set are derived from PR#18x
§4 / §5 / §7 (Gate 4B checklist, Gate 4C preconditions, stop-lines) and
from `docs/sprint2-pr18o-gate4a-readiness-audit-runbook.md` §5.C / §5.D /
§5.E (the artifact / endpoint / rollback read-only methodology validated
by PR#18p).

---

## 4. Read-only checks (operator command set)

The following command set is the verbatim §A–§F read-only operator package
that Helen runs on the production host to produce the §5–§8 categorical
fields. All commands are read-only against production: no edit, no copy,
no move, no remove, no chown, no chmod, no symlink, no service reload, no
HTTP call to the production collector, no traffic generation, no secret
captured.

> **Operator-only invariants throughout §4:** no `cat` / `head` / `tail` /
> `diff` of artifact contents (only `ls -la`, `test -f`, `sha256sum` /
> `shasum -a 256`, and bounded `grep -c` of explicit endpoint strings); no
> `find` walking outside the two named roots; no `stat` against owner /
> permission bits beyond what `ls -la` shows in summary; no DSN, no
> password, no `Authorization:` header value, no bearer token, no raw
> `request_id`, no raw `session_id`, no raw payload, no raw response body,
> no env dump, no private key / cert body, no vault content, no shell
> history, no raw row data.

### A. Shell safety preflight

```
set +x
unset HISTFILE
umask 077

echo "shell_trace: $([[ "$-" == *x* ]] && echo on || echo off)"
echo "histfile_unset: $([ -z "${HISTFILE:-}" ] && echo yes || echo no)"
echo "umask_077: $(umask | grep -q 0077 && echo yes || echo check_manually)"
hostname
whoami
```

Paste-back into §5.1:

- `host_category`: <production|staging|local|unknown>
- `operator_user_category`: <root|web_admin|unexpected>
- `shell_trace`: <on|off>
- `histfile_unset`: <yes|no>
- `umask_077`: <yes|no>

Stop immediately if `host_category` is not `production`.

### B. Artifact root existence

```
echo "website_root_exists: $([ -d /var/www/buyerrecon.com/html ] && echo yes || echo no)"
echo "thinlayer_root_exists: $([ -d /var/www/buyerrecon.com/html/thinlayer ] && echo yes || echo no)"
```

Paste-back into §5.2.

### C. Static artifact presence

```
echo "br_thinlayer_init_js_present: $([ -f /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js ] && echo yes || echo no)"
echo "thin_sdk_iife_js_present:    $([ -f /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js ] && echo yes || echo no)"
echo "br_probe_init_js_present:    $([ -f /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js ] && echo yes || echo no)"
echo "index_html_present:          $([ -f /var/www/buyerrecon.com/html/index.html ] && echo yes || echo no)"
```

Paste-back into §5.3.

### D. SHA-256 hash capture (public static artifacts only, no contents)

`sha256sum` is preferred; `shasum -a 256` is the fallback when `sha256sum`
is unavailable. Both emit only `<hash>  <path>` — no file contents.

```
sha256sum /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js \
          /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js \
          /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js \
          /var/www/buyerrecon.com/html/index.html 2>/dev/null \
  || shasum -a 256 /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js \
                    /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js \
                    /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js \
                    /var/www/buyerrecon.com/html/index.html
```

Paste-back into §6 (record each hash as `<artifact>_sha256_current = <value>`).

### E. Endpoint / config category inspection (bounded grep -c, no contents)

Bounded `grep -c` against each of the four artifacts for the two endpoint
literals. Only the count is captured; no surrounding-line context, no
`grep -B` / `-A` / `-C`, no `-o`. The exact literal strings searched are
`/collect` (Render legacy) and `/v1/event` (Sprint 2 target).

```
for f in \
  /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js \
  /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js \
  /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js \
  /var/www/buyerrecon.com/html/index.html; do
  echo "${f##*/} /collect count:  $(grep -c '/collect' "$f" 2>/dev/null || echo 0)"
  echo "${f##*/} /v1/event count: $(grep -c '/v1/event' "$f" 2>/dev/null || echo 0)"
done
```

Classification (operator-recorded):

- `endpointUrl_category`: `render_legacy_collect` if any `/collect` count is
  `>=1` **and** every `/v1/event` count is `0`;
  `sprint2_v1_event` if any `/v1/event` count is `>=1` **and** every
  `/collect` count is `0`;
  `both_present` if any artifact shows **both** `/collect` count `>=1` and
  `/v1/event` count `>=1`, or if both endpoints surface in the artifact set
  in a combination not authorised by a recorded Gate 4C approval;
  `unknown` in every other case.
- `render_collect_legacy_present`: `yes` if any artifact shows `/collect`
  count `>=1`; `no` otherwise.
- `sprint2_endpoint_config_present`: `yes` if any artifact shows `/v1/event`
  count `>=1`; `no` otherwise.
- `both_collect_and_v1event_present`: `yes` if any single artifact (or the
  artifact set together) shows non-zero counts for both literals; `no`
  otherwise.

Paste-back into §7.

### F. Rollback artifact / procedure presence

The exact backup directory path and rollback runbook doc path live on the
production host and are referenced by name only — not by raw path — in
this proof. The operator-recorded paths must categorically confirm
presence (the doc reference is to the operator's existing rollback
runbook plus `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`
§4).

```
# Operator confirms each presence categorically; record only yes/no.
# (Replace <production_backup_dir>, <production_backup_artifact>, and
#  <production_rollback_doc> with the exact paths from the rollback runbook;
#  do not paste those paths into the public proof — only record yes/no.)
test -d <production_backup_dir>          && echo "rollback_backup_dir_present: yes"          || echo "rollback_backup_dir_present: no"
test -f <production_backup_artifact>     && echo "rollback_backup_artifact_present: yes"     || echo "rollback_backup_artifact_present: no"
test -f <production_rollback_doc>        && echo "rollback_procedure_source_present: yes"    || echo "rollback_procedure_source_present: no"
```

Aggregate field (operator-recorded):

- `rollback_artifact_source_present`: `yes` if both
  `rollback_backup_dir_present=yes` and `rollback_backup_artifact_present=yes`;
  `no` otherwise.
- `rollback_procedure_source_present`: pasted directly from the third
  command above.

Paste-back into §8.

### G. Cleanup

```
# No DSN or DB shell variables were set by this check; nothing to unset.
# Confirm /var/www unchanged by listing top-level mtimes only (no contents).
echo "var_www_unchanged_after_check: yes"   # operator-attested; categorical
echo "cleanup_done: yes"
```

Paste-back into §8 cleanup fields.

---

## 5. Artifact root and presence results

All fields below are recorded verbatim from the operator's pasted execution
block.

### 5.1 Host / shell safety preflight (§4.A)

- `host_category`: `production`
- `operator_user_category`: `root`
- `shell_trace`: `off`
- `histfile_unset`: `yes`
- `umask_077`: `yes`

### 5.2 Artifact root existence (§4.B)

- `website_root_exists` (`/var/www/buyerrecon.com/html`): `yes`
- `thinlayer_root_exists` (`/var/www/buyerrecon.com/html/thinlayer`): `yes`

### 5.3 Static artifact presence (§4.C)

- `br_thinlayer_init_js_present`: `yes`
- `thin_sdk_iife_js_present`: `yes`
- `br_probe_init_js_present`: `yes`
- `index_html_present`: `yes`

---

## 6. Artifact hash results

All fields below are recorded verbatim from the operator's pasted §4.D
execution output. The four sha256 values are of publicly-served static
artifact files and are therefore not secret-bearing (per
`docs/sprint2-pr18o-gate4a-readiness-audit-runbook.md` §4 and PR#18p §3.1).

Baseline values, captured by PR#18p §3.1 on the same artifact set and
re-recorded by PR#18x §3.1:

- `br_thinlayer_init_sha256_baseline = 9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`
- `thin_sdk_iife_sha256_baseline    = 7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1`
- `br_probe_init_sha256_baseline    = 09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84`
- `index_html_sha256_baseline       = 30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c`

Current values (PR#18y execution):

- `br_thinlayer_init_sha256_current`: `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`
- `thin_sdk_iife_sha256_current`: `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1`
- `br_probe_init_sha256_current`: `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84`
- `index_html_sha256_current`: `30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c`

Match assessment:

- `br_thinlayer_init_sha256_match_baseline`: **yes**
- `thin_sdk_iife_sha256_match_baseline`: **yes**
- `br_probe_init_sha256_match_baseline`: **yes**
- `index_html_sha256_match_baseline`: **yes**

All four current hashes match their PR#18p §3.1 / PR#18x §3.1 baselines
character-for-character. The `unknown_artifact_hash` stop-line (§10) is
**not** triggered. The static-artifact bundle has not drifted since PR#18p
recorded the baseline; `br-thinlayer-init.js`, `thin-sdk.iife.js`,
`br-probe-init.js`, and `index.html` are byte-identical to their PR#18p
state.

---

## 7. Endpoint / config category result

All fields below are recorded verbatim from the operator's pasted §4.E
execution output (bounded `grep -c` only; no surrounding-line context
captured).

Per-artifact `/collect` and `/v1/event` literal counts:

- `br_thinlayer_init.js /collect count`: `1`  *(PR#18p baseline: `1`; match)*
- `br_thinlayer_init.js /v1/event count`: `0`  *(PR#18p baseline: `0`; match)*
- `thin_sdk.iife.js /collect count`: `0`  *(PR#18p baseline: `0`; match)*
- `thin_sdk.iife.js /v1/event count`: `0`  *(PR#18p baseline: `0`; match)*
- `br_probe_init.js /collect count`: `0`  *(PR#18p baseline: `0`; match)*
- `br_probe_init.js /v1/event count`: `0`  *(PR#18p baseline: `0`; match)*
- `index.html /collect count`: `0`  *(PR#18p baseline: not previously recorded; first recorded value `0`)*
- `index.html /v1/event count`: `0`  *(PR#18p baseline: not previously recorded; first recorded value `0`)*

Category classification:

- `endpointUrl_category`: `render_legacy_collect`
- `render_collect_legacy_present`: `yes`
- `sprint2_endpoint_config_present`: `no`
- `both_collect_and_v1event_present`: `no`

**Sprint 2 `/v1/event` activation status.** Categorically attested as **not
active** in the production ThinLayer artifact set: every artifact's
`/v1/event` count is `0`, `sprint2_endpoint_config_present=no`, and
`both_collect_and_v1event_present=no`. The
`endpoint_already_flipped_unexpectedly` and
`both_collect_and_v1event_present_unexpectedly` stop-lines (§10) are
**not** triggered. The production website remains on the Render legacy
`/collect` capture path, consistent with PR#18p §3.2,
`docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md` §4, and
PR#18x §3.2 / §4.3.

**Operator note (§4.E output shape).** The §4.E `for`-loop with a `grep -c
… || echo 0` fallback emits an extra standalone `0` line when `grep -c`
returns non-zero exit status on a zero-match case. The eight categorical
counts above are distilled from the labelled count lines only; the extra
standalone `0` lines are not categorical fields and have been discarded.
No artifact contents were captured.

---

## 8. Rollback posture

All fields below are recorded verbatim from the operator's pasted §4.F
and §4.G execution output. No rollback was executed; presence-only.

- `rollback_backup_dir_present`: **`no`**
- `rollback_backup_artifact_present`: **`no`**
- `rollback_artifact_source_present` (aggregate; `yes` only if both
  `rollback_backup_dir_present=yes` and
  `rollback_backup_artifact_present=yes`): **`no`**
- `rollback_procedure_source_present`: **`no`**
- `var_www_unchanged_after_check`: `yes`
- `cleanup_done`: `yes`

Rollback target category (carried from PR#18x §4.6 and PR#17s §4):

- `rollback_one_step_revert_target_category` = `render_legacy_collect`. A
  Gate 4C re-flip's rollback target would be the Render legacy `/collect`
  endpoint; rollback would restore `br-thinlayer-init.js` to its
  pre-Gate-4C-flip state, which is the **current** state (Gate 4A §3.1 /
  PR#18x §3.1 hashes, re-confirmed by §6 above). The artifact-side
  predicate for rollback (the on-host current artifact set) is intact;
  what is **missing** is the on-host backup of the pre-flip state and the
  on-host rollback procedure source.

**Regression versus PR#18p §3.3.** PR#18p §3.3 recorded
`backup_dir_present=yes`, `backup_artifact_present=yes`,
`rollback_doc_present=yes`, and `rollback_artifact_exists=yes`. PR#18y §8
records the same four surfaces as `no` (via the §4.F probe of the paths
identified by the production rollback runbook). This is a categorical
regression in rollback posture between PR#18p execution and PR#18y
execution. Possible causes (to be diagnosed in a separate fix PR, not
here): the backup directory / backup artifact / rollback procedure
source was deleted, moved, renamed, or relocated; the production rollback
runbook's path references became stale; or the PR#18p paste-back was
imprecise. PR#18y does not attempt to diagnose the cause inline — the
diagnostic / fix work belongs in a separate PR under its own Helen GO.

**Rollback-readiness implication.** Until the rollback backup directory,
backup artifact, and rollback procedure source are reconstituted on the
production host and a follow-up Gate 4B re-audit produces a non-`BLOCKED`
verdict, **any Gate 4C consideration is forbidden**. The cutover-hard-gates
§6 "rollback-first" principle requires the rollback artifact and the
rollback procedure to be present and verified before any Gate 4C re-flip
PR may even be proposed (see PR#18x §5 precondition 2 and §11
precondition 2 of this proof).

---

## 9. Historical 26-row warning carry-forward

PR#18y carries the PR#17s / PR#18w 26-row warning forward verbatim. This
section did not require operator paste-back; the evidence is already
recorded on base in
`docs/sprint2-pr18w-gate4a-db-grant-traffic-reaudit-proof.md` §3.5 / §5 /
§7 and `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`
§1 / §4. PR#18y is read-only-artifact-scope and does not re-query the DB.

- **Count:** `ingest_requests_endpoint_v1_event_count = 26` on the
  production cluster (per PR#18w §3.5).
- **Window:** `v1_event_first_seen_day = 2026-05-19`,
  `v1_event_last_seen_day = 2026-05-19`. All 26 rows landed on a single day
  (per PR#18w §3.5).
- **Status distribution:** `distribution_http_status = 400: 26` — every row
  is HTTP `400` (per PR#18w §3.5).
- **Reason distribution:** `distribution_reject_reason_code =
  request_body_invalid_json: 26` — every row carries the same reject reason
  (per PR#18w §3.5).
- **Downstream propagation:** `accepted_events_count = 0`,
  `rejected_events_count = 0`, `lane_a_row_count = 0`,
  `lane_b_row_count = 0`. No row from the 26 ingest rows propagated into
  accepted events, rejected events, Lane A, or Lane B (per PR#18w §3.5).
- **Origin:** the 26 rows are the ThinSDK ↔ Sprint 2 `/v1/event`
  contract-shape mismatch evidence documented in PR#17s.
- **Preservation rule (carried forward verbatim from PR#17s §4 and PR#18w):**
  "The 26 `ingest_requests` evidence rows are preserved. They are
  categorical evidence of the `request_body_invalid_json` rejection
  pattern." **Do not delete, mutate, annotate, or normalise these rows
  away.** PR#18y does not query, touch, or otherwise interact with these
  rows; the artifact / config check scope is independent of the DB.

Any future Gate 4B execution PR, Gate 4C canary PR, Gate 4D observation
PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime PR,
customer-surface PR, or final scoring / governance recap PR must continue
to honour the do-not-delete / do-not-mutate / do-not-annotate /
do-not-normalise rule for these 26 rows. Gate 4C canary success must be
measured as a **delta from the 26-row baseline**, not as an absolute
count.

---

## 10. Stop-line assessment

Each stop-line is recorded categorically from §5–§8 and the operator's
paste-back. Any single triggered stop-line forces a `BLOCKED` verdict.

- `artifact_root_unknown_or_missing` (§4.B `website_root_exists=no` or `thinlayer_root_exists=no`): **no** *(both roots exist per §5.2)*
- `any_required_artifact_missing` (§4.C any `_present=no`): **no** *(all four artifacts present per §5.3)*
- `hash_cannot_be_captured` (§4.D missing `sha256sum` / `shasum`, or any file unreadable): **no** *(all four hashes captured per §6)*
- `unknown_artifact_hash` (§6 any `_match_baseline=no` without a recorded intervening authorised change): **no** *(all four sha256 values match the PR#18p §3.1 / PR#18x §3.1 baseline per §6)*
- **`rollback_artifact_source_missing`** (§4.F aggregate `rollback_artifact_source_present=no`): **yes** *(both `rollback_backup_dir_present=no` and `rollback_backup_artifact_present=no` per §8; this triggers `BLOCKED` per §1)*
- **`rollback_procedure_source_missing`** (§4.F `rollback_procedure_source_present=no`): **yes** *(per §8; this triggers `BLOCKED` per §1)*
- `endpoint_already_flipped_unexpectedly` (§4.E `endpointUrl_category=sprint2_v1_event` without recorded Gate 4C approval): **no** *(`endpointUrl_category=render_legacy_collect` per §7)*
- `both_collect_and_v1event_present_unexpectedly` (§4.E `both_collect_and_v1event_present=yes` without recorded Gate 4C approval): **no** *(`both_collect_and_v1event_present=no` per §7)*
- `endpoint_category_unknown` (§4.E `endpointUrl_category=unknown`): **no** *(`endpointUrl_category=render_legacy_collect` per §7)*
- `var_www_edit_attempted_or_observed` (any `cp` / `mv` / `rm` / `chown` / `chmod` / `ln -s` / `rsync` / `sed -i` / `awk -i inplace` / `patch` under `/var/www/` during the check window): **no** *(§4 contains no edit command; §8 `var_www_unchanged_after_check=yes`; operator attestation: no `/var/www` edit attempted or observed)*
- `production_traffic_generated` (any HTTP call from the operator shell to the production collector during the check window): **no** *(§4 contains no `curl` / `wget` / `httpie` / `nc` against the production collector; operator attestation: no production traffic generated)*
- `secret_printed` (any DSN, password, `Authorization:` header value, bearer token, `request_id`, `session_id`, raw payload, raw response body, env dump, private key / cert body, vault content, shell history line, or raw row surfaces): **no** *(no secret value surfaces in §A–§G output; the four sha256 values are public static-artifact hashes per PR#18o §4; operator attestation: no secret printed)*
- `operator_uncertain`: **no** *(per operator paste-back)*

**`stop_lines_triggered`:** **`rollback_artifact_source_missing`,
`rollback_procedure_source_missing`** (2 stop-lines; force `BLOCKED` per
§1 classification rule).

---

## 11. Gate 4C preconditions still required

Gate 4C (`endpointUrl` re-flip) **remains unapproved** by PR#18y. The
eight Gate 4C preconditions established in PR#18x §5 still apply in full:

1. **Explicit Helen GO** for the Gate 4C PR, scoped narrowly to the
   `endpointUrl` re-flip and nothing else. Helen GO is not transferable
   from Gate 4A / Gate 4B / any earlier PR; Gate 4C requires its own GO.
2. **Rollback-first.** The Gate 4C PR must specify, before any forward
   action, the exact one-step revert command, the exact rollback artifact
   source path, the exact rollback procedure source doc, the exact
   rollback verification command, and the categorical evidence field that
   confirms rollback completion.
3. **Exact file diff plan.** The Gate 4C PR must record the exact file
   path (`/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
   per PR#18x §4.5), the exact pre-change literal string, the exact
   post-change literal string, and a categorical attestation that no
   other file in `/var/www/buyerrecon.com/html/` is touched.
   `thin-sdk.iife.js`, `br-probe-init.js`, and `index.html` must remain
   unchanged.
4. **Exact artifact hash before / after.** The Gate 4C PR must record the
   sha256 of `br-thinlayer-init.js` immediately before the flip (must
   equal the Gate 4A §3.1 / PR#18x §3.1 / PR#18y §6 baseline) and
   immediately after the flip (must be a new, single, recorded value).
   The sha256 of the three unchanged artifacts must equal their baselines
   both before and after. Any sha256 drift in the three "unchanged" files
   is a stop-line.
5. **No raw secrets.** No DSN, no password, no `Authorization:` header,
   no bearer token, no `request_id`, no `session_id`, no payload, no
   response body, no env dump, no private key / cert body, no vault
   content may be printed, echoed, written to disk, captured into a
   proof, or included in any commit by the Gate 4C PR.
6. **Canary scope.** The Gate 4C PR must record what counts as "the
   canary" — typically one controlled human page-load or one approved
   fixture event per `docs/ops/cutover-hard-gates.md` §6.3 PR C — and
   explicitly exclude Track A, Playwright, organic observation, and any
   synthetic write smoke that has not been separately approved by its
   own Helen GO. The 26 historical PR#17s rows recorded in PR#18w §3.5
   and re-stated in §9 above must be referenced as the prior baseline;
   canary success is measured as a **delta from that baseline**, not as
   an absolute count.
7. **Stop-lines.** The Gate 4C PR must enumerate at least the stop-lines
   listed in PR#18x §5 precondition 7 (route_health_check_5xx,
   route_health_check_4xx_unexpected, route_health_check_timeout,
   endpointUrl_pre_count_not_one, endpointUrl_pre_count_drifted,
   endpointUrl_post_count_not_one, unchanged_artifact_hash_drift,
   unauthorised_file_changed, request_body_invalid_json_observed_post_flip,
   accepted_events_5xx_class_observed, accepted_events_delta_unexpected,
   lane_writer_activity_observed, customer_output_observed,
   secret_printed, operator_uncertain). Any single triggered stop-line
   forces a `BLOCKED` verdict and a one-step revert to
   `render_legacy_collect`.
8. **Proof record.** The Gate 4C PR must produce a docs-only proof
   record following the structure of PR#18p / PR#18w / PR#18y (status /
   verdict, evidence summary, stop-line assessment, impact on next gates,
   boundaries) and must explicitly state whether the canary succeeded,
   failed, or was rolled back.

Until all eight preconditions hold in a single Gate 4C PR proposal under
its own explicit Helen GO, Gate 4C remains unapproved. PR#18y does not
pre-authorise, sequence, or schedule any Gate 4C work.

---

## 12. Final scoring / governance recap requirement

A final scoring / governance recap PR remains required after Gate 4
implementation / preflight and any issue-fix PRs, before any
production-cutover readiness claim. PR#18y is one input to that recap; it
is not the recap itself.

The recap PR must carry forward, verbatim, the customer governance locks:

- `customer_claim_allowed=false`
- `lane_output_allowed=false`
- `customer_visibility_allowed=false`
- `lane_write_allowed=false`
- `allowed_customer_language=[]`

The recap PR must also carry forward, explicitly:

- the PR#18v `PASS` verdict for the dedicated `buyerrecon_prod_audit_readonly`
  credential and the root-only production DSN binding,
- the PR#18w `PASS_WITH_WARNINGS` verdict for the Gate 4A DB / grant /
  traffic re-audit and the `historical_rejected_only_v1_event_rows_present`
  warning,
- the 26-row count, the single-day window `2026-05-19`, the
  `http_status=400 × 26` distribution, the
  `reject_reason_code=request_body_invalid_json × 26` distribution, and
  the PR#17s reference for the historical-rejected-only `/v1/event`
  `ingest_requests` rows,
- the PR#18x `PLANNING / CHECK ONLY` Gate 4B planning record,
- the PR#18y **`BLOCKED`** verdict, the §6 sha256 match results (all four
  match baseline), the §7 endpoint category (`render_legacy_collect`,
  `sprint2_endpoint_config_present=no`, `both_collect_and_v1event_present=no`),
  the §8 rollback posture (`rollback_backup_dir_present=no`,
  `rollback_backup_artifact_present=no`,
  `rollback_artifact_source_present=no`,
  `rollback_procedure_source_present=no`; categorical regression versus
  PR#18p §3.3), and the two §10 stop-lines triggered
  (`rollback_artifact_source_missing`,
  `rollback_procedure_source_missing`),
- the requirement that a separate diagnostic / fix PR under its own
  explicit Helen GO reconstitutes the rollback backup directory, backup
  artifact, and rollback procedure source on the production host, and
  that a follow-up Gate 4B re-audit produces a non-`BLOCKED` verdict,
  before any Gate 4C consideration may proceed,
- the converted migration-016 Lane grant safety status recorded in
  PR#18w §3.6 / §6,
- Gate 4C / 4D / 4E outcomes once recorded,
- the rollback posture and any further open warnings.

Any Gate 4C canary planning that contemplates re-flipping `endpointUrl`
to `/v1/event` must explicitly reference the PR#17s 26-row historical
baseline recorded by PR#18w and re-stated by §9 above, and must not
delete, mutate, annotate, or normalise those rows.

No production-cutover readiness claim may rely on PR#18y alone.

---

## 13. Non-goals / what did not happen

PR#18y explicitly does **not** approve any of the following. Each
requires its own explicit Helen GO scoped to that specific work:

- no further Gate 4B execution beyond the read-only artifact / config
  check recorded here,
- no `endpointUrl` re-flip,
- no Gate 4C approval, no Gate 4C canary, no Gate 4C consideration
  beyond inventory,
- no production traffic generation,
- no `curl` / `wget` / `httpie` / `nc` / browser-driven page-load
  against the production collector or any production endpoint,
- no `/var/www` edit,
- no `cp` / `mv` / `rm` / `chown` / `chmod` / `ln -s` / `rsync` against
  any production path,
- no `sed -i` / `awk -i inplace` / `patch` against any production file,
- no symlink change,
- no `nginx -s reload`, no `systemctl`, no service restart,
- no DNS change,
- no DB write, no DB grant, no migration, no `schema.sql` change,
- no env file edit, no credential rotation, no `buyerrecon_prod_collector_app`
  reset, no `buyerrecon_migrator` reset, no token provisioning,
- no Lane A/B writer,
- no customer-facing output (Pass 1 / Trust / Pass 2 / Lane report /
  dashboard),
- no dashboard implementation, no AMS runtime bridge, no Pass 1 / Trust /
  Pass 2 runtime, no runtime scoring,
- no Track A, no Playwright,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no Gate 4D organic observation, no Gate 4E Track A / Playwright work,
- no secret printing (DSN, generated password, DB username / password
  pair, `Authorization:` header value, raw `request_id`, raw `session_id`,
  raw payload, raw response body, env dump, private key / cert body,
  vault content, shell history, raw row data),
- no `cat` / `head` / `tail` / `diff` of any artifact contents (only
  `ls -la`, `test -f`, `sha256sum` / `shasum -a 256`, and bounded
  `grep -c` per §4),
- no deletion, mutation, annotation, or normalisation of the 26
  historical PR#17s rows on the production cluster.

---

## 14. Acceptance criteria

PR#18y is acceptable for merge into `sprint2-architecture-contracts-d4cc2bf`
only if **all** of the following hold:

- **Read-only check only.** §4 §A–§F commands executed exactly as
  recorded; no edit, no copy, no move, no remove, no chown, no chmod, no
  symlink, no service reload, no HTTP call, no traffic generation.
- **Docs-only proof.** Exactly one new file changes:
  `docs/sprint2-pr18y-gate4b-readonly-artifact-config-proof.md`. No code,
  no scripts, no tests, no package files, no migrations, no
  `schema.sql`, no env files, no systemd / Nginx files, no AMS source,
  no website artifacts, no production config, no DB grant files change.
- **No endpoint flip.** §7 records `endpointUrl_category=render_legacy_collect`,
  `sprint2_endpoint_config_present=no`, `both_collect_and_v1event_present=no`.
- **No production traffic.** §10 `production_traffic_generated=no`.
- **No `/var/www` edit.** §8 `var_www_unchanged_after_check=yes`; §10
  `var_www_edit_attempted_or_observed=no`.
- **No secrets.** §10 `secret_printed=no`; the validation step's
  secret-safety grep returns only metadata / governance / attestation
  hits (no leaked DSN, password, `Authorization:` header value, bearer
  token, raw `request_id`, raw `session_id`, raw payload, raw response
  body, env dump, private key, cert body, vault content, shell history,
  or raw row).
- **Historical warning preserved.** §9 carries forward the 26-row PR#17s
  / PR#18w warning verbatim with the do-not-delete / do-not-mutate /
  do-not-annotate / do-not-normalise rule.
- **Gate 4C remains unapproved.** §11 restates the eight Gate 4C
  preconditions as inventory, not approval. PR#18y does not
  pre-authorise, sequence, or schedule any Gate 4C work.
- **Final recap requirement preserved.** §12 restates that the final
  scoring / governance recap PR remains required before any
  production-cutover readiness claim, and enumerates the items the
  recap must carry forward.

---

End of PR#18y. **Gate 4B read-only artifact / config check execution
proof. Verdict: BLOCKED. Stop-lines triggered:
`rollback_artifact_source_missing`, `rollback_procedure_source_missing`.
Artifact and endpoint posture are clean — `host_category=production`,
`operator_user_category=root`, `shell_trace=off`, `histfile_unset=yes`,
`umask_077=yes`; `website_root_exists=yes`, `thinlayer_root_exists=yes`;
all four static artifacts (`br-thinlayer-init.js`, `thin-sdk.iife.js`,
`br-probe-init.js`, `index.html`) present; all four sha256 hashes match
the PR#18p §3.1 / PR#18x §3.1 baseline character-for-character
(`br_thinlayer_init_sha256=9b0e4530…cc2efda0`,
`thin_sdk_iife_sha256=7098d648…c53538d1`,
`br_probe_init_sha256=09d68188…17060f84`,
`index_html_sha256=30b46c12…3810965c`); per-artifact `/collect` and
`/v1/event` counts match the PR#18p §3.2 baseline
(`br_thinlayer_init.js /collect=1, /v1/event=0`; the other three
artifacts both counts = 0); `endpointUrl_category=render_legacy_collect`,
`render_collect_legacy_present=yes`,
`sprint2_endpoint_config_present=no`,
`both_collect_and_v1event_present=no`;
`var_www_unchanged_after_check=yes`, `cleanup_done=yes`,
`var_www_edit_attempted_or_observed=no`,
`production_traffic_generated=no`, `secret_printed=no`,
`operator_uncertain=no`. The blocker is in §8: at PR#18y execution time
the production host's backup directory, backup artifact, and rollback
procedure source were all categorically absent
(`rollback_backup_dir_present=no`, `rollback_backup_artifact_present=no`,
`rollback_procedure_source_present=no`, aggregate
`rollback_artifact_source_present=no`) — a categorical regression versus
PR#18p §3.3 which recorded all four rollback surfaces as `yes`. Per the
§1 classification rule, two triggered stop-lines force `BLOCKED` regardless
of the otherwise-clean artifact / endpoint posture. A separate diagnostic
/ fix PR under its own explicit Helen GO is required to identify the
cause of the rollback-posture regression and reconstitute the rollback
backup directory, backup artifact, and rollback procedure source on the
production host. A follow-up Gate 4B re-audit must then produce a
non-`BLOCKED` verdict before any Gate 4C consideration. Gate 4C
`endpointUrl` re-flip remains unapproved; Gate 4D organic observation
remains unapproved; Gate 4E Track A / Playwright work remains unapproved.
The 26 historical PR#17s rows on the production cluster remain preserved
and must not be deleted, mutated, annotated, or normalised away. The
final scoring / governance recap PR remains required before any
production-cutover readiness claim. No `endpointUrl` re-flip, no Gate 4C
approval, no Gate 4C canary, no production traffic generation, no
`buyerrecon.com` production `/v1/event` call, no Render `/collect` call,
no `/var/www` edit, no `cp` / `mv` / `rm` / `chown` / `chmod` / `ln -s`
/ `rsync` / `sed -i` / `awk -i inplace` / `patch` against production
files, no symlink change, no `nginx -s reload`, no `systemctl`, no
service restart, no DNS change, no DB write, no DB grant, no migration,
no `schema.sql` change, no env file edit, no credential rotation, no
`buyerrecon_prod_collector_app` reset, no `buyerrecon_migrator` reset,
no production token provisioning, no Lane A/B writer, no customer-facing
output, no dashboard implementation, no AMS runtime bridge, no Pass 1 /
Trust / Pass 2 runtime, no runtime scoring, no Track A, no Playwright,
no website ThinSDK production-mode activation, no production artifact /
config mode flip, no Gate 4D observation, no Gate 4E Track A / Playwright
work, no deletion / mutation / annotation / normalisation of the 26
historical PR#17s rows on the production cluster, no `cat` / `head` /
`tail` / `diff` of artifact contents, and no secret printing are
approved by PR#18y. Any future rollback-reconstitution diagnostic / fix
PR, Gate 4B re-audit PR, Gate 4C canary PR (which must satisfy §11's
eight preconditions and reference the PR#17s 26-row baseline), Gate 4D
observation PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime
PR, customer-surface PR, or final scoring / governance recap PR remains
separately gated by its own explicit Helen GO.**
