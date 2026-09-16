(function () {
  'use strict';
  var root = document.getElementById('story-root'), C = window.JodalStory;
  if (!root || !C) return;
  var KEY = 'jodal.story.v1', roles = ['supplier', 'manager'], campaigns = {}, failures = {}, active = null, dialog = null, loading = false;
  var labels = { money: '운영 여력', trust: '신뢰', quality: '완성도', time: '남은 여유' };
  var memoryOnly = false, storageNote = '', store = { version: 1, runs: {}, collection: {} };
  var initialRole = new URLSearchParams(location.search).get('role');
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function button(action, label, cls, data) { return '<button type="button" class="' + (cls || 'story-quiet') + '" data-action="' + action + '"' + (data || '') + '>' + label + '</button>'; }
  function readStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !parsed.runs || typeof parsed.runs !== 'object' || Array.isArray(parsed.runs)) throw Error('shape');
      store = { version: 1, runs: {}, collection: {} };
      roles.forEach(function (r) {
        if (parsed.runs[r]) store.runs[r] = parsed.runs[r];
        if (parsed.collection && Array.isArray(parsed.collection[r])) store.collection[r] = parsed.collection[r].filter(function (x) { return typeof x === 'string'; }).slice(0, 30);
      });
    } catch (e) { storageNote = '저장 기록을 읽지 못했어요. 새로 시작하면 새 기록이 저장됩니다.'; memoryOnly = true; }
  }
  function latestSave() {
    try {
      var latest = JSON.parse(localStorage.getItem(KEY));
      return latest && latest.version === 1 && latest.runs && typeof latest.runs === 'object' && !Array.isArray(latest.runs) ? latest : null;
    } catch (e) { return null; }
  }
  function mergeCollections(latest) {
    if (!latest || !latest.collection) return;
    roles.forEach(function (r) {
      var remote = Array.isArray(latest.collection[r]) ? latest.collection[r] : [];
      store.collection[r] = Array.from(new Set((store.collection[r] || []).concat(remote).filter(function (id) { return typeof id === 'string'; }))).slice(0, 30);
    });
  }
  function persist() {
    try {
      var latest = latestSave();
      if (latest && !memoryOnly) roles.forEach(function (r) { if (r !== active && latest.runs[r]) store.runs[r] = latest.runs[r]; });
      mergeCollections(latest);
      localStorage.setItem(KEY, JSON.stringify(store)); memoryOnly = false; storageNote = '';
    }
    catch (e) { memoryOnly = true; storageNote = '지금은 이 화면에서만 이어집니다. 브라우저 저장이 막혀 있어 창을 닫으면 이번 진행을 잃을 수 있어요.'; }
  }
  function sourceLink(k) {
    if (!k || typeof k.sourceUrl !== 'string') return '';
    try { var u = new URL(k.sourceUrl); if (u.protocol !== 'https:') return ''; } catch (e) { return ''; }
    return '<details><summary>판단의 근거 확인</summary><a href="' + esc(k.sourceUrl) + '" target="_blank" rel="noopener">공식 원문 열기 ↗</a> · 확인 ' + esc(k.sourceChecked) + (k.atomId ? ' · ' + esc(k.atomId) : '') + '</details>';
  }
  function knowledge(k) { return k ? '<section class="story-knowledge"><div class="card-label">획득한 판단 카드</div><h3>' + esc(k.title) + '</h3><p>' + esc(k.body) + '</p>' + sourceLink(k) + '</section>' : ''; }
  function world(scene) {
    var sky = scene === 'celebration' ? '#f8dba3' : '#dbece1';
    var building = '<g stroke="#244449" stroke-width="3" stroke-linejoin="round"><path d="M170 92L275 38 380 92Z" fill="#6da59a"/><rect x="183" y="91" width="184" height="104" rx="5" fill="#fffcde"/><rect x="197" y="104" width="156" height="16" fill="#a6cfbf"/><path d="M217 125v58m39-58v58m39-58v58m39-58v58" stroke="#adc0a2" stroke-width="13"/><rect x="264" y="148" width="29" height="47" fill="#487d76"/><path d="M171 199h208m-217 9h226"/><circle cx="275" cy="76" r="11" fill="#ffc965"/><path d="M272 65v22m-8-11h23" stroke-width="2"/></g>';
    var foreground = '';
    if (scene === 'delivery') foreground = '<g stroke="#244449" stroke-width="3"><rect x="51" y="149" width="111" height="59" rx="7" fill="#efae58"/><path d="M163 167h43l24 24v17h-67Z" fill="#4c998a"/><path d="M174 173h26l17 17h-43Z" fill="#dcefe5"/><circle cx="80" cy="210" r="15" fill="#244449"/><circle cx="194" cy="210" r="15" fill="#244449"/><circle cx="80" cy="210" r="6" fill="#ffeac0"/><circle cx="194" cy="210" r="6" fill="#ffeac0"/><path d="M80 162v32m-13-17h27" stroke="#fff5ce" stroke-width="5"/></g>';
    else if (scene === 'workshop' || scene === 'inspection') foreground = '<g stroke="#244449" stroke-width="3"><path d="M52 194h116m-103 0v29m90-29v29"/><rect x="70" y="143" width="75" height="51" rx="8" fill="#4c998a"/><rect x="82" y="153" width="37" height="25" rx="3" fill="#d8ebae"/><circle cx="132" cy="161" r="4" fill="#ffc965"/><path d="M95 185h16m-41-42l-10-15"/><circle cx="163" cy="142" r="22" fill="#fffae5"/><path d="M150 142l8 8 16-19" stroke="#267b68" stroke-width="5"/></g>';
    else if (scene === 'notice' || scene === 'meeting') foreground = '<g stroke="#244449" stroke-width="3"><path d="M70 91h76v113H70Z" fill="#7ba89b"/><path d="M78 99h61v91H78Z" fill="#fff9df"/><path d="M84 111h48m-48 15h36m-36 15h42m-42 15h29" stroke="#829c84"/><circle cx="109" cy="178" r="10" fill="#efae58"/><path d="M103 179l4 4 8-10" stroke-width="2"/><path d="M77 204v17m61-17v17"/></g>';
    else foreground = '<g stroke="#244449" stroke-width="3"><path d="M51 151l44-24 49 24v61H51Z" fill="#edb26b"/><path d="M40 151l55-34 58 34" fill="none"/><rect x="64" y="167" width="26" height="26" fill="#cce7d9"/><rect x="106" y="164" width="25" height="48" fill="#49786d"/><path d="M69 140h44" stroke="#fff6da" stroke-width="6"/></g>';
    var confetti = scene === 'celebration' ? '<path d="M97 56l7 9m290-4l-7 12M151 32l4 10m214 97l14 3M46 86l10-4" stroke="#d9903a" stroke-width="5"/><path d="M129 80l6-8m270 78l8 7m-76-133l-6 9" stroke="#3c8f7c" stroke-width="5"/>' : '';
    return '<svg class="story-world" viewBox="0 0 460 250" role="img" aria-label="작업실과 국립새봄과학관이 연결된 이야기 마을"><rect x="0" y="0" width="460" height="250" rx="24" fill="' + sky + '"/><circle cx="388" cy="43" r="26" fill="#ffcf71"/><path d="M27 70c0-15 22-21 32-9 20-8 31 5 30 13H27m295-44c1-11 20-18 29-7 15-4 24 4 22 12h-51" fill="#fffbed"/><path d="M0 207q130-32 224 3t236-5v45H0Z" fill="#a9c1a2"/><path d="M111 240q97-54 220-9" fill="none" stroke="#fbf0ce" stroke-width="18"/>' + building + foreground + '<g fill="#5b937a" stroke="#244449" stroke-width="2"><path d="M421 162v55m-2-62c-42-30-38 39 1 29 38 14 37-52-1-29Z"/><path d="M31 177v39m0-55c-31-19-27 32 0 20 29 7 28-41 0-20Z"/></g>' + confetti + '</svg>';
  }
  function layout(content, title) {
    root.innerHTML = '<div class="story-top"><div class="story-wordmark">첫 계약 <span>원정대</span></div><div class="story-top-actions">' + (active ? button('journal', '선택 노트') + button('cards', '판단 카드') + button('lobby', '역할 바꾸기') : '<a class="story-quiet" href="../">다른 게임</a>') + '</div></div><p class="story-persistent-status' + (memoryOnly ? ' warn' : '') + '" role="status">' + esc(storageNote || '이야기는 이 브라우저에 자동 저장됩니다.') + '</p>' + content + '<p class="story-notice">가상의 국가기관·인물·사업으로 만든 학습 모험입니다. 자원 수치는 게임용이며 실제 금액·법정 기간·시험 점수가 아닙니다. 선택 뒤 획득한 판단 카드에서 공식 근거를 확인하세요. <a href="../privacy/">기록 안내</a></p>';
    if (title) { var h = root.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } root.scrollIntoView({ block: 'start', behavior: 'auto' }); }
  }
  function endingList(c) { return c.nodes.filter(function (n) { return !!n.ending; }); }
  function unlocked(c) { return Array.from(new Set((store.collection[c.id] || []).filter(function (id) { return endingList(c).some(function (n) { return n.ending.id === id; }); }))); }
  function renderRank(c, s) {
    var ranking = document.getElementById('story-ranking'), rank = window.JodalRank;
    if (!ranking || !rank || typeof rank.renderResult !== 'function' || typeof rank.newId !== 'function') return;
    var key = JSON.stringify(s.history);
    if (!s.rankCompletions || typeof s.rankCompletions !== 'object' || Array.isArray(s.rankCompletions)) s.rankCompletions = {};
    if (typeof s.rankCompletions[key] !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.rankCompletions[key])) {
      s.rankCompletions[key] = rank.newId(); persist();
    }
    var payload = { id: s.rankCompletions[key], mode: c.id, revision: C.VERSION, history: s.history.map(function (step) { return { nodeId: step.nodeId, choiceId: step.choiceId }; }) };
    try {
      Promise.resolve(rank.renderResult(ranking, payload)).catch(function () {
        if (ranking.isConnected) ranking.textContent = '점수 기록을 불러오지 못했어요. 이야기와 엔딩은 그대로 이어집니다.';
      });
    } catch (e) { ranking.textContent = '점수 기록을 불러오지 못했어요. 이야기와 엔딩은 그대로 이어집니다.'; }
  }
  function lobby() {
    active = null; dialog = null;
    var cards = roles.map(function (role) {
      var c = campaigns[role], saved = store.runs[role], supplier = role === 'supplier';
      var title = supplier ? '납품 사장님' : '공공조달관리사';
      var desc = supplier ? '작은 회사의 첫 공공계약. 입찰부터 납품과 대금 수령까지, 당신의 약속을 지켜낼까요?' : '과학관의 새 환경교실. 필요한 물건을 공정하게 구하고, 시민에게 제대로 전달할 수 있을까요?';
      return '<article class="story-role"><div class="story-avatar" aria-hidden="true">' + (supplier ? '납' : '관') + '</div><h3>' + title + '</h3><p>' + desc + '</p>' + (c ? button('role', saved ? '이야기 이어하기 →' : '이 역할로 시작 →', 'story-primary', ' data-role="' + role + '"') + '<small>' + c.chapters.length + '개 여정 · 발견한 엔딩 ' + unlocked(c).length + '/' + endingList(c).length + '</small>' : '<div class="story-error">' + esc(failures[role] || '이야기를 불러오고 있어요.') + '</div>') + '</article>';
    }).join('');
    layout('<section class="story-lobby"><div class="story-hero"><div><div class="story-kicker">선택으로 배우는 조달 스토리 게임</div><h1>첫 계약,<br><span>당신이 주인공.</span></h1><p>환경교실의 문이 열리기까지.<br>두 역할, 서로 다른 고민.<br>한 번의 선택이 다음 장면을 바꿉니다.</p></div>' + world('office') + '</div><div class="story-roles"><h2 class="story-role-heading">어떤 입장에서 시작할까요?</h2><div class="story-role-grid">' + cards + '</div>' + (Object.keys(failures).length ? '<div class="story-bottom-actions">' + button('retry', '이야기 다시 불러오기', 'story-secondary') + '</div>' : '') + '</div></section>', true);
  }
  function statsPanel(view) {
    return '<section class="story-box"><h2>나의 상황</h2>' + C.STATS.map(function (k) { return '<div class="story-stat' + (view.stats[k] < 25 ? ' low' : '') + '"><div><span>' + labels[k] + '</span><b>' + view.stats[k] + '</b></div><progress value="' + view.stats[k] + '" max="100" aria-label="' + labels[k] + ' ' + view.stats[k] + '점"></progress></div>'; }).join('') + '<p class="story-resource-note">게임 속 자원 · 0~100<br>지금 선택에 따라 달라집니다.</p></section>';
  }
  function mapPanel(c, v, current) {
    var visited = new Set(c.nodes.filter(function (n) { return v.visited.indexOf(n.id) >= 0; }).map(function (n) { return n.chapter; }));
    return '<section class="story-box"><h2>첫 계약의 여정</h2><ol class="story-map">' + c.chapters.map(function (ch, i) { return '<li class="' + (ch.id === current.chapter ? 'current' : visited.has(ch.id) ? 'visited' : '') + '"' + (ch.id === current.chapter ? ' aria-current="step"' : '') + '>' + (i + 1) + '. ' + esc(ch.title.replace(/^\d+\.\s*/, '')) + (ch.id === current.chapter ? '<small>지금 여기</small>' : '') + '</li>'; }).join('') + '</ol></section>';
  }
  function lockReason(a, v) {
    var r = a.requires || {}, reasons = [];
    if ((r.allFlags || []).some(function (f) { return !v.flags.has(f); }) || (r.noFlags || []).some(function (f) { return v.flags.has(f); })) reasons.push('앞선 선택에서 준비하지 않은 경로');
    Object.keys(r.min || {}).forEach(function (k) { if (v.stats[k] < r.min[k]) reasons.push(labels[k] + ' ' + r.min[k] + ' 이상 필요'); });
    return reasons.join(' · ');
  }
  function render() {
    var c = campaigns[active], s = store.runs[active], v;
    try { v = C.replay(c, s); } catch (e) { return showBroken(e.message); }
    var current = s.pending ? v.last.node : v.node;
    var chapter = c.chapters.find(function (ch) { return ch.id === current.chapter; });
    var main;
    if (s.pending) {
      var last = v.last, delta = C.STATS.map(function (k) { var n = last.after[k] - last.before[k]; return n ? '<span class="story-delta' + (n < 0 ? ' down' : '') + '">' + labels[k] + ' ' + (n > 0 ? '+' : '') + n + '</span>' : ''; }).join('');
      main = '<div class="story-scene-art"><span class="story-scene-label">' + esc(current.location) + '</span>' + world(current.scene) + '</div><div class="story-text"><div class="story-chapter">' + esc(chapter.title) + ' · 선택의 결과</div><h1>당신의 선택이<br>이야기를 움직였습니다.</h1><div class="story-feedback"><div class="picked">선택 · ' + esc(last.choice.label) + '</div><p>' + esc(last.choice.feedback) + '</p><div class="story-deltas">' + delta + '</div></div>' + knowledge(last.choice.knowledge) + '<div class="story-bottom-actions">' + button('advance', v.node.ending ? '이야기의 결말 보기 →' : '다음 장면으로 →', 'story-primary') + '</div></div>';
    } else if (v.node.ending) {
      var e = v.node.ending, found = unlocked(c);
      if (found.indexOf(e.id) < 0) { store.collection[c.id] = found.concat(e.id); persist(); }
      main = '<div class="story-scene-art">' + world('celebration') + '</div><div class="story-ending"><div class="ending-badge" aria-hidden="true">' + '✦' + '</div><div class="story-chapter">나의 첫 계약 · 엔딩 발견</div><h1>' + esc(e.title) + '</h1>' + Array.from(new Set(v.node.text.concat(Array.isArray(e.body) ? e.body : [e.body]))).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '<div class="story-ending-count">' + esc(e.badge || '') + ' · ' + s.history.length + '번의 선택 · 발견한 엔딩 ' + unlocked(c).length + '/' + endingList(c).length + '</div><div class="story-bottom-actions">' + button('journal', '다른 선택을 해볼까?', 'story-primary') + button('lobby', '다른 역할로 만나기', 'story-secondary') + button('endings', '내 엔딩 모음', 'story-secondary') + '</div></div>';
    } else {
      main = '<div class="story-scene-art"><span class="story-scene-label">' + esc(current.location) + '</span>' + world(current.scene) + '</div><div class="story-text"><div class="story-chapter">' + esc(chapter.title) + ' · ' + (s.history.length + 1) + '번째 장면</div><h1>' + esc(current.title) + '</h1>' + (s.history.length === 0 ? '<details class="story-setting"><summary>내 역할과 이번 사업</summary><p>' + esc(c.intro) + '</p></details>' : '') + '<div class="story-speaker">' + esc(current.speaker) + '</div><div class="story-prose">' + current.text.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div><div class="story-choices" aria-label="다음 행동 선택">' + current.choices.map(function (a, i) { var allowed = C.eligible(a, v.stats, v.flags); return '<button type="button" class="story-choice" data-action="choose" data-choice="' + esc(a.id) + '"' + (allowed ? '' : ' disabled') + '><span class="choice-number" aria-hidden="true">' + (i + 1) + '</span><span><strong>' + esc(a.label) + '</strong>' + (a.hint ? '<small>' + esc(a.hint) + '</small>' : '') + (!allowed ? '<small class="lock-note">' + esc(lockReason(a, v)) + '</small>' : '') + '</span></button>'; }).join('') + '</div></div>';
    }
    layout('<div class="story-stage"><section class="story-panel">' + main + '</section><aside class="story-side" aria-label="자원과 여정">' + statsPanel(v) + mapPanel(c, v, current) + '</aside></div>', true);
    if (!s.pending && v.node.ending && window.JodalRank) {
      var ranking = document.createElement('div'); ranking.id = 'story-ranking';
      root.querySelector('.story-ending').appendChild(ranking); renderRank(c, s);
    }
  }
  function showBroken(message) {
    layout('<section class="story-panel story-empty"><h1>이야기를 다시 확인할게요.</h1><p>' + esc(message) + '</p><p>기존 저장값은 그대로 두었습니다. 다시 불러오거나 이 역할을 처음부터 시작할 수 있어요.</p><div class="story-bottom-actions">' + button('retry', '다시 불러오기', 'story-secondary') + button('restart', '이 역할 처음부터', 'story-primary') + button('lobby', '역할 선택', 'story-secondary') + '</div></section>', true);
  }
  function openRole(role) {
    if (!campaigns[role]) return;
    var latest = latestSave();
    if (latest && !memoryOnly && latest.runs[role]) store.runs[role] = latest.runs[role];
    mergeCollections(latest);
    active = role;
    if (!store.runs[role]) { store.runs[role] = C.create(campaigns[role]); persist(); }
    render();
  }
  var beforeDialogFocus;
  function closeDialog() {
    var el = document.getElementById('story-dialog-layer'); if (el) el.remove();
    dialog = null;
    if (beforeDialogFocus && beforeDialogFocus.isConnected) beforeDialogFocus.focus();
  }
  function openDialog(kind, index) {
    if (!active) return;
    var c = campaigns[active], s = store.runs[active], v;
    try { v = C.replay(c, s); } catch (e) { if (kind !== 'restart') return; }
    closeDialog(); beforeDialogFocus = document.activeElement; dialog = { kind: kind, index: index };
    var title = '', content = '';
    if (kind === 'journal') {
      title = '나의 선택 노트';
      content = '<p>어떤 선택을 했는지 돌아보세요. 이전 분기점으로 돌아가 다른 길을 선택할 수도 있어요.</p>' + (v.steps.length ? '<ol class="story-history">' + v.steps.map(function (step, i) { return '<li><strong>' + (i + 1) + '. ' + esc(step.node.title) + '</strong><p>선택: ' + esc(step.choice.label) + '</p><p>' + esc(step.choice.feedback) + '</p>' + button('rewind-ask', '이 선택부터 다시 해보기', 'story-quiet', ' data-index="' + i + '"') + '</li>'; }).join('') + '</ol>' : '<p>첫 선택을 하면 여기에 남아요.</p>') + button('restart', '이 역할 처음부터', 'story-secondary');
    } else if (kind === 'cards') {
      title = '내가 얻은 판단 카드'; var seen = new Set(), list = [];
      v.steps.forEach(function (step) { var k = step.choice.knowledge; if (k && !seen.has(k.atomId || k.title)) { seen.add(k.atomId || k.title); list.push(k); } });
      content = '<p>이야기에서 직접 만난 판단을 모았습니다. 새로운 길에서 다른 카드를 찾아보세요.</p>' + (list.length ? list.map(knowledge).join('') : '<p>판단 카드를 얻는 선택을 하면 여기에 모입니다.</p>');
    } else if (kind === 'endings') {
      title = '내 엔딩 모음'; var found = unlocked(c);
      content = '<p>' + esc(c.title) + ' · ' + found.length + '/' + endingList(c).length + '</p><div class="story-endings">' + endingList(c).map(function (n) { var open = found.indexOf(n.ending.id) >= 0; return '<div class="' + (open ? '' : 'undiscovered') + '"><strong>' + (open ? esc(n.ending.title) : '아직 만나지 않은 결말') + '</strong><small>' + (open ? '발견 완료' : '다른 선택이 새로운 결말로 이어집니다.') + '</small></div>'; }).join('') + '</div>';
    } else if (kind === 'restart' || kind === 'rewind') {
      title = kind === 'restart' ? '이 역할의 이야기를 처음부터?' : '이 선택부터 다시 해볼까요?';
      content = '<p>' + (kind === 'restart' ? '이 역할의 현재 진행만 처음으로 돌아갑니다.' : '이 선택 이후의 진행과 자원을 당시 상태로 되돌립니다.') + ' 발견한 엔딩과 다른 역할의 진행은 그대로 남습니다.</p><div class="story-bottom-actions">' + button(kind === 'restart' ? 'restart-confirm' : 'rewind-confirm', '새로운 길로 출발', 'story-primary', kind === 'rewind' ? ' data-index="' + index + '"' : '') + button('close', '지금 이야기 유지', 'story-secondary') + '</div>';
    }
    root.insertAdjacentHTML('beforeend', '<div id="story-dialog-layer" class="story-drawer"><section class="story-dialog" role="dialog" aria-modal="true" aria-labelledby="story-dialog-title">' + button('close', '닫기', 'story-quiet dialog-close') + '<h2 id="story-dialog-title">' + title + '</h2>' + content + '</section></div>');
    var close = root.querySelector('.dialog-close'); if (close) close.focus();
  }
  async function fetchCampaign(role) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 15000);
    try { var res = await fetch('../data/story-' + role + '.json?v=' + C.VERSION, controller ? { signal: controller.signal } : {}); if (!res.ok) throw Error('HTTP ' + res.status); return C.validate(await res.json()); }
    finally { clearTimeout(timer); }
  }
  async function load() {
    if (loading) return; loading = true;
    var prior = active; active = null; failures = {};
    layout('<section class="story-panel story-empty"><h1>첫 계약의 문을 여는 중…</h1><p>두 주인공의 이야기를 준비하고 있어요.</p></section>');
    await Promise.all(roles.map(async function (r) {
      try { campaigns[r] = await fetchCampaign(r); }
      catch (e) { delete campaigns[r]; failures[r] = '이야기를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'; }
    }));
    loading = false;
    var requested = prior || initialRole; initialRole = null;
    if (roles.indexOf(requested) >= 0 && campaigns[requested]) openRole(requested); else lobby();
  }
  root.addEventListener('click', function (event) {
    var b = event.target.closest('button[data-action]'); if (!b || !root.contains(b) || b.disabled) return;
    var action = b.dataset.action;
    try {
      if (action === 'role') openRole(b.dataset.role);
      else if (action === 'retry') load();
      else if (action === 'lobby') { closeDialog(); lobby(); }
      else if (action === 'choose' && active) { store.runs[active] = C.choose(campaigns[active], store.runs[active], b.dataset.choice); persist(); render(); }
      else if (action === 'advance' && active) { store.runs[active] = C.advance(campaigns[active], store.runs[active]); persist(); render(); }
      else if (['journal', 'cards', 'endings', 'restart'].indexOf(action) >= 0) openDialog(action);
      else if (action === 'rewind-ask') openDialog('rewind', Number(b.dataset.index));
      else if (action === 'close') closeDialog();
      else if (action === 'restart-confirm' && dialog && dialog.kind === 'restart') { store.runs[active] = C.create(campaigns[active]); closeDialog(); persist(); render(); }
      else if (action === 'rewind-confirm' && dialog && dialog.kind === 'rewind') { store.runs[active] = C.rewind(campaigns[active], store.runs[active], Number(b.dataset.index)); closeDialog(); persist(); render(); }
    } catch (e) { storageNote = e.message; render(); }
  });
  document.addEventListener('keydown', function (event) {
    var panel = root.querySelector('.story-dialog'); if (!panel) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
    if (event.key === 'Tab') {
      var focusable = Array.from(panel.querySelectorAll('button:not(:disabled),a[href],summary')).filter(function (x) { return x.getClientRects().length; });
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  readStore(); load();
}());
