# Sprint 2 PR#18ao — Gate 4C: Diagnose Production Collector `accepted_events` Permission Blocker (Docs-Only)

> **DOCS-ONLY DIAGNOSTIC PLANNING RECORD.** This PR does not fix
> production, does not apply any DB grant, does not deploy, does not
> contact production, does not run a canary, does not retry Gate 4C,
> and does not open Gate 4D. It records the current blocked state,
> the known privilege snapshot, the code path under diagnosis, the
> diagnostic questions that must be answered before any fix is
> approved, the read-only diagnostic commands for a future operator
> session, candidate fix options for review, and the proof required
> before a new Gate 4C GO can be issued. No secrets, no raw payloads,
> no raw `request_id` / `session_id` — categorical/structural facts
> only.

---

## 1. Current state

| Item | Value |
| --- | --- |
| PR #84 | Merged — `GATE4C_EXECUTION_BLOCKED_ROLLED_BACK` recorded |
| PR #84 merge commit | `aaa36e0c08886b7583900d4104d4b1ba3dea89a0` |
| PR #83 GO | Consumed — live canary reached production `/v1/event` |
| Gate 4C | Blocked and rolled back |
| Gate 4D | Closed — not authorized by any merged PR |
| Production posture | Rolled back to legacy `/collect`; legacy SDK/init restored |

Any future Gate 4C retry requires **all** of the following in order:

1. Production permission/grant diagnosis and a confirmed fix.
2. Proof that the collector write path succeeds with the fixed
   privileges (staging or a separately authorized safe probe).
