import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16 proxy (replaces middleware.ts).
 *
 * Generates a per-request CSP nonce so we can drop `'unsafe-inline'`
 * from `script-src`. Next.js automatically reads the nonce from the
 * `Content-Security-Policy` header and applies it to framework scripts,
 * bundles, and inline styles — no manual `nonce` props needed on those.
 *
 * The FOUC-prevention theme script in layout.tsx reads the nonce from
 * the `x-nonce` request header.
 */
export function proxy(request: NextRequest) {
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
    "img-src 'self' data: blob: https://i.scdn.co https://i.ytimg.com https://images.genius.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://www.googleapis.com https://api.genius.com",
    "media-src 'self' https://p.scdn.co",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set CSP on the response so browsers enforce it
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}
