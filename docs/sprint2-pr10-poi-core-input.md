# Sprint 2 PR#10 — POI Core Input Contract — implementation

**Status.** Implementation complete. Pure TypeScript contract + tests
only. No DB, no migration, no schema change, no worker, no observer,
no customer-facing output. **Not committed. Not pushed.**

**Date.** 2026-05-13. **Owner.** Helen Chen, Keigen Technologies (UK)
Limited.

**Baseline.**

| Item | Value |
| --- | --- |
| Branch | `sprint2-architecture-contracts-d4cc2bf` |
| Parent (PR#9a planning) | `94a27af86aa7c721a90868b0336a288b652d6e1a` |
| AMS repo HEAD at impl | read-only reference (POI Core spec) |

**Authority.**

- `docs/sprint2-pr9a-poi-core-input-planning.md` (Helen-signed OD-1..OD-8)
- `docs/sprint2-pr7a-risk-core-bridge-contract.md` (precedent contract shape)
- `docs/sprint2-pr7b-risk-core-bridge-adapter` files (PR#7b adapter pattern)
- AMS shared-core priority: **Risk → POI → Series → Trust → Policy**

**Codex xhigh review state.** Initial review BLOCKED on three
hardening blockers. All three patched in this revision:

| # | Codex blocker | Patch |
| --- | --- | --- |
| 1 | Unsafe token-shaped path segments could become `poi_key` (e.g. `/reset/token/secret-value`, `/auth/bearer/abc`, percent-encoded equivalents). | `normalise.ts::normalisePagePath` now splits the normalised path into segments, percent-decodes each safely, and rejects when any segment matches a sensitive marker. Substring set (always reject): `token`, `session`, `bearer`, `secret`, `password`, `passwd`, `jwt`, `otp`, `api_key`, `apikey`, `access_token`, `refresh_token`, `token_hash`, `pepper`. Exact-segment set: `code`, `key`, `email`, `auth`, `reset`, `cookie`. Tests in Group P (20). |
| 2 | `poi_surface_class: string \| null` accepted arbitrary text (raw URLs, secrets, identity strings). | Replaced with a finite `PoiSurfaceClass` enum (14 dotted-namespace labels: `page.*` / `cta.*` / `form.*` / `offer.*` / `referrer.class`). `adapter.ts::validatePoiSurfaceClass` enforces the allowlist; anything outside it (including raw URLs, free-form labels with whitespace + secret words, identity strings) rejects. Tests in Group Q (13). |
| 3 | `evidence_refs` preserved arbitrary refs verbatim, including raw-ledger tables (`accepted_events`) and identity-shaped subkeys (`raw_payload`, `canonical_jsonb`, `token_hash`, nested `user_agent`, etc.). | `adapter.ts::validateEvidenceRefs` now requires every `.table` to be in `{'session_features', 'session_behavioural_features_v0_2', 'stage0_decisions'}`. Raw-ledger tables and `risk_observations_v0_1` (per OD-5 default) explicitly reject. A recursive `assertNoForbiddenEvidenceKeys` sweep rejects 24 forbidden keys at any nesting depth (`raw_payload`, `payload`, `canonical_jsonb`, `page_url`, `full_url`, `url_query`, `query`, `user_agent`, `ua`, `ip`, `ip_hash`, `token_hash`, `authorization`, `Authorization`, `bearer`, `auth`, `cookie`, `pepper`, `person_id`, `visitor_id`, `company_id`, `account_id`, `email`, `phone`). Tests in Group R (17). |
| 4 | `normalisePagePath` allowed email-shaped PII (`/welcome/person@example.com`, `/welcome/person%40example.com`, fully percent-encoded variants) to survive as `poi.poi_key`. | `normalise.ts::isPathSegmentSafe` now (1) rejects any decoded segment containing `@`, (2) tests an `EMAIL_LIKE_REGEX = /^[^/\s@]+@[^/\s@]+\.[^/\s@]+$/i` as defence-in-depth, and (3) rejects any raw segment that contains `%40` case-insensitively even before percent-decoding. Tests in Group S (13). Existing safe paths (`/pricing`, `/demo/request`, `/resources/buyer-intent`, `/code-of-conduct`, `/api-keys`) still pass. |

**Helen OD-1..OD-8 (PR#9a) applied to this implementation.**

| OD | Decision | How implemented |
| --- | --- | --- |
| **OD-1** | POI is the next shared primitive after Risk | This PR ships POI Core Input |
| **OD-2** | Option A — contract-only first | No DB, no migration, no worker, no observer |
| **OD-3** | Allowed POI v0.1 types: page_path / route / cta_id / form_id / offer_surface / referrer_class | `POI_TYPE` enum has exactly these six values |
| **OD-4** | UTM is **context only**, never a POI key | `POI_TYPES_ALLOWED` excludes `utm_*`; UTM fields live on `PoiContext` only |
| **OD-5** | POI **independent** from Risk by default | `PoiSourceTable` union = `'session_features' \| 'session_behavioural_features_v0_2'` — Risk is NOT a default source; adapter rejects `risk_observations_v0_1` |
| **OD-6** | Pure contract/adapter proof; mirror PR#7b cadence | Pure adapter throws on validation; tests mirror PR#7b structure |
| **OD-7** | Stage 0 may flow as eligibility/provenance only | `PoiStage0Context` flows into `eligibility.stage0_excluded` / `stage0_rule_id`; never into `poi.poi_key` or `normalized_risk_features` (no such field) |
| **OD-8** | First-seen-in-session distinction deferred | `provenance.first_seen_at` / `last_seen_at` carry timestamps verbatim; no `first_seen_in_session` boolean |

---

## §1 File inventory

**Created (7 new files):**

| Path | Lines | Purpose |
| --- | --- | --- |
| `src/scoring/poi-core/version.ts` | ~25 | `POI_CORE_INPUT_VERSION = 'poi-core-input-v0.1'` frozen literal |
| `src/scoring/poi-core/types.ts` | ~250 | `PoiType` enum, `PoiKey`, `PoiContext`, `PoiStage0Context`, `PoiSourceRow`, `BuildPoiCoreInputArgs`, `PoiCoreInput`, `PoiObservation`, frozen allowlist arrays |
| `src/scoring/poi-core/normalise.ts` | ~310 | `normalisePagePath`, `deriveRoutePattern`, `validateCtaId`, `validateFormId`, `classifyReferrer`, `classifyOfferSurface`, `normaliseUtmCampaignClass` |
| `src/scoring/poi-core/adapter.ts` | ~320 | Pure `buildPoiCoreInput(args)` — validates, normalises POI key per `poi_type`, assembles deep-frozen envelope |
| `src/scoring/poi-core/index.ts` | ~55 | Public re-exports |
| `tests/v1/poi-core.test.ts` | ~960 | 85 pure tests across groups A–O + auxiliary |
| `docs/sprint2-pr10-poi-core-input.md` | (this file) | Implementation report |

**Modified.** Zero tracked files modified. No `package.json`, no `schema.sql`, no migration, no existing source touched.

---

## §2 Contract summary

### §2.1 POI taxonomy

Six allowed POI types per OD-3:

```
POI_TYPE = {
  PAGE_PATH:      'page_path',
  ROUTE:          'route',
  CTA_ID:         'cta_id',
  FORM_ID:        'form_id',
  OFFER_SURFACE:  'offer_surface',
  REFERRER_CLASS: 'referrer_class',
}
```

**UTM is NOT a POI type** (OD-4). UTM values live in `PoiContext.utm_campaign_class` / `utm_source_class` / `utm_medium_class`, normalised via `normaliseUtmCampaignClass` to an allowlist-shaped string (`/^[a-z0-9._-]{1,64}$/`) or rejected as null.

### §2.2 Source-table allowlist (default, OD-5)

```
PoiSourceTable = 'session_features' | 'session_behavioural_features_v0_2'
```

`risk_observations_v0_1` is **NOT** in the default source allowlist (per OD-5). The adapter rejects with `source_row.source_table … not in the default allowlist (session_features / session_behavioural_features_v0_2). Risk-as-input requires explicit OD-5 opt-in.`

### §2.3 Adapter contract

```ts
buildPoiCoreInput(args: BuildPoiCoreInputArgs): PoiCoreInput
```

Pure function. Throws on validation error (mirrors PR#7b precedent). Returns a deep-frozen `PoiCoreInput` envelope on success.

`args` shape:

- `source_row: PoiSourceRow` — caller pulls this from PR#1+PR#2 SBF or PR#11 `session_features`
- `raw_surface: RawSurfaceObservation` — raw page/cta/form/offer/referrer signals to normalise
- `poi_type: PoiType` — one of the six allowed types
- `derived_at: string` — caller-supplied ISO-8601 timestamp; **never `Date.now()`**
- `scoring_version: string` — mirrors `scoring/version.yml.scoring_version`
- `poi_input_version: 'poi-core-input-v0.1'` — frozen literal
- `stage0?: PoiStage0Context` — optional eligibility/provenance side-channel
- `poi_context?: PoiContext` — optional UTM values (already normalised)

`PoiCoreInput` shape (closed type — see `types.ts` for the full TypeScript surface):

- `poi_input_version` (frozen)
- `workspace_id`, `site_id`, `session_id`
- `source_identity: { source_table, source_row_id }`
- `source_versions: { poi_input_version, scoring_version, behavioural_feature_version | null, stage0_version | null }`
- `poi: { poi_type, poi_key, poi_surface_class | null }`
- `poi_context: { utm_campaign_class, utm_source_class, utm_medium_class }` (all nullable)
- `evidence_refs: PoiEvidenceRef[]` (verbatim from source_row)
- `eligibility: { stage0_excluded, stage0_rule_id | null, poi_eligible }`
- `provenance: { source_event_count, record_only: true, derived_at, first_seen_at | null, last_seen_at | null }`

**Critical absences** (PR#9a §6 hard exclusions enforced by closed TypeScript shape + Group N static-source sweep):

- No `risk_index` / `verification_score` / `evidence_band` / `action_recommendation` / `reason_codes` / `reason_impacts` / `triggered_tags` / `penalty_total`.
- No `lane_a` / `lane_b` / `scoring_output_lane_a` / `scoring_output_lane_b`.
- No `trust_decision` / `policy_decision` / `final_decision`.
- No `customer_facing` / `verdict` / `report`.
- No `person_id` / `visitor_id` / `company_id` / `email_id` / `email_hash` / `device_fingerprint` / `ip_company` / `ip_org` / `is_real_buyer` / `buyer_id`.
- No `user_agent` / `ip_hash` / `token_hash` / `pepper` / `bearer` / `authorization` / `raw_payload` / `canonical_jsonb` / `page_url` (raw).

---

## §3 Normalisation summary

| Helper | Input | Output | Privacy rule |
| --- | --- | --- | --- |
| `normalisePagePath(raw)` | URL or path | normalised path or `null` | Strips scheme/host/query/fragment; lowercases; collapses duplicate slashes; normalises trailing slash; rejects whitespace + control chars; **(Codex blocker #1)** percent-decodes each segment + rejects any segment containing credential markers (`token` / `session` / `bearer` / `secret` / `password` / `jwt` / `otp` / `api_key` / `access_token` / `refresh_token` / `token_hash` / `pepper`) OR exactly matching ambiguous markers (`code` / `key` / `email` / `auth` / `reset` / `cookie`); **(Codex blocker #4)** rejects email-shaped PII via decoded-`@` check, `EMAIL_LIKE_REGEX` match, and raw-`%40` defence-in-depth check |
| `deriveRoutePattern(path, rules)` | normalised path + caller `RouteRule[]` | route pattern (e.g. `/users/:id`) or `null` | Caller-controlled collapse; adapter does not invent collapses |
| `validateCtaId(raw)` | candidate CTA ID | string or `null` | Allowlist `^cta_[a-z0-9_]{1,64}$` |
| `validateFormId(raw)` | candidate form ID | string or `null` | Allowlist `^form_[a-z0-9_]{1,64}$` |
| `classifyReferrer(raw)` | raw referrer URL or null | `ReferrerClass` enum | Reduces to coarse class; **never returns the raw URL** |
| `classifyOfferSurface(raw)` | offer-surface label or synonym | `OfferSurfaceClass` or `null` | Allowlist {demo, pricing, trust, footer}; synonyms accepted |
| `normaliseUtmCampaignClass(raw)` | raw UTM value | normalised string or `null` | Allowlist `/^[a-z0-9._-]{1,64}$/`; rejects email-shape, spaces, special chars |

---

## §4 Test results

```
> npx tsc --noEmit                                  → PASS (exit 0)
> npm run check:scoring-contracts                    → Scoring contracts check PASS
> npm test
  Test Files  42 passed (42)
       Tests  2380 passed (2380)        ← +148 vs. prior 2232 baseline
                                           (+13 over the prior blocker-patch revision)
   Duration  ~1.2s
> npm test -- tests/v1/poi-core.test.ts
  Test Files  1 passed (1)
       Tests  148 passed (148)          ← +63 across Groups P (20) + Q (13)
                                          + R (17) + S (13)
   Duration  248ms
> git diff --check                                  → clean (exit 0)
```

The **85 new PR#10 pure tests** cover all 11 PR#9a §9 test surfaces plus auxiliary boundary sweeps:

- **A. Normalised path / route key generation** (16 tests): strip scheme/host/query/fragment; lowercase; collapse duplicate slashes; trailing slash; preserves hyphens/dots/underscores; rejects empty/non-string/no-leading-slash; rejects whitespace/control chars; collapse rules; multiple rules ordered; null/empty inputs; malformed rules silently ignored.
- **B. Query string stripping** (5 tests): `?token=...`, `?email=...`, multi-param, fragment, path-only `?` defence-in-depth; envelope `poi_key` never contains `?` or `token`.
- **C. CTA / form ID allowlist** (5 tests): accepts canonical shapes; rejects upper-case / hyphen / wrong-prefix / raw text / empty / too-long; adapter rejects when poi_type+id mismatch.
- **D. Evidence refs required** (5 tests): rejects non-array, empty array, non-object entries, missing/empty `.table`; preserves verbatim.
- **E. No raw forbidden fields** (2 tests): envelope JSON contains no token/IP/UA/pepper/bearer/auth/raw_payload/canonical_jsonb/page_url/`?`; adapter doesn't inject forbidden fields.
- **F. No Lane A/B output** (2 tests): envelope shape has no `lane_a` / `lane_b` / `scoring_output_lane_a` / `scoring_output_lane_b`; no `INSERT INTO` in active source.
- **G. No Policy / Trust / Series imports** (4 tests): no imports from `src/scoring/policy`/`trust`/`series`/`lane` / `collector` / `app` / `server` / `auth` / `reason_code_dictionary` / `forbidden_codes` / `pg`.
- **H. No identity / enrichment fields** (2 tests): no person/visitor/company/email/IP-org/hashed-identity fields on envelope; no identity-style field declarations in source.
- **I. Stable natural key / determinism** (4 tests): same input → byte-stable; no `Date.now`; no `process.env`/`fetch`/`fs`/`pg`; natural-key tuple stable; different `poi_type` → different key.
- **J. Version mismatch** (4 tests): rejects mismatched `poi_input_version`, future version, empty `scoring_version`, empty `derived_at`.
- **K. Malformed POI type / disallowed source** (4 tests): rejects `utm_campaign_class` as poi_type; rejects `risk_observations_v0_1` as source; rejects empty IDs; rejects negative `source_event_count`.
- **L. Stage 0 carry-through** (5 tests): `excluded=true → poi_eligible=false`; `excluded=false → poi_eligible=true`; no stage0 → defaults; `rule_id` doesn't leak into POI/context; rejects malformed stage0 fields.
- **M. UTM context (OD-4)** (5 tests): no POI_TYPE entry is `utm_*`; UTM helpers normalise allowed shapes + reject identity-shaped; UTM flows into `poi_context` not into `poi.poi_key`; allowlist regex enforced; null UTM preserved.
- **N. Static-source boundary sweep** (4 tests): no RiskOutput field declarations; no ML / truth-claim substrings; no SQL DML/DDL; subtree forbidden-substring sweep.
- **O. Immutability** (3 tests): input not mutated; envelope arrays don't share identity with input; envelope deep-frozen at every level.
- **Auxiliary** (15 tests): `classifyReferrer` host mapping; `classifyOfferSurface` allowlist + synonyms; `POI_CORE_INPUT_VERSION` value; `POI_TYPES_ALLOWED` count; `OFFER_SURFACES_ALLOWED` count; all 6 `poi_type` build paths verified end-to-end.

---

## §5 Confirmations

- ✅ **PR#10 ships only allowed files.** 7 new files, zero tracked-file modifications. No `package.json` / `migrations/*` / `schema.sql` / `scoring/*.yml` / collector / app / server / auth / PR#6 worker / PR#7b adapter / PR#8b observer touched.
- ✅ **No DB / `psql`.** No DB connection opened. No migration created. The implementation is pure TypeScript.
- ✅ **Render production / Render DB untouched.** A0 P-4 still blocking. PR#10 is contract-only.
- ✅ **No customer-facing output.** No dashboards, no rendered text, no report renderer, no Lane A/B writer, no Policy / Trust / Series implementation.
- ✅ **No envelope persistence.** Adapter returns the envelope in memory; caller decides what to do with it (no persistence layer in PR#10).
- ✅ **No identity enrichment.** Type system + Group H + Group N tests enforce zero person/visitor/company/email/IP-org/hashed-identity fields.
- ✅ **Risk independent (OD-5).** `risk_observations_v0_1` is NOT a default POI source; adapter rejects it.
- ✅ **UTM is context only (OD-4).** `POI_TYPES_ALLOWED` does not contain `utm_*`; `PoiContext` carries UTM values separately.
- ✅ **Stage 0 carry-through (OD-7).** Stage 0 flows into `eligibility` only; `rule_id` does not leak into POI key or context.
- ✅ **Determinism.** No `Date.now()` anywhere in the adapter. `derived_at` is caller-injected. Same input → byte-stable envelope.
- ✅ **Codex xhigh review pending.** Awaiting Codex review before commit.

---

## §6 Next step

PR#11 (Helen-named, planning required) will be either:

- **POI Core observer** — read-only, mirrors PR#8b structure. Reads `session_features` / `session_behavioural_features_v0_2`, runs `buildPoiCoreInput` against each row, emits a JSON diagnostic report. No persistence. No customer output.

- **`poi_observations_v0_1` derived table + worker** — Option B from PR#9a §5.2. Requires Helen sign-off + new PR planning doc. Adds a migration + worker + observer in one PR; larger blast radius.

Recommendation per PR#9a §13: ship the POI Core observer first (lower risk), then revisit Option B based on observer findings.

---

## §7 What this implementation does NOT do

- Does **not** create a migration.
- Does **not** modify `schema.sql`.
- Does **not** modify `package.json`.
- Does **not** touch the DB or run `psql`.
- Does **not** touch `src/collector/v1/**`, `src/app.ts`, `src/server.ts`, `src/auth/**`.
- Does **not** modify PR#0–PR#9a implementation files.
- Does **not** amend `scoring/version.yml`, `reason_code_dictionary.yml`, or `forbidden_codes.yml`.
- Does **not** create customer-facing output.
- Does **not** create Policy / Trust / Series / Lane A/B / RiskOutput.
- Does **not** create a worker, observer, or CLI.
- Does **not** persist any envelope.
- Does **not** commit. Does **not** push.

Awaiting Codex review + Helen sign-off before commit.
