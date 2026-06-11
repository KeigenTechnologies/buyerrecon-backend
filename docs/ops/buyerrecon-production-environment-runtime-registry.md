# BuyerRecon — Production Environment & Runtime Registry (Non-Secret)

**Status:** `BUYERRECON_PRODUCTION_ENVIRONMENT_RUNTIME_REGISTRY_PLANNING_ONLY`

A safe, **non-secret** operational map so operators do not repeatedly make
mistakes around production paths, role names, DSN construction, command names,
runtime boundaries, and which documents are **audit evidence** vs **production
runtime**.

This document is **docs-only** and **executes nothing**.

---

## 1. Purpose & Non-Secret Policy

This registry is a **non-secret operational map — not a secret store.** It must
**never** contain actual secret or raw infrastructure values:
- no passwords, tokens, full DSNs, credential URIs;
- no raw `.env.production` contents;
- no raw DB hostnames, IP addresses, DB ports, or private endpoints;
- no `session_id` / `request_id` / `canonical_jsonb` / payload / customer data.

Where a host / port / DSN / password is needed, record **only the custody rule**,
e.g.:
- "host/port must be obtained from approved production DB custody";
- "full DSN must be assembled outside repo/logs";
- "do not paste into chat/logs/repo";
- "use a hidden prompt / secret-safe mechanism".

---

## 2. Production Identity (safe identifiers only)

| Item | Value |
|---|---|
| Repo | `buyerrecon-backend` |
| Base branch | `sprint2-architecture-contracts-d4cc2bf` |
| Production host path | `/opt/buyerrecon-backend` |
| Production DB name | `buyerrecon_production` |

**Not recorded here:** raw host, IP, port, or endpoint (custody-only — see §5).

---

## 3. Runtime Command Map

| Item | Value / source of truth |
|---|---|
| Stage 0 command | `npm run stage0:run` |
| Package mapping | `stage0:run` → `tsx scripts/run-stage0-worker.ts` (`package.json`) |

**Rule:** an **exact command-mapping gate** must confirm
`stage0:run` == `tsx scripts/run-stage0-worker.ts` **before** any execution
(fail closed on mismatch).

---

## 4. Stage 0 Execution Identity

