#!/usr/bin/env python3
"""Build public/era/industry.json: how people paid for music, by year.

Stdlib only. Reads the committed CSVs under data/industry/ so the build is
reproducible offline. Refuses to write if any year's shares do not sum to 1
(+/- 0.02) or if a gated cross-check year disagrees with RIAA's own year-end
PDF by more than 2 percentage points on any group.

  python3 data/scripts/industry.py            build from the committed CSV
  python3 data/scripts/industry.py --fetch    re-download the RIAA CSV first
  python3 data/scripts/industry.py --strict   also gate the retail-basis-gap years

Basis note (important): the RIAA U.S. Revenue Database is WHOLESALE value
(what labels receive). RIAA's year-end PDFs headline RETAIL (list-price) value.
Shares therefore differ in years with a big physical/download retail markup
(2012 is the clear case). Every share in this file is share of wholesale value.
"""
import csv
import datetime
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
IND = os.path.join(ROOT, "data", "industry")
RAW = os.path.join(IND, "riaa_us_sales_database_2026-10-20.csv")
XCHK = os.path.join(IND, "riaa_pdf_crosscheck.csv")
IFPI = os.path.join(IND, "ifpi_global_streaming_share.csv")
OUT = os.path.join(ROOT, "public", "era", "industry.json")

# RIAA's database page embeds this public Tableau workbook; its CSV export is
# the "download". The workbook id is dated, so it can change: if --fetch 404s,
# open https://www.riaa.com/u-s-sales-database/ and read the new id.
FETCH_URL = ("https://public.tableau.com/views/U_S_RecordedMusicAnalysis_17726391449720/"
             "USRecordingMusicAnalytics_1.csv?:showVizHome=no")

GROUPS = {"Streaming": "streaming", "Digital Downloads": "downloads",
          "Physical": "physical", "Synchronization": "sync"}
SUM_TOL = 0.02
XCHK_TOL_PP = 2.0
WHOLESALE_TOL = 0.03

# Individual formats surfaced for lines like "CDs were 30%".
FORMAT_KEYS = {
    "CD": "cd", "LP/EP": "vinyl", "Cassette": "cassette", "8 - Track": "eight_track",
    "Download Single": "download_single", "Download Album": "download_album",
    "Paid Subscriptions (Premium)": "paid_subscription",
    "Paid Subscriptions (Non-Premium)": "paid_subscription_limited",
    "Free Streaming": "ad_supported_streaming", "Other Streaming": "other_streaming",
    "Ringtones & Ringbacks": "ringtones",
}


def num(s):
    s = (s or "").strip().replace(",", "")
    return float(s) if s else 0.0


