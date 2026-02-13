// Time Machine — date-to-chart-#1 matching engine
// Extracted from DateSearch.tsx for testability and reuse

export interface ChartEntry {
  position: number;
  title: string;
  artist: string;
  albumArt: string;
  id: string;
  weeksAtOne?: number;
}

// Historical #1 songs (2019–2024). Would be API-driven in production.
export const historicalNumber1s: Record<string, ChartEntry> = {
  "2024-01": { position: 1, title: "Lovin On Me", artist: "Jack Harlow", albumArt: "https://i.scdn.co/image/ab67616d0000b2738a01c7b77a34f6d9c8dac60e", id: "lovin-on-me", weeksAtOne: 4 },
  "2024-02": { position: 1, title: "Texas Hold 'Em", artist: "Beyonce", albumArt: "https://i.scdn.co/image/ab67616d0000b273b53558ec6bb12ae2606c0494", id: "texas-hold-em", weeksAtOne: 2 },
  "2024-03": { position: 1, title: "Espresso", artist: "Sabrina Carpenter", albumArt: "https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96", id: "espresso", weeksAtOne: 1 },
  "2023-01": { position: 1, title: "Flowers", artist: "Miley Cyrus", albumArt: "https://i.scdn.co/image/ab67616d0000b2738b58d20f1b77295730db15b4", id: "flowers", weeksAtOne: 8 },
  "2023-04": { position: 1, title: "Last Night", artist: "Morgan Wallen", albumArt: "https://i.scdn.co/image/ab67616d0000b273705079df9a25a28b452c1fc9", id: "last-night", weeksAtOne: 16 },
  "2023-07": { position: 1, title: "Vampire", artist: "Olivia Rodrigo", albumArt: "https://i.scdn.co/image/ab67616d0000b273e85259a1cae29a8d91f2093d", id: "vampire", weeksAtOne: 2 },
  "2023-10": { position: 1, title: "Paint The Town Red", artist: "Doja Cat", albumArt: "https://i.scdn.co/image/ab67616d0000b2734df3245f26298a1579ecc321", id: "paint-the-town-red", weeksAtOne: 2 },
  "2022-01": { position: 1, title: "Easy On Me", artist: "Adele", albumArt: "https://i.scdn.co/image/ab67616d0000b27381458f59f7c81ba65cda8bdc", id: "easy-on-me", weeksAtOne: 5 },
  "2022-04": { position: 1, title: "As It Was", artist: "Harry Styles", albumArt: "https://i.scdn.co/image/ab67616d0000b2732e8ed79e177ff6011076f5f0", id: "as-it-was", weeksAtOne: 15 },
  "2022-10": { position: 1, title: "Anti-Hero", artist: "Taylor Swift", albumArt: "https://i.scdn.co/image/ab67616d0000b273bb54dde68cd23e2a268ae0f5", id: "anti-hero", weeksAtOne: 8 },
  "2021-01": { position: 1, title: "drivers license", artist: "Olivia Rodrigo", albumArt: "https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a", id: "drivers-license", weeksAtOne: 8 },
  "2021-05": { position: 1, title: "Butter", artist: "BTS", albumArt: "https://i.scdn.co/image/ab67616d0000b273bb8b5d8c1c6687b5b79a909e", id: "butter", weeksAtOne: 10 },
  "2021-09": { position: 1, title: "Stay", artist: "The Kid LAROI & Justin Bieber", albumArt: "https://i.scdn.co/image/ab67616d0000b273a3a7f38ea2033aa501afd4cf", id: "stay", weeksAtOne: 7 },
  "2020-01": { position: 1, title: "The Box", artist: "Roddy Ricch", albumArt: "https://i.scdn.co/image/ab67616d0000b2736b1c8c2c7a3e8f5f1d2b3c4d", id: "the-box", weeksAtOne: 11 },
  "2020-04": { position: 1, title: "Blinding Lights", artist: "The Weeknd", albumArt: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36", id: "blinding-lights", weeksAtOne: 4 },
  "2020-06": { position: 1, title: "Rockstar", artist: "DaBaby ft. Roddy Ricch", albumArt: "https://i.scdn.co/image/ab67616d0000b2737a5dbc0b0a53ff677d07f0ed", id: "rockstar-dababy", weeksAtOne: 7 },
  "2020-08": { position: 1, title: "WAP", artist: "Cardi B ft. Megan Thee Stallion", albumArt: "https://i.scdn.co/image/ab67616d0000b273e8e28219724c2423afa4d320", id: "wap", weeksAtOne: 4 },
  "2020-12": { position: 1, title: "All I Want for Christmas Is You", artist: "Mariah Carey", albumArt: "https://i.scdn.co/image/ab67616d0000b2734246e3158e84c5e5c68fda44", id: "all-i-want-christmas", weeksAtOne: 4 },
  "2019-04": { position: 1, title: "Old Town Road", artist: "Lil Nas X ft. Billy Ray Cyrus", albumArt: "https://i.scdn.co/image/ab67616d0000b273fe297c2100c4e9027e2cd97e", id: "old-town-road", weeksAtOne: 19 },
  "2019-08": { position: 1, title: "bad guy", artist: "Billie Eilish", albumArt: "https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce", id: "bad-guy", weeksAtOne: 1 },
  "2019-11": { position: 1, title: "Someone You Loved", artist: "Lewis Capaldi", albumArt: "https://i.scdn.co/image/ab67616d0000b2732cd654c54b8f9c0dcff5f8c5", id: "someone-you-loved", weeksAtOne: 3 },
};

/** Exact year-month lookup. Returns the #1 song for that month, or null. */
export function getChartForDate(date: Date): ChartEntry | null {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return historicalNumber1s[key] || null;
}

/** Fallback: finds the closest available month to the target date. */
export function findClosestChart(
  date: Date,
  data: Record<string, ChartEntry> = historicalNumber1s
): { entry: ChartEntry; monthKey: string } | null {
  const targetTime = date.getTime();
  let closest: { entry: ChartEntry; monthKey: string; diff: number } | null = null;

  for (const [monthKey, entry] of Object.entries(data)) {
    const [year, month] = monthKey.split("-").map(Number);
    const entryDate = new Date(year, month - 1, 15);
    const diff = Math.abs(entryDate.getTime() - targetTime);

    if (!closest || diff < closest.diff) {
      closest = { entry, monthKey, diff };
    }
  }

  return closest ? { entry: closest.entry, monthKey: closest.monthKey } : null;
}
