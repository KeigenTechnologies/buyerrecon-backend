-- Migration 016: Sprint 2 PR#17g — Lane A/B grant safety correction
--
-- Track B (BuyerRecon Evidence Foundation), Sprint 2 PR#17g.
--
-- Purpose:
--   Align the deployed scoring_output_lane_a / scoring_output_lane_b grant
--   posture with the PR#17f production migration operator runbook's
--   output-gate boundary, which approves NO durable Lane A/B writer under
--   PR#17f. Migration 011 currently grants:
--
--     GRANT SELECT, INSERT, UPDATE ON scoring_output_lane_a TO buyerrecon_scoring_worker;
--     GRANT SELECT, INSERT, UPDATE ON scoring_output_lane_b TO buyerrecon_scoring_worker;
--
--   That grant constitutes a durable Lane A/B writer privilege (INSERT /
--   UPDATE on the lane tables held by a non-migrator runtime role), which
--   is exactly what PR#17f forbids. Without this correction, applying
--   migrations 002–015 as-is in production would silently install the
--   forbidden writer privileges. PR#17f execution must NOT proceed past
--   migration phase until migration 016 has been applied.
--
-- Authority:
--   - docs/sprint2-pr17f-production-migration-operator-runbook.md §11
--     (grant boundary plan: feature/scoring worker = none on lane_a/_b)
--   - docs/sprint2-pr17f-production-migration-operator-runbook.md §22
--     (output-gate restrictions: no durable Lane A/B writers)
--   - docs/sprint2-pr17a-production-cutover-output-gates-planning.md §6.5
--     (future output governance: Pass 1 / Trust / Pass 2 gate required
--     before any customer-facing automated output)
--
-- Boundary clarifications carried forward from PR#17f:
--   - Any future writer to scoring_output_lane_a / scoring_output_lane_b
--     is deferred to a later explicitly approved output-gate PR.
--   - PR#17g does not approve durable Lane A/B writers.
--   - PR#17g does not change DNS, does not cut ThinLayer endpointUrl,
--     does not run Track A, does not enable customer-facing output, does
--     not introduce an AMS runtime bridge, does not expose AMS Trust Core
--     output, does not implement Pass 1 / Pass 2.
--   - PR#17g does not create or drop any role.
--   - PR#17g does not create or drop any table.
--   - PR#17g does not mutate any row in any table.
--
-- Idempotency:
--   This migration is safe to apply once, and safe to re-apply.
--   - REVOKE of a privilege that is not held is a NOTICE-level no-op in
--     PostgreSQL, not an error.
--   - GRANT of a privilege that is already held is also a no-op.
--   - All assertions are read-only checks against pg_roles and
--     has_table_privilege; they raise EXCEPTION only on policy violation,
--     in which case the entire migration's implicit transaction is rolled
--     back by ON_ERROR_STOP=1 (per PR#17f §8) and no partial state lands.
--
-- Hard non-scoring boundary (PR#17g MUST NOT introduce):
--   - any GRANT of INSERT / UPDATE / DELETE on scoring_output_lane_a or
--     scoring_output_lane_b to any non-migrator runtime role,
--   - any CREATE ROLE / ALTER ROLE,
--   - any CREATE TABLE / DROP TABLE / ALTER TABLE that modifies columns,
--   - any DML (INSERT / UPDATE / DELETE / TRUNCATE),
--   - any change to accepted_events / rejected_events / ingest_requests /
--     session_features / session_behavioural_features_v0_2 / Stage 0 /
--     risk_observations_v0_1 / poi_observations_v0_1 /
--     poi_sequence_observations_v0_1 / site_write_tokens.
--
-- Safe: grant-correction only. No schema change. No data change. No FK.
-- No constraint promotion. Defence-in-depth re-affirms PUBLIC and
-- customer_api revocation already enforced by migration 011 §4.

-- ---------------------------------------------------------------------------
-- 0. Role-existence assertions (fail-fast guards, mirroring migration 011)
-- ---------------------------------------------------------------------------
-- Migration 016 fails FAST if any of the four canonical group roles is
-- missing. Role creation is operator-only and lives upstream of any
-- migration application; migration 016 NEVER runs CREATE ROLE.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_migrator') THEN
    RAISE EXCEPTION 'BLOCKER: role buyerrecon_migrator not found; migration 011 prerequisite missing. Run the operator role pack first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_scoring_worker') THEN
    RAISE EXCEPTION 'BLOCKER: role buyerrecon_scoring_worker not found; migration 011 prerequisite missing. Run the operator role pack first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_customer_api') THEN
    RAISE EXCEPTION 'BLOCKER: role buyerrecon_customer_api not found; migration 011 prerequisite missing. Run the operator role pack first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buyerrecon_internal_readonly') THEN
    RAISE EXCEPTION 'BLOCKER: role buyerrecon_internal_readonly not found; migration 011 prerequisite missing. Run the operator role pack first.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Table-existence assertions
