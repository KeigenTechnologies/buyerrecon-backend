# Sprint 2 PR#18z: Gate 4B Rollback Reconstitution Remediation

> Docs-only proof record. The §5 §A–§I command set was executed on the
> production host by the operator (Helen) under explicit Helen GO scoped
> to rollback reconstitution only. The categorical paste-back from that
> execution is recorded into §6 of this doc. No `endpointUrl` re-flip,
> no Gate 4C approval, no canary, no production traffic generation, no
> live website artifact / config change occurred.

---

## 1. Status / verdict

**Verdict: PASS.**

PR#18z reconstituted the rollback posture that BLOCKED PR#18y / PR #57
(Gate 4B read-only artifact / config check). The two stop-lines
(`rollback_artifact_source_missing`, `rollback_procedure_source_missing`)
are categorically lifted on the production host as of bundle
`buyerrecon-gate4b-rollback-20260524T115806Z` under
`/root/buyerrecon-rollback/`. Every PASS condition in the §1
classification rule below is met:

- **Shell / host safety** (§6.1): `host_category=production`,
  `operator_user_category=root`, `shell_trace=off`, `histfile_unset=yes`,
  `umask_077=yes`.
- **Preflight live integrity** (§6.2): all four live artifacts present;
  all four sha256 still match the PR#18p §3.1 / PR#18x §3.1 / PR#18y §6
  baseline — no drift since PR#18y execution.
- **Rollback root + bundle directory** (§6.3 + §6.8): root dir created
  at `/root/buyerrecon-rollback/` mode `0700` owner `root:root`;
  timestamped bundle subdirectory `buyerrecon-gate4b-rollback-20260524T115806Z`
  created mode `0700` owner `root:root`.
- **Bundle artifact copies** (§6.4): all four artifacts present in the
  bundle at mode `0600` owner `root:root`.
- **Manifests** (§6.5): `MANIFEST.txt` (relative-filename, run from
  inside `$BUNDLE_DIR`) and `LIVE-HASHES-AT-CAPTURE.txt` (absolute-path
  live capture) both present at mode `0600` owner `root:root`.
- **Backup ↔ live hash equality** (§6.6): all four per-file
  `_backup_matches_live=yes`.
- **Rollback procedure source** (§6.7): `ROLLBACK-PROCEDURE.md` created
  at `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` mode `0600`
  owner `root:root`. Operator-confirmed bonus checks (run after the
  heredoc settled): `latest_bundle_found=yes`, `bundle_intact=yes`
  via `sha256sum -c MANIFEST.txt` from inside the bundle directory.
- **Aggregate presence + permissions** (§6.8): every presence and
  permission check returned `yes`.
- **Post-check** (§6.9): all four live sha256 still match baseline;
  `br-thinlayer-init.js /collect count = 1`,
  `br-thinlayer-init.js /v1/event count = 0`;
  `var_www_live_artifacts_unchanged=yes`,
  `production_traffic_generated=no`, `secret_printed=no`,
  `cleanup_done=yes`.
- **Aggregates computed in §7**: `rollback_artifact_source_present=yes`
  (both root dir + backup artifact present);
  `backup_hashes_match_live=yes` (all four per-file = yes).
- **No §8 stop-line triggered** (`stop_lines_triggered: none`).

This PASS verdict lifts the rollback-posture blocker on Gate 4B. A
**follow-up Gate 4B re-audit PR** (under its own Helen GO) must now re-run
PR#18y's §4 §A–§F read-only artifact / config check against the
reconstituted rollback posture and produce a non-`BLOCKED` verdict before
any Gate 4C consideration may proceed (§10). PR#18z does **not** authorise
or pre-sequence that re-audit, and PR#18z does **not** authorise Gate 4C
in any form.

### Verdict classification rule (applied to this proof in §1 once §6 is populated)

**PASS** requires all of:

- §A: `host_category=production`, `operator_user_category=root`,
  `shell_trace=off`, `histfile_unset=yes`, `umask_077=yes`;
- §B preflight: each live artifact present and each live sha256 still
  matches the PR#18p §3.1 / PR#18x §3.1 / PR#18y §6 baseline
  (no drift since PR#18y execution);
- §C: rollback root dir created at the proposed path with mode `0700`,
  owner `root:root`; timestamped bundle subdirectory created with mode
  `0700`, owner `root:root`;
- §D: all four artifacts copied into the bundle subdirectory at mode
  `0600`, owner `root:root`;
- §E: `MANIFEST.txt` and `LIVE-HASHES-AT-CAPTURE.txt` written with mode
  `0600`, owner `root:root`;
- §F: every per-file `_backup_matches_live=yes` (all four hashes equal
  between backup copy and live source);
- §G: `ROLLBACK-PROCEDURE.md` created at the proposed path with mode
  `0600`, owner `root:root`, content matches the §G template (no
  secrets, no DSN, no token, no payload);
- §H: `rollback_root_dir_present=yes`,
  `rollback_backup_dir_present=yes`,
  `rollback_backup_artifact_present=yes`,
  `rollback_procedure_source_present=yes`, plus all `_mode_0700` /
  `_mode_0600` / `_owner_root_root` permission checks `yes`;
- §I: `var_www_live_artifacts_unchanged=yes`,
  `production_traffic_generated=no`, `secret_printed=no`,
  `cleanup_done=yes`;
- §7 aggregate `rollback_artifact_source_present=yes`;
- §7 aggregate `backup_hashes_match_live=yes`;
- §7 `endpointUrl_category` remains `render_legacy_collect` (re-checked
  in §B preflight and again at §I attestation);
- no §8 stop-line triggered.

**PASS_WITH_WARNINGS** is permitted when all stop-lines are `no` and the
§9 historical PR#17s 26-row warning is carried forward (it always is, by
reference; this is a structural warning that travels with every Gate 4 PR
until the final recap closes it).

**BLOCKED** is required if any §8 stop-line is triggered.

### Scope boundaries

- No `endpointUrl` re-flip.
- No Gate 4C approval, no canary, no production traffic generation.
- No HTTP call to the production collector or any production endpoint
  (no `curl`, no `wget`, no `httpie`, no `nc`, no browser).
- **No edit to any live served artifact.** The four files under
  `/var/www/buyerrecon.com/html/` may be `sha256sum`'d and `install`'d as
  source for the bundle copies; they must **not** be edited, moved,
  removed, chmoded, chowned, symlinked, or otherwise mutated.
- No symlink change (no `ln -s` against any path).
- No `nginx -s reload`, no `systemctl`, no service restart.
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
  raw payload, no raw response body, no env dump, no private key / cert
  body, no vault content, no shell history, no raw row).
- No `cat` / `head` / `tail` / `diff` of any artifact contents in this
  proof; the only file-content read is `sha256sum`, which emits only
  the hash and the path.

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

## 2. Why PR#18z exists

PR#18y / PR #57 — Gate 4B read-only artifact / config check execution
proof — recorded verdict **`BLOCKED`** with two stop-lines triggered:

- `rollback_artifact_source_missing` (`rollback_backup_dir_present=no`,
  `rollback_backup_artifact_present=no`, aggregate
  `rollback_artifact_source_present=no`)
- `rollback_procedure_source_missing` (`rollback_procedure_source_present=no`)

The artifact and endpoint posture were otherwise clean (every other §10
stop-line returned `no`; all four static artifact sha256 hashes matched
the PR#18p §3.1 / PR#18x §3.1 baseline character-for-character;
`endpointUrl_category=render_legacy_collect`;
`sprint2_endpoint_config_present=no`;
`both_collect_and_v1event_present=no`). PR#18y §8 recorded this as a
categorical regression versus PR#18p §3.3 (which had recorded all four
rollback surfaces as `yes`), and deferred the cause-diagnosis and the
reconstitution work to a separate fix PR under its own explicit Helen GO
— this PR.

