(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JodalStory = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var STATS = ['money', 'trust', 'quality', 'time'];
  var VERSION = '20260916-1';
  function error(message) { throw new Error(message); }
  function text(value) { return typeof value === 'string' && value.trim().length > 0; }
  function eligible(choice, stats, flags) {
    var r = choice.requires || {};
    return (r.allFlags || []).every(function (f) { return flags.has(f); }) &&
      (r.noFlags || []).every(function (f) { return !flags.has(f); }) &&
      Object.keys(r.min || {}).every(function (key) { return stats[key] >= r.min[key]; });
  }
  function validate(c) {
    if (!c || !/^(supplier|manager)$/.test(c.id) || !text(c.title) || !Array.isArray(c.nodes) || !Array.isArray(c.chapters)) error('이야기 형식을 확인하지 못했습니다.');
    var ids = new Set(), chapters = new Set(c.chapters.map(function (x) { return x.id; }));
    c.nodes.forEach(function (n) {
      if (!text(n.id) || ids.has(n.id) || !text(n.title) || !chapters.has(n.chapter) || !Array.isArray(n.text) || !n.text.every(text) || !Array.isArray(n.choices)) error('장면 정보가 올바르지 않습니다.');
      ids.add(n.id);
      if (n.ending ? n.choices.length !== 0 : n.choices.length < 2) error('장면의 선택지를 확인하지 못했습니다.');
      var choices = new Set();
      n.choices.forEach(function (a) {
        if (!text(a.id) || choices.has(a.id) || !text(a.label) || !text(a.feedback) || !text(a.next)) error('선택 정보가 올바르지 않습니다.');
        choices.add(a.id);
        Object.keys(a.delta || {}).forEach(function (k) { if (STATS.indexOf(k) < 0 || !Number.isFinite(a.delta[k]) || Math.abs(a.delta[k]) > 100) error('자원 변화가 올바르지 않습니다.'); });
        var r = a.requires || {};
        ['allFlags', 'noFlags'].forEach(function (k) { if (r[k] && (!Array.isArray(r[k]) || !r[k].every(text))) error('분기 조건 오류'); });
        if (a.setFlags && (!Array.isArray(a.setFlags) || !a.setFlags.every(text))) error('분기 기록 오류');
        Object.keys(r.min || {}).forEach(function (k) { if (STATS.indexOf(k) < 0 || !Number.isFinite(r.min[k])) error('분기 자원 오류'); });
      });
    });
    if (!ids.has(c.start)) error('첫 장면을 찾지 못했습니다.');
    c.nodes.forEach(function (n) { n.choices.forEach(function (a) { if (!ids.has(a.next)) error('다음 장면을 찾지 못했습니다.'); }); });
    return c;
  }
  function create(c) { return { version: 1, revision: VERSION, role: c.id, history: [], pending: false }; }
  function replay(c, s) {
    if (!s || s.version !== 1 || s.revision !== VERSION || s.role !== c.id || !Array.isArray(s.history) || s.history.length > 160 || typeof s.pending !== 'boolean' || (s.pending && !s.history.length)) error('저장된 이야기를 확인하지 못했습니다.');
    var by = new Map(c.nodes.map(function (n) { return [n.id, n]; })), node = by.get(c.start);
    var stats = { money: 60, trust: 60, quality: 60, time: 60 }, flags = new Set(), visited = [node.id], last = null, steps = [];
    s.history.forEach(function (entry) {
      if (!entry || entry.nodeId !== node.id || node.ending) error('저장된 선택 경로가 달라졌습니다.');
      var choice = node.choices.find(function (a) { return a.id === entry.choiceId; });
      if (!choice || !eligible(choice, stats, flags)) error('저장된 선택 조건을 확인하지 못했습니다.');
      var before = Object.assign({}, stats);
      STATS.forEach(function (k) { stats[k] = Math.max(0, Math.min(100, stats[k] + ((choice.delta || {})[k] || 0))); });
      (choice.setFlags || []).forEach(function (f) { flags.add(f); });
      last = { node: node, choice: choice, before: before, after: Object.assign({}, stats) };
      steps.push(last); node = by.get(choice.next); visited.push(node.id);
    });
    if (!node.ending && !node.choices.some(function (a) { return eligible(a, stats, flags); })) error('이 경로에서 가능한 선택이 없습니다.');
    return { node: node, stats: stats, flags: flags, visited: visited, last: last, steps: steps };
  }
  function choose(c, s, choiceId) {
    if (s.pending) error('선택의 결과를 먼저 확인하세요.');
    var v = replay(c, s), a = v.node.choices.find(function (x) { return x.id === choiceId; });
    if (!a || !eligible(a, v.stats, v.flags)) error('지금 선택할 수 없는 행동입니다.');
    var next = Object.assign({}, s, { history: s.history.concat([{ nodeId: v.node.id, choiceId: a.id }]), pending: true });
    replay(c, next); return next;
  }
  function advance(c, s) { replay(c, s); if (!s.pending) error('확인할 선택 결과가 없습니다.'); return Object.assign({}, s, { pending: false }); }
  function rewind(c, s, index) {
    replay(c, s); if (!Number.isInteger(index) || index < 0 || index >= s.history.length) error('돌아갈 분기점을 찾지 못했습니다.');
    var next = Object.assign({}, s, { history: s.history.slice(0, index), pending: false }); replay(c, next); return next;
  }
  return { STATS: STATS, VERSION: VERSION, validate: validate, create: create, replay: replay, choose: choose, advance: advance, rewind: rewind, eligible: eligible };
}));
