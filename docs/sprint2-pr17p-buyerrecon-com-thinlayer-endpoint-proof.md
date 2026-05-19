# BuyerRecon Sprint 2 PR#17p — `buyerrecon.com` ThinLayer `endpointUrl` Update Proof

Status: **docs-only proof closure for the ThinLayer `endpointUrl` flip on `buyerrecon.com`**. No code changes. No package changes. No migrations. No `schema.sql` changes. No `.env*` changes. No systemd unit changes. No DB commands were run by PR#17p authoring. Execution used read-only operator observation against production DB metrics only, with no DB mutation. No Nginx commands run by PR#17p. No service start / restart by PR#17p. No DNS change. No Track A. No Playwright. No synthetic traffic. No collector write smoke. No observed live event traffic occurred during the proof window, and no operator-generated event traffic was created. No customer-facing output. No Lane A/B writer. No AMS Trust Core exposure. No Pass 1 / Pass 2.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `233ed47` — PR#17o / GitHub PR #20 merged, "record buyerrecon.com Nginx route proof").

PR branch: `buyerrecon-sprint2-pr17p-buyerrecon-com-thinlayer-endpoint-proof`

---

## 1. Status / verdict

**PASS for the file change. First organic event observation: `NO_EVENT_YET`.**

Under a separately-approved Helen GO scoped to the ThinLayer `endpointUrl` flip on the live `buyerrecon.com` site (per §2 below), the operator backed up the existing ThinLayer init file, replaced exactly one string literal — `endpointUrl: 'https://buyerrecon-backend.onrender.com/collect'` → `endpointUrl: 'https://buyerrecon.com/v1/event'` — and verified the diff categorically. `br-probe-init.js` was **not** touched and still carries its Render `apiBase`. Page health on `https://buyerrecon.com/` returned `HTTP/2 200`. The Sprint 2 production collector (`buyerrecon-production-collector.service`, `127.0.0.1:3073`) remained `active`, with `GET http://127.0.0.1:3073/health` returning `status=ok`. Production event tables remained at `0` rows throughout the file change and the entire passive observation window.

A passive observation window of 20 ticks at 30-second intervals (start `2026-05-19T16:04:42Z`, end `2026-05-19T16:14:13Z`, ~10 minutes total) recorded zero ingest requests, zero accepted events, zero rejected events, zero `site_write_tokens` uses, and zero `buyerrecon_com`-scoped activity on every tick. This is **not a failure**: it means no normal organic visitor with a consent-triggered ThinLayer event occurred during the window. The endpoint flip is effective; the first real organic event simply has not yet landed.

PR#17p records the proof. The endpointUrl-flip step is **complete** for the file-change scope. The first real organic `buyerrecon.com` event observation, any controlled non-organic page-load proof, the Track A `B_analytics_only` proof, any collector write smoke, and all customer-facing output remain **future** and **separately gated**.

---

## 2. Scope and approval

PR#17p records what the operator executed under an explicit Helen GO scoped to the ThinLayer `endpointUrl` flip on `buyerrecon.com`. The recorded GO scope:

- Update **only** `/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js` on the production host.
- Change exactly one literal — the ThinLayer `endpointUrl` — from `https://buyerrecon-backend.onrender.com/collect` to `https://buyerrecon.com/v1/event`.
- Back up the original file on disk before editing.
- Verify the resulting diff categorically.
- **Do not** modify `br-probe-init.js`.
- **Do not** change Nginx, DNS, systemd, DB, or any repo code.
- Verify page health and zero-event posture after the file change.
- Allow **only normal organic `buyerrecon.com` traffic** to create the first event after the flip; no synthetic, controlled, or operator-triggered page load is authorised under this scope.

**Out of scope (explicit boundaries — none of these were performed):**

