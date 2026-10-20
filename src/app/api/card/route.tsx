import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { withRouteHandler } from "@/lib/apiHandler";
import { indexRow } from "@/lib/era/data";
import { coverData } from "./covers";
import { buildCard, buildDefault } from "./model";
import { CARD_SIZE, parseCardParams } from "./params";
import { DefaultCard, StoryCard, WideCard } from "./render";

// Node, not edge: the era shards and fonts are read from disk.
export const runtime = "nodejs";

const PARAM_CACHE = "public, max-age=86400, s-maxage=604800, immutable";
// The default card shows "charts through", which moves weekly.
const DEFAULT_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

type FontSpec = { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" };
let fonts: FontSpec[] | null = null;
function cardFonts(): FontSpec[] {
  if (!fonts) {
    // Static TTFs (Satori cannot read woff2). Licences: public/fonts/LICENSES.md.
    const dir = path.join(process.cwd(), "public", "fonts");
    const read = (file: string) => readFileSync(path.join(dir, file));
    fonts = [
      { name: "Archivo", data: read("Archivo-Condensed68-ExtraBold.ttf"), weight: 800, style: "normal" },
      { name: "JetBrains Mono", data: read("JetBrainsMono-Regular.ttf"), weight: 400, style: "normal" },
      { name: "JetBrains Mono", data: read("JetBrainsMono-SemiBold.ttf"), weight: 600, style: "normal" },
      { name: "DSEG7", data: read("DSEG7Classic-Bold.ttf"), weight: 700, style: "normal" },
    ];
  }
  return fonts;
}

/** GET /api/card?song=&artist=&date=YYYY-MM-DD&format=story|wide → PNG share card. */
export const GET = withRouteHandler({ route: "og" }, async (request: NextRequest) => {
  const req = parseCardParams(request.nextUrl.searchParams, {
    lookupDate: (song, artist) => (artist ? indexRow(song, artist)?.d ?? null : null),
  });
  if (req.kind === "error") {
    return NextResponse.json(
      { error: req.error },
      { status: req.status, headers: { "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } },
    );
  }

  const { width, height } = CARD_SIZE[req.format];
  const options = (cache: string) => ({ width, height, fonts: cardFonts(), headers: { "Cache-Control": cache } });

  if (req.kind === "default") {
    const m = buildDefault();
    const images = await Promise.all(m.covers.map((c) => coverData(c.cover)));
    return new ImageResponse(<DefaultCard m={m} images={images} format={req.format} />, options(DEFAULT_CACHE));
  }

  const m = buildCard(req);
  const numberOne = await coverData(m.numberOne?.cover);
  const card = req.format === "story" ? <StoryCard m={m} images={{ numberOne }} /> : <WideCard m={m} images={{ numberOne }} />;
  return new ImageResponse(card, options(PARAM_CACHE));
});
