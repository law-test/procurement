// Shared navigation and calendar calculations. Exam dates use Korea time.
window.PPM = {
  schedule: [
    { key: 'apply', label: '필기 원서접수', from: '2026-09-14', to: '2026-09-17' },
    { key: 'written', label: '필기시험', from: '2026-10-03' },
    { key: 'practic', label: '실기시험', from: '2026-11-14' },
    { key: 'result', label: '최종 합격자 발표', from: '2026-12-18' }
  ],
  checkedAt: '2026-09-14'
};

function ppmDaysUntil(iso, now) {
  var target = Date.parse(iso + 'T00:00:00Z');
  var korea = new Date((now === undefined ? Date.now() : Number(now)) + 9 * 3600000);
  var today = Date.UTC(korea.getUTCFullYear(), korea.getUTCMonth(), korea.getUTCDate());
  return Math.round((target - today) / 86400000);
}

function ppmRenderDday() {
  document.querySelectorAll('[data-dday]').forEach(function (el) {
    var item = window.PPM.schedule.find(function (s) { return s.key === el.getAttribute('data-dday'); });
    if (!item) return;
    var d = ppmDaysUntil(item.from);
    el.textContent = (d > 0 ? 'D-' + d : d === 0 ? 'D-DAY' : '일정 경과') + ' · ' + item.label;
  });
}

(function () {
  'use strict';
  function init() {
    ppmRenderDday();
    var nav = document.querySelector('nav.menu');
    if (nav) {
      nav.setAttribute('aria-label', '주 메뉴');
      nav.id = 'site-menu';
      var current = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
      var best = null, length = -1;
      nav.querySelectorAll('a').forEach(function (a) {
        a.removeAttribute('aria-current');
        var path = new URL(a.getAttribute('href') || './', location.href).pathname.replace(/index\.html$/, '').replace(/\/$/, '');
        if ((current === path || path && current.indexOf(path + '/') === 0) && path.length > length) {
          best = a; length = path.length;
        }
      });
      if (best) best.setAttribute('aria-current', 'page');
      var toggle = document.createElement('button');
      toggle.className = 'menu-toggle'; toggle.type = 'button';
      toggle.textContent = '메뉴'; toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', nav.id);
      nav.parentNode.insertBefore(toggle, nav);
      nav.classList.add('menu-enhanced');
      function close() { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open);
      });
      nav.addEventListener('click', function (event) { if (event.target.closest('a')) close(); });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { close(); toggle.focus(); }
      });
    }
    document.querySelectorAll('.tablewrap').forEach(function (el) {
      if (el.scrollWidth > el.clientWidth) { el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', '좌우로 스크롤할 수 있는 표'); }
    });
    document.querySelectorAll('th').forEach(function (el) { if (!el.hasAttribute('scope')) el.setAttribute('scope', 'col'); });
    var header = document.querySelector('header');
    if (header && typeof ResizeObserver === 'function') {
      new ResizeObserver(function () { document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px'); }).observe(header);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ppmRenderDday(); });
})();
