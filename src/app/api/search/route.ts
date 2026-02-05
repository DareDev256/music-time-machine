import { NextRequest, NextResponse } from "next/server";
import { searchSongs, getTrendingSongs, getConfiguredApis } from "@/lib/dataFetcher";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  try {
    // If no query, return trending songs
    if (!query || query.trim() === "") {
      const trending = await getTrendingSongs();
      return NextResponse.json(
        {
          results: trending,
          type: "trending",
          apis: getConfiguredApis(),
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
          },
        }
      );
    }

    // Search for songs
    const results = await searchSongs(query);
    return NextResponse.json(
      {
        results,
        type: "search",
        apis: getConfiguredApis(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search songs" },
      { status: 500 }
    );
  }
}
