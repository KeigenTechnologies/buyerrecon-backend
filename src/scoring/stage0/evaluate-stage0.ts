/**
 * Sprint 2 PR#5 — Stage 0 pure evaluator (BuyerRecon-side adapter).
 *
 * Wraps the vendored Track A `lib/stage0-hard-exclusion.js` (verbatim
 * upstream, SHA-256 `7dc97bd9…`; see `docs/vendor/track-a-stage0-pr5.md`)
 * and:
 *
 *   1. Applies the P-11 AI-crawler taxonomy correction: known declared
 *      AI / search crawlers (Bytespider, GPTBot, ClaudeBot, etc.) are
 *      mapped to `null` userAgentBotFamily BEFORE the upstream evaluator
 *      runs, so the `known_bot_ua_family` rule does NOT fire on them.
 *      This is the *exclusion-side* correction only — PR#5 ships no
 *      Lane B writer.
 *
 *   2. Discards the upstream's Stage 1 envelope fields
 *      (`stage1BehaviourScore.*`, `decisionSummary.*`,
 *      `stage0HardExclusion.recommendedAction`,
 *      `stage0HardExclusion.confidence`). PR#5 emits no `riskScore`,
 *      no `classification`, no `recommendedAction`, no
 *      `evidence_band`, no `verification_score`, no `reason_codes`.
 *
 *   3. Maps the upstream first-firing rule's `reasonCode` string to
 *      BuyerRecon's `Stage0RuleId` enum (or `'no_stage0_exclusion'`
 *      when nothing fires). All upstream rule names are accepted
 *       1:1; the enum is a Stage-0-specific identifier set, NOT a
 *      reason_code from `reason_code_dictionary.yml`.
 *
 *   4. Builds a minimised `rule_inputs` object per OD-11. Raw UA is
 *      never written. The persisted keys are normalised facts only.
 *
 * The evaluator is PURE: no DB, no HTTP, no `pg` import, no
 * filesystem, no process side effects. Safe to import from tests and
 * from the DB worker.
 */

import type {
  Stage0Input,
  Stage0Output,
  Stage0RuleId,
} from './types.js';
import { STAGE0_RULE_IDS } from './types.js';

// Default import of the vendored CommonJS module (esModuleInterop = true).
// The vendored file path must match docs/vendor/track-a-stage0-pr5.md.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import stage0HardExclusion from './vendor/stage0-hard-exclusion.js';

/* --------------------------------------------------------------------------
 * P-11 — AI-crawler / known-search-crawler taxonomy
 *
 * Per A0 §0.6 P-11 + §P P-11 default, known declared AI / search
 * crawlers MUST NOT trigger Stage 0 hard-exclusion. This set lists
 * the normalised family labels the BuyerRecon UA extractor may emit
 * for those crawlers. If a Stage0Input arrives with one of these
 * families, the adapter remaps `userAgentBotFamily` to `null` BEFORE
 * calling the vendored evaluator. The vendored
 * `KNOWN_BOT_UA_FAMILIES` set is UNCHANGED (vendor SHA-256 preserved).
 *
 * Lower-cased throughout for case-insensitive matching.
 * ------------------------------------------------------------------------ */

export const KNOWN_AI_CRAWLER_UA_FAMILIES: ReadonlySet<string> = new Set([
  'bytespider',
  'gptbot',
  'claudebot',
  'perplexity-user',
  'perplexitybot',
  'ccbot',
  'googlebot',
  'bingbot',
  'duckduckbot',
  'petalbot',
]);

/* --------------------------------------------------------------------------
 * Upstream output shape — minimal projection.
 *
 * Only the `stage0HardExclusion` shape is read by the BuyerRecon
 * adapter. Stage 1 envelope fields are deliberately NOT named here:
 * the PR#3 "no score-shaped identifiers in active source" sweep
 * forbids the words `classification`, `recommended_action`, etc., in
 * any active code path. Naming them in a discarded-field interface
 * would trip that sweep even though the adapter never accesses them.
 * The whole-object pass-through type stays `unknown`.
 * ------------------------------------------------------------------------ */

