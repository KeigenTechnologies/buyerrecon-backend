# Sprint 2 PR#18ai — Pre-Gate 4C Readiness Review

## 1. Verdict

**Verdict:** `BLOCKED_PENDING_SAFE_STAGING_TARGET_AND_HELEN_GO`

This document is a pre-PR#18ai Gate 4C readiness review. It aggregates the current A → C → B implementation-readiness evidence and confirms that Gate 4C remains blocked.

No production execution occurred. No endpoint was flipped. No production collector endpoint was contacted.

## 2. Chain-of-custody mapping

This review preserves the PR#18ac §6.2 / PR#18ad compatibility chain.

| Readiness label | Existing BuyerRecon path | Current artifact | Current status |
| --- | --- | --- | --- |
| PR-A option-key proof | PR#18ae supplement / docs-side proof | Backend PR #71 | Open, docs-only, proves option key |
| PR-C staging/mock proof | Realises PR#18af Gate 2 staging fixture dry-run | Website PR #3 | Open, mock proof passed, staging blocked |
| PR-B website config proposal | Partial PR#18ah Gate 4 PR B bundle deploy scope, no deploy | Website PR #4 | Open, HOLD / DO NOT MERGE WITHOUT HELEN GO |
| PR-D readiness review | Pre-PR#18ai readiness artifact | This document | Open, blocked review |
| PR#18ai | Gate 4C endpointUrl re-flip / production cutover review | Not opened here | Not approved |
| PR#18aj | Passive organic observation | Not opened here | Not approved |

The required order is A → C → B → D. The path was not reordered as A → B → C.

## 3. Evidence summary

### 3.1 PR-A option-key proof

PR-A: `https://github.com/KeigenTechnologies/buyerrecon-backend/pull/71`

Commit: `aa19cf9`

Result:

- Exact body-mode key for `ThinSDK.init({...})`: `transportOptions.mode`.
- Exact Sprint 2 value: `sprint2_v1_event`.
- Not a top-level `mode` key on `ThinSDKConfig`.
- Not `bodyMode`.
- Not `transportBodyMode`.
- Default when omitted: `legacy_array`.
- `endpointUrl` and body mode are separate source-level inputs.
- `sprint2_v1_event` emits one JSON object per event.
- It avoids top-level array and `{ events: [...] }` wrapper.
- `FetchTransport` uses `Content-Type: application/json` and preserves `keepalive: true`.

### 3.2 PR-C mock/staging proof

PR-C: `https://github.com/KeigenTechnologies/KeigenTechnologies-buyerrecon-website/pull/3`

Commit: `49428a1`

Result:

- `mock_validator_pass = PASS`
- `staging_collector_pass = BLOCKED_PENDING_SAFE_STAGING_TARGET`
- `legacy_collect_tolerance = BLOCKED_PENDING_SAFE_STAGING_TARGET`

The PR-C harness runs locally against the website-repo `thinlayer/thin-sdk.iife.js` artifact and a mocked browser/fetch runtime. It proves the mock body shape but does not prove a true staging collector accepted the body.

Only `staging_collector_pass` can qualify the body as Gate 4C-ready. `mock_validator_pass` is useful and necessary, but not sufficient.

### 3.3 PR-B config proposal

PR-B: `https://github.com/KeigenTechnologies/KeigenTechnologies-buyerrecon-website/pull/4`

Commit: `4ed35c8`

Status:

- HOLD / DO NOT MERGE WITHOUT HELEN GO.
- One-file proposal only: `thinlayer/br-thinlayer-init.js`.
- Adds `transportOptions.mode = 'sprint2_v1_event'`.
- Keeps `endpointUrl` unchanged at legacy `/collect`.
- Does not change `thinlayer/thin-sdk.iife.js`.
- Does not rebuild or copy artifacts.
- Is not deployed.
- Is not production-active.

## 4. Current cutover decision

### 4.1 Mode-first path

**Decision:** not approved.

Mode-first means enabling `transportOptions.mode = 'sprint2_v1_event'` while leaving `endpointUrl` pointed at legacy `/collect`.

The current evidence is insufficient because real legacy `/collect` tolerance is not proven. The remaining risks are:

- silent acceptance with semantically wrong rows,
- silent rejection / HTTP 400 / zero telemetry,
- mixed-mode debugging confusion.

### 4.2 Combined mode+endpoint path

**Decision:** not approved.

Combined path means enabling Sprint 2 body mode and flipping `endpointUrl` to `/v1/event` under the same approved cutover sequence.

The current evidence is insufficient because no true staging Sprint 2 collector acceptance proof exists.

### 4.3 Required unblocker

Gate 4C readiness requires a safe non-production staging target or equivalent Helen-approved proof path that can produce:

`staging_collector_pass = PASS`

Until then, PR#18ai endpointUrl re-flip remains blocked.

## 5. Gate status map

