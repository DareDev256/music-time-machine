import { NextRequest, NextResponse } from "next/server";
import { checkRouteLimit, extractClientIp, rateLimitResponse, RouteName } from "./rateLimit";

type RouteContext = { params: Promise<Record<string, string>> };

interface HandlerOptions {
  route: RouteName;
  cacheTtl?: string;
}

/**
 * Wrap an API route handler with rate limiting and error handling.
 *
 * Eliminates per-route boilerplate: IP extraction, rate-limit checks, try/catch,
 * and consistent 500 responses all live here instead of in every route file.
 */
export function withRouteHandler(
  options: HandlerOptions,
  handler: (request: NextRequest, context: RouteContext) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse | Response> => {
    const clientIp = extractClientIp(request);
    if (!checkRouteLimit(options.route, clientIp)) {
      return rateLimitResponse();
    }

    try {
      return await handler(request, context);
    } catch (error) {
      // Log only the message — full error objects can leak upstream API internals,
      // response bodies, or stack traces containing file paths.
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`API error [${options.route}]: ${message}`);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: API_SECURITY_HEADERS }
      );
    }
  };
}

/**
 * Standard security headers applied to every API JSON response.
 *
 * These supplement the global headers in next.config.ts — which cover page
 * routes but don't always propagate to programmatic NextResponse.json() calls.
 *
 * - nosniff: prevents browsers from MIME-sniffing JSON into HTML (stored XSS vector)
 * - DENY: blocks embedding API responses in iframes (clickjacking)
 * - no-store: API data is user-specific or time-sensitive; don't cache in shared proxies
 */
const API_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

/** Build a NextResponse.json with standard cache + security headers. */
export function jsonWithCache(data: unknown, cacheTtl: string): NextResponse {
  return NextResponse.json(data, {
    headers: { ...API_SECURITY_HEADERS, "Cache-Control": cacheTtl },
  });
}

/**
 * Build an error NextResponse.json with security headers.
 *
 * Without this, validation-failure branches (400, 404) return raw
 * NextResponse.json() — missing nosniff and X-Frame-Options. Browsers
 * can MIME-sniff unprotected JSON error bodies into executable HTML.
 */
export function jsonError(
  body: { error: string },
  status: 400 | 404 | 422
): NextResponse {
  return NextResponse.json(body, { status, headers: API_SECURITY_HEADERS });
}