3. A new fresh Gate 4C execution GO PR (PR#83-style).
4. A new single-attempt Gate 4C retry under the new GO.

---

## 2. Problem statement

The Gate 4C execution (PR #83 GO) produced the following outcome:

- **Static HTTPS frontend cutover: PASS.** Versioned SDK hash
  `048d1d23…` and versioned init hash `69f898f8…` were served.
  Served init had `endpointUrl: https://buyerrecon.com/v1/event` and
  `mode: sprint2_v1_event`. SDK-before-init order confirmed. No
  unversioned refs on the sampled page.
- **Old cache-mix / `request_body_invalid_json` failure: NOT
  reproduced.** `new_invalid_json_post_flip = 0`. The PR #82
  root-cause has been addressed at the repo layer.
- **Browser canary: HTTP 500.** `POST https://buyerrecon.com/v1/event`
  returned HTTP 500. This is a stop-line.
- **Post-canary DB:** `accepted_since_canary = 0`,
  `collect_hits_post_flip = 0`, protected baseline intact at 26 rows.
- **Collector logs (categorical):**

  ```
  kind: storage_failure
  message: permission denied for table accepted_events
  ```

  Request IDs redacted. Observed at approximately
  `2026-06-02 15:06–15:10 UTC`.
- **Rollback: completed and verified.** Legacy `/collect` posture
  restored.

The blocker is a **production collector DB permission / storage
issue**, not a frontend cache-mix issue.

---

## 3. Known app role privileges

Role: `buyerrecon_prod_collector_app` on database `buyerrecon_production`.

### Table privileges

| Table | `SELECT` | `INSERT` | `UPDATE` |
| --- | --- | --- | --- |
| `public.accepted_events` | **false** | true | false |
| `public.ingest_requests` | false | true | true |
| `public.rejected_events` | false | true | false |

### Sequence privileges

| Sequence | `USAGE` | `SELECT` | `UPDATE` |
| --- | --- | --- | --- |
| `public.accepted_events_event_id_seq` | true | true | false |
| `public.rejected_events_id_seq` | true | true | false |

**Key tension (noted in PR #84 Codex review):** The privilege
snapshot shows `INSERT=true` on `accepted_events`, yet the live
collector received `permission denied for table accepted_events`.
The exact PostgreSQL privilege root cause is **not yet proven**. The
diagnostic must reconcile this tension before any grant is applied.

---

## 4. Code path under diagnosis

`src/collector/v1/persistence.ts` (also compiled to
`dist/collector/v1/persistence.js`) executes a single transaction
per request:

**Step 1 — Initial ingest row:**

```sql
INSERT INTO ingest_requests (
  request_id, received_at, workspace_id, site_id, endpoint, http_status,
  size_bytes, user_agent, ip_hash, request_body_sha256, expected_event_count,
  accepted_count, rejected_count, reconciled_at, auth_status,
  reject_reason_code, collector_version
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
```

**Step 2 — Per-row accepted insert with conflict and returning:**

```sql
INSERT INTO accepted_events (
  site_id, hostname, event_type, session_id, browser_id,
  client_timestamp_ms, received_at, raw, collector_version,
  client_event_id, page_view_id, previous_page_view_id,
  event_sequence_index, event_contract_version, request_id,
  workspace_id, validator_version, schema_key, schema_version,
  event_origin, id_format, traffic_class, payload_sha256,
  size_bytes, ip_hash, consent_state, consent_source,
  consent_updated_at, pre_consent_mode, tracking_mode,
  storage_mechanism, session_seq, session_started_at,
  session_last_seen_at, canonical_jsonb, payload_purged_at,
  debug_mode
)
VALUES ($1 … $37)
ON CONFLICT (workspace_id, site_id, client_event_id)
  WHERE workspace_id IS NOT NULL
    AND site_id IS NOT NULL
    AND client_event_id IS NOT NULL
  DO NOTHING
RETURNING event_id
```

- Conflict index: `accepted_events_dedup` (PR#6 partial unique
  index on `(workspace_id, site_id, client_event_id)` with `WHERE`
  predicate).
- Legacy conflict index also in use: `idx_accepted_dedup_client_event`
  on `(site_id, session_id, client_event_id)` — 23505 from this
  index is caught and reclassified in the same transaction.
- When `rowCount === 0` (conflict hit → `DO NOTHING`), the accepted
  candidate is reclassified as a `duplicate_client_event_id`
  rejected row.
- Unknown 23505 constraints → `ROLLBACK` + rethrow (producing a 500).

**Step 3 — Rejected row insert:**

```sql
INSERT INTO rejected_events (
  site_id, raw, reason_codes, received_at, collector_version,
  request_id, workspace_id, client_event_id, id_format,
  event_name, event_type, schema_key, schema_version,
  rejected_stage, reason_code, reason_detail, schema_errors_jsonb,
  pii_hits_jsonb, raw_payload_sha256, size_bytes, debug_mode,
  sample_visible_to_admin, rejected_at
)
VALUES ($1 … $23)
```

**Step 4 — Ingest row update:**

```sql
UPDATE ingest_requests
SET accepted_count = $1,
    rejected_count = $2,
    reconciled_at  = $3,
    http_status    = $4
WHERE request_id = $5
```

The transaction is committed at Step 4 or rolled back on any
non-conflict error. An unknown 23505 rethrow at Step 2 would
produce a raw 500 response matching what was observed.

---

## 5. Diagnostic questions

The next operator diagnostic session must answer **all** of the
following before any fix is approved:

### 5.1 RETURNING and column SELECT

> Does `INSERT … RETURNING event_id` require `SELECT` on
> `accepted_events.event_id` for this role?

In PostgreSQL, `RETURNING` reads back column values from the
inserted/updated row. Some PostgreSQL versions and configurations
require the role to have `SELECT` privilege on the referenced
columns to use `RETURNING`. The role currently has `SELECT=false`
on the whole table. Whether this applies at the column level for
`event_id` specifically must be confirmed.

### 5.2 Partial index conflict resolution

> Does `ON CONFLICT (workspace_id, site_id, client_event_id) WHERE
> workspace_id IS NOT NULL AND site_id IS NOT NULL AND
> client_event_id IS NOT NULL` require `SELECT` on the conflict
> target columns or on the partial index predicate columns?

PostgreSQL must resolve the target index for `ON CONFLICT` at
execution time. It may require the role to have read access to the
columns named in the conflict target and/or the `WHERE` predicate.
The role has `SELECT=false` on the whole table; whether
column-level `SELECT` is needed on `workspace_id`, `site_id`, or
`client_event_id` must be confirmed.

### 5.3 Column-level privileges

> Are there column-level privileges on `accepted_events` that
> differ from the table-level snapshot?

Column-level grants can exist independently of table-level grants.
A `GRANT SELECT (event_id) ON accepted_events` might exist or
might be absent. The diagnostic must check
`information_schema.column_privileges` for this role.

### 5.4 Triggers

> Are there triggers on `accepted_events`, `ingest_requests`, or
> `rejected_events` that execute as a different role, read from
> these tables, or require privileges the app role lacks?

A `BEFORE INSERT` or `AFTER INSERT` trigger running as `DEFINER`
or accessing related tables could produce a `permission denied`
that surfaces as if from the base `INSERT` statement.

### 5.5 Row-Level Security (RLS)

> Is RLS enabled on `accepted_events`, `ingest_requests`, or
> `rejected_events`? If so, do applicable policies permit insert /
> conflict / returning for `buyerrecon_prod_collector_app`?

If `relrowsecurity = true` and no permissive `INSERT` or `SELECT`
policy covers this role, inserts and returning reads will be
blocked even with table-level `INSERT` privilege.

### 5.6 Role binding

> Does the production collector process actually connect as
> `buyerrecon_prod_collector_app`?

The privilege snapshot was observed via an audit session. If the
`EnvironmentFile` DSN binds to a different role, or if the
connection pool uses a different runtime user, the snapshot may
not represent the actual failing session. The diagnostic must
confirm `SELECT current_user` inside the collector connection
context.

### 5.7 Failure path identification

> Is the `permission denied` produced by Step 2 (`accepted_events`
> insert/conflict/returning), or could it arise in Step 3
> (`rejected_events` insert) or Step 4 (`ingest_requests` update)?

The log message names `accepted_events` specifically. But the
diagnostic should verify that the failing statement is Step 2,
not a later step that also references `accepted_events` indirectly
(e.g. a trigger, constraint check, or policy that reads
`accepted_events` during a `rejected_events` write).

### 5.8 Legacy collector path

> Is the failing path definitely `src/collector/v1/persistence.ts`,
> not a legacy collector or route?

The `dist/server.js` runtime should be wiring `/v1/event` to the
v1 persistence path. Confirm no fallback path exists.

---

## 6. Read-only diagnostic commands (future operator session)

The following commands are **for a future operator diagnostic
session only**. This PR does not run them. All commands are
`SELECT`-only or `SHOW`-only; none write to the DB or print
connection strings, passwords, or tokens.

### 6.1 Confirm active role and database

```sql
SELECT current_user, current_database();
```

Expected: `buyerrecon_prod_collector_app` / `buyerrecon_production`.
If the result differs, the privilege snapshot from PR #84 §11 does
not cover the failing session.

### 6.2 Table-level privilege check

```sql
SELECT
  has_table_privilege('buyerrecon_prod_collector_app', 'public.ingest_requests',  'SELECT') AS ingest_select,
  has_table_privilege('buyerrecon_prod_collector_app', 'public.ingest_requests',  'INSERT') AS ingest_insert,
  has_table_privilege('buyerrecon_prod_collector_app', 'public.ingest_requests',  'UPDATE') AS ingest_update,
  has_table_privilege('buyerrecon_prod_collector_app', 'public.accepted_events',  'SELECT') AS accepted_select,
  has_table_privilege('buyerrecon_prod_collector_app', 'public.accepted_events',  'INSERT') AS accepted_insert,
  has_table_privilege('buyerrecon_prod_collector_app', 'public.accepted_events',  'UPDATE') AS accepted_update,
  has_table_privilege('buyerrecon_prod_collector_app', 'public.rejected_events',  'SELECT') AS rejected_select,
  has_table_privilege('buyerrecon_prod_collector_app', 'public.rejected_events',  'INSERT') AS rejected_insert,
  has_table_privilege('buyerrecon_prod_collector_app', 'public.rejected_events',  'UPDATE') AS rejected_update;
```

### 6.3 Column-level privilege check

```sql
SELECT table_name, column_name, privilege_type, grantee
FROM information_schema.column_privileges
WHERE grantee = 'buyerrecon_prod_collector_app'
  AND table_schema = 'public'
  AND table_name IN ('accepted_events', 'ingest_requests', 'rejected_events')
ORDER BY table_name, column_name, privilege_type;
```

Specifically look for `SELECT` on `accepted_events.event_id`,
`accepted_events.workspace_id`, `accepted_events.site_id`,
`accepted_events.client_event_id`.

### 6.4 RLS state

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('ingest_requests', 'accepted_events', 'rejected_events')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

If `relrowsecurity = true` for any of these tables, follow up
with the policy query in §6.5.

### 6.5 RLS policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ingest_requests', 'accepted_events', 'rejected_events')
ORDER BY tablename, policyname;
```

Check whether any policy restricts `INSERT` or `SELECT` for
`buyerrecon_prod_collector_app`.

### 6.6 Triggers

```sql
SELECT
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('ingest_requests', 'accepted_events', 'rejected_events')
ORDER BY event_object_table, trigger_name;
```

If any trigger is present, record its `action_statement`
(categorical; do not print row data).

### 6.7 Conflict target indexes on `accepted_events`

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'accepted_events'
ORDER BY indexname;
```

Confirm presence and definition of:
- `accepted_events_dedup` (PR#6 partial index on
  `(workspace_id, site_id, client_event_id)` with `WHERE` predicate)
- `idx_accepted_dedup_client_event` (legacy index on
  `(site_id, session_id, client_event_id)`)

Note whether the index definitions exactly match what the
persistence SQL expects for `ON CONFLICT` resolution.

### 6.8 `has_column_privilege` targeted check

```sql
SELECT
  has_column_privilege('buyerrecon_prod_collector_app', 'public.accepted_events', 'event_id',          'SELECT') AS ae_event_id_select,
  has_column_privilege('buyerrecon_prod_collector_app', 'public.accepted_events', 'workspace_id',      'SELECT') AS ae_workspace_id_select,
  has_column_privilege('buyerrecon_prod_collector_app', 'public.accepted_events', 'site_id',           'SELECT') AS ae_site_id_select,
  has_column_privilege('buyerrecon_prod_collector_app', 'public.accepted_events', 'client_event_id',   'SELECT') AS ae_client_event_id_select,
  has_column_privilege('buyerrecon_prod_collector_app', 'public.rejected_events', 'id',                'SELECT') AS re_id_select,
  has_column_privilege('buyerrecon_prod_collector_app', 'public.ingest_requests', 'request_id',        'SELECT') AS ir_request_id_select,
  has_column_privilege('buyerrecon_prod_collector_app', 'public.ingest_requests', 'accepted_count',    'SELECT') AS ir_accepted_count_select,
  has_column_privilege('buyerrecon_prod_collector_app', 'public.ingest_requests', 'rejected_count',    'SELECT') AS ir_rejected_count_select,
  has_column_privilege('buyerrecon_prod_collector_app', 'public.ingest_requests', 'reconciled_at',     'SELECT') AS ir_reconciled_at_select;
```

---

## 7. Candidate fix options

The following options are **candidates only**. No fix is applied
by this PR. The final approach must be selected after the
diagnostic in §6 confirms the exact privilege gap.

### Option A — Full `SELECT` grant on all three write-ledger tables

```sql
GRANT SELECT ON public.accepted_events TO buyerrecon_prod_collector_app;
GRANT SELECT ON public.rejected_events TO buyerrecon_prod_collector_app;
GRANT SELECT ON public.ingest_requests  TO buyerrecon_prod_collector_app;
```

**When to use:** If diagnostics confirm that the full-table
`SELECT=false` is blocking `RETURNING event_id` or the partial
index `ON CONFLICT` resolution (§5.1 / §5.2). This is the most
permissive of the minimal options and the most straightforward to
verify.

**Risk:** Grants broader read access than strictly necessary for
a write-only collector. If the security posture requires minimal
read exposure, prefer Option B.

### Option B — Narrow column-level `SELECT` grants

```sql
-- For RETURNING event_id and ON CONFLICT partial index resolution:
GRANT SELECT (event_id, workspace_id, site_id, client_event_id)
  ON public.accepted_events TO buyerrecon_prod_collector_app;

-- If rejected_events.id or ingest_requests columns are also needed
-- (confirm via §6.3 / §6.8 first):
-- GRANT SELECT (id) ON public.rejected_events TO buyerrecon_prod_collector_app;
-- GRANT SELECT (request_id, accepted_count, rejected_count, reconciled_at)
--   ON public.ingest_requests TO buyerrecon_prod_collector_app;
```

**When to use:** If diagnostics confirm that only specific columns
are needed for `RETURNING` and `ON CONFLICT` resolution (§5.1 /
§5.2 / §5.3), and a narrower privilege is preferred over full-table
`SELECT`.

**Risk:** Column-level grants can interact unexpectedly with
table-level grants in PostgreSQL; requires careful verification.

### Option C — Code-side change to avoid `RETURNING` or conflict select

Modify `src/collector/v1/persistence.ts` to restructure the
accepted insert path so it does not require `SELECT` on
`accepted_events` — for example, by removing `RETURNING event_id`
if the returned `event_id` can be avoided, or by using a
sequence-only approach.

**When to use:** If the security posture strongly prefers no
`SELECT` on `accepted_events` for the collector role, and Option
B's column grants are not acceptable.

**Risk:** Code change carries its own review, test, and deployment
cycle. Does not address RLS or trigger blockers if those are the
actual root cause.

### Option D — RLS / trigger fix

If diagnostics (§6.4 / §6.5 / §6.6) reveal RLS or a trigger as
the root cause, the fix is an RLS policy grant or trigger
adjustment rather than a table/column privilege grant.

**When to use:** Only if §6.4–§6.6 confirm RLS or a trigger is
the blocking path.

---

**Recommended approach:** Run the read-only diagnostic session
(§6) first. Then apply the smallest grant or fix that permits
the collector write path while preserving:

- no customer output
- no Lane writer activation
- no scoring / AMS Trust / Pass runtime activation
- no `SELECT`-level exposure beyond what the write path requires

Document the diagnostic output in a follow-up ops record before
any grant is applied to production.

---

## 8. Proof required before a new Gate 4C GO

Before any new Gate 4C execution GO PR is issued, the following
must exist as merged docs-only evidence on this base branch:

1. **Diagnostic output record** — a docs/ops record of the §6
   read-only diagnostic commands executed against
   `buyerrecon_production` under `buyerrecon_prod_audit_readonly`
   (or equivalent), recording which privilege gap was confirmed.
2. **Approved grant or code fix** — the specific `GRANT` statement(s)
   or code change, reviewed and approved per project governance.
3. **Post-fix privilege snapshot** — a new `has_table_privilege` /
   `has_column_privilege` snapshot showing the gap is closed.
4. **Collector write-path proof** — confirmation that the
   `accepted_events` insert/conflict/returning path succeeds:
   - Preferred: staging environment proof against a non-production
     copy of the schema.
   - If a production probe is required: must be separately
     authorized by a new GO that explicitly covers a safe, bounded,
     non-customer probe — not authorized by this PR.
5. **New fresh Gate 4C execution GO PR** — a PR#83-style record
   with `single_attempt_only=true`, explicitly referencing the
   diagnostic record and fix evidence above.

No retry is authorized until all five items above are satisfied.

---

## 9. Machine-readable block

```yaml
status: GATE4C_BLOCKED_DIAGNOSTIC_PENDING
pr84_verdict: GATE4C_EXECUTION_BLOCKED_ROLLED_BACK
pr83_go_consumed: true
gate_4c_retry_authorised_by_this_pr: false
gate_4d_authorised_by_this_pr: false
gate_4e_authorised_by_this_pr: false
gate_4f_invented_by_this_pr: false
db_grant_applied_by_this_pr: false
production_contact_by_this_pr: false
deploy_by_this_pr: false
canary_by_this_pr: false
customer_output_authorised_by_this_pr: false
lane_writer_authorised_by_this_pr: false
runtime_scoring_authorised_by_this_pr: false
ams_trust_pass_runtime_authorised_by_this_pr: false
app_role: buyerrecon_prod_collector_app
accepted_events_select: false
accepted_events_insert: true
known_blocker: permission_denied_for_table_accepted_events
root_cause_proven: false
candidate_root_causes:
  - returning_event_id_requires_select_on_column
  - on_conflict_partial_index_requires_select_on_conflict_columns
  - column_level_select_absent_for_returning_or_conflict_path
  - rls_enabled_blocking_insert_or_returning
  - trigger_requiring_privileges_not_held_by_app_role
  - production_role_differs_from_audited_snapshot
candidate_fixes:
  - option_a_full_select_grant_on_write_ledger_tables
  - option_b_narrow_column_select_grants
  - option_c_code_side_avoid_returning_or_conflict_select
  - option_d_rls_or_trigger_fix
next_step: run_readonly_diagnostic_section_6_then_apply_smallest_approved_fix_then_privilege_snapshot_then_writeproof_then_new_go
```

---

## 10. Hard boundaries

This PR does **not**:
- apply any DB grant or change any DB privilege
- fix production or any live environment
- contact staging or production
- deploy or edit `/var/www`
- run a canary or retry Gate 4C
- generate any DB writes
- authorize any Gate 4C retry
- open Gate 4D / Gate 4E
- invent Gate 4F
- change backend code, packages, migrations, or schema
- change secrets, tokens, or roles
- reproduce raw payloads, raw `request_id`, raw `session_id`,
  Authorization values, DSNs, or customer data
- activate customer output / Lane writers / runtime scoring /
  AMS Trust / Pass runtime

It records the diagnostic plan only.

`next_step: run_readonly_diagnostic_section_6_then_apply_smallest_approved_fix_then_privilege_snapshot_then_writeproof_then_new_go`