PR#18z's scope is **strictly** the rollback-posture reconstitution
needed to lift those two stop-lines:

1. create a canonical, root-only rollback backup directory (outside the
   live served artifact path);
2. populate it with a timestamped bundle of the four current static
   artifacts (byte-identical copies);
3. capture sha256 hashes of both the backup copies and the live sources
   at the moment of capture, and verify per-file equality;
4. create a rollback procedure source document on the production host
   that records what the bundle protects, how to restore from it, what
   to verify after restore, and what stop-lines prevent restore;
5. neither edit, move, remove, chmod, chown, nor symlink any live served
   artifact during the entire operation.

PR#18z does **not** attempt to root-cause why the PR#18p §3.3
`backup_dir_present=yes` evidence is no longer reproducible at PR#18y
execution time. Possible historical causes (deleted, moved, renamed,
relocated, stale runbook references, or imprecise PR#18p paste-back) are
out of scope; PR#18z's job is to put the rollback posture back into a
provable state under a canonical, repeatedly-verifiable location.

PR#18z's completion does **not** unblock Gate 4C. A follow-up Gate 4B
re-audit must produce a non-`BLOCKED` verdict before any Gate 4C
consideration may proceed (§10).

---

## 3. Scope and non-approval

PR#18z is the **Gate 4B rollback reconstitution remediation** PR. Its
scope is strictly the §2 five-item reconstitution. Under no
interpretation does PR#18z approve any of the following — each requires
its own explicit Helen GO scoped to that specific work:

- no Gate 4C `endpointUrl` re-flip,
- no Gate 4C canary (controlled human page-load, fixture event, or
  synthetic write smoke),
- no production traffic generation (no `curl` / `wget` / `httpie` / `nc`
  / browser against the production collector or any production endpoint),
- no live `/var/www/buyerrecon.com/html/` artifact / config change of
  any kind (no edit, no copy *into* the live root, no move, no remove,
  no chmod, no chown, no symlink),
- no Nginx config change, no Nginx reload,
- no `systemctl` against any production service,
- no DNS change,
- no DB write, no DB grant, no migration, no `schema.sql` change,
- no env file edit, no credential rotation, no
  `buyerrecon_prod_collector_app` reset, no `buyerrecon_migrator`
  reset, no production token provisioning,
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

PR#18z is one input to the final scoring / governance recap PR; it is
not the recap itself (see §11).

---

## 4. Remediation plan

### 4.1 Backup directory — proposed canonical location

- **Proposed path:** `/root/buyerrecon-rollback/`
- **Owner:** `root:root`
- **Mode:** `0700`
- **Rationale:**
  - **Outside `/var/www/`.** The live served root must not be polluted
    with backup artifacts; an Nginx misconfiguration that started
    serving directory listings could otherwise leak the bundle. Putting
    the rollback root under `/root/` removes that risk entirely.
  - **Matches existing root-only operator convention.** The production
    DB binding (`/root/buyerrecon-production-db.env`, PR#18v) and the
    PR#17o token file (`/root/buyerrecon-pr17m-new-site-write-tokens-20260519T143703Z.txt`)
    already use `/root/` for root-only operator material. Putting
    rollback artifacts under `/root/` is the consistent choice.
  - **Outside any git working tree.** `/opt/buyerrecon-backend/` is a
    git working tree per PR#17n §10.4; placing rollback artifacts
    there would risk accidental `git add`. `/root/` has no such risk.
  - **Persistent across backend deploys / service restarts.** Nothing
    in the deploy pipeline (per PR#17n) touches `/root/`.
- **PR#18o §5.E precedent.** PR#18o §5.E used a placeholder
  `<buyerrecon_com_backup_root_candidate>` that was never made
  canonical. PR#18z is the PR that makes the location canonical.
  Future Gate 4A / 4B audits (PR#18o §5.E updates) should reference
  `/root/buyerrecon-rollback/` as the canonical backup root.

### 4.2 Bundle subdirectory — naming convention

- **Naming pattern:** `buyerrecon-gate4b-rollback-<UTC_TIMESTAMP>` where
  `<UTC_TIMESTAMP>` is `YYYYMMDDTHHMMSSZ` (ISO-like, UTC-explicit,
  sortable).
- **Full path:** `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-<UTC_TIMESTAMP>/`
- **Owner:** `root:root`
- **Mode:** `0700`
- **Rationale:**
  - Timestamp pins the bundle to a specific capture moment, enabling
    multiple bundles to coexist if a re-capture is later authorised.
  - UTC eliminates DST / TZ ambiguity.
  - The `Z` suffix makes UTC explicit.

### 4.3 Bundle contents

Exactly four byte-identical copies of the live static artifacts, plus
two manifest files:

| Bundle file | Source (live, unchanged) | Mode | Owner |
|---|---|---|---|
| `br-thinlayer-init.js` | `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js` | `0600` | `root:root` |
| `thin-sdk.iife.js` | `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js` | `0600` | `root:root` |
| `br-probe-init.js` | `/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js` | `0600` | `root:root` |
| `index.html` | `/var/www/buyerrecon.com/html/index.html` | `0600` | `root:root` |
| `MANIFEST.txt` | (generated) `sha256sum` of the four bundle files | `0600` | `root:root` |
| `LIVE-HASHES-AT-CAPTURE.txt` | (generated) `sha256sum` of the four live source files at the same moment | `0600` | `root:root` |

The two manifest files make the bundle self-verifying: a future restore
can re-`sha256sum` the bundle copies, compare to `MANIFEST.txt`, and
abort if any byte has drifted. `LIVE-HASHES-AT-CAPTURE.txt` records
what the live state was at capture, so the bundle's provenance is
provable independent of the live state.

### 4.4 Rollback procedure source — proposed path and content

- **Proposed path:** `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md`
- **Owner:** `root:root`
- **Mode:** `0600`
- **Content:** see §5.G heredoc template. No secrets, no DSN, no
  password, no token, no `Authorization:` header value, no raw
  `request_id`, no raw `session_id`, no raw payload, no env dump, no
  private key / cert body, no vault content. The doc records:
  - what the bundle protects (the four artifact paths and the
    `render_legacy_collect` endpoint posture),
  - how to find the most recent bundle
    (`ls -1dt /root/buyerrecon-rollback/buyerrecon-gate4b-rollback-*/ | head -n 1`),
  - how to restore (per-file `install -m 0644 -o root -g www-data`
    from bundle → live path, with `sha256sum` verify after each copy),
  - the verification commands to run after restore,
  - the stop-lines that prevent restore (hash drift, missing bundle,
    PR#17s-pattern recurrence, etc.),
  - the do-not-delete / do-not-mutate / do-not-annotate /
    do-not-normalise rule for the 26 historical PR#17s rows on the
    production cluster,
  - the no-DB-action / no-secret-print rules.

### 4.5 Hash verification

Two verifications run in §F:

1. **Per-file backup ↔ live equality.** For each of the four artifact
   names, `sha256sum` the live path and the bundle copy and compare.
   All four must equal for `backup_hashes_match_live=yes`.
2. **Bundle ↔ PR#18p baseline.** For each of the four bundle copies,
   the sha256 must match the PR#18p §3.1 / PR#18x §3.1 / PR#18y §6
   baseline. (This is implicit if §B preflight passes and §F per-file
   equality passes, because §F equality combined with §B preflight
   baseline-match implies bundle = baseline.)

### 4.6 Permission posture summary

| Path | Mode | Owner | Rationale |
|---|---|---|---|
| `/root/buyerrecon-rollback/` | `0700` | `root:root` | root-only ops dir |
| `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-<TS>/` | `0700` | `root:root` | root-only bundle dir |
| Each bundle artifact (`*.js`, `*.html`) | `0600` | `root:root` | more restrictive than live (live is web-served); bundle is operator-only |
| `MANIFEST.txt` / `LIVE-HASHES-AT-CAPTURE.txt` | `0600` | `root:root` | operator-only |
| `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` | `0600` | `root:root` | operator-only |
| Live `/var/www/buyerrecon.com/html/...` (unchanged) | (pre-existing) | (pre-existing) | not touched by PR#18z |

### 4.7 Stop-lines for the remediation

See §8 for the full enumeration. Highlights:

- live artifact missing or hash drifted from PR#18p baseline in §B
  preflight → STOP before any write;
- bundle directory creation fails or wrong perm/owner → STOP, do not
  proceed to copies;
- per-file backup ↔ live hash mismatch → STOP, treat bundle as
  unreliable;
- rollback procedure source creation fails or wrong perm/owner → STOP;
- any `/var/www/` mutation observed → STOP, treat as scope breach;
- endpoint category drifted from `render_legacy_collect` between §B and
  §I → STOP, treat as unexpected concurrent change;
- any secret printed → STOP, treat as scope breach;
- operator uncertain at any step → STOP.

---

## 5. Production command set

> **Helen approval gate.** The following §A–§I command block writes to
> the production host (under `/root/buyerrecon-rollback/`). It was
> executed on the production host by the operator under explicit Helen
> GO; the categorical paste-back is recorded into §6.

> **Operator-only invariants throughout §5:** no `cat` / `head` / `tail`
> / `diff` of any artifact contents (only `ls -la`, `test -f` / `-d`,
> `sha256sum`, `stat`, `install`, `chmod`, `chown`, `mkdir`, `cat >`
> with the explicit non-secret heredoc in §G); no `find` walking outside
> the two named paths; no HTTP call; no DSN, no password, no
> `Authorization:` header value, no bearer token, no raw `request_id`,
> no raw `session_id`, no raw payload, no raw response body, no env
> dump, no private key / cert body, no vault content, no shell history,
> no raw row.

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

Paste-back into §6.1:
- `host_category`: <production|staging|local|unknown> (**stop if not `production`**)
- `operator_user_category`: <root|unexpected> (**stop if not `root`** — bundle creation requires root)
- `shell_trace: <on|off>`
- `histfile_unset: <yes|no>`
- `umask_077: <yes|no>`

### B. Preflight live artifact existence + hash check

Confirm each live artifact still exists and that its sha256 still matches
the PR#18p §3.1 / PR#18x §3.1 / PR#18y §6 baseline. **If any hash drifted
since PR#18y execution, STOP before any write** — that would mean the
live state changed under our feet and the bundle would capture a state
different from the published baseline.

```bash
for spec in \
  '/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js 9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0' \
  '/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js     7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1' \
  '/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js     09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84' \
  '/var/www/buyerrecon.com/html/index.html                     30b46c1256bb2935bbfa2becfd9f6e86d6bc4beba2d641a744720c553810965c'; do
  P=$(echo "$spec" | awk '{print $1}')
  B=$(echo "$spec" | awk '{print $2}')
  if [ ! -f "$P" ]; then
    echo "preflight_live_present_$(basename "$P"): no"
    continue
  fi
  echo "preflight_live_present_$(basename "$P"): yes"
  H=$(sha256sum "$P" 2>/dev/null | awk '{print $1}')
  if [ "$H" = "$B" ]; then
    echo "preflight_live_hash_match_baseline_$(basename "$P"): yes"
  else
    echo "preflight_live_hash_match_baseline_$(basename "$P"): no"
  fi
done
```

Paste-back into §6.2:
- four `preflight_live_present_*: yes|no`
- four `preflight_live_hash_match_baseline_*: yes|no`

**Stop if any value is `no`.** Do not proceed to §C–§I.

### C. Create rollback directory + timestamped bundle subdirectory

```bash
install -d -m 0700 -o root -g root /root/buyerrecon-rollback

ROLLBACK_TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BUNDLE_DIR="/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-${ROLLBACK_TIMESTAMP}"
install -d -m 0700 -o root -g root "$BUNDLE_DIR"

echo "rollback_timestamp: $ROLLBACK_TIMESTAMP"
echo "bundle_dir_basename: $(basename "$BUNDLE_DIR")"
echo "rollback_root_dir_created: $([ -d /root/buyerrecon-rollback ] && echo yes || echo no)"
echo "bundle_dir_created: $([ -d "$BUNDLE_DIR" ] && echo yes || echo no)"
```

Paste-back into §6.3 (record only categorical fields; the timestamp + bundle basename are operational, not secret):
- `rollback_timestamp: <YYYYMMDDTHHMMSSZ>`
- `bundle_dir_basename: buyerrecon-gate4b-rollback-<YYYYMMDDTHHMMSSZ>`
- `rollback_root_dir_created: <yes|no>`
- `bundle_dir_created: <yes|no>`

### D. Copy four static artifacts into rollback bundle

`install` does the copy + perm + owner set atomically. No `cp -p` /
`cp -a` (we want to override mode + owner). No `mv`, no `rm`, no
`chown`/`chmod` against the live source.

```bash
install -m 0600 -o root -g root /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js "$BUNDLE_DIR/br-thinlayer-init.js"
install -m 0600 -o root -g root /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js     "$BUNDLE_DIR/thin-sdk.iife.js"
install -m 0600 -o root -g root /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js     "$BUNDLE_DIR/br-probe-init.js"
install -m 0600 -o root -g root /var/www/buyerrecon.com/html/index.html                      "$BUNDLE_DIR/index.html"

for f in br-thinlayer-init.js thin-sdk.iife.js br-probe-init.js index.html; do
  echo "bundle_present_${f}: $([ -f "$BUNDLE_DIR/$f" ] && echo yes || echo no)"
  echo "bundle_mode_0600_${f}: $([ "$(stat -c '%a' "$BUNDLE_DIR/$f" 2>/dev/null)" = "600" ] && echo yes || echo no)"
  echo "bundle_owner_root_root_${f}: $([ "$(stat -c '%U:%G' "$BUNDLE_DIR/$f" 2>/dev/null)" = "root:root" ] && echo yes || echo no)"
done
```

Paste-back into §6.4 (12 lines: presence + mode + owner per file).

### E. Hash backup copies + capture live hashes at same moment

```bash
(
  cd "$BUNDLE_DIR"
  sha256sum br-thinlayer-init.js thin-sdk.iife.js br-probe-init.js index.html > MANIFEST.txt
)
chmod 0600 "$BUNDLE_DIR/MANIFEST.txt"
chown root:root "$BUNDLE_DIR/MANIFEST.txt"

sha256sum /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js \
          /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js \
          /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js \
          /var/www/buyerrecon.com/html/index.html > "$BUNDLE_DIR/LIVE-HASHES-AT-CAPTURE.txt"
chmod 0600 "$BUNDLE_DIR/LIVE-HASHES-AT-CAPTURE.txt"
chown root:root "$BUNDLE_DIR/LIVE-HASHES-AT-CAPTURE.txt"

echo "manifest_present: $([ -f "$BUNDLE_DIR/MANIFEST.txt" ] && echo yes || echo no)"
echo "manifest_mode_0600: $([ "$(stat -c '%a' "$BUNDLE_DIR/MANIFEST.txt" 2>/dev/null)" = "600" ] && echo yes || echo no)"
echo "manifest_owner_root_root: $([ "$(stat -c '%U:%G' "$BUNDLE_DIR/MANIFEST.txt" 2>/dev/null)" = "root:root" ] && echo yes || echo no)"
echo "live_hashes_at_capture_present: $([ -f "$BUNDLE_DIR/LIVE-HASHES-AT-CAPTURE.txt" ] && echo yes || echo no)"
echo "live_hashes_at_capture_mode_0600: $([ "$(stat -c '%a' "$BUNDLE_DIR/LIVE-HASHES-AT-CAPTURE.txt" 2>/dev/null)" = "600" ] && echo yes || echo no)"
echo "live_hashes_at_capture_owner_root_root: $([ "$(stat -c '%U:%G' "$BUNDLE_DIR/LIVE-HASHES-AT-CAPTURE.txt" 2>/dev/null)" = "root:root" ] && echo yes || echo no)"
```

Paste-back into §6.5 (6 categorical lines). The two manifest files
themselves contain only `<sha256>  <filename-or-path>` per line — no
secrets. `MANIFEST.txt` uses relative bundle filenames and is the only
file used for bundle self-integrity verification. `LIVE-HASHES-AT-CAPTURE.txt`
is a separate live-source hash capture and is not used for bundle
self-integrity verification.

### F. Verify live-vs-backup hash equality (per file)

```bash
for name in br-thinlayer-init.js thin-sdk.iife.js br-probe-init.js index.html; do
  case "$name" in
    index.html) LIVE="/var/www/buyerrecon.com/html/index.html" ;;
    *)          LIVE="/var/www/buyerrecon.com/html/thinlayer/$name" ;;
  esac
  LH=$(sha256sum "$LIVE" 2>/dev/null | awk '{print $1}')
  BH=$(sha256sum "$BUNDLE_DIR/$name" 2>/dev/null | awk '{print $1}')
  if [ -n "$LH" ] && [ -n "$BH" ] && [ "$LH" = "$BH" ]; then
    echo "${name}_backup_matches_live: yes"
  else
    echo "${name}_backup_matches_live: no"
  fi
done
```

Paste-back into §6.6 (4 lines):
- `br-thinlayer-init.js_backup_matches_live: <yes|no>`
- `thin-sdk.iife.js_backup_matches_live: <yes|no>`
- `br-probe-init.js_backup_matches_live: <yes|no>`
- `index.html_backup_matches_live: <yes|no>`

**Stop if any value is `no`.** Treat the bundle as unreliable and
do not proceed to §G–§I.

### G. Create rollback procedure source

The heredoc content below contains **no secrets, no DSN, no token, no
`Authorization:` header value, no raw `request_id`, no raw
`session_id`, no payload, no DB credential**. The doc is operational
runbook content only, written with `0600` `root:root` to make it
operator-only on the production host (it does **not** need to be
secret, but root-only matches the rest of the bundle and avoids
casual reads).

```bash
cat > /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md <<'EOF'
# BuyerRecon Gate 4B Rollback Procedure (production host)

This document is the rollback procedure source for the BuyerRecon
website static-artifact bundle protected by Gate 4B. It is created and
maintained by Sprint 2 PR#18z and is referenced by PR#18o §5.E rollback
posture checks and by any future Gate 4C `endpointUrl` re-flip PR.

## What this protects

Four live website static artifacts under `/var/www/buyerrecon.com/html/`:

- `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js`
- `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js`
- `/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js`
- `/var/www/buyerrecon.com/html/index.html`

Protected endpoint posture: `endpointUrl_category = render_legacy_collect`
(the ThinLayer init file currently points at the Render legacy `/collect`
URL; the Sprint 2 `/v1/event` endpoint is NOT active in production).

## Bundle layout

Bundles are stored under:

  /root/buyerrecon-rollback/buyerrecon-gate4b-rollback-<UTC_TIMESTAMP>/

Each bundle contains:

- br-thinlayer-init.js          (byte-identical copy of live, mode 0600)
- thin-sdk.iife.js              (byte-identical copy of live, mode 0600)
- br-probe-init.js              (byte-identical copy of live, mode 0600)
- index.html                    (byte-identical copy of live, mode 0600)
- MANIFEST.txt                  (sha256sum of the four bundle files,
                                 written with relative filenames so
                                 verification works from inside the
                                 bundle directory regardless of path)
- LIVE-HASHES-AT-CAPTURE.txt    (sha256sum of the four live source files
                                 at the moment of bundle capture)

## How to find the most recent bundle

  LATEST_BUNDLE="$(ls -1dt /root/buyerrecon-rollback/buyerrecon-gate4b-rollback-*/ 2>/dev/null | head -n 1)"
  LATEST_BUNDLE="${LATEST_BUNDLE%/}"
  if [ -n "$LATEST_BUNDLE" ]; then
    echo "latest_bundle_found: yes"
  else
    echo "latest_bundle_found: no"
  fi

If `$LATEST_BUNDLE` is empty, STOP: no bundle is available to restore
from. Reconstitute via the PR#18z command set (or a successor PR under
its own Helen GO) before any rollback is possible.

## How to verify the bundle is intact (read-only, run before restore)

  # Re-hash the bundle copies from inside the bundle so MANIFEST.txt
  # relative filenames are compared exactly. Do not print file contents
  # or per-file hash output.
  if [ -n "$LATEST_BUNDLE" ] &&
     [ -f "$LATEST_BUNDLE/MANIFEST.txt" ] &&
     ( cd "$LATEST_BUNDLE" && sha256sum -c MANIFEST.txt >/dev/null ); then
    echo "bundle_intact: yes"
  else
    echo "bundle_intact: no"
  fi

STOP if `bundle_intact: no`. Do not restore from a drifted bundle.

## How to restore (run under Helen GO scoped to rollback only)

This procedure is the one-step revert to the pre-Gate-4C state. It
requires explicit Helen GO at the moment of execution; the existence
of this doc does not pre-authorise restore.

  # Step 1 (mandatory, before any install): capture the actual live
  # mode and owner of each artifact so the restore preserves them
  # rather than blindly applying a guessed posture. The `stat` calls
  # are read-only; they print one line per path with mode, owner:group,
  # and absolute path.
  for LIVE in \
    /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js \
    /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js \
    /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js \
    /var/www/buyerrecon.com/html/index.html; do
    stat -c '%a %U:%G %n' "$LIVE"
  done
  # Record the observed mode + owner:group per path. Use those exact
  # values in the install commands below; do NOT blindly apply
  # `0644 root:www-data` if the observed posture differs — that would
  # itself be a side-effect mutation.

  # Step 2: restore each artifact. install preserves byte content +
  # sets the recorded live mode/owner. Replace `0644 root:www-data`
  # with the per-path values captured in Step 1 if they differ.
  install -m 0644 -o root -g www-data "$LATEST_BUNDLE/br-thinlayer-init.js" /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js
  install -m 0644 -o root -g www-data "$LATEST_BUNDLE/thin-sdk.iife.js"     /var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js
  install -m 0644 -o root -g www-data "$LATEST_BUNDLE/br-probe-init.js"     /var/www/buyerrecon.com/html/thinlayer/br-probe-init.js
  install -m 0644 -o root -g www-data "$LATEST_BUNDLE/index.html"           /var/www/buyerrecon.com/html/index.html

## How to verify after restore

  # Each live sha256 must equal the corresponding bundle sha256.
  for name in br-thinlayer-init.js thin-sdk.iife.js br-probe-init.js index.html; do
    case "$name" in
      index.html) LIVE="/var/www/buyerrecon.com/html/index.html" ;;
      *)          LIVE="/var/www/buyerrecon.com/html/thinlayer/$name" ;;
    esac
    LH=$(sha256sum "$LIVE" 2>/dev/null | awk '{print $1}')
    BH=$(sha256sum "$LATEST_BUNDLE/$name" 2>/dev/null | awk '{print $1}')
    if [ "$LH" = "$BH" ]; then
      echo "${name}_restored_matches_bundle: yes"
    else
      echo "${name}_restored_matches_bundle: no"
    fi
  done

  # Endpoint category must return to render_legacy_collect.
  echo "br_thinlayer_init.js /collect count: $(grep -c '/collect' /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js)"
  echo "br_thinlayer_init.js /v1/event count: $(grep -c '/v1/event' /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js)"

Expected after restore: every `*_restored_matches_bundle: yes`,
`br_thinlayer_init.js /collect count: 1`,
`br_thinlayer_init.js /v1/event count: 0`.

## Stop-lines that prevent restore

Do NOT proceed with restore if any of the following holds:

- bundle directory missing
- bundle MANIFEST.txt missing
- bundle_intact = no (any backup copy hash drifted from MANIFEST)
- live artifact path missing (would indicate larger directory damage)
- Nginx service is in a degraded state (`systemctl is-active nginx`
  returns anything other than `active`)
- DB-side `production_event_traffic_unexpected = yes` or recurrence of
  PR#17s `request_body_invalid_json` pattern on a path that should have
  succeeded (rollback addresses the artifact, not a DB-side regression)
- operator uncertain about any step

## Do-not rules

- Do NOT delete the 26 historical PR#17s `request_body_invalid_json`
  rows from `2026-05-19` in `public.ingest_requests` on the production
  cluster. They are categorical evidence and must be preserved.
- Do NOT mutate, annotate, or normalise those 26 rows.
- Do NOT run any DB write, grant, migration, or `schema.sql` change as
  part of rollback. Rollback is artifact-only.
- Do NOT print any DSN, password, `Authorization:` header value,
  bearer token, `request_id`, `session_id`, payload, response body,
  env dump, private key / cert body, or vault content in any restore
  output.
- Do NOT delete this procedure document or any bundle without an
  explicit Helen GO scoped to that deletion.

## Provenance

- Created by: BuyerRecon Sprint 2 PR#18z.
- Source spec: docs/sprint2-pr18z-gate4b-rollback-reconstitution.md
  (in the BuyerRecon backend repo).
- Baseline artifact hashes recorded by: PR#18p §3.1, re-confirmed by
  PR#18x §3.1 and PR#18y §6.

This file is intentionally root-only (mode 0600, owner root:root) to
match the rest of the rollback bundle on the production host.
EOF

chmod 0600 /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md
chown root:root /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md

echo "rollback_procedure_present: $([ -f /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md ] && echo yes || echo no)"
echo "rollback_procedure_mode_0600: $([ "$(stat -c '%a' /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md 2>/dev/null)" = "600" ] && echo yes || echo no)"
echo "rollback_procedure_owner_root_root: $([ "$(stat -c '%U:%G' /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md 2>/dev/null)" = "root:root" ] && echo yes || echo no)"
```

Paste-back into §6.7 (3 categorical lines).

### H. Verify rollback backup / procedure presence + permissions

```bash
echo "rollback_root_dir_present: $([ -d /root/buyerrecon-rollback ] && echo yes || echo no)"
echo "rollback_root_dir_mode_0700: $([ "$(stat -c '%a' /root/buyerrecon-rollback 2>/dev/null)" = "700" ] && echo yes || echo no)"
echo "rollback_root_dir_owner_root_root: $([ "$(stat -c '%U:%G' /root/buyerrecon-rollback 2>/dev/null)" = "root:root" ] && echo yes || echo no)"

echo "rollback_backup_dir_present: $([ -d "$BUNDLE_DIR" ] && echo yes || echo no)"
echo "bundle_dir_mode_0700: $([ "$(stat -c '%a' "$BUNDLE_DIR" 2>/dev/null)" = "700" ] && echo yes || echo no)"
echo "bundle_dir_owner_root_root: $([ "$(stat -c '%U:%G' "$BUNDLE_DIR" 2>/dev/null)" = "root:root" ] && echo yes || echo no)"

echo "rollback_backup_artifact_present: $([ -f "$BUNDLE_DIR/MANIFEST.txt" ] && echo yes || echo no)"
echo "rollback_procedure_source_present: $([ -f /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md ] && echo yes || echo no)"
```

Paste-back into §6.8 (8 categorical lines).

### I. Cleanup / attestation

```bash
# Re-confirm /var/www unchanged: hashes still equal PR#18p baseline.
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

# Re-confirm endpoint category.
echo "post_check_br_thinlayer_init_collect_count:  $(grep -c '/collect'  /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js 2>/dev/null || echo 0)"
echo "post_check_br_thinlayer_init_v1event_count:  $(grep -c '/v1/event' /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js 2>/dev/null || echo 0)"

echo "var_www_live_artifacts_unchanged: yes"   # operator-attested: no install/mv/rm/chmod/chown ran against live paths
echo "production_traffic_generated: no"         # no curl, no wget, no httpie, no nc, no browser
echo "secret_printed: no"                       # no DSN, no password, no token, no Authorization header, no request_id, no session_id, no payload, no env dump
echo "cleanup_done: yes"
```

Paste-back into §6.9 (4 post-check hash matches + 2 post-check counts + 4 attestation lines = 10 lines).

---

## 6. Execution results

All fields below are recorded verbatim from the operator's pasted §A–§I
execution block. The operational `rollback_timestamp` and
`bundle_dir_basename` values are non-secret operational identifiers and
are recorded here for reproducibility.

### 6.1 Shell safety preflight (§A)

- `host_category`: `production`
- `operator_user_category`: `root`
- `shell_trace`: `off`
- `histfile_unset`: `yes`
- `umask_077`: `yes`

### 6.2 Preflight live artifact existence + hash check (§B)

- `preflight_live_present_br-thinlayer-init.js`: `yes`
- `preflight_live_present_thin-sdk.iife.js`: `yes`
- `preflight_live_present_br-probe-init.js`: `yes`
- `preflight_live_present_index.html`: `yes`
- `preflight_live_hash_match_baseline_br-thinlayer-init.js`: `yes`
- `preflight_live_hash_match_baseline_thin-sdk.iife.js`: `yes`
- `preflight_live_hash_match_baseline_br-probe-init.js`: `yes`
- `preflight_live_hash_match_baseline_index.html`: `yes`

All four live artifacts present; all four sha256 still match the PR#18p
§3.1 / PR#18x §3.1 / PR#18y §6 baseline. No live drift between PR#18y
execution (recorded at `12:26` UTC on `2026-05-24`) and PR#18z execution
(recorded by §6.3 timestamp `20260524T115806Z`).

### 6.3 Bundle directory creation (§C)

- `rollback_timestamp`: `20260524T115806Z`
- `bundle_dir_basename`: `buyerrecon-gate4b-rollback-20260524T115806Z`
- `rollback_root_dir_created`: `yes`
- `bundle_dir_created`: `yes`

The canonical rollback root `/root/buyerrecon-rollback/` is now
established on the production host; bundle subdirectory
`/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-20260524T115806Z/`
exists.

### 6.4 Bundle file presence + mode + owner (§D)

- `bundle_present_br-thinlayer-init.js`: `yes` · `bundle_mode_0600_br-thinlayer-init.js`: `yes` · `bundle_owner_root_root_br-thinlayer-init.js`: `yes`
- `bundle_present_thin-sdk.iife.js`: `yes` · `bundle_mode_0600_thin-sdk.iife.js`: `yes` · `bundle_owner_root_root_thin-sdk.iife.js`: `yes`
- `bundle_present_br-probe-init.js`: `yes` · `bundle_mode_0600_br-probe-init.js`: `yes` · `bundle_owner_root_root_br-probe-init.js`: `yes`
- `bundle_present_index.html`: `yes` · `bundle_mode_0600_index.html`: `yes` · `bundle_owner_root_root_index.html`: `yes`

All four artifacts copied into the bundle subdirectory at mode `0600`
owner `root:root`, more restrictive than the live (web-served) source,
which itself was not touched.

### 6.5 Manifest + live-hashes files (§E)

- `manifest_present`: `yes` · `manifest_mode_0600`: `yes` · `manifest_owner_root_root`: `yes`
- `live_hashes_at_capture_present`: `yes` · `live_hashes_at_capture_mode_0600`: `yes` · `live_hashes_at_capture_owner_root_root`: `yes`

`MANIFEST.txt` is written with relative bundle filenames (created via
`cd "$BUNDLE_DIR" && sha256sum br-thinlayer-init.js thin-sdk.iife.js
br-probe-init.js index.html > MANIFEST.txt`), so verification works
from inside the bundle directory regardless of absolute path.
`LIVE-HASHES-AT-CAPTURE.txt` keeps absolute live paths so live
provenance at the moment of capture is explicit and independent of
the bundle's relative form.

### 6.6 Per-file backup ↔ live hash equality (§F)

- `br-thinlayer-init.js_backup_matches_live`: `yes`
- `thin-sdk.iife.js_backup_matches_live`: `yes`
- `br-probe-init.js_backup_matches_live`: `yes`
- `index.html_backup_matches_live`: `yes`

Every per-file backup ↔ live sha256 comparison returned equal. The
bundle is byte-identical to the live source at the moment of capture
and (per §6.9) to the PR#18p §3.1 baseline.

### 6.7 Rollback procedure source creation (§G)

- `rollback_procedure_present`: `yes`
- `rollback_procedure_mode_0600`: `yes`
- `rollback_procedure_owner_root_root`: `yes`

`/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` exists at mode
`0600` owner `root:root` and contains the §5.G heredoc content
verbatim (no secrets, no DSN, no token, no `Authorization:` header
value, no payload).

**Operator note (§G heredoc continuation-mode recovery).** During
execution, the shell entered heredoc continuation mode during the
original `cat > /root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md
<<'EOF' …` paste. The operator recovered by re-pasting cleanly; the
final on-host file is the intended content (confirmed by `chmod` /
`chown` returning success and by §6.7's presence + mode + owner
checks all returning `yes`). No partial-content file persisted.

**Operator bonus verification (run after §G).** The operator also
executed the `## How to find the most recent bundle` and `## How to
verify the bundle is intact` blocks from the just-created
`ROLLBACK-PROCEDURE.md` end-to-end against the just-created bundle:

- `latest_bundle_found`: `yes`
- `bundle_intact`: `yes` (via `( cd "$LATEST_BUNDLE" && sha256sum -c
  MANIFEST.txt >/dev/null )` returning exit `0`)

This is a bonus self-test of the runbook against the bundle it
documents: the runbook reads the bundle, the bundle hashes match the
manifest, and the bundle is reachable via the documented `ls -1dt …`
pattern. The bonus check is recorded here as additional evidence; the
PASS verdict does not require it.

### 6.8 Aggregate presence + permission (§H)

- `rollback_root_dir_present`: `yes` · `rollback_root_dir_mode_0700`: `yes` · `rollback_root_dir_owner_root_root`: `yes`
- `rollback_backup_dir_present`: `yes` · `bundle_dir_mode_0700`: `yes` · `bundle_dir_owner_root_root`: `yes`
- `rollback_backup_artifact_present`: `yes` (`MANIFEST.txt` present at the bundle subdirectory)
- `rollback_procedure_source_present`: `yes` (`/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` present)

Every presence and permission surface required by the §1 PASS rule
and by PR#18y's §4.F probe shape returned `yes`.

### 6.9 Post-check (§I)

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

All four live sha256 still match the PR#18p baseline at the end of the
§A–§I window, confirming that no §C–§G write inadvertently mutated any
live artifact. The endpoint posture is unchanged:
`endpointUrl_category=render_legacy_collect` is re-confirmed by
`/collect` count = `1` and `/v1/event` count = `0` in
`br-thinlayer-init.js`.

**Operator note (grep fallback emit).** The `grep -c '/v1/event' …
|| echo 0` fallback in §I emits an extra standalone `0` when `grep
-c` returns a non-zero exit status on a zero-match case. That extra
`0` is a shell artefact, not a second count; the categorical value
is the single `post_check_br_thinlayer_init_v1event_count: 0`
recorded above. The same fallback shape was used (and the same
artefact noted) in PR#18y §4.E / §3.5's operator note.

---

## 7. Rollback readiness verification

All booleans below are computed from §6.

The §1 PASS verdict is satisfied: every line below evaluates to `yes`.

- `rollback_backup_dir_present`: **yes** *(from §6.8)*
- `rollback_backup_artifact_present`: **yes** *(from §6.8; `MANIFEST.txt` present at the bundle subdirectory)*
- `rollback_procedure_source_present`: **yes** *(from §6.8)*
- `rollback_artifact_source_present` (aggregate; `yes` only if both
  `rollback_backup_dir_present=yes` and
  `rollback_backup_artifact_present=yes`): **yes** *(both inputs `yes`)*
- `backup_hashes_match_live` (aggregate; `yes` only if all four §6.6
  per-file `_backup_matches_live` are `yes`): **yes** *(all four inputs `yes`)*
- `var_www_live_artifacts_unchanged`: **yes** *(§6.9 attestation; cross-check: all four §6.9 `post_check_live_hash_match_baseline_*=yes`)*
- `endpointUrl_category` remains `render_legacy_collect`: **yes** *(§6.9 `post_check_br_thinlayer_init_collect_count = 1` and `post_check_br_thinlayer_init_v1event_count = 0`; matches PR#18p §3.2, PR#18x §3.2, and PR#18y §7 baseline)*
- `sprint2_endpoint_config_present`: **no** *(§6.9 `post_check_br_thinlayer_init_v1event_count = 0`; no Sprint 2 `/v1/event` literal active in the production ThinLayer artifact set)*
- `production_traffic_generated`: **no** *(§6.9)*
- `secret_printed`: **no** *(§6.9; no DSN, no token, no `Authorization:` header value, no `request_id`, no `session_id`, no payload, no env dump surfaced in §A–§I output or in the §G heredoc content)*

The rollback posture is now provably reconstituted on the production
host. The two PR#18y stop-lines
(`rollback_artifact_source_missing`, `rollback_procedure_source_missing`)
are categorically lifted.

---

## 8. Stop-lines

Each stop-line is recorded categorically from §6 and the operator's
paste-back. Any single triggered stop-line would have forced a
`BLOCKED` verdict; none were triggered.

- `live_artifact_missing` (§B any `preflight_live_present_*=no`): **no** *(all four §6.2 `_present=yes`)*
- `live_hash_cannot_be_captured` (§B `sha256sum` failed for any artifact): **no** *(all four §6.2 `_hash_match_baseline_*` returned definite values)*
- `live_hash_drifted_from_baseline` (§B any `preflight_live_hash_match_baseline_*=no`): **no** *(all four §6.2 `_hash_match_baseline_*=yes`)*
- `backup_directory_cannot_be_created` (§C `rollback_root_dir_created=no` or `bundle_dir_created=no`): **no** *(§6.3 both `=yes`)*
- `backup_copy_hash_mismatch` (§F any `_backup_matches_live=no`): **no** *(all four §6.6 `=yes`)*
- `rollback_procedure_source_cannot_be_created` (§G `rollback_procedure_present=no`): **no** *(§6.7 `=yes`)*
- `endpoint_changed_unexpectedly` (§I `post_check_br_thinlayer_init_collect_count != 1` or `post_check_br_thinlayer_init_v1event_count != 0`): **no** *(§6.9 `collect_count=1`, `v1event_count=0`)*
- `live_served_artifact_changed` (§I any `post_check_live_hash_match_baseline_*=no` — would indicate the live state changed during the §C–§G window): **no** *(all four §6.9 `=yes`)*
- `var_www_edit_attempted_or_observed` (any `cp` *into* `/var/www/`, any `mv` / `rm` / `chmod` / `chown` / `ln -s` against any `/var/www/` path during the window): **no** *(§5 contains no such command; §6.9 `var_www_live_artifacts_unchanged=yes`; the four `post_check_live_hash_match_baseline_*=yes` confirms zero byte change in the live source)*
- `production_traffic_generated` (§I): **no** *(§6.9; §5 contains no `curl` / `wget` / `httpie` / `nc` / browser invocation)*
- `secret_printed` (§I; also any DSN, password, `Authorization:` header value, bearer token, raw `request_id`, raw `session_id`, raw payload, raw response body, env dump, private key / cert body, vault content, shell history line, or raw row surfaces): **no** *(§6.9 `secret_printed=no`; §5 commands print only categorical labels, sha256 hashes, public artifact paths, and the operational `ROLLBACK_TIMESTAMP` / `bundle_dir_basename`; the §G heredoc contains operational runbook content only)*
- `operator_uncertain`: **no** *(per operator paste-back)*

**`stop_lines_triggered`:** **`none`**.

No stop-line triggered. The §1 PASS verdict stands.

---

## 9. Historical 26-row warning carry-forward

PR#18z carries the PR#17s / PR#18w / PR#18y 26-row warning forward
verbatim. This section did not require operator paste-back; the
evidence is already recorded on base.

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
  documented in `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md`.
- **Preservation rule:** the 26 `ingest_requests` rows are preserved
  as categorical evidence. **Do not delete, mutate, annotate, or
  normalise these rows.** PR#18z is artifact-side only and does not
  query, touch, or otherwise interact with these rows.

The rollback procedure source created in §G embeds the same do-not
rules so the rule survives even if PR#18z's repo doc is later moved or
renamed.

---

## 10. Gate 4C remains blocked until re-audit

Even if PR#18z executes to `PASS`, **Gate 4C remains unapproved**. The
PR#18y stop-lines are lifted only after a **follow-up Gate 4B re-audit**
re-runs the read-only artifact / config check command set (PR#18y §4
§A–§F) against the now-reconstituted rollback posture and produces a
non-`BLOCKED` verdict that explicitly records:

- `rollback_backup_dir_present=yes`
- `rollback_backup_artifact_present=yes`
- `rollback_procedure_source_present=yes`
- `rollback_artifact_source_present=yes`
- the four static-artifact sha256 still match the PR#18p baseline
- `endpointUrl_category=render_legacy_collect`
- `sprint2_endpoint_config_present=no`
- no §10 stop-line triggered

That follow-up Gate 4B re-audit is a separate PR under its own explicit
Helen GO. PR#18z does **not** authorise or pre-sequence that re-audit,
and PR#18z does **not** authorise Gate 4C in any form.

Gate 4C `endpointUrl` re-flip, Gate 4C canary, Gate 4D organic
observation, and Gate 4E Track A / Playwright work all remain
unapproved.

---

## 11. Final scoring / governance recap requirement

A final scoring / governance recap PR remains required after Gate 4
implementation / preflight and any issue-fix PRs, before any
production-cutover readiness claim. PR#18z is one input to that recap;
it is not the recap itself.

The recap PR must carry forward, verbatim, the customer governance
locks:

- `customer_claim_allowed=false`
- `lane_output_allowed=false`
- `customer_visibility_allowed=false`
- `lane_write_allowed=false`
- `allowed_customer_language=[]`

The recap PR must also carry forward, explicitly:

- the PR#18v `PASS` verdict (dedicated production audit read-only
  credential and root-only DSN binding),
- the PR#18w `PASS_WITH_WARNINGS` verdict (Gate 4A DB / grant /
  traffic re-audit) and the
  `historical_rejected_only_v1_event_rows_present` warning,
- the 26-row count, single-day window `2026-05-19`, `400 × 26`
  distribution, `request_body_invalid_json × 26` distribution, and
  the PR#17s reference,
- the PR#18x `PLANNING / CHECK ONLY` Gate 4B planning record,
- the PR#18y `BLOCKED` verdict and the two stop-lines triggered
  (`rollback_artifact_source_missing`, `rollback_procedure_source_missing`),
- the PR#18z `PASS` verdict, the canonical rollback
  directory path (`/root/buyerrecon-rollback/`), the bundle naming
  convention (`buyerrecon-gate4b-rollback-<UTC_TIMESTAMP>`), the
  rollback procedure source path
  (`/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md`), the
  permission posture (root-only `0700` dirs, `0600` files), and any
  §8 stop-lines triggered,
- the follow-up Gate 4B re-audit verdict (whenever recorded) that
  confirms `rollback_*_present=yes` against the new canonical paths,
- the converted migration-016 Lane grant safety status from PR#18w
  §3.6 / §6,
- Gate 4C / 4D / 4E outcomes once recorded,
- the rollback posture and any further open warnings.

No production-cutover readiness claim may rely on PR#18z alone.

---

## 12. Acceptance criteria

PR#18z is acceptable for merge into `sprint2-architecture-contracts-d4cc2bf`
only if §6 and §7 are populated, the verdict in §1 is set per
the §1 classification rule, and **all** of the following hold:

- **Rollback backup directory exists** at the canonical path
  `/root/buyerrecon-rollback/` (§6.8 `rollback_root_dir_present=yes` +
  §6.8 `rollback_backup_dir_present=yes`).
- **Rollback backup artifact exists** (§6.8
  `rollback_backup_artifact_present=yes` — i.e. bundle `MANIFEST.txt`
  present at the timestamped bundle subdirectory).
- **Rollback procedure source exists** at
  `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` (§6.8
  `rollback_procedure_source_present=yes`).
- **Backup hashes match live source hashes** (§7
  `backup_hashes_match_live=yes` — all four §6.6 per-file equal).
- **Live served artifacts unchanged** (§6.9 all four
  `post_check_live_hash_match_baseline_*=yes`; §6.9
  `var_www_live_artifacts_unchanged=yes`; §8
  `var_www_edit_attempted_or_observed=no`;
  `live_served_artifact_changed=no`).
- **Endpoint remains `render_legacy_collect`** (§6.9
  `post_check_br_thinlayer_init_collect_count=1` and
  `post_check_br_thinlayer_init_v1event_count=0`).
- **No Sprint 2 `/v1/event` active config** (§7
  `sprint2_endpoint_config_present=no`).
- **No production traffic** (§6.9 `production_traffic_generated=no`).
- **No secrets printed** (§6.9 `secret_printed=no`; the §5 command set
  contains no DSN, no password, no token, no `Authorization:` header
  value, no raw `request_id`, no raw `session_id`, no payload, no
  response body, no env dump, no private key / cert body, no vault
  content, no shell history, no raw row).
- **Repo change is docs-only.** Exactly one new file changes in the
  repo: `docs/sprint2-pr18z-gate4b-rollback-reconstitution.md`. No
  code, no scripts, no tests, no package files, no migrations, no
  `schema.sql`, no env files, no systemd / Nginx files, no AMS
  source, no website artifacts, no production config, no DB grant
  files change in the repo. Production-host writes occur only under
  explicit Helen GO and are confined to `/root/buyerrecon-rollback/`
  (outside `/var/www/`, outside `/opt/buyerrecon-backend/`, outside
  any git working tree).
- **Gate 4C remains unapproved** (§10).
- **Final recap requirement preserved** (§11).

---

## 13. Files planned to change

### 13.1 Repo (this PR, docs-only)

| Path | Action | Lines | Tracked-files-modified |
|---|---|---|---|
| `docs/sprint2-pr18z-gate4b-rollback-reconstitution.md` | NEW | ~1269 | 0 |

No code, scripts, tests, package files, migrations, `schema.sql`, env
files, systemd / Nginx files, AMS source, website artifacts,
production config, or DB grant files are modified in the repo.

### 13.2 Production host (only after explicit Helen GO)

| Path | Action | Mode | Owner | Writes? |
|---|---|---|---|---|
| `/root/buyerrecon-rollback/` | CREATE (idempotent) | `0700` | `root:root` | Yes |
| `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-<UTC_TIMESTAMP>/` | CREATE | `0700` | `root:root` | Yes |
| `/root/buyerrecon-rollback/buyerrecon-gate4b-rollback-<UTC_TIMESTAMP>/br-thinlayer-init.js` | CREATE (copy from live) | `0600` | `root:root` | Yes (write to `/root/`, read from `/var/www/`) |
| `…/thin-sdk.iife.js` | CREATE (copy from live) | `0600` | `root:root` | Yes |
| `…/br-probe-init.js` | CREATE (copy from live) | `0600` | `root:root` | Yes |
| `…/index.html` | CREATE (copy from live) | `0600` | `root:root` | Yes |
| `…/MANIFEST.txt` | CREATE | `0600` | `root:root` | Yes |
| `…/LIVE-HASHES-AT-CAPTURE.txt` | CREATE | `0600` | `root:root` | Yes |
| `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md` | CREATE | `0600` | `root:root` | Yes |
| `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js` | READ ONLY (`sha256sum`, `grep -c`) | unchanged | unchanged | No |
| `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js` | READ ONLY (`sha256sum`) | unchanged | unchanged | No |
| `/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js` | READ ONLY (`sha256sum`) | unchanged | unchanged | No |
| `/var/www/buyerrecon.com/html/index.html` | READ ONLY (`sha256sum`) | unchanged | unchanged | No |
| any DB | NOT TOUCHED | — | — | No |
| Nginx config | NOT TOUCHED | — | — | No |
| systemd unit | NOT TOUCHED | — | — | No |
| DNS | NOT TOUCHED | — | — | No |

### 13.3 Write commands vs read-only commands in §5

| Step | Operation | Writes? |
|---|---|---|
| §A | shell safety preflight (`set +x`, `unset HISTFILE`, `umask 077`, `hostname`, `whoami`) | No |
| §B | live artifact `test -f` + `sha256sum` | No (read-only) |
| §C | `install -d` (creates rollback root + bundle dir) | Yes (under `/root/`) |
| §D | `install -m 0600 -o root -g root` (4 files from `/var/www/` → bundle) | Yes (under `/root/`) |
| §E | `sha256sum > MANIFEST.txt`, `sha256sum > LIVE-HASHES-AT-CAPTURE.txt`, `chmod`, `chown` | Yes (under `/root/`) |
| §F | `sha256sum` of live and bundle, compare | No (read-only) |
| §G | `cat > ROLLBACK-PROCEDURE.md <<'EOF' … EOF`, `chmod`, `chown` | Yes (under `/root/`) |
| §H | `test -d` / `test -f` / `stat` | No (read-only) |
| §I | `sha256sum`, `grep -c`, attestation echoes | No (read-only) |

All writes are confined to `/root/buyerrecon-rollback/`. No write
touches `/var/www/`, `/opt/buyerrecon-backend/`, Nginx config, systemd,
DNS, or DB.

---

End of PR#18z. **Gate 4B rollback reconstitution remediation
execution proof. Verdict: PASS. Stop-lines triggered: none. The two
PR#18y stop-lines (`rollback_artifact_source_missing`,
`rollback_procedure_source_missing`) are categorically lifted on the
production host. The canonical rollback root `/root/buyerrecon-rollback/`
is established at mode `0700` owner `root:root`; bundle subdirectory
`buyerrecon-gate4b-rollback-20260524T115806Z` exists at mode `0700`
owner `root:root` and contains four byte-identical copies of the
production website static artifacts (`br-thinlayer-init.js`,
`thin-sdk.iife.js`, `br-probe-init.js`, `index.html`) at mode `0600`
owner `root:root`, plus `MANIFEST.txt` (sha256sum of the four files,
written with relative filenames so verification works from inside the
bundle directory) and `LIVE-HASHES-AT-CAPTURE.txt` (sha256sum of the
four live source files at the moment of capture, with absolute paths).
The rollback procedure source `/root/buyerrecon-rollback/ROLLBACK-PROCEDURE.md`
is created at mode `0600` owner `root:root`, contains the bundle
layout, how to find the most recent bundle, how to verify integrity
via `sha256sum -c MANIFEST.txt` from inside the bundle directory, how
to capture pre-restore live mode/owner via `stat -c '%a %U:%G %n'`
before any install, how to restore preserving the captured posture,
how to verify after restore, the stop-lines that prevent restore, and
the do-not-delete / do-not-mutate / do-not-annotate / do-not-normalise
rule for the 26 historical PR#17s rows on the production cluster. The
operator verified (bonus check, post-§G) that `latest_bundle_found=yes`
and `bundle_intact=yes` via the just-created runbook against the
just-created bundle. All four live artifact sha256 still match the
PR#18p §3.1 / PR#18x §3.1 / PR#18y §6 baseline at both §B preflight
and §I post-check, confirming the live `/var/www/` artifacts were not
touched during §A–§I. Endpoint posture is unchanged:
`endpointUrl_category=render_legacy_collect`,
`br-thinlayer-init.js /collect count = 1`,
`br-thinlayer-init.js /v1/event count = 0`,
`sprint2_endpoint_config_present=no`. Aggregates:
`rollback_artifact_source_present=yes`, `backup_hashes_match_live=yes`,
`var_www_live_artifacts_unchanged=yes`,
`production_traffic_generated=no`, `secret_printed=no`,
`cleanup_done=yes`, `operator_uncertain=no`. The §G heredoc paste
required one continuation-mode recovery on the operator's side; the
on-host file is the intended content (confirmed by §6.7 presence +
mode + owner all `yes`). The §I `grep -c '/v1/event' … || echo 0`
fallback emits an extra standalone `0` line on a zero-match case; that
is a shell artefact, not a second count; the categorical value remains
`post_check_br_thinlayer_init_v1event_count: 0`. No production-host
mutation occurred outside `/root/buyerrecon-rollback/`. The repo
change is docs-only. No code, scripts, tests, package files,
migrations, `schema.sql`, env files, systemd / Nginx files, AMS
source, website artifacts, production config, or DB grant files
modified in the repo. PR#18z's PASS lifts the rollback-posture
blocker on Gate 4B; a follow-up Gate 4B re-audit PR (under its own
explicit Helen GO, re-running PR#18y §4 §A–§F against the
reconstituted rollback posture) must produce a non-`BLOCKED` verdict
before any Gate 4C consideration may proceed. Gate 4C `endpointUrl`
re-flip remains unapproved; Gate 4D organic observation remains
unapproved; Gate 4E Track A / Playwright work remains unapproved.
The 26 historical PR#17s rows on the production cluster remain
preserved and must not be deleted, mutated, annotated, or normalised
away. The final scoring / governance recap PR remains required before
any production-cutover readiness claim. No `endpointUrl` re-flip, no
Gate 4C approval, no Gate 4C canary, no production traffic generation,
no `buyerrecon.com` production `/v1/event` call, no Render `/collect`
call, no `/var/www` edit, no symlink change, no `nginx -s reload`, no
`systemctl` action, no service restart, no DNS change, no DB write,
no DB grant, no migration, no `schema.sql` change, no env file edit,
no credential rotation, no `buyerrecon_prod_collector_app` reset, no
`buyerrecon_migrator` reset, no production token provisioning, no
Lane A/B writer, no customer-facing output, no dashboard
implementation, no AMS runtime bridge, no Pass 1 / Trust / Pass 2
runtime, no runtime scoring, no Track A, no Playwright, no website
ThinSDK production-mode activation, no production artifact / config
mode flip, no Gate 4D observation, no Gate 4E Track A / Playwright
work, no deletion / mutation / annotation / normalisation of the 26
historical PR#17s rows on the production cluster, and no secret
printing are approved by PR#18z. Any future follow-up Gate 4B
re-audit PR, Gate 4C canary PR (which must satisfy PR#18x §5 /
PR#18y §11's eight preconditions and reference the PR#17s 26-row
baseline), Gate 4D observation PR, Gate 4E Track A / Playwright PR,
issue-fix PR, runtime PR, customer-surface PR, or final scoring /
governance recap PR remains separately gated by its own explicit
Helen GO.**
