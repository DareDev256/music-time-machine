// Era page facts as a visitor sees them: verdict line, readouts, first chart rows, empty notes.
//   node scripts/qa/era-check.mjs <outDir> <url> [url...]
import { chromium } from 'playwright';
const [out, ...urls] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
let i = 0;
for (const u of urls) {
  await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 });
  const facts = await p.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent,
    verdict: document.querySelector('[class*="verdict"]')?.textContent ?? null,
    readouts: [...document.querySelectorAll('.readout')].map((r) => r.textContent),
    rows: [...document.querySelectorAll('table tbody tr')].slice(0, 3).map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 90)),
    empty: document.querySelector('[class*="emptyNote"]')?.textContent ?? null,
    footer: document.querySelector('footer')?.innerText.split('\n')[0],
  }));
  await p.screenshot({ path: `${out}/era-${++i}.png` });
  console.log(JSON.stringify({ url: u.replace('https://music-time-machine.vercel.app', ''), ...facts }, null, 1));
}
await b.close();
