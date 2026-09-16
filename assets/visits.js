/* 조달프로 방문 집계 — 쿠키를 만들지 않는다.
   브라우저에 남기는 것은 무작위 UUID 하나(jodal.did.v1)뿐이고, 그 값으로 같은 브라우저를 알아본다.
   보내는 것: 화면 주소 + (브라우저를 새로 연 첫 화면에서만) 브라우저·운영체제 이름, 모바일 여부,
   화면 크기, 언어, 시간대. 이름·연락처는 받지 않고, IP는 저장하지 않는다.
   supabase/visits.sql 을 적용한 뒤부터 집계된다. 적용 전에는 호출이 실패하고 화면에는 영향이 없다. */
(function () {
  if (window.__jodalVisits) return;
  window.__jodalVisits = true;
  if (location.protocol === 'file:') return;
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) return;

  var HERE = (function () {
    var me = document.currentScript;
    if (me && me.src) {
      var i = me.src.lastIndexOf('assets/');
      if (i >= 0) return me.src.slice(0, i);
    }
    var lg = document.querySelector('header a.logo');
    if (lg && lg.getAttribute('href')) return lg.getAttribute('href');
    return './';
  })();

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function uuid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : ((r & 3) | 8)).toString(16);
    });
  }

  function deviceId() {
    var k = 'jodal.did.v1';
    var v = get(k);
    if (v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return v;
    v = uuid();
    set(k, v);
    return v;
  }

  function meta() {
    var ua = navigator.userAgent || '';
    var b = 'etc';
    if (/Edg\//.test(ua)) b = 'Edge';
    else if (/OPR\//.test(ua)) b = 'Opera';
    else if (/SamsungBrowser/.test(ua)) b = 'Samsung';
    else if (/Whale/.test(ua)) b = 'Whale';
    else if (/Chrome\//.test(ua)) b = 'Chrome';
    else if (/Firefox\//.test(ua)) b = 'Firefox';
    else if (/Safari\//.test(ua)) b = 'Safari';
    var o = 'etc';
    if (/Windows NT/.test(ua)) o = 'Windows';
    else if (/Android/.test(ua)) o = 'Android';
    else if (/iPhone|iPad|iPod/.test(ua)) o = 'iOS';
    else if (/Mac OS X/.test(ua)) o = 'macOS';
    else if (/Linux/.test(ua)) o = 'Linux';
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return {
      ua: ua.slice(0, 500),
      browser: b,
      os: o,
      is_mobile: /Android|iPhone|iPad|iPod|Mobile/.test(ua),
      screen: (screen.width || 0) + 'x' + (screen.height || 0),
      lang: (navigator.language || '').slice(0, 20),
      tz: tz.slice(0, 60)
    };
  }

  function here() {
    var p = location.pathname || '/';
    p = p.replace(/index\.html?$/i, '');
    if (!p) p = '/';
    return p.slice(0, 200);
  }

  function fresh() {
    try {
      if (sessionStorage.getItem('jodal.sess.v1')) return false;
      sessionStorage.setItem('jodal.sess.v1', '1');
      return true;
    } catch (e) { return true; }
  }

  function send(cfg) {
    var start = fresh();
    var url = String(cfg.url).replace(/\/+$/, '') + '/rest/v1/rpc/record_visit';
    try {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.key,
          Authorization: 'Bearer ' + cfg.key
        },
        body: JSON.stringify({
          p_device_id: deviceId(),
          p_path: here(),
          p_meta: start ? meta() : {},
          p_session_start: start
        }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function withCfg(cb) {
    var c = window.JODAL_RANK_CONFIG;
    if (c && c.url && c.key) return cb(c);
    var s = document.createElement('script');
    s.src = HERE + 'assets/rank-config.js';
    s.onload = function () {
      var d = window.JODAL_RANK_CONFIG;
      if (d && d.url && d.key) cb(d);
    };
    s.onerror = function () {};
    (document.head || document.documentElement).appendChild(s);
  }

  function go() { withCfg(send); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
