import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkRouteLimit, extractClientIp, rateLimitResponse, RouteName } from "./rateLimit";

type RouteContext = { params: Promise<Record<string, string>> };

interface HandlerOptions {
  route: RouteName;
  cacheTtl?: string;
}

/**
 * Generate a unique request ID for traceability.
 *
 * During security incidents, X-Request-ID lets you correlate a suspicious
 * request across CDN access logs → load balancer → application logs.
 * Without it, finding the same request in multiple systems is guesswork.
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Wrap an API route handler with rate limiting, error handling, and request tracing.
 *
 * Eliminates per-route boilerplate: IP extraction, rate-limit checks, try/catch,
 * request ID generation, and consistent 500 responses all live here instead of
 * in every route file.
 */
export function withRouteHandler(
  options: HandlerOptions,
  handler: (request: NextRequest, context: RouteContext) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse | Response> => {
    const requestId = generateRequestId();
    const clientIp = extractClientIp(request);
    if (!checkRouteLimit(options.route, clientIp)) {
      return rateLimitResponse(requestId);
    }

    try {
      const response = await handler(request, context);
      // Attach request ID to every successful response for traceability
      response.headers.set("X-Request-ID", requestId);
      return response;
    } catch (error) {
      // Log only the message — full error objects can leak upstream API internals,
      // response bodies, or stack traces containing file paths.
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`API error [${options.route}] req=${requestId}: ${message}`);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: { ...API_SECURITY_HEADERS, "X-Request-ID": requestId } }
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
