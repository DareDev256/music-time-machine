import { getArtistData } from "@/lib/dataFetcher";
import { isValidId } from "@/lib/rateLimit";
import { withRouteHandler, jsonWithCache, jsonError } from "@/lib/apiHandler";

const CACHE_TTL = "public, s-maxage=3600, stale-while-revalidate=300";

export const GET = withRouteHandler({ route: "artist" }, async (_request, { params }) => {
  const { id } = await params;

  if (!isValidId(id)) {
    return jsonError({ error: "Invalid artist ID" }, 400);
  }

  const artist = await getArtistData(id);
  if (!artist) {
    return jsonError({ error: "Artist not found" }, 404);
  }

  return jsonWithCache(artist, CACHE_TTL);
});
