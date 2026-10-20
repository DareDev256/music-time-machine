"""New-source parsers + registry additions for wayback_heat.py (stdlib only)."""
import re, html, json


def clean(x):
    x = re.sub(r"<script.*?</script>", " ", x, flags=re.S | re.I)
    x = re.sub(r"<style.*?</style>", " ", x, flags=re.S | re.I)
    x = re.sub(r"<[^>]+>", " ", x)
    x = html.unescape(x).replace("\xa0", " ")
    return re.sub(r"\s+", " ", x).strip()


def _unq(t):
    t = clean(t).strip()
    t = re.sub(r'^[\u201c\u201d"\u201e]+|[\u201c\u201d"]+$', "", t).strip()
    t = t.replace("\u201d", "").replace("\u201c", "")
    return t


def _join_artists(lst):
    lst = [clean(x) for x in lst if clean(x)]
    if len(lst) > 2:
        return ", ".join(lst[:-1]) + " & " + lst[-1]
    return " & ".join(lst)


def _slug_tokens(s):
    return [w for w in re.split(r"[^a-z0-9]+", s.lower()) if w]


def _norm_word(w):
    import unicodedata
    w = unicodedata.normalize("NFKD", w)
    return "".join(c for c in w if c.isalnum() and ord(c) < 128).lower()


def _artist_from_slug(slug, title, hed):
    """2024+ pitchfork lists only headlines. Recover the artist from the URL slug (artist-title) with the
    original casing taken from the headline when the slug tokens occur in it."""
    st = _slug_tokens(slug)
    tt = _slug_tokens(title)
    if tt and st[-len(tt):] == tt:
        st = st[:-len(tt)]
    elif tt:
        return None
    if not st:
        return None
    words = re.findall(r"[^\s]+", hed)
    norm = [_norm_word(w) for w in words]
    n = len(st)
    for i in range(len(words)):
        j, k = i, 0
        while j < len(words) and k < n:
            if norm[j] == "":
                j += 1
                continue
            if norm[j] == st[k] or (k == n - 1 and norm[j] in (st[k] + "s",)):
                k += 1
                j += 1
            else:
                break
        if k == n:
            out = " ".join(words[i:j])
            out = re.sub(r"[\u2019']s$", "", out)
            return out.strip(",:;")
    return " ".join(w.capitalize() for w in st)


def parse_pitchfork(h, kind):
    """Best New Tracks, newest first. P1 2009-11 tombstone table; P2 2013-15 object-list h1 artist/title spans;
    P3 2016-18 react track-collection-item; P4 2019-23 track-collection-item__*; P5 2024+ headline cards
    (artist rebuilt from the URL slug)."""
    rows = []
    for blk in re.split(r'<h2 class="tombstone title">', h)[1:]:
        head = blk.split("tombstone title")[0]
        if "best-new-tracks-icon" not in head:
            continue
        a = re.search(r'<a href="/artists/[^"]*"[^>]*>(.*?)</a>', head, re.S)
        t = re.search(r'<a href="/reviews/tracks/[^"]*">(.*?)</a>', head, re.S)
        if a and t:
            rows.append((_unq(t.group(1)), clean(a.group(1))))
    if rows:
        return rows, "P1"
    for a, t in re.findall(r'<h1>\s*<a href="/reviews/tracks/[^"]*">\s*<span class="artist">(.*?)</span>\s*<span class="title">(.*?)</span>', h, re.S):
        rows.append((_unq(t), clean(a).rstrip(":").strip()))
    if rows:
        return rows, "P2"
    for pre in ("track-collection-item__", ""):
        for blk in re.findall(r'<a [^>]*href="/reviews/tracks/[^"]*"[^>]*class="%strack-link"[^>]*>(.*?)</a>' % pre, h, re.S):
            ar = re.findall(r'<li[^>]*>(.*?)</li>', blk, re.S)
            t = re.search(r'<h2[^>]*>(.*?)</h2>', blk, re.S)
            if ar and t:
                rows.append((_unq(t.group(1)), _join_artists(ar)))
        if rows:
            return rows, "P3" if not pre else "P4"
    ld = re.findall(r'"name":"((?:[^"\\]|\\.)*)","url":"https://pitchfork.com/reviews/tracks/([^"/]+)/"', h)
    heds = re.findall(r'dangerousHed&quot;:&quot;(.*?)&quot;,&quot;id&quot;:&quot;[^&]*&quot;,&quot;index&quot;:\d+,&quot;contentType&quot;:&quot;[^&]*&quot;,&quot;hotelLink&quot;:&quot;/reviews/tracks/([^&/]+)/', h)
    hmap = {sl: html.unescape(hd) for hd, sl in heds}
    for name, sl in ld:
        try:
            name = json.loads('"%s"' % name)
        except Exception:
            pass
        title = _unq(name)
        art = _artist_from_slug(sl, title, hmap.get(sl, ""))
        if title and art:
            rows.append((title, art))
    if rows:
        return rows, "P5"
    return [], None


