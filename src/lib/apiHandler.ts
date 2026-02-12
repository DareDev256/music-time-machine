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
      console.error(`API error [${options.route}]:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/** Build a NextResponse.json with standard cache headers. */
export function jsonWithCache(data: unknown, cacheTtl: string): NextResponse {
  return NextResponse.json(data, {
    headers: { "Cache-Control": cacheTtl },
  });
}
