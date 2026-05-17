# Sprint 2 PR#15a — Evidence Review Snapshot Observer

**Status.** IMPLEMENTATION. Read-only internal diagnostic CLI to
support the Phase-1 £1,250 BuyerRecon Evidence Review. **No DB
writes. No durable Lane-A / Lane-B writer. No customer-facing
automated scoring. No AMS runtime bridge.**

**Date.** 2026-05-16. **Owner.** Helen Chen, Keigen Technologies
(UK) Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` — Track-A
  / Track-B separation + workflow truth file.
- `docs/product/evidence-review-pack-v0.1.md` (commit `a2f81dc`)
  — Phase-1 £1,250 service-led Evidence Review umbrella doc.
- `docs/product/evidence-review-sample-report-v0.1.md` — the
  customer-readable shape the snapshot supports.
- `docs/product/evidence-review-install-checklist-v0.1.md` —
  the pre-install / smoke-test / readiness flow.
- AMS PR#A7 merge `a6855a5` — AMS-side runtime-bridge work paused.

---

## §1 PR#15a scope

PR#15a is a **read-only observer CLI** that reads existing
BuyerRecon evidence tables (`accepted_events`, `rejected_events`,
`ingest_requests`, `session_features`,
`session_behavioural_features_v0_2`, `stage0_decisions`,
`risk_observations_v0_1`, `poi_observations_v0_1`,
`poi_sequence_observations_v0_1`) and produces an internal,
founder-readable markdown report that helps Helen prepare the
written Evidence Review for a customer engagement.

PR#15a produces NO:

- DB writes.
- Migrations or `schema.sql` changes.
- Collector runtime change.
- Scoring logic change.
- Customer-facing automated scoring output.
- Durable Lane-A or Lane-B writer table.
- Dashboard code.
- API route.
- AMS repo change.
- AMS runtime bridge.
- `ProductDecision` / `RequestedAction`.
- Customer private notes committed to the repo (those stay in
  `/Users/admin/buyerrecon-engagements/`, outside any git repo).

The snapshot is the **operator's view** before Helen writes the
customer-facing Evidence Review.

---

## §2 Files in this PR

| Path | Role |
| --- | --- |
| `src/evidence-review-snapshot/types.ts` | Frozen-literal version stamp, result types, readiness-bucket enum. |
| `src/evidence-review-snapshot/sanitize.ts` | `stripQueryString`, `truncateSessionId`, `parseDatabaseUrl`, forbidden-field-name list, raw-URL-with-query and email-shape regexes. |
| `src/evidence-review-snapshot/sql.ts` | Table catalogue (9 tables + their time columns), `to_regclass`-based existence check, parameterised window-count SQL builder, stage-0 excluded / eligible counts. SELECT-only. |
| `src/evidence-review-snapshot/runner.ts` | `runEvidenceReviewSnapshot(args)` — orchestrates probes, aggregates counts, computes evidence gaps, readiness bucket, founder-notes prompt. |
| `src/evidence-review-snapshot/report.ts` | `renderEvidenceReviewSnapshotMarkdown(report)` — markdown emitter for the 9 spec sections. |
| `src/evidence-review-snapshot/index.ts` | Public re-exports. |
| `scripts/evidence-review-snapshot-report.ts` | CLI runner — env parse, masked DSN, exit-code propagation. |
| `package.json` | One new script — `observe:evidence-review-snapshot`. |
| `tests/v1/evidence-review-snapshot.test.ts` | 14-requirement coverage (Groups A–N) + static-source DML/DDL guard + version-stamp regression guard. |
| `docs/sprint2-pr15a-evidence-review-snapshot-observer.md` | This implementation doc. |

**No changes** to: migrations, `schema.sql`, DB, AMS repo,
collector runtime, scoring logic, any other observer's code, CI
workflows.

---

## §3 Tables read (all optional)

| Table | Time column | Purpose in the snapshot |
| --- | --- | --- |
| `accepted_events` | `received_at` | Collector volume baseline. |
| `rejected_events` | `received_at` | Lane-A bad-traffic candidate count (Helen's eyes only). |
| `ingest_requests` | `received_at` | Total inbound volume cross-check. |
| `session_features` | `last_seen_at` | Session-level coverage; required for buyer-motion review. |
| `session_behavioural_features_v0_2` | `extracted_at` | Behavioural depth (burst, dwell, interaction density). |
| `stage0_decisions` | `created_at` | Stage-0 gating; `excluded=true` feeds Lane-A, `excluded=false` feeds Lane-B. |
| `risk_observations_v0_1` | `created_at` | Lane-A risk-side corroboration. |
| `poi_observations_v0_1` | `created_at` | Buyer-motion shape evidence. |
| `poi_sequence_observations_v0_1` | `created_at` | Multi-touch buyer-motion shape evidence. |

Every table is checked via `to_regclass($1)` before any count
query. A missing table is reported as `exists: false` with note
`"table not present in schema"` — the observer never crashes
on missing tables and never proposes a migration.

A count query that fails (e.g. column shape mismatch in a future
schema drift) is caught and reported as
`note: "count query failed (column shape mismatch?): …"`. The
snapshot continues to render every other section.

---

## §4 Report sections (§1 → §9)

1. **Boundary** — observer version stamp, workspace_id, site_id,
   window range, checked_at, masked database host + name.
2. **Source availability** — per-table existence + window-row
   count + optional note.
3. **Evidence chain summary** — flat counts of all 9 tables.
4. **Lane A candidate observations** — rejected event count,
   stage-0 excluded count, risk-observation rows. Carries the
   verbatim label: *"Lane A candidate observations are evidence-
   review inputs, not automated customer-facing scores."* Plus
   evidence-gap list affecting Lane-A confidence.
5. **Lane B internal observations** — POI / POI-sequence row
   counts, session-feature coverage, behavioural-feature coverage,
   stage-0 eligible count. Carries the verbatim label: *"Lane B
   observations are internal learning inputs only and must not be
   exposed as customer-facing claims."*
6. **Evidence gaps** — nine boolean flags + free-form summary
   notes (e.g. window too short, accepted_events empty, etc.).
7. **Evidence Review readiness** — one of four operator buckets
   (NOT a numeric score):
   - `STOP_THE_LINE` — collector layer empty.
   - `INSTALL_OR_DATA_GAP` — accepted_events present but features
     pipeline empty.
   - `NEEDS_MORE_EVIDENCE` — features present but POI/risk empty,
     or window too short.
   - `READY_FOR_MANUAL_REVIEW` — accepted_events + features + at
     least one downstream observation table populated.
   Each bucket comes with an explicit *operator action* line.
8. **Founder notes prompt** — copyable into the private customer
   folder. Five subsections:
   - what looks verifiable?
   - what remains unknown?
   - what should NOT be claimed?
   - what needs customer confirmation?
   - what to check in GA4 / CRM / customer-side analytics?
9. **Final boundary** — explicit list of what this snapshot does
   NOT produce (durable Lane-A/B writer, customer score, identity
   resolution, ROI claim, AMS runtime bridge, `ProductDecision`,
   `RequestedAction`, DB writes). AMS-runtime-bridge and
   ProductDecision/RequestedAction wording is confined to this
   section.

---

## §5 Sanitization guarantees

The output renderer treats **all** CLI / env / DB text as
untrusted. Three sanitizers in `sanitize.ts` form the boundary:

- `sanitizeOutputText(value)` — generic untrusted-text scrubber
  applied to every dynamic markdown value. Redacts emails
  (→ `<redacted-contact>`), URLs with query strings, bare URLs,
  raw query-string fragments, AMS-canonical-auth headers
  (Bearer / Basic / Authorization / Cookie), user-agent strings,
  UUIDs, IPv4 / conservative IPv6 address shapes, full
  `ses_…` session-id-shaped values, JWT-like tokens,
  token-prefix shapes (`sk_`, `pk_`, `tok_`, `secret_`,
  `token_`, `sess_`, `ses_`), JSON-shaped blobs, long
  token-like strings (≥ 40 char alphanumerics), and every
  forbidden field name
  (`token_hash`, `ip_hash`, `user_agent`, `ua`, `ip`, `cookie`,
  `authorization`, `bearer`, `pepper`, `email`, `person_id`,
  `visitor_id`, `company_id`, `account_id`, `phone`, etc.).
- `sanitizeBoundaryLabel(value, fallback)` — strict structural
  validator applied to caller-controlled boundary labels
  (`workspace_id`, `site_id`). Allowed grammar:
  `^[A-Za-z0-9_.:\-]{1,96}$`, no whitespace, no `/?&=@%`, no
  email / URL / user-agent / token / UUID / IP / session-id
  shapes. Unsafe labels render the explicit fallback
  `<redacted-unsafe-workspace-id>`
  or `<redacted-unsafe-site-id>` — the unsafe value never reaches
  stdout. The observer does NOT fail closed on an unsafe boundary
  label; it renders the fallback so Helen can still read the
  snapshot.
- `sanitizeErrorNote(value)` — DB / system error notes never
  echo raw `err.message`. The function always returns
  `count query failed (sanitized database error)`, a generic
  diagnostic with no leak surface. A future PR may extend it if
  diagnostic value is required.

In addition:

- **DSN masked.** `parseDatabaseUrl()` returns host + db name
  only; password / scheme are never printed. The masked
  fragments are then routed through `sanitizeOutputText` as
  defense-in-depth. Test verifies password literal `s3cret` is
  absent and `postgres://` does not appear.
