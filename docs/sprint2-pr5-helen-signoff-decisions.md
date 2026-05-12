Helen sign-off for PR#5 planning:

- P-9: resolved and approved — Track A source proof is pinned at commit 6ce15f20d6349ee89b8cba6412b6c74e297cad4d.
- P-11: approve recommended default — Bytespider / AI crawler handling is exclusion-side taxonomy correction only; no Lane B write.
- OD-1: approve recommended default — PR#5 writes stage0_decisions in RECORD_ONLY mode.
- OD-2: approve recommended default — PR#5 does not write scoring_output_lane_a and does not produce verification_score.
- OD-3: approve recommended default — PR#5 uses Stage-0 rule_id, not reason_codes.
- OD-4: approve recommended default — PR#5 reads accepted_events + ingest_requests via request_id only.
- OD-5: approve recommended default — P-11 scope is taxonomy correction only.
- OD-6: approve recommended default — vendor Track A Stage 0 core only; do not copy Stage 1/riskScore/classification/recommendedAction.
- OD-7: approve recommended default — full Hetzner staging DB proof required.
- OD-8: approve recommended default — no automated action and no action_recommendation.
- OD-9: approve recommended default — do not write Lane A in PR#5.
- OD-10: approve recommended default — natural key includes scoring_version.
- OD-11: approve recommended default — no raw UA/token/IP/raw payload/canonical JSON in persisted rule_inputs.
- OD-12: approve recommended default — session_features and session_behavioural_features_v0_2 excluded unless explicitly approved later.

I approve PR#5 implementation prompt drafting, subject to Codex review, staging proof, and no Render production path.# Sprint 2 PR#5 — Helen sign-off decisions

**Status.** Decision document only. No implementation, no migration,
no `schema.sql` change, no DB touch, no `psql`, no `package.json`
change, no collector / app / server / auth touched. **Not committed.**

**Source planning doc.** `docs/sprint2-pr5-stage0-record-only-worker-planning.md`.

**Codex planning review.** PASS after blocker fixes (natural-key
expansion to include `scoring_version`; raw-UA minimization rule;
`session_features` policy unified).

**Implementation gate.** PR#5 implementation remains blocked until
Helen signs **all** decisions below (P-9, P-11, OD-1..OD-12) AND the
Track A `ams-qa-behaviour-tests` repo is `git init`'d with a pinned
`v0.2.0` baseline. See §5 for the full gate list.

---

## §1 Executive summary

- **PR#5 is the Stage 0 RECORD_ONLY downstream worker** per A0 §K.
- **A0 says PR#5 writes a new `stage0_decisions` table** — not
  `scoring_output_lane_a` and not `scoring_output_lane_b`.
- **Lane A writer remains PR#6.** PR#5 does not produce a
  `verification_score`, an `evidence_band`, or an
  `action_recommendation`. The PR#3 Lane A schema is untouched.
