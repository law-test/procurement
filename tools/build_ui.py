#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""학습방(홈)·외우기·모의시험·소식 화면 생성기."""
import json, os, importlib.util

OUT = os.environ.get("PPM_OUT", "/home/claude/procurement")
spec = importlib.util.spec_from_file_location("bp", os.path.join(OUT, "tools", "build_pages.py"))
bp = importlib.util.module_from_spec(spec); spec.loader.exec_module(bp)

QN = {}
for slug in ("law", "plan", "contract", "practice"):
    p = os.path.join(OUT, "data", "quiz.%s.json" % slug)
    QN[slug] = json.load(open(p, encoding="utf-8"))["n"] if os.path.exists(p) else 0
CN = {}
for slug in ("law", "plan", "contract", "practice", "etc"):
    p = os.path.join(OUT, "data", "cards.%s.json" % slug)
    CN[slug] = json.load(open(p, encoding="utf-8"))["n"] if os.path.exists(p) else 0

N_ATOM = sum(CN.values())
N_QUIZ = sum(QN.values())

# ------------------------------------------------------------------ 학습방(홈)

HOME = bp.head(
    "조달프로 — 공공조달관리사 학습방",
    "공공조달관리사 필기 10월 3일. 출제기준 273항목을 개념 %d개로 익히고, 문항 %d개로 외우고, 모의시험으로 점검합니다." % (N_ATOM, N_QUIZ),
    0) + """
<main class="wrap">
  <div class="banner">
    <span class="dday" data-dday="written">D-</span>
    <b>필기시험 10월 3일(토)</b> · 원서접수 9월 14일(월)~17일(목), Q-Net
  </div>

  <h1 class="home-h1">오늘 무엇을 하시겠습니까</h1>

  <div class="home-grid">
    <a class="home-card home-card-x" href="plan/">
      <div class="home-k">학습계획</div>
      <div class="home-t">1주일 완성 · 3회독</div>
      <p>필기 범위를 <b>7일에 한 바퀴</b> 돌리고 그 7일을 <b>세 번</b> 반복합니다. 회독마다 읽는 깊이와 묻는 방식이 달라집니다. 하루 한 시간 배분까지 정해 두었습니다.</p>
      <div class="home-go">오늘 할 범위 보기 →</div>
    </a>
    <a class="home-card" href="c/">
      <div class="home-k">익히기</div>
      <div class="home-t">출제기준별 개념</div>
      <p>공식 출제기준 <b>273개 항목</b>을 개념 <b>%(n_atom)s개</b>로 채웠습니다. 개념마다 근거 조문과 교재 쪽이 붙어 있고, 헷갈리는 짝과 예외를 따로 적었습니다.</p>
      <div class="home-go">과목 트리에서 찾아보기 →</div>
    </a>
    <a class="home-card" href="drill/">
      <div class="home-k">외우기</div>
      <div class="home-t">문제·빈칸·회상</div>
      <p>같은 개념을 <b>4지선다</b>, <b>빈칸 채우기</b>, <b>직접회상</b> 세 방식으로 묻습니다. 객관식 <b>%(n_quiz)s문항</b>. 틀린 것은 다시 나오고 진도가 남습니다.</p>
      <div class="home-go">범위 골라 시작하기 →</div>
    </a>
    <a class="home-card" href="cbt/">
      <div class="home-k">모의시험</div>
      <div class="home-t">CBT 실전·과목별</div>
      <p>실제 구성 그대로 <b>80문항 120분</b>(30·20·30). 과목별 짧은 연습도 있습니다. 제출하면 과목별 점수와 오답 해설이 나옵니다.</p>
      <div class="home-go">시험 시작하기 →</div>
    </a>
  </div>

  <h2>내 진도</h2>
  <div id="homeProg" class="prog">이 브라우저에 저장된 진도를 읽는 중…</div>
  <p class="note">진도는 이 브라우저에만 저장됩니다. 기기를 옮기면 따로 쌓입니다.</p>

  <h2>시험 구성</h2>
  <div class="tablewrap">
  <table>
    <thead><tr><th>과목</th><th>문항</th><th>익히기</th><th>외우기</th></tr></thead>
    <tbody>
      <tr><td>공공조달과 법제도 이해</td><td>30</td><td>개념 %(c_law)s</td><td>문항 %(q_law)s</td></tr>
      <tr><td>공공조달계획 수립 및 분석</td><td>20</td><td>개념 %(c_plan)s</td><td>문항 %(q_plan)s</td></tr>
      <tr><td>공공계약관리</td><td>30</td><td>개념 %(c_contract)s</td><td>문항 %(q_contract)s</td></tr>
      <tr><td>실기 · 공공조달 관리실무</td><td>필답형 20문항 내외</td><td>개념 %(c_practice)s</td><td>문항 %(q_practice)s</td></tr>
    </tbody>
  </table>
  </div>
  <p>필기는 한 문항에 90초, 실기는 한 문항에 7분입니다. 원가계산 한 문항에 15분을 쓰면 서술 문항을 비우게 됩니다.</p>

  <h2>범위는 출제기준이 정합니다</h2>
  <p>조달청의 표준교재와 강좌는 학습 참고자료이고, 시험은 국가기술자격 출제기준에 따릅니다. 현행 기준의 적용기간은 <b>2026년 3월 1일부터 2028년 12월 31일까지</b>이며 세세항목은 <b>필기 182개·실기 91개</b>입니다. 교재를 다 읽는 것과 출제기준을 덮는 것은 다른 일입니다.</p>
  <p>Q-Net이 공개한 필기 예제문제는 6문항이고 공식 정답·해설은 함께 공개되지 않았습니다. 돌아다니는 '정답'은 모두 누군가의 해석이므로 근거 조문으로 확인해야 합니다. <a href="exam/">시험·접수 안내 →</a></p>
</main>
<script src="assets/site.js"></script>
<script>
(function () {
  var SUB = [["law","법제도",%(c_law)s],["plan","계획분석",%(c_plan)s],["contract","계약관리",%(c_contract)s],["practice","실기 실무",%(c_practice)s]];
  var srs = {};
  try { srs = JSON.parse(localStorage.getItem("ppm.srs.v1") || "{}"); } catch (e) {}
  var keys = Object.keys(srs);
  var el = document.getElementById("homeProg");
  if (!keys.length) {
    el.innerHTML = '아직 푼 카드가 없습니다. <a href="drill/">외우기</a>에서 20장부터 시작해 보세요.';
    return;
  }
  var t = Math.floor(Date.now() / 86400000), due = 0;
  keys.forEach(function (k) { if ((srs[k].due || 0) <= t) due++; });
  el.innerHTML = '<div class="prog-row"><b>' + keys.length + '</b>장 풀었고, 그 가운데 <b>' + due +
    '</b>장이 오늘 복습할 차례입니다. <a href="drill/">복습하기 →</a></div>';
})();
</script>
""" % {
    "n_atom": "{:,}".format(N_ATOM), "n_quiz": "{:,}".format(N_QUIZ),
    "c_law": CN["law"], "c_plan": CN["plan"], "c_contract": CN["contract"], "c_practice": CN["practice"],
    "q_law": QN["law"], "q_plan": QN["plan"], "q_contract": QN["contract"], "q_practice": QN["practice"],
} + bp.foot(0)

