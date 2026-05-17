# BuyerRecon Sprint 2 PR#16b — Lane A / Lane B Evidence Review Preview Observer

**Status.** IMPLEMENTATION. Read-only. No DB writes, no migrations,
no schema change, no collector / scoring change, no durable
Lane-A / Lane-B writer, no dashboard, no API route, no AMS repo
touch, no AMS runtime bridge, no Track-A import, no bad-traffic
test execution, no customer-facing automated scoring.

**Date.** 2026-05-17. **Owner.** Helen Chen, Keigen Technologies
(UK) Limited.

**Branch.** `buyerrecon-sprint2-pr16b-lane-ab-preview-observer`.

**Authority.**

- `docs/sprint2-pr16a-lane-ab-evidence-review-contract-planning.md`
  (merged `28ac0e6`) — the contract this preview obeys.
- `docs/sprint2-pr15a-evidence-review-snapshot-observer.md`
  (merged `a3cd369`) — the upstream snapshot the preview projects.
- `docs/product/evidence-review-pack-v0.1.md` (merged `a2f81dc`)
  — Phase-1 £1,250 service-led Evidence Review umbrella doc.

---

## 1. Purpose

PR#16b adds a **read-only Lane A / Lane B Evidence Review preview
observer** that applies the PR#16a contract to the PR#15a snapshot
output and renders a customer-shaped, internal-only preview Helen
can read alongside the customer's written Evidence Review.

The preview answers four questions Helen otherwise has to answer
by hand under deadline pressure:

1. Which Lane-A candidate observations exist in the window, and
   which evidence sources back them?
2. Which Lane-B internal observations exist, and which require a
   private founder-note prompt?
3. Which evidence gaps affect each lane?
4. What may be shown in the Evidence Review, what must stay
   internal, and what is the current Track-A readiness posture?

This is a preview, not a writer. No durable Lane-A or Lane-B table
is added. No customer-facing automated score is produced.

---

## 2. Scope

**New module:** `src/lane-ab-preview/`

| File | Purpose |
| --- | --- |
| `types.ts` | Frozen-literal `LANE_AB_PREVIEW_VERSION` ('lane-ab-preview-observer-v0.1'); preview boundary, Lane-A / Lane-B observation types, customer + internal wording rails, Track-A readiness note, composite report. |
| `preview.ts` | Pure `buildLaneABPreview(snapshot)` projection from `EvidenceReviewSnapshotReport` → `LaneABPreviewReport`. No I/O. |
| `report.ts` | Pure `renderLaneABPreviewMarkdown(report)` — markdown with 10 required sections; every dynamic value routed through PR#15a `sanitizeOutputText`. |
| `index.ts` | Public re-exports. |

**New CLI:** `scripts/lane-ab-preview-report.ts`.

- Chains `runEvidenceReviewSnapshot` → `buildLaneABPreview` →
  `renderLaneABPreviewMarkdown`.
- Masked-DSN print (host + db name only).
- Exits `2` on missing / malformed env; `0` on success.

**New tests:** `tests/v1/lane-ab-preview.test.ts` — 11 groups
(A..K), 29 assertions; pure (no DB), constructs synthetic
`EvidenceReviewSnapshotReport` literals.

**New package script:** `observe:lane-ab-preview`.

**New doc:** this file.

Nothing else is modified. No SQL. No schema. No migration. No
collector. No scoring. No durable writer. No AMS repo touch. No
Track-A repo touch.

---

## 3. Report sections

The renderer emits exactly the 10 sections the PR#16b spec
requires, in this order:

