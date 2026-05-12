# PR#3 DB role discovery + staging configuration (operator pack)

**Audience.** Helen-operated on Hetzner staging only. Not for Render
production. Not for any production DB. No live website collection. No
collector / app / server / auth touched. No PR#3 implementation. No
migration 011. No `schema.sql` change. **Read-only discovery in Phase 1;
operator SQL in Phase 3 requires DBA / superuser privileges and explicit
confirmation before each statement.**

**Status when this doc lands.** PR#3 planning at
`docs/sprint2-pr3-scoring-output-contracts-planning.md` has Codex PASS.
Implementation gate is **blocked** until Helen signs OD-1..OD-8 with
**named Postgres roles confirmed to exist** (OD-8 option (d)
"PUBLIC-revocation only" was rejected by Codex re-review). This
operator pack is the *single mechanism* by which the OD-8 prerequisite
is satisfied for the Hetzner staging environment.

---

## Canonical role boundaries (Helen-approved)

| Role | Login? | Purpose | Hard Rule I obligation |
| --- | --- | --- | --- |
| `buyerrecon_migrator` | NOLOGIN (group) — granted to whichever login role runs migrations on staging | Owns schema changes; the only role that may run DDL. | n/a |
| `buyerrecon_scoring_worker` | NOLOGIN (group) — granted to a future scorer login role | Future writer to `scoring_output_lane_a` and `scoring_output_lane_b`. Not used in PR#3 (PR#3 ships no writer). | Has SELECT + INSERT + UPDATE on both Lane tables. |
| `buyerrecon_customer_api` | NOLOGIN (group) — granted to a future customer-API login role | The customer-facing API path. | **Zero SELECT on `scoring_output_lane_b`** (Hard Rule I). May read Lane A only via a later redacted view (per OD-7); no direct SELECT on Lane A in v1. |
| `buyerrecon_internal_readonly` | NOLOGIN (group) — granted to internal audit / reporting login roles | Optional internal read for audit / reporting. Not customer-facing. | May SELECT on both Lane A and Lane B for internal use only. |

**Observed staging fact.** Hetzner staging `current_user` previously
observed as `buyerrecon_app`. This role is **observed-but-unclassified**
— it may currently hold a superset of the four canonical group roles'
purposes (i.e. it is *both* the writer and the reader because no role
separation has been done yet). Phase 1 discovery confirms or refutes
that assumption; Phase 3 operator SQL establishes the canonical group
roles and recommends a membership mapping for Helen to confirm.

---

## Phase 1 — Read-only role discovery (Hetzner staging only)

> **Helen runs this on the Hetzner staging shell.** The Phase 1 pack is
> read-only — every statement is a `SELECT`. It prints no passwords. It
> prints `DATABASE_URL` host + database name only, never the
> user/password fragment.

### Phase 1 command pack

