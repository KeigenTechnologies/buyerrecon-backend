# Sprint 2 PR#18ba — Gate 4D: Option B Downstream Audit-Readonly Grant Proof (Docs-Only)

> **DOCS-ONLY POST-GRANT PROOF RECORD.** This PR records the
> feasibility checks, grant application, and post-grant proof for
> the Option B column-level `SELECT` grants on
> `buyerrecon_prod_audit_readonly` planned in PR #96. It does not
> apply any further grant, does not execute a Gate 4D observation
> rerun, does not contact production beyond the described grant
> session, does not activate any worker, and does not open Gate 4E.
> No secrets, no raw payloads, no raw `request_id` / `session_id`
> — categorical / structural facts only.

---

## 1. Proof verdict

**`GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS`**

The Option B column-level `SELECT` grants were applied successfully.
Post-grant proof confirms:

- `SELECT` on the four safe surrogate PK columns: `true` for all.
- Table-level `SELECT` on the four downstream tables: `false` for all
  (intentional — column-level only).
- Sensitive `session_id` column `SELECT`: `false` for all tables
  (denying sensitive access as intended).
- `COUNT(*)` readiness queries: succeeded on all four tables.
- Negative proof: `SELECT session_id FROM public.session_features`
  returned `ERROR: permission denied for table session_features`.
- Lane A/B row counts: `0 / 0` — unchanged.

---

## 2. Current state

| Item | Value |
| --- | --- |
| PR #92 | Merged — `GATE4C_EXECUTION_PASS` |
| PR #95 | Merged — `GATE4D_OBSERVATION_BLOCKED` (audit SELECT gap) |
| PR #96 | Merged — `GATE4D_DOWNSTREAM_AUDIT_GRANT_PLANNING` |
| PR #96 merge commit | `f067722a9744f266bb00fc46eb739ce58cf0f814` |
| Gate 4C | **`GATE4C_EXECUTION_PASS`** — unchanged |
| Gate 4D | Blocked — observation rerun requires new GO PR |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |

This PR records the Option B grant proof. Gate 4D observation
cannot be retried until a new Gate 4D read-only observation GO PR
is reviewed and merged.

---

## 3. Pre-grant feasibility evidence

Read-only schema and privilege checks were run under
`buyerrecon_prod_audit_readonly` / `transaction_read_only=on`
before the grant was applied.

### 3.1 Safe surrogate PK columns confirmed

| Table | PK column | Type | `NOT NULL` |
| --- | --- | --- | --- |
| `risk_observations_v0_1` | `risk_observation_id` | `uuid` | true |
| `session_behavioural_features_v0_2` | `behavioural_features_id` | `bigint` | true |
| `session_features` | `session_features_id` | `bigint` | true |
| `stage0_decisions` | `stage0_decision_id` | `uuid` | true |

### 3.2 Primary key constraint confirmed

| Table | PK column | Type |
| --- | --- | --- |
| `risk_observations_v0_1` | `risk_observation_id` | `uuid` |
| `session_behavioural_features_v0_2` | `behavioural_features_id` | `bigint` |
| `session_features` | `session_features_id` | `bigint` |
| `stage0_decisions` | `stage0_decision_id` | `uuid` |

### 3.3 Pre-grant privilege state

| Check | Value |
| --- | --- |
| Table-level SELECT on the four downstream tables | `f \| f \| f \| f` |
| Candidate PK column SELECT | `f \| f \| f \| f` |
| `session_id` column SELECT | `f \| f \| f \| f` |
| Lane A/B `SELECT` access | `t \| t` (unchanged) |
| Lane A/B row counts | `0 \| 0` |

---

## 4. Grant application evidence

| Item | Value |
| --- | --- |
| Grant timestamp | `2026-06-03T10:41:17Z` |
| Grant output | `GRANT` × 4 |

Grants applied:

```sql
GRANT SELECT (session_features_id)
  ON public.session_features
  TO buyerrecon_prod_audit_readonly;

GRANT SELECT (behavioural_features_id)
  ON public.session_behavioural_features_v0_2
  TO buyerrecon_prod_audit_readonly;

GRANT SELECT (stage0_decision_id)
  ON public.stage0_decisions
  TO buyerrecon_prod_audit_readonly;

GRANT SELECT (risk_observation_id)
  ON public.risk_observations_v0_1
  TO buyerrecon_prod_audit_readonly;
```

**Scope of grants applied:**

| Item | Value |
| --- | --- |
| Grant type | Column-level `SELECT` on safe surrogate PK columns only |
| Table-level `SELECT` granted | No |
| `session_id` `SELECT` granted | No |
| `INSERT` / `UPDATE` / `DELETE` granted | No |
| Worker activation | No |
| Customer output | No |
| Lane writer | No |
| Scoring runtime | No |
| AMS Trust / Pass runtime | No |

---

## 5. Post-grant proof session

| Item | Value |
| --- | --- |
| Role | `buyerrecon_prod_audit_readonly` |
| Database | `buyerrecon_production` |
| `default_transaction_read_only` | `on` |
| Post-grant proof timestamp | `2026-06-03 10:41:27.941591 UTC` |

### 5.1 PK column SELECT confirmed

| Column | `SELECT` |
| --- | --- |
| `session_features.session_features_id` | **true** |
| `session_behavioural_features_v0_2.behavioural_features_id` | **true** |
| `stage0_decisions.stage0_decision_id` | **true** |
| `risk_observations_v0_1.risk_observation_id` | **true** |

Result: `t | t | t | t`

### 5.2 Table-level SELECT unchanged (intentionally false)

| Table | Table-level `SELECT` |
| --- | --- |
| `session_features` | false |
| `session_behavioural_features_v0_2` | false |
| `stage0_decisions` | false |
| `risk_observations_v0_1` | false |

