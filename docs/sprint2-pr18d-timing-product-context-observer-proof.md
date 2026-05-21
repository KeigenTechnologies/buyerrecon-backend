# BuyerRecon PR#18d — Timing / Product-Context Observer Staging Proof

Status: **observer executed read-only on the Hetzner staging host. Verdict: PASS_WITH_WARNINGS — the new PR#18c observer ran cleanly against staging, produced a structured report, and surfaced one carry-forward warning (`risk_observations_v0_1` optional count-query failure). Staging read-only observer proof only. Not customer output. Not Pass 1. Not Trust. Not Pass 2. Not Lane writer. Not Gate 4.**

PR#18d is the staging proof step in the post-Gate-3 chain defined by PR#18a → PR#18b → PR#18c. The PR#18c read-only Timing / Product-Context observer (merged as PR #35, merge commit `3b23d36`) was executed by Helen-as-operator on the Hetzner staging host under explicit Helen GO. This document records the categorical execution evidence and locks the carry-forward decision for the next step in the chain (PR#18e Pass 1 output contract planning — **planning only, not runtime**).

PR#18d is a **proof record only**. It introduces no implementation. It does not enable any customer surface, does not write any Lane A/B row, does not invoke AMS Pass 1 / Pass 2 / Trust runtime, does not modify the AMS repository, does not change schema / migrations / production config / `/var/www` / `endpointUrl`, and does not touch any production endpoint. Each subsequent PR (PR#18e → PR#18g and any Gate 4 PR thereafter) requires its own explicit Helen GO, scoped to that PR's content alone.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18d.**
> **No production traffic is approved by PR#18d.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18d; no production artefact / config mode flip is approved by PR#18d.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime is approved by PR#18d.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18d.**
> **PR#18d advances the PR#18a §13 chain by exactly one step (PR#18c proof). It does NOT pre-authorise PR#18e (Pass 1 output contract planning); PR#18e requires its own separate Helen GO.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest at run: `3b23d36f7a1baae168d237cb7547133001cd4860` — "Sprint 2 PR#18c: fix timing observer optional counts (#35)").

PR branch: `buyerrecon-sprint2-pr18d-timing-product-context-observer-proof`

Mandatory reference compliance:

- `docs/sprint2-pr18c-timing-product-context-observer.md` — the observer's contract; PR#18d records its first staging run.
- `docs/sprint2-pr18b-timing-product-context-refresh-planning.md` — the §3 source set, §6 synthetic-fixture exclusion rule, §7 timing band + confidence cap policy carried forward.
- `docs/sprint2-pr18a-post-gate3-scoring-output-chain-planning.md` — the strategic chain; PR#18d is the proof step preceding PR#18e (Pass 1 planning).
- `docs/sprint2-pr17z-gate3-execution-proof.md` — Gate 3 PASS; the proof rows whose presence in staging this observer correctly excludes from commercial evaluation.

---

## 1. Status / verdict

**PASS_WITH_WARNINGS — staging read-only observer proof. Not customer output, not Pass 1, not Trust, not Pass 2, not Lane writer, not Gate 4.**

