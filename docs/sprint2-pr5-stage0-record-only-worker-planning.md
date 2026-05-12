# Sprint 2 PR#5 — Stage 0 RECORD_ONLY downstream worker — planning

**Status.** PLANNING ONLY. Helen sign-off required before any
implementation begins. No code, no migration, no `schema.sql` change,
no DB touch, no `psql`, no `package.json` change, no collector / app /
server / auth change. PR#1 / PR#2 / PR#3 / PR#4 implementation files
referenced read-only. Track A `ams-qa-behaviour-tests/lib/*` files
read for reference only — NOT vendored or copied in this planning
round.

**Date.** 2026-05-12. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited (gate-keeper).

**Authority (verbatim quotes in §3 below).**

- `docs/architecture/ARCHITECTURE_GATE_A0.md` (committed at `a87eb05`) §K row PR#5 + §0.6 P-8 / P-9 / P-11 + §I.5 vendor-audit checklist + §H AMS coverage table
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules A / B / C / D / E + §11 (out-of-scope-for-Sprint-2)
- `scoring/version.yml` (`scoring_version: s2.v1.0`; `status: record_only`; `automated_action_enabled: false`)
- `scoring/reason_code_dictionary.yml` (`rc-v0.1`)
- `scoring/forbidden_codes.yml` (`forbidden-v0.1`)
- `docs/sprint2-pr3-scoring-output-contracts-planning.md`, `docs/sprint2-pr3-scoring-output-contracts.md`
- `docs/sprint2-pr4-scoring-contract-loader-planning.md`, `docs/sprint2-pr4-scoring-contract-loader.md`
- `src/scoring/contracts.ts`, `tests/v1/scoring-contracts.test.ts`
- Read-only reference: `/Users/admin/github/ams-qa-behaviour-tests/lib/stage0-hard-exclusion.js` (215 lines, 7 RULES, 30 unit tests). **Not vendored in this planning round.**

**Prior closed commits.**

| PR | Title | Commit |
| --- | --- | --- |
| A0 | Architecture gate | `a87eb05` |
| PR#0 | Sprint 2 contracts (signal-truth + dictionary + forbidden + version + CF-1/CF-2/CF-3) | `d4cc2bf` |
| PR#1 | `session_behavioural_features_v0_2` extractor | `bea880d` |
| PR#2 | refresh-loop server-side derivation (v0.3) | `3d88177` |
| PR#3 | Lane A / Lane B scoring output contract layer | `4318e02` |
| PR#4 | scoring contract loader / startup guard | `cc2ae4c` |

PR#5 implementation has **not** started. PR#3 Hetzner staging proof
PASS; PR#4 lightweight npm-only proof PASS. No Render production
touched.

---

## §1 Executive summary

### What PR#5 IS (per A0 §K)

PR#5 is the **Stage 0 RECORD_ONLY downstream worker**. It vendors the
canonical pure-function library `lib/stage0-hard-exclusion.js` from
Track A (`ams-qa-behaviour-tests`), applies the **bytespider taxonomy
move** (P-11), and writes one row per Stage-0 evaluation to a **new
table named `stage0_decisions`** (RECORD_ONLY).

### What PR#5 is NOT

- **NOT** a writer to `scoring_output_lane_a` or `scoring_output_lane_b`.
  A0 §K specifies `stage0_decisions` as the destination — **a new
  table, distinct from PR#3's Lane A / Lane B**. The "verification_score
  schema tension" the user's brief raised in §11 dissolves under the
  correct A0 reading: PR#5 does NOT have to satisfy Lane A's
  `verification_score INT NOT NULL CHECK (BETWEEN 0 AND 99)` constraint
  because it does not write to Lane A.
- **NOT** a Lane B observer / writer. Lane B emission of
  `B_DECLARED_AI_CRAWLER` / `B_SIGNED_AGENT` remains in deferred PR#3b.
  Even though P-11 requires "route known AI/search crawlers to Lane B
  instead of Stage 0 exclusion", the *Lane B writer* itself is
  out-of-scope for PR#5 — PR#5 only ships the *Stage-0-exclusion-side*
  reclassification (remove `bytespider` et al. from the Stage 0
  exclusion set; mark them as "not hard-excluded" so a later PR#3b can
  observe them on the Lane B side).
- **NOT** a Stage 1 scorer. Stage 1 / Lane A behavioural rubric is
  PR#6's job. PR#5 must not absorb Stage 1 logic.
- **NOT** a router. The deferred PR#3b router (A0 §D step 6) is the
  router seat.
