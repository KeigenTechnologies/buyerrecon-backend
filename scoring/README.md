# `scoring/` — Sprint 2 signal-truth contract artefacts

> **Status:** Sprint 2 PR#0 — docs / config only.
> **No implementation code may start against these files until this PR is reviewed and signed off by Helen.**

## What this directory is

This directory holds the canonical Sprint 2 signal-truth scoring contracts:

| File | Purpose |
|---|---|
| `reason_code_dictionary.yml` | Source-of-truth list of every emitted `reason_code`. Scorer startup refuses to emit any code not listed here. |
| `forbidden_codes.yml` | Hard-blocked reason codes, regex patterns, evidence-band values, action values, and source-code string patterns. Scorer + CI grep + pre-commit hook all read this. |
| `version.yml` | Single-source-of-truth version stamps (`scoring_version`, `reason_code_dictionary_version`, `forbidden_codes_version`) + v1 operating-mode flags. |

The full contract that governs these files is in `docs/contracts/signal-truth-v0.1.md` (a copy of the canonical Sprint 2 contract under `docs/deepresearch/sprint 2/`).

## v1 operating mode (RECORD_ONLY)

- `status: record_only` in `version.yml`.
- `automated_action_enabled: false`.
- `can_trigger_automated_action` MUST be `false` for every reason code in `reason_code_dictionary.yml`.
- `action_recommendation` is restricted to `record_only` or `review`. **No code in v1 may trigger automated exclude / block / allow / deny / permit / approve.**

These invariants are enforced by:

1. **Scorer startup assertions.** When the scorer first loads `reason_code_dictionary.yml`, it asserts every entry has `can_trigger_automated_action: false` and the legacy `can_trigger_action` field is absent.
2. **`forbidden_codes.yml` allowlists.** `hard_blocked_action_values` blocks `exclude`/`block`/`deny`/`allow`/`permit`/`approve`/`flag`/`quarantine` at scorer startup.
3. **Hard Rules A–I** in `docs/contracts/signal-truth-v0.1.md` §10.

## File-by-file contract summary

### `reason_code_dictionary.yml`

- Source of every `A_*`, `B_*`, `REVIEW_*`, `OBS_*` reason code emitted in v1.
- Each entry carries: `lane`, `meaning`, `minimum_evidence`, `max_band`, `customer_facing`, `contributes_to_band`, `can_route_to_review`, `can_trigger_automated_action` (and optional `reserved_until_*` flags).
- **Post-CF-3**: the legacy single field `can_trigger_action` has been removed; every entry now carries the two explicit fields `can_route_to_review` + `can_trigger_automated_action`. In v1 the second is always `false`.
- OBS_* cap: 7 emitted in v1. Currently 5 in use. Adding the 8th requires Helen sign-off + `scoring_version` bump.

### `forbidden_codes.yml`

- Disjoint scope domains, each with an `applies_to` annotation **post-CF-2**:
  - `hard_blocked_code_patterns` — `applies_to: emitted_reason_codes_only`. Regex patterns evaluated against emitted `reason_code` strings only. Schema field names (e.g. `verification_method_strength`) are NOT subject to these patterns.
  - `string_patterns_blocked_in_code` — `applies_to: source_code_strings_only`. Substring patterns scanned by the pre-commit hook against staged source files.
- Also blocks: forbidden literal codes, forbidden `evidence_band` values, forbidden `action_recommendation` values, forbidden `verification_method_strength` values in v1 (`strong` reserved).

### `version.yml`

- Bumping any version requires Helen sign-off per `docs/contracts/signal-truth-v0.1.md` §13 + `docs/architecture/ARCHITECTURE_GATE_A0.md` §0.7.

## What this PR does NOT include

This is Sprint 2 PR#0 — **docs and config only**. Explicitly out of scope:

- ❌ No scorer code.
- ❌ No feature extractor (`behavioural_features_v0_2` extractor lives in Sprint 2 PR#1).
- ❌ No DB migration.
- ❌ No `src/`, `scripts/`, `migrations/` changes.
- ❌ No `render.yaml` or `Dockerfile` changes.
- ❌ No Render production change.
- ❌ No SDK rollout.

Sprint 2 implementation PRs (PR#1 through PR#10 per Architecture Gate A0 §K) may start only after this PR is reviewed and signed off.

## Architecture authority

- `docs/architecture/ARCHITECTURE_GATE_A0.md` — master architecture gate (Helen-approved at commit `a87eb05`).
- `docs/contracts/signal-truth-v0.1.md` — canonical Sprint 2 contract.

## Helen sign-off

Before Sprint 2 PR#1 begins, Helen confirms in writing (per A0 §0.7):

- This PR (Sprint 2 PR#0) is approved.
- CF-1 verified (one Hard Rule G in signal-truth-v0.1.md §10).
- CF-2 verified (`applies_to` annotations present on both `hard_blocked_code_patterns` and `string_patterns_blocked_in_code`).
- CF-3 verified (no entry contains the legacy `can_trigger_action`; every entry carries `can_route_to_review` + `can_trigger_automated_action: false`).
- The `scoring_version: s2.v1.0` baseline is acceptable.

Until that sign-off, no Sprint 2 implementation code is written, no Render production migration is applied, no live SDK rollout begins.
