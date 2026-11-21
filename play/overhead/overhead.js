/* Overhead: the planes above you, from community ADS-B feeds. No framework.
   Location, saved places and range stay in this browser's localStorage (ov.last, ov.places, ov.radius). */
(function () {
  'use strict';

  var view = document.getElementById('ov-view');
  if (!view) return;

  var POLL_MS = 20000;
  var RANGES = [2, 5, 10];
  var RINGS = { 2: [1, 2], 5: [1, 3, 5], 10: [2, 5, 10] };
  var FEED_URL = 'https://opensky-network.org/api/states/all';
  var GEO_URL = 'https://nominatim.openstreetmap.org/';

  var AIRLINES = {
    AAL: 'American Airlines', AAY: 'Allegiant Air', ACA: 'Air Canada', AFR: 'Air France', AMX: 'Aeroméxico', ANA: 'All Nippon Airways',
    ANZ: 'Air New Zealand', ASA: 'Alaska Airlines', BAW: 'British Airways', CAL: 'China Airlines', CCA: 'Air China', CES: 'China Eastern',
    CMP: 'Copa Airlines', CPA: 'Cathay Pacific', CSN: 'China Southern', DAL: 'Delta Air Lines', DLH: 'Lufthansa', EDV: 'Endeavor Air',
    EIN: 'Aer Lingus', ENY: 'Envoy Air', EVA: 'EVA Air', FDX: 'FedEx', FFT: 'Frontier Airlines', GTI: 'Atlas Air', HAL: 'Hawaiian Airlines',
    JAL: 'Japan Airlines', JBU: 'JetBlue', JZA: 'Jazz', KAL: 'Korean Air', KLM: 'KLM', MXY: 'Breeze Airways', NKS: 'Spirit Airlines',
    PAL: 'Philippine Airlines', QFA: 'Qantas', QTR: 'Qatar Airways', QXE: 'Horizon Air', RPA: 'Republic Airways', SCX: 'Sun Country',
    SIA: 'Singapore Airlines', SKW: 'SkyWest', SWA: 'Southwest', SWR: 'Swiss', THY: 'Turkish Airlines', UAE: 'Emirates', UAL: 'United Airlines',
    UPS: 'UPS', VIR: 'Virgin Atlantic', VJA: 'Volaris', VOI: 'Volaris', VXP: 'Avelo Airlines', WJA: 'WestJet', AIC: 'Air India',
    ETD: 'Etihad', SAS: 'SAS', FIN: 'Finnair', IBE: 'Iberia', LAN: 'LATAM', AVA: 'Avianca', CXA: 'Xiamen Air', SVA: 'Saudia', ABX: 'ABX Air',
    ASH: 'Mesa Airlines', PDT: 'Piedmont', JIA: 'PSA Airlines', CPZ: 'Compass Airlines', GJS: 'GoJet', EJA: 'NetJets', LXJ: 'Flexjet', XOJ: 'XO'
  };
    var DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  var DIRS_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var PLANE_PATH = 'M12 2c.8 0 1.3.9 1.3 2v5l7.7 4.5v2l-7.7-2.3v4.6l2.4 1.8V21L12 20l-3.7 1v-1.4l2.4-1.8v-4.6L3 15.5v-2L10.7 9V4c0-1.1.5-2 1.3-2z';

  /* ---------- storage ---------- */
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var S = {
    view: 'home', tab: 'radar',
    loc: load('ov.last', null),
    radius: RANGES.indexOf(load('ov.radius', 5)) >= 0 ? load('ov.radius', 5) : 5,
    places: load('ov.places', []),
    planes: [], updated: 0, feed: '', error: '', loaded: false,
    detail: null, lastDetail: null,
    results: null, searchMsg: '', locating: false, locMsg: '', naming: false, returnKey: null
  };
  if (!Array.isArray(S.places)) S.places = [];
  if (S.loc && !(isFinite(S.loc.lat) && isFinite(S.loc.lon))) S.loc = null;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return Math.round(n).toLocaleString('en-US'); }
  function rad(d) { return d * Math.PI / 180; }
  function track(ev, data) { try { if (window.umami && window.umami.track) window.umami.track(ev, data); } catch (e) {} }
  function distMi(a, b, c, d) {
    var R = 3958.8, dLat = rad(c - a), dLon = rad(d - b);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function bearing(a, b, c, d) {
    var y = Math.sin(rad(d - b)) * Math.cos(rad(c));
    var x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function dirIdx(b) { return Math.round(b / 45) % 8; }
  function operator(cs) {
    if (/^N\d/.test(cs)) return 'Private plane';
    var m = /^([A-Z]{3})\d/.exec(cs);
    return m && AIRLINES[m[1]] ? AIRLINES[m[1]] : '';
  }
  function lookPhrase(p) {
    var where = 'Look ' + DIRS[dirIdx(p.brg)];
    if (p.elev >= 75) return 'Almost straight up';
    if (p.elev < 8) return where + ', low on the horizon';
    return where + ', about ' + Math.round(p.elev) + '° up';
  }
  function vertStat(vr) {
    if (vr == null || Math.abs(vr) < 300) return ['Climb', 'Level'];
    return [vr > 0 ? 'Climbing' : 'Descending', num(Math.abs(vr)) + ' ft/min'];
  }
  function arrow(vr) { return vr == null || Math.abs(vr) < 300 ? '' : (vr > 0 ? ' ↑' : ' ↓'); }
  function placeLabel(loc) { return loc ? loc.label || 'Your location' : ''; }
  function rangeText() { return 'within ' + S.radius + ' mi'; }

  /* ---------- the flight feed ----------
     OpenSky Network's state vectors for a small box around you. Anonymous use is free with a daily allowance
     per network (a box this size costs 1 credit per call), and it allows calls straight from a browser. */
  var CATS = { 2: 'Light aircraft', 3: 'Small aircraft', 4: 'Airliner', 5: 'Large airliner', 6: 'Heavy jet', 7: 'High-performance jet', 8: 'Helicopter', 9: 'Glider', 10: 'Balloon', 12: 'Ultralight', 14: 'Drone' };
  function normalize(list) {
    var out = [], me = S.loc, now = Date.now() / 1000;
    (list || []).forEach(function (s) {
      if (!Array.isArray(s) || s[5] == null || s[6] == null || s[8]) return;
      if (s[4] && now - s[4] > 60) return;
      var altM = typeof s[7] === 'number' ? s[7] : (typeof s[13] === 'number' ? s[13] : null);
      if (altM == null) return;
      var alt = altM * 3.28084;
      if (alt < 50) return;
      var lat = s[6], lon = s[5], d = distMi(me.lat, me.lon, lat, lon);
      if (d > S.radius) return;
      var hex = String(s[0] || '').toLowerCase();
      var cs = String(s[1] || '').trim() || hex.toUpperCase();
      var cat = s[17];
      out.push({
        hex: hex || cs, cs: cs, country: s[2] || '', type: CATS[cat] || 'Aircraft',
        op: operator(cs), small: cat === 2 || cat === 3 || cat === 9 || cat === 12, heli: cat === 8,
        lat: lat, lon: lon, alt: alt, gs: typeof s[9] === 'number' ? s[9] * 1.94384 : null, trk: typeof s[10] === 'number' ? s[10] : 0,
        vr: typeof s[11] === 'number' ? s[11] * 196.85 : null, dist: d, brg: bearing(me.lat, me.lon, lat, lon),
        elev: Math.atan2(alt, Math.max(d * 5280, 1)) * 180 / Math.PI
      });
    });
    out.sort(function (x, y) { return x.dist - y.dist; });
    return out;
  }

  function get(url, opts, ms) {
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 10000) : 0;
    var o = opts || {}; if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (r) {
      clearTimeout(t);
      if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    }, function (e) { clearTimeout(t); throw e; });
  }

  var pollTimer = 0, polling = false, gen = 0;
  function schedule(ms) { clearTimeout(pollTimer); pollTimer = setTimeout(poll, ms == null ? POLL_MS : ms); }

  /* A new place or range starts a fresh poll; answers to an older one are dropped. */
  function restart() { gen++; polling = false; clearTimeout(pollTimer); poll(); }

  function box() {
    var pad = S.radius + 0.5, dLat = pad / 69, dLon = pad / (69 * Math.max(Math.cos(rad(S.loc.lat)), 0.1));
    var f = function (n) { return n.toFixed(3); };
    return 'lamin=' + f(S.loc.lat - dLat) + '&lomin=' + f(S.loc.lon - dLon) + '&lamax=' + f(S.loc.lat + dLat) + '&lomax=' + f(S.loc.lon + dLon);
  }

  function poll() {
    if (!S.loc || polling) return;
    if (document.hidden) { schedule(); return; }
    polling = true;
    var mine = gen;
    get(FEED_URL + '?extended=1&' + box()).then(function (data) {
      if (mine !== gen) return;
      if (!data || typeof data !== 'object' || !('states' in data)) throw new Error('bad shape');
      polling = false;
      S.planes = normalize(data.states || []); S.updated = Date.now(); S.feed = 'OpenSky Network'; S.error = ''; S.loaded = true;
      update(); schedule();
    }).catch(function (e) {
      if (mine !== gen) return;
      polling = false; S.loaded = true;
      if (e && e.status === 429) {
        S.error = 'The free flight feed’s daily allowance is used up on this network. It resets overnight (UTC). Checking again in 10 minutes.';
        update(); schedule(600000);
      } else {
        S.error = 'Couldn’t reach the flight feed. Trying again in 30 seconds.';
        update(); schedule(30000);
      }
    });
  }

  /* ---------- location ---------- */
  function setLoc(loc, how) {
    S.loc = { lat: +loc.lat, lon: +loc.lon, label: loc.label || 'Your location', kind: loc.kind || how, placeId: loc.placeId || null };
    save('ov.last', S.loc);
    S.planes = []; S.loaded = false; S.error = ''; S.results = null; S.searchMsg = ''; S.locMsg = ''; S.naming = false;
    track('overhead-location', { how: how });
    go('home');
    restart();
  }

  function useGps(quiet) {
    if (!('geolocation' in navigator)) { S.locMsg = 'This browser can’t share your location. Type an address instead.'; render(); return; }
    S.locating = !quiet; S.locMsg = ''; if (!quiet) render();
    navigator.geolocation.getCurrentPosition(function (pos) {
      S.locating = false;
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      var prev = S.loc && S.loc.kind === 'gps' ? S.loc.label : '';
      if (quiet) {
        S.loc = { lat: lat, lon: lon, label: prev || 'Your location', kind: 'gps', placeId: null }; save('ov.last', S.loc); restart();
      } else setLoc({ lat: lat, lon: lon, label: 'Your location', kind: 'gps' }, 'gps');
      nameSpot(lat, lon);
    }, function (err) {
      S.locating = false;
      if (quiet) return;
      S.locMsg = err && err.code === 1 ? 'Location is turned off for this site. Allow it in your browser settings, or type an address.' : 'Couldn’t find your location. Try again, or type an address.';
      render();
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  }

  function nameSpot(lat, lon) {
    get(GEO_URL + 'reverse?format=jsonv2&zoom=14&lat=' + lat.toFixed(3) + '&lon=' + lon.toFixed(3), { headers: { 'Accept-Language': 'en' } }).then(function (r) {
      var a = (r && r.address) || {};
      var spot = a.neighbourhood || a.suburb || a.quarter || a.village || a.town || a.city || '';
      if (spot && S.loc && S.loc.kind === 'gps') { S.loc.label = spot; save('ov.last', S.loc); update(); }
    }).catch(function () {});
  }

  function shortName(r) {
    var a = r.address || {};
    var first = r.name || [a.house_number, a.road].filter(Boolean).join(' ') || String(r.display_name || '').split(',')[0];
    var town = a.city || a.town || a.village || a.suburb || a.county || '';
    return town && town !== first ? first + ', ' + town : first;
  }

  function search(q) {
    q = q.trim();
    if (!q) return;
    S.searchMsg = 'Searching…'; S.results = null; render();
    get(GEO_URL + 'search?format=jsonv2&addressdetails=1&limit=5&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'en' } }).then(function (res) {
      S.results = (Array.isArray(res) ? res : []).map(function (r) { return { lat: +r.lat, lon: +r.lon, label: shortName(r), full: r.display_name || '' }; });
      S.searchMsg = S.results.length ? '' : 'Nothing found for that. Try adding a city or ZIP.';
      render('ov-r0');
    }).catch(function () { S.searchMsg = 'Address search isn’t responding. Try again in a moment.'; render(); });
  }

  /* ---------- views ---------- */
  var icon = {
    pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/></svg>',
    gps: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'
  };
  function planeSvg(size, trk) { return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(' + Math.round(trk) + 'deg)"><path fill="currentColor" d="' + PLANE_PATH + '"/></svg>'; }

  function liveChip() {
    if (!S.loaded) return '<span class="ov-live stale"><span class="dot" aria-hidden="true"></span>Looking…</span>';
    var n = S.planes.length, age = (Date.now() - S.updated) / 1000;
    var stale = S.error || age > 35;
    return '<span class="ov-live' + (stale ? ' stale' : '') + '"><span class="dot" aria-hidden="true"></span>' + (stale ? 'Not live' : 'Live') + ' · ' + n + (n === 1 ? ' plane' : ' planes') + '</span>';
  }

  function scopeSvg() {
    var rings = (RINGS[S.radius] || []).map(function (v) {
      var r = v / S.radius * 46;
      return '<circle class="ring" cx="50" cy="50" r="' + r.toFixed(2) + '"/><text class="tick" x="51.2" y="' + (50 + r - 1.4).toFixed(2) + '">' + v + ' mi</text>';
    }).join('');
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="face" cx="50" cy="50" r="48.5"/>' +
      '<line class="axis" x1="50" y1="2" x2="50" y2="98"/><line class="axis" x1="2" y1="50" x2="98" y2="50"/>' + rings +
      '<text class="north" x="48.4" y="7">N</text><circle class="me-halo" cx="50" cy="50" r="3.6"/><circle class="me" cx="50" cy="50" r="1.8"/></svg>';
  }

  function blipPos(p) {
    var r = Math.min(p.dist / S.radius, 1) * 46, b = rad(p.brg);
    return { left: 50 + Math.sin(b) * r, top: 50 - Math.cos(b) * r };
  }
  function syncBlips() {
    var layer = view.querySelector('.ov-scope');
    if (!layer) return;
    var seen = {};
    S.planes.forEach(function (p, i) {
      seen[p.hex] = 1;
      var el = layer.querySelector('[data-hex="' + p.hex + '"]');
      if (!el) {
        el = document.createElement('button');
        el.type = 'button'; el.className = 'ov-pl'; el.setAttribute('data-hex', p.hex); el.setAttribute('data-act', 'plane'); el.setAttribute('data-focus', 'pl-' + p.hex);
        layer.appendChild(el);
      }
      var hi = i === 0, size = hi ? 26 : (p.small || p.heli ? 16 : 21), pos = blipPos(p);
      el.classList.toggle('hi', hi);
      el.style.left = pos.left.toFixed(2) + '%'; el.style.top = pos.top.toFixed(2) + '%';
      el.innerHTML = planeSvg(size, p.trk) + '<span>' + esc(p.cs) + '</span>';
      el.setAttribute('aria-label', p.cs + ', ' + num(p.alt) + ' feet, ' + p.dist.toFixed(1) + ' miles ' + DIRS[dirIdx(p.brg)] + (hi ? ', closest' : ''));
    });
    Array.prototype.slice.call(layer.querySelectorAll('.ov-pl')).forEach(function (el) { if (!seen[el.getAttribute('data-hex')]) el.remove(); });
  }

  function closestCard() {
    var p = S.planes[0];
    if (!S.loaded) return '<p class="ov-empty">Checking the sky…</p>';
    if (!p) return '<p class="ov-empty">No planes ' + rangeText() + ' right now.<br>Try a wider range, or check back in a minute.</p>';
    return '<button type="button" class="ov-card" data-act="plane" data-hex="' + esc(p.hex) + '" data-focus="card">' +
      '<span class="row"><span class="k">Closest to you</span><span class="sub">' + p.dist.toFixed(1) + ' mi ' + DIRS_SHORT[dirIdx(p.brg)] + '</span></span>' +
      '<span class="row"><span class="cs">' + esc(p.cs) + '</span></span>' +
      '<span class="meta">' + (p.op ? '<span>' + esc(p.op) + '</span>' : '') + '<span>' + esc(p.type) + '</span><span>' + num(p.alt) + ' ft' + arrow(p.vr) + '</span>' + (p.gs != null ? '<span>' + Math.round(p.gs) + ' kt</span>' : '') + '</span>' +
      '<span class="look">' + icon.eye + esc(lookPhrase(p)) + '</span></button>';
  }

  function listHtml() {
    if (!S.loaded) return '<p class="ov-empty">Checking the sky…</p>';
    if (!S.planes.length) return '<p class="ov-empty">No planes ' + rangeText() + ' right now.<br>Try a wider range, or check back in a minute.</p>';
    return '<p class="ov-lbl">Nearest first</p><ul class="ov-list">' + S.planes.map(function (p, i) {
      return '<li><button type="button" class="ov-row' + (i === 0 ? ' hi' : '') + '" data-act="plane" data-hex="' + esc(p.hex) + '" data-focus="row-' + esc(p.hex) + '">' +
        '<span class="cs">' + esc(p.cs) + '</span><span class="rt">' + p.dist.toFixed(1) + ' mi ' + DIRS_SHORT[dirIdx(p.brg)] + '</span>' +
        '<span class="ty">' + esc(p.op ? p.op + ' · ' + p.type : p.type) + '</span>' +
        '<span class="ad">' + num(p.alt) + ' ft' + arrow(p.vr) + '</span></button></li>';
    }).join('') + '</ul>';
  }

  function homeHtml() {
    var tabs = '<div class="ov-tabs" role="tablist" aria-label="View">' +
      '<button type="button" role="tab" data-act="tab" data-tab="radar" data-focus="tab-radar" aria-selected="' + (S.tab === 'radar') + '">Radar</button>' +
      '<button type="button" role="tab" data-act="tab" data-tab="list" data-focus="tab-list" aria-selected="' + (S.tab === 'list') + '">List</button></div>';
    var body = S.tab === 'radar'
      ? '<div class="ov-scope" role="group" aria-label="Planes around you, north up">' + scopeSvg() + '</div><div class="ov-slot" id="ov-card">' + closestCard() + '</div>'
      : '<div class="ov-slot" id="ov-list">' + listHtml() + '</div>';
    return '<div class="ov-top"><button type="button" class="ov-where" data-act="where" data-focus="where" aria-label="Change location: ' + esc(placeLabel(S.loc)) + ', ' + rangeText() + '">' +
      icon.pin + '<span><b>' + esc(placeLabel(S.loc)) + '</b> · ' + rangeText() + '</span>' + icon.chev + '</button><span id="ov-chip">' + liveChip() + '</span></div>' +
      (S.error ? '<p class="ov-err">' + esc(S.error) + '</p>' : '') + tabs + body +
      (S.loaded && S.feed ? '<p class="ov-cap">Positions from ' + esc(S.feed) + ', every 20 seconds.</p>' : '');
  }

  function detailHtml() {
    var p = null;
    for (var i = 0; i < S.planes.length; i++) if (S.planes[i].hex === S.detail) p = S.planes[i];
    var gone = !p;
    if (p) S.lastDetail = p; else p = S.lastDetail;
    var back = '<button type="button" class="ov-back" data-act="home" data-focus="back">' + icon.back + 'Back</button>';
    if (!p) return back + '<p class="ov-empty">That plane is out of range now.</p>';
    var ix = dirIdx(p.brg);
    var compass = '<svg class="ov-compass" viewBox="0 0 92 92" role="img" aria-label="Compass pointing ' + DIRS[ix] + '"><circle class="face" cx="46" cy="46" r="44"/><text class="n" x="43" y="14">N</text>' +
      '<line class="needle" x1="46" y1="46" x2="46" y2="16" transform="rotate(' + Math.round(p.brg) + ' 46 46)"/><circle class="hub" cx="46" cy="46" r="5"/></svg>';
    var stats = [
      ['Altitude', num(p.alt) + ' ft'], vertStat(p.vr),
      ['Speed', p.gs != null ? Math.round(p.gs) + ' kt' : '—'], ['Heading', Math.round(p.trk) + '°'],
      ['Distance', p.dist.toFixed(1) + ' mi ' + DIRS_SHORT[ix]], ['Registered in', p.country || '—']
    ].map(function (s) { return '<div><dt>' + s[0] + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('');
    return back +
      '<div><h2 class="ov-h ov-mono" tabindex="-1" id="ov-vh">' + esc(p.cs) + '</h2><p class="ov-intro">' + esc([p.op, p.type].filter(Boolean).join(' · ')) + '</p></div>' +
      (gone ? '<p class="ov-err">Out of range now. Showing where it was last seen.</p>' : '') +
      '<div class="ov-card ov-lookcard">' + compass + '<div><p class="ov-lbl">Where to look</p><b>' + esc(lookPhrase(p)) + '</b><p>' + (p.elev >= 75 || p.elev < 8 ? 'Face ' + DIRS[ix] + '.' : 'Face ' + DIRS[ix] + ', then tilt your head up about ' + (p.elev < 27 ? 'a quarter' : p.elev < 40 ? 'a third' : p.elev < 58 ? 'half' : 'two thirds') + ' of the way from the horizon to straight overhead.') + '</p></div></div>' +
      '<dl class="ov-stats">' + stats + '</dl>';
  }

  function whereHtml(first) {
    var cur = S.loc;
    var places = S.places.length ? '<ul class="ov-places">' + S.places.map(function (pl) {
      var on = cur && cur.placeId === pl.id;
      return '<li class="ov-place' + (on ? ' on' : '') + '"><button type="button" class="pick" data-act="place" data-id="' + esc(pl.id) + '" data-focus="pl-' + esc(pl.id) + '" aria-pressed="' + !!on + '"><b>' + esc(pl.name) + '</b><small>' + esc(pl.label) + '</small></button>' +
        (on ? '<span class="ck">' + icon.check + '</span>' : '') +
        '<button type="button" class="x" data-act="unsave" data-id="' + esc(pl.id) + '" aria-label="Remove ' + esc(pl.name) + '">' + icon.x + '</button></li>';
    }).join('') + '</ul>' : '<p class="ov-cap">No saved places yet. Pick a spot, then save it with a name like Home.</p>';
    var canSave = cur && !cur.placeId;
    var saveUi = canSave ? (S.naming
      ? '<form class="ov-form" data-form="name"><label for="ov-name">Name this place</label><div class="ov-field"><input id="ov-name" name="n" maxlength="30" autocomplete="off" placeholder="Home, Work, the cabin…" required><button class="ov-btn sm" type="submit">Save</button></div></form>'
      : '<button type="button" class="ov-btn ghost" data-act="name" data-focus="saveplace">+ Save ' + esc(placeLabel(cur)) + '</button>') : '';
    var results = S.results && S.results.length ? '<ul class="ov-results">' + S.results.map(function (r, i) {
      return '<li><button type="button" data-act="result" data-i="' + i + '" data-focus="ov-r' + i + '">' + esc(r.full || r.label) + '</button></li>';
    }).join('') + '</ul>' : '';
    var radius = '<div class="ov-radius" role="radiogroup" aria-label="Show planes within">' + RANGES.map(function (n) {
      return '<button type="button" role="radio" data-act="radius" data-r="' + n + '" data-focus="r' + n + '" aria-checked="' + (S.radius === n) + '">' + n + ' mi</button>';
    }).join('') + '</div>';
    return (first ? '<p class="ov-intro">See the planes flying above you right now, and where in the sky to look for each one.</p>'
                  : '<button type="button" class="ov-back" data-act="home" data-focus="back">' + icon.back + 'Back</button><h2 class="ov-h" tabindex="-1" id="ov-vh">Set location</h2>') +
      '<button type="button" class="ov-btn" data-act="gps" data-focus="gps"' + (S.locating ? ' disabled' : '') + '>' + icon.gps + (S.locating ? 'Finding you…' : 'Use my location') + '</button>' +
      (S.locMsg ? '<p class="ov-err" role="alert">' + esc(S.locMsg) + '</p>' : '') +
      '<form class="ov-form" data-form="search" role="search"><label for="ov-q">Or enter an address</label><div class="ov-field"><input id="ov-q" name="q" type="search" autocomplete="street-address" placeholder="Street, city or ZIP" enterkeyhint="search"><button class="ov-btn sm ghost" type="submit">Find</button></div></form>' +
      (S.searchMsg ? '<p class="ov-cap" role="status">' + esc(S.searchMsg) + '</p>' : '') + results +
      '<div class="ov-sec"><p class="ov-lbl">Saved places</p>' + places + saveUi + '</div>' +
      '<div class="ov-sec"><p class="ov-lbl">Show planes within</p>' + radius + '</div>' +
      '<p class="ov-cap">Your location and saved places stay in this browser. Only a box around your rough position is sent to the flight feed.</p>';
  }

  /* ---------- render ---------- */
  function focusKey() { var a = document.activeElement; return a && view.contains(a) ? a.getAttribute('data-focus') : null; }
  function restore(key) { if (!key) return; var el = view.querySelector('[data-focus="' + key + '"]'); if (el) el.focus({ preventScroll: true }); }

  function render(focus) {
    var key = focus || focusKey();
    var first = !S.loc;
    var html = first || S.view === 'where' ? whereHtml(first) : S.view === 'detail' ? detailHtml() : homeHtml();
    view.innerHTML = html;
    if (!first && S.view === 'home' && S.tab === 'radar') syncBlips();
    if (focus === 'heading') { var h = document.getElementById('ov-vh'); if (h) h.focus({ preventScroll: true }); }
    else restore(key);
  }

  /* Live refresh without rebuilding the page, so focus and scroll stay put. */
  function update() {
    if (!S.loc) return;
    if (S.view === 'detail') { render(); return; }
    if (S.view !== 'home') return;
    var key = focusKey();
    var chip = document.getElementById('ov-chip');
    if (!chip) { render(); return; }
    chip.innerHTML = liveChip();
    var w = view.querySelector('.ov-where b');
    if (w && w.textContent !== placeLabel(S.loc)) { render(); return; }
    var err = view.querySelector('.ov-err');
    if (!!err !== !!S.error) { render(); return; }
    if (err) err.textContent = S.error;
    if (S.tab === 'radar') { syncBlips(); var c = document.getElementById('ov-card'); if (c) c.innerHTML = closestCard(); }
    else { var l = document.getElementById('ov-list'); if (l) l.innerHTML = listHtml(); }
    var cap = view.querySelector('.ov-cap');
    if (cap && S.feed) cap.textContent = 'Positions from ' + S.feed + ', every 20 seconds.';
    else if (!cap && S.feed) render();
    restore(key);
  }

  function go(v) {
    if (v !== 'home') S.returnKey = focusKey();
    S.view = v;
    if (v === 'home') { render(S.returnKey); S.returnKey = null; window.scrollTo({ top: 0 }); }
    else { render('heading'); window.scrollTo({ top: 0 }); }
  }

  /* ---------- events ---------- */
  view.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || !view.contains(b)) return;
    var act = b.getAttribute('data-act');
    if (act === 'tab') { S.tab = b.getAttribute('data-tab'); render('tab-' + S.tab); }
    else if (act === 'plane') { S.detail = b.getAttribute('data-hex'); S.lastDetail = null; go('detail'); }
    else if (act === 'home') go('home');
    else if (act === 'where') { S.results = null; S.searchMsg = ''; S.locMsg = ''; S.naming = false; go('where'); }
    else if (act === 'gps') useGps(false);
    else if (act === 'result') { var r = S.results && S.results[+b.getAttribute('data-i')]; if (r) setLoc({ lat: r.lat, lon: r.lon, label: r.label, kind: 'address' }, 'address'); }
    else if (act === 'place') { var p = S.places.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0]; if (p) setLoc({ lat: p.lat, lon: p.lon, label: p.name, kind: 'place', placeId: p.id }, 'place'); }
    else if (act === 'unsave') {
      var id = b.getAttribute('data-id');
      S.places = S.places.filter(function (x) { return x.id !== id; }); save('ov.places', S.places);
      if (S.loc && S.loc.placeId === id) { S.loc.placeId = null; save('ov.last', S.loc); }
      render('gps');
    }
    else if (act === 'name') { S.naming = true; render(); var n = document.getElementById('ov-name'); if (n) n.focus(); }
    else if (act === 'radius') {
      S.radius = +b.getAttribute('data-r'); save('ov.radius', S.radius);
      S.planes = []; S.loaded = false; render('r' + S.radius); if (S.loc) restart();
    }
  });

  view.addEventListener('submit', function (e) {
    var f = e.target.closest('form'); if (!f) return;
    e.preventDefault();
    if (f.getAttribute('data-form') === 'search') search(f.elements.q.value);
    else if (f.getAttribute('data-form') === 'name') {
      var name = f.elements.n.value.trim(); if (!name || !S.loc) return;
      var id = 'p' + Date.now().toString(36);
      S.places.push({ id: id, name: name.slice(0, 30), label: S.loc.label, lat: +S.loc.lat.toFixed(4), lon: +S.loc.lon.toFixed(4) });
      save('ov.places', S.places);
      S.loc.placeId = id; S.loc.label = name.slice(0, 30); save('ov.last', S.loc);
      S.naming = false; render('pl-' + id);
    }
  });

  /* Arrow keys move between Radar/List and between ranges, like native tabs and radios. */
  view.addEventListener('keydown', function (e) {
    var b = e.target.closest('[role="tab"], [role="radio"]');
    if (b && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
      var sibs = Array.prototype.slice.call(b.parentNode.querySelectorAll('[role="' + b.getAttribute('role') + '"]'));
      var i = sibs.indexOf(b) + (/Left|Up/.test(e.key) ? -1 : 1);
      var t = sibs[(i + sibs.length) % sibs.length]; e.preventDefault(); t.click();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.loc && S.view !== 'home') {
      if (S.naming) { S.naming = false; render(); return; }
      go('home');
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && S.loc && Date.now() - S.updated > POLL_MS) poll();
  });
  setInterval(function () { var c = document.getElementById('ov-chip'); if (c && S.view === 'home') c.innerHTML = liveChip(); }, 5000);

  /* ---------- start ---------- */
  render();
  if (S.loc) {
    poll();
    if (S.loc.kind === 'gps' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(function (p) { if (p.state === 'granted') useGps(true); }).catch(function () {});
    }
  }
})();
