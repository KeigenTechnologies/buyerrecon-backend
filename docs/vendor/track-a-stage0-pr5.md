# Vendor source proof — Track A Stage 0 (BuyerRecon Sprint 2 PR#5)

This document is the pinned source-proof record for the Track A library
files vendored into BuyerRecon `src/scoring/stage0/vendor/`. The
single vendored file is a **byte-for-byte copy** of the upstream — no
modifications. BuyerRecon-side adaptation (P-11 AI-crawler taxonomy
correction, BuyerRecon `rule_id` mapping, `rule_inputs` minimization)
lives **outside** the vendor directory in `src/scoring/stage0/` so the
vendored file remains verifiably equal to the upstream SHA-256 below.

## Upstream repo

| Item | Value |
| --- | --- |
| Repo path | `/Users/admin/github/ams-qa-behaviour-tests` |
| Commit hash | `6ce15f20d6349ee89b8cba6412b6c74e297cad4d` |
| Short hash | `6ce15f2` |
| Branch | `main` |
| Commit message | `Track A Stage 0 baseline for BuyerRecon PR#5` |
| Upstream `package.json` `version` | `0.2.0` |

## Vendored file

| Vendored path | Upstream path | SHA-256 |
| --- | --- | --- |
| `src/scoring/stage0/vendor/stage0-hard-exclusion.js` | `lib/stage0-hard-exclusion.js` | `7dc97bd96875df8ad0f45d819ba37fd5c8076aaae8748183540a72e43c82b303` |

The SHA-256 of the vendored file under BuyerRecon **MUST** equal the
upstream SHA-256 above. Any divergence indicates either (a) a manual
edit (forbidden — re-vendor instead) or (b) line-ending corruption
(re-vendor with binary-mode copy).

## Reference files (NOT vendored)

These upstream files are referenced in this commit for provenance only;
they are **not** copied into `src/scoring/stage0/vendor/`:

| Upstream path | SHA-256 | Role for PR#5 |
| --- | --- | --- |
| `tests/stage0.test.js` | `96ae94adcc1da77bf684d842e29269db5c7ed6ba3454cdf51d1c3378d83527d3` | Upstream test source (30 tests / 30 pass). BuyerRecon ships its own TypeScript tests at `tests/v1/stage0-record-only-worker.test.ts`. |
| `lib/two-stage-fixtures.js` | `1da59427bf564001ed93e9e320c6de7b133f4617b887ca5f30fd5d07b0a7ca9c` | Upstream test fixtures. BuyerRecon constructs fixtures inline in its test file (no copy). |
| `package.json` | `b6c4091bde24f1470228e65724fe7898105a6bd0dd72c6d801dc0f1ba6d1634b` | Upstream package metadata. Not relevant at runtime; recorded for the v0.2.0 version stamp. |
| `package-lock.json` | `c5e4ae99835a548946195d1e23b3c0db3154d0d782fb49576ffe075cff38ebd2` | Same. |

## Upstream test results at this commit

| Command | Result |
| --- | --- |
| `node --test tests/stage0.test.js` | **30 / 30** passing |
| `npm run test:unit` (full unit suite) | **130 / 130** passing |

