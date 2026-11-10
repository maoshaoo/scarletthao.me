# scarletthao.me

The personal site of Scarlett Hao, a product leader who turns "it works" into "we can't work without it": consumer product thinking, applied to physical AI.

**Live:** [www.scarletthao.me](https://www.scarletthao.me) · **What's new:** [changelog](https://www.scarletthao.me/changelog.html)

## How it's built

- Plain HTML, CSS, and JavaScript. No framework and no build step.
- Hosted on [GitHub Pages](https://pages.github.com/) from the `main` branch.
- Fonts: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), [Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk), and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), via Google Fonts.
- Analytics: [Umami](https://umami.is), which is privacy-friendly and uses no cookies.
- Weather in the header: [Open-Meteo](https://open-meteo.com), which is free and needs no key.
- Built with [Claude Code](https://claude.com/claude-code).

## Layout

```
index.html            home page
changelog.html        what's shipped, newest first
404.html              page-not-found
assets/
  css/base.css        shared colors, type, footer, and the scroll truck
  css/home.css        home page styles
  css/changelog.css   changelog styles
  js/site.js          copy-email button, live time and weather, scroll truck
  images/             photos and the link-preview image
  images/logos/       company logos
favicon.svg, favicon-32.png, apple-touch-icon.png   site icons (kept at the root, where browsers look for them)
CNAME                 custom domain for GitHub Pages
shortlinks.json       short links like /linkedin (see below)
tools/                small helper scripts
robots.txt, sitemap.xml
```

## Preview locally

From the repo folder, start any static file server and open the address it prints:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Making a change

1. Edit the page or asset.
2. Add an entry to the top of `changelog.html`, tagged **New**, **Fun**, or **Functionality**.
3. Push to `main`. GitHub Pages publishes within a minute or two.

Commit messages: a short, plain title describing the change, and at most one or two human-readable lines underneath. Longer notes live with the task, not in the commit.

## Short links

Short addresses like [scarletthao.me/linkedin](https://www.scarletthao.me/linkedin) forward to other sites. They're listed in `shortlinks.json`. To add or change one, edit that file and regenerate the pages:

```sh
python3 tools/make-shortlinks.py
```

Each link becomes a small page that waits half a second (so the visit is counted) and then forwards.

## Rights

© 2026 Scarlett Hao. All rights reserved.

This repository is public so the site can be hosted and so others can see how it's built. The words, photos, and design are not licensed for reuse. Company names and logos belong to their respective owners and are used only to describe past work.
