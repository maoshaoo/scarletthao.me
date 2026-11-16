#!/usr/bin/env python3
"""Build feed.xml, an RSS feed of the changelog, from changelog.html.

Run it after every changelog entry:
    python3 tools/make-feed.py

Each <article class="entry"> becomes one item: its date, its heading (with the
tag in brackets), and its bullet list as the description. Newest first, as on
the page. Standard library only.
"""
import html
import re
from datetime import datetime, timezone, timedelta
from email.utils import format_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://www.scarletthao.me"
PAGE = f"{SITE}/changelog.html"
PT = timezone(timedelta(hours=-8))  # dates are San Francisco days; noon PT keeps them on the right day

src = (ROOT / "changelog.html").read_text(encoding="utf-8")
entries = re.findall(r'<article class="entry"[^>]*>(.*?)</article>', src, re.S)


def text(fragment):
    """Strip tags and collapse whitespace, keeping entities decoded."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", fragment))).strip()


def absolute(fragment):
    """Make site-relative links absolute so they work in a feed reader."""
    fragment = re.sub(r'href="/', f'href="{SITE}/', fragment)
    return re.sub(r'href="(?!https?:|mailto:|#)([^"]+)"', rf'href="{SITE}/\1"', fragment)


items = []
for e in entries:
    date = re.search(r'<div class="date">\s*([\d-]+)\s*</div>', e).group(1)
    h2 = re.search(r"<h2>(.*?)</h2>", e, re.S).group(1)
    tag = re.search(r'<span class="tag[^"]*">(.*?)</span>', h2)
    title = text(re.sub(r'<span class="tag.*?</span>', "", h2))
    if tag:
        title += f" ({text(tag.group(1))})"
    body = re.search(r"<ul>.*?</ul>", e, re.S)
    desc = absolute(re.sub(r"\s+", " ", body.group(0))) if body else ""
    when = datetime.strptime(date, "%Y-%m-%d").replace(hour=12, tzinfo=PT)
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    items.append(
        "    <item>\n"
        f"      <title>{html.escape(title)}</title>\n"
        f"      <link>{PAGE}</link>\n"
        f'      <guid isPermaLink="false">{date}-{slug}</guid>\n'
        f"      <pubDate>{format_datetime(when)}</pubDate>\n"
        f"      <description><![CDATA[{desc}]]></description>\n"
        "    </item>"
    )

latest = items and re.search(r"<pubDate>(.*?)</pubDate>", items[0]).group(1)
feed = f"""<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Scarlett Hao. · What's new</title>
    <link>{PAGE}</link>
    <atom:link href="{SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>What's shipped on scarletthao.me: new stories, features and small fun things, newest first.</description>
    <language>en-us</language>
    <lastBuildDate>{latest}</lastBuildDate>
{chr(10).join(items)}
  </channel>
</rss>
"""
(ROOT / "feed.xml").write_text(feed, encoding="utf-8")
print(f"feed.xml: {len(items)} items, latest {latest}")