- **No full session_id emitted.** If any session-id sample is
  ever carried, `truncateSessionId()` reduces it to
  `prefix(8)…suffix(4)`.
- **No raw URLs with query strings, no email-shape values, no
  query-string fragments, no UUIDs, no IP-shaped values, no
  full session-id-shaped values, no JWT-like / short token-prefix
  tokens, no long tokens** in any rendered markdown — test
  groups D/E/F and Codex-blocker groups A–H scan for each.
- **Counts and buckets only.** No per-row PII fields are read
  from any table; only aggregate `COUNT(*)` queries plus
  existence checks.

The renderer's `safe()` helper additionally routes every dynamic
markdown value through `sanitizeOutputText` before placing it in
a table cell, so a future caller that forgets to sanitize cannot
bypass the boundary.

---

## §6 SQL boundary

The observer issues only these SQL shapes:

1. `SELECT to_regclass($1) IS NOT NULL AS exists` — table presence.
2. `SELECT COUNT(*)::bigint AS n FROM <table> WHERE workspace_id = $1 AND site_id = $2 AND <time_col> >= $3 AND <time_col> < $4` — window count.
3. `SELECT COUNT(*)::bigint AS n FROM stage0_decisions … AND excluded IS TRUE/FALSE` — stage-0 exclusion split.

