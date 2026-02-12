import { NextResponse } from "next/server";
import { getArtistData } from "@/lib/dataFetcher";
import { isValidId } from "@/lib/rateLimit";
import { withRouteHandler } from "@/lib/apiHandler";

export const GET = withRouteHandler({ route: "artist" }, async (_request, { params }) => {
  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid artist ID" }, { status: 400 });
  }

  const artist = await getArtistData(id);
  if (!artist) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  return NextResponse.json(artist);
});
