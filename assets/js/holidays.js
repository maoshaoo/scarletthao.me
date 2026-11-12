/* Daily banner, just below the header. On holidays it shows a holiday line; on every other day, a fun fact.
   Holiday banner: on certain days, a thin banner with one line.
   Dates are checked in San Francisco time. Visitors can close it; it stays closed for that day on that browser.
   Preview any banner with ?holiday=<id>, e.g. /?holiday=veterans. Preview a fun fact with ?fact=<number>, e.g. /?fact=1.
   Fun facts rotate by day of the year (San Francisco time), so everyone sees the same one on the same day.
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

  var FACTS = [
      "Octopuses have three hearts and blue blood.",
      "A group of flamingos is called a flamboyance.",
      "Wombats poop cubes.",
      "Sea otters hold hands while they sleep so they don’t drift apart.",
      "Honeybees can learn to recognize human faces.",
      "Crows remember the faces of people who wronged them, and teach other crows to scold them too.",
      "Koala fingerprints are so close to humans’ they could confuse a crime lab.",
      "A shrimp’s heart is in its head.",
      "Butterflies taste with their feet.",
      "Male seahorses carry the babies and give birth.",
      "Gentoo penguins court each other with pebbles.",
      "A blue whale’s heart weighs about 400 pounds.",
      "Flamingos are pink because of the shrimp and algae they eat.",
      "Axolotls can regrow lost legs, and even parts of their heart and brain.",
      "Tardigrades have survived exposure to outer space.",
      "Cats can’t taste sweetness.",
      "A group of owls is called a parliament.",
      "Every dog’s nose print is unique, like a fingerprint.",
      "Hummingbirds can fly backwards.",
      "Pigeons have been trained to tell a Monet from a Picasso.",
      "Elephants are one of the few mammals that can’t jump.",
      "Sea stars don’t have a brain.",
      "Edible honey has been found in ancient Egyptian tombs. It basically never spoils.",
      "Bananas are berries. Strawberries aren’t.",
      "Peanuts aren’t nuts; they’re legumes, like beans.",
      "The first cultivated carrots were purple and yellow, not orange.",
      "Ketchup was sold as medicine in the 1830s.",
      "The inventor of the Pringles can asked to have some of his ashes buried in one, and his family did it.",
      "March 14 is both Pi Day and National Potato Chip Day.",
      "Fortune cookies were popularized in California, not China.",
      "Stored in big enough piles, pistachios can spontaneously catch fire.",
      "Apples float because they’re about a quarter air.",
      "Every cashew grows hanging off the bottom of a fruit called a cashew apple.",
      "Vanilla is the second most expensive spice in the world, after saffron.",
      "A day on Venus is longer than its year.",
      "Earth has more trees than the Milky Way has stars.",
      "A teaspoon of neutron star would weigh about a billion tons.",
      "The sunlight hitting you right now left the sun about 8 minutes ago.",
      "Footprints on the Moon could last millions of years, since there’s no wind to erase them.",
      "Saturn is less dense than water. In a big enough bathtub, it would float.",
      "Lightning is about five times hotter than the surface of the sun.",
      "Bananas are slightly radioactive, thanks to their potassium.",
      "Your body holds roughly as many bacterial cells as human cells.",
      "Astronauts say space smells like seared steak and hot metal.",
      "Olympus Mons on Mars is about two and a half times taller than Mount Everest.",
      "About a million Earths could fit inside the sun.",
      "The Eiffel Tower can grow about six inches taller in summer, as the metal expands in the heat.",
      "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
      "Oxford University is older than the Aztec Empire.",
      "Woolly mammoths were still alive on a remote Arctic island when the pyramids were built.",
      "Nintendo was founded in 1889, as a playing card company.",
      "The shortest war in history, between Britain and Zanzibar in 1896, lasted under an hour.",
      "Abraham Lincoln is in the National Wrestling Hall of Fame.",
      "The fax machine was invented before the telephone.",
      "The first known vending machine dispensed holy water, about 2,000 years ago.",
      "The first computer “bug” was a real moth stuck in a computer at Harvard in 1947.",
      "The lighter was invented before the match.",
      "The Statue of Liberty was a shiny copper-brown before it weathered green.",
      "Napoleon wasn’t short. He was about average height for his time.",
      "Canada has more lakes than the rest of the world combined.",
      "Russia spans 11 time zones.",
      "Australia is wider than the Moon.",
      "Alaska is the westernmost, northernmost and easternmost US state, because its islands cross the 180th meridian.",
      "At Point Nemo, the most remote spot in the ocean, the nearest people are often the astronauts on the space station.",
      "San Francisco’s cable cars are the only moving National Historic Landmark in the US.",
      "The Golden Gate Bridge’s color, “International Orange,” started out as the primer.",
      "San Francisco’s fog has a name, Karl, and social media accounts.",
      "The peak farthest from Earth’s center isn’t Everest. It’s Chimborazo in Ecuador, thanks to the bulge at the equator.",
      "There’s a town in Norway called Hell, and it does freeze over.",
      "Istanbul sits on two continents, Europe and Asia.",
      "“Goodbye” is a contraction of “God be with ye.”",
      "The dot over a lowercase i or j is called a tittle.",
      "The word “nice” used to mean “foolish.”",
      "“Hangry” officially joined the Oxford English Dictionary in 2018.",
      "The ampersand (&) used to be recited as the 27th letter of the English alphabet.",
      "“Stewardesses” is one of the longest words you can type with only your left hand.",
      "Babies are born with about 300 bones. Adults have 206.",
      "Your stomach makes a new lining every few days, so it doesn’t digest itself.",
      "Humans faintly glow in the dark, just too dimly for our eyes to see.",
      "Try it: you can’t hum while holding your nose closed.",
      "Fingernails grow faster than toenails.",
      "A “jiffy” is a real unit of time, used in physics and computing.",
      "The first item ever sold on eBay was a broken laser pointer.",
      "Bubble wrap was first invented as textured wallpaper.",
      "Play-Doh started out as a wallpaper cleaner.",
      "Frisbees got their name from the Frisbie Baking Company, whose pie tins college students tossed around.",
      "Super Mario was originally called Jumpman.",
      "LEGO makes more tires each year than any car-tire company, counting the tiny ones.",
      "“Vespa” means “wasp” in Italian, named for the scooter’s buzz and narrow waist.",
      "Vespa’s birthday is April 23, 1946, the day its patent was filed.",
      "Velcro was inspired by the burrs that stuck to an engineer’s dog on a walk.",
      "The hashtag symbol is technically called an octothorpe.",
      "Basketball was invented in 1891 with peach baskets. Someone had to fetch the ball after every basket.",
      "The longest tennis match in history lasted 11 hours and 5 minutes, over three days at Wimbledon.",
      "A golf ball has about 300 to 500 dimples, which help it fly farther.",
      "The “Jeopardy!” theme music lasts 30 seconds, exactly how long players have for Final Jeopardy.",
      "A well-shuffled deck of cards is almost certainly in an order no deck has ever been in before.",
      "Olympic gold medals are mostly silver, with a thin gold coating."
  ];

  // Fun fact of the day: shown on days without a holiday banner.
  function showFact() {
    var start = Date.UTC(Y, 0, 0), today = Date.UTC(Y, M - 1, D);
    var doy = Math.round((today - start) / 864e5);
    var n = factPreview ? (parseInt(factPreview, 10) - 1) : (doy + Y) % FACTS.length;
    if (n < 0 || n >= FACTS.length) return;
    var fkey = 'fact-closed-' + Y + '-' + M + '-' + D;
    try { if (!factPreview && localStorage.getItem(fkey)) return; } catch (e) {}
    var el = document.createElement('aside');
    el.className = 'hbanner fact';
    el.setAttribute('aria-label', 'Fun fact of the day');
    var k = document.createElement('span'); k.className = 'hb-k'; k.textContent = 'Did you know?';
    var t = document.createElement('p'); t.className = 'hb-txt'; t.textContent = FACTS[n];
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'hb-x'; x.setAttribute('aria-label', 'Close this fun fact'); x.textContent = '×';
    x.setAttribute('data-umami-event', 'fun-fact-close'); x.setAttribute('data-umami-event-fact', String(n + 1));
    x.addEventListener('click', function () { el.remove(); try { localStorage.setItem(fkey, '1'); } catch (e) {} });
    el.appendChild(k); el.appendChild(t); el.appendChild(x);
    place(el);
  }

  function place(el) {
    var hdr = document.querySelector('header.site-hdr');
    var skip = document.querySelector('.skip');
    if (hdr) hdr.parentNode.insertBefore(el, hdr.nextSibling);
    else document.body.insertBefore(el, skip ? skip.nextSibling : document.body.firstChild);
    document.documentElement.classList.add('has-hbanner');
    // Line the banner's text up with the left edge of the page: the name in the header, or the page column when there's no header
    function align() {
      var t = document.querySelector('header.site-hdr .mark'), left;
      if (t) left = t.getBoundingClientRect().left;
      else {
        t = document.querySelector('.page') || document.querySelector('main');
        if (!t) return;
        left = t.getBoundingClientRect().left + parseFloat(getComputedStyle(t).paddingLeft || 0);
      }
      el.style.paddingLeft = Math.max(16, Math.round(left)) + 'px';
    }
    align();
    window.addEventListener('resize', align);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
  }

  var preview = (location.search.match(/[?&]holiday=([\w-]+)/) || [])[1];
  var factPreview = (location.search.match(/[?&]fact=(\d+)/) || [])[1];
  var h = null;
  if (!factPreview) {
    for (var i = 0; i < HOLIDAYS.length; i++) {
      if (preview ? HOLIDAYS[i].id === preview : matches(HOLIDAYS[i].when)) { h = HOLIDAYS[i]; break; }
    }
  }
  if (!h) { showFact(); return; }

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
  place(el);

  // Halloween: the scroll truck wears a pumpkin
  if (h.id === 'halloween') {
    var truck = document.querySelector('.road .truck');
    if (truck) { var c = document.createElement('span'); c.className = 'costume'; c.setAttribute('aria-hidden', 'true'); c.textContent = '🎃'; truck.appendChild(c); }
  }
})();
