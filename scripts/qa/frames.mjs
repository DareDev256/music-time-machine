// Frozen flight frames for critics: node scripts/qa/frames.mjs <url> <outPrefix> <width> <p1,p2,...>
import { chromium } from 'playwright';
const [base, out, w, ps] = process.argv.slice(2);
const width = +w || 1440, height = width < 600 ? 844 : 900;
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 3 : 1 });
for (const pr of ps.split(',')) {
  await p.goto(`${base}${base.includes('?') ? '&' : '?'}freeze=${pr}`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}-${width}-p${pr}.png` });
  console.log('ok', `${out}-${width}-p${pr}.png`);
}
await b.close();
