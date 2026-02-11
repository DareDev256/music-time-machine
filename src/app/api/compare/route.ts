import { NextRequest, NextResponse } from "next/server";
import { compareSongs } from "@/lib/dataFetcher";
import { checkRouteLimit, extractClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const clientIp = extractClientIp(request);
  if (!checkRouteLimit("compare", clientIp)) {
    return rateLimitResponse();
  }
  const searchParams = request.nextUrl.searchParams;
  const song1 = searchParams.get("song1");
  const song2 = searchParams.get("song2");

  if (!song1 || !song2) {
    return NextResponse.json(
      { error: "Both song1 and song2 query parameters are required" },
      { status: 400 }
    );
  }

  // Validate IDs
  const idPattern = /^[a-zA-Z0-9\-:]+$/;
  if (!idPattern.test(song1) || !idPattern.test(song2) || song1.length > 200 || song2.length > 200) {
    return NextResponse.json({ error: "Invalid song IDs" }, { status: 400 });
  }

  try {
    const comparison = await compareSongs(song1, song2);

    if (!comparison) {
      return NextResponse.json(
        { error: "One or both songs not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(comparison);
  } catch (error) {
    console.error("Compare error:", error);
    return NextResponse.json(
      { error: "Failed to compare songs" },
      { status: 500 }
    );
  }
}
