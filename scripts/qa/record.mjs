// Record a page as video: node scripts/qa/record.mjs <url> <outDir> <width> <height> <seconds>
import { chromium } from 'playwright';
const [url, out, w, h, secs] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, recordVideo: { dir: out, size: { width: +w * 2, height: +h * 2 } } });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(+secs * 1000);
await ctx.close(); await b.close();
console.log('recorded', out);
