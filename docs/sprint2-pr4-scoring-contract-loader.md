# Sprint 2 PR#4 — scoring contract loader / startup guard

Track B (BuyerRecon Evidence Foundation). Pure TypeScript module that
loads + validates the three Sprint 2 scoring contract artefacts and
exposes a fail-fast assertion function future scoring workers
(Sprint 2 PR#5 Stage 0, PR#6 Stage 1, deferred PR#3b router/observer)
MUST call at startup. **No DB. No worker. No reason-code emission. No
production exposure.**

Authority:

- `docs/architecture/ARCHITECTURE_GATE_A0.md` §K row PR#4
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules C + D, §13.2
- `docs/sprint2-pr4-scoring-contract-loader-planning.md` (Codex PASS WITH NON-BLOCKING NOTES; both notes folded into this PR)
- `scoring/version.yml`, `scoring/reason_code_dictionary.yml`, `scoring/forbidden_codes.yml`

## 1. Summary

PR#4 owns the enforcement seam for signal-truth-v0.1 §10 Hard Rules
**C** ("Every emitted `reason_code` resolves against
`reason_code_dictionary.yml` at scorer startup") and **D** ("Codes or
band values in `forbidden_codes.yml` → scorer refuses to start; CI
scans for same patterns").

The PR ships:

- A pure TypeScript loader/validator module at `src/scoring/contracts.ts`.
- A thin CLI runner at `scripts/check-scoring-contracts.ts`.
- An `npm run check:scoring-contracts` script.
- A `yaml` runtime dependency (eemeli/yaml).
- 45 pure tests covering live-contracts PASS + 14 malformed-fixture
  HARD-issue paths + helper behaviour + Codex non-blocking notes.

PR#4 emits no rows, opens no DB connection, and computes no score.

## 2. A0 §K alignment

> | **PR#4** | reason-code dictionary loader | Startup assertion: scorer
> refuses to start if any rule references a code not in
> `reason_code_dictionary.yml`; CI grep against `forbidden_codes.yml` |
> none | pure | **no** |

PR#4 matches the §K row exactly: startup assertion + CI grep, no
migrations, pure tests, no collector touch. The "CI grep" is satisfied
by `assertActiveScoringSourceCleanOrThrow()` (Step B in §6 below)
running as the second half of `npm run check:scoring-contracts`.

## 3. Files changed

| File | Type | Notes |
| --- | --- | --- |
| `src/scoring/contracts.ts` | new | Loader + validator + 9 exported functions (5 types + 9 functions). Pure module; no `pg` / HTTP / ML imports. |
| `scripts/check-scoring-contracts.ts` | new | Thin CLI runner; calls Step A semantic validation + Step B source-code grep; prints PASS or exits 1 with formatted issues. |
| `tests/v1/scoring-contracts.test.ts` | new | 45 pure tests covering all 16 groups in the planning doc test plan. |
| `tests/fixtures/scoring-contracts/*.yml` | new | 14 malformed fixtures (3 version, 6 dictionary, 5 forbidden) each scoped to one HARD issue. |
| `package.json` | modified | `yaml` added to `dependencies`; `check:scoring-contracts` added to `scripts`. |
| `package-lock.json` | modified | `npm install yaml` resolved transitive lock state. |
| `docs/sprint2-pr4-scoring-contract-loader.md` | new (this file) | Implementation summary. |

Files **NOT** touched (verified by grep + git status):

- `src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`.
- All migrations (001–011), `src/db/schema.sql`.
- All scoring/*.yml contract files (read-only).
- PR#1 / PR#2 / PR#3 implementation files.
- Track A / `keigentechnologies/AMS` paths.

## 4. OD-1..OD-7 decisions implemented

| OD | Decision | Implementation |
| --- | --- | --- |
| **OD-1** | Loader file location = `src/scoring/contracts.ts` | Single TS module at that exact path. |
| **OD-2** | Library + thin CLI runner | `scripts/check-scoring-contracts.ts` wraps `assertScoringContractsOrThrow()` + `assertActiveScoringSourceCleanOrThrow()`. |
| **OD-3** | `yaml` dependency + `check:scoring-contracts` npm script | `npm install yaml` (runtime, not dev); `package.json` script added. |
| **OD-4** | B_* structurally validated only; no lane authorisation | Helper named `isReasonCodeStructurallyAllowed`; explicit test that `B_DECLARED_AI_CRAWLER` returns `true` (structurally valid) and that the function signature has no `lane` parameter. |
| **OD-5** | Startup guard only; no worker boot wrapper | Exports `assertScoringContractsOrThrow` for future workers to call; no `runScorerWithContracts(...)` wrapper. |
| **OD-6** | Malformed fixtures under `tests/fixtures/scoring-contracts/` | 14 fixture YAMLs. |
| **OD-7** | Lightweight Hetzner npm proof only | No DB action. Lightweight proof script in §11. |

## 5. API exported

```ts
// Types
export interface VersionContract           { /* scoring_version, status, etc. */ }
export type      ReasonCodeNamespace       /* 'A_' | 'B_' | 'REVIEW_' | 'OBS_' */
export interface ReasonCodeEntry           { /* meaning, can_route_to_review, can_trigger_automated_action: false, … */ }
export interface ReasonCodeDictionary      { metadata, codes, reserved_namespaces, … }
export interface PatternList               { applies_to, patterns, … }
export interface ForbiddenCodes            { /* full shape incl. hard_blocked_verification_method_strength_values_in_v1 */ }
export interface ScoringContracts          { version, dictionary, forbidden }
export interface ContractValidationIssue   { contract, path, message, hard }

// Functions
loadScoringContracts(opts?):              ScoringContracts
validateScoringContracts(c):              ContractValidationIssue[]
assertScoringContractsOrThrow(opts?):     ScoringContracts                 // throws on HARD
isReasonCodeStructurallyAllowed(c,code):  boolean                          // STRUCTURE only — no lane policy
assertReasonCodeStructurallyAllowed(c,code): void
validateRuleReferences(c, refs):          ContractValidationIssue[]       // future-safe synthetic refs API
assertRuleReferencesOrThrow(c, refs):     void
checkActiveScoringSourceAgainstForbiddenPatterns(opts?): ContractValidationIssue[]
assertActiveScoringSourceCleanOrThrow(opts?): void
```

## 6. Validation rules implemented (Step A semantic YAML validation)

### 6.1 `scoring/version.yml` (§H of the planning doc)
- `scoring_version`, `reason_code_dictionary_version`, `forbidden_codes_version` are non-empty strings.
- `status === 'record_only'`.
- `automated_action_enabled === false`.
- Forbidden activation keys (`customer_facing_enabled`, `live_enabled`, `production_enabled`, `enabled_for_customers`, `action_enabled`) MUST NOT be `true`.

### 6.2 `scoring/reason_code_dictionary.yml` (§F of the planning doc)
- `metadata.version` is non-empty + matches `version.yml.reason_code_dictionary_version`.
- `codes` is an object; `reserved_namespaces` is an object.
- For every code key:
  - prefix is one of `A_` / `B_` / `REVIEW_` / `OBS_` (UX_ / unknown prefixes raise).
  - `meaning` is a non-empty string (the live dictionary uses `meaning`, NOT `description` — Codex non-blocking note #1 folded).
  - `can_route_to_review` is a boolean.
  - `can_trigger_automated_action` is a boolean AND `=== false` (v1 invariant).
  - Legacy `can_trigger_action` field is absent (post-CF-3).
  - Code prefix is in `forbidden.prefix_allowlist`.
  - Code is not in `forbidden.hard_blocked_codes`.
  - Code does not match any regex in `forbidden.hard_blocked_code_patterns.patterns`.
- `OBS_*` count ≤ 7 (signal-truth §12.2 cap).

### 6.3 `scoring/forbidden_codes.yml` (§G of the planning doc)
- `metadata.version` is non-empty + matches `version.yml.forbidden_codes_version`.
- `hard_blocked_codes`, `hard_blocked_band_values`, `hard_blocked_action_values`, `prefix_allowlist` are `string[]`.
- `hard_blocked_code_patterns.applies_to === 'emitted_reason_codes_only'` (CF-2).
- `string_patterns_blocked_in_code.applies_to === 'source_code_strings_only'` (CF-2).
- Both `.patterns` arrays are `string[]`; every pattern compiles as a regex.
- `hard_blocked_verification_method_strength_values_in_v1` is `string[]` AND contains `'strong'` (Codex non-blocking note #1 folded; signal-truth §11 + PR#3 OD-6).

## 7. CI grep scope (Step B source-code grep)

Per planning doc §G.5 + Codex non-blocking note #2:

**Step A — Semantic contract validation** (above §6). Reads the three
YAMLs. **Not a source-code grep.**

**Step B — Source-code string grep on active scoring code only.**

| Path | In/out | Why |
| --- | --- | --- |
| `src/scoring/**` | **IN** | PR#4 module + future PR#5/PR#6 worker code. |
| `scripts/check-scoring-contracts.ts` | **IN** | PR#4 CLI surface. |
| `scoring/*.yml` | **OUT** | `forbidden_codes.yml` necessarily contains the patterns as definitions; self-referential. |
| `tests/**` + `tests/fixtures/**` | **OUT** | Tests must legitimately name forbidden tokens. |
| `docs/**` | **OUT** | Prose. |
| `migrations/**`, `src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`, `scripts/extract-behavioural-features.ts` | **OUT** | Already covered by PR#1 / PR#2 / PR#3 local sweeps. |

**Patterns used:** `forbidden.string_patterns_blocked_in_code.patterns`
**only** (the post-CF-2 source-code-strings-only list).
`hard_blocked_code_patterns.patterns` is NOT used here (Codex
non-blocking note #2 folded). A pure test deliberately constructs a
synthetic forbidden override with the two lists set to DIFFERENT
markers and asserts only the `string_patterns_blocked_in_code` marker
is detected.

## 8. No rule files yet handling

Per planning doc §F.7: PR#4 ships before PR#5 (Stage 0 rules) and PR#6
(Stage 1 rules). No `scoring/rules/` directory exists. PR#4 still
ships the forward-safe API:

```ts
validateRuleReferences(c, refs):           ContractValidationIssue[]
assertRuleReferencesOrThrow(c, refs):      void
```

Tests exercise these with synthetic ref lists. The happy path
(`['A_REFRESH_BURST', 'A_NO_FOREGROUND_TIME']`) returns `[]`. The fail
path (`['A_DOES_NOT_EXIST']`) returns one HARD issue at
`path='rule_references[0]'` with `contract: 'dictionary'`. PR#5 / PR#6
will pass their real rule references at boot.

## 9. B_* structural-only boundary

Per OD-4: `isReasonCodeStructurallyAllowed(c, 'B_DECLARED_AI_CRAWLER')`
returns `true` against the live contracts. PR#4 does **not** authorise
Lane B emission. Lane policy is the future PR#3b Lane B observer's
responsibility under its own gate. A dedicated test verifies the
function has no `lane` parameter (signature length = 2 — `c` + `code`).

## 10. Tests run / results

| Step | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run check:scoring-contracts` | **`Scoring contracts check PASS`** |
| `npx vitest run tests/v1/scoring-contracts.test.ts` | **45 / 45** passing |
| `npx vitest run` (full pure suite, 37 files) | **1951 / 1951** passing |
| `grep -R "pg_has_table_privilege" src scripts tests/v1/scoring-contracts.test.ts package.json` | zero matches in PR#4 surface |
| `grep -R "INSERT INTO scoring_output_lane" src scripts tests/v1/scoring-contracts.test.ts` | zero matches |

## 11. Lightweight Hetzner proof (OD-7)

PR#4 has no DB surface; the staging proof is reduced to four commands:

```bash
cd /opt/buyerrecon-backend   # adjust if Hetzner repo lives elsewhere
git pull
npm install                  # picks up the new `yaml` dependency
npm test                     # full pure suite incl. PR#4's 45 new tests
npm run check:scoring-contracts
```

Expected: `Scoring contracts check PASS`, npm test all-green, no
`psql` action, no migration. No DB rows read, no DB rows written, no
Render production touched.

## 12. Rollback

| Action | Effect |
| --- | --- |
| Revert PR#4 commit / unstage files | Removes loader + CLI + tests + fixtures + doc. |
| `npm uninstall yaml` then `npm install` | Restores prior `dependencies` block + lockfile. |
| DB rollback | **none** — PR#4 wrote no SQL, opened no connection. |
| Hetzner staging impact | **none** — no staging-side state was created. |
| Render production impact | **none** — never touched. |

Rollback is data-loss-free by construction.

## 13. No-production / no-DB / no-scorer / no-worker / no-reason-code-emission statement

- **No Render production.** A0 P-4 still blocks Render production work.
- **No production DB.** No DB connection of any kind from PR#4 code.
- **No DB writer.** Repo-wide grep returns zero `INSERT INTO scoring_output_lane_a` / `_b` in PR#4 source.
- **No scoring algorithm.** PR#4 computes no `verification_score`, no `evidence_band`, no `action_recommendation`.
- **No reason-code emission.** PR#4 emits no `A_*` / `B_*` / `REVIEW_*` / `OBS_*` / `UX_*` code; it validates emissions against contracts but never produces them.
- **No router.** Deferred PR#3b router/observer is out of scope.
- **No Lane B observer.** Deferred PR#3b observer is out of scope.
- **No Stage 0 worker.** PR#5 territory.
- **No Stage 1 worker.** PR#6 territory.
- **No AI-agent / crawler taxonomy implementation.** P-11 lives in PR#5.
- **No collector / app / server / auth touched.** Verified by pure-test import sweeps.
- **No customer-facing dashboard / report.**
- **PR#1 / PR#2 / PR#3 implementation files unmodified.**
