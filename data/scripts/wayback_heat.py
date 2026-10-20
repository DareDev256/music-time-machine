#!/usr/bin/env python3
"""Off the charts: reconstruct what the internet was playing each month from
Internet Archive Wayback captures (2008-01 .. 2025-12, wherever captures exist).

Sources are registered in SOURCES below (id, genre, per-layout parsers). Legacy
parsers (hotnewhiphop, hypem, billboard) live here; new ones in wayback_sources.py.

Stdlib only, `python3 -I` safe. Run from anywhere:
    python3 -I data/scripts/wayback_heat.py [--from 2008-01] [--to 2025-12]
                                            [--minutes 150] [--offline]
                                            [--fetch hnhh,hypem,...]   (others are cache-only)

--offline never touches the network (cache only): re-parse after a parser fix.
Every fetched response is cached under data/cache/wayback/ so re-runs are free
(a re-run replays the whole archive from cache and fetches only what is missing).
Rules: ONE request at a time, >= 2 s between any two archive.org requests,
backoff 60/120 s on 429/503, abort the run after >10 consecutive failures.
Each month x source must pass its own canary or it is not published.
"""
import sys, os, re, io, json, gzip, time, html, hashlib, datetime, argparse
import urllib.request, urllib.error, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # -I drops the script dir
import wayback_sources as WS

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CACHE = os.path.join(ROOT, "data", "cache", "wayback")
OUT = os.path.join(ROOT, "public", "era", "heat")
UA = "MusicTimeMachine/2.0 (dev@jamesdare.com; era research)"
MIN_GAP = 2.0
MAX_ROWS = 20

# ----------------------------------------------------------------- network
class Net:
    def __init__(self, offline=False):
        self.offline = offline
        self.last = 0.0
        self.n = 0
        self.n429 = 0
        self.consec_fail = 0
        self.t0 = time.time()
        self.aborted = False

    def _sleep_gap(self):
        d = MIN_GAP - (time.time() - self.last)
        if d > 0:
            time.sleep(d)

    def get(self, url):
        """returns (bytes|None, error|None). error is '429', 'http404', 'net', 'offline'."""
        if self.offline:
            return None, "offline"
        backoffs = [60, 120]
        attempt = 0
        while True:
            self._sleep_gap()
            self.last = time.time()
            self.n += 1
            if self.n % 10 == 0:
                print("  [progress] %d requests, %d x429, %.1f min" % (self.n, self.n429, (time.time() - self.t0) / 60), flush=True)
            code = None
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = r.read()
                    if r.headers.get("Content-Encoding", "").lower() == "gzip" or data[:2] == b"\x1f\x8b":
                        try:
                            data = gzip.decompress(data)
                        except Exception:
                            pass
                self.last = time.time()
                self.consec_fail = 0
                return data, None
            except urllib.error.HTTPError as e:
                code = e.code
            except Exception:
                code = None
            self.last = time.time()
            if code in (429, 503):
                if code == 429:
                    self.n429 += 1
                if attempt < len(backoffs):
                    print("  [backoff] HTTP %s, sleeping %ds (429 total %d)" % (code, backoffs[attempt], self.n429), flush=True)
                    time.sleep(backoffs[attempt])
                    attempt += 1
                    continue
                self._fail()
                return None, str(code)
            self._fail()
            return None, ("http%s" % code) if code else "net"

    def _fail(self):
        self.consec_fail += 1
        if self.consec_fail > 10:
            self.aborted = True


def slug(s):
    return re.sub(r"[^a-zA-Z0-9]+", "_", s).strip("_")


def cache_path(name):
    return os.path.join(CACHE, name)


def cached_get(net, name, url):
    p = cache_path(name)
    if os.path.exists(p):
        with open(p, "rb") as f:
            return f.read(), None
    data, err = net.get(url)
    if data is not None:
        with open(p, "wb") as f:
            f.write(data)
    return data, err


