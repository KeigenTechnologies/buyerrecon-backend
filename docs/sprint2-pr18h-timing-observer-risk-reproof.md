# BuyerRecon PR#18h — Timing / Product-Context Observer staging re-proof after risk-query fix

Status: **docs-only proof record. Verdict: PASS — the Timing / Product-Context observer ran cleanly on the Hetzner staging host under explicit Helen GO (`observer_exit_code: 0`); the previous PR#18d `optional_source_count_query_failed / warn / public.risk_observations_v0_1` warning is categorically CLOSED; `source_counts.risk_observations_v0_1_in_window` now reflects the real count `2` (no longer the default-on-failure `0`); the only remaining anomaly is the expected-by-design `synthetic_exclusion_filter_empty / info` at the staging proof boundary.**

PR#18h is the staging re-proof step that closes the source-health warning chain opened by PR#18d. After PR#18g (PR #39, merge `9b29afd`) replaced the observer's non-existent `derived_at` column reference with the canonical `created_at`, this run confirms categorically — against the live staging DB on Hetzner — that the corrected query succeeds, the previously-unreachable risk evidence is now reachable, and no other observer behaviour regressed.

PR#18h is a **proof record only**. It introduces no implementation, no code path, no schema change, no migration, no DB write, no grant change, no Lane A/B writer, no AMS runtime bridge, no Pass 1 / Pass 2 / Trust runtime, no Gate 4 work. It records the categorical observer evidence and explicitly recommends — but does **not** apply — a follow-up amendment to PR#18e's Pass 1 contract that would permit `risk_evidence_status` to transition from `'warning'` / effectively `'unavailable'` to `'usable_later'`. That contract amendment is a separately-gated future PR.

> **Gate 1, Gate 2 (PR #30), Gate 3 (PR #32) closed. Gate 4 is paused and not started.**
> **No production `endpointUrl` re-flip is approved by PR#18h.**
> **No production traffic is approved by PR#18h.**
> **No website ThinSDK activation of `sprint2_v1_event` mode is approved by PR#18h; no production artefact / config mode flip is approved by PR#18h.**
> **No Track A invocation, no Playwright run, no customer-facing output, no Lane A/B writer, no AMS Trust runtime, no Pass 1 runtime, no Pass 2 runtime is approved by PR#18h.**
> **No code / scripts / tests / package / migrations / schema.sql / env / systemd / Nginx / AMS source / website artefact / production config changes are introduced by PR#18h.**
> **PR#18h does NOT amend PR#18e's Pass 1 contract by itself. The `risk_evidence_status = 'usable_later'` transition requires a separately-gated future PR with its own Helen GO; PR#18h only records that the underlying source-health prerequisite for that amendment is now met.**

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest at run: `9b29afd52e9ddbcac144022139a197acdce73e5c` — "Sprint 2 PR#18g: fix risk observations timing query (#39)").

PR branch: `buyerrecon-sprint2-pr18h-timing-observer-risk-reproof`

Mandatory reference compliance:

- `docs/sprint2-pr18d-timing-product-context-observer-proof.md` — PR#18d §8 carry-forward warning that PR#18h now closes.
- `docs/sprint2-pr18f-risk-observations-source-health.md` — PR#18f source-health diagnosis (`BLOCKED / schema_mismatch`) that motivated PR#18g.
- `docs/sprint2-pr18g-risk-observations-created-at-fix.md` — PR#18g narrow code fix (`derived_at` → `created_at`) that PR#18h verifies on live staging.
- `docs/sprint2-pr18e-pass1-output-contract-planning.md` — §7 `risk_evidence_status` carry-forward; PR#18h informs the future amendment without applying it.
- `docs/sprint2-pr18c-timing-product-context-observer.md` — the observer's contract (unchanged by PR#18h).
- `docs/sprint2-pr18b-timing-product-context-refresh-planning.md` — the §3 source set, §6 synthetic-fixture exclusion rule, §7 timing band + confidence cap policy carried forward.

