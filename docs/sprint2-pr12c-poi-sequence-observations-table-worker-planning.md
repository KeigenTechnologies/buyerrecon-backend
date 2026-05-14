# Sprint 2 PR#12c — POI Sequence Observations Table + Manual Worker Planning

**Status.** PLANNING ONLY. Helen sign-off required before any
implementation. No code, no migration, no `schema.sql` change, no
DB writes, no `psql`, no Render. PR#0–PR#12b implementation files
are referenced read-only.

**Date.** 2026-05-14. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Authority.**
- `docs/architecture/buyerrecon-workflow-locked-v0.1.md` (commit `c063784`) —
  §4C POI Sequence evidence branch, §9 POI Sequence facts + v0.1
  taxonomy, §10 AMS Series Core reserved-name guard, §23 frozen-name
  guard, §24 PR checklist.
- `docs/sprint2-pr12a-poi-sequence-planning.md` (commit `ca3f174`) —
  Helen sign-off OD-1..OD-13 for the immediate POI Sequence concept.
- `docs/sprint2-pr12b-poi-sequence-observer.md` (commit `04def87`) —
  Hetzner-proven 2026-05-14 read-only POI Sequence Observer over
  `poi_observations_v0_1`.
- PR#11c precedent: `docs/sprint2-pr11c-poi-observations-table-worker-planning.md`
  + `docs/sprint2-pr11c-poi-observations-table-worker.md` +
  `migrations/014_poi_observations_v0_1.sql` + `src/scoring/poi-core-worker/*`.
- PR#11d precedent: `docs/sprint2-pr11d-poi-table-observer-hetzner-proof.md`
  + `src/scoring/poi-table-observer/*` + `tests/v1/poi-table-observer.test.ts`.

---

## §1 Status / upstream proof

| Fact | Value |
| --- | --- |
| Current branch | `sprint2-architecture-contracts-d4cc2bf` |
| Current HEAD | `04def87cb6e0b2109c027db67f9894f6e61de076` ("Sprint 2 PR#12b: record Hetzner POI Sequence proof") |
| PR#12b implementation commit | `c460f74e6c0da2431b07c11fbb5c1d349fba425c` |
| PR#12b Hetzner proof commit | `04def87cb6e0b2109c027db67f9894f6e61de076` |
| Workflow truth file | `docs/architecture/buyerrecon-workflow-locked-v0.1.md` (locked at `c063784`) |

**PR#12b state.** Read-only POI Sequence Observer is **committed,
pushed, Hetzner-proven, and closed.** The Hetzner staging proof
(2026-05-14, server path `/opt/buyerrecon-backend`, DB masked
`127.0.0.1:5432/buyerrecon_staging`) recorded:

| Signal | Result |
| --- | --- |
| `rows_scanned` | 8 |
| `sessions_seen` | 8 |
| `poi_sequences_built` | 8 |
| `single_poi` | 8 |
| Other pattern classes (`repeated_same_poi`, `multi_poi_linear`, `loop_or_backtrack`, `insufficient_temporal_data`, `unknown`) | 0 |
| `stage0_excluded_distribution` | `{true_count: 6, false_count: 2}` |
| `poi_sequence_eligible_distribution` | `{true_count: 2, false_count: 6}` (pure inverse ✓) |
| `total_anomalies` | 0 |
| `unknown_pattern_count` | 0 |
| Pre = Post counts across all 10 monitored tables | unchanged |
| Lane A / Lane B | 0 / 0 (both pre and post) |
| Regression observers (`risk-core-bridge`, `poi-core-input`, `poi-table`) | PASS |

**PR#12b proved the POI Sequence shape in memory.** PR#12c planning
decides whether and how to durably persist that shape.

---

## §2 Why PR#12c exists

- PR#12b verified that POI Sequence facts can be derived deterministically
  from `poi_observations_v0_1` with zero anomalies on real staging.
- PR#12c planning decides whether/how to **persist** POI Sequence
  evidence as a durable internal table.
- Durable persistence is what later evidence-consumer layers need:
  Product-Context Fit (truth file §11), Timing Window Detection
  (§14), Policy Pass 1 (§15), Trust Core (§16), Policy Pass 2 (§17),
  Lane A/B projection (§18), Output layer (§19), and the Internal
  Learning Loop (§21). Without durable POI Sequence rows, every
  downstream consumer must rebuild the shape on demand — an
  unstable contract.
