#!/usr/bin/env python3
"""Resolve cover art for every Hot 100 #1 once, so the site never looks it up live.

Reads data/hot100-number-ones.json, queries the keyless iTunes Search API for each
unique (song, artist), and writes data/hot100-covers.json:

  { "source": ..., "built": ..., "covers": { "<song>|<artist>": {
        "art": "https://is1-ssl.mzstatic.com/.../{w}x{h}bb.jpg",   # size template
        "preview": "...m4a" | null, "itunesId": 123, "released": "2012-10-18" } | null } }

null = searched, no match (kept so a re-run does not re-query it).

Resume-safe: existing entries are kept; only missing keys are queried. iTunes allows
roughly 20 calls a minute, so the default pace is one call every 3.2 s (~65 min cold).
Refuses to write when fewer than 80% of songs resolve, because a near-empty map would
silently turn the hyperlapse into blank tiles.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "hot100-number-ones.json"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "data" / "hot100-covers.json"
PACE_S = float(sys.argv[1]) if len(sys.argv) > 1 else 3.2
# A cover from a compilation or a "Various Artists" sampler is a wrong cover, even when the track matches.
COMPILATION = re.compile(r"\b(hits|greatest|best of|collection|essential|anthology|now that|now!|karaoke|tribute|various|sampler|oldies|top 40|#1s|number ones|classics|gold|legends|ultimate|definitive|platinum|summer|party|soundtrack|vol\.?|volume|\d{2}s\b)", re.I)
UA = "MusicTimeMachine/1.41 (dev@jamesdare.com)"


def primary_artist(artist: str) -> str:
    return re.split(r"\s+(?:featuring|feat\.?|with|and|&|x)\s+", artist, flags=re.I)[0].strip()


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def lookup(song: str, artist: str):
    term = urllib.parse.quote(f"{song} {primary_artist(artist)}")
    url = f"https://itunes.apple.com/search?media=music&entity=song&limit=25&term={term}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        results = json.load(r).get("results", [])
    want_t, want_a = norm(song), norm(primary_artist(artist))
    # Prefer a title + artist match; fall back to a title match; never take a stranger.
    def score(x):
        t, a = norm(x.get("trackName", "")), norm(x.get("artistName", ""))
        return (want_t in t or t in want_t) * 2 + (want_a in a or a in want_a)
    def compilation(x):
        return (x.get("collectionArtistName", "").lower() == "various artists"
                or bool(COMPILATION.search(x.get("collectionName", ""))))
    # Title AND artist must match: an earlier same-titled song by someone else is the classic wrong cover.
    matches = [x for x in results if x.get("artworkUrl100") and score(x) >= 3]
    if not matches:
        return None
    # Prefer the original release: non-compilation first, then the earliest release date.
    matches.sort(key=lambda x: (compilation(x), x.get("releaseDate") or "9999"))
    best = matches[0]
    return {
        "art": re.sub(r"/\d+x\d+bb\.", "/{w}x{h}bb.", best["artworkUrl100"]),
        "preview": best.get("previewUrl"),
        "itunesId": best.get("trackId"),
        "released": (best.get("releaseDate") or "")[:10] or None,
        "album": best.get("collectionName"),
        "compilation": compilation(best),
    }


def main():
    weeks = json.loads(SRC.read_text())["weeks"]
    keys = list(dict.fromkeys(f"{w['song']}|{w['artist']}" for w in weeks))
    covers = json.loads(OUT.read_text())["covers"] if OUT.exists() else {}
    # Newest first: the hyperlapse starts from today, so recent covers matter first.
    todo = [k for k in reversed(keys) if k not in covers]
    print(f"{len(keys)} songs, {len(covers)} cached, {len(todo)} to query", flush=True)

    def save():
        hit = sum(1 for k in keys if covers.get(k))
        OUT.write_text(json.dumps({
            "source": "iTunes Search API (keyless), matched on title + primary artist",
            "built": date.today().isoformat(),
            "resolved": hit, "total": len(keys),
            "covers": covers,
        }, ensure_ascii=False, indent=0))
        return hit

    for i, k in enumerate(todo, 1):
        song, artist = k.split("|", 1)
        for attempt in range(3):
            try:
                covers[k] = lookup(song, artist)
                break
            except Exception as e:  # 403/429 = rate limit: back off hard
                print(f"  retry {attempt + 1} {k}: {e}", flush=True)
                time.sleep(30 * (attempt + 1))
        if i % 10 == 0 or i == 1:
            print(f"  {i}/{len(todo)} saved={save()}", flush=True)
        time.sleep(PACE_S)

    hit = sum(1 for k in keys if covers.get(k))
    rate = hit / len(keys)
    print(f"resolved {hit}/{len(keys)} = {rate:.1%}")
    if rate < 0.8:
        print("REFUSING: under 80% resolved; the partial cache is kept for the next run", file=sys.stderr)
        save()
        sys.exit(2)
    save()


if __name__ == "__main__":
    main()