# ------------------------------------------------------------------ 외우기

DRILL = bp.head(
    "외우기 — 조달프로",
    "공공조달관리사 개념을 4지선다·빈칸·직접회상 세 방식으로 묻습니다. 과목과 주요항목을 골라 연속으로 풀어 보세요.",
    1) + """
<main class="wrap card-wrap">
  <h1>외우기</h1>
  <p class="lede">같은 개념을 <b>4지선다</b>, <b>빈칸 채우기</b>, <b>직접회상</b> 세 방식으로 묻습니다. 방식별로 복습 상태를 따로 저장하니, 객관식을 맞혔다고 회상까지 외운 것으로 처리하지 않습니다. 틀린 카드는 다음 날 다시 나옵니다.</p>

  <div class="card-setup" id="setup">
    <div class="row"><label>과목</label><select id="selSubject"></select></div>
    <div class="row"><label>주요항목</label><select id="selMajor"><option value="all">전부</option></select></div>
    <div class="row"><label>방식</label><select id="selMode">
      <option value="quiz">4지선다</option>
      <option value="blank">빈칸 채우기</option>
      <option value="recall">직접회상</option>
      <option value="mix" selected>세 방식 섞기</option>
    </select></div>
    <div class="row"><label>분량</label><select id="selCount">
      <option value="10">10문항</option><option value="20" selected>20문항</option>
      <option value="40">40문항</option><option value="80">80문항</option>
    </select></div>
    <div class="row"><label>중요도</label><select id="selImp">
      <option value="all">전부</option><option value="높음">중요만</option><option value="높음중간">중요·중간</option>
    </select></div>
    <div class="row">
      <button class="btn" onclick="dStart()">시작</button>
      <button class="btn ghost" onclick="dReset()">진도 초기화</button>
    </div>
    <p class="note" id="stat"></p>
  </div>
  <div id="run" hidden></div>
</main>
<script src="../assets/quiz.js"></script>
<script>
var Q = null, POOL = { quiz: [], card: [] };
function $(id) { return document.getElementById(id); }

function fillSubjects() {
  $("selSubject").innerHTML = PPMQ.SUBJECTS.map(function (x) {
    return '<option value="' + x.slug + '">' + PPMQ.esc(x.s) + ' (' + x.exam + ')</option>';
  }).join("");
  $("selSubject").onchange = load;
  load();
}
function load() {
  var slug = $("selSubject").value;
  $("stat").textContent = "불러오는 중…";
  Promise.all([PPMQ.loadQuiz(slug), PPMQ.loadCards(slug)]).then(function (r) {
    POOL.quiz = r[0].items; POOL.card = r[1].cards;
    var seen = [];
    POOL.card.forEach(function (c) { if (seen.indexOf(c.m) < 0) seen.push(c.m); });
    $("selMajor").innerHTML = '<option value="all">전부</option>' +
      seen.map(function (m) { return '<option>' + PPMQ.esc(m) + '</option>'; }).join("");
    var srs = PPMQ.srsGet(), t = PPMQ.today(), done = 0, due = 0;
    Object.keys(srs).forEach(function (k) { done++; if ((srs[k].due || 0) <= t) due++; });
    $("stat").textContent = "이 과목 개념 " + POOL.card.length + "개 · 객관식 " + POOL.quiz.length +
      "문항. 전체 진도 " + done + "장 가운데 " + due + "장이 복습 차례입니다.";
  }).catch(function () { $("stat").textContent = "데이터를 불러오지 못했습니다."; });
}
function dReset() { PPMQ.srsPut({}); load(); }

function dStart() {
  var major = $("selMajor").value, mode = $("selMode").value;
  var n = +$("selCount").value, imp = $("selImp").value;
  function impOk(x) {
    if (imp === "높음") return (x.i || x.imp) === "높음";
    if (imp === "높음중간") return (x.i || x.imp) !== "낮음";
    return true;
  }
  var cards = POOL.card.filter(function (c) {
    return (major === "all" || c.m === major) && impOk(c) && PPMQ.norm(c.s).length >= 12;
  });
  var quiz = POOL.quiz.filter(function (q) {
    return (major === "all" || q.major === major) && impOk(q);
  });
  var srs = PPMQ.srsGet(), t = PPMQ.today();
  function rank(id, m) { var st = srs[id + "|" + m]; return !st ? 1 : (st.due <= t ? 0 : 2); }
  var items = [];
  if (mode === "quiz" || mode === "mix") {
    quiz.sort(function (a, b) { return rank(a.atom, "quiz") - rank(b.atom, "quiz"); });
    quiz.slice(0, mode === "mix" ? Math.ceil(n / 2) : n).forEach(function (q) {
      items.push({ mode: "quiz", q: q });
    });
  }
  if (mode !== "quiz") {
    var per = mode === "mix" ? Math.floor(n / 4) : n;
    ["blank", "recall"].forEach(function (m) {
      if (mode !== "mix" && mode !== m) return;
      var list = cards.slice();
      list.sort(function (a, b) { return rank(a.id, m) - rank(b.id, m); });
      list.slice(0, mode === "mix" ? per : n).forEach(function (c) { items.push({ mode: m, c: c }); });
    });
  }
  if (!items.length) { alert("조건에 맞는 문항이 없습니다."); return; }
  Q = { items: PPMQ.shuffle(items).slice(0, n), i: 0, hit: 0, ratio: 60 };
  $("setup").hidden = true; $("run").hidden = false;
  paint();
}

function paint() {
  var it = Q.items[Q.i], pct = Math.round(Q.i / Q.items.length * 100), h;
  var label = { quiz: "4지선다", blank: "빈칸", recall: "직접회상" }[it.mode];
  if (it.mode === "quiz") {
    var q = it.q;
    h = '<div class="modal-top"><span>' + (Q.i + 1) + " / " + Q.items.length + " · " + label +
      '</span><span>' + PPMQ.esc(q.minor) + '</span></div>' +
      '<div class="modal-q">' + PPMQ.esc(q.q) + '</div>' +
      '<div class="modal-s">' + PPMQ.esc(q.stem) + '</div>' +
      '<ol class="choices">' + q.choices.map(function (c, k) {
        return '<li><button class="ch" onclick="dPick(' + k + ')">' + PPMQ.MARK[k] + " " + PPMQ.esc(c) + '</button></li>';
      }).join("") + '</ol><div class="modal-fb" id="fb"></div><div class="modal-btns" id="btns">' +
      '<button class="btn ghost" onclick="dQuit()">그만</button></div>';
  } else {
    var c = it.c;
    h = '<div class="modal-top"><span>' + (Q.i + 1) + " / " + Q.items.length + " · " + label +
      '</span><span>' + PPMQ.esc(c.y) + (c.i === "높음" ? " · 중요" : "") + '</span></div>' +
      '<div class="modal-q">' + PPMQ.esc(c.t) + '</div>' +
      (it.mode === "blank"
        ? '<div class="modal-s" id="sBox">' + PPMQ.maskHtml(c.s, Q.ratio) + '</div>' +
          '<input type="text" id="in" autocomplete="off" placeholder="가려진 말을 순서대로, 빈칸으로 띄어 쓰세요"/>'
        : '<div class="modal-s" id="sBox"><i>답을 떠올린 뒤 확인을 누르세요.</i></div>') +
      '<div class="modal-fb" id="fb"></div><div class="modal-btns" id="btns">' +
      (it.mode === "blank" ? '<button class="btn" onclick="dCheck()">확인</button>' : '') +
      '<button class="btn ' + (it.mode === "blank" ? "ghost" : "") + '" onclick="dReveal()">정답 보기</button>' +
      '<button class="btn ghost" onclick="dQuit()">그만</button></div>';
  }
  $("run").innerHTML = '<div class="bar"><i style="width:' + pct + '%"></i></div>' + h;
  var inp = $("in");
  if (inp) { inp.focus(); inp.onkeydown = function (e) { if (e.key === "Enter") dCheck(); }; }
}

function explain(x) {
  return (x.full || x.s ? '<div class="modal-s">' + PPMQ.esc(x.full || x.s) + '</div>' : "") +
    (x.cond && x.cond !== "없음" ? '<div class="atom-cond"><b>조건·예외</b> ' + PPMQ.esc(x.cond) + '</div>' : "") +
    (x.c && x.c !== "없음" ? '<div class="atom-cond"><b>조건·예외</b> ' + PPMQ.esc(x.c) + '</div>' : "") +
    (x.conf && x.conf !== "없음" ? '<div class="atom-conf"><b>혼동</b> ' + PPMQ.esc(x.conf) + '</div>' : "") +
    (x.x && x.x !== "없음" ? '<div class="atom-conf"><b>혼동</b> ' + PPMQ.esc(x.x) + '</div>' : "") +
    ((x.src || x.r) ? '<div class="modal-src">' + PPMQ.esc(x.src || x.r) + '</div>' : "");
}

function dPick(k) {
  var it = Q.items[Q.i], q = it.q, ok = k === q.answer;
  var btns = document.querySelectorAll(".ch");
  for (var i = 0; i < btns.length; i++) {
    btns[i].disabled = true;
    if (i === q.answer) btns[i].classList.add("ch-ok");
    else if (i === k) btns[i].classList.add("ch-no");
  }
  $("fb").className = "modal-fb " + (ok ? "ok" : "no");
  $("fb").textContent = ok ? "맞았습니다" : "틀렸습니다. 정답 " + PPMQ.MARK[q.answer];
  PPMQ.grade(q.atom, "quiz", ok);
  if (ok) Q.hit++;
  $("btns").innerHTML = '<button class="btn" onclick="dNext()">다음</button>' +
    (q.gid ? '<a class="btn ghost" href="../c/' + q.gid.split(".").slice(0, -1).join(".") + '/">교재에서 보기</a>' : "") +
    PPMReport.btn({ id: q.id || q.atom, kindLabel: "문항 " + (q.kind === "num" ? "수치형" : "규정형"),
                    quote: q.stem + "  [정답 " + q.choices[q.answer] + "]" }) +
    '<button class="btn ghost" onclick="dQuit()">그만</button>';
  $("btns").insertAdjacentHTML("beforebegin", explain(q));
}

function dCheck() {
  var it = Q.items[Q.i], c = it.c;
  var want = PPMQ.maskAns(c.s, Q.ratio);
  var got = ($("in").value || "").split(/\\s+/).filter(Boolean), ok = 0;
  for (var i = 0; i < want.length; i++) if (got[i] && PPMQ.norm(got[i]) === PPMQ.norm(want[i])) ok++;
  var all = ok === want.length && want.length;
  $("fb").className = "modal-fb " + (all ? "ok" : "no");
  $("fb").textContent = all ? "맞았습니다 (" + ok + "/" + want.length + ")"
    : ok + " / " + want.length + " 맞음. 정답: " + want.join(" , ");
  PPMQ.grade(c.id, "blank", all);
  if (all) Q.hit++;
  finishCard(c);
}
function dReveal() {
  var it = Q.items[Q.i], c = it.c;
  if (it.mode === "blank") {
    $("fb").className = "modal-fb no";
    $("fb").textContent = "정답: " + PPMQ.maskAns(c.s, Q.ratio).join(" , ");
  }
  finishCard(c);
}
function finishCard(c) {
  var it = Q.items[Q.i];
  $("sBox").innerHTML = "";
  $("btns").innerHTML = '<button class="btn" onclick="dGrade(1)">알았음</button>' +
    '<button class="btn ghost" onclick="dGrade(0)">몰랐음</button>' +
    (c.g && c.g !== "etc" ? '<a class="btn ghost" href="../c/' + c.g.split(".").slice(0, -1).join(".") + '/">교재에서 보기</a>' : "") +
    PPMReport.btn({ id: c.id, kindLabel: it.mode === "blank" ? "빈칸 카드" : "회상 카드",
                    quote: (c.t ? c.t + " — " : "") + (c.s || "") }) +
    '<button class="btn ghost" onclick="dQuit()">그만</button>';
  $("btns").insertAdjacentHTML("beforebegin", explain(c));
  var inp = $("in"); if (inp) inp.remove();
}
function dGrade(ok) {
  var it = Q.items[Q.i];
  PPMQ.grade(it.c.id, it.mode, !!ok);
  dNext();
}
function dNext() {
  Q.i++;
  if (Q.i >= Q.items.length) {
    $("run").innerHTML = '<div class="modal-q">' + Q.items.length + '문항을 끝냈습니다</div>' +
      '<p class="modal-s">한 번에 맞힌 것 ' + Q.hit + '문항. 틀린 것은 내일 다시 나옵니다.</p>' +
      '<div class="modal-btns"><button class="btn" onclick="dQuit()">돌아가기</button></div>';
    return;
  }
  paint();
}
function dQuit() { Q = null; $("run").hidden = true; $("setup").hidden = false; load(); }
function applyQuery() {
  var q = {};
  location.search.replace(/^\?/, "").split("&").forEach(function (kv) {
    var a = kv.split("=");
    if (a[0]) q[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || "");
  });
  /* 주소에 없는 값이 오면 선택 상자가 빈 값이 되어 문항이 0개가 된다. 있는 값만 반영한다. */
  function put(id, v) {
    if (!v) return;
    var el = $(id);
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value === v) { el.value = v; return; }
    }
  }
  put("selSubject", q.subject);
  put("selMode", q.mode);
  put("selImp", q.imp);
  put("selCount", q.n);
  return q;
}
document.addEventListener("DOMContentLoaded", function () {
  fillSubjects();
  var q = applyQuery();
  if (q.subject) {
    load();
    setTimeout(function () { if (q.major) $("selMajor").value = q.major; }, 600);
  }
});
</script>
""" + bp.foot(1)

