# Sprint 2 PR#18aa: Gate 4B Re-Audit After Rollback Reconstitution

> Docs-only proof record. The §4 §A–§G read-only command set was
> executed on the production host by the operator (Helen) under
> explicit Helen GO scoped to read-only Gate 4B re-audit only. The
> categorical paste-back from that execution is recorded into §5 of
> this doc; §6 aggregates and §7 stop-lines are computed from §5.

---

## 1. Status / verdict

**Verdict: PASS.**

Gate 4B re-audit execution proof, scoped to read-only confirmation
that the rollback-posture blocker recorded in PR#18y / PR #57 is
lifted by PR#18z / PR #58, and that the website artifact / endpoint
posture remains clean. Every PASS condition in the §1 classification
rule below is met:

- **Shell / host safety** (§5.1): `host_category=production`,
  `operator_user_category=root`, `shell_trace=off`,
  `histfile_unset=yes`, `umask_077=yes`.
- **Live website roots** (§5.2): both `_exists=yes`.
- **Live static artifact presence** (§5.3): all four `_present=yes`.
- **Live static artifact hashes** (§5.4): all four
  `live_hash_match_baseline_*=yes` against the PR#18p §3.1 / PR#18x
  §3.1 / PR#18y §6 / PR#18z §6.2 baselines.
- **Endpoint / config category** (§5.5):
  `endpointUrl_category=render_legacy_collect`,
  `render_collect_legacy_present=yes`,
  `sprint2_endpoint_config_present=no`,
  `both_collect_and_v1event_present=no`. Per-artifact counts match
  the PR#18p §3.2 baseline (`br-thinlayer-init.js /collect = 1`,
  `/v1/event = 0`; all other artifacts both counts `0`).
