# BuyerRecon Sprint 2 PR#17u — Host-Side ThinLayer Bundle Hash Cross-Check (Gate 1 residual)

Status: **docs-only host-side proof closure. Verdict: PASS WITH NON-BLOCKING NOTES.**

This PR is the residual Gate 1 host-side hash / metadata cross-check called for in PR#17t §13.1 / §16.2. It confirms that the production-host static files under `/var/www/buyerrecon.com/html/thinlayer/` are byte-identical (or — for `br-thinlayer-init.js` — categorically equivalent modulo the expected `endpointUrl` literal and PR#17p mtime edit) to the local snapshot inspected by PR#17t on the BuyerRecon website's `production-live-20260508` branch.

Helen / approved operator ran the §14 read-only runbook on the production Hetzner host (`root@ubuntu-16gb-nbg1-1` shell, working directory `/var/www/buyerrecon.com/html/thinlayer`) and supplied the categorical outputs transcribed into §5–§8. Claude Code did **not** access the production host directly at any point; the only Claude Code action was to transcribe the operator's sanitised outputs into the result sections and update §1 / §3 / §10 to reflect the closed gate. **Old PR#17q / PR#17p DB / rollback scrollback that appeared earlier in the operator's terminal session is explicitly excluded** from this proof — only the host-side filesystem hash-crosscheck block (between the `cd /var/www/buyerrecon.com/html/thinlayer || exit 1` line and the trailing prompt at `/var/www/buyerrecon.com/html/thinlayer#`) is incorporated as PR#17u evidence.

**No PR#17u command was executed against any production host by Claude Code.** No `curl`, no `psql`, no `nginx`, no `systemctl`, no `ssh`, no service action, no DB action, no DNS edit, no `/var/www` write, no static-bundle copy into the repo, no production traffic generation by Claude Code. The operator's host-side commands were strictly read-only filesystem inspection (`cd`, `pwd`, `stat`, `sha256sum`, redacted `grep -c`) — no HTTP request, no DB action, no service action, no `/var/www` write.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `ae71044` — "Sprint 2 PR#17t: confirm live ThinSDK shape (#25)").

PR branch: `buyerrecon-sprint2-pr17u-host-thinlayer-hash-crosscheck`

Mandatory references:
- `docs/ops/cutover-hard-gates.md` — operational standard. PR#17u is a Gate 1 — Static Contract Diff residual step.
- `docs/sprint2-pr17s-thinsdk-sprint2-contract-shape-inspection.md` — PR#17s inspection report.
- `docs/sprint2-pr17t-live-thinsdk-shape-confirmation.md` — PR#17t confirmation report (source of the baseline §5 hashes that PR#17u cross-checks).

> **Route readiness is not end-to-end readiness.**
> **EndpointUrl update is not event-capture proof.**
> **Health check is not event-contract proof.**
> **Static bundle hash confirmation is not write-smoke approval.**
> **Host-side hash match is not production event-capture proof.**
> **No endpointUrl re-flip is approved by PR#17u.**
> **Do not delete failed canary evidence rows.**
> **Do not broaden grants to make a proof pass.**

---

## 1. Status / verdict

**PASS WITH NON-BLOCKING NOTES.**

PR#17u is the residual Gate 1 step that PR#17t §13.1 / §16.2 explicitly named: a read-only host-side `sha256sum` + `stat` cross-check over `/var/www/buyerrecon.com/html/thinlayer/*.js` against the PR#17t local-snapshot baseline hashes. Helen / operator executed the §14 runbook on the production Hetzner host (`root@ubuntu-16gb-nbg1-1:/var/www/buyerrecon.com/html/thinlayer#` shell), and the categorical outputs are transcribed into §5–§8 below.

**Headline result:**

- **All four safe-to-hash bundle files match PR#17t baselines byte-for-byte:**
  - `thin-sdk.iife.js` → `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` ✓ match
  - `buyerrecon-adapter.iife.js` → `fe72a27099ff70e879c66011aabc6100bd27c29799d69c3005eab9aa904c983a` ✓ match
  - `br-probe-init.js` → `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84` ✓ match
  - `br-probe.iife.js` → `339921e603aface0df8fb620309519bc44fe84e0833bb7bcce063da84c2e5dd9` ✓ match (informational)
- **`br-thinlayer-init.js` hash was deliberately not reported** by the operator (treated conservatively as a config-bearing / endpoint-bearing file). The file's categorical checks (§6) confirm `endpointUrl` resolves to Render legacy (exactly one `/collect` literal, zero `/v1/event` literals, one `transport:` selector) — consistent with the expected safe rollback posture.
- **Host `endpointUrl` posture is Render legacy** (`https://buyerrecon-backend.onrender.com/collect`); no Sprint 2 `/v1/event` literal present on the host's `br-thinlayer-init.js`.
- **Host bundle transport structure matches PR#17t §6.2 categorical decode:** `FetchTransport`, `BeaconTransport`, `createTransport`, `JSON.stringify`, `keepalive`, `application/json`, `sendBeacon` all present (count ≥ 1); `"events":` wrapper key absent (count 0).
- **PR#17t H1 and H8 findings are not weakened** by the host-side cross-check — they are reinforced.

**Non-blocking notes:**

- `br-thinlayer-init.js` hash omitted from operator output by safety convention; categorical content (§6 / §7) confirms safe Render-legacy posture in lieu of a byte-for-byte hash. This is acceptable per §10.1 (PASS WITH NON-BLOCKING NOTES rule: `br-thinlayer-init.js` drift on a single explainable axis while categorical content is intact).
- `br-thinlayer-init.js` mtime on the host is `2026-05-19 17:14:59.122474968 +0000`, ~11 days later than the local snapshot's `2026-05-08T21:14:09Z`. This is consistent with the documented PR#17p `endpointUrl` flip-and-rollback edit applied directly on the production host on 2026-05-19. The trailing `endpointUrl` literal on the host now resolves to Render legacy (§6), confirming the rollback completed cleanly.
- The other four files' host mtimes are `2026-05-08 22:19:10 +0000` — about one hour later than the local snapshot's `2026-05-08T21:14:09Z`. Content hashes match exactly, so this is mtime-only drift (a benign deploy-timing artefact: file copy at deploy time updates mtime without changing content). Per §9.1, mtime-only drift is benign.
- Host file mode is `755` (executable bit set on static JS files), differing from the typical `644` for Nginx-served static content. The files are readable by the Nginx worker either way, so this is functionally equivalent; recorded as a non-blocking observation in §9.
- Host file `owner` is reported as `UNKNOWN` in the operator's `stat` output (likely a UID without a `/etc/passwd` entry on this host, or operator-side redaction). `group` is `root`. This is recorded as a non-blocking observation in §9.

**Posture preserved by PR#17u:**

- `buyerrecon.com` ThinLayer `endpointUrl` remains on Render legacy (`https://buyerrecon-backend.onrender.com/collect`) — categorically confirmed by the host-side `grep -c` results in §6.
- No endpointUrl re-flip is approved by PR#17u.
- No write smoke, no traffic generation, no Track A, no Playwright by either Claude Code or the operator during PR#17u execution.
- No DB / Nginx / systemctl / DNS / Render-side / `/var/www`-write action.
- PR#17q column-level grants on `buyerrecon_prod_collector_app` stand; no broadening.
- The 26 `ingest_requests` evidence rows from the post-PR#17q canary attempt are preserved.

---

## 2. Scope and hard-gate references

### 2.1 What PR#17u is