def pick_captures(rows, ym, n=3):
    """rows: CDX json rows (header first). choose closest to the 15th."""
    if not rows or len(rows) < 2:
        return None
    hdr = rows[0]
    ti, oi = hdr.index("timestamp"), hdr.index("original")
    target = datetime.datetime(int(ym[:4]), int(ym[5:7]), 15, 12)
    cands = []
    for r in rows[1:]:
        ts = r[ti]
        try:
            d = datetime.datetime.strptime(ts[:14], "%Y%m%d%H%M%S")
        except ValueError:
            continue
        if d.strftime("%Y-%m") != ym:
            continue
        cands.append((abs((d - target).total_seconds()), ts, r[oi]))
    cands.sort()
    return [(ts, o) for _, ts, o in cands[:n]]


# ----------------------------------------------------------------- parsing
def clean(x):
    x = re.sub(r"<script.*?</script>", " ", x, flags=re.S | re.I)
    x = re.sub(r"<[^>]+>", " ", x)
    x = html.unescape(x).replace("\xa0", " ")
    return re.sub(r"\s+", " ", x).strip()


def decode(b):
    for enc in ("utf-8", "latin-1"):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            pass
    return b.decode("utf-8", "ignore")


def mk(rows, ranked=True):
    out = []
    for i, (s, a) in enumerate(rows):
        if len(a) > 120:  # posse cuts: keep the lead artist rather than discard a real row
            lead = re.split(r"(?i)\s+(?:feat\.?|featuring|ft\.?|with)\s+|,|&", a)[0].strip()
            if lead and len(lead) <= 100:
                a = lead + " et al."
        out.append({"rank": i + 1, "song": s, "artist": a, "raw": "%s - %s" % (a, s)})
    return out


def parse_hypem(h):
    rows = []
    for blk in re.findall(r'<h3 class="track_name">(.*?)</h3>', h, re.S):
        a = re.search(r'<a[^>]*class="artist"[^>]*>(.*?)</a>', blk, re.S)
        t = re.search(r'<a[^>]*href="/(?:track|item)/[^"]*"[^>]*>(.*?)</a>', blk, re.S)
        if a and t:
            tt = re.sub(r"\s*\+\d+ more$", "", clean(t.group(1)))
            tt = re.sub(r"^[,\s]+", "", tt)
            rows.append((tt, clean(a.group(1))))
    if not rows:  # older/newer layout: <span class="base-title"> / data attrs
        for t, a in re.findall(r'<a[^>]*class="track"[^>]*>(.*?)</a>.*?<a[^>]*class="artist"[^>]*>(.*?)</a>', h, re.S):
            rows.append((clean(t), clean(a)))
    if not rows:
        for m in re.finditer(r'<a class="artist"[^>]*>(.*?)</a>\s*<span[^>]*>\s*-\s*</span>\s*<a class="track"[^>]*>(.*?)</a>', h, re.S):
            rows.append((clean(m.group(2)), clean(m.group(1))))
    return rows


def _split_dash(txt):
    txt = re.sub(r"\s*\(\d{1,2}:\d{2}\)\s*$", "", clean(txt))
    if " - " in txt:
        a, t = txt.split(" - ", 1)
        return t.strip(), a.strip()
    return None


