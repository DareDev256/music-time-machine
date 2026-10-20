#!/usr/bin/env python3
"""public/era/flight.json: every Hot 100 #1 week with its cover, compact, for the flight.

  { "through": "2026-10-24", "built": ..., "songs": [ { "s": title, "a": artist, "art": url-template | null } ],
    "weeks": [ [ "1958-08-04", 0 ], ... ] }          # oldest → newest, songIdx into songs

Inputs: data/hot100-number-ones.json (Wikipedia) and data/hot100-covers.json (iTunes).
Refuses on fewer than 3,500 weeks, or when under 80% of songs have art (the flight would
turn into typeset sleeves, which is a fallback, not the product).
"""
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    weeks = json.loads((ROOT / "data" / "hot100-number-ones.json").read_text())["weeks"]
    covers = json.loads((ROOT / "data" / "hot100-covers.json").read_text())["covers"]

    songs, index, rows = [], {}, []
    for w in weeks:
        key = f"{w['song']}|{w['artist']}"
        if key not in index:
            hit = covers.get(key)
            index[key] = len(songs)
            songs.append({"s": w["song"], "a": w["artist"], "art": hit["art"] if hit else None})
        rows.append([w["date"], index[key]])

    with_art = sum(1 for s in songs if s["art"])
    print(f"{len(rows)} weeks, {len(songs)} songs, {with_art} with art ({with_art / len(songs):.1%}), through {rows[-1][0]}")
    if len(rows) < 3500:
        sys.exit(f"REFUSING: only {len(rows)} weeks")
    if with_art / len(songs) < 0.8:
        sys.exit(f"REFUSING: only {with_art / len(songs):.0%} of songs have art")

    out = ROOT / "public" / "era" / "flight.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"through": rows[-1][0], "built": date.today().isoformat(), "songs": songs, "weeks": rows},
                              ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
