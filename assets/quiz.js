/* 외우기·모의시험 공용 엔진.
   문항은 quiz.<과목>.json(객관식), 카드는 cards.<과목>.json(빈칸·회상)에서 읽는다. */
(function () {
  "use strict";

  var SUBJECTS = [
    { s: "공공조달과 법제도 이해", slug: "law", exam: "필기", n: 30 },
    { s: "공공조달계획 수립 및 분석", slug: "plan", exam: "필기", n: 20 },
    { s: "공공계약관리", slug: "contract", exam: "필기", n: 30 },
    { s: "공공조달 관리실무", slug: "practice", exam: "실기", n: 0 }
  ];
  var STEPS = [1, 3, 7, 14, 30];
  var SRS = "ppm.srs.v1";
  var MARK = "①②③④⑤";
  var NUM = /[0-9０-９]/;
  var PART = /(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|부터|까지|에게|보다|이나|나|며|고|하여|하고|한다|된다|이다|있다|없다)$/;

  var QZ = {}, CD = {}, pending = {}, memory = {}, memoryOnly = false;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function norm(s) { return (s || "").replace(/[\s·,.\/()\[\]:;'"「」『』%％-]/g, "").toLowerCase(); }
  function today() { return Math.floor(Date.now() / 86400000); }
  function validProgress(o) {
    var clean = {};
    if (!o || typeof o !== "object" || Array.isArray(o)) return clean;
    Object.keys(o).forEach(function (k) {
      var st = o[k];
      if (!/\|(quiz|blank|recall)$/.test(k) || !st || !Number.isInteger(st.n) ||
          st.n < 0 || st.n >= STEPS.length || !Number.isFinite(st.due)) return;
      clean[k] = { n: st.n, due: st.due };
    });
    return clean;
  }
  function srsGet() {
    if (memoryOnly) return validProgress(memory);
    try { memory = validProgress(JSON.parse(localStorage.getItem(SRS) || "{}")); } catch (e) {}
    return validProgress(memory);
  }
  function srsPut(o) {
    memory = validProgress(o);
    try { localStorage.setItem(SRS, JSON.stringify(memory)); memoryOnly = false; return true; }
    catch (e) { memoryOnly = true; return false; }
  }
  function grade(id, mode, ok) {
    var o = srsGet(), k = id + "|" + mode, st = o[k] || { n: -1 };
    st.n = ok ? Math.min(st.n + 1, STEPS.length - 1) : 0;
    st.due = today() + STEPS[st.n];
    o[k] = st; return srsPut(o);
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function weight(t0) {
    var t = t0.replace(/[(),.·「」『』"'\[\]%]/g, "");
    if (!t || t.length <= 1) return 0;
    var w = t.length;
    if (NUM.test(t)) w += 12;
    if (/[%％]|이상|이하|초과|미만|이내/.test(t0)) w += 8;
    if (/조|항|호|법|령|규칙|예규/.test(t)) w += 4;
    return w;
  }
  function cands(parts) {
    var o = [];
    for (var i = 0; i < parts.length; i++) {
      if (/^\s+$/.test(parts[i])) continue;
      var w = weight(parts[i]);
      if (w > 0) o.push({ i: i, w: w, t: parts[i] });
    }
    return o.sort(function (a, b) { return b.w - a.w || a.i - b.i; });
  }
  function maskHtml(s, r) {
    var p = (s || "").split(/(\s+)/), c = cands(p), n = Math.round(c.length * r / 100), h = {};
    for (var k = 0; k < n; k++) h[c[k].i] = 1;
    var out = "";
    for (var i = 0; i < p.length; i++) {
      if (h[i]) {
        var core = p[i].replace(PART, ""), tail = p[i].slice(core.length);
        out += '<span class="blank">' + "　".repeat(Math.max(1, Math.min(4, Math.ceil(core.length / 2)))) + "</span>" + esc(tail);
      } else out += esc(p[i]);
    }
    return out;
  }
  function maskAns(s, r) {
    var p = (s || "").split(/(\s+)/), c = cands(p), n = Math.round(c.length * r / 100);
    return c.slice(0, n).sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.t.replace(PART, ""); });
  }

  function loadData(type, slug, cache) {
    if (!SUBJECTS.some(function (s) { return s.slug === slug; }) && !(type === "cards" && slug === "etc")) {
      return Promise.reject(new Error("알 수 없는 과목입니다."));
    }
    if (cache[slug]) return Promise.resolve(cache[slug]);
    var key = type + "." + slug;
    if (pending[key]) return pending[key];
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer;
    var request = fetch("../data/" + key + ".json", controller ? { signal: controller.signal } : {}).then(function (r) {
      if (!r.ok) throw new Error("데이터 응답 오류: " + r.status);
      return r.json();
    }).then(function (j) {
      var rows = j && j[type === "quiz" ? "items" : "cards"];
      if (!Array.isArray(rows) || !rows.every(function (x) {
        if (!x || typeof x !== "object") return false;
        if (type === "cards") return typeof x.id === "string" && typeof x.s === "string" && typeof x.t === "string";
        return typeof x.atom === "string" && typeof x.subject === "string" &&
          Array.isArray(x.choices) && x.choices.length >= 2 && x.choices.length <= MARK.length &&
          x.choices.every(function (c) { return typeof c === "string"; }) &&
          Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.choices.length;
      })) throw new Error("데이터 형식이 올바르지 않습니다.");
      return j;
    });
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error("데이터 요청 시간이 초과되었습니다."));
      }, 15000);
    });
    pending[key] = Promise.race([request, timeout]).then(function (j) {
      clearTimeout(timer); delete pending[key]; cache[slug] = j; return j;
    }, function (err) {
      clearTimeout(timer); delete pending[key]; throw err;
    });
    return pending[key];
  }
  function loadQuiz(slug) { return loadData("quiz", slug, QZ); }
  function loadCards(slug) { return loadData("cards", slug, CD); }

  window.PPMQ = {
    SUBJECTS: SUBJECTS, MARK: MARK, esc: esc, norm: norm, shuffle: shuffle,
    maskHtml: maskHtml, maskAns: maskAns, grade: grade, srsGet: srsGet, srsPut: srsPut,
    today: today, loadQuiz: loadQuiz, loadCards: loadCards,
    storageOk: function () { return !memoryOnly; }
  };
})();
