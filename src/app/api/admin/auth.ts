// Moderator auth for /admin. One shared ADMIN_TOKEN (in ~/.secrets/wasplaying-admin-token).
// GET /admin?key=<token> once → an HttpOnly, Secure, SameSite=Strict cookie holding a hash of the
// token (never the token) for 30 days. Every check is constant-time and refuses when ADMIN_TOKEN is unset.

import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "wp_admin";
export const ADMIN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // seconds
const MIN_TOKEN_LENGTH = 32;

function sha256(s: string): Buffer {
  return createHash("sha256").update(s).digest();
}

function token(): string | null {
  const t = process.env.ADMIN_TOKEN ?? "";
  return t.length >= MIN_TOKEN_LENGTH ? t : null;
}

/** The cookie value for a token: a domain-separated hash, so the cookie is not the token itself. */
export function cookieValueFor(t: string): string {
  return sha256(`was-playing-admin-session:${t}`).toString("hex");
}

/** Constant-time compare of two strings via their hashes (equal-length buffers, no length leak). */
function same(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

/** Does this ?key= match ADMIN_TOKEN? */
export function keyMatches(candidate: string | null | undefined): boolean {
  const t = token();
  if (!t || !candidate) return false;
  return same(candidate, t);
}

/** Is this cookie value a valid admin session? */
export function isAdminCookie(value: string | null | undefined): boolean {
  const t = token();
  if (!t || !value) return false;
  return same(value, cookieValueFor(t));
}

/** Set-Cookie header value for a signed-in moderator. */
export function adminSetCookie(): string | null {
  const t = token();
  if (!t) return null;
  return `${ADMIN_COOKIE}=${cookieValueFor(t)}; Path=/; Max-Age=${ADMIN_COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}

/** Reads the admin cookie out of a raw Cookie header. */
export function cookieFromHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === ADMIN_COOKIE) return v.join("=");
  }
  return null;
}

/**
 * Same-origin check for state-changing admin requests. SameSite=Strict already keeps the cookie off
 * cross-site POSTs; this refuses a request whose Origin names another site even if a browser sent it.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin form posts from some browsers omit it; the Strict cookie still gates
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