- **Rollback posture** (§5.6): rollback root, latest bundle, four
  bundle artifacts, `MANIFEST.txt`, `LIVE-HASHES-AT-CAPTURE.txt`, and
  `ROLLBACK-PROCEDURE.md` all present at the expected modes and
  owners. `latest_bundle_basename=buyerrecon-gate4b-rollback-20260524T115806Z`
  (matches the PR#18z §6.3 timestamp). `bundle_intact=yes` via
  `sha256sum -c MANIFEST.txt` from inside the bundle directory. All
  four per-file `_backup_matches_live=yes`.
- **Post-check** (§5.7): all four live sha256 still match baseline;
  `br-thinlayer-init.js /collect count = 1`, `/v1/event count = 0`;
  `var_www_live_artifacts_unchanged=yes`,
  `production_traffic_generated=no`, `secret_printed=no`,
  `cleanup_done=yes`.
- **§6 aggregates** (all `yes`): `all_live_artifacts_present`,
  `all_live_hashes_match_baseline`,
  `rollback_artifact_source_present`,
  `rollback_procedure_source_present`, `latest_bundle_found`,
  `bundle_intact`, `backup_hashes_match_live`, `all_stop_lines_clear`.
- **§7 `stop_lines_triggered`: `none`**.

This PASS verdict converts the rollback-posture reconstitution
(PR#18z) into a categorical Gate 4B non-`BLOCKED` outcome. The Gate
4B blocker stack from PR#18p → PR#18y → PR#18z → PR#18aa is closed.

Gate 4C `endpointUrl` re-flip remains unapproved. The eight Gate 4C
preconditions established in PR#18x §5 / PR#18y §11 still apply in
full; one of those preconditions (rollback-first; the bundle +
procedure must be present and verified) is now provably satisfied on
the production host, but the other seven preconditions — including
explicit Helen GO scoped narrowly to Gate 4C, the exact file-diff
plan, the exact pre/post hashes for the to-be-changed
`br-thinlayer-init.js`, the canary scope, the Gate-4C-specific
stop-line set, and the Gate 4C proof record — are not satisfied by
PR#18aa.

### Verdict classification rule (applied to this proof in §1 once §5 is populated)

**PASS** requires all of:

- **Shell / host safety** (§5.1): `host_category=production`,
  `operator_user_category=root`, `shell_trace=off`,
  `histfile_unset=yes`, `umask_077=yes`.
- **Live website roots** (§5.2): `website_root_exists=yes`,
  `thinlayer_root_exists=yes`.
- **Live static artifact presence** (§5.3): all four
  `*_present=yes`.
- **Live static artifact hashes** (§5.4): all four
  `*_hash_match_baseline=yes` against the PR#18p §3.1 / PR#18x §3.1 /
  PR#18y §6 / PR#18z §6.2 baselines.
- **Endpoint / config category** (§5.5):
  `endpointUrl_category=render_legacy_collect`,
  `render_collect_legacy_present=yes`,
  `sprint2_endpoint_config_present=no`,
  `both_collect_and_v1event_present=no`. Per-artifact counts match the
  PR#18p §3.2 baseline (`br-thinlayer-init.js /collect = 1`,
  `/v1/event = 0`; the other three artifacts both counts `0`).
- **Rollback posture** (§5.6): every rollback presence + permission
  surface returns `yes`; `bundle_intact=yes` via `sha256sum -c
  MANIFEST.txt`; per-file `backup_*_matches_live=yes` for all four
  artifacts.
- **Post-check** (§5.7): live hashes still match baseline at end of
  the §A–§G window; `var_www_live_artifacts_unchanged=yes`;
  `production_traffic_generated=no`; `secret_printed=no`;
  `cleanup_done=yes`.
- **§6 aggregates**: `all_live_artifacts_present=yes`,
  `all_live_hashes_match_baseline=yes`,
  `rollback_artifact_source_present=yes`,
  `rollback_procedure_source_present=yes`,
  `latest_bundle_found=yes`, `bundle_intact=yes`,
  `backup_hashes_match_live=yes`, `all_stop_lines_clear=yes`.
- **§7 `stop_lines_triggered`: `none`**.

**PASS_WITH_WARNINGS** is permitted when all stop-lines are `no` and
the §8 historical PR#17s 26-row warning is the only carried warning
(it always is, by reference; this is a structural warning that travels
with every Gate 4 PR until the final recap closes it).

**BLOCKED** is required if any §7 stop-line is triggered.

### Scope boundaries

- No `endpointUrl` re-flip.
- No Gate 4C approval, no canary, no production traffic generation.
- No HTTP call to the production collector or any production endpoint
  (no `curl`, no `wget`, no `httpie`, no `nc`, no browser).
- No edit to any live served artifact under `/var/www/`. The only
  `/var/www/` reads are `test -d` / `test -f`, `sha256sum`, and
  bounded `grep -c`, all read-only.
- No symlink change.
- No `nginx -s reload`, no `systemctl` action, no service restart.
- No DNS change.
- No DB write, no DB grant, no migration, no `schema.sql` change.
- No env file edit, no credential rotation, no token provisioning.
- No website ThinSDK production-mode activation.
- No production artifact / config mode flip.
- No customer-facing output, no Lane A/B writer, no runtime scoring.
- No Track A, no Playwright.
- No Gate 4C / Gate 4D / Gate 4E execution.
- No secrets printed (no DSN, no password, no `Authorization:` header
  value, no bearer token, no raw `request_id`, no raw `session_id`, no
  raw payload, no raw response body, no env dump, no private key /
  cert body, no vault content, no shell history, no raw row).
- No `cat` / `head` / `tail` / `diff` of any artifact contents; only
  `ls`, `test -f`/`-d`, `stat`, `sha256sum`, and bounded `grep -c`.

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

## 2. Why this re-audit exists

The Gate 4B chain reached this re-audit through the following sequence
(each verdict copied verbatim from the merged proof on this PR's base
`sprint2-architecture-contracts-d4cc2bf`):

- **PR#18x / PR #56** — Gate 4B website artifact / config bundle
  planning / check. Verdict: **PLANNING / CHECK ONLY**. Defined the
  Gate 4B artifact / config / rollback inventory shape and the eight
  Gate 4C preconditions; did not authorise any Gate 4C execution.
- **PR#18y / PR #57** — Gate 4B read-only artifact / config check
  execution proof. Verdict: **BLOCKED**. Stop-lines triggered:
  `rollback_artifact_source_missing` (`rollback_backup_dir_present=no`,
  `rollback_backup_artifact_present=no`, aggregate
  `rollback_artifact_source_present=no`) and
  `rollback_procedure_source_missing`. The artifact + endpoint surfaces
  were otherwise clean: all four static artifact sha256 hashes matched
  the PR#18p §3.1 / PR#18x §3.1 baseline character-for-character;
  `endpointUrl_category=render_legacy_collect`;
  `sprint2_endpoint_config_present=no`;
  `both_collect_and_v1event_present=no`. The §8 finding was a
  categorical regression versus PR#18p §3.3 which had recorded all
  four rollback surfaces as `yes`; the diagnostic / fix work was
  deferred to a separate PR under explicit Helen GO.
- **PR#18z / PR #58** — Gate 4B rollback reconstitution remediation.
  Verdict: **PASS**. Stop-lines triggered: none. Established the
  canonical rollback root `/root/buyerrecon-rollback/` (mode `0700`,
  owner `root:root`); created the timestamped bundle subdirectory
  `buyerrecon-gate4b-rollback-20260524T115806Z` (mode `0700`, owner
  `root:root`) containing byte-identical copies of the four live
  static artifacts (mode `0600`, owner `root:root`), plus
  `MANIFEST.txt` (sha256sum with relative filenames) and
  `LIVE-HASHES-AT-CAPTURE.txt` (sha256sum with absolute live paths);
  created `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` (mode
  `0600`, owner `root:root`) recording the rollback runbook with the
  pre-restore `stat -c '%a %U:%G %n'` step and the `sha256sum -c
  MANIFEST.txt` bundle-intact verify. Per-file `_backup_matches_live=yes`
  for all four artifacts. Bonus check after §G: `latest_bundle_found=yes`
  and `bundle_intact=yes` via the just-created runbook against the
  just-created bundle. Live `/var/www/` artifacts unchanged
  (`post_check_live_hash_match_baseline_*=yes` × 4). Endpoint posture
  unchanged.

PR#18aa is the **follow-up Gate 4B re-audit** required by PR#18z §1 /
§10 to convert the rollback-posture reconstitution into a categorical
Gate 4B non-`BLOCKED` verdict. PR#18aa re-runs the PR#18y §4 §A–§F
read-only artifact / config check shape **plus** a re-check of the
rollback posture established by PR#18z, against the production host as
it stands after PR#18z's writes. PR#18aa does not modify production; it
only reads.

PR#18aa's completion does **not** unblock Gate 4C. Gate 4C
`endpointUrl` re-flip, Gate 4C canary, Gate 4D organic observation,
and Gate 4E Track A / Playwright work all remain unapproved (§9).

---

## 3. Scope and non-approval

PR#18aa is the **read-only Gate 4B re-audit after rollback
reconstitution** PR. Its scope is strictly the §4 §A–§G read-only
command set executed against the post-PR#18z production host state.
Under no interpretation does PR#18aa approve any of the following —
each requires its own explicit Helen GO scoped to that specific work:

- no Gate 4C `endpointUrl` re-flip,
- no Gate 4C canary (controlled human page-load, fixture event, or
  synthetic write smoke),
- no production traffic generation (no `curl` / `wget` / `httpie` /
  `nc` / browser against the production collector or any production
  endpoint),
- no live `/var/www/buyerrecon.com/html/` artifact / config change of
  any kind (no edit, no copy *into* the live root, no move, no remove,
  no chmod, no chown, no symlink),
- no Nginx config change, no Nginx reload,
- no `systemctl` action against any production service,
- no DNS change,
- no DB write, no DB grant, no migration, no `schema.sql` change,
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no `buyerrecon_migrator` reset,
  no production token provisioning,
- no Lane A/B writer,
- no customer-facing output (Pass 1 / Trust / Pass 2 / Lane report /
  dashboard),
- no dashboard implementation, no AMS runtime bridge, no Pass 1 /
  Trust / Pass 2 runtime, no runtime scoring,
- no Track A, no Playwright,
- no website ThinSDK production-mode activation,
- no production artifact / config mode flip,
- no Gate 4D organic observation, no Gate 4E Track A / Playwright work,
- no secret printing (DSN, generated password, DB username / password
  pair, `Authorization:` header value, raw `request_id`, raw
  `session_id`, raw payload, raw response body, env dump, private key /
  cert body, vault content, shell history, raw row data),
- no deletion, mutation, annotation, or normalisation of the 26
  historical PR#17s rows on the production cluster.

PR#18aa is one input to the final scoring / governance recap PR; it
is not the recap itself.

---

## 4. Read-only production command set

> **Helen approval gate.** The following §A–§G command block reads
> production-host state only. It must not be executed until Helen has
> reviewed this PR and issued an explicit "execute" GO. No write to
> any path under `/var/www/`, `/root/`, `/opt/`, or anywhere else
> occurs in §A–§G.

> **Operator-only invariants throughout §4:** no `cat` / `head` /
> `tail` / `diff` of any artifact contents; only `ls`, `test -f` /
> `-d`, `stat`, `sha256sum`, and bounded `grep -c`; no `find` walking
> outside the named paths; no HTTP call; no DSN, password,
> `Authorization:` header value, bearer token, raw `request_id`, raw
> `session_id`, raw payload, raw response body, env dump, private
> key / cert body, vault content, shell history, or raw row may be
> printed at any time.

### A. Shell safety preflight

```bash
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
- `host_category`: <production|staging|local|unknown> (**stop if not `production`**)
- `operator_user_category`: <root|unexpected> (**stop if not `root`** — §F requires root to read mode/owner of `/root/buyerrecon-rollback/`)
- `shell_trace: <on|off>`
- `histfile_unset: <yes|no>`
- `umask_077: <yes|no>`

### B. Live website roots existence

```bash
echo "website_root_exists: $([ -d /var/www/buyerrecon.com/html ] && echo yes || echo no)"
echo "thinlayer_root_exists: $([ -d /var/www/buyerrecon.com/html/thinlayer ] && echo yes || echo no)"
```

Paste-back into §5.2.

### C. Live static artifact presence

```bash
echo "br_thinlayer_init_js_present: $([ -f /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js ] && echo yes || echo no)"
echo "thin_sdk_iife_js_present:    $([ -f /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js ] && echo yes || echo no)"
echo "br_probe_init_js_present:    $([ -f /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js ] && echo yes || echo no)"
echo "index_html_present:          $([ -f /var/www/buyerrecon.com/html/index.html ] && echo yes || echo no)"
```

Paste-back into §5.3.

### D. Live static artifact hash check vs baseline

Compare each live sha256 to the PR#18p §3.1 / PR#18x §3.1 / PR#18y §6 /
PR#18z §6.2 baseline. The four baseline values are publicly-served
static-artifact hashes (non-secret per PR#18o §4) and are recorded
inline in the command for self-contained execution.

```bash
for spec in \
  '/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js 9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0' \
  '/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js     7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1' \
  '/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js     09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84' \
  '/var/www/buyerrecon.com/html/index.html                     30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c'; do
  P=$(echo "$spec" | awk '{print $1}')
  B=$(echo "$spec" | awk '{print $2}')
  H=$(sha256sum "$P" 2>/dev/null | awk '{print $1}')
  if [ -n "$H" ] && [ "$H" = "$B" ]; then
    echo "live_hash_match_baseline_$(basename "$P"): yes"
  else
    echo "live_hash_match_baseline_$(basename "$P"): no"
  fi
done
```

Paste-back into §5.4 (4 lines).

### E. Endpoint / config category (bounded `grep -c` only)

```bash
for f in \
  /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js \
  /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js \
  /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js \
  /var/www/buyerrecon.com/html/index.html; do
  echo "${f##*/} /collect count:  $(grep -c '/collect' "$f" 2>/dev/null || echo 0)"
  echo "${f##*/} /v1/event count: $(grep -c '/v1/event' "$f" 2>/dev/null || echo 0)"
done
```

No `-B` / `-A` / `-C` / `-o`. No `cat` / `head` / `tail` / `diff`.
Counts only.

Paste-back into §5.5 (8 per-artifact lines + 4 classification lines):
- per-artifact `/collect` and `/v1/event` counts
- `endpointUrl_category: <render_legacy_collect|sprint2_v1_event|both_present|unknown>`
- `render_collect_legacy_present: <yes|no>`
- `sprint2_endpoint_config_present: <yes|no>`
- `both_collect_and_v1event_present: <yes|no>`

### F. Rollback posture (read-only)

```bash
# F.1 — rollback root directory
echo "rollback_root_dir_present: $([ -d /root/buyerrecon-rollback ] && echo yes || echo no)"
echo "rollback_root_dir_mode_0700: $([ "$(stat -c '%a' /root/buyerrecon-rollback 2>/dev/null)" = "700" ] && echo yes || echo no)"
echo "rollback_root_dir_owner_root_root: $([ "$(stat -c '%U:%G' /root/buyerrecon-rollback 2>/dev/null)" = "root:root" ] && echo yes || echo no)"

# F.2 — locate latest bundle (newest by mtime; trailing slash stripped)
LATEST_BUNDLE="$(ls -1dt /root/buyerrecon-rollback/buyerrecon-gate4b-rollback-*/ 2>/dev/null | head -n 1)"
LATEST_BUNDLE="${LATEST_BUNDLE%/}"

if [ -n "$LATEST_BUNDLE" ] && [ -d "$LATEST_BUNDLE" ]; then
  echo "latest_bundle_found: yes"
else
  echo "latest_bundle_found: no"
fi
echo "latest_bundle_basename: $(basename "$LATEST_BUNDLE" 2>/dev/null)"

# F.3 — latest bundle mode + owner
echo "latest_bundle_mode_0700: $([ "$(stat -c '%a' "$LATEST_BUNDLE" 2>/dev/null)" = "700" ] && echo yes || echo no)"
echo "latest_bundle_owner_root_root: $([ "$(stat -c '%U:%G' "$LATEST_BUNDLE" 2>/dev/null)" = "root:root" ] && echo yes || echo no)"

# F.4 — four bundle artifacts (presence + mode + owner)
for f in br-thinlayer-init.js thin-sdk.iife.js br-probe-init.js index.html; do
  echo "bundle_present_${f}: $([ -f "$LATEST_BUNDLE/$f" ] && echo yes || echo no)"
  echo "bundle_mode_0600_${f}: $([ "$(stat -c '%a' "$LATEST_BUNDLE/$f" 2>/dev/null)" = "600" ] && echo yes || echo no)"
  echo "bundle_owner_root_root_${f}: $([ "$(stat -c '%U:%G' "$LATEST_BUNDLE/$f" 2>/dev/null)" = "root:root" ] && echo yes || echo no)"
done

# F.5 — MANIFEST.txt
echo "manifest_present: $([ -f "$LATEST_BUNDLE/MANIFEST.txt" ] && echo yes || echo no)"
echo "manifest_mode_0600: $([ "$(stat -c '%a' "$LATEST_BUNDLE/MANIFEST.txt" 2>/dev/null)" = "600" ] && echo yes || echo no)"
echo "manifest_owner_root_root: $([ "$(stat -c '%U:%G' "$LATEST_BUNDLE/MANIFEST.txt" 2>/dev/null)" = "root:root" ] && echo yes || echo no)"

# F.6 — LIVE-HASHES-AT-CAPTURE.txt
echo "live_hashes_at_capture_present: $([ -f "$LATEST_BUNDLE/LIVE-HASHES-AT-CAPTURE.txt" ] && echo yes || echo no)"
echo "live_hashes_at_capture_mode_0600: $([ "$(stat -c '%a' "$LATEST_BUNDLE/LIVE-HASHES-AT-CAPTURE.txt" 2>/dev/null)" = "600" ] && echo yes || echo no)"
echo "live_hashes_at_capture_owner_root_root: $([ "$(stat -c '%U:%G' "$LATEST_BUNDLE/LIVE-HASHES-AT-CAPTURE.txt" 2>/dev/null)" = "root:root" ] && echo yes || echo no)"

# F.7 — ROLLBACK-PROCEDURE.md
echo "rollback_procedure_present: $([ -f /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md ] && echo yes || echo no)"
echo "rollback_procedure_mode_0600: $([ "$(stat -c '%a' /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md 2>/dev/null)" = "600" ] && echo yes || echo no)"
echo "rollback_procedure_owner_root_root: $([ "$(stat -c '%U:%G' /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md 2>/dev/null)" = "root:root" ] && echo yes || echo no)"

# F.8 — bundle integrity via sha256sum -c MANIFEST.txt from inside the bundle
if [ -n "$LATEST_BUNDLE" ] &&
   [ -f "$LATEST_BUNDLE/MANIFEST.txt" ] &&
   ( cd "$LATEST_BUNDLE" && sha256sum -c MANIFEST.txt >/dev/null 2>&1 ); then
  echo "bundle_intact: yes"
else
  echo "bundle_intact: no"
fi

# F.9 — per-file backup ↔ live hash equality
for name in br-thinlayer-init.js thin-sdk.iife.js br-probe-init.js index.html; do
  case "$name" in
    index.html) LIVE="/var/www/buyerrecon.com/html/index.html" ;;
    *)          LIVE="/var/www/buyerrecon.com/html/thinlayer/$name" ;;
  esac
  LH=$(sha256sum "$LIVE" 2>/dev/null | awk '{print $1}')
  BH=$(sha256sum "$LATEST_BUNDLE/$name" 2>/dev/null | awk '{print $1}')
  if [ -n "$LH" ] && [ -n "$BH" ] && [ "$LH" = "$BH" ]; then
    echo "${name}_backup_matches_live: yes"
  else
    echo "${name}_backup_matches_live: no"
  fi
