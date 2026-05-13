/**
 * Sprint 2 PR#10 — POI Core Input — pure normalisation helpers.
 *
 * Pure module. No DB. No HTTP. No clock. No filesystem. No
 * `process.env`. No imports from collector / app / server / auth.
 *
 * Each helper returns either a normalised key string or `null` on
 * any privacy / safety / format failure. The adapter then maps
 * `null` to a rejection (INVALID_POI_KEY).
 *
 * Privacy rules enforced here (PR#9a §7):
 *   - Path keys are stripped of host / protocol / query string /
 *     fragment, lower-cased, trailing-slash-normalised. Any path
 *     containing structurally unsafe content returns null.
 *   - Route keys collapse identifier path segments to caller-supplied
 *     `:placeholder` names via a `RouteRule[]` list.
 *   - CTA / form IDs MUST match a strict allowlist regex. Raw text
 *     (button labels, headings) is NEVER a POI key.
 *   - Referrer is reduced to a CLASS (search / social / email /
 *     direct / unknown). The raw referrer URL is NEVER returned.
 *   - Offer surface is reduced to a CLASS (demo / pricing / trust /
 *     footer). Anything else returns null.
 *   - UTM campaign / source / medium are reduced to an allowlist-shaped
 *     CLASS label only. Raw UTM values are NEVER returned as-is.
 */

import {
  OFFER_SURFACE,
  OFFER_SURFACES_ALLOWED,
  REFERRER_CLASS,
  REFERRER_CLASSES_ALLOWED,
  type OfferSurfaceClass,
  type ReferrerClass,
  type RouteRule,
} from './types.js';

/* --------------------------------------------------------------------------
 * Path normalisation
 *
 * Input: a string that may be a path, a full URL, or garbage.
 * Output: a normalised path string (e.g. '/pricing'), OR `null` if
 *         the input is unsafe.
 *
 * Strips:
 *   - scheme (http/https/etc.)
 *   - host
 *   - port
 *   - query string (`?...`)
 *   - fragment (`#...`)
 * Normalises:
 *   - lowercase
 *   - collapses duplicate slashes
 *   - removes trailing slash (except for the root `/`)
 *
 * Rejects (returns null):
 *   - empty string
 *   - non-string input
 *   - path containing whitespace or control chars
 *   - path containing literal `?` or `#` AFTER the strip (defence
 *     in depth — should not happen, but if URL parsing fails this
 *     trips it)
 *   - path that doesn't start with `/`
 * ------------------------------------------------------------------------ */

const PATH_FORBIDDEN_CHAR_REGEX = /[\s\x00-\x1f\x7f]/;

/* --------------------------------------------------------------------------
 * Sensitive path segment detection (PR#10 Codex blocker #1)
 *
 * After query/hash stripping, individual path segments can still
 * carry credential-shaped material — e.g. `/reset/token/secret-value`
 * or `/auth/bearer/abc`. PR#9a §7 requires unsafe path segments to
 * reject. We split the normalised path into segments,
 * percent-decode each segment safely, and check against two marker
 * sets:
 *
 *   - SENSITIVE_PATH_SUBSTRING_MARKERS — credential-shaped tokens
 *     that are almost never legitimate page-path components. Any
 *     segment whose decoded lowercased value CONTAINS one of these
 *     markers as a substring rejects.
 *
 *   - SENSITIVE_PATH_EXACT_MARKERS — broader ambiguous markers that
 *     also appear in legitimate page paths (`/code-of-conduct`,
 *     `/api-key-management`, `/forgot-password`). We reject only
 *     when the segment EQUALS the marker exactly (or differs only
 *     by case), to avoid silently dropping legitimate URLs.
 *
 * Conservative-rejection note (PR#9a "Conservative rejection is
 * acceptable for v0.1"): the substring set is intentionally narrow;
 * if a legitimate URL hits this filter, an operator can extend
 * RouteRule-based collapses to map it to a clean POI key, or the
 * marker set can be tightened in a future PR.
 * ------------------------------------------------------------------------ */

const SENSITIVE_PATH_SUBSTRING_MARKERS: readonly string[] = Object.freeze([
  'token',
  'session',
  'bearer',
  'secret',
  'password',
  'passwd',
  'jwt',
  'otp',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'token_hash',
  'pepper',
]);

