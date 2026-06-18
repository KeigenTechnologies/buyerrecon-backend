# Config Constants Candidate Triage

> **Docs-only triage.** This report classifies the remaining inventory candidates recorded in
> [`docs/config-constants-inventory.md`](./config-constants-inventory.md) into actionable
> categories. It is a **review artifact only**: it changes **no** enforcement, **no** constants,
> **no** source code, and **no** glossary definitions. It adds and removes **no** forbidden
> literals and does **not** alter `npm run check:constants` behavior.
>
> Governance context (both layers already on base `sprint2-architecture-contracts-d4cc2bf`):
> constants registry + narrow source guardrail (PR #293, made green by PR #294, refreshed by
> PR #295) and the concept-vocabulary glossary `.claude/glossary.md` (PR #296). This triage is
> the bridge between "what the inventory found" and "what each finding should become."
>
> **Secret safety:** every count below is taken from the already-published inventory
> (`docs/config-constants-inventory.md` §2, §2.1, §6.1). **No DSN value, `postgres://` string,
> host, port, username, password, token, or any connection component is printed or stored in
> this report.** DSN / connection-string findings are reported as safe category + count + file
> path + docs/test/source classification + recommended handling only.

---

## Summary

- **Total candidate clusters reviewed:** 23
- **Recommended A candidates (project-unique non-secret literals):** 5 total — **4 already
  registered + enforced** (`buyerrecon_production`, `buyerrecon_prod_collector_app`,
  `buyerrecon_stage0_runner`, `/opt/buyerrecon-backend`; no further action) + **1 new
  candidate** (Stage 0 runner custody **file path**) marked `PENDING_HELEN_REVIEW`.
- **Recommended B candidates (registered/standard, NOT guardrail-forbidden):** 5
- **Recommended C candidates (glossary / concept vocabulary):** 11 (10 already CONFIRMED or
  tracked in `.claude/glossary.md`; 1 cluster of new uncovered terms → `PENDING_HELEN_REVIEW`)
- **Recommended D candidates (ignore / historical / false positive):** 5
- **Secret-safe handling confirmation:** ✅ No DSN/`postgres://`/host/port/username/password/
  token/connection-component values were printed, copied, or stored. DSN findings are reported
  as counts and file-distribution only (see "DSN / connection-string safety review").

Classification rule kept throughout: **inventory broad, guardrail narrow.** A literal is only
recommended toward the forbidden guardrail when it is project-unique, non-secret, low-frequency,
and near-zero false-positive risk. `DATABASE_URL`, `STAGE0_RUNNER_DSN`, `APP_DSN`, `ADMIN_DSN`,
generic `*_DSN` prefixes, `RouteA/B/C`, and `Stage0` are **explicitly not** recommended for the
forbidden guardrail.

---

## A. Candidate project-unique non-secret literals

Project-specific, non-secret, low-drift literals suitable for `config/constants.ts` and
(potentially) the narrow forbidden guardrail.

| Candidate label | Reason | Evidence count | File distribution | Recommended next action | Helen approval required | Future forbidden? |
|---|---|---:|---|---|---|---|
| `buyerrecon_production` (env / DB name) | Project-unique non-secret canonical environment + production DB name; must never drift | 352 total (overwhelmingly `*.md`; 0 source after PR #294) | docs-dominant; 0 in source | **None** — already `PRODUCTION_ENV` in `config/constants.ts`/`.claude/constants.md` and already a guardrail fail-condition | No (done) | **Already enforced** |
| `buyerrecon_prod_collector_app` (collector role) | Project-unique non-secret DB role; must never drift; never the Stage 0 role | 470 total; 0 source after PR #294 | docs-dominant; 0 in source | **None** — already `PRODUCTION_DB_ROLE_COLLECTOR_APP`; enforced | No (done) | **Already enforced** |
| `buyerrecon_stage0_runner` (runner role) | Project-unique non-secret least-privilege Stage 0 runner role; must never drift | 375 total; 0 in source | docs-dominant; 0 in source | **None** — already `STAGE0_RUNNER_ROLE`; enforced | No (done) | **Already enforced** |
| `/opt/buyerrecon-backend` (checkout path) | Project-unique non-secret production checkout path; must never drift | 155 total; 0 in source | docs-dominant; 0 in source | **None** — already `PRODUCTION_CHECKOUT_PATH`; enforced | No (done) | **Already enforced** |
| Stage 0 runner **custody file path** (`/etc/…/stage0-runner.env`) | Project-unique non-secret **path** (its *contents* are a secret DSN); low frequency; near-zero false-positive shape | Recorded in inventory §4/§6 as PENDING; not currently referenced in source | docs/ops only | **Register a path constant ONLY if source code needs it.** Do not promote pre-emptively | **Yes** | **Eligible** (project-unique, low-freq) — but only after a real code need exists; never expose contents |

> Net-new A work for follow-up: **only** the custody file path, and only conditionally
> (`PENDING_HELEN_REVIEW`). The four existing A literals are complete — no further action.

---

## B. Registered constants, not guardrail-forbidden

Registered (or standard) names that are valid as `process.env.X` references and/or are
high-frequency, so a grep-based forbidden rule would create unacceptable false positives. These
stay **registered-but-not-forbidden**.

| Candidate label | Reason not forbidden | Evidence count | Recommended handling |
|---|---:|---:|---|
| `DATABASE_URL` | Standard env-var **name**; valid as `process.env.DATABASE_URL`; very high frequency (111 source hits); forbidding it would break legitimate env access and flood false positives | 799 total (111 source) | Keep registered as `DATABASE_URL_ENV`; import the **name** symbol where practical; never forbid. Value is a secret — never print |
| `STAGE0_RUNNER_DSN` | Env-var / custody key **name** bound to a secret DSN value; valid as `process.env` ref; high frequency | 262 total (0 source) | Keep registered as `STAGE0_RUNNER_DSN_ENV`; never forbid; value stays custody-only |
| `APP_DSN` / `ADMIN_DSN` / `RUNNER_DSN` (naming variants) | `*_DSN` env-var-name variants associated with secret values; canonical set not yet established; high false-positive + secret-adjacency risk | `APP_DSN` 147, `ADMIN_DSN` 12, `RUNNER_DSN` 263 | `PENDING_HELEN_REVIEW` for canonical naming; register names only after confirmation; **never** forbid; never coin new variants |
| `STAGE0` (env prefix) | Canonical env-var prefix; appears in many legitimate env-name compositions; very high frequency | 893 total | Keep registered as `STAGE0_ENV_PREFIX`; never forbid (would match every Stage 0 env name) |
| `STAGE0_ROUTE_A/B/C` → `RouteA`/`RouteB`/`RouteC` | Registered route-label constants; **also** concept vocabulary (see C); generic single-token shapes (`RouteA`) risk false positives if forbidden | 0 occurrences anywhere (registered proactively) | Keep registered as `STAGE0_ROUTE_A/B/C`; import from `config/constants.ts` when future code needs a route label; **never** forbid |

---

## C. Glossary / concept vocabulary candidates

Project **concepts** (not machine constants). These belong in `.claude/glossary.md`, defined as
concepts only and authorizing no execution. Do **not** silently convert these into constants.

| Candidate label | Reason | Evidence count | Existing glossary coverage | Recommended handling | Helen approval required |
|---|---:|---|---|---|---|
| `Stage0` | Core project concept (the auth/credential investigation stage) | 315 (`Stage0`) / 893 (`STAGE0`) | ✅ CONFIRMED | No change (covered) | No |
| Route A / Route B / Route C | Correction/diagnostic route concepts | 0 (token form) | ✅ all CONFIRMED (Route C status softened in PR #296) | No change (covered) | No |
| Option A / Option B / Option C | Credential/custody option concepts | recurring in docs | ✅ all CONFIRMED | No change (covered) | No |
| `auth_or_credential` | Stage 0 failure-class concept | recurring in docs | ✅ CONFIRMED | No change (covered) | No |
| `role_missing_or_not_login` | Route A classifier result concept | recurring in docs | ✅ CONFIRMED | No change (covered) | No |
| `HELEN GO` | Human authorization-gate concept | recurring in docs | ✅ CONFIRMED | No change (covered) | No |
| `run-lock` | Single-run mutual-exclusion concept | recurring in docs | ✅ CONFIRMED (concept); canonical **path** PENDING | Keep concept; resolve canonical path separately | Yes (path only) |
| `customer output` | Customer-facing output boundary concept | recurring in docs | ✅ CONFIRMED | No change (covered) | No |
| `Lane A/B` | Processing-lane concept | recurring in docs | ⚠️ PENDING_HELEN_REVIEW (A-vs-B semantics not safely known) | Leave PENDING until Helen confirms semantics | Yes |
| `AMS runtime` | Runtime concept | recurring in docs | ⚠️ PENDING_HELEN_REVIEW (acronym/definition not safely known) | Leave PENDING until Helen confirms | Yes |
| **New uncovered terms:** `Step2E`, `Gate 4E`/`Gate 4F`, `RB-ROTATE`, `production parameter registry`, `Option A binding/auth preflight` | Recurring project-process vocabulary seen across docs (inventory §5) not yet in glossary | recurring in docs | ❌ not in glossary | `PENDING_HELEN_REVIEW` — propose for a future glossary follow-up; do **not** add in this PR | Yes |

---

## D. Ignore / historical-only / false positive

Generic, fixture, example, or historical strings that should **not** be promoted to canonical
status and should **not** enter the guardrail.

| Candidate label | Reason | Evidence count | Recommended action |
|---|---:|---|---|
| `https?://` URLs | Mostly generic links, doc examples, and placeholder URLs; no canonical production/canary URL set established | 591 hits / 64 files | **No action** now; a canonical URL set is `PENDING_HELEN_REVIEW` in the inventory — do not register from guesses |
| `localhost` / `127.0.0.1` / port-shaped `:[0-9]{3,5}` | Test fixtures and doc examples; production host/port are **custody-only** and must never be hard-coded | `localhost` 40, `127.0.0.1` 77, ports 200 | **No action** — never hard-code production host/port; leave fixtures as-is |
| `5432` (default PG port) | Appears only as a **negative "do not assume"** example in docs | included in port count above | **No action** — keep as negative example; do not register |
| `postgres://` / `postgresql://` strings | Placeholder/shape-only DSNs in docs + local test DSNs; never canonical; never copied | 81 occ / 47 files (see safety review) | **No action** / inventory-only; never promote, never forbid, never reproduce |
| Historical PR evidence / superseded names (e.g. RB-ROTATE evidence trails, deep-research report files) | Point-in-time evidence/prose; not canonical vocabulary or constants | docs-dominant | **No action** — historical record; leave untouched |

---

## DSN / connection-string safety review

Counts and file-path distribution only, taken verbatim from inventory §6.1. **No raw DSN line,
host, port, username, password, or `postgres://` value is reproduced here.**

| metric | value |
|---|---:|
| files containing a `postgres(ql)://` string (`*.ts/*.js/*.md/*.json`) | 47 |
| total occurrences | 81 |
| of which in `docs/` (prose / evidence) | 36 files |
| of which in `tests/` | 11 files |
| in source/test code globs (`*.ts/...`) | 12 files |

- Classification: **docs/test** dominant. Most are placeholder/shape-only DSNs in docs; some are
  local test DSNs in fixtures.
- Recommended handling: **inventory-only; never a guardrail fail condition; never promoted to a
  constant; never reproduced.** Whether any DSN handling belongs behind a constant vs. custody is
  `PENDING_HELEN_REVIEW` (inventory §6) — **no change in this PR.**

---

## Recommended follow-up PR sequence

Small, single-purpose PRs only — none of these are performed here:

1. **(A, conditional)** If and only if source code develops a real need for the Stage 0 runner
   **custody file path**, add that one path constant to `config/constants.ts` + `.claude/constants.md`.
   Do not pre-emptively promote. `PENDING_HELEN_REVIEW`.
2. **(Guardrail)** Add to `scripts/check-no-raw-constants.mjs` **only** A-class values that are
   project-unique, non-secret, low-frequency, and near-zero false-positive. On current evidence
   **no new literal qualifies** beyond the four already enforced — so this step is likely a
   **no-op** until a new qualifying A literal appears. Never add `DATABASE_URL`, `STAGE0_RUNNER_DSN`,
   `APP_DSN`, `ADMIN_DSN`, generic `*_DSN`, `RouteA/B/C`, or `Stage0`.
3. **(C, after Helen approval)** Update `.claude/glossary.md` only for C-class concepts that are
   currently uncovered or PENDING (`Lane A/B`, `AMS runtime`, and the new terms `Step2E`,
   `Gate 4E/4F`, `RB-ROTATE`, `production parameter registry`, `Option A binding/auth preflight`),
   defined as concepts only, authorizing no execution. Mark Superseded, never silently rewrite.
4. **(B)** Leave all B-class values as **registered-but-not-forbidden**. Confirm canonical
   `APP_DSN`/`ADMIN_DSN`/`RUNNER_DSN` naming with Helen before registering any name; never forbid.
5. **(D)** Do nothing for D-class items (URLs, localhost/ports, `5432`, placeholder/test DSNs,
   historical evidence).

---

## PENDING_HELEN_REVIEW items (consolidated)

- **A:** Stage 0 runner custody **file path** — register only on real code need.
- **B:** canonical `APP_DSN` / `ADMIN_DSN` / `RUNNER_DSN` naming set.
- **C:** `Lane A/B` semantics; `AMS runtime` definition; new terms `Step2E`, `Gate 4E/4F`,
  `RB-ROTATE`, `production parameter registry`, `Option A binding/auth preflight`; canonical
  `run-lock` path.
- **D / inventory-only:** canonical URL set; canonical ports / whether any host:port belongs in
  code; DSN-vs-custody handling decision.

---

## Explicit statements

- **Files changed by this PR:** `docs/config-constants-candidate-triage.md` (this file) only.
  **No** change to source code, `config/constants.ts`, `.claude/constants.md`, `.claude/glossary.md`,
  `scripts/check-no-raw-constants.mjs`, `package.json`, or `CLAUDE.md`.
- **No enforcement change:** no forbidden literal added or removed; `npm run check:constants`
  behavior is unchanged (still the four project-unique literals, source-code scope).
- **No runtime behavior changed:** no schema/migration/deploy/env/secret change; **no** production
  command, SQL, psql, Stage 0, worker, extractor, Lane/scoring, AMS runtime, or customer-output
  action was performed.
- **Secret safety:** **no** DSN value, `postgres://` string, host, port, username, password,
  token, or connection component was printed, copied, or stored. DSN findings are counts +
  file-distribution + docs/test/source classification only.
- **Concept/constant boundary preserved:** no concept term was silently converted into a constant
  and no constant was silently converted into a glossary term; the registry and glossary are
  unmodified by this PR.
