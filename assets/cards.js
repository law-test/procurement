/* 암기카드 — 과목별 카드 데이터를 읽어 빈칸·직접회상으로 묻는다.
   복습 상태는 atom별·방식별로 따로 저장한다. 판별 하나 맞혔다고 외운 것으로 처리하지 않는다. */
(function () {
  "use strict";

  var SUBJECTS = [
    { s: "공공조달과 법제도 이해", slug: "law", exam: "필기" },
    { s: "공공조달계획 수립 및 분석", slug: "plan", exam: "필기" },
    { s: "공공계약관리", slug: "contract", exam: "필기" },
    { s: "공공조달 관리실무", slug: "practice", exam: "실기" },
    { s: "기준 미연결", slug: "etc", exam: "실기 중심" }
  ];
  var STEPS = [1, 3, 7, 14, 30];      // 복습 간격(일). 운영 가안이며 오답에 따라 줄인다.
  var KEY = "ppm.srs.v1";

  var NUM = /[0-9０-９]/;
  var PARTICLE = /(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|부터|까지|에게|보다|이나|나|며|고|하여|하고|한다|된다|이다|있다|없다)$/;

  var DATA = {}, Q = null;

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function norm(s) { return (s || "").replace(/[\s·,.\/()\[\]:;'"「」『』%％-]/g, "").toLowerCase(); }

  function srsLoad() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  }
  function srsSave(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function today() { return Math.floor(Date.now() / 86400000); }

  function weight(tok) {
    var t = tok.replace(/[(),.·「」『』"'\[\]%]/g, "");
    if (!t || t.length <= 1) return 0;
    var w = t.length;
    if (NUM.test(t)) w += 12;
    if (/[%％]|이상|이하|초과|미만|이내/.test(tok)) w += 8;
    if (/조|항|호|법|령|규칙|예규/.test(t)) w += 4;
    return w;
  }
  function cand(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (/^\s+$/.test(parts[i])) continue;
      var w = weight(parts[i]);
      if (w > 0) out.push({ i: i, w: w, t: parts[i] });
    }
    out.sort(function (a, b) { return b.w - a.w || a.i - b.i; });
    return out;
  }
  function maskHtml(s, ratio) {
    var parts = (s || "").split(/(\s+)/), c = cand(parts);
    var n = Math.round(c.length * ratio / 100), hide = {};
    for (var k = 0; k < n; k++) hide[c[k].i] = true;
    var out = "";
    for (var i = 0; i < parts.length; i++) {
      if (hide[i]) {
        var core = parts[i].replace(PARTICLE, ""), tail = parts[i].slice(core.length);
        out += '<span class="blank">' + "　".repeat(Math.max(1, Math.min(4, Math.ceil(core.length / 2)))) + "</span>" + esc(tail);
      } else out += esc(parts[i]);
    }
    return out;
  }
  function maskAnswers(s, ratio) {
    var parts = (s || "").split(/(\s+)/), c = cand(parts);
    var n = Math.round(c.length * ratio / 100);
    return c.slice(0, n).sort(function (a, b) { return a.i - b.i; })
      .map(function (x) { return x.t.replace(PARTICLE, ""); });
  }

  function fetchSubject(slug) {
    if (DATA[slug]) return Promise.resolve(DATA[slug]);
    return fetch("../data/cards." + slug + ".json").then(function (r) { return r.json(); })
      .then(function (j) { DATA[slug] = j; return j; });
  }

  function fillSubjects() {
    var sel = document.getElementById("selSubject");
    sel.innerHTML = SUBJECTS.map(function (x) {
      return '<option value="' + x.slug + '">' + esc(x.s) + " (" + x.exam + ")</option>";
    }).join("");
    sel.onchange = fillMajors;
    fillMajors();
  }

  function fillMajors() {
    var slug = document.getElementById("selSubject").value;
    var sel = document.getElementById("selMajor");
    sel.innerHTML = '<option value="all">전부</option>';
    document.getElementById("cardStat").textContent = "불러오는 중…";
    fetchSubject(slug).then(function (j) {
      var seen = [];
      j.cards.forEach(function (c) { if (seen.indexOf(c.m) < 0) seen.push(c.m); });
      seen.forEach(function (m) {
        var o = document.createElement("option");
        o.value = m; o.textContent = m; sel.appendChild(o);
      });
      var srs = srsLoad(), done = 0;
      j.cards.forEach(function (c) { if (srs[c.id + "|blank"] || srs[c.id + "|recall"]) done++; });
      document.getElementById("cardStat").textContent =
        j.n + "장 가운데 " + done + "장을 한 번 이상 풀었습니다.";
    }).catch(function () {
      document.getElementById("cardStat").textContent = "카드 데이터를 불러오지 못했습니다.";
    });
  }

  window.ppmCardReset = function () {
    srsSave({});
    fillMajors();
  };

  window.ppmCardStart = function () {
    var slug = document.getElementById("selSubject").value;
    var major = document.getElementById("selMajor").value;
    var mode = document.getElementById("selMode").value;
    var count = +document.getElementById("selCount").value;
    var imp = document.getElementById("selImp").value;
    fetchSubject(slug).then(function (j) {
      var srs = srsLoad(), t = today();
      var pool = j.cards.filter(function (c) {
        if (major !== "all" && c.m !== major) return false;
        if (imp === "높음" && c.i !== "높음") return false;
        if (imp === "높음중간" && c.i === "낮음") return false;
        return norm(c.s).length >= 12;
      });
      // 복습기한이 지난 것 → 아직 안 본 것 → 나머지
      function due(c, m) {
        var st = srs[c.id + "|" + m];
        if (!st) return -1;                 // 새 카드
        return st.due - t;
      }
      var m0 = mode === "mix" ? "blank" : mode;
      pool.sort(function (a, b) {
        var da = due(a, m0), db = due(b, m0);
        var ka = da < 0 ? (da === -1 ? 1 : 0) : 2;   // 0 기한도래 1 새카드 2 나머지
        var kb = db < 0 ? (db === -1 ? 1 : 0) : 2;
        if (ka !== kb) return ka - kb;
        if (a.i !== b.i) return (a.i === "높음" ? -1 : b.i === "높음" ? 1 : 0);
        return 0;
      });
      var items = pool.slice(0, count).map(function (c, k) {
        return { c: c, mode: mode === "mix" ? (k % 2 ? "recall" : "blank") : mode };
      });
      if (!items.length) { alert("조건에 맞는 카드가 없습니다."); return; }
      Q = { items: items, i: 0, hit: 0, ratio: 60 };
      document.getElementById("cardSetup").hidden = true;
      var run = document.getElementById("cardRun");
      run.hidden = false;
      paint();
    });
  };

  function grade(id, mode, ok) {
    var srs = srsLoad(), k = id + "|" + mode, st = srs[k] || { n: 0 };
    st.n = ok ? Math.min(st.n + 1, STEPS.length - 1) : 0;
    st.due = today() + STEPS[st.n];
    srs[k] = st;
    srsSave(srs);
  }

  function paint() {
    var run = document.getElementById("cardRun");
    var it = Q.items[Q.i], c = it.c;
    var pct = Math.round(Q.i / Q.items.length * 100);
    var body = it.mode === "blank"
      ? '<div class="modal-s" id="cS">' + maskHtml(c.s, Q.ratio) + "</div>" +
        '<input type="text" id="cIn" autocomplete="off" placeholder="가려진 말을 순서대로, 빈칸으로 띄어 쓰세요"/>'
      : '<div class="modal-s" id="cS"><i>답을 떠올린 뒤 확인을 누르세요.</i></div>';
    run.innerHTML =
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="modal-top"><span>' + (Q.i + 1) + " / " + Q.items.length + " · " +
      (it.mode === "blank" ? "빈칸" : "직접회상") + '</span><span>' + esc(c.y) +
      (c.i === "높음" ? " · 중요" : "") + " · " + esc(c.id) + "</span></div>" +
      '<div class="modal-q">' + esc(c.t) + "</div>" +
      body +
      '<div class="modal-fb" id="cFb"></div>' +
      '<div class="modal-btns" id="cBtns">' +
      (it.mode === "blank"
        ? '<button class="btn" onclick="ppmCardCheck()">확인</button>' +
          '<button class="btn ghost" onclick="ppmCardReveal()">정답 보기</button>'
        : '<button class="btn" onclick="ppmCardReveal()">확인</button>') +
      '<button class="btn ghost" onclick="ppmCardQuit()">그만</button>' +
      "</div>" +
      (c.r ? '<div class="modal-src">' + esc(c.r) + " · " + esc(c.d) + "</div>" : "");
    var inp = document.getElementById("cIn");
    if (inp) { inp.focus(); inp.onkeydown = function (ev) { if (ev.key === "Enter") window.ppmCardCheck(); }; }
  }

  function afterReveal(it, c) {
    document.getElementById("cS").innerHTML = esc(c.s) +
      (c.c && c.c !== "없음" ? '<div class="atom-cond"><b>조건·예외</b> ' + esc(c.c) + "</div>" : "") +
      (c.x && c.x !== "없음" ? '<div class="atom-conf"><b>혼동</b> ' + esc(c.x) + "</div>" : "");
    document.getElementById("cBtns").innerHTML =
      '<button class="btn" onclick="ppmCardGrade(1)">알았음</button>' +
      '<button class="btn ghost" onclick="ppmCardGrade(0)">몰랐음</button>' +
      '<button class="btn ghost" onclick="ppmCardQuit()">그만</button>';
  }

  window.ppmCardCheck = function () {
    var it = Q.items[Q.i], c = it.c;
    var want = maskAnswers(c.s, Q.ratio);
    var got = (document.getElementById("cIn").value || "").split(/\s+/).filter(Boolean);
    var ok = 0;
    for (var i = 0; i < want.length; i++) if (got[i] && norm(got[i]) === norm(want[i])) ok++;
    var fb = document.getElementById("cFb");
    var all = ok === want.length && want.length;
    fb.className = "modal-fb " + (all ? "ok" : "no");
    fb.textContent = all ? "맞았습니다 (" + ok + "/" + want.length + ")"
      : ok + " / " + want.length + " 맞음. 정답: " + want.join(" , ");
    afterReveal(it, c);
    if (all) { Q.hit++; grade(c.id, it.mode, true); setTimeout(window.ppmCardNext, 800); }
  };

  window.ppmCardReveal = function () {
    var it = Q.items[Q.i], c = it.c;
    if (it.mode === "blank") {
      var fb = document.getElementById("cFb");
      fb.className = "modal-fb no";
      fb.textContent = "정답: " + maskAnswers(c.s, Q.ratio).join(" , ");
    }
    afterReveal(it, c);
  };

  window.ppmCardGrade = function (ok) {
    var it = Q.items[Q.i];
    grade(it.c.id, it.mode, !!ok);
    if (ok) Q.hit++;
    window.ppmCardNext();
  };

  window.ppmCardNext = function () {
    Q.i++;
    if (Q.i >= Q.items.length) {
      document.getElementById("cardRun").innerHTML =
        '<div class="modal-q">' + Q.items.length + "장을 끝냈습니다</div>" +
        '<p class="modal-s">한 번에 맞힌 것 ' + Q.hit + "장. 틀린 카드는 내일 다시 나옵니다.</p>" +
        '<div class="modal-btns"><button class="btn" onclick="ppmCardQuit()">돌아가기</button></div>';
      return;
    }
    paint();
  };

  window.ppmCardQuit = function () {
    Q = null;
    document.getElementById("cardRun").hidden = true;
    document.getElementById("cardSetup").hidden = false;
    fillMajors();
  };

  document.addEventListener("DOMContentLoaded", fillSubjects);
})();
