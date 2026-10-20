#!/usr/bin/env node
// Prints the moderation queue as one JSON line: {"pending":N,"oldestHours":H,"songs":["Song · Artist · YYYY-MM", ...]}
// Reads the production Convex URL and the server secret from ~/.secrets; never prints the secret.
// Exit 2 when the queue cannot be read, so a caller never mistakes a broken read for an empty queue.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://blessed-deer-298.convex.cloud";
let secret;
try {
  secret = readFileSync(`${homedir()}/.secrets/wasplaying-server-secret`, "utf8").trim();
} catch {
  console.error("no ~/.secrets/wasplaying-server-secret");
  process.exit(2);
}

try {
  const { pending } = await new ConvexHttpClient(URL).query(api.submissions.adminList, { secret });
  const oldest = pending.length ? Math.min(...pending.map((r) => r.createdAt)) : null;
  console.log(JSON.stringify({
    pending: pending.length,
    oldestHours: oldest ? Math.round((Date.now() - oldest) / 36e5) : 0,
    songs: pending.slice(0, 5).map((r) => `${r.song} · ${r.artist} · ${r.month}`),
  }));
} catch (e) {
  console.error(`queue read failed: ${e?.message ?? e}`);
  process.exit(2);
}