Matches A0 §B.3 line 170 ("130 / 130 pass post-Codex fix"; "Stage 0 …
30 unit tests") and A0 §K row PR#5 column ("pure (130 vendored tests)").

## §I.5 vendor-audit checklist (A0)

A0 §I.5 line 753 requires the vendored lib files to be examined for
any string containing: `qa`, `test`, `synthetic`, `bot_label`,
`adversary`, `behaviour_qa`, `ams_qa`, `bad_traffic_qa`, `fixture`,
`profile_name`.

Audit result for `src/scoring/stage0/vendor/stage0-hard-exclusion.js`
at the recorded SHA-256:

- The file contains a `FORBIDDEN_TOKENS` array listing these exact
  strings as **data** (lines 61-64 upstream). The array is the
  inspection target for the upstream's *own* test suite — the lib
  itself never reads these tokens at runtime, and no rule name
  contains them.
- Rule names declared in the `RULES` array (lines 76-156 upstream):
  `webdriver_global_present`, `automation_globals_detected`,
  `known_bot_ua_family`, `scanner_or_probe_path`,
  `impossible_request_frequency`, `non_browser_runtime`,
  `attack_like_request_pattern`. **None** contain any §I.5
  forbidden token.
- No `profile_name` read in the evaluator (per upstream safety
  contract line 25 — "The engine NEVER reads a profile name from the
  evidence object").

§I.5 audit: **PASS**.

## P-11 — Bytespider / AI-crawler taxonomy correction

The vendored upstream contains `'bytespider'` and `'petalbot'` in its
`KNOWN_BOT_UA_FAMILIES` constant (line 52 upstream). Per A0 §0.6 P-11
+ §P P-11 default, known declared AI / search crawlers must NOT be
classified as Stage 0 high-confidence bad-bot exclusions.

**BuyerRecon does NOT modify the vendored file** (preserves SHA-256
provenance). Instead the BuyerRecon adapter at
`src/scoring/stage0/evaluate-stage0.ts`:

1. Defines a `KNOWN_AI_CRAWLER_UA_FAMILIES` set containing the
   declared-AI-crawler families: Bytespider, GPTBot, ClaudeBot,
   Perplexity-User, CCBot, Googlebot, Bingbot, DuckDuckBot,
   PerplexityBot, petalbot.
2. Before calling `evaluate(evidence)`, if
   `evidence.deterministic.userAgentBotFamily` is in
   `KNOWN_AI_CRAWLER_UA_FAMILIES`, the adapter **maps it to `null`**
   so the upstream `known_bot_ua_family` rule does not fire for these
   UAs.
3. **PR#5 persists NO Lane B taxonomy facts.** The P-11 carve-out is
   INTERNAL pre-evaluation logic only — its effect is observable from
   the *absence* of a `known_bot_ua_family` verdict on Bytespider-like
   sessions (i.e. `rule_id = 'no_stage0_exclusion'`), NOT from a
   persisted `ai_crawler_passthrough` boolean. The earlier draft of
   PR#5 persisted `ai_crawler_passthrough` and `matched_family` for
   AI-crawler sessions; that was removed per Codex review because it
   shipped Lane B taxonomy state outside the Helen-signed OD-11
   allowlist. Lane B declared-agent facts are re-derived by the
   deferred PR#3b Lane B observer when it ships.

This satisfies A0 §0.6 P-11 default ("must not be Stage 0
high-confidence bad-bot exclusions") without modifying the vendored
source AND without persisting any Lane B taxonomy on
`stage0_decisions`.

## What PR#5 vendors NOT

Per the PR#5 planning doc OD-6 + A0 §K + §I.5:

- `lib/stage1-behaviour-score.js` — Stage 1 territory (PR#6 scope).
- Any Stage 1 fixtures.
- `riskScore`, `classification`, `recommendedAction` fields in the
  upstream output envelope — the BuyerRecon adapter discards these
  (they are Stage 1 placeholders nulled by the upstream lib).
- `stage1BehaviourScore.*` — discarded.
- `decisionSummary.recommendedAction` / `finalRecordOnlyDecision`
  shapes — discarded; BuyerRecon's own `rule_id` enum is the verdict
  surface.
- Playwright specs, `LIVE_TESTS` harness, scripts — all out of scope.

## Re-vendor procedure

If Track A bumps Stage 0 logic:

1. `cd /Users/admin/github/ams-qa-behaviour-tests && git pull` (or
   bump to the new tagged hash).
2. Re-compute the new SHA-256 for `lib/stage0-hard-exclusion.js`.
3. Re-copy the file to
   `src/scoring/stage0/vendor/stage0-hard-exclusion.js`.
4. Update this doc with the new commit hash + SHA-256.
5. Bump `STAGE0_VERSION` (e.g. `stage0-hard-exclusion-v0.3`) in the
   BuyerRecon worker so the natural-key tuple distinguishes old vs
   new verdicts (per PR#5 OD-10).
6. Re-run BuyerRecon's `npx vitest run tests/v1/stage0-record-only-worker.test.ts`
   to verify all adapter assertions still hold.
7. Re-validate the `KNOWN_AI_CRAWLER_UA_FAMILIES` carve-out is still
   relevant against the new upstream `KNOWN_BOT_UA_FAMILIES`.
