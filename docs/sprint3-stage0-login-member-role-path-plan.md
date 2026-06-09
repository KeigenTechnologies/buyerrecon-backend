# Sprint 3 — Stage 0 Login / Member-Role Path Plan

**Status:** `STAGE0_LOGIN_MEMBER_ROLE_PATH_PLANNING_ONLY`

This is a **docs-only planning / diagnostic record**. It plans how Stage 0 can
execute **using the `buyerrecon_scoring_worker` privileges** (now proven
sufficient) **without changing role architecture ad hoc**, given that
`buyerrecon_scoring_worker` is `NOLOGIN`.

This PR **executes no SQL, changes no roles, and runs no Stage 0.** Any
membership/role change is **candidate-only** and gated behind a separate
command-pack + Codex review + explicit Helen GO.

> Provenance: PR #164 role resolution plan
> (`7ffff23088a1c5fe2e3845515d6f53c0a5948a49`); PR #165 scoring-worker preflight
> (`d0617b8b1b8fffbfa1c4799ee708f54db17705dc`); PR #166 read-source grant pack
> (`7b4e13c9bcb1e4c4de107887fd41a896d9604801`); PR #167 grant proof
> (`a0457d0dd55b10d358283792a6faa7e0a0dabe08`).

---

## 1. Title & Status

- Title: Stage 0 Login / Member-Role Path Plan.
- Status: `STAGE0_LOGIN_MEMBER_ROLE_PATH_PLANNING_ONLY`.
- Planning/diagnostic only; evaluates the login path; authorizes no role change
  and no execution.

---

## 2. Inputs / Prerequisite Chain

- **PR #164 — merged** (`7ffff23088a1c5fe2e3845515d6f53c0a5948a49`,
  `STAGE0_PRIVILEGE_ROLE_RESOLUTION_PLANNING_ONLY`): selected
  `buyerrecon_scoring_worker` as the intended Stage 0 role (Option B).
- **PR #165 — merged** (`d0617b8b1b8fffbfa1c4799ee708f54db17705dc`,
  `STAGE0_SCORING_WORKER_PREFLIGHT_BLOCKED_READ_SOURCE_SELECT_MISSING`):
  confirmed the role exists, NOLOGIN; `stage0_decisions` privileges already
  true; read-source SELECT missing.
- **PR #166 — merged** (`7b4e13c9bcb1e4c4de107887fd41a896d9604801`,
  `STAGE0_READ_SOURCE_SELECT_GRANT_COMMAND_PACK_REVIEW_ONLY`): minimal
  read-source SELECT grant command pack.
- **PR #167 — merged** (`a0457d0dd55b10d358283792a6faa7e0a0dabe08`,
  `STAGE0_READ_SOURCE_SELECT_GRANT_PROOF_PASS`): read-source SELECT grant applied
  and proofed; broad-privilege negative proof clean; role remains NOLOGIN.

---

## 3. Proven Privilege State (after PR #167)

For `buyerrecon_scoring_worker` (read-only proofs):
- `accepted_events SELECT=true`
- `ingest_requests SELECT=true`
- `stage0_decisions INSERT=true`, `UPDATE=true`, `SELECT=true`
- broad negative proof clean: no DELETE/TRUNCATE/REFERENCES/TRIGGER.

**The role now holds exactly the privileges Stage 0 needs.** The only remaining
gap is the **login path**.

---

## 4. Remaining Blocker: NOLOGIN / Login-Member Path

- `buyerrecon_scoring_worker` is a **NOLOGIN group role** — it **cannot be used
  directly** as a `DATABASE_URL` login.
- The Stage 0 runner connects via `new pg.Pool({ connectionString: DATABASE_URL })`
  and runs as whatever login role the DSN resolves to (optionally `SET ROLE` to a
  group it is a member of). So a **login role that is a member of
  `buyerrecon_scoring_worker`** is required.
- **This is the open question:** which production login role (if any) is already
  a member of `buyerrecon_scoring_worker`? It must be **confirmed by a read-only
  role-membership diagnostic**, not assumed.

---

## 5. Role Architecture Evidence (repo-grounded, read-only review)

- **`docs/ops/pr3-db-role-setup-staging.md`** — the four canonical roles
  (`buyerrecon_migrator`, `buyerrecon_scoring_worker`, `buyerrecon_customer_api`,
  `buyerrecon_internal_readonly`) are **NOLOGIN group roles**; login is delegated
  to whichever **login role is granted membership**. For **staging only**, the
  recommended mapping grants `buyerrecon_migrator` + `buyerrecon_scoring_worker`
  membership to the existing login role `buyerrecon_app` (operator-confirmed,
  **staging-only**).
- **Production differs from staging:**
  - The production app/extractor login role is **`buyerrecon_prod_collector_app`**
    (the behavioural saga ran as this role), **not** `buyerrecon_app`.
  - PR#18u proof: production has **all five expected roles**;
    `buyerrecon_prod_collector_app` is **LOGIN-capable**, but the operator **does
    not hold its password**.
  - Helen's PR#18v decision: **"Do not reset `buyerrecon_prod_collector_app`. Do
    not use `buyerrecon_migrator` for audit. Create a dedicated production
    read-only audit/login role."** → the production posture prefers **dedicated
    least-privilege login roles**, not reusing/resetting existing ones.
- **No repo evidence** establishes that any production login role is a **member
  of `buyerrecon_scoring_worker`**. **Do not assume the staging mapping
  (`buyerrecon_app` ← `buyerrecon_scoring_worker`) applies to production.**

---

## 6. Candidate Login / Member-Role Options