```bash
# --- 0. Working directory + env load -----------------------------------------
cd /opt/buyerrecon-backend   # adjust if Hetzner repo lives elsewhere

# Load env safely; do NOT cat or echo it. `set -a` exports every key/value
# read by `.` (source) without printing.
set -a
[ -f /opt/buyerrecon-backend/.env ] && . /opt/buyerrecon-backend/.env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "BLOCKER: DATABASE_URL is not set after sourcing /opt/buyerrecon-backend/.env"
  exit 1
fi

# --- 1. Confirm DATABASE_URL host without printing credentials --------------
node -e '
const u = new URL(process.env.DATABASE_URL);
const db = u.pathname.replace(/^\//, "");
console.log("DATABASE_URL: host=" + u.host + " database=" + db);
'   # NB: never prints u.username or u.password

# --- 2. Confirm session identity (current DB, user, server addr/port) -------
psql "$DATABASE_URL" -At -F ' | ' -c "
  SELECT
    'current_database=' || current_database(),
    'current_user='     || current_user,
    'server_addr='      || COALESCE(inet_server_addr()::text, 'unix-socket'),
    'server_port='      || COALESCE(inet_server_port()::text, '');
"

# --- 3. Role discovery: canonical names + LIKE patterns ----------------------
psql "$DATABASE_URL" -P pager=off -c "
  SELECT rolname,
         rolcanlogin,
         rolsuper,
         rolcreatedb,
         rolcreaterole,
         rolinherit,
         rolbypassrls
    FROM pg_roles
   WHERE rolname IN (
           'buyerrecon_app',
           'buyerrecon_migrator',
           'buyerrecon_scoring_worker',
           'buyerrecon_customer_api',
           'buyerrecon_internal_readonly'
         )
      OR rolname LIKE 'buyerrecon%'
      OR rolname LIKE '%api%'
      OR rolname LIKE '%app%'
      OR rolname LIKE '%scoring%'
      OR rolname LIKE '%readonly%'
   ORDER BY rolname;
"

# --- 4. Role memberships (who is granted what) -------------------------------
psql "$DATABASE_URL" -P pager=off -c "
  SELECT child.rolname  AS member,
         parent.rolname AS granted_role,
         m.admin_option
    FROM pg_auth_members m
    JOIN pg_roles child  ON child.oid  = m.member
    JOIN pg_roles parent ON parent.oid = m.roleid
   WHERE child.rolname  LIKE 'buyerrecon%'
      OR parent.rolname LIKE 'buyerrecon%'
   ORDER BY child.rolname, parent.rolname;
"

# --- 5. Lane output table presence ------------------------------------------
psql "$DATABASE_URL" -At -c "
  SELECT 'scoring_output_lane_a regclass=' ||
           COALESCE(to_regclass('public.scoring_output_lane_a')::text, 'NULL'),
         'scoring_output_lane_b regclass=' ||
           COALESCE(to_regclass('public.scoring_output_lane_b')::text, 'NULL');
"

# --- 6. Table privileges on Lane A / Lane B (if tables exist) ---------------
# If both regclasses returned NULL above, this query returns 0 rows — that is
# the expected pre-PR#3 state. Operator records "tables not created yet —
# expected before PR#3 implementation."
psql "$DATABASE_URL" -P pager=off -c "
  SELECT grantee, table_name, privilege_type, is_grantable
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name IN ('scoring_output_lane_a', 'scoring_output_lane_b')
   ORDER BY table_name, grantee, privilege_type;
"

# --- 7. Capture all output to a discovery log (operator keeps locally) ------
# Re-run the block above with `| tee /tmp/pr3-role-discovery-$(date +%Y%m%dT%H%M%S).log`
# and attach the log to the implementation PR staging proof doc.
```

### What Phase 1 must establish before Phase 3

| Check | Pass condition |
| --- | --- |
| `DATABASE_URL` host belongs to Hetzner staging, not Render production | Operator visually confirms `host=` line is the staging hostname. |
| `current_database`, `current_user` printed | Recorded in the discovery log. |
| Each canonical role's presence | One row per role in the role-discovery output, OR absent (Phase 3 creates it). |
| `buyerrecon_app` classification | `rolcanlogin=t` expected. `rolsuper`, `rolcreatedb`, `rolcreaterole` — operator records the answer. |
| Lane output table presence | Both `to_regclass` results NULL — expected before PR#3 implementation. If either returns non-NULL, **STOP**: PR#3 implementation already ran (or a prior attempt did) and the state must be cleaned before this plan continues. |

---

## Phase 2 — Classification report template

> Operator fills in this table from the Phase 1 output, then attaches the
> filled-in version to the implementation PR staging proof doc.

### Phase 2.1 — Existing roles

| Canonical role | Present on staging? | `rolcanlogin` | `rolsuper` | `rolcreatedb` | `rolcreaterole` | `rolinherit` | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `buyerrecon_migrator` | yes / no | | | | | | |
| `buyerrecon_scoring_worker` | yes / no | | | | | | |
| `buyerrecon_customer_api` | yes / no | | | | | | |
| `buyerrecon_internal_readonly` | yes / no | | | | | | |
| `buyerrecon_app` | observed previously — confirm | | | | | | classify as login role only; mapping to canonical groups recorded below |

### Phase 2.2 — Role classification

For `buyerrecon_app` specifically, the operator records one of:

- **(α) Login-only role; will be granted membership in canonical groups via Phase 3** (recommended baseline).
- **(β) Already holds writer-class privileges directly** — record the discovered direct grants.
- **(γ) Already holds reader-class privileges directly** — record the discovered direct grants.
- **(δ) Other classification** — operator describes.

