/* Snacky Vespa: builds a random scenic loop through San Francisco around Sunday's weather and a snack stop.
   Weather: Open-Meteo hourly forecast for four parts of the city. Routes are drawn on a sketch map;
   Google Maps handles turn-by-turn. Nothing about the visitor leaves the browser. */
(function () {
  'use strict';

  // ---------- Data ----------
  // Start areas are neighborhoods, never addresses.
  var STARTS = {
    mission: { name: 'Mission', p: [37.7599, -122.4148] },
    richmond: { name: 'Inner Richmond', p: [37.7800, -122.4640] },
    marina: { name: 'Marina', p: [37.8030, -122.4380] },
    noe: { name: 'Noe Valley', p: [37.7502, -122.4337] },
    soma: { name: 'SoMa', p: [37.7785, -122.4056] }
  };
  // Snack spots. fav = one of Scarlett's favorites.
  var SPOTS = [
    { n: 'Tartine Bakery', t: 'pastry', p: [37.7614, -122.4241], hood: 'Mission' },
    { n: 'Arsicault Bakery', t: 'pastry', p: [37.7832, -122.4598], hood: 'Inner Richmond' },
    { n: 'b. Patisserie', t: 'pastry', p: [37.7877, -122.4418], hood: 'Lower Pac Heights' },
    { n: "Devil's Teeth Baking Co.", t: 'pastry', p: [37.7535, -122.5040], hood: 'Outer Sunset' },
    { n: 'Jane the Bakery', t: 'pastry', p: [37.7853, -122.4378], hood: 'Fillmore' },
    { n: 'Shanghai Dumpling King', t: 'dumplings', p: [37.7678, -122.4295], hood: 'Duboce Triangle', fav: 1 },
    { n: 'Good Luck Dim Sum', t: 'dumplings', p: [37.7830, -122.4655], hood: 'Inner Richmond' },
    { n: 'Dragon Beaux', t: 'dumplings', p: [37.7807, -122.4815], hood: 'Outer Richmond' },
    { n: 'Kingdom of Dumpling', t: 'dumplings', p: [37.7425, -122.4845], hood: 'Parkside' },
    { n: 'Yank Sing', t: 'dumplings', p: [37.7922, -122.3926], hood: 'Rincon Center' },
    { n: 'Andytown Coffee', t: 'coffee', p: [37.7576, -122.5025], hood: 'Outer Sunset' },
    { n: 'Sightglass', t: 'coffee', p: [37.7770, -122.4085], hood: 'SoMa' },
    { n: 'The Warming Hut', t: 'coffee', p: [37.8075, -122.4733], hood: 'Crissy Field' },
    { n: 'Ritual Coffee', t: 'coffee', p: [37.7565, -122.4215], hood: 'Mission' },
    { n: 'Trouble Coffee', t: 'coffee', p: [37.7605, -122.5050], hood: 'Outer Sunset' },
    { n: 'La Palma Mexicatessen', t: 'chips', p: [37.7529, -122.4110], hood: 'Mission' },
    { n: 'Bi-Rite Market', t: 'chips', p: [37.7616, -122.4256], hood: 'Mission' },
    { n: 'Marina Safeway', t: 'chips', p: [37.8035, -122.4365], hood: 'Marina' },
    { n: 'Gus’s Community Market', t: 'chips', p: [37.7620, -122.4120], hood: 'Mission' },
    { n: 'The Slice Pizza', t: 'pizza', p: [37.7676, -122.4297], hood: 'Duboce Triangle', fav: 1 },
    { n: 'Golden Boy Pizza', t: 'pizza', p: [37.7997, -122.4083], hood: 'North Beach' },
    { n: 'Outer Orbit', t: 'pizza', p: [37.7795, -122.4645], hood: 'Inner Richmond' },
    { n: 'Square Pie Guys', t: 'pizza', p: [37.7700, -122.4120], hood: 'SoMa' }
  ];
  // Curious stops. exp = exposed to wind.
  var CURIOS = [
    { n: 'Wave Organ', p: [37.8085, -122.4400], b: 'A jetty that plays the tide. Best at high tide.' },
    { n: 'Sutro Baths ruins', p: [37.7800, -122.5120], b: 'Ruins of a giant 1890s bathhouse on the cliffs.', exp: 1 },
    { n: 'Lands End Labyrinth', p: [37.7860, -122.5000], b: 'A stone labyrinth on a cliff, rebuilt by strangers whenever it gets knocked over.', exp: 1 },
    { n: '16th Avenue Tiled Steps', p: [37.7563, -122.4732], b: '163 mosaic steps, from sea to sky.' },
    { n: 'Seward Street Slides', p: [37.7576, -122.4400], b: 'Concrete slides for all ages. Cardboard helps.' },
    { n: 'Lyon Street Steps', p: [37.7935, -122.4466], b: 'Hedges, mansions, and a view of the Palace of Fine Arts.' },
    { n: 'Golden Fire Hydrant', p: [37.7586, -122.4270], b: 'The hydrant that kept running in 1906. Repainted gold every April.' },
    { n: 'Bernal Heights swing', p: [37.7432, -122.4148], b: 'A rope swing with the whole skyline below you.', exp: 1 },
    { n: 'Filbert Steps', p: [37.8015, -122.4050], b: 'Gardens, cottages, and the wild parrots of Telegraph Hill.' },
    { n: 'Balmy Alley murals', p: [37.7520, -122.4120], b: 'A whole alley of murals, repainted over decades.' },
    { n: 'Bison paddock', p: [37.7700, -122.4980], b: 'Yes, bison. In Golden Gate Park. Since 1891.' },
    { n: 'Under the bridge at Fort Point', p: [37.8100, -122.4770], b: 'Stand right under the Golden Gate Bridge.', exp: 1 },
    { n: 'Musée Mécanique', p: [37.8090, -122.4160], b: 'Antique arcade machines. Bring quarters.' },
    { n: 'Dutch Windmill', p: [37.7710, -122.5090], b: 'A real windmill and tulip garden by the ocean.', exp: 1 },
    { n: 'Twin Peaks', p: [37.7544, -122.4477], b: 'The whole city in one look, if Karl allows.', exp: 1 },
    { n: 'Corona Heights', p: [37.7650, -122.4385], b: 'Red rocks, a small summit, and dogs everywhere.', exp: 1 },
    { n: 'Stow Lake boathouse', p: [37.7710, -122.4760], b: 'Paddle boats and a waterfall on a hill in the lake.' },
    { n: 'Sea lions at Pier 39', p: [37.8087, -122.4098], b: 'Loud, smelly, delightful.' },
    { n: 'Hidden Garden Steps', p: [37.7605, -122.4732], b: 'More mosaic steps, with butterflies and lizards.' },
    { n: 'Mount Davidson cross', p: [37.7383, -122.4537], b: 'The highest point in SF, deep in a eucalyptus forest.' }
  ];
  // Four parts of the city, each with its own forecast. f = where the forecast is taken; c = where the map tag sits.
  var ZONES = {
    west: { name: 'the west side', short: 'Ocean Beach', f: [37.7600, -122.5050], c: [37.7600, -122.4990] },
    north: { name: 'the Presidio', short: 'Presidio', f: [37.7990, -122.4660], c: [37.7990, -122.4660] },
    central: { name: 'Twin Peaks', short: 'Twin Peaks', f: [37.7544, -122.4477], c: [37.7520, -122.4560] },
    east: { name: 'the east side', short: 'Mission', f: [37.7599, -122.4148], c: [37.7720, -122.4040] }
  };
  var ZKEYS = ['west', 'north', 'central', 'east'];
  // Used only if the forecast can't load: a typical foggy Sunday morning.
  var TYPICAL = {
    west: { sky: 'fog', t: 54, w: 10, g: 18, v: 0.3 }, north: { sky: 'patchy', t: 56, w: 12, g: 20, v: 1.5 },
    central: { sky: 'sun', t: 60, w: 16, g: 28, v: 10 }, east: { sky: 'sun', t: 64, w: 7, g: 14, v: 10 }
  };
  var NOUN = { pastry: 'Pastry', dumplings: 'Dumplings', coffee: 'Coffee', chips: 'Chips', pizza: 'Pizza' };

  // ---------- Helpers ----------
  var B = { minLng: -122.52, maxLng: -122.35, maxLat: 37.815 }, COS = Math.cos(37.76 * Math.PI / 180), K = 1000 / ((B.maxLng - B.minLng) * COS);
  function xy(lat, lng) { return [((lng - B.minLng) * COS * K), ((B.maxLat - lat) * K)]; }
  function miles(a, b) { // straight line x 1.35 for streets
    var R = 3958.8, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h)) * 1.35;
  }
  function pathMiles(ps) { var m = 0; for (var i = 1; i < ps.length; i++) m += miles(ps[i - 1], ps[i]); return m; }
  function zoneOf(p) {
    var lat = p[0], lng = p[1];
    if (lat > 37.788 && lng > -122.49) return 'north';
    if (lng < -122.475) return 'west';
    if (lat < 37.775 && lng < -122.432) return 'central';
    if (lng < -122.44) return 'north';
    return 'east';
  }
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hourLabel(h) { return (h % 12 || 12) + (h < 12 ? 'am' : 'pm'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var MPH = 16, SNACK_MIN = 20, CURIO_MIN = 10;

  var been = {};
  try { been = JSON.parse(localStorage.getItem('sv-been') || '{}') || {}; } catch (e) { been = {}; }
  function saveBeen() { try { localStorage.setItem('sv-been', JSON.stringify(been)); } catch (e) {} }

  var S = { snack: 'pastry', fresh: 'new', mood: 'sun', time: 120, leave: 9, start: 'mission', seed: Math.floor(Math.random() * 1e6), surprise: 'pastry' };
  var MOTION = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Weather ----------
  // The coming Sunday in San Francisco (today if it's Sunday before 4pm).
  function nextSunday() {
    var parts = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', hour12: false })
      .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    var dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    var add = dow === 0 ? (parseInt(parts.hour, 10) % 24 < 16 ? 0 : 7) : 7 - dow;
    var d = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day + add));
    return { iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }) };
  }
  var SUNDAY = nextSunday();
  var FORECAST = null; // array of 4 Open-Meteo responses, in ZKEYS order

  function classify(src, i) {
    var h = src.hourly, vis = h.visibility[i], low = h.cloud_cover_low[i], pp = h.precipitation_probability[i];
    var sky = pp >= 50 ? 'rain' : (vis < 2000 || low >= 85) ? 'fog' : (vis < 6000 || low >= 50) ? 'patchy' : 'sun';
    return { sky: sky, t: Math.round(h.temperature_2m[i]), w: Math.round(h.wind_speed_10m[i]), g: Math.round(h.wind_gusts_10m[i]), v: Math.round(vis / 160.9) / 10 };
  }
  function wxNow() {
    var out = {};
    if (FORECAST) {
      var key = SUNDAY.iso + 'T' + pad(S.leave) + ':00', ok = true;
      ZKEYS.forEach(function (k, j) { var i = FORECAST[j].hourly.time.indexOf(key); if (i < 0) ok = false; else out[k] = classify(FORECAST[j], i); });
      if (ok) return out;
    }
    ZKEYS.forEach(function (k) { out[k] = Object.assign({}, TYPICAL[k]); });
    return out;
  }
  function windy(z) { return z.w >= 15 || z.g >= 28; }
  function anyRain(wx) { return ZKEYS.some(function (k) { return wx[k].sky === 'rain'; }); }
  function skyWord(z) { return z.sky === 'sun' ? 'sun' : z.sky === 'patchy' ? 'patchy fog' : z.sky; }

  function loadForecast() {
    var cacheKey = 'sv-wx-' + SUNDAY.iso;
    try {
      var c = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (c && Date.now() - c.at < 30 * 60 * 1000) { FORECAST = c.data; return Promise.resolve(true); }
    } catch (e) {}
    var lat = ZKEYS.map(function (k) { return ZONES[k].f[0]; }).join(','), lng = ZKEYS.map(function (k) { return ZONES[k].f[1]; }).join(',');
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
      '&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,visibility,cloud_cover_low,precipitation_probability' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles&forecast_days=9';
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      if (!Array.isArray(d) || d.length !== 4) throw new Error('shape');
      FORECAST = d;
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: d })); } catch (e) {}
      return true;
    }).catch(function () { return false; });
  }

  // ---------- Generator ----------
  function fit(stop, wx) { // how well a stop suits the mood; higher is better
    var z = wx[zoneOf(stop.p)], f = 0;
    if (z.sky === 'rain') f -= 3;
    if (S.mood === 'sun') { if (z.sky === 'sun') f += 2; else if (z.sky === 'patchy') f += 0.5; else if (z.sky === 'fog') f -= 2; }
    else { if (z.sky === 'fog') f += 2.5; else if (z.sky === 'patchy') f += 1.5; else f -= 0.5; }
    if (windy(z)) f -= stop.exp ? 2 : 0.7;
    return f;
  }
  // Order stops into a loop without crossings: nearest stop first, then untangle (2-opt).
  function order(stops, start) {
    var left = stops.slice(), out = [], cur = start;
    while (left.length) {
      var bi = 0;
      for (var i = 1; i < left.length; i++) if (miles(cur, left[i].p) < miles(cur, left[bi].p)) bi = i;
      cur = left[bi].p; out.push(left.splice(bi, 1)[0]);
    }
    var pt = function (i) { return i === 0 || i === out.length + 1 ? start : out[i - 1].p; }, improved = true, guard = 0;
    while (improved && guard++ < 20) {
      improved = false;
      for (var a = 1; a < out.length; a++) for (var b = a + 1; b <= out.length; b++) {
        var before = miles(pt(a - 1), pt(a)) + miles(pt(b), pt(b + 1)), after = miles(pt(a - 1), pt(b)) + miles(pt(a), pt(b + 1));
        if (after < before - 1e-9) { out = out.slice(0, a - 1).concat(out.slice(a - 1, b).reverse()).concat(out.slice(b)); improved = true; }
      }
    }
    return out;
  }
  function plan() {
    var R = rng(S.seed * 9973 + S.leave * 31 + S.time), wx = wxNow(), start = STARTS[S.start].p;
    var rain = anyRain(wx), budget = rain ? Math.min(S.time, 60) : S.time;
    var type = S.snack === 'surprise' ? S.surprise : S.snack;
    var all = SPOTS.filter(function (s) { return s.t === type; });
    var pool = S.fresh === 'new' ? all.filter(function (s) { return !been[s.n]; }) : all.filter(function (s) { return s.fav || been[s.n]; });
    var poolNote = '';
    if (!pool.length) { pool = all; poolNote = S.fresh === 'new' ? 'You’ve been to every spot on the list for this snack. Picking from all of them.' : 'No favorites for this snack yet. Picking a new place.'; }
    var maxK = budget >= 240 ? 5 : budget >= 120 ? 3 : 2, best = null;
    for (var it = 0; it < 400; it++) {
      var snack = pool[Math.floor(R() * pool.length)], k = 1 + Math.floor(R() * maxK), picks = [], tries = 0;
      while (picks.length < k && tries++ < 40) {
        var c = CURIOS[Math.floor(R() * CURIOS.length)];
        if (picks.indexOf(c) < 0 && fit(c, wx) > -1.5) picks.push(c);
      }
      if (!picks.length) continue;
      var stops = picks.map(function (c) { return { kind: 'curio', n: c.n, p: c.p, b: c.b, exp: c.exp }; });
      stops.push({ kind: 'snack', n: snack.n, p: snack.p, s: snack });
      stops = order(stops, start);
      var ps = [start].concat(stops.map(function (s) { return s.p; })).concat([start]);
      var mi = pathMiles(ps), mins = Math.round(mi / MPH * 60 + SNACK_MIN + CURIO_MIN * picks.length);
      if (mins > budget) continue;
      var si = stops.findIndex(function (s) { return s.kind === 'snack'; });
      var mid = stops.length > 1 ? 1 - Math.abs(si / (stops.length - 1) - 0.5) * 2 : 0.5;
      var avg = stops.reduce(function (a, s) { return a + fit(s, wx); }, 0) / stops.length;
      var score = avg + 1.5 * (mins / budget) + 0.6 * mid + R() * 0.8;
      if (!best || score > best.score) best = { stops: stops, ps: ps, mi: mi, mins: mins, score: score };
    }
    if (!best) { // nothing fits: straight to the closest snack and back
      var near = pool.slice().sort(function (a, b) { return miles(start, a.p) - miles(start, b.p); })[0];
      var ps2 = [start, near.p, start], m2 = pathMiles(ps2);
      best = { stops: [{ kind: 'snack', n: near.n, p: near.p, s: near }], ps: ps2, mi: m2, mins: Math.round(m2 / MPH * 60 + SNACK_MIN), tight: true };
    }
    best.type = type; best.wx = wx; best.poolNote = poolNote; best.rain = rain;
    return best;
  }

  // ---------- Map ----------
  var NS = 'http://www.w3.org/2000/svg', svg = document.getElementById('map');
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; }
  function poly(pts) { return pts.map(function (p) { var q = xy(p[0], p[1]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '); }
  function smooth(ps) {
    var q = ps.map(function (p) { return xy(p[0], p[1]); }), d = 'M' + q[0][0].toFixed(1) + ' ' + q[0][1].toFixed(1);
    for (var i = 0; i < q.length - 1; i++) {
      var p0 = q[i - 1] || q[i], p1 = q[i], p2 = q[i + 1], p3 = q[i + 2] || p2, t = 0.16;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) * t).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) * t).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }
  var COAST = [[37.7790,-122.5135],[37.7880,-122.4920],[37.7905,-122.4850],[37.8030,-122.4790],[37.8105,-122.4772],[37.8075,-122.4650],[37.8050,-122.4500],[37.8075,-122.4380],[37.8085,-122.4280],[37.8070,-122.4210],[37.8090,-122.4150],[37.8095,-122.4050],[37.8060,-122.4000],[37.7990,-122.3970],[37.7955,-122.3920],[37.7890,-122.3880],[37.7800,-122.3870],[37.7700,-122.3860],[37.7600,-122.3850],[37.7500,-122.3800],[37.7400,-122.3730],[37.7320,-122.3600],[37.7240,-122.3580],[37.7150,-122.3800],[37.7085,-122.3920],[37.6990,-122.3950],[37.6990,-122.5040],[37.7200,-122.5050],[37.7350,-122.5070],[37.7500,-122.5090],[37.7650,-122.5110],[37.7720,-122.5120]];
  var GGP = [[37.7735,-122.5105],[37.7735,-122.4545],[37.7660,-122.4545],[37.7645,-122.5105]];
  var PANH = [[37.7728,-122.4545],[37.7740,-122.4380],[37.7718,-122.4380],[37.7708,-122.4545]];
  var PRESIDIO = [[37.7880,-122.4850],[37.7880,-122.4470],[37.8020,-122.4470],[37.8040,-122.4600],[37.8098,-122.4765],[37.8030,-122.4790],[37.7905,-122.4850]];
  var LABELS = [['Ocean Beach', 37.7560, -122.5000, -90], ['Presidio', 37.7955, -122.4650], ['Golden Gate Park', 37.7690, -122.4830], ['Mission', 37.7560, -122.4140], ['Embarcadero', 37.7900, -122.4020], ['Sunset', 37.7450, -122.4950]];

  function base(wx) {
    svg.innerHTML = '';
    var f = el('filter', { id: 'sv-blur', filterUnits: 'userSpaceOnUse', x: -200, y: -200, width: 1400, height: 1233 }, el('defs', {}));
    el('feGaussianBlur', { stdDeviation: '18' }, f);
    el('polygon', { class: 'land', points: poly(COAST) });
    [GGP, PANH, PRESIDIO].forEach(function (g) { el('polygon', { class: 'park', points: poly(g) }); });
    var tp = xy(37.7530, -122.4475); el('circle', { class: 'park', cx: tp[0], cy: tp[1], r: 26 });
    var lm = xy(37.7275, -122.4945); el('ellipse', { class: 'lake', cx: lm[0], cy: lm[1], rx: 26, ry: 40 });
    var b1 = xy(37.8102, -122.4774), b2 = xy(37.8190, -122.4790); el('line', { class: 'bridge', x1: b1[0], y1: b1[1], x2: b2[0], y2: b2[1] });
    LABELS.forEach(function (l) { var q = xy(l[1], l[2]); var t = el('text', { class: 'place-lbl', x: q[0], y: q[1], 'text-anchor': 'middle' }); if (l[3]) t.setAttribute('transform', 'rotate(' + l[3] + ' ' + q[0] + ' ' + q[1] + ')'); t.textContent = l[0]; });
    var g = el('g', {});
    ZKEYS.forEach(function (k) {
      var z = wx[k], c = xy(ZONES[k].c[0], ZONES[k].c[1]);
      if (z.sky === 'fog' || z.sky === 'patchy') {
        var fg = el('g', { class: 'fog-drift', filter: 'url(#sv-blur)' }, g), n = z.sky === 'fog' ? 5 : 3, sz = z.sky === 'fog' ? 1 : 0.7;
        for (var i = 0; i < n; i++) el('ellipse', { class: 'fog', cx: c[0] - 60 + i * 30, cy: c[1] - 120 + i * 60, rx: 90 * sz, ry: 70 * sz }, fg);
      }
      if (z.sky === 'rain') for (var j = 0; j < 14; j++) { var rx = c[0] - 90 + (j * 37) % 180, ry = c[1] - 80 + (j * 53) % 160; el('line', { class: 'rain', x1: rx, y1: ry, x2: rx - 6, y2: ry + 16 }, g); }
      if (windy(z)) for (var w = 0; w < 3; w++) { var wy = c[1] - 40 + w * 22, wx0 = c[0] - 40 + w * 8; el('path', { class: 'wind', d: 'M' + wx0 + ' ' + wy + ' q 30 -10 60 0 t 40 -6' }, g); }
      var txt = z.t + '° · ' + skyWord(z) + (windy(z) ? ' · gusts ' + z.g : '');
      var tw = txt.length * 7.9 + 16, ty = c[1] + 70;
      el('rect', { class: 'wx-bg', x: c[0] - tw / 2, y: ty - 15, width: tw, height: 22, rx: 11 });
      var t = el('text', { class: 'wx-tag', x: c[0], y: ty, 'text-anchor': 'middle' }); t.textContent = txt;
    });
  }
  function draw(r) {
    base(r.wx);
    var route = el('path', { class: 'route', d: smooth(r.ps) });
    if (MOTION && route.getTotalLength) {
      var len = route.getTotalLength();
      route.style.strokeDasharray = len; route.style.strokeDashoffset = len;
      route.getBoundingClientRect();
      route.style.transition = 'stroke-dashoffset 1.6s ease-out';
      requestAnimationFrame(function () { route.style.strokeDashoffset = 0; });
    }
    r.stops.forEach(function (s, i) {
      var q = xy(s.p[0], s.p[1]);
      el('circle', { class: s.kind === 'snack' ? 'snack-mk' : 'stop-mk', cx: q[0], cy: q[1], r: s.kind === 'snack' ? 14 : 12 });
      var t = el('text', { class: s.kind === 'snack' ? 'snack-n' : 'stop-n', x: q[0], y: q[1] + 4.5 }); t.textContent = i + 1;
      if (s.kind === 'snack') { var lb = el('text', { class: 'spot-lbl', x: q[0] + 20, y: q[1] + 5 }); lb.textContent = s.n; }
    });
    var st = STARTS[S.start].p, h = xy(st[0], st[1]);
    el('circle', { class: 'home-ring', cx: h[0], cy: h[1], r: 16 });
    el('circle', { class: 'home-dot', cx: h[0], cy: h[1], r: 7 });
  }

  // ---------- Result ----------
  function fmtMins(m) { var h = Math.floor(m / 60), mm = m % 60; return h ? h + 'h' + (mm ? ' ' + pad(mm) : '') : mm + ' min'; }
  function explain(r) {
    var out = [], used = {}, wx = r.wx;
    r.stops.forEach(function (s) { used[zoneOf(s.p)] = 1; });
    var snack = r.stops.filter(function (s) { return s.kind === 'snack'; })[0];
    if (r.rain) out.push(['bad', 'Rain likely. Kept it short; the snack stop doubles as shelter.']);
    if (r.poolNote) out.push(['', r.poolNote]);
    else if (S.fresh === 'new') out.push(['good', 'New to you: ' + snack.n.replace(/\.$/, '') + '.']);
    if (!r.rain) ZKEYS.forEach(function (k) {
      var z = wx[k], Z = ZONES[k], foggy = z.sky === 'fog' || z.sky === 'patchy';
      if (S.mood === 'sun' && foggy && !used[k]) out.push(['good', 'Skipping ' + Z.name + ': ' + (z.sky === 'fog' ? 'thick fog' : 'patchy fog') + '.']);
      if (S.mood === 'karl' && foggy && used[k]) out.push(['good', 'Visiting Karl on ' + Z.name + '. Visibility about ' + z.v + ' mi; lights on.']);
      if (windy(z) && used[k]) out.push(['bad', 'Gusts around ' + z.g + ' mph near ' + Z.short + '. Hold on at the exposed spots.']);
    });
    if (S.mood === 'karl' && !r.stops.some(function (s) { var z = wx[zoneOf(s.p)]; return z.sky === 'fog' || z.sky === 'patchy'; })) out.push(['', 'Karl is out today: no fog anywhere. Enjoy the sun instead.']);
    if (r.tight) out.push(['bad', 'Tight on time. Just the snack this round.']);
    return out.slice(0, 4);
  }
  function gmaps(r) {
    var s = function (p) { return p[0].toFixed(5) + ',' + p[1].toFixed(5); }, st = STARTS[S.start].p;
    return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(s(st)) + '&destination=' + encodeURIComponent(s(st)) +
      '&waypoints=' + encodeURIComponent(r.stops.slice(0, 9).map(function (x) { return s(x.p); }).join('|')) + '&travelmode=driving';
  }
  function item(numCls, num, title, sub) {
    var l = document.createElement('li'), n = document.createElement('span'), d = document.createElement('div'), b = document.createElement('b');
    n.className = 'num ' + numCls; n.textContent = num; b.textContent = title;
    d.appendChild(b);
    if (sub) { var sp = document.createElement('span'); sp.textContent = sub; d.appendChild(sp); }
    l.appendChild(n); l.appendChild(d);
    return l;
  }
  // ---------- Usage analytics (Umami, no cookies) ----------
  // Only the choices on the page are sent: never a location or anything that identifies a person.
  function track(name, data, tries) {
    try {
      if (window.umami && typeof window.umami.track === 'function') { window.umami.track(name, data); return; }
    } catch (e) { return; }
    if ((tries || 0) < 3) setTimeout(function () { track(name, data, (tries || 0) + 1); }, 1500);
  }
  var LAST = null;
  function loopProps(r, reason) {
    var snack = r.stops.filter(function (s) { return s.kind === 'snack'; })[0];
    return {
      reason: reason, snack: S.snack, snack_type: r.type, snack_spot: snack.n, fresh: S.fresh, mood: S.mood,
      time: S.time, leave: S.leave, start: S.start, stops: r.stops.length, mins: r.mins,
      west_sky: r.wx.west.sky, rain: r.rain ? 'yes' : 'no', forecast: FORECAST ? 'live' : 'typical'
    };
  }
  function render(reason) {
    var r = plan(); draw(r); LAST = r;
    if (reason) track('snacky-loop', loopProps(r, reason));
    var temps = r.stops.map(function (s) { return r.wx[zoneOf(s.p)].t; });
    document.getElementById('r-eyebrow').textContent = SUNDAY.label + ' · ' + hourLabel(S.leave) + ' · from ' + STARTS[S.start].name;
    document.getElementById('r-time').textContent = fmtMins(r.mins);
    document.getElementById('r-miles').textContent = r.mi.toFixed(1);
    var lo = Math.min.apply(null, temps), hi = Math.max.apply(null, temps);
    document.getElementById('r-temp').textContent = lo === hi ? lo + '°' : lo + '–' + hi + '°';
    var ol = document.getElementById('r-stops'); ol.innerHTML = '';
    r.stops.forEach(function (s, i) {
      if (s.kind !== 'snack') { ol.appendChild(item('', i + 1, s.n, s.b)); return; }
      var row = item('snk', i + 1, s.n, null);
      if (!been[s.n]) { var tg = document.createElement('i'); tg.className = 'tag-new'; tg.textContent = 'New'; row.querySelector('b').appendChild(tg); }
      var sub = document.createElement('span'); sub.textContent = 'Snack stop · ' + s.s.hood + (s.s.fav ? ' · a Scarlett favorite' : '') + ' · ';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'linkish';
      btn.textContent = been[s.n] ? 'Forget I’ve been' : 'I’ve been here';
      btn.addEventListener('click', function () { var add = !been[s.n]; if (add) been[s.n] = 1; else delete been[s.n]; saveBeen(); track('snacky-been-here', { spot: s.n, action: add ? 'add' : 'remove' }); S.seed++; render('been-here'); });
      sub.appendChild(btn); row.querySelector('div').appendChild(sub);
      ol.appendChild(row);
    });
    ol.appendChild(item('home', '⌂', 'Back to ' + STARTS[S.start].name, null));
    var ul = document.getElementById('r-why'); ul.innerHTML = '';
    explain(r).forEach(function (w) { var l = document.createElement('li'); if (w[0]) l.className = w[0]; l.textContent = w[1]; ul.appendChild(l); });
    document.getElementById('r-gmaps').href = gmaps(r);
  }

  // ---------- Controls ----------
  [7, 8, 9, 10, 11, 12, 13, 14, 15, 16].forEach(function (h) {
    var o = document.createElement('option'); o.value = h; o.textContent = 'Sunday at ' + hourLabel(h); document.getElementById('a-leave').appendChild(o);
  });
  Object.keys(STARTS).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = STARTS[k].name; document.getElementById('a-start').appendChild(o); });
  var INT = { time: 1, leave: 1 };
  function pickSurprise() { var types = Object.keys(NOUN); S.surprise = types[Math.floor(Math.random() * types.length)]; }
  function sync() {
    document.querySelectorAll('select[data-k]').forEach(function (s) { s.value = String(S[s.dataset.k]); });
    document.getElementById('a-start-sum').textContent = 'Starting near ' + STARTS[S.start].name;
  }
  document.querySelectorAll('select[data-k]').forEach(function (s) {
    s.addEventListener('change', function () {
      S[s.dataset.k] = INT[s.dataset.k] ? parseInt(s.value, 10) : s.value;
      if (s.dataset.k === 'snack' && s.value === 'surprise') pickSurprise();
      track('snacky-setting', { key: s.dataset.k, value: s.value });
      sync(); render('setting');
    });
  });
  document.getElementById('r-roll').addEventListener('click', function () {
    S.seed = Math.floor(Math.random() * 1e6);
    if (S.snack === 'surprise') pickSurprise();
    render('roll');
  });
  document.getElementById('r-gmaps').addEventListener('click', function () {
    if (!LAST) return;
    var p = loopProps(LAST, 'open-maps');
    track('snacky-open-maps', { snack_spot: p.snack_spot, snack_type: p.snack_type, stops: p.stops, mins: p.mins, mood: p.mood, fresh: p.fresh });
  });

  sync(); render();
  var src = document.getElementById('wx-src');
  loadForecast().then(function (ok) {
    src.textContent = ok ? 'Forecast for Sunday, ' + SUNDAY.label.replace(/^\w+, /, '') + ', from Open-Meteo. Changes with the time you pick.' : 'Couldn’t load the forecast, so this shows a typical foggy Sunday morning.';
    if (ok) render('first'); else if (LAST) track('snacky-loop', loopProps(LAST, 'first'));
  });
})();