| Option | Description | Assessment |
|---|---|---|
| **A** | An existing **production login role is already a member** of `buyerrecon_scoring_worker` → run Stage 0 via it (optionally `SET ROLE`). | **Use only if proven** by a read-only role-membership diagnostic. No current repo evidence confirms this for production. |
| **B** | **Create / grant membership to a dedicated Stage 0 login role** (least-privilege; member of `buyerrecon_scoring_worker` only). | **Candidate** if Option A is unproven/absent. Mirrors the PR#18v "create a dedicated role" precedent. Requires a **separate command-pack + Codex review + explicit Helen GO** (it is a role change). |
| **C** | Run Stage 0 directly as `buyerrecon_scoring_worker`. | **Reject** — role is NOLOGIN; cannot login. |
| **D** | Run Stage 0 as `buyerrecon_prod_collector_app`. | **Reject** — the collector app role was explicitly rejected for Stage 0 (PR #164 Option A); operator does not hold its password; no evidence it is a member of `buyerrecon_scoring_worker`. |
| **E** | Run Stage 0 as `postgres` / superuser. | **Reject** — superuser must not be used for runtime workers; violates least-privilege. |

---

## 7. Recommended Next Diagnostic or Plan

**Recommend a read-only role-membership diagnostic first** (its own GO), to
decide between Option A and Option B with evidence:
- enumerate, read-only, the **login roles** (`rolcanlogin=true`) in
  `buyerrecon_production`;
- for each, check **membership in `buyerrecon_scoring_worker`**
  (`pg_auth_members` / `pg_has_role(login_role, 'buyerrecon_scoring_worker', 'MEMBER')`)
  — **role names / booleans only**, no passwords, no DSN, no secrets;
- confirm whether the candidate login role can reach the proven
  `buyerrecon_scoring_worker` privileges (directly or via `SET ROLE`).

Decision:
- **If a suitable existing login member is found (Option A):** record it in a
  read-only diagnostic evidence PR; proceed (under GO) toward Stage 0 execution
  using that login role — **no role change needed**.
- **If none is found (Option B):** create a **dedicated Stage 0 login role
  resolution command-pack PR** (candidate-only) for a minimal login role granted
  membership in `buyerrecon_scoring_worker` — reviewed and GO-gated before any
  role change.

This PR does **not** run that diagnostic; it plans it.

---

## 8. Future Command-Pack Requirements (only if a membership change is needed)

If Option B is chosen, the future role-change command pack must:
- be **docs-only / review-only** until executed under a separate explicit GO;
- propose the **minimal** change only — a dedicated login role that is a member
  of `buyerrecon_scoring_worker`, with **no** extra privileges, **no** superuser
  / createrole / createdb, **no** membership in other groups
  (migrator/customer_api/internal_readonly), and **no** reuse of
  `buyerrecon_prod_collector_app`;
- include read-only pre-change verification, the exact `CREATE ROLE … LOGIN` /
  `GRANT buyerrecon_scoring_worker TO <login_role>` candidate fenced
  `CANDIDATE ONLY — DO NOT RUN`, and a post-change proof (membership boolean +
  `rolcanlogin` + the inherited Stage 0 privileges; broad-negative proof);
- never print the role password / DSN / token; the password/secret handling
  follows the PR#18v posture (stored at restricted mode, never printed).

**No role change, `CREATE ROLE`, `ALTER ROLE`, or `GRANT role TO role` is
performed or authorized by this planning PR.**

---

## 9. Stop-Lines

- no Stage 0 execution;
- no role membership change by this PR;
- no `ALTER ROLE`;
- no `GRANT role TO role` by this PR;
- no SQL execution by this PR;
- no production command by this PR;
- no use of `postgres` / superuser for Stage 0 runtime;
- no reuse of `buyerrecon_prod_collector_app` for Stage 0 without reviewed
  evidence;
- no assumption that staging role mapping equals production;
- no secrets / DSN / password / token printed;
- no raw row values, raw identifiers, payload/customer data.

---

## 10. Explicit Non-Authorization

This PR is **docs-only / planning-only** and authorizes **none** of:
- no production command; no SQL; no role change; no GRANT / ALTER ROLE / DML /
  DDL; no permission fix;
- no Stage 0 execution; no extractor rerun;
- no risk worker / POI worker / evidence snapshot execution;
- no Lane A/B preview or writes; no scoring runtime; no AMS Trust/Pass runtime;
- no customer output; no Gate 4E / Gate 4F.

---

## 11. Next Step After This PR

1. **Codex review and merge** of this planning PR.
2. **Separate explicit GO** for a **read-only role-membership diagnostic**
   (login roles + `buyerrecon_scoring_worker` membership booleans only) →
   docs-only diagnostic evidence PR.
3. **If a login member exists (Option A):** proceed (under GO) to Stage 0
   execution gating using that login role — no role change.
4. **If none exists (Option B):** a **dedicated Stage 0 login-role command-pack
   PR** → Codex review → explicit Helen GO → one role change → post-change proof
   PR.
5. Only after the login path is **resolved and proofed** does a **separate
   explicit Stage 0 execution GO** become available → one manual Stage 0
   execution → docs-only Stage 0 execution evidence PR.
6. **No ad-hoc role change. Stage 0 execution remains unauthorized** until the
   chain completes.

---

## Safety / Raw-Data Boundary

This record contains no DSN URI, password, bearer token, AWS/OpenAI-style token,
raw UUID, IP address, hostname, raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` /
`request_id` value, user-agent value, or customer data. All identifier
references are role / relation / column / command names, SQL identifiers,
role-membership concepts, or stop-line / boundary language — not row values or
credential values. Any future DSN is parsed from `DATABASE_URL` only and never
printed.
