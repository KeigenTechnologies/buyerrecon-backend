# Sprint 3 — Dedicated Minimal Risk/Scoring Worker LOGIN Role — Planning (Docs-Only)

**Status:** `RISK_WORKER_DEDICATED_LOGIN_ROLE_PLANNING_ONLY`

This is a **docs-only planning / decision record**. It defines the smallest safe
role-design path for a **dedicated production risk-worker LOGIN role** that can
later be supplied as `RISK_WORKER_ROLE` to the PR #321 confirmation diagnostic
and the PR #320 post-Stage0 input-readiness proof.

This PR **executes nothing**: it does **not** create a role, set/rotate a
password, apply a grant, mutate the DB, run SQL/psql, run the PR #321 diagnostic,
run the PR #320 proof, run the risk worker, run Stage0/Step2E/Route C, run
Lane/scoring, run AMS runtime, produce customer output, or authorize Gate4E /
Gate4F.

> Provenance of current base: PR #322 merge
> `6ab39eba73220964073096e3fa057b8da40755e8` on
> `sprint2-architecture-contracts-d4cc2bf`.

---

## 1. Current proven state

| Item | Source | Fact (booleans/identifiers only) |
| --- | --- | --- |
| Discovery verdict | PR #322 (`RISK_WORKER_LOGIN_ROLE_DISCOVERY_NO_USABLE_RUNTIME_ROLE`) | No acceptable confirmed `RISK_WORKER_ROLE` exists |
| `buyerrecon_scoring_worker` | PR #322 | exists; **NOLOGIN** (`can_login=false`) — group role only |
| `buyerrecon_app` | PR #322 | LOGIN member of the group; `session_behavioural_features_v0_2` SELECT = **false** (privilege gap); `stage0_decisions` SELECT, `risk_observations_v0_1` INSERT/UPDATE present |
| `postgres` | PR #322 | LOGIN member; all four privileges true, but **admin/superuser** → rejected |
| Worker contract | `src/scoring/risk-evidence/worker.ts` | reads `stage0_decisions` + `session_behavioural_features_v0_2`; writes `risk_observations_v0_1` (INSERT … ON CONFLICT DO UPDATE) |
| Registered login roles | `.claude/constants.md` | `buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`, `buyerrecon_app` (no dedicated risk/scoring login role) |

**Bounded interpretation:** the risk worker's required privilege set is exactly
four privileges (§4). No existing usable production LOGIN role holds exactly that
set under a least-privilege, non-admin, role-separated identity.

---

## 2. Why existing discovered roles are unsuitable

- **`postgres` — rejected (wrong class).** It satisfies all four privilege
  booleans but is an **administrative / superuser** role. Using a superuser as a
  production worker runtime identity violates least-privilege and role
  separation. It **must not** be used as `RISK_WORKER_ROLE`.
- **`buyerrecon_scoring_worker` — not usable directly (NOLOGIN).** It is a group
  role with `can_login=false`; it cannot connect. It may only contribute
  privileges *to* a LOGIN member.
- **`buyerrecon_app` — not the default (unconfirmed + privilege gap).** It is
  **not confirmed** as the risk-worker runtime identity and currently **lacks
  `session_behavioural_features_v0_2` SELECT**. Repurposing it would be a
  **separately reviewed operator-policy decision** — not the recommended default
  — and would still require closing its SELECT gap under its own separate
  planning + review + scoped GO. This plan does **not** silently repurpose it.
- **`buyerrecon_prod_collector_app` / `buyerrecon_stage0_runner` — wrong
  function.** Collector is write-only on ingestion with no scoring access;
  Stage0 runner is Stage-0-scoped with explicitly no `buyerrecon_scoring_worker`
  membership. Neither is the risk writer.

---

## 3. Dedicated role recommendation

**Recommended default:** create a **dedicated minimal LOGIN role** for the
risk-evidence worker, **separate** from the collector and Stage0 roles.

- **Candidate name (candidate only):** `buyerrecon_risk_worker`.
- It must be a **LOGIN** role.
- It must **not** be `postgres`.
- It must **not** be `buyerrecon_prod_collector_app`.
- It must **not** be `buyerrecon_stage0_runner`.
- It must **not** be `buyerrecon_scoring_worker` itself (that role is NOLOGIN).
- It must **not** be a superuser and must hold **no** role attributes beyond
  `LOGIN` (§4 disallowed list).

The name `buyerrecon_risk_worker` is a **candidate identifier only**; it becomes
official only if a later reviewed change registers it in `.claude/constants.md`
(and/or the production runtime registry). This plan does not register it.

