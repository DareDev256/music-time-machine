import { NextRequest, NextResponse } from "next/server";
import { searchSongs, getTrendingSongs, getConfiguredApis } from "@/lib/dataFetcher";
import { sanitizeQuery } from "@/lib/rateLimit";
import { withRouteHandler, jsonWithCache } from "@/lib/apiHandler";

const CACHE_TTL = "public, s-maxage=300, stale-while-revalidate=60";

export const GET = withRouteHandler({ route: "search" }, async (request: NextRequest) => {
  const rawQuery = request.nextUrl.searchParams.get("q");

  if (!rawQuery || rawQuery.trim() === "") {
    const trending = await getTrendingSongs();
    return jsonWithCache({ results: trending, type: "trending", apis: getConfiguredApis() }, CACHE_TTL);
  }

  const query = sanitizeQuery(rawQuery);
  if (query.length === 0) {
    return NextResponse.json({ results: [], type: "search", apis: getConfiguredApis() });
  }

  const results = await searchSongs(query);
  return jsonWithCache({ results, type: "search", apis: getConfiguredApis() }, CACHE_TTL);
});
