import { NextResponse, type NextRequest } from "next/server";
import { lanesOn, numberOneOn, weekNearest, chartsThrough } from "@/lib/era/data";

// GET /api/week?date=YYYY-MM-DD — the chart week in force on a date, its #1 and every lane's #1.
// The console fetches this as soon as a destination is known, so the flight can label the
// branches of the timeline tree when it lands. History does not change: cache it hard.

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const week = weekNearest(date);
  const body = {
    date,
    chartWeek: week?.date ?? null,
    numberOne: numberOneOn(date),
    lanes: lanesOn(date).map(({ lane, label, song, artist }) => ({ lane, label, song, artist })),
  };
  const fresh = date >= chartsThrough();
  return NextResponse.json(body, {
    headers: { "Cache-Control": fresh ? "public, s-maxage=3600" : "public, max-age=86400, s-maxage=31536000, immutable" },
  });
}