- Current staging data is shallow (8 sessions, all `single_poi`).
  That is not a blocker — `single_poi` is **valid POI Sequence
  evidence**. The durable table must reflect that truthfully without
  overclaiming progression.
- The persistence layer must be **truthful, not aspirational**: it
  records what the POI evidence shows now, and admits when richer
  multi-POI sessions arrive later by changing the distribution, not
  the contract.

---

## §3 What POI Sequence is

Per workflow truth file §4C + §9 + §3 (layer taxonomy):

- **POI Sequence** = in-session POI ordering / path evidence derived
  from `poi_observations_v0_1`.
- It belongs to the **evidence foundation / feature-observation
  layer**.
- It is **NOT scoring**.
- It is **NOT AMS Series Core** (which is cross-session continuity:
  Cadence, Compression, Acceleration, Revisit, SeriesConfidence over
  multi-session history — see truth file §10).
- It is **NOT Product-Context Fit** (which calibrates POI + POI
  Sequence + Timing against product/category/site buyer-motion).
- It is **NOT Trust or Policy**.
- It is **NOT customer output**.

POI Sequence sits between the POI evidence branch (PR#10/PR#11) and
later evidence-consumer layers. It produces factual ordered behaviour,
not commercial meaning.

---

## §4 What PR#12c (and the downstream PR#12d/PR#12e implementation it
plans) must NOT do

Explicitly excluded:

- ❌ Scoring of any kind
- ❌ `score`, `verdict`, `reason_codes`, `reason_impacts`, `risk_index`, `verification_score`, `evidence_band`, `action_recommendation`, `triggered_tags`, `penalty_total`
- ❌ Trust (Trust Core, trust decisions, trust state writes)
- ❌ Policy (Policy Pass 1 or Pass 2)
- ❌ Product-Context Fit (band, ProductContextProfile reads/writes)
- ❌ Timing Window actionability decision (fresh_now / warming / stale)
- ❌ AMS Series Core (Cadence, Compression, Acceleration, Revisit, SeriesConfidence, SeriesOutput, TimeOutput, seriescore)
- ❌ Lane A / Lane B writes
- ❌ Customer-facing output of any kind
- ❌ Raw ledger reads (`accepted_events`, `rejected_events`, `ingest_requests`)
- ❌ Stage 0 re-read (`stage0_decisions`)
- ❌ `session_features` / `session_behavioural_features_v0_2` reads
- ❌ `risk_observations_v0_1` reads
- ❌ Private customer mapping / site mapping / buyer-role mapping
- ❌ Render production deploy (A0 P-4 still blocking)

---

## §5 Source boundary

### Recommended v0.1 source

Exactly one DB table:

- `poi_observations_v0_1`

### Forbidden reads (enforced by static-source sweep + SQL allowlist test)

- `accepted_events`
- `rejected_events`
- `ingest_requests`
- `session_features`
- `session_behavioural_features_v0_2`
- `stage0_decisions`
- `risk_observations_v0_1`
- `scoring_output_lane_a`
- `scoring_output_lane_b`
- `site_write_tokens`

### Allowed diagnostic metadata (read-only only)

- `information_schema.tables` — table-presence probe (mirrors PR#11d
  pattern)
- `information_schema.columns` — only for verification SQL /
  forbidden-column sweep (NOT for worker runtime)

### Stage 0 carry-through

Per truth file §4 / §8 and PR#12b precedent:

- Use POI carry-through fields already present on `poi_observations_v0_1`:
  - `stage0_excluded`
  - `poi_eligible`
  - `stage0_rule_id` (provenance-only; never a POI key, scoring
    reason, customer claim, or Product-Context-Fit input)
- **Do NOT re-read `stage0_decisions`.**

---

## §6 Proposed durable table

### Candidate name

`poi_sequence_observations_v0_1`

(Naming consistent with `poi_observations_v0_1` from PR#11c migration
014; version-stamped `_v0_1` per the truth file §22 PR-mapping
convention.)

### Purpose

- Internal durable evidence table.
- One row per `(workspace_id, site_id, session_id,
  poi_sequence_version, poi_observation_version)` initially (see §7
  for the natural-key discussion).
- Derived **only** from POI observation rows.
- Stores factual sequence features, **not judgement**.

### Candidate columns

**Identity / key**