def parse_hnhh_front(h):
    """front page = newest-first editorial order (NOT a rank). Layouts by era; first one with >= 8 rows wins."""
    best, best_name = [], "unknown"
    cands = []

    def f1():  # 2011-09 .. 2012-08: htext h3 + span.artist
        return [(clean(t), clean(a)) for t, a in re.findall(
            r'<h3><a href="[^"]*"[^>]*>((?:(?!</h3>).)*?)</a></h3>\s*(?:<[^>]+>\s*)*<p><span class="artist">((?:(?!</p>).)*?)</span>', h, re.S)]

    def f2():  # 2010-04 .. 2011-08: today-song blocks
        out = []
        for blk in re.findall(r'<div class="today-song">(.*?)<div class="description">', h, re.S):
            t = re.search(r'<a[^>]*class="title"[^>]*>(.*?)</a>', blk, re.S)
            a = re.search(r'<div class="artist-name">(.*?)</div>', blk, re.S)
            if t and a:
                out.append((clean(t.group(1)), clean(a.group(1))))
        return out

    def f3():  # 2012-09 .. 2013: newCell centerBlock h3 + artistLink
        return [(clean(t), clean(a)) for t, a in re.findall(
            r'<div class="centerBlock">\s*<h3><a [^>]*>((?:(?!</h3>).)*?)</a></h3>\s*<a class="artistLink"[^>]*>((?:(?!</a>).)*?)</a>', h, re.S)]

    def f4():  # 2013-12 .. 2014: newest-first timeline "Artist - Title" tagged songs
        out = []
        for t in re.findall(r'<a href="[^"]*"[^>]*>((?:(?!</a>).)*?)</a>\s*<a [^>]*class="mid-col-cat"[^>]*>\s*songs\s*</a>', h, re.S):
            x = _split_dash(html.unescape(t))
            if x and x not in out:
                out.append(x)
        return out

    def f0():  # 2010-01 .. 2010-03: <p><a href=file>Artist - Title</a> (m:ss)
        out = []
        for txt in re.findall(r'<p>\s*<a\s+href="https?://[^"]+"[^>]*>((?:(?!</a>).)*?)</a>\s*\(\d{1,2}:\d{2}\)', h, re.S):
            x = _split_dash(txt)
            if x:
                out.append(x)
        return out

    def f00():  # 2008-2009: <a class="ImLink" href=file> Artist - Title</a> (m:ss)
        out = []
        for txt in re.findall(r'<a class="ImLink"[^>]*href="https?://[^"]+"[^>]*>((?:(?!</a>).)*?)</a>\s*\(\d{1,2}:\d{2}\)', h, re.S):
            x = _split_dash(txt)
            if x:
                out.append(x)
        return out

    def f6():  # 2017-09 .. 2022: dailySongChart-item cards (song + artist strongs)
        out = []
        for blk in re.findall(r'<a class="dailySongChart-item"[^>]*>(.*?)(?=<a class="dailySongChart-item"|$)', h, re.S):
            t = re.search(r'class="cover-title">(.*?)</div>', blk, re.S)
            a = re.search(r'<div class="dailySongChart-artist">(.*?)</div>', blk, re.S)
            if t and a:
                out.append((clean(t.group(1)), clean(a.group(1))))
        return out

    def f5():  # 2015-2017: song posts whose link title is "Artist - Title"
        seen, out = set(), []
        for m in re.finditer(r'<a\b[^>]*?href="([^"]*-new-song\.\d+\.html)"[^>]*?>', h):
            t = re.search(r'\btitle="([^"]*)"', m.group(0))
            if not t or m.group(1) in seen:
                continue
            seen.add(m.group(1))
            x = _split_dash(html.unescape(t.group(1)))
            if x and x not in out:
                out.append((x[0].strip('"'), x[1]))
        return out

    def nz(rows):
        seen, out = set(), []
        for t, a in rows:
            if t and a and a.strip().lower() not in ("ad", "ads", "advertisement") and (t, a) not in seen:
                seen.add((t, a))
                out.append((t, a))
        return out

    for name, fn in (("F1", f1), ("F2", f2), ("F3", f3), ("F4", f4), ("F6", f6), ("F5", f5), ("F0", f0), ("F00", f00)):
        r = nz(fn())
        if len(r) >= 8:
            return r
        if len(r) > len(best):
            best = r
    return best


def parse_hnhh_top100_chartitem(h):
    """2015-2022 layout: li.chartItem = rank bubble, trackTitle (em/a), artist strongs (collab = several strongs)."""
    seen = {}
    for blk in re.findall(r'<li class="chartItem"[^>]*>(.*?)(?=<li class="chartItem"|</ul>|$)', h, re.S):
        rk = re.search(r'chartItem-bubble-rank">\s*(\d+)\s*<', blk)
        t = re.search(r'chartItem-artist-trackTitle[^"]*"[^>]*>(.*?)</(?:em|a)>', blk, re.S)
        a = re.search(r'chartItem-artist-info[^>]*>(.*?)</(?:em|div)>', blk, re.S)
        if rk and t and a and int(rk.group(1)) not in seen:
            seen[int(rk.group(1))] = (clean(t.group(1)), clean(a.group(1)))
    return [seen[k] for k in sorted(seen)]


