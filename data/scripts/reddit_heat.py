#!/usr/bin/env python3
"""Reddit heat: top new-release posts per music subreddit per month.

For every month and subreddit it pages Arctic Shift (a free Reddit archive,
https://arctic-shift.photon-reddit.com, docs: github.com/ArthurHeitmann/arctic_shift/blob/master/api/README.md)
with a title keyword search, keeps posts whose title carries the community's
release tag ([FRESH], [FRESH VIDEO], ...), ranks them by upvotes and writes

  public/era/reddit/YYYY-MM.json   (only when at least one subreddit passed its canary)
  public/era/reddit/index.json     (every month x subreddit: rows, status, reason)

Arctic Shift cannot sort by score, so each month is paged by date (100 per page)
and ranked here. Stdlib only. Resumable: raw responses are cached under
data/cache/reddit/, so a re-run costs no requests for finished pages.

Usage: python3 data/scripts/reddit_heat.py [--from 2011-01] [--to 2025-12] [--only r/popheads]
"""
import argparse
import calendar
import datetime as dt
import hashlib
import html
import json
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "reddit"
OUT = ROOT / "public" / "era" / "reddit"
BASE = "https://arctic-shift.photon-reddit.com/api/posts/search"
UA = "MusicTimeMachine/2.0 (dev@jamesdare.com; era research)"
MIN_GAP = 1.1          # seconds between network requests (politeness: <= 1 req/s)
TOP_N = 15
MIN_ROWS = 5

# tag: regex a post title must match to count as a release post.
# first: first month the convention is real (checked against live titles, 2026-10-20).
SUBS = [
    {"id": "r/hiphopheads", "name": "hiphopheads", "keyword": "FRESH", "first": "2011-01",
     "tag": r"\[\s*FRESH\b[^\]]*\]", "label": "r/hiphopheads · [FRESH], top by upvotes"},
    {"id": "r/indieheads", "name": "indieheads", "keyword": "FRESH", "first": "2014-01",
     "tag": r"\[\s*FRESH\b[^\]]*\]", "label": "r/indieheads · [FRESH], top by upvotes"},
    {"id": "r/popheads", "name": "popheads", "keyword": "FRESH", "first": "2015-01",
     "tag": r"\[\s*FRESH\b[^\]]*\]", "label": "r/popheads · [FRESH], top by upvotes"},
]
# Checked and skipped: no stable release tag in real titles (probed 2015-05 and 2021-05).
NO_TAG = {
    "r/rnb": "[FRESH] exists but is used on only 1-4 posts a month (probed 2015-05, 2021-05, 2013-05), below the 5-row canary; its archive queries also time out most of the time",
    "r/electronicmusic": "no stable release tag ([NEW] appears on ~10% of posts from ~2020, titles otherwise carry genre brackets)",
    "r/Metal": "no stable release tag ([NEW RELEASE] on ~5 posts a month, most new music is untagged)",
    "r/country": "no release tag; new music is untagged",
    "r/CountryMusic": "no release tag; new music is untagged",
    "r/LetsTalkMusic": "discussion forum, not releases",
}

TAG_RE = {s["id"]: re.compile(s["tag"], re.I) for s in SUBS}
SEP_RE = re.compile(r"\s+[-–—]{1,2}\s+|\s*—\s*|\s*–\s*")
INFO_WORDS = re.compile(
    r"\b(prod|produced|official|video|audio|lyric|lyrics|explicit|clean|stream|streaming|"
    r"full|album|mixtape|ep|lp|single|leak|leaked|snippet|preview|mv|dir|directed|hd|"
    r"premiere|remix|download|free|dl|out now|visualizer|live)\b", re.I)
TRAIL_RE = re.compile(r"\s*(\[[^\[\]]*\]|\([^()]*\))\s*$")

stats = {"requests": 0, "http_429": 0, "timeouts_422": 0, "other_errors": 0, "cache_hits": 0}
_last_req = [0.0]
OFFLINE = [False]
_lock = threading.Lock()      # serialises the 1 req/s gate and the stats counters
_pause_until = [0.0]          # a 429 pauses every worker
WORKERS = 2                   # queries in flight; total request rate stays <= 1/s


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def cache_path(params):
    key = hashlib.sha1(params.encode()).hexdigest()[:16]
    return CACHE / (key + ".json")