- No DNS change.
- No Nginx change.
- No systemd change.
- No DB mutation.
- No repo code change.
- No Track A.
- No Playwright.
- No synthetic traffic.
- No collector write smoke.
- No customer-facing output.
- No Lane A/B writer.
- No AMS Trust Core exposure.
- No Pass 1 / Pass 2.
- No staging env reuse.
- No secret printing.
- No first production event yet (no operator-triggered event was generated; only passive organic traffic was permitted).

**Server / repo anchors at execution:**

- Server HEAD before / at proof: `233ed4761998dc0d77c4e125be7ea50d2d7968cc` ("Sprint 2 PR#17o: record buyerrecon.com Nginx route proof (#20)").
- Branch on production host's working tree: `sprint2-architecture-contracts-d4cc2bf`.
- Previous proof closure PR#17o merged as GitHub PR `#20`.

PR#17p itself is **docs-only**. It does not run `nginx`, `systemctl`, `psql`, `curl`, `node`, or any other production command. It records what the operator already observed.

---

## 3. Precondition from PR#17o

PR#17o closure established that the Sprint 2 production path on `buyerrecon.com` was reachable server-side via the narrow exact-match Nginx route `location = /v1/event` → `proxy_pass http://127.0.0.1:3073/v1/event`, with the root-only PR#17m production token snippet included only inside that location and the upstream `Host` header forced to `buyerrecon.com`. After PR#17o, the Sprint 2 production collector was *reachable* via `buyerrecon.com/v1/event`, but the **live ThinLayer on the site was still posting to the Render legacy collector** (`https://buyerrecon-backend.onrender.com/collect`).

PR#17p is the lever that decides when `buyerrecon.com` ThinLayer traffic begins using the Sprint 2 production path. Concretely, PR#17p re-confirmed PR#17o posture at the start of the file change:

- `buyerrecon-production-collector.service` — `active/running` on `PORT=3073`.
- Production collector health: `GET http://127.0.0.1:3073/health` returned `status=ok` (categorical PASS).
- Nginx route for `https://buyerrecon.com/v1/event` proxying to the local production collector remained in place per PR#17o §8.
- Production event tables remained at `0` rows; `site_write_tokens.last_used_at` remained `0`-used.
- `br-probe-init.js` (Render `apiBase`) and ThinLayer `endpointUrl` (Render legacy `/collect`) both still pointed at Render at the start of PR#17p — i.e. nothing on the live site was yet using the Sprint 2 path.

The collector and the Nginx route were therefore in their PR#17o steady state at the moment of the PR#17p file change. PR#17p performed no service start / restart, no Nginx change, no DB action.

---

## 4. File changed

Exactly one file on the production host was changed under PR#17p:

```
/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js
```

Backup taken before the edit (root-owned, same directory, timestamped suffix to make the rollback target unambiguous):

```
/var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js.bak.pr17p.20260519T160108Z
```

Categorical observations recorded at the file boundary:

| Check | Result |
|---|---|
| Backup file present alongside live file | PASS |
| Live file path unchanged (still `br-thinlayer-init.js`) | PASS |
| File mode / ownership preserved by the edit | PASS |
| Only this one file modified under PR#17p | PASS |
| `br-probe-init.js` untouched (see §6) | PASS |
| Any other file under `/var/www/buyerrecon.com/html/thinlayer/` untouched | PASS |
| Any file outside `/var/www/buyerrecon.com/html/thinlayer/` untouched | PASS |

No repo working tree was modified by PR#17p. The repo-side artefact for PR#17p is this docs file only.

---

## 5. `endpointUrl` diff

The substantive change is a single string-literal replacement inside `br-thinlayer-init.js`. The safe (non-secret, non-host-body) diff shape:

Before:

```js
endpointUrl: 'https://buyerrecon-backend.onrender.com/collect'
```

After:

```js
endpointUrl: 'https://buyerrecon.com/v1/event'
```

Categorical endpoint counts taken across the live `br-thinlayer-init.js` file, before and after the edit:

| Surface | Count |
|---|---|
| `RENDER_ENDPOINT_COUNT_PRE` (literal `https://buyerrecon-backend.onrender.com/collect`, pre-change) | 1 |
| `PROD_ENDPOINT_COUNT_PRE` (literal `https://buyerrecon.com/v1/event`, pre-change) | 0 |
| `ENDPOINT_PATCHED` (single-literal replacement applied, both pre-conditions met, no second match, no surrounding-line collateral) | PASS |
| `RENDER_ENDPOINT_COUNT_POST` (literal `https://buyerrecon-backend.onrender.com/collect`, post-change) | 0 |
| `PROD_ENDPOINT_COUNT_POST` (literal `https://buyerrecon.com/v1/event`, post-change) | 1 |

The pre/post inversion (`1 → 0` for Render, `0 → 1` for production) demonstrates categorically that the literal was swapped exactly once with no residual occurrence and no double-write. No other JavaScript construct (function name, variable, identifier, code path, listener, init guard) was altered.

The diff was reviewed against the surrounding lines to confirm the replacement did not silently change adjacent properties, did not split a multi-line option, and did not touch the ThinLayer init signature, the consent-gate check, or any other configuration key. Only the single `endpointUrl` value changed.

---

## 6. `br-probe-init.js` unchanged

PR#17p's GO explicitly scoped the change to ThinLayer's `br-thinlayer-init.js` and excluded the probe init file. The operator confirmed categorically that `br-probe-init.js` was **not** modified:

| Check | Result |
|---|---|
| `BR_PROBE_INIT_UNCHANGED_RENDER_API_BASE` (probe init file still contains its Render `apiBase` literal) | PASS |

The retained literal inside `br-probe-init.js`:

```js
apiBase: 'https://buyerrecon-backend.onrender.com'
```

This matters because the probe init file is a **separate** path with a **separate** approval boundary. PR#17p does **not** flip the probe `apiBase`. Any future change to that path is its own gate and will be recorded under its own proof PR.

Additional categorical observations:

- No bytes inside `br-probe-init.js` were touched under PR#17p.
- No backup of `br-probe-init.js` was created (none was needed — file unchanged).
- No other file under `/var/www/buyerrecon.com/html/thinlayer/` was modified.

---

## 7. Page and collector health proof

After the file change, the operator verified the live site's surface health and the production collector's health categorically. No `POST` was issued; no token was exercised; no synthetic event was generated.

### 7.1 Page health

```
$ curl -I https://buyerrecon.com/
HTTP/2 200
```

The site root responds `HTTP/2 200` after the ThinLayer init file replacement. No 5xx, no broken `Content-Type`, no stale-resource-shaped failure surface was observed.

### 7.2 Collector health

- `buyerrecon-production-collector.service` — `active` (categorical PASS).
- `GET http://127.0.0.1:3073/health` returned `status=ok` (categorical PASS; ISO timestamp not copied).

### 7.3 What was not probed

- **No `POST` against `https://buyerrecon.com/v1/event`** was issued under PR#17p. The proof avoids any operator-triggered call that would touch the token-aware code path; only normal organic traffic is permitted to create the first event.
- **No `HEAD` against `/v1/event`** was issued either — PR#17o §8 already records the route shape, and the PR#17p GO did not authorise re-probing it.
- **No browser open / page-load by the operator** was performed — the GO permits only passive organic traffic during the observation window (§8).
- **No DNS / TLS / certificate inspection** was performed — out of scope.

---

## 8. Passive observation proof

The operator ran a passive observation loop against the production database / metrics surfaces using PR#17m's approved read-only operator path (**not** under `buyerrecon_prod_collector_app`, which lacks `SELECT` on these tables per PR#17h §13 / PR#17m §8.4 Blocker-2 fix). All ticks were strictly read-only.