- **Dedicated role:** `buyerrecon_stage0_runner` (created/granted/proven — PR #188).
- **Allowed grants (least-privilege):**
  - `SELECT` on `public.accepted_events`;
  - `SELECT` on `public.ingest_requests`;
  - `SELECT, INSERT, UPDATE` on `public.stage0_decisions`.
- **Forbidden (proven absent in PR #188):**
  - no `buyerrecon_scoring_worker` membership;
  - no Risk / POI / POI-sequence / Lane / scoring / AMS grants;
  - no `stage0_decisions` DELETE;
  - no table ownership;
  - no schema-wide grants.

---

## 5. DSN Construction & Custody (structure + custody only — no values)

- **Required structure (placeholders only):**
  `postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
  — `<PASSWORD>` / `<HOST>` / `<PORT>` are **literal placeholders**, never values.
- **Password custody:** operator-held / approved secret custody (the password
  created for `buyerrecon_stage0_runner` during the PR #188 proof). Never printed
  or committed.
- **Host/port custody:** approved production DB custody source — **presence
  confirmed** by PR #195 (booleans only; values never printed).
- **Assembly:** assemble the full DSN **outside repo/logs** (password-manager or
  server-side hidden in-memory assembly); **never** paste into chat/logs/repo;
  use a hidden prompt / secret-safe mechanism; unset on every path.
- **Never use as the Stage 0 DSN:**
  - the `.env.production` collector DSN directly;
  - `buyerrecon_prod_collector_app` (forbidden-for-Stage 0 context);
  - `buyerrecon_app` (superseded / forbidden-for-Stage 0 context);
  - a `postgres` / admin / superuser DSN;
  - a password-only value;
  - a guessed host/port; an assumed `localhost` / `5432` unless **approved
    custody verifies it**.

---

## 6. Runtime vs Evidence Docs (do not confuse)

**Runtime-relevant (real behaviour / state):**
- code under `src/`;
- scripts used by package commands (e.g. `scripts/run-stage0-worker.ts`);
- migrations / schema (`migrations/`);
- package scripts (`package.json`);
- deployment / config files;
- DB roles / grants **actually applied** to `buyerrecon_production`.

**Evidence / audit only (NOT production runtime):**
- docs-only planning PRs;
- blocked / failure evidence PRs;
- proof-pass docs;
- Codex review prompts;
- merge descriptions;
- command-pack / planning docs **unless explicitly executed later under a GO**.

> A merged docs-only PR records or plans; it does **not** by itself change
> production. Only an operator action under an explicit GO changes runtime/state.

---

## 7. Current Stage 0 Readiness Chain (PR references only)

| Milestone | PR |
|---|---|
| Read-source grants proofed | PR #167 |
| Dedicated role created/granted/proven | PR #188 |
| Execution command pack | PR #189 |
| First execution gate-query failure | PR #190 |
| DSN structural-check plan | PR #191 |
| Unexpected-scheme evidence | PR #192 |
| DSN custody/construction plan | PR #193 |
| Host/port custody plan | PR #194 |
| Host/port custody PASS | PR #195 |
| DSN structural preflight PASS | PR #196 |
| Gate-query failure after DSN structural PASS | PR #197 |

(Public PR references only; no secrets.)

---

## 8. Standard Execution Gates (before any Stage 0 execution)

1. Repo **synced to the latest approved merge**.
2. **Exact command-mapping gate** (`stage0:run` → `tsx scripts/run-stage0-worker.ts`).
3. **DSN structural check** (loaded / no whitespace / scheme / parseable /
   expected user / not collector app / expected DB).
4. **DB/role/writable `psql` gate** (`current_database` = `buyerrecon_production`;
   `current_user` = `buyerrecon_stage0_runner`; session writable).
5. **Run-lock absent** before the run.
6. **Run-lock touched only immediately before** the one execution.
7. **One execution only.**
8. **Runtime output captured to a chmod-600 temp**; **raw output withheld**.
9. **Docs-only evidence PR afterward.**

---

## 9. Stop-Lines (fail closed; emit safe stop-line + non-zero exit)

- wrong repo path;
- missing required PR merge;
- command-mapping mismatch;
- DSN missing / malformed / wrong role / wrong DB;
- a raw secret would be printed (DSN / password / token / host / port / raw
  output);
- DB/role/writable gate failure;
- gate-query execution failure;
- run-lock preexisting;
- Stage 0 command exits non-zero;
- result parse failure;
- any downstream runtime would be bundled (extractor / risk / POI / evidence
  snapshot / Lane A·B / scoring / AMS / customer output / Gate 4E / Gate 4F);
- any ambiguous result.

On any stop-line: remove temp files, unset secret variables, and record the
blocked state in a docs-only evidence PR before any further action.

---

## 10. Update Policy

- Registry updates are **docs-only**; **no secret values**.
- **Codex review is required** for any addition involving production paths, DSN
  custody, roles, grants, commands, deployment, or runtime boundaries.
- If a value is secret or infrastructure-sensitive, store **only a
  custody/source-of-truth pointer**, not the value.
- The placeholder URI template
  `postgresql://buyerrecon_stage0_runner:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production`
  may appear with `<PASSWORD>` / `<HOST>` / `<PORT>` as **literal placeholders
  only**.

---

## 11. Safety / Raw-Data Boundary

This registry contains no real DSN URI, password, bearer token, AWS/OpenAI-style
token, raw UUID, IP address, hostname, port value, raw payload, `canonical_jsonb`
payload, `accepted_events` row data, raw behavioural row data, real `session_id`
/ `request_id` value, user-agent value, or customer data. All entries are public
repo/branch names, the approved production host **path** (`/opt/buyerrecon-backend`),
approved role / database / relation names, package script names and the
`stage0:run` → `tsx scripts/run-stage0-worker.ts` mapping, public PR references,
custody rules, safe labels / stop-lines, and the
`<PASSWORD>`/`<HOST>`/`<PORT>` placeholder template — not secret or row values.
`buyerrecon_prod_collector_app` / `buyerrecon_app` / `localhost` / `5432` appear
only as **forbidden / not-assumed** context, not as asserted production values.