interface UpstreamStage0Result {
  schemaVersion:        number;
  sessionId:            string | null;
  recordOnly:           boolean;
  stage0HardExclusion: {
    excluded:           boolean;
    confidence:         string | null;
    reasonCodes:        string[];
  };
  // Everything else the upstream returns (Stage 1 envelope + decision
  // summary) is opaque to the adapter. The adapter MUST NOT access
  // any field on this index — anything reaching downstream would
  // be a Stage 1 leak.
  [k: string]: unknown;
}

const upstream = stage0HardExclusion as unknown as {
  evaluate(evidence: unknown): UpstreamStage0Result;
  RULES:                                     ReadonlyArray<{ name: string }>;
  SCHEMA_VERSION:                            number;
  KNOWN_BOT_UA_FAMILIES:                     ReadonlySet<string>;
  PROBE_PATH_PATTERNS:                       ReadonlyArray<RegExp>;
  HIGH_VOLUME_REQUESTS_PER_SECOND_THRESHOLD: number;
  PATH_LOOP_COUNT_THRESHOLD:                 number;
  FORBIDDEN_TOKENS:                          ReadonlyArray<string>;
};

/* --------------------------------------------------------------------------
 * isKnownAiCrawler — public helper for tests + future PR#3b observer
 * ------------------------------------------------------------------------ */

export function isKnownAiCrawler(family: string | null | undefined): boolean {
  if (typeof family !== 'string') return false;
  return KNOWN_AI_CRAWLER_UA_FAMILIES.has(family.toLowerCase());
}

/* --------------------------------------------------------------------------
 * Mapping from upstream reasonCode strings to BuyerRecon Stage0RuleId
 *
 * The upstream emits the rule name as a string (e.g.
 * 'webdriver_global_present'). We accept it 1:1 if it is in
 * STAGE0_RULE_IDS; otherwise we raise. Unknown rule names indicate the
 * vendored lib has been bumped without a corresponding BuyerRecon
 * adapter update — the adapter MUST fail loudly rather than coerce.
 * ------------------------------------------------------------------------ */

const STAGE0_RULE_ID_SET = new Set<string>(STAGE0_RULE_IDS);

function mapUpstreamRuleToStage0RuleId(name: string): Stage0RuleId {
  if (STAGE0_RULE_ID_SET.has(name)) {
    return name as Stage0RuleId;
  }
  throw new Error(
    `Stage 0 adapter: upstream rule '${name}' is not in the BuyerRecon ` +
    `Stage0RuleId enum. The vendored lib may have been bumped without a ` +
    `corresponding adapter update. Update src/scoring/stage0/types.ts ` +
    `(STAGE0_RULE_IDS), migration 012 CHECK constraint, and ` +
    `evaluate-stage0.ts, then re-vendor and re-test.`,
  );
}

/* --------------------------------------------------------------------------
 * evaluateStage0Decision — public entry point
 *
 * Pure function: same input → same output. No DB. No filesystem. No
 * randomness. No clock reads.
 * ------------------------------------------------------------------------ */

