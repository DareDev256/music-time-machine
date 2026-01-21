import { NextRequest, NextResponse } from "next/server";
import { getSongById } from "@/lib/mockData";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const song = getSongById(id);

    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    return NextResponse.json(song);
  } catch (error) {
    console.error("Song fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch song data" },
      { status: 500 }
    );
  }
}
