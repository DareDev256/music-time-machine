import { getSongData } from "@/lib/dataFetcher";
import { isValidId } from "@/lib/rateLimit";
import { withRouteHandler, jsonWithCache, jsonError } from "@/lib/apiHandler";

const CACHE_TTL = "public, s-maxage=3600, stale-while-revalidate=300";

export const GET = withRouteHandler({ route: "song" }, async (_request, { params }) => {
  const { id } = await params;

  if (!isValidId(id)) {
    return jsonError({ error: "Invalid song ID" }, 400);
  }

  const song = await getSongData(id);
  if (!song) {
    return jsonError({ error: "Song not found" }, 404);
  }

  return jsonWithCache(song, CACHE_TTL);
});
