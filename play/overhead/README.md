# Overhead

The planes flying above you right now, and where in the sky to look for each one. Lives at [/play/overhead/](https://www.scarletthao.me/play/overhead/).

## What it does

- **Radar:** a north-up scope with you in the middle and the planes around you, each pointing the way it's flying. The closest one is highlighted and gets a card underneath.
- **List:** the same planes, nearest first, with airline, kind of plane, altitude trend and direction.
- **Plane detail:** airline and kind of plane, altitude, climb or descent, speed, heading, distance and country of registration, plus a compass that says which way to face and how far up to look.
- **Location:** your phone's location, a typed address, or a saved place. Range of 2, 5 or 10 miles.

## Data

- Positions: the [OpenSky Network](https://opensky-network.org) REST API, `GET /api/states/all?extended=1&lamin&lomin&lamax&lomax`, called from the browser with no account. A box this size costs 1 credit; anonymous use gets about 400 credits a day per IP, so the page polls every 20 seconds while visible and backs off 10 minutes on a 429.
- Why not adsb.lol, airplanes.live or adsb.fi: they don't send CORS headers (or block browser apps), so a static page can't call them without a relay. Switched 2026-11-20.
- No routes: ADS-B carries a callsign, not an itinerary, and there's no free route lookup a browser can call.
- Kind of plane comes from OpenSky's emitter category (light, small, airliner, heavy, helicopter…). Airline names come from a short built-in list of ICAO callsign prefixes.
- Addresses: [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap), only when you search, plus one reverse lookup to name the neighborhood when you use your location.

## Where to look

Direction is the initial great-circle bearing from you to the plane. The angle up is `atan(altitude / ground distance)`, using barometric altitude and treating the ground as sea level, which is close enough to spot a plane.

## Privacy

Your location, saved places and range live only in this browser's localStorage (`ov.last`, `ov.places`, `ov.radius`). Nothing personal is in this code. The flight feed gets a box padded half a mile beyond the range, rounded to three decimals.
Umami gets one anonymous event when a location is set (`overhead-location`, with how: gps, address or place), never coordinates or text.

## Files

- `index.html`: page shell, header, footer, How it's built
- `overhead.js`: the app (no framework)
- `overhead.css`: styles, using the site's tokens
