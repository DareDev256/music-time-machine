// GET /api/resolve?q= — own-index lookup only (spec §12.1: MusicBrainz and iTunes are called from the browser).
// Reads public/era/index.json once per server instance. A missing index answers { rows: [] } with
// x-index: missing so the browser falls through to MusicBrainz and iTunes instead of erroring.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prepareIndex, searchIndex, type PreparedIndex } from "@/lib/era/resolve";
import { hasControlChars } from "@/lib/era/normalize";

export const runtime = "nodejs";

const INDEX_FILE = path.join(process.cwd(), "public", "era", "index.json");
// The channel crawl's songs (build_index.py), generated on deploy and never committed: YouTube API data may be kept
// 30 days and git history keeps everything. Optional: without it the index is the charts, lanes, blogs and seed.
const YT_FILE = path.join(process.cwd(), "public", "era", "index-yt.json");
const MAX_Q = 200;

type Loaded = { state: "ok"; index: PreparedIndex } | { state: "missing" | "invalid" };
let cached: Promise<PreparedIndex> | null = null;

async function loadIndex(): Promise<Loaded> {
  if (!cached) {
    // Missing or unreadable YouTube rows cost only those rows, never the index.
    const yt = readFile(YT_FILE, "utf8").then(
      (t) => {
        try {
          const r = (JSON.parse(t) as { rows?: unknown }).rows;
          return Array.isArray(r) ? r : [];
        } catch {
          console.error("resolve: index-yt.json unreadable; serving the index without YouTube rows");
          return [];
        }
      },
      () => [],
    );
    cached = Promise.all([readFile(INDEX_FILE, "utf8"), yt]).then(([text, ytRows]) => {
      const doc = JSON.parse(text) as { rows?: unknown };
      if (!Array.isArray(doc?.rows)) throw Object.assign(new Error("index.json has no rows"), { code: "EINVALID" });
      return prepareIndex(Array.isArray(ytRows) ? [...doc.rows, ...ytRows] : doc.rows);
    });
  }
  try {
    return { state: "ok", index: await cached };
  } catch (e) {
    // Not cached: the lead's build may write the file after this instance started.
    cached = null;
    const code = (e as { code?: string })?.code;
    if (code !== "ENOENT") console.error(`resolve: index.json unreadable (${e instanceof Error ? e.message : "unknown"})`);
    return { state: code === "ENOENT" ? "missing" : "invalid" };
  }
}

const bad = (error: string) =>
  NextResponse.json({ error }, { status: 400, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (q === null || !q.trim()) return bad("q is required");
  if (q.length > MAX_Q) return bad(`q must be at most ${MAX_Q} characters`);
  if (hasControlChars(q)) return bad("q must not contain control characters");

  const loaded = await loadIndex();
  if (loaded.state !== "ok") {
    return NextResponse.json(
      { rows: [] },
      { status: 200, headers: { "Cache-Control": "no-store", "x-index": loaded.state, "X-Content-Type-Options": "nosniff" } },
    );
  }
  return NextResponse.json(
    { rows: searchIndex(loaded.index, q, 8) },
    { status: 200, headers: { "Cache-Control": "public, s-maxage=86400", "X-Content-Type-Options": "nosniff" } },
  );
}