def parse_hnhh_top100(h):
    """three older layouts share a rank marker (hot-place / number-span) followed by an h3 song link and an artist."""
    if "chartItem-bubble-rank" in h:
        r = parse_hnhh_top100_chartitem(h)
        if len(r) >= 8:
            return r
    marks = list(re.finditer(r'(?:<span class="number-span">|<p class="hot-place">)\s*(\d+)\s*<', h))
    seen = {}
    for i, m in enumerate(marks):
        chunk = h[m.end(): marks[i + 1].start() if i + 1 < len(marks) else m.end() + 4000]
        chunk = chunk[:4000]
        t = re.search(r'<h3>\s*<a [^>]*>(.*?)</a>\s*</h3>', chunk, re.S)
        if not t:
            continue
        rest = chunk[t.end():]
        a = re.match(r'\s*(?:<[^>]+>\s*)*?<p>(.*?)</p>', rest, re.S) if rest.lstrip().startswith("<p>") else None
        if a is None:
            a = re.search(r'class="artistLink"[^>]*>(.*?)</a>', rest, re.S)
        if a is None:
            a = re.match(r'\s*<p>(.*?)</p>', rest, re.S)
        if not a:
            continue
        rk = int(m.group(1))
        if rk not in seen:
            seen[rk] = (clean(t.group(1)), clean(a.group(1)))
    if len(seen) < 8:  # 2014 layout: bubble-number + list-item-name / list-item-subname
        for rk, blk in re.findall(r'<em\s+class="bubble-number[^"]*">\s*(\d+)\s*</em>(.*?)(?=<em\s+class="bubble-number|$)', h, re.S):
            t = re.search(r'<em\s+class="list-item-name">(.*?)</em>', blk, re.S)
            a = re.search(r'<em\s+class="list-item-subname">(.*?)</em>', blk, re.S)
            if t and a and int(rk) not in seen:
                seen[int(rk)] = (clean(t.group(1)), clean(a.group(1)))
    return [seen[k] for k in sorted(seen)]


def parse_billboard(h):
    """detect layout: A = <div class="info"><h2>title</h2><h3>artist</h3> (2011-12);
    B = billboard.charts.data JSON only; C = chart-row markup (2013+)."""
    n_json = len(re.findall(r'"entityId"\s*:', h))
    rows = []
    for t, a in re.findall(r'<div class="info">\s*<h2>(.*?)</h2>\s*<h3>(.*?)</h3>', h, re.S):
        t, a = clean(t), clean(a)
        if t.startswith("We'd love to hear"):
            continue
        rows.append((t, a))
    if rows:
        if n_json:
            rows = rows[:n_json]
        return rows, "A"
    items = re.findall(r'"title"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,"artist"\s*:\s*"((?:[^"\\]|\\.)*)"', h)
    if items:
        try:
            items = [(json.loads('"%s"' % t), json.loads('"%s"' % a)) for t, a in items]
        except Exception:
            pass
        return [(clean(t), clean(a)) for t, a in items], "B"
    return parse_billboard_c(h)


def parse_billboard_c(h):
    """layout C (2013): <span class="chart_position">N</span><h1>title</h1><p class="chart_info"><a>artist</a>"""
    rows = {}
    for rk, t, a in re.findall(r'<span class="chart_position[^"]*">\s*(\d+)\s*</span>\s*<h1>(.*?)</h1>\s*<p class="chart_info">\s*(.*?)(?:<br|</p>)', h, re.S):
        rows.setdefault(int(rk), (clean(t), clean(a)))
    if rows:
        return [rows[k] for k in sorted(rows)], "C"
    return parse_billboard_d(h)