---

## 4. Minimal required privileges

The future role supports the **risk-evidence worker only** — exactly these four
table privileges:

```text
SELECT  on public.stage0_decisions
SELECT  on public.session_behavioural_features_v0_2
INSERT  on public.risk_observations_v0_1
UPDATE  on public.risk_observations_v0_1
```

**Must NOT include** (disallowed):

```text
DELETE, TRUNCATE, REFERENCES, TRIGGER on any of the above tables
table/schema ownership
SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS
broad schema-wide or all-tables grants
customer-output permissions
Lane/scoring runtime permissions beyond the four above
Gate4E / Gate4F authorization
```

`INSERT` + `UPDATE` (not `DELETE`) are sufficient for the worker's
`INSERT … ON CONFLICT DO UPDATE` upsert. No sequence privilege is listed here;
if the `risk_observations_v0_1` primary key uses a serial/identity sequence that
requires `USAGE`, that is a **single additional narrowly-scoped item** to confirm
during the proof (§7) and grant only if proven necessary — never a broad grant.

---

## 5. Relationship to `buyerrecon_scoring_worker` group role

Two options are compared; the plan does **not** assume Option A is correct.

| Option | Shape | Condition / risk |
| --- | --- | --- |
| **A. Dedicated LOGIN role as a member of `buyerrecon_scoring_worker`** | `buyerrecon_risk_worker` LOGIN, granted membership; inherits the group's privileges | **Only if** existing evidence proves the group's grants are **exactly** the intended four-privilege set and **not overbroad** (e.g. not also Lane/scoring-output writer privileges). The group is documented elsewhere as a future Lane A/B writer, so it **may be overbroad** for the risk worker. **Unproven → do not assume.** |
| **B. Dedicated LOGIN role with direct minimal table grants** *(safer default)* | `buyerrecon_risk_worker` LOGIN, granted only the four privileges in §4 directly | Least-privilege by construction; independent of group scope. **Recommended** unless/until Option A's exact-alignment is proven. |

**Recommendation:** prefer **Option B** (direct minimal grants) as the default,
because it is least-privilege by construction and does not depend on the group's
scope being exactly aligned. Option A is acceptable **only** if a read-only
diagnostic first proves `buyerrecon_scoring_worker` grants are exactly the four
privileges and carry no broader (e.g. Lane-writer) rights — a separate proof, not
assumed here.

---

## 6. Candidate future command-pack shape — **PLANNING ONLY — DO NOT RUN**

> **PLANNING ONLY — DO NOT RUN.** The SQL shapes below are **illustrative and
> non-executable** until separately reviewed and GO-gated. This PR does **not**
> run, stage, or authorize them. No password, DSN, host, port, or env value
> appears; `<hidden password>` is a **literal placeholder**, never a value, and
> any real password must be created/held in approved secret custody and **never**
> printed, echoed, committed, or pasted.

Candidate future actions (each requires its own separate scoped Helen GO):

```text
-- (Option B default) dedicated minimal LOGIN role + direct minimal grants
CREATE ROLE buyerrecon_risk_worker LOGIN PASSWORD '<hidden password>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

GRANT SELECT ON public.stage0_decisions                 TO buyerrecon_risk_worker;
GRANT SELECT ON public.session_behavioural_features_v0_2 TO buyerrecon_risk_worker;
GRANT INSERT, UPDATE ON public.risk_observations_v0_1    TO buyerrecon_risk_worker;

-- (Option A alternative, ONLY if group scope proven exactly aligned)
-- GRANT buyerrecon_scoring_worker TO buyerrecon_risk_worker;
```

DSN assembly (structure only; never values, never inspected here):

```text
postgresql://buyerrecon_risk_worker:<PASSWORD>@<HOST>:<PORT>/buyerrecon_production
```

`<PASSWORD>` / `<HOST>` / `<PORT>` are **literal placeholders** — assembled
outside repo/logs in approved custody, never printed. Registration of
`buyerrecon_risk_worker` in `.claude/constants.md` and/or the production runtime
registry is **separate reviewed planning** if/when the role becomes official.

---

## 7. Proof requirements after future role creation

