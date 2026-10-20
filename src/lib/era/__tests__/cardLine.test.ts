import { describe, it, expect } from "vitest";
import { cardLine, seasonOf } from "../cardLine";

describe("seasonOf", () => {
  it("maps months to seasons", () => {
    expect(seasonOf("2012-04-28")).toBe("SPRING 2012");
    expect(seasonOf("2012-07-04")).toBe("SUMMER 2012");
    expect(seasonOf("2012-10-01")).toBe("FALL 2012");
    expect(seasonOf("2012-02-10")).toBe("WINTER 2012");
  });
  it("puts December in the next year's winter", () => {
    expect(seasonOf("2012-12-20")).toBe("WINTER 2013");
  });
});

describe("cardLine", () => {
  const gotye = { song: "Somebody That I Used To Know", artist: "Gotye Featuring Kimbra" };
  it("is a contrast between you and the world", () => {
    expect(cardLine({ song: "Cuz My Gear", artist: "Chief Keef & Riff Raff", date: "2012-04-28", numberOne: gotye }))
      .toEqual({ season: "SPRING 2012", me: "I WAS ON CHIEF KEEF & RIFF RAFF", world: "THE WORLD WAS ON GOTYE" });
  });
  it("says so when you were on the #1 artist", () => {
    const l = cardLine({ song: "Somebody That I Used To Know", artist: "Gotye", date: "2012-04-28", numberOne: gotye });
    expect(l.world).toBe("SO WAS EVERYONE");
  });
  it("falls back to the #1 when there is no song", () => {
    const l = cardLine({ date: "1999-07-10", numberOne: { song: "Bills, Bills, Bills", artist: "Destiny's Child" } });
    expect(l).toEqual({ season: "SUMMER 1999", me: "THE #1 WAS BILLS, BILLS, BILLS", world: "BY DESTINY'S CHILD" });
  });
  it("keeps names that contain commas or ampersands whole", () => {
    expect(cardLine({ song: "A", artist: "Tyler, The Creator", date: "2012-04-28", numberOne: gotye }).me).toBe("I WAS ON TYLER, THE CREATOR");
    expect(cardLine({ song: "A", artist: "Earth, Wind & Fire", date: "1975-04-28", numberOne: gotye }).me).toBe("I WAS ON EARTH, WIND & FIRE");
  });
  it("cuts a long collaboration credit to its lead and always drops features", () => {
    expect(cardLine({ song: "A", artist: "Chief Keef & Kanye West & Pusha T & Jadakiss", date: "2012-04-28", numberOne: gotye }).me).toBe("I WAS ON CHIEF KEEF");
    expect(cardLine({ song: "A", artist: "Drake Featuring Lil Wayne", date: "2012-04-28", numberOne: gotye }).me).toBe("I WAS ON DRAKE");
  });
  it("matches the #1 on the lead artist", () => {
    expect(cardLine({ song: "A", artist: "Gotye & Kimbra", date: "2012-04-28", numberOne: gotye }).world).toBe("SO WAS EVERYONE");
  });
});
