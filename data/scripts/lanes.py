#!/usr/bin/env python3
"""Build public/era/lanes/<lane>.json: the #1 song per chart week, per genre LANE.

Python 3 stdlib only (html.parser, urllib, json). Run: python3 data/scripts/lanes.py [lane ...]

Source: Wikipedia per-year (or per-decade) "number ones" list pages, fetched through
the MediaWiki parse API (CC BY-SA 4.0; chart positions are facts). Page titles are NOT
hard-coded blindly: for every lane/year a list of candidate titles (Wikipedia renamed
these series several times) is checked against the API (action=query, redirects=1)
and the first one that really exists is used. A lane whose pages cannot be found is
dropped, loudly.

House pattern (see hot100_number_ones.py / hot100_weekly.py): refuse to write a lane
that fails its canaries, keep going with the others, print why, end with a table.

Canaries (per lane, any one refuses THAT lane):
  1. a year inside the lane's range parses to zero rows (documented historical
     suspensions in KNOWN_GAPS are the only exemption, and are printed);
  2. weekly cadence: more than 2% of consecutive weeks not exactly 7 days apart;
  3. any song/artist cell empty, or still holding wiki markup / reference brackets;
  4. fewer than 40 weeks in a full (interior) year;
  5. (rap only) disagreement with the independent R&B/Hip-Hop page "Rap Songs" column
     on more than 10% of overlapping weeks.

Run-style tables (one row per run: start date + "Weeks at number one") are expanded
into one row per week, 7 days apart, truncated where the next run starts.

UK: Wikipedia dates the UK chart by "week starting" (Friday) until the chart year 1969
and by "week ending" (Saturday) after; the 1969->1970 change and Christmas/strike weeks
make some gaps != 7 days. We keep the date Wikipedia gives (no guessing), expand runs
by 7 days, and treat the UK cadence canary as: gaps that are an exact multiple of 7
days (missing chart weeks, e.g. postal strike) or a single issue-day shift (<7 days)
count as "irregular" but only fail the lane above 2%; the lane JSON carries
"date_basis" so a consumer knows which day-of-week each date is.
"""
import datetime as dt
import json
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, unquote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "era" / "lanes"
HOT100_DIR = ROOT / "public" / "era" / "hot100"
UA = {"User-Agent": "MusicTimeMachine/2.0 (dev@jamesdare.com)"}
API = "https://en.wikipedia.org/w/api.php"
TODAY = dt.date.today()
LICENSE = "CC BY-SA 4.0"

