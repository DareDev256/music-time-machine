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


def EXTRA_SOURCES(_p_billboard):
    return []
