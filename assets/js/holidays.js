/* Holiday banner: on certain days, a thin banner above the header with one line.
   Dates are checked in San Francisco time. Visitors can close it; it stays closed for that day on that browser.
   Preview any banner with ?holiday=<id>, e.g. /?holiday=veterans.
   To add or change a banner, edit the list below. */
(function () {
  'use strict';

  // when: [month, day] | {nth: n, dow: 0-6 (Sun-Sat), month} with n = -1 for "last" | {range: [[m,d],[m,d]]} | {dates: {year: [m,d]}} | {truckWeek: true}
  // tone: 'warm' (celebrations) or 'quiet' (remembrance)
  var HOLIDAYS = [
    { id: 'new-year', when: [1, 1], icon: '🎉', greet: 'Happy New Year!', line: 'New year, new heights to achieve!', tone: 'warm' },
    { id: 'mlk', when: { month: 1, dow: 1, nth: 3 }, icon: '🕊️', greet: 'Honoring Dr. Martin Luther King Jr.', line: '“The time is always right to do what is right.”', tone: 'quiet' },
    { id: 'lunar-new-year', when: { dates: { 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3] } }, icon: '🧧', greet: 'Happy Lunar New Year!', line: 'Wishing you a year of good luck and good dumplings.', tone: 'warm' },
    { id: 'valentines', when: [2, 14], icon: '💌', greet: 'Happy Valentine’s Day!', line: 'Share your chips with someone you love.', tone: 'warm' },
    { id: 'presidents', when: { month: 2, dow: 1, nth: 3 }, icon: 'flag', greet: 'Happy Presidents’ Day.', line: 'Here’s to everyone who answers the call to serve.', tone: 'warm' },
    { id: 'womens-day', when: [3, 8], icon: '💪', greet: 'Happy International Women’s Day!', line: 'To the women who build, lead, and hold the door for the next ones.', tone: 'warm' },
    { id: 'pi-chips', when: [3, 14], icon: '🥧', greet: 'Happy Pi Day, and National Potato Chip Day.', line: 'Round snacks only today.', tone: 'warm' },
    { id: 'earth-day', when: [4, 22], icon: '🌱', greet: 'Happy Earth Day!', line: 'Go say hi to some flora and fauna.', tone: 'warm' },
    { id: 'vespa', when: [4, 23], icon: '🛵', greet: 'Happy birthday, Vespa!', line: 'Still the best way to get to a snack.', tone: 'warm' },
    { id: 'memorial', when: { month: 5, dow: 1, nth: -1 }, icon: 'flag', greet: 'Remembering those who gave their lives in service to our country.', line: '', tone: 'quiet' },
    { id: 'juneteenth', when: [6, 19], icon: '✊🏾', greet: 'Happy Juneteenth!', line: 'Celebrating freedom, and the work still ahead.', tone: 'warm' },
    { id: 'july-4', when: [7, 4], icon: '🎆', greet: 'Happy Fourth of July!', line: 'The fireworks are best from Twin Peaks, if Karl allows.', tone: 'warm' },
    { id: 'labor', when: { month: 9, dow: 1, nth: 1 }, icon: '🛠️', greet: 'Happy Labor Day!', line: 'Thank you to the people who keep everything running, around the clock.', tone: 'warm' },
    { id: 'truck-drivers', when: { truckWeek: true }, icon: '🚛', greet: 'It’s National Truck Driver Appreciation Week.', line: 'Thank you to every driver who keeps the shelves full.', tone: 'warm' },
    { id: 'indigenous', when: { month: 10, dow: 1, nth: 2 }, icon: '🌾', greet: 'Happy Indigenous Peoples’ Day.', line: 'Honoring the Ramaytush Ohlone, the original people of the San Francisco Peninsula.', tone: 'quiet' },
    { id: 'vlada', when: [10, 20], icon: '🎂', greet: 'Happy birthday to my beautiful, brilliant partner, Vlada!', line: 'She’s the soup in my soup dumpling. I wouldn’t be who I am without her.', tone: 'warm' },
    { id: 'halloween', when: [10, 31], icon: '🎃', greet: 'Happy Halloween!', line: 'The scroll truck is in costume today.', tone: 'warm' },
    { id: 'veterans', when: [11, 11], icon: 'flag', greet: 'Happy Veterans Day!', line: 'Thank you to everyone who served. 🫡', tone: 'warm' },
    { id: 'thanksgiving', when: { month: 11, dow: 4, nth: 4 }, icon: '🦃', greet: 'Happy Thanksgiving!', line: 'Grateful for good people, hard problems, and leftovers.', tone: 'warm' },
    { id: 'year-end', when: { range: [[12, 24], [12, 31]] }, icon: '✨', greet: 'Happy holidays!', line: 'Wishing you a cozy end to the year.', tone: 'warm' }
  ];

  var FLAG = '<svg viewBox="0 0 38 20" aria-hidden="true"><rect width="38" height="20" fill="#FFFFFF"/><g fill="#B3261E"><rect width="38" height="1.54"/><rect y="3.08" width="38" height="1.54"/><rect y="6.15" width="38" height="1.54"/><rect y="9.23" width="38" height="1.54"/><rect y="12.31" width="38" height="1.54"/><rect y="15.38" width="38" height="1.54"/><rect y="18.46" width="38" height="1.54"/></g><rect width="15.2" height="10.77" fill="#2B3A67"/><g fill="#FFFFFF"><circle cx="2.5" cy="2" r=".7"/><circle cx="6" cy="2" r=".7"/><circle cx="9.5" cy="2" r=".7"/><circle cx="13" cy="2" r=".7"/><circle cx="4.2" cy="4.2" r=".7"/><circle cx="7.7" cy="4.2" r=".7"/><circle cx="11.2" cy="4.2" r=".7"/><circle cx="2.5" cy="6.4" r=".7"/><circle cx="6" cy="6.4" r=".7"/><circle cx="9.5" cy="6.4" r=".7"/><circle cx="13" cy="6.4" r=".7"/><circle cx="4.2" cy="8.6" r=".7"/><circle cx="7.7" cy="8.6" r=".7"/><circle cx="11.2" cy="8.6" r=".7"/></g><rect width="38" height="20" fill="none" stroke="rgba(0,0,0,.15)" stroke-width=".6"/></svg>';

  // Today's date in San Francisco
  var p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
  var Y = +p.year, M = +p.month, D = +p.day;

  function dow(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  function daysIn(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function nthDay(y, m, wd, n) {
    if (n > 0) { var first = (wd - dow(y, m, 1) + 7) % 7 + 1; return first + (n - 1) * 7; }
    var last = daysIn(y, m); return last - ((dow(y, m, last) - wd + 7) % 7);
  }
  function matches(w) {
    if (Array.isArray(w)) return M === w[0] && D === w[1];
    if (w.range) { var t = M * 100 + D; return t >= w.range[0][0] * 100 + w.range[0][1] && t <= w.range[1][0] * 100 + w.range[1][1]; }
    if (w.dates) { var x = w.dates[Y]; return !!x && M === x[0] && D === x[1]; }
    if (w.truckWeek) { // Sunday to Saturday of the second full week of September
      if (M !== 9) return false;
      var firstSun = (7 - dow(Y, 9, 1)) % 7 + 1, start = firstSun + 7;
      return D >= start && D <= start + 6;
    }
    return M === w.month && D === nthDay(Y, w.month, w.dow, w.nth);
  }

  var preview = (location.search.match(/[?&]holiday=([\w-]+)/) || [])[1];
  var h = null;
  for (var i = 0; i < HOLIDAYS.length; i++) {
    if (preview ? HOLIDAYS[i].id === preview : matches(HOLIDAYS[i].when)) { h = HOLIDAYS[i]; break; }
  }
  if (!h) return;

  var key = 'banner-closed-' + h.id + '-' + Y;
  try { if (!preview && localStorage.getItem(key)) return; } catch (e) {}

  var el = document.createElement('aside');
  el.className = 'hbanner ' + h.tone;
  el.setAttribute('aria-label', 'Today');
  var ico = document.createElement('span');
  ico.className = 'hb-ico'; ico.setAttribute('aria-hidden', 'true');
  ico.innerHTML = h.icon === 'flag' ? FLAG : h.icon;
  var txt = document.createElement('p');
  txt.className = 'hb-txt';
  var b = document.createElement('b'); b.textContent = h.greet; txt.appendChild(b);
  if (h.line) txt.appendChild(document.createTextNode(' ' + h.line));
  var x = document.createElement('button');
  x.type = 'button'; x.className = 'hb-x'; x.setAttribute('aria-label', 'Close this message'); x.textContent = '×';
  x.addEventListener('click', function () {
    el.remove();
    try { localStorage.setItem(key, '1'); } catch (e) {}
  });
  el.appendChild(ico); el.appendChild(txt); el.appendChild(x);
  // Sits just below the pinned header and scrolls away with the page
  var hdr = document.querySelector('header.site-hdr');
  var skip = document.querySelector('.skip');
  if (hdr) hdr.parentNode.insertBefore(el, hdr.nextSibling);
  else document.body.insertBefore(el, skip ? skip.nextSibling : document.body.firstChild);
  document.documentElement.classList.add('has-hbanner');

  // Halloween: the scroll truck wears a pumpkin
  if (h.id === 'halloween') {
    var truck = document.querySelector('.road .truck');
    if (truck) { var c = document.createElement('span'); c.className = 'costume'; c.setAttribute('aria-hidden', 'true'); c.textContent = '🎃'; truck.appendChild(c); }
  }
})();