def parse_billboard_d(h):
    """layout D (2014+): chart-row / chart_row markup."""
    rows = []
    for blk in re.findall(r'<article[^>]*class="[^"]*chart-row[^"]*"[^>]*>(.*?)</article>', h, re.S):
        t = re.search(r'class="chart-row__song"[^>]*>(.*?)</h2>', blk, re.S)
        a = re.search(r'class="chart-row__artist"[^>]*>(.*?)</(?:a|span|h3)>', blk, re.S)
        if t and a:
            rows.append((clean(t.group(1)), clean(a.group(1))))
    if rows:
        return rows, "D"
    if "Information Not Found" in h or "Page Loading Error" in h:
        return [], "error-page"
    return [], "unknown"


# ----------------------------------------------------------------- canary
BLOCK_SUB = re.compile(r"(?i)(click here|privacy policy|terms of (use|service)|all rights reserved|read more|sign in|log ?in\b|"
                       r"subscribe|https?:|www\.|\.com\b|javascript|cookie policy|accept cookies|advertisement|download the app|"
                       r"we'd love to hear|feedback|newsletter|follow us|share this|contact us|view all|see all)")
BLOCK_EXACT = {"menu", "login", "register", "loading", "comments", "comment", "ad", "ads", "advertisement",
               "undefined", "null", "n/a", "sign up", "search", "more...", "share this"}


MIN_ROWS = {"pitchfork_bnt": 5}  # pitchfork's 2012-15 BNT page only ever listed ~5 tracks; every other source needs 8


def canary(rows, ranked, prev_rows=None, is_hypem=False, min_rows=8):
    if len(rows) < min_rows:
        return "only %d rows (<%d)" % (len(rows), min_rows)
    for r in rows[:MAX_ROWS]:
        for k in ("song", "artist"):
            v = r[k]
            if not v:
                return "empty %s at rank %d" % (k, r["rank"])
            if len(v) > 120:
                return "%s longer than 120 chars at rank %d" % (k, r["rank"])
            if BLOCK_SUB.search(v) or v.strip().lower() in BLOCK_EXACT or re.fullmatch(r"[\W_]+", v):
                return "ui/nav-like %s %r at rank %d" % (k, v[:40], r["rank"])
    if ranked:
        ranks = [r["rank"] for r in rows]
        if ranks != list(range(1, len(rows) + 1)):
            return "ranks not 1..N unique"
    if is_hypem and prev_rows is not None:
        if [(r["song"], r["artist"]) for r in rows] == [(r["song"], r["artist"]) for r in prev_rows]:
            return "identical to previous month (stale capture)"
    return None


# ----------------------------------------------------------------- registry
def _p_hnhh(h, kind):
    return (parse_hnhh_top100(h) if kind == "top100" else parse_hnhh_front(h)), None


def _p_hypem(h, kind):
    return parse_hypem(h), None


def _p_billboard(h, kind):
    r, layout = parse_billboard(h)
    if not r:  # layouts added after 2014 live in wayback_sources
        r2, l2 = WS.parse_billboard_modern(h)
        if r2:
            return r2, l2
    return r, layout


def V(kind, url, parse, frm="2008-01", to="2025-12", why=None):
    """frm/to bound the months this layout is attempted for; outside them the month is 'skipped' (why)."""
    return {"kind": kind, "url": url, "parse": parse, "frm": frm, "to": to, "why": why}


HNHH_WHY = ("2023+ hotnewhiphop is a client-rendered Next/Astro site: /top100 ships no rows in the raw capture and the "
            "front page is news headlines, not song+artist; no parser attempted")

