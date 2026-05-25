# Sprint 2 PR#18ae Supplement — ThinSDK Sprint 2 Option-Key Proof

## 1. Verdict

**Verdict:** `OPTION_KEY_PROVEN_DOCS_ONLY`

This PR-A document is a narrow PR#18ae supplement proving the exact ThinSDK Sprint 2 body-mode option key from canonical AMS source at commit `13d4900`.

It is docs-only. It does not execute Gate 4C, does not change website runtime config, does not deploy, and does not contact any production endpoint.

## 2. Scope and chain-of-custody

### 2.1 PR#18ac §6.2 mapping

This document preserves the existing PR#18ae through PR#18aj chain-of-custody:

| Readiness label | Existing BuyerRecon path | Status in this PR-A |
| --- | --- | --- |
| PR-A option-key proof | PR#18ae supplement / docs-side proof | This document only |
| PR-C staging/mock proof | Realises PR#18af Gate 2 staging fixture dry-run | Not performed |
| PR-B website config proposal | Partial PR#18ah Gate 4 PR B bundle deploy scope, `br-thinlayer-init.js` only, no deploy | Not prepared |
| PR-D Gate 4C readiness review | Pre-PR#18ai readiness artifact | Not prepared |

This PR#18ae supplement does not replace PR#18af, PR#18ag, PR#18ah, PR#18ai, or PR#18aj.

### 2.2 Correct future ordering

The safe future ordering remains:

1. PR-A — prove the exact ThinSDK option key from AMS source.
2. PR-C — prove body shape and `/collect` tolerance in staging/mock only.
3. PR-B — propose the website config patch after PR-C evidence exists.
4. PR-D — aggregate Gate 4C readiness evidence before any endpoint re-flip review.

PR-B must not be prepared before PR-C evidence exists.

## 3. Fact-source labels

| Label | Meaning |
| --- | --- |
| `[remote-verified]` | Verified directly from a remote read-only source during this PR-A inspection. |
| `[base-verified]` | Verified from the backend base branch or local worktree state during this PR-A inspection. |
| `[prior-inspection]` | Carried forward from previously reviewed BuyerRecon inspection records. |
| `[helen-asserted]` | Provided as current-state context in Helen's instruction for this run. |

## 4. Worktree topology and hygiene

### 4.1 Enumerated topology

`[base-verified]` Backend worktrees observed:

| Worktree | Branch / role | PR-A handling |
| --- | --- | --- |
| `/Users/admin/github/buyerrecon-backend` | Existing backend checkout with unrelated untracked root research reports | Not used for edits |
| `/Users/admin/github/buyerrecon-backend-pr18ad-clean` | PR#18ad clean worktree | Not modified |
| `/Users/admin/github/buyerrecon-backend-pr18ae-clean` | Earlier PR#18ae worktree | Not modified |
| `/Users/admin/github/buyerrecon-backend-pr18ae-canon` | Clean backend worktree based on `origin/sprint2-architecture-contracts-d4cc2bf` | Used for this docs-only PR-A branch |

`[prior-inspection]` Website worktrees observed:

| Worktree | Branch / role | PR-A handling |
| --- | --- | --- |
| `/Users/admin/github/buyerrecon-website` | Existing website checkout | Not modified |
| `/Users/admin/github/buyerrecon-website-gate4c-planning` | Prior Gate 4C planning branch/worktree | Not modified |

`[prior-inspection]` AMS local clones observed:

| Worktree | Branch / role | PR-A handling |
| --- | --- | --- |
| `/Users/admin/github/keigentechnologies/AMS` / `/Users/admin/github/keigentechnologies/ams` | Local AMS main clone with dirty unrelated WIP | Not modified |
| `/Users/admin/github/keigentechnologies/ams-pra1` | Existing AMS side worktree | Not modified |

### 4.2 Hygiene rule

No stale or dirty AMS local clone was used as authority. AMS source was inspected through read-only GitHub API calls at immutable commit `13d4900`.

