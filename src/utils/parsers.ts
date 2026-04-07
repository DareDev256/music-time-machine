/**
 * Secure URL domain extraction with input validation and sanitization.
 *
 * Why a dedicated function instead of inlining `new URL(url).hostname`?
 *
 * 1. **Dangerous protocols** — `javascript:`, `data:`, `vbscript:` URLs parse
 *    successfully and return a hostname of `""`, which downstream code might
 *    treat as falsy-but-valid. We reject non-HTTP(S) schemes explicitly.
 *
 * 2. **Credential injection** — URLs like `https://evil.com@legit.com` parse
 *    with hostname `legit.com` but the browser navigates to `evil.com`. We
 *    strip userinfo before parsing to close this phishing vector.
 *
 * 3. **Overlong input** — A 10 MB URL string fed into `new URL()` won't crash
 *    V8, but it wastes CPU on regex backtracking inside the URL parser. We
 *    enforce a 2 KB ceiling — no legitimate URL exceeds this.
 *
 * 4. **Control characters** — Null bytes, newlines, and tabs inside URLs can
 *    cause header injection (CRLF) in downstream HTTP clients. We reject any
 *    input containing ASCII control characters.
 *
 * Complements `safeHref` (output encoding) and `safeFetch` (SSRF prevention)
 * by hardening the *input parsing* layer.
 */

/** Maximum URL length accepted. RFC 2616 has no hard limit, but browsers
 *  cap at ~2 KB and no Music Time Machine URL should approach this. */
const MAX_URL_LENGTH = 2048;

/** Protocols considered safe for domain extraction. */
const SAFE_PROTOCOLS = new Set(["https:", "http:"]);

/** ASCII control characters (U+0000–U+001F) and DEL (U+007F). */
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;

/** Userinfo segment: everything before the first `@` in the authority. */
const USERINFO_RE = /^(https?:\/\/)[^@/]*@/i;

export interface DomainResult {
  /** The extracted hostname, lowercased and trimmed of trailing dots. */
  domain: string;
  /** The full origin (`protocol + // + host`). */
  origin: string;
  /** The protocol used (`"https:"` or `"http:"`). */
  protocol: string;
}

/**
 * Extract a validated domain from a URL string.
 *
 * @returns A `DomainResult` on success, or `null` if the input is
 *          invalid, uses a dangerous protocol, or fails any check.
 *
 * @example
 * extractDomainFromUrl("https://open.spotify.com/track/123")
 * // → { domain: "open.spotify.com", origin: "https://open.spotify.com", protocol: "https:" }
 *
 * extractDomainFromUrl("javascript:alert(1)")   // → null
 * extractDomainFromUrl("")                       // → null
 * extractDomainFromUrl(null as unknown as string) // → null
 */
export function extractDomainFromUrl(url: unknown): DomainResult | null {
  // ── Type gate ──────────────────────────────────────────────────────
  if (typeof url !== "string") return null;

  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  // ── Length ceiling ─────────────────────────────────────────────────
  if (trimmed.length > MAX_URL_LENGTH) return null;

  // ── Control character rejection ────────────────────────────────────
  if (CONTROL_CHAR_RE.test(trimmed)) return null;

  // ── Strip userinfo to prevent credential-smuggling ─────────────────
  const sanitized = trimmed.replace(USERINFO_RE, "$1");

  // ── Parse ──────────────────────────────────────────────────────────
  let parsed: URL;
  try {
    parsed = new URL(sanitized);
  } catch {
    return null;
  }

  // ── Protocol allowlist ─────────────────────────────────────────────
  if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;

  // ── Hostname sanity ────────────────────────────────────────────────
  const domain = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (domain.length === 0) return null;

  return {
    domain,
    origin: parsed.origin,
    protocol: parsed.protocol,
  };
}
