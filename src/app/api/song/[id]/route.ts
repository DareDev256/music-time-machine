import { NextRequest, NextResponse } from "next/server";
import { getSongData, getConfiguredApis } from "@/lib/dataFetcher";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const song = await getSongData(id);

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...song,
      _meta: {
        apis: getConfiguredApis(),
        useMock: process.env.USE_MOCK_DATA === "true",
      },
    });
  } catch (error) {
    console.error("Song fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch song data" },
      { status: 500 }
    );
  }
}
