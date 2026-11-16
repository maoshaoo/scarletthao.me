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

## Watching flights over time

Every flight read from a screenshot is saved to the log right away, as a snapshot with the date and time it was checked. Fixing a number updates that snapshot instead of adding a new one.

- Snapshots of the same flight on the same date form a timeline, such as "Polaris 18 → 12, filling up".
- Upcoming flights with good odds stay on the home screen.
- Across your timelines for a route, the app works out how many seats tend to open or disappear each day before departure, preferring the same month. That note appears on the check screen and the place card, so a future trip to Seoul in November starts with what you saw this time.

## Getting home

A trip is only a go if you can get back. When you check a flight out and add the day you'd come back, the app gives a round-trip verdict:

- **Go:** your flight home (checked seats, or the forecast if you haven't checked) looks open.
- **Go, with a backup:** coming home looks tight, but the day after looks open or there are at least two flights home over the two days. Only when you can stay an extra day.
- **Hold:** getting there or getting home looks unlikely, or it's tight and you need to be back that day.
- **Check your way home:** no return date yet.

Places and picks also show the odds going and coming back, and roughly how many flights home there are. Good time to go needs room in both directions. Two days before a return date, the trip card reminds you to screenshot your flight home.

## Base camps

Settings take a home airport and, optionally, a second base camp with the months you're there. The home screen then shows a Base camp switch: either airport, or Auto, which picks by today's month. Open the app once with `?alt=XXX&altm=4-5` to set the second base camp on a phone. It's stored only on that device, never in the code.

When there's no nonstop, the forecast uses the best connection through a United hub (EWR, IAD, ORD, IAH, DEN, LAX, SFO): as full as the fuller leg, as frequent as the rarer one, with a small penalty for the extra chance to be bumped.

## Good time to go

`data/seasons.json` is a hand-written list of good times to visit places United flies to from SFO (weather and what's on). The app pairs it with the route history: a place is a pick for a month only if it's in season and its flights usually run 82% full or less that month. Rarely served routes rank lower, since a bump there means no backup flight.

## How the forecast works

It's an estimate, never a seat count. Each travel day gets a score from:

- **Route history:** how full United's flights on that route ran in that month, from public U.S. Department of Transportation data (T-100), averaged over recent years, plus how many flights a day United runs.
- **Day of week:** Tuesday, Wednesday and Saturday are usually lighter; Friday and Sunday are heavier.
- **Holiday peaks:** Thanksgiving, the December holidays, three-day weekends, July 4th week and spring break count against a date.
- **Our own log:** the seats to spare we actually saw on that route.

A round trip scores as its weaker leg, since getting home matters as much as getting there.

## Privacy

Visitors start with no places. Opening the app once with `?me` marks that phone as Scarlett's, which turns on her starter places (Japan, Seoul, Cabo); `?me=off` turns it back off. The log of tracked flights always stays on the phone that saved it.

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
