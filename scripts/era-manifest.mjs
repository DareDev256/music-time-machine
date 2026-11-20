// Writes public/era/<dir>/manifest.json (the file names in that folder) for the folders the server lists.
// Cloudflare Workers have no filesystem, so src/lib/era/data.ts reads these instead of a directory listing.
// Runs in `npm run cf:build`; the manifests are build output (gitignored).
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ERA = path.join(process.cwd(), "public", "era");
for (const dir of ["heat", "youtube"]) {
  const full = path.join(ERA, dir);
  if (!existsSync(full)) continue;
  const files = readdirSync(full).filter((f) => f.endsWith(".json") && f !== "manifest.json").sort();
  writeFileSync(path.join(full, "manifest.json"), JSON.stringify(files));
  console.log(`era-manifest: ${dir} ${files.length} files`);
}
