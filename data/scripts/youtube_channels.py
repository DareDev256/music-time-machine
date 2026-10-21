#!/usr/bin/env python3
"""YouTube "back then": archive upload histories of channels that broke songs, by month.

YOUTUBE API DEVELOPER POLICY (stored data): API data may be stored for at most 30 days
unless it is refreshed. This script therefore (a) stamps every video's statistics with
`statsAt`, (b) auto-refreshes (videos.list, 1 unit / 50 ids) when the oldest stats are
older than 6 days or when run with --refresh, and (c) REFUSES to keep data older than
30 days: any video whose stats could not be refreshed within 30 days is deleted from the
store, month files that no longer have data are deleted, raw cache files older than 30
days are deleted. A failed refresh never leaves stale API data behind.

Quota: 10,000 units/day project-wide; this script spends at most --budget (default 4000)
per local day, tracked in data/cache/youtube/ledger.json. Costs: channels.list 1,
playlistItems.list 1 / page of 50, videos.list 1 / 50 ids. search.list is NEVER called.
The API key is read from ~/.secrets/wasplaying-youtube-key, sent in a header (never in a
URL), and never printed or written anywhere.

Usage: youtube_channels.py [--refresh] [--budget N] [--chunk PAGES] [--build-only]
"""
import argparse, datetime as dt, glob, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHANNELS = os.path.join(ROOT, "data/youtube/channels.json")
CACHE = os.path.join(ROOT, "data/cache/youtube")
OUT = os.path.join(ROOT, "public/era/youtube")
KEYFILE = os.path.expanduser("~/.secrets/wasplaying-youtube-key")
API = "https://www.googleapis.com/youtube/v3/"
MAX_AGE_DAYS = 30
REFRESH_AT_DAYS = 6  # weekly, before any backfill: health turns red at 14 days, the policy cut-off is 30
TOP_N = 15
TODAY = dt.date.today()


class BudgetStop(Exception):
    pass


# ---------------------------------------------------------------- key + ledger + api
_KEY = None


def key():
    global _KEY
    if _KEY is None:
        with open(KEYFILE) as f:
            _KEY = f.read().strip()
    return _KEY