done
```

Paste-back into §5.6 (presence + permission + integrity + per-file
equality fields).

### G. Post-check + cleanup attestation

```bash
# G.1 — re-confirm live hashes still match baseline (catches any drift during the §A–§F window)
for spec in \
  '/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js 9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0' \
  '/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js     7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1' \
  '/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js     09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84' \
  '/var/www/buyerrecon.com/html/index.html                     30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c'; do
  P=$(echo "$spec" | awk '{print $1}')
  B=$(echo "$spec" | awk '{print $2}')
  H=$(sha256sum "$P" 2>/dev/null | awk '{print $1}')
  if [ "$H" = "$B" ]; then
    echo "post_check_live_hash_match_baseline_$(basename "$P"): yes"
  else
    echo "post_check_live_hash_match_baseline_$(basename "$P"): no"
  fi
done

# G.2 — re-confirm endpoint category
echo "post_check_br_thinlayer_init_collect_count:  $(grep -c '/collect'  /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js 2>/dev/null || echo 0)"
echo "post_check_br_thinlayer_init_v1event_count:  $(grep -c '/v1/event' /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js 2>/dev/null || echo 0)"

# G.3 — operator attestations
echo "var_www_live_artifacts_unchanged: yes"
echo "production_traffic_generated: no"
echo "secret_printed: no"
echo "cleanup_done: yes"
```

Paste-back into §5.7.

---

## 5. Execution results

All fields below are recorded verbatim from the operator's pasted §A–§G
execution block.

### 5.1 Shell / host safety preflight (§A)

- `host_category`: `production`
- `operator_user_category`: `root`
- `shell_trace`: `off`
- `histfile_unset`: `yes`
- `umask_077`: `yes`

### 5.2 Live website roots (§B)

- `website_root_exists` (`/var/www/buyerrecon.com/html`): `yes`
- `thinlayer_root_exists` (`/var/www/buyerrecon.com/html/thinlayer`): `yes`

### 5.3 Live static artifact presence (§C)

- `br_thinlayer_init_js_present`: `yes`
- `thin_sdk_iife_js_present`: `yes`
- `br_probe_init_js_present`: `yes`
- `index_html_present`: `yes`

### 5.4 Live static artifact hashes (§D)

- `live_hash_match_baseline_br-thinlayer-init.js`: `yes`
- `live_hash_match_baseline_thin-sdk.iife.js`: `yes`
- `live_hash_match_baseline_br-probe-init.js`: `yes`
- `live_hash_match_baseline_index.html`: `yes`

All four live sha256 hashes still match the PR#18p §3.1 / PR#18x §3.1 /
PR#18y §6 / PR#18z §6.2 baseline character-for-character. No live
artifact has drifted since PR#18z execution.

### 5.5 Endpoint / config category (§E)

- `br_thinlayer_init.js /collect count`: `1`  *(PR#18p baseline: `1`; match)*
- `br_thinlayer_init.js /v1/event count`: `0`  *(PR#18p baseline: `0`; match)*
- `thin_sdk.iife.js /collect count`: `0`  *(PR#18p baseline: `0`; match)*
- `thin_sdk.iife.js /v1/event count`: `0`  *(PR#18p baseline: `0`; match)*
- `br_probe_init.js /collect count`: `0`  *(PR#18p baseline: `0`; match)*
- `br_probe_init.js /v1/event count`: `0`  *(PR#18p baseline: `0`; match)*
- `index.html /collect count`: `0`  *(PR#18y §7 first-recorded value `0`; match)*
- `index.html /v1/event count`: `0`  *(PR#18y §7 first-recorded value `0`; match)*
- `endpointUrl_category`: `render_legacy_collect`
- `render_collect_legacy_present`: `yes`
- `sprint2_endpoint_config_present`: `no`
- `both_collect_and_v1event_present`: `no`

**Operator note (§E output shape).** The §E `for`-loop with a
`grep -c … || echo 0` fallback emits an extra standalone `0` line
when `grep -c` returns non-zero exit status on a zero-match case.
The eight categorical counts above are distilled from the labelled
count lines only; the extra standalone `0` lines are not categorical
fields and have been discarded (same artefact noted in PR#18y §7,
PR#18z §6.9).

### 5.6 Rollback posture (§F)

#### Rollback root (F.1)
- `rollback_root_dir_present`: `yes`
- `rollback_root_dir_mode_0700`: `yes`
- `rollback_root_dir_owner_root_root`: `yes`

#### Latest bundle (F.2 / F.3)
- `latest_bundle_found`: `yes`
- `latest_bundle_basename`: `buyerrecon-gate4b-rollback-20260524T115806Z`  *(matches the PR#18z §6.3 timestamp character-for-character; the same bundle PR#18z created on the same production host has been re-discovered by PR#18aa's `ls -1dt … | head -n 1` pattern)*
- `latest_bundle_mode_0700`: `yes`
- `latest_bundle_owner_root_root`: `yes`

#### Bundle artifacts (F.4)
- `bundle_present_br-thinlayer-init.js`: `yes` · `bundle_mode_0600_br-thinlayer-init.js`: `yes` · `bundle_owner_root_root_br-thinlayer-init.js`: `yes`
- `bundle_present_thin-sdk.iife.js`: `yes` · `bundle_mode_0600_thin-sdk.iife.js`: `yes` · `bundle_owner_root_root_thin-sdk.iife.js`: `yes`
- `bundle_present_br-probe-init.js`: `yes` · `bundle_mode_0600_br-probe-init.js`: `yes` · `bundle_owner_root_root_br-probe-init.js`: `yes`
- `bundle_present_index.html`: `yes` · `bundle_mode_0600_index.html`: `yes` · `bundle_owner_root_root_index.html`: `yes`

#### MANIFEST.txt + LIVE-HASHES-AT-CAPTURE.txt + ROLLBACK-PROCEDURE.md (F.5 / F.6 / F.7)
- `manifest_present`: `yes` · `manifest_mode_0600`: `yes` · `manifest_owner_root_root`: `yes`
- `live_hashes_at_capture_present`: `yes` · `live_hashes_at_capture_mode_0600`: `yes` · `live_hashes_at_capture_owner_root_root`: `yes`
- `rollback_procedure_present`: `yes` · `rollback_procedure_mode_0600`: `yes` · `rollback_procedure_owner_root_root`: `yes`

#### Bundle integrity + per-file backup ↔ live equality (F.8 / F.9)
- `bundle_intact` (via `( cd "$LATEST_BUNDLE" && sha256sum -c MANIFEST.txt >/dev/null 2>&1 )`): `yes`
- `br-thinlayer-init.js_backup_matches_live`: `yes`
- `thin-sdk.iife.js_backup_matches_live`: `yes`
- `br-probe-init.js_backup_matches_live`: `yes`
- `index.html_backup_matches_live`: `yes`

The bundle is byte-identical to its own MANIFEST.txt (no internal
drift since PR#18z capture) and byte-identical to the live source at
both PR#18z capture time and PR#18aa re-audit time.

### 5.7 Post-check + cleanup attestation (§G)

- `post_check_live_hash_match_baseline_br-thinlayer-init.js`: `yes`
- `post_check_live_hash_match_baseline_thin-sdk.iife.js`: `yes`
- `post_check_live_hash_match_baseline_br-probe-init.js`: `yes`
- `post_check_live_hash_match_baseline_index.html`: `yes`
- `post_check_br_thinlayer_init_collect_count`: `1`
- `post_check_br_thinlayer_init_v1event_count`: `0`
- `var_www_live_artifacts_unchanged`: `yes`
- `production_traffic_generated`: `no`
- `secret_printed`: `no`
- `cleanup_done`: `yes`

All four live sha256 still match baseline at the end of the §A–§G
window, confirming that no §B–§F read inadvertently mutated any live
artifact (which they could not have, by command shape — all read-only
— but the post-check converts that to categorical evidence). Endpoint
posture re-confirmed: `endpointUrl_category=render_legacy_collect`
via `/collect count = 1` and `/v1/event count = 0` in
`br-thinlayer-init.js`. Same `grep -c … || echo 0` shell-artefact
note applies to §G as to §5.5: any extra standalone `0` line is a
shell fallback artefact, not a second count.

### 5.8 Operator-determined stop-line entries

- `operator_uncertain`: `no`

---

## 6. Computed aggregates

All aggregates below are computed from §5.

- `all_live_artifacts_present` (yes only if all four §5.3 `*_present=yes`): **yes** *(all four inputs `yes`)*
- `all_live_hashes_match_baseline` (yes only if all four §5.4 `live_hash_match_baseline_*=yes`): **yes** *(all four inputs `yes`)*
- `endpointUrl_category`: **`render_legacy_collect`** *(carried from §5.5)*
- `sprint2_endpoint_config_present`: **no** *(carried from §5.5)*
- `rollback_artifact_source_present` (yes only if §5.6 `rollback_root_dir_present=yes` AND `latest_bundle_found=yes` AND all four bundle artifacts present AND `manifest_present=yes`): **yes** *(all conditions met)*
- `rollback_procedure_source_present`: **yes** *(carried from §5.6)*
- `latest_bundle_found`: **yes** *(carried from §5.6; bundle basename `buyerrecon-gate4b-rollback-20260524T115806Z`)*
- `bundle_intact`: **yes** *(carried from §5.6; `sha256sum -c MANIFEST.txt` from inside the bundle returned exit `0`)*
- `backup_hashes_match_live` (yes only if all four §5.6 per-file `_backup_matches_live=yes`): **yes** *(all four inputs `yes`)*
- `all_stop_lines_clear` (yes only if every §7 stop-line is `no`): **yes** *(every §7 entry is `no`; `stop_lines_triggered: none`)*

---

## 7. Stop-lines

Each stop-line is recorded categorically from §5. Any single
triggered stop-line would have forced a `BLOCKED` verdict; none were
triggered.

- `host_not_production` (§5.1 `host_category != production`): **no** *(§5.1 `host_category=production`)*
- `operator_not_root` (§5.1 `operator_user_category != root`): **no** *(§5.1 `operator_user_category=root`)*
- `live_artifact_root_missing` (§5.2 any `*_exists=no`): **no** *(both §5.2 `_exists=yes`)*
- `any_required_live_artifact_missing` (§5.3 any `*_present=no`): **no** *(all four §5.3 `_present=yes`)*
- `live_hash_mismatches_baseline` (§5.4 any `live_hash_match_baseline_*=no`): **no** *(all four §5.4 `=yes`)*
- `endpoint_category_not_render_legacy_collect` (§5.5 `endpointUrl_category != render_legacy_collect`): **no** *(§5.5 `endpointUrl_category=render_legacy_collect`)*
- `sprint2_v1_event_active_unexpectedly` (§5.5 `sprint2_endpoint_config_present=yes` without recorded Gate 4C approval): **no** *(§5.5 `sprint2_endpoint_config_present=no`)*
- `both_collect_and_v1event_present_unexpectedly` (§5.5 `both_collect_and_v1event_present=yes` without recorded Gate 4C approval): **no** *(§5.5 `both_collect_and_v1event_present=no`)*
- `rollback_root_missing` (§5.6 `rollback_root_dir_present=no`): **no** *(§5.6 `=yes`)*
- `latest_rollback_bundle_missing` (§5.6 `latest_bundle_found=no`): **no** *(§5.6 `=yes`; basename `buyerrecon-gate4b-rollback-20260524T115806Z`)*
- `bundle_integrity_fails` (§5.6 `bundle_intact=no`): **no** *(§5.6 `bundle_intact=yes` via `sha256sum -c MANIFEST.txt`)*
- `backup_live_hash_mismatch` (§5.6 any `*_backup_matches_live=no`): **no** *(all four §5.6 `=yes`)*
- `rollback_procedure_source_missing` (§5.6 `rollback_procedure_present=no`): **no** *(§5.6 `=yes`)*
- `live_var_www_artifact_changed` (§5.7 any `post_check_live_hash_match_baseline_*=no`): **no** *(all four §5.7 `=yes`)*
- `var_www_edit_attempted_or_observed` (any `cp` into / `mv` / `rm` / `chmod` / `chown` / `ln -s` against any `/var/www/` path during the window): **no** *(§4 contains no such command; the only `/var/www/` reads were `test`, `sha256sum`, and `grep -c`, all read-only; §5.7 `var_www_live_artifacts_unchanged=yes` and four post-check baseline matches confirm zero byte change)*
- `production_traffic_generated` (§5.7): **no** *(§5.7; §4 contains no `curl` / `wget` / `httpie` / `nc` / browser invocation)*
- `secret_printed` (§5.7; also any DSN, password, `Authorization:` header value, bearer token, raw `request_id`, raw `session_id`, raw payload, raw response body, env dump, private key / cert body, vault content, shell history line, or raw row surfaces): **no** *(§5.7 `secret_printed=no`; §4 prints only categorical labels, sha256 hashes, public artifact paths, and the operational `LATEST_BUNDLE` basename)*
- `operator_uncertain` (§5.8): **no** *(per operator paste-back)*

**`stop_lines_triggered`:** **`none`**.

No stop-line triggered. The §1 PASS verdict stands.

---

## 8. Historical 26-row warning carry-forward

PR#18aa carries the PR#17s / PR#18w 26-row warning forward verbatim.
This section did not require operator paste-back; the evidence is
already recorded on base in
`docs/sprint2-pr18w-gate4a-db-grant-traffic-reaudit-proof.md` §3.5 / §5 /
§7 and `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`
§1 / §4. PR#18aa is read-only-artifact-scope and does not query the DB.

- **Count:** `ingest_requests_endpoint_v1_event_count = 26` on the
  production cluster (per PR#18w §3.5).
- **Window:** `v1_event_first_seen_day = 2026-05-19`,
  `v1_event_last_seen_day = 2026-05-19`.
- **Status distribution:** `distribution_http_status = 400: 26`.
- **Reason distribution:** `distribution_reject_reason_code =
  request_body_invalid_json: 26`.
- **Downstream propagation:** `accepted_events_count = 0`,
  `rejected_events_count = 0`, `lane_a_row_count = 0`,
  `lane_b_row_count = 0`.
- **Origin:** ThinSDK ↔ Sprint 2 `/v1/event` contract-shape mismatch
  documented in PR#17s.
- **Preservation rule:** "**Do not delete, mutate, annotate, or
  normalise these rows.**" The on-host `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md`
  created by PR#18z §G embeds the same rule under its `## Do-not rules`
  section, so the rule survives even if this repo doc is later moved
  or renamed.