def parse_billboard_modern(h):
    """Billboard layouts after 2014 (older A-D live in wayback_heat.parse_billboard).
    E 2015: <article id="row-N" class="chart-row"> .. <div class="row-title"><h2>song</h2><h3>artist
    F 2019-2022: <div class="chart-list-item" data-rank= data-artist= data-title=>
    G 2023+: <ul class="o-chart-results-list-row"> rank c-label, h3.c-title song, span.c-label artist"""
    rows = {}
    for rk, blk in re.findall(r'<article id="row-(\d+)" class="chart-row[^"]*"[^>]*>(.*?)<div class="row-secondary', h, re.S):
        t = re.search(r'<div class="row-title">\s*<h2>(.*?)</h2>\s*<h3>(.*?)</h3>', blk, re.S)
        if t:
            rows.setdefault(int(rk), (clean(t.group(1)), clean(t.group(2))))
    if rows:
        return [rows[k] for k in sorted(rows)], "E"
    for rk, a, t in re.findall(r'<div class="chart-list-item[^"]*"\s+data-rank="(\d+)"\s+data-artist="([^"]*)"\s+data-title="([^"]*)"', h):
        rows.setdefault(int(rk), (clean(t), clean(a)))
    if rows:
        return [rows[k] for k in sorted(rows)], "F"
    for blk in re.findall(r'<ul class="o-chart-results-list-row[^"]*"[^>]*>(.*?)(?=<ul class="o-chart-results-list-row|$)', h, re.S):
        rk = re.search(r'<span class="c-label[^"]*"[^>]*>\s*(\d+)\s*</span>', blk)
        t = re.search(r'<h3[^>]*class="c-title[^"]*"[^>]*>(.*?)</h3>', blk, re.S)
        a = re.search(r'</h3>\s*<span class="c-label[^"]*"[^>]*>(.*?)</span>', blk, re.S)
        if rk and t and a:
            rows.setdefault(int(rk.group(1)), (clean(t.group(1)), clean(a.group(1))))
    if rows:
        return [rows[k] for k in sorted(rows)], "G"
    return [], None


def parse_beatport(h, kind):
    """B1 2016-2023: li.ec-item (data-ec-position), title span + mix, artist links.
    B2 2024+: Next.js __NEXT_DATA__ results[] with name / mix_name / artists[].
    (2012-2015 pages are client-rendered underscore templates: no rows in the raw capture.)"""
    rows = {}
    for pos, blk in re.findall(r'<li class="bucket-item ec-item track"[^>]*data-ec-position="(\d+)"[^>]*>(.*?)(?=<li class="bucket-item ec-item track"|</ul>)', h, re.S):
        t = re.search(r'<span class="buk-track-primary-title"[^>]*>(.*?)</span>', blk, re.S)
        mx = re.search(r'<span class="buk-track-remixed">(.*?)</span>', blk, re.S)
        ar = re.search(r'<p class="buk-track-artists">(.*?)</p>', blk, re.S)
        if t and ar:
            title = clean(t.group(1))
            m = clean(mx.group(1)) if mx else ""
            if m and m.lower() != "original mix":
                title = "%s (%s)" % (title, m)
            rows.setdefault(int(pos), (title, _join_artists(re.findall(r'<a [^>]*>(.*?)</a>', ar.group(1), re.S))))
    if rows:
        return [rows[k] for k in sorted(rows)], "B1"
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', h, re.S)
    if m:
        try:
            d = json.loads(m.group(1))
            res = None
            for q in d["props"]["pageProps"]["dehydratedState"]["queries"]:
                r = q.get("state", {}).get("data", {})
                if isinstance(r, dict) and isinstance(r.get("results"), list) and r["results"] and "artists" in r["results"][0]:
                    res = r["results"]
                    break
            out = []
            for x in res or []:
                title = (x.get("name") or "").strip()
                mn = (x.get("mix_name") or "").strip()
                if mn and mn.lower() != "original mix":
                    title = "%s (%s)" % (title, mn)
                out.append((title, _join_artists([a.get("name", "") for a in x.get("artists", [])])))
            if out:
                return out, "B2"
        except Exception:
            pass
    return [], None


