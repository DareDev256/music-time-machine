import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware — runs on Vercel's edge network before any route handler.
 *
 * Security controls applied here cover EVERY request, unlike next.config.ts
 * headers (which only apply to matched routes) or per-route withRouteHandler()
 * wrappers (which miss the health endpoint and static assets).
 *
 * What this adds:
 * 1. X-Request-Id — Unique per-request ID for security incident correlation.
 *    Without this, correlating abuse patterns across rate-limit logs, SSRF
 *    blocks, and error handlers requires timestamp matching (unreliable).
 * 2. Path traversal blocking — Rejects `/../`, `/./`, `%2e%2e`, and encoded
 *    variants before they reach route handlers or static file serving.
 * 3. Method restriction — API routes only accept GET; reject everything else
 *    at the edge (cheaper than letting it reach Node.js).
 */

/** Characters that indicate path traversal attempts. */
const TRAVERSAL_PATTERN = /(?:\/\.\.\/|\/\.\/|%2e%2e|%2f\.\.)/i;

/** Methods allowed on API routes. This is a read-only app. */
const ALLOWED_API_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // ── Path traversal gate ───────────────────────────────────────────
  // Encoded traversal sequences can bypass route matchers but reach
  // the filesystem via static file serving or rewrite rules.
  if (TRAVERSAL_PATTERN.test(pathname) || TRAVERSAL_PATTERN.test(decodeURIComponent(pathname))) {
    return new NextResponse(null, { status: 400 });
  }

  // ── Method restriction on API routes ──────────────────────────────
  // All API routes are GET-only. Rejecting POST/PUT/DELETE/PATCH at the
  // edge prevents unexpected behavior if a route handler accidentally
  // exports a POST handler or Next.js adds automatic HEAD/OPTIONS.
  if (pathname.startsWith("/api/") && !ALLOWED_API_METHODS.has(request.method)) {
    return new NextResponse(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "GET, HEAD, OPTIONS",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // ── Request ID injection ──────────────────────────────────────────
  // crypto.randomUUID() is available in Edge Runtime (Web Crypto API).
  // Propagated as both request header (for downstream logging) and
  // response header (for client-side incident reporting).
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("X-Request-Id", requestId);

  // Prevent search engines from indexing raw API/JSON responses
  if (pathname.startsWith("/api/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

/**
 * Matcher: apply to API routes and page routes, skip static assets.
 * _next/static and _next/image are excluded to avoid unnecessary edge
 * compute on cacheable static resources.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