- The observer executed read-only on the Hetzner staging host under explicit Helen GO and exited with code `0`.
- All required source tables were present; the observer correctly walked the full source set defined by PR#18b §3.
- All four Gate 3 fixture rows + the pre-existing Gate 2 / Gate-N proof rows in the bound (`buyerrecon_staging_ws`, `buyerrecon_com`) pair were categorically excluded from commercial candidate evaluation; **no synthetic / control-traffic row was deleted** (the observer's `proof_rows_preserved: yes` guarantee held).
- The candidate set is empty after exclusion (`candidate_count: 0`) because, today, every in-window row at the staging proof boundary is a Gate-N proof row. The observer surfaced this categorically as the anomaly `synthetic_exclusion_filter_empty / info`. **This is the expected outcome at the staging proof boundary** and is not negative commercial evidence — it is the observer's exclusion machinery working as designed (PR#18b §3.1 carry-forward note).
- One **warning** surfaced and is carried forward: `optional_source_count_query_failed / warn / public.risk_observations_v0_1`. The table is present (`source_tables_present.risk_observations_v0_1: yes`) but the count query under the staging DB role failed. This is exactly the failure mode the PR#18c blocker patch (test M.2 in `tests/v1/timing-product-context-observer.test.ts`) was designed to surface categorically rather than swallow as a silent zero. **The cause must be investigated before any Pass 1 contract relies on risk-observation evidence.**
- No raw token / `token_hash` / pepper / DSN / Authorization header / `request_id` UUID value / raw payload / raw response body / full session_id appeared in the observer's report or anywhere in this proof record. The DSN was loaded into `DATABASE_URL` from `/opt/buyerrecon-backend/.env` without being printed; the observer's report masks the DSN to host + db name only.

---

## 2. Execution context

| Item | Value |
|---|---|
| Execution context | Helen-as-operator on Hetzner staging host (`/opt/buyerrecon-backend`); Claude Code did not run any `curl` / `psql` / SSH / fixture POST / token-provisioning command during execution. |
| Base branch HEAD at run | `3b23d36f7a1baae168d237cb7547133001cd4860` (= PR#18c merge — "Sprint 2 PR#18c: fix timing observer optional counts (#35)") |
| PR branch | `buyerrecon-sprint2-pr18d-timing-product-context-observer-proof` |
| Run host category | **Hetzner staging** (read-only DB role) |
| Command category | `npm run observe:timing-product-context` → `tsx scripts/timing-product-context-observation-report.ts` |
| Observer artefacts confirmed pre-run | `src/scoring/timing-product-context-observer/`: present · CLI script: present · npm script: present |
| `DATABASE_URL` | **PRESENT** (staging-class, never printed; loaded from `/opt/buyerrecon-backend/.env`) |
| `OBS_WORKSPACE_ID` | `buyerrecon_staging_ws` |
| `OBS_SITE_ID` | `buyerrecon_com` |
| `OBS_WINDOW_HOURS` | `720` (= 30 days; CLI default) |
| `OBS_REQUIRE_TIMING_PRODUCT_CONTEXT` | default (`false`) — optional-source-missing anomalies stay at `info` severity |
| `observer_exit_code` | **0** (per the CLI exit-code contract: `0` on PASS / PASS_WITH_WARNINGS, `2` on BLOCKED / connection / env error) |
| `report_lines` | **114** |
| `report_bytes` | **3,623** |
| Output file (on operator host) | `/tmp/pr18d-observer-report.md`, mode `600`, captured for categorical inspection only |

---

## 3. Observer output summary

### 3.1 Source tables present

All nine sources reachable under the staging DB role. No source was missing.

| Table | Present |
|---|---|
| `public.accepted_events` | **yes** (required) |
| `public.ingest_requests` | **yes** (required) |
| `public.rejected_events` | **yes** (required) |
| `public.session_features` | **yes** (optional) |
| `public.session_behavioural_features_v0_2` | **yes** (optional) |
| `public.poi_observations_v0_1` | **yes** (optional) |
| `public.poi_sequence_observations_v0_1` | **yes** (optional) |
| `public.risk_observations_v0_1` | **yes** (optional; count query subsequently failed — see §3.4 / §8) |
| `public.site_write_tokens` | **yes** (label-column only) |

### 3.2 Source counts (window-bounded; bound to `buyerrecon_staging_ws` / `buyerrecon_com`)

| Source | In-window count |
|---|---|
| `accepted_events` | **19** |
| `ingest_requests` | **21** |
| `rejected_events` | **1** |
| `session_features` | **8** |
| `session_behavioural_features_v0_2` | **16** |
| `poi_observations_v0_1` | **8** |
| `poi_sequence_observations_v0_1` | **8** |
| `risk_observations_v0_1` | **0** (count query failed; see §3.4 / §8 — value `0` is the helper's default-on-failure, not a confirmed empty source) |

### 3.3 Timing band distribution

All bands at zero. The candidate set is empty after synthetic-fixture exclusion (see §4); no per-session candidate was produced, so no band carries a count.

| Band | Count |
|---|---|
| `hot_now` | 0 |
| `warm_recent` | 0 |
| `cooling` | 0 |
| `stale` | 0 |
| `dormant` | 0 |
| `insufficient_evidence` | 0 |

### 3.4 Per-session product-context candidate counts

| Field | Value |
|---|---|
| `candidate_count` | **0** |
| `pass_forward_to_pass1_count` | **0** |
| Full `session_id` surfaced in any candidate row | **no** (no candidate rows exist; observer's `truncateSessionId` would have applied regardless) |
| `request_id` UUID surfaced | **no** |
| Raw payload surfaced | **no** |

Confidence cap distribution: not applicable — `candidate_count = 0`.

### 3.5 Anomalies

| Kind | Severity | Detail |
|---|---|---|
| `optional_source_count_query_failed` | **warn** | `public.risk_observations_v0_1` |
| `synthetic_exclusion_filter_empty` | **info** | all in-window required-source rows were excluded as synthetic / control traffic |

### 3.6 Final status

**`PASS_WITH_WARNINGS`** — derived per the observer's `deriveFinalStatus()` contract (any `warn` severity downgrades `PASS` → `PASS_WITH_WARNINGS`; only `block` severity drives `BLOCKED`).

---

## 4. Synthetic / control-traffic exclusion (PR#18b §6 / PR#18c §4)

The observer's exclusion machinery worked as designed. Every in-window row of the three required sources was categorically identified as Gate-N proof traffic and excluded from commercial candidate evaluation. **No row was deleted** (`proof_rows_preserved: yes` is a categorical contract of the observer; PR#17x §11 / PR#17z §6 preserve-audit rules hold).

| Field | Value |
|---|---|
| `rule_version` | `synthetic-fixture-exclusion-v0.1` |
| `excluded_workspace_site_pair_matches` | **1** (the bound `(workspace_id = 'buyerrecon_staging_ws', site_id = 'buyerrecon_com')` pair IS the staging proof boundary) |
| `excluded_schema_key_namespace_matches` | **3** (rows with `schema_key LIKE 'buyerrecon.test.%'` — F1 `buyerrecon.test.page_view`, F2 `buyerrecon.test.cta_click`, F3 the F1-like body with omitted `event_name`; PR#17z fixture set) |
| `excluded_token_label_matches` | **2** (the `site_write_tokens.label` set `{pr17x_gate2_fixture, pr17z_gate3_fixture}` both present — `label` column only; never `token_hash` / `token_id` / `pepper` / DSN) |
| `excluded_accepted_events_rows` | **19** (= the full `accepted_events_in_window` count; all in-window accepted rows under this pair are Gate-N proof traffic) |
| `excluded_rejected_events_rows` | **1** (= the full `rejected_events_in_window` count; the F3 validation-stage reject row from Gate 3) |
| `excluded_ingest_requests_rows` | **21** (= the full `ingest_requests_in_window` count; all in-window ingest rows under this pair are Gate-N proof traffic) |
| `proof_rows_preserved` | **yes** (categorical contract — no row was deleted from any source) |

**Interpretation.** The observer correctly identified that today the staging proof boundary `(buyerrecon_staging_ws, buyerrecon_com)` contains *only* Gate-N proof traffic. The empty candidate set is the **expected** outcome at this boundary — not a regression, not a Lane A/B leak, not a sign that the observer mis-classified rows. The `synthetic_exclusion_filter_empty / info` anomaly in §3.5 is the categorical statement of this expected outcome.

The exclusion does NOT make any commercial inference. It removes proof rows from the candidate pool entirely; it does not move those sessions toward `dormant` (negative evidence) or toward any other band. Sessions that consist entirely of Gate-N rows simply do not appear in `product_context_candidates`.

---

## 5. Privacy / secret safety

The observer's report and this proof record contain only categorical fields. The following items were **never** surfaced in any artefact derived from PR#18d, in the observer report, in the captured `/tmp/pr18d-observer-report.md` file, in chat, in this document, in any commit message, or in any operator-visible output:

- No raw session_id (only `session_id_redacted` form `prefix(8)…suffix(4)`; in this proof, `candidate_count = 0` so no session id of any form appears).
- No `request_id` UUID value (the observer uses UUIDs internally for grouping; UUIDs never reach the report).
- No raw request body / fixture body / canonical_jsonb projection.
- No raw response body.
- No token / `token_hash` / token prefix / suffix / length value / `token_id`.
- No pepper / `SITE_WRITE_TOKEN_PEPPER` value.
- No DSN value (the report masks `DATABASE_URL` to host:port + db_name only; this proof carries no DSN at all).
- No Authorization header (constructed or otherwise).
- No private key, certificate body, env dump, vault content, shell-history extract.
- No full URL with query string.
- No customer-facing claim text (no "this lead is", "buyer-intent detected", "good bot", "AI agent detected", "invalid traffic confirmed" wording).

---

## 6. Boundary affirmations (carried forward from the observer report)

Reproduced verbatim from the observer's `boundary_affirmations` block — categorical guarantees the observer asserts on every run:

| Affirmation | Value |
|---|---|
| `read_only` | **yes** |
| `no_durable_table_created` | **yes** |
| `no_migration` | **yes** |
| `no_schema_change` | **yes** |
| `no_db_write` | **yes** |
| `no_customer_output` | **yes** |
| `no_lane_a_b_writer` | **yes** |
| `no_ams_runtime_bridge` | **yes** |
| `no_pass_1_runtime` | **yes** |
| `no_pass_2_runtime` | **yes** |
| `no_trust_runtime` | **yes** |
| `no_request_id_uuid_value_printed` | **yes** |
| `no_raw_payload_printed` | **yes** |
| `no_token_or_hash_or_pepper_or_dsn_printed` | **yes** |
| `confidence_cap_high_emitted` | **no** (observer never emits `high`; PR#18b §7.2 / PR#18c §5.2 policy) |
| `synthetic_proof_rows_preserved` | **yes** |

Additional categorical affirmations for PR#18d:

- No production endpoint contacted. No `curl` / browser visit / synthetic generator against `https://buyerrecon.com/v1/event` or `https://buyerrecon-backend.onrender.com/collect`.
- No production DB queried. The 26 production `ingest_requests` canary evidence rows from the post-PR#17q canary remain preserved.
- No `/var/www` edit. No `endpointUrl` re-flip. No website artefact change. No production config edit.
- No DB grant change. PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety untouched.
- No Nginx / systemctl / DNS change.
- No Track A invocation. No Playwright run. No customer-facing output. No Lane A/B writer. No AMS Trust runtime. No Pass 1 runtime. No Pass 2 runtime.
- No Timing / Product Context runtime decisioning (the observer is read-only and emits no decision).
- No knobs / dashboard implementation.
- No website ThinSDK production activation.
- No production artefact / config mode flip.
- No AMS repo modification. No AMS PR opened. No AMS runtime call.
- No Gate 4 work.

---

## 7. Pass-forward decision (PR#18e — Pass 1 output contract planning)

**Pass 1 planning may proceed** under the PR#18a §13 sequence. Pass 1 **execution / runtime / customer output must not proceed** until at least the §8 warning carry-forward (risk-observations count-query failure) is resolved.

### 7.1 What is safe to do now

- **PR#18e (Pass 1 output contract planning) — docs-only.** PR#18e may consume the categorical pass-forward shape defined in PR#18c §6 (the `ProductContextSessionCandidate` enums + the `pass_forward_to_pass1` flag) and lock OD-P1 → OD-P5 from PR#18a §6.3. Today's `pass_forward_to_pass1_count = 0` is acceptable input to a docs-only contract PR — the contract defines the *shape* of the pass-forward, not the volume.
- Each subsequent PR (PR#18e, PR#18f, PR#18g) remains separately gated by its own explicit Helen GO.

### 7.2 What must NOT proceed

- **Pass 1 runtime.** No `EvaluatePreTrust`-style runtime is invoked from BuyerRecon today; AMS owns Pass 1 runtime (per PR#18b §4.2 / PR#14a §3). PR#18d does not approve any Pass 1 runtime path.
- **Pass 2 runtime.** Same — AMS owns it.
- **Trust runtime.** Same — AMS owns it.
- **Customer-facing output.** No Pass 1 / Trust / Pass 2 surface exists; none enabled.
- **Lane A/B writer.** PR#17f / PR#17q grant safety stands.
- **Gate 4.** Paused per PR#18a §11; PR#18d does not change that.
- **Production `endpointUrl` re-flip; production traffic; website ThinSDK production activation; production artefact / config mode flip.** All non-approved.
- **Reliance on risk-observation evidence in Pass 1 planning** is not safe until §8's warning is investigated and either resolved or explicitly acknowledged as a Pass-1 scope-narrowing decision. See §8.

---

## 8. Warning carry-forward — `risk_observations_v0_1` optional count-query failure

The observer surfaced one `optional_source_count_query_failed / warn` anomaly with detail `public.risk_observations_v0_1`. This is exactly the failure mode the PR#18c blocker patch (test M.2 in `tests/v1/timing-product-context-observer.test.ts`) was designed to surface — instead of swallowing as a silent zero, the observer reports the failure categorically.

| Field | Value |
|---|---|
| Anomaly kind | `optional_source_count_query_failed` |
| Severity | `warn` |
| Detail | `public.risk_observations_v0_1` (table name only; no SQL error text; no DSN; no pg-driver exception message) |
| Table presence (separate probe) | **present** (`source_tables_present.risk_observations_v0_1: yes`) |
| Reported count in this run | `0` (default-on-failure from `countOptional`; **not** a confirmed empty source) |

### 8.1 Possible categorical causes (read-only inspection candidates for a follow-on PR)

The observer does NOT diagnose root cause (it deliberately discards the pg-driver exception to avoid leaking DSN / token / pepper / payload material). Categorical hypotheses for a separate read-only investigation PR:

- DB role privilege — the staging DB role under which the observer connected may lack `SELECT` on `public.risk_observations_v0_1`. Inspect grants via a separate operator read on `information_schema.role_table_grants` (read-only; no `GRANT` / `REVOKE`).
- Column-shape drift — the observer's count SQL filters on `derived_at >= $1 AND derived_at < $2`. If the deployed `risk_observations_v0_1` schema lacks `derived_at` (or uses a different timestamp column name), the query throws. Inspect via `information_schema.columns` (read-only).
- Other transient DB-side failure (connection drop mid-query, server-side timeout). Re-run reveals whether the failure is deterministic.

### 8.2 Carry-forward rule (for PR#18e Pass 1 planning)

- **Recorded as a warning** in PR#18d's audit chain.
- **Not blocking** for PR#18e docs-only Pass 1 contract planning.
- **Blocking** for any future Pass 1 / Trust / Pass 2 PR that would consume risk-observation evidence as a scoring input. Such a PR must cite either (a) the resolution of this warning (e.g., grant amendment under explicit Helen GO + a separate PR, OR a column-shape clarification under a separate read-only inspection PR), or (b) an explicit Helen-approved scope-narrowing decision that excludes risk-observation evidence from Pass 1's input set.

---

## 9. Cleanup evidence

The PR#18d operator command sequence included a cleanup block (`shred -u /tmp/pr18d-observer-report.md`; `unset DATABASE_URL OBS_WORKSPACE_ID OBS_SITE_ID OBS_WINDOW_HOURS`; categorical confirmation `echo` lines). Helen's cleanup confirmation lines are recorded below.

| Field | Value |
|---|---|
| `report_removed` | **yes** (the captured `/tmp/pr18d-observer-report.md` was shredded / removed) |
| `DATABASE_URL_unset` | **yes** (staging DSN unset from the operator shell) |
| `OBS_WORKSPACE_ID_unset` | **yes** |
| `OBS_SITE_ID_unset` | **yes** |
| `OBS_WINDOW_HOURS_unset` | **yes** |

The observer / CLI artefact itself was untouched on the host's filesystem (no DDL, no migration); the `/tmp/pr18d-observer-report.md` file was a transient runtime artefact and is now removed. The operator shell's env vars used for the observer run are no longer set.

No secrets / DSN / token / hash / pepper / Authorization header / `request_id` UUID / raw payload / raw response body / full session_id appeared in the operator output at any point — the observer's report-level redaction (already enforced by the merged PR#18c code) is independent of cleanup, and the cleanup itself removed the captured report file without printing or logging any of its content.

---

End of PR#18d. **Verdict: PASS_WITH_WARNINGS — the PR#18c read-only Timing / Product-Context observer ran cleanly on the Hetzner staging host (exit code `0`); all required source tables were present; Gate 2 / Gate 3 proof rows were categorically excluded from commercial candidate evaluation and preserved (not deleted); the empty post-exclusion candidate set is the expected outcome at the staging proof boundary today and is NOT negative commercial evidence; one warning is carried forward — `optional_source_count_query_failed / warn / public.risk_observations_v0_1` — which must be investigated before any Pass 1 / Trust / Pass 2 PR relies on risk-observation evidence. Pass 1 planning (PR#18e, docs-only) may proceed under its own separate Helen GO; Pass 1 runtime / Pass 2 runtime / Trust runtime / customer-facing output / Lane A/B writer / Gate 4 / production `endpointUrl` re-flip / production traffic / website ThinSDK production activation / production artefact / config mode flip are NOT approved by PR#18d. No DB writes, no migration, no schema change, no AMS repo modification, no AMS runtime call. No raw token / `token_hash` / token prefix / suffix / length value / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw payload / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this proof record.**
