import { NextRequest, NextResponse } from "next/server";
import { withRouteHandler, jsonWithCache } from "@/lib/apiHandler";
import {
  numberOneOn, numberOnesBetween, conceptionWindow, parseIsoDate,
  HOT100_FIRST_ISSUE, HOT100_LAST_ISSUE, type NumberOne,
} from "@/lib/hot100";
import { coverArtFor, type CoverArt } from "@/lib/coverArt";

export interface NumberOneCard extends NumberOne {
  art: CoverArt | null;
}

export interface NumberOneResponse {
  date: string;
  birthday: NumberOneCard;
  conceived: { from: string; to: string; entries: NumberOneCard[] } | null;
}

async function withArt(n: NumberOne): Promise<NumberOneCard> {
  return { ...n, art: await coverArtFor(n.song, n.artist) };
}

/** GET /api/number-one?date=YYYY-MM-DD — the Hot 100 #1 on that date, plus the conception window. */
export const GET = withRouteHandler({ route: "numberOne" }, async (request: NextRequest) => {
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!parseIsoDate(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (date < HOT100_FIRST_ISSUE || date > HOT100_LAST_ISSUE) {
    return NextResponse.json(
      { error: `The Hot 100 covers ${HOT100_FIRST_ISSUE} to ${HOT100_LAST_ISSUE}` },
      { status: 404 },
    );
  }

  const birthdayRun = numberOneOn(date)!;
  const window = conceptionWindow(date);
  const conceivedRuns = window ? numberOnesBetween(window.from, window.to) : [];

  const [birthday, ...entries] = await Promise.all([withArt(birthdayRun), ...conceivedRuns.map(withArt)]);
  const body: NumberOneResponse = {
    date,
    birthday,
    conceived: window && entries.length ? { ...window, entries } : null,
  };
  // Chart history never changes; a week's answer is immutable once issued.
  return jsonWithCache(body, "public, s-maxage=604800, stale-while-revalidate=86400");
});
