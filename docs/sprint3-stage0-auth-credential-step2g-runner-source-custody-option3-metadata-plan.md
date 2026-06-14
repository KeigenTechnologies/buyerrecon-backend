# Sprint 3 — Stage 0 auth/credential Step 2G — Runner-Source Custody Option 3: Deployment / Secret-Manager Metadata Existence Check Plan (Review-Only)

**Status:** `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_CUSTODY_OPTION3_METADATA_PLANNING_ONLY`

This is a **reviewable, docs-only planning record**. It plans **Option 3** — determining
whether an **approved `STAGE0_RUNNER_DSN` source exists via deployment-platform /
secret-manager metadata** — **without reading or printing any secret value** — after
Option 2 (PR #241) found the env name absent in the controlled shell (bounded to that
shell only, not global absence).

This PR **executes nothing** and **authorizes no Option 3 run / production command**: no
Option 3 run, no source-value printing, no `.env.production` value read/print, no DSN
parsing, no host/port/IP/user/password/URI/component output, no DB connection, no
`psql`/SQL, no env mutation, no runner DSN binding, no source-selection change, no
password reset/rotation, no Step 2E rerun, no Stage 0, no run-lock touch, no
runtime/downstream/Lane/scoring/AMS/customer action, **and no Option A/B selection**. No
real DSN, password, token, host, port, IP, or URI appears in this document.

> Provenance: PR #241 Step 2G runner-source custody Option 2 env-name missing evidence
> (`1c885d0e65e98cbb6f6a8f4628b82660fac6e115`,
> `STAGE0_AUTH_CREDENTIAL_STEP2G_RUNNER_SOURCE_CUSTODY_OPTION2_ENV_NAME_MISSING`); PR
> #240 runner-source custody resolution plan
> (`228a827d375eba6de81afb75beafd93dba6c4d4e`); PR #239 Option C proof rerun inconclusive
> (`05c81f3e77e3b865935c2618f1f811955813f610`).

---

## 1. Evidence Carried Forward (PR #239 / #240 / #241)

- **PR #239** — Option C proof rerun `inconclusive`: worker effective source remains
  structurally `DATABASE_URL` / `app_or_collector`; `STAGE0_RUNNER_DSN` documented as the
  intended runner source name; runner-source presence **not provable** without a runtime
  custody/source check.
- **PR #240** — runner-source custody resolution plan (Options 1–4 compared; none
  selected).
- **PR #241** — Option 2 controlled-shell env-name check:
  `approved_runner_source_present=false`, `approved_runner_source_category=missing`,
  `custody_resolution_result=runner_source_missing`,
  `stop_line=stage0_runner_dsn_env_name_not_present_in_controlled_shell` — **bounded to
  that controlled shell only; not global absence** across deployment metadata, secret
  manager, or other runtime injection paths.

**Bounded standing conclusion:** Option A/B remains **deferred**; Stage 0 remains
**blocked**. Option 3 tests **one further custody surface** (platform / secret-manager
**existence metadata**) — presence/existence only, never the value.

---

## 2. Objective

The future Option 3 check must prove **only** whether a secret/deployment key **named
`STAGE0_RUNNER_DSN` exists** in an approved custody / deployment source. It must:
- prove **no credential validity**;
- prove **no PostgreSQL authentication**;
- **expose no secret material**.

---

## 3. Option 3 Metadata-Check Design — CANDIDATE ONLY — DO NOT RUN