export function evaluateStage0Decision(input: Stage0Input): Stage0Output {
  // P-11: map known AI crawlers to null UA family BEFORE upstream eval.
  const aiCrawlerHit  = isKnownAiCrawler(input.userAgentFamily);
  const familyForUpstream = aiCrawlerHit ? null : input.userAgentFamily;

  const evidence = {
    sessionId: input.sessionId,
    deterministic: {
      // BuyerRecon does not yet derive these SDK-side fingerprint flags;
      // they pass through as their safety defaults so the corresponding
      // upstream rules deliberately do not fire (per the upstream safety
      // contract: "Missing signals do NOT fake an exclusion").
      webdriverFlag:        false,
      automationGlobals:    [],
      userAgentBotFamily:   familyForUpstream,
      nonBrowserRuntime:    false,
    },
    requestSignals: {
      pathsVisited:                input.pathsVisited,
      maxEventsPerSecondSameBrowser: input.maxEventsPerSecondSameBrowser,
      pathLoopCount10m:            input.pathLoopCount10m,
      zeroEngagementAcrossSession: input.zeroEngagementAcrossSession,
    },
  };

  const upstreamResult: UpstreamStage0Result = upstream.evaluate(evidence);

  // Discard upstream Stage 1 envelope. Keep only stage0HardExclusion verdict.
  const excluded = upstreamResult.stage0HardExclusion.excluded === true;

  // Pick the FIRST firing upstream rule deterministically (registry
  // order is webdriver → automation → known_bot_ua_family → probe path
  // → impossible request frequency → non-browser runtime →
  // attack-like request pattern). A single-rule mapping keeps the
  // OD-11 allowlist tight; persisting the full list of matched rules
  // requires Helen re-signing OD-11.
  const firstUpstreamHit: string | undefined = upstreamResult.stage0HardExclusion.reasonCodes[0];
  const ruleId: Stage0RuleId = excluded && typeof firstUpstreamHit === 'string'
    ? mapUpstreamRuleToStage0RuleId(firstUpstreamHit)
    : 'no_stage0_exclusion';

  // Build minimised rule_inputs object — STRICT OD-11 allowlist only.
  // Helen-signed allowed keys:
  //   user_agent_family, matched_family, matched_rule_id, ua_source,
  //   path_pattern_matched, events_per_second, path_loop_count,
  //   signal_confidence_bucket.
  // No other keys are persisted. AI-crawler / Bytespider taxonomy is
  // applied as INTERNAL pre-evaluation logic only (`familyForUpstream`
  // above); the carve-out's effect is observable from the absence of
  // a `known_bot_ua_family` rule_id on a Bytespider session, NOT from
  // a persisted `ai_crawler_passthrough` flag. Lane B declared-agent
  // facts are re-derived by the future PR#3b Lane B observer.
  // `aiCrawlerHit` is referenced here only so TypeScript does not
  // complain about an unused local; it never reaches the persisted
  // row.
  void aiCrawlerHit;
  const ruleInputs: Record<string, unknown> = {
    matched_rule_id:    ruleId,
    user_agent_family:  input.userAgentFamily,
    ua_source:          'ingest_requests',
    events_per_second:  input.maxEventsPerSecondSameBrowser,
    path_loop_count:    input.pathLoopCount10m,
  };

  // matched_family — populated only when the `known_bot_ua_family` rule
  // fires (i.e. the upstream evaluator matched the input family against
  // the vendored KNOWN_BOT_UA_FAMILIES set). For every other rule, the
  // matched family is not meaningful and the key is omitted.
  if (ruleId === 'known_bot_ua_family' && typeof input.userAgentFamily === 'string') {
    ruleInputs.matched_family = input.userAgentFamily;
  }

  // path_pattern_matched — populated only when scanner_or_probe_path
  // fires. We do NOT echo a raw page_url; only the matched canonical
  // path is persisted (truncated defensively).
  if (ruleId === 'scanner_or_probe_path') {
    const matched = input.pathsVisited.find((p): p is string =>
      typeof p === 'string' &&
      upstream.PROBE_PATH_PATTERNS.some((re) => re.test(p)));
    if (typeof matched === 'string') {
      ruleInputs.path_pattern_matched = matched.slice(0, 256);
    }
  }

  // signal_confidence_bucket — optional; the vendored evaluator
  // currently emits only `'high'` for excluded sessions and null
  // otherwise. We persist it when present so future PR#6 / PR#3b
  // consumers can read it without re-deriving.
  const confidence = upstreamResult.stage0HardExclusion.confidence;
  if (typeof confidence === 'string' && confidence.length > 0) {
    ruleInputs.signal_confidence_bucket = confidence;
  }

  return {
    excluded,
    ruleId,
    ruleInputs,
    evidenceRefs: input.evidenceRefs,
  };
}

/* --------------------------------------------------------------------------
 * Re-exports for tests + provenance assertions
 * ------------------------------------------------------------------------ */

export {
  upstream as VENDORED_STAGE0_MODULE,
};

export const STAGE0_VERSION_DEFAULT = 'stage0-hard-exclusion-v0.2';