After Gate 4C readiness documents merge, all affected worktrees should fast-forward from the authoritative remote before further dependent work begins.

## 5. Current-state facts carried forward

| Fact | Source |
| --- | --- |
| Backend PR #70 / PR#18ae canonicality correction is merged. | `[helen-asserted]` |
| Backend PR #68 / PR#19d governance handoff is merged. | `[helen-asserted]` |
| Website PR #2 Gate 4C config/artifact planning is merged into `production-live-20260508`. | `[helen-asserted]` |
| AMS source reconciliation is closed; GitHub `origin/main` already contains Sprint 2 ThinSDK envelope source at PR#17v / commit `13d4900`. | `[helen-asserted]`, `[remote-verified]` |
| Website `production-live-20260508` already carries Sprint2-capable `thinlayer/thin-sdk.iife.js` artifact hash `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`. | `[helen-asserted]`, `[prior-inspection]` |
| Website `thinlayer/br-thinlayer-init.js` remains legacy hash `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`. | `[helen-asserted]`, `[prior-inspection]` |
| Current website init endpoint remains `https://buyerrecon-backend.onrender.com/collect`. | `[helen-asserted]`, `[prior-inspection]` |
| No website `mode` or `bodyMode` key is currently set, so the SDK defaults to `legacy_array`. | `[helen-asserted]`, `[remote-verified]` |
| Gate 4C is not executed and production `/v1/event` is not activated. | `[helen-asserted]` |

## 6. AMS source discovery

### 6.1 Discovery command

`[remote-verified]` AMS paths at commit `13d4900` were discovered without using or modifying the dirty local AMS clone:

```bash
gh api -H 'Accept: application/vnd.github+json' \
  '/repos/KeigenTechnologies/ams/git/trees/13d4900?recursive=1' \
  --jq '.tree[] | select(.path | test("thin.*thin-sdk.*src|sprint2|transport|types|index")) | .path'
```

### 6.2 Relevant paths found

`[remote-verified]` The relevant AMS paths found at `13d4900` are:

- `thin/packages/thin-sdk/src/index.ts`
- `thin/packages/thin-sdk/src/types.ts`
- `thin/packages/thin-sdk/src/collector.ts`
- `thin/packages/thin-sdk/src/transport.ts`
- `thin/packages/thin-sdk/src/sprint2-envelope.ts`
- `thin/tests/unit/sprint2-envelope.test.ts`
- `thin/docs/pr17v-sprint2-option-a.md`

Only these commit-pinned source files and tests were used for the option-key proof.

## 7. Exact option-key conclusion

### 7.1 Result

`[remote-verified]` The exact ThinSDK Sprint 2 body-mode option is:

```ts
transportOptions: {
  mode: 'sprint2_v1_event'
}
```

### 7.2 Classification

| Question | Answer |
| --- | --- |
| Exact key name | `mode` |
| Exact allowed Sprint 2 value | `sprint2_v1_event` |
| Location for `ThinSDK.init({...})` config | Nested under `transportOptions` |
| Top-level `mode` on `ThinSDKConfig`? | No |
| `bodyMode` key? | No |
| `transportBodyMode` key? | No |
| Default when omitted | `legacy_array` |
| Does this key itself change `endpointUrl`? | No |

### 7.3 Source references

`[remote-verified]` `thin/packages/thin-sdk/src/types.ts` at commit `13d4900` defines the body-mode type and the only config slot that carries it:

| File | Lines | Proof |
| --- | --- | --- |
| `thin/packages/thin-sdk/src/types.ts` | 201-202 | `TransportMode` is only `'mock'`, `'beacon'`, or `'fetch'`; it is transport selection, not body mode. |
| `thin/packages/thin-sdk/src/types.ts` | 204-217 | `TransportBodyMode` is `'legacy_array' \| 'sprint2_v1_event'`. |
| `thin/packages/thin-sdk/src/types.ts` | 225-235 | `TransportOptions` includes `mode?: TransportBodyMode`, defaulting to `legacy_array`. |
| `thin/packages/thin-sdk/src/types.ts` | 237-252 | `ThinSDKConfig` contains `transportOptions?: TransportOptions`; it does not contain a top-level Sprint 2 body-mode key. |