- **Cadence:** 20 ticks, 30 seconds apart.
- **Duration:** ~10 minutes total.
- **Start:** `2026-05-19T16:04:42Z`.
- **End:** `2026-05-19T16:14:13Z`.

Per-tick categorical reading (identical on **every** one of the 20 ticks):

| Surface | Value |
|---|---|
| `ingest_requests` | `0` |
| `accepted_events` | `0` |
| `rejected_events` | `0` |
| `site_write_tokens_used` (= `count(*) filter (where last_used_at is not null)`) | `0` |
| `buyerrecon_com_ingest` (per-site projection for `buyerrecon_com`) | `0` |
| `buyerrecon_com_accepted` (per-site projection for `buyerrecon_com`) | `0` |
| `buyerrecon_com_rejected` (per-site projection for `buyerrecon_com`) | `0` |

Aggregate conclusion captured from the loop:

- `PR#17p endpointUrl update: PASS`
- `First organic event observation: NO_EVENT_YET`

This is **not** a failure. It is the expected categorical outcome when no normal organic visitor on `buyerrecon.com` triggered a consented ThinLayer event during the observation window. The endpointUrl flip is in effect; the first event is now a function of real-world traffic on the live site, not of any further operator action under PR#17p's GO. When the first real event lands, it will increment `ingest_requests` and (on the accept path) `accepted_events`, and will bump `site_write_tokens.last_used_at` for the `buyerrecon_com` row. Observation of that first event is a separate proof PR under its own GO (see §12).

---

## 9. Zero-event / no-write posture

PR#17p preserved production zero-event posture categorically across the entire file-change-plus-observation window.

| Surface | Pre-change | Post-change | After 20-tick passive observation |
|---|---|---|---|
| `accepted_events` | 0 | 0 | 0 |
| `rejected_events` | 0 | 0 | 0 |
| `ingest_requests` | 0 | 0 | 0 |
| `site_write_tokens_used` | 0 | 0 | 0 |
| `buyerrecon_com_ingest` | 0 | 0 | 0 |
| `buyerrecon_com_accepted` | 0 | 0 | 0 |
| `buyerrecon_com_rejected` | 0 | 0 | 0 |
| `scoring_output_lane_a` | 0 | 0 | 0 |
| `scoring_output_lane_b` | 0 | 0 | 0 |

Implications:

- The ThinLayer `endpointUrl` flip **did not** create any production event row by itself (it is a passive front-end config swap; events only originate from real consented page loads).
- No token validated server-side during PR#17p — `site_write_tokens.last_used_at` for `buyerrecon_com` remains unset.
- `scoring_output_lane_a` / `scoring_output_lane_b` remain at `0` rows; PR#17g grant safety holds.
- No POST / write smoke was authorised, and none was performed.

Explicit boundary confirmations recorded under PR#17p:

- `NO_WRITE_SMOKE_RAN` — no operator-triggered collector write smoke at any point.
- `NO_TRACK_A_RAN` — no Track A scenario was executed in any environment under PR#17p.

Categorical PASS for "PR#17p changed only the live site's ThinLayer endpointUrl literal; it did not introduce any traffic-shaped row into production."

---

## 10. What did not happen

PR#17p execution and this proof closure record the following non-events. **None of these occurred at any point during execution or during the passive observation window.**