- **NOT** a `false_positive_review` queue (PR#7) writer.
- **NOT** an observe surface (PR#9's `observe:behaviour` is later).
- **NOT** a customer-facing surface. Stage 0 decisions are
  internal RECORD_ONLY artefacts; no dashboard, no report, no view.
- **NOT** a collector / app / server / auth change.

### Does PR#5 write rows?

**Yes** — to `stage0_decisions` (record-only). One row per
Stage-0-evaluated session (or per evaluation event; OD-2). PR#5 ships
the first writer in the Sprint 2 scorer chain, but the writer's
target is **not** Lane A.

### Does PR#5 emit reason codes?

**Open decision (OD-3).** A0 says "writes stage0_decisions
(record-only)" — neutral about whether each row carries a `reason_codes
JSONB` array (post-PR#3 contract shape) or a Stage-0-specific
`rule_id` enum from the vendored lib's `RULES` constant. Two
defensible reads:

- **(α) Reason-code reuse.** Stage 0 rules emit codes from
  `reason_code_dictionary.yml`. If so: PR#5 must call PR#4's
  `assertRuleReferencesOrThrow(c, [...])` at startup with the full
  Stage-0 reason-code list. The dictionary currently has `A_*` codes
  but no obvious mapping for Stage 0's "wp-admin probe path" / "20+
  req/s same browser" rules.
- **(β) Stage-0-specific rule_id enum.** Stage 0 has its own internal
  rule ID enum (e.g. `STAGE0_PROBE_PATH`, `STAGE0_HIGH_VOLUME_REQS`,
  `STAGE0_BOT_UA_FAMILY`), distinct from the dictionary's reason codes.
  PR#4's reason-code guard does not apply to Stage 0; the validator
  is a Stage-0 lib startup check.

Helen's choice. The conservative read is **(β)** — Stage 0 is a
*deterministic exclusion gate*, not a *reason-code-emitting scorer*.
Reason-codes are for Stage 1 (PR#6). See OD-3 + §9.

### Does PR#5 call PR#4's `assertScoringContractsOrThrow`?

**Yes, recommended** — at worker boot, regardless of the (α)/(β) choice
above. Even under (β), the worker still loads `scoring/version.yml` and
asserts `status === 'record_only'` and `automated_action_enabled === false`
before writing any `stage0_decisions` row. This is Hard Rule C/D
defence-in-depth.

### GO / NO-GO recommendation

**NO-GO until P-9 + P-11 + OD-1..OD-9 below are resolved.** P-9 (`git
init` on `ams-qa-behaviour-tests`) is **still unresolved** in this
working tree — `/Users/admin/github/ams-qa-behaviour-tests` returns
`fatal: not a git repository`. Helen-approved default per A0 §0.6 is
"Yes — initialise repo, commit current state as `v0.2.0` baseline",
but the actual `git init` has not happened. Without a pinned source
hash, PR#5 cannot vendor reproducibly. **Implementation is blocked
until P-9 is executed by the operator and Helen signs OD-1..OD-9.**

---

## §2 What this planning round produces

One file:

```
docs/sprint2-pr5-stage0-record-only-worker-planning.md   (this document)
```

Nothing else. No code, no migration, no `schema.sql` change, no test
file, no fixture, no `package.json` change, no DB action, no Track A
modification.

---

## §3 A0 alignment

### §3.1 A0 §K row PR#5 — verbatim

> | **PR#5** | Stage 0 RECORD_ONLY downstream worker | Vendor
> `lib/stage0-hard-exclusion.js` + bytespider taxonomy move; writes
> `stage0_decisions` (record-only) | new table | pure (130 vendored
> tests) + dbtest | **no** |

Columns: PR / Title / Scope / Migrations / Tests / Touches collector?

**Interpretation.**

- **Title:** "Stage 0 RECORD_ONLY downstream worker."
- **Scope:** (a) vendor `lib/stage0-hard-exclusion.js` from Track A
  (pure-function lib); (b) apply the bytespider taxonomy move (P-11);
  (c) write `stage0_decisions` rows in RECORD_ONLY mode.
- **Migrations:** "new table" — PR#5 adds a new migration creating
  `stage0_decisions`. Distinct from PR#3's Lane tables.
- **Tests:** "pure (130 vendored tests) + dbtest". The 130-test
  count is the Track A vendored-library test count (per A0 §B.3 line
  170). PR#5 also adds DB tests for the writer.
- **Touches collector:** **no**. `src/collector/v1/**`, `src/app.ts`,
  `src/server.ts`, `src/auth/**` are not modified.

### §3.2 A0 §0.6 P-decisions binding PR#5 — verbatim

> | **P-8** | v1 scorer: scorecard-only, or scorecard + shadow
> lightweight model challenger? | **Scorecard + calibrated thresholds;
> defer shadow-challenger to Sprint 5** (matches Sprint 5 research
> recommendation). | Non-blocking for Sprint 2 PR#5/PR#6; blocking for
> Sprint 5 PR#1 | Sprint 5 PR#1 |

> | **P-9** | `git init` on `ams-qa-behaviour-tests`? | **Yes —
> initialise repo, commit current state as `v0.2.0` baseline before
> vendor-copy into Sprint 2 PR#5.** | Blocking for Sprint 2 PR#5 |
> Sprint 2 PR#5 |

> | **P-11** | Should Bytespider and similar known AI / search
> crawlers be moved out of Stage 0 high-confidence bad-bot exclusion
> into Lane B / crawler taxonomy? | **Yes.** Known AI / search
> crawlers (Bytespider, GPTBot, ClaudeBot, Perplexity-User, CCBot,
> Googlebot, Bingbot, etc.) **must not** be classified as Stage 0
> high-confidence bad-bot exclusions. They belong in **Lane B / crawler
> taxonomy** (or a neutral crawler taxonomy lane) before any UA-based
> exclusion is productionised. Track A's current `KNOWN_BOT_UA_FAMILIES`
> list lumps `bytespider` alongside automation tools (curl, wget) and
> headless browsers — that classification is wrong for v1 and must be
> rewritten as part of Sprint 2 PR#5. | **Blocking for Sprint 2 PR#5
> Stage 0 productionisation** | Sprint 2 PR#5; any UA-family
> high-confidence exclusion code path |

P-11 detail (A0 §P): the vendor-copy MUST:

> (a) remove `bytespider` from `KNOWN_BOT_UA_FAMILIES`, (b)
> reclassify any other known good-AI/search crawler entries into a
> separate `KNOWN_AI_CRAWLER_UA_FAMILIES` set that flows into Lane B
> (not Stage 0 exclusion), (c) preserve true bad-actor entries (e.g.
> `curl`, `wget`, `python_requests`, `headless_chrome` for unattributed
> automation) in the Stage 0 exclusion set. The vendored library's
> tests must verify that AI-crawler UAs do **not** trigger Stage 0
> exclusion.

### §3.3 A0 §I.5 vendor-audit checklist — verbatim

> **RECOMMENDATION — audit checklist when vendoring Stage 0/1 libs
> into Sprint 2 PR#5.**
>
> 1. The vendored lib files (only `stage0-hard-exclusion.js` +
>    `stage1-behaviour-score.js` + their fixtures) must be examined for
>    any string containing `qa`, `test`, `synthetic`, `bot_label`,
>    `adversary`, `behaviour_qa`, `ams_qa`, `bad_traffic_qa`,
>    `fixture`, `profile_name`.
> 3. **Bytespider** must be moved from `KNOWN_BOT_UA_FAMILIES` (Stage 0
>    high-confidence exclusion) into a new **AI-agent taxonomy** field
>    on `session_features` or sibling. ByteDance's AI crawler is
>    "good-AI" by the user definition; classifying it as bad-bot is
>    wrong.

### §3.4 A0 §D end-to-end workflow — Stage 0 / PR#5 absence

A0 §D's twenty-one numbered workflow steps reference Sprint 3 PR#5
(state router) and Sprint 5 PR#3/PR#5 (improvement records / insight
library) but contain **no Sprint 2 PR#5 entry**. Stage 0's place in
the workflow is implicit (before Stage 1 in step 7, which is Sprint 2
PR#6). The authoritative A0 spec for Sprint 2 PR#5 is therefore §K row
+ §0.6 P-9/P-11 + §I.5 vendor-audit checklist.

### §3.5 Internal A0 tensions surfaced

**Tension A — destination table.** A0 §K is unambiguous: PR#5 writes
`stage0_decisions`, **not** `scoring_output_lane_a`. The user's
planning brief floated the possibility that PR#5 writes Lane A; A0
rules that out. **Recommended interpretation:** PR#5 introduces its
own narrow `stage0_decisions` table; Lane A / Lane B remain owned by
PR#6 and the deferred PR#3b. Schema tension (verification_score NOT
NULL on Lane A) dissolves.

**Tension B — Lane B routing for AI crawlers (P-11) when Lane B
writer is deferred.** A0 §0.6 P-11 says AI-crawler UAs "belong in
Lane B / crawler taxonomy" — but the Lane B *writer* is the deferred
PR#3b observer (out of PR#5 scope). Conservative resolution: **PR#5
ships only the Stage-0-side reclassification** (remove the AI-crawler
UA families from the Stage-0 hard-exclusion set so they pass through
to Stage 1 / future Lane B). The classification list is data inside
the PR#5 module. The *Lane B writer* that would `INSERT INTO
scoring_output_lane_b ('B_DECLARED_AI_CRAWLER', ...)` does **not**
ship in PR#5. The PR#3 hard boundary "no Lane B writer" remains
intact.

**Tension C — reason-code emission vs Stage 0's `RULES`.** A0 says
"reason_codes JSONB" on PR#3 Lane A. Stage 0's vendored lib does not
emit those codes; it emits its own deterministic rule IDs (e.g.
`probe_path`, `high_volume_reqs`). Treating Stage 0 outputs as
"reason codes" would force them into `reason_code_dictionary.yml`
(currently A_*/B_*/REVIEW_*/OBS_* only). **Recommended
interpretation:** Stage 0 emits a Stage-0-specific `rule_id` enum on
`stage0_decisions`; reason codes are reserved for Stage 1 / Lane A
(PR#6). See OD-3.

**Tension D — UA family signal lives on `ingest_requests`, not
`accepted_events`.** The vendored Stage 0 lib expects a
"normalised UA family label" (e.g. `bytespider`, `curl`,
`headless_chrome`) in its input evidence. BuyerRecon currently stores
the *raw* User-Agent on `ingest_requests.user_agent` (per
`src/db/schema.sql:13`), not on `accepted_events`, and does **not**
yet derive a UA family. **Recommended interpretation:** PR#5 either
(a) reads `ingest_requests.user_agent` via the `request_id`
correlation that PR#10 already records, or (b) defers UA-based Stage 0
rules until a separate `ua_family` derivation lands. Path (a) is
in-scope for PR#5; path (b) postpones UA rules and ships only the
non-UA Stage 0 rules (probe paths, high-volume request signals, etc.).
See OD-4.

---

## §4 Current foundation from PR#1..PR#4

### §4.1 PR#1 / PR#2 — factual layer

- Table: `session_behavioural_features_v0_2`.
- Feature version: `behavioural-features-v0.3`.
- New PR#2 fields: `refresh_loop_candidate` (BOOLEAN factual, NOT a
  judgement), `refresh_loop_count`, `same_path_repeat_count`,
  `same_path_repeat_max_span_ms`, `same_path_repeat_min_delta_ms`,
  `same_path_repeat_median_delta_ms`, `repeat_pageview_candidate_count`,
  `refresh_loop_source` (`'server_derived'`).
- No scoring. No `evidence_band`. No `action_recommendation`. No
  `reason_codes`. No `verification_score`.
- These are PR#5's likely *factual inputs* if PR#5 reads anything
  beyond raw `accepted_events`.

### §4.2 PR#3 — Lane A / Lane B contract layer

- Tables: `scoring_output_lane_a`, `scoring_output_lane_b`.
- Role boundaries (`buyerrecon_customer_api` zero SELECT on Lane B —
  Hard Rule I; OD-7 zero direct SELECT on Lane A too).
- CI SQL linter for Hard Rule H (no JOIN across lanes; CTE-aliased
  variants covered by the conservative detector).
- Migration 011 applied on Hetzner staging; 0 rows on both lanes.
- **No writer shipped yet.** PR#5 does **not** become the Lane A
  writer (per §3.5 Tension A).

### §4.3 PR#4 — scoring contract loader / startup guard

- Module: `src/scoring/contracts.ts`. Pure; no DB; no HTTP.
- Exports: `loadScoringContracts`, `validateScoringContracts`,
  `assertScoringContractsOrThrow`, `isReasonCodeStructurallyAllowed`,
  `assertReasonCodeStructurallyAllowed`, `validateRuleReferences`,
  `assertRuleReferencesOrThrow`, `checkActiveScoringSourceAgainstForbiddenPatterns`,
  `assertActiveScoringSourceCleanOrThrow`.
- CLI: `scripts/check-scoring-contracts.ts` / `npm run check:scoring-contracts`.
- **B_* codes are structurally validated only.** PR#4 does NOT
  authorise Lane B emission (OD-4 of PR#4).
- **Activation-flag detection by prefix family** (`customer_facing_*`,
  `live_*`, `production_*`, `enabled_for_*`) + exact `action_enabled`.
  If PR#5's worker accidentally introduces such a flag set to `true`,
  the loader fails fast at startup.

### §4.4 What PR#5 may rely on

- PR#4's `assertScoringContractsOrThrow()` returns a typed
  `ScoringContracts` handle. PR#5 calls this at worker boot.
- PR#4's `validateRuleReferences(c, refs)` is the right seat for
  declaring "the set of reason codes this scorer may emit" — IF PR#5
  chooses option (α) in §1. Under option (β) (recommended), PR#5
  exposes a separate Stage-0 rule_id enum and does not pass it through
  this function.
- PR#4 already loads `scoring/version.yml` — PR#5 inherits the
  `record_only` / `automated_action_enabled: false` guarantee.

---

## §5 Proposed PR#5 scope options

Four options scored across six criteria. Higher = better.

| Criterion / Option | **A — recommended** | B | C | D |
| --- | --- | --- | --- | --- |
| **A0 alignment** | 5/5 — matches §K row exactly: vendor + bytespider move + writes `stage0_decisions` | 3/5 — vendor lib + dry-run report; defers writer but A0 says "writes stage0_decisions" | 2/5 — bundles full crawler taxonomy beyond P-11's minimum | 1/5 — bundles Stage 1, contradicts §K splitting PR#5 / PR#6 |
| **Risk** | 4/5 — writer is internal-only `stage0_decisions`; no customer-facing surface | 5/5 — no writer; safest possible | 3/5 — taxonomy work expands surface | 1/5 — Stage 1 calibration risk; FP queue not yet shipped |
| **Testability** | 5/5 — 130 vendored Track A tests + new DB tests; pure-function lib | 5/5 — dry-run report easy to test | 4/5 — taxonomy tests well-bounded | 3/5 — Stage 1 needs replay-determinism harness (PR#10) |
| **Scope size** | 4/5 — well-bounded single worker + single migration | 5/5 — smaller (no migration) | 3/5 — larger (taxonomy + worker) | 1/5 — too large for one PR |
| **Impact on PR#6 / PR#7** | 5/5 — PR#6 reads `stage0_decisions` to skip already-excluded sessions; PR#7 unaffected | 3/5 — PR#6 cannot read Stage 0 facts yet | 4/5 — PR#6 may read Lane B classifications | 2/5 — collapses PR#6 work into PR#5 |
| **Production safety** | 5/5 — RECORD_ONLY; new dedicated table; no Lane A writer; no Lane B writer; no Render production | 5/5 — even safer; no DB writes | 4/5 — added taxonomy surface | 3/5 — Stage 1 ships before FP queue; review backlog risk |
| **Total** | **28/30** | 26/30 | 20/30 | 11/30 |

**Option A — recommended.** Stage 0 RECORD_ONLY worker writes
`stage0_decisions` rows, guarded by PR#4's startup contract check,
applies the P-11 bytespider taxonomy move on the *exclusion-side
only* (no Lane B writer), reads factual inputs (`accepted_events`
and/or `ingest_requests.user_agent` by request_id correlation), and
ships its own narrow new table + new migration.

**Option B — dry-run only.** Vendor the lib, compute candidates, log
the would-be decisions to stderr / file, do not write to DB. Strictly
safer; but A0 §K says "writes `stage0_decisions` (record-only)" —
deferring the writer to a follow-up PR contradicts A0 wording.
Possible OD if Helen wants to ship dry-run-only first; otherwise
Option A wins.

**Option C — Stage 0 + full crawler taxonomy.** Reject for v1 scope.
P-11 requires *removing* AI crawlers from the Stage 0 exclusion list;
a *full* AI-crawler taxonomy (route to Lane B + add `KNOWN_AI_CRAWLER_UA_FAMILIES`
set + ship Lane B writer) bundles too much into PR#5. Deferred to
PR#3b. PR#5 ships only the *minimum* taxonomy work: a passive
classification list, no Lane B INSERT.

**Option D — Stage 0 + Stage 1.** Reject. A0 §K explicitly separates
PR#5 (Stage 0) and PR#6 (Stage 1).

**Recommended option:** **A**, with the following constraints
documented in §6.

---

## §6 Recommended conservative PR#5 scope

### §6.1 Files (proposed; not yet created)

| File | Type | Purpose |
| --- | --- | --- |
| `src/scoring/stage0/hard-exclusion.ts` | new | TypeScript port of Track A `lib/stage0-hard-exclusion.js` (vendored from a pinned `v0.2.0` source hash per P-9). Pure-function: no DB writes, no HTTP, no live URLs. Bytespider et al. removed from `KNOWN_BOT_UA_FAMILIES` per P-11; new `KNOWN_AI_CRAWLER_UA_FAMILIES` set declared but NOT routed to Lane B writer (PR#5 ships no Lane B writer). |
| `src/scoring/stage0/index.ts` | new | Worker entry: `runStage0Worker(opts)` reads candidate sessions from factual tables, evaluates each via the pure lib, writes one `stage0_decisions` row per session (RECORD_ONLY). Calls PR#4's `assertScoringContractsOrThrow()` at start. |
| `scripts/run-stage0-worker.ts` | new | Thin CLI runner; `npm run stage0:run`. |
| `migrations/012_stage0_decisions.sql` | new | `CREATE TABLE IF NOT EXISTS stage0_decisions (...)`. New table only. No change to PR#3 Lane tables. Role grants: `buyerrecon_scoring_worker` SELECT+INSERT+UPDATE; `buyerrecon_internal_readonly` SELECT; `buyerrecon_customer_api` zero direct SELECT (mirrors PR#3 OD-7). |
| `src/db/schema.sql` | modified | Append-only mirror of the new table. |
| `tests/v1/scoring/stage0/hard-exclusion.test.ts` | new | 30+ pure tests (parity with Track A's 30 vendored tests plus PR#5-specific assertions). |
| `tests/v1/db/stage0-worker.dbtest.ts` | new | DB tests against local test DB. |
| `tests/v1/db/_setup.ts` | modified | Apply migration 012 idempotently in bootstrap. |
| `docs/sql/verification/12_stage0_decisions_invariants.sql` | new | Read-only invariant SQL parallel to PR#3's `10_*.sql` / `11_*.sql`. |
| `docs/sprint2-pr5-stage0-record-only-worker.md` | new | Implementation summary. |
| `package.json` | modified | Add `stage0:run` script (no new dependency expected). |

### §6.2 Does PR#5 write to `scoring_output_lane_a`?

**No.** PR#5 writes to `stage0_decisions` only. Lane A is PR#6
territory. The PR#3 schema tension dissolves.

### §6.3 Reason-code namespace allowed

**None** (recommended option (β) — see OD-3). PR#5's
`stage0_decisions` carries `rule_id TEXT` from a Stage-0-specific enum
(`probe_path`, `high_volume_reqs`, `bot_ua_family`, `path_loop`,
`forbidden_token`, `non_browser_runtime`, `webdriver_flag`). The
enum is declared in `src/scoring/stage0/hard-exclusion.ts` and
asserted at worker startup. PR#5 emits NO `A_*` / `B_*` / `REVIEW_*` /
`OBS_*` / `UX_*` code into the dictionary's namespace.

If Helen chooses option (α) instead (Stage 0 emits reason codes),
PR#5 calls `assertRuleReferencesOrThrow(c, STAGE0_REASON_CODES)` at
boot. Currently the dictionary has no Stage-0-shaped codes; option
(α) requires adding them to `reason_code_dictionary.yml` first, which
is a PR#0 amendment — out of scope for PR#5.

### §6.4 Input tables (read-only)

Default v1 input set (post-Codex BLOCKER fix; OD-12):

- `accepted_events` (PR#10 ledger; read-only). The primary input.
- `ingest_requests` (PR#10; for `user_agent` via `request_id`
  correlation; read-only). See §3.5 Tension D. **The raw UA is
  read transiently in worker memory only — never persisted**; see
  §6.6 minimization rule.
- `scoring/version.yml`, `scoring/reason_code_dictionary.yml`,
  `scoring/forbidden_codes.yml` via PR#4's loader (no direct fs read).

**NOT read by PR#5 in v1 default:**

- `session_features` (PR#11) — Stage 1 territory; mixing in
  buyer-motion aggregation contaminates Stage 0's deterministic gate.
- `session_behavioural_features_v0_2` (PR#1 + PR#2) — same reason;
  refresh-loop fields are Stage 1 signals.
- `scoring_output_lane_a`, `scoring_output_lane_b`, `rejected_events`,
  `site_write_tokens`, `token_hash`, `ip_hash`, peppers, raw bearer
  tokens, raw `Authorization` headers, raw request bodies.

Unlocking `session_features` or `session_behavioural_features_v0_2`
as Stage 0 inputs requires explicit Helen sign-off (OD-4 + OD-12).

### §6.5 Output fields populated (proposed `stage0_decisions` schema)

```sql
CREATE TABLE IF NOT EXISTS stage0_decisions (
  stage0_decision_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          TEXT         NOT NULL,
  site_id               TEXT         NOT NULL,
  session_id            TEXT         NOT NULL,
  stage0_version        TEXT         NOT NULL,        -- e.g. 'stage0-hard-exclusion-v0.2'
  scoring_version       TEXT         NOT NULL,        -- mirrored from scoring/version.yml
  excluded              BOOLEAN      NOT NULL,        -- true iff any RULE fired
  rule_id               TEXT,                         -- Stage-0 enum; NULL when excluded=false
  rule_inputs           JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- evidence snapshot for the rule
  evidence_refs         JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- array of {table, primary_key}
  record_only           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT stage0_decisions_rule_inputs_is_object
    CHECK (jsonb_typeof(rule_inputs) = 'object'),
  CONSTRAINT stage0_decisions_evidence_refs_is_array
    CHECK (jsonb_typeof(evidence_refs) = 'array'),
  CONSTRAINT stage0_decisions_rule_id_iff_excluded
    CHECK ((excluded = TRUE AND rule_id IS NOT NULL)
        OR (excluded = FALSE AND rule_id IS NULL)),

  -- Natural key explicitly includes BOTH stage0_version AND
  -- scoring_version. The two versions are independent provenance
  -- axes (Codex BLOCKER fix per OD-10):
  --   * stage0_version  — Stage 0 rule-implementation version
  --                       (e.g. 'stage0-hard-exclusion-v0.2');
  --                       bumps when RULES / KNOWN_BOT_UA_FAMILIES /
  --                       PROBE_PATH_PATTERNS change.
  --   * scoring_version — Sprint 2 contract baseline mirrored from
  --                       scoring/version.yml (e.g. 's2.v1.0');
  --                       bumps when contract artefacts change.
  -- Including both keeps replay/provenance correct: a Stage-0 verdict
  -- for the same session under stage0-v0.2 / s2.v1.0 must NOT merge
  -- with a future verdict under stage0-v0.2 / s2.v1.1.
  CONSTRAINT stage0_decisions_natural_key UNIQUE
    (workspace_id, site_id, session_id, stage0_version, scoring_version)
);
```

Notes:

- No `verification_score` column → no Stage 0 score → no calibration
  burden. PR#6 owns scoring; PR#5 owns deterministic exclusion gate.
- No `evidence_band` column. Bands are Lane-A semantics.
- No `action_recommendation` column. Stage 0 *exclusion* is a
  judgement reserved for future productionisation (gated by P-11
  resolution); PR#5 records the decision but emits NO action.
- No `reason_codes JSONB`. Stage 0 uses its own `rule_id` enum.
- `record_only` defaults TRUE. `automated_action_enabled` is enforced
  via the `version.yml` check at boot.

### §6.6 Persisted-evidence minimization rule (Codex BLOCKER fix)

`stage0_decisions.rule_inputs` is a JSONB object that records the
*normalised* facts a Stage 0 rule fired against. The raw evidence
that produced those facts is read **transiently in worker memory
only** and MUST NEVER be persisted to `rule_inputs` (or any other
column on `stage0_decisions`).

#### §6.6.1 Allowed normalised keys (persisted)

The worker may write the following keys to `rule_inputs`:

| Key | Type | Source | Example |
| --- | --- | --- | --- |
| `user_agent_family` | `string` | derived from `ingest_requests.user_agent` (transient) | `"curl"`, `"headless_chrome"` |
| `matched_family` | `string` | the family that matched a Stage 0 rule | `"python_requests"` |
| `matched_rule_id` | `string` | mirrors the top-level `rule_id` column | `"probe_path"` |
| `ua_source` | `string` | provenance label of where the UA family was derived | `"ingest_requests"` |
| `path_pattern_matched` | `string` | the canonicalised probe path regex that matched | `"/wp-admin\\b"` |
| `events_per_second` | `number` | the rate the rule fired against | `34` |
| `path_loop_count` | `number` | repeat-path count if `path_loop` rule fires | `5` |
| `signal_confidence_bucket` | `string` | optional bucket label | `"high"` |

#### §6.6.2 Forbidden persisted keys (HARD RULE)

`rule_inputs` MUST NEVER contain any of these keys (whether as a
top-level key, a nested key, or a string-encoded value):

- `raw_user_agent`
- `user_agent` (raw form — only `user_agent_family` is allowed)
- `token_hash`
- `ip_hash`
- `pepper`
- `bearer_token`, `bearer`
- `authorization`, `Authorization`
- `raw_payload`, `raw_request_body`, `request_body`
- `canonical_jsonb` (raw)
- `raw_page_url` if the rule only needs the path
- any pepper-derived value
- any value matching a regex in
  `forbidden_codes.yml.string_patterns_blocked_in_code.patterns`

#### §6.6.3 Worker-memory rule

The raw UA string read from `ingest_requests.user_agent` MUST be
discarded after the family-mapping step. The worker MUST NOT log
the raw UA, MUST NOT include it in any error message, and MUST NOT
include it in `evidence_refs` (which points at the *source row*, not
at any raw field value).

#### §6.6.4 Enforcement

- **DB test (§12.2):** After running the worker against a seed that
  carries a real `user_agent` string in `ingest_requests`, the test
  asserts that every `stage0_decisions.rule_inputs` row, when
  serialised to JSON text and parsed, does NOT contain any key from
  §6.6.2 and does NOT contain the raw UA string from the seed as a
  value.
- **Pure test (§12.1):** Static grep of the worker source for
  identifiers from the forbidden list ensures no code path writes
  them to `rule_inputs`.
- **Verification SQL (§13):** `docs/sql/verification/12_*.sql`
  includes a query that walks recent `stage0_decisions` rows and flags
  any row whose `rule_inputs` JSONB contains a forbidden key.

### §6.7 `action_recommendation` = `record_only` invariant

PR#5 does NOT write an `action_recommendation` field on
`stage0_decisions`. The conceptual equivalent ("should this session
be excluded from downstream scoring?") is encoded in the `excluded`
boolean. Even when `excluded = TRUE`, PR#5's downstream consumers
(PR#6, future workers) are RECORD_ONLY in v1 — they may *use* the
Stage 0 verdict to skip already-flagged sessions, but no
customer-visible action follows from a Stage 0 row in v1.

If Helen later wants `stage0_decisions` to carry an explicit
`action_recommendation TEXT CHECK IN ('record_only')`, that becomes
OD-8.

### §6.8 `evidence_band` allowed values

Not applicable. PR#5 emits no band.

### §6.9 No Lane B writes

PR#5 contains no `INSERT INTO scoring_output_lane_b` anywhere. A
pure-test sweep mirrors PR#3 / PR#4's discipline.

### §6.10 No customer-facing API

`buyerrecon_customer_api` has zero direct SELECT on `stage0_decisions`
in migration 012 (mirrors PR#3 OD-7). If Helen later wants a
redacted operator view, that's a separate PR.

### §6.11 No automated action

`automated_action_enabled` MUST remain `false` in `scoring/version.yml`.
PR#5 calls PR#4's `assertScoringContractsOrThrow()` at every worker
boot to guarantee this.

### §6.12 No production path

A0 P-4 still blocks Render production. PR#5 ships local + Hetzner
staging only.

---

## §7 Stage 0 vs Stage 1 boundary

| Surface | Stage 0 (PR#5) | Stage 1 (PR#6) |
| --- | --- | --- |
| **Decision shape** | Boolean exclusion (`excluded: true/false` + `rule_id`) | Continuous score (`verification_score: 0–99`) + `evidence_band ∈ {low, medium}` + `action_recommendation ∈ {record_only, review}` + `reason_codes[]` |
| **Confidence** | HIGH (deterministic; obvious automation, probe paths, malformed runtime) | MEDIUM (behavioural ambiguity; calibrated thresholds) |
| **Inputs** | UA family + probe paths + request rate + nav-anomaly facts | 8 behavioural fields from `session_behavioural_features_v0_2` (PR#1 + PR#2) |
| **Output table** | `stage0_decisions` (new; PR#5) | `scoring_output_lane_a` (PR#3 schema; first writer = PR#6) |
| **Customer-facing?** | No (internal exclusion gate) | Lane A is internal RECORD_ONLY in v1 (Hard Rule B + RECORD_ONLY gate) |
| **`refresh_loop_candidate` use** | NOT a Stage 0 input. Stage 0 is for *obvious automation*; refresh-loop is *behavioural ambiguity* — a Stage 1 signal | Stage 1 input |
| **What it must NOT absorb** | Stage 1 ambiguity scoring; reason_code emission; FP review routing | Stage 0 exclusion (already filtered out before Stage 1) |

**Critical separation principle.** Obvious bots and probe traffic
must not contaminate behavioural scoring. Stage 0 (PR#5) filters
them out *before* Stage 1 (PR#6) sees the session.

---

## §8 Reason-code policy (PR#5)

Per OD-3 recommendation (β), PR#5 does NOT emit reason codes from
`reason_code_dictionary.yml`. The Stage-0 `rule_id` enum is a
separate concept and does not participate in `validateRuleReferences`.

PR#5 still:

1. Calls `assertScoringContractsOrThrow({ rootDir })` at worker boot.
   This proves at startup that `status === 'record_only'`,
   `automated_action_enabled === false`, and all 3 YAML files parse +
   validate. If they don't, the worker refuses to start.
2. Calls `assertActiveScoringSourceCleanOrThrow({ rootDir })` at
   worker boot (defence-in-depth — Step B grep on `src/scoring/**`
   per PR#4 §G.5).
3. Does **NOT** call `assertRuleReferencesOrThrow` (no reason codes
   to validate under option β).

If Helen chooses option (α), the Stage 0 codes are added to
`reason_code_dictionary.yml` (which is a PR#0 amendment, gated under
the contract bump path) and PR#5 calls
`assertRuleReferencesOrThrow(c, STAGE0_CODES)` at boot. **This path
is harder, requires Helen sign-off on a dictionary version bump, and
is NOT recommended for PR#5.**

PR#5 emits **no** `B_*` / `UX_*` / unknown codes. Bytespider et al.
classification lives as a *data list* (`KNOWN_AI_CRAWLER_UA_FAMILIES`)
inside the Stage 0 source — not as an emitted `B_DECLARED_AI_CRAWLER`
code.

---

## §9 Input source policy

| Input | Allowed in PR#5 | Notes |
| --- | --- | --- |
| `accepted_events` | **YES** (read-only) | Required for path / event-rate signals. |
| `accepted_events.raw.event_name` | YES | Event-name dispatch. |
| `accepted_events.raw.page_path` | YES | Probe-path matching. |
| `accepted_events.consent_state` | YES | Stage 0 may use consent presence as a no-bot weak signal (optional). |
| `accepted_events.session_id` | YES (excluding `__server__`) | Same filter as PR#1 / PR#2. |
| `accepted_events.token_hash` / `ip_hash` | **NO** | Privacy boundary; PR#5 must never read these. |
| `accepted_events.raw.user_agent` if present | YES via correlation | If the collector did not extract UA into a dedicated field, PR#5 joins through `ingest_requests` via `request_id`. |
| `ingest_requests.user_agent` | YES (via `request_id` correlation) | Per §3.5 Tension D. |
| `session_features` (PR#11) | **NO** (default v1 — Codex BLOCKER fix per OD-12) | Stage 0 stays close to raw/request evidence; mixing in buyer-motion / session aggregation is a Stage 1 (PR#6) concern. Reading `session_features` is excluded by default and requires explicit Helen approval to unblock. |
| `session_behavioural_features_v0_2` (PR#1 + PR#2) | **NO** (default v1) | Reads default to OFF for the same reason. Refresh-loop fields are Stage 1 signals, not Stage 0 signals. May be unlocked only if a specific Stage 0 rule genuinely requires a factual derived field — captured as OD-4. |
| `scoring_output_lane_a` / `scoring_output_lane_b` (PR#3) | **NO** | PR#5 does not read PR#3's lanes. |
| `stage0_decisions` (PR#5 own) | YES for idempotency check (ON CONFLICT DO UPDATE) | Self-referential, allowed. |
| Track A `ams-qa-behaviour-tests` paths | **NO at runtime** | The vendored lib is a *source-tree copy* of `stage0-hard-exclusion.js` at a pinned hash, not a runtime import. |

**Privacy boundary.** PR#5 never reads `token_hash`, `ip_hash`,
peppers, or any auth secret. The vendored Track A lib's tests already
assert this; PR#5 inherits + re-asserts.

**P-11 boundary.** PR#5 does not build an AI-crawler taxonomy table
on `session_features` or any other table — A0 §I.5 line 3 says
"moved into a new AI-agent taxonomy field on `session_features` or
sibling" but that's a *future* table change. For PR#5, the
reclassification lives as a *data list* in source (the
`KNOWN_AI_CRAWLER_UA_FAMILIES` set) — no schema change to existing
tables. OD-5 captures the choice.

---

## §10 Output policy

PR#5 writes to **`stage0_decisions` only**.

| Output property | Value |
| --- | --- |
| Target table | `stage0_decisions` (NEW; PR#5 migration 012) |
| Lane A writes | NONE |
| Lane B writes | NONE |
| Customer API role direct SELECT | revoked (mirrors PR#3 OD-7) |
| Hard Rule H (no cross-lane JOIN) | not applicable — `stage0_decisions` is not a "lane" table, but PR#5's CI lint must NOT introduce JOINs between `stage0_decisions` and `scoring_output_lane_b` either (defence-in-depth) |
| Hard Rule I (customer-API zero SELECT on Lane B) | preserved by PR#3 migration 011; PR#5 does not write to Lane B |
| `record_only` | TRUE by default, NOT NULL |
| `action_recommendation` | not a column on `stage0_decisions` |
| `evidence_band` | not a column |
| `verification_score` | not a column (see §11 schema-tension dissolution) |
| `reason_codes JSONB` | not a column (option β); replaced by `rule_id TEXT` + `rule_inputs JSONB` |
| `evidence_refs JSONB` | array of `{table, primary_key}` references back to factual layer |
| `scoring_version` | mirrored from `scoring/version.yml` (`s2.v1.0`) |
| Natural key | `(workspace_id, site_id, session_id, stage0_version, scoring_version)` — both versions kept independent (OD-10) |
| Idempotent rerun | `ON CONFLICT (workspace_id, site_id, session_id, stage0_version, scoring_version) DO UPDATE` — re-runs under the SAME stage0_version + scoring_version refresh the same row; a change in either version produces a NEW row (replay/provenance preserved) |

---

## §11 Schema tension check (RESOLVED)

The user's planning brief raised a tension: "PR#3 `scoring_output_lane_a`
requires `verification_score INT NOT NULL`; Stage 0 has no
calibrated score." **This tension dissolves under the correct A0
reading** (§3.5 Tension A): PR#5 writes to `stage0_decisions`, NOT to
`scoring_output_lane_a`. `stage0_decisions` has no `verification_score`
column. Lane A's schema is untouched.

If Helen *insists* PR#5 must write Lane A despite A0's explicit
`stage0_decisions` wording, the tension would re-surface. That choice
is recorded as OD-9 (recommended NO).

---

## §12 Test plan

### §12.1 Pure tests (`tests/v1/scoring/stage0/hard-exclusion.test.ts`)

- **Vendored Track A parity (30 tests).** Each Track A test in
  `tests/stage0.test.js` is ported as a TypeScript test against the
  vendored pure-function lib. Per A0 §K row "pure (130 vendored
  tests)" — the 130 count includes both Stage 0 and Stage 1; PR#5
  ships the Stage 0 subset (~30 per Track A docs) plus additional
  PR#5-specific cases.
- **P-11 bytespider reclassification.** Three new tests:
  - `evaluate({deterministic: { userAgentBotFamily: 'bytespider', ... }})` does NOT trigger Stage 0 exclusion.
  - `evaluate({deterministic: { userAgentBotFamily: 'gptbot', ... }})` does NOT trigger Stage 0 exclusion.
  - `evaluate({deterministic: { userAgentBotFamily: 'curl', ... }})` DOES trigger Stage 0 exclusion (bad-actor preserved).
- **Vendor-audit checklist (A0 §I.5).** Pure repo-grep on
  `src/scoring/stage0/**` for forbidden strings: `qa`, `test`,
  `synthetic`, `bot_label`, `adversary`, `behaviour_qa`, `ams_qa`,
  `bad_traffic_qa`, `fixture`, `profile_name`. Each MUST be absent in
  active source (test files allowed; this is a self-referential
  carve-out as established by PR#3 / PR#4).
- **PR#4 startup guard called.** Worker boot calls
  `assertScoringContractsOrThrow()`. Pure-test verifies the worker's
  module imports `src/scoring/contracts.js` and references the
  assertion function.
- **No reason-code emission (under option β).** Pure-test asserts
  `STAGE0_CODES` constant (if exposed) does not intersect with
  `reason_code_dictionary.yml.codes` keys.
- **No Lane B writes.** Pure-test sweeps PR#5 source for `INSERT INTO scoring_output_lane_b` — must be absent.
- **No customer-facing output.** No HTTP route export, no Express
  app import, no `src/app.ts` import.
- **No DB imports in pure lib.** `src/scoring/stage0/hard-exclusion.ts`
  imports only `path` / `fs` if needed for fixture-loading (pure-function library; no `pg`).
- **`stage0_decisions` column references match migration 012.**
  Test parses the migration SQL and compares column list against the
  worker's INSERT column list.

### §12.2 DB tests (`tests/v1/db/stage0-worker.dbtest.ts`)

- **Migration 012 applies idempotently.**
- **Seed factual rows** under `__test_ws_pr5__` boundary (PR#3 / PR#4
  test-boundary discipline).
- **Run worker in RECORD_ONLY.** Worker `runStage0Worker({ ... })`
  inserts `stage0_decisions` rows for the seeded sessions.
- **Assert `record_only = TRUE`.**
- **Assert `excluded`-`rule_id` co-invariant** (CHECK constraint).
- **Assert `scoring_version = 's2.v1.0'`** on every row.
- **Customer-API role zero SELECT** on `stage0_decisions` (mirrors
  Hard Rule I posture from PR#3 §J.2).
- **Source tables unchanged.** `accepted_events` / `rejected_events`
  / `ingest_requests` / `session_features` /
  `session_behavioural_features_v0_2` row counts equal before/after.
- **Idempotent rerun.** Re-running the worker produces the same
  rows (same `stage0_decision_id` via natural-key ON CONFLICT DO
  UPDATE).
- **No Lane A writes.** `scoring_output_lane_a` row count
  unchanged.
- **No Lane B writes.** `scoring_output_lane_b` row count
  unchanged.
- **No cross-lane JOIN** in any PR#5 SQL (PR#3's CI lint already
  covers this; PR#5 adds nothing that would trigger it).
- **Bytespider seed yields `excluded = FALSE`.** Seed a session
  with `user_agent` containing `Bytespider/2.0` and assert the worker
  does not exclude it (P-11 invariant).
- **rule_inputs minimization (Codex BLOCKER fix; §6.6).** After
  running the worker against a seed whose `ingest_requests.user_agent`
  carries a real UA string (e.g. `"Mozilla/5.0 (X11; Linux x86_64) curl/8.0"`),
  the test asserts that every produced `stage0_decisions.rule_inputs`
  row:
  - does NOT contain any of the keys `raw_user_agent`, `user_agent`
    (raw), `token_hash`, `ip_hash`, `pepper`, `bearer_token`, `bearer`,
    `authorization`, `Authorization`, `raw_payload`,
    `raw_request_body`, `request_body`, `canonical_jsonb`,
    `raw_page_url` (top-level or nested);
  - does NOT contain the raw UA string from the seed as any value;
  - MAY contain `user_agent_family` (e.g. `"curl"`),
    `matched_family`, `matched_rule_id`, `ua_source`,
    `path_pattern_matched`, `events_per_second`, `path_loop_count`,
    `signal_confidence_bucket`.
- **Natural key includes scoring_version (Codex BLOCKER fix; OD-10).**
  Insert a Stage 0 verdict at `(workspace_id, site_id, session_id,
  stage0_version='stage0-hard-exclusion-v0.2', scoring_version='s2.v1.0')`.
  Attempt a second insert with the same primary tuple but
  `scoring_version='s2.v1.1'` (synthetic) — must SUCCEED (different
  natural key → new row). Re-insert with identical full key → must
  trigger `ON CONFLICT DO UPDATE` on the original row, not duplicate.
- **`session_features` / `session_behavioural_features_v0_2` not read
  in default v1 (Codex BLOCKER fix; OD-12).** Static-source grep on
  `src/scoring/stage0/**` for `FROM session_features` /
  `FROM session_behavioural_features_v0_2` returns zero matches in
  active code (excluding comments). The default worker path opens no
  such SELECT.

### §12.3 If PR#5 ships without writer (Option B)

Replace §12.2 with pure dry-run tests that capture the would-be
decisions in memory and assert their shape. No DB.

---

## §13 Verification / staging proof plan

### §13.1 If PR#5 writes (Option A — recommended)

| Step | Action |
| --- | --- |
| 1 | Helen `git pull` on Hetzner staging. |
| 2 | Helen `npm install` (no new deps expected, but lockfile may change). |
| 3 | Helen `npm test` — full pure suite green. |
| 4 | Helen `npm run check:scoring-contracts` — PR#4 still PASS. |
| 5 | Helen applies `migrations/012_stage0_decisions.sql` to Hetzner staging only (`psql "$DATABASE_URL" -f migrations/012_*.sql`). Sanity: `DATABASE_URL` host is NOT Render production. |
| 6 | Helen `npm run stage0:run` (worker; bound to a small candidate window via env vars per the PR#1 / PR#2 extractor pattern). |
| 7 | Helen runs `docs/sql/verification/12_stage0_decisions_invariants.sql` against staging. All anomaly queries return 0 rows. |
| 8 | Helen `npm run observe:collector` — PR#12 PASS unchanged. |
| 9 | Helen confirms source-table counts unchanged for `accepted_events` / `rejected_events` / `ingest_requests` / `session_features` / `session_behavioural_features_v0_2` / `scoring_output_lane_a` / `scoring_output_lane_b`. Only `stage0_decisions` may have new rows. |
| 10 | No Render production touched (A0 P-4 still blocking). |

### §13.2 If PR#5 ships without writer (Option B)

Reduced to: `git pull` + `npm install` + `npm test` + `npm run check:scoring-contracts`. No `psql`. No migration. No DB action. Equivalent to PR#4's lightweight proof.

---

## §14 Rollback plan

| Action | Effect |
| --- | --- |
| Revert PR#5 commit (or unstage files) | Removes worker + lib + migration + tests + verification SQL + doc. |
| `package.json` change | One reverted line (the `stage0:run` script). |
| Migration 012 rollback (staging only) | `REVOKE` grants; `DROP TABLE IF EXISTS stage0_decisions` (no CASCADE). |
| Existing `stage0_decisions` rows on staging | Optional cleanup by `workspace_id IN ('__test_ws_pr5__', '<helen_real_test_ws>')` AND `scoring_version='s2.v1.0'`. Safe to discard entirely — `stage0_decisions` is RECORD_ONLY internal. |
| PR#3 Lane A / Lane B tables | Untouched. |
| PR#1 / PR#2 factual tables | Untouched. |
| Render production | Never touched. |

Rollback is data-loss-free for production (no Render writes) and
discardable for staging.

---

## §15 Open decisions for Helen (OD-1..OD-9)

### OD-1 — Writer vs dry-run (Option A vs Option B)

**Recommendation:** Option A. PR#5 writes `stage0_decisions` rows in
RECORD_ONLY mode. Matches A0 §K wording exactly.

**Alternative:** Option B. Defer writer; ship pure lib + dry-run
report. Contradicts A0 §K wording but is strictly safer.

**Helen choice:** A / B.

### OD-2 — Stage 0 verification score: yes/no?

**Recommendation:** **No.** `stage0_decisions` has no
`verification_score` column. Stage 0 is a deterministic gate, not a
calibrated scorer. PR#6 owns scoring.

**Alternative:** Add a synthetic `verification_score INT` of fixed
`0` for excluded sessions and `NULL` for non-excluded — purely so
future PR#6 readers can join on a uniform shape. Adds dead-weight
column. Not recommended.

**Helen choice:** no score (recommended) / synthetic-zero column.

### OD-3 — Reason-code namespace allowed (α vs β)

**Recommendation:** **β.** Stage 0 emits a Stage-0-specific
`rule_id` enum, NOT reason codes from `reason_code_dictionary.yml`.
PR#4's `validateRuleReferences` is not used.

**Alternative:** α — add Stage 0 codes to the dictionary
(`STAGE0_PROBE_PATH`, etc., or rename to fit `A_*` prefix family),
require a `reason_code_dictionary.yml` bump → `rc-v0.2`. Requires
Helen sign-off on a contract version bump and PR#4 re-validation.

**Helen choice:** β (recommended) / α.

### OD-4 — Read accepted_events directly, or only derived layers?

**Recommendation:** Read `accepted_events` directly for path /
event-rate signals. Read `ingest_requests` via `request_id` for
`user_agent` (UA family) until a dedicated UA-family signal lands on
`accepted_events`. Read `session_behavioural_features_v0_2` only if a
specific Stage 0 rule genuinely needs a behavioural aggregate (not the
default).

**Helen choice:** accepted_events + ingest_requests correlation
(recommended) / accepted_events only / derived layers only.

### OD-5 — P-11 AI-crawler classification scope in PR#5

**Recommendation:** Minimum scope. PR#5 ships:

- `KNOWN_AI_CRAWLER_UA_FAMILIES` set (data, in source) listing
  Bytespider, GPTBot, ClaudeBot, Perplexity-User, CCBot, Googlebot,
  Bingbot, DuckDuckBot, PerplexityBot.
- Removal of `bytespider` from `KNOWN_BOT_UA_FAMILIES`
  (Stage 0 hard-exclusion set).
- Tests verify AI-crawler UAs do not trigger Stage 0 exclusion.

PR#5 does NOT ship:

- A new `ai_agent_family` column on `session_features` (deferred to a separate gate).
- A Lane B writer that would `INSERT B_DECLARED_AI_CRAWLER` (deferred to PR#3b).
- A "neutral crawler taxonomy lane" table.

**Helen choice:** minimum scope (recommended) / + new schema column / + Lane B writer.

### OD-6 — Vendor Track A Stage 0 vs write equivalent from contract

**Recommendation:** Vendor. The Track A
`lib/stage0-hard-exclusion.js` (215 lines, 7 RULES, 30 unit tests) is
the canonical reference per A0 §K. Re-implementing from contract risks
divergence. Vendoring requires P-9 (`git init` Track A) first so we
can pin a `v0.2.0` source hash.

**Alternative:** Write a narrow TypeScript equivalent from
signal-truth-v0.1 contract + A0 §0.6 P-11 + the lib's documented
behaviour. Cleaner type story; loses the vendored-tests guarantee.

**Helen choice:** vendor (recommended; requires P-9 first) / write equivalent.

### OD-7 — Staging proof: full DB proof vs npm-only

**Recommendation:** Full DB proof if Option A (writer ships).
Apply migration 012 to Hetzner staging; run worker; inspect rows; run
verification SQL 12; confirm source-table counts unchanged.

**Alternative:** npm-only proof if Option B (no writer) — equivalent
to PR#4's lightweight proof.

**Helen choice:** depends on OD-1.

### OD-8 — `action_recommendation` column on `stage0_decisions`

**Recommendation:** No. `stage0_decisions` does not carry an
`action_recommendation` column. The `excluded` boolean is the only
verdict. Action policy is encoded in
`scoring/version.yml.automated_action_enabled: false`.

**Alternative:** Add `action_recommendation TEXT DEFAULT 'record_only' CHECK IN ('record_only')`
as a Hard Rule B mirror. Adds a single-value column. Belt-and-braces;
not strictly needed.

**Helen choice:** no column (recommended) / Hard-Rule-B mirror column.

### OD-9 — Force PR#5 to write Lane A (override A0)?

**Recommendation:** **No.** A0 §K explicitly names
`stage0_decisions`. Forcing PR#5 to write Lane A would re-introduce
the `verification_score NOT NULL` tension (PR#3 schema requires a
score; Stage 0 has none).

**Alternative (rejected):** Write Lane A with a synthetic
`verification_score = 0` for excluded sessions. Misleads PR#6
downstream; not recommended.

**Helen choice:** no (recommended) / write Lane A.

### OD-10 — Natural key for `stage0_decisions` (Codex BLOCKER fix)

**Recommendation:** **Expanded key** —
`(workspace_id, site_id, session_id, stage0_version, scoring_version)`.

**Why:** `stage0_version` tracks Stage 0 rule implementation
(`KNOWN_BOT_UA_FAMILIES`, `PROBE_PATH_PATTERNS`, `RULES`); `scoring_version`
tracks the Sprint 2 contract baseline from `scoring/version.yml`.
The two versions bump independently. A Stage 0 verdict produced under
`stage0-hard-exclusion-v0.2` + `s2.v1.0` MUST NOT overwrite or merge
with a future verdict under `stage0-hard-exclusion-v0.2` + `s2.v1.1`
— that would erase replay/provenance evidence. Both versions are part
of the key.

**Alternative (rejected):** Keep the original 4-column key and
require every contract bump to force a `stage0_version` bump too.
Couples the two version axes; loses independence; rejected.

**Helen choice:** expanded 5-column key (recommended) / 4-column +
forced co-bump policy.

### OD-11 — Persisted-evidence minimization (Codex BLOCKER fix)

**Recommendation:** **Confirm** — `stage0_decisions.rule_inputs` MUST
contain only normalised facts (per §6.6.1 allowlist). The forbidden
list in §6.6.2 (raw UA, token_hash, ip_hash, pepper, bearer, raw
payload, raw canonical_jsonb, raw page_url) is enforced by pure
test (static grep) + DB test (rule_inputs JSONB scan) + verification
SQL.

**Alternative (rejected):** Persist raw UA in `rule_inputs` for
"forensic" replay. Trades privacy + Hard-Rule-D source-code-strings
discipline for replay convenience. Rejected — PR#1 / PR#2 / PR#3 all
held the same minimization discipline.

**Helen choice:** minimization rule (recommended) / persist raw UA.

### OD-12 — Input source policy (Codex BLOCKER fix)

**Recommendation:** **PR#5 reads `accepted_events` + `ingest_requests`
only** (via `request_id` correlation for UA family). PR#5 does NOT
read `session_features` or `session_behavioural_features_v0_2` by
default. Unlocking either requires explicit Helen sign-off per
session.

**Why:** Stage 0 hard exclusion stays close to raw / request
evidence. Buyer-motion / session aggregation belongs to Stage 1
(PR#6). Mixing them inverts the layered design.

**Alternative:** Allow `session_features` reads (PR#11 lightweight
aggregates). Faster path to high-volume signal but contaminates Stage 0
with downstream-derived data. Rejected by default.

**Helen choice:** accepted_events + ingest_requests only
(recommended) / unlock `session_features` / unlock
`session_behavioural_features_v0_2`.

---

## §16 Go / no-go recommendation

### §16.1 Planning-only recommendation

**Recommended posture for THIS round:** ship this planning document
only. No code. No migration. No DB action.

### §16.2 Implementation blocked until ALL of:

1. **P-9 executed.** Operator (Helen) `git init` `ams-qa-behaviour-tests` and commits the current state as `v0.2.0` baseline. Track A currently returns `fatal: not a git repository` — implementation cannot vendor reproducibly without a pinned source hash.
2. **P-11 confirmed.** Helen confirms the recommended P-11 default (move Bytespider et al. out of Stage 0 exclusion) is still the chosen path.
3. **OD-1..OD-12 answered.** OD-1 (Option A vs B), OD-3 (α vs β), OD-5 (minimum P-11 scope), OD-6 (vendor vs write equivalent), **OD-10 (expanded natural key)**, **OD-11 (rule_inputs minimization)**, and **OD-12 (input source policy)** are the load-bearing decisions; the others may be confirmed-as-recommended.
4. **Helen written sign-off** on this planning doc (matching PR#1 / PR#2 / PR#3 / PR#4 pattern).
5. **Codex review of this planning document → PASS.**
6. **PR#4 contract artefacts remain stable** at the current Helen-signed versions (`s2.v1.0` / `rc-v0.1` / `forbidden-v0.1`). Any bump triggers a re-validation of PR#5's contract dependency.

### §16.3 After all six hold

1. New branch from `sprint2-architecture-contracts-d4cc2bf` HEAD (currently `cc2ae4c684d31eabc710542448c4dd95dbaf33e1`).
2. Implementation PR shipped under §6.1 file inventory.
3. Codex review of the implementation PR → PASS.
4. Hetzner staging proof per §13.
5. No Render production exposure (A0 P-4 still blocking).

### §16.4 Out-of-scope reminder (the user's hard boundaries)

- No Render production
- No production DB
- No frontend / GTM / GA4 / LinkedIn / ThinSDK
- No collector deploy / `src/collector/v1/**` / `src/app.ts` / `src/server.ts` / `src/auth/**` touched
- No scoring algorithm beyond Stage 0's deterministic exclusion rules
- No Stage 1 worker (PR#6 territory)
- No router (PR#3b territory)
- No Lane B observer / writer (PR#3b territory)
- No reason-code emission (option β; α requires Helen-approved dictionary bump)
- No INSERT INTO `scoring_output_lane_a` / `scoring_output_lane_b`
- No customer-facing dashboard / report
- PR#1 / PR#2 / PR#3 / PR#4 implementation files unmodified
