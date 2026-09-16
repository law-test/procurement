/* 방문 통계 — Cloudflare Web Analytics
 *
 * 토큰 한 줄만 채우면 켜진다. 비어 있으면 아무것도 하지 않는다.
 *   1. dash.cloudflare.com 로그인
 *   2. 왼쪽 메뉴 Analytics & Logs → Web Analytics
 *   3. Add a site → jodal.pro 입력 → Done
 *   4. 나오는 <script ... data-cf-beacon='{"token":"XXXX"}'> 에서 token 값만 아래에 붙인다
 *
 * 쿠키를 쓰지 않고 개인을 추적하지 않는다. 집계된 방문 수·페이지·유입 경로만 본다.
 * 광고 추적기가 아니므로 쿠키 동의창이 필요하지 않다.
 */
window.JODAL_ANALYTICS = window.JODAL_ANALYTICS || {
  cfToken: ""      // ← 여기에 Cloudflare Web Analytics 토큰
};

(function () {
  "use strict";
  if (window.__jodalAnalyticsLoaded) return;
  window.__jodalAnalyticsLoaded = true;

  var cfg = window.JODAL_ANALYTICS || {};
  var token = (cfg.cfToken || "").trim();
  if (!token) return;                       // 토큰이 없으면 조용히 끝낸다
  if (location.protocol === "file:") return; // 내려받아 열어 본 파일에서는 세지 않는다
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return;

  var s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token: token }));
  (document.body || document.head || document.documentElement).appendChild(s);
})();
