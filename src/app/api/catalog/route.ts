import { NextRequest, NextResponse } from "next/server";
import { getCatalog } from "@/lib/dataFetcher";
import { checkRouteLimit, extractClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const clientIp = extractClientIp(request);
  if (!checkRouteLimit("catalog", clientIp)) {
    return rateLimitResponse();
  }

  const catalog = getCatalog();
  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