Result: `f | f | f | f`

### 5.3 Sensitive `session_id` column SELECT confirmed denied

| Table | `session_id` `SELECT` |
| --- | --- |
| `session_features` | false |
| `session_behavioural_features_v0_2` | false |
| `stage0_decisions` | false |
| `risk_observations_v0_1` | false |

Result: `f | f | f | f`

---

## 6. `COUNT(*)` readiness proof

```sql
SELECT
  (SELECT COUNT(*) FROM public.session_features)                  AS session_features_count,
  (SELECT COUNT(*) FROM public.session_behavioural_features_v0_2) AS behavioural_features_count,
  (SELECT COUNT(*) FROM public.stage0_decisions)                   AS stage0_count,
  (SELECT COUNT(*) FROM public.risk_observations_v0_1)             AS risk_obs_count;
```

Result: `0 | 0 | 0 | 0`

All four counts returned successfully — no `permission denied`.

| Table | Count |
| --- | --- |
| `session_features` | 0 |
| `session_behavioural_features_v0_2` | 0 |
| `stage0_decisions` | 0 |
| `risk_observations_v0_1` | 0 |

Zero counts are expected and acceptable. The proof target is query
permission and ability, not non-zero downstream output. Downstream
workers have not been activated; these tables will accumulate rows
when the relevant worker pipelines are enabled under their own
separately gated PRs.

---

## 7. Lane safety proof

| Table | `SELECT` access | Row count |
| --- | --- | --- |
| `scoring_output_lane_a` | true (unchanged) | 0 |
| `scoring_output_lane_b` | true (unchanged) | 0 |

Result: `0 | 0` — Lane A/B writer remains inactive.

---

## 8. Negative sensitive-column proof

```sql
SELECT session_id FROM public.session_features LIMIT 1;
```

Result:

```
ERROR: permission denied for table session_features
```

**Interpretation:** The Option B column-level `SELECT` grant permits
`COUNT(*)` while denying `SELECT` on any column not explicitly
granted. Attempting to read `session_id` (or any other non-granted
column) returns `permission denied` — the sensitive column
protection is enforced at the PostgreSQL layer, not only by query
discipline. This confirms the Option B privacy posture is correctly
in place.

---

## 9. Conclusion

| Item | Status |
| --- | --- |
| Option B grant applied | Yes — `2026-06-03T10:41:17Z` |
| PK column SELECT = true | All four ✓ |
| Table-level SELECT = false | All four ✓ |
| `session_id` SELECT = false | All four ✓ |
| `COUNT(*)` queries succeeded | All four ✓ |
| Negative sensitive-column proof | PASS — `permission denied` on direct column read ✓ |
| Lane A/B unchanged | `0 / 0` ✓ |
| DB writes | None |
| Workers activated | None |
| Customer output | None |

**Verdict: `GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS`**

The `buyerrecon_prod_audit_readonly` role can now perform downstream
readiness `COUNT(*)` checks without table-level `SELECT` and without
access to `session_id` or other sensitive columns.

Gate 4D observation can be retried only after a new Gate 4D read-only
observation GO PR is reviewed and merged. This PR does not authorize
the observation rerun.

---

## 10. Machine-readable block

```yaml
status: GATE4D_OPTION_B_AUDIT_GRANT_PROOF_PASS
gate4c_status: GATE4C_EXECUTION_PASS
gate4d_observation_status: GATE4D_OBSERVATION_BLOCKED_PENDING_NEW_GO
pr96_planning_source: GATE4D_DOWNSTREAM_AUDIT_GRANT_PLANNING
grant_timestamp: 2026-06-03T10:41:17Z
grant_output: GRANT_x4
proof_timestamp: "2026-06-03 10:41:27.941591 UTC"
audit_role: buyerrecon_prod_audit_readonly
audit_db: buyerrecon_production
default_transaction_read_only: on
grants_applied:
  - GRANT SELECT (session_features_id) ON public.session_features TO buyerrecon_prod_audit_readonly
  - GRANT SELECT (behavioural_features_id) ON public.session_behavioural_features_v0_2 TO buyerrecon_prod_audit_readonly
  - GRANT SELECT (stage0_decision_id) ON public.stage0_decisions TO buyerrecon_prod_audit_readonly
  - GRANT SELECT (risk_observation_id) ON public.risk_observations_v0_1 TO buyerrecon_prod_audit_readonly
grant_form: column_level_select_pk_only
table_level_select_granted: false
session_id_select_granted: false
pk_column_select_post_grant: true_true_true_true
table_level_select_post_grant: false_false_false_false
session_id_select_post_grant: false_false_false_false
count_star_session_features: 0
count_star_behavioural_features: 0
count_star_stage0_decisions: 0
count_star_risk_observations: 0
negative_proof_select_session_id: permission_denied_for_table_session_features
lane_a_count: 0
lane_b_count: 0
db_write_performed: false
worker_activated: false
customer_output_activated: false
lane_writer_activated: false
scoring_runtime_activated: false
ams_trust_pass_activated: false
gate_4e_opened: false
gate_4f_invented: false
observation_rerun_authorised_by_this_pr: false
db_grant_applied_by_this_pr: false
next_step: new_gate4d_readonly_observation_go_pr_then_rerun_observation
```

---

## 11. Hard boundaries

This PR does **not**:
- apply any further DB grant or change any privilege
- contact production or perform any DB write
- execute any observation or run production queries
- deploy or activate any worker
- activate any Lane writer, scoring runtime, customer output,
  AMS Trust / Pass runtime
- open Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, IP hashes, user agents, or customer
  data

It records the Option B grant proof only.

`next_step: new_gate4d_readonly_observation_go_pr_then_rerun_observation`