# ------------------------------------------------------------------ 모의시험

CBT = bp.head(
    "모의시험 CBT — 조달프로",
    "공공조달관리사 필기 구성 그대로 80문항 120분. 과목별 짧은 연습과 실기 실무 문항 연습도 있습니다. 제출하면 과목별 점수와 오답 해설이 나옵니다.",
    1) + """
<main class="wrap card-wrap">
  <h1>모의시험</h1>
  <p class="lede">실제 필기 구성 그대로 <b>80문항 120분</b>입니다. 과목별 문항 수는 법제도 30 · 계획분석 20 · 계약관리 30입니다. 제출하면 과목별 점수와 틀린 문항의 근거가 함께 나옵니다.</p>

  <div class="card-setup" id="setup">
    <div class="row"><label>방식</label><select id="selKind">
      <option value="real">실전 · 필기 80문항 120분</option>
      <option value="subject">과목별 연습</option>
      <option value="practice">실기 실무 문항 연습</option>
    </select></div>
    <div class="row" id="rowSubject" hidden><label>과목</label><select id="selSubject"></select></div>
    <div class="row" id="rowCount" hidden><label>문항</label><select id="selCount">
      <option value="10">10문항</option><option value="20" selected>20문항</option><option value="40">40문항</option>
    </select></div>
    <div class="row"><label>시간</label><select id="selTime">
      <option value="1">제한시간 적용</option><option value="0">시간 제한 없이</option>
    </select></div>
    <div class="row"><button class="btn" onclick="cStart()">시작</button></div>
    <p class="note" id="stat"></p>
    <p class="note">국가기술자격 필기는 통상 과목당 40점 이상, 전 과목 평균 60점 이상을 합격으로 봅니다. 이 종목의 확정 기준은 <a href="https://www.q-net.or.kr/crf005.do?id=crf00503s02&amp;gSite=Q&amp;gId=&amp;jmCd=9777&amp;jmInfoDivCcd=B0&amp;seriesCd=03" rel="noopener">Q-Net 시험정보</a>에서 확인하세요.</p>
  </div>

  <div id="exam" hidden>
    <div class="cbt-bar">
      <span id="clock" class="clock">--:--</span>
      <span id="counter"></span>
      <button class="btn" onclick="cSubmit()">제출</button>
      <button class="btn ghost" onclick="cQuit()">그만</button>
    </div>
    <div id="qlist"></div>
  </div>
  <div id="result" hidden></div>
</main>
<script src="../assets/quiz.js"></script>
<script>
var E = null, TMR = null;
function $(id) { return document.getElementById(id); }

document.addEventListener("DOMContentLoaded", function () {
  $("selSubject").innerHTML = PPMQ.SUBJECTS.filter(function (x) { return x.exam === "필기"; })
    .map(function (x) { return '<option value="' + x.slug + '">' + PPMQ.esc(x.s) + '</option>'; }).join("");
  $("selKind").onchange = function () {
    var k = $("selKind").value;
    $("rowSubject").hidden = k !== "subject";
    $("rowCount").hidden = k === "real";
  };
});

function cStart() {
  var kind = $("selKind").value, timed = $("selTime").value === "1";
  $("stat").textContent = "문항을 뽑는 중…";
  var plan = kind === "real"
    ? [["law", 30], ["plan", 20], ["contract", 30]]
    : kind === "practice" ? [["practice", +$("selCount").value]]
    : [[$("selSubject").value, +$("selCount").value]];
  Promise.all(plan.map(function (p) { return PPMQ.loadQuiz(p[0]); })).then(function (res) {
    var items = [];
    res.forEach(function (j, idx) {
      var want = plan[idx][1];
      var pick = PPMQ.shuffle(j.items.slice()).slice(0, want);
      pick.forEach(function (q) { items.push(q); });
    });
    if (!items.length) { $("stat").textContent = "문항이 없습니다."; return; }
    var mins = kind === "real" ? 120 : Math.max(5, Math.round(items.length * 1.5));
    E = { items: items, pick: {}, left: timed ? mins * 60 : 0, timed: timed };
    $("setup").hidden = true; $("exam").hidden = false; $("result").hidden = true;
    render();
    if (timed) { tick(); TMR = setInterval(tick, 1000); }
    else $("clock").textContent = "시간 제한 없음";
  });
}

function render() {
  var h = E.items.map(function (q, i) {
    return '<article class="cbt-q" id="q' + i + '">' +
      '<div class="cbt-qh"><span class="cbt-n">' + (i + 1) + '</span>' + PPMQ.esc(q.q) +
      '<span class="cbt-sub">' + PPMQ.esc(q.subject) + '</span></div>' +
      '<div class="modal-s">' + PPMQ.esc(q.stem) + '</div>' +
      '<ol class="choices">' + q.choices.map(function (c, k) {
        return '<li><button class="ch" id="c' + i + '_' + k + '" onclick="cPick(' + i + ',' + k + ')">' +
          PPMQ.MARK[k] + " " + PPMQ.esc(c) + '</button></li>';
      }).join("") + '</ol></article>';
  }).join("");
  $("qlist").innerHTML = h;
  count();
}
function cPick(i, k) {
  E.pick[i] = k;
  for (var j = 0; j < 4; j++) {
    var b = $("c" + i + "_" + j);
    if (b) b.classList.toggle("ch-on", j === k);
  }
  count();
}
function count() {
  $("counter").textContent = Object.keys(E.pick).length + " / " + E.items.length + " 답함";
}
function tick() {
  if (!E) return;
  E.left--;
  if (E.left <= 0) { $("clock").textContent = "00:00"; cSubmit(); return; }
  var m = Math.floor(E.left / 60), s = E.left % 60;
  $("clock").textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  $("clock").className = "clock" + (E.left < 300 ? " hot" : "");
}

function cSubmit() {
  if (!E) return;
  if (TMR) { clearInterval(TMR); TMR = null; }
  var bySub = {}, wrong = [];
  E.items.forEach(function (q, i) {
    var s = bySub[q.subject] || (bySub[q.subject] = { n: 0, ok: 0 });
    s.n++;
    var ok = E.pick[i] === q.answer;
    if (ok) s.ok++; else wrong.push({ q: q, i: i, pick: E.pick[i] });
    PPMQ.grade(q.atom, "quiz", ok);
  });
  var rows = "", tot = 0, totN = 0, fail = false;
  Object.keys(bySub).forEach(function (k) {
    var s = bySub[k], sc = Math.round(s.ok / s.n * 100);
    if (sc < 40) fail = true;
    tot += s.ok; totN += s.n;
    rows += '<tr><td>' + PPMQ.esc(k) + '</td><td>' + s.ok + ' / ' + s.n + '</td><td><b>' + sc + '점</b></td></tr>';
  });
  var avg = Math.round(tot / totN * 100);
  $("exam").hidden = true; $("result").hidden = false;
  $("result").innerHTML =
    '<h2>결과</h2>' +
    '<div class="tablewrap"><table><thead><tr><th>과목</th><th>맞힘</th><th>점수</th></tr></thead><tbody>' +
    rows + '<tr><td><b>평균</b></td><td>' + tot + ' / ' + totN + '</td><td><b>' + avg + '점</b></td></tr>' +
    '</tbody></table></div>' +
    '<p class="lede">' + (fail ? '과목 하나가 40점 미만입니다. 그 과목부터 다시 보세요.'
      : avg >= 60 ? '통상 합격선인 평균 60점을 넘겼습니다.' : '평균이 60점에 못 미칩니다.') + '</p>' +
    '<h2>틀린 문항 ' + wrong.length + '개</h2>' +
    wrong.map(function (w) {
      var q = w.q;
      return '<article class="atom" data-atom="' + PPMQ.esc(q.id || q.atom || "") +
        '" data-rep-label="문항" data-rep-quote="' + PPMQ.esc(q.stem).replace(/"/g, "&quot;") +
        '  [정답 ' + PPMQ.esc(q.choices[q.answer]).replace(/"/g, "&quot;") + ']"><h4 class="atom-h"><span class="atom-n">' + (w.i + 1) + '</span>' +
        PPMQ.esc(q.t) + '</h4>' +
        '<div class="modal-s">' + PPMQ.esc(q.stem) + '</div>' +
        '<p class="cbt-ans">내 답 ' + (w.pick == null ? '없음' : PPMQ.MARK[w.pick] + " " + PPMQ.esc(q.choices[w.pick])) +
        ' · 정답 <b>' + PPMQ.MARK[q.answer] + " " + PPMQ.esc(q.choices[q.answer]) + '</b></p>' +
        '<div class="modal-s">' + PPMQ.esc(q.full) + '</div>' +
        (q.cond && q.cond !== "없음" ? '<div class="atom-cond"><b>조건·예외</b> ' + PPMQ.esc(q.cond) + '</div>' : "") +
        (q.conf && q.conf !== "없음" ? '<div class="atom-conf"><b>혼동</b> ' + PPMQ.esc(q.conf) + '</div>' : "") +
        '<div class="atom-src">' + PPMQ.esc(q.src) +
        (q.gid ? ' · <a href="../c/' + q.gid.split(".").slice(0, -1).join(".") + '/">교재에서 보기</a>' : "") +
        '</div></article>';
    }).join("") +
    '<div class="modal-btns"><button class="btn" onclick="cQuit()">돌아가기</button></div>';
  if (window.PPMReport) PPMReport.scan($("result"));
  window.scrollTo(0, 0);
  E = null;
}
function cQuit() {
  if (TMR) { clearInterval(TMR); TMR = null; }
  E = null;
  $("exam").hidden = true; $("result").hidden = true; $("setup").hidden = false;
  $("stat").textContent = "";
}
</script>
""" + bp.foot(1)

