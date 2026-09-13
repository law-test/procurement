/* Run with: node --test tests/learning-regression.cjs
   Exercises the browser scripts against controlled DOM, network, storage and clock boundaries. */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function harness(page, search = '') {
  const nodes = {}, events = {}, intervals = new Map(), timeouts = new Map(), alerts = [], requests = [];
  let timerId = 0, stored = '{}', now = 1800000000000, denyWrite = false, confirmValue = true;
  function node(id) {
    if (nodes[id]) return nodes[id];
    let html = '';
    const el = { id, value: '', hidden: false, disabled: false, textContent: '', options: [], tagName: 'DIV',
      classList: { add() {}, toggle() {} }, setAttribute(k, v) { this[k] = v; }, focus() {},
      remove() { delete nodes[id]; }, querySelector() { return node(id + '_button'); },
      insertAdjacentHTML(_, value) { this.inserted = (this.inserted || '') + value; },
      appendChild(child) { this.options.push(child); }
    };
    Object.defineProperty(el, 'innerHTML', { get: () => html, set(value) {
      html = value;
      for (const m of value.matchAll(/\bid="([^"]+)"/g)) node(m[1]);
      if (value.includes('<option')) {
        this.options = [...value.matchAll(/<option(?: value="([^"]*)")?[^>]*>([^<]*)<\/option>/g)]
          .map(m => ({ value: m[1] ?? m[2] }));
        this.value = this.options[0]?.value || '';
      }
    }});
    return nodes[id] = el;
  }
  const context = vm.createContext({ console, URLSearchParams, AbortController, Set, Promise,
    Date: class extends Date { static now() { return now; } },
    document: { hidden: false, getElementById: node, createElement: () => node('created' + Math.random()),
      querySelectorAll: () => [], addEventListener(name, fn) { (events[name] ||= []).push(fn); } },
    location: { search }, localStorage: { getItem() { return stored; }, setItem(_, value) {
      if (denyWrite) throw new Error('quota exceeded'); stored = value;
    } },
    fetch(url) { requests.push(url); return context.fetchImpl(url); },
    fetchImpl: async url => ({ ok: true, json: async () => JSON.parse(read(url.replace('../', ''))) }),
    setTimeout(fn) { timeouts.set(++timerId, fn); return timerId; }, clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn) { intervals.set(++timerId, fn); return timerId; }, clearInterval(id) { intervals.delete(id); },
    alert: text => alerts.push(text), confirm: () => confirmValue,
    addEventListener(name, fn) { (events[name] ||= []).push(fn); }, scrollTo() {}
  });
  context.window = context;
  vm.runInContext(read('assets/quiz.js'), context);
  if (page) {
    for (const m of read(page + '/index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(m[1], context);
  }
  return { context, node, events, intervals, timeouts, requests, alerts,
    setStored(value) { stored = value; }, getStored() { return JSON.parse(stored); },
    setDenyWrite(value) { denyWrite = value; }, setConfirm(value) { confirmValue = value; },
    advance(ms) { now += ms; },
    async boot() { (events.DOMContentLoaded || []).forEach(fn => fn()); await flush(); }
  };
}
function quiz(atom, subject = '과목', answer = 0) {
  return { atom, id: atom, subject, answer, choices: ['정답', '다른 답', '세 번째', '네 번째'], q: '질문', stem: '문제', major: '주요항목', gid: 'W1.1.1.1' };
}
function card(id, group = 'W1.1.1') {
  return { id, s: '공공조달 계약절차 기준금액 100만원 이상입니다', t: '개념', m: '주요항목', g: group };
}
function setDrill(h, mode, n = 10) {
  const c = h.context;
  c.ready = true;
  h.node('selMajor').value = 'all'; h.node('selImp').value = 'all';
  h.node('selMode').value = mode; h.node('selCount').value = String(n);
  c.POOL = { quiz: Array.from({ length: 20 }, (_, i) => quiz('Q' + i)), card: Array.from({ length: 20 }, (_, i) => card('C' + i)) };
}

test('shared progress survives corrupt records and blocked writes without losing current session', () => {
  const h = harness(); const q = h.context.PPMQ;
  for (const value of ['null', '[]', '"wrong"', '{"A|quiz":null}', '{"A|quiz":{"n":"2","due":4}}']) {
    h.setStored(value); assert.equal(Object.keys(q.srsGet()).length, 0);
  }
  h.setStored('{}');
  q.grade('A', 'quiz', true);
  assert.equal(q.srsGet()['A|quiz'].due, q.today() + 1);
  q.grade('A', 'quiz', true);
  assert.equal(q.srsGet()['A|quiz'].due, q.today() + 3);
  h.setDenyWrite(true);
  q.grade('B', 'blank', false); q.grade('C', 'recall', true);
  assert.equal(Object.keys(q.srsGet()).length, 3);
  assert.equal(q.storageOk(), false);
});

test('all current quiz/card datasets satisfy runtime validation and cache requests', async () => {
  const h = harness();
  for (const slug of ['law', 'plan', 'contract', 'practice']) {
    await h.context.PPMQ.loadQuiz(slug); await h.context.PPMQ.loadCards(slug);
  }
  await h.context.PPMQ.loadCards('etc');
  await h.context.PPMQ.loadQuiz('law');
  assert.equal(h.requests.length, 9);
  assert.equal(h.timeouts.size, 0);
});

test('failed HTTP, invalid payload and timed out data can all be retried', async () => {
  const h = harness(); const q = h.context.PPMQ;
  h.context.fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(q.loadQuiz('law'), /503/);
  h.context.fetchImpl = async () => ({ ok: true, json: async () => ({ items: [{ answer: 9 }] }) });
  await assert.rejects(q.loadQuiz('law'), /형식/);
  h.context.fetchImpl = () => new Promise(() => {});
  const loading = q.loadQuiz('law');
  [...h.timeouts.values()].forEach(fn => fn());
  await assert.rejects(loading, /초과/);
  h.context.fetchImpl = async () => ({ ok: true, json: async () => ({ items: [quiz('A')] }) });
  assert.equal((await q.loadQuiz('law')).items.length, 1);
});

test('drill mixed sets fill the requested count even when one question type is unavailable', () => {
  for (const withoutQuiz of [false, true]) {
    const h = harness('drill'); setDrill(h, 'mix');
    if (withoutQuiz) h.context.POOL.quiz = [];
    h.context.dStart();
    assert.equal(h.context.Q.items.length, 10);
    assert.ok(h.context.Q.items.some(x => x.mode === 'recall'));
  }
});

test('drill scores a blank only once, rejects extra answers and does not skip on repeated next', () => {
  const h = harness('drill'); setDrill(h, 'blank', 2); const c = h.context;
  c.dStart(); const item = c.Q.items[0];
  h.node('in').value = c.PPMQ.maskAns(item.c.s, 60).join(' ');
  c.dCheck(); c.dCheck(); c.dGrade(1);
  assert.equal(c.Q.hit, 1); assert.equal(c.Q.i, 0);
  assert.equal(c.PPMQ.srsGet()[item.c.id + '|blank'].n, 0);
  assert.ok(!h.node('btns').innerHTML.includes('dGrade'));
  assert.ok(h.node('btns').innerHTML.includes('../c/W1.1.1/#'));
  c.dNext(); c.dNext(); assert.equal(c.Q.i, 1);
  h.node('in').value = c.PPMQ.maskAns(c.Q.items[1].c.s, 60).join(' ') + ' extra';
  c.dCheck(); assert.equal(c.Q.hit, 1);
});

test('recall grading counts success once and revealing a blank records a failed attempt', () => {
  const h = harness('drill'); setDrill(h, 'recall', 1); const c = h.context;
  c.dStart(); c.dReveal(); c.dGrade(1); c.dGrade(1);
  assert.equal(c.Q.hit, 1); assert.equal(c.Q.phase, 'complete');
  const h2 = harness('drill'); setDrill(h2, 'blank', 1);
  h2.context.dStart(); const id = h2.context.Q.items[0].c.id;
  h2.context.dReveal(); h2.context.dReveal(); h2.context.dGrade(1);
  assert.equal(h2.context.Q.hit, 0);
  assert.equal(h2.context.PPMQ.srsGet()[id + '|blank'].due, h2.context.PPMQ.today() + 1);
});

test('drill awaits major deep links and ignores responses from a previously selected subject', async () => {
  const h = harness('drill', '?subject=plan&major=선택항목&mode=quiz');
  const slow = deferred(); const c = h.context;
  c.PPMQ.loadQuiz = slug => slug === 'plan' ? slow.promise.then(() => ({ items: [quiz('PLAN')] })) : Promise.resolve({ items: [quiz('LAW')] });
  c.PPMQ.loadCards = slug => slug === 'plan' ? slow.promise.then(() => ({ cards: [{ ...card('P'), m: '선택항목' }] })) : Promise.resolve({ cards: [card('L')] });
  h.node('selMode').options = [{ value: 'quiz' }];
  await h.boot(); assert.equal(c.ready, false); assert.equal(h.node('start').disabled, true);
  slow.resolve(); await flush(); assert.equal(h.node('selMajor').value, '선택항목');
  const late = deferred(); c.PPMQ.loadQuiz = () => late.promise;
  const old = c.load(); h.node('selSubject').value = 'law';
  c.PPMQ.loadQuiz = async () => ({ items: [quiz('LAW')] }); await c.load();
  late.resolve({ items: [quiz('STALE')] }); await old;
  assert.equal(c.POOL.quiz[0].atom, 'LAW');
});

test('learning plan groups combine subjects and restrict quizzes by matching card atoms', async () => {
  const h = harness('drill', '?groups=W2.3.3,W3.1.1&day=5'); const c = h.context;
  c.PPMQ.loadCards = async slug => ({ cards: [card(slug, slug === 'plan' ? 'W2.3.3' : 'W3.1.1'), card('OUT', 'W1.9.9')] });
  c.PPMQ.loadQuiz = async slug => ({ items: [quiz(slug), quiz('OUT')] });
  await h.boot();
  assert.deepEqual(Array.from(c.POOL.quiz, x => x.atom).sort(), ['contract', 'plan']);
  assert.match(h.node('scope').innerHTML, /5일차/);
  assert.equal(h.node('scope').hidden, false);
  h.node('selSubject').value = 'law'; await c.clearScope();
  assert.equal(c.GROUPS.length, 0); assert.equal(h.node('scope').hidden, true);
});

test('CBT start cannot create duplicate timers and uses elapsed wall time on resume', async () => {
  const h = harness('cbt'); const c = h.context; const slow = deferred();
  h.node('selKind').value = 'subject'; h.node('selSubject').value = 'law';
  h.node('selTime').value = '1'; h.node('selCount').value = '10';
  c.PPMQ.loadQuiz = () => slow.promise;
  const p = c.cStart(); c.cStart(); assert.equal(h.node('start').disabled, true);
  slow.resolve({ items: Array.from({ length: 10 }, (_, i) => quiz('A' + i)) }); await p;
  assert.equal(h.intervals.size, 1); assert.equal(h.node('clock').textContent, '15:00');
  h.advance(61000); c.tick(); assert.equal(h.node('clock').textContent, '13:59');
  h.advance(900000); c.cPick(0, 0);
  assert.equal(c.E, null); assert.equal(h.intervals.size, 0);
  assert.match(h.node('result').innerHTML, /자동 제출/);
  assert.match(h.node('result').innerHTML, /내 답 없음/);
});

test('CBT handles failed loads, unanswered cancellation and arithmetic subject mean', async () => {
  const h = harness('cbt'); const c = h.context;
  h.node('selKind').value = 'real'; h.node('selTime').value = '0';
  c.PPMQ.loadQuiz = async () => { throw new Error('offline'); };
  await c.cStart(); assert.equal(c.starting, false); assert.equal(h.node('start').disabled, false);
  assert.match(h.node('stat').textContent, /불러오지 못했습니다/);
  c.PPMQ.loadQuiz = async slug => ({ items: Array.from({ length: slug === 'plan' ? 20 : 30 }, (_, i) => quiz(slug + i, slug)) });
  await c.cStart();
  h.setConfirm(false); c.cSubmit(); assert.ok(c.E);
  // law 100, plan 0, contract 100 => subject mean 66.7, not weighted 75.
  c.E.items.forEach((q, i) => { if (q.subject !== 'plan') c.cPick(i, 0); });
  h.setConfirm(true); c.cSubmit(); const html = h.node('result').innerHTML;
  assert.match(html, /66\.7점/); assert.match(html, /40점 미만/);
  const progress = h.getStored(); c.cSubmit(); assert.deepEqual(h.getStored(), progress);
});

test('legacy cards keep checked answers immutable and have no delayed advance callback', async () => {
  const h = harness(); const c = h.context;
  vm.runInContext(read('assets/cards.js'), c);
  h.node('selSubject').value = 'law'; h.node('selMajor').value = 'all'; h.node('selMode').value = 'blank';
  h.node('selCount').value = '1'; h.node('selImp').value = 'all';
  c.fetchImpl = async () => ({ ok: true, json: async () => ({ cards: [card('A')], n: 1 }) });
  c.ppmCardStart(); await flush();
  h.node('cIn').value = c.PPMQ.maskAns(card('A').s, 60).join(' ');
  c.ppmCardCheck(); c.ppmCardCheck(); c.ppmCardGrade(1);
  assert.equal(h.getStored()['A|blank'].n, 0);
  assert.ok(!h.node('cBtns').innerHTML.includes('ppmCardGrade'));
  assert.equal(h.timeouts.size, 0);
  c.ppmCardQuit(); c.ppmCardNext(); await flush();
});