`[remote-verified]` `thin/packages/thin-sdk/src/collector.ts` at commit `13d4900` confirms how `ThinSDK.init(config)` passes the option:

| File | Lines | Proof |
| --- | --- | --- |
| `thin/packages/thin-sdk/src/collector.ts` | 87-98 | `config.endpointUrl` is passed separately to `createTransport(...)`, and `config.transportOptions` carries body-mode options. |

`[remote-verified]` `thin/packages/thin-sdk/src/transport.ts` at commit `13d4900` confirms the default:

| File | Lines | Proof |
| --- | --- | --- |
| `thin/packages/thin-sdk/src/transport.ts` | 100-113 | `FetchTransport` stores `endpointUrl` and sets `this.mode = options?.mode ?? 'legacy_array'`. |

## 8. Endpoint/body-mode independence

`[remote-verified]` Endpoint URL and body mode are independent configuration inputs in the source:

- `ThinSDKConfig.endpointUrl` is passed as a separate argument to `createTransport(...)`.
- `ThinSDKConfig.transportOptions` is passed separately and carries `mode`.
- `FetchTransport` stores `this.endpointUrl` and `this.mode` as separate fields.

This means selecting `transportOptions.mode = 'sprint2_v1_event'` does not itself re-point the endpoint URL.

However, this independence is not an execution approval. Future PR-D must decide the cutover path based on PR-C evidence because enabling Sprint 2 body mode while still pointed at legacy `/collect` may cause:

- silent acceptance with semantically wrong rows,
- silent rejection / HTTP 400 / zero telemetry,
- mixed-mode debugging confusion.

## 9. Payload-shape proof

### 9.1 Sprint 2 mode shape

`[remote-verified]` `FetchTransport.flush()` in `thin/packages/thin-sdk/src/transport.ts` at commit `13d4900` implements Sprint 2 mode as:

| File | Lines | Proof |
| --- | --- | --- |
| `thin/packages/thin-sdk/src/transport.ts` | 123-145 | In `sprint2_v1_event`, each queued event is converted with `toSprint2EventEnvelope(event)` and posted as `JSON.stringify(envelope)`. |
| `thin/packages/thin-sdk/src/transport.ts` | 123-145 | The source comments and implementation show one POST per event, no top-level array, and no `{ events: [...] }` wrapper. |

### 9.2 Legacy mode shape

`[remote-verified]` The same file preserves legacy behavior when omitted or explicitly selected:

| File | Lines | Proof |
| --- | --- | --- |
| `thin/packages/thin-sdk/src/transport.ts` | 147-158 | Legacy mode posts `JSON.stringify(batch)`, which is a top-level array. |
| `thin/packages/thin-sdk/src/transport.ts` | 100-113 | Omitted mode defaults to `legacy_array`. |

### 9.3 Required Sprint 2 fields

`[remote-verified]` `thin/packages/thin-sdk/src/sprint2-envelope.ts` at commit `13d4900` defines the Sprint 2 envelope fields:

| File | Lines | Required field proof |
| --- | --- | --- |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 95-114 | Interface includes `event_name`. |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 95-114 | Interface includes `schema_key`. |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 95-114 | Interface includes `schema_version`. |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 95-114 | Interface includes `client_event_id`. |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 95-114 | Interface includes `event_type`. |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 95-114 | Interface includes `event_origin`. |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 95-114 | Interface includes `occurred_at`. |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 95-114 | Interface includes `session_id`. |
| `thin/packages/thin-sdk/src/sprint2-envelope.ts` | 132-163 | `toSprint2EventEnvelope(...)` populates the required fields. |

## 10. FetchTransport behavior

`[remote-verified]` `FetchTransport` uses fetch semantics needed for the future PR-C proof:

