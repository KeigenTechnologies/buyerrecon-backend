#!/usr/bin/env tsx
/**
 * Sprint 2 PR#4 — CLI runner for the scoring contract loader.
 *
 * Behaviour:
 *   1. assertScoringContractsOrThrow()                — Step A semantic YAML validation.
 *   2. assertActiveScoringSourceCleanOrThrow()        — Step B scoped source-code grep.
 *
 * On success: prints `Scoring contracts check PASS` to stdout, exits 0.
 * On failure: prints the formatted issue list to stderr, exits 1.
 *
 * No DB. No HTTP. No production-specific behaviour.
 *
 * Wire-up: `npm run check:scoring-contracts` (per Helen OD-3 sign-off).
 *
 * Authority:
 *   - docs/architecture/ARCHITECTURE_GATE_A0.md §K row PR#4
 *   - docs/sprint2-pr4-scoring-contract-loader-planning.md (Codex PASS)
 */

import {
  assertActiveScoringSourceCleanOrThrow,
  assertScoringContractsOrThrow,
} from '../src/scoring/contracts.js';

function main(): void {
  try {
    assertScoringContractsOrThrow();
    assertActiveScoringSourceCleanOrThrow();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(msg + '\n');
    process.exit(1);
  }
  process.stdout.write('Scoring contracts check PASS\n');
}

main();
