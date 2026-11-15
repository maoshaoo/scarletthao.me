#!/usr/bin/env python3
"""Build play/standby/data/routes.json: how full United's routes from the Bay Area run, by month.

Source: U.S. DOT, Bureau of Transportation Statistics, T-100 Segment (All Carriers).
Public data, monthly totals per airline and route: seats and passengers. It runs a few months behind.

For each United route touching SFO, OAK or SJC (both directions), this averages passengers / seats
for each calendar month over the most recent years available. The Standby Radar app uses it as the
starting point for its forecast. It is never a seat count for a single flight.

Runs monthly in GitHub Actions (.github/workflows/routes.yml). Standard library only.
    python3 tools/make-routes.py            # last two full years
    python3 tools/make-routes.py 2025 2026  # specific years
"""
import csv
import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request
import zipfile
from datetime import date
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "play" / "standby" / "data" / "routes.json"
BASE = "https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FIM&QO_fu146_anzr=Nv4%25Pn44vr45"
POST = "https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FIM&QO_fu146_anzr=Nv4+Pn44vr45"
HOME = {"SFO", "OAK", "SJC"}
CARRIER = "UA"
FIELDS = ["DEPARTURES_PERFORMED", "SEATS", "PASSENGERS", "UNIQUE_CARRIER", "ORIGIN", "DEST",
          "DEST_CITY_NAME", "ORIGIN_CITY_NAME", "YEAR", "MONTH"]

opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
opener.addheaders = [("User-Agent", "scarletthao.me route history (personal project)")]


def hidden(page, name):
    m = re.search(r'id="%s" value="([^"]*)"' % name, page)
    return html.unescape(m.group(1)) if m else ""


def download(year):
    page = opener.open(BASE, timeout=120).read().decode("utf-8", "replace")
    form = {
        "__EVENTTARGET": "", "__EVENTARGUMENT": "", "__LASTFOCUS": "",
        "__VIEWSTATE": hidden(page, "__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": hidden(page, "__VIEWSTATEGENERATOR"),
        "__EVENTVALIDATION": hidden(page, "__EVENTVALIDATION"),
        "txtSearch": "", "cboGeography": "All", "cboYear": str(year), "cboPeriod": "All",
        "btnDownload": "Download",
    }
    for f in FIELDS:
        form[f] = "on"
    req = urllib.request.Request(POST, data=urllib.parse.urlencode(form).encode(), headers={"Referer": BASE})
    blob = opener.open(req, timeout=600).read()
    z = zipfile.ZipFile(io.BytesIO(blob))
    name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
    return z.read(name).decode("utf-8", "replace")


def main(years):
    seats, pax, flights, names = {}, {}, {}, {}
    got = []
    for y in years:
        try:
            text = download(y)
        except Exception as e:  # a year that isn't published yet is fine
            print(f"{y}: skipped ({e})")
            continue
        n = 0
        for row in csv.DictReader(io.StringIO(text)):
            if row.get("UNIQUE_CARRIER") != CARRIER:
                continue
            o, d = row.get("ORIGIN"), row.get("DEST")
            if o not in HOME and d not in HOME:
                continue
            try:
                s, p, m = float(row["SEATS"]), float(row["PASSENGERS"]), int(float(row["MONTH"]))
                dep = float(row.get("DEPARTURES_PERFORMED") or 0)
            except (KeyError, ValueError):
                continue
            if s <= 0:
                continue
            k = (f"{o}-{d}", m)
            seats[k] = seats.get(k, 0) + s
            pax[k] = pax.get(k, 0) + p
            flights[k] = flights.get(k, 0) + dep
            names.setdefault(d, (row.get("DEST_CITY_NAME") or d).split(",")[0].strip())
            names.setdefault(o, (row.get("ORIGIN_CITY_NAME") or o).split(",")[0].strip())
            n += 1
        print(f"{y}: {n} United Bay Area rows")
        if n:
            got.append(y)
    if not got:
        print("No data downloaded; keeping the existing file.")
        return 1
    routes, per_day = {}, {}
    for (route, m), s in seats.items():
        routes.setdefault(route, {})[str(m)] = round(min(pax[(route, m)] / s, 1.0), 3)
        per_day.setdefault(route, {})[str(m)] = round(flights[(route, m)] / (30.4 * len(got)), 1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "updated": date.today().isoformat(),
        "source": "U.S. DOT Bureau of Transportation Statistics, T-100 Segment (All Carriers)",
        "years": got,
        "carrier": CARRIER,
        "routes": dict(sorted(routes.items())),
        "flightsPerDay": dict(sorted(per_day.items())),
        "names": dict(sorted(names.items())),
    }, indent=1) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(routes)} routes from {got}")
    return 0


if __name__ == "__main__":
    ys = [int(a) for a in sys.argv[1:]] or [date.today().year - 2, date.today().year - 1, date.today().year]
    sys.exit(main(ys))