| File | Lines | Proof |
| --- | --- | --- |
| `thin/packages/thin-sdk/src/transport.ts` | 123-145 | Sprint 2 mode posts with `method: 'POST'`. |
| `thin/packages/thin-sdk/src/transport.ts` | 123-145 | Sprint 2 mode sets `Content-Type: application/json`. |
| `thin/packages/thin-sdk/src/transport.ts` | 123-145 | Sprint 2 mode sets `keepalive: true`. |
| `thin/packages/thin-sdk/src/transport.ts` | 147-158 | Legacy mode also uses `Content-Type: application/json` and `keepalive: true`. |

`[remote-verified]` `thin/tests/unit/sprint2-envelope.test.ts` at commit `13d4900` backs this source interpretation:

| Test file | Lines | Coverage |
| --- | --- | --- |
| `thin/tests/unit/sprint2-envelope.test.ts` | 242-257 | Sprint 2 mode emits a single top-level object rather than an array. |
| `thin/tests/unit/sprint2-envelope.test.ts` | 259-279 | Sprint 2 mode emits one POST per event and no `{ events: [...] }` wrapper. |
| `thin/tests/unit/sprint2-envelope.test.ts` | 281-297 | Sprint 2 mode uses `Content-Type: application/json` and `keepalive: true`. |
| `thin/tests/unit/sprint2-envelope.test.ts` | 299-320 | Sprint 2 mode body contains all eight required fields. |
| `thin/tests/unit/sprint2-envelope.test.ts` | 393-405 | Default mode preserves top-level array behavior for legacy `/collect`. |
| `thin/tests/unit/sprint2-envelope.test.ts` | 408-418 | Explicit `legacy_array` mode emits a top-level array. |

## 11. Future PR-C staging/mock proof requirements

PR-C must come before PR-B. PR-C must prove body shape and endpoint tolerance without production traffic.

### 11.1 Required distinction

Future PR-C must distinguish:

| Signal | Meaning | Gate 4C readiness value |
| --- | --- | --- |
| `mock_validator_pass` | Local mock or validator accepted the body shape | Necessary but not sufficient |
| `staging_collector_pass` | True staging Sprint 2 collector accepted the body | Required before body shape can qualify as Gate 4C-ready |

### 11.2 Required PR-C evidence

Future PR-C evidence should include:

- `transportOptions.mode = 'sprint2_v1_event'` emits one JSON object per event.
- Emitted body is not a top-level array.
- Emitted body is not `{ events: [...] }`.
- Emitted body includes all eight Sprint 2 required fields.
- Configured `fetch` path uses `Content-Type: application/json`.
- A staging/mock legacy `/collect` tolerance check is performed without contacting production `/collect`.
- A staging `/v1/event` acceptance check is performed without contacting production `/v1/event`.
- The evidence supports a future PR-D decision between mode-first and mode+endpoint-together.

## 12. Future PR-B / PR#18ah rollback notes

Rollback is not operationally applicable to this PR-A because it is docs-only.

For future PR-B / PR#18ah, rollback planning must include:

- git-level one-file revert restoring website init hash `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`,
- on-host PR#18z rollback bundle/procedure references:
  - `/root/buyerrecon-rollback/`,
  - `buyerrecon-gate4b-rollback-20260524T115806Z/`,
  - `ROLLBACK-PROCEDURE.md`.

PR-B itself must not deploy.

## 13. Future PR-D carry-forward requirements

Future PR-D readiness review must carry the PR#17s / PR#18w 26-row baseline forward:

- do not delete those 26 rows,
- do not mutate those 26 rows,
- do not annotate those 26 rows,
- do not normalise those 26 rows,
- measure canary success as a delta from the 26-row baseline, not as an absolute count,
- preserve `request_body_invalid_json_observed_post_flip` as a stop-line,
- explicitly restate non-deletion of the 26 rows.

Future PR-D must also restate that Gate 4C readiness does not activate by implication:

- PR#19b feature flags,
- PR#19c governance runtime,
- PR#19d internal-learning runtime,
- PR#20 external report customer surface,
- customer output,
- Lane writers,
- runtime scoring,
- AMS Trust runtime,
- Pass 1 runtime,
- Pass 2 runtime.

## 14. Gate 4D / 4E / 4F status

This sprint stops at Gate 4C readiness.

`[prior-inspection]` Existing documentation describes:

- Gate 4D as passive organic observation,
- Gate 4E as Track A / Playwright.

This PR-A does not plan or execute Gate 4D or Gate 4E.

`[prior-inspection]` Gate 4F is not defined as an approved gate in the current PR#18ae through PR#18aj path. Older planning text treats a possible Gate 4F or successor naming as unresolved. This PR-A does not invent or approve Gate 4F.

## 15. Boundaries and non-actions

This PR-A did not:

- modify AMS source,
- modify Helen's dirty local AMS WIP,
- modify website config,
- modify website artifacts,
- modify `thinlayer/br-thinlayer-init.js`,
- modify `thinlayer/thin-sdk.iife.js`,
- change `endpointUrl`,
- activate `/v1/event`,
- contact production `/collect`,
- contact production `/v1/event`,
- generate production traffic,
- run a canary,
- deploy,
- edit `/var/www`,
- change DNS,
- reload Nginx or systemd,
- change Render or Hetzner production services,
- mutate a production database,
- run a production migration,
- change grants, roles, tokens, or secrets,
- print secrets,
- output raw payloads, raw request IDs, raw session IDs, tokens, or DSNs,
- activate customer output,
- activate report auto-send,
- activate Lane A/B writers,
- activate runtime scoring,
- activate AMS Trust runtime,
- activate Pass 1 runtime,
- activate Pass 2 runtime,
- execute Gate 4C.

## 16. Commands run

### 16.1 Session and safety commands

```bash
command -v caffeinate || true
command -v tmux || true
command -v screen || true
caffeinate -dimsu
```

Result:

- `caffeinate` was available and used as a no-sleep guard for this local session.
- `tmux` was not available.
- `screen` was available.

### 16.2 Repository and worktree commands

```bash
pwd
git worktree list
git branch --show-current
git status --short --untracked-files=all
git fetch origin sprint2-architecture-contracts-d4cc2bf
git rev-parse origin/sprint2-architecture-contracts-d4cc2bf
git log --oneline -5 origin/sprint2-architecture-contracts-d4cc2bf
git switch -c buyerrecon-sprint2-pr18ae-thinsdk-option-key-proof origin/sprint2-architecture-contracts-d4cc2bf
```

### 16.3 AMS read-only source commands

```bash
gh api -H 'Accept: application/vnd.github+json' \
  '/repos/KeigenTechnologies/ams/git/trees/13d4900?recursive=1' \
  --jq '.tree[] | select(.path | test("thin.*thin-sdk.*src|sprint2|transport|types|index")) | .path'

gh api \
  '/repos/KeigenTechnologies/ams/contents/thin/packages/thin-sdk/src/types.ts?ref=13d4900'

gh api \
  '/repos/KeigenTechnologies/ams/contents/thin/packages/thin-sdk/src/collector.ts?ref=13d4900'

gh api \
  '/repos/KeigenTechnologies/ams/contents/thin/packages/thin-sdk/src/transport.ts?ref=13d4900'

gh api \
  '/repos/KeigenTechnologies/ams/contents/thin/packages/thin-sdk/src/sprint2-envelope.ts?ref=13d4900'

gh api \
  '/repos/KeigenTechnologies/ams/contents/thin/tests/unit/sprint2-envelope.test.ts?ref=13d4900'

gh api \
  '/repos/KeigenTechnologies/ams/contents/thin/docs/pr17v-sprint2-option-a.md?ref=13d4900'
```

The source inspection used read-only GitHub API access only.

## 17. Secret-safety posture

This document contains only negative-attestation prose for tokens and secrets. It contains no raw secret values, no bearer value, no DSN, and no production credential.
