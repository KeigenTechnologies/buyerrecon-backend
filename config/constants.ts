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
