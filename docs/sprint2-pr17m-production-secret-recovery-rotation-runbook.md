# BuyerRecon Sprint 2 PR#17m — Production Secret Recovery / Rotation Runbook

Status: **docs-only operator runbook**. No code changes. No package changes. No migrations. No `schema.sql` changes. No `.env` file changes. No systemd changes. No DB commands executed. No `psql` execution. No `ALTER ROLE` execution. No token creation. No pepper generation. No service start / restart. No DNS / ThinLayer / Track A / Playwright / live traffic / customer-facing output.

Base branch: `sprint2-architecture-contracts-d4cc2bf` (latest known: `cfba53c` — PR#17l merged, "plan production collector deployment proof").

PR branch: `buyerrecon-sprint2-pr17m-production-secret-recovery-rotation-runbook`

---

## 1. Purpose

PR#17m provides the **operator-safe recovery / rotation path** for the three production app secrets that blocked PR#17l execution at the env-readiness gate:

- `DATABASE_URL`,
- `SITE_WRITE_TOKEN_PEPPER`,
- `IP_HASH_PEPPER`.

This PR is **docs-only**. It does not write `.env.production`, does not start any service, does not connect to any DB, does not generate or rotate any secret. It defines what the operator may do next — under explicit GO — to make the three values available so PR#17l can resume from the env-readiness gate.

PR#17m is the first step in a two-step path:

1. Recover or rotate the missing secrets per this runbook.
2. Return to PR#17l at the env-readiness gate; only then create / start the production systemd service and complete PR#17l's verification.

PR#17m itself stops at "secrets are present and validated"; the service start, health proof, DB-target proof, log scan, zero-traffic proof, and proof closure remain under PR#17l's runbook (under its existing Helen final-GO scope).

---

## 2. What this PR does not do

PR#17m explicitly does **not**:

- modify `.env.production`,
- modify any other `.env*` file,
- modify any systemd unit,
- execute any DB command (`psql`, `pg_dump`, `pg_isready`, etc.),
- execute any `ALTER ROLE`, `CREATE ROLE`, `DROP ROLE`,
- create, rotate, or recreate any `site_write_tokens` row,
- generate any new pepper (`SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`, `PROBE_ENCRYPTION_KEY`, or otherwise),
- start, stop, restart, enable, disable, mask, or unmask any systemd service (`buyerrecon-backend.service`, `buyerrecon-production-collector.service`, `buyerrecon-synthetic-proxy`, etc.),
- change DNS,
- cut any ThinLayer `endpointUrl`,
- run Track A,
- run Playwright,
- generate live or synthetic production traffic,
- enable any customer-facing automated output,
- broaden `buyerrecon_prod_collector_app` privileges (no DDL grant, no `createdb`, no `createrole`, no superuser, no DDL group membership),
- modify staging configuration in any way,
- touch the existing `buyerrecon-backend.service` (staging) on the production host.

All operator-runbook steps below are **future** steps the operator will perform under a separate, explicit Helen final-GO that names the recovery or rotation scope. PR#17m authoring performs none of them.

---

## 3. Operator must not paste secrets into chat

Throughout the recovery / rotation work, **no secret value crosses into shared surfaces**:

- **No raw passwords** (`<RECORDED_PROD_COLLECTOR_PASSWORD>` or otherwise) in chat, PR comments, terminal transcripts destined for sharing, logs, or this docs file.
- **No raw peppers** (`<PRODUCTION_SITE_WRITE_TOKEN_PEPPER>`, `<PRODUCTION_IP_HASH_PEPPER>`) in any shared surface.
- **No `DATABASE_URL`** (full or partial) — host, port, user, password, DB name combined together — in any shared surface. Categorical references only (`db_name = buyerrecon_production`, `db_user = buyerrecon_prod_collector_app`, host category).
- **No raw `site_write_tokens` rows, no `token_hash` values, no token prefixes, no token suffixes** in any shared surface.
- **No private IPs** in shared proof. (Internal records on the production host may carry them; what crosses into a shared artefact is masked or omitted.)
- **No certificate or private-key material.**
- **No vault file contents** beyond categorical descriptors (e.g. "vault entry present, length-N").

If a secret accidentally lands in a terminal transcript that is part of the shareable proof, the operator stops, redacts the artefact, rotates the leaked secret per the vault's procedure, and records the incident in the proof report (per §10).

---

## 4. Helen note — what is known about the secrets

**Carry forward (recorded in PR#17m, no values copied):**

- **`buyerrecon_prod_collector_app` password — Helen has a private record.** Helen reports that she set this password previously and retains it in her private secure record. PR#17m may proceed under Branch A (recovery) assuming this password is the one PR#17f's operator runbook used when provisioning `buyerrecon_prod_collector_app`. If it fails authentication during the future PR#17l env-readiness step, that is the trigger for Branch B's DB-password rotation sub-path (under separate explicit GO).
- **`SITE_WRITE_TOKEN_PEPPER` — no confirmed record.** Helen has no memory or evidence of the original production `SITE_WRITE_TOKEN_PEPPER` value. The production `site_write_tokens` rows (5 rows under `workspace_id = keigen_prod_ws`, per PR#17h) were created with HMAC-SHA256(raw_token, `SITE_WRITE_TOKEN_PEPPER`) — the pepper cannot be recovered from `token_hash`. If the original pepper is not located, the existing token hashes are effectively unusable; that triggers Branch B's pepper-rotation sub-path.
- **`IP_HASH_PEPPER` — no confirmed record.** Helen has no memory or evidence of the original production `IP_HASH_PEPPER` value. Because PR#17l execution proved zero-event posture (`ingest_requests = 0`, `accepted_events = 0`, `rejected_events = 0`, Lane A/B = 0), the operator may establish a new `IP_HASH_PEPPER` before any production event is ingested without breaking continuity of IP-hash semantics.

PR#17m records these facts categorically; it does not attempt to print, recover, or test the actual values.

---

## 5. PR#17l stop-line evidence

PR#17m carries the PR#17l stop-line evidence forward so the recovery path is anchored to a known state:

- **PR#17l merged at:** `cfba53c` (`Sprint 2 PR#17l: plan production collector deployment proof (#17)`).
- **PR#17l execution reached the env-readiness gate** (per PR#17l §8 / §10 step 4).
- **Server was synced to** `cfba53ce7e733c3d3b0f73404fb0fc7d2664b186` for execution.
- **Preflight passed:** `git status` clean, `git diff --check` PASS, `npm run check:scoring-contracts` PASS, `npx tsc --noEmit` PASS, `tests/db-client-skip-init.test.ts` 19/19 PASS.
- **Existing service on the host is staging-shaped:**
  - `buyerrecon-backend.service` active since `May 11`,
  - uses `/opt/buyerrecon-backend/.env`,
  - `NODE_ENV=staging`,
  - `PORT=3071`,
  - `DB=buyerrecon_staging`,
  - `SKIP_DB_INIT` not set there.
- **The operator did NOT modify or restart the staging service.** Staging remains untouched.
- **Proposed production service identity** (PR#17l Phase 1; not started under PR#17l execution):
  - `service_name = buyerrecon-production-collector.service`,
  - `env_file = /opt/buyerrecon-backend/.env.production`,
  - `port = 3073` (confirmed free),
  - `health_url = http://127.0.0.1:3073/health`,
  - other ports observed: `3071` (staging backend), `3072` (`buyerrecon-synthetic-proxy`).
- **A production env template was created manually with these safe fixed values:**
  - `NODE_ENV=production` ✅
  - `PORT=3073` ✅
  - `SKIP_DB_INIT=true` ✅
  - `ENABLE_V1_BATCH=true`
  - `ALLOW_CONSENT_STATE_SUMMARY=true`
  - `COLLECTOR_VERSION=buyerrecon-backend-sprint2-pr17l`
  - `ALLOWED_ORIGINS=https://buyerrecon.com,https://www.buyerrecon.com` ✅
- **Three values remained placeholders / unavailable:**
  - `DATABASE_URL` — FAIL (placeholder),
  - `SITE_WRITE_TOKEN_PEPPER` — FAIL (placeholder),
  - `IP_HASH_PEPPER` — FAIL (placeholder).
- **Safe env validation result on the production host (no secret values printed):**

  | Check | Result |
  |---|---|
  | `NODE_ENV_production` | PASS |
  | `PORT_3073` | PASS |
  | `SKIP_DB_INIT_exact_true` | PASS |
  | `DATABASE_URL_ready` | FAIL |
  | `SITE_WRITE_TOKEN_PEPPER_ready` | FAIL |
  | `IP_HASH_PEPPER_ready` | FAIL |
  | `ALLOWED_ORIGINS_ready` | PASS |
- **Secret discovery on the production host (no secret values printed) found:**
  - Only docs / source files plus `.env`, `.env.example`, `.env.production`, migrations / scripts / tests, and `/root/.bash_history` (which contained only "is this var set?" probes, no values),
  - `/root/.pgpass` was absent,
  - `.env.production` still had the three placeholders,
  - Helen's manual inspection of her records produced no production env values for the three missing categories (modulo §4 Helen note on the collector app password).
- **Service start was NOT performed.** PR#17l Phase 1 service start remains pending.

This is the stop-line. PR#17m's job is to clear it safely without printing any secret.

---

## 6. The three missing values — handling per category

PR#17m distinguishes the three categories because they have different recovery semantics.

### 6.A — `DATABASE_URL`

- **Composition (component form only — no full or partial DSN is reproduced in this doc):**
  - `db_user`: `buyerrecon_prod_collector_app`
  - `db_name`: `buyerrecon_production`
  - `host_category`: `local-postgres` (on `127.0.0.1`) **or** the approved production-Postgres host category
  - `port`: the approved production Postgres port (categorical reference only; not printed in the proof)
  - `password`: from Helen's private record (§4) — **never** printed, **never** in chat / PR / repo / proof, **never** quoted in this doc
  - the operator assembles the standard `postgresql://…` DSN locally from these components and writes it directly into `<PRODUCTION_ENV_FILE>` via the approved vault tool; the assembled DSN is never echoed to stdout, terminal transcripts, chat, or this doc

- **The password may be taken from Helen's private record** (§4). The recorded password value is **never** committed to the repo, pasted in chat, printed in logs, pasted into the proof report, or quoted in any shareable artefact. The operator places it directly into `<PRODUCTION_ENV_FILE>` (`/opt/buyerrecon-backend/.env.production`) at mode `0600`, root-owned, and **outside any git tree**.
- **Verification is categorical only:**
  - `db_name = buyerrecon_production`,
  - `db_user = buyerrecon_prod_collector_app`,
  - `host_category = local-postgres on 127.0.0.1` (or the approved production host category),
  - the full DSN is **never** printed.
- **If password authentication fails during the future PR#17l env-readiness step**, this is a §9 stop-line. The operator does **not** retry with a different password (no brute force), does **not** rotate the password on their own initiative, and does **not** broaden the role's privileges. Password rotation requires the Branch B sub-path with separate explicit Helen GO.

### 6.B — `SITE_WRITE_TOKEN_PEPPER`

- **Must match the pepper used when production `site_write_tokens` were originally created** (PR#17f / PR#17h). Per `migrations/006_site_write_tokens.sql`: `token_hash = HMAC-SHA256(raw_token, SITE_WRITE_TOKEN_PEPPER)` — the pepper cannot be recovered from `token_hash`.
- **Recovery (Branch A):** if Helen locates the original `SITE_WRITE_TOKEN_PEPPER` in her vault / secure record, the operator places it into `<PRODUCTION_ENV_FILE>` as above (mode 0600, never printed). Existing production `site_write_tokens` continue to work; categorical verification only.
- **Rotation (Branch B):** if Helen cannot locate the original pepper, the existing production `token_hash` values are effectively unusable (no way to validate any token submitted by ThinLayer once cutover happens, because the collector cannot rebuild the hash with an unknown pepper). The rotation sub-path:
  - generate a new `<PRODUCTION_SITE_WRITE_TOKEN_PEPPER>` securely (operator's local secure tool; not echoed to terminal),
  - record it in Helen's vault,
  - place it into `<PRODUCTION_ENV_FILE>` (mode 0600, never printed),
  - **recreate / replace the 5 production `site_write_tokens` rows** under the new pepper. This involves: generating 5 new raw tokens locally; computing each new `token_hash = HMAC-SHA256(new_raw_token, new_pepper)`; for each of the five sites, either deactivating the existing row (`disabled_at = now()`) and inserting a new row, or replacing in place. **PR#17m does not perform this work**; it is a future operator step under a separate explicit Helen GO.
  - Old token hashes generated under the unknown pepper are treated as **unusable**; they are not deleted (the rows can be left with `disabled_at` set for forensic continuity), and the new active rows take precedence for future validation.
- **Critical rule:** **token rotation must not be silently folded into PR#17l**. The cutover-time `ThinLayer` config will need the new raw tokens; that distribution step is also out of scope for PR#17m (it lives under PR#17d's canary cutover scope or its own dedicated rotation PR with Helen GO).

### 6.C — `IP_HASH_PEPPER`

- The `IP_HASH_PEPPER` is used by the collector / workers wherever IP hashing occurs.
- **Continuity rule:** changing the pepper after production rows containing IP hashes exist would break continuity of IP-hash semantics across the rotation boundary. Therefore the safe time to establish a new pepper is **before** any production event row exists.
- **PR#17l verified zero-event posture** prior to the stop-line (per §5 / per PR#17l Phase 1 step 12 verification — actually unreached, but the PR#17h-recorded baseline of `ingest_requests = 0`, `accepted_events = 0`, `rejected_events = 0`, Lane A/B = 0 is the carry-forward state).
- **Recovery (Branch A):** if Helen locates the original `IP_HASH_PEPPER`, place it into `<PRODUCTION_ENV_FILE>` (mode 0600, never printed). Categorical verification only.
- **Establishment (Branch B for `IP_HASH_PEPPER` only — distinct from rotation):** if no original value exists and the zero-event posture is re-confirmed before placement, the operator may **establish** a new `<PRODUCTION_IP_HASH_PEPPER>` securely (operator's local secure tool; not echoed to terminal), record it in Helen's vault, and place it into `<PRODUCTION_ENV_FILE>`. No production rows are affected because no production rows exist with IP-hash semantics yet.
- **PR#17m does not generate the pepper.** Generation is a future operator step under a separate explicit Helen GO.

---

## 7. Execution branches

PR#17m authoring does not execute either branch. The operator chooses one under a separate explicit Helen final-GO message; the GO message must name the branch explicitly.

### Branch A — Recovery (all three originals are available)

1. Helen supplies (privately, via the approved vault / secure channel — not in chat / PR / repo):
   - the recorded `buyerrecon_prod_collector_app` password,
   - the original `SITE_WRITE_TOKEN_PEPPER`,
   - the original `IP_HASH_PEPPER`.
2. Operator writes `<PRODUCTION_ENV_FILE>` = `/opt/buyerrecon-backend/.env.production` with **mode `0600`** and ownership `root:root` (or the deploy user per host practice). No secret value is echoed in terminal output destined for sharing.
3. Operator runs the §8 safe validation suite.
4. **If all categorical checks PASS**, the §5 stop-line is cleared. The operator returns to PR#17l at the env-readiness gate (PR#17l Phase 1, resuming at step 5: install / build artifact, then step 6: start production collector service, then steps 7–12).
5. **If any check FAILS**, do not start the service. Resolve the failing category (or escalate per §9) before resuming PR#17l.

### Branch B — Rotation (one or more originals are unavailable)

Branch B requires a **separate** explicit Helen final-GO message that names the rotation scope. The expected GO wording is recorded in §7.1. The operator does not perform any Branch B step under PR#17l's existing GO; PR#17l's existing GO does not cover rotation.

The Branch B sub-paths are independent and may run individually:

- **DB password — do not rotate** if Helen's recorded collector-app password works at the future PR#17l env-readiness step. Rotate only if password authentication fails. Rotation requires:
  - a separate explicit Helen GO authorising `ALTER ROLE buyerrecon_prod_collector_app PASSWORD <NEW_PASSWORD>` against `buyerrecon_production`;
  - the operator running `ALTER ROLE` under a migrator session (not under the collector role);
  - recording only categorical PASS / FAIL in the proof; the new password never appears in any shared artefact;
  - updating `<PRODUCTION_ENV_FILE>`'s `DATABASE_URL` accordingly.
- **`SITE_WRITE_TOKEN_PEPPER`** — generate / record a new pepper securely; place into `<PRODUCTION_ENV_FILE>`; recreate the 5 production `site_write_tokens` rows under the new pepper (per §6.B); distribute the new raw tokens via the approved secure channel (out of PR#17m scope). Old hashes become invalid.
- **`IP_HASH_PEPPER`** — establish a new pepper only after re-verifying zero-event posture (per §6.C and §8). Place into `<PRODUCTION_ENV_FILE>`. No row mutations.

After any Branch B sub-path completes, run the §8 safe validation. **Only when all categorical checks PASS does the operator return to PR#17l at the env-readiness gate.**

### 7.1 Expected Helen final-GO wordings

- **For Branch A (recovery) execution:**

  > "I approve executing PR#17m Branch A (recovery) now. Scope: place recovered `DATABASE_URL`, `SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER` into `<PRODUCTION_ENV_FILE>` (mode 0600) and run safe env validation only. No service start. No ThinLayer cutover. No DNS change. No Track A. No Playwright. No live customer / collector event traffic. No customer-facing output. No DB writes. No token rotation. No pepper generation. No secret values in chat or PR."

- **For Branch B sub-paths (rotation / establishment) execution:**

  > "I approve executing PR#17m Branch B sub-path <DB-password-rotation | site-write-token-pepper-rotation-and-token-recreate | ip-hash-pepper-establish> now. Scope: as defined in PR#17m §7 for the named sub-path only. No other Branch B sub-path. No service start. No ThinLayer cutover. No DNS change. No Track A. No Playwright. No live customer / collector event traffic. No customer-facing output. No secret values in chat or PR."

The operator does **not** broaden the GO scope; if the GO message diverges from the named sub-path, the operator stops and requests an explicit, scope-correct GO message.

---

## 8. Safe operator commands (placeholders only)

All commands below are **operator-runbook examples**. They are gated on the corresponding §7.1 explicit Helen final-GO message. No command in this doc contains real password, pepper, token, hash, prefix, suffix, private IP, certificate material, or DSN value.

### 8.1 Categorical env validator (Branch A and Branch B)

```
# Run on the production host AFTER <PRODUCTION_ENV_FILE> has been written
# via the approved vault path. Print only categorical PASS/FAIL, never values.

ENV=<PRODUCTION_ENV_FILE>

# Mode + ownership
ls -l "$ENV" | awk '{print $1, $3":"$4}'                            # expect: -rw------- root:root (or deploy-user)

# Fixed-value checks (no secret material is matched)
test "$(grep -c '^NODE_ENV=production$'       "$ENV")" -eq 1 && echo NODE_ENV_production: PASS       || echo NODE_ENV_production: FAIL
test "$(grep -c '^PORT=3073$'                 "$ENV")" -eq 1 && echo PORT_3073: PASS                 || echo PORT_3073: FAIL
test "$(grep -c '^SKIP_DB_INIT=true$'         "$ENV")" -eq 1 && echo SKIP_DB_INIT_exact_true: PASS   || echo SKIP_DB_INIT_exact_true: FAIL
test "$(grep -c '^ENABLE_V1_BATCH=true$'      "$ENV")" -eq 1 && echo ENABLE_V1_BATCH_true: PASS      || echo ENABLE_V1_BATCH_true: FAIL
grep -q '^ALLOWED_ORIGINS=https://buyerrecon\.com'    "$ENV" && echo ALLOWED_ORIGINS_ready: PASS     || echo ALLOWED_ORIGINS_ready: FAIL

# Presence-only checks for secret-bearing categories (NEVER print values)
grep -q '^DATABASE_URL=postgresql://'                 "$ENV" && echo DATABASE_URL_ready: PASS         || echo DATABASE_URL_ready: FAIL
grep -q '^SITE_WRITE_TOKEN_PEPPER=.\+$'               "$ENV" && echo SITE_WRITE_TOKEN_PEPPER_ready: PASS || echo SITE_WRITE_TOKEN_PEPPER_ready: FAIL
grep -q '^IP_HASH_PEPPER=.\+$'                        "$ENV" && echo IP_HASH_PEPPER_ready: PASS         || echo IP_HASH_PEPPER_ready: FAIL

# Length sanity (does NOT reveal value) — peppers expected to be 64-hex from existing operator practice
SWT_LEN=$(grep -E '^SITE_WRITE_TOKEN_PEPPER=' "$ENV" | sed -E 's/^[^=]+=//' | tr -d '\n' | wc -c)
test "$SWT_LEN" -ge 32 && echo SITE_WRITE_TOKEN_PEPPER_length_sane: PASS || echo SITE_WRITE_TOKEN_PEPPER_length_sane: FAIL
IPH_LEN=$(grep -E '^IP_HASH_PEPPER=' "$ENV" | sed -E 's/^[^=]+=//' | tr -d '\n' | wc -c)
test "$IPH_LEN" -ge 32 && echo IP_HASH_PEPPER_length_sane: PASS || echo IP_HASH_PEPPER_length_sane: FAIL

# Unresolved-placeholder check (Blocker-1 protection): FAIL if any angle-bracket
# placeholder remains anywhere in the file. -q ensures no matching line is
# printed; -E matches <…> patterns including the documented placeholders such
# as <PRODUCTION_…>, <RECORDED_…>, <…PASSWORD…>, <…PEPPER…>, <…TOKEN…>, and any
# other unresolved <…> token. The count (and only the count) is suppressed so
# no value or line context appears in shareable output.
if grep -qE '<[A-Za-z0-9_]+>' "$ENV"; then
  echo UNRESOLVED_PLACEHOLDERS_absent: FAIL
else
  echo UNRESOLVED_PLACEHOLDERS_absent: PASS
fi
```

This check is categorically required for the §11 handoff. If `UNRESOLVED_PLACEHOLDERS_absent: FAIL` is observed, the operator stops (§9) and resolves the placeholder before any return to PR#17l. The check must never print matching lines or values — only the literal `UNRESOLVED_PLACEHOLDERS_absent: PASS` or `… FAIL`. If the operator suspects a non-angle-bracket sentinel (e.g. `TODO`, `CHANGEME`, `XXX`), they may extend the pattern to `<[A-Za-z0-9_]+>|\b(TODO|CHANGEME|XXX|REPLACE_ME)\b` under the same "print only the categorical result" rule.

### 8.2 DB URL parse validator (categorical only)

```
# Parse DATABASE_URL locally without printing the full URL.
# Print only db_name, db_user, host_category.

DB_URL=$(grep -E '^DATABASE_URL=' "$ENV" | sed -E 's/^[^=]+=//')

DB_NAME=$(printf '%s\n' "$DB_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')
DB_USER=$(printf '%s\n' "$DB_URL" | sed -E 's|^postgresql://([^:]+):.*|\1|')
HOST=$(printf '%s\n' "$DB_URL"    | sed -E 's|^postgresql://[^@]+@([^:/]+).*|\1|')

# Categorical host category — never print the raw host token
case "$HOST" in
  127.0.0.1|localhost) HOST_CATEGORY="local-postgres" ;;
  10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[0-1].*) HOST_CATEGORY="approved-private-host (masked)" ;;
  *)                   HOST_CATEGORY="other (masked)" ;;
esac

test "$DB_NAME" = "buyerrecon_production"        && echo db_name_PASS    || echo db_name_FAIL
test "$DB_USER" = "buyerrecon_prod_collector_app" && echo db_user_PASS    || echo db_user_FAIL
echo "host_category=$HOST_CATEGORY"
unset DB_URL DB_NAME DB_USER HOST HOST_CATEGORY
```

### 8.3 Optional future `psql` auth test (no password printed)

```
# Only after Helen explicit GO. Uses PGPASSWORD only via environment;
# never echoed. -A -t -c produces a single short, secret-free line.
#
# This test exists in the runbook as an OPTIONAL future operator step.
# PR#17m does NOT execute it. PR#17l's env-readiness step will own this
# verification once secrets are placed.

PGPASSWORD="$(grep -E '^DATABASE_URL=' "$ENV" | sed -E 's|^[^@]*://[^:]+:([^@]+)@.*|\1|')" \
  psql "host=127.0.0.1 port=5432 dbname=buyerrecon_production user=buyerrecon_prod_collector_app sslmode=disable" \
  -A -t -c "select 1 as auth_ok;" >/tmp/_pr17m_auth.out 2>/tmp/_pr17m_auth.err

if grep -q '^1$' /tmp/_pr17m_auth.out; then
  echo db_auth_PASS
else
  echo db_auth_FAIL
fi
unset PGPASSWORD
shred -u /tmp/_pr17m_auth.out /tmp/_pr17m_auth.err 2>/dev/null || rm -f /tmp/_pr17m_auth.out /tmp/_pr17m_auth.err
```

### 8.4 Zero-event posture re-check (Branch B `IP_HASH_PEPPER` establishment precondition)

**Role rule (Blocker-2 fix).** The §8.4 zero-event check **must not** be run as `buyerrecon_prod_collector_app`. Per PR#17h §13 / PR#17f §10 / §11 grant boundaries, the production collector runtime role has:

- `INSERT` only on `accepted_events`, `rejected_events`,
- `INSERT` + `UPDATE` only on `ingest_requests` (no `SELECT`),
- **no** privilege at all on `scoring_output_lane_a` / `scoring_output_lane_b`.

A `SELECT count(*)` over those tables under the collector role will either be refused by Postgres or will tempt the operator into a privilege-broadening "fix". Both outcomes are forbidden.

Therefore §8.4 uses an **approved read-only / operator verification path** that is **distinct from** `buyerrecon_prod_collector_app`. The exact identity is supplied by the operator runbook (the migrator role used by PR#17f, or an explicitly-provisioned `<APPROVED_PRODUCTION_READONLY_VERIFICATION_DSN>` / `<PRODUCTION_OPERATOR_VERIFICATION_DSN>`); it must have `SELECT` (and only `SELECT`) on the event and Lane A/B tables it inspects.

Explicit rules:

- **Do not** use `buyerrecon_prod_collector_app` for §8.4 zero-event verification.
- **Do not** broaden `buyerrecon_prod_collector_app` privileges to make this command run under the collector role.
- **If no approved read-only / operator verification path is available**, Branch B `IP_HASH_PEPPER` establishment **remains blocked** until such a path is provisioned (under a separate explicitly-approved operator PR), even if everything else is ready.

```
# Only after Helen explicit GO for Branch B IP_HASH_PEPPER establishment.
# Verify production rows are still zero before establishing a new
# IP_HASH_PEPPER. Runs read-only under the approved verification path
# (NOT under buyerrecon_prod_collector_app).
#
# The DSN below comes from the approved operator vault and is never echoed:
#   <APPROVED_PRODUCTION_READONLY_VERIFICATION_DSN>
# It must connect as the approved verification role (e.g. the PR#17f migrator
# role, or a dedicated read-only operator role with SELECT on the surfaces
# below), against dbname=buyerrecon_production.

psql "<APPROVED_PRODUCTION_READONLY_VERIFICATION_DSN>" \
  -At -c "
    select
      (select count(*) from accepted_events)       as accepted_events,
      (select count(*) from rejected_events)       as rejected_events,
      (select count(*) from ingest_requests)       as ingest_requests,
      (select count(*) from scoring_output_lane_a) as lane_a,
      (select count(*) from scoring_output_lane_b) as lane_b;
  "
# Expected: 0|0|0|0|0 — record only the categorical PASS/FAIL.
# The DSN value is never printed; only the count tuple (or a PASS/FAIL summary
# derived from it) is recorded. No secrets enter shareable output.
```

### 8.5 `site_write_tokens` posture check (categorical only)

```
psql "host=127.0.0.1 port=5432 dbname=buyerrecon_production user=buyerrecon_prod_collector_app sslmode=disable" \
  -At -c "
    select
      count(*)                                         as token_count,
      count(*) filter (where disabled_at is null)      as active_count,
      count(*) filter (where last_used_at is not null) as used_count
    from site_write_tokens;
  "
# Expected for Branch A (recovery): 5|5|0.
# Branch B (pepper rotation) will change these counts after token recreate; record categorically.
```

### 8.6 No-secret log scan pattern (for any captured proof output)

```
# Forbidden-pattern scan over any captured shell output destined for proof.
grep -E '(postgres://|DATABASE_URL=|SITE_WRITE_TOKEN_PEPPER=[^|]+|IP_HASH_PEPPER=[^|]+|PROBE_ENCRYPTION_KEY=|password=|token=|Bearer\s+[A-Za-z0-9._-]{16,}|[a-f0-9]{64}|BEGIN (RSA |OPENSSH )?PRIVATE KEY|BEGIN CERTIFICATE|10\.[0-9]+\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' <CAPTURED_SAMPLE> \
  && { echo "BLOCKER: forbidden pattern in capture"; exit 1; } \
  || echo "secret_scan_PASS"
```

The `<CAPTURED_SAMPLE>` artefact stays on the operator's machine only; it does **not** enter the repo, the proof report, or chat.

---

## 9. Stop-the-line conditions

Stop and re-plan if any of the following appears at any point during authoring, review, or execution of PR#17m or its Branch A / Branch B sub-paths:

- **Any placeholder remains in `<PRODUCTION_ENV_FILE>`** after the recovery / rotation step (e.g. `<RECORDED_PROD_COLLECTOR_PASSWORD>`, `<PRODUCTION_SITE_WRITE_TOKEN_PEPPER>`, `<PRODUCTION_IP_HASH_PEPPER>`, or any unresolved `<…>`).
- **`DATABASE_URL` does not resolve to `buyerrecon_production`** (db_name parse check fails).
- **DB user is not `buyerrecon_prod_collector_app`** (db_user parse check fails).
- **`SKIP_DB_INIT` is not the exact literal lowercase `true`** in `<PRODUCTION_ENV_FILE>`.
- **`SITE_WRITE_TOKEN_PEPPER` is missing or unknown** while the existing 5 production `token_hash` values are expected to remain usable (i.e. someone is attempting to start the service with empty / new pepper while old hashes are still considered live).
- **`IP_HASH_PEPPER` is missing** at the point of service start.
- **Any secret is printed** to terminal output that lands in a shared proof / chat / PR / repo artefact (DSN, password, raw pepper, raw token, `token_hash`, prefix / suffix, private IP, certificate material, vault content).
- **Any non-zero production event rows are unexpectedly found** on `accepted_events` / `rejected_events` / `ingest_requests` / `scoring_output_lane_a` / `scoring_output_lane_b` before first live traffic. Investigate before continuing.
- **Any attempt to start the production service before env readiness passes** (i.e. before all §8.1 checks PASS) — service start is PR#17l's job, post-recovery.
- **Any request to use staging `.env` values** (`/opt/buyerrecon-backend/.env`, `NODE_ENV=staging`, `DB=buyerrecon_staging`, `PORT=3071`) for the production collector.
- **Any attempt to broaden `buyerrecon_prod_collector_app` privileges** as a workaround (DDL grant, `createdb`, `createrole`, superuser, DDL group membership).
- **Any attempt to fold token rotation silently into PR#17l** without a Branch B sub-path GO.
- **Any attempt to mutate the existing staging service** (`buyerrecon-backend.service`) — it remains untouched.
- **Operator uncertainty** about whether the runbook is proceeding sanely.

Stop-the-line means: do not continue, do not start any service, do not write to `.env.production`, do not run any DB command, and request a follow-up decision from Helen before any further action.

---

## 10. Proof report template

The proof report from PR#17m's recovery / rotation execution records the following categorical fields. **No raw secret values, no DSN, no full env-file contents, no token / hash / prefix / suffix, no private IP, no certificate material.**

- **PR#17m branch / head** — `buyerrecon-sprint2-pr17m-production-secret-recovery-rotation-runbook` at its merge commit.
- **Docs-only validation** — PR#17m authoring confirmed no code / package / migration / schema / env / systemd / DB / service changes.
- **Execution branch chosen** — Branch A (recovery) or Branch B (rotation; sub-path named).
- **Helen final-GO reference** — timestamp and location of the recorded GO message; the verbatim wording is recorded categorically without quoting any sensitive content.
- **Secret values never printed** — categorical PASS, with the §8.6 no-secret log scan result over the captured proof window.
- **Env-readiness checks** (per §8.1):
  - `NODE_ENV_production`: PASS,
  - `PORT_3073`: PASS,
  - `SKIP_DB_INIT_exact_true`: PASS,
  - `ENABLE_V1_BATCH_true`: PASS,
  - `ALLOWED_ORIGINS_ready`: PASS,
  - `DATABASE_URL_ready`: PASS,
  - `SITE_WRITE_TOKEN_PEPPER_ready`: PASS (+ length sanity PASS),
  - `IP_HASH_PEPPER_ready`: PASS (+ length sanity PASS),
  - `UNRESOLVED_PLACEHOLDERS_absent`: PASS (no `<…>` angle-bracket placeholder remains in `<PRODUCTION_ENV_FILE>`; the check prints only PASS / FAIL, never the matching line).
- **DB URL parse** (per §8.2) — `db_name_PASS`, `db_user_PASS`, `host_category` (categorical, masked).
- **`site_write_tokens` posture** (per §8.5) — token_count / active_count / used_count summarised categorically: "Branch A: 5 / 5 / 0" or "Branch B (pepper rotation): N rows recreated, all active, none used".
- **Zero-event posture** (per §8.4 if checked) — categorical PASS that `accepted_events`, `rejected_events`, `ingest_requests`, `scoring_output_lane_a`, `scoring_output_lane_b` remain 0.
- **Anomalies** — any non-PASS observation, with categorical description.
- **Decision** — "Return to PR#17l env-readiness gate" (if all PASS) **or** "Remain blocked" (if any FAIL; record reason categorically).

The proof report is committed as part of `PR#17m-proof` (or whichever successor PR records it) — not within PR#17m itself, since PR#17m authoring performs no execution.

---

## 11. Final handoff to PR#17l

- **PR#17m does not deploy.**
- **PR#17m provides the safe operator path** to resolve the three missing production app secrets (`DATABASE_URL`, `SITE_WRITE_TOKEN_PEPPER`, `IP_HASH_PEPPER`) that blocked PR#17l execution at the env-readiness gate.
- **Return to PR#17l requires all four of the following to hold simultaneously, with no exceptions:**
  1. **every §8.1 check PASS** (including `UNRESOLVED_PLACEHOLDERS_absent: PASS`, `DATABASE_URL_ready: PASS`, `SITE_WRITE_TOKEN_PEPPER_ready: PASS` + length sanity, `IP_HASH_PEPPER_ready: PASS` + length sanity, plus the fixed-value checks),
  2. **unresolved-placeholder check PASS** (no `<…>` angle-bracket placeholder remains anywhere in `<PRODUCTION_ENV_FILE>`),
  3. **§8.2 DB URL parse categorical checks PASS** (`db_name_PASS = buyerrecon_production`, `db_user_PASS = buyerrecon_prod_collector_app`, `host_category` is `local-postgres` or an approved-private-host category),
  4. **no secret values printed** during recovery / rotation (the §8.6 no-secret log-scan over any captured proof window returns `secret_scan_PASS`).
- **Only when all four conditions hold** does the operator return to **PR#17l Phase 1 service deployment** starting at PR#17l §10 step 5 (install / build production artifact) → step 6 (start the production collector service) → step 7 (verify service process) → step 8 (verify safe skip log: `Database schema bootstrap skipped by SKIP_DB_INIT=true`) → step 9 (log scan) → step 10 (health endpoint) → step 11 (DB target verification) → step 12 (zero-traffic verification).
- **If any of the four conditions FAILs**, do not return to PR#17l. The operator remains in the §5 stop-line, records the failing category in the §10 proof report ("Remain blocked"), and resolves it via the appropriate Branch A / Branch B sub-path (or escalates per §9) before any further attempt.
- **PR#17m does not modify PR#17l's runbook semantics** in any way. PR#17l's existing Helen final-GO scope continues to govern the subsequent service start; PR#17m only fills in the env material PR#17l depends on.
- **No other carry-forward changes**: staging service untouched; Render legacy untouched; no DNS change; no ThinLayer cutover; no Track A; no Playwright; no live traffic; no customer-facing output; no durable Lane A/B writers; no AMS runtime bridge; no AMS Trust Core exposure; no Pass 1 / Pass 2.

PR#17m authoring is complete. Execution of either Branch A or Branch B is a future operator step under a separate explicit Helen final-GO message scoped to the named branch.

---

End of PR#17m. **Docs only. No execution. No DB action. No service action. No secrets in this PR.**
