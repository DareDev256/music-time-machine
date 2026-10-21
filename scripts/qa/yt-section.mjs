// "Where it broke" as a visitor sees it: full-page shot at a width, plus overlap and overflow checks on the section.
//   node scripts/qa/yt-section.mjs <outPrefix> <width> <url>
import { chromium } from 'playwright';
const [out, w, url] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w), height: 900 }, deviceScaleFactor: 2 });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
const facts = await p.evaluate(() => {
  const sec = document.querySelector('#yt')?.closest('section');
  if (!sec) return { section: false };
  sec.scrollIntoView();
  const cols = [...sec.querySelectorAll(':scope > div > div')];
  const overflow = [...sec.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible').length;
  return {
    section: true,
    heading: sec.querySelector('h2')?.textContent,
    columns: cols.map((c) => c.querySelector('span')?.textContent),
    firstRows: cols.map((c) => c.querySelector('li')?.innerText.replace(/\s+/g, ' ').slice(0, 90)),
    pageOverflowX: document.documentElement.scrollWidth > window.innerWidth,
    overflowingEls: overflow,
    verdict: document.querySelector('[class*="verdict"]')?.textContent ?? null,
  };
});
const box = await p.evaluate(() => { const s = document.querySelector('#yt')?.closest('section'); const r = s?.getBoundingClientRect(); return r ? { y: r.top + scrollY, h: r.height } : null; });
// Back to the top first: scrolled to the section, the sticky masthead is drawn over its heading in the page shot.
await p.evaluate(() => scrollTo(0, 0));
if (box) await p.screenshot({ path: `${out}-${w}.png`, clip: { x: 0, y: box.y, width: Number(w), height: Math.min(box.h, 2400) }, fullPage: true });
console.log(JSON.stringify({ ...facts, errors }, null, 1));
await b.close();
// Fails loud: no section, a page that scrolls sideways, or a console error.
if (!facts.section || facts.pageOverflowX || errors.length) process.exitCode = 1;