| Gate / PR | Status |
| --- | --- |
| PR#18ae | Canonicality correction merged; PR-A supplement open as docs proof |
| PR#18af | Partially realised by PR-C mock proof; true staging collector pass remains blocked |
| PR#18ag | Not executed here; runtime privilege simulation remains separate |
| PR#18ah | PR-B proposal open as HOLD only; no deploy and no merge approval |
| PR#18ai | Not approved; endpointUrl re-flip / Gate 4C execution requires explicit Helen GO |
| PR#18aj | Not approved; passive organic observation remains separate |
| Gate 4D | Passive organic observation; out of scope here |
| Gate 4E | Track A / Playwright; out of scope here |
| Gate 4F | Undefined / unresolved; not invented or approved here |

## 6. PR#17s / PR#18w 26-row baseline

Future Gate 4C review must carry forward the PR#17s / PR#18w 26-row baseline:

- preserve the 26 historical production `/v1/event` rows,
- do not delete those rows,
- do not mutate those rows,
- do not annotate those rows,
- do not normalise those rows,
- measure canary success as a delta from the 26-row baseline, not as an absolute count,
- keep `request_body_invalid_json_observed_post_flip` as a stop-line,
- explicitly restate non-deletion of the 26 rows in the final cutover review.

This readiness review did not read, write, delete, annotate, normalise, or mutate those rows.

## 7. Inactive runtime lines

Gate 4C readiness does not activate any Sprint 4/5 or customer-surface runtime by implication.

The following remain inactive unless separately approved:

- PR#19b feature flags,
- PR#19c governance runtime,
- PR#19d internal-learning runtime,
- PR#20 external report customer surface,
- customer claims,
- customer visibility,
- dashboard customer output,
- sales claim upgrade,
- report auto-send,
- Lane A/B writers,
- runtime scoring,
- AMS Trust runtime,
- Pass 1 runtime,
- Pass 2 runtime.

## 8. Rollback posture

This PR-D is docs-only, so operational rollback is not applicable.

Future PR-B / PR#18ah rollback planning must include:

- git-level one-file revert restoring `thinlayer/br-thinlayer-init.js` hash `9b0e4530626be9a36bc56429c67e97d5ec4dbdf4b3bb7789486879abcc2efda0`,
- emergency `window.__BR_THIN_DISABLED`,
- on-host PR#18z rollback bundle/procedure:
  - `/root/buyerrecon-rollback/`,
  - `buyerrecon-gate4b-rollback-20260524T115806Z/`,
  - `ROLLBACK-PROCEDURE.md`.

PR-B itself must not deploy.

## 9. Stop-lines

Stop immediately if any later work attempts:

- production deploy,
- `/var/www` edit,
- endpointUrl flip on the live website,
- production `/collect` probe,
- production `/v1/event` probe,
- production traffic generation,
- canary traffic,
- DNS change,
- Nginx/systemd reload,
- Render/Hetzner production service change,
- production DB mutation,
- production migration,
- grants, roles, tokens, or secret changes,
- raw payload output,
- raw request ID output,
- raw session ID output,
- token or DSN output,
- customer output activation,
- report auto-send,
- Lane A/B writer activation,
- runtime scoring activation,
- AMS Trust runtime activation,
- Pass 1 runtime activation,
- Pass 2 runtime activation,
- Gate 4C execution,
- modification of Helen's dirty local AMS WIP.

## 10. Boundary statement

This readiness review did not:

- modify code,
- modify website runtime config,
- modify website artifacts,
- modify AMS source,
- modify Helen's dirty AMS WIP,
- deploy,
- edit `/var/www`,
- flip `endpointUrl`,
- activate `/v1/event`,
- contact production `/collect`,
- contact production `/v1/event`,
- generate production traffic,
- run a canary,
- mutate any database,
- change secrets, roles, grants, or tokens,
- activate customer output,
- activate Lane writers,
- activate runtime scoring,
- activate AMS Trust runtime,
- activate Pass 1 runtime,
- activate Pass 2 runtime,
- execute Gate 4C.

## 11. Validation inputs reviewed

Readiness inputs:

- PR-A backend option-key proof: PR #71.
- PR-C website mock proof: PR #3.
- PR-B website HOLD config proposal: PR #4.

Key validation results:

- PR-A proved the exact key is `transportOptions.mode`.
- PR-C local harness passed with `mock_validator_pass = PASS`.
- PR-C correctly blocked `staging_collector_pass`.
- PR-B touched only `thinlayer/br-thinlayer-init.js`.
- PR-B preserved `thinlayer/thin-sdk.iife.js` hash `048d1d23ff1c20b8189364f6e4ad61f9889e57fc4e0e114eb4bfd52ce79c9af7`.
- PR-B preserved legacy `/collect` endpoint.
- No production endpoint was contacted.

## 12. Next required action

The next unblocker is not production execution.

The next unblocker is a safe non-production staging collector target, or an explicit Helen-approved alternative proof path, that can test:

- Sprint 2 single-object body acceptance,
- `Content-Type: application/json`,
- expected eight fields,
- rejection-free collector path,
- legacy `/collect` tolerance if mode-first remains under consideration.

Until that proof exists, Gate 4C remains blocked.
