# Sprint 3 — `accepted_events` Read Privilege Grant Fix Proof (Docs-Only)

> **DOCS-ONLY POST-GRANT PROOF RECORD.** This PR records the
> execution of the `accepted_events` column-level SELECT grant fix
> authorized by PR #121 and Helen's explicit GO. It does not rerun
> the extractor, does not activate any worker, does not write to DB,
> does not contact production beyond the already-completed operator
> session described below, and does not open Gate 4E. No secrets,
> no raw payloads, no raw `request_id` / `session_id`.

---

## 1. Proof verdict

**`ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_PROOF_PASS`**

All 11 accepted_events columns required by the session_features
extractor now have `SELECT = true` for
`buyerrecon_prod_collector_app`. Table-level SELECT, `ip_hash`,
and `request_id` remain `false`. `user_agent` is absent from
`accepted_events`. RLS and triggers unchanged.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #120 | Merged — `ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_PLANNING` |
| PR #121 | Merged — `ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_GO_PLANNING` |
| PR #121 merge commit | `14040fb1a88fa4c46f7a9b5480913717fd4dc92a` |
| `session_features` rows | 0 — extractor still not run |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |
| Lane-preview (`src/lane-ab-preview/`) | Out of scope |

---

## 3. Helen GO

Helen issued the exact GO phrase required by PR #121 §2:

> **`HELEN ACCEPTED_EVENTS READ GRANT GO: apply the accepted_events
> column grants now.`**

---

## 4. Grant execution

### 4.1 Grant execution admin check

```
postgres|buyerrecon_production|2026-06-05 09:28:51.76313
```

### 4.2 Grant applied

The following reviewed column-level SELECT grant was applied exactly
as specified in PR #121 §3:

```sql
GRANT SELECT (
  session_id,
  received_at,
  raw,
  consent_source,
  schema_key,
  canonical_jsonb,
  event_contract_version,
  event_origin
)
ON public.accepted_events
TO buyerrecon_prod_collector_app;
```

### 4.3 Grant execution output

```
BEGIN
GRANT
COMMIT
```

One `GRANT` response. Transaction committed.

---

## 5. Post-grant proof

The proof session ran inside an explicit `BEGIN READ ONLY ... ROLLBACK`
block. No DML, DDL, or further GRANTs were executed during the proof.
No row-level `accepted_events` data was queried.

### 5.1 Proof session output (categorical — no raw data)

```
BEGIN
P1_ADMIN_READONLY|postgres|buyerrecon_production|on|2026-06-05 09:29:20.589975
P2_APP_TABLE_SELECT|f
P3_APP_11_EXTRACTOR_COLUMNS|t|t|t|t|t|t|t|t|t|t|t
P4_EXCLUDED_COLUMNS|f|f
P5_USER_AGENT_ABSENT|0
P6_RLS_STATE|f|f
P7_TRIGGER_COUNT|0
ROLLBACK
```

### 5.2 Proof summary

| Check | Label | Value |
| --- | --- | --- |
| Proof role / DB / `txn_read_only` / timestamp (P1) | `P1_ADMIN_READONLY` | `postgres \| buyerrecon_production \| on \| 2026-06-05 09:29:20.589975 UTC` |
| App role table-level SELECT (P2) | `P2_APP_TABLE_SELECT` | `f` ✓ — not granted |
| All 11 extractor-required columns (P3) | `P3_APP_11_EXTRACTOR_COLUMNS` | `t\|t\|t\|t\|t\|t\|t\|t\|t\|t\|t` ✓ |
| `ip_hash` and `request_id` SELECT (P4) | `P4_EXCLUDED_COLUMNS` | `f\|f` ✓ — not granted |
| `user_agent` absent from `accepted_events` (P5) | `P5_USER_AGENT_ABSENT` | `0` ✓ — column does not exist |
| RLS state (P6) | `P6_RLS_STATE` | `f\|f` ✓ — unchanged |
| Trigger count (P7) | `P7_TRIGGER_COUNT` | `0` ✓ — unchanged |

### 5.3 Column-by-column P3 breakdown

| Column | SELECT | Notes |
| --- | --- | --- |
| `event_id` | **true** | Previously granted |
| `workspace_id` | **true** | Previously granted (PR #87) |
| `site_id` | **true** | Previously granted (PR #87) |
| `session_id` | **true** | New grant |
| `received_at` | **true** | New grant |
| `raw` | **true** | New grant |
| `consent_source` | **true** | New grant |
| `schema_key` | **true** | New grant |
| `canonical_jsonb` | **true** | New grant |
| `event_contract_version` | **true** | New grant |
| `event_origin` | **true** | New grant |

---

## 6. Boundaries confirmed

| Boundary | Status |
| --- | --- |
| Additional GRANT beyond reviewed statements | None |
| DML / DDL during proof | None |
| Extractor rerun | Not attempted |
| Downstream worker run | Not run |
| Schema / migration change | None |
| Deploy | None |
| Customer output | None |
| Lane write | None |
| Scoring runtime | None |
| AMS Trust / Pass runtime | None |
| Gate 4E opened | No |
| Gate 4F invented | No |
| Raw `request_id` / `session_id` / payload / `canonical_jsonb` values printed | No |
| DSN or secret printed | No |

---

## 7. Next step

The grant fix is confirmed. The next separately gated step is a
**new session feature extractor rerun GO PR** — the same pattern
as prior extractor GO PRs. The extractor must not be rerun until
a new GO PR is reviewed and merged.

The new extractor GO PR must:
- Reference this proof PR as evidence that `accepted_events` read
  privileges are in place.
- Specify `SINCE=2026-06-02T21:14:34.000Z`.
- Confirm only `session_features` will be written.
- Require a post-run evidence PR before any downstream worker.

**No extractor rerun is authorized by this proof PR.**

---

## 8. Machine-readable block

```yaml
status: ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_PROOF_PASS
go_source: PR_121_ACCEPTED_EVENTS_READ_PRIVILEGE_GRANT_FIX_GO_PLANNING
pr121_merge_commit: 14040fb1a88fa4c46f7a9b5480913717fd4dc92a
helen_go_phrase: HELEN ACCEPTED_EVENTS READ GRANT GO apply the accepted_events column grants now
grant_execution_output: BEGIN_GRANT_COMMIT
grant_applied:
  - GRANT SELECT (session_id, received_at, raw, consent_source, schema_key, canonical_jsonb, event_contract_version, event_origin) ON accepted_events TO buyerrecon_prod_collector_app
p2_ae_table_select: false
p3_event_id: true
p3_workspace_id: true
p3_site_id: true
p3_session_id: true
p3_received_at: true
p3_raw: true
p3_consent_source: true
p3_schema_key: true
p3_canonical_jsonb: true
p3_event_contract_version: true
p3_event_origin: true
p4_ip_hash_select: false
p4_request_id_select: false
p5_user_agent_column_absent: true
p6_rls_unchanged: true
p7_trigger_count: 0
proof_txn_read_only: on
extractor_rerun_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
lane_preview_in_scope: false
next_step: new_session_features_extractor_rerun_go_pr_then_extractor_run_then_evidence_pr
```

---

## 9. Hard boundaries

This PR does **not**:
- apply any further DB grant or change privileges
- run the extractor or any other worker
- contact production or perform DB writes beyond the already-completed session
- change backend code, packages, migrations, or schema
- deploy
- open Gate 4E
- invent Gate 4F
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the `accepted_events` read privilege grant fix proof only.

`next_step: new_session_features_extractor_rerun_go_pr_then_extractor_run_then_evidence_pr`
