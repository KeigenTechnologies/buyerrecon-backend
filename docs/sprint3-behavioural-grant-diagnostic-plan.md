# Sprint 3: Behavioural Output Grant Fix — Diagnostic / Planning Record

**Status:** `BEHAVIOURAL_GRANT_DIAGNOSTIC_PLAN_ONLY`

This is a **docs-only diagnostic / planning record**. It investigates why
the PR #134 / PR #135 least-privilege grant fix for
`public.session_behavioural_features_v0_2` still did **not** satisfy the
behavioural features extractor write path (PR #136 failure evidence).

This record runs **no** production command, applies **no** GRANT, runs
**no** DML/DDL, runs **no** extractor rerun, and runs **no** worker. All
diagnostics below are **planned only**. All candidate fixes below are
**candidate only**. No fix execution and no rerun are authorized by this
PR.

---

## 1. Problem Statement

Per PR #136 (merge commit `1a18bb579e329e603e97bb0b56505bc5164d97eb`), a
single authorized extractor rerun was attempted and failed with:

```text
permission denied for table session_behavioural_features_v0_2
extractor_exit_code=1
```

This failed despite PR #135 proving that the intended column-scoped
privileges and sequence `USAGE` had been applied as planned in PR #134.
We must explain the gap between "the planned grant was applied and proofed"
and "the extractor still cannot write", and plan a safe way to confirm the
cause **without** selecting row data or running the full extractor.

---

## 2. Evidence Summary

### From PR #135 (proof — merge `330219772a6e9ae23cbabbb7305ac9703f32fbc2`)
As role `buyerrecon_prod_collector_app` in `buyerrecon_production`,
`transaction_read_only=on`:

- Table-wide `select=false insert=false update=false delete=false truncate=false references=false trigger=false`.
- Intended **column** INSERT privileges = true.
- Intended **column** UPDATE privileges = true.
- Limited **column** SELECT privileges = true for: `behavioural_features_id`,
  `feature_version`, `session_id`, `site_id`, `workspace_id`.
- Sequence `...behavioural_features_id_seq`: `usage=true select=false`.

### From PR #136 (failure — merge `1a18bb579e329e603e97bb0b56505bc5164d97eb`)
- Pre-rerun gates passed (`PRE_RERUN_ROLE_GATE ... transaction_read_only=on`).
- Exactly one rerun attempted: `npm run extract:behavioural-features`.
- Exit code `1`; failure `permission denied for table session_behavioural_features_v0_2`.
- Stop-line (non-zero exit) triggered; no further action taken.

### From the extractor source (`scripts/extract-behavioural-features.ts`, read-only review)
The terminal statement is a single idempotent
`INSERT … SELECT … ON CONFLICT … DO UPDATE SET … RETURNING`:

- **INSERT targets 36 columns** (excluding the identity column
  `behavioural_features_id`): `workspace_id, site_id, session_id,
  feature_version, extracted_at, first_seen_at, last_seen_at,
  source_event_count, source_event_id_min, source_event_id_max,
  first_event_id, last_event_id, ms_from_consent_to_first_cta,
  dwell_ms_before_first_action, first_form_start_precedes_first_cta,
  form_start_count_before_first_cta, has_form_submit_without_prior_form_start,
  form_submit_count_before_first_form_start, ms_between_pageviews_p50,
  pageview_burst_count_10s, max_events_per_second, sub_200ms_transition_count,
  interaction_density_bucket, scroll_depth_bucket_before_first_cta,
  refresh_loop_candidate, refresh_loop_count, same_path_repeat_count,
  same_path_repeat_max_span_ms, same_path_repeat_min_delta_ms,
  same_path_repeat_median_delta_ms, repeat_pageview_candidate_count,
  refresh_loop_source, valid_feature_count, missing_feature_count,
  feature_presence_map, feature_source_map`.
- `behavioural_features_id` is **not** in the INSERT column list — it takes
  the column default (sequence `nextval`).
- **ON CONFLICT target:** `(workspace_id, site_id, session_id, feature_version)`.
- **DO UPDATE SET updates 32 columns** — the 36 INSERT columns minus the 4
  conflict-key columns. Every right-hand side is `EXCLUDED.<col>`; there are
  **no references to existing table row values** in the SET clause.
- **RETURNING:** `behavioural_features_id, workspace_id, site_id, session_id`.

> Note: these are column-name and SQL-structure references taken from
> source. No row values, identifiers, or payloads are included.

---

## 3. Hypotheses

**H1 — Column INSERT grant did not cover all 36 inserted columns (LEADING).**
PostgreSQL allows INSERT with column-level privileges only if the role holds
INSERT on **every** column it writes. If the applied column INSERT grant
covered a narrower set (e.g. only the identity / key columns) than the 36
columns the extractor writes, INSERT fails. PostgreSQL reports this as the
generic `permission denied for table <name>` — it does not necessarily name
the offending column. This is consistent with the observed error.

**H2 — Column UPDATE grant did not cover all 32 DO UPDATE SET columns.**
The conflict path performs UPDATE on 32 columns. If column UPDATE was granted
on a narrower set, the upsert fails on the conflict branch. Same generic
error text. (For a first-run/empty-target this might not trigger, but for an
idempotent re-run against existing rows it would.)

**H3 — Table-level privilege required despite column grants? No (expected).**
For INSERT and UPDATE, PostgreSQL accepts column-level privileges in lieu of
table-level. Table-wide INSERT/UPDATE should **not** be required if column
coverage is complete. So the cause is more likely incomplete **column
coverage** (H1/H2) than a table-vs-column ordering rule. To be confirmed by
§4.

**H4 — DO UPDATE SET requires SELECT on existing columns? No (confirmed by source).**
All SET right-hand sides are `EXCLUDED.*` (the proposed row), not existing
table values. `EXCLUDED` does not require SELECT on the table. So the SET
clause does not add a SELECT requirement beyond the conflict-arbiter and
RETURNING needs.

**H5 — ON CONFLICT arbiter / RETURNING SELECT coverage.**
RETURNING reads `behavioural_features_id, workspace_id, site_id, session_id`
— all within the 5 proofed SELECT columns, so RETURNING should be satisfied.
The conflict arbiter `(workspace_id, site_id, session_id, feature_version)`
is matched via the unique index; these 4 columns are also within the proofed
SELECT set. So SELECT coverage appears sufficient for the proofed path — this
is likely **not** the blocker, but §4 will confirm whether any additional
column SELECT is implicitly required.

**H6 — Sequence: USAGE sufficient, SELECT not needed (confirmed by source).**
`behavioural_features_id` is populated by the column default (`nextval`).
`nextval` requires `USAGE` (or `UPDATE`) on the sequence; `SELECT` on the
sequence is only needed for `currval`/`lastval` or selecting the sequence
relation, which the extractor does not do. Proofed `usage=true select=false`
should therefore be sufficient. Sequence privilege is **not** the suspected
cause.

**Leading conclusion (to verify, not assert):** the most probable root cause
is **incomplete column coverage of the INSERT (H1) and/or UPDATE (H2) grant**
relative to the 36 insert / 32 update columns the extractor actually writes.

---

## 4. Proposed Safe Diagnostic Plan (read-only, transaction-rolled-back)

Goal: reproduce the **privilege check** for the exact column set the
extractor uses, **without** selecting any row data and **without** running
the extractor. This requires a **separate explicit GO** to execute; nothing
here is executed by this PR.

**Approach — catalog privilege probes (no row reads):** within a
`BEGIN; … ROLLBACK;` block, as role `buyerrecon_prod_collector_app`, use
PostgreSQL privilege-introspection functions, which return only booleans and
read no business rows:

- `has_table_privilege(role, 'public.session_behavioural_features_v0_2', 'INSERT'|'UPDATE'|'SELECT')`
- For each of the 36 INSERT columns:
  `has_column_privilege(role, 'public.session_behavioural_features_v0_2', '<col>', 'INSERT')`
- For each of the 32 DO UPDATE SET columns:
  `has_column_privilege(role, …, '<col>', 'UPDATE')`
- For RETURNING / arbiter columns:
  `has_column_privilege(role, …, '<col>', 'SELECT')`
- `has_sequence_privilege(role, '…_behavioural_features_id_seq', 'USAGE')`

This produces a precise per-column boolean matrix identifying exactly which
columns lack INSERT/UPDATE/SELECT, confirming or refuting H1/H2/H3/H5/H6 with
no row data, no secret, and no extractor execution. Expected output is a list
of column names + booleans only.

**Stop-lines for the diagnostic (when later authorized):** read-only
session; wrap in an explicit transaction and `ROLLBACK`; emit column names
and booleans only; print no DSN/secret/row/identifier/payload; do not run the
extractor, any worker, or any downstream runtime.

### Optional write-path simulation (PLANNED ONLY — separate GO required)
If the catalog probes are inconclusive, a write-path simulation could run the
actual upsert inside `BEGIN; … ROLLBACK;` to observe the live privilege
error. This is **not** planned for execution here and must require:
- a separate explicit operator GO,
- a guaranteed `ROLLBACK` (no commit),
- no customer / raw-row / identifier / payload output (counts/booleans only),
- no worker and no downstream runtime,
- a single attempt with the non-zero / error stop-line active.
Because the catalog-probe approach (above) is sufficient and lower-risk, the
write-path simulation should be a fallback only.

---

## 5. Candidate Fixes (CANDIDATE ONLY — none authorized)

To be decided **after** the diagnostic confirms the gap. All candidates are
recorded for planning; none is approved for execution.

- **C1 (least-privilege, preferred if H1/H2 confirmed):** extend the
  **column-level** INSERT grant to all 36 inserted columns and the
  column-level UPDATE grant to all 32 DO UPDATE SET columns — no table-wide
  grant. Justification: matches exactly what the extractor writes; keeps
  table-wide SELECT/INSERT/UPDATE and DELETE/TRUNCATE/REFERENCES/TRIGGER
  false; preserves sequence `USAGE`-only.
- **C2 (simpler, broader):** table-level `INSERT, UPDATE` on the table.
  Justification trade-off: removes per-column drift risk as columns evolve,
  but grants more than the current rows require; would still avoid SELECT,
  DELETE, TRUNCATE, REFERENCES, TRIGGER. Less aligned with least-privilege.
- **C3 (SELECT scope):** only if §4 shows RETURNING/arbiter needs a column
  not in the proofed 5 — extend column SELECT to that specific column.
  Expected unnecessary per H5; listed for completeness.
- **Not a candidate:** sequence SELECT grant, table-wide SELECT, DELETE,
  TRUNCATE, REFERENCES, TRIGGER, or any Lane/scoring/customer/AMS/Gate
  privilege — none of these are indicated by the extractor path.

The least-privilege justification for the **preferred** path (C1) is that the
grant should map 1:1 to the columns the single extractor statement writes
(36 INSERT, 32 UPDATE) plus the 5-column SELECT already proofed and sequence
`USAGE`, and nothing more.

---

## 6. Boundary / Non-Authorization

This diagnostic / planning PR does **not** authorize:

- extractor rerun
- any GRANT / DML / DDL (including the candidate fixes above)
- diagnostic execution (the §4 probes are planned only)
- worker execution, Stage 0, risk worker, POI worker, evidence snapshot
- Lane preview, Lane writes, scoring runtime, AMS Trust/Pass runtime
- customer output, Gate 4E, Gate 4F
- any downstream runtime

## 7. Next Required Step

1. Review/merge this diagnostic plan.
2. On a **separate explicit GO**, run the §4 read-only, rolled-back catalog
   probes; record results as a proof PR (column/boolean matrix only).
3. Based on confirmed results, prepare a revised **least-privilege** grant
   plan PR (candidate-only until reviewed).
4. Apply only after review + explicit GO; then proof.
5. Only after a green grant proof may a **new explicit extractor rerun GO**
   be requested. Any future rerun must be a separate operator session with
   all approved stop-lines active.

No extractor rerun, grant, DML/DDL, worker, or downstream runtime is
authorized until that diagnostic / fix / proof chain is complete and a new
explicit rerun GO is given.