def parse_spotify_viral(h, kind):
    rows = []
    for pos, blk in re.findall(r'<td class="chart-table-position">\s*(\d+)\s*</td>(.*?)(?=<td class="chart-table-position"|</tbody>|$)', h, re.S):
        t = re.search(r'<td class="chart-table-track">\s*<strong>(.*?)</strong>\s*<span>by (.*?)</span>', blk, re.S)
        if t:
            rows.append((int(pos), clean(t.group(1)), clean(t.group(2))))
    rows.sort()
    return [(t, a) for _, t, a in rows], "S1"


def parse_kworb(h, kind):
    """kworb.net tables: Pos | trend | 'Artist - Title' (spotify weekly has artist/track links, itunes plain text)."""
    rows = {}
    for rk, cell in re.findall(r'<tr[^>]*>\s*<td[^>]*>\s*(\d+)\s*</td>\s*<td[^>]*>.*?</td>\s*<td class="[^"]*mp[^"]*"[^>]*>\s*<div>(.*?)</div>', h, re.S):
        txt = clean(cell)
        if " - " in txt:
            a, t = txt.split(" - ", 1)
            rows.setdefault(int(rk), (t.strip(), a.strip()))
    return [rows[k] for k in sorted(rows)], "K1"


# ---- hip-hop blog front pages: song posts only ------------------------------------------------------------
_NOT_SONG = re.compile(r"(?i)\b(mixtape|album|e\.?p\.?\b|interview|trailer|photos?|pictures|gallery|tracklist|artwork|stream:|live ?stream|"
                       r"review|sexy|giveaway|contest|tour|dates|announce|signs?|arrested|dies|dead|lawsuit|says|talks|"
                       r"cover|premiere:|presents|podcast|listening party|documentary|part \d|episode|vol\.|volume|"
                       r"playlist|best of|top \d+|\d+ (best|things|songs)|so far|essential)\b")
_DASH = re.compile(r"^(?P<a>[^\u2013\u2014\"\u201c\u201d]{2,60}?)\s+[\u2013\u2014-]\s+(?P<s>.{2,100})$")


def _clean_song(s):
    s = re.sub(r"\s*[\[(](?:prod\.?|produced|cdq|dirty|clean|explicit|audio|official|dj [^)\]]*|snippet)[^\])]*[\])]", "", s, flags=re.I)
    s = re.sub(r"\s*[\[(]\s*(?:video|audio|cdq|dirty|clean|explicit|new|official)\s*[\])]", "", s, flags=re.I)
    s = s.strip().strip("\u201c\u201d\"\u2018\u2019'").strip()
    return s