A later read-only proof (its own scoped GO; booleans only; same proven local
admin path as PR #321) must confirm:

```text
buyerrecon_risk_worker_exists=true
buyerrecon_risk_worker_can_login=true
buyerrecon_risk_worker_is_superuser=false
buyerrecon_risk_worker_createdb=false
buyerrecon_risk_worker_createrole=false
buyerrecon_risk_worker_replication=false
buyerrecon_risk_worker_bypassrls=false
buyerrecon_risk_worker_stage0_decisions_select_privilege=true
buyerrecon_risk_worker_session_behavioural_features_select_privilege=true
buyerrecon_risk_worker_risk_observations_insert_privilege=true
buyerrecon_risk_worker_risk_observations_update_privilege=true
buyerrecon_risk_worker_risk_observations_delete_privilege=false   # disallowed, where checkable
buyerrecon_risk_worker_is_member_of_buyerrecon_scoring_worker=true|false  # true only if Option A used
```

Proof constraints: **no** DSN/password/host/port/env output; **no** raw row data;
**no** customer output; **no** worker execution; read-only transaction with
rollback; safe labels / booleans only.

---

## 8. Stop-lines

The future role-creation/proof work (and this plan) must stop if:

- the role name is ambiguous or unregistered-without-decision;
- `buyerrecon_risk_worker` already exists with **unexpected attributes**
  (e.g. superuser, or pre-existing broad grants);
- `buyerrecon_scoring_worker` group privileges are **overbroad or unknown** (then
  Option A is disallowed — fall back to Option B direct grants);
- the required four privileges **cannot be proven**;
- any **disallowed** privilege (§4) is present;
- any **secret / raw** output would be needed to proceed;
- any **customer-output / Gate4E / Gate4F / Lane / scoring** authorization is
  implied or requested;
- any command would require **DSN / password printing**.

On any stop-line: halt and record it; do not proceed to creation/grant.

---

## 9. Explicit non-authorization

This PR is **docs-only** and authorizes **none** of the following:

- It does **not** create the role.
- It does **not** set or rotate any password.
- It does **not** apply grants.
- It does **not** mutate the DB.
- It does **not** run SQL or psql.
- It does **not** run the PR #321 confirmation diagnostic.
- It does **not** run the PR #320 input-readiness proof.
- It does **not** run the risk worker.
- It does **not** run Stage0 or Step2E.
- It does **not** run Lane/scoring.
- It does **not** run AMS runtime.
- It does **not** produce customer output.
- It does **not** authorize Gate4E or Gate4F.

Role creation, password custody, grants, registration, and any proof each require
their **own** separate explicit scoped Helen GO.

---

## 10. Safety / Raw-Data Boundary

This record contains no secret value, raw password, password hash, generated
password, DSN URI, connection string, raw secret-manager payload, service-file
content, `.env.production` content/value, token, private key, IP address, host
value, port value, real URI, login source, **raw `pg_hba` lines**, raw
`accepted_events` payload, raw `canonical_jsonb`, real `session_id` /
`request_id` / user identifier, user-agent, header, body value, customer row
data, **raw psql output, raw PostgreSQL error text**, or env-var value. The SQL
shapes are **illustrative and non-executable**; `<hidden password>` /
`<PASSWORD>` / `<HOST>` / `<PORT>` are **literal placeholders**, never values. The
role names (`buyerrecon_risk_worker`, `buyerrecon_scoring_worker`,
`buyerrecon_app`, `buyerrecon_prod_collector_app`, `buyerrecon_stage0_runner`,
`postgres`), the table names (`stage0_decisions`,
`session_behavioural_features_v0_2`, `risk_observations_v0_1`), the database name
(`buyerrecon_production`), the module path, and the recorded commit hash are
**non-secret** database / repository / public-git identifiers. All values above
are safe labels / booleans / category tokens / non-secret identifiers / a public
git commit hash — not secret or row values. **This PR runs nothing.**

---

## 11. Next-step recommendation

After **review and merge** of this planning PR, the next action is a **separate
command-pack / GO PR** for creating `buyerrecon_risk_worker` (Option B direct
minimal grants by default), **not** execution. That work:

- requires its own explicit scoped Helen GO;
- creates the LOGIN role and applies **only** the four §4 privileges (Option A
  group membership only if the group's exact alignment is first proven);
- holds the password in approved secret custody — never printed/committed;
- is followed by the §7 read-only booleans-only proof;
- registers the role in `.claude/constants.md` / the production runtime registry
  as its own separate reviewed change once official.

Only once `buyerrecon_risk_worker` is created, proven least-privilege, and
registered may it be supplied as `RISK_WORKER_ROLE` to the PR #321 confirmation
diagnostic and then the PR #320 post-Stage0 input-readiness proof — **each under
its own separate scoped Helen GO**. Even then, a PASS only makes the
risk-evidence worker a candidate; it does not run the worker, and authorizes no
Lane/scoring, AMS runtime, customer output, Gate4E, or Gate4F.
