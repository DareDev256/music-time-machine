// Was Playing: listener submissions ("Remembered by listeners").
// Writes arrive only through the Next API routes, which pass SERVER_SECRET; nothing here is
// writable from a browser. Everything starts "pending" and goes live only once approved.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const verdictValidator = v.union(
  v.literal("consistent"),
  v.literal("blew-up-later"),
  v.literal("before-release"),
  v.literal("unverified"),
);

export const statusValidator = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"));

/** What the fact-check found at submit time: each dated source, the earliest of them, and the verdict. */
export const evidenceValidator = v.object({
  known: v.array(v.object({ source: v.string(), date: v.string(), label: v.string() })),
  earliest: v.optional(v.string()),
  verdict: verdictValidator,
});

export default defineSchema({
  submissions: defineTable({
    song: v.string(),
    artist: v.string(),
    month: v.string(), // "YYYY-MM": when the listener says it was hot
    note: v.optional(v.string()),
    link: v.optional(v.string()),
    status: statusValidator,
    evidence: evidenceValidator,
    createdAt: v.number(),
    ipHash: v.string(), // sha256(IP_SALT + ip), never the IP
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_status_month", ["status", "month"])
    // The rate limit counts one hash's submissions in the last hour.
    .index("by_ip_created", ["ipHash", "createdAt"])
    .index("by_reviewed", ["reviewedAt"]),
});
