import { describe, expect, it } from "vitest";
import { prepare, type FlightDoc } from "../data";
import { buildThreads, groupAt, LANES, NO_END, NO_START, presence, SP, spineX, spineY, threadAt, TRUNK_STRANDS } from "../tree";

// a synthetic chart: one week per 7 days from 1958-08-04 to 2026-09-19, newest last
function syntheticDoc(): FlightDoc {
  const weeks: Array<[string, number]> = [];
  for (let t = Date.parse("1958-08-04"); t <= Date.parse("2026-09-19"); t += 7 * 86_400_000) {
    weeks.push([new Date(t).toISOString().slice(0, 10), weeks.length % 3]);
  }
  return { through: weeks[weeks.length - 1][0], songs: [0, 1, 2].map((i) => ({ s: `S${i}`, a: `A${i}`, art: null })), weeks };
}
const zOf = (date: string) => -Math.round((Date.parse("2026-09-19") - Date.parse(date)) / (7 * 86_400_000)) * SP;

describe("tree", () => {
  const data = prepare(syntheticDoc());
  const threads = buildThreads(data);
  const trunk = threads.filter((t) => t.kind === "trunk");

  it("is a helix of many trunk strands, each 2–6 units from the spine", () => {
    expect(trunk.length).toBe(TRUNK_STRANDS);
    for (const t of trunk)
      for (const z of [-10, -400, -1700, -3900]) {
        const p = threadAt(t, z);
        const r = Math.hypot(p.x - spineX(z), p.y - spineY(z));
        expect(r).toBeGreaterThanOrEqual(2 - 1e-9);
        expect(r).toBeLessThanOrEqual(6 + 1e-9);
      }
  });

  it("no two strands alike: widths and brightness vary", () => {
    expect(new Set(trunk.map((t) => t.alpha.toFixed(3))).size).toBeGreaterThan(TRUNK_STRANDS * 0.8);
    expect(new Set(trunk.map((t) => t.minPx.toFixed(3))).size).toBeGreaterThan(TRUNK_STRANDS * 0.8);
  });

  it("each lane splits 3–5 ways at varied angles, and not every fork runs to the present", () => {
    for (const l of LANES) {
      const strands = threads.filter((t) => t.lane === l.lane);
      const forks = [...new Set(strands.map((t) => t.fork))];
      expect(forks.length).toBeGreaterThanOrEqual(3);
      expect(forks.length).toBeLessThanOrEqual(5);
      const angles = forks.map((f) => strands.find((t) => t.fork === f)!.ang0.toFixed(3));
      expect(new Set(angles).size).toBe(forks.length);
      expect(strands.find((t) => t.fork === 0)!.zEnd).toBe(NO_END);
    }
    const stopped = threads.filter((t) => t.kind === "lane" && t.zEnd < 0).length;
    expect(stopped).toBeGreaterThan(0);
  });

  it("there is no rap branch before 1989; in 2012 it is out among the others", () => {
    const rap = threads.filter((t) => t.lane === "rap" && t.fork === 0);
    for (const t of rap) {
      expect(presence(t, zOf("1985-06-01"))).toBe(0);
      expect(presence(t, zOf("2012-04-28"))).toBe(1);
      const g = groupAt(t, zOf("2012-04-28"));
      expect(Math.hypot(g.x - spineX(g.z), g.y - spineY(g.z))).toBeGreaterThan(3);
    }
  });

  it("lanes that predate the Hot 100 are out from the first week", () => {
    expect(threads.find((t) => t.lane === "uk")!.zStart).toBe(NO_START);
  });

  it("offshoots exist only 2010–2014", () => {
    const off = threads.filter((t) => t.kind === "offshoot");
    expect(off.length).toBeGreaterThan(0);
    for (const o of off) {
      expect(presence(o, zOf("2005-06-01"))).toBe(0);
      expect(presence(o, zOf("2020-06-01"))).toBe(0);
    }
  });
});