A static-source guard in the test file confirms no `INSERT`,
`UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, or `TRUNCATE`
keyword appears in any runtime file. Table and column names are
validated against `/^[a-z_][a-z0-9_]*$/` before being interpolated
into the count SQL builder.

---

## §7 CLI usage

```bash
DATABASE_URL=postgres://user:password@host:5432/buyerrecon_staging \
OBS_WORKSPACE_ID=buyerrecon_staging_ws \
OBS_SITE_ID=customer.example.test \
OBS_WINDOW_HOURS=168 \
  npm run observe:evidence-review-snapshot | tee /tmp/snapshot.md
```

| Env var | Required | Default |
| --- | --- | --- |
| `DATABASE_URL` | yes | — |
| `OBS_WORKSPACE_ID` | yes | — |
| `OBS_SITE_ID` | yes | — |
| `OBS_WINDOW_HOURS` | no | 720 (30 days) |
| `OBS_SINCE` / `OBS_UNTIL` | no | derived from window-hours |

Exit codes:

- `0` — markdown rendered to stdout. Some tables may be absent;
  the snapshot still renders.
- `2` — env error (missing required var) or SQL/connection
  failure. Stderr carries a controlled error message; no secrets.

---

## §8 Test coverage (24 tests, groups A–N + 2 guards)

- **A** all 9 spec sections render with correct headings.
- **B** missing table → "table not present in schema"; count-query
  failure → "count query failed (column shape mismatch?)"; neither
  crashes.
- **C** masked DSN — password absent, host+db only.
- **D/E/F** no forbidden field names, no email-shape values, no
  raw URL with query string, `stripQueryString` cleanly trims `?`
  + `#`, `truncateSessionId` never returns the full ID.
