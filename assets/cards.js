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

  var DATA = {}, pending = {}, Q = null, version = 0, starting = false, memory = {}, memoryOnly = false;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function norm(s) {
    // Preserve decimal points, signs, fractions and units: 1.5, 15, 5% and 5 differ.
    return String(s == null ? "" : s).normalize("NFKC")
      .replace(/[\s()\[\]'"「」『』]/g, "").replace(/\.$/, "").toLowerCase();
  }

  function cleanProgress(o) {
    var clean = {};
    if (!o || typeof o !== "object" || Array.isArray(o)) return clean;
    Object.keys(o).forEach(function (k) {
      var st = o[k];
      if (!/^.+\|(quiz|blank|recall)$/.test(k) || !st || !Number.isInteger(st.n) ||
          st.n < 0 || st.n >= STEPS.length || !Number.isInteger(st.due) || st.due < 0) return;
      clean[k] = { n: st.n, due: st.due };
      if (typeof st.wrong === "boolean") clean[k].wrong = st.wrong;
      if (Number.isInteger(st.last) && st.last >= 0) clean[k].last = st.last;
    });
    return clean;
  }
  function srsLoad() {
    if (memoryOnly) return cleanProgress(memory);
    try { memory = cleanProgress(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { memoryOnly = true; }
    return cleanProgress(memory);
  }
  function srsSave(o) {
    memory = cleanProgress(o);
    try { localStorage.setItem(KEY, JSON.stringify(memory)); memoryOnly = false; return true; }
    catch (e) { memoryOnly = true; return false; }
  }
  function today() { return Math.floor((Date.now() + 9 * 3600000) / 86400000); }

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
    if (!SUBJECTS.some(function (s) { return s.slug === slug; })) return Promise.reject(new Error("알 수 없는 과목"));
    if (DATA[slug]) return Promise.resolve(DATA[slug]);
    if (pending[slug]) return pending[slug];
    var controller = typeof AbortController === "function" ? new AbortController() : null, timer;
    var request = fetch("../data/cards." + slug + ".json", controller ? { signal: controller.signal } : {}).then(function (r) {
      if (!r.ok) throw new Error("카드 응답 오류");
      return r.json();
    }).then(function (j) {
      if (!j || !Array.isArray(j.cards) || !j.cards.every(function (c) {
        return c && typeof c.id === "string" && typeof c.s === "string";
      })) throw new Error("카드 형식 오류");
      return j;
    });
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error("카드 요청 시간 초과"));
      }, 15000);
    });
    pending[slug] = Promise.race([request, timeout]).then(function (j) {
      clearTimeout(timer); delete pending[slug]; DATA[slug] = j; return j;
    }, function (err) { clearTimeout(timer); delete pending[slug]; throw err; });
    return pending[slug];
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
    var current = ++version;
    var slug = document.getElementById("selSubject").value;
    var sel = document.getElementById("selMajor");
    sel.innerHTML = '<option value="all">전부</option>';
    document.getElementById("cardStat").textContent = "불러오는 중…";
    fetchSubject(slug).then(function (j) {
      if (current !== version) return;
      var seen = [];
      j.cards.forEach(function (c) { if (seen.indexOf(c.m) < 0) seen.push(c.m); });
      seen.forEach(function (m) {
        var o = document.createElement("option");
        o.value = m; o.textContent = m; sel.appendChild(o);
      });
      var srs = srsLoad(), done = 0;
      j.cards.forEach(function (c) { if (srs[c.id + "|blank"] || srs[c.id + "|recall"]) done++; });
      document.getElementById("cardStat").textContent =
        j.cards.length + "장 가운데 " + done + "장을 한 번 이상 풀었습니다." +
        (memoryOnly ? " 진도는 현재 페이지에서만 유지됩니다." : "");
    }).catch(function () {
      if (current !== version) return;
      document.getElementById("cardStat").textContent = "카드 데이터를 불러오지 못했습니다.";
    });
  }

  window.ppmCardReset = function () {
    if (!confirm("이 브라우저의 모든 학습 진도를 초기화할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    if (!srsSave({})) {
      document.getElementById("cardStat").textContent = "현재 페이지의 진도만 초기화했습니다. 브라우저 저장소에는 반영하지 못했습니다.";
      return;
    }
    fillMajors();
  };

  window.ppmCardStart = function () {
    if (starting || Q) return;
    starting = true;
    var current = version;
    var slug = document.getElementById("selSubject").value;
    var major = document.getElementById("selMajor").value;
    var mode = document.getElementById("selMode").value;
    var count = +document.getElementById("selCount").value;
    var imp = document.getElementById("selImp").value;
    fetchSubject(slug).then(function (j) {
      if (current !== version) return;
      var srs = srsLoad(), t = today();
      var pool = j.cards.filter(function (c) {
        if (major !== "all" && c.m !== major) return false;
        if (imp === "높음" && c.i !== "높음") return false;
        if (imp === "높음중간" && c.i === "낮음") return false;
        return norm(c.s).length >= 12 && (mode === "recall" || maskAnswers(c.s, 60).length > 0);
      });
      // 복습기한이 지난 것 → 아직 안 본 것 → 나머지
      function due(c, m) {
        var st = srs[c.id + "|" + m];
        if (!st) return 1;
        return st.due <= t ? 0 : 2;
      }
      var reviewEl = document.getElementById("selReview"), review = reviewEl ? reviewEl.value : "all";
      var items = pool.map(function (c) {
        // Choose the due mode for each card, then rank that actual mode.
        var m = mode === "mix" ? (due(c, "blank") <= due(c, "recall") ? "blank" : "recall") : mode;
        if (mode === "mix" && review === "wrong") {
          if (srs[c.id + "|blank"] && srs[c.id + "|blank"].wrong) m = "blank";
          else if (srs[c.id + "|recall"] && srs[c.id + "|recall"].wrong) m = "recall";
        }
        return { c: c, mode: m };
      }).filter(function (it) {
        var st = srs[it.c.id + "|" + it.mode];
        return review === "all" || (review === "wrong" ? !!st && st.wrong === true : !st || st.due <= t);
      }).sort(function (a, b) { return due(a.c, a.mode) - due(b.c, b.mode); }).slice(0, count);
      if (!items.length) { alert("조건에 맞는 카드가 없습니다."); return; }
      Q = { items: items, i: 0, hit: 0, ratio: 60, phase: "question", wrong: [] };
      document.getElementById("cardSetup").hidden = true;
      var run = document.getElementById("cardRun");
      run.hidden = false;
      paint();
    }).catch(function () {
      if (current !== version) return;
      document.getElementById("cardStat").textContent = "카드를 불러오지 못했습니다. 연결을 확인하고 다시 시작해 주세요.";
    }).then(function () { starting = false; });
  };

  function grade(id, mode, ok) {
    if (typeof id !== "string" || !id || !/^(quiz|blank|recall)$/.test(mode)) return false;
    var o = srsLoad(), k = id + "|" + mode, st = o[k], t = today();
    if (!st) st = { n: -1, due: t };
    // Early/same-day practice must not turn one recall into several spaced reviews.
    if (!ok) { st.n = 0; st.due = t + STEPS[0]; }
    else if (st.n < 0 || (st.last !== t && st.due <= t)) {
      st.n = Math.min(st.n + 1, STEPS.length - 1);
      st.due = t + STEPS[st.n];
    }
    st.wrong = !ok; st.last = t;
    o[k] = st; return srsSave(o);
  }

  function paint() {
    Q.phase = "question";
    var run = document.getElementById("cardRun");
    var it = Q.items[Q.i], c = it.c;
    var pct = Math.round(Q.i / Q.items.length * 100);
    var body = it.mode === "blank"
      ? '<div class="modal-s" id="cS">' + maskHtml(c.s, Q.ratio) + "</div>" +
        '<input type="text" id="cIn" aria-label="빈칸 정답" autocomplete="off" placeholder="가려진 말을 순서대로, 빈칸으로 띄어 쓰세요"/>'
      : '<div class="modal-s" id="cS"><i>답을 떠올린 뒤 확인을 누르세요.</i></div>';
    run.innerHTML =
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="modal-top"><span>' + (Q.i + 1) + " / " + Q.items.length + " · " +
      (it.mode === "blank" ? "빈칸" : "직접회상") + '</span><span>' + esc(c.y) +
      (c.i === "높음" ? " · 중요" : "") + " · " + esc(c.id) + "</span></div>" +
      '<div class="modal-q">' + esc(c.t) + "</div>" +
      body +
      '<div class="modal-fb" id="cFb" role="status"></div>' +
      '<div class="modal-btns" id="cBtns">' +
      (it.mode === "blank"
        ? '<button class="btn" onclick="ppmCardCheck()">확인</button>' +
          '<button class="btn ghost" onclick="ppmCardReveal()">정답 보기</button>'
        : '<button class="btn" onclick="ppmCardReveal()">확인</button>') +
      '<button class="btn ghost" onclick="ppmCardQuit()">그만</button>' +
      "</div>" +
      (c.r ? '<div class="modal-src">' + esc(c.r) + " · " + esc(c.d) + "</div>" : "");
    var inp = document.getElementById("cIn");
    if (inp) { inp.focus(); inp.onkeydown = function (ev) {
      if (ev.key === "Enter" && !ev.isComposing && !ev.repeat) { ev.preventDefault(); window.ppmCardCheck(); }
    }; }
  }

  function afterReveal(it, c) {
    document.getElementById("cS").innerHTML = esc(c.s) +
      (c.c && c.c !== "없음" ? '<div class="atom-cond"><b>조건·예외</b> ' + esc(c.c) + "</div>" : "") +
      (c.x && c.x !== "없음" ? '<div class="atom-conf"><b>혼동</b> ' + esc(c.x) + "</div>" : "");
    document.getElementById("cBtns").innerHTML =
      (Q.phase === "answered" ? '<button class="btn" onclick="ppmCardNext()">다음</button>' :
        '<button class="btn" onclick="ppmCardGrade(1)">알았음</button><button class="btn ghost" onclick="ppmCardGrade(0)">몰랐음</button>') +
      '<button class="btn ghost" onclick="ppmCardQuit()">그만</button>';
    var inp = document.getElementById("cIn"); if (inp) inp.disabled = true;
    document.getElementById("cBtns").querySelector("button").focus();
  }

  window.ppmCardCheck = function () {
    if (!Q || Q.phase !== "question" || Q.items[Q.i].mode !== "blank") return;
    var it = Q.items[Q.i], c = it.c;
    var want = maskAnswers(c.s, Q.ratio);
    var got = (document.getElementById("cIn").value || "").split(/\s+/).filter(Boolean);
    var ok = 0;
    for (var i = 0; i < want.length; i++) if (got[i] && norm(got[i]) === norm(want[i])) ok++;
    var fb = document.getElementById("cFb");
    var all = want.length > 0 && ok === want.length && got.length === want.length;
    Q.phase = "answered";
    fb.className = "modal-fb " + (all ? "ok" : "no");
    fb.textContent = all ? "맞았습니다 (" + ok + "/" + want.length + ")"
      : ok + " / " + want.length + " 맞음. 정답: " + want.join(" , ");
    afterReveal(it, c);
    grade(c.id, it.mode, all);
    if (all) Q.hit++; else Q.wrong.push(it);
  };

  window.ppmCardReveal = function () {
    if (!Q || Q.phase !== "question") return;
    var it = Q.items[Q.i], c = it.c;
    Q.phase = it.mode === "blank" ? "answered" : "revealed";
    if (it.mode === "blank") {
      var fb = document.getElementById("cFb");
      fb.className = "modal-fb no";
      fb.textContent = "정답: " + maskAnswers(c.s, Q.ratio).join(" , ");
      grade(c.id, it.mode, false);
      Q.wrong.push(it);
    }
    afterReveal(it, c);
  };

  window.ppmCardGrade = function (ok) {
    if (!Q || Q.phase !== "revealed") return;
    var it = Q.items[Q.i];
    Q.phase = "answered";
    grade(it.c.id, it.mode, !!ok);
    if (ok) Q.hit++; else Q.wrong.push(it);
    window.ppmCardNext();
  };

  window.ppmCardNext = function () {
    if (!Q || Q.phase !== "answered") return;
    Q.i++;
    if (Q.i >= Q.items.length) {
      Q.phase = "complete";
      document.getElementById("cardRun").innerHTML =
        '<div class="modal-q">' + Q.items.length + "장을 끝냈습니다</div>" +
        '<p class="modal-s">정답 또는 자기평가 회상 성공 ' + Q.hit + "장. 시험 점수가 아닙니다. 오답은 지금 다시 풀거나 내일 복습할 수 있습니다.</p>" +
        (memoryOnly ? '<p class="note">진도는 현재 페이지에서만 유지됩니다. 새로고침하거나 페이지를 떠나면 사라집니다.</p>' : "") +
        '<div class="modal-btns">' + (Q.wrong.length ? '<button class="btn" onclick="ppmCardRetryWrong()">오답 다시 풀기</button>' : '') + '<button class="btn ghost" onclick="ppmCardQuit()">돌아가기</button></div>';
      return;
    }
    paint();
  };

  window.ppmCardRetryWrong = function () {
    if (!Q || Q.phase !== "complete" || !Q.wrong.length) return;
    Q = { items: Q.wrong.slice(), i: 0, hit: 0, ratio: 60, phase: "question", wrong: [] };
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