def song_from_headline(txt):
    """'Artist - Song', 'Artist - "Song"', 'Listen to Artist\'s "Song"' -> (song, artist) or None. News headlines are rejected."""
    txt = clean(txt)
    if not txt or len(txt) > 140:
        return None
    m = re.match(r"^(?:Listen to|Stream|Hear|Watch)\s+(.+?)[\u2019']s\s+[\u201c\"\u2018']([^\u201c\u201d\"]{2,80})[\u201d\"\u2019']\s*(?:f/|ft\.?|feat\.?)?\s*(.*)$", txt)
    if m and not _NOT_SONG.search(m.group(1)):
        a = m.group(1).strip()
        if m.group(3).strip():
            a = "%s feat. %s" % (a, m.group(3).strip())
        return _clean_song(m.group(2)), a
    if re.match(r"(?i)^(video|watch|premiere|listen|stream|new|exclusive|sat|saturday)\b[: ]", txt):
        txt = re.sub(r"(?i)^(video|new music|new|exclusive)\s*[:|]\s*", "", txt)
        if re.match(r"(?i)^(watch|premiere|listen|stream|sat|saturday)\b", txt):
            return None
    m = _DASH.match(txt)
    if not m or _NOT_SONG.search(txt):
        return None
    a, s = re.sub(r"(?i)^(video|audio|new)\s*[!:]\s*", "", m.group("a").strip()), m.group("s").strip()
    q = re.match(r"^[\u201c\"\u2018']([^\u201c\u201d\"]{1,80})[\u201d\"\u2019']\s*(?:[(\[]?\s*(?:f\.|ft\.?|feat\.?|featuring|f/)\s*([^)\]]+?)\s*[)\]]?)?\s*(?:[\[(].*)?$", s)
    if q:
        s = q.group(1)
        if q.group(2):
            a = "%s feat. %s" % (a, q.group(2).strip())
    s = _clean_song(s)
    if not s or len(a.split()) > 8 or len(s.split()) > 12 or s.lower() in ("video", "audio", "mixtape"):
        return None
    if re.search(r"(?i)\b(is|are|was|were|has|have|will|gets|gives|drops|and the|to)\b.*\b(is|are|was|were|has|have|will)\b", s):
        return None
    return s, a


def _headlines(h):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S | re.I)
    out = []
    for m in re.finditer(r"<h[1-4][^>]*>\s*<a\b[^>]*>(.*?)</a>", t, re.S):
        out.append(m.group(1))
    return out


def parse_blog_posts(h, kind):
    rows, seen = [], set()
    for hd in _headlines(h):
        x = song_from_headline(hd)
        if x and x not in seen:
            seen.add(x)
            rows.append(x)
    return rows, "H1"


def EXTRA_SOURCES(_p_billboard):
    def V(kind, url, parse, frm="2008-01", to="2025-12", why=None):
        return {"kind": kind, "url": url, "parse": parse, "frm": frm, "to": to, "why": why}
    BEAT_WHY = "2008-2016 beatport top-100 captures are client-rendered underscore templates: no rows in the raw capture"
    return [
        ("beatport_top100", "dance", 4, {"ranked": "Beatport · Top 100 Tracks"},
         [V("ranked", "beatport.com/top-100", parse_beatport, "2017-01", "2025-12", BEAT_WHY)]),
        ("billboard_dance", "dance", 4, {"ranked": "Billboard · Dance/Electronic Songs"},
         [V("ranked", "billboard.com/charts/dance-electronic-songs", _p_billboard)]),
        ("billboard_alt", "rock", 5, {"ranked": "Billboard · Alternative Songs / Alternative Airplay"},
         [V("ranked", "billboard.com/charts/alternative-songs", _p_billboard),
          V("ranked", "billboard.com/charts/alternative-airplay", _p_billboard)]),
        ("spotify_viral", "all", 6, {"ranked": "Spotify · Viral 50 US (weekly, else daily)"},
         [V("ranked", "spotifycharts.com/viral/us/weekly/latest", parse_spotify_viral),
          V("ranked", "spotifycharts.com/viral/us/daily/latest", parse_spotify_viral)]),
        ("kworb_spotify_us", "pop", 6, {"ranked": "kworb · Spotify US Weekly (streams)"},
         [V("ranked", "kworb.net/spotify/country/us_weekly.html", parse_kworb)]),
        ("kworb_itunes_us", "pop", 6, {"ranked": "kworb · iTunes US Top Songs"},
         [V("ranked", "kworb.net/charts/itunes/us.html", parse_kworb)]),
        ("blog_2dopeboyz", "hip-hop", 7, {"front": "2DopeBoyz · Front page song posts (newest first, not a rank)"},
         [V("front", "2dopeboyz.com/", parse_blog_posts, "2008-01", "2018-12", "2019+ 2dopeboyz is client-rendered: no post headlines in the raw capture")]),
        ("blog_pigeonsandplanes", "hip-hop", 7, {"front": "Pigeons & Planes · Front page song posts (newest first, not a rank)"},
         [V("front", "pigeonsandplanes.com/", parse_blog_posts, "2008-01", "2019-12", "pigeonsandplanes.com captures end 2019")]),
    ]
