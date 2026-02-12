import { NextRequest, NextResponse } from "next/server";
import { getSongData, getConfiguredApis } from "@/lib/dataFetcher";
import { checkRouteLimit, extractClientIp, rateLimitResponse, isValidId } from "@/lib/rateLimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = extractClientIp(request);
  if (!checkRouteLimit("song", clientIp)) {
    return rateLimitResponse();
  }

  try {
    const { id } = await params;

    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid song ID" }, { status: 400 });
    }

    const song = await getSongData(id);

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ...song,
        _meta: {
          apis: getConfiguredApis(),
          useMock: process.env.USE_MOCK_DATA === "true",
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Song fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch song data" },
      { status: 500 }
    );
  }
}