const SENSITIVE_PATH_EXACT_MARKERS: ReadonlySet<string> = new Set<string>([
  'code',
  'key',
  'email',
  'auth',
  'reset',
  'cookie',
]);

/**
 * Email-shaped PII detection (PR#10 Codex blocker #4).
 *
 * After percent-decoding, any segment containing `@` is rejected
 * outright — email addresses in URL path segments are virtually
 * never legitimate POI keys and always represent PII that must
 * not flow into `poi.poi_key`. The email-like regex below is
 * defence-in-depth: it matches `local@domain.tld` shapes
 * specifically, so a future caller cannot bypass the `@` check
 * by passing the literal character through some other encoding.
 *
 * The raw `%40` check (the percent-encoded `@`) is also defence-
 * in-depth: it fires even if `safeDecodeUriSegment` ever returns
 * a string that hasn't been fully decoded (which it always does,
 * but the guard is cheap and the privacy upside is real).
 */
const EMAIL_LIKE_REGEX = /^[^/\s@]+@[^/\s@]+\.[^/\s@]+$/i;

function safeDecodeUriSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function isPathSegmentSafe(rawSeg: string, decodedLower: string): boolean {
  if (decodedLower.length === 0) return true;
  // Codex blocker #4 — email-shaped PII detection.
  if (decodedLower.includes('@')) return false;
  if (EMAIL_LIKE_REGEX.test(decodedLower)) return false;
  if (rawSeg.toLowerCase().includes('%40')) return false;
  // Codex blocker #1 — credential-shaped path-segment markers.
  if (SENSITIVE_PATH_EXACT_MARKERS.has(decodedLower)) return false;
  for (const marker of SENSITIVE_PATH_SUBSTRING_MARKERS) {
    if (decodedLower.includes(marker)) return false;
  }
  return true;
}

export function normalisePagePath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  let path: string;
  // Try URL parsing first to strip scheme/host/query/fragment cleanly.
  // If `raw` is path-only (e.g. '/pricing?q=1'), URL parse fails without
  // a base; we then fall back to manual stripping.
  try {
    const u = new URL(raw);
    path = u.pathname;
  } catch {
    // Strip query + fragment manually.
    const qIdx = raw.indexOf('?');
    const fIdx = raw.indexOf('#');
    let endIdx = raw.length;
    if (qIdx >= 0 && qIdx < endIdx) endIdx = qIdx;
    if (fIdx >= 0 && fIdx < endIdx) endIdx = fIdx;
    path = raw.slice(0, endIdx);
  }

  if (path.length === 0) return null;
  if (!path.startsWith('/')) return null;
  if (PATH_FORBIDDEN_CHAR_REGEX.test(path)) return null;
  if (path.includes('?') || path.includes('#')) return null;

  // Lowercase, collapse duplicate slashes, normalise trailing slash.
  let normalised = path.toLowerCase().replace(/\/{2,}/g, '/');
  if (normalised.length > 1 && normalised.endsWith('/')) {
    normalised = normalised.slice(0, -1);
  }

  // Per-segment sensitivity check (Codex blocker #1). Split on '/',
  // discard the leading empty segment from the leading slash, decode
  // each segment safely, and reject if any segment is credential-
  // shaped (token / session / bearer / secret / ... — see marker
  // sets above).
  const segments = normalised.split('/').filter((s) => s.length > 0);
  for (const seg of segments) {
    const decoded = safeDecodeUriSegment(seg);
    if (decoded === null) return null;  // malformed percent encoding
    if (!isPathSegmentSafe(seg, decoded.toLowerCase())) return null;
  }

  return normalised;
}

/* --------------------------------------------------------------------------
 * Route derivation
 *
 * Apply each caller-supplied RouteRule in order, replacing the
 * matched pattern with the rule's placeholder. The first rule that
 * matches wins for any given segment; rules are not re-applied after
 * a replacement.
 *
 * Input: a normalised path (from `normalisePagePath`) + a route-rule
 *        list.
 * Output: the route pattern (e.g. '/post/:id'), OR `null` if the
 *         input path is null / empty.
 *
 * The function does NOT invent collapses on its own — if no rule
 * matches, the path is returned as-is (which may be the route
 * pattern itself for non-parameterised paths like `/pricing`).
 * ------------------------------------------------------------------------ */

