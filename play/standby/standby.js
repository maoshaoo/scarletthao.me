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
  var places = load('places', DEFAULT_PLACES);
  var home = load('home', 'SFO');
  var log = load('log', []);
  var settings = load('settings', { sheetUrl: '', claudeKey: '', model: 'claude-sonnet-5-5' });
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
    var lf = routeData && routeData.routes && routeData.routes[routeKey(a, b)];
    if (lf && lf[d.getMonth() + 1]) { var f = lf[d.getMonth() + 1]; s += Math.round((0.85 - f) * 120); why.push(Math.round(f * 100) + '% full on average that month'); }
    var fpd = routeData && routeData.flightsPerDay && routeData.flightsPerDay[routeKey(a, b)];
    if (fpd && fpd[d.getMonth() + 1]) { var n = fpd[d.getMonth() + 1]; s += Math.min(8, Math.round(n * 2)); why.push('about ' + (n >= 1 ? Math.round(n) : 'less than 1') + ' United flight' + (n >= 1.5 ? 's' : '') + ' a day'); }
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
  var GOOD_SPARE = 5, TIGHT_SPARE = 1;
  function spareOf(r) {
    var open = +r.open || 0, pos = +r.position || 0, listed = +r.listed || 0;
    var ahead = pos ? pos - 1 : listed;
    return open - ahead;
  }
  function verdictOf(r) {
    if (r.open === '' || r.open == null) return null;
    var s = spareOf(r);
    return s >= GOOD_SPARE ? ['sr-good', 'Good odds', s] : s >= TIGHT_SPARE ? ['sr-tight', 'Tight', s] : ['sr-no', 'Unlikely', s];
  }

  /* International flights count Polaris (business) seats; domestic flights count every open seat. */
  var NON_US = 'NRT HND KIX ICN TPE HKG PVG PEK SIN MNL BKK SYD MEL BNE AKL NAN PPT LHR LGW DUB CDG FRA MUC ZRH AMS FCO MAD BCN LIS ATH TLV DXB DEL BOM JNB YVR YYZ YUL YYC MEX CUN SJD PVR GDL BZE SJO LIR PTY BOG LIM SCL EZE GRU GIG'.split(' ');
  function isIntl(d) {
    var c = routeData && routeData.countries;
    return [d.from, d.to].some(function (x) { if (!x) return false; if (c && c[x]) return c[x] !== 'United States'; return NON_US.indexOf(x) >= 0; });
  }
  function settle(d) { d.cabin = isIntl(d) ? 'Polaris' : 'All cabins'; d.open = d.cabin === 'Polaris' ? (d.openPolaris || '') : (d.openAll || ''); return d; }

  /* ---------- screens ---------- */
  var state = { place: null, out: null, back: null, flex: true, draft: null, stack: [] };
  function bar(back) {
    return '<div class="sr-bar">' + (back ? '<button class="sr-back" data-back>&larr; Back</button>' : '<span></span>') +
      '<nav class="sr-tabs" aria-label="Standby Radar"><button class="sr-tab" data-go="home"' + (cur === 'home' ? ' aria-current="page"' : '') + '>Home</button>' +
      '<button class="sr-tab" data-go="log"' + (cur === 'log' ? ' aria-current="page"' : '') + '>Log</button>' +
      '<button class="sr-tab" data-go="settings"' + (cur === 'settings' ? ' aria-current="page"' : '') + ' aria-label="Settings">&#9881;</button></nav></div>';
  }
  function pill(b) { return '<span class="sr-pill ' + b[0] + '">' + b[1] + '</span>'; }
  function placeCard(p, idx) {
    var t = bestTrip(p, today(), 42), b = band(t.score);
    var why = t.out.why.concat(t.back.why);
    var note = why.length ? why[0] : (t.out.score >= 62 ? 'Midweek trip, away from holiday peaks' : 'Forecast from day of week and holiday peaks');
    return '<button class="sr-card" data-place="' + idx + '" data-out="' + iso(t.outD) + '" data-back-d="' + iso(t.backD) + '">' +
      '<span class="t"><b>' + esc(p.name) + ' <span class="r">' + home + ' &rarr; ' + p.codes.map(esc).join(', ') + '</span></b>' + pill(b) + '</span>' +
      '<span class="sr-when">Best: ' + fmt(t.outD) + ' out · ' + fmt(t.backD) + ' back</span><small>' + esc(note) + '</small></button>';
  }
  var S = {};
  S.home = function () {
    return '<div class="sr-bar"><span></span><nav class="sr-tabs" aria-label="Standby Radar"><button class="sr-tab" data-go="log">Log</button><button class="sr-tab" data-go="settings" aria-label="Settings">&#9881;</button></nav></div>' +
      '<h1 class="sr-title">Standby Radar<span>.</span></h1>' +
      '<p class="sr-intro">We\u2019re lucky to have a great friend who shares their United standby travel with us. We\u2019ve used it, but not nearly enough. This is our nudge to take a trip once a month and see the world.</p>' +
      '<div class="sr-lbl">Your places · next 6 weeks</div>' +
      places.map(placeCard).join('') +
      '<div class="sr-ctas"><button class="sr-cta" data-go="know"><i aria-hidden="true">&#8982;</i>I know where and when</button>' +
      '<button class="sr-cta alt" data-go="dice"><i aria-hidden="true">&#9860;</i>Roll the dice</button></div>';
  };
  S.know = function () {
    var p = state.place != null ? state.place : 0, o = state.out || iso(addDays(today(), 7)), b = state.back || iso(addDays(today(), 7 + (places[p] ? places[p].days - 1 : 3)));
    return bar(true) + '<h1 class="sr-h">Where and when?</h1>' +
      '<label class="sr-field">Where<select id="k-place">' + places.map(function (pl, i) { return '<option value="' + i + '"' + (i === +p ? ' selected' : '') + '>' + esc(pl.name) + ' (' + pl.codes.join(', ') + ')</option>'; }).join('') + '</select></label>' +
      '<div class="sr-row2"><label class="sr-field">Leave<input type="date" id="k-out" value="' + o + '"></label><label class="sr-field">Back<input type="date" id="k-back" value="' + b + '"></label></div>' +
      '<div class="sr-chips"><button class="sr-chip" data-flex="1" aria-pressed="' + state.flex + '">&plusmn; 1 day is fine</button><button class="sr-chip" data-flex="0" aria-pressed="' + !state.flex + '">Exact dates</button></div>' +
      '<p class="sr-err" id="k-err" hidden></p>' +
      '<button class="sr-btn" data-act="know-go">Show flights</button>' +
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
      (routeData ? '<button class="sr-btn ghost" data-act="dice-all">Rank everywhere United flies from ' + home + '</button>' : '<p class="sr-sub">"Everywhere United flies" turns on once route history is loaded.</p>');
  };
  S.dicelist = function () {
    var o = fromIso(state.out), b = fromIso(state.back);
    var list = (state.diceList || places.map(function (p) { return p; })).map(function (p, i) { var t = tripScore(p, o, b); return { p: p, t: t, i: i }; })
      .sort(function (x, y) { return y.t.score - x.t.score; }).slice(0, 12);
    return bar(true) + '<h1 class="sr-h">' + fmt(o) + ' &ndash; ' + fmt(b) + '</h1><p class="sr-sub">Ranked by how open the trip looks, out and back.</p>' +
      list.map(function (x) {
        var bd = band(x.t.score), why = x.t.out.why.concat(x.t.back.why);
        return '<button class="sr-card" data-dice="' + x.i + '"><span class="t"><b>' + esc(x.p.name) + ' <span class="r">' + home + ' &rarr; ' + x.p.codes.map(esc).join(', ') + '</span></b>' + pill(bd) + '</span>' +
          (x.p.seen ? '<span class="sr-when">From your screenshot: ' + esc(x.p.seen) + '</span>' : '') +
          '<small>' + esc(why[0] || 'Day of week and holiday peaks') + '</small></button>';
      }).join('') || '<p class="sr-empty">Nothing found. Try another screenshot, or rank your places.</p>';
  };
  function dayRow(label, a, b, d) {
    var r = scoreDay(a, b, d), bd = band(r.score);
    return '<button class="sr-card" data-check="' + a + '-' + b + '-' + iso(d) + '"><span class="t"><b>' + label + ' · ' + fmt(d) + ' <span class="r">' + a + ' &rarr; ' + b + '</span></b>' + pill(bd) + '</span><small>' + esc(r.why.join(' · ') || 'Day of week and holiday peaks') + '</small></button>';
  }
  S.flights = function () {
    var p = state.placeObj || places[state.place], o = fromIso(state.out), b = fromIso(state.back), h = '';
    h += bar(true) + '<h1 class="sr-h">' + esc(p.name) + ' · ' + fmt(o) + ' &ndash; ' + fmt(b) + '</h1>';
    h += '<label class="sr-drop"><b>Upload a seat-count screenshot</b>Jump straight to the check for any of these days<input type="file" accept="image/*" multiple id="fl-file"></label>';
    h += '<div class="sr-lbl">Going</div>';
    var outDays = state.flex ? [-1, 0, 1] : [0];
    p.codes.forEach(function (c) { outDays.forEach(function (k) { h += dayRow(k === 0 ? 'Planned' : k < 0 ? 'Day before' : 'Day after', home, c, addDays(o, k)); }); });
    h += '<div class="sr-lbl">Coming back</div>';
    p.codes.forEach(function (c) { outDays.forEach(function (k) { h += dayRow(k === 0 ? 'Planned' : k < 0 ? 'Day before' : 'Day after', c, home, addDays(b, k)); }); });
    h += '<p class="sr-note">Specific flight times come with the schedule feed. For now, tap a day to check real seats with a screenshot on the day you fly.</p>';
    return h;
  };
  S.check = function () {
    var d = state.draft || {}, v = verdictOf(d);
    settle(d);
    var h = bar(true) + '<h1 class="sr-h">Check real seats</h1>' +
      (state.batchIdx != null ? '<button class="sr-link" data-act="to-batch">&larr; All ' + state.batch.length + ' screenshots</button>' : '') +
      '<label class="sr-drop"><b>Upload screenshots</b>Seat counts and standby list from the airline app. Pick one or several.<input type="file" accept="image/*" multiple id="c-file"></label>' +
      (d.img ? '<img class="sr-thumb" src="' + d.img + '" alt="Your screenshot">' : '') +
      '<p class="sr-note" id="c-status"' + (d.status ? '' : ' hidden') + '>' + esc(d.status || '') + '</p>';
    h += '<div id="c-verdict">' + verdictHtml(d) + '</div>';
    if (d.advice) h += '<p class="sr-claude">' + esc(d.advice) + '</p>';
    h += '<div class="sr-lbl">Check the numbers</div>' +
      '<div class="sr-grid"><label class="sr-field">Flight<input id="f-flight" value="' + esc(d.flight) + '" placeholder="UA 837"></label>' +
      '<label class="sr-field">From<input id="f-from" value="' + esc(d.from || home) + '" maxlength="3"></label>' +
      '<label class="sr-field">To<input id="f-to" value="' + esc(d.to) + '" maxlength="3"></label></div>' +
      '<div class="sr-row2"><label class="sr-field">Date<input type="date" id="f-date" value="' + esc(d.date || iso(today())) + '"></label><label class="sr-field">Departs<input id="f-time" value="' + esc(d.time) + '" placeholder="11:05 AM"></label></div>' +
      '<div class="sr-row2"><label class="sr-field">Polaris open<input inputmode="numeric" id="f-pol" value="' + esc(d.openPolaris) + '"></label>' +
      '<label class="sr-field">All cabins open<input inputmode="numeric" id="f-all" value="' + esc(d.openAll) + '"></label></div>' +
      '<p class="sr-sub" id="f-cabin">' + cabinNote(d) + '</p>' +
      '<div class="sr-row2"><label class="sr-field">On the list<input inputmode="numeric" id="f-listed" value="' + esc(d.listed) + '"></label>' +
      '<label class="sr-field">Your spot<input inputmode="numeric" id="f-position" value="' + esc(d.position) + '"></label></div>' +
      '<div class="sr-row2"><button class="sr-btn" data-act="save">Save to log</button>' +
      '<button class="sr-btn ghost" data-act="claude"' + (settings.claudeKey ? '' : ' disabled title="Add your Claude key in settings"') + '>Read with Claude</button></div>' +
      (settings.claudeKey ? '' : '<button class="sr-link" data-go="settings">Turn on "Read with Claude"</button>');
    return h;
  };
  function cabinNote(d) { return d.cabin === 'Polaris' ? 'International, so the verdict counts Polaris seats.' : 'Domestic, so the verdict counts every open seat.'; }
  function verdictHtml(d) {
    var v = verdictOf(d); if (!v) return '';
    return '<div class="sr-verdict ' + v[0] + '"><span class="flt">' + esc([d.flight, (d.from || '') + (d.to ? ' → ' + d.to : ''), d.date ? fmt(fromIso(d.date)) : '', d.time].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="big">' + v[1] + '</span><div class="sr-nums"><div class="sr-num"><b>' + esc(d.open) + '</b><span>' + (d.cabin === 'Polaris' ? 'Polaris open' : 'Open seats') + '</span></div>' +
      '<div class="sr-num"><b>' + (d.position ? '#' + esc(d.position) : esc(d.listed || 0)) + '</b><span>' + (d.position ? 'Your spot' : 'On the list') + '</span></div>' +
      '<div class="sr-num"><b>' + v[2] + '</b><span>To spare</span></div></div></div>';
  }
  function updateVerdict() {
    var box = document.getElementById('c-verdict'); if (box) box.innerHTML = verdictHtml(state.draft || {});
    var cn = document.getElementById('f-cabin'); if (cn) cn.textContent = cabinNote(state.draft || {});
    var v = verdictOf(state.draft || {}); document.body.classList.toggle('fast', !!v && v[0] === 'sr-good');
  }
  S.batch = function () {
    var b = state.batch || [], left = b.filter(function (d) { return !d.saved; }).length;
    var h = bar(true) + '<h1 class="sr-h">' + b.length + ' screenshots</h1>' +
      '<p class="sr-note" id="b-status"' + (state.batchStatus ? '' : ' hidden') + '>' + esc(state.batchStatus || '') + '</p>';
    b.forEach(function (d, i) {
      settle(d); var v = verdictOf(d);
      h += '<button class="sr-card" data-batch="' + i + '"><span class="t"><b>' + esc([d.flight, (d.from || '?') + ' → ' + (d.to || '?')].filter(Boolean).join(' · ')) + '</b>' + (d.saved ? '<span class="sr-pill sr-good">Saved</span>' : v ? pill(v) : '<span class="sr-pill sr-tight">' + (d.reading ? 'Reading…' : 'Needs numbers') + '</span>') + '</span>' +
        '<span class="sr-when">' + esc([d.date ? fmt(fromIso(d.date)) : '', d.time].filter(Boolean).join(' · ')) + '</span>' +
        '<small>' + esc(v ? (d.open + (d.cabin === 'Polaris' ? ' Polaris' : '') + ' open · ' + (d.position ? '#' + d.position + ' on the list' : (d.listed || 0) + ' on the list') + ' · ' + v[2] + ' to spare') : 'Tap to check the numbers') + '</small></button>';
    });
    h += '<button class="sr-btn" data-act="save-all"' + (left ? '' : ' disabled') + '>Save ' + (left === b.length ? 'all' : 'the rest') + ' to log</button>';
    return h;
  };
  S.log = function () {
    var made = log.filter(function (r) { return r.result === 'Made it'; }).length;
    var tried = log.filter(function (r) { return r.result === 'Made it' || r.result === 'Bumped'; }).length;
    var byDay = {}; log.forEach(function (r) { if (r.open === '' || r.open == null) return; var k = new Date(r.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' }); (byDay[k] = byDay[k] || []).push(spareOf(r)); });
    var bestDay = '–', bestAvg = -1e9; Object.keys(byDay).forEach(function (k) { var a = byDay[k].reduce(function (s, x) { return s + x; }, 0) / byDay[k].length; if (a > bestAvg) { bestAvg = a; bestDay = k; } });
    var h = bar(true) + '<h1 class="sr-h">Your log</h1>' +
      '<div class="sr-stats"><div class="sr-stat"><b>' + log.length + '</b><span>Checks</span></div><div class="sr-stat"><b>' + made + '/' + tried + '</b><span>Made it</span></div><div class="sr-stat"><b>' + bestDay + '</b><span>Best day</span></div></div>';
    if (!log.length) h += '<p class="sr-empty">No checks yet. Check real seats with a screenshot and they show up here.</p>';
    log.slice().reverse().forEach(function (r) {
      var v = verdictOf(r);
      h += '<div class="sr-card"><span class="t"><b>' + esc(r.from) + ' &rarr; ' + esc(r.to) + ' · ' + fmt(fromIso(r.date)) + '</b>' + (v ? pill(v) : '') + '</span>' +
        '<small>' + esc([r.flight, r.open !== '' ? r.open + (r.cabin === 'Polaris' ? ' Polaris' : '') + ' open' : '', r.position ? '#' + r.position + ' on the list' : r.listed ? r.listed + ' on the list' : ''].filter(Boolean).join(' · ')) + '</small>' +
        '<div class="sr-chips" role="group" aria-label="How did it go?">' + ['Made it', 'Bumped', "Didn't try"].map(function (x) { return '<button class="sr-chip" data-result="' + r.id + '" data-val="' + x + '" aria-pressed="' + (r.result === x) + '">' + x + '</button>'; }).join('') + '</div></div>';
    });
    h += '<p class="sr-note">' + (settings.sheetUrl ? 'Each check is also sent to your Google Sheet.' : 'Saved on this phone. Add your private sheet link in settings to sync it.') + '</p>' +
      '<button class="sr-btn ghost" data-act="csv"' + (log.length ? '' : ' disabled') + '>Download CSV</button>';
    return h;
  };
  S.settings = function () {
    return bar(true) + '<h1 class="sr-h">Settings</h1><p class="sr-sub">Stored only on this device.</p>' +
      '<label class="sr-field">Home airport<input id="s-home" value="' + esc(home) + '" maxlength="3"></label>' +
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
    if (t.dataset.batch != null) { state.batchIdx = +t.dataset.batch; state.draft = state.batch[state.batchIdx]; show('check'); return; }
    if (t.dataset.flex != null) { state.flex = t.dataset.flex === '1'; rerender(); return; }
    if (t.dataset.result) { var r = log.find(function (x) { return x.id === t.dataset.result; }); if (r) { r.result = r.result === t.dataset.val ? '' : t.dataset.val; save('log', log); sync(r); rerender(); } return; }
    var act = t.dataset.act;
    if (act === 'know-go') {
      var o = val('k-out'), b = val('k-back');
      if (!o || !b || b < o) { err('k-err', 'Pick a return date on or after the leave date.'); return; }
      state.placeObj = null; state.place = +val('k-place'); state.out = o; state.back = b; track('standby-know', { place: places[state.place].name }); show('flights');
    } else if (act === 'dice-places') {
      if (!diceDates()) return; state.diceList = null; track('standby-dice', { mode: 'places' }); show('dicelist');
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
    readForm(); updateVerdict();
  });
  app.addEventListener('change', function (e) {
    if (e.target.id === 'c-file' && e.target.files.length) { var base = state.draft || {}; readShots(e.target.files, { from: base.from || home, to: base.to || '', date: base.date || iso(today()) }); }
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
    d.date = val('f-date'); d.time = val('f-time'); d.openPolaris = val('f-pol'); d.openAll = val('f-all'); d.listed = val('f-listed'); d.position = val('f-position');
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
    if (polaris != null) out.openPolaris = String(polaris);
    if (listed != null) out.listed = String(listed);
    if (pos != null) out.position = String(pos);
    return out;
  }
  /* Upload from a trip screen: start the check with the route and date already filled in,
     then let the screenshot fill in (or correct) the rest. */
  function shotFromTrip(files, place, date) {
    track('standby-quick-check', { place: place ? place.name : '', count: files.length });
    readShots(files, { from: home, to: place ? place.codes[0] : '', date: date || iso(today()) });
  }
  /* Read one screenshot into a draft. Values found in the image fill in or replace the starting ones. */
  function readInto(d, file, onStatus) {
    d.reading = true;
    return fileToDataUrl(file, 1400).then(function (url) {
      d.img = url; d.advice = '';
      return ocr(url, onStatus).then(function (text) {
        var found = parseSeats(text), n = 0;
        Object.keys(found).forEach(function (k) { if (found[k]) { d[k] = found[k]; n++; } });
        settle(d); d.reading = false;
        d.status = n ? 'Read ' + n + ' value' + (n > 1 ? 's' : '') + ' from your screenshot. Check them below.' : "Couldn't find the seat counts. Type them below" + (settings.claudeKey ? ', or tap Read with Claude.' : '.');
        track('standby-check', { mode: 'phone', found: n });
      });
    }).catch(function () { d.reading = false; d.status = "Couldn't read that image here. Type the numbers below" + (settings.claudeKey ? ', or tap Read with Claude.' : '.'); });
  }
  /* One screenshot opens the check. Several open a list, read one after another, each with its own verdict. */
  function readShots(files, base) {
    files = Array.prototype.slice.call(files, 0, 12);
    if (files.length === 1) {
      state.batch = null; state.batchIdx = null; state.draft = Object.assign({}, base);
      show('check'); status('c-status', 'Reading your screenshot on this phone…');
      readInto(state.draft, files[0], function (s) { status('c-status', s); }).then(rerender);
      return;
    }
    state.batch = files.map(function () { return Object.assign({ reading: true }, base); });
    state.batchIdx = null; state.batchStatus = 'Reading ' + files.length + ' screenshots on this phone…';
    show('batch');
    files.reduce(function (p, f, i) {
      return p.then(function () {
        return readInto(state.batch[i], f, function (s) { state.batchStatus = 'Screenshot ' + (i + 1) + ' of ' + files.length + ': ' + s; status('b-status', state.batchStatus); })
          .then(function () { if (cur === 'batch') rerender(); });
      });
    }, Promise.resolve()).then(function () { state.batchStatus = 'Done. Tap any screenshot to check or fix its numbers.'; if (cur === 'batch') rerender(); });
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
      '"flight" (like "UA 837"), "from" and "to" (3-letter airport codes), "date" (YYYY-MM-DD if shown), "time" (departure time), "openPolaris" (open seats in Polaris or business class, a number), "openAll" (total open seats across all cabins, a number), ' +
      '"listed" (people on the standby list, a number), "position" (the traveler\'s spot on the list if shown, a number), and "advice" (two short plain sentences: how the odds look and a Plan B). Use null for anything not shown.';
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': settings.claudeKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: settings.model || 'claude-sonnet-5-5', max_tokens: 600, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d.img.split(',')[1] } }, { type: 'text', text: prompt }] }] })
    }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var txt = (j.content || []).map(function (c) { return c.text || ''; }).join(''), m = txt.match(/\{[\s\S]*\}/), o = m ? JSON.parse(m[0]) : {};
      ['flight', 'from', 'to', 'date', 'time', 'openPolaris', 'openAll', 'listed', 'position', 'advice'].forEach(function (k) { if (o[k] != null && o[k] !== '') d[k] = String(o[k]); });
      settle(d);
      d.status = 'Read with Claude. Check the numbers below.'; track('standby-check', { mode: 'claude' }); rerender();
    }).catch(function (e) {
      d.status = String(e.message) === '401' ? 'Claude rejected the key. Check it in settings.' : "Claude couldn't read it just now. Type the numbers below, or try again."; rerender();
    });
  }

  /* ---------- log ---------- */
  function toRow(d) {
    settle(d);
    var r = { id: String(Date.now()) + Math.floor(Math.random() * 1000), checked: new Date().toISOString(), date: d.date, flight: d.flight || '', from: d.from, to: d.to, time: d.time || '',
      cabin: d.cabin, openPolaris: d.openPolaris || '', openAll: d.openAll || '', open: d.open || '', listed: d.listed || '', position: d.position || '', result: '' };
    var v = verdictOf(r); r.verdict = v ? v[1] : '';
    return r;
  }
  function saveCheck() {
    readForm(); var d = state.draft;
    if (!d.from || !d.to || !d.date) { status('c-status', 'Add the route and date before saving.'); return; }
    var r = toRow(d); log.push(r); save('log', log); sync(r); track('standby-save', { verdict: r.verdict });
    if (state.batchIdx != null) { d.saved = true; state.batchIdx = null; state.draft = null; show('batch', { noPush: true }); return; }
    state.draft = null; show('log');
  }
  function saveAll() {
    var n = 0;
    (state.batch || []).forEach(function (d) {
      if (d.saved || !d.from || !d.to || !d.date) return;
      var r = toRow(d); log.push(r); sync(r); d.saved = true; n++;
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
    var cols = ['checked', 'date', 'flight', 'from', 'to', 'time', 'cabin', 'openPolaris', 'openAll', 'open', 'listed', 'position', 'verdict', 'result'];
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
    home = hm; places = out; settings.sheetUrl = sheet; settings.claudeKey = val('s-key');
    save('home', home); save('places', places); save('settings', settings);
    show('home', { noPush: true });
  }

  /* ---------- start ---------- */
  fetch('data/routes.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.routes) { routeData = j; if (cur === 'home') rerender(); } }).catch(function () {});
  show('home', { noPush: true, focus: false });
})();
