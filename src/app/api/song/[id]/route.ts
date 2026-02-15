import { NextResponse } from "next/server";
import { getSongData } from "@/lib/dataFetcher";
import { isValidId } from "@/lib/rateLimit";
import { withRouteHandler, jsonWithCache } from "@/lib/apiHandler";

const CACHE_TTL = "public, s-maxage=3600, stale-while-revalidate=300";

export const GET = withRouteHandler({ route: "song" }, async (_request, { params }) => {
  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid song ID" }, { status: 400 });
  }

  const song = await getSongData(id);
  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  return jsonWithCache(song, CACHE_TTL);
});