export function deriveRoutePattern(
  normalisedPath: string | null,
  rules:          readonly RouteRule[],
): string | null {
  if (typeof normalisedPath !== 'string' || normalisedPath.length === 0) return null;

  let route = normalisedPath;
  for (const rule of rules) {
    if (!(rule.pattern instanceof RegExp)) continue;
    if (typeof rule.replacement !== 'string') continue;
    // Use replace once per rule. Avoid the global flag to keep
    // behaviour predictable across rules.
    route = route.replace(rule.pattern, rule.replacement);
  }
  return route;
}

/* --------------------------------------------------------------------------
 * CTA / form ID validation
 *
 * Strict allowlist regex (`cta_[a-z0-9_]+` / `form_[a-z0-9_]+`).
 * Length-bounded to avoid pathological inputs. Lower-case only.
 *
 * Raw user-entered text (button labels like "Book a Demo Now!")
 * is NEVER a CTA/form ID — it's product copy, not a stable
 * identifier.
 * ------------------------------------------------------------------------ */

const CTA_ID_REGEX  = /^cta_[a-z0-9_]{1,64}$/;
const FORM_ID_REGEX = /^form_[a-z0-9_]{1,64}$/;

export function validateCtaId(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!CTA_ID_REGEX.test(raw)) return null;
  return raw;
}

export function validateFormId(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!FORM_ID_REGEX.test(raw)) return null;
  return raw;
}

/* --------------------------------------------------------------------------
 * Referrer classification
 *
 * Reduce a raw referrer URL (or null) to a coarse class label. The
 * raw URL itself is NEVER returned.
 *
 * Default class mapping (small built-in allowlist for v0.1):
 *   - search:  google.* / bing.* / duckduckgo.* / yahoo.* / baidu.* / yandex.*
 *   - social:  twitter.com / x.com / linkedin.com / facebook.* / instagram.com /
 *              reddit.com / tiktok.com / youtube.com / threads.net / mastodon.*
 *   - email:   mail.* / outlook.* / gmail / hubspot / sendgrid / mailchimp /
 *              substack hosting paths (heuristic: empty / null referrer with
 *              UTM medium=email is NOT routed here; we don't read UTM in this
 *              helper)
 *   - direct:  no referrer (null or empty string) — same-domain or direct nav
 *   - unknown: anything else
 *
 * The classifier never reveals the raw referrer in any return value.
 * ------------------------------------------------------------------------ */

const SEARCH_HOST_PATTERNS = [
  /(?:^|\.)google\./i,
  /(?:^|\.)bing\.com$/i,
  /(?:^|\.)duckduckgo\.com$/i,
  /(?:^|\.)yahoo\./i,
  /(?:^|\.)baidu\.com$/i,
  /(?:^|\.)yandex\./i,
  /(?:^|\.)ecosia\.org$/i,
  /(?:^|\.)brave\.com$/i,
];

const SOCIAL_HOST_PATTERNS = [
  /(?:^|\.)twitter\.com$/i,
  /(?:^|\.)x\.com$/i,
  /(?:^|\.)linkedin\.com$/i,
  /(?:^|\.)facebook\.com$/i,
  /(?:^|\.)instagram\.com$/i,
  /(?:^|\.)reddit\.com$/i,
  /(?:^|\.)tiktok\.com$/i,
  /(?:^|\.)youtube\.com$/i,
  /(?:^|\.)threads\.net$/i,
  /(?:^|\.)mastodon\./i,
];

const EMAIL_HOST_PATTERNS = [
  /(?:^|\.)mail\./i,
  /(?:^|\.)outlook\./i,
  /(?:^|\.)gmail\.com$/i,
  /(?:^|\.)hubspot\.com$/i,
  /(?:^|\.)sendgrid\./i,
  /(?:^|\.)mailchimp\.com$/i,
];