-- ---------------------------------------------------------------------------
-- Migration 016 must run only after migration 011 has created the lane
-- tables. If they are missing, the operator has applied migrations out of
-- order and must investigate before continuing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'scoring_output_lane_a'
       AND c.relkind = 'r'
       AND n.nspname = current_schema()
  ) THEN
    RAISE EXCEPTION 'BLOCKER: table scoring_output_lane_a not found; migration 011 must be applied before migration 016. Investigate migration order.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'scoring_output_lane_b'
       AND c.relkind = 'r'
       AND n.nspname = current_schema()
  ) THEN
    RAISE EXCEPTION 'BLOCKER: table scoring_output_lane_b not found; migration 011 must be applied before migration 016. Investigate migration order.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Revoke durable Lane A/B writer privilege from buyerrecon_scoring_worker
-- ---------------------------------------------------------------------------
-- Migration 011 granted SELECT, INSERT, UPDATE on both lane tables to
-- buyerrecon_scoring_worker. PR#17f's grant boundary plan (§11) and
-- output-gate restrictions (§22) require that NO role under PR#17f
-- receives INSERT / UPDATE / DELETE on scoring_output_lane_a or
-- scoring_output_lane_b. REVOKE ALL removes the durable Lane A/B writer
-- privilege entirely (SELECT included) so the scoring worker has no
-- access to these surfaces at all.
--
-- Any future Lane A/B writer is introduced by a later, explicitly
-- approved output-gate PR — never by PR#17g, and never silently via a
-- carry-over grant from migration 011.

REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_scoring_worker;
REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_scoring_worker;

-- ---------------------------------------------------------------------------
-- 3. Preserve migrator operational access
-- ---------------------------------------------------------------------------
-- The migrator role retains ALL on both lane tables so future approved
-- DDL (column additions, constraint changes, future approved migrations)
-- can be applied without an operator running as superuser. The GRANT is
-- idempotent: re-asserting a privilege already held is a no-op.

GRANT ALL ON scoring_output_lane_a TO buyerrecon_migrator;
GRANT ALL ON scoring_output_lane_b TO buyerrecon_migrator;

-- ---------------------------------------------------------------------------
-- 4. Preserve internal readonly / observer SELECT
-- ---------------------------------------------------------------------------
-- The internal readonly / observer role retains SELECT on both lane
-- tables for internal verification / preview only. This SELECT does NOT
-- constitute output approval; customer-facing automated output remains
-- gated by Pass 1 / Trust / Pass 2 in a later PR. The GRANT is
-- idempotent.

GRANT SELECT ON scoring_output_lane_a TO buyerrecon_internal_readonly;
GRANT SELECT ON scoring_output_lane_b TO buyerrecon_internal_readonly;

-- ---------------------------------------------------------------------------
-- 5. Re-affirm customer-facing API has no access (defence-in-depth)
-- ---------------------------------------------------------------------------
-- Migration 011 §4 already REVOKEs all access from buyerrecon_customer_api
-- on both lane tables. Migration 016 re-affirms the revocation as
-- defence-in-depth in case any operator action between 011 and 016
-- accidentally introduced a grant. REVOKE of a privilege that is not
-- held is a NOTICE-level no-op.

REVOKE ALL ON scoring_output_lane_a FROM buyerrecon_customer_api;
REVOKE ALL ON scoring_output_lane_b FROM buyerrecon_customer_api;

-- ---------------------------------------------------------------------------
-- 6. Post-migration assertions
-- ---------------------------------------------------------------------------
-- These checks fail the migration (raising EXCEPTION rolls back the
-- implicit transaction under ON_ERROR_STOP=1) if any required grant
-- state is wrong. Categories:
--
--   6.a buyerrecon_scoring_worker has NO SELECT/INSERT/UPDATE/DELETE on
--       either lane table.
--   6.b buyerrecon_customer_api has NO SELECT on either lane table.
--   6.c buyerrecon_internal_readonly HAS SELECT on both lane tables.
--   6.d buyerrecon_internal_readonly has NO INSERT/UPDATE/DELETE on
--       either lane table.
--
-- has_table_privilege expects (role name, table regclass, privilege text).
-- Explicit casts mirror migration 011's pattern so unannotated literals
-- do not resolve as `unknown` and the function resolves cleanly.

