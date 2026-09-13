(function () {
  'use strict';
  var KEY = 'ppm.plan.v1', state = {};
  var boxes = Array.from(document.querySelectorAll('input[data-day][data-round]'));
  var status = document.createElement('p');
  status.className = 'plan-status'; status.setAttribute('role', 'status');
  var first = document.querySelector('.dayb');
  if (!first) return;
  first.before(status);
  function read() {
    try { var value = JSON.parse(localStorage.getItem(KEY) || '{}'); state = value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch (e) { state = {}; }
  }
  function key(box) { return box.dataset.day + '-' + box.dataset.round; }
  function update(saved) {
    var count = boxes.filter(function (box) { return box.checked; }).length;
    status.textContent = '완료한 학습 ' + count + ' / 21' + (saved === false ? ' · 브라우저 저장이 차단되어 이번 화면에서만 유지됩니다.' : ' · 하루 분량을 마치면 해당 회독을 체크하세요.');
  }
  function restore() { read(); boxes.forEach(function (box) { box.checked = state[key(box)] === true; }); update(); }
  restore();
  boxes.forEach(function (box) {
    box.setAttribute('aria-label', box.dataset.day + '일차 ' + box.dataset.round + '회독 완료');
    box.addEventListener('change', function () {
      state[key(box)] = box.checked;
      var saved = true;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { saved = false; }
      update(saved);
    });
  });
  window.addEventListener('storage', function (event) { if (event.key === KEY || event.key === null) restore(); });
})();