export function classifyReferrer(raw: unknown): ReferrerClass {
  if (raw === null || raw === undefined) return REFERRER_CLASS.DIRECT;
  if (typeof raw !== 'string' || raw.length === 0) return REFERRER_CLASS.DIRECT;
  let host: string;
  try {
    host = new URL(raw).host;
  } catch {
    return REFERRER_CLASS.UNKNOWN;
  }
  if (!host) return REFERRER_CLASS.UNKNOWN;
  // Order matters: EMAIL subdomain patterns (e.g. `mail.google.com`)
  // MUST be checked before SEARCH host patterns (e.g. `google.com`),
  // otherwise `mail.google.com` would match the SEARCH `google.`
  // pattern first and be misclassified.
  for (const re of EMAIL_HOST_PATTERNS)  if (re.test(host)) return REFERRER_CLASS.EMAIL;
  for (const re of SEARCH_HOST_PATTERNS) if (re.test(host)) return REFERRER_CLASS.SEARCH;
  for (const re of SOCIAL_HOST_PATTERNS) if (re.test(host)) return REFERRER_CLASS.SOCIAL;
  return REFERRER_CLASS.UNKNOWN;
}

/* --------------------------------------------------------------------------
 * Offer surface classification
 *
 * Maps a raw offer-surface label to the OfferSurfaceClass allowlist
 * (`offer.demo` / `offer.pricing` / `offer.trust` / `offer.footer`).
 *
 * The caller may pass either the class string directly
 * (`'offer.demo'`) or a coarse hint (`'demo'`, `'pricing-page'`,
 * etc.). The helper recognises the canonical class strings first,
 * then a few common synonyms. Unknown inputs return `null`.
 *
 * Anything outside the four-class allowlist is rejected — the
 * caller's product taxonomy may grow, but the shared-core POI
 * primitive does not.
 * ------------------------------------------------------------------------ */

const OFFER_SURFACE_ALLOWED_SET: ReadonlySet<string> = new Set(OFFER_SURFACES_ALLOWED);

const OFFER_SURFACE_SYNONYMS: ReadonlyMap<string, OfferSurfaceClass> = new Map([
  ['demo',         OFFER_SURFACE.DEMO],
  ['demo-page',    OFFER_SURFACE.DEMO],
  ['book-demo',    OFFER_SURFACE.DEMO],
  ['pricing',      OFFER_SURFACE.PRICING],
  ['pricing-page', OFFER_SURFACE.PRICING],
  ['plans',        OFFER_SURFACE.PRICING],
  ['trust',        OFFER_SURFACE.TRUST],
  ['trust-page',   OFFER_SURFACE.TRUST],
  ['security',     OFFER_SURFACE.TRUST],
  ['compliance',   OFFER_SURFACE.TRUST],
  ['footer',       OFFER_SURFACE.FOOTER],
  ['site-footer',  OFFER_SURFACE.FOOTER],
]);

export function classifyOfferSurface(raw: unknown): OfferSurfaceClass | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const lower = raw.toLowerCase().trim();
  if (OFFER_SURFACE_ALLOWED_SET.has(lower)) return lower as OfferSurfaceClass;
  return OFFER_SURFACE_SYNONYMS.get(lower) ?? null;
}

/* --------------------------------------------------------------------------
 * UTM campaign / source / medium class normalisation (OD-4)
 *
 * Per OD-4, UTM is CONTEXT only, never a POI key. These helpers
 * exist so callers can normalise UTM values into allowlist-shaped
 * class labels before placing them on `PoiContext`.
 *
 * Allowlist shape: `[a-z0-9._-]+`, max length 64. Empty / too-long
 * / non-string / regex-violating inputs return `null`.
 *
 * The helper does NOT validate the SEMANTIC meaning of the campaign
 * — it only enforces a privacy-safe character set so identity-shaped
 * UTM values (e.g. `utm_campaign=person@example.com`) cannot flow.
 * ------------------------------------------------------------------------ */

const UTM_CLASS_REGEX = /^[a-z0-9._-]{1,64}$/;

export function normaliseUtmCampaignClass(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const lower = raw.toLowerCase().trim();
  if (!UTM_CLASS_REGEX.test(lower)) return null;
  return lower;
}

export function normaliseUtmSourceClass(raw: unknown): string | null {
  return normaliseUtmCampaignClass(raw);
}

export function normaliseUtmMediumClass(raw: unknown): string | null {
  return normaliseUtmCampaignClass(raw);
}

/* --------------------------------------------------------------------------
 * Re-exports for tests + adapter (allowlist sets for sweeps)
 * ------------------------------------------------------------------------ */

export { OFFER_SURFACE_ALLOWED_SET };
