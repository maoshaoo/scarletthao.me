/* Changelog: filter by tag (New, Fun, Functionality) or by project (the site, Standby Radar, Brain Power, Snacky Vespa).
   Click a filter, or a tag on any entry, to show only those entries. Click it again, or "Show all", to clear.
   The filter is kept in the address (#new, #fun, #functionality, #standby-radar, #brain-power, #gift-gym, #overhead, #snacky-vespa, #site)
   so a filtered view can be shared, and each Play project links to its own view. */
(function () {
  'use strict';
  var NAMES = { new: 'New', fun: 'Fun', func: 'Functionality' };
  var HASH = { new: 'new', fun: 'fun', func: 'functionality' };
  var PROJ = { site: 'the site', standby: 'Standby Radar', 'brain-power': 'Brain Power', 'gift-gym': 'Gift Gym', overhead: 'Overhead', 'snacky-vespa': 'Snacky Vespa' };
  var PHASH = { site: 'site', standby: 'standby-radar', 'brain-power': 'brain-power', 'gift-gym': 'gift-gym', overhead: 'overhead', 'snacky-vespa': 'snacky-vespa' };
  var entries = document.querySelectorAll('article.entry');
  var btns = document.querySelectorAll('.flt');
  var status = document.getElementById('flt-status');
  var current = { kind: '', val: '' };

  function tagOf(el) { var m = /tag-(new|fun|func)\b/.exec(el.className); return m ? m[1] : ''; }
  function inProject(a, p) { return (' ' + (a.getAttribute('data-project') || 'site') + ' ').indexOf(' ' + p + ' ') >= 0; }

  function apply(kind, val, push) {
    current = { kind: val ? kind : '', val: val };
    var shown = 0;
    entries.forEach(function (a) {
      var has = !val || (kind === 'tag' ? !!a.querySelector('.tag-' + val) : inProject(a, val));
      a.hidden = !has; if (has) shown++;
    });
    btns.forEach(function (b) {
      var on = !!val && ((kind === 'tag' && b.dataset.tag === val) || (kind === 'project' && b.dataset.project === val));
      b.setAttribute('aria-pressed', String(on));
    });
    status.hidden = !val;
    if (val) status.querySelector('span').textContent = 'Showing ' + shown + ' ' + (kind === 'tag' ? NAMES[val] + (shown === 1 ? ' update' : ' updates') : (shown === 1 ? 'update' : 'updates') + ' to ' + PROJ[val]) + '.';
    if (push) {
      try { history.replaceState(null, '', val ? '#' + (kind === 'tag' ? HASH[val] : PHASH[val]) : location.pathname); } catch (e) {}
    }
  }
  function toggle(kind, val) { apply(kind, current.kind === kind && current.val === val ? '' : val, true); }

  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.tag) toggle('tag', b.dataset.tag); else toggle('project', b.dataset.project);
      if (window.umami && typeof window.umami.track === 'function') { try { window.umami.track('changelog-filter', { tag: current.val || 'all' }); } catch (e) {} }
    });
  });
  document.getElementById('flt-all').addEventListener('click', function () { apply('', '', true); });

  // Tags on entries work as filters too
  document.querySelectorAll('article.entry .tag').forEach(function (t) {
    var tag = tagOf(t); if (!tag) return;
    t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0');
    t.setAttribute('title', 'Show only ' + NAMES[tag]);
    var go = function () { toggle('tag', tag); document.querySelector('.legend').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    t.addEventListener('click', go);
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  var h = location.hash.replace('#', '');
  for (var k in HASH) if (HASH[k] === h) apply('tag', k, false);
  for (var q in PHASH) if (PHASH[q] === h) apply('project', q, false);
})();
