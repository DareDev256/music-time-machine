// How people paid for music that year: one segmented bar of US recorded-music revenue by format.
// Monochrome on purpose (the site has one accent): the year's biggest format is the signal colour,
// the rest step down in ink. Every segment carries its own label, so nothing is told by colour alone.

import type { IndustryYear } from "@/lib/era/data";
import s from "./industry.module.css";

const NAMES: Record<string, string> = { streaming: "Streaming", downloads: "Downloads", physical: "Physical", sync: "Sync", other: "Other" };
const ORDER = ["physical", "downloads", "streaming", "sync", "other"] as const;
const FORMAT_NAMES: Record<string, string> = {
  cd: "CDs", vinyl: "vinyl", cassette: "cassettes", lp_ep: "LPs", download_single: "single downloads", download_album: "album downloads",
  paid_subscription: "paid subscriptions", ad_supported_streaming: "ad-supported streams", other_streaming: "other streaming", ringtones: "ringtones",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "Downloads were 45% of label revenue, CDs 30% and streaming 17%." */
export function industrySentence(y: IndustryYear): string {
  const groups = ORDER.filter((k) => y.shares[k] >= 0.01).sort((a, b) => y.shares[b] - y.shares[a]);
  const lead = groups[0];
  const topFormats = Object.entries(y.formats).sort((a, b) => b[1] - a[1]).filter(([k]) => FORMAT_NAMES[k]);
  const cd = topFormats.find(([k]) => k === "cd" || k === "vinyl" || k === "cassette");
  const verb = lead === "physical" ? "formats were" : lead === "downloads" ? "were" : "was";
  const parts = [`${NAMES[lead]} ${verb} ${pct(y.shares[lead])} of label revenue`];
  if (cd && lead !== "physical" && cd[1] >= 0.02) parts.push(`${FORMAT_NAMES[cd[0]]} ${pct(cd[1])}`);
  const third = groups.find((g) => g !== lead && g !== "physical" && y.shares[g] >= 0.02);
  if (third) parts.push(`${NAMES[third].toLowerCase()} ${pct(y.shares[third])}`);
  if (y.shares.streaming < 0.005 && y.shares.downloads < 0.005) return `${parts[0]}. Streaming and downloads did not exist yet.`;
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}.` : `${parts[0]}.`;
}

export default function Industry({ data }: { data: IndustryYear }) {
  // Widths are SVG attributes and colours are classes: no style attributes (the production CSP blocks them).
  const segs = ORDER.map((k) => ({ k, v: data.shares[k] })).filter((x) => x.v >= 0.005);
  const lead = segs.reduce((a, b) => (b.v > a.v ? b : a)).k;
  let step = 0;
  const total = segs.reduce((a, x) => a + x.v, 0);
  let at = 0;
  const shaded = segs.map((x) => {
    const tone = x.k === lead ? s.lead : [s.ink1, s.ink2, s.ink3, s.ink4][Math.min(step++, 3)];
    const w = (x.v / total) * 100;
    const seg = { ...x, tone, x0: at, w };
    at += w;
    return seg;
  });

  return (
    <div className={s.wrap}>
      <p className={s.sentence}>{industrySentence(data)}</p>
      <svg className={s.bar} viewBox="0 0 100 10" preserveAspectRatio="none" role="img"
        aria-label={shaded.map((x) => `${NAMES[x.k]} ${pct(x.v)}`).join(", ")}>
        {shaded.map((x) => (
          <rect key={x.k} x={x.x0} y={0} width={x.w} height={10} className={`${x.tone} ${s.rect}`}>
            <title>{`${NAMES[x.k]} · ${pct(x.v)}`}</title>
          </rect>
        ))}
      </svg>
      <div className={s.legend} aria-hidden>
        {shaded.map((x) => (
          <span key={x.k} className={s.key}>
            <span className={`${s.swatch} ${x.tone}`} />
            {NAMES[x.k]} <span className={s.val}>{pct(x.v)}</span>
          </span>
        ))}
      </div>
      <table className={s.srOnly}>
        <caption>US recorded-music revenue by format, {data.year}</caption>
        <tbody>{shaded.map((x) => <tr key={x.k}><th>{NAMES[x.k]}</th><td>{pct(x.v)}</td></tr>)}</tbody>
      </table>
      <p className={s.note}>
        US label revenue ${(data.totalUsdM / 1000).toFixed(1)} billion that year (RIAA, wholesale value).
        {data.globalStreaming !== null ? ` Worldwide, streaming was ${pct(data.globalStreaming)} of recorded-music revenue (IFPI).` : ""}
      </p>
    </div>
  );
}