- **No DNS change.** The `buyerrecon.com` zone was not edited; no CNAME flip; no edge / CDN cutover.
- **No Nginx change.** No Nginx config file was added, modified, or removed; no `nginx -t`, no `systemctl reload nginx`, no `systemctl restart nginx` was executed by PR#17p. The PR#17o route remained as-deployed.
- **No systemd change.** No unit file was touched; no `daemon-reload`; no service start, stop, restart, or enable / disable action by PR#17p. `buyerrecon-production-collector.service` remained `active` continuously through the proof.
- **No DB mutation.** No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `DROP`, `GRANT`, or `REVOKE` against the production database. Only the read-only operator path described in §8 was used.
- **No repo code change.** No code, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file in any working tree was modified by PR#17p. The single repo artefact is this docs file.
- **No Track A.** The Track A repo was not touched; no Track A scenario was executed in any environment.
- **No Playwright.** No headless / programmatic browser run.
- **No synthetic traffic.** No `curl -X POST` against `/v1/event`, no `wrk`, no `ab`, no synthetic-event generator, no `__br-prod-synthetic-event` invocation, no manual JavaScript console invocation of the ThinLayer init code.
- **No collector write smoke.** No `POST /v1/event` request was issued under PR#17p scope. `NO_WRITE_SMOKE_RAN` recorded categorically.
- **No observed live event traffic.** No observed live event traffic occurred during the proof window, and no operator-generated event traffic was created. The 20-tick passive window (§8) read `0` for `ingest_requests`, `accepted_events`, `rejected_events`, `site_write_tokens_used`, and the `buyerrecon_com_*` projections on every tick; this records the absence of observed live event traffic, not the observation of any ThinLayer-originated event.
- **No customer-facing output.** Pass 1 / Trust / Pass 2 remain unimplemented and future-gated.
- **No Lane A/B writer.** `scoring_output_lane_a` / `scoring_output_lane_b` remain at `0` rows. PR#17g grant safety holds.
- **No AMS Trust Core exposure** through BuyerRecon.
- **No AMS runtime bridge.**
- **No Pass 1 / Pass 2 implementation.**
- **No staging env reuse.** The new ThinLayer endpointUrl points only at `https://buyerrecon.com/v1/event` (the PR#17o Nginx route → production collector on `127.0.0.1:3073`). It does not point at the staging backend on `127.0.0.1:3071`, at the synthetic-proxy listener on `127.0.0.1:3072`, or at the Render legacy collector.
- **No secrets printed.** No raw token, token hash, token prefix / suffix, pepper, password, DSN, private IP, host body of the production collector, or certificate / private-key material appears in this doc, in chat, in PR comments, in repo files, or in any captured proof output. PR#17p never read any token material — the PR#17o root-only snippet remained untouched.
- **No first production event yet.** The 20-tick passive window recorded `NO_EVENT_YET`. PR#17p's GO did not authorise any operator-triggered traffic to force one.

---

## 11. Rollback path

Recorded for operational traceability; **PR#17p does not execute any rollback step**, and the post-change file content is the steady-state for now. If a future operator decision (under its own explicit GO) requires reverting the ThinLayer endpointUrl flip:

1. **Restore the backup file** by moving the PR#17p backup back over the live file:

   ```
   /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js.bak.pr17p.20260519T160108Z
     →  /var/www/buyerrecon.com/html/thinlayer/br-thinlayer-init.js
   ```

   The backup is byte-for-byte identical to the pre-change file (per §4), so the restore is exact and does not require re-deriving any prior content.

2. **Verify endpoint counts return to Render legacy** by re-running the categorical literal counts over the restored `br-thinlayer-init.js`:

   - `RENDER_ENDPOINT_COUNT_POST_ROLLBACK` should be `1` (literal `https://buyerrecon-backend.onrender.com/collect` present).
   - `PROD_ENDPOINT_COUNT_POST_ROLLBACK` should be `0` (literal `https://buyerrecon.com/v1/event` absent).

   These are the mirror image of §5 and confirm the rollback was exact.

3. **Page health check** after the restore:

   ```
   $ curl -I https://buyerrecon.com/
   HTTP/2 200
   ```

   No other surface needs to be probed — no Nginx, systemd, or DB action is part of the rollback.

4. **Do not delete production DB evidence rows** if real events arrived between PR#17p and the rollback. PR#17g grant safety and PR#17h ledger preservation rules apply (`ingest_requests` / `accepted_events` / `rejected_events` / Lane A/B rows are never truncated or dropped by rollback). The §8 passive window observed `NO_EVENT_YET`, so the *immediate* rollback would be ledger-neutral; a rollback after future events landed must be paired with a follow-up evidence-gap report (per PR#17h §16 posture).

5. **Do not modify** Nginx, systemd, DNS, the production DB schema, the production token snippet, or any repo code as part of the rollback. The PR#17p rollback path is confined to a single file restore on the production host.

No rollback was executed under PR#17p; the listed steps are reference material for a future explicit decision.

---

## 12. Remaining gates / next steps

PR#17p execution is complete within its active GO scope (file change verified, page and collector health verified, zero-event posture preserved, passive organic observation window closed with `NO_EVENT_YET`). The following gates remain future, each requiring its own explicit Helen final-GO message scoped to the named work.

1. **First real organic `buyerrecon.com` event observation** against the Sprint 2 collector. PR#17p left `buyerrecon_com_ingest`, `buyerrecon_com_accepted`, `buyerrecon_com_rejected`, and `site_write_tokens_used` at `0` after a 20-tick passive window. Observation of the first real organic event — its arrival, its accept/reject path, the `site_write_tokens.last_used_at` bump for the `buyerrecon_com` row, and any latency / shape observations — is a separate proof PR under its own GO.
2. **Any controlled (non-organic) browser visit or page-load proof.** A deliberate operator-driven page load — even a single manual browser hit on `buyerrecon.com` — is **not** authorised by PR#17p's GO and requires its own explicit Helen GO if Helen later decides that purely passive organic observation is not yielding a first event in an acceptable time. PR#17p must not be treated as pre-authorisation for any such follow-up.
3. **Track A `B_analytics_only` execution proof** (PR#17e plan) — gated on a separate explicit Helen final-GO scoped to PR#17e (or a later equivalent).
4. **Any write smoke** (collector-side synthetic `POST /v1/event` to exercise the write path against production) remains **future-gated** and was explicitly out of scope here.
5. **Broader canary** — `realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk` — gated per PR#17d's site-by-site cutover order, only after `buyerrecon.com` canary proof closes successfully (first event observed, no rejection spike, observers behave, etc.).
6. **Adversarial scenarios** — low-dwell, refresh-loop, adversarial CTA, form-submit — only after `B_analytics_only` proof passes and is reviewed.
7. **Customer-facing output** — Pass 1 / Trust / Pass 2 — Lane A/B writer rollout — AMS Trust Core exposure — AMS runtime bridge — all remain future-gated and independent of PR#17p.

PR#17p itself does not perform any of the above. It records that the ThinLayer `endpointUrl` on the live `buyerrecon.com` site now resolves to the Sprint 2 production path verified by PR#17o, that the file change was exact and reversible, that the live page and production collector remain healthy, and that zero-event / no-write / no-secret posture was preserved across both the change and the passive observation window.

---

## Closing notes

- **PR#17p is docs-only.** No code, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file in any working tree, no DB connection by PR#17p, no service action by PR#17p, no Render-side action by PR#17p.
- **No raw token, token hash, pepper, password, DSN, certificate / private-key material, private IP, or vault contents** appear anywhere in this doc.
- **Production posture after PR#17p:** `buyerrecon-production-collector.service` `active` on `PORT=3073` (PR#17n closure); `nginx.service` `active` with the PR#17o `location = /v1/event` block routing to it; ThinLayer `endpointUrl` on the live site **now resolves to `https://buyerrecon.com/v1/event`** (the Sprint 2 production path); `br-probe-init.js` Render `apiBase` **unchanged**; production event tables at `0` rows; `site_write_tokens.last_used_at` unset for `buyerrecon_com`; PR#17g Lane A/B grant safety intact; staging service untouched; Render legacy untouched (still receives `br-probe-init.js` probe-side traffic).

End of PR#17p. **Docs only. File-change verdict: PASS. First organic event observation: `NO_EVENT_YET` — open under future gate.**
