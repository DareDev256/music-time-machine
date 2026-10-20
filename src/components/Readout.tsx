// A seven-segment date readout: lit digits over a faint layer of unlit segments,
// so it reads as hardware (the time-circuit reference), not as a red font.

import type { CSSProperties } from "react";

export function segDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "--.--.----";
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)}.${iso.slice(0, 4)}`;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2012-04-28" → "28 APR 2012" */
export function plainDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}
/** "2012-04" → "April 2012" */
export function monthName(month: string): string {
  return `${MONTHS_LONG[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export default function Readout({
  label, value, tone = "signal", size = "lg", align = "end", style,
}: {
  label: string; value: string; tone?: "signal" | "ink"; size?: "lg" | "md" | "sm"; align?: "start" | "end" | "inherit"; style?: CSSProperties;
}) {
  const fontSize = size === "lg" ? "clamp(26px, 5vw, 52px)" : size === "md" ? "clamp(18px, 3vw, 30px)" : "16px";
  const ghost = value.replace(/[0-9]/g, "8").replace(/-/g, "8");
  return (
    <div style={{ display: "grid", gap: 4, justifyItems: align, ...style }}>
      <span className="label">{label}</span>
      <span
        className={`seg ${tone === "signal" ? "seg-signal" : "seg-ink"}`}
        data-ghost={ghost}
        style={{ fontSize }}
        aria-label={`${label} ${value}`}
      >
        {value}
      </span>
    </div>
  );
}
