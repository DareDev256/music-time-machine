import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16 proxy — runs on Vercel's edge network before any route handler.
 * (Next 16 refuses a repo that ships both middleware.ts and proxy.ts, so the
 * former middleware's controls live here now.)
 *
 * Security controls applied here cover EVERY request, unlike next.config.ts
 * headers (which only apply to matched routes) or per-route withRouteHandler()
 * wrappers (which miss the health endpoint and static assets).
 *
 * 1. Path traversal blocking — rejects `/../`, `/./`, `%2e%2e` and encoded
 *    variants before they reach route handlers or static file serving.
 * 2. Method restriction — API routes are read-only; anything but
 *    GET/HEAD/OPTIONS is rejected at the edge.
 * 3. X-Request-Id — unique per-request ID for incident correlation across
 *    rate-limit logs, SSRF blocks and error handlers.
 * 4. Per-request CSP nonce so `script-src` carries no `'unsafe-inline'`.
 *    Next.js reads the nonce from the CSP header and applies it to its own
 *    scripts; the FOUC-prevention theme script in layout.tsx reads `x-nonce`.
 */

/** Characters that indicate path traversal attempts. */
const TRAVERSAL_PATTERN = /(?:\/\.\.\/|\/\.\/|%2e%2e|%2f\.\.)/i;

/** Methods allowed on API routes. This is a read-only app. */
const ALLOWED_API_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // ── Path traversal gate ───────────────────────────────────────────
  if (TRAVERSAL_PATTERN.test(pathname) || TRAVERSAL_PATTERN.test(decodeURIComponent(pathname))) {
    return new NextResponse(null, { status: 400 });
  }

  // ── Method restriction on API routes ──────────────────────────────
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

  // ── CSP nonce ─────────────────────────────────────────────────────
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // In dev, Next.js injects eval-based HMR scripts
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  // Tailwind injects inline styles; nonce covers them in prod,
  // unsafe-inline is needed in dev for HMR style injection
  const styleSrc = isDev
    ? "'self' 'unsafe-inline'"
    : `'self' 'nonce-${nonce}'`;

  const cspHeader = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https://i.scdn.co https://i.ytimg.com https://images.genius.com https://*.mzstatic.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://www.googleapis.com https://api.genius.com",
    "media-src 'self' https://p.scdn.co",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  // ── Request ID + header propagation ───────────────────────────────
  // crypto.randomUUID() is available in Edge Runtime (Web Crypto API).
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", cspHeader);
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