def fetch(params):
    """Return list of post dicts, or raise RuntimeError(reason). Cached on success."""
    cp = cache_path(params)
    if OFFLINE[0] and not cp.exists():
        raise RuntimeError("offline: not cached")
    if cp.exists():
        stats["cache_hits"] += 1
        return json.loads(cp.read_text())["data"]
    url = BASE + "?" + params
    backoff_429 = [60, 120]
    timeouts = 0
    while True:
        with _lock:  # the gate: one request start per MIN_GAP across all workers
            now = time.time()
            start_at = max(now, _last_req[0] + MIN_GAP, _pause_until[0])
            _last_req[0] = start_at
            stats["requests"] += 1
        if start_at > now:
            time.sleep(start_at - now)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.load(r)
            if d.get("data") is not None:
                CACHE.mkdir(parents=True, exist_ok=True)
                cp.write_text(json.dumps({"params": params, "data": d["data"]}))
                return d["data"]
            err = str(d.get("error"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                with _lock:
                    stats["http_429"] += 1
                if not backoff_429:
                    raise RuntimeError("rate limited (429) after 60 s and 120 s back-off")
                w = backoff_429.pop(0)
                log(f"429, all workers pause {w}s")
                with _lock:
                    _pause_until[0] = max(_pause_until[0], time.time() + w)
                continue
            body = ""
            try:
                body = e.read().decode()[:200]
            except Exception:
                pass
            err = f"HTTP {e.code} {body}"
        except Exception as e:  # network / parse
            err = f"{type(e).__name__}: {e}"
        if "imeout" in err or "HTTP 422" in err:
            # Arctic Shift title queries time out while the DB warms; a retry ~6 s later is served.
            with _lock:
                stats["timeouts_422"] += 1
            timeouts += 1
            if timeouts >= 8:
                raise RuntimeError("archive query timed out 8 times")
            time.sleep(6)
            continue
        with _lock:
            stats["other_errors"] += 1
        timeouts += 1
        if timeouts >= 4:
            raise RuntimeError(err[:160])
        time.sleep(5)


def month_bounds(month):
    y, m = map(int, month.split("-"))
    start = int(dt.datetime(y, m, 1, tzinfo=dt.timezone.utc).timestamp())
    ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
    end = int(dt.datetime(ny, nm, 1, tzinfo=dt.timezone.utc).timestamp())
    return start, end


def month_posts(sub, month):
    start, end = month_bounds(month)
    posts, seen, cursor, pages = [], set(), start, 0
    while True:
        params = urllib.parse.urlencode({
            "subreddit": sub["name"], "after": cursor, "before": end, "limit": 100,
            "sort": "asc", "title": sub["keyword"],
            "fields": "title,score,num_comments,created_utc,id"})
        page = fetch(params)
        pages += 1
        new = [p for p in page if p["id"] not in seen]
        for p in new:
            seen.add(p["id"])
        posts.extend(new)
        if len(page) < 100 or not new or pages > 60:
            break
        cursor = max(p["created_utc"] for p in page)
    return posts


def clean_title(t):
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def parse_song(title, tag_re):
    """'[FRESH] Artist - Song (prod. X) [Official Video]' -> (artist, song) or None."""
    t = tag_re.sub(" ", title)
    t = re.sub(r"[\[(]?\b\d{1,2}:\d\d\b[\])]?", " ", t)  # durations like [3:41] / (3:29)
    t = re.sub(r"\s+", " ", t).strip(" -–—:|*")
    for _ in range(4):  # strip trailing info groups, keep '(feat. X)'
        m = TRAIL_RE.search(t)
        if not m:
            break
        grp = m.group(1)
        if re.match(r"[\[(]\s*(feat|ft|featuring|with)\b", grp, re.I):
            break
        if INFO_WORDS.search(grp) or re.fullmatch(r"[\[(]\s*(19|20)\d\d\s*[\])]", grp):
            t = t[:m.start()].rstrip()
        else:
            break
    parts = SEP_RE.split(t, maxsplit=1)
    if len(parts) != 2:
        return None
    artist, song = parts[0].strip(" \"'*_\u201c\u201d"), parts[1].strip(" \"'*_\u201c\u201d -")
    if not artist or not song or len(artist) > 80 or len(song) > 140:
        return None
    return artist, song


def build_rows(sub, posts):
    tag_re = TAG_RE[sub["id"]]
    best = {}
    for p in posts:
        title = clean_title(p["title"])
        if not tag_re.search(title):
            continue
        parsed = parse_song(title, tag_re)
        if not parsed:
            continue
        artist, song = parsed
        row = {"song": song, "artist": artist, "title": title, "score": int(p["score"]),
               "comments": int(p.get("num_comments") or 0),
               "url": f"https://www.reddit.com/{sub['id']}/comments/{p['id']}/",
               "posted": dt.datetime.fromtimestamp(p["created_utc"], dt.timezone.utc).strftime("%Y-%m-%d")}
        k = (artist.lower(), song.lower())
        if k not in best or row["score"] > best[k]["score"]:
            best[k] = row
    rows = sorted(best.values(), key=lambda r: (-r["score"], -r["comments"], r["posted"]))[:TOP_N]
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    return [{"rank": r["rank"], **{k: r[k] for k in ("song", "artist", "title", "score", "comments", "url", "posted")}} for r in rows]


def canary(rows):
    if len(rows) < MIN_ROWS:
        return f"only {len(rows)} usable release rows (need {MIN_ROWS})"
    for r in rows:
        if not r["song"].strip() or not r["artist"].strip():
            return "row with empty song or artist"
    for a, b in zip(rows, rows[1:]):
        if b["score"] > a["score"]:
            return "scores not non-increasing by rank"
    return None


def months(a, b):
    y, m = map(int, a.split("-"))
    ey, em = map(int, b.split("-"))
    while (y, m) <= (ey, em):
        yield f"{y:04d}-{m:02d}"
        m += 1
        if m == 13:
            y, m = y + 1, 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="a", default="2011-01")
    ap.add_argument("--to", dest="b", default="2025-12")
    ap.add_argument("--only", default=None)
    ap.add_argument("--offline", action="store_true", help="rebuild from cache only; uncached months keep their previous result")
    args = ap.parse_args()
    OFFLINE[0] = args.offline
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    today = dt.date.today().isoformat()
    idx_path = OUT / "index.json"
    index = json.loads(idx_path.read_text()) if idx_path.exists() else {"months": {}}
    index["built"] = today
    index["source"] = "Arctic Shift (arctic-shift.photon-reddit.com), Reddit archive; ranked by upvotes"
    index["subreddits"] = [{"id": s["id"], "tag": s["tag"], "first": s["first"], "label": s["label"]} for s in SUBS]
    index["skipped_subreddits"] = [{"id": k, "reason": v} for k, v in NO_TAG.items()]
    t0 = time.time()
    todo = [(month, sub) for month in months(args.a, args.b) for sub in SUBS
            if month >= sub["first"] and not (args.only and sub["id"] != args.only)]

    def work(job):
        month, sub = job
        try:
            posts = month_posts(sub, month)
            return posts, None
        except RuntimeError as e:
            return None, str(e)

    pool = ThreadPoolExecutor(max_workers=WORKERS)
    futs = {(job[0], job[1]["id"]): pool.submit(work, job) for job in todo}  # submitted oldest month first
    order = {s["id"]: i for i, s in enumerate(SUBS)}
    for month in months(args.a, args.b):
        entry = index["months"].setdefault(month, {})
        sources = []
        for sub in SUBS:
            if args.only and sub["id"] != args.only:
                continue
            if month < sub["first"]:
                entry[sub["id"]] = {"rows": 0, "status": "skipped", "reason": f"tag convention starts {sub['first']}"}
                continue
            posts, err = futs[(month, sub["id"])].result()
            if err == "offline: not cached":
                if entry.get(sub["id"], {}).get("status") == "ok":
                    old = json.loads((OUT / f"{month}.json").read_text())
                    sources.extend(x for x in old["sources"] if x["id"] == sub["id"])
                continue
            if err:
                entry[sub["id"]] = {"rows": 0, "status": "failed", "reason": err}
            else:
                rows = build_rows(sub, posts)
                why = canary(rows)
                entry[sub["id"]] = {"rows": len(rows), "status": "failed" if why else "ok",
                                    "reason": why, "candidates": len(posts)}
                if not why:
                    sources.append({"id": sub["id"], "label": sub["label"], "rows": rows})
            log(month, sub["id"], entry[sub["id"]]["status"], entry[sub["id"]]["rows"], entry[sub["id"]].get("reason") or "")
        mp = OUT / f"{month}.json"
        if args.only and mp.exists():  # keep sources from other --only runs
            old = json.loads(mp.read_text()).get("sources", [])
            sources = [s for s in old if s["id"] != args.only] + sources
        sources.sort(key=lambda s: order[s["id"]])
        if sources:
            mp.write_text(json.dumps({"month": month, "built": today, "sources": sources}, indent=1, ensure_ascii=False))
        elif mp.exists():
            mp.unlink()  # nothing passing its canary: nothing published
        idx_path.write_text(json.dumps(index, indent=1, ensure_ascii=False))
        (CACHE / "_stats_run.json").write_text(json.dumps({**stats, "runtime_s": round(time.time() - t0), "through": month}))
    pool.shutdown()
    run = round(time.time() - t0)
    prev = {}
    if args.offline:
        return
    sp = CACHE / "_stats.json"
    if sp.exists():
        prev = json.loads(sp.read_text())
    tot = {k: prev.get(k, 0) + v for k, v in stats.items()}
    tot["runtime_s"] = prev.get("runtime_s", 0) + run
    sp.write_text(json.dumps(tot, indent=1))
    log("done", json.dumps(stats), f"runtime {run}s", "cumulative", json.dumps(tot))


if __name__ == "__main__":
    sys.exit(main())