### Phase 2.3 — Pre-implementation readiness

| Question | Answer |
| --- | --- |
| Are all 4 canonical group roles present on staging? | yes / no |
| If no — does staging have a superuser / DBA with `CREATEROLE` privilege available to Helen? | yes / no |
| Is the connection identified by `DATABASE_URL` authorised to manage roles? | yes / no (most likely no — the app role is intentionally not `CREATEROLE`) |
| Does PR#3 implementation require a DBA/superuser action before migration 011 can be drafted? | yes (Phase 3 SQL) / no (all roles already exist) |
| If `buyerrecon_app` is currently the only login role, recommended mapping for staging | grant `buyerrecon_migrator` + `buyerrecon_scoring_worker` to `buyerrecon_app` for staging only; record the decision in the staging proof doc |

If the answer to any of the first three rows is **no**, PR#3
implementation cannot proceed: a DBA/superuser must run Phase 3 first.

---

## Phase 3 — Operator-only SQL (NOT in PR#3 migration 011)

**STAGING OPERATOR SQL — requires DBA / superuser privileges — do not
run via app `DATABASE_URL` unless that user is authorised to manage
roles. NEVER run on Render production. NEVER run on the production DB.
Never store passwords in this repo. Never echo or commit passwords.**

Phase 3 SQL lives **only** in this operator document. It MUST NOT be
copied into `migrations/011_*.sql`. Helen-approved D-8: migration 011
may only `GRANT` / `REVOKE` against roles that already exist; it may
never `CREATE ROLE`.

### Phase 3.1 — Create the four canonical group roles (run once per environment)

```sql
-- Run on Hetzner staging only, as a DBA / superuser.
-- NOLOGIN means these are GROUP roles; login is delegated to whichever
-- login role(s) are granted membership (see Phase 3.2). No password is
-- assigned here — group roles never log in.

CREATE ROLE buyerrecon_migrator          NOLOGIN;
CREATE ROLE buyerrecon_scoring_worker    NOLOGIN;
CREATE ROLE buyerrecon_customer_api      NOLOGIN;
CREATE ROLE buyerrecon_internal_readonly NOLOGIN;
```

If any role already exists (per Phase 1 output), omit the corresponding
`CREATE ROLE` statement — Postgres has no native `CREATE ROLE IF NOT
EXISTS`, and re-creating an existing role would error.

### Phase 3.2 — Map the existing `buyerrecon_app` login role to canonical groups (staging-only, operator-confirmed)

**Only run statements you have explicitly confirmed with Helen.** The
recommended baseline for the Hetzner staging environment treats
`buyerrecon_app` as the single login role used by the app/extractor in
the current pre-PR#3 state, and grants it membership in the canonical
group roles it currently exercises. Helen confirms which mappings
apply.

```sql
-- (Choose only the GRANTs Helen confirms after Phase 2 classification.)
-- Each GRANT establishes that `buyerrecon_app` inherits the named
-- group's privileges. Membership can be revoked later without
-- dropping the login role.

-- Migration permission (only if buyerrecon_app currently runs migrations):
GRANT buyerrecon_migrator       TO buyerrecon_app;

-- Writer permission (only if buyerrecon_app is the writer used by the
-- behavioural-features extractor today — likely yes since the
-- extractor writes to session_behavioural_features_v0_2):
GRANT buyerrecon_scoring_worker TO buyerrecon_app;

-- Customer-facing reader (DO NOT GRANT THIS to buyerrecon_app unless
-- Helen explicitly confirms buyerrecon_app is the customer-facing
-- API role. If staging has no separate customer-facing login role
-- yet, leave buyerrecon_customer_api un-mapped until a separate
-- customer-API login role is created.):
-- GRANT buyerrecon_customer_api TO <customer_facing_login_role>;

-- Internal reader (optional; only if Helen wants audit/reporting on
-- staging):
-- GRANT buyerrecon_internal_readonly TO <internal_audit_login_role>;
```

### Phase 3.3 — Verify the role state before drafting migration 011