# ------------------------------------------------------------------ 소식·자료

NEWS = bp.head(
    "소식·자료 — 조달프로",
    "공공조달관리사 공지사항, 관련 기사와 글, 공식 자료 링크, 문의 창구.",
    1) + """
<main class="wrap">
  <h1>소식·자료</h1>

  <h2>공지</h2>
  <ul class="notice">
    <li><span class="nd">2026-09-13</span> <b>모의시험을 열었습니다.</b> 실전 80문항 120분과 과목별 연습, 실기 실무 문항 연습을 고를 수 있습니다.</li>
    <li><span class="nd">2026-09-13</span> <b>출제기준 273개 항목 전체를 공개했습니다.</b> 개념마다 근거 조문과 교재 쪽을 붙였습니다.</li>
    <li><span class="nd">2026-09-13</span> <b>사이트를 열었습니다.</b> 익히기·외우기·모의시험 세 갈래로 운영합니다.</li>
  </ul>

  <h2>관련 기사와 글</h2>
  <ul class="links">
    <li><a href="https://www.jodaleconomy.com/news/articleView.html?idxno=1891" rel="noopener">조달 자격증 시대 열린다… '공공조달관리사' 첫 시험 총정리</a> <span class="lsrc">조달경제신문</span></li>
    <li><a href="https://v.daum.net/v/4pxlgLg2Ei" rel="noopener">국가기술자격에 '공공조달관리사' 신설</a> <span class="lsrc">언론 보도</span></li>
    <li><a href="https://namu.wiki/w/%EA%B3%B5%EA%B3%B5%EC%A1%B0%EB%8B%AC%EA%B4%80%EB%A6%AC%EC%82%AC" rel="noopener">공공조달관리사 — 나무위키</a> <span class="lsrc">영문 명칭 Public Procurement Manager</span></li>
    <li><a href="https://www.q-net.or.kr/man004.do?id=man00402&amp;gSite=Q&amp;gId=&amp;ARTL_SEQ=5253729&amp;BOARD_ID=Q001&amp;notiType=40" rel="noopener">신설 종목 필기 예제문제 안내</a> <span class="lsrc">Q-Net 공고</span></li>
  </ul>

  <h2>공식 자료</h2>
  <ul class="links">
    <li><a href="https://www.q-net.or.kr/crf005.do?id=crf00503s02&amp;gSite=Q&amp;gId=&amp;jmCd=9777&amp;jmInfoDivCcd=B0&amp;seriesCd=03" rel="noopener">Q-Net 시험정보</a> <span class="lsrc">일정·구성·응시자격</span></li>
    <li><a href="https://www.q-net.or.kr/crf005.do?id=crf00503&amp;jmCd=9777" rel="noopener">출제기준</a> <span class="lsrc">적용 2026.03.01~2028.12.31 · 필기 182 · 실기 91</span></li>
    <li><a href="https://pps.go.kr/kor/bbs/view.do?bbsSn=2601150031&amp;key=00034&amp;orderBy=bbsOrdr+desc" rel="noopener">조달청 표준교재와 강좌 안내</a> <span class="lsrc">학습 참고자료</span></li>
    <li><a href="https://www.law.go.kr" rel="noopener">국가법령정보센터</a> <span class="lsrc">국가계약법·시행령·시행규칙, 판로지원법, 전자조달법, 조달사업법</span></li>
  </ul>

  <h2 id="contact">문의·오류 신고</h2>
  <p>내용이 틀렸거나 근거가 어긋난 곳을 찾으셨다면 알려 주세요. 어느 화면의 어느 문장인지, 맞는 내용은 무엇인지, 근거(법령 조문·공고 제목과 게시일·교재 판본과 쪽)를 함께 적어 주시면 확인해서 고치고 무엇이 바뀌었는지 남깁니다.</p>
  <p>개념과 문항에는 각각 <b>오류 신고</b> 버튼이 붙어 있습니다. 그 버튼을 쓰면 어느 항목인지가 자동으로 담겨
     확인이 빠릅니다. 교재에서는 개념 블록 오른쪽 아래, 외우기·모의시험에서는 정답이 공개된 뒤 버튼 줄에 있습니다.</p>
  <ul class="links">
    <li><a class="foot-report" href="https://github.com/law-test/procurement/issues/new" rel="noopener">지금 바로 신고하기</a> <span class="lsrc">항목을 지정하지 않는 일반 문의</span></li>
    <li><a href="https://github.com/law-test/procurement/issues" rel="noopener">접수된 신고와 처리 상태 보기</a> <span class="lsrc">GitHub</span></li>
  </ul>
  <p class="note">숫자와 요율, 조문 번호의 오류를 가장 먼저 고칩니다. 시중 교재에도 하자보수보증금 비율,
     계약보증금률, 지체상금률이 현행 법령과 어긋난 곳이 있습니다. 그런 지점을 발견하시면 알려 주세요.</p>
</main>
""" + bp.foot(1)


def write(path, text):
    p = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(text)
    print("  %-24s %6d bytes" % (path, len(text.encode("utf-8"))))


if __name__ == "__main__":
    write("index.html", HOME)
    write("drill/index.html", DRILL)
    write("cbt/index.html", CBT)
    write("news/index.html", NEWS)
