/* Gift Gym: get better at gifts by noticing, writing it down, starting early, and a daily two-minute warm-up.
   Everything personal (people, clues, ideas, plans, past gifts) lives in this browser's localStorage only.
   A private setup link (?setup=...) can add people on one phone; nothing about anyone is in this code. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var DAY = 86400000;

  /* ---------- storage ---------- */
  function load(k, d) { try { var v = localStorage.getItem('gg.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('gg.' + k, JSON.stringify(v)); } catch (e) {} }
  function track(name, data) { try { if (window.umami && window.umami.track) window.umami.track(name, data || {}); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var people = load('people', []);
  var gym = load('gym', { streak: 0, last: '', rounds: 0 });

  /* Private setup link: ?setup=<base64 JSON>, or ?setupz=<base64 gzip JSON> for long lists, adds people
     (merged by name), then cleans the address bar. */
  function b64(str) { var b = atob(decodeURIComponent(str).replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  var setupDone = (function () {
    var m = /[?&]setup=([^&]+)/.exec(location.search), z = /[?&]setupz=([^&]+)/.exec(location.search);
    if (z && window.DecompressionStream) {
      var ds = new Blob([b64(z[1])]).stream().pipeThrough(new DecompressionStream('gzip'));
      history.replaceState(null, '', location.pathname);
      return new Response(ds).text().then(applySetup).catch(function () {});
    }
    if (m) { try { applySetup(new TextDecoder().decode(b64(m[1]))); } catch (e) {} history.replaceState(null, '', location.pathname); }
    return null;
  })();
  function applySetup(json) {
    try {
      JSON.parse(json).forEach(function (p) {
        var have = people.filter(function (x) { return x.name.toLowerCase() === String(p.name).toLowerCase(); })[0];
        if (!have) { have = { id: uid(), name: p.name, occ: [], clues: [], ideas: [], gifts: [], plans: {} }; people.push(have); }
        (p.occ || []).forEach(function (o) { if (!have.occ.some(function (x) { return x.label === o.label; })) have.occ.push({ id: uid(), label: o.label, md: o.md || '', date: o.date || '', rule: o.rule || '' }); });
        (p.clues || []).forEach(function (c) { if (!have.clues.some(function (x) { return x.text === c; })) have.clues.push({ id: uid(), d: iso(today()), text: c }); });
        (p.ideas || []).forEach(function (i) { if (!have.ideas.some(function (x) { return x.text === i.text; })) have.ideas.push({ id: uid(), text: i.text, lens: i.lens || '', url: /^https:\/\//.test(i.url || '') ? i.url : '', price: i.price || '' }); });
        (p.gifts || []).forEach(function (g) { if (!have.gifts.some(function (x) { return x.text === g.text; })) have.gifts.push({ id: uid(), d: g.d || '', occ: g.occ || 'Gift', text: g.text, stars: g.stars || 0, note: g.note || '' }); });
      });
      save('people', people);
    } catch (e) {}
  }

  /* ---------- dates ---------- */
  function today() { var d = new Date(); d.setHours(12, 0, 0, 0); return d; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fromIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function fmt(d) { return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function short(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function daysTo(d) { return Math.round((d - today()) / DAY); }
  /* The next time an occasion comes around: yearly ones (md "MM-DD") roll over; one-offs keep their date. */
  /* Hanukkah moves with the Hebrew calendar: first candle, evening of (hebcal.com). */
  var HANUKKAH = { 2026: '12-04', 2027: '12-24', 2028: '12-12', 2029: '12-01', 2030: '12-20', 2031: '12-09', 2032: '11-27' };
  function nextOf(o) {
    if (o.date) return fromIso(o.date);
    if (o.rule && o.rule.indexOf('nth:') === 0) { // nth:month:weekday:n, e.g. Mother's Day = nth:5:0:2
      var r = o.rule.split(':').map(Number), ty = today().getFullYear();
      for (var yy = ty; yy <= ty + 1; yy++) { var f = new Date(yy, r[1] - 1, 1, 12), nd = addDays(f, (r[2] - f.getDay() + 7) % 7 + (r[3] - 1) * 7); if (nd >= addDays(today(), -21)) return nd; }
      return null;
    }
    if (o.rule === 'hanukkah') {
      var y0 = today().getFullYear();
      for (var y = y0; y <= y0 + 1; y++) { if (!HANUKKAH[y]) continue; var hp = HANUKKAH[y].split('-'), hd = new Date(y, +hp[0] - 1, +hp[1], 12); if (hd >= addDays(today(), -21)) return hd; }
      return null;
    }
    if (!o.md) return null;
    var t = today(), p = o.md.split('-'), d = new Date(t.getFullYear(), +p[0] - 1, +p[1], 12);
    if (d < addDays(t, -21)) d = new Date(t.getFullYear() + 1, +p[0] - 1, +p[1], 12); // stays "just passed" for 3 weeks, for the debrief
    return d;
  }
  function planKey(o, d) { return o.id + '@' + d.getFullYear(); }

  /* ---------- the countdown ----------
     3 weeks out: start thinking. 2 weeks: pick. 10 days: buy. 2 days: write the card. */
  function stepsFor(p, o, d) {
    var plan = (p.plans || {})[planKey(o, d)] || {}, n = daysTo(d);
    var steps = [
      { k: 'start', label: '3 weeks out', due: addDays(d, -21), done: n <= 21 },
      { k: 'pick', label: 'Pick a gift', due: addDays(d, -14), done: !!plan.gift },
      { k: 'buy', label: 'Buy it', due: addDays(d, -10), done: !!plan.bought },
      { k: 'card', label: 'Write the card', due: addDays(d, -2), done: !!plan.card }
    ];
    var next = steps.filter(function (s) { return !s.done; })[0];
    return { steps: steps, next: next, plan: plan, n: n };
  }
  function occasions() {
    var out = [];
    people.forEach(function (p) { p.occ.forEach(function (o) { var d = nextOf(o); if (d) out.push({ p: p, o: o, d: d }); }); });
    return out.sort(function (a, b) { return a.d - b.d; });
  }

  /* ---------- the six angles ---------- */
  var LENSES = [
    ['Upgrade', 'A better version of something they use every day'],
    ['Fix', 'Something that keeps annoying them'],
    ['Treat', 'The nice version they’d never buy themselves'],
    ['Together', 'An experience you share'],
    ['Callback', 'A nod to a memory or inside joke'],
    ['Their thing', 'Feeds what they’re into right now']
  ];

  /* ---------- Gift Gym deck: made-up people, built from parts ---------- */
  var WHO = ['Your neighbor', 'A coworker you like', 'Your cousin', 'An old teammate', 'Your manager', 'A new friend', 'Your best friend’s partner', 'Your old roommate', 'Your weekend host', 'Your dog sitter', 'Your in-law', 'A friend who just helped you move'];
  var INTO = [
    ['just took up pottery', [['Upgrade', 'A good apron with deep pockets'], ['Together', 'A wheel class for two'], ['Their thing', 'A local studio’s nicest glaze']]],
    ['training for a half marathon', [['Upgrade', 'Really good running socks'], ['Fix', 'A massage gun or a sports massage'], ['Together', 'Sign up for a fun 5K together']]],
    ['obsessed with their sourdough', [['Upgrade', 'A proper Dutch oven'], ['Their thing', 'A lame and a stack of banneton liners'], ['Treat', 'Fancy flour from a small mill']]],
    ['into houseplants', [['Upgrade', 'A beautiful watering can'], ['Fix', 'A grow light for the dark corner'], ['Their thing', 'A cutting of a rare plant']]],
    ['learning Spanish', [['Their thing', 'A novel they can almost read'], ['Together', 'Dinner at a place where you order in Spanish'], ['Treat', 'A few private lessons']]],
    ['always hosting dinner', [['Upgrade', 'Linen napkins'], ['Treat', 'Great olive oil and flaky salt'], ['Fix', 'You do the dishes, all night']]],
    ['a big reader', [['Treat', 'A gorgeous edition of their favorite book'], ['Upgrade', 'A good reading light'], ['Callback', 'A book you talked about once, with a note inside']]],
    ['into cycling', [['Upgrade', 'Good bike lights'], ['Together', 'A ride and a bakery stop you plan'], ['Fix', 'A tune-up at their shop, prepaid']]],
    ['new to golf', [['Together', 'A lesson for the two of you'], ['Their thing', 'A dozen nice balls with a monogram'], ['Fix', 'A range card so practice is free']]],
    ['a coffee person', [['Upgrade', 'A burr grinder'], ['Treat', 'A subscription from a great roaster'], ['Callback', 'Beans from a café you went to together']]],
    ['into hiking', [['Upgrade', 'Merino socks'], ['Together', 'A day hike you plan, snacks included'], ['Fix', 'A tiny first-aid kit for their pack']]],
    ['learning to cook', [['Upgrade', 'One really good chef’s knife'], ['Together', 'A cooking class'], ['Their thing', 'A cookbook with your favorite recipe flagged']]],
    ['a music person', [['Together', 'Tickets to a show'], ['Treat', 'A record they’d never splurge on'], ['Callback', 'A playlist of songs from your history']]],
    ['into board games', [['Their thing', 'The new game everyone’s talking about'], ['Together', 'Host a game night for them'], ['Upgrade', 'A nice dice tray']]],
    ['a swimmer', [['Upgrade', 'Good goggles in their size'], ['Treat', 'A day pass to a beautiful outdoor pool'], ['Fix', 'A quick-dry towel that fits the bag']]],
    ['into photography', [['Their thing', 'A roll of film and its developing'], ['Upgrade', 'A better camera strap'], ['Callback', 'A print of a photo they took of you']]]
  ];
  var QUIRK = [
    ['always cold', ['Fix', 'A heated throw']],
    ['always losing their keys', ['Fix', 'A tracker tag on a nice keyring']],
    ['just moved', ['Fix', 'A small, good toolkit']],
    ['a new parent', ['Fix', 'Dinner delivered and a night off']],
    ['travels a lot for work', ['Upgrade', 'Packing cubes']],
    ['hates clutter', ['Treat', 'Something they use up: great candles or chocolate']],
    ['a morning person', ['Upgrade', 'A beautiful mug']],
    ['has a new dog', ['Their thing', 'A walk-and-coffee date with the dog']],
    ['working from home', ['Fix', 'A better desk lamp']],
    ['never takes a day off', ['Together', 'A spa morning you book for both of you']]
  ];
  var BUDGET = ['$25', '$40', '$60', '$100', 'no budget'];
  var WHEN = ['birthday in 10 days', 'holiday swap next week', 'a thank-you, no rush', 'housewarming Saturday', 'just because'];
  function rng(seed) { var x = seed % 2147483647; if (x <= 0) x += 2147483646; return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function dealPerson(seed) {
    var r = rng(seed);
    return { seed: seed, who: pick(r, WHO), into: pick(r, INTO), quirk: pick(r, QUIRK), budget: pick(r, BUDGET), when: pick(r, WHEN) };
  }
  function todaySeed() { var t = today(); return t.getFullYear() * 1000 + Math.floor((t - new Date(t.getFullYear(), 0, 1)) / DAY) + 7; }

  /* ---------- state and routing ---------- */
  var state = { screen: 'home', person: null, round: null, clueOpen: false, msg: '' };
  function show(s, extra) { state.screen = s; Object.assign(state, extra || {}); render(); window.scrollTo(0, 0); }
  function byId(id) { return people.filter(function (p) { return p.id === id; })[0]; }
  function persist() { save('people', people); }

  function bar(back) {
    return '<div class="gg-bar">' + (back ? '<button class="gg-back" data-go="home">&larr; Gift Gym</button>' : '<span></span>') + '</div>';
  }
  function pill(cls, t) { return '<span class="gg-pill ' + cls + '">' + esc(t) + '</span>'; }

  /* ---------- screens ---------- */
  var S = {};
  S.home = function () {
    var g = dealPerson(todaySeed()), done = gym.last === iso(today());
    var streak = gym.streak && (gym.last === iso(today()) || gym.last === iso(addDays(today(), -1))) ? gym.streak : 0;
    var h = bar(false) + '<h1 class="gg-title">Gift Gym<span>.</span></h1>' +
      '<p class="gg-intro">Notice what people want, write it down, start early. A two-minute warm-up keeps the muscle in shape.</p>';
    h += '<div class="gg-gym"><div class="row"><span class="gg-lbl inv">Warm-up · today</span>' + (streak ? '<span class="flame">' + streak + '-day streak</span>' : '') + '</div>' +
      '<b>' + esc(g.who) + '. ' + esc(cap(g.into[0])) + ', ' + esc(g.quirk[0]) + '. ' + esc(g.budget) + '.</b>' +
      '<small>' + (done ? 'Done for today. Go again any time.' : 'Three ideas, three angles, 60 seconds.') + '</small>' +
      '<button class="gg-btn light" data-act="round" data-seed="' + (done ? 'random' : g.seed) + '">' + (done ? 'Another round' : 'Start round') + '</button></div>';
    h += clueBox();
    var up = occasions().filter(function (x) { return x.d >= today() && daysTo(x.d) <= 60; });
    var back = occasions().filter(function (x) { var pl = (x.p.plans || {})[planKey(x.o, x.d)]; return x.d < today() && pl && pl.gift && !pl.rated; });
    if (back.length) {
      h += '<div class="gg-lbl">How did it land?</div>' + back.map(function (x) {
        var pl = x.p.plans[planKey(x.o, x.d)];
        return '<div class="gg-card"><b>' + esc(x.p.name) + ' · ' + esc(pl.gift) + '</b><small>' + esc(x.o.label) + ', ' + short(x.d) + '</small>' + starsInput(x.p.id, x.o.id, x.d) + '</div>';
      }).join('');
    }
    if (people.length) {
      h += '<div class="gg-lbl">Coming up · next 60 days</div>';
      /* Shared dates (everyone's holidays) collapse into one card with a row per person. */
      var groups = [];
      up.forEach(function (x) { var g = groups.filter(function (y) { return y.label === x.o.label && +y.d === +x.d; })[0]; if (g) g.items.push(x); else groups.push({ label: x.o.label, d: x.d, items: [x] }); });
      h += up.length ? groups.map(function (g) { return g.items.length === 1 ? occCard(g.items[0]) : groupCard(g); }).join('') : '<p class="gg-sub">Nothing in the next 60 days. Add birthdays and other dates on each person.</p>';
      h += '<div class="gg-lbl">Your people</div><div class="gg-people">' + people.map(function (p) {
        var nx = p.occ.map(function (o) { return [o, nextOf(o)]; }).filter(function (x) { return x[1] && x[1] >= today(); }).sort(function (a, b) { return a[1] - b[1]; })[0];
        return '<button class="gg-pcard" data-person="' + p.id + '"><b>' + esc(p.name) + '</b><small>' + (nx ? esc(nx[0].label) + ' · ' + short(nx[1]) : 'No dates yet') + '</small><small>' + p.clues.length + ' clue' + (p.clues.length === 1 ? '' : 's') + ' · ' + p.ideas.length + ' idea' + (p.ideas.length === 1 ? '' : 's') + '</small></button>';
      }).join('') + '<button class="gg-pcard add" data-act="add-person"><b>+ Someone</b><small>Add a person</small></button></div>';
    } else {
      h += '<div class="gg-card"><b>Add the people you give gifts to</b><small>Their dates, the clues they drop, your ideas and how past gifts landed, all in one place. It stays on this phone.</small><button class="gg-btn" data-act="add-person">Add someone</button></div>';
    }
    return h;
  };
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function occCard(x) {
    var st = stepsFor(x.p, x.o, x.d), nx = st.next, cls = 'g', tag;
    if (!nx) tag = 'Ready';
    else if (nx.k === 'start') { tag = 'Starts ' + short(addDays(x.d, -21)); cls = 'n'; }
    else { tag = nx.label + (nx.due >= today() ? ' by ' + short(nx.due) : ', overdue'); cls = nx.due < today() ? 'r' : 'y'; }
    return '<button class="gg-card" data-person="' + x.p.id + '" data-occ="' + x.o.id + '"><span class="t"><b>' + esc(x.p.name) + ' · ' + esc(x.o.label) + '</b>' + pill(cls, tag) + '</span>' +
      '<span class="gg-when">' + fmt(x.d) + ' · ' + (st.n === 0 ? 'today' : st.n + ' day' + (st.n === 1 ? '' : 's')) + '</span>' +
      '<span class="gg-steps" aria-hidden="true">' + st.steps.map(function (s) { return '<i' + (s.done ? ' class="on"' : '') + '></i>'; }).join('') + '</span>' +
      (st.plan.gift ? '<small>Gift: ' + esc(st.plan.gift) + '</small>' : x.p.clues.length ? '<small>' + x.p.clues.length + ' clue' + (x.p.clues.length === 1 ? '' : 's') + ' saved</small>' : '') + '</button>';
  }
  function tagOf(x) {
    var st = stepsFor(x.p, x.o, x.d), nx = st.next;
    if (!nx) return ['g', 'Ready', st];
    if (nx.k === 'start') return ['n', 'Starts ' + short(addDays(x.d, -21)), st];
    return [nx.due < today() ? 'r' : 'y', nx.label + (nx.due >= today() ? ' by ' + short(nx.due) : ', overdue'), st];
  }
  function groupCard(g) {
    var n = daysTo(g.d), first = tagOf(g.items[0]);
    return '<div class="gg-card"><span class="t"><b>' + esc(g.label) + ' · ' + g.items.length + ' people</b>' + (g.items.every(function (x) { return tagOf(x)[1] === first[1]; }) ? pill(first[0], first[1]) : '') + '</span>' +
      '<span class="gg-when">' + fmt(g.d) + ' · ' + (n === 0 ? 'today' : n + ' day' + (n === 1 ? '' : 's')) + '</span>' +
      '<div class="gg-grp">' + g.items.map(function (x) {
        var tg = tagOf(x), st = tg[2], done = st.steps.filter(function (s) { return s.done; }).length;
        return '<button class="gg-grow" data-person="' + x.p.id + '" data-occ="' + x.o.id + '"><b>' + esc(x.p.name) + '</b><span class="gg-steps sm" aria-hidden="true">' + st.steps.map(function (s) { return '<i' + (s.done ? ' class="on"' : '') + '></i>'; }).join('') + '</span><small>' + (st.plan.gift ? esc(st.plan.gift) : done + ' of 4') + '</small></button>';
      }).join('') + '</div></div>';
  }
  function clueBox() {
    if (!people.length) return '';
    if (!state.clueOpen) return '<button class="gg-clue" data-act="clue-open">+ Heard a clue? <span class="gg-btn sm">Save it</span></button>';
    var who = state.clueWho || people[0].id;
    return '<div class="gg-card gg-cluebox"><span class="gg-lbl" style="margin:0">Heard a clue</span>' +
      '<div class="gg-chips" role="group" aria-label="Who">' + people.map(function (p) { return '<button class="gg-chip" data-cluewho="' + p.id + '" aria-pressed="' + (p.id === who) + '">' + esc(p.name) + '</button>'; }).join('') + '</div>' +
      '<label class="gg-field">What did they say or do?<textarea id="clue-text" rows="2" placeholder="“Our knife is so dull”"></textarea></label>' +
      '<div class="gg-row2"><button class="gg-btn" data-act="clue-save">Save clue</button><button class="gg-btn ghost" data-act="clue-close">Cancel</button></div></div>';
  }
  function starsInput(pid, oid, d) {
    return '<div class="gg-stars" role="group" aria-label="Rate it">' + [1, 2, 3, 4, 5].map(function (n) { return '<button data-rate="' + n + '" data-p="' + pid + '" data-o="' + oid + '" data-y="' + d.getFullYear() + '" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '">☆</button>'; }).join('') + '</div>';
  }

  S.round = function () {
    var r = state.round, g = r.g;
    var h = bar(true) + '<div class="gg-rhead"><span class="gg-lbl" style="margin:0">Round ' + (gym.rounds + 1) + '</span><span class="gg-timer" id="timer">' + timerText(r) + '</span></div>';
    h += '<div class="gg-person"><span class="gg-lbl" style="margin:0">Today’s person</span><span class="who">' + esc(g.who) + '</span><div class="gg-tags"><span>' + esc(g.into[0]) + '</span><span>' + esc(g.quirk[0]) + '</span><span>' + esc(g.budget) + '</span><span>' + esc(g.when) + '</span></div></div>';
    if (!r.done) {
      h += '<div class="gg-lbl">Three ideas, each from a different angle</div>';
      r.slots.forEach(function (s, i) {
        h += '<div class="gg-slot"><div class="gg-chips" role="group" aria-label="Angle for idea ' + (i + 1) + '">' + LENSES.map(function (l) { return '<button class="gg-chip" data-slot="' + i + '" data-lens="' + l[0] + '" aria-pressed="' + (s.lens === l[0]) + '" title="' + esc(l[1]) + '">' + l[0] + '</button>'; }).join('') + '</div>' +
          '<input class="gg-in" id="slot-' + i + '" value="' + esc(s.text) + '" placeholder="' + (s.lens ? esc(LENSES.filter(function (l) { return l[0] === s.lens; })[0][1]) + '…' : 'Pick an angle, then write an idea') + '" aria-label="Idea ' + (i + 1) + '"></div>';
      });
      h += '<button class="gg-btn" data-act="round-done">Done, show examples</button><p class="gg-cap">Nothing’s graded. It’s reps.</p>';
    } else {
      var mine = r.slots.filter(function (s) { return s.text; });
      h += '<div class="gg-lbl">Yours</div>' + (mine.length ? mine.map(function (s) { return '<div class="gg-idea"><span class="gg-pill n">' + esc(s.lens || 'Idea') + '</span> ' + esc(s.text) + '</div>'; }).join('') : '<p class="gg-sub">No ideas this time. That’s fine, look at the examples and try another.</p>');
      var ex = g.into[1].concat([g.quirk[1]]);
      h += '<div class="gg-lbl">Some other angles</div>' + ex.map(function (e) { return '<div class="gg-idea"><span class="gg-pill g">' + esc(e[0]) + '</span> ' + esc(e[1]) + '</div>'; }).join('');
      var used = {}; mine.forEach(function (s) { used[s.lens] = 1; });
      var missed = LENSES.filter(function (l) { return !used[l[0]]; }).map(function (l) { return l[0]; });
      if (missed.length && mine.length) h += '<p class="gg-note">Angles you didn’t use: ' + esc(missed.join(', ')) + '. Next time try one of those first.</p>';
      h += '<div class="gg-row2"><button class="gg-btn" data-act="round" data-seed="random">Another round</button><button class="gg-btn ghost" data-go="home">Done</button></div>';
    }
    return h;
  };
  function timerText(r) { var left = Math.max(0, 60 - Math.floor((Date.now() - r.start) / 1000)); return left ? Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : 'Time!'; }

  S.person = function () {
    var p = byId(state.person); if (!p) return S.home();
    var h = bar(true) + '<h1 class="gg-h">' + esc(p.name) + '</h1>';
    var occ = p.occ.map(function (o) { return { o: o, d: nextOf(o) }; }).filter(function (x) { return x.d; }).sort(function (a, b) { return a.d - b.d; });
    var focus = occ.filter(function (x) { return state.occ ? x.o.id === state.occ : x.d >= addDays(today(), -21); })[0];
    if (focus && daysTo(focus.d) <= 60) h += planPanel(p, focus.o, focus.d);
    h += '<div class="gg-lbl">Dates</div>';
    h += occ.length ? occ.map(function (x) { return '<div class="gg-row"><span><b>' + esc(x.o.label) + '</b> <span class="gg-when">' + fmt(x.d) + (x.o.md || x.o.rule ? ' · every year' : '') + '</span></span><button class="gg-x" data-delocc="' + x.o.id + '" aria-label="Remove ' + esc(x.o.label) + '">&times;</button></div>'; }).join('') : '<p class="gg-sub">No dates yet.</p>';
    h += '<details class="gg-add"><summary>+ Add a date</summary><div class="gg-chips" role="group" aria-label="Kind">' + ['Birthday', 'Anniversary', 'Holidays', 'Hanukkah', 'Mother\u2019s Day', 'Father\u2019s Day', 'Other'].map(function (k) { return '<button class="gg-chip" data-occkind="' + k + '" aria-pressed="' + ((state.occKind || 'Birthday') === k) + '">' + k + '</button>'; }).join('') + '</div>' +
      '<div class="gg-row2"><label class="gg-field">Name<input id="occ-label" value="' + esc(state.occKind === 'Other' ? '' : state.occKind || 'Birthday') + '"></label><label class="gg-field">Date<input type="date" id="occ-date" value="' + (state.occKind === 'Holidays' ? today().getFullYear() + '-12-25' : '') + '"' + (/Hanukkah|Mother|Father/.test(state.occKind || '') ? ' disabled' : '') + '></label></div>' + (/Hanukkah|Mother|Father/.test(state.occKind || '') ? '<p class="gg-cap">This one moves every year. Gift Gym knows the dates.</p>' : '') +
      '<label class="gg-check"><input type="checkbox" id="occ-yearly" checked> Every year</label><button class="gg-btn" data-act="occ-add">Add date</button></details>';
    h += '<div class="gg-lbl">Clues</div>';
    h += p.clues.length ? p.clues.slice().reverse().map(function (c) { return '<div class="gg-clueitem"><span class="d">' + short(fromIso(c.d)) + '</span><span class="tx">' + esc(c.text) + '</span><button class="gg-link" data-toidea="' + c.id + '">Make it an idea</button></div>'; }).join('') : '<p class="gg-sub">No clues yet. When they mention something they want, need or love, save it from the home screen.</p>';
    h += '<div class="gg-lbl">Ideas</div>';
    h += p.ideas.length ? p.ideas.slice().reverse().map(function (i) { return '<div class="gg-row"><span>' + (i.lens ? '<span class="gg-pill n">' + esc(i.lens) + '</span> ' : '') + esc(i.text) + (i.url ? ' <a class="gg-shop" href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.price ? i.price + ' · Shop' : 'Shop') + ' &#8599;</a>' : '') + '</span><button class="gg-x" data-delidea="' + i.id + '" aria-label="Remove idea">&times;</button></div>'; }).join('') : '';
    h += '<div class="gg-addidea"><div class="gg-chips" role="group" aria-label="Angle">' + LENSES.map(function (l) { return '<button class="gg-chip" data-idealens="' + l[0] + '" aria-pressed="' + (state.ideaLens === l[0]) + '" title="' + esc(l[1]) + '">' + l[0] + '</button>'; }).join('') + '</div>' +
      '<div class="gg-inline"><input class="gg-in" id="idea-text" value="' + esc(state.ideaDraft || '') + '" placeholder="' + (state.ideaLens ? esc(LENSES.filter(function (l) { return l[0] === state.ideaLens; })[0][1]) + '…' : 'An idea for ' + esc(p.name)) + '"><button class="gg-btn sm" data-act="idea-add">Add</button></div></div>';
    h += '<div class="gg-lbl">Past gifts</div>';
    h += p.gifts.length ? p.gifts.slice().reverse().map(function (g) { return '<div class="gg-card"><span class="t"><b>' + esc(g.text) + '</b>' + (g.stars ? '<span class="gg-starshow" aria-label="' + g.stars + ' of 5">' + '★'.repeat(g.stars) + '☆'.repeat(5 - g.stars) + '</span>' : '<span class="gg-pill n">Not rated yet</span>') + '</span><small>' + esc(g.occ) + (g.d ? ' · ' + short(fromIso(g.d)) : '') + (g.note ? ' · “' + esc(g.note) + '”' : '') + '</small></div>'; }).join('') : '<p class="gg-sub">After an occasion, rate how the gift landed and it shows up here.</p>';
    h += '<details class="gg-add"><summary>+ Log a past gift</summary><div class="gg-row2"><label class="gg-field">What<input id="pg-text"></label><label class="gg-field">When<input type="date" id="pg-date"></label></div><label class="gg-field">Occasion<input id="pg-occ" placeholder="Birthday"></label>' +
      '<div class="gg-stars" role="group" aria-label="How it landed">' + [1, 2, 3, 4, 5].map(function (n) { return '<button data-pgstar="' + n + '" aria-pressed="' + ((state.pgStars || 0) >= n) + '" aria-label="' + n + '">' + ((state.pgStars || 0) >= n ? '★' : '☆') + '</button>'; }).join('') + '</div>' +
      '<label class="gg-field">What made it work, or not?<input id="pg-note"></label><button class="gg-btn" data-act="pg-add">Save</button></details>';
    h += '<div class="gg-danger">' + (state.confirmDel ? '<span>Remove ' + esc(p.name) + ' and everything about them from this phone?</span><button class="gg-btn sm danger" data-act="del-person">Remove</button><button class="gg-btn sm ghost" data-act="del-cancel">Keep</button>' : '<button class="gg-link" data-act="del-ask">Remove ' + esc(p.name) + '</button>') + '</div>';
    return h;
  };
  /* Brainstorm by occasion: a few starting points that fit the kind of day, each one tap to add as an idea. */
  var OCC_IDEAS = [
    [/wedding gift|^wedding$|registry|getting married/i, [['Their thing', 'Something from their registry'], ['Callback', 'Their invitation or vows, framed'], ['Together', 'A dinner out for the two of them, on you']]],
    [/anniversary/i, [['Callback', 'A card that remembers their wedding day'], ['Together', 'A bottle to open together that night'], ['Treat', 'Breakfast delivered the morning of']]],
    [/baby|twins|arrival|newborn/i, [['Fix', 'Meals delivered for the first weeks'], ['Treat', 'Something just for the parents, not the baby'], ['Callback', 'A board book with a note inside the cover']]],
    [/1st birthday|first birthday/i, [['Callback', 'A photo book of the first year'], ['Their thing', 'A wooden toy that lasts'], ['Fix', 'Something the parents need: a sitter night']]],
    [/80th|70th|60th|50th|milestone/i, [['Callback', 'Letters from friends, collected in one book'], ['Callback', 'Photos from each decade, framed together'], ['Together', 'Be there: a toast or a dinner']]],
    [/retire/i, [['Their thing', 'A starter kit for the hobby they\u2019ll finally have time for'], ['Together', 'A first-week-of-retirement lunch'], ['Treat', 'Something for slow mornings: great coffee or a robe']]],
    [/closing|move|moving|housewarming|new home|new place/i, [['Fix', 'Lunch delivered on moving day'], ['Fix', 'Your time: help pack, sell or unpack'], ['Callback', 'A photo or print of the old house']]],
    [/hanukkah/i, [['Treat', 'Eight small gifts, one a night'], ['Their thing', 'Beautiful candles for the menorah'], ['Together', 'Latkes night together']]],
    [/mother|father/i, [['Callback', 'A handwritten card with one specific memory'], ['Together', 'A call or visit you plan, not them'], ['Callback', 'A framed photo of the two of you']]],
    [/year-end|thank|team/i, [['Treat', 'Something they\u2019ll use up: great coffee, chocolate or olive oil'], ['Fix', 'A local gift card for a night off'], ['Callback', 'A handwritten note naming what they did']]],
    [/holiday|christmas/i, [['Treat', 'A consumable treat: chocolate, coffee or a candle'], ['Callback', 'An ornament that marks this year'], ['Upgrade', 'A nicer version of something they use daily']]],
    [/birthday/i, [['Their thing', 'Feed what they\u2019re into right now'], ['Treat', 'The nice version they\u2019d never buy'], ['Together', 'Plan something you do together']]]
  ];
  function occIdeas(o, p) {
    for (var i = 0; i < OCC_IDEAS.length; i++) if (OCC_IDEAS[i][0].test(o.label)) return OCC_IDEAS[i][1].filter(function (x) { return !p.ideas.some(function (y) { return y.text === x[1]; }); });
    return [];
  }
  function planPanel(p, o, d) {
    var st = stepsFor(p, o, d), pl = st.plan, key = planKey(o, d), past = d < today();
    var h = '<div class="gg-plan"><span class="gg-lbl" style="margin:0">' + esc(o.label) + ' · ' + fmt(d) + (past ? ' · just passed' : ' · ' + st.n + ' day' + (st.n === 1 ? '' : 's')) + '</span>';
    if (past && pl.gift && !pl.rated) return h + '<b>How did ' + esc(pl.gift) + ' land?</b>' + starsInput(p.id, o.id, d) + '</div>';
    h += '<ol class="gg-checklist">' + st.steps.map(function (s) {
      var body = s.label + ' <span class="gg-when">' + (s.k === 'start' ? short(s.due) : 'by ' + short(s.due)) + '</span>';
      if (s.k === 'pick') body += pl.gift ? '<span class="gift">' + esc(pl.gift) + ' <button class="gg-link" data-act="plan-clear" data-key="' + key + '">change</button></span>' :
        '<span class="gg-inline"><input class="gg-in" id="plan-gift" list="plan-ideas" placeholder="Pick from ideas or type one"><datalist id="plan-ideas">' + p.ideas.map(function (i) { return '<option value="' + esc(i.text) + '">'; }).join('') + '</datalist><button class="gg-btn sm" data-act="plan-pick" data-key="' + key + '">Pick</button></span>';
      var box = s.k === 'buy' || s.k === 'card' ? '<button class="gg-tick" data-act="plan-tick" data-key="' + key + '" data-step="' + s.k + '" aria-pressed="' + s.done + '" aria-label="' + esc(s.label) + ' done">' + (s.done ? '✓' : '') + '</button>' : '<span class="gg-tick static' + (s.done ? ' on' : '') + '">' + (s.done ? '✓' : '') + '</span>';
      return '<li class="' + (s.done ? 'done' : '') + '">' + box + '<span>' + body + '</span></li>';
    }).join('') + '</ol>';
    var oi = pl.gift ? [] : occIdeas(o, p);
    if (oi.length) h += '<div class="gg-occideas"><span class="gg-lbl" style="margin:0">Ideas for ' + (/^the |^\w+\u2019s /i.test(o.label) ? '' : 'a ') + esc(o.label.toLowerCase()) + '</span>' + oi.map(function (x) {
      return '<button class="gg-occidea" data-addidea="' + esc(x[1]) + '" data-lens="' + esc(x[0]) + '"><span class="gg-pill n">' + esc(x[0]) + '</span> ' + esc(x[1]) + ' <b>+</b></button>'; }).join('') + '</div>';
    if (!pl.gift && p.clues.length) h += '<p class="gg-cap">Start from their clues below, then run them through the six angles.</p>';
    return h + '</div>';
  }

  /* ---------- render and events ---------- */
  var timerId = null;
  function render() {
    app.innerHTML = (S[state.screen] || S.home)();
    clearInterval(timerId);
    if (state.screen === 'round' && !state.round.done) timerId = setInterval(function () { var t = document.getElementById('timer'); if (t) t.textContent = timerText(state.round); }, 500);
  }
  function readSlots() { if (state.screen !== 'round' || !state.round || state.round.done) return; state.round.slots.forEach(function (s, i) { var el = document.getElementById('slot-' + i); if (el) s.text = el.value.trim(); }); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  app.addEventListener('click', function (e) {
    var t = e.target.closest('button, [data-go]'); if (!t) return;
    var a = t.dataset.act;
    if (t.dataset.go) { show(t.dataset.go); return; }
    if (t.dataset.person && !a) { show('person', { person: t.dataset.person, occ: t.dataset.occ || null, confirmDel: false, ideaLens: null, ideaDraft: '' }); return; }
    if (a === 'round') {
      var seed = t.dataset.seed === 'random' ? Math.floor(Math.random() * 1e9) + 1 : +t.dataset.seed;
      show('round', { round: { g: dealPerson(seed), start: Date.now(), slots: [{ lens: '', text: '' }, { lens: '', text: '' }, { lens: '', text: '' }], done: false } });
      track('giftgym-round'); return;
    }
    if (t.dataset.slot != null) { readSlots(); var sl = state.round.slots[+t.dataset.slot]; sl.lens = sl.lens === t.dataset.lens ? '' : t.dataset.lens; render(); var inp = document.getElementById('slot-' + t.dataset.slot); if (inp) inp.focus(); return; }
    if (a === 'round-done') {
      readSlots(); state.round.done = true;
      var tdy = iso(today());
      if (gym.last !== tdy) { gym.streak = gym.last === iso(addDays(today(), -1)) ? (gym.streak || 0) + 1 : 1; gym.last = tdy; }
      gym.rounds = (gym.rounds || 0) + 1; save('gym', gym);
      track('giftgym-done', { ideas: state.round.slots.filter(function (s) { return s.text; }).length });
      render(); window.scrollTo(0, 0); return;
    }
    if (a === 'clue-open') { state.clueOpen = true; render(); var ta = document.getElementById('clue-text'); if (ta) ta.focus(); return; }
    if (a === 'clue-close') { state.clueOpen = false; render(); return; }
    if (t.dataset.cluewho) { var keep = val('clue-text'); state.clueWho = t.dataset.cluewho; render(); document.getElementById('clue-text').value = keep; return; }
    if (a === 'clue-save') {
      var tx = val('clue-text'); if (!tx) return;
      var p = byId(state.clueWho || people[0].id); p.clues.push({ id: uid(), d: iso(today()), text: tx }); persist();
      state.clueOpen = false; track('giftgym-clue'); render(); return;
    }
    if (a === 'add-person') {
      show('newperson'); return;
    }
    if (a === 'person-create') {
      var n = val('np-name'); if (!n) return;
      var np = { id: uid(), name: n, occ: [], clues: [], ideas: [], gifts: [], plans: {} };
      var bd = val('np-bday'); if (bd) np.occ.push({ id: uid(), label: 'Birthday', md: bd.slice(5) });
      people.push(np); persist(); track('giftgym-person'); show('person', { person: np.id }); return;
    }
    var P = state.person && byId(state.person);
    if (t.dataset.occkind) { state.occKind = t.dataset.occkind; render(); var dd = document.querySelector('.gg-add'); if (dd) dd.open = true; return; }
    if (a === 'occ-add' && P) {
      var RULES = { 'Hanukkah': 'hanukkah', 'Mother\u2019s Day': 'nth:5:0:2', 'Father\u2019s Day': 'nth:6:0:3' };
      if (RULES[state.occKind]) { P.occ.push({ id: uid(), label: state.occKind, rule: RULES[state.occKind] }); persist(); state.occKind = null; render(); return; }
      var lb = val('occ-label') || state.occKind || 'Birthday', dt = val('occ-date'); if (!dt) return;
      var yearly = document.getElementById('occ-yearly').checked;
      P.occ.push(yearly ? { id: uid(), label: lb, md: dt.slice(5) } : { id: uid(), label: lb, date: dt }); persist(); state.occKind = null; render(); return;
    }
    if (t.dataset.delocc && P) { P.occ = P.occ.filter(function (o) { return o.id !== t.dataset.delocc; }); persist(); render(); return; }
    if (t.dataset.idealens) { state.ideaDraft = val('idea-text'); state.ideaLens = state.ideaLens === t.dataset.idealens ? null : t.dataset.idealens; render(); var it = document.getElementById('idea-text'); if (it) it.focus(); return; }
    if (a === 'idea-add' && P) { var itx = val('idea-text'); if (!itx) return; P.ideas.push({ id: uid(), text: itx, lens: state.ideaLens || '' }); persist(); state.ideaDraft = ''; state.ideaLens = null; render(); return; }
    if (t.dataset.toidea && P) { var c = P.clues.filter(function (x) { return x.id === t.dataset.toidea; })[0]; state.ideaDraft = ''; render(); var el = document.getElementById('idea-text'); if (el) { el.placeholder = 'Idea from “' + c.text.slice(0, 40) + '”'; el.focus(); el.scrollIntoView({ block: 'center' }); } return; }
    if (t.dataset.addidea && P) { P.ideas.push({ id: uid(), text: t.dataset.addidea, lens: t.dataset.lens || '' }); persist(); render(); return; }
    if (t.dataset.delidea && P) { P.ideas = P.ideas.filter(function (i) { return i.id !== t.dataset.delidea; }); persist(); render(); return; }
    if (a === 'plan-pick' && P) { var gtx = val('plan-gift'); if (!gtx) return; P.plans = P.plans || {}; P.plans[t.dataset.key] = Object.assign(P.plans[t.dataset.key] || {}, { gift: gtx }); persist(); render(); return; }
    if (a === 'plan-clear' && P) { P.plans[t.dataset.key].gift = ''; persist(); render(); return; }
    if (a === 'plan-tick' && P) { P.plans = P.plans || {}; var pl = P.plans[t.dataset.key] = P.plans[t.dataset.key] || {}; pl[t.dataset.step === 'buy' ? 'bought' : 'card'] = !pl[t.dataset.step === 'buy' ? 'bought' : 'card']; persist(); render(); return; }
    if (t.dataset.rate) {
      var rp = byId(t.dataset.p), ro = rp.occ.filter(function (o) { return o.id === t.dataset.o; })[0], k = t.dataset.o + '@' + t.dataset.y, rpl = rp.plans[k];
      rpl.rated = +t.dataset.rate; var od = nextOf(ro);
      rp.gifts.push({ id: uid(), d: iso(od), occ: ro.label, text: rpl.gift, stars: +t.dataset.rate, note: '' });
      persist(); track('giftgym-rate', { stars: +t.dataset.rate }); render(); return;
    }
    if (t.dataset.pgstar) { ['pg-text', 'pg-date', 'pg-occ', 'pg-note'].forEach(function (id) { state[id] = val(id); }); state.pgStars = +t.dataset.pgstar; render(); var d2 = document.querySelectorAll('.gg-add'); d2[d2.length - 1].open = true; ['pg-text', 'pg-date', 'pg-occ', 'pg-note'].forEach(function (id) { document.getElementById(id).value = state[id] || ''; }); return; }
    if (a === 'pg-add' && P) {
      var gt = val('pg-text'); if (!gt) return;
      P.gifts.push({ id: uid(), d: val('pg-date') || iso(today()), occ: val('pg-occ') || 'Gift', text: gt, stars: state.pgStars || 3, note: val('pg-note') });
      persist(); state.pgStars = 0; render(); return;
    }
    if (a === 'del-ask') { state.confirmDel = true; render(); return; }
    if (a === 'del-cancel') { state.confirmDel = false; render(); return; }
    if (a === 'del-person' && P) { people = people.filter(function (x) { return x.id !== P.id; }); persist(); show('home'); return; }
  });
  app.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    var id = e.target.id;
    var map = { 'idea-text': 'idea-add', 'plan-gift': 'plan-pick', 'np-name': 'person-create' };
    if (map[id]) { e.preventDefault(); var b = app.querySelector('[data-act="' + map[id] + '"]'); if (b) b.click(); }
    else if (/^slot-\d$/.test(id)) { e.preventDefault(); var nx = document.getElementById('slot-' + (+id.slice(5) + 1)); if (nx) nx.focus(); }
  });

  S.newperson = function () {
    return bar(true) + '<h1 class="gg-h">Add someone</h1>' +
      '<label class="gg-field">Name<input id="np-name" autocomplete="off"></label>' +
      '<label class="gg-field">Birthday (optional)<input type="date" id="np-bday"></label>' +
      '<p class="gg-cap">The year doesn’t matter, it repeats every year. Add anniversaries and holidays on their page.</p>' +
      '<button class="gg-btn" data-act="person-create">Add</button>';
  };

  render();
  if (setupDone) setupDone.then(function () { render(); });
})();
