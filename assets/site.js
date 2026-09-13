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
  var t = new Date(iso + 'T00:00:00+09:00');
  var now = new Date();
  var kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (9 * 3600000));
  kst.setHours(0, 0, 0, 0);
  return Math.round((t - kst) / 86400000);
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
