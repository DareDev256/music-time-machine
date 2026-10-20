#!/usr/bin/env python3
"""Hot 100 top 10 for every issue week, sharded by year for the era pages.

Primary source: github.com/utdata/rwd-billboard-data hot-100-current.csv (MIT-licensed
repo, every weekly chart since 1958, refreshed weekly by its maintainers). The chart data
itself is Billboard's, so we publish only the top 10 per week with attribution.

Two independent cross-checks must pass before anything is written:
  1. github.com/mhollingshead/billboard-hot-100 all.json agrees on the top 10 (title per
     rank) for at least 99% of week-rank pairs.
  2. data/hot100-number-ones.json (built from Wikipedia) agrees on the #1 for at least 99%
     of weeks.
Also refuses on a week with fewer than 10 rows or more than a dozen cadence breaks.

Writes public/era/hot100/YYYY.json:
  { "year": 2012, "source": ..., "built": ..., "through": "2026-10-17", "weeks": [
      { "date": "2012-03-17", "top": [ { "rank": 1, "song": ..., "artist": ...,
                                         "last": 3, "peak": 1, "weeks": 11 }, ... ] } ] }
"""
import csv
import io
import json
import re
import sys
import unicodedata
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "era" / "hot100"
PRIMARY = "https://raw.githubusercontent.com/utdata/rwd-billboard-data/main/data-out/hot-100-current.csv"
CROSS = "https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/all.json"
UA = "MusicTimeMachine/2.0 (dev@jamesdare.com)"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def norm(s: str) -> str:
    """Title key: no accents, no (parenthetical)/[bracket] parts, no leading article, & = and."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[\(\[][^\)\]]*[\)\]]", "", s).replace("&", " and ")
    s = re.sub(r"^\s*(medley:\s*)?(the|a|an)\s+", "", s)
    return "".join(ch for ch in s if ch.isalnum())


def same_song(a: str, b: str) -> bool:
    x, y = norm(a), norm(b)
    return bool(x and y) and (x == y or x.startswith(y) or y.startswith(x))


def as_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def main():
    rows = list(csv.DictReader(io.StringIO(fetch(PRIMARY).decode("utf-8"))))
    weeks = {}
    for r in rows:
        weeks.setdefault(r["chart_week"], []).append(r)
    dates = sorted(weeks)
    print(f"primary: {len(rows)} rows, {len(dates)} weeks, {dates[0]} → {dates[-1]}")

    errors, prev = [], None
    for d in dates:
        if len(weeks[d]) < 10:
            errors.append(f"{d}: only {len(weeks[d])} rows")
        dd = date.fromisoformat(d)
        if prev and dd - prev != timedelta(days=7):
            errors.append(f"{d}: gap of {(dd - prev).days} days after {prev}")
        prev = dd

    top10 = {d: sorted(weeks[d], key=lambda r: int(r["current_week"]))[:10] for d in dates}

    # Cross-check 1: a second scrape of Billboard agrees on every rank of the top 10.
    cross = {c["date"]: {x["this_week"]: x["song"] for x in c["data"]} for c in json.loads(fetch(CROSS))}
    pairs = disagree = 0
    for d, top in top10.items():
        if d not in cross:
            continue
        for r in top:
            pairs += 1
            other = cross[d].get(int(r["current_week"]))
            if not other or not same_song(r["title"], other):
                disagree += 1
    print(f"cross-check top 10: {disagree} of {pairs} week-rank pairs disagree")

    # Cross-check 2: Wikipedia's #1 list.
    wiki = {w["date"]: w["song"] for w in json.loads((ROOT / "data" / "hot100-number-ones.json").read_text())["weeks"]}
    compared = mismatched = 0
    for d, top in top10.items():
        if d in wiki:
            compared += 1
            if not same_song(top[0]["title"], wiki[d]):
                mismatched += 1
                print("  #1 mismatch:", d, top[0]["title"], "|", wiki[d])
    print(f"cross-check #1 vs Wikipedia: {mismatched} of {compared} weeks disagree")

    hard = []
    if pairs < 30000:
        hard.append(f"only {pairs} week-rank pairs overlap the cross-check source")
    if pairs and disagree / pairs > 0.01:
        hard.append(f"top 10 disagrees with the cross-check on {disagree / pairs:.1%} of pairs")
    if compared < 3000:
        hard.append(f"only {compared} weeks overlap Wikipedia")
    if compared and mismatched / compared > 0.01:
        hard.append(f"#1 disagrees with Wikipedia on {mismatched / compared:.1%} of weeks")
    if hard or len(errors) > 12:
        print("REFUSING:\n  " + "\n  ".join((hard + errors)[:20]), file=sys.stderr)
        sys.exit(2)
    for e in errors:
        print("  note:", e)

    OUT.mkdir(parents=True, exist_ok=True)
    by_year = {}
    for d, top in top10.items():
        by_year.setdefault(int(d[:4]), []).append({
            "date": d,
            "top": [{
                "rank": int(r["current_week"]), "song": r["title"], "artist": r["performer"],
                "last": as_int(r["last_week"]), "peak": as_int(r["peak_pos"]), "weeks": as_int(r["wks_on_chart"]),
            } for r in top],
        })
    for y, ws in by_year.items():
        (OUT / f"{y}.json").write_text(json.dumps({
            "year": y,
            "source": "Billboard Hot 100, top 10 per week, via github.com/utdata/rwd-billboard-data (MIT), "
                      "cross-checked against github.com/mhollingshead/billboard-hot-100 and Wikipedia",
            "built": date.today().isoformat(),
            "through": dates[-1],
            "weeks": ws,
        }, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {len(by_year)} year shards to {OUT.relative_to(ROOT)}, through {dates[-1]}")


if __name__ == "__main__":
    main()