- **G/H** Lane A label "candidate observations are evidence-review
  inputs, not automated customer-facing scores" verbatim; Lane B
  label "internal learning inputs only" verbatim.
- **I/J** `ProductDecision` / `RequestedAction` / "AMS runtime
  bridge" appear only in §9 final-boundary block.
- **K** readiness bucket is a string label (`READY_FOR_MANUAL_REVIEW`
  / `NEEDS_MORE_EVIDENCE` / `INSTALL_OR_DATA_GAP` /
  `STOP_THE_LINE`); each bucket triggered by the expected stub
  scenario.
- **L** deterministic — two runs over the same stub produce
  byte-identical markdown.
- **M** zero-row tables render `0` for present-but-empty, `—` for
  absent.
- **N** §8 founder-notes prompt carries all 5 subsections; the
  "should NOT be claimed" list explicitly forbids per-visitor
  scores, identity resolution, and ROI claims.
- **static-source guard** no DML/DDL keyword in any runtime file.
- **version-stamp regression** `SNAPSHOT_OBSERVER_VERSION` ==
  `'evidence-review-snapshot-observer-v0.1'`.

---

## §9 Validation results (this branch)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `git diff --check` | clean |
| `npm test -- tests/v1/evidence-review-snapshot.test.ts` | **24 / 24** PASS |
| `npm test` (full suite) | **53 files / 3089 tests** PASS |
| No-DB smoke: `env -u DATABASE_URL npm run observe:evidence-review-snapshot` | exit `2`, controlled stderr `DATABASE_URL is required (host + db name will be printed; full URL is never printed)`, no full URL leaked |

Hetzner staging proof is recorded below under "Hetzner staging
proof — PASS" (PR#15b, docs-only proof closure, mirrors the
PR#12d / PR#13b / PR#14c cadence).

---

## Hetzner staging proof — PASS

**Date.** 2026-05-17. **Server.** `/opt/buyerrecon-backend`.
**Branch.** `sprint2-architecture-contracts-d4cc2bf`.
**HEAD.** `a3cd369` — `Sprint 2 PR#15a: add evidence review
snapshot observer (#2)`.
**Final server working tree.** Clean (after restoring server-side
`package-lock.json` changes caused by `npm install`).

### Staging environment

| Field | Value |
| --- | --- |
| `OBS_WORKSPACE_ID` | `buyerrecon_staging_ws` |
| `OBS_SITE_ID` | `buyerrecon_com` |
| `OBS_WINDOW_HOURS` | `720` |
| Database | Hetzner staging — `buyerrecon_staging` on `127.0.0.1` (masked at the observer boundary) |

### Static validation on server

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm test -- tests/v1/evidence-review-snapshot.test.ts` | **43 / 43** PASS (24 base groups + 8 Codex-blocker A–H + sanitizer unit + IPv4 / IPv6 / JWT / session-id / token-prefix coverage) |
| `npm test` (full suite) | PASS |
| `git diff --check` | clean |

### Observer run

```bash
OBS_WORKSPACE_ID=buyerrecon_staging_ws \
OBS_SITE_ID=buyerrecon_com \
OBS_WINDOW_HOURS=720 \
  npm run observe:evidence-review-snapshot
