# BuyerRecon Sprint 2 PR#17o — `buyerrecon.com` Nginx Canary Route Proof

Status: **docs-only proof closure for PR#17d Nginx canary route execution**. No code changes. No package changes. No migrations. No `schema.sql` changes. No `.env*` changes. No systemd unit changes. No DB commands run by PR#17o. No Nginx commands run by PR#17o. No service start / restart by PR#17o. No DNS change. No ThinLayer change. No Track A. No Playwright. No live customer / collector event traffic. No customer-facing output.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `2ed7278` — PR#17n / GitHub PR #19 merged, "record production collector deployment proof").

PR branch: `buyerrecon-sprint2-pr17o-buyerrecon-com-nginx-canary-route-proof`

---

## 1. Status / verdict

**PASS.** Under a separately-approved Helen GO scoped to PR#17d Nginx canary route execution (per §2 below), the operator added a narrow `/v1/event` Nginx location on `buyerrecon.com` that proxies to the now-running production Sprint 2 collector (`http://127.0.0.1:3073/v1/event`), included the root-only PR#17m production token snippet, and verified the route shape and zero-event posture without performing any POST / write smoke. `nginx -t` was successful, Nginx reloaded successfully, and the duplicate `buyerrecon.com` `server_name` warnings observed at preflight were eliminated by moving the accidental enabled backup config out of `sites-enabled/`.

The production collector remained `active/running` on `PORT=3073` throughout. Production event tables remain at `0` rows; `site_write_tokens.last_used_at` remains `0`-used. No ThinLayer change, no DNS change, no Track A, no Playwright, no live customer / collector traffic. No secret material crossed into shareable artefacts.

PR#17o records the proof. PR#17d Nginx-route work is **complete** for the route-shape and effective-config scope. The actual ThinLayer endpointUrl flip, first real organic event observation, and any write smoke remain **future** and **separately gated**.

---

## 2. Scope and approval

PR#17o records what the operator executed under PR#17d's Nginx-route GO. The recorded GO scope:

- Configure `buyerrecon.com` Nginx **only**.
- Disable accidental enabled `buyerrecon.com` backup config from `sites-enabled/` if needed to remove duplicate `server_name` warnings.
- Create a **root-only** production Nginx token snippet for `buyerrecon_com` using the saved PR#17m raw token from Helen's secure record (`/root/buyerrecon-pr17m-new-site-write-tokens-20260519T143703Z.txt` on the production host).
- Add a **narrow** production collector route on `buyerrecon.com`:

  `location = /v1/event` → `proxy_pass http://127.0.0.1:3073/v1/event`

- Run `nginx -t`, reload Nginx, verify route shape, service health, logs, and zero-event posture.

**Out of scope (explicit boundaries — none of these were performed):**

- No DNS change.
- No ThinLayer config change yet.
- No Track A.
- No Playwright.
- No adversarial traffic.
- No broad live traffic generation.
- No collector write smoke.
- No customer-facing output.
- No Lane A/B writer.
- No AMS Trust Core exposure.
- No Pass 1 / Pass 2 implementation.
- No staging env reuse.
- No secret printing.

**Server / repo anchors at execution:**

- Server HEAD before / at proof: `2ed7278eb924bd48e3e22736744206cb8baa2420`.
- Branch on production host's working tree: `sprint2-architecture-contracts-d4cc2bf`.
- Previous proof closure PR#17n merged as GitHub PR `#19`.

PR#17o itself is **docs-only**. It does not run `nginx`, `systemctl`, `psql`, `curl`, or any other production command. It records what the operator already observed.

---

## 3. Production collector prerequisite

PR#17n closure established the production collector posture; PR#17o re-confirmed it categorically at the start of the Nginx route work:

- `buyerrecon-production-collector.service` — `active/running`.
- Production collector health: `GET http://127.0.0.1:3073/health` returned `{ "status": "ok", "timestamp": "<ISO8601>" }` (categorical PASS; ISO8601 not copied).
- Safe skip log line present in the running process logs:

  ```
  Database schema bootstrap skipped by SKIP_DB_INIT=true
  ```

- Listening log line present:

  ```
  br-collector listening on :3073
  ```