- **Lane B observer remains deferred PR#3b.** PR#5 ships no `INSERT
  INTO scoring_output_lane_b` and no `B_DECLARED_AI_CRAWLER` /
  `B_SIGNED_AGENT` emission.
- **PR#5 uses a Stage-0-specific `rule_id` enum**, not `reason_codes`,
  under the recommended default (option β). The reason-code dictionary
  is not amended; PR#4's `validateRuleReferences` is not invoked.
- **Default v1 inputs: `accepted_events` + `ingest_requests` (via
  `request_id` correlation for the UA family).** `session_features`
  (PR#11) and `session_behavioural_features_v0_2` (PR#1/PR#2) remain
  **excluded by default** — opt-in requires explicit Helen sign-off
  per PR.
- **Track A vendoring is blocked until P-9 is resolved.** The
  `/Users/admin/github/ams-qa-behaviour-tests` repo currently returns
  `fatal: not a git repository`; PR#5 cannot vendor reproducibly
  without a pinned source hash.
- **Bytespider / AI-crawler taxonomy is included only as an
  exclusion-side correction.** PR#5 removes known declared AI crawlers
  (Bytespider, GPTBot, ClaudeBot, Perplexity-User, CCBot, Googlebot,
  Bingbot, DuckDuckBot, PerplexityBot, etc.) from
  `KNOWN_BOT_UA_FAMILIES`. The corresponding Lane B *write* path is
  out-of-scope and stays in PR#3b.

---

## §2 Decision table

Legend for **Blocking status**:

- **HARD** — implementation may not begin until Helen signs this decision.
- **SOFT** — implementation may begin under the recommended default; Helen sign-off captured for audit but no work is blocked.
- **CRITICAL HARD** — same as HARD, with cross-PR / replay-integrity consequences if signed differently.

| Decision ID | Question | Recommended default | Why this default | Consequence if approved (recommended) | Consequence if rejected / alternative | Blocking status | Helen decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **P-9** | Track A vendoring source proof: must `ams-qa-behaviour-tests` be `git init`'d + pinned before PR#5 vendoring? | **Yes.** Track A must be git-initialized and committed as a `v0.2.0` baseline. PR#5 vendoring records the source commit hash + per-file SHA for `lib/stage0-hard-exclusion.js` + the Stage 0 test file hash/count. | A0 §0.6 P-9 + §I.5 vendor-audit checklist require a pinned source hash for the vendored lib. Track A is currently not a Git repo (`fatal: not a git repository`); vendoring without a pinned hash produces an unreproducible build. | PR#5 vendor commit cites Track A `<sha>` + per-file SHA in the vendor header. Reproducible vendor copy. | No vendoring possible — implementation cannot begin. Falls back to OD-6 option "write equivalent from contract" (loses 30 vendored tests). | **HARD** | ☐ approve / ☐ alternative |
| **P-11** | Bytespider / AI-crawler taxonomy move out of Stage 0 hard exclusion? | **Yes.** PR#5 performs the *exclusion-side* taxonomy correction only: Bytespider, GPTBot, ClaudeBot, Perplexity-User, CCBot, Googlebot, Bingbot, DuckDuckBot, PerplexityBot, etc., are removed from `KNOWN_BOT_UA_FAMILIES`. Bad-actor entries (`curl`, `wget`, `python_requests`, `headless_chrome`) preserved. The Lane B *write* path stays in PR#3b. | A0 §0.6 P-11 + §P P-11 default: known AI/search crawlers must NOT be Stage 0 hard-exclusions. The full Lane B writer + new schema column is bigger than PR#5's scope; the exclusion-side correction is the minimum that A0 requires. | PR#5 ships an updated `KNOWN_BOT_UA_FAMILIES` + a new `KNOWN_AI_CRAWLER_UA_FAMILIES` constant in the vendored lib. AI-crawler UAs flow through to Stage 1 / future Lane B. | Leaving Bytespider in `KNOWN_BOT_UA_FAMILIES` causes false-positive bad-bot classifications for legitimate AI crawlers. **Blocking for Sprint 2 PR#5 Stage 0 productionisation** per A0. | **HARD** | ☐ approve / ☐ alternative |
| **OD-1** | Writer vs dry-run: does PR#5 write `stage0_decisions` rows? | **Yes — writer (Option A).** PR#5 ships migration 012 + worker + DB tests. Worker writes one `stage0_decisions` row per Stage-0-evaluated session in RECORD_ONLY mode. | A0 §K wording: "writes `stage0_decisions` (record-only)". Dry-run-only (Option B) contradicts the A0 row even though it is strictly safer. | Requires migration 012, DB tests, full Hetzner staging DB proof (OD-7). Worker shipped under PR#4's startup guard. | Option B — pure lib + dry-run report only. Smaller, but contradicts A0 §K. | **HARD** | ☐ approve / ☐ Option B |
| **OD-2** | Does PR#5 produce a `verification_score` / write `scoring_output_lane_a`? | **No.** PR#5 writes only `stage0_decisions`. No `verification_score` column. Stage 0 is a deterministic gate, not a calibrated scorer. | A0 §K names `stage0_decisions` (a new table); Lane A scorer is explicitly PR#6 (Stage 1). Writing Lane A would re-introduce the `verification_score NOT NULL` schema tension. | Lane A first writer remains PR#6. PR#5 stays small + replay-able. | Synthetic `verification_score = 0` for excluded sessions in Lane A — misleads PR#6 downstream; not recommended. | **CRITICAL HARD** | ☐ approve / ☐ alternative |
| **OD-3** | Reason-code policy: Stage-0-specific `rule_id` enum vs reason-code emission (`A_*` / `B_*` / ...) | **Stage-0-specific `rule_id` enum (option β).** PR#5 emits no `A_*` / `B_*` / `REVIEW_*` / `OBS_*` / `UX_*` codes. Each Stage 0 verdict carries a `rule_id` like `probe_path`, `high_volume_reqs`, `bot_ua_family`, `path_loop`, `forbidden_token`, `non_browser_runtime`, `webdriver_flag`. | The current dictionary has no Stage-0-shaped codes. Option α requires a `rc-v0.1` → `rc-v0.2` dictionary bump (separate Helen-signed contract amendment); not in PR#5 scope. | PR#4's startup + active-source guards still run; `validateRuleReferences` is not invoked. The dictionary is unchanged. | Option α — add Stage 0 codes to `reason_code_dictionary.yml`, bump to `rc-v0.2`, and call `assertRuleReferencesOrThrow` at boot. Larger surface; requires contract amendment. | **HARD** | ☐ approve / ☐ Option α |
| **OD-4** | Input source baseline: which tables does PR#5 read? | **`accepted_events` + `ingest_requests` via `request_id` correlation only.** Stage 0 stays close to raw / request evidence. | UA family lives on `ingest_requests.user_agent`, not `accepted_events`. Joining via `request_id` keeps PR#5 within PR#10's existing correlation surface. Reading further derived layers contaminates Stage 0 with Stage 1 aggregation. | Worker SQL reads two tables only. UA family derived in memory; raw UA discarded per OD-11. | Unlock `session_features` (cheaper but mixes Stage 1 aggregation) or `session_behavioural_features_v0_2` (refresh-loop is a Stage 1 signal). See OD-12. | **HARD** | ☐ approve / ☐ unlock listed |
| **OD-5** | P-11 scope inside PR#5 — minimum vs broader taxonomy work? | **Minimum scope.** Bytespider/AI-crawler removal from `KNOWN_BOT_UA_FAMILIES` + new `KNOWN_AI_CRAWLER_UA_FAMILIES` set (data, in source). No new column on `session_features`. No Lane B writer. No "neutral crawler taxonomy lane" table. | A0 §0.6 P-11 mandates the exclusion-side correction. The schema-column / Lane-B-writer pieces are bigger and gated separately. | PR#5 ships only the data-list change; tests verify AI-crawler UAs don't trigger Stage 0 exclusion. | Bundle a new column on `session_features` (schema change) and/or a Lane B writer (PR#3b scope). Larger blast radius. | **HARD** | ☐ approve / ☐ broader |
| **OD-6** | Vendor Track A Stage 0 vs write equivalent from contract? | **Vendor Track A** Stage 0 core only after P-9 is resolved. Do NOT copy Stage 1 stubs, `riskScore`, `classification`, `recommendedAction`, or non-Stage-0 envelope fields. Vendor commit cites Track A SHA + per-file hash. | A0 §K "vendor `lib/stage0-hard-exclusion.js`" + §I.5 audit checklist preserve the 30 vendored tests and avoid re-derivation drift. | Reproducible vendor copy under §I.5 audit (no `qa`, `test`, `synthetic`, `bot_label`, `adversary`, `behaviour_qa`, `ams_qa`, `bad_traffic_qa`, `fixture`, `profile_name` strings). | Write a narrow TypeScript equivalent from contract — cleaner type story but loses the 30 vendored tests; only viable if P-9 cannot be resolved. | **HARD** | ☐ approve / ☐ write equivalent |
| **OD-7** | Staging proof type for PR#5 — full DB proof vs lightweight npm-only? | **Full Hetzner staging DB proof.** PR#5 creates a new table and writes rows. Helen applies migration 012, runs the worker in RECORD_ONLY, inspects `stage0_decisions` row counts, runs `docs/sql/verification/12_*.sql`, confirms source-table counts unchanged, confirms `observe:collector` PASS. | The npm-only proof (PR#4 pattern) suffices for pure modules. PR#5 introduces SQL DDL + DML, so a DB proof is required. | DB proof captures migration apply + worker write + invariant SQL + role-privilege check + source-table-unchanged check. | npm-only proof — too thin given the new table. Rejected. | **HARD** | ☐ approve / ☐ npm-only |
| **OD-8** | Automated action / `action_recommendation` column on `stage0_decisions`? | **No column.** `stage0_decisions` has no `action_recommendation`. The `excluded` boolean is the only verdict. No automated customer-visible action follows from a Stage 0 row in v1. | `scoring/version.yml.automated_action_enabled: false` is the canonical guard. PR#4 enforces it at worker boot. Adding a one-value column is dead-weight. | Worker emits no action recommendation; downstream consumers (PR#6) read `excluded` only. | Add `action_recommendation TEXT DEFAULT 'record_only' CHECK IN ('record_only')` as a Hard-Rule-B mirror — belt-and-braces but adds no enforcement that PR#4 doesn't already provide. | **SOFT** | ☐ approve / ☐ mirror column |
| **OD-9** | Reject A0 and write Lane A instead? | **Reject the override.** Follow A0: write `stage0_decisions`, not `scoring_output_lane_a`. | A0 §K explicitly names `stage0_decisions`. Forcing Lane A reintroduces the `verification_score NOT NULL` schema tension. | PR#5 owns its own narrow table; PR#6 owns Lane A. | Override A0 → write Lane A with synthetic `verification_score = 0`. Misleads PR#6 downstream; not recommended. | **CRITICAL HARD** | ☐ approve reject / ☐ override A0 |
| **OD-10** | Natural key for `stage0_decisions` — must `scoring_version` be part of the key? | **Yes — 5-column key:** `(workspace_id, site_id, session_id, stage0_version, scoring_version)`. | `stage0_version` and `scoring_version` are independent provenance axes. Verdicts under `stage0-hard-exclusion-v0.2` + `s2.v1.0` must NOT merge with future verdicts under `stage0-hard-exclusion-v0.2` + `s2.v1.1`. | `ON CONFLICT (..., stage0_version, scoring_version) DO UPDATE` — same-version reruns refresh the row; any version bump produces a NEW row. Replay/provenance preserved. | 4-column key + a "force `stage0_version` co-bump when `scoring_version` bumps" policy. Couples version axes; loses independence. | **CRITICAL HARD** | ☐ approve 5-col / ☐ 4-col + co-bump |
| **OD-11** | Persisted `rule_inputs` minimization — what may PR#5 store? | **Normalised facts only.** Allowed keys: `user_agent_family`, `matched_family`, `matched_rule_id`, `ua_source`, `path_pattern_matched`, `events_per_second`, `path_loop_count`, `signal_confidence_bucket`. Raw UA read transiently in worker memory only and discarded after family mapping. Never persist `raw_user_agent`, `user_agent` (raw), `token_hash`, `ip_hash`, peppers, bearer tokens, `Authorization` headers, raw payloads / request bodies, raw `canonical_jsonb`, raw `page_url`. | Privacy + Hard-Rule-D source-code-strings discipline preserved. Mirrors PR#1 / PR#2 / PR#3 minimisation pattern. Enforced by pure-test grep + DB-test JSONB scan + verification SQL. | Raw UA discarded after family mapping; `rule_inputs` is a small normalized object; replay is reproducible via `evidence_refs` pointing back at the source rows. | Persist raw UA in `rule_inputs` for "forensic replay" — trades privacy for replay convenience; rejected. | **CRITICAL HARD** | ☐ approve minimization / ☐ persist raw UA |
| **OD-12** | Unlocking derived inputs (`session_features` / `session_behavioural_features_v0_2`)? | **Excluded by default.** Both are off in PR#5 v1. Unlocking EITHER requires explicit Helen sign-off **per PR / implementation decision** (not "per session" / not at runtime via env). | Stage 0 = deterministic exclusion gate close to raw evidence. Derived layers are Stage 1 territory; mixing them contaminates the gate. | PR#5 reads `accepted_events` + `ingest_requests` only (per OD-4). | Unlock `session_features` (PR#11 lightweight aggregates) or `session_behavioural_features_v0_2` (refresh-loop is Stage 1 signal). Requires a separate planning amendment + Helen sign-off + re-run of Codex review. | **HARD** | ☐ approve excluded-by-default / ☐ unlock listed |

---

## §3 What Helen approves by signing all rows above (as recommended)

If Helen signs **approve recommended default** on every row:

1. P-9 is executed *before* implementation begins. Track A repo is
   `git init`'d, committed as `v0.2.0`, the source `<sha>` is recorded
   in the PR#5 vendor commit header.
2. PR#5 vendors only `lib/stage0-hard-exclusion.js` core + its 30
   tests; no Stage 1 stubs, no `riskScore`, no `classification`, no
   `recommendedAction`. The §I.5 audit-checklist forbidden strings
   (`qa`, `test`, `synthetic`, `bot_label`, `adversary`,
   `behaviour_qa`, `ams_qa`, `bad_traffic_qa`, `fixture`,
   `profile_name`) are absent from the vendored source.
3. P-11 reclassification ships as a data-list change inside the
   vendored lib. AI-crawler UAs do NOT trigger Stage 0 exclusion. No
   Lane B writer, no new column on `session_features`.
4. PR#5 creates `migrations/012_stage0_decisions.sql` with the 5-column
   natural key `(workspace_id, site_id, session_id, stage0_version,
   scoring_version)`. No FK references either Lane table. Role grants
   mirror PR#3 OD-7: `buyerrecon_scoring_worker` SELECT+INSERT+UPDATE;
   `buyerrecon_internal_readonly` SELECT; `buyerrecon_customer_api`
   zero direct SELECT.
5. PR#5 worker reads `accepted_events` + `ingest_requests` only. Raw
   UA is discarded after family mapping. `rule_inputs` carries
   normalised keys only. `session_features` and
   `session_behavioural_features_v0_2` are not read.
6. PR#5 calls PR#4's `assertScoringContractsOrThrow()` +
   `assertActiveScoringSourceCleanOrThrow()` at worker boot.
   `validateRuleReferences` is NOT invoked (option β).
7. Hetzner staging proof per §13.1 of the planning doc: apply
   migration 012, run worker in RECORD_ONLY, run verification SQL 12,
   confirm source-table counts unchanged, confirm `observe:collector`
   PASS, no Render production touched.

If Helen signs **alternative** on any row, the implementation plan
must be re-derived for that row's downstream consequences before any
code is written.

---

## §4 Recommended sign-off block

Helen pastes the following into the PR#5 planning-doc sign-off note,
or replies in writing with the same content. Each line is a separate
decision; substituting `alternative` for any line triggers a re-plan
for that row's downstream consequences.

```
Helen sign-off for PR#5 planning:
- P-9:  approve recommended default
- P-11: approve recommended default
- OD-1:  approve recommended default
- OD-2:  approve recommended default
- OD-3:  approve recommended default
- OD-4:  approve recommended default
- OD-5:  approve recommended default
- OD-6:  approve recommended default
- OD-7:  approve recommended default
- OD-8:  approve recommended default
- OD-9:  approve recommended default
- OD-10: approve recommended default
- OD-11: approve recommended default
- OD-12: approve recommended default