| Column | Type | Notes |
| --- | --- | --- |
| `poi_sequence_observation_id` | `BIGSERIAL PRIMARY KEY` | Non-PII internal row id; safe for anomaly samples |
| `workspace_id` | `TEXT NOT NULL` | Identity boundary |
| `site_id` | `TEXT NOT NULL` | Identity boundary |
| `session_id` | `TEXT NOT NULL` | In-session boundary; masked on report output |
| `poi_sequence_version` | `TEXT NOT NULL DEFAULT 'poi-sequence-v0.1'` | Frozen literal for v0.1 |
| `poi_observation_version` | `TEXT NOT NULL` | Carries through from POI rows |

**Sequence facts**

| Column | Type | Notes |
| --- | --- | --- |
| `poi_count` | `INTEGER NOT NULL` | Total POI rows for the session |
| `unique_poi_count` | `INTEGER NOT NULL` | Distinct `(poi_type, poi_key)` pairs |
| `first_poi_type` | `TEXT NOT NULL` | Earliest POI by `first_seen_at ASC, poi_observation_id ASC` |
| `first_poi_key` | `TEXT NOT NULL` | Earliest POI key (normalized; see §8 nuance) |
| `last_poi_type` | `TEXT NOT NULL` | Latest POI by the same ordering |
| `last_poi_key` | `TEXT NOT NULL` | Latest POI key |
| `first_seen_at` | `TIMESTAMPTZ` | Min across session POI rows |
| `last_seen_at` | `TIMESTAMPTZ` | Max across session POI rows |
| `duration_seconds` | `INTEGER` | `last_seen_at - first_seen_at` (NULL when timestamps absent) |
| `repeated_poi_count` | `INTEGER NOT NULL` | POI rows whose key already appeared earlier |
| `has_repetition` | `BOOLEAN NOT NULL` | `repeated_poi_count > 0` |
| `has_progression` | `BOOLEAN NOT NULL` | `unique_poi_count >= 2` |
| `progression_depth` | `INTEGER NOT NULL` | `unique_poi_count` |
| `poi_sequence_pattern_class` | `TEXT NOT NULL` | One of the 6 v0.1 taxonomy classes |

**Eligibility (Stage 0 carry-through)**

| Column | Type | Notes |
| --- | --- | --- |
| `stage0_excluded` | `BOOLEAN NOT NULL` | TRUE if any POI row in the session has `stage0_excluded=TRUE` |
| `poi_sequence_eligible` | `BOOLEAN NOT NULL` | Pure inverse of `stage0_excluded` (enforced by CHECK) |
| `stage0_rule_id` | `TEXT NULL` | Provenance-only; nullable; never customer-facing |

**Lineage**

| Column | Type | Notes |
| --- | --- | --- |
| `evidence_refs` | `JSONB NOT NULL` | **Direct refs to `poi_observations_v0_1` rows only.** Exact entry shape (or approved durable-POI-id equivalent): `{ "table": "poi_observations_v0_1", "poi_observation_id": <BIGSERIAL id> }`. Allowlist enforced by worker + CHECK on non-empty. **Do NOT copy lower-layer PR#11c POI evidence_refs (e.g. `session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`) into PR#12c POI Sequence `evidence_refs`.** Lower-layer lineage remains discoverable **transitively** through the referenced `poi_observations_v0_1.evidence_refs`. PR#12d worker MUST NOT flatten / copy / inline lower-layer refs. |
| `source_versions` | `JSONB NOT NULL` | `{ poi_observations: ..., poi_input_version: ..., poi_observation_version: ..., poi_sequence_version: 'poi-sequence-v0.1' }` |
| `source_poi_observation_count` | `INTEGER NOT NULL` | `= poi_count` (CHECK) |
| `source_min_poi_observation_id` | `BIGINT` | First contributing POI BIGSERIAL id; non-PII |
| `source_max_poi_observation_id` | `BIGINT` | Last contributing POI BIGSERIAL id; non-PII |

**Provenance**

| Column | Type | Notes |
| --- | --- | --- |
| `record_only` | `BOOLEAN NOT NULL DEFAULT TRUE` | Mirrors PR#5 / PR#6 / PR#11c pattern |
| `derived_at` | `TIMESTAMPTZ NOT NULL` | Worker wall-clock at derivation |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | Row insert time |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | Row update time; bumped on every `ON CONFLICT DO UPDATE` |

---

## §7 Proposed constraints

### CHECK constraints (mirror PR#11c CHECK pattern)