Any future Gate 4B re-audit PR, Gate 4C canary PR, Gate 4D observation
PR, Gate 4E Track A / Playwright PR, issue-fix PR, runtime PR,
customer-surface PR, or final scoring / governance recap PR must
continue to honour the do-not rules. Gate 4C canary success must be
measured as a **delta from the 26-row baseline**, not as an absolute
count.

---

## 9. Gate posture after this re-audit

Recorded against §1's `PASS` verdict and §7's `stop_lines_triggered=none`:

- **Gate 4B artifact / config / rollback re-audit is non-`BLOCKED`.**
  The PR#18y stop-lines (`rollback_artifact_source_missing`,
  `rollback_procedure_source_missing`) are categorically lifted, and
  the Gate 4B blocker stack from PR#18p → PR#18y → PR#18z → PR#18aa
  is closed.
- **Gate 4C remains unapproved.** Re-flipping `endpointUrl` to
  `/v1/event` requires its own separate Helen GO, its own rollback
  plan (the PR#18z bundle `buyerrecon-gate4b-rollback-20260524T115806Z`
  + `ROLLBACK-PROCEDURE.md` are now provably present on the production
  host per §5.6, satisfying PR#18x §5 / PR#18y §11 precondition 2),
  its own exact file-diff plan, its own exact pre/post artifact hash
  capture, its own canary scope, its own Gate-4C-specific stop-line
  set, and its own proof record. PR#18aa does **not** pre-authorise,
  sequence, or schedule any Gate 4C work. Seven of the eight Gate 4C
  preconditions (PR#18x §5, PR#18y §11) remain unsatisfied by PR#18aa.
- **Gate 4D organic observation remains unapproved.**
- **Gate 4E Track A / Playwright work remains unapproved.**
- **Final scoring / governance recap PR remains required** before any
  production-cutover readiness claim. PR#18aa is one input to that
  recap; it is not the recap itself.

---

## 10. Acceptance criteria

PR#18aa is acceptable for merge into
`sprint2-architecture-contracts-d4cc2bf` only if
§5 / §6 / §7, the §1 verdict is set per the §1 classification rule,
and **all** of the following hold:

- **Docs-only repo change.** Exactly one new file changes in the repo:
  `docs/sprint2-pr18aa-gate4b-reaudit-after-rollback.md`. No code, no
  scripts, no tests, no package files, no migrations, no `schema.sql`,
  no env files, no systemd / Nginx files, no AMS source, no website
  artifacts, no production config, no DB grant files change.
- **Read-only production re-audit only.** No write, no traffic, no
  HTTP call, no `/var/www/` mutation. The only on-host operations are
  `test`, `stat`, `sha256sum`, `ls`, `grep -c`, and `sha256sum -c`
  (`sha256sum -c` is a read-only verification).
- **Live artifacts unchanged.** §5.7 all four
  `post_check_live_hash_match_baseline_*=yes`;
  `var_www_live_artifacts_unchanged=yes`; §7
  `var_www_edit_attempted_or_observed=no`;
  `live_var_www_artifact_changed=no`.
- **Endpoint remains `render_legacy_collect`.** §5.5
  `endpointUrl_category=render_legacy_collect`;
  `br-thinlayer-init.js /collect count = 1`,
  `/v1/event count = 0`.
- **Sprint 2 `/v1/event` inactive.** §5.5
  `sprint2_endpoint_config_present=no`;
  `both_collect_and_v1event_present=no`.
- **Rollback root / bundle / procedure present.** §5.6 / §6
  aggregates all `yes`.
- **`bundle_intact=yes`** via `sha256sum -c MANIFEST.txt` from inside
  the bundle directory.
- **`backup_hashes_match_live=yes`** (all four per-file =yes).
- **No §7 stop-line triggered.**
- **No production traffic.** §5.7 `production_traffic_generated=no`.
- **No secrets.** §5.7 `secret_printed=no`; secret-safety grep returns
  only metadata / governance / attestation hits.
- **Gate 4C remains unapproved.** §9.
- **Final recap requirement preserved.**

---

## 11. Files planned to change

### 11.1 Repo (this PR, docs-only)

| Path | Action | Lines | Tracked-files-modified |
|---|---|---|---|
| `docs/sprint2-pr18aa-gate4b-reaudit-after-rollback.md` | NEW | ~780 (finalised) | 0 |

No code, scripts, tests, package files, migrations, `schema.sql`, env
files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

### 11.2 Production host

| Path | Action | Writes? |
|---|---|---|
| `/var/www/buyerrecon.com/html/...` (four artifacts) | READ ONLY (`test -f`, `sha256sum`, `grep -c`) | No |
| `/root/buyerrecon-rollback/` and bundle subtree | READ ONLY (`test -d`/`-f`, `stat`, `ls`, `sha256sum`, `sha256sum -c`) | No |
| Nginx config, systemd unit, DNS, DB, `/opt/buyerrecon-backend/` | NOT TOUCHED | No |

PR#18aa is purely read-only against the production host. No new file
or directory is created, modified, or deleted by §A–§G.

---

End of PR#18aa. **Gate 4B re-audit after rollback reconstitution
execution proof. Verdict: PASS. Stop-lines triggered: none. The Gate
4B blocker stack from PR#18p → PR#18y → PR#18z → PR#18aa is closed.
Shell / host safety clean (`host_category=production`,
`operator_user_category=root`, `shell_trace=off`,
`histfile_unset=yes`, `umask_077=yes`); both live website roots
exist; all four live static artifacts (`br-thinlayer-init.js`,
`thin-sdk.iife.js`, `br-probe-init.js`, `index.html`) present; all
four live sha256 still match the PR#18p §3.1 / PR#18x §3.1 / PR#18y
§6 / PR#18z §6.2 baseline character-for-character. Endpoint posture
unchanged: `endpointUrl_category=render_legacy_collect`,
`render_collect_legacy_present=yes`,
`sprint2_endpoint_config_present=no`,
`both_collect_and_v1event_present=no`,
`br-thinlayer-init.js /collect count = 1`, `/v1/event count = 0`,
all other artifacts both counts = 0. Rollback posture verified
intact: `/root/buyerrecon-rollback/` exists at mode `0700` owner
`root:root`; latest bundle `buyerrecon-gate4b-rollback-20260524T115806Z`
(matching PR#18z §6.3) exists at mode `0700` owner `root:root`; all
four bundle artifacts present at mode `0600` owner `root:root`;
`MANIFEST.txt`, `LIVE-HASHES-AT-CAPTURE.txt`, and
`ROLLBACK-PROCEDURE.md` all present at mode `0600` owner `root:root`;
`bundle_intact=yes` via `( cd "$LATEST_BUNDLE" && sha256sum -c
MANIFEST.txt >/dev/null 2>&1 )`; all four per-file
`_backup_matches_live=yes`. Post-check: all four live sha256 still
match baseline at end of §A–§G window;
`post_check_br_thinlayer_init_collect_count=1`,
`post_check_br_thinlayer_init_v1event_count=0`. Aggregates:
`all_live_artifacts_present=yes`,
`all_live_hashes_match_baseline=yes`,
`rollback_artifact_source_present=yes`,
`rollback_procedure_source_present=yes`, `latest_bundle_found=yes`,
`bundle_intact=yes`, `backup_hashes_match_live=yes`,
`all_stop_lines_clear=yes`. Attestations:
`var_www_live_artifacts_unchanged=yes`,
`production_traffic_generated=no`, `secret_printed=no`,
`cleanup_done=yes`, `operator_uncertain=no`. No production-host
mutation occurred; PR#18aa was purely read-only against
`/var/www/buyerrecon.com/html/` and `/root/buyerrecon-rollback/`.
The repo change is docs-only. No code, scripts, tests, package
files, migrations, `schema.sql`, env files, systemd / Nginx files,
AMS source, website artifacts, production config, or DB grant files
modified in the repo. PR#18aa's PASS converts the PR#18z rollback
reconstitution into a categorical Gate 4B non-`BLOCKED` outcome.
Gate 4C `endpointUrl` re-flip remains unapproved; one of the eight
Gate 4C preconditions (rollback-first; bundle + procedure present
and verified) is now provably satisfied, but the other seven —
explicit Helen GO scoped narrowly to Gate 4C, exact file-diff plan,
exact pre/post artifact hash, no raw secrets, canary scope,
Gate-4C-specific stop-line set, Gate 4C proof record — remain
unsatisfied by PR#18aa. Gate 4D organic observation remains
unapproved; Gate 4E Track A / Playwright work remains unapproved.
The 26 historical PR#17s rows on the production cluster remain
preserved and must not be deleted, mutated, annotated, or normalised
away. The final scoring / governance recap PR remains required
before any production-cutover readiness claim. No `endpointUrl`
re-flip, no Gate 4C approval, no Gate 4C canary, no production
traffic generation, no `buyerrecon.com` production `/v1/event` call,
no Render `/collect` call, no `/var/www` edit, no symlink change, no
`nginx -s reload`, no `systemctl` action, no service restart, no
DNS change, no DB write, no DB grant, no migration, no `schema.sql`
change, no env file edit, no credential rotation, no
`buyerrecon_prod_collector_app` reset, no `buyerrecon_migrator`
reset, no production token provisioning, no Lane A/B writer, no
customer-facing output, no dashboard implementation, no AMS runtime
bridge, no Pass 1 / Trust / Pass 2 runtime, no runtime scoring, no
Track A, no Playwright, no website ThinSDK production-mode
activation, no production artifact / config mode flip, no Gate 4D
observation, no Gate 4E Track A / Playwright work, no deletion /
mutation / annotation / normalisation of the 26 historical PR#17s
rows on the production cluster, and no secret printing are approved
by PR#18aa. Any future Gate 4C canary PR (which must satisfy PR#18x
§5 / PR#18y §11's eight preconditions and reference the PR#17s
26-row baseline), Gate 4D observation PR, Gate 4E Track A /
Playwright PR, issue-fix PR, runtime PR, customer-surface PR, or
final scoring / governance recap PR remains separately gated by its
own explicit Helen GO.**