def fetch():
    req = urllib.request.Request(FETCH_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
    if not body.startswith(b"Disclaimer,Format"):
        sys.exit("fetch: unexpected response (workbook id changed?); not overwriting " + RAW)
    with open(RAW, "wb") as f:
        f.write(body)
    print("fetched", len(body), "bytes ->", RAW)


def load_us():
    rev = {}  # year -> {(format, format2): dollars}
    with open(RAW, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["Measure Names"] != "Revenue" or not r["Year"].isdigit():
                continue
            rev.setdefault(int(r["Year"]), {})[(r["Format"], r["Format2"])] = num(r["Measure Values"])
    return rev


def build_us(rev):
    us, problems = {}, []
    for y in sorted(rev):
        d = rev[y]
        total = d.get(("All", "All"), 0.0)
        if total <= 0:
            problems.append(f"{y}: no total")
            continue
        parts = {g: 0.0 for g in GROUPS.values()}
        fmts = {}
        comp = 0.0
        for (fmt, f2), v in d.items():
            if fmt == "All" or f2 not in GROUPS:
                continue
            parts[GROUPS[f2]] += v
            comp += v
            if fmt in FORMAT_KEYS:
                k = FORMAT_KEYS[fmt]
                fmts[k] = fmts.get(k, 0.0) + v
        # catch a measurer that silently under-counts: components must rebuild the total
        if abs(comp - total) / total > 0.005:
            problems.append(f"{y}: components {comp:.0f} != total {total:.0f}")
        shares = {g: round(v / total, 4) for g, v in parts.items()}
        shares["other"] = round(max(0.0, (total - comp) / total), 4)
        s = sum(shares.values())
        if abs(s - 1) > SUM_TOL:
            problems.append(f"{y}: shares sum {s:.4f}")
        top = max(parts, key=parts.get)
        fshares = {k: round(v / total, 4) for k, v in sorted(fmts.items(), key=lambda kv: -kv[1]) if v > 0}
        us[str(y)] = {"total_usd_m": round(total / 1e6), "shares": shares,
                      "top_format": top,
                      "top_single_format": next(iter(fshares), None),
                      "formats": fshares}
    return us, problems


def crosscheck(us, strict):
    """Compare DB shares with RIAA year-end PDF shares. Returns (rows, failures)."""
    rows, fails = [], []
    print(f"{'year':<5}{'group':<10}{'DB %':>7}{'PDF %':>8}{'diff pp':>9}  gate")
    with open(XCHK, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            y = r["year"]
            gated = r["gate"] == "yes" or strict
            tot = num(r["total_m"])
            pdf = {"streaming": num(r["streaming_m"]), "downloads": num(r["downloads_m"]),
                   "physical": num(r["physical_m"]), "sync": num(r["sync_m"])}
            if y not in us:
                fails.append(f"{y}: cross-check year missing from build")
                continue
            for g, v in pdf.items():
                if g == "sync" and v == 0:
                    continue  # PDF does not publish sync that year
                p = 100 * v / tot
                dbp = 100 * us[y]["shares"][g]
                diff = dbp - p
                bad = abs(diff) > XCHK_TOL_PP
                print(f"{y:<5}{g:<10}{dbp:7.1f}{p:8.1f}{diff:+9.1f}  "
                      f"{'GATED' if gated else 'info'}{' FAIL' if bad else ''}")
                if bad and gated:
                    fails.append(f"{y} {g}: DB {dbp:.1f}% vs PDF {p:.1f}% ({diff:+.1f}pp)")
            if r["wholesale_total_m"]:
                w = num(r["wholesale_total_m"])
                dbt = us[y]["total_usd_m"]
                rel = abs(dbt - w) / w
                # the wholesale total is like-for-like in every year, so it is always gated
                print(f"{y:<5}{'wholesale$':<10}{dbt:7.0f}{w:8.0f}{(dbt - w) / w * 100:+8.1f}%  "
                      f"GATED{' FAIL' if rel > WHOLESALE_TOL else ''}")
                if rel > WHOLESALE_TOL:
                    fails.append(f"{y} wholesale total: DB {dbt} vs PDF {w:.0f}")
            rows.append(y)
    return rows, fails


def load_global():
    out = {}
    with open(IFPI, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out[r["year"]] = {"streaming_share": round(num(r["streaming_share_pct"]) / 100, 4),
                              "total_usd_bn": num(r["total_usd_bn"]), "source_url": r["source_url"]}
    return out


def main():
    if "--fetch" in sys.argv:
        fetch()
    us, problems = build_us(load_us())
    _, fails = crosscheck(us, "--strict" in sys.argv)
    problems += fails
    if problems:
        print("\nREFUSING to write", OUT)
        for p in problems:
            print("  -", p)
        sys.exit(1)
    doc = {
        "source": ("RIAA U.S. Revenue Database (wholesale value, 1973-latest), cross-checked against RIAA "
                   "year-end reports; global series from IFPI Global Music Report press releases."),
        "url": "https://www.riaa.com/u-s-sales-database/",
        "license_note": ("RIAA: 'Permission to cite or copy these statistics is hereby granted, as long as proper "
                         "attribution is given to the Recording Industry Association of America' (printed on its "
                         "year-end reports); no explicit licence on the database page, questions to research@riaa.com. "
                         "Cite as 'RIAA'. IFPI: (c) IFPI, all rights reserved; only headline percentages are quoted "
                         "with attribution to IFPI's Global Music Report. Shares are of WHOLESALE value; RIAA's "
                         "headline year-end totals are retail value."),
        "basis": "wholesale",
        "built": datetime.date.today().isoformat(),
        "us": us,
        "global": load_global(),
        "global_source_url": "https://www.ifpi.org/our-industry/industry-data/",
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"\nwrote {OUT}: us {min(us)}-{max(us)} ({len(us)} yrs), global {len(doc['global'])} yrs")


if __name__ == "__main__":
    main()
