# Sprint 2 PR#8a — Risk Core Bridge Observer Planning

**Status.** PLANNING ONLY. Helen sign-off required before any PR#8b
implementation work. No code, no migration, no `schema.sql` change,
no `psql`, no DB touch, no collector / app / server / auth change.
PR#0–PR#7b implementation files are referenced read-only.

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited (gate-keeper).

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| HEAD (PR#7b pushed) | `987db3d8656efb534538af66a0ab0e9cc57534f7` |
| Prior closed commits | PR#0 `d4cc2bf` · PR#1 `bea880d` · PR#2 `3d88177` · PR#3 `4318e02` · PR#4 `cc2ae4c` · PR#5 `baa17f9` · PR#6 plan `9794210` · PR#6 impl `de76950` · PR#6 patch `1cd9ac1` · PR#7a `9667106` · Codex config `9a64669` · PR#7b `987db3d` |

**Authority.**

- `docs/sprint2-pr7a-risk-core-bridge-contract.md` (the bridge contract)
- `docs/sprint2-pr6-ams-risk-core-v0.1-buyerrecon-lane-a-planning.md`
- `docs/sprint2-pr6-ams-risk-evidence-implementation.md`
- `docs/sprint2-pr12-session-features-observation.md` (observer-pattern precedent)
- `docs/sprint2-pr9-collector-observation-report.md` (observer-pattern precedent)
- AMS `docs/architecture/ARCHITECTURE_V2.md` (read-only reference)
- `docs/architecture/ARCHITECTURE_GATE_A0.md` (P-4 Render production still blocking)
- BuyerRecon prior planning + impl docs (PR#0–PR#7b)

---

## §1 Title

**Sprint 2 PR#8 — Risk Core Bridge Observer** (logical task name).

This is the planning / observer-contract doc — **PR#8a**. The
implementation will ship as **PR#8b** (read-only CLI + tests +
staging proof). The split mirrors the PR#7a (contract) / PR#7b
(implementation) precedent.

PR#8 plans a **read-only internal engineering observer / verification
CLI** that runs PR#7b's pure `buildRiskCoreBridgeEnvelope()` against
real `risk_observations_v0_1` rows from a database (Hetzner staging
first; production read-only only after Helen explicitly unlocks it)
and prints an aggregate diagnostic report.

PR#8 is **NOT** Policy Pass 1. **NOT** `scoring_output_lane_a`.
**NOT** Trust Core. **NOT** product-fit / timing. **NOT**
customer-facing output. **NOT** a persistence layer for envelopes.
**NOT** a worker that calls the future AMS Risk Core. It is
strictly a read + map + report tool for engineers.

---

## §2 Purpose

PR#8a plans a read-only observer (to be implemented in PR#8b) that
tests the real dataflow:

```
risk_observations_v0_1
  → optional stage0_decisions eligibility/provenance (read-only side-channel)
  → PR#7b buildRiskCoreBridgeEnvelope()
  → internal engineering report
```

The PR#8b observer will:

- Read PR#6 rows.
- Optionally join `stage0_decisions` for eligibility / provenance
  context (the same read-only side-read PR#7a §5 already permits;
  see §5.1 + §7 for the tightened lookup rule).
- Map each row into the `RiskCoreBridgeInput` shape (no field
  invented — strict 1:1 with the PR#6 row's column set).
- Call PR#7b's pure adapter — capturing throws as rejection
  diagnostics rather than crashing the run.
- Aggregate results into a report with masked / truncated session
  IDs and zero secrets.

Explicit non-goals (re-stated from §1, for the avoidance of doubt):

- This is **not** Policy Pass 1. PR#8 does not call any policy code.
- This is **not** `scoring_output_lane_a`. PR#8 writes no rows.
- This is **not** Trust. No trust signal is emitted or consumed.
- This is **not** product-fit / timing. No buyer-fit, intent, window,
  TRQ, or action.
- This is **not** customer-facing output. The report is internal
  engineering diagnostics only.
- This is **not** envelope persistence. Envelopes are constructed
  in-memory, counted, and discarded by PR#8b.

---

## §3 Why this PR comes next

The user decision, in plain terms: build the **observer first**, not
Policy Pass 1.

Rationale:

1. **Test the whole link end-to-end earlier.** PR#6 writes
   `risk_observations_v0_1`. PR#7b's adapter consumes the same row
   shape. We have no evidence yet that the two ends connect cleanly
   over **real** rows. The PR#7b pure tests use synthetic fixtures;
   the observer exercises the adapter against the actual
   persistence shape.
2. **Surface step-level breakage when it happens.** When something
   goes wrong (a row missing an SBF evidence ref, a
   `behavioural_feature_version` drift, a ContextTag outside the
   D-13 enum, an out-of-range `*_risk_01`), the observer's
   rejection taxonomy says *exactly* which step broke. We don't
   want to discover this for the first time when Policy Pass 1
   ships.
3. **Reusable observation pattern.** The same observer skeleton
   will inform future POI / Series / Trust / Policy / product-fit /
   timing adapters. Each shared core will have its own bridge +
   observer pair before any policy / report layer ships.
4. **Risk reduction before persistence.** Adding a persistence
   table (or a writer worker) ahead of the observer would mean
   persisting envelopes whose lineage we haven't verified at scale.
   The observer pulls that risk forward.

Stated negative: we **do not** want to be in a position six months
from now where Policy Pass 1 emits decisions whose
`risk_observations_v0_1` lineage broke silently in week 1 of PR#6
production. The observer is the cheapest insurance against that.

---

## §4 Current baseline

| Item | Value |
| --- | --- |
| PR#6 created `risk_observations_v0_1` | ✅ migration 013 applied on Hetzner staging |
| PR#7a created bridge contract | ✅ `docs/sprint2-pr7a-risk-core-bridge-contract.md` (`9667106`) |
| PR#7b created pure bridge adapter | ✅ `src/scoring/risk-core-bridge/**` + `tests/v1/risk-core-bridge.test.ts` (`987db3d`) |
| Current HEAD | `987db3d` |
| PR#7b full test suite | 2166 / 2166 PASS (40 files) |
| PR#7b targeted tests | 68 / 68 PASS |
| PR#7b Codex xhigh review | PASS after blocker fixes (ContextTag enum validation + `behavioural_feature_version` lineage anchoring) |
| `scoring_output_lane_a` / `scoring_output_lane_b` schemas | EXIST (created by PR#3 migration 011 + mirrored in `src/db/schema.sql`); zero rows in both tables; no writer exists |
| Lane A / Lane B rows | NONE — no PR (including PR#6 / PR#7 / PR#8) writes to either lane table |
| Policy Pass 1 / Policy Pass 2 / Trust Core / product-fit / timing / report output | NO implementation, NO tables, NO code — all deferred. PR#7/PR#8 emit no output into these layers. |
| Render production | UNTOUCHED + remains blocked (A0 P-4) |
| Hetzner staging | PR#6 RECORD_ONLY rows present (final 2 rows after `de76950`/`1cd9ac1` proof) |

PR#7b's exported public surface (from `src/scoring/risk-core-bridge/index.ts`):

- `buildRiskCoreBridgeEnvelope(input: RiskCoreBridgeInput): RiskCoreBridgeEnvelope`
- `BRIDGE_SOURCE_TABLE = 'risk_observations_v0_1'`
- `RISK_CORE_BRIDGE_ENVELOPE_VERSION = 'risk-core-bridge-envelope-v0.1'`
- Types: `RiskCoreBridgeInput`, `RiskCoreBridgeEnvelope`, `BridgeStage0Context`, `EvidenceRef`
- Pure helpers: `preserveContextTags`, `preserveEvidenceRefs`, `preserveVelocity`, `deepFreeze`

The observer is a thin DB-reader + report writer around that public surface. No new pure logic is added to the bridge module.

---

## §5 Observer workflow

### §5.1 READ (PR#8b)

- **`risk_observations_v0_1`** — primary source. Filtered by:
  `observation_version` (default current), `scoring_version` (default
  current), optional `workspace_id` / `site_id`, optional time
  window (default last N hours).
- **`stage0_decisions`** — optional read-only side-read for
  eligibility / provenance only. Mirrors PR#7a §5 wording. The
  lookup follows the **two-step rule** below (Patch 4 of this
  planning doc tightens the previous "joined where available"
  wording).

#### §5.1.1 Stage 0 lookup rule (tightened)

The observer MUST locate at most one Stage 0 row per
`risk_observations_v0_1` row. The rule has two paths — **exact
pointer** (preferred) and **lineage fallback** — and a complete
truth table of outcomes. There is no other Stage 0 lookup the
observer may attempt.

**Path A — exact pointer lookup (preferred).** PR#6's worker
records `{ table: 'stage0_decisions', stage0_decision_id, rule_id }`
on `risk_observations_v0_1.evidence_refs[]`. If at least one such
entry is present, the observer looks up the Stage 0 row by
`stage0_decision_id` (PK).

**Path B — lineage fallback.** Used **only** when no
`stage0_decision_id` pointer is present on `evidence_refs[]`. The
observer SELECTs `stage0_decisions` rows matching the same
`(workspace_id, site_id, session_id)` triple.

**Truth table.**

| Path | Rows resolved | Observer behaviour |
| --- | --- | --- |
| A — exact pointer | exactly 1 | **Use that Stage 0 context.** Envelope builds with `stage0` set. |
| A — exact pointer | 0 (PK lookup yields nothing) | **`INVALID_STAGE0_CONTEXT`.** A dangling pointer means the PR#6 row's `evidence_refs[]` claimed a Stage 0 row that does not exist — a lineage break. The row is reported; no `stage0` is forwarded to the adapter. |
| B — fallback | 0 | **No Stage 0 context — envelope may still build.** The bridge accepts `stage0` as optional (PR#7a §5). No reject, no `stage0` forwarded. |
| B — fallback | exactly 1 | **Use that Stage 0 context.** Envelope builds with `stage0` set. |
| B — fallback | ≥ 2 (multiple candidates) | **`INVALID_STAGE0_CONTEXT`.** The observer MUST NOT guess. The row is reported; no `stage0` is forwarded to the adapter. |

**No guess.** The observer never picks one of multiple candidate
Stage 0 rows. The observer never invents a Stage 0 row when one is
absent. Ambiguity is a reject; absence (via Path B) is a
no-`stage0`-context envelope.

Stage 0 context flows into the envelope's `eligibility` /
`provenance` slots only. It is NEVER a scoring source. The
observer does NOT use Stage 0 data to alter any
`normalized_risk_features` value.

### §5.2 BUILD (pure, in-memory)

For each scanned row:

1. **Map** the DB row into `RiskCoreBridgeInput` — strict 1:1, no
   field invented. (See §7 for the field mapping contract.)
2. **Call** `buildRiskCoreBridgeEnvelope(input)`.
3. **Catch** any thrown validation error from the adapter and
   convert it into a rejection diagnostic (see §8 for the rejection
   taxonomy).
4. **Discard** the envelope after counting + sampling. Envelopes
   are NOT persisted in PR#8b. They are NOT serialised to disk.
   They are NOT sent over the network.

### §5.3 REPORT

Aggregate counts + distributions, written to stdout. Concrete
fields the report MUST surface:

| Field | Type | Notes |
| --- | --- | --- |
| `rows_scanned` | integer | `risk_observations_v0_1` rows the SELECT returned |
| `envelopes_built` | integer | adapter calls that returned a valid envelope |
| `rejects` | integer | `rows_scanned - envelopes_built` |
| `reject_reasons` | `Record<RejectReason, integer>` | per-reason counts from the §8 taxonomy |
| `behavioural_feature_version_distribution` | `Record<string, integer>` | counts per distinct `behavioural_feature_version` observed |
| `missing_sbf_evidence_ref_count` | integer | rows whose `evidence_refs[]` lacked a `session_behavioural_features_v0_2` entry |
| `context_tag_distribution` | `Record<ContextTag, integer>` | counts per D-13 enum value emitted; unknown / forbidden tags increment a separate reject reason |
| `stage0_excluded_count` | integer | rows whose joined `stage0_decisions.excluded === true` (defensive — should be 0 if upstream filtered correctly) |
| `eligible_for_buyer_motion_risk_core_count` | integer | envelopes where `eligibility.eligible_for_buyer_motion_risk_core === true` |
| `sample_session_id_prefixes` | `string[]` | up to N (default 10) **truncated** session IDs (see §9 masking rule) for spot-checking |
| `run_metadata` | object | `{ observation_version, scoring_version, window_start, window_end, database_host, run_started_at, run_ended_at, source_table='risk_observations_v0_1', bridge_envelope_version=RISK_CORE_BRIDGE_ENVELOPE_VERSION }` |

`run_started_at` and `run_ended_at` are observer-run wall-clock
timestamps. They live on `run_metadata` only. They are **NEVER**
written into `RiskCoreBridgeInput.derived_at` — see §7 Patch 2.

The report's serialised shape is JSON-friendly so it can also be
written to a file (operator-controlled; PR#8b implementation may
default to stdout-only).

---

## §6 Read-only data contract

### §6.1 Allowed reads (PR#8b observer v0)

| Source | Default | Notes |
| --- | --- | --- |
| `risk_observations_v0_1` | **YES (read-only)** | Primary observer input. SELECT only. No `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE`. |
| `stage0_decisions` | **YES (read-only, optional side-read)** | Eligibility / provenance only. SELECT only. Lookup per §5.1.1 rule. Mirrors PR#7a §5 wording. |

The PR#8b observer script reads from these two tables and **no
others**. Lane A / Lane B count diagnostics are operator-side per
§11 / §12 — not observer-side.

### §6.2 Forbidden reads (default v0)

| Source | Status | Reason |
| --- | --- | --- |
| `accepted_events` | **NO** | Raw event ledger (collector territory). The observer must not bypass PR#6 lineage by re-reading raw events. Future contract revision may unlock for reconciliation, with explicit justification. |
| `rejected_events` | **NO** | Same rationale as `accepted_events`. |
| `ingest_requests` | **NO** | Request-layer evidence is PR#5 Stage 0's territory. |
| `session_features` | **NO** | PR#11 layer. Unlocking requires Helen amendment. |
| `session_behavioural_features_v0_2` | **NO by default** | Bypassing PR#6 is forbidden by default. A later contract revision MAY unlock this for reconciliation tests (e.g. "does every PR#6 row's `evidence_refs[].behavioural_features_id` resolve to a real SBF row?") — but only if Helen approves the use case. |
| `scoring_output_lane_a` / `scoring_output_lane_b` | **NO — at the observer level** | The observer script does NOT read these tables in any form (no `SELECT`, no `COUNT(*)`, no metadata query). Lane A/B count verification happens at the operator / staging-proof level via separate `psql -c 'SELECT COUNT(*)…'` checks (see §11) — outside the observer's process. |

### §6.3 Principle

PR#8b tests whether **PR#6 + PR#7 lineage is already sufficient**
for the Risk Core input contract. The observer must not paper over
lineage gaps by reading upstream raw tables. If PR#7b cannot build
an envelope from a PR#6 row, that's a *finding*, not a problem the
observer is allowed to fix in-place.

---

## §7 Mapping contract

The observer's row→input mapping is the contract between PR#6's
persistence shape and PR#7b's input shape. The mapping MUST be 1:1,
no fields invented.

### §7.1 Field map (`risk_observations_v0_1` row → `RiskCoreBridgeInput`)

| `RiskCoreBridgeInput` field | Source on the `risk_observations_v0_1` row | Notes |
| --- | --- | --- |
| `risk_observation_id` | `risk_observation_id` (PK) | UUID string |
| `workspace_id` | `workspace_id` | |
| `site_id` | `site_id` | |
| `session_id` | `session_id` | |
| `observation_version` | `observation_version` | required non-empty |
| `scoring_version` | `scoring_version` | required non-empty |
| `behavioural_feature_version` | **sourced/verified from `evidence_refs[]`** (find the `session_behavioural_features_v0_2` entry; its `feature_version` is authoritative) | PR#7b adapter requires the declared input value to MATCH the SBF evidence-ref value; PR#8b observer MUST pass the same value the SBF evidence-ref carries so the adapter never trivially rejects |
| `velocity` | `velocity` (JSONB) | `Record<string, number>` |
| `device_risk_01` | `device_risk_01` (NUMERIC) | [0, 1] |
| `network_risk_01` | `network_risk_01` (NUMERIC) | [0, 1] |
| `identity_risk_01` | `identity_risk_01` (NUMERIC) | [0, 1] |
| `behavioural_risk_01` | `behavioural_risk_01` (NUMERIC) | [0, 1] — normalised INPUT FEATURE, not a score |
| `context_tags` | `tags` (JSONB array) | strings; D-13 enum is the only allowed set |
| `evidence_refs` | `evidence_refs` (JSONB array) | verbatim — observer MUST NOT rewrite |
| `source_event_count` | `source_event_count` | non-negative integer |
| `record_only` | `record_only` (BOOLEAN, frozen TRUE) | observer asserts `=== true` |
| `derived_at` | **source provenance timestamp from `risk_observations_v0_1`** — the row's `created_at` (or a future `derived_at` column if PR#6 adds one) carries the moment the row was minted. If absent / NULL, the observer MUST reject with `MISSING_DERIVED_AT` (see §8). The observer MUST NOT invent this value, MUST NOT use `Date.now()`, MUST NOT use the SELECT-time clock. Observer run time belongs only in `run_metadata.run_started_at` / `run_metadata.run_ended_at` — **never** in `RiskCoreBridgeInput`. | ISO-8601 string |
| `stage0` (optional) | per §5.1.1 lookup rule: preferred exact `stage0_decision_id` pointer from `evidence_refs[]`, fallback unambiguous `(workspace_id, site_id, session_id)` lookup; on ambiguity → `INVALID_STAGE0_CONTEXT` and no `stage0` flows to the adapter | `{ stage0_decision_id, stage0_version, excluded, rule_id, record_only }` |

### §7.2 Strictness rule

**If a field is missing from the actual row or has the wrong shape,
the observer MUST reject the row and report the reason. It MUST NOT
silently invent a value.** Examples:

- Row missing `behavioural_feature_version` lineage on
  `evidence_refs[]` → `MISSING_SBF_FEATURE_VERSION` (see §8).
- Row's declared SBF `feature_version` doesn't match the canonical
  declared input → `BEHAVIOURAL_FEATURE_VERSION_MISMATCH`. (Note:
  PR#8b's mapper takes the declared input *from* the SBF evidence
  ref, so this case should only fire if the SBF ref itself is
  internally inconsistent across multiple SBF entries in the same
  row — which PR#7b's adapter also rejects.)
- Row's `tags` JSONB has a non-string element → adapter throws on
  `context_tags[i]` → observer maps to `INVALID_CONTEXT_TAG`.
- Row's `created_at` is NULL or otherwise unusable as the
  provenance timestamp → `MISSING_DERIVED_AT`.
- Multiple Stage 0 candidate rows resolve from the §5.1.1 fallback
  → `INVALID_STAGE0_CONTEXT` (the observer does NOT guess).

The observer does NOT mutate the row. The observer does NOT round
or clamp risk values. The observer does NOT supply default
ContextTags. The observer does NOT stamp `derived_at` from the
wall clock.

### §7.3 PostgreSQL NUMERIC value handling (PR#8b implementation note)

The `risk_observations_v0_1` columns `device_risk_01`,
`network_risk_01`, `identity_risk_01`, and `behavioural_risk_01`
are declared `NUMERIC(4,3)` in migration 013. The `node-postgres`
(`pg`) library returns `NUMERIC` columns as **JavaScript strings**
by default (e.g. `'0.250'`), not as `number`. PR#7b's adapter
requires `number` typed values and rejects any non-finite input
with `INVALID_RISK_VALUE`.

Therefore PR#8b's mapper MUST explicitly convert NUMERIC string
values to finite numbers **before** calling
`buildRiskCoreBridgeEnvelope()`:

- Strings like `'0.250'`, `'1'`, `'0'` MUST be parsed (e.g. via
  `Number(...)` or `parseFloat(...)`) and the result MUST be
  validated as `Number.isFinite(value)` AND in `[0, 1]`.
- Strings that do not parse to a finite number (empty string,
  `'NaN'`, `'Infinity'`, `'-Infinity'`, malformed inputs like
  `'abc'`) MUST be rejected as `INVALID_RISK_VALUE`.
- Out-of-range parsed numbers (< 0 or > 1) MUST be rejected as
  `INVALID_RISK_VALUE`.
- Native JavaScript `NaN` or `Infinity` (if pg returns them under
  some configuration) MUST also reject as `INVALID_RISK_VALUE`.
- The mapper MUST NOT silently coerce, clamp, or round
  out-of-range values. Per §7.2 strictness rule — reject and
  report.

The same rule applies to numeric entries inside the `velocity`
JSONB record (which the bridge expects as
`Record<string, number>`). `pg` returns JSONB as already-parsed
JavaScript values, so the velocity numbers are usually already
typed `number` — but the mapper MUST still validate
`Number.isFinite(value)` for each entry as defence in depth.

Alternative: PR#8b MAY configure `pg.types.setTypeParser(1700, parseFloat)`
(or the equivalent typed parser) to coerce all `NUMERIC` columns
to `number` at the connection layer. If this approach is taken,
the mapper's per-field `Number.isFinite` check is still required
(non-finite results from the type parser MUST still reject).

---

## §8 Rejection taxonomy

Internal **observer diagnostic** labels. These are NOT product
reason codes, NOT Lane A / Lane B codes, NOT reason_code_dictionary
entries. They appear only in the engineering report.

| Reason | Meaning |
| --- | --- |
| `MISSING_REQUIRED_ID` | One of `risk_observation_id` / `workspace_id` / `site_id` / `session_id` empty or missing |
| `MISSING_EVIDENCE_REFS` | `evidence_refs` is null, not an array, or empty |
| `MISSING_SBF_EVIDENCE_REF` | `evidence_refs[]` contains no `session_behavioural_features_v0_2` entry |
| `MISSING_SBF_FEATURE_VERSION` | The SBF entry exists but has no `feature_version` (or empty string) |
| `BEHAVIOURAL_FEATURE_VERSION_MISMATCH` | Multiple SBF entries on the same row disagree on `feature_version` (PR#7b rejects this) |
| `MISSING_DERIVED_AT` | The row's `created_at` (or future `derived_at` column) is NULL / missing / not a valid ISO-8601 timestamp. The observer MUST NOT invent this value (§7 Patch 2). |
| `INVALID_CONTEXT_TAG` | Tag fails PR#7b validation: not in D-13 enum, forbidden namespace, forbidden pattern, or non-`UPPER_SNAKE_CASE` |
| `INVALID_RISK_VALUE` | Any `*_risk_01` outside `[0, 1]`, NaN, Infinity, or non-finite velocity entry |
| `INVALID_STAGE0_CONTEXT` | Stage 0 join is ambiguous or inconsistent: §5.1.1 fallback resolves to multiple `stage0_decisions` rows, OR the joined context fails validation (e.g. `record_only !== true`, missing `stage0_version`, empty `rule_id`). The observer MUST NOT guess; this row is reported and no `stage0` is forwarded to the adapter. |
| `ADAPTER_VALIDATION_ERROR` | Catch-all for PR#7b adapter `throw` paths that don't map cleanly to the above |
| `UNEXPECTED_ERROR` | JavaScript-level error outside the adapter (e.g. JSON parse failure on the `velocity` column) |

Mapping from PR#7b's thrown error messages to these reasons happens
on the OBSERVER side via a tiny string-match table (e.g. the
substring `"behavioural_feature_version"` + `"must match"` →
`BEHAVIOURAL_FEATURE_VERSION_MISMATCH`). The PR#7b adapter is not
modified.

Counts per reason are aggregated and reported alongside `rejects`.

---

## §9 Privacy / masking rule

The observer report is engineering diagnostics. It is NOT customer-
facing, NOT shipped to dashboards, NOT used as evidence for any
external claim. The masking rule below is non-negotiable.

### §9.1 Forbidden in the report

- Full `session_id` (always truncated, see §9.2)
- `token_hash`, `ip_hash`, `pepper`, bearer / authorization tokens
- Raw `user_agent` (only the normalised `user_agent_family` label
  may flow, via Stage 0 `rule_inputs` — and even that is not part
  of the v0 report)
- Raw `page_url` / full URLs with query string
- Raw payload bytes, `raw_request_body`, `canonical_jsonb`
- Any personal data
- Any secret (DATABASE_URL value, API keys, etc. — only the
  derived `database_host` and `database_name` may appear)
- Any AMS-internal field that hasn't already been carried through
  PR#6's `evidence_refs`

### §9.2 Allowed in the report

- **Truncated session_id**: first 8 + last 4 characters, joined by
  `…`. Example: `'sess-abc1…d4f2'`. Anchored max-length 16
  characters total.
- **Counts** + **distributions** — aggregate only.
- **Table names** + **version names** (`observation_version`,
  `scoring_version`, `behavioural_feature_version`,
  `stage0_version`, `RISK_CORE_BRIDGE_ENVELOPE_VERSION`).
- **Non-sensitive reason labels** from §8.
- **Sample list** capped by `OBS_SAMPLE_LIMIT` (default 10).
- **Database host** + **database name** parsed from `DATABASE_URL`
  (e.g. `'staging-db.example.com / buyerrecon_staging'`). The full
  `DATABASE_URL` value is NEVER printed.

### §9.3 Test surface

A pure unit test MUST assert that the report's serialised JSON,
when grepped for `session_id` values present in the underlying
seed, returns zero matches (only the truncated prefixes appear).

---

## §10 CLI contract preview

Suggested future CLI entry point (NOT created in PR#8a planning;
ships in PR#8b):

```
npm run observe:risk-core-bridge

# equivalent:
tsx scripts/risk-core-bridge-observation-report.ts
```

Suggested env variables (all optional except `DATABASE_URL`):

| Var | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **required** | Staging or prod (prod requires Helen unlock — see §12) |
| `OBS_WORKSPACE_ID` | unset | Filter to one workspace |
| `OBS_SITE_ID` | unset | Filter to one site |
| `OBS_WINDOW_HOURS` | `720` | Mirrors `observe:collector` PR#12 precedent (30 days) |
| `OBS_SINCE` / `OBS_UNTIL` | unset | ISO-8601 overrides, mirror PR#5 / PR#6 worker pattern |
| `OBS_LIMIT` | `10000` | Hard cap on rows scanned (defence against accidental full-table scan) |
| `OBS_SAMPLE_LIMIT` | `10` | Max truncated session IDs in the sample list |
| `OBS_REQUIRE_ROWS` | `false` | If `true`, exit non-zero when `rows_scanned === 0` (useful for CI checks expecting data) |
| `OBS_OBSERVATION_VERSION` | current `OBSERVATION_VERSION_DEFAULT` | Override for replay or multi-version inspection |
| `OBS_SCORING_VERSION` | current `scoring/version.yml.scoring_version` | Override for replay |

The CLI MUST:

- Mask `DATABASE_URL` in any printed output (host + db name only).
- Default to read-only DB connection options (no `BEGIN` /
  `COMMIT` / `INSERT` / `UPDATE` / `DELETE` issued).
- Issue SELECT statements ONLY against `risk_observations_v0_1` and
  `stage0_decisions` (per §6.1). No other table is read by the
  observer process.
- Exit code `0` on PASS (report printed), `1` on `OBS_REQUIRE_ROWS`
  violation, `2` on connection/SQL error.

PR#8a planning **does not implement** any of this. The actual CLI
ships in the PR#8b implementation PR (a follow-on turn).

---

## §11 Staging proof plan (for PR#8b implementation PR)

The PR#8b implementation PR's Hetzner-staging proof should:

```bash
cd /opt/buyerrecon-backend
git pull
npm install
npx tsc --noEmit
npm run check:scoring-contracts
npm test                           # pure suite

# Env sanity (no secrets printed)
node -e "const u = new URL(process.env.DATABASE_URL); console.log('host=' + u.host + ' db=' + u.pathname.slice(1));"
# Expected: host is 127.0.0.1 / staging hostname, db is the staging DB name. NEVER Render production.

# Pre-counts — operator-side psql, NOT inside the observer process.
# The observer script itself does not read Lane A/B (per §6.2);
# Lane A/B count verification is the operator's responsibility
# via the SELECTs below.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT
  (SELECT COUNT(*) FROM accepted_events)                  AS accepted_events,
  (SELECT COUNT(*) FROM rejected_events)                  AS rejected_events,
  (SELECT COUNT(*) FROM ingest_requests)                  AS ingest_requests,
  (SELECT COUNT(*) FROM session_features)                 AS session_features,
  (SELECT COUNT(*) FROM session_behavioural_features_v0_2) AS behavioural_features,
  (SELECT COUNT(*) FROM stage0_decisions)                 AS stage0_decisions,
  (SELECT COUNT(*) FROM risk_observations_v0_1)           AS risk_observations,
  (SELECT COUNT(*) FROM scoring_output_lane_a)            AS lane_a,
  (SELECT COUNT(*) FROM scoring_output_lane_b)            AS lane_b;"

# Run the observer (observer reads only risk_observations_v0_1 +
# optional stage0_decisions; it does NOT touch the Lane A/B rows
# the operator just counted above).
npm run observe:risk-core-bridge

# Post-counts — operator-side psql, same SELECT as above. Must
# match pre-counts exactly. Any delta on Lane A/B is a STOP-THE-LINE
# event.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "<same SELECT as above>"

# Observe-collector still PASS (defence-in-depth — should be
# unaffected by the observer run).
npm run observe:collector
```

Expected:

- All pre/post source-table counts **unchanged**.
- `scoring_output_lane_a` / `scoring_output_lane_b` counts
  **unchanged** (zero in both before and after).
- Observer prints aggregate report with truncated session IDs.
- No raw secrets in stdout.
- `observe:collector` still PASS.

**Separation of concerns.** The Lane A/B `COUNT(*)` checks live in
the operator's `psql -c` invocation, not in the observer process.
This keeps the observer's data path strictly inside `risk_observations_v0_1`
+ `stage0_decisions` (§6.1) while still giving the staging proof
its zero-Lane-A/B-rows assurance.

---

## §12 Production read-only test plan (gated, deferred)

Production read-only observer may run **only after Helen
explicitly unlocks it**. No Render deploy. No write. No migration.
No customer output. A0 P-4 remains the production gate.

### §12.1 Pre-flight checks

Before any production observer run, the operator MUST:

1. Confirm the resolved `DATABASE_URL` host + database name in
   stdout match the production read-only replica target (NOT the
   primary write target).
2. Confirm the connecting role is **read-only** at the DB level
   (e.g. `buyerrecon_internal_readonly` per PR#3). The observer
   CLI should refuse to start if `pg_has_role('writer-equivalent')`
   returns true under that connection. (Implementation MAY surface
   this as a startup `assert`.)
3. Confirm sample masking by running the observer against a tiny
   `OBS_LIMIT=10` window first and inspecting stdout.

### §12.2 Capture before/after row counts (operator-side)

For every production observer run, the **operator** (not the
observer process) captures pre + post counts via `psql -c` of:

- `accepted_events`, `rejected_events`, `ingest_requests`,
  `session_features`, `session_behavioural_features_v0_2`,
  `stage0_decisions`, `risk_observations_v0_1`
- `scoring_output_lane_a`, `scoring_output_lane_b` (must be `0`
  both before and after — these tables MUST remain empty until
  Policy Pass 1 ships, which is post-PR#8)

The observer process does NOT issue any SELECT against
`scoring_output_lane_a` or `scoring_output_lane_b`. Operator-side
psql is the only place those tables are counted.

Any delta in any of these row counts during a production run is
a STOP-THE-LINE event. Investigate before continuing.

### §12.3 Refuse on unexpected write capability

If the connecting role has `INSERT` / `UPDATE` / `DELETE`
permission on any of the source tables, the observer MUST refuse
to start with a clear error. The implementation MAY use
`has_table_privilege(...)` to assert this at startup.

---

## §13 Test plan for the PR#8b implementation PR

PR#8b implementation should include:

### §13.1 Pure tests

- **Mapper tests** — `risk_observations_v0_1` row JSON ↔
  `RiskCoreBridgeInput` field shape. Roundtrip identity for valid
  rows. Includes `derived_at` sourced from the row's `created_at`,
  not from any wall-clock read.
- **NUMERIC-string conversion test** (§7.3) — fixture row whose
  `*_risk_01` columns are JavaScript strings (e.g. `'0.250'`,
  `'1'`, `'0'`) as `pg` returns NUMERIC by default. Mapper
  converts each to a finite `number` and the envelope builds
  successfully with the parsed value.
- **Invalid-NUMERIC-string rejection test** (§7.3) — fixture
  rows whose `*_risk_01` columns are unparseable strings (`''`,
  `'NaN'`, `'Infinity'`, `'-Infinity'`, `'abc'`), or parsed
  out-of-range strings (`'1.5'`, `'-0.1'`). Mapper rejects each
  with `INVALID_RISK_VALUE`. Defence-in-depth: native `NaN` /
  `Infinity` on the input (regardless of source type) also
  rejects.
- **Adapter failure capture tests** — each PR#7b adapter throw path
  is captured as a specific §8 reject reason (string-match table
  exercised end-to-end).
- **`MISSING_DERIVED_AT` test** — fixture row with `created_at`
  NULL (or future `derived_at` column NULL) → observer rejects with
  `MISSING_DERIVED_AT`. Counter-test: observer never calls
  `Date.now()` to fill in the gap.
- **Stage 0 lookup-rule tests** — (a) exact `stage0_decision_id`
  from `evidence_refs[]` resolves; (b) absent pointer + unambiguous
  `(ws, site, session)` fallback resolves to one row; (c) absent
  pointer + ambiguous fallback → `INVALID_STAGE0_CONTEXT`; (d)
  absent pointer + zero fallback rows → no `stage0` passed and
  envelope still builds.
- **Reject reason aggregation tests** — feeding a mixed batch
  (10 valid, 3 missing-SBF, 2 invalid-tag, 1 risk-out-of-range,
  1 missing-derived-at, 1 ambiguous-stage0) produces correct
  counts per reason in the report.
- **Masking tests** — full session IDs from the seed never appear
  verbatim in the report's serialised JSON (§9.3).
- **Report shape tests** — every §5.3 field is present with the
  correct type; numeric fields are non-negative integers;
  distributions sum to expected totals.
- **No-forbidden-table-writes test** — static-source grep over
  `scripts/risk-core-bridge-observation-report.ts` for `INSERT INTO`
  / `UPDATE` / `DELETE` / `TRUNCATE` — zero matches.
- **No-Lane-A/B-read test** — static-source grep over the
  observer script for `scoring_output_lane_a` and
  `scoring_output_lane_b` substrings — zero matches (the
  observer process does not read these tables; the staging proof
  handles them operator-side).
- **No-full-session-id-leak test** — verify the truncate-mask
  function output regex pattern matches `<prefix>…<suffix>` with
  the documented lengths.
- **No-token/IP/UA-leak test** — fixture inputs include the strings
  `'token_hash'`, `'ip_hash'`, `'pepper'`, `'user_agent'`,
  `'bearer'`, `'authorization'`, `'raw_payload'`,
  `'canonical_jsonb'`, `'page_url'` in evidence_refs entry sub-keys
  (since PR#6's evidence_refs preserves verbatim records); the
  report must surface counts but never the offending strings
  themselves.

### §13.2 DB tests (opt-in, `npm run test:db:v1`)

- **End-to-end happy path** — seed N rows in `risk_observations_v0_1`,
  run the observer, assert `envelopes_built === N` and `rejects === 0`.
- **Stage 0 join — exact pointer path** — seed one row whose
  `evidence_refs[]` carries a `stage0_decision_id`; assert the
  report's `stage0_excluded_count` reflects the joined row's
  `excluded` flag.
- **Stage 0 join — ambiguous fallback path** — seed two
  `stage0_decisions` rows under the same
  `(workspace_id, site_id, session_id)` with no exact pointer on
  `evidence_refs[]`; assert the observer reports
  `INVALID_STAGE0_CONTEXT` for that row.
- **Source-tables-unchanged** — assert row counts on every source
  table the observer reads (just `risk_observations_v0_1` +
  `stage0_decisions`) before/after observer run are equal.
- **Lane A/B-unchanged (test-harness side)** — assert
  `scoring_output_lane_a` / `scoring_output_lane_b` counts equal 0
  before/after the observer run. This assertion is issued by the
  TEST HARNESS via its own pg connection — NOT by the observer
  process. The observer source MUST contain no Lane A/B reads
  (verified by the static-source grep in §13.1).
- **Read-only role behavioural check** — observer run under
  `buyerrecon_internal_readonly` succeeds with no privilege
  errors; attempted write (probe `INSERT INTO risk_observations_v0_1`)
  under the same role fails with the expected pg error.

### §13.3 Verification SQL (optional)

Mirrors `docs/sql/verification/13_risk_observations_v0_1_invariants.sql`
pattern. PR#8b implementation MAY add a thin verification SQL file
that returns the same aggregate counts the observer reports, so
operators can sanity-check the observer's report against raw
psql output.

---

## §14 Hard boundaries (explicit repeat)

PR#8 — both PR#8a planning (this doc) and PR#8b implementation —
MUST NOT:

- Write to any table.
- Create or apply a migration.
- Edit `schema.sql`.
- Write to `scoring_output_lane_a` / `scoring_output_lane_b`.
- Produce any Policy Pass 1 / Policy Pass 2 / Trust Core /
  product-fit / timing output.
- Produce report / customer output of any kind.
- Deploy to Render production. A0 P-4 still blocking.
- Read from `accepted_events` / `rejected_events` /
  `ingest_requests` / `session_features` /
  `session_behavioural_features_v0_2` (in v0; contract revision
  required to unlock).
- Read from `scoring_output_lane_a` / `scoring_output_lane_b` at
  all from the observer process. **No exception** — no
  `SELECT`, no `COUNT(*)`, no metadata query. Lane A/B count
  verification is the operator's responsibility (§11 / §12) via
  separate `psql -c` invocations outside the observer process.
- Bypass PR#6 / PR#7 lineage. The observer's job is to *test*
  whether the lineage holds, not to paper over it.
- Persist envelopes anywhere — disk, DB, network.
- Modify PR#6 / PR#7a / PR#7b code. The observer is **additive**
  to the existing repo.
- Invent `derived_at` from the wall clock or any source other
  than the `risk_observations_v0_1` row's provenance timestamp.
- Guess Stage 0 context. Ambiguous joins → `INVALID_STAGE0_CONTEXT`,
  never a silent pick.

---

## §15 Open decisions for Helen

| OD | Question | Recommended default |
| --- | --- | --- |
| **OD-1** | Confirm PR#8 is the **read-only Risk Core Bridge Observer** (not Policy Pass 1, not a writer) | **Yes** |
| **OD-2** | Confirm PR#8 should run before Policy Pass 1 (test the whole dataflow first) | **Yes** — observer first; Policy Pass 1 deferred |
| **OD-3** | Confirm allowed reads are `risk_observations_v0_1` (primary) + `stage0_decisions` (optional side-read) only | **Yes** — per PR#7a §5 + §6 above. Lane A/B count checks are operator-side only (§11). |
| **OD-4** | Confirm no direct `accepted_events` / `session_behavioural_features_v0_2` read in v0 (unless later needed) | **Yes** — defer; contract revision required to unlock |
| **OD-5** | Confirm production observer test is read-only AND requires explicit Helen unlock | **Yes** — A0 P-4 remains blocking; production observer is a separate gated turn after Hetzner staging proof |
| **OD-6** | Confirm the report uses truncated session IDs only (first 8 + last 4, `…` join) | **Yes** — per §9 masking rule |
| **OD-7** | Confirm reject labels are observer diagnostics only (NOT product reason codes, NOT Lane A/B codes, NOT reason_code_dictionary entries) | **Yes** — per §8 |
| **OD-8** | Confirm no persistence of envelopes in PR#8 (memory only, discarded after counting) | **Yes** — persistence is a separate later decision |

All 8 ODs are load-bearing — Helen signs all 8 (or substitutes
explicit alternatives) before PR#8b implementation begins.

---

## §16 Final recommendation

**Build PR#8 as observer first.** Do not jump to Policy Pass 1. Do
not persist `RiskCoreBridgeEnvelope` yet. Use observer evidence to
decide the next step:

| Observer finding | Likely next step |
| --- | --- |
| Rejection rate is low; all distributions plausible; lineage clean | Persistence + worker (separate planning) OR POI / Series observer (separate planning) |
| Rejection rate is non-trivial and concentrated on `MISSING_SBF_FEATURE_VERSION` / `BEHAVIOURAL_FEATURE_VERSION_MISMATCH` | Fix PR#6 lineage; re-run observer; only then consider persistence |
| Rejection rate is concentrated on `MISSING_DERIVED_AT` | Investigate PR#6 row provenance (is `created_at` NULL? is a future `derived_at` column needed?); re-run observer |
| Rejection rate is concentrated on `INVALID_CONTEXT_TAG` | Tighten PR#6's adapter (or relax D-13 enum if Helen approves new families); re-run observer |
| Rejection rate is concentrated on `INVALID_RISK_VALUE` | Investigate PR#6 normaliser drift; re-run observer |
| Rejection rate is concentrated on `INVALID_STAGE0_CONTEXT` | Investigate PR#6 evidence_refs gap (missing `stage0_decision_id` pointer) or PR#5 duplicate-row hazard; re-run observer |
| Rejection rate is concentrated on `MISSING_REQUIRED_ID` / `MISSING_EVIDENCE_REFS` | Strong indicator of an upstream write-path bug; STOP and investigate before any persistence |

The observer is the cheapest, lowest-risk way to learn whether the
PR#6 → PR#7b link is production-ready. Everything downstream is
better-informed once we have its report.

The follow-on PR numbering after PR#8b is intentionally left
open — the right next PR depends on observer findings (it may be
a PR#6 lineage fix, a POI/Series observer, a persistence layer, or
Policy Pass 1).

---

## §17 What this planning doc does NOT do

- Does **not** implement PR#8b.
- Does **not** create a migration.
- Does **not** modify `schema.sql`.
- Does **not** modify `package.json`.
- Does **not** touch the DB or run `psql`.
- Does **not** touch `src/collector/v1/**`, `src/app.ts`,
  `src/server.ts`, `src/auth/**`.
- Does **not** modify migrations 001..013.
- Does **not** modify PR#0..PR#7b implementation files.
- Does **not** amend `scoring/version.yml`,
  `scoring/reason_code_dictionary.yml`, or
  `scoring/forbidden_codes.yml`.
- Does **not** commit. Does **not** push.

---

## §18 Implementation gate

PR#8b implementation may begin only after **all** of the following
hold:

1. Helen written sign-off on this PR#8a planning doc (OD-1..OD-8).
2. Codex xhigh review of this PR#8a planning doc → PASS.
3. PR#7b commit `987db3d` (or later) remains stable.
4. `scoring/version.yml.scoring_version === 's2.v1.0'` and
   `automated_action_enabled === false`.

After all four hold:

1. New branch from `sprint2-architecture-contracts-d4cc2bf` HEAD.
2. PR#8b implementation PR ships under a file inventory mirroring
   the PR#9 / PR#12 observer pattern: CLI script + one or more
   pure-mapper / reporter files under
   `scripts/risk-core-bridge-observation-report.ts` (+ helpers)
   + pure tests under `tests/v1/` + (optional) verification SQL.
3. Codex xhigh review of the PR#8b implementation PR → PASS.
4. Hetzner staging proof per §11.
5. Production read-only test only after explicit Helen unlock per §12.
