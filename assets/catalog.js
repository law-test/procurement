(function () {
  'use strict';
  var main = document.querySelector('main');
  var trees = Array.from(document.querySelectorAll('main > .tree'));
  if (!trees.length) return;
  var form = document.createElement('div');
  form.className = 'catalog-search';
  form.innerHTML = '<label for="conceptSearch">목차에서 찾기</label><input id="conceptSearch" type="search" placeholder="예: 계약변경, 전자조달, W1.1.1" autocomplete="off"><p id="catalogStatus" role="status"></p>';
  main.querySelector('h2').before(form);
  var input = form.querySelector('input'), status = form.querySelector('p');
  function norm(value) { return value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR'); }
  input.addEventListener('input', function () {
    var term = norm(input.value), count = 0;
    var subject = '';
    Array.from(main.children).forEach(function (el) {
      if (el.tagName === 'H2') subject = el.textContent;
      if (!el.classList.contains('tree')) return;
      var major = el.previousElementSibling;
      var visible = 0;
      Array.from(el.children).forEach(function (li) {
        var link = li.querySelector('a');
        var match = norm(subject + ' ' + major.textContent + ' ' + li.textContent + ' ' + link.getAttribute('href')).includes(term);
        li.hidden = !match; if (match) visible++;
      });
      el.hidden = !visible; major.hidden = !visible; count += visible;
    });
    main.querySelectorAll(':scope > h2').forEach(function (heading) {
      var next = heading.nextElementSibling, visible = false;
      while (next && next.tagName !== 'H2') { if (next.classList.contains('tree') && !next.hidden) visible = true; next = next.nextElementSibling; }
      heading.hidden = !visible;
    });
    status.textContent = term ? (count ? count + '개 목차를 찾았습니다.' : '찾는 목차가 없습니다. 다른 검색어를 입력하세요.') : '과목명, 개념명 또는 항목 번호로 찾을 수 있습니다.';
  });
  input.dispatchEvent(new Event('input'));
})();
