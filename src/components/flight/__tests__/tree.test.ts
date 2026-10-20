import { describe, expect, it } from "vitest";
import { prepare, type FlightDoc } from "../data";
import { buildThreads, LANES, NO_OLD, presence, SP, threadAt, trunkX, trunkY } from "../tree";

// a synthetic chart: one week per 7 days from 1958-08-04 to 2026-09-19, newest last
function syntheticDoc(): FlightDoc {
  const weeks: Array<[string, number]> = [];
  for (let t = Date.parse("1958-08-04"); t <= Date.parse("2026-09-19"); t += 7 * 86_400_000) {
    weeks.push([new Date(t).toISOString().slice(0, 10), weeks.length % 3]);
  }
  return { through: weeks[weeks.length - 1][0], songs: [0, 1, 2].map((i) => ({ s: `S${i}`, a: `A${i}`, art: null })), weeks };
}

describe("tree threads", () => {
  const data = prepare(syntheticDoc());
  const threads = buildThreads(data);
  const lane = (id: string) => threads.find((t) => t.lane === id)!;

  it("has one trunk and a branch per lane", () => {
    expect(threads.filter((t) => t.kind === "trunk")).toHaveLength(1);
    expect(threads.filter((t) => t.kind === "lane").map((t) => t.lane)).toEqual(LANES.map((l) => l.lane));
  });

  it("lanes that predate the Hot 100 run the whole trunk", () => {
    expect(lane("uk").zOld).toBe(NO_OLD);
    expect(lane("rnb_hiphop").zOld).toBe(NO_OLD);
  });

  it("rap merges into the trunk at March 1989 and Canada at 2007", () => {
    const rap = lane("rap");
    const canada = lane("canada");
    const zRap = rap.zOld;
    // before the lane began it is folded into the trunk; a year later it is fully out
    expect(presence(rap, zRap - 5)).toBe(0);
    expect(presence(rap, zRap + 60)).toBe(1);
    const p = threadAt(rap, zRap - 5, 1);
    expect(p.x).toBeCloseTo(trunkX(zRap - 5), 9);
    expect(p.y).toBeCloseTo(trunkY(zRap - 5), 9);
    expect(canada.zOld).toBeGreaterThan(zRap); // 2007 is nearer the present than 1989
    // 2012-04-28 sits about 14.4 years back: Canada present, rap present
    const z2012 = -Math.round((Date.parse("2026-09-19") - Date.parse("2012-04-28")) / (7 * 86_400_000)) * SP;
    expect(presence(canada, z2012)).toBe(1);
    expect(presence(rap, z2012)).toBe(1);
  });

  it("a fully-out branch sits at its radius from the trunk", () => {
    const t = lane("country");
    const z = -100;
    const p = threadAt(t, z, 1);
    expect(Math.hypot(p.x - trunkX(z), p.y - trunkY(z))).toBeCloseTo(t.radius, 6);
    expect(Math.hypot(threadAt(t, z, 0.5).x - trunkX(z), threadAt(t, z, 0.5).y - trunkY(z))).toBeCloseTo(t.radius / 2, 6);
  });

  it("offshoots exist only 2010–2014", () => {
    const off = threads.filter((t) => t.kind === "offshoot");
    expect(off.length).toBeGreaterThan(0);
    const z2005 = -Math.round((Date.parse("2026-09-19") - Date.parse("2005-06-01")) / (7 * 86_400_000)) * SP;
    const z2020 = -Math.round((Date.parse("2026-09-19") - Date.parse("2020-06-01")) / (7 * 86_400_000)) * SP;
    for (const o of off) {
      expect(presence(o, z2005)).toBe(0);
      expect(presence(o, z2020)).toBe(0);
    }
  });
});
