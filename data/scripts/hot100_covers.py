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
# Defaults; main() reads argv so importing this module (covers_merge.py does) has no side effects.
OUT = ROOT / "data" / "hot100-covers.json"
PACE_S = 3.2
# A cover from a compilation or a "Various Artists" sampler is a wrong cover, even when the track matches.
COMPILATION = re.compile(r"\b(hits|greatest|best of|the best|very best|collection|essentials?|anthology|now that|now!|karaoke|tribute|various|sampler|oldies|top 40|#1s|no\. 1's|number ones|classics|gold|legends?|ultimate|definitive|platinum|summer|party|soundtrack|vol\.?|volume|jukebox|masters|complete|jackpot|\d{2}s\b)", re.I)
# A different recording of the song is also a wrong cover: live albums, cast recordings, demos, remixes and mixes,
# sped-up / slowed edits, covers, other-language versions. Allowed only when the chart title itself says so
# ("Coming Up (Live at Glasgow)"). Mirrors VERSION_MARK in src/lib/era/normalize.ts: keep the two lists in step.
VERSION = re.compile(r"\b(re-?mix(es|ed)?|mix|live|acoustic|demo|instrumental|cover|karaoke|sped[ -]?up|slowed|version|edit|cast recording|cast|broadway|unplugged|a cappella|re-?recorded|orchestral|spanish|espa[nñ]ol|reunion)\b", re.I)
# Labels that name the plain recording itself ("Original Mix", "Radio Edit", "Remastered 2011"): not another version.
# Mirrors PLAIN_LABEL in src/lib/era/normalize.ts.
PLAIN = re.compile(r"\b(radio edit|radio version|original mix|original version|album version|single version|main version|clean version|explicit version|dirty version|re-?master(ed)?( \d{4})?)\b", re.I)
UA = "MusicTimeMachine/1.41 (dev@jamesdare.com)"


def primary_artist(artist: str) -> str:
    return re.split(r"\s+(?:featuring|feat\.?|with|and|&|x)\s+", artist, flags=re.I)[0].strip()


NUMERALS = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten"}


def norm(s: str) -> str:
    # "The 4 Seasons" and "The Four Seasons" are the same band: spell out standalone numerals first.
    s = re.sub(r"\b(10|[1-9])\b", lambda m: NUMERALS[m.group(1)], s.lower())
    return re.sub(r"[^a-z0-9]", "", s)


def other_version(x: dict, song: str) -> bool:
    """True when the iTunes row is another recording than the wanted one (a version word the chart title lacks)."""
    text = PLAIN.sub(" ", f'{x.get("trackName", "")} {x.get("collectionName", "")}')
    return any(m.group(0).lower() not in song.lower() for m in VERSION.finditer(text))


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
    def single(x):
        return bool(re.search(r" - (single|ep)$", x.get("collectionName", ""), re.I))
    matches = [x for x in results if x.get("artworkUrl100") and score(x) >= 3]
    if not matches:
        return None
    # The original recording on its original album: other versions last, then compilations, then singles,
    # then the earliest release date.
    matches.sort(key=lambda x: (other_version(x, song), compilation(x), single(x), x.get("releaseDate") or "9999"))
    best = matches[0]
    return {
        "art": re.sub(r"/\d+x\d+bb\.", "/{w}x{h}bb.", best["artworkUrl100"]),
        "preview": best.get("previewUrl"),
        "itunesId": best.get("trackId"),
        "released": (best.get("releaseDate") or "")[:10] or None,
        "album": best.get("collectionName"),
        "compilation": compilation(best),
        "otherVersion": other_version(best, song),
    }


def main():
    global OUT, PACE_S
    if len(sys.argv) > 1:
        PACE_S = float(sys.argv[1])
    if len(sys.argv) > 2:
        OUT = Path(sys.argv[2])
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
