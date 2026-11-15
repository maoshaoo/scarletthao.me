# Standby Radar

A small phone app for planning standby trips on United, at [scarletthao.me/play/standby](https://www.scarletthao.me/play/standby/) (short link: [scarletthao.me/standby](https://www.scarletthao.me/standby/)).

We're lucky to have a great friend who shares their United standby travel with us. We've used it, but not nearly enough. This is our nudge to take a trip once a month and see the world.

## What it does

1. **Home:** our favorite places (Japan, Seoul, Cabo), each with the best upcoming dates and how open the flights look. Below them, two ways in:
   - **I know where and when:** pick a place and dates, then see each travel day rated, including a day either side.
   - **Roll the dice:** upload a screenshot of the airline app's open-flights list, rank our places for some dates, or rank everywhere United flies from SFO.
2. **Check real seats:** on the day, upload a screenshot of the seat counts and standby list. The app reads it and gives a verdict (good odds, tight, or unlikely) with the seats to spare. "Read with Claude" handles messy screenshots and suggests a Plan B.
3. **Log:** every check, whether we made it, our best day of the week, and a CSV download. It can also sync to a private Google Sheet.

To keep it on your phone's home screen, open the page in Safari, tap Share, then Add to Home Screen.

## How the forecast works

It's an estimate, never a seat count. Each travel day gets a score from:

- **Route history:** how full United's flights on that route ran in that month, from public U.S. Department of Transportation data (T-100), averaged over recent years, plus how many flights a day United runs.
- **Day of week:** Tuesday, Wednesday and Saturday are usually lighter; Friday and Sunday are heavier.
- **Holiday peaks:** Thanksgiving, the December holidays, three-day weekends, July 4th week and spring break count against a date.
- **Our own log:** the seats to spare we actually saw on that route.

A round trip scores as its weaker leg, since getting home matters as much as getting there.

## Privacy

- No account, no airline login, and no airline branding.
- The log, our places, the Google Sheet link and the Claude key are stored only in the phone's browser. None of them are in this repository.
- Screenshots are read on the phone. They only leave it when "Read with Claude" is tapped, and then they go straight to Claude with our own key.

## Files

| File | What it is |
|---|---|
| `index.html`, `standby.css`, `standby.js` | The app. Plain HTML, CSS and JavaScript. |
| `manifest.webmanifest` | Lets the app be added to a phone's home screen. |
| `data/routes.json` | Route history, rebuilt monthly by `tools/make-routes.py` in the "Route history" GitHub Action. |
| `sheet-sync.gs.txt` | Apps Script to paste into the Google Sheet so the log can sync to it. |

On-phone reading uses [Tesseract.js](https://github.com/naptha/tesseract.js), loaded only when a screenshot is uploaded.