> Design contract for a **future, separately-reviewed, separately GO-gated** check —
> **not** executed here. It queries **existence metadata only** from an approved
> deployment platform / secret manager (e.g. "does a key named `STAGE0_RUNNER_DSN`
> exist?") and emits **only** the §5/§6 labels. It **never** retrieves, decrypts,
> prints, or parses the secret value.

- Use an **approved, least-privilege metadata/list capability** that returns
  **key existence only** (not the secret payload).
- Emit a **name-existence boolean** and a **source category label** (§4).
- **Fail closed** (record `unknown` / a stop-line) if establishing existence would
  require reading/parsing the secret, or if the metadata source is unavailable.
- Run **no** value retrieval, decryption, DSN parse, DB connection, env mutation, or
  binding.

---

## 4. Allowed Metadata

- **key/name existence boolean only** (does a key named `STAGE0_RUNNER_DSN` exist?);
- **source category label only**, e.g. `deployment_metadata`, `secret_manager`,
  `missing`, `unknown`;
- **timestamp / status labels** if safe (e.g. created/updated status that contains no
  secret material);
- **no values or DSN components.**

---

## 5. Forbidden Outputs

The future Option 3 check **must not** output:
- a raw value;
- a DSN URI;
- a username / password;
- a host / port / IP;
- a token;
- a secret-manager raw payload;
- `.env.production` content;
- any DSN component or parse result.

---

## 6. Safe Labels

### 6.1 Plan labels (this planning PR)
```text
custody_resolution_attempted=false
custody_resolution_option=option_3_deployment_secret_metadata
approved_runner_source_presence_target=STAGE0_RUNNER_DSN
deployment_metadata_check_planned=true
secret_value_access_allowed=false
dsn_parsing_allowed=false
db_connection_allowed=false
runner_dsn_binding_authorized=false
source_selection_change_authorized=false
option_a_selected=false
option_b_selected=false
stage0_executed=false
```

### 6.2 Future run result labels (for the Option 3 evidence PR, when separately GO-gated)
```text
approved_runner_source_present=true|false|unknown
approved_runner_source_category=stage0_runner|missing|unknown
custody_resolution_result=runner_source_present|runner_source_missing|inconclusive
stop_line=none|metadata_source_unavailable|secret_key_missing|raw_value_access_required|metadata_check_inconclusive
```

---

## 7. Stop-Lines

Abort (safe stop-line + non-zero exit; no value emitted/recorded) if any of:
- metadata access would **expose a value**;
- checking presence **requires reading/parsing the secret**
  (→ `stop_line=raw_value_access_required`, record `unknown`);
- the **platform / secret-manager access is unavailable**
  (→ `stop_line=metadata_source_unavailable`);
- any request to **bind or create a source**;
- any **Option A/B selection** request;
- any **Step 2E / Stage 0 / runtime** action.

If a stop-line is hit, withhold all secret/raw output, record the blocked/`unknown`
state in a docs-only evidence PR (safe labels only), and take no fix/retry without
separate review/GO.

---

## 8. Decision Mapping

From the future Option 3 result:
- **Key exists by metadata only** (`runner_source_present`) → later **Option A/B
  decision planning may proceed** (each separately reviewed + GO-gated).
- **Key missing by metadata** (`runner_source_missing`) → **source-creation / custody
  planning**.
- **Inconclusive** (`inconclusive`) → **refine the custody plan** or choose the **manual
  custody assertion path** (Option 1).
- **No path** authorizes remediation or Stage 0.

**No decision branch is executed by this PR.**

---

## 9. Safety Boundaries (this planning PR)

- **Docs-only planning only.** No Option 3 run.
- No source-value printing.
- No `.env.production` value read/print.
- No DSN parsing.
- No host/port/IP/user/password/URI/component output.
- No DB connection.
- No psql/SQL.
- No env mutation.
- No runner DSN binding.
- No source-selection change.
- No password reset/rotation.
- No Step 2E rerun.
- No Stage 0.
- No run-lock.
- No runtime/downstream/Lane/scoring/AMS/customer action.
- No Option A/B selection.

---

## 10. Non-Authorization

**Merging this plan authorizes:**
- **no** Option 3 run;
- **no** Option A/B selection;
- **no** source-creation/binding;
- **no** env mutation / runner DSN binding / source-selection change;
- **no** Step 2E rerun;
- **and no** Stage 0.

**The Option 3 metadata-existence check is a future, separately-reviewed, separately
GO-gated step** requiring its own Codex review and a fresh explicit Helen GO. **Stage 0
execution remains separately GO-gated.**

---

## 11. Next Gated Step

1. **Codex review and merge** of this planning PR.
2. **Fresh explicit Helen GO** for **one** Option 3 deployment / secret-manager
   metadata-existence check (existence-metadata only; no value/DSN-component access;
   §6.2 labels; fail closed to `unknown` if presence needs raw-value access or metadata
   is unavailable).
3. Docs-only **Option 3 evidence PR** (safe labels only).
4. **Per §8 mapping** → if present, Option A/B decision planning (separately reviewed +
   GO-gated); if missing, source-creation/custody planning; if inconclusive, refine or
   manual custody assertion (Option 1).
5. **Stage 0 execution remains separately GO-gated.**

---

## 12. Safety / Raw-Data Boundary

This record contains no DSN URI, connection string, raw password, `.env.production`
content/value, bearer token, AWS/OpenAI-style token, raw UUID, IP address (public or
local), IPv6 address, hostname, port value, URI, SSH banner, login source, host/network
detail, raw payload, secret-manager raw payload, `canonical_jsonb` payload,
`accepted_events` row data, raw behavioural row data, real `session_id` / `request_id`
value, user-agent value, raw SQL, raw psql output, raw PostgreSQL error text, or
customer data. This is a docs-only plan for a **future** existence-metadata check that
proves **key existence only** (by name/category), **never** retrieving/decrypting/
printing/parsing a value, making **no** DB connection, changing **no** runtime binding,
and **selecting no Option A/B**; if existence cannot be established without raw-value
access, the future check **fails closed to `unknown`**. (Per the PR #218 Codex note:
"no secret used or exposed" is to be read as "no secret value exposed, printed, or
recorded.") All values above are safe labels / booleans / category tokens / env-var
names / role / database names / public git commit hashes — not secret or row values.
