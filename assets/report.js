/* 오류 신고 — 개념 블록·문항·페이지 단위로 바로 접수한다.
   Supabase가 연결되어 있으면 problem_reports 표에 넣고,
   아직 연결되지 않았으면 GitHub 이슈로 넘긴다(내용은 미리 채워진다). */
(function () {
  "use strict";

  var GH = "https://github.com/law-test/procurement/issues/new";
  var NAMEKEY = "ppm.reporter.v1";
  var stash = [], box = null, cur = null;
  var opener = null, priorOverflow = "", session = 0, pending = false;

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
    var c = window.PPM_SUPABASE;
    return (c && c.url && c.anon) ? c : null;
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
      '<div class="rep-box" role="dialog" aria-modal="true" aria-labelledby="repH" aria-describedby="repHelp">' +
      '  <div class="rep-head"><b id="repH">오류 신고</b>' +
      '    <button class="rep-x" type="button" aria-label="닫기">×</button></div>' +
      '  <div class="rep-what"></div>' +
      '  <label class="rep-l" for="repQuote">어디가 잘못됐습니까<span class="rep-req">필수</span></label>' +
      '  <textarea class="rep-t" id="repQuote" rows="3" maxlength="2000" required aria-describedby="repMsg"' +
      '    placeholder="틀린 문장을 그대로 붙여 주세요"></textarea>' +
      '  <label class="rep-l" for="repFix">맞는 내용은 무엇입니까</label>' +
      '  <textarea class="rep-t" id="repFix" rows="2" maxlength="2000"' +
      '    placeholder="아는 만큼만 적어 주셔도 됩니다"></textarea>' +
      '  <label class="rep-l" for="repEv">근거</label>' +
      '  <input class="rep-i" id="repEv" maxlength="1000"' +
      '    placeholder="법령 조문, 공고 제목과 날짜, 교재 판본과 쪽"/>' +
      '  <div id="repNameRow"><label class="rep-l" for="repName">이름 (선택 · 이 브라우저에 기억합니다)</label>' +
      '  <input class="rep-i" id="repName" maxlength="24" autocomplete="nickname" placeholder="비워 두면 익명"/></div>' +
      '  <p class="rep-note" id="repHelp"></p>' +
      '  <div class="rep-msg" id="repMsg" role="status" aria-live="polite"></div>' +
      '  <div class="rep-btns">' +
      '    <button class="btn" type="button" id="repSend">보내기</button>' +
      '    <button class="btn ghost" type="button" id="repGh">GitHub에서 작성</button>' +
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
      if (!box || box.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var focusable = Array.prototype.filter.call(box.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]'), function (el) {
        return !el.closest("[hidden]");
      });
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (!first) return;
      if (e.shiftKey && (document.activeElement === first || focusable.indexOf(document.activeElement) < 0)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || focusable.indexOf(document.activeElement) < 0)) {
        e.preventDefault(); first.focus();
      }
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
    session++;
    if (box.hidden) {
      opener = document.activeElement;
      priorOverflow = document.documentElement.style.overflow;
    }
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
    box.querySelector("#repQuote").removeAttribute("aria-invalid");
    var direct = !!cfg();
    box.querySelector("#repNameRow").hidden = !direct;
    box.querySelector("#repGh").hidden = !direct;
    box.querySelector("#repSend").textContent = direct ? "신고 보내기" : "GitHub에서 신고 작성";
    box.querySelector("#repHelp").textContent = direct
      ? "신고 내용과 선택한 이름이 운영자에게 전송됩니다. GitHub에서 작성하면 내용과 계정명이 공개됩니다. 연락처 등 개인정보는 적지 마세요."
      : "GitHub에 로그인한 뒤 내용을 확인하고 제출해 주세요. 제출한 신고 내용과 GitHub 계정명은 공개됩니다. 연락처 등 개인정보는 적지 마세요.";
    setPending(pending);
    msg("", "");
    box.hidden = false;
    document.documentElement.style.overflow = "hidden";
    box.querySelector("#repQuote").focus();
  }

  function close() {
    if (!box || box.hidden) return;
    session++;
    box.hidden = true;
    document.documentElement.style.overflow = priorOverflow;
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }

  function msg(t, cls) {
    var el = box.querySelector("#repMsg");
    el.className = "rep-msg" + (cls ? " " + cls : "");
    el.textContent = t || "";
  }

  function payload() {
    var q = box.querySelector("#repQuote").value.trim();
    var name = box.querySelector("#repName").value.trim();
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

  function valid(p) {
    var field = box.querySelector("#repQuote");
    if (p.quote.length < 2) {
      field.setAttribute("aria-invalid", "true");
      msg("어디가 잘못됐는지 두 글자 이상 적어 주세요.", "no");
      field.focus();
      return false;
    }
    field.removeAttribute("aria-invalid");
    return true;
  }

  function setPending(value) {
    pending = value;
    box.querySelector("#repSend").disabled = value;
    box.querySelector("#repGh").disabled = value;
    box.querySelector(".rep-box").setAttribute("aria-busy", String(value));
  }

  function send() {
    if (pending) return;
    var p = payload();
    if (!valid(p)) return;
    var c = cfg();
    if (!c) { github(); return; }
    try {
      if (p.author_name !== "익명") localStorage.setItem(NAMEKEY, p.author_name);
      else localStorage.removeItem(NAMEKEY);
    } catch (e) {}
    var requestSession = session;
    setPending(true); msg("보내는 중…", "");
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
      setPending(false);
      if (requestSession !== session || box.hidden) return;
      if (r.ok) {
        msg("접수됐습니다. 확인해서 고치겠습니다.", "ok");
        box.querySelector("#repSend").disabled = true;
      }
      else { msg("접수에 실패했습니다(" + r.status + "). GitHub에 남겨 주세요.", "no"); }
    }).catch(function () {
      setPending(false);
      if (requestSession !== session || box.hidden) return;
      msg("연결이 안 됩니다. GitHub에 남겨 주세요.", "no");
    });
  }

  function github() {
    if (pending) return;
    var p = payload();
    if (!valid(p)) return;
    var title = "[오류] " + (p.atom_id ? p.atom_id + " · " : "") + cut(p.quote, 50);
    var body =
      "### 어디\n" + location.origin + p.page_url + "\n" +
      (p.atom_id ? "항목 ID: `" + p.atom_id + "`\n" : "") +
      (p.detail ? "구분: " + p.detail + "\n" : "") +
      "\n### 틀린 내용\n" + p.quote + "\n" +
      (p.correction ? "\n### 맞는 내용\n" + p.correction + "\n" : "") +
      (p.evidence ? "\n### 근거\n" + p.evidence + "\n" : "");
    var u = GH + "?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
    window.open(u, "_blank", "noopener");
    msg("GitHub에서 내용을 확인하고 제출해야 접수됩니다. 창이 열리지 않으면 ", "");
    var link = document.createElement("a");
    link.href = u;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "신고 작성 화면 열기";
    box.querySelector("#repMsg").appendChild(link);
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
               (body ? body.getAttribute("data-drill") || body.textContent : el.textContent)
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
        k + ')">' + esc(label || "오류 신고") + "</button>";
    },
    openPage: function () { open({}); },
    scan: attachAtoms
  };

  function boot() {
    attachAtoms(document);
    var links = document.querySelectorAll(".foot-report");
    for (var i = 0; i < links.length; i++) {
      links[i].onclick = function (e) { e.preventDefault(); open({}); };
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
