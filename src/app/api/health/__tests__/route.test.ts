// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const files = vi.hoisted(() => new Map<string, string>());
const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(async (p: string) => {
    const k = [...files.keys()].find((f) => p.endsWith(f));
    if (!k) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    return files.get(k)!;
  }),
  readdir: vi.fn(async (p: string) => {
    const dir = p.split("/era/")[1] ?? "";
    const names = [...files.keys()].filter((f) => f.startsWith(`${dir}/`)).map((f) => f.slice(dir.length + 1));
    if (!names.length) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    return names;
  }),
}));
vi.mock("node:fs/promises", () => ({ ...fsMock, default: fsMock }));

const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
function base() {
  files.clear();
  files.set("flight.json", JSON.stringify({ through: ago(3), songs: [{ art: "x" }] }));
  files.set("lanes/index.json", JSON.stringify({ lanes: [{ lane: "rap" }] }));
  files.set("heat/2012-05.json", "{}");
}
async function health() {
  const { GET } = await import("@/app/api/health/route");
  const res = await GET();
  return { status: res.status, body: (await res.json()) as { status: string; checks: { youtube: Record<string, unknown> } } };
}

beforeEach(base);

describe("/api/health: YouTube counts", () => {
  it("is fine before the crawl exists", async () => {
    const { status, body } = await health();
    expect(status).toBe(200);
    expect(body.checks.youtube).toMatchObject({ state: "not built", ok: true });
  });
  it("is healthy with fresh counts and reports the oldest month's age", async () => {
    files.set("youtube/index.json", "{}");
    files.set("youtube/2015-02.json", JSON.stringify({ viewsAsOf: ago(2) }));
    files.set("youtube/2012-04.json", JSON.stringify({ viewsAsOf: ago(6) }));
    const { status, body } = await health();
    expect(status).toBe(200);
    expect(body.checks.youtube).toMatchObject({ months: 2, oldestCounts: ago(6), ageDays: 6, ok: true });
  });
  it("degrades when any month's counts are over 14 days old, or every month was deleted as stale", async () => {
    files.set("youtube/index.json", "{}");
    files.set("youtube/2015-02.json", JSON.stringify({ viewsAsOf: ago(2) }));
    files.set("youtube/2012-04.json", JSON.stringify({ viewsAsOf: ago(15) }));
    expect((await health()).status).toBe(503);
    files.delete("youtube/2015-02.json");
    files.delete("youtube/2012-04.json");
    const gone = await health();
    expect(gone.status).toBe(503);
    expect(gone.body.checks.youtube).toMatchObject({ months: 0, ok: false });
  });
});