---

## 1. Status / verdict

**PASS — staging re-proof confirms PR#18g fix closed the risk source-health warning. Staging read-only observer proof only. Not customer output. Not Pass 1 runtime. Not Trust runtime. Not Pass 2 runtime. Not Lane writer. Not Gate 4.**

- Observer executed read-only on Hetzner staging under explicit Helen GO and exited with code `0` (per the CLI's `decideCliExitCode` contract: `0` on PASS / PASS_WITH_WARNINGS, `2` on BLOCKED / error).
- `final_status` reported by the observer: **`PASS`** — no `warn` and no `block`-severity anomalies. Only one categorical `info` anomaly (`synthetic_exclusion_filter_empty`) remains, which is the expected outcome at the staging proof boundary.
- The previously-recorded `optional_source_count_query_failed / warn / public.risk_observations_v0_1` anomaly from PR#18d is **categorically ABSENT** from the new observer report. PR#18g's narrow query fix (`derived_at` → `created_at`) closed the underlying schema-mismatch bug.
- `source_counts.risk_observations_v0_1_in_window` reports **`2`** — the real count for the staging proof boundary (matches PR#18f §4's source-health probe via the corrected `created_at` query). The number is no longer the `countOptional` helper's default-on-failure `0`; it is a confirmed, live read.
- All required source tables (`accepted_events`, `ingest_requests`, `rejected_events`) and all optional source tables (`session_features`, `session_behavioural_features_v0_2`, `poi_observations_v0_1`, `poi_sequence_observations_v0_1`, `risk_observations_v0_1`, `site_write_tokens`) are present and reachable under the staging DB role.
- Gate 2 / Gate 3 / Gate-N proof rows are still categorically excluded from commercial candidate evaluation and preserved (not deleted). `proof_rows_preserved: yes` is unchanged from PR#18d.
- The empty post-exclusion candidate set (`candidate_count: 0`, `pass_forward_to_pass1_count: 0`) is the expected outcome at the staging proof boundary (`buyerrecon_staging_ws` / `buyerrecon_com`) — all in-window rows are still Gate-N synthetic. This is orthogonal to the risk-source-health fix; the candidate-count outcome is unchanged from PR#18d because the underlying row set is unchanged.
- No raw token / `token_hash` / token prefix / suffix / length / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw payload / raw response body / full session_id appeared in the observer's report or in this proof record. DSN was loaded into `DATABASE_URL` from `/opt/buyerrecon-backend/.env` without being printed; the observer's report masks the DSN to host + db name only.

---

## 2. Why this PR exists

PR#18d's staging proof recorded a single warning:

| Anomaly | Severity | Detail |
|---|---|---|
| `optional_source_count_query_failed` | `warn` | `public.risk_observations_v0_1` |

PR#18f's source-health diagnostic narrowed the root cause categorically:

| Finding | Value |
|---|---|
| `table_exists` | true |
| `select_privilege` | true (connected role `buyerrecon_app`) |
| `derived_at_present` on `risk_observations_v0_1` | **false** |
| `created_at_present` on `risk_observations_v0_1` | **true** |
| `observer_query_repro` | `ERROR column "derived_at" does not exist` (PostgreSQL `42703 / undefined_column`) |
| `corrected_query_with_created_at` | `2` |
| Verdict | **BLOCKED / schema_mismatch** |

PR#18g applied the narrow code fix: changed `COUNT_RISK_OBSERVATIONS_SQL` from `derived_at >= $1 AND derived_at < $2` to `created_at >= $1 AND created_at < $2`, added four schema-guard tests (K.6 → K.9) preventing regression, and shipped under PR #39 (merge `9b29afd`).

PR#18h is the final step in that chain: re-run the observer against the live staging DB after the fix lands on base, and record categorical evidence that the warning is closed and the corrected query reaches the expected count.

---

## 3. Execution context

| Item | Value |
|---|---|
| Execution context | Helen-as-operator on Hetzner staging host (`/opt/buyerrecon-backend`); Claude Code did not run any `curl` / `psql` / SSH / fixture POST / token-provisioning command during execution. |
| Base branch HEAD at run | `9b29afd52e9ddbcac144022139a197acdce73e5c` (= PR#18g merge — "Sprint 2 PR#18g: fix risk observations timing query (#39)") |
| PR branch | `buyerrecon-sprint2-pr18h-timing-observer-risk-reproof` |
| Run host category | **Hetzner staging** (read-only DB role) |
| Command category | `npm run observe:timing-product-context` → `tsx scripts/timing-product-context-observation-report.ts` |
| `DATABASE_URL` | **PRESENT** (staging-class; loaded from `/opt/buyerrecon-backend/.env`; never printed) |
| `OBS_WORKSPACE_ID` | `buyerrecon_staging_ws` |
| `OBS_SITE_ID` | `buyerrecon_com` |
| `OBS_WINDOW_HOURS` | `720` (= 30 days; CLI default) |
| `observer_exit_code` | **0** |
| `report_lines` | **113** |
| `report_bytes` | **3,531** |

### 3.1 Observer self-reported run metadata

| Field | Value |
|---|---|
| `report_version` | `timing-product-context-observer-v0.1` |
| `observer_version` | `timing-product-context-observer-v0.1` |
| `pass_forward_contract_version` | `timing-product-context-pass-forward-v0.1` |
| `synthetic_exclusion_rule_version` | `synthetic-fixture-exclusion-v0.1` |
| `timing_band_thresholds_version` | `timing-band-thresholds-v0.1-observer-only` |
| `confidence_cap_policy_version` | `confidence-cap-policy-v0.1-low-medium-only` |
| `checked_at` | `2026-05-22T09:58:58.352Z` |
| `window_hours` | `720` |
| `window_start` | `2026-04-22T09:58:58.352Z` |
| `window_end` | `2026-05-22T09:58:58.352Z` |
| `database_host` | `127.0.0.1:5432` (masked by the observer to host:port only — staging DB reachable via local socket on the Hetzner host) |
| `database_name` | `buyerrecon_staging` (masked by the observer to db name only) |

The observer's report-level redaction (PR#18c § privacy posture) is unchanged: `database_host` is host:port only; `database_name` is db name only; no user / password / connection params surface. The values shown here are categorical identifiers, not credentials.

---

## 4. Observer output summary

### 4.1 Source tables present

All nine source tables present and reachable. No source missing.

| Table | Present |
|---|---|
| `public.accepted_events` | **yes** (required) |
| `public.ingest_requests` | **yes** (required) |
| `public.rejected_events` | **yes** (required) |
| `public.session_features` | **yes** (optional) |
| `public.session_behavioural_features_v0_2` | **yes** (optional) |
| `public.poi_observations_v0_1` | **yes** (optional) |
| `public.poi_sequence_observations_v0_1` | **yes** (optional) |
| `public.risk_observations_v0_1` | **yes** (optional; **count query now succeeds — see §4.2 / §5**) |
| `public.site_write_tokens` | **yes** (label-column only) |

### 4.2 Source counts (window-bounded; bound to `buyerrecon_staging_ws` / `buyerrecon_com`)

| Source | In-window count (PR#18d) | In-window count (PR#18h) | Change |
|---|---|---|---|
| `accepted_events` | 19 | **19** | unchanged |
| `ingest_requests` | 21 | **21** | unchanged |
| `rejected_events` | 1 | **1** | unchanged |
| `session_features` | 8 | **8** | unchanged |
| `session_behavioural_features_v0_2` | 16 | **16** | unchanged |
| `poi_observations_v0_1` | 8 | **8** | unchanged |
| `poi_sequence_observations_v0_1` | 8 | **8** | unchanged |
| **`risk_observations_v0_1`** | **`0` (default-on-failure)** | **`2`** (real count) | **CLOSED — query now succeeds and returns the real count** |

The `risk_observations_v0_1` count of `2` matches PR#18f §4's corrected-query staging probe verbatim — the same two rows surfaced by the manually-run `SELECT count(*) ... WHERE workspace_id = 'buyerrecon_staging_ws' AND site_id = 'buyerrecon_com' AND created_at >= (now() - interval '720 hours') AND created_at < now()` (PR#18f §4.3 / B.5).

All other source counts are unchanged from PR#18d, as expected — the only thing PR#18g changed was the SQL constant for risk observations; no other observer behaviour was altered.

### 4.3 Synthetic / control-traffic exclusion

Identical to PR#18d. Exclusion machinery works as designed; the staging proof boundary still contains only Gate-N proof traffic in-window; proof rows are preserved (not deleted).

| Field | Value |
|---|---|
| `rule_version` | `synthetic-fixture-exclusion-v0.1` |
| `excluded_workspace_site_pair_matches` | **1** |
| `excluded_schema_key_namespace_matches` | **3** |
| `excluded_token_label_matches` | **2** |
| `excluded_accepted_events_rows` | **19** |
| `excluded_rejected_events_rows` | **1** |
| `excluded_ingest_requests_rows` | **21** |
| `proof_rows_preserved` | **yes** |

### 4.4 Timing band distribution

All bands at zero. The candidate set is empty after synthetic-fixture exclusion (see §4.6); no per-session candidate produced.

| Band | Count |
|---|---|
| `hot_now` | 0 |
| `warm_recent` | 0 |
| `cooling` | 0 |
| `stale` | 0 |
| `dormant` | 0 |
| `insufficient_evidence` | 0 |

### 4.5 Per-session candidate counts

| Field | Value |
|---|---|
| `candidate_count` | **0** |
| `pass_forward_to_pass1_count` | **0** |
| Full `session_id` surfaced in any candidate row | **no** (no candidates emitted) |
| `request_id` UUID surfaced | **no** |
| Raw payload surfaced | **no** |

Confidence cap distribution: not applicable — `candidate_count = 0`.

### 4.6 Anomalies

| Kind | Severity | Detail | Compared to PR#18d |
|---|---|---|---|
| `synthetic_exclusion_filter_empty` | **info** | all in-window required-source rows were excluded as synthetic / control traffic | unchanged (expected at this boundary) |

**No `optional_source_count_query_failed` anomaly.** The previously-recorded risk warning is categorically ABSENT from the report.

### 4.7 Final status

**`PASS`** — derived per the observer's `deriveFinalStatus()` contract: no `block`-severity anomalies; no `warn`-severity anomalies. The only anomaly present is `info`-severity, which the contract treats as PASS (not PASS_WITH_WARNINGS — `info` does not downgrade the status).

This is a categorical improvement over PR#18d's `PASS_WITH_WARNINGS`. The single change in the anomaly set — removal of the `optional_source_count_query_failed / warn / public.risk_observations_v0_1` entry — is what flipped the status to `PASS`.

---

## 5. Risk warning closure assessment

This is the central claim of PR#18h. Recorded categorically:

| Assertion | Value |
|---|---|
| `optional_source_count_query_failed / public.risk_observations_v0_1` present in the new report? | **no** — absent |
| `source_counts.risk_observations_v0_1_in_window` reports the helper's default-on-failure `0`? | **no** — reports the real count `2` |
| `risk_observations_v0_1` count confirmed by independent PR#18f source-health probe? | **yes** (PR#18f §4 corrected-query returned `2`; PR#18h observer reports `2`) |
| Final status downgraded by the risk anomaly? | **no** — final status is `PASS` |

The risk warning is **categorically CLOSED**. PR#18g's narrow code fix landed correctly, deployed to the staging host (HEAD `9b29afd`), and exercises the table via the schema-backed `created_at` column as expected.

### 5.1 Eligibility for a future Pass 1 contract amendment

Risk evidence is now **"eligible for a future Pass 1 contract amendment"** under the framing requested by Helen for this PR's interpretation:

- The schema-mismatch root cause that previously prevented risk-observation evidence from being read is resolved.
- The observer's `source_counts.risk_observations_v0_1_in_window` field now reports a confirmed real count rather than a default-on-failure zero.
- PR#18e §7.3's three-step transition path (PR#18g merge → staging re-proof → contract amendment) has now completed steps 1 and 2.
- The remaining step 3 — amending PR#18e's Pass 1 contract from `risk_evidence_status = 'warning'` (effectively `'unavailable'` while the warning was open) to `'usable_later'` under contract version `pass1-output-contract-v0.2` — **is NOT applied by PR#18h**. That amendment is a separately-gated future PR with its own Helen GO.

### 5.2 What PR#18h explicitly does NOT do

- Does **not** approve runtime scoring of any kind.
- Does **not** amend PR#18e's Pass 1 contract.
- Does **not** flip `risk_evidence_status` to `'usable_later'` in any code path.
- Does **not** authorise any Pass 1 / Trust / Pass 2 runtime PR to start consuming risk-observation evidence at runtime.
- Does **not** open the future Pass 1 contract amendment PR.

The framing the user requested for this proof — "eligible for a future Pass 1 contract amendment, but does not itself approve runtime scoring" — is the categorical boundary PR#18h preserves.

---

## 6. Impact on Pass 1 / Trust / Pass 2

### 6.1 What is unlocked (planning only)

- A future Pass 1 contract amendment PR (`pass1-output-contract-v0.2`) may now reference PR#18h's PASS result as the source-health prerequisite for transitioning `risk_evidence_status` from `'warning'` to `'usable_later'`. The amendment PR is separately gated and is NOT opened by PR#18h.

### 6.2 What remains explicitly NOT approved

- **Pass 1 runtime.** No `EvaluatePreTrust`-style runtime is invoked from BuyerRecon today; AMS owns Pass 1 runtime (per PR#18b §4.2 / PR#14a §3). PR#18h does not approve any Pass 1 runtime path or any code change.
- **Pass 2 runtime.** Same — AMS owns it; PR#18h approves no runtime path.
- **Trust runtime.** Same — AMS owns it; PR#18h approves no runtime path.
- **Customer-facing output.** No Pass 1 / Trust / Pass 2 surface exists; none enabled.
- **Lane A/B writer.** PR#17f / PR#17q grant safety on `public.scoring_output_lane_a` / `public.scoring_output_lane_b` stands.
- **Gate 4.** Paused per PR#18a §11; PR#18h does not change that.
- **Production `endpointUrl` re-flip; production traffic; website ThinSDK production activation; production artefact / config mode flip.** All non-approved.
- **Risk-observation evidence consumption at runtime.** Requires the contract amendment AND a separate runtime PR with its own Helen GO. PR#18h opens neither.

---

## 7. Boundaries (re-asserted)

The observer's `boundary_affirmations` block (reproduced verbatim from the report) is unchanged from PR#18d. Every categorical guarantee held during the re-proof:

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
| `confidence_cap_high_emitted` | **no** |
| `synthetic_proof_rows_preserved` | **yes** |

Additional categorical affirmations specific to PR#18h:

- No production endpoint contacted. No `curl` against `https://buyerrecon.com/v1/event` or `https://buyerrecon-backend.onrender.com/collect`.
- No production DB queried; the 26 production `ingest_requests` canary evidence rows from the post-PR#17q canary remain preserved.
- No `/var/www` edit. No `endpointUrl` re-flip. No website artefact change. No production config edit.
- No DB grant change. PR#17q column-level grants and PR#17f / PR#17q Lane A/B grant safety untouched.
- No Nginx / systemctl / DNS change.
- No Track A. No Playwright. No customer-facing output. No Lane A/B writer.
- No AMS Trust runtime. No Pass 1 runtime. No Pass 2 runtime.
- No Timing / Product Context runtime decisioning (the observer is read-only and emits no decision).
- No knobs / dashboard implementation.
- No website ThinSDK production activation.
- No production artefact / config mode flip.
- No AMS repo modification. No AMS PR opened. No AMS runtime call.
- No Gate 4 work.

---

## 8. Cleanup evidence

Helen's cleanup confirmation lines from the post-run block:

| Field | Value |
|---|---|
| `report_removed` | **yes** (the captured `/tmp/pr18h-observer-report.md` was shredded / removed) |
| `DATABASE_URL_unset` | **yes** (staging DSN unset from the operator shell) |
| `OBS_WORKSPACE_ID_unset` | **yes** |
| `OBS_SITE_ID_unset` | **yes** |
| `OBS_WINDOW_HOURS_unset` | **yes** |

The observer / CLI artefact itself was untouched on the host's filesystem (no DDL, no migration); the `/tmp/pr18h-observer-report.md` transient runtime artefact is removed; operator-shell env vars for the run are no longer set. The observer's report-level redaction (enforced by merged PR#18c / PR#18g code) is independent of cleanup; no secret material reached any artefact regardless.

---

## 9. Recommended next PR (Pass 1 contract amendment — separately gated)

PR#18h's PASS result is the source-health prerequisite for the next step in the PR#18e §7.3 chain. The recommended follow-up is **NOT** opened by PR#18h:

- **Pass 1 contract amendment PR** (target version `pass1-output-contract-v0.2`), separately gated by its own explicit Helen GO. Scope:
  - Amend `docs/sprint2-pr18e-pass1-output-contract-planning.md` to bump the contract version stamp from `pass1-output-contract-v0.1` to `pass1-output-contract-v0.2`.
  - Permit the `risk_evidence_status` field (§4.1 of PR#18e) to transition from `'warning'` to `'usable_later'`, citing PR#18h as the source-health prerequisite proof.
  - Keep `blocked_by_risk_warning` in the §5 `Pass1Interpretation` enum (the bug class remains a defensive guard even after the immediate warning is closed) OR rename it to something narrower if Helen prefers; this is an OD for the amendment PR.
  - **No runtime PR.** The contract amendment is docs-only.
- **Any future Pass 1 runtime PR** that would actually invoke a Pass-1-style scoring path against risk evidence remains downstream and separately gated.

PR#18h does not pre-authorise either of these PRs.

---

End of PR#18h. **Verdict: PASS — staging re-proof confirms PR#18g's narrow code fix (`derived_at` → `created_at`) closed the PR#18d `optional_source_count_query_failed / warn / public.risk_observations_v0_1` warning categorically. The observer's `source_counts.risk_observations_v0_1_in_window` now reports the real count `2`, matching PR#18f §4's independent source-health probe. All other source counts unchanged from PR#18d, as expected. The only remaining anomaly is the expected-by-design `synthetic_exclusion_filter_empty / info` at the staging proof boundary; final status is `PASS` (not PASS_WITH_WARNINGS — `info` does not downgrade). Risk-observation evidence is now **eligible for a future Pass 1 contract amendment**; PR#18h does NOT amend the contract, does NOT flip `risk_evidence_status` to `'usable_later'`, does NOT approve any runtime scoring, customer-facing output, Lane A/B writer, AMS runtime bridge, Pass 1 runtime, Pass 2 runtime, Trust runtime, Gate 4 work, production `endpointUrl` re-flip, production traffic, Track A, Playwright, website ThinSDK production activation, or production artefact / config mode flip. No DB writes, no migration, no schema change, no AMS repo modification. No raw token / `token_hash` / token prefix / suffix / length / `token_id` / pepper / DSN / Authorization header / `request_id` UUID value / raw payload / raw response body / private key / certificate body / env dump / vault content / shell-history extract appears in this proof record. The recommended next PR is a separately-gated Pass 1 contract amendment (`pass1-output-contract-v0.2`); it is not opened by PR#18h.**
