/**
 * SSRF-safe fetch wrapper for outbound API requests.
 *
 * Server-Side Request Forgery (SSRF) occurs when an attacker manipulates a
 * server into making HTTP requests to unintended destinations — internal
 * services, cloud metadata endpoints (169.254.169.254), or attacker-controlled
 * hosts. This wrapper validates the final resolved URL origin against an
 * explicit allowlist before the request leaves the server.
 *
 * Why this matters even when we build URLs ourselves:
 * - Template strings like `/search?q=${userInput}` can be abused with encoded
 *   characters that shift the URL's host (e.g., `@evil.com/` tricks).
 * - Future code changes might introduce dynamic endpoint construction.
 * - Defense-in-depth: even if input validation catches 99% of attacks,
 *   origin verification catches the remaining 1%.
 */

const ALLOWED_ORIGINS = new Set([
  "https://api.spotify.com",
  "https://accounts.spotify.com",
  "https://www.googleapis.com",
  "https://api.genius.com",
]);

/**
 * Validate that a URL points to an allowed API origin.
 * Throws immediately if the origin is not in the allowlist.
 */
function assertAllowedOrigin(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`SSRF blocked: malformed URL`);
  }

  if (!ALLOWED_ORIGINS.has(parsed.origin)) {
    // Log the blocked origin for monitoring (not the full URL, which may
    // contain API keys as query params).
    console.error(`SSRF blocked: origin "${parsed.origin}" not in allowlist`);
    throw new Error(`SSRF blocked: origin not allowed`);
  }
}

/**
 * Fetch wrapper that validates the target URL origin before making the request.
 * Drop-in replacement for `fetch()` — same signature, same return type.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  assertAllowedOrigin(url);
  return fetch(url, init);
}

/** Exposed for testing. */
export { assertAllowedOrigin, ALLOWED_ORIGINS };
