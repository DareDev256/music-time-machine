import { NextRequest, NextResponse } from "next/server";
import { searchSongs, getTrendingSongs, getConfiguredApis } from "@/lib/dataFetcher";

function sanitizeQuery(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/[<>"'&]/g, "") // Remove dangerous chars
    .trim()
    .slice(0, 200); // Max 200 chars
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawQuery = searchParams.get("q");

  try {
    // If no query, return trending songs
    if (!rawQuery || rawQuery.trim() === "") {
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

    const query = sanitizeQuery(rawQuery);
    if (query.length === 0) {
      return NextResponse.json({ results: [], type: "search", apis: getConfiguredApis() });
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
