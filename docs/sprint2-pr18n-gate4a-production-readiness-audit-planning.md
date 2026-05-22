# Sprint 2 PR#18n: Gate 4A Production-Readiness Audit / Preflight Planning

## 1. Status / verdict

**Verdict: PLANNING ONLY — Gate 4A production-readiness audit / preflight planning.**

PR#18n defines the first Gate 4 sub-gate after PR#18m / PR #45. PR #45 is merged into `sprint2-architecture-contracts-d4cc2bf` at merge commit `05da2ec4bcd3da9ed30050e2ac6e93e5e9f13d60`, and `docs/sprint2-pr18m-gate4-production-activation-planning.md` is present on the base branch.

This PR does not execute Gate 4A. It creates a planning record for a future read-only production-readiness audit. That future audit requires its own explicit Helen GO and its own proof record.

Current status:

- Gate 2 controlled fixture acceptance: PASS / closed.
- Gate 3 staging replay acceptance: PASS / closed.
- Timing / Product Context observer: implemented and staging-proofed.
- Pass 1 output contract: `pass1-output-contract-v0.2`.
- Trust contract: `trust-contract-v0.1`.
- Pass 2 claim-governance contract: `pass2-claim-governance-contract-v0.1`.
- Lane governance contract: `lane-governance-contract-v0.1`.
- Gate 4: planned only.
- Gate 4 execution: not started.
- Production endpointUrl re-flip: not approved.
- Final scoring / governance recap PR: still required before any production-cutover readiness claim.

Hard status locks for PR#18n:

- No execution.
- No production activation.
- No endpointUrl re-flip.
- No buyerrecon.com production `/v1/event` traffic.
- No Render `/collect` replacement.
- No `/var/www` edit.
- No production traffic.
- No production DB mutation.
- No production token provisioning.
- No DB grant change.
- No Track A.
- No Playwright.
- No customer-facing output.
- No Lane A/B writer.
- No dashboard implementation.
- No AMS runtime bridge.
- No Pass 1 / Trust / Pass 2 runtime.
- No website ThinSDK production activation.
- No production artifact or config mode flip.

## 2. Why Gate 4A exists

PR#18m split Gate 4 into sub-gates so production activation does not collapse audit, artifact/config work, canary activation, organic observation, and Track A / Playwright into one approval.

Gate 4A is the first sub-gate. It is audit and preflight only. Its purpose is to confirm the current production, website, collector, and DB posture before any Gate 4B artifact/config bundle work or Gate 4C canary activation work.

Gate 4A reduces risk by making the current state explicit before any change is attempted. It should answer questions such as:

- What ThinLayer / ThinSDK artifact is currently present?
- What endpointUrl category is currently configured?
- Is Render legacy still the active rollback posture?
- Is the production collector posture understood?
- Is the production DB / role / grant posture still consistent with the safety model?
- Are scoring and governance contracts present while all customer-output locks remain closed?
- Are rollback artifacts available before any later work touches production configuration?

Gate 4A does not authorize any change. A Gate 4A PASS would mean only that the read-only audit found the current posture acceptable for the next separately gated planning or preflight step. It would not authorize Gate 4B, Gate 4C, Gate 4D, Gate 4E, production traffic, or endpointUrl re-flip.

Reference context for future Gate 4A execution:

- `docs/ops/cutover-hard-gates.md`.
- `docs/sprint2-pr18m-gate4-production-activation-planning.md`.
- `docs/sprint2-pr18l-lane-ab-output-governance-planning.md`.
- `docs/sprint2-pr18k-pass2-claim-governance-planning.md`.
- `docs/sprint2-pr18j-trust-contract-planning.md`.
- `docs/sprint2-pr18e-pass1-output-contract-planning.md`.
- `docs/sprint2-pr18c-timing-product-context-observer.md`.
- `docs/sprint2-pr17z-gate3-execution-proof.md`.
- `docs/sprint2-pr17u-host-thinlayer-hash-crosscheck.md`.
- `docs/sprint2-pr17p-buyerrecon-com-thinlayer-endpoint-proof.md`.
- `docs/sprint2-pr17m-production-secret-recovery-rotation-runbook.md`.

## 3. Gate 4A audit scope

Future Gate 4A execution may inspect only. It must not mutate files, databases, services, DNS, grants, tokens, website config, or customer-facing output.

### 3.1 Production / web posture

Future Gate 4A may inspect:

- Current buyerrecon.com ThinLayer / ThinSDK artifact state.
- Current endpointUrl state and category.
- Current Render `/collect` legacy state.
- Current `/var/www` file state and hash state.
- Current rollback / backup artifact posture.
- Current website artifact hash compared with the latest approved artifact record.
- Current production init mode category, including whether Sprint 2 mode is still inactive.

The audit must categorize targets without printing secrets or raw customer data. If the endpointUrl category is not clearly Render legacy, Sprint 2 production, or unknown, the future audit must stop and record the uncertainty.

### 3.2 Collector / API posture

Future Gate 4A may inspect:

- Production collector health endpoint category if a safe read-only method is explicitly approved for that audit.
- Current deployed backend commit or deployment category.
- Environment separation from staging.
- Whether live Sprint 2 production event traffic is absent, if that can be observed through a read-only, non-secret, categorical path.
- Whether any health check would be a non-event check and not a `/v1/event`, `/v1/batch`, or `/collect` write path.

If a proposed health check would create event traffic, touch customer traffic paths, or produce raw response bodies, it is not a Gate 4A-safe check and must stop.

### 3.3 Production DB / role posture

Future Gate 4A may inspect:

- Production DB existence category.
- Production role categories present.
- Approved operator access category.
- Lane A/B grant safety still intact.
- No direct customer API Lane access.
- No production mutation.
- No DB grants changed.
- No production token provisioning.

The audit may use only read-only, categorical verification in a future approved execution PR. It must not print database connection strings, secret values, raw identifiers, raw payloads, or raw log rows.

Lane grant posture expected from migration 016 and PR#18l:

- `buyerrecon_migrator`: the only role with ALL on `public.scoring_output_lane_a` and `public.scoring_output_lane_b`.
- `buyerrecon_internal_readonly`: SELECT only on both Lane tables and no DML.
- `buyerrecon_customer_api`: no access, no SELECT, and no DML on either Lane table.
- `buyerrecon_scoring_worker`: no SELECT, INSERT, UPDATE, or DELETE on either Lane table.
- PUBLIC: all access revoked on both Lane tables.

Any difference from this posture is a stop-line. PR#18n does not approve any grant amendment.

### 3.4 Governance posture

Future Gate 4A may inspect that the following governance contracts exist and remain planning/runtime-inactive:

- Pass 1 output contract v0.2.
- Trust contract v0.1.
- Pass 2 claim-governance contract v0.1.
- Lane governance contract v0.1.

The following locks must carry forward unchanged:

- `customer_claim_allowed=false`.
- `lane_output_allowed=false`.
- `customer_visibility_allowed=false`.
- `lane_write_allowed=false`.
- `allowed_customer_language=[]`.

Gate 4A does not lift any lock. Gate 4A does not run Pass 1, Trust, Pass 2, Lane governance, AMS Trust, AMS Policy, or any customer-facing surface.

## 4. Gate 4A audit evidence allowed

Future Gate 4A evidence must be categorical, read-only, and redacted. Allowed evidence types:

- File exists: yes/no.
- File hash or artifact hash.
- EndpointUrl category, not a secret value.
- Current target category: Render legacy, Sprint 2 production, or unknown.
- DB existence: yes/no.
- Role/grant category: yes/no.
- Lane count category or count, if obtained through a read-only and approved path.
- Health endpoint HTTP status class, if safe and separately approved for Gate 4A.
- No production event traffic observed: yes/no, if observable through an approved read-only categorical path.
- Rollback artifact exists: yes/no.
- Boundary affirmations.
- Cleanup category: yes/no, if any temporary local audit files are created during a future execution.

Evidence should state what was proven and what was not proven. A route or health check category is not event-capture proof. EndpointUrl state is not customer-output proof. Governance contract presence is not runtime scoring proof.

## 5. Gate 4A evidence forbidden

Future Gate 4A evidence must not include:

- Production token.
- Token hash value.
- Token prefix or suffix.
- Token length.
- Token row identifier.
- Pepper value.
- Database connection string.
- Authorization header value.
- Request identifier UUID.
- Raw payload.
- Raw response body.
- Full URL query strings.
- Customer data.
- Private-key material.
- Certificate body.
- Environment dump.
- Vault content.
- Shell history extract.
- Raw logs containing identifiers.
- Full session identifier.
- Full browser identifier.
- Raw static bundle contents unless the bundle is already a committed reviewed artifact and the future PR explicitly scopes that review.

If a future audit accidentally prints any forbidden evidence, it must stop immediately, redact the public record, and open a separate incident / remediation note before continuing.

## 6. Gate 4A stop-lines

Future Gate 4A execution must stop if any of the following is observed:

- endpointUrl already points to an unexpected Sprint 2 `/v1/event` target.
- buyerrecon.com production traffic is already hitting Sprint 2 unexpectedly.
- Render `/collect` replacement already happened without a recorded approval.
- `/var/www` has unexpected modified files or unknown hashes.
- Production DB connection string, token, or pepper handling looks unsafe.
- Raw secret printed.
- Production DB role/grant posture differs from the expected posture.
- Lane A/B rows or writer activity are found unexpectedly.
- Customer output exists.
- Track A or Playwright activity is detected.
- Rollback artifact is missing.
- Current host or path is uncertain.
- Website artifact hash does not match any approved source record and cannot be explained.
- Sprint 2 mode is active in production config without a recorded Gate 4C approval.
- Production collector deployment category is unknown.
- Any proposed check would create production event traffic.
- Any proposed check would mutate DB state, grants, files, DNS, service state, tokens, or customer output.
- Any operator is uncertain whether the target is production, staging, or local.

Stop-line handling must be fail-closed: record a categorical BLOCKED result and resolve the gap in a separate issue-fix PR before any later Gate 4 sub-gate proceeds.

## 7. Future Gate 4A execution runbook outline

This section is planning only. PR#18n does not run any step below. A future Gate 4A execution PR requires its own explicit Helen GO.

A future approved Gate 4A execution may include:

1. Branch and base sanity.
   - Confirm the execution branch and base.
   - Confirm PR#18m and PR#18n planning records are present.
   - Confirm working tree status before any audit command.

2. Read-only website artifact hash check.
   - Inspect the approved website artifact paths.
   - Capture file exists yes/no and hash category.
   - Do not copy production bundles into this repo.
   - Do not edit `/var/www`.

3. Read-only endpointUrl category check.
   - Categorize as Render legacy, Sprint 2 production, or unknown.
   - Do not flip endpointUrl.
   - Do not hit `/v1/event` or `/collect`.

4. Read-only rollback artifact check.
   - Confirm rollback artifact exists yes/no.
   - Confirm rollback source of truth category.
   - Do not restore or overwrite files.

5. Read-only production collector health category.
   - Only if the future Gate 4A approval names the safe method.
   - Prefer deployment metadata, host-local status, or an approved non-event health category.
   - Do not create event traffic.
   - Do not capture raw response bodies.

6. Read-only DB / role / grant category checks.
   - Confirm DB existence category.
   - Confirm role category and Lane grant posture category.
   - Do not mutate DB.
   - Do not provision tokens.
   - Do not change grants.
   - Do not print connection strings or secret material.

7. Lane A/B safety count / grant checks.
   - Confirm Lane A/B row category or count if read-only and approved.
   - Confirm customer API has no Lane access.
   - Confirm no Lane writer is active.

8. Production traffic category check.
   - Confirm no unexpected Sprint 2 production event traffic if this is observable through a read-only categorical path.
   - Do not generate synthetic or live traffic.
   - Do not use Track A or Playwright.

9. Governance lock affirmation.
   - Confirm Pass 1 / Trust / Pass 2 / Lane contracts remain locked.
   - Confirm no customer output and no Lane writer.

10. Proof doc creation.
    - Record categorical evidence only.
    - Record stop-lines if any.
    - Record what was proven and what was not proven.
    - Record cleanup categories.

## 8. Relationship to Gate 4B / 4C / 4D / 4E

Gate 4A must close before Gate 4B artifact/config bundle work proceeds.

Gate 4B remains a separate artifact/config bundle planning or check sub-gate. It may include a no-deploy bundle check if separately approved, but PR#18n does not approve any artifact write, website config change, production mode activation, or deployment.

Gate 4C controlled canary activation remains separately gated. It is the first sub-gate that could consider endpointUrl re-flip, and only under its own explicit Helen GO, rollback plan, stop-lines, and proof record. PR#18n does not approve Gate 4C.

Gate 4D organic observation remains separately gated. It cannot start from PR#18n and cannot be inferred from Gate 4A.

Gate 4E Track A / Playwright remains separate and later. No Track A or Playwright work is approved by Gate 4A planning.

Helen GO for Gate 4A does not imply Helen GO for Gate 4B, Gate 4C, Gate 4D, Gate 4E, production deployment, endpointUrl re-flip, runtime scoring, Lane writer, dashboard, or customer output.

## 9. Relationship to final scoring / governance recap PR

After Gate 4 implementation/preflight work and any issue-fix PRs, a final scoring / governance recap PR is required before any production-cutover readiness claim.

