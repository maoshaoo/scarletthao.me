# Gift Gym

Getting better at gifts, as a habit. Lives at [/play/gift-gym/](https://www.scarletthao.me/play/gift-gym/).

## What it does

- **Warm-up:** a made-up person each day (relationship, hobby, quirk, budget, occasion). Three ideas in 60 seconds, each from one of six angles, then example answers to compare. Keeps a daily streak.
- **Clues:** save what people say or do that hints at a gift, in two taps.
- **People:** their dates, clues, ideas (tagged with an angle) and past gifts with how they landed.
- **Countdown:** each date starts three weeks out. Pick by two weeks, buy by ten days, write the card two days before. Shared dates (like everyone's holidays) collapse into one card.
- **Debrief:** after a date with a picked gift, rate how it landed. It becomes a past gift.

## The six angles

Upgrade, Fix, Treat, Together, Callback, Their thing.

## Privacy

People, clues, ideas and gifts live only in the browser's localStorage (`gg.people`, `gg.gym`). Nothing about anyone is in this code.
A private setup link, `?setup=<base64url JSON>`, adds people to one phone: `[{"name":"…","occ":[{"label":"Birthday","md":"MM-DD"}],"clues":["…"]}]`. It merges by name and cleans the address bar.
Umami gets anonymous event counts only (rounds, clues saved, stars), never text.

## Files

- `index.html`: page shell, header, footer, How it's built
- `gift-gym.js`: the app (no framework)
- `gift-gym.css`: styles, using the site's tokens
