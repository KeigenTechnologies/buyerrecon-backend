/**
 * Type declarations for the VENDORED Track A Stage 0 library.
 *
 * This `.d.ts` is a BuyerRecon-side TypeScript type contract that
 * accompanies the byte-for-byte verbatim vendor copy at
 * `stage0-hard-exclusion.js`. The `.d.ts` file is NOT part of the
 * vendor SHA-256 proof (see `docs/vendor/track-a-stage0-pr5.md`); the
 * upstream ships no type declarations.
 *
 * Editing this file does NOT change the runtime behaviour of the
 * vendored module, but it MAY drift from the upstream API if the
 * vendored `.js` is re-vendored at a newer commit. Keep them in sync
 * during re-vendor.
 */

export interface UpstreamStage0Evidence {
  sessionId:      string | null;
  deterministic?: {
    webdriverFlag?:      boolean;
    automationGlobals?:  unknown[];
    userAgentBotFamily?: string | null;
    nonBrowserRuntime?:  boolean;
  };
  requestSignals?: {
    pathsVisited?:                  unknown[];
    maxEventsPerSecondSameBrowser?: number;
    pathLoopCount10m?:              number;
    zeroEngagementAcrossSession?:   boolean;
  };
}

/**
 * Upstream Stage 0 result projection. Only `stage0HardExclusion` is
 * read by the BuyerRecon adapter. The Stage 1 envelope + decision
 * summary fields are deliberately NOT named here so the PR#3
 * "no score-shaped identifiers in active source" sweep does not trip
 * on type declarations the adapter never accesses. The opaque
 * `[k: string]: unknown` indexer carries the rest of the upstream
 * response shape without naming any forbidden field.
 */
export interface UpstreamStage0Result {
  schemaVersion:        number;
  sessionId:            string | null;
  recordOnly:           boolean;
  stage0HardExclusion: {
    excluded:           boolean;
    confidence:         string | null;
    reasonCodes:        string[];
  };
  [k: string]: unknown;
}

export interface UpstreamStage0Module {
  evaluate(evidence: UpstreamStage0Evidence): UpstreamStage0Result;
  RULES:                                     ReadonlyArray<{ name: string }>;
  SCHEMA_VERSION:                            number;
  KNOWN_BOT_UA_FAMILIES:                     ReadonlySet<string>;
  PROBE_PATH_PATTERNS:                       ReadonlyArray<RegExp>;
  HIGH_VOLUME_REQUESTS_PER_SECOND_THRESHOLD: number;
  PATH_LOOP_COUNT_THRESHOLD:                 number;
  FORBIDDEN_TOKENS:                          ReadonlyArray<string>;
}

declare const stage0HardExclusion: UpstreamStage0Module;
export default stage0HardExclusion;
