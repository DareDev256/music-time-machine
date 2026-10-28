// Reddit "buzz curve": how many comments per month mention an artist in a subreddit.
// Source: Arctic Shift comment aggregation (free Reddit archive, no key),
//   GET /api/comments/search/aggregate?aggregate=created_utc&frequency=month&subreddit=..&body=..
// Server-side only. Returns null on any error so the caller can hide the strip.
// Docs: https://github.com/ArthurHeitmann/arctic_shift/blob/master/api/README.md#aggregations

const BASE = "https://arctic-shift.photon-reddit.com/api/comments/search/aggregate";
const UA = "MusicTimeMachine/2.0 (dev@jamesdare.com; era research)";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

export async function buzzCurve(
  artist: string,
  subreddit: string,
  fromMonth: string,
  toMonth: string,
): Promise<Array<{ month: string; count: number }> | null> {
  try {
    if (!artist.trim() || !MONTH.test(fromMonth) || !MONTH.test(toMonth) || fromMonth > toMonth) return null;
    const sub = subreddit.replace(/^\/?r\//i, "").trim();
    if (!/^[A-Za-z0-9_]{2,21}$/.test(sub)) return null;
    const params = new URLSearchParams({
      aggregate: "created_utc",
      frequency: "month",
      subreddit: sub,
      body: `"${artist.trim().replace(/"/g, "")}"`, // phrase match: "Chief Keef", not chief OR keef
      after: `${fromMonth}-01`,
      before: `${nextMonth(toMonth)}-01`,
    });
    // The archive answers "Timeout" while a query warms up; the retry is usually served.
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${BASE}?${params}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        next: { revalidate: 604800 },
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ created_utc: string; count: string | number }> | null };
        if (!Array.isArray(json.data)) return null;
        // Buckets are stamped at local-midnight of the server (e.g. 2011-12-31T23:00Z = January):
        // shift by 12 h before reading the month.
        const byMonth = new Map<string, number>();
        for (const b of json.data) {
          const t = Date.parse(b.created_utc);
          if (Number.isNaN(t)) return null;
          const month = new Date(t + 12 * 3600 * 1000).toISOString().slice(0, 7);
          byMonth.set(month, (byMonth.get(month) ?? 0) + Number(b.count));
        }
        const out: Array<{ month: string; count: number }> = [];
        for (let m = fromMonth; m <= toMonth; m = nextMonth(m)) out.push({ month: m, count: byMonth.get(m) ?? 0 });
        return out;
      }
      if (res.status !== 422 && res.status !== 504) return null;
      await new Promise((r) => setTimeout(r, 5000));
    }
    return null;
  } catch {
    return null;
  }
}
