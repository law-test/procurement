#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""사이트 페이지를 파일 하나로 합친다(CSS·JS·데이터 인라인).
채팅에서 내려받아 더블클릭으로 열어 보기 위한 것. 서버 없이 동작한다."""
import json, os, posixpath, re
from pathlib import Path

OUT = os.environ.get("PPM_OUT", str(Path(__file__).resolve().parents[1]))
# Keep exports outside the site so a later sitemap/build cannot publish them.
DST = os.environ.get("PPM_PACK", str(Path(OUT).resolve().parent / (Path(OUT).name + "-preview")))

NAME = {
    "index.html":        "학습방.html",
    "plan/index.html":   "학습계획.html",
    "c/index.html":      "익히기_목차.html",
    "c/W3.1.4/index.html": "익히기_계약종결.html",
    "c/W1.5.2/index.html": "익히기_공공계약법령.html",
    "c/P.4.1/index.html":  "익히기_실기_계약일반관리.html",
    "drill/index.html":  "외우기.html",
    "cbt/index.html":    "모의시험.html",
    "exam/index.html":   "시험정보.html",
    "news/index.html":   "소식자료.html",
    "about/index.html":  "소개.html",
    "privacy/index.html": "개인정보처리방침.html",
    "terms/index.html":   "이용약관.html",
    "future/index.html":  "자격의앞날.html",
    "links/index.html":   "바로가기.html",
    "errata/index.html":  "교재대조표.html",
}
EMBED_SUBJ = ["law", "plan", "contract", "practice"]


def read(p):
    return open(os.path.join(OUT, p), encoding="utf-8").read()


def inline_assets(s, depth):
    up = "../" * depth
    for css in sorted(p.name for p in (Path(OUT) / "assets").glob("*.css")):
        tag = '<link rel="stylesheet" href="%sassets/%s"/>' % (up, css)
        if tag in s:
            s = s.replace(tag, "<style>\n%s\n</style>" % read("assets/" + css))
    for js in sorted(p.name for p in (Path(OUT) / "assets").glob("*.js")):
        tag = '<script src="%sassets/%s"></script>' % (up, js)
        if tag in s:
            code = re.sub(r"</script", r"<\\/script", read("assets/" + js), flags=re.I)
            s = s.replace(tag, '<script data-packed-src="assets/%s">\n%s\n</script>' % (js, code))
    return s


ROOTMAP = {
    "": "학습방.html", "index.html": "학습방.html",
    "plan": "학습계획.html", "drill": "외우기.html", "cbt": "모의시험.html",
    "exam": "시험정보.html", "news": "소식자료.html", "about": "소개.html",
    "privacy": "개인정보처리방침.html", "terms": "이용약관.html",
    "future": "자격의앞날.html", "links": "바로가기.html", "errata": "교재대조표.html", "card": "외우기.html",
}


def map_target(src, href):
    """src(사이트 기준 경로)에서 본 상대 href → 합친 파일 이름. 못 맞추면 None."""
    if href.startswith(("http", "mailto:", "javascript:", "#")):
        return None
    if "'" in href or "+" in href:        # 자바스크립트 문자열 조립
        return None
    cut = len(href)
    for ch in "#?":
        i = href.find(ch)
        if i >= 0:
            cut = min(cut, i)
    path, suffix = href[:cut], href[cut:]
    if not path:
        return None
    # Site URLs always use POSIX separators, even when packing on Windows.
    full = posixpath.normpath(posixpath.join(posixpath.dirname(src), path))
    if full == ".":
        full = ""
    if full.startswith(("assets", "data")) or full.startswith(".."):
        return None
    exported = full if full.endswith(".html") else full + "/index.html"
    if exported in NAME:
        return NAME[exported] + suffix
    if full.endswith("/index.html"):
        full = full[: -len("/index.html")]
    if full in ROOTMAP:
        return ROOTMAP[full] + suffix
    if full.startswith("c/"):
        return "https://jodal.pro/" + full.rstrip("/") + "/" + suffix
    return None


def fix_links(s, src):
    def sub(m):
        t = map_target(src, m.group(1))
        return 'href="%s"' % t if t else m.group(0)
    return re.sub(r'href="([^"]*)"', sub, s)


def embed_data(s):
    """Adapt the public loading API after quiz.js; never patch its implementation."""
    datasets = {kind + "." + slug: json.loads(read("data/%s.%s.json" % (kind, slug)))
                for kind in ("quiz", "cards") for slug in EMBED_SUBJ}
    # Prevent a data string from closing the surrounding HTML script element.
    encoded = json.dumps(datasets, ensure_ascii=False).replace("<", "\\u003c")
    inject = """
<script data-packed-data="true">
(function () {
  var data = %s;
  function load(kind, slug) {
    var key = kind + '.' + slug;
    if (!Object.prototype.hasOwnProperty.call(data, key)) return Promise.reject(new Error('이 파일에 없는 과목입니다.'));
    return Promise.resolve(data[key]);
  }
  window.PPMQ.loadQuiz = function (slug) { return load('quiz', slug); };
  window.PPMQ.loadCards = function (slug) { return load('cards', slug); };
  // Answer explanations create concept links after the static export pass.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a');
    if (link && (link.getAttribute('href') || '').indexOf('../c/') === 0) {
      link.href = 'https://jodal.pro/' + link.getAttribute('href').slice(3);
    }
  });
})();
</script>
""" % encoded
    pattern = r'(<script data-packed-src="assets/quiz\.js">[\s\S]*?</script>)'
    s, count = re.subn(pattern, lambda match: match[1] + inject, s, count=1)
    if count != 1:
        raise ValueError("Cannot embed study data: packed quiz.js was not found")
    return s


def main():
    os.makedirs(DST, exist_ok=True)
    made = []
    for src, name in NAME.items():
        if not os.path.exists(os.path.join(OUT, src)):
            print("  (없음) %s" % src)
            continue
        depth = src.count("/")
        s = read(src)
        s = inline_assets(s, depth)
        s = fix_links(s, src)
        if src in ("drill/index.html", "cbt/index.html"):
            s = embed_data(s)
            s = s.replace("</h1>", "</h1><p class=\"note\">미리보기용 단독 판입니다. 필기·실기 연습 데이터가 들어 있습니다. 포함되지 않은 개념 페이지와 공식 출처는 인터넷 연결이 필요합니다.</p>", 1)
        p = os.path.join(DST, name)
        open(p, "w", encoding="utf-8").write(s)
        made.append((name, len(s.encode("utf-8"))))
        print("  %-34s %8.1f KB" % (name, len(s.encode("utf-8")) / 1024))
    return made


if __name__ == "__main__":
    main()