-- 6.a — scoring_worker has no SELECT/INSERT/UPDATE/DELETE on lane_a
DO $$
BEGIN
  IF has_table_privilege('buyerrecon_scoring_worker'::name, 'scoring_output_lane_a'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_scoring_worker still has SELECT on scoring_output_lane_a after REVOKE ALL; PR#17f Lane A/B writer boundary violated. Investigate role memberships.';
  END IF;
  IF has_table_privilege('buyerrecon_scoring_worker'::name, 'scoring_output_lane_a'::regclass, 'INSERT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_scoring_worker still has INSERT on scoring_output_lane_a after REVOKE ALL; durable Lane A writer unapproved by PR#17f.';
  END IF;
  IF has_table_privilege('buyerrecon_scoring_worker'::name, 'scoring_output_lane_a'::regclass, 'UPDATE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_scoring_worker still has UPDATE on scoring_output_lane_a after REVOKE ALL; durable Lane A writer unapproved by PR#17f.';
  END IF;
  IF has_table_privilege('buyerrecon_scoring_worker'::name, 'scoring_output_lane_a'::regclass, 'DELETE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_scoring_worker still has DELETE on scoring_output_lane_a after REVOKE ALL; durable Lane A writer unapproved by PR#17f.';
  END IF;
END $$;

-- 6.a — scoring_worker has no SELECT/INSERT/UPDATE/DELETE on lane_b
DO $$
BEGIN
  IF has_table_privilege('buyerrecon_scoring_worker'::name, 'scoring_output_lane_b'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_scoring_worker still has SELECT on scoring_output_lane_b after REVOKE ALL; PR#17f Lane A/B writer boundary violated. Investigate role memberships.';
  END IF;
  IF has_table_privilege('buyerrecon_scoring_worker'::name, 'scoring_output_lane_b'::regclass, 'INSERT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_scoring_worker still has INSERT on scoring_output_lane_b after REVOKE ALL; durable Lane B writer unapproved by PR#17f.';
  END IF;
  IF has_table_privilege('buyerrecon_scoring_worker'::name, 'scoring_output_lane_b'::regclass, 'UPDATE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_scoring_worker still has UPDATE on scoring_output_lane_b after REVOKE ALL; durable Lane B writer unapproved by PR#17f.';
  END IF;
  IF has_table_privilege('buyerrecon_scoring_worker'::name, 'scoring_output_lane_b'::regclass, 'DELETE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_scoring_worker still has DELETE on scoring_output_lane_b after REVOKE ALL; durable Lane B writer unapproved by PR#17f.';
  END IF;
END $$;

-- 6.b — customer_api has no SELECT on either lane table
DO $$
BEGIN
  IF has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_a'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api has SELECT on scoring_output_lane_a; OD-7 customer-facing redacted view deferred, no direct Lane A access allowed under PR#17f.';
  END IF;
  IF has_table_privilege('buyerrecon_customer_api'::name, 'scoring_output_lane_b'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_customer_api has SELECT on scoring_output_lane_b; Hard Rule I violated.';
  END IF;
END $$;

-- 6.c — internal_readonly HAS SELECT on both lane tables
DO $$
BEGIN
  IF NOT has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_a'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly missing SELECT on scoring_output_lane_a; internal verification / preview path broken.';
  END IF;
  IF NOT has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_b'::regclass, 'SELECT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly missing SELECT on scoring_output_lane_b; internal verification / preview path broken.';
  END IF;
END $$;

-- 6.d — internal_readonly has NO INSERT/UPDATE/DELETE on either lane table
DO $$
BEGIN
  IF has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_a'::regclass, 'INSERT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has INSERT on scoring_output_lane_a; readonly role must not write.';
  END IF;
  IF has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_a'::regclass, 'UPDATE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has UPDATE on scoring_output_lane_a; readonly role must not write.';
  END IF;
  IF has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_a'::regclass, 'DELETE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has DELETE on scoring_output_lane_a; readonly role must not write.';
  END IF;
  IF has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_b'::regclass, 'INSERT'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has INSERT on scoring_output_lane_b; readonly role must not write.';
  END IF;
  IF has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_b'::regclass, 'UPDATE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has UPDATE on scoring_output_lane_b; readonly role must not write.';
  END IF;
  IF has_table_privilege('buyerrecon_internal_readonly'::name, 'scoring_output_lane_b'::regclass, 'DELETE'::text) THEN
    RAISE EXCEPTION 'BLOCKER: buyerrecon_internal_readonly has DELETE on scoring_output_lane_b; readonly role must not write.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rollback (operator-only, NOT executed by this migration):
--
--   -- WARNING: re-granting SELECT/INSERT/UPDATE on the lane tables to
--   -- buyerrecon_scoring_worker re-introduces the durable Lane A/B
--   -- writer privilege that PR#17f explicitly forbids. Do NOT execute
--   -- the rollback below as part of resuming PR#17f execution; a
--   -- rollback is only appropriate if PR#17g itself is being reverted
--   -- in a separate, explicitly approved operator action.
--
--   GRANT SELECT, INSERT, UPDATE ON scoring_output_lane_a TO buyerrecon_scoring_worker;
--   GRANT SELECT, INSERT, UPDATE ON scoring_output_lane_b TO buyerrecon_scoring_worker;
--
-- Safe because:
--   - No data was mutated by this migration. Rollback is data-loss-free.
--   - No FK references either lane table.
--   - The four canonical group roles are NOT dropped (they pre-exist
--     migration 011 and are operator-owned).
--   - The lane tables themselves are NOT dropped.
--   - migrator and internal_readonly grants are unchanged by rollback.
--
-- If a future approved output-gate PR introduces a sanctioned Lane A/B
-- writer, that PR ships its own migration with its own grant set, its
-- own assertions, and its own scope — it is NOT a rollback of 016.
-- ---------------------------------------------------------------------------