I approve PR#5 implementation planning to proceed to implementation
prompt drafting, subject to Codex review and no production path.
```

---

## §5 Implementation gate summary

PR#5 implementation may begin only after ALL of the following hold:

1. **This decision document is reviewed.** Helen reads §1 + §2 + §3 + §4.
2. **Helen signs P-9, P-11, OD-1..OD-12** (or substitutes specific `alternative` choices, which triggers a re-plan for those rows).
3. **Track A P-9 source is git-initialized + pinned.** `cd /Users/admin/github/ams-qa-behaviour-tests && git rev-parse HEAD` returns a non-error SHA. The SHA is recorded in the PR#5 vendor commit header. (Currently fails with `fatal: not a git repository` — implementation cannot vendor until this is resolved.)
4. **Codex review of the implementation prompt / plan is PASS.**
5. **No Render production path.** A0 P-4 remains blocking; PR#5 ships local + Hetzner staging only.
6. **PR#4 contract artefacts remain stable** at the current Helen-signed versions (`scoring_version: s2.v1.0`, `rc-v0.1`, `forbidden-v0.1`). Any bump triggers re-validation of PR#5's contract dependency.

After all six hold, the implementation PR is drafted on a fresh
branch from `sprint2-architecture-contracts-d4cc2bf` HEAD (currently
`cc2ae4c684d31eabc710542448c4dd95dbaf33e1`).

---

## §6 What this document does NOT do

- Does **not** implement PR#5.
- Does **not** create migration 012.
- Does **not** edit `src/db/schema.sql`.
- Does **not** vendor anything from `ams-qa-behaviour-tests` (read-only reference only).
- Does **not** touch the DB, run `psql`, or run the worker.
- Does **not** edit `package.json`.
- Does **not** touch `src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`.
- Does **not** modify PR#1 / PR#2 / PR#3 / PR#4 implementation files.
- Does **not** commit.
