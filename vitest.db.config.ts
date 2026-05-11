/**
 * Sprint 1 PR#8 — opt-in DB verification suite config.
 *
 * Used ONLY by `npm run test:db:v1`. The default `npm test` uses vitest's
 * built-in defaults (no config file), which match `**​/*.{test,spec}.ts` and
 * therefore never pick up `.dbtest.ts` files. This file flips the include
 * glob to the `tests/v1/db/**​/*.dbtest.ts` suite and disables file
 * parallelism so the shared deterministic test boundary
 * (workspace_id = '__test_ws_pr8__') never sees overlapping writes from
 * two test files running concurrently.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/v1/db/**/*.dbtest.ts'],
    fileParallelism: false,
  },
});
