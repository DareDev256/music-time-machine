// POST /api/submit: a listener says "this was hot in YYYY-MM". Validates, rate limits by a salted
// IP hash (5 an hour, counted in Convex), fact-checks the dates server-side, and stores the
// submission as pending. The response carries the verdict only, never the evidence.

import { NextResponse, type NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { extractClientIp } from "@/lib/rateLimit";
import { verdictFor } from "@/lib/era/verdict";
import { checkSubmission, MAX_BODY_BYTES } from "./validate";
import { gatherEvidence } from "./factCheck";
import { hashIp } from "./ipHash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_PER_HOUR = 5;
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...HEADERS, ...extra } });
}

export async function POST(request: NextRequest) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) return json({ ok: false, error: "Send JSON." }, 415);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ ok: false, error: "That is too long." }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: "That is too long." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Send valid JSON." }, 400);
  }

  const checked = checkSubmission(body);
  // A filled honeypot gets the same answer a person would, and nothing is stored.
  if (checked.kind === "honeypot") return json({ ok: true, verdict: "unverified" });
  if (checked.kind === "invalid") return json({ ok: false, field: checked.field, error: checked.error }, 400);

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CONVEX_SERVER_SECRET;
  const salt = process.env.IP_SALT;
  if (!url || !secret || !salt) {
    console.error("submit: storage not configured (NEXT_PUBLIC_CONVEX_URL / CONVEX_SERVER_SECRET / IP_SALT)");
    return json({ ok: false, error: "Submissions are closed right now." }, 503);
  }

  const ipHash = hashIp(extractClientIp(request), salt);
  const convex = new ConvexHttpClient(url);
  const tooMany = () => json({ ok: false, error: "That's five in an hour from here. Try again later." }, 429, { "Retry-After": "3600" });

  try {
    // Count first, so a flood never reaches MusicBrainz or iTunes.
    const recent = await convex.query(api.submissions.recentCount, { secret, ipHash });
    if (recent >= RATE_LIMIT_PER_HOUR) return tooMany();

    const { song, artist, month, note, link } = checked.value;
    const evidence = verdictFor(month, await gatherEvidence(song, artist));
    const saved = await convex.mutation(api.submissions.create, {
      secret, song, artist, month, ipHash,
      ...(note ? { note } : {}),
      ...(link ? { link } : {}),
      evidence: { known: evidence.known, verdict: evidence.verdict, ...(evidence.earliest ? { earliest: evidence.earliest } : {}) },
    });
    if (!saved.ok) return tooMany();
    return json({ ok: true, verdict: evidence.verdict });
  } catch (e) {
    console.error(`submit: storage failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`);
    return json({ ok: false, error: "Couldn't save that. Try again in a minute." }, 502);
  }
}