# (sid, genre, tier, {kind: label}, [variants in preference order]).  tier = build priority.
SOURCES = [
    ("hotnewhiphop", "hip-hop", 1, {"top100": "HotNewHipHop · Top 100 (popularity rank)",
                                    "front": "HotNewHipHop · Front page (newest first, editorial order, not a rank)"},
     [V("top100", "hotnewhiphop.com/top100", _p_hnhh, "2008-01", "2022-12", HNHH_WHY),
      V("front", "hotnewhiphop.com/", _p_hnhh, "2008-01", "2022-12", HNHH_WHY)]),
    ("hypem", "indie", 1, {"ranked": "Hype Machine · Popular"},
     [V("ranked", "hypem.com/popular", _p_hypem)]),
    ("billboard_rap", "hip-hop", 1, {"ranked": "Billboard · Rap Songs"},
     [V("ranked", "billboard.com/charts/rap-songs", _p_billboard), V("ranked", "billboard.com/charts/rap-song", _p_billboard)]),
    ("billboard_rnb", "hip-hop", 1, {"ranked": "Billboard · R&B/Hip-Hop Songs"},
     [V("ranked", "billboard.com/charts/r-b-hip-hop-songs", _p_billboard)]),
    ("pitchfork_bnt", "all", 2, {"front": "Pitchfork · Best New Tracks (newest first, not a rank)"},
     [V("front", "pitchfork.com/reviews/best/tracks/", WS.parse_pitchfork)]),
    ("billboard_country", "country", 3, {"ranked": "Billboard · Country Songs"},
     [V("ranked", "billboard.com/charts/country-songs", _p_billboard)]),
] + WS.EXTRA_SOURCES(_p_billboard)

SRC = {s[0]: s for s in SOURCES}


def label_for(sid, kind):
    return SRC[sid][3].get(kind) or list(SRC[sid][3].values())[0]


# ----------------------------------------------------------------- run
def months(a, b):
    y, m = int(a[:4]), int(a[5:7])
    yb, mb = int(b[:4]), int(b[5:7])
    while (y, m) <= (yb, mb):
        yield "%04d-%02d" % (y, m)
        m += 1
        if m > 12:
            y, m = y + 1, 1


_range_cdx = {}


def range_cdx(net, url):
    """ONE CDX request per URL for the whole 2008-2025 span (daily collapse); cached.
    returns (rows|None, err)."""
    if url in _range_cdx:
        return _range_cdx[url]
    q = ("http://web.archive.org/cdx/search/cdx?url=%s&from=2008&to=2025&output=json"
         "&filter=statuscode:200&collapse=timestamp:8&fl=timestamp,original" % urllib.parse.quote(url, safe="/:"))
    name = "cdxr_%s.json" % slug(url)
    data, err = cached_get(net, name, q)
    tries = 0
    while data is None and err not in ("offline",) and tries < 2 and not net.aborted:
        tries += 1
        time.sleep(20)
        data, err = cached_get(net, name, q)
    if data is None:
        res = (None, err)
    else:
        try:
            res = (json.loads(data.decode("utf-8") or "[]"), None)
        except Exception:
            try:
                os.remove(cache_path(name))
            except OSError:
                pass
            res = (None, "cdx-json")
    if res[0] is not None or err == "offline":
        _range_cdx[url] = res
    return res


def month_cdx(net, url, ym):
    """legacy per-month CDX cache (2010-2014 runs) wins so cached pages are reused; else the range CDX."""
    ycompact = ym.replace("-", "")
    p = cache_path("cdx_%s_%s.json" % (slug(url), ycompact))
    if os.path.exists(p):
        try:
            with open(p, "rb") as f:
                return json.loads(f.read().decode("utf-8") or "[]"), None
        except Exception:
            pass
    return range_cdx(net, url)


