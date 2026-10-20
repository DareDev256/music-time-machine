// POST /api/admin/review {id, decision: "approved" | "rejected", note?}: cookie-checked, then a
// Convex mutation with the server secret. Accepts JSON (answers JSON) or a plain HTML form post
// from /admin (answers 303 back to /admin, so moderating works with no client JS on a phone).

import { NextResponse, type NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { cookieFromHeader, isAdminCookie, sameOrigin } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };
const MAX_BODY = 2048;

type Review = { id: string; decision: "approved" | "rejected"; note?: string };

function parseReview(input: Record<string, unknown>): Review | null {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const decision = input.decision;
  if (!/^[a-z0-9]{10,64}$/i.test(id) || (decision !== "approved" && decision !== "rejected")) return null;
  const note = typeof input.note === "string" ? input.note.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim().slice(0, 280) : "";
  return { id, decision, ...(note ? { note } : {}) };
}

export async function POST(request: NextRequest) {
  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  const isForm = type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data");
  // A form post always lands back on /admin (with ?error= on failure); JSON callers get status + JSON.
  const reply = (status: number, body: { ok: boolean; error?: string }) => {
    if (!isForm) return NextResponse.json(body, { status, headers: HEADERS });
    const to = new URL("/admin", request.nextUrl);
    if (status >= 400 && body.error) to.searchParams.set("error", body.error);
    return NextResponse.redirect(to, { status: 303, headers: HEADERS });
  };

  if (!sameOrigin(request) || !isAdminCookie(cookieFromHeader(request.headers.get("cookie")))) {
    return reply(401, { ok: false, error: "Not signed in." });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return reply(413, { ok: false, error: "Too long." });

  let input: Record<string, unknown> = {};
  try {
    if (isForm) input = Object.fromEntries((await request.formData()).entries());
    else if (type.includes("application/json")) input = (await request.json()) as Record<string, unknown>;
    else return reply(415, { ok: false, error: "Send JSON or a form." });
  } catch {
    return reply(400, { ok: false, error: "Unreadable body." });
  }
  const review = input && typeof input === "object" ? parseReview(input) : null;
  if (!review) return reply(400, { ok: false, error: "Need an id and a decision of approved or rejected." });

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CONVEX_SERVER_SECRET;
  if (!url || !secret) return reply(503, { ok: false, error: "Storage not configured." });

  try {
    const res = await new ConvexHttpClient(url).mutation(api.submissions.review, { secret, ...review });
    if (!res.ok) return reply(404, { ok: false, error: "No such submission." });
    return reply(200, { ok: true });
  } catch (e) {
    console.error(`review: failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`);
    return reply(502, { ok: false, error: "Couldn't save the review." });
  }
}
