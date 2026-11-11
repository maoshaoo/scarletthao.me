/* Changelog: click a tag (in the key or on any entry) to show only those entries. Click it again, or "Show all", to clear.
   The filter is kept in the address (#new, #fun, #functionality) so a filtered view can be shared. */
(function () {
  'use strict';
  var NAMES = { new: 'New', fun: 'Fun', func: 'Functionality' };
  var HASH = { new: 'new', fun: 'fun', func: 'functionality' };
  var entries = document.querySelectorAll('article.entry');
  var btns = document.querySelectorAll('.flt');
  var status = document.getElementById('flt-status');
  var current = '';

  function tagOf(el) { var m = /tag-(new|fun|func)\b/.exec(el.className); return m ? m[1] : ''; }

  function apply(tag, push) {
    current = tag;
    var shown = 0;
    entries.forEach(function (a) {
      var has = !tag || !!a.querySelector('.tag-' + tag);
      a.hidden = !has; if (has) shown++;
    });
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tag === tag)); });
    status.hidden = !tag;
    if (tag) {
      status.querySelector('span').textContent = 'Showing ' + shown + ' ' + NAMES[tag] + (shown === 1 ? ' update' : ' updates') + '.';
    }
    if (push) {
      try { history.replaceState(null, '', tag ? '#' + HASH[tag] : location.pathname); } catch (e) {}
    }
  }

  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.dataset.tag;
      apply(current === t ? '' : t, true);
      if (window.umami && typeof window.umami.track === 'function') { try { window.umami.track('changelog-filter', { tag: current || 'all' }); } catch (e) {} }
    });
  });
  document.getElementById('flt-all').addEventListener('click', function () { apply('', true); });

  // Tags on entries work as filters too
  document.querySelectorAll('article.entry .tag').forEach(function (t) {
    var tag = tagOf(t); if (!tag) return;
    t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0');
    t.setAttribute('title', 'Show only ' + NAMES[tag]);
    var go = function () { apply(current === tag ? '' : tag, true); document.querySelector('.legend').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    t.addEventListener('click', go);
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  // Tally: a small superscript count after each tag in the key
  btns.forEach(function (b) {
    var n = document.querySelectorAll('article.entry .tag-' + b.dataset.tag).length;
    var t = b.querySelector('.tag'); var sup = document.createElement('sup');
    sup.className = 'tally'; sup.textContent = n; sup.setAttribute('aria-label', n + ' updates');
    t.appendChild(sup);
  });

  var h = location.hash.replace('#', '');
  for (var k in HASH) if (HASH[k] === h) apply(k, false);
})();