def jload(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def jsave(path, obj, indent=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
    os.replace(tmp, path)


LEDGER_PATH = os.path.join(CACHE, "ledger.json")
BUDGET = 4000


def ledger():
    return jload(LEDGER_PATH, {})


def spent_today():
    return ledger().get(str(TODAY), 0)


def charge(n, ch=None):
    l = ledger()
    l[str(TODAY)] = l.get(str(TODAY), 0) + n
    l.setdefault("_byChannel", {})
    if ch:
        l["_byChannel"][ch] = l["_byChannel"].get(ch, 0) + n
    jsave(LEDGER_PATH, l, 1)


def api(resource, params, units, ch=None):
    """One API call. Checks budget first; key travels in a header only."""
    if spent_today() + units > BUDGET:
        raise BudgetStop()
    url = API + resource + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(3):
        req = urllib.request.Request(url, headers={"x-goog-api-key": key(), "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            charge(units, ch)
            return data
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf8", "replace")
            try:
                msg = json.loads(body)["error"]["message"]
            except Exception:
                msg = body[:200]
            charge(units, ch)
            last = "HTTP %s %s" % (e.code, msg)
            if e.code < 500:
                break
        except Exception as e:  # network
            last = "network error %s" % type(e).__name__
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(last)


# ---------------------------------------------------------------- helpers
def slug(handle):
    return re.sub(r"[^a-z0-9]+", "", handle.lower())


def cdir(handle):
    return os.path.join(CACHE, slug(handle))


def iso_dur(s):
    m = re.match(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s or "")
    if not m:
        return 0
    d, h, mi, se = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + se


def vrec(v, now):
    sn, st, cd = v.get("snippet", {}), v.get("statistics", {}), v.get("contentDetails", {})
    return {"t": sn.get("title", ""), "p": sn.get("publishedAt", ""), "v": int(st.get("viewCount", 0) or 0),
            "d": iso_dur(cd.get("duration")), "l": sn.get("liveBroadcastContent", "none") != "none",
            "s": str(now)}


def save_raw(handle, kind, name, data):
    jsave(os.path.join(cdir(handle), kind, name), data)


# ---------------------------------------------------------------- channels
def resolve_handle(handle):
    """channels.list?forHandle= ; returns channel item or None (only on a genuine empty result)."""
    p = os.path.join(CACHE, "channels", slug(handle) + ".json")
    c = jload(p)
    if c and c.get("item") and (TODAY - dt.date.fromisoformat(c["fetched"])).days < REFRESH_AT_DAYS:
        return c["item"]
    d = api("channels", {"part": "contentDetails,snippet,statistics", "forHandle": handle}, 1)
    items = d.get("items") or []
    if not items:
        return None
    jsave(p, {"fetched": str(TODAY), "item": items[0]})
    return items[0]


# ---------------------------------------------------------------- title parsing
EMOJI = re.compile("[\U0001F000-\U0001FAFF←-⇿⌀-⏿☀-➿⬀-⯿️‍\U0001F1E6-\U0001F1FF]+")
GROUP = re.compile(r"[\(\[\{（【]([^\)\]\}）】]*)[\)\]\}）】]")
NOISE = re.compile(r"official|video|\bmv\b|\bm/v\b|audio|lyric|visuali[sz]er|prod\b|prod\.|produced|\bdir\b|dir\.|directed|"
                   r"shot by|filmed|\bhd\b|4k|1080|explicit|uncensored|\bclean\b|exclusive|premiere|wshh|worldstar|"
                   r"out now|new music|teaser|full version|free download|download|nsfw|music$|^music|\bhq\b|"
                   r"remix contest|available|stream|dvd|edited by|ft\. shot|\brelease\b", re.I)
KEEP = re.compile(r"\bfeat\b|\bft\b|featuring|remix|\bmix\b|\bedit\b|\bvip\b|bootleg|acoustic|version|\bcover\b|\bflip\b", re.I)
TAIL = re.compile(r"\s+(?:shot by|filmed by|dir(?:ected)? by|prod\.?|produced by|prod by|video by)\b.*$", re.I)
SEP = re.compile(r"\s[-–—―~_]\s|\s[-–—]|[-–—]\s")
SKIP = re.compile(r"interview|\bvlog|podcast|reaction|reacts? to|trailer|behind the scenes|making of|the making|"
                  r"live ?stream|24/7|\bepisode\b|\bep\.? ?\d|#shorts?|compilation|playlist|\bmix 20\d\d|"
                  r"best of|top \d+|\bhour\b|unboxing|freestyle session|cypher|news|recap|highlight medley|"
                  r"album preview|spoiler|concept (?:film|photo|trailer)|comeback|\bq&a\b|fight|knocked out|"
                  r"\bvs\.? |workout|tutorial|how to|giveaway|announcement|documentary|full album|mixtape stream|"
                  # Measured on the 2026-10-20 crawl: talk, promo and show uploads on label and media channels.
                  r"\btalks?\b|speaks|breaks down|\breads\b|man on the street|drink off|diary|greetings|fan ?club|"
                  r"recruitment|first look|\bpromo\b|tour dates|\blaunch\b|pre-party|commercial|contest|after show|"
                  r"practice|trainee|competition|choosing|out now @|re-?cap|takeover|headline show|\bepk\b|crossfade|"
                  r"\bawards\b|party mix|video mix|making the music video|their own lyrics|remember (?:his|her|their) lyrics|"
                  r"\bseason \d|premiere!|track (?:by|x) track|a closer look", re.I)
# Channel branding inside a title: "| Link Up TV", ": SBTV", "SB.TV - Artist - Song".
BRAND = re.compile(r"^(?:sb\.?tv|grm daily|link up tv|mixtape madness|mm talks|westwood(?: tv)?|worldstar(?:hiphop)?|wshh|hnhh|"
                   r"colors|link up tv originals)$", re.I)
BRANDISH = re.compile(r"\bsb\.?tv\b|link up tv|grm daily|mixtape madness|mm talks|\boriginals\b|^@|\s@\w+|westwood|"
                      r"worldstar|wshh|hnhh|\bcolors\b|shot by|filmed by|dir(?:ected)? by|prod(?:uced)? by", re.I)
MUSICY = re.compile(r"official|music video|\bmv\b|audio|lyric|visuali[sz]er|prod\.?|\bft\.?\b|feat|shot by|\(.*video.*\)", re.I)
# Double quotes pair with double quotes; a single quote only closes before a space or the end ("Don't" is a word).
QUOTED = re.compile(r"^(.+?)\s+[\"“]([^\"”]+)[\"”]|^(.+?)\s+['‘](.+?)['’](?=\s|$)")


def clean(title):
    t = EMOJI.sub("", title)
    # "Artist | Song [Music Video]: SBTV" puts the song after the pipe; "Artist - Song | Link Up TV" puts the
    # channel there. Branding segments go; two plain segments are artist and song.
    t = re.sub(r"\s*:\s*(?:sb\.?tv|grm daily|link up tv)\s*$", "", t, flags=re.I)
    segs = [x.strip() for x in re.split(r"\s[|｜]\s", t) if x.strip()]
    keep = [x for i, x in enumerate(segs) if i == 0 or not BRANDISH.search(x)]
    if not keep:
        return ""
    t = keep[0] if (len(keep) < 2 or SEP.search(keep[0])) else "%s - %s" % (keep[0], keep[1])
    t = re.sub(r"\s*:\s*(?:sb\.?tv|grm daily|link up tv)\s*$", "", t, flags=re.I)
    t = re.sub(r"https?://\S+", "", t)

    def grp(m):
        inner = m.group(1)
        if not re.search(r"[A-Za-z]", inner):
            return " "
        if KEEP.search(inner) and not re.search(r"official|video|audio|lyric", inner, re.I):
            return m.group(0)
        if NOISE.search(inner):
            return " "
        return m.group(0)
    t = GROUP.sub(grp, t)
    t = re.sub(r"(?:^|\s)#\w+", " ", t)
    t = TAIL.sub("", t)
    t = re.sub(r"\s@\w+.*$", "", t)
    t = re.sub(r"\s[-–—]\s*(?:official\b.*|lyrics?\b.*|audio|music video|video|visuali[sz]er)\s*$", "", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip(" -–—|~_:.,")
    # Monstercat's genre tag up front ("[DnB] - Feint - Time Bomb") and a bare "Official Music Video" at the end.
    t = re.sub(r"^\[[^\]]{1,24}\]\s*[-–—]?\s*", "", t)
    t = re.sub(r"\s+(?:official\s+)?(?:music\s+video|video|audio|lyric\s+video|visuali[sz]er)\s*$", "", t, flags=re.I).strip(" -–—|~_:.,")
    return t


HANGUL = re.compile(r"[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]+")


def tidy(artist, song, label):
    """Display clean-up after parsing: wrapping quotes, the channel's own name trailing a title, a Hangul
    duplicate of a romanised artist name ("EXO-K 엑소케이")."""
    song = re.sub(r"\s+" + re.escape(label) + r"\s*$", "", song, flags=re.I).strip()
    q = re.match(r'^["“‘]([^"”’]+)["”’]\s*(.*)$', song)  # '"Just Like You" (Extended Version)'
    if q:
        song = ("%s %s" % (q.group(1), q.group(2))).strip()
    if re.search(r"[A-Za-z]", artist) and HANGUL.search(artist):
        artist = re.sub(r"\s+", " ", re.sub(r"\(\s*\)", "", HANGUL.sub("", artist))).strip()  # keeps "(MB)"
        # "NCT 127 엔시티 127" → "NCT 127": only the romanised copy repeats, so only here (Duran Duran stays whole).
        artist = re.sub(r"\b(\w+)(?: \1\b)+", r"\1", artist)
    return artist, song


def split_sep(t):
    m = SEP.search(t)
    if m and 0 < m.start() and m.end() < len(t):
        a, s = t[:m.start()].strip(), t[m.end():].strip()
        if a and s:
            return a, s
    return None


def parse_title(raw):
    """Returns (artist, song, parsed)."""
    t = clean(raw)
    hit = split_sep(t)
    if hit:
        a, s = hit
        # "SB.TV - Flexplicit ft. Royce - My Game": the channel's name is not the artist.
        if BRAND.match(a) and split_sep(s):
            a, s = split_sep(s)
        # "I Don't Like f. Lil Reese": the feature is a credit, not part of the title.
        f = re.search(r"\s+(?:f\.|f/|ft\.?|feat\.?|featuring)\s+(.+)$", s, re.I)
        if f and f.start() > 0:
            a, s = "%s feat. %s" % (a, f.group(1).strip()), s[:f.start()].strip()
        return a, s, True
    q = QUOTED.match(t)
    if q:
        a, s = (q.group(1), q.group(2)) if q.group(1) else (q.group(3), q.group(4))
        # CMT: 'Thomas Rhett ft. Trombone Shorty Perform "Don't Threaten Me with a Good Time"'.
        return re.sub(r"\s+perform(?:s|ing)?$", "", a.strip(), flags=re.I), s.strip(), True
    # "Panic! At The Disco: I Write Sins Not Tragedies [OFFICIAL VIDEO]" (Fueled By Ramen's house format), only
    # when the upload says it is music: "XXL Presents: Prodigy's Pre-Prison Diary" is not.
    if ": " in t and MUSICY.search(raw):
        a, s = t.split(": ", 1)
        if a.strip() and s.strip():
            return a.strip(), s.strip(), True
    return "", t, False


def is_music(raw, dur, live, parsed, strict=False):
    if live or dur < 60 or SKIP.search(raw):
        return False
    # Label and media channels ("strict" in channels.json) post shows, talks and fan-club notices between songs:
    # there an upload counts only when it says it is music (MV, official video, audio, ft.).
    if (strict or not parsed) and not MUSICY.search(raw):
        return False
    return True


# ---------------------------------------------------------------- store
class Store:
    def __init__(self, ch):
        self.ch = ch
        self.h = ch["handle"]
        self.dir = cdir(self.h)
        self.vp = os.path.join(self.dir, "videos.json")
        self.sp = os.path.join(self.dir, "state.json")
        self.videos = jload(self.vp, {})
        self.state = jload(self.sp, {"next": None, "done": False, "pages": 0, "units": 0, "lastFull": None})
        info = resolve_handle(self.h)
        self.info = info

    def save(self):
        jsave(self.vp, self.videos)
        jsave(self.sp, self.state)

    @property
    def uploads(self):
        return self.info["contentDetails"]["relatedPlaylists"]["uploads"]

    def vids(self, ids):
        d = api("videos", {"part": "snippet,contentDetails,statistics", "id": ",".join(ids), "maxResults": 50}, 1, self.h)
        save_raw(self.h, "vids", "v_%s_%s.json" % (TODAY, ids[0]), d)
        return {i["id"]: i for i in d.get("items", [])}

    def backfill_step(self):
        """One playlist page + its video stats (2 units). Returns False when channel is complete."""
        if self.state["done"]:
            return False
        if spent_today() + 2 > BUDGET:
            raise BudgetStop()
        params = {"part": "snippet,contentDetails", "playlistId": self.uploads, "maxResults": 50}
        if self.state["next"]:
            params["pageToken"] = self.state["next"]
        d = api("playlistItems", params, 1, self.h)
        n = self.state["pages"] + 1
        save_raw(self.h, "pages", "p%05d.json" % n, d)
        ids = [i["contentDetails"]["videoId"] for i in d.get("items", []) if i.get("contentDetails", {}).get("videoId")]
        if ids:
            got = self.vids(ids)
            for i in ids:
                if i in got:
                    self.videos[i] = vrec(got[i], TODAY)
        self.state["pages"] = n
        self.state["next"] = d.get("nextPageToken")
        self.state["units"] += 2
        if not self.state["next"]:
            self.state["done"] = True
            self.state["lastFull"] = str(TODAY)
        self.save()
        return not self.state["done"]

    def new_uploads(self):
        """Fetch only uploads we have not seen, from the top of the playlist."""
        tok = None
        while True:
            if spent_today() + 2 > BUDGET:
                raise BudgetStop()
            params = {"part": "snippet,contentDetails", "playlistId": self.uploads, "maxResults": 50}
            if tok:
                params["pageToken"] = tok
            d = api("playlistItems", params, 1, self.h)
            self.state["units"] += 1
            ids = [i["contentDetails"]["videoId"] for i in d.get("items", []) if i.get("contentDetails", {}).get("videoId")]
            new = [i for i in ids if i not in self.videos]
            if new:
                got = self.vids(new)
                self.state["units"] += 1
                for i in new:
                    if i in got:
                        self.videos[i] = vrec(got[i], TODAY)
            tok = d.get("nextPageToken")
            if len(new) < len(ids) or not tok or not new:
                break
        self.save()

    def refresh_stats(self):
        ids = sorted(self.videos)
        for k in range(0, len(ids), 50):
            batch = ids[k:k + 50]
            if spent_today() + 1 > BUDGET:
                raise BudgetStop()
            got = self.vids(batch)
            self.state["units"] += 1
            for i in batch:
                if i in got:
                    self.videos[i] = vrec(got[i], TODAY)
                else:
                    del self.videos[i]  # deleted/private
            self.save()


# ---------------------------------------------------------------- build
def month_of(p):
    return p[:7]


def build(channels, report):
    os.makedirs(OUT, exist_ok=True)
    cutoff = TODAY - dt.timedelta(days=MAX_AGE_DAYS)
    months = {}
    idx_ch = []
    oldest_stat = None
    for ch in channels:
        if ch.get("publish") is False:  # fetched and refreshed, never shown (see channels.json "why")
            continue
        s = Store.__new__(Store)
        s.ch, s.h, s.dir = ch, ch["handle"], cdir(ch["handle"])
        s.videos = jload(os.path.join(s.dir, "videos.json"), {})
        s.state = jload(os.path.join(s.dir, "state.json"), None)
        info = (jload(os.path.join(CACHE, "channels", slug(ch["handle"]) + ".json"), {}) or {}).get("item")
        if not s.state or not info:
            continue
        created = info["snippet"]["publishedAt"][:10]
        vids = {i: v for i, v in s.videos.items() if dt.date.fromisoformat(v["s"]) >= cutoff and v["p"]}
        per_month = {}
        for v in vids.values():
            per_month[month_of(v["p"])] = per_month.get(month_of(v["p"]), 0) + 1
        rows, parsed_n, bad_dates = [], 0, 0
        for i, v in vids.items():
            artist, song, parsed = parse_title(v["t"])
            artist, song = tidy(artist, song, ch["label"])
            pub = v["p"][:10]
            if pub < created or pub > str(TODAY):
                bad_dates += 1
                continue
            if not is_music(v["t"], v["d"], v["l"], parsed, ch.get("strict", False)):
                continue
            if parsed:
                parsed_n += 1
            rows.append({"song": song, "artist": artist, "title": v["t"], "videoId": i, "published": pub,
                         "views": v["v"], "parsed": parsed, "_s": v["s"]})
        problems = []
        if parsed_n < 20:
            problems.append("only %d uploads parsed (<20)" % parsed_n)
        if vids and bad_dates / len(vids) > 0.01:
            problems.append("%d uploads dated outside channel lifetime (created %s)" % (bad_dates, created))
        big = [m for m, n in per_month.items() if n > 500]
        if big:
            problems.append("month(s) with >500 uploads: %s" % ",".join(sorted(big)))
        entry = {"handle": ch["handle"], "label": ch["label"], "genre": ch["genre"], "channelId": info["id"],
                 "uploadsFetched": len(vids), "uploadsParsed": parsed_n, "playlistComplete": bool(s.state["done"]),
                 "lastFullFetch": s.state.get("lastFull"), "unitsSpent": s.state.get("units", 0), "months": [],
                 "firstUpload": min((v["p"][:10] for v in vids.values()), default=None),
                 "lastUpload": max((v["p"][:10] for v in vids.values()), default=None),
                 "oldestFetched": min((v["p"][:10] for v in vids.values()), default=None),
                 "canary": "FAIL: " + "; ".join(problems) if problems else "ok"}
        if problems:
            report.append("CANARY FAIL %s: %s" % (ch["handle"], "; ".join(problems)))
            idx_ch.append(entry)
            continue
        bym = {}
        for r in rows:
            bym.setdefault(month_of(r["published"]), []).append(r)
        for m, rs in bym.items():
            rs.sort(key=lambda r: -r["views"])
            # One row per song: labels upload a song twice (a second MV, a dance version) and the copy is noise.
            seen, uniq = set(), []
            for r in rs:
                k = (re.sub(r"[^a-z0-9]+", "", r["song"].lower()), re.sub(r"[^a-z0-9]+", "", r["artist"].lower()))
                if k in seen:
                    continue
                seen.add(k)
                uniq.append(r)
            top = uniq[:TOP_N]
            asof = min(r["_s"] for r in top)
            for k, r in enumerate(top, 1):
                r["rank"] = k
            months.setdefault(m, []).append((ch, top, asof))
            entry["months"].append(m)
            oldest_stat = asof if oldest_stat is None else min(oldest_stat, asof)
        entry["months"].sort()
        idx_ch.append(entry)
    # write month files, delete stale ones
    keep = set()
    built = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for m, lst in sorted(months.items()):
        asof = min(a for _, _, a in lst)
        assert dt.date.fromisoformat(asof) >= cutoff, "refusing to publish stale API data"
        src = []
        for ch, top, _ in sorted(lst, key=lambda x: x[0]["handle"].lower()):
            src.append({"id": "yt:" + ch["handle"], "label": ch["label"], "genre": ch["genre"],
                        "channel": "https://www.youtube.com/" + ch["handle"],
                        "rows": [{"rank": r["rank"], "song": r["song"], "artist": r["artist"], "title": r["title"],
                                  "videoId": r["videoId"], "published": r["published"], "views": r["views"]} for r in top]})
        jsave(os.path.join(OUT, m + ".json"), {"month": m, "built": built, "viewsAsOf": asof, "sources": src}, 1)
        keep.add(m + ".json")
    removed = 0
    for f in glob.glob(os.path.join(OUT, "????-??.json")):
        if os.path.basename(f) not in keep:
            os.remove(f)
            removed += 1
    if removed:
        report.append("deleted %d month file(s) with no fresh data" % removed)
    led = ledger()
    jsave(os.path.join(OUT, "index.json"), {
        "built": built, "viewsAsOf": oldest_stat, "policy": "API data refreshed within 30 days or deleted",
        "note": "views are today's counts: most viewed today among uploads from that month",
        "unitsSpentToday": led.get(str(TODAY), 0), "unitsByDay": {k: v for k, v in led.items() if not k.startswith("_")},
        "months": sorted(months), "channels": idx_ch}, 1)
    return months


# ---------------------------------------------------------------- enforcement
def enforce(channels, report):
    """Delete stored API data older than 30 days (stats not refreshed in time) and old raw cache."""
    cutoff = TODAY - dt.timedelta(days=MAX_AGE_DAYS)
    dropped = 0
    for ch in channels:
        p = os.path.join(cdir(ch["handle"]), "videos.json")
        v = jload(p)
        if not v:
            continue
        keep = {i: x for i, x in v.items() if dt.date.fromisoformat(x["s"]) >= cutoff}
        if len(keep) != len(v):
            dropped += len(v) - len(keep)
            jsave(p, keep)
    now = time.time()
    for f in glob.glob(os.path.join(CACHE, "**", "*.json"), recursive=True):
        if os.path.basename(f) == "ledger.json":
            continue
        if now - os.path.getmtime(f) > MAX_AGE_DAYS * 86400:
            os.remove(f)
    if dropped:
        report.append("POLICY: deleted %d stored videos whose stats were older than %d days and could not be refreshed" % (dropped, MAX_AGE_DAYS))


def oldest_stats(channels):
    o = None
    for ch in channels:
        v = jload(os.path.join(cdir(ch["handle"]), "videos.json"), {})
        for x in v.values():
            d = dt.date.fromisoformat(x["s"])
            o = d if o is None or d < o else o
    return o


# ---------------------------------------------------------------- main
def main():
    global BUDGET
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--budget", type=int, default=4000)
    ap.add_argument("--chunk", type=int, default=20, help="pages per channel per round")
    ap.add_argument("--build-only", action="store_true")
    a = ap.parse_args()
    BUDGET = a.budget
    report = []
    channels = jload(CHANNELS, [])
    stopped = False
    if not a.build_only:
        try:
            old = oldest_stats(channels)
            need_refresh = a.refresh or (old is not None and (TODAY - old).days >= REFRESH_AT_DAYS)
            stores = []
            for ch in channels:
                s = Store(ch)
                stores.append(s)
            if need_refresh:
                print("refreshing stats + new uploads ...")
                try:
                    for s in stores:
                        s.refresh_stats()
                        s.new_uploads()
                except BudgetStop:
                    stopped = True
                    report.append("refresh stopped at budget; unrefreshed stats will be dropped if older than 30 days")
                except RuntimeError as e:
                    report.append("REFRESH FAILED: %s" % e)
            # backfill in rounds, smallest remaining first, so small channels complete
            if not stopped:
                while True:
                    active = [s for s in stores if not s.state["done"]]
                    if not active:
                        break
                    active.sort(key=lambda s: int(s.info["statistics"].get("videoCount", 0)) - len(s.videos))
                    for s in active:
                        for _ in range(a.chunk):
                            if not s.backfill_step():
                                break
        except BudgetStop:
            stopped = True
            report.append("budget reached (%d/%d units today); re-run to resume" % (spent_today(), BUDGET))
        except RuntimeError as e:
            report.append("API error: %s" % e)
    enforce(channels, report)
    build(channels, report)
    print("units spent today: %d / %d" % (spent_today(), BUDGET))
    for r in report:
        print(r)
    # A budget stop is the normal end of a backfill day; a failed refresh or API error is not, and the weekly job
    # turns this exit code red (otherwise counts would quietly age toward the 30-day cut-off).
    if any(r.startswith(("REFRESH FAILED", "API error")) for r in report):
        sys.exit(2)


if __name__ == "__main__":
    main()
