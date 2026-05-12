# Sprint 2 PR#4 — scoring contract loader / startup guard — planning

**Status.** Planning only. Helen sign-off required before any
implementation. No code, no migration, no `schema.sql` change, no DB
touch, no collector / app / server / auth change. PR#1 / PR#2 / PR#3
files are referenced read-only.

**Authority (verbatim quoted in §2 below).**

- `docs/architecture/ARCHITECTURE_GATE_A0.md` (committed at `a87eb05`) §K row PR#4
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules **C** (dictionary integrity) + **D** (forbidden-codes startup refusal)
- `scoring/reason_code_dictionary.yml` (`rc-v0.1`)
- `scoring/forbidden_codes.yml` (`forbidden-v0.1`)
- `scoring/version.yml` (`scoring_version: s2.v1.0`; `status: record_only`; `automated_action_enabled: false`)
- `docs/sprint2-pr3-scoring-output-contracts-planning.md`, `docs/sprint2-pr3-scoring-output-contracts.md` (PR#3 Codex PASS + Hetzner staging PASS)

**Closed prerequisite state.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| Prior commit (PR#3) | `4318e024171b9c3331130ff27ea9677f47a1cd54` |
| PR#3 Codex review | PASS |
| PR#3 Hetzner staging proof | PASS |
| Migration 011 applied (Hetzner staging only) | yes |
| `scoring_output_lane_a` / `scoring_output_lane_b` on staging | exist, 0 rows |
| `observe:collector` | PASS |
| Render production touched | **no** |

---

## §A Executive summary

### What PR#4 is

PR#4 is the **scoring contract loader / startup-guard layer**. It is a
pure TypeScript module that loads the three Sprint 2 scoring contract
artefacts (`scoring/version.yml`, `scoring/reason_code_dictionary.yml`,
`scoring/forbidden_codes.yml`), validates them against the
signal-truth-v0.1 contract, and exposes a fail-fast `assert*` function
that future scoring workers (Sprint 2 PR#5 Stage 0, PR#6 Stage 1, and
the deferred PR#3b router/observer) **MUST** call at startup before
they emit any reason code or score.

PR#4 is the **enforcement seam for Hard Rules C and D** from
signal-truth-v0.1 §10:

- **Hard Rule C.** "Every emitted `reason_code` resolves against
  `reason_code_dictionary.yml` at scorer startup." — Enforcement:
  "Scorer startup; refuses to start otherwise."
- **Hard Rule D.** "Codes or band values in `forbidden_codes.yml` →
  scorer refuses to start; CI scans for same patterns." — Enforcement:
  "Scorer startup + CI grep."

### What PR#4 is NOT

- **NOT** a scorer. PR#4 computes no `verification_score`, emits no
  reason code, assigns no `evidence_band`, makes no
  `action_recommendation`.
- **NOT** a router. The deferred PR#3b Lane B router/observer is out
  of scope.
- **NOT** a Stage 0 worker (PR#5) or Stage 1 worker (PR#6).
- **NOT** a DB writer. PR#4 never opens a Postgres connection. No
  `INSERT INTO scoring_output_lane_a` or `INSERT INTO scoring_output_lane_b`.
  No DB read either.
- **NOT** a migration. No SQL ships. The PR#3 lane-output tables are
  PR#4's *downstream write targets named for documentation only* — PR#4
  itself never opens a writer.
- **NOT** a collector / app / server / auth change. `src/collector/v1/**`,
  `src/app.ts`, `src/server.ts`, `src/auth/**` are untouched.
- **NOT** an AI-agent / crawler taxonomy. P-11 lives in PR#5
  productionisation.
- **NOT** a customer-facing surface. No dashboard, no report, no view.

### Why PR#4 follows PR#3

The Sprint 2 sequence locks contracts before scorers:

```
PR#0  →  signal-truth-v0.1 + reason-code dictionary + forbidden-codes (docs only)
PR#1  →  behavioural_features_v0.2 extractor (factual)
PR#2  →  refresh-loop server-side derivation (factual)
PR#3  →  Lane A / Lane B scoring output tables (typed write surface; no writer)
PR#4  →  THIS PR — contract loader + startup guard (no DB, pure)
PR#5  →  Stage 0 RECORD_ONLY worker (vendored from Track A; first writer)
PR#6  →  Stage 1 Lane A scorer (vendored from Track A; uses PR#4 to start)
PR#7  →  false_positive_review queue
```

PR#4 is the **gate** between the contract layer (PR#0) and the scorer
layer (PR#5/PR#6). Without PR#4, a future scorer could:

- Emit a `reason_code` value that does not exist in
  `reason_code_dictionary.yml` (violating Hard Rule C).
- Emit a forbidden band value such as `evidence_band='high'` or a
  forbidden action such as `action_recommendation='exclude'` (violating
  Hard Rule D + Hard Rules A / B).
- Drift from `scoring_version=s2.v1.0` without a corresponding
  contract version bump (violating Hard Rule E).

PR#4 prevents all three at startup by *refusing to return* a
"contracts loaded" handle if any check fails.

### Why contract validation must happen before PR#5 / PR#6 workers

A0 §0.6 P-8 confirms scorecard-only v1 with "calibrated thresholds; defer
shadow-challenger to Sprint 5." That means PR#6's Stage 1 rubric reads
the dictionary at every run to look up emitted codes. If the dictionary
shape is broken, the scorer either silently emits garbage or crashes at
run time — neither is acceptable. PR#4 catches structural breakage at
**startup**, in a place that is unit-testable and that runs before any
session is scored.

PR#4 is also the **CI grep seat** for `forbidden_codes.yml` (per Hard
Rule D enforcement note). A `npm run check:scoring-contracts` script
exposes the loader for CI use (OD-3); PR#5/PR#6 worker boot adopts the
same call as a runtime guard.

---

## §B A0 alignment

### §B.1 Verbatim quote — A0 §K row PR#4

> | **PR#4** | reason-code dictionary loader | Startup assertion: scorer
> refuses to start if any rule references a code not in
> `reason_code_dictionary.yml`; CI grep against `forbidden_codes.yml` |
> none | pure | **no** |

Columns: PR / Title / Scope / Migrations / Tests / Touches collector?

**Interpretation.** PR#4 is *startup assertion + CI grep*, no
migrations, pure tests, no collector touch. This planning doc proposes
exactly that shape with one optional refinement (OD-3 CLI script
exposing the loader to `npm test` and CI).

### §B.2 Verbatim quote — signal-truth-v0.1 §10 Hard Rules C and D

> | C | Every emitted `reason_code` resolves against
> `reason_code_dictionary.yml` at scorer startup | Scorer startup;
> refuses to start otherwise |
> | D | Codes or band values in `forbidden_codes.yml` → scorer refuses
> to start; CI scans for same patterns | Scorer startup + CI grep |

PR#4 owns the enforcement side of both rules. The future scorer
worker(s) own the *invocation* side: each worker calls
`assertScoringContractsOrThrow()` once at process startup, and refuses
to proceed if it throws.

### §B.3 Verbatim quote — signal-truth-v0.1 §13.2 (Sprint 2 build complete)

> All hard rules A–I enforced at code or CI level

PR#4 contributes the C and D enforcement seams; the other rules are
enforced by PR#3 (A, B at schema / `record_only` default; H, I at
Postgres-role + lint level) or by future PRs (E, F, G at scorer source
+ pre-commit / CI). PR#4 does NOT re-enforce A / B / H / I.

### §B.4 A0 tension check

No tension. A0 §K PR#4 row, §D (no PR#4-specific entry in the §D
end-to-end workflow; the loader is named only by Hard Rules C/D in §10
of signal-truth), and the cross-references at §0.6 / §0.7 are
consistent: PR#4 is a *pure module*, no migrations, no DB write, no
collector touch. The only nuance is **CI grep** — A0 §K row says
"CI grep against `forbidden_codes.yml`", which fits naturally as an
`npm run check:scoring-contracts` script (OD-3) that wraps the loader.

---

## §C Contract inputs

PR#4 is a *read-only contract validator*. Inputs:

| Path | Owner | Role for PR#4 |
| --- | --- | --- |
| `scoring/version.yml` | PR#0 | Read at startup. Validated for `scoring_version`, `reason_code_dictionary_version`, `forbidden_codes_version`, `status: record_only`, `automated_action_enabled: false`. |
| `scoring/reason_code_dictionary.yml` | PR#0 | Read at startup. Top-level keys: `metadata`, `policies`, `codes`, `reserved_namespaces`. PR#4 validates the shape + invariants enumerated in §F. |
| `scoring/forbidden_codes.yml` | PR#0 | Read at startup. Top-level keys: `metadata`, `hard_blocked_codes`, `hard_blocked_code_patterns`, `hard_blocked_band_values`, `hard_blocked_action_values`, `prefix_allowlist`, `string_patterns_blocked_in_code`, `sdk_payload_field_blocklist_followup`. PR#4 validates the shape + invariants in §G. |
| `docs/contracts/signal-truth-v0.1.md` | PR#0 | Read-only reference. PR#4 quotes Hard Rules in its own comments + tests; does not parse the prose. |
| `scoring_output_lane_a`, `scoring_output_lane_b` (PR#3 tables) | PR#3 | Named in PR#4 docs as "future write targets the scorer (PR#5/PR#6) will write to". PR#4 itself **never** opens a DB connection or writes a row. |

---

## §D Proposed PR#4 scope

### §D.1 Module layout

Recommended layout:

```
src/scoring/
└── contracts.ts                       (new — loader + validators + asserts)
```

The single TypeScript module exports the type-safe loaded shapes and
the assertion functions enumerated in §I. It is the seat of all PR#4
logic. Tests live under `tests/v1/scoring-contracts.test.ts`. Fixture
malformed YAML files live under `tests/fixtures/scoring-contracts/`
(see OD-6 for inline-vs-fixture-file choice).

Why `src/scoring/` (not `scripts/`)?

- The future scorer worker (PR#6) lives under a `src/scoring/` tree
  (per the deferred Track-A vendor pattern documented in A0 §K).
  Putting the loader under the same path means PR#6 imports it via a
  short relative path and the loader is the *first file* of the
  `src/scoring/` tree — a natural anchor.
- The `scripts/` path is reserved for one-shot operator scripts (e.g.
  `scripts/extract-behavioural-features.ts`); the loader is a library
  imported by other modules, not a one-shot script.

OD-1 invites Helen to confirm or alternative-locate.

### §D.2 Public surface (§I details the types)

```ts
// All functions are PURE: no DB, no HTTP, no process side-effects beyond
// reading the three YAML files via fs.readFileSync at load time.

export interface ScoringContracts {
  version:    VersionContract;
  dictionary: ReasonCodeDictionary;
  forbidden:  ForbiddenCodes;
}

export interface ContractValidationIssue {
  contract: 'version' | 'dictionary' | 'forbidden';
  path:     string;        // dotted path or YAML key like 'codes.A_REFRESH_BURST.can_trigger_automated_action'
  message:  string;        // human-readable explanation
  hard:     boolean;       // true → causes assertScoringContractsOrThrow to throw
}

export function loadScoringContracts(opts?: { rootDir?: string }): ScoringContracts;
export function validateScoringContracts(c: ScoringContracts): ContractValidationIssue[];
export function assertScoringContractsOrThrow(opts?: { rootDir?: string }): ScoringContracts;

// Structural validity helpers. These answer dictionary/forbidden shape
// only — they do NOT authorise lane-specific emission. Lane policy is
// the future worker/observer's responsibility (see §F.7).
export function isReasonCodeStructurallyAllowed(c: ScoringContracts, code: string): boolean;
export function assertReasonCodeStructurallyAllowed(c: ScoringContracts, code: string): void;

// Forward-defined helpers for PR#5 / PR#6 rule-reference resolution.
// PR#4 ships these now even though no rule file exists yet (tests use
// synthetic refs); PR#5 / PR#6 call them with their own rule references
// when they vendor Stage 0 / Stage 1 libs. See §F.7.
export function validateRuleReferences(c: ScoringContracts, refs: string[]): ContractValidationIssue[];
export function assertRuleReferencesOrThrow(c: ScoringContracts, refs: string[]): void;
```

### §D.3 Optional CLI

OD-3 invites Helen to add a `package.json` script
`check:scoring-contracts` that simply runs
`assertScoringContractsOrThrow()` and prints PASS or the issue list.
The script is wired into `npm test` (already auto-wired via vitest
include glob on `tests/v1/**/*.test.ts`) and into CI for the "CI grep"
requirement of A0 §K.

### §D.4 YAML parser dependency

The repo currently has **no YAML library** in `package.json` (the PR#1
/ PR#3 pure tests use a hand-rolled regex extractor for narrow pattern
lists — adequate for `.patterns` sweeps, not adequate for full
schema validation).

Two options:

| Option | Pros | Cons |
| --- | --- | --- |
| **(a)** Add `yaml` (eemeli/yaml, MIT, ~250 KB unpacked, zero runtime deps) | TypeScript-native; widely used; deterministic parse; well-maintained. | New dependency line in `package.json`. |
| **(b)** Extend the hand-rolled regex extractor | No new dep. | Brittle. Full schema validation by regex is a maintenance trap. |
| **(c)** Use `js-yaml` (~290 KB, MIT, well-known) | Widely used. | Larger; depends on `argparse`. Slightly more cumbersome typings. |

**Recommended default:** option (a). Add `yaml` as a runtime
dependency. The PR adds one `dependencies` line and one `package-lock.json`
update. Justification: PR#4's entire correctness rests on parsing
three YAML files; a hand-rolled parser would invert the risk/value
ratio.

This is OD-2 (CLI script vs library-only) + OD-3 (npm script). Adding
a runtime dependency itself is OD-3-adjacent — Helen confirms.

---

## §E What PR#4 must NOT do

| Hard "not" | Defence |
| --- | --- |
| No scoring algorithm | PR#4 emits no `verification_score`. No computation of band, recommendation, or routing. |
| No reason-code emission | PR#4 emits zero `A_*` / `B_*` / `REVIEW_*` / `OBS_*` / `UX_*` codes. |
| No output table writes | Pure-test sweep + repo-wide grep for `INSERT INTO scoring_output_lane_a` / `_b` in PR#4 source must return zero. |
| No DB writes | PR#4 imports neither `pg` nor any DB client. Pure-test sweep verifies `from 'pg'` / `pg-pool` is absent. |
| No DB reads | Same defence. |
| No stage worker | PR#4 ships no `stage0` / `stage1` directory. |
| No collector change | `src/collector/v1/**` unchanged. Pure-test import sweep enforces. |
| No app/server/auth change | `src/app.ts`, `src/server.ts`, `src/auth/**` unchanged. Pure-test import sweep enforces. |
| No production | A0 P-4 still blocks Render production work. PR#4 is local + (optional) Hetzner pure-test proof only. |

---

## §F Reason-code dictionary validation plan

`scoring/reason_code_dictionary.yml` has the top-level keys `metadata`,
`policies`, `codes`, `reserved_namespaces`. PR#4 validates:

### §F.1 Structural shape

- `metadata.version` is a non-empty string. Default expectation: `rc-v0.1`.
- `metadata.owner`, `metadata.last_reviewed`, etc. — presence-only (specific values are NOT pinned).
- `policies` is an object; nested `policies.lane_a.*`, `policies.lane_b.*` recognised but PR#4 only asserts presence + types, not specific policy text.
- `codes` is an object mapping code-name → code-definition object.
- `reserved_namespaces` is an object mapping prefix → reservation note.

### §F.2 Per-code invariants

For every key under `codes:`:

| Check | Rule |
| --- | --- |
| Prefix | Must start with one of `A_`, `B_`, `REVIEW_`, `OBS_`. Any other prefix → hard issue. |
| `meaning` | Non-empty string. (Matches the live `scoring/reason_code_dictionary.yml` field name; the YAML uses `meaning:`, not `description:`.) |
| `can_route_to_review` | Boolean. Required (CF-3 split). |
| `can_trigger_automated_action` | Boolean. **MUST be `false`** for every code in v1 (CF-3 + Hard Rule B + signal-truth §10 + `version.yml.automated_action_enabled: false`). Any `true` → hard issue. |
| No legacy `can_trigger_action` field | The post-CF-3 contract removed this single field. Presence on any code → hard issue. |
| Severity / evidence / lane fields | If A0 / signal-truth § documents specific required fields per namespace, PR#4 asserts their presence. Optional fields (e.g. `notes`) are tolerated. |

### §F.3 Namespace invariants

- **A_*** codes: present in dictionary, may be emitted (in scope for PR#6).
- **B_*** codes: present in dictionary; **PR#4 itself does not emit them**. The deferred PR#3b observer is the future emitter. PR#4 may *validate* their entries but must not enforce emission.
- **REVIEW_*** codes: present in dictionary; routed to `false_positive_review` queue by PR#7. PR#4 does not enforce routing.
- **OBS_*** codes: present in dictionary; capped at 7 entries per signal-truth §12.2 ("`OBS_*` is capped at 7 emitted codes in v1"). PR#4 counts and asserts `<= 7`.
- **UX_*** codes: forbidden namespace in v1 (signal-truth §11). `reserved_namespaces.UX_` must exist; no `UX_*` key may appear under `codes:`.
- Any other prefix → hard issue.

### §F.4 Duplicate / shadowing

- No duplicate code names (YAML parse rejects duplicates at the key level; PR#4 belt-and-braces verifies).
- No code shadows a `reserved_namespaces` prefix (e.g. a code key cannot start with `UX_`).

### §F.5 Reserved-not-emitted markers

- `reserved_namespaces.UX_` must be marked reserved-not-emitted with an annotation (PR#0 already records this in YAML notes).
- The PR#0 dictionary contains zero `UX_*` keys under `codes:`. PR#4 verifies that count.

### §F.6 Cross-version sanity

- `metadata.version` in the dictionary must match `version.yml.reason_code_dictionary_version`. Mismatch → hard issue.

### §F.7 No scoring rule files yet — what PR#4 actually validates

PR#4 ships **before** PR#5 (Stage 0 rule files vendored from Track A
`lib/stage0-hard-exclusion.js`) and **before** PR#6 (Stage 1 rule files
vendored from Track A `lib/stage1-behaviour-score.js`). Consequently
there is no `scoring/rules/*.yml` directory and no in-repo rule
reference list for PR#4 to traverse.

What PR#4 validates today, given this constraint:

| Surface | What PR#4 validates now |
| --- | --- |
| Three contract artefacts (`scoring/version.yml`, `scoring/reason_code_dictionary.yml`, `scoring/forbidden_codes.yml`) | Full structural + cross-version validation per §F–§H. |
| Exported helper behaviour | Pure-function behaviour of `isReasonCodeStructurallyAllowed`, `assertReasonCodeStructurallyAllowed`, `validateRuleReferences`, `assertRuleReferencesOrThrow`, exercised against the live dictionary + synthetic reference lists. |
| Forward-safe API surface for PR#5 / PR#6 | The `validateRuleReferences` / `assertRuleReferencesOrThrow` signature is **defined and tested** under PR#4 even though no real Stage 0 / Stage 1 rule file exists yet. PR#5 / PR#6 import these functions at boot without amending PR#4. |

**Why ship the rule-reference helpers in PR#4 (not later):**

- A0 §K row PR#4 explicitly says "scorer refuses to start if any rule
  references a code not in `reason_code_dictionary.yml`." That is the
  rule-reference assertion. PR#4 is the right home for the function
  itself even though the rules don't exist yet.
- Pushing the helpers into PR#5 / PR#6 would couple the assertion to
  the worker that runs it. A future change to either Stage 0 or
  Stage 1 rule shape would then risk modifying the assertion path
  too. PR#4 owns the assertion path; PR#5 / PR#6 own the references.
- PR#4 tests use synthetic reference lists (e.g.
  `['A_REFRESH_BURST', 'A_NO_FOREGROUND_TIME']` for the happy path;
  `['A_DOES_NOT_EXIST']` to assert hard-fail with the right `path` +
  `message`). This is the standard pattern (the same way PR#1 ships
  `parseOptionsFromEnv` and tests it against synthetic env shapes).

**What PR#4 does NOT do here:**

- PR#4 does not introduce rule files. `scoring/rules/` is not created.
- PR#4 does not implement scoring logic — `validateRuleReferences`
  only checks string presence/structure, not rule semantics.
- PR#4 does not commit PR#5 / PR#6 to any particular rule-loading
  scheme. PR#5 / PR#6 may pass plain string arrays, structured rule
  objects flattened to code-name strings, or any other shape — only
  the *string array* boundary is fixed.

---

## §G `forbidden_codes.yml` validation plan

Top-level keys (post-PR#0 / CF-2): `metadata`, `hard_blocked_codes`,
`hard_blocked_code_patterns`, `hard_blocked_band_values`,
`hard_blocked_action_values`,
`hard_blocked_verification_method_strength_values_in_v1`,
`prefix_allowlist`, `string_patterns_blocked_in_code`,
`sdk_payload_field_blocklist_followup`.

### §G.1 Structural shape

- `metadata.version` matches `version.yml.forbidden_codes_version` (default `forbidden-v0.1`).
- `hard_blocked_codes` is a list / array.
- `hard_blocked_code_patterns` has the shape `{applies_to: string, patterns: [string]}`.
- `string_patterns_blocked_in_code` has the same shape.
- `hard_blocked_band_values` and `hard_blocked_action_values` are lists.
- `hard_blocked_verification_method_strength_values_in_v1` is a list / array of strings; v1 invariant: it MUST contain `'strong'`. (Reserved-not-emitted per signal-truth-v0.1 §11 + PR#3 OD-6. See §G.4.)
- `prefix_allowlist` is a list of allowed namespace prefixes.

### §G.2 CF-2 scope annotations

- `hard_blocked_code_patterns.applies_to === 'emitted_reason_codes_only'`. Required by CF-2 (post-PR#0 fix). Any other value → hard issue.
- `string_patterns_blocked_in_code.applies_to === 'source_code_strings_only'`. Required by CF-2.

### §G.3 Cross-dictionary consistency

For every code in `reason_code_dictionary.yml.codes`:

- The code name MUST NOT match any pattern in
  `hard_blocked_code_patterns.patterns`. (Defence: PR#0 wrote a clean
  dictionary; PR#4 verifies the dictionary stayed clean over time.)
- The code prefix MUST appear in `forbidden_codes.yml.prefix_allowlist`.

For every value:

- No `evidence_band` value in the dictionary policies / examples may
  appear in `hard_blocked_band_values` (e.g. `'high'` is forbidden).
- No `action_recommendation` example value may appear in
  `hard_blocked_action_values` (e.g. `'exclude'`, `'allow'`, `'block'`, `'deny'` are forbidden).

### §G.4 `verification_method_strength = 'strong'` reserved-not-emitted

Signal-truth §11 + OD-6 (PR#3): `'strong'` is a reserved-not-emitted
value for `verification_method_strength`. The live `forbidden_codes.yml`
records this via a dedicated top-level key:

```yaml
hard_blocked_verification_method_strength_values_in_v1:
  - strong
```

PR#4 validates **explicitly**:

1. `forbidden.hard_blocked_verification_method_strength_values_in_v1`
   exists as a top-level array. Missing → HARD issue.
2. The array contains the string `'strong'`. Missing → HARD issue.
   (Other values are tolerated — Helen may extend the list later.)
3. PR#4 does **not** treat `verification_method_strength` as a reason
   code; the CF-2 split keeps that field name out of
   `hard_blocked_code_patterns`. The field-name carve-out lives in
   PR#3 schema (CHECK `IS NULL`); PR#4 mirrors the value-side
   restriction at the contract layer.

The PR#3 DB schema already enforces `verification_method_strength IS NULL`
at the column-CHECK level; PR#4 is the *contract-level* twin of that
enforcement.

### §G.5 CI-grep readiness (Hard Rule D enforcement note)

A0 §K row PR#4 says "CI grep against `forbidden_codes.yml`". The
central PR#4 scoring-contract check satisfies that requirement by
running **two scope-separated steps**. Mixing them produces
self-referential false positives — most importantly, scanning
`scoring/forbidden_codes.yml` against its own
`string_patterns_blocked_in_code.patterns` is guaranteed to
"find" every forbidden source string because the file *is* the
pattern definition. Step A and Step B below are deliberately
distinct.

PR#4 does add a scoped source-code string grep for active scoring
code (Step B), but it does **not** re-scan every older PR surface and
does **not** scan `forbidden_codes.yml` against its own pattern
definitions.

**Step A — Semantic contract validation (scoring/*.yml only; NOT a
source-code grep).**

| What | Where | How |
| --- | --- | --- |
| Validate `scoring/version.yml` structure | `scoring/version.yml` | Per §H. |
| Validate `scoring/reason_code_dictionary.yml` structure | `scoring/reason_code_dictionary.yml` | Per §F. |
| Validate `scoring/forbidden_codes.yml` structure | `scoring/forbidden_codes.yml` | Per §G.1–§G.4. |
| Validate reason-code names against `hard_blocked_code_patterns.patterns` | The dictionary's code names checked against forbidden patterns. | §G.3 cross-dictionary consistency. Applies the pattern list semantically (regex match on the code names), NOT as a textual source-code grep. |
| Validate forbidden key/value lists exist | `scoring/forbidden_codes.yml` | `hard_blocked_codes`, `hard_blocked_band_values`, `hard_blocked_action_values`, `hard_blocked_verification_method_strength_values_in_v1`, `prefix_allowlist` are all present and well-shaped. |

Step A is **semantic**. It reads the contract YAMLs, applies the
contract's own patterns *against the contract's own data*, and asserts
internal consistency. It does **not** treat `forbidden_codes.yml`'s
`string_patterns_blocked_in_code.patterns` as a sweep against the YAML
files themselves (which would be self-referential and meaningless).

**Step B — Source-code string grep (active scoring code only).**

| Scope | In/out | Why |
| --- | --- | --- |
| `src/scoring/**` | **IN** | The PR#4 module + future PR#5/PR#6 scorer/worker code live here. Forbidden source strings must never appear in this tree. |
| `scripts/check-scoring-contracts.ts` (if OD-2/OD-3 confirm CLI) | **IN** | The CLI is active scoring-contract surface code. |
| `scoring/*.yml` (the three contract files themselves) | **OUT** | `forbidden_codes.yml` necessarily contains the blocked source-code strings *as pattern definitions* — sweeping it against its own patterns is self-referential. `reason_code_dictionary.yml` and `version.yml` carry contract metadata, not source code. Their *semantic* validation is Step A. |
| `tests/v1/scoring-contracts.test.ts` + `tests/fixtures/scoring-contracts/**` | **OUT** | Test files and malformed fixtures must legitimately name forbidden tokens; sweeping them produces self-referential false positives (same lesson as PR#3's `verification_score` carve-out). |
| `docs/**` | **OUT** | Prose explainers name forbidden tokens by necessity. |
| `migrations/**`, `src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`, `scripts/extract-behavioural-features.ts` | **OUT** | These paths are already covered by the existing PR#1 / PR#2 / PR#3 local sweeps. PR#4 does **not** replace those sweeps; it adds the orthogonal scoring-contract guard. |

Step B applies **only** `forbidden_codes.yml.string_patterns_blocked_in_code.patterns`
(the post-CF-2 source-code-strings-only list). It does **not** apply
`hard_blocked_code_patterns.patterns` here — that list is scoped to
*emitted reason codes*, used only at Step A's semantic check.

**Summary — what PR#4's central check is and is not.**

- **IS:** scoring YAML semantic validation (Step A) **plus** a scoped
  source-code grep on active scoring code (Step B).
- **IS NOT:** a blind `scoring/**` string sweep.
- **IS NOT:** a replacement for the PR#1 / PR#2 / PR#3 local sweeps —
  those continue to police their respective source surfaces.
- **IS NOT:** a scanner of `forbidden_codes.yml` against its own
  `string_patterns_blocked_in_code.patterns` (self-referential by
  construction).

**Exposure.** Step A + Step B run as a single `npm run check:scoring-contracts`
command (per OD-3). CI invokes that one command.

**Reuse of `forbidden_codes.yml` `.patterns` arrays.** Step B and the
PR#1 / PR#2 / PR#3 sweeps read the **same** `.patterns` array shape
(post-CF-2 annotated). PR#4's Step A guarantees the shape stays valid
for every consumer.

---

## §H `scoring/version.yml` validation plan

Top-level keys:

| Key | Expected value | PR#4 check |
| --- | --- | --- |
| `scoring_version` | `s2.v1.0` (v1 baseline) | String, non-empty. Mismatch with a Helen-confirmed value → hard issue. |
| `reason_code_dictionary_version` | `rc-v0.1` | String, must equal `reason_code_dictionary.yml.metadata.version`. Cross-check (§F.6). |
| `forbidden_codes_version` | `forbidden-v0.1` | String, must equal `forbidden_codes.yml.metadata.version`. |
| `status` | `record_only` | String, MUST be `'record_only'`. Any other value → hard issue. |
| `automated_action_enabled` | `false` | Boolean, MUST be `false`. Any `true` → hard issue. |
| `notes` | Block scalar | Presence-only; specific text not pinned. |

### §H.1 RECORD_ONLY gate invariants

`scoring/version.yml.notes` already describes the RECORD_ONLY gate
opening conditions (8 weeks + 500 medium-band reviews + 2 weeks
stability + no FP stop-the-line). PR#4 does **NOT** assert the gate is
closed (that is operational state, not contract state). PR#4 asserts
only:

- `status === 'record_only'`.
- `automated_action_enabled === false`.

If a future operator flips either field, PR#4 fails fast. Helen
explicitly approves any flip via a separate planning round.

### §H.2 No customer-facing activation flag

PR#4 confirms `version.yml` carries no key matching `customer_facing_*`,
`live_*`, `production_*`, `enabled_for_*` boolean=true. The
recommended check is a structural "unknown-top-level-key" guard plus
an explicit deny-list of customer-facing-activation key names.

---

## §I Type / API contract

The full TypeScript surface PR#4 exports. **All functions are pure**
(no DB, no HTTP, no process side-effects beyond `fs.readFileSync`).

```ts
// ------ contract shapes (validated at parse time) -------------------------

export interface VersionContract {
  scoring_version:                 string;
  reason_code_dictionary_version:  string;
  forbidden_codes_version:         string;
  status:                          'record_only';
  automated_action_enabled:        false;
  notes?:                          string;
}

export type ReasonCodeNamespace = 'A_' | 'B_' | 'REVIEW_' | 'OBS_';

export interface ReasonCodeEntry {
  meaning:                       string;   // dictionary uses `meaning`, not `description`
  can_route_to_review:           boolean;
  can_trigger_automated_action:  false;     // v1 invariant
  // …other optional fields tolerated…
}

export interface ReasonCodeDictionary {
  metadata:             { version: string; [k: string]: unknown };
  policies?:            { [k: string]: unknown };
  codes:                { [code: string]: ReasonCodeEntry };
  reserved_namespaces:  { [prefix: string]: unknown };
}

export interface ForbiddenCodes {
  metadata:                          { version: string; [k: string]: unknown };
  hard_blocked_codes:                string[];
  hard_blocked_code_patterns:        { applies_to: 'emitted_reason_codes_only'; patterns: string[] };
  hard_blocked_band_values:          string[];
  hard_blocked_action_values:        string[];
  // v1 invariant: this array MUST contain 'strong' (signal-truth §11 + PR#3 OD-6).
  hard_blocked_verification_method_strength_values_in_v1: string[];
  prefix_allowlist:                  string[];
  string_patterns_blocked_in_code:   { applies_to: 'source_code_strings_only'; patterns: string[] };
  sdk_payload_field_blocklist_followup?: { [k: string]: unknown };
}

export interface ScoringContracts {
  version:     VersionContract;
  dictionary:  ReasonCodeDictionary;
  forbidden:   ForbiddenCodes;
}

// ------ validation issues -------------------------------------------------

export interface ContractValidationIssue {
  contract: 'version' | 'dictionary' | 'forbidden';
  path:     string;
  message:  string;
  hard:     boolean;
}

// ------ public API --------------------------------------------------------

/**
 * Read the three YAML files from disk; parse them; return shapes
 * without validation. Throws on YAML parse error.
 * Default rootDir: repo root resolved via the loader's __dirname.
 */
export function loadScoringContracts(opts?: { rootDir?: string }): ScoringContracts;

/**
 * Apply every check in §F / §G / §H. Returns the issue list (empty
 * means PASS). Pure: no I/O.
 */
export function validateScoringContracts(c: ScoringContracts): ContractValidationIssue[];

/**
 * Load + validate. Throws (with the formatted issue list) if any HARD
 * issue is found. Returns the loaded shapes on PASS. This is the
 * function future PR#5 / PR#6 workers MUST call at startup.
 */
export function assertScoringContractsOrThrow(opts?: { rootDir?: string }): ScoringContracts;

/**
 * Helpers exposed for downstream scorers (Hard Rule C invocation).
 *
 * `isReasonCodeStructurallyAllowed` returns true iff the code is
 * *structurally* valid against the contract artefacts:
 *   - code resolves to a key under c.dictionary.codes
 *   - code's prefix is in c.forbidden.prefix_allowlist
 *   - code does not match any pattern in c.forbidden.hard_blocked_code_patterns.patterns
 *   - code's c.dictionary.codes[code].can_trigger_automated_action === false
 *
 * The "structurally" naming is deliberate. These helpers DO NOT decide
 * whether a code may be emitted by a given lane / worker / route. Lane
 * policy (e.g. "Lane A worker may emit A_*; Lane B observer may emit
 * B_*; v1 emits no UX_* even though prefix is reserved") is the
 * future worker/observer's responsibility, NOT PR#4's. See §F.7.
 *
 * `assertReasonCodeStructurallyAllowed` throws if the structural check
 * fails. It does NOT throw for lane-policy violations.
 */
export function isReasonCodeStructurallyAllowed(c: ScoringContracts, code: string): boolean;
export function assertReasonCodeStructurallyAllowed(c: ScoringContracts, code: string): void;

/**
 * Rule-reference resolution helpers (Hard Rule C startup invocation).
 *
 * `validateRuleReferences` accepts the list of `reason_code` strings
 * that a scorer's rule files reference (e.g. every code a future Stage 1
 * rule may emit) and returns one ContractValidationIssue per reference
 * that fails `isReasonCodeStructurallyAllowed`. The function pre-empts
 * the scorer's runtime emission path by validating at startup.
 *
 * `assertRuleReferencesOrThrow` is the throw-on-issue variant; future
 * PR#5 / PR#6 boot calls it with the full rule-reference list extracted
 * from their vendored Stage 0 / Stage 1 lib.
 *
 * PR#4 may ship these functions NOW even though no Stage 0 / Stage 1
 * rule file exists yet. PR#4 tests exercise them with synthetic
 * reference lists (e.g. ['A_REFRESH_BURST', 'A_NO_FOREGROUND_TIME']
 * for the happy path; ['A_DOES_NOT_EXIST'] for the fail path). This
 * is the "future-safe API" anchor — PR#5 / PR#6 import these without
 * needing a follow-up PR#4 amendment.
 */
export function validateRuleReferences(c: ScoringContracts, refs: string[]): ContractValidationIssue[];
export function assertRuleReferencesOrThrow(c: ScoringContracts, refs: string[]): void;
```

### §I.1 Public API discipline

- `loadScoringContracts` and `validateScoringContracts` are **separable**: tests can construct a `ScoringContracts` object from fixtures and call `validateScoringContracts` without touching the filesystem.
- `assertScoringContractsOrThrow` is the **only** function future workers should call.
- No function returns or accepts a `pg.Pool`, `pg.Client`, or any HTTP client.

---

## §J Test plan

### §J.1 Pure tests

`tests/v1/scoring-contracts.test.ts` (new). All pure; no DB; no HTTP.

| Group | Coverage |
| --- | --- |
| Load valid current contracts | Loading `scoring/version.yml` + `scoring/reason_code_dictionary.yml` + `scoring/forbidden_codes.yml` returns parsed shapes without error. |
| Validate valid current contracts | `validateScoringContracts(load())` returns empty issue list (PASS). |
| Hard Rule C cross-resolve | For every code in the dictionary, `isReasonCodeStructurallyAllowed(c, code)` matches the expectation derived from `can_trigger_automated_action`, prefix allowlist, and `hard_blocked_code_patterns`. |
| Hard Rule D forbidden | For each forbidden pattern, a *fabricated* code matching the pattern (e.g. `'A_BUYER_VERIFIED'` against `.*_VERIFIED$`) is rejected by `isReasonCodeStructurallyAllowed`. |
| Rule-reference helpers | `validateRuleReferences(c, ['A_REFRESH_BURST', 'A_NO_FOREGROUND_TIME'])` returns `[]` against the live dictionary; `validateRuleReferences(c, ['A_DOES_NOT_EXIST'])` returns one HARD issue with `path='rule_references[0]'` and a clear message. `assertRuleReferencesOrThrow` throws on the same fail-path input. |
| Helpers answer STRUCTURE, not lane policy | A test asserts that `isReasonCodeStructurallyAllowed(c, 'B_DECLARED_AI_CRAWLER')` returns `true` (the code is structurally valid) — lane-emission permission for `B_*` is the future Lane B observer's responsibility, not PR#4's (§F.7 + OD-4). |
| Malformed dictionary | Fixture files (OD-6): missing `version`, duplicate code key, code with `can_trigger_automated_action: true`, code with `UX_*` prefix, code with no `meaning`, code with legacy `can_trigger_action` field — each yields one HARD `ContractValidationIssue` with the right `path` + `message`. |
| Malformed forbidden | Fixture: `hard_blocked_code_patterns.applies_to !== 'emitted_reason_codes_only'`, missing `patterns`, `applies_to` typo. Each yields HARD issue. |
| Missing `verification_method_strength` block | Fixture: `forbidden_codes.yml` with `hard_blocked_verification_method_strength_values_in_v1` key absent → HARD issue with `path='hard_blocked_verification_method_strength_values_in_v1'`. Fixture with the key present but the array missing `'strong'` → HARD issue with a message pointing at the missing value (signal-truth §11 + PR#3 OD-6). |
| Malformed version | Fixture: `status !== 'record_only'`, `automated_action_enabled !== false`, missing `scoring_version`, cross-version mismatch. Each yields HARD issue. |
| OBS_* count cap | Fixture with 8 `OBS_*` codes yields HARD issue. |
| UX_* presence | Fixture with `UX_FAKE_CODE` in `codes:` yields HARD issue. |
| No DB imports | Grep PR#4 source: no `from 'pg'`, no `pg-pool`, no `pg.Pool`. |
| No HTTP imports | Grep PR#4 source: no `http`, `https`, `fetch`, `axios`, `got`, `node-fetch`. |
| No ML imports | Grep PR#4 source against `forbidden_codes.yml.hard_blocked_code_patterns.patterns` for ML import names (`sklearn`, `xgboost`, `torch`, `onnx`). |
| No collector imports | Grep PR#4 source: no `from '.*/src/collector/v1/*'`. |
| No app/server/auth imports | Grep PR#4 source: no `from '.*/src/{app,server,auth}/*'`. |
| No writer code | Grep PR#4 source: no `INSERT INTO scoring_output_lane_a` / `_b`. |
| No `pg_has_table_privilege` mention | Cleanup safety: the function name is `has_table_privilege`; PR#4 source must not mention the stale prefix form. |

### §J.2 No DB tests

PR#4 is pure. No `tests/v1/db/scoring-contracts.dbtest.ts` is planned.
If Helen later wants a DB-side cross-check (e.g. assert that
`scoring_output_lane_a` CHECK constraints match the dictionary's
allowed `evidence_band` enum), that becomes a follow-up task gated
separately.

### §J.3 No collector / app / server / auth imports

Verified by the test bullets in §J.1.

### §J.4 PR#4 central scoring-contract check — relationship to prior-PR sweeps

The existing forbidden-term sweeps in
`tests/v1/behavioural-features-extraction.test.ts`,
`tests/v1/scoring-output-contracts.test.ts`, and
`tests/v1/scoring-output-contracts.lint.test.ts` already read
`forbidden_codes.yml` `.patterns` and scope themselves to the
respective PR#1 / PR#2 / PR#3 source surfaces. PR#4 does **not**
duplicate those sweeps — they continue to police their own surfaces.

PR#4 adds the **orthogonal** scoring-contract guard required by A0 §K,
in the two-step form defined in §G.5:

- **Step A** (semantic): structural validation of `scoring/version.yml`,
  `scoring/reason_code_dictionary.yml`, `scoring/forbidden_codes.yml`,
  plus internal-consistency checks (dictionary code names against
  `hard_blocked_code_patterns.patterns`; presence of
  `hard_blocked_verification_method_strength_values_in_v1` containing
  `'strong'`).
- **Step B** (source-code grep): applies
  `string_patterns_blocked_in_code.patterns` to **active scoring code
  only** — `src/scoring/**` and `scripts/check-scoring-contracts.ts`
  (if OD-2/OD-3 confirm CLI). Excludes the contract YAMLs themselves
  (self-referential), the test files and fixtures (necessarily name
  forbidden tokens), docs prose, and every surface already covered by
  the PR#1 / PR#2 / PR#3 local sweeps.

PR#4 pure tests assert Step A + Step B both run and that Step B's scope
table matches §G.5 exactly (so a future refactor cannot silently widen
or narrow it). The `npm run check:scoring-contracts` command (per
OD-3) is the single entrypoint CI invokes for both steps.

---

## §K Verification / operator plan

PR#4 is a pure module. There is no SQL verification artefact and no
Hetzner DB migration.

### §K.1 If A0 / Helen requires a verification artefact

OD-7 invites Helen to choose between:

- **(a)** No verification artefact. PR#4's pure-test pass is the proof.
  CI runs `npm test` (which includes PR#4's tests) and `npm run check:scoring-contracts` (if OD-3 ships the script).
- **(b)** A static-check markdown report
  `docs/sql/verification/12_scoring_contracts_static_check.md` that
  documents *how to run* `npm run check:scoring-contracts` against a
  Hetzner working tree and what the expected output is. This is a
  proof-of-procedure doc, not SQL.
- **(c)** Both.

**Recommended default:** (a). PR#4 has no DB surface and no production
exposure. A "verification SQL" file under `docs/sql/verification/`
would be a misfile (the directory's prior files all interrogate DB
state). If Helen wants a procedure doc, (b) is the right form, not
SQL.

### §K.2 Why no Hetzner DB migration is expected

PR#4 writes no SQL, opens no DB connection, defines no table, alters
no role grant. The Hetzner staging proof for PR#4 is equivalent to:

```
git pull          # PR#4 branch on Hetzner
npm install       # picks up new `yaml` dependency (if OD-3 confirms)
npm test          # PR#4 pure tests + everything else
npm run check:scoring-contracts   # (if OD-3 ships the script)
```

No `psql`. No migration to apply. No row to read.

### §K.3 observe:collector relationship

`observe:collector` does not read the PR#4 module. PR#4 does not
affect collector boot. Helen's existing observe:collector PASS state
remains valid after PR#4 lands.

---

## §L Rollback plan

| Action | Effect |
| --- | --- |
| Revert PR#4 commit (or unstage PR#4 files) | Removes the loader module + tests + fixtures + (optional) CLI script. |
| `package.json` change (if OD-2 confirmed) | One reverted line in `dependencies`; `package-lock.json` reverts via `npm install`. |
| DB rollback | **none required** — PR#4 wrote no DDL and no DML. |
| Hetzner staging impact | **none** — staging carries no PR#4-specific state. |
| Render production impact | **none** — Render production never touched. |

Rollback is data-loss-free by construction.

---

## §M Open decisions for Helen (OD-1..OD-7)

The plan above assumes the conservative defaults. Helen confirms
each.

### OD-1 — Loader file location

**Recommendation:** `src/scoring/contracts.ts` (single file). Reason: naturally anchors the future `src/scoring/` tree that PR#5/PR#6 workers will populate; keeps the loader importable by short relative path from any later worker.

**Alternative:** `scoring/load-scoring-contracts.ts` (alongside the YAMLs). Colocates loader with inputs but breaks the `src/` convention.

**Helen choice:** `src/scoring/contracts.ts` (recommended) / `scoring/load-scoring-contracts.ts` / other.

### OD-2 — CLI script vs library-only

**Recommendation:** Both. Library module + a thin CLI runner that wraps `assertScoringContractsOrThrow()` and prints PASS / formatted issue list. CLI lives at `scripts/check-scoring-contracts.ts` (consistent with `scripts/extract-behavioural-features.ts` placement).

**Alternative:** Library-only (defer CLI to PR#5/PR#6 worker boot).

**Helen choice:** library + CLI / library-only.

### OD-3 — `package.json` script + new dependency

**Recommendation:** Add `package.json` script `check:scoring-contracts` that runs the CLI (if OD-2 = library + CLI). Add `yaml` (eemeli/yaml, MIT) as a runtime `dependencies` entry.

**Alternative for the dep:** `js-yaml` (slightly larger, more common). Hand-rolled regex parser is **rejected** as a maintenance trap.

**Helen choice:** add `yaml` (recommended) / add `js-yaml` / no new dep (then library-only with hand-rolled parser — not recommended).

### OD-4 — Strictness level for reserved `B_*` codes

**Recommendation:** **Structural-only.** PR#4's helper is named
`isReasonCodeStructurallyAllowed` (per §I) so the function answers
**only** dictionary-shape + forbidden-pattern + `can_trigger_automated_action: false` validity. It returns `true` for `B_*` codes because `B_DECLARED_AI_CRAWLER` / `B_SIGNED_AGENT` are structurally valid entries in the dictionary.

**Crucially:** structural validity is NOT lane-emission permission.
PR#4 does **not** authorise any worker to emit `B_*` codes. Lane-B
emission permission is the future PR#3b Lane B observer's
responsibility (Helen-approved OD-1 of PR#3 deferred router + observer
under their own gate). If a future caller wants a stricter "lane-aware"
check, that lives at the worker boundary — not in PR#4. Naming the
helper "structurally allowed" (rather than the prior "allowed for
emission") makes this boundary unambiguous and prevents any
downstream worker from mistaking PR#4 as a lane-policy authoriser.

**Alternative:** Couple PR#4 to PR#3b's policy by returning `false`
for `B_*` codes in v1. **Rejected.** It bakes lane policy into the
structural layer, which inverts the layering: lane policy belongs at
the worker boundary, not at the contract loader.

**Helen choice:** structural-only with helper renamed to `isReasonCodeStructurallyAllowed` / `assertReasonCodeStructurallyAllowed` (recommended) / lane-policy-coupled.

### OD-5 — PR#4 scope: startup guard only, or also future-worker import contract?

**Recommendation:** Startup guard only. PR#4 ships
`assertScoringContractsOrThrow()` as the function future workers MUST
call at boot. PR#4 does **not** define worker entrypoint conventions
or middleware hooks — those are PR#5/PR#6 concerns.

**Alternative:** PR#4 also exports a "worker boot wrapper" function (e.g. `runScorerWithContracts(workerFn)`) that future workers wrap with. Couples PR#4 to worker shape that PR#5/PR#6 has not yet defined.

**Helen choice:** startup guard only (recommended) / + worker boot wrapper.

### OD-6 — Malformed-contract fixtures: inline strings vs files

**Recommendation:** Fixture files under `tests/fixtures/scoring-contracts/`. Each malformed YAML lives as its own file (e.g. `dictionary-duplicate-code.yml`, `forbidden-missing-applies-to.yml`). Cleaner diffs, easier to extend, mirrors the deep-research source convention.

**Alternative:** Inline YAML template literals inside the test file. Self-contained but harder to read at scale (10+ fixtures).

**Helen choice:** fixture files (recommended) / inline.

### OD-7 — Hetzner staging proof for PR#4?

**Recommendation:** No DB proof needed. PR#4 has no DB surface. The Hetzner staging proof is reduced to: `git pull` + `npm install` + `npm test` + `npm run check:scoring-contracts` succeed on Hetzner. No `psql`, no migration. Helen captures the npm output in the PR's staging-proof note.

**Alternative:** No Hetzner proof at all (local pure test PASS is enough). Acceptable because PR#4 changes no DB / no env-coupled state.

**Helen choice:** lightweight Hetzner npm proof (recommended) / local-only.

---

## §N Go / no-go recommendation

### §N.1 Planning-only recommendation

**Recommended posture for THIS round:** ship this planning document
only. No code. No migration. No `schema.sql` change. No DB touch. No
`package.json` change. No `yaml` dependency added yet. Helen reviews,
signs off OD-1..OD-7, and Codex reviews the planning doc.

### §N.2 Implementation gate

**Implementation blocked until Helen signs OD-1..OD-7 and Codex
review of this planning document → PASS.**

Concretely, implementation of PR#4 may not begin until all of the
following hold:

1. Helen written sign-off on this planning document (matching the pattern used for PR#1 / PR#2 / PR#3 planning).
2. Helen explicit answers on **OD-1** (loader location), **OD-3** (YAML dependency choice + npm script), and **OD-4** (B_* strictness). OD-2, OD-5, OD-6, OD-7 may be confirmed-as-recommended without explicit revision.
3. Codex review of THIS planning document → PASS.
4. The PR#0 contract artefacts (`scoring/version.yml`, `scoring/reason_code_dictionary.yml`, `scoring/forbidden_codes.yml`) remain at their current Helen-signed values (`scoring_version: s2.v1.0`, `rc-v0.1`, `forbidden-v0.1`). Any bump to these versions requires a separate Helen approval and re-validates PR#4 against the new shape.

After all four hold:

1. A new branch from `sprint2-architecture-contracts-d4cc2bf` HEAD (currently `4318e024171b9c3331130ff27ea9677f47a1cd54`).
2. Implementation PR shipped under the §I file inventory.
3. Codex review of the implementation PR → PASS.
4. Hetzner lightweight proof per OD-7 (npm install + npm test + check:scoring-contracts succeed; no DB action).
5. No Render production exposure (A0 P-4 still blocking).

### §N.3 Out-of-scope reminder (the user's hard boundaries)

- No Render production
- No production DB
- No frontend / GTM / GA4 / LinkedIn / ThinSDK
- No collector deploy / `src/collector/v1/**` / `src/app.ts` / `src/server.ts` / `src/auth/**` touched
- No migration
- No `schema.sql` change
- No DB touch (no Postgres connection, no SQL, no INSERT)
- No scoring algorithm
- No Stage 0 worker
- No Stage 1 worker
- No router
- No Lane B observer
- No reason-code emission
- No INSERT INTO `scoring_output_lane_a` / `scoring_output_lane_b`
- No AI-agent / crawler taxonomy
- No customer-facing dashboard / report
- PR#1 / PR#2 / PR#3 implementation files unmodified
