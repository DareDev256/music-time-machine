// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// The production CSP (src/lib/csp.ts) has no 'unsafe-inline' for styles, so a `style` attribute in
// server-rendered HTML is dropped in production while looking fine in `next dev`. This happened on
// 2026-10-20: the home readouts lost their layout on the live site only. Use classes or CSS modules.
// Allowed: files that only ever render in the browser (React sets those styles through the CSSOM,
// which the CSP does not block) and the image renderer for share cards (it never emits HTML).
const ALLOWED = new Set([
  "src/components/flight/Flight.tsx",   // next/dynamic with ssr:false
  "src/app/global-error.tsx",           // client error boundary
]);
const SKIP_DIRS = ["src/app/api/card", "__tests__"];

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return SKIP_DIRS.some((s) => p.includes(s)) ? [] : tsxFiles(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

describe("no inline style attributes in server-rendered components", () => {
  it("finds none outside the allowed client-only files", () => {
    const root = process.cwd();
    const offenders = tsxFiles(path.join(root, "src"))
      .map((f) => path.relative(root, f))
      .filter((f) => !ALLOWED.has(f))
      .flatMap((f) => readFileSync(f, "utf8").split("\n").map((line, i) => ({ f, i: i + 1, line })))
      .filter(({ line }) => /\sstyle=\{/.test(line))
      .map(({ f, i }) => `${f}:${i}`);
    expect(offenders).toEqual([]);
  });
});
