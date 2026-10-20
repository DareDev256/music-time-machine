// POST /api/admin/session (form field `key`): the sign-in form on /admin posts here because a page
// cannot set cookies. The key travels in the body, never the URL, so it stays out of request logs and
// history. A matching key sets the moderator cookie and moves on to /admin through a
// same-site meta refresh (a plain 30x would ride the original navigation, and if that came from
// another site, Safari and Chrome would hold back the SameSite=Strict cookie on the first /admin load).

import { NextResponse, type NextRequest } from "next/server";
import { adminSetCookie, keyMatches } from "../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

export async function POST(request: NextRequest) {
  let key: string | null = null;
  try {
    const form = await request.formData();
    const v = form.get("key");
    key = typeof v === "string" ? v.slice(0, 200) : null;
  } catch {
    key = null;
  }
  const cookie = keyMatches(key) ? adminSetCookie() : null;
  if (!cookie) {
    return NextResponse.redirect(new URL("/admin?error=key", request.nextUrl), { status: 303, headers: NO_STORE });
  }
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta http-equiv="refresh" content="0;url=/admin">' +
    "<title>Signed in</title></head>" +
    '<body><a href="/admin">Signed in. Open the queue →</a></body></html>'; // no inline styles: the CSP has no unsafe-inline
  return new NextResponse(html, {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8", "Set-Cookie": cookie },
  });
}