- `SKIP_DB_INIT=true` in process env (exact lowercase literal, per PR#17k guard).
- `DATABASE_URL` resolves categorically to `db_name=buyerrecon_production`, `db_user=buyerrecon_prod_collector_app`, `host_category=local-postgres` (per PR#17m / PR#17n; values never printed).
- Lane A/B writer grant safety from PR#17g remains in force.

The collector was therefore ready to receive a narrow Nginx-side `/v1/event` route without any service-side change. No service start / restart was performed under PR#17o.

---

## 4. Nginx preflight findings

The operator inspected the production host's Nginx state before any change. All findings recorded categorically; no host body, no private IP, no token value, no secret material is copied below.

- **Existing `buyerrecon.com` config carried only the manual staging synthetic route at preflight:**

  ```
  /__br-prod-synthetic-event   →  http://127.0.0.1:3071/v1/event
  ```

  - included `/etc/nginx/snippets/buyerrecon-staging-token.conf`,
  - set `Host: collector-staging.buyerrecon.com` upstream-side,
  - i.e. a deliberately staging-flavoured loopback shim for the synthetic-proxy host, **not** a production collector route.
- **`/collect` and `/v1/event` returned `404` before any route insertion** — confirming that public `buyerrecon.com` traffic could not reach the Sprint 2 production collector via either path prior to PR#17o.
- **Duplicate enabled `buyerrecon.com` backup config existed in `sites-enabled/`:**

  ```
  /etc/nginx/sites-enabled/buyerrecon.com.bak.prod-synthetic-proxy.20260511-141818
  ```

  This duplicate was producing `conflicting server name "buyerrecon.com" on …` warnings from `nginx -t` and was a hygiene gap inherited from prior local edits. The duplicate's existence does **not** indicate any live cutover; it was an accidental leftover in `sites-enabled/`.
- **`sites-enabled/` listing after preflight inspection** confirmed two files matched `buyerrecon.com` (the active config plus the accidental backup); after cleanup (§5), only one remained.

No production state changed during preflight; this section only describes what the operator observed.

---

## 5. Route changes made

All changes were applied on the production host's Nginx file tree under the PR#17d Helen GO. PR#17o records them; **PR#17o itself does not modify any Nginx file in the repo or on any other system.**

1. **Backup of the current `buyerrecon.com` config** taken to:

   ```
   /etc/nginx/sites-enabled/buyerrecon.com.bak.pr17d.20260519T153807Z
   ```

   …then **moved out of `sites-enabled/`** to:

   ```
   /etc/nginx/sites-enabled-disabled/buyerrecon.com.bak.pr17d.20260519T153807Z
   ```

   so its presence inside `sites-enabled/` would not produce a fresh `server_name` conflict.

2. **Disabled the accidental enabled backup config** noted at §4 by moving it out of `sites-enabled/` (also into `/etc/nginx/sites-enabled-disabled/…`). After cleanup, only `/etc/nginx/sites-enabled/buyerrecon.com` declares `server_name buyerrecon.com www.buyerrecon.com`.

3. **Created a root-only production Nginx token snippet** for `buyerrecon_com`:

   ```
   /etc/nginx/snippets/buyerrecon-production-token-buyerrecon-com.conf
   ```

   - mode `0600`, root-owned;
   - contains a single `proxy_set_header X-Site-Write-Token <token>` line (or equivalent header per the collector's token-auth contract — the exact line shape stays on the production host, **not** in this doc);
   - the token value is the saved PR#17m raw token for `buyerrecon_com` from `/root/buyerrecon-pr17m-new-site-write-tokens-20260519T143703Z.txt` on the production host;
   - the **token value was not printed at the terminal, not pasted into chat, not included in this doc, not included in any captured proof artefact**.

4. **Inserted a narrow `/v1/event` location into `/etc/nginx/sites-enabled/buyerrecon.com`** with the shape:

   ```
   location = /v1/event {
       include /etc/nginx/snippets/buyerrecon-production-token-buyerrecon-com.conf;
       proxy_set_header Host buyerrecon.com;
       proxy_pass http://127.0.0.1:3073/v1/event;
   }
   ```

   Properties:
   - **Exact-match** location (`location = /v1/event`) — no broad path prefix, no wildcard exposure of other collector routes.
   - Includes the **root-only** production token snippet from step 3.
   - Forces `Host: buyerrecon.com` upstream, so the collector's request log carries the canonical site host.
   - Proxies only to the **local loopback** production collector (`http://127.0.0.1:3073/v1/event`); no public upstream, no DNS resolution required.

5. **No other Nginx directive was added or modified** in this PR's scope. The existing `/__br-prod-synthetic-event` staging shim and any unrelated routes on `buyerrecon.com` were left untouched.

---

## 6. Token snippet handling and secret safety

- **Token source:** Helen's saved PR#17m raw `site_write_tokens` file on the production host at `/root/buyerrecon-pr17m-new-site-write-tokens-20260519T143703Z.txt`. The file is root-owned (mode `0600` per PR#17m operator hygiene) and is **not** in any git working tree; it is **not** committed; it is **not** synced.
- **Token snippet path on the production host:**

  ```
  /etc/nginx/snippets/buyerrecon-production-token-buyerrecon-com.conf
  ```

- **Token snippet mode:** `0600`, root-owned. Categorical observation recorded as `PROD_TOKEN_SNIPPET_MODE_600=PASS`.
- **Token value:** **never printed** to the terminal, **never** pasted into chat, **never** included in this doc, **never** included in any captured proof artefact. The operator copied the token directly from the source file into the snippet via a redaction-safe shell flow.
- **Snippet content secret scan:** PR#17o records the categorical result `ROUTE_FILE_SECRET_SCAN=PASS`. The forbidden-pattern grep (`postgres://`, `DATABASE_URL=`, `SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`, `password=`, `token=…`, 64-hex hashes, `BEGIN PRIVATE KEY`, `BEGIN CERTIFICATE`, RFC1918 IPs, etc.) was run over the captured Nginx config / snippet review window and returned no match in any artefact destined for this doc.
- **Snippet placement order:** the token snippet is **only** included inside the new `location = /v1/event` block. It is **not** included at the `server { … }` level. This narrows token-header injection to the single route the proof authorises, so unrelated routes on `buyerrecon.com` (including the existing `/__br-prod-synthetic-event` shim) cannot inadvertently leak the production token upstream.
- **No secret values anywhere in this PR.** No raw token, token hash, token prefix, token suffix, derived material, pepper, password, DSN, private IP, host token, or certificate / private-key material appears in this doc, in chat, in repo files, or in any captured proof output.

---

## 7. Nginx validation and reload proof

The operator validated the Nginx configuration on the production host after every file change. All observations are categorical; no host body / private IP / token value is reproduced.

- **`nginx -t` after route insertion:** successful (`syntax is ok` + `test is successful`).
- **Warning surface:** only the generic Nginx protocol-option warnings remained (the same family of `protocol options redefined` lines unrelated to PR#17o changes). **Duplicate `buyerrecon.com` `server_name` warnings were eliminated** after moving the accidental enabled backup config out of `sites-enabled/` (§5 step 2).
- **Nginx reload:** executed successfully. `systemctl reload nginx` returned exit 0. The reload was non-disruptive (no `restart`, no service stop).
- **Post-reload `systemctl is-active nginx`:** `active`.
- **Duplicate `buyerrecon.com` server-name check post-cleanup:**

  ```
  $ grep -lE 'server_name[[:space:]]+buyerrecon\.com\b' /etc/nginx/sites-enabled/*
  /etc/nginx/sites-enabled/buyerrecon.com
  ```

  (single file; no duplicates).

No other Nginx state changed; the staging backend (`buyerrecon-backend.service`, `PORT=3071`) and the synthetic-proxy listener (`PORT=3072`) remained untouched.

---

## 8. Effective route proof

After reload, the operator captured the **effective Nginx config** for `buyerrecon.com` and verified the route shape categorically:

| Check | Result |
|---|---|
| `ROUTE_LOCATION_PRESENT` | PASS — `location = /v1/event` present in effective config |
| `ROUTE_PROXY_3073` | PASS — `proxy_pass http://127.0.0.1:3073/v1/event` resolved |
| `ROUTE_PROD_TOKEN_SNIPPET` | PASS — `include /etc/nginx/snippets/buyerrecon-production-token-buyerrecon-com.conf` resolved |
| `ROUTE_HOST_HEADER` | PASS — `proxy_set_header Host buyerrecon.com` resolved |
| `ROUTE_FILE_SECRET_SCAN` | PASS — forbidden-pattern grep returned no match |
| `PROD_TOKEN_SNIPPET_MODE_600` | PASS — snippet at mode `0600`, root-owned |

These categorical PASS lines were derived without printing the token value, without printing the host body of the snippet, and without resolving any other Nginx location beyond the one PR#17d authorised.

**No-write route behaviour probe (categorical):**

```
$ curl -I https://buyerrecon.com/v1/event
HTTP/2 404
```

This `HTTP/2 404` from an unauthenticated `HEAD` against a route configured for token-bearing `POST` is the expected response shape and is **not treated as a collector failure**. The effective Nginx config in the table above proves the route is wired; PR#17d / PR#17o were not authorised to run a `POST` / write smoke (per §2 boundaries and §9 zero-event proof below), so any further probe was deliberately avoided.

---

## 9. Zero-event / no-write proof

The operator captured production row counts before and after the Nginx changes, using PR#17m's approved read-only operator verification path (**not** under `buyerrecon_prod_collector_app`, which has no SELECT on these tables per PR#17h §13 / PR#17m §8.4 Blocker-2 fix). All counts categorical.

### 9.1 Before reload

| Surface | Count |
|---|---|
| `accepted_events` | 0 |
| `rejected_events` | 0 |
| `ingest_requests` | 0 |
| `site_write_tokens_used` (= `count(*) filter (where last_used_at is not null)`) | 0 |

### 9.2 After reload / final proof

| Surface | Count |
|---|---|
| `accepted_events` | 0 |
| `rejected_events` | 0 |
| `ingest_requests` | 0 |
| `scoring_output_lane_a` | 0 |
| `scoring_output_lane_b` | 0 |
| `site_write_tokens_used` | 0 |

Implications:

- The Nginx route insertion **did not** create any production event row (consistent with the §2 no-write-smoke boundary).
- No token was validated server-side (the `HEAD /v1/event` 404 probe did not reach a token-aware code path that would update `last_used_at`).
- `scoring_output_lane_a` / `scoring_output_lane_b` remain at `0` rows; PR#17g grant safety holds.
- No POST / write smoke was authorised, and none was performed.

Categorical PASS for "PR#17o changed only the Nginx-side route shape; it did not introduce any traffic-shaped row into production."

---

## 10. What did not happen

PR#17o execution and PR#17d Nginx-route closure record the following non-events. **None of these occurred at any point during execution.**

- **No DNS change.** The `buyerrecon.com` zone was not edited; no CNAME flip; no edge / CDN cutover. The route works only because Nginx on the production host already serves `buyerrecon.com` (per the pre-existing config); PR#17o adds an exact-match `/v1/event` location to that existing server block — it does not introduce DNS-level cutover.
- **No ThinLayer config change.** The ThinLayer `endpointUrl` on `buyerrecon.com` was **not** flipped. ThinLayer continues to post wherever it was posting before PR#17o, which by PR#17a / PR#17l / PR#17n posture is the Render legacy collector. PR#17o made the Sprint 2 production path *reachable* via `buyerrecon.com/v1/event`, but not *active for the live site's ThinLayer*.
- **No Track A.** The Track A repo was not touched; no Track A scenario was executed in any environment.
- **No Playwright.** No headless / programmatic browser run.
- **No adversarial traffic.** No bot / synthetic / low-dwell / refresh-loop / form-submit / CTA-adversarial behaviour was generated.
- **No broad live traffic generation.** No mass `curl` / `wrk` / load-gen run; the only HTTP probe was the single `curl -I https://buyerrecon.com/v1/event` (§8) which is `HEAD`, not `POST`, and returned a 404 without reaching the collector's write path.
- **No collector write smoke.** No `POST /v1/event` request was issued under PR#17o scope.
- **No customer-facing output.** Pass 1 / Trust / Pass 2 remain unimplemented and future-gated.
- **No durable Lane A/B writer.** `scoring_output_lane_a` / `scoring_output_lane_b` remain at 0 rows. PR#17g grant safety holds.
- **No AMS Trust Core output exposure** through BuyerRecon.
- **No AMS runtime bridge.**
- **No Pass 1 / Pass 2 implementation.**
- **No staging env reuse.** The new route proxies to the production collector on `127.0.0.1:3073` (PR#17l / PR#17n), not the staging backend on `127.0.0.1:3071` and not the synthetic-proxy listener on `127.0.0.1:3072`. The staging `/__br-prod-synthetic-event` shim was left untouched.
- **No secrets printed.** No raw token, token hash, token prefix / suffix, pepper, password, DSN, private IP, host body of the token snippet, or certificate / private-key material appears in this doc, in chat, in PR comments, in repo files, or in any captured proof output.

---

## 11. Rollback path

Recorded for operational traceability; **PR#17o does not execute any rollback step**, and the route as deployed is the steady-state for now. If a future operator decision (under its own explicit GO) requires reverting the Nginx route:

1. **Restore the prior `buyerrecon.com` config** by moving the PR#17d backup back into `sites-enabled/`:

   ```
   /etc/nginx/sites-enabled-disabled/buyerrecon.com.bak.pr17d.20260519T153807Z
     →  /etc/nginx/sites-enabled/buyerrecon.com
   ```

   …after first moving the current `/etc/nginx/sites-enabled/buyerrecon.com` aside (e.g. into `/etc/nginx/sites-enabled-disabled/buyerrecon.com.bak.rollback.<UTC>`).

2. **Remove or disable the production token snippet** if reverting the route entirely:

   ```
   /etc/nginx/snippets/buyerrecon-production-token-buyerrecon-com.conf
   ```

   may be `chmod 000`-ed and renamed (e.g. `.disabled`) or removed once no `include` directive references it. Removal must not leave a dangling `include` in any active server block.

3. **Run `nginx -t`** to confirm the restored config is syntactically valid; then `systemctl reload nginx`.

4. **Do not delete production DB evidence rows** if later traffic has been captured between PR#17o and the rollback. PR#17g grant safety and PR#17h ledger preservation rules still apply (`ingest_requests` / `accepted_events` / `rejected_events` / Lane A/B rows are never truncated or dropped by rollback).

5. **The current proof created no production event rows** (per §9). Therefore the immediate rollback would be ledger-neutral; a rollback after future traffic landed would surface evidence-gap concerns and must be paired with a follow-up evidence-gap report (per PR#17h §16 posture).

No rollback was executed under PR#17o; the listed steps are reference material for a future explicit decision.

---

## 12. Remaining gates / next steps

PR#17d Nginx-route execution is complete within its active GO scope. The following gates remain future, each requiring its own explicit Helen final-GO message scoped to the named work.

1. **Actual ThinLayer `endpointUrl` update for `buyerrecon.com`.** Flipping the live ThinLayer endpoint from the Render legacy collector to the now-reachable `https://buyerrecon.com/v1/event` Sprint 2 production path is a **future** step, separately approved. PR#17o does **not** perform or pre-approve it. The Sprint 2 production path is *available* server-side; the live ThinLayer config is the lever that decides when (and whether) `buyerrecon.com` traffic uses it.
2. **First real organic `buyerrecon.com` event observation** against the Sprint 2 collector. This will only happen after step 1's ThinLayer flip; PR#17o has not captured any such event (zero-event posture holds, per §9). When the first real event lands, it will appear in `ingest_requests` / `accepted_events` (or `rejected_events` on reject path), and `site_write_tokens.last_used_at` will be bumped for the `buyerrecon_com` row. Observation of that first event is a separate proof PR (e.g. PR#17p or similar) under its own GO.
3. **Any write smoke** (collector-side synthetic `POST /v1/event` to exercise the write path against production) remains **future-gated** and was explicitly out of scope here.
4. **Track A `B_analytics_only` execution proof** (PR#17e plan) — gated on a separate explicit Helen final-GO scoped to PR#17e.
5. **Broader canary** — `realbuyergrowth.com`, `timetopoint.com`, `fidcern.com`, `keigen.co.uk` — gated per PR#17d's site-by-site cutover order, only after `buyerrecon.com` canary proof closes successfully (first event observed, no rejection spike, observers behave, etc.).
6. **Adversarial scenarios** — low-dwell, refresh-loop, adversarial CTA, form-submit — only after `B_analytics_only` proof passes and is reviewed.
7. **Customer-facing output** — Pass 1 / Trust / Pass 2 planning + implementation are an independent track that can run in parallel; no customer-facing automated artefact is enabled until that sequence is designed and approved.

PR#17o itself does not perform any of the above. It records that the Nginx-side route on `buyerrecon.com` is in place, the route shape is verified, and zero-traffic / no-secret posture is preserved.

---

## Closing notes

- **PR#17o is docs-only.** No code, no `package.json`, no scripts, no tests, no migrations, no `schema.sql`, no `.env*`, no systemd unit, no Nginx file in any working tree, no DB connection by PR#17o, no service action by PR#17o.
- **No raw token, token hash, pepper, password, DSN, certificate / private-key material, private IP, or vault contents** appear anywhere in this doc.
- **Production posture after PR#17o:** `buyerrecon-production-collector.service` `active/running` on `PORT=3073` (PR#17n closure); `nginx.service` `active` with the new `location = /v1/event` block routing to it; ThinLayer config on the live site **not yet changed**; production event tables at `0` rows; PR#17g Lane A/B grant safety intact; staging service untouched; Render legacy untouched.

End of PR#17o. **Docs only. Verdict: PASS.**
