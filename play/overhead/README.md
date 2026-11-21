# Overhead

The planes flying above you right now, and where in the sky to look for each one. Lives at [/play/overhead/](https://www.scarletthao.me/play/overhead/).

## What it does

- **Radar:** a north-up scope with you in the middle and the planes around you, each pointing the way it's flying. The closest one is highlighted and gets a card underneath.
- **List:** the same planes, nearest first, with route, type, altitude trend and direction.
- **Plane detail:** route, airline and type, altitude, climb or descent, speed, heading, distance and registration, plus a compass that says which way to face and how far up to look.
- **Location:** your phone's location, a typed address, or a saved place. Range of 2, 5 or 10 miles.

## Data

- Positions: the free, keyless ADS-B feeds from [adsb.lol](https://adsb.lol) (`/v2/point/{lat}/{lon}/{nm}`), with [airplanes.live](https://airplanes.live) and [adsb.fi](https://adsb.fi) as fallbacks. Polled every 10 seconds while the page is visible. Planes on the ground are left out.
- Routes: adsb.lol's route lookup (`POST /api/0/routeset`), best effort. ADS-B carries a callsign, not an itinerary, so routes can be missing or stale.
- Addresses: [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap), only when you search, plus one reverse lookup to name the neighborhood when you use your location.
- Airline names come from a short built-in list of ICAO callsign prefixes.

## Where to look

Direction is the initial great-circle bearing from you to the plane. The angle up is `atan(altitude / ground distance)`, using barometric altitude and treating the ground as sea level, which is close enough to spot a plane.

## Privacy

Your location, saved places and range live only in this browser's localStorage (`ov.last`, `ov.places`, `ov.radius`). Nothing personal is in this code. Coordinates sent to the flight feed are rounded to three decimals (about 100 m).
Umami gets one anonymous event when a location is set (`overhead-location`, with how: gps, address or place), never coordinates or text.

## Files

- `index.html`: page shell, header, footer, How it's built
- `overhead.js`: the app (no framework)
- `overhead.css`: styles, using the site's tokens
