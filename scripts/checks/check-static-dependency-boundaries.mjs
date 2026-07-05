#!/usr/bin/env node
// BuyerRecon — Sprint 3.5 Phase B / PR A: static dependency/import boundary guardrail.
//
// Status: SPRINT3_5_PHASE_B_PR_A_STATIC_DEPENDENCY_IMPORT_CHECKS
//
// Fails closed (exit 1) if a prohibited *import* relationship appears between architectural
// surfaces. This is a STATIC TEXT check: it scans tracked source via `git grep` only. It does
// NOT import application modules, instantiate a pg.Pool, load env files, read secrets, connect
// to a DB/network, execute workers/classifiers, or generate customer output.
//
// Run locally (no DB / no network / no runtime services):
//
//     npm run check:static-boundaries
//
// Design notes (read before changing scope):
//   * Scope is tracked SOURCE files only (`git grep` excludes node_modules/.git). Enforcement
//     targets *import specifiers* (the quoted module path after `from` / `import(` / `require(`),
//     so prose/doc-comments that merely mention "persistence" etc. are NOT matched.
//   * Rules are intentionally NARROW and grounded in the PR #360 audit + PR #361 plan. A boundary
//     that is not statically representable as an unambiguous import edge is recorded under
//     DEFERRED below rather than invented as a rule (per PR #361 §2.5 — avoid overclaiming).
//   * No new npm dependencies. Node built-ins + `git grep` only, mirroring
//     scripts/check-no-raw-constants.mjs.
//   * This guardrail is EXPECTED to pass on the current tree; it exists to keep the boundary
//     from regressing in later Phase C+ refactors.

import { spawnSync } from "node:child_process";

// A forbidden import edge = any file under `scope` whose import/require specifier matches
// `forbidSpecifier`. Patterns are POSIX ERE (git grep -E).
//
// The specifier matcher anchors on `from <quote>`, `import(<quote>`, or `require(<quote>` so it
// only matches real module specifiers, not comments/prose.
const SPECIFIER_PREFIX =
  "(from[[:space:]]+|import[[:space:]]*\\([[:space:]]*|require[[:space:]]*\\([[:space:]]*)[\"']";

const RULES = [
  {
    id: "R1_customer_output_no_worker_import",
    description:
      "Customer-output / reporting surfaces must not import worker execution modules directly.",
    scope: ["src/reports/external/", "src/lane-ab-preview/"],
    forbidSpecifier: "[^\"']*(run-[a-z0-9-]*worker|/worker\\.(js|ts)|worker\\.js)",
  },
  {
    id: "R2_observer_no_write_path_import",
    description:
      "Observer-only modules must not import worker or persistence (DB write) modules directly.",
    scope: ["src/scoring/", "*-observer/"], // pathspec pair narrowed below via glob
    scopePathspecs: [":(glob)src/scoring/*-observer/**"],
    forbidSpecifier:
      "[^\"']*(run-[a-z0-9-]*worker|/worker\\.(js|ts)|worker\\.js|/persistence)",
  },
  {
    id: "R3_risk_worker_no_customer_output_import",
    description:
      "Risk-worker / classifier area must not import customer-output generation surfaces directly.",
    scopePathspecs: [":(glob)src/scoring/risk-evidence/**"],
    forbidSpecifier: "[^\"']*(reports/external|lane-ab-preview)",
  },
  {
    id: "R4_worker_no_customer_output_import",
    description:
      "Worker execution modules must not import customer-output surfaces directly (record-only reinforcement).",
    scopePathspecs: [
      ":(glob)scripts/run-*-worker.ts",
      ":(glob)src/scoring/*/worker.ts",
      ":(glob)src/scoring/stage0/**",
    ],
    forbidSpecifier: "[^\"']*(reports/external|lane-ab-preview)",
  },
];

// Boundaries that are intentionally NOT enforced here because they are not statically
// representable as an unambiguous import edge on the current tree (recorded, not invented).
const DEFERRED = [
  "Lane A/B durable-writer boundary — enforced at the Postgres grant layer (migrations/016); " +
    "no in-code Lane A/B writer exists to reference as an import edge.",
  "Gate4E / Gate4F — no code artifacts in this repo (procedural/governance gates); nothing to assert statically.",
  "AMS runtime boundary — AMS is not a runtime dependency here; reserved-name guards already exist " +
    "(AMS_RESERVED_* in timing-product-context-observer/types.ts); no import edge to assert.",
  "product-context-timing-observer vs timing-product-context-observer naming — a naming/ownership " +
    "question (audit open-Q #2), not an import-boundary rule.",
];

function gitGrep(pattern, pathspecs) {
  const res = spawnSync(
    "git",
    ["grep", "-nE", pattern, "--", ...pathspecs],
    { encoding: "utf8" },
  );
  if (res.status === 0) {
    return { matched: true, lines: res.stdout.trim().split("\n").filter(Boolean) };
  }
  if (res.status === 1) {
    return { matched: false, lines: [] };
  }
  // status > 1 (or null) => git error; fail closed.
  const err = (res.stderr || "").trim();
  throw new Error(`git grep failed (status=${res.status}): ${err}`);
}

let violations = 0;
for (const rule of RULES) {
  const pathspecs = rule.scopePathspecs ?? rule.scope;
  const pattern = SPECIFIER_PREFIX + rule.forbidSpecifier;
  const { matched, lines } = gitGrep(pattern, pathspecs);
  if (matched) {
    violations += lines.length;
    console.log(`FAIL  ${rule.id}: ${rule.description}`);
    for (const line of lines) console.log(`        ${line}`);
  } else {
    console.log(`ok    ${rule.id}`);
  }
}

console.log("");
console.log("deferred (not enforced — recorded, not invented):");
for (const d of DEFERRED) console.log(`  - ${d}`);
console.log("");

if (violations > 0) {
  console.error(
    `check:static-boundaries FAILED — ${violations} prohibited import edge(s) found.`,
  );
  process.exit(1);
}

console.log(
  "check:static-boundaries OK — no prohibited import edges across enforced surfaces.",
);
console.log(
  "Scope: static import-specifier scan of tracked source via git grep; no DB/network/runtime.",
);