def fetch_source(net, sid, ym):
    """returns result dict: status parsed/error/none/notrun."""
    variants = SRC[sid][4]
    last_fail = None
    best = None
    skipped = None
    for v in variants:
        kind, url = v["kind"], v["url"]
        if not (v["frm"] <= ym <= v["to"]):
            skipped = v["why"] or "outside parsed range %s..%s" % (v["frm"], v["to"])
            continue
        rows, err = month_cdx(net, url, ym)
        if rows is None:
            if err == "offline":
                last_fail = {"status": "notrun", "reason": "not cached (offline / not fetched this run)"}
                continue
            return {"status": "error", "error": err or "net", "reason": "cdx lookup: %s" % err}
        caps = pick_captures(rows, ym)
        if not caps:
            last_fail = {"status": "none", "reason": "no 200 capture in month for %s" % url}
            continue
        res = None
        for ts, orig in caps:  # closest to the 15th first; fall through only if it yields nothing usable
            raw_url = "https://web.archive.org/web/%sid_/%s" % (ts, orig)
            body, err = cached_get(net, "page_%s_%s.html" % (ts, slug(orig)), raw_url)
            if body is None:
                if err == "offline":
                    last_fail = {"status": "notrun", "reason": "page not cached (offline / not fetched this run)"}
                    break
                res = {"status": "error", "error": err or "net", "reason": "page fetch %s" % err, "capture_ts": ts}
                if net.aborted or err in ("429", "503"):
                    break
                continue
            h = decode(body)
            try:
                prs, layout = v["parse"](h, kind)
            except Exception as e:  # a parser bug must not kill the run
                prs, layout = [], "parser-exception:%s" % type(e).__name__
            rws = mk(prs)
            res = {"kind": kind, "ts": ts, "orig": orig, "rows": rws, "layout": layout, "n": len(rws),
                   "_ranked": kind != "front", "status": "parsed"}
            if len(rws) >= MIN_ROWS.get(sid, 8):
                break
            if not rws and len(body) > 30000:  # a full page that parses to nothing = unknown layout; more captures would not help
                break
        if res is None:
            continue
        if res["status"] == "error":
            if best is None:
                best = res
            if net.aborted:
                break
            continue
        if best is None or best["status"] == "error" or res["n"] > best.get("n", -1):
            best = res
        if res["n"] >= MIN_ROWS.get(sid, 8):
            break
    if best is not None:
        if best["status"] == "parsed" and best["n"] >= MIN_ROWS.get(sid, 8) and best["kind"] != variants[0]["kind"] and sid == "hotnewhiphop":
            best["note"] = "top100 unavailable or unparsed; used front"
        return best
    if last_fail is None and skipped:
        return {"status": "skipped", "reason": skipped}
    return last_fail or {"status": "none", "reason": "no variant"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="a", default="2008-01")
    ap.add_argument("--to", dest="b", default="2025-12")
    ap.add_argument("--minutes", type=float, default=150.0)
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--fetch", default="", help="comma list of source ids allowed to hit the network (default: all)")
    ap.add_argument("--tier", type=int, default=99, help="only fetch sources up to this tier")
    args = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    net = Net(args.offline)
    today = datetime.date.today().isoformat()
    allm = list(months(args.a, args.b))
    deadline = time.time() + args.minutes * 60
    only = set(x for x in args.fetch.split(",") if x)
    results = {}  # sid -> month -> entry
    stopped = None
    live = net
    cache_net = Net(True)

    for sid, genre, tier, labels, variants in SOURCES:
        results[sid] = {}
        may_fetch = (not args.offline) and (not only or sid in only) and tier <= args.tier
        for ym in allm:
            use = live if may_fetch else cache_net
            if may_fetch and time.time() > deadline:
                use = cache_net
            if may_fetch and net.aborted:
                use = cache_net
                stopped = "aborted: >10 consecutive request failures"
            results[sid][ym] = fetch_source(use, sid, ym)
        c = {}
        for ym in allm:
            s = results[sid][ym].get("status")
            c[s] = c.get(s, 0) + 1
        print("%-18s %s  [%.1f min, %d req]" % (sid, c, (time.time() - net.t0) / 60, net.n), flush=True)

    # persist request stats
    sp = os.path.join(CACHE, "_stats.json")
    try:
        with open(sp) as f:
            st = json.load(f)
    except Exception:
        st = {"requests": 0, "total_429": 0}
    if net.n and not args.offline:
        st["requests"] += net.n
        st["total_429"] += net.n429
        st["runtime_min"] = round(st.get("runtime_min", 0) + (time.time() - net.t0) / 60, 1)
        with open(sp, "w") as f:
            json.dump(st, f)

    # canary + publish (chronological, so the stale check has the previous month)
    index = {"built": today, "range": [args.a, args.b], "total_429": st["total_429"], "requests": st["requests"],
             "stopped": stopped, "not_yet_run": {}, "sources": {}, "months": {}}
    for sid, genre, tier, labels, variants in SOURCES:
        index["sources"][sid] = {"genre": genre, "tier": tier, "label": list(labels.values())[0]}
    pubs = {ym: [] for ym in allm}
    idxm = {ym: {} for ym in allm}
    for sid, genre, tier, labels, variants in SOURCES:
        prev = None
        for ym in allm:
            r = results[sid][ym]
            s = r.get("status")
            if s == "parsed":
                rows = r["rows"]
                why = canary(rows, r["_ranked"], prev, True, MIN_ROWS.get(sid, 8))
                if why:
                    idxm[ym][sid] = {"status": "failed", "reason": why, "capture_ts": r["ts"], "list": r["kind"], "layout": r.get("layout"), "genre": genre}
                else:
                    cts = r["ts"]
                    pubs[ym].append({
                        "id": sid, "genre": genre, "label": label_for(sid, r["kind"]),
                        "list": "ranked" if r["_ranked"] else "front",
                        "capture": "https://web.archive.org/web/%s/%s" % (cts, r["orig"]),
                        "captured": "%s-%s-%s" % (cts[:4], cts[4:6], cts[6:8]),
                        "rows": [{"rank": x["rank"], "song": x["song"], "artist": x["artist"]} for x in rows[:MAX_ROWS]],
                    })
                    idxm[ym][sid] = {"status": "pass", "genre": genre, "list": r["kind"], "capture_ts": cts, "rows": len(rows), "layout": r.get("layout")}
                    if r.get("note"):
                        idxm[ym][sid]["note"] = r["note"]
                prev = rows
            elif s == "error":
                idxm[ym][sid] = {"status": "error", "genre": genre, "error": r.get("error"), "reason": r.get("reason")}
            elif s == "skipped":
                idxm[ym][sid] = {"status": "skipped", "genre": genre, "reason": r.get("reason")}
            elif s == "notrun":
                idxm[ym][sid] = {"status": "not_run", "genre": genre}
                index["not_yet_run"].setdefault(sid, []).append(ym)
            else:
                idxm[ym][sid] = {"status": "none", "genre": genre, "reason": r.get("reason")}
    order = [s[0] for s in SOURCES]
    for ym in allm:
        index["months"][ym] = idxm[ym]
        fp = os.path.join(OUT, ym + ".json")
        if pubs[ym]:
            pubs[ym].sort(key=lambda x: order.index(x["id"]))
            with open(fp, "w") as f:
                json.dump({"month": ym, "built": today, "sources": pubs[ym]}, f, ensure_ascii=False, indent=1)
        elif os.path.exists(fp):
            os.remove(fp)
    with open(os.path.join(OUT, "index.json"), "w") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

    # coverage table: source x year
    sym = {"pass": 0, "failed": 1, "error": 2, "none": 3, "not_run": 4, "skipped": 5}
    print("\nCOVERAGE source x year: pass/failed/error/no-capture/not-run/skipped")
    years = sorted(set(m[:4] for m in allm))
    for sid, *_ in SOURCES:
        parts = []
        for y in years:
            cnt = [0] * 6
            for ym in allm:
                if ym[:4] == y:
                    cnt[sym[idxm[ym][sid]["status"]]] += 1
            parts.append("%s:%s" % (y, "/".join(map(str, cnt))))
        print("%-18s %s" % (sid, " ".join(parts)))
    print("429 count (this run): %d   requests (this run): %d   runtime: %.1f min   | cumulative requests %d, 429 %d"
          % (net.n429, net.n, (time.time() - net.t0) / 60, st["requests"], st["total_429"]))
    if index["not_yet_run"]:
        print("NOT YET RUN: %s" % {k: len(v) for k, v in index["not_yet_run"].items()})
    if stopped:
        print(stopped)


if __name__ == "__main__":
    main()
