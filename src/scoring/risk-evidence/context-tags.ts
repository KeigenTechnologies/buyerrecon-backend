/**
 * Sprint 2 PR#6 — ContextTag enum + validation.
 *
 * Pure module. No DB. No filesystem. No process side effects.
 *
 * ContextTags are short UPPER_SNAKE_CASE behavioural labels the
 * adapter emits on each `risk_observations_v0_1` row. They are NOT
 * reason_codes — they do not belong to the
 * `reason_code_dictionary.yml` `A_*` / `B_*` / `REVIEW_*` / `OBS_*` /
 * `UX_*` namespaces. PR#4's `validateRuleReferences` is NOT invoked
 * on ContextTags.
 *
 * Convention (Helen-signed D-13):
 *   - UPPER_SNAKE_CASE.
 *   - No prefix namespace; product-neutral labels.
 *   - Max 16 tags per session.
 *   - Forbidden namespaces:  A_ / B_ / REVIEW_ / OBS_ / UX_ / RISK.
 *   - Forbidden patterns:    every regex in
 *                            `scoring/forbidden_codes.yml.hard_blocked_code_patterns.patterns`
 *                            (`*_CONFIRMED`, `*_VERIFIED`, `BUYER_*`, etc.).
 *
 * BYTESPIDER_PASSTHROUGH discipline (Codex non-blocking note #2):
 *   - PROVENANCE/CONTEXT ONLY. Emitted by the adapter when Stage 0
 *     allowed a known declared crawler-like session to pass through
 *     (i.e. PR#5's `excluded = FALSE` + a Bytespider-family UA in
 *     `stage0_decisions.rule_inputs.user_agent_family`).
 *   - NOT a Lane B writer. PR#6 writes no Lane B rows.
 *   - NOT a B_* code. PR#6 emits no B_* anywhere.
 *   - NOT declared-agent scoring. The tag preserves the fact that
 *     Stage 0 saw a declared crawler; it does not produce an AI-agent
 *     classification, a buyer-intent claim, or any product-decision
 *     output.
 *   - Lane B declared-agent facts are re-derived by the deferred
 *     PR#3b Lane B observer.
 */

/**
 * The complete, finite, ordered enum of ContextTags PR#6 may emit at
 * v0.1. Helen-signed initial set (D-13 default).
 *
 * Any predicate that would emit a tag outside this set is a bug: the
 * adapter calls `assertContextTag` to crash before persistence.
 */
export const CONTEXT_TAG = {
  REFRESH_LOOP_CANDIDATE:        'REFRESH_LOOP_CANDIDATE',
  HIGH_REQUEST_BURST:            'HIGH_REQUEST_BURST',
  ZERO_FOREGROUND_TIME:          'ZERO_FOREGROUND_TIME',
  NO_MEANINGFUL_INTERACTION:     'NO_MEANINGFUL_INTERACTION',
  JS_NOT_EXECUTED:               'JS_NOT_EXECUTED',
  SUB_200MS_TRANSITION_RUN:      'SUB_200MS_TRANSITION_RUN',
  BEHAVIOURAL_CADENCE_ANOMALY:   'BEHAVIOURAL_CADENCE_ANOMALY',
  BYTESPIDER_PASSTHROUGH:        'BYTESPIDER_PASSTHROUGH',
} as const;

export type ContextTag = (typeof CONTEXT_TAG)[keyof typeof CONTEXT_TAG];

export const CONTEXT_TAGS_ALLOWED: readonly ContextTag[] = Object.freeze([
  CONTEXT_TAG.REFRESH_LOOP_CANDIDATE,
  CONTEXT_TAG.HIGH_REQUEST_BURST,
  CONTEXT_TAG.ZERO_FOREGROUND_TIME,
  CONTEXT_TAG.NO_MEANINGFUL_INTERACTION,
  CONTEXT_TAG.JS_NOT_EXECUTED,
  CONTEXT_TAG.SUB_200MS_TRANSITION_RUN,
  CONTEXT_TAG.BEHAVIOURAL_CADENCE_ANOMALY,
  CONTEXT_TAG.BYTESPIDER_PASSTHROUGH,
]);

/**
 * Maximum tags per emitted row at v0.1. Bumping requires Helen
 * re-signing D-13 (the cardinality cap is part of the AMS tag-penalty
 * input contract).
 */
export const CONTEXT_TAGS_MAX_PER_SESSION = 16;

const ALLOWED_TAG_SET: ReadonlySet<string> = new Set(CONTEXT_TAGS_ALLOWED);

/**
 * Shape regex for any candidate string claiming to be a ContextTag.
 * Stricter than UPPER_SNAKE_CASE alone — the enum is finite, so this
 * is a defence-in-depth check against accidental string injection.
 */
