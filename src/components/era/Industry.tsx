// How people paid for music that year: one segmented bar of US recorded-music revenue by format.
// Monochrome on purpose (the site has one accent): the year's biggest format is the signal colour,
// the rest step down in ink. Every segment carries its own label, so nothing is told by colour alone.

import type { IndustryYear } from "@/lib/era/data";
import s from "./industry.module.css";

const NAMES: Record<string, string> = { streaming: "Streaming", downloads: "Downloads", physical: "Physical", sync: "Sync", other: "Other" };
const ORDER = ["physical", "downloads", "streaming", "sync", "other"] as const;
const INK_STEPS = ["rgba(244,244,244,.62)", "rgba(244,244,244,.4)", "rgba(244,244,244,.24)", "rgba(244,244,244,.14)"];
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
  const segs = ORDER.map((k) => ({ k, v: data.shares[k] })).filter((x) => x.v >= 0.005);
  const lead = segs.reduce((a, b) => (b.v > a.v ? b : a)).k;
  let step = 0;
  const shade = (k: string) => (k === lead ? "var(--signal)" : INK_STEPS[Math.min(step++, INK_STEPS.length - 1)]);
  const colored = segs.map((x) => ({ ...x, c: shade(x.k) }));

  return (
    <div className={s.wrap}>
      <p className={s.sentence}>{industrySentence(data)}</p>
      <div className={s.bar} role="img" aria-label={colored.map((x) => `${NAMES[x.k]} ${pct(x.v)}`).join(", ")}>
        {colored.map((x) => (
          <div key={x.k} className={s.seg} style={{ flexGrow: x.v, background: x.c }} title={`${NAMES[x.k]} · ${pct(x.v)}`} />
        ))}
      </div>
      <div className={s.legend} aria-hidden>
        {colored.map((x) => (
          <span key={x.k} className={s.key}>
            <span className={s.swatch} style={{ background: x.c }} />
            {NAMES[x.k]} <span className={s.val}>{pct(x.v)}</span>
          </span>
        ))}
      </div>
      <table className={s.srOnly}>
        <caption>US recorded-music revenue by format, {data.year}</caption>
        <tbody>{colored.map((x) => <tr key={x.k}><th>{NAMES[x.k]}</th><td>{pct(x.v)}</td></tr>)}</tbody>
      </table>
      <p className={s.note}>
        US label revenue ${(data.totalUsdM / 1000).toFixed(1)} billion that year (RIAA, wholesale value).
        {data.globalStreaming !== null ? ` Worldwide, streaming was ${pct(data.globalStreaming)} of recorded-music revenue (IFPI).` : ""}
      </p>
    </div>
  );
}
