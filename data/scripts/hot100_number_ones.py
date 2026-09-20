#!/usr/bin/env python3
"""Build data/hot100-number-ones.json from Wikipedia's per-year lists.

Source: https://en.wikipedia.org/wiki/List_of_Billboard_Hot_100_number_ones_of_<YEAR>
(CC BY-SA 4.0; chart positions are facts). The Hot 100 began 1958-08-04.

Refuses to write on any year that yields zero rows, and validates that
consecutive issue dates are 7 days apart (Billboard skips a week only at
year end in a few early years, which is tolerated up to 14 days).
"""
import json, re, sys, time, datetime as dt
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import quote
from bs4 import BeautifulSoup

OUT = Path(__file__).resolve().parents[1] / "hot100-number-ones.json"
API = "https://en.wikipedia.org/w/api.php?action=parse&prop=text&format=json&formatversion=2&redirects=1&page="
UA = {"User-Agent": "music-time-machine/2.0 (https://github.com/DareDev256/music-time-machine)"}
FIRST_YEAR, LAST_YEAR = 1958, dt.date.today().year

def fetch(year):
    for attempt in range(3):
        try:
            with urlopen(Request(API + quote(f"List_of_Billboard_Hot_100_number_ones_of_{year}"), headers=UA), timeout=30) as r:
                return json.load(r)["parse"]["text"]
        except Exception as e:  # noqa: BLE001
            time.sleep(2 * (attempt + 1)); err = e
    raise SystemExit(f"{year}: fetch failed: {err}")

def clean(td):
    for sup in td.find_all("sup"): sup.decompose()
    text = re.sub(r"\s+", " ", td.get_text(" ", strip=True))
    # Wikipedia marks re-entries / notes with dagger and asterisk glyphs after the title.
    text = re.sub(r"[†‡*]+", "", text)
    text = re.sub(r'\s*"\s*/\s*"\s*', " / ", text)  # double A-sides: 'A " / " B' → 'A / B'
    return text.strip().strip('"').strip()

def expand(table):
    """Yield rows with rowspan cells carried down."""
    carry = {}
    for tr in table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if not cells or cells[0].name == "th" and tr.find_all("th") == cells and not carry:
            continue  # header row
        row, col, i = [], 0, 0
        while i < len(cells) or col in carry:
            if col in carry:
                text, left = carry[col]
                row.append(text)
                if left > 1: carry[col] = (text, left - 1)
                else: del carry[col]
            else:
                c = cells[i]; i += 1
                text = clean(c)
                span = int(c.get("rowspan", 1))
                if span > 1: carry[col] = (text, span - 1)
                row.append(text)
            col += 1
        yield row

def parse_year(year, html):
    soup = BeautifulSoup(html, "lxml")
    table = None
    for t in soup.find_all("table", class_="wikitable"):
        heads = [clean(th) for th in t.find_all("th")]
        if "Issue date" in heads and ("Song" in heads or "Title" in heads):
            table = t; heads_l = heads; break
    if table is None:
        raise SystemExit(f"{year}: chart table not found")
    di, si, ai = heads_l.index("Issue date"), heads_l.index("Song" if "Song" in heads_l else "Title"), heads_l.index([h for h in heads_l if h.startswith("Artist")][0])
    rows = []
    for row in expand(table):
        if len(row) <= max(di, si, ai): continue
        m = re.match(r"([A-Z][a-z]+ \d{1,2})", row[di])
        if not m: continue
        try:
            date = dt.datetime.strptime(f"{m.group(1)} {year}", "%B %d %Y").date()
        except ValueError:
            continue
        song, artist = row[si].replace('"', "").strip(), row[ai]
        if not song or not artist: continue
        rows.append({"date": date.isoformat(), "song": song, "artist": artist})
    if not rows:
        raise SystemExit(f"{year}: parsed zero rows — refusing to write")
    return rows

def main():
    years = range(FIRST_YEAR, LAST_YEAR + 1)
    if len(sys.argv) > 1: years = [int(a) for a in sys.argv[1:]]
    allrows = []
    for y in years:
        rows = parse_year(y, fetch(y))
        print(f"{y}: {len(rows)} weeks, {len({r['song'] for r in rows})} distinct #1s", file=sys.stderr)
        allrows += rows
        time.sleep(0.5)
    allrows.sort(key=lambda r: r["date"])
    # validate weekly cadence
    bad = []
    for a, b in zip(allrows, allrows[1:]):
        gap = (dt.date.fromisoformat(b["date"]) - dt.date.fromisoformat(a["date"])).days
        if gap != 7 and gap != 0: bad.append((a["date"], b["date"], gap))
    for a, b, g in bad[:20]: print(f"GAP {a} -> {b} = {g}d", file=sys.stderr)
    if len(sys.argv) == 1:
        if any(g > 14 or g < 0 for *_, g in bad):
            raise SystemExit("cadence check failed — refusing to write")
        OUT.write_text(json.dumps({"source": "en.wikipedia.org, List of Billboard Hot 100 number ones of <year>",
                                   "license": "CC BY-SA 4.0", "built": dt.date.today().isoformat(),
                                   "weeks": allrows}, indent=0, ensure_ascii=False))
        print(f"wrote {OUT} ({len(allrows)} weeks)", file=sys.stderr)
    else:
        print(json.dumps(allrows[:5], indent=1)); print("...", json.dumps(allrows[-3:], indent=1))

if __name__ == "__main__": main()
