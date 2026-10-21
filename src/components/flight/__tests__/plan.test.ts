import { describe, expect, it } from "vitest";
import { prepare, type FlightDoc } from "../data";
import { flightDuration, yearsBetween } from "../easing";
import { flightPlan, prerollPlan } from "../plan";

// one week per 7 days 1958 → 2026, a new #1 every 3 weeks
function doc(): FlightDoc {
  const weeks: Array<[string, number]> = [];
  for (let t = Date.parse("1958-08-04"); t <= Date.parse("2026-09-19"); t += 7 * 86_400_000) {
    weeks.push([new Date(t).toISOString().slice(0, 10), Math.floor(weeks.length / 3) % 400]);
  }
  return { through: weeks[weeks.length - 1][0], songs: Array.from({ length: 400 }, (_, i) => ({ s: `S${i}`, a: `A${i}`, art: `https://x/${i}/{w}x{h}bb.jpg` })), weeks };
}
const SP = 1.15;

describe("flightPlan", () => {
  const data = prepare(doc());
  const targetIdx = data.dates.indexOf("2012-04-28") >= 0 ? data.dates.indexOf("2012-04-28") : data.dates.findIndex((d) => d <= "2012-04-28");
  const dur = flightDuration(yearsBetween(data.dates[0], data.dates[targetIdx]));
  const shape = { d0: 0, d1: targetIdx * SP, dur, sp: SP, targetIdx, landingBehind: 8, landingAhead: 30, viewAhead: 74 };
  const plan = flightPlan(data, shape, 1000);
  const path = plan.slice(plan.findIndex((p) => p.until < 1000 + dur * 1000 + 1)); // skip the landing block

  it("covers every #1 run between here and the landing", () => {
    const runsOnPath = data.runOf[Math.min(data.dates.length - 1, targetIdx + 30)] + 1;
    expect(path.length).toBe(runsOnPath);
  });
  it("puts the landing neighbourhood first, then the path in the order the camera reaches it", () => {
    expect(plan[0].until).toBeGreaterThan(1000 + dur * 1000);
    for (let i = 1; i < path.length; i++) expect(path[i].at).toBeGreaterThanOrEqual(path[i - 1].at);
  });
  it("every cover comes into view before the camera passes it, and inside the flight", () => {
    for (const p of path) {
      expect(p.until).toBeGreaterThanOrEqual(p.at);
      expect(p.at).toBeGreaterThanOrEqual(1000);
      expect(p.until).toBeLessThanOrEqual(1000 + dur * 1000 + 1e-6);
    }
  });
  it("fast out: most covers on a 2012 flight are passed in the first half of it", () => {
    const half = 1000 + (dur * 1000) / 2;
    expect(path.filter((p) => p.until <= half).length / path.length).toBeGreaterThan(0.7);
  });
});

describe("prerollPlan", () => {
  const data = prepare(doc());
  it("plans the runs ahead of the camera, in order, timed at the pre-roll speed", () => {
    const plan = prerollPlan(data, 100, 110, SP, 74, 0);
    expect(plan.length).toBeGreaterThan(100);
    for (let i = 1; i < plan.length; i++) expect(plan[i].until).toBeGreaterThanOrEqual(plan[i - 1].until);
    expect(plan[0].at).toBe(0);
  });
});