Gate 4A is one input to that recap. It is not the recap itself.

The final recap PR must carry forward:

- Gate 2 and Gate 3 proof status.
- Timing / Product Context observer status.
- Pass 1 v0.2 status.
- Trust v0.1 status.
- Pass 2 claim-governance v0.1 status.
- Lane governance v0.1 status.
- Migration 016 Lane grant safety status.
- Gate 4A / 4B / 4C / 4D outcomes, if any have executed by then.
- Remaining stop-lines, open issues, and rollback posture.
- Confirmation that customer-output locks are still closed unless a later PR explicitly and safely changes them.

No production-cutover readiness claim may rely on PR#18n alone.

## 10. Open decisions

- **OD-1: Exact production host(s) and paths to inspect.** Gate 4A must name the host and path categories before execution. If the operator cannot determine the target confidently, stop.
- **OD-2: Exact website artifact files and expected hashes.** Gate 4A must decide whether to compare only ThinSDK artifacts, init/config files, probes, adapter bundles, or a broader static-file set.
- **OD-3: EndpointUrl detection method.** Gate 4A must choose a read-only method that categorizes endpointUrl without making network write calls or printing raw config bodies.
- **OD-4: Production DB connection source category and operator access.** Gate 4A must define how the operator proves production DB category safely without printing connection strings.
- **OD-5: Role/grant verification method.** Gate 4A must define categorical read-only checks for role and Lane grant posture, including migration 016 invariants.
- **OD-6: Rollback artifact source of truth.** Gate 4A must decide which artifact, backup path, or deployment record proves rollback readiness.
- **OD-7: Whether collector health endpoint can be checked without creating production traffic.** If not, Gate 4A should rely on deployment metadata or omit the check.
- **OD-8: Whether Gate 4A should remain a manual operator runbook or later become a committed read-only script.** Any script would be a separate PR and must preserve no-secrets / no-mutation boundaries.

## 11. Non-goals

PR#18n explicitly excludes:

- No execution.
- No production activation.
- No endpointUrl re-flip.
- No production traffic.
- No `/var/www` edit.
- No Render `/collect` replacement.
- No DB mutation.
- No token provisioning.
- No grants.
- No migrations.
- No schema change.
- No Track A.
- No Playwright.
- No customer output.
- No Lane writer.
- No dashboard.
- No runtime scoring.
- No Pass 1 runtime.
- No Trust runtime.
- No Pass 2 runtime.
- No AMS runtime bridge.
- No website ThinSDK production activation.
- No production artifact or config mode flip.
- No Gate 4B execution.
- No Gate 4C execution.
- No Gate 4D execution.
- No Gate 4E execution.

## 12. Acceptance criteria

PR#18n is acceptable only if all of the following are true:

- The PR is docs-only.
- The only intended changed file is `docs/sprint2-pr18n-gate4a-production-readiness-audit-planning.md`.
- Gate 4A is documented as audit / preflight planning only.
- Future Gate 4A evidence allowlists and forbidden evidence lists are explicit.
- Future Gate 4A stop-lines are explicit and fail-closed.
- No execution is authorized.
- Production cutover remains blocked.
- Production endpointUrl re-flip remains blocked.
- Final scoring / governance recap PR requirement is preserved.
- Customer-output governance locks remain unchanged:
  - `customer_claim_allowed=false`.
  - `lane_output_allowed=false`.
  - `customer_visibility_allowed=false`.
  - `lane_write_allowed=false`.
  - `allowed_customer_language=[]`.
- Migration 016 Lane grant safety carries forward.
- No secrets or sensitive values are included.

End of PR#18n. **Verdict: PLANNING ONLY — Gate 4A production-readiness audit / preflight planning. No Gate 4A execution, no Gate 4B / 4C / 4D / 4E execution, no endpointUrl re-flip, no buyerrecon.com production `/v1/event`, no Render `/collect` replacement, no `/var/www` edit, no production traffic, no production DB mutation, no production token provisioning, no DB grants, no migrations, no schema.sql change, no Track A, no Playwright, no customer-facing output, no Lane A/B writer, no dashboard implementation, no AMS runtime bridge, no Pass 1 / Trust / Pass 2 runtime, no website ThinSDK production activation, and no production artifact or config mode flip are approved by PR#18n. Any future Gate 4A execution PR, Gate 4B artifact/config PR, Gate 4C canary PR, Gate 4D observation PR, Gate 4E Track A / Playwright PR, issue-fix PR, final scoring / governance recap PR, runtime PR, or customer-surface PR remains separately gated by its own explicit Helen GO.**
