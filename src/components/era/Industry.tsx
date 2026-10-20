// How people paid for music that year: one segmented bar of US recorded-music revenue by format.
// Monochrome on purpose (the site has one accent): the year's biggest format is the signal colour,
// the rest step down in ink. Every segment carries its own label, so nothing is told by colour alone.

import type { IndustryYear } from "@/lib/era/data";
import s from "./industry.module.css";

interface Item { k: string; label: string; plural: boolean; v: number }

const GROUPS: Record<string, [string, boolean]> = {
  physical: ["Physical formats", true], downloads: ["Downloads", true], streaming: ["Streaming", false], sync: ["Sync", false], other: ["Other", false],
};
const PHYSICAL: Record<string, [string, boolean]> = {
  cd: ["CDs", true], vinyl: ["Vinyl", false], cassette: ["Cassettes", true], eight_track: ["8-tracks", true],
  lp_ep: ["Vinyl", false], cd_single: ["CD singles", true], cassette_single: ["Cassette singles", true], vinyl_single: ["Vinyl singles", true],
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The segments the bar shows. When physical is 90%+ of revenue, the group says nothing, so show the formats. */
export function industryItems(y: IndustryYear): Item[] {
  const items: Item[] = [];
  if (y.shares.physical >= 0.9) {
    let physicalShown = 0;
    for (const [k, v] of Object.entries(y.formats)) {
      const meta = PHYSICAL[k];
      if (!meta || v < 0.01) continue;
      const existing = items.find((i) => i.label === meta[0]);
      if (existing) existing.v += v; else items.push({ k, label: meta[0], plural: meta[1], v });
      physicalShown += v;
    }
    const restPhysical = y.shares.physical - physicalShown;
    if (restPhysical >= 0.01) items.push({ k: "other_physical", label: "Other physical", plural: false, v: restPhysical });
    for (const g of ["downloads", "streaming", "sync", "other"] as const) {
      if (y.shares[g] >= 0.005) items.push({ k: g, label: GROUPS[g][0], plural: GROUPS[g][1], v: y.shares[g] });
    }
  } else {
    for (const g of ["physical", "downloads", "streaming", "sync", "other"] as const) {
      if (y.shares[g] >= 0.005) items.push({ k: g, label: GROUPS[g][0], plural: GROUPS[g][1], v: y.shares[g] });
    }
  }
  return items.sort((a, b) => b.v - a.v);
}

/** One sentence that only names what the bar shows: "Downloads were 45% of label revenue, physical formats 33% and streaming 17%." */
export function industrySentence(y: IndustryYear): string {
  // Name real formats only; a catch-all stays in the bar but never leads or joins the sentence.
  const named = industryItems(y).filter((i) => i.v >= 0.02 && i.k !== "other_physical" && i.k !== "other").slice(0, 3);
  const [lead, ...rest] = named;
  const head = `${lead.label} ${lead.plural ? "were" : "was"} ${pct(lead.v)} of label revenue`;
  // Mid-sentence labels go lower case, except acronyms ("CDs", not "cDs").
  const lower = (l: string) => (/^[A-Z]{2}/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1));
  const tail = rest.map((i) => `${lower(i.label)} ${pct(i.v)}`);
  const body = tail.length ? `${head}${tail.length > 1 ? ", " + tail.slice(0, -1).join(", ") : ""} and ${tail.at(-1)}.` : `${head}.`;
  const digitalExists = y.shares.streaming >= 0.005 || y.shares.downloads >= 0.005;
  return digitalExists ? body : `${body} Streaming and downloads did not exist yet.`;
}

export default function Industry({ data }: { data: IndustryYear }) {
  // Widths are SVG attributes and colours are classes: no style attributes (the production CSP blocks them).
  const items = industryItems(data);
  const total = items.reduce((a, x) => a + x.v, 0);
  const inks = [s.ink1, s.ink2, s.ink3, s.ink4];
  const shaded = items.map((x, i) => ({
    ...x,
    tone: i === 0 ? s.lead : inks[Math.min(i - 1, inks.length - 1)],
    x0: (items.slice(0, i).reduce((a, b) => a + b.v, 0) / total) * 100,
    w: (x.v / total) * 100,
  }));

  return (
    <div className={s.wrap}>
      <p className={s.sentence}>{industrySentence(data)}</p>
      <svg className={s.bar} viewBox="0 0 100 10" preserveAspectRatio="none" role="img"
        aria-label={shaded.map((x) => `${x.label} ${pct(x.v)}`).join(", ")}>
        {shaded.map((x) => (
          <rect key={x.k} x={x.x0} y={0} width={x.w} height={10} className={`${x.tone} ${s.rect}`}>
            <title>{`${x.label} · ${pct(x.v)}`}</title>
          </rect>
        ))}
      </svg>
      <div className={s.legend} aria-hidden>
        {shaded.map((x) => (
          <span key={x.k} className={s.key}>
            <span className={`${s.swatch} ${x.tone}`} />
            {x.label}
          </span>
        ))}
      </div>
      <table className={s.srOnly}>
        <caption>US recorded-music revenue by format, {data.year}</caption>
        <tbody>{shaded.map((x) => <tr key={x.k}><th>{x.label}</th><td>{pct(x.v)}</td></tr>)}</tbody>
      </table>
      <p className={s.note}>
        US label revenue ${(data.totalUsdM / 1000).toFixed(1)} billion that year (RIAA, wholesale value).
        {data.globalStreaming !== null ? ` Worldwide, streaming was ${pct(data.globalStreaming)} of recorded-music revenue (IFPI).` : ""}
      </p>
    </div>
  );
}