```sql
-- Each canonical role must return one row.
SELECT rolname FROM pg_roles WHERE rolname IN (
  'buyerrecon_migrator',
  'buyerrecon_scoring_worker',
  'buyerrecon_customer_api',
  'buyerrecon_internal_readonly'
) ORDER BY rolname;

-- Memberships granted in Phase 3.2 must appear.
SELECT child.rolname AS login_role, parent.rolname AS group_role
  FROM pg_auth_members m
  JOIN pg_roles child  ON child.oid  = m.member
  JOIN pg_roles parent ON parent.oid = m.roleid
 WHERE parent.rolname IN (
   'buyerrecon_migrator',
   'buyerrecon_scoring_worker',
   'buyerrecon_customer_api',
   'buyerrecon_internal_readonly'
 )
 ORDER BY child.rolname, parent.rolname;
```

**Pass condition:** the first query returns 4 rows; the second returns
the memberships Helen confirmed in Phase 3.2.

### Phase 3.4 — Hard-don't list (operator sanity)

- **Do not** run any Phase 3 statement on Render production.
- **Do not** run any Phase 3 statement on the production DB.
- **Do not** assign passwords to the canonical group roles in this
  repo. The group roles are `NOLOGIN`; passwords would be a footgun.
- **Do not** commit any `DATABASE_URL` to the repo.
- **Do not** print secrets to the discovery log; the Phase 1 pack
  prints only host + database name from `DATABASE_URL`.
- **Do not** copy the Phase 3 `CREATE ROLE` / `GRANT … TO …`
  statements into `migrations/011_*.sql`.

---

## Phase 4 — PR#3 migration 011 contract recommendation (NOT yet drafted)

This phase records the contract that the future `migrations/011_*.sql`
must satisfy when it is eventually drafted. It does **not** modify the
PR#3 planning doc — it is a forward record of the operator-confirmed
role names so the migration author knows the exact identifiers to use.

### Phase 4.1 — What migration 011 MUST do

1. **Assert all required group roles exist before any `GRANT` /
   `REVOKE`.** Migration 011's first SQL statement is a single `DO $$ …
   RAISE EXCEPTION … END $$` block that fails fast with a clear BLOCKER
   message if any of the four canonical group roles is missing:

   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_migrator') THEN
       RAISE EXCEPTION 'BLOCKER: role buyerrecon_migrator not found; run docs/ops/pr3-db-role-setup-staging.md Phase 3 first.';
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_scoring_worker') THEN
       RAISE EXCEPTION 'BLOCKER: role buyerrecon_scoring_worker not found; run docs/ops/pr3-db-role-setup-staging.md Phase 3 first.';
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_customer_api') THEN
       RAISE EXCEPTION 'BLOCKER: role buyerrecon_customer_api not found; run docs/ops/pr3-db-role-setup-staging.md Phase 3 first.';
     END IF;
     -- buyerrecon_internal_readonly is optional; absence is allowed
     -- but logged via RAISE NOTICE.
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_internal_readonly') THEN
       RAISE NOTICE 'INFO: optional role buyerrecon_internal_readonly not found; internal reader grants will be skipped.';
     END IF;
   END $$;
   ```

2. **Fail with BLOCKER if any required role is missing.** No silent
   no-op. No `CREATE ROLE` fallback.

3. **Never `CREATE ROLE`, never `ALTER ROLE … SUPERUSER`, never `ALTER
   ROLE … BYPASSRLS`, never `ALTER ROLE … WITH PASSWORD`, never `ALTER
   ROLE … CREATEROLE`, never `ALTER ROLE … CREATEDB`.** Role lifecycle
   is operator-only, handled in Phase 3 of this doc.

4. **Revoke all direct access from `PUBLIC` on both lane output
   tables** as **defence-in-depth only** (never as proof of Hard Rule
   I):

   ```sql
   REVOKE ALL ON scoring_output_lane_a FROM PUBLIC;
   REVOKE ALL ON scoring_output_lane_b FROM PUBLIC;
   ```

