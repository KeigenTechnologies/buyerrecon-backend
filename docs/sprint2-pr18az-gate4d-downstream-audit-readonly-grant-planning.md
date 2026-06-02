# Sprint 2 PR#18az — Gate 4D: Plan Downstream Readiness Audit-Readonly Grants (Docs-Only)

> **DOCS-ONLY GRANT PLANNING RECORD.** This PR plans the minimum
> read-only `SELECT` access needed for `buyerrecon_prod_audit_readonly`
> to complete the Gate 4D downstream readiness observation that was
> blocked in PR #95. It does **not** apply any grant, does not contact
> production, does not execute any observation, does not activate any
> worker, and does not open Gate 4E. No secrets, no raw payloads, no
> raw `request_id` / `session_id` — categorical / structural facts
> only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #92 | Merged — `GATE4C_EXECUTION_PASS` |
| PR #95 | Merged — `GATE4D_OBSERVATION_BLOCKED` |
| PR #95 merge commit | `29101748d54a4811f8f8d9dc0ad44fad10cfb3c6` |
| Block reason | `audit_role_select_gap_on_downstream_readiness_tables` |
| Gate 4C | **`GATE4C_EXECUTION_PASS`** — unchanged; collector layer healthy |
| Gate 4D observation | Blocked — not failed; collector evidence complete |
| PR #94 GO | Consumed |
| Gate 4E | Closed |
| Gate 4F | Not invented |
| Customer output | Not active |
| Lane writer | Not active |
| Scoring runtime | Not active |
| AMS Trust / Pass runtime | Not active |

Gate 4D is blocked only at the downstream readiness portion.
The collector-layer evidence from PR #95 (§4) is already recorded
and healthy:
`accepted_in_window=9`, `new_invalid_json=0`, `collect_hits=0`,
`rejected=0`, logs clean, Lane A/B `0/0`, baseline `26` intact.

A new observation GO is required after this planning is reviewed,
the grants are applied and proofed, and a new GO PR is merged.

---

## 2. Blocked table access — privilege snapshot from PR #95

| Table | Exists | `buyerrecon_prod_audit_readonly` SELECT |
| --- | --- | --- |
| `public.risk_observations_v0_1` | true | **false** |
| `public.session_behavioural_features_v0_2` | true | **false** |
| `public.session_features` | true | **false** |
| `public.stage0_decisions` | true | **false** |
| `public.scoring_output_lane_a` | true | true (already granted) |
| `public.scoring_output_lane_b` | true | true (already granted) |

The `buyerrecon_prod_audit_readonly` role was provisioned in PR#18v
for the five Gate 4A audit tables. The four downstream readiness
tables above were added in later migrations and were not included in
that initial grant.

