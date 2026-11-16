/* Standby Radar: plan standby trips, check real seats from a screenshot, keep a log.
   Everything personal (log, places, sheet link, API key) lives in this browser's storage only.
   Screens: home, know, dice, dicelist, flights, check, log, settings. */
(function () {
  'use strict';
  var app = document.getElementById('app');

  /* ---------- storage ---------- */
  function load(k, d) { try { var v = localStorage.getItem('sr.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('sr.' + k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function track(name, data) { try { if (window.umami) window.umami.track(name, data); } catch (e) {} }

  var DEFAULT_PLACES = [
    { name: 'Japan', codes: ['NRT', 'HND'], days: 5 },
    { name: 'Seoul', codes: ['ICN'], days: 5 },
    { name: 'Cabo', codes: ['SJD'], days: 3 }
  ];
  /* Scarlett view: open the app once with ?me on her phone and it remembers that device.
     Everyone else starts with no places. Tracked flights never leave the device either way. */
  var QS = location.search; // read once: both setup links below clean the address bar
  var me = load('me', false);
  var q = /[?&]me(=off)?(&|$)/.exec(QS);
  if (q) { me = !q[1]; save('me', me); history.replaceState(null, '', location.pathname); }
  var places = load('places', me ? DEFAULT_PLACES : []);
  /* Base camp: the airport trips start from. A second base camp can take over for some months of the year.
     It lives only in this device's settings; open the app once with ?alt=XXX&altm=4-5 to set it. */
  var homeMain = load('home', 'SFO');
  var baseMode = load('base', 'auto'); // auto, main or alt
  var home = homeMain;
  var log = load('log', []);
  var settings = load('settings', { sheetUrl: '', claudeKey: '', model: 'claude-sonnet-5-5' });
  (function () {
    var a = /[?&]alt=([A-Za-z]{3})/.exec(QS), am = /[?&]altm=([\d,-]+)/.exec(QS);
    if (a) { settings.alt = a[1].toUpperCase(); settings.altMonths = am ? monthsOf(am[1]) : []; save('settings', settings); history.replaceState(null, '', location.pathname); }
  })();
  function monthsOf(t) {
    var out = [];
    String(t).split(',').forEach(function (part) { var r = part.split('-').map(Number); if (!r[0]) return; for (var i = r[0]; i <= (r[1] || r[0]); i++) if (i >= 1 && i <= 12 && out.indexOf(i) < 0) out.push(i); });
    return out;
  }
  function monthsText(ms) { return ms.length ? MONTHS_SHORT[ms[0] - 1] + (ms.length > 1 ? '\u2013' + MONTHS_SHORT[ms[ms.length - 1] - 1] : '') : ''; }
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function autoBase() { return settings.alt && (settings.altMonths || []).indexOf(new Date().getMonth() + 1) >= 0 ? settings.alt : homeMain; }
  function resolveBase() { home = !settings.alt ? homeMain : baseMode === 'main' ? homeMain : baseMode === 'alt' ? settings.alt : autoBase(); }
  resolveBase();
  var seasonData = null; // good times to visit, from data/seasons.json
  var routeData = null; // monthly route history (filled from data/routes.json when available)

  /* ---------- dates ---------- */
  var DAY = 864e5;
  function today() { var d = new Date(); d.setHours(12, 0, 0, 0); return d; }
  function addDays(d, n) { return new Date(d.getTime() + n * DAY); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fromIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function fmt(d) { return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }

  /* US holiday travel peaks: the days around these are the hardest to fly standby. */
  function nthWeekday(y, m, wd, n) { var d = new Date(y, m, 1, 12); var off = (wd - d.getDay() + 7) % 7; return new Date(y, m, 1 + off + (n - 1) * 7, 12); }
  function lastWeekday(y, m, wd) { var d = new Date(y, m + 1, 0, 12); var off = (d.getDay() - wd + 7) % 7; return new Date(y, m + 1, -off, 12); }
  function peaks(y) {
    var thx = nthWeekday(y, 10, 4, 4);
    return [
      [addDays(thx, -3), addDays(thx, 4), 'Thanksgiving'],
      [new Date(y, 11, 18, 12), new Date(y + 1, 0, 4, 12), 'the holidays'],
      [addDays(nthWeekday(y, 0, 1, 3), -3), nthWeekday(y, 0, 1, 3), 'MLK weekend'],
      [addDays(nthWeekday(y, 1, 1, 3), -3), nthWeekday(y, 1, 1, 3), "Presidents' Day weekend"],
      [addDays(lastWeekday(y, 4, 1), -3), lastWeekday(y, 4, 1), 'Memorial Day weekend'],
      [new Date(y, 5, 28, 12), new Date(y, 6, 6, 12), 'July 4th week'],
      [addDays(nthWeekday(y, 8, 1, 1), -3), nthWeekday(y, 8, 1, 1), 'Labor Day weekend'],
      [new Date(y, 2, 7, 12), new Date(y, 2, 28, 12), 'spring break']
    ];
  }
  function peakFor(d) {
    var list = peaks(d.getFullYear()).concat(peaks(d.getFullYear() - 1));
    for (var i = 0; i < list.length; i++) if (d >= list[i][0] && d <= list[i][1]) return list[i][2];
    return null;
  }

  /* ---------- forecast ----------
     A rough score per travel day, 0 to 100. It combines:
     day of week (midweek and Saturday are lighter), holiday peaks, monthly route history when present,
     and your own log for that route. It is an estimate, never a seat count. */
  var DOW = [-12, 0, 8, 8, 0, -12, 6]; // Sun..Sat
  function routeKey(a, b) { return a + '-' + b; }
  /* How full a trip runs that month: the nonstop if United flies one, else the best connection through a hub,
     where the trip is as full as its fuller leg and as frequent as its rarer one. */
  var HUBS = ['EWR', 'IAD', 'ORD', 'IAH', 'DEN', 'LAX', 'SFO'];
  function leg(a, b, month) {
    if (!routeData || !routeData.routes) return null;
    var m = String(month + 1), R = routeData.routes, F = routeData.flightsPerDay || {};
    var r = R[routeKey(a, b)];
    if (r && r[m]) return { full: r[m], perDay: (F[routeKey(a, b)] || {})[m] || 0, via: null };
    var best = null;
    HUBS.forEach(function (h) {
      if (h === a || h === b) return;
      var x = R[routeKey(a, h)], y = R[routeKey(h, b)];
      if (!x || !y || !x[m] || !y[m]) return;
      var c = { full: Math.max(x[m], y[m]), perDay: Math.min((F[routeKey(a, h)] || {})[m] || 0, (F[routeKey(h, b)] || {})[m] || 0), via: h };
      if (!best || c.full < best.full) best = c;
    });
    return best;
  }
  function viaName(h) { return (routeData && routeData.names && routeData.names[h]) || h; }
  function myHistory(a, b, dow) {
    var rows = log.filter(function (r) { return r.from === a && r.to === b && r.open !== '' && r.open != null; });
    var same = rows.filter(function (r) { return dow == null || new Date(r.date + 'T12:00').getDay() === dow; });
    var use = same.length >= 2 ? same : rows;
    if (!use.length) return null;
    var spare = use.reduce(function (s, r) { return s + spareOf(r); }, 0) / use.length;
    var made = use.filter(function (r) { return r.result === 'Made it'; }).length;
    var tried = use.filter(function (r) { return r.result === 'Made it' || r.result === 'Bumped'; }).length;
    return { n: use.length, spare: spare, made: made, tried: tried };
  }
  function scoreDay(a, b, d) {
    var s = 58, why = [];
    s += DOW[d.getDay()];
    var pk = peakFor(d);
    if (pk) { s -= 30; why.push(pk); }
    var lg = leg(a, b, d.getMonth());
    if (lg) {
      s += Math.round((0.85 - lg.full) * 120); why.push(Math.round(lg.full * 100) + '% full on average that month' + (lg.via ? ', via ' + viaName(lg.via) : ''));
      if (lg.via) s -= 6; // a connection is two chances to be bumped
      if (lg.perDay) { var n = lg.perDay; s += Math.min(8, Math.round(n * 2)); why.push('about ' + (n >= 1 ? Math.round(n) : 'less than 1') + ' United flight' + (n >= 1.5 ? 's' : '') + ' a day' + (lg.via ? ' on the rarer leg' : '')); }
    }
    var h = myHistory(a, b, d.getDay());
    if (h) { s += Math.max(-25, Math.min(25, Math.round(h.spare * 3))); why.push('your log: ' + h.n + ' check' + (h.n > 1 ? 's' : '') + ', ' + Math.round(h.spare) + ' seats to spare on average'); }
    return { score: Math.max(0, Math.min(100, s)), why: why };
  }
  function band(score) { return score >= 62 ? ['sr-good', 'Likely open'] : score >= 45 ? ['sr-tight', 'Tight'] : ['sr-no', 'Unlikely']; }
  function bestCode(place, d, out) {
    var best = null;
    place.codes.forEach(function (c) { var r = out ? scoreDay(home, c, d) : scoreDay(c, home, d); r.code = c; if (!best || r.score > best.score) best = r; });
    return best;
  }
  function tripScore(place, outD, backD) {
    var o = bestCode(place, outD, true), b = bestCode(place, backD, false);
    return { score: Math.min(o.score, b.score), out: o, back: b };
  }
  function bestTrip(place, start, horizon) {
    var best = null, len = place.days || 4;
    for (var i = 1; i <= horizon; i++) {
      var o = addDays(start, i), b = addDays(o, len - 1), t = tripScore(place, o, b);
      t.outD = o; t.backD = b;
      if (!best || t.score > best.score) best = t;
    }
    return best;
  }

  /* ---------- verdict from real seat counts ---------- */
  /* Seats left after everyone listed ahead of you, and after your whole party is seated.
     Pass riders are usually last in line, so everyone already listed counts as ahead unless you enter your spot. */
  var GOOD_MARGIN = 3;
  function partyOf(r) { return Math.max(1, parseInt(r.party, 10) || 1); }
  function spareOf(r) {
    var open = +r.open || 0, pos = +r.position || 0, listed = +r.listed || 0;
    var ahead = pos ? pos - 1 : listed;
    return open - ahead - partyOf(r);
  }
  function bandSpare(s) { return s >= GOOD_MARGIN ? ['sr-good', 'Good odds', s] : s >= 0 ? ['sr-tight', 'Tight', s] : ['sr-no', 'Unlikely', s]; }
  function verdictOf(r) {
    if (r.open === '' || r.open == null) return null;
    return bandSpare(spareOf(r));
  }
  /* For international flights: will you get on the plane at all, in any cabin? */
  function planeOf(r) {
    if (r.openAll === '' || r.openAll == null) return null;
    return bandSpare((+r.openAll || 0) - (+r.sbAll || 0) - partyOf(r));
  }

  /* International flights count Polaris (business) seats; domestic flights count every open seat. */
  var NON_US = 'NRT HND KIX ICN TPE HKG PVG PEK SIN MNL BKK SYD MEL BNE AKL NAN PPT LHR LGW DUB CDG FRA MUC ZRH AMS FCO MAD BCN LIS ATH TLV DXB DEL BOM JNB YVR YYZ YUL YYC MEX CUN SJD PVR GDL BZE SJO LIR PTY BOG LIM SCL EZE GRU GIG'.split(' ');
  function isIntl(d) {
    var c = routeData && routeData.countries;
    return [d.from, d.to].some(function (x) { if (!x) return false; if (c && c[x]) return c[x] !== 'United States'; return NON_US.indexOf(x) >= 0; });
  }
  function settle(d) {
    var intl = isIntl(d);
    d.cabin = intl ? 'Polaris' : 'All cabins';
    d.open = intl ? (d.openPolaris || '') : (d.openAll || '');
    d.listed = intl ? (d.sbPolaris || '') : (d.sbAll || '');
    return d;
  }

  /* ---------- watching flights over time ----------
     Every screenshot is saved as a snapshot. Snapshots of the same flight on the same date form a timeline,
     which shows whether seats are filling up; across flights, they show a route's pattern. */
  function keyOf(r) { return [r.flight || '?', r.date, r.from, r.to].join('|'); }
  function checkedDay(r) { var d = new Date(r.checked); d.setHours(12, 0, 0, 0); return d; }
  function daysOutOf(r) { return Math.round((fromIso(r.date) - checkedDay(r)) / DAY); }
  function whenChecked(r) { var d = new Date(r.checked); return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
  function timelines() {
    var g = {};
    log.forEach(function (r) { if (r.open === '' || r.open == null) return; (g[keyOf(r)] = g[keyOf(r)] || []).push(r); });
    Object.keys(g).forEach(function (k) { g[k].sort(function (a, b) { return a.checked < b.checked ? -1 : 1; }); });
    return g;
  }
  function trendOf(snaps) {
    var a = snaps[0], z = snaps[snaps.length - 1], label = z.cabin === 'Polaris' ? 'Polaris' : 'Open seats';
    if (snaps.length < 2) return label + ' ' + z.open + ', checked once (' + whenChecked(z) + ')';
    var diff = (+z.open) - (+a.open);
    return label + ' ' + snaps.map(function (x) { return x.open; }).join(' → ') + (diff < 0 ? ', filling up' : diff > 0 ? ', opening up' : ', holding steady') + ' since ' + whenChecked(a).split(' ')[0];
  }
  /* How seats move on a route as departure gets closer, from your own repeated checks. */
  function routePattern(from, to, month) {
    var g = timelines(), rates = [], same = [];
    Object.keys(g).forEach(function (k) {
      var sn = g[k]; if (sn.length < 2 || sn[0].from !== from || sn[0].to !== to) return;
      var a = sn[0], z = sn[sn.length - 1], days = daysOutOf(a) - daysOutOf(z);
      if (days <= 0) return;
      var rate = ((+z.open) - (+a.open)) / days;
      rates.push(rate); if (fromIso(a.date).getMonth() === month) same.push(rate);
    });
    var use = same.length >= 2 ? same : rates;
    if (!use.length) return null;
    var avg = use.reduce(function (x, y) { return x + y; }, 0) / use.length;
    return { n: use.length, perDay: avg, sameMonth: use === same };
  }
  function patternNote(from, to, month) {
    var p = routePattern(from, to, month); if (!p) return '';
    var seats = Math.abs(p.perDay) < 0.5 ? null : Math.round(Math.abs(p.perDay) * 10) / 10;
    var what = seats == null ? 'seats have held fairly steady as departure got closer' : p.perDay < 0 ? 'seats have dropped by about ' + seats + ' a day as departure got closer. They start open and fill up, so check early and often' : 'seats have opened up by about ' + seats + ' a day closer to departure';
    return 'From your checks on ' + from + ' → ' + to + (p.sameMonth ? ' in ' + fromIso(iso(new Date(2026, month, 1))).toLocaleDateString('en-US', { month: 'long' }) : '') + ' (' + p.n + ' flight' + (p.n > 1 ? 's' : '') + '): ' + what + '.';
  }
  function watched() {
    var g = timelines(), t = iso(today());
    return Object.keys(g).map(function (k) { return g[k]; }).filter(function (sn) { var z = sn[sn.length - 1]; return z.date >= t || (z.back && z.back >= t); })
      .sort(function (a, b) { var va = verdictOf(a[a.length - 1]), vb = verdictOf(b[b.length - 1]); var ga = va && va[0] === 'sr-good' ? 0 : 1, gb = vb && vb[0] === 'sr-good' ? 0 : 1; return ga - gb || (a[0].date < b[0].date ? -1 : 1); });
  }
  /* The number that matters most: Polaris seats open on international flights, all open seats on domestic. */
  function seatBadge(r) {
    var pol = r.cabin === 'Polaris', n = pol ? r.openPolaris : r.openAll, l = pol ? r.sbPolaris : r.sbAll;
    if (n === '' || n == null) { n = r.open; l = r.listed; }
    if (n === '' || n == null) return '';
    var v = verdictOf(r);
    return '<span class="sr-seats ' + (v ? v[0] : '') + '" aria-label="' + esc(n + (pol ? ' Polaris seats open' : ' seats open') + ', ' + (l || 0) + ' listed') + '"><b>' + esc(n) + '</b><span>' + (pol ? 'Polaris' : 'seats') + ' open</span><em>' + esc(l || 0) + ' listed</em></span>';
  }
  function flightCard(attr, r, title, when, note) {
    var v = verdictOf(r);
    return '<button class="sr-card sr-fcard" ' + attr + '><span class="sr-fmain"><b>' + title + '</b><span class="sr-when">' + when + '</span>' +
      (v ? '<span>' + pill([v[0], (r.cabin === 'Polaris' ? 'Polaris: ' : '') + v[1]]) + '</span>' : '') + (note ? '<small>' + note + '</small>' : '') + '</span>' + seatBadge(r) + '</button>';
  }
  function watchCard(sn) {
    var z = sn[sn.length - 1];
    var tv = tripVerdict(z), note = esc(trendOf(sn)) + '. Tap to check again.';
    if (tv) note = '<span class="sr-pill ' + tv.cls + '">Round trip: ' + esc(tv.label) + '</span> ' + note;
    if (z.back) {
      var until = Math.round((fromIso(z.back) - today()) / DAY), homeChecks = latestFor(z.to, z.from, z.back).concat(latestFor(z.to, z.from, iso(addDays(fromIso(z.back), 1))));
      var fresh = homeChecks.some(function (r) { return Date.now() - new Date(r.checked).getTime() < DAY; });
      if (until >= 0 && until <= 2 && !fresh) note = '<b class="sr-remind">Time to screenshot your flight home (' + fmt(fromIso(z.back)) + ').</b> ' + note;
    }
    return flightCard('data-recheck="' + esc(keyOf(z)) + '"', z, esc(z.flight || 'Flight') + ' · ' + esc(z.from) + ' &rarr; ' + esc(z.to),
      fmt(fromIso(z.date)) + (z.time ? ' · ' + esc(z.time) : '') + (z.back ? ' · back ' + fmt(fromIso(z.back)) : ''), note);
  }

  /* ---------- getting home ----------
     A trip is only a go if you can get back. Coming home is judged on real seats when you've checked a flight home,
     otherwise on the forecast, and on how many flights home there are (more flights, more chances).
     settings.flexHome: true when you can stay an extra day if needed (the default). */
  function flexHome() { return settings.flexHome !== false; }
  function waysHome(dest, origin, backD) {
    var lg = leg(dest, origin, backD.getMonth()); if (!lg || !lg.perDay) return null;
    var days = flexHome() ? 2 : 1, n = lg.perDay * days;
    return { n: n, via: lg.via, text: (n >= 1.5 ? 'about ' + Math.round(n) + ' flights home' : n >= 0.9 ? 'about 1 flight home' : 'less than 1 flight home') + (days === 2 ? ' over 2 days' : ' that day') + (lg.via ? ' via ' + viaName(lg.via) : '') };
  }
  function homeDay(dest, origin, d) {
    var snaps = latestFor(dest, origin, iso(d));
    if (snaps.length) return { cls: bestOf(snaps) || 'sr-tight', checked: true, d: d };
    return { cls: band(scoreDay(dest, origin, d).score)[0], checked: false, d: d };
  }
  var WORSE = function (a, b) { return RANK[a] >= RANK[b] ? a : b; };
  function tripVerdict(d) {
    if (!d || !d.from || !d.to || d.from !== home || d.to === home) return null;
    var out = verdictOf(d), outCls = out ? out[0] : 'sr-good', dest = d.to;
    if (out && out[0] === 'sr-no') return { cls: 'sr-no', label: 'Hold', why: 'Getting there looks unlikely on this flight.' };
    if (!d.back) return { cls: 'sr-tight', label: 'Check your way home', why: 'Add the day you\u2019d come back to see if you can get home.' };
    var bd = fromIso(d.back), a = homeDay(dest, home, bd), w = waysHome(dest, home, bd), few = w && w.n < 2;
    var src = a.checked ? 'Your flight home on ' + fmt(bd) : 'Flights home on ' + fmt(bd);
    var tail = (w ? ' ' + w.text.charAt(0).toUpperCase() + w.text.slice(1) + (few ? ', so few ways home.' : '.') : '') + (a.checked ? '' : ' Screenshot your flight home to confirm.');
    var r;
    if (a.cls === 'sr-good') r = { cls: 'sr-good', label: 'Go', why: src + (a.checked ? ' has room too.' : ' look open.') + tail };
    else if (flexHome()) {
      var b2 = homeDay(dest, home, addDays(bd, 1));
      if (b2.cls === 'sr-good' || (a.cls === 'sr-tight' && w && w.n >= 2)) r = { cls: 'sr-good', label: 'Go, with a backup', why: src + ' look' + (a.checked ? 's' : '') + ' ' + (a.cls === 'sr-tight' ? 'tight' : 'unlikely') + '. Backup: ' + fmt(addDays(bd, 1)) + (b2.cls === 'sr-good' ? ', which looks open.' : '.') + tail };
      else r = { cls: a.cls === 'sr-tight' ? 'sr-tight' : 'sr-no', label: 'Hold', why: src + ' and the day after look ' + (a.cls === 'sr-tight' ? 'tight' : 'unlikely') + '.' + tail };
    } else r = { cls: a.cls === 'sr-tight' ? 'sr-tight' : 'sr-no', label: 'Hold', why: src + ' look' + (a.checked ? 's' : '') + ' ' + (a.cls === 'sr-tight' ? 'tight' : 'unlikely') + ', and you need to be back that day.' + tail };
    if (few && r.cls === 'sr-good') { r.cls = 'sr-tight'; }
    if (outCls === 'sr-tight') { r.cls = WORSE(r.cls, 'sr-tight'); r.why = 'Getting there is tight. ' + r.why; }
    return r;
  }
  function tripHtml(d) {
    var t = tripVerdict(d); if (!t) return '';
    return '<div class="sr-trip ' + t.cls + '"><span class="sr-lbl">Round trip</span><b>' + esc(t.label) + '</b><span>' + esc(t.why) + '</span></div>';
  }

  /* ---------- calendar ----------
     A day is solid when you've checked real seats for it (colored by its best flight),
     dashed when it's only a forecast that looks open or tight, and blank otherwise. */
  function latestFor(from, to, date) {
    var g = timelines();
    return Object.keys(g).map(function (k) { return g[k][g[k].length - 1]; })
      .filter(function (z) { return z.date === date && (!from || z.from === from) && (!to || z.to === to); });
  }
  var RANK = { 'sr-good': 0, 'sr-tight': 1, 'sr-no': 2 };
  function bestOf(snaps) {
    var best = null;
    snaps.forEach(function (z) { var v = verdictOf(z); if (v && (!best || RANK[v[0]] < RANK[best])) best = v[0]; });
    return best;
  }
  function dayStatus(from, to, d) {
    var snaps = latestFor(from, to, iso(d));
    if (snaps.length) return { cls: bestOf(snaps) || '', solid: true, snaps: snaps };
    var b = band(scoreDay(from, to, d).score)[0];
    return { cls: b === 'sr-good' ? 'f-good' : b === 'sr-tight' ? 'f-tight' : '', solid: false, snaps: [] };
  }
  function calPlaces() { return state.calPlace == null || state.calPlace === 'all' ? places : [places[+state.calPlace]].filter(Boolean); }
  function calDay(d) {
    var ps = calPlaces(), codes = [], hits = [];
    ps.forEach(function (p) { p.codes.forEach(function (c) { codes.push(c); }); });
    var checked = latestFor(home, null, iso(d)).filter(function (z) { return !ps.length || codes.indexOf(z.to) >= 0 || state.calPlace == null || state.calPlace === 'all'; });
    if (checked.length) {
      var cls = bestOf(checked) || '';
      var cs = checked.map(function (z) { return z.to; }).filter(function (c, i, a) { return a.indexOf(c) === i; });
      return { cls: cls, label: cs[0] + (cs.length > 1 ? ' +' + (cs.length - 1) : ''), dots: checked.map(function (z) { var v = verdictOf(z); return v ? v[0] : ''; }), solid: true };
    }
    ps.forEach(function (p) { var hit = null; p.codes.forEach(function (c) { var st = dayStatus(home, c, d); if (st.cls === 'f-good' && !hit) hit = [c, st.cls]; }); if (hit) hits.push(hit); });
    hits.sort(function (a, b) { return a[1] === b[1] ? 0 : a[1] === 'f-good' ? -1 : 1; });
    hits = hits.filter(function (h) { return h[1] === 'f-good'; }); // the calendar only marks forecasts that look open
    return { cls: hits.length ? 'f-good' : '', label: hits.length ? hits[0][0] + (hits.length > 1 ? ' +' + (hits.length - 1) : '') : '', dots: [], solid: false };
  }

  /* ---------- good time to go ----------
     Places that are in season that month (good weather or something on) AND whose flights run emptier than usual.
     Somewhere empty only because it's off season (Alaska in December) never makes the list. */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function picks(month) {
    if (!seasonData || !routeData) return [];
    var by = {};
    Object.keys(seasonData.places).forEach(function (c) {
      var sp = seasonData.places[c], season = sp.seasons.filter(function (x) { return x.months.indexOf(month + 1) >= 0; })[0];
      if (c === home || !season) return;
      var go = leg(home, c, month), back = leg(c, home, month);
      if (!go || !back || !(go.perDay > 0) || !(back.perDay > 0)) return;
      var lg = { full: Math.max(go.full, back.full), perDay: Math.min(go.perDay, back.perDay), via: go.via || back.via, goFull: go.full, backFull: back.full };
      if (lg.full > 0.82) return; // in season but full one way or the other: not a standby pick
      var x = { name: sp.name, codes: [c], days: 5, full: lg.full, goFull: lg.goFull, backFull: lg.backFull, perDay: lg.perDay, via: lg.via, why: season.why,
        score: (0.85 - lg.full) * 100 + Math.min(5, lg.perDay * 3) - (lg.perDay < 0.5 ? 20 : 0) - (lg.via ? 5 : 0) }; // rare flights or a connection mean less backup if you're bumped
      var k = sp.name;
      if (by[k]) { by[k].codes.push(c); if (x.score > by[k].score) { x.codes = by[k].codes; by[k] = x; } } else by[k] = x;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.score - a.score; });
  }
  function freq(n) { return n >= 1.5 ? 'about ' + Math.round(n) + ' flights a day' : n >= 0.9 ? 'about 1 flight a day' : (Math.round(n * 7) <= 1 ? 'about 1 flight a week' : 'about ' + Math.round(n * 7) + ' flights a week'); }
  function pickCard(x, month) {
    var bd = x.full <= 0.72 ? ['sr-good', 'Room both ways'] : ['sr-tight', 'Some room'];
    return '<button class="sr-card" data-pick="' + esc(x.codes.join(',')) + '" data-month="' + month + '" data-name="' + esc(x.name) + '"><span class="t"><b>' + esc(x.name) + ' <span class="r">' + home + ' &rarr; ' + x.codes.map(esc).join(', ') + '</span></b>' + pill(bd) + '</span>' +
      '<span class="sr-when">Going ' + Math.round(x.goFull * 100) + '% full · coming back ' + Math.round(x.backFull * 100) + '% full</span>' +
      '<small>' + esc(x.why) + ' · ' + (x.via ? 'via ' + esc(viaName(x.via)) + ', ' : '') + freq(x.perDay) + (x.perDay < 0.9 ? ', so fewer backups' : '') + '</small></button>';
  }
  function pickMonth() { return addDays(today(), 21).getMonth(); }
  function picksHtml() {
    var m = pickMonth(), list = picks(m).slice(0, 3);
    if (!list.length) return '';
    return '<div class="sr-lbl">Good time to go · ' + MONTHS[m] + '</div>' + list.map(function (x) { return pickCard(x, m); }).join('') +
      '<button class="sr-link" data-go="picks">More picks, by month</button>';
  }

  /* ---------- screens ---------- */
  var state = { place: null, out: null, back: null, flex: true, draft: null, stack: [] };
  function bar(back) {
    return '<div class="sr-bar">' + (back ? '<button class="sr-back" data-back>&larr; Back</button>' : '<span></span>') +
      '<nav class="sr-tabs" aria-label="Standby Radar"><button class="sr-tab" data-go="home"' + (cur === 'home' ? ' aria-current="page"' : '') + '>Home</button>' +
      '<button class="sr-tab" data-go="cal"' + (cur === 'cal' ? ' aria-current="page"' : '') + '>Calendar</button>' +
      '<button class="sr-tab" data-go="log"' + (cur === 'log' ? ' aria-current="page"' : '') + '>Log</button>' +
      '<button class="sr-tab" data-go="settings"' + (cur === 'settings' ? ' aria-current="page"' : '') + ' aria-label="Settings">&#9881;</button></nav></div>';
  }
  function pill(b) { return '<span class="sr-pill ' + b[0] + '">' + b[1] + '</span>'; }
  function placeCard(p, idx) {
    var t = bestTrip(p, today(), 42), b = band(t.score);
    var why = t.out.why.concat(t.back.why);
    var note = why.length ? why[0] : (t.out.score >= 62 ? 'Midweek trip, away from holiday peaks' : 'Forecast from day of week and holiday peaks');
    var pat = p.codes.map(function (c) { return patternNote(home, c, t.outD.getMonth()); }).filter(Boolean)[0];
    if (pat) note += '. ' + pat;
    return '<button class="sr-card" data-place="' + idx + '" data-out="' + iso(t.outD) + '" data-back-d="' + iso(t.backD) + '">' +
      '<span class="t"><b>' + esc(p.name) + ' <span class="r">' + home + ' &rarr; ' + p.codes.map(esc).join(', ') + '</span></b>' + pill(b) + '</span>' +
      '<span class="sr-when">Best: ' + fmt(t.outD) + ' out · ' + fmt(t.backD) + ' back</span>' + dirsHtml(t, p) + '<small>' + esc(note) + '</small></button>';
  }
  function dirsHtml(t, p) {
    var o = band(t.out.score), b = band(t.back.score), w = waysHome(t.back.code, home, t.backD);
    return '<span class="sr-dirs"><span>Going ' + pill(o) + '</span><span>Coming back ' + pill(b) + '</span></span>' +
      (w ? '<small' + (w.n < 2 ? ' class="sr-warn"' : '') + '>' + esc(w.text.charAt(0).toUpperCase() + w.text.slice(1)) + (w.n < 2 ? ': few ways home' : '') + '</small>' : '');
  }
  var S = {};
  S.home = function () {
    return '<div class="sr-bar"><span></span><nav class="sr-tabs" aria-label="Standby Radar"><button class="sr-tab" data-go="cal">Calendar</button><button class="sr-tab" data-go="log">Log</button><button class="sr-tab" data-go="settings" aria-label="Settings">&#9881;</button></nav></div>' +
      '<h1 class="sr-title">Standby Radar<span>.</span></h1>' +
      baseHtml() +
      '<p class="sr-intro">We\u2019re lucky to have a great friend who shares their United standby travel with us. We\u2019ve used it, but not nearly enough. This is our nudge to take a trip once a month and see the world.</p>' +
      picksHtml() +
      watchedHtml() +
      '<div class="sr-lbl">Your places · next 6 weeks</div>' +
      (places.length ? places.map(placeCard).join('') : '<button class="sr-card" data-go="settings"><b>Add places you\u2019d like to go</b><small>Pick a few destinations in settings and this shows when each looks open.</small></button>') +
      '<div class="sr-ctas"><button class="sr-cta" data-go="know"><i aria-hidden="true">&#8982;</i>I know where and when</button>' +
      '<button class="sr-cta alt" data-go="dice"><i aria-hidden="true">&#9860;</i>Roll the dice</button></div>';
  };
  function cityOf(c) { return viaName(c); }
  function baseHtml() {
    if (!settings.alt) return '';
    var auto = autoBase();
    return '<div class="sr-base" role="group" aria-label="Base camp"><span class="sr-lbl">Base camp</span><div class="sr-seg">' +
      [['main', cityOf(homeMain)], ['alt', cityOf(settings.alt)], ['auto', 'Auto']].map(function (x) {
        return '<button data-base="' + x[0] + '" aria-pressed="' + (baseMode === x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
      '<small>' + (baseMode === 'auto' ? 'Auto: ' + esc(cityOf(settings.alt)) + ' in ' + esc(monthsText(settings.altMonths || [])) + ', ' + esc(cityOf(homeMain)) + ' the rest of the year. Now: ' + esc(cityOf(auto)) + '.' : 'Trips start from ' + esc(cityOf(home)) + ' (' + home + ').') + '</small></div>';
  }
  function watchedHtml() {
    var w = watched(); if (!w.length) return '';
    var good = w.filter(function (sn) { var v = verdictOf(sn[sn.length - 1]); return v && v[0] === 'sr-good'; }), rest = w.length - good.length;
    return '<div class="sr-lbl">Your flights · good odds</div>' + (good.length ? good.map(watchCard).join('') : '<p class="sr-sub">None of the flights you\u2019ve checked look good right now.</p>') +
      '<button class="sr-link" data-go="cal">See every flight on the calendar' + (rest ? ' (' + rest + ' more checked)' : '') + '</button>';
  }
  S.cal = function () {
    var t = today(), start = addDays(t, -t.getDay()), sel = state.calSel || iso(t), h = bar(true);
    h += '<h1 class="sr-h">Flights</h1>';
    if (places.length > 1) h += '<div class="sr-chips" role="group" aria-label="Show">' + [['all', 'All']].concat(places.map(function (p, i) { return [String(i), p.name]; })).map(function (x) {
      return '<button class="sr-chip" data-calplace="' + x[0] + '" aria-pressed="' + (String(state.calPlace == null ? 'all' : state.calPlace) === x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
    h += '<div class="sr-legend"><span><i class="sr-sw sr-good"></i>Checked: good</span><span><i class="sr-sw sr-tight"></i>Tight</span><span><i class="sr-sw sr-no"></i>Unlikely</span><span><i class="sr-sw f-good"></i>Forecast: likely open</span></div>';
    h += '<div class="sr-cal" role="grid" aria-label="Next six weeks, flights from ' + home + '">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (x) { return '<span class="sr-dow" aria-hidden="true">' + x + '</span>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), past = d < t, c = past ? { cls: '', label: '', dots: [] } : calDay(d), mon = d.getDate() === 1 || i === 0;
      h += '<button class="sr-day ' + c.cls + (past ? ' past' : '') + (iso(d) === sel ? ' sel' : '') + '" data-calday="' + iso(d) + '"' + (past ? ' disabled' : '') +
        ' aria-label="' + esc(fmt(d) + (c.label ? ', ' + c.label : '') + (c.solid ? ', checked' : c.cls ? ', forecast' : '')) + '">' +
        '<b>' + (mon ? '<span class="m">' + d.toLocaleDateString('en-US', { month: 'short' }) + '</span> ' : '') + d.getDate() + '</b>' +
        (c.dots.length ? '<span class="dots">' + c.dots.map(function (x) { return '<span class="dot ' + x + '"></span>'; }).join('') + '</span>' : '') +
        '<i>' + esc(c.label) + '</i></button>';
    }
    h += '</div>';
    var sd = fromIso(sel), snaps = latestFor(home, null, sel);
    h += '<div class="sr-lbl">' + fmt(sd) + (snaps.length ? ' · ' + snaps.length + ' flight' + (snaps.length > 1 ? 's' : '') + ' checked' : '') + '</div>';
    var g = timelines();
    snaps.forEach(function (z) { h += watchCard(g[keyOf(z)]); });
    calPlaces().forEach(function (p) { p.codes.forEach(function (c) { if (!snaps.some(function (z) { return z.to === c; })) h += dayRow(p.name, home, c, sd); }); });
    if (!places.length) h += '<button class="sr-card" data-go="settings"><b>Add places you\u2019d like to go</b><small>Then each day shows which of them look open.</small></button>';
    return h;
  };
  /* Fixed dates, several places: one row per place, a few days either side of the plan. */
  function strips(list, o, b) {
    function grid(label, center, out) {
      var days = [-2, -1, 0, 1, 2].map(function (k) { return addDays(center, k); });
      var h = '<div class="sr-lbl">' + label + '</div><div class="sr-strip" style="--n:' + days.length + '"><span></span>' + days.map(function (d) {
        return '<span class="sr-dow' + (iso(d) === iso(center) ? ' on' : '') + '">' + d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2) + '<br>' + d.getDate() + '</span>'; }).join('');
      list.forEach(function (x) {
        h += '<span class="sr-sname">' + esc(x.p.name) + '</span>';
        days.forEach(function (d) {
          var c = x.p.codes[0], st = out ? dayStatus(home, c, d) : dayStatus(c, home, d), past = d < today();
          h += '<button class="sr-cell ' + (past ? 'past' : st.cls) + (iso(d) === iso(center) ? ' on' : '') + '" data-check="' + (out ? home + '-' + c : c + '-' + home) + '-' + iso(d) + '"' + (past ? ' disabled' : '') +
            ' aria-label="' + esc(x.p.name + ', ' + (out ? 'going ' : 'back ') + fmt(d) + ', ' + (st.solid ? 'checked' : st.cls ? 'forecast ' + (st.cls === 'f-good' ? 'likely open' : 'tight') : 'unlikely')) + '">' + (st.solid ? st.snaps.length : '') + '</button>';
        });
      });
      return h + '</div>';
    }
    return grid('Going · ' + fmt(o), o, true) + grid('Coming back · ' + fmt(b), b, false) +
      '<div class="sr-legend"><span><i class="sr-sw sr-good"></i>Checked</span><span><i class="sr-sw f-good"></i>Likely open</span><span><i class="sr-sw f-tight"></i>Tight</span><span><i class="sr-sw"></i>Unlikely</span></div>';
  }
  S.picks = function () {
    var m = state.pickMonth != null ? state.pickMonth : pickMonth(), t = today().getMonth(), list = picks(m);
    return bar(true) + '<h1 class="sr-h">Good time to go</h1><p class="sr-sub">In season, and flights from ' + home + ' usually run emptier than most. Percent full is the route\u2019s average for the month.</p>' +
      '<div class="sr-chips" role="group" aria-label="Month">' + [0, 1, 2, 3].map(function (k) { var mm = (t + k) % 12; return '<button class="sr-chip" data-pickmonth="' + mm + '" aria-pressed="' + (mm === m) + '">' + MONTHS[mm].slice(0, 3) + '</button>'; }).join('') + '</div>' +
      (list.length ? list.slice(0, 10).map(function (x) { return pickCard(x, m); }).join('') : '<p class="sr-empty">Nothing in season with room to spare that month.</p>') +
      '<p class="sr-note">Seasons are hand-picked for weather and what\u2019s on. Seat history is public U.S. DOT data, so it\u2019s a monthly average, not a promise for any one flight.</p>';
  };
  S.know = function () {
    var p = state.place != null ? state.place : 0, o = state.out || iso(addDays(today(), 7)), b = state.back || iso(addDays(today(), 7 + (places[p] ? places[p].days - 1 : 3)));
    return bar(true) + '<h1 class="sr-h">Where and when?</h1>' +
      (places.length ? '' : '<p class="sr-note">Add a place first, then come back to see its flights.</p>') +
      '<label class="sr-field">Where<select id="k-place">' + places.map(function (pl, i) { return '<option value="' + i + '"' + (i === +p ? ' selected' : '') + '>' + esc(pl.name) + ' (' + pl.codes.join(', ') + ')</option>'; }).join('') + '</select></label>' +
      '<div class="sr-row2"><label class="sr-field">Leave<input type="date" id="k-out" value="' + o + '"></label><label class="sr-field">Back<input type="date" id="k-back" value="' + b + '"></label></div>' +
      '<div class="sr-chips"><button class="sr-chip" data-flex="1" aria-pressed="' + state.flex + '">&plusmn; 1 day is fine</button><button class="sr-chip" data-flex="0" aria-pressed="' + !state.flex + '">Exact dates</button></div>' +
      '<p class="sr-err" id="k-err" hidden></p>' +
      '<button class="sr-btn" data-act="know-go"' + (places.length ? '' : ' disabled') + '>Show flights</button>' +
      '<p class="sr-or">or, if you already have the seat counts</p>' +
      '<label class="sr-drop"><b>Upload seat-count screenshots</b>One or several, for the flights you\u2019re thinking about.<input type="file" accept="image/*" multiple id="k-file"></label>' +
      '<button class="sr-link" data-go="settings">Add or change places</button>';
  };
  S.dice = function () {
    var o = state.out || iso(addDays(today(), 4)), b = state.back || iso(addDays(today(), 6));
    return bar(true) + '<h1 class="sr-h">Roll the dice</h1><p class="sr-sub">Where could we go?</p>' +
      '<div class="sr-row2"><label class="sr-field">Leave<input type="date" id="d-out" value="' + o + '"></label><label class="sr-field">Back<input type="date" id="d-back" value="' + b + '"></label></div>' +
      '<label class="sr-drop"><b>Upload the open-flights list</b>A screenshot from the airline app<input type="file" accept="image/*" id="d-file"></label>' +
      '<p class="sr-note" id="d-status" hidden></p>' +
      '<p class="sr-or">or</p>' +
      '<button class="sr-btn ghost" data-act="dice-places">Rank my places for these dates</button>' +
      (seasonData && routeData ? '<button class="sr-btn ghost" data-act="dice-season">Places in season with room</button>' : '') +
      (routeData ? '<button class="sr-btn ghost" data-act="dice-all">Rank everywhere United flies from ' + home + '</button>' : '<p class="sr-sub">"Everywhere United flies" turns on once route history is loaded.</p>');
  };
  S.dicelist = function () {
    var o = fromIso(state.out), b = fromIso(state.back);
    var list = (state.diceList || places.map(function (p) { return p; })).map(function (p, i) { var t = tripScore(p, o, b); return { p: p, t: t, i: i }; })
      .sort(function (x, y) { return y.t.score - x.t.score; }).slice(0, 12);
    return bar(true) + '<h1 class="sr-h">' + fmt(o) + ' &ndash; ' + fmt(b) + '</h1><p class="sr-sub">Each row is a place, two days either side of your dates. Tap a square to check real seats.</p>' +
      strips(list.slice(0, 8), o, b) +
      '<div class="sr-lbl">Ranked by how open the trip looks</div>' +
      list.map(function (x) {
        var bd = band(x.t.score), why = x.t.out.why.concat(x.t.back.why);
        return '<button class="sr-card" data-dice="' + x.i + '"><span class="t"><b>' + esc(x.p.name) + ' <span class="r">' + home + ' &rarr; ' + x.p.codes.map(esc).join(', ') + '</span></b>' + pill(bd) + '</span>' +
          (x.p.seen ? '<span class="sr-when">From your screenshot: ' + esc(x.p.seen) + '</span>' : '') +
          (x.p.note ? '<span class="sr-when">' + esc(x.p.note) + '</span>' : '') +
          (function () { x.t.outD = o; x.t.backD = b; return dirsHtml(x.t, x.p); })() +
          '<small>' + esc(why[0] || 'Day of week and holiday peaks') + '</small></button>';
      }).join('') || '<p class="sr-empty">Nothing found. Try another screenshot, or rank your places.</p>';
  };
  function dayRow(label, a, b, d) {
    var r = scoreDay(a, b, d), bd = band(r.score);
    return '<button class="sr-card" data-check="' + a + '-' + b + '-' + iso(d) + '"><span class="t"><b>' + label + ' · ' + fmt(d) + ' <span class="r">' + a + ' &rarr; ' + b + '</span></b>' + pill(bd) + '</span><small>' + esc(r.why.join(' · ') || 'Day of week and holiday peaks') + '</small></button>';
  }
  /* Place detail: three views of one destination from the base camp.
     1. How full, week by week: the route's monthly average spread across weeks, holiday weeks flagged.
     2. Flights a day from the base camp, per airport, this month and the next two.
     3. Getting in and out: one square per day, top half going, bottom half coming back. */
  function weekFull(p, ws) {
    var tot = 0, n = 0, peak = null;
    for (var k = 0; k < 7; k++) {
      var d = addDays(ws, k), best = null;
      p.codes.forEach(function (c) { var lg = leg(home, c, d.getMonth()); if (lg && (best == null || lg.full < best)) best = lg.full; });
      if (best != null) { tot += best; n++; }
      if (!peak) peak = peakFor(d);
    }
    return n ? { full: tot / n, peak: peak } : { full: null, peak: peak };
  }
  function fullChart(p, o, b) {
    var t = today(), start = addDays(t, -t.getDay()), weeks = [];
    for (var i = 0; i < 10; i++) { var ws = addDays(start, i * 7), w = weekFull(p, ws); w.ws = ws; w.trip = (o >= ws && o < addDays(ws, 7)) || (b >= ws && b < addDays(ws, 7)); weeks.push(w); }
    var have = weeks.filter(function (w) { return w.full != null; });
    if (!have.length) return '<p class="sr-sub">No route history for this place yet.</p>';
    var lo = have.reduce(function (a, w) { return w.full < a.full ? w : a; });
    var MIN = 0.5, y = function (f) { return Math.max(0, Math.min(100, (f - MIN) / (1 - MIN) * 100)); };
    var pts = weeks.map(function (w, i) { return w.full == null ? null : [(i + 0.5) * 10, 100 - y(w.full)]; }).filter(Boolean);
    var h = '<div class="sr-line" role="img" aria-label="' + esc('How full flights from ' + home + ' to ' + p.name + ' run, by week: ' + have.map(function (w) { return fmt(w.ws) + ' ' + Math.round(w.full * 100) + '%'; }).join(', ')) + '"><div class="plot">';
    weeks.forEach(function (w, i) { if (w.peak) h += '<span class="band" style="left:' + i * 10 + '%" title="' + esc(w.peak) + '"></span>'; });
    [60, 70, 80, 90].forEach(function (g) { h += '<span class="grid" style="bottom:' + y(g / 100) + '%"><i>' + g + '%</i></span>'; });
    h += '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.map(function (q) { return q.join(','); }).join(' ') + '" /></svg>';
    weeks.forEach(function (w, i) {
      if (w.full == null) return;
      var pct = Math.round(w.full * 100), show = w.trip || w === lo;
      h += '<span class="dot' + (w.trip ? ' trip' : '') + '" style="left:' + ((i + 0.5) * 10) + '%;bottom:' + y(w.full) + '%" title="' + esc('Week of ' + fmt(w.ws) + ': ' + pct + '% full on average' + (w.peak ? ', ' + w.peak : '')) + '">' + (show ? '<i>' + pct + '%</i>' : '') + '</span>';
    });
    h += '</div><div class="xs">' + weeks.map(function (w, i) { return '<span>' + (i === 0 || w.ws.getDate() <= 7 ? '<b>' + MONTHS_SHORT[w.ws.getMonth()] + '</b>' : '') + w.ws.getDate() + '</span>'; }).join('') + '</div></div>';
    return h + '<div class="sr-legend"><span><i class="sr-sw dotk"></i>% full, week of</span>' + (weeks.some(function (w) { return w.trip; }) ? '<span><i class="sr-sw dotk trip"></i>Your trip</span>' : '') + '<span><i class="sr-sw bandk"></i>Holiday week</span></div>' +
      '<p class="sr-cap">Each month’s average from U.S. DOT data. Holiday weeks run fuller than the average shows.</p>';
  }
  function freqTable(p) {
    var m0 = today().getMonth(), months = [m0, (m0 + 1) % 12, (m0 + 2) % 12];
    var h = '<table class="sr-freq"><thead><tr><th scope="col">From ' + esc(home) + '</th>' + months.map(function (m) { return '<th scope="col">' + MONTHS_SHORT[m] + '</th>'; }).join('') + '</tr></thead><tbody>';
    p.codes.forEach(function (c) {
      h += '<tr><th scope="row">' + esc(c) + '</th>' + months.map(function (m) {
        var lg = leg(home, c, m); if (!lg || !lg.perDay) return '<td class="none">none</td>';
        var n = lg.perDay, txt = n >= 0.9 ? String(Math.round(n * 10) / 10).replace(/\.0$/, '') : Math.max(1, Math.round(n * 7)) + '/wk';
        return '<td' + (n < 0.9 ? ' class="few"' : '') + '><b>' + txt + '</b>' + (n >= 0.9 ? '<span>a day</span>' : '') + (lg.via ? '<span>via ' + esc(lg.via) + '</span>' : '') + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table>';
  }
  function easeGrid(p, o, b) {
    var t = today(), start = addDays(t, -t.getDay()), h = '<div class="sr-ease" role="grid" aria-label="Getting in and out, next six weeks">';
    h += ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (x) { return '<span class="sr-dow" aria-hidden="true">' + x + '</span>'; }).join('');
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i), past = d < t;
      if (past) { h += '<span class="ed past"><b>' + d.getDate() + '</b></span>'; continue; }
      var go = bestCode(p, d, true), back = bestCode(p, d, false), gb = band(go.score), bb = band(back.score), mark = iso(d) === iso(o) ? ' out' : iso(d) === iso(b) ? ' back' : '';
      h += '<button class="ed' + mark + '" data-check="' + home + '-' + go.code + '-' + iso(d) + '" aria-label="' + esc(fmt(d) + ': going ' + gb[1].toLowerCase() + ', coming back ' + bb[1].toLowerCase()) + '" title="' + esc(fmt(d) + ' · going: ' + gb[1] + ' · coming back: ' + bb[1]) + '">' +
        '<span class="hi ' + gb[0] + '"></span><span class="lo ' + bb[0] + '"></span><b>' + (d.getDate() === 1 || i === t.getDay() ? MONTHS_SHORT[d.getMonth()] + ' ' : '') + d.getDate() + '</b></button>';
    }
    return h + '</div><div class="sr-legend"><span><i class="sr-sw sr-good"></i>Likely open</span><span><i class="sr-sw sr-tight"></i>Tight</span><span><i class="sr-sw sr-no"></i>Unlikely</span><span><i class="sr-sw half"></i>Top: going · bottom: coming back</span></div>' +
      '<p class="sr-cap">Look for a green top to leave on and a green bottom to come home on. Tap a day to check real seats.</p>';
  }
  S.flights = function () {
    var p = state.placeObj || places[state.place], o = fromIso(state.out), b = fromIso(state.back), h = '';
    var tv = tripScore(p, o, b);
    h += bar(true) + '<h1 class="sr-h">' + esc(p.name) + ' <span class="sr-sub">from ' + esc(cityOf(home)) + '</span></h1>';
    h += '<label class="sr-drop"><b>Upload a seat-count screenshot</b>For any of these days<input type="file" accept="image/*" multiple id="fl-file"></label>';
    h += '<div class="sr-card"><span class="t"><b>' + fmt(o) + ' &ndash; ' + fmt(b) + '</b>' + pill(band(tv.score)) + '</span>' + dirsHtml(Object.assign(tv, { outD: o, backD: b }), p) + '</div>';
    h += '<div class="sr-lbl">How full, week by week</div>' + fullChart(p, o, b);
    h += '<div class="sr-lbl">Flights a day</div>' + freqTable(p);
    h += '<div class="sr-lbl">Getting in and out</div>' + easeGrid(p, o, b);
    return h;
  };
  S.check = function () {
    var d = state.draft || {}, v = verdictOf(d);
    settle(d);
    var h = bar(true) + '<h1 class="sr-h">Check real seats</h1>' +
      (state.batchIdx != null ? '<button class="sr-link" data-act="to-batch">&larr; All ' + state.batch.length + ' flights</button>' : '') +
      '<label class="sr-drop"><b>Upload screenshots</b>Seat counts and standby list from the airline app. Pick one or several.<input type="file" accept="image/*" multiple id="c-file"></label>' +
      (d.img ? '<img class="sr-thumb" src="' + d.img + '" alt="Your screenshot">' : '') +
      '<p class="sr-note" id="c-status"' + (d.status ? '' : ' hidden') + '>' + esc(d.status || '') + '</p>';
    h += '<div id="c-verdict">' + verdictHtml(d) + '</div><div id="c-trip">' + tripHtml(d) + '</div>';
    var pn = d.from && d.to && d.date ? patternNote(d.from, d.to, fromIso(d.date).getMonth()) : '';
    if (pn) h += '<p class="sr-note">' + esc(pn) + '</p>';
    if (d.advice) h += '<p class="sr-claude">' + esc(d.advice) + '</p>';
    h += '<div class="sr-lbl">Check the numbers</div>' +
      '<div class="sr-grid"><label class="sr-field">Flight<input id="f-flight" value="' + esc(d.flight) + '" placeholder="UA 837"></label>' +
      '<label class="sr-field">From<input id="f-from" value="' + esc(d.from || home) + '" maxlength="3"></label>' +
      '<label class="sr-field">To<input id="f-to" value="' + esc(d.to) + '" maxlength="3"></label></div>' +
      '<div class="sr-row2"><label class="sr-field">Date<input type="date" id="f-date" value="' + esc(d.date || iso(today())) + '"></label><label class="sr-field">Departs<input id="f-time" value="' + esc(d.time) + '" placeholder="11:05 AM"></label></div>' +
      '<div class="sr-row2"><label class="sr-field">Polaris open<input inputmode="numeric" id="f-pol" value="' + esc(d.openPolaris) + '"></label>' +
      '<label class="sr-field">Listed for Polaris<input inputmode="numeric" id="f-polsb" value="' + esc(d.sbPolaris) + '"></label></div>' +
      '<div class="sr-row2"><label class="sr-field">All cabins open<input inputmode="numeric" id="f-all" value="' + esc(d.openAll) + '"></label>' +
      '<label class="sr-field">All standby<input inputmode="numeric" id="f-allsb" value="' + esc(d.sbAll) + '"></label></div>' +
      '<p class="sr-sub" id="f-cabin">' + cabinNote(d) + '</p>' +
      '<div class="sr-row2"><label class="sr-field">Coming back<input type="date" id="f-back" value="' + esc(d.back || '') + '"></label>' +
      '<div class="sr-field">If coming home is tight<div class="sr-chips"><button class="sr-chip" data-flexhome="1" aria-pressed="' + flexHome() + '">Can stay a day</button><button class="sr-chip" data-flexhome="0" aria-pressed="' + !flexHome() + '">Need to be back</button></div></div></div>' +
      '<div class="sr-row2"><label class="sr-field">Travelers<input inputmode="numeric" id="f-party" value="' + esc(d.party || 2) + '"></label>' +
      '<label class="sr-field">Your spot, if listed<input inputmode="numeric" id="f-position" value="' + esc(d.position) + '"></label></div>' +
      (d.logId ? '<p class="sr-sub" id="c-saved">&check; Saved to your log. Changes save as you type.</p>' : '') +
      '<div class="sr-row2">' + (d.logId ? '' : '<button class="sr-btn" data-act="save">Save to log</button>') +
      '<button class="sr-btn ghost" data-act="claude"' + (d.logId ? ' style="grid-column:1/-1"' : '') + (settings.claudeKey ? '' : ' disabled title="Add your Claude key in settings"') + '>Read with Claude</button></div>' +
      (settings.claudeKey ? '' : '<button class="sr-link" data-go="settings">Turn on "Read with Claude"</button>');
    return h;
  };
  function cabinNote(d) { return d.cabin === 'Polaris' ? 'International, so the verdict counts Polaris seats and the people listed for Polaris.' : 'Domestic, so the verdict counts every open seat and everyone on standby.'; }
  function whoFor(d) { var n = partyOf(d); return n === 1 ? 'you' : n === 2 ? 'both of you' : 'all ' + n + ' of you'; }
  function summaryOf(d) {
    var v = verdictOf(d); if (!v) return '';
    var p = planeOf(d), parts = [];
    parts.push((d.cabin === 'Polaris' ? 'Polaris: ' : '') + d.open + ' open, ' + (d.position ? 'you\u2019re #' + d.position : (d.listed || 0) + ' listed') + ', ' + v[2] + ' to spare after ' + whoFor(d));
    if (d.cabin === 'Polaris' && p) parts.push('whole plane: ' + d.openAll + ' open, ' + (d.sbAll || 0) + ' on standby');
    return parts.join(' · ');
  }
  function verdictHtml(d) {
    var v = verdictOf(d); if (!v) return '';
    var p = d.cabin === 'Polaris' ? planeOf(d) : null;
    return '<div class="sr-verdict ' + v[0] + '"><span class="flt">' + esc([d.flight, (d.from || '') + (d.to ? ' → ' + d.to : ''), d.date ? fmt(fromIso(d.date)) : '', d.time].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="big">' + (d.cabin === 'Polaris' ? 'Polaris: ' : '') + v[1] + '</span><div class="sr-nums"><div class="sr-num"><b>' + esc(d.open) + '</b><span>' + (d.cabin === 'Polaris' ? 'Polaris open' : 'Open seats') + '</span></div>' +
      '<div class="sr-num"><b>' + (d.position ? '#' + esc(d.position) : esc(d.listed || 0)) + '</b><span>' + (d.position ? 'Your spot' : d.cabin === 'Polaris' ? 'Listed for Polaris' : 'On standby') + '</span></div>' +
      '<div class="sr-num"><b>' + v[2] + '</b><span>To spare after ' + whoFor(d) + '</span></div></div>' +
      (p ? '<span class="flt">Getting on the plane at all: ' + p[1].toLowerCase() + ' (' + esc(d.openAll) + ' open, ' + esc(d.sbAll || 0) + ' on standby)</span>' : '') + '</div>';
  }
  function updateVerdict() {
    var box = document.getElementById('c-verdict'); if (box) box.innerHTML = verdictHtml(state.draft || {});
    var tb = document.getElementById('c-trip'); if (tb) tb.innerHTML = tripHtml(state.draft || {});
    var cn = document.getElementById('f-cabin'); if (cn) cn.textContent = cabinNote(state.draft || {});
    var v = verdictOf(state.draft || {}); document.body.classList.toggle('fast', !!v && v[0] === 'sr-good');
  }
  S.batch = function () {
    var b = state.batch || [], left = b.filter(function (d) { return !d.saved; }).length;
    var h = bar(true) + '<h1 class="sr-h">' + (b.length === 1 ? '1 flight' : b.length + ' flights') + '</h1>' +
      '<p class="sr-note" id="b-status"' + (state.batchStatus ? '' : ' hidden') + '>' + esc(state.batchStatus || '') + '</p>';
    b.forEach(function (d, i) {
      settle(d); var v = verdictOf(d);
      h += v ? flightCard('data-batch="' + i + '"', d, esc([d.flight, (d.from || '?') + ' → ' + (d.to || '?')].filter(Boolean).join(' · ')),
          esc([d.date ? fmt(fromIso(d.date)) : '', d.time].filter(Boolean).join(' · ')), esc(summaryOf(d)) + (d.saved ? ' · Saved' : ''))
        : '<button class="sr-card" data-batch="' + i + '"><span class="t"><b>' + esc([d.flight, (d.from || '?') + ' → ' + (d.to || '?')].filter(Boolean).join(' · ')) + '</b><span class="sr-pill sr-tight">' + (d.reading ? 'Reading…' : 'Needs numbers') + '</span></span>' +
        '<span class="sr-when">' + esc([d.date ? fmt(fromIso(d.date)) : '', d.time].filter(Boolean).join(' · ')) + '</span><small>Tap to check the numbers</small></button>';
    });
    if (left && !b.some(function (d) { return d.reading; })) h += '<button class="sr-btn" data-act="save-all">Save the rest to log</button>';
    return h;
  };
  S.log = function () {
    var made = log.filter(function (r) { return r.result === 'Made it'; }).length;
    var tried = log.filter(function (r) { return r.result === 'Made it' || r.result === 'Bumped'; }).length;
    var byDay = {}; log.forEach(function (r) { if (r.open === '' || r.open == null) return; var k = new Date(r.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' }); (byDay[k] = byDay[k] || []).push(spareOf(r)); });
    var bestDay = '–', bestAvg = -1e9; Object.keys(byDay).forEach(function (k) { var a = byDay[k].reduce(function (s, x) { return s + x; }, 0) / byDay[k].length; if (a > bestAvg) { bestAvg = a; bestDay = k; } });
    var h = bar(true) + '<h1 class="sr-h">Your log</h1>' +
      '<div class="sr-stats"><div class="sr-stat"><b>' + log.length + '</b><span>Checks</span></div><div class="sr-stat"><b>' + made + '/' + tried + '</b><span>Made it</span></div><div class="sr-stat"><b>' + bestDay + '</b><span>Best day</span></div></div>';
    if (!log.length) h += '<p class="sr-empty">No checks yet. Upload a screenshot and every flight on it is saved here.</p>';
    var g = timelines();
    Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return a[0].date < b[0].date ? 1 : -1; }).forEach(function (sn) {
      var z = sn[sn.length - 1], v = verdictOf(z);
      h += '<div class="sr-card"><div class="sr-fcard" style="display:grid"><span class="sr-fmain"><b>' + esc(z.flight || 'Flight') + ' · ' + esc(z.from) + ' &rarr; ' + esc(z.to) + '</b>' +
        '<span class="sr-when">' + fmt(fromIso(z.date)) + (z.time ? ' · ' + esc(z.time) : '') + '</span>' + (v ? '<span>' + pill([v[0], (z.cabin === 'Polaris' ? 'Polaris: ' : '') + v[1]]) + '</span>' : '') + '</span>' + seatBadge(z) + '</div>' +
        '<small>' + esc(trendOf(sn)) + '</small>' +
        sn.map(function (r) { return '<span class="sr-when">' + esc(whenChecked(r)) + ' · ' + daysOutOf(r) + 'd out · ' + esc(r.open) + (r.cabin === 'Polaris' ? ' Polaris' : '') + ' open, ' + esc(r.listed || 0) + ' listed' + (r.cabin === 'Polaris' && r.openAll !== '' ? ' · ' + esc(r.openAll) + ' open in all' : '') + '</span>'; }).join('') +
        '<div class="sr-chips" role="group" aria-label="How did it go?">' + ['Made it', 'Bumped', "Didn't try"].map(function (x) { return '<button class="sr-chip" data-result="' + z.id + '" data-val="' + x + '" aria-pressed="' + (z.result === x) + '">' + x + '</button>'; }).join('') + '</div></div>';
    });
    h += '<p class="sr-note">' + (settings.sheetUrl ? 'Each check is also sent to your Google Sheet.' : 'Saved on this phone. Add your private sheet link in settings to sync it.') + '</p>' +
      '<button class="sr-btn ghost" data-act="csv"' + (log.length ? '' : ' disabled') + '>Download CSV</button>';
    return h;
  };
  S.settings = function () {
    return bar(true) + '<h1 class="sr-h">Settings</h1><p class="sr-sub">Stored only on this device.</p>' +
      '<label class="sr-field">Home airport<input id="s-home" value="' + esc(homeMain) + '" maxlength="3"></label>' +
      '<div class="sr-row2"><label class="sr-field">Second base camp<input id="s-alt" value="' + esc(settings.alt || '') + '" maxlength="3" placeholder="optional"></label>' +
      '<label class="sr-field">Months there<input id="s-altm" value="' + esc((settings.altMonths || []).length ? settings.altMonths[0] + (settings.altMonths.length > 1 ? '-' + settings.altMonths[settings.altMonths.length - 1] : '') : '') + '" placeholder="like 4-5"></label></div>' +
      '<label class="sr-field">Your places, one per line: name, airport codes, trip length in days<textarea id="s-places">' + esc(places.map(function (p) { return p.name + ', ' + p.codes.join(' ') + ', ' + p.days; }).join('\n')) + '</textarea></label>' +
      '<label class="sr-field">Private Google Sheet link (Apps Script web app URL)<input id="s-sheet" type="url" value="' + esc(settings.sheetUrl) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
      '<label class="sr-field">Claude API key (for "Read with Claude")<input id="s-key" type="password" autocomplete="off" value="' + esc(settings.claudeKey) + '" placeholder="sk-ant-…"></label>' +
      '<p class="sr-sub">Set a monthly spending limit on the key in the Claude Console. Each read costs about a cent.</p>' +
      '<p class="sr-err" id="s-err" hidden></p>' +
      '<button class="sr-btn" data-act="settings-save">Save settings</button>' +
      '<button class="sr-link" data-act="wipe">Clear the log on this device</button>';
  };

  /* ---------- render + nav ---------- */
  var cur = null;
  function show(id, opts) {
    if (cur && !(opts && opts.noPush)) state.stack.push(cur);
    cur = id; app.innerHTML = S[id]();
    document.body.classList.toggle('fast', id === 'check' && !!verdictOf(state.draft || {}) && verdictOf(state.draft)[0] === 'sr-good');
    var h = app.querySelector('h1'); if (h && opts && opts.focus !== false) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }
  function rerender() { show(cur, { noPush: true, focus: false }); }

  app.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-back')) { show(state.stack.pop() || 'home', { noPush: true }); return; }
    if (t.dataset.go) { if (t.dataset.go === 'check') { state.draft = null; state.batchIdx = null; } show(t.dataset.go); return; }
    if (t.dataset.place != null) { state.placeObj = null; state.place = +t.dataset.place; state.out = t.dataset.out; state.back = t.dataset.backD; track('standby-place', { place: places[state.place].name }); show('flights'); return; }
    if (t.dataset.dice != null) { var dp = (state.diceList || places)[+t.dataset.dice]; state.placeObj = { name: dp.name, codes: dp.codes, days: dp.days || 4 }; show('flights'); return; }
    if (t.dataset.check) { var bits = t.dataset.check.split('-'); state.draft = { from: bits[0], to: bits[1], date: bits.slice(2).join('-') }; show('check'); return; }
    if (t.dataset.recheck) { var kb = t.dataset.recheck.split('|'); state.batch = null; state.batchIdx = null; var prev = log.filter(function (r) { return keyOf(r) === t.dataset.recheck; }).pop() || {}; state.draft = { flight: kb[0] === '?' ? '' : kb[0], date: kb[1], from: kb[2], to: kb[3], party: prev.party || 2, back: prev.back || '' }; show('check'); return; }
    if (t.dataset.batch != null) { state.batchIdx = +t.dataset.batch; state.draft = state.batch[state.batchIdx]; show('check'); return; }
    if (t.dataset.base) { baseMode = t.dataset.base; save('base', baseMode); resolveBase(); track('standby-base', { mode: baseMode }); rerender(); return; }
    if (t.dataset.flexhome != null) { settings.flexHome = t.dataset.flexhome === '1'; save('settings', settings); if (cur === 'check') readForm(); rerender(); return; }
    if (t.dataset.pickmonth != null) { state.pickMonth = +t.dataset.pickmonth; rerender(); return; }
    if (t.dataset.pick) {
      var pm = +t.dataset.month, pp = { name: t.dataset.name, codes: t.dataset.pick.split(','), days: 5 }, y = today().getFullYear() + (pm < today().getMonth() ? 1 : 0);
      var first = new Date(y, pm, 1, 12), startD = first < today() ? today() : addDays(first, -1), end = new Date(y, pm + 1, 0, 12);
      var bt = bestTrip(pp, startD, Math.max(1, Math.round((end - startD) / DAY) - pp.days + 1));
      state.placeObj = pp; state.out = iso(bt.outD); state.back = iso(bt.backD); track('standby-pick', { place: pp.name }); show('flights'); return;
    }
    if (t.dataset.calplace != null) { state.calPlace = t.dataset.calplace; rerender(); return; }
    if (t.dataset.calday) { state.calSel = t.dataset.calday; rerender(); var lb = app.querySelector('.sr-cal ~ .sr-lbl'); if (lb) lb.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (t.dataset.flex != null) { state.flex = t.dataset.flex === '1'; rerender(); return; }
    if (t.dataset.result) { var r = log.find(function (x) { return x.id === t.dataset.result; }); if (r) { r.result = r.result === t.dataset.val ? '' : t.dataset.val; save('log', log); sync(r); rerender(); } return; }
    var act = t.dataset.act;
    if (act === 'know-go') {
      var o = val('k-out'), b = val('k-back');
      if (!o || !b || b < o) { err('k-err', 'Pick a return date on or after the leave date.'); return; }
      state.placeObj = null; state.place = +val('k-place'); state.out = o; state.back = b; track('standby-know', { place: places[state.place].name }); show('flights');
    } else if (act === 'dice-places') {
      if (!diceDates()) return; state.diceList = null; track('standby-dice', { mode: 'places' }); show('dicelist');
    } else if (act === 'dice-season') {
      if (!diceDates()) return; state.diceList = picks(fromIso(state.out).getMonth()).slice(0, 10).map(function (x) { return { name: x.name, codes: x.codes, days: 5, note: 'In season: ' + x.why }; });
      track('standby-dice', { mode: 'season' }); show('dicelist');
    } else if (act === 'dice-all') {
      if (!diceDates()) return; state.diceList = Object.keys(routeData.routes).filter(function (k) { return k.indexOf(home + '-') === 0; }).map(function (k) { var c = k.split('-')[1]; return { name: (routeData.names && routeData.names[c]) || c, codes: [c] }; });
      track('standby-dice', { mode: 'all' }); show('dicelist');
    } else if (act === 'save') { saveCheck(); }
    else if (act === 'save-all') { saveAll(); }
    else if (act === 'to-batch') { readForm(); state.batchIdx = null; show('batch', { noPush: true }); }
    else if (act === 'claude') { readWithClaude(); }
    else if (act === 'csv') { csv(); }
    else if (act === 'settings-save') { saveSettings(); }
    else if (act === 'wipe') { if (t.dataset.sure) { log = []; save('log', log); rerender(); } else { t.dataset.sure = '1'; t.textContent = 'Tap again to clear ' + log.length + ' checks'; } }
  });
  app.addEventListener('input', function (e) {
    if (cur !== 'check' || !/^f-/.test(e.target.id)) return;
    readForm(); updateVerdict(); persistSoon();
  });
  app.addEventListener('change', function (e) {
    if (e.target.id === 'c-file' && e.target.files.length) { var base = state.draft || {}; readShots(e.target.files, { from: base.from || home, to: base.to || '', date: base.date || iso(today()), back: base.back || '' }); }
    if (e.target.id === 'd-file' && e.target.files[0]) readOpenList(e.target.files[0]);
    if (e.target.id === 'k-file' && e.target.files[0]) {
      var ko = val('k-out'), kp = places[+val('k-place')] || places[0];
      state.placeObj = null; state.place = +val('k-place'); state.out = ko; state.back = val('k-back');
      shotFromTrip(e.target.files, kp, ko);
    }
    if (e.target.id === 'fl-file' && e.target.files[0]) {
      shotFromTrip(e.target.files, state.placeObj || places[state.place], state.out);
    }

  });
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function err(id, msg) { var el = document.getElementById(id); if (el) { el.textContent = msg; el.hidden = !msg; } }
  function status(id, msg) { var el = document.getElementById(id); if (el) { el.textContent = msg; el.hidden = !msg; } }
  function diceDates() { var o = val('d-out'), b = val('d-back'); if (!o || !b || b < o) { status('d-status', 'Pick a return date on or after the leave date.'); return false; } state.out = o; state.back = b; return true; }
  function readForm() {
    var d = state.draft = state.draft || {};
    d.flight = val('f-flight').toUpperCase(); d.from = val('f-from').toUpperCase(); d.to = val('f-to').toUpperCase();
    d.date = val('f-date'); d.time = val('f-time'); d.openPolaris = val('f-pol'); d.sbPolaris = val('f-polsb'); d.openAll = val('f-all'); d.sbAll = val('f-allsb'); d.party = val('f-party'); d.position = val('f-position'); d.back = val('f-back');
    settle(d);
  }

  /* ---------- reading screenshots ---------- */
  var tessLoading = null;
  function tesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tessLoading) return tessLoading;
    tessLoading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload = function () { res(window.Tesseract); }; s.onerror = function () { tessLoading = null; rej(new Error('load')); };
      document.head.appendChild(s);
    });
    return tessLoading;
  }
  function fileToDataUrl(file, maxW) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, maxW / img.width), c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { rej(new Error('image')); }; img.src = url;
    });
  }
  function ocr(dataUrl, onStatus) {
    return tesseract().then(function (T) {
      return T.recognize(dataUrl, 'eng', { logger: function (m) { if (m.status === 'recognizing text') onStatus('Reading… ' + Math.round(m.progress * 100) + '%'); } });
    }).then(function (r) { return r.data.text || ''; });
  }
  /* United's mobile flight list (one screenshot, one or more flights):
       header  "Oneway · 2 Travelers · Nov 18" and "Wed, Nov 18"
       each flight: departure time, "SFO - ICN", "UA 805", "Boeing 777-200",
       "Available 37 (12/3/22)" and "Standby 10 (5/0/5)", where the brackets are Polaris / Premium Plus / Economy.
     Text recognition reads the labels and the numbers as separate columns, so this collects each kind
     in order and pairs them up by position. */
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function monthDay(mon, day) {
    var t = today(), d = new Date(t.getFullYear(), MON[mon.slice(0, 3).toLowerCase()], +day, 12);
    if (d < addDays(t, -60)) d = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate(), 12);
    return iso(d);
  }
  function parseShot(text) {
    var t = text.replace(/[–—−]/g, '-'), res = { flights: [] }, m;
    if ((m = t.match(/(\d+)\s*Travel+ers?/i))) res.party = m[1];
    if ((m = t.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/))) res.date = monthDay(m[1], m[2]);
    else if ((m = t.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/))) res.date = monthDay(m[1], m[2]);
    var routes = [], nums = [], times = [], planes = [], flights = [], re;
    re = /\b([A-Z]{3})\s*-\s*([A-Z]{3})\b/g; while ((m = re.exec(t))) routes.push([m[1], m[2]]);
    re = /\bUA\s?(\d{1,4})\b/g; while ((m = re.exec(t))) flights.push('UA ' + m[1]);
    re = /(-?\d{1,3})\s*\(\s*(-?\d{1,3})\s*\/\s*(-?\d{1,3})\s*\/\s*(-?\d{1,3})\s*\)/g; while ((m = re.exec(t))) nums.push([+m[1], +m[2], +m[3], +m[4]]);
    re = /\b(?:Boeing|Airbus|Embraer|Bombardier)\s+[\w-]+/g; while ((m = re.exec(t))) planes.push(m[0]);
    t.split(/\n+/).forEach(function (l) { var x = l.match(/\b(\d{1,2}:\d{2})\s?([ap])\.?m\b/i); if (x) times.push(x[1] + ' ' + x[2].toUpperCase() + 'M'); });
    var n = Math.max(flights.length, Math.floor(nums.length / 2));
    for (var i = 0; i < n; i++) {
      var av = nums[2 * i], sb = nums[2 * i + 1], r = routes[i] || routes[0] || [];
      var f = { flight: flights[i] || '', from: r[0] || '', to: r[1] || '', time: times[i] || '', aircraft: planes[i] || '' };
      if (av) { f.openAll = String(av[0]); f.openPolaris = String(Math.max(0, av[1])); f.openPremium = String(av[2]); f.openEconomy = String(av[3]); }
      if (sb) { f.sbAll = String(sb[0]); f.sbPolaris = String(sb[1]); f.sbPremium = String(sb[2]); f.sbEconomy = String(sb[3]); }
      res.flights.push(f);
    }
    return res;
  }
  /* Pull the numbers out of seat-count screenshot text. Layouts vary, so this looks for labels near numbers;
     anything it misses can be typed in below the verdict. */
  function parseSeats(text) {
    var out = {}, lines = text.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean), m;
    if ((m = text.match(/\b(?:UA|United)\s?(\d{1,4})\b/i))) out.flight = 'UA ' + m[1];
    if ((m = text.match(/\b([A-Z]{3})\s*(?:-|–|—|→|>|to)\s*([A-Z]{3})\b/))) { out.from = m[1]; out.to = m[2]; }
    if ((m = text.match(/\b(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?)\b/))) out.time = m[1].toUpperCase();
    var openMax = null, polaris = null, listed = null, pos = null;
    lines.forEach(function (l) {
      var n = l.match(/-?\d+/g); if (!n) return;
      var nums = n.map(Number).filter(function (x) { return x >= 0 && x < 400; });
      if (/(polaris|business|first|\bJ\b|\bPF\b)/i.test(l) && polaris == null && nums.length) { polaris = nums[nums.length - 1]; return; }
      if (/(total|all cabins|economy|coach|\bY\b|avail|open|seats? left|unsold)/i.test(l) && nums.length) { var v = Math.max.apply(null, nums); openMax = openMax == null ? v : Math.max(openMax, v); }
      if (/(standby|stby|list|non-?rev|SA\b|waitlist)/i.test(l) && listed == null) { var c = n.map(Number).filter(function (x) { return x < 400; }); if (c.length) listed = c[c.length - 1]; }
      if (/(you|your position|my position|position)/i.test(l) && pos == null) { var p = l.match(/#?\s?(\d{1,3})/); if (p) pos = +p[1]; }
    });
    if (listed == null) { var rows = lines.filter(function (l) { return /^\d{1,3}[.)]?\s+[A-Za-z]/.test(l); }); if (rows.length >= 2) listed = rows.length; }
    if (openMax != null) out.openAll = String(openMax);
    if (listed != null) out.sbAll = String(listed);
    if (polaris != null) out.openPolaris = String(polaris);
    if (listed != null) out.listed = String(listed);
    if (pos != null) out.position = String(pos);
    return out;
  }
  /* Upload from a trip screen: start the check with the route and date already filled in,
     then let the screenshot fill in (or correct) the rest. */
  function shotFromTrip(files, place, date) {
    track('standby-quick-check', { place: place ? place.name : '', count: files.length });
    readShots(files, { from: home, to: place ? place.codes[0] : '', date: date || iso(today()), back: state.back && state.back > (date || '') ? state.back : '' });
  }
  /* Read one screenshot. It can hold several flights; each becomes its own draft. */
  function readFile(file, base, onStatus) {
    return fileToDataUrl(file, 1400).then(function (url) {
      return ocr(url, onStatus).then(function (text) {
        var shot = parseShot(text), out = [];
        shot.flights.forEach(function (f) {
          var d = Object.assign({}, base, f, { img: url });
          if (shot.date) d.date = shot.date;
          if (shot.party) d.party = shot.party;
          if (!d.from) d.from = base.from; if (!d.to) d.to = base.to;
          d.status = 'Read from your screenshot. Check the numbers below.';
          out.push(settle(d));
        });
        if (!out.length) {
          var found = parseSeats(text), d = Object.assign({}, base, { img: url }), n = 0;
          Object.keys(found).forEach(function (k) { if (found[k]) { d[k] = found[k]; n++; } });
          d.status = n ? 'Read ' + n + ' value' + (n > 1 ? 's' : '') + ' from your screenshot. Check them below.' : "Couldn't find the seat counts. Type them below" + (settings.claudeKey ? ', or tap Read with Claude.' : '.');
          out.push(settle(d));
        }
        track('standby-check', { mode: 'phone', flights: shot.flights.length });
        return out;
      });
    }).catch(function () {
      return [settle(Object.assign({}, base, { status: "Couldn't read that image here. Type the numbers below" + (settings.claudeKey ? ', or tap Read with Claude.' : '.') }))];
    });
  }
  /* Read every screenshot, one after another. One flight opens the check; several open a list. */
  function readShots(files, base) {
    files = Array.prototype.slice.call(files, 0, 12);
    state.batch = []; state.batchIdx = null; state.draft = null;
    state.batchStatus = 'Reading ' + (files.length === 1 ? 'your screenshot' : files.length + ' screenshots') + ' on this phone…';
    show('batch');
    files.reduce(function (p, f, i) {
      return p.then(function () {
        return readFile(f, base, function (s) { state.batchStatus = (files.length > 1 ? 'Screenshot ' + (i + 1) + ' of ' + files.length + ': ' : '') + s; status('b-status', state.batchStatus); })
          .then(function (items) { items.forEach(autoSave); state.batch = state.batch.concat(items); if (cur === 'batch') rerender(); });
      });
    }, Promise.resolve()).then(function () {
      if (state.batch.length === 1) { state.draft = state.batch[0]; state.batch = null; show('check', { noPush: true }); return; }
      var n = state.batch.filter(function (d) { return d.logId; }).length;
      state.batchStatus = 'Found ' + state.batch.length + ' flights and saved ' + (n === state.batch.length ? 'them all' : n) + ' to your log. Tap one to check or fix its numbers.';
      if (cur === 'batch') rerender();
    });
  }
  function readOpenList(file) {
    if (!diceDates()) return;
    status('d-status', 'Reading the open-flights list on this phone…');
    fileToDataUrl(file, 1400).then(function (url) { return ocr(url, function (s) { status('d-status', s); }); }).then(function (text) {
      var seen = {}, re = /\b([A-Z]{3})\b[^\n]{0,40}?(\d{1,3})\s*(?:open|avail|seats?)?/g, m;
      while ((m = re.exec(text))) { if (m[1] === home || /^(UAL|THE|AND|FOR|MON|TUE|WED|THU|FRI|SAT|SUN|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/.test(m[1])) continue; seen[m[1]] = Math.max(seen[m[1]] || 0, +m[2]); }
      var codes = Object.keys(seen);
      if (!codes.length) { status('d-status', "Couldn't find destinations in that screenshot. Try a clearer one, or rank your places."); return; }
      state.diceList = codes.map(function (c) { var p = places.find(function (pl) { return pl.codes.indexOf(c) >= 0; }); return { name: p ? p.name : (routeData && routeData.names && routeData.names[c]) || c, codes: [c], seen: seen[c] + ' open' }; })
        .sort(function (a, b) { return parseInt(b.seen, 10) - parseInt(a.seen, 10); });
      track('standby-dice', { mode: 'screenshot', found: codes.length }); show('dicelist');
    }).catch(function () { status('d-status', "Couldn't read that image here. Try again, or rank your places."); });
  }
  function readWithClaude() {
    readForm(); var d = state.draft || {};
    if (!d.img) { state.draft = d; d.status = 'Upload a screenshot first.'; rerender(); return; }
    d.status = 'Reading with Claude…'; rerender();
    var prompt = 'This is a screenshot of standby seat information from an airline app. Reply with JSON only, no prose around it, using these keys: ' +
      '"flight" (like "UA 837"), "from" and "to" (3-letter airport codes), "date" (YYYY-MM-DD if shown), "time" (departure time), "openAll" (total open seats), "openPolaris" (open Polaris or business seats), "sbAll" (total people on standby), "sbPolaris" (people on standby for Polaris), "party" (number of travelers), ' +
      '"position" (the traveler\'s spot on the list if shown), and "advice" (two short plain sentences: how the odds look for ' + (d.party || 2) + ' travelers and a Plan B). ' +
      'On United\'s app, "Available 37 (12/3/22)" means 37 open: 12 Polaris, 3 Premium Plus, 22 Economy; "Standby 10 (5/0/5)" is the same split for the standby list. ' +
      (d.flight ? 'If several flights are shown, use ' + d.flight + '. ' : 'If several flights are shown, use the first. ') + 'Use null for anything not shown.';
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': settings.claudeKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: settings.model || 'claude-sonnet-5-5', max_tokens: 600, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d.img.split(',')[1] } }, { type: 'text', text: prompt }] }] })
    }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var txt = (j.content || []).map(function (c) { return c.text || ''; }).join(''), m = txt.match(/\{[\s\S]*\}/), o = m ? JSON.parse(m[0]) : {};
      ['flight', 'from', 'to', 'date', 'time', 'openPolaris', 'openAll', 'sbPolaris', 'sbAll', 'party', 'position', 'advice'].forEach(function (k) { if (o[k] != null && o[k] !== '') d[k] = String(o[k]); });
      settle(d);
      d.status = 'Read with Claude. Check the numbers below.'; track('standby-check', { mode: 'claude' });
      if (d.logId) persistSoon(); else autoSave(d);
      rerender();
    }).catch(function (e) {
      d.status = String(e.message) === '401' ? 'Claude rejected the key. Check it in settings.' : "Claude couldn't read it just now. Type the numbers below, or try again."; rerender();
    });
  }

  /* ---------- log ---------- */
  function toRow(d) {
    settle(d);
    var r = { id: String(Date.now()) + Math.floor(Math.random() * 1000), checked: new Date().toISOString(), date: d.date, flight: d.flight || '', from: d.from, to: d.to, time: d.time || '',
      cabin: d.cabin, aircraft: d.aircraft || '', party: d.party || '', openPolaris: d.openPolaris || '', openAll: d.openAll || '', sbPolaris: d.sbPolaris || '', sbAll: d.sbAll || '',
      open: d.open || '', listed: d.listed || '', position: d.position || '', back: d.back || '', result: '' };
    var v = verdictOf(r); r.verdict = v ? v[1] : '';
    r.daysOut = d.date ? daysOutOf(r) : '';
    return r;
  }
  /* Save a flight read from a screenshot right away; later edits update that same entry. */
  function autoSave(d) {
    if (d.logId || !d.from || !d.to || !d.date || (d.openAll === '' && d.openPolaris === '') || (d.openAll == null && d.openPolaris == null)) return;
    var r = toRow(d); d.logId = r.id; d.saved = true; log.push(r); save('log', log); sync(r);
    track('standby-save', { auto: 1, verdict: r.verdict });
  }
  var persistTimer = null;
  function persistSoon() {
    var d = state.draft; if (!d || !d.logId) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      var i = log.findIndex(function (r) { return r.id === d.logId; }); if (i < 0) return;
      var r = toRow(d); r.id = log[i].id; r.checked = log[i].checked; r.result = log[i].result; r.daysOut = log[i].daysOut;
      log[i] = r; save('log', log); sync(r);
    }, 700);
  }
  function saveCheck() {
    readForm(); var d = state.draft;
    if (!d.from || !d.to || !d.date) { status('c-status', 'Add the route and date before saving.'); return; }
    var r = toRow(d); d.logId = r.id; log.push(r); save('log', log); sync(r); track('standby-save', { verdict: r.verdict });
    if (state.batchIdx != null) { d.saved = true; state.batchIdx = null; state.draft = null; show('batch', { noPush: true }); return; }
    state.draft = null; show('log');
  }
  function saveAll() {
    var n = 0;
    (state.batch || []).forEach(function (d) {
      if (d.saved || !d.from || !d.to || !d.date) return;
      var r = toRow(d); d.logId = r.id; log.push(r); sync(r); d.saved = true; n++;
    });
    save('log', log); track('standby-save', { count: n });
    state.batchStatus = n ? 'Saved ' + n + ' to your log.' : 'Nothing new to save. Each one needs a route and a date.';
    rerender();
  }
  function sync(r) {
    if (!settings.sheetUrl) return;
    try { fetch(settings.sheetUrl, { method: 'POST', mode: 'no-cors', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(r) }); } catch (e) {}
  }
  function csv() {
    var cols = ['checked', 'daysOut', 'date', 'flight', 'from', 'to', 'time', 'aircraft', 'party', 'cabin', 'openPolaris', 'sbPolaris', 'openAll', 'sbAll', 'open', 'listed', 'position', 'verdict', 'result'];
    var rows = [cols.join(',')].concat(log.map(function (r) { return cols.map(function (c) { return '"' + String(r[c] == null ? '' : r[c]).replace(/"/g, '""') + '"'; }).join(','); }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); a.download = 'standby-log.csv'; a.click();
  }
  function saveSettings() {
    var hm = val('s-home').toUpperCase(), lines = val('s-places').split('\n').map(function (l) { return l.trim(); }).filter(Boolean), out = [];
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(',').map(function (x) { return x.trim(); });
      var codes = (parts[1] || '').toUpperCase().split(/[\s/]+/).filter(function (c) { return /^[A-Z]{3}$/.test(c); });
      if (!parts[0] || !codes.length) { err('s-err', 'Line ' + (i + 1) + ' needs a name and at least one 3-letter airport code, like "Japan, NRT HND, 5".'); return; }
      out.push({ name: parts[0], codes: codes, days: Math.max(1, Math.min(21, parseInt(parts[2], 10) || 4)) });
    }
    if (!/^[A-Z]{3}$/.test(hm)) { err('s-err', 'Home airport needs a 3-letter code, like SFO.'); return; }
    var sheet = val('s-sheet');
    if (sheet && !/^https:\/\/script\.google\.com\//.test(sheet)) { err('s-err', 'The sheet link should start with https://script.google.com/'); return; }
    var alt = val('s-alt').toUpperCase();
    if (alt && !/^[A-Z]{3}$/.test(alt)) { err('s-err', 'Second base camp needs a 3-letter code, like BOS.'); return; }
    homeMain = hm; settings.alt = alt; settings.altMonths = alt ? monthsOf(val('s-altm')) : []; resolveBase();
    places = out; settings.sheetUrl = sheet; settings.claudeKey = val('s-key');
    save('home', homeMain); save('places', places); save('settings', settings);
    show('home', { noPush: true });
  }

  /* ---------- start ---------- */
  fetch('data/seasons.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.places) { seasonData = j; if (cur === 'home') rerender(); } }).catch(function () {});
  fetch('data/routes.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.routes) { routeData = j; if (cur === 'home') rerender(); } }).catch(function () {});
  show('home', { noPush: true, focus: false });
})();
