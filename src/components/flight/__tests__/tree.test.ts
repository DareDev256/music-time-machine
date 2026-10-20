import { describe, expect, it } from "vitest";
import { prepare, type FlightDoc } from "../data";
import { BRAID_R, BRAID_STRANDS, buildThreads, groupAt, LANES, NO_OLD, presence, SP, spineX, spineZ, threadAt } from "../tree";

// a synthetic chart: one week per 7 days from 1958-08-04 to 2026-09-19, newest last
function syntheticDoc(): FlightDoc {
  const weeks: Array<[string, number]> = [];
  for (let t = Date.parse("1958-08-04"); t <= Date.parse("2026-09-19"); t += 7 * 86_400_000) {
    weeks.push([new Date(t).toISOString().slice(0, 10), weeks.length % 3]);
  }
  return { through: weeks[weeks.length - 1][0], songs: [0, 1, 2].map((i) => ({ s: `S${i}`, a: `A${i}`, art: null })), weeks };
}
const yOf = (date: string) => -Math.round((Date.parse("2026-09-19") - Date.parse(date)) / (7 * 86_400_000)) * SP;

describe("tree threads", () => {
  const data = prepare(syntheticDoc());
  const threads = buildThreads(data);
  const laneStrands = (id: string) => threads.filter((t) => t.lane === id);

  it("braids the trunk from 40-60 strands inside the trunk radius", () => {
    const trunk = threads.filter((t) => t.kind === "trunk");
    expect(trunk.length).toBe(BRAID_STRANDS);
    expect(trunk.length).toBeGreaterThanOrEqual(40);
    expect(trunk.length).toBeLessThanOrEqual(60);
    for (const t of trunk) {
      const p = threadAt(t, -200, 1);
      expect(Math.hypot(p.x - spineX(-200), p.z - spineZ(-200))).toBeLessThanOrEqual(BRAID_R + 1e-9);
    }
  });

  it("gives every lane its own strand group", () => {
    for (const l of LANES) expect(laneStrands(l.lane).length).toBeGreaterThan(1);
  });

  it("lanes that predate the Hot 100 run the whole trunk", () => {
    expect(laneStrands("uk")[0].yOld).toBe(NO_OLD);
    expect(laneStrands("rnb_hiphop")[0].yOld).toBe(NO_OLD);
  });

  it("there is no rap limb before 1989: it folds into the trunk", () => {
    const rap = laneStrands("rap")[0];
    const y1985 = yOf("1985-06-01");
    expect(presence(rap, y1985)).toBe(0);
    const g = groupAt(rap, y1985, 1);
    expect(g.x).toBeCloseTo(spineX(y1985), 9);
    expect(g.z).toBeCloseTo(spineZ(y1985), 9);
    // and in 2012 it runs beside the trunk at its own radius
    const y2012 = yOf("2012-04-28");
    expect(presence(rap, y2012)).toBe(1);
    const g2 = groupAt(rap, y2012, 1);
    expect(Math.hypot(g2.x - spineX(y2012), g2.z - spineZ(y2012))).toBeCloseTo(LANES.find((l) => l.lane === "rap")!.radius, 6);
  });

  it("Canada joins in 2007, after rap", () => {
    expect(laneStrands("canada")[0].yOld).toBeGreaterThan(laneStrands("rap")[0].yOld);
  });

  it("offshoots exist only 2010–2014", () => {
    const off = threads.filter((t) => t.kind === "offshoot");
    expect(off.length).toBeGreaterThan(0);
    for (const o of off) {
      expect(presence(o, yOf("2005-06-01"))).toBe(0);
      expect(presence(o, yOf("2020-06-01"))).toBe(0);
    }
  });
});