The failing query (PR #95 §7.2):

```
permission denied for table session_features
```

---

## 3. Proposed minimal grant plan

The following `GRANT` statements address only the four blocked
tables. They grant `SELECT` only — no `INSERT`, `UPDATE`, `DELETE`,
or `REFERENCES`.

```sql
-- Read-only audit access for Gate 4D downstream readiness observation only.
-- No scoring writer, no Lane writer, no customer output, no worker activation.
GRANT SELECT ON public.session_features
  TO buyerrecon_prod_audit_readonly;

GRANT SELECT ON public.session_behavioural_features_v0_2
  TO buyerrecon_prod_audit_readonly;

GRANT SELECT ON public.stage0_decisions
  TO buyerrecon_prod_audit_readonly;

GRANT SELECT ON public.risk_observations_v0_1
  TO buyerrecon_prod_audit_readonly;
```

**Scope:**

| Item | Value |
| --- | --- |
| Grant type | `SELECT` only |
| Role granted to | `buyerrecon_prod_audit_readonly` |
| Database | `buyerrecon_production` |
| `INSERT` / `UPDATE` / `DELETE` granted | No |
| Worker activation | No |
| Scoring output writer | No |
| Lane writer | No |
| Customer output | No |
| AMS Trust / Pass runtime | No |
| Superuser / app-role substitution | No |

These grants are shown here as **table-level `SELECT`** for
operational simplicity. Section §3.1 below requires the operator to
explicitly choose the final grant form before the grant step is taken.

### 3.1 Grant-form decision point

The final grant form is **not selected by this PR**. The separate
operator grant step must explicitly choose the smallest approved
access that permits Gate 4D readiness observation. The three
candidate options are:

**Option A — Table-level `SELECT` (shown in §3 above)**

- Operationally simple; unblocks `COUNT(*)` readiness checks with
  no additional schema work.
- Technically allows the audit role to `SELECT` sensitive columns
  (e.g. `session_id`, JSONB evidence fields, URL fields, risk
  scores) if an operator wrote the wrong query.
- Relies on query discipline and the redaction rules in §4 to
  prevent inadvertent exposure.
- Use only if column-level grants are confirmed insufficient or
  impractical (see Option B).

**Option B — Column-level `SELECT` on non-sensitive surrogate / PK
columns (preferred least-privilege option)**

- Grants `SELECT` only on the columns required for `COUNT(*)` to
  execute (typically the primary key column or any `NOT NULL`
  non-sensitive surrogate), while denying `SELECT` on `session_id`,
  JSONB evidence fields (`rule_inputs`, `evidence_refs`, `velocity`,
  `tags`), URL fields, behavioral timing columns, and risk-score
  detail fields.
- Stronger privacy posture: the audit role cannot `SELECT` sensitive
  columns even if an operator writes an unintended query.
- Requires confirming the exact non-sensitive column names from
  `src/db/schema.sql` before the grant step. The post-grant proof
  must verify that `has_column_privilege` returns `false` for
  sensitive columns (`session_id`, JSONB fields, URLs, risk scores).
- Example form (exact column names must be verified before use):
  ```sql
  GRANT SELECT (session_features_id) ON public.session_features
    TO buyerrecon_prod_audit_readonly;
  ```
- Use if PostgreSQL confirms that `COUNT(*)` succeeds with only the
  PK column `SELECT` grant. Test in staging before production.

**Option C — Count-only views**

- Create dedicated views that expose only `COUNT(*)` or similar
  aggregates over each downstream readiness table. Grant `SELECT`
  on the views, not the base tables.
- Strongest isolation: base-table column exposure is entirely
  eliminated at the grant layer.
- Requires schema work (view DDL), separate review, and governance
  sign-off if chosen.
- Not created by this PR.

**Decision rule for the operator grant step:**

> Apply the smallest access that permits the `COUNT(*)` readiness
> query in §4. Prefer Option B over Option A; prefer Option C if
> view governance is already in place. If Option B is chosen, the
> post-grant proof requirements in §5 must be updated to include
> column-level `has_column_privilege` checks confirming sensitive
> columns remain inaccessible.

No grant is applied by this PR. No observation re-run is authorized
by this PR. If the grant form changes from table-level `SELECT`
(Option A) to column-level `SELECT` (Option B) or count-only views
(Option C), the post-grant proof requirements in §5 must be updated
accordingly before the proof is executed.

---

## 4. Privacy / raw-data safety check

All four tables contain `session_id`. Before the grants are applied
and the observation re-run, confirm that the approved observation
queries use only `COUNT(*)` or similar aggregate functions and do
**not** `SELECT` individual rows or the following column categories:

| Column / field | Present in table(s) | Must remain unselected |
| --- | --- | --- |
| `session_id` | all four | Yes — counts only |
| `workspace_id` | all four | Yes — counts only |
| `site_id` | all four | Yes — counts only |
| `landing_page_url` / `last_page_url` | `session_features` | Yes |
| `rule_inputs` (JSONB) | `stage0_decisions` | Yes |
| `evidence_refs` (JSONB) | `stage0_decisions`, `risk_observations_v0_1` | Yes |
| `velocity` (JSONB) | `risk_observations_v0_1` | Yes |
| `tags` (JSONB) | `risk_observations_v0_1` | Yes |
| Risk score numerics (`device_risk_01`, etc.) | `risk_observations_v0_1` | Yes — counts only |
| Behavioral timing columns | `session_behavioural_features_v0_2` | Yes — counts only |

**Approved observation query form for these tables (counts only):**

```sql
SELECT
  (SELECT COUNT(*) FROM public.session_features)                  AS session_features_count,
  (SELECT COUNT(*) FROM public.session_behavioural_features_v0_2) AS behavioural_features_count,
  (SELECT COUNT(*) FROM public.stage0_decisions)                   AS stage0_count,
  (SELECT COUNT(*) FROM public.risk_observations_v0_1)             AS risk_obs_count;
```

This query is safe: it returns integer row counts only. No `session_id`,
no URLs, no JSONB content, no risk scores, no behavioral metrics.

If any future observation query would require selecting individual
rows or JSONB content — **do not run it**; record the requirement and
plan a separate scoped query under explicit review.

---

## 5. Post-grant proof requirements

After an explicit operator grant step (a separate session, not this
PR), the following proof must be captured:

| Check | Expected |
| --- | --- |
| `has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'SELECT')` | true |
| `has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_behavioural_features_v0_2', 'SELECT')` | true |
| `has_table_privilege('buyerrecon_prod_audit_readonly', 'public.stage0_decisions', 'SELECT')` | true |
| `has_table_privilege('buyerrecon_prod_audit_readonly', 'public.risk_observations_v0_1', 'SELECT')` | true |
| `has_table_privilege('buyerrecon_prod_audit_readonly', 'public.scoring_output_lane_a', 'SELECT')` | true (unchanged) |
| `has_table_privilege('buyerrecon_prod_audit_readonly', 'public.scoring_output_lane_b', 'SELECT')` | true (unchanged) |
| `has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'INSERT')` | false |
| `has_table_privilege('buyerrecon_prod_audit_readonly', 'public.session_features', 'UPDATE')` | false |
| `scoring_output_lane_a` row count | 0 (unchanged) |
| `scoring_output_lane_b` row count | 0 (unchanged) |
| `transaction_read_only` for audit role | on |
| RLS / policies / triggers unchanged | confirmed |
| DB writes performed | none |
| Workers activated | none |

The post-grant proof must be recorded in a docs-only evidence PR
before any new Gate 4D observation GO is issued.

---

## 6. Future sequence

| Step | Status |
| --- | --- |
| a. This planning PR | **This PR** |
| b. Codex review and merge | Pending |
| c. Explicit operator grant step (separate session) | Not yet done |
| d. Docs-only post-grant proof PR | Not yet done — required |
| e. New Gate 4D read-only observation GO PR | Not yet done — gated on (d) |
| f. Re-run Gate 4D observation (downstream readiness counts) | Not yet done |
| g. Post-observation evidence PR | Not yet done |

Gate 4E and Gate 4F remain out of scope throughout this sequence.
No Lane writer, no customer output, no scoring runtime, and no AMS
Trust / Pass runtime are activated at any step.

---

## 7. Machine-readable block

```yaml
status: GATE4D_DOWNSTREAM_AUDIT_GRANT_PLANNING
gate4c_status: GATE4C_EXECUTION_PASS
gate4d_observation_status: GATE4D_OBSERVATION_BLOCKED
block_reason: audit_role_select_gap_on_downstream_readiness_tables
pr95_merge_commit: 29101748d54a4811f8f8d9dc0ad44fad10cfb3c6
blocked_tables:
  - public.session_features
  - public.session_behavioural_features_v0_2
  - public.stage0_decisions
  - public.risk_observations_v0_1
proposed_grants:
  - GRANT SELECT ON public.session_features TO buyerrecon_prod_audit_readonly
  - GRANT SELECT ON public.session_behavioural_features_v0_2 TO buyerrecon_prod_audit_readonly
  - GRANT SELECT ON public.stage0_decisions TO buyerrecon_prod_audit_readonly
  - GRANT SELECT ON public.risk_observations_v0_1 TO buyerrecon_prod_audit_readonly
grant_type: SELECT_only
no_insert_update_delete: true
approved_observation_query_form: COUNT_star_only
session_id_must_not_be_selected: true
jsonb_content_must_not_be_selected: true
risk_scores_must_not_be_selected: true
behavioral_metrics_must_not_be_selected: true
db_grant_applied_by_this_pr: false
production_contact_by_this_pr: false
observation_executed_by_this_pr: false
worker_activated_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
scoring_runtime_authorised_by_this_pr: false
ams_trust_pass_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
next_step: operator_grant_step_then_post_grant_proof_pr_then_new_gate4d_observation_go_pr
```

---

## 8. Hard boundaries

This PR does **not**:
- apply any DB grant or change any privilege
- contact production or perform any DB write
- execute any observation or run any query
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

It records the grant planning only.

`next_step: operator_grant_step_then_post_grant_proof_pr_then_new_gate4d_observation_go_pr`