```

**Readiness bucket.** `READY_FOR_MANUAL_REVIEW`.

### Source-availability counts (in 720h window, observer reads)

| Table | Rows in window |
| --- | --- |
| `accepted_events` | 16 |
| `rejected_events` | 0 |
| `ingest_requests` | 16 |
| `session_features` | 8 |
| `session_behavioural_features_v0_2` | 16 |
| `stage0_decisions` | 8 |
| `risk_observations_v0_1` | 2 |
| `poi_observations_v0_1` | 8 |
| `poi_sequence_observations_v0_1` | 8 |

### Lane A candidate observations (evidence-review inputs, NOT scores)

| Field | Value |
| --- | --- |
| `rejected_event_count` | 0 |
| `stage0_excluded_count` | 6 |
| `risk_observation_rows_with_evidence` | 2 |

### Lane B internal observations (internal learning only, NOT customer-facing)

| Field | Value |
| --- | --- |
| `poi_observation_rows` | 8 |
| `poi_sequence_observation_rows` | 8 |
| `session_features_coverage_rows` | 8 |
| `session_behavioural_features_coverage_rows` | 16 |
| `stage0_eligible_count` | 2 |

### Evidence gaps surfaced

- `missing_productfeatures_observations`: **yes** (expected — the
  PR#14c ProductFeatures observer is CLI-only and writes no
  durable table; re-run that observer if product-context coverage
  is required for the engagement).
- All other gap booleans: false for this window.

### Forbidden-output scans

| Scan | Result |
| --- | --- |
| `grep -Ei "token_hash\|ip_hash\|user_agent\|raw_payload\|canonical_jsonb\|postgres://\|authorization\|bearer\|cookie"` | **PASS** (zero matches) |
| `grep -E "https?://[^ ]*\?"` (URLs with query strings) | **PASS** (zero matches) |
| `grep -E "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"` (email-shape) | **PASS** (zero matches) |

### Pre / Post DB counts (observer wrote nothing)

| Table | Before | After |
| --- | --- | --- |
| `accepted_events` | 16 | 16 |
| `rejected_events` | 0 | 0 |
| `ingest_requests` | 16 | 16 |
| `session_features` | 8 | 8 |
| `session_behavioural_features_v0_2` | 16 | 16 |
| `stage0_decisions` | 8 | 8 |
| `risk_observations_v0_1` | 2 | 2 |

Every monitored table unchanged across the observer run.

### Operator notes

- `npm install` on the server modified `package-lock.json` by
  removing optional-dependency metadata. The server-side
  `package-lock.json` change was inspected and restored. Final
  server working tree clean.

### Result

PR#15a **PASSES Hetzner staging proof** under all constraints:
read-only, no DB writes, all monitored tables Pre = Post, no
forbidden tokens / URLs / emails surfaced, readiness =
`READY_FOR_MANUAL_REVIEW`. The observer is ready to support
Helen's first Phase-1 £1,250 BuyerRecon Evidence Review
engagement.

---

## §10 Rollback path

Forward-only at the file level:

```bash
git rm -r src/evidence-review-snapshot
git rm scripts/evidence-review-snapshot-report.ts
git rm tests/v1/evidence-review-snapshot.test.ts
git rm docs/sprint2-pr15a-evidence-review-snapshot-observer.md
# Remove the npm script line from package.json (manual edit):
#   "observe:evidence-review-snapshot": "tsx scripts/evidence-review-snapshot-report.ts",
```

No DB rollback needed. PR#15a writes nothing.

---

## §11 Recommended next PR

The right next step depends on Helen's first Phase-1 engagement
outcome:

- If the first engagement is on a customer with **READY_FOR_MANUAL_REVIEW**
  bucket: no follow-up PR is needed; the snapshot is sufficient
  for Helen to write the review. Save the snapshot output into
  `/Users/admin/buyerrecon-engagements/customers/<slug>/review-draft.md`
  context.
- If the first engagement returns **NEEDS_MORE_EVIDENCE** because
  ProductFeatures observations are missing: re-run the existing
  PR#14c `observe:product-features-bridge-candidate` CLI, and
  PR#15b (future) can add a small persistence layer for that
  observer if Helen approves.
- If multiple engagements return **INSTALL_OR_DATA_GAP** or
  **STOP_THE_LINE**: PR#15b is an **install-readiness CLI** that
  takes a customer's staging DB and verifies collector + feature
  pipeline before the engagement starts. That would reduce
  failed-install engagements.
- Runtime bridge / customer-facing scoring remains PAUSED per the
  AMS PR#A7 boundary.

---

**End of PR#15a Evidence Review Snapshot Observer documentation.**
