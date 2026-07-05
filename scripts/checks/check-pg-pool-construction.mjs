#!/usr/bin/env node
// BuyerRecon — Sprint 3.5 Phase B / PR B: pg.Pool construction + DATABASE_URL usage
// characterization guardrail.
//
// Status: SPRINT3_5_PHASE_B_PR_B_PG_POOL_CONSTRUCTION_CHARACTERIZATION
//
// Records (allowlists) the CURRENT known DB-connection construction and DATABASE_URL
// connection-read sites, and FAILS CLOSED (exit 1) if a NEW one appears outside the
// allowlist, or if any appears in a customer-output / observer surface.
//
// This is a STATIC TEXT check. It scans tracked source via `git grep` only. It does NOT:
//   - open a DB connection, run SQL/psql, or touch the network
//   - load env files or read any secret/env *value* (it matches source text, never values)
//   - import application modules, boot the app, or run any worker/classifier
//   - centralize or refactor pg.Pool (characterize-only; Phase C would refactor, separately)
//
// Run locally (no DB / no network / no runtime):
//
//     npm run check:pg-pool-construction
//
// Design notes:
//   * Scope is tracked SOURCE under src/ and scripts/ (git grep excludes node_modules/.git,
//     and dist/ is untracked). tests/ are intentionally OUT of scope: the DB test harness
//     (tests/v1/db/_setup.ts) and TEST_DATABASE_URL are a separate, test-only concern.
//   * git grep uses POSIX ERE, which does NOT support `\b`; patterns avoid it.
//   * Allowlists are keyed by exact file path and grouped by class, each with a rationale.
//     A boundary that is not statically representable is recorded under DEFERRED, not invented.
//   * No new npm dependencies. Node built-ins + `git grep`, mirroring the sibling checks.

import { spawnSync } from "node:child_process";

// ---- Allowed DB-connection CONSTRUCTION sites (new pg.Pool / new pg.Client) -------------
// Class SERVER_APP_POOL: the single long-lived Express-app pool.
const SERVER_APP_POOL = ["src/db/client.ts"];
// Class CLI_WORKER_POOL: per-process CLI worker pools (max:4), one per worker script.
const CLI_WORKER_POOL = [
  "scripts/run-stage0-worker.ts",
  "scripts/run-risk-evidence-worker.ts",
  "scripts/run-poi-core-worker.ts",
  "scripts/run-poi-sequence-worker.ts",
];
// Class CLI_OBSERVATION_POOL: per-process read-only observation/report CLI pools.
const CLI_OBSERVATION_POOL = [
  "scripts/evidence-review-snapshot-report.ts",
  "scripts/lane-ab-preview-report.ts",
  "scripts/poi-core-input-observation-report.ts",
  "scripts/poi-sequence-observation-report.ts",
  "scripts/poi-sequence-table-observation-report.ts",
  "scripts/poi-table-observation-report.ts",
  "scripts/product-context-timing-observation-report.ts",
  "scripts/product-features-bridge-candidate-observation-report.ts",
  "scripts/risk-core-bridge-observation-report.ts",
  "scripts/timing-product-context-observation-report.ts",
];
// Class CLI_SINGLE_CLIENT: single-connection CLI scripts using new pg.Client (not a pool).
const CLI_SINGLE_CLIENT = [
  "scripts/collector-observation-report.ts",
  "scripts/extract-behavioural-features.ts",
  "scripts/extract-session-features.ts",
];

const CONSTRUCTION_ALLOWLIST = new Set([
  ...SERVER_APP_POOL,
  ...CLI_WORKER_POOL,
  ...CLI_OBSERVATION_POOL,
  ...CLI_SINGLE_CLIENT,
]);

// ---- Allowed DATABASE_URL connection-READ sites (process.env.DATABASE_URL / env.DATABASE_URL)
// Same families as above plus the src worker modules that parse env into a connection string.
const ENV_READ_ALLOWLIST = new Set([
  "src/db/client.ts",
  "src/scoring/poi-core-worker/worker.ts",
  "src/scoring/poi-sequence-worker/worker.ts",
  "src/scoring/risk-evidence/worker.ts",
  "src/scoring/stage0/run-stage0-worker.ts",
  ...CLI_WORKER_POOL,
  ...CLI_OBSERVATION_POOL,
  ...CLI_SINGLE_CLIENT,
]);