| § | Section | Source |
| --- | --- | --- |
| §1 | Boundary | Preview + snapshot version stamps, workspace_id, site_id, window, checked_at, masked DB host + name. |
| §2 | Source availability summary | Per-evidence-source row from `snapshot.source_availability`. |
| §3 | Lane A preview — customer-safer evidence-quality observations | Lane-A observation table: family, evidence source, aggregate count, manual-review-needed flag, cannot-verify-yet reason. |
| §4 | Lane B preview — internal-only buyer-motion / product-context / timing observations | Lane-B observation table: family, evidence source, aggregate count, missing-evidence bucket, private founder-note prompt. |
| §5 | Evidence gaps affecting Lane A | Snapshot Lane-A gaps + accepted-events / risk / window gaps. |
| §6 | Evidence gaps affecting Lane B | Snapshot Lane-B gaps + session-feature / POI / ProductFeatures / window gaps. |
| §7 | What may be shown in an Evidence Review | Allowed customer-facing wording + forbidden customer-facing wording (PR#16a §8 verbatim). |
| §8 | What must stay internal | Lane-B internal-only categories + forbidden anywhere-customer-facing fields. |
| §9 | Track A readiness note | `track_a_run_in_this_pr: false`; posture (4 lines); forbidden leakage (7 surfaces). |
| §10 | Final boundary | No durable writer / no score / no identity / no ROI / no AMS bridge / no `ProductDecision` / no `RequestedAction` / no Track-A label leakage / no DB writes / private notes outside repo. |

---

## 4. Lane A observation families

`buildLaneAObservation` produces one row per candidate count from
`snapshot.lane_a_candidates`, plus one row per snapshot-recorded
Lane-A gap:

- `rejected_event` (from `rejected_events`)
- `stage0_excluded` (from `stage0_decisions`)
- `risk_corroboration` (from `risk_observations_v0_1`)
- `evidence_chain_gap` (one row per Lane-A gap string)

Rules:

- `aggregate_count = null` → `cannot_verify_yet_reason` filled,
  `manual_review_needed = true`.
- `aggregate_count = 0` → "zero rows in window; treat as no
  evidence rather than a negative finding", `manual_review_needed
  = false`.
- `aggregate_count > 0` → `cannot_verify_yet_reason = null`,
  `manual_review_needed = true`.

A non-zero count is itself a flag for **manual review**, never an
automated verdict. Per PR#16a §3 Lane A, the posture is
"candidate observations", never "scores".

---

## 5. Lane B observation families

`buildLaneBObservation` produces one row per Lane-B coverage
count:

- `buyer_motion_hypothesis` (from `poi_observations_v0_1`)
- `buyer_motion_hypothesis` (from `poi_sequence_observations_v0_1`)
- `product_context_hypothesis` (from `session_features`)
- `timing_window_hypothesis` (from `session_behavioural_features_v0_2`)
- `evidence_pipeline_coverage` (from `stage0_decisions` eligible split)

Each row carries a `private_founder_note_prompt` — a question
Helen reviews in the private engagement folder. The prompt is
**not** customer-facing copy; it is a question for Helen's
private notes.

Per PR#16a §3 Lane B, the posture is "internal observation",
"founder review input", and "manually rewritten and bounded".
**No** Lane-B observation is pasted verbatim into a customer
review.

---

## 6. Sanitization

Every dynamic value rendered by `report.ts` flows through
`sanitizeOutputText` from `src/evidence-review-snapshot/sanitize.ts`.
The PR#15a sanitizer trio handles:

- emails (`<redacted-contact>`)
- bearer / basic auth / Authorization / Cookie / Set-Cookie
  (`<redacted-auth>`)
- user-agent strings (`<redacted-user-agent>`)
- URLs with or without query strings
  (`<redacted-url-with-query>` / `<redacted-url>`)
- query-string fragments (`<redacted-query-string>`)
- UUIDs (`<redacted-uuid>`)
- IPv4 / IPv6 (`<redacted-address>`)
- session IDs (`<redacted-session>`)
- JWTs (`<redacted-token>`)
- token-prefix strings — `sk_`, `pk_`, `tok_`, `secret_`,
  `token_`, `sess_`, `ses_` (`<redacted-token>`)
- raw JSON blobs (`<redacted-json>`)
- long tokens ≥ 40 chars (`<redacted-token>`)
- forbidden field names (`<redacted-field>`)

The preview renderer is defence-in-depth: even though the
PR#15a snapshot already pre-sanitizes its own boundary +
notes, the preview re-routes through `sanitizeOutputText`
before any value reaches stdout.

Test Group G (4 assertions) injects each tainted shape into a
synthetic snapshot field and verifies the rendered markdown
contains the `<redacted-…>` marker, never the raw value.

---

## 7. Track A relationship

PR#16b does **not** run Track A. PR#16b does **not** import
Track A. Track A remains separate and RECORD_ONLY per the
PR#16a contract.

The preview's §9 readiness note documents:

- `track_a_run_in_this_pr: false`.
- Track A posture (4 lines, PR#16a §6 verbatim).
- Forbidden-leakage list across 7 surfaces (live URLs, UTMs,
  dataLayer, GA4, cookies / storage, backend DB, customer report
  text).

Test Group F (3 assertions) enforces that "Track A" appears
**only** inside §9 and §10. Lane-A and Lane-B observation
sections (§3..§6) never mention Track A.

---

## 8. Boundary rules carried forward from PR#16a

| Rule | Where enforced |
| --- | --- |
| Read-only, no DB writes | Module imports zero query helpers; only the CLI opens a pg pool, and only to run the PR#15a snapshot. |
| No per-visitor / per-session score | Test Group D (2 assertions) scans the rendered markdown for decimal-score shapes and observation fields for `score` / `buyer_intent_score`. |
| No `ProductDecision` / `RequestedAction` outside the forbidden-boundary text | Test Group E (3 assertions) splits the markdown by `## §N` heading and verifies the tokens appear ONLY in §8 internal-only rails + §10 final boundary. |
| No Track-A label inside Lane-A / Lane-B observations | Test Group F. |
| No customer private notes in repo | The preview emits a `private_founder_note_prompt` per Lane-B observation as a question for Helen's notes — never a customer name or detail. |
| Deterministic output | Test Group H (2 assertions) confirms same input → same JSON, same markdown. |
| Missing-source resilience | Test Group I (3 assertions) confirms all-null inputs produce "cannot verify yet" rows and the renderer does not throw. |

---

## 9. CLI usage

```
DATABASE_URL='postgres://…'
OBS_WORKSPACE_ID=workspace_real
OBS_SITE_ID=site.example.com
OBS_WINDOW_HOURS=720
npm run observe:lane-ab-preview
```

Optional:

- `OBS_SINCE` / `OBS_UNTIL` — ISO-8601 overrides for the window.

Exit codes:

- `0` — preview markdown rendered to stdout.
- `2` — missing / malformed env, or upstream snapshot failure.

The CLI never prints the full `DATABASE_URL`; only the masked
host + db name pass through `parseDatabaseUrl`.

---

## 10. Future PR map

| PR | Status |
| --- | --- |
| **PR#16b** (this PR) | Read-only Lane-A / Lane-B preview observer. **Implemented in this branch.** |
| **Track-A test run** | Outside backend. RECORD_ONLY. May run in parallel after PR#16b merges. |
| **PR#16c (optional)** | Track-A safe-summary contract — planning only. Skip unless Helen wants to surface test-observation categories in the report. |
| **PR#17a** | Durable Lane-A / Lane-B table **planning only**. Only after PR#16b ships and customer evidence justifies persistence. |
| **PR#17b+** | Durable Lane-A / Lane-B writer **implementation**. Only after PR#17a + Codex approval + Helen sign-off. |

Explicitly NOT recommended:

- AMS runtime bridge (paused since AMS PR#A7).
- Customer-facing automated scoring (forbidden until a separate
  Helen-signed PR defines score semantics + audit trail).
- Direct Track-A → backend DB import (forbidden until PR#16c
  contract + a writer PR).

---

## 11. Validation result

- `npx tsc --noEmit` — PASS.
- `npm test -- tests/v1/lane-ab-preview.test.ts` — 29 / 29 PASS.
- `npm test` (full suite) — 3137 / 3137 PASS across 54 files.
- `git diff --check` — clean.

---

## 12. Stop-the-line conditions

PR#16b inherits PR#16a §11 stop-the-line conditions verbatim. In
particular:

- A future PR that surfaces a per-session score in the Lane-A or
  Lane-B preview without a separate Helen-signed score-semantics
  PR is stop-the-line.
- A future PR that imports Track-A data into Lane-A or Lane-B
  observations without the PR#16c safe-summary contract is
  stop-the-line.
- A future PR that emits `ProductDecision` or `RequestedAction`
  inside the preview outside the §8 / §10 forbidden-boundary
  text is stop-the-line.

---

**End of PR#16b Lane A / Lane B Evidence Review Preview Observer.**
