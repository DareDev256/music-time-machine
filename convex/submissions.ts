// Listener submissions. Every function that reads private fields or writes takes `secret`, compared
// in constant time against the deployment's SERVER_SECRET env var; only the Next server holds it.
// `approvedForMonth` is the one public read, and it returns public fields only.

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { evidenceValidator, verdictValidator } from "./schema";

const HOUR = 3_600_000;
export const RATE_LIMIT_PER_HOUR = 5;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Constant-time string compare (the Convex runtime has no node:crypto timingSafeEqual). */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Refuses when SERVER_SECRET is unset or short, so a misconfigured deployment accepts nothing. */
function requireSecret(secret: string): void {
  const expected = process.env.SERVER_SECRET ?? "";
  if (expected.length < 32 || !safeEqual(secret, expected)) throw new Error("unauthorized");
}

function within(s: string | undefined, min: number, max: number): boolean {
  return s === undefined || (s.length >= min && s.length <= max);
}

/** How many submissions this IP hash made in the last hour. */
export const recentCount = query({
  args: { secret: v.string(), ipHash: v.string() },
  handler: async (ctx, { secret, ipHash }) => {
    requireSecret(secret);
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_ip_created", (q) => q.eq("ipHash", ipHash).gt("createdAt", Date.now() - HOUR))
      .take(RATE_LIMIT_PER_HOUR);
    return rows.length;
  },
});

/** Store a submission as pending. Re-checks the rate limit inside the transaction, so a burst cannot race past it. */
export const create = mutation({
  args: {
    secret: v.string(),
    song: v.string(),
    artist: v.string(),
    month: v.string(),
    note: v.optional(v.string()),
    link: v.optional(v.string()),
    ipHash: v.string(),
    evidence: evidenceValidator,
  },
  handler: async (ctx, { secret, ...a }) => {
    requireSecret(secret);
    if (!within(a.song, 1, 120) || !within(a.artist, 1, 120) || !within(a.note, 0, 280) || !within(a.link, 1, 400) || !MONTH_RE.test(a.month)) {
      throw new Error("invalid submission");
    }
    const now = Date.now();
    const recent = await ctx.db
      .query("submissions")
      .withIndex("by_ip_created", (q) => q.eq("ipHash", a.ipHash).gt("createdAt", now - HOUR))
      .take(RATE_LIMIT_PER_HOUR);
    if (recent.length >= RATE_LIMIT_PER_HOUR) return { ok: false as const, reason: "rate" as const };
    const id = await ctx.db.insert("submissions", { ...a, status: "pending", createdAt: now });
    return { ok: true as const, id };
  },
});

/** The moderation queue: pending newest first, plus the most recently reviewed. */
export const adminList = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireSecret(secret);
    const pending = await ctx.db.query("submissions").withIndex("by_status", (q) => q.eq("status", "pending")).order("desc").take(50);
    const recent = await ctx.db.query("submissions").withIndex("by_reviewed", (q) => q.gt("reviewedAt", 0)).order("desc").take(12);
    // The IP hash never leaves Convex, not even to the moderator.
    const strip = (row: (typeof pending)[number]) => {
      const { ipHash, ...rest } = row;
      void ipHash;
      return rest;
    };
    return { pending: pending.map(strip), recent: recent.map(strip) };
  },
});

/** Approve or reject one submission. */
export const review = mutation({
  args: {
    secret: v.string(),
    id: v.string(),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { secret, id, decision, note }) => {
    requireSecret(secret);
    const docId = ctx.db.normalizeId("submissions", id);
    if (!docId) return { ok: false as const, reason: "not-found" as const };
    const doc = await ctx.db.get(docId);
    if (!doc) return { ok: false as const, reason: "not-found" as const };
    await ctx.db.patch(docId, {
      status: decision,
      reviewedAt: Date.now(),
      reviewNote: note ? note.slice(0, 280) : undefined,
    });
    return { ok: true as const };
  },
});

/** Public read for the era page: approved submissions for one month, newest first, public fields only. */
export const approvedForMonth = query({
  args: { month: v.string() },
  returns: v.array(
    v.object({
      song: v.string(),
      artist: v.string(),
      note: v.optional(v.string()),
      link: v.optional(v.string()),
      verdict: verdictValidator,
      earliest: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { month }) => {
    if (!MONTH_RE.test(month)) return [];
    const rows = await ctx.db
      .query("submissions")
      .withIndex("by_status_month", (q) => q.eq("status", "approved").eq("month", month))
      .order("desc")
      .take(20);
    return rows.map((r) => ({
      song: r.song,
      artist: r.artist,
      note: r.note,
      link: r.link,
      verdict: r.evidence.verdict,
      earliest: r.evidence.earliest,
    }));
  },
});

/** Operator cleanup (CLI/dashboard only: `npx convex run submissions:purge '{"ids":[...]}'`). */
export const purge = internalMutation({
  args: { ids: v.array(v.id("submissions")) },
  handler: async (ctx, { ids }) => {
    let deleted = 0;
    for (const id of ids) {
      if (await ctx.db.get(id)) {
        await ctx.db.delete(id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/** Operator lookup (CLI only): ids of submissions matching a song + artist, for cleanup. */
export const findIds = internalQuery({
  args: { song: v.string(), artist: v.string() },
  handler: async (ctx, { song, artist }) => {
    const all = await ctx.db.query("submissions").collect();
    return all.filter((r) => r.song === song && r.artist === artist).map((r) => r._id);
  },
});
