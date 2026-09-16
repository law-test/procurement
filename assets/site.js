// 공공조달관리사 수험·학습·취업 지도 — 공통 스크립트
// 공식 확인된 일정만 둔다. 확인되지 않은 항목은 추가하지 않는다.
window.PPM = {
  schedule: [
    { key: 'apply',   label: '필기 원서접수', from: '2026-09-14', to: '2026-09-17' },
    { key: 'written', label: '필기시험',      from: '2026-10-03' },
    { key: 'practic', label: '실기시험',      from: '2026-11-14' },
    { key: 'result',  label: '최종 합격자 발표', from: '2026-12-18' }
  ],
  checkedAt: '2026-09-09'
};

function ppmDaysUntil(iso) {
  var targetDay = Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
  var currentDay = Math.floor((Date.now() + 9 * 3600000) / 86400000);
  return targetDay - currentDay;
}

function ppmRenderDday() {
  var el = document.querySelector('[data-dday]');
  if (!el) return;
  var target = el.getAttribute('data-dday');
  var item = window.PPM.schedule.filter(function (s) { return s.key === target; })[0];
  if (!item) return;
  var d = ppmDaysUntil(item.from);
  var text = d > 0 ? 'D-' + d : (d === 0 ? 'D-DAY' : '종료');
  el.textContent = text + ' · ' + item.label;
}

document.addEventListener('DOMContentLoaded', ppmRenderDday);

/* 방문 통계 — assets/analytics.js 를 한 번만 불러온다. 토큰이 없으면 아무 일도 없다. */
(function () {
  if (window.__jodalAnalyticsTag) return;
  window.__jodalAnalyticsTag = true;
  var base = (document.querySelector('header a.logo') || {}).getAttribute
    ? (document.querySelector('header a.logo').getAttribute('href') || './') : './';
  var s = document.createElement('script');
  s.src = base + 'assets/analytics.js';
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();
