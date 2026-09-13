(function () {
  'use strict';
  function read(key) {
    try { var value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch (e) { return {}; }
  }
  function render() {
    var srs = read('ppm.srs.v1'), plan = read('ppm.plan.v1');
    var keys = Object.keys(srs).filter(function (k) {
      var v = srs[k];
      return /\|(quiz|blank|recall)$/.test(k) && v && Number.isInteger(v.n) && v.n >= 0 && v.n <= 4 && Number.isFinite(v.due);
    });
    var today = Math.floor(Date.now() / 86400000);
    var due = keys.filter(function (k) { return srs[k].due <= today; }).length;
    var done = Object.keys(plan).filter(function (k) { return /^[1-7]-[1-3]$/.test(k) && plan[k] === true; }).length;
    document.getElementById('progressLearned').textContent = keys.length.toLocaleString('ko-KR');
    document.getElementById('progressDue').textContent = due.toLocaleString('ko-KR');
    document.getElementById('progressPlan').textContent = done + ' / 21';
    document.getElementById('homeProg').textContent = keys.length ? '학습 기록이 쌓이고 있습니다. 복습할 항목부터 이어가세요.' : '처음 오셨다면 학습계획을 살펴보고, 10문항부터 시작해 보세요.';
  }
  render();
  window.addEventListener('storage', render);
})();
