import Console from "@/components/console/Console";

// Home: the console over the timeline tree. A shared link (/?to=YYYY-MM-DD&song=&artist=)
// replays the flight to that week; ?freeze=0..1 holds a frame for screenshots.

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const clean = (v: string | undefined, max: number) => v?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || undefined;

export default async function Home({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const to = one(sp.to);
  const freezeRaw = Number(one(sp.freeze));
  const initial = to && /^\d{4}-\d{2}-\d{2}$/.test(to)
    ? { to, song: clean(one(sp.song), 120), artist: clean(one(sp.artist), 120), born: one(sp.born) === "1" }
    : null;
  return (
    <main>
      <h1 className="sr-only">
        Was Playing: name a song and fly back to the week it was playing
      </h1>
      <Console initial={initial} freeze={Number.isFinite(freezeRaw) && freezeRaw >= 0 && freezeRaw <= 1 ? freezeRaw : undefined} />
    </main>
  );
}
