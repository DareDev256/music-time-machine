import { NextRequest } from "next/server";
import { compareSongs } from "@/lib/dataFetcher";
import { isValidId } from "@/lib/rateLimit";
import { withRouteHandler, jsonWithCache, jsonError } from "@/lib/apiHandler";

const CACHE_TTL = "public, s-maxage=3600, stale-while-revalidate=300";

export const GET = withRouteHandler({ route: "compare" }, async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const song1 = searchParams.get("song1");
  const song2 = searchParams.get("song2");

  if (!song1 || !song2) {
    return jsonError({ error: "Both song1 and song2 query parameters are required" }, 400);
  }

  if (!isValidId(song1) || !isValidId(song2)) {
    return jsonError({ error: "Invalid song IDs" }, 400);
  }

  const comparison = await compareSongs(song1, song2);
  if (!comparison) {
    return jsonError({ error: "One or both songs not found" }, 404);
  }

  return jsonWithCache(comparison, CACHE_TTL);
});