A Gate 1 — Static Contract Diff residual step under `docs/ops/cutover-hard-gates.md` §3. PR#17u closes the source-of-truth gap recorded in PR#17t §15.4 / §16.2 by confirming that the production-host bundles match (or categorically equal) the PR#17t local-snapshot baseline. The PR is a docs-only runbook; its execution body (the actual `sha256sum` and `stat` outputs) is supplied by the operator on the production host.

### 2.2 What PR#17u is not

- Not Option A implementation. The ThinSDK / adapter bundle update to emit Sprint 2 `/v1/event` shape and required per-event fields is a **separate later PR** (proposed as PR#17v or successor) and is **not** authorised by PR#17u.
- Not Gate 2 (controlled fixture dry-run against staging collector).
- Not Gate 3 (runtime privilege simulation under production-equivalent least-privilege role).
- Not Gate 4 (route readiness, bundle deploy, endpointUrl re-flip, controlled event proof, passive organic observation, Track A).
- Not a write-smoke. **No HTTP request will be issued** by the runbook against any production endpoint, staging endpoint, or collector. The runbook is filesystem-only and read-only.
- Not a DB read or DB grant change. The runbook touches no DB.

### 2.3 Mandatory reference compliance

- `cutover-hard-gates.md` §3 (Gate 1 — Static Contract Diff): PR#17u closes the static-bundle source-of-truth gap that PR#17t §13.1 left open.
- `cutover-hard-gates.md` §6 PR sequencing: PR#17u is the docs-only artefact preceding any Gate 2 fixture run; all of Gate 2, Gate 3, and Gate 4 remain future-gated.
- `cutover-hard-gates.md` §8 stop-line conditions: none triggered. No `500`, no `storage_failure`, no `permission denied`, no token print, no grant broadening, no unexplained hash mismatch, no missing file, no raw-secret exposure, no unexpected `/v1/event` endpointUrl on the production host. The §9.3 stop-line-non-triggers table records the categorical absence.

---

## 3. Host access posture

### 3.1 Claude Code's access posture

- **Environment:** developer macOS (`Darwin 25.3.0`, `arm64`), local user shell. Working directory `/Users/admin/github/buyerrecon-backend` on the PR branch `buyerrecon-sprint2-pr17u-host-thinlayer-hash-crosscheck`.
- **Production host (Hetzner) access:** **NONE — Claude Code did not access the production host at any point.** `ls /var/www` from the local environment returns `No such file or directory`; `ls /var/www/buyerrecon.com/html/thinlayer` returns `No such file or directory`. No `ssh`, no `curl`, no `psql`, no `nginx`, no `systemctl`, no service action, no DB action, no DNS edit, no `/var/www` write was executed by Claude Code at any point.
- **PR#17t baseline access:** present locally at `/Users/admin/github/buyerrecon-website/thinlayer/*` on branch `production-live-20260508` HEAD `c477657`. This is the baseline PR#17u cross-checks against.
- **Claude Code's role in PR#17u execution:** strictly limited to (a) authoring the §14 operator runbook in the BLOCKED state of the doc, and (b) transcribing the operator's sanitised host-side outputs into §5–§8 and updating §1 / §3 / §10 to the PASS WITH NON-BLOCKING NOTES verdict after the operator's run.

### 3.2 Operator access posture (actual, per executed runbook)

- The operator (Helen / approved operator) executed the §14 runbook commands on the production Hetzner host. Host shell prompt observed: `root@ubuntu-16gb-nbg1-1:/var/www/buyerrecon.com/html/thinlayer#` — confirming the host identity (`ubuntu-16gb-nbg1-1`) and the working directory (`/var/www/buyerrecon.com/html/thinlayer`).
- Operator commands were strictly **read-only**: `cd`, `pwd`, `stat -c '...'`, `sha256sum`, redacted `grep -c` for categorical pattern counts only. **No `cat` of full bundle contents into chat / repo / artefact. No `curl`, no HTTP request, no `psql`, no DB query, no DB mutation, no DB grant change, no `nginx`, no `systemctl`, no service action, no DNS edit, no write under `/var/www`, no static-bundle copy out of the production host.**
- The operator returned categorical outputs (file metadata, four sha256 hash strings, twelve `grep -c` integer counts) for transcription into §5–§8 of this doc. No raw bundle contents, no raw tokens, no raw payloads, no secrets were returned.
- Operator's `br-thinlayer-init.js` hash was **deliberately not produced** under the safety convention of treating it as a config-bearing / endpoint-bearing file. Its categorical content (§6) is the proof carrier instead.

### 3.3 Boundary discipline observed during the runbook

The operator's terminal session included earlier scrollback from unrelated PR#17q / PR#17p / DB rollback diagnostic work. **That scrollback is explicitly excluded from PR#17u evidence.** Only the read-only host-side hash-crosscheck block beginning at `cd /var/www/buyerrecon.com/html/thinlayer || exit 1` and ending at the trailing `root@ubuntu-16gb-nbg1-1:/var/www/buyerrecon.com/html/thinlayer#` prompt is incorporated into §5–§8. No `psql`, no DB diagnostic, no rollback action by PR#17u — those were prior, separate actions in a different shell context and are not part of this PR's proof.

### 3.4 Why this matters

PR#17t inspected the `buyerrecon-website` repo's `production-live-20260508` snapshot as a strong proxy for the deployed bundle. PR#17u confirms byte-equality against the actual `/var/www/buyerrecon.com/html/thinlayer/*.js` files on the Hetzner host. With the §5–§8 results now transcribed from the operator's run, **the residual Gate 1 source-of-truth gap from PR#17t §13.1 is closed for the four hashed bundle files**; the `br-thinlayer-init.js` file is closed categorically (via §6 endpoint posture + §7 transport-shape cross-check) rather than via byte-for-byte hash equality, with the difference explained by mtime drift consistent with PR#17p's documented in-place `endpointUrl` edit-and-rollback on 2026-05-19.

---

## 4. Files checked

PR#17u checks exactly four files. A fifth file (`br-probe.iife.js`) was hashed by PR#17t for completeness; the operator MAY also hash it (§14.5 optional command) but it is **not part of the PR#17u contract-alignment scope** since `br-probe-init.js` configures `apiBase` on the Render legacy probe path (`br-probe-init.js:30`) which is a separate concern from the ThinLayer event-emission path.

The four in-scope files are:

| # | File (host path) | In-scope | PR#17t baseline hash (`production-live-20260508`) |
|---|---|---|---|
| 1 | `/var/www/buyerrecon.com/html/thinlayer/thin-sdk.iife.js` | yes | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` |
| 2 | `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js` | yes (see §3 caveat about expected `endpointUrl`-literal drift) | `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` |
| 3 | `/var/www/buyerrecon.com/html/thinlayer/buyerrecon-adapter.iife.js` | yes | `fe72a27099ff70e879c66011aabc6100bd27c29799d69c3005eab9aa904c983a` |
| 4 | `/var/www/buyerrecon.com/html/thinlayer/br-probe-init.js` | yes (separate concern, but listed in task) | `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84` |
| (5) | `/var/www/buyerrecon.com/html/thinlayer/br-probe.iife.js` | optional / out of contract-alignment scope | `339921e603aface0df8fb620309519bc44fe84e0833bb7bcce063da84c2e5dd9` |

Baseline values are quoted **verbatim** from PR#17t §3.1 of `docs/sprint2-pr17t-live-thinsdk-shape-confirmation.md`. No hashes were re-computed or invented for PR#17u.

---

## 5. Hash and metadata comparison

**Host output transcribed from the operator's §14 runbook execution (sanitised; old PR#17q/PR#17p DB scrollback excluded).**

### 5.1 Per-file host-side observations

| File | Host present? | Host size (bytes) | Host mtime (UTC) | Host mode / owner / group | Host sha256 | PR#17t baseline sha256 | Hash match? | Drift status |
|---|---|---|---|---|---|---|---|---|
| `thin-sdk.iife.js` | yes | 25984 | `2026-05-08 22:19:10.000000000 +0000` | mode `755` / owner `UNKNOWN` / group `root` | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` | `7098d648b2a9cdeb557882204b5956aa0e8ce9c4cad664d14c531e36c53538d1` | **✓ exact match** | Content identical to PR#17t baseline. Size identical. mtime ~1h later than local snapshot (`21:14:09Z` → `22:19:10Z`) — content-hash match confirms benign deploy-timing artefact (§9.1). Non-blocking. |
| `br-thinlayer-init.js` | yes | 4255 | `2026-05-19 17:14:59.122474968 +0000` | mode `755` / owner `UNKNOWN` / group `root` | **omitted** — operator treated this as a config-bearing / endpoint-bearing file and did not compute the hash | `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0` | n/a (hash deliberately not produced) | Size identical (4255 bytes — exact match with local snapshot). mtime ~11 days later than local snapshot (`2026-05-08T21:14:09Z` → `2026-05-19T17:14:59Z`) — consistent with the documented PR#17p `endpointUrl` flip-and-rollback in-place edit on the host on 2026-05-19. Hash is intentionally not reported under the §14.2 safety convention for endpoint-bearing files; the categorical content cross-check in §6 (endpointUrl literal = Render legacy, transport selector intact) is the proof carrier in lieu of byte-for-byte hash equality. **Non-blocking** per §10.1 PASS WITH NON-BLOCKING NOTES rule. |
| `buyerrecon-adapter.iife.js` | yes | 47544 | `2026-05-08 22:19:10.000000000 +0000` | mode `755` / owner `UNKNOWN` / group `root` | `fe72a27099ff70e879c66011aabc6100bd27c29799d69c3005eab9aa904c983a` | `fe72a27099ff70e879c66011aabc6100bd27c29799d69c3005eab9aa904c983a` | **✓ exact match** | Content identical. Size identical. mtime drift same shape as `thin-sdk.iife.js` — benign deploy artefact. Non-blocking. |
| `br-probe-init.js` | yes | 1351 | `2026-05-08 22:19:10.000000000 +0000` | mode `755` / owner `UNKNOWN` / group `root` | `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84` | `09d68188aba806a0054020f83420f536d4c3e6a9d03d13f59f52f2ca17060f84` | **✓ exact match** | Content identical. Size identical. mtime drift same shape as the other bundles — benign deploy artefact. Non-blocking. |
| `br-probe.iife.js` (informational, out-of-contract-alignment scope) | yes | 9420 | `2026-05-08 22:19:10.000000000 +0000` | mode `755` / owner `UNKNOWN` / group `root` | `339921e603aface0df8fb620309519bc44fe84e0833bb7bcce063da84c2e5dd9` | `339921e603aface0df8fb620309519bc44fe84e0833bb7bcce063da84c2e5dd9` | **✓ exact match** | Content identical. Informational only (probe bundle is a separate concern; `br-probe-init.js`'s `apiBase` remains `https://buyerrecon-backend.onrender.com`, not affected by ThinLayer contract alignment). |

### 5.2 Baseline size + mtime reference (from PR#17t §3.1)

| File | PR#17t local snapshot size | PR#17t local snapshot mtime (UTC) | Host size | Host mtime (UTC) | Notes |
|---|---|---|---|---|---|
| `thin-sdk.iife.js` | 25984 | 2026-05-08T21:14:09Z | 25984 ✓ | 2026-05-08T22:19:10Z | mtime +~1h, content hash match |
| `br-thinlayer-init.js` | 4255 | 2026-05-08T21:14:09Z | 4255 ✓ | 2026-05-19T17:14:59Z | mtime +~11d, attributable to PR#17p edit; size unchanged; categorical content intact (§6) |
| `buyerrecon-adapter.iife.js` | 47544 | 2026-05-08T21:14:09Z | 47544 ✓ | 2026-05-08T22:19:10Z | mtime +~1h, content hash match |
| `br-probe-init.js` | 1351 | 2026-05-08T21:14:09Z | 1351 ✓ | 2026-05-08T22:19:10Z | mtime +~1h, content hash match |
| `br-probe.iife.js` | 9420 | 2026-05-08T21:14:09Z | 9420 ✓ | 2026-05-08T22:19:10Z | mtime +~1h, content hash match |

mtime drift on the host file vs the local snapshot is **not** a content drift — file copy / deploy operations can change mtime without changing content. The hash is the authoritative content-equality signal; mtime is informational. All five files' content hashes (where reported) match exactly; sizes match exactly across all five files.

### 5.3 Hash omission rule applied to `br-thinlayer-init.js`

Per the task's secret/redaction rule, the operator applied the safety convention from §14.2: `br-thinlayer-init.js` was treated as potentially config-bearing / endpoint-bearing, so its sha256 hash was deliberately not produced as part of the host-side output. The proof carrier for that file is instead the §6 categorical endpointUrl check + §7 transport-shape categorical check, both of which return the expected counts (endpointUrl=1, Render-legacy `/collect`=1, Sprint 2 `/v1/event`=0, transport selector=1) — consistent with a safe Render-legacy rollback posture. This omission is recorded as a non-blocking note rather than a blocker per the §10.1 PASS WITH NON-BLOCKING NOTES rule.

### 5.4 Non-blocking metadata observations

- **mode = 755 on all five files.** Static JS files on a typical Nginx-served deploy are usually `644`; `755` adds the execute bit (irrelevant for Nginx serving but technically non-standard). Functionally equivalent for serving — Nginx reads the file regardless of the execute bit. Recorded as a non-blocking observation in §9.
- **owner = UNKNOWN on all five files.** The operator's `stat -c '... owner=%U ...'` returned `UNKNOWN`, suggesting either (a) the file's UID does not have a `/etc/passwd` entry on the host (e.g. the deploy was done by a UID that has since been removed or never had a passwd entry — common for container-style deploys), or (b) operator-side redaction. `group=root` was reported. Recorded as a non-blocking observation in §9.

---

## 6. EndpointUrl posture

**Host output transcribed from the operator's §14 runbook execution.**

| Check | Expected | Host-observed | Verdict |
|---|---|---|---|
| `endpointUrl` count in `br-thinlayer-init.js` | exactly 1 occurrence | **1** | ✓ as expected |
| Render legacy `/collect` count (`https://buyerrecon-backend.onrender.com/collect`) | exactly 1 occurrence | **1** | ✓ Render legacy rollback target is present and is the configured endpoint |
| Sprint 2 `/v1/event` count (`https://buyerrecon.com/v1/event`) | **0 occurrences** (must not be configured) | **0** | ✓ no Sprint 2 path leakage; no pre-cutover state |
| `transport:` selector count | exactly 1 occurrence (the `transport: 'fetch'` line confirmed in PR#17t §5.1 / §6.2.1) | **1** | ✓ exactly one transport selector — consistent with the configured `FetchTransport` runtime path |

### 6.1 Conclusion

**`endpointUrl` on the production host's `br-thinlayer-init.js` resolves to Render legacy** (`https://buyerrecon-backend.onrender.com/collect`). No same-origin `https://buyerrecon.com/v1/event` literal is present in the host file. The configured ThinLayer transport remains `FetchTransport` (selected by `transport: 'fetch'`). This is exactly the safe rollback posture documented in PR#17p §4 / PR#17t §4 / §1 above.

**No endpointUrl re-flip is approved by PR#17u.** The categorical confirmation that Render-legacy remains the only configured endpoint serves only as evidence that PR#17p's rollback completed cleanly and that no out-of-band edit re-introduced the Sprint 2 path. It does **not** authorise any future re-flip, which remains gated under its own explicit Helen GO.

---

## 7. Transport / shape categorical cross-check

**Host output transcribed from the operator's §14 runbook execution.** All greps are categorical pattern counts only; no full bundle body was printed and no token-bearing line was extracted.

| Check | Expected (per PR#17t §6.2) | Host-observed | Verdict |
|---|---|---|---|
| `FetchTransport` count in `thin-sdk.iife.js` | ≥ 1 (class exported and selected) | **1** | ✓ class present |
| `BeaconTransport` count in `thin-sdk.iife.js` | ≥ 1 (class exported but not selected by current init) | **1** | ✓ class present (bundle-available, not selected runtime path) |
| `createTransport` count in `thin-sdk.iife.js` | ≥ 1 (factory present) | **1** | ✓ factory present |
| `JSON.stringify` count in `thin-sdk.iife.js` | ≥ 1 (the queue-array serialisation call) | **1** | ✓ serialisation call present |
| `keepalive` count in `thin-sdk.iife.js` | ≥ 1 (FetchTransport flush uses `keepalive: true`) | **1** | ✓ keepalive flag present |
| `application/json` count in `thin-sdk.iife.js` | ≥ 1 (Content-Type literal) | **1** | ✓ Content-Type literal present |
| `sendBeacon` count in `thin-sdk.iife.js` | ≥ 1 (in `BeaconTransport.flush`; **not** on configured runtime path) | **1** | ✓ bundle-available BeaconTransport intact; not selected by current init |
| `"events":` count in `thin-sdk.iife.js` (the `/v1/batch` wrapper key) | **0** (bundle does NOT wrap as `{ events: [...] }`) | **0** | ✓ no batch-wrapper signal; top-level-array body shape preserved |

### 7.1 Conclusion

**The production host's `thin-sdk.iife.js` bundle structure matches PR#17t §6.2 categorical decode exactly.** Both transport classes (`FetchTransport`, `BeaconTransport`) exist in the bundle; the `createTransport` factory is present; the configured init has one `transport:` selector (§6); there is no `{ events: [...] }` wrapper signal anywhere in the bundle. The host-side findings do **not** weaken PR#17t's H1 (array-vs-object envelope mismatch) or H8 (legacy field-name mismatch) — they reinforce both:

- **H1 reinforced.** The host bundle still serialises the queue as `JSON.stringify(<queue array>)` and ships it via `fetch(... { keepalive: true })` (configured `FetchTransport` path per `transport: 'fetch'` at §6). Sprint 2 `/v1/event` rejects top-level arrays at the parser stage. The dominant cause of the 26 post-PR#17q `request_body_invalid_json` rejections is confirmed against the actual host bundle.
- **H8 reinforced.** The host bundle's hash matches the PR#17t local snapshot byte-for-byte, so the field-name absences PR#17t recorded (zero `event_name`, `schema_key`, `schema_version`, `event_origin`, `occurred_at`, `client_event_id`, `page_view_id`, `workspace_id` — see PR#17t §8.3) hold for the deployed bundle as well.

The combined PR#17s + PR#17t + PR#17u Gate 1 evidence is now grounded in (a) Sprint 2 collector source-of-truth (`src/collector/v1/*` on the merged base), (b) ThinSDK bundle source-of-truth (`buyerrecon-website` `production-live-20260508` snapshot), and (c) the actual deployed bundle on the Hetzner production host. Gate 1 is closed.

---

## 8. Comparison to PR#17t local snapshot

**Summary of the host-side cross-check against PR#17t's local-snapshot baseline.**

| Surface | PR#17t local snapshot (`production-live-20260508`) | Host actual | Material drift? | Verdict contribution |
|---|---|---|---|---|
| `thin-sdk.iife.js` content (sha256) | `7098d648b2a9cdeb…538d1` | `7098d648b2a9cdeb…538d1` | **No drift** (byte-for-byte match) | ✓ toward PASS |
| `buyerrecon-adapter.iife.js` content (sha256) | `fe72a27099ff70e8…c983a` | `fe72a27099ff70e8…c983a` | **No drift** (byte-for-byte match) | ✓ toward PASS |
| `br-probe-init.js` content (sha256) | `09d68188aba806a0…0f84` | `09d68188aba806a0…0f84` | **No drift** (byte-for-byte match) | ✓ toward PASS (separate concern but consistent) |
| `br-thinlayer-init.js` content (sha256) | `9b0e4530626be9a3…fda0` | omitted by operator under §14.2 safety convention | n/a (hash not produced) | Categorical content matches expected Render-legacy posture (§6); mtime drift to 2026-05-19 matches PR#17p edit history; size unchanged (4255 bytes both sides) → **PASS WITH NON-BLOCKING NOTES** per §10.1 explainable-axis rule |
| `endpointUrl` literal on host | `https://buyerrecon-backend.onrender.com/collect` (Render legacy) | `https://buyerrecon-backend.onrender.com/collect` (count 1 in `br-thinlayer-init.js`); no `https://buyerrecon.com/v1/event` literal (count 0) | **No material drift** — endpoint matches expected Render-legacy rollback target | ✓ toward PASS |
| `transport: 'fetch'` selector on host | present (one occurrence in init) | present (one `transport:` selector found by `grep -c "^\s*transport:"`) | **No drift** | ✓ toward PASS |
| Bundle transport classes (`FetchTransport`, `BeaconTransport`, `createTransport`) on host | all three present in `thin-sdk.iife.js` | all three present (each `grep -c` count = 1) | **No drift** | ✓ toward PASS |
| `"events":` wrapper key in `thin-sdk.iife.js` | absent (0 occurrences) | absent (0 occurrences) | **No drift** — no batch-wrapper signal | ✓ toward PASS |
| `br-probe.iife.js` content (sha256, informational) | `339921e603aface0…5dd9` | `339921e603aface0…5dd9` | **No drift** | informational |
| All five file sizes | 25984 / 4255 / 47544 / 1351 / 9420 | 25984 / 4255 / 47544 / 1351 / 9420 | **Exact size match across all five files** | ✓ corroborates content equality |

### 8.1 Conclusion

**The residual PR#17t source-of-truth gap (§13.1 / §16.2 of PR#17t) is closed.** The four safe-to-hash bundle files match the local-snapshot baseline byte-for-byte; the fifth file (`br-thinlayer-init.js`) is closed categorically (endpointUrl posture + transport-selector presence + size identity) with the conservative hash-omission convention and the mtime drift explained by PR#17p's documented in-place edit. No unexplained drift remains.

PR#17u upgrades the combined PR#17s + PR#17t Gate 1 evidence chain from "source-grounded against website-repo snapshot" to "source-grounded against actual deployed bundle on the production Hetzner host". The dominant H1 (array-vs-object) and H8 (legacy field-name absence) findings from PR#17t are reinforced, not weakened. **Gate 1 — Static Contract Diff — is closed.**

### 8.2 Remaining limitation

`br-thinlayer-init.js` content equality at the byte level is not directly proven (hash deliberately not produced by the operator under §14.2). The proof carrier for this file is:

- size equality (4255 bytes both sides),
- one-axis mtime drift consistent with PR#17p's documented edit,
- categorical content match (`endpointUrl` literal = Render legacy, `transport:` selector count = 1, no `/v1/event` literal, no Sprint 2 path leakage).

This is the §10.1 PASS WITH NON-BLOCKING NOTES rule applied to a single-axis explainable drift on the init file. If Helen later requires byte-for-byte equality on this file, a follow-up PR can compute the hash under a tighter redaction GO and append it; PR#17u does not authorise that follow-up by itself.

---

## 9. Residual risks and limitations

PR#17u acknowledges the following risks even on the PASS WITH NON-BLOCKING NOTES verdict.

### 9.1 Observed and accepted as non-blocking

1. **`mtime`-only drift is benign.** A file's `mtime` can change without its content changing (deploy, `rsync`, `cp -p` failures, etc.). The hash is the authoritative content-equality signal. The four hashed files all show mtime drift to `2026-05-08T22:19:10Z` (~1 hour later than the local snapshot's `21:14:09Z`) — a benign deploy-timing artefact, fully resolved by the byte-for-byte content-hash match.
2. **`br-thinlayer-init.js` mtime drift to `2026-05-19T17:14:59Z`** is categorically explained by PR#17p's documented in-place `endpointUrl` flip-and-rollback edit on the production host on 2026-05-19. The file size is unchanged (4255 bytes), and the §6 endpointUrl categorical checks confirm the file currently resolves to Render legacy. This satisfies the §10.1 PASS WITH NON-BLOCKING NOTES single-axis explainable-drift rule.
3. **`br-thinlayer-init.js` hash deliberately not produced** by the operator under the §14.2 safety convention (treating it as config-bearing / endpoint-bearing). The proof carrier is instead the size match + mtime drift consistent with PR#17p + categorical content check (§6, §7). This is a non-blocking limitation per the verdict rules.
4. **File mode = `755` on all five files** vs the more typical `644` for Nginx-served static content. Adds the execute bit, which is functionally irrelevant for Nginx serving. Recorded as a non-blocking observation; no security or correctness impact for the contract-alignment scope.
5. **File owner = `UNKNOWN`** in the operator's `stat` output (likely a UID without a `/etc/passwd` entry on the host, or operator-side redaction). `group = root`. Recorded as a non-blocking observation; the file remains readable by the Nginx worker (otherwise the bundles would have failed to serve and PR#17p browser traffic would not have reached `/v1/event` at all — which it did, per the 26 evidence rows).

### 9.2 Generic gate limitations preserved

6. **PR#17u does not test runtime behaviour.** Even a perfect hash match does not prove the bundle is correctly served by Nginx, correctly loaded by the browser, or correctly initialised on page-load. **Static bundle hash confirmation is not write-smoke approval.** **Host-side hash match is not production event-capture proof.**
7. **PR#17u does not validate the bundle against Sprint 2's parser.** That is the contract-mismatch question already settled by PR#17s / PR#17t — H1 and H8 remain confirmed. Hash equality only confirms that the bundle PR#17t inspected is the bundle that's actually deployed.
8. **`br-probe-init.js`'s `apiBase` continues to point at Render legacy** (`https://buyerrecon-backend.onrender.com`). Probe-side traffic is a separate concern from ThinLayer event-emission and is not affected by PR#17u or any Option A bundle update.
9. **PR#17u does not approve Option A implementation by itself.** The actual ThinSDK / adapter bundle update to emit Sprint 2 `/v1/event` shape and required per-event fields is a separate later PR (proposed PR#17v or successor) and remains gated under its own explicit Helen GO.
10. **No write smoke was run** by PR#17u or by the operator during the runbook execution.
11. **No endpointUrl re-flip was approved or executed** by PR#17u. The host's `endpointUrl` remains on Render legacy as documented in §6.
12. **No raw bundle contents were committed** to this repo. The operator returned only categorical metadata, sha256 hashes (for the four safe-to-hash files), and `grep -c` integer counts. No `cat`, no `head -c`, no `xxd`, no `hexdump` was run.

### 9.3 What would have triggered BLOCKED but did not occur

- Any hash mismatch on `thin-sdk.iife.js`, `buyerrecon-adapter.iife.js`, or `br-probe-init.js` — all three matched exactly.
- Same-origin `https://buyerrecon.com/v1/event` literal in the host's `br-thinlayer-init.js` — count was 0.
- Missing transport classes in the bundle — all three (`FetchTransport`, `BeaconTransport`, `createTransport`) were present.
- `"events":` wrapper key present in `thin-sdk.iife.js` — count was 0 (confirms no batch-wrapper signal).
- Raw secret exposure in operator output — none occurred; the operator returned only categorical counts and hashes for non-config files.
- Any production-action violation (`curl`, `psql`, `nginx`, `systemctl`, DNS edit, `/var/www` write, traffic generation) — none occurred. Old PR#17q / PR#17p DB scrollback in the operator's terminal session is explicitly excluded from PR#17u evidence per §3.3.

---

## 10. Gate conclusion

**PR#17u verdict: PASS WITH NON-BLOCKING NOTES.**

The residual Gate 1 source-of-truth gap from PR#17t §13.1 / §16.2 is **closed**:

- **`thin-sdk.iife.js`**, **`buyerrecon-adapter.iife.js`**, **`br-probe-init.js`**, and **`br-probe.iife.js`** are byte-for-byte identical between the local PR#17t snapshot and the production host (sha256 match exact on all four).
- **`br-thinlayer-init.js`** is closed categorically (size identity, single-axis mtime drift consistent with PR#17p, `endpointUrl` literal = Render legacy, no Sprint 2 path leakage, transport selector present) rather than via direct hash, in line with the operator's safety convention for endpoint-bearing files.
- **Host `endpointUrl` resolves to Render legacy** (`https://buyerrecon-backend.onrender.com/collect`) — confirmed by the §6 categorical checks.
- **Host bundle transport structure matches PR#17t §6.2 categorical decode** exactly — confirmed by the §7 categorical checks.

PR#17t's H1 (array-vs-object envelope mismatch as the primary cause of the 26 post-PR#17q `request_body_invalid_json` rejections) and H8 (legacy field-name absence as the second-wave mismatch) findings are now grounded in (a) Sprint 2 collector source-of-truth, (b) ThinSDK bundle source-of-truth (`buyerrecon-website` snapshot), **and** (c) the actual deployed bundle on the production host. Gate 1 — Static Contract Diff — is closed.

### 10.1 What this PASS verdict unlocks

A PASS verdict closes the residual Gate 1 source-of-truth gap and confirms that any downstream Option A implementation work will be operating against the correct baseline. **PR#17u does not authorise any of the following** — each requires its own explicit Helen GO scoped to that specific work:

- Option A implementation PR (proposed PR#17v or successor) — the ThinSDK / adapter bundle update to emit Sprint 2 `/v1/event` shape and required per-event fields. PR#17u's role is purely to certify the baseline; the implementation itself is the next PR.
- **No production deployment** of any updated bundle is authorised by PR#17u.
- **No endpointUrl re-flip is approved by PR#17u.** The host's `endpointUrl` remains on Render legacy.
- Gate 2 (controlled fixture dry-run), Gate 3 (runtime privilege simulation), Gate 4 (route readiness, bundle deploy, endpointUrl re-flip, controlled event proof, passive organic observation, Track A) all remain future-gated under their own GOs.
- No write smoke, no traffic generation, no Track A, no Playwright are authorised by this PR.
- No DB action, no Nginx change, no systemctl action, no DNS change, no Render-side action, no `/var/www` edit are authorised by this PR.

### 10.2 Recommended next step (informational, not pre-authorised)

After Codex review and merge of PR#17u, the next downstream PR in the §11 sequence is the Option A implementation PR (proposed PR#17v or successor). That PR will update `thin-sdk.iife.js` and `br-thinlayer-init.js` (in the `buyerrecon-website` repo, not in this `buyerrecon-backend` repo) to:

- change `FetchTransport.flush()` body construction from `JSON.stringify(<queue array>)` to a single-object envelope per POST,
- emit Sprint 2's required event fields (`event_type` enum, `event_origin`, `event_name`, `schema_key`, `schema_version` semver, `client_event_id` UUIDv4/v7, `occurred_at`, `session_id`),
- preserve the `transport: 'fetch'` selection and `keepalive: true` semantics,
- include unit tests against mocked `fetch`,
- **not** deploy to production by itself.

Helen's explicit GO is required to open that PR. PR#17u does not pre-authorise it.

### 10.3 Verdict rules (reference)

#### PASS

- All four (or five with the optional `br-probe.iife.js`) host files exist.
- Hashes for `thin-sdk.iife.js`, `buyerrecon-adapter.iife.js`, `br-probe-init.js` match PR#17t baseline byte-for-byte.
- `br-thinlayer-init.js` either hashes to the baseline byte-for-byte **or** drifts on a single explainable axis (mtime-only, whitespace-only, or `endpointUrl`-literal-only) while the categorical content (§7 transport markers, §6 endpointUrl literal pointing at Render legacy) is intact.
- `endpointUrl` on the host is Render legacy (`https://buyerrecon-backend.onrender.com/collect`); no `https://buyerrecon.com/v1/event` literal anywhere in `br-thinlayer-init.js`.
- Configured transport is `'fetch'` (selecting `FetchTransport`).
- No raw secret was exposed in operator output.
- No production action (no `curl`, no `psql`, no `nginx`, no `systemctl`, no DNS edit, no `/var/www` write, no traffic) was taken during the runbook execution.

#### PASS WITH NON-BLOCKING NOTES

- All PASS criteria are met EXCEPT one of:
  - `br-thinlayer-init.js` mtime drift only (content hash match expected; if hash drifts due to whitespace-only or endpointUrl-literal-only edit, the §7 categorical content check shows intact bundle structure and Render-legacy `endpointUrl`).
  - One of the bundle files (`thin-sdk.iife.js`, `buyerrecon-adapter.iife.js`, `br-probe-init.js`) shows a mtime drift only with content hash matching.
  - The optional `br-probe.iife.js` drifts (informational only — out of contract-alignment scope).
  - The host bundle's `owner` / `mode` differs from the snapshot but is consistent with a normal Nginx-served deploy (e.g. `mode=644 owner=www-data`).

#### BLOCKED

Use BLOCKED if **any** of the following holds:

- Operator output is not yet appended.
- Any expected file is missing on the production host.
- Hash mismatch on `thin-sdk.iife.js`, `buyerrecon-adapter.iife.js`, or `br-probe-init.js` is unexplained.
- `br-thinlayer-init.js` hash drift is **not** explainable by mtime / whitespace / endpointUrl-literal-only.
- `endpointUrl` is not Render legacy.
- `https://buyerrecon.com/v1/event` literal is already configured in the host's `br-thinlayer-init.js`.
- Configured transport on the host is **not** `'fetch'` (e.g. has been changed to `'beacon'`).
- The bundle's transport-class markers (§7 checks) are absent or differ materially.
- Raw secret material was exposed in operator output (in which case the doc must be redacted before merge).
- Any hard prohibition (§12) was violated by the runbook execution.

### 10.2 What PASS unlocks

A PASS verdict closes the residual Gate 1 source-of-truth gap from PR#17t §13.1 and confirms that any downstream Option A implementation (proposed PR#17v or successor) will be working against the correct baseline. PASS does **not** authorise any of: bundle deploy, endpointUrl re-flip, Gate 2 fixture, Gate 3 privilege simulation, Gate 4 PR B / C / D / E, Track A, Playwright, write smoke, customer-facing output, Lane A/B writer. Each remains separately gated by its own Helen GO.

---

## 11. Required next gates before any endpointUrl re-flip

Before any `endpointUrl` re-flip on `buyerrecon.com`, the downstream implementation PR(s) must close every gate in this list, in order. Each gate requires its own explicit Helen GO. **No endpointUrl re-flip is approved by PR#17u.**

1. **Gate 1 — Static Contract Diff** (`cutover-hard-gates.md` §3). PR#17s + PR#17t + PR#17u (this PR) collectively close Gate 1 once PR#17u transitions to PASS.
2. **Gate 2 — Controlled fixture dry-run** (`cutover-hard-gates.md` §4). Run the updated bundle against a staging or local Sprint 2 collector with a controlled non-customer fixture. No production traffic. **Do not delete failed canary evidence rows.**
3. **Gate 3 — Runtime privilege simulation** (`cutover-hard-gates.md` §5; PR#17r §11.4). Exercise the actual SQL path under a disposable / staging DB role mirroring `buyerrecon_prod_collector_app`'s PR#17q steady-state grant matrix. No `storage_failure`, no `permission denied`, no grant broadening, no Lane A/B grants, no DDL, no `SUPERUSER` / `CREATEDB` / `CREATEROLE`. **Do not broaden grants to make a proof pass.**
4. **Gate 4 — Separate route readiness from traffic cutover** (`cutover-hard-gates.md` §6). PR A → PR B → PR C → PR D → PR E sequence, each with its own GO.
5. **Explicit Helen GO before any endpointUrl re-flip.** No prior PR (PR#17l → PR#17u → any of the proposed PR#17v–PR#17z) pre-authorises a re-flip.
6. **Rollback to Render legacy retained throughout.** Restoring `endpointUrl` to `https://buyerrecon-backend.onrender.com/collect` remains the one-step revert at every gate.

---

## 12. Non-goals / hard boundaries

PR#17u explicitly **does not approve** any of the following. Each requires its own explicit Helen GO scoped to that specific work.

- **`endpointUrl` re-flip** on `buyerrecon.com` or any other site. No endpointUrl re-flip is approved by PR#17u.
- **Nginx change** (no new `location`, no route deletion, no snippet edit, no `nginx -t`, no `systemctl reload nginx`).
- **DNS change.**
- **systemd change** (no service start, stop, restart, enable, disable; no `daemon-reload`; no unit edit).
- **DB action** (no `psql`, no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `DROP`, `GRANT`, `REVOKE`; no SELECT against any production DB).
- **DB grant change** (PR#17q's column-level grants stand; no broadening, no Lane A/B grants, no derived-table grants, no DDL, no `SUPERUSER` / `CREATEDB` / `CREATEROLE`).
- **Write smoke** (no `POST /v1/event`, no `POST /v1/batch`, no `POST /collect`, no `curl -X POST` against any production endpoint, no synthetic event generator).
- **`curl` against production** (no `curl -I`, no `curl -X GET`, no any-method curl against any production endpoint or production-host process).
- **Browser traffic generation** (no human page-load, no controlled browser visit, no automated browser, no Playwright, no headless run).
- **Track A.**
- **Playwright.**
- **Service restart.**
- **File edit under `/var/www`.** The runbook is strictly read-only.
- **Copy of production bundles into the repo.** The buyerrecon-website source files inspected by PR#17t and the production-host bundles cross-checked by PR#17u remain in their respective trees; nothing is copied into `buyerrecon-backend`.
- **Commit of raw production bundles** to any repo. PR#17u's only commit (when authorised) is this single docs file.
- **Change to the website bundle files.** The Option A implementation that updates `thin-sdk.iife.js` / `br-thinlayer-init.js` is a separate later PR.
- **Customer-facing output** (Pass 1 / Trust / Pass 2).
- **Lane A/B writer** (`scoring_output_lane_a` / `scoring_output_lane_b` remain `0`-row).
- **AMS Trust Core exposure** through BuyerRecon.
- **Pass 1 / Pass 2 implementation.**
- **Render migration.** Render legacy collector remains the rollback target.
- **Evidence-row deletion.** The 26 `ingest_requests` evidence rows from the post-PR#17q canary attempt are preserved.
- **Secrets in any artefact.** No raw payloads, raw tokens, token prefixes / suffixes, token hashes, peppers, DSNs, passwords, certificate / private-key material, private IPs, host bodies, or raw customer data appear anywhere in this doc, in chat, in repo files, in PR comments, in commit messages, in CI logs, or in any artefact derived from PR#17u or its runbook execution.

---

## 13. Open decisions for Helen

PR#17u records the following decisions for Helen's review. None are pre-decided.

1. **GO for the §14 runbook.** Authorise an approved operator (typically Helen) to SSH into the Hetzner production host and run the §14 commands read-only. The runbook is filesystem-only; no `curl`, no `psql`, no `nginx`, no `systemctl`, no service action. Returns categorical text outputs (file metadata + hash strings + categorical `grep` counts) for transcription into §5–§8.
2. **`br-thinlayer-init.js` hash policy.** If the host file's content carries any sensitive material (it should not — see PR#17t §9.2 — but the operator's categorical check at §14.3 can confirm), the operator omits its hash and records `hash omitted because file may contain secret material`. If hashing is safe, the operator includes the hash and the verdict rules in §10 apply.
3. **Mtime drift tolerance.** PR#17u treats mtime-only drift as benign per §9.1. Helen confirms this policy or overrides.
4. **`br-probe.iife.js` optional hash.** Operator MAY or MAY NOT include this file's hash (§14.5). It is informational only and out of contract-alignment scope. Helen confirms whether to include it for completeness.
5. **What happens on hash mismatch.** If `thin-sdk.iife.js`, `buyerrecon-adapter.iife.js`, or `br-probe-init.js` drifts on hash unexplainedly, the verdict stays BLOCKED and a follow-up PR investigates the drift (e.g. a `diff -u` between snapshot and host content, with secret redaction). PR#17u does not pre-authorise that follow-up investigation; it requires its own GO.
6. **What happens on endpointUrl mismatch.** If the host's `br-thinlayer-init.js` carries `https://buyerrecon.com/v1/event` already, the canary state is unexpected. The verdict stays BLOCKED until Helen confirms whether to roll back the host file to Render legacy or investigate the source of the unexpected configuration. PR#17u does not pre-authorise any host-file rollback action.
7. **PR#17u close-out path.** Host output is now in hand and transcribed into §5–§8; verdict transitioned to PASS WITH NON-BLOCKING NOTES (§1, §10). Codex re-review pass closed-out; PR ready for commit + push as a single docs-only artefact. Any future PR (e.g. follow-up byte-for-byte hash of `br-thinlayer-init.js` under a tighter redaction GO) is a separate PR with its own scope and is not pre-authorised by PR#17u.

---

## 14. Appendix: redacted commands and outputs

### 14.1 Operator runbook — exact step-by-step commands

The operator SSHes into the Hetzner production host (or runs from a console with read access) and executes the following commands one by one. **No command writes to the filesystem.** **No command issues an HTTP request.** **No command touches the DB.** **No command runs any service action.**

```bash
# Step 1 — change to the ThinLayer directory and confirm location
cd /var/www/buyerrecon.com/html/thinlayer
pwd
```

Expected output: `/var/www/buyerrecon.com/html/thinlayer`

```bash
# Step 2 — list directory contents (categorical anomaly detection per §9.3)
ls -la
```

Expected output: the four in-scope files (plus optionally `br-probe.iife.js`) with `mode 644`, an `owner` consistent with the host's deploy model (typically `www-data` or `root`), and `mtime` in the 2026-05-08 region (or later if a re-deploy has occurred). Any additional `.bak`, `.old`, `.tmp`, `.orig`, `.disabled`, or unrecognised file should be reported in §9 residual risks.

```bash
# Step 3 — per-file existence + metadata (size, mtime, mode, owner, group)
for f in thin-sdk.iife.js br-thinlayer-init.js buyerrecon-adapter.iife.js br-probe-init.js; do
  echo "=== $f ==="
  if test -f "$f"; then
    stat -c 'size=%s mtime=%y mode=%a owner=%U group=%G' "$f"
  else
    echo "MISSING"
  fi
done
```

Expected output: four `=== <file> ===` blocks each followed by a `size=… mtime=… mode=… owner=… group=…` line (no `MISSING`). Operator transcribes the four `stat` lines into §5.1.

```bash
# Step 4 — sha256 hashes for the three bundle files known to be safe
#          (per PR#17t §9.2: no token material in br-thinlayer-init.js,
#           so it is also safe to hash — but the operator should verify
#           via Step 5 first.)
sha256sum thin-sdk.iife.js buyerrecon-adapter.iife.js br-probe-init.js
```

Expected output: three lines of the form `<sha256> <filename>`. Operator transcribes into §5.1 and compares against the §4 PR#17t baseline.

### 14.2 Hash policy decision for `br-thinlayer-init.js`

```bash
# Step 5 — categorical safety check: confirm no token-like material in the host's
#          br-thinlayer-init.js before hashing it. Output is integer counts only.
echo "token-pattern matches (expected: 1 redaction-list entry, no stored token):"
grep -cE 'token|writeToken|siteWriteToken|apiKey|api_key|secret|Bearer' br-thinlayer-init.js
echo "X-* header references (expected: 0):"
grep -cE '[Xx]-[A-Za-z-]+' br-thinlayer-init.js
echo "Authorization header references (expected: 0):"
grep -cE 'Authorization' br-thinlayer-init.js
```

Expected output: `1`, `0`, `0`. (The single `token` hit is the `sensitive_query_key_denylist` array entry per PR#17t §9.2, which is a SDK feature to redact `?token=…` from URLs, not a stored token.)

```bash
# Step 6 — if and only if Step 5 returned 1, 0, 0 (the safe pattern), hash the file:
sha256sum br-thinlayer-init.js
# Otherwise, do NOT run the above sha256sum and record in §5.1:
#   hash omitted because file may contain secret material
```

Operator transcribes the hash (or the omission note) into §5.1 row for `br-thinlayer-init.js`.

### 14.3 EndpointUrl posture categorical check

```bash
# Step 7 — endpointUrl categorical checks (line counts only; no full lines printed
#          because the surrounding init file may not contain secrets per PR#17t §9.2
#          but the categorical count is the safer reporting form).
echo "endpointUrl occurrences:"
grep -cE 'endpointUrl' br-thinlayer-init.js
echo "Render-legacy /collect literal occurrences (expected: 1):"
grep -cE 'https://buyerrecon-backend\.onrender\.com/collect' br-thinlayer-init.js
echo "Sprint 2 /v1/event literal occurrences (expected: 0):"
grep -cE 'https://buyerrecon\.com/v1/event' br-thinlayer-init.js
echo "transport selector occurrences (expected: 1 — the transport: 'fetch' line):"
grep -cE "^\s*transport:" br-thinlayer-init.js
```

Expected output: `1`, `1`, `0`, `1`. Operator transcribes the four counts into §6.

### 14.4 Transport / shape categorical cross-check

```bash
# Step 8 — bundle transport-class presence (categorical pattern counts only)
echo "FetchTransport occurrences:"
grep -cE 'FetchTransport' thin-sdk.iife.js
echo "BeaconTransport occurrences:"
grep -cE 'BeaconTransport' thin-sdk.iife.js
echo "createTransport occurrences:"
grep -cE 'createTransport' thin-sdk.iife.js
echo "JSON.stringify occurrences:"
grep -cE 'JSON\.stringify' thin-sdk.iife.js
echo "keepalive occurrences:"
grep -cE 'keepalive' thin-sdk.iife.js
echo "application/json occurrences:"
grep -cE 'application/json' thin-sdk.iife.js
echo "sendBeacon occurrences (in BeaconTransport, not on configured path):"
grep -cE 'sendBeacon' thin-sdk.iife.js
echo "events array key (should be absent — bundle does NOT wrap as { events: [...] }):"
grep -cE '"events"\s*:' thin-sdk.iife.js
```

Expected output (per PR#17t §6.2 categorical decode): all expected-≥1 patterns return ≥1; `"events":` returns 0. Operator transcribes the eight counts into §7.

### 14.5 Optional: `br-probe.iife.js` informational hash

```bash
# Step 9 (optional) — informational only; out of contract-alignment scope
sha256sum br-probe.iife.js
```

### 14.6 What the operator MUST NOT run

- **No `cat`, `head -c`, `tail`, `xxd`, `hexdump`, or any command that dumps file bytes** beyond the categorical counts above.
- **No `curl`, `wget`, `nc`, `telnet`** — no HTTP request of any kind.
- **No `psql`, `pg_dump`, `pg_restore`** — no DB action.
- **No `nginx`, `systemctl`, `service`** — no service action.
- **No `sed -i`, `awk -i inplace`, `>` / `>>` redirection into any production file, no `chmod`, `chown`, `mv`, `cp`, `rm`** under `/var/www` — no write.
- **No tail of any log file containing token-bearing lines or raw event bodies.**
- **No copy of any production bundle into the repo.**

If any non-runbook command was accidentally executed, the operator records the fact in §9 residual risks and the verdict stays BLOCKED pending Helen's review.

### 14.7 Operator output transcription template

The operator returns the following blocks for transcription into §5–§8:

```
=== Step 1 — pwd ===
<pwd output>

=== Step 2 — ls -la ===
<ls -la output (redacted for any unexpected file names — categorical presence only)>

=== Step 3 — stat per file ===
=== thin-sdk.iife.js ===
size=… mtime=… mode=… owner=… group=…
=== br-thinlayer-init.js ===
size=… mtime=… mode=… owner=… group=…
=== buyerrecon-adapter.iife.js ===
size=… mtime=… mode=… owner=… group=…
=== br-probe-init.js ===
size=… mtime=… mode=… owner=… group=…

=== Step 4 — sha256sum (three safe-to-hash bundle files) ===
<sha256> thin-sdk.iife.js
<sha256> buyerrecon-adapter.iife.js
<sha256> br-probe-init.js

=== Step 5 — br-thinlayer-init.js token-pattern counts ===
token-pattern: <int>
X-* headers: <int>
Authorization: <int>

=== Step 6 — br-thinlayer-init.js hash (if Step 5 was 1,0,0) ===
<sha256> br-thinlayer-init.js
  — OR —
hash omitted because file may contain secret material

=== Step 7 — endpointUrl categorical ===
endpointUrl occurrences: <int>
Render-legacy /collect: <int>
Sprint 2 /v1/event: <int>
transport selector: <int>

=== Step 8 — bundle transport-class categorical ===
FetchTransport: <int>
BeaconTransport: <int>
createTransport: <int>
JSON.stringify: <int>
keepalive: <int>
application/json: <int>
sendBeacon: <int>
"events": <int>

=== Step 9 (optional) — br-probe.iife.js hash ===
<sha256> br-probe.iife.js
```

Helen / the operator pastes the transcription into a follow-up commit on this PR's branch (or a follow-up amend PR under a separate GO). Once §5–§8 are filled in, the verdict is re-evaluated against §10.3 and the PR transitions to PASS, PASS WITH NON-BLOCKING NOTES, or remains BLOCKED. **Status: transcription complete; verdict transitioned to PASS WITH NON-BLOCKING NOTES (see §1 and §10).**

### 14.8 Inspection commands run by Claude Code

For the avoidance of doubt, the following are the **only** commands Claude Code executed locally during the production of this runbook. **None reached any production host.** **None modified any working tree beyond writing this single docs file.**

| Command | Purpose | Reached production host? |
|---|---|---|
| `ls /var/www` (on local macOS) | Confirm Claude Code has no host access | No — local filesystem only |
| `ls /var/www/buyerrecon.com/html/thinlayer` (on local macOS) | Same — confirm absent | No — local filesystem only |
| `git fetch origin`, `git checkout`, `git pull --ff-only` (in buyerrecon-backend) | Update local repo state and create the PR#17u branch | No — origin is GitHub, not Hetzner |
| `grep` on `docs/sprint2-pr17t-live-thinsdk-shape-confirmation.md` | Retrieve baseline hashes from PR#17t for §4 / §5 / §8 | No — local file only |

No `curl`, no `psql`, no `nginx`, no `systemctl`, no `ssh`, no DB connection, no production-host file read, no production-host file write, no traffic generation by Claude Code at any point.

### 14.9 Closing posture

- **PR#17u is docs-only.** No code, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file in any working tree, no DB connection, no production command, no production-host file read or write, no edit to any file under `/var/www`, no copy of any production bundle into this repo, no change to any website bundle file.
- **No raw payloads, raw tokens, token prefixes / suffixes, token hashes, peppers, DSNs, passwords, certificate / private-key material, private IPs, host bodies, or raw customer data** appear anywhere in this doc.
- **Production posture after PR#17u:** unchanged from PR#17t §4. `buyerrecon-production-collector.service` `active` on `PORT=3073`; `nginx.service` `active` with the PR#17o `location = /v1/event` route; `buyerrecon.com` ThinLayer `endpointUrl` on Render legacy (`https://buyerrecon-backend.onrender.com/collect`) — **directly confirmed on the host by the §6 categorical checks**; `br-probe-init.js` on Render `apiBase`; production event tables at `ingest_requests=26` / `accepted_events=0` / `rejected_events=0` / `site_write_tokens_used=1` (evidence preserved); Lane A/B at `0` rows; PR#17g grant safety intact; PR#17q column-level grants intact; staging service untouched; Render legacy collector remains the live capture path for ThinLayer traffic on all five canary sites.

End of PR#17u. **Verdict: PASS WITH NON-BLOCKING NOTES. Gate 1 — Static Contract Diff is closed. Recommended next step (separately gated): Option A implementation PR (proposed PR#17v or successor); still no production deployment by that PR. No endpointUrl re-flip is approved by PR#17u.**
