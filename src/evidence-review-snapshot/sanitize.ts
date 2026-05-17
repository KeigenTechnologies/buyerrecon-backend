/**
 * Sprint 2 PR#15a — Evidence Review Snapshot — sanitization helpers.
 *
 * All output renderers in this observer route through these
 * helpers. The snapshot MUST NOT print:
 *   - token_hash / ip_hash / user_agent
 *   - full session_id  (use `truncateSessionId` if any ID slips into a sample)
 *   - URL query strings (use `stripQueryString`)
 *   - emails / cookies / localStorage tokens / raw payload JSON
 *   - raw referrers with query strings
 *
 * The snapshot output is counts + buckets + sanitized path-only
 * examples. No per-row raw fields.
 */

/**
 * Strip everything after the first `?` from a URL or URL-like
 * string, plus the fragment after `#`. Returns the path portion
 * only. Safe to print.
 *
 * Examples:
 *   stripQueryString('https://example.test/pricing?utm_source=ad')
 *     → 'https://example.test/pricing'
 *   stripQueryString('/contact#section')
 *     → '/contact'
 *   stripQueryString('') → ''
 */
export function stripQueryString(input: string): string {
  if (typeof input !== 'string' || input.length === 0) return '';
  const qIdx = input.indexOf('?');
  const trimmedQ = qIdx >= 0 ? input.slice(0, qIdx) : input;
  const hIdx = trimmedQ.indexOf('#');
  return hIdx >= 0 ? trimmedQ.slice(0, hIdx) : trimmedQ;
}

/**
 * Reduce a session ID to a short safe prefix/suffix form. Used by
 * the PR#13b observer family — kept symmetric here so any sample
 * that flows through this observer can use the same convention.
 */
export function truncateSessionId(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '***';
  if (sessionId.length < 12) return '***';
  return `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`;
}

/**
 * Mask a DATABASE_URL down to its host + database name. Used at
 * the report boundary so the full connection string (with
 * password) never reaches stdout.
 */