| Name (proposed) | Predicate |
| --- | --- |
| `poi_seq_obs_v0_1_version_pin` | `poi_sequence_version = 'poi-sequence-v0.1'` |
| `poi_seq_obs_v0_1_pattern_class_enum` | `poi_sequence_pattern_class IN ('single_poi','repeated_same_poi','multi_poi_linear','loop_or_backtrack','insufficient_temporal_data','unknown')` |
| `poi_seq_obs_v0_1_eligible_is_pure_inverse_of_stage0_excluded` | `poi_sequence_eligible = (NOT stage0_excluded)` |
| `poi_seq_obs_v0_1_poi_count_pos` | `poi_count >= 1` |
| `poi_seq_obs_v0_1_unique_poi_count_pos` | `unique_poi_count >= 1 AND unique_poi_count <= poi_count` |
| `poi_seq_obs_v0_1_progression_depth_equals_unique` | `progression_depth = unique_poi_count` |
| `poi_seq_obs_v0_1_has_progression_rule` | `has_progression = (unique_poi_count >= 2)` |
| `poi_seq_obs_v0_1_repeated_poi_count_nonneg` | `repeated_poi_count >= 0` |
| `poi_seq_obs_v0_1_repeated_poi_count_bound` | `repeated_poi_count <= GREATEST(poi_count - 1, 0)` |
| `poi_seq_obs_v0_1_repeated_poi_count_identity` *(non-blocking; Codex hint)* | `repeated_poi_count = poi_count - unique_poi_count` |
| `poi_seq_obs_v0_1_has_repetition_rule` *(non-blocking; Codex hint)* | `has_repetition = (repeated_poi_count > 0)` |
| `poi_seq_obs_v0_1_duration_nonneg` | `duration_seconds IS NULL OR duration_seconds >= 0` |
| `poi_seq_obs_v0_1_timestamps_ordered` | `first_seen_at IS NULL OR last_seen_at IS NULL OR first_seen_at <= last_seen_at` |
| `poi_seq_obs_v0_1_source_count_matches_poi_count` | `source_poi_observation_count = poi_count` |
| `poi_seq_obs_v0_1_source_id_range_ordered` | `source_min_poi_observation_id IS NULL OR source_max_poi_observation_id IS NULL OR source_min_poi_observation_id <= source_max_poi_observation_id` |
| `poi_seq_obs_v0_1_record_only_must_be_true` | `record_only IS TRUE` |
| `poi_seq_obs_v0_1_evidence_refs_is_array` | `jsonb_typeof(evidence_refs) = 'array'` |
| `poi_seq_obs_v0_1_evidence_refs_nonempty` | `jsonb_array_length(evidence_refs) > 0` |
| `poi_seq_obs_v0_1_source_versions_is_object` | `jsonb_typeof(source_versions) = 'object'` |

### Forbidden columns (negative constraint enforced by PR#12e observer)

