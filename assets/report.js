/* 오류 신고 — 개념 블록·문항·페이지 단위로 바로 접수한다.
   Supabase가 연결되어 있으면 problem_reports 표에 넣고,
   아직 연결되지 않았으면 GitHub 이슈로 넘긴다(내용은 미리 채워진다). */
(function () {
  "use strict";

  var GH = "https://github.com/law-test/procurement/issues/new";
  var NAMEKEY = "ppm.reporter.v1";
  var stash = [], box = null, cur = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function cut(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  function cfg() {
    /* 순위·커뮤니티가 쓰는 설정(JODAL_RANK_CONFIG)을 그대로 받아쓴다.
       key 는 브라우저에 공개해도 되는 publishable key 다. */
    var c = window.PPM_SUPABASE;
    if (c && c.url && c.anon) return c;
    var r = window.JODAL_RANK_CONFIG;
    if (r && r.url && r.key) return { url: r.url, anon: r.key };
    return null;
  }
  function savedName() {
    try { return localStorage.getItem(NAMEKEY) || ""; } catch (e) { return ""; }
  }

  /* ------------------------------------------------------------- 신고 창 */

  function build() {
    if (box) return box;
    box = document.createElement("div");
    box.className = "rep-mask";
    box.hidden = true;
    box.innerHTML =
      '<div class="rep-box" role="dialog" aria-modal="true" aria-labelledby="repH">' +
      '  <div class="rep-head"><b id="repH">오류 신고</b>' +
      '    <button class="rep-x" type="button" aria-label="닫기">×</button></div>' +
      '  <div class="rep-what"></div>' +
      '  <label class="rep-l">어디가 잘못됐습니까<span class="rep-req">필수</span></label>' +
      '  <textarea class="rep-t" id="repQuote" rows="3" maxlength="2000"' +
      '    placeholder="틀린 문장을 그대로 붙여 주세요"></textarea>' +
      '  <label class="rep-l">맞는 내용은 무엇입니까</label>' +
      '  <textarea class="rep-t" id="repFix" rows="2" maxlength="2000"' +
      '    placeholder="아는 만큼만 적어 주셔도 됩니다"></textarea>' +
      '  <label class="rep-l">근거</label>' +
      '  <input class="rep-i" id="repEv" maxlength="1000"' +
      '    placeholder="법령 조문, 공고 제목과 날짜, 교재 판본과 쪽"/>' +
      '  <label class="rep-l">이름 (비워 두면 익명)</label>' +
      '  <input class="rep-i" id="repName" maxlength="24" placeholder="익명"/>' +
      '  <div class="rep-msg" id="repMsg"></div>' +
      '  <div class="rep-btns">' +
      '    <button class="btn" type="button" id="repSend">보내기</button>' +
      '    <button class="btn ghost" type="button" id="repGh">GitHub에 남기기</button>' +
      '    <button class="btn ghost" type="button" id="repCancel">닫기</button>' +
      '  </div>' +
      '  <p class="rep-note">확인해서 고치고, 무엇이 어떻게 바뀌었는지 <a href="#" class="rep-news">소식</a>에 적습니다.</p>' +
      '</div>';
    document.body.appendChild(box);

    box.querySelector(".rep-x").onclick = close;
    box.querySelector("#repCancel").onclick = close;
    box.querySelector("#repSend").onclick = send;
    box.querySelector("#repGh").onclick = github;
    box.onclick = function (e) { if (e.target === box) close(); };
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box && !box.hidden) close();
    });
    var a = box.querySelector(".rep-news");
    if (a) a.setAttribute("href", upTo() + "news/");
    return box;
  }

  function upTo() {
    /* 현재 페이지 깊이에서 사이트 뿌리까지 */
    var m = document.querySelector('header a.logo');
    var h = m && m.getAttribute("href");
    return h || "/";
  }

  function open(o) {
    cur = o || {};
    build();
    var what = box.querySelector(".rep-what");
    var bits = [];
    if (cur.kindLabel) bits.push(esc(cur.kindLabel));
    if (cur.id) bits.push('<code>' + esc(cur.id) + '</code>');
    what.innerHTML = bits.length
      ? '<span class="rep-tag">' + bits.join(" ") + "</span>" +
        (cur.quote ? '<span class="rep-quote">' + esc(cut(cur.quote, 160)) + "</span>" : "")
      : '<span class="rep-tag">이 페이지</span>';
    box.querySelector("#repQuote").value = cur.quote ? cut(cur.quote, 500) : "";
    box.querySelector("#repFix").value = "";
    box.querySelector("#repEv").value = "";
    box.querySelector("#repName").value = savedName();
    msg("", "");
    box.hidden = false;
    document.documentElement.style.overflow = "hidden";
    setTimeout(function () { box.querySelector("#repQuote").focus(); }, 30);
  }

  function close() {
    if (!box) return;
    box.hidden = true;
    document.documentElement.style.overflow = "";
  }

  function msg(t, cls) {
    var el = box.querySelector("#repMsg");
    el.className = "rep-msg" + (cls ? " " + cls : "");
    el.textContent = t || "";
  }

  function payload() {
    var q = box.querySelector("#repQuote").value.trim();
    var name = box.querySelector("#repName").value.trim();
    if (name) { try { localStorage.setItem(NAMEKEY, name); } catch (e) {} }
    return {
      page_url: location.pathname + location.hash,
      quote: q,
      correction: box.querySelector("#repFix").value.trim() || null,
      evidence: box.querySelector("#repEv").value.trim() || null,
      atom_id: (cur && cur.id) ? String(cur.id).slice(0, 20) : null,
      detail: (cur && cur.kindLabel) ? cur.kindLabel : null,
      author_name: name || "익명"
    };
  }

  function send() {
    var p = payload();
    if (p.quote.length < 2) { msg("어디가 잘못됐는지 한 줄이라도 적어 주세요.", "no"); return; }
    var c = cfg();
    if (!c) { github(); return; }
    var b = box.querySelector("#repSend");
    b.disabled = true; msg("보내는 중…", "");
    fetch(c.url.replace(/\/$/, "") + "/rest/v1/problem_reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": c.anon,
        "Authorization": "Bearer " + (c.token || c.anon),
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(p)
    }).then(function (r) {
      b.disabled = false;
      if (r.ok) { msg("접수됐습니다. 확인해서 고치겠습니다.", "ok"); setTimeout(close, 1400); }
      else { msg("접수에 실패했습니다(" + r.status + "). GitHub에 남겨 주세요.", "no"); }
    }).catch(function () {
      b.disabled = false;
      msg("연결이 안 됩니다. GitHub에 남겨 주세요.", "no");
    });
  }

  function github() {
    var p = payload();
    if (p.quote.length < 2) { msg("어디가 잘못됐는지 한 줄이라도 적어 주세요.", "no"); return; }
    var title = "[오류] " + (p.atom_id ? p.atom_id + " · " : "") + cut(p.quote, 50);
    var body =
      "### 어디\n" + location.href + "\n" +
      (p.atom_id ? "항목 ID: `" + p.atom_id + "`\n" : "") +
      (p.detail ? "구분: " + p.detail + "\n" : "") +
      "\n### 틀린 내용\n" + p.quote + "\n" +
      (p.correction ? "\n### 맞는 내용\n" + p.correction + "\n" : "") +
      (p.evidence ? "\n### 근거\n" + p.evidence + "\n" : "");
    var u = GH + "?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
    window.open(u, "_blank", "noopener");
    msg("GitHub 창을 열었습니다. 그곳에서 제출하면 접수됩니다.", "ok");
  }

  /* ------------------------------------------------ 버튼 달기 (자동·수동) */

  function btnEl(o) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "rep-btn";
    b.textContent = "오류 신고";
    b.title = (o.id ? o.id + " " : "") + "오류 신고";
    b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); open(o); };
    return b;
  }

  function attachAtoms(root) {
    var list = (root || document).querySelectorAll("article.atom[data-atom]");
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute("data-rep") === "1") continue;
      el.setAttribute("data-rep", "1");
      var body = el.querySelector(".atom-body");
      var row = document.createElement("div");
      row.className = "atom-rep";
      row.appendChild(btnEl({
        id: el.getAttribute("data-atom"),
        kindLabel: el.getAttribute("data-rep-label") || "개념",
        quote: el.getAttribute("data-rep-quote") ||
               (body ? body.textContent : el.textContent)
      }));
      el.appendChild(row);
    }
  }

  function stashPut(o) { stash.push(o); return stash.length - 1; }

  window.PPMReport = {
    open: open,
    close: close,
    /* 생성된 HTML 안에서 쓰기 위한 것 — 값을 넣어 두고 번호로 연다 */
    mark: function (o) { return stashPut(o); },
    openKey: function (k) { open(stash[k] || {}); },
    /* 문항 화면에서 쓰는 버튼 HTML */
    btn: function (o, label) {
      var k = stashPut(o);
      return '<button class="btn ghost sm rep-inline" type="button" onclick="PPMReport.openKey(' +
        k + ')">' + (label || "오류 신고") + "</button>";
    },
    openPage: function () { open({}); },
    scan: attachAtoms
  };

  function boot() {
    attachAtoms(document);
    var f = document.querySelector(".foot-report");
    if (f) f.onclick = function (e) { e.preventDefault(); open({}); };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* 방문 통계 — analytics.js 를 한 번만 불러온다. */
(function () {
  if (window.__jodalAnalyticsTag) return;
  window.__jodalAnalyticsTag = true;
  var logo = document.querySelector('header a.logo');
  var base = logo ? (logo.getAttribute('href') || './') : './';
  var s = document.createElement('script');
  s.src = base + 'assets/analytics.js';
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();

/* 방문 집계 — visits.js 를 한 번만 불러온다. */
(function () {
  if (window.__jodalVisitsTag) return;
  window.__jodalVisitsTag = true;
  var logo = document.querySelector('header a.logo');
  var base = logo ? (logo.getAttribute('href') || './') : './';
  var s = document.createElement('script');
  s.src = base + 'assets/visits.js?v=20260916-v1';
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();
