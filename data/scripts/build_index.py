#!/usr/bin/env python3
"""public/era/index.json: one row per known song with its earliest dated sighting.

Sources, in the order they win a tie on date:
  seed      data/seed/non-dsp.json            hand-verified YouTube/mixtape songs (always wins)
  hot100    utdata/rwd-billboard-data CSV       every song that ever charted, dated by its debut week
  lane:<id> public/era/lanes/<id>.json          genre-lane #1s (only lanes listed in lanes/index.json)
  heat:<id> public/era/heat/YYYY-MM.json        songs seen on archived HotNewHipHop / Hype Machine / Billboard pages
  yt:<id>   public/era/youtube/YYYY-MM.json     uploads on the channels that broke songs (youtube_channels.py):
                                                they only ADD songs nothing above has, never replace a row

Row: { s, a, d: YYYY-MM-DD, g: day|month|year, src, ds: human date label, k: normalised "title|primary artist",
       y?: youtubeId, n?: note, va?: when YouTube counts were fetched (yt rows: dropped by the resolver after 30 days) }
Refuses on fewer than 5,000 rows or when the seed file is missing (the core case depends on it).
"""
import csv
import io
import json
import re
import sys
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data" / "scripts"))
from hot100_covers import PLAIN, VERSION  # one definition of "another version" for every pipeline
ERA = ROOT / "public" / "era"
YT_PER_CHANNEL_MONTH = 10  # a channel's 10 most viewed uploads of a month; the long tail is noise for search
HOT100_CSV = "https://raw.githubusercontent.com/utdata/rwd-billboard-data/main/data-out/hot-100-current.csv"
UA = "MusicTimeMachine/2.0 (dev@jamesdare.com)"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[\(\[][^\)\]]*[\)\]]", "", s).replace("&", " and ")
    s = re.sub(r"^\s*(the|a|an)\s+", "", s)
    return re.sub(r"[^a-z0-9]+", "", s)


def primary(artist: str) -> str:
    return re.split(r"\s+(?:featuring|feat\.?|ft\.?|with|x|&|and|,)\s+", artist, flags=re.I)[0].strip()


def other_version(song: str) -> bool:
    """A remix / live take / sped-up edit, judged on the title's decorations only: "Live Off My Closet" is the song."""
    decor = re.findall(r"[\(\[]([^\)\]]*)[\)\]]", song) + re.split(r"\s+[-\u2013\u2014]\s+", song)[1:]
    return bool(VERSION.search(PLAIN.sub(" ", " ; ".join(decor))))


def key(song: str, artist: str) -> str:
    return f"{norm(song)}|{norm(primary(artist))}"