5. **Grant Lane A / Lane B access according to confirmed canonical
   roles**:

   ```sql
   -- Writer (Lane A + Lane B): the scorer worker will INSERT here in PR#5 / PR#6.
   -- PR#3 itself writes no rows.
   GRANT SELECT, INSERT, UPDATE ON scoring_output_lane_a TO buyerrecon_scoring_worker;
   GRANT SELECT, INSERT, UPDATE ON scoring_output_lane_b TO buyerrecon_scoring_worker;

   -- Customer-facing API role: ZERO SELECT on Lane B (Hard Rule I).
   -- Belt-and-braces: explicit REVOKE even though no GRANT was issued.
   REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_customer_api;
   -- Customer-facing API role on Lane A: zero direct SELECT in v1 too;
   -- the redacted view ships in a later PR (per OD-7).
   REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_customer_api;

   -- Internal readonly (optional; guarded by RAISE NOTICE above):
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_internal_readonly') THEN
       GRANT SELECT ON scoring_output_lane_a TO buyerrecon_internal_readonly;
       GRANT SELECT ON scoring_output_lane_b TO buyerrecon_internal_readonly;
     END IF;
   END $$;
   ```

6. **Provide a verification SQL assertion at the end of the migration**
   that fails the migration if Hard Rule I is not in force:

   ```sql
   DO $$
   BEGIN
     IF has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_b'::regclass, 'SELECT'::text) THEN
       RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api still has SELECT on scoring_output_lane_b; Hard Rule I violated.';
     END IF;
   END $$;
   ```

### Phase 4.2 — What migration 011 MUST NOT do

- **No `CREATE ROLE`.** Phase 3 owns role creation.
- **No `INSERT INTO scoring_output_lane_a`** or
  `INSERT INTO scoring_output_lane_b` — PR#3 ships no writer (per
  planning doc §I.1.a).
- **No `GRANT SELECT … TO PUBLIC` for either lane output table.** Hard
  Rule I requires the customer-facing role to be a *named* role, not
  PUBLIC.
- **No silent fallback** if any role is missing. The migration must
  fail loudly via `RAISE EXCEPTION`.

### Phase 4.3 — Verification SQL files (separately written under PR#3 implementation)

The two read-only verification files
(`docs/sql/verification/10_scoring_output_lane_a_invariants.sql` and
`docs/sql/verification/11_scoring_output_lane_b_invariants.sql`) defined
in the PR#3 planning doc §J must, per this operator pack, use the
literal role name `buyerrecon_customer_api` (not a `<placeholder>`)
when evaluating Hard Rule I:

```sql
-- Verification SQL 11 §J.2 Hard Rule I check (post-Phase-3-confirmation):
SELECT has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_b'::regclass, 'SELECT'::text) AS hard_rule_i_violation_if_true;
-- Expected: FALSE.
```

If Phase 1 + Phase 2 yields a different confirmed name (e.g. Helen
overrides the canonical name), the verification SQL files are updated
to use that confirmed name **before** PR#3 implementation begins.

---

## Phase 5 — Pre-implementation gate for PR#3

PR#3 implementation may not begin until ALL of the following hold:

1. Phase 1 discovery executed on Hetzner staging; output captured in
   the staging proof log.
2. Phase 2 classification table filled in by the operator.
3. Phase 3 SQL (if needed) executed by a DBA / superuser; Phase 3.3
   verification passes (all 4 canonical group roles present;
   memberships as Helen-confirmed).
4. Helen written sign-off on PR#3 planning doc OD-1..OD-8 — explicitly
   including the OD-8 path chosen and the role-name mapping recorded
   above.
5. Codex review of PR#3 planning doc → PASS (already achieved).
6. P-1, P-2, P-7 (A0 §0.6) explicitly resolved per A0's recommended
   defaults (or Helen overrides).

Only after all six hold does the implementation PR get drafted on a
new branch from `sprint2-architecture-contracts-d4cc2bf` HEAD
(currently `3d8817701e509ec83b143d08ea40e7c26f0cbff6`).

---

## Hard boundaries (re-stated)

- No PR#3 implementation.
- No `migrations/011_*.sql` drafted yet.
- No `src/db/schema.sql` change.
- No DB touch from this local repo (Phase 1 / 3 SQL is operator-run on
  Hetzner staging only).
- No collector / app / server / auth touched.
- No Render production exposure (A0 P-4 still blocking).
- No production DB exposure.
- No secrets printed; `DATABASE_URL` host + database only.
- No live permission changes without operator confirmation per
  statement.
- No `CREATE ROLE` inside any future PR#3 migration.
- PUBLIC revocation is defence-in-depth only; the primary Hard Rule I
  proof is the named-role `has_table_privilege` assertion.