// ---- Surfaces where a DB connection construction / read must NEVER appear -----------------
// (customer-output + observer-only surfaces; enforced belt-and-suspenders vs. the allowlists)
function isForbiddenSurface(path) {
  return (
    path.startsWith("src/reports/external/") ||
    path.startsWith("src/lane-ab-preview/") ||
    /^src\/scoring\/[^/]*-observer\//.test(path)
  );
}

// POSIX ERE (no \b).
const CONSTRUCTION_RE = "new (pg\\.)?(Pool|Client)[[:space:]]*\\(";
const ENV_READ_RE = "process\\.env\\.DATABASE_URL|(^|[^A-Za-z_])env\\.DATABASE_URL";

const DEFERRED = [
  "Runtime DB-role binding — which Postgres role a given DATABASE_URL resolves to per process " +
    "is not statically representable in code (grants live in migrations/016; governance-verified).",
  "Role-scoped DSNs (APP_DSN/ADMIN_DSN/RUNNER_DSN/STAGE0_RUNNER_DSN) — not present in code today; " +
    "no construction site to characterize until a separately-gated change introduces them.",
  "pg.Pool centralization/dedup — a Phase C mechanical refactor, out of scope for this " +
    "characterize-only PR; this guardrail intentionally does not require it.",
];

function gitGrepLines(pattern, pathspecs) {
  const res = spawnSync("git", ["grep", "-nE", pattern, "--", ...pathspecs], {
    encoding: "utf8",
  });
  if (res.status === 0) return res.stdout.trim().split("\n").filter(Boolean);
  if (res.status === 1) return [];
  throw new Error(
    `git grep failed (status=${res.status}): ${(res.stderr || "").trim()}`,
  );
}

function pathOf(line) {
  // git grep -n output: "path:lineno:content"
  return line.split(":", 1)[0];
}

let violations = 0;
function fail(msg) {
  violations += 1;
  console.log(`FAIL  ${msg}`);
}

const SCOPE = ["src", "scripts"];

// Rule 1 — every construction site must be allowlisted, and none may sit on a forbidden surface.
const constructionLines = gitGrepLines(CONSTRUCTION_RE, SCOPE);
const constructionFiles = new Set(constructionLines.map(pathOf));
for (const line of constructionLines) {
  const p = pathOf(line);
  if (isForbiddenSurface(p)) {
    fail(`DB connection construction in forbidden surface: ${line}`);
  } else if (!CONSTRUCTION_ALLOWLIST.has(p)) {
    fail(`new pg.Pool/Client outside construction allowlist: ${line}`);
  }
}

// Rule 2 — every DATABASE_URL connection-read must be allowlisted, and none on a forbidden surface.
const envReadLines = gitGrepLines(ENV_READ_RE, SCOPE);
const envReadFiles = new Set(envReadLines.map(pathOf));
for (const line of envReadLines) {
  const p = pathOf(line);
  if (isForbiddenSurface(p)) {
    fail(`DATABASE_URL connection-read in forbidden surface: ${line}`);
  } else if (!ENV_READ_ALLOWLIST.has(p)) {
    fail(`DATABASE_URL connection-read outside allowlist: ${line}`);
  }
}

// ---- Characterization report (allowed sites, by class) -----------------------------------
console.log("pg.Pool / pg.Client construction sites (allowed, by class):");
const CLASSES = [
  ["SERVER_APP_POOL", SERVER_APP_POOL],
  ["CLI_WORKER_POOL", CLI_WORKER_POOL],
  ["CLI_OBSERVATION_POOL", CLI_OBSERVATION_POOL],
  ["CLI_SINGLE_CLIENT", CLI_SINGLE_CLIENT],
];
for (const [name, files] of CLASSES) {
  console.log(`  ${name}:`);
  for (const f of files) {
    const present = constructionFiles.has(f) ? "" : "  [NOTE: no construction match found]";
    console.log(`    - ${f}${present}`);
  }
}
console.log("");
console.log(`DATABASE_URL connection-read sites (allowed): ${envReadFiles.size} file(s) within allowlist.`);
console.log("");
console.log("deferred (not enforced — recorded, not invented):");
for (const d of DEFERRED) console.log(`  - ${d}`);
console.log("");

if (violations > 0) {
  console.error(
    `check:pg-pool-construction FAILED — ${violations} unexpected DB-connection site(s).`,
  );
  process.exit(1);
}

console.log(
  "check:pg-pool-construction OK — all DB-connection construction and DATABASE_URL reads are within the allowlist; none in customer-output/observer surfaces.",
);
console.log(
  "Scope: static text scan (git grep) of tracked src/ + scripts/; no DB/network/runtime; no env values read.",
);
