#!/usr/bin/env python3
"""Merge two cover sets conservatively: replace a cover only when the current one is a compilation
and the candidate is a clean original. Measured 2026-10-20 on 30 random changes: wholesale v3 was
~13 better / ~7 worse, and every "worse" case was one where the current cover was already the
original album. So the current cover is the default, and a candidate must earn the swap.

  python3 data/scripts/covers_merge.py <current.json> <candidate.json> <out.json> [--pace 3.1]

Looks up the current covers' album names by iTunes trackId (keyless lookup API, ~20/min), cached in
data/cache/itunes-lookup.json so a re-run is free. Prints every swap. Refuses when fewer than 90% of
current covers could be looked up (an unknown album must never count as "not a compilation").
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data" / "scripts"))
from hot100_covers import COMPILATION, VERSION  # one definition of "compilation" and "other version"

CACHE = ROOT / "data" / "cache" / "itunes-lookup.json"
UA = "MusicTimeMachine/2.0 (dev@jamesdare.com)"


def lookup(tid: int, cache: dict, pace: float):
    key = str(tid)
    if key in cache:
        return cache[key]
    for attempt in range(3):
        try:
            req = urllib.request.Request(f"https://itunes.apple.com/lookup?id={tid}", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                res = json.load(r).get("results", [])
            cache[key] = {"album": res[0].get("collectionName"), "albumArtist": res[0].get("collectionArtistName")} if res else None
            time.sleep(pace)
            return cache[key]
        except Exception:
            time.sleep(30 * (attempt + 1))
    return "error"


def is_comp(album, album_artist) -> bool:
    return bool(album) and (COMPILATION.search(album) is not None or (album_artist or "").lower() == "various artists")


def is_version(text: str, wanted: str) -> bool:
    return any(m.group(0).lower() not in wanted.lower() for m in VERSION.finditer(text or ""))


def main():
    cur_path, cand_path, out_path = map(Path, sys.argv[1:4])
    pace = float(sys.argv[sys.argv.index("--pace") + 1]) if "--pace" in sys.argv else 3.1
    cur_doc = json.loads(cur_path.read_text())
    cur, cand = cur_doc["covers"], json.loads(cand_path.read_text())["covers"]
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    CACHE.parent.mkdir(parents=True, exist_ok=True)

    looked = errors = swaps = 0
    merged = dict(cur)
    keys = [k for k in cur if cur.get(k)]
    for i, k in enumerate(keys, 1):
        info = lookup(cur[k]["itunesId"], cache, pace)
        if i % 50 == 0:
            CACHE.write_text(json.dumps(cache))
            print(f"  {i}/{len(keys)} looked up", flush=True)
        if info == "error" or info is None:
            errors += 1
            continue
        looked += 1
        c = cand.get(k)
        song = k.split("|")[0]
        if (is_comp(info.get("album"), info.get("albumArtist")) and c
                and not c.get("compilation") and not is_comp(c.get("album"), None)
                and not is_version(c.get("album", ""), song)
                and not re.search(r"\b(box set|deluxe|anniversary|edition)\b", c.get("album", ""), re.I)):
            merged[k] = c
            swaps += 1
            print(f"  swap  {song[:34]:34}  {str(info.get('album'))[:34]:34} → {c.get('album')}")
    CACHE.write_text(json.dumps(cache))
    # keys the candidate resolved that the current set never had
    for k, c in cand.items():
        if c and not merged.get(k):
            merged[k] = c
            swaps += 1
            print(f"  fill  {k.split('|')[0][:34]}")

    rate = looked / max(1, len(keys))
    print(f"looked up {looked}/{len(keys)} ({rate:.1%}), errors {errors}, swaps {swaps}")
    if rate < 0.9:
        sys.exit("REFUSING: too few current covers could be looked up")
    out_doc = dict(cur_doc, covers=merged, resolved=sum(1 for v in merged.values() if v),
                   source=cur_doc.get("source", "") + " · merged: compilations replaced by originals (covers_merge.py)")
    out_path.write_text(json.dumps(out_doc, ensure_ascii=False, indent=0))
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
