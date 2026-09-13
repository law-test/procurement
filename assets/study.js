/* 교재 페이지의 빈칸 가리기와 절 단위 드릴.
   원리: 문장을 공백으로 쪼개고, 시험에서 갈리는 토막(숫자·비율·기간·긴 명사)부터 가린다. */
(function () {
  "use strict";

  var NUM = /[0-9０-９]/;
  var PARTICLE = /(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|부터|까지|에게|보다|이나|나|며|고|하여|하고|한다|된다|이다|있다|없다)$/;

  function weight(tok) {
    var t = tok.replace(/[(),.·「」『』"'\[\]%]/g, "");
    if (!t) return 0;
    var w = t.length;
    if (NUM.test(t)) w += 12;                    // 숫자·요율·기간이 가장 잘 틀린다
    if (/[%％]|이상|이하|초과|미만|이내|까지/.test(tok)) w += 8;
    if (/조|항|호|법|령|규칙|예규/.test(t)) w += 4; // 근거 조문
    if (t.length <= 1) w = 0;
    return w;
  }

  function tokenize(s) {
    return (s || "").split(/(\s+)/);
  }

  function maskable(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (/^\s+$/.test(parts[i])) continue;
      var w = weight(parts[i]);
      if (w > 0) out.push({ i: i, w: w, t: parts[i] });
    }
    out.sort(function (a, b) { return b.w - a.w || a.i - b.i; });
    return out;
  }

  function render(sentence, ratio, revealSet) {
    var parts = tokenize(sentence);
    var cand = maskable(parts);
    var n = Math.round(cand.length * (ratio / 100));
    var hide = {};
    for (var k = 0; k < n; k++) hide[cand[k].i] = true;
    var html = "";
    for (var i = 0; i < parts.length; i++) {
      if (hide[i] && !(revealSet && revealSet[i])) {
        var core = parts[i].replace(PARTICLE, "");
        var tail = parts[i].slice(core.length);
        html += '<span class="blank">' + "　".repeat(Math.max(1, Math.min(4, Math.ceil(core.length / 2)))) + "</span>" + esc(tail);
      } else {
        html += esc(parts[i]);
      }
    }
    return html;
  }

  function esc(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function answers(sentence, ratio) {
    var parts = tokenize(sentence);
    var cand = maskable(parts);
    var n = Math.round(cand.length * (ratio / 100));
    return cand.slice(0, n).sort(function (a, b) { return a.i - b.i; })
      .map(function (c) { return c.t.replace(PARTICLE, ""); });
  }

  function norm(s) {
    return (s || "").replace(/[\s·,.\/()\[\]:;'"「」『』%％-]/g, "").toLowerCase();
  }

  /* ---- 페이지 전체 가리기 ---- */
  window.ppmGauge = function (v) {
    var g = document.getElementById("ppmGaugeV");
    if (g) g.textContent = v;
    var list = document.querySelectorAll(".atom-body");
    for (var i = 0; i < list.length; i++) {
      var src = list[i].getAttribute("data-drill") || "";
      list[i].innerHTML = +v === 0 ? esc(src) : render(src, +v);
    }
  };

  /* ---- 절 단위 드릴 ---- */
  var D = null;

  window.ppmDrillStart = function () {
    var nodes = document.querySelectorAll(".atom");
    var items = [];
    for (var i = 0; i < nodes.length; i++) {
      var body = nodes[i].querySelector(".atom-body");
      var h = nodes[i].querySelector(".atom-h");
      var src = nodes[i].querySelector(".atom-src");
      if (!body) continue;
      var s = body.getAttribute("data-drill") || "";
      if (norm(s).length < 12) continue;
      items.push({
        id: nodes[i].getAttribute("data-atom") || "",
        title: (h ? h.textContent : "").replace(/^\d+/, "").replace(/(개념|구별|수치|절차|예외|계산|중요)\s*$/g, "").trim(),
        s: s,
        src: src ? src.textContent : ""
      });
    }
    if (!items.length) return;
    D = { items: items, i: 0, ratio: 60, done: 0, hit: 0 };
    paint();
  };

  function paint() {
    var m = document.getElementById("ppmModal");
    if (!m || !D) return;
    var it = D.items[D.i];
    var pct = Math.round((D.i / D.items.length) * 100);
    m.hidden = false;
    m.innerHTML =
      '<div class="modal-in">' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="modal-top"><span>' + (D.i + 1) + " / " + D.items.length +
      '</span><span>맞힘 ' + D.hit + " · " + esc(it.id) + "</span></div>" +
      '<div class="modal-q">' + esc(it.title) + "</div>" +
      '<div class="modal-s" id="ppmS">' + render(it.s, D.ratio) + "</div>" +
      '<input type="text" id="ppmIn" autocomplete="off" placeholder="가려진 말을 순서대로, 빈칸으로 띄어 쓰세요"/>' +
      '<div class="modal-fb" id="ppmFb"></div>' +
      '<div class="modal-btns">' +
      '<button class="btn" onclick="ppmDrillCheck()">확인</button>' +
      '<button class="btn ghost" onclick="ppmDrillReveal()">정답 보기</button>' +
      '<button class="btn ghost" onclick="ppmDrillNext()">다음</button>' +
      '<button class="btn ghost" onclick="ppmDrillClose()">닫기</button>' +
      "</div>" +
      (it.src ? '<div class="modal-src">' + esc(it.src) + "</div>" : "") +
      "</div>";
    var inp = document.getElementById("ppmIn");
    if (inp) {
      inp.focus();
      inp.onkeydown = function (ev) { if (ev.key === "Enter") window.ppmDrillCheck(); };
    }
  }

  window.ppmDrillCheck = function () {
    if (!D) return;
    var it = D.items[D.i];
    var want = answers(it.s, D.ratio);
    var got = (document.getElementById("ppmIn").value || "").split(/\s+/).filter(Boolean);
    var ok = 0;
    for (var i = 0; i < want.length; i++) {
      if (got[i] && norm(got[i]) === norm(want[i])) ok++;
    }
    var fb = document.getElementById("ppmFb");
    if (ok === want.length && want.length) {
      fb.className = "modal-fb ok";
      fb.textContent = "맞았습니다 (" + ok + "/" + want.length + ")";
      D.hit++;
      document.getElementById("ppmS").innerHTML = esc(it.s);
      setTimeout(window.ppmDrillNext, 700);
    } else {
      fb.className = "modal-fb no";
      fb.textContent = ok + " / " + want.length + " 맞음. 정답: " + want.join(" , ");
      document.getElementById("ppmS").innerHTML = esc(it.s);
    }
  };

  window.ppmDrillReveal = function () {
    if (!D) return;
    var it = D.items[D.i];
    document.getElementById("ppmS").innerHTML = esc(it.s);
    var fb = document.getElementById("ppmFb");
    fb.className = "modal-fb no";
    fb.textContent = "정답: " + answers(it.s, D.ratio).join(" , ");
  };

  window.ppmDrillNext = function () {
    if (!D) return;
    D.i++;
    if (D.i >= D.items.length) {
      var m = document.getElementById("ppmModal");
      m.innerHTML =
        '<div class="modal-in"><div class="modal-q">이 절을 끝냈습니다</div>' +
        '<p class="modal-s">' + D.items.length + "장 중 " + D.hit + "장을 한 번에 맞혔습니다.</p>" +
        '<div class="modal-btns"><button class="btn" onclick="ppmDrillStart()">다시</button>' +
        '<button class="btn ghost" onclick="ppmDrillClose()">닫기</button></div></div>';
      return;
    }
    paint();
  };

  window.ppmDrillClose = function () {
    var m = document.getElementById("ppmModal");
    if (m) { m.hidden = true; m.innerHTML = ""; }
    D = null;
  };

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") window.ppmDrillClose();
  });
})();
