#!/usr/bin/env node
// BuyerRecon — Configuration Discipline guardrail.
//
// Fails (exit 1) if a registered canonical literal appears as a RAW literal in SOURCE CODE
// instead of being imported from config/constants.ts. Run locally via:
//
//     npm run check:constants
//
// Design notes (read before changing scope):
//   * Enforcement scope is SOURCE CODE only: *.ts *.tsx *.js *.jsx *.mjs *.cjs.
//     Markdown / docs are intentionally OUT of enforcement scope — they are prose/evidence
//     that legitimately reference role names etc., and cannot be "migrated" to TS constants.
//     The inventory (docs/config-constants-inventory.md) reports the markdown corpus
//     separately for visibility.
//   * The literals are allowed to appear raw ONLY in the registry/guardrail files listed in
//     ALLOWLIST below.
//   * Uses `git grep` (tracked files only, so node_modules/.git are excluded; an explicit
//     :(exclude) pathspec is added as belt-and-suspenders). No new npm dependencies.
//   * First run is EXPECTED to fail while existing source still contains raw literals. Do NOT
//     auto-rewrite source here; follow-up PRs migrate file-by-file. See
//     docs/config-constants-inventory.md.

import { spawnSync } from "node:child_process";

// FORBIDDEN raw literals that FAIL the guardrail (exit 1).
//
// Intentionally NARROW: only project-unique identifiers that must never be hard-coded raw in
// source. Generic / vocabulary / env-var-name terms (RouteA/B/C, Stage0, STAGE0,
// DATABASE_URL, STAGE0_RUNNER_DSN) and any postgres:// / DSN-style connection strings are NOT
// fail conditions — they are tracked as "candidate, pending Helen review" in
// docs/config-constants-inventory.md only. (config/constants.ts still registers the broader
// skeleton; this guardrail simply does not enforce those yet.)
const FORBIDDEN = [
  "buyerrecon_production",
  "buyerrecon_prod_collector_app",
  "buyerrecon_stage0_runner",
  "/opt/buyerrecon-backend",
];

// Files where the raw literals are always allowed (registry + guardrail).
const ALLOWLIST = new Set([
  "config/constants.ts",
  ".claude/constants.md",
  "scripts/check-no-raw-constants.mjs",
  "docs/config-constants-inventory.md",
]);

// Source-code globs subject to enforcement.
const CODE_PATHSPECS = ["*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs"];

function grepLiteral(literal) {
  const args = [
    "grep",
    "--no-color",
    "-F", // fixed string
    "-n", // line numbers
    "-I", // skip binary
    "-e",
    literal,
    "--",
    ...CODE_PATHSPECS,
    ":(exclude)node_modules/**",
  ];
  const res = spawnSync("git", args, { encoding: "utf8" });
  // git grep exits 1 when there are no matches; that is not an error for us.
  if (res.status !== 0 && res.status !== 1) {
    process.stderr.write(
      `ERROR: git grep failed for ${JSON.stringify(literal)} (status ${res.status}).\n` +
        (res.stderr || "") +
        "\n",
    );
    process.exit(2);
  }
  const out = res.stdout || "";
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      // format: path:line:content
      const firstColon = line.indexOf(":");
      const secondColon = line.indexOf(":", firstColon + 1);
      const file = line.slice(0, firstColon);
      const lineNo = line.slice(firstColon + 1, secondColon);
      return { file, lineNo };
    })
    .filter(({ file }) => !ALLOWLIST.has(file));
}

function main() {
  let totalViolations = 0;
  const grouped = [];

  for (const literal of FORBIDDEN) {
    const violations = grepLiteral(literal);
    if (violations.length > 0) {
      grouped.push({ literal, violations });
      totalViolations += violations.length;
    }
  }

  if (totalViolations === 0) {
    console.log("check:constants OK — no forbidden raw literals in source code.");
    console.log(`Scope: ${CODE_PATHSPECS.join(", ")} (markdown/docs out of enforcement scope).`);
    process.exit(0);
  }

  console.error("check:constants FAILED — forbidden raw literals found in source code.");
  console.error(
    "Use the constant from config/constants.ts instead of the raw literal. " +
      "Allowed raw only in: " +
      [...ALLOWLIST].join(", ") +
      ".\n",
  );

  for (const { literal, violations } of grouped) {
    // Per-file counts for clear grouped output.
    const counts = new Map();
    for (const v of violations) counts.set(v.file, (counts.get(v.file) || 0) + 1);
    console.error(`[${literal}] — ${violations.length} occurrence(s) in ${counts.size} file(s):`);
    for (const [file, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.error(`    ${file}  (${n})`);
    }
    console.error("");
  }

  console.error(`Total forbidden raw-literal occurrences in source: ${totalViolations}.`);
  console.error(
    "Expected to fail until follow-up PRs migrate existing source file-by-file. " +
      "See docs/config-constants-inventory.md.",
  );
  process.exit(1);
}

main();
