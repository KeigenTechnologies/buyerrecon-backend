/**
 * Sprint 2 PR#10 — POI Core Input — version stamps.
 *
 * Pure module. No DB. No filesystem. No process side effects.
 *
 * PR#9a §8 names the POI input contract version
 * `poi-core-input-v0.1`. Bumping this value requires:
 *   1. A `docs/sprint2-pr9{a,b,...}-…md` revision with Helen sign-off,
 *      AND
 *   2. A re-evaluation of every downstream consumer (the future
 *      `poi_observations_v0_1` writer if Helen selects Option B,
 *      the future POI observer, Series / Trust / Policy joins, etc.).
 *
 * The value below is the PR#10 initial freeze.
 */

export const POI_CORE_INPUT_VERSION = 'poi-core-input-v0.1' as const;
export type PoiInputVersion = typeof POI_CORE_INPUT_VERSION;
