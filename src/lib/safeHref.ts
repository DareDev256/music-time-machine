/**
 * Validates that a URL uses the `https:` protocol before rendering it as an `href`.
 *
 * Prevents `javascript:`, `data:`, `vbscript:`, and other dangerous protocol schemes
 * from being injected via compromised or malicious API responses. React auto-escapes
 * text content but does NOT sanitize `href` attributes — a `javascript:` URL in an
 * `<a href>` will execute on click, bypassing CSP in some browsers.
 *
 * @returns The original URL if it's `https:`, otherwise `"#"` (inert click target).
 *
 * @example
 * safeHref("https://open.spotify.com/track/123")  // "https://open.spotify.com/track/123"
 * safeHref("javascript:alert(1)")                  // "#"
 * safeHref("data:text/html,<script>x</script>")    // "#"
 * safeHref(undefined)                               // "#"
 * safeHref("")                                      // "#"
 */
export function safeHref(url: string | undefined | null): string {
  if (!url) return "#";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : "#";
  } catch {
    return "#";
  }
}
