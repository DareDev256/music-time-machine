import { NextRequest, NextResponse } from "next/server";
import { searchSongs, getTrendingSongs } from "@/lib/mockData";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  try {
    // If no query, return trending songs
    if (!query || query.trim() === "") {
      const trending = getTrendingSongs();
      return NextResponse.json({ results: trending, type: "trending" });
    }

    // Search for songs
    const results = searchSongs(query);
    return NextResponse.json({ results, type: "search" });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search songs" },
      { status: 500 }
    );
  }
}