export const CONTEXT_TAG_SHAPE_REGEX = /^[A-Z][A-Z0-9_]*$/;

/**
 * Forbidden reason-code-namespace prefixes (per
 * `scoring/forbidden_codes.yml.prefix_allowlist` + planning §5). A
 * ContextTag MUST NOT match these — tags are not reason codes.
 */
export const FORBIDDEN_TAG_PREFIXES: readonly string[] = [
  'A_',
  'B_',
  'REVIEW_',
  'OBS_',
  'UX_',
  'RISK.',
];

/**
 * Forbidden tag patterns that mirror the live
 * `forbidden_codes.yml.hard_blocked_code_patterns.patterns` regexes.
 * Hard-coded here rather than loaded at runtime because the enum is
 * finite + reviewed by the test suite; the runtime cost of reading
 * YAML on every adapter call is unjustified and would couple the pure
 * module to disk I/O. PR#4 `assertScoringContractsOrThrow()` at worker
 * boot guarantees the YAML version in sync.
 */
export const FORBIDDEN_TAG_PATTERNS: readonly RegExp[] = [
  /^A_REAL_BUYER_.*/,
  /^REAL_BUYER_.*/,
  /^BUYER_.*/,
  /^INTENT_.*/,
  /.*_CONFIRMED$/,
  /.*_VERIFIED$/,
  /.*_CERTAIN$/,
  /.*_DETECTED$/,
  /.*_IDENTIFIED$/,
];

/**
 * Pure validator for a single candidate tag. Returns null if the tag
 * is allowed; returns a human-readable issue string otherwise.
 */
export function validateContextTag(tag: string): string | null {
  if (typeof tag !== 'string') return `tag is not a string: ${String(tag)}`;
  if (!CONTEXT_TAG_SHAPE_REGEX.test(tag)) {
    return `tag does not match UPPER_SNAKE_CASE shape: ${JSON.stringify(tag)}`;
  }
  for (const prefix of FORBIDDEN_TAG_PREFIXES) {
    if (tag.startsWith(prefix)) {
      return `tag matches forbidden namespace prefix ${JSON.stringify(prefix)}: ${tag}`;
    }
  }
  for (const re of FORBIDDEN_TAG_PATTERNS) {
    if (re.test(tag)) {
      return `tag matches forbidden pattern /${re.source}/: ${tag}`;
    }
  }
  if (!ALLOWED_TAG_SET.has(tag)) {
    return `tag is not in the Helen-signed D-13 enum: ${tag}`;
  }
  return null;
}

export function isContextTagAllowed(tag: string): tag is ContextTag {
  return validateContextTag(tag) === null;
}

/**
 * Defence-in-depth assertion the adapter calls before persistence.
 * Crash before write rather than persist an out-of-enum tag.
 */
export function assertContextTagsValid(tags: readonly string[]): void {
  if (tags.length > CONTEXT_TAGS_MAX_PER_SESSION) {
    throw new Error(
      `PR#6 ContextTag cardinality exceeded: ${tags.length} > ${CONTEXT_TAGS_MAX_PER_SESSION}`,
    );
  }
  for (const t of tags) {
    const issue = validateContextTag(t);
    if (issue !== null) {
      throw new Error(`PR#6 ContextTag invalid: ${issue}`);
    }
  }
}

/**
 * Stage0 → BYTESPIDER_PASSTHROUGH provenance check.
 *
 * The tag is emitted ONLY when a Stage-0-eligible session
 * (`excluded === false`) was recorded with a UA family in the AMS /
 * AI-crawler allowlist. The user_agent_family value is read from
 * `stage0_decisions.rule_inputs.user_agent_family` — a normalised
 * family label per PR#5's OD-11 minimisation, never a raw UA string.
 *
 * The allowlist below mirrors `KNOWN_AI_CRAWLER_UA_FAMILIES` in
 * `src/scoring/stage0/evaluate-stage0.ts`. It is duplicated here
 * because the PR#6 module must not import from PR#5's vendor-pinned
 * Stage 0 module (forbidden-source-string sweep + scope discipline).
 */
export const BYTESPIDER_PASSTHROUGH_UA_FAMILIES: ReadonlySet<string> = new Set([
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

export function shouldEmitBytespiderPassthrough(
  stage0RuleInputs: Record<string, unknown>,
): boolean {
  const fam = stage0RuleInputs['user_agent_family'];
  if (typeof fam !== 'string' || fam.length === 0) return false;
  return BYTESPIDER_PASSTHROUGH_UA_FAMILIES.has(fam.toLowerCase());
}
