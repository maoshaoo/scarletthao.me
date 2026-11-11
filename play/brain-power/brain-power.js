/* Brain Power: a quiz board of categories by point value, with Feel smart, Get smart, and Wild card modes.
   Picks are saved only in the visitor's browser. Anonymous usage counts go to Umami. */
(function () {
  'use strict';
  function track(n, d) { try { if (window.umami && typeof window.umami.track === 'function') window.umami.track(n, d); } catch (e) {} }
  // Each category: five clues from easiest (200) to hardest (1000). [clue, options, correct index, why]
  var BANK = {
    'History': [
      ['The Berlin Wall fell in this year.', ['1987', '1989', '1991', '1993'], 1, 'November 9, 1989. Germany reunified the next year.'],
      ['King John sealed this English charter at Runnymede in 1215.', ['Domesday Book', 'Magna Carta', 'Bill of Rights', 'Act of Union'], 1, 'The Magna Carta limited the king’s power for the first time.'],
      ['He was the first US president to live in the White House.', ['George Washington', 'John Adams', 'Thomas Jefferson', 'James Madison'], 1, 'John Adams moved in in 1800. Washington never lived there.'],
      ['In 1932 she became the first woman to fly solo across the Atlantic.', ['Bessie Coleman', 'Harriet Quimby', 'Amelia Earhart', 'Jacqueline Cochran'], 2, 'Amelia Earhart, from Newfoundland to Northern Ireland.'],
      ['This ancient wonder stood in the harbor of Alexandria.', ['The Colossus', 'The Lighthouse', 'The Hanging Gardens', 'The Mausoleum'], 1, 'The Lighthouse, or Pharos. The Colossus was at Rhodes.']
    ],
    'Sports': [
      ['Each soccer team has this many players on the field.', ['9', '10', '11', '12'], 2, 'Eleven, including the goalkeeper.'],
      ['A marathon is this many miles long.', ['24.6', '25', '26.2', '27.5'], 2, '26.2 miles, or 42.195 kilometers.'],
      ['In tennis, a score of zero.', ['Nil', 'Love', 'Duck', 'Blank'], 1, 'Love. One theory traces it to the French l’œuf, “the egg.”'],
      ['This country has won the most men’s World Cups.', ['Germany', 'Italy', 'Argentina', 'Brazil'], 3, 'Brazil, with five titles.'],
      ['This team won the first Super Bowl, in January 1967.', ['Kansas City Chiefs', 'Green Bay Packers', 'New York Jets', 'Dallas Cowboys'], 1, 'The Green Bay Packers beat the Kansas City Chiefs.']
    ],
    'Politics': [
      ['Every US state has this many senators.', ['1', '2', '3', 'It depends on population'], 1, 'Two each, so 100 in all.'],
      ['The number of justices on the US Supreme Court.', ['7', '9', '11', '13'], 1, 'Nine, a number set by Congress in 1869.'],
      ['The number of electoral votes needed to win the presidency.', ['218', '250', '270', '300'], 2, '270, a majority of the 538 total.'],
      ['This amendment guaranteed women the right to vote.', ['15th', '17th', '19th', '21st'], 2, 'The 19th Amendment, ratified in 1920.'],
      ['In 2007 she became the first woman to serve as Speaker of the House.', ['Nancy Pelosi', 'Hillary Clinton', 'Dianne Feinstein', 'Madeleine Albright'], 0, 'Nancy Pelosi, who represented San Francisco.']
    ],
    'Pop Culture': [
      ['Kim, Khloé, and Kourtney are part of this reality TV family.', ['The Osbournes', 'The Kardashians', 'The Duggars', 'The Hiltons'], 1, 'Keeping Up with the Kardashians ran from 2007 to 2021.'],
      ['Taylor Swift’s record-breaking 2023–2024 tour.', ['The Reputation Tour', 'The Eras Tour', 'The 1989 Tour', 'The Lover Tour'], 1, 'The Eras Tour, the highest-grossing concert tour ever.'],
      ['Beyoncé’s fans are known by this name.', ['The Hive', 'The BeyHive', 'The Swarm', 'Queen Bees'], 1, 'The BeyHive.'],
      ['The 2014 Ice Bucket Challenge raised money to fight this disease.', ['MS', 'ALS', 'Parkinson’s', 'Alzheimer’s'], 1, 'ALS. It raised over $100 million in a month.'],
      ['“Barbenheimer” paired Barbie with this film on the same opening weekend.', ['Dune', 'Oppenheimer', 'Tenet', 'Napoleon'], 1, 'Oppenheimer. Both opened July 21, 2023.']
    ],
    'Music': [
      ['He’s known as the King of Pop.', ['Elvis Presley', 'Prince', 'Michael Jackson', 'Justin Timberlake'], 2, 'Michael Jackson. Elvis is the King of Rock and Roll.'],
      ['John Lennon’s band.', ['The Rolling Stones', 'The Beatles', 'The Who', 'The Kinks'], 1, 'The Beatles, from Liverpool.'],
      ['He composed the Moonlight Sonata.', ['Mozart', 'Bach', 'Beethoven', 'Chopin'], 2, 'Ludwig van Beethoven, in 1801.'],
      ['This singer was born Stefani Germanotta.', ['Lady Gaga', 'Gwen Stefani', 'Madonna', 'Katy Perry'], 0, 'Lady Gaga, from New York City.'],
      ['A standard piano has this many keys.', ['76', '82', '88', '96'], 2, '88: 52 white and 36 black.']
    ],
    'Movies': [
      ['Pixar’s first feature film.', ['A Bug’s Life', 'Toy Story', 'Finding Nemo', 'Monsters, Inc.'], 1, 'Toy Story, 1995.'],
      ['He directed Jaws.', ['George Lucas', 'Steven Spielberg', 'Francis Ford Coppola', 'Martin Scorsese'], 1, 'Steven Spielberg, 1975.'],
      ['Humphrey Bogart plays Rick Blaine in this film.', ['The Maltese Falcon', 'Casablanca', 'The Big Sleep', 'Key Largo'], 1, 'Casablanca, 1942.'],
      ['The first non-English-language film to win Best Picture.', ['Roma', 'Parasite', 'Amélie', 'Life Is Beautiful'], 1, 'Parasite, at the 2020 Oscars.'],
      ['It won Best Picture at the very first Academy Awards.', ['Wings', 'Sunrise', 'The Jazz Singer', 'Metropolis'], 0, 'Wings, a World War I film, in 1929.']
    ],
    'Art': [
      ['He painted the Mona Lisa.', ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Botticelli'], 2, 'Leonardo da Vinci. It hangs in the Louvre.'],
      ['He painted The Starry Night.', ['Claude Monet', 'Vincent van Gogh', 'Paul Cézanne', 'Edvard Munch'], 1, 'Vincent van Gogh, in 1889.'],
      ['This pop artist made famous paintings of soup cans.', ['Roy Lichtenstein', 'Keith Haring', 'Andy Warhol', 'Jasper Johns'], 2, 'Andy Warhol, Campbell’s Soup Cans, 1962.'],
      ['Salvador Dalí is the best-known painter of this movement.', ['Cubism', 'Surrealism', 'Impressionism', 'Fauvism'], 1, 'Surrealism. Think melting clocks.'],
      ['He sculpted The Thinker.', ['Auguste Rodin', 'Donatello', 'Bernini', 'Constantin Brâncuși'], 0, 'Auguste Rodin. A cast sits at the Legion of Honor in San Francisco.']
    ],
    'Geography': [
      ['The capital of Australia.', ['Sydney', 'Canberra', 'Melbourne', 'Perth'], 1, 'Canberra, a compromise between Sydney and Melbourne.'],
      ['The largest US state by area.', ['Texas', 'California', 'Alaska', 'Montana'], 2, 'Alaska, more than twice the size of Texas.'],
      ['The Strait of Gibraltar separates Spain from this country.', ['Morocco', 'Algeria', 'Portugal', 'Tunisia'], 0, 'About 14 km (9 miles) at its narrowest.'],
      ['The smallest country in the world by area.', ['Monaco', 'San Marino', 'Liechtenstein', 'Vatican City'], 3, 'Vatican City, about 0.44 square kilometers.'],
      ['This river flows through more countries than any other.', ['Nile', 'Danube', 'Amazon', 'Rhine'], 1, 'The Danube, through ten countries.']
    ],
    'Science': [
      ['The powerhouse of the cell.', ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], 2, 'The mitochondria make most of the cell’s energy.'],
      ['Plants take in this gas for photosynthesis.', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2, 'Carbon dioxide in, oxygen out.'],
      ['The hardest natural mineral.', ['Quartz', 'Diamond', 'Topaz', 'Corundum'], 1, 'Diamond, a 10 on the Mohs scale.'],
      ['Its chemical symbol is Au.', ['Silver', 'Gold', 'Aluminum', 'Argon'], 1, 'Gold, from the Latin aurum.'],
      ['Light travels roughly this fast.', ['300 km/s', '3,000 km/s', '300,000 km/s', '3 million km/s'], 2, 'About 300,000 km per second.']
    ],
    'Food': [
      ['Soup dumplings are most associated with this city.', ['Beijing', 'Shanghai', 'Hong Kong', 'Taipei'], 1, 'Shanghai, especially the Nanxiang area.'],
      ['The nut at the heart of marzipan.', ['Hazelnut', 'Almond', 'Pistachio', 'Cashew'], 1, 'Ground almonds and sugar.'],
      ['Saffron comes from this flower.', ['Tulip', 'Crocus', 'Marigold', 'Lily'], 1, 'The dried stigmas of the saffron crocus.'],
      ['Profiteroles are made from this pastry.', ['Puff', 'Filo', 'Choux', 'Shortcrust'], 2, 'Choux, the same as éclairs.'],
      ['The croissant’s ancestor, the kipferl, comes from this country.', ['France', 'Austria', 'Italy', 'Belgium'], 1, 'Austria. The croissant became French later.']
    ],
    'San Francisco': [
      ['This island prison closed in 1963.', ['Angel Island', 'Treasure Island', 'Alcatraz', 'Yerba Buena'], 2, 'Alcatraz, “The Rock.”'],
      ['The Golden Gate Bridge opened in this year.', ['1927', '1937', '1947', '1957'], 1, 'May 1937.'],
      ['The official name of the Golden Gate Bridge’s color.', ['Golden Red', 'International Orange', 'Bay Rust', 'Signal Orange'], 1, 'International Orange, chosen to stand out in the fog.'],
      ['The only National Historic Landmark that moves.', ['The ferries', 'The cable cars', 'The F-line streetcars', 'Muni buses'], 1, 'San Francisco’s cable cars.'],
      ['The oldest intact building in San Francisco.', ['Coit Tower', 'Mission Dolores', 'The Ferry Building', 'City Hall'], 1, 'Mission Dolores, completed in 1791.']
    ]
  };
  var CATS = Object.keys(BANK), VALS = [200, 400, 600, 800, 1000];
  var SCARLETT = { know: ['History', 'Sports', 'Politics'], learn: ['Pop Culture', 'Music', 'Movies', 'Art'] };
  var picks = null; // visitor's own picks
  try { picks = JSON.parse(localStorage.getItem('bp-picks') || 'null'); } catch (e) {}
  var mode = 'feel', score = 0, board = [], used = {}, cur = null;

  function prefs() { return picks || SCARLETT; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pickBoard() {
    var p = prefs(), list;
    if (mode === 'feel') list = p.know.slice(0, 6);
    else if (mode === 'get') list = p.learn.slice(0, 6);
    else list = shuffle(CATS).slice(0, 5);
    if (!list.length) list = shuffle(CATS).slice(0, 5);
    return list;
  }
  function render() {
    var el = document.getElementById('board'); el.innerHTML = '';
    var cols = 'repeat(' + board.length + ', minmax(5.5rem, 1fr))';
    var head = document.createElement('div'); head.className = 'bhead'; head.style.gridTemplateColumns = cols; head.setAttribute('role', 'row');
    board.forEach(function (c) { var d = document.createElement('div'); d.setAttribute('role', 'columnheader'); d.textContent = c; head.appendChild(d); });
    el.appendChild(head);
    VALS.forEach(function (v, r) {
      var row = document.createElement('div'); row.className = 'brow'; row.style.gridTemplateColumns = cols; row.setAttribute('role', 'row');
      board.forEach(function (c) {
        var k = c + '|' + r, b = document.createElement('button');
        b.type = 'button'; b.className = 'tile'; b.id = 't-' + c.replace(/\W/g, '') + '-' + r; b.setAttribute('role', 'gridcell');
        if (used[k] === undefined) { b.textContent = v; b.setAttribute('aria-label', c + ' for ' + v); b.addEventListener('click', function () { open(c, r); }); }
        else { b.disabled = true; b.textContent = used[k] ? '✓' : '✗'; b.classList.add(used[k] ? 'right' : 'wrong'); b.setAttribute('aria-label', c + ' ' + v + (used[k] ? ', answered right' : ', missed')); }
        row.appendChild(b);
      });
      el.appendChild(row);
    });
    var s = document.getElementById('score'); s.textContent = score; s.className = 'score' + (score < 0 ? ' neg' : '');
    document.getElementById('sb-label').textContent = { feel: 'Feel smart', get: 'Get smart', wild: 'Wild card' }[mode];
  }
  function newBoard() {
    board = pickBoard(); used = {}; score = 0;
    document.getElementById('board').hidden = false; document.getElementById('clue').hidden = true; document.getElementById('done').hidden = true;
    render();
  }
  function open(c, r) {
    cur = { c: c, r: r, q: BANK[c][r] };
    document.getElementById('board').hidden = true;
    var cl = document.getElementById('clue'); cl.hidden = false;
    document.getElementById('c-cat').textContent = c;
    document.getElementById('c-val').textContent = 'For ' + VALS[r];
    document.getElementById('c-q').textContent = cur.q[0];
    var box = document.getElementById('c-opts'); box.innerHTML = '';
    cur.q[1].forEach(function (o, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.id = 'o' + i; b.textContent = o;
      b.addEventListener('click', function () { answer(i); });
      box.appendChild(b);
    });
    document.getElementById('c-why').hidden = true; document.getElementById('c-back').hidden = true;
    box.firstChild.focus();
  }
  function answer(i) {
    var q = cur.q, ok = i === q[2], v = VALS[cur.r];
    document.querySelectorAll('#c-opts .opt').forEach(function (b, j) { b.disabled = true; if (j === q[2]) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
    score += ok ? v : -v; used[cur.c + '|' + cur.r] = ok;
    track('bp-answer', { mode: mode, category: cur.c, value: v, correct: ok ? 'yes' : 'no' });
    var w = document.getElementById('c-why'); w.hidden = false; w.innerHTML = '<strong></strong> ';
    w.querySelector('strong').textContent = ok ? 'Correct! +' + v + '.' : 'Not quite. −' + v + '.';
    w.appendChild(document.createTextNode(q[3] + (!ok && mode === 'get' ? ' This one will be back on your next board.' : '')));
    var bk = document.getElementById('c-back'); bk.hidden = false; bk.focus();
    var s = document.getElementById('score'); s.textContent = score; s.className = 'score' + (score < 0 ? ' neg' : '');
  }
  function back() {
    document.getElementById('clue').hidden = true;
    if (Object.keys(used).length === board.length * VALS.length) return finish();
    document.getElementById('board').hidden = false; render();
    var next = document.querySelector('.tile:not(:disabled)'); if (next) next.focus();
  }
  function finish() {
    var d = document.getElementById('done'); d.hidden = false;
    var right = Object.keys(used).filter(function (k) { return used[k]; }).length, total = board.length * VALS.length;
    document.getElementById('d-score').textContent = score.toLocaleString() + ' points';
    track('bp-board-done', { mode: mode, score: score, right: right, total: total });
    document.getElementById('d-line').textContent = right + ' of ' + total + ' right. ' + (mode === 'feel' ? 'Feeling smart yet?' : mode === 'get' ? 'The misses come back next time. That’s how it sticks.' : 'Chaos, survived.');
  }
  // modes
  var modeBtns = document.querySelectorAll('.mode');
  modeBtns.forEach(function (b) { b.addEventListener('click', function () { mode = b.dataset.m; track('bp-mode', { mode: mode }); modeBtns.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); }); newBoard(); }); });
  // picker
  function paintCats() {
    var p = prefs(), box = document.getElementById('cats'); box.innerHTML = '';
    CATS.forEach(function (c) {
      var s = p.know.indexOf(c) >= 0 ? 'know' : p.learn.indexOf(c) >= 0 ? 'learn' : '';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'cat'; b.id = 'cat-' + c.replace(/\W/g, ''); b.dataset.s = s;
      b.textContent = c;
      if (s) { var sm = document.createElement('small'); sm.textContent = s === 'know' ? 'I know this' : 'Teach me'; b.appendChild(sm); }
      b.setAttribute('aria-label', c + (s === 'know' ? ': I know this' : s === 'learn' ? ': teach me' : ': not picked'));
      b.addEventListener('click', function () {
        var mine = { know: prefs().know.slice(), learn: prefs().learn.slice() };
        mine.know = mine.know.filter(function (x) { return x !== c; }); mine.learn = mine.learn.filter(function (x) { return x !== c; });
        if (s === '') mine.know.push(c); else if (s === 'know') mine.learn.push(c);
        picks = mine; try { localStorage.setItem('bp-picks', JSON.stringify(picks)); } catch (e) {}
        document.getElementById('pk-sum').textContent = 'Using your picks. Change your categories';
        paintCats();
        if (mode !== 'wild') newBoard();
      });
      box.appendChild(b);
    });
  }
  if (picks) document.getElementById('pk-sum').textContent = 'Using your picks. Change your categories';
  document.getElementById('c-back').addEventListener('click', back);
  document.getElementById('d-again').addEventListener('click', newBoard);
  paintCats(); newBoard();
})();