def main():
    rows: dict[str, dict] = {}

    def offer(r: dict, force: bool = False):
        k = r["k"]
        cur = rows.get(k)
        if force or cur is None or (cur["src"] != "seed" and r["d"] < cur["d"]):
            rows[k] = r

    seed_path = ROOT / "data" / "seed" / "non-dsp.json"
    if not seed_path.exists():
        sys.exit("REFUSING: data/seed/non-dsp.json is missing")
    for x in json.loads(seed_path.read_text())["rows"]:
        r = {"s": x["song"], "a": x["artist"], "d": x["date"], "g": "day", "src": "seed",
             "ds": x["dateSource"], "k": key(x["song"], x["artist"])}
        if x.get("youtubeId"):
            r["y"] = x["youtubeId"]
        if x.get("note"):
            r["n"] = x["note"]
        if x.get("where"):
            r["w"] = x["where"]
            r["dsp"] = any(w in ("itunes", "spotify", "apple") for w in x["where"])
        offer(r, force=True)
    n_seed = len(rows)

    req = urllib.request.Request(HOT100_CSV, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as resp:
        chart = csv.DictReader(io.StringIO(resp.read().decode("utf-8")))
        peaks: dict[str, int] = {}
        for c in chart:
            k = key(c["title"], c["performer"])
            pos = int(c["current_week"])
            peaks[k] = min(peaks.get(k, 101), pos)
            offer({"s": c["title"], "a": c["performer"], "d": c["chart_week"], "g": "day", "src": "hot100",
                   "ds": "entered the Hot 100", "k": k})
    n_hot = len(rows) - n_seed

    lanes_index = ERA / "lanes" / "index.json"
    passing = json.loads(lanes_index.read_text()).get("lanes", []) if lanes_index.exists() else []
    for lane in passing:
        lid = lane["lane"] if isinstance(lane, dict) else lane
        f = ERA / "lanes" / f"{lid}.json"
        if not f.exists():
            continue
        doc = json.loads(f.read_text())
        label = doc.get("label", lid)
        for w in doc["weeks"]:
            offer({"s": w["song"], "a": w["artist"], "d": w["date"], "g": "day", "src": f"lane:{lid}",
                   "ds": f"#1 on {label}", "k": key(w["song"], w["artist"])})

    for f in sorted((ERA / "heat").glob("[0-9][0-9][0-9][0-9]-[0-9][0-9].json")):
        doc = json.loads(f.read_text())
        for s in doc["sources"]:
            for x in s["rows"]:
                if not x.get("song") or not x.get("artist"):
                    continue
                offer({"s": x["song"], "a": x["artist"], "d": s["captured"], "g": "month", "src": f"heat:{s['id']}",
                       "ds": f"seen on {s['label']}", "k": key(x["song"], x["artist"])})

    # YouTube uploads add the songs the charts and blogs never had (most of Toronto, drill, grime). A scene channel's
    # upload of a song already known is not that song's debut, so it never replaces a row; nor does a remix or a
    # live take of something.
    n_before = len(rows)
    for f in sorted((ERA / "youtube").glob("[0-9][0-9][0-9][0-9]-[0-9][0-9].json")):
        doc = json.loads(f.read_text())
        va = doc.get("viewsAsOf")
        if not va:
            continue
        for s in doc.get("sources", []):
            handle = s["id"].split(":", 1)[-1]
            for x in s.get("rows", [])[:YT_PER_CHANNEL_MONTH]:
                if x.get("parsed") is False or not x.get("song") or not x.get("artist") or other_version(x["song"]):
                    continue
                k = key(x["song"], x["artist"])
                if k in rows or not x.get("videoId") or not x.get("published"):
                    continue
                rows[k] = {"s": x["song"], "a": x["artist"], "d": x["published"], "g": "day", "src": f"yt:{handle}",
                           "ds": f"uploaded to YouTube ({s['label']})", "k": k, "y": x["videoId"], "va": va}
    n_yt = len(rows) - n_before

    # Best Hot 100 peak ranks songs that share a title ("Hold On" has dozens).
    for k, r in rows.items():
        if k in peaks:
            r["p"] = peaks[k]
    out = sorted(rows.values(), key=lambda r: (r["d"], r["s"]))
    counts = {}
    for r in out:
        counts[r["src"].split(":")[0]] = counts.get(r["src"].split(":")[0], 0) + 1
    print(f"{len(out)} rows: {counts} (seed {n_seed}, new from hot100 {n_hot}, new from YouTube {n_yt}, lanes passing {len(passing)})")
    if len(out) < 5000:
        sys.exit(f"REFUSING: only {len(out)} rows")
    for probe in ["cuzmygear|chiefkeef", "somebodythatiusedtoknow|gotye", "1999|prince"]:
        print("  probe", probe, "→", next((f"{r['s']} / {r['a']} / {r['d']} / {r['src']}" for r in out if r["k"] == probe), "MISSING"))

    (ERA / "index.json").write_text(json.dumps({"built": date.today().isoformat(), "rows": out},
                                               ensure_ascii=False, separators=(",", ":")))
    print(f"wrote public/era/index.json ({(ERA / 'index.json').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