The table must NOT carry any column from the §8 forbidden list. The
PR#12e table observer will sweep `information_schema.columns`
against the allowlist (mirroring PR#11d's `FORBIDDEN_COLUMNS`).

### Natural key

Proposed UNIQUE constraint:

```
UNIQUE (workspace_id, site_id, session_id, poi_sequence_version, poi_observation_version)
```

### Discussion: include `poi_input_version` in the natural key?

- **Recommended (v0.1): NO.** Keep `poi_input_version` in
  `source_versions` JSONB only.
- Reasoning: a session's POI rows always share one
  `poi_input_version` value (the PR#10 contract version); persisting
  it in the natural key would only matter if a single session
  contained POI rows from two different PR#10 contract versions —
  not a realistic v0.1 state. The cost of adding it later is a
  forward-only natural-key extension migration.
- Codex may recommend widening the natural key if there is a
  cross-version replay scenario PR#12c missed.

### Indexes (proposed)

| Index | Purpose |
| --- | --- |
| `(workspace_id, site_id, derived_at DESC)` | Standard workspace/site recency lookup |
| `(workspace_id, site_id, session_id)` | Session lookup |
| `(poi_sequence_version, poi_observation_version, derived_at DESC)` | Version-stamp distribution |
| Partial `(workspace_id, site_id, stage0_excluded, derived_at DESC) WHERE stage0_excluded = TRUE` | Mirrors PR#11c `poi_obs_v0_1_stage0_excluded` |

### Role grants (proposed; mirrors PR#11c OD-7)

- `buyerrecon_migrator`: ALL
- `buyerrecon_scoring_worker`: SELECT, INSERT, UPDATE
- `buyerrecon_internal_readonly`: SELECT (table only — NO sequence
  USAGE/UPDATE, per the PR#11c Codex-blocker precedent)
- `buyerrecon_customer_api`: **zero SELECT** (REVOKE ALL; Hard-Rule-I
  parity assertion in the migration's DO block)

---

## §8 Privacy / forbidden columns

The durable POI Sequence table MUST NOT contain any of:

**Score / verdict / RiskOutput-shaped**
- `score`, `verdict`, `risk_index`, `verification_score`
- `evidence_band`, `action_recommendation`
- `reason_codes`, `reason_impacts`, `triggered_tags`, `penalty_total`

**Lane / Trust / Policy**
- `lane_a`, `lane_b`
- `trust_decision`, `policy_decision`, `final_decision`

**Customer-facing**
- `customer_facing`, `report`
- `buyer_intent`, `product_context_fit`, `buyer_role`

**Raw URL / payload**
- `page_url`, `full_url`, `url_query`, `query`
- `raw_payload`, `payload`, `canonical_jsonb`

**UA / IP / token / auth**
- `user_agent`, `ua`, `user_agent_family`
- `ip`, `ip_hash`, `asn_id`, `ip_company`, `ip_org`
- `token_hash`, `pepper`, `bearer`, `authorization`, `cookie`, `auth`

**Identity**
- `person_id`, `visitor_id`, `email_id`, `person_hash`
- `email_hash`, `email`, `phone`
- `company_id`, `domain_id`, `account_id`
- `device_fingerprint`, `font_list`

### Important nuance: `first_poi_key` / `last_poi_key`

- These columns are allowed because POI keys are already
  PR#10-normalized (no raw URL query, no email-shaped strings, no
  credential-shaped strings) and migration 014 pins
  `poi_obs_v0_1_poi_type_v0_1` to `page_path` for v0.1.
- **However**: customer-facing outputs MUST still not expose raw POI
  keys blindly. POI keys are internal evidence values, not customer
  copy.
- **Default observer/report rule (carry over from PR#11d /
  PR#12b)**: do NOT include `first_poi_key` / `last_poi_key` values
  in samples by default. Use aggregate distributions instead. If
  anomaly samples are needed, surface
  `poi_sequence_observation_id` (BIGSERIAL) only.

---

## §9 Manual worker plan (deferred to PR#12d implementation)

Future PR#12d implementation should create:

| Artefact | Path |
| --- | --- |
| Migration | `migrations/015_poi_sequence_observations_v0_1.sql` |
| Worker module | `src/scoring/poi-sequence-worker/{types,query,mapper,upsert,worker,index}.ts` |
| CLI runner | `scripts/run-poi-sequence-worker.ts` |
| npm script | `run:poi-sequence-worker` |
| Pure tests | `tests/v1/poi-sequence-worker.test.ts` |
| DB tests (optional, gated by `TEST_DATABASE_URL`) | `tests/v1-db/poi-sequence-worker.db.test.ts` |
| Verification SQL | `docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql` |

### Worker behaviour requirements

- Reads **only** `poi_observations_v0_1` (no other source table).
- Groups POI rows by `(workspace_id, site_id, session_id)` exactly
  as the PR#12b observer does (same SQL ordering: `workspace_id ASC,
  site_id ASC, session_id ASC, first_seen_at ASC NULLS LAST,
  poi_observation_id ASC`).
- Uses the same v0.1 pattern taxonomy as PR#12b observer (one source
  of truth for classification rules — share `src/scoring/poi-sequence-observer/mapper.ts`
  helpers OR duplicate-with-test-pinning to avoid PR#11d-style
  cross-module import friction; Codex to decide).
- Upserts one durable row per natural key via `ON CONFLICT DO UPDATE`
  with `updated_at = NOW()` on conflict (mirrors PR#11c worker
  `OD-6.1`).
- **Idempotent rerun**:
  - First run inserts N rows.
  - Rerun on unchanged source: `rows_updated = N` (or zero if the
    worker decides to detect no-op via per-row hash), `rows_inserted = 0`.
  - Row count in `poi_sequence_observations_v0_1` remains stable.
- **Manual CLI only** — no cron, no queue, no scheduler, no
  post-commit hook (mirrors PR#11c worker OD-4).
- No customer output. No score. No verdict.
- DSN masked in CLI logs; `session_id` masked in any sampled output.
- Bounded by env vars: `WORKER_WORKSPACE_ID`, `WORKER_SITE_ID`,
  `WORKER_WINDOW_HOURS`, `WORKER_LIMIT` (default e.g. 50,000).

### Worker constraints (locked rule)

- Per-row anomaly path: worker MUST tolerate malformed source rows
  without crashing — fold into a counter, never `throw`. Same
  invariant as PR#11c worker.
- No partial-row writes: every row written must satisfy every CHECK.
- Worker writes nothing if the source has zero rows in the window.

---

## §10 Verification SQL plan (deferred to PR#12d)

`docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql`
should contain anomaly checks mirroring PR#11c verification SQL:

| Check | SQL pattern | Expected (healthy) |
| --- | --- | --- |
| Table exists | `SELECT EXISTS (... FROM information_schema.tables WHERE table_name='poi_sequence_observations_v0_1')` | `t` |
| Duplicate natural keys = 0 | `SELECT COUNT(*) FROM (SELECT 1 FROM poi_sequence_observations_v0_1 GROUP BY workspace_id, site_id, session_id, poi_sequence_version, poi_observation_version HAVING COUNT(*) > 1) d` | `0` |
| `poi_sequence_eligible = NOT stage0_excluded` violations | `SELECT COUNT(*) FROM poi_sequence_observations_v0_1 WHERE poi_sequence_eligible <> (NOT stage0_excluded)` | `0` |
| Pattern-class enum violations | `... WHERE poi_sequence_pattern_class NOT IN (<6 classes>)` | `0` |
| `has_progression = (unique_poi_count >= 2)` violations | per-row predicate | `0` |
| `progression_depth = unique_poi_count` violations | per-row predicate | `0` |
| `source_poi_observation_count = poi_count` violations | per-row predicate | `0` |
| `poi_count < 1` rows | per-row predicate | `0` |
| `unique_poi_count < 1` or `unique_poi_count > poi_count` rows | per-row predicate | `0` |
| Timestamp-ordering violations | `first_seen_at > last_seen_at` (NULL-safe) | `0` |
| `duration_seconds < 0` rows | per-row predicate | `0` |
| Empty / non-array `evidence_refs` | `jsonb_typeof(evidence_refs) <> 'array' OR jsonb_array_length(evidence_refs) = 0` | `0` |
| Non-object `source_versions` | `jsonb_typeof(source_versions) <> 'object'` | `0` |
| Forbidden column names present | sweep `information_schema.columns` for the §8 forbidden list | `0` |
| Forbidden ref-source tables in `evidence_refs` | recursive scan for any `table` value other than `poi_observations_v0_1` | `0` |
| Direct POI Sequence `evidence_refs` shape | every entry MUST be a plain object with `table = 'poi_observations_v0_1'` and a valid POI observation id field (BIGSERIAL); lower-layer `session_features` / `session_behavioural_features_v0_2` / `stage0_decisions` entries are **NOT** valid direct refs and trip this counter | `0` |
| Lane A row delta during worker run | pre-count `scoring_output_lane_a` vs post-count | `0` |
| Lane B row delta during worker run | pre-count `scoring_output_lane_b` vs post-count | `0` |

---

## §11 Hetzner proof concept for future implementation (deferred to PR#12d / PR#12e)

If current staging data is unchanged at PR#12d implementation time
(8 POI rows, 6 excluded, 2 eligible, all `single_poi`), the expected
proof state is:

### Migration 015 apply

- Migration applies idempotently.
- Role grants land exactly as proposed in §7.
- Hard-Rule-I parity assertion passes (`customer_api` zero SELECT;
  `internal_readonly` zero sequence USAGE/UPDATE).
- Verification SQL anomalies all 0.

### Worker first run

| Signal | Expected |
| --- | --- |
| Source POI rows scanned | 8 |
| Sessions grouped | 8 |
| `rows_inserted` | 8 |
| `rows_updated` | 0 |
| Pattern distribution: `single_poi` | 8 |
| `stage0_excluded` distribution | `{true: 6, false: 2}` |
| `poi_sequence_eligible` distribution | `{true: 2, false: 6}` |
| `total_anomalies` | 0 |
| Pre / post counts on every other monitored table | unchanged |
| Lane A / Lane B | 0 / 0 |

### Worker rerun (idempotency check)

| Signal | Expected |
| --- | --- |
| `rows_inserted` | 0 |
| `rows_updated` | 8 (or 0 if worker detects no-op via hash — Codex to decide) |
| Row count in `poi_sequence_observations_v0_1` | 8 (stable) |

### Regression observers (deferred to PR#12e proof step)

Expected concurrent PASS:
- `observe:risk-core-bridge`
- `observe:poi-core-input`
- `observe:poi-table`
- `observe:poi-sequence` (PR#12b)

After PR#12e adds the table observer:
- `observe:poi-sequence-table` PASS

---

## §12 Implementation options

### Option A — Do not persist yet

- Keep PR#12b observer only.
- Wait for richer multi-POI staging data before introducing a
  durable table.
- **Pro**: lowest DB risk; no maintenance burden on a table of
  shallow rows.
- **Con**: downstream PCF / Timing / Trust / Policy / Output /
  Learning layers have no stable POI Sequence contract to read; every
  consumer must rebuild the shape in memory; future schema drift
  risk multiplied across consumers.

### Option B — Persist truthful shallow sequences now (recommended)

- Create `poi_sequence_observations_v0_1` table + manual CLI worker
  + verification SQL in PR#12d.
- Current rows are mostly `single_poi`. Persist them truthfully.
- **Pro**: stable evidence foundation; downstream consumer contracts
  can be designed against a real durable shape rather than an
  in-memory observer; mirrors the proven PR#11b → PR#11c → PR#11d
  cadence.
- **Con**: a table of mostly `single_poi` rows at this stage. Safe
  because the contract is "truthful in-session ordering evidence",
  not "rich progression evidence". The distribution shifts as
  staging data richens; the contract does not.

### Option C — Wait until POI richness expands, then persist

- Block PR#12d until staging shows multi-POI sessions.
- **Pro**: avoids a table of all `single_poi`.
- **Con**: blocks every downstream layer's contract design (PCF,
  Timing, Trust, Policy, Output) on an external data event. Wrong
  trade-off: contract stability matters more than distribution
  variety.

### Recommended default

**Option B**, conditional on Codex review + Helen sign-off of this
PR#12c planning doc:

- Persist truthful shallow sequences now.
- Treat `single_poi` as valid POI Sequence evidence, NOT progression.
- Make NO customer claims about it.
- Manual CLI worker only.
- Read-only table observer in a separate PR#12e (do not bundle).

---

## §13 Proposed PR chain

### Recommended (un-compressed; mirrors PR#11 cadence)

| PR | Scope | Mode |
| --- | --- | --- |
| **PR#12c** (this doc) | Planning only | Docs-only |
| **PR#12d** | Migration 015 + manual worker + verification SQL | Implementation |
| **PR#12e** | Read-only table observer + Hetzner proof runbook | Implementation (observer) + Hetzner proof |
| **PR#13a** | Product-Context Fit planning | Docs-only — only after PR#12e Hetzner proof PASS |

This chain mirrors PR#11a (planning) → PR#11c (table + worker) →
PR#11d (table observer + Hetzner proof). It is the only cadence
that has yielded a clean Hetzner-proven outcome so far in Sprint 2.

### Alternative (compressed)

| PR | Scope |
| --- | --- |
| PR#12d (compressed) | Migration 015 + manual worker + table observer + Hetzner proof, all in one PR |

**NOT recommended.** Compression breaks the observer-first
discovery cadence that surfaced the PR#11c sequence-USAGE Codex
blocker, the PR#11d authoritative-counter Codex blocker, and the
PR#12b evidence_refs `table`-field Codex blocker. Keep PR#12d and
PR#12e separate.

---

## §14 Open decisions for Helen (OD list)

| # | Question | Recommended |
| --- | --- | --- |
| **OD-1** | Persist POI Sequence observations now despite current staging being all `single_poi`? | **YES** — truthful shallow evidence is valid; downstream contracts need a stable shape |
| **OD-2** | Durable table name = `poi_sequence_observations_v0_1`? | **YES** |
| **OD-3** | v0.1 source = `poi_observations_v0_1` only? | **YES** |
| **OD-4** | PR#12d worker = manual CLI only, no scheduler? | **YES** (mirrors PR#11c OD-4) |
| **OD-5** | Natural key = `(workspace_id, site_id, session_id, poi_sequence_version, poi_observation_version)`? | **YES** unless Codex recommends adding `poi_input_version` |
| **OD-6** | Persist `stage0_rule_id` on the durable table? | **YES** — provenance-only, nullable, never reason/customer-facing |
| **OD-7** | Store `first_poi_key` / `last_poi_key`? | **YES** — already normalized/query-free, but never sampled in public reports by default (§8 nuance) |
| **OD-8** | Persist `single_poi` rows? | **YES** — truthful shallow evidence, NOT progression |
| **OD-9** | `has_progression` requires `unique_poi_count >= 2`? | **YES** — enforced by CHECK constraint |
| **OD-10** | Include Product-Context Fit / Timing Window actionability / Trust / Policy / Lane A/B / score / verdict / reason codes on the table? | **NO** — strict §8 forbidden list |
| **OD-11** | PR#12e (table observer) separate from PR#12d (table + worker)? | **YES** — preserves observer-first cadence (§13) |
| **OD-12** | Implementation proceeds only after Codex PASS + Helen sign-off on this PR#12c planning doc? | **YES** |
| **OD-13** | AMS Series Core canonical names remain reserved (do NOT mint `SeriesOutput`, `TimeOutput`, `seriescore`, `series_version`, `series_eligible`, `series_observations_v0_1`, `observe:series`, `Cadence`/`Compression`/`Acceleration`/`Revisit`/`SeriesConfidence` as PR#12d/PR#12e runtime field names)? | **YES** — frozen-name guard from truth file §10 + §23 |
| **OD-14** | POI Sequence `evidence_refs` point only to **direct** `poi_observations_v0_1` rows, NOT lower-layer / transitive refs? | **YES** — lower-layer POI lineage (`session_features`, `session_behavioural_features_v0_2`, `stage0_decisions`) remains discoverable **transitively** through the referenced `poi_observations_v0_1.evidence_refs`. PR#12d worker MUST NOT flatten, copy, or inline lower-layer refs into the POI Sequence table. The verification SQL anomaly counter trips on any direct `evidence_refs[].table` value other than `poi_observations_v0_1`. |

---

## §15 Codex review checklist

Codex should verify:

- ✅ Docs-only — no code, no `package.json`, no migration, no
  `schema.sql`, no DB, no `psql`, no Render
- ✅ Source boundary is `poi_observations_v0_1` only; forbidden-read
  list complete
- ✅ Table proposal does NOT confuse POI Sequence with AMS Series Core
  (truth file §10 + §23 frozen-name guard honoured)
- ✅ No Product-Context Fit / Trust / Policy / Lane A/B / customer
  output anywhere in the proposal
- ✅ Proposed CHECK constraints are sufficient and align with v0.1
  taxonomy
- ✅ Privacy / forbidden-columns list is complete
- ✅ Natural key is sensible; `poi_input_version` discussion is
  explicit
- ✅ Stage 0 carry-through is correct (POI fields only; no
  `stage0_decisions` re-read)
- ✅ `single_poi` persistence does NOT overclaim progression
  (`has_progression` requires `unique_poi_count >= 2`)
- ✅ PR chain is sensible (Recommended Option B + un-compressed
  cadence)
- ✅ Manual CLI worker only; no scheduler
- ✅ Worker rerun idempotency is specified
- ✅ Role grants follow PR#11c posture; `internal_readonly` zero
  sequence USAGE/UPDATE
- ✅ Verification SQL plan covers every CHECK + Lane A/B parity +
  forbidden-column sweep
- ✅ Hetzner proof concept anticipates the current shallow-staging
  distribution

---

## §16 Recommended next step

After Codex review PASS + Helen sign-off on this PR#12c planning doc:

1. **Commit + push PR#12c planning doc** on
   `sprint2-architecture-contracts-d4cc2bf`.
2. **Implement PR#12d**: migration 015 (`poi_sequence_observations_v0_1`),
   manual worker (`src/scoring/poi-sequence-worker/*` +
   `scripts/run-poi-sequence-worker.ts` + npm script
   `run:poi-sequence-worker`), verification SQL
   (`docs/sql/verification/15_poi_sequence_observations_v0_1_invariants.sql`),
   tests, and PR#12d implementation doc.
3. **Do NOT implement a table observer in PR#12d.** Defer the table
   observer to a separate PR#12e with its own Hetzner proof runbook
   (mirrors PR#11c → PR#11d split).
4. **Do NOT compress the chain.** Each PR has its own Codex review +
   Helen sign-off gate.
5. **Render production remains BLOCKED by A0 P-4.** No production
   deploy at any point in the PR#12 chain.

---

**End of PR#12c planning document.**
