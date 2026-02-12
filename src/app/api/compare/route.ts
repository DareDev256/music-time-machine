import { NextRequest, NextResponse } from "next/server";
import { compareSongs } from "@/lib/dataFetcher";
import { isValidId } from "@/lib/rateLimit";
import { withRouteHandler } from "@/lib/apiHandler";

export const GET = withRouteHandler({ route: "compare" }, async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const song1 = searchParams.get("song1");
  const song2 = searchParams.get("song2");

  if (!song1 || !song2) {
    return NextResponse.json(
      { error: "Both song1 and song2 query parameters are required" },
      { status: 400 }
    );
  }

  if (!isValidId(song1) || !isValidId(song2)) {
    return NextResponse.json({ error: "Invalid song IDs" }, { status: 400 });
  }

  const comparison = await compareSongs(song1, song2);
  if (!comparison) {
    return NextResponse.json({ error: "One or both songs not found" }, { status: 404 });
  }

  return NextResponse.json(comparison);
});