export function parseDatabaseUrl(url: string | undefined): { host: string; name: string } {
  if (typeof url !== 'string' || url.length === 0) {
    return { host: '<unset>', name: '<unset>' };
  }
  try {
    const u = new URL(url);
    return { host: u.host || '<host>', name: u.pathname.replace(/^\//, '') || '<db>' };
  } catch {
    return { host: '<unparseable>', name: '<unparseable>' };
  }
}

/**
 * Forbidden field names that MUST NOT appear in the snapshot
 * output. The renderer scans the rendered markdown for these as
 * the final defence-in-depth check; a hit means a developer added
 * a field that should not have surfaced.
 */
export const FORBIDDEN_FIELD_NAMES: readonly string[] = Object.freeze([
  'token_hash',
  'ip_hash',
  'user_agent',
  'ua',
  'ip',
  'cookie',
  'authorization',
  'bearer',
  'pepper',
  'email',
  'person_id',
  'visitor_id',
  'company_id',
  'account_id',
  'phone',
  'email_hash',
  'person_hash',
  'page_url',
  'full_url',
  'url_query',
  'raw_payload',
  'canonical_jsonb',
]);

/**
 * Regex-based detector for raw-URL-with-query-string content.
 * Used by the post-render guard test. A standalone `?` after a
 * path indicates a query string survived sanitization.
 */
export const URL_WITH_QUERY_STRING_RE = /\bhttps?:\/\/[^\s?#]+\?[^\s]+/;

/**
 * Regex-based detector for email-shape values.
 */
export const EMAIL_SHAPE_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/;

/* --------------------------------------------------------------------------
 * Output sanitization — PR#15a Codex blocker patch.
 *
 * Three exported sanitizers cover every value that reaches the
 * markdown renderer:
 *
 *   - sanitizeOutputText(value)        — generic untrusted-text scrubber.
 *   - sanitizeBoundaryLabel(value, fallback) — strict structural-label
 *                                          validator (workspace_id,
 *                                          site_id).
 *   - sanitizeErrorNote(value)         — generic, never echoes raw DB
 *                                          error content.
 *
 * Every redaction replaces the offending span with a `<redacted-…>`
 * tag so the output is unambiguous and auditable. The original
 * value never reaches stdout.
 * ------------------------------------------------------------------------ */

// Global-flag variants for sequential replacement.
const EMAIL_GLOBAL_RE          = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const URL_WITH_QUERY_GLOBAL_RE = /https?:\/\/[^\s?#]+\?\S+/gi;
const BARE_URL_GLOBAL_RE       = /https?:\/\/[^\s?#]+/gi;
const QUERY_STRING_FRAG_RE     =
  /(?:\?|&)?[A-Za-z0-9_.\-]+=[^&\s]+(?:&[A-Za-z0-9_.\-]+=[^&\s]+)+/g;
const UUID_RE_GLOBAL           =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
const IPV4_GLOBAL_RE           =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const SESSION_ID_GLOBAL_RE     = /\bses_[A-Za-z0-9_-]{16,}\b/gi;
const JWT_LIKE_GLOBAL_RE       = /\beyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,}){1,2}\b/g;
const TOKEN_PREFIX_GLOBAL_RE   = /\b(?:sk|pk|tok|secret|token|sess|ses)_[A-Za-z0-9_-]{4,}\b/gi;
const AUTH_HEADER_RE_GLOBAL    =
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._\-+/=]+|(?:Authorization|Cookie|Set-Cookie)\s*[:=]\s*\S+/gi;
const USER_AGENT_RE_GLOBAL     =
  /\b(?:Mozilla|AppleWebKit|Chrome|Safari|Gecko|WebKit|Edge|Firefox|Opera|MSIE|Trident)\/[0-9][^\s]*/gi;
const LONG_TOKEN_RE_GLOBAL     = /[A-Za-z0-9_\-]{40,}/g;
const JSON_BLOB_RE_GLOBAL      = /[{[](?:[^{}\[\]]|[{[][^{}\[\]]*[}\]])*[}\]]/g;

// Single-match variants for label-shape predicates.
const URL_BARE_RE              = /https?:\/\//i;
const USER_AGENT_RE            =
  /\b(?:Mozilla|AppleWebKit|Chrome|Safari|Gecko|WebKit|Edge|Firefox|Opera|MSIE|Trident)\/[0-9]/i;
const LONG_TOKEN_RE            = /[A-Za-z0-9_\-]{40,}/;
const UUID_SHAPE_RE            =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const IPV4_SHAPE_RE            =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;
const SESSION_ID_SHAPE_RE      = /\bses_[A-Za-z0-9_-]{16,}\b/i;
const JWT_LIKE_RE              = /\beyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,}){1,2}\b/;
const TOKEN_PREFIX_RE          = /\b(?:sk|pk|tok|secret|token|sess|ses)_[A-Za-z0-9_-]{4,}\b/i;
const SAFE_LABEL_GRAMMAR_RE    = /^[A-Za-z0-9_.:\-]{1,96}$/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isIpv6Shape(candidate: string): boolean {
  const raw = candidate.trim();
  if (raw.length === 0 || raw.length > 39) return false;
  if (!/^[A-Fa-f0-9:]+$/.test(raw)) return false;
  const doubleColonMatches = raw.match(/::/g) ?? [];
  if (doubleColonMatches.length > 1) return false;
  const segments = raw.split(':');
  if (segments.length < 3) return false;
  if (!raw.includes('::') && segments.length !== 8) return false;
  return segments.every((segment) =>
    segment.length <= 4 && /^[A-Fa-f0-9]*$/.test(segment),
  );
}

function redactIpv6Shapes(text: string): string {
  return text.replace(
    /(^|[^A-Za-z0-9])([A-Fa-f0-9:]{2,39})(?=$|[^A-Za-z0-9])/g,
    (match, prefix: string, candidate: string) => {
      if (!isIpv6Shape(candidate)) return match;
      return `${prefix}<redacted-address>`;
    },
  );
}

/**
 * Generic untrusted-text sanitizer. Coerces non-strings to strings,
 * truncates extreme lengths, and replaces every sensitive shape
 * with a `<redacted-…>` tag. Order matters: more-specific shapes
 * are redacted before more-generic ones so a bearer-token inside
 * a URL is not double-redacted to `<redacted-url>` and lose its
 * token-aware tag.
 */