# ---------------------------------------------------------------- lane config
# kind "peryear": candidate titles per year, tried in order. {y} = year.
# kind "pages":   explicit list of (title, first_year, last_year) decade pages.
LANES = {
    "rnb_hiphop": dict(
        label="Hot R&B/Hip-Hop Songs", kind="peryear", from_year=1958,
        series="Wikipedia: Lists of Billboard number-one R&B/hip-hop songs by year (R&B Best Sellers 1958, Hot R&B Sides, Hot Black Singles, Hot R&B Singles, Hot R&B/Hip-Hop Singles & Tracks, Hot R&B/Hip-Hop Songs)",
        charts=[r"^(Hot )?R&B/Hip-Hop Songs$", r"^Best Sellers"],
        patterns=["List of number-one R&B/hip-hop songs of {y} (U.S.)", "List of Billboard Hot R&B/Hip-Hop Songs number ones of {y}",
                  "List of Billboard number-one R&B/hip-hop songs of {y}", "List of Hot R&B/Hip-Hop Songs number ones of {y}",
                  "List of Hot R&B/Hip-Hop Singles & Tracks number ones of {y}", "List of Hot R&B Singles & Tracks number ones of {y}",
                  "List of Hot R&B Singles number ones of {y}", "List of Hot Black Singles number ones of {y}",
                  "List of number-one R&B singles of {y} (U.S.)", "List of Billboard number-one R&B songs of {y}"],
        # Billboard published no R&B chart from 1963-11-30 to 1965-01-30 (no 1964 page exists).
        known_gaps={1964: "Billboard published no R&B singles chart between 1963-11-30 and 1965-01-30"},
        date_basis="Billboard issue date: Monday through 1961-12-25, Saturday from 1962-01-06"),
    "rap": dict(
        label="Hot Rap Songs", kind="pages", from_year=1989,
        series="Wikipedia: List of Billboard number-one rap singles / Hot Rap Songs number ones (decade pages), 2020s from the Rap Songs column of the per-year R&B/Hip-Hop pages",
        charts=[r"^(Hot )?Rap Songs$"],
        pages=[("List of Billboard number-one rap singles of the 1980s and 1990s", 1989, 1999),
               ("List of Billboard number-one rap singles of the 2000s", 2000, 2009),
               ("List of Billboard Hot Rap Songs number ones of the 2010s", 2010, 2019)],
        # No decade page exists for the 2020s; the per-year R&B/Hip-Hop pages carry a Rap Songs column.
        extra_peryear=dict(from_year=2020, patterns=["List of Billboard Hot R&B/Hip-Hop Songs number ones of {y}",
                                                    "List of number-one R&B/hip-hop songs of {y} (U.S.)"]),
        crosscheck_peryear=dict(from_year=2013, to_year=2019, patterns=["List of number-one R&B/hip-hop songs of {y} (U.S.)",
                                                                       "List of Billboard Hot R&B/Hip-Hop Songs number ones of {y}"]),
        date_basis="issue date (Saturday)"),
    "country": dict(
        label="Hot Country Songs", kind="peryear", from_year=1958,
        series="Wikipedia: Lists of Billboard number-one country songs by year (Best Sellers 1958, Hot C&W Sides, Hot Country Singles, Hot Country Singles & Tracks, Hot Country Songs)",
        charts=[r"^Hot Country Songs$", r"^Best Sellers"],
        patterns=["List of Billboard number-one country songs of {y}", "List of Hot Country Songs number ones of {y}",
                  "List of Hot Country Singles & Tracks number ones of {y}", "List of Hot Country Singles number ones of {y}",
                  "List of number-one country singles of {y} (U.S.)"],
        known_gaps={}, date_basis="Billboard issue date: Monday through 1961-12-25, Saturday from 1962-01-06"),
    "rock_alt": dict(
        label="Alternative Airplay (Modern Rock Tracks)", kind="pages", from_year=1988,
        series="Wikipedia: List of Billboard Modern Rock Tracks / Alternative Songs / Alternative Airplay number ones (decade pages)",
        charts=[],
        pages=[("List of Billboard Modern Rock Tracks number ones of the 1980s", 1988, 1989),
               ("List of Billboard Modern Rock Tracks number ones of the 1990s", 1990, 1999),
               ("List of Billboard Modern Rock Tracks number ones of the 2000s", 2000, 2009),
               ("List of Billboard Alternative Songs number ones of the 2010s", 2010, 2019),
               ("List of Billboard Alternative Airplay number ones of the 2020s", 2020, TODAY.year)],
        date_basis="issue date (Saturday)"),
    "dance": dict(
        label="Dance Club Songs", kind="peryear", from_year=1976,
        series="Wikipedia: Lists of Billboard number-one dance songs by year (Hot Dance Club Play / Dance Club Songs)",
        charts=[r"Club (Play|Songs)$"],
        patterns=["List of Billboard number-one dance songs of {y}", "List of Billboard number-one dance singles of {y}",
                  "List of Billboard Dance Club Songs number ones of {y}", "List of number-one dance singles of {y} (U.S.)",
                  "List of Billboard Hot Dance Club Play number ones of {y}"],
        known_gaps={}, date_basis="issue date (Saturday)"),
    "latin": dict(
        label="Hot Latin Songs", kind="peryear", from_year=1986,
        series="Wikipedia: Lists of Billboard Hot Latin Songs (Hot Latin Tracks / Top Latin Songs) number ones by year",
        charts=[r"Latin (Songs|Tracks)$", r"^Hot Latin Songs$"],
        patterns=["List of Billboard Hot Latin Songs and Latin Airplay number ones of {y}", "List of number-one Billboard Hot Latin Songs of {y}",
                  "List of number-one Billboard Hot Latin Tracks of {y}", "List of Billboard Hot Latin Songs number ones of {y}",
                  "List of Billboard Hot Latin Tracks number ones of {y}", "List of number-one Billboard Top Latin Songs of {y}",
                  "List of number-one Billboard Hot Latin Songs of {y} (U.S.)"],
        known_gaps={}, date_basis="issue date (Saturday)"),
    "uk": dict(
        label="UK Singles Chart", kind="pages", from_year=1952,
        series="Wikipedia: List of UK singles chart number ones of the 1950s ... 2020s",
        charts=[],
        pages=[(f"List of UK singles chart number ones of the {d}s", d, d + 9) for d in range(1950, TODAY.year // 10 * 10 + 1, 10)],
        date_basis="date exactly as Wikipedia lists it: Friday 1952-11-14, Thursday from 1960-03-03, Wednesday from 1967-07-19, Sunday 1969-08-24, Saturday (week ending) 1969-12-20 to 2015-07-04, Thursday (week ending) from 2015-07-09; every run is expanded 7 days at a time, so only these era switches break the 7-day cadence"),
    "canada": dict(
        label="Canadian Hot 100", kind="peryear", from_year=2007,
        series="Wikipedia: List of Canadian Hot 100 number-one singles of YYYY",
        charts=[],
        patterns=["List of Canadian Hot 100 number-one singles of {y}", "List of number-one singles of {y} (Canada)"],
        # The 2007 page also lists pre-chart physical/digital sub-charts; the Canadian Hot 100 itself began 2007-03-31.
        from_date=dt.date(2007, 3, 31), require_header=r"^No\.$",
        known_gaps={}, date_basis="issue date (Saturday)"),
}

# ------------------------------------------------------------------ HTTP (1 rps)
_last = [0.0]


def http_json(params):
    url = API + "?" + "&".join(f"{k}={quote(str(v), safe='|')}" for k, v in params.items())
    err = None
    for attempt in range(6):
        wait = 1.05 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            with urlopen(Request(url, headers=UA), timeout=45) as r:
                d = json.load(r)
            if "error" in d and d["error"].get("code") not in ("missingtitle",):
                raise RuntimeError(str(d["error"])[:120])
            return d
        except HTTPError as e:
            err = e
            if e.code == 429 or e.code >= 500:
                ra = e.headers.get("Retry-After")
                time.sleep(float(ra) if ra and ra.isdigit() else 3 * 2 ** attempt)
                continue
            raise
        except Exception as e:  # noqa: BLE001  (network hiccup / API error: back off, retry)
            err = e
            time.sleep(3 * 2 ** attempt)
    raise RuntimeError(f"API failed after retries: {err}")


def titles_exist(titles):
    """-> {requested title: final title or None}. redirects resolved. <=50 per call."""
    out = {}
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        d = http_json({"action": "query", "format": "json", "formatversion": 2, "redirects": 1, "titles": "|".join(chunk)})["query"]
        norm = {n["from"]: n["to"] for n in d.get("normalized", [])}
        redir = {r["from"]: r["to"] for r in d.get("redirects", [])}
        pages = {p["title"]: p for p in d["pages"]}
        for t in chunk:
            t2 = norm.get(t, t)
            fin = redir.get(t2, t2)
            p = pages.get(fin)
            out[t] = fin if p and not p.get("missing") and not p.get("invalid") else None
    return out


_html = {}


def fetch_html(title):
    """Page HTML via the parse API. LANES_CACHE=<dir> (dev only) caches responses on disk."""
    import hashlib
    import os
    cdir = os.environ.get("LANES_CACHE")
    cf = Path(cdir) / (hashlib.md5(title.encode()).hexdigest() + ".html") if cdir else None
    if title not in _html and cf and cf.exists():
        _html[title] = cf.read_text()
    if title not in _html:
        d = http_json({"action": "parse", "page": title.replace(" ", "_"), "prop": "text", "format": "json", "formatversion": 2, "redirects": 1})
        if "parse" not in d:
            raise RuntimeError(f"no parse result for {title}")
        _html[title] = d["parse"]["text"]
        if cf:
            cf.parent.mkdir(parents=True, exist_ok=True)
            cf.write_text(_html[title])
    return _html[title]


# ------------------------------------------------------------ HTML table parser
class TableParser(HTMLParser):
    VOID = {"img", "br", "hr", "wbr", "meta", "link", "input"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.estack, self.tstack = [], [], []
        self.skip, self.row, self.cell = 0, None, None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if tag == "br":
            if self.cell is not None and not self.skip:
                self.cell["t"] += " "
            return
        if tag in self.VOID:
            return
        sk = (tag in ("sup", "style", "script") or "reference" in cls or "mw-editsection" in cls or "noprint" in cls
              or "display:none" in (a.get("style") or "").replace(" ", ""))
        self.estack.append((tag, sk))
        if sk:
            self.skip += 1
        if tag == "table":
            if "wikitable" in cls:
                self.tables.append({"rows": []})
                self.tstack.append(self.tables[-1])
            else:
                self.tstack.append(None)
        elif tag == "tr" and self.tstack and self.tstack[-1] is not None:
            self.row = []
            self.tstack[-1]["rows"].append(self.row)
        elif tag in ("td", "th") and self.tstack and self.tstack[-1] is not None and self.row is not None:
            num = lambda k: int(re.sub(r"\D", "", a.get(k, "1")) or 1)  # noqa: E731
            self.cell = {"t": "", "h": tag == "th", "rs": num("rowspan"), "cs": num("colspan"), "links": []}
            self.row.append(self.cell)
        elif tag == "a" and self.cell is not None and not self.skip:
            h = a.get("href", "")
            if h.startswith("/wiki/") and ":" not in h[6:] and "redlink" not in h:
                self.cell["links"].append(unquote(h[6:].split("#")[0]).replace("_", " "))

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if tag in ("td", "th") and self.tstack and self.tstack[-1] is not None:
            self.cell = None
        if tag == "table" and self.tstack:
            self.tstack.pop()
            self.cell = None
            self.row = None
        while self.estack:
            t, sk = self.estack.pop()
            if sk:
                self.skip -= 1
            if t == tag:
                break

    def handle_data(self, d):
        if self.cell is not None and not self.skip:
            self.cell["t"] += d


def grid(table):
    """Expand rowspan/colspan into rectangular rows of cell dicts."""
    out, carry = [], {}
    for r in table["rows"]:
        row, col, i = [], 0, 0
        while i < len(r) or col in carry:
            if col in carry:
                c, left = carry[col]
                row.append(c)
                if left > 1:
                    carry[col] = (c, left - 1)
                else:
                    del carry[col]
                col += 1
                continue
            c = r[i]
            i += 1
            for _ in range(c["cs"]):
                row.append(c)
                if c["rs"] > 1:
                    carry[col] = (c, c["rs"] - 1)
                col += 1
        out.append(row)
    return out


def txt(c):
    return re.sub(r"\s+", " ", c["t"].replace("\xa0", " ")).strip()


# --------------------------------------------------------------- cell cleaning
MARKS = "†‡*↑↓§#^‖¶"


def clean_song(s):
    s = re.sub(r'["“”]\s*/\s*["“”]', " / ", s)
    s = s.replace("“", "").replace("”", "").replace('"', "")
    s = re.sub("[" + re.escape(MARKS) + "]+", "", s)
    return re.sub(r"\s+", " ", s).strip(" \"'")


def clean_artist(s):
    s = re.sub("[" + re.escape(MARKS) + "]+", "", s)
    return re.sub(r"\s+", " ", s).strip()


BAD = re.compile(r"\[[^\]]*\]|\[\[|\]\]|\{\{|\}\}|'''|<\/?[a-zA-Z]|&[a-z]+;|&#\d+;")

MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
D1 = re.compile(r"\b([A-Z][a-z]{2,8})\.?\s+(\d{1,2})(?:\s*,\s*(\d{4}))?\b")
D2 = re.compile(r"\b(\d{1,2})\s+([A-Z][a-z]{2,8})\.?(?:\s+(\d{4}))?\b")


def month_num(tok):
    """'March', 'Sept', 'Sep' -> 3, 9, 9. Prefix of a full month name, >= 3 letters, else None."""
    for i, m in enumerate(MONTH_NAMES, 1):
        if len(tok) >= 3 and m.startswith(tok):
            return i
    return None


def parse_date(s, year_ctx):
    for rx, order in ((D1, "md"), (D2, "dm")):
        for m in rx.finditer(s):
            mo, d = (month_num(m.group(1)), int(m.group(2))) if order == "md" else (month_num(m.group(2)), int(m.group(1)))
            if not mo:
                continue
            y = m.group(3)
            yr = int(y) if y else year_ctx
            if yr is None:
                continue
            try:
                return dt.date(yr, mo, d), bool(y)
            except ValueError:
                continue
    return None, False


# ----------------------------------------------------------- table -> rows
def header_labels(g, ndata_start):
    """per column: list of distinct header texts (top to bottom)."""
    ncol = max(len(r) for r in g)
    labels = [[] for _ in range(ncol)]
    for r in g[:ndata_start]:
        for ci, c in enumerate(r):
            t = txt(c)
            if t and (not labels[ci] or labels[ci][-1] != t):
                labels[ci].append(t)
    return labels


def find_cols(labels, charts):
    """-> (date_col, song_col, artist_col, weeks_col) or None"""
    date_col = next((i for i, l in enumerate(labels) if l and re.search(r"issue date|reached number one|week (starting|ending)|^date$", l[0], re.I)
                     and not re.search(r"releas|certif", " ".join(l), re.I)), None)
    if date_col is None:
        return None
    weeks_col = next((i for i, l in enumerate(labels) if l and re.search(r"^weeks?$|weeks? (at|on)\b", " ".join(l), re.I)), None)
    song_col = artist_col = None
    songish = re.compile(r"^(songs?|singles?|titles?(\(s\))?|tracks?)$", re.I)
    for rx in charts:
        cols = [i for i, l in enumerate(labels) if any(re.search(rx, t, re.I) for t in l)]
        if not cols:
            continue
        sc = next((i for i in cols if any(songish.match(t) for t in labels[i])), cols[0])
        ac = next((i for i in range(sc + 1, min(sc + 4, len(labels))) if any(re.search(r"artist|performer", t, re.I) for t in labels[i])), None)
        if ac is not None:
            return date_col, sc, ac, weeks_col
    sc = next((i for i, l in enumerate(labels) if any(songish.match(t) for t in l)), None)
    ac = next((i for i, l in enumerate(labels) if any(re.search(r"^artist|^performer", t, re.I) for t in l)), None)
    if sc is None or ac is None:
        return None
    return date_col, sc, ac, weeks_col


def rows_from_table(tb, charts, year_ctx, require=None):
    g = grid(tb)
    if len(g) < 2:
        return []
    # header rows = rows before the first row whose first date-ish cell parses
    first = None
    for ri, r in enumerate(g):
        if ri == 0:
            continue
        if any(parse_date(txt(c), year_ctx)[0] for c in r) and not all(c["h"] for c in r):
            first = ri
            break
    if first is None or first > 4:
        return []
    labels = header_labels(g, first)
    if require and not any(re.search(require, t) for l in labels for t in l):
        return []
    cols = find_cols(labels, charts)
    if not cols:
        return []
    dc, sc, ac, wc = cols
    out = []
    for r in g[first:]:
        if len(r) <= max(dc, sc, ac):
            continue
        d, _ = parse_date(txt(r[dc]), year_ctx)
        if not d:
            continue
        song_cell, art_cell = r[sc], r[ac]
        weeks = 1
        if wc is not None and wc < len(r):
            m = re.match(r"\d+", txt(r[wc]))
            weeks = int(m.group()) if m else 1
        out.append({"date": d, "song": clean_song(txt(song_cell)), "artist": clean_artist(txt(art_cell)),
                    "page": song_cell["links"][0] if song_cell["links"] else "", "weeks": weeks, "run": wc is not None})
    return out


def parse_page(html, charts, year_ctx, require=None):
    p = TableParser()
    p.feed(html)
    out, seen = [], set()
    for tb in p.tables:
        for r in rows_from_table(tb, charts, year_ctx, require):
            k = (r["date"], r["run"])
            if k in seen:
                continue
            seen.add(k)
            out.append(r)
    return out


def fix_year_rollover(rows, year):
    """Per-year pages omit the year; a late-December issue listed first belongs to year-1? No:
    Billboard's first issue of a year can be dated Dec 29 of the prior year ... only the
    FIRST rows can be affected, so shift leading December rows when January follows."""
    i = 0
    while i < len(rows) and rows[i]["date"].month == 12 and any(r["date"].month == 1 for r in rows[i:]):
        rows[i]["date"] = rows[i]["date"].replace(year=year - 1)
        i += 1
    return rows


def expand_runs(rows):
    """rows with run=True carry start date + weeks; emit weekly rows, truncated at the next run."""
    rows = sorted(rows, key=lambda r: r["date"])
    out = []
    for i, r in enumerate(rows):
        nxt = rows[i + 1]["date"] if i + 1 < len(rows) else None
        for k in range(max(r["weeks"], 1)):
            d = r["date"] + dt.timedelta(days=7 * k)
            if nxt is not None and d >= nxt:
                break
            out.append({**r, "date": d})
    return out


def finalize(rows):
    """weekly + run rows -> sorted, one row per date (first wins), plain dicts."""
    wk = [r for r in rows if not r["run"]]
    ru = expand_runs([r for r in rows if r["run"]])
    best = {}
    for r in wk + ru:
        best.setdefault(r["date"], r)
    return [{"date": d.isoformat(), "song": r["song"], "artist": r["artist"], "page": r["page"]} for d, r in sorted(best.items())]


# ------------------------------------------------------------- lane building
def discover_peryear(cfg, years, log):
    """years -> {year: final title or None} using candidate patterns, 1 batched API call per 50."""
    cands = [(y, p.format(y=y)) for y in years for p in cfg["patterns"]]
    res = titles_exist([t for _, t in cands])
    chosen = {}
    for y in years:
        hits = [(res[p.format(y=y)]) for p in cfg["patterns"] if res.get(p.format(y=y))]
        yr_hits = [h for h in hits if str(y) in h]
        chosen[y] = (yr_hits or hits or [None])[0]
        if chosen[y] is None:
            log(f"  no page for {y} (tried {len(cfg['patterns'])} titles)")
    return chosen


def collect(lane, cfg, log):
    """-> (rows list of dicts incl. run flag, sources {title}, missing_years list, year coverage info)"""
    rows, sources, missing = [], [], []
    if cfg["kind"] == "peryear":
        years = list(range(cfg["from_year"], TODAY.year + 1))
        chosen = discover_peryear(cfg, years, log)
        for y in years:
            t = chosen[y]
            if not t:
                missing.append(y)
                continue
            if "decade" in t or re.search(r"\d{4}s", t):
                log(f"  {y}: {t} (decade page)")
            try:
                part = parse_page(fetch_html(t), cfg["charts"], y, cfg.get("require_header"))
            except Exception as e:  # noqa: BLE001
                log(f"  {y}: fetch/parse error {e}")
                missing.append(y)
                continue
            part = [r for r in part if r["date"].year in (y, y - 1, y + 1)]
            part = fix_year_rollover(part, y)
            rows += part
            if t not in sources:
                sources.append(t)
            log(f"  {y}: {len(part)} rows  <- {t}")
    else:
        titles = titles_exist([p[0] for p in cfg["pages"]])
        for t, y0, y1 in cfg["pages"]:
            fin = titles[t]
            if not fin:
                log(f"  page missing: {t}")
                missing += list(range(max(y0, cfg["from_year"]), min(y1, TODAY.year) + 1))
                continue
            part = parse_page(fetch_html(fin), cfg["charts"], None)
            part = [r for r in part if y0 <= r["date"].year <= y1 or r["run"]]  # runs may start in the prior decade
            rows += part
            sources.append(fin)
            log(f"  {fin}: {len(part)} rows (before run expansion)")
        ex = cfg.get("extra_peryear")
        if ex:
            years = list(range(ex["from_year"], TODAY.year + 1))
            chosen = discover_peryear(ex, years, log)
            for y in years:
                if not chosen[y]:
                    missing.append(y)
                    continue
                part = fix_year_rollover(parse_page(fetch_html(chosen[y]), cfg["charts"], y), y)
                rows += part
                if chosen[y] not in sources:
                    sources.append(chosen[y])
                log(f"  {y}: {len(part)} rows  <- {chosen[y]}")
    return rows, sources, missing


def canaries(lane, cfg, weeks, missing, log):
    """-> list of failure reasons (empty = pass), and notes (non-fatal)."""
    fails, notes = [], []
    if not weeks:
        return ["no rows parsed"], notes
    dates = [dt.date.fromisoformat(w["date"]) for w in weeks]
    kg = cfg.get("known_gaps", {})
    first_y, last_y = dates[0].year, dates[-1].year
    # 1. zero-row years
    by_year = {}
    for d in dates:
        by_year[d.year] = by_year.get(d.year, 0) + 1
    zero = [y for y in range(max(cfg["from_year"], first_y), last_y + 1) if by_year.get(y, 0) == 0]
    zero += [y for y in missing if y not in zero and y >= cfg["from_year"]]
    bad_zero = sorted(y for y in set(zero) if y not in kg)
    for y in sorted(set(zero)):
        if y in kg:
            notes.append(f"{y}: no chart ({kg[y]})")
    if bad_zero:
        fails.append(f"year(s) with zero rows: {bad_zero}")
    # 2. cadence
    gaps = [(a, b, (b - a).days) for a, b in zip(dates, dates[1:])]
    irregular = [g for g in gaps if g[2] != 7]
    # documented suspension gaps are not counted as cadence breaks
    irregular = [g for g in irregular if not (kg and any(g[0].year <= y <= g[1].year for y in kg) and g[2] > 14)]
    pct = 100 * len(irregular) / max(len(gaps), 1)
    if pct > 2.0:
        fails.append(f"cadence: {len(irregular)}/{len(gaps)} gaps != 7d ({pct:.1f}%) e.g. " + ", ".join(f"{a}->{b}={n}d" for a, b, n in irregular[:3]))
    elif irregular:
        notes.append(f"{len(irregular)} of {len(gaps)} gaps != 7d ({pct:.2f}%): " + ", ".join(f"{a}->{b}={n}d" for a, b, n in irregular[:4]))
    # 3. markup / empty
    bad = []
    for w in weeks:
        for k in ("song", "artist"):
            v = w[k]
            if not v or BAD.search(v):
                bad.append(f"{w['date']} {k}={v!r}")
    if bad:
        fails.append(f"{len(bad)} empty/markup cells e.g. " + "; ".join(bad[:3]))
    # 4. fewer than 40 weeks in a full year
    thin = [y for y in range(first_y + 1, last_y) if y not in kg and by_year.get(y, 0) < 40]
    if thin:
        fails.append("fewer than 40 weeks in full year(s): " + ", ".join(f"{y}={by_year.get(y, 0)}" for y in thin))
    return fails, notes


def rap_crosscheck(weeks, cfg, log):
    """Independent second source: 'Rap Songs' column of the per-year R&B/Hip-Hop pages 2013-2019."""
    cc = cfg["crosscheck_peryear"]
    years = list(range(cc["from_year"], cc["to_year"] + 1))
    chosen = discover_peryear(cc, years, log)
    mine = {w["date"]: w for w in weeks}
    n = diff = 0
    ex = []
    norm = lambda s: re.sub(r"[^a-z0-9]", "", re.sub(r"\([^)]*\)", "", s.lower()))  # noqa: E731  ('Bodak Yellow (Money Moves)' == 'Bodak Yellow')
    for y in years:
        if not chosen[y]:
            continue
        for r in parse_page(fetch_html(chosen[y]), cfg["charts"], y):
            m = mine.get(r["date"].isoformat())
            if not m:
                continue
            n += 1
            if norm(m["song"]) != norm(r["song"]):
                diff += 1
                if len(ex) < 3:
                    ex.append(f"{r['date']} decade-page={m['song']!r} per-year={r['song']!r}")
    return n, diff, ex


def build_lane(lane, cfg, log):
    rows, sources, missing = collect(lane, cfg, log)
    if cfg.get("from_date"):
        rows = [r for r in rows if r["date"] >= cfg["from_date"]]
    weeks = finalize(rows)
    fails, notes = canaries(lane, cfg, weeks, missing, log)
    if lane == "rap" and weeks:
        n, diff, ex = rap_crosscheck([w for w in weeks if w["date"] < "2020"], cfg, log)
        if n:
            pct = 100 * diff / n
            notes.append(f"cross-check vs R&B/Hip-Hop pages' Rap Songs column 2013-2019: {n - diff}/{n} weeks agree ({pct:.1f}% differ)" + (" e.g. " + "; ".join(ex) if ex else ""))
            if pct > 10:
                fails.append(f"cross-check disagreement {pct:.1f}% of {n} weeks")
    doc = None
    if not fails:
        doc = {"lane": lane, "label": cfg["label"], "source": cfg["series"], "license": LICENSE, "built": TODAY.isoformat(),
               "from": weeks[0]["date"], "through": weeks[-1]["date"], "date_basis": cfg["date_basis"],
               "pages": sources, "weeks": weeks}
        if cfg.get("known_gaps"):
            doc["known_gaps"] = {str(k): v for k, v in cfg["known_gaps"].items()}
    return doc, weeks, fails, notes


# ------------------------------------------------------------------ spot checks
def nearest(weeks, target):
    t = dt.date.fromisoformat(target)
    return min(weeks, key=lambda w: abs((dt.date.fromisoformat(w["date"]) - t).days))


def hot100_week(date):
    y = date[:4]
    f = HOT100_DIR / f"{y}.json"
    if not f.exists():
        return None
    d = json.loads(f.read_text())
    t = dt.date.fromisoformat(date)
    return min(d["weeks"], key=lambda w: abs((dt.date.fromisoformat(w["date"]) - t).days))


def song_article_claims_no1(page, date):
    """Independent check: the song's OWN Wikipedia article (a different page, written separately from the list)
    should say it was #1 around this date. Returns the best sentence, '' if none found, None if unavailable."""
    if not page:
        return None
    try:
        d = http_json({"action": "query", "format": "json", "formatversion": 2, "prop": "extracts", "explaintext": 1, "redirects": 1, "titles": page})
        text = d["query"]["pages"][0].get("extract", "")
    except Exception:  # noqa: BLE001
        return None
    dd = dt.date.fromisoformat(date)
    month = MONTH_NAMES[dd.month - 1]
    forms = [f"{month} {dd.day}, {dd.year}", f"{dd.day} {month} {dd.year}", f"{month} {dd.day}"]
    sents = [x.strip() for x in re.split(r"(?<=[.!?])\s+|\n", text) if re.search(r"number[- ]one|number 1|No\. ?1|top spot|topped", x, re.I)]
    dated = [x for x in sents if any(f in x for f in forms)]
    pick = (dated or sents or [""])[0]
    return ("[dated match] " if dated else "[no date match] " if pick else "") + pick[:260] if pick else ""


def spot_checks(results):
    print("\nSPOT CHECKS (nearest chart week to target)")
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())  # noqa: E731
    plan = [("rnb_hiphop", "2012-04-28"), ("rap", "2012-04-28"), ("country", "2012-05-12"), ("uk", "2012-05-12"), ("canada", "2012-05-12")]
    for lane, target in plan:
        weeks = results.get(lane)
        if not weeks:
            print(f"  {lane:11s} target {target}: lane not built")
            continue
        w = nearest(weeks, target)
        line = f"  {lane:11s} target {target}: {w['date']}  {w['song']} - {w['artist']}  [page: {w['page'] or '-'}]"
        h = hot100_week(w["date"])
        if h:
            top = h.get("top", [])
            hit = next((t for t in top if norm(t["song"]) == norm(w["song"])), None)
            n1 = top[0] if top else None
            line += f"\n      Hot 100 {h['date']}: #1 {n1['song']} - {n1['artist']}" if n1 else ""
            if hit:
                line += f"\n      independent check: AGREES, same song is Hot 100 #{hit['rank']} that week"
            elif lane in ("canada",) and n1:
                line += f"\n      independent check: {'AGREES (same #1)' if norm(n1['song']) == norm(w['song']) else 'DIFFERS from Hot 100 #1 (Canada and US charts legitimately differ)'}"
            else:
                line += "\n      independent check: song not in that week's Hot 100 top 10 (genre #1 may sit below the top 10)"
        print(line)
        claim = song_article_claims_no1(w["page"], w["date"])
        if claim:
            print(f"      song article says: {claim}")
        elif claim == "":
            print("      song article lead has no #1 claim (inconclusive)")


# ------------------------------------------------------------------------- main
def main():
    t0 = time.time()
    want = sys.argv[1:] or list(LANES)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summary, results, passed, dropped = [], {}, [], []
    for lane in want:
        cfg = LANES[lane]
        print(f"\n== {lane} ({cfg['label']})", flush=True)
        try:
            doc, weeks, fails, notes = build_lane(lane, cfg, lambda m: print(m, flush=True))
        except Exception as e:  # noqa: BLE001  (one lane blowing up must not stop the others)
            doc, weeks, fails, notes = None, [], [f"exception: {e}"], []
        for n in notes:
            print(f"  note: {n}")
        if fails:
            for f in fails:
                print(f"  REFUSED: {f}")
            summary.append((lane, "FAIL", len(weeks), weeks[0]["date"] if weeks else "-", weeks[-1]["date"] if weeks else "-", "; ".join(fails)[:160]))
            dropped.append(lane)
            stale = OUT_DIR / f"{lane}.json"
            if stale.exists():
                print(f"  note: leaving existing {stale.name} untouched")
            continue
        (OUT_DIR / f"{lane}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
        results[lane] = weeks
        passed.append({"lane": lane, "label": cfg["label"], "from": doc["from"], "through": doc["through"], "weeks": len(weeks), "file": f"{lane}.json"})
        summary.append((lane, "PASS", len(weeks), doc["from"], doc["through"], "; ".join(notes)[:160]))
    if len(want) == len(LANES) or passed:
        idx = OUT_DIR / "index.json"
        prev = {}
        if idx.exists() and len(want) != len(LANES):  # partial run: merge with earlier passes
            try:
                prev = {l["lane"]: l for l in json.loads(idx.read_text())["lanes"]}
            except Exception:  # noqa: BLE001
                prev = {}
        for p in passed:
            prev[p["lane"]] = p
        if len(want) == len(LANES):
            prev = {p["lane"]: p for p in passed}
        idx.write_text(json.dumps({"license": LICENSE, "built": TODAY.isoformat(), "lanes": list(prev.values())}, ensure_ascii=False, indent=1))
    print("\nSUMMARY")
    print(f"{'lane':11s} {'result':6s} {'weeks':>6s} {'from':10s} {'through':10s} reason / notes")
    for s in summary:
        print(f"{s[0]:11s} {s[1]:6s} {s[2]:6d} {s[3]:10s} {s[4]:10s} {s[5]}")
    if results:
        spot_checks(results)
    print(f"\nruntime {time.time() - t0:.0f}s; dropped lanes: {dropped or 'none'}")
    return 1 if dropped else 0


if __name__ == "__main__":
    sys.exit(main())
