# Sprint 2 PR#3 — Lane A / Lane B scoring output contract layer — planning

**Status.** Planning only. Helen sign-off required before any implementation.
No code, no migration, no schema.sql change, no extractor change, no DB
touch, no collector / app / server / auth change. PR#1 and PR#2 files are
referenced read-only.

**Authority (verbatim quoted in §2 below).**

- `docs/architecture/ARCHITECTURE_GATE_A0.md` (committed at `a87eb05`) §K row PR#3 + §D steps 6 + 8
- `docs/contracts/signal-truth-v0.1.md` §10 Hard Rules A–I
- `scoring/reason_code_dictionary.yml` (`rc-v0.1`)
- `scoring/forbidden_codes.yml` (`forbidden-v0.1`)
- `scoring/version.yml` (`scoring_version: s2.v1.0`; `status: record_only`; `automated_action_enabled: false`)

**Closed prerequisite state.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| Prior commit (PR#2) | `3d8817701e509ec83b143d08ea40e7c26f0cbff6` |
| `git status` | (this planning doc untracked; otherwise clean) |
| PR#2 Codex re-review | PASS |
| PR#2 Hetzner staging proof | PASS |
| Migration 010 applied (Hetzner staging only, not Render production) | yes |
| Behavioural extractor v0.3 staging upsert | 8 rows |
| `docs/sql/verification/09_refresh_loop_invariants.sql` | all anomaly rows = 0 |
| `observe:collector` | PASS |
| Render production touched | **no** |

---

## §A Executive summary

### What PR#3 is

PR#3 is the **Lane A / Lane B scoring output contract / storage layer.**
It defines the two output tables (`scoring_output_lane_a`,
`scoring_output_lane_b`), the Postgres-role isolation that makes Lane B
unreachable from the customer-facing API role, and the CI SQL linter
that enforces Hard Rule H (no JOIN across the two output tables).

PR#3 is the **first contract surface between the factual evidence layer
(PR#1 + PR#2) and the future scoring workers (PR#5 Stage 0 + PR#6
Stage 1).** It is the *typed surface* downstream scorers will write to.
It is **NOT a scorer.**

### What PR#3 is NOT

- **NOT** a scorer. No verification_score / evidence_band /
  action_recommendation / reason_code is computed by PR#3 code.
- **NOT** a router. The Lane split router function described in A0 §D
  step 6 belongs to a *separate* PR — see §B "A0 internal tension" below
  and §J open decision OD-1.
- **NOT** a Lane B observer. The Lane B observer described in A0 §D
  step 8 *writes* `B_DECLARED_AI_CRAWLER` / `B_SIGNED_AGENT` rows; that
  is **out of scope** for the conservative PR#3 recommended here and
  is deferred to a future PR pending Helen sign-off (OD-1).
- **NOT** a Stage 0 worker (that is PR#5).
- **NOT** a Stage 1 scorer (that is PR#6).
- **NOT** a `false_positive_review` queue (that is PR#7).
- **NOT** a customer-facing dashboard or report.
- **NOT** an AI-agent / crawler taxonomy implementation (the Bytespider
  reclassification is P-11, blocking PR#5 not PR#3).
- **NOT** any change to the v1 collector ingestion path.

### Why PR#3 follows PR#1 + PR#2

The factual evidence chain so far reads:

```
accepted_events                                  (PR#10 collector, untouched)
        │
        ├──► session_features                    (Sprint 1 PR#11, untouched)
        │
        └──► session_behavioural_features_v0_2   (Sprint 2 PR#1)
                                                  + refresh_loop_candidate
                                                  + 7 diagnostic columns
                                                  (Sprint 2 PR#2; v0.3)
```

The Sprint 2 architecture chains the next link as:

```
session_behavioural_features_v0_2  ──►  scoring_output_lane_a   (PR#3 reserves)
                                   ──►  scoring_output_lane_b   (PR#3 reserves)
```

PR#3 stops at *reserving the typed surface*. The arrows above are *not
implemented by PR#3.* Whoever (PR#5 / PR#6 / a later PR) writes the
arrows must conform to the PR#3 contract.

---

## §B A0 alignment

### §B.1 Verbatim quote — A0 §K row PR#3

The single authoritative scope line for PR#3 in A0 §K is:

> | **PR#3** | Lane A / Lane B split schema | `scoring_output_lane_a`
> + `scoring_output_lane_b` + Postgres role enforcement + CI SQL linter
> blocking JOINs | new (additive) | pure + dbtest + CI lint | **no** |

Columns: PR / Title / Scope / Migrations / Tests / Touches collector?

**Interpretation.** PR#3 is *schema + role + CI lint*, with new additive
migrations, pure + DB + CI tests, and **does not touch the collector.**

### §B.2 Verbatim quote — A0 §D step 6 (Lane split router)

> **6. Lane split (Sprint 2 PR#3).** A pure router function reads
> `behavioural_features_v0_2` + `accepted_events.raw` UA classification
> and emits two parallel scoring inputs: `scoring_input_lane_a`
> (invalid-traffic features) and `scoring_input_lane_b` (declared-agent
> features). **Hard Rule H enforced**: no JOIN between
> `scoring_output_lane_a` and `scoring_output_lane_b` in any query (CI
> SQL linter parses every query).

### §B.3 Verbatim quote — A0 §D step 8 (Lane B observer)

> **8. Lane B observer (Sprint 2 PR#3).** Pure observation. Reads
> declared agent family + verification method (`reverse_dns` /
> `ip_validation` / `web_bot_auth` / `partner_allowlist` / `none`).
> Writes `B_DECLARED_AI_CRAWLER` or `B_SIGNED_AGENT` to
> `scoring_output_lane_b`. **`verification_method_strength = strong` is
> reserved-not-emitted in v1** — scorer startup asserts no rule emits it
> (**Hard Rule** in `forbidden_codes.yml`). **Postgres role
> enforcement**: customer-facing API role has zero SELECT on
> `scoring_output_lane_b` (**Hard Rule I**, post-deploy smoke test).

### §B.4 A0 internal tension — surfaced for Helen

The §K row says PR#3 is *schema + role + CI lint*. §D steps 6 + 8
attribute *router function* (§D 6) and *Lane B observer that writes
emitted reason codes* (§D 8) to PR#3 as well. Step 8 in particular
implies PR#3 *emits* `B_DECLARED_AI_CRAWLER` / `B_SIGNED_AGENT` — which
is reason-code emission.

The user's task brief for THIS planning round is explicit:

> Planning only. No reason-code emission. No scoring algorithm.

So this plan **cannot** package §D 6 + §D 8 into PR#3 without violating
the user's brief. The conservative interpretation — and the
recommendation here — is:

- **PR#3 (this plan)** = §K row only: schema + Postgres role enforcement
  + CI SQL linter + contract docs. No router. No observer. No emitted
  reason codes. No rows written by PR#3 code. **Inserts come from
  later PRs.**
- **PR#3.b** (or PR#3a, naming OD-5) — *deferred*. The router function
  (§D 6) and the Lane B observer (§D 8). Each writes rows. Each needs
  Helen sign-off, Codex review, and its own staging proof. Emission of
  `B_DECLARED_AI_CRAWLER` / `B_SIGNED_AGENT` is reason-code emission
  and is **blocked by the user's current brief** — Helen must
  explicitly approve before it ships, regardless of A0 §D wording.

This tension is OD-1 (the first open decision below).

### §B.5 P-decisions (A0 §0.6) gating PR#3

A0 §0.6 lists three open Helen decisions that A0 itself records as
**blocking for PR#3**:

| P | Decision | A0-recommended default |
| --- | --- | --- |
| **P-1** | Same Render DB with view boundary vs separate report DB? | **Same DB + read-only views.** Separate report DB deferred to Sprint 4+. |
| **P-2** | AMS reads raw `accepted_events`, `session_features`, or bounded view? | **Bounded view `vw_ams_subject_window_v1`** (K-α now + K-β in Sprint 2.5). |
| **P-7** | Lane B dark-launch: store + test + never customer-facing? | **Confirm yes** (matches signal-truth-v0.1 §8). |

The plan in §C–§H below assumes A0's recommended defaults. If Helen
revises any of P-1 / P-2 / P-7, this plan must be revisited.

### §B.6 Hard Rules A–I (`signal-truth-v0.1.md` §10) touched by PR#3

| Rule | Wording (verbatim) | PR#3 enforcement obligation |
| --- | --- | --- |
| A | `evidence_band` enum is `[low, medium]`. Type system makes `high` unrepresentable | Type-level enum in TS + SQL CHECK (`high` not in domain). |
| B | `action_recommendation` defaults to `record_only`. Setting otherwise requires explicit feature_flag check | Column default `'record_only'`. v1 enum `{record_only, review}`. |
| H | No JOIN between `scoring_output_lane_a` and `scoring_output_lane_b` in any query | CI SQL linter (new). |
| I | Postgres role used by customer-facing API has zero SELECT on `scoring_output_lane_b` | Migration grants + post-deploy smoke (new SQL verification file). |

Rules C, D (reason-code dictionary integrity, forbidden_codes startup
refusal) are enforced by the *scorer*, not by PR#3. Rules E, F, G
(scoring_version bump pre-commit hook; no ML imports; no HTTP from
scoring_worker) are scorer / scoring-folder rules and do not bind PR#3
SQL.

---

## §C Source inputs

PR#3 is a *write target* contract layer. It does not read or transform
factual inputs. The inputs are listed here for completeness so the
schema's foreign-key references and natural keys align.

| Input | Owner | Reader (later PR) | Role for PR#3 |
| --- | --- | --- | --- |
| `accepted_events` | PR#10 collector (Sprint 1) | PR#6 / future Lane B observer | NOT read by PR#3 code. NOT referenced by FK (raw evidence ledger; FK from a derived table to a ledger table is the wrong direction). |
| `session_features` | PR#11 (Sprint 1) | future router (deferred) | NOT read by PR#3 code. |
| `session_behavioural_features_v0_2` (`feature_version` rows incl. `behavioural-features-v0.3`) | PR#1 + PR#2 (this sprint) | future scorers | NOT read by PR#3 code. Natural key `(workspace_id, site_id, session_id, feature_version)` is **the FK candidate** for the lane output tables — see §E. |
| `scoring/reason_code_dictionary.yml` | PR#0 | scorer startup (PR#4) | Referenced as **contract**: PR#3 schema reserves a JSONB `reason_codes` column shape compatible with the dictionary's keys; PR#3 does **NOT** emit any code. |
| `scoring/forbidden_codes.yml` | PR#0 | scorer startup + CI grep (PR#4) | Referenced as **contract**: PR#3 forbidden-term sweep runs against the active SQL / TS sources (post-CF-2 `.patterns` shape). |
| `scoring/version.yml` (`scoring_version: s2.v1.0`) | PR#0 | scorer stamp | Referenced as **contract**: PR#3 schema reserves a `scoring_version TEXT NOT NULL` column on each lane output table. **PR#3 itself writes no scoring_version stamp** — that is the scorer's job at row insertion. |

---

## §D Proposed schema strategy

### §D.1 Options considered

| Option | Description | A0 alignment | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- | --- |
| **(a)** | Two separate tables `scoring_output_lane_a` + `scoring_output_lane_b` (additive migration). | **Matches A0 §K row PR#3 verbatim.** | Postgres role isolation (Hard Rule I) is straightforward: revoke SELECT on `scoring_output_lane_b` from customer-facing role. Hard Rule H ("no JOIN") is trivial to lint because lane membership is encoded in table name. Independent retention policy per lane. | Two tables to migrate, version, retire. | **Recommended.** |
| **(b)** | One combined table with `lane TEXT NOT NULL CHECK (lane IN ('a','b'))`. | Diverges from A0 §K wording (which names two tables explicitly). | One migration. | Hard Rule H ("no JOIN across the two output tables") collapses to "no SELF-JOIN on the combined table", which a SQL linter can still enforce but the surface is harder to scope. Hard Rule I (role isolation) requires row-level security or a *view* layer — more moving parts, more failure modes. | **Rejected.** |
| **(c)** | No table yet — PR#3 ships docs only (contract YAML / Markdown). | Diverges from A0 §K wording (which says new migrations). | Lowest risk. | Future PRs cannot start without the schema; this only defers work. | **Rejected** — A0 §K explicitly requires "new (additive)" migrations. |
| **(d)** | Schema-only PR#3 (this plan): tables + role grants + CI lint + contract docs; **no insert code**, **no row written by PR#3**. | **Matches A0 §K row PR#3 verbatim, minus the §D-6/§D-8 router/observer.** | Smallest, reviewable PR. Doesn't touch the user's hard "no reason-code emission" boundary. Lets PR#5 / PR#6 / a follow-on PR fill in the writers under their own review gates. | Requires explicit Helen sign-off that the router (§D 6) and Lane B observer (§D 8) ship in a separate PR. | **Recommended.** This is option (a) with the writer code deliberately deferred. |

### §D.2 Recommended default

**Option (d) — schema-only.** Two new tables (`scoring_output_lane_a`,
`scoring_output_lane_b`), one new migration, Postgres role grants
restricting customer-facing API role's SELECT on Lane B, one new CI SQL
linter check, two new verification SQL files, contract docs. No
insertion code. No row written by PR#3. The router function (A0 §D 6)
and the Lane B observer (A0 §D 8) are deferred to a follow-on PR
pending Helen sign-off.

This is the conservative read of A0 §K compatible with the user's hard
boundaries for THIS round. Helen may override (OD-1).

---

## §E Lane semantics

### §E.1 Lane A — invalid-traffic / behavioural rubric output

Lane A captures the v1 Stage 1 behavioural-rubric output (Sprint 2 PR#6
Lane A scorer, vendored from Track A `lib/stage1-behaviour-score.js`).

- **Inputs** (future, not PR#3): 8 allowlisted behavioural fields from
  `session_behavioural_features_v0_2` (PR#1 + PR#2 v0.3).
- **Outputs** (the columns PR#3 reserves):
  - `verification_score INT NOT NULL CHECK (verification_score BETWEEN 0 AND 99)` — internal-only integer; never customer-displayed (signal-truth §11).
  - `evidence_band TEXT NOT NULL CHECK (evidence_band IN ('low','medium'))` — Hard Rule A; `'high'` is unrepresentable.
  - `action_recommendation TEXT NOT NULL DEFAULT 'record_only' CHECK (action_recommendation IN ('record_only','review'))` — Hard Rule B; `exclude`/`allow`/`block`/`deny` are forbidden (`forbidden_codes.yml`).
  - `reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb` — array of strings; each must resolve in `reason_code_dictionary.yml` at scorer startup (Hard Rule C, enforced by **scorer**, not PR#3).
  - `evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb` — array of `{table, primary_key}` references back to the factual layer (for replay).
  - `scoring_version TEXT NOT NULL` — stamped by scorer at write time (Hard Rule E). PR#3 schema reserves the column; PR#3 writes no rows.
  - `knob_version_id TEXT` (nullable; Sprint 2 v1 may not yet have knob versioning beyond `scoring_version`).
- **RECORD_ONLY semantics.** Lane A rows are *internal record-only*
  in v1. They are NEVER customer-facing. The customer-facing API role
  may read Lane A via a *view* (`vw_scoring_output_lane_a_redacted`,
  proposed in OD-7) but not the raw table — TBD.

### §E.2 Lane B — declared-agent observation output

Lane B captures the v1 declared-agent / signed-agent observation output
(future A0 §D 8 Lane B observer; deferred from PR#3 per §B.4 + OD-1).

- **Outputs** (the columns PR#3 reserves):
  - `agent_family TEXT NOT NULL` — declared agent family name (e.g. `openai_gpt`, `anthropic_claude`, `perplexity`, `bytespider`, `googlebot`). Free-text in v1; future taxonomy in PR#5 P-11.
  - `verification_method TEXT NOT NULL CHECK (verification_method IN ('reverse_dns','ip_validation','web_bot_auth','partner_allowlist','none'))` — enum from A0 §D 8.
  - `verification_method_strength TEXT` — **reserved-not-emitted in v1** (signal-truth §10 Hard Rule referenced; §11 out-of-scope for Sprint 2). `forbidden_codes.yml` enforces no emission of `'strong'`. PR#3 schema reserves the column; PR#3 writes no row; v1 scorer startup asserts no rule emits `'strong'`.
  - `reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb` — same JSONB shape as Lane A, but scope is the `B_*` namespace (`B_DECLARED_AI_CRAWLER`, `B_SIGNED_AGENT` per `reason_code_dictionary.yml`).
  - `evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb`.
  - `scoring_version TEXT NOT NULL`.
- **DARK-LAUNCH / NEVER CUSTOMER-FACING.** Per A0 P-7 + signal-truth §8 + Hard Rule I:
  - The customer-facing API role has **zero SELECT** on `scoring_output_lane_b` — enforced by migration grants and post-deploy smoke (new SQL verification file).
  - Lane B never surfaces in any dashboard, report, customer card, or product UI.

### §E.3 Factual derived vs future scoring — explicit boundary

The contract surface PR#3 introduces is **strictly downstream** of the
factual layer. It is the *first place* where:

- An *evidence_band* exists (Hard Rule A — `{low, medium}`).
- An *action_recommendation* exists (Hard Rule B — `{record_only, review}`).
- A *reason_codes[]* array exists (Hard Rule C — dictionary-validated).

The factual layer (PR#1 + PR#2) has *none* of these concepts:

- `session_behavioural_features_v0_2` has NO `evidence_band`, NO
  `action_recommendation`, NO `reason_codes`, NO `score`. (Verified by
  PR#1 + PR#2 verification SQL.)
- `refresh_loop_candidate` (PR#2) is a *factual* boolean, NOT a
  judgement. The PR#2 column name was deliberately chosen NOT to be
  `refresh_loop_observed` to avoid judgement implication (D-2).

PR#3 introduces the storage contract that can hold future scorer
outputs, but **PR#3 itself does not compute, insert, emit, display, or
route any judgement.** The columns named in §E.1 / §E.2
(`verification_score`, `evidence_band`, `action_recommendation`,
`reason_codes`, `verification_method`, `verification_method_strength`)
are *schema reservations* whose values are written exclusively by future
scorer / observer code under separate Helen sign-off gates.

### §E.4 RECORD_ONLY vs planned

Lane A rows produced under the v1 RECORD_ONLY gate are **internal
artefacts**, not customer-visible product output. The RECORD_ONLY gate
opens (8 weeks + 500 medium-band reviews in `false_positive_review` +
2 weeks stability + no FP stop-the-line in trailing 14 days, per
`scoring/version.yml` notes + Architecture A0 §0). PR#3 does not
implement that gate either — PR#7 owns the queue, and the gate is a
*deployment policy*, not a code feature in PR#3.

Lane B rows are **dark-launched**: stored, tested, never customer-facing.

---

## §F Versioning

PR#3 has three version surfaces, all already pinned by PR#0 artefacts:

| Version | Current value | PR#3 obligation |
| --- | --- | --- |
| `scoring_version` | `s2.v1.0` (in `scoring/version.yml`) | Reserve a `TEXT NOT NULL` column on each lane output table; do not stamp it (scorer's job). |
| `reason_code_dictionary_version` | `rc-v0.1` (in `scoring/reason_code_dictionary.yml`) | No PR#3 column; dictionary is asserted at scorer startup (Hard Rule C). |
| `forbidden_codes_version` | `forbidden-v0.1` (in `scoring/forbidden_codes.yml`) | No PR#3 column; CI grep + scorer startup. |

PR#3 does NOT introduce a separate "contract version" beyond
`scoring_version`. The PR#3 contract document records the exact tuple
`(scoring_version=s2.v1.0, rc=rc-v0.1, forbidden=forbidden-v0.1)` as
the v1 baseline.

Relation to PR#2's `behavioural-features-v0.3`: independent. The
behavioural-features version stamps rows in
`session_behavioural_features_v0_2`. A future Lane A scorer will
*record* the input feature_version it consumed via the `evidence_refs`
JSONB shape (e.g. `{"table":"session_behavioural_features_v0_2","row":...,"feature_version":"behavioural-features-v0.3"}`) — but that is a row-level provenance entry, not a schema-level relationship.

---

## §G Reason-code policy (PR#3 conservative read)

### §G.1 What PR#3 may store (schema-level)

- A `reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb` column on each
  lane output table. Default `'[]'::jsonb`. Empty array means no codes
  emitted. The column is a *typed reservation*, not an emission.
- An `evidence_band TEXT` enum-constrained column (Lane A only).
- An `action_recommendation TEXT` enum-constrained column (Lane A only).
- A `verification_method_strength TEXT` column (Lane B only) — *reserved
  but never written by PR#3*; `forbidden_codes.yml` enforces no
  emission of `'strong'` value.

### §G.2 What PR#3 may NOT emit

- **No `A_*` reason code** is written by PR#3 code.
- **No `B_*` reason code** is written by PR#3 code.
- **No `REVIEW_*` reason code** is written by PR#3 code.
- **No `OBS_*` reason code** is written by PR#3 code.
- **No `UX_*` reason code** is written by PR#3 code (also forbidden in v1).
- No row is INSERTed into `scoring_output_lane_a` or
  `scoring_output_lane_b` by PR#3 code. Test fixtures may insert rows
  inside the test boundary `__test_ws_pr3__` — those test rows
  exercise schema invariants only, not emission semantics.

### §G.3 Default recommendation

**Conservative.** Schema reserves the JSONB column with a default of
`'[]'::jsonb`. The CHECK constraint `jsonb_typeof(reason_codes) =
'array'` enforces array-shape. **No `CHECK` on element values** — that
is the *scorer's* job at startup (Hard Rule C resolves against
`reason_code_dictionary.yml`). PR#3 does not duplicate the dictionary
in SQL.

If Helen disapproves storing `reason_codes` as JSONB at the schema level
(OD-4), the alternative is to defer the reason_codes column entirely
to PR#6 and have PR#3 reserve only `evidence_band` /
`action_recommendation`. The plan's recommendation is JSONB now, no
emission until PR#6.

---

## §H Non-scoring boundary

PR#3 must not introduce, in active code (comments / docs strings are
permitted to *describe* the negative boundary, the same way PR#1 / PR#2
documented theirs):

- `risk_score` / `buyer_score` / `intent_score` / `bot_score` / `human_score` / `fraud_score`
- bare `score` as a column or active identifier (the only allowed
  score-shaped identifier in PR#3 is the exact string
  `verification_score` — see §H.1 carve-out)
- `classification` / `recommended_action` (column name `action_recommendation` is permitted because A0 + signal-truth contract names it; `recommended_action` as a bare identifier is NOT permitted)
- `confidence_band` (Hard Rule A: `evidence_band` is the contract name; `confidence_band` is forbidden by `forbidden_codes.yml`)
- `is_bot` / `is_agent` / `ai_agent` / `is_human`
- `buyer_intent` / `lead_quality`
- `company_enrichment` / `ip_enrichment`
- Customer-facing emission, display, or routing of any Lane A / Lane B
  value.

PR#3 is enforced not to be a scorer by the simple rule that **PR#3 code
INSERTs no rows into the new tables.** All scorer responsibilities
(verification_score computation, evidence_band assignment, reason_code
emission, action_recommendation routing) live in PR#5 / PR#6 / future
PRs, each of which will have its own Helen-sign-off gate.

### §H.1 `verification_score` carve-out

`verification_score` is **allowed** in PR#3 active code, but **only**
because A0 §D step 7 + signal-truth-v0.1 §10 (Hard Rule A) name it as
the canonical scoring-output contract column for Lane A:

> Outputs: `verification_score` (0–99, internal), `evidence_band`
> (low|medium — never `high` in v1, type-system enforced …)
> (A0 §D step 7, verbatim.)

The carve-out is **narrow**:

- Allowed: the exact column name `verification_score` on
  `scoring_output_lane_a`, in `schema.sql`, in `migrations/011_*.sql`,
  in PR#3 test files (`tests/v1/scoring-output-contracts.test.ts`,
  `tests/v1/db/scoring-output-contracts.dbtest.ts`,
  `tests/v1/scoring-output-contracts.lint.test.ts`), and in PR#3 docs
  (this planning file and the future implementation doc).
- Allowed: `verification_score INT NOT NULL CHECK (verification_score
  BETWEEN 0 AND 99)` as a column definition.
- Forbidden anywhere outside that surface: generic `score`,
  `risk_score`, `buyer_score`, `bot_score`, `human_score`,
  `intent_score`, `fraud_score`, and any other score-shaped identifier.
- Forbidden: any code in PR#3 that *computes* or *assigns* a
  `verification_score` value. PR#3 reserves the column; the scorer
  (PR#6) writes the value.

**Forbidden-term sweep contract (test obligation).** The pure
forbidden-term sweep MUST:

1. Allow exactly the substring `verification_score` only inside the
   PR#3 lane-output surface listed above (a narrow file allowlist).
2. Block `verification_score` everywhere else in the repo (defence
   against accidental copy of the column name into the collector / app /
   server / auth path).
3. Continue to block every other score-shaped identifier in the bullet
   list above, in every file.

This is an additive rule on top of the `scoring/forbidden_codes.yml`
`.patterns` sweeps already used by PR#1 / PR#2 tests.

---

## §I Test plan

### §I.1 Pure tests

`tests/v1/scoring-output-contracts.test.ts` (new):

- Migration `011_scoring_output_lanes.sql` (proposed naming OD-3):
  - Exists; `CREATE TABLE IF NOT EXISTS` for both tables.
  - Natural-key UNIQUE constraint per lane (proposed naming OD-2):
    `(workspace_id, site_id, session_id, scoring_version)` — see §E for shape.
  - Enum CHECK on `evidence_band IN ('low','medium')` (Hard Rule A).
  - Enum CHECK on `action_recommendation IN ('record_only','review')` with `DEFAULT 'record_only'` (Hard Rule B).
  - Enum CHECK on `verification_method IN ('reverse_dns','ip_validation','web_bot_auth','partner_allowlist','none')` (Lane B).
  - JSONB shape CHECK on `reason_codes` (`jsonb_typeof(reason_codes) = 'array'`).
  - Postgres role grants/revokes:
    - GRANT SELECT on `scoring_output_lane_a` to internal role.
    - REVOKE SELECT on `scoring_output_lane_b` from customer-facing role.
  - Rollback uses `DROP TABLE IF EXISTS` only — no CASCADE.
- `schema.sql` mirrors both tables in idempotent `CREATE TABLE IF NOT EXISTS` form.
- Forbidden-term sweep using `scoring/forbidden_codes.yml` `.patterns` shape (post-CF-2): both new tables' SQL, comments stripped, contain no forbidden identifier.
- `verification_score` carve-out test (per §H.1): the exact substring
  `verification_score` is allowed only inside the PR#3 lane-output file
  allowlist (`migrations/011_*.sql`, `src/db/schema.sql` PR#3 block,
  `tests/v1/scoring-output-contracts*.ts`, `tests/v1/db/scoring-output-contracts*.dbtest.ts`,
  and PR#3 docs). It MUST NOT appear in `src/collector/v1/**`,
  `src/app.ts`, `src/server.ts`, `src/auth/**`, `scripts/**`, or any
  other source path.
- Generic score-shaped identifiers (`risk_score`, `buyer_score`,
  `bot_score`, `human_score`, `intent_score`, `fraud_score`, bare
  `score` as an active identifier) remain blocked everywhere including
  the PR#3 surface.
- Migration 011 no-CREATE-ROLE guard (per OD-8): pure test asserts
  migration 011 contains no `CREATE ROLE`, no `ALTER ROLE … SUPERUSER`,
  no `ALTER ROLE … BYPASSRLS`, no `ALTER ROLE … WITH PASSWORD`, no
  `ALTER ROLE … CREATEROLE`, no `ALTER ROLE … CREATEDB`.
- Migration 011 BLOCKER-guard presence test: migration 011 contains at
  least one `pg_roles WHERE rolname =` presence check inside a
  `DO $$ … RAISE EXCEPTION … END $$` block (per OD-8).
- `reason_code_dictionary.yml` shape sanity: every key resolves to a
  recognised v1 namespace prefix (`A_`, `B_`, `REVIEW_`, `OBS_`). No
  emission test here — PR#3 emits nothing.
- No imports from `src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`.
- No imports from `ams-qa-behaviour-tests` or `keigentechnologies/AMS`.

#### §I.1.a "No PR#3 writer" sweep (additive, hard test)

Beyond the forbidden-term sweep, a dedicated pure test must assert
**PR#3 ships no writer**:

- Repo-wide grep MUST return zero hits for the active patterns
  `INSERT INTO scoring_output_lane_a` and
  `INSERT INTO scoring_output_lane_b`, scoped to:
  - `migrations/**` — strictly forbidden (migration 011 may only
    `CREATE TABLE` / `GRANT` / `REVOKE` / `CREATE INDEX` / `ALTER TABLE`;
    no DML).
  - `src/**` — strictly forbidden.
  - `scripts/**` — strictly forbidden.
  - `docs/**` — comments-only; the substring may appear inside a SQL
    code fence in a Markdown explainer (e.g. "future scorers will
    `INSERT INTO scoring_output_lane_a` …"), but never as executable
    code. Implementation guard: this test allowlists `docs/**`.
- Test files (`tests/**/*.test.ts`, `tests/**/*.dbtest.ts`, fixtures
  under `tests/fixtures/**`) ARE allowed to contain the INSERT
  patterns, scoped to the test boundary `__test_ws_pr3__` (see §J.3).
- The sweep MUST also confirm migration 011 contains NO `INSERT INTO`
  statement targeting ANY table (defence against the operator
  accidentally seeding a row at migration time).
- The sweep is wired into `npm test` so CI fails on any unintended
  writer code reaching the lane output tables.

This test is the single most important regression guard for the user's
hard boundary "no scoring algorithm / no reason-code emission" — it
ensures PR#3 stays a *pure schema + contract* PR.

### §I.2 DB tests

`tests/v1/db/scoring-output-contracts.dbtest.ts` (new), under
`TEST_DATABASE_URL`:

- Both tables exist after `bootstrapTestDb()` (which applies the new
  migration). Column types match schema.sql.
- Insert a Lane A test row inside `__test_ws_pr3__` with default
  `action_recommendation` → resolves to `'record_only'`.
- Insert with `evidence_band = 'high'` → REJECTED by CHECK constraint
  (Hard Rule A regression guard).
- Insert with `action_recommendation = 'exclude'` (or `'allow'` / `'block'` / `'deny'`) → REJECTED by CHECK constraint (Hard Rule B regression guard).
- Insert Lane B test row → succeeds.
- Customer-facing role (test fixture) attempting `SELECT … FROM
  scoring_output_lane_b` → permission denied (Hard Rule I regression
  guard). Requires the test harness to expose a second pg pool under
  the customer-facing role — a test-only helper, narrowly scoped
  (`tests/v1/db/_setup.ts` extension).
- Natural-key UNIQUE: second INSERT with identical
  `(workspace_id, site_id, session_id, scoring_version)` → REJECTED.
- Reason-codes JSONB shape: insert with `reason_codes = '{}'::jsonb`
  (object, not array) → REJECTED by CHECK.
- Source tables (`accepted_events`, `rejected_events`, `ingest_requests`,
  `session_features`, `session_behavioural_features_v0_2`) unchanged
  after PR#3 migration applied — counts equal before/after.
- Cross-workspace isolation: distinct rows for the same `(site_id, session_id, scoring_version)` under different `workspace_id`s.
- Idempotent migration rerun (apply 011 twice → no error).

### §I.3 CI SQL linter test (Hard Rule H)

`tests/v1/scoring-output-contracts.lint.test.ts` (new, pure):

- Sweep `**/*.sql` + relevant TS source files (configurable allowlist).
- Detect any query that JOINs `scoring_output_lane_a` to
  `scoring_output_lane_b` (in any order, with or without aliases, via
  explicit `JOIN` keyword or comma-cross-product).
- The linter must be **opt-in via npm script** (e.g. `npm run lint:sql:lane-isolation`) and **wired into `npm test`** so CI fails on a violation.
- Fixture: a positive-control SQL file under `tests/fixtures/` showing a
  forbidden JOIN → linter MUST flag it. A negative-control file showing
  only single-lane SELECTs → linter MUST NOT flag it.

### §I.4 No collector / app / server / auth changes

A pure-test sweep MUST verify these paths are untouched:

- `git diff origin/main -- src/collector/v1/ src/app.ts src/server.ts src/auth/` → empty (verified locally before commit; also assertable as a CI grep on the PR diff).
- No imports of `src/collector/v1/*`, `src/app.ts`, `src/server.ts`, `src/auth/*` from any PR#3 file.

### §I.5 Migration rollback test

DB test: apply migration 011, then apply the rollback block (DROP TABLE
IF EXISTS, no CASCADE) to a fresh test DB → both tables gone, no error,
no orphan grants left behind.

---

## §J Verification SQL plan

Two new read-only SQL files under `docs/sql/verification/`:

### §J.1 `docs/sql/verification/10_scoring_output_lane_a_invariants.sql`

- Presence guard: `to_regclass('public.scoring_output_lane_a')`.
- Column-set guard: `information_schema.columns` returns the expected
  Lane A column list.
- Hard Rule A regression: no row with `evidence_band` outside `{low, medium}`.
- Hard Rule B regression: no row with `action_recommendation` outside `{record_only, review}`.
- JSONB shape: every row has `jsonb_typeof(reason_codes) = 'array'`.
- No `reason_code` token name as a column on the table (the column is
  `reason_codes` — plural — to make grep policy clean).
- Postgres role grants: customer-facing role has SELECT (or restricted
  SELECT via a redacted view, per OD-7).
- No CASCADE in any rollback path.

### §J.2 `docs/sql/verification/11_scoring_output_lane_b_invariants.sql`

- Presence guard: `to_regclass('public.scoring_output_lane_b')`.
- Column-set guard.
- Enum guard on `verification_method`.
- `verification_method_strength` column EXISTS but **every row has it
  as NULL** (reserved-not-emitted, signal-truth §11).
- Hard Rule I regression: customer-facing role has **zero** SELECT on
  `scoring_output_lane_b` —
  `has_table_privilege('<customer_facing_role>', 'scoring_output_lane_b', 'SELECT')` returns `FALSE`.
- JSONB shape for `reason_codes`.
- No CASCADE in any rollback path.

Both files mirror the pattern from
`docs/sql/verification/08_behavioural_features_invariants.sql` and
`docs/sql/verification/09_refresh_loop_invariants.sql` (PR#1 / PR#2).

No row is required to exist for these queries to PASS. Anomaly rows
must all be 0.

### §J.3 Empty-table verification semantics (explicit)

Because PR#3 ships **no writer**, the lane output tables will be empty
on every freshly migrated environment until a future PR (PR#5 / PR#6 /
the deferred router-observer follow-on per OD-1) introduces inserts.
The verification SQL contract MUST reflect that:

- **Empty-DB PASS.** Verification SQL 10 + 11 MUST pass on an empty
  freshly migrated staging DB. Presence guards return `regclass` (table
  exists). Column-set guards return the expected column list. All
  anomaly counts are 0 trivially. Hard Rule I role check
  (`has_table_privilege('<customer_facing_role>', 'scoring_output_lane_b', 'SELECT')`)
  evaluates `FALSE` regardless of row count.
- **DB tests insert under the test boundary only.** DB tests
  (`tests/v1/db/scoring-output-contracts.dbtest.ts`) may insert rows
  only inside the test boundary `__test_ws_pr3__`. The `beforeEach`
  cleanup mirrors the PR#1 / PR#2 boundary discipline:
  `DELETE FROM scoring_output_lane_a WHERE workspace_id = '__test_ws_pr3__'`,
  same for Lane B.
- **Hetzner staging proof must NOT require lane-output rows to exist.**
  PR#3 has no writer, so a staging proof that demanded row counts would
  necessarily mean either (a) a manual SQL insertion (forbidden — PR#3
  ships no writer code) or (b) executing a later-PR scorer ahead of
  its own sign-off (forbidden — leaks a future PR's scope into PR#3's
  staging proof).
- **Staging proof scope (PR#3-specific).** Apply migration 011 to
  Hetzner staging only (P-4 still blocking on Render production); run
  verification SQL 10 + 11 to completion; confirm anomaly counts are 0
  on the empty tables; confirm `has_table_privilege` on Lane B for
  the customer-facing role evaluates `FALSE`; confirm source tables
  (`accepted_events`, `rejected_events`, `ingest_requests`,
  `session_features`, `session_behavioural_features_v0_2`) row counts
  unchanged; confirm `observe:collector` still PASS.

---

## §K Rollback plan

PR#3 migration 011 is purely additive (two new tables, two new grants,
no existing table altered). Rollback:

```sql
-- Rollback order: revoke grants first, then drop tables. No CASCADE.
REVOKE ALL ON scoring_output_lane_a FROM <internal_role>;
REVOKE ALL ON scoring_output_lane_b FROM <internal_role>;
DROP TABLE IF EXISTS scoring_output_lane_a;
DROP TABLE IF EXISTS scoring_output_lane_b;
```

PR#3 does not modify any existing table. PR#3 does not write rows.
Therefore rollback is data-loss-free: pre-PR#3 state is the same as
post-rollback state. Render production is never touched by PR#3 (per
A0 P-4 still blocking); rollback applies only to Hetzner staging.

---

## §L Open decisions for Helen (OD-1..OD-8)

The plan above assumes the conservative interpretation. Helen overrides
any of these decisions before implementation begins.

### OD-1 — Scope split: schema-only PR#3 vs schema + router + observer

**Recommendation:** schema-only PR#3 (per A0 §K row literal scope).
Defer router (A0 §D 6) and Lane B observer (A0 §D 8) to a separately
gated follow-on PR.

**Why:** the user's current brief forbids reason-code emission, and the
§D 8 Lane B observer emits `B_DECLARED_AI_CRAWLER` / `B_SIGNED_AGENT`.
Bundling those into PR#3 would either (a) violate the user's brief, or
(b) require the user to relax the brief mid-flight. Splitting them out
is cleaner reviewable units and gives Helen a separate sign-off
opportunity for the emission code.

**Helen choice:** schema-only / schema + router / schema + observer / all three.

### OD-2 — Natural key for each lane output table

**Recommendation:** `(workspace_id, site_id, session_id, scoring_version)`.

**Why:** mirrors PR#1 / PR#2's natural-key pattern
(`(workspace_id, site_id, session_id, feature_version)`) and makes
`ON CONFLICT … DO UPDATE` idempotent re-extraction available to the
future scorer worker.

**Alternative:** `(workspace_id, site_id, session_id, scoring_version, knob_version_id)` — adds knob version to the key. Defer unless P-8 (scorecard + shadow challenger) resurfaces.

**Helen choice:** confirm / add knob_version_id / different shape.

### OD-3 — Migration file number

**Recommendation:** `migrations/011_scoring_output_lanes.sql`.

**Why:** continues the additive numbering after PR#2's `010_session_behavioural_features_v0_2_refresh_loop.sql`.

**Helen choice:** confirm or specify alternative.

### OD-4 — `reason_codes` storage shape

**Recommendation:** JSONB array with `CHECK (jsonb_typeof(reason_codes) = 'array')`. Default `'[]'::jsonb`. No element-level CHECK; dictionary validation is the scorer's job (Hard Rule C).

**Alternatives:**
- (a) `TEXT[]` instead of JSONB array.
- (b) Defer the column entirely to PR#6.
- (c) Add a startup trigger that validates element-level keys against `reason_code_dictionary.yml` (extra failure surface; not recommended).

**Helen choice:** JSONB array (default) / TEXT[] / defer / trigger.

### OD-5 — Naming for the deferred follow-on PR (if OD-1 = schema-only)

**Recommendation:** `Sprint 2 PR#3.b` (or rename **schema** PR to PR#3a + **router/observer** PR to PR#3b for symmetry). Need not be sequential with PR#4 if Helen wants router + observer to ship before reason-code dictionary loader.

**Helen choice:** PR#3a / PR#3b naming OR slot the follow-on at PR#4.5 OR after PR#7.

### OD-6 — `verification_method_strength` schema treatment

**Recommendation:** reserve the column on Lane B with TEXT type, NULL allowed, no DEFAULT. Verification SQL asserts every row has it NULL in v1.

**Alternative:** omit the column entirely in PR#3 and re-add when Sprint 3+ enables `verification_method_strength = 'strong'` emission (signal-truth §12.4).

**Helen choice:** reserve / omit.

### OD-7 — Lane A customer-facing access shape

**Recommendation:** keep customer-facing API role with zero direct SELECT
on `scoring_output_lane_a`; expose a redacted view
`vw_scoring_output_lane_a_redacted` later. PR#3 ships only the raw
tables and the role grant denying customer-facing direct access. The
view is a separate concern.

**Alternative:** ship the view in PR#3 too. (Increases scope; not
recommended.)

**Helen choice:** ship view in PR#3 / defer view to a later PR.

### OD-8 — Postgres role names + role-enforcement mode

**Recommendation:** PR#3 implementation must **discover and confirm
existing DB role names against the Hetzner staging DB before any
migration is written**. The migration MUST NOT `CREATE ROLE`. It may
only `GRANT` / `REVOKE` against roles that are explicitly confirmed to
exist.

**PUBLIC-revocation is NOT sufficient for Hard Rule I.** A migration
that only does `REVOKE SELECT … FROM PUBLIC` does **not** prove the
customer-facing API role has zero SELECT on `scoring_output_lane_b`.
The customer-facing role can still hold SELECT if it:

- owns the table (owners always have full privileges),
- has received an explicit `GRANT SELECT … TO <role>` from a prior or
  later migration,
- inherits SELECT via role membership (Postgres `INHERIT` semantics), or
- is the *same operational role* used by writers (e.g. if
  `buyerrecon_app` is both the writer and the customer-facing reader).

`PUBLIC` is the implicit-everyone pseudo-role; revoking from it is
already the no-op default on a freshly created user table. PUBLIC
revocation may be **defence-in-depth only** — never the primary
role-isolation proof. The primary proof is a named-role assertion via
`has_table_privilege('<customer_facing_role>', 'scoring_output_lane_b', 'SELECT') = FALSE`, which requires the customer-facing role to be a confirmed
named role — not PUBLIC.

**Observed baseline (Hetzner staging).** The current DB user on the
Hetzner staging environment is `buyerrecon_app`. Whether this role is
the *customer-facing API role* (the one Hard Rule I says must have zero
SELECT on `scoring_output_lane_b`) or an *internal scorer / extractor
role* is **not yet confirmed**. PR#3 implementation must answer this
before migration 011 is drafted.

**Preflight requirement.** Before applying migration 011 on any
environment:

1. Operator runs a read-only role-discovery probe on the target DB:
   ```sql
   SELECT rolname, rolsuper, rolcanlogin, rolbypassrls
     FROM pg_roles
    WHERE rolname NOT LIKE 'pg_%'
    ORDER BY rolname;
   ```
2. The output is recorded in the implementation PR's staging proof
   doc.
3. Each expected role used by the migration's `GRANT` / `REVOKE`
   statements is verified present. If a role is missing, **the
   migration MUST stop with a clear BLOCKER** rather than silently
   creating one or silently no-oping.

**Implementation-side guards (additive, testable in pure tests).**

- A pre-migration sanity SQL snippet inside `migrations/011_*.sql` that
  uses a `DO $$ … RAISE EXCEPTION … END $$` block to abort if any
  expected role is missing:
  ```sql
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '<customer_facing_role>') THEN
      RAISE EXCEPTION 'BLOCKER: customer-facing role <customer_facing_role> not found; PR#3 migration aborted (per OD-8).';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '<internal_role>') THEN
      RAISE EXCEPTION 'BLOCKER: internal role <internal_role> not found; PR#3 migration aborted (per OD-8).';
    END IF;
  END $$;
  ```
  The exact role names are filled in **after** OD-8 is resolved against
  the live Hetzner role list — they are not pre-baked into this planning
  doc because the discovery output may rename them.
- Pure tests assert migration 011 contains **no** `CREATE ROLE`
  statement and **no** `ALTER ROLE … SUPERUSER` / `… BYPASSRLS` /
  `… WITH PASSWORD` / `… CREATEROLE` / `… CREATEDB` statement.
- Pure tests assert migration 011 contains at least one
  `pg_roles WHERE rolname =` presence check (the BLOCKER guard above).

**Helen choices:**

- (a) Confirm `buyerrecon_app` is the customer-facing role; PR#3
  migration will REVOKE on `scoring_output_lane_b` from it and the
  internal scorer role gets a separate dedicated name (e.g.
  `buyerrecon_scorer` — pending Helen sign-off and operator role
  creation **outside** migration 011).
- (b) Confirm `buyerrecon_app` is the internal scorer/extractor role
  (because it owns writes to `accepted_events`,
  `session_behavioural_features_v0_2`, etc.); a separate
  customer-facing API role must be created (outside migration 011)
  before PR#3 can enforce Hard Rule I.
- (c) Both roles already exist under names the operator will provide
  during the implementation phase; PR#3 migration grants/revokes
  reference them by their confirmed names.
- ~~(d) Defer role separation entirely to a Sprint 2.5 task; PR#3
  migration only `REVOKE SELECT … FROM PUBLIC` for `scoring_output_lane_b`
  and `GRANT SELECT … TO PUBLIC` is **never** issued for it. Hard Rule
  I is enforced via PUBLIC revocation as an interim state until a
  dedicated customer-facing role lands.~~
  **Not PR#3 compliant / blocks implementation.** Removed as an
  acceptable path per Codex re-review: PUBLIC revocation does not
  satisfy Hard Rule I because the customer-facing role may own the
  table, receive explicit grants, inherit privileges via role
  membership, or be the same operational role used by writers — none of
  which PUBLIC revocation prevents. PR#3 cannot ship without named-role
  enforcement. If Helen wishes to defer role separation, the correct
  path is to do so **outside PR#3** (e.g. as a Sprint 2.5 prerequisite
  task that creates the named roles), and PR#3 implementation waits
  until that task completes.

**Constraint binding all valid choices (a)–(c):**

- Migration 011 is forbidden from issuing `CREATE ROLE` under any of
  the three valid choices.
- PR#3 implementation may **not** begin until OD-8 yields (a), (b), or
  (c) **with the named role(s) explicitly confirmed to exist on the
  target DB**. The pre-migration `DO $$ … RAISE EXCEPTION … END $$`
  BLOCKER guard then has real role names to check.
- The Hard Rule I regression check in verification SQL 11
  (`has_table_privilege('<customer_facing_role>', 'scoring_output_lane_b', 'SELECT') = FALSE`) requires a named role to evaluate against. Under any path that fails to
  produce a confirmed customer-facing role name, the check is
  un-runnable and Hard Rule I is un-provable — therefore PR#3 cannot
  ship.
- PUBLIC revocation (`REVOKE SELECT … FROM PUBLIC`) may be added as
  **defence-in-depth only**, never as the primary role-isolation
  proof.

---

## §M Implementation file inventory (for the future PR, NOT this round)

This planning doc itself ships only one file. The implementation PR
(once Helen signs off OD-1..OD-8, including confirmed Postgres role
names / enforcement mode under OD-8) would ship roughly:

| File | New / modified | Notes |
| --- | --- | --- |
| `migrations/011_scoring_output_lanes.sql` | new | Two CREATE TABLE statements + grants + CHECK constraints. |
| `src/db/schema.sql` | modified | Mirrors both tables in idempotent form (append-only). |
| `scoring/contracts/scoring-output-lanes-v1.md` | new (or `docs/contracts/`) | Plain-prose contract document referencing this plan + Hard Rules. |
| `tests/v1/scoring-output-contracts.test.ts` | new | Pure tests per §I.1. |
| `tests/v1/db/scoring-output-contracts.dbtest.ts` | new | DB tests per §I.2. |
| `tests/v1/scoring-output-contracts.lint.test.ts` | new | CI SQL linter for Hard Rule H per §I.3. |
| `tests/v1/db/_setup.ts` | modified | Apply migration 011 in bootstrap (additive, idempotent). Add narrowly-scoped customer-facing-role pool helper for Hard Rule I test. |
| `docs/sql/verification/10_scoring_output_lane_a_invariants.sql` | new | Per §J.1. |
| `docs/sql/verification/11_scoring_output_lane_b_invariants.sql` | new | Per §J.2. |
| `docs/sprint2-pr3-scoring-output-contracts.md` | new | Implementation summary (parallel to PR#1 / PR#2 docs). |

Files **not** touched:

- `src/collector/v1/**` (entire directory)
- `src/app.ts`, `src/server.ts`
- `src/auth/**`
- `scripts/extract-behavioural-features.ts` (PR#1 + PR#2 — referenced read-only)
- `migrations/009_*` and `migrations/010_*` (PR#1 + PR#2 — referenced read-only)
- Anything under `frontend/` / GTM / GA4 / LinkedIn / ThinSDK paths
- `scoring/version.yml` (PR#3 reads the values; does not bump them)
- `scoring/reason_code_dictionary.yml`
- `scoring/forbidden_codes.yml`
- `docs/architecture/ARCHITECTURE_GATE_A0.md`
- `docs/contracts/signal-truth-v0.1.md`

---

## §N Go / no-go recommendation

### §N.1 Planning-only recommendation

**Recommended posture for THIS round:** ship this planning document
only. No code. No migration. No schema.sql change. No extractor change.
No DB touch. Helen reviews this doc, signs off OD-1..OD-8 (including
confirmed Postgres role names / enforcement mode under OD-8), and then
implementation follows under a separate Codex review gate.

### §N.2 Implementation gate

**Implementation blocked until Helen signs OD-1..OD-8, including
confirmed Postgres role names / enforcement mode under OD-8.**

Concretely, implementation of PR#3 is blocked until all of the
following hold:

1. Helen written sign-off on this planning document (matching the
   pattern used for PR#1 + PR#2 planning).
2. Helen explicit answer on **OD-1** (scope split), **OD-4**
   (reason_codes shape), and **OD-8** (Postgres role names + enforcement
   mode) at minimum. OD-8 must yield (a), (b), or (c) — option (d) was
   removed as non-compliant per Codex re-review. The remaining ODs
   (OD-2, OD-3, OD-5, OD-6, OD-7) may be confirmed-as-recommended
   without explicit revision.
3. Operator role-discovery probe (per OD-8 preflight) has been run on
   the target DB and the confirmed customer-facing + internal role
   names are recorded in the implementation PR's staging proof doc.
4. Codex review of THIS planning document → PASS.
5. P-1, P-2, P-7 (A0 §0.6) explicitly resolved per A0's recommended
   defaults (or Helen overrides). A0 already records them as blocking.

After all five hold:

1. A new branch from `sprint2-architecture-contracts-d4cc2bf` HEAD
   (currently `3d8817701e509ec83b143d08ea40e7c26f0cbff6`).
2. Implementation PR shipped under the §M file inventory.
3. Codex review of the implementation PR → PASS.
4. Hetzner staging proof (apply migration 011 on staging only, verify
   role grants, run verification SQL 10 + 11, run CI SQL linter
   against the staging working tree, confirm source tables unchanged).
5. No Render production exposure (A0 P-4 still blocking).

### §N.3 Out-of-scope reminder (the user's hard boundaries)

- No Render production
- No production DB
- No frontend / GTM / GA4 / LinkedIn / ThinSDK
- No collector deploy
- No live website collection
- No scoring algorithm
- No reason-code emission
- No Lane A / B writer code
- No Stage 0 / Stage 1 worker
- No AI-agent / crawler taxonomy
- No customer-facing dashboard / report
- PR#1 / PR#2 / PR#0 files untouched except as read-only references
