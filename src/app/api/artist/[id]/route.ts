import { NextRequest, NextResponse } from "next/server";
import { getArtistData } from "@/lib/dataFetcher";
import { checkRouteLimit, extractClientIp, rateLimitResponse } from "@/lib/rateLimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = extractClientIp(request);
  if (!checkRouteLimit("artist", clientIp)) {
    return rateLimitResponse();
  }

  try {
    const { id } = await params;

    if (!/^[a-zA-Z0-9\-]+$/.test(id) || id.length > 200) {
      return NextResponse.json({ error: "Invalid artist ID" }, { status: 400 });
    }

    const artist = await getArtistData(id);

    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    return NextResponse.json(artist);
  } catch (error) {
    console.error("Artist fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch artist data" },
      { status: 500 }
    );
  }
}
