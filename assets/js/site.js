/* Shared behavior for every page. Each feature checks for its elements and does nothing if they are absent. */
(function () {
  'use strict';

  // Copy-email button (home page)
  var copyBtn = document.getElementById('copy-email');
  var addr = document.getElementById('addr');
  if (copyBtn && addr) {
    copyBtn.addEventListener('click', function () {
      function done(t) { copyBtn.textContent = t; setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1600); }
      function select() {
        var r = document.createRange(); r.selectNodeContents(addr);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); done('Selected');
      }
      try { navigator.clipboard.writeText(addr.textContent).then(function () { done('Copied'); }, select); }
      catch (e) { select(); }
    });
  }

  // Live San Francisco time and weather under the name (home page)
  var timeEl = document.getElementById('sf-time');
  if (timeEl && window.Intl) {
    var notes = [
      [4, 7, 'I\u2019m probably already up.'],
      [7, 12, 'Peak focus hours.'],
      [12, 17, 'Somewhere between meetings and a bag of chips.'],
      [17, 21, 'Possibly out on the Vespa.'],
      [21, 28, 'I\u2019m probably asleep. Morning person.']
    ];
    var wx = '';
    var renderTime = function () {
      var now = new Date();
      var time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' })
        .format(now).replace(' AM', 'am').replace(' PM', 'pm');
      var h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(now), 10) % 24;
      var x = h < 4 ? h + 24 : h, note = notes[0][2];
      for (var i = 0; i < notes.length; i++) if (x >= notes[i][0] && x < notes[i][1]) note = notes[i][2];
      timeEl.textContent = 'It\u2019s ' + time + ' in San Francisco' + (wx ? ', ' + wx : '') + '. ' + note;
    };
    var describe = function (code) {
      if (code === 0) return 'clear';
      if (code <= 2) return 'mostly clear';
      if (code === 3) return 'cloudy';
      if (code === 45 || code === 48) return 'foggy';
      if (code >= 51 && code <= 57) return 'drizzly';
      if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
      if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snowy';
      if (code >= 95) return 'stormy';
      return '';
    };
    var setWx = function (t, code) {
      var d = describe(code);
      wx = Math.round(t) + '\u00b0' + (d ? ' and ' + d : '');
      renderTime();
    };
    var WX_TTL = 15 * 60 * 1000;
    var loadWx = function () {
      try {
        var c = JSON.parse(sessionStorage.getItem('sf-wx') || 'null');
        if (c && Date.now() - c.at < WX_TTL) { setWx(c.t, c.code); return; }
      } catch (e) {}
      if (!window.fetch) return;
      // Open-Meteo: free, no API key. https://open-meteo.com
      fetch('https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,weather_code&temperature_unit=fahrenheit')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.current) return;
          var t = j.current.temperature_2m, code = j.current.weather_code;
          try { sessionStorage.setItem('sf-wx', JSON.stringify({ t: t, code: code, at: Date.now() })); } catch (e) {}
          setWx(t, code);
        })
        .catch(function () {});
    };
    renderTime();
    loadWx();
    setInterval(renderTime, 30000);
    setInterval(loadWx, WX_TTL);
  }

  // Scroll truck: a driverless truck that drives along a lane line at the bottom of every page.
  var TRUCK_SVG = '<svg viewBox="0 0 184 68"><defs><pattern id="pat-confetti" width="24" height="20" patternUnits="userSpaceOnUse" patternTransform="scale(1.6)"><rect width="24" height="20" fill="var(--truck-cab)"/><rect x="3" y="3" width="5" height="2" rx="1" fill="var(--scarlet)" transform="rotate(25 5 4)"/><circle cx="16" cy="6" r="1.8" fill="var(--lane)"/><rect x="12" y="13" width="5" height="2" rx="1" fill="var(--ink)" transform="rotate(-30 14 14)"/><circle cx="5" cy="15" r="1.5" fill="var(--scarlet)"/><rect x="19" y="14" width="4" height="2" rx="1" fill="var(--lane)" transform="rotate(60 21 15)"/></pattern></defs><g> <rect class="trailer" x="4" y="10" width="104" height="40" rx="3" fill="url(#pat-confetti)" stroke="var(--ink)" stroke-width="2"/> <rect x="106" y="46" width="12" height="4" fill="var(--ink)"/> <path d="M116 50 V22 Q116 16 122 16 H150 Q156 16 160 22 L172 36 Q176 40 176 46 V50 Z" fill="var(--truck-cab)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/> <path d="M146 21 H152 Q155 21 157 24 L167 36 H146 Z" fill="var(--truck-glass)" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/> <rect x="124" y="21" width="17" height="14" rx="2" fill="var(--truck-glass)" stroke="var(--ink)" stroke-width="1.5"/> <rect x="130" y="9" width="18" height="5" rx="2.5" fill="var(--ink)"/> <rect x="137" y="5" width="4" height="4" rx="1" fill="var(--scarlet)"/> <rect x="160" y="24" width="3" height="9" rx="1.5" fill="var(--ink)"/> <rect x="171" y="42" width="5" height="3" rx="1" fill="var(--scarlet)"/> <g class="wheel"><circle cx="22" cy="54" r="7" fill="var(--truck-tire)"/><circle cx="22" cy="54" r="2.5" fill="var(--truck-cab)"/><rect x="21" y="48" width="2" height="4" fill="var(--truck-cab)"/></g> <g class="wheel"><circle cx="40" cy="54" r="7" fill="var(--truck-tire)"/><circle cx="40" cy="54" r="2.5" fill="var(--truck-cab)"/><rect x="39" y="48" width="2" height="4" fill="var(--truck-cab)"/></g> <g class="wheel"><circle cx="128" cy="54" r="7" fill="var(--truck-tire)"/><circle cx="128" cy="54" r="2.5" fill="var(--truck-cab)"/><rect x="127" y="48" width="2" height="4" fill="var(--truck-cab)"/></g> <g class="wheel"><circle cx="164" cy="54" r="7" fill="var(--truck-tire)"/><circle cx="164" cy="54" r="2.5" fill="var(--truck-cab)"/><rect x="163" y="48" width="2" height="4" fill="var(--truck-cab)"/></g> </g></svg>';
  var road = document.createElement('div');
  road.className = 'road';
  road.setAttribute('aria-hidden', 'true');
  road.innerHTML = '<div class="truck">' + TRUCK_SVG + '</div>';
  document.body.appendChild(road);
  var truck = road.firstChild;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wheels = truck.querySelectorAll('.wheel');
  var lastY = window.scrollY, ticking = false;
  var update = function () {
    ticking = false;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var y = window.scrollY;
    var p = Math.min(1, Math.max(0, y / max));
    var track = window.innerWidth - truck.offsetWidth - 16;
    truck.style.transform = 'translateX(' + (8 + p * track) + 'px)';
    if (!reduce) wheels.forEach(function (w) { w.style.transform = 'rotate(' + (y * 0.9) + 'deg)'; });
    if (y < lastY) truck.classList.add('back'); else if (y > lastY) truck.classList.remove('back');
    lastY = y;
  };
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
