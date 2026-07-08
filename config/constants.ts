// BuyerRecon — Canonical machine-consumed constants.
//
// Configuration Discipline (see CLAUDE.md → "Configuration Discipline (Mandatory)").
// This file is the single source of truth for canonical environment names, role names,
// deployment paths, env-var/secret names, and Stage 0 route/label vocabulary that code
// must reference instead of hard-coding raw literals.
//
// Rules:
//   - Add a value here (and to .claude/constants.md) BEFORE reusing it in code.
//   - Do not invent aliases for these values.
//   - Mark anything uncertain as PENDING_REVIEW in .claude/constants.md (do not guess here).
//   - This file is the ONLY place (besides the registry/guardrail files) where these raw
//     literals are allowed; `npm run check:constants` enforces that for source code.
//
// NOTE: This is a registry-only addition. It changes no runtime behavior; existing source
// files are intentionally NOT yet migrated to use these constants (follow-up PRs do that
// file-by-file).

// ---------------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------------
export const PRODUCTION_ENV = "buyerrecon_production" as const;

// ---------------------------------------------------------------------------
// Database roles
// ---------------------------------------------------------------------------
export const PRODUCTION_DB_ROLE_COLLECTOR_APP = "buyerrecon_prod_collector_app" as const;
export const STAGE0_RUNNER_ROLE = "buyerrecon_stage0_runner" as const;

// ---------------------------------------------------------------------------
// Deployment paths
// ---------------------------------------------------------------------------
export const PRODUCTION_CHECKOUT_PATH = "/opt/buyerrecon-backend" as const;

// ---------------------------------------------------------------------------
// Stage 0 route labels
// ---------------------------------------------------------------------------
export const STAGE0_ROUTE_A = "RouteA" as const;
export const STAGE0_ROUTE_B = "RouteB" as const;
export const STAGE0_ROUTE_C = "RouteC" as const;

// ---------------------------------------------------------------------------
// Stage 0 labels / vocabulary
// ---------------------------------------------------------------------------
export const STAGE0_LABEL = "Stage0" as const;
export const STAGE0_ENV_PREFIX = "STAGE0" as const;

// ---------------------------------------------------------------------------
// Environment variable / secret names
// ---------------------------------------------------------------------------
export const DATABASE_URL_ENV = "DATABASE_URL" as const;
export const STAGE0_RUNNER_DSN_ENV = "STAGE0_RUNNER_DSN" as const;

// ---------------------------------------------------------------------------
// Risk-worker Option B — compiled build artifact / compiled runtime path
// (Slice 1 scaffold contract. Non-secret path/command names only.)
//
// These register the canonical names/paths for the future Option B compiled
// runtime path. Slice 1 is BUILD-SCAFFOLD ONLY: the compiled runtime path is
// NOT active and the existing `tsx` risk-worker run scripts are unchanged.
// Registered-but-not-yet-guardrail-enforced (see .claude/constants.md).
//   - ROOT + the two ENTRYPOINT paths + BUILD_COMMAND are used by the Slice 1
//     scaffold (tsconfig.riskworker-artifact.json + the build:riskworker-artifact
//     package script) and are compiled into the already-gitignored `dist/`.
//   - RUN / PREFLIGHT / PARITY command names are RESERVED contract names only —
//     they are NOT wired to any package script in Slice 1 (later slices wire them
//     under their own review / GO). No runtime behavior changes here.
// ---------------------------------------------------------------------------
export const COMPILED_ARTIFACT_ROOT = "dist/riskworker" as const;
export const RISKWORKER_COMPILED_ENTRYPOINT =
  "dist/riskworker/scripts/run-risk-evidence-worker.js" as const;
export const RECORD_ONLY_COMPILED_ENTRYPOINT =
  "dist/riskworker/scripts/run-risk-evidence-record-only-worker.js" as const;
export const RISKWORKER_BUILD_COMMAND = "build:riskworker-artifact" as const;
// RESERVED — defined but NOT wired in Slice 1 (no package script yet).
export const RISKWORKER_COMPILED_RUN_COMMAND = "run:riskworker-compiled" as const;
export const RISKWORKER_RUNTIME_PREFLIGHT_PROOF_COMMAND =
  "proof:riskworker-runtime-preflight" as const;
export const RISKWORKER_CI_BUILD_PARITY_PROOF_COMMAND =
  "proof:riskworker-ci-build-parity" as const;
