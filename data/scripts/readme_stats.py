#!/usr/bin/env python3
"""Rewrite the README's stats block from the shards, so no public number is ever typed by hand.

Replaces everything between <!-- STATS:BEGIN --> and <!-- STATS:END --> in README.md.
Refuses (exit 2) when a shard is missing, so a broken pipeline cannot publish zeros.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ERA = ROOT / "public" / "era"


def need(rel: str):
    p = ERA / rel
    if not p.exists():
        sys.exit(f"REFUSING: {rel} is missing")
    return json.loads(p.read_text())


def main():
    flight = need("flight.json")
    index = need("index.json")
    lanes = need("lanes/index.json")
    heat_months = sorted(p.stem for p in (ERA / "heat").glob("[0-9]*-[0-9]*.json"))
    reddit_months = sorted(p.stem for p in (ERA / "reddit").glob("[0-9]*-[0-9]*.json")) if (ERA / "reddit").exists() else []
    industry = need("industry.json")

    weeks = len(flight["weeks"])
    with_art = sum(1 for s in flight["songs"] if s["art"])
    rows = len(index["rows"])
    us_years = sorted(industry["us"])
    if not (weeks and rows and lanes.get("lanes") and heat_months):
        sys.exit("REFUSING: a count came out zero")

    cells = [
        (f"{weeks:,}", f"Hot 100 weeks, {flight['weeks'][0][0][:4]}–{flight['through'][:4]}"),
        (f"{with_art:,}/{len(flight['songs']):,}", "#1 songs with their cover"),
        (f"{rows:,}", "songs in the search index"),
        (str(len(lanes["lanes"])), "genre and country charts"),
        (f"{len(heat_months)}", f"months of archived blog charts ({heat_months[0][:4]}–{heat_months[-1][:4]})"),
    ]
    if reddit_months:
        cells.append((f"{len(reddit_months)}", f"months of Reddit [FRESH] lists ({reddit_months[0][:4]}–{reddit_months[-1][:4]})"))
    cells.append((f"{us_years[0]}–{us_years[-1]}", "US revenue by format (RIAA)"))

    tds = "\n".join(f'<td align="center"><strong>{v}</strong><br><sub>{label}</sub></td>' for v, label in cells)
    block = (
        "<!-- STATS:BEGIN -->\n<table>\n<tr>\n" + tds + "\n</tr>\n</table>\n\n"
        f"<sub>Counted from the data in <code>public/era/</code> on {date.today().isoformat()} by "
        "<code>data/scripts/readme_stats.py</code>; charts through " + flight["through"] + ".</sub>\n<!-- STATS:END -->"
    )
    readme = ROOT / "README.md"
    text = readme.read_text()
    if "<!-- STATS:BEGIN -->" not in text:
        sys.exit("REFUSING: README has no STATS block")
    readme.write_text(re.sub(r"<!-- STATS:BEGIN -->.*?<!-- STATS:END -->", lambda _: block, text, flags=re.S))
    print("README stats:", "; ".join(f"{v} {label}" for v, label in cells))


if __name__ == "__main__":
    main()