export function sanitizeOutputText(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : safeStringify(value);
  if (text.length === 0) return '';

  // Bound length first so downstream regex passes are quick.
  if (text.length > 2000) text = text.slice(0, 2000) + '…';

  // Normalise newlines / tabs so the markdown table cell stays
  // single-line.
  text = text.replace(/[\r\n\t]+/g, ' ');

  // Defense-in-depth order:
  // Marker deliberately avoids the literal word "email" so the
  // forbidden-field-name pass below doesn't re-match its own
  // output.
  text = text.replace(EMAIL_GLOBAL_RE,          '<redacted-contact>');
  text = text.replace(AUTH_HEADER_RE_GLOBAL,    '<redacted-auth>');
  text = text.replace(USER_AGENT_RE_GLOBAL,     '<redacted-user-agent>');
  text = text.replace(URL_WITH_QUERY_GLOBAL_RE, '<redacted-url-with-query>');
  text = text.replace(BARE_URL_GLOBAL_RE,       '<redacted-url>');
  text = text.replace(QUERY_STRING_FRAG_RE,     '<redacted-query-string>');
  text = text.replace(UUID_RE_GLOBAL,           '<redacted-uuid>');
  text = text.replace(IPV4_GLOBAL_RE,           '<redacted-address>');
  text = redactIpv6Shapes(text);
  text = text.replace(SESSION_ID_GLOBAL_RE,     '<redacted-session>');
  text = text.replace(JWT_LIKE_GLOBAL_RE,       '<redacted-token>');
  text = text.replace(TOKEN_PREFIX_GLOBAL_RE,   '<redacted-token>');
  text = text.replace(JSON_BLOB_RE_GLOBAL,      '<redacted-json>');
  text = text.replace(LONG_TOKEN_RE_GLOBAL,     '<redacted-token>');

  for (const name of FORBIDDEN_FIELD_NAMES) {
    const wordRe = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
    text = text.replace(wordRe, '<redacted-field>');
  }

  // Trim again — replacements can leave double-spaces.
  text = text.replace(/\s{2,}/g, ' ').trim();
  return text;
}

/**
 * Strict structural-label validator for caller-controlled boundary
 * identifiers (workspace_id, site_id). Returns the raw label
 * verbatim iff it passes the safe-label grammar AND does not
 * match any sensitive shape. Otherwise returns the caller-supplied
 * fallback (typically `<redacted-unsafe-workspace-id>` or
 * `<redacted-unsafe-site-id>`).
 *
 * The grammar (carried from PR#A7 ScoringDryRunInput.ItemLabel):
 *   - non-empty after trim
 *   - length 1..96
 *   - chars only [A-Z a-z 0-9 _ . : -]
 *   - no whitespace, no / ? & = @ %
 *   - not email-shaped, not URL-shaped, not user-agent-shaped,
 *     not token-shaped, not UUID-shaped, not IP-shaped, not
 *     session-id-shaped
 *
 * The observer does NOT fail closed on an unsafe boundary label;
 * it renders the fallback so Helen can still read the rest of the
 * snapshot. The unsafe value never reaches stdout.
 */
export function sanitizeBoundaryLabel(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 96) return fallback;
  if (!SAFE_LABEL_GRAMMAR_RE.test(raw))    return fallback;
  if (EMAIL_SHAPE_RE.test(raw))            return fallback;
  if (URL_BARE_RE.test(raw))               return fallback;
  if (USER_AGENT_RE.test(raw))             return fallback;
  if (LONG_TOKEN_RE.test(raw))             return fallback;
  if (UUID_SHAPE_RE.test(raw))             return fallback;
  if (IPV4_SHAPE_RE.test(raw))             return fallback;
  if (isIpv6Shape(raw))                    return fallback;
  if (SESSION_ID_SHAPE_RE.test(raw))       return fallback;
  if (JWT_LIKE_RE.test(raw))               return fallback;
  if (TOKEN_PREFIX_RE.test(raw))           return fallback;
  return raw;
}

/**
 * DB / system error note sanitizer. The PR#15a Codex blocker
 * preference is the generic note unless diagnostic value is
 * necessary. Currently always returns the generic note so a
 * future caller cannot accidentally pipe `err.message` through
 * here. The function exists as a single seam so a later PR that
 * wants tighter diagnostics can change the body without changing
 * call sites.
 */
export function sanitizeErrorNote(_value: unknown): string {
  return 'count query failed (sanitized database error)';
}

function safeStringify(v: unknown): string {
  try {
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  } catch {
    return '';
  }
}
